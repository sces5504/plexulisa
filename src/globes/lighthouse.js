// Globe: 燈塔之海 — a lighthouse in a painted sea, floating isles, an upside-down moon terrace,
// and the Underside beneath the sea plate.
import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { R, V, Y, DEG, DS, createBuilder, sweepPoly, plank, lipProf, circleFrames, at, mulberry32 } from '../kit.js';

const GROUND_Y = -6;                      // the sea
const PLATE_BOTTOM = GROUND_Y - 0.3;
const UNDER_Y = GROUND_Y + 0.012 - 1.6;   // rolling level of the Underside (its "up" is -Y)
// wells through the sea plate (x, z, radius): the Maelstrom (way down) and the Geyser (way back up)
const HOLES = [{ x: -4.6, z: -4.6, r: 1.25 }, { x: 5.547, z: 5.547, r: 1.25 }];

function build() {
  const k = createBuilder({ floorY: GROUND_Y, plateBottom: PLATE_BOTTOM, holes: HOLES });
  const { add, prop, light, strut, rail, glassAbove, mover, track, padAhead, padPoint, fromPad, lantern, padLantern, lanterns, neutral } = k;
  const padAngle = (pd, v) => Math.atan2(v.dot(pd.e2), v.dot(pd.e1)) / DEG;   // which way a direction lies on a terrace

  /* ---- the sea: a plate with two wells cut through it; below it, the Underside ---------- */
  const RG = Math.sqrt(R * R - GROUND_Y * GROUND_Y);
  const NW = V(-Math.SQRT1_2, 0, -Math.SQRT1_2), SE = NW.clone().negate();
  {
    const shape = new THREE.Shape().absarc(0, 0, RG - 0.17, 0, Math.PI * 2);
    for (const h of HOLES) shape.holes.push(new THREE.Path().absarc(h.x, h.z, h.r, 0, Math.PI * 2, true));
    const g = mergeVertices(new THREE.ExtrudeGeometry(shape, { depth: GROUND_Y - PLATE_BOTTOM, bevelEnabled: false, curveSegments: 40 }).rotateX(Math.PI / 2).translate(0, GROUND_Y, 0), 1e-4);
    add(g, 'sea');
    // the underside of the sea is a night sky for the world below
    add(mergeVertices(new THREE.ExtrudeGeometry(shape, { depth: 0.02, bevelEnabled: false, curveSegments: 40 }).rotateX(Math.PI / 2).translate(0, PLATE_BOTTOM - 0.004, 0), 1e-4), 'abyss', false);
    for (const h of HOLES) {                                                      // a wooden collar round each well
      add(at(new THREE.TorusGeometry(h.r + 0.02, 0.07, 8, 40).rotateX(Math.PI / 2), V(h.x, GROUND_Y, h.z)), 'curb');
      add(at(new THREE.TorusGeometry(h.r + 0.02, 0.07, 8, 40).rotateX(Math.PI / 2), V(h.x, PLATE_BOTTOM, h.z)), 'curb');
    }
    for (const [r0, w] of [[3.4, 0.12], [5.6, 0.1], [7.6, 0.14], [9.0, 0.1]]) {     // painted swell rings, broken at the wells
      const cuts = [];
      for (const h of HOLES) {
        const dc = Math.hypot(h.x, h.z);
        if (Math.abs(r0 - dc) < h.r + 0.25) { const half = Math.acos(Math.min(1, (r0 * r0 + dc * dc - (h.r + 0.25) ** 2) / (2 * r0 * dc))); cuts.push([-Math.atan2(h.z, h.x) - half, 2 * half]); }
      }
      let a0 = 0;
      const segs = cuts.length ? cuts.map(([c0, len]) => ({ from: ((c0 + len) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI), len: 2 * Math.PI - len })) : [{ from: a0, len: 2 * Math.PI }];
      const sg = segs.length === 1 ? segs[0] : null;
      if (sg) add(at(new THREE.RingGeometry(r0, r0 + w, 96, 1, sg.from, sg.len).rotateX(-Math.PI / 2), V(0, GROUND_Y + 0.003, 0)), 'seaLight', false);
    }
  }

  /* ---- lighthouse + helix + balcony ----------------------------------------- */
  const HELIX_TOP = 3.6;
  prop('lighthouse', V(0, GROUND_Y, 0));

  track('helix', V(-1.95, GROUND_Y + 0.012, 0), V(0, 0, -1), Y, { w: 1.0, walls: 'left', lip: 0.2, support: false })
    .helix(-1170, 1.95, HELIX_TOP - (GROUND_Y + 0.012))
    .style({ walls: 'none' }).turn(-60, 1.95);

  const X = V(1, 0, 0), Z = V(0, 0, 1), HUB = V(0, HELIX_TOP, 0);
  add(sweepPoly(circleFrames(HUB, Y, X, Z, 3.125, 0, 360), plank(1.35, 0.12)), 'birch');
  const MUSH = V(2.9, 0, -5.5);
  const LIFT_A = 160, LIFT = V(4.6 * Math.cos(LIFT_A * DEG), GROUND_Y + 0.02, 4.6 * Math.sin(LIFT_A * DEG));                                              // the giant mushroom
  const mushDir = MUSH.clone().normalize(), mushA = Math.atan2(mushDir.z, mushDir.x) / DEG + 360;
  for (const [a0, a1] of [[98, LIFT_A - 13], [188, mushA - 8], [mushA + 8, 442]]) rail(circleFrames(HUB, Y, X, Z, 3.76, a0, a1), 0.14);
  for (const a of [30, 150, 270]) {
    const c = Math.cos(a * DEG), s = Math.sin(a * DEG);
    strut(V(c * 1.4, 2.2, s * 1.4), V(c * 3.4, 3.48, s * 3.4), 0.05, 'dowel');
  }
  lantern('燈塔露台', V(2.6, HELIX_TOP, 2.19), Y, V(2.37, HELIX_TOP, 1.99));

  /* ---- west: stairs -> balance beam -> mushroom grove -> corkscrew -> windmill isle ---- */
  const stairs = track('stairs', V(-3.8, HELIX_TOP, 0), V(-1, 0, 0), Y, { color: 'paintYellow', lip: 0.22, w: 0.8 })
    .straight(0.3).stairs(5, 0.5, 0.45);
  const toGrove = track('beam', stairs.p, stairs.t, stairs.u, { color: 'paintYellow' })
    .straight(0.5).turn(-90, 1.0)
    .style({ walls: 'none', w: 0.42, color: 'birch' }).straight(2.0);
  const grove = padAhead(toGrove, 1.3);
  padLantern('蘑菇林', grove, 90);
  for (const [a, rr, s] of [[-82, 0.98, 0.72], [70, 0.2, 0.01], [-128, 0.95, 0.45], [118, 0.98, 0.6], [-42, 1.0, 0.4], [55, 1.0, 0.36]]) {
    if (s < 0.1) continue;
    const p = padPoint(grove, a, rr);
    prop('mushroom', p, { scale: s, yaw: a });
  }

  const cork = fromPad(grove, 0, 'corkscrew').turn(-90, 1.2)
    .style({ color: 'paintRed', lip: 0.22, w: 0.74, support: false, gain: 1.5 }).twist(5.0, 360)
    .style({ color: 'track', lip: 0.2, w: 0.72, support: true, gain: 1 }).straight(0.3);
  const mill = padAhead(cork, 1.5);
  padLantern('風車島', mill, -55);
  {
    const b = padPoint(mill, 110, 0.85).add(V(0, 0.15, 0));
    add(at(new THREE.CylinderGeometry(0.62, 0.66, 0.15, 8), b.clone().add(V(0, -0.075, 0))), 'birch');
    prop('windmill', b);
    mover({ name: 'sails', pivot: b.clone().add(V(0, 1.35, 0.5)), axis: V(0, 0, 1), speed: 0.9 }, () => prop('sails', V(0, 0, 0)));
    prop('tree_pine', padPoint(mill, -140, 1.05), { scale: 0.9 });
  }

  /* ---- north-east: the giant mushroom, with a slide spiralling down its stalk ---- */
  prop('giant_mushroom', V(MUSH.x, GROUND_Y, MUSH.z));
  {
    const start = mushDir.clone().multiplyScalar(3.8).setY(HELIX_TOP);
    const len = Math.hypot(MUSH.x, MUSH.z) - 3.8 - 1.3;
    track('capBeam', start, mushDir, Y, { walls: 'none', w: 0.42, color: 'birch', support: false }).straight(len);
    lantern('大蘑菇頂', V(MUSH.x + 0.75, HELIX_TOP, MUSH.z - 0.65), Y, V(MUSH.x, HELIX_TOP, MUSH.z));
  }
  const slide = fromPad(mill, 0, 'slide', { color: 'paintYellow', lip: 0.34, w: 0.8 })
    .straight(MUSH.x - (mill.c.x + mill.r))
    .helix(-810, 1.3, -(mill.c.y - (GROUND_Y + 0.015)))
    .style({ walls: 'none' }).straight(0.7);
  void slide;

  /* ---- south: up the wall to the ceiling (the moon), across to the crystal isle, down the cascade ---- */
  const sky = track('sky', V(0, HELIX_TOP, 3.8), Z, Y, { color: 'paintBlue' })
    .straight(1.0).pitch(90, 2.2).straight(1.2).pitch(90, 2.2).straight(1.6);
  const moon = padAhead(sky, 1.6);
  padLantern('月亮', moon, -90);
  {
    const p = padPoint(moon, -150, 0.9).addScaledVector(moon.u, 0.86);
    prop('moon', p, { yaw: 0.6 });
  }
  const vault = fromPad(moon, 90, 'vault', { skin: 'crystal' }).straight(2.2).pitch(90, 2.6).straight(2.5);
  const crystalIsle = padAhead(vault, 1.4);
  padLantern('水晶島', crystalIsle, 90);
  for (const [a, rr, s] of [[-90, 0.85, 1.5], [-55, 0.95, 1.0], [-125, 0.9, 1.15], [70, 1.0, 0.8], [125, 0.95, 1.2]]) {
    const p = padPoint(crystalIsle, a, rr);
    prop('crystal', p, { up: crystalIsle.u, scale: s, yaw: a * 0.07 });
  }
  const cascade = fromPad(crystalIsle, 0, 'cascade', { color: 'paintBlue' }).straight(0.4).pitch(90, 2.0).turn(90, 1.2);
  const hairpin = (deg) => cascade.style({ lip: 0.34 }).turn(deg, 0.6).style({ lip: 0.2 });
  cascade.ramp(4.0, 25); hairpin(-180);
  cascade.ramp(3.0, 25); hairpin(180);
  cascade.ramp((cascade.p.y - (GROUND_Y + 0.015) - 0.2249) / Math.sin(25 * DEG), 25);
  const harbor = padAhead(cascade, 1.2, { island: false, rim: false });
  harbor.c.y = GROUND_Y + 0.02;
  padLantern('港口', harbor, 120);
  lanterns.unshift(lanterns.pop());                                          // the harbour is where you start

  // the pier: washboard and pins along the water from the harbour to the foot of the lift
  {
    const to = LIFT.clone().setY(harbor.c.y).sub(harbor.c), len = to.length() - harbor.r - 0.85;
    fromPad(harbor, padAngle(harbor, to.clone().normalize()), 'pier', { color: 'paintYellow', support: false })
      .straight(1.0).bumps(2.4, 3, 0.1).straight(0.6).pegs(1.8).straight(Math.max(0.2, len - 5.8));
  }
  // the ridge road: off the side of the crystal isle, a quarter twist to stand upright, and over to the giant mushroom's cap
  fromPad(crystalIsle, -90, 'ridge', { color: 'paintRed' }).straight(0.2).style({ gain: 1.4 }).twist(2.8, 90).style({ gain: 1 })
    .ramp(1.6, -25).turn(90, 0.8).straight(1.0).style({ walls: 'none' }).straight(0.5);

  /* ---- the Underside: roll over the lip of the Maelstrom and the sea becomes the ceiling ---------
     An upside-down night garden. In the middle, where the lighthouse stands above, hangs its
     reflection: a dark twin with a lit lamp, and a spiral you can climb. Around it a ring of
     crystal track links three terraces, a gear-driven turntable and the Geyser back up.      */
  const DOWN = V(0, -1, 0);
  const under = (x, z) => ({ p: V(x, UNDER_Y, z), up: DOWN });
  const rimA = V(HOLES[0].x, GROUND_Y + 0.012, HOLES[0].z).addScaledVector(NW, -HOLES[0].r);
  const mael = track('maelstrom', rimA.clone().addScaledVector(NW, -2.0), NW, Y, { color: 'paintBlue' })
    .straight(2.0).style({ skin: 'crystal', gain: 1.6 }).pitch(-180, 0.8).style({ gain: 1 }).straight(0.4);
  const deep = padAhead(mael, 1.4, { island: false, pillar: true });
  padLantern('海之下', deep, 100);

  // the reflection of the lighthouse, and the spiral up it
  prop('lighthouse', V(0, PLATE_BOTTOM, 0), { up: DOWN, scale: 0.42, mats: { paintCream: 'whale', paintRed: 'paintNavy', birch: 'woodDark', dowel: 'brass' } });
  const mirror = fromPad(deep, -7, 'mirror', { skin: 'crystal' }).spline([under(-0.9, -1.22), under(0, -1.1)])
    .style({ lip: 0.28 }).helix(540, 1.1, 2.5).turn(80, 1.1);
  lantern('倒影燈塔', mirror.p.clone().addScaledVector(mirror.t, 0.3), DOWN, mirror.p.clone().addScaledVector(mirror.t, -0.5));

  // the tide ring: deep terrace -> pins -> turntable -> jelly garden -> back round the far side
  const tide = fromPad(deep, 35, 'tide', { skin: 'crystal' }).spline([under(-2.1, 0.0), under(-1.2, 2.0), under(0.3, 2.86)]).pegs(1.2);
  const TT_R = 1.3, TT_SPEED = 0.35, TT = tide.p.clone().addScaledVector(tide.t, TT_R + 0.06);
  // special part: a turntable driven by wooden gears — wait for a gap to line up, roll on, ride, roll off
  mover({ name: 'turntable', pivot: TT, axis: DOWN, speed: TT_SPEED }, () => {
    const flip = (g) => g.rotateX(Math.PI);                                  // built upright, hung upside-down
    add(flip(at(new THREE.CylinderGeometry(TT_R, TT_R, 0.12, 56), V(0, -0.06, 0))), 'paintBlue');
    add(flip(at(new THREE.CylinderGeometry(TT_R * 0.8, TT_R * 0.8, 0.012, 48), V(0, 0.006, 0))), 'paintCream', false);
    add(flip(at(new THREE.CylinderGeometry(TT_R * 0.45, TT_R * 0.45, 0.02, 40), V(0, 0.01, 0))), 'paintRed', false);
    for (const a of [22, 112, 202, 292]) add(flip(sweepPoly(circleFrames(V(0, 0, 0), Y, X, Z, TT_R - 0.045, a, a + 46), lipProf(-0.035, 0.035, 0.26))), 'curb');
    prop('gear_big', V(0, 0.42, 0), { up: DOWN });
    add(at(new THREE.CylinderGeometry(0.12, 0.12, 1.2, 12), V(0, 0.68, 0)), 'dowel');
  });
  mover({ name: 'pinion', pivot: TT.clone().add(V(1.82, 0.42, 0)), axis: DOWN, speed: -TT_SPEED * 18 / 7, phase: Math.PI / 7 }, () => prop('gear_small', V(0, 0, 0), { up: DOWN }));
  strut(TT.clone().add(V(1.82, 0.5, 0)), TT.clone().add(V(1.82, 0, 0)).setY(PLATE_BOTTOM), 0.06);
  neutral.push({ pos: TT.clone(), nu: DOWN.clone(), r: TT_R + 0.25, gain: 1 });

  // the Geyser: off the turntable and over the lip of the second well, back onto the sea
  {
    const hb = V(HOLES[1].x, UNDER_Y, HOLES[1].z), g = hb.clone().sub(TT).normalize(), rimB = hb.clone().addScaledVector(g, -HOLES[1].r);
    track('geyser', TT.clone().addScaledVector(g, TT_R + 0.06), g, DOWN, { skin: 'crystal' })
      .straight(rimB.distanceTo(TT) - TT_R - 0.06).style({ gain: 1.6 }).pitch(-180, 0.8)
      .style({ skin: 'wood', color: 'paintBlue', gain: 1 }).straight(1.4).style({ walls: 'none' }).straight(0.5);
  }
  // the jelly garden, and the reef road home
  const gardenAt = V(6.2, UNDER_Y, 0.6), toGarden = gardenAt.clone().sub(TT).normalize();
  const grotto = track('grotto', TT.clone().addScaledVector(toGarden, TT_R + 0.06), toGarden, DOWN, { skin: 'crystal' })
    .straight(0.3).bumps(1.0, 2, 0.08).straight(gardenAt.distanceTo(TT) - TT_R - 0.06 - 1.3 - 1.2);
  const garden = padAhead(grotto, 1.2, { island: false, pillar: true });
  padLantern('水母園', garden, 90);
  {
    const end = deep.c.clone().add(V(1.0, 0, -0.98).setLength(deep.r));
    deep.exits.push(padAngle(deep, end.clone().sub(deep.c)));
    fromPad(garden, padAngle(garden, V(-0.6, 0, -0.8)), 'reef', { skin: 'crystal' })
      .spline([under(4.4, -2.2), under(2.4, -3.7), under(0.2, -4.2), { p: end, up: DOWN }]);
  }

  // dressing — composed, not scattered. Everything hangs from the underside of the sea (y = PLATE_BOTTOM, up = DOWN).
  {
    const underTracks = [mael, mirror, tide, grotto].concat(k.tracks.filter((t) => ['geyser', 'reef'].includes(t.name)));
    const clear = (x, z, rad) => !HOLES.some((h) => Math.hypot(x - h.x, z - h.z) < h.r + rad)
      && Math.hypot(x - TT.x, z - TT.z) > 2.4 + rad && Math.hypot(x, z) > 1.7 + rad
      && ![deep, garden].some((pd) => Math.hypot(x - pd.c.x, z - pd.c.z) < pd.r + rad)
      && !underTracks.some((t) => t.frames.some((f) => f.pos.y < PLATE_BOTTOM && Math.hypot(x - f.pos.x, z - f.pos.z) < 0.5 + rad))
      && Math.hypot(x, z) < 8.9;
    const hangProp = (name, x, z, scale, o = {}) => { if (clear(x, z, o.rad ?? 0.35 * scale)) prop(name, V(x, PLATE_BOTTOM, z), { up: DOWN, scale, ...o }); };
    const swap = { jelly: 'jellyB', jellyB: 'jelly' };

    // a procession of lantern jellyfish drifting round the north side, and three by the south bend
    for (let i = 0; i < 9; i++) {
      const a = (232 + i * 11.5) * DEG, rr = 6.1 + 0.55 * Math.sin(i * 1.9);
      hangProp('jelly', Math.cos(a) * rr, Math.sin(a) * rr, 0.95 + 0.5 * ((i * 7) % 4) / 3, { yaw: i, mats: i % 3 === 1 ? swap : null, rad: 0.4 });
    }
    for (const [x, z, s] of [[-3.9, 1.5, 1.3], [-3.2, 3.6, 0.95], [-1.5, 4.9, 1.15], [1.0, 5.6, 0.9]]) hangProp('jelly', x, z, s, { yaw: x, mats: s > 1.1 ? swap : null, rad: 0.4 });
    // a coral grove around the jelly garden, with the giant clam and its pearl as the centrepiece
    prop('clam', padPoint(garden, 55, 2.35).setY(PLATE_BOTTOM), { up: DOWN, scale: 1.25, yaw: 2.2 });
    for (const [a, rr, s] of [[18, 2.0, 1.5], [95, 2.2, 1.9], [128, 1.95, 1.3], [160, 2.3, 1.6], [-28, 2.15, 1.2], [-135, 2.1, 1.7]]) {
      const p = padPoint(garden, a, rr);
      hangProp('coral', p.x, p.z, s, { yaw: a, rad: 0.25 });
    }
    // crystals line the outside of the ring road, growing and shrinking in a slow swell
    for (const t of underTracks) {
      if (t === mirror) continue;
      t.frames.forEach((f, i) => {
        if (i % 7 !== 3 || f.pos.y > PLATE_BOTTOM - 0.5) return;
        const out = f.right.clone().multiplyScalar(f.right.dot(f.pos) > 0 ? 1 : -1), q = f.pos.clone().addScaledVector(out, 0.95);
        hangProp('crystal', q.x, q.z, 0.8 + 0.55 * (0.5 + 0.5 * Math.sin(i * 0.37)), { yaw: i, rad: 0.2 });
      });
    }
    // a collar of crystals under each well, glow-caps where you arrive
    for (const h of HOLES) for (let i = 0; i < 7; i++) { const a = i * 0.9 + h.x; hangProp('crystal', h.x + Math.cos(a) * (h.r + 0.75), h.z + Math.sin(a) * (h.r + 0.75), 0.9 + 0.5 * (i % 3), { yaw: a, rad: -0.3 }); }
    for (const [a, rr, s] of [[140, 1.95, 0.55], [165, 2.1, 0.4], [-150, 2.0, 0.6], [-120, 2.2, 0.38], [70, 2.0, 0.5]]) { const p = padPoint(deep, a, rr); hangProp('mushroom', p.x, p.z, s, { yaw: a, rad: 0.15 }); }
    // a crown of stalactites round the edge
    // a crown of crystal icicles round the edge — this is the part you see from outside the globe
    for (let a = 0; a < 360; a += 12) {
      const len = 0.7 + 0.9 * Math.abs(Math.sin(a * DEG * 2.5)), x = Math.cos(a * DEG) * 8.7, z = Math.sin(a * DEG) * 8.7;
      add(at(new THREE.ConeGeometry(0.16 + len * 0.07, len, 6), V(x, PLATE_BOTTOM - len / 2, z), DOWN), 'crystal');
    }
    // below the sea it is night: the lamp light fades out and the garden glows by itself
    k.setMood((p) => Math.max(0, Math.min(1, (PLATE_BOTTOM + 0.2 - p.y) / 0.9)));
    light(V(0, -9.6, 0), 0x7fe6dc, 16, 15, 2.2);
    light(garden.c.clone().add(V(0.8, -2.2, 0.8)), 0xff9ec4, 7, 8, 2.2);
    light(deep.c.clone().add(V(-1.2, -2.0, -1.2)), 0x8fd8ff, 5, 7, 2.2);
  }

  /* ---- special part: the lift — a little platform that rides between the sea and the balcony on its own ---- */
  {
    const travel = HELIX_TOP - LIFT.y, inward = LIFT.clone().setY(0).normalize().negate(), side = V(-inward.z, 0, inward.x);
    mover({ name: 'lift', kind: 'lift', pivot: LIFT, axis: Y, travel, rise: 3.2, dwell: 2.6, speed: 0 }, () => {
      add(at(new THREE.CylinderGeometry(0.75, 0.75, 0.1, 40), V(0, -0.05, 0)), 'paintRed');
      add(at(new THREE.CylinderGeometry(0.5, 0.5, 0.012, 32), V(0, 0.006, 0)), 'paintCream', false);
      const e1 = inward.clone(), e2 = new THREE.Vector3().crossVectors(Y, e1);
      for (const a of [30, 210]) rail(circleFrames(V(0, 0, 0), Y, e1, e2, 0.71, a, a + 120), 0.2);
      for (const sg of [-1, 1]) add(at(new THREE.BoxGeometry(0.2, 0.16, 0.2), side.clone().multiplyScalar(sg * 0.86).add(V(0, -0.02, 0))), 'woodDark');
    });
    for (const sg of [-1, 1]) strut(LIFT.clone().addScaledVector(side, sg * 0.86).setY(GROUND_Y), LIFT.clone().addScaledVector(side, sg * 0.86).setY(HELIX_TOP + 1.3), 0.055);
    strut(LIFT.clone().addScaledVector(side, -0.95).setY(HELIX_TOP + 1.3), LIFT.clone().addScaledVector(side, 0.95).setY(HELIX_TOP + 1.3), 0.05);
    mover({ name: 'pulley', pivot: LIFT.clone().setY(HELIX_TOP + 1.3), axis: side, speed: 1.4 }, () => {
      prop('gear_small', V(0, 0, 0), { up: side, scale: 0.7 });
    });
    for (let y = LIFT.y; y <= HELIX_TOP + 0.3; y += 0.5) neutral.push({ pos: V(LIFT.x, y, LIFT.z), nu: Y.clone(), r: 0.95, gain: 1 });
  }

  /* ---- harbour, sea dressing --------------------------------------------------------- */
  const house = (x, z, yaw, body, roof, s = 1) => {
    const p = V(x, GROUND_Y, z);
    prop('house', p, { yaw, scale: s, mats: { body, roof } });
  };
  const tree = (x, z, s, kind) => {
    const p = V(x, GROUND_Y, z);
    prop(['tree_pine', 'tree_round', 'tree_ply'][kind], p, { scale: s, yaw: x * 7 + z });
  };
  const hx = harbor.c.x, hz = harbor.c.z;
  add(at(new THREE.CircleGeometry(3.4, 48).rotateX(-Math.PI / 2), V(hx - 0.4, GROUND_Y + 0.006, hz - 0.5), Y, 0, V(1.2, 1, 0.5)), 'lawn', false);
  house(hx - 2.5, hz - 0.1, 0.5, 'paintCream', 'paintRed');
  house(hx + 2.3, hz - 0.3, -0.45, 'paintYellow', 'paintBlue', 0.9);
  tree(hx - 3.6, hz - 1.2, 1.0, 0); tree(hx + 3.3, hz - 1.4, 0.9, 2); tree(hx - 1.5, hz + 0.9, 0.8, 1);
  {
    const p = V(-5.2, GROUND_Y, 6.4);
    prop('boat', p, { yaw: 0.7, scale: 1.2 });
  }
  // painted lanes on the sea: harbour -> lighthouse door, slide exit -> harbour
  const lane = (pts, w = 0.6) => {
    const c = new THREE.CatmullRomCurve3(pts.map(([x, z]) => V(x, GROUND_Y + 0.004, z)), false, 'centripetal');
    const n = Math.ceil(c.getLength() / DS), fr = [];
    for (let i = 0; i <= n; i++) {
      const pos = c.getPoint(i / n), tan = c.getTangent(i / n).normalize();
      fr.push({ pos, tan, up: Y.clone(), right: new THREE.Vector3().crossVectors(tan, Y).normalize() });
    }
    add(sweepPoly(fr, [[-w / 2, 0.002], [w / 2, 0.002], [w / 2, 0], [-w / 2, 0]]), 'seaLight', false);
  };
  lane([[hx - 0.6, hz - 2.2], [-2.3, 5.0], [-2.9, 3.0], [-2.2, 1.1], [-1.95, 0.15]]);
  // wave boards around the rim
  {
    const rng = mulberry32(11);
    for (let a = 0; a < 360; a += 15) {
      for (const [rr, sc] of [[9.75, 1.0], [8.95, 0.72]]) {
        const aa = (a + (rr < 9.5 ? 7.5 : 0) + rng() * 4) * DEG, x = Math.cos(aa) * rr, z = Math.sin(aa) * rr;
        if (Math.hypot(x - hx, z - hz) < 4.4 || (rr < 9.5 && rng() < 0.45) || HOLES.some((h) => Math.hypot(x - h.x, z - h.z) < h.r + 1.4)) continue;
        prop('wave', V(x, GROUND_Y, z), { yaw: -aa + Math.PI / 2, scale: sc });
      }
    }
  }

  /* ---- the sky: a wooden whale on a mobile arm, paper clouds, brass stars ---------------- */
  const hang = (p) => strut(p, V(p.x, glassAbove(p.x, p.z) - 0.06, p.z), 0.016, 'brass');
  {
    const piv = V(-4.0, 6.6, -3.5);
    hang(piv);
    mover({ name: 'whale', pivot: piv, axis: Y, speed: 0.2 }, () => {
      strut(V(0, 0, -1.1), V(0, 0, 1.7), 0.03, 'brass');
      add(at(new THREE.SphereGeometry(0.16, 12, 8), V(0, 0, -1.1)), 'brass');
      strut(V(0, 0, 1.7), V(0, -0.6, 1.7), 0.016, 'brass');
      prop('whale', V(0, -1.05, 1.7), { scale: 0.8 });
    });
  }
  for (const [x, y, z] of [[6.0, 6.6, -4.2], [-5.2, 7.6, 4.6], [5.6, 5.2, 6.2], [-7.6, 5.6, 1.6]]) {
    const yaw = (x * 3 + z) % 3.1;
    prop('cloud', V(x, y, z), { yaw, scale: 1.25 });
    hang(V(x, y + 0.6, z));
  }
  for (const [x, y, z] of [[4.2, 9.2, -3.4], [-3.5, 9.7, 3.2], [3.6, 9.4, 5.0], [-2.4, 10.2, -2.2], [-6.6, 7.9, 2.9], [-1.5, 8.6, 6.4]]) {
    add(at(new THREE.SphereGeometry(0.2, 4, 2), V(x, y, z)), 'brass');
    hang(V(x, y + 0.15, z));
  }

  return k.finish();
}

export default { id: 'lighthouse', name: '燈塔之海', blurb: '燈塔、浮島、倒掛的月亮，還有海面之下。', build };
