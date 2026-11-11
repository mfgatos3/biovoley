/* BioVoley Lab — Cámara: análisis de técnica, postura y salto
   Detección de postura: MediaPipe Pose Landmarker (33 puntos, 2D + 3D).
   Todo se procesa en el dispositivo; el video no se envía a ningún servidor. */
(function (BV) {
  'use strict';
  const { $, esc, fmt, chip } = BV;
  const MP = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14';
  // primero la copia incluida en vendor/mediapipe/; si no está (o se abre como archivo), la de internet
  const LOCAL = (() => { try { return new URL('vendor/mediapipe/', document.baseURI).href; } catch (e) { return null; } })();
  const SOURCES = [
    LOCAL && location.protocol.startsWith('http') ? { bundle: LOCAL + 'vision_bundle.js', wasm: LOCAL + 'wasm', model: (k) => `${LOCAL}pose_landmarker_${k}.task` } : null,
    { bundle: MP + '/vision_bundle.mjs', wasm: MP + '/wasm', model: (k) => MODELS[k] },
  ].filter(Boolean);
  const MODELS = {
    lite: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
    full: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task',
  };
  const EDGES = [[11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23], [12, 24], [23, 24], [23, 25], [25, 27], [24, 26], [26, 28], [27, 29], [29, 31], [27, 31], [28, 30], [30, 32], [28, 32]];
  const REC = {
    n30: { step: 1 / 30, slow: 1, label: 'Normal · 30 fps' },
    n60: { step: 1 / 60, slow: 1, label: 'Normal · 60 fps' },
    s120: { step: 1 / 30, slow: 4, label: 'Slow motion 120 fps (×4)' },
    s240: { step: 1 / 30, slow: 8, label: 'Slow motion 240 fps (×8)' },
  };

  /* archivo único (VioBolley.html): MediaPipe viene dentro del HTML, comprimido; se descomprime al usarlo */
  let embWasm = null, embModel = null;
  async function unpack(id) {
    const el = document.getElementById(id);
    if (!el) return null;
    const bin = atob(el.textContent.trim());
    const u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    const stream = new Blob([u8]).stream().pipeThrough(new DecompressionStream('gzip'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }
  async function fromEmbedded(kind) {
    embWasm = embWasm || (await unpack('emb-mp-wasm'));
    embModel = embModel || (await unpack('emb-mp-model'));
    if (!embWasm || !embModel) throw new Error('This file does not include MediaPipe');
    const create = (delegate) => {
      // MediaPipe borra estos globales después de cada uso
      self.ModuleFactory = window.MPFactory; self.Module = { wasmBinary: embWasm };
      return window.MPVision.PoseLandmarker.createFromOptions({ wasmLoaderPath: '', wasmBinaryPath: 'vision.wasm' }, {
        baseOptions: kind === 'lite' ? { modelAssetBuffer: embModel.slice(), delegate } : { modelAssetPath: MODELS[kind], delegate },
        runningMode: 'VIDEO', numPoses: 1, minPoseDetectionConfidence: 0.5, minPosePresenceConfidence: 0.5, minTrackingConfidence: 0.5,
      });
    };
    try { return await create('GPU'); } catch (e) { return await create('CPU'); }
  }

  // el modelo se conserva entre visitas a la sección
  const pose = { model: null, kind: null, loading: null, error: null };
  let st = null;

  const V = {
    title: 'Camera', nav: 'Camera',
    sub: 'Jump, knee angle and posture',
    tags: ['tec', 'ef', 'mat'],
  };

  /* ---------- geometría ---------- */
  function ang3(a, b, c) {
    const v1 = [a.x - b.x, a.y - b.y, (a.z || 0) - (b.z || 0)], v2 = [c.x - b.x, c.y - b.y, (c.z || 0) - (b.z || 0)];
    const d = v1[0] * v2[0] + v1[1] * v2[1] + v1[2] * v2[2];
    const n = Math.hypot(...v1) * Math.hypot(...v2);
    return n ? (Math.acos(BV.clamp(d / n, -1, 1)) * 180) / Math.PI : NaN;
  }
  const ang2 = (a, b, c) => ang3({ x: a.x, y: a.y }, { x: b.x, y: b.y }, { x: c.x, y: c.y });

  /** Métricas biomecánicas a partir de los puntos normalizados (lm) y 3D en metros (w) */
  function metrics(lm, w, vw, vh, hitSide) {
    const P = (i) => ({ x: lm[i].x * vw, y: lm[i].y * vh });
    const Wp = (i) => (w ? w[i] : { x: lm[i].x * vw / vh, y: lm[i].y, z: lm[i].z || 0 });
    const A = (a, b, c) => ang3(Wp(a), Wp(b), Wp(c));
    const m = {};
    m.vis = (idx) => idx.every((i) => (lm[i].visibility ?? 1) > 0.5);
    m.kneeIntL = A(23, 25, 27); m.kneeIntR = A(24, 26, 28);
    m.kneeFlexL = 180 - m.kneeIntL; m.kneeFlexR = 180 - m.kneeIntR;
    m.kneeFlex = (m.kneeFlexL + m.kneeFlexR) / 2;
    m.kneeAsym = Math.abs(m.kneeFlexL - m.kneeFlexR);
    m.hipFlex = 180 - (A(11, 23, 25) + A(12, 24, 26)) / 2;
    m.elbowL = A(11, 13, 15); m.elbowR = A(12, 14, 16);
    m.elbowMin = Math.min(m.elbowL, m.elbowR); m.elbowMean = (m.elbowL + m.elbowR) / 2;
    m.elbowAsym = Math.abs(m.elbowL - m.elbowR);
    m.shElevL = A(13, 11, 23); m.shElevR = A(14, 12, 24);
    m.shElevMean = (m.shElevL + m.shElevR) / 2;
    // tronco: ángulo entre (cadera→hombros) y la vertical, en 3D
    const s = Wp(11), s2 = Wp(12), h = Wp(23), h2 = Wp(24);
    const v = [(s.x + s2.x - h.x - h2.x) / 2, (s.y + s2.y - h.y - h2.y) / 2, ((s.z || 0) + (s2.z || 0) - (h.z || 0) - (h2.z || 0)) / 2];
    m.trunk = (Math.acos(BV.clamp(-v[1] / (Math.hypot(...v) || 1), -1, 1)) * 180) / Math.PI;
    // medidas frontales en la imagen
    const shW = Math.abs(P(11).x - P(12).x);
    const ankW = Math.abs(P(27).x - P(28).x);
    const kneeW = Math.abs(P(25).x - P(26).x);
    const torso = Math.hypot((P(11).x + P(12).x - P(23).x - P(24).x) / 2, (P(11).y + P(12).y - P(23).y - P(24).y) / 2);
    m.viewAuto = torso && shW / torso > 0.42 ? 'frontal' : 'lateral';
    m.stance = shW ? ankW / shW : NaN;
    m.kasr = ankW > shW * 0.35 ? kneeW / ankW : NaN;
    m.handsW = shW ? Math.abs(P(15).x - P(16).x) / shW : NaN;
    const noseY = P(0).y, eyeY = (P(2).y + P(5).y) / 2, shY = (P(11).y + P(12).y) / 2;
    m.wristsAboveNose = (P(15).y < noseY) + (P(16).y < noseY);
    const eyeLine = eyeY + 0.35 * (shY - eyeY);
    m.wristsAboveEyes = (P(15).y < eyeLine) + (P(16).y < eyeLine);
    // brazo de golpeo
    const H = hitSide === 'L' ? { s: 11, e: 13, w: 15, hp: 23, os: 12, ow: 16 } : { s: 12, e: 14, w: 16, hp: 24, os: 11, ow: 15 };
    m.hitIdx = [H.s, H.e, H.w];
    m.hitShElev = A(H.e, H.s, H.hp);
    m.hitElbow = A(H.s, H.e, H.w);
    m.hitWristAbove = P(H.w).y < noseY;
    m.hitWristY = lm[H.w].y;
    m.hitShY = lm[H.s].y;
    m.offWristUp = P(H.ow).y < P(H.os).y;
    // pie adelantado (más cerca de la cámara en 3D) — asume que la persona mira a la cámara
    const zL = Wp(27).z || 0, zR = Wp(28).z || 0;
    m.fwdFoot = Math.abs(zL - zR) < 0.06 ? null : zL < zR ? 'L' : 'R';
    m.footOk = m.fwdFoot ? m.fwdFoot !== hitSide : false;
    // para el detector de salto
    m.ankleY = (lm[27].y + lm[28].y) / 2;
    m.legLen = ((lm[27].y + lm[28].y) - (lm[23].y + lm[24].y)) / 2;
    m.kneeVisible = m.vis([23, 24, 25, 26, 27, 28]);
    return m;
  }

  function evalChecks(g, m, view) {
    return g.checks.map((c) => {
      const r = { c, level: 'na', value: '—', cue: '' };
      const vis = c.hit ? m.hitIdx : c.vis;
      if (c.need && view !== c.need) { r.cue = `Requires view ${c.need}.`; return r; }
      if (vis && !m.vis(vis)) { r.cue = 'Points not visible: step back or frame the whole body.'; return r; }
      if (c.only && !c.only(m)) { r.cue = 'Evaluated when the hand is above the head.'; return r; }
      const v = c.get(m);
      if (v === undefined || (typeof v === 'number' && !Number.isFinite(v))) { r.cue = 'No data in this frame.'; return r; }
      r.value = c.fmt ? c.fmt(v) : String(v);
      r.level = c.eval(v);
      r.cue = (c.cue && (c.cue[r.level] || c.cue.ok)) || '';
      if (r.level === 'info') r.cue = c.cue.info;
      return r;
    });
  }

  /* ---------- carga del modelo ---------- */
  async function ensurePose(kind) {
    if (pose.model && pose.kind === kind) return pose.model;
    if (pose.loading && pose.kind === kind) return pose.loading;
    pose.kind = kind; pose.error = null; pose.model = null;
    if (BV.inClaude()) { setModelState('error'); return null; }
    setModelState('loading');
    pose.loading = (async () => {
      let last = null;
      if (window.MPVision) { try { return await fromEmbedded(kind); } catch (e) { last = e; console.warn('Bundled MediaPipe did not load', e); } }
      for (const src of SOURCES) {
        try {
          const vision = await import(src.bundle);
          const files = await vision.FilesetResolver.forVisionTasks(src.wasm);
          const opts = (delegate) => ({
            baseOptions: { modelAssetPath: src.model(kind), delegate }, runningMode: 'VIDEO', numPoses: 1,
            minPoseDetectionConfidence: 0.5, minPosePresenceConfidence: 0.5, minTrackingConfidence: 0.5,
          });
          try { return await vision.PoseLandmarker.createFromOptions(files, opts('GPU')); }
          catch (e) { return await vision.PoseLandmarker.createFromOptions(files, opts('CPU')); }
        } catch (e) { last = e; console.warn('MediaPipe did not load from', src.bundle, e); }
      }
      throw last || new Error('MediaPipe unavailable');
    })();
    try {
      const mdl = await pose.loading;
      if (pose.kind === kind) pose.model = mdl;
      setModelState('ready');
      return mdl;
    } catch (e) {
      console.error(e);
      pose.error = e; pose.loading = null;
      setModelState('error');
      return null;
    }
  }
  function setModelState(s) {
    if (!st) return;
    const el = $('#mdlState');
    if (!el) return;
    el.className = 'st ' + (s === 'ready' ? 'st-ok' : s === 'error' ? 'st-crit' : 'st-na');
    el.textContent = s === 'ready' ? 'Pose model ready' : s === 'error' ? (BV.inClaude() ? 'Automatic detection unavailable here' : 'Model unavailable (vendor/ missing and no internet)') : 'Loading pose model…';
  }

  /* ---------- vista ---------- */
  V.render = function (el, arg) {
    const D = BV.data;
    const firstPlayer = BV.players()[0];
    st = {
      gesture: BV.GESTOS.some((g) => g.id === arg) ? arg : 'salto',
      pid: firstPlayer ? firstPlayer.id : '', hit: firstPlayer && firstPlayer.hand === 'Z' ? 'L' : 'R',
      viewMode: 'auto', modelKind: 'lite', poseOn: true, detectJumps: true,
      source: 'none', facing: 'environment', mirror: false, stream: null, url: null,
      raf: 0, lastVT: -1, lastTs: 0, lm: null, w: null, m: null, view: 'frontal', checks: [],
      lastUi: 0, measuring: false, mpts: [], mark: { to: null, land: null }, rec: 'n30',
      jd: { phase: 'ground', hist: [], base: null, toT: 0, prepFlex: 0, post: null, tPrev: 0 },
      shot: null, lastShot: null, result: null, results: [],
    };
    el.innerHTML = `
    <div class="grid g-side">
      <div class="stack">
        <div class="card stack">
          <div class="row between">
            <div class="row">
              <button class="btn btn-primary" id="btnCam" type="button"><svg viewBox="0 0 24 24"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>Use camera</button>
              <button class="btn" id="btnFlip" type="button" hidden>Switch camera</button>
              <label class="btn" for="fileIn"><svg viewBox="0 0 24 24"><path d="M12 16V4M7 9l5-5 5 5M4 20h16"/></svg>Upload video</label>
              <input id="fileIn" type="file" accept="video/*" hidden>
              <button class="btn btn-ghost" id="btnStop" type="button" hidden>Stop</button>
            </div>
            <span id="mdlState" class="st st-na">Model not loaded</span>
          </div>
          <div class="stage" id="stage">
            <video id="vid" playsinline muted></video>
            <canvas id="ov"></canvas>
            <div class="stage-hud" id="hud"></div>
            <div class="stage-empty" id="stageEmpty">
              <svg viewBox="0 0 24 24"><circle cx="12" cy="4.5" r="2"/><path d="M12 7v6M8 21l4-8 4 8M6 10l6-1 6 1"/></svg>
              <div><strong>Turn on the camera or upload a video.</strong></div>
              <div class="note" style="color:#9fb0d0">Phone at 3–4 m, whole body in frame. From the side for flexion; from the front for valgus.</div>
              ${BV.inClaude() ? '<div class="note" style="color:#f4c01b">Live camera and automatic detection are not available on this claude.ai link. Upload a video and measure by hand: angles with 3 clicks and jumps by marking takeoff and landing.</div>' : ''}
            </div>
          </div>
          <div class="vctrl" id="vctrl" hidden>
            <button class="btn btn-sm" id="fBack" type="button" title="Previous frame">◀ 1 frame</button>
            <button class="btn btn-sm btn-primary" id="fPlay" type="button">Play</button>
            <button class="btn btn-sm" id="fNext" type="button" title="Next frame">1 frame ▶</button>
            <input type="range" id="fSeek" min="0" max="1" step="0.001" value="0" aria-label="Video position">
            <span class="note num" id="fTime">0.00 s</span>
            <select class="inp" id="fSpeed" style="width:auto" aria-label="Speed">
              <option value="0.25">×0.25</option><option value="0.5">×0.5</option><option value="1" selected>×1</option>
            </select>
          </div>
          <div class="row">
            <button class="btn btn-sm" id="btnMeasure" type="button">Measure angle</button>
            <button class="btn btn-sm" id="btnTo" type="button">Takeoff</button>
            <button class="btn btn-sm" id="btnLand" type="button">Landing</button>
            <button class="btn btn-sm" id="btnShot" type="button">Save photo</button>
            <select class="inp" id="recMode" style="width:auto" aria-label="Recording type">${Object.entries(REC).map(([k, r]) => `<option value="${k}">${r.label}</option>`).join('')}</select>
          </div>
        </div>

        <div class="card" id="jumpCard">
          <div class="card-h"><h3>Jump and landing</h3></div>
          <div id="jumpBody"></div>
        </div>
      </div>

      <div class="stack">
        <div class="card stack">
          <label class="field"><span>Skill</span>
            <select id="gSel">${BV.GESTOS.map((g) => `<option value="${g.id}" ${g.id === st.gesture ? 'selected' : ''}>${esc(g.nombre)}</option>`).join('')}</select></label>
          <div class="fields">
            <label class="field"><span>${BV.w.J}</span><select id="pSel">${BV.playerOptions(st.pid)}</select></label>
            <label class="field"><span>Arm</span><select id="hSel"><option value="R">Right</option><option value="L">Left</option></select></label>
          </div>
          <div id="condWarn"></div>
          <details class="more"><summary>Settings</summary><div class="stack">
            <div class="fields">
              <label class="field"><span>View</span><select id="vSel"><option value="auto">Automatic</option><option value="frontal">Front</option><option value="lateral">Side</option></select></label>
              <label class="field"><span>Model</span><select id="mSel"><option value="lite">Fast</option><option value="full">${window.MPVision ? 'Accurate (needs internet)' : 'Accurate'}</option></select></label>
            </div>
            <div class="row">
              <label class="check"><input type="checkbox" id="cPose" checked> Posture</label>
              <label class="check"><input type="checkbox" id="cJump" checked> Jumps</label>
            </div>
          </div></details>
        </div>
        <div class="card stack">
          <div class="row between"><h3>Body position</h3><span class="note" id="viewLbl">View: —</span></div>
          <div class="posture" id="posture"><span data-p="alta">High</span><span data-p="media">Medium</span><span data-p="baja">Low</span></div>
          <div class="row between"><span class="note">Score</span><span class="pnum" id="score">—</span></div>
        </div>
        <div class="card">
          <div class="card-h"><h3 id="gName">Criteria</h3></div>
          <div id="shotBox"></div>
          <ul class="checks" id="checks"></ul>
        </div>
        <details class="card" id="keyPoints"><summary>Key points</summary><div id="kpBody" style="margin-top:10px"></div></details>
      </div>
    </div>`;

    st.el = el;
    st.vid = $('#vid', el); st.cv = $('#ov', el); st.stage = $('#stage', el);
    $('#hSel', el).value = st.hit;
    wire(el);
    renderGesture();
    renderJump();
    if (pose.model) setModelState('ready'); else if (pose.loading) setModelState('loading');
  };

  function wire(el) {
    $('#btnCam', el).addEventListener('click', () => startCamera());
    $('#btnFlip', el).addEventListener('click', () => { st.facing = st.facing === 'user' ? 'environment' : 'user'; startCamera(); });
    $('#btnStop', el).addEventListener('click', stopSource);
    $('#fileIn', el).addEventListener('change', (e) => { const f = e.target.files[0]; if (f) loadFile(f); e.target.value = ''; });
    $('#gSel', el).addEventListener('change', (e) => { st.gesture = e.target.value; st.shot = null; st.lastShot = null; renderGesture(); });
    $('#pSel', el).addEventListener('change', (e) => {
      st.pid = e.target.value;
      const p = BV.player(st.pid);
      if (p) { st.hit = p.hand === 'Z' ? 'L' : 'R'; $('#hSel', el).value = st.hit; }
      condWarn();
    });
    $('#hSel', el).addEventListener('change', (e) => { st.hit = e.target.value; });
    $('#vSel', el).addEventListener('change', (e) => { st.viewMode = e.target.value; });
    $('#mSel', el).addEventListener('change', (e) => { st.modelKind = e.target.value; if (st.source !== 'none') ensurePose(st.modelKind); });
    $('#cPose', el).addEventListener('change', (e) => { st.poseOn = e.target.checked; if (!st.poseOn) { st.lm = null; } });
    $('#cJump', el).addEventListener('change', (e) => { st.detectJumps = e.target.checked; });
    $('#recMode', el).addEventListener('change', (e) => { st.rec = e.target.value; });
    // controles de video
    const vid = st.vid;
    $('#fPlay', el).addEventListener('click', () => { if (vid.paused) vid.play(); else vid.pause(); });
    $('#fBack', el).addEventListener('click', () => { vid.pause(); vid.currentTime = Math.max(0, vid.currentTime - REC[st.rec].step); });
    $('#fNext', el).addEventListener('click', () => { vid.pause(); vid.currentTime = Math.min(vid.duration || 0, vid.currentTime + REC[st.rec].step); });
    $('#fSeek', el).addEventListener('input', (e) => { vid.pause(); vid.currentTime = (+e.target.value) * (vid.duration || 0); });
    $('#fSpeed', el).addEventListener('change', (e) => { vid.playbackRate = +e.target.value; });
    vid.addEventListener('play', () => { $('#fPlay', el).textContent = 'Pause'; });
    vid.addEventListener('pause', () => { $('#fPlay', el).textContent = 'Play'; });
    // herramientas manuales
    $('#btnMeasure', el).addEventListener('click', () => {
      st.measuring = !st.measuring; st.mpts = [];
      st.stage.classList.toggle('measuring', st.measuring);
      $('#btnMeasure', el).classList.toggle('btn-primary', st.measuring);
      BV.toast(st.measuring ? 'Click 3 points: the angle is measured at the middle point.' : 'Measuring off');
    });
    st.cv.addEventListener('click', onStageClick);
    $('#btnTo', el).addEventListener('click', () => { st.mark.to = mediaMs(); st.mark.land = null; renderJump(); BV.toast('Takeoff marked. Move to the first frame with the foot on the floor.'); });
    $('#btnLand', el).addEventListener('click', () => {
      if (st.mark.to == null) { BV.toast('Mark the takeoff first.'); return; }
      st.mark.land = mediaMs();
      const ms = st.mark.land - st.mark.to;
      if (!(ms > 80 && ms < 1500)) { BV.toast('Flight time out of range. Check the marks.'); return; }
      setResult({ ms, cm: BV.calc.cmFromFlight(ms), src: 'manual', method: 'Manual frame marking' });
    });
    $('#btnShot', el).addEventListener('click', snapshot);
  }

  function renderGesture() {
    const g = BV.gesto(st.gesture);
    $('#gName').textContent = g.nombre;
    $('#kpBody').innerHTML = `<ol style="margin:0;padding-left:18px;display:flex;flex-direction:column;gap:4px;font-size:.9rem">${g.puntos.map((p) => `<li>${esc(p)}</li>`).join('')}</ol>
      <p class="note" style="margin-top:8px"><strong>Prevention:</strong> ${esc(g.prevencion)}</p>`;
    st.detectJumps = !!g.jump;
    $('#cJump').checked = st.detectJumps;
    condWarn();
    renderShot();
    renderChecks([]);
  }

  /** avisa si la persona elegida tiene restricciones para este fundamento */
  function condWarn() {
    const box = $('#condWarn'); if (!box) return;
    const p = BV.player(st.pid), g = BV.gesto(st.gesture), C = BV.cond;
    const msgs = [];
    if (p && C.active(p).some(C.blocks)) msgs.push(['crit', 'Not fit to compete: record only with medical approval']);
    if (p && g.jump && C.restricted(p, 'saltos')) msgs.push(['crit', 'Jump restriction: do not do this test']);
    if (p && g.shot && C.restricted(p, 'brazo')) msgs.push(['crit', 'Restricted from spiking and overhand serving']);
    if (p && C.restricted(p, 'contacto') && g.id === 'defensa') msgs.push(['warn', 'No falls: evaluate the low position only']);
    box.innerHTML = msgs.map(([l, t]) => `<div>${chip(l, t)}</div>`).join('');
  }

  /* ---------- fuentes de video ---------- */
  async function startCamera() {
    if (BV.inClaude()) { BV.toast('Live camera is not allowed on this claude.ai link. Upload a video or use the local version.'); return; }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      BV.toast('This browser cannot use the camera here. Open the page in Chrome from the file or over https.');
      return;
    }
    stopSource();
    try {
      st.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: st.facing, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 60 } }, audio: false,
      });
    } catch (e) {
      const msg = e.name === 'NotAllowedError' ? 'Camera permission denied. Enable it from the lock in the address bar.'
        : e.name === 'NotFoundError' ? 'No camera found on this device.' : 'Could not open the camera: ' + e.message;
      BV.toast(msg); return;
    }
    const vid = st.vid;
    vid.srcObject = st.stream; vid.removeAttribute('src');
    try { await vid.play(); } catch (e) { /* algunos navegadores requieren un gesto */ }
    const settings = st.stream.getVideoTracks()[0].getSettings ? st.stream.getVideoTracks()[0].getSettings() : {};
    st.source = 'camera';
    st.mirror = settings.facingMode ? settings.facingMode === 'user' : st.facing === 'user';
    vid.classList.toggle('mirror', st.mirror);
    $('#stageEmpty').hidden = true; $('#vctrl').hidden = true; $('#btnFlip').hidden = false; $('#btnStop').hidden = false;
    resetDetector();
    ensurePose(st.modelKind);
    startLoop();
  }

  function loadFile(file) {
    stopSource();
    st.url = URL.createObjectURL(file);
    const vid = st.vid;
    vid.srcObject = null; vid.src = st.url; vid.muted = true; vid.loop = false;
    st.source = 'file'; st.mirror = false; vid.classList.remove('mirror');
    vid.onloadedmetadata = () => { vid.currentTime = 0; vid.pause(); };
    $('#stageEmpty').hidden = true; $('#vctrl').hidden = false; $('#btnFlip').hidden = true; $('#btnStop').hidden = false;
    resetDetector();
    ensurePose(st.modelKind);
    startLoop();
    BV.toast('Video loaded. Use "1 frame" to step and mark takeoff and landing.');
  }

  function stopSource() {
    if (!st) return;
    cancelAnimationFrame(st.raf); st.raf = 0;
    if (st.stream) { st.stream.getTracks().forEach((t) => t.stop()); st.stream = null; }
    if (st.url) { URL.revokeObjectURL(st.url); st.url = null; }
    if (st.vid) { st.vid.pause(); st.vid.srcObject = null; st.vid.removeAttribute('src'); st.vid.load(); }
    st.source = 'none'; st.lm = null;
    const empty = $('#stageEmpty'); if (empty) empty.hidden = false;
    ['#vctrl', '#btnFlip', '#btnStop'].forEach((s) => { const e = $(s); if (e) e.hidden = true; });
    const ctx = st.cv && st.cv.getContext('2d'); if (ctx) ctx.clearRect(0, 0, st.cv.width, st.cv.height);
    const hud = $('#hud'); if (hud) hud.innerHTML = '';
  }

  function resetDetector() { st.jd = { phase: 'ground', hist: [], base: null, toT: 0, prepFlex: 0, post: null, tPrev: 0 }; st.lastVT = -1; st.lm = null; }
  /** tiempo real (ms) del cuadro actual; corrige la cámara lenta */
  function mediaMs() { return st.source === 'file' ? (st.vid.currentTime * 1000) / REC[st.rec].slow : performance.now(); }

  /* ---------- bucle principal ---------- */
  function startLoop() { cancelAnimationFrame(st.raf); st.raf = requestAnimationFrame(loop); }
  function loop() {
    if (!st) return;
    st.raf = requestAnimationFrame(loop);
    const vid = st.vid;
    if (!vid.videoWidth) return;
    const vt = vid.currentTime;
    if (vt !== st.lastVT) {
      const jumpBack = vt < st.lastVT || vt - st.lastVT > 0.5;
      st.lastVT = vt;
      if (st.poseOn && pose.model && pose.kind === st.modelKind) {
        const ts = Math.max(st.lastTs + 1, performance.now()); st.lastTs = ts;
        let res = null;
        try { res = pose.model.detectForVideo(vid, ts); } catch (e) { console.warn(e); }
        handlePose(res, jumpBack);
      }
    }
    draw();
    if (st.source === 'file') {
      const d = vid.duration || 0;
      $('#fSeek').value = d ? vt / d : 0;
      $('#fTime').textContent = fmt(vt, 2) + ' s';
    }
  }

  function handlePose(res, reset) {
    const vid = st.vid;
    if (!res || !res.landmarks || !res.landmarks[0]) { st.lm = null; updateUi(true); return; }
    const raw = res.landmarks[0];
    const a = st.source === 'camera' ? 0.6 : 0.85; // suavizado exponencial
    if (!st.lm || reset) st.lm = raw.map((p) => ({ ...p }));
    else st.lm = st.lm.map((p, i) => ({ x: p.x + a * (raw[i].x - p.x), y: p.y + a * (raw[i].y - p.y), z: p.z + a * (raw[i].z - p.z), visibility: raw[i].visibility }));
    st.w = res.worldLandmarks && res.worldLandmarks[0];
    st.m = metrics(st.lm, st.w, vid.videoWidth, vid.videoHeight, st.hit);
    st.view = st.viewMode === 'auto' ? st.m.viewAuto : st.viewMode;
    const g = BV.gesto(st.gesture);
    st.checks = evalChecks(g, st.m, st.view);
    if (reset) resetDetector();
    if (st.detectJumps) detectJump(st.m, mediaMs());
    if (g.shot) trackShot(st.m);
    updateUi();
  }

  /* ---------- detector automático de salto ----------
     Sigue la altura de los tobillos. Cuando suben más de un umbral (7% de la pierna)
     empieza el vuelo; cuando vuelven, termina. Como el umbral recorta la parábola,
     se corrige con el modelo cuadrático: T² = Tm² + 8·u/g. */
  function detectJump(m, t) {
    const jd = st.jd;
    if (!m.kneeVisible || !(m.legLen > 0.08)) { jd.tPrev = t; return; }
    jd.hist.push({ t, y: m.ankleY, flex: Math.max(m.kneeFlexL, m.kneeFlexR) });
    while (jd.hist.length && t - jd.hist[0].t > 1500) jd.hist.shift();
    const thr = 0.07 * m.legLen;
    if (jd.phase === 'ground') {
      const recent = jd.hist.filter((h) => t - h.t < 600).map((h) => h.y).sort((x, y) => x - y);
      if (recent.length >= 5) jd.base = recent[Math.floor(recent.length / 2)];
      if (jd.base != null && jd.base - m.ankleY > thr) {
        jd.phase = 'air'; jd.toT = (jd.tPrev + t) / 2;
        jd.prepFlex = Math.max(0, ...jd.hist.filter((h) => jd.toT - h.t < 1000).map((h) => h.flex));
      }
    } else if (jd.phase === 'air') {
      if (t - jd.toT > 1300) { jd.phase = 'ground'; }
      else if (jd.base - m.ankleY <= thr) {
        const landT = (jd.tPrev + t) / 2;
        const tm = (landT - jd.toT) / 1000;
        if (tm > 0.12 && tm < 1.1) {
          const p = BV.player(st.pid);
          const Hm = (p && p.height ? p.height : 170) / 100;
          const u = 0.07 * 0.49 * Hm; // umbral en metros (pierna ≈ 49% de la estatura)
          const T = Math.sqrt(tm * tm + (8 * u) / BV.G);
          jd.post = { t0: landT, ms: T * 1000, msRaw: tm * 1000, flex: 0, kasr: Infinity, asym: 0, trunk: 0 };
          jd.phase = 'landing';
        } else jd.phase = 'ground';
      }
    }
    if (jd.phase === 'landing') {
      const P = jd.post;
      P.flex = Math.max(P.flex, (m.kneeFlexL + m.kneeFlexR) / 2);
      if (st.view === 'frontal' && Number.isFinite(m.kasr)) P.kasr = Math.min(P.kasr, m.kasr);
      P.asym = Math.max(P.asym, m.kneeAsym);
      P.trunk = Math.max(P.trunk, m.trunk);
      if (t - P.t0 > 600) {
        jd.phase = 'ground';
        setResult({
          ms: P.ms, msRaw: P.msRaw, cm: BV.calc.cmFromFlight(P.ms), flex: P.flex, kasr: Number.isFinite(P.kasr) ? P.kasr : undefined,
          asym: P.asym, prep: jd.prepFlex, src: 'camara', method: 'Automatic detection with parabolic correction',
        });
      }
    }
    jd.tPrev = t;
  }

  /** golpe (remate/saque): guarda el cuadro con la mano más alta */
  function trackShot(m) {
    if (!m.vis(m.hitIdx)) return;
    if (m.hitWristAbove) {
      if (!st.shot || m.hitWristY < st.shot.y) st.shot = { y: m.hitWristY, elbow: m.hitElbow, sh: m.hitShElev, off: m.offWristUp };
    } else if (st.shot && m.hitWristY > m.hitShY) {
      st.lastShot = st.shot; st.shot = null;
      renderShot();
    }
  }
  function renderShot() {
    const s = st.lastShot, box = $('#shotBox');
    if (!box) return;
    if (!s) { box.innerHTML = ''; return; }
    const lv = s.elbow >= 150 ? 'ok' : s.elbow >= 120 ? 'warn' : 'crit';
    box.innerHTML = `<div class="card flat stack" style="margin-bottom:10px"><div class="row between"><strong>Last contact detected</strong>${chip(lv, lv === 'ok' ? 'Arm straight' : lv === 'warn' ? 'Arm slightly bent' : 'Arm bent')}</div>
      <div class="note">At the highest point: elbow at <b class="num">${Math.round(s.elbow)}°</b>, arm at <b class="num">${Math.round(s.sh)}°</b> from the trunk${s.off ? ', free arm up' : ', free arm down'}.</div></div>`;
  }

  /* ---------- interfaz ---------- */
  function updateUi(lost) {
    const now = performance.now();
    if (now - st.lastUi < 120) return;
    st.lastUi = now;
    const hud = $('#hud');
    if (!hud) return;
    const live = st.source === 'camera' ? '<span class="hud live">Live</span>' : '';
    if (lost || !st.m) {
      hud.innerHTML = live + (st.poseOn && pose.model ? '<span class="hud">Looking for the person…</span>' : '');
      renderChecks([]);
      return;
    }
    const m = st.m;
    const jd = st.jd.phase === 'air' ? '<span class="hud">In the air…</span>' : '';
    hud.innerHTML = `${live}<span class="hud">Knees ${Math.round(m.kneeFlexL)}° / ${Math.round(m.kneeFlexR)}°</span><span class="hud">Trunk ${Math.round(m.trunk)}°</span>${jd}`;
    $('#viewLbl').textContent = 'View: ' + (st.view === 'frontal' ? 'front' : 'side') + (st.viewMode === 'auto' ? ' (auto)' : '');
    const p = m.kneeFlex < 25 ? 'alta' : m.kneeFlex < 60 ? 'media' : 'baja';
    document.querySelectorAll('#posture span').forEach((s) => s.classList.toggle('on', m.kneeVisible && s.dataset.p === p));
    renderChecks(st.checks);
  }

  function renderChecks(list) {
    const ul = $('#checks');
    if (!ul) return;
    const g = BV.gesto(st.gesture);
    if (!list.length) {
      ul.innerHTML = g.checks.map((c) => `<li class="na"><span class="ck-l">${esc(c.label)}</span><span class="ck-v">—</span><span class="ck-c">Ideal: ${esc(c.ideal || '')}</span></li>`).join('');
      $('#score').textContent = '—';
      return;
    }
    ul.innerHTML = list.map((r) => `<li class="${r.level}"><span class="ck-l">${esc(r.c.label)}</span><span class="ck-v">${esc(r.value)}</span>
      <span class="ck-c">${r.level !== 'na' && r.level !== 'info' ? chip(r.level, r.level === 'ok' ? 'Good' : r.level === 'warn' ? 'Adjust' : 'Fix') + ' ' : ''}${esc(r.cue)} <span class="note">· Ideal: ${esc(r.c.ideal || '')}</span></span></li>`).join('');
    const ev = list.filter((r) => ['ok', 'warn', 'crit'].includes(r.level));
    const sc = ev.length ? Math.round((ev.reduce((s, r) => s + (r.level === 'ok' ? 1 : r.level === 'warn' ? 0.5 : 0), 0) / ev.length) * 100) : null;
    $('#score').textContent = sc == null ? '—' : sc + '%';
  }

  /* ---------- dibujo ---------- */
  function layout() {
    const r = st.stage.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = Math.round(r.width * dpr), H = Math.round(r.height * dpr);
    if (st.cv.width !== W || st.cv.height !== H) { st.cv.width = W; st.cv.height = H; }
    const vw = st.vid.videoWidth, vh = st.vid.videoHeight;
    const s = Math.min(W / vw, H / vh);
    return { W, H, dpr, s, ox: (W - vw * s) / 2, oy: (H - vh * s) / 2, dw: vw * s, dh: vh * s };
  }
  function toPx(L, p) { return { x: L.ox + (st.mirror ? 1 - p.x : p.x) * L.dw, y: L.oy + p.y * L.dh }; }
  function fromPx(L, x, y) { const nx = (x - L.ox) / L.dw; return { x: st.mirror ? 1 - nx : nx, y: (y - L.oy) / L.dh }; }

  function draw() {
    const L = layout();
    const ctx = st.cv.getContext('2d');
    ctx.clearRect(0, 0, L.W, L.H);
    const lw = 3 * L.dpr;
    if (st.lm && st.poseOn) {
      const lm = st.lm;
      const levels = {};
      const rank = { crit: 3, warn: 2, ok: 1 };
      st.checks.forEach((r) => {
        const joints = r.c.hit ? st.m.hitIdx : r.c.joints;
        (joints || []).forEach((j) => { if (rank[r.level] && (!levels[j] || rank[r.level] > rank[levels[j]])) levels[j] = r.level; });
      });
      const col = { ok: '#22c55e', warn: '#fab219', crit: '#ef4444' };
      ctx.lineCap = 'round';
      EDGES.forEach(([a, b]) => {
        if ((lm[a].visibility ?? 1) < 0.4 || (lm[b].visibility ?? 1) < 0.4) return;
        const p = toPx(L, lm[a]), q = toPx(L, lm[b]);
        ctx.strokeStyle = 'rgba(0,0,0,.45)'; ctx.lineWidth = lw + 2 * L.dpr;
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,.92)'; ctx.lineWidth = lw;
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
      });
      [0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28].forEach((i) => {
        if ((lm[i].visibility ?? 1) < 0.4) return;
        const p = toPx(L, lm[i]);
        ctx.fillStyle = col[levels[i]] || '#4f7cff';
        ctx.beginPath(); ctx.arc(p.x, p.y, (levels[i] ? 7 : 5) * L.dpr, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2 * L.dpr; ctx.stroke();
      });
      // etiquetas de ángulos
      const m = st.m;
      const label = (i, txt) => {
        if ((lm[i].visibility ?? 1) < 0.5) return;
        const p = toPx(L, lm[i]);
        ctx.font = `600 ${12 * L.dpr}px Barlow, system-ui, sans-serif`;
        const w = ctx.measureText(txt).width + 10 * L.dpr;
        const x = p.x + 10 * L.dpr, y = p.y - 10 * L.dpr;
        ctx.fillStyle = 'rgba(5,8,15,.78)';
        ctx.fillRect(x, y - 13 * L.dpr, w, 18 * L.dpr);
        ctx.fillStyle = '#fff'; ctx.fillText(txt, x + 5 * L.dpr, y);
      };
      if (m) {
        label(25, `${Math.round(m.kneeFlexL)}°`); label(26, `${Math.round(m.kneeFlexR)}°`);
        label(13, `${Math.round(m.elbowL)}°`); label(14, `${Math.round(m.elbowR)}°`);
      }
    }
    // medición manual de ángulo
    if (st.mpts.length) {
      ctx.strokeStyle = '#f4c01b'; ctx.fillStyle = '#f4c01b'; ctx.lineWidth = 2.5 * L.dpr;
      const pts = st.mpts.map((p) => toPx(L, p));
      ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.stroke();
      pts.forEach((p) => { ctx.beginPath(); ctx.arc(p.x, p.y, 6 * L.dpr, 0, Math.PI * 2); ctx.fill(); });
      if (pts.length === 3) {
        const vw = st.vid.videoWidth, vh = st.vid.videoHeight;
        const P = st.mpts.map((p) => ({ x: p.x * vw, y: p.y * vh }));
        const a = ang2(P[0], P[1], P[2]);
        ctx.font = `700 ${18 * L.dpr}px "Barlow Condensed", sans-serif`;
        const txt = `${Math.round(a)}°  (flexion ${Math.round(180 - a)}°)`;
        const w = ctx.measureText(txt).width + 14 * L.dpr;
        ctx.fillStyle = 'rgba(5,8,15,.85)'; ctx.fillRect(pts[1].x + 12 * L.dpr, pts[1].y - 26 * L.dpr, w, 28 * L.dpr);
        ctx.fillStyle = '#f4c01b'; ctx.fillText(txt, pts[1].x + 19 * L.dpr, pts[1].y - 6 * L.dpr);
      }
    }
  }

  function onStageClick(ev) {
    if (!st.measuring || !st.vid.videoWidth) return;
    const r = st.cv.getBoundingClientRect();
    const L = layout();
    const p = fromPx(L, (ev.clientX - r.left) * L.dpr, (ev.clientY - r.top) * L.dpr);
    if (p.x < 0 || p.x > 1 || p.y < 0 || p.y > 1) return;
    if (st.mpts.length >= 3) st.mpts = [];
    st.mpts.push(p);
  }

  function snapshot() {
    const vid = st.vid;
    if (!vid.videoWidth) { BV.toast('No image to save.'); return; }
    const c = document.createElement('canvas');
    c.width = st.cv.width; c.height = st.cv.height;
    const ctx = c.getContext('2d');
    const L = layout();
    ctx.fillStyle = '#05080f'; ctx.fillRect(0, 0, c.width, c.height);
    ctx.save();
    if (st.mirror) { ctx.translate(c.width, 0); ctx.scale(-1, 1); }
    ctx.drawImage(vid, L.ox, L.oy, L.dw, L.dh);
    ctx.restore();
    ctx.drawImage(st.cv, 0, 0);
    const p = BV.player(st.pid);
    const name = `biovoley-${st.gesture}-${p ? p.name.split(' ')[0].toLowerCase() : 'captura'}-${BV.today()}.png`;
    c.toBlob((b) => { if (b) BV.download(name, b); }, 'image/png');
  }

  /* ---------- resultado del salto ---------- */
  function setResult(r) {
    st.result = r;
    st.results.unshift(r);
    st.results = st.results.slice(0, 6);
    renderJump();
    if (r.src === 'camara') BV.toast(`Jump detected: ${fmt(r.cm)} cm`);
  }

  function renderJump() {
    const body = $('#jumpBody');
    if (!body) return;
    const r = st.result;
    const sess = BV.session();
    const manual = st.mark.to != null ? `<p class="note">Takeoff marked at ${fmt(st.mark.to / 1000, 3)} s${st.mark.land != null ? ` · landing at ${fmt(st.mark.land / 1000, 3)} s` : ' · now mark the landing'}.</p>` : '';
    if (!r) {
      body.innerHTML = `<p class="muted">No jumps yet.</p>${manual}`;
      return;
    }
    const lq = BV.calc.landing(r);
    const v0 = BV.calc.v0FromFlight(r.ms);
    const err = (BV.G * (r.ms / 1000) / 4) * (REC[st.rec].step / REC[st.rec].slow) * 100; // dh ≈ (g·t/4)·Δt
    body.innerHTML = `
      <div class="bigres">
        <div><span>Height</span><b>${fmt(r.cm)} cm</b></div>
        <div><span>Flight time</span><b>${Math.round(r.ms)} ms</b></div>
        <div><span>Takeoff speed</span><b>${fmt(v0, 2)} m/s</b></div>
        ${Number.isFinite(r.prep) ? `<div><span>Takeoff flexion</span><b>${Math.round(r.prep)}°</b></div>` : ''}
        ${Number.isFinite(r.flex) ? `<div><span>Landing flexion</span><b>${Math.round(r.flex)}°</b></div>` : ''}
        ${Number.isFinite(r.kasr) ? `<div><span>Knee / ankle</span><b>${fmt(r.kasr, 2)}</b></div>` : ''}
      </div>
      ${lq ? `<div class="row" style="margin-top:10px">${lq.items.map(([l, t]) => chip(l, t)).join('')}</div>` : ''}
      <p class="note" style="margin-top:8px">${esc(r.method)}${r.msRaw ? ` (measured flight ${Math.round(r.msRaw)} ms → corrected ${Math.round(r.ms)} ms)` : ''}. Error per frame ≈ ±${fmt(err, 1)} cm.</p>
      ${manual}
      <div class="sep"></div>
      <div class="row">
        <select class="inp" id="svP" style="width:auto">${BV.playerOptions(st.pid)}</select>
        <select class="inp" id="svS" style="width:auto">${[1, 2, 3, 4, 5].map((s) => `<option value="${s}">Set ${s}</option>`).join('')}</select>
        <button class="btn btn-ball" id="svBtn" type="button">Save to ${esc(sess ? sess.date : 'the session')}</button>
      </div>
      ${st.results.length > 1 ? `<div class="tbl-wrap" style="margin-top:10px"><table class="tbl"><thead><tr><th>#</th><th class="r">Height</th><th class="r">Flight</th><th class="r">Flexion</th><th>Method</th></tr></thead><tbody>
        ${st.results.map((x, i) => `<tr><td>${st.results.length - i}</td><td class="r">${fmt(x.cm)} cm</td><td class="r">${Math.round(x.ms)} ms</td><td class="r">${Number.isFinite(x.flex) ? Math.round(x.flex) + '°' : '—'}</td><td class="note">${x.src === 'manual' ? 'Manual' : 'Automatic'}</td></tr>`).join('')}
      </tbody></table></div>` : ''}`;
    $('#svBtn').addEventListener('click', () => {
      const pid = $('#svP').value;
      if (!pid) { BV.toast(`First add players in the section ${BV.w.Js}.`); return; }
      const set = +$('#svS').value;
      BV.data.jumps.push({
        id: BV.uid('j'), pid, sid: BV.data.current, set, cm: +r.cm.toFixed(1), ms: Math.round(r.ms),
        flex: Number.isFinite(r.flex) ? Math.round(r.flex) : undefined, kasr: Number.isFinite(r.kasr) ? +r.kasr.toFixed(2) : undefined,
        asym: Number.isFinite(r.asym) ? Math.round(r.asym) : undefined, src: r.src,
      });
      BV.save();
      BV.toast(`Saved: ${BV.player(pid).name}, set ${set}, ${fmt(r.cm)} cm`);
    });
  }

  V.destroy = function () { stopSource(); st = null; BV.tip.hide(); };
  BV.views.camara = V;
})(window.BV);
