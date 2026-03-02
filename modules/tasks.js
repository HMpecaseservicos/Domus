// Task Management Module — Ultra Professional Edition
class TaskManager {
    constructor(authManager) {
        this.auth = authManager;
        this.tasks = [];
        this.currentFilter = 'all';
        this.searchQuery = '';
        this.editingTaskId = null;
        this.draggedItem = null;
        this.categories = ['Trabalho', 'Pessoal', 'Saúde', 'Estudos', 'Casa', 'Finanças', 'Outro'];
    }

    // Initialize task manager
    init() {
        this.renderTasks();
        this.updateStats();
        this.updateProgressBar();
    }

    // Setup event listeners (call after DOM templates are injected)
    setupEventListeners() {
        // Quick-add form
        const addForm = document.getElementById('task-quick-add-form');
        if (addForm) addForm.addEventListener('submit', (e) => { e.preventDefault(); this.addTask(); });

        // Expand add form
        const expandBtn = document.getElementById('task-expand-add');
        if (expandBtn) expandBtn.addEventListener('click', () => this._toggleExpandedAdd());

        // Filter chips
        document.querySelectorAll('.task-filter-chip').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.task-filter-chip').forEach(b => b.classList.remove('active'));
                e.currentTarget.classList.add('active');
                this.currentFilter = e.currentTarget.getAttribute('data-filter');
                this.renderTasks();
            });
        });

        // Search
        const searchInput = document.getElementById('task-search-input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchQuery = e.target.value.trim().toLowerCase();
                this.renderTasks();
            });
        }

        // Clear completed button
        const clearBtn = document.getElementById('task-clear-completed');
        if (clearBtn) clearBtn.addEventListener('click', () => this.clearCompleted());
    }

    // ===== CRUD =====

    async addTask() {
        const textInput = document.getElementById('task-add-text');
        const prioritySelect = document.getElementById('task-add-priority');
        const categorySelect = document.getElementById('task-add-category');
        const dueDateInput = document.getElementById('task-add-due');
        const notesInput = document.getElementById('task-add-notes');

        const text = textInput ? textInput.value.trim() : '';
        if (!text) {
            this.auth.showNotification('Digite o nome da tarefa.', 'warning');
            return;
        }

        const priority = prioritySelect ? prioritySelect.value : 'low';
        const category = categorySelect ? categorySelect.value : '';
        const dueDate = dueDateInput ? dueDateInput.value : null;
        const notes = notesInput ? notesInput.value.trim() : '';

        const taskData = { text, priority, category, due_date: dueDate || null, notes };

        if (this.auth.getToken()) {
            try {
                const resp = await this.auth.apiRequest('/api/tasks', {
                    method: 'POST',
                    body: JSON.stringify(taskData)
                });
                const s = resp.task;
                this.tasks.unshift(this._mapServerTask(s));
            } catch (err) {
                this.auth.showNotification(err.message || 'Erro ao criar tarefa', 'error');
                return;
            }
        } else {
            this.tasks.unshift({
                id: Date.now(), text, completed: false, priority, category,
                dueDate: dueDate || null, notes, sortOrder: 0,
                createdAt: new Date().toISOString()
            });
        }

        textInput.value = '';
        if (notesInput) notesInput.value = '';
        if (dueDateInput) dueDateInput.value = '';
        this._collapseExpandedAdd();
        this.renderTasks();
        this.updateStats();
        this.updateProgressBar();
        this.saveData();
        this.auth.showNotification('Tarefa adicionada!', 'success');
    }

    async toggleTask(id) {
        const task = this.tasks.find(t => t.id === id);
        if (!task) return;

        if (this.auth.getToken() && Number.isInteger(id)) {
            try {
                const resp = await this.auth.apiRequest(`/api/tasks/${id}/toggle`, { method: 'PATCH' });
                task.completed = !!resp.task.completed;
            } catch (err) {
                this.auth.showNotification(err.message || 'Erro', 'error');
                return;
            }
        } else {
            task.completed = !task.completed;
        }

        this.renderTasks();
        this.updateStats();
        this.updateProgressBar();
        this.saveData();
    }

    async deleteTask(id) {
        if (!confirm('Excluir esta tarefa?')) return;

        if (this.auth.getToken() && Number.isInteger(id)) {
            try {
                await this.auth.apiRequest(`/api/tasks/${id}`, { method: 'DELETE' });
            } catch (err) {
                this.auth.showNotification(err.message || 'Erro ao excluir', 'error');
                return;
            }
        }

        this.tasks = this.tasks.filter(t => t.id !== id);
        this.renderTasks();
        this.updateStats();
        this.updateProgressBar();
        this.saveData();
        this.auth.showNotification('Tarefa excluída.', 'info');
    }

    async editTask(id) {
        const task = this.tasks.find(t => t.id === id);
        if (!task) return;

        this.editingTaskId = id;
        this.renderTasks();

        // Focus the edit input
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

        const text = textInput ? textInput.value.trim() : task.text;
        if (!text) return;

        const priority = prioritySelect ? prioritySelect.value : task.priority;
        const category = categorySelect ? categorySelect.value : task.category;
        const dueDate = dueDateInput ? dueDateInput.value || null : task.dueDate;
        const notes = notesInput ? notesInput.value.trim() : task.notes;

        if (this.auth.getToken() && Number.isInteger(id)) {
            try {
                const resp = await this.auth.apiRequest(`/api/tasks/${id}`, {
                    method: 'PUT',
                    body: JSON.stringify({ text, priority, category, due_date: dueDate, notes })
                });
                Object.assign(task, this._mapServerTask(resp.task));
            } catch (err) {
                this.auth.showNotification(err.message || 'Erro ao salvar', 'error');
                return;
            }
        } else {
            Object.assign(task, { text, priority, category, dueDate, notes });
        }

        this.editingTaskId = null;
        this.renderTasks();
        this.saveData();
        this.auth.showNotification('Tarefa atualizada!', 'success');
    }

    cancelEdit() {
        this.editingTaskId = null;
        this.renderTasks();
    }

    async clearCompleted() {
        const completed = this.tasks.filter(t => t.completed);
        if (completed.length === 0) return;
        if (!confirm(`Remover ${completed.length} tarefa(s) concluída(s)?`)) return;

        for (const t of completed) {
            if (this.auth.getToken() && Number.isInteger(t.id)) {
                try { await this.auth.apiRequest(`/api/tasks/${t.id}`, { method: 'DELETE' }); }
                catch (e) { console.warn(e); }
            }
        }

        this.tasks = this.tasks.filter(t => !t.completed);
        this.renderTasks();
        this.updateStats();
        this.updateProgressBar();
        this.saveData();
        this.auth.showNotification(`${completed.length} tarefa(s) removida(s).`, 'info');
    }

    // ===== RENDERING =====

    renderTasks() {
        const taskList = document.getElementById('task-list');
        if (!taskList) return;
        taskList.innerHTML = '';

        let filtered = [...this.tasks];

        // Apply filter
        if (this.currentFilter === 'active') filtered = filtered.filter(t => !t.completed);
        else if (this.currentFilter === 'completed') filtered = filtered.filter(t => t.completed);
        else if (this.currentFilter === 'high') filtered = filtered.filter(t => t.priority === 'high');
        else if (this.currentFilter === 'today') {
            const today = new Date().toISOString().split('T')[0];
            filtered = filtered.filter(t => t.dueDate === today);
        } else if (this.currentFilter === 'overdue') {
            const today = new Date().toISOString().split('T')[0];
            filtered = filtered.filter(t => t.dueDate && t.dueDate < today && !t.completed);
        }

        // Apply search
        if (this.searchQuery) {
            filtered = filtered.filter(t =>
                t.text.toLowerCase().includes(this.searchQuery) ||
                (t.category && t.category.toLowerCase().includes(this.searchQuery)) ||
                (t.notes && t.notes.toLowerCase().includes(this.searchQuery))
            );
        }

        // Sort: incomplete first, then by priority, then by due date
        filtered.sort((a, b) => {
            if (a.completed !== b.completed) return a.completed ? 1 : -1;
            const prio = { high: 3, medium: 2, low: 1 };
            if (prio[b.priority] !== prio[a.priority]) return prio[b.priority] - prio[a.priority];
            if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
            if (a.dueDate) return -1;
            if (b.dueDate) return 1;
            return 0;
        });

        // Counter badge update
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
                el.className = `task-card ${task.completed ? 'task-card-done' : ''} task-priority-${task.priority}`;
                el.style.animationDelay = `${index * 0.03}s`;
                el.setAttribute('draggable', 'true');
                el.dataset.taskId = task.id;
                el.innerHTML = this._renderTaskCard(task);

                // Drag events
                el.addEventListener('dragstart', (e) => this._onDragStart(e, task.id));
                el.addEventListener('dragover', (e) => this._onDragOver(e));
                el.addEventListener('drop', (e) => this._onDrop(e, task.id));
                el.addEventListener('dragend', () => this._onDragEnd());
            }

            taskList.appendChild(el);
        });
    }

    _renderTaskCard(task) {
        const s = window.DomusUtils ? DomusUtils.escapeHTML(task.text) : task.text;
        const priorityIcons = { high: 'fa-arrow-up', medium: 'fa-minus', low: 'fa-arrow-down' };
        const priorityLabels = { high: 'Alta', medium: 'Média', low: 'Baixa' };
        const priorityColors = { high: 'var(--danger)', medium: '#D97706', low: 'var(--success)' };

        let dueBadge = '';
        if (task.dueDate) {
            const today = new Date().toISOString().split('T')[0];
            const isOverdue = task.dueDate < today && !task.completed;
            const isToday = task.dueDate === today;
            const dueClass = isOverdue ? 'task-due-overdue' : isToday ? 'task-due-today' : 'task-due-future';
            const dueLabel = isOverdue ? 'Atrasada' : isToday ? 'Hoje' : new Date(task.dueDate + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
            dueBadge = `<span class="task-due-badge ${dueClass}"><i class="fas fa-calendar-day"></i> ${dueLabel}</span>`;
        }

        let catBadge = '';
        if (task.category) {
            const catIcons = { 'Trabalho': 'fa-briefcase', 'Pessoal': 'fa-user', 'Saúde': 'fa-heart', 'Estudos': 'fa-book', 'Casa': 'fa-home', 'Finanças': 'fa-coins', 'Outro': 'fa-tag' };
            const icon = catIcons[task.category] || 'fa-tag';
            catBadge = `<span class="task-cat-badge"><i class="fas ${icon}"></i> ${task.category}</span>`;
        }

        const notesTrunc = task.notes ? `<p class="task-notes-preview"><i class="fas fa-sticky-note"></i> ${window.DomusUtils ? DomusUtils.escapeHTML(task.notes.substring(0, 80)) : task.notes.substring(0, 80)}${task.notes.length > 80 ? '...' : ''}</p>` : '';

        return `
            <div class="task-card-left">
                <button class="task-check-btn ${task.completed ? 'checked' : ''}" onclick="window.app.taskManager.toggleTask(${task.id})" title="${task.completed ? 'Reabrir' : 'Concluir'}">
                    <i class="fas ${task.completed ? 'fa-check-circle' : 'fa-circle'}"></i>
                </button>
            </div>
            <div class="task-card-body">
                <div class="task-card-title ${task.completed ? 'task-title-done' : ''}">${s}</div>
                ${notesTrunc}
                <div class="task-card-meta">
                    <span class="task-prio-badge task-prio-${task.priority}" title="Prioridade: ${priorityLabels[task.priority]}">
                        <i class="fas ${priorityIcons[task.priority]}"></i> ${priorityLabels[task.priority]}
                    </span>
                    ${catBadge}
                    ${dueBadge}
                    <span class="task-date-badge"><i class="far fa-clock"></i> ${new Date(task.createdAt).toLocaleDateString('pt-BR')}</span>
                </div>
            </div>
            <div class="task-card-actions">
                <button class="task-action-btn" onclick="window.app.taskManager.editTask(${task.id})" title="Editar">
                    <i class="fas fa-pen"></i>
                </button>
                <button class="task-action-btn task-action-delete" onclick="window.app.taskManager.deleteTask(${task.id})" title="Excluir">
                    <i class="fas fa-trash-alt"></i>
                </button>
            </div>`;
    }

    _renderEditForm(task) {
        const catOptions = this.categories.map(c =>
            `<option value="${c}" ${task.category === c ? 'selected' : ''}>${c}</option>`
        ).join('');

        return `
            <div class="task-edit-form">
                <div class="task-edit-row">
                    <input type="text" id="task-edit-input-${task.id}" class="task-edit-input" value="${window.DomusUtils ? DomusUtils.escapeHTML(task.text) : task.text}" />
                </div>
                <div class="task-edit-row task-edit-fields">
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
                <textarea id="task-edit-notes-${task.id}" class="task-edit-notes" rows="2" placeholder="Notas...">${task.notes || ''}</textarea>
                <div class="task-edit-actions">
                    <button class="btn btn-sm btn-primary" onclick="window.app.taskManager.saveEdit(${task.id})">
                        <i class="fas fa-check"></i> Salvar
                    </button>
                    <button class="btn btn-sm btn-outline" onclick="window.app.taskManager.cancelEdit()">
                        Cancelar
                    </button>
                </div>
            </div>`;
    }

    // ===== STATISTICS & PROGRESS =====

    updateStats() {
        const completed = this.tasks.filter(t => t.completed).length;
        const el = document.getElementById('tasks-completed');
        if (el) el.textContent = completed;

        // Internal stats
        const total = this.tasks.length;
        const pending = total - completed;
        const elTotal = document.getElementById('task-stat-total');
        const elPending = document.getElementById('task-stat-pending');
        const elDone = document.getElementById('task-stat-done');
        if (elTotal) elTotal.textContent = total;
        if (elPending) elPending.textContent = pending;
        if (elDone) elDone.textContent = completed;

        // Overdue count
        const today = new Date().toISOString().split('T')[0];
        const overdue = this.tasks.filter(t => t.dueDate && t.dueDate < today && !t.completed).length;
        const elOverdue = document.getElementById('task-stat-overdue');
        if (elOverdue) {
            elOverdue.textContent = overdue;
            elOverdue.closest('.task-kpi-card')?.classList.toggle('has-overdue', overdue > 0);
        }
    }

    updateProgressBar() {
        const total = this.tasks.length;
        const completed = this.tasks.filter(t => t.completed).length;
        const pct = total === 0 ? 0 : Math.round((completed / total) * 100);

        const bar = document.getElementById('task-progress-fill');
        const label = document.getElementById('task-progress-label');
        if (bar) bar.style.width = `${pct}%`;
        if (label) label.textContent = `${pct}%`;
    }

    // ===== DRAG & DROP =====

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

        // Update sort_order
        this.tasks.forEach((t, i) => t.sortOrder = i);

        this.renderTasks();
        this.saveData();
        this._syncReorder();
    }

    _onDragEnd() {
        this.draggedItem = null;
        document.querySelectorAll('.task-dragging, .task-drag-over').forEach(el => {
            el.classList.remove('task-dragging', 'task-drag-over');
        });
    }

    async _syncReorder() {
        if (!this.auth.getToken()) return;
        try {
            const order = this.tasks.map((t, i) => ({ id: t.id, sort_order: i }));
            await this.auth.apiRequest('/api/tasks/reorder', {
                method: 'PATCH',
                body: JSON.stringify({ order })
            });
        } catch (e) { console.warn('Reorder sync failed:', e); }
    }

    // ===== EXPANDED ADD FORM =====

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

    // ===== SERVER / STORAGE =====

    _mapServerTask(t) {
        return {
            id: t.id,
            text: t.text,
            completed: !!t.completed,
            priority: t.priority || 'low',
            category: t.category || '',
            dueDate: t.due_date || null,
            notes: t.notes || '',
            sortOrder: t.sort_order || 0,
            createdAt: t.created_at || new Date().toISOString()
        };
    }

    async loadServerData() {
        if (!this.auth.getToken()) return;
        try {
            const resp = await this.auth.apiRequest('/api/tasks', { method: 'GET' });
            if (resp && Array.isArray(resp.tasks)) {
                this.tasks = resp.tasks.map(t => this._mapServerTask(t));
                this.renderTasks();
                this.updateStats();
                this.updateProgressBar();
            }
        } catch (err) { console.warn('Erro ao carregar tarefas:', err); }
    }

    saveData() {
        try {
            localStorage.setItem(this.auth.getStorageKey('tasks'), JSON.stringify({ tasks: this.tasks }));
        } catch (e) { console.warn('Falha ao salvar tarefas:', e); }
    }

    loadData() {
        try {
            const raw = localStorage.getItem(this.auth.getStorageKey('tasks'));
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed.tasks && Array.isArray(parsed.tasks)) this.tasks = parsed.tasks;
            }
        } catch (e) { console.warn('Erro localStorage tarefas:', e); }
    }

    // ===== TEMPLATE =====

    static getTemplate() {
        const categoryOptions = ['Trabalho', 'Pessoal', 'Saúde', 'Estudos', 'Casa', 'Finanças', 'Outro']
            .map(c => `<option value="${c}">${c}</option>`).join('');

        return `
        <div class="task-module">
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

            <!-- Progress bar -->
            <div class="task-progress-container">
                <div class="task-progress-header">
                    <span class="task-progress-title"><i class="fas fa-chart-line"></i> Progresso do dia</span>
                    <span class="task-progress-pct" id="task-progress-label">0%</span>
                </div>
                <div class="task-progress-track">
                    <div class="task-progress-fill" id="task-progress-fill"></div>
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
                        <textarea id="task-add-notes" class="task-add-notes" rows="2" placeholder="Notas opcionais..."></textarea>
                    </div>
                </form>
            </div>

            <!-- Toolbar: search + filters + actions -->
            <div class="task-toolbar">
                <div class="task-search-wrap">
                    <i class="fas fa-search task-search-icon"></i>
                    <input type="text" id="task-search-input" class="task-search-input" placeholder="Buscar tarefas..." />
                </div>
                <div class="task-filters-wrap">
                    <button class="task-filter-chip active" data-filter="all">Todas <span class="task-chip-count" id="task-count-badge">0</span></button>
                    <button class="task-filter-chip" data-filter="active">Pendentes</button>
                    <button class="task-filter-chip" data-filter="completed">Concluídas</button>
                    <button class="task-filter-chip" data-filter="today">Hoje</button>
                    <button class="task-filter-chip" data-filter="overdue">Atrasadas</button>
                    <button class="task-filter-chip" data-filter="high">🔴 Alta</button>
                </div>
                <button class="task-clear-btn" id="task-clear-completed" title="Limpar concluídas">
                    <i class="fas fa-broom"></i> Limpar
                </button>
            </div>

            <!-- Task list -->
            <div id="task-list" class="task-list"></div>
        </div>
        `;
    }
}

// Export for use in other modules
window.TaskManager = TaskManager;