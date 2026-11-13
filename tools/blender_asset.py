# Plexulisa — turn a raw textured model (e.g. a Meshy download) into a web-ready shared asset.
# Run inside Blender:  exec(open(this file).read());  process("id", "/path/raw.glb", height=2.0, ...)
#
# It works in its own scene ("PlexulisaAssets") and writes:
#   public/assets/<id>.glb            decimated, textures shrunk, origin at base centre, Y-up
#   src/assets.collision.json[<id>]   a much lighter mesh for physics, in game axes
import bpy, bmesh, json, os, time

ROOT = "/Users/roy/Documents/ChatGPT/plexulisa/"


def process(asset_id, src, height=2.0, tris=14000, collision_tris=700, texture=1024, turn=0.0):
    t0 = time.time()
    scene = bpy.data.scenes.get("PlexulisaAssets") or bpy.data.scenes.new("PlexulisaAssets")
    bpy.context.window.scene = scene
    for o in list(scene.collection.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    bpy.ops.import_scene.gltf(filepath=src)
    meshes = [o for o in scene.collection.all_objects if o.type == "MESH"]
    for o in scene.collection.all_objects:
        o.select_set(o.type == "MESH")
    bpy.context.view_layer.objects.active = meshes[0]
    if len(meshes) > 1:
        bpy.ops.object.join()
    ob = bpy.context.view_layer.objects.active
    bpy.ops.object.parent_clear(type="CLEAR_KEEP_TRANSFORM")
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    for o in list(scene.collection.all_objects):
        if o != ob:
            bpy.data.objects.remove(o, do_unlink=True)
    ob.name = asset_id
    n0 = sum(len(p.vertices) - 2 for p in ob.data.polygons)

    def decimate(o, target):
        cur = sum(len(p.vertices) - 2 for p in o.data.polygons)
        if cur <= target:
            return
        m = o.modifiers.new("dec", "DECIMATE")
        m.ratio = target / cur
        bpy.context.view_layer.objects.active = o
        bpy.ops.object.modifier_apply(modifier=m.name)

    decimate(ob, tris)
    # stand it on the origin, at the requested height, facing as asked
    ob.rotation_euler[2] = turn
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    xs = [v.co.x for v in ob.data.vertices]; ys = [v.co.y for v in ob.data.vertices]; zs = [v.co.z for v in ob.data.vertices]
    s = height / (max(zs) - min(zs))
    cx, cy, z0 = (max(xs) + min(xs)) / 2, (max(ys) + min(ys)) / 2, min(zs)
    for v in ob.data.vertices:
        v.co.x = (v.co.x - cx) * s; v.co.y = (v.co.y - cy) * s; v.co.z = (v.co.z - z0) * s
    ob.data.update()
    for p in ob.data.polygons:
        p.use_smooth = True
    for img in bpy.data.images:
        if img.size[0] > texture:
            img.scale(texture, texture)

    # collision proxy
    bpy.ops.object.select_all(action="DESELECT")
    ob.select_set(True); bpy.context.view_layer.objects.active = ob
    bpy.ops.object.duplicate()
    col = bpy.context.view_layer.objects.active
    decimate(col, collision_tris)
    col.data.calc_loop_triangles()
    pos = []
    for v in col.data.vertices:
        pos += [round(v.co.x, 4), round(v.co.z, 4), round(-v.co.y, 4)]
    idx = []
    for t in col.data.loop_triangles:
        idx += list(t.vertices)
    path = ROOT + "src/assets.collision.json"
    data = json.load(open(path)) if os.path.exists(path) else {}
    data[asset_id] = {"p": pos, "i": idx}
    json.dump(data, open(path, "w"), separators=(",", ":"))
    ctris = len(idx) // 3
    bpy.data.objects.remove(col, do_unlink=True)

    bpy.ops.object.select_all(action="DESELECT")
    ob.select_set(True); bpy.context.view_layer.objects.active = ob
    out = ROOT + f"public/assets/{asset_id}.glb"
    bpy.ops.export_scene.gltf(filepath=out, export_format="GLB", use_selection=True, export_apply=True, export_yup=True,
                              export_image_format="JPEG", export_jpeg_quality=85)
    n1 = sum(len(p.vertices) - 2 for p in ob.data.polygons)
    return {"id": asset_id, "tris_before": n0, "tris": n1, "collision_tris": ctris, "size": [round(d, 2) for d in ob.dimensions],
            "bytes": os.path.getsize(out), "seconds": round(time.time() - t0, 1)}
