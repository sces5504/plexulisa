# Plexulisa — run tools/blender_asset.py without a window (never touches an open Blender):
#   Blender -b --factory-startup --python tools/blender_asset_cli.py -- <id> <raw.glb> <height> <tris> [hue:<new id>:<from°>:<to°>:<shift°>]
# The optional hue step re-exports the same model under a second id with part of its colour wheel
# turned (e.g. pink blossom -> amber leaves), sharing the first one's collision mesh.
import bpy, sys, json, os, colorsys
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) + "/"
src = open(ROOT + "tools/blender_asset.py").read()
# headless: there is no window to switch scenes in, so work in the (empty, factory) current scene
src = src.replace('bpy.data.scenes.get("PlexulisaAssets") or bpy.data.scenes.new("PlexulisaAssets")', "bpy.context.scene").replace("bpy.context.window.scene = scene", "pass")
exec(src)
for o in list(bpy.data.objects):          # the factory scene's cube, light and camera
    bpy.data.objects.remove(o, do_unlink=True)

args = sys.argv[sys.argv.index("--") + 1:]
asset_id, raw, height, tris = args[0], args[1], float(args[2]), int(args[3])
out = [process(asset_id, raw, height=height, tris=tris)]
for extra in args[4:]:
    _, new_id, h0, h1, shift = extra.split(":")
    h0, h1, shift = float(h0) / 360, float(h1) / 360, float(shift) / 360
    for img in bpy.data.images:
        if not img.size[0] or img.colorspace_settings.name != "sRGB":
            continue
        px = np.array(img.pixels[:], dtype=np.float32).reshape(-1, 4)
        r, g, b = px[:, 0], px[:, 1], px[:, 2]
        mx, mn = px[:, :3].max(1), px[:, :3].min(1); d = mx - mn + 1e-6
        h = np.where(mx == r, ((g - b) / d) % 6, np.where(mx == g, (b - r) / d + 2, (r - g) / d + 4)) / 6
        s = d / (mx + 1e-6)
        sel = (h >= h0) & (h <= h1) & (s > 0.12)
        hn = (h + shift) % 1; sn = np.clip(s * 1.9, 0, 1); v = mx * 0.92
        i = np.floor(hn * 6); f = hn * 6 - i; p = v * (1 - sn); q = v * (1 - f * sn); t = v * (1 - (1 - f) * sn); i = i.astype(int) % 6
        nr = np.choose(i, [v, q, p, p, t, v]); ng = np.choose(i, [t, v, v, q, p, p]); nb = np.choose(i, [p, p, t, v, v, q])
        px[sel, 0], px[sel, 1], px[sel, 2] = nr[sel], ng[sel], nb[sel]
        img.pixels[:] = px.reshape(-1).tolist()
    ob = bpy.context.view_layer.objects.active
    ob.name = new_id
    path = ROOT + f"public/assets/{new_id}.glb"
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=True, export_apply=True, export_yup=True, export_image_format="JPEG", export_jpeg_quality=85)
    col = ROOT + "src/assets.collision.json"
    data = json.load(open(col)); data[new_id] = data[asset_id]; json.dump(data, open(col, "w"), separators=(",", ":"))
    out.append({"id": new_id, "bytes": os.path.getsize(path), "from": asset_id})
json.dump(out, open(ROOT + f"assets/source/{asset_id}/processed.json", "w"), indent=1)
print("PROCESSED", json.dumps(out))
