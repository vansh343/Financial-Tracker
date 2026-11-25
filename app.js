const App = (() => {
  let state = Storage.load();
  let currentSection = 'dashboard';
  let expenseFilters = { search: '', category: 'all', from: '', to: '' };

  const $ = (id) => document.getElementById(id);
  const qs = (s, el=document) => el.querySelector(s);
  const qsa = (s, el=document) => Array.from(el.querySelectorAll(s));

  function init() {
    bindNav();
    bindGlobal();
    bindExpenses();
    bindCategories();
    bindBudget();
    bindAdvisor();
    bindSavings();
    bindReports();
    bindSettings();
    applyTheme(state.settings.theme || 'dark');
    $('globalMonth').value = state.selectedMonth;
    syncAll();
  }

  function persist() { Storage.save(state); }

  function toast(msg, type='info') {
    const t = $('toast');
    t.textContent = msg;
    t.className = `toast show ${type}`;
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => t.className = 'toast', 2600);
  }

  function fmt(n) { return Budget.formatINR(n); }
  function esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

  function bindNav() {
    qsa('.nav-link').forEach(btn => btn.addEventListener('click', () => navigate(btn.dataset.section)));
    $('menuToggle').addEventListener('click', () => $('sidebar').classList.toggle('open'));
    document.addEventListener('click', (e) => {
      const sb = $('sidebar');
      if (window.innerWidth <= 980 && sb.classList.contains('open') && !sb.contains(e.target) && e.target !== $('menuToggle')) sb.classList.remove('open');
    });
  }

  function navigate(section) {
    currentSection = section;
    qsa('.nav-link').forEach(b => b.classList.toggle('active', b.dataset.section === section));
    qsa('.page-section').forEach(s => s.classList.toggle('active', s.id === `section-${section}`));
    const titles = { dashboard:['Dashboard','Your household financial overview'], expenses:['My Expenses','Track and manage transactions'], budget:['Budget Planner','Allocate and monitor category budgets'], advisor:['AI Financial Advisor','Smart insights and recommendations'], savings:['Savings Goals','Plan savings and simulate reductions'], reports:['Reports & Analytics','Summaries and CSV export'], settings:['Settings','Preferences and data management'] };
    $('pageTitle').textContent = titles[section][0];
    $('pageSubtitle').textContent = titles[section][1];
    $('sidebar').classList.remove('open');
    if (section === 'reports') renderReports();
    if (section === 'advisor') renderAdvisor();
  }

  function bindGlobal() {
    $('globalMonth').addEventListener('change', e => { state.selectedMonth = e.target.value || state.selectedMonth; persist(); syncAll(); });
    $('themeToggle').addEventListener('click', () => { state.settings.theme = state.settings.theme === 'dark' ? 'light' : 'dark'; applyTheme(state.settings.theme); persist(); syncAll(); });
    $('quickAddExpenseBtn').addEventListener('click', () => { navigate('expenses'); $('expenseName').focus(); });
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const label = theme === 'dark' ? 'Light Mode' : 'Dark Mode';
    $('themeToggle').textContent = label;
    if ($('settingTheme')) $('settingTheme').value = theme;
  }

  function syncAll() {
    Budget.ensureBudgets(state);
    $('globalMonth').value = state.selectedMonth;
    updateTopbar();
    renderCategorySelects();
    renderDashboard();
    renderExpenses();
    renderBudget();
    renderSavings();
    renderWhatIf();
    if (currentSection === 'advisor') renderAdvisor();
    if (currentSection === 'reports') renderReports();
    renderSettings();
    Charts.renderAll(state, state.selectedMonth);
  }

  function updateTopbar() {
    $('topIncome').textContent = fmt(state.settings.monthlyIncome);
  }

  // ---------- Categories ----------
  function bindCategories() {
    $('categoryForm').addEventListener('submit', e => {
      e.preventDefault();
      const id = $('categoryId').value;
      const name = $('categoryName').value.trim();
      const icon = $('categoryIcon').value.trim() || '📁';
      if (!name) return toast('Category name is required.', 'error');
      if (state.categories.some(c => c.name.toLowerCase() === name.toLowerCase() && c.id !== id)) return toast('Category name already exists.', 'error');
      if (id) {
        const c = state.categories.find(x => x.id === id);
        if (c) { c.name = name; c.icon = icon; toast('Category updated.'); }
      } else {
        const newCat = { id: Storage.uid('cat'), name, icon, default: false };
        state.categories.push(newCat);
        state.budgets.push({ categoryId: newCat.id, amount: 0 });
        toast('Category added.');
      }
      resetCategoryForm();
      persist(); syncAll();
    });
    $('categoryCancelBtn').addEventListener('click', resetCategoryForm);
  }

  function resetCategoryForm() {
    $('categoryId').value = ''; $('categoryName').value = ''; $('categoryIcon').value = '';
    $('categorySubmitBtn').textContent = 'Add Category'; $('categoryCancelBtn').hidden = true;
  }

  function renderCategoryList() {
    const spent = Budget.spentByCategory(state, state.selectedMonth);
    $('categoryList').innerHTML = state.categories.map(c => `
      <div class="category-item">
        <div class="category-item-main"><span class="cat-icon">${esc(c.icon || '📁')}</span>
          <div><strong>${esc(c.name)}</strong><div class="muted small">${c.default ? 'Default' : 'Custom'} · ${fmt(spent[c.id]||0)} this month</div></div>
        </div>
        <div class="row-actions">
          <button class="btn btn-ghost btn-sm" data-edit-cat="${c.id}">Edit</button>
          ${!c.default ? `<button class="btn btn-danger btn-sm" data-del-cat="${c.id}">Delete</button>` : ''}
        </div>
      </div>`).join('');
    qsa('[data-edit-cat]').forEach(b => b.addEventListener('click', () => {
      const c = state.categories.find(x => x.id === b.dataset.editCat); if (!c) return;
      $('categoryId').value = c.id; $('categoryName').value = c.name; $('categoryIcon').value = c.icon || '';
      $('categorySubmitBtn').textContent = 'Update Category'; $('categoryCancelBtn').hidden = false;
      $('categoryName').focus();
    }));
    qsa('[data-del-cat]').forEach(b => b.addEventListener('click', () => deleteCategory(b.dataset.delCat)));
  }

  function deleteCategory(id) {
    const cat = state.categories.find(c => c.id === id);
    if (!cat || cat.default) return;
    const hasExpenses = state.expenses.some(e => e.categoryId === id);
    if (hasExpenses) return toast('Cannot delete a category with existing expenses. Reassign or delete those expenses first.', 'error');
    if (!confirm(`Delete category "${cat.name}"?`)) return;
    state.categories = state.categories.filter(c => c.id !== id);
    state.budgets = state.budgets.filter(b => b.categoryId !== id);
    if (expenseFilters.category === id) expenseFilters.category = 'all';
    persist(); syncAll(); toast('Category deleted.');
  }

  function renderCategorySelects() {
    const opts = state.categories.map(c => `<option value="${c.id}">${esc(c.icon)} ${esc(c.name)}</option>`).join('');
    $('expenseCategory').innerHTML = `<option value="">Select category</option>${opts}`;
    const filterVal = expenseFilters.category;
    $('expenseFilterCategory').innerHTML = `<option value="all">All Categories</option>${opts}`;
    $('expenseFilterCategory').value = state.categories.some(c=>c.id===filterVal) ? filterVal : 'all';
    expenseFilters.category = $('expenseFilterCategory').value;
    $('whatIfCategory').innerHTML = opts;
    renderCategoryList();
  }
  // ---------- Expenses ----------
  function bindExpenses() {
    $('expenseForm').addEventListener('submit', e => {
      e.preventDefault();
      const payload = {
        name: $('expenseName').value, amount: $('expenseAmount').value, categoryId: $('expenseCategory').value,
        date: $('expenseDate').value, payment: $('expensePayment').value, description: $('expenseDescription').value
      };
      const id = $('expenseId').value;
      const res = id ? Expenses.update(state, id, payload) : Expenses.add(state, payload);
      if (!res.valid) return toast(res.errors[0], 'error');
      persist(); resetExpenseForm(); syncAll();
      toast(id ? 'Expense updated.' : 'Expense added.');
    });
    $('expenseCancelBtn').addEventListener('click', resetExpenseForm);
    $('expenseSearch').addEventListener('input', e => { expenseFilters.search = e.target.value; renderExpenses(); });
    $('expenseFilterCategory').addEventListener('change', e => { expenseFilters.category = e.target.value; renderExpenses(); });
    $('expenseFilterFrom').addEventListener('change', e => { expenseFilters.from = e.target.value; renderExpenses(); });
    $('expenseFilterTo').addEventListener('change', e => { expenseFilters.to = e.target.value; renderExpenses(); });
    $('clearExpenseFilters').addEventListener('click', () => {
      expenseFilters = { search:'', category:'all', from:'', to:'' };
      $('expenseSearch').value=''; $('expenseFilterCategory').value='all'; $('expenseFilterFrom').value=''; $('expenseFilterTo').value='';
      renderExpenses();
    });
  }

  function resetExpenseForm() {
    $('expenseForm').reset();
    $('expenseId').value = '';
    $('expenseDate').value = new Date().toISOString().slice(0,10);
    $('expenseFormTitle').textContent = 'Add Expense';
    $('expenseSubmitBtn').textContent = 'Add Expense';
    $('expenseCancelBtn').hidden = true;
  }

  function renderExpenses() {
    if (!$('expenseDate').value && !$('expenseId').value) $('expenseDate').value = new Date().toISOString().slice(0,10);
    const rows = Expenses.getFiltered(state, expenseFilters);
    $('expenseCount').textContent = `${rows.length} transaction${rows.length !== 1 ? 's' : ''}`;
    const tbody = $('expenseTableBody');
    if (!rows.length) { tbody.innerHTML = `<tr><td colspan="6" class="empty-cell">No expenses found.</td></tr>`; return; }
    tbody.innerHTML = rows.map(e => {
      const cat = state.categories.find(c => c.id === e.categoryId);
      return `<tr>
        <td>${esc(e.date)}</td>
        <td><div class="cell-main">${esc(e.name)}</div>${e.description ? `<div class="muted small">${esc(e.description)}</div>` : ''}</td>
        <td><span class="cat-pill">${esc(cat?.icon||'📁')} ${esc(cat?.name||'Unknown')}</span></td>
        <td>${esc(e.payment)}</td>
        <td class="amount-cell">${fmt(e.amount)}</td>
        <td><div class="row-actions">
          <button class="btn btn-ghost btn-sm" data-edit-exp="${e.id}">Edit</button>
          <button class="btn btn-danger btn-sm" data-del-exp="${e.id}">Delete</button>
        </div></td>
      </tr>`;
    }).join('');
    qsa('[data-edit-exp]').forEach(b => b.addEventListener('click', () => editExpense(b.dataset.editExp)));
    qsa('[data-del-exp]').forEach(b => b.addEventListener('click', () => deleteExpense(b.dataset.delExp)));
  }

  function editExpense(id) {
    const e = state.expenses.find(x => x.id === id); if (!e) return;
    $('expenseId').value = e.id; $('expenseName').value = e.name; $('expenseAmount').value = e.amount;
    $('expenseCategory').value = e.categoryId; $('expenseDate').value = e.date; $('expensePayment').value = e.payment;
    $('expenseDescription').value = e.description || '';
    $('expenseFormTitle').textContent = 'Edit Expense'; $('expenseSubmitBtn').textContent = 'Update Expense'; $('expenseCancelBtn').hidden = false;
    navigate('expenses'); $('expenseName').focus();
  }

  function deleteExpense(id) {
    if (!confirm('Delete this expense?')) return;
    if (Expenses.remove(state, id)) { persist(); syncAll(); toast('Expense deleted.'); }
  }

  // ---------- Dashboard ----------
  function renderDashboard() {
    const t = Budget.totals(state, state.selectedMonth);
    $('statIncome').textContent = fmt(t.income);
    $('statAllocated').textContent = fmt(t.allocated);
    $('statExpenses').textContent = fmt(t.used);
    $('statBalance').textContent = fmt(t.balance);
    $('statBalance').style.color = t.balance < 0 ? 'var(--danger)' : '';
    $('statSavings').textContent = fmt(t.savings);
    $('statSavingsPct').textContent = `${t.savingsPct.toFixed(1)}%`;
    renderAlerts();
  }

  function renderAlerts() {
    const alerts = Budget.alerts(state, state.selectedMonth);
    const el = $('dashboardAlerts');
    if (!alerts.length) { el.innerHTML = '<div class="empty-state">No budget alerts for this month. Spending is within thresholds.</div>'; return; }
    el.innerHTML = alerts.map(a => `
      <div class="alert-item ${a.level}">
        <div class="alert-dot"></div>
        <div class="alert-body"><strong>${a.pct >= 100 ? 'Budget Exceeded' : a.pct >= 90 ? 'Critical Alert' : 'Warning'}</strong><p>${esc(a.message)}</p></div>
        <span class="alert-pct">${a.pct.toFixed(0)}%</span>
      </div>`).join('');
  }
  // ---------- Budget ----------
  function bindBudget() {
    $('budgetTableBody').addEventListener('change', e => {
      if (!e.target.classList.contains('budget-input')) return;
      const catId = e.target.dataset.catId;
      const val = Math.max(0, Number(e.target.value) || 0);
      Budget.setBudget(state, catId, val);
      persist(); syncAll(); toast('Budget updated.');
    });
  }

  function renderBudget() {
    const t = Budget.totals(state, state.selectedMonth);
    $('budgetSummary').innerHTML = `
      <div class="mini-stat"><span>Income</span><strong>${fmt(t.income)}</strong></div>
      <div class="mini-stat"><span>Allocated</span><strong>${fmt(t.allocated)}</strong></div>
      <div class="mini-stat"><span>Spent</span><strong>${fmt(t.used)}</strong></div>
      <div class="mini-stat"><span>Unallocated</span><strong class="${t.income - t.allocated < 0 ? 'text-danger':''}">${fmt(t.income - t.allocated)}</strong></div>
    `;
    const rows = Budget.categoryRows(state, state.selectedMonth);
    $('budgetTableBody').innerHTML = rows.map(r => {
      const pct = Math.min(r.pct, 999);
      const barClass = r.pct >= 100 ? 'danger' : r.pct >= 90 ? 'danger' : r.pct >= 75 ? 'warn' : 'ok';
      const statusClass = r.status === 'Exceeded' ? 'badge-danger' : r.status === 'Critical' ? 'badge-danger' : r.status === 'Warning' ? 'badge-warn' : r.status === 'No Budget' ? 'badge-muted' : 'badge-ok';
      return `<tr>
        <td><span class="cat-pill">${esc(r.icon)} ${esc(r.name)}</span></td>
        <td><input class="input input-sm budget-input" type="number" min="0" step="100" data-cat-id="${r.id}" value="${r.allocated}"></td>
        <td>${fmt(r.used)}</td>
        <td class="${r.remaining < 0 ? 'text-danger':''}">${fmt(r.remaining)}</td>
        <td>
          <div class="progress-wrap"><div class="progress-bar"><div class="progress-fill ${barClass}" style="width:${Math.min(pct,100)}%"></div></div><span class="small muted">${pct.toFixed(0)}%</span></div>
        </td>
        <td><span class="badge ${statusClass}">${r.status}</span></td>
      </tr>`;
    }).join('');
  }

  // ---------- Advisor ----------
  function bindAdvisor() {
    $('refreshAdvisorBtn').addEventListener('click', () => { renderAdvisor(); toast('Insights refreshed.'); });
  }

  function renderAdvisor() {
    const a = Advisor.analyze(state, state.selectedMonth);
    $('advisorOverspendCount').textContent = a.overspendCount;
    $('advisorPotentialSavings').textContent = fmt(a.potentialSavings);
    $('advisorSmallCount').textContent = a.smallCount;
    $('advisorTrend').textContent = a.trend;
    $('advisorTrend').style.color = a.trend === 'Rising' ? 'var(--danger)' : a.trend === 'Falling' ? 'var(--green)' : '';
    const sevClass = { high:'insight-high', medium:'insight-medium', low:'insight-low' };
    $('advisorInsights').innerHTML = a.insights.map(i => `
      <article class="insight-card ${sevClass[i.severity]||''}">
        <div class="insight-head"><span class="insight-icon">${esc(i.icon)}</span><div><h4>${esc(i.title)}</h4><span class="badge ${i.severity==='high'?'badge-danger':i.severity==='medium'?'badge-warn':'badge-ok'}">${esc(i.severity)}</span></div></div>
        <div class="insight-body">
          <p><strong>Problem:</strong> ${esc(i.problem)}</p>
          <p><strong>Reason:</strong> ${esc(i.reason)}</p>
          <p><strong>Recommendation:</strong> ${esc(i.recommendation)}</p>
          ${i.savings > 0 ? `<p class="insight-savings"><strong>Estimated potential savings:</strong> ${fmt(i.savings)}</p>` : ''}
        </div>
      </article>`).join('');
  }
  // ---------- Savings Goals ----------
  function bindSavings() {
    $('goalForm').addEventListener('submit', e => {
      e.preventDefault();
      const id = $('goalId').value;
      const name = $('goalName').value.trim();
      const target = Number($('goalTarget').value);
      const saved = Number($('goalSaved').value);
      const targetDate = $('goalDate').value;
      if (!name) return toast('Goal name is required.', 'error');
      if (!Number.isFinite(target) || target <= 0) return toast('Target amount must be greater than 0.', 'error');
      if (!Number.isFinite(saved) || saved < 0) return toast('Saved amount cannot be negative.', 'error');
      if (!targetDate) return toast('Target date is required.', 'error');
      const payload = { name, target: Math.round(target*100)/100, saved: Math.round(saved*100)/100, targetDate };
      if (id) {
        const g = state.goals.find(x => x.id === id);
        if (g) Object.assign(g, payload);
        toast('Goal updated.');
      } else {
        state.goals.push({ id: Storage.uid('goal'), ...payload });
        toast('Goal added.');
      }
      resetGoalForm(); persist(); syncAll();
    });
    $('goalCancelBtn').addEventListener('click', resetGoalForm);
    $('whatIfCategory').addEventListener('change', renderWhatIf);
    $('whatIfPercent').addEventListener('change', renderWhatIf);
  }

  function resetGoalForm() {
    $('goalForm').reset(); $('goalId').value = '';
    $('goalFormTitle').textContent = 'Create Savings Goal'; $('goalSubmitBtn').textContent = 'Add Goal'; $('goalCancelBtn').hidden = true;
  }

  function renderSavings() {
    const el = $('goalsList');
    if (!state.goals.length) { el.innerHTML = '<div class="empty-state">No savings goals yet. Create one to start tracking.</div>'; return; }
    el.innerHTML = state.goals.map(g => {
      const pct = g.target > 0 ? Math.min((g.saved / g.target) * 100, 100) : 0;
      const remaining = Math.max(0, g.target - g.saved);
      const daysLeft = Math.ceil((new Date(g.targetDate) - new Date()) / 86400000);
      return `<article class="goal-card">
        <div class="goal-head"><div><h4>${esc(g.name)}</h4><p class="muted small">Target: ${fmt(g.target)} by ${esc(g.targetDate)}</p></div>
          <div class="row-actions"><button class="btn btn-ghost btn-sm" data-edit-goal="${g.id}">Edit</button><button class="btn btn-danger btn-sm" data-del-goal="${g.id}">Delete</button></div></div>
        <div class="progress-bar large"><div class="progress-fill ok" style="width:${pct}%"></div></div>
        <div class="goal-stats">
          <div><span class="muted small">Saved</span><strong>${fmt(g.saved)}</strong></div>
          <div><span class="muted small">Remaining</span><strong>${fmt(remaining)}</strong></div>
          <div><span class="muted small">Progress</span><strong>${pct.toFixed(1)}%</strong></div>
          <div><span class="muted small">Timeline</span><strong class="${daysLeft < 0 ? 'text-danger':''}">${daysLeft < 0 ? Math.abs(daysLeft)+'d overdue' : daysLeft+'d left'}</strong></div>
        </div>
      </article>`;
    }).join('');
    qsa('[data-edit-goal]').forEach(b => b.addEventListener('click', () => {
      const g = state.goals.find(x => x.id === b.dataset.editGoal); if (!g) return;
      $('goalId').value = g.id; $('goalName').value = g.name; $('goalTarget').value = g.target; $('goalSaved').value = g.saved; $('goalDate').value = g.targetDate;
      $('goalFormTitle').textContent = 'Edit Savings Goal'; $('goalSubmitBtn').textContent = 'Update Goal'; $('goalCancelBtn').hidden = false;
    }));
    qsa('[data-del-goal]').forEach(b => b.addEventListener('click', () => {
      if (!confirm('Delete this savings goal?')) return;
      state.goals = state.goals.filter(g => g.id !== b.dataset.delGoal);
      persist(); syncAll(); toast('Goal deleted.');
    }));
  }

  function renderWhatIf() {
    const catId = $('whatIfCategory').value;
    const pct = Number($('whatIfPercent').value) / 100;
    const spentMap = Budget.spentByCategory(state, state.selectedMonth);
    const spent = Number(spentMap[catId] || 0);
    const monthly = spent * pct;
    const cat = state.categories.find(c => c.id === catId);
    $('whatIfResult').innerHTML = `
      <div class="whatif-summary"><span class="muted">Current monthly spend in ${esc(cat?.name||'category')}</span><strong>${fmt(spent)}</strong></div>
      <div class="whatif-grid">
        <div class="mini-stat"><span>Monthly Savings</span><strong class="text-green">${fmt(monthly)}</strong></div>
        <div class="mini-stat"><span>3 Months</span><strong class="text-green">${fmt(monthly*3)}</strong></div>
        <div class="mini-stat"><span>6 Months</span><strong class="text-green">${fmt(monthly*6)}</strong></div>
        <div class="mini-stat"><span>12 Months</span><strong class="text-green">${fmt(monthly*12)}</strong></div>
      </div>`;
  }
  // ---------- Reports ----------
  function bindReports() {
    $('reportType').addEventListener('change', () => { updateReportInputs(); renderReports(); });
    $('reportDate').addEventListener('change', renderReports);
    $('reportMonth').addEventListener('change', renderReports);
    $('reportYear').addEventListener('change', renderReports);
    $('exportCsvBtn').addEventListener('click', exportReportCsv);
    updateReportInputs();
  }

  function updateReportInputs() {
    const type = $('reportType').value;
    $('reportDate').style.display = type === 'daily' || type === 'weekly' ? '' : 'none';
    $('reportMonth').style.display = type === 'monthly' || type === 'category' ? '' : 'none';
    $('reportYear').style.display = type === 'annual' ? '' : 'none';
    if (!$('reportDate').value) $('reportDate').value = new Date().toISOString().slice(0,10);
    if (!$('reportMonth').value) $('reportMonth').value = state.selectedMonth;
    if (!$('reportYear').value) $('reportYear').value = String(new Date().getFullYear());
  }

  function getReportData() {
    const type = $('reportType').value;
    let rows = [], cards = [], headers = [];
    const exps = state.expenses;
    const catName = id => state.categories.find(c=>c.id===id)?.name || 'Unknown';

    if (type === 'daily') {
      const d = $('reportDate').value;
      rows = exps.filter(e => e.date === d).map(e => ({ Date:e.date, Expense:e.name, Category:catName(e.categoryId), Payment:e.payment, Amount:e.amount }));
      const total = rows.reduce((s,r)=>s+r.Amount,0);
      cards = [['Date', d], ['Transactions', rows.length], ['Total Spent', fmt(total)]];
      headers = ['Date','Expense','Category','Payment','Amount'];
    } else if (type === 'weekly') {
      const d = new Date($('reportDate').value);
      const day = d.getDay();
      const start = new Date(d); start.setDate(d.getDate() - day);
      const end = new Date(start); end.setDate(start.getDate() + 6);
      const s = start.toISOString().slice(0,10), en = end.toISOString().slice(0,10);
      rows = exps.filter(e => e.date >= s && e.date <= en).map(e => ({ Date:e.date, Expense:e.name, Category:catName(e.categoryId), Payment:e.payment, Amount:e.amount }));
      const total = rows.reduce((s,r)=>s+r.Amount,0);
      cards = [['Week', `${s} to ${en}`], ['Transactions', rows.length], ['Total Spent', fmt(total)], ['Daily Avg', fmt(rows.length ? total/7 : 0)]];
      headers = ['Date','Expense','Category','Payment','Amount'];
    } else if (type === 'monthly') {
      const m = $('reportMonth').value;
      rows = exps.filter(e => e.date.startsWith(m)).map(e => ({ Date:e.date, Expense:e.name, Category:catName(e.categoryId), Payment:e.payment, Amount:e.amount }));
      const total = rows.reduce((s,r)=>s+r.Amount,0);
      const income = Number(state.settings.monthlyIncome||0);
      cards = [['Month', m], ['Transactions', rows.length], ['Total Spent', fmt(total)], ['Balance', fmt(income-total)]];
      headers = ['Date','Expense','Category','Payment','Amount'];
    } else if (type === 'annual') {
      const y = $('reportYear').value;
      const yearExps = exps.filter(e => e.date.startsWith(y));
      const byMonth = {};
      yearExps.forEach(e => { const m = e.date.slice(0,7); byMonth[m] = (byMonth[m]||0) + Number(e.amount); });
      rows = Object.keys(byMonth).sort().map(m => ({ Month:m, Transactions: yearExps.filter(e=>e.date.startsWith(m)).length, 'Total Spent': byMonth[m], Income: Number(state.settings.monthlyIncome||0), Balance: Number(state.settings.monthlyIncome||0)-byMonth[m] }));
      const total = yearExps.reduce((s,e)=>s+Number(e.amount),0);
      cards = [['Year', y], ['Transactions', yearExps.length], ['Total Spent', fmt(total)], ['Monthly Avg', fmt(rows.length?total/rows.length:0)]];
      headers = ['Month','Transactions','Total Spent','Income','Balance'];
    } else if (type === 'category') {
      const m = $('reportMonth').value;
      const monthExps = exps.filter(e => e.date.startsWith(m));
      rows = Budget.categoryRows(state, m).map(r => ({ Category:r.name, Allocated:r.allocated, Spent:r.used, Remaining:r.remaining, 'Utilization %': r.pct.toFixed(1), Transactions: monthExps.filter(e=>e.categoryId===r.id).length }));
      const total = monthExps.reduce((s,e)=>s+Number(e.amount),0);
      cards = [['Month', m], ['Categories', rows.length], ['Total Spent', fmt(total)], ['Allocated', fmt(rows.reduce((s,r)=>s+r.Allocated,0))]];
      headers = ['Category','Allocated','Spent','Remaining','Utilization %','Transactions'];
    }
    return { type, rows, cards, headers };
  }

  function renderReports() {
    updateReportInputs();
    const { rows, cards, headers } = getReportData();
    $('reportCards').innerHTML = cards.map(([k,v]) => `<div class="mini-stat"><span>${esc(k)}</span><strong>${esc(String(v))}</strong></div>`).join('');
    $('reportTableHead').innerHTML = `<tr>${headers.map(h=>`<th>${esc(h)}</th>`).join('')}</tr>`;
    if (!rows.length) { $('reportTableBody').innerHTML = `<tr><td colspan="${headers.length}" class="empty-cell">No data for selected report.</td></tr>`; return; }
    $('reportTableBody').innerHTML = rows.map(r => `<tr>${headers.map(h => {
      const v = r[h];
      if (['Amount','Allocated','Spent','Remaining','Total Spent','Income','Balance'].includes(h)) return `<td>${fmt(v)}</td>`;
      return `<td>${esc(String(v ?? ''))}</td>`;
    }).join('')}</tr>`).join('');
  }

  function exportReportCsv() {
    const { rows, headers, type } = getReportData();
    if (!rows.length) return toast('No report data to export.', 'error');
    const escCsv = (v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s; };
    const lines = [headers.join(','), ...rows.map(r => headers.map(h => escCsv(r[h])).join(','))];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `smartspend-${type}-report.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    toast('CSV exported.');
  }

  // ---------- Settings ----------
  function bindSettings() {
    $('settingsForm').addEventListener('submit', e => {
      e.preventDefault();
      const income = Number($('settingIncome').value);
      if (!Number.isFinite(income) || income < 0) return toast('Income must be 0 or greater.', 'error');
      state.settings.monthlyIncome = Math.round(income * 100) / 100;
      state.settings.householdName = $('settingHousehold').value.trim() || 'My Household';
      state.settings.theme = $('settingTheme').value;
      applyTheme(state.settings.theme);
      persist(); syncAll(); toast('Settings saved.');
    });
    $('settingTheme').addEventListener('change', e => { state.settings.theme = e.target.value; applyTheme(state.settings.theme); persist(); Charts.renderAll(state, state.selectedMonth); });
    $('loadSampleBtn').addEventListener('click', () => {
      if (!confirm('Load sample data? This will replace your current data.')) return;
      state = Storage.buildSampleState();
      persist(); applyTheme(state.settings.theme); resetExpenseForm(); resetCategoryForm(); resetGoalForm();
      syncAll(); toast('Sample data loaded.');
    });
    $('clearDataBtn').addEventListener('click', () => {
      if (!confirm('Clear all data? This cannot be undone.')) return;
      Storage.clear();
      state = Storage.buildEmptyState();
      persist(); applyTheme(state.settings.theme); resetExpenseForm(); resetCategoryForm(); resetGoalForm();
      syncAll(); toast('All data cleared.');
    });
  }

  function renderSettings() {
    $('settingIncome').value = state.settings.monthlyIncome;
    $('settingHousehold').value = state.settings.householdName || '';
    $('settingTheme').value = state.settings.theme || 'dark';
  }

  return { init };
})();

document.addEventListener('DOMContentLoaded', App.init);
