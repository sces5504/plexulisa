# Plexulisa asset pack "atelier" — run inside Blender (exec this file), then call export() and
# export_collision() (see the last line). It builds in its OWN scene ("PlexulisaAtelier") and writes
# its OWN files (public/packs/atelier.glb, src/packs/atelier.collision.json), so the original
# props (tools/blender_props.py -> public/props.glb) are never rebuilt or touched by it.
# Same conventions: game units, Blender Z = game up, origin at the base centre, and material
# NAMES are what matter (src/render.js makeMaterials swaps them for the game's shaders).
# To start another pack, copy this file, change SCENE and the prop list.
import bpy, bmesh, math, os, sys
SCENE = "PlexulisaAtelier"
from mathutils import Vector, Matrix


COLORS = {
    "paintCream": (0.89, 0.81, 0.65), "paintRed": (0.64, 0.07, 0.045), "paintBlue": (0.05, 0.21, 0.37),
    "paintYellow": (0.87, 0.46, 0.045), "paintNavy": (0.025, 0.045, 0.1), "birch": (0.81, 0.62, 0.36),
    "ply": (0.68, 0.46, 0.22), "dowel": (0.69, 0.45, 0.19), "woodDark": (0.16, 0.07, 0.03),
    "brass": (0.63, 0.39, 0.1), "paper": (0.93, 0.9, 0.82), "treeA": (0.05, 0.23, 0.18),
    "treeB": (0.27, 0.43, 0.16), "lamp": (1.0, 0.75, 0.4), "body": (0.89, 0.81, 0.65), "roof": (0.64, 0.07, 0.045),
}


def material(name):
    m = bpy.data.materials.get(name)
    if m is None:
        m = bpy.data.materials.new(name)
        m.use_nodes = True
    bsdf = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    c = COLORS[name]
    bsdf.inputs["Base Color"].default_value = (c[0], c[1], c[2], 1)
    bsdf.inputs["Roughness"].default_value = 0.3 if name == "brass" else 0.65
    bsdf.inputs["Metallic"].default_value = 1.0 if name == "brass" else 0.0
    return m


# headless: build straight into the (empty, throw-away) startup scene, which is the one glTF export evaluates
scene = bpy.context.scene if bpy.app.background else (bpy.data.scenes.get(SCENE) or bpy.data.scenes.new(SCENE))
for o in list(scene.collection.objects):
    me = o.data
    bpy.data.objects.remove(o, do_unlink=True)
    if me and me.users == 0:
        bpy.data.meshes.remove(me)

T = Matrix.Translation
RZ = lambda a: Matrix.Rotation(a, 4, "Z")
RX = lambda a: Matrix.Rotation(a, 4, "X")
RY = lambda a: Matrix.Rotation(a, 4, "Y")


# ---- builders (each fills a fresh bmesh) ---------------------------------
def cyl(r1, r2, h, z0=0.0, seg=32):
    def f(bm):
        bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=seg, radius1=r1, radius2=r2, depth=h)
        bmesh.ops.translate(bm, verts=bm.verts, vec=(0, 0, z0 + h / 2))
    return f


def box(sx, sy, sz, c=(0, 0, 0)):
    def f(bm):
        bmesh.ops.create_cube(bm, size=1.0)
        bmesh.ops.scale(bm, verts=bm.verts, vec=(sx, sy, sz))
        bmesh.ops.translate(bm, verts=bm.verts, vec=c)
    return f


def sphere(r, c=(0, 0, 0), s=(1, 1, 1), u=24, v=12):
    def f(bm):
        bmesh.ops.create_uvsphere(bm, u_segments=u, v_segments=v, radius=r)
        bmesh.ops.scale(bm, verts=bm.verts, vec=s)
        bmesh.ops.translate(bm, verts=bm.verts, vec=c)
    return f


def torus(R, r, z=0.0, seg=40, tube=8):
    def f(bm):
        rings = []
        for i in range(seg):
            a = 2 * math.pi * i / seg
            rings.append([bm.verts.new(((R + r * math.cos(2 * math.pi * j / tube)) * math.cos(a),
                                        (R + r * math.cos(2 * math.pi * j / tube)) * math.sin(a),
                                        z + r * math.sin(2 * math.pi * j / tube))) for j in range(tube)])
        for i in range(seg):
            A, B = rings[i], rings[(i + 1) % seg]
            for j in range(tube):
                bm.faces.new((A[j], B[j], B[(j + 1) % tube], A[(j + 1) % tube]))
    return f


def prism(w, h, d, z0=0.0):
    """gable roof: ridge along Y, width w along X, height h, length d."""
    def f(bm):
        vs = [bm.verts.new(p) for p in [(-w / 2, -d / 2, z0), (w / 2, -d / 2, z0), (0, -d / 2, z0 + h),
                                        (-w / 2, d / 2, z0), (w / 2, d / 2, z0), (0, d / 2, z0 + h)]]
        for q in [(0, 1, 2), (5, 4, 3), (0, 3, 4, 1), (1, 4, 5, 2), (2, 5, 3, 0)]:
            bm.faces.new([vs[i] for i in q])
    return f


def slab(outline, thick, holes=()):
    """extrude a 2D outline (list of (x, z)) into a plate of thickness `thick` along Y, centred."""
    def f(bm):
        loops = []
        for pts in (outline,) + tuple(holes):
            vs = [bm.verts.new((x, 0, z)) for x, z in pts]
            loops.append([bm.edges.new((vs[i], vs[(i + 1) % len(vs)])) for i in range(len(vs))])
        if holes:
            bmesh.ops.triangle_fill(bm, edges=[e for l in loops for e in l], use_beauty=True)
        else:
            bm.faces.new([e.verts[0] for e in loops[0]])
        faces = list(bm.faces)
        ext = bmesh.ops.extrude_face_region(bm, geom=faces)
        bmesh.ops.translate(bm, verts=[v for v in ext["geom"] if isinstance(v, bmesh.types.BMVert)], vec=(0, thick, 0))
        bmesh.ops.translate(bm, verts=bm.verts, vec=(0, -thick / 2, 0))
    return f


class Prop:
    def __init__(self, name):
        self.name, self.bm, self.mats = name, bmesh.new(), []

    def add(self, build, mat, bevel=0.02, M=None, seg=2):
        bm = bmesh.new()
        build(bm)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        if bevel:
            edges = [e for e in bm.edges if len(e.link_faces) == 2 and e.calc_face_angle(0) > math.radians(35)]
            if edges:
                bmesh.ops.bevel(bm, geom=edges, offset=bevel, segments=seg, profile=0.5, affect="EDGES", clamp_overlap=True)
        if M is not None:
            bmesh.ops.transform(bm, matrix=M, verts=bm.verts)
        me = bpy.data.meshes.new("tmp")
        bm.to_mesh(me)
        bm.free()
        if mat not in self.mats:
            self.mats.append(mat)
        n0 = len(self.bm.faces)
        self.bm.from_mesh(me)
        bpy.data.meshes.remove(me)
        self.bm.faces.ensure_lookup_table()
        for fc in self.bm.faces[n0:]:
            fc.material_index = self.mats.index(mat)
        return self

    def finish(self, x=0.0):
        bm = self.bm
        bmesh.ops.recalc_face_normals(bm, faces=[f for f in bm.faces])
        for fc in bm.faces:
            fc.smooth = True
        for e in bm.edges:
            if len(e.link_faces) == 2 and e.calc_face_angle(0) > math.radians(24):
                e.smooth = False
        me = bpy.data.meshes.new(self.name)
        bm.to_mesh(me)
        bm.free()
        for m in self.mats:
            me.materials.append(material(m))
        ob = bpy.data.objects.new(self.name, me)
        ob.location = (x, 0, 0)
        scene.collection.objects.link(ob)
        return ob


# ---- props ------------------------------------------------------------------

def lathe(profile, seg=32):
    """revolve a list of (r, z) around Z; r == 0 closes the end."""
    def f(bm):
        rings = []
        for r, z in profile:
            if r < 1e-6:
                rings.append([bm.verts.new((0, 0, z))])
            else:
                rings.append([bm.verts.new((r * math.cos(2 * math.pi * i / seg), r * math.sin(2 * math.pi * i / seg), z)) for i in range(seg)])
        for A, B in zip(rings, rings[1:]):
            for i in range(seg):
                j = (i + 1) % seg
                if len(A) == 1 and len(B) == 1:
                    continue
                if len(A) == 1:
                    bm.faces.new((A[0], B[i], B[j]))
                elif len(B) == 1:
                    bm.faces.new((A[i], B[0], A[j]))
                else:
                    bm.faces.new((A[i], B[i], B[j], A[j]))
    return f


def lathe_x(profile, sy=1.0, sz=1.0, seg=28):
    """revolve (x, r) around the X axis, then squash; no rotations involved."""
    def f(bm):
        rings = []
        for x, r in profile:
            if r < 1e-6:
                rings.append([bm.verts.new((x, 0, 0))])
            else:
                rings.append([bm.verts.new((x, r * math.cos(2 * math.pi * i / seg) * sy, r * math.sin(2 * math.pi * i / seg) * sz)) for i in range(seg)])
        for A, B in zip(rings, rings[1:]):
            for i in range(seg):
                j = (i + 1) % seg
                if len(A) == 1:
                    bm.faces.new((A[0], B[i], B[j]))
                elif len(B) == 1:
                    bm.faces.new((A[i], B[0], A[j]))
                else:
                    bm.faces.new((A[i], B[i], B[j], A[j]))
    return f


COLORS.update({
    "grass": (0.28, 0.45, 0.2), "rock": (0.33, 0.31, 0.29), "stone": (0.38, 0.35, 0.31), "stoneDark": (0.16, 0.15, 0.15),
    "plaster": (0.82, 0.74, 0.58), "slate": (0.08, 0.1, 0.17), "thatch": (0.58, 0.38, 0.1), "moss": (0.16, 0.27, 0.08),
    "bark": (0.11, 0.06, 0.035), "leaf": (0.11, 0.32, 0.07), "snow": (0.92, 0.94, 0.97), "rope": (0.48, 0.33, 0.14),
    "ivory": (0.9, 0.84, 0.7), "gold": (0.78, 0.5, 0.12), "steel": (0.16, 0.22, 0.32), "copper": (0.48, 0.2, 0.09),
    "paintGreen": (0.11, 0.32, 0.15), "paintPink": (0.8, 0.32, 0.38), "paintTeal": (0.08, 0.38, 0.35),
    "window": (1.0, 0.72, 0.35), "flame": (1.0, 0.6, 0.15), "starGlow": (1.0, 0.85, 0.4), "seaLight": (0.19, 0.45, 0.6), "ice": (0.6, 0.85, 0.95),
})

TAU = 2 * math.pi


def ring(n, r, a0=0.0):
    return [(r * math.cos(a0 + TAU * i / n), r * math.sin(a0 + TAU * i / n)) for i in range(n)]


def window(p, M, w=0.2, h=0.3, frame="woodDark"):
    """a lit window with a frame and a cross bar; M puts its centre on a wall facing +X"""
    p.add(box(0.05, w + 0.07, h + 0.07), frame, 0.012, M)
    p.add(box(0.07, w, h), "window", 0, M)
    p.add(box(0.085, 0.022, h), frame, 0, M)
    p.add(box(0.085, w, 0.022), frame, 0, M)


# ---- architecture -------------------------------------------------------------
def wizard_tower():
    """a crooked stone tower with a timbered study under a tall hat of a roof. 4.6 tall."""
    p = Prop("wizard_tower")
    p.add(cyl(0.95, 0.9, 0.16, 0, 9), "stoneDark", 0.03)
    p.add(lathe([(0.8, 0.14), (0.7, 0.9), (0.64, 1.8), (0.62, 2.5)], 14), "stone", 0)
    for z, r in [(0.75, 0.74), (1.6, 0.675)]:
        p.add(torus(r, 0.045, z, 28, 6), "stoneDark", 0)
    for i in range(9):                                                      # corbels under the study
        p.add(box(0.26, 0.12, 0.2, (0.72, 0, 2.5)), "stoneDark", 0.02, RZ(TAU * i / 9))
    p.add(cyl(0.9, 0.92, 0.1, 2.58, 9), "woodDark", 0.02)
    p.add(cyl(0.82, 0.86, 0.82, 2.68, 9), "plaster", 0.02)
    for i in range(9):
        a = TAU * (i + 0.5) / 9
        p.add(box(0.07, 0.07, 0.84, (0.84 * math.cos(a), 0.84 * math.sin(a), 3.1)), "woodDark", 0.012)
    for i in (0, 2, 4, 7):
        window(p, RZ(TAU * i / 9) @ T((0.8, 0, 3.12)), 0.22, 0.36)
    p.add(cyl(1.12, 1.02, 0.1, 3.5, 9), "woodDark", 0.02)
    p.add(lathe([(1.14, 3.56), (0.78, 3.86), (0.5, 4.4), (0.26, 4.95), (0.1, 5.3), (0, 5.42)], 9), "slate", 0, T((0.0, 0, 0)) @ RY(0.0))
    p.add(sphere(0.09, (0.0, 0, 5.46), u=10, v=6), "gold", 0)
    # the door and its steps
    p.add(box(0.12, 0.42, 0.66, (0.77, 0, 0.47)), "woodDark", 0.03)
    p.add(box(0.05, 0.3, 0.52, (0.83, 0, 0.44)), "paintTeal", 0.02)
    p.add(sphere(0.025, (0.87, 0.09, 0.42), u=8, v=5), "gold", 0)
    for i in range(3):
        p.add(box(0.2, 0.56 - i * 0.08, 0.06, (0.95 + i * 0.0, 0, 0.03 + i * 0.0)), "stone", 0.012, T((0.1 * (2 - i), 0, 0.055 * i)))
    for a, z in [(1.2, 1.25), (3.0, 1.7), (4.6, 1.1), (2.1, 2.1)]:           # slit windows up the stair
        window(p, RZ(a) @ T((0.66 + (1.8 - z) * 0.045, 0, z)), 0.1, 0.26, "stoneDark")
    # a little turret clinging to the side
    M = RZ(2.6) @ T((0.78, 0, 0))
    p.add(lathe([(0.02, 1.55), (0.26, 1.9), (0.27, 2.55)], 10), "plaster", 0, M)
    p.add(lathe([(0.36, 2.52), (0.2, 2.86), (0.05, 3.22), (0, 3.26)], 10), "slate", 0, M)
    window(p, RZ(2.6) @ T((1.03, 0, 2.26)), 0.1, 0.2)
    p.add(box(0.2, 0.2, 0.5, (-0.3, 0.3, 4.2)), "stone", 0.02)             # chimney through the roof
    p.add(box(0.26, 0.26, 0.06, (-0.3, 0.3, 4.46)), "stoneDark", 0.012)
    return p


def cottage():
    """timber-framed, jettied, thatched. 1.5 wide, 2.0 tall."""
    p = Prop("cottage")
    p.add(box(1.2, 1.0, 0.16, (0, 0, 0.08)), "stone", 0.03)
    p.add(box(1.1, 0.9, 0.66, (0, 0, 0.49)), "plaster", 0.02)
    p.add(box(1.34, 1.1, 0.07, (0, 0, 0.85)), "woodDark", 0.012)
    p.add(box(1.28, 1.04, 0.5, (0, 0, 1.13)), "plaster", 0.02)
    p.add(prism(1.28, 0.62, 1.04, 1.38), "plaster", 0, RZ(math.pi / 2) @ Matrix.Scale(1.04 / 1.28, 4, (1, 0, 0)) @ Matrix.Scale(1.28 / 1.04, 4, (0, 1, 0)))
    for sx in (-1, 1):                                                       # posts and braces
        for sy in (-1, 1):
            p.add(box(0.07, 0.07, 0.68, (sx * 0.54, sy * 0.44, 0.5)), "woodDark", 0.01)
            p.add(box(0.07, 0.07, 0.5, (sx * 0.63, sy * 0.51, 1.13)), "woodDark", 0.01)
        p.add(box(0.05, 0.05, 0.62, (sx * 0.3, -0.53, 1.13)), "woodDark", 0.008, T((sx * 0.3, -0.53, 1.13)) @ RY(sx * 0.5) @ T((-sx * 0.3, 0.53, -1.13)))
    ang = math.atan2(0.62, 0.52)
    for sy in (-1, 1):                                                       # thick thatch, eaves well out
        M = T((0, sy * 0.33, 1.72)) @ RX(-sy * ang)
        p.add(box(1.6, 0.98, 0.14), "thatch", 0.045, M, 3)
    p.add(box(1.66, 0.2, 0.13, (0, 0, 2.06)), "thatch", 0.05, None, 3)
    p.add(box(0.24, 0.24, 0.7, (0.4, 0.22, 1.9)), "stone", 0.025)
    p.add(box(0.3, 0.3, 0.07, (0.4, 0.22, 2.27)), "stoneDark", 0.015)
    p.add(box(0.3, 0.06, 0.5, (-0.2, -0.46, 0.41)), "woodDark", 0.02)
    p.add(box(0.24, 0.07, 0.42, (-0.2, -0.47, 0.39)), "paintRed", 0.015)
    p.add(sphere(0.022, (-0.12, -0.51, 0.38), u=8, v=5), "gold", 0)
    p.add(box(0.4, 0.2, 0.05, (-0.2, -0.58, 0.19)), "stone", 0.012)
    for M in [RZ(-math.pi / 2) @ T((0.44, 0.24, 0.52)), T((0.54, 0, 0.52)), RZ(math.pi) @ T((0.54, 0, 0.52)), RZ(math.pi / 2) @ T((0.44, 0, 0.52)),
              RZ(-math.pi / 2) @ T((0.51, 0.3, 1.14)), RZ(-math.pi / 2) @ T((0.51, -0.3, 1.14)), T((0.63, 0, 1.14)), RZ(math.pi) @ T((0.63, 0, 1.14))]:
        window(p, M, 0.2, 0.24)
    for sx in (0.05, 0.42):                                                  # window box with flowers
        p.add(box(0.26, 0.07, 0.06, (0.24, -0.56, 0.98)), "woodDark", 0.01)
    for i in range(4):
        p.add(sphere(0.035, (0.14 + i * 0.065, -0.56, 1.03), u=8, v=5), "paintPink" if i % 2 else "paintRed", 0)
    return p


def toadstool_house():
    """somebody lives in this mushroom. 2.3 wide, 2.1 tall."""
    p = Prop("toadstool_house")
    p.add(lathe([(0, 0), (0.62, 0), (0.58, 0.2), (0.48, 0.6), (0.45, 1.0), (0.5, 1.2), (0, 1.2)], 20), "paintCream", 0)
    p.add(lathe([(0.48, 1.12), (1.06, 1.16), (1.12, 1.24)], 30), "birch", 0)
    for i in range(18):
        p.add(box(0.56, 0.025, 0.06, (0.78, 0, 1.17)), "dowel", 0, RZ(TAU * i / 18))
    p.add(lathe([(1.12, 1.2), (1.16, 1.3), (1.08, 1.56), (0.84, 1.86), (0.5, 2.04), (0, 2.1)], 30), "paintRed", 0)
    for a, r, z, s in [(0.4, 0.84, 1.8, 0.15), (1.7, 0.98, 1.62, 0.12), (2.9, 0.8, 1.84, 0.16), (4.2, 0.96, 1.66, 0.13), (5.3, 0.7, 1.93, 0.12), (3.6, 0.36, 2.05, 0.11), (0.9, 0.3, 2.06, 0.09)]:
        p.add(sphere(s, (r * math.cos(a), r * math.sin(a), z), (1, 1, 0.4), 12, 6), "paintCream", 0)
    p.add(cyl(0.2, 0.2, 0.07, 0, 20), "woodDark", 0.015, T((0.53, 0, 0.36)) @ RY(math.pi / 2 - 0.16) @ Matrix.Scale(1.5, 4, (1, 0, 0)))
    p.add(cyl(0.16, 0.16, 0.08, 0, 20), "paintTeal", 0.012, T((0.535, 0, 0.36)) @ RY(math.pi / 2 - 0.16) @ Matrix.Scale(1.5, 4, (1, 0, 0)))
    p.add(sphere(0.022, (0.6, 0.08, 0.36), u=8, v=5), "gold", 0)
    for a, z in [(1.5, 0.72), (-1.4, 0.66), (3.1, 0.8)]:
        M = RZ(a) @ T((0.46, 0, z)) @ RY(math.pi / 2)
        p.add(cyl(0.14, 0.14, 0.06, 0, 16), "woodDark", 0.012, M)
        p.add(cyl(0.1, 0.1, 0.075, 0, 16), "window", 0, M)
    p.add(cyl(0.07, 0.06, 0.4, 1.8, 10), "stone", 0.012, T((-0.5, 0.35, 0)))
    p.add(cyl(0.09, 0.09, 0.05, 2.2, 10), "stoneDark", 0.01, T((-0.5, 0.35, 0)))
    p.add(box(0.3, 0.34, 0.05, (0.72, 0, 0.025)), "stone", 0.012)
    return p


def clock_tower():
    """a town clock with four lit faces. 1.5 square, 5.2 tall."""
    p = Prop("clock_tower")
    p.add(box(1.3, 1.3, 0.2, (0, 0, 0.1)), "stoneDark", 0.03)
    p.add(box(1.04, 1.04, 2.9, (0, 0, 1.65)), "stone", 0.02)
    for z in (0.5, 1.0, 1.5, 2.0, 2.5, 3.0):                                # quoins
        for sx in (-1, 1):
            for sy in (-1, 1):
                p.add(box(0.2, 0.2, 0.22, (sx * 0.47, sy * 0.47, z)), "stoneDark", 0.02)
    p.add(box(0.1, 0.4, 0.74, (0.5, 0, 0.57)), "woodDark", 0.03)
    p.add(box(0.06, 0.28, 0.6, (0.54, 0, 0.52)), "paintNavy", 0.02)
    for i in range(4):
        window(p, RZ(TAU * i / 4) @ T((0.52, 0, 1.9)), 0.14, 0.4, "stoneDark")
    p.add(box(1.36, 1.36, 0.12, (0, 0, 3.14)), "stoneDark", 0.025)
    p.add(box(1.2, 1.2, 1.2, (0, 0, 3.8)), "plaster", 0.02)
    for i in range(4):
        M = RZ(TAU * i / 4) @ T((0.6, 0, 3.8)) @ RY(math.pi / 2)
        p.add(cyl(0.5, 0.5, 0.06, 0, 32), "gold", 0.012, M)
        p.add(cyl(0.43, 0.43, 0.075, 0, 32), "window", 0, M)
        for kk in range(12):
            p.add(box(0.03, 0.09, 0.02, (0, 0.36, 0.075)), "paintNavy", 0, M @ RZ(TAU * kk / 12))
        p.add(box(0.035, 0.3, 0.02, (0, 0.13, 0.085)), "paintNavy", 0, M @ RZ(0.9 + i))
        p.add(box(0.045, 0.2, 0.02, (0, 0.08, 0.09)), "paintNavy", 0, M @ RZ(-1.4 + i * 0.5))
        p.add(sphere(0.04, (0, 0, 0.09), u=8, v=5), "gold", 0, M)
        for sy in (-1, 1):
            p.add(box(0.08, 0.08, 1.22, (0.585, sy * 0.585, 3.8)), "woodDark", 0.012, RZ(TAU * i / 4))
    p.add(box(1.44, 1.44, 0.1, (0, 0, 4.45)), "woodDark", 0.025)
    p.add(cyl(1.0, 0.24, 0.62, 4.5, 4), "slate", 0.02, RZ(math.pi / 4))
    p.add(cyl(0.24, 0.24, 0.3, 5.12, 4), "plaster", 0.02, RZ(math.pi / 4))   # little belfry
    p.add(cyl(0.34, 0.0, 0.5, 5.42, 4), "slate", 0.02, RZ(math.pi / 4))
    p.add(sphere(0.06, (0, 0, 5.95), u=8, v=5), "gold", 0)
    return p


def stone_bridge():
    """a humpback footbridge: 3.2 long (along X), 0.9 wide, the roadway 0.72 above the banks at its crown.
    Stand it across a track and the track passes under the arch (1.7 wide, 0.95 high, along Y)."""
    p = Prop("stone_bridge")
    top = [(-1.6 + 3.2 * i / 16, 0.34 + 0.48 * math.sin(math.pi * i / 16)) for i in range(17)]
    arch = [(0.86 * math.cos(math.pi * i / 14), 0.66 * math.sin(math.pi * i / 14) + 0.02) for i in range(15)]
    outline = top + [(1.6, 0)] + [(0.86, 0)] + arch[1:-1] + [(-0.86, 0), (-1.6, 0)]
    p.add(slab(outline, 0.8), "stone", 0.02)
    for sy in (-1, 1):
        para = top + [(x, z - 0.02) for x, z in reversed(top)]
        para = [(x, z + 0.24) for x, z in top] + [(x, z - 0.04) for x, z in reversed(top)]
        p.add(slab(para, 0.1), "stoneDark", 0.02, T((0, sy * 0.42, 0)))
        ring_ = [(0.95 * math.cos(math.pi * i / 14), 0.75 * math.sin(math.pi * i / 14) + 0.02) for i in range(15)] + [(x, z) for x, z in reversed(arch)]
        p.add(slab(ring_, 0.06), "stoneDark", 0.012, T((0, sy * 0.4, 0)))
        for sx in (-1, 1):
            p.add(box(0.2, 0.2, 0.74, (sx * 1.55, sy * 0.42, 0.37)), "stoneDark", 0.025)
            p.add(cyl(0.14, 0.02, 0.14, 0.74, 4), "stone", 0.01, T((sx * 1.55, sy * 0.42, 0)) @ RZ(math.pi / 4))
    for i in range(7):                                                      # moss in the joints
        x = -1.2 + i * 0.4
        p.add(sphere(0.09, (x, 0.41 * (1 if i % 2 else -1), 0.2 + 0.3 * math.sin(math.pi * (x + 1.6) / 3.2)), (1.3, 0.3, 0.7), 8, 5), "moss", 0)
    return p


def gate_arch():
    """a little gatehouse to stand astride a track: opening 1.1 wide, 1.0 high, you pass along Y."""
    p = Prop("gate_arch")
    for sx in (-1, 1):
        p.add(box(0.42, 0.6, 1.5, (sx * 0.78, 0, 0.75)), "stone", 0.03)
        p.add(box(0.5, 0.68, 0.14, (sx * 0.78, 0, 0.07)), "stoneDark", 0.03)
        p.add(lathe([(0.3, 1.5), (0.31, 1.56), (0.02, 2.1), (0, 2.12)], 8), "slate", 0, T((sx * 0.78, 0, 0)))
        p.add(sphere(0.04, (sx * 0.78, 0, 2.14), u=8, v=5), "gold", 0)
        for sy in (-1, 1):                                                   # a lamp on each face
            p.add(box(0.06, 0.1, 0.05, (sx * 0.78, sy * 0.33, 1.08)), "woodDark", 0.01)
            p.add(box(0.11, 0.11, 0.16, (sx * 0.78, sy * 0.39, 0.98)), "window", 0.015)
            p.add(cyl(0.1, 0.02, 0.07, 1.06, 4), "woodDark", 0.008, T((sx * 0.78, sy * 0.39, 0)) @ RZ(math.pi / 4))
    out = [(-0.6, 1.0), (-0.6, 1.72), (0.6, 1.72), (0.6, 1.0)] + [(0.56 * math.cos(math.pi * i / 12), 1.0 + 0.3 * math.sin(math.pi * i / 12)) for i in range(1, 12)]
    p.add(slab(out, 0.5), "stone", 0.02)
    for i in range(5):                                                      # battlements
        p.add(box(0.16, 0.56, 0.16, (-0.48 + i * 0.24, 0, 1.8)), "stoneDark", 0.02)
    p.add(slab([(-0.14, 1.4), (0.14, 1.4), (0.14, 1.62), (0, 1.7), (-0.14, 1.62)], 0.56), "paintRed", 0.012)   # a shield on each side
    return p


def well():
    p = Prop("well")
    p.add(lathe([(0.3, 0), (0.46, 0), (0.46, 0.42), (0.3, 0.42), (0.3, 0.1)], 12), "stone", 0.02)
    p.add(cyl(0.3, 0.3, 0.02, 0.2, 12), "seaLight", 0)
    p.add(torus(0.38, 0.06, 0.44, 12, 6), "stoneDark", 0)
    for sx in (-1, 1):
        p.add(box(0.07, 0.07, 0.9, (sx * 0.4, 0, 0.82)), "woodDark", 0.012)
    p.add(cyl(0.04, 0.04, 0.86, 0, 10), "dowel", 0.008, T((-0.43, 0, 1.0)) @ RY(math.pi / 2))
    p.add(cyl(0.012, 0.012, 0.4, 0.58, 6), "rope", 0)
    p.add(cyl(0.09, 0.07, 0.14, 0.46, 10), "woodDark", 0.012)
    for sy in (-1, 1):
        p.add(box(1.06, 0.5, 0.05), "slate", 0.012, T((0, sy * 0.18, 1.38)) @ RX(-sy * 0.7))
    p.add(box(1.1, 0.07, 0.07, (0, 0, 1.54)), "woodDark", 0.012)
    return p


def fountain():
    p = Prop("fountain")
    p.add(lathe([(0, 0), (0.86, 0), (0.9, 0.06), (0.9, 0.3), (0.82, 0.34), (0.76, 0.3), (0.76, 0.12), (0, 0.12)], 16), "stone", 0.015)
    p.add(cyl(0.76, 0.76, 0.02, 0.24, 16), "seaLight", 0)
    p.add(lathe([(0.2, 0.12), (0.14, 0.3), (0.09, 0.7), (0.14, 0.9), (0.46, 1.0), (0.5, 1.08), (0.42, 1.08), (0.1, 0.98), (0, 0.98)], 16), "stone", 0)
    p.add(cyl(0.42, 0.42, 0.015, 1.05, 16), "seaLight", 0)
    p.add(lathe([(0.07, 0.98), (0.05, 1.3), (0.12, 1.4), (0, 1.5)], 12), "stoneDark", 0)
    p.add(sphere(0.07, (0, 0, 1.54), u=10, v=6), "gold", 0)
    for i in range(4):
        a = TAU * i / 4 + 0.4
        p.add(sphere(0.045, (0.47 * math.cos(a), 0.47 * math.sin(a), 0.9), (1, 1, 2.6), 8, 5), "ice", 0)
    return p


# ---- lights -------------------------------------------------------------------
def street_lamp():
    p = Prop("street_lamp")
    p.add(cyl(0.12, 0.09, 0.1, 0, 8), "paintNavy", 0.015)
    p.add(cyl(0.035, 0.028, 1.3, 0.1, 8), "paintNavy", 0)
    p.add(torus(0.05, 0.02, 0.5, 12, 6), "gold", 0)
    p.add(cyl(0.07, 0.11, 0.06, 1.38, 6), "paintNavy", 0.01)
    p.add(cyl(0.085, 0.12, 0.24, 1.44, 6), "window", 0)
    for i in range(6):
        a = TAU * (i + 0.5) / 6
        p.add(box(0.016, 0.016, 0.25, (0.1 * math.cos(a), 0.1 * math.sin(a), 1.56)), "paintNavy", 0)
    p.add(cyl(0.17, 0.03, 0.14, 1.68, 6), "paintNavy", 0.012)
    p.add(sphere(0.03, (0, 0, 1.84), u=8, v=5), "gold", 0)
    return p


def paper_lantern():
    """hangs from its top ring. 0.62 tall."""
    p = Prop("paper_lantern")
    p.add(cyl(0.01, 0.01, 0.12, 0, 5), "paintRed", 0)                        # tassel
    p.add(cyl(0.03, 0.012, 0.07, 0.03, 8), "paintRed", 0)
    p.add(cyl(0.09, 0.09, 0.03, 0.12, 14), "woodDark", 0.008)
    p.add(lathe([(0.09, 0.14), (0.17, 0.22), (0.2, 0.32), (0.17, 0.42), (0.09, 0.5)], 14), "lamp", 0)
    for z, r in [(0.22, 0.172), (0.32, 0.202), (0.42, 0.172)]:
        p.add(torus(r, 0.008, z, 16, 4), "paintRed", 0)
    p.add(cyl(0.09, 0.09, 0.03, 0.5, 14), "woodDark", 0.008)
    p.add(torus(0.035, 0.008, 0, 10, 4), "brass", 0, T((0, 0, 0.575)) @ RX(math.pi / 2))
    return p


def candle():
    p = Prop("candle")
    p.add(lathe([(0, 0), (0.2, 0), (0.24, 0.05), (0.2, 0.07), (0, 0.05)], 14), "brass", 0)
    p.add(torus(0.05, 0.014, 0.05, 10, 5), "brass", 0, T((0.26, 0, 0)))
    p.add(cyl(0.085, 0.08, 0.36, 0.05, 12), "ivory", 0.012)
    for a, z in [(0.5, 0.33), (2.4, 0.27), (4.4, 0.35)]:
        p.add(sphere(0.03, (0.08 * math.cos(a), 0.08 * math.sin(a), z), (1, 1, 2.2), 6, 4), "ivory", 0)
    p.add(cyl(0.006, 0.006, 0.05, 0.41, 4), "paintNavy", 0)
    p.add(lathe([(0, 0.44), (0.035, 0.48), (0.03, 0.54), (0, 0.63)], 8), "flame", 0)
    return p


def star():
    """a flat brass-rimmed star that hangs from its top point. 0.6 tall."""
    p = Prop("star")
    out = []
    for i in range(10):
        r, a = (0.3 if i % 2 == 0 else 0.13), math.pi / 2 + TAU * i / 10
        out.append((r * math.cos(a), 0.3 + r * math.sin(a)))
    p.add(slab(out, 0.07), "starGlow", 0.015)
    p.add(slab([(x * 1.0, z) for x, z in out], 0.03), "gold", 0, T((0, 0, 0.3)) @ Matrix.Scale(1.12, 4) @ T((0, 0, -0.3)))
    p.add(torus(0.03, 0.007, 0, 10, 4), "brass", 0, T((0, 0, 0.66)) @ RX(math.pi / 2))
    return p


def fairy_lights():
    """a sagging string of bulbs, 2.6 between its ends (along X); hang it by the ends."""
    p = Prop("fairy_lights")
    pts = [(-1.3 + 2.6 * i / 12, 0.42 * (((i / 12) * 2 - 1) ** 2)) for i in range(13)]
    for (x0, z0), (x1, z1) in zip(pts, pts[1:]):
        L = math.hypot(x1 - x0, z1 - z0)
        p.add(cyl(0.008, 0.008, L, 0, 4), "woodDark", 0, T((x0, 0, z0 + 0.1)) @ RY(math.atan2(x1 - x0, z1 - z0)))
    for i, (x, z) in enumerate(pts[1:-1]):
        p.add(cyl(0.018, 0.018, 0.03, z + 0.07, 6), "woodDark", 0, T((x, 0, 0)))
        p.add(sphere(0.045, (x, 0, z + 0.035), (1, 1, 1.25), 8, 6), "starGlow" if i % 2 else "lamp", 0)
    return p


def bunting():
    """a string of pennants, 2.6 between its ends (along X)."""
    p = Prop("bunting")
    paints = ["paintRed", "paintCream", "paintTeal", "paintYellow", "paintPink", "paintBlue"]
    f = lambda s: 0.5 * ((s * 2 - 1) ** 2)
    pts = [(-1.3 + 2.6 * i / 14, f(i / 14)) for i in range(15)]
    for (x0, z0), (x1, z1) in zip(pts, pts[1:]):
        L = math.hypot(x1 - x0, z1 - z0)
        p.add(cyl(0.009, 0.009, L, 0, 4), "rope", 0, T((x0, 0, z0 + 0.24)) @ RY(math.atan2(x1 - x0, z1 - z0)))
    for i in range(9):
        s = (i + 0.5) / 9
        x, z = -1.3 + 2.6 * s, f(s) + 0.24
        p.add(slab([(-0.11, 0), (0.11, 0), (0, -0.24)], 0.012), paints[i % 6], 0, T((x, 0, z)) @ RY(-(f(s + 0.02) - f(s - 0.02)) / (2.6 * 0.04) * 0.9))
    return p


# ---- things that fly ----------------------------------------------------------
def balloon():
    """a hot-air balloon with a wicker basket. 2.1 across, 3.4 tall; the burner glows."""
    p = Prop("balloon")
    prof = [(0.22, 1.25), (0.42, 1.5), (0.72, 1.9), (0.95, 2.35), (1.04, 2.75), (0.96, 3.1), (0.72, 3.32), (0.36, 3.42), (0, 3.44)]
    bands = ["paintNavy", "paintRed", "paintCream", "paintRed", "paintYellow", "paintRed", "paintCream", "paintRed"]
    for i in range(8):
        p.add(lathe(prof[i:i + 2], 24), bands[i], 0)
    p.add(torus(0.22, 0.03, 1.25, 20, 6), "gold", 0)
    for i in range(12):                                                     # gore seams
        a = TAU * i / 12
        for (r0, z0), (r1, z1) in zip(prof[:-1], prof[1:-1]):
            L = math.hypot(r1 - r0, z1 - z0)
            p.add(cyl(0.012, 0.012, L, 0, 4), "rope", 0, RZ(a) @ T((r0 + 0.005, 0, z0)) @ RY(math.atan2(r1 - r0, z1 - z0)))
    p.add(box(0.46, 0.46, 0.3, (0, 0, 0.17)), "thatch", 0.04, None, 3)
    p.add(box(0.5, 0.5, 0.05, (0, 0, 0.33)), "woodDark", 0.015)
    p.add(box(0.5, 0.5, 0.04, (0, 0, 0.02)), "woodDark", 0.015)
    for sx in (-1, 1):
        for sy in (-1, 1):
            a = math.atan2(0.0, 1)
            x0, y0, z0, x1, y1, z1 = sx * 0.23, sy * 0.23, 0.34, sx * 0.16, sy * 0.16, 1.25
            d = Vector((x1 - x0, y1 - y0, z1 - z0))
            p.add(cyl(0.01, 0.01, d.length, 0, 4), "rope", 0, T((x0, y0, z0)) @ d.to_track_quat("Z", "Y").to_matrix().to_4x4())
        p.add(sphere(0.07, (sx * 0.27, 0, 0.2), (0.6, 1, 1.3), 8, 5), "paintRed" if sx > 0 else "paintCream", 0)   # sandbags
    p.add(cyl(0.07, 0.05, 0.1, 0.92, 8), "brass", 0.01)
    p.add(lathe([(0, 1.0), (0.05, 1.06), (0.035, 1.16), (0, 1.3)], 8), "flame", 0)
    return p


def airship():
    """a plywood airship, nose to +X. 4.4 long, 1.9 tall; hangs level, origin under the gondola."""
    p = Prop("airship")
    hull = [(-2.2, 0), (-2.1, 0.16), (-1.7, 0.42), (-1.0, 0.66), (-0.2, 0.78), (0.6, 0.78), (1.3, 0.64), (1.8, 0.42), (2.1, 0.18), (2.2, 0)]
    for i in range(len(hull) - 1):
        p.add(lathe_x(hull[i:i + 2], 1.0, 0.92, 20), "paintCream" if i % 2 else "paper", 0, T((0, 0, 1.25)))
    for x, r in hull[1:-1]:
        p.add(torus(r + 0.005, 0.022, 0, 24, 5), "birch", 0, T((x, 0, 1.25)) @ RY(math.pi / 2) @ Matrix.Scale(0.92, 4, (1, 0, 0)))
    fin = [(-2.2, 0), (-1.5, 0), (-1.35, 0.5), (-1.9, 0.66), (-2.3, 0.6)]
    p.add(slab(fin, 0.04), "paintRed", 0.012, T((0, 0, 1.55)))
    p.add(slab(fin, 0.04), "paintRed", 0.012, T((0, 0, 0.95)) @ Matrix.Scale(-1, 4, (0, 0, 1)))
    for s in (-1, 1):
        p.add(slab(fin, 0.04), "paintRed", 0.012, T((0, s * 0.3, 1.25)) @ RX(s * math.pi / 2))
    # gondola: a little clinker boat slung underneath
    p.add(lathe_x([(-0.7, 0), (-0.6, 0.16), (-0.2, 0.24), (0.3, 0.24), (0.62, 0.15), (0.74, 0)], 1.0, 1.0, 14), "ply", 0, T((0.1, 0, 0.26)))
    p.add(box(1.2, 0.36, 0.05, (0.1, 0, 0.3)), "woodDark", 0.012)
    p.add(box(0.7, 0.3, 0.24, (0.05, 0, 0.44)), "birch", 0.02)
    p.add(box(0.76, 0.36, 0.04, (0.05, 0, 0.58)), "paintRed", 0.012)
    for x in (-0.18, 0.05, 0.28):
        for s in (-1, 1):
            p.add(box(0.13, 0.03, 0.12, (x, s * 0.15, 0.45)), "window", 0)
    for x in (-0.45, 0.6):
        for s in (-1, 1):
            d = Vector((0, -s * 0.05, 0.4))
            p.add(cyl(0.012, 0.012, 0.42, 0, 4), "rope", 0, T((x, s * 0.2, 0.3)) @ d.to_track_quat("Z", "Y").to_matrix().to_4x4())
    p.add(cyl(0.05, 0.05, 0.2, 0, 8), "brass", 0.01, T((-0.72, 0, 0.3)) @ RY(-math.pi / 2))
    for i in range(3):
        p.add(box(0.03, 0.09, 0.4, (0, 0, 0.2)), "brass", 0.01, T((-0.9, 0, 0.3)) @ RX(TAU * i / 3) @ RZ(0.4))
    p.add(sphere(0.07, (2.2, 0, 1.25), u=8, v=5), "gold", 0)
    return p


# ---- nature -------------------------------------------------------------------
def pine_snow():
    p = Prop("pine_snow")
    p.add(cyl(0.09, 0.07, 0.5, 0, 9), "bark", 0.01)
    for z, r0, r1, h in [(0.36, 0.56, 0.2, 0.52), (0.74, 0.46, 0.15, 0.5), (1.1, 0.35, 0.1, 0.48), (1.44, 0.24, 0.0, 0.5)]:
        p.add(cyl(r0, r1, h, z, 9), "treeA", 0.035, RZ(z * 2))
        p.add(lathe([(r0 * 0.5, z + h * 0.52), (r0 * 0.6, z + h * 0.42), (r0 * 0.45, z + h * 0.56), (r1 + 0.02, z + h + 0.01), (0, z + h + 0.03)], 9), "snow", 0, RZ(z * 2))
    return p


def rock_spire():
    """a leaning crag of stacked slabs with moss on its ledges. 1.5 across, 3.0 tall."""
    p = Prop("rock_spire")
    z, x = 0.0, 0.0
    for i, (r0, r1, h, seg, rot) in enumerate([(0.74, 0.62, 0.55, 7, 0.2), (0.6, 0.5, 0.6, 6, 0.9), (0.5, 0.36, 0.62, 7, 0.1), (0.36, 0.26, 0.55, 5, 0.6), (0.26, 0.12, 0.5, 6, 1.4), (0.12, 0.0, 0.3, 5, 0.3)]):
        p.add(cyl(r0, r1, h, z, seg), "rock" if i % 2 == 0 else "stoneDark", 0.04, T((x, 0.05 * i, 0)) @ RZ(rot))
        if i in (0, 2, 3):
            p.add(sphere(r1 * 0.8, (x - 0.1, 0.05 * i + 0.1, z + h), (1.1, 0.9, 0.16), 10, 5), "moss", 0)
        z += h * 0.93
        x += 0.07
    for a, r, s in [(0.8, 0.72, 0.3), (2.9, 0.66, 0.24), (4.6, 0.7, 0.2)]:
        p.add(cyl(s, s * 0.5, s * 1.2, 0, 5), "rock", 0.03, T((r * math.cos(a), r * math.sin(a), 0)) @ RZ(a))
    return p


def floating_rock():
    """a wild floating crag: mossy top at z = 0 (about 1.0 radius, not round), a long root of stone below (to z = -2.4)."""
    p = Prop("floating_rock")
    for x, y, r, zt in [(0, 0, 0.82, 0.0), (0.5, 0.22, 0.5, -0.05), (-0.45, 0.35, 0.46, -0.03), (-0.2, -0.5, 0.5, -0.06), (0.42, -0.42, 0.36, -0.08)]:
        p.add(cyl(r * 0.9, r, 0.18, zt - 0.18, 8), "moss", 0.05, T((x, y, 0)) @ RZ(x * 3 + y))
        p.add(cyl(r * 0.5, r * 0.96, 0.5, zt - 0.66, 7), "rock", 0.04, T((x, y, 0)) @ RZ(x * 2))
    for x, y, r0, h, z0, seg in [(0, 0, 0.66, 0.7, -1.3, 7), (0.1, 0.05, 0.42, 0.6, -1.85, 6), (0.16, 0.08, 0.2, 0.55, -2.38, 5), (-0.4, 0.3, 0.3, 0.6, -1.2, 5), (0.45, -0.3, 0.26, 0.5, -1.12, 5), (-0.25, -0.45, 0.22, 0.45, -1.08, 5)]:
        p.add(cyl(r0 * 0.25, r0, h, z0, seg), "stoneDark" if seg == 5 else "rock", 0.035, T((x, y, 0)) @ RZ(x * 5))
    for a, r in [(0.3, 0.7), (2.0, 0.62), (3.7, 0.66), (5.2, 0.5)]:           # roots and hanging moss
        p.add(cyl(0.02, 0.008, 0.6, -0.9, 4), "moss", 0, T((r * math.cos(a), r * math.sin(a), 0)))
    return p


def snowman():
    p = Prop("snowman")
    p.add(sphere(0.3, (0, 0, 0.26), (1, 1, 0.92), 16, 10), "snow", 0)
    p.add(sphere(0.22, (0, 0, 0.64), (1, 1, 0.94), 14, 9), "snow", 0)
    p.add(sphere(0.16, (0, 0, 0.93), u=14, v=9), "snow", 0)
    p.add(torus(0.17, 0.045, 0.79, 14, 6), "paintRed", 0)
    p.add(box(0.07, 0.04, 0.22, (0.13, 0.12, 0.68)), "paintRed", 0.012)
    p.add(cyl(0.19, 0.19, 0.025, 1.05, 14), "paintNavy", 0.008)
    p.add(cyl(0.12, 0.11, 0.18, 1.07, 14), "paintNavy", 0.012)
    p.add(torus(0.118, 0.012, 1.1, 14, 4), "paintRed", 0)
    p.add(cyl(0.03, 0.0, 0.14, 0, 6), "paintYellow", 0, T((0.15, 0, 0.93)) @ RY(math.pi / 2))
    for s in (-1, 1):
        p.add(sphere(0.02, (0.14, s * 0.06, 0.98), u=6, v=4), "paintNavy", 0)
        d = Vector((0.08, s * 0.4, 0.2))
        p.add(cyl(0.014, 0.008, d.length, 0, 4), "bark", 0, T((0, s * 0.18, 0.68)) @ d.to_track_quat("Z", "Y").to_matrix().to_4x4())
    for z in (0.56, 0.66, 0.74):
        p.add(sphere(0.02, (0.21 - (z - 0.64) ** 2 * 2, 0, z), u=6, v=4), "paintNavy", 0)
    return p


# ---- music box and clockwork ----------------------------------------------------
def carousel_horse():
    """a carved fairground horse on its brass pole, nose to +X. 1.0 long, 1.7 tall with the pole."""
    p = Prop("carousel_horse")
    p.add(cyl(0.025, 0.025, 1.7, 0, 8), "brass", 0)
    for z in (0.18, 1.5):
        p.add(sphere(0.05, (0, 0, z), u=8, v=5), "gold", 0)
    p.add(lathe_x([(-0.36, 0), (-0.32, 0.13), (-0.1, 0.17), (0.16, 0.16), (0.32, 0.14), (0.38, 0)], 0.78, 1.0, 14), "ivory", 0, T((0, 0, 0.72)))
    p.add(lathe_x([(0, 0.11), (0.14, 0.09), (0.3, 0.075), (0.36, 0)], 0.75, 1.0, 10), "ivory", 0, T((0.25, 0, 0.8)) @ RY(-1.0))
    p.add(lathe_x([(-0.06, 0), (-0.02, 0.075), (0.1, 0.065), (0.22, 0.045), (0.25, 0)], 0.8, 1.0, 10), "ivory", 0, T((0.42, 0, 1.08)) @ RY(0.5))
    for s in (-1, 1):
        p.add(cyl(0.025, 0.0, 0.08, 0, 5), "ivory", 0, T((0.4, s * 0.04, 1.14)))
        p.add(sphere(0.014, (0.5, s * 0.052, 1.06), u=6, v=4), "paintNavy", 0)
        for x, a1, a2 in [(0.24, 0.9, -0.9), (-0.26, -0.5, 0.8)]:            # legs, mid-gallop
            M = T((x, s * 0.08, 0.66)) @ RY(math.pi - a1 * (1 if s > 0 else 0.6))
            p.add(cyl(0.045, 0.032, 0.24, 0, 7), "ivory", 0.008, M)
            M2 = M @ T((0, 0, 0.23)) @ RY(a2)
            p.add(cyl(0.032, 0.026, 0.2, 0, 7), "ivory", 0.008, M2)
            p.add(cyl(0.032, 0.036, 0.045, 0.2, 7), "gold", 0.006, M2)
    for i in range(5):                                                      # mane
        p.add(sphere(0.05, (0.3 + i * 0.03, 0, 0.9 + i * 0.055), (1.2, 0.5, 1.0), 7, 5), "gold", 0)
    p.add(lathe_x([(-0.16, 0), (-0.14, 0.03), (-0.04, 0.05), (0.04, 0)], 0.5, 1.6, 8), "gold", 0, T((-0.38, 0, 0.72)) @ RY(0.7))   # tail
    p.add(lathe_x([(-0.14, 0.168), (0.1, 0.172)], 0.8, 1.0, 14), "paintRed", 0, T((-0.02, 0, 0.725)))                             # saddle cloth
    p.add(lathe_x([(-0.08, 0.176), (0.04, 0.178)], 0.8, 1.0, 14), "paintTeal", 0, T((-0.02, 0, 0.727)))
    p.add(torus(0.09, 0.012, 0, 12, 4), "paintRed", 0, T((0.4, 0, 1.02)) @ RY(1.0) @ Matrix.Scale(0.8, 4, (0, 1, 0)))               # bridle
    return p


def ballerina():
    """the dancer from the lid of a music box, on her gilded stand. 1.25 tall."""
    p = Prop("ballerina")
    p.add(lathe([(0, 0), (0.3, 0), (0.32, 0.03), (0.28, 0.07), (0.1, 0.1), (0, 0.1)], 20), "gold", 0)
    leg = Vector((0.0, 0, 0.5))
    p.add(cyl(0.028, 0.04, 0.5, 0.1, 8), "ivory", 0)                           # the standing leg, on point
    p.add(cyl(0.03, 0.02, 0.07, 0.08, 8), "paintPink", 0)
    M = T((0, 0, 0.6)) @ RY(-1.25)
    p.add(cyl(0.04, 0.026, 0.46, 0, 8), "ivory", 0, M)                         # the other, held out behind
    p.add(cyl(0.028, 0.012, 0.08, 0.44, 8), "paintPink", 0, M)
    for i, (r, z) in enumerate([(0.36, 0.6), (0.31, 0.63), (0.25, 0.655)]):   # tutu: three scalloped layers
        out = [((r + 0.03 * math.cos(9 * a)) * math.cos(a), (r + 0.03 * math.cos(9 * a)) * math.sin(a)) for a in [TAU * k / 54 for k in range(54)]]
        p.add(slab(out, 0.018), "paintPink" if i != 1 else "paintCream", 0, T((0, 0, z)) @ RX(-math.pi / 2))
    p.add(lathe([(0.075, 0.58), (0.06, 0.7), (0.085, 0.84), (0.05, 0.9), (0, 0.9)], 10), "paintPink", 0)
    p.add(cyl(0.022, 0.022, 0.07, 0.88, 8), "ivory", 0)
    p.add(sphere(0.075, (0, 0, 1.01), (0.92, 0.92, 1.05), 12, 8), "ivory", 0)
    p.add(sphere(0.078, (-0.012, 0, 1.03), (0.95, 0.98, 0.9), 12, 8), "woodDark", 0)
    p.add(sphere(0.04, (-0.03, 0, 1.11), u=8, v=6), "woodDark", 0)
    p.add(torus(0.03, 0.008, 1.09, 10, 4), "gold", 0, T((-0.03, 0, 0)))
    for s in (-1, 1):                                                       # arms in fifth position
        pts = [Vector((0, s * 0.085, 0.83)), Vector((0.04, s * 0.2, 0.96)), Vector((0.05, s * 0.17, 1.12)), Vector((0.03, s * 0.05, 1.22))]
        for a, b in zip(pts, pts[1:]):
            d = b - a
            p.add(cyl(0.02, 0.016, d.length, 0, 6), "ivory", 0, T(a) @ d.to_track_quat("Z", "Y").to_matrix().to_4x4())
    return p


def waterwheel():
    """lies flat like the gears (axle = up), 2.3 across, 0.5 thick: turn it with a mover."""
    p = Prop("waterwheel")
    for z in (0.04, 0.46):
        p.add(torus(1.0, 0.05, z, 36, 6), "woodDark", 0)
        p.add(torus(0.62, 0.035, z, 28, 6), "woodDark", 0)
        for i in range(8):
            p.add(box(0.96, 0.06, 0.04, (0.52, 0, z)), "dowel", 0.008, RZ(TAU * i / 8))
    for i in range(16):
        p.add(box(0.34, 0.03, 0.44, (0.98, 0, 0.25)), "birch", 0.01, RZ(TAU * i / 16) @ T((0.98, 0, 0)) @ RZ(0.5) @ T((-0.98, 0, 0)))
    p.add(cyl(0.12, 0.12, 0.6, -0.05, 12), "woodDark", 0.015)
    p.add(cyl(0.05, 0.05, 0.8, -0.15, 8), "brass", 0)
    return p


def bell():
    """hangs from its top. 0.6 tall."""
    p = Prop("bell")
    p.add(sphere(0.055, (0, 0, 0.04), u=8, v=6), "woodDark", 0)
    p.add(cyl(0.01, 0.01, 0.24, 0.06, 4), "woodDark", 0)
    p.add(lathe([(0.26, 0.08), (0.27, 0.11), (0.2, 0.2), (0.15, 0.34), (0.13, 0.44), (0.07, 0.5), (0, 0.51)], 18), "gold", 0)
    p.add(lathe([(0.24, 0.09), (0.18, 0.2), (0.13, 0.34), (0.11, 0.43), (0, 0.47)], 18), "copper", 0)
    p.add(torus(0.045, 0.014, 0, 10, 5), "gold", 0, T((0, 0, 0.55)) @ RX(math.pi / 2))
    return p


# ---- small furniture of a world --------------------------------------------------
def fence():
    """1.2 of picket fence along X."""
    p = Prop("fence")
    for i in range(6):
        x, h = -0.5 + i * 0.2, 0.42 + (0.03 if i % 2 else 0)
        p.add(slab([(-0.045, 0), (0.045, 0), (0.045, h - 0.06), (0, h), (-0.045, h - 0.06)], 0.03), "paintCream", 0.006, T((x, 0, 0)) @ RZ((i % 3 - 1) * 0.03))
    for z in (0.14, 0.3):
        p.add(box(1.2, 0.025, 0.045, (0, 0.028, z)), "paintCream", 0.006)
    return p


def signpost():
    p = Prop("signpost")
    p.add(cyl(0.035, 0.03, 0.95, 0, 7), "woodDark", 0.006)
    p.add(cyl(0.09, 0.06, 0.05, 0, 7), "stone", 0.01)
    for z, a, c in [(0.78, 0.3, "paintCream"), (0.6, 2.6, "birch"), (0.42, -1.2, "paintCream")]:
        p.add(slab([(-0.04, -0.06), (0.3, -0.06), (0.38, 0), (0.3, 0.06), (-0.04, 0.06)], 0.025), c, 0.006, RZ(a) @ T((0.02, 0.03, z)))
    p.add(sphere(0.04, (0, 0, 0.97), u=8, v=5), "paintRed", 0)
    return p


x = 0.0
for build in [wizard_tower, cottage, toadstool_house, clock_tower, stone_bridge, gate_arch, well, fountain, street_lamp, paper_lantern, candle,
              star, fairy_lights, bunting, balloon, airship, pine_snow, rock_spire, floating_rock, snowman, carousel_horse, ballerina,
              waterwheel, bell, fence, signpost]:
    ob = build().finish(x)
    x += max(ob.dimensions.x, 1.0) + 0.8

RESULT = {o.name: (round(o.dimensions.x, 2), round(o.dimensions.y, 2), round(o.dimensions.z, 2), sum(len(f.vertices) - 2 for f in o.data.polygons)) for o in scene.collection.objects}


def export(path):
    if not bpy.app.background:
        raise RuntimeError("export this pack headless (see the bottom of this file): exporting a second scene from a live session crashes Blender 5.3")
    for o in bpy.data.objects:
        o.select_set(o.name in scene.collection.objects)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=True, export_apply=True, export_yup=True)


def export_collision(path):
    """triangle soup per prop, in game axes (x, z-up -> y-up), for exact physics."""
    import json
    out = {}
    for o in scene.collection.objects:
        me = o.data
        me.calc_loop_triangles()
        pos = []
        for v in me.vertices:
            pos += [round(v.co.x, 4), round(v.co.z, 4), round(-v.co.y, 4)]
        idx = []
        for t in me.loop_triangles:
            idx += list(t.vertices)
        out[o.name] = {"p": pos, "i": idx}
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as f:
        json.dump(out, f, separators=(",", ":"))


# Headless (does not touch an open Blender session) — this is the normal way to rebuild the pack:
#   /Applications/Blender.app/Contents/MacOS/Blender -b --python tools/blender_pack_atelier.py -- export
if "export" in sys.argv:
    ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) + "/"
    export(ROOT + "public/packs/atelier.glb")
    export_collision(ROOT + "src/packs/atelier.collision.json")
    print("PACK", RESULT)
