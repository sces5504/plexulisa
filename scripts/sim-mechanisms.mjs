// Bench test for the physical mechanisms and surfaces in the shared library: builds a tiny
// world per case, lets a marble loose with the globe held at a fixed tilt, and prints what
// happened. Run after changing anything in src/library/mechanisms.js or SURFACES:
//   node scripts/sim-mechanisms.mjs
import * as THREE from 'three';
import { V, Y, createBuilder, BALL_R } from '../src/kit.js';
import { seesaw, turnstile, trapdoor, trampoline } from '../src/library/mechanisms.js';
import { createPhysics } from '../src/physics.js';

const X = V(1, 0, 0);
let bad = 0;
const check = (ok, msg) => { console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${msg}`); if (!ok) bad++; };
async function sim(world, start, tiltDeg, seconds, each) {
  const ph = await createPhysics(world);
  ph.place(start);
  const g = V(Math.sin(tiltDeg * Math.PI / 180), -Math.cos(tiltDeg * Math.PI / 180), 0);
  for (let t = 0; t < seconds; t += 1 / 120) { ph.step(1 / 120, g); each?.(t, ph); }
  return ph;
}
const pos = (ph) => new THREE.Vector3().copy(ph.body.translation());
const hingeAngle = (m) => { const q = m.body.rotation(); return 2 * Math.atan2(Math.hypot(q.x, q.y, q.z), q.w) * Math.sign(q.x * m.def.axis.x + q.y * m.def.axis.y + q.z * m.def.axis.z || 1); };

console.log('seesaw');
{
  const k = createBuilder({ supports: false });
  const probe = seesaw(k, { pivot: V(0, 0, 0), dir: X });
  k.track('in', probe.entry.clone().addScaledVector(X, -2), X, Y).straight(2);
  k.track('out', probe.exit.clone(), X, Y).straight(2.5);
  const w = k.finish();
  let rest = null, minA = 9, maxX = -9;
  const ph = await sim(w, probe.entry.clone().add(V(-1.5, BALL_R + 0.02, 0)), 9, 14, (t, p) => { const a = hingeAngle(p.movers[0]); if (t < 0.6) rest = a; minA = Math.min(minA, a); maxX = Math.max(maxX, p.body.translation().x); });
  check(rest > 0.15, `rests near end down (${(rest * 57.3).toFixed(1)}°)`);
  check(minA < -0.15, `tips under the marble (${(minA * 57.3).toFixed(1)}°)`);
  check(maxX > probe.exit.x + 1, `marble carried across (reached x=${maxX.toFixed(2)}, exit at ${probe.exit.x.toFixed(2)})`);
  const after = hingeAngle(ph.movers[0]);
  check(after > 0.15, `returns when empty (${(after * 57.3).toFixed(1)}°)`);
}
console.log('trapdoor');
{
  const k = createBuilder({ supports: false });
  const t = k.track('in', V(-2, 0, 0), X, Y).straight(2);
  trapdoor(k, { pivot: t.p.clone().addScaledVector(X, 0.04), dir: X });
  k.track('below', V(-0.5, -2.2, 0), X, Y, { w: 1.4 }).straight(3.2).pitch(90, 0.8);
  const w = k.finish();
  let minA = 9;
  const ph = await sim(w, V(-1.5, BALL_R + 0.02, 0), 8, 10, (t, p) => { minA = Math.min(minA, hingeAngle(p.movers[0])); });
  check(minA < -0.4, `door swings down (${(minA * 57.3).toFixed(1)}°)`);
  check(pos(ph).y < -1.5 && pos(ph).y > -2.6, `marble landed on the track below (y=${pos(ph).y.toFixed(2)})`);
  check(Math.abs(hingeAngle(ph.movers[0])) < 0.25, `door shut again (${(hingeAngle(ph.movers[0]) * 57.3).toFixed(1)}°)`);
}
console.log('turnstile');
{
  const k = createBuilder({ supports: false });
  const pad = k.padAt(V(0, 0, 0), Y, X, 1.5, { island: false });
  turnstile(k, { center: pad.c, radius: 0.8 });
  const w = k.finish();
  let turned = 0, last = null;
  const ph = await sim(w, V(-1.1, BALL_R + 0.02, 0.35), 12, 6, (t, p) => { const a = hingeAngle(p.movers[0]); if (last != null) turned += Math.abs(a - last) < 1 ? Math.abs(a - last) : 0; last = a; });
  check(turned > 0.8, `marble pushed it round (${(turned * 57.3).toFixed(0)}° in total)`);
  check(pos(ph).y > -0.3, `marble stayed on the terrace (y=${pos(ph).y.toFixed(2)})`);
}
console.log('trampoline');
{
  const k = createBuilder({ supports: false });
  trampoline(k, { center: V(0, 0, 0) });
  const w = k.finish();
  let top = -9, hit = false;
  await sim(w, V(0, 3, 0), 0, 3, (t, p) => { const y = p.body.translation().y; if (y < 0.3) hit = true; if (hit) top = Math.max(top, y); });
  check(top > 1.6, `dropped from 3.0, bounced back to ${top.toFixed(2)}`);
}
console.log('surfaces (same 8° tilt, 3 m of lane, time to the far end)');
{
  const time = {};
  for (const name of [null, 'ice', 'felt']) {
    const k = createBuilder({ supports: false });
    const t = k.track('lane', V(-2, 0, 0), X, Y);
    if (name) t.surface(name, 5); else t.straight(5);
    const w = k.finish();
    let done = null;
    await sim(w, V(-1.8, BALL_R + 0.01, 0), 8, 12, (tt, p) => { if (done == null && p.body.translation().x > 1.2) done = tt; });
    time[name || 'wood'] = done;
    console.log(`  ${name || 'wood'}: ${done == null ? 'did not arrive' : done.toFixed(2) + 's'}`);
  }
  check(time.ice < time.wood && time.wood < time.felt, 'ice is quicker than wood, felt is slower');
}
console.log(bad ? `\n${bad} check(s) failed` : '\nall mechanisms behave');
process.exit(bad ? 1 : 0);
