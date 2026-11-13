import * as THREE from 'three';
import { V, Y, at } from '../../kit.js';
import { archOver } from '../../library/mechanisms.js';
import castle from './castle.json' with { type: 'json' };
import terrain from './terrain.json' with { type: 'json' };

const DOWN = V(0, -1, 0);

function withIndices(geometry) {
  if (!geometry.index) geometry.setIndex(Array.from({ length: geometry.getAttribute('position').count }, (_, i) => i));
  return geometry;
}

function placeMeshes(k, groups, { transform, collide = true, smooth = false } = {}) {
  for (const [material, { p, i }] of Object.entries(groups)) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    geometry.setIndex(i);
    if (transform) geometry.applyMatrix4(transform);
    const faces = smooth ? geometry : geometry.toNonIndexed();
    faces.computeVertexNormals();
    k.add(withIndices(faces), material, collide);
  }
}

function frameMatrix(frame) {
  return new THREE.Matrix4().makeBasis(frame.right, frame.up, frame.tan.clone().negate()).setPosition(frame.pos);
}

function beside(frame, sideways, height) {
  return frame.pos.clone().addScaledVector(frame.right, sideways).addScaledVector(frame.up, height);
}

function block(k, dimensions, position, material, basis = null) {
  const geometry = new THREE.BoxGeometry(...dimensions);
  if (basis) geometry.applyMatrix4(basis);
  geometry.translate(position.x, position.y, position.z);
  k.add(geometry, material);
}

function pennant(k, foot, width, height, color, turn) {
  const top = foot.clone().add(V(0, height, 0));
  const tip = top.clone().add(V(Math.cos(turn) * width, 0, Math.sin(turn) * width));
  k.strut(foot, top.clone().add(V(0, 0.09, 0)), 0.028, 'woodDark', false);
  k.strut(top, tip, 0.016, 'brass', false);
  const geometry = new THREE.BufferGeometry();
  const positions = [];
  const indices = [];
  for (let i = 0; i <= 7; i++) {
    const t = i / 7;
    const wave = Math.sin(t * Math.PI * 2.2) * 0.045 * t;
    const point = top.clone().lerp(tip, t).add(V(-Math.sin(turn) * wave, -0.018 * t, Math.cos(turn) * wave));
    const drape = (1 - t * 0.72) * 0.28;
    positions.push(...point.toArray(), ...point.clone().add(V(0, -drape, 0)).toArray());
    if (i < 7) {
      const a = i * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2, a + 2, a + 1, a, a + 2, a + 3, a + 1);
    }
  }
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  const cloth = geometry.toNonIndexed();
  cloth.computeVertexNormals();
  k.add(withIndices(cloth), color, false);
}

function dressWatergate(k, { castle: gate }, runs) {
  const causeway = runs['castle-waterwheel'];
  archOver(k, causeway.frames[8], { scale: 0.83, sink: 0.22 });
  const stretch = causeway.frames.slice(10, 27);
  const crown = stretch[8].pos.clone().add(V(0, -0.28, 0));
  const forward = stretch.at(-1).pos.clone().sub(stretch[0].pos).setY(0).normalize();
  const sideways = forward.clone().cross(Y);
  const curve = new THREE.Matrix4().makeBasis(sideways, Y, forward.clone().negate());
  // Wedge stones form a pointed arch under the causeway. The two feet tie into
  // the waterfall ledge and the counterweight below the turntable.
  for (const side of [-1, 1]) {
    let foot = null;
    for (let i = 0; i < 8; i++) {
      const t = i / 7;
      const joint = crown.clone().addScaledVector(forward, side * (1.08 * t + 0.61 * t * t))
        .add(V(0, -2.25 * Math.pow(t, 1.52), 0));
      const tilt = Math.atan2(2.25 * 1.52 * Math.pow(Math.max(t, 0.03), 0.52), 1.08 + 1.22 * t);
      block(k, [0.89, 0.44, 0.43], joint, i % 3 === 0 ? 'paintCream' : 'rock',
        curve.clone().multiply(new THREE.Matrix4().makeRotationX(-tilt * side)));
      foot = joint;
    }
    const anchor = side < 0 ? foot.clone().add(V(0, -0.80, 0)) : V(-0.53, -2.58, 0.81);
    k.strut(foot, anchor, side < 0 ? 0.27 : 0.15, 'rock');
  }
  k.prop('house', V(-4.63, -2.67, 2.99), { scale: 0.46, yaw: -0.58, mats: { body: 'paintCream', roof: 'paintNavy' } });
  k.prop('house', V(-5.28, -3.44, -1.52), { scale: 0.48, yaw: 0.65, mats: { body: 'ply', roof: 'paintRed' } });
  pennant(k, V(-6.38, -1.43, 4.75), 0.43, 0.76, 'paintRed', 0.39);
  pennant(k, V(-4.58, -1.44, 4.64), 0.36, 0.60, 'paintNavy', 0.41);
  pennant(k, V(-3.43, -2.16, 4.65), 0.27, 0.44, 'paintYellow', 0.23);
  k.light(gate.c.clone().add(V(-0.38, 0.78, -0.66)), 0xffbb78, 9.4, 3.6, 0.70);
  k.light(V(-3.19, -3.03, 4.55), 0x9de7f5, 8, 4.7, 0.70);
}

function dressRiver(k, { river }) {
  const boat = V(-0.88, -8.09, -1.57);
  k.prop('boat', boat, { scale: 0.48, yaw: -0.95 });
  for (const [x, z] of [[-0.84, 0.46], [0.32, 0.92], [0.53, -0.67]]) {
    const cap = river.c.clone().add(V(x, -0.12, z));
    k.strut(cap, cap.clone().add(V(x * 0.12, -0.78, z * 0.10)), 0.096, 'woodDark');
  }
  const mill = V(-3.04, -5.34, 3.62);
  const axis = V(1, 0, 0);
  k.mover({ name: 'waterfall-mill', pivot: mill, axis, speed: -0.52 }, () => {
    k.prop('gear_big', V(0, 0, 0), { up: axis, scale: 0.62, mats: { birch: 'woodDark' } });
    k.add(at(new THREE.TorusGeometry(0.63, 0.04, 7, 28).rotateY(Math.PI / 2), V(0.095, 0, 0)), 'brass');
  });
  k.strut(mill.clone().addScaledVector(axis, -0.82), mill.clone().addScaledVector(axis, 0.47), 0.075, 'woodDark');
  k.light(river.c.clone().add(V(-0.6, 0.48, -1.35)), 0x82d4f6, 5.7, 3.8, 0.59);
}

function dressIce(k, runs) {
  const track = runs['glacier-volcano'];
  // The tunnel runs behind a leaning crevasse wall, with its brass hoops visible
  // in the gap between the shard and the glacier.
  for (const [index, side, lean, height] of [[13, 1, -0.33, 1.38], [19, 1, -0.49, 1.85], [25, -1, 0.18, 1.03]]) {
    const frame = track.frames[index];
    const shard = new THREE.CylinderGeometry(0.12, 0.37, height, 5, 1)
      .scale(0.75, 1, 1.29).rotateZ(side * -lean).translate(side * 0.94, height * 0.34, 0)
      .applyMatrix4(frameMatrix(frame));
    k.add(shard, index === 19 ? 'seaLight' : 'paintBlue');
    const tip = beside(frame, side * 1.06, height * 0.58);
    k.light(tip, 0x71ccef, 5.1, 3.8, 0.59);
  }
  k.light(V(4.42, -0.46, -5.42), 0x84e2ff, 9, 4.8, 0.66);
}

function dressEmberSpan(k, runs) {
  const frames = runs['volcano-bridge'].frames.slice(7, 30);
  for (const side of [-1, 1]) {
    let previous = null;
    for (const [index, frame] of frames.entries()) {
      const t = index / (frames.length - 1);
      const height = THREE.MathUtils.lerp(1.42, 0.83, t) - 0.63 * Math.sin(Math.PI * t);
      const outcrop = side > 0 ? 0.34 * Math.max(0, 1 - index / 5) : 0;
      const cable = beside(frame, side * (0.48 + outcrop + 0.11 * Math.sin(Math.PI * t)), height);
      if (previous) k.strut(previous, cable, 0.023, 'woodDark', false);
      if (index % 4 === 0 || index === frames.length - 1) {
        const deck = beside(frame, side * 0.42, -0.08);
        k.strut(deck, cable, 0.029, 'woodDark', false);
        if (index === 0 || index === frames.length - 1) {
          const footing = deck.clone().addScaledVector(frame.right, outcrop * 1.4)
            .add(V(side * 0.13, index === 0 ? -1.46 : -0.86, 0));
          k.strut(footing, cable.clone().addScaledVector(frame.up, 0.15), 0.081, 'woodDark');
          k.strut(footing, beside(frame, -side * 0.32, -0.16), 0.055, 'ply');
        }
      }
      previous = cable;
    }
  }
  k.light(V(5.80, -0.47, 4.20), 0xff6b3c, 19, 5.6, 0.79);
  k.light(V(4.90, -2.18, 5.20), 0xff552f, 8.0, 4.0, 0.70);
  k.light(V(3.91, -0.22, 7.26), 0xffbd77, 7.0, 3.3, 0.50);
}

function dressBell(k, { lookout }) {
  const court = lookout.c.clone().add(V(-1.26, -0.05, -0.04));
  const front = court.clone().add(V(0, 0, 0.46));
  const back = court.clone().add(V(0, 0, -0.46));
  for (const post of [front, back]) {
    block(k, [0.30, 0.28, 0.30], post.clone().add(V(0, -0.05, 0)), 'rock');
    block(k, [0.12, 1.52, 0.13], post.clone().add(V(0, 0.76, 0)), 'woodDark');
  }
  block(k, [0.24, 0.14, 1.19], court.clone().add(V(0, 1.48, 0)), 'woodDark');
  for (const side of [-1, 1]) {
    const roof = new THREE.BoxGeometry(0.45, 0.085, 1.30)
      .rotateZ(side * -0.52).translate(side * 0.18, 1.67, 0);
    roof.translate(court.x, court.y, court.z);
    k.add(roof, 'paintNavy');
  }
  const bell = new THREE.LatheGeometry([
    [0.21, 0], [0.25, 0.024], [0.23, 0.07], [0.174, 0.13],
    [0.126, 0.27], [0.094, 0.34], [0.032, 0.36],
  ].map(([r, y]) => new THREE.Vector2(r, y)), 20);
  const hang = court.clone().add(V(0, 0.94, 0));
  k.add(at(bell, hang), 'brass');
  k.strut(hang.clone().add(V(0, 0.32, 0)), hang.clone().add(V(0, 0.54, 0)), 0.043, 'woodDark');
  k.add(at(new THREE.SphereGeometry(0.061, 10, 7), hang.clone().add(V(0, -0.025, 0))), 'woodDark');
  k.strut(court.clone().add(V(0, -0.12, 0.31)), V(-4.93, 0.17, 4.14), 0.061, 'woodDark');
  k.strut(court.clone().add(V(0, -0.12, -0.31)), V(-4.11, 0.21, 3.52), 0.058, 'woodDark');
  pennant(k, court.clone().add(V(0, 1.71, 0.32)), 0.47, 0.53, 'paintRed', 0.47);
  k.light(court.clone().add(V(0.25, 0.92, 0.16)), 0xffc38d, 11, 4.0, 0.62);
}

function oreCart(k, frame, side) {
  const basis = frameMatrix(frame).multiply(new THREE.Matrix4().makeTranslation(side * 1.16, 0.10, 0));
  const piece = (geometry, x, y, z, color) => k.add(withIndices(geometry).translate(x, y, z).applyMatrix4(basis), color);
  piece(new THREE.BoxGeometry(0.51, 0.09, 0.63), 0, 0.16, 0, 'woodDark');
  for (const offset of [-1, 1]) {
    piece(new THREE.BoxGeometry(0.06, 0.25, 0.67).rotateZ(offset * -0.23), offset * 0.28, 0.31, 0, 'ply');
    piece(new THREE.BoxGeometry(0.52, 0.23, 0.058), 0, 0.31, offset * 0.31, 'ply');
    for (const z of [-0.22, 0.22]) {
      piece(new THREE.CylinderGeometry(0.112, 0.112, 0.072, 14).rotateZ(Math.PI / 2), offset * 0.30, 0.095, z, 'woodDark');
      piece(new THREE.CylinderGeometry(0.042, 0.042, 0.085, 9).rotateZ(Math.PI / 2), offset * 0.30, 0.095, z, 'brass');
    }
  }
  for (const [x, z, height, tilt] of [[-0.12, 0.10, 0.17, 0.4], [0.10, -0.04, 0.22, -0.2], [0.01, -0.15, 0.14, 0.2]]) {
    piece(new THREE.OctahedronGeometry(height).scale(0.65, 1, 0.66).rotateZ(tilt), x, 0.35, z, 'crystal');
  }
  piece(new THREE.BoxGeometry(0.70, 0.13, 0.90), 0, -0.02, 0, 'rock');
  k.light(V(0, 0.63, 0).applyMatrix4(basis), 0x76dcc5, 4.8, 2.8, 0.64);
}

function dressMine(k, { mine }, runs) {
  const approach = runs['bridge-mine'];
  const ore = runs['mine-castle'];
  for (const [frame, scale] of [[approach.frames[73], V(1.25, 1.12, 0.86)], [ore.frames[15], V(1.31, 1.12, 0.95)]]) {
    placeMeshes(k, terrain.portal, { transform: frameMatrix(frame).scale(scale) });
  }
  // The rails are braced into the quarry roof. Four uneven cross ties lead
  // toward the ore face rather than dressing the whole track uniformly.
  for (const index of [8, 19, 26, 35]) {
    const frame = ore.frames[index];
    for (const side of [-1, 1]) {
      const tie = beside(frame, side * 0.28, -0.12);
      const roof = beside(frame, side * (index < 23 ? 0.64 : 0.46), -0.74);
      k.strut(tie, roof, 0.043, index === 26 ? 'brass' : 'woodDark');
    }
  }
  k.strut(mine.c.clone().add(V(0.50, 0.16, -0.21)), mine.c.clone().add(V(0.65, 0.95, -0.36)), 0.092, 'woodDark');

  oreCart(k, ore.frames[11], -1);

  const veins = [
    [V(-2.80, 6.91, -2.64), 0.92, 0xefa0d1], [V(-3.36, 6.42, -3.12), 0.68, 0xd76fbf],
    [V(1.75, 7.08, -2.45), 0.82, 0x78d6f4], [V(2.77, 7.15, -3.48), 0.60, 0x78eadb],
    [V(-2.78, 7.50, 2.35), 0.78, 0xf6a6d5], [V(2.61, 7.54, 2.52), 0.64, 0x79dfd9],
  ];
  for (const [position, size, color] of veins) {
    k.prop('crystal', position, { up: DOWN, yaw: (position.x + position.z) * 0.48, scale: size });
    k.light(position.clone().add(V(0, -0.64, 0)), color, 6.7, 3.7, 0.68);
  }
  k.setMood((point) => 0.82 * THREE.MathUtils.smoothstep(point.y, 4.65, 7.40));
}

export function buildScene(k, { pads, runs }) {
  placeMeshes(k, terrain.landscape);
  placeMeshes(k, terrain.water, { collide: false });
  placeMeshes(k, castle, { smooth: true });
  dressWatergate(k, pads, runs);
  dressRiver(k, pads);
  dressIce(k, runs);
  dressEmberSpan(k, runs);
  dressBell(k, pads);
  dressMine(k, pads, runs);
}
