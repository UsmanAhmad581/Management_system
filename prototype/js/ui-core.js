function openModal(key){
  const m = modals[key];
  if(!m) return;
  document.getElementById('modalBox').innerHTML = `
    <div class="modal-head"><h3>${m.title}</h3><div class="close-x" onclick="closeModal()">✕</div></div>
    <div class="modal-body">${m.body}</div>
    <div class="modal-foot">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn ${m.danger?'btn-primary':'btn-primary'}" style="${m.danger?'background:var(--danger); box-shadow:none;':''}" onclick="submitModal('${key}')">${m.ok}</button>
    </div>`;
  if(m.wide) document.getElementById('modalBox').style.width='420px';
  document.getElementById('modalBackdrop').classList.add('active');
}
function closeModal(){ document.getElementById('modalBackdrop').classList.remove('active'); }
function submitModal(key){
  closeModal();
  const m = modals[key];
  if(m.okAction){ m.okAction(); return; }
  showToast(m.title.replace('Add ','').replace('New ','').replace('Record ','') + ' saved successfully.', key==='delete'?'danger':'ok');
}
function navigateTo(screen){
  document.querySelector(`.nav-item[data-screen="${screen}"]`)?.click();
}
document.addEventListener('click', e=>{ if(e.target && e.target.id==='modalBackdrop') closeModal(); });

function showToast(msg, type){
  const el = document.createElement('div');
  el.className = 'toast' + (type==='warn'?' warn':type==='danger'?' danger':'');
  el.innerHTML = `<span>${type==='ok'?'✅':type==='warn'?'⚠️':'🗑️'}</span><span>${msg}</span>`;
  document.getElementById('toastWrap').appendChild(el);
  setTimeout(()=> el.remove(), 3500);
}
