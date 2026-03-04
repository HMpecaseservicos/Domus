// Gratitude Management Module
class GratitudeManager {
    constructor(authManager) {
        this.auth = authManager;
        this.gratitude = [];
        this.types = [
            { id: 'pessoas', name: 'Pessoas', icon: 'fa-users', color: '#EC4899' },
            { id: 'eventos', name: 'Eventos', icon: 'fa-calendar-check', color: '#3B82F6' },
            { id: 'conquistas', name: 'Conquistas', icon: 'fa-trophy', color: '#F59E0B' },
            { id: 'aprendizados', name: 'Aprendizados', icon: 'fa-lightbulb', color: '#10B981' },
            { id: 'geral', name: 'Geral', icon: 'fa-heart', color: '#EF4444' }
        ];
    }

    // Initialize gratitude manager
    init() {
        this.renderGratitude();
        this.updateStats();
        this.updateStreak();
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
                    body: JSON.stringify({ text, type: document.getElementById('gratitude-type')?.value || 'geral' })
                });
                
                const serverItem = resp.item;
                const item = {
                    id: serverItem.id,
                    text: serverItem.text,
                    date: serverItem.date || new Date().toISOString(),
                    type: serverItem.type || 'geral'
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
                date: new Date().toISOString(),
                type: document.getElementById('gratitude-type')?.value || 'geral'
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

        const recentGratitude = this.gratitude.slice(-10).reverse();
        recentGratitude.forEach(item => {
            const gratitudeElement = document.createElement('div');
            gratitudeElement.className = 'gratitude-item';
            const safeText = window.DomusUtils ? DomusUtils.escapeHTML(item.text) : item.text;
            const typeObj = this.types.find(t => t.id === (item.type || 'geral')) || this.types[4];
            gratitudeElement.innerHTML = `
                <div class="gratitude-icon" style="color:${typeObj.color}"><i class="fas ${typeObj.icon}"></i></div>
                <div class="gratitude-body">
                    <span class="gratitude-text">${safeText}</span>
                    <span class="gratitude-date">${new Date(item.date).toLocaleDateString('pt-BR')}</span>
                </div>
                <span class="gratitude-type-badge" style="background:${typeObj.color}20;color:${typeObj.color}">${typeObj.name}</span>
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
                    date: g.date || new Date().toISOString(),
                    type: g.type || 'geral'
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
            localStorage.setItem(this.auth.getStorageKey('gratitude'), JSON.stringify(data));
        } catch (e) {
            console.warn('Falha ao salvar gratidão em localStorage:', e);
        }
    }

    loadData() {
        try {
            const raw = localStorage.getItem(this.auth.getStorageKey('gratitude'));
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

    // Streak calculation
    _calcStreak() {
        if (this.gratitude.length === 0) return 0;
        const dates = [...new Set(this.gratitude.map(g => new Date(g.date).toISOString().split('T')[0]))].sort().reverse();
        let streak = 0;
        const today = new Date();
        for (let i = 0; i < dates.length; i++) {
            const expected = new Date(today);
            expected.setDate(expected.getDate() - i);
            const expStr = expected.toISOString().split('T')[0];
            if (dates[i] === expStr) streak++;
            else break;
        }
        return streak;
    }

    updateStreak() {
        const streakEl = document.getElementById('gratitude-streak');
        if (streakEl) streakEl.textContent = this._calcStreak();
    }

    // Generate HTML template
    static getTemplate() {
        return `
            <div class="card">
                <div class="card-header">
                    <h2 class="card-title"><i class="fas fa-pray"></i> Vida Espiritual</h2>
                    <div class="card-actions">
                        <div class="gratitude-streak-badge"><i class="fas fa-fire"></i> <span id="gratitude-streak">0</span> dias</div>
                        <button class="icon-btn" id="refresh-quote-btn"><i class="fas fa-sync-alt"></i></button>
                    </div>
                </div>
                <div class="quote-container">
                    <p class="quote-text" id="daily-quote">"A jornada de mil milhas começa com um único passo."</p>
                    <p class="quote-author" id="quote-author">- Lao Tzu</p>
                </div>
                <h3>Lista de Gratidão</h3>
                <div class="gratitude-list" id="gratitude-list"></div>
                <div class="add-task" style="gap:8px">
                    <select id="gratitude-type" class="gratitude-type-select" title="Tipo">
                        <option value="geral">❤️ Geral</option>
                        <option value="pessoas">👥 Pessoas</option>
                        <option value="eventos">📅 Eventos</option>
                        <option value="conquistas">🏆 Conquistas</option>
                        <option value="aprendizados">💡 Aprendizados</option>
                    </select>
                    <input type="text" id="new-gratitude" placeholder="Pelo que você é grato hoje?" style="flex:1">
                    <button class="btn btn-primary" id="add-gratitude">Adicionar</button>
                </div>
            </div>
        `;
    }
}

// Export for use in other modules
window.GratitudeManager = GratitudeManager;