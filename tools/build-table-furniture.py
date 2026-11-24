"""Build the reusable restaurant furniture and glassware GLB with Blender."""
import math
import pathlib
import bpy
import bmesh
from mathutils import Vector

bpy.ops.wm.read_factory_settings(use_empty=True)

def material(name, color, roughness, metallic=0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*color, 1)
    bsdf.inputs['Roughness'].default_value = roughness
    bsdf.inputs['Metallic'].default_value = metallic
    return m

fabric = material('Oatmeal upholstery', (.39,.285,.198), .88)
seam = material('Upholstery piping', (.235,.151,.092), .91)
wood = material('Dark stained walnut', (.047,.025,.015), .39)
glass = material('Thin crystal', (.97,.99,1), .095)
glass.node_tree.nodes.get('Principled BSDF').inputs['Transmission Weight'].default_value = .98

def root(name):
    obj = bpy.data.objects.new(name,None)
    bpy.context.collection.objects.link(obj)
    return obj

def mesh(name, verts, faces, mat, parent):
    data = bpy.data.meshes.new(name)
    data.from_pydata(verts,[],faces)
    data.update()
    obj = bpy.data.objects.new(name,data)
    bpy.context.collection.objects.link(obj)
    obj.parent = parent
    data.materials.append(mat)
    topology = bmesh.new()
    topology.from_mesh(data)
    bmesh.ops.recalc_face_normals(topology, faces=list(topology.faces))
    topology.to_mesh(data)
    topology.free()
    for p in data.polygons:
        p.use_smooth = True
    return obj

def loft(name, rings, mat, parent, closed=False):
    width = len(rings[0])
    faces = []
    for row in range(len(rings)-1):
        for col in range(width if closed else width-1):
            following = (col+1)%width
            faces.append((row*width+col,row*width+following,(row+1)*width+following,(row+1)*width+col))
    if name == 'Wraparound upholstery':
        edge = range(len(rings)-1)
        faces.append(tuple(row*width for row in reversed(edge)))
        faces.append(tuple(row*width+width-1 for row in edge))
    obj = mesh(name,[pt for ring in rings for pt in ring],faces,mat,parent)
    uv = obj.data.uv_layers.new(name='Fabric UV')
    for polygon in obj.data.polygons:
        cols = [i % width for i in polygon.vertices]
        seam_crossed = closed and min(cols) == 0 and max(cols) == width-1
        for index in polygon.loop_indices:
            row, col = divmod(obj.data.loops[index].vertex_index, width)
            if seam_crossed and col == 0:
                col = width
            uv.data[index].uv = (col / (width if closed else width-1), row / (len(rings)-1))
    return obj

def tube(name, points, radius, mat, parent, close=False):
    data=bpy.data.curves.new(name,'CURVE')
    data.dimensions='3D'
    data.bevel_depth=radius
    data.bevel_resolution=1
    spline=data.splines.new('POLY')
    spline.points.add(len(points)-1)
    for p, xyz in zip(spline.points,points):
        p.co=(*xyz,1)
    spline.use_cyclic_u=close
    obj=bpy.data.objects.new(name,data)
    bpy.context.collection.objects.link(obj)
    obj.parent=parent
    data.materials.append(mat)
    return obj

chair = root('DiningChair')
angles = [math.radians(-116+i*232/72) for i in range(73)]
shell = []
for t, (rx,ry,z) in enumerate([
    (.209,.205,.429),(.232,.224,.451),(.253,.243,.501),(.266,.254,.592),
    (.271,.263,.705),(.269,.265,.774),(.261,.257,.796),(.244,.236,.79),
    (.23,.218,.754),(.223,.205,.644),(.223,.196,.528),(.213,.191,.452)
]):
    ring=[]
    for a in angles:
        drop = .21*(abs(a)/angles[-1])**2.6
        ring.append((rx*math.sin(a),-ry*math.cos(a),z-drop*min(1,t/4,(11-t)/2)))
    shell.append(ring)
loft('Wraparound upholstery',shell+[shell[0]],fabric,chair)
tube('Upper piping',shell[6],.0016,seam,chair)
tube('Low back seam',shell[2][4:-4],.0012,seam,chair)
rings=[]
for radius,z in [(0,.415),(.8,.414),(.96,.422),(1,.439),(.996,.458),(.98,.477),(.91,.485),(.73,.486),(0,.48)]:
    rings.append([(radius*.232*math.sin(a),radius*.225*math.cos(a)+.012,z) for a in [i*math.tau/40 for i in range(40)]])
loft('Seat cushion',rings,fabric,chair,True)
tube('Cushion seam',rings[3],.0022,seam,chair,True)
for x in [-1,1]:
    for y in [-1,1]:
        start=Vector((x*.206,y*.207,.005))
        end=Vector((x*.136,y*.139,.421))
        bpy.ops.mesh.primitive_cone_add(vertices=10,radius1=.013,radius2=.018,depth=(end-start).length,location=(start+end)/2)
        obj=bpy.context.object
        obj.rotation_euler=(end-start).to_track_quat('Z','Y').to_euler()
        obj.parent=chair
        obj.data.materials.append(wood)
        for face in obj.data.polygons:
            face.use_smooth=len(face.vertices)==4

goblet=root('WineGlass')
# Continuous profile, in metres. The inner bowl returns to the axis above the stem.
profile=[(.00001,0),(.031,0),(.038,.0004),(.039,.0017),(.0383,.0032),
         (.035,.0045),(.020,.006),(.009,.0075),(.0042,.010),(.0031,.017),
         (.00245,.041),(.00233,.078),(.0027,.099),(.0039,.108),(.0078,.1115),
         (.016,.116),(.025,.123),(.033,.131),(.0384,.141),(.0405,.151),
         (.041,.163),(.0402,.174),(.038,.187),(.0352,.201),(.0328,.215),
         (.0311,.228),(.0306,.2345),(.0301,.235),(.0297,.2347),(.0296,.2338),
         (.0302,.2278),(.0318,.214),(.0342,.200),(.037,.187),(.0391,.174),
         (.0399,.163),(.0393,.152),(.0371,.142),(.0318,.132),(.024,.124),
         (.0149,.118),(.0062,.115),(.00001,.1148)]
bowl=loft('Crystal bowl, stem and foot',[
    [(r*math.cos(a),r*math.sin(a),z) for a in [i*math.tau/72 for i in range(72)]]
    for r,z in profile
],glass,goblet,True)
topology = bmesh.new()
topology.from_mesh(bowl.data)
bmesh.ops.holes_fill(topology, edges=[edge for edge in topology.edges if edge.is_boundary])
bmesh.ops.recalc_face_normals(topology, faces=list(topology.faces))
topology.to_mesh(bowl.data)
topology.free()

bpy.ops.export_scene.gltf(
    filepath=str(pathlib.Path(__file__).resolve().parents[1]/'assets'/'table-furniture.glb'),
    export_format='GLB', export_yup=True,
)
