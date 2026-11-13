// How full, how varied and how lopsided is a globe? Numbers to hold a design against the
// standards in .claude/skills/fantasy-world-builder/references/globe-standards.md.
//   node scripts/globe-report.mjs [globe-id]      (default: every globe on the shelf)
// It never fails a build; it prints, and marks with "!" what misses a target.
import * as THREE from 'three';
import { buildWorld, GLOBES, R } from '../src/world.js';
import { ASSETS } from '../src/library/assets.js';

const ids = process.argv[2] ? [process.argv[2]] : GLOBES.map((g) => g.id);
const flag = (ok) => (ok ? ' ' : '!');
for (const id of ids) {
  const w = buildWorld(id), names = Object.keys(w.routes);
  console.log(`\n=== ${id} — ${w.name} ===`);

  // 1. how much track
  let len = 0;
  for (const n of names) { const f = w.routes[n]; for (let i = 1; i < f.length; i++) len += f[i].pos.distanceTo(f[i - 1].pos); }
  const ratio = len / (2 * R);
  console.log(`${flag(ratio >= 12)} track: ${len.toFixed(0)} units in ${names.length} runs = ${ratio.toFixed(1)} x the globe's diameter   (target 12+, a real Perplexus is ~29)`);

  // 2. where things are: the globe cut into 8 octants x 2 shells (inner half / outer half of the radius)
  const cells = new Map(), key = (p) => `${p.x >= 0 ? 'E' : 'W'}${p.y >= 0 ? 'U' : 'D'}${p.z >= 0 ? 'S' : 'N'}${p.length() > R * 0.55 ? 'o' : 'i'}`;
  const put = (p, what) => { const c = cells.get(key(p)) || { track: 0, scenery: 0 }; c[what]++; cells.set(key(p), c); };
  for (const n of names) w.routes[n].forEach((f, i) => { if (i % 3 === 0) put(f.pos, 'track'); });
  for (const p of w.props) if (p.name !== 'island') put(p.pos, 'scenery');
  for (const m of w.movers) put(m.pivot, 'scenery');
  const all = ['E', 'W'].flatMap((a) => ['U', 'D'].flatMap((b) => ['S', 'N'].flatMap((c) => ['i', 'o'].map((d) => a + b + c + d))));
  const withTrack = all.filter((c) => cells.get(c)?.track > 2), withAny = all.filter((c) => cells.get(c) && cells.get(c).track + cells.get(c).scenery > 0);
  console.log(`${flag(withTrack.length >= 12)} volume: track in ${withTrack.length}/16 cells, something in ${withAny.length}/16   (target: track in 12+, nothing empty)`);
  const empty = all.filter((c) => !withAny.includes(c)), trackless = all.filter((c) => !withTrack.includes(c) && withAny.includes(c));
  if (empty.length) console.log(`    empty: ${empty.join(' ')}`);
  if (trackless.length) console.log(`    scenery but no track: ${trackless.join(' ')}`);
  const up = names.reduce((s, n) => s + w.routes[n].filter((f) => f.pos.y >= 0).length, 0), total = names.reduce((s, n) => s + w.routes[n].length, 0);
  console.log(`    top half / bottom half of the track: ${((100 * up) / total).toFixed(0)}% / ${(100 - (100 * up) / total).toFixed(0)}%`);

  // 3. which way is "down": a globe that only ever uses +Y is a table, not a Perplexus
  const ups = { floor: 0, wall: 0, ceiling: 0 };
  for (const n of names) for (const f of w.routes[n]) ups[f.up.y > 0.6 ? 'floor' : f.up.y < -0.6 ? 'ceiling' : 'wall']++;
  const offFloor = (100 * (ups.wall + ups.ceiling)) / total;
  console.log(`${flag(offFloor >= 15)} surfaces: ${((100 * ups.floor) / total).toFixed(0)}% floor, ${((100 * ups.wall) / total).toFixed(0)}% wall, ${((100 * ups.ceiling) / total).toFixed(0)}% ceiling   (target: 15%+ off the floor)`);

  // 3b. the scenery too: a globe that turns should have worlds facing different ways
  const dirs = [];
  for (const pl of w.props) { if (pl.name === 'island') continue; const d = dirs.find((q) => q.u.dot(pl.up) > 0.7); if (d) d.n++; else dirs.push({ u: pl.up.clone(), n: 1 }); }
  const facing = dirs.filter((d) => d.n >= 3).length;
  console.log(`${flag(facing >= 3)} worlds: shared scenery stands facing ${facing} clearly different way${facing === 1 ? '' : 's'} (3+ pieces each)   (target: 3+; counts placed props only, not a globe's own terrain)`);

  // 4. formula check: stations on the axes or mirrored about the centre are the tell-tale of a template
  const onAxis = w.pads.filter((p) => { const a = [Math.abs(p.c.x), Math.abs(p.c.y), Math.abs(p.c.z)].sort((x, y) => y - x); return a[1] < 0.6 && a[0] > 2; }).length;
  const mirrored = w.pads.filter((p) => w.pads.some((q) => q !== p && q.c.clone().add(p.c).length() < 0.8)).length;
  console.log(`${flag(onAxis <= 2 && mirrored <= 2)} layout: ${w.pads.length} terraces, ${onAxis} sit on an axis, ${mirrored} are mirror images of another   (target: 2 or fewer of each)`);

  // 5. ways on: a terrace with a single way in and out is a dead end
  const exits = w.pads.map((p) => new Set(p.exits.map((a) => Math.round((((a % 360) + 360) % 360) / 15))).size);
  const dead = exits.filter((e) => e <= 1).length;
  console.log(`${flag(dead <= Math.max(1, w.pads.length / 4))} choices: ${exits.filter((e) => e >= 3).length} junctions (3+ ways), ${dead} dead ends, of ${w.pads.length} terraces`);

  // 6. variety and life
  const kinds = new Set(w.movers.map((m) => m.kind || 'turn')), hinged = w.movers.filter((m) => m.kind === 'hinge').length;
  console.log(`${flag(w.movers.length >= 4 && hinged >= 1)} mechanisms: ${w.movers.length} moving parts (${[...kinds].join(', ')}), ${hinged} moved by the marble's own weight   (target: 4+, at least 1 hinged)`);
  const used = new Set(w.props.map((p) => p.name));
  console.log(`  scenery: ${w.props.length} placements of ${used.size} different shared assets; surfaces used: ${(w.surfaces || []).map((s) => s.name).join(', ') || 'none'}`);

  // 7. light: glowing things must light alike everywhere (the catalogue decides, not the globe)
  const fromProps = w.lights.filter((L) => L.from), own = w.lights.filter((L) => !L.from);
  const doubled = own.filter((L) => fromProps.some((g) => g.pos.distanceTo(L.pos) < 1.2));
  const tuned = w.lanterns.filter((L) => L.illumination && (L.illumination.intensity != null || L.illumination.distance != null)).length;
  console.log(`${flag(!doubled.length)} glow: ${fromProps.length} lights from shared assets, ${own.length} added by this globe${doubled.length ? `, ${doubled.length} of them right on top of a glowing asset (remove them: the catalogue already lights it)` : ''}`);
  if (tuned) console.log(`    note: ${tuned} lanterns ask for their own brightness; the engine ignores that (only the tint is honoured)`);
  const glowing = [...used].filter((n) => ASSETS[n]?.glow);
  console.log(`    lights the dark with: ${glowing.join(', ') || '(no glowing shared assets)'}${w.lanterns.length ? ` + ${w.lanterns.length} lanterns` : ''}`);
  void THREE;
}
