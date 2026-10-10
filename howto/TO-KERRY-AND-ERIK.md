Subject: Silver King LiDAR — first-person walk, and how I built it

Kerry, Erik —

Silver King, 24 March 2019. I took the two GeoSLAM LAS files from that day and put a first-person walk on the web:

https://stroop14.github.io/calico-mapping-lidar/

Walk it. Maps and a then-and-now slider are on the same page. That is the product.

What I did, in order.

1. The two clouds (20:06 and 20:36). Registered. Origin at the portal, 34.95117° N, 116.86307° W. Adit bearing N17.5°E (my figure from the field, N15–20°E). HUD reads in feet.

2. The unit stored no RGB and intensity = 0. Color is not reflectance. I sampled the wall rock from the handheld photos: reddish-brown altered volcanic clay, cream/ochre mottling, dusty tan floor, timber at the portal. Floor stays paler than the walls. One warm headlamp on the camera, aimed a few degrees down. Shadows fall away from you down the drift — not outdoor sun.

3. Half-inch voxels. I kept the floor. The cart-track grooves on the floor of the drift (ore-cart ruts, not railroad) are the check. If they vanish, the downsample is too coarse.

4. Eye at 5 ft 4 in above the local floor, follows grade, ducks under low roof. WASD, mouse look. Soft walls: stray scan points do not stop you; if you stand in the rock for about two seconds you get pulled back.

5. For a surface or UAV cloud you only need to orbit and measure, I use PotreeConverter (BSD). One command, no webpage work:

   PotreeConverter.exe scan.las -o C:\out --generate-page mine

   That is a different product. Same LAS. Underground, you want to walk it. That is the page I built.

Player controls (public domain) and the step list:
https://github.com/Stroop14/calico-mapping-lidar/blob/cursor/lidar-howto-professors-7bc7/howto/RECIPE.md

If you want the next drift done this way, send the LAS and two or three wall photos (clay, floor with the cart tracks, timber if there is a portal). I will run the same steps.

Kerry — congratulations on retirement.

Mike
