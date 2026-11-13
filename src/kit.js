// Plexulisa — the kit every globe is built from.
// Pure geometry + data (no DOM), so the same code feeds the renderer, the physics engine
// and the headless route-verification bot (scripts/verify.mjs).
//
// A globe (src/globes/*.js) calls createBuilder(), lays out tracks, terraces, mechanisms and
// scenery with the helpers it returns, and ends with finish(). Nothing in this file knows
// about any particular globe.
//
// Coordinates: globe centre at the origin, nominal "up" = +Y, x = east, z = south.
//
// Tracks are snapped together from a small kit of parts (see `Track`), the way a
// Perplexus is: every part starts at a cursor (position, heading, surface normal)
// and leaves the cursor at its far end, so a course reads as a chain of parts.
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import propMeshesA from './props.collision.json' with { type: 'json' };
import propMeshesB from './assets.collision.json' with { type: 'json' };
import propMeshesAtelier from './packs/atelier.collision.json' with { type: 'json' };
import { ASSETS } from './library/assets.js';

// later packs never override an earlier name: what a prop is, physically, cannot change under an existing globe
const propMeshes = { ...propMeshesAtelier, ...propMeshesA, ...propMeshesB };

export const R = 12;          // inner radius of the glass
export const BALL_R = 0.18;

export const V = (x, y, z) => new THREE.Vector3(x, y, z);
export const Y = V(0, 1, 0);
export const DEG = Math.PI / 180;
export const DS = 0.18;              // sampling step along tracks

/* ------------------------------------------------------------------ */
/* Geometry helpers                                                    */
/* ------------------------------------------------------------------ */

// Sweep a convex profile (clockwise list of [x, y]; x across, y along the track normal).
export function sweepPoly(frames, prof, caps = true) {
  const pos = [], idx = [], n = prof.length;
  const corner = (f, x, y) => f.pos.clone().addScaledVector(f.right, x).addScaledVector(f.up, y);
  for (let e = 0; e < n; e++) {
    const a = prof[e], b = prof[(e + 1) % n];
    const base = pos.length / 3;
    for (const f of frames) {
      const A = corner(f, a[0], a[1]), B = corner(f, b[0], b[1]);
      pos.push(A.x, A.y, A.z, B.x, B.y, B.z);
    }
    for (let i = 0; i < frames.length - 1; i++) {
      const A = base + 2 * i, B = A + 1, A2 = A + 2, B2 = A + 3;
      idx.push(A, B, A2, B, B2, A2);
    }
  }
  const cap = (f, start) => {
    const base = pos.length / 3;
    for (const [x, y] of prof) { const c = corner(f, x, y); pos.push(c.x, c.y, c.z); }
    for (let i = 1; i < n - 1; i++) start ? idx.push(base, base + i + 1, base + i) : idx.push(base, base + i, base + i + 1);
  };
  if (caps) { cap(frames[0], true); cap(frames[frames.length - 1], false); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
// plank with chamfered edges; lip with a rounded top
export const plank = (w, t, c = 0.022) => [[-w / 2 + c, 0], [w / 2 - c, 0], [w / 2, -c], [w / 2, -t + c], [w / 2 - c, -t], [-w / 2 + c, -t], [-w / 2, -t + c], [-w / 2, -c]];
export const lipProf = (x0, x1, h, c = 0.022) => [[x0, -0.03], [x0, h - c], [x0 + c, h], [x1 - c, h], [x1, h - c], [x1, -0.03]];

export function prismGeometry(w, h, d) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([-w / 2, 0, -d / 2, w / 2, 0, -d / 2, 0, h, -d / 2, -w / 2, 0, d / 2, w / 2, 0, d / 2, 0, h, d / 2], 3));
  g.setIndex([0, 2, 1, 3, 4, 5, 0, 1, 4, 0, 4, 3, 1, 2, 5, 1, 5, 4, 2, 0, 3, 2, 3, 5]);
  return g;
}

export function at(g, pos, up = Y, yaw = 0, scale = null) {
  const q = new THREE.Quaternion().setFromUnitVectors(Y, up.clone().normalize());
  if (yaw) q.multiply(new THREE.Quaternion().setFromAxisAngle(Y, yaw));
  g.applyMatrix4(new THREE.Matrix4().compose(pos, q, scale || V(1, 1, 1)));
  return g;
}

// frames around a circle: dir(a) = e1 cos a + e2 sin a
export function circleFrames(c, u, e1, e2, r, a0, a1, yFn = null) {
  const n = Math.max(3, Math.ceil((Math.abs(a1 - a0) * DEG * r) / DS));
  const frames = [];
  for (let i = 0; i <= n; i++) {
    const a = (a0 + ((a1 - a0) * i) / n) * DEG;
    const pos = c.clone().addScaledVector(e1, r * Math.cos(a)).addScaledVector(e2, r * Math.sin(a));
    if (yFn) pos.y = yFn(a / DEG);
    const tan = e1.clone().multiplyScalar(-Math.sin(a)).addScaledVector(e2, Math.cos(a)).multiplyScalar(Math.sign(a1 - a0) || 1).normalize();
    frames.push({ pos, tan, up: u.clone(), right: new THREE.Vector3().crossVectors(tan, u).normalize() });
  }
  return frames;
}

function toCollision(geoms) {
  const merged = mergeGeometries(geoms.map((g) => {
    const c = new THREE.BufferGeometry();
    c.setAttribute('position', g.getAttribute('position').clone());
    c.setIndex(g.getIndex().clone());
    return c;
  }));
  const w = mergeVertices(merged, 1e-3);
  const src = w.getIndex().array, out = [];
  for (let i = 0; i < src.length; i += 3) {
    const a = src[i], b = src[i + 1], c = src[i + 2];
    if (a !== b && b !== c && a !== c) out.push(a, b, c);
  }
  return { vertices: new Float32Array(w.getAttribute('position').array), indices: new Uint32Array(out) };
}

/* ------------------------------------------------------------------ */
/* The track kit                                                       */
/* ------------------------------------------------------------------ */
//  straight(len)            flat run
//  turn(deg, radius)        bend in the track's own plane (+ = left)
//  pitch(deg, radius)       bend the surface itself: + curls up (quarter-pipe, wall, ceiling), - goes over a crest
//  twist(len, deg)          corkscrew around the direction of travel
//  helix(deg, radius, rise) spiral ramp
//  bumps(len, n, amp)       washboard
//  stairs(n, tread, drop)   hop-down steps (one way)
//  drop(dx, dy)             a gap to fall across (one way)
//  spline(points)           free-form section through absolute points
//  ramp(len, deg)           a straight slope that stays a slope (see "neutral" below)
//  pegs(len)                a wide lane studded with pins
//  loop(radius)             a full vertical loop
//  bankedTurn(deg, radius)  a turn that leans into itself
//  boost(len, speed)        a stretch that drives the marble along (conveyor / launcher)
//  tube(len) rails(len) trough(len)   stretches of the other sections (or style({ section }) + any part)
//  style({ w, walls, lip, skin, color, gain, section })   walls: 'both' | 'left' | 'right' | 'none'  (a 0.42-wide 'none' run is a balance beam)
//
// Sections are the physical cross-sections the kit knows: 'plank' (flat board with lips — the
// default, dressed by a skin), 'trough' (round gutter), 'tube' (closed glass pipe) and 'rails'
// (two round rails the marble rides between). They are the only shapes the physics ever sees.
//
// Neutral: every frame also carries `nu`, the direction the globe relaxes to as "up" when
// the player lets go. Parts decide it, because it is what makes them feel right:
//   - flat runs, turns, wall/ceiling bends (pitch), twists: nu follows the surface, so the
//     world eases round with the track and you never have to fight it;
//   - ramps, helixes and slides: nu stays vertical, so a slope stays a slope and the marble
//     runs down it on its own.
// `gain` scales how briskly the globe follows on that part.
//
// A track is only structure: frames + width + walls. What it is *made of* is a skin
// (see SKINS): the physics shape is always the same plank-and-lips section, so the same
// course can be re-dressed as painted wood, crystal, brass... without touching gameplay.
export class Track {
  constructor(name, p, tan, up, style = {}) {
    this.name = name;
    this.p = p.clone(); this.t = tan.clone().normalize(); this.u = up.clone().normalize();
    this.st = { w: 0.72, walls: 'both', skin: 'wood', color: 'track', lip: 0.2, support: true, gain: 1, ...style };
    this.nu = this.u.clone(); this.pins = [];
    this.runs = []; this.frames = []; this.oneWay = false;
    this._open();
  }
  get r() { return new THREE.Vector3().crossVectors(this.t, this.u).normalize(); }
  get cursor() { return { p: this.p.clone(), t: this.t.clone(), u: this.u.clone() }; }
  _open() { this.run = { st: { ...this.st }, frames: [] }; this.runs.push(this.run); this._emit(); }
  _emit(p = this.p, t = this.t, u = this.u) {
    const f = { pos: p.clone(), tan: t.clone(), up: u.clone(), right: new THREE.Vector3().crossVectors(t, u).normalize(), nu: this.nu.clone(), gain: this.st.gain, boost: this.st.boost || 0 };
    this.run.frames.push(f); this.frames.push(f);
  }
  style(o) { Object.assign(this.st, o); this._open(); return this; }
  straight(len) {
    const n = Math.max(1, Math.ceil(len / DS));
    for (let i = 0; i < n; i++) { this.p.addScaledVector(this.t, len / n); this._emit(); }
    return this;
  }
  turn(deg, radius) {
    const th = deg * DEG, c = this.p.clone().addScaledVector(this.r, -radius * Math.sign(deg));
    const n = Math.ceil((Math.abs(th) * radius) / DS) + 1, axis = this.u.clone();
    for (let i = 0; i < n; i++) { this.p.sub(c).applyAxisAngle(axis, th / n).add(c); this.t.applyAxisAngle(axis, th / n); this._emit(); }
    return this;
  }
  pitch(deg, radius, keepNeutral = false) {
    const th = deg * DEG, axis = this.r, c = this.p.clone().addScaledVector(this.u, radius * Math.sign(deg));
    const n = Math.ceil((Math.abs(th) * radius) / DS) + 1;
    for (let i = 0; i < n; i++) {
      this.p.sub(c).applyAxisAngle(axis, th / n).add(c);
      this.t.applyAxisAngle(axis, th / n); this.u.applyAxisAngle(axis, th / n);
      if (!keepNeutral) this.nu.applyAxisAngle(axis, th / n);
      this._emit();
    }
    return this;
  }
  ramp(len, deg) { return this.pitch(-deg, 1.2, true).straight(len).pitch(deg, 1.2, true); }
  // a full vertical loop; it side-steps by `shift` on the way round so it clears itself
  loop(radius, shift = 0.95) {
    const axis = this.r, c = this.p.clone().addScaledVector(this.u, radius);
    const n = Math.ceil((2 * Math.PI * radius) / DS) + 1, da = (2 * Math.PI) / n, d = axis.clone().multiplyScalar(shift / n);
    for (let i = 0; i < n; i++) {
      this.p.sub(c).applyAxisAngle(axis, da).add(c).add(d); c.add(d);
      this.t.applyAxisAngle(axis, da); this.u.applyAxisAngle(axis, da); this.nu.applyAxisAngle(axis, da);
      this._emit();
    }
    return this;
  }
  // a turn that leans into itself; the neutral stays upright, so the bank really holds the marble at speed
  bankedTurn(deg, radius, bank = 22) {
    const th = deg * DEG, sgn = Math.sign(deg), axis = this.u.clone(), c = this.p.clone().addScaledVector(this.r, -radius * sgn);
    const n = Math.ceil((Math.abs(th) * radius) / DS) + 1;
    for (let i = 1; i <= n; i++) {
      this.p.sub(c).applyAxisAngle(axis, th / n).add(c); this.t.applyAxisAngle(axis, th / n);
      const s = i / n, b = bank * DEG * Math.min(1, Math.min(s, 1 - s) / 0.22);
      this._emit(this.p, this.t, axis.clone().applyAxisAngle(this.t, -sgn * b));
    }
    return this;
  }
  // a stretch that pushes the marble along (a conveyor, a launcher): speed in units per second
  boost(len, speed = 5) { const keep = this.st.boost || 0; this.style({ boost: speed }).straight(len); this.oneWay = true; return this.style({ boost: keep }); }
  // straight stretches of the other track sections (see SECTIONS): a glass tube, a pair of rails, a round gutter
  tube(len) { return this._section('tube', len); }
  rails(len) { return this._section('rails', len); }
  trough(len) { return this._section('trough', len); }
  _section(section, len) { const keep = this.st.section || 'plank'; this.style({ section }).straight(len); return this.style({ section: keep }); }
  pegs(len) {
    const keep = { w: this.st.w };
    this.style({ w: 1.3 });
    const n = Math.floor(len / 0.6);
    for (let i = 0; i < n; i++) {
      this.straight(len / n);
      this.pins.push({ pos: this.p.clone().addScaledVector(this.r, (i % 2 ? 1 : -1) * 0.34).addScaledVector(this.t, -len / n / 2), up: this.u.clone() });
    }
    return this.style(keep);
  }
  twist(len, deg) {
    const n = Math.max(2, Math.ceil(len / DS));
    for (let i = 0; i < n; i++) { this.p.addScaledVector(this.t, len / n); this.u.applyAxisAngle(this.t, (deg * DEG) / n); this.nu.applyAxisAngle(this.t, (deg * DEG) / n); this._emit(); }
    return this;
  }
  helix(deg, radius, rise) {
    const th = deg * DEG, c = this.p.clone().addScaledVector(this.r, -radius * Math.sign(deg));
    const n = Math.ceil((Math.abs(th) * radius) / DS) + 1, axis = this.u.clone();
    const arc = (Math.abs(th) * radius) / n, dy = rise / n;
    for (let i = 0; i < n; i++) {
      this.p.sub(c).applyAxisAngle(axis, th / n).add(c).addScaledVector(axis, dy);
      c.addScaledVector(axis, dy);
      this.t.applyAxisAngle(axis, th / n);
      const tt = this.t.clone().multiplyScalar(arc).addScaledVector(axis, dy).normalize();
      this._emit(this.p, tt, axis.clone().addScaledVector(tt, -axis.dot(tt)).normalize());
    }
    return this;
  }
  // free-form section through absolute points [{ p, up? }], starting at the cursor
  spline(pts) {
    const all = [{ p: this.p.clone(), up: this.u.clone() }, ...pts];
    const curve = new THREE.CatmullRomCurve3(all.map((o) => o.p), false, 'centripetal');
    const segs = all.length - 1, n = Math.ceil(curve.getLength() / DS);
    for (let i = 1; i <= n; i++) {
      const s = (i / n) * segs, k = Math.min(segs - 1, Math.floor(s));
      const t = curve.getTangent(i / n).normalize();
      const u = (all[k].up || this.u).clone().lerp(all[k + 1].up || this.u, s - k);
      u.addScaledVector(t, -u.dot(t)).normalize();
      this.p.copy(curve.getPoint(i / n)); this.t.copy(t); this.u.copy(u); this.nu.copy(u);
      this._emit();
    }
    return this;
  }
  bumps(len, count, amp) {
    const n = Math.ceil(len / (DS * 0.6)), p0 = this.p.clone();
    for (let i = 1; i <= n; i++) {
      const s = i / n, ph = 2 * Math.PI * count * s;
      const slope = (amp * Math.PI * count * Math.sin(ph)) / len;
      const pos = p0.clone().addScaledVector(this.t, s * len).addScaledVector(this.u, (amp * (1 - Math.cos(ph))) / 2);
      this._emit(pos, this.t.clone().addScaledVector(this.u, slope).normalize(), this.u.clone().addScaledVector(this.t, -slope).normalize());
    }
    this.p.copy(p0).addScaledVector(this.t, len);
    return this;
  }
  stairs(count, tread, drop) {
    for (let k = 0; k < count; k++) {
      if (k) { this.p.addScaledVector(this.u, -drop); this._open(); }
      this.straight(tread);
    }
    this.oneWay = true;
    return this;
  }
  drop(dx, dy) { this.p.addScaledVector(this.t, dx).addScaledVector(this.u, -dy); this._open(); this.oneWay = true; return this; }

  /* ---- parts added after the original kit (all additive: nothing above changed) ---------- */
  // a run that weaves from side to side `count` times and comes back onto its own line
  wave(len, count = 2, amp = 0.5) { return this._offset(len, (s) => (amp * (1 - Math.cos(2 * Math.PI * count * s))) / 2 * (Math.floor(count * s) % 2 ? -1 : 1), 'right'); }
  // a lane change: slide `shift` sideways (+ = left) over `len`, ending parallel to where it began
  sCurve(len, shift) { return this._offset(len, (s) => -shift * s * s * (3 - 2 * s), 'right', true); }
  // a single smooth valley (depth > 0) or hill (depth < 0). The neutral stays put, so the marble
  // rocks to and fro in a valley and has to be carried over a hill.
  dip(len, depth = 0.35) { return this._offset(len, (s) => (-depth * (1 - Math.cos(2 * Math.PI * s))) / 2, 'up'); }
  _offset(len, fn, axis, keep = false) {
    const n = Math.ceil(len / (DS * 0.7)), p0 = this.p.clone(), t0 = this.t.clone(), u0 = this.u.clone(), r0 = this.r, side = axis === 'right' ? r0 : u0;
    for (let i = 1; i <= n; i++) {
      const s = i / n, slope = (fn(Math.min(1, s + 1e-3)) - fn(Math.max(0, s - 1e-3))) / (2e-3 * len);
      const tan = t0.clone().addScaledVector(side, slope).normalize();
      this._emit(p0.clone().addScaledVector(t0, s * len).addScaledVector(side, fn(s)), tan, axis === 'right' ? u0 : u0.clone().addScaledVector(t0, -slope).normalize());
    }
    this.p.copy(p0).addScaledVector(t0, len); if (keep) this.p.addScaledVector(side, fn(1));
    return this;
  }
  // zig-zag down a hillside: `count` sloping legs joined by flat hairpins (the first hairpin turns left for + radius, right for - radius)
  switchback(count, len, deg = 12, radius = 0.6) {
    for (let i = 0; i < count; i++) { this.ramp(len, deg); if (i < count - 1) this.turn((i % 2 ? -180 : 180) * (Math.sign(radius) || 1), Math.abs(radius)); }
    return this;
  }
  // a balance beam: narrow, no walls
  beam(len, w = 0.44) { const keep = { w: this.st.w, walls: this.st.walls }; this.style({ walls: 'none', w }).straight(len); return this.style(keep); }
  // a run of xylophone bars: a gentle washboard dressed as painted keys
  keys(len) { const keep = { skin: this.st.skin, w: this.st.w }; this.style({ skin: 'keys', w: 0.9 }).bumps(len, Math.max(2, Math.round(len / 0.5)), 0.035); return this.style(keep); }
  // stretches of the added sections (see SECTIONS)
  halfpipe(len) { return this._section('halfpipe', len); }
  vee(len) { return this._section('vee', len); }
  cage(len) { return this._section('cage', len); }
  // a stretch with a different physical surface (see SURFACES): 'ice', 'felt', 'rubber'
  surface(name, len) { const keep = this.st.surface || null; this.style({ surface: name }).straight(len); return this.style({ surface: keep }); }
}

// Surfaces: what a plank run is physically made of. The numbers live here and nowhere else, so
// ice is exactly as slippery — and looks the same — in every globe. A surface brings its own skin.
//   friction / restitution: of the deck itself (combined with the marble's by min / max)
//   drag: rolling resistance, per second (felt slows the marble down)
export const SURFACES = {
  ice: { friction: 0.02, restitution: 0.1, drag: 0, skin: 'ice' },
  felt: { friction: 1.2, restitution: 0.02, drag: 2.2, skin: 'felt' },
  rubber: { friction: 1.1, restitution: 0.88, drag: 0, skin: 'rubber' },
};

// Skins: (run, addVisual) -> visual geometry only. Collision is added separately and identically.
const railProf = (x, y, r) => { const o = []; for (let i = 0; i < 8; i++) { const a = -(i / 8) * Math.PI * 2; o.push([x + r * Math.cos(a), y + r * Math.sin(a)]); } return o; };
export const SKINS = {
  // painted plywood plank with rounded wooden lips
  wood(run, addV) {
    const { w, walls, color, lip } = run.st;
    addV(sweepPoly(run.frames, plank(w, 0.1)), color);
    if (walls === 'both' || walls === 'left') addV(sweepPoly(run.frames, lipProf(-w / 2, -w / 2 + 0.07, lip)), 'curb');
    if (walls === 'both' || walls === 'right') addV(sweepPoly(run.frames, lipProf(w / 2 - 0.07, w / 2, lip)), 'curb');
  },
  // a strip of cut crystal carried on two brass rails
  crystal(run, addV) {
    const { w, walls, lip } = run.st;
    addV(sweepPoly(run.frames, [[-w / 2 + 0.06, 0], [w / 2 - 0.06, 0], [w / 2 - 0.02, -0.05], [0, -0.13], [-w / 2 + 0.02, -0.05]]), 'crystal');
    if (walls === 'both' || walls === 'left') addV(sweepPoly(run.frames, railProf(-w / 2 + 0.035, lip - 0.035, 0.035)), 'brass');
    if (walls === 'both' || walls === 'right') addV(sweepPoly(run.frames, railProf(w / 2 - 0.035, lip - 0.035, 0.035)), 'brass');
    addV(sweepPoly(run.frames, railProf(-w / 2 + 0.035, -0.02, 0.03)), 'brass');
    addV(sweepPoly(run.frames, railProf(w / 2 - 0.035, -0.02, 0.03)), 'brass');
  },
};

/* ---- skins added after the original two (visual only; the physics never changes) ---------- */
const slices = (frames, step) => { const out = []; for (let i = 0; i < frames.length - 1; i += step) out.push(frames.slice(i, Math.min(frames.length, i + step + 1))); return out; };
const inset = (fs, gap) => fs.map((f, i) => (i === 0 ? { ...f, pos: f.pos.clone().addScaledVector(f.tan, gap) } : i === fs.length - 1 ? { ...f, pos: f.pos.clone().addScaledVector(f.tan, -gap) } : f));
const sides = (walls) => [...(walls === 'both' || walls === 'left' ? [-1] : []), ...(walls === 'both' || walls === 'right' ? [1] : [])];
const lipOf = (s, w, h, t = 0.07) => (s < 0 ? lipProf(-w / 2, -w / 2 + t, h) : lipProf(w / 2 - t, w / 2, h));
const strip = (x0, x1, y = 0.003) => [[x0, y], [x1, y], [x1, 0], [x0, 0]];
// one small piece per frame, set in the frame's own axes (x across, y up, z back along the track)
const perFrame = (run, every, fn) => run.frames.forEach((f, i) => { if (i % every === 0 && i < run.frames.length - 1) fn(f, i, run.frames[i + 1].pos.distanceTo(f.pos)); });
const piece = (g, f, x = 0, y = 0, z = 0) => g.translate(x, y, z).applyMatrix4(new THREE.Matrix4().makeBasis(f.right, f.up, f.tan.clone().negate()).setPosition(f.pos));
Object.assign(SKINS, {
  // fantasy miniature: a cobbled path of separate setts between kerb stones, moss on the outside
  stone(run, addV) {
    const { w, walls, lip } = run.st;
    addV(sweepPoly(run.frames, [[-w / 2, -0.03], [w / 2, -0.03], [w / 2 - 0.05, -0.1], [-w / 2 + 0.05, -0.1]]), 'stoneDark');
    slices(run.frames, 2).forEach((fs, i) => addV(sweepPoly(inset(fs, 0.014), plank(w - 0.15, 0.06, 0.025)), i % 3 === 1 ? 'stoneDark' : 'stone'));
    for (const s of sides(walls)) {
      slices(run.frames, 3).forEach((fs, i) => addV(sweepPoly(inset(fs, 0.012), lipOf(s, w, lip - (i % 2 ? 0.035 : 0), 0.075)), i % 4 === 2 ? 'stoneDark' : 'stone'));
      addV(sweepPoly(run.frames, s < 0 ? [[-w / 2 - 0.03, lip * 0.4], [-w / 2, lip * 0.4 + 0.03], [-w / 2, -0.07], [-w / 2 - 0.03, -0.04]] : [[w / 2, lip * 0.4 + 0.03], [w / 2 + 0.03, lip * 0.4], [w / 2 + 0.03, -0.04], [w / 2, -0.07]]), 'moss');
    }
  },
  // precision clockwork: a blued-steel plate on brass rails, riveted, with a little balustrade
  brass(run, addV) {
    const { w, walls, lip } = run.st;
    addV(sweepPoly(run.frames, plank(w, 0.045, 0.012)), 'steel');
    for (const s of [-1, 1]) addV(sweepPoly(run.frames, railProf(s * (w / 2 - 0.11), -0.075, 0.034)), 'brass');
    perFrame(run, 4, (f) => addV(piece(new THREE.BoxGeometry(w + 0.08, 0.035, 0.07), f, 0, -0.105), 'brass'));
    perFrame(run, 1, (f) => { for (const s of [-1, 1]) addV(piece(new THREE.SphereGeometry(0.02, 8, 5), f, s * (w / 2 - 0.115), 0.002), 'brass'); });
    for (const s of sides(walls)) {
      const x = s * (w / 2 - 0.035);
      addV(sweepPoly(run.frames, lipOf(s, w, lip * 0.4, 0.05)), 'brass');
      addV(sweepPoly(run.frames, railProf(x, lip - 0.028, 0.028)), 'brass');
      perFrame(run, 2, (f) => addV(piece(new THREE.CylinderGeometry(0.014, 0.014, lip * 0.55, 6), f, x, lip * 0.66), 'brass'));
    }
  },
  // handmade: a rope bridge of separate slats, no two quite square
  slats(run, addV) {
    const { w, walls, lip } = run.st, woods = ['birch', 'ply', 'dowel', 'birch', 'curb'];
    perFrame(run, 1, (f, i, d) => addV(piece(new THREE.BoxGeometry(w - 0.03 - (i % 3) * 0.02, 0.05, d * 0.8).rotateY((((i * 7) % 5) - 2) * 0.014), f, 0, -0.026, -d / 2), woods[i % 5]));
    for (const s of [-1, 1]) addV(sweepPoly(run.frames, railProf(s * (w / 2 - 0.12), -0.078, 0.028)), 'rope');
    for (const s of sides(walls)) {
      const x = s * (w / 2 - 0.035);
      addV(sweepPoly(run.frames, railProf(x, lip - 0.028, 0.026)), 'rope');
      addV(sweepPoly(run.frames, railProf(x, lip * 0.42, 0.018)), 'rope');
      perFrame(run, 3, (f) => addV(piece(new THREE.BoxGeometry(0.05, lip + 0.14, 0.05), f, x, (lip + 0.14) / 2 - 0.09), 'woodDark'));
    }
  },
  // finely carved: ivory with gold inlay, a beaded rim and a gilded keel
  ivory(run, addV) {
    const { w, walls, lip } = run.st;
    addV(sweepPoly(run.frames, plank(w, 0.1, 0.03)), 'ivory');
    addV(sweepPoly(run.frames, [[-w / 2 + 0.1, -0.1], [w / 2 - 0.1, -0.1], [0, -0.17]]), 'gold');
    for (const s of [-1, 1]) addV(sweepPoly(run.frames, strip(s * (w / 2 - 0.15) - 0.012, s * (w / 2 - 0.15) + 0.012)), 'gold');
    perFrame(run, 4, (f) => addV(piece(new THREE.BoxGeometry(0.085, 0.005, 0.085).rotateY(Math.PI / 4), f, 0, 0.0025), 'gold'));
    for (const s of sides(walls)) {
      addV(sweepPoly(run.frames, lipOf(s, w, lip - 0.02)), 'ivory');
      perFrame(run, 1, (f) => addV(piece(new THREE.SphereGeometry(0.033, 8, 6), f, s * (w / 2 - 0.035), lip - 0.02), 'gold'));
    }
  },
  // music box: a steel comb for a deck, riding on a pinned brass cylinder
  musicbox(run, addV) {
    const { w, walls, lip } = run.st;
    addV(sweepPoly(run.frames, plank(w, 0.05, 0.012)), 'steel');
    perFrame(run, 1, (f, i, d) => addV(piece(new THREE.BoxGeometry(w - 0.2, 0.004, 0.016), f, 0, 0.002, -d / 2), 'woodDark'));
    addV(sweepPoly(run.frames, [[-w / 2 + 0.05, -0.05], [w / 2 - 0.05, -0.05], [w / 2 - 0.12, -0.15], [w / 2 - 0.24, -0.2], [-w / 2 + 0.24, -0.2], [-w / 2 + 0.12, -0.15]]), 'brass');
    perFrame(run, 1, (f, i) => addV(piece(new THREE.SphereGeometry(0.024, 8, 5), f, (((i * 5) % 7) - 3) * 0.035, -0.2), 'gold'));
    for (const s of sides(walls)) addV(sweepPoly(run.frames, lipOf(s, w, lip, 0.05)), 'brass');
  },
  // living wood: a mossy half-log with vines for rails and leaves along them
  vine(run, addV) {
    const { w, walls, lip } = run.st;
    addV(sweepPoly(run.frames, [[-w / 2 + 0.02, 0], [w / 2 - 0.02, 0], [w / 2, -0.05], [w / 2 - 0.13, -0.17], [-w / 2 + 0.13, -0.17], [-w / 2, -0.05]]), 'bark');
    addV(sweepPoly(run.frames, strip(-w / 2 + 0.1, w / 2 - 0.1, 0.004)), 'moss');
    for (const s of sides(walls)) {
      const x = s * (w / 2 - 0.036);
      addV(sweepPoly(run.frames, lipOf(s, w, lip - 0.07)), 'bark');
      addV(sweepPoly(run.frames, railProf(x, lip - 0.036, 0.036)), 'vine');
      perFrame(run, 3, (f, i) => addV(piece(new THREE.SphereGeometry(0.075, 8, 5).scale(1, 0.22, 0.6).rotateZ(-s * 0.5).rotateY(i), f, x + s * 0.07, lip - 0.02), i % 2 ? 'leaf' : 'treeB'));
      perFrame(run, 8, (f) => addV(piece(new THREE.SphereGeometry(0.03, 8, 6), f, x + s * 0.03, lip + 0.015), 'petal'));
    }
  },
  // painted xylophone bars on two dark rails (used by Track.keys)
  keys(run, addV) {
    const { w, walls, lip } = run.st, paint = ['paintRed', 'paintYellow', 'paintCream', 'paintBlue', 'paintGreen', 'paintCream'];
    perFrame(run, 1, (f, i, d) => addV(piece(new THREE.BoxGeometry(w - 0.16, 0.05, d * 0.82), f, 0, -0.026, -d / 2), paint[Math.floor(i / 2) % paint.length]));
    for (const s of [-1, 1]) addV(sweepPoly(run.frames, railProf(s * (w / 2 - 0.2), -0.08, 0.03)), 'woodDark');
    for (const s of sides(walls)) addV(sweepPoly(run.frames, lipOf(s, w, lip)), 'woodDark');
  },
  // the skins that go with a surface (see SURFACES)
  ice(run, addV) {
    const { w, walls, lip } = run.st;
    addV(sweepPoly(run.frames, plank(w, 0.1, 0.03)), 'ice');
    perFrame(run, 3, (f, i) => addV(piece(new THREE.ConeGeometry(0.035 + (i % 2) * 0.015, 0.16 + (i % 4) * 0.05, 6).rotateX(Math.PI), f, (((i * 3) % 5) - 2) * 0.12, -0.17), 'ice'));
    for (const s of sides(walls)) addV(sweepPoly(run.frames, lipOf(s, w, lip)), 'frost');
  },
  felt(run, addV) {
    const { w, walls, lip } = run.st;
    addV(sweepPoly(run.frames, plank(w, 0.1)), 'woodDark');
    addV(sweepPoly(run.frames, strip(-w / 2 + 0.07, w / 2 - 0.07, 0.004)), 'felt');
    for (const s of sides(walls)) { addV(sweepPoly(run.frames, lipOf(s, w, lip)), 'woodDark'); addV(sweepPoly(run.frames, railProf(s * (w / 2 - 0.035), lip, 0.014)), 'brass'); }
  },
  rubber(run, addV) {
    const { w, walls, lip } = run.st;
    addV(sweepPoly(run.frames, plank(w, 0.1, 0.035)), 'rubber');
    for (const s of sides(walls)) addV(sweepPoly(run.frames, lipOf(s, w, lip)), 'paintYellow');
  },
});

export const arcPts =(rho, a0, a1, n, cy) => Array.from({ length: n + 1 }, (_, i) => { const a = (a0 + ((a1 - a0) * i) / n) * DEG; return [rho * Math.sin(a), cy - rho * Math.cos(a)]; });
const frameAt = (g, f, lift = 0) => g.applyMatrix4(new THREE.Matrix4().makeBasis(f.right, f.up, f.tan.clone().negate()).setPosition(f.pos.clone().addScaledVector(f.up, lift)));
// Non-plank sections: (run, solid, add) -> physics + looks together (their shape IS their look).
const SECTIONS = {
  trough(run, solid, add) {
    const rho = run.st.w / 2 + 0.03;
    add(sweepPoly(run.frames, [...arcPts(rho, -108, 108, 14, rho), ...arcPts(rho + 0.06, 108, -108, 14, rho)], false), run.st.color, true);
  },
  tube(run, solid, add) {
    const rho = 0.42;
    solid(sweepPoly(run.frames, arcPts(rho, -180, 180, 16, rho).slice(0, -1), false));
    add(sweepPoly(run.frames, arcPts(rho + 0.03, -180, 180, 20, rho).slice(0, -1), false), 'glassTube', false);
    add(sweepPoly(run.frames, [[-0.2, 0.004], [0.2, 0.004], [0.2, 0], [-0.2, 0]]), run.st.color, false);
    run.frames.forEach((f, i) => { if (i % 6 === 0 || i === run.frames.length - 1) add(frameAt(new THREE.TorusGeometry(rho + 0.045, 0.028, 6, 28), f, rho), 'brass', false); });
  },
  rails(run, solid, add) {
    for (const sx of [-0.13, 0.13]) add(sweepPoly(run.frames, Array.from({ length: 8 }, (_, i) => [sx + 0.045 * Math.sin((i / 8) * 2 * Math.PI), -0.004 + 0.045 * Math.cos((i / 8) * 2 * Math.PI)])), 'brass', true);
    run.frames.forEach((f, i) => { if (i % 3 === 1) add(frameAt(new THREE.BoxGeometry(0.42, 0.035, 0.07), f, -0.07), 'woodDark', false); });
  },
  /* ---- sections added after the original three ---- */
  // a wide U the marble swings from side to side in
  halfpipe(run, solid, add) {
    const rho = 0.78;
    add(sweepPoly(run.frames, [...arcPts(rho, -82, 82, 18, rho), ...arcPts(rho + 0.06, 82, -82, 18, rho)], false), run.st.color, true);
    for (const s of [-1, 1]) add(sweepPoly(run.frames, railProf(s * (rho + 0.03) * Math.sin(82 * DEG), rho - (rho + 0.03) * Math.cos(82 * DEG), 0.04)), 'curb', false);
  },
  // two plywood boards nailed into a V: the marble is held dead centre (a hand-built gutter)
  vee(run, solid, add) {
    add(sweepPoly(run.frames, [[-0.3, 0.23], [0, -0.07], [-0.035, -0.105], [-0.335, 0.195]]), 'ply', true);
    add(sweepPoly(run.frames, [[0, -0.07], [0.3, 0.23], [0.335, 0.195], [0.035, -0.105]]), 'birch', true);
    run.frames.forEach((f, i) => { if (i % 5 === 2) add(frameAt(new THREE.BoxGeometry(0.5, 0.05, 0.06), f, -0.13), 'woodDark', false); });
  },
  // six steel wires round the marble, held by hoops: a roller-coaster cage you can see straight through
  cage(run, solid, add) {
    const rc = 0.3, cy = 0.293;
    for (let j = 0; j < 6; j++) { const a = (30 + j * 60) * DEG, x = rc * Math.sin(a), y = cy - rc * Math.cos(a); add(sweepPoly(run.frames, Array.from({ length: 6 }, (_, i) => [x + 0.03 * Math.sin((i / 6) * 2 * Math.PI), y + 0.03 * Math.cos((i / 6) * 2 * Math.PI)])), 'steel', true); }
    run.frames.forEach((f, i) => { if (i % 5 === 0 || i === run.frames.length - 1) add(frameAt(new THREE.TorusGeometry(rc + 0.045, 0.022, 6, 24), f, cy), 'brass', false); });
  },
};

export function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ------------------------------------------------------------------ */
/* The globe                                                           */
/* ------------------------------------------------------------------ */

// opts: { floorY, plateBottom, holes } describe an optional floor plate (a sea, a meadow…) so
// supports know where to stop; leave them out for a globe with no floor.
export function createBuilder(opts = {}) {
  // supports: false turns off the automatic dowels from every track out to the glass (brace the
  // tracks to each other and to the stations instead, the way a real Perplexus is held together)
  const { floorY = null, plateBottom = null, holes = [], supports = true } = opts;
  const collectors = () => ({ parts: {}, solids: [], props: [], boxes: [], glows: [] });
  const main = collectors();
  let cur = main;
  const routes = {}, oneWay = new Set(), manual = new Set(), movers = [], tracks = [], pads = [], lanterns = [], supportReq = [], neutral = [], lights = [], boosts = [], surfaceSolids = {}, drags = [];
  // a small coloured point light that belongs to the globe (glowing caves, lanterns in a grotto…)
  // `day` scales it while the room lights are on (a lamp that should only matter after dark: day = 0.15).
  const light = (pos, color, intensity = 20, distance = 14, day = 1) => lights.push({ pos: pos.clone(), color, intensity, distance, day });
  // mood: (marble position in the globe) -> 0..1 "night". Where it is 1 the daylight fades out and
  // only the globe's own lights and glowing things are left — for caves, grottos, the far side.
  // a bumper: a post that kicks the marble away (handled exactly by the physics, like the glass)
  const bumpers = [];
  const bumper = (pos, up = Y, r = 0.3) => {
    bumpers.push({ pos: pos.clone().addScaledVector(up, 0.2), r });
    add(at(new THREE.CylinderGeometry(r * 0.72, r * 0.86, 0.34, 20), pos.clone().addScaledVector(up, 0.17), up), 'paintRed', false);
    add(at(new THREE.TorusGeometry(r * 0.9, 0.05, 8, 24).rotateX(Math.PI / 2), pos.clone().addScaledVector(up, 0.2), up), 'brass', false);
    add(at(new THREE.SphereGeometry(r * 0.7, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), pos.clone().addScaledVector(up, 0.34), up, 0, V(1, 0.5, 1)), 'paintCream', false);
  };
  let mood = null;
  const setMood = (fn) => { mood = fn; };

  const add = (g, mat, collide = true) => {
    if (g.getAttribute('uv')) g.deleteAttribute('uv');
    (cur.parts[mat] ||= []).push(g);
    if (collide) cur.solids.push(g);
    return g;
  };
  const solid = (g) => { cur.solids.push(g); return g; };
  // a fixed piece made of one of the SURFACES (drawn in `mat`, collided with that surface's physics)
  const surface = (g, mat, name) => { if (!SURFACES[name]) throw new Error(`unknown surface "${name}"`); add(g, mat, false); (surfaceSolids[name] ||= []).push(g); return g; };
  // a box that is both drawn and collided as a box — the only shape a freely swinging (hinged)
  // mechanism may be made of. size [x, y, z]; q orients it; mass in the marble's units (marble = 0.17)
  const box = (size, pos, mat, q = null, mass = 0.01) => {
    const g = new THREE.BoxGeometry(size[0], size[1], size[2]);
    if (q) g.applyQuaternion(q);
    g.translate(pos.x, pos.y, pos.z);
    add(g, mat, false);
    cur.boxes.push({ h: size.map((v) => v / 2), p: [pos.x, pos.y, pos.z], q: q ? [q.x, q.y, q.z, q.w] : [0, 0, 0, 1], mass });
  };
  // a Blender-made prop from public/props.glb (visual only; collision comes from `solid` proxies)
  // The same mesh is used for physics (public/props.glb for looks, props.collision.json for touch).
  const prop = (name, pos, o = {}) => {
    const pl = { name, pos: pos.clone(), up: (o.up || Y).clone(), yaw: o.yaw || 0, scale: o.scale || 1, mats: o.mats || null };
    cur.props.push(pl);
    // anything that shines lights its surroundings, wherever it is placed (see library/assets.js)
    // (on a moving part the light travels with it: the renderer follows mover.glows)
    for (const g of ASSETS[name]?.glow || []) {
      const q = new THREE.Quaternion().setFromUnitVectors(Y, pl.up).multiply(new THREE.Quaternion().setFromAxisAngle(Y, pl.yaw));
      const sc = Math.min(1.6, Math.max(0.6, pl.scale));
      (cur === main ? lights : cur.glows).push({ pos: V(...g.at).multiplyScalar(pl.scale).applyQuaternion(q).add(pl.pos), color: g.color, intensity: g.intensity * sc, distance: g.reach * sc, day: g.day ?? 0.35, from: name });
    }
    const src = propMeshes[name];
    if (src && o.collide !== false) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(src.p, 3));
      g.setIndex(src.i);
      cur.solids.push(at(g, pl.pos, pl.up, pl.yaw, V(pl.scale, pl.scale, pl.scale)));
    }
  };
  const bake = (parts) => Object.entries(parts).map(([mat, gs]) => ({ mat, geometry: mergeGeometries(gs) }));
  const strut = (a, b, r = 0.045, mat = 'dowel', collide = true) => {
    const d = b.clone().sub(a);
    add(at(new THREE.CylinderGeometry(r, r, d.length(), 8), a.clone().addScaledVector(d, 0.5), d.clone().normalize()), mat, collide);
  };
  const rail = (frames, h = 0.12, cw = 0.07, mat = 'curb') => add(sweepPoly(frames, lipProf(-cw / 2, cw / 2, h)), mat);
  const glassAbove = (x, z) => Math.sqrt(R * R - x * x - z * z);
  // where a ray from p along d leaves the world (the sea or the glass)
  const exitPoint = (p, d) => {
    const b = p.dot(d), c = p.lengthSq() - (R - 0.08) ** 2;
    let s = -b + Math.sqrt(Math.max(0, b * b - c));
    if (floorY != null && d.y < -1e-4 && p.y > floorY) s = Math.min(s, (p.y - floorY) / -d.y);
    if (plateBottom != null && d.y > 1e-4 && p.y < plateBottom) s = Math.min(s, (plateBottom - p.y) / d.y);
    return p.clone().addScaledVector(d, s);
  };
  const inHole = (p) => floorY != null && Math.abs(p.y - floorY) < 0.5 && holes.some((h) => Math.hypot(p.x - h.x, p.z - h.z) < h.r + 0.15);
  const mover = (def, fn) => {
    cur = collectors();
    fn();
    movers.push({ ...def, angle: 0, meshes: bake(cur.parts), props: cur.props, boxes: cur.boxes, glows: cur.glows, collision: cur.solids.length ? toCollision(cur.solids) : null });
    cur = main;
  };

  // ---- kit glue: tracks, pads, lanterns -------------------------------------
  const track = (name, p, t, u, style) => { const tr = new Track(name, p, t, u, style); tracks.push(tr); return tr; };
  // a round terrace that ends a track; other tracks can leave it at any angle (0 = straight on, + = left)
  const padAhead = (tr, r, o = {}) => {
    const c = tr.p.clone().addScaledVector(tr.t, r), u = tr.u.clone(), e1 = tr.t.clone();
    const pd = { c, u, e1, e2: new THREE.Vector3().crossVectors(u, e1), r, exits: [180], island: true, rim: true, ...o };
    pads.push(pd);
    return pd;
  };
  // a terrace placed directly: centre, surface normal, a reference direction for angle 0, radius
  const padAt = (c, u, e1, r, o = {}) => {
    const n = u.clone().normalize(), a1 = e1.clone().addScaledVector(n, -e1.dot(n)).normalize();
    const pd = { c: c.clone(), u: n, e1: a1, e2: new THREE.Vector3().crossVectors(n, a1), r, exits: [], island: true, rim: true, ...o };
    pads.push(pd);
    return pd;
  };
  // which way a direction (or a point) lies on a terrace, as an angle; arrive() opens the rim where a track comes in
  const padAngle = (pd, v) => Math.atan2(v.dot(pd.e2), v.dot(pd.e1)) / DEG;
  const arrive = (tr, pd) => { pd.exits.push(padAngle(pd, tr.p.clone().sub(pd.c))); return tr; };
  const padDir = (pd, a) => pd.e1.clone().multiplyScalar(Math.cos(a * DEG)).addScaledVector(pd.e2, Math.sin(a * DEG));
  const padPoint = (pd, a, rr) => pd.c.clone().addScaledVector(padDir(pd, a), rr);
  const fromPad = (pd, a, name, style) => { pd.exits.push(a); const d = padDir(pd, a); return track(name, pd.c.clone().addScaledVector(d, pd.r), d, pd.u, style); };
  const lantern = (name, pos, up, spawn) => { lanterns.push({ name, pos: pos.clone(), up: up.clone(), spawn: spawn.clone() }); solid(at(new THREE.CylinderGeometry(0.06, 0.06, 1.1, 6), pos.clone().addScaledVector(up, 0.55), up)); };
  // A lantern on a terrace. Give an angle to fix where it stands; leave it out and it is placed,
  // once every track is known, in the middle of the widest stretch of rim with no way in or out.
  const padLantern = (name, pd, a = null) => {
    if (a != null) return lantern(name, padPoint(pd, a, pd.r - 0.28), pd.u, pd.c);
    const L = { name, pos: pd.c.clone(), up: pd.u.clone(), spawn: pd.c.clone() };
    lanterns.push(L);
    (pd.autoLanterns ||= []).push(L);
  };

  // Call once, after everything is laid out: builds every track and terrace, plants the
  // supports, and returns the finished world.
  const finish = () => {
    /* ---- build every track ------------------------------------------------------- */
    for (const tr of tracks) {
      routes[tr.name] = tr.frames;
      if (tr.oneWay) oneWay.add(tr.name);
      if (tr.manual) manual.add(tr.name);
      for (const run of tr.runs) {
        if (run.frames.length < 2) continue;
        const { w, walls, lip, support, section = 'plank' } = run.st;
        if (section !== 'plank') SECTIONS[section](run, solid, (g, mat, collide) => add(g, mat, collide));
        else {
          // physics: always the canonical section
          const sf = run.st.surface ? SURFACES[run.st.surface] : null;
          if (sf) {
            (surfaceSolids[run.st.surface] ||= []).push(sweepPoly(run.frames, plank(w, 0.1)));
            if (sf.drag) for (const f of run.frames) drags.push({ pos: f.pos, drag: sf.drag });
          } else solid(sweepPoly(run.frames, plank(w, 0.1)));
          if (walls === 'both' || walls === 'left') solid(sweepPoly(run.frames, lipProf(-w / 2, -w / 2 + 0.07, lip)));
          if (walls === 'both' || walls === 'right') solid(sweepPoly(run.frames, lipProf(w / 2 - 0.07, w / 2, lip)));
          // looks: whatever the skin says
          SKINS[sf ? sf.skin : run.st.skin](run, (g, mat) => add(g, mat, false));
        }
        if (run.st.boost) run.frames.forEach((f, i) => {                      // painted chevrons, and the push itself
          boosts.push({ pos: f.pos, dir: f.tan, speed: run.st.boost });
          if (i % 3 === 1) for (const s of [-1, 1]) add(frameAt(new THREE.BoxGeometry(w * 0.34, 0.012, 0.07).rotateY(s * 0.6).translate(s * w * 0.14, 0, 0), f, 0.008), 'paintYellow', false);
        });
        if (support && supports) for (let i = 9; i < run.frames.length - 4; i += 18) supportReq.push(run.frames[i]);
      }
      for (const pin of tr.pins) {
        add(at(new THREE.CylinderGeometry(0.07, 0.07, 0.3, 10), pin.pos.clone().addScaledVector(pin.up, 0.15), pin.up), 'brass');
        add(at(new THREE.SphereGeometry(0.09, 10, 6), pin.pos.clone().addScaledVector(pin.up, 0.3), pin.up), 'brass');
      }
      for (const f of tr.frames) neutral.push({ pos: f.pos, nu: f.nu, r: 0.75, gain: f.gain });
    }
    // supports: a dowel straight "down" (away from the rolling surface) to the sea or the glass,
    // skipped wherever it would run through another piece of track
    const allFrames = tracks.flatMap((t) => t.frames);
    for (const f of supportReq) {
      const a = f.pos.clone().addScaledVector(f.up, -0.1), d = f.up.clone().negate(), b = exitPoint(a, d);
      const len = a.distanceTo(b);
      const blocked = allFrames.some((g) => { const s = g.pos.clone().sub(a).dot(d); return s > 0.6 && s < len && g.pos.clone().sub(a).addScaledVector(d, -s).lengthSq() < 0.36; })
        || pads.some((pd) => { const s = pd.c.clone().sub(a).dot(d); return s > 0.3 && s < len && pd.c.clone().sub(a).addScaledVector(d, -s).length() < pd.r * 1.25; });
      if (!blocked && len > 0.3 && !inHole(b)) strut(a, b, 0.04, 'dowel');
    }

    /* ---- build every pad ------------------------------------------------------------ */
    for (const pd of pads) {
      add(at(new THREE.CylinderGeometry(pd.r, pd.r, 0.1, 48), pd.c.clone().addScaledVector(pd.u, -0.05), pd.u), 'birch');
      add(at(new THREE.RingGeometry(pd.r * 0.55, pd.r * 0.62, 48).rotateX(-Math.PI / 2), pd.c.clone().addScaledVector(pd.u, 0.004), pd.u), 'curb', false);
      if (pd.rim) {
        const ex = pd.exits.map((a) => ((a % 360) + 360) % 360).sort((a, b) => a - b);
        const gap = Math.asin(0.5 / pd.r) / DEG;
        ex.forEach((a, i) => {
          const next = i + 1 < ex.length ? ex[i + 1] : ex[0] + 360;
          if (next - a > 2 * gap + 4) rail(circleFrames(pd.c, pd.u, pd.e1, pd.e2, pd.r - 0.04, a + gap, next - gap));
        });
      }
      if (pd.island) {
        const s = pd.r * 1.18, base = pd.c.clone().addScaledVector(pd.u, -0.1);
        prop('island', base, { up: pd.u, scale: s, yaw: pd.c.x });
        const tip = base.clone().addScaledVector(pd.u, -1.36 * s);
        if (pd.pole !== false) strut(tip, exitPoint(tip, pd.u.clone().negate()), 0.07, 'dowel');
      }
      if (pd.pillar) { const a = pd.c.clone().addScaledVector(pd.u, -0.1); strut(a, exitPoint(a, pd.u.clone().negate()), 0.16, 'woodDark'); }
      for (const L of pd.autoLanterns || []) {
        const ex = pd.exits.map((a) => ((a % 360) + 360) % 360).sort((a, b) => a - b);
        let best = 0, width = 360;
        if (ex.length) { width = -1; ex.forEach((a, i) => { const next = i + 1 < ex.length ? ex[i + 1] : ex[0] + 360; if (next - a > width) { width = next - a; best = a + (next - a) / 2; } }); }
        L.pos.copy(padPoint(pd, best, pd.r - 0.26));
        solid(at(new THREE.CylinderGeometry(0.06, 0.06, 1.1, 6), L.pos.clone().addScaledVector(pd.u, 0.55), pd.u));
      }
      neutral.push({ pos: pd.c, nu: pd.u, r: pd.r + 0.15, gain: 1 });
    }

    return { meshes: bake(main.parts), collision: toCollision(main.solids), props: main.props, movers, routes, oneWay, lanterns, pads, neutral, lights, mood, boosts, bumpers, manual,
      surfaces: Object.entries(surfaceSolids).map(([name, gs]) => ({ name, ...SURFACES[name], collision: toCollision(gs) })), drags };
  };

  return { add, solid, surface, box, prop, light, setMood, bumper, strut, rail, glassAbove, exitPoint, inHole, mover, track, padAhead, padAt, padAngle, arrive, padDir, padPoint, fromPad, lantern, padLantern,
    tracks, pads, lanterns, neutral, propMeshes, finish };
}
