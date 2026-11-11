/* BioVoley Lab — Personas en 3D
   Cuerpos, ropa y pelo de MakeHuman (CC0), preparados con herramientas/personaje.py.
   Cada figura es un esqueleto con mallas deformables; las piernas se resuelven con
   cinemática inversa para que los pies no resbalen y los brazos con ángulos del hombro y codo.
   Marco del modelo: +Z al frente, +Y arriba, +X a su izquierda. */
(function (BV) {
  'use strict';
  const BASE = 'vendor/personaje/';
  let datos = null, cargando = null;
  const lista = (x) => Object.keys(x);
  const lin = (c) => new THREE.Color(c).convertSRGBToLinear();

  async function binario() {
    const el = document.getElementById('emb-pj-bin');
    if (!el) return (await fetch(BASE + 'personaje.bin')).arrayBuffer();
    const txt = atob(el.textContent), b = new Uint8Array(txt.length);
    for (let i = 0; i < txt.length; i++) b[i] = txt.charCodeAt(i);
    return new Response(new Blob([b]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
  }
  async function descripcion() {
    const el = document.getElementById('emb-pj-json');
    return el ? JSON.parse(el.textContent) : (await fetch(BASE + 'personaje.json')).json();
  }
  function textura(nombre, cfg = {}) {
    const el = document.getElementById('emb-pj-' + nombre.replace(/\W/g, '_'));
    return new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => {
        const t = new THREE.Texture(img);
        t.encoding = cfg.lineal ? THREE.LinearEncoding : THREE.sRGBEncoding;
        t.anisotropy = 4; t.needsUpdate = true;
        res(t);
      };
      img.onerror = () => rej(new Error('Falta ' + nombre));
      img.src = el ? el.textContent : BASE + nombre;
    });
  }

  /** carga mallas y texturas una sola vez; responde false si no están disponibles */
  function cargar() {
    if (datos) return Promise.resolve(true);
    if (!cargando) {
      cargando = (async () => {
        const [meta, buf] = await Promise.all([descripcion(), binario()]);
        const nombres = ['piel_F_claro', 'piel_F_medio', 'piel_F_oscuro', 'piel_M_claro', 'piel_M_medio', 'piel_M_oscuro'];
        const tx = {};
        await Promise.all(nombres.map(async (n) => { tx[n] = await textura(n + '.jpg'); }));
        const [ao, zapato, peloF, peloM, ojo, ceja] = await Promise.all([textura('ropa_ao.jpg'), textura('zapato.jpg'), textura('pelo_F.png'), textura('pelo_M.png'), textura('ojo.jpg'), textura('ceja.png')]);
        Object.assign(tx, { ao, zapato, pelo_F: peloF, pelo_M: peloM, ojo, ceja });
        const geo = {};
        lista(meta).forEach((sexo) => {
          geo[sexo] = {};
          lista(meta[sexo].mallas).forEach((k) => { geo[sexo][k] = geometria(buf, meta[sexo].mallas[k]); });
        });
        datos = { meta, tx, geo, ropas: {} };
        return true;
      })().catch((e) => { console.warn('Personajes no disponibles:', e.message); cargando = null; return false; });
    }
    return cargando;
  }

  function geometria(buf, m) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(buf, m.pos, m.n * 3), 3));
    g.setAttribute('normal', new THREE.BufferAttribute(new Int16Array(buf, m.nor, m.n * 3), 3, true));
    g.setAttribute('uv', new THREE.BufferAttribute(new Uint16Array(buf, m.uv, m.n * 2), 2, true));
    g.setAttribute('skinIndex', new THREE.BufferAttribute(new Uint8Array(buf, m.idx, m.n * 4), 4));
    g.setAttribute('skinWeight', new THREE.BufferAttribute(new Uint8Array(buf, m.pes, m.n * 4), 4, true));
    g.setIndex(new THREE.BufferAttribute(new Uint16Array(buf, m.tri, m.t * 3), 1));
    return g;
  }

  /** uniforme: color del equipo, sombras de pliegues y número al frente y atrás */
  function uniforme(color, numero, oscuro) {
    const clave = color + '|' + numero;
    if (datos.ropas[clave]) return datos.ropas[clave];
    const c = document.createElement('canvas'); c.width = c.height = 1024;
    const g = c.getContext('2d');
    g.fillStyle = color; g.fillRect(0, 0, 1024, 1024);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = oscuro ? '#10182a' : '#ffffff';
    if (numero !== '' && numero != null) {
      g.font = '800 150px "Barlow Condensed", Arial, sans-serif';
      g.fillText(String(numero), 0.56 * 1024, 0.17 * 1024);
      g.font = '800 165px "Barlow Condensed", Arial, sans-serif';
      g.fillText(String(numero), 0.17 * 1024, 0.16 * 1024);
    }
    g.globalCompositeOperation = 'multiply';
    g.drawImage(datos.tx.ao.image, 0, 0, 1024, 1024);
    g.globalCompositeOperation = 'source-over';
    const t = new THREE.CanvasTexture(c);
    t.encoding = THREE.sRGBEncoding; t.anisotropy = 4;
    datos.ropas[clave] = t;
    return t;
  }

  /** opciones: sexo F|M, altura (m), piel claro|medio|oscuro, camiseta '#hex', numero, short '#hex', pelo '#hex', zurda */
  function crear(o) {
    const sexo = o.sexo === 'M' ? 'M' : 'F';
    const M = datos.meta[sexo], Gs = datos.geo[sexo], T = datos.tx;
    const modelo = new THREE.Group();
    const huesos = M.huesos.map((h) => {
      const b = new THREE.Bone(); b.name = h.n;
      const p = h.p < 0 ? [0, 0, 0] : M.huesos[h.p].head;
      b.position.set(h.head[0] - p[0], h.head[1] - p[1], h.head[2] - p[2]);
      return b;
    });
    M.huesos.forEach((h, i) => { if (h.p < 0) modelo.add(huesos[i]); else huesos[h.p].add(huesos[i]); });
    modelo.updateMatrixWorld(true);
    const esqueleto = new THREE.Skeleton(huesos);
    const std = (x) => new THREE.MeshStandardMaterial(Object.assign({ skinning: true, roughness: 0.75 }, x));
    const mats = {
      piel: std({ map: T[`piel_${sexo}_${o.piel || 'medio'}`], roughness: 0.52 }),
      camiseta: std({ map: uniforme(o.camiseta || '#2a78d6', o.numero, o.numeroOscuro), roughness: 0.62, side: THREE.DoubleSide }),
      short: std({ color: lin(o.short || '#141b2e'), roughness: 0.6, side: THREE.DoubleSide }),
      zapato: std({ map: T.zapato, roughness: 0.5 }),
      rodillera: std({ color: lin(o.rodillera || '#191d27'), roughness: 0.85 }),
      pelo: std({ map: T['pelo_' + sexo], color: lin(o.pelo || '#ffffff'), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.55 }),
      ojos: std({ map: T.ojo, roughness: 0.18 }),
      cejas: std({ map: T.ceja, color: lin(o.pelo || '#ffffff'), transparent: true, depthWrite: false, roughness: 0.8 }),
    };
    const mallas = {};
    lista(M.mallas).forEach((k) => {
      const me = new THREE.SkinnedMesh(Gs[k], mats[k]);
      me.bind(esqueleto, new THREE.Matrix4());
      me.frustumCulled = false;
      me.castShadow = !['ojos', 'cejas'].includes(k);
      me.receiveShadow = true;
      modelo.add(me); mallas[k] = me;
    });
    const raiz = new THREE.Group();
    modelo.rotation.y = Math.PI / 2; // la figura del video mira hacia +X
    const s = (o.altura || 1.72) / M.alto;
    modelo.scale.setScalar(s);
    raiz.add(modelo);
    return arnes({ root: raiz, modelo, mallas, s, real: true, altoModelo: M.alto, lefty: !!o.zurda }, M, huesos);
  }

  /* ---------- pose ---------- */
  function arnes(fig, M, huesos) {
    const idx = {}; M.huesos.forEach((h, i) => { idx[h.n] = i; });
    const b = (n) => huesos[idx[n]];
    const v = (a) => new THREE.Vector3(a[0], a[1], a[2]);
    const cab = (n) => v(M.huesos[idx[n]].head);
    fig.h = { root: b('root'), lumbar: b('spine04'), pecho: b('spine02'), cuello: b('neck01'), cabeza: b('head') };
    fig.pelvis0 = cab('root');
    const lado = (s, sg) => {
      const hom = cab('upperarm01.' + s), cod = cab('lowerarm01.' + s), mun = cab('wrist.' + s), cad = cab('upperleg01.' + s), rod = cab('lowerleg01.' + s), tob = cab('foot.' + s);
      return {
        sg, cla: b('clavicle.' + s), brazo: b('upperarm01.' + s), ante: b('lowerarm01.' + s), mano: b('wrist.' + s),
        muslo: b('upperleg01.' + s), pierna: b('lowerleg01.' + s), pie: b('foot.' + s),
        rBrazo: cod.clone().sub(hom).normalize(), rAnte: mun.clone().sub(cod).normalize(),
        rMuslo: rod.clone().sub(cad).normalize(), rPierna: tob.clone().sub(rod).normalize(),
        cad, L1: rod.distanceTo(cad), L2: tob.distanceTo(rod), tob,
      };
    };
    fig.L = lado('L', 1); fig.R = lado('R', -1);
    return fig;
  }

  const X = () => new THREE.Vector3(1, 0, 0), Y = () => new THREE.Vector3(0, 1, 0);
  const tmpQ = () => new THREE.Quaternion();
  const rot = (eje, ang) => tmpQ().setFromAxisAngle(eje, ang);

  /** dirección del brazo en el marco del pecho: a=flexión (0 abajo, π/2 adelante, π arriba), b=apertura */
  function dirBrazo(a, b, sg) {
    const u = new THREE.Vector3(0, -Math.cos(a), Math.sin(a));
    if (!b) return { u, Q: null };
    const eje = u.clone().cross(new THREE.Vector3(sg, 0, 0)).normalize();
    const Q = rot(eje, b);
    return { u: u.applyQuaternion(Q), Q };
  }
  function brazo(L, a, b, e, r, sube) {
    const { u, Q } = dirBrazo(a, b, L.sg);
    const f = new THREE.Vector3(0, -Math.cos(a + e), Math.sin(a + e));
    if (Q) f.applyQuaternion(Q);
    // la clavícula acompaña cuando el brazo sube sobre el hombro
    const qc = rot(new THREE.Vector3(0, 0, 1), L.sg * sube);
    L.cla.quaternion.copy(qc);
    const qb = tmpQ().setFromUnitVectors(L.rBrazo, u);
    const local = qc.clone().invert().multiply(qb);
    L.brazo.quaternion.copy(local);
    const fl = f.applyQuaternion(qb.clone().invert()).normalize();
    L.ante.quaternion.setFromUnitVectors(L.rAnte, fl).multiply(rot(L.rAnte, r * L.sg));
  }
  /** rodilla por cinemática inversa: cad y tob en el marco del modelo */
  function pierna(L, cad, tob, qPelvis, qPie, valgo) {
    const d = tob.clone().sub(cad);
    const dist = Math.min(L.L1 + L.L2 - 0.001, d.length());
    const dir = d.normalize();
    const x = (L.L1 * L.L1 - L.L2 * L.L2 + dist * dist) / (2 * dist);
    const h = Math.sqrt(Math.max(0, L.L1 * L.L1 - x * x));
    // la rodilla apunta al frente y un poco hacia afuera
    const pol = new THREE.Vector3((0.12 - (valgo || 0) * 0.7) * L.sg, 0, 1).applyQuaternion(qPelvis);
    const per = pol.sub(dir.clone().multiplyScalar(pol.dot(dir))).normalize();
    const rod = cad.clone().add(dir.clone().multiplyScalar(x)).add(per.multiplyScalar(h));
    const dT = rod.clone().sub(cad).normalize(), dP = tob.clone().sub(rod).normalize();
    const qi = qPelvis.clone().invert();
    const q1 = tmpQ().setFromUnitVectors(L.rMuslo, dT.clone().applyQuaternion(qi));
    L.muslo.quaternion.copy(q1);
    const q12 = qPelvis.clone().multiply(q1);
    const q2 = tmpQ().setFromUnitVectors(L.rPierna, dP.clone().applyQuaternion(q12.clone().invert()));
    L.pierna.quaternion.copy(q2);
    L.pie.quaternion.copy(q12.multiply(q2).invert().multiply(qPie));
  }

  /** P: {k, lean, tw, st, fo, pt, aL,aR,bL,bR,eL,eR,rL,rR, hd}; aL/bL/eL/rL = brazo libre y aR/bR/eR/rR = brazo de golpe;
      opcionales: zc adelanta la cadera, ty levanta el tobillo, val lleva las rodillas hacia adentro */
  function posar(fig, P, run, mira) {
    const L = fig.lefty ? fig.R : fig.L, R = fig.lefty ? fig.L : fig.R; // R = brazo de golpe
    const izq = fig.L, der = fig.R, sg = fig.lefty ? -1 : 1;
    const A = run ? run.amp : 0, act = run ? run.act : 0;
    const largo = izq.L1 + izq.L2;
    const k = P.k + (run ? A * (0.45 - P.k) * (1 - act) : 0);
    const bote = run ? 0.02 * A * Math.cos(run.phase * 2) : 0;
    // en el aire las piernas se recogen: la cadera no baja, suben los pies
    const aire = mira && mira.aire ? mira.aire : 0;
    const flex = largo * (1 - Math.cos(k * 0.5));
    const baja = flex * (1 - aire) + bote;
    const lean = P.lean + (run ? A * (0.22 - P.lean) * (1 - act) : 0);
    const h = fig.h;
    const qPel = rot(X(), lean * 0.35);
    h.root.position.set(0, fig.pelvis0.y - baja, fig.pelvis0.z - 0.25 * baja - 0.05 * Math.abs(lean) + (P.zc || 0));
    h.root.quaternion.copy(qPel);
    h.lumbar.quaternion.copy(rot(X(), lean * 0.3)).multiply(rot(Y(), P.tw * sg * 0.4));
    h.pecho.quaternion.copy(rot(X(), lean * 0.35)).multiply(rot(Y(), P.tw * sg * 0.6));
    // piernas
    const piso = izq.tob.y;
    const offs = h.root.position.clone();
    [izq, der].forEach((S, i) => {
      const cad = S.cad.clone().sub(fig.pelvis0).applyQuaternion(qPel).add(offs);
      const delante = (S === izq ? 1 : -1) * sg * P.fo * 0.5;
      const ang = run ? run.phase + i * Math.PI : 0;
      const paso = A * 0.34 * Math.sin(ang), sube = A * 0.2 * Math.max(0, Math.cos(ang));
      const dz = run ? paso * run.dz : 0, dx = run ? paso * run.dx : 0;
      const tob = new THREE.Vector3(S.sg * (0.095 + P.st) + dx, piso + (P.ty || 0) + sube + flex * aire * (S === izq ? 1.3 : 0.9), delante + dz - flex * aire * 0.5);
      const qPie = rot(X(), P.pt + A * 0.45 * Math.max(0, -Math.sin(ang)));
      pierna(S, cad, tob, qPel, qPie, P.val);
    });
    // brazos
    const ar = run ? A * (1 - act) : 0, bal = run ? Math.sin(run.phase) * 0.75 : 0;
    const mez = (x, y, w) => x + (y - x) * w;
    const aL = mez(P.aL, 0.25 + bal * (fig.lefty ? -1 : 1), ar), aR = mez(P.aR, 0.25 - bal * (fig.lefty ? -1 : 1), ar);
    const eL = mez(P.eL, 1.5, ar), eR = mez(P.eR, 1.5, ar);
    const subeH = (a) => Math.max(0, (a - 1.6) / 1.5) * 0.32;
    brazo(L, aL, P.bL, eL, P.rL, subeH(aL));
    brazo(R, aR, P.bR, eR, P.rR, subeH(aR));
    // cabeza: compensa la inclinación y sigue al balón
    const inc = lean; // la columna la inclina
    let pitch = -inc * 0.85 + P.hd, yaw = 0;
    if (mira) { pitch += mira.pitch; yaw = mira.yaw; }
    const cH = rot(X(), pitch * 0.45), cY = rot(Y(), yaw * 0.5);
    h.cuello.quaternion.copy(cY).multiply(cH);
    h.cabeza.quaternion.copy(cY).multiply(cH);
  }

  /** punto del cuerpo que toca el balón: palma de golpe (spike), muñecas (set) o antebrazos (pass) */
  function punto(fig, tipo) {
    fig.root.updateMatrixWorld(true);
    const w = (x) => new THREE.Vector3().setFromMatrixPosition(x.matrixWorld);
    if (tipo === 'spike' || tipo === 'saque') {
      const S = fig.lefty ? fig.L : fig.R, m = w(S.mano);
      return m.add(m.clone().sub(w(S.ante)).normalize().multiplyScalar(0.1 * fig.s));
    }
    const c = w(fig.L.mano).add(w(fig.R.mano)).multiplyScalar(0.5);
    if (tipo !== 'pass') return c;
    const e = w(fig.L.ante).add(w(fig.R.ante)).multiplyScalar(0.5);
    return c.lerp(e, 0.3);
  }

  /** libera materiales y esqueleto de una figura retirada de la escena */
  function soltar(raiz) {
    const hechos = new Set();
    raiz.traverse((o) => {
      if (o.isSkinnedMesh && !hechos.has(o.skeleton)) { hechos.add(o.skeleton); if (o.skeleton.boneTexture) o.skeleton.boneTexture.dispose(); }
      if (o.material) { if (o.isSprite && o.material.map) o.material.map.dispose(); o.material.dispose(); }
    });
  }

  BV.personaje = { cargar, crear, posar, punto, soltar, listo: () => !!datos };
})(window.BV);
