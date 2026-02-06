const { query } = require('../query');

/**
 * Post repository — CRUD operations for the posts table.
 * All queries use parameterized values to prevent SQL injection.
 */

/**
 * Create a new post.
 * @param {{ title: string, content: string, user_id: number }} data
 * @returns {Promise<object>}
 */
async function createPost({ title, content, user_id }) {
  const { rows } = await query(
    `INSERT INTO posts (title, content, user_id)
     VALUES ($1, $2, $3)
     RETURNING id, title, content, user_id, created_at`,
    [title, content, user_id]
  );
  return rows[0];
}

/**
 * Find a post by ID.
 * @param {number} id
 * @returns {Promise<object|null>}
 */
async function findById(id) {
  const { rows } = await query(
    `SELECT p.id, p.title, p.content, p.user_id, p.created_at, p.updated_at,
            u.name AS author_name, u.email AS author_email
     FROM posts p
     JOIN users u ON u.id = p.user_id
     WHERE p.id = $1`,
    [id]
  );
  return rows[0] || null;
}

/**
 * List all posts with optional filtering by user.
 * @param {{ userId?: number, limit?: number, offset?: number }} [options]
 * @returns {Promise<object[]>}
 */
async function findAll({ userId, limit = 50, offset = 0 } = {}) {
  if (userId) {
    const { rows } = await query(
      `SELECT p.id, p.title, p.content, p.user_id, p.created_at, p.updated_at,
              u.name AS author_name
       FROM posts p
       JOIN users u ON u.id = p.user_id
       WHERE p.user_id = $1
       ORDER BY p.created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );
    return rows;
  }

  const { rows } = await query(
    `SELECT p.id, p.title, p.content, p.user_id, p.created_at, p.updated_at,
            u.name AS author_name
     FROM posts p
     JOIN users u ON u.id = p.user_id
     ORDER BY p.created_at DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  return rows;
}

/**
 * Update a post by ID.
 * @param {number} id
 * @param {{ title?: string, content?: string }} data
 * @returns {Promise<object|null>}
 */
async function updatePost(id, data) {
  const fields = [];
  const values = [];
  let paramIndex = 1;

  for (const [key, value] of Object.entries(data)) {
    if (['title', 'content'].includes(key) && value !== undefined) {
      fields.push(`${key} = $${paramIndex}`);
      values.push(value);
      paramIndex++;
    }
  }

  if (fields.length === 0) return findById(id);

  fields.push(`updated_at = NOW()`);
  values.push(id);

  const { rows } = await query(
    `UPDATE posts SET ${fields.join(', ')} WHERE id = $${paramIndex}
     RETURNING id, title, content, user_id, created_at, updated_at`,
    values
  );
  return rows[0] || null;
}

/**
 * Delete a post by ID.
 * @param {number} id
 * @returns {Promise<boolean>} True if a row was deleted
 */
async function deletePost(id) {
  const { rowCount } = await query('DELETE FROM posts WHERE id = $1', [id]);
  return rowCount > 0;
}

module.exports = {
  createPost,
  findById,
  findAll,
  updatePost,
  deletePost,
};
