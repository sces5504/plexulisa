import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import observatoryMesh from './orrery-observatory.json' with { type: 'json' };
import { V, Y, createBuilder, circleFrames, at } from '../kit.js';

const A = 9.05;        // distance of the six terraces from the centre
const PR = 1.20;       // terrace radius

function build() {
  const k = createBuilder();
  const { add, prop, strut, mover, track, padAt, padAngle, arrive, padPoint, fromPad, lantern, light, neutral } = k;
  const X = V(1, 0, 0), Z = V(0, 0, 1);

  function checkpoint(name, pos, pad, color = 0xffbd76) {
    lantern(name, pos, pad.u, pad.c);
    k.lanterns.at(-1).illumination = { color, intensity: 9, distance: 3.2 };
  }

  /* ---- six terraces ----------------------------------------------------------- */
  const POLES = {
    B: { d: V(0, -1, 0), e: X, name: '星曆台' }, T: { d: V(0, 1, 0), e: X, name: '倒懸月台' },
    W: { d: V(-1, 0, 0), e: Z, name: '觀星台' }, E: { d: V(1, 0, 0), e: Z, name: '稜鏡台' },
    S: { d: V(0, 0, 1), e: X, name: '星圖台' }, N: { d: V(0, 0, -1), e: X, name: '日晷台' },
  };
  const P = {};
  for (const [key, o] of Object.entries(POLES)) P[key] = padAt(o.d.clone().multiplyScalar(A), o.d.clone().negate(), o.e, PR, { island: false });

  // This return uses the interior of the rear-left quadrant, leaving the shell behind.
  const westReturn = fromPad(P.N, 180, 'west-return',
    { color: 'paintCream', support: false, w: 0.94 }).pegs(0.75);
  westReturn.spline([
    { p: V(-2.63, 0.51, -8.63), up: V(0, -0.22, 0.98) },
    { p: V(-4.03, 2.09, -6.69), up: V(0.37, -0.58, 0.72) },
    { p: V(-5.05, 3.14, -4.13), up: V(0.72, -0.52, 0.48) },
    { p: V(-6.55, 2.10, -2.72), up: V(0.94, -0.30, 0.12) },
    { p: V(-8.11, 0.63, -2.13), up: V(0.98, -0.13, 0.08) },
    { p: V(-A, 0, -1.82), up: P.W.u },
    { p: V(-A, 0, -PR), up: P.W.u },
  ]);
  arrive(westReturn, P.W);

  /* ---- the core: spiral up to a turntable ------------------------------------------ */
  // Leave the bottom terrace on a diagonal, climb at once (to clear the four runs that leave it
  // on the level), then wind round the centre line up to the middle of the globe.
  const diag = V(1, 0, 1).normalize();
  const spiral = fromPad(P.B, padAngle(P.B, diag), 'spiral', { color: 'paintCream', lip: 0.26, support: false }).ramp(0.9, -25).turn(90, 0.6);
  const flat = (v) => v.clone().setY(0);
  spiral.t.copy(new THREE.Vector3().crossVectors(Y, flat(spiral.p).normalize()));        // exactly tangent to a circle round the axis
  // wind up two turns and a bit, stopping at azimuth -55° so that everything leaving the turntable
  // does so on the diagonals, clear of the spiral's last turn
  const az0 = Math.atan2(spiral.p.z, spiral.p.x) * 180 / Math.PI;
  spiral.helix(720 + (((az0 + 55) % 360) + 360) % 360, flat(spiral.p).length(), -spiral.p.y);
  const TT_R = 1.3, TT_SPEED = 0.35, TT = V(0, 0, 0);
  {
    // ease off the circle and spiral in, arriving on a diagonal so the bridge and the ring
    // leave between the great circles rather than along them
    const end = flat(spiral.p), R0 = end.length(), total = 80;
    const swing = (f, r) => end.clone().applyAxisAngle(Y, f * total * Math.PI / 180).setLength(r);
    spiral.spline([{ p: swing(0.17, R0 - 0.12) }, { p: swing(0.4, R0 - 0.7) }, { p: swing(0.68, 2.3) }, { p: swing(1, TT_R + 0.06) }]);
  }
  mover({ name: 'turntable', pivot: TT, axis: Y, speed: TT_SPEED }, () => {
    add(at(new THREE.CylinderGeometry(TT_R, TT_R, 0.12, 56), V(0, -0.06, 0)), 'brass');
    add(at(new THREE.CylinderGeometry(TT_R * 0.8, TT_R * 0.8, 0.012, 48), V(0, 0.006, 0)), 'paintNavy', false);
    add(at(new THREE.CylinderGeometry(TT_R * 0.45, TT_R * 0.45, 0.02, 40), V(0, 0.01, 0)), 'paintCream', false);
    for (const a of [22, 202]) {
      k.rail(circleFrames(V(0, 0, 0), Y, X, Z, TT_R - 0.045, a, a + 136), 0.26);
    }
    prop('gear_big', V(0, -0.42, 0), { mats: { birch: 'brass' } });
  });
  mover({ name: 'pinion', pivot: TT.clone().add(V(1.82, -0.42, 0)), axis: Y, speed: -TT_SPEED * 18 / 7, phase: Math.PI / 7 }, () => prop('gear_small', V(0, 0, 0), { mats: { woodDark: 'brass' } }));
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
  neutral.push({ pos: TT.clone(), nu: Y.clone(), r: TT_R + 0.25, gain: 1 });

  // The crown route crosses the upper volume on a diagonal before it turns to the ceiling.
  const g = spiral.p.clone().setY(0).normalize().negate();
  const bridge = track('crown', TT.clone().addScaledVector(g, TT_R + 0.06), g, Y,
    { color: 'paintCream', lip: 0.26, support: false }).straight(0.55);
  bridge.spline([
    { p: V(2.08, 0.1, 2.07), up: Y },
    { p: V(3.15, 0.89, 2.76), up: V(-0.59, 0.78, 0.10) },
    { p: V(4.05, 2.83, 2.2), up: V(-0.98, 0.11, 0.12) },
    { p: V(3.92, 4.66, 0.67), up: V(-0.90, -0.40, 0.12) },
    { p: V(2.25, 5.70, -0.90), up: V(-0.42, -0.9, 0.12) },
    { p: V(0.52, 6.10, -2.34), up: V(0.05, -0.91, 0.37) },
    { p: V(-1.51, 7.85, -2.91), up: V(0.38, -0.72, 0.59) },
    { p: V(-1.52, A, -1.80), up: P.T.u },
    { p: P.T.c.clone().add(V(-0.65, 0, -0.76).setLength(PR)), up: P.T.u },
  ]);
  arrive(bridge, P.T);
  strut(V(0, 1.25, 0), V(0, 3.55, 0), 0.10, 'woodDark');
  instrument(V(0, 3.55, 0), Y, 'armillary');

  // The two observatory spurs break the symmetry and put playable destinations at different heights.
  const westArc = fromPad(P.W, -45, 'observatory-approach',
    { color: 'paintCream', support: false, w: 0.87 }).straight(1.33).pitch(90, 1.45).straight(0.45);
  const observatory = k.padAhead(westArc, 1.04, { island: false });
  const eastArc = fromPad(P.E, -45, 'star-gallery-approach',
    { color: 'paintRed', support: false, w: 0.83 }).straight(0.65).pitch(90, 1.32).straight(0.45);
  const gallery = k.padAhead(eastArc, 1.02, { island: false });
  // The observatory also leads diagonally to the moon terrace, offset from the outer hoops.
  const moonGate = P.T.c.clone().add(V(-0.8, 0, 0.6).setLength(PR));
  const skyWalk = fromPad(observatory, -67, 'observatory-skywalk',
    { color: 'paintCream', support: false, w: 0.87 }).straight(0.25);
  skyWalk.spline([
    { p: V(-5.35, 4.72, 2.34), up: V(0, -0.82, -0.57) },
    { p: V(-4.25, 6.55, 2.13), up: V(0.1, -0.91, -0.38) },
    { p: V(-2.65, 8.75, 1.87), up: V(0.15, -0.97, -0.18) },
    { p: V(-1.67, A, 1.29), up: P.T.u },
    { p: moonGate, up: P.T.u },
  ]);
  arrive(skyWalk, P.T);

  // Continue through the lower rear quadrant instead of opening a second exit at the same dock.
  const rearRun = fromPad(P.N, -45, 'rear-prism-loop',
    { color: 'paintNavy', support: false, w: 0.86, lip: 0.25 }).bumps(1.10, 2, 0.09);
  rearRun.spline([
    { p: V(2.20, -2.50, -8.30), up: V(-0.23, 0.28, 0.93) },
    { p: V(4.00, -3.65, -6.15), up: V(-0.49, 0.45, 0.75) },
    { p: V(6.15, -3.10, -3.73), up: V(-0.79, 0.40, 0.48) },
    { p: V(8.45, -1.55, -1.64), up: V(-0.96, 0.18, 0.19) },
    { p: V(A, -1.28, -1.28), up: P.E.u },
    { p: P.E.c.clone().add(V(0, -1, -1).setLength(PR)), up: P.E.u },
  ]);
  arrive(rearRun, P.E);

  // A short flight of steps lands at the bottom station and completes the circuit.
  const lowerDirection = V(-1, 0, 1).normalize();
  const stepStart = P.B.c.clone().addScaledVector(lowerDirection, PR + 1.35).addScaledVector(Y, 0.48);
  const descent = fromPad(P.S, 135, 'lower-crossover',
    { color: 'paintRed', support: false, w: 0.88, lip: 0.25 }).straight(0.22).twist(1.28, 90);
  descent.spline([
    { p: V(-2.74, -2.65, 8.08), up: V(0.31, 0.29, -0.90) },
    { p: V(-4.05, -4.36, 6.14), up: V(0.47, 0.51, -0.72) },
    { p: V(-3.81, -6.45, 4.90), up: V(0.43, 0.72, -0.54) },
    { p: V(-2.72, -7.86, 3.44), up: Y },
    { p: stepStart.clone().addScaledVector(lowerDirection, 0.52), up: Y },
    { p: stepStart, up: Y },
  ]);
  descent.stairs(3, 0.45, 0.24);
  arrive(descent, P.B);

  // An inclined run carries the marble from the gallery to the lower lift dock.
  // Keep the ramp's neutral level so the marble can run through it hands-off.
  const liftBottom = V(4.5, -4.95, 5.0);
  const liftTop = 3.6;
  const liftRadius = 0.88;
  const axis = V(-0.8, 0, 0.6);
  const across = V(-axis.z, 0, axis.x);
  const dockGap = liftRadius + 0.055;
  const slope = 32 * Math.PI / 180;
  const slideLength = 1.65;
  const rampRun = slideLength * Math.cos(slope) + 2.4 * Math.sin(slope);
  const rampDrop = slideLength * Math.sin(slope) + 2.4 * (1 - Math.cos(slope));
  const rampStart = liftBottom.clone().addScaledVector(axis, -(dockGap + rampRun + 0.28)).addScaledVector(Y, rampDrop);

  const slideEntry = fromPad(gallery, 85, 'gallery-slide-entry',
    { color: 'paintCream', support: false, w: 0.9 }).straight(0.18);
  slideEntry.spline([
    { p: slideEntry.p.clone().addScaledVector(slideEntry.t, 0.42), up: gallery.u },
    { p: V(6.87, -1.40, 3.97), up: V(0, 0.92, -0.39) },
    { p: V(7.95, -2.13, 3.71), up: Y },
    { p: V(8.60, -2.88, 2.84), up: Y },
    { p: V(8.38, -3.51, 2.32), up: Y },
    { p: rampStart.clone().addScaledVector(axis, -0.36), up: Y },
    { p: rampStart, up: Y },
  ]);
  const slide = track('gallery-gravity-slide', rampStart, axis, Y,
    { color: 'paintRed', support: false, w: 0.9, lip: 0.28 });
  slide.ramp(slideLength, 32).straight(0.28);

  // The rail arrests the slide at the far edge. The upper exit is a quarter turn away.
  mover({ name: 'meridian-lift', kind: 'lift', pivot: liftBottom, axis: Y,
    travel: liftTop - liftBottom.y, rise: 4.2, dwell: 5.0, speed: 0 }, () => {
    // A shallow dish keeps a coasting marble aboard once the deck starts moving.
    const bowl = Array.from({ length: 8 }, (_, i) => {
      const fraction = i / 7;
      return new THREE.Vector2(fraction * liftRadius, -0.14 * (1 - fraction ** 2));
    });
    const profile = [new THREE.Vector2(0, -0.25), new THREE.Vector2(liftRadius, -0.25),
      ...bowl.slice().reverse()];
    add(new THREE.LatheGeometry(profile, 48), 'paintNavy');
    const inlay = bowl.slice(0, 7).reverse().map(({ x, y }) => new THREE.Vector2(x, y + 0.005));
    add(new THREE.LatheGeometry(inlay, 48), 'paintCream', false);
    const lateral = new THREE.Vector3().crossVectors(Y, axis);
    for (const [start, end] of [[207, 243], [297, 513]]) {
      k.rail(circleFrames(V(0, 0, 0), Y, axis, lateral, liftRadius - 0.04, start, end), 0.28);
    }
  });
  for (const sign of [-1, 1]) {
    const post = liftBottom.clone().addScaledVector(across, sign * 1.00);
    strut(post.clone().addScaledVector(Y, -0.32), post.clone().setY(sign === 1 ? liftTop - 0.48 : liftTop + 0.83), 0.075, 'brass');
    for (const level of sign === 1 ? [liftBottom.y - 0.18] : [liftBottom.y - 0.18, liftTop - 0.18]) {
      add(at(new THREE.CylinderGeometry(0.115, 0.15, 0.25, 16), post.clone().setY(level)), 'paintNavy');
    }
  }
  const pulley = liftBottom.clone().setY(liftTop + 0.80);
  strut(pulley.clone().addScaledVector(across, -1.0), pulley.clone().addScaledVector(across, 1.0), 0.066, 'woodDark');
  mover({ name: 'meridian-pulley', pivot: pulley, axis: across, speed: 0.74 }, () => {
    prop('gear_small', V(0, 0, 0), { up: across, scale: 0.71, mats: { woodDark: 'brass' } });
  });
  for (let y = liftBottom.y; y <= liftTop + 0.25; y += 0.35) {
    neutral.push({ pos: liftBottom.clone().setY(y), nu: Y.clone(), r: 1.03, gain: 1 });
  }

  const exit = liftBottom.clone().setY(liftTop).addScaledVector(across, dockGap);
  const frontGate = k.padDir(P.S, 45);
  const liftExit = track('lift-to-star-chart', exit, across, Y, { color: 'paintCream', support: false, lip: 0.25 });
  liftExit.straight(0.68).turn(97, 1.05);
  liftExit.spline([
    { p: liftExit.p.clone().addScaledVector(liftExit.t, 0.48), up: Y },
    { p: V(1.68, 3.04, 5.48), up: V(0, 0.89, -0.46) },
    { p: V(2.55, 1.21, 7.77), up: V(0.02, 0.6, -0.80) },
    { p: V(1.67, -1.72, 8.41), up: V(0, 0.18, -0.98) },
    { p: P.S.c.clone().addScaledVector(frontGate, PR), up: P.S.u },
  ]);
  arrive(liftExit, P.S);

  const decks = [[observatory, 1.04], [gallery, 1.02]];
  for (const [deck, radius] of decks) {
    const plinth = deck.c.clone().addScaledVector(deck.u, -0.25);
    add(at(new THREE.CylinderGeometry(radius, radius * 0.88, 0.35, 32), plinth, deck.u), 'paintNavy');
    const lip = new THREE.TorusGeometry(radius * 0.95, 0.043, 8, 40).rotateX(-Math.PI / 2);
    add(at(lip, plinth.clone().addScaledVector(deck.u, -0.10), deck.u), 'brass');
    for (const a of [-115, -45, 45, 115]) {
      const edge = k.padDir(deck, a);
      const arch = new THREE.Shape();
      arch.moveTo(-0.25, 0).lineTo(-0.25, 0.59).lineTo(0.25, 0.59).lineTo(0.25, 0)
        .lineTo(0.14, 0).lineTo(0.14, 0.25);
      arch.absarc(0, 0.25, 0.14, 0, Math.PI, false);
      arch.lineTo(-0.14, 0).closePath();
      const stone = mergeVertices(new THREE.ExtrudeGeometry(arch, {
        depth: 0.12, bevelEnabled: true, bevelSize: 0.018, bevelThickness: 0.018, bevelSegments: 1,
      }));
      const out = deck.c.clone().addScaledVector(edge, radius * 0.73).addScaledVector(deck.u, -0.77);
      const rotation = new THREE.Matrix4().makeBasis(deck.u.clone().cross(edge), deck.u, edge);
      add(stone.applyMatrix4(rotation).translate(out.x, out.y, out.z), 'paintCream');
    }
  }

  function instrument(p, up, style) {
    const size = style === 'globe' ? 0.46 : 0.57;
    const middle = p.clone().addScaledVector(up, size + 0.25);
    const q = new THREE.Quaternion().setFromUnitVectors(Y, up);
    const post = middle.clone().addScaledVector(up, -size * 0.7);
    add(at(new THREE.CylinderGeometry(0.23, 0.34, 0.15, 24), p.clone().addScaledVector(up, 0.075), up), 'paintNavy');
    strut(p, post, 0.065, 'brass');
    const axes = [Y, V(0.55, 0.13, 1).normalize(), V(1, -0.5, 0.25).normalize()];
    axes.forEach((axis, i) => {
      const direction = axis.clone().applyQuaternion(q);
      const ring = new THREE.TorusGeometry(size + 0.046 * i, 0.026, 8, 40).rotateX(-Math.PI / 2);
      add(at(ring, middle, direction), 'brass');
    });
    add(at(new THREE.SphereGeometry(size * 0.47, 20, 12), middle), style === 'globe' ? 'paintNavy' : 'lamp');
  }

  function stationApron(pd, angle) {
    const direction = k.padDir(pd, angle);
    const center = pd.c.clone().addScaledVector(direction, pd.r + 0.69);
    const foot = center.clone().addScaledVector(pd.u, -0.14);
    const scale = 0.91;
    const profile = [[0.01, -0.48], [0.45, -0.48], [0.61, -0.37], [0.72, -0.34], [0.78, -0.21],
      [0.94, -0.18], [0.98, -0.11], [0.98, -0.02], [0.93, 0], [0.01, 0]];
    const plinth = new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r * scale, y)), 32);
    add(at(plinth, center, pd.u), 'paintCream');
    add(at(new THREE.TorusGeometry(0.9 * scale, 0.038, 8, 40).rotateX(-Math.PI / 2),
      foot, pd.u), 'brass');
    const collar = new THREE.CylinderGeometry(0.81 * scale, 0.54 * scale, 0.19, 12);
    add(at(collar, center.clone().addScaledVector(pd.u, -0.29), pd.u), 'paintNavy');
    const rim = center.clone().addScaledVector(pd.u, -0.36);

    // Small vaulted piers remain readable from the back of the glass.
    const across = pd.u.clone().cross(direction);
    for (const side of [-1, 1]) {
      const archStart = center.clone().addScaledVector(across, side * 0.66 * scale).addScaledVector(pd.u, -0.16);
      const archEnd = rim.clone().addScaledVector(across, side * 0.25 * scale).addScaledVector(pd.u, -0.48);
      strut(archStart, archEnd, 0.082, 'paintCream');
      add(at(new THREE.SphereGeometry(0.12, 12, 8), archStart), 'brass');
    }

    return center;
  }

  const stations = [
    ['B', 135, 45, 'globe'],
    ['W', -135, 45, 'globe'],
    ['E', 135, 45, 'prism'],
    ['S', -45, -135, 'armillary'],
    ['N', -135, 135, 'sundial'],
    ['T', 45, 45, 'moon'],
  ];
  for (const [key, angle, lampAngle, ornament] of stations) {
    const pd = P[key];
    // Keep the checkpoint on the walkable terrace and the instrument out of its exits.
    checkpoint(POLES[key].name, padPoint(pd, lampAngle, 0.76), pd, key === 'E' || key === 'T' ? 0xaabaff : 0xffbd76);
    if (ornament === 'moon') continue;
    const p = stationApron(pd, angle);
    switch (ornament) {
      case 'prism':
        prop('crystal', p, { up: pd.u, yaw: 0.42, scale: 0.94 });
        prop('crystal', p.clone().addScaledVector(pd.e1, 0.4), { up: pd.u, scale: 0.45 });
        break;
      case 'sundial': {
        const dial = p.clone().addScaledVector(pd.u, 0.18);
        add(at(new THREE.CylinderGeometry(0.55, 0.46, 0.32, 32), dial, pd.u), 'paintNavy');
        add(at(new THREE.TorusGeometry(0.51, 0.026, 8, 32).rotateX(-Math.PI / 2),
          p.clone().addScaledVector(pd.u, 0.35), pd.u), 'brass');
        const hand = new THREE.Shape().moveTo(-0.24, 0).lineTo(0.28, 0).lineTo(0.12, 0.41).closePath();
        const gnomon = mergeVertices(new THREE.ExtrudeGeometry(hand, { depth: 0.04, bevelEnabled: false }));
        add(at(gnomon, p.clone().addScaledVector(pd.u, 0.34), pd.u, Math.PI / 4), 'brass');
        break;
      }
      default:
        instrument(p, pd.u, ornament);
    }
  }

  function arcadeTerrace(center, radius) {
    const segments = 40;
    const atHeight = (height) => center.clone().addScaledVector(Y, height);
    add(at(new THREE.CylinderGeometry(radius, radius * 0.90, 0.20, segments), atHeight(-0.10)), 'paintCream');
    add(at(new THREE.CylinderGeometry(radius * 0.84, radius * 0.74, 0.22, segments), atHeight(-0.76)), 'paintNavy');
    const deckTrim = new THREE.TorusGeometry(radius * 0.95, 0.035, 8, segments).rotateX(-Math.PI / 2);
    add(at(deckTrim, atHeight(-0.13)), 'brass');

    const opening = new THREE.Shape();
    opening.moveTo(-0.32, 0).lineTo(-0.32, 0.59).lineTo(0.32, 0.59).lineTo(0.32, 0)
      .lineTo(0.17, 0).lineTo(0.17, 0.24);
    opening.absarc(0, 0.24, 0.17, 0, Math.PI, false);
    opening.lineTo(-0.17, 0).closePath();
    const arcade = mergeVertices(new THREE.ExtrudeGeometry(opening, {
      depth: 0.13, bevelEnabled: true, bevelThickness: 0.018, bevelSize: 0.02, bevelSegments: 1,
    }));
    for (let i = 0; i < 8; i++) {
      const angle = i * Math.PI / 4;
      const edge = V(Math.sin(angle), 0, Math.cos(angle));
      const p = atHeight(-0.75).addScaledVector(edge, radius * 0.76);
      add(at(arcade.clone(), p, Y, angle), 'paintCream');
    }
    const railingFrames = circleFrames(center, Y, X, Z, radius * 0.91, 35, 325);
    k.rail(railingFrames, 0.19, 0.038, 'brass');
  }

  // Upright architectural silhouettes give each quadrant its own landmark from the outside.
  const upperEast = V(5.45, 4.63, 2.95);
  const lowerWest = V(-4.85, -6.25, 3.2);
  const gardenCourt = V(-5.88, 0.28, 3.72);
  arcadeTerrace(upperEast, 1.31);
  instrument(upperEast, Y, 'armillary');
  arcadeTerrace(lowerWest, 1.29);
  instrument(lowerWest, Y, 'globe');
  arcadeTerrace(gardenCourt, 1.23);
  prop('tree_round', gardenCourt.clone().add(V(-0.24, 0, 0.12)), {
    scale: 0.78, mats: { treeB: 'coral', dowel: 'woodDark' },
  });
  prop('crystal', gardenCourt.clone().add(V(0.57, 0, -0.05)), { scale: 0.55 });

  const rearObservatory = V(4.28, 2.85, -4.65);
  const rearGarden = V(-4.52, -5.20, -4.5);
  arcadeTerrace(rearObservatory, 1.11);
  mover({ name: 'rear-astrolabe', pivot: rearObservatory, axis: Y, speed: -0.22 }, () => {
    instrument(V(0, 0, 0), Y, 'armillary');
  });
  arcadeTerrace(rearGarden, 1.13);
  prop('tree_ply', rearGarden, { scale: 0.8, mats: { treeA: 'treeB' } });
  prop('crystal', rearGarden.clone().add(V(-0.54, 0, 0.22)), { scale: 0.48 });

  const floor = observatory.c.clone().add(V(0.0, 0.42, 1.33));
  const base = floor.clone().addScaledVector(Y, -0.10);
  arcadeTerrace(floor, 1.54);
  strut(observatory.c.clone().addScaledVector(observatory.u, -0.15), base, 0.14, 'brass');
  for (const [material, data] of Object.entries(observatoryMesh.meshes)) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(data.positions, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(data.normals, 3));
    geometry.setIndex(data.indices);
    add(at(geometry.scale(1.95, 1.95, 1.95), floor, Y, -Math.PI / 3), material);
  }
  checkpoint('圓頂觀測站', padPoint(observatory, 105, 0.79), observatory);
  light(floor.clone().add(V(0.56, 0.94, -0.58)), 0xffb85d, 19, 6.3, 0.66);
  light(observatory.c.clone().addScaledVector(observatory.u, 0.70), 0xffbd73, 13, 4.5, 0.7);
  const dockLamp = liftBottom.clone().addScaledVector(across, -1.28).addScaledVector(axis, -0.12).addScaledVector(Y, 0.66);
  const dockLampBase = dockLamp.clone().setY(liftBottom.y - 0.24);
  add(at(new THREE.CylinderGeometry(0.20, 0.28, 0.20, 20), dockLampBase), 'paintNavy');
  strut(dockLampBase, dockLamp, 0.046, 'brass');
  add(at(new THREE.SphereGeometry(0.145, 18, 12), dockLamp), 'lamp');
  add(at(new THREE.ConeGeometry(0.21, 0.14, 16), dockLamp.clone().addScaledVector(Y, 0.15)), 'paintRed');
  light(dockLamp, 0xffa34a, 23, 4.1, 0.84);
  const rearFrame = rearRun.frames[Math.floor(rearRun.frames.length * 0.51)];
  const prismBase = rearFrame.pos.clone().addScaledVector(rearFrame.right, 0.76);
  strut(rearFrame.pos.clone().addScaledVector(rearFrame.up, -0.16), prismBase, 0.045, 'brass');
  prop('crystal', prismBase, { up: rearFrame.up, scale: 0.46 });
  const prismGlow = prismBase.clone().addScaledVector(rearFrame.up, 0.59);
  light(prismGlow, 0x909fff, 21, 4.8, 0.86);
  const telescope = gallery.c.clone().addScaledVector(gallery.e2, -0.93).addScaledVector(gallery.u, -0.10);
  instrument(telescope, gallery.u, 'armillary');
  checkpoint('星象迴廊', padPoint(gallery, 25, 0.75), gallery);

  // Hang the crescent in the top opening, inside the silhouette of the outer arcs.
  const moon = V(-0.55, 6.4, 1.48);
  prop('moon', moon, { yaw: 0.47, scale: 1.02, mats: { paintYellow: 'brass' } });
  strut(moon.clone().add(V(0, 1.50, 0)), moon.clone().setY(10.9), 0.022, 'brass');
  const star = new THREE.Shape();
  for (let i = 0; i < 8; i++) {
    const angle = i * Math.PI / 4, radius = i % 2 === 0 ? 0.33 : 0.083;
    const x = radius * Math.sin(angle), y = radius * Math.cos(angle);
    if (i === 0) star.moveTo(x, y);
    else star.lineTo(x, y);
  }
  star.closePath();
  const starPosition = V(0.52, 7.34, 1.43);
  const starMesh = mergeVertices(new THREE.ExtrudeGeometry(star,
    { depth: 0.045, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.013, bevelSegments: 1 }));
  add(at(starMesh, starPosition, Y, 0.47), 'brass');
  strut(starPosition.clone().add(V(0, 0.32, 0)), starPosition.clone().setY(10.8), 0.014, 'brass');

  // The orrery below the rolling deck is a separate instrument, clear of the marble.
  mover({ name: 'orrery-planets', pivot: V(0, -1.22, 0), axis: Y, speed: 0.18 }, () => {
    const axes = [V(0.16, 1, 0.36).normalize(), V(-0.24, 1, 0.06).normalize()];
    axes.forEach((axis, i) => {
      const radius = 0.92 + i * 0.19;
      const ring = new THREE.TorusGeometry(radius, 0.034, 8, 48).rotateX(-Math.PI / 2);
      add(at(ring, V(0, 0, 0), axis), 'brass');
      const position = V(radius * Math.cos(0.8 + i * 2.4), 0, radius * Math.sin(0.8 + i * 2.4))
        .applyQuaternion(new THREE.Quaternion().setFromUnitVectors(Y, axis));
      add(at(new THREE.SphereGeometry(0.17, 20, 12), position), i === 0 ? 'paintNavy' : 'paintCream');
    });
    add(new THREE.SphereGeometry(0.28, 20, 12), 'brass');
  });

  return k.finish();
}

export default {
  id: 'orrery',
  name: '星軌儀',
  blurb: '沿一條立體路線穿過齒輪轉盤、倒懸月台與背面稜鏡，順坡滑進升降梯。',
  build,
};
