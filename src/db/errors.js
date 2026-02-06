/**
 * Map PostgreSQL error codes to HTTP status codes.
 *
 * Common PG error codes:
 *   23505 - unique_violation
 *   23503 - foreign_key_violation
 *   23502 - not_null_violation
 *   23514 - check_violation
 *   42P01 - undefined_table
 *   42703 - undefined_column
 *   08000 - connection_exception
 *   08006 - connection_failure
 *
 * See: https://www.postgresql.org/docs/current/errcodes-appendix.html
 */

const PG_ERROR_MAP = {
  '23505': { status: 409, message: 'Resource already exists' },
  '23503': { status: 400, message: 'Referenced resource not found' },
  '23502': { status: 400, message: 'Missing required field' },
  '23514': { status: 400, message: 'Value violates constraint' },
  '42P01': { status: 500, message: 'Database table not found' },
  '42703': { status: 500, message: 'Database column not found' },
  '08000': { status: 503, message: 'Database connection error' },
  '08006': { status: 503, message: 'Database connection failed' },
};

/**
 * Convert a PostgreSQL error into a structured HTTP-friendly error.
 *
 * @param {Error} err - Error from pg driver
 * @returns {{ status: number, message: string, detail?: string }}
 */
function mapDbError(err) {
  const code = err.code;
  const mapped = PG_ERROR_MAP[code];

  if (mapped) {
    return {
      status: mapped.status,
      message: mapped.message,
      detail: err.detail || undefined,
    };
  }

  // Default to 500 for unknown database errors
  return {
    status: 500,
    message: 'Database error',
    detail: err.message,
  };
}

/**
 * Middleware-friendly helper: sends the appropriate error response.
 *
 * @param {object} res - HttpResponse instance
 * @param {Error} err - Error from pg driver
 */
function sendDbError(res, err) {
  const mapped = mapDbError(err);
  res.status(mapped.status).json({
    error: mapped.message,
    ...(mapped.detail && { detail: mapped.detail }),
  });
}

module.exports = { mapDbError, sendDbError, PG_ERROR_MAP };
