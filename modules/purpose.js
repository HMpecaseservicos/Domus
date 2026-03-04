// Purpose Management Module
class PurposeManager {
    constructor(authManager) {
        this.auth = authManager;
        this.purpose = {
            mission: "Viver com propósito, autenticidade e contribuir positivamente para o mundo ao meu redor.",
            goals: "1. Desenvolver autoconhecimento profundo\n2. Alcançar liberdade financeira\n3. Cultivar relacionamentos significativos",
            values: "Integridade, Crescimento, Compaixão, Liberdade, Autenticidade",
            vision: ""
        };
        this.structuredGoals = [];
        this.lifeAreas = [
            { id: 'trabalho', name: 'Trabalho', icon: 'fa-briefcase', color: '#3B82F6' },
            { id: 'financas', name: 'Finanças', icon: 'fa-coins', color: '#10B981' },
            { id: 'saude', name: 'Saúde', icon: 'fa-heartbeat', color: '#EF4444' },
            { id: 'espiritual', name: 'Espiritual', icon: 'fa-pray', color: '#8B5CF6' },
            { id: 'familia', name: 'Família', icon: 'fa-users', color: '#EC4899' },
            { id: 'estudos', name: 'Estudos', icon: 'fa-graduation-cap', color: '#6366F1' },
            { id: 'projetos', name: 'Projetos', icon: 'fa-rocket', color: '#F59E0B' }
        ];
    }

    // Initialize purpose manager
    init() {
        this.renderPurpose();
        this.renderGoals();
    }

    // Setup event listeners (call after DOM templates are injected)
    setupEventListeners() {
        const editPurposeBtn = document.getElementById('edit-purpose-btn');
        if (editPurposeBtn) editPurposeBtn.addEventListener('click', () => this.showPurposeModal());
        
        const savePurposeBtn = document.getElementById('save-purpose');
        if (savePurposeBtn) savePurposeBtn.addEventListener('click', () => this.savePurpose());
        
        const cancelPurposeBtn = document.getElementById('cancel-purpose');
        if (cancelPurposeBtn) cancelPurposeBtn.addEventListener('click', () => this.hidePurposeModal());
    }

    // Show purpose modal
    showPurposeModal() {
        const editMission = document.getElementById('edit-mission');
        const editGoals = document.getElementById('edit-goals');
        const editValues = document.getElementById('edit-values');
        const editVision = document.getElementById('edit-vision');
        
        if (editMission) editMission.value = this.purpose.mission;
        if (editGoals) editGoals.value = this.purpose.goals;
        if (editValues) editValues.value = this.purpose.values;
        if (editVision) editVision.value = this.purpose.vision || '';
        
        this.auth.showModal('purpose-modal');
    }

    // Hide purpose modal
    hidePurposeModal() {
        this.auth.hideModal('purpose-modal');
    }

    // Save purpose
    savePurpose() {
        const editMission = document.getElementById('edit-mission');
        const editGoals = document.getElementById('edit-goals');
        const editValues = document.getElementById('edit-values');
        
        if (editMission) this.purpose.mission = editMission.value;
        if (editGoals) this.purpose.goals = editGoals.value;
        if (editValues) this.purpose.values = editValues.value;

        const editVision = document.getElementById('edit-vision');
        if (editVision) this.purpose.vision = editVision.value;
        
        this.renderPurpose();
        this.hidePurposeModal();
        this.saveData();
        this.syncToServer();
        this.auth.showNotification('Propósito atualizado com sucesso!', 'success');
    }

    // Render purpose
    renderPurpose() {
        const personalMission = document.getElementById('personal-mission');
        const longTermGoals = document.getElementById('long-term-goals');
        const coreValues = document.getElementById('core-values');
        const visionEl = document.getElementById('purpose-vision');
        
        if (personalMission) personalMission.textContent = this.purpose.mission;
        if (longTermGoals) longTermGoals.innerHTML = this.purpose.goals.replace(/\n/g, '<br>');
        if (coreValues) coreValues.textContent = this.purpose.values;
        if (visionEl) visionEl.textContent = this.purpose.vision || 'Defina sua visão de vida...';
    }

    // ===== STRUCTURED GOALS =====
    async loadGoals() {
        if (!this.auth.getToken()) return;
        try {
            const resp = await this.auth.apiRequest('/api/goals', { method: 'GET' });
            if (resp && Array.isArray(resp.goals)) {
                this.structuredGoals = resp.goals;
                this.renderGoals();
            }
        } catch (err) { console.warn('Erro ao carregar metas:', err); }
    }

    async addGoal() {
        const titleEl = document.getElementById('goal-add-title');
        const areaEl = document.getElementById('goal-add-area');
        const dateEl = document.getElementById('goal-add-date');
        const title = titleEl?.value?.trim();
        if (!title) { this.auth.showNotification('Informe o título da meta.', 'warning'); return; }

        const goalData = {
            title,
            description: '',
            life_area: areaEl?.value || '',
            target_date: dateEl?.value || null,
            progress: 0,
            status: 'active'
        };

        if (this.auth.getToken()) {
            try {
                const resp = await this.auth.apiRequest('/api/goals', {
                    method: 'POST',
                    body: JSON.stringify(goalData)
                });
                this.structuredGoals.push(resp.goal);
            } catch (err) { this.auth.showNotification(err.message || 'Erro', 'error'); return; }
        } else {
            this.structuredGoals.push({ id: Date.now(), ...goalData });
        }

        if (titleEl) titleEl.value = '';
        if (dateEl) dateEl.value = '';
        this.renderGoals();
        this.saveData();
        this.auth.showNotification('Meta adicionada!', 'success');
    }

    async updateGoalProgress(id, progress) {
        const goal = this.structuredGoals.find(g => g.id === id);
        if (!goal) return;
        goal.progress = parseInt(progress);
        if (goal.progress >= 100) goal.status = 'completed';

        if (this.auth.getToken() && Number.isInteger(id)) {
            try {
                await this.auth.apiRequest(`/api/goals/${id}`, {
                    method: 'PUT',
                    body: JSON.stringify({ progress: goal.progress, status: goal.status })
                });
            } catch (err) { console.warn('Erro ao atualizar meta:', err); }
        }
        this.renderGoals();
        this.saveData();
    }

    async deleteGoal(id) {
        if (!confirm('Excluir esta meta?')) return;
        if (this.auth.getToken() && Number.isInteger(id)) {
            try { await this.auth.apiRequest(`/api/goals/${id}`, { method: 'DELETE' }); }
            catch (err) { this.auth.showNotification(err.message || 'Erro', 'error'); return; }
        }
        this.structuredGoals = this.structuredGoals.filter(g => g.id !== id);
        this.renderGoals();
        this.saveData();
    }

    renderGoals() {
        const container = document.getElementById('goals-list');
        if (!container) return;

        if (this.structuredGoals.length === 0) {
            container.innerHTML = '<div class="purpose-empty">Nenhuma meta definida. Adicione sua primeira meta acima.</div>';
            return;
        }

        container.innerHTML = this.structuredGoals.map(g => {
            const area = this.lifeAreas.find(a => a.id === g.life_area);
            const pct = g.progress || 0;
            const statusLabel = g.status === 'completed' ? 'Concluída' : g.status === 'paused' ? 'Pausada' : 'Ativa';
            const statusClass = g.status === 'completed' ? 'goal-done' : g.status === 'paused' ? 'goal-paused' : 'goal-active';

            return `
                <div class="goal-card ${statusClass}">
                    <div class="goal-header">
                        <div class="goal-title">${this._esc(g.title)}</div>
                        <div class="goal-actions">
                            <button class="goal-del-btn" onclick="window.app.purposeManager.deleteGoal(${g.id})" title="Excluir"><i class="fas fa-times"></i></button>
                        </div>
                    </div>
                    <div class="goal-meta">
                        ${area ? `<span class="goal-area-badge" style="color:${area.color}"><i class="fas ${area.icon}"></i> ${area.name}</span>` : ''}
                        <span class="goal-status ${statusClass}">${statusLabel}</span>
                        ${g.target_date ? `<span class="goal-date"><i class="fas fa-calendar"></i> ${new Date(g.target_date + 'T12:00:00').toLocaleDateString('pt-BR')}</span>` : ''}
                    </div>
                    <div class="goal-progress">
                        <div class="goal-progress-track">
                            <div class="goal-progress-fill" style="width:${pct}%;background:${area ? area.color : '#3B82F6'}"></div>
                        </div>
                        <input type="range" class="goal-progress-slider" min="0" max="100" value="${pct}" 
                               oninput="this.previousElementSibling.querySelector('.goal-progress-fill').style.width=this.value+'%';this.nextElementSibling.textContent=this.value+'%'" 
                               onchange="window.app.purposeManager.updateGoalProgress(${g.id},this.value)" />
                        <span class="goal-progress-label">${pct}%</span>
                    </div>
                </div>`;
        }).join('');

        // Update goal select in task forms
        this._updateGoalSelects();
    }

    _updateGoalSelects() {
        const selects = document.querySelectorAll('[id^="task-add-goal"],[id^="task-edit-goal-"]');
        selects.forEach(sel => {
            const current = sel.value;
            const options = '<option value="">Sem meta</option>' +
                this.structuredGoals.filter(g => g.status === 'active').map(g => 
                    `<option value="${g.id}" ${String(g.id) === current ? 'selected' : ''}>${this._esc(g.title)}</option>`
                ).join('');
            sel.innerHTML = options;
        });
    }

    _esc(str) {
        if (window.DomusUtils) return DomusUtils.escapeHTML(str);
        const d = document.createElement('div'); d.textContent = str; return d.innerHTML;
    }

    // Save/load local data
    saveData() {
        try {
            const data = { purpose: this.purpose, structuredGoals: this.structuredGoals };
            localStorage.setItem(this.auth.getStorageKey('purpose'), JSON.stringify(data));
        } catch (e) {
            console.warn('Falha ao salvar propósito em localStorage:', e);
        }
    }

    loadData() {
        try {
            const raw = localStorage.getItem(this.auth.getStorageKey('purpose'));
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed.purpose && typeof parsed.purpose === 'object') {
                    this.purpose = { ...this.purpose, ...parsed.purpose };
                }
                if (parsed.structuredGoals) this.structuredGoals = parsed.structuredGoals;
            }
        } catch (e) {
            console.warn('Erro ao carregar propósito do localStorage:', e);
        }
    }

    // Server sync
    async loadServerData() {
        if (!this.auth.getToken()) return;
        try {
            const resp = await this.auth.apiRequest('/api/purpose', { method: 'GET' });
            if (resp && resp.purpose) {
                this.purpose.mission = resp.purpose.mission || '';
                this.purpose.goals = resp.purpose.goals || '';
                this.purpose.values = resp.purpose.values || '';
                this.purpose.vision = resp.purpose.vision || '';
                this.renderPurpose();
                this.saveData();
            }
        } catch (err) {
            console.warn('Erro ao carregar propósito do servidor:', err);
        }
        await this.loadGoals();
    }

    async syncToServer() {
        if (!this.auth.getToken()) return;
        try {
            await this.auth.apiRequest('/api/purpose', {
                method: 'PUT',
                body: JSON.stringify(this.purpose)
            });
        } catch (err) {
            console.warn('Erro ao salvar propósito no servidor:', err);
        }
    }

    // Generate HTML template
    static getTemplate() {
        const areaOptions = [
            { id: 'trabalho', name: 'Trabalho' }, { id: 'financas', name: 'Finanças' },
            { id: 'saude', name: 'Saúde' }, { id: 'espiritual', name: 'Espiritual' },
            { id: 'familia', name: 'Família' }, { id: 'estudos', name: 'Estudos' },
            { id: 'projetos', name: 'Projetos' }
        ].map(a => `<option value="${a.id}">${a.name}</option>`).join('');

        return `
            <div class="card">
                <div class="card-header">
                    <h2 class="card-title"><i class="fas fa-bullseye"></i> Propósito de Vida</h2>
                    <div class="card-actions">
                        <button class="icon-btn" id="edit-purpose-btn"><i class="fas fa-edit"></i></button>
                    </div>
                </div>
                <div id="purpose-list">
                    <div class="purpose-item">
                        <div class="purpose-title"><i class="fas fa-eye"></i> Visão</div>
                        <div class="purpose-description" id="purpose-vision">Defina sua visão de vida...</div>
                    </div>
                    <div class="purpose-item">
                        <div class="purpose-title"><i class="fas fa-flag"></i> Missão Pessoal</div>
                        <div class="purpose-description" id="personal-mission">Viver com propósito, autenticidade e contribuir positivamente para o mundo ao meu redor.</div>
                    </div>
                    <div class="purpose-item">
                        <div class="purpose-title"><i class="fas fa-mountain"></i> Metas de Longo Prazo</div>
                        <div class="purpose-description" id="long-term-goals">1. Desenvolver autoconhecimento profundo<br>2. Alcançar liberdade financeira</div>
                    </div>
                    <div class="purpose-item">
                        <div class="purpose-title"><i class="fas fa-heart"></i> Valores Fundamentais</div>
                        <div class="purpose-description" id="core-values">Integridade, Crescimento, Compaixão, Liberdade, Autenticidade</div>
                    </div>
                </div>

                <div class="purpose-goals-section">
                    <h3 class="purpose-goals-title"><i class="fas fa-flag-checkered"></i> Metas Estruturadas</h3>
                    <div class="goal-add-row">
                        <input type="text" id="goal-add-title" class="goal-add-input" placeholder="Nova meta..." />
                        <select id="goal-add-area" class="goal-add-select">
                            <option value="">Área</option>
                            ${areaOptions}
                        </select>
                        <input type="date" id="goal-add-date" class="goal-add-date" title="Data alvo" />
                        <button class="btn btn-primary btn-sm" onclick="window.app.purposeManager.addGoal()"><i class="fas fa-plus"></i></button>
                    </div>
                    <div id="goals-list"></div>
                </div>
            </div>
        `;
    }

    // Purpose modal template
    static getPurposeModalTemplate() {
        return `
            <div class="modal" id="purpose-modal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3 class="modal-title">Editar Propósito de Vida</h3>
                        <button class="close-modal">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="form-group">
                            <label for="edit-vision">Visão</label>
                            <textarea id="edit-vision" class="form-control" rows="3"></textarea>
                        </div>
                        <div class="form-group">
                            <label for="edit-mission">Missão Pessoal</label>
                            <textarea id="edit-mission" class="form-control" rows="3"></textarea>
                        </div>
                        <div class="form-group">
                            <label for="edit-goals">Metas de Longo Prazo</label>
                            <textarea id="edit-goals" class="form-control" rows="4"></textarea>
                        </div>
                        <div class="form-group">
                            <label for="edit-values">Valores Fundamentais</label>
                            <textarea id="edit-values" class="form-control" rows="3"></textarea>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-outline" id="cancel-purpose">Cancelar</button>
                        <button class="btn btn-primary" id="save-purpose">Salvar Alterações</button>
                    </div>
                </div>
            </div>
        `;
    }
}

// Export for use in other modules
window.PurposeManager = PurposeManager;