// cuadros sueltos de un video de referencia: node cuadros.js <url> <kind> <prefijo> T1 T2 ...
const { abrir, espera } = require('./cdp.js'), fs = require('fs');
(async () => {
  const [url, kind, pref, ...ts] = process.argv.slice(2);
  const b = await abrir();
  await b.ir(url + '#board'); await espera(800);
  await b.ev(`(()=>{const D=BV.data;D.team='Reference team';const nom={S:'the\\u00A0setter',OH:'the\\u00A0outside',OPP:'the\\u00A0opposite',MB:'the\\u00A0middle',L:'the\\u00A0libero'};D.players.forEach(p=>{p.name=nom[p.pos]||p.name});BV.RENDER=true;return 1})()`);
  await b.ev(`document.getElementById('tVid3').click();1`);
  for (let i = 0; i < 160; i++) { if (await b.ev(`!!(BV.video3d._state()&&BV.video3d._state().tl)`)) break; await espera(250); }
  await b.ev(`(()=>{const M=BV.video3d._state();M.root.querySelector('[data-k="${kind}"]').click();M.playing=false;return 1})()`);
  await espera(1500);
  console.log(await b.ev(`(()=>{const M=BV.video3d._state(),tl=M.tl;return JSON.stringify({total:M.total,escena:tl.total,beats:tl.beats.map(x=>[x.tipo,+x.t.toFixed(2),x.T0&&+x.T0.toFixed(2),x.T1&&+x.T1.toFixed(2)])})})()`));
  for (const T of ts) {
    const t0 = Date.now();
    await b.ev(`(()=>{for(const d of [.12,.08,.04,0])BV.video3d._seek(${+T}-d);return 1})()`);
    const d = await b.ev(`BV.video3d._state().out.toDataURL('image/jpeg',.88)`);
    fs.writeFileSync(`${pref}_${T}.jpg`, Buffer.from(d.split(',')[1], 'base64'));
    console.log(T, (Date.now() - t0) / 4 | 0, 'ms/c');
  }
  console.log(b.logs.filter((l) => /EXC|error/i.test(l)).slice(0, 5).join(' | '));
  b.cerrar(); process.exit(0);
})().catch((e) => { console.error('FALLO', e); process.exit(1); });
