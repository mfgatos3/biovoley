/* BioVoley Lab — Hidratación: pesaje y sudoración, plan por integrante y bebida deportiva
   ACSM (2007), Exercise and fluid replacement; Thomas, Erdman y Burke (2016). */
(function (BV) {
  'use strict';
  const { $, esc, fmt, chip } = BV;
  const CLIMA = {
    templado: { label: 'Mild (18–24 °C)', rate: 0.7 },
    caluroso: { label: 'Hot (25–30 °C, like Ibagué)', rate: 1.0 },
    extremo: { label: 'Very hot or humid (over 30 °C)', rate: 1.3 },
  };
  const SUDOR_NA = 920; // mg de sodio por litro de sudor (≈ 40 mmol/L, valor típico)
  const V = {
    title: 'Hydration', nav: 'Hydration',
    sub: 'Weight, urine color and drink',
    tags: ['tec', 'mat', 'ef'],
  };
  let root = null, tab = 'pesaje', pid = '', planPid = '', recipe = null, orina = null;
  const plan = { dur: 90, sets: 4, clima: 'caluroso', meta: 1, bebida: 'guardada' };

  V.render = function (el, arg) {
    root = el;
    if (['pesaje', 'plan', 'bebida'].includes(arg)) tab = arg;
    const first = BV.players()[0];
    if (!BV.player(pid)) pid = first ? first.id : '';
    if (!BV.player(planPid)) planPid = pid;
    if (!recipe) recipe = JSON.parse(JSON.stringify(BV.data.drink || BV.bebida.PRESETS.panela));
    el.innerHTML = `
      <div class="seg" role="tablist" aria-label="Section">
        <button type="button" data-tab="pesaje" aria-pressed="${tab === 'pesaje'}">Weight and urine</button>
        <button type="button" data-tab="plan" aria-pressed="${tab === 'plan'}">Plan</button>
        <button type="button" data-tab="bebida" aria-pressed="${tab === 'bebida'}">Drink</button>
      </div>
      <div id="hBody" class="stack" style="gap:18px"></div>`;
    el.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => go(b.dataset.tab)));
    body();
  };
  function go(t) { tab = t; root.querySelectorAll('[data-tab]').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.tab === t))); body(); window.scrollTo(0, 0); }
  function body() {
    if (!root) return;
    const box = $('#hBody', root);
    $('#vTools').innerHTML = '';
    if (tab === 'bebida') return drink(box);
    if (!BV.players().length) { box.innerHTML = `<div class="card"><a href="#setup">Create your team</a></div>`; return; }
    if (tab === 'plan') planView(box); else weigh(box);
  }

  /* =================== 1. pesaje y sudoración =================== */
  function weigh(box) {
    box.innerHTML = `
      <div class="grid g-side">
        <form class="card stack" id="hForm">
          <div class="fields">
            <label class="field"><span>${BV.w.J}</span><select id="hP">${BV.playerOptions(pid)}</select></label>
            <label class="field"><span>Weight before (kg)</span><input type="number" id="hPre" step="0.1" min="20" max="200"></label>
            <label class="field"><span>Weight after (kg)</span><input type="number" id="hPost" step="0.1" min="20" max="200"></label>
            <label class="field"><span>Drank during (ml)</span><input type="number" id="hIn" step="50" min="0" value="0"></label>
            <label class="field"><span>Duration (min)</span><input type="number" id="hMin" min="5" max="300"></label>
          </div>
          <div class="stack" style="gap:6px"><strong>Urine color</strong><div id="hUr"></div></div>
          <div id="hRes"></div>
          <div class="row between"><button class="btn" type="button" id="hToPlan">Show plan</button><button class="btn btn-primary" type="submit">Save</button></div>
        </form>
        <div class="stack">
          <div class="card"><div class="card-h"><h3>Team</h3></div><div class="tbl-wrap"><table class="tbl" id="hTbl"></table></div></div>
          <div class="card"><div class="card-h"><h3>Sweat rate</h3><span class="note">L/h</span></div><div id="chRate"></div></div>
        </div>
      </div>`;
    BV.sessionBar($('#vTools'), () => { loadRec(); team(); });
    const f = $('#hForm', box);
    $('#hP', f).addEventListener('change', (e) => { pid = e.target.value; loadRec(); team(); });
    ['#hPre', '#hPost', '#hIn', '#hMin'].forEach((s) => $(s, f).addEventListener('input', calcW));
    f.addEventListener('submit', (e) => { e.preventDefault(); saveRec(); });
    $('#hToPlan', f).addEventListener('click', () => { planPid = pid; go('plan'); });
    loadRec(); team();
  }
  const rec = () => BV.data.hyd.find((r) => r.pid === pid && r.sid === BV.data.current);
  function loadRec() {
    const f = $('#hForm', root); if (!f) return;
    const r = rec(), p = BV.player(pid), s = BV.session();
    $('#hP', f).value = pid;
    $('#hPre', f).value = r && r.pre ? r.pre : p ? p.mass : '';
    $('#hPost', f).value = r && r.post ? r.post : '';
    $('#hIn', f).value = r ? Math.round((r.intake || 0) * 1000) : 0;
    $('#hMin', f).value = r ? r.minutes : s ? s.minutes : 90;
    orina = BV.urinePicker($('#hUr', f), r && r.uc);
    calcW();
  }
  function formRec() {
    const f = $('#hForm', root);
    return { pid, sid: BV.data.current, pre: +$('#hPre', f).value, post: +$('#hPost', f).value, intake: (+$('#hIn', f).value || 0) / 1000, urine: 0, minutes: +$('#hMin', f).value || 60 };
  }
  function calcW() {
    const r = formRec(), h = BV.calc.hydr(r), out = $('#hRes', root);
    if (!h) { out.innerHTML = ''; return; }
    const pos = BV.clamp((h.pct / 3) * 100, 0, 100);
    out.innerHTML = `
      <div class="card flat stack">
        <div class="row between"><strong>Result</strong>${chip(h.level, h.short)}</div>
        <div><div class="gauge" aria-hidden="true"><i style="left:${pos}%"></i></div><div class="gauge-l"><span>0%</span><span>1%</span><span>2%</span><span>3%+</span></div></div>
        <div class="bigres">
          <div><span>Weight lost</span><b>${fmt(h.pct)}%</b></div>
          <div><span>Sweat</span><b>${fmt(h.sweatL, 2)} L</b></div>
          <div><span>Sweat rate</span><b>${fmt(h.rate, 2)} L/h</b></div>
        </div>
        <details class="more"><summary>Show calculation</summary><div class="formula">
          % lost = (before − after) / before × 100 = (${fmt(r.pre)} − ${fmt(r.post)}) / ${fmt(r.pre)} × 100 = <b>${fmt(h.pct, 2)}%</b><br>
          Sweat = Δweight + drunk = ${fmt(h.dm, 2)} + ${fmt(r.intake, 2)} = <b>${fmt(h.sweatL, 2)} L</b> (1 kg of water ≈ 1 L)<br>
          Rate = sweat / hours = ${fmt(h.sweatL, 2)} / ${fmt(r.minutes / 60, 2)} = <b>${fmt(h.rate, 2)} L/h</b><br>
          Sodium lost ≈ ${fmt(h.sweatL, 2)} L × ${SUDOR_NA} mg/L = <b>${fmt(h.sweatL * SUDOR_NA, 0)} mg</b> · Replace after = 1.5 × ${fmt(Math.max(0, h.dm), 2)} kg = <b>${fmt(h.rehyd, 2)} L</b>
        </div></details>
      </div>`;
  }
  function saveRec() {
    const r = formRec(), uc = orina ? orina.valor() : 0;
    if (!BV.calc.hydr(r) && !uc) { BV.toast('Enter the weights or the urine color.'); return; }
    BV.saveMonitor(pid, BV.data.current, { pre: r.pre, post: r.post, intakeMl: r.intake * 1000, minutes: r.minutes, uc });
    BV.save(); BV.toast('Record saved'); team();
  }
  function team() {
    const t = $('#hTbl', root); if (!t) return;
    const rows = BV.players().map((p) => {
      const rc = BV.data.hyd.find((x) => x.pid === p.id && x.sid === BV.data.current);
      return { p, h: BV.calc.hydr(rc), o: BV.calc.orina(rc && rc.uc) };
    });
    t.innerHTML = `<thead><tr><th>${BV.w.J}</th><th class="r">Lost</th><th class="r">L/h</th><th>Urine</th><th>Status</th></tr></thead><tbody>
      ${rows.map(({ p, h, o }) => `<tr class="click ${p.id === pid ? 'sel' : ''}" data-id="${p.id}"><td><b>#${p.num}</b> ${esc(p.name.split(' ')[0])}</td>
        <td class="r">${h ? fmt(h.pct) + '%' : '—'}</td><td class="r">${h ? fmt(h.rate, 2) : '—'}</td><td>${BV.swatch(o)}</td><td>${h ? chip(h.level, h.short) : chip('na', 'Not weighed')}</td></tr>`).join('')}</tbody>`;
    t.querySelectorAll('tr.click').forEach((tr) => tr.addEventListener('click', () => { pid = tr.dataset.id; loadRec(); team(); }));
    const items = rows.filter((x) => x.h).map(({ p, h }) => ({ label: '#' + p.num, sub: p.name.split(' ')[0], value: Math.max(0, h.rate), color: 'var(--s3)', tip: `<b>${esc(p.name)}</b><div>${fmt(h.rate, 2)} L/h</div>` }));
    const ch = $('#chRate', root);
    if (items.length) BV.chart.bars(ch, { items, yFmt: (v) => fmt(v, 1), showValues: true, title: 'Sweat rate' });
    else ch.innerHTML = '<p class="muted">No weigh-ins.</p>';
  }

  /* =================== 2. plan por integrante =================== */
  /** tasa de sudoración más reciente medida para la persona (en cualquier sesión) */
  function lastRate(id) {
    const D = BV.data;
    const recs = D.hyd.filter((r) => r.pid === id).map((r) => ({ r, s: D.sessions.find((x) => x.id === r.sid), h: BV.calc.hydr(r) })).filter((x) => x.h && x.s && x.h.rate > 0);
    recs.sort((a, b) => b.s.date.localeCompare(a.s.date));
    return recs[0] || null;
  }

  function planView(box) {
    const p = BV.player(planPid) || BV.players()[0];
    planPid = p.id;
    const saved = BV.data.drink || BV.bebida.PRESETS.panela;
    box.innerHTML = `
      <div class="grid g-side-r">
        <div class="card stack">
          <label class="field"><span>${BV.w.J}</span><select id="plP">${BV.playerOptions(planPid)}</select></label>
          <div class="fields">
            <label class="field"><span>Duration (min)</span><input type="number" id="plDur" value="${plan.dur}" min="20" max="240"></label>
            <label class="field"><span>Expected sets</span><select id="plSets">${[2, 3, 4, 5].map((s) => `<option ${s === plan.sets ? 'selected' : ''}>${s}</option>`).join('')}</select></label>
          </div>
          <label class="field"><span>Weather</span><select id="plClima">${Object.entries(CLIMA).map(([k, c]) => `<option value="${k}" ${k === plan.clima ? 'selected' : ''}>${c.label}</option>`).join('')}</select></label>
          <label class="field"><span>Maximum loss</span><select id="plMeta"><option value="1" ${plan.meta === 1 ? 'selected' : ''}>1% of weight (youth)</option><option value="2" ${plan.meta === 2 ? 'selected' : ''}>2% of weight (limit)</option></select></label>
          <label class="field"><span>Drink</span><select id="plBeb"><option value="agua" ${plan.bebida === 'agua' ? 'selected' : ''}>Water</option><option value="guardada" ${plan.bebida === 'guardada' ? 'selected' : ''}>Drink: ${esc(saved.name || 'personalizada')}</option></select></label>
          <button class="btn btn-sm" type="button" id="plEdit">Change drink</button>
          <div id="plInfo"></div>
        </div>
        <div class="stack">
          <div class="card stack" id="plOut"></div>
          <div class="card"><div class="card-h"><h3>Fluid balance</h3><span class="note">% of weight</span></div><div id="plChart"></div></div>
        </div>
      </div>`;
    const upd = () => {
      planPid = $('#plP', box).value; plan.dur = +$('#plDur', box).value || 90; plan.sets = +$('#plSets', box).value;
      plan.clima = $('#plClima', box).value; plan.meta = +$('#plMeta', box).value; plan.bebida = $('#plBeb', box).value;
      planCalc(box);
    };
    ['#plP', '#plDur', '#plSets', '#plClima', '#plMeta', '#plBeb'].forEach((s) => $(s, box).addEventListener('change', upd));
    $('#plDur', box).addEventListener('input', upd);
    $('#plEdit', box).addEventListener('click', () => go('bebida'));
    planCalc(box);
  }

  function planCalc(box) {
    const p = BV.player(planPid);
    const mass = p.mass || 60;
    const meas = lastRate(p.id);
    const rate = meas ? meas.h.rate : CLIMA[plan.clima].rate * (mass / 60);
    const H = plan.dur / 60;
    const loss = rate * H;                              // L de sudor esperados
    const allowed = (plan.meta / 100) * mass;          // kg (= L) que se pueden perder
    const need = Math.max(0, loss - allowed);           // L que debe beber durante
    const pauses = Math.max(1, (plan.sets - 1) + plan.sets * 2); // entre sets + 2 tiempos por set
    const perPause = (need * 1000) / pauses;
    const perHour = need / H;
    const drinkR = plan.bebida === 'guardada' ? BV.bebida.compute(BV.data.drink || BV.bebida.PRESETS.panela) : null;
    const choH = drinkR && drinkR.n ? (drinkR.cho / drinkR.VL) * perHour : 0;     // g/h
    const naH = drinkR && drinkR.n ? (drinkR.naMg / drinkR.VL) * perHour : 0;    // mg/h
    const naLostH = rate * SUDOR_NA;
    const net = Math.max(0, loss - need);               // kg perdidos al final si cumple el plan
    const after = net * 1.5;
    const r = BV.calc.risk(p.id);
    const notes = BV.cond.notes(p, 'hid');
    const roundMl = (x) => Math.round(x / 10) * 10;
    $('#plInfo', box).innerHTML = `<div class="card flat stack" style="gap:4px">
      <div class="row between"><span class="note">Weight</span><b class="num">${fmt(mass, 1)} kg</b></div>
      <div class="row between"><span class="note">Sweat rate</span><b class="num">${fmt(rate, 2)} L/h</b></div>
      <div class="note">${meas ? `Measured: ${esc(meas.s.date)}` : 'Estimated from weather'}</div>
      ${!r.available ? chip('crit', 'Unavailable to compete') : ''}</div>`;
    const choTxt = drinkR && drinkR.n
      ? `<b>${fmt(choH, 0)} g/h</b> of carbohydrates ${plan.dur > 60 ? (choH >= 30 ? chip('ok', 'Goal 30–60 g/h') : chip('warn', 'Under 30 g/h')) : ''} · ${fmt(naH, 0)} of ${fmt(naLostH, 0)} mg/h of sodium`
      : plan.dur > 60 ? 'Over 60 min: better with carbohydrates and salt.' : 'Under 60 min: water.';
    $('#plOut', box).innerHTML = `
      <div class="row between"><h3>Plan for ${esc(p.name)}</h3>${chip(perHour > 1.2 ? 'warn' : 'ok', `${fmt(need, 2)} L during`)}</div>
      <table class="tbl"><tbody>
        <tr><th>4 h before</th><td class="r">${roundMl(5 * mass)}–${roundMl(7 * mass)} ml</td></tr>
        <tr><th>2 h before, if hot</th><td class="r">${roundMl(3 * mass)}–${roundMl(5 * mass)} ml</td></tr>
        <tr><th>Warm-up</th><td class="r">150–250 ml</td></tr>
        <tr><th>During</th><td class="r"><b>${fmt(need, 2)} L</b> · ${roundMl(perPause)} ml per break</td></tr>
        <tr><th>After</th><td class="r"><b>${roundMl(after * 1000)} ml</b> within 2–4 h</td></tr>
      </tbody></table>
      <div class="note">${choTxt}</div>
      ${notes.length ? `<div class="card flat stack" style="gap:6px"><strong>Health</strong>${notes.map((n) => `<div class="note">${esc(n)}</div>`).join('')}</div>` : ''}`;
    // balance de líquidos: sin beber vs. siguiendo el plan (función lineal con escalones)
    const steps = 60, without = [], withPlan = [];
    let drank = 0;
    const pauseT = Array.from({ length: pauses }, (_, i) => ((i + 1) / (pauses + 1)) * plan.dur);
    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * plan.dur;
      while (pauseT.length && pauseT[0] <= t) { pauseT.shift(); drank += perPause / 1000; }
      without.push({ x: t, y: ((rate * t) / 60 / mass) * 100 });
      withPlan.push({ x: t, y: Math.max(0, ((rate * t) / 60 - drank) / mass) * 100 });
    }
    BV.chart.line($('#plChart', box), {
      series: [{ name: 'No drinking', color: 'var(--s2)', points: without, marker: false }, { name: 'Following the plan', color: 'var(--s1)', points: withPlan, marker: false, area: true }],
      refs: [{ y: 2, label: 'Limit 2%' }, { y: 1, label: '1%', color: 'var(--warn)' }],
      yMin: 0, xFmt: (v) => Math.round(v) + ' min', tipX: (v) => `Minute ${Math.round(v)}`, tipFmt: (v) => fmt(v, 2) + '%', yFmt: (v) => fmt(v, 1) + '%', legend: true, height: 230, title: 'Fluid balance',
    });
  }

  /* =================== 3. bebida deportiva y estequiometría =================== */
  function drink(box) {
    const B = BV.bebida;
    box.innerHTML = `
      <div class="row">${Object.entries(B.PRESETS).map(([k, pr]) => `<button class="btn btn-sm" type="button" data-pre="${k}">${esc(pr.name)}</button>`).join('')}</div>
      <div class="grid g-side-r">
        <div class="card stack">
          <h3>Ingredients</h3>
          <label class="field"><span>Water (ml)</span><input type="number" id="bW" min="0" max="5000" step="50" value="${recipe.water}"></label>
          <div class="stack" id="bItems" style="gap:8px"></div>
          <div class="row"><select class="inp" id="bAddSel" style="width:auto">${Object.entries(B.ING).map(([k, i]) => `<option value="${k}">${esc(i.name)}</option>`).join('')}</select><button class="btn btn-sm" type="button" id="bAdd">Add</button></div>
          <div class="sep"></div>
          <div class="row between"><span class="note" id="bSavedNote"></span><button class="btn btn-ball" type="button" id="bUse">Use in the plan</button></div>
        </div>
        <div class="stack">
          <div class="card stack" id="bRes"></div>
          <details class="card"><summary>Stoichiometric calculation</summary><div id="bStoich"></div></details>
        </div>
      </div>
      <div class="grid g2">
        <div class="card stack">
          <h3>Benefits</h3>
          <table class="tbl"><tbody>
            <tr><th>Carbohydrates</th><td>Energy past 60 min</td></tr>
            <tr><th>Sodium</th><td>Holds fluid and replaces sweat</td></tr>
            <tr><th>Potassium and magnesium</th><td>Muscle contraction</td></tr>
            <tr><th>Isotonic</th><td>Absorbed quickly</td></tr>
            <tr><th>Good taste</th><td>They drink more</td></tr>
          </tbody></table>
        </div>
        <div class="card stack">
          <h3>When to use it</h3>
          <table class="tbl"><tbody>
            <tr><th>Under 60 min</th><td>Water</td></tr>
            <tr><th>Over 60 min or heat</th><td>Drink with sugar and salt</td></tr>
            <tr><th>Avoid</th><td>Energy drinks, soda, extra salt</td></tr>
            <tr><th>Diabetes, hypertension or kidney</th><td>See a doctor</td></tr>
          </tbody></table>
        </div>
      </div>`;
    box.querySelectorAll('[data-pre]').forEach((b) => b.addEventListener('click', () => { recipe = JSON.parse(JSON.stringify(B.PRESETS[b.dataset.pre])); drink(box); }));
    $('#bW', box).addEventListener('input', (e) => { recipe.water = +e.target.value || 0; tweak(); calcD(box); });
    $('#bAdd', box).addEventListener('click', () => {
      const id = $('#bAddSel', box).value, ing = B.ING[id];
      if (recipe.items.some((x) => x.id === id)) { BV.toast('That ingredient is already on the list.'); return; }
      recipe.items.push({ id, q: ing.unit === 'mL' ? 100 : id === 'sal' || id === 'kcl' ? 1 : 20 });
      tweak(); items(box); calcD(box);
    });
    $('#bUse', box).addEventListener('click', () => {
      BV.data.drink = JSON.parse(JSON.stringify(recipe)); plan.bebida = 'guardada'; BV.save(true);
      BV.toast('Drink saved: the hydration plan now uses it');
      saved(box);
    });
    items(box); calcD(box); saved(box);
  }
  function tweak() { if (recipe.name && !recipe.name.endsWith('(ajustada)')) recipe.name += ' (adjusted)'; }
  function saved(box) {
    const d = BV.data.drink;
    $('#bSavedNote', box).textContent = d ? `In the plan: ${d.name || 'personalizada'}` : '';
  }
  function items(box) {
    const B = BV.bebida;
    const list = $('#bItems', box);
    list.innerHTML = recipe.items.length ? recipe.items.map((it, i) => {
      const ing = B.ING[it.id];
      return `<div class="card flat stack" style="gap:6px;padding:10px 12px">
        <div class="row between"><strong>${esc(ing.name)}</strong><button class="btn btn-ghost btn-sm" type="button" data-rm="${i}">Remove</button></div>
        <div class="row"><input class="inp" type="number" data-q="${i}" value="${it.q}" min="0" step="${ing.unit === 'mL' ? 10 : it.id === 'sal' || it.id === 'kcl' ? 0.1 : 1}" style="width:110px" aria-label="Amount of ${esc(ing.name)}"><span class="note">${ing.unit}</span><span class="note" data-cas="${i}">${B.casera(it.id, it.q)}</span></div>
        ${ing.nota ? `<span class="note">${esc(ing.nota)}</span>` : ''}</div>`;
    }).join('') : '<p class="muted">Water only. Add ingredients below.</p>';
    list.querySelectorAll('[data-q]').forEach((inp) => inp.addEventListener('input', () => {
      const i = +inp.dataset.q; recipe.items[i].q = +inp.value || 0;
      list.querySelector(`[data-cas="${i}"]`).textContent = B.casera(recipe.items[i].id, recipe.items[i].q);
      tweak(); calcD(box);
    }));
    list.querySelectorAll('[data-rm]').forEach((b) => b.addEventListener('click', () => { recipe.items.splice(+b.dataset.rm, 1); tweak(); items(box); calcD(box); }));
  }

  function calcD(box) {
    const B = BV.bebida, M = B.M;
    const r = B.compute(recipe);
    const res = $('#bRes', box), st = $('#bStoich', box);
    if (!r.n) { res.innerHTML = '<p class="muted">Add water or a liquid.</p>'; st.innerHTML = ''; return; }
    const osmPos = BV.clamp((r.osm / 600) * 100, 0, 100);
    res.innerHTML = `
      <div class="row between"><h3>${esc(recipe.name || 'Custom drink')}</h3><span class="note">${fmt(r.V, 0)} ml total</span></div>
      <div class="bigres">
        <div><span>Carbohydrates</span><b>${fmt(r.choPct, 1)}%</b></div>
        <div><span>Sodium</span><b>${fmt(r.naMmolL, 0)} mmol/L</b></div>
        <div><span>Potassium</span><b>${fmt(r.kMmolL, 1)} mmol/L</b></div>
        <div><span>Osmolarity</span><b>${fmt(r.osm, 0)} mOsm/L</b></div>
        <div><span>Energy</span><b>${fmt(r.kcal / r.VL, 0)} kcal/L</b></div>
        <div><span>Sugars per glass</span><b>${fmt((r.cho / r.V) * 250, 0)} g</b></div>
      </div>
      <div><div class="gauge" style="background:linear-gradient(90deg,var(--s3) 0 45%,var(--good) 45% 55%,var(--crit) 55% 100%)" aria-hidden="true"><i style="left:${osmPos}%"></i></div>
        <div class="gauge-l"><span>Hypotonic</span><span>Isotonic 270–330 · blood ≈ 290</span><span>Hypertonic</span></div></div>
      <div class="stack" style="gap:6px">${Object.values(r.ev).map(([l, t]) => `<div>${chip(l, t)}</div>`).join('')}</div>`;
    // pasos estequiométricos con los números de esta receta
    const t = r.t, n = r.n, VL = r.VL;
    const line = (a) => `<div>${a}</div>`;
    const parts = [];
    if (t.nacl > 0) parts.push(`<p><b>${parts.length + 1}. Dissolving the salt</b></p>${line('NaCl(s) → Na⁺(aq) + Cl⁻(aq)')}
      ${line('M(NaCl) = 22.99 + 35.45 = <b>58.44 g/mol</b>')}
      ${line(`n = m / M = ${fmt(t.nacl, 2)} g / 58.44 g/mol = <b>${fmt(n.nacl * 1000, 2)} mmol</b> → gives ${fmt(n.nacl * 1000, 2)} mmol of Na⁺ and ${fmt(n.nacl * 1000, 2)} mmol of Cl⁻`)}
      ${line(`sodium mass = n × M(Na) = ${fmt(n.nacl, 4)} mol × 22.99 g/mol = <b>${fmt(n.nacl * M.Na * 1000, 0)} mg</b>`)}
      ${line(`[Na⁺] = n / V = ${fmt(r.naMg / M.Na, 2)} mmol / ${fmt(VL, 3)} L = <b>${fmt(r.naMmolL, 1)} mmol/L</b>${t.na > 0 ? ` (includes ${fmt(t.na, 0)} mg of natural sodium from the other ingredients)` : ''}`)}`);
    if (t.sac > 0) parts.push(`<p><b>${parts.length + 1}. Sucrose hydrolysis</b> (in the intestine, by the enzyme sucrase)</p>${line('C₁₂H₂₂O₁₁ + H₂O → C₆H₁₂O₆ (glucose) + C₆H₁₂O₆ (fructose)')}
      ${line('M(C₁₂H₂₂O₁₁) = 12×12.011 + 22×1.008 + 11×15.999 = <b>342.30 g/mol</b>')}
      ${line(`n = ${fmt(t.sac, 1)} g / 342.30 g/mol = <b>${fmt(n.sac, 4)} mol</b> → produces ${fmt(n.sac, 4)} mol of glucose (${fmt(n.sac * M.glu, 1)} g) + ${fmt(n.sac, 4)} mol of fructose (${fmt(n.sac * M.fru, 1)} g)`)}
      ${line(`uses ${fmt(n.sac * M.H2O, 2)} g of water · mass conservation: ${fmt(t.sac, 1)} + ${fmt(n.sac * M.H2O, 2)} = <b>${fmt(t.sac + n.sac * M.H2O, 2)} g</b> = ${fmt(2 * n.sac * M.glu, 2)} g of products ✓`)}`);
    if (r.nHex > 0) parts.push(`<p><b>${parts.length + 1}. Cellular respiration</b> (energy for the muscle)</p>${line('C₆H₁₂O₆ + 6 O₂ → 6 CO₂ + 6 H₂O    ΔH ≈ −2803 kJ/mol')}
      ${line(`available monosaccharides = 2·n(sucrose) + n(glucose) + n(fructose)${t.mal > 0 ? ' + maltodextrin units' : ''} = <b>${fmt(r.nHex, 4)} mol</b>`)}
      ${line(`energy = ${fmt(r.nHex, 4)} mol × 2803 kJ/mol = <b>${fmt(r.kJ, 0)} kJ</b> = ${fmt(r.kcal, 0)} kcal (÷ 4.184)`)}
      ${line(`O₂ needed = 6 × ${fmt(r.nHex, 4)} = ${fmt(r.o2Mol, 3)} mol → V = nRT/P = ${fmt(r.o2Mol, 3)} × 0.08206 × 310.15 / 1 atm = <b>${fmt(r.o2L, 1)} L</b> a 37 °C`)}
      ${line(`CO₂ produced = ${fmt(r.co2Mol, 3)} mol × 44.01 g/mol = <b>${fmt(r.co2g, 0)} g</b> · metabolic water = ${fmt(r.co2Mol, 3)} mol × 18.015 g/mol = <b>${fmt(r.h2oMet, 0)} g</b>`)}`);
    parts.push(`<p><b>${parts.length + 1}. Concentration and osmolarity</b></p>
      ${line(`% m/v of carbohydrates = ${fmt(r.cho, 1)} g / ${fmt(r.V, 0)} ml × 100 = <b>${fmt(r.choPct, 2)}%</b>`)}
      ${line(`particles: sugars ${fmt(r.osmParts.azucares, 1)} + citric acid ${fmt(r.osmParts.acido, 1)} + salts (2 ions per formula unit) ${fmt(r.osmParts.sales, 1)} + natural minerals ${fmt(r.osmParts.minerales, 1)} = ${fmt(r.osm * VL, 1)} mOsm`)}
      ${line(`osmolarity = Σ particles / V = ${fmt(r.osm * VL, 1)} mOsm / ${fmt(VL, 3)} L = <b>${fmt(r.osm, 0)} mOsm/L</b> → <b>${r.tipo.toLowerCase()}</b> (blood ≈ 290)`)}
      ${t.sac > 0 ? line('Note: at the same mass, sucrose raises osmolarity less than glucose because its molecule weighs almost twice as much (342 vs. 180 g/mol): there are fewer molecules per gram.') : ''}`);
    st.innerHTML = `<div class="formula" style="line-height:1.8">${parts.join('')}</div><p class="note" style="margin-top:8px">Estimated values.</p>`;
  }

  V.refresh = () => { if (root && tab === 'pesaje') team(); };
  V.destroy = () => { root = null; BV.tip.hide(); };
  BV.on('resize', () => { if (root && tab === 'pesaje') team(); });
  BV.on('team', () => { recipe = null; });
  BV.views.hidratacion = V;
})(window.BV);
