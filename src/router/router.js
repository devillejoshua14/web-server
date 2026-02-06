const { Route } = require('./route');

class Router {
  constructor() {
    this._routes = [];
  }

  /**
   * Register a route for the given method and pattern.
   * Supports optional route-level middleware:
   *   add('GET', '/path', handler)
   *   add('GET', '/path', [mw1, mw2], handler)
   */
  add(method, pattern, ...args) {
    let middleware = [];
    let handler;

    if (args.length === 1) {
      handler = args[0];
    } else if (args.length === 2 && Array.isArray(args[0])) {
      middleware = args[0];
      handler = args[1];
    } else {
      throw new Error('Invalid route arguments: expected (pattern, handler) or (pattern, [middleware], handler)');
    }

    const route = new Route(method, pattern, handler);
    route.middleware = middleware;
    this._routes.push(route);
    return this;
  }

  // Convenience methods for each HTTP verb
  get(pattern, ...args) { return this.add('GET', pattern, ...args); }
  post(pattern, ...args) { return this.add('POST', pattern, ...args); }
  put(pattern, ...args) { return this.add('PUT', pattern, ...args); }
  delete(pattern, ...args) { return this.add('DELETE', pattern, ...args); }
  patch(pattern, ...args) { return this.add('PATCH', pattern, ...args); }
  head(pattern, ...args) { return this.add('HEAD', pattern, ...args); }
  options(pattern, ...args) { return this.add('OPTIONS', pattern, ...args); }

  /**
   * Resolve an incoming request to a handler.
   *
   * Precedence:
   *   1. Exact static match for the correct method
   *   2. Dynamic (parameterized) match for the correct method
   *   3. Path matches but method doesn't → 405
   *   4. No path matches → 404
   *
   * Returns { handler, params, status }
   *   - status 200: matched, handler is the route handler, params extracted
   *   - status 404: no route matched the path
   *   - status 405: path matched but method didn't, allowedMethods included
   */
  resolve(method, path) {
    let matchedRoute = null;
    let matchedParams = null;
    let pathMatchedButMethodDidNot = false;
    const allowedMethods = new Set();

    // Two-pass: first try static routes, then dynamic
    for (const route of this._routes) {
      const { matched, params } = route.match(path);
      if (!matched) continue;

      if (route.method === method.toUpperCase()) {
        // Prefer static over dynamic (first match wins within category)
        if (!matchedRoute || (route.isStatic && !matchedRoute.isStatic)) {
          matchedRoute = route;
          matchedParams = params;
        }
      } else {
        pathMatchedButMethodDidNot = true;
        allowedMethods.add(route.method);
      }
    }

    // Found a matching route
    if (matchedRoute) {
      // Also collect allowed methods for the matched path (for Allow header)
      allowedMethods.add(matchedRoute.method);
      return {
        status: 200,
        handler: matchedRoute.handler,
        middleware: matchedRoute.middleware || [],
        params: matchedParams,
        allowedMethods: Array.from(allowedMethods),
      };
    }

    // Path exists but wrong method
    if (pathMatchedButMethodDidNot) {
      return {
        status: 405,
        handler: null,
        params: null,
        allowedMethods: Array.from(allowedMethods),
      };
    }

    // No match at all
    return {
      status: 404,
      handler: null,
      params: null,
      allowedMethods: [],
    };
  }
}

module.exports = { Router };
