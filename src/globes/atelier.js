// Globe: 工坊樣品球 — the sampler for everything added to the shared libraries after the first
// four globes: the new track parts, sections, surfaces and skins (src/kit.js), the new mechanisms
// (src/library/mechanisms.js) and the 'atelier' prop pack (src/library/assets.js).
//
// It is a SAMPLE BOARD, not a finished world: each run shows one or two new things so they can
// be seen, played and verified. A real globe is designed scenery-first (see the skill's
// globe-standards.md); do not copy this layout as a template.
//
//   鐘樓廣場 ──石板路(stone · wave · dip)──▶ 音樂盒 ──琴鍵(keys · musicbox)──▶ 蘑菇村(turnstile)
//      ▲  ▲                                                                  │
//      │  └──(brass · cage · felt · pendulums)── lift ◀──ice── 冰湖 ◀──(vine · sCurve · halfpipe · vee)
//      │
//      ├──吊橋(slats · helix)──▶ 巫師塔 ──(ivory · beam · wall)──▶ 氣球碼頭（牆上）
//      │                           └──(brass · seesaw · rubber · switchback)──▶ 旋轉木馬 ──▶ 鐘樓廣場
//      └──(trapdoor)──▶ 彈跳鼓
import * as THREE from 'three';
import { V, Y, createBuilder, at } from '../kit.js';
import { lift, archOver, yawFor, seesaw, turnstile, trapdoor, trampoline, carousel, gearTrain, pendulumRow, musicDrum, windupKey, mobile } from '../library/mechanisms.js';

function build() {
  const k = createBuilder({ supports: false });
  const { prop, strut, exitPoint, track, padAt, padAhead, padAngle, padDir, padPoint, fromPad, arrive } = k;
  const X = V(1, 0, 0);
  // a rib ties a track to the shell. They are planted last, and one that would run through another
  // track on its way to the glass is left out (the same rule the kit's own supports follow).
  const ribs = [], rib = (f, mat = 'brass') => ribs.push({ f, mat });
  const plantRibs = () => {
    const frames = k.tracks.flatMap((t) => t.frames), seg = new THREE.Line3(), near = new THREE.Vector3();
    for (const { f, mat } of ribs) {
      const a = f.pos.clone().addScaledVector(f.up, -0.1), b = exitPoint(a, f.up.clone().negate());
      seg.set(a.clone().lerp(b, Math.min(0.9, 0.9 / a.distanceTo(b))), b);
      if (!frames.some((g) => seg.closestPointToPoint(g.pos, true, near).distanceTo(g.pos) < 0.7)) strut(a, b, 0.035, mat);
    }
  };
  const mid = (tr, s = 0.5) => tr.frames[Math.floor(tr.frames.length * s)];
  // a station stands on a wild crag instead of the round island
  const station = (pd, s = 1.2) => { prop('floating_rock', pd.c.clone().addScaledVector(pd.u, -0.1), { up: pd.u, scale: pd.r * s, yaw: pd.c.x + pd.c.z }); return pd; };
  // bring a track round onto a terrace's rim: straighten out, then curve in and arrive square
  const closeTo = (tr, pd) => {
    const out = tr.p.clone().sub(pd.c); out.addScaledVector(pd.u, -out.dot(pd.u)).normalize();
    const rim = pd.c.clone().addScaledVector(out, pd.r);
    tr.spline([{ p: tr.p.clone().addScaledVector(tr.t, 0.7) }, { p: rim.clone().addScaledVector(out, 0.9), up: pd.u }, { p: rim, up: pd.u }]);
    return arrive(tr, pd);
  };
  // the next free place on a terrace's rim: the middle of the widest stretch with no track and nothing
  // placed yet. `inward` instead takes the free stretch that faces the middle of the globe (for
  // anything that sticks out beyond the rim and must stay inside the glass).
  const spot = (pd, inward = false) => {
    const taken = [...pd.exits, ...(pd.used ||= [])].map((a) => ((a % 360) + 360) % 360).sort((a, b) => a - b);
    const gaps = taken.map((a, i) => { const next = i + 1 < taken.length ? taken[i + 1] : taken[0] + 360; return { mid: a + (next - a) / 2, width: next - a }; });
    const home = pd.c.clone().negate().normalize(), roomy = gaps.filter((g) => g.width >= 80);
    const best = inward && roomy.length ? roomy.reduce((p, g) => (padDir(pd, g.mid).dot(home) > padDir(pd, p.mid).dot(home) ? g : p)) : gaps.reduce((p, g) => (g.width > p.width ? g : p));
    pd.used.push(best.mid);
    return best.mid;
  };
  // scenery on its own crag next to a terrace. The crag hangs a long way down, so the direction is
  // searched: clear of every way in and out, inside the glass, and as far from every track as possible.
  const outcrop = (pd, dist, size, dress) => {
    const taken = [...pd.exits, ...(pd.used ||= [])], apart = (a, b) => Math.abs(((a - b + 540) % 360) - 180);
    const frames = k.tracks.flatMap((t) => t.frames), seg = new THREE.Line3(), near = new THREE.Vector3();
    let angle = null, room = size + 0.45;
    for (let a = 0; a < 360; a += 10) {
      if (taken.some((t) => apart(a, t) < 40)) continue;
      const c = padPoint(pd, a, pd.r + dist);
      if (c.length() + size > 11.2) continue;
      seg.set(c.clone().addScaledVector(pd.u, 2.5), c.clone().addScaledVector(pd.u, -2.4 * size));
      const clear = frames.reduce((m, f) => Math.min(m, seg.closestPointToPoint(f.pos, true, near).distanceTo(f.pos)), Infinity);
      if (clear > room) { room = clear; angle = a; }
    }
    if (angle == null) { console.warn(`atelier: no room for an outcrop of size ${size} by the terrace at`, pd.c.toArray().map((v) => v.toFixed(1)).join(', ')); return null; }
    pd.used.push(angle);
    const c = padPoint(pd, angle, pd.r + dist);
    prop('floating_rock', c.clone(), { up: pd.u, scale: size, yaw: angle });
    dress((name, dx, dz, o = {}) => prop(name, c.clone().add(V(dx, 0, dz)), { up: pd.u, ...o }));
    strut(c.clone().addScaledVector(pd.u, -0.4), pd.c.clone().addScaledVector(pd.u, -0.3), 0.05, 'bark');   // a root ties it to the station
    return c;
  };

  /* ---- 鐘樓廣場: the hub ---------------------------------------------------------------------- */
  // (the town clock stands in the middle of it; the marble goes round)
  const square = station(padAt(V(-0.6, -0.5, 0.2), Y, X, 1.9, { island: false }), 1.1);
  prop('clock_tower', square.c, { scale: 0.8, yaw: 0.5 });

  // 1. 石板路: cobbles, a weave, a slope and a hollow → 音樂盒
  const cobbles = fromPad(square, 0, 'cobbles', { skin: 'stone' }).straight(1.0).wave(1.8, 2, 0.4).ramp(1.6, 20).turn(-90, 0.9).dip(1.8, 0.3).straight(0.5);
  const music = station(padAhead(cobbles, 1.2, { island: false }));
  archOver(k, cobbles.frames[4], { name: 'gate_arch', sink: 0.02 });
  rib(mid(cobbles, 0.55), 'stoneDark');

  // 2. 琴鍵: xylophone keys, then the music-box skin under a humpback bridge → 蘑菇村
  const keysRun = fromPad(music, -90, 'keys', { skin: 'musicbox' }).straight(0.3).ramp(2.0, 12).keys(2.2).straight(0.5).turn(90, 1.0).straight(1.4);
  const village = station(padAhead(keysRun, 1.4, { island: false }));
  archOver(k, keysRun.frames[keysRun.frames.length - 5], { name: 'stone_bridge', sink: 0.06 });
  turnstile(k, { center: village.c, radius: 0.72 });
  rib(mid(keysRun, 0.45));

  // 3. 藤蔓: a living branch that shifts lanes, a half-pipe, a plywood V, and down → 冰湖
  const vines = fromPad(village, -90, 'vines', { skin: 'vine' }).straight(0.6).turn(-70, 1.6).sCurve(2.0, 0.7).halfpipe(2.2).vee(1.6).ramp(2.2, 16);
  const lake = station(padAhead(vines, 1.2, { island: false }));
  rib(mid(vines, 0.5), 'bark');

  // 4. 冰: a slick run to the lift, which carries the marble back up to the level of the square
  const inn = V(0.6, 0, -0.8), ICE = 2.0;
  const ice = fromPad(lake, padAngle(lake, inn), 'ice').surface('ice', ICE);
  const hoist = lift(k, { foot: ice.p.clone().addScaledVector(inn, 0.8), height: square.c.y - lake.c.y, inward: inn, name: 'hoist' });

  // 5. 發條道: a wire cage, round a corner under three pendulums, a stretch of felt, home
  const works = track('clockwork', hoist.landing, inn, Y, { skin: 'brass' }).straight(0.3).cage(1.6).straight(0.3).turn(-90, 1.2).surface('felt', 1.6);
  {
    const f = mid(works, 0.62), over = f.pos.clone().addScaledVector(Y, 2.3);
    // (the bobs clear the marble by a whisker: something to flinch at, not something to wait for)
    pendulumRow(k, { from: over.clone().addScaledVector(f.tan, -1.2), to: over.clone().addScaledVector(f.tan, 1.2), count: 3, length: 1.5, amplitude: 0.6, name: 'pendulums' });
    strut(over.clone().addScaledVector(f.tan, 1.2), exitPoint(over.clone().addScaledVector(f.tan, 1.2), Y), 0.03, 'brass');
  }
  closeTo(works, square);
  rib(mid(works, 0.3));

  // 6. 吊橋: a sagging rope bridge, then a spiral up → 巫師塔
  const bridge = fromPad(square, -60, 'ropebridge', { skin: 'slats' }).straight(0.6).dip(1.8, 0.2).straight(0.6).style({ lip: 0.26 }).helix(360, 1.5, 2.6).style({ lip: 0.2 }).straight(0.6);
  const tower = padAhead(bridge, 1.2, { island: false });                   // (no crag under this one: the spiral comes up right beside it)
  rib(mid(bridge, 0.6), 'rope');
  rib({ pos: tower.c, up: Y }, 'brass');

  // 7. 象牙道: a balance beam, then up the wall → 氣球碼頭 (a terrace standing on the glass side)
  const ivory = fromPad(tower, 60, 'ivory', { skin: 'ivory' }).straight(0.3).beam(0.8).straight(0.2).pitch(90, 2.0).straight(0.4);
  const dock = padAhead(ivory, 1.0, { island: false, pillar: true });

  // 8. 蹺蹺板: brass track to a seesaw, a rubber landing, a zig-zag down → 旋轉木馬
  const teeterIn = fromPad(tower, -135, 'teeter-in', { skin: 'brass' }).straight(1.2);
  const tee = seesaw(k, { pivot: teeterIn.p.clone().addScaledVector(teeterIn.t, 1.2 * Math.cos((13 * Math.PI) / 180) + 0.06).addScaledVector(Y, 1.2 * Math.sin((13 * Math.PI) / 180)), dir: teeterIn.t });
  const zig = track('zigzag', tee.exit, tee.dir, Y, { color: 'paintTeal' }).surface('rubber', 1.0).switchback(3, 1.3, 12, 0.6).straight(0.3);
  zig.oneWay = true;                                                        // you cannot get back onto the seesaw from its far end
  const CR = 1.3, ride = carousel(k, { center: zig.p.clone().addScaledVector(zig.t, CR + 0.06), radius: CR });
  rib(mid(zig, 0.5));

  // 9. 回家的滑道: off the roundabout, two slopes with a hollow between → 鐘樓廣場
  // (it leaves northwards first, to stay clear of the zig-zag overhead, then swings round for home)
  const north = V(0, 0, -1);
  const slide = track('slide', ride.edge(north), north, Y, { color: 'paintPink', lip: 0.24 }).straight(0.3).ramp(1.4, 21).turn(-60, 1.6).ramp(1.0, 21);
  closeTo(slide, square);
  rib(mid(slide, 0.4));

  // 10. 活板門: a spur that gives way → the drum below throws the marble on towards the lake
  const spur = fromPad(square, 150, 'spur', { color: 'paintYellow' }).straight(1.0);
  const door = trapdoor(k, { pivot: spur.p.clone().addScaledVector(spur.t, 0.04), dir: spur.t });
  trampoline(k, { center: door.end.clone().addScaledVector(spur.t, 0.5).setY(lake.c.y - 1.1), radius: 1.0 });

  /* ---- clockwork and music-box pieces ---------------------------------------------------------- */
  {
    // the music box works stand beside 音樂盒: the pinned drum, its comb, a key, a dancer
    const c = padPoint(music, -45, music.r + 1.5).add(V(0, 0.75, 0)), ax = X.clone();
    const drum = musicDrum(k, { center: c, axis: ax, length: 2.0, radius: 0.5 });
    windupKey(k, { pos: c.clone().addScaledVector(ax, 1.25), axis: ax, size: 0.8 });
    strut(c.clone().addScaledVector(ax, -1.2), music.c.clone().add(V(0, -0.3, 0)), 0.05, 'brass');
    strut(drum.combEnd, music.c.clone().add(V(0, -0.3, 0)), 0.05, 'brass');
  }
  gearTrain(k, { start: square.c.clone().add(V(0.6, -1.9, -0.4)), dir: V(1, 0, 0.35), count: 3, speed: 0.25, scale: 0.8, name: 'undergears' });
  strut(square.c.clone().add(V(0.6, -1.9, -0.4)), square.c.clone().add(V(0.3, -0.9, -0.2)), 0.06, 'woodDark');
  // a mobile turning under the crown of the glass: stars, a lantern, a bell
  mobile(k, { center: V(0.5, 9.2, -0.5), radius: 2.4, arms: 6, drop: 1.0, props: ['star', 'paper_lantern', 'star', 'bell', 'star', 'paper_lantern'], size: 0.65, name: 'mobile' });
  strut(V(0.5, 9.2, -0.5), exitPoint(V(0.5, 9.2, -0.5), Y), 0.02, 'brass');

  /* ---- the pack, placed (every spot is chosen clear of the ways in and out) ------------------------ */
  const onRim = (pd, name, inset, o = {}) => prop(name, padPoint(pd, spot(pd), pd.r - inset), { up: pd.u, ...o });
  outcrop(square, 1.3, 1.1, (put) => { put('fountain', 0, 0, { scale: 0.7 }); put('fence', 0.1, 0.9, { scale: 0.8, yaw: 0.2 }); });
  onRim(square, 'street_lamp', 0.3, { scale: 0.8 });
  onRim(square, 'signpost', 0.3, { yaw: 0.7 });
  outcrop(village, 1.3, 1.5, (put) => { put('toadstool_house', -0.2, 0.1, { scale: 0.8, yaw: 2.2 }); put('well', 0.9, -0.6, { scale: 0.6 }); put('mushroom', 0.8, 0.7, { scale: 0.5 }); });
  outcrop(village, 1.2, 1.25, (put) => { put('cottage', 0, 0, { scale: 0.85, yaw: -0.6 }); put('fence', 0.2, 0.95, { scale: 0.8 }); });
  outcrop(lake, 1.2, 1.3, (put) => { put('pine_snow', -0.4, 0.2); put('pine_snow', 0.5, -0.4, { scale: 0.75, yaw: 1 }); put('snowman', 0.35, 0.55, { scale: 0.8, yaw: -1.2 }); put('rock_spire', -0.3, -0.75, { scale: 0.5 }); });
  onRim(lake, 'snowman', 0.4, { scale: 0.5, yaw: 2 });
  outcrop(tower, 1.4, 1.4, (put) => { put('wizard_tower', 0, 0, { scale: 0.8, yaw: -0.5 }); put('street_lamp', 0.9, 0.6, { scale: 0.8 }); });
  onRim(tower, 'carousel_horse', 0.35, { scale: 0.7, yaw: 2.4 });
  onRim(music, 'ballerina', 0.42, { yaw: 1.0 });
  // a pair of lamps with a string of lights between them
  {
    const a = spot(music), c = padPoint(music, a, music.r - 0.45), side = padDir(music, a + 90);
    for (const sg of [-1, 1]) prop('street_lamp', c.clone().addScaledVector(side, sg * 0.8), { scale: 0.8 });
    prop('fairy_lights', c.clone().add(V(0, 0.93, 0)), { yaw: yawFor(Y, side), scale: 0.62, collide: false });
    prop('candle', c.clone().addScaledVector(padDir(music, a), -0.3));
  }
  prop('bunting', dock.c.clone().addScaledVector(dock.u, 1.3), { up: dock.u, yaw: 0.4, collide: false });
  // moored off the dock: a balloon and an airship, each tied down by one line
  {
    const b = dock.c.clone().addScaledVector(dock.u, 3.0).add(V(0, -1.2, -1.6));
    prop('balloon', b, { scale: 0.8, yaw: 0.6 });
    strut(b.clone().add(V(0, 0.1, 0)), dock.c.clone().addScaledVector(dock.u, 0.05), 0.012, 'rope', false);
    const a = V(-4.6, 6.3, -3.4);
    prop('airship', a, { yaw: 0.9, scale: 0.9 });
    strut(a.clone().add(V(0, 1.9, 0)), exitPoint(a.clone().add(V(0, 1.9, 0)), Y), 0.012, 'rope', false);
  }
  k.add(at(new THREE.SphereGeometry(0.12, 12, 8), hoist.top.clone().add(V(0, 1.45, 0))), 'gold', false);

  /* ---- lanterns (the first is where you start) ---------------------------------------------------- */
  { const a = spot(square); k.lantern('鐘樓廣場', padPoint(square, a, square.r - 0.28), Y, padPoint(square, a, 1.35)); }   // (the middle of this terrace is taken by the clock)
  for (const [name, pd] of [['音樂盒', music], ['蘑菇村', village], ['冰湖', lake], ['巫師塔', tower], ['氣球碼頭', dock]]) k.lantern(name, padPoint(pd, spot(pd), pd.r - 0.28), pd.u, pd.c);

  plantRibs();
  return k.finish();
}

export default { id: 'atelier', name: '工坊樣品球', blurb: '新零件的樣品架：石板、黃銅、吊橋、象牙、音樂盒、藤蔓軌道；冰、絨布、橡膠表面；蹺蹺板、旋轉木馬、活板門與新素材。', build };
