// Auth Module - Gerenciamento de autenticação
class AuthManager {
    constructor() {
        this.API_BASE = window.location.hostname === 'localhost' 
            ? 'http://localhost:4000' 
            : window.location.origin;
        this.setupEventListeners();
    }

    // Token helpers
    setToken(token) { 
        localStorage.setItem('domus:token', token); 
        this.updateAuthUI(); 
    }
    
    getToken() { 
        return localStorage.getItem('domus:token'); 
    }
    
    clearToken() { 
        localStorage.removeItem('domus:token'); 
        this.updateAuthUI(); 
    }

    // API request wrapper
    async apiRequest(path, options = {}) {
        const headers = Object.assign({}, options.headers || {});
        if (this.getToken()) headers['Authorization'] = 'Bearer ' + this.getToken();
        if (!headers['Content-Type'] && !(options.body instanceof FormData)) {
            headers['Content-Type'] = 'application/json';
        }
        
        try {
            const response = await fetch(this.API_BASE + path, Object.assign({}, options, { headers }));
            const text = await response.text();
            let body = null;
            try { 
                body = text ? JSON.parse(text) : {}; 
            } catch(e) { 
                body = text; 
            }
            
            if (!response.ok) {
                throw body || { message: 'Request failed' };
            }
            return body;
        } catch (error) {
            throw error;
        }
    }

    // Update auth UI
    updateAuthUI() {
        const token = this.getToken();
        const loginBtn = document.getElementById('login-btn');
        const registerBtn = document.getElementById('register-btn');
        const logoutBtn = document.getElementById('logout-btn');
        
        if (!loginBtn || !registerBtn || !logoutBtn) return;

        if (token) {
            loginBtn.classList.add('hidden');
            registerBtn.classList.add('hidden');
            logoutBtn.classList.remove('hidden');
            
            // Fetch user info and display
            this.apiRequest('/api/me', { method: 'GET' }).then(resp => {
                if (resp && resp.user) {
                    const headerName = document.getElementById('header-user-name');
                    const headerAvatar = document.querySelector('#header-user-info .user-avatar');
                    if (headerName) headerName.textContent = resp.user.username;
                    if (headerAvatar) headerAvatar.textContent = resp.user.username ? resp.user.username.charAt(0).toUpperCase() : 'U';
                }
            }).catch(err => {
                console.warn('Não foi possível buscar /api/me', err);
            });
        } else {
            loginBtn.classList.remove('hidden');
            registerBtn.classList.remove('hidden');
            logoutBtn.classList.add('hidden');
            const headerName = document.getElementById('header-user-name');
            const headerAvatar = document.querySelector('#header-user-info .user-avatar');
            if (headerName) headerName.textContent = 'Usuário';
            if (headerAvatar) headerAvatar.textContent = 'U';
        }
    }

    // Event listeners
    setupEventListeners() {
        // Wait for DOM and then bind events
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.bindEvents());
        } else {
            // DOM already loaded, bind immediately
            this.bindEvents();
        }
    }

    bindEvents() {
        // Small delay to ensure all elements are rendered
        setTimeout(() => {
            const loginBtn = document.getElementById('login-btn');
            const registerBtn = document.getElementById('register-btn');
            const logoutBtn = document.getElementById('logout-btn');
            const loginSubmit = document.getElementById('login-submit');
            const registerSubmit = document.getElementById('register-submit');

            if (loginBtn) loginBtn.addEventListener('click', () => {
                this.showModal('login-modal');
            });
            if (registerBtn) registerBtn.addEventListener('click', () => {
                this.showModal('register-modal');
            });
            if (logoutBtn) logoutBtn.addEventListener('click', () => { 
                this.clearToken(); 
                this.showNotification('Desconectado', 'info'); 
            });

            if (loginSubmit) loginSubmit.addEventListener('click', () => {
                this.handleLogin();
            });
            if (registerSubmit) registerSubmit.addEventListener('click', () => {
                this.handleRegister();
            });

        // Setup modal close events
        document.querySelectorAll('.close-modal').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const modal = e.target.closest('.modal');
                if (modal) this.hideModal(modal.id);
            });
        });

        // Close modal when clicking outside
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) this.hideModal(modal.id);
            });
        });
        
            this.updateAuthUI();
        }, 100); // Small delay
    }

    // Auth handlers
    async handleLogin() {
        const u = document.getElementById('login-username');
        const p = document.getElementById('login-password');
        if (!u || !p) return;
        
        const username = u.value.trim();
        const password = p.value;
        
        if (!username || !password) {
            this.showNotification('Preencha usuário e senha.', 'warning');
            return;
        }

        try {
            const resp = await this.apiRequest('/auth/login', { 
                method: 'POST', 
                body: JSON.stringify({ username, password }) 
            });
            
            this.setToken(resp.token);
            this.hideAllModals();
            this.showNotification('Autenticado com sucesso!', 'success');
            
            // Trigger data sync
            if (window.app && window.app.loadServerData) {
                window.app.loadServerData();
            }
        } catch (err) {
            this.showNotification(err.message || 'Falha no login', 'error');
            console.error(err);
        }
    }

    async handleRegister() {
        const u = document.getElementById('register-username');
        const p = document.getElementById('register-password');
        if (!u || !p) return;
        
        const username = u.value.trim();
        const password = p.value;
        
        if (!username || !password) {
            this.showNotification('Preencha usuário e senha.', 'warning');
            return;
        }

        try {
            const resp = await this.apiRequest('/auth/register', { 
                method: 'POST', 
                body: JSON.stringify({ username, password }) 
            });
            
            this.setToken(resp.token);
            this.hideAllModals();
            this.showNotification('Conta criada e autenticada!', 'success');
            
            // Trigger data sync
            if (window.app && window.app.loadServerData) {
                window.app.loadServerData();
            }
        } catch (err) {
            this.showNotification(err.message || 'Falha no registro', 'error');
            console.error(err);
        }
    }

    // Modal helpers
    showModal(modalId) {
        const modal = document.getElementById(modalId);
        if (!modal) return;
        modal.style.display = 'flex';
        setTimeout(() => modal.classList.add('show'), 10);
    }

    hideModal(modalId) {
        const modal = document.getElementById(modalId);
        if (!modal) return;
        modal.classList.remove('show');
        setTimeout(() => modal.style.display = 'none', 300);
    }

    hideAllModals() {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.classList.remove('show');
            setTimeout(() => modal.style.display = 'none', 300);
        });
    }

    // Notification helper
    showNotification(message, type = 'info') {
        const notification = document.getElementById('notification');
        if (!notification) return;
        
        const icon = notification.querySelector('i');
        const content = notification.querySelector('.notification-content');
        
        notification.classList.remove('success', 'error', 'warning', 'info');
        notification.classList.add(type);
        
        const icons = {
            success: 'fa-check-circle',
            error: 'fa-exclamation-circle',
            warning: 'fa-exclamation-triangle',
            info: 'fa-info-circle'
        };
        
        if (icon) icon.className = `fas ${icons[type]}`;
        if (content) content.textContent = message;
        
        notification.classList.add('show');
        setTimeout(() => notification.classList.remove('show'), 5000);
    }
}

// Export for use in other modules
window.AuthManager = AuthManager;