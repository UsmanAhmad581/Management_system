function renderPurchasesPage() {
  const select = document.getElementById('pur-supplier-select');
  if (select) {
    const prevSel = select.value;
    select.innerHTML = suppliers.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
    if (prevSel) select.value = prevSel;
  }

  const invoiceInput = document.getElementById('pur-invoice-no');
  if (invoiceInput) {
    invoiceInput.value = `PUR-${nextPurchaseNum}`;
  }

  const dateInput = document.getElementById('pur-date');
  if (dateInput && !dateInput.value) {
    dateInput.value = '24-07-2026';
  }

  const tbody = document.getElementById('pur-items-tbody');
  if (tbody) {
    if (purCart.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:var(--text-muted); padding:35px 0; font-size:13px;">No items added yet. Click "Add Item" to add purchase entries.</td></tr>`;
    } else {
      tbody.innerHTML = purCart.map((item, index) => {
        const productOptions = products.map(p => `
          <option value="${p.id}" ${p.id === item.productId ? 'selected' : ''}>${p.name}</option>
        `).join('');

        return `
          <tr data-index="${index}">
            <td>
              <select style="width:100%; padding:6px 8px; border:1px solid var(--border); border-radius:6px; background:var(--surface-2); color:var(--text);" onchange="updatePurchaseItemProduct(${index}, this.value)">
                ${productOptions}
              </select>
            </td>
            <td><input type="number" min="1" value="${item.qty}" style="width:70px; padding:6px 8px; border:1px solid var(--border); border-radius:6px; background:var(--surface-2); color:var(--text);" oninput="updatePurchaseItemQty(${index}, this.value)"></td>
            <td><input type="number" min="0" value="${item.buyPrice}" style="width:100px; padding:6px 8px; border:1px solid var(--border); border-radius:6px; background:var(--surface-2); color:var(--text);" oninput="updatePurchaseItemPrice(${index}, this.value)"></td>
            <td><input type="number" min="0" value="${item.discount}" style="width:80px; padding:6px 8px; border:1px solid var(--border); border-radius:6px; background:var(--surface-2); color:var(--text);" oninput="updatePurchaseItemDiscount(${index}, this.value)"></td>
            <td>
              <select style="width:70px; padding:6px 8px; border:1px solid var(--border); border-radius:6px; background:var(--surface-2); color:var(--text);" onchange="updatePurchaseItemTax(${index}, this.value)">
                <option value="0" ${item.tax === 0 ? 'selected' : ''}>0%</option>
                <option value="5" ${item.tax === 5 ? 'selected' : ''}>5%</option>
                <option value="10" ${item.tax === 10 ? 'selected' : ''}>10%</option>
                <option value="17" ${item.tax === 17 ? 'selected' : ''}>17%</option>
              </select>
            </td>
            <td class="mono" style="font-weight:600; font-size:12.5px;">${fmtRs((item.qty * item.buyPrice - item.discount) * (1 + item.tax / 100))}</td>
            <td><span class="icon-action" style="cursor:pointer;" onclick="removePurchaseRow(${index})">${i.trash}</span></td>
          </tr>
        `;
      }).join('');
    }
  }

  calculatePurchaseTotal();
}

function addPurchaseRow() {
  if (products.length === 0) {
    showToast('No products available to buy. Add a product first.', 'warn');
    return;
  }
  const defaultProd = products[0];
  purCart.push({
    productId: defaultProd.id,
    qty: 1,
    buyPrice: defaultProd.buyPrice || 0,
    discount: 0,
    tax: 5
  });
  renderPurchasesPage();
}

function updatePurchaseItemProduct(index, productId) {
  const p = products.find(prod => prod.id === productId);
  if (p) {
    purCart[index].productId = productId;
    purCart[index].buyPrice = p.buyPrice || 0;
    renderPurchasesPage();
  }
}

function updatePurchaseItemQty(index, val) {
  purCart[index].qty = parseInt(val) || 1;
  renderPurchasesPage();
}

function updatePurchaseItemPrice(index, val) {
  purCart[index].buyPrice = parseFloat(val) || 0;
  renderPurchasesPage();
}

function updatePurchaseItemDiscount(index, val) {
  purCart[index].discount = parseFloat(val) || 0;
  renderPurchasesPage();
}

function updatePurchaseItemTax(index, val) {
  purCart[index].tax = parseFloat(val) || 0;
  renderPurchasesPage();
}

function removePurchaseRow(index) {
  purCart.splice(index, 1);
  renderPurchasesPage();
}

function calculatePurchaseTotal() {
  let total = 0;
  purCart.forEach(item => {
    total += (item.qty * item.buyPrice - item.discount) * (1 + item.tax / 100);
  });
  const gtSpan = document.getElementById('pur-grand-total');
  if (gtSpan) {
    gtSpan.textContent = fmtRs(total);
  }
}

async function savePurchase() {
  if (purCart.length === 0) {
    showToast('Please add items to save a purchase!', 'warn');
    return;
  }

  const supplierId = document.getElementById('pur-supplier-select').value;
  const supplier = suppliers.find(s => s.id === supplierId);
  if (!supplier) {
    showToast('Select a valid supplier!', 'warn');
    return;
  }

  const invoiceNo = `PUR-${nextPurchaseNum}`;
  const purchaseDate = document.getElementById('pur-date').value.trim() || '24-07-2026';
  const paymentStatus = document.getElementById('pur-payment-status').value;

  let total = 0;
  purCart.forEach(item => {
    total += (item.qty * item.buyPrice - item.discount) * (1 + item.tax / 100);
  });

  let paid = 0;
  if (paymentStatus === 'Paid') {
    paid = total;
  } else if (paymentStatus === 'Partial') {
    const amtStr = prompt(`Grand Total is ${fmtRs(total)}. Enter amount paid:`, Math.round(total / 2));
    if (amtStr === null) return;
    paid = parseFloat(amtStr) || 0;
  }
  const due = Math.max(0, total - paid);

  const newPurchase = {
    invoiceNo: invoiceNo,
    supplierId: supplier.id,
    supplierName: supplier.name,
    date: purchaseDate,
    total: total,
    paid: paid,
    due: due,
    status: paymentStatus,
    items: purCart.map(item => {
      const p = products.find(prod => prod.id === item.productId);
      return {
        productId: item.productId,
        name: p ? p.name : 'Unknown Product',
        qty: item.qty,
        price: item.buyPrice,
        discount: item.discount,
        total: (item.qty * item.buyPrice - item.discount) * (1 + item.tax / 100)
      };
    })
  };

  try {
    await apiFetch('/api/purchases', {
      method: 'POST',
      body: JSON.stringify(newPurchase)
    });
  } catch (err) {
    showToast('Could not save the purchase to SQLite. Please try again.', 'danger');
    return;
  }

  // Only commit local state once the server has confirmed the purchase was
  // persisted, so a failed save never leaves stock/outstanding balances
  // updated for a purchase that doesn't actually exist.
  nextPurchaseNum++;

  purCart.forEach(item => {
    const p = products.find(prod => prod.id === item.productId);
    if (p) {
      p.stock += item.qty;
    }
  });

  purchases.unshift(newPurchase);

  supplier.outstanding += due;
  supplier.ytd += total;
  supplier.history.unshift({
    no: invoiceNo,
    date: '24 Jul',
    amt: total
  });

  if (paid > 0) {
    const paymentRecord = {
      ref: `PMT-${nextPaymentNum}`,
      partyName: supplier.name,
      partyId: supplier.id,
      type: 'Supplier',
      date: purchaseDate,
      amount: paid,
      method: 'Cash',
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
      showToast('Purchase was saved, but recording the payment failed.', 'danger');
    }
  }

  purCart = [];

  renderPurchasesPage();
  renderSuppliers();
  renderProducts();
  renderPayments();
  renderDashboard();

  showToast(`Purchase saved successfully! Stock updated.`, 'ok');
}

function cancelPurchase() {
  purCart = [];
  renderPurchasesPage();
  showToast('Purchase draft cleared.', 'warn');
}

