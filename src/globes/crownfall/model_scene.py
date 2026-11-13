"""Author Crownfall's scenery in Blender and export its local game meshes."""
import json
import math
from collections import defaultdict
from pathlib import Path

import bpy
from mathutils import Vector

PALETTE = {
    'rock': (0x9a, 0x93, 0x8b), 'grass': (0x8f, 0xae, 0x6c),
    'treeA': (0x3f, 0x84, 0x75), 'paintNavy': (0x2b, 0x3c, 0x5a),
    'paintBlue': (0x3f, 0x7f, 0xa3), 'seaLight': (0x79, 0xb3, 0xcc),
    'paper': (0xf7, 0xf3, 0xea), 'paintCream': (0xf2, 0xe8, 0xd3),
    'woodDark': (0x6f, 0x4a, 0x31), 'ply': (0xd7, 0xb5, 0x82),
    'brass': (0xd0, 0xa8, 0x5c), 'paintRed': (0xd2, 0x48, 0x3b),
    'paintYellow': (0xf0, 0xb5, 0x3c), 'coral': (0xea, 0x74, 0x60),
    'sea': (0x2f, 0x6e, 0x96), 'abyss': (0x0a, 0x16, 0x30),
    'crystal': (0x86, 0xde, 0xd6), 'lamp': (0xff, 0xe6, 0xb0),
    'jelly': (0xe8, 0x87, 0xae), 'jellyB': (0x9e, 0xe1, 0xda),
}
ASSET_DIR = Path(__file__).resolve().parent
TAU = math.tau

def srgb_to_linear(channel):
    value = channel / 255
    return value / 12.92 if value < 0.04045 else ((value + 0.055) / 1.055) ** 2.4

def xyz(point):
    x, y, z = point
    return (x, -z, y)

def create_collection():
    old = bpy.data.collections.get('Plexulisa Crownfall')
    if old:
        for obj in list(old.all_objects):
            if not obj.name.startswith('Crownfall Castle'):
                bpy.data.objects.remove(obj, do_unlink=True)
        return old
    collection = bpy.data.collections.new('Plexulisa Crownfall')
    bpy.context.scene.collection.children.link(collection)
    return collection

def material(name):
    key = 'Crownfall / ' + name
    existing = bpy.data.materials.get(key)
    if existing:
        return existing
    result = bpy.data.materials.new(key)
    result.diffuse_color = (*[srgb_to_linear(c) for c in PALETTE[name]], 1)
    result.use_nodes = True
    surface = next(node for node in result.node_tree.nodes if node.type == 'BSDF_PRINCIPLED')
    surface.inputs['Base Color'].default_value = result.diffuse_color
    if name in {'lamp', 'jelly', 'jellyB', 'crystal'}:
        surface.inputs['Emission Color'].default_value = result.diffuse_color
        surface.inputs['Emission Strength'].default_value = 1.4 if name == 'lamp' else 0.27
    return result

def make_mesh(collection, name, vertices, faces, colors):
    mesh = bpy.data.meshes.new('Crownfall / ' + name)
    mesh.from_pydata([xyz(p) for p in vertices], [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    collection.objects.link(obj)
    slots = list(dict.fromkeys(colors))
    for name in slots:
        mesh.materials.append(material(name))
    for polygon, color in zip(mesh.polygons, colors):
        polygon.material_index = slots.index(color)
    return obj

def strata(collection, name, center, scale, rings, colors, seed, count=21, notch=None):
    """Sculpt angular, alternating strata with correlated ridges around the whole model."""
    vertices, faces, materials = [], [], []
    cx, cy, cz = center
    sx, sy, sz = scale
    for ring, (height, radius, offset_x, offset_z) in enumerate(rings):
        for index in range(count):
            angle = TAU * index / count
            ridge = 1 + 0.17 * math.sin(3 * angle + seed) + 0.11 * math.cos(7 * angle - seed)
            ripple = 0.055 * math.sin(5 * angle + ring * 0.72 + seed)
            cut = 0 if notch is None or ring not in (5, 6) else 0.33 * math.exp(17 * (math.cos(angle - notch) - 1))
            vertices.append((cx + sx * (math.cos(angle) * radius * ridge + offset_x),
                             cy + sy * (height - cut + ripple * (0.7 + radius)),
                             cz + sz * (math.sin(angle) * radius * ridge + offset_z)))
    for ring, band in enumerate(colors):
        for index in range(count):
            a = ring * count + index
            b = ring * count + (index + 1) % count
            angle = TAU * (index + 0.5) / count
            seam = math.cos(2 * angle + seed) + 0.32 * math.sin(5 * angle - 0.72 * ring)
            faces.extend(((a, a + count, b), (b, a + count, b + count)))
            materials.extend([band[1] if seam > 0.87 else band[0]] * 2)
    faces.append(tuple(range(count)))
    materials.append(colors[0][0])
    faces.append(tuple(reversed(range(len(vertices) - count, len(vertices)))))
    materials.append(colors[-1][0])
    return make_mesh(collection, name, vertices, faces, materials)

RIDGE = [
    (-1.0, 0.33, -0.19, 0.13), (-0.71, 0.72, -0.12, 0.03),
    (-0.32, 0.96, 0.01, 0.02), (0.00, 1.0, 0.02, 0.0),
    (0.23, 0.76, -0.09, -0.06), (0.58, 0.52, -0.15, -0.1),
    (0.92, 0.29, -0.21, -0.09), (1.12, 0.025, -0.25, -0.12),
]
ROCK = ('rock', 'woodDark')
SHALE = ('rock', 'paintNavy')
TURF = ('grass', 'treeA')
SNOW = ('paintCream', 'paper')
ICE = ('seaLight', 'paintBlue')

def build_continent(collection):
    # Three ribs join below the river cut. The visible cliffs stay clear of the
    # ravine so daylight can reach the river and the roots have a clear silhouette.
    shelf = [
        (-1.0, 0.17, 0.12, -0.1), (-0.78, 0.48, 0.08, -0.08),
        (-0.40, 0.78, 0.04, -0.04), (-0.12, 0.93, 0.01, 0),
        (0.16, 1.00, 0, 0), (0.47, 0.83, -0.05, 0.02),
        (0.62, 0.62, -0.08, 0.03), (0.66, 0.48, -0.08, 0.03),
    ]
    strata(collection, 'west-ravine-spine', (-5.38, -4.12, 0.22), (1.82, 2.67, 3.27), shelf,
           [SHALE, SHALE, ROCK, ROCK, ('woodDark', 'rock'), TURF, TURF], 4.5, 32)
    strata(collection, 'castle-waterfall-lip', (-3.74, -3.30, 3.79), (1.12, 1.85, 1.23), shelf,
           [SHALE, ROCK, ROCK, ('rock', 'ply'), ('grass', 'treeA'), TURF, TURF], 1.1, 20)
    strata(collection, 'western-scree', (-4.14, -6.12, -1.92), (1.38, 1.33, 1.56), shelf,
           [SHALE, ROCK, ('woodDark', 'rock'), ROCK, ROCK, TURF, TURF], 0.4, 20)
    strata(collection, 'river-delta', (0.12, -8.74, -1.47), (2.85, 0.79, 2.08), shelf,
           [SHALE, SHALE, ROCK, ROCK, ('rock', 'seaLight'), TURF, ('treeA', 'grass')], 2.9, 27)
    strata(collection, 'glacier-tongue', (2.72, -4.51, -4.86), (1.56, 1.76, 0.88), shelf,
           [SHALE, ROCK, SHALE, ICE, ICE, ('seaLight', 'paper'), SNOW], 5.6, 24)
    strata(collection, 'moraine-root', (2.77, -6.61, -3.74), (1.11, 1.72, 0.94), shelf,
           [SHALE, ROCK, ROCK, SHALE, ICE, ICE, ('seaLight', 'paper')], 4.82, 19)
    strata(collection, 'delta-stone-spur', (2.20, -8.35, -2.49), (1.65, 0.88, 1.18), shelf,
           [SHALE, SHALE, ROCK, ROCK, ('rock', 'seaLight'), TURF, TURF], 5.55, 21)
    strata(collection, 'caldera-foreland', (4.48, -7.43, 2.35), (1.59, 1.24, 1.61), shelf,
           [SHALE, ('paintNavy', 'woodDark'), SHALE, ROCK, SHALE, ROCK, SHALE], 3.45, 25)
    strata(collection, 'caldera-roots', (5.48, -5.08, 3.77), (2.11, 1.66, 1.83), shelf,
           [('abyss', 'paintNavy'), SHALE, SHALE, ROCK, ('paintNavy', 'woodDark'), SHALE, SHALE], 2.2, 25)
    for index, (x, y, z, width, height) in enumerate([
        (-6.25, -5.55, 1.72, 0.64, 1.26), (-5.90, -5.98, 0.54, 0.50, 1.18),
        (-4.71, -5.72, 2.62, 0.48, 0.83), (-4.78, -4.18, -3.70, 0.44, 1.02),
        (5.07, -5.85, 4.05, 0.46, 1.10), (6.28, -5.64, 3.83, 0.52, 0.94),
    ]):
        strata(collection, f'broken-rock-root-{index}', (x, y, z), (width, -height, -width), RIDGE,
               [SHALE, ROCK, ROCK, SHALE, SHALE, SHALE, SHALE], index * 0.76, 10)


def build_surface(collection):
    build_continent(collection)
    # Bases taper into visible rock roots so the underside reads from the opposite side.
    strata(collection, 'castle-ridge', (-5.45, -2.75, 3.26), (2.18, 1.85, 1.82), [
        (-1, 0.18, 0.25, -0.25), (-0.63, 0.6, 0.15, -0.16),
        (-0.25, 1.04, 0.02, -0.02), (0.12, 1.0, 0.0, 0.0),
        (0.46, 0.8, -0.05, 0.04), (0.65, 0.75, 0.0, 0.08),
        (0.68, 0.68, 0.0, 0.08),
    ], [ROCK, SHALE, ROCK, ('rock', 'grass'), TURF, TURF], 0.8)
    for name, center, scale, seed in [
        ('western-peak', (-5.34, -2.60, -4.55), (1.68, 3.30, 1.77), 2.1),
        ('needle-ridge', (-5.98, -2.81, -4.94), (0.93, 3.66, 0.97), 3.6),
        ('foothills', (-4.79, -4.57, -3.22), (1.56, 1.76, 1.28), 5.8),
    ]:
        strata(collection, name, center, scale, RIDGE, [ROCK, ROCK, TURF, ROCK, SHALE, SNOW, SNOW], seed)

    strata(collection, 'glacier-bedrock', (5.0, -2.55, -4.95), (2.00, 2.14, 1.74), RIDGE,
           [ROCK, SHALE, SHALE, ICE, ICE, SNOW, SNOW], 4.7)
    for index, (x, y, z, size) in enumerate([
        (4.53, -1.42, -4.74, 0.96), (4.75, -0.73, -5.40, 0.80), (5.57, -0.18, -5.24, 0.74),
        (5.91, 0.05, -4.66, 0.65), (3.87, -2.02, -4.23, 0.65), (5.73, -1.20, -3.77, 0.72),
    ]):
        strata(collection, f'glacier-serac-{index}', (x, y, z), (size, size * 1.75, size * 0.75), [
            (-0.64, 0.69, 0, 0), (-0.22, 0.86, 0, 0),
            (0.55, 0.62, 0.14, 0.12), (0.85, 0.49, 0.17, 0.10),
            (1.0, 0.16, 0.14, 0.08),
        ], [ICE, ICE, ('seaLight', 'paper'), SNOW], index * 0.54, 9)

    strata(collection, 'volcano', (5.58, -3.8, 4.07), (2.07, 3.16, 1.75), [
        (-0.93, 0.36, 0, 0), (-0.61, 0.8, 0, 0), (-0.2, 1.05, 0, 0),
        (0.13, 0.9, 0.04, 0.02), (0.57, 0.66, 0.10, 0.08),
        (1.02, 0.46, 0.17, 0.06), (1.09, 0.32, 0.18, 0.08),
        (0.87, 0.20, 0.18, 0.08), (0.83, 0.08, 0.18, 0.08),
    ], [SHALE, SHALE, ('woodDark', 'rock'), SHALE, ('abyss', 'woodDark'),
        ('abyss', 'rock'), ('coral', 'paintRed'), ('lamp', 'coral')], 1.65, 32, notch=2.32)
    for index, (x, y, z, width, height) in enumerate([
        (4.34, -4.70, 4.88, 0.76, 1.24), (6.63, -4.04, 3.53, 0.85, 1.42),
        (5.32, -5.00, 5.77, 0.86, 1.10),
    ]):
        strata(collection, f'basalt-scree-{index}', (x, y, z), (width, height, width), RIDGE,
               [SHALE, SHALE, ROCK, ROCK, SHALE, SHALE, ('abyss', 'rock')], 2 + index, 11)

def water_ribbon(collection, name, points, widths, color):
    knots = [Vector(point) for point in points]
    vertices, faces = [], []
    for segment in range(len(knots) - 1):
        a, b = knots[segment:segment + 2]
        tangent_a = (b - knots[max(0, segment - 1)]) * 0.5
        tangent_b = (knots[min(len(knots) - 1, segment + 2)] - a) * 0.5
        for step in range(10 + (segment == len(knots) - 2)):
            t = step / 10
            t2, t3 = t * t, t * t * t
            position = ((2*t3 - 3*t2 + 1) * a + (t3 - 2*t2 + t) * tangent_a
                        + (-2*t3 + 3*t2) * b + (t3 - t2) * tangent_b)
            flow = ((6*t2 - 6*t) * (a - b) + (3*t2 - 4*t + 1) * tangent_a + (3*t2 - 2*t) * tangent_b)
            side = Vector((flow.z, 0, -flow.x)).normalized()
            side *= ((1 - t) * widths[segment] + t * widths[segment + 1]) * 0.5
            vertices.extend((position - side, position + side))
    for index in range(0, len(vertices) - 2, 2):
        faces.extend(((index, index + 2, index + 1), (index + 1, index + 2, index + 3)))
    return make_mesh(collection, name, vertices, faces, [color] * len(faces))

def build_hydrology(collection):
    river = [
        (-4.85, -4.00, -4.00), (-4.12, -4.34, -3.63), (-4.82, -4.95, -2.64),
        (-4.30, -6.18, -1.99), (-3.17, -7.76, -1.86), (-1.40, -8.03, -1.40),
        (0.14, -8.10, -1.87), (1.60, -8.08, -1.28), (3.45, -7.95, -0.68),
    ]
    river_widths = [0.32, 0.56, 0.58, 0.77, 1.35, 2.1, 2.4, 1.78, 0.16]
    water_ribbon(collection, 'water-riverbed', [(x, y - 0.11, z) for x,y,z in river],
                 [width + 0.34 for width in river_widths], 'rock')
    water_ribbon(collection, 'water-silver-river', river, river_widths, 'sea')
    waterfall = [
        (-3.05, -2.38, 4.41), (-2.87, -2.68, 4.20), (-2.75, -3.49, 4.02),
        (-2.72, -4.68, 3.81), (-2.62, -6.17, 3.47), (-2.37, -7.58, 2.90),
        (-1.76, -8.05, 2.13), (-0.99, -8.05, 0.46), (0.02, -8.07, -1.20),
    ]
    falls_widths = [0.29, 0.58, 0.66, 0.54, 0.42, 0.52, 1.35, 0.92, 1.20]
    water_ribbon(collection, 'water-curtain', waterfall, falls_widths, 'seaLight')
    for offset, color in [(-0.09, 'paper'), (0.11, 'seaLight')]:
        water_ribbon(collection, 'water-falling-foam', [(x + offset, y + 0.025, z + 0.02) for x,y,z in waterfall],
                     [width * 0.26 for width in falls_widths], color)
    for offset in [-0.12, 0.15]:
        water_ribbon(collection, 'water-current', [(x + offset, y + 0.04, z + 0.03) for x,y,z in river[1:]],
                     [0.02, 0.08, 0.15, 0.13, 0.12, 0.07, 0.035, 0.01], 'seaLight')
    lava = [
        (5.82, -1.03, 4.31), (5.42, -1.00, 4.56), (5.09, -1.53, 4.94),
        (4.85, -2.32, 5.11), (4.65, -3.17, 5.34), (4.50, -3.98, 5.64),
    ]
    water_ribbon(collection, 'water-lava-channel', lava, [0.19, 0.25, 0.32, 0.39, 0.30, 0.07], 'coral')
    water_ribbon(collection, 'water-lava-heart', [(x + 0.025, y + 0.04, z + 0.02) for x,y,z in lava],
                 [0.035, 0.11, 0.12, 0.18, 0.10, 0.012], 'lamp')
    branch = [(4.85, -2.34, 5.14), (5.10, -2.72, 5.43), (5.02, -3.31, 5.73), (5.29, -4.29, 5.91)]
    water_ribbon(collection, 'water-lava-branch', branch, [0.12, 0.16, 0.24, 0.03], 'paintRed')

def masonry(collection, name, center, size, angle, color):
    x, y, z = center
    w, h, d = size
    chamfer = min(w, d) * 0.18
    outline = [(-w/2 + chamfer, -d/2), (w/2 - chamfer, -d/2), (w/2, -d/2 + chamfer),
               (w/2, d/2 - chamfer), (w/2 - chamfer, d/2), (-w/2 + chamfer, d/2),
               (-w/2, d/2 - chamfer), (-w/2, -d/2 + chamfer)]
    vertices = [(x + px * math.cos(angle) - pz * math.sin(angle), y + level,
                 z + px * math.sin(angle) + pz * math.cos(angle))
                for level in (-h/2, h/2) for px,pz in outline]
    faces = [(i, i+8, (i+1)%8+8, (i+1)%8) for i in range(8)]
    faces.extend((tuple(range(8)), tuple(reversed(range(8,16)))))
    return make_mesh(collection, name, vertices, faces, [color] * len(faces))

def build_watergate(collection):
    def terrace(name, center, scale, seed, trim):
        profile = [
            (-1.0, 0.39, 0.1, -0.25), (-0.64, 0.78, 0.05, -0.16), (-0.24, 0.95, 0, 0),
            (0.22, 1.0, 0, 0.03), (0.66, 0.91, 0, 0.08), (0.76, 0.78, 0, 0.09),
        ]
        return strata(collection, name, center, scale, profile, [SHALE, ROCK, ROCK, trim, trim], seed, 21)

    terrace('watergate-retaining-rock', (-5.27, -2.40, 5.33), (1.20, 0.83, 1.0), 1.35, ('rock', 'grass'))
    terrace('moraine-shelf', (5.0, -2.41, -7.16), (1.30, 1.25, 1.00), 5.54, ICE)
    terrace('scoria-balcony', (7.28, -2.48, 5.0), (1.17, 0.91, 1.02), 0.67, SHALE)
    # One crooked retaining wall runs around the shoulder of the castle.
    for row in range(3):
        for column in range(8):
            t = column / 7
            x = -6.74 + 2.36 * t + (row % 2) * 0.08
            z = 4.63 + 0.22 * math.sin(t * math.pi) - 0.18 * t
            y = -1.71 + row * 0.145 + 0.09 * math.sin(t * 6.0)
            masonry(collection, f'watergate-stone-{row}-{column}', (x, y, z), (0.326, 0.158, 0.28),
                    (0.30 - 0.48 * t), 'paintCream' if (column + row * 3) % 5 == 0 else 'rock')
    for i in [0, 2, 5, 7]:
        t = i / 7
        masonry(collection, f'watergate-battlement-{i}',
                (-6.73 + 2.36 * t, -1.25 + 0.09 * math.sin(t * 6.0),
                 4.63 + 0.22 * math.sin(t * math.pi) - 0.18 * t), (0.185, 0.25, 0.30),
                0.30 - 0.48 * t, 'rock')

def build_forest(collection):
    placements = [
        ('west-ravine-spine', -6.07, 0.64, 0.75), ('west-ravine-spine', -5.78, -0.22, 0.58),
        ('west-ravine-spine', -6.19, 1.41, 0.49), ('west-ravine-spine', -4.79, -0.42, 0.93),
        ('west-ravine-spine', -4.76, -1.08, 0.58), ('west-ravine-spine', -5.13, -1.56, 0.43),
        ('castle-waterfall-lip', -3.57, 4.36, 0.56), ('castle-waterfall-lip', -3.83, 4.41, 0.40),
        ('western-peak', -5.93, -4.04, 0.55), ('foothills', -4.92, -3.27, 0.52),
    ]
    for index, (object_name, x, z, size) in enumerate(placements):
        surface = collection.objects[object_name]
        hit, point, _, _ = surface.ray_cast(Vector((x, -z, 5)), Vector((0, 0, -1)))
        if not hit:
            continue
        base = point.z
        strata(collection, f'fir-trunk-{index}', (x, base + size * 0.25, z), (0.07, size * 0.42, 0.07),
               [(-1, 0.80, 0, 0), (0.0, 1, 0.10, 0), (1, 0.46, 0.24, 0.16)],
               [('woodDark', 'rock')] * 2, index, 7)
        for bough, (height, width, depth) in enumerate([(0.34, 0.29, 0.47), (0.55, 0.23, 0.41), (0.76, 0.17, 0.33)]):
            strata(collection, f'fir-{index}-{bough}', (x + 0.08 * height, base + size * height, z),
                   (width * size, depth * size, width * size),
                   [(-0.39, 0.51, 0, 0), (-0.20, 1.07, -0.16, -0.06), (0.11, 0.68, 0.12, 0),
                    (0.70, 0.09, 0.54, 0.14)],
                   [('treeA', 'woodDark'), ('treeA', 'grass'), ('treeA', 'grass')], index * 0.75, 9)

def build_mine(collection):
    # The black roof reads as a single ore body from outside. Its split underneath
    # is large enough to read as a valley when the camera enters upside down.
    roof = [
        (-0.74, 0.48, -0.18, -0.06), (-0.45, 0.82, -0.09, 0.02),
        (-0.19, 0.96, -0.02, 0.04), (0.14, 1.0, 0.02, 0.02),
        (0.43, 0.85, 0.0, -0.03), (0.73, 0.53, 0.09, -0.04),
        (0.88, 0.21, 0.20, -0.05),
    ]
    strata(collection, 'ore-vault-roof', (-0.72, 9.02, -1.86), (3.45, 1.37, 3.43), roof,
           [('paintNavy', 'abyss'), ('paintNavy', 'rock'), ('rock', 'paintNavy'),
            ('paintNavy', 'abyss'), ('paintNavy', 'rock'), ('paintNavy', 'abyss')], 4.24, 33)
    strata(collection, 'ore-vault-spur', (-3.46, 8.45, -1.63), (1.83, 1.4, 1.73), roof,
           [('paintNavy', 'abyss'), ('paintNavy', 'rock'), ('rock', 'paintNavy'),
            ('paintNavy', 'abyss'), ('paintNavy', 'rock'), ('paintNavy', 'abyss')], 0.8, 21)
    # The folded seam ties the vault to the snowy backside of the western range.
    strata(collection, 'folded-seam-upper', (-3.63, 5.73, -2.82), (1.34, 2.43, 1.61), RIDGE,
           [SHALE, SHALE, ('paintNavy', 'rock'), ROCK, SHALE, SHALE, SHALE], 3.9, 25)
    strata(collection, 'folded-seam-lower', (-4.60, 2.76, -3.79), (1.0, 2.33, 1.08), RIDGE,
           [SHALE, ROCK, ROCK, SHALE, ('paintNavy', 'rock'), SHALE, SHALE], 5.3, 23)
    # Separate pillars leave an open seam through the vault.

    for index, (x, y, z, width, depth, height) in enumerate([
        (-3.4, 7.9, -2.85, 1.52, 1.68, 1.86), (-4.45, 7.15, -3.80, 0.94, 1.03, 1.62),
        (-2.55, 7.48, -4.86, 0.95, 1.10, 1.43), (2.61, 8.0, -3.21, 1.33, 1.51, 1.82),
        (3.9, 7.35, -4.10, 1.05, 1.18, 1.54), (3.48, 8.4, 2.10, 1.15, 1.07, 1.16),
        (-3.18, 8.25, 2.39, 1.45, 1.32, 1.51), (-4.35, 7.41, 2.62, 1.03, 1.07, 1.31),
    ]):
        strata(collection, f'mine-vault-{index}', (x, y, z), (width, -height, -depth), RIDGE,
               [('paintNavy', 'abyss'), ('paintNavy', 'rock'), ('paintNavy', 'abyss'),
                ('rock', 'paintNavy'), ('paintNavy', 'abyss'), ('paintNavy', 'rock'), ('paintNavy', 'rock')], index * 0.71, 14)
    for index, (x, y, z, size, color) in enumerate([
        (-3.18, 7.08, -2.59, 1.21, 'jelly'), (-3.58, 6.98, -3.26, 0.78, 'jellyB'),
        (-2.61, 7.36, -2.33, 0.64, 'jelly'), (1.79, 7.53, -2.55, 1.04, 'jellyB'),
        (2.31, 7.69, -3.14, 0.66, 'jellyB'), (-2.24, 7.66, -4.27, 0.82, 'jelly'),
        (2.86, 7.84, 2.61, 0.88, 'jellyB'), (-2.77, 7.52, 2.55, 0.79, 'jelly'),
    ]):
        stem = [(-0.10, 0.81, 0, 0), (0.13, 0.62, -0.12, 0.11),
                (0.43, 0.53, 0.09, 0.15), (0.75, 0.71, 0.47, 0.11)]
        strata(collection, f'ore-fungus-stem-{index}', (x, y, z), (size * 0.15, -size, -size * 0.15), stem,
               [('rock', 'paintCream'), ('paintCream', 'rock'), ('paintCream', 'rock')], index * 0.42, 10)
        cap = [(0.57, 0.24, 0.16, 0), (0.62, 0.69, 0.11, 0),
               (0.74, 1.0, 0.06, 0.06), (0.93, 0.79, 0.01, 0.10),
               (1.08, 0.49, -0.07, 0.15), (1.13, 0.07, -0.11, 0.13)]
        strata(collection, f'ore-fungus-cap-{index}', (x + size * 0.08, y, z),
               (size * 0.48, -size, -size * 0.41), cap,
               [('paintCream', 'rock'), ('paintCream', color), (color, 'paintCream'),
                (color, 'paintNavy'), (color, 'paintCream')], index * 0.68, 17)
    # The game places these two hand-shaped profiles in a track frame.
    for side in (-1, 1):
        for index in range(3):
            strata(collection, f'portal-{side}-{index}', (side * (0.94 - index * 0.105), 0.20 + index * 0.40, 0),
                   (0.27, 0.27, 0.44), RIDGE, [SHALE, ROCK, ROCK, SHALE, ROCK, ROCK, SHALE],
                   1.25 + index + side, 8)
    strata(collection, 'portal-keystone', (0.0, 1.55, 0.0), (0.88, 0.39, 0.48), RIDGE,
           [SHALE, ROCK, ROCK, SHALE, ROCK, ROCK, SHALE], 2.7, 10)

def serialize(objects):
    groups = defaultdict(lambda: {'p': [], 'i': []})
    for obj in objects:
        if obj.type != 'MESH':
            continue
        mesh = obj.data
        mesh.calc_loop_triangles()
        for triangle in mesh.loop_triangles:
            mat = mesh.materials[triangle.material_index].name.split(' / ', 1)[-1]
            group = groups[mat]
            cache = group.setdefault('_lookup', {})
            for vertex_index in triangle.vertices:
                point = obj.matrix_world @ mesh.vertices[vertex_index].co
                key = (round(point.x, 4), round(point.z, 4), round(-point.y, 4))
                if key not in cache:
                    cache[key] = len(group['p']) // 3
                    group['p'].extend(key)
                group['i'].append(cache[key])
    for group in groups.values():
        del group['_lookup']
    return groups

def export_scenery(directory=ASSET_DIR):
    collection = create_collection()
    build_surface(collection)
    build_mine(collection)
    build_hydrology(collection)
    build_forest(collection)
    build_watergate(collection)
    bpy.context.view_layer.update()
    portal = [obj for obj in collection.objects if obj.name.startswith('portal-')]
    water = [obj for obj in collection.objects if obj.name.startswith('water-') and obj.name != 'water-riverbed']
    landscape = [obj for obj in collection.objects
                 if obj not in portal and obj not in water and not obj.name.startswith('Crownfall Castle')]
    data = {'landscape': serialize(landscape), 'portal': serialize(portal), 'water': serialize(water)}
    (directory / 'terrain.json').write_text(json.dumps(data, separators=(',', ':')))
    # The portal profiles are local to an arbitrary track frame.
    for obj in portal:
        obj.hide_set(True)
        obj.hide_render = True
    return collection

if __name__ == '__main__':
    export_scenery()
