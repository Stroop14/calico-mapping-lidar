#!/usr/bin/env node
// Walk the fly-through centreline from the portal to the far north chamber and back,
// in 1 ft steps, for manual WASD and for P. The floor and ceiling used to judge the
// camera are computed here from the point cloud (same 25 cm / 10 cm bins as app.js,
// not by calling CALICO.eye.pointFloor). Fails when the eye is under 1.40 m above the
// local floor (the camera sits at 1.635 m, about 2.5 inches below a 6 ft eye) unless the
// roof is too low to stand under (ceiling - floor < 1.85 m), or when a walking-surface bin sits above the eye.
// On a normal floor the eye may change by at most about 2 cm per 0.3 m of travel. A low
// ceiling may duck faster. The max per-step change is printed either way.
'use strict';
const fs = require('fs');
const http = require('http');
const path = require('path');
const vm = require('vm');
const { spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const FT = 0.3048;
const FCELL = 0.25, FY0 = -4, FYN = 120;
const PORT = 8777;
const CDP = 9341;
const SHOT = process.env.EYE_SHOT || '/opt/cursor/artifacts/eye_278ft_route.png';

function fail(msg) { console.error(msg); process.exit(1); }

function loadMeta() {
  const CALICO = {};
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'data/meta.js'), 'utf8'), { CALICO });
  return CALICO.meta;
}
function loadTunnel() {
  const CALICO = {};
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'data/tunnel.js'), 'utf8'), { CALICO });
  return CALICO.tunnel;
}

const fgrid = new Map();
function fbin(x, y, z, up) {
  const yi = Math.round((y - FY0) / 0.1);
  if (yi < 0 || yi >= FYN) return;
  const k = Math.round(x / FCELL) * 100000 + Math.round(z / FCELL);
  let h = fgrid.get(k);
  if (!h) { h = new Uint16Array(FYN * 2); fgrid.set(k, h); }
  const i = yi + (up ? 0 : FYN);
  if (h[i] < 65535) h[i]++;
}

function binFile(fi, meta) {
  const CALICO = { addFile(i, a) { this.a = a; } };
  const file = path.join(ROOT, `data/pts_00${fi}.js`);
  process.stdout.write(`binning ${path.basename(file)} … `);
  vm.runInNewContext(fs.readFileSync(file, 'utf8'), { CALICO }, { filename: file });
  const bmin = meta.bmin, ext = meta.ext;
  let n = 0;
  for (const ch of meta.chunks) {
    if (ch.f !== fi) continue;
    const raw = Buffer.from(CALICO.a[ch.i], 'base64');
    const posBytes = raw.subarray(0, ch.n * 6);
    const posBuf = (posBytes.byteOffset % 2 === 0) ? posBytes : Buffer.from(posBytes);
    const pos = new Uint16Array(posBuf.buffer, posBuf.byteOffset, ch.n * 3);
    const nrm = new Int8Array(raw.buffer, raw.byteOffset + ch.n * 6, ch.n * 3);
    for (let i = 0; i < ch.n; i++) {
      const ny = nrm[3 * i + 1] / 127;
      if (ny > 0.5 || ny < -0.5) {
        const x = bmin[0] + pos[3 * i] / 65535 * ext[0];
        const y = bmin[1] + pos[3 * i + 1] / 65535 * ext[1];
        const z = bmin[2] + pos[3 * i + 2] / 65535 * ext[2];
        fbin(x, y, z, ny > 0.5);
      }
    }
    n += ch.n;
  }
  CALICO.a = null;
  console.log(n.toLocaleString() + ' pts, ' + fgrid.size.toLocaleString() + ' cells');
}

function column(x, z, radius) {
  const ix = Math.round(x / FCELL), iz = Math.round(z / FCELL), r2 = radius * radius;
  const up = new Uint32Array(FYN), dn = new Uint32Array(FYN);
  const span = Math.ceil(radius / FCELL) + 1;
  let any = false;
  for (let dx = -span; dx <= span; dx++) for (let dz = -span; dz <= span; dz++) {
    const cx = (ix + dx) * FCELL, cz = (iz + dz) * FCELL;
    if ((cx - x) * (cx - x) + (cz - z) * (cz - z) > r2) continue;
    const h = fgrid.get((ix + dx) * 100000 + (iz + dz));
    if (!h) continue;
    any = true;
    for (let i = 0; i < FYN; i++) { up[i] += h[i]; dn[i] += h[FYN + i]; }
  }
  return any ? { up, dn } : null;
}

// Same floor / dominant-roof rule as app.js pointFC. radius 0.5 m, widened to 1 m only
// where the centreline has no points (the open portal).
function localFC(x, z) {
  const col = column(x, z, 0.5) || column(x, z, 1.0);
  if (!col) return null;
  const { up, dn } = col;
  let peakUp = 0;
  for (let i = 0; i < FYN; i++) if (up[i] > peakUp) peakUp = up[i];
  const needUp = Math.max(40, peakUp * 0.12);
  let floor = null, floorI = -1;
  for (let i = 0; i < FYN; i++) if (up[i] >= needUp) { floor = FY0 + i * 0.1; floorI = i; break; }
  if (floor === null) return null;
  let ceil = null, peakI = -1, peakDn = 0;
  for (let i = 0; i < FYN; i++) if (FY0 + i * 0.1 >= floor + 0.85 && dn[i] > peakDn) { peakDn = dn[i]; peakI = i; }
  if (peakI >= 0) {
    const needDn = Math.max(80, peakDn * 0.2);
    let c = peakI;
    while (c > 0 && FY0 + (c - 1) * 0.1 >= floor + 0.85 && dn[c - 1] >= needDn) c--;
    ceil = FY0 + c * 0.1;
  }
  let slabAbove = null;
  for (let i = floorI; i < FYN; i++) {
    const y = FY0 + i * 0.1;
    if (y > floor + 0.40) break;
    if (up[i] >= needUp && y > (slabAbove === null ? -1e9 : slabAbove)) slabAbove = y;
  }
  return { floor, ceil, slabAbove };
}

function median(a) {
  const b = a.slice().sort((x, y) => x - y);
  return b[b.length >> 1];
}

function startServer() {
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.jpg': 'image/jpeg' };
  const srv = http.createServer((req, res) => {
    const u = decodeURIComponent(req.url.split('?')[0]);
    const fp = path.normalize(path.join(ROOT, u));
    if (!fp.startsWith(ROOT) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) { res.writeHead(404); res.end('no'); return; }
    res.writeHead(200, { 'Content-Type': types[path.extname(fp)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(fp).pipe(res);
  });
  return new Promise(resolve => srv.listen(PORT, '127.0.0.1', () => resolve(srv)));
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function cdp() {
  const chrome = spawn('google-chrome', [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage',
    '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    `--remote-debugging-port=${CDP}`, '--user-data-dir=/tmp/chrome-eye-route',
    '--window-size=1280,720', '--force-device-scale-factor=1', 'about:blank'
  ], { stdio: 'ignore' });
  let ver;
  for (let i = 0; i < 50; i++) {
    try { ver = await (await fetch(`http://127.0.0.1:${CDP}/json/version`)).json(); break; }
    catch { await sleep(200); }
  }
  if (!ver) { chrome.kill(); fail('Chrome DevTools did not come up'); }
  const tab = await (await fetch(`http://127.0.0.1:${CDP}/json/new?${encodeURIComponent(`http://127.0.0.1:${PORT}/index.html?capture&hud`)}`, { method: 'PUT' })).json();
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); });
  let id = 0;
  const pending = new Map();
  ws.addEventListener('message', ev => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result); }
  });
  function send(method, params, timeout) {
    const my = ++id;
    return new Promise((res, rej) => {
      const t = setTimeout(() => { pending.delete(my); rej(new Error('timeout ' + method)); }, timeout || 60000);
      pending.set(my, { res: v => { clearTimeout(t); res(v); }, rej: e => { clearTimeout(t); rej(e); } });
      ws.send(JSON.stringify({ id: my, method, params }));
    });
  }
  async function evalJs(expression, timeout) {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, timeout: timeout || 120000 }, (timeout || 120000) + 5000);
    if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 800));
    return r.result.value;
  }
  return { chrome, ws, send, evalJs, async close() { try { ws.close(); } catch {} chrome.kill(); } };
}

const WALK_WASD = `(function(){
  const FT=0.3048, sim=CALICO.sim, L=sim.routeLen, n=Math.floor(L/FT+1e-9);
  sim.setKeepIn(false);
  for (const k of Object.keys(sim.keys)) sim.keys[k]=false;
  const samples=[];
  function grab(ft,dir){ const p=sim.pos(), r=sim.routeProj(p.x,p.z); return {ft:ft, dir:dir, mode:'wasd', x:p.x, y:p.y, z:p.z, off:r.d, s:r.s}; }
  function leg(dir){
    const sign=dir==='out'?1:-1, end=dir==='out'?n:0;
    let ft=dir==='out'?0:n;
    const p0=sim.routeAt(Math.max(0,Math.min(L,ft*FT)));
    const y0=CALICO.eye.target(p0.x,p0.z,p0.y);
    sim.place(p0.x, y0==null?p0.y:y0, p0.z);
    sim.face(sim.routeAt(Math.max(0,Math.min(L,(ft+sign)*FT))).x, sim.routeAt(Math.max(0,Math.min(L,(ft+sign)*FT))).z);
    samples.push(grab(ft,dir));
    while(ft!==end){
      const nxt=ft+sign;
      const tgt=sim.routeAt(Math.max(0,Math.min(L,nxt*FT)));
      sim.keys.KeyW=true;
      let guard=0, reached=false;
      while(guard++<150){
        sim.face(tgt.x, tgt.z);
        sim.update(1/30);
        const r=sim.routeProj(sim.pos().x, sim.pos().z);
        const now=r.s/FT;
        if((sign>0 && now>=nxt-0.08) || (sign<0 && now<=nxt+0.08)){ reached=true; break; }
        if(r.d>3) break;
      }
      if(!reached){ sim.keys.KeyW=false; return 'WASD stuck at '+ft+' ft going '+dir+' (off '+sim.routeProj(sim.pos().x,sim.pos().z).d.toFixed(2)+' m)'; }
      ft=nxt; samples.push(grab(ft,dir));
    }
    sim.keys.KeyW=false;
    return null;
  }
  const e=leg('out')||leg('back');
  sim.keys.KeyW=false;
  return e?{error:e, samples:samples}:{samples:samples, n:n};
})()`;

const WALK_P = `(function(){
  const FT=0.3048, sim=CALICO.sim, L=sim.routeLen, n=Math.floor(L/FT+1e-9);
  sim.setKeepIn(false);
  for (const k of Object.keys(sim.keys)) sim.keys[k]=false;
  const p0=sim.routeAt(0);
  const y0=CALICO.eye.target(p0.x,p0.z,p0.y);
  sim.place(p0.x, y0==null?p0.y:y0, p0.z);
  sim.auto(true);
  const samples=[];
  let nextOut=0, nextBack=null, t=0;
  while(t<420){
    sim.update(1/20); t+=1/20;
    const st=CALICO.eye.state();
    const p=sim.pos(), r=sim.routeProj(p.x,p.z), ft=r.s/FT;
    if(nextBack===null){
      while(nextOut<=n && ft+0.05>=nextOut){
        samples.push({ft:nextOut, dir:'out', mode:'P', x:p.x, y:p.y, z:p.z, off:r.d, s:r.s});
        nextOut++;
      }
      if(nextOut>n && st.flyD>CALICO.eye.flyLen+0.05) nextBack=n;
    } else {
      while(nextBack>=0 && ft-0.05<=nextBack){
        samples.push({ft:nextBack, dir:'back', mode:'P', x:p.x, y:p.y, z:p.z, off:r.d, s:r.s});
        nextBack--;
      }
      if(nextBack<0) break;
      if(!st.auto && ft<2) break;
    }
    if(!st.auto && t>5 && nextBack===null) return {error:'P stopped before the far end', samples:samples, t:t};
  }
  sim.auto(false);
  if(nextBack===null || nextBack>=0) return {error:'P did not return to the portal', samples:samples, t:t, nextOut:nextOut, nextBack:nextBack};
  return {samples:samples, n:n, t:t};
})()`;

const SHOT_JS = `(function(){
  const s=278*0.3048, sim=CALICO.sim;
  const p=sim.routeAt(Math.min(s, sim.routeLen));
  const q=sim.routeAt(Math.min(sim.routeLen, s+6));
  const y=CALICO.eye.target(p.x,p.z,p.y);
  const fc=CALICO.eye.pointFloor(p.x,p.z);
  CALICO.setPose([p.x, y==null?p.y:y, p.z], [q.x, (y==null?p.y:y)-0.35, q.z]);
  CALICO.navHud();
  CALICO.renderNow();
  const ll=CALICO.latLon();
  return {x:p.x, y:y, z:p.z, floor:fc, distFt:CALICO.distAlongPath()*3.28084, lat:ll[0], lon:ll[1],
    hud:document.getElementById('navhud').innerText};
})()`;

function judge(samples) {
  const bad = [];
  const segs = { wasd: new Map(), P: new Map() };
  let nodata = 0, floorAbove = 0;
  for (const s of samples) {
    const fc = localFC(s.x, s.z);
    if (!fc) { nodata++; s.gap = null; continue; }
    const gap = s.y - fc.floor;
    s.gap = gap; s.floor = fc.floor; s.ceil = fc.ceil;
    const head = fc.ceil === null ? null : fc.ceil - fc.floor;
    const ducked = head !== null && head < 1.85;
    const slabAbove = fc.slabAbove !== null && fc.slabAbove > s.y + 0.02;
    if (slabAbove) { floorAbove++; bad.push({ ...s, why: 'floor bin ' + fc.slabAbove.toFixed(2) + ' is above the eye ' + s.y.toFixed(2) }); }
    else if (gap < 1.4 && !ducked) bad.push({ ...s, why: 'eye-floor ' + gap.toFixed(2) + ' m' + (head === null ? ' (no ceiling)' : ' headroom ' + head.toFixed(2)) });
    const seg = Math.floor(s.ft / 50) * 50;
    const bucket = segs[s.mode];
    if (!bucket.has(seg)) bucket.set(seg, []);
    bucket.get(seg).push(gap);
  }
  return { bad, segs, nodata, floorAbove };
}

// |Δeye| scaled to 0.30 m of travel. Normal floor must stay near 2 cm; a low roof may duck faster.
function stepReport(samples) {
  const groups = new Map();
  for (const s of samples) {
    const k = s.mode + '|' + s.dir;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(s);
  }
  const bad = [];
  const maxN = { wasd: 0, P: 0 }, maxL = { wasd: 0, P: 0 };
  const whereN = {}, whereL = {};
  for (const [k, arr] of groups) {
    const mode = k.slice(0, k.indexOf('|'));
    for (let i = 1; i < arr.length; i++) {
      const a = arr[i - 1], b = arr[i];
      const ds = Math.hypot(b.x - a.x, b.z - a.z);
      if (!(ds > 0.05 && ds < 0.8)) continue;
      const per = Math.abs(b.y - a.y) * (0.30 / ds);
      const low = (p) => p.ceil != null && p.floor != null && (p.ceil - p.floor) < 1.85;
      if (low(a) || low(b)) {
        if (per > maxL[mode]) { maxL[mode] = per; whereL[mode] = b; }
      } else {
        if (per > maxN[mode]) { maxN[mode] = per; whereN[mode] = b; }
        if (per > 0.025) bad.push({ mode, dir: b.dir, ft: b.ft, per, ds, y0: a.y, y1: b.y, floor: b.floor, ceil: b.ceil });
      }
    }
  }
  return { bad, maxN, maxL, whereN, whereL };
}

function printSteps(st) {
  console.log('\nmax |Δeye| per 0.30 m of travel');
  for (const mode of ['wasd', 'P']) {
    const label = mode === 'wasd' ? 'WASD' : 'P   ';
    const wn = st.whereN[mode], wl = st.whereL[mode];
    console.log(`  ${label}  normal floor ${(st.maxN[mode] * 100).toFixed(1)} cm`
      + (wn ? ` at ${wn.ft} ft ${wn.dir}` : '')
      + `    low ceiling ${(st.maxL[mode] * 100).toFixed(1)} cm`
      + (wl ? ` at ${wl.ft} ft ${wl.dir}` : ''));
  }
}

function printSegs(segs) {
  for (const mode of ['wasd', 'P']) {
    console.log('\n' + (mode === 'wasd' ? 'WASD' : 'P') + '  eye − floor (m) per 50 ft, both directions');
    console.log('segment'.padEnd(12) + 'n'.padStart(6) + 'min'.padStart(8) + 'median'.padStart(8) + 'max'.padStart(8));
    const keys = [...segs[mode].keys()].sort((a, b) => a - b);
    for (const k of keys) {
      const g = segs[mode].get(k);
      const min = Math.min(...g), max = Math.max(...g), med = median(g);
      console.log(`${String(k).padStart(3)}–${String(k + 50).padStart(3)} ft`.padEnd(14) + String(g.length).padStart(6)
        + min.toFixed(2).padStart(8) + med.toFixed(2).padStart(8) + max.toFixed(2).padStart(8));
    }
  }
}

async function main() {
  const t0 = Date.now();
  const meta = loadMeta();
  loadTunnel();
  for (let fi = 0; fi < 9; fi++) binFile(fi, meta);
  console.log('floor cells', fgrid.size.toLocaleString(), 'in', ((Date.now() - t0) / 1000).toFixed(1) + 's');
  const srv = await startServer();
  const browser = await cdp();
  try {
    let ready = false;
    for (let i = 0; i < 120; i++) {
      const v = await browser.evalJs('!!(window.CALICO && CALICO.ready && CALICO.eye && CALICO.sim && CALICO.sim.routeLen>0)');
      if (v) { ready = true; break; }
      await sleep(1000);
    }
    if (!ready) fail('page did not become ready');
    console.log('page ready', ((Date.now() - t0) / 1000).toFixed(1) + 's — walking WASD');
    const wasd = await browser.evalJs(WALK_WASD, 180000);
    if (wasd.error) {
      console.error(wasd.error, 'samples', wasd.samples && wasd.samples.length);
      fail(wasd.error);
    }
    console.log('WASD samples', wasd.samples.length, '— flying P');
    const fly = await browser.evalJs(WALK_P, 180000);
    if (fly.error) {
      console.error(fly.error, 'samples', fly.samples && fly.samples.length, 't', fly.t);
      fail(fly.error);
    }
    console.log('P samples', fly.samples.length, 'sim', fly.t.toFixed(1) + 's');
    const all = wasd.samples.concat(fly.samples);
    const { bad, segs, nodata, floorAbove } = judge(all);
    const steps = stepReport(all);
    printSegs(segs);
    printSteps(steps);
    console.log('\nnodata (no floor within 1 m):', nodata, ' floor-bins above the eye:', floorAbove, ' failures:', bad.length + steps.bad.length);
    if (bad.length || steps.bad.length) {
      console.error('first failures:');
      for (const b of bad.slice(0, 8)) console.error(`  ${b.mode} ${b.dir} ${b.ft} ft  eye ${b.y.toFixed(2)} floor ${b.floor == null ? '?' : b.floor.toFixed(2)} ceil ${b.ceil == null ? '?' : b.ceil.toFixed(2)}  ${b.why}`);
      for (const b of steps.bad.slice(0, 8)) console.error(`  ${b.mode} ${b.dir} ${b.ft} ft  eye change ${(b.per * 100).toFixed(1)} cm per 0.30 m (${b.y0.toFixed(3)} -> ${b.y1.toFixed(3)})`);
      fail('eye-height route check failed');
    }
    const off = all.filter(s => s.off > 1.5);
    if (off.length) fail(off.length + ' samples more than 1.5 m off the centreline, e.g. ' + off[0].mode + ' ' + off[0].ft + ' ft');
    console.log('PASS', all.length, 'samples');
    fs.mkdirSync(path.dirname(SHOT), { recursive: true });
    const info = await browser.evalJs(SHOT_JS, 60000);
    const shot = await browser.send('Page.captureScreenshot', { format: 'png' }, 30000);
    fs.writeFileSync(SHOT, Buffer.from(shot.data, 'base64'));
    console.log('screenshot', SHOT, JSON.stringify(info));
    const rep = { nodata, floorAbove, failures: 0, shot: SHOT, pose: info,
      stepCmPer30cm: { wasd: { normal: +(steps.maxN.wasd * 100).toFixed(2), low: +(steps.maxL.wasd * 100).toFixed(2) },
        P: { normal: +(steps.maxN.P * 100).toFixed(2), low: +(steps.maxL.P * 100).toFixed(2) } } };
    for (const mode of ['wasd', 'P']) {
      rep[mode] = {};
      for (const [k, g] of segs[mode]) rep[mode][k] = { n: g.length, min: Math.min(...g), med: median(g), max: Math.max(...g) };
    }
    fs.writeFileSync('/tmp/eye-route-report.json', JSON.stringify(rep, null, 2));
  } finally {
    await browser.close();
    srv.close();
  }
}

main().catch(e => { console.error(e); process.exit(1); });
