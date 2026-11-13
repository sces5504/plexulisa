# Plexulisa — the maker's desk as its own textured model (the rest of the room is flat-colour).
# Always run headless; it never touches an open Blender session:
#   B=/Applications/Blender.app/Contents/MacOS/Blender
#   $B -b --factory-startup --python tools/blender_desk.py -- white            -> assets/source/room_desk/desk_white.glb (UV-unwrapped, for Meshy retexture)
#   $B -b --factory-startup --python tools/blender_desk.py -- bake <meshy.glb> -> public/assets/room_desk.glb (our mesh + Meshy's PBR textures at 2k)
# Same footprint and height as the desk that used to be part of tools/blender_room.py, in the
# room's own coordinates (globe centre = origin, Blender Z up), so the game just adds it to the room.
import bpy, bmesh, math, os, sys
from mathutils import Matrix

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) + "/"
TABLE = -13.3
DX, DY, DW, DD = 12, 6, 210, 104


def build():
    bm = bmesh.new()

    def box(sx, sy, sz, c, bevel=0.5):
        b = bmesh.new()
        bmesh.ops.create_cube(b, size=1.0)
        bmesh.ops.scale(b, verts=b.verts, vec=(sx, sy, sz))
        if bevel:
            bmesh.ops.bevel(b, geom=list(b.edges), offset=bevel, segments=3, profile=0.5, affect="EDGES", clamp_overlap=True)
        bmesh.ops.translate(b, verts=b.verts, vec=c)
        me = bpy.data.meshes.new("t"); b.to_mesh(me); b.free(); bm.from_mesh(me); bpy.data.meshes.remove(me)

    def knob(x, y, z):
        b = bmesh.new()
        bmesh.ops.create_uvsphere(b, u_segments=12, v_segments=8, radius=1.3)
        bmesh.ops.scale(b, verts=b.verts, vec=(1, 0.8, 1))
        bmesh.ops.translate(b, verts=b.verts, vec=(x, y, z))
        me = bpy.data.meshes.new("t"); b.to_mesh(me); b.free(); bm.from_mesh(me); bpy.data.meshes.remove(me)

    front, back = DY - DD / 2, DY + DD / 2
    box(DW, DD, 4.5, (DX, DY, TABLE - 2.25), 0.9)                                    # the top: one thick slab, eased edges
    box(DW - 22, 3, 13, (DX, front + 9, TABLE - 11), 0.4)                            # aprons
    box(DW - 22, 3, 13, (DX, back - 9, TABLE - 11), 0.4)
    for sx in (-1, 1):
        box(3, DD - 22, 13, (DX + sx * (DW / 2 - 11), DY, TABLE - 11), 0.4)
        for y in (front + 9, back - 9):                                              # square legs, a foot at the bottom
            box(8, 8, 82, (DX + sx * (DW / 2 - 11), y, TABLE - 45.5), 0.7)
            box(9.5, 9.5, 3, (DX + sx * (DW / 2 - 11), y, TABLE - 85), 0.5)
        box(3.5, DD - 26, 5, (DX + sx * (DW / 2 - 11), DY, TABLE - 68), 0.5)         # side stretchers
    box(DW - 26, 3.5, 5, (DX, DY + 6, TABLE - 68), 0.5)                              # the long stretcher between them
    for x in (DX - 58, DX, DX + 58):                                                 # three drawer fronts with turned knobs
        box(50, 1.6, 9.5, (x, front + 7.3, TABLE - 11), 0.35)
        knob(x, front + 5.6, TABLE - 11)

    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    for f in bm.faces:
        f.smooth = True
    me = bpy.data.meshes.new("room_desk")
    bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new("room_desk", me)
    bpy.context.scene.collection.objects.link(ob)
    for o in bpy.data.objects:
        o.select_set(o is ob)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=math.radians(60), island_margin=0.004, area_weight=1.0, scale_to_bounds=False)
    bpy.ops.object.mode_set(mode="OBJECT")
    mat = bpy.data.materials.new("room_desk_tex"); mat.use_nodes = True
    me.materials.append(mat)
    return ob


def export(ob, path, **kw):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    for o in bpy.data.objects:
        o.select_set(o is ob)
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=True, export_apply=True, export_yup=True, **kw)
    return os.path.getsize(path)


args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
if args[:1] == ["white"]:
    ob = build()
    print("DESK", export(ob, ROOT + "assets/source/room_desk/desk_white.glb"), "bytes,", len(ob.data.polygons), "faces")
elif args[:1] == ["bake"]:
    ob = build()
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=args[1])
    src = next(o for o in bpy.data.objects if o not in before and o.type == "MESH")
    ob.data.materials.clear()
    ob.data.materials.append(src.data.materials[0])
    ob.data.materials[0].name = "room_desk_tex"
    for o in [o for o in bpy.data.objects if o not in before]:
        bpy.data.objects.remove(o, do_unlink=True)
    size = int(args[2]) if len(args) > 2 else 2048
    for img in bpy.data.images:
        if img.size[0] > size:
            img.scale(size, size)
    print("DESK", export(ob, ROOT + "public/assets/room_desk.glb", export_image_format="JPEG", export_jpeg_quality=88), "bytes,",
          sum(len(p.vertices) - 2 for p in ob.data.polygons), "tris, images", [(i.name, tuple(i.size)) for i in bpy.data.images if i.size[0]])
