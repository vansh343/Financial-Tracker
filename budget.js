const Budget = (() => {
  function getBudget(state, categoryId) {
    return state.budgets.find(b => b.categoryId === categoryId);
  }

  function setBudget(state, categoryId, amount) {
    const val = Math.max(0, Number(amount) || 0);
    const existing = getBudget(state, categoryId);
    if (existing) existing.amount = val;
    else state.budgets.push({ categoryId, amount: val });
  }

  function ensureBudgets(state) {
    state.categories.forEach(c => { if (!getBudget(state, c.id)) state.budgets.push({ categoryId: c.id, amount: 0 }); });
    state.budgets = state.budgets.filter(b => state.categories.some(c => c.id === b.categoryId));
  }

  function monthExpenses(state, month) {
    return state.expenses.filter(e => e.date && e.date.startsWith(month));
  }

  function spentByCategory(state, month) {
    const map = {};
    state.categories.forEach(c => map[c.id] = 0);
    monthExpenses(state, month).forEach(e => { map[e.categoryId] = (map[e.categoryId] || 0) + Number(e.amount || 0); });
    return map;
  }

  function categoryRows(state, month) {
    const spent = spentByCategory(state, month);
    return state.categories.map(c => {
      const allocated = Number(getBudget(state, c.id)?.amount || 0);
      const used = Number(spent[c.id] || 0);
      const remaining = allocated - used;
      const pct = allocated > 0 ? (used / allocated) * 100 : (used > 0 ? 100 : 0);
      let status = 'On Track';
      if (allocated === 0 && used > 0) status = 'No Budget';
      else if (pct >= 100) status = 'Exceeded';
      else if (pct >= 90) status = 'Critical';
      else if (pct >= 75) status = 'Warning';
      return { ...c, allocated, used, remaining, pct, status };
    });
  }

  function totals(state, month) {
    const rows = categoryRows(state, month);
    const allocated = rows.reduce((s, r) => s + r.allocated, 0);
    const used = rows.reduce((s, r) => s + r.used, 0);
    const income = Number(state.settings.monthlyIncome || 0);
    const balance = income - used;
    const savings = Math.max(0, balance);
    const savingsPct = income > 0 ? (savings / income) * 100 : 0;
    return { allocated, used, income, balance, savings, savingsPct, rows };
  }

  function alerts(state, month) {
    return categoryRows(state, month)
      .filter(r => r.allocated > 0 && r.pct >= 75)
      .sort((a, b) => b.pct - a.pct)
      .map(r => {
        const level = r.pct >= 100 ? 'danger' : r.pct >= 90 ? 'danger' : 'warn';
        const msg = r.pct >= 100
          ? `${r.name} exceeded budget by ${formatINR(r.used - r.allocated)} (${r.pct.toFixed(0)}%).`
          : `${r.name} has reached ${r.pct.toFixed(0)}% of its budget. ${formatINR(Math.max(0, r.remaining))} remaining.`;
        return { level, categoryId: r.id, message: msg, pct: r.pct };
      });
  }

  function formatINR(n) {
    return Number(n || 0).toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 });
  }

  return { getBudget, setBudget, ensureBudgets, monthExpenses, spentByCategory, categoryRows, totals, alerts, formatINR };
})();
