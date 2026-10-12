# CloudCompare → path → player

Live: https://stroop14.github.io/calico-mapping-lidar/

Feet. If the LAS is metric, convert once (× 3.28084).

You already know how to put two clouds together. The rest is this.

## 1. CloudCompare

https://www.cloudcompare.org/

1. File → Open the LAS.
2. Two setups: align / merge. Save one cloud.
3. **Shrink it.** Edit → Subsample → space **1.25 cm (½ inch)**. That is the Silver King spacing (an earlier 2 cm cloud was too coarse). Keep the floor. Cart-track grooves (ore-cart ruts) must still be there. You should still have on the order of **5 million** points on screen (Silver King walk: 5.36 million from a 13.7 million merged cloud).
4. **Color while you work.** If RGB is in the file, leave it. If not (Silver King stored zeros): Edit → Colors → Height, so the floor is not the same color as the roof. That is a working color, not the clay.
5. **Clay color** is from two or three handheld photos of the wall. You match those when the walk is built, not by painting every point by hand.

Optional: set the view to top (orthographic) and to the side, save pictures. Those are the plan and profile on the Silver King page — same points, looking down and looking along.

## 2. The walk path (in-point and out-point)

This is the part that is not obvious in CloudCompare.

1. On the floor, click the **in-point**: just inside the portal, looking into the heading. Silver King: portal 34.95117° N, 116.86307° W.
2. Click the **out-point**: farthest station in the main drift the scanner actually saw (Silver King: northwest end, hundreds of feet in).
3. Trace a **polyline on the floor** between them, down the middle of the drift. Point → Point, every few yards is enough. Do not thread every stray rib. That line is the walk and the guided tour.
4. Eye height is **5 ft 4 in** above that line. The camera starts a few feet inside the in-point, looking toward the out-point. Tour follows the line out and back.
5. Export:
   - the thinned LAS
   - the polyline as a simple table (x, y, z, feet) — CSV is fine

You now have the file the player needs.

## 3. Hand it to the player

Public-domain player, **computer and phone**: [`../player-controls/`](../player-controls/)

- Computer: click to look, WASD to walk. Point size **3 cm (1¼ in)**, clamp 1–30 pixels. `[` `]` bigger/smaller if needed.
- Phone: left stick to walk, drag the picture to look. Point size **4.5 cm (1¾ in)**, clamp 2–40 pixels. Walls can be thinned (keep every floor point; keep about two of five wall points) so a phone does not choke.

Send the LAS, the path CSV, the wall photos, and that player folder to Cursor. Ask it to combine them into the walk (prompt below). You do not sit in a text editor for days.

## 4. Fast path

Cursor. Model: **Opus 5.5** (Anthropic) or **latest Grok**. Attach LAS + path + photos. Paste [`CURSOR-PROMPT.md`](CURSOR-PROMPT.md).
