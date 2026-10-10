/**
 * First-person walk controls for a three.js LiDAR scene.
 * Public domain (CC0 1.0). No attribution required.
 *
 * Scene units are feet. Click the canvas to look. WASD / arrows move.
 * Space or E up, Shift or Q down. Mouse wheel changes speed. R resets.
 *
 * Usage:
 *   const fp = FirstPerson(camera, renderer.domElement, {
 *     eyeHeight: 5.4,           // feet above floorY()  (5 ft 4 in)
 *     floorY: (x, z) => 0,      // local floor elevation in feet, or omit for free fly
 *     speed: 6                  // ft/s, walking
 *   });
 *   function tick(dt) { fp.update(dt); }
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.FirstPerson = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function FirstPerson(camera, canvas, opt) {
    opt = opt || {};
    var eyeHeight = opt.eyeHeight == null ? 5.4 : opt.eyeHeight;
    var speed = opt.speed == null ? 6 : opt.speed;
    var floorY = typeof opt.floorY === 'function' ? opt.floorY : null;
    var keys = Object.create(null);
    var yaw = camera.rotation.y || 0;
    var pitch = camera.rotation.x || 0;
    var start = camera.position.clone();
    camera.rotation.order = 'YXZ';

    function lock() { canvas.requestPointerLock(); }
    canvas.addEventListener('click', lock);

    document.addEventListener('mousemove', function (e) {
      if (document.pointerLockElement !== canvas) return;
      yaw -= e.movementX * 0.0022;
      pitch = Math.max(-1.5, Math.min(1.5, pitch - e.movementY * 0.0022));
    });

    document.addEventListener('keydown', function (e) { keys[e.code] = true; });
    document.addEventListener('keyup', function (e) { keys[e.code] = false; });
    canvas.addEventListener('wheel', function (e) {
      speed = Math.min(130, Math.max(0.7, speed * (e.deltaY < 0 ? 1.12 : 1 / 1.12)));
    }, { passive: true });

    function pressed(a, b) { return keys[a] || keys[b]; }

    function update(dt) {
      camera.rotation.set(pitch, yaw, 0);
      var fx = -Math.sin(yaw), fz = -Math.cos(yaw);
      var rx = Math.cos(yaw), rz = -Math.sin(yaw);
      var mx = 0, my = 0, mz = 0;
      if (pressed('KeyW', 'ArrowUp')) { mx += fx; mz += fz; }
      if (pressed('KeyS', 'ArrowDown')) { mx -= fx; mz -= fz; }
      if (pressed('KeyD', 'ArrowRight')) { mx += rx; mz += rz; }
      if (pressed('KeyA', 'ArrowLeft')) { mx -= rx; mz -= rz; }
      if (pressed('KeyE', 'Space')) my += 1;
      if (pressed('KeyQ', 'ShiftLeft') || keys.ShiftRight) my -= 1;
      var len = Math.hypot(mx, mz);
      if (len > 0) { mx = mx / len * speed; mz = mz / len * speed; }
      camera.position.x += mx * dt;
      camera.position.z += mz * dt;
      if (floorY && my === 0) {
        var fy = floorY(camera.position.x, camera.position.z);
        if (fy != null) camera.position.y = fy + eyeHeight;
      } else {
        camera.position.y += my * speed * dt;
      }
      if (keys.KeyR) {
        camera.position.copy(start);
        yaw = 0; pitch = 0;
      }
    }

    return { update: update, get speed() { return speed; } };
  }

  return FirstPerson;
});
