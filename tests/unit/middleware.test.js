const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { Pipeline, runMiddlewareStack } = require('../../src/middleware/pipeline');

// Helper to create a mock response object
function mockRes() {
  return {
    _headersSent: false,
    _statusCode: 200,
    _body: null,
    _headers: {},
    status(code) { this._statusCode = code; return this; },
    json(data) { this._body = data; this._headersSent = true; },
    setHeader(k, v) { this._headers[k] = v; },
  };
}

describe('Pipeline', () => {
  it('executes middleware in order', () => {
    const pipeline = new Pipeline();
    const order = [];

    pipeline.use((req, res, next) => { order.push(1); next(); });
    pipeline.use((req, res, next) => { order.push(2); next(); });
    pipeline.use((req, res, next) => { order.push(3); next(); });

    const res = mockRes();
    pipeline.execute({}, res, () => { order.push('final'); });

    assert.deepStrictEqual(order, [1, 2, 3, 'final']);
  });

  it('stops chain when response is sent', () => {
    const pipeline = new Pipeline();
    const order = [];

    pipeline.use((req, res, next) => { order.push(1); next(); });
    pipeline.use((req, res, next) => {
      order.push(2);
      res.status(200).json({ done: true });
    });
    pipeline.use((req, res, next) => { order.push(3); next(); });

    const res = mockRes();
    pipeline.execute({}, res, () => { order.push('final'); });

    assert.deepStrictEqual(order, [1, 2]);
    assert.deepStrictEqual(res._body, { done: true });
  });

  it('routes errors to error middleware', () => {
    const pipeline = new Pipeline();
    const order = [];

    pipeline.use((req, res, next) => { order.push('normal-1'); next(); });
    pipeline.use((req, res, next) => { next(new Error('oops')); });
    pipeline.use((req, res, next) => { order.push('normal-2-skipped'); next(); });
    pipeline.use((err, req, res, next) => {
      order.push('error-handler');
      res.status(500).json({ error: err.message });
    });

    const res = mockRes();
    pipeline.execute({}, res, () => {});

    assert.deepStrictEqual(order, ['normal-1', 'error-handler']);
    assert.equal(res._statusCode, 500);
    assert.deepStrictEqual(res._body, { error: 'oops' });
  });

  it('catches thrown errors and routes to error middleware', () => {
    const pipeline = new Pipeline();

    pipeline.use((req, res, next) => { throw new Error('thrown'); });
    pipeline.use((err, req, res, next) => {
      res.status(500).json({ error: err.message });
    });

    const res = mockRes();
    pipeline.execute({}, res, () => {});

    assert.equal(res._statusCode, 500);
    assert.deepStrictEqual(res._body, { error: 'thrown' });
  });

  it('sends default 500 if no error handler catches', () => {
    const pipeline = new Pipeline();

    pipeline.use((req, res, next) => { next(new Error('unhandled')); });

    const res = mockRes();
    pipeline.execute({}, res, () => {});

    assert.equal(res._statusCode, 500);
    assert.deepStrictEqual(res._body, { error: 'unhandled' });
  });

  it('skips error handlers during normal flow', () => {
    const pipeline = new Pipeline();
    const order = [];

    pipeline.use((req, res, next) => { order.push('normal'); next(); });
    pipeline.use((err, req, res, next) => { order.push('error-skipped'); next(); });

    const res = mockRes();
    pipeline.execute({}, res, () => { order.push('final'); });

    assert.deepStrictEqual(order, ['normal', 'final']);
  });

  it('handleError runs error handlers after route dispatch', () => {
    const pipeline = new Pipeline();

    pipeline.use((req, res, next) => { next(); }); // normal mw
    pipeline.use((err, req, res, next) => {
      res.status(500).json({ caught: err.message });
    });

    const res = mockRes();
    pipeline.handleError(new Error('post-route'), {}, res);

    assert.equal(res._statusCode, 500);
    assert.deepStrictEqual(res._body, { caught: 'post-route' });
  });

  it('throws on non-function middleware', () => {
    const pipeline = new Pipeline();
    assert.throws(() => pipeline.use('not a function'), TypeError);
  });
});

describe('runMiddlewareStack', () => {
  it('runs middleware array in order then calls done', () => {
    const order = [];
    const mw1 = (req, res, next) => { order.push(1); next(); };
    const mw2 = (req, res, next) => { order.push(2); next(); };

    const res = mockRes();
    let doneCalled = false;
    runMiddlewareStack([mw1, mw2], {}, res, () => { doneCalled = true; });

    assert.deepStrictEqual(order, [1, 2]);
    assert.equal(doneCalled, true);
  });

  it('passes error to done callback if middleware throws', () => {
    const mw = (req, res, next) => { throw new Error('mw-error'); };

    const res = mockRes();
    let capturedErr = null;
    runMiddlewareStack([mw], {}, res, (err) => { capturedErr = err; });

    assert.equal(capturedErr.message, 'mw-error');
  });

  it('passes error to done callback if next(err) called', () => {
    const mw = (req, res, next) => { next(new Error('next-error')); };

    const res = mockRes();
    let capturedErr = null;
    runMiddlewareStack([mw], {}, res, (err) => { capturedErr = err; });

    assert.equal(capturedErr.message, 'next-error');
  });
});
