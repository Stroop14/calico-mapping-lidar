# First-person walk controls

Public domain ([CC0](LICENSE)). Drop onto any three.js camera. Units are **feet**.

```html
<script src="three.min.js"></script>
<script src="first-person.js"></script>
<script>
  const fp = FirstPerson(camera, renderer.domElement, {
    eyeHeight: 5.4,              // 5 ft 4 in
    floorY: (x, z) => /* local floor in feet, or omit */,
    speed: 6                     // ft/s
  });
  function loop(dt) { fp.update(dt); renderer.render(scene, camera); }
</script>
```

| Key | Action |
|---|---|
| Click | mouse-look (Esc releases) |
| W A S D | move |
| Space / E, Shift / Q | up, down |
| Wheel | speed |
| R | reset |

Silver King walkthrough adds floor-following from the point cloud, a headlamp, and a pull-back if you stand in the rock. That is on the live page, not in this file.
