// Globe: 年輪 — a clockwork world-tree with the whole year pinned to it.
//
// The tree stands on the axis of the globe. Its crown is summer; at its foot is a meadow, and under
// the meadow its roots hang on down as the bare branches of an upside-down winter. Autumn, spring,
// the clockmakers' works and a dock float round the trunk on its boughs, each tipped its own way,
// with six islets between. Turn the globe and you turn the year.
//
// Built scenery-first (yearwheel/tree.js), then the routes were found through it
// (yearwheel/track.js), then everything small was dressed round both (yearwheel/scene.js).
import * as THREE from 'three';
import { createBuilder } from '../kit.js';
import { buildTree, growLeaves } from './yearwheel/tree.js';
import { buildTracks } from './yearwheel/track.js';
import { buildScene } from './yearwheel/scene.js';

function build() {
  const k = createBuilder({ supports: false });
  const T = buildTree(k);
  const { P } = buildTracks(k, T);
  // where the marble goes: nothing small is stood, hung or grown in its way
  const frames = k.tracks.flatMap((t) => t.frames.filter((_, i) => i % 2 === 0));
  const clear = (p, room = 0.9) => !frames.some((f) => f.pos.distanceToSquared(p) < (room + 0.3) ** 2) && !k.pads.some((pd) => pd.c.distanceTo(p) < pd.r + room);
  buildScene(k, T, clear);
  // (round a terrace the leaves keep well back, so the view from behind the marble stays open)
  growLeaves(k, T, [...frames, ...k.pads.map((pd) => ({ pos: pd.c.clone().addScaledVector(pd.u, 0.9), keep: pd.r + 1.5 }))]);
  // twigs: the long runs are tied back to the tree (never to the glass), by a spoke that touches no other track
  {
    const all = k.tracks.flatMap((t) => t.frames), seg = new THREE.Line3(), near = new THREE.Vector3();
    const anchors = [...Array.from({ length: 30 }, (_, i) => T.trunk.at(i / 29)), ...T.boughs.flatMap((b) => [0.3, 0.55, 0.8].map((s) => b.at(s))), ...[T.autumnBough, T.springBough, T.worksBough, T.dockBough].flatMap((b) => [0.3, 0.5, 0.7].map((s) => b.at(s)))];
    for (const tr of k.tracks) {
      if (tr.frames.length < 45) continue;
      for (const s of tr.frames.length > 90 ? [0.25, 0.5, 0.75] : [0.5]) {
        const f = tr.frames[Math.floor(tr.frames.length * s)], a = f.pos.clone().addScaledVector(f.up, -0.12);
        const b = anchors.reduce((best, q) => (q.distanceTo(a) < best.distanceTo(a) ? q : best));
        if (a.distanceTo(b) > 5.5 || a.distanceTo(b) < 0.8) continue;
        seg.set(a.clone().lerp(b, Math.min(0.9, 0.7 / a.distanceTo(b))), b);
        if (all.some((g) => seg.closestPointToPoint(g.pos, true, near).distanceTo(g.pos) < 0.62) || k.pads.some((pd) => seg.closestPointToPoint(pd.c, true, near).distanceTo(pd.c) < pd.r + 0.3)) continue;
        k.strut(a, b, 0.05, 'bark');
      }
    }
  }
  // lanterns; the first is where you start: a drop of sap, high in the crown
  for (const name of ['樹冠南台', ...Object.keys(P).filter((n) => n !== '樹冠南台')]) k.padLantern(name, P[name]);
  return k.finish();
}

export default { id: 'yearwheel', name: '年輪', blurb: '一棵上了發條的世界樹：樹冠是夏天，樹根底下是倒掛的冬夜，秋、春與鐘匠工坊浮在枝頭。轉動這顆球，就是轉動一年。', build };
