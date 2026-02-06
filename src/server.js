const net = require('net');
const { parseRequest, HttpParseError } = require('./http/request-parser');
const { HttpResponse } = require('./http/response');
const { STATUS_CODES } = require('./http/constants');
const { Router } = require('./router/router');
const { Pipeline, runMiddlewareStack } = require('./middleware/pipeline');

class Server {
  constructor() {
    this._server = null;
    this._requestHandler = null;
    this._router = new Router();
    this._pipeline = new Pipeline();
  }

  /**
   * Register global middleware or an onRequest handler.
   *   server.use(middlewareFn)        - global middleware
   *   server.use(errorMiddlewareFn)   - error middleware (4 args)
   */
  use(fn) {
    this._pipeline.use(fn);
    return this;
  }

  /**
   * Register a handler that will be called for every parsed HTTP request.
   * handler(req, res) where req is the parsed request object
   * and res is an HttpResponse instance.
   */
  onRequest(handler) {
    this._requestHandler = handler;
  }

  // Route registration convenience methods — support optional route-level middleware
  get(pattern, ...args) { this._router.get(pattern, ...args); return this; }
  post(pattern, ...args) { this._router.post(pattern, ...args); return this; }
  put(pattern, ...args) { this._router.put(pattern, ...args); return this; }
  delete(pattern, ...args) { this._router.delete(pattern, ...args); return this; }
  patch(pattern, ...args) { this._router.patch(pattern, ...args); return this; }
  head(pattern, ...args) { this._router.head(pattern, ...args); return this; }
  options(pattern, ...args) { this._router.options(pattern, ...args); return this; }

  /**
   * Start listening on the given port.
   */
  listen(port, host = '0.0.0.0', callback) {
    this._server = net.createServer((socket) => {
      this._handleConnection(socket);
    });

    this._server.on('error', (err) => {
      console.error(`Server error: ${err.message}`);
    });

    this._server.listen(port, host, () => {
      console.log(`Server listening on ${host}:${port}`);
      if (callback) callback();
    });

    return this;
  }

  /**
   * Stop the server.
   */
  close(callback) {
    if (this._server) {
      this._server.close(callback);
    }
  }

  /**
   * Handle an individual TCP connection.
   * Supports keep-alive: multiple requests can arrive on the same socket.
   */
  _handleConnection(socket) {
    let buffer = Buffer.alloc(0);

    socket.on('data', (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);
      this._processBuffer(socket, buffer, (remaining) => {
        buffer = remaining;
      });
    });

    socket.on('error', (err) => {
      if (err.code !== 'ECONNRESET') {
        console.error(`Socket error: ${err.message}`);
      }
    });

    socket.on('close', () => {
      buffer = Buffer.alloc(0);
    });

    // Timeout idle connections after 30 seconds
    socket.setTimeout(30000, () => {
      socket.end();
    });
  }

  /**
   * Attempt to parse one or more requests from the buffer (pipelining).
   * Calls updateBuffer with the remaining unprocessed bytes.
   */
  _processBuffer(socket, buffer, updateBuffer) {
    let remaining = buffer;

    while (remaining.length > 0) {
      let req;
      try {
        req = parseRequest(remaining);
      } catch (err) {
        if (err instanceof HttpParseError) {
          this._sendError(socket, err.statusCode, err.message);
          socket.end();
          return;
        }
        this._sendError(socket, 500, 'Internal Server Error');
        socket.end();
        return;
      }

      // If parseRequest returns null, the request is incomplete — wait for more data
      if (req === null) {
        break;
      }

      // Slice off the consumed bytes
      remaining = remaining.slice(req._totalLength);

      // Build the response object
      const res = new HttpResponse(socket);

      // Attach socket ref so middleware (e.g. rate limiter) can read remoteAddress
      req._socket = socket;

      // Determine if we should keep the connection alive
      const connectionHeader = (req.headers['connection'] || '').toLowerCase();
      const keepAlive =
        req.httpVersion === 'HTTP/1.1'
          ? connectionHeader !== 'close'
          : connectionHeader === 'keep-alive';

      if (keepAlive) {
        res.setHeader('connection', 'keep-alive');
      } else {
        res.setHeader('connection', 'close');
      }

      // Run the request through the global middleware pipeline,
      // then dispatch to the router or fallback handler.
      this._pipeline.execute(req, res, (req, res) => {
        if (this._router._routes.length > 0) {
          this._dispatch(req, res, socket);
        } else if (this._requestHandler) {
          this._requestHandler(req, res);
        } else {
          res.status(200).text('OK');
        }
      });

      // Close connection if not keep-alive
      if (!keepAlive) {
        socket.end();
        return;
      }
    }

    updateBuffer(remaining);
  }

  /**
   * Dispatch a request through the router.
   * Runs route-level middleware before the handler.
   */
  _dispatch(req, res, socket) {
    const result = this._router.resolve(req.method, req.path);

    if (result.status === 404) {
      res.status(404).json({ error: 'Not Found' });
      return;
    }

    if (result.status === 405) {
      res.setHeader('allow', result.allowedMethods.join(', '));
      res.status(405).json({ error: 'Method Not Allowed' });
      return;
    }

    // Attach params to the request object
    req.params = result.params;

    // Run route-level middleware, then the handler
    if (result.middleware.length > 0) {
      runMiddlewareStack(result.middleware, req, res, (err) => {
        if (err) {
          this._pipeline.handleError(err, req, res);
          return;
        }
        this._invokeHandler(result.handler, req, res);
      });
    } else {
      this._invokeHandler(result.handler, req, res);
    }
  }

  /**
   * Safely invoke a route handler with error catching.
   * Errors are routed through the pipeline's error middleware.
   */
  _invokeHandler(handler, req, res) {
    try {
      handler(req, res);
    } catch (err) {
      this._pipeline.handleError(err, req, res);
    }
  }

  /**
   * Send a raw error response on the socket.
   */
  _sendError(socket, statusCode, message) {
    const statusText = STATUS_CODES[statusCode] || 'Unknown';
    const body = JSON.stringify({ error: message });
    const raw =
      `HTTP/1.1 ${statusCode} ${statusText}\r\n` +
      `content-type: application/json; charset=utf-8\r\n` +
      `content-length: ${Buffer.byteLength(body)}\r\n` +
      `connection: close\r\n` +
      `\r\n` +
      body;

    socket.write(raw);
  }
}

// If run directly, start the full server with DB support
if (require.main === module) {
  require('dotenv').config();

  const port = parseInt(process.env.PORT, 10) || 3000;
  const server = new Server();

  // Global middleware
  const { logger } = require('./middleware/logger');
  const { bodyParser } = require('./middleware/body-parser');
  const { cors } = require('./middleware/cors');
  const { securityHeaders } = require('./middleware/security-headers');
  const { rateLimiter } = require('./middleware/rate-limiter');
  server.use(securityHeaders());
  server.use(logger());
  server.use(cors());
  server.use(rateLimiter());
  server.use(bodyParser());

  // Error handler
  server.use((err, req, res, next) => {
    console.error('Unhandled error:', err.message);
    res.status(500).json({ error: 'Something went wrong' });
  });

  // Database setup
  const { createPool } = require('./db/pool');
  const { runMigrations } = require('./db/migrate');
  const userRepo = require('./db/repositories/user-repository');
  const { registerAuthRoutes } = require('./auth/auth-routes');
  const { registerPostRoutes } = require('./routes/post-routes');

  createPool();

  runMigrations().then(() => {
    // Auth routes (DB-backed)
    registerAuthRoutes(server, { userRepo });

    // Post CRUD routes
    registerPostRoutes(server);

    // Health check
    server.get('/', (req, res) => {
      res.json({ message: 'Web server is running', version: '1.0.0' });
    });

    server.listen(port);
  }).catch((err) => {
    console.error('Failed to start server:', err.message);
    process.exit(1);
  });
}

module.exports = { Server };
