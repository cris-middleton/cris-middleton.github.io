// La portada: el mosaico que se arma, el tordo, la muestra de tableros, la red de TORDO,
// la línea de la trayectoria y la racha de Duolingo. Usa CUADROS (datos-cuadros.js) y PAJARO (datos-pajaro.js).
(function () {
  var reducido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fmt = function (n) { return n.toLocaleString('es-CL'); };
  var dpr = function () { return Math.min(window.devicePixelRatio || 1, 2); };

  // Generador con semilla, para que la red y el orden de las piezas sean siempre iguales
  function semilla(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  // ---------------- El mosaico que se arma ----------------
  // Arma de abajo hacia arriba, queda quieto, se desarma y sigue con el próximo de los ocho.
  // ESCALON es la espera entre una pieza y la siguiente y DURA lo que tarda cada una en caer:
  // el armado completo dura (1.023 × ESCALON + DURA) ms, unos 4,7 s.
  var lienzo = document.getElementById('mosaico'), ctx = lienzo.getContext('2d');
  var N = 32, TOTAL = N * N, ESCALON = 4, DURA = 600, QUIETO = 4200, DESARME = 950;
  var celda = 0, placa = null, brillo = null;

  // La placa vacía y el brillo de la perilla se pintan una vez por tamaño y se estampan
  function preparar() {
    var lado = Math.round(lienzo.clientWidth * dpr());
    if (!lado) return false;
    if (lado === lienzo.width && placa) return true;
    lienzo.width = lienzo.height = lado; celda = lado / N;

    placa = document.createElement('canvas'); placa.width = placa.height = lado;
    var p = placa.getContext('2d');
    p.fillStyle = '#0d131d'; p.fillRect(0, 0, lado, lado);
    p.setTransform(celda, 0, 0, celda, 0, 0);
    for (var f = 0; f < N; f++) for (var c = 0; c < N; c++) {
      p.beginPath(); p.arc(c + 0.5, f + 0.5, 0.31, 0, 2 * Math.PI);
      p.fillStyle = '#18202e'; p.fill();
      p.lineWidth = 0.06; p.strokeStyle = 'rgba(0,0,0,.3)'; p.stroke();
    }

    var b = Math.ceil(celda);
    brillo = document.createElement('canvas'); brillo.width = brillo.height = b;
    var g = brillo.getContext('2d');
    g.setTransform(b, 0, 0, b, 0, 0);
    g.beginPath(); g.arc(0.5, 0.5, 0.31, 0, 2 * Math.PI);
    g.fillStyle = 'rgba(255,255,255,.16)'; g.fill();
    g.lineWidth = 0.07; g.strokeStyle = 'rgba(0,0,0,.28)'; g.stroke();
    g.beginPath(); g.arc(0.5, 0.5, 0.22, 0, 2 * Math.PI);
    g.lineWidth = 0.05; g.strokeStyle = 'rgba(255,255,255,.18)'; g.stroke();
    return true;
  }

  // Cada pieza cae desde un poco más arriba y más grande; el orden va de abajo hacia arriba, con algo de azar
  var azar = semilla(7), orden = new Float32Array(TOTAL);
  (function () {
    var claves = [];
    for (var i = 0; i < TOTAL; i++) { var f = (i / N) | 0, c = i % N; claves.push([(N - 1 - f) + c * 0.18 + azar() * 5, i]); }
    claves.sort(function (a, b) { return a[0] - b[0]; });
    claves.forEach(function (k, r) { orden[k[1]] = r; });
  })();
  // La paleta de cada cuadro usa 0-9, a-z y luego A-Z
  CUADROS.forEach(function (q) {
    q.colores = [];
    for (var i = 0; i < TOTAL; i++) { var ch = q.piezas[i]; q.colores.push(q.paleta[/[A-Z]/.test(ch) ? 36 + ch.charCodeAt(0) - 65 : parseInt(ch, 36)]); }
  });

  function pieza(i, color, cae, esc, alfa) {
    var c = i % N, f = (i / N) | 0, s = celda * esc;
    var x = (c + 0.5) * celda - s / 2, y = (f + 0.5 - cae) * celda - s / 2;
    ctx.globalAlpha = alfa;
    ctx.fillStyle = color; ctx.fillRect(x, y, s * 1.015, s * 1.015);
    ctx.drawImage(brillo, x, y, s, s);
  }

  var actual = 0, fase = 'quieto', t0 = performance.now(), visible = false, siguiente = null, estreno = true;
  var salidaPuestas = document.getElementById('cuadro-puestas'), ultimoConteo = -1, quietoPintado = false;
  function dibujar(ahora, forzar) {
    if (!preparar()) return;
    var quieto = fase === 'quieto' || reducido;
    if (quieto && quietoPintado && !forzar) return;
    var colores = CUADROS[actual].colores, dt = ahora - t0, puestas = 0;
    ctx.globalAlpha = 1; ctx.drawImage(placa, 0, 0);
    for (var i = 0; i < TOTAL; i++) {
      if (quieto) { pieza(i, colores[i], 0, 1, 1); puestas++; continue; }
      if (fase === 'armando') {
        var p = (dt - orden[i] * ESCALON) / DURA;
        if (p <= 0) continue;
        if (p >= 1) { pieza(i, colores[i], 0, 1, 1); puestas++; continue; }
        var e = 1 - Math.pow(1 - p, 3);
        pieza(i, colores[i], (1 - e) * 3.2, 1 + (1 - e) * 0.35, Math.min(1, p * 2.2));
      } else {
        var q = (dt - (TOTAL - 1 - orden[i]) * (DESARME * 0.55 / TOTAL)) / (DESARME * 0.45);
        if (q >= 1) continue;
        puestas++;
        if (q <= 0) { pieza(i, colores[i], 0, 1, 1); continue; }
        var e2 = q * q; pieza(i, colores[i], e2 * 4, 1 - e2 * 0.4, 1 - e2);
      }
    }
    quietoPintado = quieto;
    if (puestas !== ultimoConteo) { salidaPuestas.textContent = fmt(puestas); ultimoConteo = puestas; }
  }

  var puntos = document.getElementById('puntos'), galeria = document.getElementById('galeria');
  function rotular() {
    var q = CUADROS[actual];
    document.getElementById('cuadro-nombre').textContent = q.nombre;
    document.getElementById('cuadro-enlace').href = 'https://pixelframe.cl/producto/' + q.slug;
    puntos.querySelectorAll('button').forEach(function (b, k) { b.setAttribute('aria-pressed', String(k === actual)); });
  }

  var corriendo = false;
  function cuadro(ahora) {
    var dt = ahora - t0;
    if (fase === 'armando' && dt > (TOTAL - 1) * ESCALON + DURA) { fase = 'quieto'; t0 = ahora; }
    else if (fase === 'quieto' && dt > QUIETO) { fase = 'desarmando'; t0 = ahora; }
    else if (fase === 'desarmando' && dt > DESARME) {
      actual = siguiente != null ? siguiente : (actual + 1) % CUADROS.length; siguiente = null;
      fase = 'armando'; t0 = ahora; rotular();
    }
    dibujar(ahora);
    if (visible && !document.hidden) requestAnimationFrame(cuadro); else corriendo = false;
  }
  function arrancar() { if (reducido || corriendo) return; corriendo = true; requestAnimationFrame(cuadro); }

  CUADROS.forEach(function (q, k) {
    var b = document.createElement('button');
    b.type = 'button'; b.setAttribute('aria-label', q.nombre); b.title = q.nombre;
    b.innerHTML = '<img src="/images/cuadros/' + q.slug + '.png" alt="" width="32" height="32">';
    b.addEventListener('click', function () {
      if (k === actual && fase !== 'desarmando') return;
      estreno = false;
      if (reducido) { actual = k; rotular(); dibujar(performance.now(), true); return; }
      siguiente = k;
      if (fase !== 'desarmando') { fase = 'desarmando'; t0 = performance.now(); }
      arrancar();
    });
    puntos.appendChild(b);

    var a = document.createElement('a');
    a.href = 'https://pixelframe.cl/producto/' + q.slug; a.title = q.nombre;
    a.innerHTML = '<img src="/images/cuadros/' + q.slug + '.png" alt="' + q.nombre + '" width="32" height="32" loading="lazy">';
    galeria.appendChild(a);
  });

  // Parte completo (se ve bien quieto) y se arma la primera vez que aparece en pantalla
  rotular(); dibujar(performance.now(), true);
  new ResizeObserver(function () { placa = null; dibujar(performance.now(), true); }).observe(lienzo);
  new IntersectionObserver(function (es) {
    visible = es[0].isIntersecting;
    if (!visible || reducido) return;
    if (estreno) { estreno = false; fase = 'armando'; t0 = performance.now(); }
    arrancar();
  }, { threshold: 0.4 }).observe(lienzo);
  document.addEventListener('visibilitychange', function () { if (!document.hidden && visible) arrancar(); });

  // ---------------- Barras de muestra (datos de ejemplo) ----------------
  var meses = ['e', 'f', 'm', 'a', 'm', 'j', 'j', 'a', 's', 'o', 'n', 'd'];
  var ejemplo = [62, 48, 70, 72, 76, 73, 75, 71, 78, 80, 88, 150];
  document.getElementById('barras').innerHTML = ejemplo.map(function (v, k) {
    return '<div class="barra' + (k === 11 ? ' barra--dic' : '') + '" style="--n:' + k + '">' + (k === 11 ? '<em class="fiebre">¿fiebre?</em>' : '') +
      '<i style="height:' + (v / 150 * 100 - 12) + '%"></i><span>' + meses[k] + '</span></div>';
  }).join('');
  var barras = document.getElementById('barras');
  new IntersectionObserver(function (es, obs) { if (es[0].isIntersecting) { barras.classList.add('anima'); obs.disconnect(); } }, { threshold: 0.5 }).observe(barras);

  // ---------------- La red de TORDO: compradores a la izquierda, proveedores a la derecha ----------------
  var red = document.getElementById('red'), rc = red.getContext('2d'), rw = 0, rh = 0, rd = 1, redVisible = false, redCorre = false;
  var ar = semilla(11), izq = [], der = [], enlaces = [], chispas = [];
  for (var i = 0; i < 7; i++) izq.push({ y: (i + 0.8) / 7.6, r: 3 + ar() * 5 });
  for (var j = 0; j < 11; j++) der.push({ y: (j + 0.8) / 11.6, r: 2 + ar() * 3 });
  izq.forEach(function (n, a) { var k = 2 + Math.floor(ar() * 3); for (var m = 0; m < k; m++) enlaces.push([a, Math.floor(ar() * der.length), 0.4 + ar() * 0.6]); });
  for (var s = 0; s < 46; s++) chispas.push({ e: Math.floor(ar() * enlaces.length), t: ar(), v: 0.0018 + ar() * 0.0035 });
  function medirRed() { rd = dpr(); rw = red.clientWidth; rh = red.clientHeight; red.width = rw * rd; red.height = rh * rd; }
  function extremos(e) {
    var x0 = rw * 0.12, x1 = rw * 0.88;
    return { x0: x0, x1: x1, cx: (x0 + x1) / 2, y0: izq[e[0]].y * (rh - 24) + 6, y1: der[e[1]].y * (rh - 24) + 6 };
  }
  function punto(e, t) {
    var z = extremos(e), u = 1 - t;
    return [u * u * u * z.x0 + 3 * u * u * t * z.cx + 3 * u * t * t * z.cx + t * t * t * z.x1,
      u * u * u * z.y0 + 3 * u * u * t * z.y0 + 3 * u * t * t * z.y1 + t * t * t * z.y1];
  }
  function pintarRed() {
    rc.setTransform(rd, 0, 0, rd, 0, 0); rc.clearRect(0, 0, rw, rh);
    enlaces.forEach(function (e) {
      var z = extremos(e);
      rc.beginPath(); rc.moveTo(z.x0, z.y0); rc.bezierCurveTo(z.cx, z.y0, z.cx, z.y1, z.x1, z.y1);
      rc.strokeStyle = 'rgba(159,184,214,' + (0.08 + e[2] * 0.12) + ')'; rc.lineWidth = 0.6 + e[2] * 1.4; rc.stroke();
    });
    chispas.forEach(function (c) {
      for (var k = 0; k < 5; k++) {
        var tt = c.t - k * 0.018; if (tt < 0) break;
        var p = punto(enlaces[c.e], Math.min(tt, 1));
        rc.beginPath(); rc.arc(p[0], p[1], 2.1 - k * 0.35, 0, 2 * Math.PI); rc.fillStyle = 'rgba(227,174,122,' + (0.95 - k * 0.2) + ')'; rc.fill();
      }
    });
    izq.forEach(function (n) { rc.beginPath(); rc.arc(rw * 0.12, n.y * (rh - 24) + 6, n.r, 0, 2 * Math.PI); rc.fillStyle = '#9fb8d6'; rc.fill(); });
    der.forEach(function (n) { rc.beginPath(); rc.arc(rw * 0.88, n.y * (rh - 24) + 6, n.r, 0, 2 * Math.PI); rc.fillStyle = '#f1ece4'; rc.fill(); });
  }
  function moverRed() {
    chispas.forEach(function (c) { c.t += c.v; if (c.t > 1.08) { c.t = 0; c.e = Math.floor(ar() * enlaces.length); } });
    pintarRed();
    if (redVisible && !document.hidden) requestAnimationFrame(moverRed); else redCorre = false;
  }
  function arrancarRed() { if (reducido || redCorre || !redVisible) return; redCorre = true; requestAnimationFrame(moverRed); }
  medirRed(); pintarRed();
  new ResizeObserver(function () { medirRed(); pintarRed(); }).observe(red);
  new IntersectionObserver(function (es) { redVisible = es[0].isIntersecting; arrancarRed(); }).observe(red);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) arrancarRed(); });

  // ---------------- La línea de la trayectoria se dibuja al llegar ----------------
  var linea = document.getElementById('linea');
  new IntersectionObserver(function (es, obs) { if (es[0].isIntersecting) { linea.classList.add('anima'); obs.disconnect(); } }, { threshold: 0.6 }).observe(linea);

  // ---------------- El tordo ----------------
  // Entra volando, se posa en la M, se inclina hasta que el pico toca el punto cobre, lo picotea
  // tres veces (al tercero el punto gira) y se va por encima del mosaico. Clic en el nombre lo llama de nuevo.
  (function () {
    if (reducido) return;
    var caja = document.getElementById('pajaro'), nombre = document.getElementById('nombre');
    var portada = document.querySelector('.portada'), letraM = document.getElementById('letra-m');
    var punto = document.querySelector('.i-pixel--cobre .i-pixel-punto');
    var VB = [77, 141, 398, 341];   // la caja del logo, en sus unidades
    var tela = document.createElement('canvas'), tc = tela.getContext('2d');
    caja.appendChild(tela);
    var trazos = PAJARO.trazos.map(function (t) { return t.ojo || t.ala ? t : { fill: t.fill, p: new Path2D(t.d) }; });
    var alas = PAJARO.alas.map(function (d) { return new Path2D(d); }), alaActual = -1, escala = 0;
    function pintar(k) {
      tc.setTransform(escala, 0, 0, escala, -VB[0] * escala, -VB[1] * escala);
      tc.clearRect(VB[0], VB[1], VB[2], VB[3]);
      trazos.forEach(function (t) {
        if (t.ojo) { tc.beginPath(); tc.ellipse(+PAJARO.ojo.cx, +PAJARO.ojo.cy, +PAJARO.ojo.rx, +PAJARO.ojo.ry, 0, 0, 2 * Math.PI); tc.fillStyle = '#f1ece4'; tc.fill(); }
        else if (t.ala) { tc.fillStyle = t.fill; tc.fill(alas[k]); }
        else { tc.fillStyle = t.fill; tc.fill(t.p); }
      });
    }
    function ala(k) { if (k !== alaActual) { alaActual = k; pintar(k); } }
    var ALETEO = [2, 1, 0, 1];

    var medidor = document.createElement('canvas').getContext('2d');
    function medir() {
      var fs = parseFloat(getComputedStyle(nombre).fontSize), H = fs * 0.58, W = H * VB[2] / VB[3];
      var F = { x: (303 - VB[0]) / VB[2] * W, y: (480.7 - VB[1]) / VB[3] * H };   // los pies
      var B = { x: (475.5 - VB[0]) / VB[2] * W, y: (188.6 - VB[1]) / VB[3] * H }; // la punta del pico
      var base = portada.getBoundingClientRect();
      var sonda = document.createElement('span'); sonda.style.cssText = 'display:inline-block;width:0;height:0;vertical-align:baseline';
      letraM.appendChild(sonda); var lineaBase = sonda.getBoundingClientRect().top; sonda.remove();
      medidor.font = getComputedStyle(nombre).fontWeight + ' ' + fs + 'px "Schibsted Grotesk"';
      var m = medidor.measureText('M'), rm = letraM.getBoundingClientRect();
      var techo = lineaBase - m.actualBoundingBoxAscent;
      var tintaIzq = rm.left - m.actualBoundingBoxLeft, tintaDer = rm.left + m.actualBoundingBoxRight;
      var rp = punto.getBoundingClientRect(), D = { x: rp.left + rp.width / 2, y: rp.top + rp.height / 2 };
      // Se para sobre la M a la distancia justa para que, inclinado, el pico llegue al punto
      var L = Math.hypot(B.x - F.x, B.y - F.y), dy = D.y - techo;
      var px = D.x - Math.sqrt(Math.max(0, L * L - dy * dy));
      px = Math.min(Math.max(px, tintaIzq + W * 0.16), tintaDer - W * 0.08);
      var P = { x: px, y: techo };
      var giro = (Math.atan2(D.y - P.y, D.x - P.x) - Math.atan2(B.y - F.y, B.x - F.x)) * 180 / Math.PI;
      return { W: W, H: H, F: F, giro: giro,
        P: { x: P.x - base.left, y: P.y - base.top }, D: { x: D.x - base.left, y: D.y - base.top },
        izq: -base.left - W - 30, der: window.innerWidth - base.left + W + 30 };
    }
    function bez(a, c, b, t) { var u = 1 - t; return { x: u * u * a.x + 2 * u * t * c.x + t * t * b.x, y: u * u * a.y + 2 * u * t * c.y + t * t * b.y }; }
    function suave(t) { return 0.5 - Math.cos(Math.PI * t) / 2; }
    function chispas(g) {
      for (var k = 0; k < 6; k++) {
        var c = document.createElement('span'); c.className = 'chispa';
        var ang = -Math.PI / 2 + (Math.random() - 0.5) * 2.4, r = 14 + Math.random() * 18;
        c.style.left = (g.D.x - 2) + 'px'; c.style.top = (g.D.y - 2) + 'px';
        c.style.setProperty('--dx', (Math.cos(ang) * r).toFixed(1) + 'px'); c.style.setProperty('--dy', (Math.sin(ang) * r).toFixed(1) + 'px');
        portada.appendChild(c); setTimeout(function (n) { n.remove(); }.bind(null, c), 600);
      }
    }
    function golpe(clase) { punto.classList.remove('picado', 'giro'); void punto.getBoundingClientRect(); punto.classList.add(clase); }

    var volando = false;
    function vuelo() {
      if (volando) return; volando = true;
      var g = medir(), S = { x: g.izq, y: g.P.y - 150 }, C1 = { x: (S.x + g.P.x) / 2, y: g.P.y - 230 };
      var E = { x: g.der, y: g.P.y - 120 }, C2 = { x: g.P.x + (E.x - g.P.x) * 0.45, y: g.P.y - 300 };
      var r = dpr();
      caja.style.width = g.W + 'px'; caja.style.height = g.H + 'px';
      tela.width = Math.ceil(g.W * r); tela.height = Math.ceil(g.H * r);
      escala = g.W * r / VB[2]; alaActual = -1;
      caja.style.transformOrigin = g.F.x + 'px ' + g.F.y + 'px';
      caja.style.visibility = 'visible';
      var T_LLEGA = 1700, T_POSA = 2000, T_MIRA = 2450, PICOTAZO = 380, N_PIC = 3, T_PIC = T_MIRA + PICOTAZO * N_PIC, T_PAUSA = T_PIC + 450, T_SALE = T_PAUSA + 2300;
      var golpes = 0, t0v = performance.now(), anterior = null;
      function lugar(p, rot, sx, sy) { caja.style.transform = 'translate(' + (p.x - g.F.x).toFixed(1) + 'px,' + (p.y - g.F.y).toFixed(1) + 'px) rotate(' + rot.toFixed(1) + 'deg) scale(' + sx + ',' + sy + ')'; }
      function cuadroV(ahora) {
        var t = ahora - t0v, p, rot = 0;
        if (t < T_LLEGA) {                          // llega en curva, aleteando
          p = bez(S, C1, g.P, suave(t / T_LLEGA));
          if (anterior) rot = Math.max(-20, Math.min(20, Math.atan2(p.y - anterior.y, p.x - anterior.x) * 180 / Math.PI * 0.6));
          ala(t > T_LLEGA * 0.88 ? 1 : ALETEO[((t / 70) | 0) % 4]);
          lugar(p, rot, 1, 1); anterior = p;
        } else if (t < T_POSA) {                    // se posa: se aplasta un poco
          var a = (t - T_LLEGA) / (T_POSA - T_LLEGA); ala(1);
          lugar(g.P, 0, 1 + Math.sin(a * Math.PI) * 0.06, 1 - Math.sin(a * Math.PI) * 0.12);
        } else if (t < T_MIRA) {                    // mira
          var b = (t - T_POSA) / (T_MIRA - T_POSA); lugar(g.P, Math.sin(b * Math.PI) * -8, 1, 1);
        } else if (t < T_PIC) {                     // picotea
          var tp = t - T_MIRA, n = (tp / PICOTAZO) | 0, f = (tp % PICOTAZO) / PICOTAZO, k;
          if (f < 0.32) k = Math.pow(f / 0.32, 2);           // baja
          else if (f < 0.42) k = 1;                           // toca
          else k = 1 - (f - 0.42) / 0.58 * 0.8;               // sube, sin volver del todo
          lugar(g.P, g.giro * k, 1, 1);
          if (f >= 0.32 && golpes <= n) { golpes = n + 1; golpe(n === N_PIC - 1 ? 'giro' : 'picado'); chispas(g); }
        } else if (t < T_PAUSA) {                   // se endereza
          var c = (t - T_PIC) / (T_PAUSA - T_PIC); lugar(g.P, g.giro * 0.2 * (1 - c), 1, 1 - Math.sin(c * Math.PI) * 0.1);
        } else if (t < T_SALE) {                    // se va por encima del mosaico
          p = bez(g.P, C2, E, suave((t - T_PAUSA) / (T_SALE - T_PAUSA)));
          if (anterior) rot = Math.max(-25, Math.min(25, Math.atan2(p.y - anterior.y, p.x - anterior.x) * 180 / Math.PI * 0.6));
          ala(ALETEO[((t / 65) | 0) % 4]); lugar(p, rot, 1, 1); anterior = p;
        } else { caja.style.visibility = 'hidden'; volando = false; return; }
        if (t >= T_PAUSA && anterior === null) anterior = g.P;
        if (t < T_PAUSA && t >= T_LLEGA) anterior = null;
        requestAnimationFrame(cuadroV);
      }
      requestAnimationFrame(cuadroV);
    }
    nombre.addEventListener('click', vuelo);
    (document.fonts ? document.fonts.ready : Promise.resolve()).then(function () { setTimeout(vuelo, 1100); });
  })();

  // ---------------- Racha de Duolingo ----------------
  // Empezó el 6 de septiembre de 2023 y no se ha cortado. Cuenta días de calendario en la hora local del visitante.
  var INICIO = Date.UTC(2023, 8, 6), DIA = 86400000, hoy = new Date(), HOY = Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  document.getElementById('racha-dias').textContent = fmt(Math.round((HOY - INICIO) / DIA) + 1);
  var filas = [];
  for (var a = 2023; a <= hoy.getFullYear(); a++) {
    var ini = Date.UTC(a, 0, 1), fin = Date.UTC(a, 11, 31), largo = Math.round((fin - ini) / DIA) + 1;
    var desde = Math.max(ini, INICIO), hasta = Math.min(fin, HOY), n = Math.round((hasta - desde) / DIA) + 1;
    var iz = (desde - ini) / DIA / largo * 100, de = (fin - hasta) / DIA / largo * 100;
    filas.push('<li class="anio"><span>' + a + '</span><span class="pista"><span class="relleno" style="left:' + iz.toFixed(1) + '%;right:' + de.toFixed(1) + '%"></span></span><span class="dias">' + n + '</span></li>');
  }
  document.getElementById('racha-anios').innerHTML = filas.join('');
})();
