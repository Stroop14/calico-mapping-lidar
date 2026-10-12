# Publish a walk from a scan and a few photos

One command. The photographs supply the floor, wall, and back colors. The scan supplies the floor height and a line down the drift. The folder it writes is the site.

```
python3 tools/mine-walk/make_walk.py drift_a.las drift_b.las --photos floor_and_wall.jpg another.jpg --out site
```

The scans already have to share one frame. Line them up in CloudCompare first if they do not, and save LAS. LAZ has to be saved as LAS (File, Save). The same steps, and a Cursor prompt that rebuilds this program, are on the site at [make.html](../../make.html).

A photo is read in bands: the bottom is the floor color, the middle is the wall, the top is the back. To force it, pass one photo of the floor and one of the wall:

```
python3 tools/mine-walk/make_walk.py drift.las --floor floor.jpg --wall wall.jpg --out site
```

Points far from the mine are dropped. What is in the drift stays, including a minecart or a person the scanner caught. The cloud is thinned to 2 cm, and capped near 1.5 million points so a phone and a desktop can both open it. Use `--cell 0.0125 --max-points 0` for a finer copy. The page uses the same headlamp, fog, mottling, and point size as the Silver King walk. Desktop starts at the smaller dots. The phone starts at the larger dots. `[` and `]` change the size. `L` toggles the lamp.

```
cd site
python3 -m http.server 8000
```

Open http://localhost:8000/. Play walks the centerline. Click, then the mouse looks and W A S D moves. On a phone the left side walks and the right side looks. Reverse flips which end is the start.

Publish the `site` folder. Any static host or GitHub Pages can serve it. Desktop and phone open the same address.
