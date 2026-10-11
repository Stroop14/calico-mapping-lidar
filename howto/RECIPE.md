# After the scanner: CloudCompare → web

Geography people. No assumed software beyond “you can open CloudCompare.”

Live example: https://stroop14.github.io/calico-mapping-lidar/

Work in **feet**. If the file comes out metric, convert once (× 3.28084) and stay in feet.

## 50% — CloudCompare (desktop)

Download: https://www.cloudcompare.org/ (free, GPL, not mine).

1. File → Open the LAS/LAZ.
2. If you have two setups, both in, align/merge, save one cloud.
3. Look. Measure. If it is tens of millions of points, thin it. Keep the floor. If the cart-track grooves vanish, you thinned too hard.
4. Save LAS or LAZ.

You now have a cloud you can inspect in the lab. That is half. It is not a link you can send.

## 75% — spin it in a browser (Potree)

Free converter, also not mine (Markus Schütz, BSD):  
https://github.com/potree/PotreeConverter/releases/tag/2.1.5

```
PotreeConverter.exe scan.las -o C:\out --generate-page mine
```

Put that folder on any ordinary webpage host. Mouse-orbit, like a globe. Right tool for a slope or a UAV block. Wrong tool for walking a drift.

## 100% — walk it

Same LAS. First-person. Floor under you. One headlamp. Color from two or three photos of the wall rock if the scanner stored no color (this GeoSLAM did not).

That page is what I built for Silver King. Controls I am releasing: [`../player-controls/`](../player-controls/) (public domain). The walk itself is on the link above.

## Who owns which bit

| Piece | Who wrote it | License |
|---|---|---|
| CloudCompare | CloudCompare / EDF | Already open source (GPL) |
| Potree converter + viewer | Markus Schütz | Already open source (BSD) |
| three.js (draws the 3-D in the browser) | the three.js project | Already open source (MIT) |
| WASD walk controls | me | Public domain (CC0), this repo |
| Silver King walk page | me | MIT, this repo — reuse it |

Putting a folder on GitHub without a license is not open source. The controls were given a public-domain file; the rest of my code in this repo is MIT as of this note. The old programs above were open source before I touched any of this.

## Wrap it with a helper, not a week of typing

1. Install [Cursor](https://cursor.com).
2. New chat. Model: **Opus 5.5**. If that is busy, **latest Grok**.
3. Attach the LAS and two or three wall photos.
4. Paste the whole prompt in [`CURSOR-PROMPT.md`](CURSOR-PROMPT.md) (everything under the line).
5. Look at the walk. If the clay or the cart tracks are wrong, say so in English.

Original scans: [release v1.0.0](https://github.com/Stroop14/calico-mapping-lidar/releases/tag/v1.0.0)
