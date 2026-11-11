// Genera los videos de referencia con un equipo modelo (nombres por rol).
// Uso: node render.js <url de la app> <carpeta de salida> [z4 quick switch]
// Cada video se escribe aparte y solo toma su nombre final cuando quedó completo.
const { abrir, espera } = require('./cdp.js'), fs = require('fs'), { spawn } = require('child_process');
const FPS = 30;
const AJUSTE = `(()=>{const D=BV.data; D.team='Reference team';
 const nom={S:'the\\u00A0setter',OH:'the\\u00A0outside',OPP:'the\\u00A0opposite',MB:'the\\u00A0middle',L:'the\\u00A0libero'};
 D.players.forEach(p=>{p.name=nom[p.pos]||p.name}); BV.RENDER=true; return JSON.stringify({cat:D.cat,n:D.players.length});})()`;
(async () => {
  const [url, salida, ...kinds] = process.argv.slice(2);
  const b = await abrir();
  await b.ir(url + '#pizarra');
  await espera(800);
  console.log(await b.ev(AJUSTE));
  await b.ev(`document.getElementById('tVid3').click(); 1`);
  for (let i = 0; i < 240; i++) { if (await b.ev(`!!(BV.video3d._state()&&BV.video3d._state().tl)`)) break; await espera(250); }
  for (const kind of (kinds.length ? kinds : ['z4', 'quick', 'switch'])) {
    await b.ev(`(()=>{const M=BV.video3d._state();M.root.querySelector('[data-k="${kind}"]').click();M.playing=false;return 1})()`);
    await espera(500);
    const total = await b.ev(`BV.video3d._state().total`), n = Math.ceil(total * FPS);
    console.log(kind, 'dur', total, 'cuadros', n);
    const parcial = `${salida}/${kind}.parcial.mp4`;
    const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-', '-c:v', 'libx264', '-preset', 'slow', '-crf', '23', '-profile:v', 'high', '-level', '4.0', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', parcial], { stdio: ['pipe', 'inherit', 'inherit'] });
    await b.ev(`cancelAnimationFrame(BV.video3d._state().raf),1`);
    const t0 = Date.now();
    for (let i = 0; i < n; i++) {
      const dato = await b.ev(`(()=>{BV.video3d._seek(${(i / FPS).toFixed(4)});return BV.video3d._state().out.toDataURL('image/jpeg',.96)})()`);
      if (!ff.stdin.write(Buffer.from(dato.split(',')[1], 'base64'))) await new Promise((r) => ff.stdin.once('drain', r));
      if (i % 60 === 0) console.log(kind, i, '/', n, `${(Date.now() - t0) / (i + 1) | 0} ms/c`);
    }
    ff.stdin.end();
    const cod = await new Promise((r) => ff.on('close', r));
    if (cod !== 0) throw new Error('ffmpeg terminó con error en ' + kind);
    fs.renameSync(parcial, `${salida}/${kind}.mp4`);
    console.log(kind, 'listo', `${fs.statSync(`${salida}/${kind}.mp4`).size / 1048576 | 0} MB`);
  }
  console.log(b.logs.filter((l) => /EXC|error/i.test(l)).slice(-6).join('\n'));
  b.cerrar(); process.exit(0);
})().catch((e) => { console.error('FALLO', e); process.exit(1); });
