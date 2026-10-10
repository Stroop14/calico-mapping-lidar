# LiDAR → web, the short version

You have a LAS/LAZ. Two endpoints. Pick one.

## A. Orbit viewer — no AI

For surface scans, UAV, outcrops, anything you want to spin and measure.

1. Export LAS or LAZ from the scanner / CloudCompare.
2. [PotreeConverter 2.1.5](https://github.com/potree/PotreeConverter/releases/tag/2.1.5) (BSD).
3. One command:

```
PotreeConverter.exe scan.las -o C:\out --generate-page mine
```

4. Serve the folder. Browser security will not open it as a file:// page.

```
cd C:\out
python -m http.server 8000
```

Open http://localhost:8000

If the scanner recorded RGB, Potree shows it. If not, you get elevation or intensity. That is all.

## B. First-person walk — this is the webpage

For a drift you want to walk. Same LAS.

Live example: https://stroop14.github.io/calico-mapping-lidar/

What we did on Silver King (24 March 2019, two GeoSLAM LAS, release `v1.0.0`):

1. Merge / register the clouds.
2. Voxel downsample (~1–2 cm). Keep the floor. The cart-track grooves on the floor are the visual test — if they vanish, the voxel is too coarse.
3. Put the origin at the portal. Eye height ~1.64 m above the local floor.
4. Color from two or three handheld photos of the wall, not from the scanner. This unit stored RGB = 0 and intensity = 0.
5. One warm headlamp on the camera, aimed a few degrees down. Dark falloff down the drift. Not outdoor sun.
6. WASD + mouse look. Phone gets a stick. Soft walls: you can clip; after ~2 s outside you get pulled back.

Player code (public domain): [`../player-controls/first-person.js`](../player-controls/first-person.js)

## Where AI is needed

| Step | AI? |
|---|---|
| Scan, register, export LAS | No. You already do this. |
| PotreeConverter (orbit page) | No. One binary. |
| First-person page, WASD, touch stick | Yes — or copy the player file. |
| Color from 2–3 wall photos; lamp; shadows | Yes. This is matching, not mapping. |
| Final look: tracks on the floor, timber, light direction vs the photos | Yes, as a check. Your eye still wins. |

AI does not invent the geology. It wires the last 20%: the page, the controls, and making the clay look like the photos.

## Color, stated cleanly

Assigned, not measured. Sample the wall rock from the photographs:

- walls: reddish-brown clay, cream / ochre mottling
- floor: paler dusty tan; keep the cart-track grooves
- timber portal: brown
- light: single warm source at the camera; shadows recede down-tunnel

If you have a scanner with a camera, skip this and keep the real RGB.

## Do it with Cursor instead of hiring a programmer

1. Install [Cursor](https://cursor.com).
2. Model: **Opus 5.5**.
3. New chat. Attach the LAS (or a 5–20 million point subset), **two or three wall photos**, and optionally a screenshot of https://stroop14.github.io/calico-mapping-lidar/walk.html
4. Paste [`CURSOR-PROMPT.md`](CURSOR-PROMPT.md)

Original scans: [release v1.0.0](https://github.com/Stroop14/calico-mapping-lidar/releases/tag/v1.0.0)
