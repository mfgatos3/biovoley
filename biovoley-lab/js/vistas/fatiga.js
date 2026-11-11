/* BioVoley Lab — Saltos y fatiga: índice de fatiga, regresión lineal y escala de Borg */
(function (BV) {
  'use strict';
  const { $, esc, fmt, chip } = BV;
  const V = {
    title: 'Fatigue', nav: 'Fatigue',
    sub: 'Jump per set and perceived effort',
    tags: ['mat', 'ef', 'tec'],
  };
  let root = null, pid = '', mode = 'ms';

  V.render = function (el, arg) {
    root = el;
    if (arg && BV.player(arg)) pid = arg;
    if (!BV.player(pid)) { const f = BV.players()[0]; pid = f ? f.id : ''; }
    el.innerHTML = `
      <div class="grid g-side">
        <div class="stack">
          <div class="card">
            <div class="card-h">
              <label class="field" style="min-width:240px"><span>${BV.w.J}</span><select id="fP">${BV.playerOptions(pid)}</select></label>
              <div id="fChip"></div>
            </div>
            <div id="fChart"></div>
            <div class="bigres" id="fRes" style="margin-top:12px"></div>
            <details class="more" style="margin-top:12px"><summary>Show calculation</summary><div class="formula" id="fForm"></div></details>
          </div>
          <div class="card">
            <div class="card-h"><h3>Team</h3></div>
            <div class="tbl-wrap"><table class="tbl" id="fTbl"></table></div>
          </div>
        </div>
        <div class="stack">
          <form class="card stack" id="jForm">
            <h3>Add jump</h3>
            <div class="seg" role="group" aria-label="Value to enter">
              <button type="button" data-m="ms" aria-pressed="true">Flight time</button>
              <button type="button" data-m="cm" aria-pressed="false">Height</button>
            </div>
            <div class="fields">
              <label class="field"><span>Set</span><select id="jSet">${[1, 2, 3, 4, 5].map((s) => `<option>${s}</option>`).join('')}</select></label>
              <label class="field"><span id="jLbl">Flight time (ms)</span><input type="number" id="jVal" min="1" step="1" required></label>
            </div>
            <p class="note" id="jConv"></p>
            <div class="row end"><button class="btn btn-primary" type="submit">Add</button></div>
            <details class="more"><summary>Saved jumps</summary><div id="jList"></div></details>
          </form>
          <div class="card stack">
            <h3>Effort (Borg)</h3>
            <input type="range" id="rpe" min="6" max="20" step="1" aria-label="Perceived effort">
            <div class="range-l"><span>6</span><b id="rpeV">—</b><span>20</span></div>
            <div class="row end"><button class="btn btn-sm" type="button" id="rpeSave">Save</button></div>
          </div>
          <div class="card stack">
            <h3>Alert limits</h3>
            <label class="field"><span>Moderate</span><input type="range" id="thW" min="2" max="15" step="1" value="${BV.data.settings.fatWarn}"></label>
            <div class="range-l"><span>jump drop</span><b id="thWv">${BV.data.settings.fatWarn}%</b></div>
            <label class="field"><span>Alert</span><input type="range" id="thA" min="5" max="25" step="1" value="${BV.data.settings.fatAlert}"></label>
            <div class="range-l"><span>jump drop</span><b id="thAv">${BV.data.settings.fatAlert}%</b></div>
          </div>
        </div>
      </div>`;
    BV.sessionBar($('#vTools'), draw);
    $('#fP', el).addEventListener('change', (e) => { pid = e.target.value; draw(); });
    el.querySelectorAll('.seg button').forEach((b) => b.addEventListener('click', () => {
      mode = b.dataset.m;
      el.querySelectorAll('.seg button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      $('#jLbl', el).textContent = mode === 'ms' ? 'Flight time (ms)' : 'Height (cm)';
      $('#jVal', el).value = ''; conv();
    }));
    $('#jVal', el).addEventListener('input', conv);
    $('#jForm', el).addEventListener('submit', (e) => {
      e.preventDefault();
      if (!pid) { BV.toast(`First add ${BV.w.js}.`); return; }
      const v = +$('#jVal', el).value;
      const ms = mode === 'ms' ? v : BV.calc.flightFromCm(v);
      const cm = mode === 'cm' ? v : BV.calc.cmFromFlight(v);
      if (!(cm > 3 && cm < 120)) { BV.toast('That does not look like a real jump. Check the unit.'); return; }
      BV.data.jumps.push({ id: BV.uid('j'), pid, sid: BV.data.current, set: +$('#jSet', el).value, cm: +cm.toFixed(1), ms: Math.round(ms), src: 'manual' });
      BV.save(); $('#jVal', el).value = ''; conv();
      BV.toast(`Jump added: ${fmt(cm)} cm`);
    });
    const rpe = $('#rpe', el);
    rpe.addEventListener('input', () => { $('#rpeV', el).textContent = `${rpe.value} · ${BV.BORG[rpe.value]}`; });
    $('#rpeSave', el).addEventListener('click', () => {
      if (!pid) return;
      const D = BV.data;
      const i = D.rpe.findIndex((x) => x.pid === pid && x.sid === D.current);
      const r = { pid, sid: D.current, rpe: +rpe.value };
      if (i >= 0) D.rpe[i] = r; else D.rpe.push(r);
      BV.save(); BV.toast('Effort saved');
    });
    const th = () => {
      let w = +$('#thW', el).value, a = +$('#thA', el).value;
      if (a <= w) { a = w + 1; $('#thA', el).value = a; }
      BV.data.settings.fatWarn = w; BV.data.settings.fatAlert = a;
      $('#thWv', el).textContent = w + '%'; $('#thAv', el).textContent = a + '%';
      BV.save();
    };
    $('#thW', el).addEventListener('change', th); $('#thA', el).addEventListener('change', th);
    draw();
  };

  function conv() {
    const v = +$('#jVal', root).value;
    const out = $('#jConv', root);
    if (!(v > 0)) { out.textContent = ''; return; }
    out.innerHTML = mode === 'ms'
      ? `h = g·t²/8 = 9.81 × ${fmt(v / 1000, 3)}² / 8 = <b>${fmt(BV.calc.cmFromFlight(v))} cm</b>`
      : `t = √(8h/g) = √(8 × ${fmt(v / 100, 3)} / 9.81) = <b>${Math.round(BV.calc.flightFromCm(v))} ms</b>`;
  }

  function draw() {
    if (!root) return;
    const D = BV.data;
    $('#fP', root).value = pid;
    const f = pid ? BV.calc.fatigue(pid) : null;
    const chartEl = $('#fChart', root);
    if (!f || !f.sets.length) {
      chartEl.innerHTML = '<p class="muted">No jumps in this session. <a href="#camera">Measure with the camera</a></p>';
      $('#fRes', root).innerHTML = ''; $('#fForm', root).innerHTML = ''; $('#fChip', root).innerHTML = '';
    } else {
      $('#fChip', root).innerHTML = chip(f.level, f.label);
      const series = [{ name: 'Average per set', color: 'var(--s1)', points: f.sets.map((s) => ({ x: s.set, y: s.mean })), dots: f.sets.flatMap((s) => s.vals.map((v) => ({ x: s.set, y: v }))) }];
      if (f.reg) {
        const x0 = f.sets[0].set, x1 = Math.max(f.sets[f.sets.length - 1].set, 5);
        series.push({ name: 'Trend (linear regression)', color: 'var(--s2)', dash: true, marker: false, points: [{ x: x0, y: f.reg.m * x0 + f.reg.b }, { x: x1, y: f.reg.m * x1 + f.reg.b }] });
      }
      BV.chart.line(chartEl, {
        series, xMin: 1, xMax: 5, xTicks: [1, 2, 3, 4, 5], xFmt: (v) => 'Set ' + v, legend: true,
        refs: Number.isFinite(f.h1) ? [{ y: f.h1 * (1 - D.settings.fatAlert / 100), label: `Alert −${D.settings.fatAlert}%` }] : [],
        tipFmt: (v) => fmt(v) + ' cm', yLabel: 'cm', title: 'Jump height per set', height: 240,
      });
      const last = f.sets[f.sets.length - 1];
      $('#fRes', root).innerHTML = `
        <div><span>Fatigue index</span><b>${fmt(f.fi)}%</b></div>
        <div><span>Set ${f.sets[0].set} → ${last.set}</span><b>${fmt(f.h1)} → ${fmt(f.hL)}</b></div>
        <div><span>Alert at</span><b>${f.alertSet && f.alertSet > 0 && f.alertSet < 10 ? 'set ' + fmt(f.alertSet, 1) : '—'}</b></div>`;
      $('#fForm', root).innerHTML = Number.isFinite(f.fi) ? `
        Fatigue index = (h<sub>1</sub> − h<sub>last</sub>) / h<sub>1</sub> × 100 = (${fmt(f.h1)} − ${fmt(f.hL)}) / ${fmt(f.h1)} × 100 = <b>${fmt(f.fi)}%</b><br>
        ${f.reg ? `Trend line: h(set) = <b>${fmt(f.reg.m, 2)}</b>·set + <b>${fmt(f.reg.b, 2)}</b><br>
        Alert when h = h<sub>1</sub>·(1 − ${D.settings.fatAlert}/100) = ${fmt(f.h1 * (1 - D.settings.fatAlert / 100))} cm → set = (${fmt(f.h1 * (1 - D.settings.fatAlert / 100))} − ${fmt(f.reg.b, 2)}) / ${fmt(f.reg.m, 2)} ${f.alertSet ? '= <b>' + fmt(f.alertSet, 1) + '</b>' : '(the line does not fall)'}` : ''}`
        : 'A second set is needed.';
    }
    // lista de saltos de la persona elegida
    const js = D.jumps.filter((j) => j.pid === pid && j.sid === D.current).sort((a, b) => a.set - b.set);
    $('#jList', root).innerHTML = js.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Set</th><th class="r">Height</th><th class="r">Flight</th><th>Source</th><th></th></tr></thead><tbody>
      ${js.map((j) => `<tr><td>${j.set}</td><td class="r">${fmt(j.cm)} cm</td><td class="r">${j.ms} ms</td><td class="note">${{ camara: 'Camera', manual: 'Manual', ejemplo: 'Sample' }[j.src] || j.src}</td>
      <td class="r"><button class="btn btn-ghost btn-sm" type="button" data-del="${j.id}" aria-label="Delete jump">Delete</button></td></tr>`).join('')}</tbody></table></div>` : '';
    root.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', () => {
      BV.data.jumps = BV.data.jumps.filter((j) => j.id !== b.dataset.del); BV.save();
    }));
    // esfuerzo
    const r = D.rpe.find((x) => x.pid === pid && x.sid === D.current);
    $('#rpe', root).value = r ? r.rpe : 13;
    $('#rpeV', root).textContent = r ? `${r.rpe} · ${BV.BORG[r.rpe]}` : '—';
    // tabla del equipo
    $('#fTbl', root).innerHTML = `<thead><tr><th>${BV.w.J}</th><th class="r">Set 1</th><th class="r">Last</th><th class="r">Drop</th><th class="r">Borg</th><th>Status</th></tr></thead><tbody>
      ${BV.players().map((p) => {
        const x = BV.calc.fatigue(p.id);
        const rp = D.rpe.find((y) => y.pid === p.id && y.sid === D.current);
        return `<tr class="click ${p.id === pid ? 'sel' : ''}" data-id="${p.id}"><td><b>#${p.num}</b> ${esc(p.name.split(' ')[0])}</td>
          <td class="r">${fmt(x.h1)}</td><td class="r">${fmt(x.hL)}</td><td class="r">${Number.isFinite(x.fi) ? fmt(x.fi) + '%' : '—'}</td>
          <td class="r">${rp ? rp.rpe : '—'}</td><td>${chip(x.level, x.label)}</td></tr>`;
      }).join('')}</tbody>`;
    root.querySelectorAll('#fTbl tr.click').forEach((tr) => tr.addEventListener('click', () => { pid = tr.dataset.id; draw(); }));
  }

  V.refresh = draw;
  V.destroy = () => { root = null; BV.tip.hide(); };
  BV.on('resize', () => { if (root) draw(); });
  BV.views.fatiga = V;
})(window.BV);
