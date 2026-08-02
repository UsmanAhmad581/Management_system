const modals = {
  purchase:{title:'New Purchase', body:`
    <div class="field"><label>Supplier</label><select><option value="">Select supplier…</option></select></div>
    <div class="two-col"><div class="field"><label>Invoice #</label><input value="PUR-1"></div><div class="field"><label>Date</label><input value="24-07-2026"></div></div>
    <div class="field"><label>Product</label><select><option value="">Select product…</option></select></div>
    <div class="two-col"><div class="field"><label>Quantity</label><input></div><div class="field"><label>Buying Price</label><input></div></div>`, ok:'Save Purchase'},
  sale:{title:'New Sale', body:`
    <div class="field"><label>Customer</label><select><option>Walk-in Customer</option></select></div>
    <div class="field"><label>Product</label><select><option value="">Select product…</option></select></div>
    <div class="two-col"><div class="field"><label>Quantity</label><input></div><div class="field"><label>Selling Price</label><input></div></div>
    <div class="field"><label>Payment Method</label><select><option>Cash</option><option>Bank</option><option>Mobile</option></select></div>`, ok:'Go to POS →', okAction:()=>navigateTo('sales')},
  payment:{title:'Record Payment', body:`
    <div class="field"><label>Party</label><select><option value="">Select customer or supplier…</option></select></div>
    <div class="two-col"><div class="field"><label>Amount</label><input placeholder="Rs"></div><div class="field"><label>Method</label><select><option>Cash</option><option>Bank</option><option>Mobile</option></select></div></div>
    <div class="field"><label>Note</label><input placeholder="Optional reference"></div>`, ok:'Record Payment'},
  expense:{title:'Add Expense', body:`
    <div class="field"><label>Category</label><select><option>Electricity</option><option>Salary</option><option>Transport</option><option>Rent</option><option>Packing</option><option>Internet</option><option>Maintenance</option><option>Other</option></select></div>
    <div class="two-col"><div class="field"><label>Amount</label><input placeholder="Rs"></div><div class="field"><label>Date</label><input value="24-07-2026"></div></div>
    <div class="field"><label>Description</label><input placeholder="Short note"></div>`, ok:'Save Expense'},
  receipt:{title:'Receipt Preview', wide:true, body:`
    <div class="receipt strand" style="margin:0 auto;">
      <div class="center" style="font-weight:700; font-size:13px;">${document.getElementById('settings-store-name')?.value || 'YOUR STORE NAME'}</div>
      <div class="center">Store address</div>
      <hr>
      <div class="rline"><span>Invoice</span><span>INV-1</span></div>
      <div class="rline"><span>Customer</span><span>Walk-in Customer</span></div>
      <hr>
      <div class="rline" style="color:var(--text-muted);">No items yet</div>
      <hr>
      <div class="rline" style="font-weight:700;"><span>Grand Total</span><span>0</span></div>
      <div class="barcode"></div>
    </div>`, ok:'Print Receipt'},
  delete:{title:'Confirm Delete', body:`<p style="font-size:13.5px; color:var(--text-muted);">This action cannot be undone. Are you sure you want to permanently delete this record?</p>`, ok:'Delete', danger:true},
};

