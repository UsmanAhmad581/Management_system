function renderInventoryPage() {
  let rawKg = 0;
  let finKg = 0;
  let packKg = 0;
  let totalVal = 0;
  let lowCount = 0;
  let outCount = 0;

  products.forEach(p => {
    if (p.category === 'Raw Material') rawKg += p.stock;
    else if (p.category === 'Finished Good') finKg += p.stock;
    else if (p.category === 'Packaging') packKg += p.stock;

    totalVal += p.stock * p.buyPrice;

    if (p.stock <= 0) outCount++;
    else if (p.stock <= p.minStock) lowCount++;
  });

  const totalStockKg = rawKg + finKg + packKg;

  const totalStockEl = document.getElementById('inv-total-stock');
  if (totalStockEl) totalStockEl.textContent = totalStockKg.toLocaleString() + ' kg';

  const finStockEl = document.getElementById('inv-finished-stock');
  if (finStockEl) finStockEl.textContent = finKg.toLocaleString() + ' kg';

  const rawStockEl = document.getElementById('inv-raw-stock');
  if (rawStockEl) rawStockEl.textContent = rawKg.toLocaleString() + ' kg';

  const lowCountEl = document.getElementById('inv-low-count');
  if (lowCountEl) lowCountEl.textContent = lowCount;

  const outCountEl = document.getElementById('inv-out-count');
  if (outCountEl) outCountEl.textContent = outCount;

  const totalValEl = document.getElementById('inv-total-value');
  if (totalValEl) totalValEl.textContent = fmtRs(totalVal);

  const tbody = document.getElementById('inv-low-tbody');
  if (tbody) {
    const lowOrOutProds = products.filter(p => p.stock <= p.minStock);
    tbody.innerHTML = lowOrOutProds.length ? lowOrOutProds.map(p => {
      const isOut = p.stock <= 0;
      return `
        <tr>
          <td>${p.name}</td>
          <td style="color:${isOut ? 'var(--danger)' : 'var(--warn)'}; font-weight:700;">${p.stock}</td>
          <td><span class="chip ${isOut ? 'chip-danger' : 'chip-warn'}">${isOut ? 'Out of Stock' : 'Low Stock'}</span></td>
        </tr>
      `;
    }).join('') : `<tr><td colspan="3" style="text-align:center; color:var(--text-muted); padding:18px 0;">All products have healthy stock.</td></tr>`;
  }
}

