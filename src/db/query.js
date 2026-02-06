const { getPool } = require('./pool');

/**
 * Execute a parameterized SQL query.
 * All values are passed as parameters to prevent SQL injection.
 *
 * @param {string} text - SQL query with $1, $2, ... placeholders
 * @param {any[]} [params] - Parameter values
 * @returns {Promise<import('pg').QueryResult>}
 *
 * @example
 *   const result = await query('SELECT * FROM users WHERE id = $1', [userId]);
 *   console.log(result.rows);
 */
async function query(text, params = []) {
  const pool = getPool();
  return pool.query(text, params);
}

/**
 * Get a client from the pool for manual transaction control.
 * IMPORTANT: Always release the client when done.
 *
 * @returns {Promise<import('pg').PoolClient>}
 */
async function getClient() {
  const pool = getPool();
  return pool.connect();
}

/**
 * Execute multiple queries inside a transaction.
 * Automatically handles BEGIN, COMMIT, and ROLLBACK.
 *
 * @param {Function} fn - async function(client) that runs queries on the client
 * @returns {Promise<any>} The return value of fn
 *
 * @example
 *   const result = await transaction(async (client) => {
 *     await client.query('INSERT INTO users (name) VALUES ($1)', ['Alice']);
 *     await client.query('INSERT INTO posts (title) VALUES ($1)', ['Hello']);
 *     return { success: true };
 *   });
 */
async function transaction(fn) {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { query, getClient, transaction };
