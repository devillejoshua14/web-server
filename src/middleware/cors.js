/**
 * CORS (Cross-Origin Resource Sharing) middleware.
 *
 * @param {object} [options]
 * @param {string|string[]} [options.origin='*'] - Allowed origins
 * @param {string[]} [options.methods] - Allowed HTTP methods
 * @param {string[]} [options.allowedHeaders] - Allowed request headers
 * @param {string[]} [options.exposedHeaders] - Headers exposed to the browser
 * @param {boolean} [options.credentials=false] - Allow credentials
 * @param {number} [options.maxAge=86400] - Preflight cache duration in seconds
 */
function cors(options = {}) {
  const {
    origin = '*',
    methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders = ['Content-Type', 'Authorization'],
    exposedHeaders = [],
    credentials = false,
    maxAge = 86400,
  } = options;

  return function corsMiddleware(req, res, next) {
    // Determine the origin to reflect
    const requestOrigin = req.headers['origin'];
    let allowOrigin;

    if (Array.isArray(origin)) {
      allowOrigin = origin.includes(requestOrigin) ? requestOrigin : '';
    } else {
      allowOrigin = origin;
    }

    res.setHeader('access-control-allow-origin', allowOrigin);
    res.setHeader('access-control-allow-methods', methods.join(', '));
    res.setHeader('access-control-allow-headers', allowedHeaders.join(', '));

    if (exposedHeaders.length > 0) {
      res.setHeader('access-control-expose-headers', exposedHeaders.join(', '));
    }

    if (credentials) {
      res.setHeader('access-control-allow-credentials', 'true');
    }

    res.setHeader('access-control-max-age', String(maxAge));

    // Handle preflight OPTIONS requests
    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }

    next();
  };
}

module.exports = { cors };
