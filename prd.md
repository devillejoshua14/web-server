# PRD: Custom Web Server from Raw Sockets

## Overview

Build a web server in **Node.js** from **raw TCP sockets**, implementing the HTTP/1.1 protocol from scratch. This is a learning-focused project designed to deeply understand how web servers work under the hood — from parsing raw bytes into HTTP requests to routing, middleware pipelines, JWT authentication, and PostgreSQL integration.

---

## Goals

- Understand the HTTP/1.1 protocol by implementing request parsing and response serialization manually
- Learn low-level networking with Node.js `net` module (raw TCP sockets)
- Build a middleware and routing system similar to Express — but from scratch
- Implement JWT-based authentication
- Integrate with PostgreSQL for persistent storage
- Establish a comprehensive testing strategy (unit, integration, load)

## Non-Goals

- HTTP/2 or HTTP/3 support
- TLS/SSL termination (can be added later)
- WebSocket support
- Production-grade performance or deployment

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│                  TCP Server                      │
│               (net.createServer)                 │
├─────────────────────────────────────────────────┤
│              HTTP Parser Layer                   │
│   ┌─────────────┐    ┌──────────────────┐       │
│   │ Request      │    │ Response         │       │
│   │ Parser       │    │ Serializer       │       │
│   └─────────────┘    └──────────────────┘       │
├─────────────────────────────────────────────────┤
│             Middleware Pipeline                  │
│  ┌────────┐ ┌──────┐ ┌──────┐ ┌─────────────┐  │
│  │ Logger │→│ CORS │→│ Auth │→│ Body Parser │  │
│  └────────┘ └──────┘ └──────┘ └─────────────┘  │
├─────────────────────────────────────────────────┤
│                   Router                        │
│   ┌──────────┐  ┌──────────┐  ┌──────────┐     │
│   │ GET /api │  │ POST /api│  │ 404      │     │
│   └──────────┘  └──────────┘  └──────────┘     │
├─────────────────────────────────────────────────┤
│              Database Layer                     │
│           ┌──────────────────┐                  │
│           │   PostgreSQL     │                  │
│           │   (pg driver)    │                  │
│           └──────────────────┘                  │
└─────────────────────────────────────────────────┘
```

---

## Phases & Milestones

### Phase 1: TCP Foundation & HTTP Parsing

**Objective:** Accept TCP connections and parse raw HTTP/1.1 requests.

| Task | Description |
|------|-------------|
| TCP server | Create a TCP server using `net.createServer` that listens on a configurable port |
| Request parser | Parse raw HTTP request bytes into a structured object: method, URL, headers, body |
| Response builder | Build HTTP response strings with status line, headers, and body |
| Keep-alive | Handle `Connection: keep-alive` and `Connection: close` correctly |
| Chunked transfer | Support `Transfer-Encoding: chunked` for request bodies |
| Error handling | Gracefully handle malformed requests (400 Bad Request) |

**Deliverable:** A server that can receive a raw HTTP request and send back a valid HTTP response.

---

### Phase 2: Routing System

**Objective:** Route incoming requests to handler functions based on method and URL pattern.

| Task | Description |
|------|-------------|
| Route registration | API to register routes: `server.get('/path', handler)`, `server.post(...)`, etc. |
| Path parameters | Support dynamic segments: `/users/:id` extracts `{ id: '123' }` |
| Query string parsing | Parse `?key=value&foo=bar` into an object on the request |
| Route matching | Match incoming requests to registered routes with correct precedence |
| 404 handling | Default handler for unmatched routes |
| Method not allowed | Return 405 when path matches but method doesn't |

**Deliverable:** A declarative routing API that maps HTTP methods + URL patterns to handlers.

---

### Phase 3: Middleware Pipeline

**Objective:** Build a composable middleware system inspired by Express/Koa.

| Task | Description |
|------|-------------|
| Middleware chain | Implement `next()` pattern for sequential middleware execution |
| Global middleware | Middleware that runs on every request |
| Route-level middleware | Middleware scoped to specific routes or route groups |
| Built-in: Logger | Log method, URL, status code, and response time |
| Built-in: Body parser | Parse JSON and URL-encoded request bodies |
| Built-in: CORS | Configurable Cross-Origin Resource Sharing headers |
| Error middleware | Special error-handling middleware with `(err, req, res, next)` signature |

**Deliverable:** A middleware pipeline where request/response objects flow through a chain of functions.

---

### Phase 4: Authentication & Security

**Objective:** Implement JWT-based authentication and security best practices.

| Task | Description |
|------|-------------|
| JWT generation | Sign tokens with configurable secret and expiration |
| JWT verification | Middleware to verify and decode tokens from `Authorization: Bearer <token>` |
| Password hashing | Hash passwords with bcrypt before storing |
| Auth routes | `POST /auth/register` and `POST /auth/login` endpoints |
| Protected routes | Middleware to guard routes that require authentication |
| Rate limiting | Limit requests per IP per time window to prevent abuse |
| Input validation | Sanitize and validate user input to prevent injection attacks |
| Security headers | Add headers: `X-Content-Type-Options`, `X-Frame-Options`, `Strict-Transport-Security` |

**Deliverable:** A complete auth flow — register, login, receive JWT, access protected resources.

---

### Phase 5: PostgreSQL Integration

**Objective:** Connect to PostgreSQL and implement a basic data access layer.

| Task | Description |
|------|-------------|
| Connection pool | Set up a connection pool using the `pg` npm package |
| Schema & migrations | Create SQL migration files for users table and any sample data tables |
| Query builder | Simple helper for parameterized queries (prevent SQL injection) |
| User repository | CRUD operations for user accounts |
| Sample resource | Full CRUD API for a sample resource (e.g., "posts" or "todos") |
| Error mapping | Map database errors to appropriate HTTP status codes |
| Transaction support | Helper for wrapping multiple queries in a transaction |

**Deliverable:** Persistent data storage with safe, parameterized SQL queries and a clean data access pattern.

---

### Phase 6: Testing

**Objective:** Comprehensive test coverage across unit, integration, and load testing.

| Task | Description |
|------|-------------|
| Test framework setup | Configure a test runner (e.g., `node:test` or Jest) |
| HTTP parser unit tests | Test request parsing with valid, malformed, and edge-case inputs |
| Router unit tests | Test route matching, path params, query strings |
| Middleware unit tests | Test middleware chain execution, error propagation |
| Auth unit tests | Test JWT sign/verify, password hashing |
| Integration tests | End-to-end tests: send real HTTP requests, verify responses |
| Database tests | Test repository methods against a real (test) PostgreSQL database |
| Load testing | Use a tool like `autocannon` to benchmark requests/sec and latency |

**Deliverable:** A reliable test suite that validates correctness and provides confidence for refactoring.

---

## Project Structure

```
web-server/
├── src/
│   ├── server.js              # TCP server entry point
│   ├── http/
│   │   ├── request-parser.js  # Raw bytes → request object
│   │   ├── response.js        # Response builder & serializer
│   │   └── constants.js       # HTTP status codes, methods
│   ├── router/
│   │   ├── router.js          # Route registration & matching
│   │   └── route.js           # Individual route definition
│   ├── middleware/
│   │   ├── pipeline.js        # Middleware chain executor
│   │   ├── logger.js          # Request logging
│   │   ├── body-parser.js     # JSON/URL-encoded body parsing
│   │   ├── cors.js            # CORS headers
│   │   └── rate-limiter.js    # IP-based rate limiting
│   ├── auth/
│   │   ├── jwt.js             # Token sign/verify helpers
│   │   ├── hash.js            # Password hashing (bcrypt)
│   │   ├── auth-middleware.js  # Protect routes
│   │   └── auth-routes.js     # Register/login endpoints
│   └── db/
│       ├── pool.js            # PostgreSQL connection pool
│       ├── migrations/        # SQL migration files
│       └── repositories/      # Data access objects
├── tests/
│   ├── unit/
│   ├── integration/
│   └── load/
├── prd.md
├── package.json
└── .env.example
```

---

## Dependencies

| Package | Purpose |
|---------|---------|
| *(none)* | TCP server and HTTP parsing — use only Node.js built-in `net` and `buffer` modules |
| `pg` | PostgreSQL client for database connectivity |
| `bcrypt` | Password hashing |
| `jsonwebtoken` | JWT token signing and verification |
| `dotenv` | Environment variable loading |
| `autocannon` | Load testing (dev dependency) |

> **Note:** The HTTP server itself uses **zero external dependencies** — only Node.js built-ins. External packages are only used for database, crypto, and dev tooling.

---

## Success Criteria

1. Server correctly handles standard HTTP/1.1 GET, POST, PUT, DELETE requests parsed from raw TCP
2. Routes with path parameters and query strings resolve correctly
3. Middleware executes in order with proper `next()` flow and error handling
4. Users can register, log in, and access protected routes via JWT
5. Data persists in PostgreSQL with safe, parameterized queries
6. All unit and integration tests pass
7. Load test demonstrates the server can handle 1000+ concurrent connections without crashing
