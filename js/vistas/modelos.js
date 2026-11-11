/* BioVoley Lab — Modelos matemáticos: el salto y el balón como funciones cuadráticas */
(function (BV) {
  'use strict';
  const { $, fmt } = BV;
  const V = {
    title: 'Models', nav: 'Models',
    sub: 'The jump and the ball as parabolas',
    tags: ['mat', 'tec'],
  };
  let st = null;
  const PRESETS = {
    flot: { label: 'Float serve', h0: 2.7, v: 58, th: 10, d: 9.5 },
    salto: { label: 'Jump serve', h0: 3.1, v: 70, th: 4, d: 10.0 },
    bajo: { label: 'Underhand serve', h0: 0.9, v: 40, th: 38, d: 9.5 },
    remate: { label: 'Spike', h0: 3.0, v: 80, th: -20, d: 1.0 },
    zaguera: { label: 'Back-row attack', h0: 3.0, v: 65, th: -6, d: 3.5 },
  };

  V.render = function (el) {
    const p = BV.players()[0];
    const f = p ? BV.calc.fatigue(p.id) : null;
    const ms = f && f.sets.length ? Math.round(BV.calc.flightFromCm(f.sets[0].mean)) : 560;
    st = { tab: 'salto', ms, ball: { ...PRESETS.flot }, net: BV.data.settings.net || 2.24 };
    el.innerHTML = `
      <div class="seg" role="tablist" aria-label="Model">
        <button type="button" data-tab="salto" aria-pressed="true">Jump</button>
        <button type="button" data-tab="balon" aria-pressed="false">Ball</button>
      </div>
      <div id="mBody"></div>`;
    el.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => {
      st.tab = b.dataset.tab; el.querySelectorAll('[data-tab]').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); body();
    }));
    st.el = el;
    body();
  };

  function body() {
    const box = $('#mBody', st.el);
    if (st.tab === 'salto') {
      box.innerHTML = `
        <div class="grid g-side">
          <div class="card"><canvas class="plot" id="cvJ" data-ratio="0.5" aria-label="Center of mass height over time"></canvas><div class="bigres" id="jRes" style="margin-top:12px"></div></div>
          <div class="card stack">
            <h3>Flight time</h3>
            <input type="range" id="jT" min="300" max="900" step="2" value="${st.ms}" aria-label="Flight time">
            <div class="range-l"><span>300 ms</span><b id="jTv"></b><span>900 ms</span></div>
            <label class="field"><span>Camera used to measure</span><select id="jFps"><option value="30">30 fps</option><option value="60">60 fps</option><option value="120">120 fps</option><option value="240" selected>240 fps (My Jump)</option></select></label>
            <div class="formula" id="jForm"></div>
          </div>
        </div>`;
      $('#jT', box).addEventListener('input', (e) => { st.ms = +e.target.value; drawJump(); });
      $('#jFps', box).addEventListener('change', drawJump);
      drawJump();
    } else {
      const b = st.ball;
      box.innerHTML = `
        <div class="grid g-side">
          <div class="card"><canvas class="plot" id="cvB" data-ratio="0.48" aria-label="Ball trajectory"></canvas><div class="bigres" id="bRes" style="margin-top:12px"></div></div>
          <div class="card stack">
            <div class="row">${Object.entries(PRESETS).map(([k, p]) => `<button class="btn btn-sm" type="button" data-pre="${k}">${p.label}</button>`).join('')}</div>
            ${slider('bH', 'Contact height', 0.5, 3.6, 0.05, b.h0, 'm')}
            ${slider('bV', 'Launch speed', 10, 110, 1, b.v, 'km/h')}
            ${slider('bA', 'Launch angle', -30, 75, 1, b.th, '°')}
            ${slider('bD', 'Horizontal distance to the net', 0.3, 13, 0.1, b.d, 'm')}
            <label class="field"><span>Net height</span><select id="bN">${BV.NET.map((n) => `<option value="${n.v}" ${n.v === st.net ? 'selected' : ''}>${n.label}</option>`).join('')}</select></label>
            <div class="formula" id="bForm"></div>
            <p class="note">Model without air resistance: a real float serve drops sooner and irregularly.</p>
          </div>
        </div>`;
      const bind = (id, key) => $(`#${id}`, box).addEventListener('input', (e) => { st.ball[key] = +e.target.value; $(`#${id}v`, box).textContent = e.target.value; drawBall(); });
      bind('bH', 'h0'); bind('bV', 'v'); bind('bA', 'th'); bind('bD', 'd');
      $('#bN', box).addEventListener('change', (e) => { st.net = +e.target.value; drawBall(); });
      box.querySelectorAll('[data-pre]').forEach((btn) => btn.addEventListener('click', () => { st.ball = { ...PRESETS[btn.dataset.pre] }; body(); }));
      drawBall();
    }
  }
  const slider = (id, label, min, max, step, val, unit) => `<label class="field"><span>${label}</span><input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${val}"></label><div class="range-l"><span>${min} ${unit}</span><b><span id="${id}v">${val}</span> ${unit}</b><span>${max} ${unit}</span></div>`;

  function axes(ctx, w, h, m, X, Y, xT, yT, xl, yl) {
    const ink3 = BV.cssVar('--ink-3'), line = BV.cssVar('--line');
    ctx.font = '11px Barlow, system-ui, sans-serif'; ctx.lineWidth = 1;
    yT.forEach((v) => { ctx.strokeStyle = line; ctx.setLineDash([2, 4]); ctx.beginPath(); ctx.moveTo(m.l, Y(v)); ctx.lineTo(w - m.r, Y(v)); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = ink3; ctx.textAlign = 'right'; ctx.fillText(fmt(v, v % 1 ? 1 : 0), m.l - 6, Y(v) + 4); });
    ctx.textAlign = 'center';
    xT.forEach((v) => ctx.fillText(fmt(v, v % 1 ? 1 : 0), X(v), h - m.b + 15));
    ctx.fillText(xl, (m.l + w - m.r) / 2, h - 4);
    ctx.textAlign = 'left'; ctx.fillText(yl, m.l + 4, m.t + 10);
  }

  /* ---------- salto ---------- */
  function drawJump() {
    const box = $('#mBody', st.el);
    const t = st.ms / 1000, g = BV.G, v0 = (g * t) / 2, H = (g * t * t) / 8;
    const fps = +$('#jFps', box).value;
    const dH = ((g * t) / 4) * (1 / fps) * 100; // error de altura por un cuadro (derivada)
    $('#jTv', box).textContent = st.ms + ' ms';
    const cv = $('#cvJ', box);
    const { ctx, w, h } = BV.chart.canvas(cv, cv.clientWidth, Math.round(cv.clientWidth * 0.5));
    ctx.clearRect(0, 0, w, h);
    const m = { l: 44, r: 14, t: 16, b: 34 };
    const tMax = 0.95, hMax = Math.max(45, Math.ceil((H * 100 + 8) / 10) * 10);
    const X = (s) => m.l + (s / tMax) * (w - m.l - m.r), Y = (cm) => h - m.b - (cm / hMax) * (h - m.t - m.b);
    axes(ctx, w, h, m, (s) => X(s / 1000), Y, BV.chart.niceTicks(0, 900, 6), BV.chart.niceTicks(0, hMax, 4), 'time (ms)', 'height (cm)');
    const s1 = BV.cssVar('--s1'), s2 = BV.cssVar('--s2'), ink = BV.cssVar('--ink');
    // parábola
    ctx.fillStyle = s1; ctx.globalAlpha = 0.1; ctx.beginPath(); ctx.moveTo(X(0), Y(0));
    for (let i = 0; i <= 100; i++) { const s = (i / 100) * t; ctx.lineTo(X(s), Y((v0 * s - 0.5 * g * s * s) * 100)); }
    ctx.lineTo(X(t), Y(0)); ctx.fill(); ctx.globalAlpha = 1;
    ctx.strokeStyle = s1; ctx.lineWidth = 2.5; ctx.beginPath();
    for (let i = 0; i <= 100; i++) { const s = (i / 100) * t; const y = (v0 * s - 0.5 * g * s * s) * 100; i ? ctx.lineTo(X(s), Y(y)) : ctx.moveTo(X(s), Y(y)); }
    ctx.stroke();
    // cuadros de la cámara
    ctx.fillStyle = s2;
    for (let s = 0; s <= t + 1e-9; s += 1 / fps) { if (fps > 60 && Math.round(s * fps) % Math.round(fps / 60)) continue; ctx.beginPath(); ctx.arc(X(s), Y((v0 * s - 0.5 * g * s * s) * 100), 2.6, 0, Math.PI * 2); ctx.fill(); }
    // vértice y raíces
    ctx.strokeStyle = ink; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(X(t / 2), Y(0)); ctx.lineTo(X(t / 2), Y(H * 100)); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = ink; ctx.beginPath(); ctx.arc(X(t / 2), Y(H * 100), 5, 0, Math.PI * 2); ctx.fill();
    ctx.font = '700 14px "Barlow Condensed", sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(`vertex (${Math.round(st.ms / 2)} ms ; ${fmt(H * 100)} cm)`, X(t / 2), Y(H * 100) - 10);
    ctx.font = '12px Barlow, system-ui, sans-serif';
    ctx.fillText('despegue', X(0) + 4, Y(0) - 8); ctx.fillText('aterrizaje', X(t), Y(0) - 8);
    ctx.textAlign = 'left';
    $('#jRes', box).innerHTML = `<div><span>Maximum height</span><b>${fmt(H * 100)} cm</b></div><div><span>Takeoff speed</span><b>${fmt(v0, 2)} m/s</b></div><div><span>Error per frame</span><b>±${fmt(dH, 1)} cm</b></div>`;
    $('#jForm', box).innerHTML = `
      h(t) = v₀·t − ½·g·t² → a = <b>−${fmt(g / 2, 3)}</b>, b = v₀, c = 0<br>
      Roots: h = 0 at t = 0 and t = 2v₀/g → flight lasts t<sub>v</sub><br>
      v₀ = g·t<sub>v</sub>/2 = 9.81 × ${fmt(t, 3)} / 2 = <b>${fmt(v0, 3)} m/s</b><br>
      Vertex: t = −b/2a = v₀/g = <b>${fmt(t / 2, 3)} s</b> (half of the flight)<br>
      h<sub>max</sub> = v₀²/2g = g·t<sub>v</sub>²/8 = <b>${fmt(H * 100, 1)} cm</b><br>
      Error: dh/dt = g·t<sub>v</sub>/4 → Δh ≈ ${fmt(g * t / 4, 2)} m/s × 1/${fps} s = <b>±${fmt(dH, 1)} cm</b> per frame of error`;
  }

  /* ---------- balón ---------- */
  function drawBall() {
    const box = $('#mBody', st.el);
    const b = st.ball, g = BV.G, v = b.v / 3.6, th = (b.th * Math.PI) / 180;
    const vx = v * Math.cos(th);
    const A = -g / (2 * vx * vx), B = Math.tan(th), Cc = b.h0;
    const y = (x) => A * x * x + B * x + Cc;
    const disc = B * B - 4 * A * Cc;
    const xL = (-B - Math.sqrt(disc)) / (2 * A); // raíz positiva (A < 0)
    const atNet = y(b.d), clear = atNet - st.net;
    const xV = -B / (2 * A), yV = y(xV);
    const past = xL - b.d;
    const tF = xL / vx;
    let verdict, lvl;
    if (b.d > xL) { verdict = 'Does not reach the net'; lvl = 'crit'; }
    else if (clear < 0) { verdict = 'Hits the net'; lvl = 'crit'; }
    else if (past > 9) { verdict = 'Lands out past the end line'; lvl = 'crit'; }
    else if (clear < 0.3) { verdict = 'Barely clears the net'; lvl = 'warn'; }
    else { verdict = 'Lands in the court'; lvl = 'ok'; }

    const cv = $('#cvB', box);
    const { ctx, w, h } = BV.chart.canvas(cv, cv.clientWidth, Math.round(cv.clientWidth * 0.48));
    ctx.clearRect(0, 0, w, h);
    const m = { l: 40, r: 14, t: 14, b: 34 };
    const xMax = Math.max(b.d + 9.5, Math.min(xL + 1, 26)), yMax = Math.max(4, Math.ceil(Math.max(yV, b.h0) + 0.6));
    const X = (x) => m.l + (x / xMax) * (w - m.l - m.r), Y = (yy) => h - m.b - (yy / yMax) * (h - m.t - m.b);
    // cancha rival y piso
    ctx.fillStyle = BV.cssVar('--court'); ctx.globalAlpha = 0.55; ctx.fillRect(X(b.d), Y(0), X(b.d + 9) - X(b.d), 6); ctx.globalAlpha = 1;
    axes(ctx, w, h, m, X, Y, BV.chart.niceTicks(0, xMax, 6), BV.chart.niceTicks(0, yMax, 4), 'horizontal distance from contact (m)', 'height (m)');
    // red
    ctx.strokeStyle = BV.cssVar('--ink'); ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(X(b.d), Y(0)); ctx.lineTo(X(b.d), Y(st.net)); ctx.stroke();
    ctx.fillStyle = BV.cssVar('--ink'); ctx.font = '12px Barlow, system-ui, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(`net ${fmt(st.net, 2)} m`, X(b.d), Y(st.net) - 8);
    ctx.fillText('rival end line', X(b.d + 9), Y(0) - 8);
    ctx.strokeStyle = BV.cssVar('--ink-3'); ctx.lineWidth = 1; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(X(b.d + 9), Y(0)); ctx.lineTo(X(b.d + 9), Y(0.6)); ctx.stroke(); ctx.setLineDash([]);
    // trayectoria
    const s1 = BV.cssVar(lvl === 'crit' ? '--s2' : '--s1');
    ctx.strokeStyle = s1; ctx.lineWidth = 2.5; ctx.beginPath();
    const xEnd = Math.min(xL, xMax);
    for (let i = 0; i <= 160; i++) { const x = (i / 160) * xEnd; const yy = y(x); i ? ctx.lineTo(X(x), Y(yy)) : ctx.moveTo(X(x), Y(yy)); }
    ctx.stroke();
    const dotAt = (x, yy, col, r = 5) => { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(X(x), Y(yy), r, 0, Math.PI * 2); ctx.fill(); };
    dotAt(0, b.h0, BV.cssVar('--ball'), 7);
    if (b.d <= xL) dotAt(b.d, atNet, BV.cssVar('--ink'), 4);
    if (xV > 0 && xV < xL) { dotAt(xV, yV, BV.cssVar('--ink'), 4); ctx.fillStyle = BV.cssVar('--ink'); ctx.fillText(`vertex ${fmt(yV, 2)} m`, X(xV), Y(yV) - 10); }
    if (xL <= xMax) dotAt(xL, 0, s1, 6);
    ctx.textAlign = 'left';

    $('#bRes', box).innerHTML = `
      <div><span>Result</span><b style="font-size:1.1rem">${BV.chip(lvl, verdict)}</b></div>
      <div><span>Height over the net</span><b>${b.d <= xL ? (clear >= 0 ? '+' : '') + fmt(clear, 2) + ' m' : '—'}</b></div>
      <div><span>Lands at</span><b>${fmt(past, 1)} m from the net</b></div>
      <div><span>Maximum height</span><b>${fmt(Math.max(yV, b.h0), 2)} m</b></div>
      <div><span>Time in the air</span><b>${fmt(tF, 2)} s</b></div>
      <div><span>Horizontal speed</span><b>${fmt(vx, 1)} m/s</b></div>`;
    $('#bForm', box).innerHTML = `
      y(x) = h₀ + x·tan θ − g·x² / (2·v²·cos²θ)<br>
      a = −g/(2v²cos²θ) = <b>${fmt(A, 4)}</b> · b = tan θ = <b>${fmt(B, 3)}</b> · c = h₀ = <b>${fmt(Cc, 2)}</b><br>
      Over the net: y(${fmt(b.d, 1)}) = <b>${fmt(atNet, 2)} m</b><br>
      Discriminant: Δ = b² − 4ac = <b>${fmt(disc, 3)}</b> → x = (−b − √Δ)/(2a) = <b>${fmt(xL, 2)} m</b><br>
      Vertex: x = −b/2a = ${fmt(xV, 2)} m → y = <b>${fmt(yV, 2)} m</b>`;
  }

  V.destroy = () => { st = null; };
  BV.on('resize', () => { if (st) body(); });
  BV.on('theme', () => { if (st) body(); });
  BV.views.modelos = V;
})(window.BV);
