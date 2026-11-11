/* BioVoley Lab — gráficos SVG livianos (líneas, barras, minigráficos) */
(function (BV) {
  'use strict';
  const { esc, fmt } = BV;

  function niceTicks(min, max, count = 5) {
    if (!(max > min)) { max = min + 1; }
    const span = max - min;
    const step0 = span / count;
    const mag = Math.pow(10, Math.floor(Math.log10(step0)));
    const norm = step0 / mag;
    const step = (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag;
    const t0 = Math.ceil(min / step - 1e-9) * step;
    const ticks = [];
    for (let v = t0; v <= max + step * 1e-6; v += step) ticks.push(+v.toFixed(10));
    return ticks;
  }

  /** Gráfico de líneas con cruz de lectura y tooltip */
  function line(el, o) {
    const W = Math.max(300, el.clientWidth || 600), H = o.height || 220;
    const m = { l: 44, r: 16, t: 14, b: o.xLabel ? 40 : 28 };
    const all = o.series.flatMap((s) => s.points);
    const xs = all.map((p) => p.x), ys = all.map((p) => p.y).concat((o.refs || []).map((r) => r.y));
    const xMin = o.xMin ?? Math.min(...xs), xMax = o.xMax ?? Math.max(...xs);
    let yMin = o.yMin ?? Math.min(...ys), yMax = o.yMax ?? Math.max(...ys);
    if (o.yMin === undefined) { const pad = (yMax - yMin) * 0.15 || 1; yMin -= pad; yMax += pad; }
    const yT = niceTicks(yMin, yMax, 4);
    yMin = Math.min(yMin, yT[0]); yMax = Math.max(yMax, yT[yT.length - 1]);
    const X = (v) => m.l + ((v - xMin) / (xMax - xMin || 1)) * (W - m.l - m.r);
    const Y = (v) => H - m.b - ((v - yMin) / (yMax - yMin || 1)) * (H - m.t - m.b);
    const xT = o.xTicks || niceTicks(xMin, xMax, 5);
    const yF = o.yFmt || ((v) => fmt(v, 0));
    const xF = o.xFmt || ((v) => fmt(v, 0));

    let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.title || 'Line chart')}">`;
    yT.forEach((v) => { s += `<line class="grid-l" x1="${m.l}" x2="${W - m.r}" y1="${Y(v)}" y2="${Y(v)}"/><text x="${m.l - 8}" y="${Y(v) + 4}" text-anchor="end">${yF(v)}</text>`; });
    xT.forEach((v) => { s += `<text x="${X(v)}" y="${H - m.b + 16}" text-anchor="middle">${xF(v)}</text>`; });
    s += `<line class="ax" x1="${m.l}" x2="${W - m.r}" y1="${H - m.b}" y2="${H - m.b}"/>`;
    if (o.xLabel) s += `<text x="${(m.l + W - m.r) / 2}" y="${H - 6}" text-anchor="middle" class="lbl">${esc(o.xLabel)}</text>`;
    if (o.yLabel) s += `<text x="${m.l}" y="${m.t - 2}" class="lbl" font-size="11">${esc(o.yLabel)}</text>`;
    (o.refs || []).forEach((r) => {
      s += `<line x1="${m.l}" x2="${W - m.r}" y1="${Y(r.y)}" y2="${Y(r.y)}" stroke="${r.color || 'var(--crit)'}" stroke-width="1.5" stroke-dasharray="5 4"/>`;
      if (r.label) s += `<text x="${W - m.r}" y="${Y(r.y) - 5}" text-anchor="end" class="lbl">${esc(r.label)}</text>`;
    });
    o.series.forEach((se) => {
      if (!se.points.length) return;
      const d = se.points.map((p, i) => `${i ? 'L' : 'M'}${X(p.x).toFixed(1)},${Y(p.y).toFixed(1)}`).join('');
      if (se.area) s += `<path d="${d}L${X(se.points[se.points.length - 1].x)},${H - m.b}L${X(se.points[0].x)},${H - m.b}Z" fill="${se.color}" opacity=".1"/>`;
      s += `<path d="${d}" fill="none" stroke="${se.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" ${se.dash ? 'stroke-dasharray="6 5"' : ''}/>`;
      if (se.marker !== false) se.points.forEach((p) => { s += `<circle cx="${X(p.x)}" cy="${Y(p.y)}" r="4.5" fill="${se.color}" stroke="var(--surface)" stroke-width="2"/>`; });
      if (se.dots) se.dots.forEach((p) => { s += `<circle cx="${X(p.x)}" cy="${Y(p.y)}" r="3" fill="${se.color}" opacity=".45"/>`; });
    });
    s += `<line class="xh" x1="0" x2="0" y1="${m.t}" y2="${H - m.b}" stroke="var(--ink-3)" stroke-width="1" visibility="hidden"/>`;
    s += `<rect class="hit" x="${m.l}" y="${m.t}" width="${W - m.l - m.r}" height="${H - m.t - m.b}" fill="transparent"/>`;
    s += '</svg>';
    el.classList.add('chart');
    el.innerHTML = s + (o.series.length > 1 || o.legend ? `<div class="legend">${o.series.filter((se) => se.name).map((se) => `<span><i class="${se.dash ? 'dash' : ''}" style="--c:${se.color}"></i>${esc(se.name)}</span>`).join('')}</div>` : '');

    const svg = el.querySelector('svg'), xh = svg.querySelector('.xh'), hit = svg.querySelector('.hit');
    const xVals = [...new Set(o.series.flatMap((se) => se.points.map((p) => p.x)))].sort((a, b) => a - b);
    const move = (ev) => {
      const pt = svg.getBoundingClientRect();
      const px = ((ev.clientX - pt.left) / pt.width) * W;
      let best = xVals[0], bd = Infinity;
      xVals.forEach((v) => { const d = Math.abs(X(v) - px); if (d < bd) { bd = d; best = v; } });
      xh.setAttribute('x1', X(best)); xh.setAttribute('x2', X(best)); xh.setAttribute('visibility', 'visible');
      const rows = o.series.map((se) => { const p = se.points.find((q) => q.x === best); return p ? `<div>${esc(se.name || '')} <b>${(o.tipFmt || yF)(p.y)}</b></div>` : ''; }).join('');
      BV.tip.show(`<div><b>${esc(o.tipX ? o.tipX(best) : xF(best))}</b></div>${rows}`, ev.clientX, ev.clientY);
    };
    hit.addEventListener('pointermove', move);
    hit.addEventListener('pointerleave', () => { xh.setAttribute('visibility', 'hidden'); BV.tip.hide(); });
  }

  /** Barras verticales con línea de umbral y tooltip por barra */
  function bars(el, o) {
    const W = Math.max(300, el.clientWidth || 600), H = o.height || 220;
    const m = { l: 44, r: 12, t: 16, b: 46 };
    const vals = o.items.map((i) => i.value).concat((o.refs || []).map((r) => r.y));
    let yMax = o.yMax ?? Math.max(...vals, 0) * 1.15;
    const yT = niceTicks(0, yMax, 4); yMax = Math.max(yMax, yT[yT.length - 1]);
    const n = o.items.length || 1;
    const bw = Math.min(46, ((W - m.l - m.r) / n) * 0.62);
    const X = (i) => m.l + ((i + 0.5) / n) * (W - m.l - m.r);
    const Y = (v) => H - m.b - (v / yMax) * (H - m.t - m.b);
    const yF = o.yFmt || ((v) => fmt(v, 0));
    let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.title || 'Bar chart')}">`;
    yT.forEach((v) => { s += `<line class="grid-l" x1="${m.l}" x2="${W - m.r}" y1="${Y(v)}" y2="${Y(v)}"/><text x="${m.l - 8}" y="${Y(v) + 4}" text-anchor="end">${yF(v)}</text>`; });
    o.items.forEach((it, i) => {
      const x = X(i) - bw / 2, y = Y(Math.max(0, it.value)), h = H - m.b - y;
      const r = Math.min(4, h / 2, bw / 2);
      const color = it.color || 'var(--s1)';
      s += `<path class="bar" data-i="${i}" d="M${x},${H - m.b}V${y + r}Q${x},${y} ${x + r},${y}H${x + bw - r}Q${x + bw},${y} ${x + bw},${y + r}V${H - m.b}Z" fill="${color}"/>`;
      s += `<text x="${X(i)}" y="${H - m.b + 15}" text-anchor="middle">${esc(it.label)}</text>`;
      if (it.sub) s += `<text x="${X(i)}" y="${H - m.b + 29}" text-anchor="middle" font-size="10">${esc(it.sub)}</text>`;
      if (o.showValues) s += `<text x="${X(i)}" y="${y - 5}" text-anchor="middle" class="lbl">${yF(it.value)}</text>`;
    });
    s += `<line class="ax" x1="${m.l}" x2="${W - m.r}" y1="${H - m.b}" y2="${H - m.b}"/>`;
    (o.refs || []).forEach((r) => {
      s += `<line x1="${m.l}" x2="${W - m.r}" y1="${Y(r.y)}" y2="${Y(r.y)}" stroke="${r.color || 'var(--crit)'}" stroke-width="1.5" stroke-dasharray="5 4"/>`;
      if (r.label) s += `<text x="${W - m.r}" y="${Y(r.y) - 5}" text-anchor="end" class="lbl">${esc(r.label)}</text>`;
    });
    s += '</svg>';
    el.classList.add('chart');
    el.innerHTML = s;
    el.querySelectorAll('.bar').forEach((b) => {
      const it = o.items[+b.dataset.i];
      b.addEventListener('pointermove', (ev) => BV.tip.show(it.tip || `<b>${esc(it.label)}</b><div>${yF(it.value)}</div>`, ev.clientX, ev.clientY));
      b.addEventListener('pointerleave', () => BV.tip.hide());
      if (o.onClick) { b.style.cursor = 'pointer'; b.addEventListener('click', () => o.onClick(it)); }
    });
  }

  /** Minigráfico de tendencia (devuelve SVG en texto) */
  function spark(values, { w = 120, h = 34, color = 'var(--s1)' } = {}) {
    const v = values.filter(Number.isFinite);
    if (v.length < 2) return '<span class="note">—</span>';
    const min = Math.min(...v), max = Math.max(...v), span = max - min || 1;
    const X = (i) => 3 + (i / (v.length - 1)) * (w - 6);
    const Y = (x) => h - 4 - ((x - min) / span) * (h - 8);
    const d = v.map((x, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(x).toFixed(1)}`).join('');
    return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true"><path d="${d}L${X(v.length - 1)},${h}L${X(0)},${h}Z" fill="${color}" opacity=".12"/><path d="${d}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="${X(v.length - 1)}" cy="${Y(v[v.length - 1])}" r="3" fill="${color}"/></svg>`;
  }

  /** Prepara un canvas nítido (HiDPI) y devuelve su contexto y tamaño en px CSS */
  function canvas(cv, cssW, cssH) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = cssW || cv.clientWidth || 600, h = cssH || Math.round(w * (cv.dataset.ratio ? +cv.dataset.ratio : 0.5));
    const pw = Math.round(w * dpr), ph = Math.round(h * dpr);
    if (cv.width !== pw || cv.height !== ph) { cv.width = pw; cv.height = ph; }
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, w, h };
  }

  BV.chart = { line, bars, spark, niceTicks, canvas };
})(window.BV);
