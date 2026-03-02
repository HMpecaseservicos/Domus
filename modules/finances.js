// Finance Management Module
class FinanceManager {
    constructor(authManager) {
        this.auth = authManager;
        this.transactions = [];
        this.income = 0;
        this.expenses = 0;
    }

    // Initialize finance manager
    init() {
        this.updateFinanceSummary();
        this.renderFinanceChart();
        this.updateStats();
    }

    // Setup event listeners (call after DOM templates are injected)
    setupEventListeners() {
        const addTransactionBtn = document.getElementById('add-transaction-btn');
        if (addTransactionBtn) addTransactionBtn.addEventListener('click', () => this.showTransactionModal());
        
        const saveTransactionBtn = document.getElementById('save-transaction');
        if (saveTransactionBtn) saveTransactionBtn.addEventListener('click', () => this.saveTransaction());
        
        const cancelTransactionBtn = document.getElementById('cancel-transaction');
        if (cancelTransactionBtn) cancelTransactionBtn.addEventListener('click', () => this.hideTransactionModal());
    }

    // Show transaction modal
    showTransactionModal() {
        this.auth.showModal('transaction-modal');
    }

    // Hide transaction modal
    hideTransactionModal() {
        this.auth.hideModal('transaction-modal');
        const amount = document.getElementById('transaction-amount');
        const category = document.getElementById('transaction-category');
        const description = document.getElementById('transaction-description');
        if (amount) amount.value = '';
        if (category) category.value = '';
        if (description) description.value = '';
    }

    // Save transaction
    async saveTransaction() {
        const type = document.getElementById('transaction-type').value;
        const amount = parseFloat(document.getElementById('transaction-amount').value);
        const category = document.getElementById('transaction-category').value.trim();
        const description = document.getElementById('transaction-description').value.trim();
        
        if (!amount || amount <= 0 || !category) {
            this.auth.showNotification('Por favor, preencha todos os campos obrigatórios.', 'error');
            return;
        }

        if (this.auth.getToken()) {
            try {
                const resp = await this.auth.apiRequest('/api/finances', {
                    method: 'POST',
                    body: JSON.stringify({ type, amount, category, description })
                });
                
                const serverItem = resp.item;
                const item = {
                    id: serverItem.id,
                    type: serverItem.type,
                    amount: serverItem.amount,
                    category: serverItem.category,
                    description: serverItem.description,
                    date: serverItem.date || new Date().toISOString()
                };
                
                this.transactions.unshift(item);
                if (item.type === 'income') {
                    this.income += parseFloat(item.amount);
                } else {
                    this.expenses += parseFloat(item.amount);
                }
                
                this.hideTransactionModal();
                this.updateFinanceSummary();
                this.renderFinanceChart();
                this.updateStats();
                this.saveData();
                this.auth.showNotification('Transação adicionada com sucesso!', 'success');
            } catch (err) {
                this.auth.showNotification(err.message || 'Erro ao salvar transação', 'error');
                console.error(err);
            }
        } else {
            // Local fallback
            const transaction = {
                id: Date.now(),
                type,
                amount,
                category,
                description,
                date: new Date().toISOString()
            };
            
            this.transactions.push(transaction);
            if (type === 'income') {
                this.income += amount;
            } else {
                this.expenses += amount;
            }
            
            this.hideTransactionModal();
            this.updateFinanceSummary();
            this.renderFinanceChart();
            this.updateStats();
            this.saveData();
            this.auth.showNotification('Transação adicionada com sucesso!', 'success');
        }
    }

    // Update finance summary
    updateFinanceSummary() {
        const incomeEl = document.getElementById('income-value');
        const expensesEl = document.getElementById('expenses-value');
        
        if (incomeEl) incomeEl.textContent = `R$ ${this.income.toFixed(2)}`;
        if (expensesEl) expensesEl.textContent = `R$ ${this.expenses.toFixed(2)}`;
    }

    // Render finance chart
    renderFinanceChart() {
        const chart = document.getElementById('finance-chart');
        if (!chart) return;
        
        chart.innerHTML = '';
        const categories = {};
        
        this.transactions.forEach(transaction => {
            if (!categories[transaction.category]) categories[transaction.category] = 0;
            if (transaction.type === 'expense') {
                categories[transaction.category] += transaction.amount;
            }
        });

        const maxAmount = Math.max(...Object.values(categories), 1);
        
        Object.entries(categories).forEach(([category, amount]) => {
            const barHeight = (amount / maxAmount) * 100;
            const barElement = document.createElement('div');
            barElement.className = 'chart-bar';
            barElement.style.height = `${barHeight}%`;
            barElement.title = `${category}: R$ ${amount.toFixed(2)}`;
            barElement.innerHTML = `<div class="chart-label">${category}</div>`;
            chart.appendChild(barElement);
        });

        if (Object.keys(categories).length === 0) {
            chart.innerHTML = '<p style="text-align: center; color: var(--gray); padding: 20px;">Adicione transações para ver o gráfico</p>';
        }
    }

    // Update statistics
    updateStats() {
        const balance = this.income - this.expenses;
        const balanceEl = document.getElementById('balance');
        if (balanceEl) balanceEl.textContent = `R$ ${balance.toFixed(2)}`;
    }

    // Load data from server
    async loadServerData() {
        if (!this.auth.getToken()) return;

        try {
            const resp = await this.auth.apiRequest('/api/finances', { method: 'GET' });
            if (resp && Array.isArray(resp.finances)) {
                this.transactions = resp.finances.map(f => ({
                    id: f.id,
                    type: f.type,
                    amount: parseFloat(f.amount),
                    category: f.category,
                    description: f.description,
                    date: f.date || new Date().toISOString()
                }));
                
                // Recalculate income/expenses
                this.income = this.transactions
                    .filter(t => t.type === 'income')
                    .reduce((s, it) => s + parseFloat(it.amount), 0);
                this.expenses = this.transactions
                    .filter(t => t.type === 'expense')
                    .reduce((s, it) => s + parseFloat(it.amount), 0);
                
                this.updateFinanceSummary();
                this.renderFinanceChart();
                this.updateStats();
            }
        } catch (err) {
            console.warn('Erro ao carregar finanças do servidor:', err);
        }
    }

    // Save/load local data
    saveData() {
        try {
            const data = {
                transactions: this.transactions,
                income: this.income,
                expenses: this.expenses
            };
            localStorage.setItem('domus:finances', JSON.stringify(data));
        } catch (e) {
            console.warn('Falha ao salvar finanças em localStorage:', e);
        }
    }

    loadData() {
        try {
            const raw = localStorage.getItem('domus:finances');
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed.transactions && Array.isArray(parsed.transactions)) {
                    this.transactions = parsed.transactions;
                    this.income = parsed.income || 0;
                    this.expenses = parsed.expenses || 0;
                }
            }
        } catch (e) {
            console.warn('Erro ao carregar finanças do localStorage:', e);
        }
    }

    // Generate HTML template
    static getTemplate() {
        return `
            <div class="card">
                <div class="card-header">
                    <h2 class="card-title"><i class="fas fa-wallet"></i> Controle Financeiro</h2>
                    <div class="card-actions">
                        <button class="icon-btn" id="add-transaction-btn"><i class="fas fa-plus"></i></button>
                        <button class="icon-btn" id="finance-report-btn"><i class="fas fa-chart-pie"></i></button>
                    </div>
                </div>
                <div class="finance-summary">
                    <div class="finance-item">
                        <p>Receitas</p>
                        <p class="finance-value income" id="income-value">R$ 0,00</p>
                    </div>
                    <div class="finance-item">
                        <p>Despesas</p>
                        <p class="finance-value expenses" id="expenses-value">R$ 0,00</p>
                    </div>
                </div>
                <div class="finance-chart" id="finance-chart">
                    <!-- Gráfico será gerado aqui -->
                </div>
            </div>
        `;
    }

    // Transaction modal template
    static getTransactionModalTemplate() {
        return `
            <div class="modal" id="transaction-modal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3 class="modal-title">Adicionar Transação</h3>
                        <button class="close-modal">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="form-group">
                            <label for="transaction-type">Tipo</label>
                            <select id="transaction-type" class="form-control">
                                <option value="income">Receita</option>
                                <option value="expense">Despesa</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="transaction-amount">Valor (R$)</label>
                            <input type="number" id="transaction-amount" class="form-control" step="0.01" min="0" placeholder="0,00">
                        </div>
                        <div class="form-group">
                            <label for="transaction-category">Categoria</label>
                            <input type="text" id="transaction-category" class="form-control" placeholder="Ex: Alimentação, Salário...">
                        </div>
                        <div class="form-group">
                            <label for="transaction-description">Descrição</label>
                            <input type="text" id="transaction-description" class="form-control" placeholder="Descrição da transação">
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-outline" id="cancel-transaction">Cancelar</button>
                        <button class="btn btn-primary" id="save-transaction">Salvar Transação</button>
                    </div>
                </div>
            </div>
        `;
    }
}

// Export for use in other modules
window.FinanceManager = FinanceManager;