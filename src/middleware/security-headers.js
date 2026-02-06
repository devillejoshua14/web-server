/**
 * Security headers middleware.
 * Adds common security headers to every response.
 *
 * @param {object} [options]
 * @param {boolean} [options.hsts=true] - Add Strict-Transport-Security
 * @param {number} [options.hstsMaxAge=31536000] - HSTS max-age in seconds (default: 1 year)
 * @returns {Function} Middleware function
 */
function securityHeaders(options = {}) {
  const { hsts = true, hstsMaxAge = 31536000 } = options;

  return function securityHeadersMiddleware(req, res, next) {
    // Prevent MIME type sniffing
    res.setHeader('x-content-type-options', 'nosniff');

    // Prevent clickjacking
    res.setHeader('x-frame-options', 'DENY');

    // XSS protection (legacy, but still useful for older browsers)
    res.setHeader('x-xss-protection', '1; mode=block');

    // Referrer policy
    res.setHeader('referrer-policy', 'strict-origin-when-cross-origin');

    // Permissions policy (restrict browser features)
    res.setHeader('permissions-policy', 'camera=(), microphone=(), geolocation=()');

    // HSTS - only use HTTPS
    if (hsts) {
      res.setHeader('strict-transport-security', `max-age=${hstsMaxAge}; includeSubDomains`);
    }

    next();
  };
}

module.exports = { securityHeaders };
