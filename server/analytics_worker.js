/**
 * DOMUS Analytics Worker
 * Automated weekly analysis & snapshot generation
 * Runs as an integrated cron inside the main server process
 */

const { run, get, all } = require('./db');

// Run interval: every Sunday at 3:00 AM (check every hour)
const ANALYSIS_INTERVAL = 60 * 60 * 1000; // 1 hour check interval
const ANALYSIS_DAY = 0; // Sunday (0 = Sunday in getDay())
const ANALYSIS_HOUR = 3; // 3 AM

let lastRunDate = null;

/**
 * Generate comprehensive analytics for a single user
 */
async function generateUserAnalytics(userId) {
    const now = new Date();
    const fourteenDaysAgo = new Date(now - 14 * 86400000);
    const twentyEightDaysAgo = new Date(now - 28 * 86400000);
    const isoRecent = fourteenDaysAgo.toISOString();
    const isoPrevious = twentyEightDaysAgo.toISOString();

    // ===== PRODUCTIVITY =====
    const recentTasks = await get(
        `SELECT COUNT(*) as total, SUM(CASE WHEN completed = true THEN 1 ELSE 0 END) as done 
         FROM tasks WHERE user_id = ? AND created_at >= ?`, [userId, isoRecent]
    );
    const prevTasks = await get(
        `SELECT COUNT(*) as total, SUM(CASE WHEN completed = true THEN 1 ELSE 0 END) as done 
         FROM tasks WHERE user_id = ? AND created_at >= ? AND created_at < ?`, [userId, isoPrevious, isoRecent]
    );

    const tasksByArea = await all(
        `SELECT life_area, COUNT(*) as count, SUM(CASE WHEN completed = true THEN 1 ELSE 0 END) as done 
         FROM tasks WHERE user_id = ? AND created_at >= ? AND life_area != '' GROUP BY life_area`, [userId, isoRecent]
    );

    // ===== FINANCIAL =====
    const recentIncome = await get(
        `SELECT COALESCE(SUM(amount), 0) as total FROM finances WHERE user_id = ? AND type = 'income' AND date >= ?`, [userId, isoRecent]
    );
    const recentExpense = await get(
        `SELECT COALESCE(SUM(amount), 0) as total FROM finances WHERE user_id = ? AND type = 'expense' AND date >= ?`, [userId, isoRecent]
    );
    const prevExpense = await get(
        `SELECT COALESCE(SUM(amount), 0) as total FROM finances WHERE user_id = ? AND type = 'expense' AND date >= ? AND date < ?`, [userId, isoPrevious, isoRecent]
    );

    const topCategories = await all(
        `SELECT category, SUM(amount) as total FROM finances WHERE user_id = ? AND type = 'expense' AND date >= ? 
         GROUP BY category ORDER BY total DESC LIMIT 5`, [userId, isoRecent]
    );

    // ===== EMOTIONAL =====
    const recentMood = await all(
        `SELECT mood, COUNT(*) as count, AVG(energy) as avg_energy, AVG(stress) as avg_stress, AVG(clarity) as avg_clarity 
         FROM thoughts WHERE user_id = ? AND date >= ? AND mood IS NOT NULL GROUP BY mood`, [userId, isoRecent]
    );
    const prevMood = await all(
        `SELECT mood, COUNT(*) as count, AVG(energy) as avg_energy, AVG(stress) as avg_stress 
         FROM thoughts WHERE user_id = ? AND date >= ? AND date < ? AND mood IS NOT NULL GROUP BY mood`, [userId, isoPrevious, isoRecent]
    );

    const recentEmotional = await get(
        `SELECT AVG(energy) as avg_energy, AVG(stress) as avg_stress, AVG(clarity) as avg_clarity, COUNT(*) as count
         FROM thoughts WHERE user_id = ? AND date >= ? AND (energy > 0 OR stress > 0 OR clarity > 0)`, [userId, isoRecent]
    );
    const prevEmotional = await get(
        `SELECT AVG(energy) as avg_energy, AVG(stress) as avg_stress, AVG(clarity) as avg_clarity, COUNT(*) as count
         FROM thoughts WHERE user_id = ? AND date >= ? AND date < ? AND (energy > 0 OR stress > 0 OR clarity > 0)`, [userId, isoPrevious, isoRecent]
    );

    // ===== GRATITUDE =====
    const gratCount = await get(
        `SELECT COUNT(*) as count FROM gratitude WHERE user_id = ? AND date >= ?`, [userId, isoRecent]
    );

    // ===== HABITS =====
    const habitCompletion = await get(
        `SELECT COUNT(*) as total FROM habit_logs WHERE habit_id IN (SELECT id FROM habits WHERE user_id = ?) AND log_date >= ?`,
        [userId, isoRecent]
    );

    return {
        period: { start: isoRecent, end: now.toISOString() },
        productivity: {
            recentTotal: parseInt(recentTasks?.total || 0),
            recentDone: parseInt(recentTasks?.done || 0),
            prevTotal: parseInt(prevTasks?.total || 0),
            prevDone: parseInt(prevTasks?.done || 0),
            byArea: tasksByArea
        },
        financial: {
            recentIncome: parseFloat(recentIncome?.total || 0),
            recentExpense: parseFloat(recentExpense?.total || 0),
            prevExpense: parseFloat(prevExpense?.total || 0),
            topCategories
        },
        emotional: {
            recentMood,
            prevMood,
            recentMetrics: {
                energy: parseFloat(recentEmotional?.avg_energy || 0),
                stress: parseFloat(recentEmotional?.avg_stress || 0),
                clarity: parseFloat(recentEmotional?.avg_clarity || 0),
                count: parseInt(recentEmotional?.count || 0)
            },
            prevMetrics: {
                energy: parseFloat(prevEmotional?.avg_energy || 0),
                stress: parseFloat(prevEmotional?.avg_stress || 0),
                clarity: parseFloat(prevEmotional?.avg_clarity || 0),
                count: parseInt(prevEmotional?.count || 0)
            }
        },
        gratitude: { count: parseInt(gratCount?.count || 0) },
        habits: { completions: parseInt(habitCompletion?.total || 0) }
    };
}

/**
 * Generate AI-style insights from analytics data
 */
function generateInsights(data) {
    const insights = [];
    const p = data.productivity;
    const f = data.financial;
    const e = data.emotional;

    // Productivity insights
    if (p.recentTotal > 0) {
        const recentRate = p.recentDone / p.recentTotal * 100;
        const prevRate = p.prevTotal > 0 ? (p.prevDone / p.prevTotal * 100) : 0;
        const diff = recentRate - prevRate;

        if (Math.abs(diff) > 5 && p.prevTotal > 0) {
            insights.push({
                type: 'productivity',
                icon: diff > 0 ? 'ðŸ“ˆ' : 'ðŸ“‰',
                title: diff > 0 ? 'Produtividade em alta!' : 'Produtividade em queda',
                message: `Sua taxa de conclusÃ£o ${diff > 0 ? 'subiu' : 'caiu'} ${Math.abs(diff).toFixed(0)}% nos Ãºltimos 14 dias (${recentRate.toFixed(0)}% vs ${prevRate.toFixed(0)}%).`,
                severity: diff > 0 ? 'positive' : 'warning',
                metric: { current: recentRate, previous: prevRate, change: diff }
            });
        }

        if (recentRate >= 80) {
            insights.push({
                type: 'productivity',
                icon: 'ðŸ†',
                title: 'Excelente produtividade!',
                message: `VocÃª completou ${p.recentDone} de ${p.recentTotal} tarefas (${recentRate.toFixed(0)}%). Continue assim!`,
                severity: 'positive'
            });
        }

        // Best area
        if (p.byArea.length > 0) {
            const bestArea = p.byArea.reduce((best, a) => {
                const rate = a.count > 0 ? a.done / a.count : 0;
                const bestRate = best.count > 0 ? best.done / best.count : 0;
                return rate > bestRate ? a : best;
            });
            if (bestArea.done > 0) {
                const areaRate = (bestArea.done / bestArea.count * 100).toFixed(0);
                insights.push({
                    type: 'productivity',
                    icon: 'ðŸŽ¯',
                    title: `Destaque: ${bestArea.life_area}`,
                    message: `Sua melhor Ã¡rea Ã© "${bestArea.life_area}" com ${areaRate}% de conclusÃ£o (${bestArea.done}/${bestArea.count}).`,
                    severity: 'info'
                });
            }
        }
    }

    // Financial insights
    const expDiff = f.recentExpense - f.prevExpense;
    const expPctChange = f.prevExpense > 0 ? (expDiff / f.prevExpense * 100) : 0;

    if (Math.abs(expPctChange) > 10 && f.prevExpense > 0) {
        insights.push({
            type: 'financial',
            icon: expDiff > 0 ? 'ðŸ’¸' : 'ðŸ’°',
            title: expDiff > 0 ? 'Gastos aumentaram' : 'Gastos reduziram!',
            message: `Seus gastos ${expDiff > 0 ? 'aumentaram' : 'reduziram'} ${Math.abs(expPctChange).toFixed(0)}% comparado ao perÃ­odo anterior (R$ ${f.recentExpense.toFixed(2)} vs R$ ${f.prevExpense.toFixed(2)}).`,
            severity: expDiff > 0 ? 'warning' : 'positive',
            metric: { current: f.recentExpense, previous: f.prevExpense, change: expPctChange }
        });
    }

    if (f.topCategories.length > 0) {
        const top = f.topCategories[0];
        insights.push({
            type: 'financial',
            icon: 'ðŸ·ï¸',
            title: `Maior gasto: ${top.category || 'Outros'}`,
            message: `A categoria "${top.category || 'Outros'}" lidera seus gastos com R$ ${parseFloat(top.total).toFixed(2)} nos Ãºltimos 14 dias.`,
            severity: 'info'
        });
    }

    const balance = f.recentIncome - f.recentExpense;
    if (f.recentIncome > 0) {
        const savingsRate = (balance / f.recentIncome * 100);
        insights.push({
            type: 'financial',
            icon: savingsRate >= 20 ? 'ðŸŸ¢' : savingsRate >= 0 ? 'ðŸŸ¡' : 'ðŸ”´',
            title: savingsRate >= 20 ? 'Bom equilÃ­brio financeiro' : savingsRate >= 0 ? 'AtenÃ§Ã£o ao equilÃ­brio' : 'DÃ©ficit financeiro',
            message: `Taxa de economia: ${savingsRate.toFixed(0)}%. ${savingsRate >= 20 ? 'VocÃª estÃ¡ poupando bem!' : savingsRate >= 0 ? 'Tente poupar mais de 20%.' : 'Seus gastos superam sua renda.'}`,
            severity: savingsRate >= 20 ? 'positive' : savingsRate >= 0 ? 'warning' : 'danger'
        });
    }

    // Emotional insights
    if (e.recentMetrics.count > 0) {
        const energyDiff = e.recentMetrics.energy - (e.prevMetrics.energy || 0);
        const stressDiff = e.recentMetrics.stress - (e.prevMetrics.stress || 0);

        if (e.prevMetrics.count > 0 && Math.abs(energyDiff) > 0.5) {
            insights.push({
                type: 'emotional',
                icon: energyDiff > 0 ? 'âš¡' : 'ðŸ”‹',
                title: energyDiff > 0 ? 'Energia em alta' : 'Energia em queda',
                message: `Seu nÃ­vel de energia ${energyDiff > 0 ? 'subiu' : 'caiu'} de ${e.prevMetrics.energy.toFixed(1)} para ${e.recentMetrics.energy.toFixed(1)}.`,
                severity: energyDiff > 0 ? 'positive' : 'warning'
            });
        }

        if (e.prevMetrics.count > 0 && Math.abs(stressDiff) > 0.5) {
            insights.push({
                type: 'emotional',
                icon: stressDiff > 0 ? 'ðŸ”¥' : 'ðŸ˜Œ',
                title: stressDiff > 0 ? 'Estresse aumentando' : 'Estresse diminuindo',
                message: `Seu nÃ­vel de estresse ${stressDiff > 0 ? 'subiu' : 'caiu'} de ${e.prevMetrics.stress.toFixed(1)} para ${e.recentMetrics.stress.toFixed(1)}.`,
                severity: stressDiff > 0 ? 'warning' : 'positive'
            });
        }

        // Mood correlation with productivity
        if (e.recentMood.length > 0 && p.recentTotal > 0) {
            const happyCount = e.recentMood.find(m => m.mood === 'happy')?.count || 0;
            const totalMood = e.recentMood.reduce((s, m) => s + parseInt(m.count), 0);
            const happyPct = totalMood > 0 ? (happyCount / totalMood * 100) : 0;
            const prodRate = p.recentTotal > 0 ? (p.recentDone / p.recentTotal * 100) : 0;

            if (happyPct > 50 && prodRate > 60) {
                insights.push({
                    type: 'correlation',
                    icon: 'ðŸ”—',
                    title: 'Humor e produtividade alinhados',
                    message: `Quando vocÃª estÃ¡ feliz (${happyPct.toFixed(0)}% dos dias), sua produtividade sobe (${prodRate.toFixed(0)}%). Continue fazendo o que te faz bem!`,
                    severity: 'positive'
                });
            } else if (happyPct < 30 && prodRate < 50) {
                insights.push({
                    type: 'correlation',
                    icon: 'ðŸ”—',
                    title: 'Humor impactando produtividade',
                    message: `Seu humor baixo pode estar afetando sua produtividade. Priorize atividades que levantam seu Ã¢nimo.`,
                    severity: 'warning'
                });
            }
        }

        // Stress vs spending correlation
        if (e.recentMetrics.stress > 3 && f.recentExpense > f.prevExpense && f.prevExpense > 0) {
            insights.push({
                type: 'correlation',
                icon: 'ðŸ§ ',
                title: 'Estresse + gastos acima do normal',
                message: `Seu estresse (${e.recentMetrics.stress.toFixed(1)}/5) coincide com gastos maiores. Compras por estresse? Tente tÃ©cnicas de relaxamento.`,
                severity: 'warning'
            });
        }
    }

    // Gratitude insight
    if (data.gratitude.count > 10) {
        insights.push({
            type: 'gratitude',
            icon: 'ðŸ™',
            title: 'PrÃ¡tica de gratidÃ£o consistente',
            message: `VocÃª registrou ${data.gratitude.count} itens de gratidÃ£o nos Ãºltimos 14 dias. Isso fortalece sua resiliÃªncia emocional!`,
            severity: 'positive'
        });
    } else if (data.gratitude.count === 0) {
        insights.push({
            type: 'gratitude',
            icon: 'ðŸ’«',
            title: 'Comece a praticar gratidÃ£o',
            message: `Nenhum registro de gratidÃ£o nos Ãºltimos 14 dias. Dedicar 2 minutos por dia pode melhorar seu humor.`,
            severity: 'info'
        });
    }

    return insights;
}

/**
 * Auto-save weekly snapshots for all active users
 */
async function runWeeklyAnalysis() {
    try {
        console.log('[Analytics Worker] Starting weekly analysis...');
        
        // Get all users with recent activity
        const activeUsers = await all(
            `SELECT DISTINCT u.id FROM users u WHERE EXISTS (
                SELECT 1 FROM tasks WHERE user_id = u.id AND created_at >= NOW() - INTERVAL '14 days'
            ) OR EXISTS (
                SELECT 1 FROM thoughts WHERE user_id = u.id AND date >= NOW() - INTERVAL '14 days'
            ) OR EXISTS (
                SELECT 1 FROM finances WHERE user_id = u.id AND date >= NOW() - INTERVAL '14 days'
            )`
        );

        console.log(`[Analytics Worker] Found ${activeUsers.length} active users`);

        for (const user of activeUsers) {
            try {
                const analytics = await generateUserAnalytics(user.id);
                const insights = generateInsights(analytics);

                // Save snapshot
                await run(
                    `INSERT INTO analytics_snapshots (user_id, type, data, period_start, period_end) 
                     VALUES (?, ?, ?, ?, ?)`,
                    [
                        user.id,
                        'weekly_auto',
                        JSON.stringify({ analytics, insights }),
                        analytics.period.start,
                        analytics.period.end
                    ]
                );

                console.log(`[Analytics Worker] Snapshot saved for user ${user.id} (${insights.length} insights)`);
            } catch (err) {
                console.error(`[Analytics Worker] Error for user ${user.id}:`, err.message);
            }
        }

        console.log('[Analytics Worker] Weekly analysis complete');
    } catch (err) {
        console.error('[Analytics Worker] Fatal error:', err);
    }
}

/**
 * Check if it's time to run the weekly analysis
 */
function checkAndRun() {
    const now = new Date();
    const today = now.toISOString().split('T')[0];

    // Only run on the configured day/hour, and only once per day
    if (now.getDay() === ANALYSIS_DAY && now.getHours() === ANALYSIS_HOUR && lastRunDate !== today) {
        lastRunDate = today;
        runWeeklyAnalysis();
    }
}

/**
 * Start the analytics worker timer
 */
function startWorker() {
    console.log('[Analytics Worker] Started â€” will run every Sunday at 3:00 AM');
    
    // Check immediately on start
    checkAndRun();
    
    // Then check every hour
    setInterval(checkAndRun, ANALYSIS_INTERVAL);
}

module.exports = { startWorker, generateUserAnalytics, generateInsights, runWeeklyAnalysis };

