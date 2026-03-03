require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { body, param, validationResult } = require('express-validator');
const { run, get, all, init, close } = require('./db');

const app = express();
const isProduction = process.env.NODE_ENV === 'production';

// CORS configuration
const corsOptions = {
  origin: isProduction ? process.env.FRONTEND_URL || true : '*',
  credentials: true
};
app.use(cors(corsOptions));
app.use(express.json({ limit: '1mb' }));

// Serve static frontend files (from project root)
const staticPath = path.join(__dirname, '..');
app.use(express.static(staticPath, {
  maxAge: isProduction ? '1d' : 0,
  etag: true
}));

// Serve icons folder
app.use('/icons', express.static(path.join(staticPath, 'icons')));

// Rate limiting configuration
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isProduction ? 5 : 20, // More lenient in development
  message: 'Muitas tentativas de login/registro. Tente novamente em 15 minutos.',
  standardHeaders: true,
  legacyHeaders: false,
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs for general API
  message: 'Muitas requisições da API. Tente novamente em 15 minutos.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Validate environment variables
if (!process.env.JWT_SECRET) {
  console.error('ERRO CRÍTICO: JWT_SECRET não definido no arquivo .env');
  process.exit(1);
}

const JWT_SECRET = process.env.JWT_SECRET;
const PORT = process.env.PORT || 4000;

// Initialize database and start server
let server;

(async () => {
  try {
    await init();
    console.log('Database initialized');
    
    server = app.listen(PORT, () => {
      console.log(`DOMUS Server listening on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
    
    server.on('error', (err) => {
      console.error('Server error:', err);
    });
  } catch (err) {
    console.error('DB init error', err);
    process.exit(1);
  }
})();

// Graceful shutdown handler
async function gracefulShutdown(signal) {
  console.log(`\n${signal} received. Shutting down gracefully...`);
  
  if (server) {
    server.close(async () => {
      console.log('HTTP server closed');
      try {
        await close();
        console.log('Database connection closed');
        process.exit(0);
      } catch (err) {
        console.error('Error during shutdown:', err);
        process.exit(1);
      }
    });
  } else {
    process.exit(0);
  }
  
  // Force exit after 10 seconds
  setTimeout(() => {
    console.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Global error handlers
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
});

process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection:', err);
});

// Helpers
function generateToken(user) {
  return jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
}

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ message: 'No token provided' });

  const parts = authHeader.split(' ');
  if (parts.length !== 2) return res.status(401).json({ message: 'Token error' });

  const [scheme, token] = parts;
  if (!/^Bearer$/i.test(scheme)) return res.status(401).json({ message: 'Token malformatted' });

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(401).json({ message: 'Token invalid' });
    req.user = decoded; // { id, username }
    next();
  });
}

// Validation middleware
const validateRegistration = [
  body('username')
    .isLength({ min: 3, max: 30 })
    .withMessage('Username deve ter entre 3 e 30 caracteres')
    .matches(/^[a-zA-Z0-9_\-\.]+$/)
    .withMessage('Username deve conter apenas letras, números, underscore, hífen ou ponto')
    .trim()
    .escape(),
  body('password')
    .isLength({ min: 6, max: 100 })
    .withMessage('Password deve ter entre 6 e 100 caracteres')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password deve ter pelo menos uma letra minúscula, maiúscula e um número'),
];

const validateLogin = [
  body('username')
    .isLength({ min: 3, max: 30 })
    .withMessage('Username inválido')
    .trim()
    .escape(),
  body('password')
    .isLength({ min: 6, max: 100 })
    .withMessage('Password inválido'),
];

const validateTask = [
  body('text')
    .isLength({ min: 1, max: 500 })
    .withMessage('Texto da tarefa deve ter entre 1 e 500 caracteres')
    .trim()
    .escape(),
  body('priority')
    .optional()
    .isIn(['low', 'medium', 'high'])
    .withMessage('Prioridade deve ser low, medium ou high'),
];

const validateThought = [
  body('text')
    .isLength({ min: 1, max: 1000 })
    .withMessage('Texto do pensamento deve ter entre 1 e 1000 caracteres')
    .trim()
    .escape(),
  body('mood')
    .optional()
    .isLength({ max: 50 })
    .withMessage('Humor deve ter no máximo 50 caracteres')
    .trim()
    .escape(),
  body('tags')
    .optional()
    .custom((value) => {
      if (Array.isArray(value)) {
        return value.every(tag => typeof tag === 'string' && tag.length <= 30);
      }
      return typeof value === 'string' && value.length <= 200;
    })
    .withMessage('Tags inválidas'),
];

const validateGratitude = [
  body('text')
    .isLength({ min: 1, max: 500 })
    .withMessage('Texto de gratidão deve ter entre 1 e 500 caracteres')
    .trim()
    .escape(),
];

const validateFinance = [
  body('type')
    .isIn(['income', 'expense'])
    .withMessage('Tipo deve ser income ou expense'),
  body('amount')
    .isFloat({ min: 0 })
    .withMessage('Valor deve ser um número positivo'),
  body('category')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Categoria deve ter no máximo 100 caracteres')
    .trim()
    .escape(),
  body('description')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Descrição deve ter no máximo 500 caracteres')
    .trim()
    .escape(),
  body('payment_method')
    .optional()
    .isIn(['', 'pix', 'cartao', 'dinheiro', 'transferencia'])
    .withMessage('Método de pagamento inválido'),
  body('date')
    .optional()
    .isISO8601()
    .withMessage('Data inválida'),
];

// Validation result handler
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      message: 'Dados inválidos', 
      errors: errors.array().map(err => err.msg) 
    });
  }
  next();
};

// Auth routes
app.post('/auth/register', authLimiter, validateRegistration, handleValidationErrors, async (req, res) => {
  const { username, password } = req.body;

  try {
    const hashed = await bcrypt.hash(password, 10);
    const result = await run('INSERT INTO users (username, password) VALUES (?, ?) RETURNING id', [username, hashed]);
    const user = { id: result.lastID, username };
    const token = generateToken(user);
    res.json({ user, token });
  } catch (err) {
    console.error(err);
    if (err.message && (err.message.includes('UNIQUE') || err.message.includes('duplicate key') || err.code === '23505')) {
      return res.status(400).json({ message: 'Username already taken' });
    }
    res.status(500).json({ message: 'Internal error' });
  }
});

app.post('/auth/login', authLimiter, validateLogin, handleValidationErrors, async (req, res) => {
  const { username, password } = req.body;

  try {
    const user = await get('SELECT * FROM users WHERE username = ?', [username]);
    if (!user) return res.status(400).json({ message: 'Invalid credentials' });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ message: 'Invalid credentials' });

    const token = generateToken({ id: user.id, username: user.username });
    res.json({ user: { id: user.id, username: user.username }, token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal error' });
  }
});

// Protected routes - apply API rate limiting
app.use('/api', apiLimiter);

// Protected example: get current user
app.get('/api/me', authMiddleware, async (req, res) => {
  try {
    const user = await get('SELECT id, username, created_at FROM users WHERE id = ?', [req.user.id]);
    res.json({ user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal error' });
  }
});

// Tasks CRUD (isolated by user_id)
app.get('/api/tasks', authMiddleware, async (req, res) => {
  try {
    const tasks = await all('SELECT * FROM tasks WHERE user_id = ? ORDER BY sort_order ASC, created_at DESC', [req.user.id]);
    res.json({ tasks });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal error' });
  }
});

// Batch reorder tasks (must be before :id routes)
app.patch('/api/tasks/reorder', authMiddleware, async (req, res) => {
  const { order } = req.body;
  if (!Array.isArray(order)) return res.status(400).json({ message: 'order must be array' });
  try {
    for (const item of order) {
      await run('UPDATE tasks SET sort_order = ? WHERE id = ? AND user_id = ?', [item.sort_order, item.id, req.user.id]);
    }
    res.json({ message: 'Reordered' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal error' });
  }
});

app.post('/api/tasks', authMiddleware, validateTask, handleValidationErrors, async (req, res) => {
  const { text, priority, category, due_date, notes } = req.body;
  try {
    const result = await run(
      'INSERT INTO tasks (user_id, text, priority, category, due_date, notes) VALUES (?, ?, ?, ?, ?, ?) RETURNING id',
      [req.user.id, text, priority || 'low', category || '', due_date || null, notes || '']
    );
    const task = await get('SELECT * FROM tasks WHERE id = ?', [result.lastID]);
    res.json({ task });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal error' });
  }
});

// Validate ID parameter middleware
const validateId = [
  param('id').isInt({ min: 1 }).withMessage('ID inválido').toInt()
];

app.patch('/api/tasks/:id/toggle', authMiddleware, validateId, handleValidationErrors, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  try {
    const task = await get('SELECT * FROM tasks WHERE id = ? AND user_id = ?', [id, req.user.id]);
    if (!task) return res.status(404).json({ message: 'Not found' });
    const completed = task.completed ? 0 : 1;
    await run('UPDATE tasks SET completed = ? WHERE id = ?', [completed, id]);
    const updated = await get('SELECT * FROM tasks WHERE id = ?', [id]);
    res.json({ task: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal error' });
  }
});

app.delete('/api/tasks/:id', authMiddleware, validateId, handleValidationErrors, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  try {
    const task = await get('SELECT * FROM tasks WHERE id = ? AND user_id = ?', [id, req.user.id]);
    if (!task) return res.status(404).json({ message: 'Not found' });
    await run('DELETE FROM tasks WHERE id = ?', [id]);
    res.json({ message: 'Deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal error' });
  }
});

// Add simple endpoints for thoughts, gratitude and finances (list/create) - each filtered by user_id
app.get('/api/thoughts', authMiddleware, async (req, res) => {
  try {
    const rows = await all('SELECT * FROM thoughts WHERE user_id = ? ORDER BY date DESC LIMIT 50', [req.user.id]);
    res.json({ thoughts: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal error' });
  }
});

app.post('/api/thoughts', authMiddleware, validateThought, handleValidationErrors, async (req, res) => {
  const { text, mood, tags } = req.body;
  try {
    const tagsStr = Array.isArray(tags) ? tags.join(',') : (tags || '');
    const result = await run('INSERT INTO thoughts (user_id, text, mood, tags) VALUES (?, ?, ?, ?) RETURNING id', [req.user.id, text, mood || null, tagsStr]);
    const thought = await get('SELECT * FROM thoughts WHERE id = ?', [result.lastID]);
    res.json({ thought });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal error' });
  }
});

app.get('/api/gratitude', authMiddleware, async (req, res) => {
  try {
    const rows = await all('SELECT * FROM gratitude WHERE user_id = ? ORDER BY date DESC LIMIT 50', [req.user.id]);
    res.json({ gratitude: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal error' });
  }
});

app.post('/api/gratitude', authMiddleware, validateGratitude, handleValidationErrors, async (req, res) => {
  const { text } = req.body;
  try {
    const result = await run('INSERT INTO gratitude (user_id, text) VALUES (?, ?) RETURNING id', [req.user.id, text]);
    const item = await get('SELECT * FROM gratitude WHERE id = ?', [result.lastID]);
    res.json({ item });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal error' });
  }
});

app.get('/api/finances', authMiddleware, async (req, res) => {
  try {
    const { month, year } = req.query;
    let sql = 'SELECT * FROM finances WHERE user_id = ?';
    const params = [req.user.id];
    if (month && year) {
      sql += " AND EXTRACT(MONTH FROM date) = ? AND EXTRACT(YEAR FROM date) = ?";
      params.push(parseInt(month), parseInt(year));
    }
    sql += ' ORDER BY date DESC LIMIT 500';
    const rows = await all(sql, params);
    res.json({ finances: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal error' });
  }
});

app.post('/api/finances', authMiddleware, validateFinance, handleValidationErrors, async (req, res) => {
  const { type, amount, category, description, payment_method, date } = req.body;
  try {
    const dateVal = date || new Date().toISOString();
    const result = await run(
      'INSERT INTO finances (user_id, type, amount, category, description, payment_method, date) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id',
      [req.user.id, type, amount, category || '', description || '', payment_method || '', dateVal]
    );
    const item = await get('SELECT * FROM finances WHERE id = ?', [result.lastID]);
    res.json({ item });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal error' });
  }
});

// DELETE endpoints for all modules
app.delete('/api/thoughts/:id', authMiddleware, validateId, handleValidationErrors, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  try {
    const item = await get('SELECT * FROM thoughts WHERE id = ? AND user_id = ?', [id, req.user.id]);
    if (!item) return res.status(404).json({ message: 'Not found' });
    await run('DELETE FROM thoughts WHERE id = ?', [id]);
    res.json({ message: 'Deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal error' });
  }
});

app.delete('/api/gratitude/:id', authMiddleware, validateId, handleValidationErrors, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  try {
    const item = await get('SELECT * FROM gratitude WHERE id = ? AND user_id = ?', [id, req.user.id]);
    if (!item) return res.status(404).json({ message: 'Not found' });
    await run('DELETE FROM gratitude WHERE id = ?', [id]);
    res.json({ message: 'Deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal error' });
  }
});

app.delete('/api/finances/:id', authMiddleware, validateId, handleValidationErrors, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  try {
    const item = await get('SELECT * FROM finances WHERE id = ? AND user_id = ?', [id, req.user.id]);
    if (!item) return res.status(404).json({ message: 'Not found' });
    await run('DELETE FROM finances WHERE id = ?', [id]);
    res.json({ message: 'Deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal error' });
  }
});

// PUT endpoints for editing
app.put('/api/tasks/:id', authMiddleware, validateId, validateTask, handleValidationErrors, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { text, priority, category, due_date, notes, sort_order } = req.body;
  try {
    const task = await get('SELECT * FROM tasks WHERE id = ? AND user_id = ?', [id, req.user.id]);
    if (!task) return res.status(404).json({ message: 'Not found' });
    await run(
      'UPDATE tasks SET text = ?, priority = ?, category = ?, due_date = ?, notes = ?, sort_order = ? WHERE id = ?',
      [text, priority || task.priority, category ?? task.category, due_date ?? task.due_date, notes ?? task.notes, sort_order ?? task.sort_order, id]
    );
    const updated = await get('SELECT * FROM tasks WHERE id = ?', [id]);
    res.json({ task: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal error' });
  }
});

app.put('/api/finances/:id', authMiddleware, validateId, validateFinance, handleValidationErrors, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { type, amount, category, description, payment_method, date } = req.body;
  try {
    const item = await get('SELECT * FROM finances WHERE id = ? AND user_id = ?', [id, req.user.id]);
    if (!item) return res.status(404).json({ message: 'Not found' });
    await run(
      'UPDATE finances SET type = ?, amount = ?, category = ?, description = ?, payment_method = ?, date = ? WHERE id = ?',
      [type, amount, category || '', description || '', payment_method ?? item.payment_method ?? '', date || item.date, id]
    );
    const updated = await get('SELECT * FROM finances WHERE id = ?', [id]);
    res.json({ item: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal error' });
  }
});

// Purpose endpoints (one record per user)
app.get('/api/purpose', authMiddleware, async (req, res) => {
  try {
    const row = await get('SELECT * FROM purpose WHERE user_id = ?', [req.user.id]);
    res.json({ purpose: row || { mission: '', goals: '', values: '' } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal error' });
  }
});

app.put('/api/purpose', authMiddleware, [
  body('mission').optional().isLength({ max: 2000 }).trim(),
  body('goals').optional().isLength({ max: 2000 }).trim(),
  body('values').optional().isLength({ max: 1000 }).trim(),
], handleValidationErrors, async (req, res) => {
  const { mission, goals, values } = req.body;
  try {
    const existing = await get('SELECT * FROM purpose WHERE user_id = ?', [req.user.id]);
    if (existing) {
      await run('UPDATE purpose SET mission = ?, goals = ?, "values" = ?, updated_at = NOW() WHERE user_id = ?',
        [mission || '', goals || '', values || '', req.user.id]);
    } else {
      await run('INSERT INTO purpose (user_id, mission, goals, "values") VALUES (?, ?, ?, ?) RETURNING id',
        [req.user.id, mission || '', goals || '', values || '']);
    }
    const updated = await get('SELECT * FROM purpose WHERE user_id = ?', [req.user.id]);
    res.json({ purpose: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal error' });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0'
  });
});

// SPA fallback - serve index.html for non-API routes
app.get('*', (req, res, next) => {
  // Skip API and auth routes
  if (req.path.startsWith('/api') || req.path.startsWith('/auth')) {
    return res.status(404).json({ message: 'Endpoint not found' });
  }
  
  // Serve index.html for all other routes (SPA)
  res.sendFile(path.join(__dirname, '..', 'index.html'));
});
