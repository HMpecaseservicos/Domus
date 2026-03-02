// Purpose Management Module
class PurposeManager {
    constructor(authManager) {
        this.auth = authManager;
        this.purpose = {
            mission: "Viver com propósito, autenticidade e contribuir positivamente para o mundo ao meu redor.",
            goals: "1. Desenvolver autoconhecimento profundo\n2. Alcançar liberdade financeira\n3. Cultivar relacionamentos significativos",
            values: "Integridade, Crescimento, Compaixão, Liberdade, Autenticidade"
        };
    }

    // Initialize purpose manager
    init() {
        this.renderPurpose();
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
        
        if (editMission) editMission.value = this.purpose.mission;
        if (editGoals) editGoals.value = this.purpose.goals;
        if (editValues) editValues.value = this.purpose.values;
        
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
        
        this.renderPurpose();
        this.hidePurposeModal();
        this.saveData();
        this.auth.showNotification('Propósito atualizado com sucesso!', 'success');
    }

    // Render purpose
    renderPurpose() {
        const personalMission = document.getElementById('personal-mission');
        const longTermGoals = document.getElementById('long-term-goals');
        const coreValues = document.getElementById('core-values');
        
        if (personalMission) personalMission.textContent = this.purpose.mission;
        if (longTermGoals) longTermGoals.innerHTML = this.purpose.goals.replace(/\n/g, '<br>');
        if (coreValues) coreValues.textContent = this.purpose.values;
    }

    // Save/load local data
    saveData() {
        try {
            const data = { purpose: this.purpose };
            localStorage.setItem('domus:purpose', JSON.stringify(data));
        } catch (e) {
            console.warn('Falha ao salvar propósito em localStorage:', e);
        }
    }

    loadData() {
        try {
            const raw = localStorage.getItem('domus:purpose');
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed.purpose && typeof parsed.purpose === 'object') {
                    this.purpose = { ...this.purpose, ...parsed.purpose };
                }
            }
        } catch (e) {
            console.warn('Erro ao carregar propósito do localStorage:', e);
        }
    }

    // Generate HTML template
    static getTemplate() {
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
                        <div class="purpose-title"><i class="fas fa-flag"></i> Missão Pessoal</div>
                        <div class="purpose-description" id="personal-mission">Viver com propósito, autenticidade e contribuir positivamente para o mundo ao meu redor.</div>
                        <div class="purpose-progress">
                            <div class="progress-fill" style="width: 75%"></div>
                        </div>
                    </div>
                    <div class="purpose-item">
                        <div class="purpose-title"><i class="fas fa-mountain"></i> Metas de Longo Prazo</div>
                        <div class="purpose-description" id="long-term-goals">1. Desenvolver autoconhecimento profundo<br>2. Alcançar liberdade financeira<br>3. Cultivar relacionamentos significativos</div>
                        <div class="purpose-progress">
                            <div class="progress-fill" style="width: 40%"></div>
                        </div>
                    </div>
                    <div class="purpose-item">
                        <div class="purpose-title"><i class="fas fa-heart"></i> Valores Fundamentais</div>
                        <div class="purpose-description" id="core-values">Integridade, Crescimento, Compaixão, Liberdade, Autenticidade</div>
                    </div>
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