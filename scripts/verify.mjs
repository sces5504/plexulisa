// Headless passability check: a simple bot "holds the globe" and tries to roll
// the marble along every named route, in both directions, using only gravity
// direction (rate-limited, like hands). Run: npm run verify
import * as THREE from 'three';
import { buildWorld, GLOBES, BALL_R, R } from '../src/world.js';
import { createPhysics } from '../src/physics.js';

// node scripts/verify.mjs [globe-id]   (default: every globe on the shelf, one process each)
const which = process.argv[2];
if (!which) {
  const { spawnSync } = await import('node:child_process');
  let bad = 0;
  for (const g of GLOBES) { console.log(`\n=== ${g.id} — ${g.name} ===`); bad += spawnSync(process.execPath, [process.argv[1], g.id], { stdio: 'inherit' }).status ? 1 : 0; }
  process.exit(bad ? 1 : 0);
}
const world = buildWorld(which);
const tri = world.collision.indices.length / 3;
console.log(`static collision: ${tri} triangles, movers: ${world.movers.map((m) => m.name).join(', ')}`);

// geometry sanity: everything must be inside the glass
let maxR = 0;
const v = world.collision.vertices;
for (let i = 0; i < v.length; i += 3) maxR = Math.max(maxR, Math.hypot(v[i], v[i + 1], v[i + 2]));
console.log(`max collision radius: ${maxR.toFixed(2)} (glass ${R})`);

// tracks must not run through each other
const names = Object.keys(world.routes);
for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) {
  let min = Infinity, at = null;
  const A = world.routes[names[i]], B = world.routes[names[j]];
  for (let a = 6; a < A.length - 6; a += 2) for (let b = 6; b < B.length - 6; b += 2) {
    const d = A[a].pos.distanceTo(B[b].pos);
    if (d < min) { min = d; at = A[a].pos; }
  }
  if (min < 0.8) console.log(`  WARNING ${names[i]} x ${names[j]}: ${min.toFixed(2)} apart near (${at.x.toFixed(1)}, ${at.y.toFixed(1)}, ${at.z.toFixed(1)})`);
}
for (const n of names) { const f = world.routes[n].at(-1); console.log(`  ${n}: ${world.routes[n].length} frames, ends (${f.pos.x.toFixed(2)}, ${f.pos.y.toFixed(2)}, ${f.pos.z.toFixed(2)})`); }
for (const pd of world.pads) console.log(`  pad at (${pd.c.x.toFixed(2)}, ${pd.c.y.toFixed(2)}, ${pd.c.z.toFixed(2)}) |c|=${pd.c.length().toFixed(2)}`);

const DT = 1 / 120, MAX_TILT = Math.tan((38 * Math.PI) / 180), TURN = (150 * Math.PI) / 180;
let failed = 0;

async function run(name, frames, reverse) {
  const fr = reverse ? [...frames].reverse().map((f) => ({ ...f, tan: f.tan.clone().negate(), right: f.right.clone().negate() })) : frames;
  const ph = await createPhysics(world);
  ph.place(fr[1].pos.clone().addScaledVector(fr[1].up, BALL_R + 0.01));
  const g = fr[1].up.clone().negate();
  let i = 1, t = 0, worst = 0;
  const p = new THREE.Vector3(), vel = new THREE.Vector3(), tmp = new THREE.Vector3();
  while (t < 120) {
    p.copy(ph.body.translation()); vel.copy(ph.body.linvel());
    let best = Infinity;
    for (let k = Math.max(0, i - 3); k < Math.min(fr.length, i + 8); k++) {
      const d = fr[k].pos.distanceTo(p);
      if (d < best) { best = d; i = k; }
    }
    worst = Math.max(worst, best);
    if (best > 1.3) { console.log(`  FAIL ${name}${reverse ? ' (reverse)' : ''}: left the track at frame ${i}/${fr.length} t=${t.toFixed(1)}s`); failed++; return; }
    if (i >= fr.length - 2) { console.log(`  ok   ${name}${reverse ? ' (reverse)' : ''}: ${t.toFixed(1)}s, max offset ${worst.toFixed(2)}`); return; }
    const f = fr[i], target = fr[Math.min(fr.length - 1, i + 4)];
    const lateral = tmp.copy(f.pos).sub(p).dot(f.right);
    const want = target.pos.clone().addScaledVector(target.up, BALL_R).sub(p);
    want.addScaledVector(f.up, -want.dot(f.up)).setLength(1.8).addScaledVector(f.right, lateral * 4);
    const vt = vel.clone().addScaledVector(f.up, -vel.dot(f.up));
    const acc = want.sub(vt).multiplyScalar(0.5);
    if (acc.length() > MAX_TILT) acc.setLength(MAX_TILT);
    const gWant = f.up.clone().negate().add(acc).normalize();
    const ang = g.angleTo(gWant);
    if (ang > 1e-4) g.lerp(gWant, Math.min(1, (TURN * DT) / ang)).normalize();
    ph.step(DT, g);
    t += DT;
  }
  console.log(`  FAIL ${name}${reverse ? ' (reverse)' : ''}: timeout at frame ${i}/${fr.length}`);
  failed++;
}

for (const [name, frames] of Object.entries(world.routes)) {
  if (world.manual?.has(name)) { console.log(`  skip ${name}: crosses a moving part, needs a person`); continue; }
  await run(name, frames, false);
  if (!world.oneWay.has(name)) await run(name, frames, true);
}
// Hands-off test: on parts that are meant to be slides, let go and check the marble runs
// down on its own and stays on the track (the globe only relaxes to each part's neutral).
async function freeRoll(name, frames) {
  const start = frames.findIndex((f) => f.up.angleTo(f.nu) > 0.15);
  if (start < 0) return;
  const ph = await createPhysics(world);
  ph.place(frames[start + 2].pos.clone().addScaledVector(frames[start + 2].up, BALL_R + 0.01));
  const g = frames[start].nu.clone().negate(), p = new THREE.Vector3();
  let i = start + 2, t = 0, vmax = 0;
  while (t < 60) {
    p.copy(ph.body.translation());
    let best = Infinity;
    for (let k = Math.max(0, i - 3); k < Math.min(frames.length, i + 10); k++) { const d = frames[k].pos.distanceTo(p); if (d < best) { best = d; i = k; } }
    const v = ph.body.linvel(); vmax = Math.max(vmax, Math.hypot(v.x, v.y, v.z));
    if (best > 1.3) { console.log(`  FAIL ${name} hands-off: flew off at frame ${i}/${frames.length}, top speed ${vmax.toFixed(1)}`); failed++; return; }
    if (i >= frames.length - 3 || frames[i].up.angleTo(frames[i].nu) < 0.02 && i > start + 20 && Math.hypot(v.x, v.y, v.z) < 0.3) { console.log(`  ok   ${name} hands-off: ran to frame ${i}/${frames.length} in ${t.toFixed(1)}s, top speed ${vmax.toFixed(1)}`); return; }
    const want = frames[i].nu.clone().negate(), ang = g.angleTo(want);
    if (ang > 1e-4) g.lerp(want, Math.min(1, (Math.min(3, ang * 3.4 + 0.06) * DT) / ang)).normalize();
    ph.step(DT, g); t += DT;
  }
  console.log(`  ok   ${name} hands-off: settled at frame ${i}/${frames.length}, top speed ${vmax.toFixed(1)}`);
}
// every route that contains a slope is tried hands-off, in whichever direction is downhill
for (const [n, fr] of Object.entries(world.routes)) {
  const sloped = fr.filter((f) => f.up.angleTo(f.nu) > 0.15);
  if (sloped.length < 10) continue;
  const drop = sloped[0].pos.clone().sub(sloped[sloped.length - 1].pos).dot(sloped[0].nu);   // a washboard nets out to nothing
  if (Math.abs(drop) < 1.2) continue;
  const downhill = drop > 0;
  await freeRoll(n + (downhill ? '' : ' (down)'), downhill ? fr : [...fr].reverse());
}

console.log(failed ? `\n${failed} route check(s) failed` : '\nall routes passable');
process.exit(failed ? 1 : 0);
