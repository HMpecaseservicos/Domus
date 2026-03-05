// Finance Management Module — Ultra-Professional Fintech Edition
class FinanceManager {
    constructor(authManager) {
        this.auth = authManager;
        this.transactions = [];
        this.income = 0;
        this.expenses = 0;
        this.searchQuery = '';
        this.filterType = 'all';
        this.filterCategory = 'all';
        this.editingId = null;
        this.budgetGoal = 0;

        // Current month navigation
        const now = new Date();
        this.viewMonth = now.getMonth();
        this.viewYear = now.getFullYear();

        // New features
        this.recurringTransactions = [];
        this.savingsGoals = [];
        this.debts = [];
        this.debtsSummary = null;
        this.chartData = null;
        this.chartInstance = null;

        this.categories = [
            { id: 'alimentacao', name: 'Alimentação', icon: 'fa-utensils', color: '#F59E0B' },
            { id: 'transporte', name: 'Transporte', icon: 'fa-car', color: '#3B82F6' },
            { id: 'moradia', name: 'Moradia', icon: 'fa-home', color: '#8B5CF6' },
            { id: 'saude', name: 'Saúde', icon: 'fa-heartbeat', color: '#EF4444' },
            { id: 'lazer', name: 'Lazer', icon: 'fa-gamepad', color: '#EC4899' },
            { id: 'educacao', name: 'Educação', icon: 'fa-graduation-cap', color: '#6366F1' },
            { id: 'trabalho', name: 'Trabalho', icon: 'fa-briefcase', color: '#10B981' },
            { id: 'investimentos', name: 'Investimentos', icon: 'fa-chart-line', color: '#14B8A6' },
            { id: 'vestuario', name: 'Vestuário', icon: 'fa-tshirt', color: '#F472B6' },
            { id: 'assinaturas', name: 'Assinaturas', icon: 'fa-credit-card', color: '#A78BFA' },
            { id: 'presentes', name: 'Presentes', icon: 'fa-gift', color: '#FB923C' },
            { id: 'salario', name: 'Salário', icon: 'fa-money-bill-wave', color: '#22C55E' },
            { id: 'freelance', name: 'Freelance', icon: 'fa-laptop-code', color: '#06B6D4' },
            { id: 'outros', name: 'Outros', icon: 'fa-ellipsis-h', color: '#9CA3AF' }
        ];

        this.paymentMethods = [
            { id: 'pix', name: 'PIX', icon: 'fa-bolt' },
            { id: 'cartao', name: 'Cartão', icon: 'fa-credit-card' },
            { id: 'dinheiro', name: 'Dinheiro', icon: 'fa-money-bill' },
            { id: 'transferencia', name: 'Transferência', icon: 'fa-exchange-alt' }
        ];

        this.accounts = [];
        this.budgets = [];
        this.accountTypes = [
            { id: 'checking', name: 'Conta Corrente', icon: 'fa-university', color: '#3B82F6' },
            { id: 'savings', name: 'Poupança', icon: 'fa-piggy-bank', color: '#10B981' },
            { id: 'credit', name: 'Cartão de Crédito', icon: 'fa-credit-card', color: '#EF4444' },
            { id: 'wallet', name: 'Carteira', icon: 'fa-wallet', color: '#F59E0B' },
            { id: 'investment', name: 'Investimento', icon: 'fa-chart-line', color: '#8B5CF6' }
        ];
    }

    // ===== INIT =====
    init() {
        this._recalcTotals();
        this.renderAll();
        this.renderAccounts();
        this.renderBudgets();
        this.loadRecurringTransactions();
        this.loadSavingsGoals();
        this.loadDebts();
        this.loadChartData();
    }

    setupEventListeners() {
        // Add transaction inline
        const addBtn = document.getElementById('fin-add-btn');
        if (addBtn) addBtn.addEventListener('click', () => this.addTransaction());

        // Type toggle
        document.querySelectorAll('.fin-type-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.fin-type-btn').forEach(b => b.classList.remove('active'));
                e.currentTarget.classList.add('active');
            });
        });

        // Expand extra fields
        const expandBtn = document.getElementById('fin-expand-toggle');
        if (expandBtn) expandBtn.addEventListener('click', () => this._toggleExpand());

        // Month nav
        const prevBtn = document.getElementById('fin-month-prev');
        const nextBtn = document.getElementById('fin-month-next');
        if (prevBtn) prevBtn.addEventListener('click', () => this._changeMonth(-1));
        if (nextBtn) nextBtn.addEventListener('click', () => this._changeMonth(1));

        // Search
        const searchInput = document.getElementById('fin-search');
        if (searchInput) searchInput.addEventListener('input', (e) => {
            this.searchQuery = e.target.value.toLowerCase();
            this.renderTransactions();
        });

        // Filter type chips
        document.querySelectorAll('.fin-filter-chip').forEach(chip => {
            chip.addEventListener('click', (e) => {
                document.querySelectorAll('.fin-filter-chip').forEach(c => c.classList.remove('active'));
                e.currentTarget.classList.add('active');
                this.filterType = e.currentTarget.dataset.filter;
                this.renderTransactions();
            });
        });

        // Category filter select
        const catSelect = document.getElementById('fin-cat-filter');
        if (catSelect) catSelect.addEventListener('change', (e) => {
            this.filterCategory = e.target.value;
            this.renderTransactions();
        });

        // Budget goal
        const budgetInput = document.getElementById('fin-budget-input');
        if (budgetInput) {
            budgetInput.addEventListener('change', (e) => {
                this.budgetGoal = parseFloat(e.target.value) || 0;
                this.saveData();
                this.updateBudgetBar();
            });
        }

        // Enter key on amount
        const amountInput = document.getElementById('fin-amount');
        if (amountInput) amountInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.addTransaction();
        });

        // Tab navigation
        document.querySelectorAll('.fin-tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tab = e.currentTarget.dataset.tab;
                this._switchTab(tab);
            });
        });
    }

    _switchTab(tab) {
        // Update active button
        document.querySelectorAll('.fin-tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelector(`.fin-tab-btn[data-tab="${tab}"]`)?.classList.add('active');
        
        // Show/hide panels
        document.querySelectorAll('.fin-tab-panel').forEach(p => p.classList.remove('active'));
        document.getElementById(`fin-panel-${tab}`)?.classList.add('active');
        
        // Render charts if switching to reports tab
        if (tab === 'reports' && this.chartData) {
            setTimeout(() => this.renderCharts(), 100);
        }
    }

    // ===== ADD TRANSACTION =====
    async addTransaction() {
        const typeBtn = document.querySelector('.fin-type-btn.active');
        const type = typeBtn ? typeBtn.dataset.type : 'expense';
        const amountEl = document.getElementById('fin-amount');
        const catEl = document.getElementById('fin-category');
        const descEl = document.getElementById('fin-description');
        const dateEl = document.getElementById('fin-date');
        const methodEl = document.getElementById('fin-method');
        const accountEl = document.getElementById('fin-account-select');

        const amount = parseFloat(amountEl?.value);
        const category = catEl?.value || '';
        const description = descEl?.value?.trim() || '';
        const date = dateEl?.value ? new Date(dateEl.value + 'T12:00:00').toISOString() : new Date().toISOString();
        const payment_method = methodEl?.value || '';
        const account_id = accountEl?.value ? parseInt(accountEl.value) : null;

        if (!amount || amount <= 0) {
            this.auth.showNotification('Informe um valor válido.', 'warning');
            return;
        }
        if (!category) {
            this.auth.showNotification('Selecione uma categoria.', 'warning');
            return;
        }

        if (this.auth.getToken()) {
            try {
                const resp = await this.auth.apiRequest('/api/finances', {
                    method: 'POST',
                    body: JSON.stringify({ type, amount, category, description, payment_method, date, account_id })
                });
                const t = this._mapServer(resp.item);
                this.transactions.unshift(t);
                this._recalcTotals();
                this._clearForm();
                this._collapseExpand();
                this.renderAll();
                this.saveData();
                this.auth.showNotification('Transação registrada!', 'success');
            } catch (err) {
                this.auth.showNotification(err.message || 'Erro ao salvar', 'error');
            }
        } else {
            const t = { id: Date.now(), type, amount, category, description, payment_method, date, account_id };
            this.transactions.unshift(t);
            this._recalcTotals();
            this._clearForm();
            this._collapseExpand();
            this.renderAll();
            this.saveData();
            this.auth.showNotification('Transação registrada!', 'success');
        }
    }

    // ===== EDIT =====
    editTransaction(id) {
        this.editingId = id;
        this.renderTransactions();
    }

    cancelEdit() {
        this.editingId = null;
        this.renderTransactions();
    }

    async saveEdit(id) {
        const t = this.transactions.find(x => x.id === id);
        if (!t) return;

        const type = document.getElementById(`fin-edit-type-${id}`)?.value || t.type;
        const amount = parseFloat(document.getElementById(`fin-edit-amount-${id}`)?.value) || t.amount;
        const category = document.getElementById(`fin-edit-cat-${id}`)?.value || t.category;
        const description = document.getElementById(`fin-edit-desc-${id}`)?.value?.trim() || '';
        const payment_method = document.getElementById(`fin-edit-method-${id}`)?.value || '';
        const dateVal = document.getElementById(`fin-edit-date-${id}`)?.value;
        const date = dateVal ? new Date(dateVal + 'T12:00:00').toISOString() : t.date;
        const account_id = document.getElementById(`fin-edit-account-${id}`)?.value ? parseInt(document.getElementById(`fin-edit-account-${id}`).value) : null;

        if (this.auth.getToken()) {
            try {
                const resp = await this.auth.apiRequest(`/api/finances/${id}`, {
                    method: 'PUT',
                    body: JSON.stringify({ type, amount, category, description, payment_method, date, account_id })
                });
                const updated = this._mapServer(resp.item);
                const idx = this.transactions.findIndex(x => x.id === id);
                if (idx !== -1) this.transactions[idx] = updated;
            } catch (err) {
                this.auth.showNotification(err.message || 'Erro ao editar', 'error');
                return;
            }
        } else {
            const idx = this.transactions.findIndex(x => x.id === id);
            if (idx !== -1) Object.assign(this.transactions[idx], { type, amount, category, description, payment_method, date, account_id });
        }

        this.editingId = null;
        this._recalcTotals();
        this.renderAll();
        this.saveData();
        this.auth.showNotification('Transação atualizada!', 'success');
    }

    // ===== DELETE =====
    async deleteTransaction(id) {
        if (this.auth.getToken()) {
            try {
                await this.auth.apiRequest(`/api/finances/${id}`, { method: 'DELETE' });
            } catch (err) {
                this.auth.showNotification(err.message || 'Erro ao excluir', 'error');
                return;
            }
        }

        const card = document.querySelector(`.fin-tx-card[data-id="${id}"]`);
        if (card) {
            card.style.animation = 'finFadeOut 0.3s ease forwards';
            setTimeout(() => {
                this.transactions = this.transactions.filter(t => t.id !== id);
                this._recalcTotals();
                this.renderAll();
                this.saveData();
            }, 300);
        } else {
            this.transactions = this.transactions.filter(t => t.id !== id);
            this._recalcTotals();
            this.renderAll();
            this.saveData();
        }
        this.auth.showNotification('Transação excluída.', 'info');
    }

    // ===== RENDER ALL =====
    renderAll() {
        this.updateKPIs();
        this.updateBudgetBar();
        this.renderCategoryBars();
        this.renderBudgets();
        this.renderTransactions();
        this.updateMonthLabel();
    }

    // ===== KPIs =====
    updateKPIs() {
        const monthTx = this._getMonthTransactions();
        const inc = monthTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
        const exp = monthTx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
        const balance = inc - exp;
        const savingsRate = inc > 0 ? ((inc - exp) / inc * 100) : 0;

        // Enhanced KPIs
        const today = new Date();
        const dayOfMonth = today.getDate();
        const daysInMonth = new Date(this.viewYear, this.viewMonth + 1, 0).getDate();
        const avgDailyExp = dayOfMonth > 0 ? (exp / dayOfMonth) : 0;
        const projectedExp = avgDailyExp * daysInMonth;
        const projectedBalance = inc - projectedExp;

        const fmt = (v) => this._formatBRL(v);

        const balEl = document.getElementById('fin-kpi-balance');
        const incEl = document.getElementById('fin-kpi-income');
        const expEl = document.getElementById('fin-kpi-expense');
        const savEl = document.getElementById('fin-kpi-savings');
        const cntEl = document.getElementById('fin-kpi-count');
        const heroEl = document.getElementById('fin-hero-balance');
        const avgEl = document.getElementById('fin-kpi-daily-avg');
        const projEl = document.getElementById('fin-kpi-projection');

        if (heroEl) {
            heroEl.textContent = fmt(balance);
            heroEl.className = 'fin-hero-value ' + (balance >= 0 ? 'positive' : 'negative');
        }
        if (balEl) balEl.textContent = fmt(balance);
        if (incEl) incEl.textContent = fmt(inc);
        if (expEl) expEl.textContent = fmt(exp);
        if (savEl) savEl.textContent = `${savingsRate.toFixed(1)}%`;
        if (cntEl) cntEl.textContent = monthTx.length;
        if (avgEl) avgEl.textContent = fmt(avgDailyExp);
        if (projEl) {
            projEl.textContent = fmt(projectedBalance);
            projEl.className = 'fin-kpi-value ' + (projectedBalance >= 0 ? 'positive' : 'negative');
        }

        // Update home dashboard balance
        const homeBalance = document.getElementById('balance');
        if (homeBalance) homeBalance.textContent = fmt(this.income - this.expenses);
    }

    // ===== BUDGET BAR =====
    updateBudgetBar() {
        const monthExp = this._getMonthTransactions().filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
        const goal = this.budgetGoal || 0;
        const bar = document.getElementById('fin-budget-fill');
        const label = document.getElementById('fin-budget-label');
        const container = document.getElementById('fin-budget-section');

        if (!container) return;
        if (goal <= 0) {
            container.style.display = 'none';
            return;
        }
        container.style.display = '';

        const pct = Math.min((monthExp / goal) * 100, 100);
        if (bar) {
            bar.style.width = pct + '%';
            bar.className = 'fin-budget-fill' + (pct > 90 ? ' danger' : pct > 70 ? ' warning' : '');
        }
        if (label) {
            const rest = Math.max(goal - monthExp, 0);
            label.textContent = `${this._formatBRL(monthExp)} / ${this._formatBRL(goal)} — Resta ${this._formatBRL(rest)}`;
        }
    }

    // ===== CATEGORY BARS =====
    renderCategoryBars() {
        const container = document.getElementById('fin-category-bars');
        if (!container) return;

        const monthTx = this._getMonthTransactions().filter(t => t.type === 'expense');
        const catTotals = {};
        monthTx.forEach(t => { catTotals[t.category] = (catTotals[t.category] || 0) + t.amount; });

        const sorted = Object.entries(catTotals).sort((a, b) => b[1] - a[1]).slice(0, 6);
        const total = monthTx.reduce((s, t) => s + t.amount, 0);

        if (sorted.length === 0) {
            container.innerHTML = '<div class="fin-empty-cats">Sem despesas neste mês</div>';
            return;
        }

        const maxVal = sorted[0][1];
        container.innerHTML = sorted.map(([catId, amount]) => {
            const cat = this.categories.find(c => c.id === catId) || { name: catId, icon: 'fa-tag', color: '#9CA3AF' };
            const pct = total > 0 ? (amount / total * 100) : 0;
            const barW = maxVal > 0 ? (amount / maxVal * 100) : 0;
            return `
                <div class="fin-cat-row">
                    <div class="fin-cat-icon" style="color:${cat.color}"><i class="fas ${cat.icon}"></i></div>
                    <div class="fin-cat-info">
                        <div class="fin-cat-header">
                            <span class="fin-cat-name">${cat.name}</span>
                            <span class="fin-cat-amount">${this._formatBRL(amount)}</span>
                        </div>
                        <div class="fin-cat-bar-track">
                            <div class="fin-cat-bar-fill" style="width:${barW}%;background:${cat.color}"></div>
                        </div>
                    </div>
                    <span class="fin-cat-pct">${pct.toFixed(0)}%</span>
                </div>`;
        }).join('');
    }

    // ===== TRANSACTION LIST =====
    renderTransactions() {
        const container = document.getElementById('fin-tx-list');
        if (!container) return;

        let filtered = this._getMonthTransactions();

        // Type filter
        if (this.filterType === 'income') filtered = filtered.filter(t => t.type === 'income');
        else if (this.filterType === 'expense') filtered = filtered.filter(t => t.type === 'expense');

        // Category filter
        if (this.filterCategory !== 'all') filtered = filtered.filter(t => t.category === this.filterCategory);

        // Search
        if (this.searchQuery) {
            filtered = filtered.filter(t =>
                (t.description || '').toLowerCase().includes(this.searchQuery) ||
                (t.category || '').toLowerCase().includes(this.searchQuery)
            );
        }

        // Sort by date desc
        filtered.sort((a, b) => new Date(b.date) - new Date(a.date));

        if (filtered.length === 0) {
            container.innerHTML = `
                <div class="fin-empty-state">
                    <i class="fas fa-receipt"></i>
                    <h4>Sem transações</h4>
                    <p>${this.searchQuery || this.filterType !== 'all' || this.filterCategory !== 'all'
                        ? 'Nenhuma transação encontrada com esses filtros.'
                        : 'Registre sua primeira transação acima.'}</p>
                </div>`;
            return;
        }

        // Group by date
        const groups = {};
        filtered.forEach(t => {
            const dateKey = new Date(t.date).toLocaleDateString('pt-BR', { year: 'numeric', month: '2-digit', day: '2-digit' });
            if (!groups[dateKey]) groups[dateKey] = [];
            groups[dateKey].push(t);
        });

        let html = '';
        for (const [dateStr, items] of Object.entries(groups)) {
            const d = new Date(items[0].date);
            const label = this._getDateLabel(d);
            html += `<div class="fin-date-group"><div class="fin-date-separator"><span>${label}</span></div>`;
            items.forEach(t => {
                if (this.editingId === t.id) {
                    html += this._renderEditForm(t);
                } else {
                    html += this._renderTxCard(t);
                }
            });
            html += '</div>';
        }

        container.innerHTML = html;
    }

    _renderTxCard(t) {
        const cat = this.categories.find(c => c.id === t.category) || { name: t.category || 'Outros', icon: 'fa-tag', color: '#9CA3AF' };
        const method = this.paymentMethods.find(m => m.id === t.payment_method);
        const isIncome = t.type === 'income';
        const sign = isIncome ? '+' : '-';
        const colorClass = isIncome ? 'positive' : 'negative';

        return `
            <div class="fin-tx-card ${colorClass}" data-id="${t.id}">
                <div class="fin-tx-icon" style="background:${cat.color}20;color:${cat.color}">
                    <i class="fas ${cat.icon}"></i>
                </div>
                <div class="fin-tx-body">
                    <div class="fin-tx-title">${this._escapeHTML(t.description || cat.name)}</div>
                    <div class="fin-tx-meta">
                        <span class="fin-tx-cat-badge">${cat.name}</span>
                        ${method ? `<span class="fin-tx-method-badge"><i class="fas ${method.icon}"></i> ${method.name}</span>` : ''}
                    </div>
                </div>
                <div class="fin-tx-right">
                    <div class="fin-tx-amount ${colorClass}">${sign}${this._formatBRL(t.amount)}</div>
                    <div class="fin-tx-actions">
                        <button class="fin-tx-action-btn" onclick="window.app.financeManager.editTransaction(${t.id})" title="Editar"><i class="fas fa-pen"></i></button>
                        <button class="fin-tx-action-btn danger" onclick="window.app.financeManager.deleteTransaction(${t.id})" title="Excluir"><i class="fas fa-trash"></i></button>
                    </div>
                </div>
            </div>`;
    }

    _renderEditForm(t) {
        const dateVal = t.date ? new Date(t.date).toISOString().split('T')[0] : '';
        return `
            <div class="fin-tx-card editing" data-id="${t.id}">
                <div class="fin-edit-form">
                    <div class="fin-edit-row">
                        <select id="fin-edit-type-${t.id}" class="fin-edit-input">
                            <option value="expense" ${t.type === 'expense' ? 'selected' : ''}>Despesa</option>
                            <option value="income" ${t.type === 'income' ? 'selected' : ''}>Receita</option>
                        </select>
                        <input type="number" id="fin-edit-amount-${t.id}" class="fin-edit-input" value="${t.amount}" step="0.01" min="0" />
                    </div>
                    <div class="fin-edit-row">
                        <select id="fin-edit-cat-${t.id}" class="fin-edit-input">
                            ${this.categories.map(c => `<option value="${c.id}" ${t.category === c.id ? 'selected' : ''}>${c.name}</option>`).join('')}
                        </select>
                        <select id="fin-edit-method-${t.id}" class="fin-edit-input">
                            <option value="">Sem método</option>
                            ${this.paymentMethods.map(m => `<option value="${m.id}" ${t.payment_method === m.id ? 'selected' : ''}>${m.name}</option>`).join('')}
                        </select>
                    </div>
                    <div class="fin-edit-row">
                        <input type="text" id="fin-edit-desc-${t.id}" class="fin-edit-input" value="${this._escapeHTML(t.description || '')}" placeholder="Descrição" />
                        <input type="date" id="fin-edit-date-${t.id}" class="fin-edit-input" value="${dateVal}" />
                    </div>
                    <div class="fin-edit-actions">
                        <button class="fin-edit-save" onclick="window.app.financeManager.saveEdit(${t.id})"><i class="fas fa-check"></i> Salvar</button>
                        <button class="fin-edit-cancel" onclick="window.app.financeManager.cancelEdit()"><i class="fas fa-times"></i> Cancelar</button>
                    </div>
                </div>
            </div>`;
    }

    // ===== MONTH NAVIGATION =====
    _changeMonth(delta) {
        this.viewMonth += delta;
        if (this.viewMonth < 0) { this.viewMonth = 11; this.viewYear--; }
        if (this.viewMonth > 11) { this.viewMonth = 0; this.viewYear++; }
        this.loadServerData();
    }

    updateMonthLabel() {
        const label = document.getElementById('fin-month-label');
        if (!label) return;
        const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
            'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
        label.textContent = `${months[this.viewMonth]} ${this.viewYear}`;
    }

    // ===== HELPERS =====
    _getMonthTransactions() {
        return this.transactions.filter(t => {
            const d = new Date(t.date);
            return d.getMonth() === this.viewMonth && d.getFullYear() === this.viewYear;
        });
    }

    _recalcTotals() {
        this.income = this.transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
        this.expenses = this.transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    }

    _mapServer(item) {
        return {
            id: item.id,
            type: item.type,
            amount: parseFloat(item.amount),
            category: item.category || '',
            description: item.description || '',
            payment_method: item.payment_method || '',
            date: item.date || new Date().toISOString(),
            account_id: item.account_id || null
        };
    }

    _formatBRL(value) {
        const sign = value < 0 ? '-' : '';
        return sign + 'R$ ' + Math.abs(value).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    _getDateLabel(d) {
        const today = new Date();
        const yesterday = new Date(); yesterday.setDate(today.getDate() - 1);
        if (d.toDateString() === today.toDateString()) return 'Hoje';
        if (d.toDateString() === yesterday.toDateString()) return 'Ontem';
        return d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
    }

    _escapeHTML(str) {
        if (window.DomusUtils) return DomusUtils.escapeHTML(str);
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    _clearForm() {
        const els = ['fin-amount', 'fin-description', 'fin-date', 'fin-method'];
        els.forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
        const catEl = document.getElementById('fin-category');
        if (catEl) catEl.selectedIndex = 0;
    }

    _toggleExpand() {
        const extra = document.getElementById('fin-extra-fields');
        const btn = document.getElementById('fin-expand-toggle');
        if (!extra) return;
        const isOpen = extra.classList.toggle('open');
        if (btn) btn.innerHTML = isOpen
            ? '<i class="fas fa-chevron-up"></i> Menos detalhes'
            : '<i class="fas fa-chevron-down"></i> Mais detalhes';
    }

    _collapseExpand() {
        const extra = document.getElementById('fin-extra-fields');
        const btn = document.getElementById('fin-expand-toggle');
        if (extra) extra.classList.remove('open');
        if (btn) btn.innerHTML = '<i class="fas fa-chevron-down"></i> Mais detalhes';
    }

    // ===== ACCOUNTS =====
    async loadAccounts() {
        if (!this.auth.getToken()) return;
        try {
            const resp = await this.auth.apiRequest('/api/accounts', { method: 'GET' });
            if (resp && Array.isArray(resp.accounts)) {
                this.accounts = resp.accounts.map(a => ({ ...a, balance: parseFloat(a.balance) }));
                this.renderAccounts();
            }
        } catch (err) { console.warn('Erro ao carregar contas:', err); }
    }

    async addAccount() {
        const nameEl = document.getElementById('fin-account-name');
        const typeEl = document.getElementById('fin-account-type');
        const balanceEl = document.getElementById('fin-account-balance');
        const scopeEl = document.getElementById('fin-account-scope');
        const name = nameEl?.value?.trim();
        if (!name) { this.auth.showNotification('Informe o nome da conta.', 'warning'); return; }
        const type = typeEl?.value || 'checking';
        const scope = scopeEl?.value || 'personal';
        const balance = parseFloat(balanceEl?.value) || 0;
        const typeObj = this.accountTypes.find(t => t.id === type);

        if (this.auth.getToken()) {
            try {
                const resp = await this.auth.apiRequest('/api/accounts', {
                    method: 'POST',
                    body: JSON.stringify({ name, type, scope, balance, icon: typeObj?.icon || 'fa-university', color: typeObj?.color || '#3B82F6' })
                });
                this.accounts.push({ ...resp.account, balance: parseFloat(resp.account.balance) });
            } catch (err) { this.auth.showNotification(err.message || 'Erro', 'error'); return; }
        } else {
            this.accounts.push({ id: Date.now(), name, type, scope, balance, icon: typeObj?.icon || 'fa-university', color: typeObj?.color || '#3B82F6' });
        }
        if (nameEl) nameEl.value = '';
        if (balanceEl) balanceEl.value = '';
        this.renderAccounts();
        this.saveData();
        this.auth.showNotification('Conta adicionada!', 'success');
    }

    async deleteAccount(id) {
        if (!confirm('Excluir esta conta?')) return;
        if (this.auth.getToken() && Number.isInteger(id)) {
            try { await this.auth.apiRequest(`/api/accounts/${id}`, { method: 'DELETE' }); }
            catch (err) { this.auth.showNotification(err.message || 'Erro', 'error'); return; }
        }
        this.accounts = this.accounts.filter(a => a.id !== id);
        this.renderAccounts();
        this.saveData();
        this.auth.showNotification('Conta excluída.', 'info');
    }

    renderAccounts() {
        const container = document.getElementById('fin-accounts-list');
        if (!container) return;
        if (this.accounts.length === 0) {
            container.innerHTML = '<div class="fin-empty-cats">Nenhuma conta cadastrada</div>';
            return;
        }
        
        // Separate by scope
        const personalAccounts = this.accounts.filter(a => a.scope !== 'business');
        const businessAccounts = this.accounts.filter(a => a.scope === 'business');
        const total = this.accounts.reduce((s, a) => s + a.balance, 0);
        const personalTotal = personalAccounts.reduce((s, a) => s + a.balance, 0);
        const businessTotal = businessAccounts.reduce((s, a) => s + a.balance, 0);
        
        const renderAccountList = (accounts, scopeLabel, scopeTotal) => {
            if (accounts.length === 0) return '';
            return `
            <div class="fin-accounts-scope-group">
                <div class="fin-scope-header">
                    <span class="fin-scope-badge ${scopeLabel === 'Pessoal' ? 'personal' : 'business'}">
                        <i class="fas ${scopeLabel === 'Pessoal' ? 'fa-user' : 'fa-building'}"></i> ${scopeLabel}
                    </span>
                    <span class="fin-scope-total ${scopeTotal >= 0 ? 'positive' : 'negative'}">${this._formatBRL(scopeTotal)}</span>
                </div>
                ${accounts.map(a => {
                    const typeObj = this.accountTypes.find(t => t.id === a.type) || { name: a.type, icon: 'fa-university', color: '#9CA3AF' };
                    return `
                    <div class="fin-account-item">
                        <div class="fin-account-icon" style="background:${a.color || typeObj.color}20;color:${a.color || typeObj.color}">
                            <i class="fas ${a.icon || typeObj.icon}"></i>
                        </div>
                        <div class="fin-account-info">
                            <span class="fin-account-name">${this._escapeHTML(a.name)}</span>
                            <span class="fin-account-type">${typeObj.name}</span>
                        </div>
                        <div class="fin-account-balance ${a.balance >= 0 ? 'positive' : 'negative'}">${this._formatBRL(a.balance)}</div>
                        <button class="fin-account-del" onclick="window.app.financeManager.deleteAccount(${a.id})" title="Excluir"><i class="fas fa-times"></i></button>
                    </div>`;
                }).join('')}
            </div>`;
        };
        
        container.innerHTML = 
            renderAccountList(personalAccounts, 'Pessoal', personalTotal) +
            renderAccountList(businessAccounts, 'Empresa', businessTotal) + `
        <div class="fin-accounts-total">
            <span>Total Geral:</span>
            <span class="${total >= 0 ? 'positive' : 'negative'}">${this._formatBRL(total)}</span>
        </div>`;

        // Update account select in add form
        const acSelect = document.getElementById('fin-account-select');
        if (acSelect) {
            const current = acSelect.value;
            acSelect.innerHTML = '<option value="">Sem conta</option>' +
                (personalAccounts.length ? `<optgroup label="👤 Pessoal">${personalAccounts.map(a => `<option value="${a.id}" ${String(a.id) === current ? 'selected' : ''}>${this._escapeHTML(a.name)}</option>`).join('')}</optgroup>` : '') +
                (businessAccounts.length ? `<optgroup label="🏢 Empresa">${businessAccounts.map(a => `<option value="${a.id}" ${String(a.id) === current ? 'selected' : ''}>${this._escapeHTML(a.name)}</option>`).join('')}</optgroup>` : '');
        }
    }

    // ===== BUDGETS PER CATEGORY =====
    async loadBudgets() {
        if (!this.auth.getToken()) return;
        try {
            const m = this.viewMonth + 1;
            const y = this.viewYear;
            const resp = await this.auth.apiRequest(`/api/budgets?month=${m}&year=${y}`, { method: 'GET' });
            if (resp && Array.isArray(resp.budgets)) {
                this.budgets = resp.budgets.map(b => ({ ...b, amount: parseFloat(b.amount) }));
                this.renderBudgets();
            }
        } catch (err) { console.warn('Erro ao carregar orçamentos:', err); }
    }

    async saveBudget() {
        const catEl = document.getElementById('fin-budget-cat');
        const amtEl = document.getElementById('fin-budget-amount');
        const category = catEl?.value;
        const amount = parseFloat(amtEl?.value);
        if (!category) { this.auth.showNotification('Selecione uma categoria.', 'warning'); return; }
        if (!amount || amount <= 0) { this.auth.showNotification('Informe um valor válido.', 'warning'); return; }

        const month = this.viewMonth + 1;
        const year = this.viewYear;

        if (this.auth.getToken()) {
            try {
                const resp = await this.auth.apiRequest('/api/budgets', {
                    method: 'POST',
                    body: JSON.stringify({ category, amount, month, year })
                });
                const idx = this.budgets.findIndex(b => b.category === category);
                const newBudget = { ...resp.budget, amount: parseFloat(resp.budget.amount) };
                if (idx !== -1) this.budgets[idx] = newBudget;
                else this.budgets.push(newBudget);
            } catch (err) { this.auth.showNotification(err.message || 'Erro', 'error'); return; }
        } else {
            const idx = this.budgets.findIndex(b => b.category === category);
            if (idx !== -1) this.budgets[idx].amount = amount;
            else this.budgets.push({ id: Date.now(), category, amount, month, year });
        }

        if (amtEl) amtEl.value = '';
        if (catEl) catEl.selectedIndex = 0;
        this.renderBudgets();
        this.saveData();
        this.auth.showNotification('Orçamento salvo!', 'success');
    }

    async deleteBudget(id) {
        if (this.auth.getToken() && Number.isInteger(id)) {
            try { await this.auth.apiRequest(`/api/budgets/${id}`, { method: 'DELETE' }); }
            catch (err) { this.auth.showNotification(err.message || 'Erro', 'error'); return; }
        }
        this.budgets = this.budgets.filter(b => b.id !== id);
        this.renderBudgets();
        this.saveData();
    }

    renderBudgets() {
        const container = document.getElementById('fin-budgets-list');
        if (!container) return;

        if (this.budgets.length === 0) {
            container.innerHTML = '<div class="fin-empty-cats">Defina orçamentos por categoria</div>';
            return;
        }

        const monthExpenses = this._getMonthTransactions().filter(t => t.type === 'expense');
        container.innerHTML = this.budgets.map(b => {
            const spent = monthExpenses.filter(t => t.category === b.category).reduce((s, t) => s + t.amount, 0);
            const cat = this.categories.find(c => c.id === b.category) || { name: b.category, icon: 'fa-tag', color: '#9CA3AF' };
            const pct = b.amount > 0 ? Math.min((spent / b.amount) * 100, 100) : 0;
            const remaining = Math.max(b.amount - spent, 0);
            const status = pct >= 100 ? 'over' : pct >= 80 ? 'warning' : 'ok';

            return `
                <div class="fin-budget-item budget-${status}">
                    <div class="fin-budget-item-header">
                        <span style="color:${cat.color}"><i class="fas ${cat.icon}"></i> ${cat.name}</span>
                        <span>${this._formatBRL(spent)} / ${this._formatBRL(b.amount)}</span>
                        <button class="fin-budget-del" onclick="window.app.financeManager.deleteBudget(${b.id})" title="Remover"><i class="fas fa-times"></i></button>
                    </div>
                    <div class="fin-budget-item-bar">
                        <div class="fin-budget-item-fill budget-fill-${status}" style="width:${pct}%"></div>
                    </div>
                    <div class="fin-budget-item-footer">
                        <span>${pct.toFixed(0)}% usado</span>
                        <span>Resta ${this._formatBRL(remaining)}</span>
                    </div>
                </div>`;
        }).join('');
    }

    // ===== SERVER DATA =====
    async loadServerData() {
        if (!this.auth.getToken()) return;
        try {
            const m = this.viewMonth + 1;
            const y = this.viewYear;
            const [finResp] = await Promise.all([
                this.auth.apiRequest(`/api/finances?month=${m}&year=${y}`, { method: 'GET' }),
                this.loadAccounts(),
                this.loadBudgets(),
                this.loadRecurringTransactions(),
                this.loadSavingsGoals(),
                this.loadChartData()
            ]);
            if (finResp && Array.isArray(finResp.finances)) {
                const otherTx = this.transactions.filter(t => {
                    const d = new Date(t.date);
                    return !(d.getMonth() === this.viewMonth && d.getFullYear() === this.viewYear);
                });
                const monthTx = finResp.finances.map(f => this._mapServer(f));
                this.transactions = [...monthTx, ...otherTx];
                this._recalcTotals();
                this.renderAll();
            }
        } catch (err) {
            console.warn('Erro ao carregar finanças:', err);
        }
    }

    // ===== RECURRING TRANSACTIONS =====
    async loadRecurringTransactions() {
        if (!this.auth.getToken()) return;
        try {
            const resp = await this.auth.apiRequest('/api/recurring-transactions', { method: 'GET' });
            if (resp && Array.isArray(resp.recurring)) {
                this.recurringTransactions = resp.recurring.map(r => ({ ...r, amount: parseFloat(r.amount) }));
                this.renderRecurring();
            }
        } catch (err) { console.warn('Erro ao carregar recorrentes:', err); }
    }

    async addRecurring() {
        const type = document.getElementById('fin-rec-type')?.value || 'expense';
        const amount = parseFloat(document.getElementById('fin-rec-amount')?.value);
        const category = document.getElementById('fin-rec-category')?.value || '';
        const description = document.getElementById('fin-rec-desc')?.value?.trim() || '';
        const frequency = document.getElementById('fin-rec-frequency')?.value || 'monthly';
        const dayOfMonth = parseInt(document.getElementById('fin-rec-day')?.value) || 1;
        const startDate = document.getElementById('fin-rec-start')?.value;

        if (!amount || amount <= 0) { this.auth.showNotification('Informe um valor.', 'warning'); return; }
        if (!startDate) { this.auth.showNotification('Informe a data de início.', 'warning'); return; }

        try {
            if (this.auth.getToken()) {
                const resp = await this.auth.apiRequest('/api/recurring-transactions', {
                    method: 'POST',
                    body: JSON.stringify({ type, amount, category, description, frequency, day_of_month: dayOfMonth, start_date: startDate })
                });
                this.recurringTransactions.unshift({ ...resp.recurring, amount: parseFloat(resp.recurring.amount) });
            } else {
                this.recurringTransactions.unshift({ id: Date.now(), type, amount, category, description, frequency, day_of_month: dayOfMonth, start_date: startDate, active: true });
            }
            this._clearRecurringForm();
            this.renderRecurring();
            this.saveData();
            this.auth.showNotification('Transação recorrente criada!', 'success');
        } catch (err) { this.auth.showNotification(err.message || 'Erro', 'error'); }
    }

    async deleteRecurring(id) {
        if (!confirm('Excluir transação recorrente?')) return;
        try {
            if (this.auth.getToken()) await this.auth.apiRequest(`/api/recurring-transactions/${id}`, { method: 'DELETE' });
            this.recurringTransactions = this.recurringTransactions.filter(r => r.id !== id);
            this.renderRecurring();
            this.saveData();
            this.auth.showNotification('Recorrente excluída.', 'info');
        } catch (err) { this.auth.showNotification(err.message || 'Erro', 'error'); }
    }

    async generateRecurring() {
        try {
            const resp = await this.auth.apiRequest('/api/recurring-transactions/generate', { method: 'POST' });
            if (resp.generated > 0) {
                this.auth.showNotification(resp.message, 'success');
                this.loadServerData();
            } else {
                this.auth.showNotification('Nenhuma transação pendente.', 'info');
            }
        } catch (err) { this.auth.showNotification(err.message || 'Erro', 'error'); }
    }

    renderRecurring() {
        const container = document.getElementById('fin-recurring-list');
        if (!container) return;
        if (!this.recurringTransactions.length) {
            container.innerHTML = '<div class="fin-empty-cats">Nenhuma transação recorrente</div>';
            return;
        }
        const freqLabels = { daily: 'Diária', weekly: 'Semanal', monthly: 'Mensal', yearly: 'Anual' };
        container.innerHTML = this.recurringTransactions.map(r => {
            const cat = this.categories.find(c => c.id === r.category) || { name: r.category || 'Outros', icon: 'fa-tag', color: '#9CA3AF' };
            const sign = r.type === 'income' ? '+' : '-';
            const colorClass = r.type === 'income' ? 'positive' : 'negative';
            return `
                <div class="fin-recurring-item ${r.active ? '' : 'inactive'}">
                    <div class="fin-recurring-icon" style="color:${cat.color}"><i class="fas ${cat.icon}"></i></div>
                    <div class="fin-recurring-info">
                        <span class="fin-recurring-name">${this._escapeHTML(r.description || cat.name)}</span>
                        <span class="fin-recurring-freq">${freqLabels[r.frequency] || r.frequency}${r.day_of_month ? ` (dia ${r.day_of_month})` : ''}</span>
                    </div>
                    <div class="fin-recurring-amount ${colorClass}">${sign}${this._formatBRL(r.amount)}</div>
                    <button class="fin-recurring-del" onclick="window.app.financeManager.deleteRecurring(${r.id})" title="Excluir"><i class="fas fa-times"></i></button>
                </div>`;
        }).join('');
    }

    _clearRecurringForm() {
        ['fin-rec-amount', 'fin-rec-desc', 'fin-rec-start'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    }

    // ===== SAVINGS GOALS =====
    async loadSavingsGoals() {
        if (!this.auth.getToken()) return;
        try {
            const resp = await this.auth.apiRequest('/api/savings-goals', { method: 'GET' });
            if (resp && Array.isArray(resp.goals)) {
                this.savingsGoals = resp.goals.map(g => ({ ...g, target_amount: parseFloat(g.target_amount), current_amount: parseFloat(g.current_amount) }));
                this.renderSavingsGoals();
            }
        } catch (err) { console.warn('Erro ao carregar metas:', err); }
    }

    async addSavingsGoal() {
        const name = document.getElementById('fin-goal-name')?.value?.trim();
        const targetAmount = parseFloat(document.getElementById('fin-goal-target')?.value);
        const deadline = document.getElementById('fin-goal-deadline')?.value || null;

        if (!name) { this.auth.showNotification('Informe o nome da meta.', 'warning'); return; }
        if (!targetAmount || targetAmount <= 0) { this.auth.showNotification('Informe um valor.', 'warning'); return; }

        try {
            if (this.auth.getToken()) {
                const resp = await this.auth.apiRequest('/api/savings-goals', {
                    method: 'POST',
                    body: JSON.stringify({ name, target_amount: targetAmount, deadline })
                });
                this.savingsGoals.unshift({ ...resp.goal, target_amount: parseFloat(resp.goal.target_amount), current_amount: 0 });
            } else {
                this.savingsGoals.unshift({ id: Date.now(), name, target_amount: targetAmount, current_amount: 0, deadline, status: 'active' });
            }
            this._clearGoalForm();
            this.renderSavingsGoals();
            this.saveData();
            this.auth.showNotification('Meta criada!', 'success');
        } catch (err) { this.auth.showNotification(err.message || 'Erro', 'error'); }
    }

    async addDeposit(goalId) {
        const input = document.getElementById(`fin-deposit-${goalId}`);
        const amount = parseFloat(input?.value);
        if (!amount || amount <= 0) { this.auth.showNotification('Informe um valor.', 'warning'); return; }

        try {
            if (this.auth.getToken()) {
                const resp = await this.auth.apiRequest(`/api/savings-goals/${goalId}/deposit`, {
                    method: 'POST',
                    body: JSON.stringify({ amount })
                });
                const idx = this.savingsGoals.findIndex(g => g.id === goalId);
                if (idx !== -1) {
                    this.savingsGoals[idx] = { ...resp.goal, target_amount: parseFloat(resp.goal.target_amount), current_amount: parseFloat(resp.goal.current_amount) };
                }
            } else {
                const goal = this.savingsGoals.find(g => g.id === goalId);
                if (goal) goal.current_amount += amount;
            }
            if (input) input.value = '';
            this.renderSavingsGoals();
            this.saveData();
            this.auth.showNotification('Depósito registrado!', 'success');
        } catch (err) { this.auth.showNotification(err.message || 'Erro', 'error'); }
    }

    async deleteSavingsGoal(id) {
        if (!confirm('Excluir esta meta?')) return;
        try {
            if (this.auth.getToken()) await this.auth.apiRequest(`/api/savings-goals/${id}`, { method: 'DELETE' });
            this.savingsGoals = this.savingsGoals.filter(g => g.id !== id);
            this.renderSavingsGoals();
            this.saveData();
            this.auth.showNotification('Meta excluída.', 'info');
        } catch (err) { this.auth.showNotification(err.message || 'Erro', 'error'); }
    }

    renderSavingsGoals() {
        const container = document.getElementById('fin-savings-goals-list');
        if (!container) return;
        if (!this.savingsGoals.length) {
            container.innerHTML = '<div class="fin-empty-cats">Nenhuma meta de economia</div>';
            return;
        }
        container.innerHTML = this.savingsGoals.map(g => {
            const pct = g.target_amount > 0 ? Math.min((g.current_amount / g.target_amount) * 100, 100) : 0;
            const remaining = Math.max(g.target_amount - g.current_amount, 0);
            const statusClass = g.status === 'completed' ? 'completed' : pct >= 80 ? 'almost' : '';
            const deadlineLabel = g.deadline ? new Date(g.deadline + 'T12:00:00').toLocaleDateString('pt-BR') : '';
            return `
                <div class="fin-goal-card ${statusClass}">
                    <div class="fin-goal-header">
                        <div class="fin-goal-icon" style="background:${g.color || '#10B981'}20;color:${g.color || '#10B981'}">
                            <i class="fas ${g.icon || 'fa-piggy-bank'}"></i>
                        </div>
                        <div class="fin-goal-info">
                            <span class="fin-goal-name">${this._escapeHTML(g.name)}</span>
                            ${deadlineLabel ? `<span class="fin-goal-deadline"><i class="fas fa-calendar"></i> ${deadlineLabel}</span>` : ''}
                        </div>
                        <button class="fin-goal-del" onclick="window.app.financeManager.deleteSavingsGoal(${g.id})"><i class="fas fa-times"></i></button>
                    </div>
                    <div class="fin-goal-amounts">
                        <span>${this._formatBRL(g.current_amount)}</span>
                        <span>de ${this._formatBRL(g.target_amount)}</span>
                    </div>
                    <div class="fin-goal-bar-track">
                        <div class="fin-goal-bar-fill" style="width:${pct}%"></div>
                    </div>
                    <div class="fin-goal-footer">
                        <span>${pct.toFixed(0)}% — Falta ${this._formatBRL(remaining)}</span>
                    </div>
                    ${g.status !== 'completed' ? `
                    <div class="fin-goal-deposit-row">
                        <input type="number" id="fin-deposit-${g.id}" placeholder="Valor R$" step="0.01" min="0" />
                        <button onclick="window.app.financeManager.addDeposit(${g.id})"><i class="fas fa-plus"></i> Depositar</button>
                    </div>` : '<div class="fin-goal-completed"><i class="fas fa-check-circle"></i> Meta alcançada!</div>'}
                </div>`;
        }).join('');
    }

    _clearGoalForm() {
        ['fin-goal-name', 'fin-goal-target', 'fin-goal-deadline'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    }

    // ===== DEBTS (Controle de Dívidas) =====
    async loadDebts() {
        if (!this.auth.getToken()) return;
        try {
            const [debtsResp, summaryResp] = await Promise.all([
                this.auth.apiRequest('/api/debts', { method: 'GET' }),
                this.auth.apiRequest('/api/debts/summary', { method: 'GET' })
            ]);
            this.debts = debtsResp.debts || [];
            this.debtsSummary = summaryResp;
            this.renderDebts();
        } catch (err) { console.warn('Erro ao carregar dívidas:', err); }
    }

    async addDebt() {
        const name = document.getElementById('fin-debt-name')?.value?.trim();
        const creditor = document.getElementById('fin-debt-creditor')?.value?.trim() || '';
        const totalAmount = parseFloat(document.getElementById('fin-debt-amount')?.value) || 0;
        const interestRate = parseFloat(document.getElementById('fin-debt-interest')?.value) || 0;
        const totalInstallments = parseInt(document.getElementById('fin-debt-installments')?.value) || 1;
        const dueDay = parseInt(document.getElementById('fin-debt-due-day')?.value) || 1;
        const category = document.getElementById('fin-debt-category')?.value || 'outros';
        const priority = parseInt(document.getElementById('fin-debt-priority')?.value) || 2;
        const notes = document.getElementById('fin-debt-notes')?.value || '';

        if (!name || totalAmount <= 0) {
            this.auth.showNotification('Preencha nome e valor da dívida.', 'warning');
            return;
        }

        const debt = { name, creditor, total_amount: totalAmount, interest_rate: interestRate, total_installments: totalInstallments, due_day: dueDay, category, priority, notes };

        try {
            if (this.auth.getToken()) {
                const resp = await this.auth.apiRequest('/api/debts', { method: 'POST', body: JSON.stringify(debt) });
                this.debts.push(resp.debt);
                this.auth.showNotification(resp.message || 'Dívida cadastrada!', 'success');
            } else {
                debt.id = Date.now();
                debt.paid_amount = 0;
                debt.paid_installments = 0;
                debt.remaining = totalAmount;
                debt.status = 'active';
                this.debts.push(debt);
            }
            this._clearDebtForm();
            this.renderDebts();
            this.loadDebts();
        } catch (err) { this.auth.showNotification(err.message || 'Erro ao cadastrar dívida', 'error'); }
    }

    async payDebt(id) {
        const amountEl = document.getElementById(`fin-debt-pay-${id}`);
        const amount = parseFloat(amountEl?.value) || 0;
        if (amount <= 0) { this.auth.showNotification('Informe o valor do pagamento.', 'warning'); return; }

        try {
            if (this.auth.getToken()) {
                const resp = await this.auth.apiRequest(`/api/debts/${id}/payment`, {
                    method: 'POST',
                    body: JSON.stringify({ amount })
                });
                const idx = this.debts.findIndex(d => d.id === id);
                if (idx >= 0) this.debts[idx] = resp.debt;
                this.auth.showNotification(resp.message || 'Pagamento registrado!', 'success');
            } else {
                const debt = this.debts.find(d => d.id === id);
                if (debt) {
                    debt.paid_amount = (debt.paid_amount || 0) + amount;
                    debt.paid_installments = Math.min((debt.paid_installments || 0) + 1, debt.total_installments);
                    debt.remaining = debt.total_amount - debt.paid_amount;
                    if (debt.paid_amount >= debt.total_amount) debt.status = 'paid';
                }
            }
            amountEl.value = '';
            this.renderDebts();
            this.loadDebts();
        } catch (err) { this.auth.showNotification(err.message || 'Erro ao registrar pagamento', 'error'); }
    }

    async deleteDebt(id) {
        if (!confirm('Excluir esta dívida? Esta ação não pode ser desfeita.')) return;
        try {
            if (this.auth.getToken()) await this.auth.apiRequest(`/api/debts/${id}`, { method: 'DELETE' });
            this.debts = this.debts.filter(d => d.id !== id);
            this.renderDebts();
            this.loadDebts();
            this.auth.showNotification('Dívida excluída.', 'info');
        } catch (err) { this.auth.showNotification(err.message || 'Erro', 'error'); }
    }

    renderDebts() {
        const container = document.getElementById('fin-debts-list');
        const summaryEl = document.getElementById('fin-debts-summary');
        if (!container) return;

        // Summary
        if (summaryEl && this.debtsSummary) {
            const s = this.debtsSummary;
            const pctPaid = s.totalDebtAmount > 0 ? (s.totalPaid / s.totalDebtAmount * 100) : 0;
            summaryEl.innerHTML = `
                <div class="fin-debt-summary-grid">
                    <div class="fin-debt-kpi">
                        <span class="kpi-value">${s.activeDebts}</span>
                        <span class="kpi-label">Ativas</span>
                    </div>
                    <div class="fin-debt-kpi">
                        <span class="kpi-value">${s.paidDebts}</span>
                        <span class="kpi-label">Quitadas</span>
                    </div>
                    <div class="fin-debt-kpi">
                        <span class="kpi-value negative">${this._formatBRL(s.totalRemaining)}</span>
                        <span class="kpi-label">Total Restante</span>
                    </div>
                    <div class="fin-debt-kpi">
                        <span class="kpi-value positive">${pctPaid.toFixed(0)}%</span>
                        <span class="kpi-label">Progresso</span>
                    </div>
                </div>
            `;
        }

        if (!this.debts.length) {
            container.innerHTML = '<div class="fin-empty-cats">Nenhuma dívida cadastrada</div>';
            return;
        }

        const priorityLabels = { 1: '🔴 Alta', 2: '🟡 Média', 3: '🟢 Baixa' };
        const categoryIcons = { cartao: 'fa-credit-card', emprestimo: 'fa-hand-holding-usd', financiamento: 'fa-car', outros: 'fa-file-invoice-dollar' };

        container.innerHTML = this.debts.map(d => {
            const pct = d.total_amount > 0 ? Math.min((d.paid_amount / d.total_amount) * 100, 100) : 0;
            const remaining = Math.max(d.total_amount - d.paid_amount, 0);
            const statusClass = d.status === 'paid' ? 'paid' : pct >= 80 ? 'almost' : '';
            const installmentText = d.total_installments > 1 ? `${d.paid_installments}/${d.total_installments} parcelas` : 'À vista';
            const icon = categoryIcons[d.category] || 'fa-file-invoice-dollar';

            return `
                <div class="fin-debt-card ${statusClass}">
                    <div class="fin-debt-header">
                        <div class="fin-debt-icon">
                            <i class="fas ${icon}"></i>
                        </div>
                        <div class="fin-debt-info">
                            <span class="fin-debt-name">${this._escapeHTML(d.name)}</span>
                            ${d.creditor ? `<span class="fin-debt-creditor"><i class="fas fa-building"></i> ${this._escapeHTML(d.creditor)}</span>` : ''}
                            <span class="fin-debt-priority">${priorityLabels[d.priority] || '🟡 Média'}</span>
                        </div>
                        <button class="fin-debt-del" onclick="window.app.financeManager.deleteDebt(${d.id})" title="Excluir"><i class="fas fa-trash"></i></button>
                    </div>
                    <div class="fin-debt-amounts">
                        <div class="fin-debt-main-amount">
                            <span class="label">Valor Total</span>
                            <span class="value">${this._formatBRL(d.total_amount)}</span>
                        </div>
                        <div class="fin-debt-paid">
                            <span class="label">Pago</span>
                            <span class="value positive">${this._formatBRL(d.paid_amount)}</span>
                        </div>
                        <div class="fin-debt-remaining">
                            <span class="label">Restante</span>
                            <span class="value negative">${this._formatBRL(remaining)}</span>
                        </div>
                    </div>
                    <div class="fin-debt-bar-track">
                        <div class="fin-debt-bar-fill" style="width:${pct}%"></div>
                    </div>
                    <div class="fin-debt-footer">
                        <span><i class="fas fa-calendar-alt"></i> Vence dia ${d.due_day}</span>
                        <span>${installmentText}</span>
                        ${d.interest_rate > 0 ? `<span><i class="fas fa-percentage"></i> ${d.interest_rate}% juros</span>` : ''}
                    </div>
                    ${d.status !== 'paid' ? `
                    <div class="fin-debt-pay-row">
                        <input type="number" id="fin-debt-pay-${d.id}" placeholder="Valor R$" step="0.01" min="0" />
                        <button onclick="window.app.financeManager.payDebt(${d.id})"><i class="fas fa-money-bill-wave"></i> Pagar</button>
                    </div>` : '<div class="fin-debt-paid-badge"><i class="fas fa-check-circle"></i> QUITADA</div>'}
                </div>`;
        }).join('');
    }

    _clearDebtForm() {
        ['fin-debt-name', 'fin-debt-creditor', 'fin-debt-amount', 'fin-debt-interest', 'fin-debt-installments', 'fin-debt-due-day', 'fin-debt-notes'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
        const catEl = document.getElementById('fin-debt-category');
        if (catEl) catEl.selectedIndex = 0;
        const prioEl = document.getElementById('fin-debt-priority');
        if (prioEl) prioEl.value = '2';
    }

    // ===== CHARTS =====
    async loadChartData() {
        if (!this.auth.getToken()) return;
        try {
            const resp = await this.auth.apiRequest('/api/finances/chart-data?months=6', { method: 'GET' });
            this.chartData = resp;
            this.renderCharts();
        } catch (err) { console.warn('Erro ao carregar gráficos:', err); }
    }

    renderCharts() {
        if (!this.chartData || !window.Chart) return;
        const ctx = document.getElementById('fin-chart-monthly');
        if (!ctx) return;

        if (this.chartInstance) this.chartInstance.destroy();

        const data = this.chartData.monthly || [];
        const labels = data.map(d => {
            const dt = new Date(d.month);
            return dt.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
        });

        this.chartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels,
                datasets: [
                    { label: 'Receitas', data: data.map(d => d.income), backgroundColor: 'rgba(16, 185, 129, 0.7)', borderRadius: 4 },
                    { label: 'Despesas', data: data.map(d => d.expenses), backgroundColor: 'rgba(239, 68, 68, 0.7)', borderRadius: 4 }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'top' } },
                scales: { y: { beginAtZero: true, ticks: { callback: v => 'R$' + v.toLocaleString('pt-BR') } } }
            }
        });
    }

    // ===== EXPORT =====
    exportCSV() {
        const monthTx = this._getMonthTransactions();
        if (!monthTx.length) { this.auth.showNotification('Nenhuma transação para exportar.', 'warning'); return; }

        const headers = ['Data', 'Tipo', 'Categoria', 'Descrição', 'Valor', 'Método'];
        const rows = monthTx.map(t => {
            const date = new Date(t.date).toLocaleDateString('pt-BR');
            const cat = this.categories.find(c => c.id === t.category)?.name || t.category;
            return [date, t.type === 'income' ? 'Receita' : 'Despesa', cat, `"${(t.description || '').replace(/"/g, '""')}"`, t.amount.toFixed(2).replace('.', ','), t.payment_method || ''];
        });

        const csv = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `financas_${this.viewMonth + 1}_${this.viewYear}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        this.auth.showNotification('CSV exportado!', 'success');
    }

    exportPDF() {
        const monthTx = this._getMonthTransactions();
        if (!monthTx.length) { this.auth.showNotification('Nenhuma transação para exportar.', 'warning'); return; }

        const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
        const monthName = months[this.viewMonth];
        const income = monthTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
        const expense = monthTx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

        let html = `<html><head><title>Relatório Financeiro</title><style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            h1 { color: #111827; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #E5E7EB; padding: 8px; text-align: left; }
            th { background: #F3F4F6; }
            .income { color: #10B981; }
            .expense { color: #EF4444; }
            .summary { margin-top: 20px; padding: 15px; background: #F9FAFB; border-radius: 8px; }
        </style></head><body>
            <h1>Relatório Financeiro — ${monthName} ${this.viewYear}</h1>
            <div class="summary">
                <p><strong>Receitas:</strong> <span class="income">${this._formatBRL(income)}</span></p>
                <p><strong>Despesas:</strong> <span class="expense">${this._formatBRL(expense)}</span></p>
                <p><strong>Saldo:</strong> ${this._formatBRL(income - expense)}</p>
            </div>
            <table>
                <thead><tr><th>Data</th><th>Tipo</th><th>Categoria</th><th>Descrição</th><th>Valor</th></tr></thead>
                <tbody>
                    ${monthTx.map(t => {
                        const cat = this.categories.find(c => c.id === t.category)?.name || t.category;
                        const cls = t.type === 'income' ? 'income' : 'expense';
                        return `<tr><td>${new Date(t.date).toLocaleDateString('pt-BR')}</td><td>${t.type === 'income' ? 'Receita' : 'Despesa'}</td><td>${cat}</td><td>${this._escapeHTML(t.description || '-')}</td><td class="${cls}">${this._formatBRL(t.amount)}</td></tr>`;
                    }).join('')}
                </tbody>
            </table>
        </body></html>`;

        const win = window.open('', '_blank');
        win.document.write(html);
        win.document.close();
        win.print();
    }

    // ===== LOCAL STORAGE =====
    saveData() {
        try {
            localStorage.setItem(this.auth.getStorageKey('finances'), JSON.stringify({
                transactions: this.transactions,
                budgetGoal: this.budgetGoal,
                accounts: this.accounts,
                budgets: this.budgets,
                recurringTransactions: this.recurringTransactions,
                savingsGoals: this.savingsGoals
            }));
        } catch (e) {
            console.warn('Falha ao salvar finanças:', e);
        }
    }

    loadData() {
        try {
            const raw = localStorage.getItem(this.auth.getStorageKey('finances'));
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed.transactions && Array.isArray(parsed.transactions)) {
                    this.transactions = parsed.transactions.map(t => ({
                        ...t,
                        amount: parseFloat(t.amount)
                    }));
                    this.budgetGoal = parsed.budgetGoal || 0;
                    this.accounts = parsed.accounts || [];
                    this.budgets = parsed.budgets || [];
                    this.recurringTransactions = parsed.recurringTransactions || [];
                    this.savingsGoals = parsed.savingsGoals || [];
                    this._recalcTotals();
                }
            }
        } catch (e) {
            console.warn('Erro ao carregar finanças:', e);
        }
    }

    // ===== TEMPLATE =====
    static getTemplate() {
        return `
        <div class="fin-module">
            <!-- Hero Card -->
            <div class="fin-hero-card">
                <div class="fin-hero-top">
                    <div>
                        <div class="fin-hero-label">Saldo do Mês</div>
                        <div class="fin-hero-value positive" id="fin-hero-balance">R$ 0,00</div>
                    </div>
                    <div class="fin-month-nav">
                        <button class="fin-month-btn" id="fin-month-prev"><i class="fas fa-chevron-left"></i></button>
                        <span class="fin-month-label" id="fin-month-label">Março 2026</span>
                        <button class="fin-month-btn" id="fin-month-next"><i class="fas fa-chevron-right"></i></button>
                    </div>
                </div>
                <div class="fin-kpi-grid">
                    <div class="fin-kpi-card income-kpi">
                        <div class="fin-kpi-icon"><i class="fas fa-arrow-up"></i></div>
                        <div class="fin-kpi-info">
                            <span class="fin-kpi-value" id="fin-kpi-income">R$ 0,00</span>
                            <span class="fin-kpi-label">Receitas</span>
                        </div>
                    </div>
                    <div class="fin-kpi-card expense-kpi">
                        <div class="fin-kpi-icon"><i class="fas fa-arrow-down"></i></div>
                        <div class="fin-kpi-info">
                            <span class="fin-kpi-value" id="fin-kpi-expense">R$ 0,00</span>
                            <span class="fin-kpi-label">Despesas</span>
                        </div>
                    </div>
                    <div class="fin-kpi-card savings-kpi">
                        <div class="fin-kpi-icon"><i class="fas fa-piggy-bank"></i></div>
                        <div class="fin-kpi-info">
                            <span class="fin-kpi-value" id="fin-kpi-savings">0%</span>
                            <span class="fin-kpi-label">Economia</span>
                        </div>
                    </div>
                    <div class="fin-kpi-card count-kpi">
                        <div class="fin-kpi-icon"><i class="fas fa-receipt"></i></div>
                        <div class="fin-kpi-info">
                            <span class="fin-kpi-value" id="fin-kpi-count">0</span>
                            <span class="fin-kpi-label">Transações</span>
                        </div>
                    </div>
                    <div class="fin-kpi-card daily-kpi">
                        <div class="fin-kpi-icon"><i class="fas fa-calendar-day"></i></div>
                        <div class="fin-kpi-info">
                            <span class="fin-kpi-value" id="fin-kpi-daily-avg">R$ 0,00</span>
                            <span class="fin-kpi-label">Média/Dia</span>
                        </div>
                    </div>
                    <div class="fin-kpi-card projection-kpi">
                        <div class="fin-kpi-icon"><i class="fas fa-chart-line"></i></div>
                        <div class="fin-kpi-info">
                            <span class="fin-kpi-value" id="fin-kpi-projection">R$ 0,00</span>
                            <span class="fin-kpi-label">Projeção</span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Tab Navigation -->
            <div class="fin-tabs-nav">
                <button class="fin-tab-btn active" data-tab="transactions"><i class="fas fa-exchange-alt"></i> Transações</button>
                <button class="fin-tab-btn" data-tab="recurring"><i class="fas fa-sync-alt"></i> Recorrentes</button>
                <button class="fin-tab-btn" data-tab="accounts"><i class="fas fa-wallet"></i> Contas</button>
                <button class="fin-tab-btn" data-tab="goals"><i class="fas fa-piggy-bank"></i> Metas</button>
                <button class="fin-tab-btn" data-tab="debts"><i class="fas fa-file-invoice-dollar"></i> Dívidas</button>
                <button class="fin-tab-btn" data-tab="reports"><i class="fas fa-chart-bar"></i> Relatórios</button>
            </div>

            <!-- TAB: Transactions -->
            <div class="fin-tab-panel active" id="fin-panel-transactions">
                <!-- Add Transaction -->
                <div class="fin-add-card">
                <div class="fin-add-top">
                    <div class="fin-type-toggle">
                        <button class="fin-type-btn active" data-type="expense"><i class="fas fa-minus-circle"></i> Despesa</button>
                        <button class="fin-type-btn" data-type="income"><i class="fas fa-plus-circle"></i> Receita</button>
                    </div>
                </div>
                <div class="fin-add-row">
                    <div class="fin-add-field amount-field">
                        <span class="fin-currency">R$</span>
                        <input type="number" id="fin-amount" class="fin-add-input" placeholder="0,00" step="0.01" min="0" />
                    </div>
                    <select id="fin-category" class="fin-add-input fin-cat-select">
                        <option value="">Categoria</option>
                        <optgroup label="Despesas Pessoais">
                            <option value="alimentacao">🍔 Alimentação</option>
                            <option value="transporte">🚗 Transporte</option>
                            <option value="moradia">🏠 Moradia</option>
                            <option value="saude">❤️ Saúde</option>
                            <option value="lazer">🎮 Lazer</option>
                            <option value="educacao">📚 Educação</option>
                            <option value="vestuario">👕 Vestuário</option>
                            <option value="assinaturas">💳 Assinaturas</option>
                            <option value="presentes">🎁 Presentes</option>
                        </optgroup>
                        <optgroup label="Receitas">
                            <option value="salario">💰 Salário</option>
                            <option value="freelance">💻 Freelance</option>
                            <option value="rendimentos">📈 Rendimentos</option>
                            <option value="bonus">🎯 Bônus</option>
                        </optgroup>
                        <optgroup label="Empresarial">
                            <option value="faturamento">💵 Faturamento</option>
                            <option value="fornecedores">📦 Fornecedores</option>
                            <option value="funcionarios">👥 Funcionários</option>
                            <option value="impostos">📋 Impostos/Taxas</option>
                            <option value="aluguel_comercial">🏪 Aluguel Comercial</option>
                            <option value="marketing">📣 Marketing</option>
                            <option value="equipamentos">🖥️ Equipamentos</option>
                            <option value="servicos">🔧 Serviços</option>
                        </optgroup>
                        <option value="outros">⚡ Outros</option>
                    </select>
                    <input type="text" id="fin-description" class="fin-add-input" placeholder="Descrição (opcional)" />
                    <button class="fin-add-btn" id="fin-add-btn"><i class="fas fa-plus"></i></button>
                </div>
                <div class="fin-extra-fields" id="fin-extra-fields">
                    <input type="date" id="fin-date" class="fin-add-input" />
                    <select id="fin-method" class="fin-add-input">
                        <option value="">Método de pagamento</option>
                        <option value="pix">⚡ PIX</option>
                        <option value="cartao">💳 Cartão</option>
                        <option value="dinheiro">💵 Dinheiro</option>
                        <option value="transferencia">🏦 Transferência</option>
                    </select>
                    <select id="fin-account-select" class="fin-add-input">
                        <option value="">Sem conta</option>
                    </select>
                </div>
                <button class="fin-expand-btn" id="fin-expand-toggle"><i class="fas fa-chevron-down"></i> Mais detalhes</button>
            </div>

            <!-- Category Breakdown -->
            <div class="fin-section-card">
                <h3 class="fin-section-title"><i class="fas fa-chart-pie"></i> Despesas por Categoria</h3>
                <div class="fin-category-bars" id="fin-category-bars"></div>
            </div>

            <!-- Budgets per Category -->
            <div class="fin-section-card">
                <h3 class="fin-section-title"><i class="fas fa-bullseye"></i> Orçamentos por Categoria</h3>
                <div class="fin-budget-add-row">
                    <select id="fin-budget-cat" class="fin-add-input">
                        <option value="">Categoria</option>
                        <option value="alimentacao">Alimentação</option>
                        <option value="transporte">Transporte</option>
                        <option value="moradia">Moradia</option>
                        <option value="saude">Saúde</option>
                        <option value="lazer">Lazer</option>
                        <option value="educacao">Educação</option>
                        <option value="trabalho">Trabalho</option>
                        <option value="investimentos">Investimentos</option>
                        <option value="vestuario">Vestuário</option>
                        <option value="assinaturas">Assinaturas</option>
                        <option value="presentes">Presentes</option>
                        <option value="outros">Outros</option>
                    </select>
                    <input type="number" id="fin-budget-amount" class="fin-add-input" placeholder="Valor R$" step="0.01" min="0" />
                    <button class="fin-add-btn" onclick="window.app.financeManager.saveBudget()"><i class="fas fa-plus"></i></button>
                </div>
                <div id="fin-budgets-list"></div>
            </div>

            <!-- Toolbar -->
            <div class="fin-toolbar">
                <div class="fin-search-wrap">
                    <i class="fas fa-search"></i>
                    <input type="text" id="fin-search" class="fin-search-input" placeholder="Buscar transações..." />
                </div>
                <div class="fin-filters">
                    <button class="fin-filter-chip active" data-filter="all">Todas</button>
                    <button class="fin-filter-chip" data-filter="income">Receitas</button>
                    <button class="fin-filter-chip" data-filter="expense">Despesas</button>
                    <select id="fin-cat-filter" class="fin-cat-filter-select">
                        <option value="all">Todas categorias</option>
                        <option value="alimentacao">Alimentação</option>
                        <option value="transporte">Transporte</option>
                        <option value="moradia">Moradia</option>
                        <option value="saude">Saúde</option>
                        <option value="lazer">Lazer</option>
                        <option value="educacao">Educação</option>
                        <option value="trabalho">Trabalho</option>
                        <option value="investimentos">Investimentos</option>
                        <option value="vestuario">Vestuário</option>
                        <option value="assinaturas">Assinaturas</option>
                        <option value="presentes">Presentes</option>
                        <option value="salario">Salário</option>
                        <option value="freelance">Freelance</option>
                        <option value="outros">Outros</option>
                    </select>
                </div>
            </div>

                <!-- Transaction List -->
                <div class="fin-tx-list" id="fin-tx-list"></div>
            </div>

            <!-- TAB: Recurring -->
            <div class="fin-tab-panel" id="fin-panel-recurring">
                <div class="fin-section-card fin-recurring-section">
                    <div class="fin-section-header">
                        <h3 class="fin-section-title"><i class="fas fa-sync-alt"></i> Transações Recorrentes</h3>
                        <button class="fin-generate-btn-sm" onclick="window.app.financeManager.generateRecurring()">
                            <i class="fas fa-magic"></i> Gerar Pendentes do Mês
                        </button>
                    </div>
                    <p class="fin-section-desc">Configure despesas e receitas que se repetem automaticamente (aluguel, salário, assinaturas...)</p>
                    <div class="fin-recurring-form">
                        <div class="fin-recurring-add-row">
                            <select id="fin-rec-type" class="fin-add-input">
                                <option value="expense">📤 Despesa</option>
                                <option value="income">📥 Receita</option>
                            </select>
                            <input type="number" id="fin-rec-amount" class="fin-add-input" placeholder="Valor R$" step="0.01" min="0" />
                            <select id="fin-rec-category" class="fin-add-input">
                                <option value="">Categoria</option>
                                <optgroup label="Despesas Pessoais">
                                    <option value="alimentacao">🍔 Alimentação</option>
                                    <option value="transporte">🚗 Transporte</option>
                                    <option value="moradia">🏠 Moradia</option>
                                    <option value="saude">❤️ Saúde</option>
                                    <option value="lazer">🎮 Lazer</option>
                                    <option value="assinaturas">💳 Assinaturas</option>
                                </optgroup>
                                <optgroup label="Receitas">
                                    <option value="salario">💰 Salário</option>
                                    <option value="freelance">💻 Freelance</option>
                                    <option value="rendimentos">📈 Rendimentos</option>
                                </optgroup>
                                <optgroup label="Empresarial">
                                    <option value="faturamento">💵 Faturamento</option>
                                    <option value="fornecedores">📦 Fornecedores</option>
                                    <option value="funcionarios">👥 Funcionários</option>
                                    <option value="impostos">📋 Impostos</option>
                                    <option value="aluguel_comercial">🏪 Aluguel Comercial</option>
                                    <option value="servicos">🔧 Serviços</option>
                                </optgroup>
                                <option value="outros">⚡ Outros</option>
                            </select>
                        </div>
                        <div class="fin-recurring-add-row">
                            <input type="text" id="fin-rec-desc" class="fin-add-input" placeholder="Descrição (ex: Aluguel, Netflix)" />
                            <select id="fin-rec-frequency" class="fin-add-input">
                                <option value="monthly">📅 Mensal</option>
                                <option value="weekly">📆 Semanal</option>
                                <option value="daily">🔁 Diária</option>
                                <option value="yearly">📌 Anual</option>
                            </select>
                            <input type="number" id="fin-rec-day" class="fin-add-input" placeholder="Dia" min="1" max="31" />
                            <input type="date" id="fin-rec-start" class="fin-add-input" title="Data início" />
                            <button class="fin-add-btn" onclick="window.app.financeManager.addRecurring()"><i class="fas fa-plus"></i></button>
                        </div>
                    </div>
                    <div id="fin-recurring-list" class="fin-recurring-list"></div>
                </div>
            </div>

            <!-- TAB: Accounts -->
            <div class="fin-tab-panel" id="fin-panel-accounts">
                <div class="fin-section-card">
                    <h3 class="fin-section-title"><i class="fas fa-wallet"></i> Gerenciamento de Contas</h3>
                    <p class="fin-section-desc">Organize suas finanças separando contas pessoais e empresariais</p>
                    <div class="fin-account-add-row">
                        <input type="text" id="fin-account-name" class="fin-add-input" placeholder="Nome da conta" />
                        <select id="fin-account-scope" class="fin-add-input fin-scope-select">
                            <option value="personal">👤 Pessoal</option>
                            <option value="business">🏢 Empresa</option>
                        </select>
                        <select id="fin-account-type" class="fin-add-input">
                            <option value="checking">🏦 Conta Corrente</option>
                            <option value="savings">🐷 Poupança</option>
                            <option value="credit">💳 Cartão de Crédito</option>
                            <option value="wallet">👛 Carteira</option>
                            <option value="investment">📈 Investimento</option>
                            <option value="business_checking">🏢 Conta PJ</option>
                        </select>
                        <input type="number" id="fin-account-balance" class="fin-add-input" placeholder="Saldo R$" step="0.01" />
                        <button class="fin-add-btn" onclick="window.app.financeManager.addAccount()"><i class="fas fa-plus"></i></button>
                    </div>
                    <div id="fin-accounts-list"></div>
                </div>
            </div>

            <!-- TAB: Goals (Metas) -->
            <div class="fin-tab-panel" id="fin-panel-goals">
                <!-- Savings Goals -->
                <div class="fin-section-card">
                    <h3 class="fin-section-title"><i class="fas fa-piggy-bank"></i> Metas de Economia</h3>
                    <p class="fin-section-desc">Defina objetivos financeiros e acompanhe seu progresso</p>
                    <div class="fin-goal-add-row">
                        <input type="text" id="fin-goal-name" class="fin-add-input" placeholder="Nome da meta (ex: Viagem, Reserva)" />
                        <input type="number" id="fin-goal-target" class="fin-add-input" placeholder="Valor alvo R$" step="0.01" min="0" />
                        <input type="date" id="fin-goal-deadline" class="fin-add-input" />
                        <button class="fin-add-btn" onclick="window.app.financeManager.addSavingsGoal()"><i class="fas fa-plus"></i></button>
                    </div>
                    <div id="fin-savings-goals-list"></div>
                </div>
            </div>

            <!-- TAB: Debts (Dívidas) -->
            <div class="fin-tab-panel" id="fin-panel-debts">
                <div class="fin-section-card fin-debts-section">
                    <h3 class="fin-section-title"><i class="fas fa-file-invoice-dollar"></i> Controle de Dívidas</h3>
                    <div id="fin-debts-summary"></div>
                    <div class="fin-debt-add-form">
                        <div class="fin-debt-add-row">
                            <input type="text" id="fin-debt-name" class="fin-add-input" placeholder="Nome da dívida" />
                            <input type="text" id="fin-debt-creditor" class="fin-add-input" placeholder="Credor (banco, loja...)" />
                            <input type="number" id="fin-debt-amount" class="fin-add-input" placeholder="Valor total R$" step="0.01" min="0" />
                        </div>
                        <div class="fin-debt-add-row">
                            <input type="number" id="fin-debt-interest" class="fin-add-input" placeholder="Juros % (mensal)" step="0.01" min="0" />
                            <input type="number" id="fin-debt-installments" class="fin-add-input" placeholder="Nº parcelas" min="1" value="1" />
                            <input type="number" id="fin-debt-due-day" class="fin-add-input" placeholder="Dia vencimento" min="1" max="31" />
                        </div>
                        <div class="fin-debt-add-row">
                            <select id="fin-debt-category" class="fin-add-input">
                                <option value="cartao">💳 Cartão de Crédito</option>
                                <option value="emprestimo">🏦 Empréstimo</option>
                                <option value="financiamento">🚗 Financiamento</option>
                                <option value="outros">📄 Outros</option>
                            </select>
                            <select id="fin-debt-priority" class="fin-add-input">
                                <option value="1">🔴 Alta Prioridade</option>
                                <option value="2" selected>🟡 Média Prioridade</option>
                                <option value="3">🟢 Baixa Prioridade</option>
                            </select>
                            <button class="fin-add-btn" onclick="window.app.financeManager.addDebt()"><i class="fas fa-plus"></i> Adicionar</button>
                        </div>
                        <div class="fin-debt-add-row">
                            <textarea id="fin-debt-notes" class="fin-add-input fin-debt-notes" placeholder="Observações (opcional)"></textarea>
                        </div>
                    </div>
                    <div id="fin-debts-list"></div>
                </div>
            </div>

            <!-- TAB: Reports (Relatórios) -->
            <div class="fin-tab-panel" id="fin-panel-reports">
                <!-- Category Breakdown -->
                <div class="fin-section-card">
                    <h3 class="fin-section-title"><i class="fas fa-chart-pie"></i> Despesas por Categoria</h3>
                    <div class="fin-category-bars" id="fin-category-bars"></div>
                </div>

                <!-- Budgets per Category -->
                <div class="fin-section-card">
                    <h3 class="fin-section-title"><i class="fas fa-bullseye"></i> Orçamentos por Categoria</h3>
                    <div class="fin-budget-add-row">
                        <select id="fin-budget-cat" class="fin-add-input">
                            <option value="">Categoria</option>
                            <option value="alimentacao">Alimentação</option>
                            <option value="transporte">Transporte</option>
                            <option value="moradia">Moradia</option>
                            <option value="saude">Saúde</option>
                            <option value="lazer">Lazer</option>
                            <option value="educacao">Educação</option>
                            <option value="trabalho">Trabalho</option>
                            <option value="investimentos">Investimentos</option>
                            <option value="vestuario">Vestuário</option>
                            <option value="assinaturas">Assinaturas</option>
                            <option value="presentes">Presentes</option>
                            <option value="outros">Outros</option>
                        </select>
                        <input type="number" id="fin-budget-amount" class="fin-add-input" placeholder="Valor R$" step="0.01" min="0" />
                        <button class="fin-add-btn" onclick="window.app.financeManager.saveBudget()"><i class="fas fa-plus"></i></button>
                    </div>
                    <div id="fin-budgets-list"></div>
                </div>

                <!-- Charts -->
                <div class="fin-section-card">
                    <h3 class="fin-section-title"><i class="fas fa-chart-bar"></i> Evolução Mensal</h3>
                    <div class="fin-chart-container">
                        <canvas id="fin-chart-monthly" height="250"></canvas>
                    </div>
                </div>

                <!-- Export Actions -->
                <div class="fin-export-row">
                    <button class="fin-export-btn" onclick="window.app.financeManager.exportCSV()"><i class="fas fa-file-csv"></i> Exportar CSV</button>
                    <button class="fin-export-btn" onclick="window.app.financeManager.exportPDF()"><i class="fas fa-file-pdf"></i> Exportar PDF</button>
                </div>
            </div>
        </div>
        `;
    }
}

// Export
window.FinanceManager = FinanceManager;