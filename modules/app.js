// Main Application Controller — Lazy Loading Architecture
class DomusApp {
    constructor() {
        this.authManager = new AuthManager();
        
        // Module registry — lazy loaded on demand
        this._modules = {
            tasks: { loaded: false, manager: null, cls: 'TaskManager', script: 'modules/tasks.js', container: 'module-tasks' },
            finances: { loaded: false, manager: null, cls: 'FinanceManager', script: 'modules/finances.js', container: 'module-finances' },
            thoughts: { loaded: false, manager: null, cls: 'ThoughtsManager', script: 'modules/thoughts.js', container: 'module-thoughts' },
            gratitude: { loaded: false, manager: null, cls: 'GratitudeManager', script: 'modules/gratitude.js', container: 'module-gratitude' },
            purpose: { loaded: false, manager: null, cls: 'PurposeManager', script: 'modules/purpose.js', container: 'module-purpose' },
            patterns: { loaded: false, manager: null, cls: 'PatternsManager', script: 'modules/patterns.js', container: 'module-patterns' },
            habits: { loaded: false, manager: null, cls: 'HabitManager', script: 'modules/habits.js', container: 'module-habits' }
        };

        // Compatibility getters for existing code
        Object.defineProperty(this, 'taskManager', { get: () => this._modules.tasks.manager });
        Object.defineProperty(this, 'financeManager', { get: () => this._modules.finances.manager });
        Object.defineProperty(this, 'thoughtsManager', { get: () => this._modules.thoughts.manager });
        Object.defineProperty(this, 'gratitudeManager', { get: () => this._modules.gratitude.manager });
        Object.defineProperty(this, 'purposeManager', { get: () => this._modules.purpose.manager });
        Object.defineProperty(this, 'patternsManager', { get: () => this._modules.patterns.manager });
        Object.defineProperty(this, 'habitManager', { get: () => this._modules.habits.manager });
        
        this.settings = {
            theme: 'light',
            userName: 'Usuário'
        };

        this._loadingModules = new Set();

        // ===== AUTH EVENT HANDLERS =====
        this.authManager.onLogin(() => this._handleLogin());
        this.authManager.onLogout(() => this._handleLogout());
    }

    // ===== LAZY MODULE LOADING =====
    
    /** Load a single module on demand */
    async loadModule(name) {
        const mod = this._modules[name];
        if (!mod || mod.loaded) return mod?.manager;
        if (this._loadingModules.has(name)) {
            // Wait for ongoing load
            return new Promise(resolve => {
                const check = () => {
                    if (mod.loaded) return resolve(mod.manager);
                    setTimeout(check, 50);
                };
                check();
            });
        }

        this._loadingModules.add(name);

        try {
            // Load script if class not available yet
            if (!window[mod.cls]) {
                await this._loadScript(mod.script);
            }

            const Cls = window[mod.cls];
            if (!Cls) throw new Error(`Class ${mod.cls} not found after loading ${mod.script}`);

            // Inject template
            const container = document.getElementById(mod.container);
            if (container && Cls.getTemplate && !container.innerHTML.trim()) {
                container.innerHTML = Cls.getTemplate();
            }

            // Instantiate
            mod.manager = new Cls(this.authManager);
            mod.manager.setupEventListeners();

            // Load data and init if logged in
            if (this.authManager.isLoggedIn()) {
                if (mod.manager.loadData) mod.manager.loadData();
                if (mod.manager.init) mod.manager.init();
                if (mod.manager.loadServerData) {
                    mod.manager.loadServerData().catch(err => 
                        console.warn(`Erro ao carregar dados do servidor (${name}):`, err)
                    );
                }
            }

            mod.loaded = true;
            console.log(`[DOMUS] Module "${name}" loaded on demand`);
            return mod.manager;
        } catch (err) {
            console.error(`[DOMUS] Failed to load module "${name}":`, err);
            return null;
        } finally {
            this._loadingModules.delete(name);
        }
    }

    /** Load all modules (for bulk operations like export/import) */
    async loadAllModules() {
        const names = Object.keys(this._modules);
        await Promise.all(names.map(n => this.loadModule(n)));
    }

    /** Dynamic script loader */
    _loadScript(src) {
        return new Promise((resolve, reject) => {
            // If already loaded, resolve immediately
            const existing = document.querySelector(`script[src="${src}"]`);
            if (existing) return resolve();

            const script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = () => reject(new Error(`Failed to load ${src}`));
            document.head.appendChild(script);
        });
    }

    // ===== AUTH-GATED LIFECYCLE =====

    /** Called after login — load active view module, then others in background */
    async _handleLogin() {
        this.showApp();
        this.applyTheme();
        this.updateAuthHeader();
        
        // Load the currently visible view module first
        const activeView = document.querySelector('.view-active');
        const currentView = activeView?.id?.replace('view-', '') || 'home';
        
        if (this._modules[currentView]) {
            await this.loadModule(currentView);
        }

        // Load remaining modules in background (low priority)
        setTimeout(() => this._loadRemainingModules(), 300);
    }

    /** Called on logout — clear memory, show auth screen */
    _handleLogout() {
        this._clearAllModuleData();
        // Re-render loaded modules as empty
        for (const [name, mod] of Object.entries(this._modules)) {
            if (mod.loaded && mod.manager?.init) mod.manager.init();
        }
        this.hideApp();
    }

    /** Clear in-memory data for all loaded modules */
    _clearAllModuleData() {
        const m = this._modules;
        if (m.tasks.manager) { m.tasks.manager.tasks = []; }
        if (m.finances.manager) { m.finances.manager.transactions = []; m.finances.manager.income = 0; m.finances.manager.expenses = 0; }
        if (m.thoughts.manager) { m.thoughts.manager.thoughts = []; }
        if (m.gratitude.manager) { m.gratitude.manager.gratitude = []; }
        if (m.purpose.manager) { m.purpose.manager.purpose = { mission: '', goals: '', values: '' }; }
        if (m.patterns.manager) { m.patterns.manager.analytics = null; }
        if (m.habits.manager) { m.habits.manager.habits = []; }
    }

    /** Load remaining unloaded modules in background */
    async _loadRemainingModules() {
        for (const name of Object.keys(this._modules)) {
            if (!this._modules[name].loaded) {
                await this.loadModule(name);
            }
        }
        // Save all data to local cache after full sync
        this.saveData();
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
            this.updateAuthHeader();
            // Load home stats modules first (tasks + finances for dashboard)
            Promise.all([
                this.loadModule('tasks'),
                this.loadModule('finances'),
                this.loadModule('thoughts'),
                this.loadModule('gratitude')
            ]).then(() => {
                // Load rest in background
                setTimeout(() => this._loadRemainingModules(), 500);
            });
        } else {
            this.hideApp();
        }
    }

    // Bind event listeners for loaded modules only
    bindAllModuleEvents() {
        for (const mod of Object.values(this._modules)) {
            if (mod.loaded && mod.manager?.setupEventListeners) {
                mod.manager.setupEventListeners();
            }
        }
    }

    // Initialize loaded modules only
    initializeModules() {
        for (const mod of Object.values(this._modules)) {
            if (mod.loaded && mod.manager?.init) {
                mod.manager.init();
            }
        }
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
            const loadPromises = [];
            for (const mod of Object.values(this._modules)) {
                if (mod.loaded && mod.manager?.loadServerData) {
                    loadPromises.push(mod.manager.loadServerData());
                }
            }
            await Promise.all(loadPromises);
            
            this.authManager.showNotification('Dados sincronizados do servidor.', 'success');
        } catch (err) {
            console.warn('Erro na sincronização com servidor:', err);
        }
    }

    // Export data
    async exportData() {
        // Ensure all modules loaded before export
        await this.loadAllModules();
        
        const data = {
            tasks: this.taskManager?.tasks || [],
            finances: {
                transactions: this.financeManager?.transactions || [],
                income: this.financeManager?.income || 0,
                expenses: this.financeManager?.expenses || 0
            },
            thoughts: this.thoughtsManager?.thoughts || [],
            gratitude: this.gratitudeManager?.gratitude || [],
            purpose: this.purposeManager?.purpose || {},
            patterns: this.patternsManager?.analytics || null,
            habits: this.habitManager?.exportData?.() || [],
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
    async importData(event) {
        const file = event.target.files[0];
        if (!file) return;

        // Ensure all modules loaded before import
        await this.loadAllModules();

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const importedData = JSON.parse(e.target.result);
                
                if (!this.isValidAppData(importedData)) {
                    this.authManager.showNotification('Arquivo de dados inválido.', 'error');
                    return;
                }

                // Import data to modules
                if (importedData.tasks && this.taskManager) {
                    this.taskManager.tasks = importedData.tasks;
                }
                if (importedData.finances && this.financeManager) {
                    this.financeManager.transactions = importedData.finances.transactions || [];
                    this.financeManager.income = importedData.finances.income || 0;
                    this.financeManager.expenses = importedData.finances.expenses || 0;
                }
                if (importedData.thoughts && this.thoughtsManager) {
                    this.thoughtsManager.thoughts = importedData.thoughts;
                }
                if (importedData.gratitude && this.gratitudeManager) {
                    this.gratitudeManager.gratitude = importedData.gratitude;
                }
                if (importedData.purpose && this.purposeManager) {
                    this.purposeManager.purpose = { ...this.purposeManager.purpose, ...importedData.purpose };
                }
                if (importedData.patterns && this.patternsManager) {
                    this.patternsManager.analytics = importedData.patterns;
                }
                if (importedData.habits && this.habitManager) {
                    this.habitManager.importData(importedData.habits);
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
    async resetData() {
        if (!confirm('Tem certeza que deseja limpar todos os dados? Esta ação não pode ser desfeita.')) {
            return;
        }

        await this.loadAllModules();
        
        if (this.taskManager) this.taskManager.tasks = [];
        if (this.financeManager) { this.financeManager.transactions = []; this.financeManager.income = 0; this.financeManager.expenses = 0; }
        if (this.thoughtsManager) this.thoughtsManager.thoughts = [];
        if (this.gratitudeManager) this.gratitudeManager.gratitude = [];
        if (this.patternsManager) this.patternsManager.analytics = null;
        if (this.habitManager) this.habitManager.habits = [];

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

    // Save/load local data (only for loaded modules)
    saveData() {
        for (const mod of Object.values(this._modules)) {
            if (mod.loaded && mod.manager?.saveData) mod.manager.saveData();
        }
        
        try {
            localStorage.setItem(this.authManager.getStorageKey('settings'), JSON.stringify(this.settings));
        } catch (e) {
            console.warn('Falha ao salvar configurações:', e);
        }
    }

    loadData() {
        for (const mod of Object.values(this._modules)) {
            if (mod.loaded && mod.manager?.loadData) mod.manager.loadData();
        }
        
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