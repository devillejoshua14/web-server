const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { Route } = require('../../src/router/route');
const { Router } = require('../../src/router/router');

describe('Route', () => {
  it('matches a static path', () => {
    const route = new Route('GET', '/users', () => {});
    const result = route.match('/users');
    assert.equal(result.matched, true);
    assert.deepStrictEqual(result.params, {});
  });

  it('does not match a different path', () => {
    const route = new Route('GET', '/users', () => {});
    assert.equal(route.match('/posts').matched, false);
  });

  it('extracts a single path parameter', () => {
    const route = new Route('GET', '/users/:id', () => {});
    const result = route.match('/users/42');
    assert.equal(result.matched, true);
    assert.deepStrictEqual(result.params, { id: '42' });
  });

  it('extracts multiple path parameters', () => {
    const route = new Route('GET', '/users/:userId/posts/:postId', () => {});
    const result = route.match('/users/5/posts/99');
    assert.equal(result.matched, true);
    assert.deepStrictEqual(result.params, { userId: '5', postId: '99' });
  });

  it('does not match partial paths', () => {
    const route = new Route('GET', '/users/:id', () => {});
    assert.equal(route.match('/users').matched, false);
    assert.equal(route.match('/users/1/extra').matched, false);
  });

  it('decodes URI-encoded path params', () => {
    const route = new Route('GET', '/files/:name', () => {});
    const result = route.match('/files/hello%20world');
    assert.equal(result.params.name, 'hello world');
  });

  it('identifies static vs dynamic routes', () => {
    const staticRoute = new Route('GET', '/users', () => {});
    const dynamicRoute = new Route('GET', '/users/:id', () => {});
    assert.equal(staticRoute.isStatic, true);
    assert.equal(dynamicRoute.isStatic, false);
  });
});

describe('Router', () => {
  it('resolves a simple GET route', () => {
    const router = new Router();
    const handler = () => {};
    router.get('/test', handler);

    const result = router.resolve('GET', '/test');
    assert.equal(result.status, 200);
    assert.equal(result.handler, handler);
  });

  it('returns 404 for unmatched path', () => {
    const router = new Router();
    router.get('/test', () => {});

    const result = router.resolve('GET', '/nonexistent');
    assert.equal(result.status, 404);
    assert.equal(result.handler, null);
  });

  it('returns 405 for wrong method on matched path', () => {
    const router = new Router();
    router.get('/test', () => {});
    router.post('/test', () => {});

    const result = router.resolve('DELETE', '/test');
    assert.equal(result.status, 405);
    assert.ok(result.allowedMethods.includes('GET'));
    assert.ok(result.allowedMethods.includes('POST'));
  });

  it('extracts path params on resolve', () => {
    const router = new Router();
    router.get('/users/:id', () => {});

    const result = router.resolve('GET', '/users/42');
    assert.equal(result.status, 200);
    assert.deepStrictEqual(result.params, { id: '42' });
  });

  it('prefers static routes over dynamic', () => {
    const router = new Router();
    const staticHandler = () => 'static';
    const dynamicHandler = () => 'dynamic';

    router.get('/users/:id', dynamicHandler);
    router.get('/users/me', staticHandler);

    const result = router.resolve('GET', '/users/me');
    assert.equal(result.status, 200);
    assert.equal(result.handler, staticHandler);
  });

  it('supports all HTTP methods', () => {
    const router = new Router();
    const methods = ['get', 'post', 'put', 'delete', 'patch', 'head', 'options'];

    for (const method of methods) {
      router[method](`/${method}`, () => method);
    }

    for (const method of methods) {
      const result = router.resolve(method.toUpperCase(), `/${method}`);
      assert.equal(result.status, 200);
    }
  });

  it('supports route-level middleware', () => {
    const router = new Router();
    const mw = () => {};
    const handler = () => {};
    router.get('/guarded', [mw], handler);

    const result = router.resolve('GET', '/guarded');
    assert.equal(result.status, 200);
    assert.equal(result.handler, handler);
    assert.equal(result.middleware.length, 1);
    assert.equal(result.middleware[0], mw);
  });

  it('returns empty middleware array when none specified', () => {
    const router = new Router();
    router.get('/open', () => {});

    const result = router.resolve('GET', '/open');
    assert.deepStrictEqual(result.middleware, []);
  });
});
