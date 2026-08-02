function renderPayments() {
  const receivables = customers.reduce((sum, c) => sum + c.balance, 0);
  const payables = suppliers.reduce((sum, s) => sum + s.outstanding, 0);

  const kpis = document.querySelectorAll('#screen-payments .kpi .value');
  if (kpis.length >= 3) {
    kpis[0].textContent = fmtRs(receivables);
    kpis[1].textContent = fmtRs(payables);
    kpis[2].textContent = payments.length;
  }

  const tbody = document.getElementById('payments-tbody');
  if (tbody) {
    tbody.innerHTML = payments.map(p => {
      const isCustomer = p.type === 'Customer';
      const statusClass = p.status === 'Cleared' ? 'chip-ok' : 'chip-warn';
      return `
        <tr>
          <td class="mono">${p.ref}</td>
          <td>${p.partyName}</td>
          <td><span class="chip ${isCustomer ? 'chip-info' : 'chip-warn'}">${p.type}</span></td>
          <td>${p.date}</td>
          <td style="font-weight:600; color:${isCustomer ? 'var(--ok)' : 'var(--danger)'}">${isCustomer ? '+' : '-'} ${fmtRs(p.amount)}</td>
          <td>${p.method}</td>
          <td><span class="chip ${statusClass}">${p.status}</span></td>
        </tr>
      `;
    }).join('');
  }
}

function openRecordPaymentModal() {
  const modalBox = document.getElementById('modalBox');
  if (!modalBox) return;

  let optionsHtml = '';
  optionsHtml += `<optgroup label="Customers (Receivables)">`;
  customers.forEach(c => {
    optionsHtml += `<option value="cust_${c.id}">${c.name} (Due: ${fmtRs(c.balance)})</option>`;
  });
  optionsHtml += `</optgroup>`;
  
  optionsHtml += `<optgroup label="Suppliers (Payables)">`;
  suppliers.forEach(s => {
    optionsHtml += `<option value="supp_${s.id}">${s.name} (Due: ${fmtRs(s.outstanding)})</option>`;
  });
  optionsHtml += `</optgroup>`;

  modalBox.innerHTML = `
    <div class="modal-head"><h3>Record Payment</h3><div class="close-x" onclick="closeModal()">✕</div></div>
    <div class="modal-body">
      <div class="field"><label>Select Party</label><select id="pmt-party-select">${optionsHtml}</select></div>
      <div class="two-col">
        <div class="field"><label>Amount (Rs)</label><input type="number" id="pmt-amount-input" placeholder="Enter amount"></div>
        <div class="field"><label>Payment Method</label><select id="pmt-method-select">
          <option>Cash</option>
          <option>Bank</option>
          <option>Mobile</option>
        </select></div>
      </div>
      <div class="field"><label>Note / Reference</label><input id="pmt-note-input" placeholder="e.g. Invoice #/Cheque #"></div>
      <div class="field-error" id="pmt-error" style="display:none; color:var(--danger); font-size:12px; margin-top:8px;"></div>
    </div>
    <div class="modal-foot">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="submitPaymentForm()">Record Payment</button>
    </div>
  `;
  modalBox.style.width = '';
  document.getElementById('modalBackdrop').classList.add('active');
}

async function submitPaymentForm() {
  const partyVal = document.getElementById('pmt-party-select').value;
  const amountRaw = document.getElementById('pmt-amount-input').value.trim();
  const method = document.getElementById('pmt-method-select').value;
  const note = document.getElementById('pmt-note-input').value.trim();
  const errEl = document.getElementById('pmt-error');

  const amount = parseFloat(amountRaw) || 0;
  if (amount <= 0) {
    errEl.textContent = 'Amount must be greater than zero.';
    errEl.style.display = 'block';
    return;
  }

  const isCustomer = partyVal.startsWith('cust_');
  const id = partyVal.replace('cust_', '').replace('supp_', '');

  const c = isCustomer ? customers.find(x => x.id === id) : null;
  const s = !isCustomer ? suppliers.find(x => x.id === id) : null;
  if (isCustomer && !c) return;
  if (!isCustomer && !s) return;
  const partyName = isCustomer ? c.name : s.name;

  const paymentRecord = {
    ref: `PMT-${nextPaymentNum}`,
    partyName: partyName,
    partyId: id,
    type: isCustomer ? 'Customer' : 'Supplier',
    date: '24 Jul 2026',
    amount: amount,
    method: method,
    status: 'Cleared'
  };

  try {
    await apiFetch('/api/payments', {
      method: 'POST',
      body: JSON.stringify(paymentRecord)
    });
  } catch (err) {
    showToast('Could not save the payment to SQLite. Please try again.', 'danger');
    return;
  }

  // Only commit local state once the server has confirmed the payment was
  // persisted, so a failed save never leaves balances silently reduced for
  // a payment that doesn't actually exist.
  nextPaymentNum++;

  if (isCustomer) {
    c.balance = Math.max(0, c.balance - amount);
    c.lastTx = '24 Jul 2026';
    c.invoices.unshift({
      no: paymentRecord.ref,
      date: '24 Jul',
      amt: -amount
    });
  } else {
    s.outstanding = Math.max(0, s.outstanding - amount);
    s.history.unshift({
      no: paymentRecord.ref,
      date: '24 Jul',
      amt: -amount
    });
  }

  payments.unshift(paymentRecord);

  closeModal();
  renderPayments();
  renderCustomers();
  renderSuppliers();
  renderDashboard();

  showToast(`Recorded payment of ${fmtRs(amount)} for ${partyName}.`, 'ok');
}

