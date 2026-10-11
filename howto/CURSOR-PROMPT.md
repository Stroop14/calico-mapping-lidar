# Prompt — paste into Cursor

Install [Cursor](https://cursor.com). New chat. Model: **Opus 5.5**. If that is busy, **latest Grok**. Attach the LAS/LAZ and two or three wall photos. Paste everything under the line.

Silver King originals, if that is the job:

- https://github.com/Stroop14/calico-mapping-lidar/releases/download/v1.0.0/2019-03-24_20-06-37_ts_merged_Cloud.las
- https://github.com/Stroop14/calico-mapping-lidar/releases/download/v1.0.0/2019-03-24_20-36-01_ts_merged_Cloud.las
- Quality bar: https://stroop14.github.io/calico-mapping-lidar/

---

You are finishing a handheld LiDAR job I already specified. Do not invent a different pipeline. The product is (1) a plan looking straight down, (2) a true-scale side profile, (3) a browser first-person walk, at the quality of https://stroop14.github.io/calico-mapping-lidar/ or better.

Tools I already chose:

1. **CloudCompare** (https://www.cloudcompare.org/) — open, merge, inspect, subsample.
2. **Plan and profile from the same points** — not a second survey. Straight-down orthographic plan, north up. Side profile along the heading, 1 ft = 1 ft. CloudCompare can screenshot those views. If you cannot drive the GUI, plot the points (matplotlib is fine; that is how the Silver King map figures were drawn).
3. **three.js** first-person walk. Copy player-controls/first-person.js from https://github.com/Stroop14/calico-mapping-lidar if it helps.

If you cannot click CloudCompare, do the same operations in Python (laspy / numpy): merge, report RGB and intensity, subsample, keep the floor. One sentence that you did, then continue.

**Units: feet.** If the LAS is metric, convert once (× 3.28084) and stay there.

After each step, one line: what you did, files, point count.

**Step A — read**  
Every LAS/LAZ. Point count, bounds, CRS if any, whether RGB and intensity are actually filled. Silver King GeoSLAM: both were zero. If zero, do not fake scanner color.

**Step B — merge / clean**  
Two clouds: register and merge (Silver King 20:06 and 20:36). Origin at the portal. Silver King: 34.95117° N, 116.86307° W, adit N17.5°E unless the new scan says otherwise. Strip flyers. Do not crop the floor.

**Step C — subsample, keep the floor**  
About **½ inch** voxels. Up-facing floor stays. Cart-track grooves (ore-cart ruts, not railroad) must survive. About 5 million points for a mine this size (Silver King walk: 5.36 million).

**Step D — plan and profile**  
Same cloud.  
- Plan: orthographic, straight down, north up, true scale. Whole drift in frame.  
- Side profile: along the centreline, 1 ft across = 1 ft up. Optional extra 4× vertical exaggeration.  
Save PNGs. These are the “looking down into the cave” figures on the Silver King page. Not an orbit globe.

**Step E — first-person walk**  
three.js page, subsampled cloud:

- Click to look. WASD walk. Space/E up, Shift/Q down. R reset.
- Eye **5 ft 4 in** above the local floor. Follow grade.
- Soft walls: stray points do not hard-block; ~2 s in the rock, pull back.
- One warm **headlamp** on the camera, aimed slightly down. Not sun. Dark down-tunnel.
- Distances in feet.

**Step F — color from the photographs**  
Real RGB in the LAS: use it. Otherwise colorize from the attached wall photos:

- walls: reddish-brown clay, cream/ochre mottling
- floor: paler dusty tan; keep the tracks
- timber: brown
- light: lamp on the camera

Mottling yes. Flat paint no.

**Step G — landing page**  
Title, the plan and profile pictures, one button into the walk.

**Step H — look**  
Walk it. Compare to the photos and to https://stroop14.github.io/calico-mapping-lidar/  
Fix clay, tracks, timber, lamp, and whether you can still see the heading.

Do not lecture. Do not add a sun. Ship the walk and the maps.
