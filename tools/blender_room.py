# Plexulisa — the cozy maker's room around the globe. Run inside Blender *after*
# blender_props.py (it reuses that script's helpers through `ns`).
# Units = game units (the globe is 24 across, i.e. roughly 1 unit = 0.8 cm).
# Blender X = right, Y = away from the viewer, Z = up. Globe centre = origin.
import bpy, math, random

ns = bpy.app.driver_namespace["plex"]
Prop, cyl, box, sphere, torus, slab, lathe = (ns[k] for k in ("Prop", "cyl", "box", "sphere", "torus", "slab", "lathe"))
T, RZ, RX, RY = ns["T"], ns["RZ"], ns["RX"], ns["RY"]

ns["COLORS"].update({
    "room_wall": (0.42, 0.4, 0.33), "room_trim": (0.72, 0.68, 0.58), "room_floor": (0.2, 0.11, 0.055), "room_rug": (0.36, 0.1, 0.07),
    "room_desk": (0.17, 0.075, 0.03), "room_wood": (0.5, 0.3, 0.13), "room_sky": (0.16, 0.22, 0.42), "room_curtain": (0.62, 0.5, 0.36),
    "room_metal": (0.05, 0.05, 0.055), "room_shade": (0.75, 0.42, 0.16), "room_bulb": (1.0, 0.72, 0.38), "room_fabric": (0.08, 0.2, 0.2),
    "room_paper": (0.8, 0.76, 0.66), "room_green": (0.1, 0.26, 0.08), "room_terra": (0.48, 0.17, 0.08), "room_tin": (0.5, 0.5, 0.48),
    "room_b1": (0.45, 0.07, 0.05), "room_b2": (0.06, 0.16, 0.3), "room_b3": (0.6, 0.38, 0.06), "room_b4": (0.1, 0.25, 0.14), "room_b5": (0.5, 0.42, 0.3),
})

# headless: build straight into the startup scene (the one glTF export evaluates)
scene = bpy.context.scene if bpy.app.background else (bpy.data.scenes.get("PlexulisaRoom") or bpy.data.scenes.new("PlexulisaRoom"))
for o in list(scene.collection.objects):
    me = o.data
    bpy.data.objects.remove(o, do_unlink=True)
    if me and me.users == 0:
        bpy.data.meshes.remove(me)
ns["scene"] = scene
random.seed(4)

TABLE = -13.3
FLOOR = TABLE - 86
p = Prop("room")

# ---- shell -----------------------------------------------------------------
WY, WX0, WX1, WZ0, WZ1 = 66, 34, 134, -4, 116            # back wall plane and window opening
CEIL = 240
p.add(box(760, 900, 3, (20, -180, FLOOR - 1.5)), "room_floor", 0)
p.add(box(760, 900, 3, (20, -180, CEIL)), "room_trim", 0)
p.add(box(WX0 + 360, 4, CEIL - FLOOR, ((WX0 - 360) / 2, WY, (CEIL + FLOOR) / 2)), "room_wall", 0)
p.add(box(400 - WX1, 4, CEIL - FLOOR, ((400 + WX1) / 2, WY, (CEIL + FLOOR) / 2)), "room_wall", 0)
p.add(box(WX1 - WX0, 4, WZ0 - FLOOR, ((WX0 + WX1) / 2, WY, (WZ0 + FLOOR) / 2)), "room_wall", 0)
p.add(box(WX1 - WX0, 4, CEIL - WZ1, ((WX0 + WX1) / 2, WY, (CEIL + WZ1) / 2)), "room_wall", 0)
p.add(box(4, 900, CEIL - FLOOR, (-360, -180, (CEIL + FLOOR) / 2)), "room_wall", 0)
p.add(box(4, 900, CEIL - FLOOR, (400, -180, (CEIL + FLOOR) / 2)), "room_wall", 0)
p.add(box(760, 4, CEIL - FLOOR, (20, -630, (CEIL + FLOOR) / 2)), "room_wall", 0)
p.add(box(760, 3, 14, (20, WY - 3, FLOOR + 7)), "room_trim", 0.8)                     # skirting
for i in range(9):                                                                     # floorboard seams
    p.add(box(0.6, 900, 0.3, (-340 + i * 90, -180, FLOOR + 0.1)), "room_desk", 0)
p.add(cyl(170, 170, 1.2, FLOOR, 48), "room_rug", 0.4, T((10, -90, 0)))
p.add(cyl(150, 150, 1.3, FLOOR, 48), "room_curtain", 0, T((10, -90, 0)))
p.add(cyl(140, 140, 1.4, FLOOR, 48), "room_rug", 0, T((10, -90, 0)))

# ---- window ------------------------------------------------------------------
cx, cz, ww, wh = (WX0 + WX1) / 2, (WZ0 + WZ1) / 2, WX1 - WX0, WZ1 - WZ0
for dx in (-ww / 2, ww / 2):
    p.add(box(6, 9, wh + 6, (cx + dx, WY - 1, cz)), "room_trim", 0.8)
for dz in (-wh / 2, wh / 2):
    p.add(box(ww + 6, 9, 6, (cx, WY - 1, cz + dz)), "room_trim", 0.8)
p.add(box(3, 5, wh, (cx, WY, cz)), "room_trim", 0.5)
p.add(box(ww, 5, 3, (cx, WY, cz + 12)), "room_trim", 0.5)
p.add(box(ww + 22, 16, 3.5, (cx, WY - 8, WZ0 - 4)), "room_trim", 0.9)                 # sill
p.add(cyl(1.2, 1.2, ww + 70, 0, 10), "room_metal", 0, T((cx - (ww + 70) / 2, WY - 9, WZ1 + 12)) @ RY(math.pi / 2))
for side in (-1, 1):                                                                   # curtains: soft folds
    for k in range(7):
        x = cx + side * (ww / 2 + 22 - k * 5.2)
        p.add(cyl(3.6, 3.2, wh + 26, WZ0 - 14, 10), "room_curtain", 0, T((x, WY - 9 + (k % 2) * 2.2, 0)))
# things on the sill
p.add(cyl(5.5, 4.5, 8, WZ0 - 2.2, 14), "room_terra", 0.5, T((cx - 30, WY - 9, 0)))
for k in range(7):
    a = k * 0.9
    p.add(sphere(1, (0, 0, 0), (1.6, 5.5, 3.2), 10, 6), "room_green", 0, T((cx - 30 + 3 * math.cos(a), WY - 9 + 3 * math.sin(a), WZ0 + 10 + (k % 3) * 2.5)) @ RZ(a) @ RX(0.5))

# ---- desk ----------------------------------------------------------------------
DX, DY, DW, DD = 12, 6, 210, 104
# (the desk itself is no longer part of this mesh: it is a textured model of its own, same
#  footprint and height — see tools/blender_desk.py -> public/assets/room_desk.glb)

# desk lamp (front-left, leaning over the globe)
LX, LY = -66, -20
p.add(cyl(10, 9, 2.4, TABLE, 24), "room_metal", 0.5, T((LX, LY, 0)))
p.add(cyl(1.1, 1.1, 40, TABLE + 2, 10), "room_metal", 0, T((LX, LY, 0)) @ RY(math.radians(-8)))
elbow = (LX - 5.6, LY, TABLE + 41.6)
p.add(sphere(2.2, elbow, u=12, v=8), "room_metal", 0)
p.add(cyl(1.0, 1.0, 34, 0, 10), "room_metal", 0, T(elbow) @ RY(math.radians(62)))
head = (elbow[0] + 30, LY, elbow[2] + 16)
Mh = T(head) @ RY(math.radians(145))
p.add(lathe([(3.5, 0), (4.5, 3), (12.5, 15), (13, 15.3), (12.2, 15.6), (4.0, 3.4), (3.0, 0.6)], 28), "room_shade", 0, Mh)
p.add(sphere(3.6, (0, 0, 7), u=14, v=8), "room_bulb", 0, Mh)

# floor lamp glowing in the far left corner
p.add(cyl(14, 13, 3, FLOOR, 20), "room_metal", 0.6, T((-250, 20, 0)))
p.add(cyl(1.5, 1.5, 150, FLOOR + 3, 10), "room_metal", 0, T((-250, 20, 0)))
p.add(lathe([(13, 0), (22, -30), (21.4, -30), (12.4, 0)], 28), "room_shade", 0, T((-250, 20, FLOOR + 176)))
p.add(sphere(6, (-250, 20, FLOOR + 160), u=14, v=8), "room_bulb", 0)

# armchair (right, half out of frame)
AX, AY = 250, -40
p.add(box(78, 76, 22, (AX, AY, FLOOR + 30)), "room_fabric", 7)
p.add(box(78, 18, 62, (AX, AY + 34, FLOOR + 62)), "room_fabric", 7)
for s in (-1, 1):
    p.add(box(16, 76, 40, (AX + s * 40, AY, FLOOR + 44)), "room_fabric", 6)
p.add(box(40, 40, 12, (AX - 4, AY + 14, FLOOR + 50)), "room_b3", 5, RZ(0.0))

# ---- on the desk: a maker's clutter -----------------------------------------------
def book(x, y, z, w, d, h, col, rot=0.0):
    M = T((x, y, z)) @ RZ(rot)
    p.add(box(w, d, h, (0, 0, h / 2)), col, 0.25, M)
    p.add(box(w - 1.2, d - 0.6, h - 1.0, (0.9, 0, h / 2)), "room_paper", 0, M)

z = TABLE
for w, d, h, col, rot in [(34, 24, 4.2, "room_b2", 0.12), (31, 22, 3.4, "room_b1", -0.08), (27, 19, 3.0, "room_b3", 0.2)]:
    book(74, 26, z, w, d, h, col, rot)
    z += h
p.add(cyl(4.6, 4.2, 9.5, z, 20), "room_trim", 0.5, T((74, 26, 0)))                    # mug on the books
p.add(torus(3.2, 0.8, 0, 16, 6), "room_trim", 0, T((79.4, 26, z + 4.8)) @ RX(math.pi / 2))
p.add(cyl(3.9, 3.9, 0.3, z + 8.6, 16), "room_desk", 0, T((74, 26, 0)))

p.add(cyl(5, 5, 11, TABLE, 20), "room_tin", 0.3, T((58, -22, 0)))                      # brush pot
for k, col in enumerate(["room_wood", "room_b1", "room_b2", "room_wood"]):
    M = T((58 + math.cos(k * 1.7) * 2.2, -22 + math.sin(k * 1.7) * 2.2, TABLE + 1)) @ RY(0.16 * math.cos(k * 1.7)) @ RX(-0.16 * math.sin(k * 1.7))
    p.add(cyl(0.55, 0.55, 17, 0, 8), col, 0, M)
    p.add(cyl(0.7, 0.2, 3.2, 17, 8), "room_metal", 0, M)

for (x, y), col in [((-34, -30), "paintRed"), ((-45, -18), "paintBlue"), ((40, -34), "paintYellow")]:   # paint tins
    p.add(cyl(5.2, 5.2, 6.4, TABLE, 24), "room_tin", 0.3, T((x, y, 0)))
    p.add(cyl(4.6, 4.6, 0.4, TABLE + 6.3, 24), col, 0, T((x, y, 0)))
p.add(cyl(5.4, 5.4, 0.8, TABLE, 24), "room_tin", 0.2, T((-22, -40, 0)))                # a lid, set aside
p.add(cyl(4.6, 4.6, 0.3, TABLE + 0.7, 24), "paintRed", 0, T((-22, -40, 0)))

for x, y, w, d, h, r in [(26, -38, 12, 5, 2.4, 0.3), (17, -32, 7, 5, 2.4, -0.5), (30, -30, 5, 5, 5, 0.9), (-60, -40, 16, 4, 1.2, 0.2)]:   # offcuts
    p.add(box(w, d, h, (0, 0, h / 2)), "birch", 0.2, T((x, y, TABLE)) @ RZ(r))
p.add(cyl(0.5, 0.5, 19, 0, 6), "paintYellow", 0, T((2, -43, TABLE + 0.5)) @ RZ(0.35) @ RY(math.pi / 2))   # pencil
p.add(cyl(0.5, 0.05, 1.8, 19, 6), "birch", 0, T((2, -43, TABLE + 0.5)) @ RZ(0.35) @ RY(math.pi / 2))
p.add(box(30, 40, 0.15, (0, 0, 0.08)), "room_paper", 0, T((-78, 16, TABLE)) @ RZ(0.25))   # plan sheet
p.add(box(30, 40, 0.15, (0, 0, 0.24)), "room_paper", 0, T((-74, 20, TABLE)) @ RZ(-0.1))

p.add(cyl(8, 6.5, 11, TABLE, 18), "room_terra", 0.6, T((98, -8, 0)))                    # desk plant
for k in range(11):
    a = k * 2.4
    M = T((98, -8, TABLE + 11)) @ RZ(a) @ RY(0.5 + (k % 3) * 0.22)
    p.add(cyl(0.35, 0.3, 13 + k % 4 * 3, 0, 5), "room_green", 0, M)
    p.add(sphere(1, (0, 0, 0), (3.6, 1.2, 6.5), 10, 6), "room_green", 0, M @ T((0, 0, 15 + k % 4 * 3)))

# ---- on the wall ----------------------------------------------------------------------
for sz, n in [(52, 11), (98, 7)]:
    p.add(box(128, 20, 3, (-82, WY - 12, sz)), "room_wood", 0.5)
    for bx in (-136, -28):
        p.add(box(3, 16, 10, (bx, WY - 10, sz - 6)), "room_wood", 0.4)
    x = -140
    for k in range(n):
        w, h, d = random.uniform(3.5, 7), random.uniform(20, 30), random.uniform(15, 18)
        lean = 0.0 if k < n - 1 else 0.22
        M = T((x + w / 2, WY - 12, sz + 1.5)) @ RY(lean)
        p.add(box(w, d, h, (0, 0, h / 2)), random.choice(["room_b1", "room_b2", "room_b3", "room_b4", "room_b5"]), 0.3, M)
        x += w + 0.5
    if sz > 60:                                                                             # a little wooden whale and a jar on the upper shelf
        p.add(sphere(1, (0, 0, 0), (9, 3.6, 3.4), 16, 8), "whale", 0, T((-66, WY - 12, sz + 7)))
        p.add(cyl(0.5, 0.5, 4, sz + 1.5, 6), "room_wood", 0, T((-66, WY - 12, 0)))
        p.add(cyl(6, 6, 14, sz + 1.5, 16), "room_sky", 0.5, T((-40, WY - 12, 0)))
for (x, zc, w, h), col in [((-240, 80, 46, 60), "room_b4"), ((-190, 96, 30, 30), "room_b3"), ((-196, 52, 34, 40), "room_b2"), ((200, 70, 60, 80), "room_b5")]:
    p.add(box(w + 6, 2.5, h + 6, (x, WY - 3, zc)), "room_wood", 0.6)
    p.add(box(w, 2.8, h, (x, WY - 3.2, zc)), "room_paper", 0)
    p.add(box(w * 0.6, 3.0, h * 0.55, (x, WY - 3.3, zc - h * 0.05)), col, 0)

# ---- more life: the things that make it someone's room ------------------------------
ns["COLORS"].update({"room_mat": (0.06, 0.2, 0.13), "room_steel": (0.55, 0.56, 0.58), "room_night": (0.03, 0.05, 0.12), "room_moon": (1.0, 0.92, 0.7),
                     "room_fairy": (1.0, 0.7, 0.35), "room_cat": (0.75, 0.42, 0.15), "room_wains": (0.24, 0.27, 0.22), "room_peg": (0.5, 0.36, 0.2)})

# (what is outside the window is painted by the game: see paintEvening() in src/render.js)

# fairy lights sagging across the window
for k in range(15):
    u = k / 14
    x = cx - ww / 2 - 20 + u * (ww + 40)
    zz = WZ1 + 9 - 13 * math.sin(math.pi * u)
    p.add(sphere(1.5, (x, WY - 11, zz), u=8, v=6), "room_fairy", 0)
    if k:
        u0 = (k - 1) / 14
        x0, z0 = cx - ww / 2 - 20 + u0 * (ww + 40), WZ1 + 9 - 13 * math.sin(math.pi * u0)
        L = math.hypot(x - x0, zz - z0)
        p.add(cyl(0.18, 0.18, L, 0, 5), "room_metal", 0, T((x0, WY - 11, z0 + 1.6)) @ RY(math.atan2(x - x0, zz - z0)))

# wainscot on the back wall
p.add(box(700, 2.4, 74, (20, WY - 2.4, FLOOR + 37)), "room_wains", 0)
p.add(box(700, 4.2, 4, (20, WY - 3, FLOOR + 75)), "room_trim", 0.8)
for k in range(15):
    p.add(box(2.6, 3.2, 70, (-330 + k * 48, WY - 3, FLOOR + 38)), "room_wains", 0.5)

# pegboard with tools, left of the shelves
PX, PZ = -214, 18
p.add(box(74, 2, 62, (PX, WY - 3, PZ)), "room_peg", 0.6)
for ix in range(9):
    for iz in range(7):
        p.add(cyl(0.6, 0.6, 0.3, 0, 6), "room_desk", 0, T((PX - 32 + ix * 8, WY - 4.1, PZ - 26 + iz * 8.6)) @ RX(math.pi / 2))
p.add(box(3, 2.4, 24, (PX - 22, WY - 5.4, PZ - 4)), "room_wood", 0.4)                    # hammer
p.add(box(13, 4, 5, (PX - 22, WY - 5.8, PZ + 10)), "room_steel", 0.6)
p.add(slab([(-15, 0), (15, 3), (15, 9), (-15, 9)], 0.8), "room_steel", 0, T((PX + 8, WY - 5, PZ + 8)))   # hand saw
p.add(box(9, 2.6, 8, (PX + 26, WY - 5.4, PZ + 12)), "room_wood", 0.8)
p.add(box(2.4, 1, 40, (PX + 26, WY - 4.6, PZ - 8)), "room_steel", 0)                      # steel rule
for s_ in (-1, 1):                                                                         # scissors
    p.add(box(1.6, 0.8, 18, (0, 0, 2)), "room_steel", 0, T((PX + 2, WY - 4.8, PZ - 16)) @ RY(s_ * 0.16))
    p.add(torus(2.4, 0.6, 0, 12, 5), "room_b1", 0, T((PX + 2 + s_ * 2.6, WY - 4.8, PZ - 27)) @ RX(math.pi / 2))

# cutting mat, knife, glue, clamps, shavings — the globe was built right here
# (an A4-ish mat pushed to the front-left, so the wood of the desk shows all round the globe)
MAT = T((-46, -22, TABLE)) @ RZ(0.11)
p.add(box(46, 32, 0.5, (0, 0, 0.25)), "room_mat", 0.3, MAT)
for k in range(9):
    p.add(box(0.2, 30.6, 0.06, (-20 + k * 5, 0, 0.55)), "room_green", 0, MAT)
for k in range(6):
    p.add(box(44.6, 0.2, 0.06, (0, -12.5 + k * 5, 0.55)), "room_green", 0, MAT)
p.add(box(34, 3.4, 0.25, (0, 0, 0.7)), "room_steel", 0, T((-44, -36, TABLE)) @ RZ(0.02))  # ruler on the mat
Mk = T((38, -22, TABLE + 0.9)) @ RZ(2.2) @ RY(math.pi / 2)
p.add(cyl(0.8, 0.8, 13, 0, 8), "room_b1", 0, Mk)                                            # craft knife
p.add(cyl(0.7, 0.05, 3, 13, 4), "room_steel", 0, Mk)
p.add(cyl(3.2, 3.2, 9, TABLE, 16), "room_trim", 0.4, T((-84, -34, 0)))                      # glue bottle
p.add(cyl(1.6, 0.5, 4.5, TABLE + 9, 10), "room_b3", 0, T((-84, -34, 0)))
for k, (x, y, r) in enumerate([(22, -44, 0.4), (27, -46, 1.6), (14, -46, 2.7), (-8, -46, 0.9), (46, -42, 2.0), (-28, -47, 1.2)]):   # wood shavings
    p.add(torus(1.5 + (k % 3) * 0.4, 0.22, 0, 12, 4), "birch", 0, T((x, y, TABLE + 1.3)) @ RZ(r) @ RX(1.2))
for x, y, r in [(-98, 0, 0.3), (-92, -14, -0.4)]:                                           # two little clamps
    M = T((x, y, TABLE)) @ RZ(r)
    p.add(box(2, 9, 2, (0, 0, 1)), "room_steel", 0.3, M)
    p.add(box(2, 2, 8, (0, -3.5, 5)), "room_steel", 0.3, M)
    p.add(box(2, 2, 6, (0, 3.5, 4)), "room_b1", 0.3, M)
p.add(box(26, 16, 12, (0, 0, 6)), "room_wood", 0.6, T((-70, 34, TABLE)) @ RZ(0.06))        # little drawer chest
for k in range(2):
    p.add(box(22, 0.6, 4.4, (0, -8.2, 3.4 + k * 5.4)), "room_peg", 0.2, T((-70, 34, TABLE)) @ RZ(0.06))
    p.add(sphere(0.7, (0, -8.9, 3.4 + k * 5.4), u=8, v=6), "room_steel", 0, T((-70, 34, TABLE)) @ RZ(0.06))
for k, col in enumerate(["paintBlue", "paintYellow", "paintRed"]):                          # paint jars on the chest
    p.add(cyl(2.6, 2.6, 5.5, TABLE + 12, 12), "room_sky", 0.3, T((-78 + k * 8, 34.5 + k * 0.5, 0)))
    p.add(cyl(2.3, 2.3, 3.2, TABLE + 12.3, 12), col, 0, T((-78 + k * 8, 34.5 + k * 0.5, 0)))

# a cat asleep at the far end of the desk
CX, CY = 96, 30
p.add(sphere(1, (0, 0, 0), (13, 9, 6.5), 18, 10), "room_cat", 0, T((CX, CY, TABLE + 6)))
p.add(sphere(5.2, (CX - 10, CY - 5, TABLE + 5.4), u=14, v=10), "room_cat", 0)
for s_ in (-1, 1):
    p.add(cyl(1.7, 0.1, 3.4, 0, 4), "room_cat", 0, T((CX - 10 + s_ * 2.6, CY - 5.5, TABLE + 9.4)))
p.add(torus(9.5, 1.5, 0, 20, 6), "room_cat", 0, T((CX + 1, CY - 1.5, TABLE + 1.6)))
p.add(sphere(1, (0, 0, 0), (8, 5, 1.2), 12, 6), "room_trim", 0, T((CX + 1, CY + 1, TABLE + 11.6)))   # pale patch

# wastebasket and a stack of offcuts on the floor
p.add(lathe([(11, 0), (15, 34), (14.2, 34), (10.4, 1), (0, 1)], 20), "room_metal", 0, T((150, -10, FLOOR)))
for k in range(4):
    p.add(box(60 - k * 6, 9, 3, (0, 0, 1.5 + k * 3.1)), "birch", 0.4, T((-170, -40, FLOOR)) @ RZ(0.2 + k * 0.07))

# ---- lived-in: calendar, clock, more books, tea, a candle, a photo, a hanging plant ----------
ns["COLORS"].update({"room_wax": (0.85, 0.78, 0.62), "room_tea": (0.3, 0.12, 0.03), "room_brass": (0.6, 0.4, 0.12)})
# wall calendar
KX, KZ = -160, 96
p.add(box(24, 1.2, 32, (KX, WY - 2.8, KZ)), "room_paper", 0.3)
p.add(box(24, 1.4, 8, (KX, WY - 2.9, KZ + 12)), "room_b1", 0.2)
for ix in range(7):
    for iz in range(5):
        p.add(box(1.6, 1.5, 1.6, (KX - 9 + ix * 3, WY - 2.9, KZ + 4 - iz * 3.6)), "room_metal" if (ix + iz * 7) != 17 else "room_b1", 0)
for ix in range(8):
    p.add(torus(0.9, 0.2, 0, 8, 4), "room_steel", 0, T((KX - 10.5 + ix * 3, WY - 3.2, KZ + 16)) @ RY(math.pi / 2))
p.add(cyl(0.5, 0.5, 2.4, 0, 6), "room_steel", 0, T((KX, WY - 2.4, KZ + 19)) @ RX(math.pi / 2))
# wall clock
QX, QZ = 176, 150
p.add(cyl(15, 15, 2.4, 0, 40), "room_wood", 0.5, T((QX, WY - 2, QZ)) @ RX(math.pi / 2))
p.add(cyl(13, 13, 0.4, 0, 40), "room_paper", 0, T((QX, WY - 4.5, QZ)) @ RX(math.pi / 2))
for k_ in range(12):
    a_ = k_ * math.pi / 6
    p.add(box(0.6, 0.5, 2.2 if k_ % 3 else 3.4, (QX + 11 * math.sin(a_), WY - 5, QZ + 11 * math.cos(a_))), "room_metal", 0)
p.add(box(0.9, 0.5, 8, (0, 0, 4)), "room_metal", 0, T((QX, WY - 5.2, QZ)) @ RY(math.radians(-58)))
p.add(box(0.6, 0.5, 11, (0, 0, 5.5)), "room_metal", 0, T((QX, WY - 5.4, QZ)) @ RY(math.radians(72)))
p.add(sphere(0.9, (QX, WY - 5.6, QZ), u=8, v=6), "room_brass", 0)
# a row of books at the back of the desk, held by brass bookends
bx = 4
for k_, (w_, h_, col) in enumerate([(4.5, 26, "room_b2"), (3.6, 23, "room_b5"), (5.2, 28, "room_b1"), (3.8, 24, "room_b4"), (4.4, 26, "room_b3"), (3.4, 21, "room_b2"), (4.8, 25, "room_b5")]):
    lean = 0.0 if k_ < 6 else -0.2
    M_ = T((bx + w_ / 2, 46, TABLE)) @ RY(lean)
    p.add(box(w_, 17, h_, (0, 0, h_ / 2)), col, 0.25, M_)
    p.add(box(w_ - 0.9, 16.4, h_ - 0.8, (0, -0.5, h_ / 2)), "room_paper", 0, M_)
    bx += w_ + 0.4
for ex in (2.6, bx + 3.6):
    p.add(box(1.0, 12, 16, (ex, 46, TABLE + 8)), "room_brass", 0.2)
    p.add(box(8, 12, 1.0, (ex + (4 if ex > 10 else -4), 46, TABLE + 0.5)), "room_brass", 0.2)
# an open book, face up
Mo = T((92, -34, TABLE)) @ RZ(-0.35)
p.add(box(34, 24, 0.8, (0, 0, 0.4)), "room_b4", 0.2, Mo)
for sd in (-1, 1):
    p.add(box(15.6, 22, 1.6, (0, 0, 0.8)), "room_paper", 0.3, Mo @ T((sd * 8.2, 0, 0.9)) @ RY(-sd * 0.07))
    for ln in range(7):
        p.add(box(11.5, 0.5, 0.05, (sd * 8.2, 7.5 - ln * 2.4, 2.72)), "room_metal", 0, Mo)
# tea
p.add(cyl(6.2, 5.0, 0.8, TABLE, 24), "room_trim", 0.25, T((66, 2, 0)))
p.add(lathe([(2.4, 0.8), (3.9, 3.4), (4.2, 5.6), (3.9, 5.6), (3.6, 3.5), (2.0, 1.3), (0, 1.3)], 20), "room_trim", 0, T((66, 2, TABLE)))
p.add(cyl(3.7, 3.7, 0.2, TABLE + 4.9, 16), "room_tea", 0, T((66, 2, 0)))
p.add(torus(1.7, 0.45, 0, 12, 5), "room_trim", 0, T((70.6, 2, TABLE + 3.6)) @ RX(math.pi / 2))
# a candle in a glass
p.add(cyl(4.2, 3.8, 8, TABLE, 16), "room_sky", 0.4, T((-34, 26, 0)))
p.add(cyl(3.5, 3.5, 5, TABLE + 0.6, 16), "room_wax", 0, T((-34, 26, 0)))
p.add(sphere(0.9, (-34, 26, TABLE + 7.3), (0.75, 0.75, 1.7), 8, 6), "room_bulb", 0)
# a small framed photo, leaning back
Mf = T((-44, 46, TABLE)) @ RZ(0.3) @ RX(math.radians(-14))
p.add(box(15, 1.4, 19, (0, 0, 9.5)), "room_wood", 0.4, Mf)
p.add(box(11.5, 1.6, 15.5, (0, -0.2, 9.5)), "room_paper", 0, Mf)
p.add(box(8.5, 1.7, 9, (0, -0.25, 10.5)), "room_b2", 0, Mf)
p.add(box(1.2, 9, 1.2, (0, 5, 4)), "room_wood", 0, Mf)
# washi tapes
for k_, col in enumerate(["room_b3", "room_b1", "room_green"]):
    p.add(torus(2.4, 1.0, 0, 16, 6), col, 0, T((14, -30, TABLE + 1.0 + k_ * 1.9)))
# a plant hanging by the window
HX, HZ = -6, WZ1 - 22
for a_ in (0.0, 2.1, 4.2):
    p.add(cyl(0.2, 0.2, 34, 0, 4), "room_curtain", 0, T((HX + 6 * math.cos(a_), WY - 16 + 6 * math.sin(a_), HZ)) @ RY(-0.17 * math.cos(a_)) @ RX(0.17 * math.sin(a_)))
p.add(lathe([(0, 0), (5, 0), (7.5, 6), (7, 8), (0, 8)], 16), "room_terra", 0, T((HX, WY - 16, HZ - 6)))
for k_ in range(14):
    a_ = k_ * 2.4
    rr, dz = 5 + (k_ % 3) * 2.2, -2 - (k_ % 5) * 6.5
    p.add(sphere(1, (0, 0, 0), (2.8, 1.0, 3.6), 8, 5), "room_green", 0, T((HX + rr * math.cos(a_), WY - 16 + rr * math.sin(a_), HZ + 2 + dz)) @ RZ(a_))

ob = p.finish(0)

for name, strength in [("room_sky", 0.5), ("room_bulb", 14.0), ("room_shade", 0.5), ("room_moon", 5.0), ("room_fairy", 9.0)]:
    if name not in bpy.data.materials:
        continue
    m = bpy.data.materials[name]
    bsdf = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    c = ns["COLORS"][name]
    bsdf.inputs["Emission Color"].default_value = (c[0], c[1], c[2], 1)
    bsdf.inputs["Emission Strength"].default_value = strength

RESULT = (tuple(round(v, 1) for v in ob.dimensions), len(ob.data.polygons), [m.name for m in ob.data.materials])


def export(path):
    """Headless only (exporting from a second scene in a live session crashes Blender 5.3):
         /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --python tools/build_room.py"""
    if not bpy.app.background:
        raise RuntimeError("export the room headless: run tools/build_room.py with Blender -b")
    for o in bpy.data.objects:
        o.select_set(o is ob)
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=True, export_apply=True, export_yup=True)
