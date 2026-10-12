# First-person walk controls

Public domain ([CC0](LICENSE)). **Computer and phone.** Scene units are **feet**.

```html
<script src="three.min.js"></script>
<script src="first-person.js"></script>
<script>
  const fp = FirstPerson(camera, renderer.domElement, {
    eyeHeight: 5.4,
    floorY: (x, z) => /* floor in feet, or omit */,
    speed: 6
  });
  function loop(dt) { fp.update(dt); renderer.render(scene, camera); }
</script>
```

| | Computer | Phone |
|---|---|---|
| Look | click, then mouse | drag the picture |
| Walk | W A S D | left stick |
| Up / down | Space / Shift | — |
| Reset | R | R |
