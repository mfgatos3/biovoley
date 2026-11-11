// Arnés mínimo de Chromium headless por DevTools (WebGL por software con SwiftShader).
const { spawn } = require('child_process'), fs = require('fs'), os = require('os'), path = require('path');
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

async function abrir(opts = {}) {
  const puerto = 9400 + Math.floor(Math.random() * 400);
  const perfil = fs.mkdtempSync(path.join(os.tmpdir(), 'bv-perfil-'));
  const args = ['--headless=new', '--no-sandbox', '--disable-gpu-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist',
    `--remote-debugging-port=${puerto}`, `--user-data-dir=${perfil}`, '--window-size=1400,900', '--autoplay-policy=no-user-gesture-required', ...(opts.extra || []), 'about:blank'];
  const ch = spawn(opts.bin || '/usr/bin/chromium', args, { stdio: 'ignore', detached: true });
  const cerrar = () => { try { process.kill(-ch.pid, 'SIGKILL'); } catch (e) { /* ya salió */ } try { fs.rmSync(perfil, { recursive: true, force: true }); } catch (e) { /* nada */ } };
  process.on('exit', cerrar);
  let ws = null;
  for (let i = 0; i < 600 && !ws; i++) {
    try {
      const l = await (await fetch(`http://127.0.0.1:${puerto}/json`)).json();
      const pg = l.find((x) => x.type === 'page');
      if (pg) ws = new WebSocket(pg.webSocketDebuggerUrl);
    } catch (e) { /* todavía no responde */ }
    if (!ws) await espera(250);
  }
  if (!ws) throw new Error('Chromium no respondió');
  await new Promise((r) => { ws.onopen = r; });
  const pend = {}, logs = [];
  let id = 0;
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (d.id && pend[d.id]) { pend[d.id](d); delete pend[d.id]; }
    else if (d.method === 'Runtime.consoleAPICalled') logs.push(`${d.params.type}: ${d.params.args.map((a) => a.value ?? a.description).join(' ')}`);
    else if (d.method === 'Runtime.exceptionThrown') logs.push(`EXC: ${d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text}`);
  };
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; pend[i] = r; ws.send(JSON.stringify({ id: i, method, params })); });
  await send('Runtime.enable'); await send('Page.enable');
  const ev = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text);
    return r.result?.result?.value;
  };
  const ir = async (url) => {
    await send('Page.navigate', { url });
    await espera(800);
    for (let i = 0; i < 600; i++) { if (await ev('document.readyState') === 'complete') break; await espera(100); }
  };
  return { send, ev, ir, logs, cerrar };
}
module.exports = { abrir, espera };
