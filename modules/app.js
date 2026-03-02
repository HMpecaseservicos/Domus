// Main Application Controller
class DomusApp {
    constructor() {
        this.authManager = new AuthManager();
        this.taskManager = new TaskManager(this.authManager);
        this.financeManager = new FinanceManager(this.authManager);
        this.thoughtsManager = new ThoughtsManager(this.authManager);
        this.gratitudeManager = new GratitudeManager(this.authManager);
        this.purposeManager = new PurposeManager(this.authManager);
        this.patternsManager = new PatternsManager(this.authManager);
        
        this.settings = {
            theme: 'light',
            userName: 'Usuário'
        };

        // ===== AUTH EVENT HANDLERS =====
        this.authManager.onLogin(() => this._handleLogin());
        this.authManager.onLogout(() => this._handleLogout());
    }

    // ===== AUTH-GATED LIFECYCLE =====

    /** Called after login — load all data from server and show app */
    async _handleLogin() {
        this.showApp();
        this.loadData();      // local cache for this user
        this.initializeModules();
        this.applyTheme();
        await this.loadServerData();  // overwrite with server truth
        this.saveData();              // cache server data locally
        this.updateAuthHeader();
    }

    /** Called on logout — clear memory, show auth screen */
    _handleLogout() {
        this._clearAllModuleData();
        this.initializeModules(); // re-render empty
        this.hideApp();
    }

    /** Clear in-memory data for all modules (does NOT delete localStorage) */
    _clearAllModuleData() {
        this.taskManager.tasks = [];
        this.financeManager.transactions = [];
        this.financeManager.income = 0;
        this.financeManager.expenses = 0;
        this.thoughtsManager.thoughts = [];
        this.gratitudeManager.gratitude = [];
        this.purposeManager.purpose = { mission: '', goals: '', values: '' };
        this.patternsManager.patterns = [];
    }

    /** Show/hide app vs auth screen */
    showApp() {
        const authScreen = document.getElementById('auth-screen');
        const appContainer = document.getElementById('app-container');
        if (authScreen) authScreen.style.display = 'none';
        if (appContainer) appContainer.style.display = '';
    }

    hideApp() {
        const authScreen = document.getElementById('auth-screen');
        const appContainer = document.getElementById('app-container');
        if (authScreen) authScreen.style.display = 'flex';
        if (appContainer) appContainer.style.display = 'none';
    }

    updateAuthHeader() {
        const username = this.authManager.getUsername();
        if (username) {
            const headerName = document.getElementById('header-user-name');
            const topbarAvatar = document.getElementById('topbar-avatar');
            const sidebarAvatar = document.getElementById('sidebar-avatar');
            const sidebarName = document.getElementById('sidebar-user-name');

            if (headerName) headerName.textContent = username;
            if (topbarAvatar) topbarAvatar.textContent = username.charAt(0).toUpperCase();
            if (sidebarAvatar) sidebarAvatar.textContent = username.charAt(0).toUpperCase();
            if (sidebarName) sidebarName.textContent = username;
        }
    }

    // Initialize application (called from index.html)
    init() {
        this.setupEventListeners();
        this.applyTheme();

        // Check if already logged in (token exists and valid)
        if (this.authManager.isLoggedIn()) {
            this.showApp();
            this.loadData();
            this.initializeModules();
            this.loadServerData().then(() => {
                this.saveData();
                this.updateAuthHeader();
            });
        } else {
            this.hideApp();
        }
    }

    // Bind event listeners for all content modules (call after templates are in DOM)
    bindAllModuleEvents() {
        this.taskManager.setupEventListeners();
        this.financeManager.setupEventListeners();
        this.thoughtsManager.setupEventListeners();
        this.gratitudeManager.setupEventListeners();
        this.purposeManager.setupEventListeners();
        this.patternsManager.setupEventListeners();
    }

    // Initialize all modules
    initializeModules() {
        this.taskManager.init();
        this.financeManager.init();
        this.thoughtsManager.init();
        this.gratitudeManager.init();
        this.purposeManager.init();
        this.patternsManager.init();
    }

    // Setup global event listeners
    setupEventListeners() {
        // Theme toggle
        const themeToggle = document.getElementById('theme-toggle');
        if (themeToggle) {
            themeToggle.addEventListener('click', () => this.toggleTheme());
        }

        // Export/Import
        const exportBtn = document.getElementById('export-btn');
        if (exportBtn) exportBtn.addEventListener('click', () => this.exportData());
        
        const importBtn = document.getElementById('import-btn');
        if (importBtn) importBtn.addEventListener('click', () => this.triggerImport());
        
        const importFile = document.getElementById('import-file');
        if (importFile) importFile.addEventListener('change', (e) => this.importData(e));
        
        const resetBtn = document.getElementById('reset-data-btn');
        if (resetBtn) resetBtn.addEventListener('click', () => this.resetData());

        // Close modals
        document.querySelectorAll('.close-modal').forEach(btn => {
            btn.addEventListener('click', () => this.authManager.hideAllModals());
        });
        
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) this.authManager.hideAllModals();
            });
        });
    }

    // Theme management
    toggleTheme() {
        document.body.classList.toggle('dark-mode');
        const themeToggle = document.getElementById('theme-toggle');
        if (!themeToggle) return;
        
        const icon = themeToggle.querySelector('i');
        const text = themeToggle.querySelector('.btn-text');
        
        if (document.body.classList.contains('dark-mode')) {
            if (icon) { icon.classList.remove('fa-moon'); icon.classList.add('fa-sun'); }
            if (text) text.textContent = 'Modo Claro';
            this.settings.theme = 'dark';
        } else {
            if (icon) { icon.classList.remove('fa-sun'); icon.classList.add('fa-moon'); }
            if (text) text.textContent = 'Modo Escuro';
            this.settings.theme = 'light';
        }
        
        this.saveData();
    }

    applyTheme() {
        if (this.settings.theme === 'dark') {
            document.body.classList.add('dark-mode');
            const themeToggle = document.getElementById('theme-toggle');
            if (!themeToggle) return;
            
            const icon = themeToggle.querySelector('i');
            const text = themeToggle.querySelector('.btn-text');
            if (icon) { icon.classList.remove('fa-moon'); icon.classList.add('fa-sun'); }
            if (text) text.textContent = 'Modo Claro';
        }
    }

    // Data management
    async loadServerData() {
        if (!this.authManager.getToken()) return;

        try {
            await Promise.all([
                this.taskManager.loadServerData(),
                this.financeManager.loadServerData(),
                this.thoughtsManager.loadServerData(),
                this.gratitudeManager.loadServerData(),
                this.purposeManager.loadServerData()
            ]);
            
            this.authManager.showNotification('Dados sincronizados do servidor.', 'success');
        } catch (err) {
            console.warn('Erro na sincronização com servidor:', err);
        }
    }

    // Export data
    exportData() {
        const data = {
            tasks: this.taskManager.tasks,
            finances: {
                transactions: this.financeManager.transactions,
                income: this.financeManager.income,
                expenses: this.financeManager.expenses
            },
            thoughts: this.thoughtsManager.thoughts,
            gratitude: this.gratitudeManager.gratitude,
            purpose: this.purposeManager.purpose,
            patterns: this.patternsManager.patterns,
            settings: this.settings,
            exportDate: new Date().toISOString()
        };

        const dataStr = JSON.stringify(data, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `domus-backup-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        this.authManager.showNotification('Dados exportados com sucesso!', 'success');
    }

    // Trigger import
    triggerImport() {
        const importFile = document.getElementById('import-file');
        if (importFile) importFile.click();
    }

    // Import data
    importData(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const importedData = JSON.parse(e.target.result);
                
                if (!this.isValidAppData(importedData)) {
                    this.authManager.showNotification('Arquivo de dados inválido.', 'error');
                    return;
                }

                // Import data to modules
                if (importedData.tasks) {
                    this.taskManager.tasks = importedData.tasks;
                }
                if (importedData.finances) {
                    this.financeManager.transactions = importedData.finances.transactions || [];
                    this.financeManager.income = importedData.finances.income || 0;
                    this.financeManager.expenses = importedData.finances.expenses || 0;
                }
                if (importedData.thoughts) {
                    this.thoughtsManager.thoughts = importedData.thoughts;
                }
                if (importedData.gratitude) {
                    this.gratitudeManager.gratitude = importedData.gratitude;
                }
                if (importedData.purpose) {
                    this.purposeManager.purpose = { ...this.purposeManager.purpose, ...importedData.purpose };
                }
                if (importedData.patterns) {
                    this.patternsManager.patterns = importedData.patterns;
                }
                if (importedData.settings) {
                    this.settings = { ...this.settings, ...importedData.settings };
                }

                this.initializeModules();
                this.applyTheme();
                this.saveData();
                this.authManager.showNotification('Dados importados com sucesso!', 'success');
            } catch (err) {
                this.authManager.showNotification('Erro ao importar dados. Verifique se o arquivo é válido.', 'error');
                console.error(err);
            }
        };
        
        reader.readAsText(file);
        event.target.value = '';
    }

    // Reset data
    resetData() {
        if (!confirm('Tem certeza que deseja limpar todos os dados? Esta ação não pode ser desfeita.')) {
            return;
        }

        this.taskManager.tasks = [];
        this.financeManager.transactions = [];
        this.financeManager.income = 0;
        this.financeManager.expenses = 0;
        this.thoughtsManager.thoughts = [];
        this.gratitudeManager.gratitude = [];
        this.patternsManager.patterns = [];

        this.initializeModules();
        this.saveData();
        this.authManager.showNotification('Todos os dados foram limpos.', 'info');
    }

    // Validate imported data
    isValidAppData(obj) {
        if (!obj || typeof obj !== 'object') return false;
        
        const hasTasks = !obj.tasks || Array.isArray(obj.tasks);
        const hasFinances = !obj.finances || (obj.finances && typeof obj.finances === 'object');
        const hasThoughts = !obj.thoughts || Array.isArray(obj.thoughts);
        
        return hasTasks && hasFinances && hasThoughts;
    }

    // Save/load local data
    saveData() {
        this.taskManager.saveData();
        this.financeManager.saveData();
        this.thoughtsManager.saveData();
        this.gratitudeManager.saveData();
        this.purposeManager.saveData();
        this.patternsManager.saveData();
        
        try {
            localStorage.setItem(this.authManager.getStorageKey('settings'), JSON.stringify(this.settings));
        } catch (e) {
            console.warn('Falha ao salvar configurações:', e);
        }
    }

    loadData() {
        this.taskManager.loadData();
        this.financeManager.loadData();
        this.thoughtsManager.loadData();
        this.gratitudeManager.loadData();
        this.purposeManager.loadData();
        this.patternsManager.loadData();
        
        try {
            const raw = localStorage.getItem(this.authManager.getStorageKey('settings'));
            if (raw) {
                const parsed = JSON.parse(raw);
                this.settings = { ...this.settings, ...parsed };
            }
        } catch (e) {
            // Silent fail for settings
        }
    }
}

// App is initialized from index.html after template injection
window.DomusApp = DomusApp;