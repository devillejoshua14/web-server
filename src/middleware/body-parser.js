/**
 * Body parser middleware.
 * Parses JSON and URL-encoded request bodies into req.parsedBody.
 */
function bodyParser() {
  return function bodyParserMiddleware(req, res, next) {
    const contentType = req.headers['content-type'] || '';

    // No body to parse
    if (!req.body || req.body.length === 0) {
      req.parsedBody = {};
      return next();
    }

    const raw = req.body.toString('utf8');

    if (contentType.includes('application/json')) {
      try {
        req.parsedBody = JSON.parse(raw);
      } catch (e) {
        return res.status(400).json({ error: 'Invalid JSON in request body' });
      }
    } else if (contentType.includes('application/x-www-form-urlencoded')) {
      req.parsedBody = parseUrlEncoded(raw);
    } else {
      // Store raw string for other content types
      req.parsedBody = raw;
    }

    next();
  };
}

/**
 * Parse a URL-encoded body string like "name=John&age=30"
 */
function parseUrlEncoded(str) {
  const result = {};
  if (!str) return result;

  const pairs = str.split('&');
  for (const pair of pairs) {
    const eqIndex = pair.indexOf('=');
    if (eqIndex === -1) {
      result[decodeURIComponent(pair)] = '';
    } else {
      const key = decodeURIComponent(pair.slice(0, eqIndex));
      const value = decodeURIComponent(pair.slice(eqIndex + 1).replace(/\+/g, ' '));
      result[key] = value;
    }
  }
  return result;
}

module.exports = { bodyParser };
