// Rendering: a handmade plywood-and-paint miniature, sitting on a maker's desk in a cozy room.
// Warm lamp key + cool window rim, soft shadows, a little haze for scale, gentle depth of
// field focused on the marble, bloom on anything that glows, and a light film grade.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { R, BALL_R } from './world.js';
import { ASSETS, TEXTURED_READY, PACKS, LANTERN_GLOW } from './library/assets.js';

const NOISE = /* glsl */ `
varying vec3 vObj;
float gHash(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float gNoise(vec3 x){ vec3 i = floor(x), f = fract(x); f = f*f*(3.0-2.0*f);
  return mix(mix(mix(gHash(i), gHash(i+vec3(1,0,0)), f.x), mix(gHash(i+vec3(0,1,0)), gHash(i+vec3(1,1,0)), f.x), f.y),
             mix(mix(gHash(i+vec3(0,0,1)), gHash(i+vec3(1,0,1)), f.x), mix(gHash(i+vec3(0,1,1)), gHash(i+vec3(1,1,1)), f.x), f.y), f.z); }`;

// Procedural wood grain in object space (no UVs needed anywhere).
function grain(mat, freq, strength, fleck = 0.5) {
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vObj;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvObj = position;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n' + NOISE)
      .replace('#include <color_fragment>', `#include <color_fragment>
        float gW = gNoise(vObj * vec3(1.3, 0.6, 1.3));
        float gL = sin((vObj.y + gW * 0.35) * ${freq.toFixed(2)}) * 0.5 + 0.5;
        float gF = gNoise(vObj * vec3(26.0, 3.0, 26.0));
        diffuseColor.rgb *= 1.0 - ${strength.toFixed(3)} * (gL * 0.7 + gF * ${fleck.toFixed(2)});`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = clamp(roughnessFactor + (gF - 0.5) * 0.18, 0.05, 1.0);');
  };
  mat.customProgramCacheKey = () => `grain${freq}_${strength}_${fleck}`;
  return mat;
}

// Sawn boards for the room's big wooden surfaces (desk top, floor), in object space: separate
// boards with their own tone, cathedral grain that runs along each board, pores, and a finish
// whose sheen follows the grain — so the lamp rakes across it instead of mirroring off a slab.
//   along: 'x' or 'z' = the way the boards run; width: of one board; scale: size of the figure
function boards(mat, { along = 'x', width = 20, scale = 1, depth = 0.3, gap = 0.5 } = {}) {
  const A = along === 'x' ? 'vObj.x' : 'vObj.z', C = along === 'x' ? 'vObj.z' : 'vObj.x';
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vObj;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvObj = position;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\n' + NOISE)
      .replace('#include <color_fragment>', `#include <color_fragment>
        float bAcross = ${C} / ${width.toFixed(2)}, bId = floor(bAcross), bF = fract(bAcross);
        float bAlong = ${A} * ${(0.05 * scale).toFixed(4)} + gHash(vec3(bId, 3.0, 1.0)) * 40.0;
        float bX = (bF - 0.5) * ${(width * 0.09 * scale).toFixed(3)};
        float bWarp = gNoise(vec3(bAlong * 0.35, bX * 0.6, bId * 7.0));
        float bRing = sin((bX * (1.0 + 0.6 * gNoise(vec3(bAlong * 0.12, bId, 4.0))) + bWarp * 5.0 + bAlong * 0.08) * 5.2) * 0.5 + 0.5;
        bRing = pow(bRing, 1.6);
        float bPore = gNoise(vec3(bAlong * 9.0, bX * 26.0, bId));
        float bTone = 0.8 + 0.42 * gHash(vec3(bId, 1.0, 5.0));
        float bSeam = smoothstep(0.0, ${(gap / width).toFixed(4)}, bF) * smoothstep(1.0, ${(1 - gap / width).toFixed(4)}, bF);
        diffuseColor.rgb *= bTone * (1.0 - ${depth.toFixed(2)} * bRing - 0.14 * bPore) * mix(0.3, 1.0, bSeam);
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.12, 0.94, 0.8), bWarp * 0.5);`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = clamp(roughnessFactor + 0.2 * bRing + 0.14 * bPore - 0.08, 0.3, 1.0);`);
  };
  mat.customProgramCacheKey = () => `boards${along}${width}${scale}${depth}${gap}`;
  return mat;
}

// a dark surface pricked with tiny lights (the night sky under the sea)
function sparkle(mat) {
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vObj;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvObj = position;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\n' + NOISE)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        vec2 sc = vObj.xz * 3.2; vec2 cell = floor(sc); float h = gHash(vec3(cell, 7.0));
        vec2 off = vec2(gHash(vec3(cell, 1.0)), gHash(vec3(cell, 2.0)));
        float star = smoothstep(0.16 * h, 0.0, length(fract(sc) - 0.25 - 0.5 * off)) * step(0.72, h);
        totalEmissiveRadiance += mix(vec3(0.5, 0.9, 1.0), vec3(1.0, 0.8, 0.9), off.x) * star * 2.2;`);
  };
  mat.customProgramCacheKey = () => 'sparkle';
  return mat;
}

const std = (color, roughness = 0.8, metalness = 0, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });

const publicAssetUrl = (path) => import.meta.env.BASE_URL + path.slice(1);

async function loadProps(url) {
  const gltf = await new GLTFLoader().loadAsync(publicAssetUrl(url));
  const lib = {};
  for (const n of gltf.scene.children) {
    const parts = [];
    n.traverse((o) => {
      if (!o.isMesh) return;
      for (const k of Object.keys(o.geometry.attributes)) if (k !== 'position' && k !== 'normal') o.geometry.deleteAttribute(k);
      parts.push({ geometry: o.geometry, mat: o.material.name });
    });
    lib[n.name] = parts;
  }
  return lib;
}
const Y_AXIS = new THREE.Vector3(0, 1, 0);
function bakeProps(lib, placements) {
  const by = {}, m = new THREE.Matrix4(), q = new THREE.Quaternion(), qy = new THREE.Quaternion();
  for (const pl of placements) {
    q.setFromUnitVectors(Y_AXIS, pl.up).multiply(qy.setFromAxisAngle(Y_AXIS, pl.yaw));
    m.compose(pl.pos, q, new THREE.Vector3(pl.scale, pl.scale, pl.scale));
    for (const part of lib[pl.name] || []) (by[(pl.mats && pl.mats[part.mat]) || part.mat] ||= []).push(part.geometry.clone().applyMatrix4(m));
  }
  return Object.entries(by).map(([mat, gs]) => ({ mat, geometry: mergeGeometries(gs) }));
}

// Textured assets (catalogue path 'B', e.g. Meshy models) keep their own textures. They are
// instanced as they are, tuned once so they sit in the same light as the painted props.
async function loadTextured(loader) {
  const out = {};
  await Promise.all(TEXTURED_READY.map(async (name) => {
    try {
      const gltf = await loader.loadAsync(publicAssetUrl(ASSETS[name].file));
      gltf.scene.traverse((o) => {
        if (!o.isMesh) return;
        o.castShadow = o.receiveShadow = true;
        const m = o.material;
        m.metalness = 0; m.metalnessMap = null; m.roughness = Math.max(0.72, m.roughness); m.envMapIntensity = 0.55;
        if (m.map) m.map.anisotropy = 4;
      });
      out[name] = gltf.scene;
    } catch (err) { console.warn(`asset "${name}" failed to load`, err); }      // a missing asset must not stop the game
  }));
  return out;
}
function placeTextured(texLib, placements, target) {
  const q = new THREE.Quaternion(), qy = new THREE.Quaternion();
  for (const pl of placements) {
    const src = texLib[pl.name];
    if (!src) continue;
    const o = src.clone(true);
    o.position.copy(pl.pos);
    o.quaternion.copy(q.setFromUnitVectors(Y_AXIS, pl.up).multiply(qy.setFromAxisAngle(Y_AXIS, pl.yaw)));
    o.scale.setScalar(pl.scale);
    target.add(o);
  }
}

export function makeMaterials() {
  return {
    sea: grain(new THREE.MeshPhysicalMaterial({ color: 0x2f6e96, roughness: 0.32, clearcoat: 0.6, clearcoatRoughness: 0.25 }), 3, 0.1, 0.8),
    seaLight: std(0x79b3cc, 0.4, 0, { polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }),
    lawn: grain(std(0x8fae6c, 1.0, 0, { polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8 }), 2, 0.06, 1.2),
    grass: grain(std(0x8fae6c, 1.0), 2, 0.06, 1.2),
    rock: grain(std(0x9a938b, 0.85), 5, 0.12, 0.9),
    birch: grain(std(0xe8cfa2, 0.62), 9, 0.1),
    ply: grain(std(0xd7b582, 0.66), 34, 0.3, 0.3),
    track: grain(std(0xf1dfba, 0.5), 7, 0.08),
    curb: grain(std(0xc99a5f, 0.55), 12, 0.14),
    dowel: grain(std(0xd9b27a, 0.6), 16, 0.12),
    woodDark: grain(std(0x6f4a31, 0.6), 11, 0.22),
    brass: std(0xd0a85c, 0.3, 1),
    paintCream: grain(std(0xf2e8d3, 0.7), 6, 0.04),
    paintRed: grain(std(0xd2483b, 0.62), 6, 0.05),
    paintBlue: grain(std(0x3f7fa3, 0.62), 6, 0.05),
    paintYellow: grain(std(0xf0b53c, 0.65), 6, 0.05),
    paintNavy: grain(std(0x2b3c5a, 0.6), 6, 0.05),
    whale: grain(std(0x35628f, 0.6), 6, 0.06),
    paper: std(0xf7f3ea, 0.95),
    treeA: grain(std(0x3f8475, 0.75), 6, 0.06),
    treeB: grain(std(0x8fb070, 0.75), 6, 0.06),
    crystal: new THREE.MeshPhysicalMaterial({ color: 0x86ded6, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05, emissive: 0x2a9d94, emissiveIntensity: 0.55, flatShading: true }),
    lamp: std(0xffe6b0, 0.4, 0, { emissive: 0xffb45a, emissiveIntensity: 2.4 }),
    jelly: std(0xf6b3cb, 0.55, 0, { emissive: 0xe0508c, emissiveIntensity: 1.5 }),
    jellyB: std(0xa6e6ea, 0.55, 0, { emissive: 0x2fb6c4, emissiveIntensity: 1.5 }),
    coral: grain(std(0xea7460, 0.7, 0, { emissive: 0x7a1f14, emissiveIntensity: 0.35 }), 9, 0.1),
    pearl: std(0xfff6e6, 0.2, 0, { emissive: 0xffe9c8, emissiveIntensity: 2.6 }),
    sun: std(0xfff0c0, 0.3, 0, { emissive: 0xffb23f, emissiveIntensity: 3.2 }),
    glassTube: new THREE.MeshPhysicalMaterial({ color: 0xd9f4f6, roughness: 0.05, metalness: 0, transparent: true, opacity: 0.2, side: THREE.DoubleSide, depthWrite: false, clearcoat: 1 }),
    abyss: sparkle(std(0x0a1630, 0.9)),
    // ---- added with the atelier pack (new skins, surfaces and props); nothing above changed ----
    stone: grain(std(0xa39c90, 0.9), 4, 0.14, 1.1),
    stoneDark: grain(std(0x6f6b69, 0.92), 4, 0.16, 1.1),
    plaster: grain(std(0xeadfc8, 0.9), 3, 0.05, 1.0),
    slate: grain(std(0x4d5870, 0.7), 14, 0.12),
    thatch: grain(std(0xc9a55a, 0.95), 30, 0.28, 0.4),
    moss: grain(std(0x6f8f4e, 1.0), 2, 0.1, 1.4),
    bark: grain(std(0x5d4634, 0.9), 18, 0.3, 0.5),
    vine: grain(std(0x4f7a3c, 0.85), 8, 0.1),
    leaf: std(0x5c9a4a, 0.8),
    petal: std(0xf3a9c0, 0.7),
    snow: std(0xf6f8fb, 0.92),
    rope: grain(std(0xb89a6a, 1.0), 40, 0.25, 0.3),
    felt: grain(std(0x2f6b4c, 1.0), 2, 0.05, 1.6),
    rubber: std(0x8c2f3a, 0.95),
    ivory: new THREE.MeshPhysicalMaterial({ color: 0xf4ecdb, roughness: 0.38, clearcoat: 0.5, clearcoatRoughness: 0.3 }),
    gold: std(0xe6bd62, 0.24, 1),
    steel: std(0x71809a, 0.34, 0.9),
    copper: std(0xb87a52, 0.36, 1),
    ice: new THREE.MeshPhysicalMaterial({ color: 0xcfeefa, roughness: 0.06, metalness: 0, transparent: true, opacity: 0.62, clearcoat: 1, clearcoatRoughness: 0.04 }),
    frost: std(0xe9f4f8, 0.45),
    paintGreen: grain(std(0x5f9a6c, 0.64), 6, 0.05),
    paintPink: grain(std(0xe79aa8, 0.64), 6, 0.05),
    paintTeal: grain(std(0x4fa7a0, 0.62), 6, 0.05),
    window: std(0xffe2a8, 0.4, 0, { emissive: 0xffa544, emissiveIntensity: 1.9 }),
    flame: std(0xfff0c0, 0.3, 0, { emissive: 0xff9a2e, emissiveIntensity: 3.4 }),
    starGlow: std(0xfff3c8, 0.3, 0, { emissive: 0xffd76a, emissiveIntensity: 2.2 }),
    // ---- added with the 年輪 globe (autumn foliage); nothing above changed ----
    leafAmber: std(0xe0862e, 0.8),
  };
}

// What is outside the window: a real evening landscape, built from actual geometry at real
// distances (so it shifts properly as you move) — a sky dome, stars, a low moon, mountain
// ranges, hills, a forest, a village with lit windows and a far lighthouse. The garden trees,
// the houses and the lighthouse are the same shared props the globes use.
function buildOutside(lib) {
  const group = new THREE.Group(), mats = [];
  let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const dusk = (color, glow, k = 1) => { const m = new THREE.MeshStandardMaterial({ color, roughness: 1, emissive: glow, emissiveIntensity: k, fog: false }); mats.push({ m, base: k }); return m; };
  const put = (geo, mat, x, y, z, sx = 1, sy = sx, sz = sx, ry = 0) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); o.scale.set(sx, sy, sz); o.rotation.y = ry; group.add(o); return o; };
  const GROUND = -96;

  // sky
  const sky = new THREE.Mesh(new THREE.SphereGeometry(2350, 40, 20), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false, uniforms: { uDim: { value: 1 } },
    vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform float uDim; varying vec3 vD; void main(){ float h = clamp(vD.y, -0.1, 1.0);
      vec3 c = mix(vec3(1.0, 0.56, 0.32), vec3(0.62, 0.38, 0.5), smoothstep(0.0, 0.12, h));
      c = mix(c, vec3(0.16, 0.2, 0.46), smoothstep(0.08, 0.32, h)); c = mix(c, vec3(0.02, 0.035, 0.11), smoothstep(0.3, 0.8, h));
      c += vec3(0.5, 0.22, 0.08) * pow(max(dot(vD, normalize(vec3(-0.35, 0.02, -1.0))), 0.0), 10.0);
      gl_FragColor = vec4(c * uDim, 1.0); }`,
  }));
  sky.position.set(84, 0, -76);
  group.add(sky);
  const starPos = [];
  for (let i = 0; i < 900; i++) { const a = rnd() * Math.PI, el = 0.1 + rnd() * 1.3, r = 2250; starPos.push(84 + r * Math.cos(el) * Math.cos(a), r * Math.sin(el), -76 - r * Math.cos(el) * Math.sin(a)); }
  const starGeo = new THREE.BufferGeometry(); starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xfff6e0, size: 5, sizeAttenuation: true, fog: false, transparent: true, opacity: 0.9 }));
  group.add(stars);
  const moon = put(new THREE.SphereGeometry(62, 24, 16), new THREE.MeshBasicMaterial({ color: 0xfff1cf, fog: false }), 640, 660, -1950);

  // mountain ranges, nearer hills, the ground
  const farM = dusk(0x4a5388, 0x2c3566, 1), snow = dusk(0xb9bfdc, 0x6b7096, 1), midM = dusk(0x2c3763, 0x18204a, 1), hillM = dusk(0x1c2a48, 0x0d1730, 1), groundM = dusk(0x15233a, 0x0a1424, 1);
  for (let i = 0; i < 11; i++) {
    const x = -1500 + i * 300 + rnd() * 160, h = 380 + rnd() * 380, r = 300 + rnd() * 200, z = -1750 - rnd() * 300;
    put(new THREE.ConeGeometry(1, 1, 7), farM, x, GROUND - 60 + h / 2, z, r, h, r, rnd() * 3);
    put(new THREE.ConeGeometry(1, 1, 7), snow, x, GROUND - 60 + h * 0.86, z, r * 0.29, h * 0.29, r * 0.29, rnd() * 3);
  }
  for (let i = 0; i < 9; i++) { const x = -1100 + i * 290 + rnd() * 120, h = 200 + rnd() * 160; put(new THREE.ConeGeometry(1, 1, 6), midM, x, GROUND - 40 + h / 2, -1150 - rnd() * 200, 260 + rnd() * 160, h, 240, rnd() * 3); }
  const hills = [[-380, -640, 420, 120], [330, -560, 380, 135], [60, -900, 520, 150], [760, -820, 460, 120], [-760, -980, 500, 140], [150, -330, 260, 52]];
  for (const [x, z, r, h] of hills) put(new THREE.SphereGeometry(1, 28, 14), hillM, x, GROUND - 20, z, r, h, r * 0.8);
  const hillY = (x, z) => { let y = GROUND; for (const [hx, hz, r, h] of hills) { const d = ((x - hx) / r) ** 2 + ((z - hz) / (r * 0.8)) ** 2; if (d < 1) y = Math.max(y, GROUND - 20 + h * Math.sqrt(1 - d)); } return y; };
  const ground = put(new THREE.PlaneGeometry(6000, 3200), groundM, 84, GROUND, -1400); ground.rotation.x = -Math.PI / 2;

  // a forest of pines over the hills
  const N = 420, pines = new THREE.InstancedMesh(new THREE.ConeGeometry(0.34, 1, 6), dusk(0x10232c, 0x08141c, 1), N), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), ps = new THREE.Vector3();
  for (let i = 0; i < N; i++) {
    const x = -900 + rnd() * 1900, z = -230 - rnd() * 800, s = 26 + rnd() * 34;
    ps.set(x, hillY(x, z) + s * 0.45, z); sc.set(s, s, s); pines.setMatrixAt(i, m4.compose(ps, q, sc));
  }
  group.add(pines);

  // shared props, dressed for dusk: garden trees just outside, a village on the near hill, a lighthouse far off
  const window_ = dusk(0xffd28a, 0xffb347, 3.2), lampM = dusk(0xffe6b0, 0xffb347, 5);
  const table = {
    treeA: dusk(0x183a38, 0x0a1c1c, 1), treeB: dusk(0x2c4428, 0x121f10, 1), dowel: dusk(0x3a2a1c, 0x150e08, 1), birch: dusk(0x5a4a38, 0x1f1810, 1),
    body: dusk(0x6c6878, 0x2a2838, 1), roof: dusk(0x5c2f33, 0x241216, 1), paintCream: dusk(0x77748a, 0x2d2c40, 1), paintRed: dusk(0x6a3038, 0x2a1218, 1),
    paintNavy: window_, lamp: lampM, woodDark: dusk(0x2a1c14, 0x100a06, 1), brass: dusk(0x6c5a30, 0x2a2210, 1),
  };
  const place = (name, x, z, scale, yaw = 0, y = null, mats2 = null) => ({ name, pos: new THREE.Vector3(x, y ?? hillY(x, z), z), up: Y_AXIS, yaw, scale, mats: mats2 });
  const placements = [
    place('tree_pine', 18, -128, 30, 0.4, GROUND), place('tree_round', 156, -150, 34, 1.2, GROUND), place('tree_ply', 108, -215, 30, 0.7, GROUND), place('tree_pine', 190, -260, 40, 2.0, GROUND), place('tree_round', -30, -240, 30, 0.2, GROUND),
    ...[[262, -545, 0.3], [318, -520, -0.4], [356, -575, 0.9], [290, -600, 1.6], [396, -540, 0.1], [236, -590, -1.0]].map(([x, z, yaw]) => place('house', x, z, 24, yaw)),
    place('tree_pine', 345, -500, 30), place('tree_pine', 225, -530, 26), place('windmill', 430, -590, 30, -0.6),
    place('lighthouse', -330, -700, 10, 0, hillY(-380, -640) - 8),
  ];
  for (const part of bakeProps(lib, placements)) { const o = new THREE.Mesh(part.geometry, table[part.mat] || hillM); group.add(o); }
  const glowTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,225,160,1)'); gr.addColorStop(0.25, 'rgba(255,200,120,0.5)'); gr.addColorStop(1, 'rgba(255,200,120,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
  const halo = (x, y, z, s, op) => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, opacity: op, depthWrite: false, fog: false })); sp.position.set(x, y, z); sp.scale.setScalar(s); group.add(sp); return sp; };
  const halos = [halo(-330, hillY(-380, -640) - 8 + 109, -700, 150, 0.9), halo(640, 660, -1950, 520, 0.55)];

  return {
    group,
    dim(dark) {
      const k = 1 - 0.62 * dark;
      for (const r of mats) r.m.emissiveIntensity = r.base * k;
      sky.material.uniforms.uDim.value = k; moon.material.color.setScalar(k); stars.material.opacity = 0.9;
      for (const h of halos) h.material.opacity = (h === halos[0] ? 0.9 : 0.55) * k;
    },
  };
}

const FS_VERT = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
const BRIGHT_FRAG = /* glsl */ `
uniform sampler2D tColor; varying vec2 vUv;
void main(){ vec3 c = min(texture2D(tColor, vUv).rgb, vec3(12.0)); float l = max(c.r, max(c.g, c.b));
  gl_FragColor = vec4(c * smoothstep(0.85, 1.9, l), 1.0); }`;
const BLUR_FRAG = /* glsl */ `
uniform sampler2D tColor; uniform vec2 uDir; varying vec2 vUv;
void main(){ vec3 c = texture2D(tColor, vUv).rgb * 0.227;
  c += (texture2D(tColor, vUv + uDir * 1.385).rgb + texture2D(tColor, vUv - uDir * 1.385).rgb) * 0.316;
  c += (texture2D(tColor, vUv + uDir * 3.231).rgb + texture2D(tColor, vUv - uDir * 3.231).rgb) * 0.0703;
  gl_FragColor = vec4(c, 1.0); }`;
const POST_FRAG = /* glsl */ `
#include <packing>
uniform sampler2D tColor; uniform sampler2D tDepth; uniform sampler2D tBloom;
uniform float uNear, uFar, uFocus, uAperture, uMaxBlur, uVignette, uTime, uBloom;
uniform vec2 uTexel;
varying vec2 vUv;
float viewZ(vec2 uv){ return -perspectiveDepthToViewZ(texture2D(tDepth, uv).x, uNear, uFar); }
float coc(float z){ return clamp(uAperture * abs(z - uFocus) / max(z, 0.001), 0.0, 1.0) * uMaxBlur; }
void main(){
  float zc = viewZ(vUv); float c = coc(zc);
  vec3 acc = texture2D(tColor, vUv).rgb; float ws = 1.0;
  for (int i = 1; i <= TAPS; i++){
    float fi = float(i);
    float r = sqrt(fi / float(TAPS)) * max(c, 1.2);
    float a = fi * 2.39996323;
    vec2 uv = vUv + vec2(cos(a), sin(a)) * r * uTexel;
    float zs = viewZ(uv); float cs = coc(zs);
    float w = zs > zc ? clamp(c - r + 1.0, 0.0, 1.0) : clamp(cs - r + 1.0, 0.0, 1.0);
    acc += texture2D(tColor, uv).rgb * w; ws += w;
  }
  vec3 col = acc / ws + texture2D(tBloom, vUv).rgb * uBloom;
  // film grade: cool shadows, warm highlights, a touch of grain, soft vignette
  float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col *= mix(vec3(0.93, 0.99, 1.08), vec3(1.07, 1.0, 0.92), smoothstep(0.0, 0.9, l));
  vec2 q = vUv - 0.5;
  col *= 1.0 - uVignette * smoothstep(0.22, 0.95, dot(q, q) * 2.2);
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  float gn = fract(sin(dot(vUv * (uTime + 1.0), vec2(12.9898, 78.233))) * 43758.5453) - 0.5;
  gl_FragColor.rgb += gn * 0.022;
}`;

export async function createRenderer(canvas, world, low) {
  const loader = new GLTFLoader();
  const [baseLib, roomGltf, texLib, ...packLibs] = await Promise.all([loadProps('/props.glb'), loader.loadAsync(publicAssetUrl('/room.glb')), loadTextured(loader),
    ...PACKS.map((p) => loadProps(p.file).catch((err) => { console.warn(`pack "${p.id}" failed to load`, err); return {}; }))]);   // a missing pack must not stop the game
  const lib = Object.assign({}, ...packLibs, baseLib);                       // the original props always win a name clash

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.93;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x15110e);
  scene.fog = new THREE.FogExp2(0xb9a88f, 0.0075);          // a little haze inside the globe: depth and scale
  const camera = new THREE.PerspectiveCamera(50, 1, 0.08, 2600);
  scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.42;

  // lamp key (warm, casts the shadows) + window rim (cool) + a real point light under the lamp shade
  const key = new THREE.DirectionalLight(0xffe2bd, 3.1);
  key.castShadow = true;
  key.shadow.mapSize.setScalar(low ? 1024 : 2048);
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.035;
  key.shadow.radius = 5;
  key.shadow.camera.near = 1; key.shadow.camera.far = 90;
  scene.add(key, key.target);
  const KEY_DIR = new THREE.Vector3(-0.55, 0.72, 0.42).normalize();
  const rim = new THREE.DirectionalLight(0xb4cdfc, 0.8);
  rim.position.set(0.62, 0.5, -0.6);
  scene.add(rim);
  const hemi = new THREE.HemisphereLight(0xcdd6e6, 0x5a4332, 0.22);
  scene.add(hemi);
  const FOG_DAY = new THREE.Color(0xb9a88f), FOG_NIGHT = new THREE.Color(0x0d2029);

  const M = makeMaterials();
  const mesh = (geometry, mat) => {
    const m = new THREE.Mesh(geometry, M[mat]);
    m.castShadow = m.receiveShadow = !M[mat].transparent;
    if (M[mat].transparent) m.renderOrder = 6;
    return m;
  };

  const globe = new THREE.Group();
  scene.add(globe);
  for (const p of [...world.meshes, ...bakeProps(lib, world.props)]) globe.add(mesh(p.geometry, p.mat));
  placeTextured(texLib, world.props, globe);
  const moverGroups = world.movers.map((m) => {
    const g = new THREE.Group();
    g.position.copy(m.pivot);
    for (const p of [...m.meshes, ...bakeProps(lib, m.props)]) g.add(mesh(p.geometry, p.mat));
    placeTextured(texLib, m.props, g);
    globe.add(g);
    return g;
  });

  // the Underside is in the sea's shadow: lit by its own crystals
  // Everything in a globe that shines — props from the catalogue, lights a globe adds itself,
  // lit lanterns — is a "glow source". A small pool of real lights is handed to whichever
  // sources matter most right now (nearest the marble), fading in and out as you travel, so a
  // globe can have a hundred glowing things and each still lights its surroundings.
  const sources = (world.lights || []).map((L) => ({ pos: L.pos, color: L.color, intensity: L.intensity, distance: L.distance, day: L.day ?? 1, on: true }));
  // glowing props riding on a moving part: the same catalogue glow, carried along with the part
  const riding = [];
  world.movers.forEach((m, i) => { for (const L of m.glows || []) { const s = { pos: L.pos.clone().add(m.pivot), color: L.color, intensity: L.intensity, distance: L.distance, day: L.day ?? 1, on: true }; sources.push(s); riding.push({ s, local: L.pos.clone(), group: moverGroups[i] }); } });
  const POOL = low ? 5 : 9;
  const slots = Array.from({ length: POOL }, () => { const pl = new THREE.PointLight(0xffffff, 0, 8, 1.6); globe.add(pl); return { pl, src: -1, k: 0 }; });
  const scratch = new THREE.Vector3();
  function updateGlow(focus, night, dt) {
    for (const r of riding) r.s.pos.copy(r.local).applyQuaternion(r.group.quaternion).add(r.group.position);
    const eff = (s) => (s.on ? s.intensity * (s.day + (1.35 - s.day) * night) * 0.85 : 0);
    const ranked = sources.map((s, i) => {
      const e = eff(s);
      return { i, score: e <= 0 ? -1 : focus ? e / (1 + scratch.copy(s.pos).sub(focus).lengthSq() / (s.distance * s.distance)) : e };
    }).filter((r) => r.score > 0).sort((a, b) => b.score - a.score).slice(0, POOL).map((r) => r.i);
    const held = new Set(slots.map((sl) => sl.src));
    const waiting = ranked.filter((i) => !held.has(i));
    for (const sl of slots) {
      const keep = sl.src >= 0 && ranked.includes(sl.src);
      sl.k = Math.max(0, Math.min(1, sl.k + (keep ? 3 : -4) * dt));
      if (sl.k === 0 && !keep) {
        sl.src = waiting.length ? waiting.shift() : -1;
        if (sl.src >= 0) { const s = sources[sl.src]; sl.pl.position.copy(s.pos); sl.pl.color.setHex(s.color); sl.pl.distance = s.distance; }
      }
      if (sl.src >= 0) sl.pl.position.copy(sources[sl.src].pos);
      sl.pl.intensity = sl.src >= 0 ? eff(sources[sl.src]) * sl.k : 0;
    }
  }

  const ball = new THREE.Mesh(new THREE.SphereGeometry(BALL_R, 32, 20), new THREE.MeshStandardMaterial({ color: 0xdfe3e8, metalness: 1, roughness: 0.16, envMapIntensity: 1.7, fog: false }));
  ball.castShadow = ball.receiveShadow = true;
  globe.add(ball);
  // when something hides the marble you still see where it is: a soft ghost drawn only where it is occluded
  const ghost = new THREE.Mesh(new THREE.SphereGeometry(BALL_R * 1.04, 24, 16), new THREE.MeshBasicMaterial({ color: 0xfff0d2, transparent: true, opacity: 0.4, depthFunc: THREE.GreaterDepth, depthWrite: false, fog: false }));
  ghost.renderOrder = 5;
  globe.add(ghost);

  // lanterns
  const lanterns = world.lanterns.map((L) => {
    const g = new THREE.Group();
    g.position.copy(L.pos);
    g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), L.up);
    const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.1, 0.24, 12), std(0xf3ecdc, 0.8, 0, { emissive: 0xffa544, emissiveIntensity: 0 }));
    const post = mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.8, 8), 'dowel');
    post.position.y = 0.4;
    const base = mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.06, 10), 'dowel');
    base.position.y = 0.03;
    const cap = mesh(new THREE.ConeGeometry(0.17, 0.12, 12), 'paintRed');
    cap.position.y = 1.1;
    shade.position.y = 0.92;
    shade.castShadow = true;
    g.add(post, base, cap, shade);
    // a lit lantern lights the place it stands in — identically in every globe (LANTERN_GLOW in the
    // asset catalogue). A globe may tint it with lantern.illumination = { color }; brightness and
    // reach are not the globe's to change, so any intensity / distance given there is ignored.
    const il = L.illumination || {};
    if (il.color != null) shade.material.emissive.setHex(il.color);
    const glow = { pos: L.pos.clone().addScaledVector(L.up, 0.92), color: il.color ?? LANTERN_GLOW.color, intensity: LANTERN_GLOW.intensity, distance: LANTERN_GLOW.reach, day: LANTERN_GLOW.day, on: false };
    sources.push(glow);
    globe.add(g);
    return { shade, glow, lit: false };
  });

  // snow: paper flakes that always fall along gravity
  const SN = low ? 260 : 520;
  const snowPos = new Float32Array(SN * 3), snowSeed = new Float32Array(SN);
  const respawn = (i) => {
    let x, y, z;
    do { x = (Math.random() * 2 - 1) * R; y = (Math.random() * 2 - 1) * R; z = (Math.random() * 2 - 1) * R; } while (x * x + y * y + z * z > (R - 0.4) ** 2);
    snowPos[i * 3] = x; snowPos[i * 3 + 1] = y; snowPos[i * 3 + 2] = z;
  };
  for (let i = 0; i < SN; i++) { respawn(i); snowSeed[i] = Math.random() * 100; }
  const snowGeo = new THREE.BufferGeometry();
  snowGeo.setAttribute('position', new THREE.BufferAttribute(snowPos, 3));
  const dot = document.createElement('canvas'); dot.width = dot.height = 32;
  const dc = dot.getContext('2d'), gr = dc.createRadialGradient(16, 16, 0, 16, 16, 16);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.8)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  dc.fillStyle = gr; dc.fillRect(0, 0, 32, 32);
  const snow = new THREE.Points(snowGeo, new THREE.PointsMaterial({ map: new THREE.CanvasTexture(dot), size: 0.075, transparent: true, depthWrite: false, opacity: 0.85, color: 0xfffaf0, fog: false }));
  snow.frustumCulled = false;
  globe.add(snow);
  let burst = 0;
  function updateSnow(dt, g, time) {
    const sp = 0.55 + burst * 5; burst = Math.max(0, burst - dt * 0.4);
    for (let i = 0; i < SN; i++) {
      const s = snowSeed[i], j = i * 3;
      snowPos[j] += (g.x * sp + Math.sin(time * 0.7 + s) * 0.12) * dt * (0.6 + (s % 1) * 0.8);
      snowPos[j + 1] += (g.y * sp + Math.sin(time * 0.9 + s * 1.7) * 0.12) * dt * (0.6 + (s % 1) * 0.8);
      snowPos[j + 2] += (g.z * sp + Math.cos(time * 0.6 + s * 2.3) * 0.12) * dt * (0.6 + (s % 1) * 0.8);
      if (snowPos[j] ** 2 + snowPos[j + 1] ** 2 + snowPos[j + 2] ** 2 > (R - 0.15) ** 2) respawn(i);
    }
    snowGeo.attributes.position.needsUpdate = true;
  }

  // the room: desk, window, shelves, lamp — and the turned cradle the globe rests in
  const bench = new THREE.Group();
  scene.add(bench);
  const TABLE_Y = -13.3, DESK_TONE = 0.36;
  const roomGlow = [];
  roomGltf.scene.traverse((o) => {
    if (!o.isMesh) return;
    o.material.fog = false;
    o.receiveShadow = true;
    o.castShadow = true;
    // The room sits in evening half-light: the lamp's pool, the window and the fairy lights are
    // what is bright. Each kind of surface gets its own response so wood, metal, cloth, glaze
    // and paper read as different things.
    const m = o.material, n = m.name;
    if (!/room_(sky|bulb|shade|moon|fairy)/.test(n)) { m.color.multiplyScalar(0.2); m.envMapIntensity = 0.26; }
    // the desk and the floor are boards (their old finish was a dark mirror with no figure in it)
    if (n === 'room_desk') { m.color.multiplyScalar(2.6); m.roughness = 0.6; m.envMapIntensity = 0.3; boards(m, { along: 'x', width: 17, scale: 1, depth: 0.4, gap: 0.22 }); }
    else if (n === 'room_floor') { m.color.multiplyScalar(1.3); m.roughness = 0.7; m.envMapIntensity = 0.28; boards(m, { along: 'z', width: 22.5, scale: 0.5, depth: 0.3, gap: 0.35 }); }
    else if (/room_(wood|peg|wains)|^birch$/.test(n)) { m.roughness = 0.6; grain(m, 0.22, 0.34, 0.25); m.envMapIntensity = 0.6; }
    else if (/room_(metal|steel|tin|brass)/.test(n)) { m.metalness = 1; m.roughness = n === 'room_metal' ? 0.45 : 0.24; m.envMapIntensity = 1.3; if (n !== 'room_brass') m.color.multiplyScalar(2.2); }
    else if (/room_(curtain|fabric|rug|cat)/.test(n)) { m.roughness = 1; m.sheen = 0; }
    // the cutting mat is dull rubber: it takes the lamp's pool softly and reflects nothing
    else if (n === 'room_mat') { m.roughness = 0.97; m.metalness = 0; m.envMapIntensity = 0.06; m.color.multiplyScalar(0.8); }
    else if (/room_(trim|terra|wax)/.test(n)) { m.roughness = n === 'room_trim' ? 0.28 : 0.7; m.envMapIntensity = 0.8; }
    else if (/room_(paper|b\d)/.test(n)) m.roughness = 0.85;
    else if (/paint(Red|Blue|Yellow)|room_tea/.test(n)) { m.roughness = 0.2; m.envMapIntensity = 0.9; }
    if (n === 'room_sky') { m.emissiveIntensity = 0.12; m.roughness = 0.08; m.envMapIntensity = 1.2; }
    if (m.emissiveIntensity > 0 && m.emissive && m.emissive.getHex() && !roomGlow.some((r) => r.m === m)) roomGlow.push({ m, base: m.emissiveIntensity, keep: 0 });
  });
  bench.add(roomGltf.scene);
  // the desk is a textured model of its own (tools/blender_desk.py; oak, textures made with Meshy).
  // It arrives a moment after the room; a missing file must not stop the game.
  loader.loadAsync(publicAssetUrl('/assets/room_desk.glb')).then((g) => {
    g.scene.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = o.receiveShadow = true;
      const m = o.material;
      m.fog = false; m.metalness = 0; m.metalnessMap = null;
      m.color.setRGB(DESK_TONE * 0.92, DESK_TONE, DESK_TONE * 1.06);            // a touch cooler than the texture: the warm lamp puts the red back                                          // the room is in evening half-light: same dimming as every other surface in it
      m.roughness = 1; m.envMapIntensity = 0.22;                             // oiled, not varnished: the roughness map does the rest
      if (m.normalMap) m.normalScale.setScalar(0.8);
      for (const t of [m.map, m.normalMap, m.roughnessMap]) if (t) t.anisotropy = 8;
    });
    bench.add(g.scene);
  }).catch((err) => console.warn('the desk failed to load', err));
  // what is outside the window: a painted evening — hills, a village, a far lighthouse, a low moon
  const outside = buildOutside(lib);
  bench.add(outside.group);
  // a low cradle, so the underside of the globe stays in view
  const prof = [[3.4, 0], [6.4, 0], [6.6, 0.25], [5.6, 0.7], [5.2, 1.5], [5.6, 2.1], [5.2, 2.4], [4.4, 2.2], [3.4, 1.2], [3.4, 0]].map(([x, y]) => new THREE.Vector2(x, y));
  const standMat = grain(std(0xdcbf8e, 0.6), 30, 0.26, 0.3); standMat.fog = false;
  const stand = new THREE.Mesh(new THREE.LatheGeometry(prof, 72), standMat);
  stand.position.y = TABLE_Y; stand.castShadow = stand.receiveShadow = true;
  bench.add(stand);
  // the desk lamp is a real spotlight with shadows: a warm pool on the desk, long shadows off the clutter
  const lampLight = new THREE.SpotLight(0xffc48a, 7000, 420, 0.95, 0.75, 1.9);
  lampLight.position.set(-42, 36, 20);
  lampLight.target.position.set(14, -13, -2);
  lampLight.castShadow = true;
  lampLight.shadow.mapSize.setScalar(low ? 512 : 1024);
  lampLight.shadow.camera.near = 6; lampLight.shadow.camera.far = 320;
  lampLight.shadow.bias = -0.002; lampLight.shadow.radius = 6;
  bench.add(lampLight, lampLight.target);
  const candle = new THREE.PointLight(0xff9a4a, 900, 120, 2);
  candle.position.set(-34, -5, -26);
  bench.add(candle);

  // one cube capture of the room from the globe's centre: used for the glass reflections,
  // and as the (parallax-free) backdrop while you are inside the globe
  const cubeRT = new THREE.WebGLCubeRenderTarget(low ? 256 : 512, { type: THREE.HalfFloatType, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter });
  const cubeCam = new THREE.CubeCamera(2, 2400, cubeRT);
  globe.visible = false;
  cubeCam.update(renderer, scene);
  globe.visible = true;
  scene.background = cubeRT.texture;
  scene.backgroundBlurriness = 0.1;
  scene.backgroundIntensity = 1.0;

  // the glass: two surfaces (inside and outside of a thick wall), fresnel-weighted reflections of the room
  const glassMats = [];
  const glassShell = (radius, a0, a1, power) => {
    const m = new THREE.MeshStandardMaterial({ color: 0xf4fbff, metalness: 1, roughness: 0.02, envMap: cubeRT.texture, envMapIntensity: 1.5, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false });
    m.onBeforeCompile = (sh) => {
      sh.fragmentShader = sh.fragmentShader.replace('#include <dithering_fragment>', `
        float fr = pow(1.0 - abs(dot(normalize(vNormal), normalize(vViewPosition))), ${power.toFixed(1)});
        gl_FragColor.a = mix(${a0.toFixed(3)}, ${a1.toFixed(3)}, fr);
        #include <dithering_fragment>`);
    };
    m.customProgramCacheKey = () => `glass${a0}${a1}${power}`;
    const g = new THREE.Mesh(new THREE.SphereGeometry(radius, 96, 64), m);
    g.renderOrder = 10;
    scene.add(g);
    glassMats.push(m);
    return g;
  };
  glassShell(R + 0.05, 0.02, 0.5, 3.0);
  glassShell(R + 0.4, 0.045, 0.9, 2.2);

  // marble finder for the outside view
  const ringC = document.createElement('canvas'); ringC.width = ringC.height = 64;
  const rc = ringC.getContext('2d');
  rc.strokeStyle = 'rgba(255,244,214,0.95)'; rc.lineWidth = 3; rc.beginPath(); rc.arc(32, 32, 26, 0, Math.PI * 2); rc.stroke();
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(ringC), depthTest: false, transparent: true, opacity: 0, fog: false }));
  halo.scale.setScalar(1.5); halo.renderOrder = 20;
  scene.add(halo);

  // post-processing
  const rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: low ? 2 : 4, depthTexture: new THREE.DepthTexture(4, 4) });
  const bA = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType }), bB = bA.clone(), bC = bA.clone();
  const fsq = (fragmentShader, uniforms, defines = {}) => new THREE.ShaderMaterial({ vertexShader: FS_VERT, fragmentShader, uniforms, defines, depthTest: false, depthWrite: false });
  const brightMat = fsq(BRIGHT_FRAG, { tColor: { value: rt.texture } });
  const blurMat = fsq(BLUR_FRAG, { tColor: { value: null }, uDir: { value: new THREE.Vector2() } });
  const post = fsq(POST_FRAG, {
    tColor: { value: rt.texture }, tDepth: { value: rt.depthTexture }, tBloom: { value: bC.texture }, uNear: { value: camera.near }, uFar: { value: camera.far },
    uFocus: { value: 3 }, uAperture: { value: 1 }, uMaxBlur: { value: 4 }, uVignette: { value: 0.64 }, uTime: { value: 0 }, uBloom: { value: 0.55 }, uTexel: { value: new THREE.Vector2() },
  }, { TAPS: low ? 10 : 22 });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), post);
  quad.frustumCulled = false;
  const postScene = new THREE.Scene(); postScene.add(quad);
  const postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const pass = (material, target) => { quad.material = material; renderer.setRenderTarget(target); renderer.render(postScene, postCam); };

  let pr = 1, bw = 1, bh = 1;
  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    pr = Math.min(window.devicePixelRatio || 1, low ? 1.5 : 2);
    renderer.setPixelRatio(pr);
    renderer.setSize(w, h, false);
    const W = Math.round(w * pr), H = Math.round(h * pr);
    rt.setSize(W, H);
    bw = Math.max(2, W >> 2); bh = Math.max(2, H >> 2);
    bA.setSize(W >> 1, H >> 1); bB.setSize(bw, bh); bC.setSize(bw, bh);
    post.uniforms.uTexel.value.set(1 / W, 1 / H);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  function render({ focus, aperture, shadowCenter, shadowSize, showBench, near, far, time, ghostAlpha, haze, night: zoneNight = 0, dark = 0, glowFocus: focus3 = null }) {
    key.target.position.copy(shadowCenter);
    key.position.copy(shadowCenter).addScaledVector(KEY_DIR, 40);
    const sc = key.shadow.camera;
    if (sc.right !== shadowSize) { sc.left = sc.bottom = -shadowSize; sc.right = sc.top = shadowSize; sc.updateProjectionMatrix(); }
    bench.visible = showBench;
    // night: daylight and room light fade, the globe's own lights and emissives carry the scene
    // `dark` is the light switch: the whole room goes out and only what glows inside the globe is left.
    const night = Math.max(zoneNight, dark), on = 1 - dark;
    key.intensity = 2.85 * (1 - 0.9 * night) * (1 - 0.92 * dark);
    rim.intensity = 0.8 * (1 - 0.85 * night) * (1 - 0.6 * dark);
    hemi.intensity = 0.22 * (1 - 0.6 * night) * (1 - 0.85 * dark);
    scene.environmentIntensity = 0.42 * (1 - 0.8 * night) * (1 - 0.8 * dark);
    scene.backgroundIntensity = (1.0 - 0.88 * night) * (1 - 0.6 * dark);
    for (const gm of glassMats) gm.envMapIntensity = 1.5 * (1 - 0.8 * night);
    lampLight.intensity = 6000 * on; candle.intensity = 900 * on;
    for (const r of roomGlow) r.m.emissiveIntensity = r.base * (r.keep + (1 - r.keep) * on);
    outside.dim(dark);
    updateGlow(focus3, night, 1 / 60);
    scene.fog.color.copy(FOG_DAY).lerp(FOG_NIGHT, night);
    scene.fog.density = haze * (1 + 1.6 * night);
    post.uniforms.uBloom.value = 0.46 + 0.14 * night;
    ghost.position.copy(ball.position);
    ghost.material.opacity = ghostAlpha;
    if (Math.abs(camera.near - near) > 1e-3 || camera.far !== far) { camera.near = near; camera.far = far; camera.updateProjectionMatrix(); }
    post.uniforms.uNear.value = camera.near; post.uniforms.uFar.value = camera.far;
    post.uniforms.uFocus.value = focus;
    post.uniforms.uAperture.value = aperture;
    post.uniforms.uMaxBlur.value = (low ? 3 : 4) * pr;
    post.uniforms.uTime.value = time % 10;
    renderer.setRenderTarget(rt);
    renderer.render(scene, camera);
    pass(brightMat, bA);
    blurMat.uniforms.tColor.value = bA.texture; blurMat.uniforms.uDir.value.set(1 / bw, 0); pass(blurMat, bB);
    blurMat.uniforms.tColor.value = bB.texture; blurMat.uniforms.uDir.value.set(0, 1 / bh); pass(blurMat, bC);
    blurMat.uniforms.tColor.value = bC.texture; blurMat.uniforms.uDir.value.set(2.2 / bw, 0); pass(blurMat, bB);
    blurMat.uniforms.tColor.value = bB.texture; blurMat.uniforms.uDir.value.set(0, 2.2 / bh); pass(blurMat, bC);
    pass(post, null);
  }

  function setLantern(i, on) {
    const lantern = lanterns[i];
    lantern.lit = on;
    lantern.shade.material.emissiveIntensity = on ? 3.4 : 0;
    lantern.glow.on = on;
  }

  return { renderer, scene, camera, globe, ball, moverGroups, halo, render, updateSnow, setLantern, snowBurst: () => { burst = 1; } };
}
