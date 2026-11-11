/* BioVoley Lab — Crear o editar el equipo (primer uso) */
(function (BV) {
  'use strict';
  const { $, esc } = BV;
  const POS_N = { S: 'Setter', OH: 'Outside hitter', OPP: 'Opposite', MB: 'Middle blocker', L: 'Libero' };
  const AGE_DEF = { u14: 13, u16: 15, u18: 17, may: 20 };
  const V = {
    get title() { return /\/new/.test(location.hash) || BV.data.example ? 'Create your team' : 'Edit team'; },
    nav: 'Team',
    sub: 'Age, height and weight of each player',
    tags: ['ef', 'tec'],
  };
  let st = null;

  V.render = function (el, arg) {
    const D = BV.data;
    const editing = arg !== 'new' && !D.example && D.players.length > 0;
    st = {
      el, mode: editing ? 'editar' : 'nuevo', team: editing ? D.team : '', cat: editing ? D.cat : 'F', age: editing ? D.age : 'u16',
      rows: editing ? BV.players().map((p) => { const c = (p.conds || [])[0]; return { id: p.id, name: p.name, num: p.num, pos: p.pos, age: p.age, height: p.height, mass: p.mass, hand: p.hand, sex: p.sex || D.cat, lim: c ? c.tipo : '', limDet: c ? c.detalle || '' : '' }; }) : [],
    };
    while (st.rows.length < 8) st.rows.push(blank());
    el.innerHTML = `
      <div class="card stack">
        <div class="fields">
          <label class="field" style="grid-column:span 2"><span>Team name</span><input id="iTeam" value="${esc(st.team)}" placeholder="E.g.: Team 10B" required></label>
          <label class="field"><span>Age group</span><select id="iAge">${Object.entries(BV.AGES).map(([k, v]) => `<option value="${k}" ${k === st.age ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
        </div>
        <div class="row between">
          <div class="seg" role="group" aria-label="Category">${Object.entries(BV.CATS).map(([k, v]) => `<button type="button" data-cat="${k}" aria-pressed="${k === st.cat}">${v}</button>`).join('')}</div>
          <span class="note" id="iNet"></span>
        </div>
      </div>
      <div class="card stack">
        <div class="card-h"><h3>Players</h3><span class="note" id="iCount"></span></div>
        <div class="tbl-wrap"><table class="tbl edit" id="iRows"></table></div>
        <div class="row">
          <button class="btn btn-sm" id="iAdd" type="button">Add row</button>
          <button class="btn btn-sm" id="iPasteBtn" type="button">Paste list from Excel</button>
        </div>
        <div class="card flat stack" id="iPaste" hidden>
          <p class="note">Name; number; position; age; height; weight; hand</p>
          <textarea id="iPasteTxt" rows="5" class="inp" style="font-family:var(--f-mono);font-size:.85rem" placeholder="Ana Pérez; 7; setter; 15; 1.65; 56; right&#10;Luisa Gómez; 10; outside; 16; 172; 61; left"></textarea>
          <div class="row end"><button class="btn btn-primary btn-sm" id="iPasteGo" type="button">Add to the list</button></div>
        </div>
      </div>
      <div class="row between">
        ${editing ? '<a class="btn btn-ghost" href="#team">Back without saving</a>' : '<button class="btn btn-ghost" id="iDemo" type="button">Use the sample</button>'}
        <button class="btn btn-primary" id="iSave" type="button">${editing ? 'Save changes' : 'Save team'}</button>
      </div>`;
    el.querySelectorAll('[data-cat]').forEach((b) => b.addEventListener('click', () => {
      st.cat = b.dataset.cat;
      el.querySelectorAll('[data-cat]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      net(); rows();
    }));
    $('#iAge', el).addEventListener('change', (e) => { st.age = e.target.value; net(); });
    $('#iTeam', el).addEventListener('input', (e) => { st.team = e.target.value; });
    $('#iAdd', el).addEventListener('click', () => { st.rows.push(blank()); rows(); focusRow(st.rows.length - 1); });
    $('#iPasteBtn', el).addEventListener('click', () => { $('#iPaste', el).hidden = !$('#iPaste', el).hidden; $('#iPasteTxt', el).focus(); });
    $('#iPasteGo', el).addEventListener('click', () => {
      const list = BV.parsePlayers($('#iPasteTxt', el).value);
      if (!list.length) { BV.toast('No names found in the text.'); return; }
      st.rows = st.rows.filter((r) => r.name.trim()).concat(list.map((p) => Object.assign(blank(), Object.fromEntries(Object.entries(p).filter(([, v]) => v === v && v !== '')))));
      rows(); $('#iPasteTxt', el).value = ''; $('#iPaste', el).hidden = true;
      BV.toast(`${list.length} added to the list. Review and save.`);
    });
    const demo = $('#iDemo', el);
    if (demo) demo.addEventListener('click', () => { BV.switchTeam('demo', true); BV.toast('Using the sample team'); location.hash = '#panel'; BV.route(); });
    $('#iSave', el).addEventListener('click', save);
    net(); rows();
  };

  function blank() { return { id: null, name: '', num: '', pos: 'OH', age: '', height: '', mass: '', hand: 'D', sex: st ? (st.cat === 'X' ? 'F' : st.cat) : 'F', lim: '', limDet: '' }; }
  /** adivina la zona del cuerpo o la enfermedad a partir del detalle escrito */
  function guess(det) {
    const t = (det || '').toLowerCase();
    const Z = [['tobillo', /tobillo|pie|aquiles|esguince/], ['rodilla', /rodill|menisco|ligamento|rotul|patel/], ['cadera', /cadera|muslo|isquio|cuádri|cuadri|ingle/], ['espalda', /espalda|lumbar|column|cervical/], ['hombro', /hombro|manguito|clavícula|clavicula/], ['codo', /codo/], ['muneca', /muñeca|muneca|mano/], ['dedos', /dedo/], ['cabeza', /cabeza|cuello|conmoci/]];
    const E = [['asma', /asma/], ['diabetes', /diabet/], ['hipertension', /hipertens|presión|presion/], ['epilepsia', /epilep|convuls/], ['anemia', /anemia/], ['cardiaca', /coraz|cardi|soplo|arritm/], ['renal', /riñ|rin|renal/], ['alergia', /alerg/]];
    return { zona: (Z.find(([, r]) => r.test(t)) || ['otra'])[0], enf: (E.find(([, r]) => r.test(t)) || ['otra'])[0] };
  }
  function net() { $('#iNet', st.el).textContent = `Net height for this category: ${BV.fmt(BV.netFor(st.cat, st.age), 2)} m`; }
  function focusRow(i) { const r = st.el.querySelector(`tr[data-i="${i}"] input`); if (r) r.focus(); }

  function rows() {
    const mixed = st.cat === 'X';
    const t = $('#iRows', st.el);
    t.innerHTML = `<thead><tr><th>Name</th><th>N.º</th><th>Position</th><th>Age</th><th>Height (cm)</th><th>Weight (kg)</th><th>Hand</th>${mixed ? '<th>Sexo</th>' : ''}<th>Health limitation</th><th></th></tr></thead>
      <tbody>${st.rows.map((r, i) => `<tr data-i="${i}">
        <td><input data-k="name" value="${esc(r.name)}" placeholder="First and last name" style="min-width:170px" aria-label="Name"></td>
        <td><input data-k="num" type="number" min="1" max="99" value="${esc(r.num)}" style="width:64px" aria-label="Number"></td>
        <td><select data-k="pos" aria-label="Position">${Object.entries(POS_N).map(([k, v]) => `<option value="${k}" ${k === r.pos ? 'selected' : ''}>${v}</option>`).join('')}</select></td>
        <td><input data-k="age" type="number" min="8" max="45" value="${esc(r.age)}" style="width:64px" aria-label="Age"></td>
        <td><input data-k="height" type="number" min="120" max="220" value="${esc(r.height)}" style="width:84px" aria-label="Height in centimeters"></td>
        <td><input data-k="mass" type="number" min="25" max="150" step="0.1" value="${esc(r.mass)}" style="width:84px" aria-label="Weight in kilograms"></td>
        <td><select data-k="hand" aria-label="Dominant hand"><option value="D" ${r.hand !== 'Z' ? 'selected' : ''}>Right</option><option value="Z" ${r.hand === 'Z' ? 'selected' : ''}>Left</option></select></td>
        ${mixed ? `<td><select data-k="sex" aria-label="Sex"><option value="F" ${r.sex === 'F' ? 'selected' : ''}>F</option><option value="M" ${r.sex === 'M' ? 'selected' : ''}>M</option></select></td>` : ''}
        <td style="white-space:nowrap"><select data-k="lim" aria-label="Limitation type"><option value="">None</option>${Object.entries(BV.cond.TIPOS).map(([k, v]) => `<option value="${k}" ${k === r.lim ? 'selected' : ''}>${k === 'enfermedad' ? 'Illness' : v}</option>`).join('')}</select>
          <input data-k="limDet" value="${esc(r.limDet)}" placeholder="Detail: e.g. ankle sprain, asthma" style="width:220px" aria-label="Limitation detail"></td>
        <td><button class="btn btn-ghost btn-sm" type="button" data-del="${i}" aria-label="Remove row">Remove</button></td></tr>`).join('')}</tbody>`;
    t.querySelectorAll('input, select').forEach((inp) => inp.addEventListener('input', () => {
      const i = +inp.closest('tr').dataset.i;
      st.rows[i][inp.dataset.k] = inp.value;
      count();
    }));
    t.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', () => { st.rows.splice(+b.dataset.del, 1); if (!st.rows.length) st.rows.push(blank()); rows(); }));
    count();
  }
  function count() { const n = st.rows.filter((r) => String(r.name).trim()).length; $('#iCount', st.el).textContent = `${n} named${n < 6 ? ` · the board needs at least 6` : ''}`; }

  function save() {
    const list = st.rows.filter((r) => String(r.name).trim());
    if (!String(st.team).trim()) { BV.toast('Enter the team name.'); $('#iTeam', st.el).focus(); return; }
    if (!list.length) { BV.toast('Add at least one person to the team.'); return; }
    const bad = list.find((r) => !(+r.height >= 120 && +r.height <= 220) || !(+r.mass >= 25 && +r.mass <= 150));
    if (bad) { BV.toast(`Height (120–220 cm) or weight (25–150 kg) missing for ${bad.name.trim()}.`); return; }
    // números: respeta los escritos y completa los vacíos sin repetir
    const used = new Set(list.map((r) => +r.num).filter((n) => n > 0));
    list.forEach((r) => { if (!(+r.num > 0)) { let n = 1; while (used.has(n)) n++; r.num = n; used.add(n); } });
    if (st.mode === 'nuevo') { const id = BV.addTeam(); BV.switchTeam(id, true); } // equipo propio, aparte del de ejemplo
    const keep = new Set();
    list.forEach((r) => {
      const v = {
        name: r.name.trim(), num: +r.num, pos: r.pos, age: +r.age || AGE_DEF[st.age], height: +r.height, mass: +r.mass, hand: r.hand,
        sex: st.cat === 'X' ? r.sex : st.cat,
      };
      let p = r.id && BV.player(r.id);
      if (p) { Object.assign(p, v); keep.add(p.id); }
      else { p = Object.assign({ id: BV.uid('p'), pain: { knee: false, shoulder: false, ankle: false }, consent: false, conds: [] }, v); BV.data.players.push(p); keep.add(p.id); }
      // limitación de salud: crea o actualiza la primera condición (el detalle completo se edita en la ficha)
      p.conds = p.conds || [];
      if (r.lim) {
        const g = guess(r.limDet);
        const c0 = p.conds[0];
        const base = { tipo: r.lim, detalle: String(r.limDet || '').trim(), zona: r.lim === 'enfermedad' ? undefined : (c0 && c0.zona) || g.zona, enf: r.lim === 'enfermedad' ? (c0 && c0.enf) || g.enf : undefined };
        if (c0) Object.assign(c0, base);
        else p.conds.push(Object.assign({ id: BV.uid('c'), desde: BV.today(), estado: 'activa', restr: r.lim === 'fractura' ? ['compite'] : [], aval: false }, base));
      } // "Ninguna" en la tabla no borra condiciones ya detalladas en la ficha
    });
    const D2 = BV.data;
    const gone = D2.players.filter((p) => !keep.has(p.id)).map((p) => p.id);
    if (gone.length) {
      D2.players = D2.players.filter((p) => keep.has(p.id));
      ['jumps', 'hyd', 'rpe'].forEach((k) => { D2[k] = D2[k].filter((x) => !gone.includes(x.pid)); });
      Object.keys(D2.lineup).forEach((z) => { if (gone.includes(D2.lineup[z])) delete D2.lineup[z]; });
      if (gone.includes(D2.liberoId)) delete D2.liberoId;
    }
    D2.team = String(st.team).trim(); D2.cat = st.cat; D2.age = st.age;
    D2.settings.net = BV.netFor(st.cat, st.age);
    D2.example = false;
    BV.save();
    BV.toast(`Team saved: ${list.length} players. Now record their monitoring.`);
    location.hash = '#team/rapido';
  }

  V.destroy = () => { st = null; };
  BV.views.inicio = V;
})(window.BV);
