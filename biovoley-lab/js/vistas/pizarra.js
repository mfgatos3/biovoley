/* BioVoley Lab — Pizarra táctica animada
   Cancha de 18 × 9 m vista desde arriba; nuestro equipo a la izquierda, red en x = 9.
   Zonas (FIVB): 4-3-2 adelante, 5-6-1 atrás; la izquierda de quien mira la red es arriba. */
(function (BV) {
  'use strict';
  const { $, esc, fmt, chip } = BV;
  const NS = 'http://www.w3.org/2000/svg';
  const ZONE = { 1: { x: 2.4, y: 7.4 }, 2: { x: 7.6, y: 7.4 }, 3: { x: 7.6, y: 4.5 }, 4: { x: 7.6, y: 1.6 }, 5: { x: 2.4, y: 1.6 }, 6: { x: 2.4, y: 4.5 } };
  const FRONT = [2, 3, 4], BACK = [1, 5, 6];
  const ROLE_COLOR = { S: 'var(--t-eng)', OH: 'var(--s1)', OPP: 'var(--s2)', MB: 'var(--s3)', L: 'var(--s5)' };
  const V = {
    title: 'Board', nav: 'Board',
    sub: 'Rotations, plays and substitutions',
    tags: ['ef', 'art', 'mat'],
  };
  let st = null;

  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2); // entrada y salida lenta

  V.render = function (el) {
    const D = BV.data;
    if (D.liberoId === undefined) { const L0 = BV.players().find((p) => p.pos === 'L'); D.liberoId = L0 ? L0.id : ''; }
    if (D.liberoId && !BV.player(D.liberoId)) D.liberoId = '';
    st = { el, pos: {}, ball: { x: 19.2, y: 6.5, h: 2.4 }, anim: null, frames: [], caption: '', drag: null };
    fillLineup();
    el.innerHTML = `
      ${BV.players().length < 6 ? `<div class="card flat row between"><span><strong>Your team has ${BV.players().length} ${BV.players().length === 1 ? 'player' : 'players'}.</strong> <span class="muted">A full lineup needs at least 6.</span></span><a class="btn btn-sm btn-primary" href="#setup">Add players</a></div>` : ''}
      <div class="grid g-side">
        <div class="stack">
          <div class="card stack">
            <div class="row between">
              <div class="row">
                <button class="btn btn-primary btn-sm" id="tRot" type="button"><svg viewBox="0 0 24 24"><path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/></svg>Rotate</button>
                <button class="btn btn-sm" id="tBase" type="button">Base positions</button>
                <label class="row" style="gap:6px"><span class="note">Libero</span><select class="inp" id="tLib" style="width:auto" title="Comes in for the ${BV.w.la} middle ${BV.w.zag}"><option value="">No libero</option>${BV.players().map((p) => `<option value="${p.id}" ${p.id === D.liberoId ? 'selected' : ''}>#${p.num} ${esc(p.name.split(' ')[0])}</option>`).join('')}</select></label>
              </div>
              <span class="pnum" id="tRotN" title="Rotation by the setter's zone">R1</span>
            </div>
            <div class="court-wrap"><svg id="court" viewBox="-1.6 -1.3 21.2 11.6" aria-label="Volleyball court"></svg></div>
            <div class="row between"><strong id="tCap" class="muted"></strong><span id="tRule"></span></div>
            <div class="row">
              <select class="inp" id="tPlay" style="width:auto">
                <option value="z4">Attack from zone 4</option>
                <option value="quick">Quick attack</option>
                <option value="switch">Rotation and switch</option>
                <option value="mine">My play</option>
              </select>
              <button class="btn btn-ball btn-sm" id="tGo" type="button">Animate</button>
              <button class="btn btn-sm" id="tVid3" type="button">Show 3D video</button>
              <label class="check"><input type="checkbox" id="tVid" checked> Video at the end</label>
            </div>
            <details class="more"><summary>My play · <span id="tFrames">0 frames</span></summary>
              <div class="row">
                <button class="btn btn-sm" id="tKey" type="button">Save frame</button>
                <button class="btn btn-ghost btn-sm" id="tClr" type="button">Clear frames</button>
              </div>
            </details>
          </div>
        </div>
        <div class="card stack">
          <div class="seg" role="tablist" aria-label="Decisions">
            <button type="button" data-side="tAtt" aria-pressed="true">Set to</button>
            <button type="button" data-side="tSub" aria-pressed="false">Subs</button>
            <button type="button" data-side="tPla" aria-pressed="false">Squad</button>
            <button type="button" data-side="tLine" aria-pressed="false">Lineup</button>
          </div>
          <div id="tAtt" data-sp></div>
          <div id="tSub" data-sp hidden></div>
          <div id="tPla" class="stack" data-sp hidden><div id="tOn"></div><div class="sep"></div><div id="tBench"></div></div>
          <div class="lineup" id="tLine" data-sp hidden></div>
        </div>
      </div>`;
    el.querySelectorAll('[data-side]').forEach((b) => b.addEventListener('click', () => {
      el.querySelectorAll('[data-side]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      el.querySelectorAll('[data-sp]').forEach((x) => { x.hidden = x.id !== b.dataset.side; });
    }));
    buildCourt();
    basePositions();
    renderAll();
    $('#tRot', el).addEventListener('click', rotate);
    $('#tBase', el).addEventListener('click', () => { if (st.anim) return; st.inPlay = false; st.ball = { x: 19.2, y: 6.5, h: 2.4 }; animateTo(baseTargets(), 700, 'Base positions of the rotation.'); });
    $('#tLib', el).addEventListener('change', (e) => {
      D.liberoId = e.target.value;
      Object.keys(D.lineup).forEach((z) => { if (D.lineup[z] === D.liberoId) delete D.lineup[z]; }); // el líbero no va en la alineación
      fillLineup(); BV.save(true); basePositions(); renderAll();
    });
    $('#tGo', el).addEventListener('click', () => playScript($('#tPlay', el).value));
    $('#tVid3', el).addEventListener('click', () => BV.video3d.open({ kind: $('#tPlay', el).value, build: buildScript }));
    $('#tKey', el).addEventListener('click', () => {
      st.frames.push({ pos: JSON.parse(JSON.stringify(st.pos)), ball: { ...st.ball }, label: `Frame ${st.frames.length + 1}` });
      $('#tFrames', el).textContent = st.frames.length + (st.frames.length === 1 ? ' frame' : ' frames');
      $('#tPlay', el).value = 'mine';
      BV.toast('Frame saved. Move the tokens or the ball and save another.');
    });
    $('#tClr', el).addEventListener('click', () => { st.frames = []; $('#tFrames', el).textContent = '0 frames'; });
  };

  /* ---------- alineación ---------- */
  function fillLineup() {
    const D = BV.data;
    Object.keys(D.lineup).forEach((z) => { if (!BV.player(D.lineup[z]) || (D.liberoId && D.lineup[z] === D.liberoId)) delete D.lineup[z]; });
    const used = new Set(Object.values(D.lineup));
    const pool = BV.players().filter((p) => p.id !== D.liberoId && !used.has(p.id) && !BV.cond.active(p).some(BV.cond.blocks))
      .sort((a, b) => (a.pos === 'L') - (b.pos === 'L') || a.num - b.num); // líberos al final
    // sistema 5-1: armador(a) en 1 y opuesto(a) en 4, puntas en 2 y 5, centrales en 3 y 6
    const WANT = { 1: 'S', 2: 'OH', 3: 'MB', 4: 'OPP', 5: 'OH', 6: 'MB' };
    const take = (pred) => { const i = pool.findIndex(pred); return i >= 0 ? pool.splice(i, 1)[0] : null; };
    const empty = [1, 2, 3, 4, 5, 6].filter((z) => !D.lineup[z]);
    empty.forEach((z) => { const p = take((x) => x.pos === WANT[z]); if (p) D.lineup[z] = p.id; });
    empty.filter((z) => !D.lineup[z]).forEach((z) => { const p = take(() => true); if (p) D.lineup[z] = p.id; });
  }
  const libero = () => (BV.data.liberoId ? BV.player(BV.data.liberoId) : null);
  /** quién está en cada zona (el líbero reemplaza a la central de la fila de atrás, salvo al sacar) */
  function onCourt() {
    const D = BV.data, L = libero(), out = {};
    for (let z = 1; z <= 6; z++) {
      const pid = D.lineup[z];
      if (!pid) continue;
      const p = BV.player(pid);
      out[z] = L && BACK.includes(z) && p && p.pos === 'MB' && z !== 1 ? L.id : pid;
    }
    return out;
  }
  function baseTargets() { const oc = onCourt(), t = {}; Object.entries(oc).forEach(([z, pid]) => { t[pid] = { ...ZONE[z] }; }); return t; }
  function basePositions() { st.pos = baseTargets(); st.ball = { x: 19.2, y: 6.5, h: 2.4 }; st.inPlay = false; }

  function rotate() {
    if (st.anim) return;
    st.inPlay = false;
    const D = BV.data, L = { ...D.lineup };
    D.lineup = { 1: L[2], 2: L[3], 3: L[4], 4: L[5], 5: L[6], 6: L[1] };
    Object.keys(D.lineup).forEach((k) => { if (!D.lineup[k]) delete D.lineup[k]; });
    BV.save(true);
    const targets = baseTargets();
    // fichas que entran o salen (líbero) aparecen en su zona
    Object.keys(targets).forEach((pid) => { if (!st.pos[pid]) st.pos[pid] = { x: -1, y: targets[pid].y }; });
    Object.keys(st.pos).forEach((pid) => { if (!targets[pid]) delete st.pos[pid]; });
    buildTokens();
    animateTo(targets, 900, `Clockwise rotation: ${BV.w.la} moves from zone 2 to zone 1 and serves.`);
    renderSide();
  }

  /* ---------- SVG de la cancha ---------- */
  function el(tag, attrs, parent) { const e = document.createElementNS(NS, tag); Object.entries(attrs || {}).forEach(([k, v]) => e.setAttribute(k, v)); if (parent) parent.appendChild(e); return e; }
  function buildCourt() {
    const svg = $('#court', st.el);
    svg.innerHTML = '';
    el('rect', { x: -1.6, y: -1.3, width: 21.2, height: 11.6, class: 'court-out' }, svg);
    el('rect', { x: 0, y: 0, width: 18, height: 9, class: 'court-floor' }, svg);
    el('rect', { x: 0, y: 0, width: 18, height: 9, class: 'court-line' }, svg);
    [6, 12].forEach((x) => el('line', { x1: x, x2: x, y1: 0, y2: 9, class: 'court-line' }, svg));
    el('line', { x1: 9, x2: 9, y1: -0.6, y2: 9.6, class: 'court-net' }, svg);
    [-0.6, 9.6].forEach((y) => el('circle', { cx: 9, cy: y, r: 0.15, fill: 'var(--ink)' }, svg));
    Object.entries(ZONE).forEach(([z, p]) => { const t = el('text', { x: p.x, y: p.y + 0.3, 'text-anchor': 'middle', class: 'court-zone' }, svg); t.textContent = z; });
    const t3 = el('text', { x: 6, y: 9.75, 'text-anchor': 'middle', 'font-size': 0.42, fill: 'var(--ink-3)' }, svg); t3.textContent = '3 m line';
    const tn = el('text', { x: 9, y: -0.8, 'text-anchor': 'middle', 'font-size': 0.42, fill: 'var(--ink-3)' }, svg); tn.textContent = 'net';
    const tu = el('text', { x: 4.5, y: -0.55, 'text-anchor': 'middle', 'font-size': 0.48, 'font-weight': 700, fill: 'var(--ink-2)' }, svg); tu.textContent = 'OUR TEAM';
    const tr = el('text', { x: 13.5, y: -0.55, 'text-anchor': 'middle', 'font-size': 0.48, 'font-weight': 700, fill: 'var(--ink-3)' }, svg); tr.textContent = 'RIVAL';
    st.gTok = el('g', {}, svg);
    st.gBall = el('g', { class: 'token', 'data-ball': '1' }, svg);
    el('ellipse', { class: 'shadow', rx: 0.25, ry: 0.14, fill: 'rgba(0,0,0,.28)' }, st.gBall);
    const b = el('g', { class: 'b' }, st.gBall);
    el('circle', { r: 0.24, fill: 'var(--ball)', stroke: '#1c4fd0', 'stroke-width': 0.06 }, b);
    el('path', { d: 'M-0.24 0 Q0 -0.12 0.24 0 M0 -0.24 Q0.12 0 0 0.24', fill: 'none', stroke: '#1c4fd0', 'stroke-width': 0.05 }, b);
    svg.addEventListener('pointerdown', onDown);
    svg.addEventListener('pointermove', onMove);
    svg.addEventListener('pointerup', onUp);
    svg.addEventListener('pointercancel', onUp);
    buildTokens();
  }

  function buildTokens() {
    const g = st.gTok;
    g.innerHTML = '';
    const oc = onCourt();
    Object.entries(oc).forEach(([z, pid]) => {
      const p = BV.player(pid);
      if (!p) return;
      const r = BV.calc.risk(pid);
      const tg = el('g', { class: 'token', 'data-pid': pid }, g);
      const ring = { ok: 'var(--good)', warn: 'var(--warn)', crit: 'var(--crit)' }[r.level];
      if (ring) el('circle', { class: 'ring', r: 0.62, stroke: ring }, tg);
      el('circle', { class: 'body', r: 0.46, fill: ROLE_COLOR[p.pos] || 'var(--s1)' }, tg);
      const t = el('text', { y: -0.02 }, tg); t.textContent = p.num;
      const nm = el('text', { y: 0.92, class: 'tag-txt' }, tg); nm.textContent = p.name.split(' ')[0] + ' · ' + BV.POS[p.pos].short;
      if (r.level === 'crit') { const w = el('text', { x: 0.5, y: -0.45, class: 'tag-txt', fill: 'var(--crit)', 'font-size': 0.5, 'font-weight': 700 }, tg); w.textContent = '!'; }
    });
    placeAll();
  }

  function placeAll() {
    st.gTok.querySelectorAll('.token').forEach((t) => {
      const p = st.pos[t.dataset.pid];
      if (p) t.setAttribute('transform', `translate(${p.x.toFixed(3)} ${p.y.toFixed(3)})`);
    });
    const b = st.ball, lift = b.h * 0.32, sc = 1 + b.h * 0.07;
    st.gBall.querySelector('.shadow').setAttribute('transform', `translate(${b.x} ${b.y + 0.05}) scale(${Math.max(0.5, 1 - b.h * 0.08)})`);
    const sq = b.squash ? `scale(${sc * 1.15} ${sc * 0.82})` : `scale(${sc})`;
    st.gBall.querySelector('.b').setAttribute('transform', `translate(${b.x} ${b.y - lift}) ${sq}`);
  }

  /* ---------- arrastre ---------- */
  function svgPt(ev) { const svg = $('#court', st.el); const pt = svg.createSVGPoint(); pt.x = ev.clientX; pt.y = ev.clientY; return pt.matrixTransform(svg.getScreenCTM().inverse()); }
  function onDown(ev) {
    const t = ev.target.closest('.token');
    if (!t || st.anim) return;
    st.drag = t.dataset.ball ? { ball: true } : { pid: t.dataset.pid };
    ev.currentTarget.setPointerCapture(ev.pointerId);
  }
  function onMove(ev) {
    if (!st.drag) return;
    const p = svgPt(ev);
    const x = BV.clamp(p.x, -1.2, 19.2), y = BV.clamp(p.y, -0.9, 9.9);
    if (st.drag.ball) { st.ball.x = x; st.ball.y = y; st.ball.h = 0; } else { st.pos[st.drag.pid] = { x, y }; }
    placeAll(); checkRules();
  }
  function onUp() { st.drag = null; }

  /* ---------- reglas de posición (FIVB 7.4) ---------- */
  function checkRules() {
    const oc = onCourt(), P = {};
    Object.entries(oc).forEach(([z, pid]) => { P[z] = st.pos[pid]; });
    const faults = [];
    const name = (z) => { const p = BV.player(oc[z]); return p ? `#${p.num} (zone ${z})` : `zone ${z}`; };
    if (Object.keys(P).length === 6) {
      [[4, 3], [3, 2], [5, 6], [6, 1]].forEach(([a, b]) => { if (!(P[a].y < P[b].y)) faults.push(`${name(a)} must be to the left of ${name(b)}`); });
      [[5, 4], [6, 3], [1, 2]].forEach(([back, front]) => { if (!(P[back].x < P[front].x)) faults.push(`${name(back)} must be farther from the net than ${name(front)}`); });
    }
    const box = $('#tRule', st.el);
    if (st.inPlay) { if (box) { box.innerHTML = chip('na', 'Play in progress: the rule applies at the serve'); box.title = ''; } return []; }
    if (box) box.innerHTML = faults.length ? chip('crit', 'Position fault') : chip('ok', 'Valid positions at the serve');
    if (box) box.title = faults.join('\n');
    if (faults.length && !st.anim) $('#tCap', st.el).textContent = faults[0] + '.';
    return faults;
  }

  /* ---------- animación ---------- */
  function animateTo(targets, ms, caption, ballTo, onEnd) {
    const from = JSON.parse(JSON.stringify(st.pos)), b0 = { ...st.ball };
    const t0 = performance.now();
    if (caption) $('#tCap', st.el).textContent = caption;
    cancelAnimationFrame(st.anim);
    const step = (now) => {
      if (!st) return;
      const u = Math.min(1, (now - t0) / ms), e = ease(u);
      Object.keys(targets).forEach((pid) => {
        const a = from[pid] || targets[pid], b = targets[pid];
        st.pos[pid] = { x: a.x + (b.x - a.x) * e, y: a.y + (b.y - a.y) * e };
      });
      if (ballTo) {
        // el balón viaja en línea recta en planta y en parábola en altura (arco)
        st.ball = { x: b0.x + (ballTo.x - b0.x) * u, y: b0.y + (ballTo.y - b0.y) * u, h: b0.h + (ballTo.h - b0.h) * u + 4 * (ballTo.arc || 0) * u * (1 - u), squash: u > 0.94 };
      }
      placeAll();
      if (u < 1) st.anim = requestAnimationFrame(step);
      else { st.anim = null; if (st.ball) st.ball.squash = false; placeAll(); checkRules(); if (onEnd) onEnd(); }
    };
    st.anim = requestAnimationFrame(step);
  }

  function runFrames(frames, onDone) {
    let i = 0;
    const next = () => {
      if (!st || i >= frames.length) { if (st) renderSide(); if (st && onDone) setTimeout(onDone, 350); return; }
      const f = frames[i++];
      animateTo(f.pos, f.ms || 900, f.label, f.ball, () => setTimeout(next, f.hold ?? 250));
    };
    next();
  }

  /** Arma el guion de una jugada con los roles de la rotación actual, sin animarla.
      Lo usan la animación 2D y el video 3D (ev = quién toca el balón y cómo). */
  function buildScript(kind) {
    const clone = (o) => JSON.parse(JSON.stringify(o));
    const oc = onCourt();
    const sZone = Object.keys(oc).find((z) => { const p = BV.player(oc[z]); return p && p.pos === 'S'; });
    const rot = sZone ? 'Rotation R' + sZone : '';
    if (kind === 'mine') {
      if (st.frames.length < 2) return { error: 'Save at least 2 frames on the board to see your play.' };
      const first = st.frames[0];
      return { kind, rot, roles: {}, start: { pos: clone(first.pos), ball: { ...first.ball } },
        frames: st.frames.slice(1).map((f, i) => ({ pos: clone(f.pos), ball: { ...f.ball, arc: 1.5 }, label: `Frame ${i + 2}`, ms: 900 })) };
    }
    const base = baseTargets();
    const role = (pos, rows) => Object.entries(oc).filter(([z, pid]) => BV.player(pid).pos === pos && rows.includes(+z)).map(([z, pid]) => pid)[0];
    const ids = Object.values(oc);
    const isSetter = !!role('S', [1, 2, 3, 4, 5, 6]);
    const ohF = role('OH', FRONT), ohB = role('OH', BACK), mbF = role('MB', FRONT), opp = role('OPP', [1, 2, 3, 4, 5, 6]);
    const L = libero(), lib = L && ids.includes(L.id) ? L.id : null;
    const receiver = lib || ohB || ohF || role('OPP', BACK) || ids.find((x) => BACK.includes(+Object.keys(oc).find((z) => oc[z] === x)));
    // sin armador(a) en cancha, coloca quien esté en zona 2 o 3 (o cualquiera que no reciba)
    const setter = role('S', [1, 2, 3, 4, 5, 6]) || oc[2] || oc[3] || ids.find((x) => x !== receiver);
    if (ids.length < 3 || !setter) return { error: 'Put at least 3 people on the court to animate plays.' };
    const { spec, swaps, swapList } = specialized(oc);
    const over = (b, o) => Object.assign(clone(b), o);
    const first = (pid) => BV.player(pid).name.split(' ')[0];
    const setName = first(setter) + (isSetter ? '' : ` (acting as ${BV.w.arm})`);

    if (kind === 'z4' || kind === 'quick') {
      const front = FRONT.map((z) => oc[z]).filter((x) => x && x !== setter);
      const hitter = (kind === 'z4' ? (ohF || opp || mbF) : (mbF || ohF)) || front[0];
      if (!hitter || hitter === setter) return { error: 'No front-row attacker in this rotation.' };
      const setSpot = { x: 8.3, y: 5.6 };
      const recSpot = { x: 3.2, y: 2.8 };
      const atk = kind === 'z4' ? { x: 8.4, y: 1.0 } : { x: 8.5, y: 4.6 };
      const app = kind === 'z4' ? { x: 5.6, y: 0.6 } : { x: 6.6, y: 4.2 };
      // tras el saque rival, cada quien va a su zona especializada; quien coloca penetra a la red
      const s1 = over(spec, { [receiver]: recSpot, [setter]: setSpot, [hitter]: app });
      const s2 = over(s1, { [receiver]: { x: 3.6, y: 3.2 }, [hitter]: { x: app.x + 0.6, y: app.y + 0.2 } });
      const s3 = over(s2, { [receiver]: { x: 3.8, y: 3.4 }, [hitter]: atk });
      return {
        kind, rot, roles: { receiver, setter, hitter },
        start: { pos: clone(base), ball: { x: 19.2, y: 6.5, h: 2.4 } },
        frames: [
          { pos: s1, ball: { x: recSpot.x + 0.4, y: recSpot.y, h: 0.8, arc: 2.2 }, label: `1. Rival serve: ${first(receiver)} passes with the forearms; ${setName} moves up to the net.`, ms: 1300,
            ev: { kind: 'serve', hit: 'rival', recv: receiver, recvAct: 'pass' } },
          { pos: s2, ball: { x: setSpot.x, y: setSpot.y, h: 2.6, arc: 2.2 }, label: `2. Pass to ${setName}, near the net between zones 2 and 3.`, ms: 1000,
            ev: { kind: 'pass', hit: receiver, hitAct: 'pass', recv: setter, recvAct: 'set' } },
          { pos: s3, ball: { x: atk.x - 0.1, y: atk.y, h: 3.0, arc: kind === 'z4' ? 2.6 : 0.4 }, label: kind === 'z4' ? `3. High set to zone 4 for ${first(hitter)}.` : `3. Quick set for ${first(hitter)}.`, ms: kind === 'z4' ? 1200 : 600,
            ev: { kind: 'set', quick: kind === 'quick', hit: setter, hitAct: 'set', recv: hitter, recvAct: 'spike' } },
          { pos: s3, ball: { x: 15.2, y: kind === 'z4' ? 7.2 : 6.6, h: 0, arc: 0 }, label: `4. Spike by ${first(hitter)} into the rival court.`, ms: 500, hold: 600,
            ev: { kind: 'spike', hit: hitter, hitAct: 'spike', block: true } },
        ],
      };
    }
    if (kind === 'switch') {
      const server = oc[1];
      if (!server) return { error: 'Put someone in zone 1 to serve.' };
      const s0 = over(base, { [server]: { x: -0.7, y: 7.4 } });
      return {
        kind, rot, roles: { server },
        // datos extra para el video 3D de rotación y cambio de zona
        zones: Object.fromEntries(Object.entries(oc).map(([z, pid]) => [pid, +z])), zonePos: ZONE, spec: JSON.parse(JSON.stringify(spec)), swapList,
        start: { pos: s0, ball: { x: -0.7, y: 7.4, h: 2.2 } },
        frames: [
          { pos: s0, ball: { x: -0.6, y: 7.4, h: 3.2, arc: 0.6 }, label: `1. Serve by ${first(server)} from the end line (zone 1).`, ms: 700, hold: 150, ev: { kind: 'toss', hit: server } },
          { pos: over(base, { [server]: { x: 1.2, y: 7.2 } }), ball: { x: 14.5, y: 3.6, h: 0, arc: 1.4 }, label: '2. The ball crosses the net; now we can move.', ms: 1000, hold: 300, ev: { kind: 'serve', hit: server, hitAct: 'serve' } },
          { pos: spec, label: `3. ${swaps.length ? 'Switches: ' + swaps.join(' · ') : 'This rotation is already in its specialized zones.'}`, ms: 1300, hold: 300, ev: { kind: 'move' } },
        ],
      };
    }
    return { error: 'Unknown play.' };
  }

  /** anima la jugada en la pizarra y, al terminar, abre su video 3D */
  function playScript(kind) {
    if (st.anim) return;
    const sc = buildScript(kind);
    if (sc.error) { BV.toast(sc.error); return; }
    st.inPlay = true;
    st.pos = JSON.parse(JSON.stringify(sc.start.pos)); st.ball = { ...sc.start.ball };
    buildTokens(); placeAll(); checkRules();
    runFrames(sc.frames, () => {
      if (st && $('#tVid', st.el) && $('#tVid', st.el).checked) BV.video3d.open({ kind, build: buildScript });
    });
  }

  /** zona especializada de cada integrante después del saque y cambios corto/largo (Cortina, 2007) */
  function specialized(oc) {
    const front = {}, back = {}, spec = {}, swaps = [], swapList = [];
    Object.entries(oc).forEach(([z, pid]) => { const p = BV.player(pid); if (FRONT.includes(+z)) front[pid] = p.pos; else back[pid] = p.pos; });
    // preferencias por posición; se asignan primero las más específicas
    const PREF_F = { MB: ['mid', 'left', 'right'], S: ['right', 'mid', 'left'], OPP: ['right', 'left', 'mid'], OH: ['left', 'right', 'mid'], L: ['left', 'mid', 'right'] };
    const PREF_B = { S: ['right', 'mid', 'left'], OPP: ['right', 'left', 'mid'], L: ['left', 'mid', 'right'], MB: ['left', 'mid', 'right'], OH: ['mid', 'left', 'right'] };
    const ORDER_F = ['MB', 'S', 'OPP', 'OH', 'L'], ORDER_B = ['S', 'OPP', 'L', 'MB', 'OH'];
    const assign = (group, pref, order, xs) => {
      const slots = { left: { x: xs, y: 1.4 }, mid: { x: xs, y: 4.5 }, right: { x: xs, y: 7.4 } };
      const taken = {};
      Object.keys(group).sort((a, b) => order.indexOf(group[a]) - order.indexOf(group[b])).forEach((pid) => {
        const s = (pref[group[pid]] || ['mid', 'left', 'right']).find((k) => !taken[k]);
        taken[s] = true; spec[pid] = slots[s];
      });
    };
    assign(front, PREF_F, ORDER_F, 7.8);
    assign(back, PREF_B, ORDER_B, 2.6);
    const zoneSide = (z) => ({ 4: 'left', 3: 'mid', 2: 'right', 5: 'left', 6: 'mid', 1: 'right' }[z]);
    Object.entries(oc).forEach(([z, pid]) => {
      const s = spec[pid], side = s.y < 3 ? 'left' : s.y < 6 ? 'mid' : 'right';
      if (side !== zoneSide(+z)) {
        const p = BV.player(pid);
        const far = (zoneSide(+z) === 'left' && side === 'right') || (zoneSide(+z) === 'right' && side === 'left');
        swaps.push(`${p.name.split(' ')[0]} (${BV.POS[p.pos].short}) ${far ? 'long switch' : 'short switch'}`);
        swapList.push({ pid, far });
      }
    });
    return { spec, swaps, swapList };
  }

  /* ---------- panel lateral ---------- */
  function renderAll() { buildTokens(); renderLineup(); renderSide(); checkRules(); }

  function renderLineup() {
    const D = BV.data;
    const box = $('#tLine', st.el);
    const opts = (sel) => '<option value="">—</option>' + BV.players().filter((p) => p.id !== D.liberoId).map((p) => `<option value="${p.id}" ${p.id === sel ? 'selected' : ''}>#${p.num} ${esc(p.name.split(' ')[0])} · ${BV.POS[p.pos].short}${BV.cond.active(p).some(BV.cond.blocks) ? ' · unavailable' : ''}</option>`).join('');
    box.innerHTML = [4, 3, 2, 5, 6, 1].map((z) => `<label class="field"><span>Zone ${z}${z === 1 ? ' (serve)' : ''}</span><select class="inp" data-z="${z}">${opts(D.lineup[z])}</select></label>`).join('');
    box.querySelectorAll('select').forEach((s) => s.addEventListener('change', () => {
      const z = s.dataset.z, pid = s.value;
      Object.keys(D.lineup).forEach((k) => { if (D.lineup[k] === pid && k !== z) delete D.lineup[k]; });
      if (pid) D.lineup[z] = pid; else delete D.lineup[z];
      BV.save(true); basePositions(); renderAll();
    }));
  }

  function renderSide() {
    if (!st) return;
    const D = BV.data, oc = onCourt();
    const sZone = Object.keys(oc).find((z) => { const p = BV.player(oc[z]); return p && p.pos === 'S'; });
    $('#tRotN', st.el).textContent = sZone ? 'R' + sZone : 'R–';
    // a quién colocar: atacantes adelante (y zagueros desde atrás de la línea de 3 m)
    const atk = Object.entries(oc).map(([z, pid]) => ({ z: +z, p: BV.player(pid) }))
      .filter(({ p }) => p && ['OH', 'OPP', 'MB'].includes(p.pos))
      .map((x) => {
        const f = BV.calc.fatigue(x.p.id), r = BV.calc.risk(x.p.id);
        const last = f.sets.length ? f.sets[f.sets.length - 1].mean : NaN;
        const fresh = Number.isFinite(f.fi) ? 100 - f.fi : Number.isFinite(last) ? 100 : NaN;
        return { ...x, last, fresh, r, front: FRONT.includes(x.z) };
      })
      .sort((a, b) => (b.front - a.front) || ((a.r.level === 'crit') - (b.r.level === 'crit')) || ((b.fresh || 0) * (b.last || 0) - (a.fresh || 0) * (a.last || 0)));
    $('#tAtt', st.el).innerHTML = atk.length ? `<ol style="margin:0;padding-left:18px;display:flex;flex-direction:column;gap:8px">${atk.map((a, i) => `
      <li><b>${esc(a.p.name)}</b> <span class="note">· zone ${a.z}${a.front ? '' : ' (back)'}</span><br>
      <span class="note">${Number.isFinite(a.last) ? `${fmt(a.last)} cm` : 'no jumps'}${Number.isFinite(a.fresh) ? ` · ${fmt(a.fresh, 0)}%` : ''}</span> ${a.r.level === 'crit' ? chip('crit', 'High risk') : i === 0 && a.front ? chip('ok', 'Priority') : ''}</li>`).join('')}</ol>`
      : '<p class="muted">No attackers.</p>';
    // cambios sugeridos
    const onIds = new Set(Object.values(D.lineup));
    const bench = BV.players().filter((p) => !onIds.has(p.id) && p.id !== D.liberoId && !BV.cond.active(p).some(BV.cond.blocks));
    const subs = Object.entries(D.lineup).map(([z, pid]) => ({ z, p: BV.player(pid), r: BV.calc.risk(pid) })).filter((x) => x.p && x.r.level === 'crit');
    const box = $('#tSub', st.el);
    box.innerHTML = subs.length ? subs.map((s) => {
      const cand = bench.filter((b) => b.pos === s.p.pos).map((b) => ({ b, r: BV.calc.risk(b.id) })).sort((a, b) => a.r.score - b.r.score)[0];
      return `<div class="stack" style="gap:6px;margin-bottom:10px"><div>${chip('crit', 'High risk')} <b>${esc(s.p.name)}</b> <span class="note">(zone ${s.z})</span></div>
        <div class="note">${esc(s.r.reasons.slice(0, 2).join(' · '))}</div>
        ${cand ? `<button class="btn btn-sm" type="button" data-sub="${s.z}" data-in="${cand.b.id}">In: ${esc(cand.b.name)} (#${cand.b.num})</button>` : '<span class="note">No substitute for this position.</span>'}</div>`;
    }).join('') : chip('ok', 'No urgent substitutions');
    box.querySelectorAll('[data-sub]').forEach((b) => b.addEventListener('click', () => {
      const out = BV.player(D.lineup[b.dataset.sub]), inn = BV.player(b.dataset.in);
      D.lineup[b.dataset.sub] = b.dataset.in; BV.save(true);
      basePositions(); renderAll();
      BV.toast(`Substitution: out ${out.name}, in ${inn.name}`);
    }));
    // banca (incluye al líbero cuando no está en cancha)
    const onNow = new Set(Object.values(oc));
    const benchAll = BV.players().filter((p) => !onNow.has(p.id));
    $('#tBench', st.el).innerHTML = benchAll.length ? `<div class="stack" style="gap:6px">${benchAll.map((p) => {
      const r = BV.calc.risk(p.id);
      return `<div class="row between"><span><span class="pnum" style="min-width:26px;height:26px;font-size:1rem">${p.num}</span> ${esc(p.name.split(' ')[0])} <span class="note">· ${BV.POS[p.pos].short}${p.id === D.liberoId ? ' · libero' : ''}</span></span>${chip(r.level, r.label)}</div>`;
    }).join('')}</div>` : '<p class="muted">Nobody on the bench.</p>';
    // en cancha
    $('#tOn', st.el).innerHTML = `<div class="stack" style="gap:6px">${Object.entries(oc).sort((a, b) => a[0] - b[0]).map(([z, pid]) => {
      const p = BV.player(pid), r = BV.calc.risk(pid);
      return `<div class="row between"><span><span class="pnum" style="min-width:26px;height:26px;font-size:1rem">${p.num}</span> ${esc(p.name.split(' ')[0])} <span class="note">· zone ${z} · ${BV.POS[p.pos].short}</span></span>${chip(r.level, r.label)}</div>`;
    }).join('')}</div>`;
  }

  V.destroy = () => { if (st) cancelAnimationFrame(st.anim); st = null; };
  BV.views.pizarra = V;
})(window.BV);
