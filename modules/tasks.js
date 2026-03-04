// Task Management Module — Professional Edition v2
class TaskManager {
    constructor(authManager) {
        this.auth = authManager;
        this.tasks = [];
        this.currentFilter = 'all';
        this.searchQuery = '';
        this.editingTaskId = null;
        this.draggedItem = null;
        this.viewMode = 'list'; // 'list' or 'kanban'
        this.pomodoroTaskId = null;
        this.pomodoroTime = 25 * 60;
        this.pomodoroRunning = false;
        this.pomodoroInterval = null;
        this.categories = [
            { id: 'trabalho', name: 'Trabalho', icon: 'fa-briefcase', color: '#3B82F6' },
            { id: 'pessoal', name: 'Pessoal', icon: 'fa-user', color: '#8B5CF6' },
            { id: 'saude', name: 'Saúde', icon: 'fa-heartbeat', color: '#EF4444' },
            { id: 'estudos', name: 'Estudos', icon: 'fa-graduation-cap', color: '#6366F1' },
            { id: 'casa', name: 'Casa', icon: 'fa-home', color: '#F59E0B' },
            { id: 'financas', name: 'Finanças', icon: 'fa-coins', color: '#10B981' },
            { id: 'outro', name: 'Outro', icon: 'fa-tag', color: '#9CA3AF' }
        ];
    }

    init() {
        this.renderAll();
    }

    setupEventListeners() {
        const addForm = document.getElementById('task-quick-add-form');
        if (addForm) addForm.addEventListener('submit', (e) => { e.preventDefault(); this.addTask(); });

        const expandBtn = document.getElementById('task-expand-add');
        if (expandBtn) expandBtn.addEventListener('click', () => this._toggleExpandedAdd());

        document.querySelectorAll('.task-filter-chip').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.task-filter-chip').forEach(b => b.classList.remove('active'));
                e.currentTarget.classList.add('active');
                this.currentFilter = e.currentTarget.getAttribute('data-filter');
                this.renderTasks();
            });
        });

        const searchInput = document.getElementById('task-search-input');
        if (searchInput) searchInput.addEventListener('input', (e) => {
            this.searchQuery = e.target.value.trim().toLowerCase();
            this.renderTasks();
        });

        const clearBtn = document.getElementById('task-clear-completed');
        if (clearBtn) clearBtn.addEventListener('click', () => this.clearCompleted());

        // View toggle
        const listViewBtn = document.getElementById('task-view-list');
        const kanbanViewBtn = document.getElementById('task-view-kanban');
        if (listViewBtn) listViewBtn.addEventListener('click', () => this.setViewMode('list'));
        if (kanbanViewBtn) kanbanViewBtn.addEventListener('click', () => this.setViewMode('kanban'));
    }

    // ===== VIEW MODE =====
    setViewMode(mode) {
        this.viewMode = mode;
        document.getElementById('task-view-list')?.classList.toggle('active', mode === 'list');
        document.getElementById('task-view-kanban')?.classList.toggle('active', mode === 'kanban');
        document.getElementById('task-list-container')?.classList.toggle('hidden', mode !== 'list');
        document.getElementById('task-kanban-container')?.classList.toggle('hidden', mode !== 'kanban');
        if (mode === 'kanban') this.renderKanban();
        else this.renderTasks();
    }

    // ===== CRUD =====
    async addTask() {
        const textInput = document.getElementById('task-add-text');
        const prioritySelect = document.getElementById('task-add-priority');
        const categorySelect = document.getElementById('task-add-category');
        const dueDateInput = document.getElementById('task-add-due');
        const notesInput = document.getElementById('task-add-notes');
        const estimateInput = document.getElementById('task-add-estimate');
        const recurrenceSelect = document.getElementById('task-add-recurrence');
        const tagsInput = document.getElementById('task-add-tags');

        const text = textInput ? textInput.value.trim() : '';
        if (!text) { this.auth.showNotification('Digite o nome da tarefa.', 'warning'); return; }

        const priority = prioritySelect ? prioritySelect.value : 'low';
        const category = categorySelect ? categorySelect.value : '';
        const dueDate = dueDateInput ? dueDateInput.value : null;
        const notes = notesInput ? notesInput.value.trim() : '';
        const estimatedMinutes = estimateInput ? parseInt(estimateInput.value) || 0 : 0;
        const recurrence = recurrenceSelect ? recurrenceSelect.value : '';
        const tags = tagsInput ? tagsInput.value.split(',').map(t => t.trim()).filter(Boolean) : [];

        const taskData = {
            text, priority, category, due_date: dueDate || null, notes,
            status: 'todo', subtasks: [], tags, estimated_minutes: estimatedMinutes, recurrence
        };

        if (this.auth.getToken()) {
            try {
                const resp = await this.auth.apiRequest('/api/tasks', { method: 'POST', body: JSON.stringify(taskData) });
                this.tasks.unshift(this._mapServerTask(resp.task));
            } catch (err) {
                this.auth.showNotification(err.message || 'Erro ao criar tarefa', 'error');
                return;
            }
        } else {
            this.tasks.unshift({
                id: Date.now(), text, completed: false, priority, category,
                dueDate: dueDate || null, notes, sortOrder: 0, status: 'todo',
                subtasks: [], tags, estimatedMinutes, recurrence,
                createdAt: new Date().toISOString(), completedAt: null
            });
        }

        textInput.value = '';
        if (notesInput) notesInput.value = '';
        if (dueDateInput) dueDateInput.value = '';
        if (estimateInput) estimateInput.value = '';
        if (tagsInput) tagsInput.value = '';
        this._collapseExpandedAdd();
        this.renderAll();
        this.saveData();
        this.auth.showNotification('Tarefa adicionada!', 'success');
    }

    async toggleTask(id) {
        const task = this.tasks.find(t => t.id === id);
        if (!task) return;

        if (this.auth.getToken() && Number.isInteger(id)) {
            try {
                const resp = await this.auth.apiRequest(`/api/tasks/${id}/toggle`, { method: 'PATCH' });
                const mapped = this._mapServerTask(resp.task);
                Object.assign(task, mapped);
            } catch (err) {
                this.auth.showNotification(err.message || 'Erro', 'error');
                return;
            }
        } else {
            task.completed = !task.completed;
            task.status = task.completed ? 'done' : 'todo';
            task.completedAt = task.completed ? new Date().toISOString() : null;
        }

        this.renderAll();
        this.saveData();
    }

    async setTaskStatus(id, status) {
        const task = this.tasks.find(t => t.id === id);
        if (!task) return;

        if (this.auth.getToken() && Number.isInteger(id)) {
            try {
                const resp = await this.auth.apiRequest(`/api/tasks/${id}`, {
                    method: 'PUT',
                    body: JSON.stringify({ ...this._toServerTask(task), status })
                });
                Object.assign(task, this._mapServerTask(resp.task));
            } catch (err) {
                this.auth.showNotification(err.message || 'Erro', 'error');
                return;
            }
        } else {
            task.status = status;
            task.completed = status === 'done';
            task.completedAt = status === 'done' ? new Date().toISOString() : null;
        }

        this.renderAll();
        this.saveData();
    }

    async deleteTask(id) {
        if (!confirm('Excluir esta tarefa?')) return;

        if (this.auth.getToken() && Number.isInteger(id)) {
            try { await this.auth.apiRequest(`/api/tasks/${id}`, { method: 'DELETE' }); }
            catch (err) { this.auth.showNotification(err.message || 'Erro ao excluir', 'error'); return; }
        }

        this.tasks = this.tasks.filter(t => t.id !== id);
        if (this.pomodoroTaskId === id) this.stopPomodoro();
        this.renderAll();
        this.saveData();
        this.auth.showNotification('Tarefa excluída.', 'info');
    }

    async editTask(id) {
        this.editingTaskId = id;
        this.renderTasks();
        setTimeout(() => {
            const input = document.getElementById(`task-edit-input-${id}`);
            if (input) { input.focus(); input.select(); }
        }, 50);
    }

    async saveEdit(id) {
        const task = this.tasks.find(t => t.id === id);
        if (!task) return;

        const textInput = document.getElementById(`task-edit-input-${id}`);
        const prioritySelect = document.getElementById(`task-edit-priority-${id}`);
        const categorySelect = document.getElementById(`task-edit-category-${id}`);
        const dueDateInput = document.getElementById(`task-edit-due-${id}`);
        const notesInput = document.getElementById(`task-edit-notes-${id}`);
        const estimateInput = document.getElementById(`task-edit-estimate-${id}`);
        const recurrenceSelect = document.getElementById(`task-edit-recurrence-${id}`);
        const tagsInput = document.getElementById(`task-edit-tags-${id}`);

        const text = textInput ? textInput.value.trim() : task.text;
        if (!text) return;

        const priority = prioritySelect ? prioritySelect.value : task.priority;
        const category = categorySelect ? categorySelect.value : task.category;
        const dueDate = dueDateInput ? dueDateInput.value || null : task.dueDate;
        const notes = notesInput ? notesInput.value.trim() : task.notes;
        const estimatedMinutes = estimateInput ? parseInt(estimateInput.value) || 0 : task.estimatedMinutes;
        const recurrence = recurrenceSelect ? recurrenceSelect.value : task.recurrence;
        const tags = tagsInput ? tagsInput.value.split(',').map(t => t.trim()).filter(Boolean) : task.tags;

        if (this.auth.getToken() && Number.isInteger(id)) {
            try {
                const resp = await this.auth.apiRequest(`/api/tasks/${id}`, {
                    method: 'PUT',
                    body: JSON.stringify({ text, priority, category, due_date: dueDate, notes, estimated_minutes: estimatedMinutes, recurrence, tags, status: task.status })
                });
                Object.assign(task, this._mapServerTask(resp.task));
            } catch (err) {
                this.auth.showNotification(err.message || 'Erro ao salvar', 'error');
                return;
            }
        } else {
            Object.assign(task, { text, priority, category, dueDate, notes, estimatedMinutes, recurrence, tags });
        }

        this.editingTaskId = null;
        this.renderAll();
        this.saveData();
        this.auth.showNotification('Tarefa atualizada!', 'success');
    }

    cancelEdit() { this.editingTaskId = null; this.renderTasks(); }

    async clearCompleted() {
        const completed = this.tasks.filter(t => t.completed || t.status === 'done');
        if (completed.length === 0) return;
        if (!confirm(`Remover ${completed.length} tarefa(s) concluída(s)?`)) return;

        for (const t of completed) {
            if (this.auth.getToken() && Number.isInteger(t.id)) {
                try { await this.auth.apiRequest(`/api/tasks/${t.id}`, { method: 'DELETE' }); }
                catch (e) { console.warn(e); }
            }
        }

        this.tasks = this.tasks.filter(t => !t.completed && t.status !== 'done');
        this.renderAll();
        this.saveData();
        this.auth.showNotification(`${completed.length} tarefa(s) removida(s).`, 'info');
    }

    // ===== SUBTASKS =====
    async addSubtask(taskId) {
        const input = document.getElementById(`subtask-input-${taskId}`);
        if (!input) return;
        const text = input.value.trim();
        if (!text) return;

        const task = this.tasks.find(t => t.id === taskId);
        if (!task) return;

        if (this.auth.getToken() && Number.isInteger(taskId)) {
            try {
                const resp = await this.auth.apiRequest(`/api/tasks/${taskId}/subtasks`, {
                    method: 'POST',
                    body: JSON.stringify({ text })
                });
                task.subtasks.push({ id: resp.subtask.id, text: resp.subtask.text, done: false, sortOrder: resp.subtask.sort_order || 0 });
            } catch (e) { console.warn(e); return; }
        } else {
            task.subtasks.push({ id: Date.now(), text, done: false });
        }

        input.value = '';
        this.renderTasks();
        this.saveData();
    }

    async toggleSubtask(taskId, subtaskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (!task) return;
        const sub = task.subtasks.find(s => s.id === subtaskId);
        if (!sub) return;

        if (this.auth.getToken() && Number.isInteger(subtaskId)) {
            try {
                const resp = await this.auth.apiRequest(`/api/subtasks/${subtaskId}/toggle`, { method: 'PATCH' });
                sub.done = !!resp.subtask.completed;
            } catch (e) { console.warn(e); return; }
        } else {
            sub.done = !sub.done;
        }

        this.renderTasks();
        this.saveData();
    }

    async deleteSubtask(taskId, subtaskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (!task) return;

        if (this.auth.getToken() && Number.isInteger(subtaskId)) {
            try {
                await this.auth.apiRequest(`/api/subtasks/${subtaskId}`, { method: 'DELETE' });
            } catch (e) { console.warn(e); return; }
        }

        task.subtasks = task.subtasks.filter(s => s.id !== subtaskId);
        this.renderTasks();
        this.saveData();
    }

    // ===== POMODORO =====
    startPomodoro(taskId) {
        if (this.pomodoroRunning) this.stopPomodoro();
        this.pomodoroTaskId = taskId;
        this.pomodoroTime = 25 * 60;
        this.pomodoroRunning = true;
        this._updatePomodoroUI();

        this.pomodoroInterval = setInterval(() => {
            this.pomodoroTime--;
            this._updatePomodoroUI();
            if (this.pomodoroTime <= 0) {
                this.stopPomodoro();
                this.auth.showNotification('Pomodoro finalizado! Hora de descansar.', 'success');
                if ('vibrate' in navigator) navigator.vibrate([200, 100, 200]);
            }
        }, 1000);

        this.renderTasks();
    }

    stopPomodoro() {
        clearInterval(this.pomodoroInterval);
        this.pomodoroRunning = false;
        this.pomodoroTaskId = null;
        this.pomodoroTime = 25 * 60;
        const bar = document.getElementById('pomodoro-bar');
        if (bar) bar.style.display = 'none';
    }

    _updatePomodoroUI() {
        const bar = document.getElementById('pomodoro-bar');
        if (!bar) return;
        bar.style.display = 'flex';
        const mins = Math.floor(this.pomodoroTime / 60);
        const secs = this.pomodoroTime % 60;
        const task = this.tasks.find(t => t.id === this.pomodoroTaskId);
        const taskName = task ? task.text : '';
        const pct = ((25 * 60 - this.pomodoroTime) / (25 * 60)) * 100;

        bar.innerHTML = `
            <div class="pomo-info">
                <i class="fas fa-clock"></i>
                <span class="pomo-task-name">${this._esc(taskName)}</span>
                <span class="pomo-timer">${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}</span>
            </div>
            <div class="pomo-progress-track"><div class="pomo-progress-fill" style="width:${pct}%"></div></div>
            <button class="pomo-stop-btn" onclick="window.app.taskManager.stopPomodoro();window.app.taskManager.renderTasks()"><i class="fas fa-stop"></i></button>
        `;
    }

    // ===== RENDERING =====
    renderAll() {
        this.updateStats();
        this.updateProgressBar();
        this.updateWeeklyChart();
        if (this.viewMode === 'kanban') this.renderKanban();
        else this.renderTasks();
    }

    renderTasks() {
        const taskList = document.getElementById('task-list');
        if (!taskList) return;
        taskList.innerHTML = '';

        let filtered = this._getFilteredTasks();

        const countBadge = document.getElementById('task-count-badge');
        if (countBadge) countBadge.textContent = filtered.length;

        if (filtered.length === 0) {
            taskList.innerHTML = `
                <div class="task-empty-state">
                    <div class="task-empty-icon"><i class="fas fa-clipboard-check"></i></div>
                    <p class="task-empty-title">${this.searchQuery ? 'Nenhuma tarefa encontrada' : 'Nenhuma tarefa ainda'}</p>
                    <p class="task-empty-sub">${this.searchQuery ? 'Tente outro termo de busca' : 'Adicione sua primeira tarefa acima'}</p>
                </div>`;
            return;
        }

        filtered.forEach((task, index) => {
            const el = document.createElement('div');
            if (this.editingTaskId === task.id) {
                el.className = 'task-card task-card-editing';
                el.innerHTML = this._renderEditForm(task);
            } else {
                el.className = `task-card task-status-${task.status || 'todo'} ${task.completed ? 'task-card-done' : ''} task-priority-${task.priority}`;
                el.style.animationDelay = `${index * 0.03}s`;
                el.setAttribute('draggable', 'true');
                el.dataset.taskId = task.id;
                el.innerHTML = this._renderTaskCard(task);
                el.addEventListener('dragstart', (e) => this._onDragStart(e, task.id));
                el.addEventListener('dragover', (e) => this._onDragOver(e));
                el.addEventListener('drop', (e) => this._onDrop(e, task.id));
                el.addEventListener('dragend', () => this._onDragEnd());
            }
            taskList.appendChild(el);
        });
    }

    _getFilteredTasks() {
        let filtered = [...this.tasks];
        const today = new Date().toISOString().split('T')[0];

        if (this.currentFilter === 'active') filtered = filtered.filter(t => t.status !== 'done' && !t.completed);
        else if (this.currentFilter === 'in_progress') filtered = filtered.filter(t => t.status === 'in_progress');
        else if (this.currentFilter === 'completed') filtered = filtered.filter(t => t.status === 'done' || t.completed);
        else if (this.currentFilter === 'high') filtered = filtered.filter(t => t.priority === 'high');
        else if (this.currentFilter === 'today') filtered = filtered.filter(t => t.dueDate === today);
        else if (this.currentFilter === 'overdue') filtered = filtered.filter(t => t.dueDate && t.dueDate < today && t.status !== 'done' && !t.completed);

        if (this.searchQuery) {
            filtered = filtered.filter(t =>
                t.text.toLowerCase().includes(this.searchQuery) ||
                (t.category && t.category.toLowerCase().includes(this.searchQuery)) ||
                (t.notes && t.notes.toLowerCase().includes(this.searchQuery)) ||
                (t.tags && t.tags.some(tag => tag.toLowerCase().includes(this.searchQuery)))
            );
        }

        filtered.sort((a, b) => {
            const statusOrder = { in_progress: 0, todo: 1, done: 2 };
            const sa = statusOrder[a.status] ?? 1, sb = statusOrder[b.status] ?? 1;
            if (sa !== sb) return sa - sb;
            const prio = { high: 3, medium: 2, low: 1 };
            if (prio[b.priority] !== prio[a.priority]) return prio[b.priority] - prio[a.priority];
            if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
            if (a.dueDate) return -1;
            if (b.dueDate) return 1;
            return 0;
        });

        return filtered;
    }

    _renderTaskCard(task) {
        const s = this._esc(task.text);
        const prioIcons = { high: 'fa-arrow-up', medium: 'fa-minus', low: 'fa-arrow-down' };
        const prioLabels = { high: 'Alta', medium: 'Média', low: 'Baixa' };
        const statusLabels = { todo: 'A Fazer', in_progress: 'Em Andamento', done: 'Concluída' };
        const statusIcons = { todo: 'fa-circle', in_progress: 'fa-spinner', done: 'fa-check-circle' };

        let dueBadge = '';
        if (task.dueDate) {
            const today = new Date().toISOString().split('T')[0];
            const isOverdue = task.dueDate < today && task.status !== 'done';
            const isToday = task.dueDate === today;
            const dueClass = isOverdue ? 'task-due-overdue' : isToday ? 'task-due-today' : 'task-due-future';
            const dueLabel = isOverdue ? 'Atrasada' : isToday ? 'Hoje' : new Date(task.dueDate + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
            dueBadge = `<span class="task-due-badge ${dueClass}"><i class="fas fa-calendar-day"></i> ${dueLabel}</span>`;
        }

        const catObj = this.categories.find(c => c.id === task.category || c.name === task.category);
        let catBadge = '';
        if (task.category && catObj) {
            catBadge = `<span class="task-cat-badge" style="color:${catObj.color}"><i class="fas ${catObj.icon}"></i> ${catObj.name}</span>`;
        } else if (task.category) {
            catBadge = `<span class="task-cat-badge"><i class="fas fa-tag"></i> ${task.category}</span>`;
        }

        let tagsBadges = '';
        if (task.tags && task.tags.length > 0) {
            tagsBadges = task.tags.map(tag => `<span class="task-tag-badge">#${this._esc(tag)}</span>`).join('');
        }

        let estimateBadge = '';
        if (task.estimatedMinutes > 0) {
            const h = Math.floor(task.estimatedMinutes / 60);
            const m = task.estimatedMinutes % 60;
            const label = h > 0 ? `${h}h${m > 0 ? m + 'm' : ''}` : `${m}m`;
            estimateBadge = `<span class="task-estimate-badge"><i class="fas fa-hourglass-half"></i> ${label}</span>`;
        }

        let recurrenceBadge = '';
        if (task.recurrence) {
            const rLabels = { daily: 'Diária', weekly: 'Semanal', monthly: 'Mensal' };
            recurrenceBadge = `<span class="task-recurrence-badge"><i class="fas fa-redo"></i> ${rLabels[task.recurrence] || task.recurrence}</span>`;
        }

        const notesTrunc = task.notes ? `<p class="task-notes-preview"><i class="fas fa-sticky-note"></i> ${this._esc(task.notes.substring(0, 80))}${task.notes.length > 80 ? '...' : ''}</p>` : '';

        // Subtasks progress
        let subtasksHTML = '';
        if (task.subtasks && task.subtasks.length > 0) {
            const done = task.subtasks.filter(s => s.done).length;
            const total = task.subtasks.length;
            const pct = Math.round((done / total) * 100);
            subtasksHTML = `
                <div class="task-subtask-progress">
                    <div class="task-subtask-bar"><div class="task-subtask-fill" style="width:${pct}%"></div></div>
                    <span class="task-subtask-count">${done}/${total}</span>
                </div>`;
        }

        // Status dropdown
        const statusMenu = `
            <div class="task-status-dropdown">
                <button class="task-status-btn task-status-${task.status || 'todo'}" onclick="event.stopPropagation();this.nextElementSibling.classList.toggle('show')">
                    <i class="fas ${statusIcons[task.status || 'todo']}"></i>
                </button>
                <div class="task-status-menu">
                    <button onclick="window.app.taskManager.setTaskStatus(${task.id},'todo')" class="${task.status === 'todo' ? 'active' : ''}"><i class="fas fa-circle"></i> A Fazer</button>
                    <button onclick="window.app.taskManager.setTaskStatus(${task.id},'in_progress')" class="${task.status === 'in_progress' ? 'active' : ''}"><i class="fas fa-spinner"></i> Em Andamento</button>
                    <button onclick="window.app.taskManager.setTaskStatus(${task.id},'done')" class="${task.status === 'done' ? 'active' : ''}"><i class="fas fa-check-circle"></i> Concluída</button>
                </div>
            </div>`;

        const isPomActive = this.pomodoroTaskId === task.id && this.pomodoroRunning;

        return `
            <div class="task-card-left">${statusMenu}</div>
            <div class="task-card-body">
                <div class="task-card-title ${task.status === 'done' ? 'task-title-done' : ''}">${s}</div>
                ${notesTrunc}
                ${subtasksHTML}
                <div class="task-card-meta">
                    <span class="task-prio-badge task-prio-${task.priority}" title="Prioridade: ${prioLabels[task.priority]}">
                        <i class="fas ${prioIcons[task.priority]}"></i> ${prioLabels[task.priority]}
                    </span>
                    ${catBadge}${dueBadge}${estimateBadge}${recurrenceBadge}${tagsBadges}
                </div>
            </div>
            <div class="task-card-actions">
                <button class="task-action-btn ${isPomActive ? 'pomo-active' : ''}" onclick="window.app.taskManager.${isPomActive ? 'stopPomodoro()' : `startPomodoro(${task.id})`};window.app.taskManager.renderTasks()" title="Pomodoro">
                    <i class="fas ${isPomActive ? 'fa-stop' : 'fa-clock'}"></i>
                </button>
                <button class="task-action-btn" onclick="window.app.taskManager._toggleSubtasksPanel(${task.id})" title="Subtarefas">
                    <i class="fas fa-list-check"></i>
                </button>
                <button class="task-action-btn" onclick="window.app.taskManager.editTask(${task.id})" title="Editar">
                    <i class="fas fa-pen"></i>
                </button>
                <button class="task-action-btn task-action-delete" onclick="window.app.taskManager.deleteTask(${task.id})" title="Excluir">
                    <i class="fas fa-trash-alt"></i>
                </button>
            </div>`;
    }

    _toggleSubtasksPanel(taskId) {
        const existing = document.getElementById(`subtask-panel-${taskId}`);
        if (existing) { existing.remove(); return; }

        const task = this.tasks.find(t => t.id === taskId);
        if (!task) return;

        const card = document.querySelector(`[data-task-id="${taskId}"]`);
        if (!card) return;

        const panel = document.createElement('div');
        panel.id = `subtask-panel-${taskId}`;
        panel.className = 'task-subtask-panel';

        const subtasksList = (task.subtasks || []).map(sub => `
            <div class="subtask-item ${sub.done ? 'subtask-done' : ''}">
                <button class="subtask-check" onclick="window.app.taskManager.toggleSubtask(${taskId},${sub.id})">
                    <i class="fas ${sub.done ? 'fa-check-square' : 'fa-square'}"></i>
                </button>
                <span class="subtask-text">${this._esc(sub.text)}</span>
                <button class="subtask-delete" onclick="window.app.taskManager.deleteSubtask(${taskId},${sub.id})">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `).join('');

        panel.innerHTML = `
            <div class="subtask-header"><i class="fas fa-list-check"></i> Subtarefas</div>
            <div class="subtask-list">${subtasksList || '<p class="subtask-empty">Nenhuma subtarefa</p>'}</div>
            <div class="subtask-add-row">
                <input type="text" id="subtask-input-${taskId}" class="subtask-input" placeholder="Nova subtarefa..." onkeydown="if(event.key==='Enter'){event.preventDefault();window.app.taskManager.addSubtask(${taskId})}" />
                <button class="subtask-add-btn" onclick="window.app.taskManager.addSubtask(${taskId})"><i class="fas fa-plus"></i></button>
            </div>
        `;

        card.appendChild(panel);
    }

    _renderEditForm(task) {
        const catOptions = this.categories.map(c => `<option value="${c.id}" ${task.category === c.id || task.category === c.name ? 'selected' : ''}>${c.name}</option>`).join('');
        const tagsStr = (task.tags || []).join(', ');

        return `
            <div class="task-edit-form">
                <input type="text" id="task-edit-input-${task.id}" class="task-edit-input" value="${this._esc(task.text)}" />
                <div class="task-edit-fields">
                    <select id="task-edit-priority-${task.id}" class="task-edit-select">
                        <option value="low" ${task.priority === 'low' ? 'selected' : ''}>🟢 Baixa</option>
                        <option value="medium" ${task.priority === 'medium' ? 'selected' : ''}>🟡 Média</option>
                        <option value="high" ${task.priority === 'high' ? 'selected' : ''}>🔴 Alta</option>
                    </select>
                    <select id="task-edit-category-${task.id}" class="task-edit-select">
                        <option value="">Sem categoria</option>
                        ${catOptions}
                    </select>
                    <input type="date" id="task-edit-due-${task.id}" class="task-edit-date" value="${task.dueDate || ''}" />
                </div>
                <div class="task-edit-fields">
                    <input type="number" id="task-edit-estimate-${task.id}" class="task-edit-select" placeholder="Min." value="${task.estimatedMinutes || ''}" min="0" style="max-width:80px" />
                    <select id="task-edit-recurrence-${task.id}" class="task-edit-select">
                        <option value="">Sem recorrência</option>
                        <option value="daily" ${task.recurrence === 'daily' ? 'selected' : ''}>Diária</option>
                        <option value="weekly" ${task.recurrence === 'weekly' ? 'selected' : ''}>Semanal</option>
                        <option value="monthly" ${task.recurrence === 'monthly' ? 'selected' : ''}>Mensal</option>
                    </select>
                    <input type="text" id="task-edit-tags-${task.id}" class="task-edit-input" placeholder="Tags (vírgula)" value="${tagsStr}" style="flex:1" />
                </div>
                <textarea id="task-edit-notes-${task.id}" class="task-edit-notes" rows="2" placeholder="Notas...">${task.notes || ''}</textarea>
                <div class="task-edit-actions">
                    <button class="btn btn-sm btn-primary" onclick="window.app.taskManager.saveEdit(${task.id})"><i class="fas fa-check"></i> Salvar</button>
                    <button class="btn btn-sm btn-outline" onclick="window.app.taskManager.cancelEdit()">Cancelar</button>
                </div>
            </div>`;
    }

    // ===== KANBAN =====
    renderKanban() {
        const container = document.getElementById('task-kanban-board');
        if (!container) return;

        const columns = [
            { status: 'todo', label: 'A Fazer', icon: 'fa-circle', color: '#F59E0B' },
            { status: 'in_progress', label: 'Em Andamento', icon: 'fa-spinner', color: '#3B82F6' },
            { status: 'done', label: 'Concluída', icon: 'fa-check-circle', color: '#10B981' }
        ];

        container.innerHTML = columns.map(col => {
            const tasks = this.tasks.filter(t => (t.status || 'todo') === col.status);
            const cards = tasks.map(t => `
                <div class="kanban-card task-priority-${t.priority}" draggable="true" data-task-id="${t.id}"
                     ondragstart="window.app.taskManager._kanbanDragStart(event,${t.id})"
                     ondragend="window.app.taskManager._onDragEnd()">
                    <div class="kanban-card-title">${this._esc(t.text)}</div>
                    <div class="kanban-card-meta">
                        <span class="task-prio-badge task-prio-${t.priority}"><i class="fas ${t.priority === 'high' ? 'fa-arrow-up' : t.priority === 'medium' ? 'fa-minus' : 'fa-arrow-down'}"></i></span>
                        ${t.dueDate ? `<span class="task-date-badge"><i class="fas fa-calendar"></i> ${new Date(t.dueDate + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</span>` : ''}
                        ${t.subtasks && t.subtasks.length ? `<span class="task-subtask-count">${t.subtasks.filter(s=>s.done).length}/${t.subtasks.length}</span>` : ''}
                    </div>
                </div>
            `).join('');

            return `
                <div class="kanban-column" data-status="${col.status}"
                     ondragover="event.preventDefault();this.classList.add('kanban-drag-over')"
                     ondragleave="this.classList.remove('kanban-drag-over')"
                     ondrop="window.app.taskManager._kanbanDrop(event,'${col.status}');this.classList.remove('kanban-drag-over')">
                    <div class="kanban-column-header">
                        <span class="kanban-col-title"><i class="fas ${col.icon}" style="color:${col.color}"></i> ${col.label}</span>
                        <span class="kanban-col-count">${tasks.length}</span>
                    </div>
                    <div class="kanban-cards">${cards || '<div class="kanban-empty">Nenhuma tarefa</div>'}</div>
                </div>`;
        }).join('');
    }

    _kanbanDragStart(e, id) {
        this.draggedItem = id;
        e.currentTarget.classList.add('task-dragging');
        e.dataTransfer.effectAllowed = 'move';
    }

    _kanbanDrop(e, status) {
        e.preventDefault();
        if (this.draggedItem === null) return;
        this.setTaskStatus(this.draggedItem, status);
        this.draggedItem = null;
    }

    // ===== STATISTICS =====
    updateStats() {
        const total = this.tasks.length;
        const done = this.tasks.filter(t => t.status === 'done' || t.completed).length;
        const inProgress = this.tasks.filter(t => t.status === 'in_progress').length;
        const pending = total - done - inProgress;
        const today = new Date().toISOString().split('T')[0];
        const overdue = this.tasks.filter(t => t.dueDate && t.dueDate < today && t.status !== 'done' && !t.completed).length;

        const el = document.getElementById('tasks-completed');
        if (el) el.textContent = done;

        this._setEl('task-stat-total', total);
        this._setEl('task-stat-pending', pending);
        this._setEl('task-stat-progress', inProgress);
        this._setEl('task-stat-done', done);
        this._setEl('task-stat-overdue', overdue);

        const overdueCard = document.getElementById('task-stat-overdue')?.closest('.task-kpi-card');
        if (overdueCard) overdueCard.classList.toggle('has-overdue', overdue > 0);
    }

    updateProgressBar() {
        const total = this.tasks.length;
        const completed = this.tasks.filter(t => t.status === 'done' || t.completed).length;
        const pct = total === 0 ? 0 : Math.round((completed / total) * 100);
        const bar = document.getElementById('task-progress-fill');
        const label = document.getElementById('task-progress-label');
        if (bar) bar.style.width = `${pct}%`;
        if (label) label.textContent = `${pct}%`;
    }

    updateWeeklyChart() {
        const chart = document.getElementById('task-weekly-chart');
        if (!chart) return;

        const days = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            days.push(d.toISOString().split('T')[0]);
        }

        const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
        const maxCount = Math.max(1, ...days.map(day => this.tasks.filter(t => t.completedAt && t.completedAt.split('T')[0] === day).length));

        chart.innerHTML = days.map(day => {
            const count = this.tasks.filter(t => t.completedAt && t.completedAt.split('T')[0] === day).length;
            const pct = (count / maxCount) * 100;
            const dayOfWeek = dayNames[new Date(day + 'T12:00:00').getDay()];
            const isToday = day === new Date().toISOString().split('T')[0];
            return `
                <div class="weekly-bar-col ${isToday ? 'today' : ''}">
                    <div class="weekly-bar-value">${count}</div>
                    <div class="weekly-bar-track"><div class="weekly-bar-fill" style="height:${pct}%"></div></div>
                    <div class="weekly-bar-label">${dayOfWeek}</div>
                </div>`;
        }).join('');
    }

    // ===== DRAG & DROP (List) =====
    _onDragStart(e, id) {
        this.draggedItem = id;
        e.currentTarget.classList.add('task-dragging');
        e.dataTransfer.effectAllowed = 'move';
    }
    _onDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        e.currentTarget.classList.add('task-drag-over');
    }
    _onDrop(e, targetId) {
        e.preventDefault();
        e.currentTarget.classList.remove('task-drag-over');
        if (this.draggedItem === null || this.draggedItem === targetId) return;
        const fromIdx = this.tasks.findIndex(t => t.id === this.draggedItem);
        const toIdx = this.tasks.findIndex(t => t.id === targetId);
        if (fromIdx === -1 || toIdx === -1) return;
        const [moved] = this.tasks.splice(fromIdx, 1);
        this.tasks.splice(toIdx, 0, moved);
        this.tasks.forEach((t, i) => t.sortOrder = i);
        this.renderTasks();
        this.saveData();
        this._syncReorder();
    }
    _onDragEnd() {
        this.draggedItem = null;
        document.querySelectorAll('.task-dragging, .task-drag-over, .kanban-drag-over').forEach(el => {
            el.classList.remove('task-dragging', 'task-drag-over', 'kanban-drag-over');
        });
    }

    async _syncReorder() {
        if (!this.auth.getToken()) return;
        try {
            const order = this.tasks.map((t, i) => ({ id: t.id, sort_order: i }));
            await this.auth.apiRequest('/api/tasks/reorder', { method: 'PATCH', body: JSON.stringify({ order }) });
        } catch (e) { console.warn('Reorder sync failed:', e); }
    }

    // ===== EXPANDED ADD =====
    _toggleExpandedAdd() {
        const expanded = document.getElementById('task-expanded-fields');
        const icon = document.getElementById('task-expand-icon');
        if (!expanded) return;
        const isVisible = expanded.style.display !== 'none';
        expanded.style.display = isVisible ? 'none' : 'flex';
        if (icon) icon.className = isVisible ? 'fas fa-chevron-down' : 'fas fa-chevron-up';
    }
    _collapseExpandedAdd() {
        const expanded = document.getElementById('task-expanded-fields');
        const icon = document.getElementById('task-expand-icon');
        if (expanded) expanded.style.display = 'none';
        if (icon) icon.className = 'fas fa-chevron-down';
    }

    // ===== HELPERS =====
    _esc(str) { return window.DomusUtils ? DomusUtils.escapeHTML(str) : (str || '').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
    _setEl(id, val) { const el = document.getElementById(id); if (el) el.textContent = val; }

    _mapServerTask(t) {
        // Use subtask_items from table (preferred) or fall back to JSON subtasks column
        let subtasks = [];
        if (Array.isArray(t.subtask_items) && t.subtask_items.length > 0) {
            subtasks = t.subtask_items.map(s => ({ id: s.id, text: s.text, done: !!s.completed, sortOrder: s.sort_order || 0 }));
        } else {
            try { const raw = typeof t.subtasks === 'string' ? JSON.parse(t.subtasks) : (t.subtasks || []); subtasks = raw.map(s => ({ id: s.id || Date.now(), text: s.text, done: !!s.done || !!s.completed, sortOrder: s.sort_order || 0 })); } catch(e) { subtasks = []; }
        }
        let tags = [];
        if (typeof t.tags === 'string' && t.tags) tags = t.tags.split(',').map(x => x.trim()).filter(Boolean);
        else if (Array.isArray(t.tags)) tags = t.tags;

        return {
            id: t.id, text: t.text,
            completed: !!(t.completed || t.status === 'done'),
            priority: t.priority || 'low',
            category: t.category || '',
            dueDate: t.due_date || null,
            notes: t.notes || '',
            sortOrder: t.sort_order || 0,
            status: t.status || (t.completed ? 'done' : 'todo'),
            subtasks, tags,
            estimatedMinutes: t.estimated_minutes || 0,
            recurrence: t.recurrence || '',
            createdAt: t.created_at || new Date().toISOString(),
            completedAt: t.completed_at || null
        };
    }

    _toServerTask(task) {
        return {
            text: task.text, priority: task.priority, category: task.category,
            due_date: task.dueDate, notes: task.notes, status: task.status,
            subtasks: task.subtasks, tags: task.tags,
            estimated_minutes: task.estimatedMinutes, recurrence: task.recurrence
        };
    }

    async loadServerData() {
        if (!this.auth.getToken()) return;
        try {
            const resp = await this.auth.apiRequest('/api/tasks', { method: 'GET' });
            if (resp && Array.isArray(resp.tasks)) {
                this.tasks = resp.tasks.map(t => this._mapServerTask(t));
                this.renderAll();
            }
        } catch (err) { console.warn('Erro ao carregar tarefas:', err); }
    }

    saveData() {
        try { localStorage.setItem(this.auth.getStorageKey('tasks'), JSON.stringify({ tasks: this.tasks })); }
        catch (e) { console.warn('Falha ao salvar tarefas:', e); }
    }

    loadData() {
        try {
            const raw = localStorage.getItem(this.auth.getStorageKey('tasks'));
            if (raw) { const parsed = JSON.parse(raw); if (parsed.tasks && Array.isArray(parsed.tasks)) this.tasks = parsed.tasks; }
        } catch (e) { console.warn('Erro localStorage tarefas:', e); }
    }

    // ===== TEMPLATE =====
    static getTemplate() {
        const categoryOptions = [
            { id: 'trabalho', name: 'Trabalho' }, { id: 'pessoal', name: 'Pessoal' },
            { id: 'saude', name: 'Saúde' }, { id: 'estudos', name: 'Estudos' },
            { id: 'casa', name: 'Casa' }, { id: 'financas', name: 'Finanças' },
            { id: 'outro', name: 'Outro' }
        ].map(c => `<option value="${c.id}">${c.name}</option>`).join('');

        return `
        <div class="task-module">
            <!-- Pomodoro Bar -->
            <div class="pomodoro-bar" id="pomodoro-bar" style="display:none"></div>

            <!-- KPIs -->
            <div class="task-kpi-grid">
                <div class="task-kpi-card">
                    <div class="task-kpi-icon task-kpi-total"><i class="fas fa-layer-group"></i></div>
                    <div class="task-kpi-info">
                        <span class="task-kpi-value" id="task-stat-total">0</span>
                        <span class="task-kpi-label">Total</span>
                    </div>
                </div>
                <div class="task-kpi-card">
                    <div class="task-kpi-icon task-kpi-pending"><i class="fas fa-clock"></i></div>
                    <div class="task-kpi-info">
                        <span class="task-kpi-value" id="task-stat-pending">0</span>
                        <span class="task-kpi-label">Pendentes</span>
                    </div>
                </div>
                <div class="task-kpi-card">
                    <div class="task-kpi-icon" style="background:rgba(59,130,246,0.1);color:#3B82F6"><i class="fas fa-spinner"></i></div>
                    <div class="task-kpi-info">
                        <span class="task-kpi-value" id="task-stat-progress">0</span>
                        <span class="task-kpi-label">Em Andamento</span>
                    </div>
                </div>
                <div class="task-kpi-card">
                    <div class="task-kpi-icon task-kpi-done"><i class="fas fa-check-double"></i></div>
                    <div class="task-kpi-info">
                        <span class="task-kpi-value" id="task-stat-done">0</span>
                        <span class="task-kpi-label">Concluídas</span>
                    </div>
                </div>
                <div class="task-kpi-card">
                    <div class="task-kpi-icon task-kpi-overdue"><i class="fas fa-exclamation-triangle"></i></div>
                    <div class="task-kpi-info">
                        <span class="task-kpi-value" id="task-stat-overdue">0</span>
                        <span class="task-kpi-label">Atrasadas</span>
                    </div>
                </div>
            </div>

            <!-- Progress + Weekly Chart Row -->
            <div class="task-insights-row">
                <div class="task-progress-container">
                    <div class="task-progress-header">
                        <span class="task-progress-title"><i class="fas fa-chart-line"></i> Progresso</span>
                        <span class="task-progress-pct" id="task-progress-label">0%</span>
                    </div>
                    <div class="task-progress-track">
                        <div class="task-progress-fill" id="task-progress-fill"></div>
                    </div>
                </div>
                <div class="task-weekly-container">
                    <div class="task-weekly-header">
                        <span class="task-weekly-title"><i class="fas fa-calendar-week"></i> Semana</span>
                    </div>
                    <div class="task-weekly-chart" id="task-weekly-chart"></div>
                </div>
            </div>

            <!-- Add task -->
            <div class="task-add-card">
                <form id="task-quick-add-form" class="task-add-form" autocomplete="off">
                    <div class="task-add-main-row">
                        <div class="task-add-input-wrap">
                            <i class="fas fa-plus-circle task-add-icon"></i>
                            <input type="text" id="task-add-text" class="task-add-input" placeholder="Adicionar nova tarefa..." required />
                        </div>
                        <select id="task-add-priority" class="task-add-priority" title="Prioridade">
                            <option value="low">🟢 Baixa</option>
                            <option value="medium">🟡 Média</option>
                            <option value="high">🔴 Alta</option>
                        </select>
                        <button type="button" class="task-expand-btn" id="task-expand-add" title="Mais opções">
                            <i class="fas fa-chevron-down" id="task-expand-icon"></i>
                        </button>
                        <button type="submit" class="task-submit-btn" title="Adicionar">
                            <i class="fas fa-paper-plane"></i>
                        </button>
                    </div>
                    <div class="task-add-expanded" id="task-expanded-fields" style="display:none">
                        <select id="task-add-category" class="task-add-select" title="Categoria">
                            <option value="">Sem categoria</option>
                            ${categoryOptions}
                        </select>
                        <input type="date" id="task-add-due" class="task-add-date" title="Data de vencimento" />
                        <input type="number" id="task-add-estimate" class="task-add-select" placeholder="Minutos" min="0" title="Tempo estimado" style="max-width:90px" />
                        <select id="task-add-recurrence" class="task-add-select" title="Recorrência">
                            <option value="">Sem recorrência</option>
                            <option value="daily">Diária</option>
                            <option value="weekly">Semanal</option>
                            <option value="monthly">Mensal</option>
                        </select>
                        <input type="text" id="task-add-tags" class="task-add-select" placeholder="Tags (vírgula)" title="Tags" style="flex:1;min-width:120px" />
                        <textarea id="task-add-notes" class="task-add-notes" rows="2" placeholder="Notas opcionais..."></textarea>
                    </div>
                </form>
            </div>

            <!-- Toolbar -->
            <div class="task-toolbar">
                <div class="task-search-wrap">
                    <i class="fas fa-search task-search-icon"></i>
                    <input type="text" id="task-search-input" class="task-search-input" placeholder="Buscar tarefas..." />
                </div>
                <div class="task-view-toggle">
                    <button class="task-view-btn active" id="task-view-list" title="Lista"><i class="fas fa-list"></i></button>
                    <button class="task-view-btn" id="task-view-kanban" title="Kanban"><i class="fas fa-columns"></i></button>
                </div>
                <div class="task-filters-wrap">
                    <button class="task-filter-chip active" data-filter="all">Todas <span class="task-chip-count" id="task-count-badge">0</span></button>
                    <button class="task-filter-chip" data-filter="active">Pendentes</button>
                    <button class="task-filter-chip" data-filter="in_progress">Em Andamento</button>
                    <button class="task-filter-chip" data-filter="completed">Concluídas</button>
                    <button class="task-filter-chip" data-filter="today">Hoje</button>
                    <button class="task-filter-chip" data-filter="overdue">Atrasadas</button>
                    <button class="task-filter-chip" data-filter="high">🔴 Alta</button>
                </div>
                <button class="task-clear-btn" id="task-clear-completed" title="Limpar concluídas">
                    <i class="fas fa-broom"></i> Limpar
                </button>
            </div>

            <!-- List View -->
            <div id="task-list-container">
                <div id="task-list" class="task-list"></div>
            </div>

            <!-- Kanban View -->
            <div id="task-kanban-container" class="hidden">
                <div id="task-kanban-board" class="kanban-board"></div>
            </div>
        </div>
        `;
    }
}

window.TaskManager = TaskManager;
