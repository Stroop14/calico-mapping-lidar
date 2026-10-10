# Silver King: LAS to a walkable page

This is what I ran on the 24 March 2019 GeoSLAM scans. Live result:

https://stroop14.github.io/calico-mapping-lidar/

Original LAS: [release v1.0.0](https://github.com/Stroop14/calico-mapping-lidar/releases/tag/v1.0.0)

Work in **feet**. If the scanner exported metric, convert once at load (× 3.28084) and keep it in feet from then on.

## The walk (the actual product)

1. Two clouds, 20:06 and 20:36. Register / merge. Origin at the portal (34.95117° N, 116.86307° W). Adit N17.5°E.

2. Read RGB and intensity. On this unit both were zero. Do not invent scanner color.

3. Voxel about **½ inch**. Keep the floor. Acceptance test: the **cart-track grooves** on the floor of the drift (ore-cart ruts, not railroad). If they disappear, the voxel is too coarse or the floor got classified away.

4. First-person page, not an orbit viewer.
   - Eye **5 ft 4 in** above the local floor (a hair under a 6-ft eye). Follows grade. Ducks under low roof.
   - WASD, mouse-look. Phone gets a stick.
   - Soft walls: movement is not hard-blocked by stray points. About two seconds in the rock, pull back.
   - One **headlamp** on the camera, aimed slightly down, warm. Falloff down the drift. No sun.

5. Color from **two or three handheld photos** of the wall rock, same day if you have them.
   - walls: reddish-brown clay, cream / ochre mottling
   - floor: paler dusty tan; keep the tracks
   - timber portal: brown
   - light: lamp on the camera; shadows recede down-tunnel

   Match the photos. Mottling is right. A flat paint job is not.

6. Last look, against the photos: wall color, floor tracks, timber, light direction. Fix what is wrong.

Player code I am releasing (public domain): [`../player-controls/first-person.js`](../player-controls/first-person.js)

The Silver King walk adds floor-following from the point cloud, the lamp, and the pull-back. That is in the live page, not the drop-in file.

## Orbit viewer (surface / UAV only)

Different product. Kerry’s usual case: spin the cloud and measure.

[PotreeConverter 2.1.5](https://github.com/potree/PotreeConverter/releases/tag/2.1.5) (BSD):

```
PotreeConverter.exe scan.las -o C:\out --generate-page mine
cd C:\out
python -m http.server 8000
```

Open http://localhost:8000

If the scanner recorded RGB, you see it. If not, elevation or intensity. That is all it does. It will not walk a drift.

## What is field work vs webpage work

| Step | Who |
|---|---|
| Scan, register, export LAS | You. Already done. |
| PotreeConverter orbit page | One binary. No programmer. |
| Voxel, keep the floor, origin, bearing, eye height | The method above. I already tuned it on Silver King. |
| First-person page, WASD, lamp, photo color, final look | Webpage work. I built that. A student can reproduce it from this list; the list is the work. |

The prompt in [`CURSOR-PROMPT.md`](CURSOR-PROMPT.md) is that same list, for a student who is repeating **these** steps on a new LAS. It is not a substitute for the method.

## Next scan

LAS plus two or three wall photos (clay, floor tracks, timber). Same steps.
