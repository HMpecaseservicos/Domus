// Gratitude Management Module
class GratitudeManager {
    constructor(authManager) {
        this.auth = authManager;
        this.gratitude = [];
    }

    // Initialize gratitude manager
    init() {
        this.renderGratitude();
        this.updateStats();
    }

    // Setup event listeners (call after DOM templates are injected)
    setupEventListeners() {
        const addGratitudeBtn = document.getElementById('add-gratitude');
        if (addGratitudeBtn) addGratitudeBtn.addEventListener('click', () => this.addGratitude());
        
        const newGratitude = document.getElementById('new-gratitude');
        if (newGratitude) {
            newGratitude.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.addGratitude();
            });
        }
    }

    // Add new gratitude item
    async addGratitude() {
        const gratitudeInput = document.getElementById('new-gratitude');
        if (!gratitudeInput) return;
        
        const text = gratitudeInput.value.trim();
        if (!text) {
            this.auth.showNotification('Por favor, digite um item de gratidão.', 'warning');
            return;
        }

        if (this.auth.getToken()) {
            try {
                const resp = await this.auth.apiRequest('/api/gratitude', {
                    method: 'POST',
                    body: JSON.stringify({ text })
                });
                
                const serverItem = resp.item;
                const item = {
                    id: serverItem.id,
                    text: serverItem.text,
                    date: serverItem.date || new Date().toISOString()
                };
                
                this.gratitude.unshift(item);
                gratitudeInput.value = '';
                this.renderGratitude();
                this.updateStats();
                this.saveData();
                this.auth.showNotification('Item de gratidão adicionado!', 'success');
            } catch (err) {
                this.auth.showNotification(err.message || 'Erro ao adicionar gratidão', 'error');
                console.error(err);
            }
        } else {
            // Local fallback
            const item = {
                id: Date.now(),
                text: text,
                date: new Date().toISOString()
            };
            
            this.gratitude.push(item);
            gratitudeInput.value = '';
            this.renderGratitude();
            this.updateStats();
            this.saveData();
            this.auth.showNotification('Item de gratidão adicionado!', 'success');
        }
    }

    // Render gratitude items
    renderGratitude() {
        const gratitudeList = document.getElementById('gratitude-list');
        if (!gratitudeList) return;
        
        gratitudeList.innerHTML = '';
        
        if (this.gratitude.length === 0) {
            gratitudeList.innerHTML = '<p style="text-align: center; color: var(--gray); padding: 20px;">Nenhum item de gratidão adicionado ainda.</p>';
            return;
        }

        const recentGratitude = this.gratitude.slice(-5).reverse();
        recentGratitude.forEach(item => {
            const gratitudeElement = document.createElement('div');
            gratitudeElement.className = 'gratitude-item';
            const safeText = window.DomusUtils ? DomusUtils.escapeHTML(item.text) : item.text;
            gratitudeElement.innerHTML = `
                <i class="fas fa-heart"></i>
                <span>${safeText}</span>
            `;
            gratitudeList.appendChild(gratitudeElement);
        });
    }

    // Update statistics
    updateStats() {
        const gratitudeCount = document.getElementById('gratitude-count');
        if (gratitudeCount) gratitudeCount.textContent = this.gratitude.length;
    }

    // Load data from server
    async loadServerData() {
        if (!this.auth.getToken()) return;

        try {
            const resp = await this.auth.apiRequest('/api/gratitude', { method: 'GET' });
            if (resp && Array.isArray(resp.gratitude)) {
                this.gratitude = resp.gratitude.map(g => ({
                    id: g.id,
                    text: g.text,
                    date: g.date || new Date().toISOString()
                }));
                this.renderGratitude();
                this.updateStats();
            }
        } catch (err) {
            console.warn('Erro ao carregar gratidão do servidor:', err);
        }
    }

    // Save/load local data
    saveData() {
        try {
            const data = { gratitude: this.gratitude };
            localStorage.setItem('domus:gratitude', JSON.stringify(data));
        } catch (e) {
            console.warn('Falha ao salvar gratidão em localStorage:', e);
        }
    }

    loadData() {
        try {
            const raw = localStorage.getItem('domus:gratitude');
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed.gratitude && Array.isArray(parsed.gratitude)) {
                    this.gratitude = parsed.gratitude;
                }
            }
        } catch (e) {
            console.warn('Erro ao carregar gratidão do localStorage:', e);
        }
    }

    // Generate HTML template
    static getTemplate() {
        return `
            <div class="card">
                <div class="card-header">
                    <h2 class="card-title"><i class="fas fa-pray"></i> Vida Espiritual</h2>
                    <div class="card-actions">
                        <button class="icon-btn" id="refresh-quote-btn"><i class="fas fa-sync-alt"></i></button>
                    </div>
                </div>
                <div class="quote-container">
                    <p class="quote-text" id="daily-quote">"A jornada de mil milhas começa com um único passo."</p>
                    <p class="quote-author" id="quote-author">- Lao Tzu</p>
                </div>
                <h3>Lista de Gratidão</h3>
                <div class="gratitude-list" id="gratitude-list">
                    <!-- Itens de gratidão serão adicionados aqui -->
                </div>
                <div class="add-task">
                    <input type="text" id="new-gratitude" placeholder="Pelo que você é grato hoje?">
                    <button class="btn btn-primary" id="add-gratitude">Adicionar</button>
                </div>
            </div>
        `;
    }
}

// Export for use in other modules
window.GratitudeManager = GratitudeManager;