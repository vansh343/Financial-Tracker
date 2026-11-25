const Charts = (() => {
  const instances = {};
  const colors = ['#34d399','#60a5fa','#f59e0b','#f87171','#a78bfa','#22d3ee','#fb7185','#facc15','#4ade80','#818cf8','#fb923c','#2dd4bf','#e879f9','#94a3b8','#10b981'];

  function destroy(id) { if (instances[id]) { instances[id].destroy(); delete instances[id]; } }

  function baseOptions() {
    const dark = document.documentElement.getAttribute('data-theme') !== 'light';
    const tick = dark ? '#94a3b8' : '#475569';
    const grid = dark ? 'rgba(148,163,184,0.12)' : 'rgba(71,85,105,0.12)';
    return {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { color: tick, boxWidth: 12 } } },
      scales: { x: { ticks: { color: tick }, grid: { color: grid } }, y: { ticks: { color: tick }, grid: { color: grid } } }
    };
  }

  function lastNMonths(month, n = 6) {
    const [y, m] = month.split('-').map(Number);
    const out = [];
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date(y, m - 1 - i, 1);
      out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    return out;
  }

  function monthLabel(ym) {
    const [y,m] = ym.split('-').map(Number);
    return new Date(y, m-1, 1).toLocaleString('en-IN', { month: 'short' });
  }

  function renderAll(state, month) {
    renderIncomeExpense(state, month);
    renderCategoryPie(state, month);
    renderBudgetUtil(state, month);
    renderTrend(state, month);
    renderBudgetCompare(state, month);
  }

  function renderIncomeExpense(state, month) {
    const id = 'incomeExpenseChart';
    destroy(id);
    const months = lastNMonths(month, 6);
    const income = Number(state.settings.monthlyIncome || 0);
    const expenses = months.map(m => Budget.monthExpenses(state, m).reduce((s,e)=>s+Number(e.amount),0));
    instances[id] = new Chart(document.getElementById(id), {
      type: 'bar',
      data: { labels: months.map(monthLabel), datasets: [
        { label: 'Income', data: months.map(()=>income), backgroundColor: 'rgba(52,211,153,0.7)', borderRadius: 6 },
        { label: 'Expenses', data: expenses, backgroundColor: 'rgba(96,165,250,0.7)', borderRadius: 6 }
      ]},
      options: baseOptions()
    });
  }

  function renderCategoryPie(state, month) {
    const id = 'categoryPieChart';
    destroy(id);
    const rows = Budget.categoryRows(state, month).filter(r => r.used > 0);
    const ctx = document.getElementById(id);
    if (!rows.length) {
      instances[id] = new Chart(ctx, { type:'doughnut', data:{ labels:['No expenses'], datasets:[{data:[1], backgroundColor:['rgba(148,163,184,0.3)']}] }, options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{color:baseOptions().plugins.legend.labels.color}}}} });
      return;
    }
    instances[id] = new Chart(ctx, {
      type: 'doughnut',
      data: { labels: rows.map(r=>r.name), datasets: [{ data: rows.map(r=>r.used), backgroundColor: rows.map((_,i)=>colors[i%colors.length]), borderWidth: 0 }] },
      options: { responsive:true, maintainAspectRatio:false, plugins:{ legend:{ position:'bottom', labels:{ color: baseOptions().plugins.legend.labels.color, boxWidth:10 } } } }
    });
  }

  function renderBudgetUtil(state, month) {
    const id = 'budgetUtilChart';
    destroy(id);
    const rows = Budget.categoryRows(state, month).filter(r => r.allocated > 0 || r.used > 0).slice(0, 8);
    const opt = baseOptions();
    opt.indexAxis = 'y';
    opt.plugins.legend.display = true;
    instances[id] = new Chart(document.getElementById(id), {
      type: 'bar',
      data: { labels: rows.map(r=>r.name.length>18?r.name.slice(0,18)+'…':r.name), datasets: [
        { label:'Allocated', data: rows.map(r=>r.allocated), backgroundColor:'rgba(96,165,250,0.5)', borderRadius:4 },
        { label:'Spent', data: rows.map(r=>r.used), backgroundColor: rows.map(r=>r.pct>=100?'rgba(248,113,113,0.8)':r.pct>=75?'rgba(251,191,36,0.8)':'rgba(52,211,153,0.8)'), borderRadius:4 }
      ]},
      options: opt
    });
  }

  function renderTrend(state, month) {
    const id = 'trendChart';
    destroy(id);
    const months = lastNMonths(month, 6);
    const values = months.map(m => Budget.monthExpenses(state, m).reduce((s,e)=>s+Number(e.amount),0));
    const opt = baseOptions();
    instances[id] = new Chart(document.getElementById(id), {
      type: 'line',
      data: { labels: months.map(monthLabel), datasets: [{ label:'Monthly Spending', data: values, borderColor:'#34d399', backgroundColor:'rgba(52,211,153,0.15)', fill:true, tension:0.35, pointRadius:4 }] },
      options: opt
    });
  }

  function renderBudgetCompare(state, month) {
    const id = 'budgetCompareChart';
    destroy(id);
    const rows = Budget.categoryRows(state, month).filter(r=>r.allocated>0||r.used>0);
    const opt = baseOptions();
    opt.scales.x.ticks.maxRotation = 45;
    instances[id] = new Chart(document.getElementById(id), {
      type: 'bar',
      data: { labels: rows.map(r=>r.name.length>14?r.name.slice(0,14)+'…':r.name), datasets: [
        { label:'Allocated', data: rows.map(r=>r.allocated), backgroundColor:'rgba(96,165,250,0.6)', borderRadius:5 },
        { label:'Actual', data: rows.map(r=>r.used), backgroundColor:'rgba(52,211,153,0.7)', borderRadius:5 }
      ]},
      options: opt
    });
  }

  function rerender() { /* called by app after theme change */ }
  return { renderAll, rerender };
})();
