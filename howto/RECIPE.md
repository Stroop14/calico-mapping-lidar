# After the scanner: CloudCompare → maps → walk

Live example: https://stroop14.github.io/calico-mapping-lidar/

Work in **feet**. If the file comes out metric, convert once (× 3.28084) and stay in feet.

## 50% — CloudCompare

Download: https://www.cloudcompare.org/ (free, not mine).

1. File → Open the LAS/LAZ.
2. Two setups: both in, align/merge, save one cloud.
3. Look. Measure. Thin if it is huge. Keep the floor. If the cart-track grooves vanish, you thinned too hard.
4. Save LAS.

You can inspect the drift in the lab. That is half. It is not a link.

## Plan and profile (the pictures on the page)

Not a second instrument. Same points.

- **Plan:** look straight down, north up, true scale. In CloudCompare: orthographic, top view, save. On Silver King I plotted the points that way so the picture lives on the webpage (the big “straight down” figure).
- **Side profile:** along the heading, 1 ft across = 1 ft up. Same idea from the side. (There is also a 4× exaggerated profile if you want the wiggles to show.)

## The walk

First-person. Floor under you. One headlamp. Color from two or three wall photos if the scanner stored no color (this GeoSLAM did not).

Controls: [`../player-controls/`](../player-controls/) (public domain).

## Who owns which bit

| Piece | Who | License |
|---|---|---|
| CloudCompare | CloudCompare / EDF | Already open source (GPL) |
| three.js | the three.js project | Already open source (MIT) |
| WASD controls | me | Public domain (CC0) |
| Walk page and map figures | me | MIT, this repo |

## Helper

1. [Cursor](https://cursor.com). Model: **Opus 5.5** (or latest Grok).
2. Attach the LAS and two or three wall photos.
3. Paste [`CURSOR-PROMPT.md`](CURSOR-PROMPT.md).

Original scans: [release v1.0.0](https://github.com/Stroop14/calico-mapping-lidar/releases/tag/v1.0.0)
