function renderReceiptCenter() {
  const tbody = document.getElementById('receipts-tbody');
  if (tbody) {
    tbody.innerHTML = sales.map(s => {
      return `
        <tr>
          <td class="mono">${s.invoiceNo}</td>
          <td>${s.customerName}</td>
          <td>${s.date}</td>
          <td style="font-weight:600;">${fmtRs(s.total)}</td>
          <td><span class="icon-action" style="cursor:pointer;" onclick="previewInvoiceReceipt('${s.invoiceNo}')">${i.print}</span></td>
        </tr>
      `;
    }).join('');
  }

  if (sales.length > 0) {
    previewInvoiceReceipt(sales[0].invoiceNo);
  }
}

function previewInvoiceReceipt(invoiceNo) {
  const s = sales.find(x => x.invoiceNo === invoiceNo);
  const pane = document.getElementById('receipt-preview-pane');
  if (!s || !pane) return;

  const itemsHtml = s.items.map(item => `
    <div class="rline"><span>${item.name} x${item.qty}</span><span>${Math.round(item.total).toLocaleString()}</span></div>
  `).join('');

  pane.innerHTML = `
    <div class="receipt strand" style="width:100%; border:none; box-shadow:none;">
      <div class="center" style="font-weight:700; font-size:13px;">AL-BARKAT VERMICELLI MILLS</div>
      <div class="center">Main Bazaar, Vihari, Punjab</div>
      <div class="center">0301-2345678</div>
      <hr>
      <div class="rline"><span>Invoice</span><span>${s.invoiceNo}</span></div>
      <div class="rline"><span>Customer</span><span>${s.customerName}</span></div>
      <div class="rline"><span>Date</span><span>${s.date}</span></div>
      <hr>
      ${itemsHtml}
      <hr>
      <div class="rline"><span>Subtotal</span><span>${Math.round(s.subtotal).toLocaleString()}</span></div>
      ${s.discount > 0 ? `<div class="rline"><span>Discount</span><span>-${Math.round(s.discount).toLocaleString()}</span></div>` : ''}
      <div class="rline"><span>Tax (${globalTaxRate}%)</span><span>${Math.round(s.tax).toLocaleString()}</span></div>
      <div class="rline" style="font-weight:700;"><span>Grand Total</span><span>${Math.round(s.total).toLocaleString()}</span></div>
      <div class="rline"><span>Paid</span><span>${Math.round(s.paid).toLocaleString()}</span></div>
      <div class="rline" style="font-weight:700; color:${s.due > 0 ? 'var(--danger)' : 'var(--ok)'}"><span>Due</span><span>${Math.round(s.due).toLocaleString()}</span></div>
      <hr>
      <div class="center">Thank you for your business!</div>
      <div class="barcode"></div>
    </div>
  `;
}

