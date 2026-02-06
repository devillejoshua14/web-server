const { STATUS_CODES, CRLF } = require('./constants');

class HttpResponse {
  constructor(socket) {
    this._socket = socket;
    this._statusCode = 200;
    this._headers = {};
    this._headersSent = false;
    this._body = null;
  }

  /**
   * Set the HTTP status code.
   * Returns `this` for chaining.
   */
  status(code) {
    this._statusCode = code;
    return this;
  }

  /**
   * Set a response header.
   * Returns `this` for chaining.
   */
  setHeader(name, value) {
    this._headers[name.toLowerCase()] = value;
    return this;
  }

  /**
   * Get a previously set response header.
   */
  getHeader(name) {
    return this._headers[name.toLowerCase()];
  }

  /**
   * Remove a response header.
   */
  removeHeader(name) {
    delete this._headers[name.toLowerCase()];
    return this;
  }

  /**
   * Send a JSON response. Sets Content-Type automatically.
   */
  json(data) {
    const body = JSON.stringify(data);
    this.setHeader('content-type', 'application/json; charset=utf-8');
    this.send(body);
  }

  /**
   * Send a plain text response.
   */
  text(data) {
    this.setHeader('content-type', 'text/plain; charset=utf-8');
    this.send(data);
  }

  /**
   * Send an HTML response.
   */
  html(data) {
    this.setHeader('content-type', 'text/html; charset=utf-8');
    this.send(data);
  }

  /**
   * Send the response with the given body.
   * Body can be a string or Buffer.
   */
  send(body) {
    if (this._headersSent) return;
    this._headersSent = true;

    let bodyBuffer;
    if (Buffer.isBuffer(body)) {
      bodyBuffer = body;
    } else if (typeof body === 'string') {
      bodyBuffer = Buffer.from(body, 'utf8');
    } else if (body == null) {
      bodyBuffer = Buffer.alloc(0);
    } else {
      bodyBuffer = Buffer.from(String(body), 'utf8');
    }

    // Set content-length if not already set
    if (!this._headers['content-length']) {
      this.setHeader('content-length', bodyBuffer.length);
    }

    // Set default content-type if not set
    if (!this._headers['content-type'] && bodyBuffer.length > 0) {
      this.setHeader('content-type', 'text/plain; charset=utf-8');
    }

    // Set date header
    if (!this._headers['date']) {
      this.setHeader('date', new Date().toUTCString());
    }

    const raw = this._serialize(bodyBuffer);
    this._socket.write(raw);
  }

  /**
   * Send a response with no body (e.g. 204 No Content).
   */
  sendStatus(code) {
    this._statusCode = code;
    const statusText = STATUS_CODES[code] || 'Unknown';
    this.setHeader('content-type', 'text/plain; charset=utf-8');
    this.send(statusText);
  }

  /**
   * Serialize the full HTTP response into a Buffer.
   */
  _serialize(bodyBuffer) {
    const statusText = STATUS_CODES[this._statusCode] || 'Unknown';
    const statusLine = `HTTP/1.1 ${this._statusCode} ${statusText}${CRLF}`;

    let headerString = '';
    for (const [name, value] of Object.entries(this._headers)) {
      headerString += `${name}: ${value}${CRLF}`;
    }

    const head = statusLine + headerString + CRLF;
    const headBuffer = Buffer.from(head, 'utf8');

    return Buffer.concat([headBuffer, bodyBuffer]);
  }
}

module.exports = { HttpResponse };
