# First-person walk controls

Public domain ([CC0](LICENSE)). Drop onto any three.js camera.

```html
<script src="three.min.js"></script>
<script src="first-person.js"></script>
<script>
  const fp = FirstPerson(camera, renderer.domElement, {
    eyeHeight: 1.64,
    floorY: (x, z) => /* local floor in metres, or omit */,
    speed: 2
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

This is the easy controller. The Silver King walkthrough adds floor following from the point cloud, a headlamp, and a pull-back if you stand in the rock — that lives in the live site, not here.
