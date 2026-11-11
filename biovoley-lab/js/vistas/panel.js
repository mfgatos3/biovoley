/* BioVoley Lab — Panel del entrenador */
(function (BV) {
  'use strict';
  const { $, esc, fmt, chip, mean } = BV;

  /** Selector de sesión reutilizable: va en el encabezado de la sección */
  BV.sessionBar = function (host, onChange) {
    const D = BV.data;
    host.innerHTML = `
      <div class="sb">
        <select class="inp" id="sbSel" aria-label="Session">${BV.sessionOptions()}</select>
        <button class="btn btn-sm" id="sbNew" type="button">+ Session</button>
      </div>
      <form id="sbForm" class="card sb-form" hidden>
        <label class="field"><span>Name</span><input id="sbName" value="Entrenamiento" required></label>
        <div class="fields">
          <label class="field"><span>Date</span><input type="date" id="sbDate" value="${BV.today()}" required></label>
          <label class="field"><span>Minutes</span><input type="number" id="sbMin" value="90" min="10" max="300"></label>
        </div>
        <label class="field"><span>Type</span><select id="sbType"><option value="entreno">Practice</option><option value="partido">Match</option></select></label>
        <div class="row end"><button class="btn btn-ghost btn-sm" type="button" id="sbCancel">Cancel</button><button class="btn btn-primary btn-sm" type="submit">Create</button></div>
      </form>`;
    $('#sbSel', host).addEventListener('change', (e) => { D.current = e.target.value; BV.save(true); onChange && onChange(); BV.emit('session'); });
    $('#sbNew', host).addEventListener('click', () => { $('#sbForm', host).hidden = false; });
    $('#sbCancel', host).addEventListener('click', () => { $('#sbForm', host).hidden = true; });
    $('#sbForm', host).addEventListener('submit', (e) => {
      e.preventDefault();
      const s = { id: BV.uid('s'), date: $('#sbDate', host).value, name: $('#sbName', host).value.trim() || 'Session', minutes: +$('#sbMin', host).value || 90, type: $('#sbType', host).value };
      D.sessions.push(s); D.current = s.id; BV.save(true);
      BV.sessionBar(host, onChange); onChange && onChange();
      BV.toast('Session created');
    });
  };

  /** muestra de color de la orina (1 a 8) */
  BV.swatch = (o) => (o ? `<span class="swatch ${o.n >= 7 ? 'dark' : ''}" style="background:${BV.ORINA[o.n - 1]}" title="${esc(o.label)}">${o.n}</span>` : '—');

  /** selector de la escala de orina; devuelve { valor() } */
  BV.urinePicker = function (host, val, onPick) {
    let cur = val || 0;
    host.innerHTML = `<div class="urine" role="group" aria-label="Urine color">${BV.ORINA.map((c, i) => `<button type="button" data-u="${i + 1}" style="background:${c}${i > 5 ? ';color:#fff' : ''}" aria-pressed="${cur === i + 1}">${i + 1}</button>`).join('')}</div>
      <div class="urine-scale"><span>Hydrated</span><span>Drink water</span><span>Dehydrated</span></div>`;
    host.querySelectorAll('[data-u]').forEach((b) => b.addEventListener('click', () => {
      const n = +b.dataset.u; cur = cur === n ? 0 : n;
      host.querySelectorAll('[data-u]').forEach((x) => x.setAttribute('aria-pressed', String(+x.dataset.u === cur)));
      if (onPick) onPick(cur);
    }));
    return { valor: () => cur };
  };

  const V = {
    title: 'Panel', nav: 'Panel',
    sub: 'Who plays, who rests, who hydrates',
    tags: ['tec', 'mat', 'ef'],
  };
  let root = null;

  V.render = function (el) {
    root = el;
    el.innerHTML = `
      <section class="hero">
        <div class="hero-txt"><div class="hero-eyebrow">Today's session</div><h2 id="hName"></h2><div class="hero-meta" id="hMeta"></div></div>
        <div class="kpis" id="kpis"></div>
      </section>
      <div class="card">
        <div class="card-h"><h3>Today's decisions</h3></div>
        <div class="tbl-wrap"><table class="tbl pt" id="pTbl"></table></div>
      </div>
      <div class="grid g2">
        <div class="card"><div class="card-h"><h3>Weight lost</h3><span class="note">limit 2%</span></div><div id="chHyd"></div></div>
        <div class="card"><div class="card-h"><h3>Team jump</h3><span class="note">cm per set</span></div><div id="chJump"></div></div>
      </div>
      <details class="more">
        <summary>How risk is calculated</summary>
        <p class="note">Points: jump drops ≥ ${BV.data.settings.fatAlert}% (+2) or ≥ ${BV.data.settings.fatWarn}% (+1) · weight lost ≥ 2% (+2) or ≥ 1.5% (+1) · urine color 6 or darker (+1) · Borg ≥ 17 (+1) · stiff landing or knees caving in (+1 or +2) · active injury (+2) or recovering (+1) · discomfort (+1). 2 to 3 points: watch. From 4: high risk. These are signals for the coach, not a diagnosis: with pain, see a health professional.</p>
      </details>`;
    BV.sessionBar($('#vTools'), draw);
    draw();
  };

  /** decisiones concretas para una persona: descanso, cambio, hidratación o técnica */
  function decisiones(r) {
    const a = [];
    if (!r.available) return [['crit', 'Does not play']];
    if (r.level === 'crit') a.push(['crit', 'Sub out']);
    const h = r.hydr, o = r.orina;
    if ((h && h.pct >= 1) || (o && o.level !== 'ok')) a.push([(h && h.pct >= 2) || (o && o.level === 'crit') ? 'crit' : 'warn', h && h.rehyd > 0 ? `Hydrate ${fmt(h.rehyd, 1)} L` : 'Hydrate']);
    if (r.fatigue.level === 'warn' || r.fatigue.level === 'crit') a.push(['warn', 'Fewer jumps']);
    if (r.landing && r.landing.level !== 'ok') a.push(['warn', 'Practice landing']);
    return a;
  }

  function draw() {
    if (!root) return;
    const D = BV.data;
    const ps = BV.players();
    const rank = { crit: 3, warn: 2, ok: 1, na: 0 };
    const risks = ps.map((p) => ({ p, r: BV.calc.risk(p.id) }))
      .sort((a, b) => rank[b.r.level] - rank[a.r.level] || b.r.score - a.r.score || a.p.num - b.p.num);
    const crit = risks.filter((x) => x.r.level === 'crit');
    const hyds = risks.map((x) => x.r.hydr).filter(Boolean);
    const fis = risks.map((x) => x.r.fatigue).filter((f) => Number.isFinite(f.fi));
    const orinas = risks.map((x) => x.r.orina).filter(Boolean);

    const ses = BV.session();
    $('#hName', root).textContent = ses ? ses.name : 'No session';
    $('#hMeta', root).innerHTML = ses ? [new Date(ses.date + 'T12:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }), ses.type === 'partido' ? 'Match' : 'Practice', `${ses.minutes} min`, `Net ${fmt(D.settings.net || 2.24, 2)} m`, `${ps.length} ${BV.w.js}`].map((x) => `<span>${esc(x)}</span>`).join('') : '';
    const n = (v, d = 0) => (Number.isFinite(v) ? `<span data-cnt="${v}" data-dec="${d}">${fmt(v, d)}</span>` : '—');
    $('#kpis', root).innerHTML = `
      <div class="kpi"><div class="kpi-l">High risk</div><div class="kpi-v">${n(crit.length)}<small>/ ${ps.length}</small></div><div class="kpi-d">${crit.length ? esc(crit.map((x) => x.p.name.split(' ')[0]).join(', ')) : 'Nobody'}</div></div>
      <div class="kpi"><div class="kpi-l">Jump drop</div><div class="kpi-v">${fis.length ? n(mean(fis.map((f) => f.fi)), 1) : '—'}<small>%</small></div><div class="kpi-d">First to last set</div></div>
      <div class="kpi"><div class="kpi-l">Weight lost</div><div class="kpi-v">${hyds.length ? n(mean(hyds.map((h) => h.pct)), 1) : '—'}<small>%</small></div><div class="kpi-d">${hyds.filter((h) => h.pct >= 2).length} over the limit</div></div>
      <div class="kpi"><div class="kpi-l">Dark urine</div><div class="kpi-v">${n(orinas.filter((o) => o.level === 'crit').length)}<small>/ ${orinas.length}</small></div><div class="kpi-d">Color 6 or darker</div></div>`;
    if (!root.dataset.contado) { root.dataset.contado = '1'; BV.contar($('#kpis', root)); }

    const t = $('#pTbl', root);
    if (risks.length) {
      t.innerHTML = `<thead><tr><th></th><th>${BV.w.J}</th><th>Status</th><th class="r">Jump</th><th></th><th class="r">Drop</th><th class="r">Knee</th><th class="r">Weight</th><th>Urine</th><th class="r">Borg</th><th>Decision</th></tr></thead><tbody>
      ${risks.map(({ p, r }) => {
        const f = r.fatigue;
        const last = f.sets.length ? f.sets[f.sets.length - 1].mean : NaN;
        const acts = decisiones(r);
        return `<tr class="click" data-pid="${p.id}" title="${esc(r.reasons.join(' · '))}">
          <td><span class="pnum">${p.num}</span></td>
          <td><div class="pt-n">${esc(p.name)}</div><div class="note">${esc(BV.POS[p.pos].short)}</div></td>
          <td>${chip(r.level, r.label)}</td>
          <td class="r">${Number.isFinite(last) ? fmt(last) : '—'}</td>
          <td class="spark-c">${BV.chart.spark(f.sets.map((s) => s.mean), { w: 70, h: 22, color: r.level === 'crit' ? 'var(--crit)' : 'var(--s1)' })}</td>
          <td class="r">${Number.isFinite(f.fi) ? fmt(f.fi) + '%' : '—'}</td>
          <td class="r">${r.landing ? Math.round(r.landing.flex) + '°' : '—'}</td>
          <td class="r">${r.hydr ? '−' + fmt(r.hydr.pct) + '%' : '—'}</td>
          <td>${BV.swatch(r.orina)}</td>
          <td class="r">${r.rpe ? r.rpe.rpe : '—'}</td>
          <td><div class="acts">${acts.map(([l, x]) => `<span class="act ${l}">${esc(x)}</span>`).join('')}</div></td>
        </tr>`;
      }).join('')}</tbody>`;
      t.querySelectorAll('tr.click').forEach((b) => b.addEventListener('click', () => { location.hash = '#fatigue/' + b.dataset.pid; }));
    } else t.innerHTML = `<tbody><tr><td class="muted">No ${BV.w.js}. <a href="#setup/new">Create your team</a>.</td></tr></tbody>`;

    // gráfico de hidratación
    const hItems = risks.filter((x) => x.r.hydr).map(({ p, r }) => ({
      label: '#' + p.num, sub: p.name.split(' ')[0], value: Math.max(0, r.hydr.pct),
      color: r.hydr.pct >= 2 ? 'var(--crit)' : 'var(--s1)',
      tip: `<b>${esc(p.name)}</b><div>Lost ${fmt(r.hydr.pct)}% (${fmt(r.hydr.dm, 2)} kg)</div><div>${esc(r.hydr.label)}</div>`,
    }));
    const chH = $('#chHyd', root);
    if (hItems.length) BV.chart.bars(chH, { items: hItems, refs: [{ y: 2, label: 'Limit 2%' }], yFmt: (v) => fmt(v, v % 1 ? 1 : 0) + '%', yMax: Math.max(3, ...hItems.map((i) => i.value)) * 1.1, title: 'Weight lost' });
    else chH.innerHTML = '<p class="muted">No weigh-ins. <a href="#hydration">Record</a></p>';

    // gráfico de salto del equipo
    const bySet = {};
    risks.forEach(({ r }) => r.fatigue.sets.forEach((s) => { (bySet[s.set] = bySet[s.set] || []).push(s.mean); }));
    const pts = Object.keys(bySet).map(Number).sort((a, b) => a - b).map((s) => ({ x: s, y: mean(bySet[s]) }));
    const chJ = $('#chJump', root);
    if (pts.length >= 2) {
      BV.chart.line(chJ, {
        series: [{ name: 'Team average', color: 'var(--s1)', points: pts, area: true }],
        refs: [{ y: pts[0].y * (1 - D.settings.fatAlert / 100), label: `Alert −${D.settings.fatAlert}%` }],
        xTicks: pts.map((p) => p.x), xFmt: (v) => 'Set ' + v, yFmt: (v) => fmt(v, 0), tipFmt: (v) => fmt(v) + ' cm', title: 'Jump per set',
      });
    } else chJ.innerHTML = '<p class="muted">Jumps from two sets are missing. <a href="#camera">Measure</a></p>';
  }

  V.refresh = draw;
  V.destroy = function () { root = null; BV.tip.hide(); };
  BV.on('resize', () => { if (root) draw(); });
  BV.views.panel = V;
})(window.BV);
