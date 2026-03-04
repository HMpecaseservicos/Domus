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

// Service Worker MUST NOT be cached by HTTP cache
app.get('/sw.js', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.sendFile(path.join(staticPath, 'sw.js'));
});

// Nuclear cache clear page — visit /clear to force-remove old Service Workers
app.get('/clear', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.send(`<!DOCTYPE html>
<html lang="pt-br">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DOMUS — Limpando cache...</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family:'Inter',system-ui,sans-serif; background:#111827; color:#fff;
           display:flex; align-items:center; justify-content:center; min-height:100vh; padding:20px; }
    .card { text-align:center; max-width:400px; }
    h1 { font-size:1.5rem; margin-bottom:12px; }
    p { color:#9CA3AF; font-size:0.9rem; line-height:1.6; }
    .spinner { width:48px; height:48px; border:4px solid #374151; border-top-color:#6C63FF;
               border-radius:50%; animation:spin .8s linear infinite; margin:0 auto 24px; }
    @keyframes spin { to { transform:rotate(360deg); } }
    .done { color:#10B981; font-weight:700; font-size:1.1rem; }
    .error { color:#EF4444; }
  </style>
</head>
<body>
  <div class="card">
    <div class="spinner" id="spinner"></div>
    <h1>Limpando cache do DOMUS...</h1>
    <p id="status">Removendo Service Workers antigos...</p>
  </div>
  <script>
    async function clearAll() {
      const status = document.getElementById('status');
      const spinner = document.getElementById('spinner');
      try {
        // 1. Unregister ALL service workers
        if ('serviceWorker' in navigator) {
          const regs = await navigator.serviceWorker.getRegistrations();
          for (const reg of regs) {
            await reg.unregister();
          }
          status.textContent = 'Service Workers removidos (' + regs.length + '). Limpando caches...';
        }
        // 2. Delete ALL caches
        if ('caches' in window) {
          const keys = await caches.keys();
          for (const key of keys) {
            await caches.delete(key);
          }
          status.textContent = 'Caches limpos (' + keys.length + '). Redirecionando...';
        }
        // 3. Wait a moment then redirect
        spinner.style.borderTopColor = '#10B981';
        status.innerHTML = '<span class="done">✓ Tudo limpo! Redirecionando...</span>';
        setTimeout(() => { window.location.href = '/?cache_bust=' + Date.now(); }, 1500);
      } catch(err) {
        status.innerHTML = '<span class="error">Erro: ' + err.message + '</span><br><br>Tente abrir em aba anônima.';
      }
    }
    clearAll();
  </script>
</body>
</html>`);
});

app.use(express.static(staticPath, {
  maxAge: isProduction ? '5m' : 0,
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
  body('status')
    .optional()
    .isIn(['todo', 'in_progress', 'done'])
    .withMessage('Status deve ser todo, in_progress ou done'),
  body('recurrence')
    .optional()
    .isIn(['', 'daily', 'weekly', 'monthly'])
    .withMessage('Recorrência inválida'),
  body('estimated_minutes')
    .optional()
    .isInt({ min: 0, max: 9999 })
    .toInt(),
  body('life_area')
    .optional()
    .isIn(['', 'trabalho', 'financas', 'saude', 'espiritual', 'familia', 'estudos', 'projetos'])
    .withMessage('Área de vida inválida'),
  body('urgency').optional().isInt({ min: 1, max: 5 }).toInt(),
  body('impact').optional().isInt({ min: 1, max: 5 }).toInt(),
  body('energy').optional().isInt({ min: 1, max: 5 }).toInt(),
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
    // Attach subtasks from task_subtasks table for each task
    const subtasks = await all('SELECT * FROM task_subtasks WHERE task_id IN (SELECT id FROM tasks WHERE user_id = ?) ORDER BY sort_order ASC', [req.user.id]);
    const subtasksMap = {};
    subtasks.forEach(s => {
      if (!subtasksMap[s.task_id]) subtasksMap[s.task_id] = [];
      subtasksMap[s.task_id].push(s);
    });
    tasks.forEach(t => { t.subtask_items = subtasksMap[t.id] || []; });
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
  const { text, priority, category, due_date, notes, status, subtasks, tags, estimated_minutes, recurrence, life_area, urgency, impact, energy, planned_date, linked_goal_id } = req.body;
  try {
    const tagsStr = Array.isArray(tags) ? tags.join(',') : (tags || '');
    const result = await run(
      'INSERT INTO tasks (user_id, text, priority, category, due_date, notes, status, tags, estimated_minutes, recurrence, life_area, urgency, impact, energy, planned_date, linked_goal_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id',
      [req.user.id, text, priority || 'low', category || '', due_date || null, notes || '', status || 'todo', tagsStr, estimated_minutes || 0, recurrence || '', life_area || '', urgency || 1, impact || 1, energy || 1, planned_date || null, linked_goal_id || null]
    );
    const taskId = result.lastID;
    // Insert subtasks into task_subtasks table
    if (Array.isArray(subtasks) && subtasks.length > 0) {
      for (let i = 0; i < subtasks.length; i++) {
        const sub = subtasks[i];
        await run('INSERT INTO task_subtasks (task_id, text, completed, sort_order) VALUES (?, ?, ?, ?)',
          [taskId, sub.text || sub, !!sub.done || !!sub.completed, i]);
      }
    }
    const task = await get('SELECT * FROM tasks WHERE id = ?', [taskId]);
    task.subtask_items = await all('SELECT * FROM task_subtasks WHERE task_id = ? ORDER BY sort_order ASC', [taskId]);
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
    const completed = !task.completed;
    const status = completed ? 'done' : 'todo';
    const completedAt = completed ? new Date().toISOString() : null;
    await run('UPDATE tasks SET completed = ?, status = ?, completed_at = ? WHERE id = ?', [completed, status, completedAt, id]);
    const updated = await get('SELECT * FROM tasks WHERE id = ?', [id]);
    // Attach subtasks from task_subtasks table
    updated.subtask_items = await all('SELECT * FROM task_subtasks WHERE task_id = ? ORDER BY sort_order ASC', [id]);
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
  const { text, mood, tags, energy, stress, clarity } = req.body;
  try {
    const tagsStr = Array.isArray(tags) ? tags.join(',') : (tags || '');
    const result = await run('INSERT INTO thoughts (user_id, text, mood, tags, energy, stress, clarity) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id', [req.user.id, text, mood || null, tagsStr, energy || 0, stress || 0, clarity || 0]);
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
  const { text, type } = req.body;
  try {
    const result = await run('INSERT INTO gratitude (user_id, text, type) VALUES (?, ?, ?) RETURNING id', [req.user.id, text, type || 'geral']);
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
  const { type, amount, category, description, payment_method, date, account_id } = req.body;
  try {
    const dateVal = date || new Date().toISOString();
    const result = await run(
      'INSERT INTO finances (user_id, type, amount, category, description, payment_method, date, account_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id',
      [req.user.id, type, amount, category || '', description || '', payment_method || '', dateVal, account_id || null]
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
  const { text, priority, category, due_date, notes, sort_order, status, subtasks, tags, estimated_minutes, recurrence, life_area, urgency, impact, energy, planned_date, linked_goal_id } = req.body;
  try {
    const task = await get('SELECT * FROM tasks WHERE id = ? AND user_id = ?', [id, req.user.id]);
    if (!task) return res.status(404).json({ message: 'Not found' });
    const tagsStr = tags !== undefined ? (Array.isArray(tags) ? tags.join(',') : (tags || '')) : (task.tags || '');
    const newStatus = status || task.status || 'todo';
    const newCompleted = newStatus === 'done';
    const completedAt = newStatus === 'done' && task.status !== 'done' ? new Date().toISOString() : (newStatus !== 'done' ? null : task.completed_at);
    await run(
      'UPDATE tasks SET text = ?, priority = ?, category = ?, due_date = ?, notes = ?, sort_order = ?, status = ?, completed = ?, tags = ?, estimated_minutes = ?, recurrence = ?, completed_at = ?, life_area = ?, urgency = ?, impact = ?, energy = ?, planned_date = ?, linked_goal_id = ? WHERE id = ?',
      [text, priority || task.priority, category ?? task.category, due_date ?? task.due_date, notes ?? task.notes, sort_order ?? task.sort_order, newStatus, newCompleted, tagsStr, estimated_minutes ?? task.estimated_minutes ?? 0, recurrence ?? task.recurrence ?? '', completedAt, life_area ?? task.life_area ?? '', urgency ?? task.urgency ?? 1, impact ?? task.impact ?? 1, energy ?? task.energy ?? 1, planned_date ?? task.planned_date, linked_goal_id ?? task.linked_goal_id, id]
    );
    // Sync subtasks if provided
    if (subtasks !== undefined && Array.isArray(subtasks)) {
      await run('DELETE FROM task_subtasks WHERE task_id = ?', [id]);
      for (let i = 0; i < subtasks.length; i++) {
        const sub = subtasks[i];
        await run('INSERT INTO task_subtasks (task_id, text, completed, sort_order) VALUES (?, ?, ?, ?)',
          [id, sub.text || sub, !!sub.done || !!sub.completed, i]);
      }
    }
    const updated = await get('SELECT * FROM tasks WHERE id = ?', [id]);
    updated.subtask_items = await all('SELECT * FROM task_subtasks WHERE task_id = ? ORDER BY sort_order ASC', [id]);
    res.json({ task: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal error' });
  }
});

app.put('/api/finances/:id', authMiddleware, validateId, validateFinance, handleValidationErrors, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { type, amount, category, description, payment_method, date, account_id } = req.body;
  try {
    const item = await get('SELECT * FROM finances WHERE id = ? AND user_id = ?', [id, req.user.id]);
    if (!item) return res.status(404).json({ message: 'Not found' });
    await run(
      'UPDATE finances SET type = ?, amount = ?, category = ?, description = ?, payment_method = ?, date = ?, account_id = ? WHERE id = ?',
      [type, amount, category || '', description || '', payment_method ?? item.payment_method ?? '', date || item.date, account_id ?? item.account_id ?? null, id]
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
  body('vision').optional().isLength({ max: 2000 }).trim(),
], handleValidationErrors, async (req, res) => {
  const { mission, goals, values, vision } = req.body;
  try {
    const existing = await get('SELECT * FROM purpose WHERE user_id = ?', [req.user.id]);
    if (existing) {
      await run('UPDATE purpose SET mission = ?, goals = ?, "values" = ?, vision = ?, updated_at = NOW() WHERE user_id = ?',
        [mission || '', goals || '', values || '', vision || '', req.user.id]);
    } else {
      await run('INSERT INTO purpose (user_id, mission, goals, "values", vision) VALUES (?, ?, ?, ?, ?) RETURNING id',
        [req.user.id, mission || '', goals || '', values || '', vision || '']);
    }
    const updated = await get('SELECT * FROM purpose WHERE user_id = ?', [req.user.id]);
    res.json({ purpose: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal error' });
  }
});

// ===== ACCOUNTS CRUD =====
app.get('/api/accounts', authMiddleware, async (req, res) => {
  try {
    const accounts = await all('SELECT * FROM accounts WHERE user_id = ? ORDER BY created_at ASC', [req.user.id]);
    res.json({ accounts });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal error' });
  }
});

app.post('/api/accounts', authMiddleware, [
  body('name').isLength({ min: 1, max: 100 }).withMessage('Nome obrigatório').trim().escape(),
  body('type').optional().isIn(['checking', 'savings', 'credit', 'wallet', 'investment']).withMessage('Tipo inválido'),
  body('balance').optional().isFloat().toFloat(),
], handleValidationErrors, async (req, res) => {
  const { name, type, balance, icon, color } = req.body;
  try {
    const result = await run(
      'INSERT INTO accounts (user_id, name, type, balance, icon, color) VALUES (?, ?, ?, ?, ?, ?) RETURNING id',
      [req.user.id, name, type || 'checking', balance || 0, icon || 'fa-university', color || '#3B82F6']
    );
    const account = await get('SELECT * FROM accounts WHERE id = ?', [result.lastID]);
    res.json({ account });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal error' });
  }
});

app.put('/api/accounts/:id', authMiddleware, validateId, [
  body('name').isLength({ min: 1, max: 100 }).withMessage('Nome obrigatório').trim().escape(),
  body('type').optional().isIn(['checking', 'savings', 'credit', 'wallet', 'investment']),
  body('balance').optional().isFloat().toFloat(),
], handleValidationErrors, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { name, type, balance, icon, color } = req.body;
  try {
    const account = await get('SELECT * FROM accounts WHERE id = ? AND user_id = ?', [id, req.user.id]);
    if (!account) return res.status(404).json({ message: 'Not found' });
    await run('UPDATE accounts SET name = ?, type = ?, balance = ?, icon = ?, color = ? WHERE id = ?',
      [name || account.name, type || account.type, balance ?? account.balance, icon || account.icon, color || account.color, id]);
    const updated = await get('SELECT * FROM accounts WHERE id = ?', [id]);
    res.json({ account: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal error' });
  }
});

app.delete('/api/accounts/:id', authMiddleware, validateId, handleValidationErrors, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  try {
    const account = await get('SELECT * FROM accounts WHERE id = ? AND user_id = ?', [id, req.user.id]);
    if (!account) return res.status(404).json({ message: 'Not found' });
    await run('DELETE FROM accounts WHERE id = ?', [id]);
    res.json({ message: 'Deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal error' });
  }
});

// ===== HABITS CRUD =====
app.get('/api/habits', authMiddleware, async (req, res) => {
  try {
    const habits = await all('SELECT * FROM habits WHERE user_id = ? ORDER BY created_at ASC', [req.user.id]);
    // Attach logs for last 30 days
    const since = new Date();
    since.setDate(since.getDate() - 30);
    const dateStr = since.toISOString().split('T')[0];
    const logs = await all(
      'SELECT * FROM habit_logs WHERE habit_id IN (SELECT id FROM habits WHERE user_id = ?) AND date >= ? ORDER BY date ASC',
      [req.user.id, dateStr]
    );
    const logsMap = {};
    logs.forEach(l => {
      if (!logsMap[l.habit_id]) logsMap[l.habit_id] = [];
      logsMap[l.habit_id].push(l);
    });
    habits.forEach(h => { h.logs = logsMap[h.id] || []; });
    res.json({ habits });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal error' });
  }
});

app.post('/api/habits', authMiddleware, [
  body('name').isLength({ min: 1, max: 200 }).withMessage('Nome obrigatório').trim().escape(),
  body('category').optional().isLength({ max: 60 }).trim().escape(),
  body('frequency').optional().isIn(['daily', 'weekly', 'monthly']).withMessage('Frequência inválida'),
  body('target').optional().isInt({ min: 1, max: 100 }).toInt(),
], handleValidationErrors, async (req, res) => {
  const { name, category, frequency, target, icon, color } = req.body;
  try {
    const result = await run(
      'INSERT INTO habits (user_id, name, category, frequency, target, icon, color) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id',
      [req.user.id, name, category || '', frequency || 'daily', target || 1, icon || 'fa-star', color || '#6366F1']
    );
    const habit = await get('SELECT * FROM habits WHERE id = ?', [result.lastID]);
    habit.logs = [];
    res.json({ habit });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal error' });
  }
});

app.put('/api/habits/:id', authMiddleware, validateId, [
  body('name').isLength({ min: 1, max: 200 }).withMessage('Nome obrigatório').trim().escape(),
  body('frequency').optional().isIn(['daily', 'weekly', 'monthly']),
  body('target').optional().isInt({ min: 1, max: 100 }).toInt(),
], handleValidationErrors, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { name, category, frequency, target, icon, color, active } = req.body;
  try {
    const habit = await get('SELECT * FROM habits WHERE id = ? AND user_id = ?', [id, req.user.id]);
    if (!habit) return res.status(404).json({ message: 'Not found' });
    await run('UPDATE habits SET name = ?, category = ?, frequency = ?, target = ?, icon = ?, color = ?, active = ? WHERE id = ?',
      [name || habit.name, category ?? habit.category, frequency || habit.frequency, target ?? habit.target, icon || habit.icon, color || habit.color, active !== undefined ? active : habit.active, id]);
    const updated = await get('SELECT * FROM habits WHERE id = ?', [id]);
    updated.logs = await all('SELECT * FROM habit_logs WHERE habit_id = ? AND date >= ? ORDER BY date ASC',
      [id, new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]]);
    res.json({ habit: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal error' });
  }
});

app.delete('/api/habits/:id', authMiddleware, validateId, handleValidationErrors, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  try {
    const habit = await get('SELECT * FROM habits WHERE id = ? AND user_id = ?', [id, req.user.id]);
    if (!habit) return res.status(404).json({ message: 'Not found' });
    await run('DELETE FROM habits WHERE id = ?', [id]);
    res.json({ message: 'Deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal error' });
  }
});

// ===== HABIT LOGS =====
app.post('/api/habits/:id/log', authMiddleware, validateId, handleValidationErrors, async (req, res) => {
  const habitId = parseInt(req.params.id, 10);
  const { date, value, notes } = req.body;
  try {
    const habit = await get('SELECT * FROM habits WHERE id = ? AND user_id = ?', [habitId, req.user.id]);
    if (!habit) return res.status(404).json({ message: 'Not found' });
    const logDate = date || new Date().toISOString().split('T')[0];
    // Upsert: insert or update
    const existing = await get('SELECT * FROM habit_logs WHERE habit_id = ? AND date = ?', [habitId, logDate]);
    if (existing) {
      await run('UPDATE habit_logs SET value = ?, notes = ? WHERE id = ?', [value ?? 1, notes || '', existing.id]);
    } else {
      await run('INSERT INTO habit_logs (habit_id, date, value, notes) VALUES (?, ?, ?, ?)',
        [habitId, logDate, value ?? 1, notes || '']);
    }
    const log = await get('SELECT * FROM habit_logs WHERE habit_id = ? AND date = ?', [habitId, logDate]);
    res.json({ log });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal error' });
  }
});

app.delete('/api/habits/:id/log', authMiddleware, validateId, handleValidationErrors, async (req, res) => {
  const habitId = parseInt(req.params.id, 10);
  const { date } = req.body;
  try {
    const habit = await get('SELECT * FROM habits WHERE id = ? AND user_id = ?', [habitId, req.user.id]);
    if (!habit) return res.status(404).json({ message: 'Not found' });
    const logDate = date || new Date().toISOString().split('T')[0];
    await run('DELETE FROM habit_logs WHERE habit_id = ? AND date = ?', [habitId, logDate]);
    res.json({ message: 'Deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal error' });
  }
});

// ===== TASK SUBTASKS CRUD (table-based) =====
app.post('/api/tasks/:id/subtasks', authMiddleware, validateId, handleValidationErrors, async (req, res) => {
  const taskId = parseInt(req.params.id, 10);
  const { text } = req.body;
  try {
    const task = await get('SELECT * FROM tasks WHERE id = ? AND user_id = ?', [taskId, req.user.id]);
    if (!task) return res.status(404).json({ message: 'Not found' });
    const maxOrder = await get('SELECT COALESCE(MAX(sort_order), -1) as max_order FROM task_subtasks WHERE task_id = ?', [taskId]);
    const result = await run('INSERT INTO task_subtasks (task_id, text, sort_order) VALUES (?, ?, ?) RETURNING id',
      [taskId, text, (maxOrder?.max_order ?? -1) + 1]);
    const subtask = await get('SELECT * FROM task_subtasks WHERE id = ?', [result.lastID]);
    res.json({ subtask });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal error' });
  }
});

app.patch('/api/subtasks/:id/toggle', authMiddleware, validateId, handleValidationErrors, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  try {
    const sub = await get('SELECT ts.*, t.user_id FROM task_subtasks ts JOIN tasks t ON ts.task_id = t.id WHERE ts.id = ?', [id]);
    if (!sub || sub.user_id !== req.user.id) return res.status(404).json({ message: 'Not found' });
    await run('UPDATE task_subtasks SET completed = ? WHERE id = ?', [!sub.completed, id]);
    const updated = await get('SELECT * FROM task_subtasks WHERE id = ?', [id]);
    res.json({ subtask: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal error' });
  }
});

app.delete('/api/subtasks/:id', authMiddleware, validateId, handleValidationErrors, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  try {
    const sub = await get('SELECT ts.*, t.user_id FROM task_subtasks ts JOIN tasks t ON ts.task_id = t.id WHERE ts.id = ?', [id]);
    if (!sub || sub.user_id !== req.user.id) return res.status(404).json({ message: 'Not found' });
    await run('DELETE FROM task_subtasks WHERE id = ?', [id]);
    res.json({ message: 'Deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal error' });
  }
});

// ===== BUDGETS CRUD =====
app.get('/api/budgets', authMiddleware, async (req, res) => {
  try {
    const { month, year } = req.query;
    let sql = 'SELECT * FROM budgets WHERE user_id = ?';
    const params = [req.user.id];
    if (month && year) {
      sql += ' AND month = ? AND year = ?';
      params.push(parseInt(month), parseInt(year));
    }
    sql += ' ORDER BY category ASC';
    const rows = await all(sql, params);
    res.json({ budgets: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal error' });
  }
});

app.post('/api/budgets', authMiddleware, [
  body('category').isLength({ min: 1, max: 100 }).trim().escape(),
  body('amount').isFloat({ min: 0 }).toFloat(),
  body('month').isInt({ min: 1, max: 12 }).toInt(),
  body('year').isInt({ min: 2020, max: 2100 }).toInt(),
], handleValidationErrors, async (req, res) => {
  const { category, amount, month, year } = req.body;
  try {
    const existing = await get('SELECT * FROM budgets WHERE user_id = ? AND category = ? AND month = ? AND year = ?', [req.user.id, category, month, year]);
    if (existing) {
      await run('UPDATE budgets SET amount = ? WHERE id = ?', [amount, existing.id]);
      const updated = await get('SELECT * FROM budgets WHERE id = ?', [existing.id]);
      return res.json({ budget: updated });
    }
    const result = await run('INSERT INTO budgets (user_id, category, amount, month, year) VALUES (?, ?, ?, ?, ?) RETURNING id',
      [req.user.id, category, amount, month, year]);
    const budget = await get('SELECT * FROM budgets WHERE id = ?', [result.lastID]);
    res.json({ budget });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal error' });
  }
});

app.delete('/api/budgets/:id', authMiddleware, validateId, handleValidationErrors, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  try {
    const item = await get('SELECT * FROM budgets WHERE id = ? AND user_id = ?', [id, req.user.id]);
    if (!item) return res.status(404).json({ message: 'Not found' });
    await run('DELETE FROM budgets WHERE id = ?', [id]);
    res.json({ message: 'Deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal error' });
  }
});

// ===== GOALS CRUD =====
app.get('/api/goals', authMiddleware, async (req, res) => {
  try {
    const goals = await all('SELECT * FROM goals WHERE user_id = ? ORDER BY created_at DESC', [req.user.id]);
    res.json({ goals });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal error' });
  }
});

app.post('/api/goals', authMiddleware, [
  body('title').isLength({ min: 1, max: 300 }).trim().escape(),
  body('description').optional().isLength({ max: 2000 }).trim(),
  body('life_area').optional().isLength({ max: 30 }).trim().escape(),
  body('progress').optional().isInt({ min: 0, max: 100 }).toInt(),
], handleValidationErrors, async (req, res) => {
  const { title, description, life_area, target_date, progress } = req.body;
  try {
    const result = await run('INSERT INTO goals (user_id, title, description, life_area, target_date, progress) VALUES (?, ?, ?, ?, ?, ?) RETURNING id',
      [req.user.id, title, description || '', life_area || '', target_date || null, progress || 0]);
    const goal = await get('SELECT * FROM goals WHERE id = ?', [result.lastID]);
    res.json({ goal });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal error' });
  }
});

app.put('/api/goals/:id', authMiddleware, validateId, [
  body('title').optional().isLength({ min: 1, max: 300 }).trim().escape(),
  body('progress').optional().isInt({ min: 0, max: 100 }).toInt(),
  body('status').optional().isIn(['active', 'completed', 'paused']),
], handleValidationErrors, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { title, description, life_area, target_date, progress, status } = req.body;
  try {
    const goal = await get('SELECT * FROM goals WHERE id = ? AND user_id = ?', [id, req.user.id]);
    if (!goal) return res.status(404).json({ message: 'Not found' });
    await run('UPDATE goals SET title = ?, description = ?, life_area = ?, target_date = ?, progress = ?, status = ? WHERE id = ?',
      [title || goal.title, description ?? goal.description, life_area ?? goal.life_area, target_date ?? goal.target_date, progress ?? goal.progress, status || goal.status, id]);
    const updated = await get('SELECT * FROM goals WHERE id = ?', [id]);
    res.json({ goal: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal error' });
  }
});

app.delete('/api/goals/:id', authMiddleware, validateId, handleValidationErrors, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  try {
    const goal = await get('SELECT * FROM goals WHERE id = ? AND user_id = ?', [id, req.user.id]);
    if (!goal) return res.status(404).json({ message: 'Not found' });
    await run('DELETE FROM goals WHERE id = ?', [id]);
    res.json({ message: 'Deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal error' });
  }
});

// ===== ANALYTICS ENDPOINT =====
app.get('/api/analytics', authMiddleware, async (req, res) => {
  try {
    // Productivity analytics
    const totalTasks = await get('SELECT COUNT(*) as count FROM tasks WHERE user_id = ?', [req.user.id]);
    const completedTasks = await get('SELECT COUNT(*) as count FROM tasks WHERE user_id = ? AND completed = true', [req.user.id]);
    const tasksByArea = await all('SELECT life_area, COUNT(*) as count, SUM(CASE WHEN completed = true THEN 1 ELSE 0 END) as done FROM tasks WHERE user_id = ? AND life_area != \'\' GROUP BY life_area', [req.user.id]);
    const tasksByDay = await all('SELECT EXTRACT(DOW FROM completed_at) as dow, COUNT(*) as count FROM tasks WHERE user_id = ? AND completed = true AND completed_at IS NOT NULL GROUP BY dow ORDER BY count DESC', [req.user.id]);
    
    // Financial analytics (current month)
    const now = new Date();
    const monthIncome = await get('SELECT COALESCE(SUM(amount), 0) as total FROM finances WHERE user_id = ? AND type = \'income\' AND EXTRACT(MONTH FROM date) = ? AND EXTRACT(YEAR FROM date) = ?', [req.user.id, now.getMonth() + 1, now.getFullYear()]);
    const monthExpense = await get('SELECT COALESCE(SUM(amount), 0) as total FROM finances WHERE user_id = ? AND type = \'expense\' AND EXTRACT(MONTH FROM date) = ? AND EXTRACT(YEAR FROM date) = ?', [req.user.id, now.getMonth() + 1, now.getFullYear()]);
    const topCategory = await get('SELECT category, SUM(amount) as total FROM finances WHERE user_id = ? AND type = \'expense\' AND EXTRACT(MONTH FROM date) = ? AND EXTRACT(YEAR FROM date) = ? GROUP BY category ORDER BY total DESC LIMIT 1', [req.user.id, now.getMonth() + 1, now.getFullYear()]);
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    
    // Emotional analytics
    const moodCounts = await all('SELECT mood, COUNT(*) as count FROM thoughts WHERE user_id = ? AND mood IS NOT NULL GROUP BY mood ORDER BY count DESC', [req.user.id]);
    const avgMetrics = await get('SELECT AVG(energy) as avg_energy, AVG(stress) as avg_stress, AVG(clarity) as avg_clarity FROM thoughts WHERE user_id = ? AND (energy > 0 OR stress > 0 OR clarity > 0)', [req.user.id]);
    const moodByDay = await all('SELECT EXTRACT(DOW FROM date) as dow, mood, COUNT(*) as count FROM thoughts WHERE user_id = ? AND mood IS NOT NULL GROUP BY dow, mood ORDER BY dow', [req.user.id]);
    
    // Gratitude streak
    const gratDates = await all('SELECT DISTINCT date::date as d FROM gratitude WHERE user_id = ? ORDER BY d DESC LIMIT 60', [req.user.id]);
    
    const income = parseFloat(monthIncome.total);
    const expense = parseFloat(monthExpense.total);
    
    res.json({
      analytics: {
        productivity: {
          total: parseInt(totalTasks.count),
          completed: parseInt(completedTasks.count),
          completionRate: totalTasks.count > 0 ? Math.round((completedTasks.count / totalTasks.count) * 100) : 0,
          byArea: tasksByArea,
          byDayOfWeek: tasksByDay
        },
        financial: {
          monthIncome: income,
          monthExpense: expense,
          balance: income - expense,
          savingsRate: income > 0 ? Math.round(((income - expense) / income) * 100) : 0,
          avgDailyExpense: Math.round((expense / Math.max(now.getDate(), 1)) * 100) / 100,
          topCategory: topCategory?.category || null,
          topCategoryAmount: topCategory ? parseFloat(topCategory.total) : 0,
          projectedBalance: income - (expense / Math.max(now.getDate(), 1)) * daysInMonth
        },
        emotional: {
          moodDistribution: moodCounts,
          avgEnergy: avgMetrics?.avg_energy ? Math.round(avgMetrics.avg_energy * 10) / 10 : 0,
          avgStress: avgMetrics?.avg_stress ? Math.round(avgMetrics.avg_stress * 10) / 10 : 0,
          avgClarity: avgMetrics?.avg_clarity ? Math.round(avgMetrics.avg_clarity * 10) / 10 : 0,
          moodByDay: moodByDay
        },
        gratitude: {
          dates: gratDates.map(d => d.d)
        }
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal error' });
  }
});

app.post('/api/analytics/snapshot', authMiddleware, async (req, res) => {
  const { type, data, period_start, period_end } = req.body;
  try {
    const result = await run('INSERT INTO analytics_snapshots (user_id, type, data, period_start, period_end) VALUES (?, ?, ?, ?, ?) RETURNING id',
      [req.user.id, type, JSON.stringify(data || {}), period_start || null, period_end || null]);
    const snapshot = await get('SELECT * FROM analytics_snapshots WHERE id = ?', [result.lastID]);
    res.json({ snapshot });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal error' });
  }
});

app.get('/api/analytics/snapshots', authMiddleware, async (req, res) => {
  try {
    const { type } = req.query;
    let sql = 'SELECT * FROM analytics_snapshots WHERE user_id = ?';
    const params = [req.user.id];
    if (type) { sql += ' AND type = ?'; params.push(type); }
    sql += ' ORDER BY created_at DESC LIMIT 30';
    const rows = await all(sql, params);
    res.json({ snapshots: rows });
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
