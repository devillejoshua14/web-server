const bcrypt = require('bcrypt');

const SALT_ROUNDS = 10;

/**
 * Hash a plain-text password using bcrypt.
 *
 * @param {string} password - Plain-text password
 * @returns {Promise<string>} Hashed password
 */
async function hashPassword(password) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Compare a plain-text password against a bcrypt hash.
 *
 * @param {string} password - Plain-text password
 * @param {string} hash - Bcrypt hash to compare against
 * @returns {Promise<boolean>} True if the password matches
 */
async function comparePassword(password, hash) {
  return bcrypt.compare(password, hash);
}

module.exports = { hashPassword, comparePassword };
