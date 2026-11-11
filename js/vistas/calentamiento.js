/* BioVoley Lab — Calentamiento preventivo adaptado
   Basado en el programa de Bahr et al. (1997): técnica de despegue y aterrizaje + tabla
   de equilibrio, que redujo a la mitad los esguinces de tobillo en voleibol. */
(function (BV) {
  'use strict';
  const { $, esc, fmt, chip } = BV;
  const V = {
    title: 'Warm-up', nav: 'Warm-up',
    sub: 'Prevention adapted to each player',
    tags: ['ef', 'tec'],
  };
  const LIB = {
    act: [['Easy jog and side shuffles', 90, 'Short steps, eyes forward; alternate side, forward and back.'], ['High knees and butt kicks', 60, 'Coordinated arms, land on the balls of the feet.']],
    mov: [['Leg swings, forward-back and sideways', 60, 'Lean on the wall; 10 per leg.'], ['Lunge with trunk rotation', 60, 'Front knee over the ankle, not caving in.'], ['Arm circles and chest opener', 45, 'Wide, slow movements.']],
    hom: [['External rotation with band', 60, '2 × 12 per arm, elbow close to the body.'], ['Y-T-W with band', 45, 'Shoulder blades back and down, no shrugging.'], ['Progressive one-hand throws', 60, 'Start easy; high elbow as in a spike.']],
    homDolor: [['External rotation with band (light load)', 60, '2 × 12 pain-free; if it hurts, stop.'], ['Isometric shoulder holds against the wall', 45, '5 × 6 s each direction, pain-free.'], ['Shoulder blade control on hands and knees', 45, 'Push the floor and spread the shoulder blades; 2 × 10.']],
    ate: [['Squat jump with quiet landing', 60, '6–8 jumps: land on the balls of the feet, knees over feet, quietly.'], ['Side hop with 2 s hold', 60, '6 per side: land on one leg and freeze; knee in line with the foot.'], ['Step-off landing and freeze', 45, '6 reps from 20–30 cm; bend the knees at least 60°.']],
    ateDolor: [['Isometric wall sit', 45, '2 × 20 s, pain-free.'], ['Glute bridge', 45, '2 × 12, lift the hips without arching the back.'], ['Landings from 5 cm', 30, 'Technique only: knees over feet, no impact.']],
    equ: [['Single-leg stance on a balance board', 60, '30 s per leg; with no board, use a folded cushion.'], ['Forearm passes on one leg', 60, '30 s per leg with a partner.']],
    pos: {
      S: ['Moving sets toward zones 2 and 3', 90, 'Get under the ball before touching it and face the target.'],
      OH: ['Progressive attack approach (50%, 75%, 90%)', 90, 'Long, low last step; land on both feet.'],
      OPP: ['Attack approach from zone 2 (50%, 75%, 90%)', 90, 'High elbow when cocking; soft two-foot landing.'],
      MB: ['Block footwork and jump', 90, 'Side step and crossover; bend close to 90° before jumping; soft landing.'],
      L: ['Defensive movement and easy serve reception', 90, 'Low position, firm and quiet platform.'],
      team: ['Reception, set and easy attack in groups', 120, 'Progressive intensity; prioritize quality.'],
    },
  };
  const PHASES = { sal: 'Health', act: 'General activation', mov: 'Dynamic mobility', hom: 'Shoulder', ate: 'Landing technique', equ: 'Balance', pos: 'Position specific', hid: 'Hydration' };
  let st = null;

  V.render = function (el) {
    st = { el, who: '', dur: 15, knee: false, sh: false, tired: false, plan: [], i: 0, left: 0, running: false, timer: 0, audio: null };
    el.innerHTML = `
      <div class="grid g-side-r">
        <div class="card stack">
          <label class="field"><span>For</span><select id="wWho">${BV.playerOptions('', { includeAll: true })}</select></label>
          <div class="seg" role="group" aria-label="Duration">${[10, 15, 20].map((d) => `<button type="button" data-d="${d}" aria-pressed="${d === 15}">${d} min</button>`).join('')}</div>
          <label class="check"><input type="checkbox" id="wKnee"> Knee discomfort</label>
          <label class="check"><input type="checkbox" id="wSh"> Shoulder discomfort</label>
          <label class="check"><input type="checkbox" id="wTired"> High fatigue or match yesterday</label>
          <div id="wWhy"></div>
        </div>
        <div class="stack">
          <div class="card stack">
            <div class="row between">
              <div><div class="note" id="wNowPh"></div><h2 id="wNow">—</h2></div>
              <div class="timer" id="wTime">00:00</div>
            </div>
            <div class="progress"><i id="wBar"></i></div>
            <p class="muted" id="wCue"></p>
            <div class="row">
              <button class="btn btn-primary" id="wGo" type="button">Start</button>
              <button class="btn" id="wNext" type="button">Next</button>
              <button class="btn btn-ghost" id="wReset" type="button">Reset</button>
              <span class="note" id="wTot"></span>
            </div>
          </div>
          <div class="card"><ol class="wu-list" id="wList"></ol></div>
        </div>
      </div>`;
    $('#wWho', el).addEventListener('change', (e) => { st.who = e.target.value; autoFlags(); build(); });
    el.querySelectorAll('[data-d]').forEach((b) => b.addEventListener('click', () => {
      st.dur = +b.dataset.d; el.querySelectorAll('[data-d]').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); build();
    }));
    [['#wKnee', 'knee'], ['#wSh', 'sh'], ['#wTired', 'tired']].forEach(([id, k]) => $(id, el).addEventListener('change', (e) => { st[k] = e.target.checked; build(); }));
    $('#wGo', el).addEventListener('click', toggle);
    $('#wNext', el).addEventListener('click', () => go(st.i + 1));
    $('#wReset', el).addEventListener('click', () => { stop(); go(0); });
    build();
  };

  function autoFlags() {
    const p = BV.player(st.who);
    const r = p ? BV.calc.risk(p.id) : null;
    const C = BV.cond;
    const injured = (zones) => !!p && C.has(p, (c) => c.tipo !== 'enfermedad' && zones.includes(c.zona));
    st.knee = !!(p && (p.pain.knee || p.pain.ankle || injured(C.LEGS) || C.restricted(p, 'saltos')));
    st.sh = !!(p && (p.pain.shoulder || injured(C.ARMS) || C.restricted(p, 'brazo')));
    st.tired = !!(r && (r.fatigue.level === 'crit' || r.level === 'crit' || C.restricted(p, 'carga')));
    $('#wKnee', st.el).checked = st.knee; $('#wSh', st.el).checked = st.sh; $('#wTired', st.el).checked = st.tired;
  }

  function build() {
    stop();
    const p = BV.player(st.who);
    const items = [];
    const add = (ph, arr) => arr.forEach(([n, s, c]) => items.push({ ph, n, s, c }));
    const r = p ? BV.calc.risk(p.id) : null;
    const why = [];
    const C = BV.cond;
    if (p) {
      // condiciones de salud: avisos y preparación específica
      if (C.active(p).some(C.blocks)) why.push('Not fit to compete: only the work indicated by a doctor or physical therapist.');
      if (C.has(p, (c) => c.enf === 'asma')) items.push({ ph: 'sal', n: 'Breathing preparation', s: 60, c: 'Inhaler only if prescribed; very easy jog breathing through the nose.' });
      if (C.has(p, (c) => c.enf === 'diabetes')) items.push({ ph: 'sal', n: 'Check glucose before starting', s: 30, c: 'Keep a fast-acting carbohydrate at hand (juice or panela).' });
      C.notes(p, 'cal').forEach((n) => why.push(n));
      if (C.restricted(p, 'contacto')) why.push('No falls or dives: defense drills are done standing.');
    }
    if (r && r.hydr && r.hydr.pct >= 2) {
      const ml = Math.round(5 * p.mass / 10) * 10;
      items.push({ ph: 'hid', n: `Drink ${ml} ml of water before starting`, s: 30, c: 'Lost more than 2% of body weight in the last session.' });
      why.push('We added hydration at the start.');
    }
    add('act', LIB.act);
    add('mov', LIB.mov);
    const needsShoulder = !p || ['OH', 'OPP', 'S'].includes(p.pos) || st.sh;
    if (needsShoulder) { add('hom', st.sh ? LIB.homDolor : LIB.hom); if (st.sh) why.push('Shoulder: pain-free exercises, no throwing.'); }
    add('ate', st.knee ? LIB.ateDolor : LIB.ate);
    if (st.knee) why.push('Legs (injury, discomfort or jump restriction): jumps replaced by isometrics and low landings.');
    add('equ', LIB.equ);
    let sp = p ? LIB.pos[p.pos] : LIB.pos.team;
    if (p && (st.knee || C.restricted(p, 'saltos')) && ['OH', 'OPP', 'MB'].includes(p.pos)) sp = ['Arm technique without jumping (standing spike or block)', 90, 'Practice cocking with a high elbow, feet on the floor.'];
    if (p && C.restricted(p, 'brazo') && ['OH', 'OPP'].includes(p.pos)) sp = ['Attack approach without hitting the ball', 90, 'Steps and an easy takeoff only; the arm does not hit.'];
    if (p && C.restricted(p, 'contacto') && p.pos === 'L') sp = ['Standing defensive movement (no falls)', 90, 'Low position and firm platform, no dives or rolls.'];
    items.push({ ph: 'pos', n: sp[0], s: sp[1], c: sp[2] });
    // ajustar al tiempo elegido (proporcional) y reducir saltos si hay fatiga
    let total = items.reduce((s, x) => s + x.s, 0);
    const k = (st.dur * 60) / total;
    items.forEach((x) => { x.s = Math.max(20, Math.round((x.s * k) / 5) * 5); });
    if (st.tired) {
      items.forEach((x) => { if (x.ph === 'ate' || x.ph === 'pos') { x.c += ' Today: half the reps and 70% intensity.'; } });
      why.push('Fatigue: less jump volume and moderate intensity.');
    }
    st.plan = items; st.i = 0; st.left = items[0] ? items[0].s : 0;
    total = items.reduce((s, x) => s + x.s, 0);
    $('#wTot', st.el).textContent = `Total ${Math.round(total / 60)} min · ${items.length} exercises`;
    $('#wWhy', st.el).innerHTML = why.length ? `<div class="card flat stack" style="gap:6px"><strong>Applied adjustments</strong>${why.map((w) => `<div class="note">${esc(w)}</div>`).join('')}</div>` : '';
    list(); show();
  }

  function list() {
    let lastPh = '';
    $('#wList', st.el).innerHTML = st.plan.map((x, i) => {
      const head = x.ph !== lastPh ? `<li class="wu-phase">${PHASES[x.ph]}</li>` : '';
      lastPh = x.ph;
      return `${head}<li class="wu-item ${i === st.i ? 'now' : ''} ${i < st.i ? 'done' : ''}" data-i="${i}"><span class="pnum" style="min-width:26px;height:26px;font-size:.95rem">${i + 1}</span><strong>${esc(x.n)}</strong><span class="wu-t">${mmss(x.s)}</span><span class="wu-c">${esc(x.c)}</span></li>`;
    }).join('');
    st.el.querySelectorAll('.wu-item').forEach((li) => li.addEventListener('click', () => go(+li.dataset.i)));
  }
  const mmss = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.round(s % 60)).padStart(2, '0')}`;

  function show() {
    const x = st.plan[st.i];
    if (!x) { $('#wNow', st.el).textContent = 'Warm-up finished!'; $('#wNowPh', st.el).textContent = 'Ready to train'; $('#wTime', st.el).textContent = '00:00'; $('#wCue', st.el).textContent = ''; $('#wBar', st.el).style.width = '100%'; return; }
    $('#wNowPh', st.el).textContent = `${PHASES[x.ph]} · ${st.i + 1} of ${st.plan.length}`;
    $('#wNow', st.el).textContent = x.n;
    $('#wCue', st.el).textContent = x.c;
    $('#wTime', st.el).textContent = mmss(Math.ceil(st.left));
    $('#wBar', st.el).style.width = `${(1 - st.left / x.s) * 100}%`;
  }

  function beep(f = 880, d = 0.15) {
    try {
      st.audio = st.audio || new (window.AudioContext || window.webkitAudioContext)();
      const o = st.audio.createOscillator(), g = st.audio.createGain();
      o.frequency.value = f; o.connect(g); g.connect(st.audio.destination);
      g.gain.setValueAtTime(0.15, st.audio.currentTime); g.gain.exponentialRampToValueAtTime(0.001, st.audio.currentTime + d);
      o.start(); o.stop(st.audio.currentTime + d);
    } catch (e) { /* sin audio */ }
  }

  function toggle() {
    if (st.running) { stop(); return; }
    if (st.i >= st.plan.length) go(0);
    st.running = true; $('#wGo', st.el).textContent = 'Pause'; beep(660);
    let last = performance.now();
    st.timer = setInterval(() => {
      const now = performance.now(); st.left -= (now - last) / 1000; last = now;
      if (st.left <= 0) { beep(990, 0.3); go(st.i + 1, true); }
      show();
    }, 200);
  }
  function stop() { if (!st) return; clearInterval(st.timer); st.running = false; const b = $('#wGo', st.el); if (b) b.textContent = 'Start'; }
  function go(i, keep) {
    st.i = Math.max(0, Math.min(i, st.plan.length));
    st.left = st.plan[st.i] ? st.plan[st.i].s : 0;
    if (st.i >= st.plan.length) stop();
    if (!keep && !st.running) stop();
    list(); show();
  }

  V.destroy = () => { stop(); st = null; };
  BV.views.calentamiento = V;
})(window.BV);
