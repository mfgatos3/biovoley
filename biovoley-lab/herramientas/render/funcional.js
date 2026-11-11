// Prueba de los flujos principales: node funcional.js <url> [banderas de chromium]
const { abrir, espera } = require('./cdp.js');
(async () => {
  const [url, ...extra] = process.argv.slice(2);
  const b = await abrir({ extra });
  await b.send('Emulation.setDeviceMetricsOverride', { width: 1366, height: 800, deviceScaleFactor: 1, mobile: false });
  await b.ir(url); await espera(1200);
  const ir = async (h) => { await b.ev(`location.hash='${h}';1`); await espera(450); };
  const fallos = [], ok = (n, v) => { console.log(v ? '  bien ' : '  FALLA', n); if (!v) fallos.push(n); };

  // orina: se guarda, sube el riesgo y aparece en el panel
  await ir('#hidratacion');
  await b.ev(`(()=>{const s=document.getElementById('hP');s.value='p5';s.dispatchEvent(new Event('change'));document.querySelector('#hUr [data-u="7"]').click();document.querySelector('#hForm [type=submit]').click();return 1})()`);
  await espera(300);
  ok('orina guardada', await b.ev(`BV.data.hyd.find(r=>r.pid==='p5'&&r.sid===BV.data.current).uc===7`));
  ok('la orina entra al riesgo', await b.ev(`BV.calc.risk('p5').reasons.some(x=>/Dark urine/.test(x))`));
  await ir('#panel');
  ok('panel muestra color y decisión', await b.ev(`(()=>{const f=document.querySelector('#pTbl tr[data-pid="p5"]');return !!f.querySelector('.swatch')&&/Hydrate/.test(f.textContent)})()`));
  ok('solo orina, sin pesos', await b.ev(`(()=>{BV.saveMonitor('p8',BV.data.current,{pre:0,post:0,intakeMl:0,uc:4});return BV.data.hyd.find(r=>r.pid==='p8').uc===4&&BV.calc.risk('p8').orina.n===4})()`));

  // sesión nueva desde el encabezado
  const n0 = await b.ev(`BV.data.sessions.length`);
  await b.ev(`(()=>{document.getElementById('sbNew').click();document.getElementById('sbName').value='Prueba';document.getElementById('sbForm').requestSubmit();return 1})()`);
  await espera(300);
  ok('sesión creada', await b.ev(`BV.data.sessions.length`) === n0 + 1);
  ok('selector sigue en el encabezado', await b.ev(`!!document.querySelector('#vTools #sbSel')`));

  // ficha con pestañas y registro rápido
  await ir('#jugadores');
  await b.ev(`document.querySelector('[data-f="sesion"]').click();1`); await espera(150);
  ok('pestaña sesión visible', await b.ev(`!document.getElementById('mForm').hidden&&document.getElementById('pForm').hidden`));
  await b.ev(`(()=>{document.querySelector('#mUr [data-u="3"]').click();document.getElementById('mPre').value=60;document.getElementById('mPost').value=59.5;document.querySelector('#mForm [type=submit]').click();return 1})()`);
  await espera(300);
  ok('monitoreo guarda orina', await b.ev(`BV.data.hyd.some(r=>r.sid===BV.data.current&&r.uc===3)`));
  await b.ev(`document.querySelector('[data-f="hist"]').click();1`); await espera(150);
  ok('historial con orina', await b.ev(`!!document.querySelector('#mHist .swatch')`));
  await b.ev(`document.querySelector('[data-tab="rapido"]').click();1`); await espera(250);
  await b.ev(`(()=>{const t=document.querySelector('#qTbl tbody tr:nth-child(2)');t.querySelector('[data-k="uc"]').value=6;document.getElementById('qSave').click();return t.dataset.pid})()`);
  await espera(300);
  ok('registro rápido guarda orina', await b.ev(`BV.data.hyd.some(r=>r.sid===BV.data.current&&r.uc===6)`));

  // plan y bebida
  await ir('#hidratacion');
  await b.ev(`document.querySelector('[data-tab="plan"]').click();1`); await espera(300);
  ok('plan en tabla, sin selector de sesión', await b.ev(`!!document.querySelector('#plOut table')&&document.getElementById('vTools').innerHTML===''`));
  await b.ev(`document.querySelector('[data-tab="bebida"]').click();1`); await espera(300);
  ok('estequiometría presente', await b.ev(`/NaCl/.test(document.getElementById('bStoich').textContent)`));
  await b.ev(`document.querySelector('[data-tab="pesaje"]').click();1`); await espera(200);

  // guía: evaluación del entrenador
  await ir('#guia');
  for (const t of ['eval']) await b.ev(`document.querySelector('[data-t="${t}"]').click();1`);
  await espera(200);
  await b.ev(`(()=>{document.querySelector('[name="q0"][value="1"]').checked=true;document.querySelector('[name="q1"][value="1"]').checked=true;document.querySelector('[name="q2"][value="0"]').checked=true;document.querySelector('[data-u="Hydration"]').checked=true;document.getElementById('eForm').requestSubmit();return 1})()`);
  await espera(200);
  ok('evaluación calificada', await b.ev(`BV.data.evals.slice(-1)[0].ok===2&&BV.data.evals.slice(-1)[0].usos[0]==='Hydration'`));
  await b.ev(`document.querySelector('[data-t="refs"]').click();1`); await espera(150);
  ok('referencias del documento', await b.ev(`/Armstrong/.test(document.getElementById('gBody').textContent)&&document.querySelectorAll('.refs li').length>=15`));
  await b.ev(`document.querySelector('[data-t="datos"]').click();1`); await espera(150);
  ok('exportar disponible', await b.ev(`!!document.getElementById('gExp')`));

  // técnica
  await ir('#fundamentos');
  ok('fundamentos plegados', await b.ev(`document.querySelectorAll('.fund details').length>=8&&!document.querySelector('.fund details[open]')`));
  await b.ev(`document.querySelector('[data-t="reglas"]').click();1`); await espera(150);
  ok('reglas', await b.ev(`document.querySelectorAll('#tBody tr').length>=7`));
  await b.ev(`document.querySelector('[data-t="gestos"]').click();1`);

  // pizarra
  await ir('#pizarra');
  await b.ev(`document.querySelector('[data-side="tLine"]').click();1`); await espera(150);
  ok('alineación en pestaña', await b.ev(`!document.getElementById('tLine').hidden&&document.querySelectorAll('#tLine select').length===6`));
  await b.ev(`document.querySelector('[data-side="tPla"]').click();1`); await espera(100);
  ok('plantel', await b.ev(`document.getElementById('tOn').textContent.length>10`));
  await b.ev(`document.getElementById('tRot').click();1`); await espera(1100);
  ok('rotar', await b.ev(`/^R/.test(document.getElementById('tRotN').textContent)`));

  // cámara: ajustes plegados pero conectados
  await ir('#camara');
  ok('ajustes de cámara', await b.ev(`!!document.getElementById('vSel')&&!!document.getElementById('cPose')&&!!document.getElementById('mSel')`));

  // equipos desde la barra lateral
  await b.ev(`document.getElementById('btnNewTeam').click();1`); await espera(400);
  ok('nuevo equipo', await b.ev(`location.hash==='#setup/new'&&!!document.getElementById('iSave')`));
  await b.ev(`(()=>{const t=document.getElementById('iTeam');t.value='Prueba 10B';t.dispatchEvent(new Event('input'));return 1})()`);
  await ir('#panel');
  const opciones = await b.ev(`document.getElementById('teamSel').options.length`);
  ok('selector de equipos', opciones >= 1);

  // móvil
  await b.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 800, deviceScaleFactor: 2, mobile: true });
  await espera(500);
  ok('sin desborde en móvil', await b.ev(`document.documentElement.scrollWidth<=window.innerWidth+1`));

  const err = b.logs.filter((l) => /EXC|^error/i.test(l));
  console.log('errores de consola:', err.slice(0, 6).join(' | ') || 'ninguno');
  console.log(fallos.length ? `FALLARON ${fallos.length}: ${fallos.join('; ')}` : 'todo bien');
  b.cerrar(); process.exit(0);
})().catch((e) => { console.error('FALLO', e); process.exit(1); });
