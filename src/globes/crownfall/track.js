import { V, Y } from '../../kit.js';
import { turntable } from '../../library/mechanisms.js';

const X = V(1, 0, 0);
const DOWN = V(0, -1, 0);
const style = { lip: 0.26, support: false };

function route(k, routes, name, pad, heading, color) {
  const track = k.fromPad(pad, k.padAngle(pad, heading), name, { ...style, color });
  routes[name] = track;
  return track;
}

function dock(k, track, pad, radial) {
  const edge = pad.c.clone().addScaledVector(radial.clone().normalize(), pad.r);
  track.spline([{ p: edge, up: pad.u }]);
  k.arrive(track, pad);
}

const knot = (x, y, z, up = Y) => ({ p: V(x, y, z), up });

function riverSpiral(k, runs, river) {
  const diagonal = V(1, 0, 1).normalize();
  const flat = (p) => p.clone().setY(0);
  const track = route(k, runs, 'river-spiral', river, diagonal, 'paintBlue')
    .ramp(0.9, -25).turn(90, 0.6);
  track.t.crossVectors(Y, flat(track.p).normalize());
  const azimuth = Math.atan2(track.p.z, track.p.x) * 180 / Math.PI;
  track.helix(360, 3.31, 4.08);
  track.style({ color: 'paintNavy' });
  track.helix(360 + ((azimuth + 55) % 360 + 360) % 360, 3.54, -track.p.y);
  const radial = flat(track.p);
  const swing = (fraction, length) => radial.clone().applyAxisAngle(Y, fraction * 80 * Math.PI / 180).setLength(length);
  track.spline([
    { p: swing(0.20, radial.length() - 0.17) },
    { p: swing(0.45, radial.length() - 0.71) },
    { p: swing(0.76, 2.65) },
    knot(-1.31, 0, -2.12),
    knot(-1.43, 0, -1.61),
    knot(-0.962, 0, -0.962),
  ]);
}

export function buildTrack(k) {
  const pads = {
    castle: k.padAt(V(-5.27, -1.65, 5.66), Y, X, 1.06, { island: false }),
    river: k.padAt(V(0, -7.50, 0), Y, X, 1.22, { island: false }),
    glacier: k.padAt(V(5.0, -1.35, -7.35), Y, X, 1.08, { island: false }),
    volcano: k.padAt(V(7.28, -1.65, 4.95), Y, X, 1.05, { island: false }),
    bridge: k.padAt(V(2.66, -0.48, 6.95), Y, X, 1.02, { island: false }),
    mine: k.padAt(V(0.35, 7.50, 0.18), DOWN, X, 1.12, { island: false }),
    lookout: k.padAt(V(-2.96, 3.06, 4.77), Y, X, 0.94, { island: false }),
  };
  const { castle, river, glacier, volcano, bridge, mine } = pads;
  const runs = {};

  // The narrow approach below the front wall becomes a stone aqueduct over the ravine.
  const aqueduct = route(k, runs, 'castle-waterwheel', castle, X, 'paintCream').straight(0.33);
  aqueduct.spline([
    knot(-3.34, -1.61, 5.42), knot(-2.89, -1.23, 4.65, V(0.24, 0.95, 0.10)),
    knot(-2.92, -0.52, 3.76), knot(-2.58, -0.03, 2.88),
    knot(-1.94, 0.01, 2.09), knot(-1.50, 0, 1.50), knot(-0.962, 0, 0.962),
  ]);

  turntable(k, { center: V(0, 0, 0), radius: 1.3, speed: 0.30, gaps: 6, color: 'paintNavy' });
  k.strut(V(0, -0.52, 0), V(0, -1.74, 0), 0.12, 'woodDark');
  riverSpiral(k, runs, river);

  // Follow the lower riverbed into the ice. The upper rise hugs the outside of the moraine.
  const moraine = route(k, runs, 'river-glacier', river, V(0, 0, -1), 'paintBlue').trough(0.68);
  moraine.style({ section: 'plank', color: 'seaLight' }).spline([
    knot(0.25, -7.45, -2.86), knot(0.88, -7.20, -4.06), knot(1.67, -6.45, -5.34),
    knot(2.65, -4.86, -6.64), knot(3.13, -3.19, -7.69),
    knot(3.37, -2.19, -8.17), knot(3.69, -1.55, -8.18),
    knot(4.0, -1.35, -7.98),
  ]);
  dock(k, moraine, glacier, V(-0.84, 0, -0.55));

  // A blue ice fissure gives way to bare brass rails on the warm side of the ridge.
  const fault = route(k, runs, 'glacier-volcano', glacier, X, 'paintBlue').straight(0.28);
  fault.style({ section: 'tube' }).spline([
    knot(7.02, -1.24, -6.97), knot(7.62, -0.73, -5.96),
    knot(7.63, 0.16, -4.75), knot(7.35, 0.69, -3.58),
  ]);
  fault.style({ section: 'plank', color: 'paintNavy' }).spline([
    knot(7.19, 0.60, -2.52), knot(7.64, 0.19, -1.55), knot(8.42, -0.64, -0.60),
    knot(8.75, -1.19, 0.58), knot(8.47, -1.48, 1.83),
  ]);
  fault.style({ section: 'rails' }).spline([
    knot(8.28, -1.65, 2.68), knot(8.46, -1.68, 3.35),
  ]);
  fault.style({ section: 'plank', color: 'paintRed' }).spline([knot(8.25, -1.65, 3.80)]);
  dock(k, fault, volcano, V(0.57, 0, -0.82));

  // Emerge around the cone and cross the orange-lit ravine on a timber span.
  const emberSpan = route(k, runs, 'volcano-bridge', volcano, V(0, 0, 1), 'paintRed').straight(0.34);
  emberSpan.spline([
    knot(7.03, -1.87, 6.96), knot(6.17, -1.76, 7.68, V(0, 0.97, -0.21)),
    knot(5.18, -1.22, 7.82), knot(4.44, -0.66, 7.48),
  ]);
  emberSpan.style({ color: 'ply' }).spline([knot(4.04, -0.48, 7.17)]);
  dock(k, emberSpan, bridge, X);

  // The same bridge continues around its own underside into the quarry. The normal
  // changes throughout the seam, leaving room for the steel ball and its camera.
  const flip = route(k, runs, 'bridge-mine', bridge, V(-1, 0, 0), 'ply').straight(0.43);
  flip.spline([
    knot(0.48, -0.38, 7.12), knot(-0.37, 0.04, 7.45, V(0.40, 0.91, 0.05)),
    knot(-0.86, 1.20, 7.78, V(0.96, 0.15, -0.23)),
    knot(-0.76, 2.73, 7.80, V(0.63, -0.06, -0.78)),
    knot(-0.08, 4.15, 7.51, V(0.18, -0.28, -0.94)),
    knot(0.78, 5.53, 6.63, V(0.02, -0.55, -0.83)),
    knot(1.27, 6.80, 5.29, V(0.05, -0.75, -0.66)),
    knot(1.35, 7.45, 3.90, V(0, -0.98, -0.20)),
  ]);
  flip.style({ color: 'paintNavy' }).spline([
    knot(1.31, 7.50, 2.84, DOWN), knot(1.15, 7.50, 2.15, DOWN),
    knot(0.97, 7.50, 1.59, DOWN),
  ]);
  dock(k, flip, mine, V(0.40, 0, 0.92));

  // The old ore road curls out of a split in the roof and back to the city.
  const ore = route(k, runs, 'mine-castle', mine, V(-0.38, 0, -0.93), 'paintNavy').straight(0.44);
  ore.style({ section: 'rails' }).spline([
    knot(-0.36, 7.48, -2.23, DOWN), knot(-0.48, 7.55, -3.59, DOWN),
    knot(-0.66, 7.48, -4.86, DOWN),
  ]);
  ore.style({ section: 'plank', color: 'rock' }).spline([
    knot(-1.34, 7.20, -6.04, V(0.18, -0.98, 0)),
    knot(-3.37, 6.68, -6.48, V(0.55, -0.83, 0.10)),
    knot(-5.58, 5.40, -6.00, V(0.79, -0.56, 0.21)),
    knot(-7.06, 3.55, -4.32, V(0.92, -0.28, 0.26)),
    knot(-8.10, 2.04, -2.00, V(1, 0, 0)),
  ]);
  ore.style({ color: 'rock' }).spline([
    knot(-8.40, 1.14, 0.52, V(0.93, 0.36, 0.05)),
    knot(-8.23, 0.02, 2.70, V(0.66, 0.75, 0.06)),
    knot(-7.73, -1.15, 4.47, V(0.30, 0.95, 0.03)),
    knot(-7.06, -1.62, 5.47), knot(-6.68, -1.65, 5.66),
  ]);
  dock(k, ore, castle, V(-1, 0, 0));

  addCrossings(k, runs, pads);

  const stations = [
    ['王城水門', castle, 0xffc685], ['銀河渡口', river, 0xa6e5ff],
    ['白脊冰川', glacier, 0x8beafa], ['灰冠火山', volcano, 0xff9259],
    ['吊岩橋', bridge, 0xffcf9b], ['倒懸菇礦', mine, 0xffaada],
    ['懸鐘亭', pads.lookout, 0xffd8a0],
  ];
  for (const [name, pad, color] of stations) {
    k.padLantern(name, pad);
    k.lanterns.at(-1).illumination = { color, intensity: 9, distance: 3.6 };
  }
  return { pads, runs };
}

function addCrossings(k, runs, { castle, river, glacier, volcano, bridge, mine, lookout }) {
  // Maintenance rails climb from the delta along the hidden edge of the magma chamber.
  const basalt = route(k, runs, 'basalt-service', river, X, 'woodDark').trough(0.38);
  basalt.style({ section: 'plank' }).spline([
    knot(2.08, -7.58, -0.17), knot(3.16, -7.75, -0.20), knot(4.58, -7.68, 0.32),
    knot(5.88, -6.95, 0.97), knot(7.13, -5.76, 1.87), knot(8.12, -4.64, 2.96),
    knot(8.49, -3.52, 4.21),
  ]);
  basalt.style({ color: 'paintNavy' }).spline([
    knot(8.79, -2.52, 4.79), knot(8.86, -1.85, 4.96),
  ]);
  dock(k, basalt, volcano, X);

  // A shaft rises behind the ice curtain and turns over into the old mine works.
  const shaft = route(k, runs, 'ice-shaft', glacier, V(0.60, 0, 0.80), 'paintBlue').straight(0.17);
  shaft.style({ skin: 'crystal' }).spline([
    knot(6.08, -1.21, -6.18), knot(6.47, -0.40, -5.91, V(-0.70, 0.40, -0.54)),
    knot(6.45, 1.24, -5.49, V(-0.78, 0.22, -0.59)), knot(5.97, 2.87, -4.81, V(-0.72, -0.09, -0.67)),
    knot(5.15, 4.16, -3.65, V(-0.50, -0.31, -0.81)), knot(4.21, 5.33, -2.51, V(-0.22, -0.42, -0.88)),
  ]);
  shaft.style({ skin: 'wood', section: 'tube' }).spline([
    knot(3.43, 6.16, -1.32, V(-0.22, -0.64, -0.73)),
    knot(2.88, 7.14, -0.32, V(-0.30, -0.92, -0.25)),
    knot(2.26, 7.48, 0.07, DOWN), knot(1.76, 7.50, 0.17, DOWN),
  ]);
  shaft.style({ section: 'plank' });
  dock(k, shaft, mine, X);

  // The short skyway joins the bridge to the back of the crystal ridge at another height.
  const skyway = route(k, runs, 'skyway', bridge, V(0, 0, -1), 'paintCream').straight(0.28);
  skyway.spline([
    knot(2.65, -0.30, 5.12), knot(2.79, 0.64, 4.01), knot(3.19, 1.92, 2.92),
    knot(3.66, 2.43, 1.29), knot(4.05, 2.40, -0.50),
    knot(3.79, 2.11, -1.97), knot(3.10, 1.19, -3.35), knot(2.70, 0.17, -4.68),
  ]);
  skyway.style({ section: 'trough', color: 'seaLight' }).spline([
    knot(2.92, -0.78, -5.70), knot(3.58, -1.26, -6.25), knot(4.18, -1.35, -6.54),
  ]);
  skyway.style({ section: 'plank' });
  dock(k, skyway, glacier, V(-0.52, 0, 0.85));

  // A steep outer gallery climbs to the hanging bell at the edge of the glass.
  const gallery = route(k, runs, 'bell-gallery', castle, V(0, 0, 1), 'rock').straight(0.22);
  gallery.spline([
    knot(-5.14, -1.58, 7.38), knot(-4.81, -1.09, 7.80),
    knot(-4.32, 0.07, 7.91), knot(-3.79, 1.52, 7.42),
    knot(-3.52, 2.42, 6.49), knot(-3.33, 2.93, 5.93),
  ]);
  dock(k, gallery, lookout, V(-0.25, 0, 0.97));

  const liftBridge = route(k, runs, 'bell-quarry', lookout, V(0.90, 0, -0.42), 'ply').straight(0.22);
  liftBridge.spline([
    knot(-1.40, 3.32, 4.13), knot(-0.18, 3.87, 3.18),
    knot(0.22, 4.98, 2.38, V(-0.57, 0.19, -0.80)),
    knot(-0.05, 6.32, 1.86, V(-0.65, -0.38, -0.65)),
    knot(-0.87, 7.13, 1.36, V(-0.36, -0.92, -0.16)),
    knot(-1.56, 7.48, 0.76, DOWN), knot(-1.63, 7.50, 0.38, DOWN),
    knot(-1.36, 7.50, 0.21, DOWN),
  ]);
  dock(k, liftBridge, mine, V(-1, 0, 0));

  const diagonal = V(1, 0, -1).normalize();
  const air = k.track('west-aerial', diagonal.clone().multiplyScalar(1.36), diagonal, Y, { ...style, color: 'paintNavy' });
  runs[air.name] = air;
  air.straight(0.36).spline([
    knot(1.69, 0.36, -1.64), knot(1.95, 1.17, -2.24),
    knot(1.68, 1.80, -3.23), knot(0.47, 2.17, -3.88),
    knot(-0.94, 2.68, -3.42), knot(-2.05, 3.18, -2.67),
    knot(-2.37, 3.55, -1.53), knot(-2.46, 3.60, 0.01),
  ]);
  air.style({ color: 'ply' }).spline([
    knot(-2.76, 3.28, 1.53), knot(-3.03, 3.11, 2.81), knot(-3.08, 3.06, 3.58),
  ]);
  dock(k, air, lookout, V(-0.12, 0, -0.99));
}
