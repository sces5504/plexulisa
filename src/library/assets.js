// The shared asset catalogue: what every globe may place with prop(name, …).
//
// Two kinds of asset:
//   path 'A' — flat-colour props in public/props.glb. Materials are swapped by name for the
//              game's own shaders, so they always match the tracks.
//   path 'B' — textured models (e.g. made with Meshy) in public/assets/<name>.glb, drawn with
//              their own textures.
// Either way, physics uses the mesh in src/props.collision.json / src/assets.collision.json.
//
// `glow` is the important part of the contract: anything listed here that shines also LIGHTS
// ITS SURROUNDINGS, in every globe, with no extra work from the globe's author. Positions are
// in the prop's own space (y up, origin at its base); intensity and reach scale with the prop.
// `day` is how much of that light shows while the room lamp is on (default 0.35).
const warm = 0xffc070, teal = 0x7fe6dc, pink = 0xff9ec4, white = 0xfff0d8, blue = 0x8fd8ff;

// GLOW: the house lights. Every new asset that shines picks one of these rather than inventing
// its own numbers, so a window is a window and a candle is a candle in every globe (and matches
// the emissive material of the same name in render.js). `at` is added per asset.
//                    material it goes with      what it is
export const GLOW = {
  window: { color: warm, intensity: 3.2, reach: 4.5, day: 0.3 },      // 'window'    a lit pane: houses, towers, clock faces
  lamp: { color: warm, intensity: 5, reach: 6, day: 0.35 },           // 'lamp'      a street lamp, a paper lantern
  flame: { color: 0xffa040, intensity: 3, reach: 4, day: 0.3 },       // 'flame'     a candle, a burner
  star: { color: 0xffe08a, intensity: 2.2, reach: 3.5, day: 0.3 },    // 'starGlow'  small fairy lights and stars
  crystal: { color: teal, intensity: 2.2, reach: 4.5, day: 0.35 },    // 'crystal'
};
// The checkpoint lantern is a shared light too: how bright it is and how far it reaches are fixed
// here for every globe. A globe may only tint it (lantern.illumination = { color }).
export const LANTERN_GLOW = { color: 0xffb060, intensity: 5.5, reach: 5, day: 0.6 };
const glow = (kind, at, k = 1) => ({ at, ...GLOW[kind], intensity: GLOW[kind].intensity * k, reach: GLOW[kind].reach * Math.sqrt(k) });

export const ASSETS = {
  // landmarks
  lighthouse: { path: 'A', glow: [{ at: [0, 10.9, 0], color: warm, intensity: 30, reach: 22, day: 0.12 }] },
  giant_mushroom: { path: 'A' },
  moon: { path: 'A', glow: [{ at: [0, 0, 0], color: 0xffe2a0, intensity: 5, reach: 7 }] },
  whale: { path: 'A' },
  clam: { path: 'A', glow: [{ at: [0, 0.35, 0], color: white, intensity: 7, reach: 7 }] },
  // architecture
  house: { path: 'A' }, windmill: { path: 'A' }, sails: { path: 'A' },
  // flora and small things
  tree_pine: { path: 'A' }, tree_round: { path: 'A' }, tree_ply: { path: 'A' },
  mushroom: { path: 'A' }, coral: { path: 'A' },
  crystal: { path: 'A', glow: [{ at: [0, 0.5, 0], color: teal, intensity: 2.2, reach: 4.5 }] },
  jelly: { path: 'A', glow: [{ at: [0, 1.2, 0], color: pink, intensity: 4, reach: 6 }] },
  // terrain, sea, sky
  island: { path: 'A' }, wave: { path: 'A' }, boat: { path: 'A' }, cloud: { path: 'A' },
  // mechanism pieces
  gear_big: { path: 'A' }, gear_small: { path: 'A' },
  // textured (Meshy) assets — see assets/library.json for provenance and cost
  stone_arch: { path: 'B', file: '/assets/stone_arch.glb', glow: [{ at: [0, 0.6, 0], color: blue, intensity: 2.5, reach: 5 }] },                 // 3.4 wide x 2.3 tall; you pass through along its local Z
  elder_tree: { path: 'B', file: '/assets/elder_tree.glb', glow: [{ at: [0.5, 1.1, 0.3], color: warm, intensity: 6, reach: 7 }] },           // 2.9 wide x 2.6 tall, lanterns hang from a low branch
  // (added with the 年輪 globe; reusable anywhere)
  blossom_tree: { path: 'B', file: '/assets/blossom_tree.glb' },                                // 3.2 tall cherry in full blossom, on its own mossy root-plate
  maple_tree: { path: 'B', file: '/assets/maple_tree.glb' },                                    // the same tree in autumn colours
  harvest_mill: { path: 'B', file: '/assets/harvest_mill.glb', glow: [glow('window', [0, 1.0, 0], 1.6)] },   // 2.7 tall watermill on a cobbled yard
  frost_belfry: { path: 'B', file: '/assets/frost_belfry.glb', glow: [glow('window', [0, 2.3, 0], 1.6)] },   // 3.8 tall frozen bell tower, clock faces lit

  // ---- pack 'atelier' (tools/blender_pack_atelier.py -> public/packs/atelier.glb) ----------------
  // architecture
  wizard_tower: { path: 'A', pack: 'atelier', glow: [glow('window', [0, 3.1, 0], 2)] },        // 2.3 across x 5.5 tall, door faces +X
  cottage: { path: 'A', pack: 'atelier', glow: [glow('window', [0, 0.8, 0], 1.3)] },           // 1.7 x 1.4 x 2.3, door faces south
  toadstool_house: { path: 'A', pack: 'atelier', glow: [glow('window', [0, 0.7, 0])] },        // 2.3 across x 2.2 tall
  clock_tower: { path: 'A', pack: 'atelier', glow: [glow('window', [0, 3.8, 0], 2.4)] },       // 1.5 square x 6.0 tall, four lit faces
  stone_bridge: { path: 'A', pack: 'atelier' },                                                // 3.3 long (X) x 1.0 wide; a track passes under it along Z
  gate_arch: { path: 'A', pack: 'atelier', glow: [glow('lamp', [0, 1.0, 0])] },                // opening 1.1 wide x 1.0 high; use with archOver(k, frame, { name: 'gate_arch', sink: 0.02 })
  well: { path: 'A', pack: 'atelier' }, fountain: { path: 'A', pack: 'atelier' },
  // lights
  street_lamp: { path: 'A', pack: 'atelier', glow: [glow('lamp', [0, 1.56, 0])] },             // 1.9 tall
  paper_lantern: { path: 'A', pack: 'atelier', glow: [glow('lamp', [0, 0.32, 0], 0.8)] },      // 0.62 tall, hangs from its top ring
  candle: { path: 'A', pack: 'atelier', glow: [glow('flame', [0, 0.55, 0])] },                 // 0.63 tall
  star: { path: 'A', pack: 'atelier', glow: [glow('star', [0, 0.3, 0])] },                     // 0.67 tall, hangs from its top point
  fairy_lights: { path: 'A', pack: 'atelier', glow: [glow('star', [-0.6, 0.15, 0]), glow('star', [0.6, 0.15, 0])] },   // 2.6 between its ends (X), sags 0.42
  bunting: { path: 'A', pack: 'atelier' },                                                     // 2.6 between its ends (X)
  // things that fly
  balloon: { path: 'A', pack: 'atelier', glow: [glow('flame', [0, 1.15, 0], 1.6)] },           // 2.1 across x 3.4 tall
  airship: { path: 'A', pack: 'atelier', glow: [glow('window', [0.05, 0.45, 0])] },            // 4.6 long (nose +X) x 2.2 tall
  // nature
  pine_snow: { path: 'A', pack: 'atelier' }, rock_spire: { path: 'A', pack: 'atelier' }, snowman: { path: 'A', pack: 'atelier' },
  floating_rock: { path: 'A', pack: 'atelier' },                                               // origin on its mossy TOP (like `island`); hangs 2.4 below
  // music box and clockwork
  carousel_horse: { path: 'A', pack: 'atelier' }, ballerina: { path: 'A', pack: 'atelier' }, bell: { path: 'A', pack: 'atelier' },
  waterwheel: { path: 'A', pack: 'atelier' },                                                  // lies flat like the gears (axle = up): turn it with a mover
  // small furniture
  fence: { path: 'A', pack: 'atelier' }, signpost: { path: 'A', pack: 'atelier' },
};

// packs of path-'A' props beyond the original public/props.glb. A pack only ever ADDS names.
export const PACKS = [{ id: 'atelier', file: '/packs/atelier.glb' }];

// which catalogue entries actually have a file to draw (filled in as assets are delivered)
export const TEXTURED_READY = ['stone_arch', 'elder_tree', 'blossom_tree', 'maple_tree', 'harvest_mill', 'frost_belfry'];
