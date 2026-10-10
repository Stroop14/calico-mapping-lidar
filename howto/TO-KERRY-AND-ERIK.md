Subject: LiDAR → browser walkthrough (Silver King)

Kerry, Erik —

You already know the field half. This is the last mile: scan on a web page people can walk.

Working example (Silver King, 24 March 2019, your field camp):
https://stroop14.github.io/calico-mapping-lidar/

Two products from the same LAS.

1. Orbit the cloud (Kerry’s usual surface / UAV case).
   Download PotreeConverter 2.1.5 (BSD, free):
   https://github.com/potree/PotreeConverter/releases/tag/2.1.5
   Then:
   PotreeConverter.exe scan.las -o C:\out --generate-page mine
   Point a browser at that folder (any static host, or python -m http.server). Done. No AI.

2. Walk it like a person (underground drift).
   Same LAS. First-person camera, floor under your feet, WASD, one headlamp.
   That is a small webpage, not a geology problem.

Color, on this scan: the GeoSLAM wrote no RGB and intensity = 0. So the clay is not measured reflectance. It is assigned from a few handheld photos of the wall rock — reddish-brown altered volcanic clay, cream/ochre mottling, dusty tan floor, timber at the portal. Light is a warm lamp on the camera, aimed slightly down. Shadows fall away from you. Cart-track grooves on the floor are the check that the downsample did not erase the drift floor.

Where AI actually helps: the page, the controls, matching those wall photos, and a last look that the tracks and lighting are right. Not the scan. Not PotreeConverter.

Recipe, drop-in player code (public domain), and a Cursor prompt:
https://github.com/Stroop14/calico-mapping-lidar/tree/main/howto

If you want it done to this standard: Cursor, model Opus 5.5, paste the prompt in howto/CURSOR-PROMPT.md, drop in the LAS plus two or three wall photos. Fifteen minutes of their time, not yours.

Kerry — congratulations on retirement. Happy to walk anyone through this.

Mike
