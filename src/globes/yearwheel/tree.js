// 年輪 — the great tree and the lands it holds. Scenery only: no track is laid here.
//
// The tree stands upright on the axis of the globe: crown (summer) at the top, a meadow at its
// foot, and under the meadow its roots hang on down as winter's bare branches. Autumn, spring,
// the clockmakers' works and a dock float round it on its boughs, with six islets between.
import * as THREE from 'three';
import { V, Y } from '../../kit.js';
import { limb, land, clump, spike, noise, rnd } from './shapes.js';

const dir = (x, y, z) => V(x, y, z).normalize();
// The tree stands on the axis of the globe: that is the anchor everything else is read against.
// Round it, at different heights and each tipped a different way, float the lands of the year.
// `out`: which side of the tree a land floats on; its own "up" leans that way, towards the glass.
const lean = (out, tilt) => out.clone().multiplyScalar(Math.sin(tilt)).add(V(0, Math.cos(tilt), 0)).normalize();
export const SIDE = { autumn: dir(-0.8, 0, -0.6), spring: dir(0.5, 0, 0.87), works: dir(0.85, 0, -0.53), dock: dir(-0.75, 0, 0.66) };
export const HUB = V(0.3, 4.7, 0);                          // where the trunk opens into the crown
export const SUN = V(5.4, 3.3, 3.7);                        // hangs in the open sky between spring and the crown
export const DOWN = V(0, -1, 0);

export function buildTree(k) {
  const T = {};
  /* ---- the lands ---------------------------------------------------------------------------- */
  // at the foot of the tree, one rock with two faces: a meadow on top, and winter hanging underneath
  T.meadow = land(k, { c: V(0, -6.5, 0), u: Y, r: 3.9, thick: 0.9, top: 'grass', side: 'rock', seed: 5, rough: 0.16, dome: 0.3 });
  T.winter = land(k, { c: V(0, -7.7, 0), u: DOWN, r: 3.7, thick: 0.9, top: 'snow', side: 'rock', seed: 3, rough: 0.16, dome: 0.25 });
  T.autumn = land(k, { c: SIDE.autumn.clone().multiplyScalar(6.6).add(V(0, 1.7, 0)), u: lean(SIDE.autumn, 0.9), r: 2.9, thick: 1.9, top: 'thatch', side: 'rock', seed: 7, rough: 0.14, dome: 0.22, island: true });
  T.spring = land(k, { c: SIDE.spring.clone().multiplyScalar(6.7).add(V(0, -2.3, 0)), u: lean(SIDE.spring, 0.95), r: 2.9, thick: 1.9, top: 'grass', side: 'rock', seed: 11, rough: 0.14, dome: 0.25, island: true });
  T.works = land(k, { c: SIDE.works.clone().multiplyScalar(6.6).add(V(0, -0.4, 0)), u: lean(SIDE.works, 1.25), r: 2.4, thick: 1.6, top: 'stoneDark', side: 'rock', seed: 15, rough: 0.04, dome: 0.06, island: true });
  T.dock = land(k, { c: SIDE.dock.clone().multiplyScalar(5.9).add(V(0, 3.1, 0)), u: lean(SIDE.dock, 0.25), r: 1.9, thick: 1.4, top: 'moss', side: 'rock', seed: 19, rough: 0.1, dome: 0.15, island: true });
  // islets: small places to find (and to fall to), each tipped its own way
  T.islets = [
    { c: V(-1.4, -2.9, -7.2), out: dir(-0.2, 0, -1), tilt: 0.7, r: 1.5, top: 'moss', seed: 31 },        // the pond, north and low
    { c: V(-7.4, -2.4, 0.6), out: dir(-1, 0, 0.1), tilt: 1.0, r: 1.5, top: 'thatch', seed: 33 },        // the windmill, west
    { c: V(1.9, 3.2, 7.0), out: dir(0.25, 0, 1), tilt: 0.55, r: 1.3, top: 'grass', seed: 35 },          // the lamplighter's rock, south and high
    { c: V(7.6, -3.6, 1.6), out: dir(1, 0, 0.2), tilt: 1.1, r: 1.3, top: 'snow', seed: 37 },            // first snow, east and low
    { c: V(-4.6, -4.4, 5.6), out: dir(-0.6, 0, 0.8), tilt: 1.5, r: 1.4, top: 'snow', seed: 39 },        // the frozen shelf, south-west, on its side
    { c: V(3.6, -4.6, -6.0), out: dir(0.5, 0, -0.85), tilt: 1.35, r: 1.4, top: 'stoneDark', seed: 41 }, // the spring-house of the works, north-east and low
  ].map((o) => land(k, { c: o.c, u: lean(o.out, o.tilt), r: o.r, thick: 1.3, top: o.top, side: 'rock', seed: o.seed, rough: 0.1, dome: 0.15, island: true }));

  /* ---- trunk --------------------------------------------------------------------------------- */
  const foot = V(0.2, -6.5, 0.1);
  T.trunk = limb(k, [foot, V(-0.45, -3.6, 0.5), V(0.45, -0.8, -0.35), V(-0.2, 2.2, 0.3), HUB], 1.55, 0.95, { sides: 22, flare: 0.38, flutes: 7, tip: false, seed: 2 });
  for (const [s, a, r] of [[0.2, 1.0, 0.5], [0.45, 3.6, 0.45], [0.68, 5.2, 0.4], [0.33, 4.7, 0.36], [0.86, 2.4, 0.36]]) {
    const c = T.trunk.at(s), t = T.trunk.tan(s), side = new THREE.Vector3().crossVectors(t, V(1, 0, 0)).normalize().applyAxisAngle(t, a);
    clump(k, c.clone().addScaledVector(side, T.trunk.radius(s) * 0.92), r, 'bark', { seed: s * 31, lumps: 0.3, detail: 1 });
  }

  /* ---- the crown: boughs out from the hub all round, each ending in leaf ------------------------- */
  const boughs = [
    [V(1.0, 6.6, -1.9), V(1.4, 8.6, -4.6), 0.58],          // north
    [V(2.6, 6.2, -0.2), V(5.6, 7.2, -1.2), 0.6],           // east
    [V(-0.4, 7.4, 0.6), V(-0.8, 10.0, 0.4), 0.56],         // straight up
    [V(2.0, 5.9, 1.9), V(4.2, 6.4, 4.4), 0.52],            // south-east, towards the sun
    [V(-1.9, 6.3, -1.6), V(-4.6, 7.0, -3.6), 0.55],        // north-west, over autumn
    [V(-0.2, 6.2, 2.2), V(-0.6, 7.4, 5.4), 0.5],           // south
    [V(-2.2, 6.0, 1.0), V(-5.0, 6.6, 2.4), 0.5],           // south-west, over the dock
    [V(1.6, 7.6, 1.0), V(2.8, 9.6, 2.2), 0.45],            // up and south-east
  ];
  T.boughs = boughs.map(([mid, end, r], i) => limb(k, [HUB.clone().lerp(mid, 0.12), mid, end], r, 0.12, { sides: 10, seed: 10 + i }));
  // leaf masses: many and modest rather than few and huge, in three greens, with gaps to look through
  const greens = ['leaf', 'treeB', 'vine', 'leaf', 'treeA'];
  T.leaves = [];
  const leafMass = (c, r, mats, seed) => { T.leaves.push({ c, r, mats, seed }); };
  T.boughs.forEach((b, i) => {
    leafMass(b.at(1), 1.35 - (i % 3) * 0.12, greens, i * 7 + 1);
    leafMass(b.at(0.6).add(V(rnd(i, 1) - 0.5, 0.75, rnd(i, 2) - 0.5)), 1.0, greens, i * 7 + 2);
    leafMass(b.at(0.92).add(V((rnd(i, 3) - 0.5) * 2.4, (rnd(i, 4) - 0.1) * 1.5, (rnd(i, 5) - 0.5) * 2.4)), 0.95, greens, i * 7 + 3);
    leafMass(b.at(0.8).add(V((rnd(i, 6) - 0.5) * 2.2, 0.4 + rnd(i, 7) * 0.8, (rnd(i, 8) - 0.5) * 2.2)), 0.8, greens, i * 7 + 4);
  });
  leafMass(V(0.6, 10.6, -1.2), 1.1, greens, 91); leafMass(V(-2.2, 9.4, -1.6), 0.95, greens, 92); leafMass(V(3.4, 8.6, -2.6), 1.0, greens, 93); leafMass(V(-2.6, 8.4, 2.6), 0.9, greens, 94);

  /* ---- the season boughs: arms that hold a land each, and turn colour on the way ---------------- */
  const hold = (L, s0, r0, seed, colours, name, n = 5, rise = 0.9, grips = null) => {
    const from = T.trunk.at(s0), tipAt = L.c.clone().addScaledVector(L.u, -1.1), mid = from.clone().lerp(tipAt, 0.5).add(V(0, rise, 0));
    const b = limb(k, [from, mid, tipAt], r0, 0.34, { sides: 10, seed, tip: false });
    for (const a of grips || [0, 1, 2].map((f) => f * 120 + seed * 40)) { const f = a / 120, grip = L.on(a, L.r * 0.7, -0.7); limb(k, [b.at(0.9), tipAt.clone().lerp(grip, 0.55).addScaledVector(L.u, -0.3), grip], 0.26, 0.08, { sides: 7, seed: seed + f }); }
    for (let i = 0; i < n; i++) {
      const s = 0.3 + i * 0.12, c = b.at(s), off = V(rnd(i, seed) - 0.5, rnd(i, seed + 1) * 0.6 + 0.2, rnd(i, seed + 2) - 0.5).multiplyScalar(1.3);
      leafMass(c.add(off), 0.5 + s * 0.4, s < 0.5 ? [greens[i % 3], colours[0]] : colours, seed * 13 + i);
    }
    T[name] = b;
  };
  hold(T.autumn, 0.74, 0.62, 21, ['paintYellow', 'leafAmber', 'paintRed', 'leafAmber'], 'autumnBough');
  hold(T.spring, 0.5, 0.6, 25, ['petal', 'paintPink', 'paintCream', 'petal'], 'springBough', 5, 1.1);
  hold(T.works, 0.5, 0.55, 29, ['moss', 'vine', 'moss'], 'worksBough', 3, 0.2, [90, 200]);
  hold(T.dock, 0.7, 0.5, 33, ['treeB', 'leaf', 'vine'], 'dockBough', 3, 0.2);
  // the islets hang from thinner branches and roots
  // (where each leaves the trunk is chosen to pass between the turns of the spiral stair)
  T.islets.forEach((L, i) => {
    const tipAt = L.c.clone().addScaledVector(L.u, -0.9);
    if (i === 2) { limb(k, [T.boughs[5].at(0.9), T.boughs[5].at(1).lerp(tipAt, 0.5).add(V(0.9, 0, 0.5)), tipAt], 0.2, 0.12, { sides: 8, seed: 62, mat: 'vine' }); return; }   // the lamplighter's rock hangs from the crown
    const from = T.trunk.at([0.36, 0.36, 0, 0.16, 0.16, 0.1][i]);
    limb(k, [from, from.clone().lerp(tipAt, 0.5).add(V(0, [0.3, -0.9, 0, -0.2, -0.3, -0.2][i], 0)), tipAt], 0.34, 0.14, { sides: 8, seed: 60 + i });
  });

  /* ---- the roots: over the edge of the meadow and on down as winter's bare branches --------------- */
  T.roots = [];
  const W = T.winter;
  for (let i = 0; i < 8; i++) {
    const a = i * 45 + 12 + rnd(i, 40) * 16, reach = 1.9 + rnd(i, 41) * 1.3;
    const over = T.meadow.on(a, T.meadow.r * 1.0, -0.2), under = W.on(-a + 14, W.r * 0.9, 0.12);
    const hug = W.on(-a + 26, W.r * 0.5, 0.1), tipP = W.on(-a + 40, W.r * (0.12 + rnd(i, 42) * 0.3), reach);   // hugs the snow in under the ring road, then hangs
    const root = limb(k, [foot.clone().add(V(0, 0.9, 0)).lerp(over, 0.2), foot.clone().lerp(over, 0.6).add(V(0, 0.25, 0)), over, under, hug, tipP], 0.5, 0.07, { sides: 9, seed: 50 + i, ease: 0.8 });
    T.roots.push(root);
    for (let t = 0; t < 3; t++) {
      const s = 0.74 + t * 0.08, c = root.at(s), side = new THREE.Vector3().crossVectors(root.tan(s), W.u).normalize().multiplyScalar(t % 2 ? 1 : -1);
      limb(k, [c, c.clone().addScaledVector(side, 0.5).addScaledVector(W.u, 0.25), c.clone().addScaledVector(side, 0.8).addScaledVector(W.u, 0.7 + rnd(i, t) * 0.6)], 0.08, 0.025, { sides: 6, seed: i * 5 + t, collide: false });
    }
    for (let t = 0; t < 4; t++) { const s = 0.66 + t * 0.08; spike(k, root.at(s).add(V(0, root.radius(s) * 0.6, 0)), Y, 0.3 + rnd(i, 60 + t) * 0.5, 0.05, 'ice'); }
  }
  void noise;
  return T;
}

// Leaves are grown last, once the tracks are known, so that no leaf sits in a marble's way:
// a mass that would crowd a track is shrunk, and one that still would is left out.
export function growLeaves(k, T, frames = []) {
  for (const m of T.leaves) {
    let r = m.r;
    for (const f of frames) { const d = f.pos.distanceTo(m.c) - (f.keep ?? 0.75); if (d < r) r = d; }
    if (r < 0.45) continue;
    const mats = m.mats;
    clump(k, m.c, r, mats[m.seed % mats.length], { seed: m.seed, squash: 0.82, collide: r > 0.8 });
    // two or three smaller lumps on its shoulders, in the next colour along: this is what makes it read as foliage
    for (let j = 0; j < 3; j++) {
      const o = V(rnd(m.seed, j) - 0.5, rnd(m.seed, j + 5) - 0.35, rnd(m.seed, j + 9) - 0.5).normalize().multiplyScalar(r * 0.78), c = m.c.clone().add(o), rr = r * (0.5 + 0.12 * j);
      if (c.length() + rr > 11.7 || frames.some((f) => f.pos.distanceTo(c) < rr + (f.keep ?? 0.7))) continue;
      clump(k, c, rr, mats[(m.seed + j + 1) % mats.length], { seed: m.seed + j * 3, squash: 0.85, detail: 1, collide: false });
    }
  }
}
