function renderDashboard() {
  const todayDateStr = '24 Jul 2026';
  const todaySalesVal = sales.filter(s => s.date === todayDateStr).reduce((sum, s) => sum + s.total, 0);
  const salesValEl = document.getElementById('kpi-today-sales');
  if (salesValEl) salesValEl.textContent = fmtRs(todaySalesVal);

  const todayPurchasesVal = purchases.filter(p => p.date === '24-07-2026' || p.date === '24 Jul 2026').reduce((sum, p) => sum + p.total, 0);
  const purValEl = document.getElementById('kpi-today-purchases');
  if (purValEl) purValEl.textContent = fmtRs(todayPurchasesVal);

  let todayProfitVal = 0;
  sales.filter(s => s.date === todayDateStr).forEach(s => {
    s.items.forEach(item => {
      const p = products.find(prod => prod.name === item.name);
      const cost = p ? p.buyPrice : (item.price * 0.7);
      todayProfitVal += item.total - (item.qty * cost);
    });
    todayProfitVal -= s.discount;
  });
  const profitValEl = document.getElementById('kpi-today-profit');
  if (profitValEl) profitValEl.textContent = fmtRs(todayProfitVal);

  const totalStockKg = products.reduce((sum, p) => sum + p.stock, 0);
  const currentInvEl = document.getElementById('kpi-inventory-stock');
  if (currentInvEl) currentInvEl.textContent = totalStockKg.toLocaleString() + ' kg';

  const skusCountEl = document.getElementById('kpi-inventory-skus');
  if (skusCountEl) skusCountEl.textContent = `across ${products.length} SKUs`;

  const dueInvoices = sales.filter(s => s.due > 0);
  const pendingPaymentsVal = dueInvoices.reduce((sum, s) => sum + s.due, 0);
  const pendValEl = document.getElementById('kpi-pending-payments');
  if (pendValEl) pendValEl.textContent = fmtRs(pendingPaymentsVal);
  const pendCountEl = document.getElementById('kpi-pending-count');
  if (pendCountEl) pendCountEl.textContent = `${dueInvoices.length} invoices`;

  const outstandingPayablesVal = suppliers.reduce((sum, s) => sum + s.outstanding, 0);
  const outDuesEl = document.getElementById('kpi-outstanding-dues');
  if (outDuesEl) outDuesEl.textContent = fmtRs(outstandingPayablesVal);
  
  const overdueCountEl = document.getElementById('kpi-outstanding-count');
  if (overdueCountEl) {
    const overdueSuppliers = suppliers.filter(s => s.outstanding > 0);
    overdueCountEl.textContent = `${overdueSuppliers.length} suppliers with dues`;
  }

  const txTbody = document.getElementById('dash-recent-tx');
  if (txTbody) {
    const txList = [];
    sales.slice(0, 3).forEach(s => txList.push({ id: s.invoiceNo, party: s.customerName, type: 'Sale', amount: s.total, dateStr: s.date, status: s.status, statusCls: s.status === 'Paid' ? 'chip-ok' : s.status === 'Partial' ? 'chip-warn' : 'chip-danger' }));
    purchases.slice(0, 3).forEach(p => txList.push({ id: p.invoiceNo, party: p.supplierName, type: 'Purchase', amount: p.total, dateStr: p.date, status: p.status, statusCls: p.status === 'Paid' ? 'chip-ok' : p.status === 'Partial' ? 'chip-warn' : 'chip-info' }));
    payments.slice(0, 3).forEach(pmt => txList.push({ id: pmt.ref, party: pmt.partyName, type: pmt.type === 'Customer' ? 'Receipt' : 'Payment', amount: pmt.amount, dateStr: pmt.date, status: pmt.status, statusCls: 'chip-ok' }));

    txTbody.innerHTML = txList.slice(0, 5).map(tx => `
      <tr>
        <td class="mono">${tx.id}</td>
        <td>${tx.party}</td>
        <td>${tx.type}</td>
        <td>${fmtRs(tx.amount)}</td>
        <td><span class="chip ${tx.statusCls}">${tx.status}</span></td>
      </tr>
    `).join('');
  }

  const lowTbody = document.getElementById('dash-low-stock');
  if (lowTbody) {
    const lowProds = products.filter(p => p.stock <= p.minStock);
    lowTbody.innerHTML = lowProds.length ? lowProds.map(p => `
      <tr>
        <td>${p.name}</td>
        <td style="color:var(--danger); font-weight:700;">${p.stock}</td>
        <td>${p.minStock}</td>
      </tr>
    `).join('') : `<tr><td colspan="3" style="text-align:center; color:var(--text-muted); padding:10px 0;">All stocks healthy!</td></tr>`;
  }

  let rawKg = 0;
  let finKg = 0;
  let packKg = 0;
  products.forEach(p => {
    if (p.category === 'Raw Material') rawKg += p.stock;
    else if (p.category === 'Finished Good') finKg += p.stock;
    else if (p.category === 'Packaging') packKg += p.stock;
  });
  const totalWeight = rawKg + finKg + packKg || 1;
  const rawPct = Math.round((rawKg / totalWeight) * 100);
  const finPct = Math.round((finKg / totalWeight) * 100);
  const packPct = Math.max(0, 100 - rawPct - finPct);

  const donutEl = document.getElementById('dash-donut');
  if (donutEl) {
    donutEl.style.background = `conic-gradient(var(--primary) 0 ${finPct}%, var(--secondary) ${finPct}% ${finPct + rawPct}%, var(--info) ${finPct + rawPct}% 100%)`;
  }

  const legendEl = document.getElementById('dash-donut-legend');
  if (legendEl) {
    legendEl.innerHTML = `
      <span>🟢 Finished ${finPct}%</span>
      <span>🟠 Raw ${rawPct}%</span>
      <span>🔵 Packaging ${packPct}%</span>
    `;
  }
}

