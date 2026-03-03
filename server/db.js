const { Pool } = require('pg');

// PostgreSQL connection - Fly.io sets DATABASE_URL automatically
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// Log connection events
pool.on('error', (err) => {
  console.error('PostgreSQL pool error:', err);
});

/**
 * Execute a query that modifies data (INSERT, UPDATE, DELETE)
 * Returns { lastID, changes } for compatibility with old SQLite interface
 */
async function run(sql, params = []) {
  const { pgSql, pgParams } = convertPlaceholders(sql, params);
  const result = await pool.query(pgSql, pgParams);
  return {
    lastID: result.rows && result.rows[0] ? result.rows[0].id : null,
    changes: result.rowCount,
  };
}

/**
 * Get a single row
 */
async function get(sql, params = []) {
  const { pgSql, pgParams } = convertPlaceholders(sql, params);
  const result = await pool.query(pgSql, pgParams);
  return result.rows[0] || null;
}

/**
 * Get all rows
 */
async function all(sql, params = []) {
  const { pgSql, pgParams } = convertPlaceholders(sql, params);
  const result = await pool.query(pgSql, pgParams);
  return result.rows;
}

/**
 * Close the pool
 */
async function close() {
  await pool.end();
  console.log('PostgreSQL pool closed');
}

/**
 * Convert SQLite-style ? placeholders to PostgreSQL $1, $2...
 */
function convertPlaceholders(sql, params) {
  let idx = 0;
  const pgSql = sql.replace(/\?/g, () => `$${++idx}`);
  return { pgSql, pgParams: params };
}

/**
 * Initialize database tables (PostgreSQL syntax)
 */
async function init() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // users
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // tasks
    await client.query(`
      CREATE TABLE IF NOT EXISTS tasks (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        text TEXT NOT NULL,
        completed INTEGER DEFAULT 0,
        priority VARCHAR(20) DEFAULT 'low',
        category VARCHAR(60) DEFAULT '',
        due_date DATE,
        notes TEXT DEFAULT '',
        sort_order INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Safe migration: add new columns if missing
    await client.query(`
      DO $$ BEGIN
        ALTER TABLE tasks ADD COLUMN IF NOT EXISTS category VARCHAR(60) DEFAULT '';
      EXCEPTION WHEN OTHERS THEN NULL;
      END $$;
    `);
    await client.query(`
      DO $$ BEGIN
        ALTER TABLE tasks ADD COLUMN IF NOT EXISTS due_date DATE;
      EXCEPTION WHEN OTHERS THEN NULL;
      END $$;
    `);
    await client.query(`
      DO $$ BEGIN
        ALTER TABLE tasks ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT '';
      EXCEPTION WHEN OTHERS THEN NULL;
      END $$;
    `);
    await client.query(`
      DO $$ BEGIN
        ALTER TABLE tasks ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;
      EXCEPTION WHEN OTHERS THEN NULL;
      END $$;
    `);

    // thoughts
    await client.query(`
      CREATE TABLE IF NOT EXISTS thoughts (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        text TEXT NOT NULL,
        mood VARCHAR(50),
        date TIMESTAMPTZ DEFAULT NOW(),
        tags TEXT
      );
    `);

    // finances
    await client.query(`
      CREATE TABLE IF NOT EXISTS finances (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type VARCHAR(20) NOT NULL,
        amount DECIMAL(12,2) NOT NULL,
        category VARCHAR(100),
        description TEXT,
        payment_method VARCHAR(30) DEFAULT '',
        date TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Safe migration: add payment_method if missing
    await client.query(`
      DO $$ BEGIN
        ALTER TABLE finances ADD COLUMN IF NOT EXISTS payment_method VARCHAR(30) DEFAULT '';
      EXCEPTION WHEN OTHERS THEN NULL;
      END $$;
    `);

    // gratitude
    await client.query(`
      CREATE TABLE IF NOT EXISTS gratitude (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        text TEXT NOT NULL,
        date TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // purpose (one row per user)
    await client.query(`
      CREATE TABLE IF NOT EXISTS purpose (
        id SERIAL PRIMARY KEY,
        user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        mission TEXT DEFAULT '',
        goals TEXT DEFAULT '',
        "values" TEXT DEFAULT '',
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Indexes
    await client.query('CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_thoughts_user_id ON thoughts(user_id);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_finances_user_id ON finances(user_id);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_gratitude_user_id ON gratitude(user_id);');

    await client.query('COMMIT');
    console.log('PostgreSQL database initialized with tables and indexes');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { pool, run, get, all, init, close };
