// Input.
//   tilt        (springs back)  — WASD / arrows, left-thumb stick, or the phone's motion sensor
//   look around                 — left-drag (or one finger on the right half)
//   turn globe  (stays put)     — Shift + left-drag: spin & tip it, like a trackball
//                                 right-drag: roll & tip it          (two fingers on touch)
//   Space (hold)                — adopt whatever surface the marble touches as the floor, walls included
export function createInput(el, ui) {
  const keys = new Set();
  const out = { tilt: { x: 0, y: 0 }, rot: { x: 0, y: 0 }, spin: 0, camYaw: 0, camPitch: 0, zoom: 0, level: false, camTouched: false, globeHeld: false };
  const acc = { rx: 0, ry: 0, spin: 0, yaw: 0, pitch: 0, zoom: 0 };
  let mode = 'inside';
  const handlers = {};
  let steadyBtn = false;

  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    keys.add(e.code);
    if (e.code === 'KeyV' || e.code === 'Tab') { e.preventDefault(); handlers.view?.(); }
    if (e.code === 'KeyR') handlers.reset?.();
    if (e.code === 'KeyL') handlers.autolevel?.();
    if (e.code === 'KeyN') handlers.lights?.();
    if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => keys.clear());

  const ptr = new Map();
  let stick = null;
  el.addEventListener('contextmenu', (e) => e.preventDefault());
  el.addEventListener('pointerdown', (e) => {
    try { el.setPointerCapture(e.pointerId); } catch { /* synthetic pointer */ }
    let role = 'cam';
    if (e.pointerType === 'touch') {
      if (mode === 'inside' && e.clientX < window.innerWidth * 0.45 && !stick) role = 'stick';
    } else if (e.button === 2) role = 'roll';
    else if (e.button === 0 && e.shiftKey) role = 'spin';
    const p = { x: e.clientX, y: e.clientY, ox: e.clientX, oy: e.clientY, role, touch: e.pointerType === 'touch' };
    ptr.set(e.pointerId, p);
    if (role === 'stick') { stick = p; ui.stick(true, p.ox, p.oy, 0, 0); }
  });
  el.addEventListener('pointermove', (e) => {
    const p = ptr.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    let role = p.role;
    if (p.touch && role === 'cam' && [...ptr.values()].filter((q) => q.touch && q.role === 'cam').length >= 2) role = 'roll';
    if (role === 'cam') { acc.yaw -= dx * 0.006; acc.pitch += dy * 0.004; }
    else if (role === 'spin') { acc.spin += dx * 0.006; acc.ry -= dy * 0.006; }
    else if (role === 'roll') { acc.rx += dx * 0.006; acc.ry -= dy * 0.006; }
    else if (role === 'stick') {
      let sx = (p.x - p.ox) / 64, sy = (p.y - p.oy) / 64;
      const l = Math.hypot(sx, sy);
      if (l > 1) { sx /= l; sy /= l; }
      ui.stick(true, p.ox, p.oy, sx * 64, sy * 64);
    }
  });
  const up = (e) => {
    const p = ptr.get(e.pointerId);
    if (p === stick) { stick = null; ui.stick(false); }
    ptr.delete(e.pointerId);
  };
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);
  el.addEventListener('wheel', (e) => { e.preventDefault(); acc.zoom += e.deltaY * 0.0015; }, { passive: false });

  // motion sensor
  const gyro = { on: false, beta: 0, gamma: 0, b0: null, g0: null };
  window.addEventListener('deviceorientation', (e) => {
    if (e.beta == null) return;
    gyro.beta = e.beta; gyro.gamma = e.gamma;
    if (gyro.on && gyro.b0 == null) { gyro.b0 = e.beta; gyro.g0 = e.gamma; }
  });
  async function toggleGyro() {
    if (gyro.on) { gyro.on = false; return false; }
    try {
      if (typeof DeviceOrientationEvent !== 'undefined' && DeviceOrientationEvent.requestPermission) {
        if ((await DeviceOrientationEvent.requestPermission()) !== 'granted') return false;
      }
    } catch { return false; }
    gyro.on = true; gyro.b0 = gyro.g0 = null;
    return true;
  }
  function gyroTilt() {
    if (!gyro.on || gyro.b0 == null) return null;
    const db = gyro.beta - gyro.b0, dg = gyro.gamma - gyro.g0;
    const a = (screen.orientation && screen.orientation.angle) || 0;
    let x, y;
    if (a === 90) { x = db; y = dg; } else if (a === 270) { x = -db; y = -dg; } else { x = dg; y = -db; }
    const k = 1 / 22;
    return { x: Math.max(-1, Math.min(1, x * k)), y: Math.max(-1, Math.min(1, y * k)) };
  }

  const k = (c) => (keys.has(c) ? 1 : 0);
  function poll(dt) {
    let tx = Math.sign(k('KeyD') + k('ArrowRight') - k('KeyA') - k('ArrowLeft')), ty = Math.sign(k('KeyW') + k('ArrowUp') - k('KeyS') - k('ArrowDown'));
    const l = Math.hypot(tx, ty);
    if (l > 1) { tx /= l; ty /= l; }
    if (stick) {
      tx = Math.max(-1, Math.min(1, (stick.x - stick.ox) / 64));
      ty = -Math.max(-1, Math.min(1, (stick.y - stick.oy) / 64));
      const m = Math.hypot(tx, ty); if (m > 1) { tx /= m; ty /= m; }
    } else {
      const g = gyroTilt();
      if (g && l === 0) { tx = g.x; ty = g.y; }
    }
    out.tilt.x = tx; out.tilt.y = ty;
    out.rot.x = acc.rx; out.rot.y = acc.ry; out.spin = acc.spin;
    out.camYaw = acc.yaw + (k('KeyQ') - k('KeyE')) * 1.8 * dt;
    out.camPitch = acc.pitch;
    out.camTouched = acc.yaw !== 0 || keys.has('KeyQ') || keys.has('KeyE');
    out.zoom = acc.zoom;
    out.level = keys.has('Space') || steadyBtn;
    out.globeHeld = [...ptr.values()].some((p) => p.role === 'spin' || p.role === 'roll');
    acc.rx = acc.ry = acc.spin = acc.yaw = acc.pitch = acc.zoom = 0;
    return out;
  }

  return {
    poll, toggleGyro,
    recalibrate: () => { gyro.b0 = gyro.g0 = null; },
    setMode: (m) => { mode = m; },
    setSteady: (v) => { steadyBtn = v; },
    on: (name, fn) => { handlers[name] = fn; },
  };
}
