/**
 * Request logging middleware.
 * Logs: method, URL, status code, and response time in ms.
 */
function logger() {
  return function loggerMiddleware(req, res, next) {
    const start = Date.now();

    // Intercept the send method to capture status code and timing
    const originalSend = res.send.bind(res);
    res.send = function (body) {
      const duration = Date.now() - start;
      const timestamp = new Date().toISOString();
      console.log(
        `[${timestamp}] ${req.method} ${req.url} ${res._statusCode} - ${duration}ms`
      );
      return originalSend(body);
    };

    next();
  };
}

module.exports = { logger };
