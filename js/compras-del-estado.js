// El tablero «Compras del Estado»: el selector de vistas y la vista de diciembre.
// Todas las cifras son DE EJEMPLO: salen de un generador con semilla, no de Mercado Público.
// Cuando estén los datos reales (gasto mensual 2007–2025 desde la descarga masiva), «datos» se lee de un JSON.
(function () {
  var reducido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- Datos de ejemplo: índice mensual 2007–2025 (1,0 = mes promedio del año) ----------
  function semilla(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  var az = semilla(2026);
  var MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  var MESES_LARGO = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  var perfil = [0.78, 0.66, 0.92, 0.96, 1.0, 0.97, 0.99, 0.96, 0.98, 1.04, 1.12, 1.62];
  var ANIOS = []; for (var a = 2007; a <= 2025; a++) ANIOS.push(a);
  var datos = ANIOS.map(function (anio, k) {
    var fila = perfil.map(function (p, m) { return p * (1 + (az() - 0.5) * 0.22) * (m === 11 ? 1 + k * 0.012 : 1); });
    if (anio === 2020) { fila[3] *= 0.75; fila[4] *= 0.8; fila[5] *= 1.25; }
    var prom = fila.reduce(function (s, v) { return s + v; }, 0) / 12;
    return fila.map(function (v) { return v / prom; });
  });
  var fmt1 = function (v) { return v.toLocaleString('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 }); };

  // ---------- Cifras del tablero, calculadas de los mismos datos ----------
  var dic = datos.map(function (f) { return f[11]; });
  var promDic = dic.reduce(function (s, v) { return s + v; }, 0) / dic.length;
  var aniosArriba = datos.filter(function (f) { return f[11] === Math.max.apply(null, f); }).length;
  var promMes = perfil.map(function (_, m) { return datos.reduce(function (s, f) { return s + f[m]; }, 0) / datos.length; });
  var mMin = promMes.indexOf(Math.min.apply(null, promMes));
  document.getElementById('respuesta').innerHTML = 'Con estos datos de ejemplo, sí: diciembre compra <b>' + fmt1(promDic) + ' veces</b> lo de un mes promedio, y la fiebre sube año a año.';
  document.getElementById('i-veces').textContent = fmt1(promDic) + '×';
  document.getElementById('i-veces-nota').textContent = 'Promedio 2007–2025. La línea es cada año, de ' + fmt1(dic[0]) + '× a ' + fmt1(dic[dic.length - 1]) + '×.';
  document.getElementById('i-anios').textContent = aniosArriba + ' de ' + ANIOS.length;
  document.getElementById('i-tranquilo').textContent = MESES_LARGO[mMin].charAt(0).toUpperCase() + MESES_LARGO[mMin].slice(1);
  document.getElementById('i-tranquilo-nota').textContent = 'Compra ' + fmt1(promMes[mMin]) + ' veces un mes promedio. Vacaciones también para las compras.';
  (function () {
    var mx = Math.max.apply(null, dic), mn = Math.min.apply(null, dic);
    var pts = dic.map(function (v, k) { return [k / (dic.length - 1) * 240, 40 - (v - mn) / (mx - mn) * 34]; });
    var d = pts.map(function (p, k) { return (k ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join(' ');
    var u = pts[pts.length - 1];
    document.getElementById('i-linea').innerHTML = '<path d="' + d + ' L240 46 L0 46 Z" fill="rgba(227,174,122,.12)"/><path d="' + d + '" fill="none" stroke="#e3ae7a" stroke-width="2" vector-effect="non-scaling-stroke"/><circle cx="' + u[0] + '" cy="' + u[1] + '" r="3.5" fill="#e3ae7a"/>';
  })();

  // ---------- El mapa de calor ----------
  var IZQ = 46, ARR = 22, CW = 40, CH = 19, G = 3, PERFIL_H = 64;
  var ancho = IZQ + 12 * (CW + G), alto = ARR + ANIOS.length * (CH + G) + 16 + PERFIL_H + 20;
  var paradas = [[0.55, [31, 42, 60]], [0.85, [61, 79, 107]], [1.15, [159, 184, 214]], [1.9, [227, 174, 122]]];
  function color(v) {
    if (v <= paradas[0][0]) return 'rgb(' + paradas[0][1] + ')';
    for (var i = 1; i < paradas.length; i++) if (v <= paradas[i][0]) {
      var t = (v - paradas[i - 1][0]) / (paradas[i][0] - paradas[i - 1][0]), a = paradas[i - 1][1], b = paradas[i][1];
      return 'rgb(' + a.map(function (c, j) { return Math.round(c + (b[j] - c) * t); }) + ')';
    }
    return 'rgb(' + paradas[paradas.length - 1][1] + ')';
  }
  var s = '<svg viewBox="0 0 ' + ancho + ' ' + alto + '" role="img" aria-label="Mapa de calor de ejemplo: índice de compras por mes, de 2007 a 2025">';
  MESES.forEach(function (m, j) { s += '<text x="' + (IZQ + j * (CW + G) + CW / 2) + '" y="14" text-anchor="middle"' + (j === 11 ? ' class="t-dic"' : '') + '>' + m + '</text>'; });
  ANIOS.forEach(function (anio, i) {
    var y = ARR + i * (CH + G);
    if (anio % 2 === 1 || i === ANIOS.length - 1) s += '<text x="' + (IZQ - 8) + '" y="' + (y + CH / 2 + 4) + '" text-anchor="end">' + anio + '</text>';
    datos[i].forEach(function (v, j) {
      s += '<rect class="celda aparece" data-f="' + i + '" data-c="' + j + '" x="' + (IZQ + j * (CW + G)) + '" y="' + y + '" width="' + CW + '" height="' + CH + '" rx="3" fill="' + color(v) + '" style="--d:' + ((i + j) * 28) + 'ms"/>';
    });
  });
  var y0 = ARR + ANIOS.length * (CH + G) + 16, mxP = Math.max.apply(null, promMes);
  s += '<text x="' + (IZQ - 8) + '" y="' + (y0 + PERFIL_H - 4) + '" text-anchor="end">prom.</text>';
  promMes.forEach(function (v, j) {
    var h = v / mxP * (PERFIL_H - 8);
    s += '<rect x="' + (IZQ + j * (CW + G) + 6) + '" y="' + (y0 + PERFIL_H - h) + '" width="' + (CW - 12) + '" height="' + h + '" rx="3" fill="' + (j === 11 ? '#e3ae7a' : '#364259') + '"/>';
    if (j === 11 || j === mMin) s += '<text x="' + (IZQ + j * (CW + G) + CW / 2) + '" y="' + (y0 + PERFIL_H - h - 6) + '" text-anchor="middle"' + (j === 11 ? ' class="t-dic"' : '') + '>' + fmt1(v) + '</text>';
  });
  s += '</svg>';
  var calor = document.getElementById('calor');
  calor.innerHTML = s;
  if (reducido) calor.querySelectorAll('.celda').forEach(function (c) { c.classList.remove('aparece'); });

  // Globo al pasar el mouse o tocar
  var globo = document.createElement('div'); globo.className = 'globo'; globo.hidden = true; calor.appendChild(globo);
  var svg = calor.querySelector('svg');
  function mostrar(c) {
    var i = +c.dataset.f, j = +c.dataset.c, v = datos[i][j];
    svg.classList.add('enfocando');
    svg.querySelectorAll('.celda').forEach(function (x) { x.classList.toggle('activa', x === c); x.classList.toggle('misma-fila', x.dataset.f === c.dataset.f); });
    globo.innerHTML = '<b>' + MESES_LARGO[j] + ' ' + ANIOS[i] + '</b><br><span class="v">' + fmt1(v) + '×</span> un mes promedio';
    var r = c.getBoundingClientRect(), base = calor.getBoundingClientRect();
    globo.style.left = (r.left - base.left + calor.scrollLeft + r.width / 2) + 'px';
    globo.style.top = (r.top - base.top) + 'px';
    globo.hidden = false;
  }
  function limpiar() { svg.classList.remove('enfocando'); globo.hidden = true; svg.querySelectorAll('.activa').forEach(function (x) { x.classList.remove('activa'); }); }
  svg.addEventListener('pointerover', function (e) { if (e.target.classList.contains('celda')) mostrar(e.target); });
  svg.addEventListener('pointerleave', limpiar);

  // ---------- El selector: cada vista con su propia dirección (#nombre) ----------
  var VISTAS = [
    { id: 'diciembre', titulo: '¿El Estado se gasta todo en diciembre?', bajada: 'El gasto de cada mes, de 2007 a 2025.', estado: 'proto',
      mini: '<svg viewBox="0 0 30 30">' + [0, 1, 2, 3].map(function (f) { return [0, 1, 2, 3].map(function (c) { return '<rect x="' + (c * 7.5 + 0.5) + '" y="' + (f * 7.5 + 0.5) + '" width="6.5" height="6.5" rx="1.5" fill="' + (c === 3 ? '#e3ae7a' : ['#2a3750', '#3d4f6b', '#55698a'][(f + c) % 3]) + '"/>'; }).join(''); }).join('') + '</svg>' },
    { id: 'quien-le-vende', titulo: '¿Quién le vende al Estado?', bajada: 'Organismo, rubro y proveedor, con el grosor en pesos.', estado: 'prep',
      mini: '<svg viewBox="0 0 30 30" fill="none"><path d="M3 8 C14 8 16 12 27 12" stroke="#e3ae7a" stroke-width="4" stroke-opacity=".8"/><path d="M3 17 C14 17 16 21 27 21" stroke="#55698a" stroke-width="3"/><path d="M3 24 C14 24 16 15 27 15" stroke="#3d4f6b" stroke-width="2.5"/></svg>' },
    { id: 'trato-directo', titulo: '¿Cuánto se compra sin licitar?', bajada: 'El trato directo de cada organismo en el tiempo.', estado: 'prep',
      mini: '<svg viewBox="0 0 30 30" fill="none"><path d="M3 24 L9 22 L15 23 L21 20 L27 19" stroke="#55698a" stroke-width="2"/><path d="M3 22 L9 21 L15 16 L21 11 L27 5" stroke="#e3ae7a" stroke-width="2.5"/><circle cx="27" cy="5" r="2.5" fill="#e3ae7a"/></svg>' }
  ];
  var ESTADOS = { proto: ['Datos de ejemplo', 'chip--proto'], prep: ['En preparación', 'chip--prep'] };
  var boton = document.getElementById('desp-boton'), lista = document.getElementById('desp-lista'), activa = 0;
  lista.innerHTML = VISTAS.map(function (t, k) {
    return '<li role="option" id="op-' + t.id + '" data-k="' + k + '" aria-selected="false"><span class="mini" aria-hidden="true">' + t.mini + '</span>' +
      '<span><span class="op-titulo">' + t.titulo + '</span><span class="op-bajada">' + t.bajada + '</span><span class="chip ' + ESTADOS[t.estado][1] + '">' + ESTADOS[t.estado][0] + '</span></span></li>';
  }).join('');
  var opciones = lista.querySelectorAll('li');
  function marcarActiva(k) { activa = (k + opciones.length) % opciones.length; opciones.forEach(function (o, j) { o.classList.toggle('activa', j === activa); }); lista.setAttribute('aria-activedescendant', opciones[activa].id); }
  function abrir() { lista.hidden = false; boton.setAttribute('aria-expanded', 'true'); marcarActiva(VISTAS.findIndex(function (t) { return t.id === elegido; })); lista.focus(); }
  function cerrar(volver) { lista.hidden = true; boton.setAttribute('aria-expanded', 'false'); if (volver) boton.focus(); }
  function elegir(k) { cerrar(true); var id = VISTAS[k].id; if (location.hash.slice(1) !== id) location.hash = id; else ver(id); }
  boton.addEventListener('click', function () { lista.hidden ? abrir() : cerrar(false); });
  boton.addEventListener('keydown', function (e) { if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); abrir(); } });
  lista.addEventListener('click', function (e) { var li = e.target.closest('li'); if (li) elegir(+li.dataset.k); });
  lista.addEventListener('mousemove', function (e) { var li = e.target.closest('li'); if (li) marcarActiva(+li.dataset.k); });
  lista.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); marcarActiva(activa + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); marcarActiva(activa - 1); }
    else if (e.key === 'Home') { e.preventDefault(); marcarActiva(0); }
    else if (e.key === 'End') { e.preventDefault(); marcarActiva(opciones.length - 1); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); elegir(activa); }
    else if (e.key === 'Escape' || e.key === 'Tab') { cerrar(e.key === 'Escape'); }
  });
  document.addEventListener('pointerdown', function (e) { if (!lista.hidden && !document.getElementById('desplegable').contains(e.target)) cerrar(false); });

  var elegido = VISTAS[0].id;
  function ver(id) {
    var t = VISTAS.filter(function (x) { return x.id === id; })[0] || VISTAS[0];
    elegido = t.id;
    document.getElementById('desp-titulo').textContent = t.titulo;
    document.getElementById('desp-estado').textContent = ESTADOS[t.estado][0];
    document.getElementById('desp-mini').innerHTML = t.mini;
    opciones.forEach(function (o, j) { o.setAttribute('aria-selected', String(VISTAS[j].id === t.id)); });
    VISTAS.forEach(function (x) {
      var sec = document.getElementById('v-' + x.id), on = x.id === t.id;
      sec.hidden = !on;
      if (on) {
        sec.querySelectorAll('.lamina, .aparece, .boceto path, .boceto line, .boceto rect, .boceto circle').forEach(function (n) { n.style.animation = 'none'; n.getBoundingClientRect(); n.style.animation = ''; });
      }
    });
  }
  window.addEventListener('hashchange', function () { ver(location.hash.slice(1)); });
  ver(location.hash.slice(1));
})();
