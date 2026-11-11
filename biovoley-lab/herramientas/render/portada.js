// Imagen de la portada del panel: jugadora 3D rematando, fondo transparente, con las
// articulaciones proyectadas para dibujar encima el seguimiento de pose.
// Uso: node portada.js <url> <carpeta de salida>
const { abrir, espera } = require('./cdp.js'), fs = require('fs');
const PAGINA = `(async()=>{
 BV.RENDER=true;BV.RENDER_ALFA=true;
 document.getElementById('tVid3').click();
 for(let i=0;i<240&&!(BV.video3d._state()&&BV.video3d._state().tl);i++) await new Promise(r=>setTimeout(r,100));
 const M=BV.video3d._state(),R=M.renderer,S=M.scene,T=window.THREE;M.playing=false;cancelAnimationFrame(M.raf);BV.video3d._seek(0);
 S.children.forEach(o=>{ if(!o.isLight) o.visible=false; });
 S.background=null;S.fog=null;R.setClearColor(0,0);
 const fig=BV.personaje.crear({sexo:'F',altura:1.76,piel:'medio',camiseta:'#1c4fd0',numero:10,short:'#0f1626',pelo:'#3a2a20',zurda:true});
 S.add(fig.root); fig.root.rotation.y=Math.PI; fig.root.position.set(0,0.62,0);
 const base={k:0,lean:0,tw:0,st:0,fo:0,pt:0,aL:0,aR:0,bL:0,bR:0,eL:0,eR:0,rL:0,rR:0,hd:0};
 const P=Object.assign(base,{k:0.95,lean:-0.22,tw:-0.7,aL:2.55,aR:2.35,bL:0.05,bR:0.62,eL:0.12,eR:2.05,hd:-0.5,pt:0.6});
 BV.personaje.posar(fig,P,null,{yaw:0.1,pitch:-0.45,aire:1});
 const bal=M.ball; bal.visible=true; S.add(bal);
 fig.root.updateMatrixWorld(true);
 const w=(b)=>new T.Vector3().setFromMatrixPosition(b.matrixWorld);
 const cab=w(fig.h.cabeza);
 const libre=fig.R,hm=w(libre.mano),hh=w(libre.brazo);
 bal.position.copy(hm.clone().add(hm.clone().sub(hh).normalize().multiplyScalar(0.42)));
 const Wd=900,Hd=900; R.setSize(Wd,Hd,false);
 const cam=new T.PerspectiveCamera(30,1,0.1,50); cam.position.set(-2.4,1.25,5.2); cam.lookAt(-0.3,1.75,0); cam.updateMatrixWorld();
 R.clear(); R.render(S,cam);
 const pr=(v)=>{const p=v.clone().project(cam);return [(p.x+1)/2*Wd,(1-p.y)/2*Hd]};
 const L=fig.L,Rr=fig.R;
 const pts={cabeza:pr(cab.clone().add(new T.Vector3(0,0.11*fig.s,0))),cuello:pr(w(fig.h.cuello)),
  hI:pr(w(L.brazo)),hD:pr(w(Rr.brazo)),cI:pr(w(L.ante)),cD:pr(w(Rr.ante)),mI:pr(w(L.mano)),mD:pr(w(Rr.mano)),
  caI:pr(w(L.muslo)),caD:pr(w(Rr.muslo)),rI:pr(w(L.pierna)),rD:pr(w(Rr.pierna)),tI:pr(w(L.pie)),tD:pr(w(Rr.pie))};
 const ang=(a,b,c)=>{const u=a.clone().sub(b).normalize(),v=c.clone().sub(b).normalize();return 180-Math.acos(Math.max(-1,Math.min(1,u.dot(v))))*180/Math.PI};
 const rodilla=Math.round(ang(w(L.muslo),w(L.pierna),w(L.pie)));
 const balon=pr(bal.position), borde=pr(bal.position.clone().add(new T.Vector3(0,0.105,0)));
 // recorte al contenido visible
 const c=document.createElement('canvas');c.width=Wd;c.height=Hd;const g=c.getContext('2d');g.drawImage(R.domElement,0,0);
 const d=g.getImageData(0,0,Wd,Hd).data;let x0=Wd,y0=Hd,x1=0,y1=0;
 for(let y=0;y<Hd;y++)for(let x=0;x<Wd;x++){if(d[(y*Wd+x)*4+3]>8){if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;}}
 const m=24;x0=Math.max(0,x0-m);y0=Math.max(0,y0-m);x1=Math.min(Wd,x1+m);y1=Math.min(Hd,y1+m);
 const o=document.createElement('canvas');o.width=x1-x0;o.height=y1-y0;o.getContext('2d').drawImage(c,-x0,-y0);
 const mv=(p)=>[Math.round(p[0]-x0),Math.round(p[1]-y0)];
 Object.keys(pts).forEach(k=>{pts[k]=mv(pts[k])});
 return {img:o.toDataURL('image/webp',0.9),meta:{w:o.width,h:o.height,pts,rodilla,balon:mv(balon),r:Math.round(Math.abs(borde[1]-balon[1]))}};
})()`;
(async () => {
  const [url, sal] = process.argv.slice(2);
  const b = await abrir();
  await b.ir(url + '#board'); await espera(800);
  const r = await b.ev(PAGINA);
  fs.writeFileSync(`${sal}/portada.webp`, Buffer.from(r.img.split(',')[1], 'base64'));
  fs.writeFileSync(`${sal}/portada.json`, JSON.stringify(r.meta));
  console.log(JSON.stringify(r.meta));
  console.log(b.logs.filter((l) => /EXC|error/i.test(l)).slice(0, 4).join(' | '));
  b.cerrar(); process.exit(0);
})().catch((e) => { console.error('FALLO', e); process.exit(1); });
