const Expenses = (() => {
  function sanitize(str) { return String(str || '').replace(/[<>]/g, '').trim(); }

  function validate(payload, state) {
    const errors = [];
    const name = sanitize(payload.name);
    const amount = Number(payload.amount);
    const category = payload.categoryId;
    const date = payload.date;
    const payment = sanitize(payload.payment);
    if (!name) errors.push('Expense name is required.');
    if (!Number.isFinite(amount) || amount <= 0) errors.push('Amount must be greater than 0.');
    if (!state.categories.some(c => c.id === category)) errors.push('Select a valid category.');
    if (!date || Number.isNaN(Date.parse(date))) errors.push('Valid date is required.');
    if (!payment) errors.push('Payment method is required.');
    return { valid: errors.length === 0, errors, data: { name, amount: Math.round(amount * 100) / 100, categoryId: category, date, payment, description: sanitize(payload.description).slice(0, 200) } };
  }

  function add(state, payload) {
    const v = validate(payload, state);
    if (!v.valid) return v;
    state.expenses.push({ id: Storage.uid('exp'), ...v.data });
    return v;
  }

  function update(state, id, payload) {
    const v = validate(payload, state);
    if (!v.valid) return v;
    const idx = state.expenses.findIndex(e => e.id === id);
    if (idx < 0) return { valid: false, errors: ['Expense not found.'] };
    state.expenses[idx] = { ...state.expenses[idx], ...v.data };
    return v;
  }

  function remove(state, id) {
    const before = state.expenses.length;
    state.expenses = state.expenses.filter(e => e.id !== id);
    return state.expenses.length !== before;
  }

  function getFiltered(state, filters) {
    const q = sanitize(filters.search).toLowerCase();
    const cat = filters.category || 'all';
    const from = filters.from || '';
    const to = filters.to || '';
    return state.expenses
      .filter(e => {
        if (cat !== 'all' && e.categoryId !== cat) return false;
        if (from && e.date < from) return false;
        if (to && e.date > to) return false;
        if (q) {
          const catName = state.categories.find(c => c.id === e.categoryId)?.name.toLowerCase() || '';
          const hay = `${e.name} ${e.description} ${e.payment} ${catName}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  }

  return { add, update, remove, getFiltered, validate };
})();
