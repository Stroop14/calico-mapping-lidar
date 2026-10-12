# Prompt — paste into Cursor

Cursor. New chat. **Opus 5.5** (Anthropic) or **latest Grok**. Attach: thinned LAS, walk-path CSV if you have it, two or three wall photos, and the `player-controls` folder. Paste under the line.

Silver King originals if that is the job:

- https://github.com/Stroop14/calico-mapping-lidar/releases/download/v1.0.0/2019-03-24_20-06-37_ts_merged_Cloud.las
- https://github.com/Stroop14/calico-mapping-lidar/releases/download/v1.0.0/2019-03-24_20-36-01_ts_merged_Cloud.las
- Quality bar: https://stroop14.github.io/calico-mapping-lidar/
- Player: player-controls/first-person.js (phone and computer)

---

Combine my CloudCompare output with the player. Do not invent a new pipeline. Product: plan (straight down), true-scale side profile, and a first-person walk, quality of https://stroop14.github.io/calico-mapping-lidar/ or better.

I already did the field-software half, or you will: CloudCompare merge, subsample **1.25 cm (½ inch)** — not 2 cm; that was too coarse. Keep the floor. Walk path = polyline on the floor from **in-point** (portal, just inside) to **out-point** (farthest heading the scanner reached). Eye **5 ft 4 in** above that line. Start a few feet inside the in-point, looking at the out-point. Guided tour follows the line out and back.

Point sprites, same as Silver King: computer **3 cm (1¼ in)**, min 1 px, max 30 px. Phone **4.5 cm (1¾ in)**, min 2.2 px, max 40 px. Exterior scatter can be 0.6× that. `[` `]` scales size. Do not let close-up points fill the heading.

**Feet.** If the LAS is metric, convert once (× 3.28084).

Use my player: `player-controls/first-person.js`. It must work on **computer and phone** (WASD + pointer lock on desktop; left stick + drag-to-look on a phone). Do not replace it with an orbit globe.

Steps, in order. One line after each: what you did, files, point count.

**A.** Read the LAS. Point count, bounds, RGB actually filled?, intensity actually filled? Silver King: both zero — do not fake scanner color.

**B.** Merge if two clouds. Origin at the portal. Silver King: 34.95117° N, 116.86307° W, adit N17.5°E unless the new scan says otherwise.

**C.** Subsample **1.25 cm (½ inch)**. Floor stays. Cart-track grooves (ore-cart ruts, not railroad) must survive. About **5.36 million** points on screen for a mine this size (Silver King stored 13.7 million at that voxel, then drew 5.36 million). On a phone, keep all floor points and about two of five wall points.

**D.** Walk path. If I attached a CSV of x,y,z, use it. If not, pick in-point at the portal and out-point at the far end of the main drift, and build a floor centreline between them.

**E.** Plan: orthographic, straight down, north up, whole drift in frame. Side profile along the path, 1 ft = 1 ft. Same points. Save PNGs.

**F.** three.js walk using my player. Point size as above (3 cm desktop / 4.5 cm phone). Headlamp on the camera, aimed slightly down. Distances in feet. Soft walls (stray points do not hard-block).

**G.** Color from the wall photos if the LAS has no RGB: reddish-brown clay, cream/ochre mottling, dusty tan floor, timber brown. Mottling yes. Flat paint no.

**H.** Simple page: plan, profile, button into the walk. Phone and computer.

**I.** Walk it. Fix clay, tracks, timber, lamp, heading visibility.

Do not lecture. Ship the walk.
