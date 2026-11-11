/* BioVoley Lab — Fundamentos técnicos y reglas clave (consulta rápida) */
(function (BV) {
  'use strict';
  const { esc } = BV;
  const V = {
    title: 'Technique', nav: 'Technique',
    sub: 'Keys of each skill',
    tags: ['ef', 'tec'],
  };
  const RULES = [
    ['Court', '18 × 9 m. Attack line 3 m from the net.'],
    ['Net', 'Women: 2.24 m · boys U-16: 2.35 m · men: 2.43 m.'],
    ['Touches', 'Three at most; nobody touches twice in a row (the block does not count).'],
    ['Rotation', 'When you win the serve back, clockwise: zone 2 to zone 1.'],
    ['At the serve', 'Keep front-back and left-center-right order. Then each player goes to their zone.'],
    ['Back row', 'Attacks only jumping from behind the 3 m line.'],
    ['Sets', 'To 25 by two; the deciding set to 15.'],
  ];

  let tab = 'gestos';
  V.render = function (el) {
    el.innerHTML = `
      <div class="seg" role="tablist" aria-label="Content">
        <button type="button" data-t="gestos" aria-pressed="${tab === 'gestos'}">Skills</button>
        <button type="button" data-t="reglas" aria-pressed="${tab === 'reglas'}">Rules</button>
      </div>
      <div id="tBody"></div>`;
    const body = () => {
      el.querySelector('#tBody').innerHTML = tab === 'gestos'
        ? `<div class="fund">${BV.GESTOS.map((g) => `
          <details class="card" name="fund">
            <summary>${esc(g.nombre)}</summary>
            <div class="stack" style="margin-top:10px">
              <ol>${g.puntos.map((p) => `<li>${esc(p)}</li>`).join('')}</ol>
              <div class="note"><strong>Prevention:</strong> ${esc(g.prevencion)}</div>
              <div class="row end"><a class="btn btn-sm btn-primary" href="#camera/${g.id}">Analyze with the camera</a></div>
            </div>
          </details>`).join('')}</div>`
        : `<div class="card"><div class="tbl-wrap"><table class="tbl"><tbody>${RULES.map(([k, v]) => `<tr><th style="width:150px">${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')}</tbody></table></div></div>`;
    };
    el.querySelectorAll('[data-t]').forEach((b) => b.addEventListener('click', () => {
      tab = b.dataset.t; el.querySelectorAll('[data-t]').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); body();
    }));
    body();
  };
  BV.views.fundamentos = V;
})(window.BV);
