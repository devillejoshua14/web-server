const { HTTP_METHODS, MAX_HEADER_SIZE, MAX_BODY_SIZE, CRLF } = require('./constants');

class HttpParseError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = 'HttpParseError';
    this.statusCode = statusCode;
  }
}

/**
 * Parse the HTTP request line (e.g. "GET /path?q=1 HTTP/1.1")
 * Returns { method, url, path, query, httpVersion }
 */
function parseRequestLine(line) {
  const parts = line.split(' ');
  if (parts.length !== 3) {
    throw new HttpParseError('Malformed request line');
  }

  const [method, rawUrl, httpVersion] = parts;

  if (!HTTP_METHODS[method]) {
    throw new HttpParseError(`Unsupported HTTP method: ${method}`);
  }

  if (!httpVersion.startsWith('HTTP/')) {
    throw new HttpParseError('Malformed HTTP version');
  }

  // Split URL into path and query string
  const questionIndex = rawUrl.indexOf('?');
  let path, queryString;
  if (questionIndex !== -1) {
    path = rawUrl.slice(0, questionIndex);
    queryString = rawUrl.slice(questionIndex + 1);
  } else {
    path = rawUrl;
    queryString = '';
  }

  const query = parseQueryString(queryString);

  return { method, url: rawUrl, path, query, httpVersion };
}

/**
 * Parse a query string like "key=value&foo=bar" into { key: 'value', foo: 'bar' }
 */
function parseQueryString(qs) {
  const result = {};
  if (!qs) return result;

  const pairs = qs.split('&');
  for (const pair of pairs) {
    const eqIndex = pair.indexOf('=');
    if (eqIndex === -1) {
      result[decodeURIComponent(pair)] = '';
    } else {
      const key = decodeURIComponent(pair.slice(0, eqIndex));
      const value = decodeURIComponent(pair.slice(eqIndex + 1));
      result[key] = value;
    }
  }
  return result;
}

/**
 * Parse raw header lines into an object.
 * Header names are lowercased for consistent access.
 */
function parseHeaders(headerLines) {
  const headers = {};
  for (const line of headerLines) {
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) {
      throw new HttpParseError('Malformed header line');
    }
    const name = line.slice(0, colonIndex).trim().toLowerCase();
    const value = line.slice(colonIndex + 1).trim();
    headers[name] = value;
  }
  return headers;
}

/**
 * Decode a chunked transfer-encoded body.
 * Format: <chunk-size-hex>\r\n<chunk-data>\r\n ... 0\r\n\r\n
 */
function decodeChunkedBody(raw) {
  const chunks = [];
  let offset = 0;

  while (offset < raw.length) {
    // Find the end of the chunk size line
    const lineEnd = raw.indexOf(CRLF, offset);
    if (lineEnd === -1) break;

    const sizeHex = raw.slice(offset, lineEnd).toString('utf8').trim();
    const chunkSize = parseInt(sizeHex, 16);

    if (isNaN(chunkSize)) {
      throw new HttpParseError('Invalid chunk size');
    }

    // Size 0 means end of chunks
    if (chunkSize === 0) break;

    const dataStart = lineEnd + 2; // skip CRLF
    const dataEnd = dataStart + chunkSize;

    if (dataEnd > raw.length) {
      throw new HttpParseError('Incomplete chunk data');
    }

    chunks.push(raw.slice(dataStart, dataEnd));
    offset = dataEnd + 2; // skip trailing CRLF after chunk data
  }

  return Buffer.concat(chunks);
}

/**
 * Parse a complete HTTP request from a raw buffer.
 * Returns a request object: { method, url, path, query, httpVersion, headers, body }
 */
function parseRequest(buffer) {
  const headerEndMarker = `${CRLF}${CRLF}`;
  const headerEndIndex = buffer.indexOf(headerEndMarker);

  if (headerEndIndex === -1) {
    // Headers not fully received yet
    return null;
  }

  if (headerEndIndex > MAX_HEADER_SIZE) {
    throw new HttpParseError('Headers too large', 413);
  }

  const headerSection = buffer.slice(0, headerEndIndex).toString('utf8');
  const lines = headerSection.split(CRLF);

  if (lines.length === 0) {
    throw new HttpParseError('Empty request');
  }

  // Parse the request line
  const { method, url, path, query, httpVersion } = parseRequestLine(lines[0]);

  // Parse headers
  const headers = parseHeaders(lines.slice(1));

  // Determine body boundaries
  const bodyStart = headerEndIndex + headerEndMarker.length;
  let body = Buffer.alloc(0);

  const isChunked = (headers['transfer-encoding'] || '').toLowerCase() === 'chunked';
  const contentLength = parseInt(headers['content-length'], 10) || 0;

  if (isChunked) {
    const rawBody = buffer.slice(bodyStart);
    // Check if we have the terminator (0\r\n\r\n)
    if (rawBody.indexOf('0\r\n\r\n') === -1) {
      return null; // not fully received yet
    }
    body = decodeChunkedBody(rawBody);
  } else if (contentLength > 0) {
    if (contentLength > MAX_BODY_SIZE) {
      throw new HttpParseError('Payload too large', 413);
    }
    if (buffer.length < bodyStart + contentLength) {
      return null; // body not fully received yet
    }
    body = buffer.slice(bodyStart, bodyStart + contentLength);
  }

  // Total bytes consumed for this request
  let totalLength;
  if (isChunked) {
    const rawBody = buffer.slice(bodyStart);
    const terminatorIndex = rawBody.indexOf('0\r\n\r\n');
    totalLength = bodyStart + terminatorIndex + 5; // 5 = "0\r\n\r\n".length
  } else {
    totalLength = bodyStart + contentLength;
  }

  return {
    method,
    url,
    path,
    query,
    httpVersion,
    headers,
    body,
    _totalLength: totalLength, // used internally for keep-alive pipelining
  };
}

module.exports = {
  parseRequest,
  parseRequestLine,
  parseQueryString,
  parseHeaders,
  decodeChunkedBody,
  HttpParseError,
};
