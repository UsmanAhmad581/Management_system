function renderExpenses() {
  const tbody = document.getElementById('expenses-tbody');
  if (tbody) {
    tbody.innerHTML = expenses.map(e => {
      let chipClass = 'chip-info';
      if (e.category === 'Electricity') chipClass = 'chip-warn';
      if (e.category === 'Maintenance') chipClass = 'chip-danger';
      if (e.category === 'Rent') chipClass = 'chip-ok';
      
      return `
        <tr>
          <td>${e.date}</td>
          <td><span class="chip ${chipClass}">${e.category}</span></td>
          <td>${e.desc}</td>
          <td style="font-weight:600;">${fmtRs(e.amount)}</td>
        </tr>
      `;
    }).join('');
  }

  const categories = {};
  expenses.forEach(e => {
    categories[e.category] = (categories[e.category] || 0) + e.amount;
  });

  const barsContainer = document.querySelector('#screen-expenses .bars');
  if (barsContainer) {
    const maxVal = Math.max(...Object.values(categories), 1000);
    barsContainer.innerHTML = Object.entries(categories).map(([cat, amt], idx) => {
      const pct = Math.min(100, Math.max(10, (amt / maxVal) * 100));
      const altClass = idx % 2 === 1 ? ' alt' : '';
      return `
        <div class="bar${altClass}" style="height:${pct}%;"><span>${cat}</span></div>
      `;
    }).join('');
  }
}

function openAddExpenseModal() {
  const modalBox = document.getElementById('modalBox');
  if (!modalBox) return;

  modalBox.innerHTML = `
    <div class="modal-head"><h3>Add Expense</h3><div class="close-x" onclick="closeModal()">✕</div></div>
    <div class="modal-body">
      <div class="field"><label>Category</label><select id="exp-category-select">
        <option>Electricity</option>
        <option>Salary</option>
        <option>Transport</option>
        <option>Rent</option>
        <option>Packing</option>
        <option>Internet</option>
        <option>Maintenance</option>
        <option>Other</option>
      </select></div>
      <div class="two-col">
        <div class="field"><label>Amount (Rs)</label><input type="number" id="exp-amount-input" placeholder="Amount in Rs"></div>
        <div class="field"><label>Date</label><input id="exp-date-input" value="24 Jul 2026"></div>
      </div>
      <div class="field"><label>Description / Note</label><input id="exp-desc-input" placeholder="Short explanation"></div>
      <div class="field-error" id="exp-error" style="display:none; color:var(--danger); font-size:12px; margin-top:8px;"></div>
    </div>
    <div class="modal-foot">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="submitExpenseForm()">Save Expense</button>
    </div>
  `;
  modalBox.style.width = '';
  document.getElementById('modalBackdrop').classList.add('active');
}

async function submitExpenseForm() {
  const category = document.getElementById('exp-category-select').value;
  const amountRaw = document.getElementById('exp-amount-input').value.trim();
  const date = document.getElementById('exp-date-input').value.trim();
  const desc = document.getElementById('exp-desc-input').value.trim();
  const errEl = document.getElementById('exp-error');

  const amount = parseFloat(amountRaw) || 0;
  if (amount <= 0) {
    errEl.textContent = 'Amount must be greater than zero.';
    errEl.style.display = 'block';
    return;
  }

  const expenseRecord = {
    date: date || '24 Jul 2026',
    category: category,
    desc: desc || 'Miscellaneous expense',
    amount: amount
  };

  try {
    await apiFetch('/api/expenses', {
      method: 'POST',
      body: JSON.stringify(expenseRecord)
    });
  } catch (err) {
    showToast('Could not save the expense to SQLite. Please try again.', 'danger');
    return;
  }

  expenses.unshift(expenseRecord);

  closeModal();
  renderExpenses();
  renderDashboard();

  showToast(`Recorded expense of ${fmtRs(amount)} under ${category}.`, 'ok');
}

