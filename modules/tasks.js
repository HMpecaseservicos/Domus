// Task Management Module
class TaskManager {
    constructor(authManager) {
        this.auth = authManager;
        this.tasks = [];
        this.currentFilter = 'all';
    }

    // Initialize task manager
    init() {
        this.renderTasks();
        this.updateStats();
    }

    // Setup event listeners (call after DOM templates are injected)
    setupEventListeners() {
        const addTaskBtn = document.getElementById('add-task-button');
        if (addTaskBtn) addTaskBtn.addEventListener('click', () => this.addTask());
        
        const newTaskInput = document.getElementById('new-task-input');
        if (newTaskInput) {
            newTaskInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.addTask();
            });
        }

        // Filter buttons
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.currentFilter = e.target.getAttribute('data-filter');
                this.renderTasks();
            });
        });
    }

    // Add new task
    async addTask() {
        const taskInput = document.getElementById('new-task-input');
        const prioritySelect = document.getElementById('task-priority');
        const text = taskInput.value.trim();
        
        if (!text) {
            this.auth.showNotification('Por favor, digite uma tarefa.', 'warning');
            return;
        }

        const priority = prioritySelect ? prioritySelect.value : 'low';

        if (this.auth.getToken()) {
            try {
                const resp = await this.auth.apiRequest('/api/tasks', {
                    method: 'POST',
                    body: JSON.stringify({ text, priority })
                });
                
                const serverTask = resp.task;
                const task = {
                    id: serverTask.id,
                    text: serverTask.text,
                    completed: !!serverTask.completed,
                    priority: serverTask.priority || 'low',
                    createdAt: serverTask.created_at || new Date().toISOString()
                };
                
                this.tasks.unshift(task);
                taskInput.value = '';
                this.renderTasks();
                this.updateStats();
                this.saveData();
                this.auth.showNotification('Tarefa adicionada com sucesso!', 'success');
            } catch (err) {
                this.auth.showNotification(err.message || 'Erro ao criar tarefa', 'error');
                console.error(err);
            }
        } else {
            // Local fallback
            const task = {
                id: Date.now(),
                text: text,
                completed: false,
                priority: priority,
                createdAt: new Date().toISOString()
            };
            
            this.tasks.push(task);
            taskInput.value = '';
            this.renderTasks();
            this.updateStats();
            this.saveData();
            this.auth.showNotification('Tarefa adicionada com sucesso!', 'success');
        }
    }

    // Toggle task completion
    async toggleTask(id) {
        const task = this.tasks.find(t => t.id === id);
        if (!task) return;

        if (this.auth.getToken() && Number.isInteger(id)) {
            try {
                const resp = await this.auth.apiRequest(`/api/tasks/${id}/toggle`, {
                    method: 'PATCH'
                });
                
                const updated = resp.task;
                task.completed = !!updated.completed;
                this.renderTasks();
                this.updateStats();
                this.saveData();
                this.auth.showNotification(
                    task.completed ? 'Tarefa concluída!' : 'Tarefa reaberta',
                    'success'
                );
            } catch (err) {
                this.auth.showNotification(err.message || 'Erro', 'error');
                console.error(err);
            }
        } else {
            // Local fallback
            task.completed = !task.completed;
            this.renderTasks();
            this.updateStats();
            this.saveData();
            this.auth.showNotification(
                task.completed ? 'Tarefa concluída!' : 'Tarefa reaberta',
                'success'
            );
        }
    }

    // Delete task
    async deleteTask(id) {
        if (!confirm('Tem certeza que deseja excluir esta tarefa?')) return;
        
        if (this.auth.getToken() && Number.isInteger(id)) {
            try {
                await this.auth.apiRequest(`/api/tasks/${id}`, { method: 'DELETE' });
                this.tasks = this.tasks.filter(t => t.id !== id);
                this.renderTasks();
                this.updateStats();
                this.saveData();
                this.auth.showNotification('Tarefa excluída.', 'info');
            } catch (err) {
                this.auth.showNotification(err.message || 'Erro ao excluir', 'error');
                console.error(err);
            }
        } else {
            // Local fallback
            this.tasks = this.tasks.filter(t => t.id !== id);
            this.renderTasks();
            this.updateStats();
            this.saveData();
            this.auth.showNotification('Tarefa excluída.', 'info');
        }
    }

    // Render tasks
    renderTasks() {
        const taskList = document.getElementById('task-list');
        if (!taskList) return;
        
        taskList.innerHTML = '';
        let tasksToShow = [...this.tasks];
        
        // Apply filters
        if (this.currentFilter === 'active') {
            tasksToShow = tasksToShow.filter(t => !t.completed);
        } else if (this.currentFilter === 'completed') {
            tasksToShow = tasksToShow.filter(t => t.completed);
        } else if (this.currentFilter === 'high') {
            tasksToShow = tasksToShow.filter(t => t.priority === 'high');
        }

        if (tasksToShow.length === 0) {
            taskList.innerHTML = '<p style="text-align: center; color: var(--gray); padding: 20px;">Nenhuma tarefa encontrada.</p>';
            return;
        }

        // Sort tasks
        const sortedTasks = tasksToShow.sort((a, b) => {
            if (a.completed !== b.completed) return a.completed ? 1 : -1;
            const priorityOrder = { high: 3, medium: 2, low: 1 };
            return priorityOrder[b.priority] - priorityOrder[a.priority];
        });

        sortedTasks.forEach(task => {
            const taskElement = document.createElement('div');
            taskElement.className = 'task-item';
            
            const priorityText = { high: 'Alta', medium: 'Média', low: 'Baixa' };
            const priorityClass = { high: 'priority-high', medium: 'priority-medium', low: 'priority-low' };
            const safeText = window.DomusUtils ? DomusUtils.escapeHTML(task.text) : task.text;
            
            taskElement.innerHTML = `
                <input type="checkbox" class="task-checkbox" ${task.completed ? 'checked' : ''} 
                       onchange="window.app.taskManager.toggleTask(${task.id})">
                <div class="task-content">
                    <div class="task-text ${task.completed ? 'task-completed' : ''}">${safeText}</div>
                    <div class="task-meta">
                        <span class="task-priority ${priorityClass[task.priority]}">${priorityText[task.priority]}</span>
                        <span>${new Date(task.createdAt).toLocaleDateString('pt-BR')}</span>
                    </div>
                </div>
                <button class="icon-btn" onclick="window.app.taskManager.deleteTask(${task.id})">
                    <i class="fas fa-trash"></i>
                </button>
            `;
            taskList.appendChild(taskElement);
        });
    }

    // Update statistics
    updateStats() {
        const completedTasks = this.tasks.filter(t => t.completed).length;
        const elTasks = document.getElementById('tasks-completed');
        if (elTasks) elTasks.textContent = completedTasks;
    }

    // Load data from server
    async loadServerData() {
        if (!this.auth.getToken()) return;

        try {
            const resp = await this.auth.apiRequest('/api/tasks', { method: 'GET' });
            if (resp && Array.isArray(resp.tasks)) {
                this.tasks = resp.tasks.map(t => ({
                    id: t.id,
                    text: t.text,
                    completed: !!t.completed,
                    priority: t.priority || 'low',
                    createdAt: t.created_at || new Date().toISOString()
                }));
                this.renderTasks();
                this.updateStats();
            }
        } catch (err) {
            console.warn('Erro ao carregar tarefas do servidor:', err);
        }
    }

    // Save/load local data
    saveData() {
        try {
            const data = { tasks: this.tasks };
            localStorage.setItem('domus:tasks', JSON.stringify(data));
        } catch (e) {
            console.warn('Falha ao salvar tarefas em localStorage:', e);
        }
    }

    loadData() {
        try {
            const raw = localStorage.getItem('domus:tasks');
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed.tasks && Array.isArray(parsed.tasks)) {
                    this.tasks = parsed.tasks;
                }
            }
        } catch (e) {
            console.warn('Erro ao carregar tarefas do localStorage:', e);
        }
    }

    // Generate HTML template
    static getTemplate() {
        return `
            <div class="card">
                <div class="card-header">
                    <h2 class="card-title"><i class="fas fa-tasks"></i> Tarefas Diárias</h2>
                    <div class="card-actions">
                        <button class="icon-btn" id="task-settings-btn"><i class="fas fa-cog"></i></button>
                    </div>
                </div>
                <div class="task-filters">
                    <button class="filter-btn active" data-filter="all">Todas</button>
                    <button class="filter-btn" data-filter="active">Pendentes</button>
                    <button class="filter-btn" data-filter="completed">Concluídas</button>
                    <button class="filter-btn" data-filter="high">Prioridade Alta</button>
                </div>
                <div id="task-list">
                    <!-- Tarefas serão adicionadas aqui -->
                </div>
                <div class="add-task">
                    <input type="text" id="new-task-input" placeholder="Nova tarefa...">
                    <select id="task-priority">
                        <option value="low">Baixa</option>
                        <option value="medium">Média</option>
                        <option value="high">Alta</option>
                    </select>
                    <button class="btn btn-primary" id="add-task-button">Adicionar</button>
                </div>
            </div>
        `;
    }
}

// Export for use in other modules
window.TaskManager = TaskManager;