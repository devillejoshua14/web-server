const { query } = require('../query');

/**
 * User repository — CRUD operations for the users table.
 * All queries use parameterized values to prevent SQL injection.
 */

/**
 * Create a new user.
 * @param {{ email: string, name: string, password: string }} data
 * @returns {Promise<{ id: number, email: string, name: string, created_at: Date }>}
 */
async function createUser({ email, name, password }) {
  const { rows } = await query(
    `INSERT INTO users (email, name, password)
     VALUES ($1, $2, $3)
     RETURNING id, email, name, created_at`,
    [email, name, password]
  );
  return rows[0];
}

/**
 * Find a user by ID.
 * @param {number} id
 * @returns {Promise<object|null>}
 */
async function findById(id) {
  const { rows } = await query(
    'SELECT id, email, name, created_at, updated_at FROM users WHERE id = $1',
    [id]
  );
  return rows[0] || null;
}

/**
 * Find a user by email (includes password hash for auth).
 * @param {string} email
 * @returns {Promise<object|null>}
 */
async function findByEmail(email) {
  const { rows } = await query(
    'SELECT id, email, name, password, created_at, updated_at FROM users WHERE email = $1',
    [email]
  );
  return rows[0] || null;
}

/**
 * List all users (without passwords).
 * @param {{ limit?: number, offset?: number }} [options]
 * @returns {Promise<object[]>}
 */
async function findAll({ limit = 50, offset = 0 } = {}) {
  const { rows } = await query(
    'SELECT id, email, name, created_at, updated_at FROM users ORDER BY id LIMIT $1 OFFSET $2',
    [limit, offset]
  );
  return rows;
}

/**
 * Update a user by ID.
 * @param {number} id
 * @param {{ email?: string, name?: string, password?: string }} data
 * @returns {Promise<object|null>}
 */
async function updateUser(id, data) {
  const fields = [];
  const values = [];
  let paramIndex = 1;

  for (const [key, value] of Object.entries(data)) {
    if (['email', 'name', 'password'].includes(key) && value !== undefined) {
      fields.push(`${key} = $${paramIndex}`);
      values.push(value);
      paramIndex++;
    }
  }

  if (fields.length === 0) return findById(id);

  fields.push(`updated_at = NOW()`);
  values.push(id);

  const { rows } = await query(
    `UPDATE users SET ${fields.join(', ')} WHERE id = $${paramIndex}
     RETURNING id, email, name, created_at, updated_at`,
    values
  );
  return rows[0] || null;
}

/**
 * Delete a user by ID.
 * @param {number} id
 * @returns {Promise<boolean>} True if a row was deleted
 */
async function deleteUser(id) {
  const { rowCount } = await query('DELETE FROM users WHERE id = $1', [id]);
  return rowCount > 0;
}

module.exports = {
  createUser,
  findById,
  findByEmail,
  findAll,
  updateUser,
  deleteUser,
};
