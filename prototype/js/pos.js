function renderPOS() {
  const select = document.getElementById('pos-customer-select');
  if (select) {
    select.innerHTML = `<option value="">Walk-in Customer</option>` + 
      customers.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
  }

  const invLabel = document.getElementById('pos-invoice-no');
  if (invLabel) {
    invLabel.textContent = `INV-${nextSaleNum}`;
  }

  const cartBody = document.getElementById('pos-cart-tbody');
  if (cartBody) {
    if (posCart.length === 0) {
      cartBody.innerHTML = `<div style="text-align:center; padding:35px 0; color:var(--text-muted); font-size:13px; width:100%;">Cart is empty. Search products or add manually.</div>`;
    } else {
      cartBody.innerHTML = posCart.map((item, index) => {
        return `
        <div class="pos-cart-row" style="margin-bottom: 6px; align-items:center;">
          <div style="font-weight:600; font-size:13px; color:var(--text); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${item.name}</div>
          <div><input type="number" min="1" value="${item.qty}" style="width:100%; border:1px solid var(--border); border-radius:4px; padding:3px 6px; background:var(--surface-2); color:var(--text);" oninput="updatePOSCartQty(${index}, this.value)"></div>
          <div><input type="number" min="0" value="${item.price}" style="width:100%; border:1px solid var(--border); border-radius:4px; padding:3px 6px; background:var(--surface-2); color:var(--text);" oninput="updatePOSCartPrice(${index}, this.value)"></div>
          <div><input type="number" min="0" value="${item.discount}" style="width:100%; border:1px solid var(--border); border-radius:4px; padding:3px 6px; background:var(--surface-2); color:var(--text);" oninput="updatePOSCartDiscount(${index}, this.value)"></div>
          <div class="mono" style="font-weight:600; font-size:12.5px;">${fmtRs(item.qty * item.price - item.discount)}</div>
          <div class="icon-action" style="margin-left:auto; cursor:pointer;" onclick="removePOSCartItem(${index})">${i.trash}</div>
        </div>`;
      }).join('');
    }
  }

  calculatePOSSummary();
}

function showPOSProductSuggestions(query) {
  const suggestionsDiv = document.getElementById('pos-suggestions');
  if (!suggestionsDiv) return;
  const q = query.trim().toLowerCase();
  if (!q) {
    suggestionsDiv.style.display = 'none';
    return;
  }

  const matches = products.filter(p => p.name.toLowerCase().includes(q) || p.barcode.toLowerCase().includes(q));
  if (matches.length === 0) {
    suggestionsDiv.innerHTML = `<div style="padding:10px 12px; color:var(--text-muted); font-size:12.5px;">No products found</div>`;
  } else {
    suggestionsDiv.innerHTML = matches.map(p => {
      const isLow = p.stock <= p.minStock;
      const stockColor = isLow ? 'var(--danger)' : 'var(--ok)';
      return `
      <div style="padding:10px 12px; cursor:pointer; border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:center;" onclick="addPOSItemFromSuggestion('${p.id}')">
        <div>
          <div style="font-weight:600; font-size:13px; color:var(--text);">${p.name}</div>
          <div style="font-size:11px; color:var(--text-muted);">${p.barcode} · ${fmtRs(p.sellPrice || p.buyPrice)}</div>
        </div>
        <div style="font-weight:700; color:${stockColor}; font-size:11.5px;">Stock: ${p.stock}</div>
      </div>`;
    }).join('');
  }
  suggestionsDiv.style.display = 'block';
}

function addPOSItemFromSuggestion(id) {
  const p = products.find(prod => prod.id === id);
  if (!p) return;
  
  document.getElementById('pos-suggestions').style.display = 'none';
  document.getElementById('pos-product-search').value = '';

  const existing = posCart.find(item => item.productId === id);
  if (existing) {
    existing.qty++;
  } else {
    posCart.push({
      productId: p.id,
      name: p.name,
      qty: 1,
      price: p.sellPrice || p.buyPrice || 0,
      discount: 0
    });
  }
  renderPOS();
}

function addPOSItemManual() {
  if (products.length === 0) {
    showToast('No products available. Please create a product first.', 'warn');
    return;
  }
  const firstProd = products[0];
  posCart.push({
    productId: firstProd.id,
    name: firstProd.name,
    qty: 1,
    price: firstProd.sellPrice || firstProd.buyPrice || 0,
    discount: 0
  });
  renderPOS();
}

function updatePOSCartQty(index, val) {
  const qty = parseInt(val) || 1;
  posCart[index].qty = qty;
  calculatePOSSummary();
}
function updatePOSCartPrice(index, val) {
  const price = parseFloat(val) || 0;
  posCart[index].price = price;
  calculatePOSSummary();
}
function updatePOSCartDiscount(index, val) {
  const disc = parseFloat(val) || 0;
  posCart[index].discount = disc;
  calculatePOSSummary();
}
function removePOSCartItem(index) {
  posCart.splice(index, 1);
  renderPOS();
}

function calculatePOSSummary() {
  let subtotal = 0;
  posCart.forEach(item => {
    subtotal += (item.qty * item.price) - item.discount;
  });

  const discInput = document.getElementById('pos-summary-discount');
  const globalDiscount = discInput ? parseFloat(discInput.value) || 0 : 0;
  
  const taxRateDisplay = document.getElementById('pos-tax-rate-display');
  if (taxRateDisplay) {
    taxRateDisplay.textContent = globalTaxRate;
  }
  
  const taxableAmount = Math.max(0, subtotal - globalDiscount);
  const tax = taxableAmount * (globalTaxRate / 100);
  const grandTotal = taxableAmount + tax;

  const recValInput = document.getElementById('pos-received-amount');
  let receivedAmount = 0;
  if (recValInput) {
    if (recValInput.dataset.modified !== 'true') {
      recValInput.value = Math.round(grandTotal);
      receivedAmount = Math.round(grandTotal);
    } else {
      receivedAmount = parseFloat(recValInput.value) || 0;
    }
  } else {
    receivedAmount = grandTotal;
  }

  const dueAmount = Math.max(0, grandTotal - receivedAmount);

  const subtotalEl = document.getElementById('pos-summary-subtotal');
  if (subtotalEl) subtotalEl.textContent = fmtRs(subtotal);
  
  const taxEl = document.getElementById('pos-summary-tax');
  if (taxEl) taxEl.textContent = fmtRs(tax);
  
  const grandEl = document.getElementById('pos-summary-grand-total');
  if (grandEl) grandEl.textContent = fmtRs(grandTotal);
  
  const dueEl = document.getElementById('pos-due-amount');
  if (dueEl) {
    dueEl.textContent = fmtRs(dueAmount);
    dueEl.style.color = dueAmount > 0 ? 'var(--danger)' : 'var(--ok)';
  }
}

function setPOSPaymentMethod(btn, method) {
  document.querySelectorAll('#pos-payment-methods button').forEach(b => b.classList.remove('sel'));
  btn.classList.add('sel');
  posSelectedPaymentMethod = method;
}

async function completePOSSale() {
  if (posCart.length === 0) {
    showToast('Your sales cart is empty!', 'warn');
    return;
  }

  let stockError = false;
  let stockErrorMsg = '';
  posCart.forEach(item => {
    const p = products.find(prod => prod.id === item.productId);
    if (p && p.stock < item.qty) {
      stockError = true;
      stockErrorMsg += `Insufficient stock for ${item.name}! Only ${p.stock} available. `;
    }
  });

  if (stockError) {
    showToast(stockErrorMsg, 'danger');
    return;
  }

  let subtotal = 0;
  posCart.forEach(item => {
    subtotal += (item.qty * item.price) - item.discount;
  });

  const globalDiscount = parseFloat(document.getElementById('pos-summary-discount')?.value) || 0;
  const taxableAmount = Math.max(0, subtotal - globalDiscount);
  const tax = taxableAmount * (globalTaxRate / 100);
  const total = taxableAmount + tax;
  const paid = parseFloat(document.getElementById('pos-received-amount')?.value) || 0;
  const due = Math.max(0, total - paid);

  const custSelect = document.getElementById('pos-customer-select');
  const custId = custSelect ? custSelect.value || 'WALK-IN' : 'WALK-IN';
  const customer = customers.find(c => c.id === custId);
  const customerName = customer ? customer.name : 'Walk-in Customer';

  let status = 'Paid';
  if (due > 0) {
    status = paid > 0 ? 'Partial' : 'Due';
  }

  const newInvoice = {
    invoiceNo: `INV-${nextSaleNum}`,
    customerId: custId,
    customerName: customerName,
    date: '24 Jul 2026',
    subtotal: subtotal,
    discount: globalDiscount,
    tax: tax,
    total: total,
    paid: paid,
    due: due,
    method: posSelectedPaymentMethod,
    status: status,
    items: posCart.map(item => ({
      productId: item.productId,
      name: item.name,
      qty: item.qty,
      price: item.price,
      discount: item.discount,
      total: (item.qty * item.price) - item.discount
    }))
  };

  try {
    await apiFetch('/api/sales', {
      method: 'POST',
      body: JSON.stringify(newInvoice)
    });
  } catch (err) {
    showToast('Could not save the sale to SQLite. Please try again.', 'danger');
    return;
  }

  // Only commit local state once the server has confirmed the sale was
  // persisted, so a failed save never leaves stock/balances decremented
  // for a sale that doesn't actually exist.
  nextSaleNum++;

  posCart.forEach(item => {
    const p = products.find(prod => prod.id === item.productId);
    if (p) {
      p.stock -= item.qty;
    }
  });

  sales.unshift(newInvoice);

  if (customer) {
    customer.balance += due;
    customer.ytd += total;
    customer.lastTx = '24 Jul 2026';
    if (due > 0) {
      customer.invoices.unshift({
        no: newInvoice.invoiceNo,
        date: '24 Jul',
        amt: due
      });
    }
  }

  if (paid > 0) {
    const paymentRecord = {
      ref: `PMT-${nextPaymentNum}`,
      partyName: customerName,
      partyId: custId,
      type: 'Customer',
      date: '24 Jul 2026',
      amount: paid,
      method: posSelectedPaymentMethod,
      status: 'Cleared'
    };
    try {
      await apiFetch('/api/payments', {
        method: 'POST',
        body: JSON.stringify(paymentRecord)
      });
      nextPaymentNum++;
      payments.unshift(paymentRecord);
    } catch (err) {
      showToast('Sale was saved, but recording the payment failed.', 'danger');
    }
  }

  posCart = [];
  posSelectedPaymentMethod = 'Cash';
  const searchInput = document.getElementById('pos-product-search');
  if (searchInput) searchInput.value = '';
  const discountInput = document.getElementById('pos-summary-discount');
  if (discountInput) discountInput.value = 0;
  const receivedInput = document.getElementById('pos-received-amount');
  if (receivedInput) {
    receivedInput.value = 0;
    delete receivedInput.dataset.modified;
  }

  renderReceiptPreview(newInvoice);

  renderPOS();
  renderCustomers();
  renderProducts();
  renderPayments();
  renderReceiptCenter();
  renderDashboard();

  showToast(`Sale recorded successfully! ${newInvoice.invoiceNo} generated.`, 'ok');
}

function cancelPOSSale() {
  posCart = [];
  const searchInput = document.getElementById('pos-product-search');
  if (searchInput) searchInput.value = '';
  const discountInput = document.getElementById('pos-summary-discount');
  if (discountInput) discountInput.value = 0;
  const receivedInput = document.getElementById('pos-received-amount');
  if (receivedInput) {
    receivedInput.value = 0;
    delete receivedInput.dataset.modified;
  }
  renderPOS();
  showToast('Sale cancelled.', 'warn');
}

function renderReceiptPreview(inv) {
  const modalBox = document.getElementById('modalBox');
  if (!modalBox) return;

  const itemsHtml = inv.items.map(item => `
    <div class="rline"><span>${item.name} x${item.qty}</span><span>${Math.round(item.total).toLocaleString()}</span></div>
  `).join('');

  modalBox.innerHTML = `
    <div class="modal-head"><h3>Receipt Preview</h3><div class="close-x" onclick="closeModal()">✕</div></div>
    <div class="modal-body">
      <div class="receipt strand" style="margin:0 auto;">
        <div class="center" style="font-weight:700; font-size:13px;">AL-BARKAT VERMICELLI MILLS</div>
        <div class="center">Main Bazaar, Vihari, Punjab</div>
        <div class="center">0301-2345678</div>
        <hr>
        <div class="rline"><span>Invoice</span><span>${inv.invoiceNo}</span></div>
        <div class="rline"><span>Customer</span><span>${inv.customerName}</span></div>
        <div class="rline"><span>Date</span><span>${inv.date}</span></div>
        <hr>
        ${itemsHtml}
        <hr>
        <div class="rline"><span>Subtotal</span><span>${Math.round(inv.subtotal).toLocaleString()}</span></div>
        ${inv.discount > 0 ? `<div class="rline"><span>Discount</span><span>-${Math.round(inv.discount).toLocaleString()}</span></div>` : ''}
        <div class="rline"><span>Tax (${globalTaxRate}%)</span><span>${Math.round(inv.tax).toLocaleString()}</span></div>
        <div class="rline" style="font-weight:700;"><span>Grand Total</span><span>${Math.round(inv.total).toLocaleString()}</span></div>
        <div class="rline"><span>Paid</span><span>${Math.round(inv.paid).toLocaleString()}</span></div>
        <div class="rline" style="font-weight:700; color:${inv.due > 0 ? 'var(--danger)' : 'var(--ok)'}"><span>Due</span><span>${Math.round(inv.due).toLocaleString()}</span></div>
        <hr>
        <div class="center">Thank you for your business!</div>
        <div class="barcode"></div>
      </div>
    </div>
    <div class="modal-foot">
      <button class="btn btn-ghost" onclick="closeModal()">Close</button>
      <button class="btn btn-primary" onclick="window.print()">${i.print} Print Receipt</button>
    </div>
  `;
  modalBox.style.width = '420px';
  document.getElementById('modalBackdrop').classList.add('active');
}

