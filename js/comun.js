// Borde bajo la cabecera al bajar
(function () {
  var cabecera = document.querySelector('.cabecera');
  if (!cabecera) return;
  var marcar = function () { cabecera.classList.toggle('con-borde', window.scrollY > 8); };
  window.addEventListener('scroll', marcar, { passive: true });
  marcar();
})();
