/* ===================== PRODUCTS (live data + CRUD) ===================== */
let products = [];
let nextProductNum = 1;
let editingProductId = null;

function prodStatus(p){
  if(p.stock<=0) return {label:'Out of Stock', cls:'chip-danger'};
  if(p.stock<=p.minStock) return {label:'Low', cls:'chip-danger'};
  if(p.stock<=p.minStock*1.5) return {label:'Reorder', cls:'chip-warn'};
  return {label:'Healthy', cls:'chip-ok'};
}

function renderProducts(filter=''){
  const cardsWrap = document.getElementById('prodCards');
  const tbody = document.getElementById('prodTable');
  if(!tbody) return;
  const q = filter.trim().toLowerCase();
  const filtered = products.filter(p=> !q || p.name.toLowerCase().includes(q) || p.barcode.toLowerCase().includes(q) || p.category.toLowerCase().includes(q));

  if(cardsWrap){
    const cardItems = filtered.slice(0,3);
    cardsWrap.innerHTML = cardItems.length ? cardItems.map(p=>{
      const st = prodStatus(p);
      return `<div class="card product-card">
        <div class="product-thumb">${i.box}</div>
        <div class="product-name">${p.name}</div>
        <div class="product-meta mono">${p.barcode} · ${p.category}</div>
        <div class="price-row"><span class="price">${p.sellPrice!=null?fmtRs(p.sellPrice):'—'}</span><span class="chip ${st.cls}">${st.label==='Reorder'?'Reorder Soon':st.label}</span></div>
        <div class="product-meta">Stock: ${p.stock.toLocaleString()} · Min: ${p.minStock.toLocaleString()}</div>
      </div>`;
    }).join('') : `<div class="card card-pad" style="text-align:center; color:var(--text-muted); grid-column:1/-1;">No products found${q?` for "${filter}"`:''}.</div>`;
  }

  tbody.innerHTML = filtered.length ? filtered.map(p=>{
    const st = prodStatus(p);
    return `<tr>
      <td>${i.box}</td>
      <td>${p.name}</td>
      <td>${p.category}</td>
      <td>${fmtRs(p.buyPrice)}</td>
      <td>${p.sellPrice!=null?fmtRs(p.sellPrice):'—'}</td>
      <td>${p.stock.toLocaleString()}</td>
      <td><span class="chip ${st.cls}">${st.label}</span></td>
      <td><span class="icon-action" title="Edit" onclick="editProduct('${p.id}')">${i.edit}</span><span class="icon-action" title="Delete" onclick="deleteProduct('${p.id}')">${i.trash}</span></td>
    </tr>`;
  }).join('') : `<tr><td colspan="8" style="text-align:center; color:var(--text-muted); padding:28px 0;">No products found${q?` for "${filter}"`:''}.</td></tr>`;

  const pag = document.getElementById('prodPagination');
  if(pag) pag.textContent = `Showing ${filtered.length} of ${products.length} products`;
}

function openProductModal(id=null){
  editingProductId = id;
  const p = id ? products.find(x=>x.id===id) : null;
  const title = p ? 'Edit Product' : 'Add Product';
  const okLabel = p ? 'Update Product' : 'Save Product';
  document.getElementById('modalBox').innerHTML = `
    <div class="modal-head"><h3>${title}</h3><div class="close-x" onclick="closeModal()">✕</div></div>
    <div class="modal-body">
      <div class="field"><label>Product Name</label><input id="pf-name" placeholder="e.g. Vermicelli 400g Roasted" value="${p?p.name:''}"></div>
      <div class="two-col">
        <div class="field"><label>Barcode</label><input id="pf-barcode" class="mono" value="${p?p.barcode:''}"></div>
        <div class="field"><label>Category</label><select id="pf-cat">
          <option${p && p.category==='Finished Good' ? ' selected' : ''}>Finished Good</option>
          <option${p && p.category==='Raw Material' ? ' selected' : ''}>Raw Material</option>
          <option${p && p.category==='Packaging' ? ' selected' : ''}>Packaging</option>
        </select></div>
      </div>
      <div class="two-col">
        <div class="field"><label>Buying Price</label><input id="pf-buy" placeholder="Rs" value="${p?p.buyPrice:''}"></div>
        <div class="field"><label>Selling Price</label><input id="pf-sell" placeholder="Rs (optional)" value="${p&&p.sellPrice!=null?p.sellPrice:''}"></div>
      </div>
      <div class="two-col">
        <div class="field"><label>Available Stock</label><input id="pf-stock" value="${p?p.stock:''}"></div>
        <div class="field"><label>Minimum Stock</label><input id="pf-min" value="${p?p.minStock:''}"></div>
      </div>
      <div class="field-error" id="pf-error"></div>
    </div>
    <div class="modal-foot">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="submitProductForm()">${okLabel}</button>
    </div>`;
  document.getElementById('modalBox').style.width = '';
  document.getElementById('modalBackdrop').classList.add('active');
  setTimeout(()=> document.getElementById('pf-name')?.focus(), 50);
}
function editProduct(id){ openProductModal(id); }

async function submitProductForm(){
  const name = document.getElementById('pf-name').value.trim();
  const barcode = document.getElementById('pf-barcode').value.trim();
  const category = document.getElementById('pf-cat').value;
  const buyRaw = document.getElementById('pf-buy').value.trim();
  const sellRaw = document.getElementById('pf-sell').value.trim();
  const stockRaw = document.getElementById('pf-stock').value.trim();
  const minRaw = document.getElementById('pf-min').value.trim();
  const errEl = document.getElementById('pf-error');

  const buyPrice = Number(buyRaw.replace(/[^0-9.\-]/g,''));
  const sellPrice = sellRaw==='' ? null : Number(sellRaw.replace(/[^0-9.\-]/g,''));
  const stock = stockRaw==='' ? 0 : Number(stockRaw.replace(/[^0-9.\-]/g,''));
  const minStock = minRaw==='' ? 0 : Number(minRaw.replace(/[^0-9.\-]/g,''));

  if(!name || !barcode){
    errEl.textContent = 'Product name and barcode are required.';
    errEl.style.display = 'block';
    return;
  }
  if(isNaN(buyPrice) || (sellPrice!==null && isNaN(sellPrice)) || isNaN(stock) || isNaN(minStock)){
    errEl.textContent = 'Prices, stock, and minimum stock must be valid numbers.';
    errEl.style.display = 'block';
    return;
  }

  if(editingProductId){
    const p = products.find(x=>x.id===editingProductId);
    const updated = { ...p, name, barcode, category, buyPrice, sellPrice, stock, minStock };
    try {
      await apiFetch(`/api/products/${p.id}`, { method: 'PUT', body: JSON.stringify(updated) });
      Object.assign(p, updated);
      closeModal();
      renderProducts(document.getElementById('prodSearchInput')?.value || '');
      showToast(`${name} updated successfully.`, 'ok');
    } catch (err) {
      showToast('Could not update product in SQLite.', 'danger');
    }
  } else {
    const newP = {id:'PR-'+String(nextProductNum++), barcode, name, category, buyPrice, sellPrice, stock, minStock};
    try {
      await apiFetch('/api/products', { method: 'POST', body: JSON.stringify(newP) });
      products.unshift(newP);
      const search = document.getElementById('prodSearchInput');
      if(search) search.value = '';
      closeModal();
      renderProducts('');
      showToast(`${name} added successfully.`, 'ok');
    } catch (err) {
      showToast('Could not add product to SQLite.', 'danger');
    }
  }
  editingProductId = null;
}

function deleteProduct(id){
  const p = products.find(x=>x.id===id);
  if(!p) return;
  pendingDeleteAction = async () => {
    try {
      await apiFetch(`/api/products/${id}`, { method: 'DELETE' });
      products = products.filter(x=>x.id!==id);
      renderProducts(document.getElementById('prodSearchInput')?.value || '');
      showToast(`${p.name} was deleted.`, 'danger');
    } catch (err) {
      showToast('Could not delete product from SQLite.', 'danger');
    }
  };
  document.getElementById('modalBox').innerHTML = `
    <div class="modal-head"><h3>Confirm Delete</h3><div class="close-x" onclick="closeModal()">✕</div></div>
    <div class="modal-body"><p style="font-size:13.5px; color:var(--text-muted);">Delete product <strong>${p.name}</strong>? This action cannot be undone.</p></div>
    <div class="modal-foot">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" style="background:var(--danger); box-shadow:none;" onclick="confirmPendingDelete()">Delete</button>
    </div>`;
  document.getElementById('modalBox').style.width = '';
  document.getElementById('modalBackdrop').classList.add('active');
}

function refreshProducts(){
  const search = document.getElementById('prodSearchInput');
  if(search) search.value = '';
  renderProducts('');
  showToast('Product list refreshed.', 'ok');
}
function exportProducts(){
  const rows = [['ID','Barcode','Name','Category','Buying Price','Selling Price','Stock','Min Stock']];
  products.forEach(p=> rows.push([p.id, p.barcode, p.name, p.category, p.buyPrice, p.sellPrice ?? '', p.stock, p.minStock]));
  const csv = rows.map(r=> r.map(v=> `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], {type:'text/csv'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'vsims-products.csv'; document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
  showToast(`Exported ${products.length} products to CSV.`, 'ok');
}
function printBarcodes(){ showToast('Sending selected barcodes to the label printer…', 'ok'); }

