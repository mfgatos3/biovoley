/* BioVoley Lab — Videos 3D que explican cada jugada
   La escena se genera con Three.js a partir del guion de la pizarra (quién recibe, coloca y
   remata), con el equipo real: nombres, números, estatura, salto medido y altura de red.
   Cada video es una línea de tiempo determinista: se puede pausar, adelantar y grabar. */
(function (BV) {
  'use strict';
  const { esc, fmt } = BV;
  // primero la copia incluida en la carpeta vendor/; si no está, la de internet
  const THREE_URLS = ['vendor/three.min.js', 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js', 'https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js'];
  const W = 960, H = 540;
  const VIDEOS = ['z4', 'quick', 'switch']; // renderizados en alta calidad para equipos sin aceleración gráfica
  const KINDS = { z4: 'Attack from zone 4', quick: 'Middle quick attack', switch: 'Rotation and switch', mine: 'Your play in 3D' };
  const KEYS = {
    z4: ['Reception: bent legs and a firm platform.', 'High set: gives time for the attack approach.', 'Spike: long last step, high elbow, contact at the highest point.', 'Land on both feet with bent knees.'],
    quick: ['The middle starts before the ball reaches the setter.', 'Short, fast set: the opposing block cannot close in time.', 'It is agreed with signals before the serve.', 'Controlled landing: the middle returns quickly to block.'],
    switch: ['When you win the serve back, rotate clockwise: zone 2 to 1, zone 1 to 6…', 'At the moment of the serve, keep the rotation order (FIVB rule).', 'After the serve, each player goes to their specialized zone.', 'Short switch: between neighboring zones. Long switch: from one end to the other.'],
    mine: ['Check that each touch reaches the next player.', 'Make sure nobody crosses the path of the ball.', 'End the play with the whole team covering the attack.'],
  };
  const TIPS = {
    serve: 'Serve: leg opposite the arm forward and an accurate toss.',
    pass: 'Forearm pass: bent legs, straight arms together.',
    set: 'Set: cupped hands above the forehead; extend arms and legs together.',
    spike: 'Spike: high elbow, straight arm, contact at the highest point.',
    land: 'Soft two-foot landing: bent knees stop you with less force.',
    move: 'After the serve, each player goes to their specialized zone.',
  };
  // figuras simples del modo compatible
  const POSES_SIMPLES = {
    idle: { k: 0.2, lean: 0.08, aL: 0.25, aR: 0.25 },
    ready: { k: 0.85, lean: 0.4, aL: 0.8, aR: 0.8 },
    pass: { k: 0.55, lean: 0.3, aL: 1.05, aR: 1.05 },
    set: { k: 0.45, lean: 0.02, aL: 2.75, aR: 2.75 },
    run: { k: 0.5, lean: 0.25, aL: -0.6, aR: -0.6 },
    spike: { k: 0.6, lean: -0.15, aL: 2.6, aR: 3.05 },
    spikeHit: { k: 0.5, lean: 0.25, aL: 1.8, aR: 1.5 },
    block: { k: 0.25, lean: 0, aL: 3.05, aR: 3.05 },
    land: { k: 1.15, lean: 0.4, aL: 0.9, aR: 0.9 },
    serve: { k: 0.2, lean: -0.05, aL: 2.7, aR: 3.0 },
    toss: { k: 0.15, lean: 0, aL: 2.9, aR: 2.4 },
  };
  // personas: k rodillas, lean tronco, tw giro de hombros, st apertura de pies, fo pie adelantado, pt punta del pie,
  // a flexión del hombro, b apertura, e codo, r giro del antebrazo (L brazo libre, R brazo de golpe), hd cabeza
  const cuerpo = (o) => Object.assign({ k: 0, lean: 0, tw: 0, st: 0, fo: 0, pt: 0, aL: 0, aR: 0, bL: 0, bR: 0, eL: 0, eR: 0, rL: 0, rR: 0, hd: 0 }, o);
  const POSES_REALES = {
    idle: cuerpo({ k: 0.15, lean: 0.04, aL: 0.1, aR: 0.1, bL: 0.16, bR: 0.16, eL: 0.3, eR: 0.3, st: 0.03 }),
    ready: cuerpo({ k: 0.8, lean: 0.42, aL: 0.75, aR: 0.75, bL: 0.1, bR: 0.1, eL: 1.05, eR: 1.05, st: 0.09 }),
    pass: cuerpo({ k: 0.85, lean: 0.42, aL: 1.12, aR: 1.12, bL: -0.2, bR: -0.2, eL: 0.03, eR: 0.03, st: 0.1, rL: 0.9, rR: 0.9, hd: 0.1 }),
    set: cuerpo({ k: 0.5, lean: 0.02, aL: 2.2, aR: 2.2, bL: 0.34, bR: 0.34, eL: 0.85, eR: 0.85, st: 0.05, fo: 0.2, hd: -0.4 }),
    run: cuerpo({ k: 0.45, lean: 0.22, aL: 0.25, aR: 0.25, bL: 0.1, bR: 0.1, eL: 1.5, eR: 1.5 }),
    spike: cuerpo({ k: 0.75, lean: -0.2, tw: -0.65, aL: 2.55, aR: 2.6, bL: 0.1, bR: 0.45, eL: 0.25, eR: 1.95, hd: -0.35, pt: 0.5 }),
    spikeHit: cuerpo({ k: 0.5, lean: 0.12, tw: 0.3, aL: 0.9, aR: 2.98, bL: 0.2, bR: 0.02, eL: 1.6, eR: 0.04, hd: -0.3, pt: 0.5 }),
    block: cuerpo({ k: 0.22, lean: 0.06, aL: 3.0, aR: 3.0, bL: 0.04, bR: 0.04, eL: 0.04, eR: 0.04, hd: -0.1, pt: 0.4 }),
    land: cuerpo({ k: 1.25, lean: 0.5, aL: 0.6, aR: 0.6, bL: 0.3, bR: 0.3, eL: 0.7, eR: 0.7, st: 0.09 }),
    serve: cuerpo({ k: 0.2, lean: -0.08, tw: -0.55, aL: 2.7, aR: 2.45, bL: 0.05, bR: 0.55, eL: 0.1, eR: 1.75, fo: 0.3, hd: -0.3 }),
    toss: cuerpo({ k: 0.15, lean: 0, tw: -0.3, aL: 2.5, aR: 0.9, bL: 0.08, bR: 0.3, eL: 0.1, eR: 1.1, fo: 0.3, hd: -0.5 }),
    saqueGolpe: cuerpo({ k: 0.12, lean: 0.12, tw: 0.3, aL: 0.5, aR: 2.75, bL: 0.2, bR: 0.1, eL: 1.3, eR: 0.08, fo: 0.3, hd: -0.3 }),
    passPre: cuerpo({ k: 1.05, lean: 0.5, aL: 0.95, aR: 0.95, bL: -0.18, bR: -0.18, eL: 0.05, eR: 0.05, st: 0.12, rL: 0.9, rR: 0.9, hd: 0.15 }),
    passFin: cuerpo({ k: 0.35, lean: 0.25, aL: 1.45, aR: 1.45, bL: -0.2, bR: -0.2, eL: 0.03, eR: 0.03, st: 0.1, rL: 0.9, rR: 0.9, hd: -0.05 }),
    setPre: cuerpo({ k: 0.75, lean: 0.05, aL: 2.05, aR: 2.05, bL: 0.36, bR: 0.36, eL: 1.25, eR: 1.25, st: 0.06, fo: 0.2, hd: -0.45 }),
    setFin: cuerpo({ k: 0.15, lean: -0.02, aL: 2.75, aR: 2.75, bL: 0.2, bR: 0.2, eL: 0.25, eR: 0.25, st: 0.05, fo: 0.2, hd: -0.5 }),
    remateSeguir: cuerpo({ k: 0.6, lean: 0.55, tw: 0.6, aL: 0.5, aR: 0.9, bL: 0.25, bR: -0.35, eL: 1.2, eR: 0.35, hd: -0.05, pt: 0.4 }),
    bloqueo2: cuerpo({ k: 0.2, lean: 0.22, aL: 2.6, aR: 2.6, bL: 0.02, bR: 0.02, eL: 0.03, eR: 0.03, hd: -0.05, pt: 0.4 }),
    dig: cuerpo({ k: 1.3, lean: 0.62, aL: 1.0, aR: 1.0, bL: -0.2, bR: -0.2, eL: 0.03, eR: 0.03, st: 0.2, rL: 0.9, rR: 0.9, hd: 0.2 }),
    impulso: cuerpo({ k: 1.25, lean: 0.6, aL: -0.75, aR: -0.75, bL: 0.08, bR: 0.08, eL: 0.2, eR: 0.2, st: 0.05 }),
  };
  let POSES = POSES_SIMPLES;
  const ROLE_HEX = { S: 0x6250d6, OH: 0x2a78d6, OPP: 0xeb6834, MB: 0x1baf7a, L: 0xe87ba4 };
  const UNIFORME = '#1c4fd0', UNIFORME_LIBERO = '#f4c01b', UNIFORME_RIVAL = '#e6e9ee';
  const PIELES = ['claro', 'medio', 'medio', 'oscuro', 'claro', 'medio', 'oscuro'];
  const PELOS = ['#7a5a46', '#4a3428', '#2c211b', '#9a7a5c', '#3a2a20'];
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const smooth = (t) => t * t * (3 - 2 * t);
  const clamp01 = (x) => Math.max(0, Math.min(1, x));
  const lerp = (a, b, u) => a + (b - a) * u;

  let THREE = null, loading = null, M = null;

  function loadThree() {
    if (window.THREE) return Promise.resolve(window.THREE);
    if (loading) return loading;
    const tryLoad = (i) => new Promise((res, rej) => {
      if (i >= THREE_URLS.length) { rej(new Error('Could not load Three.js')); return; }
      const s = document.createElement('script');
      s.src = THREE_URLS[i];
      s.onload = () => (window.THREE ? res(window.THREE) : tryLoad(i + 1).then(res, rej));
      s.onerror = () => { s.remove(); tryLoad(i + 1).then(res, rej); };
      document.head.appendChild(s);
    });
    loading = tryLoad(0).catch((e) => { loading = null; throw e; });
    return loading;
  }

  /* ================= ventana del reproductor ================= */
  function open(opts) {
    if (!M) buildModal();
    M.opts = opts;
    M.root.hidden = false;
    document.body.style.overflow = 'hidden';
    M.root.querySelector('.vclose').focus();
    loadThree().catch(() => null).then(async (T) => {
      if (!T) {
        M.playing = false; syncUi();
        M.status.hidden = false;
        M.status.textContent = 'Could not load the 3D engine: the vendor/ folder is missing and there is no internet.';
        return;
      }
      THREE = T;
      if (!M.scene) setupScene();
      M.real = !M.soft && await BV.personaje.cargar();
      POSES = M.real ? POSES_REALES : POSES_SIMPLES;
      M.status.hidden = true;
      load(opts.kind);
    }).catch((e) => {
      console.error(e);
      M.playing = false; syncUi();
      M.status.hidden = false;
      M.status.textContent = 'Could not prepare the animation in this browser.';
    });
  }

  function close() {
    if (!M) return;
    if (M.rec) stopRecording(true);
    if (M.vid) M.vid.pause();
    M.playing = false;
    cancelAnimationFrame(M.raf); M.raf = 0;
    M.root.hidden = true;
    document.body.style.overflow = '';
  }

  function buildModal() {
    const root = document.createElement('div');
    root.className = 'vmodal';
    root.hidden = true;
    root.innerHTML = `
      <div class="vbox" role="dialog" aria-modal="true" aria-labelledby="vTitle3d">
        <div class="row between"><h3 id="vTitle3d">3D video of the play</h3><button class="btn btn-sm vclose" type="button">Close</button></div>
        <div class="seg vtabs" role="group" aria-label="Videos">${Object.entries(KINDS).map(([k, v]) => `<button type="button" data-k="${k}" aria-pressed="false">${v}</button>`).join('')}</div>
        <div class="vstage"><canvas class="vout" width="${W}" height="${H}" aria-label="3D animation of the play"></canvas><video class="vout vpre" playsinline muted preload="auto" hidden aria-label="3D video of the play"></video><div class="vstatus">Loading the 3D engine…</div></div>
        <div class="vcap" aria-live="polite"></div>
        <div class="vctrl">
          <button class="btn btn-sm btn-primary vplay" type="button">Pause</button>
          <button class="btn btn-sm vre" type="button">Replay</button>
          <input type="range" class="vseek" min="0" max="1" step="0.001" value="0" aria-label="Video position">
          <span class="note num vtime">0.0 s</span>
          <select class="inp vspeed" style="width:auto" aria-label="Speed"><option value="0.5">×0.5</option><option value="1" selected>×1</option></select>
          <button class="btn btn-sm btn-ball vrec" type="button">Save as video</button>
        </div>
        <p class="note vnote">Animation with your team's data.</p>
      </div>`;
    document.body.appendChild(root);
    M = { root, out: root.querySelector('.vout'), status: root.querySelector('.vstatus'), capEl: root.querySelector('.vcap'), capTxt: '', t: 0, total: 1, playing: false, speed: 1, raf: 0 };
    M.ctx = M.out.getContext('2d');
    M.vid = root.querySelector('.vpre');
    M.vid.addEventListener('timeupdate', () => { if (videoActivo()) { M.t = M.vid.currentTime; syncUi(); } });
    M.vid.addEventListener('play', () => { if (videoActivo()) { M.playing = true; syncUi(); } });
    M.vid.addEventListener('pause', () => { if (videoActivo()) { M.playing = false; syncUi(); } });
    M.vid.addEventListener('loadedmetadata', () => { M.total = M.vid.duration || 1; syncUi(); });
    M.vid.addEventListener('error', () => { if (videoActivo()) { console.warn('Video unavailable'); dibujoSimple(M.kind); } });
    root.querySelector('.vclose').addEventListener('click', close);
    root.addEventListener('click', (e) => { if (e.target === root) close(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !root.hidden) close(); });
    root.querySelectorAll('[data-k]').forEach((b) => b.addEventListener('click', () => { if (!M.rec) load(b.dataset.k); }));
    const play = root.querySelector('.vplay');
    play.addEventListener('click', () => {
      if (videoActivo()) { if (M.vid.paused) M.vid.play(); else M.vid.pause(); return; }
      if (M.t >= M.total) M.t = 0; M.playing = !M.playing; syncUi(); loop();
    });
    root.querySelector('.vre').addEventListener('click', () => {
      if (videoActivo()) { M.vid.currentTime = 0; M.vid.play(); return; }
      M.t = 0; M.playing = true; syncUi(); loop();
    });
    root.querySelector('.vseek').addEventListener('input', (e) => {
      if (videoActivo()) { M.vid.pause(); M.vid.currentTime = +e.target.value * M.total; return; }
      M.playing = false; M.t = +e.target.value * M.total; draw(); syncUi();
    });
    root.querySelector('.vspeed').addEventListener('change', (e) => { M.speed = +e.target.value; M.vid.playbackRate = M.speed; });
    root.querySelector('.vrec').addEventListener('click', () => {
      if (videoActivo()) { guardarVideo(); return; }
      if (M.rec) stopRecording(true); else startRecording();
    });
  }

  function syncUi() {
    const r = M.root;
    r.querySelector('.vplay').textContent = M.playing ? 'Pause' : 'Play';
    r.querySelector('.vseek').value = M.total ? M.t / M.total : 0;
    r.querySelector('.vtime').textContent = `${fmt(M.t, 1)} / ${fmt(M.total, 1)} s`;
  }

  /* ================= escena fija: gimnasio, cancha, red ================= */
  /** WebGL por software (sin tarjeta gráfica real): funciona, pero demasiado lento para animar */
  function graficaLenta(renderer) {
    try {
      const gl = renderer.getContext(), ext = gl.getExtension('WEBGL_debug_renderer_info');
      return !!ext && /swiftshader|llvmpipe|software/i.test(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL));
    } catch (e) { return false; }
  }
  function webglOk() {
    try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; }
  }
  function setupScene() {
    let renderer = null;
    if (webglOk()) {
      try { renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, alpha: !!BV.RENDER_ALFA }); } catch (e) { renderer = null; }
    }
    M.soft = !renderer; // sin aceleración gráfica: se dibuja por software en el lienzo 2D
    M.lento = !!renderer && graficaLenta(renderer);
    const scene = new THREE.Scene();
    const cam = new THREE.PerspectiveCamera(42, W / H, 0.1, 200);
    if (renderer) cam.setViewOffset(W, H, 0, H * 0.08, W, H); // deja a la gente por encima de los subtítulos
    const figs = new THREE.Group(); scene.add(figs);
    M.renderer = renderer; M.scene = scene; M.cam = cam; M.figs = figs;
    if (renderer) {
      M.S = M.opts.escala || 4 / 3; // la imagen se calcula a 1280×720
      M.out.width = W * M.S; M.out.height = H * M.S;
      M.ctx.setTransform(M.S, 0, 0, M.S, 0, 0);
      renderer.setPixelRatio(1);
      renderer.setSize(W * M.S, H * M.S, false);
      renderer.outputEncoding = THREE.sRGBEncoding;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.02;
      renderer.physicallyCorrectLights = false;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      gimnasio(scene, renderer);
    }
    if (!renderer) {
      M.ball = new THREE.Object3D(); scene.add(M.ball);
      const v = () => new THREE.Object3D();
      M.netParts = { net: v(), band: v(), posts: [v(), v()], ants: [v(), v()], netG: v() };
    }
    marcasPiso(scene);
  }

  const srgb = (c) => new THREE.Color(c).convertSRGBToLinear();
  function texLienzo(c, rep) {
    const t = new THREE.CanvasTexture(c);
    t.encoding = THREE.sRGBEncoding; t.anisotropy = 8;
    if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); }
    return t;
  }
  function lienzo(w, h, pinta) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    pinta(c.getContext('2d'), w, h);
    return c;
  }
  function ruido(g, w, h, n, tam, alfa) {
    for (let i = 0; i < n; i++) {
      g.fillStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '0,0,0'},${Math.random() * alfa})`;
      g.fillRect(Math.random() * w, Math.random() * h, tam, tam);
    }
  }

  /** gimnasio cubierto: piso sintético, muros, gradas, techo con luminarias, red reglamentaria y balón */
  function gimnasio(scene, renderer) {
    scene.background = new THREE.Color(srgb('#20262f'));
    scene.fog = new THREE.Fog(srgb('#20262f'), 44, 120);
    const std = (o) => new THREE.MeshStandardMaterial(Object.assign({ roughness: 0.7 }, o));
    const caja = (w, h, d, m, x, y, z) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); scene.add(b); return b; };

    // reflejos suaves: una sala pequeña con paneles de luz para el mapa de entorno
    const sala = new THREE.Scene();
    sala.background = new THREE.Color(srgb('#1a1e24'));
    const panel = new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 3.2, 3) });
    [[-12, -6], [-12, 6], [0, -6], [0, 6], [12, -6], [12, 6]].forEach(([x, z]) => { const l = new THREE.Mesh(new THREE.PlaneGeometry(6, 2.4), panel); l.rotation.x = Math.PI / 2; l.position.set(x, 11, z); sala.add(l); });
    const suelo = new THREE.Mesh(new THREE.PlaneGeometry(60, 40), new THREE.MeshBasicMaterial({ color: srgb('#b86a35') })); suelo.rotation.x = -Math.PI / 2; sala.add(suelo);
    const pm = new THREE.PMREMGenerator(renderer);
    const entorno = pm.fromScene(sala, 0.02).texture;
    scene.environment = entorno; pm.dispose();

    // luces: varias luminarias altas, una sola proyecta sombra suave
    scene.add(new THREE.HemisphereLight(srgb('#fff4e6'), srgb('#8a5a38'), 0.5));
    const sol = new THREE.DirectionalLight(srgb('#fff8ee'), 1.5);
    sol.position.set(-5, 20, 7); sol.castShadow = true;
    sol.shadow.mapSize.set(3072, 3072); sol.shadow.bias = -0.0004; sol.shadow.normalBias = 0.02; sol.shadow.radius = 5;
    Object.assign(sol.shadow.camera, { left: -15, right: 15, top: 13, bottom: -13, near: 2, far: 42 });
    scene.add(sol); M.sol = sol;
    const relleno = new THREE.DirectionalLight(srgb('#dfe8ff'), 0.32); relleno.position.set(8, 9, -9); scene.add(relleno);

    // piso sintético: zona libre azul y cancha naranja con textura de superficie
    const sup = (col, a) => lienzo(1024, 1024, (g, w, h) => { g.fillStyle = col; g.fillRect(0, 0, w, h); ruido(g, w, h, 42000, 2, a); });
    const piso = new THREE.Mesh(new THREE.PlaneGeometry(90, 60), std({ map: texLienzo(sup('#1f4f80', 0.05), [18, 12]), roughness: 0.46, envMapIntensity: 0.45 }));
    piso.rotation.x = -Math.PI / 2; piso.receiveShadow = true; scene.add(piso);
    const lc = 2048, esc = lc / 21; // cancha y borde en una sola textura para líneas nítidas
    const cancha = lienzo(lc, lc * 12 / 21, (g, w, h) => {
      const ox = 1.5 * esc, oy = 1.5 * esc;
      g.fillStyle = '#1f4f80'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#c9651f'; g.fillRect(ox, oy, 18 * esc, 9 * esc);
      g.fillStyle = '#bd5a18'; g.fillRect(ox + 6 * esc, oy, 6 * esc, 9 * esc);
      ruido(g, w, h, 90000, 2, 0.045);
      g.strokeStyle = '#f6f6f2'; g.lineWidth = 0.05 * esc;
      g.strokeRect(ox, oy, 18 * esc, 9 * esc);
      [6, 12].forEach((x) => { g.beginPath(); g.moveTo(ox + x * esc, oy); g.lineTo(ox + x * esc, oy + 9 * esc); g.stroke(); });
      g.beginPath(); g.moveTo(ox + 9 * esc, oy); g.lineTo(ox + 9 * esc, oy + 9 * esc); g.stroke();
      g.save(); g.translate(w / 2, h / 2); g.font = `800 ${0.9 * esc}px "Barlow Condensed", Arial`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.globalAlpha = 0.1; g.fillStyle = '#fff'; g.rotate(-Math.PI / 2); g.fillText('', 0, 0); g.restore();
    });
    const courtM = std({ map: texLienzo(cancha), roughness: 0.44, envMapIntensity: 0.45 });
    const court = new THREE.Mesh(new THREE.PlaneGeometry(21, 12), courtM);
    court.rotation.x = -Math.PI / 2; court.position.y = 0.003; court.receiveShadow = true; scene.add(court);

    // muros con franja acolchada y letreros
    const muro = lienzo(2048, 512, (g, w, h) => {
      g.fillStyle = '#8b939c'; g.fillRect(0, 0, w, h);
      for (let y = 0; y < h * 0.68; y += 24) { g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(0, y, w, 2); } // bloques del muro
      for (let x = 0; x < w; x += 341) { g.fillStyle = '#747c86'; g.fillRect(x, 0, 46, h * 0.68); g.fillStyle = 'rgba(255,255,255,.14)'; g.fillRect(x, 0, 6, h * 0.68); } // columnas
      for (let x = 60; x < w; x += 341) { g.fillStyle = '#dfeafa'; g.fillRect(x + 20, 26, 240, 74); g.fillStyle = 'rgba(40,50,60,.8)'; for (let k = 0; k <= 4; k++) g.fillRect(x + 20 + k * 60 - 2, 26, 4, 74); g.fillRect(x + 20, 62, 240, 3); } // ventanas altas
      ruido(g, w, h, 16000, 2, 0.03);
      g.fillStyle = '#14406f'; g.fillRect(0, h * 0.68, w, h * 0.32);
      for (let x = 0; x < w; x += 200) { g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(x, h * 0.68, 3, h * 0.32); }
      g.fillStyle = '#f4c01b'; g.fillRect(0, h * 0.665, w, 8);
      g.fillStyle = '#eef3fa'; g.font = '800 62px "Barlow Condensed", Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
      ['BIOVOLEY LAB', 'HYDRATION', 'TECHNIQUE', 'TACTICS'].forEach((t, i) => g.fillText(t, w * (i + 0.5) / 4, h * 0.84));
    });
    const mMuro = std({ map: texLienzo(muro), roughness: 0.9, envMapIntensity: 0.3 });
    const pared = (w, x, z, ry) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, 12), mMuro); m.position.set(x, 6, z); m.rotation.y = ry; scene.add(m); };
    pared(52, 0, -17, 0); pared(52, 0, 17, Math.PI); pared(34, -26, 0, Math.PI / 2); pared(34, 26, 0, -Math.PI / 2);

    // techo con luminarias y cerchas
    const techo = new THREE.Mesh(new THREE.PlaneGeometry(52, 34), std({ color: srgb('#3a4047'), roughness: 0.9 }));
    techo.rotation.x = Math.PI / 2; techo.position.y = 12; scene.add(techo);
    const mL = new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 5, 4.6) });
    [-16, -8, 0, 8, 16].forEach((x) => [-7, 0, 7].forEach((z) => { const l = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1), mL); l.rotation.x = Math.PI / 2; l.position.set(x, 11.6, z); scene.add(l); }));
    const mCer = std({ color: srgb('#4b525b'), metalness: 0.5, roughness: 0.5 });
    [-20, -12, -4, 4, 12, 20].forEach((x) => caja(0.3, 0.5, 34, mCer, x, 11.4, 0));

    // gradas a un costado, con asientos
    const mGr = std({ color: srgb('#59616c'), roughness: 0.8 });
    const asiento = new THREE.BoxGeometry(0.42, 0.1, 0.4);
    const mAs = std({ roughness: 0.6 });
    const filas = 7, porFila = 56;
    const as = new THREE.InstancedMesh(asiento, mAs, filas * porFila);
    const mt = new THREE.Matrix4(), cs = [srgb('#1c4fd0'), srgb('#f4c01b'), srgb('#20407a')];
    for (let f = 0; f < filas; f++) {
      const z = -11.2 - f * 0.8, y = 0.45 + f * 0.42;
      caja(30, y, 0.8, mGr, 0, y / 2, z);
      for (let i = 0; i < porFila; i++) {
        mt.makeTranslation(-14.7 + i * 0.535, y + 0.06, z + 0.08);
        as.setMatrixAt(f * porFila + i, mt);
        as.setColorAt(f * porFila + i, cs[(f + (i >> 3)) % 3 === 2 ? 2 : 0]);
      }
    }
    scene.add(as);
    // público en las gradas: las mismas personas renderizadas, de pie y con camisetas de varios colores
    const carga = new THREE.TextureLoader();
    ['F', 'M'].forEach((sexo, n) => {
      const el = document.getElementById(`emb-at-aterrizaje_${sexo}_frontal_webp`);
      carga.load(el ? el.textContent.trim() : `vendor/personaje/aterrizaje_${sexo}_frontal.webp`, (tex) => {
        tex.encoding = THREE.sRGBEncoding;
        tex.repeat.set(320 / 2560, 480 / 3360); tex.offset.set((3 * 320) / 2560, 1 - (6 * 480) / 3360); // cuadro de pie
        const tintes = ['#ffffff', '#ffd27a', '#c9d6ff', '#ffb3a6', '#d9ffd0'].map((c) => new THREE.SpriteMaterial({ map: tex, color: srgb(c), alphaTest: 0.5 }));
        for (let f = 0; f < filas; f++) {
          for (let i = n; i < porFila; i += 2) {
            const h = Math.sin(f * 91.7 + i * 12.3) * 43758.5, r = h - Math.floor(h);
            if (r > 0.62) continue;
            const sp = new THREE.Sprite(tintes[Math.floor(r * 50) % tintes.length]);
            const e = 0.88 + ((r * 7) % 1) * 0.16;
            sp.scale.set(1.6 * e, 2.4 * e, 1);
            sp.position.set(-14.7 + i * 0.535, 0.56 + f * 0.42 + e, -11.12 - f * 0.8);
            scene.add(sp);
          }
        }
      });
    });

    // banco del equipo con botellas de agua (la hidratación es parte del juego)
    const mBan = std({ color: srgb('#2b3442'), roughness: 0.6 });
    caja(4.2, 0.08, 0.5, mBan, -5, 0.45, 7.4); [-2.9, -7.1].forEach((x) => caja(0.1, 0.45, 0.45, mBan, x, 0.22, 7.4));
    const mBot = std({ color: srgb('#38a7e8'), roughness: 0.25 });
    [-6.2, -5.8, -5.4, -4.6, -4.2].forEach((x) => { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.038, 0.2, 12), mBot); b.position.set(x, 0.59, 7.42); b.castShadow = true; scene.add(b); });

    // silla del árbitro junto a un poste
    const mSil = std({ color: srgb('#a2abb6'), metalness: 0.5, roughness: 0.45 });
    caja(0.7, 0.05, 0.7, mSil, 0, 1.55, 6.1).castShadow = true;
    [[-0.3, -0.3], [0.3, -0.3], [-0.3, 0.3], [0.3, 0.3]].forEach(([x, z]) => caja(0.05, 1.55, 0.05, mSil, x, 0.78, 6.1 + z).castShadow = true);

    // red reglamentaria
    const netG = new THREE.Group(); scene.add(netG);
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d'); g.strokeStyle = '#0b0d10'; g.lineWidth = 4; g.strokeRect(0, 0, 64, 64);
    const tex = new THREE.CanvasTexture(c); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(95, 10); tex.anisotropy = 8;
    const net = new THREE.Mesh(new THREE.PlaneGeometry(9.5, 1), new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide, depthWrite: false, alphaTest: 0.02 }));
    net.rotation.y = Math.PI / 2; netG.add(net);
    const bandM = std({ color: srgb('#f4f5f6'), roughness: 0.6 });
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.07, 9.5), bandM); band.castShadow = true; netG.add(band);
    const bandB = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.05, 9.5), bandM); netG.add(bandB);
    const lat = [-4.5, 4.5].map((z) => { const l = new THREE.Mesh(new THREE.BoxGeometry(0.02, 1, 0.05), bandM); l.position.z = z; netG.add(l); return l; });
    const postM = std({ color: srgb('#c9ced6'), metalness: 0.6, roughness: 0.4 });
    const pad = std({ color: srgb('#14406f'), roughness: 0.75 });
    const posts = [-5.25, 5.25].map((z) => { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1, 16), postM); p.position.z = z; p.castShadow = true; scene.add(p); const q = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.9, 18), pad); q.position.set(0, 0.95, z); q.castShadow = true; scene.add(q); return p; });
    const rayas = lienzo(8, 64, (gg, w, h) => { for (let i = 0; i < 8; i++) { gg.fillStyle = i % 2 ? '#f5f5f5' : '#e0352b'; gg.fillRect(0, i * h / 8, w, h / 8); } });
    const antM = std({ map: texLienzo(rayas), roughness: 0.5 });
    const ants = [-4.5, 4.5].map((z) => { const a = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 1.8, 8), antM); a.position.z = z; scene.add(a); return a; });

    // balón: 18 paneles en tres colores, con costuras
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.105, 40, 28), std({ map: texLienzo(balonTextura()), roughness: 0.42 }));
    ball.castShadow = true; scene.add(ball);
    M.ball = ball;
    M.netParts = { netG, net, band, bandB, lat, posts, ants };
  }

  function balonTextura() {
    const w = 1024, h = 512, c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d'), im = g.createImageData(w, h);
    const azul = [28, 79, 208], ama = [244, 192, 27], bla = [244, 244, 240];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const lon = (x / w) * 2 * Math.PI, lat = (y / h) * Math.PI;
      const v = [Math.sin(lat) * Math.cos(lon), Math.cos(lat), Math.sin(lat) * Math.sin(lon)];
      const ab = v.map(Math.abs), ej = ab[0] > ab[1] ? (ab[0] > ab[2] ? 0 : 2) : (ab[1] > ab[2] ? 1 : 2);
      const u = v[(ej + 1) % 3] / ab[ej], w2 = v[(ej + 2) % 3] / ab[ej];
      const fr = Math.floor(((u + 1) / 2) * 3 * 0.9999);
      const col = fr === 1 ? bla : ej === 0 ? azul : ej === 1 ? ama : (v[ej] > 0 ? azul : ama);
      const dBorde = Math.min(Math.abs(u + 1), Math.abs(u - 1), Math.abs(w2 + 1), Math.abs(w2 - 1), Math.abs(u - 1 / 3), Math.abs(u + 1 / 3));
      const os = dBorde < 0.018 ? 0.45 : dBorde < 0.05 ? 0.85 + 0.15 * (dBorde / 0.05) : 1;
      const i = (y * w + x) * 4;
      im.data[i] = col[0] * os; im.data[i + 1] = col[1] * os; im.data[i + 2] = col[2] * os; im.data[i + 3] = 255;
    }
    g.putImageData(im, 0, 0);
    return c;
  }

  /** capa de dibujo sobre nuestra media cancha: números de zona, flechas y etiquetas */
  function marcasPiso(scene) {
    const mc = document.createElement('canvas'); mc.width = mc.height = 1024;
    const mtex = new THREE.CanvasTexture(mc); mtex.encoding = THREE.sRGBEncoding;
    const mplane = new THREE.Mesh(new THREE.PlaneGeometry(9, 9), new THREE.MeshBasicMaterial({ map: mtex, transparent: true, depthWrite: false, toneMapped: false }));
    mplane.rotation.x = -Math.PI / 2; mplane.position.set(-4.5, 0.012, 0); mplane.renderOrder = 1; mplane.visible = false; scene.add(mplane);
    M.markCanvas = mc; M.markTex = mtex; M.markPlane = mplane;
  }

  function setNetHeight(h) {
    const { netG, net, band, bandB, lat, posts, ants } = M.netParts;
    net.position.set(0, h - 0.5, 0); band.position.set(0, h - 0.035, 0);
    if (bandB) { bandB.position.set(0, h - 0.975, 0); lat.forEach((l) => { l.position.y = h - 0.5; }); }
    posts.forEach((p) => { p.scale.y = h + 0.1; p.position.y = (h + 0.1) / 2; });
    ants.forEach((a) => { a.position.y = h + 0.3; });
    netG.position.set(0, 0, 0);
  }

  /* ================= figuras ================= */
  function labelSprite(text, color = '#ffffff', bgc = 'rgba(8,14,26,.82)') {
    const c = document.createElement('canvas'); c.width = 320; c.height = 72;
    const g = c.getContext('2d');
    g.font = '700 38px "Barlow Condensed", Arial, sans-serif';
    const w = Math.min(310, g.measureText(text).width + 28);
    g.fillStyle = bgc; roundRect(g, (320 - w) / 2, 8, w, 56, 12); g.fill();
    g.fillStyle = color; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 160, 37);
    const mapa = new THREE.CanvasTexture(c); mapa.encoding = THREE.sRGBEncoding;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: mapa, depthTest: false, transparent: true, toneMapped: false }));
    sp.scale.set(1.25, 0.28, 1); sp.renderOrder = 10;
    return sp;
  }
  function roundRect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }

  function makeFigure({ color, height = 1.72, label, lefty = false, rival = false }) {
    const s = height / 1.75;
    const m = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7 });
    const skin = m(0xc58b65), shirt = m(color), shorts = m(rival ? 0x2d3440 : 0x14213a), shoe = m(0xf2f2f2);
    const root = new THREE.Group();
    const hips = new THREE.Group(); root.add(hips);
    const cyl = (r1, r2, h, mt) => { const g = new THREE.CylinderGeometry(r1, r2, h, 12); g.translate(0, -h / 2, 0); const me = new THREE.Mesh(g, mt); me.castShadow = true; return me; };
    const legs = [-1, 1].map((side) => {
      const thigh = new THREE.Group(); thigh.position.set(0, 0, side * 0.1 * s); hips.add(thigh);
      thigh.add(cyl(0.075 * s, 0.065 * s, 0.45 * s, skin));
      const knee = new THREE.Group(); knee.position.y = -0.45 * s; thigh.add(knee);
      knee.add(cyl(0.06 * s, 0.05 * s, 0.45 * s, skin));
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.24 * s, 0.07 * s, 0.1 * s), shoe); foot.position.set(0.06 * s, -0.47 * s, 0); foot.castShadow = true; knee.add(foot);
      return { thigh, knee };
    });
    const short = new THREE.Mesh(new THREE.CylinderGeometry(0.17 * s, 0.16 * s, 0.2 * s, 14), shorts); short.position.y = 0.02 * s; short.castShadow = true; hips.add(short);
    const torso = new THREE.Group(); torso.position.y = 0.08 * s; hips.add(torso);
    const chest = new THREE.Mesh(new THREE.CylinderGeometry(0.2 * s, 0.16 * s, 0.56 * s, 14), shirt); chest.position.y = 0.28 * s; chest.castShadow = true; torso.add(chest);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.115 * s, 16, 12), skin); head.position.y = 0.7 * s; head.castShadow = true; torso.add(head);
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.12 * s, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), m(0x2a1d14)); hair.position.y = 0.72 * s; torso.add(hair);
    const arms = [-1, 1].map((side) => {
      const sh = new THREE.Group(); sh.position.set(0, 0.52 * s, side * 0.24 * s); torso.add(sh);
      sh.add(cyl(0.05 * s, 0.045 * s, 0.62 * s, side === 1 ? shirt : skin));
      return sh;
    });
    // en local, la figura mira hacia +X; la derecha es +Z
    const hex = (c) => '#' + new THREE.Color(c).getHexString();
    const fig = { root, hips, torso, legs, armL: arms[0], armR: arms[1], s, lefty, labelText: label || '', css: { shirt: hex(color), skin: '#c58b65', shorts: rival ? '#2d3440' : '#14213a', shoe: '#f2f2f2', hair: '#2a1d14' } };
    if (label) { const sp = labelSprite(label, '#fff'); sp.position.y = 2.15 * s; root.add(sp); fig.label = sp; }
    return fig;
  }

  const hashId = (x) => String(x).split('').reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  let sombraTex = null;
  /** persona con malla real; en local mira hacia +X como la figura simple */
  function persona({ pid, sexo, height = 1.72, label, lefty = false, rival = false, num = '', libero = false, chip }) {
    const h = hashId(pid);
    const fig = BV.personaje.crear({
      sexo, altura: height, zurda: lefty, numero: num, numeroOscuro: rival || libero,
      camiseta: rival ? UNIFORME_RIVAL : libero ? UNIFORME_LIBERO : UNIFORME,
      short: rival ? '#2c323c' : '#0f1626', piel: PIELES[h % PIELES.length], pelo: PELOS[(h >> 4) % PELOS.length],
    });
    fig.labelText = label || ''; fig.base = rival ? Math.PI : 0;
    if (label) { const sp = labelSprite(label, '#fff', chip || 'rgba(8,14,26,.82)'); sp.position.y = height + 0.42; fig.root.add(sp); fig.label = sp; }
    if (!sombraTex) {
      sombraTex = new THREE.CanvasTexture(lienzo(128, 128, (g) => { const r = g.createRadialGradient(64, 64, 6, 64, 64, 64); r.addColorStop(0, 'rgba(0,0,0,.34)'); r.addColorStop(0.5, 'rgba(0,0,0,.15)'); r.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = r; g.fillRect(0, 0, 128, 128); }));
    }
    const som = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.95), new THREE.MeshBasicMaterial({ map: sombraTex, transparent: true, depthWrite: false, toneMapped: false }));
    som.rotation.x = -Math.PI / 2; som.renderOrder = 2; fig.root.add(som); fig.sombra = som;
    return fig;
  }
  /** figura real si se puede; la simple en modo compatible */
  function figura(o) {
    return M.real ? persona(o) : makeFigure({ color: o.color, height: o.height, label: o.label, lefty: o.lefty, rival: o.rival });
  }
  const angulo = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  /** mueve a una persona: orienta el cuerpo, ajusta la zancada a la velocidad y sigue el balón con la cabeza */
  function moverPersona(f, x, y, z, P, t, ball, frente) {
    const dt = t - (f.tPrev == null ? t : f.tPrev);
    if (dt > 0 && dt < 0.2) {
      const vx = (x - f.xPrev) / dt, vz = (z - f.zPrev) / dt;
      f.vx = lerp(f.vx || 0, vx, 0.5); f.vz = lerp(f.vz || 0, vz, 0.5);
    } else if (dt !== 0) { f.vx = 0; f.vz = 0; }
    f.tPrev = t; f.xPrev = x; f.zPrev = z;
    const sp = Math.hypot(f.vx || 0, f.vz || 0);
    const base = frente != null ? frente : f.base;
    // el cuerpo gira hacia donde corre, salvo pasos cortos hacia atrás
    let yaw = base;
    const haciaMov = sp > 0.05 ? angulo(Math.atan2(-f.vz, f.vx) - base) : 0;
    const peso = Math.abs(haciaMov) > 2.5 ? 0 : smooth(clamp01((sp - 0.6) / 1.6));
    yaw = base + haciaMov * peso;
    let mira = null;
    if (ball) {
      const dx = ball.x - x, dz = ball.z - z, plano = Math.hypot(dx, dz);
      const hb = angulo(Math.atan2(-dz, dx) - yaw);
      if (peso < 0.5 && y < 0.05) yaw += BV.clamp(hb, -1, 1) * 0.75 * (1 - peso);
      const resto = angulo(Math.atan2(-dz, dx) - yaw);
      const alto = ball.y - (y + 1.55);
      mira = { yaw: BV.clamp(resto, -1.25, 1.25), pitch: BV.clamp(-Math.atan2(alto, Math.max(0.4, plano)), -0.8, 0.5) };
    }
    if (y > 0) { mira = mira || { yaw: 0, pitch: 0 }; mira.aire = smooth(clamp01(y / 0.12)); }
    f.root.position.set(x, y, z);
    f.root.rotation.y = yaw;
    if (dt > 0 && dt < 0.2) f.fase = (f.fase || 0) + dt * Math.max(13.9, (sp * Math.PI) / 0.68);
    const A = y > 0.03 ? 0 : Math.min(1, sp / 3);
    let run = null;
    if (A > 0.04) {
      const local = angulo(Math.atan2(-f.vz, f.vx) - yaw);
      run = { phase: f.fase || 0, amp: A, act: P.act || 0, dz: Math.cos(local), dx: Math.sin(local) };
    }
    if (y < 0.02 && !(P.act > 0.3) && !run) {
      f.semilla = f.semilla == null ? Math.random() * 6 : f.semilla;
      P = Object.assign({}, P, { lean: P.lean + 0.02 * Math.sin(t * 1.9 + f.semilla), k: P.k + 0.05 * (0.5 + 0.5 * Math.sin(t * 2.6 + f.semilla)) });
    }
    BV.personaje.posar(f, P, run, mira);
    if (f.sombra) { f.sombra.position.y = 0.014 - y; const e = 1 + y * 0.9; f.sombra.scale.set(e, e, 1); f.sombra.material.opacity = 1 / (1 + y * 2.4); }
  }

  function applyPose(fig, P, run) {
    const s = fig.s, k = P.k;
    fig.hips.position.y = 0.9 * s * Math.cos(0.5 * k) + 0.04 * s;
    fig.legs.forEach((L, i) => {
      const sw = run ? Math.sin(run.phase + i * Math.PI) * 0.6 * run.amp : 0;
      L.thigh.rotation.z = 0.5 * k + sw;
      L.knee.rotation.z = -k - Math.max(0, -sw) * 0.8;
    });
    fig.torso.rotation.z = -P.lean;
    const hit = fig.lefty ? 'armL' : 'armR', other = fig.lefty ? 'armR' : 'armL';
    const armSw = run ? Math.sin(run.phase) * 0.5 * run.amp : 0;
    fig[other].rotation.z = P.aL + armSw;
    fig[hit].rotation.z = P.aR - armSw;
  }

  /* ================= guion → línea de tiempo ================= */
  const to3 = (p) => ({ x: p.x - 9, z: p.y - 4.5 });

  function load(kind) {
    if (!M.opts || !M.opts.build) return;
    M.root.querySelectorAll('[data-k]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.k === kind)));
    M.root.querySelector('#vTitle3d').textContent = `3D video: ${KINDS[kind]}`;
    if ((M.soft || M.lento) && !BV.RENDER && VIDEOS.includes(kind)) { reproducirVideo(kind); return; }
    dibujoSimple(kind);
  }

  /* ---- video pregrabado: mismas personas, sin depender de la tarjeta gráfica ---- */
  const videoActivo = () => !!M && !!M.vid && !M.vid.hidden;
  function verVideo(si) {
    M.vid.hidden = !si; M.out.hidden = si;
    M.root.querySelector('.vrec').textContent = si ? 'Download video' : 'Save as video';
    M.root.querySelector('.vnote').textContent = si
      ? 'Video with a model team.'
      : 'Animation with your team\'s data.';
    if (!si) M.vid.pause();
  }
  function fuenteVideo(kind) {
    const el = document.getElementById('emb-vid-' + kind);
    if (!el) return `videos/${kind}.mp4`;
    M.urls = M.urls || {};
    if (!M.urls[kind]) {
      const txt = atob(el.textContent), b = new Uint8Array(txt.length);
      for (let i = 0; i < txt.length; i++) b[i] = txt.charCodeAt(i);
      M.urls[kind] = URL.createObjectURL(new Blob([b], { type: 'video/mp4' }));
    }
    return M.urls[kind];
  }
  function reproducirVideo(kind) {
    M.kind = kind; M.tl = null; M.t = 0; M.playing = false;
    setCap('');
    verVideo(true);
    M.vid.src = fuenteVideo(kind);
    M.vid.playbackRate = M.speed;
    const p = M.vid.play();
    if (p) p.catch(() => {});
    syncUi();
  }
  function guardarVideo() {
    fetch(M.vid.src).then((r) => r.blob()).then((b) => BV.download(`biovoley-${M.kind}.mp4`, b), () => BV.toast('Could not prepare the download.'));
  }

  function dibujoSimple(kind) {
    verVideo(false);
    const script = M.opts.build(kind);
    if (!script || script.error) {
      M.tl = null; M.t = 0; M.total = 0; M.playing = false;
      const g = M.ctx; g.fillStyle = '#0d1626'; g.fillRect(0, 0, W, H);
      g.fillStyle = '#dfe6f6'; g.font = '600 28px Barlow, Arial, sans-serif'; g.textAlign = 'center';
      g.fillText(script && script.error ? script.error : 'Could not build this play.', W / 2, H / 2); g.textAlign = 'left';
      syncUi(); return;
    }
    M.kind = kind;
    M.tl = kind === 'switch' && script.zones ? timelineSwitch(script) : timeline(script);
    M.total = M.tl.totalVideo || M.tl.total; M.t = 0; M.playing = true;
    syncUi(); loop();
  }

  /** crea las figuras de nuestro equipo (con sus datos) y del rival */
  function setupCast(script) {
    const D = BV.data;
    const net = D.settings.net || 2.24;
    setNetHeight(net);
    // figuras: nuestro equipo con sus datos y el rival en gris
    while (M.figs.children.length) {
      const q = M.figs.children[0];
      M.figs.remove(q);
      if (M.real) BV.personaje.soltar(q);
    }
    const roles = script.roles || {};
    const keyIds = new Set(Object.values(roles).filter(Boolean));
    const figs = {};
    Object.keys(script.start.pos).forEach((pid) => {
      const p = BV.player(pid); if (!p) return;
      const chip = '#' + new THREE.Color(ROLE_HEX[p.pos] || 0x2a78d6).getHexString() + 'dd';
      const f = figura({ pid, sexo: D.cat === 'X' ? p.sex : D.cat, num: p.num, libero: p.pos === 'L', chip, color: ROLE_HEX[p.pos] || 0x2a78d6, height: (p.height || 172) / 100, lefty: p.hand === 'Z', label: keyIds.has(pid) || script.kind === 'switch' || script.kind === 'mine' ? `#${p.num} ${p.name.split(' ')[0]}` : `#${p.num}` });
      M.figs.add(f.root); figs[pid] = f;
    });
    const rivalBase = [[1.6, -2.9], [1.6, 0], [1.6, 2.9], [6.6, -2.9], [6.6, 0], [6.6, 2.9]];
    const rivals = rivalBase.map(([x, z], i) => {
      const f = figura({ pid: 'r' + i, sexo: D.cat === 'X' ? 'F' : D.cat, num: i + 2, color: 0x8a94a6, height: 1.68 + (i * 0.037) % 0.14, rival: true });
      f.root.rotation.y = Math.PI; f.home = { x, z }; f.root.position.set(x, 0, z);
      M.figs.add(f.root); return f;
    });
    // vida alrededor de la cancha: árbitro en su silla, entrenador y suplentes junto al banco
    M.extras = [];
    if (M.real) {
      const sexo = D.cat === 'X' ? 'F' : D.cat;
      const pon = (o, x, y, z, frente) => { const f = persona(Object.assign({ sexo, height: 1.7 }, o)); f.root.position.set(x, y, z); M.figs.add(f.root); M.extras.push({ f, x, y, z, frente }); };
      pon({ pid: 'arb', rival: true, num: '' }, 0, 1.58, 6.1, Math.PI / 2);
      M.extras[0].f.root.traverse((o) => { if (o.isSkinnedMesh && o.material.map && o.material.map.isCanvasTexture) o.material.color.set(0x23262e); });
      pon({ pid: 'ent', num: '', height: 1.78 }, -7.6, 0, 6.6, Math.PI / 2 + 0.5);
      pon({ pid: 'sup1', num: 14 }, -4.2, 0, 7.0, Math.PI / 2);
      pon({ pid: 'sup2', num: 18 }, -5.6, 0, 7.1, Math.PI / 2 + 0.2);
    }
    return { net, figs, rivals };
  }

  function timeline(script) {
    const { net, figs, rivals } = setupCast(script);
    let server = null;
    if (script.frames[0] && script.frames[0].ev && script.frames[0].ev.hit === 'rival') {
      server = figura({ pid: 'rs', sexo: BV.data.cat === 'X' ? 'F' : BV.data.cat, num: 8, color: 0x8a94a6, height: 1.72, rival: true });
      server.root.rotation.y = Math.PI; M.figs.add(server.root);
      const sb = to3(script.start.ball); server.root.position.set(sb.x + 0.35, 0, sb.z + 0.25);
    }
    const jumpOf = (pid) => { const fa = BV.calc.fatigue(pid); const cm = fa.sets.length ? fa.sets[0].mean : 40; return BV.clamp(cm, 15, 80) / 100; };
    const reachOf = (pid) => 1.33 * ((BV.player(pid) || {}).height || 172) / 100;
    const ballR = 0.105;

    const segs = [], poses = [], jumps = [], blocks = [], cams = [], texts = [], contactos = [], defensa = [];
    const intro = 2.4;
    let t = intro;
    let pos0 = script.start.pos;
    const b0 = script.start.ball;
    let ballPrev = { x: to3(b0).x, z: to3(b0).z, y: script.kind === 'switch' ? 1.2 : script.kind === 'mine' ? (b0.h || 0) + ballR : 2.55 };
    const centroid = (pos) => { const v = Object.values(pos); return v.length ? { x: v.reduce((s, p) => s + p.x, 0) / v.length - 9, z: v.reduce((s, p) => s + p.y, 0) / v.length - 4.5 } : { x: -4.5, z: 0 }; };
    cams.push({ t: 0, pos: [-17, 9.5, 10], look: [0, 0.5, 0] });

    script.frames.forEach((f, i) => {
      const ev = f.ev || {};
      let dur = { serve: 1.7, pass: 1.4, set: ev.quick ? 0.9 : 1.6, spike: 1.6, toss: 1.0, move: 2.4 }[ev.kind] || 1.5;
      const t0 = t, t1 = t + dur;
      const tgt = f.ball ? to3(f.ball) : null;
      let ball1 = ballPrev, arc = 0;
      if (tgt) {
        let y = (f.ball.h || 0) + ballR;
        if (ev.recvAct === 'pass') y = 0.75;
        else if (ev.recvAct === 'set') y = ((BV.player(ev.recv) || {}).height || 170) / 100 + 0.3;
        else if (ev.recvAct === 'spike') y = reachOf(ev.recv) + jumpOf(ev.recv);
        else if (ev.kind === 'toss') y = 3.4;
        else if (f.ball.h === 0) y = ballR;
        ball1 = { x: tgt.x, z: tgt.z, y };
        arc = ev.kind === 'serve' ? 1.6 : ev.kind === 'pass' ? 2.0 : ev.kind === 'set' ? (ev.quick ? 0.35 : 2.4) : ev.kind === 'toss' ? 0.2 : ev.kind === 'spike' ? -0.1 : (f.ball.arc || 0) * 0.9;
      }
      segs.push({ t0, t1, pos0, pos1: f.pos || pos0, ball0: ballPrev, ball1, arc, ev, f, slow: ev.kind === 'spike' });
      if (!ev.kind && script.kind === 'mine' && pos0) {
        let best = null, bd = Infinity;
        Object.entries(pos0).forEach(([pid, q]) => { const P = to3(q); const d = Math.hypot(P.x - ballPrev.x, P.z - ballPrev.z); if (d < bd) { bd = d; best = pid; } });
        if (best && bd < 1.6) {
          if (ballPrev.y > 2.2 && ballPrev.x > -2.5) { poses.push({ pid: best, t0: t0 - 0.4, t1: t0 + 0.4, pose: 'spikeHit' }); jumps.push({ pid: best, t0: t0 - 0.3, tc: t0, down: 0.9, H: jumpOf(best) }); }
          else poses.push({ pid: best, t0: t0 - 0.3, t1: t0 + 0.4, pose: ballPrev.y > 1.6 ? 'set' : 'pass' });
        }
      }
      // poses de quien toca el balón
      if (ev.hit && ev.hit !== 'rival') {
        if (ev.hitAct === 'spike') {
          poses.push({ pid: ev.hit, t0: t0 - 0.12, t1: t0 + 0.04, pose: 'spikeHit' });
          if (M.real) poses.push({ pid: ev.hit, t0: t0 + 0.24, t1: t0 + 0.5, pose: 'remateSeguir' }); // el brazo termina cruzando el cuerpo
        } else {
          poses.push({ pid: ev.hit, t0: t0 - 0.25, t1: t0 + 0.05, pose: ev.hitAct });
          if (M.real && (ev.hitAct === 'pass' || ev.hitAct === 'set')) poses.push({ pid: ev.hit, t0: t0 + 0.22, t1: t0 + 0.5, pose: ev.hitAct === 'pass' ? 'passFin' : 'setFin' });
        }
      }
      if (ev.recv && ['pass', 'set', 'spike'].includes(ev.recvAct) && tgt) contactos.push({ pid: ev.recv, t: t1, ball: ball1, tipo: ev.recvAct });
      if (ev.recv && ev.recvAct === 'pass') {
        if (M.real) poses.push({ pid: ev.recv, t0: t1 - 0.85, t1: t1 - 0.32, pose: 'passPre' }); // bien abajo antes del contacto
        poses.push({ pid: ev.recv, t0: t1 - 0.3, t1: t1 + 0.05, pose: 'pass' });
      }
      if (ev.recv && ev.recvAct === 'set') {
        if (M.real) poses.push({ pid: ev.recv, t0: t1 - 0.8, t1: t1 - 0.28, pose: 'setPre' }); // manos arriba antes de que llegue
        poses.push({ pid: ev.recv, t0: t1 - 0.25, t1: t1 + 0.05, pose: 'set' });
      }
      if (ev.recv && ev.recvAct === 'spike') {
        const H = jumpOf(ev.recv), up = Math.sqrt((2 * H) / BV.G); // tiempo de subida real
        poses.push({ pid: ev.recv, t0: t0, t1: t1 - up - 0.15, pose: 'run' });
        poses.push({ pid: ev.recv, t0: t1 - up - 0.1, t1: t1, pose: 'spike' });
        jumps.push({ pid: ev.recv, t0: t1 - up, tc: t1, down: up * 3.2, H });
      }
      if (ev.kind === 'spike' && ball1.y <= 0.3) defensa.push({ t0, t1, x: ball1.x, z: ball1.z });
      if (ev.kind === 'spike' && ev.block) {
        const z = ball1 ? segs[segs.length - 1].ball0.z : 0;
        const dir = Math.sign(ball1.z - z) || 1; // el bloqueo cierra la línea; el remate va en diagonal
        blocks.push({ t0: t0 - 0.9, tc: t0 + 0.15, z: z - dir * 0.55, zAtk: z, H: 0.42 });
      }
      if (ev.kind === 'serve' && ev.hit && ev.hit !== 'rival') poses.push({ pid: ev.hit, t0: t0 - 0.3, t1: t0 + 0.4, pose: 'serve' });
      if (ev.kind === 'toss' && ev.hit) poses.push({ pid: ev.hit, t0: t0, t1: t1, pose: 'toss' });
      // cámara de cada paso
      const B = ball1, A = segs[segs.length - 1].ball0;
      if (ev.kind === 'serve' && ev.hit === 'rival') cams.push({ t: t0, pos: [B.x - 7, 3.6, B.z + 5], look: [lerp(A.x, B.x, 0.6), 1.6, lerp(A.z, B.z, 0.6)] });
      else if (ev.kind === 'serve') cams.push({ t: t0, pos: [A.x - 4, 2.6, A.z + 4.5], look: [A.x + 4, 1.8, A.z - 1] });
      else if (ev.kind === 'toss') cams.push({ t: t0, pos: [A.x - 3.5, 2.2, A.z + 3], look: [A.x, 2.2, A.z] });
      else if (ev.kind === 'pass') cams.push({ t: t0, pos: [B.x - 4.5, 2.9, B.z + 6], look: [B.x - 1.5, 1.8, B.z] });
      else if (ev.kind === 'set') cams.push({ t: t0, pos: [B.x - 3.8, 2.4, Math.sign(B.z || -1) * 9], look: [B.x - 0.4, 2.4, B.z] });
      else if (ev.kind === 'spike') cams.push({ t: Math.max(cams[cams.length - 1].t + 0.25, t0 - 1.05), pos: [A.x - 4.3, 3.0, A.z + Math.sign(A.z || -1) * 1.1], look: [A.x + 1.4, 1.95, A.z] });
      else if (ev.kind === 'move') { const c = centroid(f.pos || pos0); cams.push({ t: t0, pos: [c.x - 9, 10, c.z + 7], look: [c.x + 0.5, 0, c.z] }); }
      else { const c = centroid(f.pos || pos0); cams.push({ t: t0, pos: [c.x - 8, 6, c.z + 8], look: [lerp(A.x, B.x, 0.5), 1.2, lerp(A.z, B.z, 0.5)] }); }
      // textos
      const tip = ev.kind === 'spike' ? TIPS.spike : ev.recvAct ? TIPS[ev.recvAct] : TIPS[ev.kind] || '';
      let badge = '';
      if (ev.recvAct === 'spike') {
        const p = BV.player(ev.recv), cm = jumpOf(ev.recv) * 100, ct = ball1.y;
        badge = `${p.name.split(' ')[0]}: jump ${fmt(cm, 0)} cm · contact at ${fmt(ct, 2)} m · ${fmt((ct - net) * 100, 0)} cm above the net`;
      }
      texts.push({ t0, t1: t1 + (ev.kind === 'spike' ? 1.6 : 0), cap: (f.label || '').replace(/^\d+\.\s*/, ''), step: i + 1, tip, badge, slow: ev.kind === 'spike' });
      t = t1;
      pos0 = f.pos || pos0; ballPrev = ball1;
    });
    // aterrizaje o cierre
    const last = segs[segs.length - 1];
    if (last && last.ev.kind === 'spike' && last.ev.hit) {
      const pid = last.ev.hit, fpos = last.pos1[pid];
      const P = fpos ? to3(fpos) : { x: -1, z: 0 };
      cams.push({ t: t, pos: [P.x - 2.2, 1.15, P.z + Math.sign(P.z || -1) * 4.6], look: [P.x + 0.2, 0.6, P.z] }); // de perfil, desde fuera de la línea lateral
      poses.push({ pid, t0: t - 0.3, t1: t + 1.6, pose: 'land' });
      texts.push({ t0: t, t1: t + 1.8, cap: 'Landing', step: segs.length + 1, tip: TIPS.land, badge: '' });
      t += 1.8;
    } else {
      const c = centroid(pos0);
      cams.push({ t, pos: [c.x - 10, 11, c.z + 9], look: [c.x + 1, 0, c.z] });
      t += 1.2;
    }
    const outro = 4.2;
    cams.push({ t, pos: [-15, 11, -11], look: [0, 0, 0] });
    const total = t + outro;
    const rivalEv = [];
    defensa.forEach((d) => {
      const i = [3, 4, 5].sort((a, b) => Math.hypot(rivals[a].home.x - d.x, rivals[a].home.z - d.z) - Math.hypot(rivals[b].home.x - d.x, rivals[b].home.z - d.z))[0];
      rivalEv.push({ i, t0: d.t1 - 0.45, t1: d.t1 + 0.5, pose: M.real ? 'dig' : 'pass', to: { x: lerp(rivals[i].home.x, d.x + 0.5, 0.6), z: lerp(rivals[i].home.z, d.z, 0.6) } });
    });
    const tl = { script, figs, rivals, server, segs, poses, jumps, blocks, cams, texts, contactos, rivalEv, rivalReady: segs.length ? segs[0].t0 + 0.6 : null, intro, outroAt: t, total, net, base: script.kind === 'switch' || script.kind === 'mine' ? 'idle' : 'ready' };
    if (M.real) ajustarContactos(tl);
    // momentos clave para la cámara lenta, los congelados y los carteles
    tl.beats = contactos.map((c) => ({ tipo: c.tipo, t: c.t, pid: c.pid }));
    const remate = contactos.find((c) => c.tipo === 'spike');
    if (remate) {
      const j = jumps.find((x) => x.pid === remate.pid && Math.abs(x.tc - remate.t) < 0.01);
      if (j) tl.beats.push({ tipo: 'land', t: j.tc + j.down + 0.14, pid: remate.pid });
    }
    tl.carteles = [];
    if (server && segs[0]) tl.carteles.push({ t0: segs[0].t0 - 0.9, t1: segs[0].t0 + 0.9, tipo: 'saqueRival' });
    blocks.forEach((b) => tl.carteles.push({ t0: b.tc - 0.55, t1: b.tc + 0.7, tipo: 'block', fila: 1 }));
    defensa.forEach((d) => tl.carteles.push({ t0: d.t1 - 0.4, t1: d.t1 + 0.8, tipo: 'dig', fila: 1 }));
    dirigir(tl);
    return tl;
  }

  /* ================= video de rotación y cambio de zona ================= */
  function marksActive(tl, t) {
    return (tl.marks || []).map((m) => {
      const a = t < m.t0 - 0.4 || t > m.t1 + 0.4 ? 0 : t < m.t0 ? (t - (m.t0 - 0.4)) / 0.4 : t > m.t1 ? 1 - (t - m.t1) / 0.4 : 1;
      return a > 0 ? Object.assign({}, m, { a: clamp01(a) * (m.alpha ?? 1) }) : null;
    }).filter(Boolean);
  }
  function paintMarks(list) {
    const c = M.markCanvas, g = c.getContext('2d'), k = c.width / 9;
    const X = (x) => (x + 9) * k, Y = (z) => (z + 4.5) * k;
    g.clearRect(0, 0, c.width, c.height);
    list.forEach((m) => {
      g.globalAlpha = m.a;
      if (m.type === 'path') {
        g.strokeStyle = m.color; g.lineWidth = m.w * k; g.lineCap = 'round'; g.lineJoin = 'round';
        g.beginPath(); m.pts.forEach((p, i) => (i ? g.lineTo(X(p.x), Y(p.z)) : g.moveTo(X(p.x), Y(p.z)))); g.stroke();
        const a = m.pts[m.pts.length - 2], b = m.pts[m.pts.length - 1], ang = Math.atan2(Y(b.z) - Y(a.z), X(b.x) - X(a.x)), r = 0.38 * k;
        g.fillStyle = m.color; g.beginPath(); g.moveTo(X(b.x) + Math.cos(ang) * r, Y(b.z) + Math.sin(ang) * r);
        g.lineTo(X(b.x) + Math.cos(ang + 2.4) * r, Y(b.z) + Math.sin(ang + 2.4) * r); g.lineTo(X(b.x) + Math.cos(ang - 2.4) * r, Y(b.z) + Math.sin(ang - 2.4) * r); g.fill();
      } else {
        // el texto se lee de frente desde detrás de nuestra línea de fondo
        g.save(); g.translate(X(m.x), Y(m.z)); g.rotate(Math.PI / 2);
        g.font = `700 ${m.size * k}px "Barlow Condensed", Arial, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.lineWidth = m.size * k * 0.12; g.strokeStyle = 'rgba(0,0,0,.45)'; g.strokeText(m.text, 0, 0);
        g.fillStyle = m.color || '#fff'; g.fillText(m.text, 0, 0); g.restore();
      }
    });
    g.globalAlpha = 1;
    M.markTex.needsUpdate = true;
  }

  function timelineSwitch(script) {
    const { net, figs, rivals } = setupCast(script);
    const zp = (z) => to3(script.zonePos[z]);
    const zones = script.zones; // integrante → zona después de rotar
    const prevZone = (z) => (z === 6 ? 1 : z + 1);
    const C = { x: -4.5, z: 0 };
    const server = Object.keys(zones).find((pid) => zones[pid] === 1);
    const name = (pid) => (BV.player(pid) ? BV.player(pid).name.split(' ')[0] : '');
    const T = { intro: 2.4, rot0: 3.6, rot1: 6.8, walk0: 7.4, walk1: 8.6, toss: 8.6, hit: 9.5, recv: 10.9, sw: 10.7, swF1: 13.0, swB0: 11.2, swB1: 13.9, set: 12.3, setEnd: 13.6, final: 14.4, outro: 17.8 };
    const paths = {}, poses = [], marks = [], texts = [], cams = [];
    const out = (a, b, k) => { const m = { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 }; return { x: m.x + (m.x - C.x) * k, z: m.z + (m.z - C.z) * k }; };
    const behind = { x: -9.7, z: zp(1).z };
    // 1) rotación en sentido horario por arcos alrededor del centro
    Object.entries(zones).forEach(([pid, z]) => {
      const a = zp(prevZone(z)), b = zp(z), c = out(a, b, 0.55);
      paths[pid] = [{ t0: T.rot0, t1: T.rot1, a, c, b }];
      const pts = curve(a, c, b);
      marks.push({ type: 'path', pts: pts.slice(3, -3), color: '#f4c01b', w: 0.13, t0: 3.0, t1: T.rot1 + 0.4 });
    });
    [1, 2, 3, 4, 5, 6].forEach((z) => { const p = zp(z); marks.push({ type: 'text', x: p.x - 1.05, z: p.z, text: String(z), size: 0.95, color: '#ffffff', alpha: 0.55, t0: T.intro, t1: T.final - 0.3 }); });
    // 2) quien queda en zona 1 sale detrás de la línea a sacar
    if (server) paths[server].push({ t0: T.walk0, t1: T.walk1, a: zp(1), c: { x: (zp(1).x + behind.x) / 2, z: zp(1).z }, b: behind });
    Object.keys(zones).forEach((pid) => { if (pid !== server) poses.push({ pid, t0: T.walk1 - 0.4, t1: T.sw, pose: 'ready' }); });
    if (server && M.real) {
      poses.push({ pid: server, t0: T.toss - 0.1, t1: T.hit - 0.52, pose: 'toss' });
      poses.push({ pid: server, t0: T.hit - 0.34, t1: T.hit - 0.2, pose: 'serve' });
      poses.push({ pid: server, t0: T.hit, t1: T.hit + 0.3, pose: 'saqueGolpe' });
    } else if (server) { poses.push({ pid: server, t0: T.toss, t1: T.hit - 0.15, pose: 'toss' }); poses.push({ pid: server, t0: T.hit - 0.15, t1: T.hit + 0.4, pose: 'serve' }); }
    // 3) cambio de zona: caminos curvos separados para que nadie se cruce
    const kind = Object.fromEntries((script.swapList || []).map((x) => [x.pid, x.far ? 'long' : 'short']));
    Object.entries(zones).forEach(([pid, z]) => {
      const front = [2, 3, 4].includes(z);
      const a = pid === server ? behind : zp(z);
      const b = script.spec[pid] ? to3(script.spec[pid]) : a;
      const dz = b.z - a.z;
      const c = { x: (a.x + b.x) / 2 + (Math.abs(dz) > 1 ? (dz < 0 ? 0.9 : -0.9) : 0), z: (a.z + b.z) / 2 };
      const t0 = front ? T.sw : T.swB0, t1 = front ? T.swF1 : T.swB1;
      paths[pid].push({ t0, t1, a, c, b });
      if (Math.hypot(b.x - a.x, b.z - a.z) > 0.8) {
        const p = BV.player(pid);
        const col = '#' + new THREE.Color(ROLE_HEX[p.pos] || 0x2a78d6).getHexString();
        marks.push({ type: 'path', pts: curve(a, c, b).slice(2), color: col, w: 0.11, t0: T.sw - 0.2, t1: T.final + 0.2 });
        if (kind[pid]) { const mid = bez(a, c, b, 0.5); marks.push({ type: 'text', x: mid.x - 0.45, z: mid.z, text: `${kind[pid]} switch`, size: 0.46, color: '#ffffff', t0: T.sw, t1: T.final }); }
      }
    });
    // 4) posiciones especializadas con su rol escrito en el piso
    Object.entries(zones).forEach(([pid]) => {
      const p = BV.player(pid); const b = script.spec[pid] ? to3(script.spec[pid]) : zp(zones[pid]);
      marks.push({ type: 'text', x: b.x - 0.95, z: b.z, text: BV.POS[p.pos].label.split(' ')[0].toUpperCase(), size: 0.55, color: '#f4c01b', t0: T.final, t1: T.outro });
    });
    // balón: saque, recepción y colocación del rival
    const sb = { x: behind.x + 0.15, z: behind.z };
    const golpe = { x: sb.x + 0.05, y: M.real ? 2.4 : 3.3, z: sb.z };
    const segs = [
      { t0: T.toss, t1: T.hit, ball0: { x: sb.x, y: 1.2, z: sb.z }, ball1: golpe, arc: M.real ? 1.9 : 0.15, ev: {} },
      { t0: T.hit, t1: T.recv, ball0: golpe, ball1: { x: 6.2, y: 0.8, z: 0.3 }, arc: M.real ? 2.2 : 1.6, ev: {} },
      { t0: T.recv, t1: T.set, ball0: { x: 6.2, y: 0.8, z: 0.3 }, ball1: { x: 1.0, y: 2.4, z: 0.6 }, arc: 1.7, ev: {} },
      { t0: T.set, t1: T.setEnd, ball0: { x: 1.0, y: 2.4, z: 0.6 }, ball1: { x: 1.2, y: 3.1, z: -2.6 }, arc: 1.8, ev: {} },
    ];
    const rivalEv = [{ i: 4, t0: T.recv - 0.5, t1: T.recv + 0.2, pose: 'pass', to: { x: 6.4, z: 0.3 } }, { i: 1, t0: T.set - 0.45, t1: T.set + 0.2, pose: 'set', to: { x: 1.1, z: 0.6 } }];
    // cámara
    cams.push({ t: 0, pos: [-17, 9.5, 10], look: [0, 0.5, 0] });
    cams.push({ t: T.intro, pos: [-16, 13.5, 0.01], look: [-5.6, 0, 0] });
    cams.push({ t: T.walk0, pos: [-14, 2.7, behind.z + 3.6], look: [-5, 1.5, behind.z - 1.2] });
    cams.push({ t: T.hit, pos: [-13, 4.6, 6.2], look: [2, 2, 0] });
    cams.push({ t: T.sw, pos: [-16.5, 13, 2], look: [-6.2, 0, 0] });
    cams.push({ t: T.final, pos: [-15.5, 10.5, 4.5], look: [-6, 0.4, 0] });
    cams.push({ t: T.outro, pos: [-15, 11, -11], look: [0, 0, 0] });
    // subtítulos
    const largos = (script.swapList || []).filter((x) => x.far).map((x) => name(x.pid));
    const cortos = (script.swapList || []).filter((x) => !x.far).map((x) => name(x.pid));
    const resumen = [largos.length ? `Long switch: ${largos.join(', ')}` : '', cortos.length ? `Short switch: ${cortos.join(', ')}` : ''].filter(Boolean).join(' · ') || 'Nobody needs to switch zones in this rotation.';
    texts.push({ t0: T.intro, t1: T.walk0, step: 1, cap: `We won the serve back: we rotate clockwise${script.rot ? ' (' + script.rot + ')' : ''}.`, tip: 'Each player moves one zone: 2 to 1, 1 to 6, 6 to 5… Whoever reaches zone 1 serves.' });
    texts.push({ t0: T.walk0, t1: T.recv - 0.3, step: 2, cap: `Serving: ${name(server)} from behind the end line.`, tip: 'At the serve, keep the order: front and back, left, center and right, without overlapping (FIVB rule).' });
    texts.push({ t0: T.recv - 0.3, t1: T.final, step: 3, cap: 'The ball crossed the net: each player goes to their specialized zone.', tip: resumen });
    texts.push({ t0: T.final, t1: T.outro, step: 4, cap: `Specialized positions: front row outside, middle and opposite; back row defense and ${BV.w.la} ${BV.w.arm} ready to penetrate.`, tip: 'This way each player plays in the zone where they perform best.' });
    const startPos = {};
    Object.entries(zones).forEach(([pid, z]) => { startPos[pid] = script.zonePos[prevZone(z)]; });
    const tl = {
      script: Object.assign({}, script, { start: { pos: startPos, ball: script.start.ball } }),
      figs, rivals, server: null, segs, poses, jumps: [], blocks: [], cams, texts, marks, paths,
      contactos: server ? [{ pid: server, t: T.hit, ball: golpe, tipo: 'saque' }] : [],
      rivalEv, rivalReady: T.hit, ballFrom: T.toss - 0.1, ballUntil: T.setEnd + 0.25,
      intro: T.intro, outroAt: T.outro, total: T.outro + 4.2, net, base: 'idle',
    };
    if (M.real) ajustarContactos(tl);
    tl.beats = server ? [{ tipo: 'saque', t: T.hit, pid: server }] : [];
    tl.carteles = [{ t0: T.rot0 - 0.3, t1: T.rot1, tipo: 'rotate' }, { t0: T.sw - 0.2, t1: T.swB1, tipo: 'switch' }, { t0: T.recv - 0.5, t1: T.recv + 0.6, tipo: 'paseRival', fila: 1 }];
    dirigir(tl);
    return tl;
  }

  /* ================= estado de la escena en el tiempo t ================= */
  function poseAt(tl, pid, t) {
    let P = Object.assign({}, POSES[tl.base]), act = 0;
    tl.poses.forEach((e) => {
      if (e.pid !== pid || t < e.t0 - 0.2 || t > e.t1 + 0.2) return;
      const w = t < e.t0 ? smooth((t - (e.t0 - 0.2)) / 0.2) : t > e.t1 ? smooth(1 - (t - e.t1) / 0.2) : 1;
      const Q = POSES[e.pose] || POSES.idle;
      Object.keys(P).forEach((k) => { P[k] = lerp(P[k], Q[k], w); });
      if (e.pose !== 'run') act = Math.max(act, w);
    });
    if (M.real) {
      // antes de saltar se flexiona y lleva los brazos atrás; al caer amortigua
      tl.jumps.forEach((j) => {
        if (j.pid !== pid) return;
        const carga = campana(t, j.t0 - 0.32, j.t0 - 0.06, j.t0 + 0.05);
        const cae = j.tc + j.down;
        const amort = campana(t, cae - 0.04, cae + 0.12, cae + 0.55);
        [[carga, POSES.impulso], [amort, POSES.land]].forEach(([w, Q]) => { if (w > 0) { Object.keys(P).forEach((k) => { P[k] = lerp(P[k], Q[k], w); }); act = Math.max(act, w); } });
      });
    }
    P.act = act;
    return P;
  }
  /** lleva a cada quien al balón: calcula cuánto debe desplazarse para que la mano llegue justo al contacto */
  function ajustarContactos(tl) {
    tl.contactos.forEach((c) => {
      const f = tl.figs[c.pid]; if (!f || !f.real) return;
      c.dx = 0; c.dz = 0;
      for (let i = 0; i < 3; i++) {
        const p = posAt(tl, c.pid, c.t);
        f.tPrev = null;
        moverPersona(f, p.x + c.dx, jumpY(tl.jumps, c.pid, c.t), p.z + c.dz, poseAt(tl, c.pid, c.t), c.t, c.ball);
        const q = BV.personaje.punto(f, c.tipo);
        c.dx += c.ball.x - q.x; c.dz += c.ball.z - q.z;
        c.dy = c.ball.y - q.y;
      }
      f.tPrev = null;
      // altura: el balón llega a la mano; en el remate parte de la diferencia la cubre el salto con carrera
      const borde = { pass: 0.14, set: 0.15, spike: 0.115, saque: 0.115 }[c.tipo];
      let falta = c.dy - borde;
      if (c.tipo === 'spike') {
        const j = tl.jumps.find((x) => x.pid === c.pid && Math.abs(x.tc - c.t) < 0.01);
        const extra = j ? BV.clamp(falta, 0, 0.25) : 0;
        if (j) j.H += extra;
        falta -= extra;
      }
      c.ball.y -= falta;
    });
  }
  function desplazamiento(tl, pid, t) {
    let x = 0, z = 0;
    (tl.contactos || []).forEach((c) => {
      if (c.pid !== pid || c.dx == null) return;
      // en el remate el avance del salto se conserva; en los demás toques vuelve a su sitio
      const w = t < c.t ? smooth(clamp01((t - (c.t - 0.55)) / 0.55)) : c.tipo === 'spike' ? 1 : smooth(clamp01(1 - (t - c.t - 0.15) / 0.5));
      x += c.dx * w; z += c.dz * w;
    });
    return { x, z };
  }
  function campana(t, a, b, c) { return t <= a || t >= c ? 0 : t < b ? smooth((t - a) / (b - a)) : smooth((c - t) / (c - b)); }
  /** encadena poses: lista de [instante, pose] con transiciones cortas */
  function secuencia(t, lista) {
    let P = POSES[lista[0][1]];
    for (let i = 1; i < lista.length; i++) {
      const [ti, nom] = lista[i];
      if (t < ti - 0.18) break;
      const w = smooth(clamp01((t - (ti - 0.18)) / 0.18)), Q = POSES[nom], A = P;
      P = Object.fromEntries(Object.keys(A).map((k) => [k, lerp(A[k], Q[k], w)]));
    }
    return P;
  }
  function jumpY(list, pid, t) {
    for (const j of list) {
      if (j.pid !== pid || t < j.t0 || t > j.tc + j.down) continue;
      if (t <= j.tc) { const u = (j.tc - t) / (j.tc - j.t0); return j.H * (1 - u * u); }
      const u = (t - j.tc) / j.down; return j.H * (1 - u * u);
    }
    return 0;
  }
  function bez(a, c, b, u) { const v = 1 - u; return { x: v * v * a.x + 2 * v * u * c.x + u * u * b.x, z: v * v * a.z + 2 * v * u * c.z + u * u * b.z }; }
  function curve(a, c, b, n = 18) { return Array.from({ length: n + 1 }, (_, i) => bez(a, c, b, i / n)); }
  function posAt(tl, pid, t) {
    if (tl.paths && tl.paths[pid]) {
      const ps = tl.paths[pid];
      let p = ps[0].a;
      for (const s of ps) { if (t < s.t0) break; p = bez(s.a, s.c, s.b, ease(clamp01((t - s.t0) / (s.t1 - s.t0)))); }
      return p;
    }
    const segs = tl.segs;
    const get = (pos) => (pos && pos[pid] ? to3(pos[pid]) : null);
    let p = get(tl.script.start.pos);
    for (const s of segs) {
      if (t < s.t0) break;
      const a = get(s.pos0) || p, b = get(s.pos1) || a;
      if (!a) continue;
      const u = clamp01((t - s.t0) / (s.t1 - s.t0));
      p = { x: lerp(a.x, b.x, ease(u)), z: lerp(a.z, b.z, ease(u)) };
    }
    return p;
  }
  function ballAt(tl, t) {
    const segs = tl.segs;
    if (!segs.length) return null;
    if (t <= segs[0].t0) {
      const b = segs[0].ball0;
      if (!tl.server || !M.real) return b;
      const u = clamp01((t - (segs[0].t0 - 1.05)) / 1.05);
      return { x: b.x, z: b.z, y: lerp(1.2, b.y, u) + 5 * u * (1 - u) * 0.72 };
    }
    for (const s of segs) {
      if (t > s.t1) continue;
      const u = clamp01((t - s.t0) / (s.t1 - s.t0));
      return { x: lerp(s.ball0.x, s.ball1.x, u), z: lerp(s.ball0.z, s.ball1.z, u), y: lerp(s.ball0.y, s.ball1.y, u) + 4 * s.arc * u * (1 - u) };
    }
    const e = segs[segs.length - 1].ball1;
    if (e.y <= 0.2) { const k = t - segs[segs.length - 1].t1; return { x: e.x + Math.min(2, k * 1.2), z: e.z, y: 0.105 + Math.abs(Math.sin(k * 6)) * 0.4 * Math.exp(-k * 2.5) }; }
    return e;
  }
  function camAt(tl, t) {
    const c = tl.cams;
    let i = 0;
    while (i < c.length - 1 && c[i + 1].t <= t) i++;
    const a = c[i], b = c[Math.min(i + 1, c.length - 1)];
    const prev = c[Math.max(0, i - 1)];
    // transición suave hacia la cámara activa en el primer segundo
    const u = smooth(clamp01((t - a.t) / 1.0));
    const from = i === 0 ? a : prev;
    const mix = (k) => [0, 1, 2].map((j) => lerp(from[k][j], a[k][j], i === 0 ? 1 : u));
    void b;
    return { pos: mix('pos'), look: mix('look') };
  }

  function draw() {
    const tl = M.tl; if (!tl || !M.scene) return;
    const T = M.t, t = escena(tl, T), fz = congelado(tl, T);
    const ballVis = (tl.ballFrom == null || t >= tl.ballFrom) && (tl.ballUntil == null || t <= tl.ballUntil) ? ballAt(tl, t) : null;
    // nuestro equipo
    Object.entries(tl.figs).forEach(([pid, f]) => {
      const p = posAt(tl, pid, t); if (!p) { f.root.visible = false; return; }
      f.root.visible = true;
      if (f.real) { const d = desplazamiento(tl, pid, t); moverPersona(f, p.x + d.x, jumpY(tl.jumps, pid, t), p.z + d.z, poseAt(tl, pid, t), t, ballVis); return; }
      const p2 = posAt(tl, pid, t + 0.05) || p;
      const sp = Math.hypot(p2.x - p.x, p2.z - p.z) / 0.05;
      const run = sp > 0.3 ? { phase: t * 11, amp: Math.min(1, sp / 3) } : null;
      f.root.position.set(p.x, jumpY(tl.jumps, pid, t), p.z);
      applyPose(f, poseAt(tl, pid, t), run);
    });
    // rivales: dos bloqueadores saltan frente al ataque
    M.bloqueadores = [];
    tl.rivals.forEach((f, i) => {
      let x = f.home.x, z = f.home.z, y = 0, P = tl.rivalReady != null && t > tl.rivalReady ? POSES.ready : POSES.idle;
      (tl.rivalEv || []).forEach((e) => {
        if (e.i !== i || t < e.t0 - 0.2 || t > e.t1 + 0.2) return;
        const w = t < e.t0 ? smooth((t - (e.t0 - 0.2)) / 0.2) : t > e.t1 ? smooth(1 - (t - e.t1) / 0.2) : 1;
        const Q = POSES[e.pose]; P = Object.fromEntries(Object.keys(P).map((k) => [k, lerp(P[k], Q[k], w)]));
        if (e.to) { const u = smooth(clamp01((t - e.t0 + 0.6) / 0.6)); x = lerp(f.home.x, e.to.x, u); z = lerp(f.home.z, e.to.z, u); }
      });
      tl.blocks.forEach((b) => {
        if (i > 2 || t < b.t0 - 1.2) return;
        const pair = [b.z - 0.45, b.z + 0.45];
        const order = [0, 1, 2].sort((a, c) => Math.abs(tl.rivals[a].home.z - b.zAtk) - Math.abs(tl.rivals[c].home.z - b.zAtk));
        const slot = order.indexOf(i);
        if (slot > 1) return;
        const u = smooth(clamp01((t - (b.t0 - 1.2)) / 1.0));
        x = lerp(f.home.x, 0.45, u); z = lerp(f.home.z, pair[slot], u);
        const up = 0.35, dn = 0.9;
        if (t >= b.tc - up && t <= b.tc + dn) { const w = t <= b.tc ? (b.tc - t) / up : (t - b.tc) / dn; y = b.H * (1 - w * w); }
        P = M.real ? secuencia(t, [[b.t0 - 1.2, 'ready'], [b.tc - 0.5, 'impulso'], [b.tc - 0.28, 'block'], [b.tc - 0.06, 'bloqueo2'], [b.tc + 0.55, 'land'], [b.tc + 1.1, 'ready']]) : t > b.t0 - 0.4 ? POSES.block : POSES.ready;
        if (t > b.tc - 0.6 && t < b.tc + 0.7) M.bloqueadores.push(i);
      });
      if (f.real) { P = Object.assign({}, P); moverPersona(f, x, y, z, P, t, ballVis); return; }
      f.root.position.set(x, y, z);
      applyPose(f, P, null);
    });
    if (tl.server && tl.segs[0]) {
      const t0 = tl.segs[0].t0;
      const Ps = M.real ? secuencia(t, [[t0 - 1.5, 'idle'], [t0 - 1.1, 'toss'], [t0 - 0.42, 'serve'], [t0 - 0.03, 'saqueGolpe'], [t0 + 0.5, 'idle']]) : t > t0 - 0.8 && t < t0 + 0.4 ? POSES.serve : POSES.idle;
      const ys = t > t0 - 0.35 && t < t0 + 0.35 ? 0.25 * (1 - Math.pow((t - t0) / 0.35, 2)) : 0;
      if (tl.server.real) { const q = tl.server.root.position; moverPersona(tl.server, q.x, ys, q.z, Ps, t, ballVis); } else { applyPose(tl.server, Ps, null); tl.server.root.position.y = ys; }
    }
    // balón
    const b = ballVis;
    if (b) { M.ball.visible = true; M.ball.position.set(b.x, b.y, b.z); M.ball.rotation.x = t * 7; M.ball.rotation.z = t * 4; } else M.ball.visible = false;
    // árbitro, entrenador y suplentes siguen el balón
    (M.extras || []).forEach((e) => moverPersona(e.f, e.x, e.y, e.z, POSES.idle, t, ballVis, e.frente));
    // aro de luz bajo quien ejecuta la acción
    anillo(tl, t, T);
    // cámara: en un congelado gira alrededor de quien ejecuta (efecto de tiempo detenido)
    const c = camAt(tl, t);
    const cz = fz && camCongelado(tl, fz);
    if (cz) {
      const u = clamp01((T - fz.T0) / (fz.T1 - fz.T0)), w = smooth(clamp01(u / 0.22)) * smooth(clamp01((1 - u) / 0.22));
      // mientras el tiempo está detenido, la cámara gira despacio alrededor del gesto
      const rel = cz.pos.clone().sub(cz.look).applyAxisAngle(new THREE.Vector3(0, 1, 0), 0.35 * (u - 0.5) * (fz.giro || 1));
      const p = cz.look.clone().add(rel);
      M.cam.position.set(lerp(c.pos[0], p.x, w), lerp(c.pos[1], p.y, w), lerp(c.pos[2], p.z, w));
      M.cam.lookAt(lerp(c.look[0], cz.look.x, w), lerp(c.look[1], cz.look.y, w), lerp(c.look[2], cz.look.z, w));
    } else { M.cam.position.set(...c.pos); M.cam.lookAt(...c.look); }
    if (M.real) {
      const todas = Object.values(tl.figs);
      todas.forEach((f) => {
        if (!f.label) return;
        const d = f.root.position.distanceTo(M.cam.position), e = BV.clamp(d / 15, 0.3, 1);
        f.label.visible = d > 8; f.label.scale.set(1.25 * e, 0.28 * e, 1); // de cerca estorbaría el gesto
      });
    }
    if (M.renderer) {
      M.markPlane.visible = !!tl.marks;
      if (tl.marks) paintMarks(marksActive(tl, t));
      M.renderer.render(M.scene, M.cam);
    } else softRender(tl);
    overlay(t, T, fz);
  }

  /* ================= modo compatible: dibujo por software ================= */
  function softRender(tl) {
    const g = M.ctx, cam = M.cam, NEAR = 0.15;
    M.scene.updateMatrixWorld(true);
    cam.updateMatrixWorld(true);
    const inv = cam.matrixWorldInverse;
    const f = (H / 2) / Math.tan((cam.fov * Math.PI) / 360);
    const view = (x, y, z) => new THREE.Vector3(x, y, z).applyMatrix4(inv);
    const scr = (v) => ({ x: W / 2 + (v.x / -v.z) * f, y: H / 2 - (v.y / -v.z) * f, d: -v.z });
    const clip = (vs) => {
      const out = [];
      for (let i = 0; i < vs.length; i++) {
        const a = vs[i], b = vs[(i + 1) % vs.length], ain = -a.z >= NEAR, bin = -b.z >= NEAR;
        if (ain) out.push(a);
        if (ain !== bin) out.push(a.clone().lerp(b, (-NEAR - a.z) / (b.z - a.z)));
      }
      return out;
    };
    const poly = (pts, fill) => {
      const vs = clip(pts.map((p) => view(p[0], p[1], p[2])));
      if (vs.length < 3) return;
      g.beginPath(); vs.forEach((v, i) => { const q = scr(v); if (i) g.lineTo(q.x, q.y); else g.moveTo(q.x, q.y); }); g.closePath();
      g.fillStyle = fill; g.fill();
    };
    const seg = (p, q, wM, color) => {
      let a = view(p.x, p.y, p.z), b = view(q.x, q.y, q.z);
      const ain = -a.z >= NEAR, bin = -b.z >= NEAR;
      if (!ain && !bin) return;
      if (!ain) a = a.clone().lerp(b, (-NEAR - a.z) / (b.z - a.z));
      if (!bin) b = b.clone().lerp(a, (-NEAR - b.z) / (a.z - b.z));
      const sa = scr(a), sb = scr(b);
      g.lineWidth = Math.max(1, (wM * f) / ((sa.d + sb.d) / 2)); g.strokeStyle = color; g.lineCap = 'round';
      g.beginPath(); g.moveTo(sa.x, sa.y); g.lineTo(sb.x, sb.y); g.stroke();
    };
    const dot = (p, rM, fill, stroke) => {
      const v = view(p.x, p.y, p.z); if (-v.z < NEAR) return;
      const q = scr(v), r = Math.max(1, (rM * f) / q.d);
      g.beginPath(); g.arc(q.x, q.y, r, 0, Math.PI * 2); g.fillStyle = fill; g.fill();
      if (stroke) { g.strokeStyle = stroke; g.lineWidth = Math.max(1, r * 0.35); g.stroke(); }
    };
    const shadow = (x, z, r) => { const pts = []; for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; pts.push([x + Math.cos(a) * r, 0.01, z + Math.sin(a) * r * 0.8]); } poly(pts, 'rgba(0,0,0,.28)'); };
    const P = (x, y, z) => new THREE.Vector3(x, y, z);
    const camPos = cam.position;
    // fondo, piso, tribunas, cancha y líneas
    g.fillStyle = '#0d1626'; g.fillRect(0, 0, W, H);
    poly([[-30, 0, -20], [30, 0, -20], [30, 0, 20], [-30, 0, 20]], '#214a74');
    [[[-14, 0, -12], [-14, 2.4, -12], [-14, 2.4, 12], [-14, 0, 12]], [[14, 0, -12], [14, 2.4, -12], [14, 2.4, 12], [14, 0, 12]],
      [[-14, 0, -12], [-14, 2.4, -12], [14, 2.4, -12], [14, 0, -12]], [[-14, 0, 12], [-14, 2.4, 12], [14, 2.4, 12], [14, 0, 12]]].forEach((w) => poly(w, '#16263d'));
    poly([[-9, 0, -4.5], [9, 0, -4.5], [9, 0, 4.5], [-9, 0, 4.5]], '#d9883f');
    const L = (x1, z1, x2, z2) => seg(P(x1, 0.01, z1), P(x2, 0.01, z2), 0.05, '#ffffff');
    L(-9, -4.5, 9, -4.5); L(-9, 4.5, 9, 4.5); L(-9, -4.5, -9, 4.5); L(9, -4.5, 9, 4.5); L(0, -4.5, 0, 4.5); L(-3, -4.5, -3, 4.5); L(3, -4.5, 3, 4.5);
    // marcas en el piso (proyectadas)
    marksActive(tl, M.t).forEach((m) => {
      g.globalAlpha = m.a;
      if (m.type === 'path') {
        m.pts.forEach((p, i) => { if (i) seg(P(m.pts[i - 1].x, 0.012, m.pts[i - 1].z), P(p.x, 0.012, p.z), m.w, m.color); });
        const a = m.pts[m.pts.length - 2], b = m.pts[m.pts.length - 1];
        const va = view(a.x, 0.012, a.z), vb = view(b.x, 0.012, b.z);
        if (-va.z >= NEAR && -vb.z >= NEAR) {
          const sa = scr(va), sb = scr(vb), ang = Math.atan2(sb.y - sa.y, sb.x - sa.x), r = Math.max(6, (0.35 * f) / sb.d);
          g.fillStyle = m.color; g.beginPath(); g.moveTo(sb.x + Math.cos(ang) * r, sb.y + Math.sin(ang) * r);
          g.lineTo(sb.x + Math.cos(ang + 2.4) * r, sb.y + Math.sin(ang + 2.4) * r); g.lineTo(sb.x + Math.cos(ang - 2.4) * r, sb.y + Math.sin(ang - 2.4) * r); g.fill();
        }
      } else {
        const v = view(m.x, 0.02, m.z);
        if (-v.z >= NEAR) {
          const q = scr(v), px = BV.clamp((m.size * f) / q.d, 10, 64);
          g.font = `700 ${px}px "Barlow Condensed", Arial, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
          g.lineWidth = px * 0.14; g.strokeStyle = 'rgba(0,0,0,.5)'; g.strokeText(m.text, q.x, q.y);
          g.fillStyle = m.color || '#fff'; g.fillText(m.text, q.x, q.y); g.textAlign = 'left'; g.textBaseline = 'alphabetic';
        }
      }
      g.globalAlpha = 1;
    });
    // objetos ordenados por distancia a la cámara (los lejanos primero)
    const items = [];
    const figs = Object.values(tl.figs).concat(tl.rivals, tl.server ? [tl.server] : []).filter((fg) => fg.root.visible !== false);
    figs.forEach((fg) => {
      const w = new THREE.Vector3(); fg.hips.getWorldPosition(w);
      shadow(fg.root.position.x, fg.root.position.z, 0.32 * fg.s);
      items.push({ d: w.distanceTo(camPos), draw: () => drawFig(fg) });
    });
    const net = tl.net;
    items.push({ d: P(0, net / 2, 0).distanceTo(camPos) + 0.01, draw: () => {
      [-5.1, 5.1].forEach((z) => seg(P(0, 0, z), P(0, net + 0.1, z), 0.1, '#9aa4b2'));
      poly([[0, net - 1, -4.75], [0, net, -4.75], [0, net, 4.75], [0, net - 1, 4.75]], 'rgba(15,15,15,.35)');
      for (let z = -4.5; z <= 4.5; z += 0.5) seg(P(0, net - 1, z), P(0, net, z), 0.012, 'rgba(10,10,10,.75)');
      for (let y = net - 1; y <= net; y += 0.25) seg(P(0, y, -4.75), P(0, y, 4.75), 0.012, 'rgba(10,10,10,.75)');
      seg(P(0, net - 0.035, -4.75), P(0, net - 0.035, 4.75), 0.07, '#ffffff');
      [-4.5, 4.5].forEach((z) => seg(P(0, net - 1, z), P(0, net + 0.8, z), 0.025, '#ff3b3b'));
    } });
    if (M.ball.visible) {
      const b = M.ball.position;
      shadow(b.x, b.z, 0.12);
      items.push({ d: b.distanceTo(camPos), draw: () => dot(b, 0.105, '#f4c01b', '#1c4fd0') });
    }
    items.sort((a, b) => b.d - a.d).forEach((it) => it.draw());

    function drawFig(fg) {
      const s = fg.s, c = fg.css, wp = (obj, x, y, z) => obj.localToWorld(P(x, y, z));
      const hip = wp(fg.hips, 0, 0, 0), neck = wp(fg.torso, 0, 0.56 * s, 0), head = wp(fg.torso, 0, 0.72 * s, 0);
      const limbs = [];
      fg.legs.forEach((lg) => {
        const top = wp(lg.thigh, 0, 0, 0), knee = wp(lg.knee, 0, 0, 0), foot = wp(lg.knee, 0, -0.45 * s, 0), toe = wp(lg.knee, 0.14 * s, -0.47 * s, 0);
        limbs.push({ d: knee.distanceTo(camPos), draw: () => { seg(top, knee, 0.14 * s, c.skin); seg(knee, foot, 0.11 * s, c.skin); seg(foot, toe, 0.09 * s, c.shoe); } });
      });
      [fg.armL, fg.armR].forEach((arm) => {
        const sh = wp(arm, 0, 0, 0), elbow = wp(arm, 0, -0.3 * s, 0), hand = wp(arm, 0, -0.62 * s, 0);
        limbs.push({ d: elbow.distanceTo(camPos), draw: () => { seg(sh, elbow, 0.1 * s, c.shirt); seg(elbow, hand, 0.085 * s, c.skin); } });
      });
      const torsoD = hip.distanceTo(camPos);
      limbs.push({ d: torsoD, draw: () => {
        const l = wp(fg.hips, 0, 0.02 * s, -0.12 * s), r = wp(fg.hips, 0, 0.02 * s, 0.12 * s);
        seg(l, r, 0.2 * s, c.shorts);
        seg(wp(fg.torso, 0, 0.05 * s, 0), neck, 0.36 * s, c.shirt);
        dot(head, 0.115 * s, c.skin);
        dot(wp(fg.torso, 0, 0.78 * s, 0), 0.08 * s, c.hair);
      } });
      limbs.sort((a, b) => b.d - a.d).forEach((x) => x.draw());
      if (fg.labelText) {
        const v = view(head.x, head.y + 0.42 * s, head.z);
        if (-v.z >= NEAR) {
          const q = scr(v);
          g.font = '700 14px "Barlow Condensed", Arial, sans-serif';
          const tw = g.measureText(fg.labelText).width + 12;
          g.fillStyle = 'rgba(8,14,26,.8)'; roundRect(g, q.x - tw / 2, q.y - 11, tw, 20, 6); g.fill();
          g.fillStyle = '#fff'; g.textAlign = 'center'; g.fillText(fg.labelText, q.x, q.y + 4); g.textAlign = 'left';
        }
      }
    }
  }

  /* ================= textos sobre el video ================= */
  function wrap(g, text, x, y, maxW, lh) {
    const words = text.split(' '); let line = '', yy = y;
    words.forEach((w) => { const test = line ? line + ' ' + w : w; if (g.measureText(test).width > maxW && line) { g.fillText(line, x, yy); line = w; yy += lh; } else line = test; });
    if (line) g.fillText(line, x, yy);
    return yy;
  }
  function setCap(html) { if (M.capTxt !== html) { M.capTxt = html; M.capEl.innerHTML = html; } }
  function overlay(t, T = t, fz = null) {
    const g = M.ctx, tl = M.tl;
    const curTxt = tl.texts.filter((x) => t >= x.t0 && t <= x.t1).pop();
    setCap(t < tl.intro ? `<b>${esc(KINDS[M.kind])}</b>` : t >= tl.outroAt ? `<b>Keys:</b> ${esc(KEYS[M.kind].join(' '))}`
      : curTxt ? `<b>Step ${curTxt.step}.</b> ${esc(curTxt.cap)}${curTxt.tip ? `<br><span class="note">${esc(curTxt.tip)}</span>` : ''}${curTxt.badge ? `<br><span class="note">${esc(curTxt.badge)}</span>` : ''}` : '');
    if (M.renderer) {
      if (fz) g.filter = 'saturate(0.72) contrast(1.06)'; // en el congelado la imagen se apaga un poco y resalta el dibujo
      g.drawImage(M.renderer.domElement, 0, 0, W, H);
      g.filter = 'none';
      acabado(g);
    }
    g.textBaseline = 'alphabetic';
    // marca
    g.font = '700 18px "Barlow Condensed", Arial, sans-serif'; g.fillStyle = 'rgba(255,255,255,.85)';
    g.fillText('BIOVOLEY LAB · VIDEO 3D', 22, 32);
    if (M.soft) { g.font = '600 13px Barlow, Arial, sans-serif'; g.fillStyle = 'rgba(255,255,255,.6)'; g.fillText('Compatibility mode (no graphics acceleration)', W - 270, 32); }
    // tarjeta de título
    if (t < tl.intro) {
      const a = t < tl.intro - 0.5 ? 1 : (tl.intro - t) / 0.5;
      g.fillStyle = `rgba(8,14,26,${0.7 * a})`; g.fillRect(0, 0, W, H);
      g.globalAlpha = a; g.fillStyle = '#f4c01b'; g.font = '700 54px "Barlow Condensed", Arial, sans-serif'; g.textAlign = 'center';
      g.fillText(KINDS[M.kind].toUpperCase(), W / 2, H / 2 - 8);
      g.fillStyle = '#dfe6f6'; g.font = '500 24px Barlow, Arial, sans-serif';
      g.fillText(`${BV.data.team} · net at ${fmt(tl.net, 2)} m${tl.script.rot ? ' · ' + tl.script.rot : ''}`, W / 2, H / 2 + 34);
      g.textAlign = 'left'; g.globalAlpha = 1;
      return;
    }
    // tarjeta final
    if (t >= tl.outroAt) {
      const a = clamp01((t - tl.outroAt) / 0.6);
      g.fillStyle = `rgba(8,14,26,${0.78 * a})`; g.fillRect(0, 0, W, H);
      g.globalAlpha = a;
      g.fillStyle = '#f4c01b'; g.font = '700 40px "Barlow Condensed", Arial, sans-serif'; g.fillText('KEYS OF THE PLAY', 70, 120);
      g.font = '500 25px Barlow, Arial, sans-serif'; g.fillStyle = '#ffffff';
      let y = 175;
      KEYS[M.kind].forEach((k) => { g.fillStyle = '#f4c01b'; g.fillText('●', 70, y); g.fillStyle = '#fff'; y = wrap(g, k, 100, y, W - 170, 32) + 46; });
      g.globalAlpha = 1;
      return;
    }
    if (M.real) estela(g, tl, t);
    if (fz && M.real) telestrar(g, tl, fz, T);
    carteles(g, tl, t, T, fz);
    // subtítulo del paso actual
    const cur = fz ? null : tl.texts.filter((x) => t >= x.t0 && t <= x.t1).pop();
    if (fz) { g.fillStyle = '#7fe3ff'; g.font = '700 18px "Barlow Condensed", Arial, sans-serif'; g.fillText('■ FREEZE FRAME', 22, 58); }
    if (cur) {
      // medir cuántas líneas ocupan el subtítulo y el consejo para dimensionar la caja
      const lines = (txt, font, maxW) => { g.font = font; let n = 1, line = ''; txt.split(' ').forEach((w) => { const tt = line ? line + ' ' + w : w; if (g.measureText(tt).width > maxW && line) { n++; line = w; } else line = tt; }); return n; };
      const fCap = '600 22px Barlow, Arial, sans-serif', fTip = '400 18px Barlow, Arial, sans-serif';
      const nCap = lines(cur.cap, fCap, W - 170), nTip = cur.tip ? lines(cur.tip, fTip, W - 80) : 0;
      const boxH = 30 + nCap * 26 + (nTip ? 8 + nTip * 22 : 0) + 10;
      const top = H - 12 - boxH;
      g.fillStyle = 'rgba(8,14,26,.66)'; roundRect(g, 20, top, W - 40, boxH, 12); g.fill();
      g.fillStyle = '#f4c01b'; g.font = '700 22px "Barlow Condensed", Arial, sans-serif'; g.fillText(`STEP ${cur.step}`, 38, top + 32);
      g.fillStyle = '#fff'; g.font = fCap; const yEnd = wrap(g, cur.cap, 120, top + 32, W - 170, 26);
      if (cur.tip) { g.fillStyle = '#b9c6de'; g.font = fTip; wrap(g, cur.tip, 38, yEnd + 30, W - 80, 22); }
      if (cur.badge) {
        g.font = '600 18px Barlow, Arial, sans-serif';
        const dato = cur.badge.charAt(0).toUpperCase() + cur.badge.slice(1);
        const w = g.measureText(dato).width + 28;
        g.fillStyle = 'rgba(28,79,208,.92)'; roundRect(g, W - w - 22, 18, w, 38, 10); g.fill();
        g.fillStyle = '#fff'; g.fillText(dato, W - w - 8, 43);
      }
      const ritmo = velocidad(tl, T);
      if (fz || ritmo < 0.99) { g.fillStyle = fz ? '#7fe3ff' : '#ff6b6b'; g.font = '700 18px "Barlow Condensed", Arial, sans-serif'; g.fillText(fz ? '■ FREEZE FRAME' : '● SLOW MOTION', 22, 58); }
    }
  }

  /* ================= dirección: cámara lenta, congelados y telestración ================= */
  const ACCION = {
    pass: { nombre: 'RECEPTION', color: '#1baf7a', pista: 'Forearm pass · legs push' },
    set: { nombre: 'SET', color: '#8b7bff', pista: 'Overhead pass · hands above the forehead' },
    spike: { nombre: 'ATTACK', color: '#ff7a3d', pista: 'Spike · high elbow, top contact' },
    land: { nombre: 'LANDING', color: '#2fc3d6', pista: 'Two feet · knees bent' },
    saque: { nombre: 'SERVE', color: '#3a86ff', pista: 'Overhand serve · straight arm' },
    saqueRival: { nombre: 'SERVE', color: '#9aa4b8', pista: 'Rival serve' },
    block: { nombre: 'BLOCK', color: '#ff4d6d', pista: 'Rival block · hands over the net' },
    dig: { nombre: 'DIG', color: '#9aa4b8', pista: 'Rival defense' },
    paseRival: { nombre: 'RECEPTION', color: '#9aa4b8', pista: 'Rival reception' },
    rotate: { nombre: 'ROTATE', color: '#f4c01b', pista: 'Clockwise, one zone each' },
    switch: { nombre: 'SWITCH', color: '#f4c01b', pista: 'Each player to their zone' },
  };
  const RITMO = { pass: { pre: 0.55, post: 0.2, r: 0.4, d: 1.8 }, set: { pre: 0.45, post: 0.15, r: 0.45, d: 1.6 }, spike: { pre: 0.9, post: 0.45, r: 0.3, d: 2.4 }, land: { pre: 0.3, post: 0.25, r: 0.5, d: 1.6 }, saque: { pre: 0.5, post: 0.25, r: 0.4, d: 1.5 } };

  /** arma el mapa tiempo del video → tiempo de la escena con las cámaras lentas y los congelados */
  function dirigir(tl) {
    const nudos = [[0, 0]];
    let T = 0, s = 0;
    const ir = (sNueva, r) => { if (sNueva <= s) return; T += (sNueva - s) / r; s = sNueva; nudos.push([T, s]); };
    tl.beats.sort((a, b) => a.t - b.t).forEach((b, n) => {
      const R = RITMO[b.tipo]; if (!R || b.t <= s) return;
      ir(Math.max(s, b.t - R.pre), 1);
      ir(b.t, R.r);
      b.T0 = T; T += R.d; nudos.push([T, s]); b.T1 = T;
      b.giro = n % 2 ? -1 : 1;
      ir(Math.min(b.t + R.post, tl.total), R.r);
    });
    ir(tl.total, 1);
    tl.mapa = nudos; tl.totalVideo = T;
  }
  function escena(tl, T) {
    const m = tl.mapa; if (!m) return T;
    for (let i = 1; i < m.length; i++) {
      if (T <= m[i][0]) { const [Ta, sa] = m[i - 1], [Tb, sb] = m[i]; return Tb > Ta ? sa + ((T - Ta) / (Tb - Ta)) * (sb - sa) : sb; }
    }
    return m[m.length - 1][1];
  }
  function velocidad(tl, T) {
    const m = tl.mapa; if (!m) return 1;
    for (let i = 1; i < m.length; i++) if (T <= m[i][0]) { const d = m[i][0] - m[i - 1][0]; return d > 0 ? (m[i][1] - m[i - 1][1]) / d : 0; }
    return 1;
  }
  const congelado = (tl, T) => (tl.beats || []).find((b) => b.T0 != null && T >= b.T0 && T <= b.T1) || null;
  const figDe = (tl, pid) => tl.figs[pid] || null;
  const enMundo = (b) => new THREE.Vector3().setFromMatrixPosition(b.matrixWorld);
  /** cámara para explicar el gesto: de lado y a la altura justa, del lado donde nadie tapa */
  function camCongelado(tl, b) {
    if (b.cam) return b.cam;
    const f = figDe(tl, b.pid); if (!f || !f.real) return null;
    f.root.updateMatrixWorld(true);
    const P = f.root.position.clone(), yaw = f.root.rotation.y;
    const frente = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw)), lado = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    const pecho = enMundo(f.h.pecho);
    const C = { pass: [4.2, 1.4, 1.25, 0.82], set: [4.4, 1.6, 1.5, 1.25], spike: [5.0, -0.3, 2.3, 0.95], saque: [4.3, 1.4, 1.8, 1.05], land: [3.9, 1.0, 0.95, 0.62] }[b.tipo] || [4.4, 1, 1.4, 1];
    const look = new THREE.Vector3(pecho.x, P.y + (pecho.y - P.y) * C[3], pecho.z);
    const otros = [...Object.values(tl.figs), ...tl.rivals, ...(tl.server ? [tl.server] : [])].filter((x) => x !== f && x.root.visible);
    // cuenta quién queda entre la cámara y el gesto (a la altura del pecho y de la cabeza)
    const tapan = (pos) => otros.reduce((n, o) => n + [1.1, 1.55].some((h) => {
      const q = o.root.position.clone().add(new THREE.Vector3(0, h, 0)), d = look.clone().sub(pos), t = BV.clamp(q.clone().sub(pos).dot(d) / d.lengthSq(), 0, 1);
      return q.distanceTo(pos.clone().add(d.multiplyScalar(t))) < 0.55;
    }), 0) + otros.filter((o) => Math.hypot(o.root.position.x - pos.x, o.root.position.z - pos.z) < 2.2).length // nadie pegado a la cámara
      + (Math.sign(pos.x || 1) !== Math.sign(P.x || -1) ? 10 : 0); // nunca del otro lado de la red
    const opciones = [1, -1].map((sg) => {
      const pos = P.clone().add(lado.clone().multiplyScalar(sg * C[0])).add(frente.clone().multiplyScalar(C[1]));
      pos.y = C[2]; pos.x = BV.clamp(pos.x, -23, 23); pos.z = BV.clamp(pos.z, -14, 14);
      return { pos, n: tapan(pos) };
    }).sort((a, b2) => a.n - b2.n);
    b.cam = { pos: opciones[0].pos, look };
    return b.cam;
  }
  function foco3d(tl, b) {
    const f = figDe(tl, b.pid); if (!f || !f.real) return null;
    f.root.updateMatrixWorld(true);
    return enMundo(f.h.pecho);
  }
  const proy = (v) => { const p = v.clone().project(M.cam); return { x: ((p.x + 1) / 2) * W, y: ((1 - p.y) / 2) * H, z: p.z }; };
  /** ángulo de flexión en una articulación: 180° menos el ángulo entre los dos segmentos */
  const flexion = (a, b, c) => { const u = a.clone().sub(b).normalize(), v = c.clone().sub(b).normalize(); return 180 - (Math.acos(BV.clamp(u.dot(v), -1, 1)) * 180) / Math.PI; };

  function anillo(tl, t, T) {
    if (!M.anillo) {
      if (!M.renderer || !M.real) return;
      const m = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.56, 48), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
      m.rotation.x = -Math.PI / 2; m.renderOrder = 3; M.scene.add(m); M.anillo = m;
    }
    const b = (tl.beats || []).find((x) => t >= x.t - 1.1 && t <= x.t + 0.5);
    const f = b && figDe(tl, b.pid);
    if (!f || !f.real) { M.anillo.visible = false; return; }
    const a = ACCION[b.tipo];
    M.anillo.visible = true; M.anillo.material.color.set(a.color);
    M.anillo.position.set(f.root.position.x, 0.02, f.root.position.z);
    const e = 1 + 0.08 * Math.sin(T * 7);
    M.anillo.scale.set(e, e, 1);
    M.anillo.material.opacity = 0.55 + 0.3 * Math.sin(T * 7);
  }

  let vineta = null;
  function acabado(g) {
    if (!vineta) {
      vineta = lienzo(W, H, (c, w, h) => {
        const r = c.createRadialGradient(w / 2, h * 0.46, h * 0.35, w / 2, h / 2, h * 0.95);
        r.addColorStop(0, 'rgba(0,0,0,0)'); r.addColorStop(1, 'rgba(4,8,20,.55)');
        c.fillStyle = r; c.fillRect(0, 0, w, h);
      });
    }
    g.drawImage(vineta, 0, 0, W, H);
  }

  /** estela del balón: dónde estuvo en las últimas décimas de segundo */
  function estela(g, tl, t) {
    if (tl.ballFrom != null && t < tl.ballFrom + 0.2) return;
    const pts = [];
    for (let k = 0; k <= 14; k++) {
      const tk = t - k * 0.03; if (tk < (tl.segs[0] ? tl.segs[0].t0 - 1.05 : 0)) break;
      const b = ballAt(tl, tk); if (!b) break;
      const p = proy(new THREE.Vector3(b.x, b.y, b.z)); if (p.z > 1) break;
      pts.push(p);
    }
    g.lineCap = 'round';
    for (let k = 1; k < pts.length; k++) {
      const a = 1 - k / pts.length;
      g.strokeStyle = `rgba(255,214,90,${0.55 * a})`; g.lineWidth = 7 * a + 1;
      g.beginPath(); g.moveTo(pts[k - 1].x, pts[k - 1].y); g.lineTo(pts[k].x, pts[k].y); g.stroke();
    }
  }

  let ocupados = [];
  function pastilla(g, x, y, texto, color, alfa = 1) {
    g.save(); g.globalAlpha = alfa;
    g.font = '700 15px "Barlow Condensed", Arial, sans-serif';
    const w = g.measureText(texto).width + 20;
    x = BV.clamp(x, 8, W - w - 8); y = BV.clamp(y, 100, H - 30);
    for (let k = 0; k < 8 && ocupados.some((r) => x < r.x + r.w + 6 && x + w + 6 > r.x && Math.abs(y - r.y) < 30); k++) y += 32;
    ocupados.push({ x, y, w });
    g.fillStyle = 'rgba(6,12,28,.86)'; roundRect(g, x, y - 13, w, 26, 13); g.fill();
    g.strokeStyle = color; g.lineWidth = 1.6; roundRect(g, x, y - 13, w, 26, 13); g.stroke();
    g.fillStyle = '#fff'; g.textBaseline = 'middle'; g.fillText(texto, x + 10, y + 1);
    g.restore();
    return w;
  }
  function trazo(g, a, b, color, ancho, u = 1, discontinuo) {
    g.save(); g.strokeStyle = color; g.lineWidth = ancho; g.lineCap = 'round';
    if (discontinuo) g.setLineDash([6, 6]);
    g.shadowColor = color; g.shadowBlur = 10;
    g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(a.x + (b.x - a.x) * u, a.y + (b.y - a.y) * u); g.stroke();
    g.restore();
  }
  function punto(g, p, color, r = 5) {
    g.save(); g.fillStyle = '#0b1d44'; g.strokeStyle = color; g.lineWidth = 2.5; g.shadowColor = color; g.shadowBlur = 8;
    g.beginPath(); g.arc(p.x, p.y, r, 0, Math.PI * 2); g.fill(); g.stroke(); g.restore();
  }
  /** ángulo dibujado en una articulación con su valor */
  function anguloArt(g, A, B, C, valor, etiqueta, color, u) {
    const a = proy(A), b = proy(B), c = proy(C);
    trazo(g, b, a, color, 4, u); trazo(g, b, c, color, 4, u);
    const a1 = Math.atan2(a.y - b.y, a.x - b.x), a2 = Math.atan2(c.y - b.y, c.x - b.x);
    let d = a2 - a1; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
    g.save(); g.fillStyle = color + '44'; g.strokeStyle = color; g.lineWidth = 2.5;
    g.beginPath(); g.moveTo(b.x, b.y); g.arc(b.x, b.y, 28, a1, a1 + d * u, d < 0); g.closePath(); g.fill(); g.stroke(); g.restore();
    punto(g, a, color, 4); punto(g, b, color, 6); punto(g, c, color, 4);
    const m = a1 + d / 2;
    const lx = b.x - Math.cos(m) * 44 + (Math.cos(m) > 0 ? -150 : 6), ly = b.y - Math.sin(m) * 40;
    pastilla(g, lx, ly, `${etiqueta} ${Math.round(valor)}°`, color, clamp01(u * 1.4));
  }

  /** dibujos sobre la imagen congelada: los ángulos y las claves del gesto, medidos en el cuerpo 3D */
  function telestrar(g, tl, b, T) {
    ocupados = [];
    const f = figDe(tl, b.pid); if (!f || !f.real) return;
    f.root.updateMatrixWorld(true);
    const u = smooth(clamp01((T - b.T0) / 0.55));
    const col = ACCION[b.tipo].color;
    const L = f.L, R = f.R, cam = M.cam.position;
    const rodillaCerca = enMundo(L.pierna).distanceTo(cam) < enMundo(R.pierna).distanceTo(cam) ? L : R;
    const rodilla = (S, txt = 'KNEE') => anguloArt(g, enMundo(S.muslo), enMundo(S.pierna), enMundo(S.pie), flexion(enMundo(S.muslo), enMundo(S.pierna), enMundo(S.pie)), txt, '#f4c01b', u);
    const medio = (x, y) => x.clone().add(y).multiplyScalar(0.5);
    if (b.tipo === 'pass') {
      rodilla(rodillaCerca);
      const e = proy(medio(enMundo(L.ante), enMundo(R.ante))), m = proy(medio(enMundo(L.mano), enMundo(R.mano)));
      const fin = { x: m.x + (m.x - e.x) * 0.6, y: m.y + (m.y - e.y) * 0.6 }, ini = { x: e.x - (m.x - e.x) * 0.3, y: e.y - (m.y - e.y) * 0.3 };
      trazo(g, ini, fin, col, 7, u);
      pastilla(g, fin.x + 10, fin.y, 'PLATFORM · arms straight', col, u);
      const cad = proy(medio(enMundo(L.muslo), enMundo(R.muslo)));
      trazo(g, { x: cad.x - 70, y: cad.y + 30 }, { x: cad.x - 70, y: cad.y - 40 }, '#ffffff', 3, u);
      pastilla(g, cad.x - 180, cad.y - 52, 'LEGS PUSH UP', '#ffffff', u);
    } else if (b.tipo === 'set') {
      rodilla(rodillaCerca);
      const m = proy(medio(enMundo(L.mano), enMundo(R.mano))), cab = proy(enMundo(f.h.cabeza).add(new THREE.Vector3(0, 0.1 * f.s, 0)));
      g.save(); g.strokeStyle = col; g.lineWidth = 3; g.shadowColor = col; g.shadowBlur = 10;
      g.beginPath(); g.arc(m.x, m.y, 30, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * u); g.stroke(); g.restore();
      trazo(g, cab, m, col, 2, u, true);
      pastilla(g, m.x + 36, m.y - 6, 'HANDS ABOVE THE FOREHEAD', col, u);
      pastilla(g, m.x + 36, m.y + 24, 'EXTEND ARMS + LEGS', '#ffffff', u);
    } else if (b.tipo === 'spike' || b.tipo === 'saque') {
      const S = f.lefty ? L : R;
      anguloArt(g, enMundo(S.brazo), enMundo(S.ante), enMundo(S.mano), 180 - flexion(enMundo(S.brazo), enMundo(S.ante), enMundo(S.mano)), 'ARM', col, u);
      const bl = ballAt(tl, escena(tl, T));
      if (bl && b.tipo === 'spike') {
        const p = proy(new THREE.Vector3(bl.x, bl.y, bl.z)), red = proy(new THREE.Vector3(0, tl.net, bl.z)), pie = proy(new THREE.Vector3(bl.x, 0, bl.z));
        trazo(g, p, { x: red.x, y: p.y }, '#ffffff', 2, u, true);
        trazo(g, pie, p, 'rgba(255,255,255,.5)', 2, u, true);
        pastilla(g, p.x + 16, p.y - 22, `CONTACT ${fmt(bl.y, 2)} m`, col, u);
        pastilla(g, red.x + 10, red.y + 22, `NET ${fmt(tl.net, 2)} m · +${fmt((bl.y - tl.net) * 100, 0)} cm`, '#ffffff', u);
      } else if (b.tipo === 'saque') {
        const m = proy(enMundo(S.mano));
        pastilla(g, m.x + 20, m.y - 10, 'HIT AT THE HIGHEST POINT', col, u);
      }
      // bloqueo rival: manos por encima de la red
      (M.bloqueadores || []).slice(0, 2).forEach((i, n) => {
        const r = tl.rivals[i]; if (!r || !r.real) return;
        r.root.updateMatrixWorld(true);
        const m = proy(medio(enMundo(r.L.mano), enMundo(r.R.mano)));
        g.save(); g.strokeStyle = ACCION.block.color; g.lineWidth = 3; g.shadowColor = ACCION.block.color; g.shadowBlur = 10;
        g.beginPath(); g.arc(m.x, m.y, 24, 0, Math.PI * 2 * u); g.stroke(); g.restore();
        if (!n) pastilla(g, m.x + 30, m.y - 36, 'BLOCK · hands over the net', ACCION.block.color, u);
      });
    } else if (b.tipo === 'land') {
      rodilla(L, 'LEFT KNEE'); rodilla(R, 'RIGHT KNEE');
      const pi = proy(medio(enMundo(L.pie), enMundo(R.pie)));
      pastilla(g, pi.x - 70, pi.y + 34, 'TWO-FOOT LANDING', col, u);
    }
  }

  /** carteles de cada acción, como en una transmisión deportiva */
  function carteles(g, tl, t, T, fz) {
    const lista = [];
    (tl.beats || []).forEach((b) => lista.push({ t0: b.t - 0.75, t1: b.t + 0.6, tipo: b.tipo, pid: b.pid, fila: 0, fz: fz === b }));
    (tl.carteles || []).forEach((c) => lista.push(c));
    const vivos = [];
    lista.forEach((c) => { if (c.fz || (t >= c.t0 && t <= c.t1)) vivos[c.fila || 0] = vivos[c.fila || 0] || c; });
    vivos.forEach((c, fila) => {
      if (!c) return;
      const a = ACCION[c.tipo]; if (!a) return;
      const u = c.fz ? 1 : smooth(clamp01((t - c.t0) / 0.25)) * smooth(clamp01((c.t1 - t) / 0.25));
      const p = c.pid ? BV.player(c.pid) : null;
      const quien = p ? `${p.name.split(' ')[0]} · ` : '';
      const y = 74 + fila * 66, x = 22 - (1 - u) * 40;
      g.save(); g.globalAlpha = u;
      g.font = '800 30px "Barlow Condensed", Arial, sans-serif';
      const w1 = g.measureText(a.nombre).width;
      g.font = '600 14px Barlow, Arial, sans-serif';
      const sub = quien + a.pista, w2 = g.measureText(sub).width;
      const w = Math.max(w1, w2) + 34;
      g.fillStyle = 'rgba(6,12,28,.84)'; roundRect(g, x, y, w, 56, 10); g.fill();
      g.fillStyle = a.color; g.fillRect(x, y + 8, 5, 40);
      g.fillStyle = '#fff'; g.font = '800 30px "Barlow Condensed", Arial, sans-serif'; g.fillText(a.nombre, x + 18, y + 31);
      g.fillStyle = a.color; g.font = '600 14px Barlow, Arial, sans-serif'; g.fillText(sub, x + 18, y + 48);
      if (c.fz) {
        const v = clamp01((T - fz.T0) / (fz.T1 - fz.T0));
        g.fillStyle = 'rgba(255,255,255,.2)'; g.fillRect(x + 18, y + 52, w - 36, 2);
        g.fillStyle = a.color; g.fillRect(x + 18, y + 52, (w - 36) * v, 2);
      }
      g.restore();
    });
    // destello al congelar
    if (fz) { const k = (T - fz.T0) / 0.25; if (k < 1) { g.fillStyle = `rgba(255,255,255,${0.35 * (1 - k)})`; g.fillRect(0, 0, W, H); } }
  }

  /* ================= reproducción y grabación ================= */
  /** en computadores modestos baja la calidad antes de que el video se trabe */
  function medirFluidez(s) {
    M.fps = M.fps || { n: 0, suma: 0, nivel: 0 };
    const F = M.fps;
    F.n++; F.suma += s;
    if (F.n < 45) return;
    const lento = F.suma / F.n > 1 / 18;
    F.n = 0; F.suma = 0;
    if (!lento || F.nivel >= 2) return;
    F.nivel++;
    if (F.nivel === 1 && M.sol) M.sol.castShadow = false; // las sombras de contacto se quedan
    if (F.nivel === 2) M.renderer.setSize(W, H, false);
  }

  function loop() {
    if (M.raf) return;
    let last = performance.now();
    const step = (now) => {
      M.raf = 0;
      if (M.root.hidden || !M.tl) return;
      const crudo = (now - last) / 1000;
      const dt = Math.min(0.1, crudo); last = now;
      if (M.real && M.playing && !M.rec) medirFluidez(crudo);
      if (M.playing) {
        M.t += dt * (M.rec ? 1 : M.speed);
        if (M.t >= M.total) { M.t = M.total; M.playing = false; if (M.rec) stopRecording(false); }
      }
      draw(); syncUi();
      if (M.playing) M.raf = requestAnimationFrame(step);
    };
    M.raf = requestAnimationFrame(step);
  }

  function startRecording() {
    if (!M.tl || !window.MediaRecorder || !M.out.captureStream) { BV.toast('This browser cannot record video. Use Chrome.'); return; }
    const types = ['video/mp4;codecs=avc1', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
    const mime = types.find((m) => MediaRecorder.isTypeSupported(m));
    if (!mime) { BV.toast('This browser cannot record video.'); return; }
    const chunks = [];
    const rec = new MediaRecorder(M.out.captureStream(30), { mimeType: mime, videoBitsPerSecond: 6e6 });
    rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
    rec.onstop = () => {
      if (M.recCancel) { M.recCancel = false; return; }
      const ext = mime.includes('mp4') ? 'mp4' : 'webm';
      BV.download(`biovoley-${M.kind}-${BV.today()}.${ext}`, new Blob(chunks, { type: mime.split(';')[0] }));
    };
    M.rec = rec; M.recCancel = false;
    M.t = 0; M.playing = true;
    rec.start(250);
    const b = M.root.querySelector('.vrec'); b.textContent = 'Stop recording'; b.classList.remove('btn-ball'); b.classList.add('btn-danger');
    syncUi(); loop();
  }
  function stopRecording(cancel) {
    if (!M.rec) return;
    M.recCancel = !!cancel;
    try { M.rec.stop(); } catch (e) { /* ya detenida */ }
    M.rec = null;
    const b = M.root.querySelector('.vrec'); b.textContent = 'Save as video'; b.classList.add('btn-ball'); b.classList.remove('btn-danger');
    if (cancel) BV.toast('Recording canceled');
  }

  BV.video3d = { open, close, KINDS, _seek: (t) => { if (M && M.tl) { M.playing = false; M.t = t; draw(); syncUi(); } }, _state: () => M };
})(window.BV);
