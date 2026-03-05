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
        due_time VARCHAR(5) DEFAULT '',
        reminder_at TIMESTAMPTZ,
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
        ALTER TABLE tasks ADD COLUMN IF NOT EXISTS due_time VARCHAR(5) DEFAULT '';
      EXCEPTION WHEN OTHERS THEN NULL;
      END $$;
    `);
    await client.query(`
      DO $$ BEGIN
        ALTER TABLE tasks ADD COLUMN IF NOT EXISTS reminder_at TIMESTAMPTZ;
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
    await client.query(`
      DO $$ BEGIN
        ALTER TABLE tasks ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'todo';
      EXCEPTION WHEN OTHERS THEN NULL;
      END $$;
    `);
    await client.query(`
      DO $$ BEGIN
        ALTER TABLE tasks ADD COLUMN IF NOT EXISTS subtasks TEXT DEFAULT '[]';
      EXCEPTION WHEN OTHERS THEN NULL;
      END $$;
    `);
    await client.query(`
      DO $$ BEGIN
        ALTER TABLE tasks ADD COLUMN IF NOT EXISTS tags TEXT DEFAULT '';
      EXCEPTION WHEN OTHERS THEN NULL;
      END $$;
    `);
    await client.query(`
      DO $$ BEGIN
        ALTER TABLE tasks ADD COLUMN IF NOT EXISTS estimated_minutes INTEGER DEFAULT 0;
      EXCEPTION WHEN OTHERS THEN NULL;
      END $$;
    `);
    await client.query(`
      DO $$ BEGIN
        ALTER TABLE tasks ADD COLUMN IF NOT EXISTS recurrence VARCHAR(20) DEFAULT '';
      EXCEPTION WHEN OTHERS THEN NULL;
      END $$;
    `);
    await client.query(`
      DO $$ BEGIN
        ALTER TABLE tasks ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
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

    // ===== MIGRATION: completed INTEGER -> BOOLEAN =====
    await client.query(`
      DO $$ BEGIN
        ALTER TABLE tasks ALTER COLUMN completed SET DEFAULT false;
        ALTER TABLE tasks ALTER COLUMN completed TYPE BOOLEAN USING completed::int::boolean;
      EXCEPTION WHEN OTHERS THEN NULL;
      END $$;
    `);

    // ===== NEW TABLE: task_subtasks (replaces JSON column) =====
    await client.query(`
      CREATE TABLE IF NOT EXISTS task_subtasks (
        id SERIAL PRIMARY KEY,
        task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        text TEXT NOT NULL,
        completed BOOLEAN DEFAULT false,
        sort_order INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    await client.query('CREATE INDEX IF NOT EXISTS idx_task_subtasks_task_id ON task_subtasks(task_id);');

    // ===== NEW TABLE: accounts =====
    await client.query(`
      CREATE TABLE IF NOT EXISTS accounts (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(100) NOT NULL,
        type VARCHAR(30) DEFAULT 'checking',
        balance DECIMAL(14,2) DEFAULT 0,
        icon VARCHAR(30) DEFAULT 'fa-university',
        color VARCHAR(10) DEFAULT '#3B82F6',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    await client.query('CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts(user_id);');

    // Add account_id to finances
    await client.query(`
      DO $$ BEGIN
        ALTER TABLE finances ADD COLUMN IF NOT EXISTS account_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL;
      EXCEPTION WHEN OTHERS THEN NULL;
      END $$;
    `);

    // ===== NEW TABLE: habits =====
    await client.query(`
      CREATE TABLE IF NOT EXISTS habits (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(200) NOT NULL,
        category VARCHAR(60) DEFAULT '',
        frequency VARCHAR(20) DEFAULT 'daily',
        target INTEGER DEFAULT 1,
        icon VARCHAR(30) DEFAULT 'fa-star',
        color VARCHAR(10) DEFAULT '#6366F1',
        active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    await client.query('CREATE INDEX IF NOT EXISTS idx_habits_user_id ON habits(user_id);');

    // ===== NEW TABLE: habit_logs =====
    await client.query(`
      CREATE TABLE IF NOT EXISTS habit_logs (
        id SERIAL PRIMARY KEY,
        habit_id INTEGER NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
        date DATE NOT NULL DEFAULT CURRENT_DATE,
        value INTEGER DEFAULT 1,
        notes TEXT DEFAULT '',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(habit_id, date)
      );
    `);
    await client.query('CREATE INDEX IF NOT EXISTS idx_habit_logs_habit_id ON habit_logs(habit_id);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_habit_logs_date ON habit_logs(date);');

    // ===== MODULE EVOLUTION MIGRATIONS =====

    // TASKS: life_area, priority scoring fields, planned_date for weekly planner
    await client.query(`
      DO $$ BEGIN
        ALTER TABLE tasks ADD COLUMN IF NOT EXISTS life_area VARCHAR(30) DEFAULT '';
      EXCEPTION WHEN OTHERS THEN NULL;
      END $$;
    `);
    await client.query(`
      DO $$ BEGIN
        ALTER TABLE tasks ADD COLUMN IF NOT EXISTS urgency INTEGER DEFAULT 1;
      EXCEPTION WHEN OTHERS THEN NULL;
      END $$;
    `);
    await client.query(`
      DO $$ BEGIN
        ALTER TABLE tasks ADD COLUMN IF NOT EXISTS impact INTEGER DEFAULT 1;
      EXCEPTION WHEN OTHERS THEN NULL;
      END $$;
    `);
    await client.query(`
      DO $$ BEGIN
        ALTER TABLE tasks ADD COLUMN IF NOT EXISTS energy INTEGER DEFAULT 1;
      EXCEPTION WHEN OTHERS THEN NULL;
      END $$;
    `);
    await client.query(`
      DO $$ BEGIN
        ALTER TABLE tasks ADD COLUMN IF NOT EXISTS planned_date DATE;
      EXCEPTION WHEN OTHERS THEN NULL;
      END $$;
    `);
    await client.query(`
      DO $$ BEGIN
        ALTER TABLE tasks ADD COLUMN IF NOT EXISTS linked_goal_id INTEGER;
      EXCEPTION WHEN OTHERS THEN NULL;
      END $$;
    `);

    // FINANCES: budgets table
    await client.query(`
      CREATE TABLE IF NOT EXISTS budgets (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        category VARCHAR(100) NOT NULL,
        amount DECIMAL(12,2) NOT NULL DEFAULT 0,
        month INTEGER NOT NULL,
        year INTEGER NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(user_id, category, month, year)
      );
    `);
    await client.query('CREATE INDEX IF NOT EXISTS idx_budgets_user_id ON budgets(user_id);');

    // THOUGHTS: energy, stress, clarity
    await client.query(`
      DO $$ BEGIN
        ALTER TABLE thoughts ADD COLUMN IF NOT EXISTS energy INTEGER DEFAULT 0;
      EXCEPTION WHEN OTHERS THEN NULL;
      END $$;
    `);
    await client.query(`
      DO $$ BEGIN
        ALTER TABLE thoughts ADD COLUMN IF NOT EXISTS stress INTEGER DEFAULT 0;
      EXCEPTION WHEN OTHERS THEN NULL;
      END $$;
    `);
    await client.query(`
      DO $$ BEGIN
        ALTER TABLE thoughts ADD COLUMN IF NOT EXISTS clarity INTEGER DEFAULT 0;
      EXCEPTION WHEN OTHERS THEN NULL;
      END $$;
    `);

    // GRATITUDE: type field
    await client.query(`
      DO $$ BEGIN
        ALTER TABLE gratitude ADD COLUMN IF NOT EXISTS type VARCHAR(30) DEFAULT 'geral';
      EXCEPTION WHEN OTHERS THEN NULL;
      END $$;
    `);

    // PURPOSE: vision field, goals table
    await client.query(`
      DO $$ BEGIN
        ALTER TABLE purpose ADD COLUMN IF NOT EXISTS vision TEXT DEFAULT '';
      EXCEPTION WHEN OTHERS THEN NULL;
      END $$;
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS goals (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(300) NOT NULL,
        description TEXT DEFAULT '',
        life_area VARCHAR(30) DEFAULT '',
        target_date DATE,
        progress INTEGER DEFAULT 0,
        status VARCHAR(20) DEFAULT 'active',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    await client.query('CREATE INDEX IF NOT EXISTS idx_goals_user_id ON goals(user_id);');

    // PATTERNS: analytics_snapshots table
    await client.query(`
      CREATE TABLE IF NOT EXISTS analytics_snapshots (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type VARCHAR(30) NOT NULL,
        data JSONB NOT NULL DEFAULT '{}',
        period_start DATE,
        period_end DATE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    await client.query('CREATE INDEX IF NOT EXISTS idx_analytics_user_id ON analytics_snapshots(user_id);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_analytics_type ON analytics_snapshots(type);');

    // ===== NEW TABLE: task_groups =====
    await client.query(`
      CREATE TABLE IF NOT EXISTS task_groups (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(100) NOT NULL,
        color VARCHAR(10) DEFAULT '#6366F1',
        icon VARCHAR(30) DEFAULT 'fa-folder',
        sort_order INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    await client.query('CREATE INDEX IF NOT EXISTS idx_task_groups_user_id ON task_groups(user_id);');

    // ===== MIGRATION: Add group_id to tasks =====
    await client.query(`
      DO $$ BEGIN
        ALTER TABLE tasks ADD COLUMN group_id INTEGER REFERENCES task_groups(id) ON DELETE SET NULL;
      EXCEPTION WHEN duplicate_column THEN NULL;
      END $$;
    `);

    // ===== TIME TRACKING: task_time_logs =====
    await client.query(`
      CREATE TABLE IF NOT EXISTS task_time_logs (
        id SERIAL PRIMARY KEY,
        task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        started_at TIMESTAMPTZ NOT NULL,
        ended_at TIMESTAMPTZ,
        duration_seconds INTEGER DEFAULT 0,
        notes TEXT DEFAULT '',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    await client.query('CREATE INDEX IF NOT EXISTS idx_time_logs_task_id ON task_time_logs(task_id);');

    // ===== TASK DEPENDENCIES =====
    await client.query(`
      CREATE TABLE IF NOT EXISTS task_dependencies (
        id SERIAL PRIMARY KEY,
        task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        depends_on_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(task_id, depends_on_id)
      );
    `);
    await client.query('CREATE INDEX IF NOT EXISTS idx_task_deps_task_id ON task_dependencies(task_id);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_task_deps_depends_on ON task_dependencies(depends_on_id);');

    // ===== GAMIFICATION: user stats =====
    await client.query(`
      DO $$ BEGIN
        ALTER TABLE users ADD COLUMN IF NOT EXISTS points INTEGER DEFAULT 0;
      EXCEPTION WHEN OTHERS THEN NULL;
      END $$;
    `);
    await client.query(`
      DO $$ BEGIN
        ALTER TABLE users ADD COLUMN IF NOT EXISTS streak INTEGER DEFAULT 0;
      EXCEPTION WHEN OTHERS THEN NULL;
      END $$;
    `);
    await client.query(`
      DO $$ BEGIN
        ALTER TABLE users ADD COLUMN IF NOT EXISTS level INTEGER DEFAULT 1;
      EXCEPTION WHEN OTHERS THEN NULL;
      END $$;
    `);
    await client.query(`
      DO $$ BEGIN
        ALTER TABLE users ADD COLUMN IF NOT EXISTS streak_updated_at DATE;
      EXCEPTION WHEN OTHERS THEN NULL;
      END $$;
    `);
    await client.query(`
      DO $$ BEGIN
        ALTER TABLE users ADD COLUMN IF NOT EXISTS total_tasks_completed INTEGER DEFAULT 0;
      EXCEPTION WHEN OTHERS THEN NULL;
      END $$;
    `);

    // ===== GAMIFICATION: user_badges =====
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_badges (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        badge_key VARCHAR(50) NOT NULL,
        earned_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(user_id, badge_key)
      );
    `);
    await client.query('CREATE INDEX IF NOT EXISTS idx_user_badges_user_id ON user_badges(user_id);');

    // ===== RECURRING TRANSACTIONS =====
    await client.query(`
      CREATE TABLE IF NOT EXISTS recurring_transactions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type VARCHAR(20) NOT NULL,
        amount DECIMAL(12,2) NOT NULL,
        category VARCHAR(100),
        description TEXT,
        payment_method VARCHAR(30) DEFAULT '',
        account_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
        frequency VARCHAR(20) NOT NULL DEFAULT 'monthly',
        day_of_month INTEGER DEFAULT 1,
        start_date DATE NOT NULL,
        end_date DATE,
        last_generated DATE,
        active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    await client.query('CREATE INDEX IF NOT EXISTS idx_recurring_tx_user_id ON recurring_transactions(user_id);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_recurring_tx_active ON recurring_transactions(active);');

    // ===== SAVINGS GOALS =====
    await client.query(`
      CREATE TABLE IF NOT EXISTS savings_goals (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(200) NOT NULL,
        target_amount DECIMAL(14,2) NOT NULL,
        current_amount DECIMAL(14,2) DEFAULT 0,
        icon VARCHAR(30) DEFAULT 'fa-piggy-bank',
        color VARCHAR(10) DEFAULT '#10B981',
        deadline DATE,
        priority INTEGER DEFAULT 1,
        status VARCHAR(20) DEFAULT 'active',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    await client.query('CREATE INDEX IF NOT EXISTS idx_savings_goals_user_id ON savings_goals(user_id);');

    // ===== SAVINGS DEPOSITS (contribuições para metas) =====
    await client.query(`
      CREATE TABLE IF NOT EXISTS savings_deposits (
        id SERIAL PRIMARY KEY,
        goal_id INTEGER NOT NULL REFERENCES savings_goals(id) ON DELETE CASCADE,
        amount DECIMAL(12,2) NOT NULL,
        date DATE DEFAULT CURRENT_DATE,
        notes TEXT DEFAULT '',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    await client.query('CREATE INDEX IF NOT EXISTS idx_savings_deposits_goal_id ON savings_deposits(goal_id);');

    // ===== DEBTS (Controle de Dívidas) =====
    await client.query(`
      CREATE TABLE IF NOT EXISTS debts (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(200) NOT NULL,
        creditor VARCHAR(200) DEFAULT '',
        total_amount DECIMAL(14,2) NOT NULL,
        paid_amount DECIMAL(14,2) DEFAULT 0,
        interest_rate DECIMAL(6,2) DEFAULT 0,
        total_installments INTEGER DEFAULT 1,
        paid_installments INTEGER DEFAULT 0,
        due_day INTEGER DEFAULT 1,
        start_date DATE DEFAULT CURRENT_DATE,
        category VARCHAR(60) DEFAULT 'outros',
        priority INTEGER DEFAULT 2,
        status VARCHAR(20) DEFAULT 'active',
        notes TEXT DEFAULT '',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    await client.query('CREATE INDEX IF NOT EXISTS idx_debts_user_id ON debts(user_id);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_debts_status ON debts(status);');

    // ===== DEBT PAYMENTS (Histórico de Pagamentos) =====
    await client.query(`
      CREATE TABLE IF NOT EXISTS debt_payments (
        id SERIAL PRIMARY KEY,
        debt_id INTEGER NOT NULL REFERENCES debts(id) ON DELETE CASCADE,
        amount DECIMAL(12,2) NOT NULL,
        installment_number INTEGER DEFAULT 1,
        payment_date DATE DEFAULT CURRENT_DATE,
        payment_method VARCHAR(30) DEFAULT '',
        notes TEXT DEFAULT '',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    await client.query('CREATE INDEX IF NOT EXISTS idx_debt_payments_debt_id ON debt_payments(debt_id);');

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
