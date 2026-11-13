// 年輪 — the routes. Laid AFTER the scenery (tree.js): every run goes from somewhere in the scene
// to somewhere else in it — up the trunk, round the crown, out along a bough to a season, over
// the rim of the meadow into winter.
//
// Levels (each is a few runs with its own skin and its own trick):
//   年輪梯   the trunk spiral: 樹腳 → 樹洞 → 東枝台 → 樹冠北台            vine, then bark-brown wood
//   樹冠環   a ring under the boughs, and the rope walk to the top deck      music box / keys, slats
//   候鳥線   top deck → the dock → autumn                                    slide, rope bridge, seesaw
//   秋收路   round the harvest land, down to the pond, along the ridge       cobbles, brass, cage, pendulums
//   初雪     the works → first snow → spring                                 ice, vee, living vine
//   花園     round the garden, up to the lamplighter, down to the meadow     ivory, beam, xylophone keys
//   翻面     over the rim of the meadow into winter, and winter's own roads  the flip; ice, crystal
import * as THREE from 'three';
import { V, Y, DEG } from '../../kit.js';
import { turnstile, pendulumRow, flap } from '../../library/mechanisms.js';
import { SUN } from './tree.js';

export function buildTracks(k, T) {
  const P = {}, R = {};
  const rel = (L, ang, dist, lift = 0) => L.c.clone().addScaledVector(L.e1, Math.cos(ang * DEG) * dist).addScaledVector(L.e2, Math.sin(ang * DEG) * dist).addScaledVector(L.u, lift);
  // a terrace on a land, on a short stone plinth (the land's own surface is lumpy; the terrace is true)
  const onLand = (name, L, ang, dist, r, lift = 0.62) => {
    const c = rel(L, ang, dist, lift), pd = k.padAt(c, L.u, L.e1, r, { island: false });
    k.strut(c.clone().addScaledVector(L.u, -0.1), c.clone().addScaledVector(L.u, -lift - 0.25), r * 0.5, 'stone');
    return (P[name] = pd);
  };
  // a deck on the tree itself: a terrace with a bracket back to the trunk
  const deck = (name, c, r, brace = true) => {
    const pd = k.padAt(c, Y, V(1, 0, 0), r, { island: false });
    if (brace) { const s = Math.min(1, Math.max(0, (c.y + 6.5) / 11.2)), to = T.trunk.at(s).add(V(0, -1.0, 0)); k.strut(c.clone().add(V(0, -0.1, 0)), to, 0.09, 'bark'); }
    return (P[name] = pd);
  };
  // points on a circle round the axis of the tree (azimuth in degrees, growing from east through south)
  const round = (r0, r1, a0, a1, y0, y1, step = 36, cx = 0, cz = 0) => {
    const n = Math.max(1, Math.round(Math.abs(a1 - a0) / step)), out = [];
    for (let i = 0; i <= n; i++) { const f = i / n, a = (a0 + (a1 - a0) * f) * DEG, r = r0 + (r1 - r0) * f; out.push({ p: V(cx + Math.cos(a) * r, y0 + (y1 - y0) * f, cz + Math.sin(a) * r), up: Y.clone() }); }
    return out;
  };
  // one run: leave terrace A (heading for the first waypoint), do `pre` (kit parts, in A's own plane),
  // curl up or down towards where it is going (a kit pitch: the wall-climb), pass through the
  // waypoints, curl back into B's plane and settle square onto its rim.
  const CURL = 1.3;
  const link = (name, A, B, style, { via = [], pre = null, out = null, into = null, oneWay = false, curl = true } = {}) => {
    const pts = via.map((v) => (v.p ? { ...v } : { p: v }));
    const head = out || (pts[0] ? pts[0].p : B.c).clone().sub(A.c);
    const tr = k.fromPad(A, k.padAngle(A, head), name, { lip: 0.24, support: false, ...style });
    tr.straight(0.3);
    if (pre) pre(tr);
    // (a waypoint the kit parts have already carried the track up to, or past, is dropped: it would tie a knot)
    while (pts.length && (pts[0].p.distanceTo(tr.p) < 1.8 || pts[0].p.clone().sub(tr.p).dot(tr.t) < 0.6)) pts.shift();
    if (curl) {
      const aim = (pts[0] ? pts[0].p : B.c).clone().sub(tr.p), el = Math.asin(Math.max(-1, Math.min(1, aim.normalize().dot(tr.u)))) / DEG;
      if (Math.abs(el) > 18 && aim.length() > 0) tr.pitch(Math.max(-75, Math.min(75, el * 0.85)), CURL);
      while (pts.length && pts[0].p.distanceTo(tr.p) < 1.8) pts.shift();
    }
    const u0 = tr.u.clone(), last = pts.length ? pts[pts.length - 1].p : tr.p;
    const from = into || last.clone().sub(B.c), radial = from.addScaledVector(B.u, -from.dot(B.u)).normalize();
    const edge = B.c.clone().addScaledVector(radial, B.r), q1 = edge.clone().addScaledVector(radial, 0.4);
    // the curl into B: an arc in the plane of (radial, B.u), as far round as the track is coming in from
    const inc = q1.clone().sub(last).normalize(), elB = Math.max(-75, Math.min(75, (Math.asin(Math.max(-1, Math.min(1, inc.dot(B.u)))) / DEG) * 0.85));
    const arc = [], sg = Math.sign(elB) || 1, nA = curl && Math.abs(elB) > 18 ? Math.ceil(Math.abs(elB) / 15) : 0;
    for (let i = nA; i >= 1; i--) { const th = (Math.abs(elB) * i * DEG) / nA; arc.push({ p: q1.clone().addScaledVector(radial, CURL * Math.sin(th)).addScaledVector(B.u, -sg * CURL * (1 - Math.cos(th))), up: B.u.clone().multiplyScalar(Math.cos(th)).addScaledVector(radial, sg * Math.sin(th)) }); }
    const endP = arc.length ? arc[0].p : q1, endU = arc.length ? arc[0].up : B.u;
    const thE = arc.length ? Math.abs(elB) * DEG : 0, endT = radial.clone().multiplyScalar(-Math.cos(thE)).addScaledVector(B.u, sg * Math.sin(thE));
    while (pts.length && pts[pts.length - 1].p.distanceTo(endP) < 1.8) pts.pop();
    // a smooth curve with both ends pinned (a Hermite spline through the waypoints, sampled into knots for the kit)
    const q0 = tr.p.clone().addScaledVector(tr.t, 0.4);
    const Q = [q0, ...pts.map((v) => v.p), endP], ups = [u0, ...pts.map((v) => v.up || null), endU];
    const m = Q.map((q, i) => (i === 0 ? tr.t.clone().multiplyScalar(Math.min(3.5, Q[1].distanceTo(q))) : i === Q.length - 1 ? endT.clone().multiplyScalar(Math.min(3.5, q.distanceTo(Q[i - 1]))) : Q[i + 1].clone().sub(Q[i - 1]).multiplyScalar(0.5)));
    for (let i = 1; i < ups.length - 1; i++) if (!ups[i]) { let j = i; while (!ups[j]) j++; ups[i] = ups[i - 1].clone().lerp(ups[j], 1 / (j - i + 1)).normalize(); }
    const knots = [{ p: q0, up: u0 }];
    for (let i = 0; i < Q.length - 1; i++) {
      const steps = Math.max(3, Math.round(Q[i].distanceTo(Q[i + 1]) / 0.6));
      for (let j = 1; j <= steps; j++) {
        const t = j / steps, t2 = t * t, t3 = t2 * t;
        const p = Q[i].clone().multiplyScalar(2 * t3 - 3 * t2 + 1).addScaledVector(m[i], t3 - 2 * t2 + t).addScaledVector(Q[i + 1], -2 * t3 + 3 * t2).addScaledVector(m[i + 1], t3 - t2);
        knots.push({ p, up: ups[i].clone().lerp(ups[i + 1], t * t * (3 - 2 * t)).normalize() });
      }
    }
    if (arc.length) knots.push(...arc.slice(1), { p: q1, up: B.u });
    knots.push({ p: edge, up: B.u });
    tr.spline(knots);
    k.arrive(tr, B);
    if (oneWay) tr.oneWay = true;
    return (R[name] = tr);
  };
  const mid = (tr, s = 0.5) => tr.frames[Math.floor(tr.frames.length * s)];

  /* ---- terraces ------------------------------------------------------------------------------ */
  onLand('樹腳', T.meadow, 222, 3.0, 0.95);
  onLand('蘑菇圈', T.meadow, 20, 3.0, 0.95);
  deck('樹洞', V(Math.cos(175 * DEG) * 3.0, -1.2, Math.sin(175 * DEG) * 3.0), 1.0);
  deck('東枝台', V(Math.cos(340 * DEG) * 3.1, 1.9, Math.sin(340 * DEG) * 3.1), 1.15);
  deck('樹冠北台', V(Math.cos(240 * DEG) * 3.9, 4.4, Math.sin(240 * DEG) * 3.9), 1.1);
  deck('樹冠南台', V(Math.cos(60 * DEG) * 3.9, 4.4, Math.sin(60 * DEG) * 3.9), 1.1);
  deck('夏至台', V(-2.9, 8.0, 1.5), 1.0, false);
  onLand('碼頭', T.dock, 0, 0, 1.1, 0.5);
  onLand('秋收場', T.autumn, 0, 1.95, 0.9);
  onLand('果園口', T.autumn, 180, 1.95, 1.1);
  onLand('花園門', T.spring, 90, 1.95, 0.9);
  onLand('小溪口', T.spring, 270, 1.95, 0.9);
  onLand('鐘匠坊', T.works, 300, 1.05, 0.95, 0.62);
  const [pond, , lamp, snow, shelf, wheel] = T.islets;
  onLand('池塘', pond, 0, 0, 0.8, 0.45); onLand('點燈人', lamp, 0, 0, 0.8, 0.45); onLand('初雪', snow, 0, 0, 0.8, 0.45);
  onLand('冰架', shelf, 0, 0, 0.8, 0.45); onLand('水車屋', wheel, 0, 0, 0.8, 0.45);
  deck('日台', V(SUN.x + 1.9 * Math.cos(145 * DEG), 0.8, SUN.z + 1.9 * Math.sin(145 * DEG)), 0.9, false);
  onLand('風車', T.islets[1], 180, 0.55, 0.75, 0.6);
  const ringOn = (L, a0, a1, d = 2.0) => { const n = Math.round(Math.abs(a1 - a0) / 40), o = []; for (let i = 1; i < n; i++) o.push(rel(L, a0 + ((a1 - a0) * i) / n, d, 0.62)); return o; };
  const tang = (L, ang) => L.e1.clone().multiplyScalar(Math.cos(ang * DEG)).addScaledVector(L.e2, Math.sin(ang * DEG));

  /* ---- 年輪梯: the trunk spiral ------------------------------------------------------------------ */
  link('roots-climb', P.樹腳, P.樹洞, { skin: 'vine' }, { via: round(3.0, 3.0, 185, 138 + 360 - 5, -5.5, -1.3, 37), curl: false });
  link('bark-stair', P.樹洞, P.東枝台, { color: 'curb' }, { via: round(3.0, 3.1, 222, 300, -1.0, 1.65, 26), curl: false });
  link('bough-stair', P.東枝台, P.樹冠北台, { color: 'curb' }, { via: round(3.1, 2.7, 27, 215, 2.1, 4.3, 38), into: P.樹冠北台.c.clone().setY(0).negate(), curl: false });

  /* ---- 樹冠環: the ring under the boughs, and up to the solstice deck -------------------------------- */
  link('ring-east', P.樹冠北台, P.樹冠南台, { skin: 'musicbox' }, { via: round(3.9, 3.9, 285, 375, 4.4, 4.4, 30), curl: false });
  link('ring-west', P.樹冠南台, P.樹冠北台, { skin: 'keys', w: 0.9 }, { via: round(3.9, 3.9, 105, 195, 4.4, 4.4, 30), curl: false });
  link('canopy-walk', P.樹冠南台, P.夏至台, { skin: 'slats' }, { via: [V(2.9, 5.0, 5.9), V(0.2, 6.3, 7.2), V(-2.6, 7.5, 5.6)], out: V(0.3, 0, 1), into: V(-0.3, 0, 1), curl: false });

  /* ---- 候鳥線: down to the dock, across to autumn --------------------------------------------------- */
  link('sap-slide', P.夏至台, P.碼頭, { color: 'paintTeal', lip: 0.3 }, { via: round(1.9, 1.9, 20, -205, 7.7, 4.5, 45, -5.0, 2.6).map((q) => q.p), out: V(-0.35, 0, -1), into: V(-1, 0, -0.25), curl: false });
  link('migrants-bridge', P.碼頭, P.秋收場, { skin: 'slats' }, { via: [V(-5.6, 3.8, 0.0)], out: V(-0.25, 0, -1), into: tang(T.autumn, -40), pre: (t) => t.dip(1.4, 0.16) });

  /* ---- 秋收路 ------------------------------------------------------------------------------------- */
  link('harvest-lane', P.秋收場, P.果園口, { skin: 'stone' }, { via: ringOn(T.autumn, 0, 180), curl: false });
  link('orchard-lane', P.果園口, P.秋收場, { skin: 'stone' }, { via: ringOn(T.autumn, 180, 360), curl: false });
  link('pond-path', P.果園口, P.池塘, { skin: 'stone' }, { out: tang(T.autumn, 150) });
  link('ridge', P.樹冠北台, P.鐘匠坊, { skin: 'brass' }, { via: [V(0.2, 3.8, -7.7), V(3.6, 2.8, -7.7)], out: V(0.15, 0, -1), into: tang(T.works, 302), pre: (t) => t.cage(1.0) });


  /* ---- 初雪: the works, first snow, spring -------------------------------------------------------- */
  link('works-bridge', P.東枝台, P.鐘匠坊, { skin: 'brass' }, { via: [{ p: rel(T.works, 0, 2.9, 0.7), up: T.works.u }], out: V(0.8, 0, -0.6), into: tang(T.works, 0), pre: (t) => t.rails(0.8) });
  link('first-snow', P.鐘匠坊, P.初雪, { color: 'paintBlue' }, { via: [V(8.4, -1.5, -1.6)], pre: (t) => t.surface('ice', 1.0) });
  link('thaw', P.初雪, P.小溪口, { skin: 'vine' }, { into: tang(T.spring, 305) });
  link('mill-race', P.水車屋, P.鐘匠坊, { skin: 'brass' }, { via: [V(6.3, -2.4, -6.4)], pre: (t) => t.vee(0.9) });
  link('mill-stream', P.水車屋, P.蘑菇圈, { color: 'paintTeal' }, { via: [V(4.4, -6.0, -4.0)], into: V(0.6, 0, -1) });
  link('north-shore', P.池塘, P.水車屋, { color: 'paintCream' }, { via: [V(1.2, -4.4, -8.2)], pre: (t) => t.trough(0.9) });

  /* ---- 花園 ---------------------------------------------------------------------------------------- */
  link('garden-walk', P.花園門, P.小溪口, { skin: 'ivory' }, { via: ringOn(T.spring, 90, 270), curl: false });
  link('brook-walk', P.小溪口, P.花園門, { skin: 'ivory' }, { via: ringOn(T.spring, 270, 450), curl: false });
  link('lamplighter', P.花園門, P.點燈人, { skin: 'ivory' }, { out: tang(T.spring, 90), pre: (t) => t.surface('felt', 0.9) });
  link('evening-walk', P.點燈人, P.碼頭, { color: 'paintPink' }, { via: [V(-1.2, 3.5, 7.4)], into: V(1, 0, 0.45) });
  link('east-fall', P.東枝台, P.初雪, { color: 'paintYellow', lip: 0.28 }, { out: V(1, 0, 0.55) });
  // 繞日梯: down round the sun itself
  link('sun-stair', P.樹冠南台, P.日台, { skin: 'crystal' }, { via: round(1.9, 1.9, 215, -170 - 360, 4.25, 0.95, 38, SUN.x, SUN.z).map((q) => q.p), out: V(1, 0, 0.1), curl: false });
  link('sunbeam', P.日台, P.花園門, { skin: 'crystal' }, { via: [V(0.9, 0.8, 6.3)], out: V(-1, 0, 0.5), into: tang(T.spring, 42) });
  link('garden-fall', P.小溪口, P.蘑菇圈, { skin: 'keys', w: 0.9 }, { via: [V(7.4, -4.7, 3.2), V(5.9, -5.8, 0.6)], out: tang(T.spring, 235), into: V(1, 0, 0.1) });

  /* ---- the meadow ---------------------------------------------------------------------------------- */
  link('root-walk', P.樹腳, P.蘑菇圈, { color: 'paintYellow' }, { via: round(3.0, 3.0, 100, 18, -5.88, -5.88, 27), curl: false });

  /* ---- 翻面: over the rim into winter ------------------------------------------------------------- */
  // the track runs off the edge of the meadow and curls right over, ending upside down under it
  const out = P.樹腳.c.clone().setY(0).normalize();
  const flip = k.fromPad(P.樹腳, k.padAngle(P.樹腳, out), 'over-the-rim', { color: 'paintBlue', lip: 0.26, support: false }).straight(0.85).pitch(-180, 1.22).straight(0.5);
  R['over-the-rim'] = flip;
  P.倒影 = k.padAhead(flip, 0.95, { island: false });
  k.strut(P.倒影.c.clone().add(V(0, 0.1, 0)), P.倒影.c.clone().add(V(0, 0.8, 0)), 0.45, 'stone');
  deck('冬市', V(Math.cos(-40 * DEG) * 2.6, P.倒影.c.y, Math.sin(-40 * DEG) * 2.6), 1.1, false);
  P.冬市.u.set(0, -1, 0); P.冬市.e2.crossVectors(P.冬市.u, P.冬市.e1);
  k.strut(P.冬市.c.clone().add(V(0, 0.1, 0)), P.冬市.c.clone().add(V(0, 0.8, 0)), 0.45, 'stone');
  const under = (a0, a1) => round(3.0, 2.6, a0, a1, P.倒影.c.y, P.倒影.c.y, 30).map((q) => ({ p: q.p, up: V(0, -1, 0) }));
  link('frost-fair', P.倒影, P.冬市, { color: 'paintBlue' }, { via: under(175, 285), out: V(-0.67, 0, -0.74), curl: false });
  link('icicle-road', P.倒影, P.冰架, { color: 'paintBlue' }, { via: [{ p: V(-1.4, -8.7, 5.3), up: V(-0.1, -0.9, 0.4) }, { p: V(-3.4, -7.4, 7.0), up: V(-0.4, -0.5, 0.75) }], out: V(0.67, 0, 0.74) });
  link('crystal-stair', P.冰架, P.碼頭, { skin: 'crystal' }, { via: [V(-7.6, -1.6, 5.4), V(-6.9, 1.7, 6.3)], into: V(-0.45, 0, 1) });
  link('under-road', P.冬市, P.水車屋, { color: 'paintCream' }, { via: [{ p: V(3.6, -7.9, -4.6), up: V(0.3, -0.75, -0.55) }], out: V(0.77, 0, -0.64) });
  link('long-night', P.冬市, P.初雪, { color: 'paintNavy' }, { via: [{ p: V(4.4, -8.3, 1.4), up: V(0.2, -0.95, 0.1) }, { p: V(7.3, -6.2, 2.4), up: V(0.6, -0.5, 0.2) }], out: V(0.64, 0, 0.77) });

  /* ---- 風車: the west islet ties the trunk to autumn and to the ice ---------------------------------- */
  link('west-branch', P.樹洞, P.風車, { skin: 'vine' }, { out: V(-1, 0, 0.05), pre: (t) => t.halfpipe(1.0) });
  link('gleaners', P.風車, P.果園口, { skin: 'stone' }, { via: [V(-8.6, -0.8, -2.4)], into: tang(T.autumn, 210) });
  link('plunge', P.池塘, P.冬市, { color: 'paintNavy' }, { via: [{ p: V(-0.9, -6.3, -7.3), up: V(0, 0.1, -1) }, { p: V(0.7, -8.6, -4.7), up: V(0, -0.85, -0.5) }], into: V(-0.2, 0, -1) });
  link('frost-line', P.風車, P.冰架, { color: 'paintBlue' }, { via: [V(-7.6, -3.9, 3.6)] });

  /* ---- mechanisms on the routes ---------------------------------------------------------------------- */
  turnstile(k, { center: P.秋收場.c, up: P.秋收場.u, radius: 0.62, name: 'harvest-turnstile' });
  flap(k, mid(R['roots-climb'], 0.5), { name: 'bark-door' });
  { const f = mid(R.ridge, 0.5), over = f.pos.clone().addScaledVector(f.up, 2.1); pendulumRow(k, { from: over.clone().addScaledVector(f.tan, -1.1), to: over.clone().addScaledVector(f.tan, 1.1), hang: f.up.clone().negate(), count: 3, length: 1.35, amplitude: 0.55, name: 'ridge-pendulums' }); k.strut(over, k.exitPoint(over, f.up), 0.03, 'brass'); }
  void THREE;
  return { P, R };
}
