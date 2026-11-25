const Storage = (() => {
  const KEY = 'smartspend_v1';
  const DEFAULT_CATEGORIES = [
    { id: 'cat-food', name: 'Food & Dining', icon: '🍽️', default: true },
    { id: 'cat-groceries', name: 'Groceries & Daily Essentials', icon: '🛒', default: true },
    { id: 'cat-travel', name: 'Travel & Transportation', icon: '🚗', default: true },
    { id: 'cat-electricity', name: 'Electricity & Utilities', icon: '💡', default: true },
    { id: 'cat-water', name: 'Water & Gas Bills', icon: '💧', default: true },
    { id: 'cat-rent', name: 'House Rent / Mortgage', icon: '🏠', default: true },
    { id: 'cat-health', name: 'Healthcare & Medicines', icon: '💊', default: true },
    { id: 'cat-education', name: 'Education & School Fees', icon: '📚', default: true },
    { id: 'cat-maintenance', name: 'Household Maintenance & Repairs', icon: '🛠️', default: true },
    { id: 'cat-shopping', name: 'Shopping & Clothing', icon: '🛍️', default: true },
    { id: 'cat-entertainment', name: 'Entertainment & Recreation', icon: '🎬', default: true },
    { id: 'cat-personal', name: 'Personal Care & Hygiene', icon: '🧴', default: true },
    { id: 'cat-internet', name: 'Internet & Mobile Recharge', icon: '📱', default: true },
    { id: 'cat-domestic', name: 'Domestic Help & Housekeeping', icon: '🧹', default: true },
    { id: 'cat-misc', name: 'Miscellaneous Expenses', icon: '📦', default: true }
  ];

  const uid = (p = 'id') => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const clone = (obj) => JSON.parse(JSON.stringify(obj));

  function defaultBudgets(categories) {
    const amounts = {
      'cat-food': 6000, 'cat-groceries': 8000, 'cat-travel': 4000, 'cat-electricity': 3500,
      'cat-water': 1800, 'cat-rent': 18000, 'cat-health': 2500, 'cat-education': 5000,
      'cat-maintenance': 3000, 'cat-shopping': 3500, 'cat-entertainment': 2500, 'cat-personal': 1500,
      'cat-internet': 1200, 'cat-domestic': 4000, 'cat-misc': 2000
    };
    return categories.map(c => ({ categoryId: c.id, amount: amounts[c.id] || 0 }));
  }

  function sampleExpenses(month) {
    const [y, m] = month.split('-').map(Number);
    const prev = new Date(y, m - 2, 1);
    const pm = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;
    const mk = (d, ym) => `${ym}-${String(d).padStart(2, '0')}`;
    return [
      { id: uid('exp'), name: 'Vegetable market', amount: 2200, categoryId: 'cat-groceries', date: mk(2, month), payment: 'Cash', description: 'Weekly vegetables and fruits' },
      { id: uid('exp'), name: 'Monthly groceries', amount: 4800, categoryId: 'cat-groceries', date: mk(5, month), payment: 'UPI', description: 'Supermarket monthly stock' },
      { id: uid('exp'), name: 'Milk & essentials', amount: 1600, categoryId: 'cat-groceries', date: mk(18, month), payment: 'Cash', description: 'Daily essentials refill' },
      { id: uid('exp'), name: 'Family dinner', amount: 1800, categoryId: 'cat-food', date: mk(3, month), payment: 'UPI', description: 'Weekend dinner' },
      { id: uid('exp'), name: 'Office lunches', amount: 2400, categoryId: 'cat-food', date: mk(12, month), payment: 'Debit Card', description: 'Lunches during workdays' },
      { id: uid('exp'), name: 'Snacks & coffee', amount: 900, categoryId: 'cat-food', date: mk(20, month), payment: 'UPI', description: 'Small frequent purchases' },
      { id: uid('exp'), name: 'Fuel', amount: 3200, categoryId: 'cat-travel', date: mk(4, month), payment: 'Credit Card', description: 'Car fuel' },
      { id: uid('exp'), name: 'Metro card', amount: 800, categoryId: 'cat-travel', date: mk(9, month), payment: 'UPI', description: 'Commute recharge' },
      { id: uid('exp'), name: 'Electricity bill', amount: 3900, categoryId: 'cat-electricity', date: mk(7, month), payment: 'Net Banking', description: 'Monthly electricity' },
      { id: uid('exp'), name: 'Water & gas', amount: 1700, categoryId: 'cat-water', date: mk(8, month), payment: 'UPI', description: 'Utility bills' },
      { id: uid('exp'), name: 'House rent', amount: 18000, categoryId: 'cat-rent', date: mk(1, month), payment: 'Bank Transfer', description: 'Monthly rent' },
      { id: uid('exp'), name: 'Medicines', amount: 1200, categoryId: 'cat-health', date: mk(11, month), payment: 'Cash', description: 'Monthly medicines' },
      { id: uid('exp'), name: 'Doctor visit', amount: 1500, categoryId: 'cat-health', date: mk(22, month), payment: 'UPI', description: 'Consultation' },
      { id: uid('exp'), name: 'School fees', amount: 5000, categoryId: 'cat-education', date: mk(6, month), payment: 'Net Banking', description: 'Monthly tuition' },
      { id: uid('exp'), name: 'Plumbing repair', amount: 2200, categoryId: 'cat-maintenance', date: mk(15, month), payment: 'Cash', description: 'Kitchen tap repair' },
      { id: uid('exp'), name: 'Clothing', amount: 2800, categoryId: 'cat-shopping', date: mk(16, month), payment: 'Credit Card', description: 'Seasonal clothing' },
      { id: uid('exp'), name: 'Movie night', amount: 1200, categoryId: 'cat-entertainment', date: mk(14, month), payment: 'UPI', description: 'Tickets and snacks' },
      { id: uid('exp'), name: 'Streaming subscription', amount: 499, categoryId: 'cat-entertainment', date: mk(10, month), payment: 'Credit Card', description: 'Monthly subscription' },
      { id: uid('exp'), name: 'Personal care', amount: 1100, categoryId: 'cat-personal', date: mk(13, month), payment: 'UPI', description: 'Toiletries' },
      { id: uid('exp'), name: 'Internet bill', amount: 999, categoryId: 'cat-internet', date: mk(5, month), payment: 'UPI', description: 'Broadband' },
      { id: uid('exp'), name: 'Mobile recharge', amount: 349, categoryId: 'cat-internet', date: mk(19, month), payment: 'UPI', description: 'Mobile plan' },
      { id: uid('exp'), name: 'Domestic help', amount: 4000, categoryId: 'cat-domestic', date: mk(2, month), payment: 'Cash', description: 'Monthly housekeeping' },
      { id: uid('exp'), name: 'Gift', amount: 1500, categoryId: 'cat-misc', date: mk(21, month), payment: 'UPI', description: 'Birthday gift' },
      // previous month for trend/advisor comparison
      { id: uid('exp'), name: 'Monthly groceries', amount: 4200, categoryId: 'cat-groceries', date: mk(5, pm), payment: 'UPI', description: 'Previous month groceries' },
      { id: uid('exp'), name: 'Family dinner', amount: 1500, categoryId: 'cat-food', date: mk(10, pm), payment: 'UPI', description: 'Previous month dining' },
      { id: uid('exp'), name: 'Fuel', amount: 2800, categoryId: 'cat-travel', date: mk(4, pm), payment: 'Credit Card', description: 'Previous month fuel' },
      { id: uid('exp'), name: 'Electricity bill', amount: 3200, categoryId: 'cat-electricity', date: mk(7, pm), payment: 'Net Banking', description: 'Previous month electricity' },
      { id: uid('exp'), name: 'House rent', amount: 18000, categoryId: 'cat-rent', date: mk(1, pm), payment: 'Bank Transfer', description: 'Previous month rent' },
      { id: uid('exp'), name: 'School fees', amount: 5000, categoryId: 'cat-education', date: mk(6, pm), payment: 'Net Banking', description: 'Previous month fees' }
    ];
  }

  function sampleGoals(month) {
    const y = Number(month.split('-')[0]);
    return [
      { id: uid('goal'), name: 'Emergency Fund', target: 120000, saved: 45000, targetDate: `${y + 1}-03-31` },
      { id: uid('goal'), name: 'Family Vacation', target: 60000, saved: 18000, targetDate: `${y}-12-15` },
      { id: uid('goal'), name: 'Home Appliance Upgrade', target: 35000, saved: 12000, targetDate: `${y}-09-30` }
    ];
  }

  function buildSampleState() {
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const categories = clone(DEFAULT_CATEGORIES);
    return {
      version: 1,
      settings: { monthlyIncome: 85000, theme: 'dark', householdName: 'My Household', currency: 'INR' },
      selectedMonth: month,
      categories,
      budgets: defaultBudgets(categories),
      expenses: sampleExpenses(month),
      goals: sampleGoals(month)
    };
  }

  function buildEmptyState() {
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const categories = clone(DEFAULT_CATEGORIES);
    return {
      version: 1,
      settings: { monthlyIncome: 0, theme: 'dark', householdName: 'My Household', currency: 'INR' },
      selectedMonth: month,
      categories,
      budgets: defaultBudgets(categories),
      expenses: [],
      goals: []
    };
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return buildSampleState();
      const parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.categories)) return buildSampleState();
      return parsed;
    } catch {
      return buildSampleState();
    }
  }

  function save(state) {
    localStorage.setItem(KEY, JSON.stringify(state));
  }

  function clear() {
    localStorage.removeItem(KEY);
  }

  return { KEY, DEFAULT_CATEGORIES, uid, clone, load, save, clear, buildSampleState, buildEmptyState, defaultBudgets };
})();
