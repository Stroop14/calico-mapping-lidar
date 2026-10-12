#!/usr/bin/env python3
"""Build a walkable mine page from LAS/PLY scans and a few photographs.

The photographs supply the colors. The scan supplies the floor. The page is
the folder this writes: put that folder on any web host and the walk is public.

  python3 tools/mine-walk/make_walk.py drift.las --photos wall1.jpg wall2.jpg --out site

Open site/index.html through a local server, or upload the folder.
"""
import argparse
import base64
import shutil
import struct
import sys
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
THREE = REPO / "lib" / "three.min.js"


def read_las(path):
    data = Path(path).read_bytes()
    if data[:4] != b"LASF":
        raise SystemExit(f"{path}: not a LAS file")
    if b"laszip" in data[:8000].lower():
        raise SystemExit(f"{path}: this is compressed LAZ. In CloudCompare use File, Save, LAS.")
    version_minor = data[25]
    header_size = struct.unpack_from("<H", data, 94)[0]
    offset = struct.unpack_from("<I", data, 96)[0]
    fmt = data[104]
    rec_len = struct.unpack_from("<H", data, 105)[0]
    n = struct.unpack_from("<I", data, 107)[0]
    if version_minor >= 4 and n == 0 and header_size >= 375:
        n = struct.unpack_from("<Q", data, 247)[0]
    if fmt > 10 or rec_len < 12:
        raise SystemExit(f"{path}: unsupported LAS point format {fmt}")
    count = int(n)
    need = offset + count * rec_len
    if need > len(data):
        raise SystemExit(f"{path}: file ends before {count} points")
    scale = np.array(struct.unpack_from("<3d", data, 131))
    origin = np.array(struct.unpack_from("<3d", data, 155))
    raw = np.frombuffer(data, dtype=np.uint8, count=need)
    pts = raw[offset:need].reshape(count, rec_len)
    xyz_i = pts[:, :12].copy().view(np.int32).reshape(count, 3)
    return xyz_i.astype(np.float64) * scale + origin


def _ply_type(name):
    return {
        "char": "i1", "int8": "i1", "uchar": "u1", "uint8": "u1",
        "short": "i2", "int16": "i2", "ushort": "u2", "uint16": "u2",
        "int": "i4", "int32": "i4", "uint": "u4", "uint32": "u4",
        "float": "f4", "float32": "f4", "double": "f8", "float64": "f8",
    }[name]


def read_ply(path):
    raw = Path(path).read_bytes()
    sep = b"end_header\n" if b"end_header\n" in raw else b"end_header\r\n"
    header, _, rest = raw.partition(sep)
    text = header.decode("ascii", "replace")
    if "binary_big_endian" in text:
        raise SystemExit(f"{path}: big-endian PLY is not supported")
    ascii_fmt = "format ascii" in text
    n = 0
    props = []
    in_vertex = False
    for line in text.splitlines():
        parts = line.split()
        if len(parts) < 2:
            continue
        if parts[0] == "element":
            in_vertex = parts[1] == "vertex"
            if in_vertex:
                n = int(parts[2])
        elif in_vertex and parts[0] == "property" and parts[1] != "list":
            props.append((parts[2], _ply_type(parts[1])))
    names = [p[0] for p in props]
    for axis in ("x", "y", "z"):
        if axis not in names:
            raise SystemExit(f"{path}: PLY has no {axis}")
    if ascii_fmt:
        rows = []
        for line in rest.decode("ascii", "replace").splitlines():
            cols = line.split()
            if len(cols) < 3:
                continue
            rows.append([float(cols[names.index(a)]) for a in ("x", "y", "z")])
            if len(rows) == n:
                break
        return np.asarray(rows, dtype=np.float64)
    rec = np.frombuffer(rest, dtype=np.dtype(props), count=n)
    return np.column_stack([rec["x"], rec["y"], rec["z"]]).astype(np.float64)


def read_xyz(path):
    rows = []
    for line in Path(path).read_text(errors="replace").splitlines():
        parts = line.replace(",", " ").split()
        if len(parts) < 3:
            continue
        try:
            rows.append([float(parts[0]), float(parts[1]), float(parts[2])])
        except ValueError:
            continue
    if not rows:
        raise SystemExit(f"{path}: no XYZ rows")
    return np.asarray(rows, dtype=np.float64)


def read_cloud(path):
    ext = Path(path).suffix.lower()
    if ext == ".las":
        return read_las(path)
    if ext == ".laz":
        raise SystemExit(f"{path}: save LAZ as LAS in CloudCompare (File, Save).")
    if ext == ".ply":
        return read_ply(path)
    if ext in (".xyz", ".txt", ".csv"):
        return read_xyz(path)
    raise SystemExit(f"{path}: use .las, .ply, .xyz, or .txt")


def voxel_downsample(xyz, cell):
    if cell <= 0 or len(xyz) == 0:
        return xyz
    q = np.ascontiguousarray(np.floor(xyz / cell).astype(np.int64))
    key = q.view(np.dtype((np.void, q.dtype.itemsize * q.shape[1]))).ravel()
    _, idx = np.unique(key, return_index=True)
    return xyz[idx]


def drop_far(xyz, far):
    center = np.median(xyz, axis=0)
    dist = np.linalg.norm(xyz - center, axis=1)
    if far > 0:
        limit = far
    else:
        limit = max(float(np.quantile(dist, 0.99) * 1.5), 1.0)
    keep = dist <= limit
    return xyz[keep], limit, int((~keep).sum())


def floor_height(xyz, cell=0.5):
    """Local floor is the low edge of the points in each plan cell."""
    xz = xyz[:, [0, 2]]
    origin = xz.min(axis=0)
    ij = np.floor((xz - origin) / cell).astype(np.int64)
    ij -= ij.min(axis=0)
    nx = int(ij[:, 0].max()) + 1
    key = ij[:, 0] + ij[:, 1] * nx
    order = np.argsort(key, kind="mergesort")
    ks = key[order]
    bounds = np.flatnonzero(np.diff(ks)) + 1
    starts = np.r_[0, bounds]
    ends = np.r_[bounds, len(ks)]
    y = xyz[:, 1]
    floor_at = np.empty(int(key.max()) + 1, dtype=np.float64)
    for a, b in zip(starts, ends):
        floor_at[int(ks[a])] = np.quantile(y[order[a:b]], 0.08)
    h = (y - floor_at[key]).astype(np.float32)
    return h, floor_at, key, origin, cell, nx


def centerline(xyz, h, step=2.0):
    """A line along the long axis of the drift, eye 1.6 m above the floor."""
    xz = xyz[:, [0, 2]]
    mu = xz.mean(axis=0)
    _, eigvec = np.linalg.eigh(np.cov((xz - mu).T))
    axis = eigvec[:, -1]
    t = (xz - mu) @ axis
    t0, t1 = float(t.min()), float(t.max())
    bins = max(4, int((t1 - t0) / step))
    edges = np.linspace(t0, t1, bins + 1)
    path = []
    y = xyz[:, 1]
    for i in range(bins):
        m = (t >= edges[i]) & (t < edges[i + 1] if i < bins - 1 else t <= edges[i + 1])
        if m.sum() < 8:
            continue
        floor = float(np.quantile(y[m] - h[m], 0.5))
        p = xyz[m].mean(axis=0)
        p[1] = floor + 1.6
        path.append(p)
    if len(path) < 2:
        p0 = xyz.mean(axis=0)
        p0[1] += 1.6
        path = [p0, p0 + np.array([0, 0, 1.0])]
    return np.asarray(path, dtype=np.float64)


def photo_colors(paths, floor_path=None, wall_path=None):
    from PIL import Image

    def median_rgb(im, box):
        crop = im.crop(box).convert("RGB").resize((64, 32))
        arr = np.asarray(crop).reshape(-1, 3).astype(np.float64)
        lum = arr.mean(axis=1)
        keep = (lum > 18) & (lum < 245)
        sel = arr[keep] if int(keep.sum()) > 30 else arr
        return np.median(sel, axis=0)

    def whole(path):
        im = Image.open(path).convert("RGB")
        w, h = im.size
        return median_rgb(im, (0, 0, w, h))

    if floor_path and wall_path:
        floor = whole(floor_path)
        wall = whole(wall_path)
        ceil = wall * 0.82 + np.array([18, 8, 6])
        return floor, wall, ceil

    floors, walls, ceils = [], [], []
    for path in paths:
        im = Image.open(path).convert("RGB")
        w, h = im.size
        floors.append(median_rgb(im, (0, int(h * 0.72), w, h)))
        walls.append(median_rgb(im, (0, int(h * 0.28), w, int(h * 0.72))))
        ceils.append(median_rgb(im, (0, 0, w, int(h * 0.28))))
    return np.median(floors, axis=0), np.median(walls, axis=0), np.median(ceils, axis=0)


def rgb_list(c):
    return [int(round(x)) for x in c]


def main():
    ap = argparse.ArgumentParser(description="Publish a walkable scan colored from photographs")
    ap.add_argument("scans", nargs="+", help="LAS, PLY, or XYZ already in one frame")
    ap.add_argument("--photos", nargs="*", default=[], help="photographs of the rock")
    ap.add_argument("--floor", help="one photo that is mostly floor")
    ap.add_argument("--wall", help="one photo that is mostly wall")
    ap.add_argument("--far", type=float, default=0.0, help="drop points farther than this many meters from the middle")
    ap.add_argument("--cell", type=float, default=0.02, help="voxel size in meters")
    ap.add_argument("--max-points", type=int, default=1_500_000)
    ap.add_argument("--out", default="site", help="folder to publish")
    args = ap.parse_args()

    if bool(args.floor) ^ bool(args.wall):
        raise SystemExit("Pass both --floor and --wall, or neither and use --photos.")

    parts = []
    for name in args.scans:
        xyz = read_cloud(name)
        print(f"{name}: {len(xyz):,} points")
        parts.append(xyz)
    xyz = np.vstack(parts) if len(parts) > 1 else parts[0]
    print(f"combined: {len(xyz):,}")
    xyz, limit, dropped = drop_far(xyz, args.far)
    print(f"within {limit:.1f} m of the middle, dropped {dropped:,}, {len(xyz):,} left")

    cell = args.cell
    thin = voxel_downsample(xyz, cell)
    if args.max_points > 0:
        while len(thin) > args.max_points and cell < 5:
            cell *= 1.2
            thin = voxel_downsample(xyz, cell)
    print(f"voxel {cell:.4f} m -> {len(thin):,} points")

    h, _, _, _, _, _ = floor_height(thin, cell=0.5)
    h = np.clip(h, 0, 3.0)
    path = centerline(thin, h)
    origin = thin.mean(axis=0)
    rel = (thin - origin).astype(np.float32)
    rel_path = (path - origin).astype(np.float64)

    if args.photos or (args.floor and args.wall):
        floor, wall, ceil = photo_colors(args.photos, args.floor, args.wall)
        print(f"colors from photos  floor {rgb_list(floor)}  wall {rgb_list(wall)}  back {rgb_list(ceil)}")
    else:
        floor = np.array([153, 138, 107])
        wall = np.array([194, 130, 92])
        ceil = np.array([204, 107, 79])
        print("no photos given, using a clay palette")

    payload = {
        "n": int(len(rel)),
        "cell": float(cell),
        "floor": rgb_list(floor),
        "wall": rgb_list(wall),
        "ceil": rgb_list(ceil),
        "path": rel_path.round(3).tolist(),
        "xyz": base64.b64encode(rel.tobytes()).decode("ascii"),
        "h": base64.b64encode(np.clip(h / 3.0 * 255, 0, 255).astype(np.uint8).tobytes()).decode("ascii"),
    }
    # Write without a json dependency dance: the arrays are numbers, the blobs are ascii.
    import json
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    (out / "cloud.js").write_text("window.CLOUD=" + json.dumps(payload) + ";\n", encoding="ascii")
    shutil.copy(HERE / "viewer.html", out / "index.html")
    if not THREE.exists():
        raise SystemExit(f"missing {THREE}")
    shutil.copy(THREE, out / "three.min.js")
    (out / "HOW.txt").write_text(
        "This folder is the walk.\n"
        "Publish it by putting the folder on a web host, or on GitHub Pages.\n"
        "On this computer: python3 -m http.server 8000\n"
        "then open http://localhost:8000/\n"
        "Desktop: click, mouse looks, W A S D moves, P plays the walk.\n"
        "Phone: left side walks, right side looks.\n",
        encoding="utf-8",
    )
    print(f"wrote {out.resolve()}")
    print("Publish that folder. On this machine: python3 -m http.server 8000")


if __name__ == "__main__":
    main()
