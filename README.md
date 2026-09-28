# Calico Mine Tunnel: LiDAR first-person walkthrough

GeoSLAM handheld scans from a CSUSB geology field class, 24 March 2019, inside the mine at Calico Ghost Town.
Source: two LAS files from github.com/Stroop14/calico-mapping-lidar, release v1.0.0.

## Open it
* **Easiest:** double-click `index.html`. It works over file:// because all data is loaded with classic `<script>` tags.
* **Or:** in this folder run `python3 -m http.server 8000`, then open http://localhost:8000/
* You need a desktop browser with WebGL. The first load decodes about 5.4 M points, which takes a few seconds.

## Controls
| Key | Action |
|---|---|
| Click | lock the pointer for mouse-look (Esc releases it) |
| W A S D / arrow keys | move |
| E or Space / Q or Shift | up / down |
| Mouse wheel or + / − | change speed (0.2–40 m/s, default 2 m/s) |
| C | turn collision on/off (on by default; uses a 10 cm occupancy grid built from the points) |
| L | headlamp on/off (off gives flat light) |
| M | switch to the Poisson surface mesh and back |
| B | turn back-face point culling on/off |
| [ ] | point size |
| P | auto fly-through along the tunnel centreline |
| R | reset to the portal · H hides the help panel |

## What's inside
* `data/pts_*.js`: 5,359,712 points (the merged cloud at a 2 cm voxel). Each chunk is 4 m and stores base64 uint16 positions, int8 normals and a uint8 "height above floor / material" byte.
* `data/mesh.js`: Poisson surface mesh (depth 11, built from a 4 cm cloud, trimmed and decimated to about 824k triangles).
* `data/meta.js`: chunk index, bounds, centreline path, and start pose.
* `lib/three.min.js`: three.js r149 (MIT).
* `screenshots/` (the `flythrough.mp4` video is in the walkthrough-v1 release zip)

Live: https://stroop14.github.io/calico-mapping-lidar/

Colour is **synthetic**. The LAS files have no RGB, and their intensity values are all zero. The shader uses a clay/ochre palette that varies with height above the local floor, plus procedural mottling. The floor gets a dusty tan, the timber portal frame gets brown, and a warm headlamp spotlight is used for lighting.
Coordinates: the scene origin is at the portal. The HUD shows the original LAS coordinates (local SLAM frame, no CRS).
