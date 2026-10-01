#!/usr/bin/env node
'use strict';
// Pack the registered full-detail cloud (data-hd/pts_*.js) into centreline sections.
// Every point is copied from those files. Nothing is synthesized, and the two
// unregistered LAZ scans are not merged in (they do not share this frame).
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const SECTION_M = 10;
const CELL = 0.5;
const SAMPLE_STEP = 0.25;
const MAX_FILE = 48 * 1024 * 1024;
const OUT = path.join(ROOT, 'data-sec');

function loadCalico(file) {
  const ctx = { CALICO: { files: {}, addFile(i, a) { this.files[i] = a; } } };
  vm.runInNewContext(fs.readFileSync(file, 'utf8'), ctx, { filename: file });
  return ctx.CALICO;
}

const t0 = Date.now();
const log = (...a) => console.log(((Date.now() - t0) / 1000).toFixed(1) + 's', ...a);

const tunnel = loadCalico(path.join(ROOT, 'data/tunnel.js'));
const fly = tunnel.tunnel.fly;
const hd = loadCalico(path.join(ROOT, 'data-hd/meta.js'));
const meta = hd.meta;
const bmin = meta.bmin, ext = meta.ext;
log('meta points', meta.count, 'chunks', meta.chunks.length);

const samples = [];
let acc = 0;
for (let i = 0; i < fly.length; i++) {
  const [x, , z] = fly[i];
  if (i === 0) { samples.push({ s: 0, x, z }); continue; }
  const [px, , pz] = fly[i - 1];
  const seg = Math.hypot(x - px, z - pz);
  const n = Math.max(1, Math.ceil(seg / SAMPLE_STEP));
  for (let k = 1; k <= n; k++) {
    const t = k / n;
    samples.push({ s: acc + seg * t, x: px + (x - px) * t, z: pz + (z - pz) * t });
  }
  acc += seg;
}
const pathLen = samples[samples.length - 1].s;
log('centreline', pathLen.toFixed(2), 'm,', samples.length, 'samples');

const x0 = bmin[0] - 1, z0 = bmin[2] - 1;
const x1 = bmin[0] + ext[0] + 1, z1 = bmin[2] + ext[2] + 1;
const nx = Math.ceil((x1 - x0) / CELL), nz = Math.ceil((z1 - z0) / CELL);
const grid = new Int32Array(nx * nz);
log('station grid', nx, 'x', nz);
for (let iz = 0; iz < nz; iz++) {
  const z = z0 + (iz + 0.5) * CELL;
  for (let ix = 0; ix < nx; ix++) {
    const x = x0 + (ix + 0.5) * CELL;
    let best = 0, bd = 1e18;
    for (let i = 0; i < samples.length; i++) {
      const dx = samples[i].x - x, dz = samples[i].z - z, d = dx * dx + dz * dz;
      if (d < bd) { bd = d; best = i; }
    }
    grid[iz * nx + ix] = best;
  }
}

function stationOf(x, z) {
  let ix = Math.floor((x - x0) / CELL), iz = Math.floor((z - z0) / CELL);
  if (ix < 0) ix = 0; else if (ix >= nx) ix = nx - 1;
  if (iz < 0) iz = 0; else if (iz >= nz) iz = nz - 1;
  return samples[grid[iz * nx + ix]].s;
}

const buckets = [];
function bucket(id) {
  let b = buckets[id];
  if (b) return b;
  b = buckets[id] = {
    parts: [], buf: Buffer.allocUnsafe(4 << 20), o: 0, n: 0,
    minx: Infinity, miny: Infinity, minz: Infinity,
    maxx: -Infinity, maxy: -Infinity, maxz: -Infinity
  };
  return b;
}
function flush(b) {
  if (b.o) { b.parts.push(b.buf.subarray(0, b.o)); b.buf = Buffer.allocUnsafe(4 << 20); b.o = 0; }
}

const floorN = new Map();
let seen = 0;
const files = fs.readdirSync(path.join(ROOT, 'data-hd')).filter(f => /^pts_\d+\.js$/.test(f)).sort();
for (const file of files) {
  log('decode', file);
  const cal = loadCalico(path.join(ROOT, 'data-hd', file));
  const fi = Number(file.slice(4, 7));
  const arr = cal.files[fi];
  if (!arr) throw new Error('no file array in ' + file);
  for (const ch of meta.chunks) {
    if (ch.f !== fi) continue;
    const raw = Buffer.from(arr[ch.i], 'base64');
    const n = ch.n;
    if (raw.length < n * 10) throw new Error('short chunk ' + file + ' i=' + ch.i);
    const pos = new Uint16Array(raw.buffer, raw.byteOffset, n * 3);
    const nrm = new Int8Array(raw.buffer, raw.byteOffset + n * 6, n * 3);
    const tone = new Uint8Array(raw.buffer, raw.byteOffset + n * 9, n);
    for (let i = 0; i < n; i++) {
      const qx = pos[3 * i], qy = pos[3 * i + 1], qz = pos[3 * i + 2];
      const x = bmin[0] + qx / 65535 * ext[0];
      const y = bmin[1] + qy / 65535 * ext[1];
      const z = bmin[2] + qz / 65535 * ext[2];
      const s = stationOf(x, z);
      const id = Math.max(0, Math.floor(s / SECTION_M));
      const b = bucket(id);
      if (b.o + 10 > b.buf.length) flush(b);
      const o = b.o;
      b.buf.writeUInt16LE(qx, o);
      b.buf.writeUInt16LE(qy, o + 2);
      b.buf.writeUInt16LE(qz, o + 4);
      b.buf[o + 6] = nrm[3 * i] & 255;
      b.buf[o + 7] = nrm[3 * i + 1] & 255;
      b.buf[o + 8] = nrm[3 * i + 2] & 255;
      b.buf[o + 9] = tone[i];
      b.o += 10; b.n++;
      if (x < b.minx) b.minx = x; if (y < b.miny) b.miny = y; if (z < b.minz) b.minz = z;
      if (x > b.maxx) b.maxx = x; if (y > b.maxy) b.maxy = y; if (z > b.maxz) b.maxz = z;
      if (nrm[3 * i + 1] > 63) {
        const fx = Math.round(x / 0.25), fz = Math.round(z / 0.25);
        const k = (fx + 20000) * 100000 + (fz + 20000);
        floorN.set(k, (floorN.get(k) || 0) + 1);
      }
      seen++;
    }
  }
  log('  running', seen.toLocaleString(), 'points,', buckets.filter(Boolean).length, 'sections');
}

if (seen !== meta.count) {
  console.error('POINT COUNT MISMATCH', seen, 'vs', meta.count);
  process.exit(1);
}

fs.mkdirSync(OUT, { recursive: true });
for (const f of fs.readdirSync(OUT)) fs.unlinkSync(path.join(OUT, f));

const sections = [];
let totalBytes = 0;
for (let id = 0; id < buckets.length; id++) {
  const b = buckets[id];
  if (!b || !b.n) continue;
  flush(b);
  const body = Buffer.concat(b.parts, b.n * 10);
  if (body.length !== b.n * 10) throw new Error('length mismatch section ' + id);
  if (body.length + 8 > MAX_FILE) {
    console.error('Section ' + id + ' is ' + body.length + ' bytes, over the ' + MAX_FILE + ' cap. Re-run with a shorter section.');
    process.exit(2);
  }
  const head = Buffer.alloc(8);
  head.writeUInt32LE(0x43455343, 0);
  head.writeUInt32LE(b.n, 4);
  const name = 'sec_' + String(id).padStart(2, '0') + '.bin';
  fs.writeFileSync(path.join(OUT, name), Buffer.concat([head, body]));
  const cx = (b.minx + b.maxx) / 2, cy = (b.miny + b.maxy) / 2, cz = (b.minz + b.maxz) / 2;
  const r = 0.5 * Math.hypot(b.maxx - b.minx, b.maxy - b.miny, b.maxz - b.minz);
  const bytes = body.length + 8;
  totalBytes += bytes;
  sections.push({
    id, s0: id * SECTION_M, s1: (id + 1) * SECTION_M, n: b.n, file: 'data-sec/' + name, bytes,
    c: [Number(cx.toFixed(3)), Number(cy.toFixed(3)), Number(cz.toFixed(3))],
    r: Number(r.toFixed(3))
  });
  log('wrote', name, b.n.toLocaleString(), 'pts', (bytes / 1e6).toFixed(2), 'MB');
}

const footprint = [];
for (const [k, c] of floorN) {
  if (c < 6) continue;
  const ix = Math.floor(k / 100000) - 20000;
  const iz = (k % 100000) - 20000;
  footprint.push([ix, iz]);
}

const index = {
  source: 'data-hd registered cloud',
  count: seen,
  voxel_m: 0.0125,
  sectionLen: SECTION_M,
  pathLen: Number(pathLen.toFixed(3)),
  bmin, ext,
  bytes: totalBytes,
  sections,
  footprint
};
fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify(index));
log('TOTAL', sections.length, 'sections', (totalBytes / 1e6).toFixed(1), 'MB', 'footprint', footprint.length);
log('largest', Math.max(...sections.map(s => s.bytes)));

let check = 0;
for (const s of sections) {
  const fd = fs.openSync(path.join(ROOT, s.file), 'r');
  const h = Buffer.alloc(8);
  fs.readSync(fd, h, 0, 8, 0);
  fs.closeSync(fd);
  if (h.readUInt32LE(0) !== 0x43455343) throw new Error('bad magic ' + s.file);
  if (h.readUInt32LE(4) !== s.n) throw new Error('bad count ' + s.file);
  check += s.n;
}
if (check !== seen) throw new Error('reread count ' + check);
log('verified', check.toLocaleString(), 'points');
