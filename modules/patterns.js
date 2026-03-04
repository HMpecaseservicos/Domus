// Patterns Analysis Module — Backend-Powered Analytics + AI Life Analysis
class PatternsManager {
    constructor(authManager) {
        this.auth = authManager;
        this.analytics = null;
        this.insights = null;
        this.isAnalyzing = false;
    }

    init() {
        this.renderAnalytics();
        this.renderAIInsights();
    }

    setupEventListeners() {
        const analyzeBtn = document.getElementById('analyze-patterns');
        if (analyzeBtn) analyzeBtn.addEventListener('click', () => this.analyzePatterns());

        const snapshotBtn = document.getElementById('save-snapshot');
        if (snapshotBtn) snapshotBtn.addEventListener('click', () => this.saveSnapshot());

        const insightsBtn = document.getElementById('ai-insights-btn');
        if (insightsBtn) insightsBtn.addEventListener('click', () => this.loadAIInsights());
    }

    // ===== AI LIFE ANALYSIS =====
    async loadAIInsights() {
        if (this.isAnalyzing) return;
        this.isAnalyzing = true;

        const btn = document.getElementById('ai-insights-btn');
        if (btn) btn.innerHTML = '<div class="loading"></div> Analisando sua vida...';

        const container = document.getElementById('ai-insights-container');
        if (container) container.innerHTML = '<div style="text-align:center;padding:20px;"><div class="loading" style="margin:0 auto"></div><p style="margin-top:12px;color:var(--text-secondary)">Gerando insights inteligentes dos últimos 14 dias...</p></div>';

        if (this.auth.getToken()) {
            try {
                const resp = await this.auth.apiRequest('/api/analytics/insights', { method: 'GET' });
                if (resp) {
                    this.insights = resp.insights;
                    this.analytics = resp.analytics ? { analytics: resp.analytics } : this.analytics;
                    this.renderAIInsights();
                    this.renderAnalytics();
                    this.saveData();
                    this.auth.showNotification('Análise de vida concluída!', 'success');
                }
            } catch (err) {
                console.warn('Erro na análise de IA:', err);
                if (container) container.innerHTML = '<p style="text-align:center;color:var(--text-secondary);padding:20px;">Não foi possível gerar insights. Tente novamente.</p>';
            }
        } else {
            if (container) container.innerHTML = '<p style="text-align:center;color:var(--text-secondary);padding:20px;">Faça login para usar a análise inteligente.</p>';
        }

        this.isAnalyzing = false;
        if (btn) btn.innerHTML = '<i class="fas fa-robot"></i> Análise de Vida IA';
    }

    renderAIInsights() {
        const container = document.getElementById('ai-insights-container');
        if (!container || !this.insights || this.insights.length === 0) {
            if (container) container.innerHTML = '<p style="text-align:center;color:var(--text-secondary);padding:20px;">Nenhum insight disponível. Registre mais dados para gerar análises.</p>';
            return;
        }

        const severityColors = {
            positive: { bg: 'rgba(16, 185, 129, 0.08)', border: 'var(--success)', text: 'var(--success)' },
            warning: { bg: 'rgba(245, 158, 11, 0.08)', border: 'var(--warning)', text: 'var(--warning)' },
            danger: { bg: 'rgba(239, 68, 68, 0.08)', border: 'var(--danger)', text: 'var(--danger)' },
            info: { bg: 'rgba(59, 130, 246, 0.08)', border: 'var(--info)', text: 'var(--info)' }
        };

        const typeLabels = {
            productivity: 'Produtividade',
            financial: 'Finanças',
            emotional: 'Emocional',
            correlation: 'Correlação',
            gratitude: 'Gratidão'
        };

        const html = this.insights.map(insight => {
            const colors = severityColors[insight.severity] || severityColors.info;
            const typeLabel = typeLabels[insight.type] || insight.type;

            return `
                <div class="ai-insight-card" style="background:${colors.bg};border-left:3px solid ${colors.border};border-radius:var(--radius-sm);padding:16px;margin-bottom:12px;">
                    <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
                        <span style="font-size:1.5rem;">${insight.icon}</span>
                        <div style="flex:1;">
                            <span style="font-size:0.7rem;font-weight:600;text-transform:uppercase;color:${colors.text};letter-spacing:0.5px;">${typeLabel}</span>
                            <h4 style="font-size:0.95rem;font-weight:700;color:var(--text-primary);margin:0;">${insight.title}</h4>
                        </div>
                    </div>
                    <p style="font-size:0.85rem;color:var(--text-secondary);line-height:1.6;margin:0;">${insight.message}</p>
                    ${insight.metric ? `
                        <div style="display:flex;gap:16px;margin-top:10px;padding-top:10px;border-top:1px solid var(--border-light);">
                            <div style="text-align:center;">
                                <span style="font-size:0.7rem;color:var(--text-tertiary);">Anterior</span>
                                <div style="font-size:0.9rem;font-weight:700;color:var(--text-secondary);">${typeof insight.metric.previous === 'number' ? insight.metric.previous.toFixed(1) : insight.metric.previous}</div>
                            </div>
                            <div style="text-align:center;">
                                <span style="font-size:0.7rem;color:var(--text-tertiary);">Atual</span>
                                <div style="font-size:0.9rem;font-weight:700;color:${colors.text};">${typeof insight.metric.current === 'number' ? insight.metric.current.toFixed(1) : insight.metric.current}</div>
                            </div>
                            <div style="text-align:center;">
                                <span style="font-size:0.7rem;color:var(--text-tertiary);">Variação</span>
                                <div style="font-size:0.9rem;font-weight:700;color:${colors.text};">${insight.metric.change > 0 ? '+' : ''}${typeof insight.metric.change === 'number' ? insight.metric.change.toFixed(1) : insight.metric.change}%</div>
                            </div>
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');

        container.innerHTML = html;
    }

    async analyzePatterns() {
        if (this.isAnalyzing) return;
        this.isAnalyzing = true;

        const btn = document.getElementById('analyze-patterns');
        if (btn) btn.innerHTML = '<div class="loading"></div> Analisando...';

        if (this.auth.getToken()) {
            try {
                const resp = await this.auth.apiRequest('/api/analytics', { method: 'GET' });
                if (resp) {
                    this.analytics = resp;
                    this.renderAnalytics();
                    this.saveData();
                    this.auth.showNotification('Análise concluída!', 'success');
                }
            } catch (err) {
                console.warn('Erro na análise:', err);
                this._fallbackAnalysis();
            }
        } else {
            this._fallbackAnalysis();
        }

        this.isAnalyzing = false;
        if (btn) btn.innerHTML = '<i class="fas fa-sync"></i> Analisar Meus Padrões';
    }

    _fallbackAnalysis() {
        const app = window.app;
        if (!app) return;
        const tasks = app.taskManager?.tasks || [];
        const thoughts = app.thoughtsManager?.thoughts || [];
        const transactions = app.financeManager?.transactions || [];

        const done = tasks.filter(t => t.status === 'done' || t.completed).length;
        const total = tasks.length;

        const moodDist = {};
        let totalEnergy = 0, totalStress = 0, totalClarity = 0, tCount = 0;
        thoughts.forEach(t => {
            moodDist[t.mood] = (moodDist[t.mood] || 0) + 1;
            if (t.energy) { totalEnergy += t.energy; tCount++; }
            if (t.stress) totalStress += t.stress;
            if (t.clarity) totalClarity += t.clarity;
        });

        const expenses = transactions.filter(t => t.type === 'expense');
        const incomes = transactions.filter(t => t.type === 'income');
        const monthExp = expenses.reduce((s, t) => s + t.amount, 0);
        const monthInc = incomes.reduce((s, t) => s + t.amount, 0);

        this.analytics = {
            productivity: { total, completed: done, completionRate: total > 0 ? (done / total * 100) : 0 },
            financial: { monthIncome: monthInc, monthExpense: monthExp, balance: monthInc - monthExp, savingsRate: monthInc > 0 ? ((monthInc - monthExp) / monthInc * 100) : 0 },
            emotional: { moodDistribution: moodDist, avgEnergy: tCount > 0 ? (totalEnergy / tCount) : 0, avgStress: tCount > 0 ? (totalStress / tCount) : 0, avgClarity: tCount > 0 ? (totalClarity / tCount) : 0 }
        };

        this.renderAnalytics();
        this.saveData();
        this.auth.showNotification('Análise local concluída!', 'success');
    }

    async saveSnapshot() {
        if (!this.auth.getToken() || !this.analytics) {
            this.auth.showNotification('Faça a análise primeiro.', 'warning');
            return;
        }
        try {
            await this.auth.apiRequest('/api/analytics/snapshot', {
                method: 'POST',
                body: JSON.stringify({
                    type: 'weekly',
                    data: this.analytics,
                    period_start: new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0],
                    period_end: new Date().toISOString().split('T')[0]
                })
            });
            this.auth.showNotification('Snapshot salvo!', 'success');
        } catch (err) {
            this.auth.showNotification(err.message || 'Erro ao salvar snapshot', 'error');
        }
    }

    renderAnalytics() {
        const container = document.getElementById('patterns-list');
        if (!container) return;

        if (!this.analytics) {
            container.innerHTML = '<p style="text-align:center;color:var(--gray);padding:20px;">Clique em "Analisar Meus Padrões" para gerar insights completos.</p>';
            return;
        }

        const a = this.analytics;
        const fmt = (v) => 'R$ ' + Math.abs(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 });

        // Productivity section
        const prod = a.productivity || {};
        const compRate = (prod.completionRate || 0).toFixed(1);
        const compClass = compRate >= 70 ? 'good' : compRate >= 40 ? 'medium' : 'low';

        // Financial section
        const fin = a.financial || {};
        const savRate = (fin.savingsRate || 0).toFixed(1);

        // Emotional section
        const emo = a.emotional || {};
        const moodLabels = { sad: 'Triste', neutral: 'Neutro', happy: 'Feliz', anxious: 'Ansioso', angry: 'Irritado' };
        const moodDist = emo.moodDistribution || {};
        const moodMax = Math.max(1, ...Object.values(moodDist));
        const moodBars = Object.entries(moodDist).map(([mood, count]) => {
            const pct = (count / moodMax * 100).toFixed(0);
            return `<div class="analytics-mood-bar"><span class="analytics-mood-label">${moodLabels[mood] || mood}</span><div class="analytics-bar-track"><div class="analytics-bar-fill" style="width:${pct}%"></div></div><span class="analytics-mood-count">${count}</span></div>`;
        }).join('');

        // By area
        const byArea = prod.byArea || {};
        const areaBars = Object.entries(byArea).map(([area, data]) => {
            const rate = data.total > 0 ? (data.completed / data.total * 100).toFixed(0) : 0;
            return `<div class="analytics-area-item"><span>${area}</span><div class="analytics-bar-track"><div class="analytics-bar-fill" style="width:${rate}%"></div></div><span>${rate}% (${data.completed}/${data.total})</span></div>`;
        }).join('');

        container.innerHTML = `
            <div class="analytics-section">
                <h3 class="analytics-section-title"><i class="fas fa-tasks"></i> Produtividade</h3>
                <div class="analytics-kpi-row">
                    <div class="analytics-kpi"><span class="analytics-kpi-value">${prod.total || 0}</span><span class="analytics-kpi-label">Total</span></div>
                    <div class="analytics-kpi"><span class="analytics-kpi-value">${prod.completed || 0}</span><span class="analytics-kpi-label">Concluídas</span></div>
                    <div class="analytics-kpi"><span class="analytics-kpi-value analytics-${compClass}">${compRate}%</span><span class="analytics-kpi-label">Taxa</span></div>
                </div>
                ${areaBars ? `<div class="analytics-area-list">${areaBars}</div>` : ''}
            </div>

            <div class="analytics-section">
                <h3 class="analytics-section-title"><i class="fas fa-coins"></i> Finanças</h3>
                <div class="analytics-kpi-row">
                    <div class="analytics-kpi"><span class="analytics-kpi-value positive">${fmt(fin.monthIncome)}</span><span class="analytics-kpi-label">Receita</span></div>
                    <div class="analytics-kpi"><span class="analytics-kpi-value negative">${fmt(fin.monthExpense)}</span><span class="analytics-kpi-label">Despesa</span></div>
                    <div class="analytics-kpi"><span class="analytics-kpi-value ${(fin.balance || 0) >= 0 ? 'positive' : 'negative'}">${fmt(fin.balance)}</span><span class="analytics-kpi-label">Saldo</span></div>
                    <div class="analytics-kpi"><span class="analytics-kpi-value">${savRate}%</span><span class="analytics-kpi-label">Economia</span></div>
                </div>
                ${fin.topCategory ? `<p class="analytics-insight"><i class="fas fa-info-circle"></i> Maior gasto: <strong>${fin.topCategory}</strong></p>` : ''}
            </div>

            <div class="analytics-section">
                <h3 class="analytics-section-title"><i class="fas fa-brain"></i> Emocional</h3>
                <div class="analytics-kpi-row">
                    <div class="analytics-kpi"><span class="analytics-kpi-value"><i class="fas fa-bolt"></i> ${(emo.avgEnergy || 0).toFixed(1)}</span><span class="analytics-kpi-label">Energia</span></div>
                    <div class="analytics-kpi"><span class="analytics-kpi-value"><i class="fas fa-fire"></i> ${(emo.avgStress || 0).toFixed(1)}</span><span class="analytics-kpi-label">Estresse</span></div>
                    <div class="analytics-kpi"><span class="analytics-kpi-value"><i class="fas fa-eye"></i> ${(emo.avgClarity || 0).toFixed(1)}</span><span class="analytics-kpi-label">Clareza</span></div>
                </div>
                ${moodBars ? `<div class="analytics-mood-dist">${moodBars}</div>` : ''}
            </div>
        `;
    }

    saveData() {
        try {
            const data = { analytics: this.analytics, insights: this.insights };
            localStorage.setItem(this.auth.getStorageKey('patterns'), JSON.stringify(data));
        } catch (e) {
            console.warn('Falha ao salvar padrões em localStorage:', e);
        }
    }

    loadData() {
        try {
            const raw = localStorage.getItem(this.auth.getStorageKey('patterns'));
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed.analytics) this.analytics = parsed.analytics;
                if (parsed.insights) this.insights = parsed.insights;
            }
        } catch (e) { console.warn('Erro ao carregar padrões:', e); }
    }

    static getTemplate() {
        return `
            <div class="card" style="margin-bottom:20px;">
                <div class="card-header">
                    <h2 class="card-title"><i class="fas fa-robot"></i> Análise de Vida IA</h2>
                    <div class="card-actions">
                        <button class="btn btn-sm btn-primary" id="ai-insights-btn" title="Gerar insights inteligentes">
                            <i class="fas fa-robot"></i> Análise de Vida IA
                        </button>
                    </div>
                </div>
                <p style="color:var(--text-secondary);font-size:0.85rem;margin-bottom:16px;">
                    <i class="fas fa-info-circle"></i> Insights inteligentes baseados nos seus dados dos últimos 14 dias — correlações entre produtividade, humor, gastos e hábitos.
                </p>
                <div id="ai-insights-container">
                    <p style="text-align:center;color:var(--text-tertiary);padding:20px;">Clique em "Análise de Vida IA" para gerar insights personalizados.</p>
                </div>
            </div>

            <div class="card">
                <div class="card-header">
                    <h2 class="card-title"><i class="fas fa-chart-line"></i> Análise de Padrões</h2>
                    <div class="card-actions">
                        <button class="icon-btn" id="save-snapshot" title="Salvar Snapshot"><i class="fas fa-camera"></i></button>
                    </div>
                </div>
                <div id="patterns-list"></div>
                <button class="btn btn-primary btn-block" id="analyze-patterns"><i class="fas fa-sync"></i> Analisar Meus Padrões</button>
            </div>
        `;
    }
}

window.PatternsManager = PatternsManager;