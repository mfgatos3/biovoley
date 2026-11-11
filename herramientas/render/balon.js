// node balon.js <url de balon.html> <salida.webp>
const { abrir, espera } = require('./cdp.js'), fs = require('fs');
(async () => {
  const [url, sal] = process.argv.slice(2);
  const b = await abrir();
  await b.ir(url); await espera(500);
  const t0 = Date.now();
  await b.ev('preparar()');
  const d = await b.ev('hoja(48, 8, 400)');
  fs.writeFileSync(sal, Buffer.from(d.split(',')[1], 'base64'));
  console.log('listo', fs.statSync(sal).size, 'bytes', (Date.now() - t0) / 1000, 's');
  console.log(b.logs.filter((l) => /EXC|error/i.test(l)).slice(0, 4).join(' | '));
  b.cerrar(); process.exit(0);
})().catch((e) => { console.error('FALLO', e); process.exit(1); });
