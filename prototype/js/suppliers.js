/* ===================== SUPPLIERS (live data + CRUD) ===================== */
let suppliers = [];
let nextSupplierNum = 1;
let selectedSupplierId = suppliers[0]?.id ?? null;
let editingSupplierId = null;

function suppStatus(amt){
  if(amt<=0) return {label:'Clear', cls:'chip-ok'};
  if(amt>100000) return {label:'Overdue', cls:'chip-danger'};
  return {label:'Due', cls:'chip-warn'};
}

function renderSuppliers(filter=''){
  const tbody = document.getElementById('suppTable');
  if(!tbody) return;
  const q = filter.trim().toLowerCase();
  const filtered = suppliers.filter(s=> !q || s.name.toLowerCase().includes(q) || s.phone.toLowerCase().includes(q) || s.id.toLowerCase().includes(q));

  tbody.innerHTML = filtered.length ? filtered.map(s=>{
    const st = suppStatus(s.outstanding);
    return `<tr class="cust-row${s.id===selectedSupplierId?' sel':''}" data-id="${s.id}" onclick="selectSupplier('${s.id}')">
      <td class="mono">${s.id}</td>
      <td>${s.name}</td>
      <td>${s.phone}</td>
      <td>${s.category}</td>
      <td>${fmtRs(s.outstanding)}</td>
      <td><span class="chip ${st.cls}">${st.label}</span></td>
      <td><span class="icon-action" title="Edit" onclick="event.stopPropagation(); editSupplier('${s.id}')">${i.edit}</span><span class="icon-action" title="Delete" onclick="event.stopPropagation(); deleteSupplier('${s.id}')">${i.trash}</span></td>
    </tr>`;
  }).join('') : `<tr><td colspan="7" style="text-align:center; color:var(--text-muted); padding:28px 0;">No suppliers found${q?` for "${filter}"`:''}.</td></tr>`;

  const pag = document.getElementById('suppPagination');
  if(pag) pag.textContent = `Showing ${filtered.length} of ${suppliers.length} suppliers`;

  if(!filtered.find(s=>s.id===selectedSupplierId)){
    selectedSupplierId = filtered[0] ? filtered[0].id : null;
  }
  renderSupplierDetail();
}

function selectSupplier(id){
  selectedSupplierId = id;
  document.querySelectorAll('#suppTable .cust-row').forEach(r=> r.classList.toggle('sel', r.dataset.id===id));
  renderSupplierDetail();
}

function renderSupplierDetail(){
  const panel = document.getElementById('suppDetail');
  if(!panel) return;
  const s = suppliers.find(x=>x.id===selectedSupplierId);
  if(!s){
    panel.innerHTML = `<div style="padding:50px 0; text-align:center; color:var(--text-muted); font-size:13px;">No supplier selected.</div>`;
    return;
  }
  const st = suppStatus(s.outstanding);
  panel.innerHTML = `
    <div style="display:flex; align-items:center; gap:12px;">
      <div class="detail-avatar">${custInitials(s.name)}</div>
      <div><div style="font-weight:700; font-size:15px;">${s.name}</div><div style="font-size:12px; color:var(--text-muted);">${s.id} · ${s.category} Supplier</div></div>
    </div>
    <div class="detail-row"><span class="k">Outstanding Amount</span><span class="v" style="color:${s.outstanding>0?'var(--secondary-dark)':'var(--ok)'};">${fmtRs(s.outstanding)} <span class="chip ${st.cls}" style="margin-left:6px;">${st.label}</span></span></div>
    <div class="detail-row"><span class="k">Total Purchases (YTD)</span><span class="v">${fmtRs(s.ytd)}</span></div>
    <div class="detail-row"><span class="k">Payment Terms</span><span class="v">${s.terms}</span></div>
    <div class="section-title">Purchase History</div>
    <table><tbody>
      ${s.history.length ? s.history.map(h=>`<tr><td class="mono">${h.no}</td><td>${h.date}</td><td style="text-align:right;">${fmtRs(h.amt)}</td></tr>`).join('') : `<tr><td colspan="3" style="text-align:center; color:var(--text-muted); padding:12px 0;">No purchases yet.</td></tr>`}
    </tbody></table>
    <button class="btn btn-primary btn-block" onclick="openModal('payment')">${i.wallet} Pay Supplier</button>`;
}

function openSupplierModal(id=null){
  editingSupplierId = id;
  const s = id ? suppliers.find(x=>x.id===id) : null;
  const title = s ? 'Edit Supplier' : 'Add Supplier';
  const okLabel = s ? 'Update Supplier' : 'Save Supplier';
  document.getElementById('modalBox').innerHTML = `
    <div class="modal-head"><h3>${title}</h3><div class="close-x" onclick="closeModal()">✕</div></div>
    <div class="modal-body">
      <div class="field"><label>Supplier Name</label><input id="sf-name" placeholder="e.g. Sindh Semolina Co." value="${s?s.name:''}"></div>
      <div class="two-col">
        <div class="field"><label>Phone</label><input id="sf-phone" value="${s?s.phone:''}"></div>
        <div class="field"><label>Category</label><select id="sf-cat">
          <option${s && s.category==='Raw Material' ? ' selected' : ''}>Raw Material</option>
          <option${s && s.category==='Packaging' ? ' selected' : ''}>Packaging</option>
        </select></div>
      </div>
      <div class="field"><label>Payment Terms</label><input id="sf-terms" placeholder="e.g. 15 days credit" value="${s?s.terms:''}"></div>
      <div class="field"><label>${s?'Outstanding Amount':'Opening Balance'}</label><input id="sf-out" placeholder="0" value="${s?s.outstanding:''}"></div>
      <div class="field-error" id="sf-error"></div>
    </div>
    <div class="modal-foot">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="submitSupplierForm()">${okLabel}</button>
    </div>`;
  document.getElementById('modalBox').style.width = '';
  document.getElementById('modalBackdrop').classList.add('active');
  setTimeout(()=> document.getElementById('sf-name')?.focus(), 50);
}
function editSupplier(id){ openSupplierModal(id); }

async function submitSupplierForm(){
  const name = document.getElementById('sf-name').value.trim();
  const phone = document.getElementById('sf-phone').value.trim();
  const category = document.getElementById('sf-cat').value;
  const terms = document.getElementById('sf-terms').value.trim();
  const outRaw = document.getElementById('sf-out').value.trim();
  const errEl = document.getElementById('sf-error');
  const out = outRaw==='' ? 0 : Number(outRaw.replace(/[^0-9.\-]/g,''));

  if(!name || !phone){
    errEl.textContent = 'Supplier name and phone are required.';
    errEl.style.display = 'block';
    return;
  }
  if(isNaN(out)){
    errEl.textContent = 'Outstanding amount must be a valid number.';
    errEl.style.display = 'block';
    return;
  }

  if(editingSupplierId){
    const s = suppliers.find(x=>x.id===editingSupplierId);
    const updated = { ...s, name, phone, category, terms: terms || s.terms, outstanding: out };
    try {
      await apiFetch(`/api/suppliers/${s.id}`, { method: 'PUT', body: JSON.stringify(updated) });
      Object.assign(s, updated);
      selectedSupplierId = s.id;
      closeModal();
      renderSuppliers(document.getElementById('suppSearchInput')?.value || '');
      showToast(`${name} updated successfully.`, 'ok');
    } catch (err) {
      showToast('Could not update supplier in SQLite.', 'danger');
    }
  } else {
    const newS = {id:'SU-'+String(nextSupplierNum++), name, phone, category, outstanding: out, ytd:0, terms: terms || '—', history:[]};
    try {
      await apiFetch('/api/suppliers', { method: 'POST', body: JSON.stringify(newS) });
      suppliers.unshift(newS);
      selectedSupplierId = newS.id;
      const search = document.getElementById('suppSearchInput');
      if(search) search.value = '';
      closeModal();
      renderSuppliers('');
      showToast(`${name} added successfully.`, 'ok');
    } catch (err) {
      showToast('Could not add supplier to SQLite.', 'danger');
    }
  }
  editingSupplierId = null;
}

function deleteSupplier(id){
  const s = suppliers.find(x=>x.id===id);
  if(!s) return;
  pendingDeleteAction = async () => {
    try {
      await apiFetch(`/api/suppliers/${id}`, { method: 'DELETE' });
      suppliers = suppliers.filter(x=>x.id!==id);
      if(selectedSupplierId===id) selectedSupplierId = suppliers[0] ? suppliers[0].id : null;
      renderSuppliers(document.getElementById('suppSearchInput')?.value || '');
      showToast(`${s.name} was deleted.`, 'danger');
    } catch (err) {
      showToast('Could not delete supplier from SQLite.', 'danger');
    }
  };
  document.getElementById('modalBox').innerHTML = `
    <div class="modal-head"><h3>Confirm Delete</h3><div class="close-x" onclick="closeModal()">✕</div></div>
    <div class="modal-body"><p style="font-size:13.5px; color:var(--text-muted);">Delete supplier <strong>${s.name}</strong> (${s.id})? This action cannot be undone.</p></div>
    <div class="modal-foot">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" style="background:var(--danger); box-shadow:none;" onclick="confirmPendingDelete()">Delete</button>
    </div>`;
  document.getElementById('modalBox').style.width = '';
  document.getElementById('modalBackdrop').classList.add('active');
}

function refreshSuppliers(){
  const search = document.getElementById('suppSearchInput');
  if(search) search.value = '';
  renderSuppliers('');
  showToast('Supplier list refreshed.', 'ok');
}
function exportSuppliers(){
  const rows = [['ID','Name','Phone','Category','Outstanding','Terms']];
  suppliers.forEach(s=> rows.push([s.id, s.name, s.phone, s.category, s.outstanding, s.terms]));
  const csv = rows.map(r=> r.map(v=> `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], {type:'text/csv'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'vsims-suppliers.csv'; document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
  showToast(`Exported ${suppliers.length} suppliers to CSV.`, 'ok');
}
function printSuppliers(){ window.print(); }

