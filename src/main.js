import * as THREE from 'three';
import { buildWorld, GLOBES, getGlobe, R, BALL_R } from './world.js';
import { createPhysics } from './physics.js';
import { createRenderer } from './render.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';

const $ = (id) => document.getElementById(id);
const SAVE_KEY_BASE = 'plexulisa.v1';   // progress is kept per globe
const NOSAVE = location.search.includes('nosave'); // for testing without touching progress
const UP = new THREE.Vector3(0, 1, 0);
const MAX_TILT = (30 * Math.PI) / 180;
const STEP = 1 / 120;

const low = matchMedia('(pointer: coarse)').matches;
if (low) document.body.classList.add('touch');

// which globe is on the desk: ?globe=<id>, else the one you last picked
const params = new URLSearchParams(location.search);
const globeId = getGlobe(params.get('globe') || (() => { try { return localStorage.getItem('plexulisa.globe'); } catch { return null; } })()).id;
// A globe that fails to build must never take the game down with it: fall back to the first one.
let world, buildError = null;
try { world = buildWorld(globeId); } catch (err) { console.error(`globe "${globeId}" failed to build`, err); buildError = globeId; world = buildWorld(GLOBES[0].id); }
const SAVE_KEY = world.id === GLOBES[0].id ? SAVE_KEY_BASE : `${SAVE_KEY_BASE}.${world.id}`;
const physics = await createPhysics(world);
const view = await createRenderer($('scene'), world, low);
const audio = createAudio();

/* ---- UI -------------------------------------------------------------- */
const stickEl = $('stick'), knobEl = $('knob');
const ui = {
  stick(on, x = 0, y = 0, kx = 0, ky = 0) {
    stickEl.style.display = on ? 'block' : 'none';
    stickEl.style.left = x + 'px'; stickEl.style.top = y + 'px';
    knobEl.style.transform = `translate(${kx}px, ${ky}px)`;
  },
};
const input = createInput($('scene'), ui);
const dots = world.lanterns.map((L, i) => {
  const d = document.createElement('i');
  d.title = L.name;
  // a lit lantern is a place you can return to: click its dot
  d.onclick = () => {
    if (!lit.has(i)) { toast('還沒去過這盞燈'); return; }
    checkpoint = i; persist(); respawn(i); toast('回到「' + L.name + '」');
  };
  $('lanterns').appendChild(d);
  return d;
});
let toastTimer = 0;
function toast(text, ms = 2600) {
  $('toast').textContent = text;
  $('toast').classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('toast').classList.remove('show'), ms);
}

/* ---- state ------------------------------------------------------------ */
const save = (() => { try { return (!NOSAVE && JSON.parse(localStorage.getItem(SAVE_KEY))) || {}; } catch { return {}; } })();
const lit = new Set(save.lit || []);
let checkpoint = Number.isInteger(save.cp) ? save.cp : 0;
const persist = () => { if (NOSAVE) return; try { localStorage.setItem(SAVE_KEY, JSON.stringify({ lit: [...lit], cp: checkpoint })); } catch { /* private mode */ } };
lit.forEach((i) => { view.setLantern(i, true); dots[i].classList.add('on'); });

const Qbase = new THREE.Quaternion(), Qtilt = new THREE.Quaternion(), Qeff = new THREE.Quaternion(), Qinv = new THREE.Quaternion();
const Qvis = new THREE.Quaternion(), QvisInv = new THREE.Quaternion();   // what is drawn (see the tilt note in frame())
const tilt = new THREE.Vector2();
const cam = { mode: 'inside', yaw: -0.4, pitch: 0.42, pitchEff: 0.42, dist: 2.7, wantDist: 2.7, outDist: 46, oYaw: 0.18, oPitch: 0.17, blend: 0, lastTouch: -10 };
let autoLevel = true, lastGlobe = -10, night = 0, lightsOff = false, dark = 0;
const camPos = new THREE.Vector3(), camLook = new THREE.Vector3();
let started = false, time = 0;

function respawn(i = checkpoint) {
  const L = world.lanterns[i], up = L.spawnUp || L.up;
  physics.place(L.spawn.clone().addScaledVector(up, BALL_R + 0.03));
  Qbase.setFromUnitVectors(up, UP);
  tilt.set(0, 0);
}
respawn();

function setMode(m) {
  cam.mode = m;
  input.setMode(m);
  $('btnView').textContent = m === 'inside' ? '球外' : '球內';
  document.body.classList.toggle('outside', m === 'outside');
}
input.on('view', () => setMode(cam.mode === 'inside' ? 'outside' : 'inside'));
input.on('autolevel', () => { autoLevel = !autoLevel; toast(autoLevel ? '自動貼平：開' : '自動貼平：關（純手動）'); });
const toggleLights = () => { lightsOff = !lightsOff; $('btnLights').classList.toggle('active', lightsOff); $('btnLights').textContent = lightsOff ? '開燈' : '關燈'; };
input.on('lights', toggleLights);
$('btnLights').onclick = toggleLights;
input.on('reset', () => { respawn(); toast('回到「' + world.lanterns[checkpoint].name + '」'); });
$('btnView').onclick = () => setMode(cam.mode === 'inside' ? 'outside' : 'inside');
const steady = $('btnSteady');
steady.addEventListener('pointerdown', (e) => { e.preventDefault(); input.setSteady(true); });
for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) steady.addEventListener(ev, () => input.setSteady(false));
$('btnGyro').onclick = async () => {
  const on = await input.toggleGyro();
  $('btnGyro').classList.toggle('active', on);
  toast(on ? '體感已開啟：以現在的握姿為水平' : '體感已關閉');
};
// the shelf: pick another globe (reloads with that globe on the desk)
$('globeName').textContent = world.name;
if (buildError) setTimeout(() => toast(`「${buildError}」這顆球載入失敗，先換回「${world.name}」`, 6000), 800);
for (const g of GLOBES) {
  const b = document.createElement('button');
  b.textContent = g.name; b.title = g.blurb || '';
  if (g.id === world.id) b.classList.add('active');
  b.onclick = () => {
    if (g.id === world.id) return;
    try { localStorage.setItem('plexulisa.globe', g.id); } catch { /* private mode */ }
    params.set('globe', g.id);
    location.search = params.toString();
  };
  $('shelf').appendChild(b);
}
$('shelfRow').style.display = GLOBES.length > 1 ? '' : 'none';
$('btnHelp').onclick = () => $('title').classList.remove('hidden');
$('start').onclick = () => {
  started = true;
  $('title').classList.add('hidden');
  audio.start();
  $('start').textContent = '繼續';
};

/* ---- frame ------------------------------------------------------------- */
const v3 = () => new THREE.Vector3();
const fwd = v3(), right = v3(), d = v3(), axis = v3(), gLocal = v3(), ballL = v3(), ballW = v3(), velW = v3(), nrm = v3(), dirW = v3(), dirL = v3(), rayO = v3(), prevL = v3(), drawL = v3(), wantPos = v3(), wantLook = v3();
const dq = new THREE.Quaternion();
let accum = 0, last = performance.now(), contact = null;

// nearest track part / terrace whose neutral applies at point p (maze frame)
function neutralAt(p) {
  let best = null, score = 1;
  for (const s of world.neutral) {
    const d2 = s.pos.distanceToSquared(p);
    if (d2 < s.r * s.r) { const k = d2 / (s.r * s.r); if (k < score) { score = k; best = s; } }
  }
  return best;
}

function rotateToward(q, dir2x, dir2y, angle) {
  // rotate so that the horizontal direction (dir2x * right + dir2y * fwd) becomes "downhill"
  d.copy(right).multiplyScalar(dir2x).addScaledVector(fwd, dir2y);
  if (d.lengthSq() < 1e-12 || angle === 0) return;
  axis.crossVectors(UP, d.normalize());
  q.premultiply(dq.setFromAxisAngle(axis, angle));
}

// Spring-arm camera: how far back it can sit at a given pitch. Thick bodies and the glass push it
// in (or up — see below). Thin things (planks, lips, dowels) are allowed to pass in front for a
// moment rather than making the camera lurch; the marble's ghost shows through them.
function clearDist(pitch) {
  dirW.set(Math.sin(cam.yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(cam.yaw) * Math.cos(pitch));
  dirL.copy(dirW).applyQuaternion(QvisInv);
  rayO.copy(drawL);
  let lim = cam.wantDist;
  for (let i = 0, t0 = 0; i < 8; i++) {
    const t = physics.rayDist(rayO, dirL, cam.wantDist + 0.3 - t0);
    if (t0 + t >= cam.wantDist + 0.3) break;
    rayO.addScaledVector(dirL, t + 0.02);
    const thick = physics.rayDist(rayO, dirL, 0.5);
    if (thick >= 0.5) { lim = t0 + t - 0.3; break; }
    rayO.addScaledVector(dirL, thick + 0.02);
    t0 += t + thick + 0.04;
  }
  const b = ballW.dot(dirW), c = ballW.lengthSq() - (R - 0.35) ** 2;   // stay inside the glass
  return Math.max(0.6, Math.min(lim, -b + Math.sqrt(Math.max(0, b * b - c))));
}

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now; time += dt;
  const inp = input.poll(dt);
  const inside = cam.mode === 'inside';

  // camera input
  if (inside) {
    cam.yaw += inp.camYaw;
    cam.pitch = Math.max(-1.2, Math.min(1.45, cam.pitch + inp.camPitch));
    cam.wantDist = Math.max(1.4, Math.min(6, cam.wantDist * (1 + inp.zoom)));
    if (inp.camTouched) cam.lastTouch = time;
  } else {
    cam.oYaw = Math.max(-1.3, Math.min(1.3, cam.oYaw + inp.camYaw));
    cam.oPitch = Math.max(0.02, Math.min(1.05, cam.oPitch + inp.camPitch));
    cam.outDist = Math.max(30, Math.min(80, cam.outDist * (1 + inp.zoom)));
  }
  const yaw = inside ? cam.yaw : cam.oYaw;
  fwd.set(-Math.sin(yaw), 0, -Math.cos(yaw));
  right.set(Math.cos(yaw), 0, -Math.sin(yaw));

  // turning the globe (persistent)
  const rl = Math.hypot(inp.rot.x, inp.rot.y);
  if (rl > 0) rotateToward(Qbase, inp.rot.x, inp.rot.y, rl);
  if (inp.spin) Qbase.premultiply(dq.setFromAxisAngle(UP, inp.spin));
  if (inp.globeHeld || rl > 0 || inp.spin) lastGlobe = time;
  // Neutral = level with the surface the marble is riding. The globe eases itself so that
  // surface is "down" — but only for surfaces that are already roughly underfoot (a lip or a
  // wall brushing the side is ignored), and gently, so a track that curls up a wall or over
  // onto the ceiling carries the world round with it. Space forces it: any surface, walls too.
  {
    // What should be "up" right now?
    //  1. Space: whatever surface the marble is touching (walls too).
    //  2. On a track part or terrace: that part's own neutral (see world.js) — flat parts and
    //     wall/ceiling bends carry the world round with them; ramps and slides stay sloped.
    //  3. Anywhere else (the sea, the glass, a rooftop): the surface underfoot, if it is
    //     already roughly underfoot.
    let have = false, gain = 1, gate = false;
    if (inp.level) { if (contact) { nrm.set(contact.x, contact.y, contact.z); have = true; gain = 1.2; } }
    else if (autoLevel && time - lastGlobe > 0.4) {
      const f = neutralAt(ballL);
      if (f) { nrm.copy(f.nu); gain = f.gain; have = true; }
      else if (contact) { nrm.set(contact.x, contact.y, contact.z); have = gate = true; }
    }
    if (have) {
      nrm.applyQuaternion(Qbase);
      const ang = Math.acos(Math.max(-1, Math.min(1, nrm.y)));
      if (ang > 1e-3 && !(gate && ang > 1.0)) {
        axis.crossVectors(nrm, UP);
        if (axis.lengthSq() < 1e-8) axis.copy(right); else axis.normalize();
        Qbase.premultiply(dq.setFromAxisAngle(axis, Math.min(ang, Math.min(3.0, ang * 3.4 + 0.06) * gain * dt)));
      }
    }
  }
  Qbase.normalize();
  // fine tilt (springs back)
  const k = 1 - Math.exp(-dt / 0.13);
  tilt.x += (inp.tilt.x - tilt.x) * k; tilt.y += (inp.tilt.y - tilt.y) * k;
  Qtilt.identity();
  rotateToward(Qtilt, tilt.x, tilt.y, Math.min(1, tilt.length()) * MAX_TILT);
  Qeff.copy(Qtilt).multiply(Qbase);
  Qinv.copy(Qeff).invert();
  gLocal.set(0, -1, 0).applyQuaternion(Qinv);
  // The marble feels the full tilt, but from inside the globe you are shown only a little of
  // it: the whole world lurching 30° on every key press is what made people queasy. From
  // outside you see the real thing.
  Qtilt.identity();
  rotateToward(Qtilt, tilt.x, tilt.y, Math.min(1, tilt.length()) * MAX_TILT * (0.22 + 0.78 * cam.blend));
  Qvis.copy(Qtilt).multiply(Qbase);
  QvisInv.copy(Qvis).invert();

  // physics
  if (started) {
    accum = Math.min(accum + dt, 6 * STEP);
    while (accum >= STEP) { const q = physics.body.translation(); prevL.set(q.x, q.y, q.z); physics.step(STEP, gLocal); accum -= STEP; }
  }
  contact = physics.contact();
  const bp = physics.body.translation(), br = physics.body.rotation(), bv = physics.body.linvel();
  ballL.set(bp.x, bp.y, bp.z);
  // render between the last two physics states so motion is smooth at any refresh rate
  if (!started || prevL.distanceToSquared(ballL) > 1) prevL.copy(ballL);
  drawL.copy(prevL).lerp(ballL, accum / STEP);
  ballW.copy(drawL).applyQuaternion(Qvis);
  velW.set(bv.x, bv.y, bv.z).applyQuaternion(Qvis);
  const speed = velW.length();

  view.globe.quaternion.copy(Qvis);
  view.ball.position.copy(drawL);
  view.ball.quaternion.set(br.x, br.y, br.z, br.w);
  physics.movers.forEach((m, i) => {
    if (m.def.kind === 'hinge') { const q = m.body.rotation(); view.moverGroups[i].quaternion.set(q.x, q.y, q.z, q.w); }
    else if (m.def.kind === 'lift') view.moverGroups[i].position.copy(m.def.pivot).addScaledVector(m.def.axis, m.offset);
    else view.moverGroups[i].quaternion.setFromAxisAngle(m.def.axis, m.angle);
  });

  audio.roll(speed, !!contact, contact && contact.glass);
  if (physics.state.impact > 0) { audio.thunk(physics.state.impact, physics.state.onGlass); physics.state.impact = 0; }

  // lanterns
  if (started) {
    world.lanterns.forEach((L, i) => {
      const rr = L.radius || 1.15;
      if (ballL.distanceToSquared(L.pos) > rr * rr) return;
      if (checkpoint !== i) { checkpoint = i; persist(); }
      if (lit.has(i)) return;
      lit.add(i); persist();
      view.setLantern(i, true); dots[i].classList.add('on');
      audio.chime(i);
      if (lit.size === world.lanterns.length) {
        setTimeout(() => { toast('每一盞燈都亮了。這顆球現在是你的了。', 6000); audio.finale(); view.snowBurst(); }, 900);
      }
      toast(`${L.name} · ${lit.size} / ${world.lanterns.length}`);
    });
  }

  // camera
  const hs = Math.hypot(velW.x, velW.z);
  if (inside && hs > 0.8 && time - cam.lastTouch > 2.5) {
    let diff = Math.atan2(-velW.x, -velW.z) - cam.yaw;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    cam.yaw += diff * Math.min(1, dt * 1.3 * Math.min(1, hs / 3) * (0.05 + 0.95 * (Math.cos(diff) + 1) / 2));
  }
  // Find a clear line to the marble. If terrain is in the way (e.g. the world is tilted
  // steeply and "behind" is now uphill), raise the camera instead of shoving it closer.
  let best = -1, bestPitch = cam.pitch;
  for (let k = 0; k < 9; k++) {
    const p = Math.min(1.5, cam.pitch + k * 0.16);
    const c = clearDist(p);
    if (c > best + 0.05) { best = c; bestPitch = p; }
    if (c >= cam.wantDist * 0.9 || p >= 1.5) break;
  }
  cam.pitchEff += (bestPitch - cam.pitchEff) * (1 - Math.exp(-dt * 5));
  const lim = clearDist(cam.pitchEff);
  cam.dist += (lim - cam.dist) * (1 - Math.exp(-dt * (lim < cam.dist ? 12 : 3)));
  cam.blend += ((inside ? 0 : 1) - cam.blend) * (1 - Math.exp(-dt * 4));
  const e = cam.blend * cam.blend * (3 - 2 * cam.blend);
  wantPos.copy(ballW).addScaledVector(dirW, cam.dist);
  wantLook.copy(ballW).addScaledVector(UP, 0.1 * cam.dist);
  const od = cam.outDist * Math.max(1, 1.3 / view.camera.aspect);
  camPos.set(Math.sin(cam.oYaw) * Math.cos(cam.oPitch) * od, -1 + Math.sin(cam.oPitch) * od, Math.cos(cam.oYaw) * Math.cos(cam.oPitch) * od).lerp(wantPos, 1 - e);
  camLook.set(0, -1, 0).lerp(wantLook, 1 - e);
  view.camera.position.copy(camPos);
  view.camera.lookAt(camLook);
  const fov = 50 + (32 - 50) * e;
  if (Math.abs(view.camera.fov - fov) > 0.01) { view.camera.fov = fov; view.camera.updateProjectionMatrix(); }

  night += ((world.mood ? world.mood(ballL) : 0) - night) * (1 - Math.exp(-dt * 2.2));
  dark += ((lightsOff ? 1 : 0) - dark) * (1 - Math.exp(-dt * 1.6));
  view.halo.position.copy(ballW);
  view.halo.material.opacity = e * (0.55 + 0.25 * Math.sin(time * 3));
  view.updateSnow(dt, gLocal, time);
  view.render({
    focus: camPos.distanceTo(ballW),
    aperture: 0.3 + e * 0.5,
    shadowCenter: e > 0.5 ? camLook.set(0, 0, 0) : ballW,
    shadowSize: e > 0.5 ? 17 : 9,
    showBench: e > 0.01,
    near: 0.08 + e * 1.4,
    far: e > 0.005 ? 2600 : 90,
    time,
    ghostAlpha: 0.42 * (1 - e),
    haze: 0.0008 + 0.0067 * (1 - e),
    night: night * (1 - e),
    dark,
    glowFocus: e > 0.5 ? null : drawL,
  });
}
requestAnimationFrame(frame);

// debugging / level-design hook
window.plex = { ballW, velW, view, world, physics, cam, Qbase, respawn, setMode, lit, start: () => $('start').click() };
