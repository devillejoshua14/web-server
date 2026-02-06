const fs = require('fs');
const path = require('path');
const { query } = require('./query');

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

/**
 * Run all pending SQL migrations in order.
 * Tracks applied migrations in a `_migrations` table.
 *
 * @returns {Promise<string[]>} List of migration filenames that were applied
 */
async function runMigrations() {
  // Ensure the migrations tracking table exists
  await query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id         SERIAL PRIMARY KEY,
      filename   VARCHAR(255) UNIQUE NOT NULL,
      applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `);

  // Get already-applied migrations
  const { rows: applied } = await query('SELECT filename FROM _migrations ORDER BY id');
  const appliedSet = new Set(applied.map((r) => r.filename));

  // Read migration files, sorted by name
  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const newlyApplied = [];

  for (const file of files) {
    if (appliedSet.has(file)) continue;

    const filePath = path.join(MIGRATIONS_DIR, file);
    const sql = fs.readFileSync(filePath, 'utf8');

    console.log(`Running migration: ${file}`);
    await query(sql);
    await query('INSERT INTO _migrations (filename) VALUES ($1)', [file]);
    newlyApplied.push(file);
  }

  if (newlyApplied.length === 0) {
    console.log('No new migrations to apply.');
  } else {
    console.log(`Applied ${newlyApplied.length} migration(s).`);
  }

  return newlyApplied;
}

// Allow running directly: node src/db/migrate.js
if (require.main === module) {
  require('dotenv').config();
  const { createPool } = require('./pool');
  createPool();

  runMigrations()
    .then(() => {
      console.log('Migrations complete.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Migration failed:', err.message);
      process.exit(1);
    });
}

module.exports = { runMigrations };
