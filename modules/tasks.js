class TaskManager {
    constructor(authManager) {
        this.auth = authManager;
        this.tasks = [];
        this.currentFilter = 'all';
        this.searchQuery = '';
        this.expandedTaskId = null;
        this.editingTaskId = null;
        this.modalSubtasks = [];
        this.viewMode = 'list'; // 'list' | 'kanban'
        this.gamification = { points: 0, streak: 0, level: 1, badges: [] };
        this.activeTimers = {}; // taskId -> { startedAt, intervalId }
        this.insights = [];
    }

    init() {
        this.loadGamification();
        this.loadInsights();
        this.renderAll();
    }

    setupEventListeners() {
        // New task button
        const newBtn = document.getElementById('pm-new-task-btn');
        if (newBtn) newBtn.addEventListener('click', () => this.openCreateModal());

        // Modal form
        const form = document.getElementById('pm-task-form');
        if (form) form.addEventListener('submit', (e) => { e.preventDefault(); this.saveTaskFromModal(); });

        // Modal subtask
        const addSubBtn = document.getElementById('pm-modal-add-subtask');
        if (addSubBtn) addSubBtn.addEventListener('click', () => this.addModalSubtask());

        // Modal close
        const closeBtn = document.getElementById('pm-modal-close');
        if (closeBtn) closeBtn.addEventListener('click', () => this.closeTaskModal());
        const cancelBtn = document.getElementById('pm-modal-cancel');
        if (cancelBtn) cancelBtn.addEventListener('click', () => this.closeTaskModal());

        const overlay = document.getElementById('pm-task-modal-overlay');
        if (overlay) overlay.addEventListener('click', (e) => { if (e.target === overlay) this.closeTaskModal(); });

        // Search
        const searchInput = document.getElementById('pm-search');
        if (searchInput) searchInput.addEventListener('input', (e) => { this.searchQuery = (e.target.value || '').trim().toLowerCase(); this.renderCurrentView(); });

        // Filters
        document.querySelectorAll('.pm-filter-chip').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.pm-filter-chip').forEach((chip) => chip.classList.remove('active'));
                e.currentTarget.classList.add('active');
                this.currentFilter = e.currentTarget.dataset.filter || 'all';
                this.renderCurrentView();
            });
        });

        // View toggle
        const listBtn = document.getElementById('pm-view-list');
        const kanbanBtn = document.getElementById('pm-view-kanban');
        if (listBtn) listBtn.addEventListener('click', () => this.setViewMode('list'));
        if (kanbanBtn) kanbanBtn.addEventListener('click', () => this.setViewMode('kanban'));

        // Escape to close modal
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape') this.closeTaskModal(); });
    }

    setViewMode(mode) {
        this.viewMode = mode;
        document.querySelectorAll('.pm-view-btn').forEach(b => b.classList.remove('active'));
        document.getElementById(`pm-view-${mode}`)?.classList.add('active');
        this.renderCurrentView();
    }

    renderCurrentView() {
        if (this.viewMode === 'kanban') {
            document.getElementById('pm-task-list')?.classList.add('hidden');
            document.getElementById('pm-kanban-board')?.classList.remove('hidden');
            this.renderKanban();
        } else {
            document.getElementById('pm-kanban-board')?.classList.add('hidden');
            document.getElementById('pm-task-list')?.classList.remove('hidden');
            this.renderTasks();
        }
    }

    renderAll() {
        this.renderStats();
        this.renderGamification();
        this.renderInsights();
        this.renderCurrentView();
    }

    // ===== STATS =====
    renderStats() {
        const total = this.tasks.length;
        const done = this.tasks.filter(t => t.status === 'done' || t.completed).length;
        const inProgress = this.tasks.filter(t => t.status === 'in_progress').length;
        const pending = total - done - inProgress;
        const today = new Date().toISOString().split('T')[0];
        const overdue = this.tasks.filter(t => t.dueDate && t.dueDate < today && t.status !== 'done').length;

        this._setEl('pm-stat-total', total);
        this._setEl('pm-stat-pending', pending);
        this._setEl('pm-stat-progress', inProgress);
        this._setEl('pm-stat-done', done);
        this._setEl('pm-stat-overdue', overdue);
    }

    // ===== GAMIFICATION =====
    async loadGamification() {
        if (!this.auth.getToken()) return;
        try {
            const resp = await this.auth.apiRequest('/api/gamification', { method: 'GET' });
            this.gamification = resp;
            this.renderGamification();
        } catch (err) { console.warn('Erro ao carregar gamificacao:', err); }
    }

    renderGamification() {
        const container = document.getElementById('pm-gamification');
        if (!container) return;
        const g = this.gamification;
        container.innerHTML = `
            <div class="pm-gami-stats">
                <div class="pm-gami-item pm-gami-level">
                    <span class="pm-gami-value">${g.level || 1}</span>
                    <span class="pm-gami-label">Nivel</span>
                </div>
                <div class="pm-gami-item pm-gami-points">
                    <span class="pm-gami-value">${g.points || 0}</span>
                    <span class="pm-gami-label">Pontos</span>
                </div>
                <div class="pm-gami-item pm-gami-streak">
                    <i class="fas fa-fire"></i>
                    <span class="pm-gami-value">${g.streak || 0}</span>
                    <span class="pm-gami-label">Streak</span>
                </div>
            </div>
            <div class="pm-gami-badges">
                ${(g.badges || []).slice(0, 5).map(b => `<span class="pm-badge-icon" title="${b.name}: ${b.description}"><i class="fas ${b.icon}"></i></span>`).join('')}
                ${(g.badges || []).length > 5 ? `<span class="pm-badge-more">+${g.badges.length - 5}</span>` : ''}
            </div>
        `;
    }

    // ===== AI INSIGHTS =====
    async loadInsights() {
        if (!this.auth.getToken()) return;
        try {
            const resp = await this.auth.apiRequest('/api/tasks/ai-insights', { method: 'GET' });
            this.insights = resp.insights || [];
            this.renderInsights();
        } catch (err) { console.warn('Erro ao carregar insights:', err); }
    }

    renderInsights() {
        const container = document.getElementById('pm-insights');
        if (!container) return;
        if (!this.insights.length) {
            container.innerHTML = '<p class="pm-insights-empty">Complete mais tarefas para ver insights de IA.</p>';
            return;
        }
        container.innerHTML = this.insights.map(i => `
            <div class="pm-insight-card pm-insight-${i.type}">
                <div class="pm-insight-icon"><i class="fas ${i.icon}"></i></div>
                <div class="pm-insight-content">
                    <strong>${i.title}</strong>
                    <p>${i.text}</p>
                </div>
            </div>
        `).join('');
    }

    // ===== LIST VIEW =====
    renderTasks() {
        const list = document.getElementById('pm-task-list');
        if (!list) return;
        const tasks = this._getFilteredTasks();
        this._setEl('pm-count', tasks.length);

        if (!tasks.length) {
            list.innerHTML = `<div class="pm-empty"><div class="pm-empty-icon"><i class="fas fa-clipboard-list"></i></div><p class="pm-empty-title">Nenhuma tarefa encontrada</p><p class="pm-empty-sub">Crie uma nova tarefa no botao "Nova Tarefa".</p></div>`;
            return;
        }
        list.innerHTML = tasks.map(t => this._renderTaskCard(t)).join('');
        this._setupDragAndDrop();
    }

    // ===== KANBAN VIEW =====
    renderKanban() {
        const board = document.getElementById('pm-kanban-board');
        if (!board) return;
        const tasks = this._getFilteredTasks();

        const columns = [
            { id: 'todo', label: 'A Fazer', icon: 'fa-circle', tasks: tasks.filter(t => t.status === 'todo') },
            { id: 'in_progress', label: 'Em Andamento', icon: 'fa-spinner', tasks: tasks.filter(t => t.status === 'in_progress') },
            { id: 'done', label: 'Concluída', icon: 'fa-check-circle', tasks: tasks.filter(t => t.status === 'done') }
        ];

        board.innerHTML = columns.map(col => `
            <div class="pm-kanban-col" data-status="${col.id}">
                <div class="pm-kanban-col-header">
                    <i class="fas ${col.icon}"></i> ${col.label}
                    <span class="pm-kanban-count">${col.tasks.length}</span>
                </div>
                <div class="pm-kanban-col-body" data-status="${col.id}">
                    ${col.tasks.map(t => this._renderKanbanCard(t)).join('')}
                </div>
            </div>
        `).join('');

        this._setupKanbanDrop();
    }

    _renderKanbanCard(task) {
        const progress = this._calcTaskProgress(task);
        const priorityClass = task.priority || 'low';
        const timerActive = !!this.activeTimers[task.id];
        return `
            <div class="pm-kanban-card" draggable="true" data-id="${task.id}">
                <div class="pm-kanban-card-head">
                    <span class="pm-badge pm-badge-priority ${priorityClass}">${this._priorityLabel(task.priority)}</span>
                    ${task.category ? `<span class="pm-badge pm-badge-category">${this._esc(task.category)}</span>` : ''}
                </div>
                <h5 class="pm-kanban-card-title">${this._esc(task.text)}</h5>
                ${progress > 0 ? `<div class="pm-progress-row"><div class="pm-progress-track"><div class="pm-progress-fill" style="width:${progress}%"></div></div><span class="pm-progress-label">${progress}%</span></div>` : ''}
                <div class="pm-kanban-card-foot">
                    ${task.dueDate ? `<span><i class="fas fa-calendar"></i> ${this._formatDueShort(task.dueDate)}</span>` : ''}
                    <div class="pm-kanban-card-actions">
                        <button class="pm-icon-btn-sm ${timerActive ? 'active' : ''}" onclick="window.app.taskManager.toggleTimer(${task.id})" title="Timer"><i class="fas ${timerActive ? 'fa-stop' : 'fa-play'}"></i></button>
                        <button class="pm-icon-btn-sm" onclick="window.app.taskManager.openEditModal(${task.id})" title="Editar"><i class="fas fa-pen"></i></button>
                    </div>
                </div>
            </div>
        `;
    }

    _setupKanbanDrop() {
        const cards = document.querySelectorAll('.pm-kanban-card');
        const cols = document.querySelectorAll('.pm-kanban-col-body');

        cards.forEach(card => {
            card.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', card.dataset.id);
                card.classList.add('dragging');
            });
            card.addEventListener('dragend', () => card.classList.remove('dragging'));
        });

        cols.forEach(col => {
            col.addEventListener('dragover', (e) => { e.preventDefault(); col.classList.add('drag-over'); });
            col.addEventListener('dragleave', () => col.classList.remove('drag-over'));
            col.addEventListener('drop', async (e) => {
                e.preventDefault();
                col.classList.remove('drag-over');
                const taskId = parseInt(e.dataTransfer.getData('text/plain'), 10);
                const newStatus = col.dataset.status;
                await this._updateTaskStatus(taskId, newStatus);
            });
        });
    }

    async _updateTaskStatus(taskId, newStatus) {
        const task = this.tasks.find(t => t.id === taskId);
        if (!task || task.status === newStatus) return;
        task.status = newStatus;
        task.completed = newStatus === 'done';

        try {
            if (this.auth.getToken()) {
                const resp = await this.auth.apiRequest(`/api/tasks/${taskId}`, {
                    method: 'PUT',
                    body: JSON.stringify({ status: newStatus })
                });
                if (resp.gamification?.earnedBadges?.length) {
                    this._showBadgeNotification(resp.gamification.earnedBadges);
                    this.loadGamification();
                }
            }
        } catch (err) { console.warn('Erro ao atualizar status:', err); }

        this.renderAll();
        this.saveData();
    }

    _showBadgeNotification(badges) {
        badges.forEach(b => {
            this.auth.showNotification(`Conquista: ${b.name}!`, 'success');
        });
    }

    // ===== TASK CARD (List) =====
    _renderTaskCard(task) {
        const progress = this._calcTaskProgress(task);
        const dueLabel = task.dueDate ? this._formatDue(task.dueDate, task.dueTime) : 'Sem prazo';
        const cat = task.category ? `<span class="pm-badge pm-badge-category">${this._esc(task.category)}</span>` : '';
        const tags = (task.tags || []).map(tag => `<span class="pm-tag">#${this._esc(tag)}</span>`).join('');
        const statusLabel = { todo: 'A Fazer', in_progress: 'Em Andamento', done: 'Concluída' }[task.status || 'todo'];
        const isExpanded = this.expandedTaskId === task.id;
        const subtasksHtml = (task.subtasks || []).map(s => `
            <label class="pm-subtask-item ${s.done ? 'done' : ''}">
                <input type="checkbox" ${s.done ? 'checked' : ''} onchange="window.app.taskManager.toggleTaskSubtask(${task.id}, ${s.id})" />
                <span>${this._esc(s.text)}</span>
            </label>
        `).join('');
        const timerActive = !!this.activeTimers[task.id];
        const timerDisplay = timerActive ? this._formatTimerDisplay(task.id) : '';

        return `
            <article class="pm-task-card ${task.status === 'done' ? 'is-done' : ''}" draggable="true" data-id="${task.id}">
                <div class="pm-task-head">
                    <div>
                        <h4 class="pm-task-title">${this._esc(task.text)}</h4>
                        <div class="pm-task-meta">${cat}<span class="pm-badge pm-badge-priority ${task.priority || 'low'}">${this._priorityLabel(task.priority)}</span><span class="pm-badge pm-badge-status">${statusLabel}</span></div>
                    </div>
                    <div class="pm-task-actions">
                        <button class="pm-icon-btn ${timerActive ? 'active' : ''}" onclick="window.app.taskManager.toggleTimer(${task.id})" title="Timer"><i class="fas ${timerActive ? 'fa-stop' : 'fa-play'}"></i>${timerDisplay ? `<span class="pm-timer-display">${timerDisplay}</span>` : ''}</button>
                        <button class="pm-icon-btn" onclick="window.app.taskManager.toggleExpandTask(${task.id})" title="Subtarefas"><i class="fas fa-list-check"></i></button>
                        <button class="pm-icon-btn" onclick="window.app.taskManager.openEditModal(${task.id})" title="Editar"><i class="fas fa-pen"></i></button>
                        <button class="pm-icon-btn danger" onclick="window.app.taskManager.deleteTask(${task.id})" title="Excluir"><i class="fas fa-trash"></i></button>
                    </div>
                </div>
                ${task.notes ? `<p class="pm-task-desc">${this._esc(task.notes)}</p>` : ''}
                <div class="pm-task-foot">
                    <span class="pm-foot-item"><i class="fas fa-calendar"></i> ${dueLabel}</span>
                    ${task.estimatedMinutes > 0 ? `<span class="pm-foot-item"><i class="fas fa-hourglass-half"></i> ${task.estimatedMinutes} min</span>` : ''}
                    ${task.reminderAt ? `<span class="pm-foot-item"><i class="fas fa-bell"></i> ${this._formatReminder(task.reminderAt)}</span>` : ''}
                    ${task.dependsOn?.length ? `<span class="pm-foot-item pm-dep"><i class="fas fa-link"></i> ${task.dependsOn.length} dep</span>` : ''}
                </div>
                ${tags ? `<div class="pm-tags">${tags}</div>` : ''}
                <div class="pm-progress-row"><div class="pm-progress-track"><div class="pm-progress-fill" style="width:${progress}%"></div></div><span class="pm-progress-label">${progress}%</span></div>
                ${isExpanded ? `<div class="pm-subtasks-panel">${subtasksHtml || '<p class="pm-subtask-empty">Sem subtarefas.</p>'}</div>` : ''}
            </article>
        `;
    }

    _setupDragAndDrop() {
        const cards = document.querySelectorAll('.pm-task-card[draggable]');
        cards.forEach(card => {
            card.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/plain', card.dataset.id); card.classList.add('dragging'); });
            card.addEventListener('dragend', () => card.classList.remove('dragging'));
        });
    }

    // ===== TIME TRACKING =====
    async toggleTimer(taskId) {
        if (this.activeTimers[taskId]) {
            await this.stopTimer(taskId);
        } else {
            await this.startTimer(taskId);
        }
    }

    async startTimer(taskId) {
        try {
            if (this.auth.getToken()) {
                await this.auth.apiRequest(`/api/tasks/${taskId}/timer/start`, { method: 'POST' });
            }
            this.activeTimers[taskId] = {
                startedAt: Date.now(),
                intervalId: setInterval(() => this._updateTimerDisplay(taskId), 1000)
            };
            this.renderCurrentView();
        } catch (err) {
            this.auth.showNotification(err.message || 'Erro ao iniciar timer', 'error');
        }
    }

    async stopTimer(taskId) {
        const timer = this.activeTimers[taskId];
        if (!timer) return;
        clearInterval(timer.intervalId);
        delete this.activeTimers[taskId];

        try {
            if (this.auth.getToken()) {
                await this.auth.apiRequest(`/api/tasks/${taskId}/timer/stop`, { method: 'POST' });
            }
        } catch (err) { console.warn('Erro ao parar timer:', err); }

        this.renderCurrentView();
    }

    _updateTimerDisplay(taskId) {
        const el = document.querySelector(`.pm-task-card[data-id="${taskId}"] .pm-timer-display, .pm-kanban-card[data-id="${taskId}"] .pm-timer-display`);
        if (el) el.textContent = this._formatTimerDisplay(taskId);
    }

    _formatTimerDisplay(taskId) {
        const timer = this.activeTimers[taskId];
        if (!timer) return '';
        const elapsed = Math.floor((Date.now() - timer.startedAt) / 1000);
        const mins = Math.floor(elapsed / 60);
        const secs = elapsed % 60;
        return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }

    // ===== FILTERING =====
    _getFilteredTasks() {
        let filtered = [...this.tasks];
        const today = new Date().toISOString().split('T')[0];

        if (this.currentFilter === 'pending') filtered = filtered.filter(t => t.status === 'todo');
        if (this.currentFilter === 'in_progress') filtered = filtered.filter(t => t.status === 'in_progress');
        if (this.currentFilter === 'done') filtered = filtered.filter(t => t.status === 'done');
        if (this.currentFilter === 'today') filtered = filtered.filter(t => t.dueDate === today);
        if (this.currentFilter === 'overdue') filtered = filtered.filter(t => t.dueDate && t.dueDate < today && t.status !== 'done');

        if (this.searchQuery) {
            filtered = filtered.filter(t => {
                const inTags = (t.tags || []).some(tag => tag.toLowerCase().includes(this.searchQuery));
                return t.text.toLowerCase().includes(this.searchQuery) || (t.notes || '').toLowerCase().includes(this.searchQuery) || (t.category || '').toLowerCase().includes(this.searchQuery) || inTags;
            });
        }

        filtered.sort((a, b) => {
            const statusOrder = { in_progress: 0, todo: 1, done: 2 };
            if ((statusOrder[a.status] ?? 1) !== (statusOrder[b.status] ?? 1)) return (statusOrder[a.status] ?? 1) - (statusOrder[b.status] ?? 1);
            const prio = { high: 3, medium: 2, low: 1 };
            if ((prio[b.priority] ?? 1) !== (prio[a.priority] ?? 1)) return (prio[b.priority] ?? 1) - (prio[a.priority] ?? 1);
            if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
            if (a.dueDate) return -1;
            if (b.dueDate) return 1;
            return 0;
        });
        return filtered;
    }

    // ===== MODAL =====
    openCreateModal() {
        this.editingTaskId = null;
        this.modalSubtasks = [];
        this._fillModalForm({ text: '', category: '', notes: '', priority: 'medium', status: 'todo', dueDate: '', dueTime: '', estimatedMinutes: '', tags: [], reminderAt: null });
        this._setEl('pm-modal-title', 'Nova Tarefa');
        this._openModal();
    }

    openEditModal(id) {
        const task = this.tasks.find(t => t.id === id);
        if (!task) return;
        this.editingTaskId = id;
        this.modalSubtasks = [...(task.subtasks || [])].map(s => ({ ...s }));
        this._fillModalForm(task);
        this._setEl('pm-modal-title', 'Editar Tarefa');
        this._openModal();
    }

    _fillModalForm(task) {
        const setValue = (id, value) => { const el = document.getElementById(id); if (el) el.value = value || ''; };
        setValue('pm-task-title-input', task.text || '');
        setValue('pm-task-category-input', task.category || '');
        setValue('pm-task-desc-input', task.notes || '');
        setValue('pm-task-priority-input', task.priority || 'medium');
        setValue('pm-task-status-input', task.status || 'todo');
        setValue('pm-task-due-date-input', task.dueDate || '');
        setValue('pm-task-due-time-input', task.dueTime || '');
        setValue('pm-task-estimate-input', task.estimatedMinutes || '');
        setValue('pm-task-tags-input', (task.tags || []).join(', '));
        setValue('pm-task-reminder-input', this._toLocalDateTime(task.reminderAt));
        setValue('pm-modal-subtask-input', '');
        this.renderModalSubtasks();
    }

    _openModal() {
        const overlay = document.getElementById('pm-task-modal-overlay');
        if (!overlay) return;
        overlay.style.display = 'flex';
        document.body.classList.add('pm-modal-open');
        setTimeout(() => document.getElementById('pm-task-title-input')?.focus(), 30);
    }

    closeTaskModal() {
        const overlay = document.getElementById('pm-task-modal-overlay');
        if (overlay) overlay.style.display = 'none';
        document.body.classList.remove('pm-modal-open');
        this.editingTaskId = null;
        this.modalSubtasks = [];
    }

    addModalSubtask() {
        const input = document.getElementById('pm-modal-subtask-input');
        const text = (input?.value || '').trim();
        if (!text) return;
        this.modalSubtasks.push({ id: Date.now() + Math.floor(Math.random() * 1000), text, done: false });
        if (input) input.value = '';
        this.renderModalSubtasks();
    }

    toggleModalSubtask(idx) {
        if (!this.modalSubtasks[idx]) return;
        this.modalSubtasks[idx].done = !this.modalSubtasks[idx].done;
        this.renderModalSubtasks();
    }

    removeModalSubtask(idx) {
        this.modalSubtasks.splice(idx, 1);
        this.renderModalSubtasks();
    }

    renderModalSubtasks() {
        const container = document.getElementById('pm-modal-subtasks-list');
        if (!container) return;
        if (!this.modalSubtasks.length) {
            container.innerHTML = '<p class="pm-modal-sub-empty">Nenhuma subtarefa adicionada.</p>';
        } else {
            container.innerHTML = this.modalSubtasks.map((s, idx) => `
                <div class="pm-modal-sub-item ${s.done ? 'done' : ''}">
                    <label><input type="checkbox" ${s.done ? 'checked' : ''} onchange="window.app.taskManager.toggleModalSubtask(${idx})" /><span>${this._esc(s.text)}</span></label>
                    <button type="button" onclick="window.app.taskManager.removeModalSubtask(${idx})"><i class="fas fa-times"></i></button>
                </div>
            `).join('');
        }
        const progress = this._calcSubtasksProgress(this.modalSubtasks);
        const fill = document.getElementById('pm-modal-progress-fill');
        const label = document.getElementById('pm-modal-progress-label');
        if (fill) fill.style.width = `${progress}%`;
        if (label) label.textContent = `${progress}%`;
    }

    async saveTaskFromModal() {
        const text = (document.getElementById('pm-task-title-input')?.value || '').trim();
        if (!text) { this.auth.showNotification('Título da tarefa é obrigatório.', 'warning'); return; }

        const payload = {
            text,
            category: (document.getElementById('pm-task-category-input')?.value || '').trim(),
            notes: (document.getElementById('pm-task-desc-input')?.value || '').trim(),
            priority: document.getElementById('pm-task-priority-input')?.value || 'medium',
            status: document.getElementById('pm-task-status-input')?.value || 'todo',
            due_date: document.getElementById('pm-task-due-date-input')?.value || null,
            due_time: document.getElementById('pm-task-due-time-input')?.value || '',
            estimated_minutes: parseInt(document.getElementById('pm-task-estimate-input')?.value || '0', 10) || 0,
            tags: this._parseTags(document.getElementById('pm-task-tags-input')?.value || ''),
            reminder_at: this._fromLocalDateTime(document.getElementById('pm-task-reminder-input')?.value || ''),
            subtasks: this.modalSubtasks.map(s => ({ text: s.text, done: !!s.done }))
        };

        try {
            if (this.auth.getToken()) {
                if (this.editingTaskId) {
                    const resp = await this.auth.apiRequest(`/api/tasks/${this.editingTaskId}`, { method: 'PUT', body: JSON.stringify(payload) });
                    const idx = this.tasks.findIndex(t => t.id === this.editingTaskId);
                    if (idx >= 0) this.tasks[idx] = this._mapServerTask(resp.task);
                    if (resp.gamification?.earnedBadges?.length) { this._showBadgeNotification(resp.gamification.earnedBadges); this.loadGamification(); }
                } else {
                    const resp = await this.auth.apiRequest('/api/tasks', { method: 'POST', body: JSON.stringify(payload) });
                    this.tasks.unshift(this._mapServerTask(resp.task));
                }
            } else {
                const localTask = { id: this.editingTaskId || Date.now(), text: payload.text, category: payload.category, notes: payload.notes, priority: payload.priority, status: payload.status, dueDate: payload.due_date, dueTime: payload.due_time, estimatedMinutes: payload.estimated_minutes, tags: payload.tags, reminderAt: payload.reminder_at, completed: payload.status === 'done', subtasks: this.modalSubtasks.map(s => ({ id: s.id, text: s.text, done: s.done })), createdAt: new Date().toISOString(), completedAt: payload.status === 'done' ? new Date().toISOString() : null };
                if (this.editingTaskId) { const idx = this.tasks.findIndex(t => t.id === this.editingTaskId); if (idx >= 0) this.tasks[idx] = localTask; } else { this.tasks.unshift(localTask); }
            }
            this.closeTaskModal();
            this.renderAll();
            this.saveData();
            this.auth.showNotification(this.editingTaskId ? 'Tarefa atualizada!' : 'Tarefa criada!', 'success');
        } catch (err) { this.auth.showNotification(err.message || 'Erro ao salvar tarefa', 'error'); }
    }

    // ===== SUBTASK TOGGLE =====
    async toggleTaskSubtask(taskId, subtaskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (!task) return;
        const sub = (task.subtasks || []).find(s => s.id === subtaskId);
        if (!sub) return;
        sub.done = !sub.done;

        if ((task.subtasks || []).length > 0) {
            const progress = this._calcTaskProgress(task);
            if (progress === 100) { task.status = 'done'; task.completed = true; task.completedAt = task.completedAt || new Date().toISOString(); }
            else if (progress > 0 && task.status === 'todo') { task.status = 'in_progress'; task.completed = false; }
            else if (progress === 0 && task.status === 'done') { task.status = 'todo'; task.completed = false; task.completedAt = null; }
        }

        try {
            if (this.auth.getToken() && Number.isInteger(task.id)) {
                const resp = await this.auth.apiRequest(`/api/tasks/${task.id}`, { method: 'PUT', body: JSON.stringify(this._toServerTask(task)) });
                if (resp.gamification?.earnedBadges?.length) { this._showBadgeNotification(resp.gamification.earnedBadges); this.loadGamification(); }
            }
        } catch (err) { console.warn('Falha ao sincronizar subtarefa:', err); }

        this.renderAll();
        this.saveData();
    }

    toggleExpandTask(id) { this.expandedTaskId = this.expandedTaskId === id ? null : id; this.renderTasks(); }

    async deleteTask(id) {
        if (!confirm('Deseja excluir esta tarefa?')) return;
        try {
            if (this.auth.getToken() && Number.isInteger(id)) await this.auth.apiRequest(`/api/tasks/${id}`, { method: 'DELETE' });
            this.tasks = this.tasks.filter(t => t.id !== id);
            if (this.expandedTaskId === id) this.expandedTaskId = null;
            if (this.activeTimers[id]) { clearInterval(this.activeTimers[id].intervalId); delete this.activeTimers[id]; }
            this.renderAll();
            this.saveData();
            this.auth.showNotification('Tarefa removida.', 'info');
        } catch (err) { this.auth.showNotification(err.message || 'Erro ao excluir tarefa', 'error'); }
    }

    // ===== HELPERS =====
    _calcTaskProgress(task) { return this._calcSubtasksProgress(task.subtasks || []); }
    _calcSubtasksProgress(subtasks) { const total = subtasks.length; if (!total) return 0; const done = subtasks.filter(s => s.done).length; return Math.round((done / total) * 100); }
    _formatDue(date, time) { if (!date) return 'Sem prazo'; const dateStr = String(date).split('T')[0]; const d = new Date(`${dateStr}T12:00:00`); if (isNaN(d.getTime())) return 'Sem prazo'; const dateLabel = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }); return time ? `${dateLabel} às ${time}` : dateLabel; }
    _formatDueShort(date) { if (!date) return ''; const dateStr = String(date).split('T')[0]; const d = new Date(`${dateStr}T12:00:00`); if (isNaN(d.getTime())) return ''; return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }); }
    _formatReminder(iso) { if (!iso) return ''; const d = new Date(iso); return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); }
    _parseTags(raw) { return raw.split(',').map(x => x.trim()).filter(Boolean).slice(0, 12); }
    _priorityLabel(p) { return { high: 'Alta', medium: 'Média', low: 'Baixa' }[p] || 'Baixa'; }
    _toLocalDateTime(iso) { if (!iso) return ''; const d = new Date(iso); if (Number.isNaN(d.getTime())) return ''; const pad = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`; }
    _fromLocalDateTime(value) { if (!value) return null; const d = new Date(value); if (Number.isNaN(d.getTime())) return null; return d.toISOString(); }
    _esc(str) { return window.DomusUtils ? DomusUtils.escapeHTML(str) : (str || '').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
    _setEl(id, value) { const el = document.getElementById(id); if (el) el.textContent = value; }

    _mapServerTask(t) {
        let subtasks = [];
        if (Array.isArray(t.subtask_items) && t.subtask_items.length > 0) subtasks = t.subtask_items.map(s => ({ id: s.id, text: s.text, done: !!s.completed }));
        else { try { const raw = typeof t.subtasks === 'string' ? JSON.parse(t.subtasks) : (t.subtasks || []); subtasks = raw.map(s => ({ id: s.id || Date.now(), text: s.text || String(s), done: !!s.done || !!s.completed })); } catch { subtasks = []; } }
        const tags = typeof t.tags === 'string' ? t.tags.split(',').map(x => x.trim()).filter(Boolean) : (Array.isArray(t.tags) ? t.tags : []);
        const dueDate = t.due_date ? String(t.due_date).split('T')[0] : null;
        return { id: t.id, text: t.text, category: t.category || '', notes: t.notes || '', priority: t.priority || 'low', status: t.status || 'todo', dueDate, dueTime: t.due_time || '', estimatedMinutes: t.estimated_minutes || 0, reminderAt: t.reminder_at || null, tags, subtasks, completed: !!(t.completed || t.status === 'done'), createdAt: t.created_at || new Date().toISOString(), completedAt: t.completed_at || null };
    }

    _toServerTask(task) {
        return { text: task.text, category: task.category || '', notes: task.notes || '', priority: task.priority || 'medium', status: task.status || 'todo', due_date: task.dueDate || null, due_time: task.dueTime || '', estimated_minutes: task.estimatedMinutes || 0, reminder_at: task.reminderAt || null, tags: task.tags || [], subtasks: (task.subtasks || []).map(s => ({ text: s.text, done: !!s.done })) };
    }

    async loadServerData() {
        if (!this.auth.getToken()) return;
        try {
            const resp = await this.auth.apiRequest('/api/tasks', { method: 'GET' });
            if (resp && Array.isArray(resp.tasks)) { this.tasks = resp.tasks.map(t => this._mapServerTask(t)); this.renderAll(); }
        } catch (err) { console.warn('Erro ao carregar tarefas:', err); }
    }

    saveData() { try { localStorage.setItem(this.auth.getStorageKey('tasks'), JSON.stringify({ tasks: this.tasks })); } catch (e) { console.warn('Falha ao salvar tarefas:', e); } }

    loadData() { try { const raw = localStorage.getItem(this.auth.getStorageKey('tasks')); if (!raw) return; const parsed = JSON.parse(raw); if (Array.isArray(parsed.tasks)) this.tasks = parsed.tasks; } catch (e) { console.warn('Erro localStorage tarefas:', e); } }

    static getTemplate() {
        return `
        <div class="pm-module">
            <div class="pm-topbar">
                <div>
                    <h3 class="pm-title"><i class="fas fa-list-check"></i> Tarefas</h3>
                    <p class="pm-subtitle">Gestão profissional com gamificação e inteligência artificial</p>
                </div>
                <button id="pm-new-task-btn" class="pm-primary-btn"><i class="fas fa-plus"></i> Nova Tarefa</button>
            </div>

            <div id="pm-gamification" class="pm-gamification"></div>

            <div class="pm-kpis">
                <div class="pm-kpi-card"><span>Total</span><strong id="pm-stat-total">0</strong></div>
                <div class="pm-kpi-card"><span>Pendentes</span><strong id="pm-stat-pending">0</strong></div>
                <div class="pm-kpi-card"><span>Em andamento</span><strong id="pm-stat-progress">0</strong></div>
                <div class="pm-kpi-card"><span>Concluídas</span><strong id="pm-stat-done">0</strong></div>
                <div class="pm-kpi-card"><span>Atrasadas</span><strong id="pm-stat-overdue">0</strong></div>
            </div>

            <div id="pm-insights" class="pm-insights"></div>

            <div class="pm-toolbar">
                <div class="pm-search-wrap"><i class="fas fa-search"></i><input id="pm-search" type="text" placeholder="Buscar tarefas..." /></div>
                <div class="pm-view-toggle">
                    <button class="pm-view-btn active" id="pm-view-list" title="Lista"><i class="fas fa-list"></i></button>
                    <button class="pm-view-btn" id="pm-view-kanban" title="Kanban"><i class="fas fa-columns"></i></button>
                </div>
                <div class="pm-filters">
                    <button class="pm-filter-chip active" data-filter="all">Todas <span id="pm-count">0</span></button>
                    <button class="pm-filter-chip" data-filter="pending">Pendentes</button>
                    <button class="pm-filter-chip" data-filter="in_progress">Em andamento</button>
                    <button class="pm-filter-chip" data-filter="done">Concluídas</button>
                    <button class="pm-filter-chip" data-filter="today">Hoje</button>
                    <button class="pm-filter-chip" data-filter="overdue">Atrasadas</button>
                </div>
            </div>

            <div id="pm-task-list" class="pm-task-list"></div>
            <div id="pm-kanban-board" class="pm-kanban-board hidden"></div>

            <div id="pm-task-modal-overlay" class="pm-modal-overlay" style="display:none;">
                <div class="pm-modal">
                    <div class="pm-modal-header"><h4 id="pm-modal-title">Nova Tarefa</h4><button type="button" id="pm-modal-close" class="pm-icon-btn"><i class="fas fa-times"></i></button></div>
                    <form id="pm-task-form" class="pm-modal-form" autocomplete="off">
                        <div class="pm-grid-2">
                            <label class="pm-field pm-field-full"><span>Titulo da tarefa *</span><input id="pm-task-title-input" type="text" maxlength="500" required /></label>
                            <label class="pm-field"><span>Categoria</span><input id="pm-task-category-input" type="text" maxlength="60" placeholder="Ex.: Trabalho" /></label>
                            <label class="pm-field"><span>Status</span><select id="pm-task-status-input"><option value="todo">A Fazer</option><option value="in_progress">Em Andamento</option><option value="done">Concluída</option></select></label>
                            <label class="pm-field"><span>Prioridade</span><select id="pm-task-priority-input"><option value="low">Baixa</option><option value="medium">Média</option><option value="high">Alta</option></select></label>
                            <label class="pm-field"><span>Data de vencimento</span><input id="pm-task-due-date-input" type="date" /></label>
                            <label class="pm-field"><span>Hora</span><input id="pm-task-due-time-input" type="time" /></label>
                            <label class="pm-field"><span>Tempo estimado (min)</span><input id="pm-task-estimate-input" type="number" min="0" max="9999" /></label>
                            <label class="pm-field"><span>Definir lembrete</span><input id="pm-task-reminder-input" type="datetime-local" /></label>
                            <label class="pm-field pm-field-full"><span>Tags (separadas por virgula)</span><input id="pm-task-tags-input" type="text" placeholder="cliente, sprint, urgente" /></label>
                            <label class="pm-field pm-field-full"><span>Descricao</span><textarea id="pm-task-desc-input" rows="3" maxlength="2000" placeholder="Detalhes da tarefa..."></textarea></label>
                        </div>
                        <div class="pm-modal-progress"><div class="pm-modal-progress-head"><span>Progresso (subtarefas)</span><strong id="pm-modal-progress-label">0%</strong></div><div class="pm-progress-track"><div id="pm-modal-progress-fill" class="pm-progress-fill" style="width:0%"></div></div></div>
                        <div class="pm-modal-subtasks"><div class="pm-modal-subtasks-head"><span>Subtarefas</span></div><div class="pm-modal-subtasks-add"><input id="pm-modal-subtask-input" type="text" placeholder="Adicionar subtarefa..." /><button type="button" id="pm-modal-add-subtask" class="pm-secondary-btn"><i class="fas fa-plus"></i> Adicionar</button></div><div id="pm-modal-subtasks-list" class="pm-modal-subtasks-list"></div></div>
                        <div class="pm-modal-actions"><button type="button" id="pm-modal-cancel" class="pm-secondary-btn">Cancelar</button><button type="submit" class="pm-primary-btn">Salvar tarefa</button></div>
                    </form>
                </div>
            </div>
        </div>
        `;
    }
}

window.TaskManager = TaskManager;
