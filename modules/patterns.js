// Patterns Analysis Module
class PatternsManager {
    constructor(authManager) {
        this.auth = authManager;
        this.patterns = [];
        this.isAnalyzing = false;
    }

    // Initialize patterns manager
    init() {
        this.renderPatterns();
    }

    // Setup event listeners (call after DOM templates are injected)
    setupEventListeners() {
        const analyzeBtn = document.getElementById('analyze-patterns');
        if (analyzeBtn) analyzeBtn.addEventListener('click', () => this.analyzePatterns());
    }

    // Analyze patterns
    analyzePatterns() {
        if (this.isAnalyzing) return;
        
        this.isAnalyzing = true;
        const btn = document.getElementById('analyze-patterns');
        if (btn) btn.innerHTML = '<div class="loading"></div> Analisando...';
        
        setTimeout(() => {
            this.performAnalysis();
            this.isAnalyzing = false;
            if (btn) btn.innerHTML = 'Analisar Meus Padrões';
            this.auth.showNotification('Análise de padrões concluída!', 'success');
        }, 1500);
    }

    // Perform the actual analysis
    performAnalysis() {
        this.patterns = [];
        
        // Get data from other managers
        const app = window.app;
        if (!app) return;
        
        const tasks = app.taskManager ? app.taskManager.tasks : [];
        const thoughts = app.thoughtsManager ? app.thoughtsManager.thoughts : [];
        const transactions = app.financeManager ? app.financeManager.transactions : [];
        
        // Analyze mood patterns
        this.analyzeMoodPatterns(thoughts);
        
        // Analyze productivity patterns
        this.analyzeProductivityPatterns(tasks);
        
        // Analyze financial patterns
        this.analyzeFinancialPatterns(transactions);
        
        // Analyze tag patterns
        this.analyzeTagPatterns(thoughts);
        
        this.renderPatterns();
        this.saveData();
    }

    // Analyze mood patterns
    analyzeMoodPatterns(thoughts) {
        if (thoughts.length === 0) return;
        
        const moodCount = { sad: 0, neutral: 0, happy: 0, anxious: 0, angry: 0 };
        
        thoughts.forEach(thought => {
            if (moodCount.hasOwnProperty(thought.mood)) {
                moodCount[thought.mood]++;
            }
        });
        
        const dominantMood = Object.entries(moodCount).reduce((a, b) => a[1] > b[1] ? a : b)[0];
        
        if (moodCount[dominantMood] > 0) {
            this.patterns.push({
                title: "Humor Predominante",
                description: `Seu humor mais frequente é: ${this.getMoodText(dominantMood)}`,
                frequency: `${moodCount[dominantMood]} registros`,
                triggers: [dominantMood]
            });
        }
    }

    // Analyze productivity patterns
    analyzeProductivityPatterns(tasks) {
        if (tasks.length === 0) return;
        
        const completedTasks = tasks.filter(t => t.completed).length;
        const totalTasks = tasks.length;
        const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
        
        let description = '';
        let triggers = [];
        
        if (completionRate >= 80) {
            description = `Excelente! Você completa ${completionRate.toFixed(1)}% das suas tarefas`;
            triggers = ['alta-produtividade'];
        } else if (completionRate >= 60) {
            description = `Boa produtividade: ${completionRate.toFixed(1)}% das tarefas concluídas`;
            triggers = ['produtividade-moderada'];
        } else if (completionRate >= 40) {
            description = `Produtividade média: ${completionRate.toFixed(1)}% das tarefas concluídas`;
            triggers = ['produtividade-baixa'];
        } else {
            description = `Atenção: apenas ${completionRate.toFixed(1)}% das tarefas são concluídas`;
            triggers = ['procrastinação'];
        }
        
        this.patterns.push({
            title: "Padrão de Produtividade",
            description: description,
            frequency: `${completedTasks} de ${totalTasks} tarefas`,
            triggers: triggers
        });
    }

    // Analyze financial patterns
    analyzeFinancialPatterns(transactions) {
        if (transactions.length === 0) return;
        
        const expenseTransactions = transactions.filter(t => t.type === 'expense');
        
        if (expenseTransactions.length > 0) {
            const totalExpenses = expenseTransactions.reduce((sum, t) => sum + t.amount, 0);
            const avgExpense = totalExpenses / expenseTransactions.length;
            
            // Analyze spending categories
            const categorySpending = {};
            expenseTransactions.forEach(t => {
                categorySpending[t.category] = (categorySpending[t.category] || 0) + t.amount;
            });
            
            const topCategory = Object.entries(categorySpending)
                .sort((a, b) => b[1] - a[1])[0];
            
            this.patterns.push({
                title: "Padrão Financeiro",
                description: `Gasto médio por transação: R$ ${avgExpense.toFixed(2)}. Maior gasto em: ${topCategory[0]}`,
                frequency: `${expenseTransactions.length} despesas registradas`,
                triggers: [topCategory[0]]
            });
        }
    }

    // Analyze tag patterns
    analyzeTagPatterns(thoughts) {
        if (thoughts.length === 0) return;
        
        const tagCount = {};
        
        thoughts.forEach(thought => {
            if (thought.tags && Array.isArray(thought.tags)) {
                thought.tags.forEach(tag => {
                    tagCount[tag] = (tagCount[tag] || 0) + 1;
                });
            }
        });
        
        const sortedTags = Object.entries(tagCount).sort((a, b) => b[1] - a[1]);
        
        sortedTags.slice(0, 3).forEach(([tag, count]) => {
            this.patterns.push({
                title: "Padrão Emocional",
                description: `Você frequentemente menciona: ${tag}`,
                frequency: `${count} menções`,
                triggers: [tag]
            });
        });
    }

    // Get mood text in Portuguese
    getMoodText(mood) {
        const moodTexts = {
            sad: "Triste",
            neutral: "Neutro",
            happy: "Feliz",
            anxious: "Ansioso",
            angry: "Irritado"
        };
        return moodTexts[mood] || mood;
    }

    // Render patterns
    renderPatterns() {
        const patternsList = document.getElementById('patterns-list');
        if (!patternsList) return;
        
        patternsList.innerHTML = '';
        
        if (this.patterns.length === 0) {
            patternsList.innerHTML = '<p style="text-align: center; color: var(--gray); padding: 20px;">Clique em "Analisar Meus Padrões" para identificar padrões comportamentais.</p>';
            return;
        }
        
        this.patterns.forEach(pattern => {
            const patternElement = document.createElement('div');
            patternElement.className = 'pattern-item';
            
            const triggersHtml = pattern.triggers ? pattern.triggers.map(trigger => 
                `<span class="trigger">${trigger}</span>`
            ).join('') : '';
            
            patternElement.innerHTML = `
                <div class="pattern-title">
                    ${pattern.title}
                    <span class="pattern-frequency">${pattern.frequency}</span>
                </div>
                <div class="pattern-analysis">${pattern.description}</div>
                ${triggersHtml ? `<div class="pattern-triggers">${triggersHtml}</div>` : ''}
            `;
            patternsList.appendChild(patternElement);
        });
    }

    // Save/load local data
    saveData() {
        try {
            const data = { patterns: this.patterns };
            localStorage.setItem('domus:patterns', JSON.stringify(data));
        } catch (e) {
            console.warn('Falha ao salvar padrões em localStorage:', e);
        }
    }

    loadData() {
        try {
            const raw = localStorage.getItem('domus:patterns');
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed.patterns && Array.isArray(parsed.patterns)) {
                    this.patterns = parsed.patterns;
                }
            }
        } catch (e) {
            console.warn('Erro ao carregar padrões do localStorage:', e);
        }
    }

    // Generate HTML template
    static getTemplate() {
        return `
            <div class="card">
                <div class="card-header">
                    <h2 class="card-title"><i class="fas fa-chart-line"></i> Análise de Padrões</h2>
                </div>
                <div id="patterns-list">
                    <!-- Padrões identificados serão mostrados aqui -->
                </div>
                <button class="btn btn-primary btn-block" id="analyze-patterns">Analisar Meus Padrões</button>
            </div>
        `;
    }
}

// Export for use in other modules
window.PatternsManager = PatternsManager;