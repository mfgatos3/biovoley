// Fondo del gimnasio para la sección Aterrizaje: node fondo.js <url> <archivo.jpg>
const { abrir, espera } = require('./cdp.js'), fs = require('fs');
(async () => {
  const [url, salida] = process.argv.slice(2);
  const b = await abrir();
  await b.ir(url + '#board'); await espera(800);
  await b.ev(`(()=>{BV.RENDER=true;document.getElementById('tVid3').click();return 1})()`);
  for (let i = 0; i < 240; i++) { if (await b.ev(`!!(BV.video3d._state()&&BV.video3d._state().tl)`)) break; await espera(250); }
  const dato = await b.ev(`(()=>{const M=BV.video3d._state(),R=M.renderer,T=window.THREE;M.playing=false;cancelAnimationFrame(M.raf);BV.video3d._seek(0);
    M.figs.visible=false;M.ball.visible=false;M.markPlane.visible=false;R.setSize(960,816,false);
    const c=new T.PerspectiveCamera(38,960/816,.1,120);c.position.set(-8.2,1.25,4.2);c.lookAt(1.2,1.65,-2.6);c.updateMatrixWorld();
    R.render(M.scene,c);return R.domElement.toDataURL('image/jpeg',.86)})()`);
  fs.writeFileSync(salida, Buffer.from(dato.split(',')[1], 'base64'));
  console.log('listo', fs.statSync(salida).size);
  b.cerrar(); process.exit(0);
})().catch((e) => { console.error('FALLO', e); process.exit(1); });
