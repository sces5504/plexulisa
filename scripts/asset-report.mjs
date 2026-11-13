// Inspect GLB files against the web budget — no dependencies.
//   node scripts/asset-report.mjs public/props.glb public/assets/*.glb
//   node scripts/asset-report.mjs file.glb --json
// Reports, per top-level object: triangles, materials, local bounds; and per file: size,
// textures (count, bytes, largest dimension when it can be read), draw primitives.
import { readFileSync, statSync } from 'node:fs';
import { basename } from 'node:path';

export function inspectGlb(path) {
  const buf = readFileSync(path);
  if (buf.readUInt32LE(0) !== 0x46546c67) throw new Error(`${path}: not a GLB`);
  const jsonLen = buf.readUInt32LE(12);
  const gltf = JSON.parse(buf.subarray(20, 20 + jsonLen).toString('utf8'));
  const binStart = 20 + jsonLen + 8;
  const acc = gltf.accessors || [], meshes = gltf.meshes || [], mats = gltf.materials || [], nodes = gltf.nodes || [];

  const primTris = (p) => (p.indices != null ? acc[p.indices].count : acc[p.attributes.POSITION].count) / 3;
  const objects = [];
  const visit = (i, into) => {
    const n = nodes[i];
    if (n.mesh != null) for (const p of meshes[n.mesh].primitives) {
      into.tris += primTris(p); into.prims++;
      if (p.material != null) into.materials.add(mats[p.material].name || `#${p.material}`);
      const a = acc[p.attributes.POSITION];
      if (a.min && a.max) for (let k = 0; k < 3; k++) { into.min[k] = Math.min(into.min[k], a.min[k]); into.max[k] = Math.max(into.max[k], a.max[k]); }
      if (p.attributes.TEXCOORD_0 != null) into.uv = true;
    }
    for (const c of n.children || []) visit(c, into);
  };
  for (const root of (gltf.scenes?.[gltf.scene ?? 0]?.nodes) || []) {
    const o = { name: nodes[root].name || `node${root}`, tris: 0, prims: 0, materials: new Set(), min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity], uv: false };
    visit(root, o);
    if (o.prims) objects.push({ name: o.name, tris: Math.round(o.tris), prims: o.prims, uv: o.uv, materials: [...o.materials], size: o.max.map((v, k) => +(v - o.min[k]).toFixed(2)) });
  }

  const images = (gltf.images || []).map((im) => {
    const out = { name: im.name || im.uri || '?', mime: im.mimeType || '', bytes: 0, dim: null };
    if (im.bufferView != null) {
      const bv = gltf.bufferViews[im.bufferView], d = buf.subarray(binStart + (bv.byteOffset || 0), binStart + (bv.byteOffset || 0) + bv.byteLength);
      out.bytes = bv.byteLength;
      if (d.readUInt32BE(0) === 0x89504e47) out.dim = [d.readUInt32BE(16), d.readUInt32BE(20)];                 // PNG
      else if (d[0] === 0xff && d[1] === 0xd8) {                                                                   // JPEG: find SOFn
        for (let i = 2; i < d.length - 9;) { if (d[i] !== 0xff) { i++; continue; } const m = d[i + 1]; if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) { out.dim = [d.readUInt16BE(i + 7), d.readUInt16BE(i + 5)]; break; } i += 2 + d.readUInt16BE(i + 2); }
      } else if (d.toString('ascii', 0, 4) === 'RIFF' && d.toString('ascii', 12, 16) === 'VP8X') out.dim = [1 + d.readUIntLE(24, 3), 1 + d.readUIntLE(27, 3)];  // WebP (extended)
    }
    return out;
  });
  return {
    file: path, bytes: statSync(path).size, objects, images,
    tris: objects.reduce((s, o) => s + o.tris, 0), prims: objects.reduce((s, o) => s + o.prims, 0),
    textureBytes: images.reduce((s, i) => s + i.bytes, 0), extensions: gltf.extensionsUsed || [],
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2), json = args.includes('--json'), files = args.filter((a) => !a.startsWith('--'));
  if (!files.length) { console.error('usage: node scripts/asset-report.mjs <file.glb> [...] [--json]'); process.exit(2); }
  const reports = files.map(inspectGlb);
  if (json) { console.log(JSON.stringify(reports, null, 2)); process.exit(0); }
  const kb = (b) => (b / 1024).toFixed(0).padStart(6) + ' KB';
  for (const r of reports) {
    console.log(`\n${basename(r.file)}  ${kb(r.bytes)}  ${r.tris} tris  ${r.prims} draw primitives  ${r.images.length} textures (${kb(r.textureBytes).trim()})${r.extensions.length ? '  ext: ' + r.extensions.join(', ') : ''}`);
    for (const o of r.objects) console.log(`  ${o.name.padEnd(18)} ${String(o.tris).padStart(7)} tris  ${String(o.prims).padStart(2)} prims  ${o.size.join(' x ').padEnd(22)} ${o.uv ? 'uv ' : '   '} ${o.materials.join(', ')}`);
    for (const i of r.images) console.log(`  [tex] ${i.name.padEnd(24)} ${i.dim ? i.dim.join('x') : '?'}  ${kb(i.bytes).trim()}  ${i.mime}`);
  }
}
