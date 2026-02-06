/**
 * Represents a single route definition.
 * Supports static paths (/users) and dynamic segments (/users/:id).
 */
class Route {
  /**
   * @param {string} method - HTTP method (GET, POST, etc.)
   * @param {string} pattern - URL pattern, e.g. "/users/:id/posts"
   * @param {Function} handler - Route handler function(req, res)
   */
  constructor(method, pattern, handler) {
    this.method = method.toUpperCase();
    this.pattern = pattern;
    this.handler = handler;

    // Pre-compile the pattern into segments for fast matching
    this._segments = pattern.split('/').filter(Boolean);
    this._paramNames = [];
    this._regex = this._buildRegex();
  }

  /**
   * Build a regex from the pattern for matching incoming paths.
   * Static segments match literally, :param segments capture a named group.
   */
  _buildRegex() {
    const parts = this._segments.map((seg) => {
      if (seg.startsWith(':')) {
        const paramName = seg.slice(1);
        this._paramNames.push(paramName);
        return '([^/]+)';
      }
      // Escape regex special chars in static segments
      return seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    });

    return new RegExp(`^/${parts.join('/')}$`);
  }

  /**
   * Test if a given path matches this route.
   * Returns { matched: true, params: { id: '123' } } or { matched: false }.
   */
  match(path) {
    const result = this._regex.exec(path);
    if (!result) {
      return { matched: false };
    }

    const params = {};
    for (let i = 0; i < this._paramNames.length; i++) {
      params[this._paramNames[i]] = decodeURIComponent(result[i + 1]);
    }

    return { matched: true, params };
  }

  /**
   * Returns true if this route is a static (no params) route.
   * Used for precedence: static routes match before dynamic ones.
   */
  get isStatic() {
    return this._paramNames.length === 0;
  }
}

module.exports = { Route };
