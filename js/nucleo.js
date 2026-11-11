/* BioVoley Lab — núcleo: datos, modelos y navegación */
window.BV = (function () {
  'use strict';
  const KEY = 'biovoley.v2';       // { active, teams: { id: datos del equipo } }
  const OLD_KEY = 'biovoley.v1';   // versión anterior: un solo equipo
  const G = 9.81; // aceleración de la gravedad (m/s²)

  /* ---------- utilidades ---------- */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const uid = (p = 'id') => p + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-3);
  const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : NaN);
  const fmt = (n, d = 1) => (Number.isFinite(n) ? n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—');
  const today = () => new Date().toISOString().slice(0, 10);
  const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

  /** Regresión lineal por mínimos cuadrados: y = m·x + b */
  function linreg(xs, ys) {
    const n = xs.length;
    if (n < 2) return null;
    const mx = mean(xs), my = mean(ys);
    let sxy = 0, sxx = 0, syy = 0;
    for (let i = 0; i < n; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; syy += (ys[i] - my) ** 2; }
    if (sxx === 0) return null;
    const m = sxy / sxx, b = my - m * mx;
    const r2 = syy === 0 ? 1 : (sxy * sxy) / (sxx * syy);
    return { m, b, r2 };
  }

  /* ---------- eventos ---------- */
  const handlers = {};
  const on = (ev, fn) => { (handlers[ev] = handlers[ev] || []).push(fn); return () => off(ev, fn); };
  const off = (ev, fn) => { handlers[ev] = (handlers[ev] || []).filter((f) => f !== fn); };
  const emit = (ev, data) => (handlers[ev] || []).slice().forEach((f) => f(data));

  /* ---------- palabras según la categoría del equipo (F, M o mixto) ---------- */
  const EN = { j: 'player', js: 'players', las: 'the', la: 'the', una: 'a', arm: 'setter', zag: 'back-row player', comp: 'teammate', rec: 'receiver', opu: 'opposite', o: '' };
  const WORDS = { F: EN, M: EN, X: EN };
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  /** BV.w.j → "jugadora", BV.w.J → "Jugadora", BV.w.Js → "Jugadoras", según data.cat */
  const w = new Proxy({}, {
    get(_, k) {
      if (typeof k !== 'string') return undefined;
      const set = WORDS[(data && data.cat) || 'F'] || WORDS.F;
      if (k in set) return set[k];
      const low = k.charAt(0).toLowerCase() + k.slice(1);
      return low in set ? cap(set[low]) : k;
    },
  });

  /* ---------- catálogos ---------- */
  const POS = {
    S: { get label() { return cap(w.arm); }, short: 'S' },
    OH: { label: 'Outside hitter', short: 'OH' },
    OPP: { get label() { return cap(w.opu); }, short: 'OPP' },
    MB: { label: 'Middle blocker', short: 'MB' },
    L: { label: 'Libero', short: 'L' },
  };
  const CATS = { F: 'Women', M: 'Men', X: 'Mixed' };

  // escala de color de la orina, del 1 (muy clara) al 8 (muy oscura)
  const ORINA = ['#fdfbe6', '#fbf5c0', '#f8ec97', '#f3dc66', '#e8c541', '#d3a32a', '#b28020', '#8a5d16'];
  const ORINA_EJEMPLO = { p1: 4, p2: 7, p3: 3, p4: 5, p5: 2, p6: 5, p7: 2 };

  /* ---------- condiciones y limitaciones de salud ---------- */
  const cond = {
    TIPOS: { lesion: 'Injury', fractura: 'Fracture', enfermedad: 'Illness or medical condition', cirugia: 'Recent surgery', otra: 'Other limitation' },
    ZONAS: { tobillo: 'Ankle / foot', rodilla: 'Knee', cadera: 'Hip / thigh', espalda: 'Back / spine', hombro: 'Shoulder', codo: 'Elbow', muneca: 'Wrist / hand', dedos: 'Fingers', cabeza: 'Head / neck', otra: 'Other area' },
    ENF: { asma: 'Asthma', diabetes: 'Diabetes', hipertension: 'Hypertension', epilepsia: 'Epilepsy', anemia: 'Anemia', cardiaca: 'Heart condition', renal: 'Kidney condition', alergia: 'Severe allergy', otra: 'Other' },
    ESTADOS: { activa: 'Active', recuperacion: 'Recovering', superada: 'Resolved' },
    RESTR: { saltos: 'No jumping', contacto: 'No falls or dives', brazo: 'No spiking or overhand serving', carga: 'Reduced load', compite: 'Not fit to compete' },
    LEGS: ['tobillo', 'rodilla', 'cadera', 'espalda'],
    ARMS: ['hombro', 'codo', 'muneca', 'dedos'],
    active: (p) => (p && p.conds ? p.conds.filter((c) => c.estado !== 'superada') : []),
    /** impide jugar: restricción explícita o fractura activa */
    blocks: (c) => c.estado !== 'superada' && ((c.restr || []).includes('compite') || (c.tipo === 'fractura' && c.estado === 'activa')),
    label(c) {
      const what = c.tipo === 'enfermedad' ? (cond.ENF[c.enf] || 'Medical condition') : `${cond.TIPOS[c.tipo] || 'Limitation'}${c.zona ? ' of ' + (cond.ZONAS[c.zona] || c.zona).toLowerCase() : ''}`;
      return what;
    },
    has: (p, pred) => cond.active(p).some(pred),
    restricted: (p, r) => cond.active(p).some((c) => (c.restr || []).includes(r)),
    /** recomendaciones según el contexto; no reemplazan el criterio médico */
    notes(p, ctx) {
      const out = [];
      cond.active(p).forEach((c) => {
        if (c.tipo === 'enfermedad') {
          const N = {
            asma: { cal: 'Asthma: gradual warm-up of at least 10 min; inhaler as prescribed and always at hand.', hid: 'Asthma: dry air and intense effort can trigger attacks; drink and breathe through the nose during the warm-up.' },
            diabetes: { cal: 'Diabetes: check glucose before training and keep fast-acting carbohydrates at hand.', hid: 'Diabetes: adjust the drink\'s carbohydrates with a doctor; have a sugar-free version and check glucose during breaks.' },
            hipertension: { cal: 'Hypertension: avoid maximal efforts without medical supervision.', hid: 'Hypertension: ask a doctor how much salt the drink may contain.' },
            epilepsia: { cal: 'Epilepsy: constant supervision; avoid extreme fatigue and dehydration.', hid: 'Epilepsy: dehydration and heat can lower the seizure threshold; keep hydration steady.' },
            anemia: { cal: 'Anemia: may tire sooner; watch perceived effort.', hid: 'Anemia: include iron-rich foods and vitamin C (orange or lemon juice helps absorption).' },
            cardiaca: { cal: 'Heart condition: only with current medical clearance; stop if there is chest pain, dizziness or palpitations.', hid: 'Heart condition: follow medical advice on fluids and salt.' },
            renal: { cal: 'Kidney condition: follow medical advice on intensity.', hid: 'Kidney condition: do not use potassium salts; check fluids and sodium with a doctor.' },
            alergia: { cal: 'Severe allergy: keep the prescribed emergency medication at hand.', hid: 'Allergy: check that no drink ingredient causes a reaction.' },
          }[c.enf];
          if (N && N[ctx]) out.push(N[ctx]);
          else if (ctx === 'cal' || ctx === 'hid') out.push(`${cond.label(c)}${c.detalle ? ' (' + c.detalle + ')' : ''}: follow medical advice.`);
        }
        if (!c.aval && ctx === 'cal') out.push(`${cond.label(c)}: no medical clearance on file; confirm before training.`);
      });
      return out;
    },
  };
  const AGES = { u14: 'U-14', u16: 'U-16', u18: 'U-18', may: 'Adults (18+)' };
  /** Altura de red según categoría y edad (Cortina, 2007; FIVB) */
  function netFor(cat, age) {
    if (cat === 'F') return 2.24;
    if (cat === 'X') return 2.35;
    return age === 'u14' ? 2.24 : age === 'u16' ? 2.35 : 2.43;
  }
  const BORG = {
    6: 'No effort', 7: 'Extremely light', 8: 'Extremely light', 9: 'Very light', 10: 'Very light',
    11: 'Light', 12: 'Light', 13: 'Somewhat hard', 14: 'Somewhat hard', 15: 'Hard', 16: 'Hard',
    17: 'Very hard', 18: 'Very hard', 19: 'Extremely hard', 20: 'Maximal effort',
  };
  const NET = [
    { v: 2.24, label: 'Women (all ages) and boys U-14 — 2.24 m' },
    { v: 2.35, label: 'Boys U-16 — 2.35 m' },
    { v: 2.43, label: 'Men 18+ — 2.43 m' },
  ];

  /* ---------- datos de ejemplo ---------- */
  function seed() {
    const sid0 = 's_ej0', sid1 = 's_ej1';
    const players = [
      ['p1', 'Valentina Ruiz', 7, 'S', 58, 165, 16, 'D'],
      ['p2', 'Sofía Márquez', 10, 'OH', 61, 172, 16, 'D', { shoulder: true }],
      ['p3', 'Mariana Pérez', 4, 'OH', 59, 170, 15, 'D'],
      ['p4', 'Isabella Gómez', 12, 'MB', 66, 180, 16, 'D', { knee: true }],
      ['p5', 'Daniela Torres', 15, 'MB', 64, 178, 16, 'D'],
      ['p6', 'Camila López', 9, 'OPP', 63, 175, 15, 'Z'],
      ['p7', 'Laura Castro', 1, 'L', 52, 160, 15, 'D'],
      ['p8', 'Sara Vargas', 3, 'OH', 57, 168, 15, 'D'],
      ['p9', 'Ana Rojas', 11, 'MB', 62, 176, 16, 'D'],
      ['p10', 'Juliana Díaz', 5, 'S', 55, 163, 15, 'D'],
    ].map(([id, name, num, pos, mass, height, age, hand, pain]) => ({
      id, name, num, pos, mass, height, age, sex: 'F', hand, pain: Object.assign({ knee: false, shoulder: false, ankle: false }, pain || {}), consent: true, example: true,
    }));

    // salto inicial (cm) y caída por set (fracción) — modelo de ejemplo
    const prof = { p1: [33, .02], p2: [41, .045], p3: [39, .015], p4: [44, .035], p5: [43, .01], p6: [40, .025], p7: [30, .012] };
    let k = 1;
    const rnd = () => { k = (k * 9301 + 49297) % 233280; return k / 233280 - .5; }; // pseudoaleatorio fijo
    const jumps = [];
    Object.entries(prof).forEach(([pid, [h0, d]]) => {
      for (let set = 1; set <= 4; set++) {
        for (let j = 0; j < 3; j++) {
          const cm = +(h0 * (1 - d * (set - 1)) + rnd() * 1.6).toFixed(1);
          jumps.push({ id: uid('j'), pid, sid: sid1, set, cm, ms: Math.round(Math.sqrt(8 * cm / 100 / G) * 1000), src: 'ejemplo' });
        }
      }
      // entrenamiento previo (solo set 1 y 2)
      for (let set = 1; set <= 2; set++) {
        const cm = +(h0 * (1 - d * 0.5 * (set - 1)) + rnd()).toFixed(1);
        jumps.push({ id: uid('j'), pid, sid: sid0, set, cm, ms: Math.round(Math.sqrt(8 * cm / 100 / G) * 1000), src: 'ejemplo' });
      }
    });
    ['p8', 'p9', 'p10'].forEach((pid, i) => {
      const cm = [38, 42, 32][i];
      jumps.push({ id: uid('j'), pid, sid: sid1, set: 1, cm, ms: Math.round(Math.sqrt(8 * cm / 100 / G) * 1000), src: 'ejemplo' });
    });
    // aterrizajes medidos con cámara (flexión máx. de rodilla y relación rodilla/tobillo)
    const land = { p2: [55, .93, 8], p4: [42, .72, 14], p6: [68, .95, 5], p3: [64, .98, 4], p5: [61, .9, 6] };
    Object.entries(land).forEach(([pid, [flex, kasr, asym]]) => {
      const cm = prof[pid][0] * (1 - prof[pid][1] * 3);
      jumps.push({ id: uid('j'), pid, sid: sid1, set: 4, cm: +cm.toFixed(1), ms: Math.round(Math.sqrt(8 * cm / 100 / G) * 1000), flex, kasr, asym, src: 'camara' });
    });

    const hyd = [
      ['p1', 58.0, 57.4, 0.6], ['p2', 61.0, 59.6, 0.3], ['p3', 59.0, 58.5, 0.7],
      ['p4', 66.0, 64.9, 0.5], ['p5', 64.0, 63.6, 0.7], ['p6', 63.0, 62.0, 0.5], ['p7', 52.0, 51.7, 0.6],
    ].map(([pid, pre, post, intake]) => ({ id: uid('h'), pid, sid: sid1, pre, post, intake, urine: 0, uc: ORINA_EJEMPLO[pid], minutes: 95 }));
    // condiciones de ejemplo
    players.find((p) => p.id === 'p4').conds = [{ id: 'c1', tipo: 'lesion', zona: 'rodilla', detalle: 'Patellar tendinopathy (jumper\'s knee)', desde: '2026-09-15', estado: 'recuperacion', restr: ['carga'], aval: true }];
    players.find((p) => p.id === 'p7').conds = [{ id: 'c2', tipo: 'enfermedad', enf: 'asma', detalle: 'Mild exercise-induced asthma', desde: '', estado: 'activa', restr: [], aval: true }];
    players.find((p) => p.id === 'p9').conds = [{ id: 'c3', tipo: 'fractura', zona: 'dedos', detalle: 'Left ring finger fracture', desde: '2026-10-10', estado: 'activa', restr: ['compite'], aval: false }];

    const rpe = [['p1', 14], ['p2', 17], ['p3', 13], ['p4', 16], ['p5', 12], ['p6', 15], ['p7', 13]]
      .map(([pid, v]) => ({ pid, sid: sid1, rpe: v }));

    return {
      v: 1,
      lang: 'en',
      example: true,
      team: 'Team 10B — Girls U-17', cat: 'F', age: 'u18',
      settings: { fatWarn: 5, fatAlert: 10, net: 2.24 },
      sessions: [
        { id: sid0, date: '2026-10-20', name: 'Technical practice', minutes: 90, type: 'entreno' },
        { id: sid1, date: '2026-10-27', name: 'Friendly match vs. Club Ibagué', minutes: 95, type: 'partido' },
      ],
      current: sid1,
      players, jumps, hyd, rpe,
      lineup: { 1: 'p1', 2: 'p2', 3: 'p4', 4: 'p6', 5: 'p3', 6: 'p5' },
      drink: null,
    };
  }

  function empty() {
    const sid = uid('s');
    return {
      v: 1, example: false, team: 'My team', cat: 'F', age: 'u16',
      settings: { fatWarn: 5, fatAlert: 10, net: 2.24 },
      sessions: [{ id: sid, date: today(), name: 'Session 1', minutes: 90, type: 'entreno' }],
      current: sid, players: [], jumps: [], hyd: [], rpe: [], lineup: {},
    };
  }

  /* ---------- almacenamiento: varios equipos, con el de ejemplo siempre presente ---------- */
  let store = null;   // { active: id, teams: { id: datos } }
  let data = null;    // equipo activo (todas las vistas leen BV.data)
  let storageOk = true;
  function normalize(d) {
    d.cat = d.cat || 'F'; d.age = d.age || 'u16';
    d.settings = Object.assign({ fatWarn: 5, fatAlert: 10, net: 2.24 }, d.settings);
    d.lineup = d.lineup || {};
    ['players', 'sessions', 'jumps', 'hyd', 'rpe', 'evals'].forEach((k) => { if (!Array.isArray(d[k])) d[k] = []; });
    if (!d.sessions.length) { const sid = uid('s'); d.sessions.push({ id: sid, date: today(), name: 'Session 1', minutes: 90, type: 'entreno' }); d.current = sid; }
    if (!d.sessions.some((x) => x.id === d.current)) d.current = d.sessions[d.sessions.length - 1].id;
    d.players.forEach((p) => { p.conds = p.conds || []; p.pain = p.pain || { knee: false, shoulder: false, ankle: false }; });
    return d;
  }
  function load() {
    try { const raw = localStorage.getItem(KEY); if (raw) store = JSON.parse(raw); } catch (e) { storageOk = false; }
    if (!store || !store.teams) {
      store = { active: 'demo', teams: {} };
      // trae el equipo propio de la versión anterior, si lo había
      try {
        const old = JSON.parse(localStorage.getItem(OLD_KEY) || 'null');
        if (old && Array.isArray(old.players) && old.players.length && !old.example) { const id = uid('t'); store.teams[id] = old; store.active = id; }
      } catch (e) { /* sin datos anteriores */ }
    }
    if (!store.teams.demo || store.teams.demo.lang !== 'en') store.teams.demo = seed(); // el ejemplo guardado antes seguía en español
    store.teams.demo.example = true;
    Object.entries(store.teams).forEach(([id, d]) => { if (!d || !Array.isArray(d.players)) delete store.teams[id]; else { normalize(d); if (id !== 'demo') d.example = false; } });
    if (!store.teams[store.active]) store.active = 'demo';
    data = store.teams[store.active];
  }
  function estadoEquipo() {
    const st = $('#saveState');
    if (st) st.textContent = !storageOk ? 'Could not save' : data && data.example ? 'Sample data' : 'Saved here';
  }
  function save(silent) {
    try { localStorage.setItem(KEY, JSON.stringify(store)); storageOk = true; } catch (e) { storageOk = false; }
    estadoEquipo();
    if (!silent) emit('change');
  }
  const teams = () => Object.entries(store.teams).map(([id, d]) => ({ id, name: d.team, example: id === 'demo', n: d.players.length }))
    .sort((a, b) => b.example - a.example || a.name.localeCompare(b.name));
  const activeTeam = () => store.active;
  /** cambia el equipo activo; con silent no avisa a las vistas */
  function switchTeam(id, silent) {
    if (!store.teams[id]) return;
    store.active = id; data = store.teams[id];
    save(true);
    if (!silent) emit('team');
  }
  /** agrega un equipo (vacío si no se pasa uno) y devuelve su id; no lo activa */
  function addTeam(d) { const id = uid('t'); store.teams[id] = normalize(Object.assign(d || empty(), { example: false })); save(true); return id; }
  function deleteTeam(id) {
    if (id === 'demo' || !store.teams[id]) return;
    delete store.teams[id];
    if (store.active === id) { store.active = 'demo'; data = store.teams.demo; }
    save(); emit('team');
  }
  function resetDemo() { store.teams.demo = normalize(seed()); if (store.active === 'demo') data = store.teams.demo; save(); emit('team'); }
  /** compatibilidad: true = equipo de ejemplo como nuevo y activo; false = un equipo propio vacío y activo */
  function reset(withExamples) {
    if (withExamples) { store.teams.demo = normalize(seed()); switchTeam('demo', true); save(); }
    else { const id = addTeam(); switchTeam(id, true); save(); }
  }

  /* ---------- consultas ---------- */
  const players = () => data.players.slice().sort((a, b) => a.num - b.num);
  const player = (id) => data.players.find((p) => p.id === id);
  const session = (id = data.current) => data.sessions.find((s) => s.id === id) || data.sessions[data.sessions.length - 1];
  const posLabel = (p) => (POS[p] ? POS[p].label : p);

  /* ---------- modelos ---------- */
  const calc = {
    /** Altura de salto a partir del tiempo de vuelo (Bosco et al., 1983): h = g·t²/8 */
    cmFromFlight: (ms) => (G * (ms / 1000) ** 2 / 8) * 100,
    flightFromCm: (cm) => Math.sqrt((8 * cm) / 100 / G) * 1000,
    /** velocidad de despegue: v0 = g·t/2 */
    v0FromFlight: (ms) => (G * (ms / 1000)) / 2,

    /** Hidratación (ACSM, 2007) */
    hydr(r) {
      if (!r || !(r.pre > 0) || !(r.post > 0)) return null;
      const dm = r.pre - r.post;                       // kg perdidos
      const pct = (dm / r.pre) * 100;                  // % de masa corporal
      const sweatL = dm + (r.intake || 0) - (r.urine || 0); // 1 kg ≈ 1 L
      const h = (r.minutes || 60) / 60;
      const rate = sweatL / h;                         // L/h
      const rehyd = Math.max(0, dm * 1.5);             // 1,5 L por kg perdido
      let level, label, short;
      if (dm < -0.05) { level = 'warn'; label = 'Gained weight: drank too much'; short = 'Drank too much'; }
      else if (pct < 1) { level = 'ok'; label = 'Well hydrated'; short = 'Good'; }
      else if (pct < 2) { level = 'warn'; label = 'Mild loss'; short = 'Mild'; }
      else { level = 'crit'; label = 'Over 2%: performance affected'; short = 'Over 2%'; }
      return { dm, pct, sweatL, rate, rehyd, level, label, short };
    },

    /** Color de la orina, escala de 8 tonos (Armstrong et al., 1994) */
    orina(n) {
      if (!(n >= 1 && n <= 8)) return null;
      if (n <= 3) return { n, level: 'ok', label: 'Hydrated' };
      if (n <= 5) return { n, level: 'warn', label: 'Drink water' };
      return { n, level: 'crit', label: 'Dehydrated' };
    },

    /** Índice de fatiga entre el primer y el último set y tendencia lineal */
    fatigue(pid, sid = data.current) {
      const js = data.jumps.filter((j) => j.pid === pid && j.sid === sid && Number.isFinite(j.cm));
      const bySet = {};
      js.forEach((j) => { (bySet[j.set] = bySet[j.set] || []).push(j.cm); });
      const sets = Object.keys(bySet).map(Number).sort((a, b) => a - b)
        .map((s) => ({ set: s, mean: mean(bySet[s]), n: bySet[s].length, vals: bySet[s] }));
      const out = { sets, n: js.length, h1: NaN, hL: NaN, fi: NaN, reg: null, alertSet: null, level: 'na', label: 'Not enough data' };
      if (sets.length < 2) { if (sets.length === 1) out.h1 = sets[0].mean; return out; }
      out.h1 = sets[0].mean; out.hL = sets[sets.length - 1].mean;
      out.fi = ((out.h1 - out.hL) / out.h1) * 100;
      out.reg = linreg(sets.map((s) => s.set), sets.map((s) => s.mean));
      const { fatWarn, fatAlert } = data.settings;
      if (out.reg && out.reg.m < 0) {
        // set en el que la recta cruza el umbral de alerta: m·s + b = h1·(1 − alerta)
        const target = out.h1 * (1 - fatAlert / 100);
        out.alertSet = (target - out.reg.b) / out.reg.m;
      }
      if (out.fi >= fatAlert) { out.level = 'crit'; out.label = 'Fatigue alert'; }
      else if (out.fi >= fatWarn) { out.level = 'warn'; out.label = 'Moderate fatigue'; }
      else { out.level = 'ok'; out.label = 'Stable jump'; }
      return out;
    },

    /** Calidad del aterrizaje (criterios inspirados en LESS; Hewett et al., 2005) */
    landing(j) {
      if (!j || !Number.isFinite(j.flex)) return null;
      const r = { flex: j.flex, kasr: j.kasr, asym: j.asym, items: [] };
      r.items.push(j.flex >= 60 ? ['ok', 'Soft knee flexion'] : j.flex >= 45 ? ['warn', 'Moderate knee flexion'] : ['crit', 'Stiff landing']);
      if (Number.isFinite(j.kasr)) r.items.push(j.kasr >= 0.9 ? ['ok', 'Knees aligned'] : j.kasr >= 0.7 ? ['warn', 'Mild knee valgus'] : ['crit', 'Marked knee valgus']);
      if (Number.isFinite(j.asym)) r.items.push(j.asym < 10 ? ['ok', 'Symmetrical landing'] : j.asym < 20 ? ['warn', 'Moderate asymmetry'] : ['crit', 'High asymmetry']);
      const worst = r.items.some((i) => i[0] === 'crit') ? 'crit' : r.items.some((i) => i[0] === 'warn') ? 'warn' : 'ok';
      r.level = worst;
      r.label = worst === 'ok' ? 'Safe landing' : worst === 'warn' ? 'Landing can improve' : 'Risky landing';
      return r;
    },

    /** Índice de riesgo combinado, con sus razones visibles */
    risk(pid, sid = data.current) {
      const p = player(pid);
      const reasons = [];
      let score = 0, hasData = false;
      const f = calc.fatigue(pid, sid);
      if (f.level !== 'na') {
        hasData = true;
        if (f.level === 'crit') { score += 2; reasons.push(`Jump dropped ${fmt(f.fi)}% (set 1 → ${f.sets[f.sets.length - 1].set})`); }
        else if (f.level === 'warn') { score += 1; reasons.push(`Jump dropped ${fmt(f.fi)}%`); }
      }
      const h = data.hyd.find((r) => r.pid === pid && r.sid === sid);
      const hc = calc.hydr(h);
      if (hc) {
        hasData = true;
        if (hc.pct >= 2) { score += 2; reasons.push(`Lost ${fmt(hc.pct)}% of body weight`); }
        else if (hc.pct >= 1.5) { score += 1; reasons.push(`Lost ${fmt(hc.pct)}% of body weight`); }
      }
      const oc = calc.orina(h && h.uc);
      if (oc) { hasData = true; if (oc.level === 'crit') { score += 1; reasons.push(`Dark urine (color ${oc.n})`); } }
      const r = data.rpe.find((x) => x.pid === pid && x.sid === sid);
      if (r) { hasData = true; if (r.rpe >= 17) { score += 1; reasons.push(`Perceived effort ${r.rpe} (${BORG[r.rpe].toLowerCase()})`); } }
      const lastLand = data.jumps.filter((j) => j.pid === pid && j.sid === sid && Number.isFinite(j.flex)).pop();
      const lq = calc.landing(lastLand);
      if (lq) {
        hasData = true;
        if (lq.flex < 45) { score += 2; reasons.push(`Stiff landing (${Math.round(lq.flex)}° of flexion)`); }
        else if (lq.flex < 60) { score += 1; reasons.push(`Landing flexion of ${Math.round(lq.flex)}°`); }
        if (Number.isFinite(lq.kasr) && lq.kasr < 0.7) { score += 2; reasons.push('Knees caving in (valgus)'); }
        else if (Number.isFinite(lq.kasr) && lq.kasr < 0.9) { score += 1; reasons.push('Mild knee valgus'); }
      }
      let unavailable = null;
      if (p) cond.active(p).forEach((c) => {
        if (cond.blocks(c)) unavailable = unavailable || cond.label(c);
        if (['lesion', 'fractura', 'cirugia'].includes(c.tipo)) {
          if (c.estado === 'activa') { score += 2; reasons.push(`${cond.label(c)} (active)`); }
          else { score += 1; reasons.push(`${cond.label(c)} (recovering)`); }
        }
      });
      if (p && p.pain) {
        if (p.pain.knee) { score += 1; reasons.push('Knee discomfort reported'); }
        if (p.pain.shoulder) { score += 1; reasons.push('Shoulder discomfort reported'); }
        if (p.pain.ankle) { score += 1; reasons.push('Ankle discomfort reported'); }
      }
      let level = 'na', label = 'No data';
      if (hasData || reasons.length) {
        if (score >= 4) { level = 'crit'; label = 'High risk'; }
        else if (score >= 2) { level = 'warn'; label = 'Watch'; }
        else { level = 'ok'; label = 'Available'; }
      }
      if (unavailable) { level = 'crit'; label = 'Unavailable'; reasons.unshift(`Not fit to compete: ${unavailable}`); }
      return { score, level, label, reasons, fatigue: f, hydr: hc, hydRec: h, orina: oc, rpe: r, landing: lq, available: !unavailable };
    },
  };

  /* ---------- monitoreo de una persona en una sesión ---------- */
  /** v = { pre, post, intakeMl, minutes, uc, sets: {1: cm|null, …}, rpe } (los campos ausentes no se tocan) */
  function saveMonitor(pid, sid, v) {
    const D = data;
    const sess = D.sessions.find((x) => x.id === sid);
    const hi = D.hyd.findIndex((r) => r.pid === pid && r.sid === sid);
    const old = hi >= 0 ? D.hyd[hi] : null;
    if ('pre' in v) {
      const rec = {
        id: old ? old.id : uid('h'), pid, sid,
        pre: v.pre > 0 ? v.pre : 0, post: v.post > 0 ? v.post : 0,
        intake: (v.intakeMl || 0) / 1000, urine: 0,
        minutes: v.minutes || (old && old.minutes) || (sess ? sess.minutes : 90),
      };
      const uc = 'uc' in v ? v.uc : old && old.uc;
      if (uc >= 1 && uc <= 8) rec.uc = uc;
      const empty = !(rec.pre > 0) && !(rec.post > 0) && !rec.uc;
      if (empty) { if (hi >= 0) D.hyd.splice(hi, 1); } else if (hi >= 0) D.hyd[hi] = rec; else D.hyd.push(rec);
    }
    if (v.sets) {
      Object.entries(v.sets).forEach(([set, cm]) => {
        set = +set;
        const cur = D.jumps.filter((j) => j.pid === pid && j.sid === sid && j.set === set);
        const curMean = mean(cur.map((j) => j.cm));
        if (cm == null || !(cm > 0)) { if (cur.length) D.jumps = D.jumps.filter((j) => !cur.includes(j)); return; }
        if (cur.length && Math.abs(curMean - cm) < 0.05) return; // sin cambios
        const land = cur.filter((j) => Number.isFinite(j.flex)).pop();
        D.jumps = D.jumps.filter((j) => !cur.includes(j));
        const nj = { id: uid('j'), pid, sid, set, cm: +(+cm).toFixed(1), ms: Math.round(Math.sqrt((8 * cm) / 100 / G) * 1000), src: 'manual' };
        if (land) Object.assign(nj, { flex: land.flex, kasr: land.kasr, asym: land.asym });
        D.jumps.push(nj);
      });
    }
    if ('rpe' in v) {
      const ri = D.rpe.findIndex((x) => x.pid === pid && x.sid === sid);
      if (v.rpe >= 6 && v.rpe <= 20) { const r = { pid, sid, rpe: +v.rpe }; if (ri >= 0) D.rpe[ri] = r; else D.rpe.push(r); }
      else if (ri >= 0) D.rpe.splice(ri, 1);
    }
  }

  /** Convierte una lista pegada (Excel o texto) en integrantes: nombre; número; posición; edad; estatura; peso; mano */
  function parsePlayers(text) {
    const posOf = (t) => {
      t = (t || '').toLowerCase();
      if (/arm|coloc|sett/.test(t)) return 'S';
      if (/opue|opp/.test(t)) return 'OPP';
      if (/cent|middle|mb/.test(t)) return 'MB';
      if (/l[ií]b/.test(t)) return 'L';
      return 'OH';
    };
    const num = (t) => { const v = parseFloat(String(t || '').replace(',', '.')); return Number.isFinite(v) ? v : NaN; };
    return text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map((l) => {
      const f = (/\t/.test(l) ? l.split('\t') : /;/.test(l) ? l.split(';') : l.split(',')).map((x) => x.trim());
      if (/^(nombre|name)$/i.test(f[0])) return null; // fila de títulos
      let h = num(f[4]); if (h > 0 && h < 3) h = Math.round(h * 100);
      return { name: f[0], num: num(f[1]), pos: posOf(f[2]), age: num(f[3]), height: h, mass: num(f[5]), hand: /zurd|izq|left|^z$|^l$/i.test(f[6] || '') ? 'Z' : 'D' };
    }).filter((p) => p && p.name);
  }

  /* ---------- guardar archivos ---------- */
  /** ¿la página corre dentro de claude.ai? */
  const inClaude = () => !!(window.claude && typeof window.claude.use === 'function');
  /** En claude.ai pide confirmación al visor (capacidad "downloads"); en el archivo local descarga directo. */
  async function download(name, blob) {
    if (inClaude()) {
      let dl = null;
      try { dl = await window.claude.use('downloads'); } catch (e) { dl = null; }
      if (dl) {
        try { await dl.save({ filename: name, data: blob }); toast('File saved'); }
        catch (e) { if (!e || e.code !== 'declined') toast(e && e.code === 'rate_limited' ? 'Another download is pending; try again in a moment.' : 'Could not save the file in this view.'); }
        return;
      }
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }

  /* ---------- interfaz común ---------- */
  const chip = (level, text) => `<span class="st st-${level}">${esc(text)}</span>`;

  let toastT = null;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg; t.hidden = false;
    clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 2600);
  }
  const tip = {
    show(html, x, y) {
      const t = $('#tooltip');
      t.innerHTML = html; t.hidden = false;
      const r = t.getBoundingClientRect();
      let left = x + 14, top = y + 14;
      if (left + r.width > window.innerWidth - 8) left = x - r.width - 14;
      if (top + r.height > window.innerHeight - 8) top = y - r.height - 14;
      t.style.left = Math.max(8, left) + 'px'; t.style.top = Math.max(8, top) + 'px';
    },
    hide() { $('#tooltip').hidden = true; },
  };

  /** Botón de borrado en dos pasos (sin diálogos del navegador) */
  function armDelete(btn, fn, armedText = 'Sure? Tap again') {
    let armed = false, t;
    const orig = btn.innerHTML;
    btn.addEventListener('click', () => {
      if (!armed) {
        armed = true; btn.classList.add('armed'); btn.textContent = armedText;
        t = setTimeout(() => { armed = false; btn.classList.remove('armed'); btn.innerHTML = orig; }, 3500);
      } else { clearTimeout(t); fn(); }
    });
  }

  function playerOptions(selected, { includeAll = false, filter } = {}) {
    let list = players();
    if (filter) list = list.filter(filter);
    return (includeAll ? '<option value="">Whole team</option>' : '') +
      list.map((p) => `<option value="${p.id}" ${p.id === selected ? 'selected' : ''}>#${p.num} ${esc(p.name)} · ${esc(POS[p.pos].short)}</option>`).join('');
  }
  function sessionOptions(selected = data.current) {
    return data.sessions.slice().sort((a, b) => b.date.localeCompare(a.date))
      .map((s) => `<option value="${s.id}" ${s.id === selected ? 'selected' : ''}>${esc(s.date)} · ${esc(s.name)}</option>`).join('');
  }

  /* ---------- navegación ---------- */
  const views = {};
  const ICONS = {
    panel: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
    jugadores: '<circle cx="9" cy="7" r="4"/><path d="M2 21v-1a6 6 0 0 1 6-6h2a6 6 0 0 1 6 6v1"/><path d="M16 3.5a4 4 0 0 1 0 7.5M22 21v-1a6 6 0 0 0-4-5.6"/>',
    hidratacion: '<path d="M12 2.8 6.3 9a7.6 7.6 0 1 0 11.4 0z"/><path d="M9 15a3 3 0 0 0 3 3"/>',
    fatiga: '<path d="M22 12h-4l-3 8L9 4l-3 8H2"/>',
    camara: '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>',
    aterrizaje: '<path d="M12 3v11M7 9.5l5 5 5-5M4 20h16"/>',
    fundamentos: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V2H6.5A2.5 2.5 0 0 0 4 4.5z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/>',
    pizarra: '<rect x="4" y="2" width="16" height="20" rx="1"/><path d="M4 12h16M4 9h16M4 15h16" opacity=".6"/>',
    calentamiento: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5M9 2h6"/>',
    modelos: '<path d="M3 21h18M3 21V3"/><path d="M5 20C8 4 14 4 19 20"/>',
    guia: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M8 9h8M8 13h5"/>',
  };
  // el mismo orden del proyecto: medir, decidir con los datos y comunicarlos
  const NAV = [
    ['', ['panel', 'jugadores']],
    ['Measure', ['camara', 'hidratacion', 'fatiga']],
    ['Decide', ['pizarra', 'calentamiento']],
    ['Communicate', ['aterrizaje', 'fundamentos', 'modelos', 'guia']],
  ];
  // lo que se ve en la barra de direcciones
  const RUTAS = { jugadores: 'team', hidratacion: 'hydration', fatiga: 'fatigue', camara: 'camera', aterrizaje: 'landing', pizarra: 'board', modelos: 'models', calentamiento: 'warmup', fundamentos: 'technique', guia: 'guide', inicio: 'setup' };
  const TAGS = { tec: 'Technoscience', mat: 'Mathematics', ef: 'Physical education', art: 'Visual arts', eng: 'English' };
  let active = null, activeId = null;

  function buildNav() {
    const crit = players().filter((p) => calc.risk(p.id).level === 'crit').length;
    $('#nav').innerHTML = NAV.map(([g, ids]) => `
      <div class="nav-group">${g ? `<div class="nav-label"><b>0${NAV.findIndex((x) => x[0] === g)}</b>${g}</div>` : ''}
      ${ids.filter((id) => views[id]).map((id) => `<a href="#${RUTAS[id] || id}" data-id="${id}" ${id === activeId ? 'aria-current="page"' : ''}>
        <svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[id] || ''}</svg>${esc(views[id].nav || views[id].title)}
        ${id === 'panel' && crit ? `<span class="badge" title="${cap(w.js)} at high risk">${crit}</span>` : ''}</a>`).join('')}
      </div>`).join('');
    estadoEquipo();
    const ts = $('#teamSel');
    if (ts) ts.innerHTML = teams().map((t) => `<option value="${t.id}" ${t.id === store.active ? 'selected' : ''}>${esc(t.example ? 'Sample: ' + t.name : t.name)}</option>`).join('');
  }

  function route() {
    const [ruta, arg] = (location.hash.slice(1) || 'panel').split('/');
    const id = Object.keys(RUTAS).find((k) => RUTAS[k] === ruta) || ruta;
    const v = views[id] ? id : 'panel';
    if (active && active.destroy) { try { active.destroy(); } catch (e) { console.error(e); } }
    activeId = v; active = views[v];
    document.body.dataset.vista = v;
    $('#vTitle').textContent = active.title;
    const gi = NAV.findIndex(([, ids]) => ids.includes(v));
    if ($('#vEyebrow')) $('#vEyebrow').textContent = gi > 0 ? `0${gi} · ${NAV[gi][0]}` : gi === 0 ? 'Overview' : 'Setup';
    $('#vSub').textContent = active.sub || '';
    $('#vTools').innerHTML = '';
    $('#vTags').innerHTML = (active.tags || []).map((t) => `<span class="tag" data-t="${t}">${TAGS[t]}</span>`).join('');
    buildNav();
    const el = $('#view');
    el.innerHTML = '';
    try { active.render(el, arg); } catch (e) { console.error(e); el.innerHTML = `<div class="card">Could not show this section: ${esc(e.message)}</div>`; }
    // las tarjetas aparecen a medida que llegan a la pantalla
    if (BV.revelar) BV.revelar(el);
    window.scrollTo(0, 0);
  }

  function start() {
    load();
    on('change', () => {
      buildNav();
      if (active && active.refresh) active.refresh();
    });
    on('team', route);
    window.addEventListener('hashchange', route);
    // si falta alguna pieza del HTML (p. ej. una copia vieja en caché), la app arranca igual
    const bind = (sel, ev, fn) => { const e = $(sel); if (e) e.addEventListener(ev, fn); };
    bind('#btnNewTeam', 'click', () => { location.hash = '#setup/new'; });
    bind('#teamSel', 'change', (e) => { switchTeam(e.target.value); toast(`Active team: ${data.team}`); });
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    if (mq.addEventListener) mq.addEventListener('change', () => emit('theme'));
    window.addEventListener('resize', () => emit('resize'));
    route();
    if (BV.fondo) BV.fondo.start();
  }

  return {
    G, $, $$, esc, clamp, uid, mean, fmt, today, cssVar, linreg, ORINA,
    on, off, emit, POS, BORG, NET, TAGS, CATS, AGES, netFor, w, cap, saveMonitor, parsePlayers, cond,
    get data() { return data; },
    save, reset, players, player, session, posLabel, calc,
    teams, activeTeam, switchTeam, addTeam, deleteTeam, resetDemo, emptyTeam: () => empty(),
    chip, toast, tip, armDelete, playerOptions, sessionOptions, download, inClaude,
    views, start, route,
  };
})();
