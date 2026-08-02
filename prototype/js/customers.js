/* ===================== CUSTOMERS (live data + CRUD) ===================== */
let customers = [];
let nextCustomerNum = 101;
let selectedCustomerId = customers[0]?.id ?? null;
let editingCustomerId = null;
let pendingDeleteAction = null;

function custInitials(name){
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0]||'') + (parts[1]?.[0]||'')).toUpperCase() || '??';
}
function custStatus(balance){
  if(balance<=0) return {label:'Clear', cls:'chip-ok'};
  if(balance>30000) return {label:'Overdue', cls:'chip-danger'};
  return {label:'Due', cls:'chip-warn'};
}
function fmtRs(n){ return 'Rs ' + Number(n||0).toLocaleString(); }

function renderCustomers(filter=''){
  const tbody = document.getElementById('custTable');
  if(!tbody) return;
  const q = filter.trim().toLowerCase();
  const filtered = customers.filter(c=> !q || c.name.toLowerCase().includes(q) || c.phone.toLowerCase().includes(q) || c.id.toLowerCase().includes(q));

  tbody.innerHTML = filtered.length ? filtered.map(c=>{
    const st = custStatus(c.balance);
    return `<tr class="cust-row${c.id===selectedCustomerId?' sel':''}" data-id="${c.id}" onclick="selectCustomer('${c.id}')">
      <td><input type="checkbox" onclick="event.stopPropagation()"></td>
      <td class="mono">${c.id}</td>
      <td>${c.name}</td>
      <td>${c.phone}</td>
      <td>${fmtRs(c.balance)}</td>
      <td><span class="chip ${st.cls}">${st.label}</span></td>
      <td><span class="icon-action" title="Edit" onclick="event.stopPropagation(); editCustomer('${c.id}')">${i.edit}</span><span class="icon-action" title="Delete" onclick="event.stopPropagation(); deleteCustomer('${c.id}')">${i.trash}</span></td>
    </tr>`;
  }).join('') : `<tr><td colspan="7" style="text-align:center; color:var(--text-muted); padding:28px 0;">No customers found${q?` for "${filter}"`:''}.</td></tr>`;

  const pag = document.getElementById('custPagination');
  if(pag) pag.textContent = `Showing ${filtered.length} of ${customers.length} customers`;

  if(!filtered.find(c=>c.id===selectedCustomerId)){
    selectedCustomerId = filtered[0] ? filtered[0].id : null;
  }
  renderCustomerDetail();
}

function selectCustomer(id){
  selectedCustomerId = id;
  document.querySelectorAll('#custTable .cust-row').forEach(r=> r.classList.toggle('sel', r.dataset.id===id));
  renderCustomerDetail();
}

function renderCustomerDetail(){
  const panel = document.getElementById('custDetail');
  if(!panel) return;
  const c = customers.find(x=>x.id===selectedCustomerId);
  if(!c){
    panel.innerHTML = `<div style="padding:50px 0; text-align:center; color:var(--text-muted); font-size:13px;">No customer selected.</div>`;
    return;
  }
  const st = custStatus(c.balance);
  panel.innerHTML = `
    <div style="display:flex; align-items:center; gap:12px;">
      <div class="detail-avatar">${custInitials(c.name)}</div>
      <div><div style="font-weight:700; font-size:15px;">${c.name}</div><div style="font-size:12px; color:var(--text-muted);">${c.id} · ${c.type} Customer</div></div>
    </div>
    <div>
      <div class="detail-row"><span class="k">Phone</span><span class="v">${c.phone}</span></div>
      <div class="detail-row"><span class="k">Address</span><span class="v" style="text-align:right;">${c.address}</span></div>
      <div class="detail-row"><span class="k">Outstanding Balance</span><span class="v" style="color:${c.balance>0?'var(--danger)':'var(--ok)'};">${fmtRs(c.balance)} <span class="chip ${st.cls}" style="margin-left:6px;">${st.label}</span></span></div>
      <div class="detail-row"><span class="k">Total Purchases (YTD)</span><span class="v">${fmtRs(c.ytd)}</span></div>
      <div class="detail-row"><span class="k">Last Transaction</span><span class="v">${c.lastTx}</span></div>
    </div>
    <div class="section-title" style="margin-top:4px;">Recent Invoices</div>
    <table><tbody>
      ${c.invoices.length ? c.invoices.map(inv=>`<tr><td class="mono">${inv.no}</td><td>${inv.date}</td><td style="text-align:right;">${fmtRs(inv.amt)}</td></tr>`).join('') : `<tr><td colspan="3" style="text-align:center; color:var(--text-muted); padding:12px 0;">No invoices yet.</td></tr>`}
    </tbody></table>
    <button class="btn btn-primary btn-block" onclick="openModal('payment')">${i.wallet} Record Payment</button>`;
}

function openCustomerModal(id=null){
  editingCustomerId = id;
  const c = id ? customers.find(x=>x.id===id) : null;
  const title = c ? 'Edit Customer' : 'Add Customer';
  const okLabel = c ? 'Update Customer' : 'Save Customer';
  document.getElementById('modalBox').innerHTML = `
    <div class="modal-head"><h3>${title}</h3><div class="close-x" onclick="closeModal()">✕</div></div>
    <div class="modal-body">
      <div class="field"><label>Full Name</label><input id="cf-name" placeholder="e.g. Al-Rehman General Store" value="${c?c.name:''}"></div>
      <div class="two-col">
        <div class="field"><label>Phone</label><input id="cf-phone" placeholder="03xx-xxxxxxx" value="${c?c.phone:''}"></div>
        <div class="field"><label>Type</label><select id="cf-type">
          <option${c && c.type==='Retail' ? ' selected' : ''}>Retail</option>
          <option${c && c.type==='Wholesale' ? ' selected' : ''}>Wholesale</option>
        </select></div>
      </div>
      <div class="field"><label>Address</label><input id="cf-addr" placeholder="Shop / street / city" value="${c?c.address:''}"></div>
      <div class="field"><label>${c?'Outstanding Balance':'Opening Balance'}</label><input id="cf-bal" placeholder="0" value="${c?c.balance:''}"></div>
      <div class="field-error" id="cf-error"></div>
    </div>
    <div class="modal-foot">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="submitCustomerForm()">${okLabel}</button>
    </div>`;
  document.getElementById('modalBox').style.width = '';
  document.getElementById('modalBackdrop').classList.add('active');
  setTimeout(()=> document.getElementById('cf-name')?.focus(), 50);
}

function editCustomer(id){ openCustomerModal(id); }

async function submitCustomerForm(){
  const name = document.getElementById('cf-name').value.trim();
  const phone = document.getElementById('cf-phone').value.trim();
  const type = document.getElementById('cf-type').value;
  const addr = document.getElementById('cf-addr').value.trim();
  const balRaw = document.getElementById('cf-bal').value.trim();
  const errEl = document.getElementById('cf-error');
  const bal = balRaw==='' ? 0 : Number(balRaw.replace(/[^0-9.\-]/g,''));

  if(!name || !phone){
    errEl.textContent = 'Full name and phone are required.';
    errEl.style.display = 'block';
    return;
  }
  if(isNaN(bal)){
    errEl.textContent = 'Balance must be a valid number.';
    errEl.style.display = 'block';
    return;
  }

  if(editingCustomerId){
    const c = customers.find(x=>x.id===editingCustomerId);
    const updated = { ...c, name, phone, type, address: addr || c.address, balance: bal, lastTx: c.lastTx || '—' };
    try {
      await apiFetch(`/api/customers/${c.id}`, { method: 'PUT', body: JSON.stringify(updated) });
      Object.assign(c, updated);
      selectedCustomerId = c.id;
      closeModal();
      renderCustomers(document.getElementById('custSearchInput')?.value || '');
      showToast(`${name} updated successfully.`, 'ok');
    } catch (err) {
      showToast('Could not update customer in SQLite.', 'danger');
    }
  } else {
    const newC = {id:'CU-'+String(nextCustomerNum++).padStart(4,'0'), name, phone, address: addr || '—', balance: bal, type, ytd:0, lastTx:'—', invoices:[]};
    try {
      await apiFetch('/api/customers', { method: 'POST', body: JSON.stringify(newC) });
      customers.unshift(newC);
      selectedCustomerId = newC.id;
      const search = document.getElementById('custSearchInput');
      if(search) search.value = '';
      closeModal();
      renderCustomers('');
      showToast(`${name} added successfully.`, 'ok');
    } catch (err) {
      showToast('Could not add customer to SQLite.', 'danger');
    }
  }
  editingCustomerId = null;
}

function deleteCustomer(id){
  const c = customers.find(x=>x.id===id);
  if(!c) return;
  pendingDeleteAction = async () => {
    try {
      await apiFetch(`/api/customers/${id}`, { method: 'DELETE' });
      customers = customers.filter(x=>x.id!==id);
      if(selectedCustomerId===id) selectedCustomerId = customers[0] ? customers[0].id : null;
      renderCustomers(document.getElementById('custSearchInput')?.value || '');
      showToast(`${c.name} was deleted.`, 'danger');
    } catch (err) {
      showToast('Could not delete customer from SQLite.', 'danger');
    }
  };
  document.getElementById('modalBox').innerHTML = `
    <div class="modal-head"><h3>Confirm Delete</h3><div class="close-x" onclick="closeModal()">✕</div></div>
    <div class="modal-body"><p style="font-size:13.5px; color:var(--text-muted);">Delete customer <strong>${c.name}</strong> (${c.id})? This action cannot be undone.</p></div>
    <div class="modal-foot">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" style="background:var(--danger); box-shadow:none;" onclick="confirmPendingDelete()">Delete</button>
    </div>`;
  document.getElementById('modalBox').style.width = '';
  document.getElementById('modalBackdrop').classList.add('active');
}
function confirmPendingDelete(){
  closeModal();
  if(pendingDeleteAction){ pendingDeleteAction(); pendingDeleteAction = null; }
}

function refreshCustomers(){
  const search = document.getElementById('custSearchInput');
  if(search) search.value = '';
  renderCustomers('');
  showToast('Customer list refreshed.', 'ok');
}
function exportCustomers(){
  const rows = [['ID','Name','Phone','Address','Balance','Type']];
  customers.forEach(c=> rows.push([c.id, c.name, c.phone, c.address, c.balance, c.type]));
  const csv = rows.map(r=> r.map(v=> `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], {type:'text/csv'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'vsims-customers.csv'; document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
  showToast(`Exported ${customers.length} customers to CSV.`, 'ok');
}
function printCustomers(){ window.print(); }

