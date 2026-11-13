# Rebuild public/room.glb without opening Blender's window (and without touching an open session):
#   /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --python tools/build_room.py
# blender_room.py borrows the modelling helpers of blender_props.py, so that script is run first
# (in memory only: public/props.glb is NOT re-exported here).
import bpy, os
HERE = os.path.dirname(os.path.abspath(__file__))
ns = {"__name__": "plex_props"}
exec(compile(open(os.path.join(HERE, "blender_props.py")).read(), "blender_props.py", "exec"), ns)
bpy.app.driver_namespace["plex"] = ns
room = {"__name__": "plex_room"}
exec(compile(open(os.path.join(HERE, "blender_room.py")).read(), "blender_room.py", "exec"), room)
out = os.path.join(os.path.dirname(HERE), "public", "room.glb")
room["export"](out)
print("ROOM", room["RESULT"], os.path.getsize(out))
