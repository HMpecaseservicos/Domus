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
    }

    // ===== INIT =====
    init() {
        this._recalcTotals();
        this.renderAll();
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

        const amount = parseFloat(amountEl?.value);
        const category = catEl?.value || '';
        const description = descEl?.value?.trim() || '';
        const date = dateEl?.value ? new Date(dateEl.value + 'T12:00:00').toISOString() : new Date().toISOString();
        const payment_method = methodEl?.value || '';

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
                    body: JSON.stringify({ type, amount, category, description, payment_method, date })
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
            const t = { id: Date.now(), type, amount, category, description, payment_method, date };
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

        if (this.auth.getToken()) {
            try {
                const resp = await this.auth.apiRequest(`/api/finances/${id}`, {
                    method: 'PUT',
                    body: JSON.stringify({ type, amount, category, description, payment_method, date })
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
            if (idx !== -1) Object.assign(this.transactions[idx], { type, amount, category, description, payment_method, date });
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

        const fmt = (v) => this._formatBRL(v);

        const balEl = document.getElementById('fin-kpi-balance');
        const incEl = document.getElementById('fin-kpi-income');
        const expEl = document.getElementById('fin-kpi-expense');
        const savEl = document.getElementById('fin-kpi-savings');
        const cntEl = document.getElementById('fin-kpi-count');
        const heroEl = document.getElementById('fin-hero-balance');

        if (heroEl) heroEl.textContent = fmt(balance);
        if (balEl) balEl.textContent = fmt(balance);
        if (incEl) incEl.textContent = fmt(inc);
        if (expEl) expEl.textContent = fmt(exp);
        if (savEl) savEl.textContent = `${savingsRate.toFixed(1)}%`;
        if (cntEl) cntEl.textContent = monthTx.length;

        // Update home dashboard balance
        const homeBalance = document.getElementById('balance');
        if (homeBalance) homeBalance.textContent = fmt(this.income - this.expenses);

        // Color balance
        if (heroEl) heroEl.className = 'fin-hero-value ' + (balance >= 0 ? 'positive' : 'negative');
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
            date: item.date || new Date().toISOString()
        };
    }

    _formatBRL(value) {
        return 'R$ ' + Math.abs(value).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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

    // ===== SERVER DATA =====
    async loadServerData() {
        if (!this.auth.getToken()) return;
        try {
            const m = this.viewMonth + 1;
            const y = this.viewYear;
            const resp = await this.auth.apiRequest(`/api/finances?month=${m}&year=${y}`, { method: 'GET' });
            if (resp && Array.isArray(resp.finances)) {
                // Merge: keep non-month data, replace month data
                const otherTx = this.transactions.filter(t => {
                    const d = new Date(t.date);
                    return !(d.getMonth() === this.viewMonth && d.getFullYear() === this.viewYear);
                });
                const monthTx = resp.finances.map(f => this._mapServer(f));
                this.transactions = [...monthTx, ...otherTx];
                this._recalcTotals();
                this.renderAll();
            }
        } catch (err) {
            console.warn('Erro ao carregar finanças:', err);
        }
    }

    // ===== LOCAL STORAGE =====
    saveData() {
        try {
            localStorage.setItem(this.auth.getStorageKey('finances'), JSON.stringify({
                transactions: this.transactions,
                budgetGoal: this.budgetGoal
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
                </div>
            </div>

            <!-- Budget Bar -->
            <div class="fin-budget-section" id="fin-budget-section" style="display:none">
                <div class="fin-budget-header">
                    <span class="fin-budget-title"><i class="fas fa-bullseye"></i> Orçamento Mensal</span>
                    <input type="number" class="fin-budget-input" id="fin-budget-input" placeholder="Meta R$" min="0" step="100" />
                </div>
                <div class="fin-budget-track">
                    <div class="fin-budget-fill" id="fin-budget-fill"></div>
                </div>
                <div class="fin-budget-label" id="fin-budget-label"></div>
            </div>

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
                        <option value="alimentacao">🍔 Alimentação</option>
                        <option value="transporte">🚗 Transporte</option>
                        <option value="moradia">🏠 Moradia</option>
                        <option value="saude">❤️ Saúde</option>
                        <option value="lazer">🎮 Lazer</option>
                        <option value="educacao">📚 Educação</option>
                        <option value="trabalho">💼 Trabalho</option>
                        <option value="investimentos">📈 Investimentos</option>
                        <option value="vestuario">👕 Vestuário</option>
                        <option value="assinaturas">💳 Assinaturas</option>
                        <option value="presentes">🎁 Presentes</option>
                        <option value="salario">💰 Salário</option>
                        <option value="freelance">💻 Freelance</option>
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
                </div>
                <button class="fin-expand-btn" id="fin-expand-toggle"><i class="fas fa-chevron-down"></i> Mais detalhes</button>
            </div>

            <!-- Category Breakdown -->
            <div class="fin-section-card">
                <h3 class="fin-section-title"><i class="fas fa-chart-pie"></i> Despesas por Categoria</h3>
                <div class="fin-category-bars" id="fin-category-bars"></div>
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
        `;
    }
}

// Export
window.FinanceManager = FinanceManager;