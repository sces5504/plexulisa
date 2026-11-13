# Plexulisa prop library — run inside Blender (exec this file).
# Builds handmade-looking props in a scene called "Plexulisa" and exports
# public/props.glb. Units = game units, Blender Z = game up.
# Material *names* are what matter: the game swaps them for its own shaders.
import bpy, bmesh, math, os
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


scene = bpy.data.scenes.get("Plexulisa") or bpy.data.scenes.new("Plexulisa")
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
def lighthouse():
    p = Prop("lighthouse")
    p.add(cyl(1.44, 1.42, 0.12, 0, 48), "birch", 0.03)                      # plinth
    for i in range(6):
        p.add(cyl(1.38, 1.38, 1.7, i * 1.7, 48), "paintRed" if i % 2 else "paintCream", 0.035)
    for ang, z in [(0.6, 1.0), (2.5, 3.3), (4.4, 5.7), (0.2, 7.9), (3.3, 9.0)]:  # little windows
        M = RZ(ang) @ T((1.36, 0, z))
        p.add(box(0.1, 0.4, 0.58), "birch", 0.02, M)
        p.add(box(0.12, 0.26, 0.42), "paintNavy", 0.01, M)
        p.add(box(0.14, 0.03, 0.42), "birch", 0, M)
    # gallery
    p.add(cyl(1.6, 1.78, 0.16, 10.2, 48), "birch", 0.03)
    for i in range(14):
        a = 2 * math.pi * i / 14
        p.add(cyl(0.03, 0.03, 0.42, 10.36, 8), "dowel", 0, T((1.66 * math.cos(a), 1.66 * math.sin(a), 0)))
    p.add(torus(1.66, 0.035, 10.8, 48, 8), "dowel", 0)
    # lamp room
    p.add(cyl(0.98, 0.98, 0.14, 10.36, 32), "woodDark", 0.02)
    p.add(cyl(0.82, 0.82, 0.95, 10.5, 24), "lamp", 0)
    for i in range(8):
        a = 2 * math.pi * i / 8
        p.add(box(0.07, 0.07, 0.95, (0, 0, 10.975)), "woodDark", 0.01, RZ(a) @ T((0.84, 0, 0)))
    p.add(cyl(0.98, 0.98, 0.1, 11.45, 32), "woodDark", 0.02)
    # roof
    p.add(cyl(1.32, 1.22, 0.1, 11.55, 32), "paintRed", 0.03)
    p.add(cyl(1.22, 0.1, 1.05, 11.65, 32), "paintRed", 0.03)
    p.add(cyl(0.05, 0.03, 0.3, 12.65, 8), "brass", 0)
    p.add(sphere(0.13, (0, 0, 12.72)), "brass", 0)
    return p


def house():
    p = Prop("house")
    p.add(box(1.04, 1.24, 0.06, (0, 0, 0.03)), "birch", 0.015)             # footing
    p.add(box(1.0, 1.2, 0.8, (0, 0, 0.43)), "body", 0.03)
    p.add(prism(1.0, 0.5, 1.2, 0.8), "body", 0)                             # gable walls
    for sx in (-1, 1):                                                     # roof boards with overhang
        ang = math.atan2(0.5, 0.5)
        M = T((sx * 0.285, 0, 1.085)) @ RY(sx * ang)
        p.add(box(0.86, 1.42, 0.07), "roof", 0.015, M)
    p.add(box(0.1, 1.44, 0.1, (0, 0, 1.36)), "roof", 0.02)                 # ridge cap
    p.add(box(0.2, 0.2, 0.42, (0.28, 0.3, 1.25)), "roof", 0.02)            # chimney
    p.add(box(0.26, 0.26, 0.06, (0.28, 0.3, 1.48)), "birch", 0.015)
    p.add(box(0.3, 0.05, 0.5, (-0.18, -0.61, 0.31)), "birch", 0.015)       # door
    p.add(sphere(0.022, (-0.08, -0.645, 0.3), u=10, v=6), "brass", 0)
    for c, s in [((0.25, -0.61, 0.48), (0.26, 0.04, 0.26)), ((0.51, 0.1, 0.48), (0.04, 0.3, 0.26)),
                 ((-0.51, 0.1, 0.48), (0.04, 0.3, 0.26)), ((0, 0.61, 0.5), (0.34, 0.04, 0.26)),
                 ((0, -0.61, 1.02), (0.18, 0.04, 0.18))]:
        p.add(box(s[0] + 0.07 * (s[0] > 0.1), s[1] + 0.07 * (s[1] > 0.1), s[2] + 0.07, c), "birch", 0.01)
        p.add(box(s[0] + 0.012 * (s[0] < 0.1), s[1] + 0.012 * (s[1] < 0.1), s[2], c), "paintNavy", 0)
    return p


def tree_pine():
    p = Prop("tree_pine")
    p.add(cyl(0.075, 0.06, 0.5, 0, 12), "dowel", 0.01)
    p.add(cyl(0.44, 0.16, 0.5, 0.4, 14), "treeA", 0.03)
    p.add(cyl(0.36, 0.11, 0.48, 0.74, 14), "treeA", 0.03)
    p.add(cyl(0.27, 0.02, 0.5, 1.06, 14), "treeA", 0.025)
    return p


def tree_round():
    p = Prop("tree_round")
    p.add(cyl(0.075, 0.06, 0.55, 0, 12), "dowel", 0.01)
    p.add(cyl(0.11, 0.11, 0.05, 0.5, 12), "dowel", 0.012)
    p.add(sphere(0.43, (0, 0, 0.9), (1, 1, 0.92), 20, 12), "treeB", 0)
    return p


def tree_ply():
    """two interlocking plywood cut-outs"""
    p = Prop("tree_ply")
    half = [(0.07, 0), (0.07, 0.34), (0.46, 0.34), (0.2, 0.74), (0.36, 0.74), (0.13, 1.1), (0.25, 1.1), (0, 1.55)]
    outline = half + [(-x, z) for x, z in reversed(half[:-1])]
    p.add(slab(outline, 0.06), "treeA", 0.012)
    p.add(slab(outline, 0.06), "treeA", 0.012, RZ(math.pi / 2))
    p.add(cyl(0.2, 0.2, 0.05, 0, 16), "birch", 0.012)
    return p


def windmill():
    p = Prop("windmill")
    r8 = RZ(math.pi / 8)
    p.add(cyl(0.56, 0.52, 0.1, 0, 8), "birch", 0.02, r8)
    p.add(cyl(0.5, 0.33, 1.45, 0.1, 8), "paintCream", 0.025, r8)
    p.add(cyl(0.4, 0.4, 0.08, 1.55, 8), "birch", 0.02, r8)
    p.add(cyl(0.38, 0.05, 0.48, 1.63, 8), "paintRed", 0.025, r8)
    p.add(box(0.24, 0.05, 0.42), "birch", 0.012, T((0, -0.44, 0.33)) @ RX(math.radians(-6.7)))
    p.add(box(0.16, 0.05, 0.18), "paintNavy", 0.008, T((0, 0.37, 0.95)) @ RX(math.radians(6.7)))
    p.add(cyl(0.05, 0.05, 0.3, 0, 10), "dowel", 0, T((0, -0.35, 1.35)) @ RX(math.pi / 2))  # axle towards -Y
    return p


def sails():
    """origin at the hub; the wheel spins around Blender Y (game Z)."""
    p = Prop("sails")
    p.add(cyl(0.1, 0.1, 0.16, -0.08, 12), "dowel", 0.015, RX(math.pi / 2))
    for k in range(4):
        M = RY(k * math.pi / 2)
        p.add(box(0.045, 0.045, 0.95, (0, -0.05, 0.5)), "dowel", 0.008, M)
        p.add(box(0.03, 0.02, 0.72, (0.25, -0.05, 0.6)), "dowel", 0, M)
        for z in (0.26, 0.6, 0.94):
            p.add(box(0.27, 0.02, 0.03, (0.125, -0.05, z)), "dowel", 0, M)
        p.add(box(0.21, 0.008, 0.66, (0.135, -0.05, 0.6)), "paper", 0, M)
    return p


def cloud():
    circles = [(0, 0.05, 0.5), (0.52, -0.06, 0.38), (-0.55, -0.08, 0.36), (0.14, 0.24, 0.36), (-0.22, 0.16, 0.34)]

    def outline(scale, n=72):
        pts = []
        for i in range(n):
            a = 2 * math.pi * i / n
            dx, dz = math.cos(a), math.sin(a)
            best = 0.05
            for cx, cz, r in circles:
                b = dx * cx + dz * cz
                disc = b * b - (cx * cx + cz * cz - r * r)
                if disc > 0:
                    best = max(best, b + math.sqrt(disc))
            x, z = dx * best * scale, max(dz * best * scale, -0.24 * scale)
            pts.append((x, z))
        return pts
    p = Prop("cloud")
    p.add(slab(outline(1.0), 0.09), "paper", 0.02)
    p.add(slab(outline(0.72), 0.07), "paper", 0.02, T((0.1, -0.09, -0.05)))
    p.add(slab(outline(0.6), 0.07), "paper", 0.02, T((-0.18, 0.09, 0.02)))
    return p


def moon():
    R, r2, off = 0.85, 0.72, 0.42
    xi = (R * R - r2 * r2 + off * off) / (2 * off)
    ac = math.acos(xi / R)
    bc = math.atan2(R * math.sin(ac), xi - off)
    outline = []
    for k in range(49):                                                    # outer arc through angle pi
        a = ac + (2 * math.pi - 2 * ac) * k / 48
        outline.append((R * math.cos(a), R * math.sin(a)))
    for k in range(1, 32):                                                 # inner arc back
        b = (2 * math.pi - bc) - (2 * math.pi - 2 * bc) * k / 32
        outline.append((off + r2 * math.cos(b), r2 * math.sin(b)))
    p = Prop("moon")
    p.add(slab(outline, 0.16), "paintYellow", 0.03)
    return p


def gear(name, R, teeth, mat, h=0.14):
    p = Prop(name)
    out = []
    for i in range(teeth):
        a = 2 * math.pi * i / teeth
        da = 2 * math.pi / teeth
        for f, rr in [(-0.25, R - 0.02), (-0.14, R + 0.16), (0.14, R + 0.16), (0.25, R - 0.02)]:
            out.append((rr * math.cos(a + f * da), rr * math.sin(a + f * da)))
    rin = R * 0.72
    hole = [(rin * math.cos(-2 * math.pi * i / 40), rin * math.sin(-2 * math.pi * i / 40)) for i in range(40)]
    flat = RX(-math.pi / 2)                                                # slab is built in XZ; lay it flat
    p.add(slab(out, h, (hole,)), mat, 0.012, flat)
    nsp = 6 if R > 0.8 else 3
    for i in range(nsp):
        p.add(box(rin * 1.04, R * 0.16, h * 0.8, (rin * 0.5, 0, 0)), mat, 0.012, RZ(2 * math.pi * i / nsp))
    p.add(cyl(R * 0.24, R * 0.24, h * 1.3, -h * 0.65, 20), mat, 0.012)
    return p


COLORS.update({"grass": (0.28, 0.45, 0.2), "rock": (0.33, 0.31, 0.29), "crystal": (0.2, 0.62, 0.6), "whale": (0.07, 0.19, 0.34)})


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


def island():
    """floating island, unit radius, grass top at z = 0, rock hanging below."""
    p = Prop("island")
    p.add(cyl(0.97, 1.0, 0.16, -0.16, 28), "grass", 0.035)
    p.add(cyl(0.62, 0.93, 0.42, -0.58, 9), "rock", 0.03)
    p.add(cyl(0.3, 0.62, 0.42, -1.0, 7), "rock", 0.03, RZ(0.4))
    p.add(cyl(0.04, 0.3, 0.4, -1.4, 5), "rock", 0.02, RZ(0.9))
    for a, r, s in [(0.5, 0.78, 0.2), (2.4, 0.7, 0.26), (4.3, 0.8, 0.17)]:
        p.add(cyl(s * 0.6, s, s * 0.9, -0.16 - s * 0.8, 6), "rock", 0.02, T((r * math.cos(a), r * math.sin(a), 0)))
    return p


def mushroom():
    p = Prop("mushroom")
    p.add(lathe([(0, 0), (0.17, 0), (0.12, 0.3), (0.1, 0.62), (0, 0.62)], 14), "paintCream", 0.012)
    p.add(lathe([(0.1, 0.56), (0.5, 0.6), (0.52, 0.68)], 22), "paintCream", 0)
    p.add(lathe([(0.52, 0.6), (0.54, 0.68), (0.46, 0.84), (0.28, 0.96), (0, 1.0)], 22), "paintRed", 0)
    for a, r, z, s in [(0.3, 0.36, 0.89, 0.07), (1.9, 0.4, 0.86, 0.06), (3.3, 0.33, 0.91, 0.075), (4.7, 0.42, 0.84, 0.055), (2.6, 0.12, 0.985, 0.06)]:
        p.add(sphere(s, (r * math.cos(a), r * math.sin(a), z), (1, 1, 0.45), 10, 6), "paintCream", 0)
    return p


def giant_mushroom():
    """stalk rises 8.75 from the sea; flat cap top (r 1.3) at z = 9.6 is a landing pad."""
    p = Prop("giant_mushroom")
    p.add(lathe([(0, 0), (0.95, 0), (0.7, 0.5), (0.58, 2.5), (0.5, 6.5), (0.56, 8.5), (0, 8.5)], 20), "paintCream", 0)
    p.add(lathe([(0.56, 8.4), (2.2, 8.72), (2.32, 8.8)], 40), "paintCream", 0)
    for i in range(20):                                                    # gills
        a = 2 * math.pi * i / 20
        p.add(box(1.6, 0.03, 0.08, (1.38, 0, 8.64)), "dowel", 0, RZ(a) @ RY(math.radians(-10.5)))
    p.add(lathe([(2.32, 8.74), (2.36, 8.86), (2.2, 9.1), (1.8, 9.38), (1.36, 9.56), (1.3, 9.6), (0, 9.6)], 40), "paintRed", 0)
    for i in range(9):
        a = 2 * math.pi * i / 9 + 0.2
        r, z, s = (2.0, 9.22, 0.19) if i % 2 else (1.62, 9.45, 0.15)
        p.add(sphere(s, (r * math.cos(a), r * math.sin(a), z), (1, 1, 0.4), 12, 6), "paintCream", 0)
    return p


def crystal():
    p = Prop("crystal")
    for (x, y), r, h, tx, ty in [((0, 0), 0.16, 0.75, 0, 0), ((0.2, 0.08), 0.11, 0.5, 0.35, 0.1), ((-0.18, 0.1), 0.1, 0.42, -0.4, 0.15),
                                 ((0.05, -0.2), 0.09, 0.36, 0.1, -0.45), ((-0.1, -0.14), 0.07, 0.26, -0.3, -0.35)]:
        M = T((x, y, 0)) @ RY(tx) @ RX(-ty)
        p.add(cyl(r, r, h, 0, 6), "crystal", 0, M)
        p.add(cyl(r, 0.0, r * 1.5, h, 6), "crystal", 0, M)
    p.add(cyl(0.36, 0.3, 0.07, 0, 7), "rock", 0.02)
    return p


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


def whale():
    """wooden sky whale in one turned piece, nose towards +X, about 4.6 long."""
    p = Prop("whale")
    body = [(-2.55, 0), (-2.5, 0.1), (-2.1, 0.17), (-1.6, 0.3), (-1.1, 0.52), (-0.5, 0.8), (0.2, 0.97), (0.9, 1.0), (1.45, 0.86), (1.8, 0.58), (1.98, 0.25), (2.02, 0)]
    p.add(lathe_x(body, 0.72, 0.64), "whale", 0)
    belly = [(-1.5, 0), (-1.2, 0.3), (-0.5, 0.7), (0.2, 0.9), (0.9, 0.95), (1.45, 0.82), (1.8, 0.55), (1.97, 0.22), (2.0, 0)]
    p.add(lathe_x(belly, 0.7, 0.52), "paintCream", 0, T((0.03, 0, -0.14)))
    for s in (-1, 1):                                                      # flukes, joined to the end of the tail
        p.add(sphere(1.0, (0, 0, 0), (0.46, 0.26, 0.07), 16, 8), "whale", 0, T((-2.72, s * 0.3, 0.04)) @ RZ(s * 0.55))
        p.add(sphere(1.0, (0, 0, 0), (0.42, 0.2, 0.06), 16, 8), "whale", 0, T((0.75, s * 0.74, -0.3)) @ RZ(-s * 0.55))
        p.add(sphere(0.06, (1.5, s * 0.5, 0.12), u=10, v=6), "paintNavy", 0)
    p.add(sphere(1.0, (0, 0, 0), (0.3, 0.05, 0.2), 12, 6), "whale", 0, T((-0.2, 0, 0.62)))   # little dorsal fin
    return p


def wave():
    """plywood wave board, 2.4 wide, standing in the XZ plane."""
    def outline(h, n=4):
        pts = [(-1.2, 0)]
        for i in range(49):
            x = -1.2 + 2.4 * i / 48
            ph = (i / 48) * n
            pts.append((x, h * (0.55 + 0.45 * abs(math.sin(math.pi * ph)) ** 0.7)))
        pts.append((1.2, 0))
        return pts
    p = Prop("wave")
    p.add(slab(outline(0.5), 0.07), "paintBlue", 0.012)
    p.add(slab(outline(0.3, 5), 0.06), "whale", 0.012, T((0.1, -0.09, 0)))
    return p


def boat():
    p = Prop("boat")
    hull = [(-0.7, 0.36), (0.78, 0.36), (0.55, 0), (-0.55, 0)]
    p.add(slab(hull, 0.52), "paintRed", 0.07)
    p.add(box(1.36, 0.56, 0.05, (0.02, 0, 0.37)), "birch", 0.015)
    p.add(box(0.5, 0.36, 0.34, (-0.12, 0, 0.56)), "paintCream", 0.03)
    p.add(box(0.58, 0.44, 0.05, (-0.12, 0, 0.75)), "paintBlue", 0.015)
    p.add(cyl(0.085, 0.085, 0.32, 0.77, 12), "paintNavy", 0.012, T((-0.2, 0, 0)))
    p.add(cyl(0.02, 0.015, 0.6, 0.39, 6), "dowel", 0, T((0.42, 0, 0)))
    p.add(slab([(0.44, 0.98), (0.44, 0.78), (0.72, 0.88)], 0.015), "paintYellow", 0)
    return p


COLORS.update({"jelly": (0.85, 0.3, 0.45), "jellyB": (0.2, 0.6, 0.7), "coral": (0.75, 0.2, 0.15), "pearl": (1.0, 0.92, 0.8)})


def jelly():
    """paper-lantern jellyfish: tethered at z = 0, bell floating above."""
    p = Prop("jelly")
    p.add(lathe([(0.34, 1.0), (0.45, 1.06), (0.47, 1.2), (0.4, 1.38), (0.24, 1.5), (0, 1.54)], 20), "jelly", 0)
    p.add(lathe([(0, 1.02), (0.3, 1.0), (0.34, 1.0)], 20), "jellyB", 0)
    for i in range(7):
        a = 2 * math.pi * i / 7
        for k in range(6):                                                  # a wavy ribbon of short segments
            r = 0.26 + 0.05 * math.sin(k * 1.6 + i)
            z = 0.98 - (k + 1) * (0.11 + 0.012 * (i % 3))
            p.add(sphere(0.035, (r * math.cos(a + k * 0.12), r * math.sin(a + k * 0.12), z), (1, 1, 1.9), 6, 4), "jelly", 0)
    p.add(cyl(0.008, 0.008, 1.0, 0, 4), "paper", 0)
    return p


def coral():
    """a little branching coral tree, about 1.3 tall."""
    p = Prop("coral")
    p.add(cyl(0.2, 0.13, 0.12, 0, 9), "rock", 0.02)
    def branch(M, r, h, depth):
        p.add(cyl(r, r * 0.72, h, 0, 7), "coral", 0, M)
        tip = M @ T((0, 0, h))
        if depth == 0:
            p.add(sphere(r * 0.95, (0, 0, 0), u=8, v=6), "coral", 0, tip)
            return
        for j, (tx, ty) in enumerate([(0.55, 0.15), (-0.5, 0.3), (0.1, -0.6)][: 2 + depth % 2]):
            branch(tip @ RZ(j * 2.1 + depth) @ RY(tx) @ RX(ty), r * 0.7, h * 0.72, depth - 1)
    branch(T((0, 0, 0.08)), 0.1, 0.42, 3)
    return p


def clam():
    """giant open clam with a glowing pearl; hinge at the back (+Y)."""
    p = Prop("clam")
    half = [(0, 0), (0.35, 0.02), (0.62, 0.1), (0.8, 0.24), (0.82, 0.3)]
    def shell(M, inner):
        p.add(lathe(half, 22), "paintCream", 0, M)
        p.add(lathe([(0, 0.035), (0.34, 0.055), (0.6, 0.13), (0.76, 0.25)], 22), inner, 0, M)
        for i in range(11):                                                 # ribs
            a = math.pi * (0.08 + 0.84 * i / 10)
            p.add(sphere(1, (0, 0, 0), (0.035, 0.42, 0.03), 6, 4), "paintCream", 0, M @ RZ(a - math.pi / 2) @ T((0, -0.42, 0.06)) @ RX(-0.28))
    shell(T((0, 0, 0.02)) @ RX(0), "jelly")
    shell(T((0, 0.78, 0.36)) @ RX(math.radians(118)) @ T((0, 0.78, 0)), "jelly")
    p.add(sphere(0.2, (0, -0.05, 0.3), u=16, v=10), "pearl", 0)
    return p


x = 0.0
for build in [lighthouse, house, tree_pine, tree_round, tree_ply, windmill, sails, cloud, moon,
              lambda: gear("gear_big", 1.2, 18, "birch"), lambda: gear("gear_small", 0.47, 7, "woodDark"),
              island, mushroom, giant_mushroom, crystal, whale, wave, boat, jelly, coral, clam]:
    ob = build().finish(x)
    x += max(ob.dimensions.x, 1.0) + 0.8

RESULT = {o.name: (round(o.dimensions.x, 2), round(o.dimensions.y, 2), round(o.dimensions.z, 2), len(o.data.polygons)) for o in scene.collection.objects}


def export(path):
    win = bpy.context.window
    win.scene = scene
    for o in bpy.context.view_layer.objects:
        o.select_set(o.name in scene.collection.objects)
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
    with open(path, "w") as f:
        json.dump(out, f, separators=(",", ":"))
