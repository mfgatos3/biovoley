/* BioVoley Lab — Equipo: plantilla, ficha individual con monitoreo y registro rápido */
(function (BV) {
  'use strict';
  const { $, esc, fmt, chip } = BV;
  const V = {
    get title() { return BV.w.Js; },
    get nav() { return BV.w.Js; },
    sub: 'Details, health and measurements',
    tags: ['ef', 'tec', 'mat'],
  };
  let root = null, tab = 'plantilla', sel = null, fTab = 'datos';

  V.render = function (el, arg) {
    root = el;
    if (arg === 'rapido' || arg === 'quick') tab = 'rapido';
    else if (arg && BV.player(arg)) { tab = 'plantilla'; sel = arg; }
    if (sel !== 'nuevo' && !BV.player(sel)) { const f = BV.players()[0]; sel = f ? f.id : null; }
    el.innerHTML = `
      <div class="row between">
        <div class="seg" role="tablist" aria-label="View">
          <button type="button" data-tab="plantilla" aria-pressed="${tab === 'plantilla'}">Roster</button>
          <button type="button" data-tab="rapido" aria-pressed="${tab === 'rapido'}">Record session</button>
        </div>
        <div class="row">
          <a class="btn btn-sm" href="#setup">Edit team</a>
          <button class="btn btn-sm btn-primary" id="pNew" type="button">+ ${BV.w.J}</button>
        </div>
      </div>
      <div id="tabBody"></div>`;
    el.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => {
      tab = b.dataset.tab; el.querySelectorAll('[data-tab]').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); body();
    }));
    $('#pNew', el).addEventListener('click', () => { tab = 'plantilla'; sel = 'nuevo'; el.querySelectorAll('[data-tab]').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.tab === 'plantilla'))); body(); });
    BV.sessionBar($('#vTools'), body);
    body();
  };

  function body() {
    if (!root) return;
    const box = $('#tabBody', root);
    if (!BV.players().length && sel !== 'nuevo') {
      box.innerHTML = `<div class="card row between"><h3>Empty team</h3><a class="btn btn-primary" href="#setup">Create my team</a></div>`;
      return;
    }
    if (tab === 'rapido') quick(box); else roster(box);
  }

  /* ---------- plantilla + ficha ---------- */
  function roster(box) {
    box.innerHTML = `
      <div class="grid g-side">
        <div class="card"><div class="tbl-wrap"><table class="tbl" id="pTbl"></table></div></div>
        <div class="card stack" id="ficha"></div>
      </div>`;
    const ps = BV.players();
    $('#pTbl', box).innerHTML = `<thead><tr><th>#</th><th>Name</th><th>Position</th><th class="r">Age</th><th class="r">Height</th><th class="r">Weight</th><th>Status</th></tr></thead>
      <tbody>${ps.map((p) => {
        const r = BV.calc.risk(p.id);
        const cs = BV.cond.active(p);
        return `<tr class="click ${sel === p.id ? 'sel' : ''}" data-id="${p.id}">
          <td><span class="pnum">${p.num}</span></td><td><strong>${esc(p.name)}</strong></td>
          <td>${esc(BV.POS[p.pos].short)}</td><td class="r">${p.age || '—'}</td><td class="r">${p.height} cm</td><td class="r">${fmt(p.mass, 1)} kg</td><td>${cs.length ? `<span class="note" title="${esc(cs.map((c) => BV.cond.label(c)).join(', '))}">${esc(BV.cond.label(cs[0]))}${cs.length > 1 ? ` +${cs.length - 1}` : ''}</span>` : '<span class="note">—</span>'}</td><td>${chip(r.level, r.label)}</td></tr>`;
      }).join('')}</tbody>`;
    box.querySelectorAll('#pTbl tr.click').forEach((tr) => tr.addEventListener('click', () => { sel = tr.dataset.id; editCond = null; fTab = 'datos'; roster(box); }));
    ficha($('#ficha', box));
  }

  function ficha(box) {
    const id = sel === 'nuevo' ? null : sel;
    const D = BV.data;
    const p = id ? BV.player(id) : { name: '', num: nextNum(), pos: 'OH', mass: '', height: '', age: '', sex: D.cat === 'X' ? 'F' : D.cat, hand: 'D', pain: {}, consent: false };
    if (!p) { box.innerHTML = ''; return; }
    const sess = BV.session();
    box.innerHTML = `
      <div class="row between"><h3>${id ? esc(p.name) : `New ${BV.w.j}`}</h3><div class="row">${id && !p.consent ? chip('warn', 'No consent') : ''}${id ? chip(BV.calc.risk(id).level, BV.calc.risk(id).label) : ''}</div></div>
      ${id ? `<div class="seg" role="tablist" aria-label="Profile">${[['datos', 'Data'], ['salud', 'Health'], ['sesion', 'Session'], ['hist', 'History']].map(([k, v]) => `<button type="button" data-f="${k}" aria-pressed="${fTab === k}">${v}</button>`).join('')}</div>` : ''}
      <form class="stack" id="pForm" data-panel="datos">
        <label class="field"><span>Name</span><input id="fName" value="${esc(p.name)}" required placeholder="First and last name"></label>
        <div class="fields">
          <label class="field"><span>Number</span><input type="number" id="fNum" value="${p.num}" min="1" max="99" required></label>
          <label class="field"><span>Position</span><select id="fPos">${Object.entries(BV.POS).map(([k, v]) => `<option value="${k}" ${k === p.pos ? 'selected' : ''}>${v.label}</option>`).join('')}</select></label>
          <label class="field"><span>Age</span><input type="number" id="fAge" value="${p.age || ''}" min="8" max="45"></label>
          <label class="field"><span>Height (cm)</span><input type="number" id="fH" value="${p.height || ''}" min="120" max="220" required></label>
          <label class="field"><span>Weight (kg)</span><input type="number" id="fMass" value="${p.mass || ''}" step="0.1" min="25" max="150" required></label>
          <label class="field"><span>Dominant hand</span><select id="fHand"><option value="D" ${p.hand !== 'Z' ? 'selected' : ''}>Right</option><option value="Z" ${p.hand === 'Z' ? 'selected' : ''}>Left</option></select></label>
          ${D.cat === 'X' ? `<label class="field"><span>Sex</span><select id="fSex"><option value="F" ${p.sex === 'F' ? 'selected' : ''}>F</option><option value="M" ${p.sex === 'M' ? 'selected' : ''}>M</option></select></label>` : ''}
        </div>
        <div class="row">
          <span class="note">Discomfort:</span>
          <label class="check"><input type="checkbox" id="fKnee" ${p.pain && p.pain.knee ? 'checked' : ''}> Knee</label>
          <label class="check"><input type="checkbox" id="fSh" ${p.pain && p.pain.shoulder ? 'checked' : ''}> Shoulder</label>
          <label class="check"><input type="checkbox" id="fAnk" ${p.pain && p.pain.ankle ? 'checked' : ''}> Ankle</label>
        </div>
        <label class="check"><input type="checkbox" id="fCons" ${p.consent ? 'checked' : ''}> Parent or guardian consent</label>
        <div class="row between">
          <button class="btn btn-primary" type="submit">${id ? 'Save details' : 'Add to team'}</button>
          ${id ? `<button class="btn btn-danger btn-sm" type="button" id="fDel">Remove from team</button>` : ''}
        </div>
      </form>
      ${id ? `
      <div class="stack" id="cCard" data-panel="salud"></div>
      <form class="stack" id="mForm" data-panel="sesion">
        <div class="note">${esc(sess ? `${sess.date} · ${sess.name}` : '')}</div>
        <div class="fields">
          <label class="field"><span>Weight before (kg)</span><input type="number" step="0.1" id="mPre"></label>
          <label class="field"><span>Weight after (kg)</span><input type="number" step="0.1" id="mPost"></label>
          <label class="field"><span>Drank (ml)</span><input type="number" step="50" min="0" id="mIn"></label>
          <label class="field"><span>Effort (Borg)</span><select id="mRpe"><option value="">—</option>${Object.entries(BV.BORG).map(([k, v]) => `<option value="${k}">${k} · ${v}</option>`).join('')}</select></label>
        </div>
        <div class="stack" style="gap:6px"><span class="note">Urine color</span><div id="mUr"></div></div>
        <div class="stack" style="gap:6px"><span class="note">Jump per set (cm)</span>
          <div class="fields" style="grid-template-columns:repeat(5,minmax(0,1fr))">${[1, 2, 3, 4, 5].map((s) => `<label class="field"><span>Set ${s}</span><input type="number" step="0.1" min="5" max="120" data-set="${s}"></label>`).join('')}</div>
        </div>
        <div id="mRes"></div>
        <div class="row end"><button class="btn btn-ball" type="submit">Save monitoring</button></div>
      </form>
      <div class="tbl-wrap" data-panel="hist"><table class="tbl" id="mHist"></table></div>` : ''}`;
    const mostrar = () => box.querySelectorAll('[data-panel]').forEach((x) => { x.hidden = !!id && x.dataset.panel !== fTab; });
    mostrar();
    box.querySelectorAll('[data-f]').forEach((b) => b.addEventListener('click', () => {
      fTab = b.dataset.f; box.querySelectorAll('[data-f]').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); mostrar();
    }));

    // datos personales
    const f = $('#pForm', box);
    f.onsubmit = (e) => {
      e.preventDefault();
      const v = {
        name: $('#fName', f).value.trim(), num: +$('#fNum', f).value, pos: $('#fPos', f).value,
        mass: +$('#fMass', f).value, height: +$('#fH', f).value, age: +$('#fAge', f).value || null,
        sex: $('#fSex', f) ? $('#fSex', f).value : D.cat, hand: $('#fHand', f).value,
        pain: { knee: $('#fKnee', f).checked, shoulder: $('#fSh', f).checked, ankle: $('#fAnk', f).checked }, consent: $('#fCons', f).checked,
      };
      if (!v.name) { BV.toast('Enter the name.'); return; }
      if (!(v.height >= 120 && v.height <= 220) || !(v.mass >= 25 && v.mass <= 150)) { BV.toast('Check height (120–220 cm) and weight (25–150 kg).'); return; }
      if (id) Object.assign(BV.player(id), v);
      else { const np = Object.assign({ id: BV.uid('p') }, v); D.players.push(np); sel = np.id; }
      BV.save();
      BV.toast(id ? 'Details saved' : `${v.name} was added to the team`);
    };
    if (id) BV.armDelete($('#fDel', box), () => {
      D.players = D.players.filter((x) => x.id !== id);
      ['jumps', 'hyd', 'rpe'].forEach((k) => { D[k] = D[k].filter((x) => x.pid !== id); });
      Object.keys(D.lineup).forEach((k) => { if (D.lineup[k] === id) delete D.lineup[k]; });
      if (D.liberoId === id) delete D.liberoId;
      sel = null; BV.save(); BV.toast('Removed from the team');
    });
    if (!id) { $('#fName', box).focus(); return; }
    conds($('#cCard', box), id);

    // monitoreo de la sesión actual
    const m = $('#mForm', box);
    const h = D.hyd.find((r) => r.pid === id && r.sid === D.current);
    const r = D.rpe.find((x) => x.pid === id && x.sid === D.current);
    const fat = BV.calc.fatigue(id);
    if (h) { $('#mPre', m).value = h.pre || ''; $('#mPost', m).value = h.post || ''; $('#mIn', m).value = h.intake ? Math.round(h.intake * 1000) : ''; }
    else $('#mPre', m).placeholder = p.mass;
    const orina = BV.urinePicker($('#mUr', m), h && h.uc);
    if (r) $('#mRpe', m).value = r.rpe;
    fat.sets.forEach((s) => { const i = m.querySelector(`[data-set="${s.set}"]`); if (i) i.value = +s.mean.toFixed(1); });
    const hc = BV.calc.hydr(h);
    $('#mRes', m).innerHTML = `<div class="row">${hc ? chip(hc.level, `${hc.label} · −${fmt(hc.pct)}%`) : ''}${fat.level !== 'na' ? chip(fat.level, `${fat.label} · drop ${fmt(fat.fi)}%`) : ''}</div>`;
    m.onsubmit = (e) => {
      e.preventDefault();
      const sets = {};
      m.querySelectorAll('[data-set]').forEach((i) => { sets[i.dataset.set] = i.value === '' ? null : +i.value; });
      BV.saveMonitor(id, D.current, {
        pre: +$('#mPre', m).value || 0, post: +$('#mPost', m).value || 0, intakeMl: +$('#mIn', m).value || 0,
        uc: orina.valor(), sets, rpe: +$('#mRpe', m).value || null,
      });
      BV.save();
      BV.toast('Monitoring saved');
    };
    // historial por sesión
    const rows = D.sessions.slice().sort((a, b) => b.date.localeCompare(a.date)).map((s) => {
      const hr = D.hyd.find((x) => x.pid === id && x.sid === s.id);
      const hh = BV.calc.hydr(hr), oo = BV.calc.orina(hr && hr.uc);
      const ff = BV.calc.fatigue(id, s.id);
      const rr = D.rpe.find((x) => x.pid === id && x.sid === s.id);
      if (!hh && !oo && !ff.sets.length && !rr) return '';
      return `<tr><td>${esc(s.date)}</td><td>${esc(s.name)}</td><td class="r">${hh ? fmt(hh.pct) + '%' : '—'}</td><td>${BV.swatch(oo)}</td><td class="r">${ff.sets.length ? fmt(ff.sets[0].mean) + (ff.sets.length > 1 ? ' → ' + fmt(ff.hL) : '') : '—'}</td><td class="r">${Number.isFinite(ff.fi) ? fmt(ff.fi) + '%' : '—'}</td><td class="r">${rr ? rr.rpe : '—'}</td></tr>`;
    }).join('');
    $('#mHist', box).innerHTML = `<thead><tr><th>Date</th><th>Session</th><th class="r">Weight</th><th>Urine</th><th class="r">Jump</th><th class="r">Drop</th><th class="r">Borg</th></tr></thead><tbody>${rows || '<tr><td colspan="7" class="muted">No measurements.</td></tr>'}</tbody>`;
  }

  /* ---------- condiciones y limitaciones de salud ---------- */
  let editCond = null; // id de la condición en edición o 'nueva'
  function conds(box, id) {
    const C = BV.cond, p = BV.player(id);
    p.conds = p.conds || [];
    const opt = (obj, sel) => Object.entries(obj).map(([k, v]) => `<option value="${k}" ${k === sel ? 'selected' : ''}>${v}</option>`).join('');
    const list = p.conds.map((c) => {
      const lv = C.blocks(c) ? 'crit' : c.estado === 'superada' ? 'ok' : c.estado === 'activa' ? (c.tipo === 'enfermedad' ? 'warn' : 'crit') : 'warn';
      return `<li class="card flat stack" style="gap:4px;padding:10px 12px">
        <div class="row between"><strong>${esc(C.label(c))}</strong>${chip(lv, C.blocks(c) ? 'Not fit to compete' : C.ESTADOS[c.estado])}</div>
        ${c.detalle ? `<div class="note">${esc(c.detalle)}${c.desde ? ` · since ${esc(c.desde)}` : ''}</div>` : c.desde ? `<div class="note">Since ${esc(c.desde)}</div>` : ''}
        ${(c.restr || []).length ? `<div class="phase-chips">${c.restr.map((r) => `<span>${esc(C.RESTR[r])}</span>`).join('')}</div>` : ''}
        <div class="row between"><span class="note">${c.aval ? 'Medical clearance on file' : 'No medical clearance on file'}</span>
          <div class="row"><button class="btn btn-ghost btn-sm" type="button" data-ed="${c.id}">Edit</button><button class="btn btn-ghost btn-sm btn-danger" type="button" data-del="${c.id}">Delete</button></div></div></li>`;
    }).join('');
    const c = editCond === 'nueva' ? { tipo: 'lesion', zona: 'tobillo', enf: 'asma', detalle: '', desde: BV.today(), estado: 'activa', restr: [], aval: false } : p.conds.find((x) => x.id === editCond);
    box.innerHTML = `
      <div class="card-h"><h3>Conditions and limitations</h3>${editCond ? '' : '<button class="btn btn-sm" type="button" id="cNew">Add</button>'}</div>
      ${p.conds.length ? `<ul class="stack" style="list-style:none;margin:0;padding:0;gap:8px">${list}</ul>` : `<p class="muted">No records.</p>`}
      ${c ? `<form class="card flat stack" id="cForm" style="padding:12px">
        <div class="fields">
          <label class="field"><span>Type</span><select id="cTipo">${opt(C.TIPOS, c.tipo)}</select></label>
          <label class="field" id="cZonaF"><span>Body area</span><select id="cZona">${opt(C.ZONAS, c.zona)}</select></label>
          <label class="field" id="cEnfF"><span>Illness</span><select id="cEnf">${opt(C.ENF, c.enf)}</select></label>
          <label class="field"><span>Status</span><select id="cEst">${opt(C.ESTADOS, c.estado)}</select></label>
          <label class="field"><span>Since</span><input type="date" id="cDesde" value="${esc(c.desde || '')}"></label>
        </div>
        <label class="field"><span>Detail</span><input id="cDet" value="${esc(c.detalle || '')}" placeholder="E.g.: grade 1 sprain"></label>
        <div class="stack" style="gap:6px"><span class="note">Training restrictions</span>
          <div class="row">${Object.entries(C.RESTR).map(([k, v]) => `<label class="check"><input type="checkbox" data-r="${k}" ${(c.restr || []).includes(k) ? 'checked' : ''}> ${v}</label>`).join('')}</div></div>
        <label class="check"><input type="checkbox" id="cAval" ${c.aval ? 'checked' : ''}> Has medical clearance or instructions</label>
        <div class="row end"><button class="btn btn-ghost btn-sm" type="button" id="cCancel">Cancel</button><button class="btn btn-primary btn-sm" type="submit">Save condition</button></div>
      </form>` : ''}
      `;
    const nb = box.querySelector('#cNew');
    if (nb) nb.addEventListener('click', () => { editCond = 'nueva'; conds(box, id); });
    box.querySelectorAll('[data-ed]').forEach((b) => b.addEventListener('click', () => { editCond = b.dataset.ed; conds(box, id); }));
    box.querySelectorAll('[data-del]').forEach((b) => BV.armDelete(b, () => { p.conds = p.conds.filter((x) => x.id !== b.dataset.del); editCond = null; BV.save(); }, 'Delete?'));
    const f = box.querySelector('#cForm');
    if (!f) return;
    const sync = () => {
      const t = $('#cTipo', f).value;
      $('#cZonaF', f).hidden = t === 'enfermedad';
      $('#cEnfF', f).hidden = t !== 'enfermedad';
    };
    $('#cTipo', f).addEventListener('change', sync); sync();
    $('#cCancel', f).addEventListener('click', () => { editCond = null; conds(box, id); });
    f.addEventListener('submit', (e) => {
      e.preventDefault();
      const t = $('#cTipo', f).value;
      const v = {
        tipo: t, zona: t === 'enfermedad' ? undefined : $('#cZona', f).value, enf: t === 'enfermedad' ? $('#cEnf', f).value : undefined,
        detalle: $('#cDet', f).value.trim(), desde: $('#cDesde', f).value, estado: $('#cEst', f).value,
        restr: [...f.querySelectorAll('[data-r]:checked')].map((x) => x.dataset.r), aval: $('#cAval', f).checked,
      };
      if (editCond === 'nueva') p.conds.push(Object.assign({ id: BV.uid('c') }, v));
      else Object.assign(p.conds.find((x) => x.id === editCond), v);
      editCond = null; BV.save(); BV.toast('Condition saved');
    });
  }

  /* ---------- registro rápido de todo el equipo ---------- */
  function quick(box) {
    const D = BV.data;
    const ps = BV.players();
    box.innerHTML = `
      <div class="card stack">
        <div class="tbl-wrap"><table class="tbl edit" id="qTbl">
          <thead><tr><th>Player</th><th>Weight before</th><th>Weight after</th><th>Drank (ml)</th><th>Urine</th><th>Set 1</th><th>Set 2</th><th>Set 3</th><th>Set 4</th><th>Set 5</th><th>Borg</th><th>Status</th></tr></thead>
          <tbody>${ps.map((p) => {
            const h = D.hyd.find((r) => r.pid === p.id && r.sid === D.current);
            const r = D.rpe.find((x) => x.pid === p.id && x.sid === D.current);
            const f = BV.calc.fatigue(p.id);
            const setv = (s) => { const x = f.sets.find((y) => y.set === s); return x ? +x.mean.toFixed(1) : ''; };
            const rk = BV.calc.risk(p.id);
            const n = (k, v, wdt, step = '0.1', ph = '') => `<input data-k="${k}" type="number" step="${step}" value="${v}" placeholder="${ph}" style="width:${wdt}px" aria-label="${k} of ${esc(p.name)}">`;
            return `<tr data-pid="${p.id}">
              <td style="white-space:nowrap"><b>#${p.num}</b> ${esc(p.name)}</td>
              <td>${n('pre', h && h.pre ? h.pre : '', 78, '0.1', p.mass)}</td><td>${n('post', h && h.post ? h.post : '', 78)}</td>
              <td>${n('in', h && h.intake ? Math.round(h.intake * 1000) : '', 78, '50')}</td>
              <td>${n('uc', h && h.uc ? h.uc : '', 54, '1', '1–8')}</td>
              ${[1, 2, 3, 4, 5].map((s) => `<td>${n('s' + s, setv(s), 64)}</td>`).join('')}
              <td>${n('rpe', r ? r.rpe : '', 56, '1')}</td><td>${chip(rk.level, rk.label)}</td></tr>`;
          }).join('')}</tbody></table></div>
        <div class="row between">
          <span class="note">Weight in kg · jumps in cm · urine 1 to 8 · Borg 6 to 20</span>
          <button class="btn btn-ball" id="qSave" type="button">Save all</button>
        </div>
      </div>`;
    $('#qSave', box).addEventListener('click', () => {
      let n = 0, bad = [];
      box.querySelectorAll('#qTbl tbody tr').forEach((tr) => {
        const pid = tr.dataset.pid;
        const g = (k) => { const v = tr.querySelector(`[data-k="${k}"]`).value; return v === '' ? null : +v; };
        const rpe = g('rpe'), uc = g('uc');
        if (rpe != null && !(rpe >= 6 && rpe <= 20)) bad.push('Borg');
        if (uc != null && !(uc >= 1 && uc <= 8)) bad.push('urine');
        const sets = {}; [1, 2, 3, 4, 5].forEach((s) => { sets[s] = g('s' + s); });
        BV.saveMonitor(pid, D.current, {
          pre: g('pre') || 0, post: g('post') || 0, intakeMl: g('in') || 0, uc, sets, rpe: rpe >= 6 && rpe <= 20 ? rpe : null,
        });
        n++;
      });
      BV.save();
      BV.toast(bad.length ? `Saved. Out-of-range values ignored (${[...new Set(bad)].join(', ')}).` : `Monitoring of ${n} players saved`);
    });
  }

  function nextNum() { const used = BV.players().map((p) => p.num); let n = 1; while (used.includes(n)) n++; return n; }

  V.refresh = () => { if (root) body(); };
  V.destroy = () => { root = null; };
  BV.views.jugadores = V;
})(window.BV);
