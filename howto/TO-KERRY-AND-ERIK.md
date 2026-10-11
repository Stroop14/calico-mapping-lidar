Subject: Silver King on the web — from CloudCompare to a walk

Kerry, Erik —

https://stroop14.github.io/calico-mapping-lidar/

That is the two GeoSLAM files from 24 March 2019, in a browser. You walk it. You do not install a CAD package.

You already know how to collect the scan. Everything after the LAS file, in order, with how far each step actually gets you.

1. CloudCompare — about 50%
   Free program. You already have this class of tool. Open the LAS, merge the two setups, look at it, measure, thin it if it is huge, save. You can see the drift on a lab computer. Nobody else can open it without the same program. That is half the job: the geometry is real.

2. A free “put it on a webpage” converter (Potree) — about 75%
   Same file. One extra program, also free. Out comes a page you spin with the mouse, like Google Earth for a point cloud. Good for a hillside, a UAV strip, an outcrop. Bad for a drift you want to walk. You are still outside the model looking in.

3. The walk — the last 25%
   Same file again. Now you are standing in the heading, floor under your feet, one lamp. That page is what I built. Color is not from the scanner — that unit stored none. I took it from the handheld photos of the wall: clay, dusty floor, timber. Cart-track grooves on the floor are the check that I did not erase the ground when I thinned the points.

Open source, said plainly.

CloudCompare and the web converter were already free. Other people wrote them (CloudCompare: EDF / the CloudCompare project. Potree: Markus Schütz). I did not invent those.

What I put on GitHub is the walking page and a small control file so someone can move with W-A-S-D. The control file is public domain — anyone may copy it. The rest of my page is public to look at; I am putting a license on it so you can reuse it without asking. That is my piece, not theirs.

https://github.com/Stroop14/calico-mapping-lidar

If you do not want to sit in a text window for two days: there is a helper program (Cursor). You install it, drop in the LAS and two or three wall photos, and paste the checklist I wrote (howto/CURSOR-PROMPT.md). It follows those steps. You do not write code. You look at the result and say whether the clay and the tracks look right. That is an afternoon, not a field season.

If you want the next heading done this way, send the LAS and two or three wall photos.

Kerry — congratulations on retirement.

Mike
