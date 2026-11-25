const Advisor = (() => {
  function prevMonth(month) {
    const [y, m] = month.split('-').map(Number);
    const d = new Date(y, m - 2, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  function analyze(state, month) {
    const rows = Budget.categoryRows(state, month);
    const pm = prevMonth(month);
    const prevRows = Budget.categoryRows(state, pm);
    const prevMap = Object.fromEntries(prevRows.map(r => [r.id, r]));
    const monthExps = Budget.monthExpenses(state, month);
    const insights = [];
    let potentialSavings = 0;

    rows.forEach(r => {
      const prev = prevMap[r.id];
      const prevUsed = prev ? prev.used : 0;
      const changePct = prevUsed > 0 ? ((r.used - prevUsed) / prevUsed) * 100 : (r.used > 0 ? 100 : 0);

      if (r.allocated > 0 && r.used > r.allocated) {
        const over = r.used - r.allocated;
        potentialSavings += over;
        const catExps = monthExps.filter(e => e.categoryId === r.id);
        const reasons = [];
        if (changePct > 15) reasons.push(`spending increased ${changePct.toFixed(0)}% compared to last month`);
        if (catExps.length >= 5) reasons.push(`${catExps.length} transactions indicate frequent purchases`);
        const top = catExps.slice().sort((a,b)=>b.amount-a.amount)[0];
        if (top) reasons.push(`largest expense was "${top.name}" (${Budget.formatINR(top.amount)})`);
        insights.push({
          type: 'overspend', severity: 'high', icon: r.icon, category: r.name,
          title: `${r.name} is over budget`,
          problem: `Budget ${Budget.formatINR(r.allocated)}, actual ${Budget.formatINR(r.used)}, over by ${Budget.formatINR(over)}.`,
          reason: reasons.length ? reasons.join('; ') + '.' : 'Actual spending exceeded the planned limit for this month.',
          recommendation: recommendationFor(r.id, over),
          savings: over
        });
      } else if (r.allocated > 0 && r.pct >= 90) {
        insights.push({
          type: 'warning', severity: 'medium', icon: r.icon, category: r.name,
          title: `${r.name} is near budget limit`,
          problem: `${r.pct.toFixed(0)}% of budget used with ${Budget.formatINR(r.remaining)} remaining.`,
          reason: 'Spending pace is close to the monthly allocation.',
          recommendation: `Pause non-essential purchases in ${r.name} for the rest of the month and review upcoming planned expenses.`,
          savings: Math.max(0, r.remaining * 0.2)
        });
      }

      if (prevUsed > 0 && changePct >= 25 && r.used > 1000 && !(r.allocated > 0 && r.used > r.allocated)) {
        const est = r.used - prevUsed;
        potentialSavings += est * 0.5;
        insights.push({
          type: 'spike', severity: 'medium', icon: r.icon, category: r.name,
          title: `Unusual spending spike in ${r.name}`,
          problem: `Spending rose by ${changePct.toFixed(0)}% vs last month (${Budget.formatINR(prevUsed)} → ${Budget.formatINR(r.used)}).`,
          reason: 'Month-over-month change is significantly higher than previous spending.',
          recommendation: `Review recent ${r.name} transactions and set a weekly cap to prevent further drift.`,
          savings: est * 0.5
        });
      }
    });

    // Frequent small expenses
    const small = monthExps.filter(e => Number(e.amount) <= 300);
    const smallByCat = {};
    small.forEach(e => { smallByCat[e.categoryId] = (smallByCat[e.categoryId] || 0) + 1; });
    Object.entries(smallByCat).forEach(([catId, count]) => {
      if (count >= 4) {
        const cat = state.categories.find(c => c.id === catId);
        const total = small.filter(e => e.categoryId === catId).reduce((s,e)=>s+Number(e.amount),0);
        potentialSavings += total * 0.3;
        insights.push({
          type: 'small', severity: 'low', icon: cat?.icon || '💸', category: cat?.name || 'Category',
          title: `Frequent small expenses in ${cat?.name || 'a category'}`,
          problem: `${count} small transactions totaling ${Budget.formatINR(total)} detected.`,
          reason: 'Small, frequent purchases can accumulate unnoticed over a month.',
          recommendation: `Set a weekly micro-spending limit for ${cat?.name || 'this category'} and consolidate purchases where possible.`,
          savings: total * 0.3
        });
      }
    });

    // Cost reduction opportunities for high non-essential categories
    const nonEssential = ['cat-food','cat-shopping','cat-entertainment','cat-personal','cat-misc'];
    rows.forEach(r => {
      if (nonEssential.includes(r.id) && r.used > 2000 && r.pct < 90) {
        const est = r.used * 0.1;
        insights.push({
          type: 'opportunity', severity: 'low', icon: r.icon, category: r.name,
          title: `Savings opportunity in ${r.name}`,
          problem: `You spent ${Budget.formatINR(r.used)} this month.`,
          reason: 'Discretionary spending often has room for planned reduction without affecting essentials.',
          recommendation: `Try reducing ${r.name} by 10% next month through planned purchases and comparison shopping.`,
          savings: est
        });
      }
    });

    const currentTotal = rows.reduce((s,r)=>s+r.used,0);
    const prevTotal = prevRows.reduce((s,r)=>s+r.used,0);
    const trendPct = prevTotal > 0 ? ((currentTotal - prevTotal) / prevTotal) * 100 : 0;
    const trend = trendPct > 5 ? 'Rising' : trendPct < -5 ? 'Falling' : 'Stable';

    // Deduplicate by title, keep highest severity/savings
    const seen = new Map();
    const sevRank = { high: 3, medium: 2, low: 1 };
    insights.forEach(i => {
      const k = i.title;
      if (!seen.has(k) || sevRank[i.severity] > sevRank[seen.get(k).severity]) seen.set(k, i);
    });
    const finalInsights = Array.from(seen.values()).sort((a,b)=>sevRank[b.severity]-sevRank[a.severity] || b.savings-a.savings);

    if (!finalInsights.length) {
      finalInsights.push({
        type: 'good', severity: 'low', icon: '✅', category: 'Overall',
        title: 'Spending looks healthy',
        problem: 'No major budget overruns or unusual spikes detected for the selected month.',
        reason: 'Your tracked expenses are within expected patterns.',
        recommendation: 'Continue tracking consistently and consider moving surplus balance to a savings goal.',
        savings: 0
      });
    }

    return {
      month, prevMonth: pm, trend, trendPct, currentTotal, prevTotal,
      potentialSavings: Math.max(0, potentialSavings),
      overspendCount: finalInsights.filter(i => i.type === 'overspend').length,
      smallCount: small.length,
      insights: finalInsights
    };
  }

  function recommendationFor(catId, over) {
    const map = {
      'cat-groceries': `Plan weekly grocery lists, compare prices across stores, buy staples in bulk, and avoid duplicate purchases to recover about ${Budget.formatINR(over)}.`,
      'cat-food': `Reduce dining out frequency, set a weekly eating-out cap, and prefer home-cooked meals to save around ${Budget.formatINR(over)}.`,
      'cat-travel': `Combine trips, use public transport where practical, and track fuel usage weekly to cut roughly ${Budget.formatINR(over)}.`,
      'cat-electricity': `Check high-usage appliances, switch off idle devices, and use energy-efficient settings to reduce about ${Budget.formatINR(over)}.`,
      'cat-shopping': `Delay non-essential purchases by 24 hours and set a monthly shopping cap to save around ${Budget.formatINR(over)}.`,
      'cat-entertainment': `Use shared plans, look for free activities, and set an entertainment limit to recover about ${Budget.formatINR(over)}.`
    };
    return map[catId] || `Review recent transactions in this category, identify non-essential items, and set a stricter weekly limit to recover about ${Budget.formatINR(over)}.`;
  }

  return { analyze };
})();
