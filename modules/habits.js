// ==========================================
//  VITAMIND – Habits Module
//  Hábitos com tracking diário, streaks e
//  calendário heatmap de 30 dias
// ==========================================

class HabitManager {
    constructor(authManager) {
        this.auth = authManager;
        this.habits = [];
        this.categories = [
            { id: 'saude', name: 'Saúde', icon: 'fa-heartbeat', color: '#EF4444' },
            { id: 'exercicio', name: 'Exercício', icon: 'fa-dumbbell', color: '#F59E0B' },
            { id: 'estudo', name: 'Estudo', icon: 'fa-book', color: '#3B82F6' },
            { id: 'meditacao', name: 'Meditação', icon: 'fa-brain', color: '#8B5CF6' },
            { id: 'leitura', name: 'Leitura', icon: 'fa-book-reader', color: '#10B981' },
            { id: 'alimentacao', name: 'Alimentação', icon: 'fa-apple-alt', color: '#EC4899' },
            { id: 'sono', name: 'Sono', icon: 'fa-moon', color: '#6366F1' },
            { id: 'outro', name: 'Outro', icon: 'fa-star', color: '#9CA3AF' }
        ];
        this.frequencies = [
            { id: 'daily', name: 'Diário' },
            { id: 'weekly', name: 'Semanal' },
            { id: 'monthly', name: 'Mensal' }
        ];
        this.editingId = null;
        this.viewFilter = 'all'; // all, active, inactive
    }

    // ===== INIT =====
    init() {
        this.renderAll();
    }

    setupEventListeners() {
        const addBtn = document.getElementById('habit-add-btn');
        if (addBtn) addBtn.addEventListener('click', () => this.addHabit());

        const nameInput = document.getElementById('habit-name');
        if (nameInput) nameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.addHabit();
        });

        // Filter chips
        document.querySelectorAll('.habit-filter-chip').forEach(chip => {
            chip.addEventListener('click', (e) => {
                document.querySelectorAll('.habit-filter-chip').forEach(c => c.classList.remove('active'));
                e.currentTarget.classList.add('active');
                this.viewFilter = e.currentTarget.dataset.filter;
                this.renderHabits();
            });
        });
    }

    // ===== ADD HABIT =====
    async addHabit() {
        const nameEl = document.getElementById('habit-name');
        const catEl = document.getElementById('habit-category');
        const freqEl = document.getElementById('habit-frequency');
        const targetEl = document.getElementById('habit-target');

        const name = nameEl?.value?.trim();
        if (!name) {
            this.auth.showNotification('Informe o nome do hábito.', 'warning');
            return;
        }

        const category = catEl?.value || 'outro';
        const frequency = freqEl?.value || 'daily';
        const target = parseInt(targetEl?.value) || 1;
        const catObj = this.categories.find(c => c.id === category);
        const icon = catObj?.icon || 'fa-star';
        const color = catObj?.color || '#9CA3AF';

        if (this.auth.getToken()) {
            try {
                const resp = await this.auth.apiRequest('/api/habits', {
                    method: 'POST',
                    body: JSON.stringify({ name, category, frequency, target, icon, color })
                });
                const h = this._mapServer(resp.habit);
                this.habits.push(h);
            } catch (err) {
                this.auth.showNotification(err.message || 'Erro ao criar hábito', 'error');
                return;
            }
        } else {
            this.habits.push({
                id: Date.now(),
                name,
                category,
                frequency,
                target,
                icon,
                color,
                active: true,
                logs: [],
                created_at: new Date().toISOString()
            });
        }

        if (nameEl) nameEl.value = '';
        if (targetEl) targetEl.value = '1';
        this.renderAll();
        this.saveData();
        this.auth.showNotification('Hábito criado!', 'success');
    }

    // ===== TOGGLE LOG =====
    async toggleLog(habitId, dateStr) {
        const habit = this.habits.find(h => h.id === habitId);
        if (!habit) return;

        const existingIdx = habit.logs.findIndex(l => l.date === dateStr);
        const hasLog = existingIdx !== -1;

        if (this.auth.getToken()) {
            try {
                if (hasLog) {
                    await this.auth.apiRequest(`/api/habits/${habitId}/log`, {
                        method: 'DELETE',
                        body: JSON.stringify({ date: dateStr })
                    });
                    habit.logs.splice(existingIdx, 1);
                } else {
                    const resp = await this.auth.apiRequest(`/api/habits/${habitId}/log`, {
                        method: 'POST',
                        body: JSON.stringify({ date: dateStr, value: 1 })
                    });
                    habit.logs.push({ date: dateStr, value: resp.log?.value || 1 });
                }
            } catch (err) {
                this.auth.showNotification(err.message || 'Erro', 'error');
                return;
            }
        } else {
            if (hasLog) {
                habit.logs.splice(existingIdx, 1);
            } else {
                habit.logs.push({ date: dateStr, value: 1 });
            }
        }

        this.renderAll();
        this.saveData();
    }

    // ===== TOGGLE TODAY =====
    toggleToday(habitId) {
        const today = this._todayStr();
        this.toggleLog(habitId, today);
    }

    // ===== DELETE =====
    async deleteHabit(id) {
        if (!confirm('Excluir este hábito e todo seu histórico?')) return;

        if (this.auth.getToken()) {
            try {
                await this.auth.apiRequest(`/api/habits/${id}`, { method: 'DELETE' });
            } catch (err) {
                this.auth.showNotification(err.message || 'Erro', 'error');
                return;
            }
        }

        this.habits = this.habits.filter(h => h.id !== id);
        this.renderAll();
        this.saveData();
        this.auth.showNotification('Hábito excluído.', 'info');
    }

    // ===== TOGGLE ACTIVE =====
    async toggleActive(id) {
        const habit = this.habits.find(h => h.id === id);
        if (!habit) return;

        habit.active = !habit.active;

        if (this.auth.getToken()) {
            try {
                await this.auth.apiRequest(`/api/habits/${id}`, {
                    method: 'PUT',
                    body: JSON.stringify({ active: habit.active })
                });
            } catch (err) {
                this.auth.showNotification(err.message || 'Erro', 'error');
                return;
            }
        }

        this.renderAll();
        this.saveData();
    }

    // ===== EDIT =====
    async editHabit(id) {
        const habit = this.habits.find(h => h.id === id);
        if (!habit) return;

        const name = prompt('Nome do hábito:', habit.name);
        if (!name || !name.trim()) return;

        habit.name = name.trim();

        if (this.auth.getToken()) {
            try {
                await this.auth.apiRequest(`/api/habits/${id}`, {
                    method: 'PUT',
                    body: JSON.stringify({ name: habit.name })
                });
            } catch (err) {
                this.auth.showNotification(err.message || 'Erro', 'error');
                return;
            }
        }

        this.renderAll();
        this.saveData();
        this.auth.showNotification('Hábito atualizado!', 'success');
    }

    // ===== RENDER ALL =====
    renderAll() {
        this.renderStats();
        this.renderHabits();
    }

    // ===== STATS =====
    renderStats() {
        const today = this._todayStr();
        const activeHabits = this.habits.filter(h => h.active);
        const completedToday = activeHabits.filter(h => h.logs.some(l => l.date === today)).length;
        const totalActive = activeHabits.length;
        const rate = totalActive > 0 ? Math.round((completedToday / totalActive) * 100) : 0;

        const rateEl = document.getElementById('habit-completion-rate');
        const countEl = document.getElementById('habit-completed-count');
        const totalEl = document.getElementById('habit-total-count');
        const streakEl = document.getElementById('habit-best-streak');

        if (rateEl) rateEl.textContent = `${rate}%`;
        if (countEl) countEl.textContent = completedToday;
        if (totalEl) totalEl.textContent = totalActive;

        // Best streak across all habits
        let bestStreak = 0;
        activeHabits.forEach(h => {
            const s = this._getStreak(h);
            if (s > bestStreak) bestStreak = s;
        });
        if (streakEl) streakEl.textContent = bestStreak;

        // Progress ring
        const ring = document.getElementById('habit-progress-ring');
        if (ring) {
            const circumference = 2 * Math.PI * 45;
            const offset = circumference - (rate / 100) * circumference;
            ring.style.strokeDasharray = circumference;
            ring.style.strokeDashoffset = offset;
        }
    }

    // ===== RENDER HABITS =====
    renderHabits() {
        const container = document.getElementById('habit-list');
        if (!container) return;

        let filtered = [...this.habits];
        if (this.viewFilter === 'active') filtered = filtered.filter(h => h.active);
        else if (this.viewFilter === 'inactive') filtered = filtered.filter(h => !h.active);

        if (filtered.length === 0) {
            container.innerHTML = `
                <div class="habit-empty">
                    <i class="fas fa-repeat"></i>
                    <p>${this.habits.length === 0 ? 'Nenhum hábito criado ainda' : 'Nenhum hábito neste filtro'}</p>
                </div>`;
            return;
        }

        const today = this._todayStr();

        container.innerHTML = filtered.map(h => {
            const catObj = this.categories.find(c => c.id === h.category) || this.categories[this.categories.length - 1];
            const streak = this._getStreak(h);
            const doneToday = h.logs.some(l => l.date === today);
            const freqLabel = this.frequencies.find(f => f.id === h.frequency)?.name || h.frequency;
            const calendar = this._buildCalendar(h);

            return `
            <div class="habit-card ${doneToday ? 'done-today' : ''} ${!h.active ? 'inactive' : ''}">
                <div class="habit-card-header">
                    <div class="habit-card-left">
                        <div class="habit-icon" style="background:${h.color || catObj.color}20;color:${h.color || catObj.color}">
                            <i class="fas ${h.icon || catObj.icon}"></i>
                        </div>
                        <div class="habit-info">
                            <span class="habit-name">${this._escapeHTML(h.name)}</span>
                            <span class="habit-meta">${catObj.name} · ${freqLabel}</span>
                        </div>
                    </div>
                    <div class="habit-card-right">
                        ${h.active ? `<button class="habit-check-btn ${doneToday ? 'checked' : ''}" onclick="window.app.habitManager.toggleToday(${h.id})" title="${doneToday ? 'Desmarcar' : 'Marcar como feito'}">
                            <i class="fas ${doneToday ? 'fa-check-circle' : 'fa-circle'}"></i>
                        </button>` : ''}
                        <div class="habit-streak ${streak > 0 ? 'active' : ''}">
                            <i class="fas fa-fire"></i> ${streak}
                        </div>
                    </div>
                </div>
                <div class="habit-calendar">${calendar}</div>
                <div class="habit-card-actions">
                    <button onclick="window.app.habitManager.editHabit(${h.id})" title="Editar"><i class="fas fa-pen"></i></button>
                    <button onclick="window.app.habitManager.toggleActive(${h.id})" title="${h.active ? 'Pausar' : 'Ativar'}"><i class="fas ${h.active ? 'fa-pause' : 'fa-play'}"></i></button>
                    <button onclick="window.app.habitManager.deleteHabit(${h.id})" title="Excluir"><i class="fas fa-trash"></i></button>
                </div>
            </div>`;
        }).join('');
    }

    // ===== CALENDAR HEATMAP (30 days) =====
    _buildCalendar(habit) {
        const days = [];
        const today = new Date();
        for (let i = 29; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(today.getDate() - i);
            const dateStr = this._dateStr(d);
            const hasLog = habit.logs.some(l => l.date === dateStr);
            const isToday = i === 0;
            const dayLabel = d.getDate();
            days.push(`<div class="habit-cal-day ${hasLog ? 'logged' : ''} ${isToday ? 'today' : ''}" 
                style="${hasLog ? `background:${habit.color || '#3B82F6'}` : ''}"
                onclick="window.app.habitManager.toggleLog(${habit.id},'${dateStr}')" 
                title="${d.toLocaleDateString('pt-BR')}${hasLog ? ' ✓' : ''}">${dayLabel}</div>`);
        }
        return `<div class="habit-cal-grid">${days.join('')}</div>`;
    }

    // ===== STREAK =====
    _getStreak(habit) {
        if (!habit.logs || habit.logs.length === 0) return 0;

        const sortedDates = habit.logs
            .map(l => l.date)
            .sort()
            .reverse();

        const today = this._todayStr();
        const yesterday = this._dateStr(new Date(Date.now() - 86400000));

        // Check if streak includes today or yesterday
        if (sortedDates[0] !== today && sortedDates[0] !== yesterday) return 0;

        let streak = 1;
        for (let i = 0; i < sortedDates.length - 1; i++) {
            const curr = new Date(sortedDates[i] + 'T12:00:00');
            const prev = new Date(sortedDates[i + 1] + 'T12:00:00');
            const diff = (curr - prev) / 86400000;
            if (diff === 1) {
                streak++;
            } else {
                break;
            }
        }
        return streak;
    }

    // ===== MAP SERVER =====
    _mapServer(item) {
        return {
            id: item.id,
            name: item.name,
            category: item.category || 'outro',
            frequency: item.frequency || 'daily',
            target: item.target || 1,
            icon: item.icon || 'fa-star',
            color: item.color || '#9CA3AF',
            active: item.active !== undefined ? item.active : true,
            logs: (item.logs || []).map(l => ({
                date: typeof l.date === 'string' ? l.date.substring(0, 10) : l.date,
                value: l.value || 1
            })),
            created_at: item.created_at
        };
    }

    // ===== SERVER DATA =====
    async loadServerData() {
        if (!this.auth.getToken()) return;
        try {
            const resp = await this.auth.apiRequest('/api/habits', { method: 'GET' });
            if (resp && Array.isArray(resp.habits)) {
                this.habits = resp.habits.map(h => this._mapServer(h));
                this.renderAll();
            }
        } catch (err) {
            console.warn('Erro ao carregar hábitos:', err);
        }
    }

    // ===== LOCAL STORAGE =====
    saveData() {
        try {
            localStorage.setItem(this.auth.getStorageKey('habits'), JSON.stringify({
                habits: this.habits
            }));
        } catch (e) {
            console.warn('Erro ao salvar hábitos:', e);
        }
    }

    loadData() {
        try {
            const raw = localStorage.getItem(this.auth.getStorageKey('habits'));
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed.habits && Array.isArray(parsed.habits)) {
                    this.habits = parsed.habits;
                }
            }
        } catch (e) {
            console.warn('Erro ao carregar hábitos:', e);
        }
    }

    // ===== HELPERS =====
    _todayStr() {
        return this._dateStr(new Date());
    }

    _dateStr(d) {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    }

    _escapeHTML(str) {
        if (window.DomusUtils) return DomusUtils.escapeHTML(str);
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    clearData() {
        this.habits = [];
        this.renderAll();
    }

    // ===== EXPORT / IMPORT =====
    exportData() {
        return { habits: this.habits };
    }

    importData(data) {
        if (data && data.habits) {
            this.habits = data.habits;
            this.renderAll();
        }
    }

    // ===== TEMPLATE =====
    static getTemplate() {
        return `
        <div class="habit-module">
            <!-- Stats Card -->
            <div class="habit-stats-card">
                <div class="habit-stats-ring-wrap">
                    <svg class="habit-ring-svg" viewBox="0 0 100 100">
                        <circle cx="50" cy="50" r="45" fill="none" stroke="var(--border-color)" stroke-width="6" />
                        <circle id="habit-progress-ring" cx="50" cy="50" r="45" fill="none" stroke="var(--accent-primary)" stroke-width="6"
                            stroke-linecap="round" transform="rotate(-90 50 50)"
                            stroke-dasharray="283" stroke-dashoffset="283" />
                    </svg>
                    <div class="habit-ring-text">
                        <span id="habit-completion-rate">0%</span>
                        <small>hoje</small>
                    </div>
                </div>
                <div class="habit-stats-grid">
                    <div class="habit-stat-item">
                        <div class="habit-stat-value" id="habit-completed-count">0</div>
                        <div class="habit-stat-label">Feitos</div>
                    </div>
                    <div class="habit-stat-item">
                        <div class="habit-stat-value" id="habit-total-count">0</div>
                        <div class="habit-stat-label">Ativos</div>
                    </div>
                    <div class="habit-stat-item">
                        <div class="habit-stat-value" id="habit-best-streak">0</div>
                        <div class="habit-stat-label"><i class="fas fa-fire"></i> Streak</div>
                    </div>
                </div>
            </div>

            <!-- Add Habit -->
            <div class="habit-add-card">
                <div class="habit-add-row">
                    <input type="text" id="habit-name" class="habit-add-input" placeholder="Novo hábito..." />
                    <button class="habit-add-btn" id="habit-add-btn"><i class="fas fa-plus"></i></button>
                </div>
                <div class="habit-add-details">
                    <select id="habit-category" class="habit-add-input">
                        <option value="saude">❤️ Saúde</option>
                        <option value="exercicio">💪 Exercício</option>
                        <option value="estudo">📚 Estudo</option>
                        <option value="meditacao">🧠 Meditação</option>
                        <option value="leitura">📖 Leitura</option>
                        <option value="alimentacao">🍎 Alimentação</option>
                        <option value="sono">🌙 Sono</option>
                        <option value="outro">⭐ Outro</option>
                    </select>
                    <select id="habit-frequency" class="habit-add-input">
                        <option value="daily">Diário</option>
                        <option value="weekly">Semanal</option>
                        <option value="monthly">Mensal</option>
                    </select>
                    <input type="number" id="habit-target" class="habit-add-input" value="1" min="1" max="99" placeholder="Meta" style="max-width:80px" />
                </div>
            </div>

            <!-- Filters -->
            <div class="habit-filters">
                <button class="habit-filter-chip active" data-filter="all">Todos</button>
                <button class="habit-filter-chip" data-filter="active">Ativos</button>
                <button class="habit-filter-chip" data-filter="inactive">Pausados</button>
            </div>

            <!-- Habit List -->
            <div class="habit-list" id="habit-list"></div>
        </div>
        `;
    }
}

// Export
window.HabitManager = HabitManager;
