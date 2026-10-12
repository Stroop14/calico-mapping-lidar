/* Build a walk payload in the browser. The scan never leaves the machine. */
(function () {
  function lasCount(view, headerSize, versionMinor, legacy) {
    if (versionMinor >= 4 && legacy === 0 && headerSize >= 375) {
      var lo = view.getUint32(247, true);
      var hi = view.getUint32(251, true);
      return hi * 4294967296 + lo;
    }
    return legacy;
  }

  function readLas(buf) {
    var u8 = new Uint8Array(buf);
    if (u8.length < 227 || u8[0] !== 76 || u8[1] !== 65 || u8[2] !== 83 || u8[3] !== 70) {
      throw new Error("not a LAS file");
    }
    var sniff = "";
    var sniffN = Math.min(8000, u8.length);
    for (var s = 0; s < sniffN; s++) sniff += String.fromCharCode(u8[s]);
    if (sniff.toLowerCase().indexOf("laszip") !== -1) {
      throw new Error("This is compressed LAZ. In CloudCompare use File, Save, and choose LAS.");
    }
    var view = new DataView(buf);
    var versionMinor = u8[25];
    var headerSize = view.getUint16(94, true);
    var offset = view.getUint32(96, true);
    var fmt = u8[104];
    var recLen = view.getUint16(105, true);
    var n = lasCount(view, headerSize, versionMinor, view.getUint32(107, true));
    if (fmt > 10 || recLen < 12) throw new Error("unsupported LAS point format " + fmt);
    var maxN = Math.floor((buf.byteLength - offset) / recLen);
    if (!(maxN > 0)) throw new Error("LAS file has no points");
    if (n > maxN || n <= 0) n = maxN;
    var sx = view.getFloat64(131, true), sy = view.getFloat64(139, true), sz = view.getFloat64(147, true);
    var ox = view.getFloat64(155, true), oy = view.getFloat64(163, true), oz = view.getFloat64(171, true);
    var stride = Math.max(1, Math.ceil(n / 6000000));
    var keep = Math.ceil(n / stride);
    var xyz = new Float32Array(keep * 3);
    var w = 0;
    for (var i = 0; i < n; i += stride) {
      var p = offset + i * recLen;
      xyz[w++] = view.getInt32(p, true) * sx + ox;
      xyz[w++] = view.getInt32(p + 4, true) * sy + oy;
      xyz[w++] = view.getInt32(p + 8, true) * sz + oz;
    }
    return xyz.subarray(0, w);
  }

  function readPly(buf) {
    var u8 = new Uint8Array(buf);
    var headerEnd = -1;
    for (var i = 0; i < u8.length - 10; i++) {
      if (u8[i] === 101 && u8[i + 1] === 110 && u8[i + 2] === 100 && u8[i + 3] === 95) {
        var line = "";
        for (var k = i; k < Math.min(u8.length, i + 20); k++) line += String.fromCharCode(u8[k]);
        if (line.indexOf("end_header") === 0) {
          headerEnd = i;
          while (headerEnd < u8.length && u8[headerEnd] !== 10) headerEnd++;
          headerEnd++;
          break;
        }
      }
    }
    if (headerEnd < 0) throw new Error("PLY header is missing");
    var header = "";
    for (var h = 0; h < headerEnd; h++) header += String.fromCharCode(u8[h]);
    if (header.indexOf("binary_big_endian") !== -1) throw new Error("big-endian PLY is not supported");
    var ascii = header.indexOf("format ascii") !== -1;
    var n = 0, inVertex = false, props = [];
    var types = { char: 1, int8: 1, uchar: 1, uint8: 1, short: 2, int16: 2, ushort: 2, uint16: 2, int: 4, int32: 4, uint: 4, uint32: 4, float: 4, float32: 4, double: 8, float64: 8 };
    header.split(/\r?\n/).forEach(function (line) {
      var parts = line.trim().split(/\s+/);
      if (parts[0] === "element") {
        inVertex = parts[1] === "vertex";
        if (inVertex) n = parseInt(parts[2], 10);
      } else if (inVertex && parts[0] === "property" && parts[1] !== "list") {
        props.push({ name: parts[2], type: parts[1], size: types[parts[1]] || 0 });
      }
    });
    var names = props.map(function (p) { return p.name; });
    ["x", "y", "z"].forEach(function (axis) {
      if (names.indexOf(axis) < 0) throw new Error("PLY has no " + axis);
    });
    if (ascii) {
      var body = "";
      for (var b = headerEnd; b < u8.length; b++) body += String.fromCharCode(u8[b]);
      var rows = [];
      var lines = body.split(/\r?\n/);
      for (var li = 0; li < lines.length && rows.length < n; li++) {
        var cols = lines[li].trim().split(/\s+/);
        if (cols.length < 3) continue;
        rows.push([parseFloat(cols[names.indexOf("x")]), parseFloat(cols[names.indexOf("y")]), parseFloat(cols[names.indexOf("z")])]);
      }
      var out = new Float32Array(rows.length * 3);
      for (var r = 0; r < rows.length; r++) { out[r * 3] = rows[r][0]; out[r * 3 + 1] = rows[r][1]; out[r * 3 + 2] = rows[r][2]; }
      return out;
    }
    var rec = 0;
    props.forEach(function (p) { rec += p.size; });
    var view = new DataView(buf, headerEnd);
    var stride = Math.max(1, Math.ceil(n / 6000000));
    var keep = Math.ceil(n / stride);
    var xyz = new Float32Array(keep * 3);
    var w = 0;
    function num(p, o) {
      var t = p.type;
      if (t === "float" || t === "float32") return view.getFloat32(o, true);
      if (t === "double" || t === "float64") return view.getFloat64(o, true);
      if (t === "int" || t === "int32") return view.getInt32(o, true);
      if (t === "uint" || t === "uint32") return view.getUint32(o, true);
      if (t === "short" || t === "int16") return view.getInt16(o, true);
      if (t === "ushort" || t === "uint16") return view.getUint16(o, true);
      if (t === "char" || t === "int8") return view.getInt8(o);
      return view.getUint8(o);
    }
    for (var i = 0; i < n; i += stride) {
      var base = i * rec, off = 0;
      var x = 0, y = 0, z = 0;
      for (var pi = 0; pi < props.length; pi++) {
        var v = num(props[pi], base + off);
        if (props[pi].name === "x") x = v;
        else if (props[pi].name === "y") y = v;
        else if (props[pi].name === "z") z = v;
        off += props[pi].size;
      }
      xyz[w++] = x; xyz[w++] = y; xyz[w++] = z;
    }
    return xyz.subarray(0, w);
  }

  function readXyz(buf) {
    var text = new TextDecoder("utf-8", { fatal: false }).decode(new Uint8Array(buf));
    var lines = text.split(/\r?\n/);
    var rows = [];
    for (var i = 0; i < lines.length; i++) {
      var parts = lines[i].replace(/,/g, " ").trim().split(/\s+/);
      if (parts.length < 3) continue;
      var x = parseFloat(parts[0]), y = parseFloat(parts[1]), z = parseFloat(parts[2]);
      if (isFinite(x) && isFinite(y) && isFinite(z)) rows.push(x, y, z);
    }
    if (!rows.length) throw new Error("no XYZ rows");
    if (rows.length / 3 > 6000000) {
      var stride = Math.ceil((rows.length / 3) / 6000000);
      var thin = [];
      for (var p = 0; p < rows.length; p += stride * 3) thin.push(rows[p], rows[p + 1], rows[p + 2]);
      return new Float32Array(thin);
    }
    return new Float32Array(rows);
  }

  function readCloud(name, buf) {
    var ext = (name.split(".").pop() || "").toLowerCase();
    if (ext === "las") return readLas(buf);
    if (ext === "laz") throw new Error("This is compressed LAZ. In CloudCompare use File, Save, and choose LAS.");
    if (ext === "ply") return readPly(buf);
    if (ext === "xyz" || ext === "txt" || ext === "csv") return readXyz(buf);
    throw new Error(name + ": use .las, .ply, .xyz, or .txt");
  }

  function concat(parts) {
    var n = 0;
    for (var i = 0; i < parts.length; i++) n += parts[i].length;
    var out = new Float32Array(n);
    var o = 0;
    for (var j = 0; j < parts.length; j++) { out.set(parts[j], o); o += parts[j].length; }
    return out;
  }

  function sampleIdx(n, cap) {
    var m = Math.min(n, cap);
    var idx = new Uint32Array(m);
    if (m === n) { for (var i = 0; i < n; i++) idx[i] = i; return idx; }
    for (var k = 0; k < m; k++) idx[k] = Math.floor(k * n / m);
    return idx;
  }

  function medianOf(xyz, axis, idx) {
    var a = new Float32Array(idx.length);
    for (var i = 0; i < idx.length; i++) a[i] = xyz[idx[i] * 3 + axis];
    a.sort();
    return a[(a.length / 2) | 0];
  }

  function dropFar(xyz) {
    var n = xyz.length / 3;
    var idx = sampleIdx(n, 40000);
    var cx = medianOf(xyz, 0, idx), cy = medianOf(xyz, 1, idx), cz = medianOf(xyz, 2, idx);
    var dist = new Float32Array(idx.length);
    for (var i = 0; i < idx.length; i++) {
      var p = idx[i] * 3;
      var dx = xyz[p] - cx, dy = xyz[p + 1] - cy, dz = xyz[p + 2] - cz;
      dist[i] = Math.sqrt(dx * dx + dy * dy + dz * dz);
    }
    dist.sort();
    var q = dist[Math.min(dist.length - 1, Math.floor(0.99 * (dist.length - 1)))];
    var limit = Math.max(q * 1.5, 1);
    var keep = [];
    var dropped = 0;
    for (var j = 0; j < n; j++) {
      var o = j * 3;
      var dx2 = xyz[o] - cx, dy2 = xyz[o + 1] - cy, dz2 = xyz[o + 2] - cz;
      if (dx2 * dx2 + dy2 * dy2 + dz2 * dz2 <= limit * limit) keep.push(xyz[o], xyz[o + 1], xyz[o + 2]);
      else dropped++;
    }
    return { xyz: new Float32Array(keep), limit: limit, dropped: dropped };
  }

  function voxel(xyz, cell) {
    var n = xyz.length / 3;
    var map = new Map();
    for (var i = 0; i < n; i++) {
      var o = i * 3;
      var key = Math.floor(xyz[o] / cell) + "," + Math.floor(xyz[o + 1] / cell) + "," + Math.floor(xyz[o + 2] / cell);
      if (!map.has(key)) map.set(key, i);
    }
    var out = new Float32Array(map.size * 3);
    var w = 0;
    map.forEach(function (i) {
      var o = i * 3;
      out[w++] = xyz[o]; out[w++] = xyz[o + 1]; out[w++] = xyz[o + 2];
    });
    return out;
  }

  function floorHeight(xyz) {
    var n = xyz.length / 3;
    var cell = 0.5;
    var buckets = new Map();
    var ij = new Int32Array(n * 2);
    var minI = 1e15, minJ = 1e15;
    for (var i = 0; i < n; i++) {
      var ix = Math.floor(xyz[i * 3] / cell);
      var iz = Math.floor(xyz[i * 3 + 2] / cell);
      if (ix < minI) minI = ix;
      if (iz < minJ) minJ = iz;
      ij[i * 2] = ix; ij[i * 2 + 1] = iz;
    }
    for (var k = 0; k < n; k++) {
      var key = (ij[k * 2] - minI) + "," + (ij[k * 2 + 1] - minJ);
      var arr = buckets.get(key);
      if (!arr) { arr = []; buckets.set(key, arr); }
      arr.push(xyz[k * 3 + 1]);
    }
    var floorAt = new Map();
    buckets.forEach(function (arr, key) {
      arr.sort(function (a, b) { return a - b; });
      floorAt.set(key, arr[Math.min(arr.length - 1, Math.floor(0.08 * (arr.length - 1)))]);
    });
    var h = new Float32Array(n);
    for (var p = 0; p < n; p++) {
      var key2 = (ij[p * 2] - minI) + "," + (ij[p * 2 + 1] - minJ);
      var meters = xyz[p * 3 + 1] - floorAt.get(key2);
      if (meters < 0) meters = 0;
      if (meters > 2.6) meters = 2.6;
      h[p] = meters;
    }
    return h;
  }

  function estimateNormals(xyz, cell) {
    var n = xyz.length / 3;
    var occ = new Map();
    var q = new Int32Array(n * 3);
    var min = [1e15, 1e15, 1e15];
    for (var i = 0; i < n; i++) {
      for (var a = 0; a < 3; a++) {
        var v = Math.floor(xyz[i * 3 + a] / cell);
        q[i * 3 + a] = v;
        if (v < min[a]) min[a] = v;
      }
    }
    for (var j = 0; j < n; j++) {
      var key = (q[j * 3] - min[0]) + "," + (q[j * 3 + 1] - min[1]) + "," + (q[j * 3 + 2] - min[2]);
      occ.set(key, j);
    }
    var nrm = new Int8Array(n * 3);
    var neigh = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
    occ.forEach(function (i, key) {
      var parts = key.split(",");
      var x = +parts[0], y = +parts[1], z = +parts[2];
      var nx = 0, ny = 0, nz = 0;
      for (var t = 0; t < neigh.length; t++) {
        var kk = (x + neigh[t][0]) + "," + (y + neigh[t][1]) + "," + (z + neigh[t][2]);
        if (!occ.has(kk)) { nx += neigh[t][0]; ny += neigh[t][1]; nz += neigh[t][2]; }
      }
      var len = Math.sqrt(nx * nx + ny * ny + nz * nz);
      if (len < 1e-6) { nx = 0; ny = 1; nz = 0; len = 1; }
      nrm[i * 3] = Math.max(-127, Math.min(127, Math.round(nx / len * 127)));
      nrm[i * 3 + 1] = Math.max(-127, Math.min(127, Math.round(ny / len * 127)));
      nrm[i * 3 + 2] = Math.max(-127, Math.min(127, Math.round(nz / len * 127)));
    });
    return nrm;
  }

  function centerline(xyz, h) {
    var n = xyz.length / 3;
    var mx = 0, mz = 0;
    for (var i = 0; i < n; i++) { mx += xyz[i * 3]; mz += xyz[i * 3 + 2]; }
    mx /= n; mz /= n;
    var xx = 0, xz = 0, zz = 0;
    for (var j = 0; j < n; j++) {
      var dx = xyz[j * 3] - mx, dz = xyz[j * 3 + 2] - mz;
      xx += dx * dx; xz += dx * dz; zz += dz * dz;
    }
    var tr = xx + zz;
    var det = xx * zz - xz * xz;
    var disc = Math.sqrt(Math.max(0, tr * tr / 4 - det));
    var l1 = tr / 2 + disc;
    var vx, vz;
    if (Math.abs(xz) > 1e-6) { vx = xz; vz = l1 - xx; }
    else if (xx >= zz) { vx = 1; vz = 0; }
    else { vx = 0; vz = 1; }
    var vlen = Math.sqrt(vx * vx + vz * vz) || 1;
    vx /= vlen; vz /= vlen;
    var tmin = 1e15, tmax = -1e15;
    var t = new Float32Array(n);
    for (var k = 0; k < n; k++) {
      t[k] = (xyz[k * 3] - mx) * vx + (xyz[k * 3 + 2] - mz) * vz;
      if (t[k] < tmin) tmin = t[k];
      if (t[k] > tmax) tmax = t[k];
    }
    var step = 2;
    var bins = Math.max(4, Math.floor((tmax - tmin) / step));
    var path = [];
    for (var b = 0; b < bins; b++) {
      var a0 = tmin + (tmax - tmin) * b / bins;
      var a1 = tmin + (tmax - tmin) * (b + 1) / bins;
      var sx = 0, sy = 0, sz = 0, sf = 0, c = 0;
      var floors = [];
      for (var p = 0; p < n; p++) {
        if (t[p] < a0 || (b < bins - 1 ? t[p] >= a1 : t[p] > a1)) continue;
        sx += xyz[p * 3]; sy += xyz[p * 3 + 1]; sz += xyz[p * 3 + 2];
        floors.push(xyz[p * 3 + 1] - h[p]);
        c++;
      }
      if (c < 8) continue;
      floors.sort(function (u, v) { return u - v; });
      path.push([sx / c, floors[(floors.length / 2) | 0] + 1.6, sz / c]);
    }
    if (path.length < 2) {
      var ax = 0, ay = 0, az = 0;
      for (var q = 0; q < n; q++) { ax += xyz[q * 3]; ay += xyz[q * 3 + 1]; az += xyz[q * 3 + 2]; }
      ax /= n; ay /= n; az /= n;
      path = [[ax, ay + 1.6, az], [ax, ay + 1.6, az + 1]];
    }
    return path;
  }

  function b64(bytes) {
    var u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    var s = "";
    var chunk = 0x8000;
    for (var i = 0; i < u8.length; i += chunk) {
      var sub = u8.subarray(i, Math.min(i + chunk, u8.length));
      s += String.fromCharCode.apply(null, sub);
    }
    return btoa(s);
  }

  function build(data) {
    var parts = [];
    for (var i = 0; i < data.files.length; i++) parts.push(readCloud(data.files[i].name, data.files[i].buffer));
    var xyz = parts.length === 1 ? parts[0] : concat(parts);
    var far = dropFar(xyz);
    xyz = far.xyz;
    var cell = data.cell || 0.02;
    var maxPoints = data.maxPoints || 1500000;
    var thin = voxel(xyz, cell);
    while (maxPoints > 0 && thin.length / 3 > maxPoints && cell < 5) {
      cell *= 1.2;
      thin = voxel(xyz, cell);
    }
    var h = floorHeight(thin);
    var tone = new Uint8Array(h.length);
    for (var t = 0; t < h.length; t++) {
      var toneF = h[t] / 2.6 * 0.902;
      if (toneF < 0) toneF = 0;
      if (toneF > 0.9) toneF = 0.9;
      tone[t] = Math.round(toneF * 255);
    }
    var nrm = estimateNormals(thin, Math.max(cell, 1e-3));
    var path = centerline(thin, h);
    var n = thin.length / 3;
    var ox = 0, oy = 0, oz = 0;
    for (var p = 0; p < n; p++) { ox += thin[p * 3]; oy += thin[p * 3 + 1]; oz += thin[p * 3 + 2]; }
    ox /= n; oy /= n; oz /= n;
    var rel = new Float32Array(thin.length);
    for (var r = 0; r < n; r++) {
      rel[r * 3] = thin[r * 3] - ox;
      rel[r * 3 + 1] = thin[r * 3 + 1] - oy;
      rel[r * 3 + 2] = thin[r * 3 + 2] - oz;
    }
    var relPath = path.map(function (pt) {
      return [Math.round((pt[0] - ox) * 1000) / 1000, Math.round((pt[1] - oy) * 1000) / 1000, Math.round((pt[2] - oz) * 1000) / 1000];
    });
    var colors = data.colors;
    return {
      n: n,
      cell: cell,
      dropped: far.dropped,
      floor: colors.floor,
      low: colors.low,
      wall: colors.wall,
      ceil: colors.ceil,
      path: relPath,
      xyz: b64(rel),
      tone: b64(tone),
      nrm: b64(nrm)
    };
  }

  self.onmessage = function (e) {
    try {
      var payload = build(e.data);
      self.postMessage({ ok: true, payload: payload });
    } catch (err) {
      self.postMessage({ ok: false, error: (err && err.message) ? err.message : String(err) });
    }
  };
})();
