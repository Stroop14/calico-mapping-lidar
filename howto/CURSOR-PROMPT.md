This is not “make me a viewer.” It is a reproduction of the Silver King method. Paste it only after the LAS and the wall photos are attached. Point the model at RECIPE.md and the live walk.

---

Reproduce the Silver King Mine walkthrough I already built. Do not invent a different pipeline.

Live reference (quality bar): https://stroop14.github.io/calico-mapping-lidar/
Source LAS: https://github.com/Stroop14/calico-mapping-lidar/releases/tag/v1.0.0
My method: howto/RECIPE.md
My player (public domain, feet): player-controls/first-person.js

I already decided the following. Follow it.

Units: **feet**. If the scanner exported metric, convert once at load (× 3.28084). HUD and walking in feet.

1. Read the LAS. Report point count, CRS if any, RGB and intensity. On Silver King both RGB and intensity were zero — do not fake scanner color.
2. Two clouds: register, merge. Origin at the portal. Adit bearing N17.5°E unless the new scan says otherwise.
3. Voxel **½ inch**. Keep the floor. Acceptance test: **cart-track grooves** on the floor of the drift (ore-cart ruts, not railroad). If they vanish, stop and coarsen nothing; fix the floor.
4. First-person three.js page, not Potree orbit:
   - click to look, WASD, Space/Shift up/down
   - eye **5 ft 4 in** above local floor, follows grade
   - soft noclip: stray points do not hard-block; ~2 s in the rock, pull back
   - one warm **headlamp** on the camera, aimed slightly down. Not noon sun. Shadows fall away down-tunnel. Dark at range.
5. Color from the attached wall photos. Those photos are the ground truth: reddish-brown altered volcanic clay, cream/ochre mottling, dusty tan floor, timber brown if a portal is in frame. Match hue and contrast. Mottling yes. Flat paint no.
6. Simple landing page that opens the walk. No poster layout. Distances in feet.
7. Final visual pass against the photos and against the Silver King walk: wall color, floor tracks, timber, light. Screenshot and fix.

Do not lecture me about LiDAR. Do not add a sun, classroom markers, or a metric HUD. Ship the walk to that standard.
