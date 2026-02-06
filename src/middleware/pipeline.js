/**
 * Middleware pipeline executor.
 *
 * Middleware functions have the signature:
 *   (req, res, next) => { ... }
 *
 * Error-handling middleware has the signature:
 *   (err, req, res, next) => { ... }
 *
 * Calling next() advances to the next middleware.
 * Calling next(err) skips to the next error-handling middleware.
 */
class Pipeline {
  constructor() {
    this._middleware = [];
  }

  /**
   * Add middleware to the pipeline.
   * @param {Function} fn - Middleware function (req, res, next) or error handler (err, req, res, next)
   */
  use(fn) {
    if (typeof fn !== 'function') {
      throw new TypeError('Middleware must be a function');
    }
    this._middleware.push(fn);
    return this;
  }

  /**
   * Execute the pipeline for a given request/response.
   * After all middleware run, calls finalHandler(req, res).
   *
   * @param {object} req - Parsed HTTP request
   * @param {object} res - HttpResponse instance
   * @param {Function} finalHandler - Called after all middleware if no response sent
   */
  /**
   * Run only the error-handling middleware in the pipeline.
   * Used when a route handler throws after the normal pipeline has completed.
   */
  handleError(err, req, res) {
    const errorHandlers = this._middleware.filter((fn) => fn.length === 4);
    let index = 0;

    function next(e) {
      if (res._headersSent) return;
      const currentErr = e || err;
      if (index >= errorHandlers.length) {
        // No error handler caught it — send default 500
        if (!res._headersSent) {
          res.status(500).json({ error: currentErr.message || 'Internal Server Error' });
        }
        return;
      }
      const fn = errorHandlers[index++];
      try {
        fn(currentErr, req, res, next);
      } catch (thrown) {
        next(thrown);
      }
    }

    next(err);
  }

  execute(req, res, finalHandler) {
    const stack = this._middleware;
    let index = 0;

    function next(err) {
      // Prevent calling next after response is sent
      if (res._headersSent) return;

      // Walk the stack looking for the right type of handler
      while (index < stack.length) {
        const fn = stack[index++];
        const isErrorHandler = fn.length === 4;

        if (err) {
          // We have an error — skip normal middleware, run error handlers
          if (isErrorHandler) {
            try {
              fn(err, req, res, next);
            } catch (e) {
              next(e);
            }
            return;
          }
          // Skip normal middleware when in error state
          continue;
        } else {
          // No error — skip error handlers, run normal middleware
          if (isErrorHandler) continue;
          try {
            fn(req, res, next);
          } catch (e) {
            next(e);
          }
          return;
        }
      }

      // Reached end of stack
      if (err) {
        // Unhandled error — send 500
        if (!res._headersSent) {
          res.status(500).json({ error: err.message || 'Internal Server Error' });
        }
      } else if (finalHandler) {
        // No middleware handled the request — call the final handler
        try {
          finalHandler(req, res);
        } catch (e) {
          if (!res._headersSent) {
            res.status(500).json({ error: e.message || 'Internal Server Error' });
          }
        }
      }
    }

    next();
  }
}

/**
 * Run an array of middleware functions in sequence, then call done().
 * Used for route-level middleware before the route handler.
 */
function runMiddlewareStack(middlewares, req, res, done) {
  let index = 0;

  function next(err) {
    if (err) return done(err);
    if (res._headersSent) return;
    if (index >= middlewares.length) return done();

    const fn = middlewares[index++];
    try {
      fn(req, res, next);
    } catch (e) {
      done(e);
    }
  }

  next();
}

module.exports = { Pipeline, runMiddlewareStack };
