const HTTP_METHODS = {
  GET: 'GET',
  POST: 'POST',
  PUT: 'PUT',
  DELETE: 'DELETE',
  PATCH: 'PATCH',
  HEAD: 'HEAD',
  OPTIONS: 'OPTIONS',
};

const STATUS_CODES = {
  200: 'OK',
  201: 'Created',
  204: 'No Content',
  301: 'Moved Permanently',
  302: 'Found',
  304: 'Not Modified',
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  405: 'Method Not Allowed',
  408: 'Request Timeout',
  413: 'Payload Too Large',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
  502: 'Bad Gateway',
  503: 'Service Unavailable',
};

const MAX_HEADER_SIZE = 8 * 1024;       // 8 KB
const MAX_BODY_SIZE = 1 * 1024 * 1024;  // 1 MB
const CRLF = '\r\n';

module.exports = {
  HTTP_METHODS,
  STATUS_CODES,
  MAX_HEADER_SIZE,
  MAX_BODY_SIZE,
  CRLF,
};
