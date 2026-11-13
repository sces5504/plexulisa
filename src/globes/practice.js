// Globe: 迴旋球 — the showcase. Built the way a real Perplexus is: no ground at all, track through
// the whole volume, every surface a floor for somebody.
//
// How it is laid out (and how to read any Perplexus-style design):
//   1. STATIONS first. Six terraces sit at the six poles of the sphere, each facing the centre,
//      so each has a different "down". They are the numbered rests of the course.
//   2. RUNS between stations. Twelve tracks follow three great circles; each curls up a wall on
//      the way (a "plane change") and each is built from two different parts of the kit, so the
//      globe doubles as a catalogue: pins, washboard, beam, zig-zag, chute, glass tube, rails,
//      gutter, launcher strip, loop, corkscrew.
//   3. A CORE to cross between them. A spiral climbs from the bottom terrace to a gear-driven
//      turntable under a glowing armillary; from there a bridge goes up the wall and over the
//      ceiling, and a staircase winds down a banked ring and drops through a cup back to the start.
//   4. PLACES TO FALL TO. Seven islets float in the corners between the runs, carrying the shared
//      scenery. Nothing leads to them: you find them by letting go at the right moment.
//   5. MECHANISMS on the stations: bumpers, a sweeper, a pendulum.
import * as THREE from 'three';
import { V, Y, createBuilder, at, sweepPoly, circleFrames } from '../kit.js';
import { turntable, sweeper, pendulum, funnel, bumpers, armillary, weighbridge, flap, shuttle } from '../library/mechanisms.js';

const A = 7.5;                                   // distance of the six terraces from the centre
const RING_SWEEP = 180;                          // how far the ring runs before its steps cut in through the spiral

function build() {
  // No forest of dowels out to the glass: like a real Perplexus, the tracks hang between the
  // stations and are tied to each other and to the shell by a few short ribs.
  const k = createBuilder({ supports: false });
  const { add, prop, strut, exitPoint, track, padAt, padAngle, arrive, padPoint, fromPad, padLantern } = k;
  const rib = (f) => { const a = f.pos.clone().addScaledVector(f.up, -0.1); strut(a, exitPoint(a, f.up.clone().negate()), 0.035, 'brass'); };
  const X = V(1, 0, 0), Z = V(0, 0, 1);

  /* ---- 1. stations --------------------------------------------------------------- */
  const POLES = {
    B: { d: V(0, -1, 0), e: X, r: 1.3, name: '底座' }, T: { d: V(0, 1, 0), e: X, r: 1.2, name: '天頂' },
    W: { d: V(-1, 0, 0), e: Z, r: 1.2, name: '西窗' }, E: { d: V(1, 0, 0), e: Z, r: 1.2, name: '東窗' },
    S: { d: V(0, 0, 1), e: X, r: 1.2, name: '南窗' }, N: { d: V(0, 0, -1), e: X, r: 1.2, name: '北窗' },
  };
  const P = {};
  for (const [key, o] of Object.entries(POLES)) P[key] = padAt(o.d.clone().multiplyScalar(A), o.d.clone().negate(), o.e, o.r);

  /* ---- 2. runs: straight part, quarter bend up the wall, straight part ----------------- */
  // each of these advances exactly L along the track
  const PART = {
    plain: (t, L) => t.straight(L),
    pegs: (t, L) => t.pegs(L),
    bumps: (t, L) => t.bumps(L, Math.max(2, Math.round(L / 0.8)), 0.08),
    beam: (t, L) => { const w = t.st.w; return t.style({ walls: 'none', w: 0.44 }).straight(L).style({ walls: 'both', w }); },
    // a gap in the track, crossed on a little platform that goes back and forth by itself
    ferry: (t, L) => {
      t.straight(0.35);
      const from = t.p.clone().addScaledVector(t.t, 0.62);
      t.drop(L - 0.7, 0);
      shuttle(k, { from, to: t.p.clone().addScaledVector(t.t, -0.62), up: t.u, radius: 0.56, name: 'shuttle-' + t.name });
      t.manual = true;
      return t.straight(0.35);
    },
    zigzag: (t, L) => { const r = L / (4 * Math.sin((40 * Math.PI) / 180)); return t.turn(40, r).turn(-80, r).turn(40, r); },
    chute: (t, L) => { const lip = t.st.lip; return t.style({ lip: 0.34 }).straight(L).style({ lip }); },
    tube: (t, L) => t.tube(L),
    rails: (t, L) => t.straight(0.3).rails(L - 0.6).straight(0.3),
    trough: (t, L) => t.trough(L),
    launcher: (t, L) => t.boost(L, 5.5),
    loop: (t, L) => t.straight(L / 2 - 0.1).style({ lip: 0.3, gain: 1.5 }).loop(0.85).style({ lip: 0.2, gain: 1 }).straight(L / 2 + 0.1),
    corkscrew: (t, L) => t.style({ gain: 1.5 }).twist(L, 360).style({ gain: 1 }),
  };
  //        from to  bend  first        bend as   second       colour
  const RUNS = [
    ['B', 'W', 3.0, 'pegs', 'plank', 'bumps', 'paintYellow'],
    ['B', 'E', 4.4, 'launcher', 'trough', 'plain', 'paintRed'],
    ['B', 'S', 2.4, 'zigzag', 'plank', 'rails', 'paintBlue'],
    ['B', 'N', 3.6, 'bumps', 'tube', 'tube', 'paintCream'],
    ['W', 'S', 3.0, 'ferry', 'plank', 'pegs', 'paintRed'],
    ['S', 'E', 4.0, 'chute', 'trough', 'launcher', 'paintYellow'],
    ['E', 'N', 2.6, 'loop', 'plank', 'zigzag', 'paintBlue'],
    ['N', 'W', 3.4, 'rails', 'plank', 'beam', 'paintCream'],
    ['W', 'T', 3.0, 'tube', 'tube', 'tube', 'paintBlue'],
    ['E', 'T', 2.2, 'pegs', 'plank', 'corkscrew', 'paintCream'],
    ['S', 'T', 2.8, 'zigzag', 'plank', 'pegs', 'paintRed'],
    ['N', 'T', 3.8, 'trough', 'trough', 'chute', 'paintYellow'],
  ];
  const run = {};
  for (const [from, to, bend, first, section, second, color] of RUNS) {
    const tr = run[`${from}-${to}`] = fromPad(P[from], padAngle(P[from], POLES[to].d), `${from}-${to}`, { color });
    PART[first](tr, A - P[from].r - bend);
    tr.style({ section }).pitch(90, bend).style({ section: 'plank' });
    PART[second](tr, A - P[to].r - bend - 0.6);
    tr.spline([{ p: P[to].c.clone().addScaledVector(POLES[from].d, P[to].r), up: P[to].u }]);   // settle exactly onto the rim
    arrive(tr, P[to]);
    rib(tr.frames[Math.floor(tr.frames.length * 0.5)]);                    // one short rib per run, from the middle of its bend to the shell
  }
  // sprung doors to shoulder through
  flap(k, run['S-T'].frames[5], { name: 'flap-1' });
  flap(k, run['B-W'].frames[run['B-W'].frames.length - 8], { name: 'flap-2' });

  /* ---- 3. the core --------------------------------------------------------------------- */
  // Leave the bottom terrace on a diagonal, climb at once (to clear the four runs that leave it
  // on the level), then wind round the centre line up to the middle of the globe.
  const diag = V(1, 0, 1).normalize(), flat = (v) => v.clone().setY(0);
  const spiral = fromPad(P.B, padAngle(P.B, diag), 'spiral', { color: 'track', lip: 0.26 }).ramp(0.9, -25).turn(90, 0.6);
  spiral.t.copy(new THREE.Vector3().crossVectors(Y, flat(spiral.p).normalize()));        // exactly tangent to a circle round the axis
  // wind up two turns and a bit, stopping at azimuth -55° so that everything leaving the turntable
  // does so on the diagonals, clear of the spiral's last turn
  const az0 = (Math.atan2(spiral.p.z, spiral.p.x) * 180) / Math.PI;
  spiral.helix(720 + ((((az0 + 55) % 360) + 360) % 360), flat(spiral.p).length(), -spiral.p.y);
  const TT_R = 1.3, TT = V(0, 0, 0);
  {
    // ease off the circle and spiral in, arriving on a diagonal
    const end = flat(spiral.p), R0 = end.length(), swing = (f, r) => end.clone().applyAxisAngle(Y, (f * 80 * Math.PI) / 180).setLength(r);
    spiral.spline([{ p: swing(0.17, R0 - 0.12) }, { p: swing(0.4, R0 - 0.7) }, { p: swing(0.68, 2.3) }, { p: swing(1, TT_R + 0.06) }]);
  }
  turntable(k, { center: TT, radius: TT_R });
  // The gear shaft hangs in the middle of the spiral, braced to it — it must not run on down
  // through the bottom terrace, which is where the marble lands.
  {
    const foot = V(0, -3.2, 0);
    strut(TT.clone().add(V(0, -0.5, 0)), foot, 0.13, 'woodDark');
    add(at(new THREE.SphereGeometry(0.2, 12, 8), foot), 'woodDark');
    for (const y of [-1.2, -2.9]) {
      const f = spiral.frames.reduce((best, q) => (Math.abs(q.pos.y - y) < Math.abs(best.pos.y - y) ? q : best));
      strut(V(0, y, 0), f.pos.clone().addScaledVector(f.up, -0.1), 0.05);
    }
    strut(TT.clone().add(V(0, -0.5, 0)), TT.clone().add(V(1.82, -0.5, 0)), 0.05);
  }
  // the armillary: a little sun above the turntable. It is what lights the globe when the room goes dark.
  armillary(k, { center: V(0, 1.75, 0), radius: 1.1, intensity: 24 });
  strut(V(0, 0.02, 0), V(0, 1.45, 0), 0.04, 'brass');

  // the sky bridge: straight on across the turntable, pins, up the wall, over onto the ceiling, in to the top terrace
  const g = flat(spiral.p).normalize().negate();
  const bridge = track('bridge', TT.clone().addScaledVector(g, TT_R + 0.06), g, Y, { color: 'paintRed' }).pegs(2.0).pitch(90, 4.0).pitch(90, 3.5);
  bridge.straight(Math.max(0.3, Math.hypot(bridge.p.x, bridge.p.z) - P.T.r - 1.2))
    .spline([{ p: P.T.c.clone().add(flat(bridge.p).normalize().multiplyScalar(P.T.r)), up: P.T.u }]);
  arrive(bridge, P.T);
  rib(bridge.frames[Math.floor(bridge.frames.length * 0.45)]);

  // the long way down: steps off the side of the turntable, a banked turn onto the ring, level
  // across the spiral, more steps, and a drop through the cup into the bottom terrace
  const side = V(g.z, 0, -g.x);
  const ring = track('ring', TT.clone().addScaledVector(side, TT_R + 0.06), side, Y, { color: 'paintYellow', lip: 0.24 }).straight(0.4).stairs(4, 0.6, 0.7).bankedTurn(90, 1.0, 18);
  ring.style({ walls: 'right' }).helix(RING_SWEEP, Math.hypot(ring.p.x, ring.p.z), -1.4).style({ walls: 'both' }).turn(90, 1.0);
  ring.t.copy(flat(ring.p).normalize().negate());                                           // aim straight at the centre line
  ring.straight(Math.hypot(ring.p.x, ring.p.z) - 3.0).stairs(2, 0.45, 0.7);                  // level across the spiral, then down inside it
  {
    // the drop cup: off the last step, round the bowl, through the hole, and a short gutter rolls you into the bottom terrace
    const inward = ring.t.clone(), spot = flat(ring.p).addScaledVector(inward, 0.25);
    const cup = funnel(k, { center: spot.clone().setY(-6.3), radius: 0.85, hole: 0.34, depth: 0.55 });
    for (const sgn of [-1, 1]) { const o = V(-inward.z, 0, inward.x).multiplyScalar(sgn * 0.8); strut(spot.clone().setY(-6.2).add(o), ring.p.clone().add(o.multiplyScalar(0.4)).add(V(0, -0.1, 0)), 0.04); }
    const gutter = track('gutter', cup.exit.clone().setY(P.B.c.y + 0.16).addScaledVector(inward, -0.25), inward, Y, { color: 'paintYellow', lip: 0.26, support: false })
      .spline([{ p: P.B.c.clone().addScaledVector(inward, -P.B.r) }]);
    arrive(gutter, P.B);
  }

  // the gravity arm: off the far side of the turntable onto a hinged stretch of track. Your weight
  // swings it down until its end hangs over the spiral a turn below; roll off and a backboard
  // drops you onto it. Let go of the arm and it lifts itself back.
  {
    const d = side.clone().negate();
    const stub = track('arm', TT.clone().addScaledVector(d, TT_R + 0.06), d, Y, { color: 'paintRed', support: false }).straight(0.45);
    const arm = weighbridge(k, { pivot: stub.p.clone().addScaledVector(d, 0.04), dir: d, length: 1.7, drop: 24 });
    const az = (Math.atan2(d.z, d.x) * 180) / Math.PI, reach = Math.hypot(arm.end.x, arm.end.z);
    add(sweepPoly(circleFrames(V(0, 0, 0), Y, X, Z, reach + 0.62, az - 11, az + 11), [[-0.03, -0.3], [0.03, -0.3], [0.03, -1.5], [-0.03, -1.5]]), 'birch');
  }
  // ribs: the ring is tied to the spiral inside it
  for (const i of [0.25, 0.45, 0.65]) {
    const f = ring.frames[Math.floor(ring.frames.length * i)], a = f.pos.clone().addScaledVector(f.up, -0.1);
    const near = spiral.frames.reduce((best, q) => (q.pos.distanceTo(a) < best.pos.distanceTo(a) ? q : best));
    strut(a, near.pos.clone().addScaledVector(near.up, -0.1), 0.035, 'brass');
  }

  /* ---- 5. mechanisms on the stations -------------------------------------------------------- */
  bumpers(k, { center: P.W.c, up: P.W.u, count: 3, spread: 0.5, r: 0.2, turn: 0.5 });
  sweeper(k, { center: P.E.c, up: P.E.u, length: 1.5, speed: 0.9 });
  pendulum(k, { pivot: P.N.c.clone().addScaledVector(P.N.u, 2.3), axis: V(0, 1, 0), hang: P.N.u.clone().negate(), length: 2.12, amplitude: 0.5, period: 3.6 });
  strut(P.N.c.clone().addScaledVector(P.N.u, 2.3), P.N.c.clone().addScaledVector(P.N.u, 2.3).add(V(0, 1, 0).multiplyScalar(3.6)), 0.035, 'brass');
  prop('moon', padPoint(P.T, -135, 0.2).addScaledVector(P.T.u, 0.5), { up: P.T.u, scale: 0.55, yaw: 0.8 });

  /* ---- 4. islets in the corners: the shared scenery, and somewhere to land ------------------ */
  const islet = (sx, sy, sz, radius, dress) => {
    const d = V(sx, sy, sz).normalize(), pd = padAt(d.clone().multiplyScalar(radius), d.clone().negate(), sy > 0 ? V(sx, 0, -sz) : V(sx, 0, sz), 1.25, { rim: false, pole: false });
    dress(pd, (name, a, rr, scale, o = {}) => prop(name, padPoint(pd, a, rr), { up: pd.u, scale, yaw: a * 0.05, ...o }));
    return pd;
  };
  islet(-1, 1, 1, 9.0, (pd, put) => { put('elder_tree', 0, 0.1, 0.7); put('mushroom', 150, 0.95, 0.3); put('mushroom', -120, 0.9, 0.22); });
  islet(-1, 1, -1, 9.0, (pd, put) => { put('house', 30, 0.35, 0.72, { mats: { body: 'paintCream', roof: 'paintRed' } }); put('tree_pine', 170, 0.8, 0.62); put('tree_round', -100, 0.85, 0.5); });
  islet(1, 1, -1, 9.0, (pd, put) => { put('stone_arch', 0, 0.0, 0.62); put('crystal', 120, 0.95, 0.8); put('tree_ply', -110, 0.95, 0.5); });
  islet(1, -1, 1, 9.2, (pd, put) => { put('lighthouse', 0, 0.2, 0.17); put('tree_pine', 140, 0.85, 0.5); put('house', -110, 0.75, 0.5, { mats: { body: 'paintYellow', roof: 'paintBlue' } }); });
  islet(-1, -1, 1, 9.2, (pd, put) => { put('mushroom', 0, 0.2, 0.95); put('mushroom', 130, 0.8, 0.55); put('mushroom', -120, 0.85, 0.42); put('jelly', 60, 0.9, 0.5); });
  islet(-1, -1, -1, 9.2, (pd, put) => { put('clam', 0, 0.15, 0.62); put('crystal', 120, 0.9, 1.1); put('crystal', -130, 0.95, 0.8); put('coral', 50, 0.95, 0.7); });
  islet(1, -1, -1, 9.2, (pd, put) => { put('coral', 0, 0.3, 1.0); put('jelly', 140, 0.7, 0.62); put('jelly', -110, 0.8, 0.48, { mats: { jelly: 'jellyB', jellyB: 'jelly' } }); put('crystal', 60, 1.0, 0.7); });

  /* ---- lanterns ------------------------------------------------------------------------------ */
  // (no angles: each lantern finds the widest stretch of rim with no track through it)
  for (const key of ['B', 'W', 'S', 'E', 'N', 'T']) padLantern(POLES[key].name, P[key]);

  return k.finish();
}

export default { id: 'practice', name: '迴旋球', blurb: '沒有地面：六個方向都是站台，軌道填滿整顆球；各種零件與機關的展示。', build };
