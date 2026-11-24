import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const stage = document.querySelector('#stage');
const viewport = document.querySelector('#scene-viewport');
const params = new URLSearchParams(location.search);
const qa = params.get('qa') === '1';
const compact = matchMedia('(pointer: coarse), (max-width: 650px)').matches;
const renderer = new T.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, compact ? 1.35 : 1.75));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = T.PCFSoftShadowMap;
renderer.toneMapping = T.ACESFilmicToneMapping;
renderer.toneMappingExposure = .87;
renderer.domElement.setAttribute('aria-label', 'Интерактивная трёхмерная модель сервированного стола');
viewport.prepend(renderer.domElement);

const scene = new T.Scene();
scene.background = new T.Color(0x191512);
const camera = new T.PerspectiveCamera(compact ? 44 : 37, 1, .035, 28);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.enablePan = false;
controls.minDistance = .67;
controls.maxDistance = 5.5;
controls.maxPolarAngle = Math.PI * .49;

const standard = (color, roughness, metalness = 0) =>
  new T.MeshStandardMaterial({ color, roughness, metalness });
const brass = standard(0xb9824c, .27, .88);
const darkMetal = standard(0x3c261a, .34, .68);
const porcelain = new T.MeshPhysicalMaterial({color:0xe9e0d2,roughness:.245,clearcoat:.28});
const textile = standard(0x9d8065, .92);
const linen = standard(0xcac2b1, .91);
const wood = standard(0x3e2318,.49);

function hash(x,y) {
  const n = Math.imul(x,374761393) + Math.imul(y,668265263);
  return ((Math.imul(n ^ n >>> 13,1274126177) ^ n >>> 11) >>> 0)/4294967295;
}
function noise(x,y) {
  const i=Math.floor(x),j=Math.floor(y);
  const u=x-i,v=y-j;
  const a=u*u*(3-2*u),b=v*v*(3-2*v);
  return T.MathUtils.lerp(T.MathUtils.lerp(hash(i,j),hash(i+1,j),a),
    T.MathUtils.lerp(hash(i,j+1),hash(i+1,j+1),a),b);
}
function texture(size, channels, color = false) {
  const canvas=document.createElement('canvas');
  canvas.width=canvas.height=size;
  const context=canvas.getContext('2d');
  const bitmap=context.createImageData(size,size);
  for(let y=0;y<size;y++) for(let x=0;x<size;x++) {
    const index=(y*size+x)*4;
    const [r,g,b]=channels(x/size,y/size,x,y);
    bitmap.data[index]=r;
    bitmap.data[index+1]=g;
    bitmap.data[index+2]=b;
    bitmap.data[index+3]=255;
  }
  context.putImageData(bitmap,0,0);
  const result=new T.CanvasTexture(canvas);
  result.wrapS=result.wrapT=T.RepeatWrapping;
  result.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
  if(color) result.colorSpace=T.SRGBColorSpace;
  return result;
}

const textureLoader = new T.TextureLoader();
async function materialMaps(name, repeat = 1) {
  const files = ['color', 'normal', 'roughness'];
  const maps = await Promise.all(files.map(file =>
    textureLoader.loadAsync(new URL('../assets/table-materials/'+name+'-'+file+'.webp',import.meta.url).href)
  ));
  for(const map of maps) {
    map.wrapS = map.wrapT = T.RepeatWrapping;
    map.repeat.setScalar(repeat);
    map.anisotropy = Math.min(8,renderer.capabilities.getMaxAnisotropy());
  }
  maps[0].colorSpace = T.SRGBColorSpace;
  return {map:maps[0],normalMap:maps[1],roughnessMap:maps[2]};
}
const [stoneMaps,fabricMaps] = await Promise.all([materialMaps('stone'),materialMaps('linen',2.4)]);
const marble = new T.MeshPhysicalMaterial({
  ...stoneMaps, color:0xf4e1cc, roughness:.52, clearcoat:.25, clearcoatRoughness:.36
});
marble.normalScale.set(.25,.25);
Object.assign(textile,fabricMaps);
textile.normalScale.set(.46,.46);
textile.color.set(0xc9aa89);
Object.assign(linen,fabricMaps);
linen.normalScale.set(.21,.21);
linen.color.set(0xd4bfa0);

function mesh(geometry,material,x=0,y=0,z=0,parent=scene) {
  const item=new T.Mesh(geometry,material);
  item.position.set(x,y,z);
  item.castShadow=true;
  item.receiveShadow=true;
  parent.add(item);
  return item;
}
const box = (mat,x,y,z,w,h,d,parent) => mesh(new T.BoxGeometry(w,h,d),mat,x,y,z,parent);
const lathe = (mat,profile,x,y,z,parent,segments=96) =>
  mesh(new T.LatheGeometry(profile.map(([r,height])=>new T.Vector2(r,height)),segments),mat,x,y,z,parent);

const room = new RoomEnvironment();
function reflectionCard(color,power,width,height,position,lookAt) {
  const mat=new T.MeshBasicMaterial({color:new T.Color(color).multiplyScalar(power)});
  const item=new T.Mesh(new T.PlaneGeometry(width,height),mat);
  item.position.set(...position);
  item.lookAt(...lookAt);
  room.add(item);
}
reflectionCard(0xc2d7f6,6.2,1.55,2.25,[-2.5,1.8,1.6],[0,.8,0]);
reflectionCard(0xffffff,9,.11,1.76,[-1.85,1.55,.85],[0,.91,0]);
reflectionCard(0xffd5a2,4.6,.16,1.3,[1.73,1.61,-1.45],[0,.93,.24]);
reflectionCard(0xffbd77,8,1.3,.85,[1.4,2.25,-.55],[0,.8,0]);
reflectionCard(0xffd4a4,15,.16,.36,[.3,1.25,1.5],[0,1,0]);
const pmrem=new T.PMREMGenerator(renderer);
const environment=pmrem.fromScene(room,.019);
scene.environment=environment.texture;
scene.environmentIntensity=.43;
room.dispose();
pmrem.dispose();

const floor=standard(0x56463b,.48);
floor.map=marble.map.clone();
floor.map.repeat.set(2,4);
floor.normalMap=marble.normalMap.clone();
floor.normalMap.repeat.set(2,4);
floor.normalScale.set(.14,.14);
box(floor,0,-.061,0,15,.12,15);
for(let i=-5;i<=5;i++) {
  box(wood,0,.001,i*1.08,13,.003,.005);
  box(wood,i*1.08,.001,0,.005,.003,13);
}
wood.map=texture(256,(u,v)=>{
  const fiber=noise(u*59,v*4)*30+noise(u*111,v*25)*18;
  return [143+fiber,132+fiber,124+fiber];
},true);
box(wood,0,1.6,-3.65,12,3.2,.14);
box(wood,-3.62,1.6,.4,.12,3.2,8.1);
for(let i=-23;i<=23;i++) box(wood,i*.125,1.6,-3.53,.055,3.2,.085);
box(brass,0,.057,-3.47,9,.022,.012);

const table = new T.Group();
scene.add(table);
const radius=.75;
const counter=lathe(marble,[[0,.708],[radius-.027,.708],[radius-.009,.712],[radius-.002,.72],
  [radius,.737],[radius,.752],[radius-.005,.764],[radius-.016,.769],[0,.769]],0,0,0,table,144);
const counterVertices=counter.geometry.getAttribute('position');
const counterUV=counter.geometry.getAttribute('uv');
for(let i=0;i<counterVertices.count;i++) {
  counterUV.setXY(i,.5+counterVertices.getX(i)/(2*radius),.5+counterVertices.getZ(i)/(2*radius));
}
lathe(darkMetal,[[0,.008],[.288,.008],[.312,.016],[.312,.033],[.301,.041],
  [.164,.05],[.135,.077],[.118,.15],[.107,.655],[.161,.697],[0,.698]],0,0,0,table);
lathe(brass,[[.288,.024],[.311,.024],[.31,.032],[.288,.033]],0,0,0,table);

const lamp=new T.Group();
lamp.position.set(-.30,.77,-.20);
table.add(lamp);
const satinBrass=new T.MeshPhysicalMaterial({
  color:0x986635,metalness:.92,roughness:.38,anisotropy:.21,clearcoat:.11
});
satinBrass.roughnessMap=texture(128,(u,v)=>{
  const grain=196+noise(u*220,v*12)*34;
  return [grain,grain,grain];
});
lathe(darkMetal,[[0,0],[.064,0],[.067,.002],[.067,.006],[0,.006]],0,0,0,lamp);
lathe(satinBrass,[[0,.004],[.064,.004],[.069,.007],[.069,.012],[.066,.016],[.058,.020],
  [.013,.023],[.009,.029],[.009,.213],[.012,.217],[.020,.217],[0,.219]],0,0,0,lamp);
lathe(satinBrass,[[.099,.207],[.102,.207],[.102,.210],[.099,.217],[.091,.231],
  [.074,.248],[.065,.252],[.052,.254],[0,.254],[0,.249],[.052,.249],
  [.064,.247],[.070,.243],[.090,.226],[.098,.210],[.099,.207]],0,0,0,lamp);
const bulb=new T.MeshStandardMaterial({
  color:0xffe5ca,roughness:.55,emissive:0xffbc78,emissiveIntensity:1.4
});
lathe(bulb,[[0,.210],[.091,.210],[.091,.213],[0,.213]],0,0,0,lamp);
const lampLight=new T.SpotLight(0xffbe89,1.32,1.3,1.04,.88,2);
lampLight.position.set(0,.190,0);
lampLight.target.position.set(.035,0,.04);
lamp.add(lampLight,lampLight.target);

const vase=new T.Group();
vase.position.set(.31,.769,-.25);
table.add(vase);
lathe(new T.MeshPhysicalMaterial({color:0x424638,roughness:.27,clearcoat:.31}),
  [[0,0],[.053,0],[.061,.006],[.067,.021],[.066,.047],[.055,.079],[.042,.099],
    [.036,.106],[.033,.106],[.031,.102],[.036,.093],[.048,.074],[.060,.043],[0,.008]],
  0,0,0,vase,72);
const stemMaterial=standard(0x465336,.86);
const leafMaterial=new T.MeshStandardMaterial({color:0x4a5830,roughness:.74,side:T.DoubleSide});
const palette=[0xe0d4af,0xd4c79f,0xded2b4,0xc2bb8d].map(color=>
  new T.MeshPhysicalMaterial({color,roughness:.92,sheen:1,sheenColor:0xffebc9,side:T.DoubleSide})
);
function petalGeometry(variant) {
  const petals=new T.BufferGeometry();
  const vertices=[], indices=[];
  const columns=8, rows=8;
  for(let petal=0;petal<4;petal++) {
    const angle=petal*Math.PI/2+(petal%2?.09:-.045)*variant;
    const start=vertices.length/3;
    for(let row=0;row<=rows;row++){
      const t=row/rows;
      const length=.0135+t*.002*(variant-1);
      const width=Math.pow(Math.sin(Math.PI*t),.75)*.0064;
      for(let col=0;col<=columns;col++){
        const u=col/columns*2-1;
        const x=u*width;
        const z=.0016+t*length;
        const y=.0014*Math.sin(t*Math.PI)+t*t*(.0016+.0028*u*u)+
          Math.cos(col*.9+petal)*.00045*t;
        vertices.push(x*Math.cos(angle)+z*Math.sin(angle),y,z*Math.cos(angle)-x*Math.sin(angle));
        if(row&&col){
          const v=start+row*(columns+1)+col;
          indices.push(v-columns-2,v-1,v,v-columns-2,v,v-columns-1);
        }
      }
    }
  }
  petals.setAttribute('position',new T.Float32BufferAttribute(vertices,3));
  petals.setIndex(indices);
  petals.computeVertexNormals();
  return petals;
}
const clusters=[
  [-.068,.181,.031,.055],[-.019,.224,.012,.058],[.045,.209,-.036,.048],
  [.042,.163,.054,.039],[-.038,.16,-.036,.043]
];
const renderFlowers=[];
const orientation=new T.Object3D();
for(const [cluster,[x,y,z,radius]] of clusters.entries()){
  const position=new T.Vector3(x,y,z);
  const stemPoints=[new T.Vector3(0,.025,0),position.clone().multiplyScalar(.69),position];
  mesh(new T.TubeGeometry(new T.CatmullRomCurve3(stemPoints),10,.0018,5,false),stemMaterial,0,0,0,vase);
  for(let i=0;i<30;i++){
    const angle=i*2.39996+cluster;
    const up=.14+.86*(i+.5)/30;
    const spread=Math.sqrt(1-up*up);
    const direction=new T.Vector3(Math.cos(angle)*spread,up,Math.sin(angle)*spread);
    const origin=position.clone().addScaledVector(direction,radius*(.89+hash(cluster,i)*.2));
    origin.y-=.032;
    orientation.position.copy(origin);
    orientation.quaternion.setFromUnitVectors(T.Object3D.DEFAULT_UP,direction);
    orientation.rotateY(angle);
    orientation.scale.setScalar(.67+hash(i,cluster)*.51);
    orientation.updateMatrix();
    renderFlowers.push({matrix:orientation.matrix.clone(),variant:(i+cluster)%3});
  }
}
for(let variant=0;variant<3;variant++){
  const units=renderFlowers.filter(flower=>flower.variant===variant);
  const petals=new T.InstancedMesh(petalGeometry(variant),palette[variant],units.length);
  const centers=new T.InstancedMesh(new T.SphereGeometry(.0022,8,5),palette[3],units.length);
  for(const [i,{matrix}] of units.entries()){
    petals.setMatrixAt(i,matrix);
    centers.setMatrixAt(i,matrix);
  }
  petals.castShadow=centers.castShadow=true;
  petals.receiveShadow=true;
  vase.add(petals,centers);
}
for(const [i,theta] of [-1.9,.1,1.7,3.4].entries()){
  const leaf = new T.BufferGeometry();
  const vectors=[], indices=[];
  const length=.081+i*.008;
  for(let row=0;row<=12;row++){
    const t=row/12;
    const w=Math.sin(Math.PI*t)*.019;
    for(let j=-1;j<=1;j++){
      vectors.push(j*w,.016*Math.sin(Math.PI*t)-Math.abs(j)*w*.23,t*length);
    }
    if(row){const a=(row-1)*3;indices.push(a,a+3,a+1,a+1,a+3,a+4,a+1,a+4,a+2,a+2,a+4,a+5)}
  }
  leaf.setAttribute('position',new T.Float32BufferAttribute(vectors,3));
  leaf.setIndex(indices);
  leaf.computeVertexNormals();
  const blade=mesh(leaf,leafMaterial,0,.115+i*.008,0,vase);
  blade.rotation.set(.23,theta,0);
}

const glassMat = new T.MeshPhysicalMaterial({
  color:0xffffff, transmission:1, roughness:.025, thickness:.00075,
  ior:1.49, opacity:1, attenuationDistance:Infinity,
  envMapIntensity:2.3, specularIntensity:1
});
const cutlery=standard(0xcfc6b8,.26,.89);
function utensil(outline) {
  const shape=new T.Shape();
  outline.forEach(([x,y],i)=>i ? shape.lineTo(x,y) : shape.moveTo(x,y));
  shape.closePath();
  const geometry=new T.ExtrudeGeometry(shape,{
    depth:.0018,bevelEnabled:true,bevelThickness:.0011,bevelSize:.0011,bevelSegments:2,curveSegments:4
  });
  geometry.rotateX(-Math.PI/2);
  return geometry;
}
const knifeGeometry=utensil([[-.006,-.106],[.004,-.106],[.008,-.095],[.005,.002],
  [.011,.016],[.01,.079],[.004,.106],[-.011,.097],[-.012,.041],[-.006,-.001]]);
const forkGeometry=utensil([[-.005,-.104],[.005,-.104],[.007,-.095],[.005,.032],
  [.014,.053],[.013,.101],[.0105,.104],[.009,.102],[.0085,.062],
  [.0055,.061],[.005,.106],[.002,.108],[.001,.105],[.001,.062],
  [-.002,.062],[-.0025,.106],[-.0055,.107],[-.0065,.104],[-.006,.062],
  [-.009,.063],[-.0095,.101],[-.012,.103],[-.014,.1],[-.014,.05],[-.006,.032]]);
const foldedCloth=linen.clone();
foldedCloth.side=T.DoubleSide;
const hem=new T.MeshStandardMaterial({color:0xa38a68,roughness:.97});
function clothHeight(u,v) {
  return .0015*Math.cos(u*8+v*3)+.0039*Math.sin(v*8+u*.88)**2+
    .012*Math.pow(Math.max(0,u-.45)/.55,2)*Math.pow(Math.max(0,v-.1)/.9,2);
}
function napkinGeometry(layer) {
  const width=24,height=14;
  const points=[], indices=[],uv=[];
  for(let y=0;y<=height;y++) for(let x=0;x<=width;x++){
    const u=x/width,v=y/height;
    points.push((u-.5)*(.158-layer*.011),clothHeight(u,v)+layer*.0031,
      (v-.5)*(.086-layer*.007)+layer*.003);
    uv.push(u,v);
    if(x&&y){const i=points.length/3-1;indices.push(i-width-2,i-1,i,i-width-2,i,i-width-1)}
  }
  const geo=new T.BufferGeometry();
  geo.setAttribute('position',new T.Float32BufferAttribute(points,3));
  geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}
const clothLayers=[0,1,2].map(napkinGeometry);
const stitching=new T.CatmullRomCurve3(Array.from({length:24},(_,i)=>{
  const u=i/23;
  return new T.Vector3((u-.5)*.143,clothHeight(u,.93)+.0069,.038);
}));
const seamGeometry=new T.TubeGeometry(stitching,25,.00069,5,false);
const contactCanvas=document.createElement('canvas');
contactCanvas.width=contactCanvas.height=64;
const contactContext=contactCanvas.getContext('2d');
const contactGradient=contactContext.createRadialGradient(32,32,2,32,32,31);
for(const [offset,opacity] of [[0,.47],[.38,.33],[.72,.11],[1,0]])
  contactGradient.addColorStop(offset,'rgba(13,7,4,'+opacity+')');
contactContext.fillStyle=contactGradient;
contactContext.fillRect(0,0,64,64);
const contactTexture=new T.CanvasTexture(contactCanvas);
function contact(parent,x,y,z,width,depth,opacity=1) {
  const patch=new T.Mesh(new T.PlaneGeometry(width,depth),new T.MeshBasicMaterial({
    map:contactTexture,transparent:true,depthWrite:false,opacity
  }));
  patch.position.set(x,y,z);
  patch.rotation.x=-Math.PI/2;
  patch.renderOrder=1;
  parent.add(patch);
}
contact(table,-.30,.7693,-.20,.185,.185);
contact(table,.31,.7693,-.25,.169,.169);
const placements=[[.265,.41,0],[-.475,.035,1.48],[.235,-.435,Math.PI]];
const foreground={};
function placeSettings(goblet) {
  for(const [index,[x,z,angle]] of placements.entries()) {
    const setting=new T.Group();
    setting.position.set(x,.769,z);
    setting.rotation.y=angle;
    table.add(setting);
    contact(setting,0,.0003,0,.308,.308,.8);
    const plate=lathe(porcelain,[[0,.004],[.076,.004],[.081,0],[.091,0],[.099,.006],
      [.12,.009],[.138,.015],[.141,.018],[.140,.021],[.133,.022],[.121,.019],
      [.105,.013],[.093,.011],[0,.011]],0,0,0,setting,96);
    contact(setting,0,.0117,.003,.167,.108,.56);
    for(const layer of clothLayers) mesh(layer,foldedCloth,0,.0135,.003,setting);
    mesh(seamGeometry,hem,0,.0135,.003,setting);
    const fork=mesh(forkGeometry,cutlery,-.167,.0014,.02,setting);
    fork.rotation.y=.03;
    const knife=mesh(knifeGeometry,cutlery,.166,.0014,.018,setting);
    knife.rotation.y=-.04;
    contact(setting,.159,.00035,-.17,.104,.104,.73);
    const stemware=goblet.clone();
    stemware.position.set(.159,0,-.17);
    setting.add(stemware);
    if(index===0) Object.assign(foreground,{plate,fork,knife,stemware});
  }
}

const {scene:assets}=await new GLTFLoader().loadAsync('../assets/table-furniture.glb?v=4');
const chair=assets.getObjectByName('DiningChair');
const goblet=assets.getObjectByName('WineGlass');
if(!chair || !goblet) throw new Error('Dining asset nodes are missing.');
chair.traverse(item=>{
  if(!item.isMesh) return;
  if(item.material.name==='Oatmeal upholstery') item.material=textile;
  item.castShadow=item.receiveShadow=true;
});
goblet.traverse(item=>{ if(item.isMesh) item.material=glassMat; });
for(const angle of [.25,2.2,4.55]) {
  const seat=chair.clone();
  seat.position.set(Math.sin(angle)*.937,0,Math.cos(angle)*.937);
  seat.rotation.y=angle;
  seat.scale.set(1.18,1.03,1.18);
  for(const x of [-.206,.206]) for(const z of [-.207,.207])
    contact(seat,x,.0012,z,.19,.19,.64);
  scene.add(seat);
}
placeSettings(goblet);

const softFill=new T.HemisphereLight(0xa7bde3,0x7e4d2b,.62);
scene.add(softFill);
function spot(color,intensity,position,aim,angle,shadows=false) {
  const key=new T.SpotLight(color,intensity,10,angle,.63,2);
  key.position.set(...position);
  key.target.position.set(...aim);
  key.castShadow=shadows;
  if(shadows) {
    key.shadow.mapSize.set(compact?1024:2048,compact?1024:2048);
    key.shadow.bias=-.00025;
    key.shadow.normalBias=.012;
  }
  scene.add(key,key.target);
}
spot(0xffcf9d,37,[.9,2.55,1.25],[0,.65,0],.59,true);
spot(0xbbd1fa,31,[-2.55,2.15,-.2],[0,.6,0],.71,true);
spot(0xf4ab62,23,[1.5,2.6,-2.7],[.2,.58,-.2],.84);
spot(0xa56b4a,36,[-1,1.7,-1.2],[0,1.1,-3.6],.84);

const shots={
  close:{position:[1.85,1.68,2.17],target:[0,.67,0]},
  seat:{position:[.53,1.36,1.68],target:[-.015,.865,.095]},
  legacy:{position:[.51,1.22,1.03],target:[-.08,.79,-.25]}
};
const initial = qa ? shots[params.get('view')] ?? shots.close : shots.close;
camera.position.fromArray(initial.position);
controls.target.fromArray(initial.target);
if(qa && params.has('orbit')) {
  const offset = camera.position.clone().sub(controls.target);
  offset.applyAxisAngle(T.Object3D.DEFAULT_UP, T.MathUtils.degToRad(20));
  camera.position.copy(controls.target).add(offset);
}
controls.update();
let transition;
const buttons=[...document.querySelectorAll('[data-view]')];
function indicate(active) {
  for(const button of buttons) button.setAttribute('aria-pressed',String(button.dataset.view===active));
}
for(const button of buttons) button.addEventListener('click',()=>{
  const view=shots[button.dataset.view];
  indicate(button.dataset.view);
  transition={start:performance.now(),from:camera.position.clone(),look:controls.target.clone(),
    to:new T.Vector3(...view.position),target:new T.Vector3(...view.target)};
});
controls.addEventListener('start',()=>{ transition=null; indicate(); });
let redraw=true;
controls.addEventListener("change",()=>{ redraw=true; });
function resize() {
  redraw=true;
  camera.aspect=viewport.clientWidth/viewport.clientHeight;
  camera.fov=compact ? T.MathUtils.clamp(45/camera.aspect,48,76) : 37;
  camera.updateProjectionMatrix();
  renderer.setSize(viewport.clientWidth,viewport.clientHeight,false);
}
new ResizeObserver(resize).observe(viewport);
resize();
renderer.shadowMap.autoUpdate=false;
renderer.shadowMap.needsUpdate=true;
function screenPoints(object) {
  const samples=[];
  const point=new T.Vector3();
  object.traverse(mesh=>{
    if(!mesh.isMesh) return;
    const verts=mesh.geometry.getAttribute('position');
    const instances=mesh.isInstancedMesh ? mesh.count : 1;
    const matrix=new T.Matrix4();
    for(let i=0;i<instances;i++){
      if(mesh.isInstancedMesh) mesh.getMatrixAt(i,matrix);
      for(let j=0;j<verts.count;j++){
        point.fromBufferAttribute(verts,j);
        if(mesh.isInstancedMesh) point.applyMatrix4(matrix);
        point.applyMatrix4(mesh.matrixWorld).project(camera);
        samples.push([(point.x+1)*viewport.clientWidth/2,(1-point.y)*viewport.clientHeight/2]);
      }
    }
  });
  return samples;
}
function bounds(points) {
  return points.reduce(([left,top,right,bottom],[x,y])=>
    [Math.min(left,x),Math.min(top,y),Math.max(right,x),Math.max(bottom,y)],
    [Infinity,Infinity,-Infinity,-Infinity]);
}
function measureFrame() {
  const [width,height]=[viewport.clientWidth,viewport.clientHeight];
  const items=Object.fromEntries(Object.entries(foreground).map(([name,model])=>[name,bounds(screenPoints(model))]));
  const shade=bounds(screenPoints(lamp));
  const flowers=bounds(screenPoints(vase));
  return {width,height,camera:camera.position.toArray(),target:controls.target.toArray(),fov:camera.fov,
    exposure:renderer.toneMappingExposure,items,shadeOverFlowersX:shade[2]-flowers[0]};
}
if(qa) window.meridiamTableCapture=(view,orbit=0)=>{
  if(!Object.hasOwn(shots,view)) throw new RangeError('Unknown table view');
  const frame=shots[view];
  controls.target.fromArray(frame.target);
  camera.position.fromArray(frame.position);
  const offset=camera.position.clone().sub(controls.target);
  offset.applyAxisAngle(T.Object3D.DEFAULT_UP,T.MathUtils.degToRad(orbit));
  camera.position.copy(controls.target).add(offset);
  transition=null;
  stage.removeAttribute('data-measurement');
  redraw=true;
};
renderer.setAnimationLoop(()=>{
  const moving=!!transition;
  if(transition) {
    const t=Math.min(1,(performance.now()-transition.start)/660);
    const mix=t*t*(3-2*t);
    camera.position.lerpVectors(transition.from,transition.to,mix);
    controls.target.lerpVectors(transition.look,transition.target,mix);
    if(t===1) transition=null;
  }
  const changed=controls.update();
  if(redraw || moving || changed) {
    redraw=false;
    renderer.render(scene,camera);
    if(qa) stage.dataset.measurement=JSON.stringify(measureFrame());
    stage.dataset.camera=JSON.stringify(camera.position.toArray());
    stage.dataset.scene='ready';
    document.querySelector('#status').hidden=true;
  }
});
