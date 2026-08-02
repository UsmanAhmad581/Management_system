
// Relative path so this works whether the page is served from
// http://127.0.0.1:8000 (recommended) or any other host/port the
// server happens to bind to. Avoids cross-origin fetch issues entirely.
const API_BASE = '';

async function apiFetch(path, options={}) {
  const response = await fetch(API_BASE + path, {
    headers: {'Content-Type': 'application/json'},
    ...options,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Request failed for ${path}: ${response.status} ${text}`);
  }

  return response.json();
}

async function loadServerData() {
  try {
    const [customerPayload, supplierPayload, productPayload, salesPayload, purchasePayload, paymentPayload, expensePayload] = await Promise.all([
      apiFetch('/api/customers'),
      apiFetch('/api/suppliers'),
      apiFetch('/api/products'),
      apiFetch('/api/sales'),
      apiFetch('/api/purchases'),
      apiFetch('/api/payments'),
      apiFetch('/api/expenses')
    ]);

    customers = customerPayload.map(c => ({
      ...c,
      lastTx: c.lastTx || c.last_tx || '—',
      invoices: Array.isArray(c.invoices) ? c.invoices : []
    }));

    suppliers = supplierPayload.map(s => ({
      ...s,
      history: Array.isArray(s.history) ? s.history : []
    }));

    products = productPayload.map(p => ({
      ...p,
      buyPrice: Number(p.buyPrice ?? p.buy_price ?? 0),
      sellPrice: p.sellPrice == null ? null : Number(p.sellPrice),
      minStock: Number(p.minStock ?? p.min_stock ?? 0),
      stock: Number(p.stock ?? 0)
    }));

    sales = Array.isArray(salesPayload) ? salesPayload : [];
    purchases = Array.isArray(purchasePayload) ? purchasePayload : [];
    payments = Array.isArray(paymentPayload) ? paymentPayload : [];
    expenses = Array.isArray(expensePayload) ? expensePayload : [];

    if (customers.length) selectedCustomerId = customers[0].id;
    if (suppliers.length) selectedSupplierId = suppliers[0].id;

    // Re-sync the "next number" counters used to mint new IDs/invoice numbers
    // against whatever the server already has on disk. Without this, every
    // counter restarts at its hardcoded default on each page load/app
    // restart, so the first new customer/sale/purchase/payment created in a
    // new session collides with an existing primary key (e.g. INV-1 already
    // exists) and the save silently fails.
    nextCustomerNum = nextIdNumber(customers, 'CU-', nextCustomerNum);
    nextSupplierNum = nextIdNumber(suppliers, 'SU-', nextSupplierNum);
    nextProductNum = nextIdNumber(products, 'PR-', nextProductNum);
    nextSaleNum = nextIdNumber(sales, 'INV-', nextSaleNum, 'invoiceNo');
    nextPurchaseNum = nextIdNumber(purchases, 'PUR-', nextPurchaseNum, 'invoiceNo');
    nextPaymentNum = nextIdNumber(payments, 'PMT-', nextPaymentNum, 'ref');
  } catch (err) {
    console.warn('API sync failed, continuing with in-page demo data:', err);
  }
}

// Given a list of records with IDs like "PREFIX-0007", find the highest
// numeric suffix in use and return one past it (so newly minted IDs never
// collide with records already saved on the server). Falls back to
// `fallback` when the list is empty or nothing matches the prefix.
function nextIdNumber(records, prefix, fallback, field = 'id') {
  let max = 0;
  let found = false;
  (records || []).forEach(r => {
    const value = r && r[field];
    if (typeof value !== 'string' || !value.startsWith(prefix)) return;
    const num = parseInt(value.slice(prefix.length), 10);
    if (!Number.isNaN(num)) {
      found = true;
      if (num > max) max = num;
    }
  });
  return found ? max + 1 : fallback;
}

// inject icons into placeholders written as ${i.x} literally (since this is static HTML, not JS templating)
document.addEventListener('DOMContentLoaded', () => {
  document.body.innerHTML = document.body.innerHTML.replace(/\$\{i\.(\w+)\}/g, (m,k)=> i[k]||'');
  initApp();
});

async function initApp(){
  document.getElementById('todayDate').textContent = 'Fri, 24 Jul 2026';
  await loadServerData();

  document.querySelectorAll('.nav-item[data-screen]').forEach(item=>{
    item.addEventListener('click', ()=>{
      document.querySelectorAll('.nav-item[data-screen]').forEach(n=>n.classList.remove('active'));
      item.classList.add('active');
      document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
      
      const screenId = item.dataset.screen;
      document.getElementById('screen-'+screenId).classList.add('active');

      // Screen-specific updates
      if (screenId === 'inventory') renderInventoryPage();
      if (screenId === 'sales') renderPOS();
      if (screenId === 'purchases') renderPurchasesPage();
      if (screenId === 'payments') renderPayments();
      if (screenId === 'expenses') renderExpenses();
      if (screenId === 'receiptcenter') renderReceiptCenter();
      if (screenId === 'dashboard') renderDashboard();

      document.querySelector('.content').scrollIntoView({behavior:'instant'});
    });
  });

  renderCustomers();
  renderSuppliers();
  renderProducts();
  renderPayments();
  renderExpenses();
  renderReceiptCenter();
  renderDashboard();
}

