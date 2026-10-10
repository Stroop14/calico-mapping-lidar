Paste this into Cursor. Attach: the LAS/LAZ, 2–3 photos of the wall rock (and floor if you have them), and a screenshot of the Silver King walkthrough if you want that quality bar.

---

I have a terrestrial / handheld LiDAR scan of a mine drift (LAS/LAZ). I already know the field workflow. I need the last mile: a browser first-person walkthrough.

Do what I did for the Silver King Mine (Calico, 24 March 2019, CSUSB field camp), at this quality or better:

https://stroop14.github.io/calico-mapping-lidar/

Source scans for that project: https://github.com/Stroop14/calico-mapping-lidar/releases/tag/v1.0.0
Player controls to copy (public domain): player-controls/first-person.js in that repo.

Steps I took. Follow them. Do not invent a different pipeline unless a step is blocked.

1. Read the LAS. Report: point count, CRS if any, whether RGB and intensity are actually populated (on Silver King both were zero — do not fake scanner color).
2. Merge/register if there are two clouds. Origin at the portal. Metres.
3. Voxel ~1–2 cm. **Do not erase the floor.** The cart-track grooves on the floor of the drift (ore-cart rails / worn ruts — not railroad) are the acceptance test. If they disappear, the voxel is too coarse or the floor was classified away.
4. First-person three.js (or equivalent) page:
   - click to look, WASD, Space/Shift up/down, eye ~1.64 m above local floor
   - soft noclip: movement is not hard-blocked by stray points; pull back if the camera sits in rock for ~2 s
   - one **headlamp** on the camera, aimed slightly down, warm (not noon sun). Shadows fall away from the viewer down the tunnel. Dark at range.
5. Color. If RGB exists, use it. If not, **colorize from the attached wall photos**. Those photos are the ground truth for the clay: reddish-brown altered volcanic wall rock, cream/ochre mottling, dusty tan floor, timber brown if a portal frame is there. Match hue and contrast to the photos. Mottling is fine; a single flat paint is not.
6. Build a simple landing page that opens the walk. No academic poster layout.
7. Final visual pass against the photos: wall color, floor tracks, timber, light direction and falloff. Fix what looks wrong. Screenshot before/after.

Do not lecture me about LiDAR. Do not add markers, classroom HUD clutter, or a sun. Ship the walk.
