/* BioVoley Lab — Fondo de arena
   Un balón renderizado (48 cuadros) que gira y, al bajar por la página, recorre una parábola
   con su sombra sobre la cancha; partículas de luz como en un coliseo y la cancha y el texto
   del fondo en paralaje. Las tarjetas aparecen a medida que llegan a la pantalla.
   Lienzo 2D: funciona sin WebGL. Se pausa en la cámara, en los videos y con la pestaña oculta. */
(function (BV) {
  'use strict';
  const quieto = window.matchMedia('(prefers-reduced-motion: reduce)');
  const CUADROS = 48, COLS = 8, LADO = 400;
  let cv = null, g = null, W = 0, H = 0, raf = 0, ultimo = 0, paso = 1000 / 30, costo = [];
  let hoja = null, polvo = [], arena = null, sy = 0, syVisto = -1;

  function tamano() {
    W = window.innerWidth; H = window.innerHeight;
    cv.width = W; cv.height = H;
    polvo = Array.from({ length: Math.round(W / 60) }, () => mota(true));
  }
  function mota(inicio) {
    return { x: Math.random() * W, y: inicio ? Math.random() * H : H + 8, r: 0.6 + Math.random() * 1.8, v: 4 + Math.random() * 10, a: 0.15 + Math.random() * 0.35, f: Math.random() * 6 };
  }
  const zona = () => { const m = document.querySelector('.main'); return m ? Math.max(0, m.getBoundingClientRect().left) : 0; };
  const avance = () => { const max = document.documentElement.scrollHeight - H; return max > 40 ? Math.min(1, sy / max) : 0; };

  /** dónde va el balón: una parábola de arriba a la derecha hacia abajo a la izquierda, según el
      desplazamiento. En el panel arranca grande, al lado del título, como imagen de portada. */
  function trayecto() {
    const x0 = zona(), ancho = W - x0, portada = document.body.dataset.vista === 'panel' && W > 980;
    return portada
      ? { xa: x0 + ancho * 0.83, ya: Math.max(H * 0.4, 300), xb: x0 + ancho * 0.18, yb: H * 0.7, alto: H * 0.16, D: Math.max(260, Math.min(ancho * 0.3, 380)) }
      : { xa: x0 + ancho * 0.97, ya: H * 0.2, xb: x0 + ancho * 0.2, yb: H * 0.66, alto: H * 0.2, D: Math.max(180, Math.min(ancho * 0.22, 300)) }; // se asoma por el borde
  }
  const enArco = (c, p) => ({ x: c.xa + (c.xb - c.xa) * p, y: c.ya + (c.yb - c.ya) * p - 4 * c.alto * p * (1 - p) });
  let pos = null;
  function posicion(t) {
    const c = trayecto(), p = avance(), q = enArco(c, p);
    const meta = { x: q.x, y: q.y + Math.sin(t / 1100) * 9, D: c.D * (1 + 0.18 * p) };
    // inercia: el balón alcanza su punto con suavidad al bajar o al cambiar de sección
    if (!pos) pos = meta;
    else ['x', 'y', 'D'].forEach((k) => { pos[k] += (meta[k] - pos[k]) * 0.09; });
    return Object.assign({ c, p }, pos);
  }

  function dibuja(t) {
    g.clearRect(0, 0, W, H);
    // polvo de luz que sube
    polvo.forEach((m, i) => {
      m.y -= m.v * (paso / 1000); m.x += Math.sin(t / 1400 + m.f) * 0.12;
      if (m.y < -8) polvo[i] = mota(false);
      g.globalAlpha = m.a * (0.6 + 0.4 * Math.sin(t / 700 + m.f));
      g.fillStyle = '#cfe2ff'; g.beginPath(); g.arc(m.x, m.y, m.r, 0, Math.PI * 2); g.fill();
    });
    if (!hoja) { g.globalAlpha = 1; return; }
    const { x, y, D, c } = posicion(t);
    // la trayectoria completa, punteada, con su vértice: es la parábola de los modelos
    g.globalAlpha = 0.22; g.strokeStyle = '#ffd65a'; g.lineWidth = 2; g.setLineDash([2, 10]); g.lineCap = 'round';
    g.beginPath();
    for (let k = 0; k <= 50; k++) { const q = enArco(c, k / 50); if (k) g.lineTo(q.x, q.y); else g.moveTo(q.x, q.y); }
    g.stroke(); g.setLineDash([]);
    const v = enArco(c, 0.5);
    g.globalAlpha = 0.5; g.fillStyle = '#ffd65a'; g.beginPath(); g.arc(v.x, v.y, 3.5, 0, Math.PI * 2); g.fill();
    g.globalAlpha = 0.45; g.fillStyle = '#cfe2ff'; g.font = '600 12px Barlow, system-ui, sans-serif'; g.textAlign = 'center';
    g.fillText('vertex', v.x, v.y - 12);
    // sombra sobre la cancha: más chica y tenue cuanto más alto está el balón
    const piso = H * 0.93, alto = Math.max(0, piso - y) / H;
    const sw = D * (0.95 - alto * 0.45), sa = 0.55 * (1 - alto * 0.75);
    g.save(); g.translate(x, piso); g.scale(1, 0.18);
    const sg = g.createRadialGradient(0, 0, 0, 0, 0, sw / 2);
    sg.addColorStop(0, `rgba(0,0,0,${sa})`); sg.addColorStop(1, 'rgba(0,0,0,0)');
    g.globalAlpha = 1; g.fillStyle = sg; g.beginPath(); g.arc(0, 0, sw / 2, 0, Math.PI * 2); g.fill(); g.restore();
    // halo de luz detrás del balón
    const hg = g.createRadialGradient(x, y, D * 0.3, x, y, D * 0.95);
    hg.addColorStop(0, 'rgba(90,150,255,.28)'); hg.addColorStop(1, 'rgba(90,150,255,0)');
    g.globalAlpha = 1; g.fillStyle = hg; g.beginPath(); g.arc(x, y, D * 0.95, 0, Math.PI * 2); g.fill();
    // el balón: el cuadro depende del tiempo y de cuánto se ha bajado
    const k = Math.floor(((t / 1000) * 13 + sy / 35) % CUADROS + CUADROS) % CUADROS;
    g.drawImage(hoja, (k % COLS) * LADO, Math.floor(k / COLS) * LADO, LADO, LADO, x - D / 2, y - D / 2, D, D);
    g.globalAlpha = 1;
  }

  function quieta() {
    return document.hidden || /^#camera/.test(location.hash) || !!document.querySelector('.vmodal:not([hidden])');
  }
  function ciclo(t) {
    raf = requestAnimationFrame(ciclo);
    if (sy !== syVisto && arena) { arena.style.setProperty('--sy', sy.toFixed(0)); syVisto = sy; }
    if (t - ultimo < paso || quieta()) return;
    ultimo = t;
    const a = performance.now();
    dibuja(t);
    // en un equipo lento baja a 15 cuadros por segundo o deja la imagen quieta
    costo.push(performance.now() - a);
    if (costo.length === 60) {
      const m = costo.reduce((s, x) => s + x, 0) / 60; costo = [];
      if (m > 16) { cancelAnimationFrame(raf); raf = 0; } else if (m > 8) paso = 1000 / 15;
    }
  }

  /** las tarjetas aparecen al entrar a la pantalla */
  let obs = null;
  BV.revelar = function (root) {
    if (quieto.matches || !('IntersectionObserver' in window)) return;
    if (!obs) {
      obs = new IntersectionObserver((es) => {
        let n = 0;
        es.forEach((e) => { if (e.isIntersecting) { e.target.style.setProperty('--rd', `${Math.min(n++, 6) * 70}ms`); e.target.classList.add('rv-in'); obs.unobserve(e.target); } });
      }, { rootMargin: '0px 0px -6% 0px', threshold: 0.08 });
    }
    const lista = [];
    [...root.children].forEach((c) => { if (c.classList.contains('grid')) lista.push(...c.children); else lista.push(c); });
    lista.forEach((el) => { el.classList.add('rv'); obs.observe(el); });
  };

  function start() {
    cv = document.getElementById('bvFondo');
    arena = document.querySelector('.arena');
    if (!cv) return;
    g = cv.getContext('2d');
    tamano();
    window.addEventListener('resize', tamano);
    window.addEventListener('scroll', () => { sy = window.scrollY; }, { passive: true });
    const el = document.getElementById('emb-at-balon_webp');
    const img = new Image();
    img.onload = () => { hoja = img; if (quieto.matches) dibuja(0); };
    img.src = el ? el.textContent.trim() : 'vendor/personaje/balon.webp';
    if (quieto.matches) return;
    raf = requestAnimationFrame(ciclo);
  }

  /** cuenta hasta el valor final en los números grandes (marcadores) */
  BV.contar = function (root) {
    if (quieto.matches) return;
    root.querySelectorAll('[data-cnt]').forEach((el) => {
      const fin = +el.dataset.cnt, dec = +(el.dataset.dec || 0), t0 = performance.now();
      if (!Number.isFinite(fin)) return;
      const tick = (t) => {
        const u = Math.min(1, (t - t0) / 750), e = 1 - Math.pow(1 - u, 3);
        el.textContent = BV.fmt(fin * e, dec);
        if (u < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  };

  BV.fondo = { start };
})(window.BV);
