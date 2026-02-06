const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const { Server } = require('../../src/server');
const { bodyParser } = require('../../src/middleware/body-parser');
const { cors } = require('../../src/middleware/cors');
const { securityHeaders } = require('../../src/middleware/security-headers');
const { rateLimiter } = require('../../src/middleware/rate-limiter');
const { registerAuthRoutes } = require('../../src/auth/auth-routes');
const { authGuard } = require('../../src/auth/auth-middleware');

let server;
let baseUrl;

function request(method, path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : '';
    const url = new URL(path, baseUrl);
    const opts = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: { ...headers },
    };
    if (bodyStr) {
      opts.headers['Content-Type'] = 'application/json';
      opts.headers['Content-Length'] = Buffer.byteLength(bodyStr);
    }
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        let parsed;
        try { parsed = JSON.parse(data); } catch { parsed = data; }
        resolve({ status: res.statusCode, headers: res.headers, body: parsed, raw: data });
      });
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

describe('Integration: Full server', () => {
  before((_, done) => {
    server = new Server();

    // Middleware
    server.use(securityHeaders());
    server.use(cors({ origin: 'http://localhost:3000' }));
    server.use(rateLimiter({ windowMs: 60000, maxRequests: 50 }));
    server.use(bodyParser());
    server.use((err, req, res, next) => {
      res.status(500).json({ error: err.message });
    });

    // Auth routes (in-memory)
    registerAuthRoutes(server, { secret: 'integration-test-secret' });

    // Protected route
    server.get('/api/profile', [authGuard({ secret: 'integration-test-secret' })], (req, res) => {
      res.json({ userId: req.user.userId, email: req.user.email });
    });

    // Public routes
    server.get('/', (req, res) => {
      res.json({ message: 'ok' });
    });

    server.get('/users/:id', (req, res) => {
      res.json({ id: req.params.id, query: req.query });
    });

    server.post('/echo', (req, res) => {
      res.json({ received: req.parsedBody });
    });

    server.get('/error', (req, res) => {
      throw new Error('test-error');
    });

    server.listen(0, '127.0.0.1', () => {
      const addr = server._server.address();
      baseUrl = `http://127.0.0.1:${addr.port}`;
      done();
    });
  });

  after((_, done) => {
    server.close(done);
  });

  // --- Routing ---

  it('GET / returns 200 with JSON', async () => {
    const res = await request('GET', '/');
    assert.equal(res.status, 200);
    assert.deepStrictEqual(res.body, { message: 'ok' });
  });

  it('GET /users/:id extracts path params', async () => {
    const res = await request('GET', '/users/42?fields=name');
    assert.equal(res.status, 200);
    assert.equal(res.body.id, '42');
    assert.deepStrictEqual(res.body.query, { fields: 'name' });
  });

  it('returns 404 for unknown routes', async () => {
    const res = await request('GET', '/nonexistent');
    assert.equal(res.status, 404);
    assert.deepStrictEqual(res.body, { error: 'Not Found' });
  });

  it('returns 405 for wrong method', async () => {
    const res = await request('DELETE', '/');
    assert.equal(res.status, 405);
    assert.ok(res.headers['allow']);
  });

  // --- Body parsing ---

  it('POST /echo parses JSON body', async () => {
    const res = await request('POST', '/echo', { hello: 'world' });
    assert.equal(res.status, 200);
    assert.deepStrictEqual(res.body.received, { hello: 'world' });
  });

  // --- Security headers ---

  it('includes security headers on every response', async () => {
    const res = await request('GET', '/');
    assert.equal(res.headers['x-content-type-options'], 'nosniff');
    assert.equal(res.headers['x-frame-options'], 'DENY');
    assert.ok(res.headers['strict-transport-security']);
    assert.ok(res.headers['referrer-policy']);
  });

  // --- CORS ---

  it('includes CORS headers', async () => {
    const res = await request('GET', '/');
    assert.ok(res.headers['access-control-allow-origin']);
    assert.ok(res.headers['access-control-allow-methods']);
  });

  // --- Error handling ---

  it('routes handler errors through error middleware', async () => {
    const res = await request('GET', '/error');
    assert.equal(res.status, 500);
    assert.deepStrictEqual(res.body, { error: 'test-error' });
  });

  // --- Rate limiting ---

  it('includes rate limit headers', async () => {
    const res = await request('GET', '/');
    assert.ok(res.headers['x-ratelimit-limit']);
    assert.ok(res.headers['x-ratelimit-remaining']);
    assert.ok(res.headers['x-ratelimit-reset']);
  });

  // --- Full auth flow ---

  it('register -> login -> access protected route', async () => {
    // Register
    const reg = await request('POST', '/auth/register', {
      email: 'integration@test.com',
      password: 'TestPassword1',
      name: 'Integration User',
    });
    assert.equal(reg.status, 201);
    assert.equal(reg.body.user.email, 'integration@test.com');

    // Login
    const login = await request('POST', '/auth/login', {
      email: 'integration@test.com',
      password: 'TestPassword1',
    });
    assert.equal(login.status, 200);
    assert.ok(login.body.token);

    // Access protected route
    const profile = await request('GET', '/api/profile', null, {
      Authorization: `Bearer ${login.body.token}`,
    });
    assert.equal(profile.status, 200);
    assert.equal(profile.body.email, 'integration@test.com');
  });

  it('rejects protected route without token', async () => {
    const res = await request('GET', '/api/profile');
    assert.equal(res.status, 401);
  });

  it('rejects protected route with bad token', async () => {
    const res = await request('GET', '/api/profile', null, {
      Authorization: 'Bearer invalid.token',
    });
    assert.equal(res.status, 401);
  });

  it('rejects duplicate registration', async () => {
    // First registration
    await request('POST', '/auth/register', {
      email: 'dupe@test.com', password: 'Password123', name: 'Dupe',
    });
    // Second registration with same email
    const res = await request('POST', '/auth/register', {
      email: 'dupe@test.com', password: 'Password123', name: 'Dupe',
    });
    assert.equal(res.status, 409);
  });

  it('rejects login with wrong password', async () => {
    await request('POST', '/auth/register', {
      email: 'wrong@test.com', password: 'Correct123', name: 'Test',
    });
    const res = await request('POST', '/auth/login', {
      email: 'wrong@test.com', password: 'Wrong12345',
    });
    assert.equal(res.status, 401);
  });

  it('validates email format on register', async () => {
    const res = await request('POST', '/auth/register', {
      email: 'not-an-email', password: 'Password123',
    });
    assert.equal(res.status, 400);
  });

  it('validates password strength on register', async () => {
    const res = await request('POST', '/auth/register', {
      email: 'weak@test.com', password: 'short',
    });
    assert.equal(res.status, 400);
  });
});
