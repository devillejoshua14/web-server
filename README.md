# Raw TCP Web Server

A fully-featured HTTP/1.1 web server built from scratch using Node.js `net` module — no Express, no `http` module, just raw TCP sockets.

Built as a deep-dive learning project to understand how web servers work under the hood: from parsing raw bytes into HTTP requests to routing, middleware pipelines, JWT authentication, and PostgreSQL integration.

## Features

- **Raw TCP** — HTTP request parsing and response serialization from scratch
- **Routing** — Method + URL pattern matching with path parameters and query strings
- **Middleware Pipeline** — Composable `next()` chain with error handling
- **Authentication** — JWT tokens, bcrypt password hashing, protected routes
- **Security** — Rate limiting, CORS, security headers, input validation
- **PostgreSQL** — Connection pooling, migrations, parameterized queries, transactions
- **Keep-Alive** — Persistent connections with request pipelining
- **~52,000 req/s** — Benchmarked with autocannon at 100 concurrent connections

## Quick Start

```bash
# Install dependencies
npm install

# Run the server (in-memory mode, no DB required)
node src/server.js

# Run with PostgreSQL
cp .env.example .env        # edit with your DB credentials
npm run migrate              # create tables
npm start
```

## Project Structure

```
src/
├── server.js                 # TCP server entry point
├── http/
│   ├── request-parser.js     # Raw bytes → request object
│   ├── response.js           # Response builder & serializer
│   └── constants.js          # HTTP status codes, methods
├── router/
│   ├── router.js             # Route registration & matching
│   └── route.js              # Individual route with regex matching
├── middleware/
│   ├── pipeline.js           # Middleware chain executor
│   ├── logger.js             # Request logging
│   ├── body-parser.js        # JSON / URL-encoded body parsing
│   ├── cors.js               # CORS headers
│   ├── rate-limiter.js       # IP-based rate limiting
│   └── security-headers.js   # Security headers
├── auth/
│   ├── jwt.js                # Token sign/verify
│   ├── hash.js               # Password hashing (bcrypt)
│   ├── auth-middleware.js     # Bearer token guard
│   ├── auth-routes.js        # Register/login endpoints
│   └── validate.js           # Input validation & sanitization
├── db/
│   ├── pool.js               # PostgreSQL connection pool
│   ├── query.js              # Parameterized query & transaction helper
│   ├── errors.js             # PG error → HTTP status mapping
│   ├── migrate.js            # Migration runner
│   ├── migrations/           # SQL migration files
│   └── repositories/         # User & post data access
└── routes/
    └── post-routes.js        # CRUD API for posts resource
```

## API

### Usage

```js
const { Server } = require('./src/server');
const { bodyParser } = require('./src/middleware/body-parser');
const { cors } = require('./src/middleware/cors');

const server = new Server();

// Global middleware
server.use(cors());
server.use(bodyParser());

// Routes
server.get('/', (req, res) => {
  res.json({ message: 'Hello!' });
});

server.get('/users/:id', (req, res) => {
  res.json({ userId: req.params.id, query: req.query });
});

server.post('/users', (req, res) => {
  res.status(201).json({ created: req.parsedBody });
});

// Route-level middleware
const { authGuard } = require('./src/auth/auth-middleware');
server.get('/profile', [authGuard()], (req, res) => {
  res.json({ user: req.user });
});

// Error handler
server.use((err, req, res, next) => {
  res.status(500).json({ error: err.message });
});

server.listen(3000);
```

### Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/register` | No | Register a new user |
| POST | `/auth/login` | No | Login, receive JWT |
| GET | `/api/posts` | No | List all posts |
| GET | `/api/posts/:id` | No | Get a single post |
| POST | `/api/posts` | Yes | Create a post |
| PUT | `/api/posts/:id` | Yes | Update own post |
| DELETE | `/api/posts/:id` | Yes | Delete own post |

### Response Helpers

```js
res.json({ key: 'value' });       // application/json
res.text('Hello');                  // text/plain
res.html('<h1>Hello</h1>');        // text/html
res.status(201).json({ ok: true });
res.sendStatus(204);               // No Content
res.setHeader('x-custom', 'val');
```

## Testing

```bash
# Run all tests (unit + integration)
npm test

# Unit tests only
npm run test:unit

# Integration tests only
npm run test:integration

# Load benchmark
npm run test:load
```

**Test Results:** 85 tests passing (69 unit + 16 integration), 0 failures.

## Load Test Results

| Benchmark | Req/sec | Avg Latency | p99 Latency | Errors |
|-----------|---------|-------------|-------------|--------|
| GET / | 52,393 | 1.22ms | 2ms | 0 |
| GET /users/:id | 51,830 | 1.26ms | 2ms | 0 |
| POST /echo (JSON) | 49,680 | 1.35ms | 2ms | 0 |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `DB_HOST` | `localhost` | PostgreSQL host |
| `DB_PORT` | `5432` | PostgreSQL port |
| `DB_NAME` | `webserver` | Database name |
| `DB_USER` | `postgres` | Database user |
| `DB_PASSWORD` | | Database password |
| `JWT_SECRET` | | Secret for signing tokens |
| `JWT_EXPIRES_IN` | `1h` | Token expiration |

## Dependencies

The HTTP server itself uses **zero external dependencies** — only Node.js built-in `net` and `buffer` modules.

| Package | Purpose |
|---------|---------|
| `pg` | PostgreSQL client |
| `bcrypt` | Password hashing |
| `jsonwebtoken` | JWT signing/verification |
| `dotenv` | Environment variable loading |
| `autocannon` | Load testing (dev) |
