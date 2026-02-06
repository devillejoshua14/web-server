const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  parseRequest,
  parseRequestLine,
  parseQueryString,
  parseHeaders,
  decodeChunkedBody,
  HttpParseError,
} = require('../../src/http/request-parser');

describe('parseQueryString', () => {
  it('parses key=value pairs', () => {
    const result = parseQueryString('foo=bar&baz=qux');
    assert.deepStrictEqual(result, { foo: 'bar', baz: 'qux' });
  });

  it('handles empty string', () => {
    assert.deepStrictEqual(parseQueryString(''), {});
  });

  it('handles key without value', () => {
    assert.deepStrictEqual(parseQueryString('flag'), { flag: '' });
  });

  it('decodes URI components', () => {
    const result = parseQueryString('name=hello%20world&q=a%26b');
    assert.deepStrictEqual(result, { name: 'hello world', q: 'a&b' });
  });
});

describe('parseRequestLine', () => {
  it('parses a standard GET request line', () => {
    const result = parseRequestLine('GET /path HTTP/1.1');
    assert.equal(result.method, 'GET');
    assert.equal(result.path, '/path');
    assert.equal(result.httpVersion, 'HTTP/1.1');
    assert.deepStrictEqual(result.query, {});
  });

  it('parses request line with query string', () => {
    const result = parseRequestLine('GET /search?q=test&page=2 HTTP/1.1');
    assert.equal(result.path, '/search');
    assert.deepStrictEqual(result.query, { q: 'test', page: '2' });
    assert.equal(result.url, '/search?q=test&page=2');
  });

  it('throws on malformed request line', () => {
    assert.throws(() => parseRequestLine('INVALID'), HttpParseError);
  });

  it('throws on unsupported method', () => {
    assert.throws(() => parseRequestLine('FOO /path HTTP/1.1'), HttpParseError);
  });

  it('throws on bad HTTP version', () => {
    assert.throws(() => parseRequestLine('GET /path HTTPS/1.1'), HttpParseError);
  });
});

describe('parseHeaders', () => {
  it('parses standard headers', () => {
    const result = parseHeaders([
      'Host: localhost:3000',
      'Content-Type: application/json',
    ]);
    assert.equal(result['host'], 'localhost:3000');
    assert.equal(result['content-type'], 'application/json');
  });

  it('lowercases header names', () => {
    const result = parseHeaders(['X-Custom-Header: value']);
    assert.equal(result['x-custom-header'], 'value');
  });

  it('throws on malformed header', () => {
    assert.throws(() => parseHeaders(['no-colon-here']), HttpParseError);
  });

  it('handles headers with colons in value', () => {
    const result = parseHeaders(['Location: http://example.com:8080/path']);
    assert.equal(result['location'], 'http://example.com:8080/path');
  });
});

describe('decodeChunkedBody', () => {
  it('decodes a simple chunked body', () => {
    const raw = Buffer.from('5\r\nhello\r\n6\r\n world\r\n0\r\n\r\n');
    const result = decodeChunkedBody(raw);
    assert.equal(result.toString(), 'hello world');
  });

  it('decodes a single chunk', () => {
    const raw = Buffer.from('3\r\nabc\r\n0\r\n\r\n');
    const result = decodeChunkedBody(raw);
    assert.equal(result.toString(), 'abc');
  });

  it('throws on invalid chunk size', () => {
    const raw = Buffer.from('ZZ\r\ndata\r\n0\r\n\r\n');
    assert.throws(() => decodeChunkedBody(raw), HttpParseError);
  });
});

describe('parseRequest', () => {
  it('parses a complete GET request', () => {
    const raw = Buffer.from(
      'GET /hello HTTP/1.1\r\n' +
      'Host: localhost\r\n' +
      'Connection: close\r\n' +
      '\r\n'
    );
    const req = parseRequest(raw);
    assert.notEqual(req, null);
    assert.equal(req.method, 'GET');
    assert.equal(req.path, '/hello');
    assert.equal(req.headers['host'], 'localhost');
    assert.equal(req.headers['connection'], 'close');
    assert.equal(req.body.length, 0);
  });

  it('parses a POST request with JSON body', () => {
    const body = '{"name":"Alice"}';
    const raw = Buffer.from(
      'POST /users HTTP/1.1\r\n' +
      'Host: localhost\r\n' +
      'Content-Type: application/json\r\n' +
      `Content-Length: ${body.length}\r\n` +
      '\r\n' +
      body
    );
    const req = parseRequest(raw);
    assert.notEqual(req, null);
    assert.equal(req.method, 'POST');
    assert.equal(req.body.toString(), '{"name":"Alice"}');
  });

  it('returns null for incomplete headers', () => {
    const raw = Buffer.from('GET /hello HTTP/1.1\r\nHost: localhost\r\n');
    const req = parseRequest(raw);
    assert.equal(req, null);
  });

  it('returns null for incomplete body', () => {
    const raw = Buffer.from(
      'POST /data HTTP/1.1\r\n' +
      'Content-Length: 100\r\n' +
      '\r\n' +
      'partial'
    );
    const req = parseRequest(raw);
    assert.equal(req, null);
  });

  it('throws on malformed request', () => {
    const raw = Buffer.from('GARBAGE\r\n\r\n');
    assert.throws(() => parseRequest(raw), HttpParseError);
  });

  it('parses request with query parameters', () => {
    const raw = Buffer.from(
      'GET /search?q=hello&limit=10 HTTP/1.1\r\n' +
      'Host: localhost\r\n' +
      '\r\n'
    );
    const req = parseRequest(raw);
    assert.equal(req.path, '/search');
    assert.deepStrictEqual(req.query, { q: 'hello', limit: '10' });
  });

  it('parses chunked transfer-encoded body', () => {
    const raw = Buffer.from(
      'POST /data HTTP/1.1\r\n' +
      'Transfer-Encoding: chunked\r\n' +
      '\r\n' +
      '5\r\nhello\r\n0\r\n\r\n'
    );
    const req = parseRequest(raw);
    assert.notEqual(req, null);
    assert.equal(req.body.toString(), 'hello');
  });

  it('calculates _totalLength correctly for keep-alive pipelining', () => {
    const req1 = 'GET /first HTTP/1.1\r\nHost: localhost\r\n\r\n';
    const req2 = 'GET /second HTTP/1.1\r\nHost: localhost\r\n\r\n';
    const raw = Buffer.from(req1 + req2);

    const parsed = parseRequest(raw);
    assert.equal(parsed.path, '/first');
    assert.equal(parsed._totalLength, Buffer.byteLength(req1));

    // Parse the second request from remaining buffer
    const remaining = raw.slice(parsed._totalLength);
    const parsed2 = parseRequest(remaining);
    assert.equal(parsed2.path, '/second');
  });

  it('throws 413 on oversized payload', () => {
    const raw = Buffer.from(
      'POST /data HTTP/1.1\r\n' +
      'Content-Length: 99999999\r\n' +
      '\r\n'
    );
    try {
      parseRequest(raw);
      assert.fail('Should have thrown');
    } catch (err) {
      assert.equal(err.statusCode, 413);
    }
  });
});
