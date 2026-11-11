/* BioVoley Lab — Aterrizaje seguro vs. de riesgo (animación 2D + física del impulso)
   Principios de animación (Thomas y Johnston, 1981): tiempo, entrada y salida lenta,
   arcos y estirar/encoger. Física: J = m·v = F·Δt (impulso y cantidad de movimiento). */
(function (BV) {
  'use strict';
  const { $, fmt } = BV;
  const V = {
    title: 'Landing', nav: 'Landing',
    sub: 'Same jump, different force on the knee',
    tags: ['art', 'mat', 'ef'],
  };
  let st = null;

  const ease = {
    out: (t) => 1 - Math.pow(1 - t, 3),
    inOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  };

  V.render = function (el) {
    const p = BV.players()[0];
    st = {
      mass: p ? p.mass : 60, hM: p ? p.height / 100 : 1.7, jump: 40, dtSoft: 250, dtStiff: 70, speed: 0.25, view: 'lateral',
      t: 0, playing: true, raf: 0, last: 0,
    };
    el.innerHTML = `
      <div class="card stack">
        <div class="row between">
          <div class="row">
            <button class="btn btn-primary btn-sm" id="aPlay" type="button">Pause</button>
            <button class="btn btn-sm" id="aRe" type="button">Replay</button>
            <div class="seg" role="group" aria-label="View">
              <button type="button" data-v="lateral" aria-pressed="true">Side</button>
              <button type="button" data-v="frontal" aria-pressed="false">Front</button>
            </div>
          </div>
          <div class="seg" role="group" aria-label="Speed">
            <button type="button" data-s="0.1" aria-pressed="false">×0.1</button>
            <button type="button" data-s="0.25" aria-pressed="true">×0.25</button>
            <button type="button" data-s="1" aria-pressed="false">×1</button>
          </div>
        </div>
        <div class="anim-pair">
          <div class="anim-box"><h3>${BV.chip('ok', 'Safe')} Cushioned landing</h3><canvas class="plot" id="cvA" data-ratio="0.85" aria-label="Cushioned landing animation"></canvas></div>
          <div class="anim-box"><h3>${BV.chip('crit', 'Risk')} Stiff landing</h3><canvas class="plot" id="cvB" data-ratio="0.85" aria-label="Stiff landing animation"></canvas></div>
        </div>
      </div>
      <div class="grid g-side">
        <div class="card">
          <div class="card-h"><h3>Ground force</h3><span class="note">times body weight</span></div>
          <canvas class="plot" id="cvF" data-ratio="0.42" aria-label="Force curves over time"></canvas>
          <div class="legend"><span><i style="--c:var(--s1)"></i>Cushioned</span><span><i style="--c:var(--s2)"></i>Stiff</span></div>
          <details class="more" style="margin-top:10px"><summary>Show calculation</summary><div class="formula" id="aForm"></div></details>
        </div>
        <div class="card stack">
                    <label class="field"><span>Data from</span><select id="aP"><option value="">Manual values</option>${BV.playerOptions(p ? p.id : '')}</select></label>
          <label class="field"><span>Mass</span><input type="range" id="aM" min="40" max="95" step="1" value="${Math.round(st.mass)}"></label>
          <div class="range-l"><span>40</span><b id="aMv"></b><span>95 kg</span></div>
          <label class="field"><span>Jump height</span><input type="range" id="aH" min="15" max="70" step="1" value="${st.jump}"></label>
          <div class="range-l"><span>15</span><b id="aHv"></b><span>70 cm</span></div>
          <label class="field"><span>Safe cushioning</span><input type="range" id="aS" min="120" max="400" step="10" value="${st.dtSoft}"></label>
          <div class="range-l"><span>120</span><b id="aSv"></b><span>400 ms</span></div>
          <label class="field"><span>Stiff cushioning</span><input type="range" id="aR" min="40" max="150" step="5" value="${st.dtStiff}"></label>
          <div class="range-l"><span>40</span><b id="aRv"></b><span>150 ms</span></div>
          <details class="more"><summary>Animation principles</summary>
          <ul class="note" style="margin:0;padding-left:18px;display:flex;flex-direction:column;gap:4px">
            <li><b>Timing:</b> the fall lasts √(2h/g); the cushioning, the chosen Δt.</li>
            <li><b>Slow in and slow out:</b> the knee brakes gradually in the safe landing.</li>
            <li><b>Arcs:</b> knee and hip rotate around their joints.</li>
            <li><b>Squash and stretch:</b> the body compresses when it touches the floor.</li>
          </ul></details>
        </div>
      </div>`;
    const bind = (id, key, out, unit) => {
      const inp = $(id, el);
      const upd = () => { st[key] = +inp.value; $(out, el).textContent = inp.value + ' ' + unit; physics(); };
      inp.addEventListener('input', upd); upd();
    };
    bind('#aM', 'mass', '#aMv', 'kg'); bind('#aH', 'jump', '#aHv', 'cm'); bind('#aS', 'dtSoft', '#aSv', 'ms'); bind('#aR', 'dtStiff', '#aRv', 'ms');
    // datos de una persona del equipo: su masa, su estatura y su último salto medido
    $('#aP', el).addEventListener('change', (e) => {
      const q = BV.player(e.target.value);
      if (!q) return;
      st.hM = (q.height || 170) / 100;
      $('#aM', el).value = Math.round(BV.clamp(q.mass || 60, 40, 95)); $('#aM', el).dispatchEvent(new Event('input'));
      const f = BV.calc.fatigue(q.id);
      if (f.sets.length) { $('#aH', el).value = Math.round(BV.clamp(f.sets[f.sets.length - 1].mean, 15, 70)); $('#aH', el).dispatchEvent(new Event('input')); }
    });
    $('#aPlay', el).addEventListener('click', () => { st.playing = !st.playing; $('#aPlay', el).textContent = st.playing ? 'Pause' : 'Play'; });
    $('#aRe', el).addEventListener('click', () => { st.t = 0; st.playing = true; $('#aPlay', el).textContent = 'Pause'; });
    el.querySelectorAll('[data-v]').forEach((b) => b.addEventListener('click', () => {
      st.view = b.dataset.v; el.querySelectorAll('[data-v]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    }));
    el.querySelectorAll('[data-s]').forEach((b) => b.addEventListener('click', () => {
      st.speed = +b.dataset.s; el.querySelectorAll('[data-s]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    }));
    st.cvA = $('#cvA', el); st.cvB = $('#cvB', el); st.cvF = $('#cvF', el);
    st.last = performance.now();
    st.raf = requestAnimationFrame(frame);
  };

  /** Física del aterrizaje: pulso semisenoidal con el mismo impulso */
  function physics() {
    const g = BV.G, v = Math.sqrt(2 * g * st.jump / 100);
    st.v = v; st.tFall = Math.sqrt(2 * (st.jump / 100) / g);
    const peak = (dt) => 1 + (Math.PI * v) / (2 * g * dt); // en pesos corporales
    st.pkSoft = peak(st.dtSoft / 1000); st.pkStiff = peak(st.dtStiff / 1000);
    const J = st.mass * v, W = st.mass * g;
    const f = $('#aForm');
    if (f) f.innerHTML = `
      Speed at floor contact: v = √(2·g·h) = √(2 × 9.81 × ${fmt(st.jump / 100, 2)}) = <b>${fmt(v, 2)} m/s</b><br>
      Impulse to stop (same for both): J = m·v = ${st.mass} × ${fmt(v, 2)} = <b>${fmt(J, 0)} N·s</b><br>
      Peak force ≈ weight + π·J/(2·Δt) → cushioned (${st.dtSoft} ms): <b>${fmt(st.pkSoft, 1)} × weight</b> (${fmt(st.pkSoft * W, 0)} N) · stiff (${st.dtStiff} ms): <b>${fmt(st.pkStiff, 1)} × weight</b> (${fmt(st.pkStiff * W, 0)} N)<br>
      Same impulse, ${fmt(st.dtSoft / st.dtStiff, 1)} times more time → <b>${fmt(st.pkStiff / st.pkSoft, 1)} times lower peak force</b>.`;
  }

  /** Fuerza (en pesos corporales) a los τ segundos del contacto */
  function force(tau, dt, pk) {
    if (tau < 0) return 0;
    if (tau <= dt) return 1 + (pk - 1) * Math.sin((Math.PI * tau) / dt);
    return 1;
  }

  /** Estado del cuerpo en cada fase del ciclo (u de 0 a 1). Ángulos en grados:
      k rodilla, hip cadera, ank inclinación de la pierna (dorsiflexión), tr tronco,
      phi talón levantado (apoyo de antepié), arm brazos (0 = abajo, 180 = arriba), elb codo. */
  const OBJ = {
    soft: { k: 82, hip: 88, ank: 30, tr: 34, phi: 26, arm: 45, elb: 35, valg: 0 },   // aterrizaje amortiguado
    stiff: { k: 20, hip: 16, ank: 8, tr: 6, phi: 8, arm: 22, elb: 15, valg: 1 },     // rígido, con valgo en vista frontal
  };
  const STAND = { k: 12, hip: 10, ank: 5, tr: 6, phi: 0, arm: 18, elb: 20 };
  const AIR = { k: 12, hip: 8, ank: 0, tr: 4, phi: 32, arm: 60, elb: 25 };
  const mix = (a, b, u) => { const o = {}; Object.keys(b).forEach((key) => { o[key] = a[key] + (b[key] - a[key]) * u; }); return o; };
  function estado(soft, fase, u) {
    const T = soft ? OBJ.soft : OBJ.stiff;
    if (fase === 'aire') return Object.assign({}, AIR, { arm: 160 - 100 * ease.inOut(u), elb: 10 + 15 * u, v: 0 }); // los brazos bajan después del remate o bloqueo
    if (fase === 'freno') {
      const e = soft ? ease.out(u) : Math.min(1, u * 1.7); // el rígido frena de golpe
      const P = mix(AIR, T, e);
      P.phi = T.phi * Math.max(0, 1 - u / (soft ? 0.5 : 0.25)); // primero toca la punta del pie y luego baja el talón
      P.v = T.valg * e;
      return P;
    }
    const e = ease.inOut(u);
    const P = mix(Object.assign({}, T, { phi: 0 }), STAND, e);
    P.v = T.valg * (1 - e);
    return P;
  }
  V.estado = estado;

  /** Estado del cuerpo en el tiempo t (s). Ambas animaciones usan el mismo ciclo para caer al mismo tiempo. */
  function pose(t, soft) {
    const dt = (soft ? st.dtSoft : st.dtStiff) / 1000;
    const dtMax = Math.max(st.dtSoft, st.dtStiff) / 1000;
    const tf = st.tFall, rec = 0.6, pause = 0.7;
    const total = tf + dtMax + rec + pause;
    const tt = t % total;
    let fase, u, y = 0, squash = 0;
    const tau = tt - tf;
    if (tt < tf) {
      fase = 'aire'; u = tt / tf;
      y = st.jump / 100 - 0.5 * BV.G * tt * tt; // caída libre: parábola
    } else if (tt < tf + dt) {
      fase = 'freno'; u = (tt - tf) / dt;
      squash = Math.sin(Math.PI * u) * (soft ? 0.02 : 0.05);
    } else if (tt < tf + dtMax) {
      fase = 'freno'; u = 1;                                     // sostiene el final del frenado
    } else if (tt < tf + dtMax + rec) {
      fase = 'vuelta'; u = (tt - tf - dtMax) / rec;
    } else { fase = 'vuelta'; u = 1; }
    const P = estado(soft, fase, u);
    if (fase === 'freno' && tt - tf < 0.02) P.phi = Math.max(P.phi, (soft ? OBJ.soft : OBJ.stiff).phi);
    return Object.assign(P, { y, squash, tau, total, fase, u });
  }

  function frame(now) {
    if (!st) return;
    st.raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - st.last) / 1000); st.last = now;
    if (st.playing) st.t += dt * st.speed;
    drawFigure(st.cvA, true);
    drawFigure(st.cvB, false);
    drawForce();
  }

  function colors() {
    return { ink: BV.cssVar('--ink'), ink3: BV.cssVar('--ink-3'), line: BV.cssVar('--line'), floor: BV.cssVar('--court'), s1: BV.cssVar('--s1'), s2: BV.cssVar('--s2'), good: BV.cssVar('--good'), crit: BV.cssVar('--crit'), bg: BV.cssVar('--surface-2') };
  }

  /* ---------- personas renderizadas: cuadros precalculados con el mismo modelo de los videos ---------- */
  const BASE_SP = 'vendor/personaje/';
  let SP = null, cargandoSP = null;
  function imagen(nombre) {
    const el = document.getElementById('emb-at-' + nombre.replace(/\W/g, '_'));
    return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = el ? el.textContent : BASE_SP + nombre; });
  }
  function cargarSprites() {
    if (SP || cargandoSP) return;
    const sexo = BV.data.cat === 'M' ? 'M' : 'F';
    const el = document.getElementById('emb-at-aterrizaje_json');
    cargandoSP = (async () => {
      const meta = el ? JSON.parse(el.textContent) : await (await fetch(BASE_SP + 'aterrizaje.json')).json();
      const [lateral, frontal, fondo] = await Promise.all([imagen(`aterrizaje_${sexo}_lateral.webp`), imagen(`aterrizaje_${sexo}_frontal.webp`), imagen('aterrizaje_fondo.jpg')]);
      SP = { meta, sexo, lateral, frontal, fondo };
    })().catch(() => { cargandoSP = null; }); // sin imágenes queda la figura dibujada
  }
  function cuadroDe(P, soft) {
    const m = SP.meta.fases, g = P.fase === 'aire' ? m.aire : m[P.fase][soft ? 'A' : 'B'];
    return g.ini + Math.round(P.u * (g.n - 1));
  }
  function pintarPersona(ctx, P, soft, x0, ground, Hb, lift, alfa) {
    const m = SP.meta, k = Hb / (m.alturas[SP.sexo] * m.pxm), i = cuadroDe(P, soft);
    const sx = (i % m.cols) * m.cw, sy = Math.floor(i / m.cols) * m.ch;
    const dx = x0 - (m.cw / 2) * k, dy = ground - lift - m.piso * k;
    ctx.globalAlpha = alfa;
    ctx.drawImage(SP[st.view], sx, sy, m.cw, m.ch, dx, dy, m.cw * k, m.ch * k);
    ctx.globalAlpha = 1;
    return { dx, dy, k, i };
  }
  function marcaRodilla(ctx, r, Hb, color, texto) {
    const lista = SP.meta.rodillas[`${SP.sexo}_${st.view}`][r.i];
    lista.forEach(([x, y], n) => {
      if (st.view === 'lateral' && n) return;
      ctx.strokeStyle = color; ctx.lineWidth = Math.max(2.5, Hb * 0.009);
      ctx.beginPath(); ctx.arc(r.dx + x * r.k, r.dy + y * r.k, Hb * 0.05, 0, Math.PI * 2); ctx.stroke();
    });
    if (!texto) return;
    const [x, y] = lista[0];
    const px = r.dx + x * r.k + Hb * 0.075, py = r.dy + y * r.k + 5;
    ctx.font = '700 16px "Barlow Condensed", sans-serif'; ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(8,14,26,.8)'; ctx.fillStyle = '#fff';
    ctx.strokeText(texto, px, py); ctx.fillText(texto, px, py);
  }

  /* ---------- dibujo del cuerpo ---------- */
  const SKIN = '#c68a62', JERSEY = '#1c4fd0', SHORTS = '#14213a', SOCK = '#f1f3f6', SHOE = '#f7f7f7', SHOE2 = '#1c4fd0', PAD = '#16181d', HAIR = '#2a1b12';
  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const f = (c) => Math.max(0, Math.min(255, Math.round(c + amt * 255)));
    return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
  }
  /** extremidad con volumen: trapecio de a (ancho wa) a b (ancho wb) con extremos redondeados y sombreado */
  function limb(ctx, a, b, wa, wb, color, depth = 0) {
    const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
    const base = shade(color, depth);
    const gr = ctx.createLinearGradient(a.x + nx * wa / 2, a.y + ny * wa / 2, a.x - nx * wa / 2, a.y - ny * wa / 2);
    gr.addColorStop(0, shade(color, depth + 0.08)); gr.addColorStop(0.55, base); gr.addColorStop(1, shade(color, depth - 0.12));
    ctx.fillStyle = gr;
    ctx.beginPath();
    ctx.moveTo(a.x + nx * wa / 2, a.y + ny * wa / 2); ctx.lineTo(b.x + nx * wb / 2, b.y + ny * wb / 2);
    ctx.lineTo(b.x - nx * wb / 2, b.y - ny * wb / 2); ctx.lineTo(a.x - nx * wa / 2, a.y - ny * wa / 2); ctx.closePath(); ctx.fill();
    ctx.fillStyle = base;
    ctx.beginPath(); ctx.arc(a.x, a.y, wa / 2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(b.x, b.y, wb / 2, 0, Math.PI * 2); ctx.fill();
  }
  const along = (a, b, u) => ({ x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u });
  const rad = (d) => (d * Math.PI) / 180;

  /** cinemática lateral (mira a la derecha): del pie hacia arriba, en px; y crece hacia abajo */
  function rigLateral(P, x0, ground, Hb, lift) {
    const fl = 0.152 * Hb, ah = 0.039 * Hb, Ls = 0.246 * Hb, Lt = 0.245 * Hb, Ltr = 0.288 * Hb;
    const sq = 1 - P.squash;
    const phi = rad(P.phi);
    const ball = { x: x0 + 0.05 * Hb, y: ground - lift };
    // el pie gira sobre el antepié: el talón sube phi grados
    const heel = { x: ball.x - 0.75 * fl * Math.cos(phi), y: ball.y - 0.75 * fl * Math.sin(phi) };
    const toe = { x: ball.x + 0.25 * fl, y: ball.y };
    const ankle = { x: ball.x - 0.62 * fl * Math.cos(phi), y: ball.y - 0.62 * fl * Math.sin(phi) - ah };
    const ts = rad(P.ank), tt = rad(P.ank - P.k), ttr = rad(P.hip + (P.ank - P.k));
    const knee = { x: ankle.x + Ls * Math.sin(ts), y: ankle.y - Ls * Math.cos(ts) * sq };
    const hip = { x: knee.x + Lt * Math.sin(tt), y: knee.y - Lt * Math.cos(tt) * sq };
    const shoulder = { x: hip.x + Ltr * Math.sin(ttr), y: hip.y - Ltr * Math.cos(ttr) * sq };
    const neck = { x: shoulder.x + 0.035 * Hb * Math.sin(ttr * 0.6), y: shoulder.y - 0.035 * Hb };
    const head = { x: neck.x + 0.03 * Hb * Math.sin(ttr * 0.3) + 0.012 * Hb, y: neck.y - 0.075 * Hb };
    const arm = (offset) => {
      const b = rad(P.arm + offset), e = rad(P.arm + offset + P.elb);
      const elbow = { x: shoulder.x + 0.186 * Hb * Math.sin(b), y: shoulder.y + 0.186 * Hb * Math.cos(b) };
      const wrist = { x: elbow.x + 0.146 * Hb * Math.sin(e), y: elbow.y + 0.146 * Hb * Math.cos(e) };
      const hand = { x: wrist.x + 0.06 * Hb * Math.sin(e), y: wrist.y + 0.06 * Hb * Math.cos(e) };
      return { elbow, wrist, hand };
    };
    return { ball, heel, toe, ankle, knee, hip, shoulder, neck, head, armN: arm(0), armF: arm(-12), ttr };
  }

  function drawLateral(ctx, R, Hb, kneeColor, label) {
    const w = (f) => f * Hb;
    const legFar = (dx) => {
      const o = (p) => ({ x: p.x - dx, y: p.y - dx * 0.15 });
      return { heel: o(R.heel), toe: o(R.toe), ankle: o(R.ankle), knee: o(R.knee), hip: o(R.hip) };
    };
    const leg = (L, depth) => {
      limb(ctx, L.hip, L.knee, w(0.088), w(0.062), SKIN, depth);                    // muslo
      limb(ctx, L.knee, L.ankle, w(0.058), w(0.034), SKIN, depth);                  // pierna
      const calf = along(L.knee, L.ankle, 0.32);                                    // pantorrilla hacia atrás
      ctx.fillStyle = shade(SKIN, depth - 0.04); ctx.beginPath(); ctx.ellipse(calf.x - w(0.02), calf.y, w(0.03), w(0.065), Math.atan2(L.ankle.y - L.knee.y, L.ankle.x - L.knee.x) - Math.PI / 2, 0, Math.PI * 2); ctx.fill();
      limb(ctx, along(L.knee, L.ankle, 0.72), L.ankle, w(0.04), w(0.037), SOCK, depth); // media
      // zapatilla
      ctx.fillStyle = shade(SHOE, depth); ctx.beginPath();
      ctx.moveTo(L.heel.x - w(0.012), L.heel.y); ctx.lineTo(L.ankle.x - w(0.02), L.ankle.y - w(0.012)); ctx.lineTo(L.ankle.x + w(0.035), L.ankle.y + w(0.004));
      ctx.quadraticCurveTo(L.toe.x + w(0.01), L.toe.y - w(0.03), L.toe.x + w(0.012), L.toe.y); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = shade(SHOE2, depth); ctx.lineWidth = w(0.01); ctx.beginPath(); ctx.moveTo(L.heel.x, L.heel.y); ctx.lineTo(L.toe.x + w(0.01), L.toe.y); ctx.stroke();
      // rodillera
      const kp = along(L.knee, L.ankle, 0.08);
      ctx.fillStyle = shade(PAD, depth); ctx.beginPath(); ctx.ellipse(kp.x + w(0.006), kp.y, w(0.036), w(0.05), Math.atan2(L.ankle.y - L.knee.y, L.ankle.x - L.knee.x) - Math.PI / 2, 0, Math.PI * 2); ctx.fill();
    };
    const armDraw = (A, depth) => {
      limb(ctx, R.shoulder, A.elbow, w(0.05), w(0.04), SKIN, depth);
      limb(ctx, R.shoulder, along(R.shoulder, A.elbow, 0.45), w(0.06), w(0.055), JERSEY, depth); // manga
      limb(ctx, A.elbow, A.wrist, w(0.04), w(0.03), SKIN, depth);
      limb(ctx, A.wrist, A.hand, w(0.035), w(0.025), SKIN, depth);
    };
    // brazo y pierna del fondo, más oscuros
    armDraw(R.armF, -0.12);
    leg(legFar(w(0.025)), -0.12);
    // tronco con camiseta y short
    const ttr = R.ttr, nx = Math.cos(ttr), ny = Math.sin(ttr);
    const at = (u, off) => { const p = along(R.hip, R.shoulder, u); return { x: p.x + nx * off, y: p.y + ny * off }; };
    const gr = ctx.createLinearGradient(at(0.5, w(0.08)).x, at(0.5, w(0.08)).y, at(0.5, -w(0.08)).x, at(0.5, -w(0.08)).y);
    gr.addColorStop(0, shade(JERSEY, 0.1)); gr.addColorStop(0.6, JERSEY); gr.addColorStop(1, shade(JERSEY, -0.15));
    ctx.fillStyle = gr; ctx.beginPath();
    const front = [at(0.05, w(0.055)), at(0.4, w(0.052)), at(0.78, w(0.07)), at(1, w(0.045))];
    const back = [at(1, -w(0.05)), at(0.75, -w(0.058)), at(0.4, -w(0.05)), at(0.05, -w(0.062))];
    ctx.moveTo(front[0].x, front[0].y); ctx.bezierCurveTo(front[1].x, front[1].y, front[2].x, front[2].y, front[3].x, front[3].y);
    ctx.lineTo(back[0].x, back[0].y); ctx.bezierCurveTo(back[1].x, back[1].y, back[2].x, back[2].y, back[3].x, back[3].y); ctx.closePath(); ctx.fill();
    // short (cubre la cadera y el inicio del muslo)
    const nearLeg = { hip: R.hip, knee: R.knee };
    leg({ heel: R.heel, toe: R.toe, ankle: R.ankle, knee: R.knee, hip: R.hip }, 0);
    limb(ctx, R.hip, along(nearLeg.hip, nearLeg.knee, 0.38), w(0.115), w(0.095), SHORTS, 0);
    // franja lateral de la camiseta
    ctx.strokeStyle = 'rgba(244,192,27,.85)'; ctx.lineWidth = w(0.012); ctx.beginPath();
    const s1 = at(0.15, 0), s2 = at(0.92, 0); ctx.moveTo(s1.x, s1.y); ctx.lineTo(s2.x, s2.y); ctx.stroke();
    // cuello y cabeza
    limb(ctx, R.shoulder, R.neck, w(0.045), w(0.04), SKIN, -0.03);
    ctx.fillStyle = SKIN; ctx.beginPath(); ctx.ellipse(R.head.x, R.head.y, w(0.058), w(0.068), 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = HAIR; ctx.beginPath(); ctx.ellipse(R.head.x - w(0.012), R.head.y - w(0.022), w(0.06), w(0.05), -0.3, Math.PI * 0.95, Math.PI * 2.15); ctx.fill();
    ctx.beginPath(); ctx.ellipse(R.head.x - w(0.07), R.head.y - w(0.005), w(0.022), w(0.04), 0.5, 0, Math.PI * 2); ctx.fill(); // cola de caballo
    ctx.fillStyle = shade(SKIN, -0.12); ctx.beginPath(); ctx.arc(R.head.x - w(0.008), R.head.y + w(0.006), w(0.011), 0, Math.PI * 2); ctx.fill(); // oreja
    // brazo cercano
    armDraw(R.armN, 0);
    // marca de la rodilla
    ctx.strokeStyle = kneeColor; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(R.knee.x, R.knee.y, w(0.06), 0, Math.PI * 2); ctx.stroke();
    if (label) {
      ctx.font = '600 13px Barlow, system-ui, sans-serif';
      const tw = ctx.measureText(label).width + 12;
      ctx.fillStyle = 'rgba(8,14,26,.78)'; ctx.fillRect(R.knee.x + w(0.08), R.knee.y - 11, tw, 22);
      ctx.fillStyle = '#fff'; ctx.fillText(label, R.knee.x + w(0.08) + 6, R.knee.y + 4);
    }
  }

  /** vista frontal: mismas alturas que la lateral; el valgo lleva las rodillas hacia adentro */
  function drawFrontal(ctx, R, P, cx, Hb, kneeColor, label) {
    const w = (f) => f * Hb;
    const hipW = w(0.085), footW = w(0.1), inward = P.v * w(0.07);
    const legs = [-1, 1].map((sd) => {
      const ankle = { x: cx + sd * footW, y: R.ankle.y };
      const hip = { x: cx + sd * hipW, y: R.hip.y };
      const knee = { x: (ankle.x + hip.x) / 2 - sd * inward, y: R.knee.y };
      return { sd, ankle, hip, knee };
    });
    legs.forEach((L) => {
      limb(ctx, L.hip, L.knee, w(0.1), w(0.068), SKIN, 0);
      limb(ctx, L.knee, L.ankle, w(0.064), w(0.04), SKIN, -0.02);
      limb(ctx, along(L.knee, L.ankle, 0.72), L.ankle, w(0.045), w(0.042), SOCK, 0);
      ctx.fillStyle = SHOE; ctx.beginPath(); ctx.ellipse(L.ankle.x + L.sd * w(0.01), L.ankle.y + w(0.03), w(0.045), w(0.03), 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = PAD; ctx.beginPath(); ctx.ellipse(L.knee.x, L.knee.y + w(0.005), w(0.042), w(0.052), 0, 0, Math.PI * 2); ctx.fill();
    });
    // short y camiseta con número
    const shY = R.shoulder.y, hipY = R.hip.y;
    ctx.fillStyle = SHORTS; ctx.beginPath();
    ctx.moveTo(cx - w(0.13), hipY - w(0.04)); ctx.lineTo(cx + w(0.13), hipY - w(0.04)); ctx.lineTo(cx + w(0.15), hipY + w(0.1)); ctx.lineTo(cx + w(0.02), hipY + w(0.1)); ctx.lineTo(cx, hipY + w(0.05)); ctx.lineTo(cx - w(0.02), hipY + w(0.1)); ctx.lineTo(cx - w(0.15), hipY + w(0.1)); ctx.closePath(); ctx.fill();
    const gr = ctx.createLinearGradient(cx - w(0.15), 0, cx + w(0.15), 0);
    gr.addColorStop(0, shade(JERSEY, -0.12)); gr.addColorStop(0.5, shade(JERSEY, 0.06)); gr.addColorStop(1, shade(JERSEY, -0.12));
    ctx.fillStyle = gr; ctx.beginPath();
    ctx.moveTo(cx - w(0.12), hipY - w(0.02)); ctx.quadraticCurveTo(cx - w(0.13), (hipY + shY) / 2, cx - w(0.15), shY + w(0.02));
    ctx.lineTo(cx + w(0.15), shY + w(0.02)); ctx.quadraticCurveTo(cx + w(0.13), (hipY + shY) / 2, cx + w(0.12), hipY - w(0.02)); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#f4c01b'; ctx.font = `700 ${w(0.09)}px "Barlow Condensed", Arial, sans-serif`; ctx.textAlign = 'center';
    ctx.fillText('7', cx, (hipY + shY) / 2 + w(0.03)); ctx.textAlign = 'left';
    // brazos
    [-1, 1].forEach((sd) => {
      const sh = { x: cx + sd * w(0.15), y: shY + w(0.035) };
      const a = rad(Math.min(P.arm, 90) * 0.35 + 8);
      const el = { x: sh.x + sd * w(0.186) * Math.sin(a), y: sh.y + w(0.186) * Math.cos(a) };
      const ha = { x: el.x + sd * w(0.2) * Math.sin(a * 0.6), y: el.y + w(0.2) * Math.cos(a * 0.6) };
      limb(ctx, sh, el, w(0.055), w(0.042), SKIN, -0.02);
      limb(ctx, sh, along(sh, el, 0.4), w(0.065), w(0.06), JERSEY, 0);
      limb(ctx, el, ha, w(0.042), w(0.03), SKIN, -0.02);
    });
    // cabeza
    const head = { x: cx, y: shY - w(0.11) };
    limb(ctx, { x: cx, y: shY + w(0.01) }, { x: cx, y: head.y + w(0.05) }, w(0.05), w(0.045), SKIN, -0.05);
    ctx.fillStyle = SKIN; ctx.beginPath(); ctx.ellipse(head.x, head.y, w(0.055), w(0.068), 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = HAIR; ctx.beginPath(); ctx.ellipse(head.x, head.y - w(0.025), w(0.06), w(0.05), 0, Math.PI, Math.PI * 2); ctx.fill();
    // marcas de las rodillas
    legs.forEach((L) => { ctx.strokeStyle = kneeColor; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(L.knee.x, L.knee.y, w(0.065), 0, Math.PI * 2); ctx.stroke(); });
    if (label) {
      const L = legs[1];
      ctx.font = '600 13px Barlow, system-ui, sans-serif';
      const tw = ctx.measureText(label).width + 12;
      ctx.fillStyle = 'rgba(8,14,26,.78)'; ctx.fillRect(L.knee.x + w(0.09), L.knee.y - 11, tw, 22);
      ctx.fillStyle = '#fff'; ctx.fillText(label, L.knee.x + w(0.09) + 6, L.knee.y + 4);
    }
    return legs;
  }

  /** gimnasio de fondo: pared, tribuna, piso de cancha con línea y reflejo */
  function drawGym(ctx, w, h, ground) {
    const wall = ctx.createLinearGradient(0, 0, 0, ground);
    wall.addColorStop(0, '#152238'); wall.addColorStop(1, '#22344f');
    ctx.fillStyle = wall; ctx.fillRect(0, 0, w, ground);
    // tribuna con filas
    ctx.fillStyle = '#1b2a42'; ctx.fillRect(0, ground * 0.42, w, ground * 0.3);
    ctx.strokeStyle = 'rgba(255,255,255,.06)'; ctx.lineWidth = 1;
    for (let y = ground * 0.45; y < ground * 0.72; y += ground * 0.05) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
    // luces del techo
    for (let x = w * 0.12; x < w; x += w * 0.26) { const g = ctx.createRadialGradient(x, 0, 2, x, 0, w * 0.18); g.addColorStop(0, 'rgba(255,255,240,.22)'); g.addColorStop(1, 'rgba(255,255,240,0)'); ctx.fillStyle = g; ctx.fillRect(x - w * 0.18, 0, w * 0.36, w * 0.18); }
    // zona libre azul y cancha naranja en perspectiva
    ctx.fillStyle = '#1f4b78'; ctx.fillRect(0, ground - 2, w, h - ground + 2);
    const fl = ctx.createLinearGradient(0, ground, 0, h);
    fl.addColorStop(0, '#c97a3a'); fl.addColorStop(1, '#e09a58');
    ctx.fillStyle = fl; ctx.beginPath(); ctx.moveTo(w * 0.04, ground); ctx.lineTo(w * 0.96, ground); ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(w * 0.06, ground + (h - ground) * 0.55); ctx.lineTo(w * 0.94, ground + (h - ground) * 0.55); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.07)'; ctx.fillRect(0, ground, w, (h - ground) * 0.25);
  }

  function drawFigure(cv, soft) {
    const { ctx, w, h } = BV.chart.canvas(cv, cv.clientWidth, Math.round(cv.clientWidth * 0.85));
    const C = colors();
    const P = pose(st.t, soft);
    const ground = h * 0.85;
    // escala para que quepa el salto completo con los brazos arriba (alcance ≈ 1,3 × estatura)
    const Hb = Math.min(h * 0.62, (ground - h * 0.04) / (1.32 + st.jump / 100 / st.hM));
    const pxm = Hb / st.hM;               // px por metro
    const lift = P.y * pxm;
    ctx.clearRect(0, 0, w, h);
    cargarSprites();
    if (SP) {
      const f = SP.fondo, e = Math.max(w / f.width, h / f.height);
      ctx.drawImage(f, (w - f.width * e) / 2, (h - f.height * e) / 2, f.width * e, f.height * e);
    } else drawGym(ctx, w, h, ground);
    const x0 = w * (st.view === 'lateral' ? 0.48 : 0.5);
    // sombra: más pequeña y tenue cuanto más alto está el cuerpo
    const sh = Math.max(0.35, 1 - lift / (Hb * 0.5));
    ctx.fillStyle = `rgba(0,0,0,${0.32 * sh})`;
    ctx.beginPath(); ctx.ellipse(x0, ground + 3, Hb * 0.13 * sh, Hb * 0.022 * sh, 0, 0, Math.PI * 2); ctx.fill();
    const danger = !soft && P.tau >= 0 && (st.view === 'frontal' ? P.v > 0.2 : P.tau < 0.35);
    const kneeColor = soft ? C.good : danger ? C.crit : 'rgba(255,255,255,.55)';
    if (SP) {
      if (st.view === 'lateral' && P.tau < 0) {
        [0.09, 0.05].forEach((back, i) => {
          const Q = pose(Math.max(0, st.t - back), soft);
          if (Q.tau < 0) pintarPersona(ctx, Q, soft, x0, ground, Hb, Q.y * pxm, 0.14 + i * 0.1);
        });
      }
      const r = pintarPersona(ctx, P, soft, x0, ground, Hb, lift, 1);
      marcaRodilla(ctx, r, Hb, kneeColor, st.view === 'lateral' ? `Knee ${Math.round(P.k)}°` : soft ? 'Knees aligned' : P.v > 0.2 ? 'Valgus: knees caving in' : '');
    } else if (st.view === 'lateral') {
      // estela del movimiento en el aire (principio de arcos)
      if (P.tau < 0) {
        [0.09, 0.05].forEach((back, i) => {
          const Q = pose(Math.max(0, st.t - back), soft);
          if (Q.tau >= 0) return;
          ctx.globalAlpha = 0.12 + i * 0.08;
          drawLateral(ctx, rigLateral(Q, x0, ground, Hb, Q.y * pxm), Hb, 'rgba(0,0,0,0)', '');
          ctx.globalAlpha = 1;
        });
      }
      const R = rigLateral(P, x0, ground, Hb, lift);
      drawLateral(ctx, R, Hb, kneeColor, `Knee ${Math.round(P.k)}°`);
    } else {
      const R = rigLateral(P, x0, ground, Hb, lift);
      drawFrontal(ctx, R, P, x0, Hb, kneeColor, soft ? 'Knees aligned' : P.v > 0.2 ? 'Valgus: knees caving in' : 'Knees');
    }
    // flecha de la fuerza del piso
    const dtS = (soft ? st.dtSoft : st.dtStiff) / 1000, pk = soft ? st.pkSoft : st.pkStiff;
    const F = P.tau >= 0 ? force(P.tau, dtS, pk) : 0;
    if (F > 0) {
      const len = Math.min(h * 0.5, F * h * 0.06);
      const col = soft ? C.s1 : C.s2;
      ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 6;
      const ax = x0 + Hb * (st.view === 'lateral' ? 0.13 : 0.2);
      ctx.beginPath(); ctx.moveTo(ax, ground + 2); ctx.lineTo(ax, ground - len); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(ax - 10, ground - len + 11); ctx.lineTo(ax, ground - len - 5); ctx.lineTo(ax + 10, ground - len + 11); ctx.fill();
      ctx.font = '700 17px "Barlow Condensed", sans-serif';
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(8,14,26,.7)'; ctx.strokeText(`${fmt(F, 1)} × weight`, ax + 13, ground - len + 14);
      ctx.fillText(`${fmt(F, 1)} × weight`, ax + 13, ground - len + 14);
    }
    // fase
    ctx.fillStyle = 'rgba(8,14,26,.62)'; ctx.fillRect(6, 6, 96, 40);
    ctx.font = '600 12px Barlow, system-ui, sans-serif'; ctx.fillStyle = 'rgba(255,255,255,.92)';
    const phase = P.tau < 0 ? 'In the air' : P.tau <= dtS ? 'Cushioning' : 'Recovering';
    ctx.fillText(phase, 12, 20);
    ctx.fillText(`Δt = ${soft ? st.dtSoft : st.dtStiff} ms`, 12, 38);
  }

  function drawForce() {
    const cv = st.cvF;
    const { ctx, w, h } = BV.chart.canvas(cv, cv.clientWidth, Math.round(cv.clientWidth * 0.42));
    const C = colors();
    ctx.clearRect(0, 0, w, h);
    const m = { l: 40, r: 12, t: 12, b: 26 };
    const Tmax = Math.max(0.45, st.dtSoft / 1000 + 0.1);
    const Fmax = Math.max(4, Math.ceil(st.pkStiff + 0.5));
    const X = (t) => m.l + (t / Tmax) * (w - m.l - m.r);
    const Y = (f) => h - m.b - (f / Fmax) * (h - m.t - m.b);
    ctx.font = '11px Barlow, system-ui, sans-serif'; ctx.fillStyle = C.ink3; ctx.strokeStyle = C.line; ctx.lineWidth = 1;
    const step = Fmax > 8 ? 2 : 1;
    for (let f = 0; f <= Fmax; f += step) { ctx.setLineDash([2, 4]); ctx.beginPath(); ctx.moveTo(m.l, Y(f)); ctx.lineTo(w - m.r, Y(f)); ctx.stroke(); ctx.setLineDash([]); ctx.fillText(f + '×', 8, Y(f) + 4); }
    for (let t = 0; t <= Tmax + 1e-9; t += 0.1) ctx.fillText(Math.round(t * 1000) + ' ms', X(t) - 14, h - 8);
    const curve = (dt, pk, col) => {
      ctx.fillStyle = col; ctx.globalAlpha = 0.12;
      ctx.beginPath(); ctx.moveTo(X(0), Y(1));
      for (let i = 0; i <= 120; i++) { const t = (i / 120) * dt; ctx.lineTo(X(t), Y(force(t, dt, pk))); }
      ctx.lineTo(X(dt), Y(1)); ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1;
      ctx.strokeStyle = col; ctx.lineWidth = 2.5; ctx.beginPath();
      for (let i = 0; i <= 200; i++) { const t = (i / 200) * Tmax; const f = force(t, dt, pk); i ? ctx.lineTo(X(t), Y(f)) : ctx.moveTo(X(t), Y(f)); }
      ctx.stroke();
      ctx.fillStyle = C.ink; ctx.font = '700 13px "Barlow Condensed", sans-serif';
      ctx.fillText(`${fmt(pk, 1)}×`, X(dt / 2) + 6, Y(pk) - 4);
    };
    curve(st.dtSoft / 1000, st.pkSoft, C.s1);
    curve(st.dtStiff / 1000, st.pkStiff, C.s2);
    // cursor sincronizado con la animación
    const tau = pose(st.t, true).tau;
    if (tau >= 0 && tau <= Tmax) { ctx.strokeStyle = C.ink; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(X(tau), m.t); ctx.lineTo(X(tau), h - m.b); ctx.stroke(); }
  }

  V.destroy = () => { if (st) cancelAnimationFrame(st.raf); st = null; };
  BV.views.aterrizaje = V;
})(window.BV);
