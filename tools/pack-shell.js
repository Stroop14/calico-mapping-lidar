#!/usr/bin/env node
'use strict';
// Occupancy and floor grid from the 2 cm walkthrough cloud (data/pts_*.js).
// The full-detail cloud fills the air inside that shell, so it is not used for collision.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');

function loadCalico(file) {
  const ctx = { CALICO: { files: {}, addFile(i, a) { this.files[i] = a; } } };
  vm.runInNewContext(fs.readFileSync(file, 'utf8'), ctx, { filename: file });
  return ctx.CALICO;
}

const meta = loadCalico(path.join(ROOT, 'data/meta.js')).meta;
const bmin = meta.bmin, ext = meta.ext;
const OCC = 0.1, FCELL = 0.25, FY0 = -4, FYN = 120;
const occ = new Set();
const fgrid = new Map();
let seen = 0;
const files = fs.readdirSync(path.join(ROOT, 'data')).filter(f => /^pts_\d+\.js$/.test(f)).sort();
for (const file of files) {
  const fi = Number(file.slice(4, 7));
  const cal = loadCalico(path.join(ROOT, 'data', file));
  const arr = cal.files[fi];
  for (const ch of meta.chunks) {
    if (ch.f !== fi) continue;
    const raw = Buffer.from(arr[ch.i], 'base64');
    const n = ch.n;
    const pos = new Uint16Array(raw.buffer, raw.byteOffset, n * 3);
    const nrm = new Int8Array(raw.buffer, raw.byteOffset + n * 6, n * 3);
    for (let i = 0; i < n; i++) {
      const x = bmin[0] + pos[3 * i] / 65535 * ext[0];
      const y = bmin[1] + pos[3 * i + 1] / 65535 * ext[1];
      const z = bmin[2] + pos[3 * i + 2] / 65535 * ext[2];
      const ix = Math.floor(x / OCC), iy = Math.floor(y / OCC), iz = Math.floor(z / OCC);
      occ.add((ix + 2000) * 16777216 + (iy + 2000) * 4096 + (iz + 2000));
      const ny = nrm[3 * i + 1] / 127;
      if (ny > 0.5 || ny < -0.5) {
        const yi = Math.round((y - FY0) / 0.1);
        if (yi >= 0 && yi < FYN) {
          const fx = Math.round(x / FCELL), fz = Math.round(z / FCELL);
          const k = (fx + 20000) * 100000 + (fz + 20000);
          let h = fgrid.get(k);
          if (!h) { h = new Uint16Array(FYN * 2); h.fx = fx; h.fz = fz; fgrid.set(k, h); }
          const ii = yi + (ny > 0.5 ? 0 : FYN);
          if (h[ii] < 65535) h[ii]++;
        }
      }
      seen++;
    }
  }
  console.log(file, seen);
}
if (seen !== meta.count) { console.error('count', seen, meta.count); process.exit(1); }

const voxels = Buffer.allocUnsafe(occ.size * 6);
let o = 0;
for (const key of occ) {
  const iz = (key % 4096) - 2000;
  const iy = (Math.floor(key / 4096) % 4096) - 2000;
  const ix = (Math.floor(key / 16777216) % 4096) - 2000;
  voxels.writeInt16LE(ix, o); voxels.writeInt16LE(iy, o + 2); voxels.writeInt16LE(iz, o + 4);
  o += 6;
}
const cols = [];
for (const h of fgrid.values()) {
  const head = Buffer.allocUnsafe(4 + FYN * 2 * 2);
  head.writeInt16LE(h.fx, 0); head.writeInt16LE(h.fz, 2);
  Buffer.from(h.buffer).copy(head, 4);
  cols.push(head);
}
const head = Buffer.alloc(12);
head.writeUInt32LE(0x4C485343, 0);
head.writeUInt32LE(occ.size, 4);
head.writeUInt32LE(cols.length, 8);
const out = path.join(ROOT, 'data-sec/shell.bin');
fs.writeFileSync(out, Buffer.concat([head, voxels, ...cols]));
console.log('shell', occ.size, 'voxels', cols.length, 'columns', fs.statSync(out).size, 'bytes from', seen, 'points');
