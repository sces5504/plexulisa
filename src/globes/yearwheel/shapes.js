// 年輪 — the shapes only this globe is made of: limbs of the great tree, lumps of land, clumps of
// leaves. All of it is plain geometry handed to the builder (drawn and collided as it is), so it
// lives here and not in the shared library.
import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { V, R } from '../../kit.js';

/* ---- a small deterministic noise (no Math.random: the globe must build the same every time) ---- */
const hash = (x, y, z) => { const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return s - Math.floor(s); };
const smooth = (t) => t * t * (3 - 2 * t);
export function noise(x, y = 0, z = 0) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), xf = smooth(x - xi), yf = smooth(y - yi), zf = smooth(z - zi);
  let v = 0;
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) for (let l = 0; l < 2; l++) v += hash(xi + i, yi + j, zi + l) * (i ? xf : 1 - xf) * (j ? yf : 1 - yf) * (l ? zf : 1 - zf);
  return v * 2 - 1;
}
export const rnd = (i, salt = 0) => hash(i * 1.37 + 0.11, salt * 2.71 + 0.3, i * 0.73 + salt);

const indexed = (g) => { if (!g.index) g.setIndex(Array.from({ length: g.getAttribute('position').count }, (_, i) => i)); return g; };
// faceted: every face gets its own normal (the hand-cut look of the leaves and rocks)
export const faceted = (g) => { const f = g.toNonIndexed(); f.computeVertexNormals(); return indexed(f); };
const inside = (p, lim = R - 0.2) => { const l = p.length(); if (l > lim) p.multiplyScalar(lim / l); return p; };

/* ---- limb: a branch, a root, the trunk. A tube swept along a curve, fluted like bark ------------ */
// pts: Vector3[] the limb passes through; r0 → r1: radius from its thick end to its tip
// flare: extra swell at the thick end (a root flare); flutes: ridges round it; tip: close it to a point
export function limb(k, pts, r0, r1, { mat = 'bark', sides = 14, flare = 0, flutes = 5, tip = true, collide = true, seed = 1, ease = 1 } = {}) {
  const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal'), len = curve.getLength();
  const n = Math.max(6, Math.ceil(len / 0.32)), fr = curve.computeFrenetFrames(n, false), pos = [], idx = [];
  const radius = (s) => (r0 + (r1 - r0) * Math.pow(s, ease)) * (1 + flare * Math.pow(1 - s, 6));
  for (let i = 0; i <= n; i++) {
    const s = i / n, c = curve.getPointAt(s), rr = radius(s) * (tip && i === n ? 0.25 : 1);
    for (let j = 0; j < sides; j++) {
      const a = (j / sides) * Math.PI * 2;
      const ridged = 1 + 0.09 * Math.sin(flutes * a + s * len * 0.9 + seed) + 0.1 * noise(Math.cos(a) * 1.7 + seed * 7, s * len * 0.8, Math.sin(a) * 1.7);
      const p = c.clone().addScaledVector(fr.normals[i], Math.cos(a) * rr * ridged).addScaledVector(fr.binormals[i], Math.sin(a) * rr * ridged);
      inside(p); pos.push(p.x, p.y, p.z);
    }
  }
  for (let i = 0; i < n; i++) for (let j = 0; j < sides; j++) {
    const a = i * sides + j, b = i * sides + ((j + 1) % sides), c = a + sides, d = b + sides;
    idx.push(a, c, b, b, c, d);
  }
  const end = inside(curve.getPointAt(1)), ci = pos.length / 3; pos.push(end.x, end.y, end.z);
  for (let j = 0; j < sides; j++) idx.push(n * sides + j, ci, n * sides + ((j + 1) % sides));
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  k.add(g, mat, collide);
  return { curve, len, at: (s) => curve.getPointAt(Math.min(1, Math.max(0, s))), tan: (s) => curve.getTangentAt(Math.min(1, Math.max(0, s))), radius };
}

/* ---- land: a lump of ground with one walkable face ------------------------------------------- */
// c: centre of the top face; u: which way the top faces; r: its (irregular) radius
// thick: how far the rock hangs behind it; anything that would poke through the glass is pressed flat
// against it, so a land placed near the shell reads as a terrace growing out of the glass.
export function land(k, { c, u, r, thick = 1.6, top = 'grass', side = 'rock', seed = 1, rough = 0.16, dome = 0.25, ref = null, collide = true, island = false }) {
  const n = u.clone().normalize(), e1 = (ref || (Math.abs(n.y) > 0.9 ? V(1, 0, 0) : V(0, 1, 0))).clone();
  e1.addScaledVector(n, -e1.dot(n)).normalize();
  const e2 = new THREE.Vector3().crossVectors(n, e1), NR = 9, NS = 44;
  const edge = (a) => r * (1 + 0.13 * noise(Math.cos(a) * 1.6 + seed * 3.1, Math.sin(a) * 1.6, seed) + 0.05 * noise(Math.cos(a) * 4 + seed, Math.sin(a) * 4, seed * 2));
  const height = (rho, a) => dome * (1 - rho * rho) + rough * noise(Math.cos(a) * rho * r * 0.55 + seed, Math.sin(a) * rho * r * 0.55, seed * 1.7) * Math.min(1, rho * 1.6 + 0.3);
  const point = (rho, a, lift = 0) => c.clone().addScaledVector(e1, Math.cos(a) * rho * edge(a)).addScaledVector(e2, Math.sin(a) * rho * edge(a)).addScaledVector(n, height(rho, a) + lift);
  const sheet = (fn, flip) => {
    const pos = [], idx = [];
    for (let i = 0; i <= NR; i++) for (let j = 0; j < NS; j++) { const p = inside(fn(i / NR, (j / NS) * Math.PI * 2)); pos.push(p.x, p.y, p.z); }
    for (let i = 0; i < NR; i++) for (let j = 0; j < NS; j++) {
      const a = i * NS + j, b = i * NS + ((j + 1) % NS), d = a + NS, e = b + NS;
      if (flip) idx.push(a, b, d, b, e, d); else idx.push(a, d, b, b, d, e);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
    return g;
  };
  // the top: turf / snow / moss, with a rim that rolls over the edge
  k.add(faceted(sheet((rho, a) => (rho < 0.999 ? point(rho, a) : point(1.03, a, -0.16)), false)), top, collide);
  // the rock behind it. A slab for a two-faced land; for a floating island, a root of rock that
  // narrows in steps to an off-centre point, with a band of earth under the turf.
  const tipA = seed * 2.4, tipR = island ? 0.22 : 0;
  const depth = (rho, a) => {
    const lumps = 1 + 0.35 * noise(Math.cos(a) * rho * 2.2 + seed * 5, Math.sin(a) * rho * 2.2, seed);
    if (!island) return 0.2 + thick * Math.pow(1 - rho * rho, 0.55) * lumps;
    const d = Math.hypot(rho * Math.cos(a) - tipR * Math.cos(tipA), rho * Math.sin(a) - tipR * Math.sin(tipA)) / (1 + tipR);
    const cone = Math.pow(Math.max(0, 1 - d), 1.25), stepped = Math.floor(cone * 5) / 5 * 0.35 + cone * 0.65;
    return 0.34 + thick * stepped * (0.8 + 0.4 * lumps);
  };
  k.add(faceted(sheet((rho, a) => (rho < 0.999 ? point(rho * 0.98, a, -depth(rho, a)) : point(1.03, a, -0.16)), true)), side, collide);
  if (island) k.add(faceted(sheet((rho, a) => point(0.9 + rho * 0.135, a, -0.16 - (1 - rho) * 0.2 * (1 + 0.5 * noise(a * 3, seed))), true)), 'woodDark', false);
  return { c: c.clone(), u: n, e1, e2, r, on: (ang, dist, lift = 0) => { const a = (ang * Math.PI) / 180; return point(Math.min(0.97, dist / edge(a)), a, lift); } };
}

/* ---- clump: a lumpy mass (leaves, blossom, snow, a boulder) ----------------------------------- */
export function clump(k, c, r, mat, { seed = 1, squash = 1, lumps = 0.22, detail = 2, collide = true, up = null } = {}) {
  let g = mergeVertices(new THREE.IcosahedronGeometry(1, detail).deleteAttribute('normal').deleteAttribute('uv'), 1e-4);
  const p = g.getAttribute('position'), v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const s = 1 + lumps * noise(v.x * 1.9 + seed * 3.3, v.y * 1.9 + seed, v.z * 1.9 - seed * 2.1) + lumps * 0.5 * noise(v.x * 4.1 - seed, v.y * 4.1, v.z * 4.1 + seed);
    v.multiplyScalar(r * s); v.y *= squash;
    p.setXYZ(i, v.x, v.y, v.z);
  }
  if (up) g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), up.clone().normalize()));
  g.translate(c.x, c.y, c.z);
  for (let i = 0; i < p.count; i++) { inside(v.fromBufferAttribute(p, i)); p.setXYZ(i, v.x, v.y, v.z); }
  g = faceted(g);
  k.add(g, mat, collide);
}

// a cone (icicle, thorn, stalactite) from `base` along `dir`
export function spike(k, base, dir, len, r, mat, collide = false) {
  const g = new THREE.ConeGeometry(r, len, 6).translate(0, len / 2, 0);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), dir.clone().normalize())).translate(base.x, base.y, base.z);
  k.add(faceted(g), mat, collide);
}
