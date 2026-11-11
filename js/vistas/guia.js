/* BioVoley Lab — Coach's Guide (inglés), evaluación del entrenador y manejo de datos */
(function (BV) {
  'use strict';
  const { $, esc } = BV;
  const V = {
    title: "Coach's Guide", nav: 'Guide',
    sub: 'Evidence, evaluation and data',
    tags: ['eng', 'tec'],
  };
  const PASOS = [
    ['1. Measure', 'Jump height and landing knee angle with a phone.'],
    ['2. Track', 'Weight loss, urine color and perceived effort.'],
    ['3. Decide', 'Rest, substitutions and hydration.'],
    ['4. Teach', 'Safe and risky landings, animated.'],
  ];
  const OBJ = [
    ["I don't have time for this.", 'About 15 minutes a week: weigh players and film a few jumps.', 'Product'],
    ["It's too expensive.", 'A phone, a laptop and a bathroom scale. The software is free.', 'Balsalobre-Fernández et al., 2015'],
    ['My experience is enough.', 'Data shows fatigue earlier: the jump drops and knees bend less.', 'Prieske et al., 2017'],
    ['Injuries are part of the sport.', 'Landing and balance training cut ankle sprains in half.', 'Bahr et al., 1997'],
  ];
  // objetivo 3 del proyecto: evaluar si el entrenador entiende los datos y los usa
  const PREG = [
    ['Lost 2.5% of body weight and urine is color 7.', ['Keep playing', 'Rest and rehydrate', 'Check tomorrow'], 1],
    ['Jump dropped 12% between the first and last set.', ['She is injured', 'Sign of fatigue: check landing and rotate out', 'She is not trying'], 1],
    ['Which landing protects the knee most?', ['Straight legs', 'Knees caving in', 'Bent knees aligned with the feet'], 2],
  ];
  const USOS = ['Rest', 'Substitutions', 'Hydration', 'Technique'];
  const REFS = [
    'American College of Sports Medicine et al. (2007). Exercise and fluid replacement. Med Sci Sports Exerc, 39(2), 377–390.',
    'Armstrong, L. E. et al. (1994). Urinary indices of hydration status. Int J Sport Nutr, 4(3), 265–279.',
    'Bahr, R., Lian, Ø. & Bahr, I. A. (1997). A twofold reduction in the incidence of acute ankle sprains in volleyball. Scand J Med Sci Sports, 7(3), 172–177.',
    'Balsalobre-Fernández, C. et al. (2015). The validity and reliability of an iPhone app for measuring vertical jump performance. J Sports Sci, 33(15), 1574–1579.',
    'Borg, G. A. (1982). Psychophysical bases of perceived exertion. Med Sci Sports Exerc, 14(5), 377–381.',
    'Bosco, C., Luhtanen, P. & Komi, P. V. (1983). A simple method for measurement of mechanical power in jumping. Eur J Appl Physiol, 50(2), 273–282.',
    'Brusini, A. et al. (2024). Shoulder pain among volleyball players: A systematic review. Swiss Sports Exerc Med.',
    'Bunker, D. & Thorpe, R. (1982). A model for the teaching of games in secondary schools. Bull Phys Educ, 18(1), 5–8.',
    'Cortina, E. (2007). Voleibol: fundamentos técnicos. FES Zaragoza, UNAM.',
    'Creswell, J. W. & Plano Clark, V. L. (2011). Designing and conducting mixed methods research (2nd ed.). SAGE.',
    'Dewey, J. (1938). Logic: The theory of inquiry. Henry Holt.',
    'Echeverría, J. (2003). La revolución tecnocientífica. Fondo de Cultura Económica.',
    'Gençoğlu, C. et al. (2023). Validity and reliability of "My Jump app" to assess vertical jump performance. Sci Rep, 13.',
    'Gisslén, K. et al. (2005). High prevalence of jumper\'s knee in Swedish elite junior volleyball players. Br J Sports Med, 39(5), 298–301.',
    'Hewett, T. E. et al. (2005). Biomechanical measures of neuromuscular control and valgus loading of the knee. Am J Sports Med, 33(4), 492–501.',
    'Lian, Ø. B., Engebretsen, L. & Bahr, R. (2005). Prevalence of jumper\'s knee among elite athletes from different sports. Am J Sports Med, 33(4), 561–567.',
    'Morin, E. (1990). Introduction à la pensée complexe. ESF.',
    'Popper, K. (1959). The logic of scientific discovery. Hutchinson.',
    'Prieske, O. et al. (2017). Combined effects of fatigue and surface instability on jump biomechanics in elite athletes. Int J Sports Med, 38(10), 781–790.',
    'Rabanal-Rodríguez, G. et al. (2025). Intra- and inter-examiner reliability of Kinovea for hip flexion angle measurement. Appl Sci, 15(3), 1452.',
    'Sackett, D. L. et al. (1996). Evidence based medicine: What it is and what it isn\'t. BMJ, 312(7023), 71–72.',
    'Thomas, D. T., Erdman, K. A. & Burke, L. M. (2016). Nutrition and athletic performance. Med Sci Sports Exerc, 48(3), 543–568.',
    'Thomas, F. & Johnston, O. (1981). The illusion of life: Disney animation. Abbeville Press.',
  ];
  // respaldo epistemológico del proyecto: qué idea sostiene cada parte y dónde se ve en la app
  const MARCO = [
    ['Pragmatism', 'Dewey, 1938', 'Knowledge is valued for the problem it solves.', 'Coaches decide on rest, substitutions and hydration, and the Evaluation tab checks whether they use the data.'],
    ['Post-positivism', 'Popper, 1959', 'Measure with validated instruments, but treat models as fallible.', 'Jump, knee angle, weight, urine and Borg come from validated tools; the models give alerts, not diagnoses.'],
    ['Evidence-based practice', 'Sackett et al., 1996', 'Best evidence + professional expertise + the person\'s context.', 'The data support the coach\'s experience instead of replacing it.'],
    ['Complex thinking', 'Morin, 1990', 'A real problem cannot be understood from a single discipline.', 'A spike is a parabola, a knee load, fatigue, a tactical choice and a message.'],
    ['Technoscience', 'Echeverría, 2003', 'Science, technology and values are produced together.', 'The app generates knowledge, and the ethics of minors\' data are part of the design.'],
  ];
  const DISENO = [['Paradigm', 'Pragmatic, with a post-positivist component'], ['Approach', 'Mixed, mainly quantitative'], ['Type', 'Applied (technological) research'], ['Scope', 'Descriptive-correlational']];
  let tab = 'guia';

  V.render = function (el) {
    el.innerHTML = `
      <div class="seg" role="tablist" aria-label="Content">
        ${[['guia', 'Guide'], ['marco', 'Framework'], ['eval', 'Evaluation'], ['datos', 'Data'], ['refs', 'References']].map(([k, v]) => `<button type="button" data-t="${k}" aria-pressed="${tab === k}">${v}</button>`).join('')}
      </div>
      <div id="gBody" class="stack" style="gap:16px"></div>`;
    el.querySelectorAll('[data-t]').forEach((b) => b.addEventListener('click', () => {
      tab = b.dataset.t; el.querySelectorAll('[data-t]').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); body(el);
    }));
    body(el);
  };

  function body(el) {
    const box = $('#gBody', el);
    if (tab === 'guia') guide(box); else if (tab === 'marco') marco(box); else if (tab === 'eval') evaluacion(box); else if (tab === 'datos') datos(box);
    else box.innerHTML = `<div class="card"><ol class="refs">${REFS.map((r) => `<li>${esc(r)}</li>`).join('')}</ol></div>`;
  }

  function guide(box) {
    box.innerHTML = `
      <div class="steps">${PASOS.map(([t, d]) => `<div class="step"><b>${esc(t)}</b><span>${esc(d)}</span></div>`).join('')}</div>
      <div class="grid g2">${OBJ.map(([q, a, s]) => `<div class="card objection"><q>${esc(q)}</q><p>${esc(a)}</p><span class="note">${esc(s)}</span></div>`).join('')}</div>`;
  }

  function marco(box) {
    box.innerHTML = `
      <div class="grid g2">${MARCO.map(([t, autor, idea, app]) => `
        <div class="card stack" style="gap:8px">
          <div class="row between"><h3>${esc(t)}</h3><span class="note">${esc(autor)}</span></div>
          <p>${esc(idea)}</p>
          <p class="note"><b>In BioVoley:</b> ${esc(app)}</p>
        </div>`).join('')}
        <div class="card stack" style="gap:8px">
          <h3>Research design</h3>
          <table class="tbl"><tbody>${DISENO.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')}</tbody></table>
        </div>
      </div>`;
  }

  function evaluacion(box) {
    const D = BV.data;
    const ult = D.evals[D.evals.length - 1];
    box.innerHTML = `
      <div class="grid g-side">
        <form class="card stack" id="eForm">
          ${PREG.map(([q, ops], i) => `<div class="check-q"><b>${i + 1}. ${esc(q)}</b>${ops.map((o, k) => `<label class="opt" data-q="${i}" data-k="${k}"><input type="radio" name="q${i}" value="${k}">${esc(o)}</label>`).join('')}</div>`).join('')}
          <div class="check-q"><b>This week I used the data for</b><div class="row">${USOS.map((u) => `<label class="check"><input type="checkbox" data-u="${esc(u)}"> ${esc(u)}</label>`).join('')}</div></div>
          <div class="row end"><button class="btn btn-primary" type="submit">Save</button></div>
        </form>
        <div class="card stack">
          <h3>Result</h3>
          <div class="bigres" style="grid-template-columns:repeat(2,minmax(0,1fr))"><div><span>Correct</span><b id="eOk">${ult ? `${ult.ok} / ${PREG.length}` : '—'}</b></div><div><span>Evaluations</span><b id="eN">${D.evals.length}</b></div></div>
          <div class="note" id="eUso">${ult && ult.usos.length ? esc(ult.usos.join(' · ')) : ''}</div>
        </div>
      </div>`;
    $('#eForm', box).addEventListener('submit', (e) => {
      e.preventDefault();
      let ok = 0;
      const faltan = PREG.some((_, i) => !box.querySelector(`[name="q${i}"]:checked`));
      if (faltan) { BV.toast('Answer all three questions.'); return; }
      PREG.forEach(([, , bien], i) => {
        const v = +box.querySelector(`[name="q${i}"]:checked`).value;
        if (v === bien) ok++;
        box.querySelectorAll(`.opt[data-q="${i}"]`).forEach((l) => { l.classList.toggle('ok', +l.dataset.k === bien); l.classList.toggle('bad', +l.dataset.k === v && v !== bien); });
      });
      const usos = [...box.querySelectorAll('[data-u]:checked')].map((x) => x.dataset.u);
      D.evals.push({ date: BV.today(), ok, usos });
      BV.save(true);
      $('#eOk', box).textContent = `${ok} / ${PREG.length}`; $('#eN', box).textContent = D.evals.length; $('#eUso', box).textContent = usos.join(' · ');
    });
  }

  function datos(box) {
    box.innerHTML = `
      <div class="grid g2">
        <div class="card stack">
          <h3>Backup</h3>
          <div class="row">
            <button class="btn btn-primary" id="gExp" type="button">Export team</button>
            <button class="btn" id="gCsv" type="button">Export jumps</button>
            <label class="btn" for="gImp">Import team</label><input type="file" id="gImp" accept="application/json,.json" hidden>
          </div>
          <div class="sep"></div>
          <div class="row">
            <button class="btn" id="gDemo" type="button">Reset sample</button>
            ${BV.data.example ? '' : '<button class="btn btn-danger" id="gWipe" type="button">Delete this team</button>'}
          </div>
        </div>
        <div class="card stack">
          <h3>Ethics</h3>
          <ul class="note" style="margin:0;padding-left:18px;display:flex;flex-direction:column;gap:4px">
            <li>Minors: written consent from a parent or guardian.</li>
            <li>Data and video stay on this device.</li>
            <li>They protect each player; never compare players in public.</li>
            <li>These are alerts, not diagnoses: with pain, see a health professional.</li>
          </ul>
        </div>
      </div>`;
    $('#gExp', box).addEventListener('click', () => download(`biovoley-${BV.today()}.json`, JSON.stringify(BV.data, null, 2), 'application/json'));
    $('#gCsv', box).addEventListener('click', () => {
      const rows = [['date', 'session', 'player', 'number', 'position', 'set', 'height_cm', 'flight_ms', 'knee_flexion', 'knee_ankle', 'source']];
      BV.data.jumps.forEach((j) => {
        const p = BV.player(j.pid), s = BV.data.sessions.find((x) => x.id === j.sid);
        rows.push([s ? s.date : '', s ? s.name : '', p ? p.name : '', p ? p.num : '', p ? p.pos : '', j.set, j.cm, j.ms, j.flex ?? '', j.kasr ?? '', j.src]);
      });
      download(`biovoley-saltos-${BV.today()}.csv`, rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n'), 'text/csv');
    });
    $('#gImp', box).addEventListener('change', (e) => {
      const f = e.target.files[0]; if (!f) return;
      const rd = new FileReader();
      rd.onload = () => {
        try {
          const d = JSON.parse(rd.result);
          if (!d || !Array.isArray(d.players) || !Array.isArray(d.sessions)) throw new Error('formato');
          // se importa como un equipo nuevo: no reemplaza a los existentes
          const id = BV.addTeam(d);
          BV.switchTeam(id);
          BV.toast(`Team imported: ${d.team || 'unnamed'}`);
        } catch (err) { BV.toast('This file is not a valid BioVoley backup.'); }
      };
      rd.readAsText(f);
      e.target.value = '';
    });
    BV.armDelete($('#gDemo', box), () => { BV.resetDemo(); BV.toast('Sample team reset'); }, 'Tap again');
    const wipe = $('#gWipe', box);
    if (wipe) BV.armDelete(wipe, () => { const name = BV.data.team; BV.deleteTeam(BV.activeTeam()); BV.toast(`Team deleted: ${name}`); }, 'Delete? Tap again');
  }

  function download(name, text, type) { BV.download(name, new Blob([text], { type })); }

  BV.views.guia = V;
})(window.BV);
