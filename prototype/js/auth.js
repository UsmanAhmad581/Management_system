function toggleTheme(){
  const root = document.documentElement;
  if(root.getAttribute('data-theme')==='dark'){ root.removeAttribute('data-theme'); }
  else{ root.setAttribute('data-theme','dark'); }
}

function doLogin(){
  document.getElementById('login-screen').style.display='none';
  document.getElementById('app').classList.add('active');
  showToast('Welcome back, M. Usman — logged in successfully.', 'ok');
}
function doLogout(){
  document.getElementById('app').classList.remove('active');
  document.getElementById('login-screen').style.display='flex';
}

