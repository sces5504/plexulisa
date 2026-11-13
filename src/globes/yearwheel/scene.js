// 年輪 — what stands in each of the worlds. Everything here is placed on the tree and its lands
// (see tree.js); nothing is scattered at random. `clear(p, r)` (given by the globe) says whether a
// spot is free of track, so the same dressing works before and after the routes are laid.
import * as THREE from 'three';
import { V, Y, at } from '../../kit.js';
import { armillary, mobile, gearTrain, musicDrum, windupKey, yawFor, trampoline } from '../../library/mechanisms.js';
import { clump, spike, limb, rnd, faceted } from './shapes.js';
import { HUB, SUN } from './tree.js';

export function buildScene(k, T, clear = () => true) {
  const { prop, strut, add } = k;
  // stand a shared prop on a land: angle and distance from its middle
  // how much room each needs round its foot, at scale 1 (so nothing is stood half across a track)
  const FOOT = { cottage: 1.3, toadstool_house: 1.5, clock_tower: 1.2, wizard_tower: 1.5, pine_snow: 0.7, tree_round: 0.6, tree_pine: 0.6, tree_ply: 0.6, well: 0.8, fountain: 1.2, windmill: 0.9, elder_tree: 1.6, blossom_tree: 0.9, maple_tree: 0.9, harvest_mill: 1.45, frost_belfry: 0.85, rock_spire: 1.1, crystal: 0.6, snowman: 0.6, stone_bridge: 1.9, mushroom: 0.7, street_lamp: 0.3, signpost: 0.5, fence: 0.6, bell: 0.4, candle: 0.4 };
  // Stand a shared prop on a land at (angle, distance from its middle). If a track has since been
  // laid through that spot, or something already stands there, it is moved to the nearest free place
  // on the same land (so the lands stay as full as they were designed, round whatever the routes took).
  const stood = [];
  const put = (L, name, ang, dist, o = {}) => {
    const foot = (FOOT[name] ?? 0.6) * (o.scale || 1), free = (p) => clear(p, foot + 0.12) && !stood.some((q) => q.p.distanceTo(p) < (q.foot + foot) * 0.8);
    let p = L.on(ang, dist, -(o.sink ?? 0.05)), ok = o.force || free(p);
    for (let ring = 1; !ok && ring <= 7; ring++) for (let j = 0; !ok && j < 8 + ring * 4; j++) {
      const a = (j / (8 + ring * 4)) * Math.PI * 2 + ring, da = Math.cos(a) * ring * 0.3, dd = Math.sin(a) * ring * 0.3;
      const d2 = dist + dd, a2 = ang + (da / Math.max(0.6, dist)) * 57.3;
      if (d2 < 0.05 || d2 > L.r * 0.93 - foot * 0.5) continue;
      const q = L.on(a2, d2, -(o.sink ?? 0.05)); if (free(q)) { p = q; ok = true; }
    }
    if (ok) { prop(name, p, { up: L.u, ...o }); stood.push({ p, foot }); }
    return ok ? p : null;
  };
  // hang a prop on a thread from a point (props have their origin at the base, so the base goes one prop-height lower)
  const hang = (name, from, drop, size, o = {}) => {
    const base = from.clone().add(V(0, -drop - size * (o.scale || 1), 0));
    if (!clear(base, 1.3)) return;
    strut(from, base.clone().add(V(0, size * (o.scale || 1), 0)), 0.01, 'rope', false);
    prop(name, base, { collide: false, ...o });
  };
  // a nest: a small mossy shelf cupped in a fork of the tree, for a house to sit on
  const nest = (c, r, top = 'moss') => {
    clump(k, c.clone().add(V(0, -r * 0.42, 0)), r, 'bark', { seed: c.x * 3 + c.z, squash: 0.5, lumps: 0.18, detail: 1 });
    add(faceted(at(new THREE.CylinderGeometry(r * 0.9, r * 0.98, 0.14, 14), c.clone().add(V(0, -0.07, 0)))), top);
  };

  const turned = (L, deg) => L.e1.clone().applyAxisAngle(L.u, (deg * Math.PI) / 180);
  const flowers = (L, n, a0, cols, seed) => { for (let i = 0; i < n; i++) { const p = L.on(a0 + i * (330 / n), L.r * (0.3 + rnd(i, seed) * 0.6), 0.07); if (clear(p, 0.5)) clump(k, p, 0.08 + rnd(i, seed + 1) * 0.06, cols[i % cols.length], { seed: i, squash: 0.6, detail: 0, lumps: 0.1, up: L.u, collide: false }); } };

  /* ================= 夏 — the crown (up is up) ================================================ */
  {
    // houses in the forks of the boughs, the solstice tower highest of all
    const homes = [[2, 0.62, 'wizard_tower', 0.42, 0.9, null], [1, 0.62, 'toadstool_house', 0.5, 2.6, null], [0, 0.6, 'cottage', 0.5, -0.7, null],
      [4, 0.6, 'toadstool_house', 0.46, 1.7, { paintRed: 'paintTeal' }], [6, 0.62, 'cottage', 0.46, 2.2, { thatch: 'paintRed' }], [3, 0.66, 'toadstool_house', 0.42, 0.4, { paintRed: 'paintYellow' }], [5, 0.7, 'toadstool_house', 0.4, 3.4, { paintRed: 'petal' }]];
    for (const [bi, s, name, sc, yaw, mats] of homes) {
      const b = T.boughs[bi], c = b.at(s).add(V(0, b.radius(s) + 0.1, 0));
      if (!clear(c, 1.2) || k.pads.some((pd) => pd.c.distanceTo(c) < pd.r + 2.4)) continue;   // (not where it would stand between a terrace and the camera behind the marble)
      nest(c, 0.55 + sc * 0.9); prop(name, c, { scale: sc, yaw, mats });
    }
    // lanterns, stars and trailing vines hung from the boughs
    T.boughs.forEach((b, i) => {
      hang('paper_lantern', b.at(0.42).add(V(0, -b.radius(0.42), 0)), 0.4 + (i % 3) * 0.25, 0.62, { scale: 0.7 });
      hang(i % 2 ? 'star' : 'paper_lantern', b.at(0.84).add(V(0, -b.radius(0.84), 0)), 0.8 - (i % 2) * 0.3, 0.65, { scale: 0.65, yaw: i });
      for (const s of [0.55, 0.72, 0.96]) {
        const from = b.at(s), len = 0.9 + rnd(i, s * 10) * 1.5, end = from.clone().add(V((rnd(i, s) - 0.5) * 0.3, -len, (rnd(i, s + 1) - 0.5) * 0.3));
        if (!clear(end, 1.4) || !clear(from.clone().lerp(end, 0.5), 1.4)) continue;
        strut(from, end, 0.022, 'vine', false);
        for (let j = 1; j <= 3; j++) clump(k, from.clone().lerp(end, j / 3), 0.11, j % 2 ? 'leaf' : 'treeB', { seed: i + j, squash: 0.6, detail: 0, collide: false });
        clump(k, end, 0.07, 'petal', { seed: i, detail: 0, collide: false });
      }
    });
    { const a = T.boughs[1].at(0.5), b = T.boughs[3].at(0.5); prop('fairy_lights', a.clone().lerp(b, 0.5).add(V(0, 0.2, 0)), { yaw: yawFor(Y, b.clone().sub(a)), scale: a.distanceTo(b) / 2.6, collide: false }); }
    { const a = T.boughs[4].at(0.45), b = T.boughs[6].at(0.45); prop('bunting', a.clone().lerp(b, 0.5).add(V(0, -0.1, 0)), { yaw: yawFor(Y, b.clone().sub(a)), scale: a.distanceTo(b) / 2.6, collide: false }); }
    // shelf fungi up the trunk: toadstools growing sideways out of the bark
    for (const [s, a, sc] of [[0.3, 0.6, 0.6], [0.34, 1.1, 0.42], [0.52, 4.0, 0.62], [0.57, 4.5, 0.42], [0.76, 2.2, 0.5], [0.16, 3.2, 0.7], [0.66, 0.2, 0.45], [0.9, 5.4, 0.45]]) {
      const c = T.trunk.at(s), t = T.trunk.tan(s), out = new THREE.Vector3().crossVectors(t, V(1, 0, 0)).normalize().applyAxisAngle(t, a), p = c.addScaledVector(out, T.trunk.radius(s) * 0.86);
      if (clear(p, 0.8)) prop('mushroom', p, { up: out.clone().addScaledVector(Y, 0.5).normalize(), scale: sc, yaw: s * 9 });
    }
  }

  /* ================= 樹腳 — the meadow at the foot of the tree ================================== */
  {
    const L = T.meadow;
    put(L, 'cottage', 205, 2.7, { scale: 0.62, yaw: 3.4 });
    put(L, 'toadstool_house', 75, 2.8, { scale: 0.52, yaw: 1.0 });
    put(L, 'toadstool_house', 330, 2.9, { scale: 0.42, yaw: 5.2, mats: { paintRed: 'paintTeal' } });
    put(L, 'elder_tree', 150, 3.0, { scale: 0.55, yaw: 2.2, room: 1.7 });
    put(L, 'well', 262, 2.9, { scale: 0.5, yaw: 1 });
    put(L, 'street_lamp', 20, 3.0, { scale: 0.7 }); put(L, 'street_lamp', 180, 3.3, { scale: 0.7 }); put(L, 'street_lamp', 292, 2.5, { scale: 0.7 });
    put(L, 'signpost', 110, 2.3, { yaw: 2.2, scale: 0.9 });
    [[48, 3.2], [58, 3.35], [232, 3.3], [243, 3.45]].forEach(([a, d]) => put(L, 'fence', a, d, { yaw: yawFor(L.u, turned(L, a + 90)), scale: 0.8, room: 0.5 }));
    // a ring of toadstools round the roots
    for (let i = 0; i < 9; i++) put(L, 'mushroom', i * 40 + 10, 1.95 + (i % 2) * 0.3, { scale: 0.22 + (i % 3) * 0.08, yaw: i, room: 0.5 });
    flowers(L, 22, 5, ['petal', 'paintYellow', 'paintCream', 'paintRed'], 3);
    // a drum to fall onto from the crown ring, wherever the meadow is still free
    for (let a2 = 0; a2 < 360; a2 += 15) { const c = L.on(a2, 3.3, 0.35); if (clear(c, 0.95) && !stood.some((q) => q.p.distanceTo(c) < q.foot + 0.75)) { trampoline(k, { center: c, radius: 0.7 }); strut(c.clone().add(V(0, -0.3, 0)), L.on(a2, 3.3, 0), 0.12, 'woodDark'); stood.push({ p: c, foot: 0.8 }); break; } }
    // icicles round the underside of the rim: winter is just below
    for (let i = 0; i < 26; i++) { const a = i * 13.8; spike(k, L.on(a, L.r * 0.97, -0.5), V(0, -1, 0), 0.35 + rnd(i, 11) * 0.7, 0.08, 'ice'); }
  }

  /* ================= 冬 — under the meadow, upside down ========================================== */
  {
    const L = T.winter;
    put(L, 'frost_belfry', 40, 0.9, { scale: 0.78, yaw: 3.6, sink: 0.04 });
    [[95, 2.6, 0.8], [114, 3.0, 0.65], [330, 2.8, 0.8], [348, 2.3, 0.6], [205, 3.0, 0.75], [222, 2.5, 0.55], [150, 3.1, 0.6]].forEach(([a, d, sc], i) => put(L, 'pine_snow', a, d, { scale: sc, yaw: i }));
    put(L, 'snowman', 170, 1.6, { scale: 0.6, yaw: 1 }); put(L, 'snowman', 285, 1.9, { scale: 0.45, yaw: 4 });
    put(L, 'cottage', 250, 2.3, { scale: 0.58, yaw: 2.5, mats: { thatch: 'snow', plaster: 'paintNavy', paintRed: 'paintTeal' } });
    put(L, 'cottage', 5, 2.9, { scale: 0.5, yaw: 5.2, mats: { thatch: 'snow', plaster: 'slate' } });
    put(L, 'street_lamp', 190, 2.3, { scale: 0.7 }); put(L, 'street_lamp', 70, 2.7, { scale: 0.7 }); put(L, 'street_lamp', 300, 1.1, { scale: 0.7 });
    for (const [a, d, sc] of [[60, 3.2, 0.7], [240, 3.2, 0.6], [130, 1.0, 0.5], [315, 3.3, 0.5]]) put(L, 'crystal', a, d, { scale: sc, yaw: a, room: 0.6 });
    // stars caught in the bare branches
    T.roots.forEach((r, i) => { const p = r.at(0.92); if (clear(p, 0.9)) prop('star', p.clone().add(V(0, 0.7, 0)), { up: L.u, scale: 0.7, yaw: i, collide: false }); });
  }

  /* ================= 秋 — the harvest, north-west ================================================ */
  {
    const L = T.autumn, amber = [{ treeB: 'leafAmber' }, { treeB: 'paintRed' }, { treeB: 'paintYellow' }];
    put(L, 'harvest_mill', 90, 0.3, { scale: 0.58, yaw: 2.4, sink: 0.02 });
    put(L, 'maple_tree', 265, 0.9, { scale: 0.5, yaw: 1.0 });
    put(L, 'maple_tree', 60, 2.6, { scale: 0.42, yaw: 4.0 });
    [300, 326, 352, 62, 88].forEach((a, i) => put(L, 'tree_round', a, 2.35 - (i % 2) * 0.35, { scale: 0.6 + (i % 3) * 0.1, mats: amber[i % 3], yaw: i }));
    put(L, 'well', 100, 1.5, { scale: 0.45, yaw: 0.6 });
    put(L, 'signpost', 250, 2.2, { yaw: 2, scale: 0.8 });
    put(L, 'street_lamp', 45, 1.2, { scale: 0.65 }); put(L, 'street_lamp', 215, 2.3, { scale: 0.65 });
    for (const [a, d] of [[120, 2.5], [134, 2.6], [190, 2.6]]) put(L, 'fence', a, d, { yaw: yawFor(L.u, turned(L, a + 90)), scale: 0.75, room: 0.5 });
    for (let i = 0; i < 8; i++) { const p = L.on(200 + i * 19, 1.2 + rnd(i, 3) * 1.2, 0.1); if (clear(p, 0.5)) clump(k, p, 0.11 + rnd(i, 4) * 0.07, 'leafAmber', { seed: i, squash: 0.75, detail: 1, lumps: 0.1, up: L.u, collide: false }); }
    for (let i = 0; i < 3; i++) { const p = L.on(275 + i * 13, 1.4 + (i % 2) * 0.4, 0.15); if (clear(p, 0.5)) add(at(new THREE.CylinderGeometry(0.17, 0.17, 0.3, 12).rotateZ(Math.PI / 2), p, L.u, i), 'thatch'); }
  }

  /* ================= 春 — the garden, south-east and lower ======================================= */
  {
    const L = T.spring, pink = [{ treeB: 'petal' }, { treeB: 'paintPink' }, { treeB: 'paintCream' }];
    put(L, 'blossom_tree', 180, 0.4, { scale: 0.66, yaw: 0.5, sink: 0.03 });
    put(L, 'blossom_tree', 135, 2.65, { scale: 0.4, yaw: 3.0, sink: 0.03 });
    put(L, 'fountain', 60, 1.5, { scale: 0.5 });
    put(L, 'cottage', 310, 2.0, { scale: 0.55, yaw: 1.4, mats: { thatch: 'paintPink', paintRed: 'paintTeal' } });
    [250, 272, 150, 172, 110].forEach((a, i) => put(L, 'tree_round', a, 2.4 - (i % 2) * 0.3, { scale: 0.55 + (i % 3) * 0.1, mats: pink[i % 3], yaw: i * 2 }));
    put(L, 'street_lamp', 95, 2.4, { scale: 0.65 }); put(L, 'street_lamp', 235, 1.9, { scale: 0.65 });
    // a brook across the lawn and a humpback bridge over it
    const brook = Array.from({ length: 9 }, (_, i) => { const t = i / 8, d = 2.6 * Math.abs(1 - 2 * t); return L.on((t < 0.5 ? 20 : 200) + Math.sin(t * 7) * 9 + 120, Math.max(0.02, d), 0.03); });
    for (let i = 0; i < brook.length - 1; i++) { const a = brook[i], b = brook[i + 1], d = b.clone().sub(a); add(at(new THREE.BoxGeometry(0.36, 0.05, d.length() + 0.1), a.clone().add(b).multiplyScalar(0.5).addScaledVector(L.u, 0.06), L.u, yawFor(L.u, d.clone().cross(L.u))), 'seaLight', false); }
    put(L, 'stone_bridge', 0, 0.05, { scale: 0.42, yaw: yawFor(L.u, turned(L, 50)), room: 0.8 });
    flowers(L, 18, 30, ['petal', 'paintYellow', 'paintCream', 'paintPink'], 7);
    for (const [a, d, h] of [[350, 2.2, 1.1], [45, 2.6, 1.3], [225, 2.6, 1.2], [315, 2.7, 1.4], [0, 0.2, 2.6]]) {
      const b = L.on(a, d, h);
      if (b.length() < 9.6 && clear(b, 1.25) && clear(b.clone().add(V(0, 1.0, 0)), 1.1)) { prop('balloon', b, { up: Y, scale: 0.5, yaw: 1 }); strut(b, L.on(a, d, 0), 0.012, 'rope', false); break; }
    }
  }

  /* ================= 工坊 — the clockmakers' works, on its side to the north-east =================== */
  {
    const L = T.works;
    put(L, 'clock_tower', 200, 1.2, { scale: 0.45, yaw: 1.2, room: 0.9 });
    // gears and the music drum go wherever the routes have left room for them
    const room = (r, lift) => { for (const d of [1.3, 1.0, 1.6, 0.6]) for (let a = 0; a < 360; a += 20) { const p = L.on(a, d, lift); if (clear(p, r)) return { p, a, d }; } return null; };
    const g = room(1.0, 0.1);
    if (g) gearTrain(k, { start: g.p, dir: turned(L, g.a + 90), up: L.u, count: 2, speed: 0.3, scale: 0.45, name: 'works-gears' });
    const dr = room(0.95, 0.55);
    if (dr && (!g || dr.p.distanceTo(g.p) > 1.3)) { const ax = turned(L, dr.a + 90); musicDrum(k, { center: dr.p, axis: ax, up: L.u, length: 0.9, radius: 0.3, name: 'works-drum' }); for (const sg of [-1, 1]) strut(dr.p.clone().addScaledVector(ax, sg * 0.6), dr.p.clone().addScaledVector(ax, sg * 0.6).addScaledVector(L.u, -0.6), 0.04, 'brass'); }
    put(L, 'street_lamp', 280, 1.8, { scale: 0.65 }); put(L, 'bell', 250, 0.8, { scale: 0.8 });
    // the key that winds the year, set in the trunk
    windupKey(k, { pos: T.trunk.at(0.5).add(V(1.15, 0, 0.2)), axis: V(1, 0.15, 0.2), size: 1.5, speed: 0.4, name: 'year-key' });
  }

  /* ================= 碼頭 — the dock in the south-west, where the seasons' travellers tie up ========= */
  {
    const L = T.dock;
    put(L, 'signpost', 40, 1.2, { yaw: 1, scale: 0.8 }); put(L, 'street_lamp', 200, 1.3, { scale: 0.65 });
    put(L, 'tree_round', 120, 1.3, { scale: 0.6 }); put(L, 'tree_pine', 300, 1.4, { scale: 0.65 });
    // an airship moored off the dock, wherever the sky is free of track
    for (const o of [V(-2.3, 0.4, 2.6), V(-2.6, -1.4, 1.2), V(-0.6, -1.6, 3.4), V(-2.9, 0.6, -0.6), V(0.8, 0.9, 3.2)]) {
      const a = L.c.clone().add(o);
      if (a.length() < 10.2 && clear(a, 1.5)) { prop('airship', a, { yaw: 2.3, scale: 0.55 }); strut(a.clone().add(V(0, 0.2, 0)), L.on(180, 1.0, 0), 0.012, 'rope', false); break; }
    }
  }

  /* ================= the six islets =============================================================== */
  {
    const [pond, mill, lamp, snow, shelf, spring] = T.islets;
    add(at(new THREE.CylinderGeometry(0.62, 0.62, 0.05, 20), pond.on(0, 0.2, 0.05), pond.u), 'seaLight', false);
    put(pond, 'tree_round', 100, 1.0, { scale: 0.6 }); put(pond, 'tree_pine', 220, 1.0, { scale: 0.6 }); put(pond, 'mushroom', 330, 0.95, { scale: 0.35 }); put(pond, 'well', 160, 1.0, { scale: 0.4 });
    const wm = put(mill, 'windmill', 0, 0.8, { scale: 0.6, yaw: yawFor(mill.u, V(0, 0, 1)), mats: { paintRed: 'leafAmber' } });
    put(mill, 'tree_round', 140, 1.0, { scale: 0.5, mats: { treeB: 'paintYellow' } }); put(mill, 'fence', 250, 1.1, { scale: 0.7 });
    void wm;
    put(lamp, 'street_lamp', 80, 0.6, { scale: 0.7 }); put(lamp, 'street_lamp', 260, 0.6, { scale: 0.7 }); put(lamp, 'candle', 0, 0.1, { scale: 0.8 }); put(lamp, 'tree_ply', 170, 0.95, { scale: 0.55 });
    put(snow, 'pine_snow', 60, 0.7, { scale: 0.7 }); put(snow, 'pine_snow', 200, 0.8, { scale: 0.5 }); put(snow, 'snowman', 310, 0.6, { scale: 0.5, yaw: 2 });
    put(shelf, 'crystal', 0, 0.2, { scale: 0.9 }); put(shelf, 'crystal', 130, 0.9, { scale: 0.55, yaw: 2 }); put(shelf, 'pine_snow', 250, 0.9, { scale: 0.55 }); put(shelf, 'rock_spire', 30, 0.95, { scale: 0.3, mats: { moss: 'snow' } });
    put(spring, 'cottage', 200, 0.5, { scale: 0.5, yaw: 1, mats: { thatch: 'slate' } }); put(spring, 'street_lamp', 60, 0.9, { scale: 0.6 });
    { const c = spring.on(20, 0.9, 0.75), ax = turned(spring, 110); if (clear(c, 1.1)) { k.mover({ name: 'springhouse-wheel', pivot: c, axis: ax, speed: 0.7 }, () => prop('waterwheel', V(0, 0, 0).addScaledVector(ax, -0.2), { up: ax, scale: 0.55 })); strut(c, spring.on(20, 0.9, 0), 0.05, 'woodDark'); } }
  }

  /* ================= the sky between the worlds ===================================================== */
  armillary(k, { center: SUN, radius: 1.05, name: 'sun' });
  strut(SUN.clone().add(V(0, 1.1, 0)), T.boughs[3].at(0.95), 0.02, 'brass', false);
  // the moon and a turning ring of stars on the far side of the tree from the sun, and lower
  { const c = V(-5.6, -2.2, -4.4); if (clear(c, 1.8)) { mobile(k, { center: c, radius: 1.2, arms: 5, drop: 0.6, props: ['star', 'star', 'moon', 'star', 'bell'], scale: 0.6, size: 0.67, speed: 0.2, name: 'night-mobile' }); strut(c, T.autumn.on(200, 1.5, -1.2), 0.02, 'brass', false); } }
  for (const [x, y, z, yaw, sc] of [[-6.6, 6.4, 4.6, 0.6, 0.9], [-8.6, 4.4, -0.6, 1.4, 0.8], [6.4, 6.6, 4.4, -0.8, 0.9], [8.3, 2.6, -4.2, 2.2, 0.8], [4.4, 0.6, 8.6, 0.3, 0.7], [-3.2, 1.4, 9.2, -0.4, 0.7], [2.0, 2.8, -9.2, 3.0, 0.8]]) if (clear(V(x, y, z), 1.1)) prop('cloud', V(x, y, z), { yaw, scale: sc, collide: false });
  void HUB; void limb;
}
