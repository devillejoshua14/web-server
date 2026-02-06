const { verifyToken } = require('./jwt');

/**
 * Authentication middleware.
 * Verifies the JWT from the Authorization: Bearer <token> header.
 * On success, attaches the decoded payload to req.user.
 * On failure, responds with 401 Unauthorized.
 *
 * @param {object} [options]
 * @param {string} [options.secret] - JWT secret (defaults to env/config)
 * @returns {Function} Middleware function
 */
function authGuard(options = {}) {
  return function authMiddleware(req, res, next) {
    const authHeader = req.headers['authorization'] || '';

    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or malformed Authorization header' });
    }

    const token = authHeader.slice(7); // strip "Bearer "

    if (!token) {
      return res.status(401).json({ error: 'Token not provided' });
    }

    const result = verifyToken(token, options);

    if (!result.valid) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // Attach decoded user info to the request
    req.user = result.decoded;
    next();
  };
}

module.exports = { authGuard };
