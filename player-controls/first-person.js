/**
 * First-person walk for a three.js LiDAR scene.
 * Public domain (CC0 1.0). No attribution required.
 *
 * Computer: click to look, WASD / arrows walk.
 * Phone: left stick walks, drag the picture to look.
 * Space or E up, Shift or Q down. Wheel = speed. R resets.
 *
 * Scene units are feet.
 *
 *   const fp = FirstPerson(camera, renderer.domElement, {
 *     eyeHeight: 5.4,        // 5 ft 4 in
 *     floorY: (x, z) => 0,   // or omit
 *     speed: 6               // ft/s
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
    var stickX = 0, stickY = 0;
    var lookId = null, stickId = null, lookLX = 0, lookLY = 0;
    var TOUCH = window.matchMedia && matchMedia('(pointer: coarse)').matches;
    camera.rotation.order = 'YXZ';

    function lock() {
      if (!TOUCH && canvas.requestPointerLock) canvas.requestPointerLock();
    }
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

    function pad() {
      var w = Math.max(96, Math.min(140, canvas.clientWidth * 0.22));
      return { x: 16 + w * 0.5, y: canvas.clientHeight - 16 - w * 0.5, r: w * 0.5 };
    }
    function setStick(cx, cy) {
      var p = pad(), dx = cx - p.x, dy = cy - p.y, m = Math.hypot(dx, dy) || 1;
      var a = Math.min(1, m / p.r);
      stickX = (dx / m) * a;
      stickY = (-dy / m) * a;
    }

    canvas.addEventListener('touchstart', function (e) {
      e.preventDefault();
      var p = pad();
      for (var i = 0; i < e.changedTouches.length; i++) {
        var t = e.changedTouches[i];
        if (stickId == null && Math.hypot(t.clientX - p.x, t.clientY - p.y) < p.r * 1.35) {
          stickId = t.identifier;
          setStick(t.clientX, t.clientY);
        } else if (lookId == null) {
          lookId = t.identifier;
          lookLX = t.clientX;
          lookLY = t.clientY;
        }
      }
    }, { passive: false });

    canvas.addEventListener('touchmove', function (e) {
      e.preventDefault();
      for (var i = 0; i < e.changedTouches.length; i++) {
        var t = e.changedTouches[i];
        if (t.identifier === stickId) setStick(t.clientX, t.clientY);
        if (t.identifier === lookId) {
          yaw -= (t.clientX - lookLX) * 0.003;
          pitch = Math.max(-1.5, Math.min(1.5, pitch - (t.clientY - lookLY) * 0.003));
          lookLX = t.clientX;
          lookLY = t.clientY;
        }
      }
    }, { passive: false });

    function endTouch(e) {
      for (var i = 0; i < e.changedTouches.length; i++) {
        var id = e.changedTouches[i].identifier;
        if (id === stickId) { stickId = null; stickX = 0; stickY = 0; }
        if (id === lookId) lookId = null;
      }
    }
    canvas.addEventListener('touchend', endTouch);
    canvas.addEventListener('touchcancel', endTouch);

    if (TOUCH) {
      var ring = document.createElement('div');
      ring.setAttribute('aria-hidden', 'true');
      ring.style.cssText = 'position:fixed;left:16px;bottom:16px;width:22vw;max-width:140px;aspect-ratio:1;border:2px solid rgba(255,255,255,.35);border-radius:50%;pointer-events:none;z-index:6';
      document.body.appendChild(ring);
    }

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
      if (Math.hypot(stickX, stickY) > 0.12) {
        mx += fx * stickY + rx * stickX;
        mz += fz * stickY + rz * stickX;
      }
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
