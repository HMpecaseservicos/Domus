// Thoughts Management Module
class ThoughtsManager {
    constructor(authManager) {
        this.auth = authManager;
        this.thoughts = [];
        this.selectedMood = 'neutral';
    }

    // Initialize thoughts manager
    init() {
        this.renderThoughts();
        this.setupMoodSelector();
        this.updateStats();
    }

    // Setup event listeners (call after DOM templates are injected)
    setupEventListeners() {
        const addThoughtBtn = document.getElementById('add-thought');
        if (addThoughtBtn) addThoughtBtn.addEventListener('click', () => this.addThought());
    }

    // Setup mood selector
    setupMoodSelector() {
        const moodOptions = document.querySelectorAll('.mood-option');
        moodOptions.forEach(option => {
            option.addEventListener('click', (e) => {
                moodOptions.forEach(opt => opt.classList.remove('active'));
                e.target.closest('.mood-option').classList.add('active');
                this.selectedMood = e.target.closest('.mood-option').getAttribute('data-mood');
            });
        });
        
        // Set default active mood
        if (moodOptions[1]) moodOptions[1].classList.add('active');
    }

    // Add new thought
    async addThought() {
        const thoughtInput = document.getElementById('new-thought');
        if (!thoughtInput) return;
        
        const text = thoughtInput.value.trim();
        if (!text) {
            this.auth.showNotification('Por favor, digite seu pensamento.', 'warning');
            return;
        }
        
        const tags = this.extractTags(text);

        if (this.auth.getToken()) {
            try {
                const resp = await this.auth.apiRequest('/api/thoughts', {
                    method: 'POST',
                    body: JSON.stringify({ text, mood: this.selectedMood, tags })
                });
                
                const serverThought = resp.thought;
                const thought = {
                    id: serverThought.id,
                    text: serverThought.text,
                    mood: serverThought.mood || this.selectedMood,
                    date: serverThought.date || new Date().toISOString(),
                    tags: serverThought.tags ? 
                        serverThought.tags.split(',').filter(Boolean) : tags
                };
                
                this.thoughts.unshift(thought);
                thoughtInput.value = '';
                this.renderThoughts();
                this.updateStats();
                this.saveData();
                this.auth.showNotification('Pensamento registrado com sucesso!', 'success');
            } catch (err) {
                this.auth.showNotification(err.message || 'Erro ao salvar pensamento', 'error');
                console.error(err);
            }
        } else {
            // Local fallback
            const thought = {
                id: Date.now(),
                text: text,
                mood: this.selectedMood,
                date: new Date().toISOString(),
                tags
            };
            
            this.thoughts.push(thought);
            thoughtInput.value = '';
            this.renderThoughts();
            this.updateStats();
            this.saveData();
            this.auth.showNotification('Pensamento registrado com sucesso!', 'success');
        }
    }

    // Extract tags from text
    extractTags(text) {
        const commonPatterns = [
            'ansiedade', 'medo', 'procrastinação', 'culpa', 'raiva',
            'felicidade', 'gratidão', 'motivação', 'estresse', 'preocupação'
        ];
        const tags = [];
        
        commonPatterns.forEach(pattern => {
            if (text.toLowerCase().includes(pattern)) {
                tags.push(pattern);
            }
        });
        
        return tags;
    }

    // Render thoughts
    renderThoughts() {
        const thoughtsList = document.getElementById('thoughts-list');
        if (!thoughtsList) return;
        
        thoughtsList.innerHTML = '';
        
        if (this.thoughts.length === 0) {
            thoughtsList.innerHTML = '<p style="text-align: center; color: var(--gray); padding: 20px;">Nenhum pensamento registrado ainda.</p>';
            return;
        }

        const recentThoughts = this.thoughts.slice(-5).reverse();
        const moodIcons = {
            sad: 'fa-frown',
            neutral: 'fa-meh',
            happy: 'fa-smile',
            anxious: 'fa-tired',
            angry: 'fa-angry'
        };

        recentThoughts.forEach(thought => {
            const thoughtElement = document.createElement('div');
            thoughtElement.className = 'thought-item';
            const safeText = window.DomusUtils ? DomusUtils.escapeHTML(thought.text) : thought.text;
            const safeTags = thought.tags.map(tag => 
                window.DomusUtils ? DomusUtils.escapeHTML(tag) : tag
            );
            thoughtElement.innerHTML = `
                <div class="thought-header">
                    <div class="thought-date">${new Date(thought.date).toLocaleDateString('pt-BR')}</div>
                    <div class="thought-mood"><i class="fas ${moodIcons[thought.mood] || 'fa-meh'}"></i></div>
                </div>
                <div class="thought-content">${safeText}</div>
                <div class="thought-tags">
                    ${safeTags.map(tag => `<span class="tag">${tag}</span>`).join('')}
                </div>
            `;
            thoughtsList.appendChild(thoughtElement);
        });
    }

    // Update statistics
    updateStats() {
        const thoughtsCount = document.getElementById('thoughts-count');
        if (thoughtsCount) thoughtsCount.textContent = this.thoughts.length;
    }

    // Load data from server
    async loadServerData() {
        if (!this.auth.getToken()) return;

        try {
            const resp = await this.auth.apiRequest('/api/thoughts', { method: 'GET' });
            if (resp && Array.isArray(resp.thoughts)) {
                this.thoughts = resp.thoughts.map(t => ({
                    id: t.id,
                    text: t.text,
                    mood: t.mood || 'neutral',
                    date: t.date || new Date().toISOString(),
                    tags: t.tags ? t.tags.split(',').filter(Boolean) : []
                }));
                this.renderThoughts();
                this.updateStats();
            }
        } catch (err) {
            console.warn('Erro ao carregar pensamentos do servidor:', err);
        }
    }

    // Save/load local data
    saveData() {
        try {
            const data = { thoughts: this.thoughts };
            localStorage.setItem(this.auth.getStorageKey('thoughts'), JSON.stringify(data));
        } catch (e) {
            console.warn('Falha ao salvar pensamentos em localStorage:', e);
        }
    }

    loadData() {
        try {
            const raw = localStorage.getItem(this.auth.getStorageKey('thoughts'));
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed.thoughts && Array.isArray(parsed.thoughts)) {
                    this.thoughts = parsed.thoughts;
                }
            }
        } catch (e) {
            console.warn('Erro ao carregar pensamentos do localStorage:', e);
        }
    }

    // Generate HTML template
    static getTemplate() {
        return `
            <div class="card">
                <div class="card-header">
                    <h2 class="card-title"><i class="fas fa-brain"></i> Registro de Pensamentos</h2>
                    <div class="card-actions">
                        <button class="icon-btn" id="thought-insights-btn"><i class="fas fa-chart-line"></i></button>
                    </div>
                </div>
                <div id="thoughts-list">
                    <!-- Pensamentos serão adicionados aqui -->
                </div>
                <div class="mood-selector" id="mood-selector">
                    <div class="mood-option" data-mood="sad">
                        <i class="fas fa-frown"></i>
                        <p>Triste</p>
                    </div>
                    <div class="mood-option" data-mood="neutral">
                        <i class="fas fa-meh"></i>
                        <p>Neutro</p>
                    </div>
                    <div class="mood-option" data-mood="happy">
                        <i class="fas fa-smile"></i>
                        <p>Feliz</p>
                    </div>
                    <div class="mood-option" data-mood="anxious">
                        <i class="fas fa-tired"></i>
                        <p>Ansioso</p>
                    </div>
                    <div class="mood-option" data-mood="angry">
                        <i class="fas fa-angry"></i>
                        <p>Irritado</p>
                    </div>
                </div>
                <textarea id="new-thought" placeholder="Como você está se sentindo? O que está pensando?"></textarea>
                <button class="btn btn-primary btn-block" id="add-thought">Registrar Pensamento</button>
            </div>
        `;
    }
}

// Export for use in other modules
window.ThoughtsManager = ThoughtsManager;