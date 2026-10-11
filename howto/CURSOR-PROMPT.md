# Prompt — paste into Cursor

Install [Cursor](https://cursor.com). New chat. Model: **Opus 5.5**. If that is busy, **latest Grok**. Attach: the LAS/LAZ file(s), two or three photos of the wall rock (and the floor if you have them). Then paste everything under the line.

To reproduce Silver King itself, also attach or download:

- https://github.com/Stroop14/calico-mapping-lidar/releases/download/v1.0.0/2019-03-24_20-06-37_ts_merged_Cloud.las
- https://github.com/Stroop14/calico-mapping-lidar/releases/download/v1.0.0/2019-03-24_20-36-01_ts_merged_Cloud.las
- Quality bar: https://stroop14.github.io/calico-mapping-lidar/

---

You are finishing a terrestrial / handheld LiDAR job I already specified. Do not invent a different pipeline. Do not stop at an orbit viewer. The product is a browser first-person walk of the drift, at the quality of https://stroop14.github.io/calico-mapping-lidar/ or better.

I already chose the tools. Use them (or the same operations if a GUI cannot be driven):

1. **CloudCompare** (https://www.cloudcompare.org/) — open, merge, inspect, subsample. This is the desktop half of the job.
2. **PotreeConverter 2.1.5** (https://github.com/potree/PotreeConverter/releases/tag/2.1.5) — one orbit page for spinning the cloud. That is a side product, not the walk.
3. **three.js** first-person page for the walk. Copy my public-domain controls if they help: player-controls/first-person.js in https://github.com/Stroop14/calico-mapping-lidar

If you cannot click CloudCompare, do the identical operations in Python (laspy / numpy / open3d): merge, report RGB and intensity, subsample, keep the floor. Say so in one sentence and continue. Do not skip the operations.

**Units: feet.** If the LAS is metric, convert once at load (× 3.28084) and never go back. HUD, eye height, and walking speed in feet.

Do these steps in order. After each step, write one line: what you did, file names, point count.

**Step A — read the files**  
Open every LAS/LAZ I attached. Report: point count, bounding box, CRS if any, whether RGB is actually populated, whether intensity is actually populated. On the Silver King GeoSLAM both RGB and intensity were zero. If they are zero here, do not invent scanner color.

**Step B — CloudCompare (merge / clean)**  
If there are two clouds, register and merge (Silver King: the 20:06 and 20:36 setups). Origin at the portal. Silver King portal: 34.95117° N, 116.86307° W. Adit bearing N17.5°E unless the new scan says otherwise. Strip obvious flyers. Do not crop the floor.

**Step C — subsample, keep the floor**  
Voxel about **½ inch** (0.041 ft; 1.25 cm if you are still in metric before conversion). Up-facing floor points stay. Acceptance test: **cart-track grooves** on the floor of the drift (ore-cart ruts, not railroad). If they disappear, stop and fix the floor. Target on the order of 5 million points for a mine this size (Silver King walk shipped 5.36 million).

**Step D — Potree orbit page (75% product)**  
Run PotreeConverter on the merged LAS:

`PotreeConverter.exe merged.las -o orbit --generate-page mine`

Serve it. This is the spin-the-cloud page. Do not call this done.

**Step E — first-person walk (the actual product)**  
Build a three.js page (r149 or current is fine) that loads the subsampled cloud:

- Click canvas to look. WASD / arrows walk. Space or E up, Shift or Q down. R reset.
- Eye **5 ft 4 in** above the local floor. Follow grade. Duck under a low roof.
- Soft walls: stray points do not hard-block. If the camera sits in rock for about two seconds, pull back.
- One **warm headlamp** on the camera, aimed a few degrees down. Not outdoor sun. Shadows fall away down-tunnel. Dark at range.
- Distances on screen in feet (and metres in small type only if you must).
- Phone: a simple stick. Desktop: mouse look.

**Step F — color from the photographs**  
If RGB in the LAS is real, use it. If not, **colorize from the attached wall photos**. Those photos are the ground truth:

- walls: reddish-brown altered volcanic clay, cream / ochre mottling
- floor: paler dusty tan; keep the cart tracks
- timber portal: brown
- light: lamp on the camera

Mottling yes. A single flat paint no. Match hue to the photos, not to a generic sandstone preset.

**Step G — landing page**  
A simple first page: title, one button into the walk, optional plan/side view if you already have them. No academic poster. Link the Potree orbit page as “spin the cloud” if you built Step D.

**Step H — look at it**  
Walk the drift. Compare to the photos and to https://stroop14.github.io/calico-mapping-lidar/walk.html  

Fix: wall color, floor tracks, timber, lamp falloff, whether you can see the heading (not a wall of giant dots). Screenshot before you stop.

Do not lecture me about LiDAR. Do not add a sun, classroom markers, or a metric-only HUD. Ship the walk.
