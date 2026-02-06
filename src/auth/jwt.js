const jwt = require('jsonwebtoken');

const DEFAULT_SECRET = 'change-me-in-production';
const DEFAULT_EXPIRES_IN = '1h';

/**
 * Sign a JWT with the given payload.
 *
 * @param {object} payload - Data to encode (e.g. { userId, email })
 * @param {object} [options]
 * @param {string} [options.secret] - Signing secret
 * @param {string|number} [options.expiresIn] - Expiration (e.g. '1h', 3600)
 * @returns {string} Signed JWT token
 */
function signToken(payload, options = {}) {
  const secret = options.secret || process.env.JWT_SECRET || DEFAULT_SECRET;
  const expiresIn = options.expiresIn || process.env.JWT_EXPIRES_IN || DEFAULT_EXPIRES_IN;

  return jwt.sign(payload, secret, { expiresIn });
}

/**
 * Verify and decode a JWT.
 *
 * @param {string} token - The JWT to verify
 * @param {object} [options]
 * @param {string} [options.secret] - Signing secret
 * @returns {{ valid: true, decoded: object } | { valid: false, error: string }}
 */
function verifyToken(token, options = {}) {
  const secret = options.secret || process.env.JWT_SECRET || DEFAULT_SECRET;

  try {
    const decoded = jwt.verify(token, secret);
    return { valid: true, decoded };
  } catch (err) {
    return { valid: false, error: err.message };
  }
}

module.exports = { signToken, verifyToken };
