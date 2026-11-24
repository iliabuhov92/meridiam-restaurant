"""Build the reusable restaurant furniture and glassware GLB with Blender."""
import math
import pathlib
import bpy
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
angles = [math.radians(-116+i*232/40) for i in range(41)]
shell = []
for t, (rx,ry,z) in enumerate([
    (.209,.205,.43),(.229,.219,.455),(.244,.231,.51),(.254,.239,.59),
    (.259,.245,.7),(.258,.247,.766),(.251,.242,.784),(.237,.226,.775),
    (.226,.213,.745),(.226,.203,.64),(.222,.198,.53),(.208,.19,.455)
]):
    ring=[]
    for a in angles:
        drop = .21*(abs(a)/angles[-1])**2.6
        ring.append((rx*math.sin(a),-ry*math.cos(a),z-drop*min(1,t/4,(11-t)/2)))
    shell.append(ring)
loft('Wraparound upholstery',shell+[shell[0]],fabric,chair)
tube('Upper piping',shell[6],.0028,seam,chair)
rings=[]
for radius,z in [(0,.419),(.86,.415),(.98,.431),(1,.454),(.97,.476),(.83,.491),(0,.501)]:
    rings.append([(radius*.232*math.sin(a),radius*.225*math.cos(a)+.012,z) for a in [i*math.tau/40 for i in range(40)]])
loft('Seat cushion',rings,fabric,chair,True)
tube('Cushion seam',rings[3],.0022,seam,chair,True)
for x in [-1,1]:
    for y in [-1,1]:
        start=Vector((x*.206,y*.207,.005))
        end=Vector((x*.159,y*.161,.443))
        bpy.ops.mesh.primitive_cone_add(vertices=10,radius1=.013,radius2=.022,depth=(end-start).length,location=(start+end)/2)
        obj=bpy.context.object
        obj.rotation_euler=(end-start).to_track_quat('Z','Y').to_euler()
        obj.parent=chair
        obj.data.materials.append(wood)
        for face in obj.data.polygons:
            face.use_smooth=len(face.vertices)==4

goblet=root('WineGlass')
profile=[(.001,0),(.029,0),(.035,.003),(.032,.006),(.013,.008),(.0035,.013),(.0028,.086),
         (.007,.096),(.02,.107),(.033,.124),(.039,.147),(.038,.169),(.032,.186),(.029,.199),
         (.028,.199),(.03,.184),(.036,.168),(.037,.148),(.031,.126),(.019,.109),(.003,.103)]
loft('Crystal bowl, stem and foot',[
    [(r*math.cos(a),r*math.sin(a),z) for a in [i*math.tau/24 for i in range(24)]]
    for r,z in profile
],glass,goblet,True)

bpy.ops.export_scene.gltf(
    filepath=str(pathlib.Path(__file__).resolve().parents[1]/'assets'/'table-furniture.glb'),
    export_format='GLB', export_yup=True,
)
