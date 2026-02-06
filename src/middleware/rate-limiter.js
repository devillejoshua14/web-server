/**
 * IP-based rate limiting middleware.
 *
 * @param {object} [options]
 * @param {number} [options.windowMs=60000] - Time window in milliseconds (default: 1 minute)
 * @param {number} [options.maxRequests=100] - Max requests per IP per window (default: 100)
 * @param {string} [options.message] - Custom error message
 * @returns {Function} Middleware function
 */
function rateLimiter(options = {}) {
  const {
    windowMs = 60 * 1000,
    maxRequests = 100,
    message = 'Too many requests, please try again later',
  } = options;

  // Map of IP -> { count, resetTime }
  const clients = new Map();

  // Periodically clean up expired entries
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [ip, entry] of clients) {
      if (now >= entry.resetTime) {
        clients.delete(ip);
      }
    }
  }, windowMs);

  // Allow the timer to not keep the process alive
  if (cleanupInterval.unref) {
    cleanupInterval.unref();
  }

  return function rateLimiterMiddleware(req, res, next) {
    const ip = req.headers['x-forwarded-for'] || req._socket?.remoteAddress || 'unknown';
    const now = Date.now();

    let entry = clients.get(ip);

    if (!entry || now >= entry.resetTime) {
      entry = { count: 0, resetTime: now + windowMs };
      clients.set(ip, entry);
    }

    entry.count++;

    // Set rate limit headers
    const remaining = Math.max(0, maxRequests - entry.count);
    res.setHeader('x-ratelimit-limit', String(maxRequests));
    res.setHeader('x-ratelimit-remaining', String(remaining));
    res.setHeader('x-ratelimit-reset', String(Math.ceil(entry.resetTime / 1000)));

    if (entry.count > maxRequests) {
      res.setHeader('retry-after', String(Math.ceil((entry.resetTime - now) / 1000)));
      return res.status(429).json({ error: message });
    }

    next();
  };
}

module.exports = { rateLimiter };
