// El tablero «Compras del Estado»: el selector de vistas y la vista de diciembre.
// Los datos de diciembre salen de la descarga masiva de ChileCompra (datos/diciembre.json),
// con la misma limpieza que usa Tordo. Cómo se calcularon: datos/bajar.py y datos/armar.py.
(function () {
  var reducido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  var MESES_LARGO = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  var fmt1 = function (v) { return v.toLocaleString('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 }); };
  var prom = function (xs) { xs = xs.filter(function (v) { return v != null; }); return xs.reduce(function (s, v) { return s + v; }, 0) / xs.length; };
  function pesos(v) {
    if (v >= 1e12) return '$' + fmt1(v / 1e12) + ' billones';
    return '$' + Math.round(v / 1e9).toLocaleString('es-CL') + ' mil millones';
  }

  function diciembre(D) {
    var ANIOS = D.anios;
    // Índice: el monto de cada mes dividido por el mes promedio de su año (1,0 = un mes promedio)
    var datos = D.monto.map(function (fila) { var p = prom(fila); return fila.map(function (v) { return v == null ? null : v / p; }); });

    // ---------- Cifras del tablero, calculadas de los mismos datos ----------
    var dic = datos.map(function (f) { return f[11]; });
    var promDic = prom(dic);
    var aniosArriba = datos.filter(function (f) { return f[11] === Math.max.apply(null, f.filter(function (v) { return v != null; })); }).length;
    var promMes = MESES.map(function (_, m) { return prom(datos.map(function (f) { return f[m]; })); });
    var mMin = promMes.indexOf(Math.min.apply(null, promMes));
    var primeros = prom(dic.slice(0, 5)), ultimos = prom(dic.slice(-5));
    var tramo = function (a, b) { return ANIOS[a] + '–' + ANIOS[b]; };
    // Lo mismo contando órdenes en vez de pesos: ¿se compra más seguido o más grande?
    var dicOrdenes = prom(D.ordenes.map(function (fila) { return fila[11] / prom(fila); }));
    document.getElementById('respuesta').innerHTML = (promDic >= 1.15 ? 'Sí. ' : 'No tanto. ') +
      'Diciembre compra <b>' + fmt1(promDic) + ' veces</b> lo de un mes promedio y fue el mes más alto en ' + aniosArriba + ' de los ' + ANIOS.length + ' años. ' +
      (ultimos < primeros * 0.9 ? 'Pero la fiebre se ha ido calmando: de ' + fmt1(primeros) + '× en ' + tramo(0, 4) + ' a ' + fmt1(ultimos) + '× en ' + tramo(ANIOS.length - 5, ANIOS.length - 1) + '.'
        : ultimos > primeros * 1.1 ? 'Y la fiebre creció: de ' + fmt1(primeros) + '× en ' + tramo(0, 4) + ' a ' + fmt1(ultimos) + '× en ' + tramo(ANIOS.length - 5, ANIOS.length - 1) + '.'
        : 'Y es así desde que hay datos.');
    document.getElementById('i-ordenes').textContent = fmt1(dicOrdenes) + '×';
    document.getElementById('i-ordenes-nota').textContent = 'Contando órdenes, diciembre casi no se distingue. No se compra más seguido: se compra más grande.';
    document.getElementById('i-veces').textContent = fmt1(promDic) + '×';
    document.getElementById('i-veces-nota').textContent = 'Promedio ' + ANIOS[0] + '–' + ANIOS[ANIOS.length - 1] + '. La línea es cada año, de ' + fmt1(dic[0]) + '× a ' + fmt1(dic[dic.length - 1]) + '×.';
    document.getElementById('i-anios').textContent = aniosArriba + ' de ' + ANIOS.length;
    document.getElementById('i-tranquilo').textContent = MESES_LARGO[mMin].charAt(0).toUpperCase() + MESES_LARGO[mMin].slice(1);
    document.getElementById('i-tranquilo-nota').textContent = 'Compra ' + fmt1(promMes[mMin]) + ' veces un mes promedio.' + (mMin === 1 || mMin === 0 ? ' Vacaciones también para las compras.' : '');
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
      if (v == null) return 'transparent';
      if (v <= paradas[0][0]) return 'rgb(' + paradas[0][1] + ')';
      for (var i = 1; i < paradas.length; i++) if (v <= paradas[i][0]) {
        var t = (v - paradas[i - 1][0]) / (paradas[i][0] - paradas[i - 1][0]), a = paradas[i - 1][1], b = paradas[i][1];
        return 'rgb(' + a.map(function (c, j) { return Math.round(c + (b[j] - c) * t); }) + ')';
      }
      return 'rgb(' + paradas[paradas.length - 1][1] + ')';
    }
    var s = '<svg viewBox="0 0 ' + ancho + ' ' + alto + '" role="img" aria-label="Mapa de calor: monto comprado cada mes contra el mes promedio de su año, de ' + ANIOS[0] + ' a ' + ANIOS[ANIOS.length - 1] + '">';
    MESES.forEach(function (m, j) { s += '<text x="' + (IZQ + j * (CW + G) + CW / 2) + '" y="14" text-anchor="middle"' + (j === 11 ? ' class="t-dic"' : '') + '>' + m + '</text>'; });
    ANIOS.forEach(function (anio, i) {
      var y = ARR + i * (CH + G);
      if (anio % 2 === 1 || i === ANIOS.length - 1) s += '<text x="' + (IZQ - 8) + '" y="' + (y + CH / 2 + 4) + '" text-anchor="end">' + anio + '</text>';
      datos[i].forEach(function (v, j) {
        s += '<rect class="celda aparece' + (v == null ? ' vacia' : '') + '" data-f="' + i + '" data-c="' + j + '" x="' + (IZQ + j * (CW + G)) + '" y="' + y + '" width="' + CW + '" height="' + CH + '" rx="3" fill="' + color(v) + '" style="--d:' + ((i + j) * 28) + 'ms"/>';
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

    // En pantallas angostas el mapa se desliza: se avisa, y el borde derecho se desvanece hasta llegar al final
    var desliza = document.getElementById('desliza');
    function revisarDesborde() {
      var sobra = calor.scrollWidth - calor.clientWidth;
      calor.classList.toggle('desborda', sobra > 1 && calor.scrollLeft < sobra - 2);
      desliza.hidden = !(sobra > 1);
    }
    revisarDesborde();
    calor.addEventListener('scroll', revisarDesborde, { passive: true });
    new ResizeObserver(revisarDesborde).observe(calor);

    // Globo al pasar el mouse o tocar
    var globo = document.createElement('div'); globo.className = 'globo'; globo.hidden = true; calor.appendChild(globo);
    var svg = calor.querySelector('svg');
    function mostrar(c) {
      var i = +c.dataset.f, j = +c.dataset.c, v = datos[i][j];
      svg.classList.add('enfocando');
      svg.querySelectorAll('.celda').forEach(function (x) { x.classList.toggle('activa', x === c); x.classList.toggle('misma-fila', x.dataset.f === c.dataset.f); });
      globo.innerHTML = '<b>' + MESES_LARGO[j] + ' ' + ANIOS[i] + '</b><br>' + (v == null ? 'Sin datos: ChileCompra publica este mes vacío'
        : '<span class="v">' + fmt1(v) + '×</span> un mes promedio<br>' + pesos(D.monto[i][j]) + ' en ' + D.ordenes[i][j].toLocaleString('es-CL') + ' órdenes');
      var r = c.getBoundingClientRect(), base = calor.getBoundingClientRect();
      globo.style.left = (r.left - base.left + calor.scrollLeft + r.width / 2) + 'px';
      globo.style.top = (r.top - base.top) + 'px';
      globo.hidden = false;
    }
    function limpiar() { svg.classList.remove('enfocando'); globo.hidden = true; svg.querySelectorAll('.activa').forEach(function (x) { x.classList.remove('activa'); }); }
    svg.addEventListener('pointerover', function (e) { if (e.target.classList.contains('celda')) mostrar(e.target); });
    svg.addEventListener('pointerleave', limpiar);
  }

  fetch('/tableros/compras-del-estado/datos/diciembre.json?v=2026-11-10')
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(diciembre)
    .catch(function () { document.getElementById('respuesta').textContent = 'No se pudieron cargar los datos. Prueba recargando la página.'; });

  // ---------- El selector: cada vista con su propia dirección (#nombre) ----------
  var VISTAS = [
    { id: 'diciembre', titulo: '¿El Estado se gasta todo en diciembre?', bajada: 'El gasto de cada mes, de 2007 a 2025.', estado: 'real',
      mini: '<svg viewBox="0 0 30 30">' + [0, 1, 2, 3].map(function (f) { return [0, 1, 2, 3].map(function (c) { return '<rect x="' + (c * 7.5 + 0.5) + '" y="' + (f * 7.5 + 0.5) + '" width="6.5" height="6.5" rx="1.5" fill="' + (c === 3 ? '#e3ae7a' : ['#2a3750', '#3d4f6b', '#55698a'][(f + c) % 3]) + '"/>'; }).join(''); }).join('') + '</svg>' },
    { id: 'quien-le-vende', titulo: '¿Quién le vende al Estado?', bajada: 'Organismo, rubro y proveedor, con el grosor en pesos.', estado: 'prep',
      mini: '<svg viewBox="0 0 30 30" fill="none"><path d="M3 8 C14 8 16 12 27 12" stroke="#e3ae7a" stroke-width="4" stroke-opacity=".8"/><path d="M3 17 C14 17 16 21 27 21" stroke="#55698a" stroke-width="3"/><path d="M3 24 C14 24 16 15 27 15" stroke="#3d4f6b" stroke-width="2.5"/></svg>' },
    { id: 'trato-directo', titulo: '¿Cuánto se compra sin licitar?', bajada: 'El trato directo de cada organismo en el tiempo.', estado: 'prep',
      mini: '<svg viewBox="0 0 30 30" fill="none"><path d="M3 24 L9 22 L15 23 L21 20 L27 19" stroke="#55698a" stroke-width="2"/><path d="M3 22 L9 21 L15 16 L21 11 L27 5" stroke="#e3ae7a" stroke-width="2.5"/><circle cx="27" cy="5" r="2.5" fill="#e3ae7a"/></svg>' }
  ];
  var ESTADOS = { real: ['Datos reales', 'chip--real'], prep: ['En preparación', 'chip--prep'] };
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
