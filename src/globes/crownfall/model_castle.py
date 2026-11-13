"""Convert the textured Meshy castle into the game's shared hand-painted palette."""
from array import array
import colorsys
import json
import os
import runpy
from pathlib import Path

import bpy
from mathutils import Matrix, Vector

ASSET_DIR = Path(__file__).resolve().parent
scene_tools = runpy.run_path(str(ASSET_DIR / 'model_scene.py'))
material = scene_tools['material']
serialize = scene_tools['serialize']

def sample(image, pixels, uv):
    width, height = image.size[:]
    x = int((uv.x % 1) * width)
    y = int((uv.y % 1) * height)
    offset = (y * width + x) * image.channels
    return pixels[offset:offset + 3]

def shade(rgb, elevation):
    r, g, b = rgb
    hue, saturation, value = colorsys.rgb_to_hsv(r, g, b)
    if 0.43 < hue < 0.72 and saturation > 0.22:
        return 'treeA' if value > 0.16 else 'paintNavy'
    if 0.15 < hue < 0.40 and saturation > 0.30 and elevation < 0.22:
        return 'grass'
    if hue < 0.058 and saturation > 0.65 and value > 0.52:
        return 'paintRed'
    if (hue < 0.15 or hue > 0.96) and saturation > 0.33:
        return 'woodDark' if value < 0.30 else 'ply'
    return 'paintCream' if value > 0.54 else 'rock'

def face_tint(polygon, image, pixels, uv, minimum, height):
    coords = [uv[loop].uv for loop in polygon.loop_indices]
    centre = sum(coords, Vector((0, 0))) / len(coords)
    samples = [sample(image, pixels, centre.lerp(corner, weight))
               for weight in (0.0, 0.36, 0.63) for corner in coords]
    rgb = [sum(color[channel] for color in samples) / len(samples) for channel in range(3)]
    elevation = (polygon.center.z - minimum.z) / height
    return shade(rgb, elevation)

def export_castle(source):
    collection = bpy.data.collections.get('Plexulisa Crownfall')
    if collection is None:
        collection = scene_tools['create_collection']()
    old = bpy.data.objects.get('Crownfall Castle')
    if old:
        bpy.data.objects.remove(old, do_unlink=True)
    original = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(source))
    imported = set(bpy.data.objects) - original
    meshes = [obj for obj in imported if obj.type == 'MESH']
    points = [obj.matrix_world @ Vector(corner) for obj in meshes for corner in obj.bound_box]
    minimum = Vector(tuple(min(p[i] for p in points) for i in range(3)))
    maximum = Vector(tuple(max(p[i] for p in points) for i in range(3)))
    base = (minimum + maximum) * 0.5
    base.z = minimum.z
    scale = min(2.58 / (maximum.z - minimum.z), 3.42 / (maximum.x - minimum.x))
    source_triangles = sum(len(obj.data.polygons) for obj in meshes)

    for obj in meshes:
        original_materials = list(obj.data.materials)
        images = [next((node.image for node in mat.node_tree.nodes
                        if node.type == 'TEX_IMAGE' and node.image), None)
                  if mat and mat.node_tree else None for mat in original_materials]
        pixel_cache = {}
        for image in set(images) - {None}:
            pixels = array('f', [0]) * len(image.pixels)
            image.pixels.foreach_get(pixels)
            pixel_cache[image] = pixels
        # Freeze imported transforms before collapse so UV and footprint stay paired.
        obj.data.transform(obj.matrix_world)
        obj.parent = None
        obj.matrix_world = Matrix.Identity(4)
        bpy.context.view_layer.objects.active = obj
        modifier = obj.modifiers.new('Game mesh', 'DECIMATE')
        modifier.ratio = min(1.0, 9800 / source_triangles)
        bpy.ops.object.modifier_apply(modifier=modifier.name)
        uv = obj.data.uv_layers.active.data
        colors = []
        for polygon in obj.data.polygons:
            image = images[polygon.material_index]
            if image:
                colors.append(face_tint(polygon, image, pixel_cache[image], uv, minimum, maximum.z - minimum.z))
            else:
                colors.append('rock')
        obj.data.materials.clear()
        slots = list(dict.fromkeys(colors))
        for color in slots:
            obj.data.materials.append(material(color))
        for polygon, color in zip(obj.data.polygons, colors):
            polygon.material_index = slots.index(color)
        for vertex in obj.data.vertices:
            vertex.co = (vertex.co - base) * scale
        for parent in list(obj.users_collection):
            parent.objects.unlink(obj)
        collection.objects.link(obj)
        obj.name = 'Crownfall Castle'
        obj.location = (-5.45, -3.57, -1.68)

    for obj in imported - set(meshes):
        bpy.data.objects.remove(obj, do_unlink=True)
    bpy.context.view_layer.update()
    data = serialize(meshes)
    (ASSET_DIR / 'castle.json').write_text(json.dumps(data, separators=(',', ':')))
    print(f"Castle: {source_triangles:,} source faces → {sum(len(group['i']) // 3 for group in data.values()):,} triangles")

if __name__ == '__main__':
    export_castle(Path(os.environ['CROWNFALL_CASTLE_SOURCE']))
