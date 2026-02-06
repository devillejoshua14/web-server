const { Pool } = require('pg');

let pool = null;

/**
 * Initialize the connection pool.
 * Call once at startup before any queries.
 *
 * @param {object} [config] - pg Pool config overrides
 * @returns {Pool}
 */
function createPool(config = {}) {
  pool = new Pool({
    host: config.host || process.env.DB_HOST || 'localhost',
    port: parseInt(config.port || process.env.DB_PORT || '5432', 10),
    database: config.database || process.env.DB_NAME || 'webserver',
    user: config.user || process.env.DB_USER || 'postgres',
    password: config.password || process.env.DB_PASSWORD || '',
    max: config.max || 20,           // max connections in pool
    idleTimeoutMillis: config.idleTimeoutMillis || 30000,
    connectionTimeoutMillis: config.connectionTimeoutMillis || 5000,
  });

  pool.on('error', (err) => {
    console.error('Unexpected pool error:', err.message);
  });

  return pool;
}

/**
 * Get the current pool instance.
 * @returns {Pool}
 */
function getPool() {
  if (!pool) {
    throw new Error('Database pool not initialized. Call createPool() first.');
  }
  return pool;
}

/**
 * Close the pool and release all connections.
 * @returns {Promise<void>}
 */
async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

module.exports = { createPool, getPool, closePool };
