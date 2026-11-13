// Shared mechanisms: special parts any globe can drop in. Each takes the builder `k` (from
// createBuilder) and a small description, uses only the kit's public tools, and works at any
// orientation — `up` is whichever way the mechanism's own floor faces.
//
//   turntable   a gear-driven rotating terrace with gaps in its rim: wait, roll on, ride, roll off
//   lift        a platform that rides up and down on its own between two levels
//   sweeper     a bar that sweeps round a terrace and shoves the marble along
//   pendulum    a swinging bob to time your way past
//   funnel      a drop cup: the marble spirals in and falls through the hole onto whatever is below
//   bumpers     a cluster of posts that kick the marble away (k.bumper places a single one)
//   armillary   a glowing core with slowly turning brass rings — a centrepiece that lights a whole globe
//   archOver    stand an arch (or any gate-like prop) astride a track
//   weighbridge a hinged stretch of track: the marble's own weight swings it down to a lower level
//   flap        a sprung door across a track that the marble pushes open
//   shuttle     a platform that ferries the marble across a gap, back and forth
import * as THREE from 'three';
import { V, Y, at, sweepPoly, lipProf, circleFrames } from '../kit.js';

const X = V(1, 0, 0), Z = V(0, 0, 1), O = V(0, 0, 0);
const quat = (up) => new THREE.Quaternion().setFromUnitVectors(Y, up.clone().normalize());
const local = (up, x, y, z) => V(x, y, z).applyQuaternion(quat(up));

export function turntable(k, { center, up = Y, radius = 1.3, speed = 0.35, gaps = 4, color = 'paintBlue', gears = true, name = 'turntable' }) {
  const q = quat(up), o = (g) => g.applyQuaternion(q);
  k.mover({ name, pivot: center, axis: up.clone().normalize(), speed }, () => {
    k.add(o(at(new THREE.CylinderGeometry(radius, radius, 0.12, 56), V(0, -0.06, 0))), color);
    k.add(o(at(new THREE.CylinderGeometry(radius * 0.8, radius * 0.8, 0.012, 48), V(0, 0.006, 0))), 'paintCream', false);
    k.add(o(at(new THREE.CylinderGeometry(radius * 0.45, radius * 0.45, 0.02, 40), V(0, 0.01, 0))), 'paintRed', false);
    const half = (Math.asin(0.52 / radius) * 180) / Math.PI, span = 360 / gaps;
    for (let i = 0; i < gaps; i++) k.add(o(sweepPoly(circleFrames(O, Y, X, Z, radius - 0.045, i * span + half, (i + 1) * span - half), lipProf(-0.035, 0.035, 0.26))), 'curb');
    if (gears) k.prop('gear_big', local(up, 0, -0.42, 0), { up });
  });
  if (gears) k.mover({ name: name + '-pinion', pivot: center.clone().add(local(up, 1.82, -0.42, 0)), axis: up.clone().normalize(), speed: (-speed * 18) / 7, phase: Math.PI / 7 }, () => k.prop('gear_small', O, { up }));
  k.neutral.push({ pos: center.clone(), nu: up.clone().normalize(), r: radius + 0.25, gain: 1 });
  return { center, up, radius, edge: (dir) => center.clone().addScaledVector(dir, radius + 0.06) };
}

// foot: where the platform rests at the bottom; height: how far it climbs; inward: the horizontal
// direction of the landing at the top (the rim is open that way and the opposite way)
export function lift(k, { foot, height, inward, radius = 0.75, rise = 3.2, dwell = 2.6, color = 'paintRed', name = 'lift' }) {
  const inn = inward.clone().setY(0).normalize(), side = V(-inn.z, 0, inn.x), top = foot.y + height;
  k.mover({ name, kind: 'lift', pivot: foot, axis: Y, travel: height, rise, dwell, speed: 0 }, () => {
    k.add(at(new THREE.CylinderGeometry(radius, radius, 0.1, 40), V(0, -0.05, 0)), color);
    k.add(at(new THREE.CylinderGeometry(radius * 0.66, radius * 0.66, 0.012, 32), V(0, 0.006, 0)), 'paintCream', false);
    const e2 = new THREE.Vector3().crossVectors(Y, inn);
    for (const a of [30, 210]) k.rail(circleFrames(O, Y, inn, e2, radius - 0.04, a, a + 120), 0.2);
    for (const sg of [-1, 1]) k.add(at(new THREE.BoxGeometry(0.2, 0.16, 0.2), side.clone().multiplyScalar(sg * (radius + 0.11)).add(V(0, -0.02, 0))), 'woodDark');
  });
  const post = (sg, y) => foot.clone().addScaledVector(side, sg * (radius + 0.11)).setY(y);
  for (const sg of [-1, 1]) k.strut(post(sg, foot.y - 0.2), post(sg, top + 1.3), 0.055);
  k.strut(post(-1.08, top + 1.3), post(1.08, top + 1.3), 0.05);
  k.mover({ name: name + '-pulley', pivot: foot.clone().setY(top + 1.3), axis: side, speed: 1.4 }, () => k.prop('gear_small', O, { up: side, scale: 0.7 }));
  for (let y = foot.y; y <= top + 0.3; y += 0.5) k.neutral.push({ pos: V(foot.x, y, foot.z), nu: Y.clone(), r: radius + 0.2, gain: 1 });
  return { foot, top: foot.clone().setY(top), landing: foot.clone().setY(top).addScaledVector(inn, radius + 0.05) };
}

export function sweeper(k, { center, up = Y, length = 1.7, speed = 1.0, name = 'sweeper' }) {
  const q = quat(up), o = (g) => g.applyQuaternion(q);
  k.mover({ name, pivot: center, axis: up.clone().normalize(), speed }, () => {
    k.add(o(at(new THREE.BoxGeometry(length, 0.16, 0.14), V(0, 0.14, 0))), 'paintRed');
    k.add(o(at(new THREE.CylinderGeometry(0.16, 0.2, 0.3, 16), V(0, 0.15, 0))), 'brass');
    for (const s of [-1, 1]) k.add(o(at(new THREE.SphereGeometry(0.1, 10, 8), V((s * length) / 2, 0.14, 0))), 'brass');
  });
}

// pivot: the point it hangs from; axis: the axis it swings about; hang: which way it hangs at rest
export function pendulum(k, { pivot, axis, hang = V(0, -1, 0), length = 2.2, amplitude = 0.85, period = 3.4, phase = 0, name = 'pendulum' }) {
  const h = hang.clone().normalize();
  k.mover({ name, kind: 'swing', pivot, axis: axis.clone().normalize(), amplitude, period, phase, speed: 0 }, () => {
    k.strut(O.clone(), h.clone().multiplyScalar(length), 0.035, 'brass');
    k.add(at(new THREE.SphereGeometry(0.3, 18, 12), h.clone().multiplyScalar(length)), 'brass');
    k.add(at(new THREE.SphereGeometry(0.09, 10, 8), O.clone()), 'woodDark');
  });
}

export function funnel(k, { center, up = Y, radius = 1.2, hole = 0.36, depth = 0.62, color = 'birch' }) {
  const prof = [];
  for (let i = 0; i <= 10; i++) { const s = i / 10; prof.push(new THREE.Vector2(hole + (radius - hole) * s, -depth * (1 - s) ** 2.2)); }
  prof.push(new THREE.Vector2(radius, 0.14), new THREE.Vector2(radius + 0.07, 0.14), new THREE.Vector2(radius + 0.07, -0.06));
  for (let i = 10; i >= 0; i--) { const s = i / 10; prof.push(new THREE.Vector2(hole + 0.07 + (radius - hole) * s, -0.06 - depth * (1 - s) ** 2.2)); }
  k.add(at(new THREE.LatheGeometry(prof, 40), center, up), color);
  k.neutral.push({ pos: center.clone(), nu: up.clone().normalize(), r: radius + 0.1, gain: 1 });
  return { exit: center.clone().addScaledVector(up, -depth - 0.1) };
}

export function bumpers(k, { center, up = Y, count = 3, spread = 0.6, r = 0.26, turn = 0 }) {
  const u = up.clone().normalize(), e1 = Math.abs(u.x) > 0.9 ? Z.clone() : X.clone();
  e1.addScaledVector(u, -e1.dot(u)).normalize();
  const e2 = new THREE.Vector3().crossVectors(u, e1);
  for (let i = 0; i < count; i++) {
    const a = turn + (i / count) * Math.PI * 2;
    k.bumper(center.clone().addScaledVector(e1, Math.cos(a) * spread).addScaledVector(e2, Math.sin(a) * spread), u, r);
  }
}

export function armillary(k, { center, radius = 1.15, color = 0xffc46b, intensity = 34, reach = 24, name = 'armillary' }) {
  k.add(at(new THREE.SphereGeometry(radius * 0.3, 24, 16), center), 'sun');
  k.light(center, color, intensity, reach, 0.4);
  const ring = (i, r, axis, speed) => k.mover({ name: `${name}-ring${i}`, pivot: center, axis: axis.normalize(), speed }, () => {
    const g = new THREE.TorusGeometry(r, 0.04, 8, 56);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(Z, V(axis.z, axis.x, axis.y).normalize()));
    k.add(g, 'brass');
  });
  ring(1, radius, V(0.3, 1, 0.2), 0.5);
  ring(2, radius * 0.82, V(1, 0.25, -0.3), -0.7);
  ring(3, radius * 0.64, V(-0.2, 0.3, 1), 0.9);
}

// the yaw that turns a prop standing on `up` so that its local +X points along `dir`
export function yawFor(up, dir) {
  const xr = X.clone().applyQuaternion(quat(up)), u = up.clone().normalize(), d = dir.clone().addScaledVector(u, -dir.dot(u)).normalize();
  return Math.atan2(new THREE.Vector3().crossVectors(xr, d).dot(u), xr.dot(d));
}
// stand a gate-like prop astride a track at one of its frames (its opening faces along the track)
export function archOver(k, frame, { name = 'stone_arch', scale = 1, sink = 0.12 } = {}) {
  k.prop(name, frame.pos.clone().addScaledVector(frame.up, -sink), { up: frame.up, yaw: yawFor(frame.up, frame.right), scale });
}

const basis = (a, up) => new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(a, up, new THREE.Vector3().crossVectors(a, up)));

// The gravity arm. A stretch of track hinged at its near end and held level by a spring; when the
// marble rolls out along it, its weight swings the far end down to `drop` degrees, where it can
// roll off onto a lower track. Then the arm lifts itself back. Returns where the lowered end is.
// (The spring is sized so that the marble's weight at the far end bends it exactly `drop` degrees.)
export function weighbridge(k, { pivot, dir, up = Y, length = 1.8, width = 0.72, drop = 24, color = 'paintRed', name = 'weighbridge' }) {
  const u = up.clone().normalize(), a = dir.clone().addScaledVector(u, -dir.dot(u)).normalize(), axis = new THREE.Vector3().crossVectors(a, u), q = basis(a, u);
  const P = (along, lift = 0, across = 0) => a.clone().multiplyScalar(along).addScaledVector(u, lift).addScaledVector(axis, across);
  k.mover({ name, kind: 'hinge', pivot, axis, limits: [(-(drop + 6) * Math.PI) / 180, 0.04], target: 0, stiffness: (0.171 * 12 * length) / ((drop * Math.PI) / 180), springDamping: 1.1, damping: 1.2, speed: 0 }, () => {
    k.box([length, 0.08, width], P(length / 2, -0.04), color, q, 0.02);
    for (const s of [-1, 1]) k.box([length, 0.2, 0.06], P(length / 2, 0.1, s * (width / 2 - 0.03)), 'curb', q, 0.004);
    k.box([0.08, 0.3, 0.08], P(0.1, -0.24), 'brass', q, 0.002);                          // hangs clear of the fixed track behind the hinge
    k.box([0.3, 0.22, 0.36], P(0.1, -0.5), 'brass', q, 0.004);                       // the counterweight you can see
  });
  for (const s of [-1, 1]) k.strut(pivot.clone().addScaledVector(axis, s * (width / 2 + 0.08)).addScaledVector(u, -0.04), pivot.clone().addScaledVector(axis, s * (width / 2 + 0.08)).addScaledVector(u, 0.2), 0.05, 'brass');
  for (let x = 0.2; x < length; x += 0.4) k.neutral.push({ pos: pivot.clone().addScaledVector(a, x), nu: u.clone(), r: 0.7, gain: 1 });
  const low = a.clone().applyAxisAngle(axis, (-drop * Math.PI) / 180);
  return { end: pivot.clone().addScaledVector(low, length), dir: low, levelEnd: pivot.clone().addScaledVector(a, length) };
}

// A sprung door hinged at one side of a track; the marble shoulders it open and it swings shut behind.
export function flap(k, frame, { width = 0.42, height = 0.34, color = 'paintCream', name = 'flap' } = {}) {
  const u = frame.up, post = frame.pos.clone().addScaledVector(frame.right, -width / 2 - 0.06), q = basis(frame.right, u);
  k.mover({ name, kind: 'hinge', pivot: post, axis: u.clone(), limits: [-1.45, 1.45], target: 0, stiffness: 0.12, springDamping: 0.03, damping: 0.5, speed: 0 }, () => {
    const mid = frame.right.clone().multiplyScalar(width / 2 + 0.08).addScaledVector(u, height / 2 + 0.04);   // starts clear of its own post
    k.box([width, height, 0.05], mid, color, q, 0.008);
    k.box([width * 0.5, height * 0.4, 0.06], mid, 'paintRed', q, 0.001);
  });
  k.strut(post.clone(), post.clone().addScaledVector(u, height + 0.12), 0.04, 'brass');
}

// A platform that carries the marble across a gap between two track ends, there and back, on its own.
export function shuttle(k, { from, to, up = Y, radius = 0.6, rise = 2.6, dwell = 2.2, color = 'paintYellow', name = 'shuttle' }) {
  const u = up.clone().normalize(), d = to.clone().sub(from), travel = d.length(), a = d.clone().normalize(), e2 = new THREE.Vector3().crossVectors(u, a), q = quat(u);
  k.mover({ name, kind: 'lift', pivot: from, axis: a, travel, rise, dwell, speed: 0 }, () => {
    k.add(at(new THREE.CylinderGeometry(radius, radius, 0.1, 36), u.clone().multiplyScalar(-0.05), u), color);
    k.add(at(new THREE.CylinderGeometry(radius * 0.6, radius * 0.6, 0.012, 28), u.clone().multiplyScalar(0.006), u), 'paintCream', false);
    for (const a0 of [42, 222]) k.rail(circleFrames(O, u, a, e2, radius - 0.04, a0, a0 + 96), 0.2);
    void q;
  });
  k.strut(from.clone().addScaledVector(u, -0.16), to.clone().addScaledVector(u, -0.16), 0.035, 'brass');     // the rail it rides
  for (let x = 0; x <= travel; x += 0.4) k.neutral.push({ pos: from.clone().addScaledVector(a, x), nu: u.clone(), r: radius + 0.2, gain: 1 });
}

/* ======================================================================================== */
/* Added after the original set. Same contract: only the kit's public tools, any orientation, */
/* and every number that decides how a mechanism behaves lives here, so it plays the same in */
/* every globe.                                                                              */
/*                                                                                          */
/*   seesaw       a plank balanced on a pivot: roll past the middle and it tips you onward    */
/*   turnstile    a free-spinning cross on a terrace that the marble shoulders round          */
/*   trapdoor     a short hinged leaf that gives way under the marble (a quick way down)      */
/*   trampoline   a rubber drum to fall onto                                                 */
/*   carousel     a turntable under a striped canopy with brass poles; lit from within        */
/*   gearTrain    a line of meshing gears, turning                                           */
/*   pendulumRow  several bobs across a path, swinging out of step                            */
/*   musicDrum    a pinned brass cylinder turning against a steel comb                        */
/*   windupKey    a slowly turning clockwork key                                              */
/*   mobile       a hanging mobile: arms that turn, with a shared prop on each                */
/* ======================================================================================== */
const frameOn = (up, dir) => { const u = up.clone().normalize(), a = dir.clone().addScaledVector(u, -dir.dot(u)).normalize(); return { u, a, axis: new THREE.Vector3().crossVectors(a, u) }; };

// A plank on a central pivot. It rests with its near end down (a light spring holds it there);
// the marble rolls on, passes the middle, and its weight tips the far end down. One way: near → far.
// Lay the track so it arrives at `entry` and carries on from `exit` (both a little below the pivot).
export function seesaw(k, { pivot, dir, up = Y, length = 2.4, width = 0.72, tilt = 13, color = 'paintBlue', name = 'seesaw' }) {
  const { u, a, axis } = frameOn(up, dir), q = basis(a, u), th = (tilt * Math.PI) / 180, half = length / 2;
  const P = (along, lift = 0, across = 0) => a.clone().multiplyScalar(along).addScaledVector(u, lift).addScaledVector(axis, across);
  // spring: strong enough to bring the empty plank back, weak enough that the marble (0.171) tips it once ~1/3 of the way past the middle
  k.mover({ name, kind: 'hinge', pivot, axis, limits: [-th, th], target: th, stiffness: (0.171 * 12 * half * 0.33) / (2 * th), springDamping: 0.25, damping: 1.6, speed: 0 }, () => {
    k.box([length, 0.08, width], P(0, -0.04), color, q, 0.03);
    for (const s of [-1, 1]) k.box([length, 0.2, 0.06], P(0, 0.1, s * (width / 2 - 0.03)), 'curb', q, 0.004);
    k.box([0.16, 0.012, width - 0.14], P(0, 0.006), 'paintCream', q, 0.0005);
  });
  for (const s of [-1, 1]) {
    const foot = pivot.clone().addScaledVector(axis, s * (width / 2 + 0.09));
    k.strut(foot.clone().addScaledVector(u, -0.75), foot.clone().addScaledVector(u, 0.06), 0.05, 'woodDark');
    k.add(at(new THREE.SphereGeometry(0.075, 10, 8), foot.clone().addScaledVector(u, 0.06)), 'brass', false);
  }
  k.strut(pivot.clone().addScaledVector(axis, -(width / 2 + 0.09)).addScaledVector(u, -0.75), pivot.clone().addScaledVector(axis, width / 2 + 0.09).addScaledVector(u, -0.75), 0.04, 'woodDark');
  for (let x = -half; x <= half; x += 0.4) k.neutral.push({ pos: pivot.clone().addScaledVector(a, x), nu: u.clone(), r: 0.7, gain: 1 });
  // (0.06 clear of the plank's end, so it can swing past the fixed track without touching it)
  const end = (s) => pivot.clone().addScaledVector(a, s * (half * Math.cos(th) + 0.06)).addScaledVector(u, -half * Math.sin(th));
  return { entry: end(-1), exit: end(1), dir: a, slope: tilt };
}

// A cross of four paddles on a post in the middle of a terrace, free to spin: the marble pushes it round.
export function turnstile(k, { center, up = Y, radius = 0.7, height = 0.24, color = 'paintRed', name = 'turnstile' }) {
  const { u, a, axis } = frameOn(up, Math.abs(up.x) > 0.9 ? Z : X);
  k.mover({ name, kind: 'hinge', pivot: center.clone().addScaledVector(u, 0.04 + height / 2), axis: u.clone(), damping: 0.35, speed: 0 }, () => {
    k.box([radius * 2, height, 0.05], O.clone(), color, basis(a, u), 0.006);
    k.box([radius * 2, height, 0.05], O.clone(), 'paintCream', basis(axis, u), 0.006);
    k.box([0.16, height + 0.1, 0.16], O.clone(), 'brass', basis(a.clone().add(axis).normalize(), u), 0.004);
  });
  k.add(at(new THREE.SphereGeometry(0.07, 10, 8), center.clone().addScaledVector(u, height + 0.14)), 'brass', false);
}

// A short leaf of track that drops away under the marble and shuts again behind it.
// (A soft spring, pre-loaded so the empty leaf sits firmly shut: the marble opens it a third of the way along.)
export function trapdoor(k, { pivot, dir, up = Y, length = 0.95, width = 0.72, drop = 55, color = 'paintYellow', name = 'trapdoor' }) {
  const { u, a, axis } = frameOn(up, dir), q = basis(a, u), th = (drop * Math.PI) / 180;
  const P = (along, lift = 0, across = 0) => a.clone().multiplyScalar(along).addScaledVector(u, lift).addScaledVector(axis, across);
  const stiffness = (0.171 * 12 * length * 0.33) / th, self = 0.024 * 12 * (length / 2);
  k.mover({ name, kind: 'hinge', pivot, axis, limits: [-th, 0.03], target: (self * 1.5) / stiffness, stiffness, springDamping: 0.12, damping: 0.9, speed: 0 }, () => {
    k.box([length, 0.06, width], P(length / 2, -0.03), color, q, 0.016);
    for (const s of [-1, 1]) k.box([length, 0.2, 0.06], P(length / 2, 0.1, s * (width / 2 - 0.03)), 'curb', q, 0.004);
    for (const x of [0.25, 0.5, 0.75]) k.box([0.05, 0.008, width - 0.16], P(length * x, 0.004), 'paintNavy', q, 0.0002);
  });
  for (const s of [-1, 1]) k.add(at(new THREE.SphereGeometry(0.06, 10, 8), pivot.clone().addScaledVector(axis, s * (width / 2 + 0.07)).addScaledVector(u, -0.03)), 'brass', false);
  for (let x = 0.2; x < length; x += 0.4) k.neutral.push({ pos: pivot.clone().addScaledVector(a, x), nu: u.clone(), r: 0.7, gain: 1 });
  const low = a.clone().applyAxisAngle(axis, -th);
  return { end: pivot.clone().addScaledVector(low, length), dir: low };
}

// A rubber drum. Whatever lands on it is thrown back up almost as high as it fell from.
export function trampoline(k, { center, up = Y, radius = 0.9 }) {
  const u = up.clone().normalize();
  k.surface(at(new THREE.CylinderGeometry(radius, radius, 0.06, 40), center.clone().addScaledVector(u, -0.03), u), 'rubber', 'rubber');
  k.add(at(new THREE.TorusGeometry(radius + 0.03, 0.06, 8, 40).rotateX(Math.PI / 2), center.clone().addScaledVector(u, -0.03), u), 'brass');
  k.add(at(new THREE.CylinderGeometry(radius * 0.92, radius * 0.7, 0.3, 24, 1, true), center.clone().addScaledVector(u, -0.2), u), 'paintCream', false);
  k.neutral.push({ pos: center.clone(), nu: u.clone(), r: radius + 0.1, gain: 1 });
}

// A fairground roundabout: the shared turntable, plus brass poles, a striped canopy and a warm
// light under it. The light is part of the mechanism, so it is the same in every globe.
export function carousel(k, { center, up = Y, radius = 1.3, speed = 0.3, gaps = 4, poles = 6, name = 'carousel' }) {
  const u = up.clone().normalize(), q = quat(u), o = (g) => g.applyQuaternion(q), H = 1.25;
  const tt = turntable(k, { center, up, radius, speed, gaps, color: 'paintTeal', gears: false, name });
  k.mover({ name: name + '-top', pivot: center, axis: u.clone(), speed }, () => {
    k.add(o(at(new THREE.CylinderGeometry(0.09, 0.11, H, 12), V(0, H / 2, 0))), 'gold');
    for (let i = 0; i < poles; i++) {
      const a = (i / poles) * Math.PI * 2 + 0.4, x = Math.cos(a) * radius * 0.56, z = Math.sin(a) * radius * 0.56;
      k.add(o(at(new THREE.CylinderGeometry(0.03, 0.03, H, 8), V(x, H / 2, z))), 'brass');
      k.add(o(at(new THREE.SphereGeometry(0.06, 10, 8), V(x, 0.45 + (i % 2) * 0.3, z))), i % 2 ? 'paintRed' : 'paintCream', false);
    }
    const wedges = 12;
    for (let i = 0; i < wedges; i++) k.add(o(at(new THREE.ConeGeometry(radius * 1.05, 0.55, 3, 1, false, (i / wedges) * Math.PI * 2, (Math.PI * 2) / wedges), V(0, H + 0.275, 0))), i % 2 ? 'paintRed' : 'paintCream', false);
    k.add(o(at(new THREE.CylinderGeometry(radius * 1.05, radius * 1.05, 0.09, 36, 1, true), V(0, H - 0.03, 0))), 'gold', false);
    for (let i = 0; i < 18; i++) { const a = (i / 18) * Math.PI * 2; k.add(o(at(new THREE.SphereGeometry(0.05, 8, 6), V(Math.cos(a) * radius * 1.05, H - 0.09, Math.sin(a) * radius * 1.05))), 'starGlow', false); }
    k.add(o(at(new THREE.SphereGeometry(0.1, 12, 8), V(0, H + 0.6, 0))), 'gold', false);
  });
  k.light(center.clone().addScaledVector(u, H - 0.25), 0xffc070, 7, 7, 0.4);
  return tt;
}

// Gears in a line from `start` along `dir`: big, small, big… each driving the next.
export function gearTrain(k, { start, dir, up = Y, count = 3, speed = 0.3, scale = 1, name = 'gears' }) {
  const { u, a } = frameOn(up, dir);
  for (let i = 0; i < count; i++) {
    const big = i % 2 === 0;
    k.mover({ name: `${name}-${i}`, pivot: start.clone().addScaledVector(a, i * 1.82 * scale), axis: u.clone(), speed: big ? speed : (-speed * 18) / 7, phase: big ? (i / 2) * (Math.PI / 18) : Math.PI / 7 }, () => k.prop(big ? 'gear_big' : 'gear_small', O, { up: u, scale }));
  }
}

// `count` bobs hung along from → to, all swinging about that line, each a beat behind the last.
export function pendulumRow(k, { from, to, hang = V(0, -1, 0), count = 3, length = 1.8, amplitude = 0.7, period = 3.2, name = 'pendulums' }) {
  const axis = to.clone().sub(from).normalize();
  k.strut(from, to, 0.04, 'brass');
  for (let i = 0; i < count; i++) pendulum(k, { pivot: from.clone().lerp(to, (i + 0.5) / count), axis, hang, length, amplitude, period, phase: (i * 2 * Math.PI) / count, name: `${name}-${i}` });
}

// The heart of a music box. A pinned cylinder turning on `axis`, and the comb it plucks.
export function musicDrum(k, { center, axis, up = Y, length = 2.2, radius = 0.55, speed = 0.5, name = 'drum' }) {
  const ax = axis.clone().normalize(), { u, a: side } = frameOn(ax, up), qa = quat(ax);
  void u;
  k.mover({ name, pivot: center, axis: ax, speed }, () => {
    k.add(new THREE.CylinderGeometry(radius, radius, length, 40).applyQuaternion(qa), 'brass');
    for (const s of [-1, 1]) k.add(new THREE.CylinderGeometry(radius + 0.06, radius + 0.06, 0.07, 40).applyQuaternion(qa).translate(...ax.clone().multiplyScalar(s * (length / 2 + 0.03)).toArray()), 'gold');
    for (let i = 0; i < 46; i++) {
      const ang = i * 2.399963, y = (((i * 11) % 23) / 22 - 0.5) * (length - 0.2);
      k.add(new THREE.SphereGeometry(0.035, 6, 5).translate(Math.cos(ang) * radius, y, Math.sin(ang) * radius).applyQuaternion(qa), 'gold', false);
    }
    k.add(new THREE.CylinderGeometry(0.06, 0.06, length + 0.5, 10).applyQuaternion(qa), 'steel', false);
  });
  // the comb: a steel plate cut into teeth of different lengths, standing off the cylinder on the `up` side
  const teeth = 14, w = (length - 0.2) / teeth, qc = basis(ax, side);
  for (let i = 0; i < teeth; i++) {
    const len = 0.5 + 0.5 * (i / (teeth - 1));
    k.add(new THREE.BoxGeometry(w * 0.82, 0.03, len).translate(-(length - 0.2) / 2 + w * (i + 0.5), radius + 0.05, radius * 0.2 + len / 2).applyQuaternion(qc).translate(...center.toArray()), 'steel');
  }
  k.add(new THREE.BoxGeometry(length, 0.1, 0.22).translate(0, radius + 0.05, radius * 0.2 + 1.08).applyQuaternion(qc).translate(...center.toArray()), 'brass');
  return { combEnd: center.clone().add(V(0, radius + 0.05, radius * 0.2 + 1.08).applyQuaternion(qc)) };
}

// A clockwork key, turning. `axis` is the shaft; it sticks out of whatever is at `pos`.
export function windupKey(k, { pos, axis, size = 1, speed = 0.8, name = 'key' }) {
  const ax = axis.clone().normalize(), qa = quat(ax), s = size;
  k.mover({ name, pivot: pos, axis: ax, speed }, () => {
    k.add(new THREE.CylinderGeometry(0.05 * s, 0.05 * s, 0.7 * s, 10).translate(0, 0.35 * s, 0).applyQuaternion(qa), 'brass');
    for (const sx of [-1, 1]) k.add(new THREE.TorusGeometry(0.2 * s, 0.05 * s, 8, 24).translate(sx * 0.22 * s, 0.82 * s, 0).applyQuaternion(qa), 'brass');
    k.add(new THREE.SphereGeometry(0.08 * s, 10, 8).translate(0, 0.72 * s, 0).applyQuaternion(qa), 'gold', false);
  });
}

// A hanging mobile: a hub that turns slowly with `arms` arms, each carrying a shared prop on a thread.
// Props that glow keep their light as they travel (the catalogue's glow follows them).
export function mobile(k, { center, hang = V(0, -1, 0), radius = 1.6, arms = 4, drop = 0.9, props = ['star'], scale = 1, size = 0.5, speed = 0.25, name = 'mobile' }) {
  const h = hang.clone().normalize(), up = h.clone().negate(), { a, axis } = frameOn(up, Math.abs(up.x) > 0.9 ? Z : X);
  k.mover({ name, pivot: center, axis: up, speed }, () => {
    k.add(at(new THREE.SphereGeometry(0.1, 12, 8), O.clone()), 'brass', false);
    for (let i = 0; i < arms; i++) {
      const ang = (i / arms) * Math.PI * 2, d = a.clone().multiplyScalar(Math.cos(ang)).addScaledVector(axis, Math.sin(ang)), r = radius * (i % 2 ? 0.68 : 1), tip = d.clone().multiplyScalar(r), len = drop * (i % 2 ? 1.5 : 1);
      k.strut(O.clone(), tip, 0.018, 'brass', false);
      k.strut(tip, tip.clone().addScaledVector(h, len), 0.008, 'rope', false);
      // props have their origin at the base, so the base goes one prop-height (`size`) below the end of the thread
      k.prop(props[i % props.length], tip.clone().addScaledVector(h, len + size * scale), { up, scale, yaw: ang, collide: false });
    }
  });
}
