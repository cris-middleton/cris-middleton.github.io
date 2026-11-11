// El tablero «Compras del Estado»: el selector de vistas y una función por vista (diciembre, sin licitar, quién le vende).
// Los datos salen de la descarga masiva de ChileCompra (datos/*.json),
// con la misma limpieza que usa Tordo. Cómo se calcularon: datos/bajar.py y los datos/armar*.py.
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
  var pct = function (v) { return fmt1(v * 100) + ' %'; };
  var suma = function (xs) { return xs.reduce(function (s, v) { return s + v; }, 0); };

  // La línea chica de un indicador: la serie entera, con el último punto marcado
  function linea(id, xs) {
    var mx = Math.max.apply(null, xs), mn = Math.min.apply(null, xs);
    var pts = xs.map(function (v, k) { return [k / (xs.length - 1) * 240, 40 - (v - mn) / (mx - mn) * 34]; });
    var d = pts.map(function (p, k) { return (k ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join(' ');
    var u = pts[pts.length - 1];
    document.getElementById(id).innerHTML = '<path d="' + d + ' L240 46 L0 46 Z" fill="rgba(227,174,122,.12)"/><path d="' + d + '" fill="none" stroke="#e3ae7a" stroke-width="2" vector-effect="non-scaling-stroke"/><circle cx="' + u[0] + '" cy="' + u[1] + '" r="3.5" fill="#e3ae7a"/>';
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
    linea('i-linea', dic);

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

  function sinLicitar(D) {
    var A = D.anios, M = D.monto, n = A.length, u = n - 1;
    // Las tres capas de la barra, de abajo hacia arriba (colores validados contra el fondo, también para daltonismo)
    var CAPAS = [
      { k: ['emergencia'], nombre: 'Trato directo por emergencia', color: '#c0834c' },
      { k: ['unico', 'directo'], nombre: 'Trato directo por otras causales', color: '#4a8fe0' },
      { k: ['agil'], nombre: 'Compra ágil', color: '#1f9f74' }
    ];
    var EVENTOS = { 2010: 'Terremoto', 2020: 'Pandemia', 2025: 'Ley nueva' };
    var total = A.map(function (_, i) { return suma(Object.keys(M).map(function (f) { return M[f][i]; })); });
    var capa = CAPAS.map(function (c) { return A.map(function (_, i) { return suma(c.k.map(function (f) { return M[f][i]; })) / total[i]; }); });
    var sin = A.map(function (_, i) { return suma(capa.map(function (c) { return c[i]; })); });
    var iMax = sin.indexOf(Math.max.apply(null, sin)), iEm = capa[0].indexOf(Math.max.apply(null, capa[0]));
    var i2010 = A.indexOf(2010);

    // ---------- La respuesta y los indicadores, calculados de los mismos datos ----------
    var uno = Math.round(1 / sin[u]);
    document.getElementById('sl-respuesta').innerHTML = '<b>Uno de cada ' + ['', '', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez'][uno] + ' pesos.</b> ' +
      'En ' + A[u] + ', el ' + pct(sin[u]) + ' de lo que compró el Estado fue por trato directo o compra ágil. ' +
      'El máximo fue ' + A[iMax] + ', con ' + pct(sin[iMax]) + (EVENTOS[A[iMax]] ? ': la ' + EVENTOS[A[iMax]].toLowerCase() : '') + '. ' +
      'El otro salto, el terremoto de 2010. Los dos, por compras de emergencia.';
    document.getElementById('sl-ultimo-etq').textContent = 'Sin licitar en ' + A[u];
    document.getElementById('sl-ultimo').textContent = pct(sin[u]);
    linea('sl-linea', sin);
    document.getElementById('sl-ultimo-nota').textContent = 'De ' + pct(sin[0]) + ' en ' + A[0] + ' a ' + pct(sin[iMax]) + ' en ' + A[iMax] + '.' +
      (sin[u] < sin[iMax] * 0.85 ? ' Desde ahí, bajando.' : '');
    document.getElementById('sl-emergencia').textContent = pct(capa[0][iEm]);
    document.getElementById('sl-emergencia-nota').textContent = A[iEm] + (EVENTOS[A[iEm]] ? ', la ' + EVENTOS[A[iEm]].toLowerCase() : '') + '. En 2010, el terremoto: ' + pct(capa[0][i2010]) + '.';
    var sector = function (nombre) { return D.sectores.filter(function (x) { return x.sector === nombre; })[0]; };
    var parte = function (x) { return Math.round(x.sin / x.total * 100) + ' %'; };
    var tramo = D.recientes[0] + ' y ' + D.recientes[1];
    document.getElementById('sl-salud').textContent = parte(sector('Salud'));
    document.getElementById('sl-salud-nota').textContent = 'De lo que compró entre ' + tramo + '. Municipios, ' + parte(sector('Municipalidades')) + '; Obras Públicas, ' + parte(sector('Obras Públicas')) + '.';
    document.getElementById('sl-mitad').textContent = D.mitad.organismos + ' de ' + D.mitad.de.toLocaleString('es-CL');
    var primero = D.organismos[0];
    document.getElementById('sl-mitad-nota').textContent = 'organismos suman la mitad de lo comprado sin licitar entre ' + tramo + '. ' + (primero.corto || primero.nombre) + ' sola, ' + pesos(primero.sin) + '.';

    // ---------- Los que más compran sin licitar ----------
    document.getElementById('sl-titulo-org').textContent = 'Los que más compraron sin licitar, ' + D.recientes[0] + '–' + D.recientes[1];
    var top = D.organismos.slice(0, 8);
    document.getElementById('sl-ranking').innerHTML = top.map(function (o) {
      return '<li><span class="r-nombre">' + (o.corto || o.nombre) + '</span><span class="r-barra" aria-hidden="true"><i style="width:' + (o.sin / top[0].sin * 100).toFixed(1) + '%"></i></span>' +
        '<span class="r-valor"><b>' + pesos(o.sin) + '</b>' + Math.round(o.sin / o.total * 100) + ' % de lo que compra</span></li>';
    }).join('');

    // ---------- Las barras: se dibujan al ancho real, para que el texto no se achique en el teléfono ----------
    var lienzo = document.getElementById('sl-barras');
    var globo = document.createElement('div'); globo.className = 'globo'; globo.hidden = true;
    var tope = Math.ceil(Math.max.apply(null, sin) * 10) / 10;
    var W0 = function () { return lienzo.clientWidth; };
    function dibujar() {
      var angosto = W0() < 520;
      var W = Math.max(lienzo.clientWidth, 300), H = angosto ? 306 : 290, IZQ = 42, ARR = 28, ABA = angosto ? 58 : 42;
      var paso = (W - IZQ) / n, ancho = Math.min(26, paso * 0.66), y = function (v) { return ARR + (1 - v / tope) * (H - ARR - ABA); };
      var bx = function (j) { return IZQ + j * paso + (paso - ancho) / 2; }, kEvento = 0;
      var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" role="img" aria-label="Barras: parte del gasto de cada año comprada sin licitar, de ' + A[0] + ' a ' + A[u] + '">';
      for (var g = 0; g <= tope + 1e-9; g += 0.1) s += '<line class="rejilla" x1="' + IZQ + '" x2="' + W + '" y1="' + y(g) + '" y2="' + y(g) + '"/><text x="' + (IZQ - 6) + '" y="' + (y(g) + 4) + '" text-anchor="end">' + Math.round(g * 100) + ' %</text>';
      A.forEach(function (anio, i) {
        var x = IZQ + i * paso + (paso - ancho) / 2, base = 0;
        s += '<g class="col" data-i="' + i + '">';
        capa.forEach(function (c, k) {
          var y1 = y(base + c[i]), y0 = y(base), h = y0 - y1 - (k ? 2 : 0);   // 2 px de fondo entre capas
          if (h > 0.5) s += '<rect class="aparece" x="' + x.toFixed(1) + '" y="' + y1.toFixed(1) + '" width="' + ancho.toFixed(1) + '" height="' + h.toFixed(1) + '" rx="2" fill="' + CAPAS[k].color + '" style="--d:' + (i * 35) + 'ms"/>';
          base += c[i];
        });
        if (EVENTOS[anio] || (i === 0 && !angosto)) {   // en el teléfono el primer año choca con el eje; está en el indicador
          // El valor, por encima de las barras que tapa a lo ancho (en el teléfono, las vecinas); el nombre del evento, bajo el año
          var fin = i === u, tx = fin ? x + ancho : x + ancho / 2, ancla = fin ? 'end' : 'middle';
          var t0 = tx - (fin ? 28 : 14) + 3, t1 = tx + (fin ? 0 : 14) - 3;   // el texto «29 %» mide ~28 px; 3 px de holgura
          var tapa = sin.filter(function (_, j) { return bx(j) < t1 && bx(j) + ancho > t0; });
          s += '<text class="t-valor" x="' + tx + '" y="' + (y(Math.max.apply(null, tapa)) - 8) + '" text-anchor="' + ancla + '">' + Math.round(sin[i] * 100) + ' %</text>';
          // En el teléfono los eventos van en dos filas alternadas: «Pandemia» y «Ley nueva» no caben lado a lado
          if (EVENTOS[anio]) s += '<text class="t-evento" x="' + tx + '" y="' + (H - 4 - (angosto && kEvento++ % 2 === 1 ? 0 : angosto ? 16 : 0)) + '" text-anchor="' + ancla + '">' + EVENTOS[anio] + '</text>';
        }
        if (!angosto || i % 3 === 0) s += '<text x="' + (i === u ? x + ancho : x + ancho / 2) + '" y="' + (H - ABA + 18) + '" text-anchor="' + (i === u ? 'end' : 'middle') + '">' + (angosto || i === 0 || i === u ? anio : '’' + String(anio).slice(2)) + '</text>';
        s += '<rect class="blanco" x="' + (IZQ + i * paso) + '" y="' + ARR + '" width="' + paso + '" height="' + (H - ARR - ABA) + '"/></g>';
      });
      lienzo.innerHTML = s + '</svg>';
      lienzo.appendChild(globo);
      if (reducido) lienzo.querySelectorAll('.aparece').forEach(function (r) { r.classList.remove('aparece'); });
      var svg = lienzo.querySelector('svg');
      svg.addEventListener('pointerover', function (e) {
        var col = e.target.closest('.col'); if (!col) return;
        var i = +col.dataset.i;
        svg.classList.add('enfocando');
        svg.querySelectorAll('.col').forEach(function (c) { c.classList.toggle('activa', c === col); });
        globo.innerHTML = '<b>' + A[i] + '</b> · <span class="v">' + pct(sin[i]) + '</span> sin licitar<br>' +
          CAPAS.map(function (c, k) { return '<i class="punto" style="--c:' + c.color + '"></i>' + c.nombre + ': ' + pct(capa[k][i]); }).join('<br>') +
          '<br>' + pesos(sin[i] * total[i]) + ' de ' + pesos(total[i]);
        var x = IZQ + i * paso + paso / 2;
        globo.style.left = Math.min(Math.max(x, 130), W - 130) + 'px';
        globo.style.top = y(sin[i]) + 'px';
        globo.hidden = false;
      });
      svg.addEventListener('pointerleave', function () { svg.classList.remove('enfocando'); globo.hidden = true; });
    }
    var ultimoAncho = 0;
    new ResizeObserver(function () { if (lienzo.clientWidth && lienzo.clientWidth !== ultimoAncho) { ultimoAncho = lienzo.clientWidth; dibujar(); } }).observe(lienzo);
  }

  function quienVende(D) {
    var P = D.por_anio, u = P.length - 1, ult = P[u], pri = P[0];
    var fmt0 = function (v) { return Math.round(v).toLocaleString('es-CL'); };
    var mediana = function (xs) { xs = xs.slice().sort(function (a, b) { return a - b; }); var m = xs.length >> 1; return xs.length % 2 ? xs[m] : (xs[m - 1] + xs[m]) / 2; };
    var O = D.organismos, parte5 = O.map(function (o) { return o.top5 / o.total; });
    var med5 = mediana(parte5), medProv = mediana(O.map(function (o) { return o.proveedores; }));
    var grandes = D.mercados.filter(function (m) { return m.total > 50e9; }).sort(function (a, b) { return b.parte - a.parte; });
    var personas = P.map(function (r) { return r.personas / r.proveedores; });
    var tramo = D.recientes[0] + ' y ' + D.recientes[1];

    // ---------- La respuesta y los indicadores ----------
    document.getElementById('qv-respuesta').innerHTML = '<b>Miles de proveedores, y cada vez menos personas.</b> En ' + ult.anio + ' le vendieron ' + fmt0(ult.proveedores) +
      ' proveedores, y los diez más grandes se llevaron apenas el ' + pct(ult.monto_top10 / ult.monto) + '. La concentración está dentro de cada organismo: en uno típico, cinco proveedores se llevan el ' + Math.round(med5 * 100) + ' % de lo que compra.';
    document.getElementById('qv-prov-etq').textContent = 'Proveedores en ' + ult.anio;
    document.getElementById('qv-prov').textContent = fmt0(ult.proveedores);
    document.getElementById('qv-prov-nota').textContent = 'Le vendieron al menos una vez. Los diez más grandes se llevaron el ' + pct(ult.monto_top10 / ult.monto) + ' de la plata.';
    document.getElementById('qv-personas').textContent = Math.round(personas[u] * 100) + ' %';
    linea('qv-linea', personas);
    document.getElementById('qv-personas-nota').textContent = 'de los proveedores de ' + ult.anio + '. En ' + pri.anio + ' eran el ' + Math.round(personas[0] * 100) + ' % y se llevaban el ' +
      Math.round(pri.monto_personas / pri.monto * 100) + ' % de la plata; ahora, el ' + Math.round(ult.monto_personas / ult.monto * 100) + ' %.';
    document.getElementById('qv-tipico').textContent = fmt0(medProv);
    document.getElementById('qv-tipico-nota').textContent = 'proveedores le venden a un organismo típico entre ' + tramo + ', pero cinco de ellos se llevan el ' + Math.round(med5 * 100) + ' % de lo que compra.';
    var g0 = grandes[0];
    document.getElementById('qv-duenio').textContent = Math.round(g0.parte * 100) + ' %';
    document.getElementById('qv-duenio-nota').textContent = 'de los ' + g0.rubro.toLowerCase() + ' que compra el Estado se los vende ' + (g0.lider || 'un solo proveedor') + '. En ningún otro mercado de más de $50.000 millones el más grande pasa del ' + Math.round(grandes[1].parte * 100) + ' %.';

    // ---------- Los que más le han vendido: una fila con su línea por año ----------
    document.getElementById('qv-titulo-top').textContent = 'Los que más le han vendido, ' + D.anios[0] + '–' + D.anios[D.anios.length - 1];
    var lista = document.getElementById('qv-top');
    lista.innerHTML = D.top.map(function (t, k) {
      var mx = Math.max.apply(null, t.serie), n = t.serie.length;
      var pts = t.serie.map(function (v, j) { return [j / (n - 1) * 200, 26 - v / mx * 22]; });
      var d = pts.map(function (q, j) { return (j ? 'L' : 'M') + q[0].toFixed(1) + ' ' + q[1].toFixed(1); }).join(' '), z = pts[n - 1];
      return '<li><span class="tp-nombre"><b>' + t.nombre + '</b><small>' + t.rubro + '</small></span>' +
        '<svg class="tp-linea" data-k="' + k + '" viewBox="0 0 200 30" preserveAspectRatio="none" aria-hidden="true"><path d="' + d + ' L200 30 L0 30 Z" fill="rgba(159,184,214,.14)"/>' +
        '<path d="' + d + '" fill="none" stroke="#9fb8d6" stroke-width="1.6" vector-effect="non-scaling-stroke"/><circle cx="' + z[0] + '" cy="' + z[1] + '" r="2.5" fill="#9fb8d6"/></svg>' +
        '<span class="tp-total">' + pesos(t.total) + '</span></li>';
    }).join('');
    var globoTop = document.createElement('div'); globoTop.className = 'globo'; globoTop.hidden = true; lista.appendChild(globoTop);
    lista.addEventListener('pointermove', function (e) {
      var sv = e.target.closest('.tp-linea'); if (!sv) { globoTop.hidden = true; return; }
      var r = sv.getBoundingClientRect(), base = lista.getBoundingClientRect(), t = D.top[+sv.dataset.k];
      var j = Math.max(0, Math.min(D.anios.length - 1, Math.round((e.clientX - r.left) / r.width * (D.anios.length - 1))));
      globoTop.innerHTML = '<b>' + t.nombre + ', ' + D.anios[j] + '</b><br>' + pesos(t.serie[j]);
      globoTop.style.left = (r.left - base.left + j / (D.anios.length - 1) * r.width) + 'px';
      globoTop.style.top = (r.top - base.top) + 'px';
      globoTop.hidden = false;
    });
    lista.addEventListener('pointerleave', function () { globoTop.hidden = true; });

    // ---------- Organismos: lo que compran contra lo que se llevan sus cinco proveedores más grandes ----------
    document.getElementById('qv-titulo-org').textContent = 'Cuánto se llevan los cinco proveedores más grandes de cada organismo, ' + D.recientes[0] + '–' + D.recientes[1];
    var CORTOS = [[/^Central de Abastecimiento/, 'Cenabast'], [/^Fondo Nacional de Salud/, 'Fonasa'], [/^SERVIU Region de Magallanes/, 'Serviu Magallanes']];
    var corto = function (o) { for (var c = 0; c < CORTOS.length; c++) if (CORTOS[c][0].test(o.nombre)) return CORTOS[c][1]; return null; };
    var lienzo = document.getElementById('qv-puntos'), globo = document.createElement('div'); globo.className = 'globo'; globo.hidden = true;
    var xMin = 9, xMax = Math.log10(Math.max.apply(null, O.map(function (o) { return o.total; })));
    function dibujar() {
      var W = Math.max(lienzo.clientWidth, 300), H = W < 520 ? 300 : 340, IZQ = 42, DER = 12, ARR = 14, ABA = 30;
      var X = function (v) { return IZQ + (Math.log10(v) - xMin) / (xMax - xMin) * (W - IZQ - DER); }, Y = function (p) { return ARR + (1 - p) * (H - ARR - ABA); };
      var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" role="img" aria-label="Puntos: ' + O.length + ' organismos según cuánto compran y qué parte se llevan sus cinco proveedores más grandes">';
      [0, .25, .5, .75, 1].forEach(function (p) { s += '<line class="rejilla" x1="' + IZQ + '" x2="' + W + '" y1="' + Y(p) + '" y2="' + Y(p) + '"/><text x="' + (IZQ - 6) + '" y="' + (Y(p) + 4) + '" text-anchor="end">' + p * 100 + ' %</text>'; });
      [[1e9, '$1.000 M'], [1e10, '$10.000 M'], [1e11, '$100.000 M'], [1e12, '$1 billón']].forEach(function (t, k) {
        if (W < 520 && k % 2) return;
        s += '<text x="' + X(t[0]) + '" y="' + (H - 8) + '" text-anchor="' + (k ? 'middle' : 'start') + '">' + t[1] + '</text>';
      });
      s += '<line class="mediana" x1="' + IZQ + '" x2="' + W + '" y1="' + Y(med5) + '" y2="' + Y(med5) + '"/><text class="t-mediana" x="' + (W - DER) + '" y="' + (Y(med5) - 6) + '" text-anchor="end">Mediana: ' + Math.round(med5 * 100) + ' %</text>';
      var pos = O.map(function (o, k) { return [X(o.total), Y(parte5[k])]; });
      // Los chicos primero, para que los grandes queden encima
      for (var k = O.length - 1; k >= 0; k--) s += '<circle class="punto' + (corto(O[k]) ? ' punto--nombrado' : '') + '" cx="' + pos[k][0].toFixed(1) + '" cy="' + pos[k][1].toFixed(1) + '" r="3.5"/>';
      O.forEach(function (o, k) {
        var c = corto(o); if (!c) return;
        var der = pos[k][0] > W - 110;
        s += '<text class="t-nombre" x="' + (pos[k][0] + (der ? -8 : 8)) + '" y="' + (pos[k][1] + 4) + '" text-anchor="' + (der ? 'end' : 'start') + '">' + c + '</text>';
      });
      s += '<circle class="punto-activo" r="6" hidden/></svg>';
      lienzo.innerHTML = s; lienzo.appendChild(globo);
      var svg = lienzo.querySelector('svg'), activo = svg.querySelector('.punto-activo');
      svg.addEventListener('pointermove', function (e) {
        var r = svg.getBoundingClientRect(), mx = (e.clientX - r.left) * W / r.width, my = (e.clientY - r.top) * H / r.height, mejor = -1, dist = 14 * 14;
        pos.forEach(function (q, k) { var dd = (q[0] - mx) * (q[0] - mx) + (q[1] - my) * (q[1] - my); if (dd < dist) { dist = dd; mejor = k; } });
        if (mejor < 0) { globo.hidden = true; activo.setAttribute('hidden', ''); return; }
        var o = O[mejor];
        activo.setAttribute('cx', pos[mejor][0]); activo.setAttribute('cy', pos[mejor][1]); activo.removeAttribute('hidden');
        globo.innerHTML = '<b>' + (corto(o) || o.nombre) + '</b><br>Compró ' + pesos(o.total) + ' a ' + fmt0(o.proveedores) + ' proveedores<br><span class="v">' + Math.round(parte5[mejor] * 100) + ' %</span> para los cinco más grandes';
        globo.style.left = Math.min(Math.max(pos[mejor][0] * r.width / W, 140), r.width - 140) + 'px';
        globo.style.top = (pos[mejor][1] * r.height / H) + 'px';
        globo.hidden = false;
      });
      svg.addEventListener('pointerleave', function () { globo.hidden = true; activo.setAttribute('hidden', ''); });
    }
    var ultimoAncho = 0;
    new ResizeObserver(function () { if (lienzo.clientWidth && lienzo.clientWidth !== ultimoAncho) { ultimoAncho = lienzo.clientWidth; dibujar(); } }).observe(lienzo);
  }

  function cargar(archivo, dibujo, avisarEn) {
    fetch('/tableros/compras-del-estado/datos/' + archivo + '?v=2026-11-11b')
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(dibujo)
      .catch(function () { document.getElementById(avisarEn).textContent = 'No se pudieron cargar los datos. Prueba recargando la página.'; });
  }
  cargar('diciembre.json', diciembre, 'respuesta');
  cargar('sin-licitar.json', sinLicitar, 'sl-respuesta');
  cargar('quien-vende.json', quienVende, 'qv-respuesta');

  // ---------- El selector: cada vista con su propia dirección (#nombre) ----------
  var VISTAS = [
    { id: 'diciembre', titulo: '¿El Estado se gasta todo en diciembre?', bajada: 'El gasto de cada mes, de 2007 a 2025.', estado: 'real',
      mini: '<svg viewBox="0 0 30 30">' + [0, 1, 2, 3].map(function (f) { return [0, 1, 2, 3].map(function (c) { return '<rect x="' + (c * 7.5 + 0.5) + '" y="' + (f * 7.5 + 0.5) + '" width="6.5" height="6.5" rx="1.5" fill="' + (c === 3 ? '#e3ae7a' : ['#2a3750', '#3d4f6b', '#55698a'][(f + c) % 3]) + '"/>'; }).join(''); }).join('') + '</svg>' },
    { id: 'trato-directo', titulo: '¿Cuánto se compra sin licitar?', bajada: 'Trato directo y compra ágil, de 2007 a 2025.', estado: 'real',
      mini: '<svg viewBox="0 0 30 30">' + [[9, 5, 2], [8, 6, 3], [15, 7, 2], [10, 9, 6]].map(function (b, c) { var y = 27, r = ''; b.forEach(function (h, k) { y -= h; r += '<rect x="' + (c * 7 + 2) + '" y="' + y + '" width="5" height="' + (h - 1) + '" rx="1" fill="' + ['#c0834c', '#4a8fe0', '#1f9f74'][k] + '"/>'; }); return r; }).join('') + '</svg>' },
    { id: 'quien-le-vende', titulo: '¿Quién le vende al Estado?', bajada: 'Los proveedores más grandes y cuánto depende cada organismo de pocos.', estado: 'real',
      mini: '<svg viewBox="0 0 30 30" fill="none"><path d="M3 8 C14 8 16 12 27 12" stroke="#e3ae7a" stroke-width="4" stroke-opacity=".8"/><path d="M3 17 C14 17 16 21 27 21" stroke="#55698a" stroke-width="3"/><path d="M3 24 C14 24 16 15 27 15" stroke="#3d4f6b" stroke-width="2.5"/></svg>' }
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
