// Revisa VioBolley.html: node verificar.js <url> <prefijo de capturas> [banderas de chromium]
const { abrir, espera } = require('./cdp.js'), fs = require('fs');
const foto = async (b, nom) => { const r = await b.send('Page.captureScreenshot', { format: 'jpeg', quality: 82 }); fs.writeFileSync(nom, Buffer.from(r.result.data, 'base64')); };
(async () => {
  const [url, pref, ...extra] = process.argv.slice(2);
  const b = await abrir({ extra });
  await b.send('Emulation.setDeviceMetricsOverride', { width: 1366, height: 800, deviceScaleFactor: 1, mobile: false });
  const t0 = Date.now();
  await b.ir(url); await espera(1500);
  console.log('carga', (Date.now() - t0) / 1000 | 0, 's; webgl', await b.ev(`(()=>{const c=document.createElement('canvas');return !!(c.getContext('webgl2')||c.getContext('webgl'))})()`));
  const ids = await b.ev(`[...document.querySelectorAll('#nav a')].map(a=>a.dataset.id)`);
  const mal = [];
  for (const id of ids) {
    await b.ev(`location.hash='#${id}';1`); await espera(350);
    if (!(await b.ev(`document.getElementById('view').textContent.length`) > 40)) mal.push(id);
  }
  console.log('vistas', ids.length, 'vacías:', mal.join(',') || 'ninguna');
  await b.ev(`location.hash='#aterrizaje';1`); await espera(3500);
  await foto(b, pref + '_aterrizaje.jpg');
  await b.ev(`location.hash='#pizarra';1`); await espera(900);
  await b.ev(`document.getElementById('tVid3').click();1`);
  for (let i = 0; i < 60; i++) { if (await b.ev(`!!(BV.video3d._state()&&BV.video3d._state().kind)`)) break; await espera(500); }
  for (const kind of (process.env.KINDS || 'z4,quick,switch').split(',')) {
    await b.ev(`document.querySelector('[data-k="${kind}"]').click();1`); await espera(4500);
    console.log(kind, await b.ev(`(()=>{const M=BV.video3d._state(),v=M.vid;return JSON.stringify({soft:M.soft,lento:M.lento,real:M.real,vidOculto:v.hidden,listo:v.readyState,t:+v.currentTime.toFixed(2),dur:v.duration,w:v.videoWidth,err:v.error&&v.error.message})})()`));
    await foto(b, `${pref}_${kind}.jpg`);
  }
  await b.ev(`document.querySelector('[data-k="mine"]').click();1`); await espera(1500);
  console.log('mine', await b.ev(`(()=>{const M=BV.video3d._state();return JSON.stringify({vidOculto:M.vid.hidden,tl:!!M.tl,total:M.total})})()`));
  await b.ev(`BV.video3d.close();1`);
  console.log('errores:', b.logs.filter((l) => /EXC|error/i.test(l)).slice(0, 8).join(' | ') || 'ninguno');
  b.cerrar(); process.exit(0);
})().catch((e) => { console.error('FALLO', e); process.exit(1); });
