import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const stage = document.querySelector('#stage');
const compact = matchMedia('(pointer: coarse), (max-width: 650px)').matches;
const renderer = new T.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, compact ? 1.35 : 1.75));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = T.PCFSoftShadowMap;
renderer.toneMapping = T.ACESFilmicToneMapping;
renderer.toneMappingExposure = .87;
renderer.domElement.setAttribute('aria-label', 'Интерактивная трёхмерная модель сервированного стола');
stage.prepend(renderer.domElement);

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
const porcelain = new T.MeshPhysicalMaterial({color:0xf5ecdc,roughness:.18,clearcoat:.42});
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
linen.color.set(0xfff1da);

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
reflectionCard(0xb4cfff,7,2.1,2.7,[-2.5,1.8,1.6],[0,.8,0]);
reflectionCard(0xffbd77,8,1.3,.85,[1.4,2.25,-.55],[0,.8,0]);
reflectionCard(0xffd4a4,15,.16,.36,[.3,1.25,1.5],[0,1,0]);
const pmrem=new T.PMREMGenerator(renderer);
const environment=pmrem.fromScene(room,.035);
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
lamp.position.set(-.10,.771,-.17);
table.add(lamp);
lathe(brass,[[0,0],[.072,0],[.079,.008],[.077,.017],[.062,.024],
  [.014,.025],[.012,.274],[.020,.277],[0,.28]],0,0,0,lamp);
lathe(brass,[[.119,.253],[.118,.26],[.077,.334],[.069,.338],[.024,.339],
  [.024,.334],[.07,.331],[.112,.253],[.119,.253]],0,0,0,lamp);
const bulb=new T.MeshBasicMaterial({color:new T.Color(1,.57,.25).multiplyScalar(2.8)});
lathe(bulb,[[0,.252],[.111,.252],[.111,.256],[0,.256]],0,0,0,lamp);
const lampLight=new T.SpotLight(0xffb780,1.5,1.2,1.08,.86,2);
lampLight.position.set(0,.236,0);
lampLight.target.position.set(0,0,0);
lamp.add(lampLight,lampLight.target);

const vase=new T.Group();
vase.position.set(.095,.77,-.11);
table.add(vase);
lathe(standard(0x3c4730,.25,.19),[[0,0],[.052,0],[.056,.012],[.061,.078],
  [.048,.109],[.033,.134],[.031,.15],[.027,.151],[.028,.139],[.04,.109]],0,0,0,vase,48);
const stemMaterial=standard(0x535d35,.8);
const blossoms=[standard(0xb0a084,.87),standard(0xd1c1a0,.89),standard(0xe6d8b9,.85)];
const petalForm=new T.SphereGeometry(1,6,5);
for(let stemIndex=0;stemIndex<7;stemIndex++) {
  const angle=stemIndex*2.39996;
  const base=new T.Vector3(0,.035,0);
  const tip=new T.Vector3(Math.sin(angle)*.079,.188+(stemIndex%3)*.041,Math.cos(angle)*.08);
  const direction=tip.clone().sub(base);
  const center=tip.clone().lerp(base,.5);
  const stem=mesh(new T.CylinderGeometry(.0021,.003,direction.length(),5),stemMaterial,...center.toArray(),vase);
  stem.quaternion.setFromUnitVectors(T.Object3D.DEFAULT_UP,direction.normalize());
  for(let flower=0;flower<21;flower++) {
    const yaw=flower*2.39996;
    const pitch=Math.acos(1-2*(flower+.5)/21);
    const px=Math.sin(pitch)*Math.cos(yaw),pz=Math.sin(pitch)*Math.sin(yaw);
    const size=.032+(stemIndex%3)*.0035;
    const petal=mesh(petalForm,blossoms[(flower+stemIndex)%3],tip.x+px*size,
      tip.y+Math.cos(pitch)*size,tip.z+pz*size,vase);
    petal.scale.set(.011,.007,.012);
    petal.rotation.set(yaw,pitch,0);
  }
}

const glassMat = new T.MeshPhysicalMaterial({
  color:0xffffff, transmission:1, roughness:.039, thickness:.002,
  ior:1.48, opacity:1, attenuationDistance:1.6, attenuationColor:0xf1f8fb,
  envMapIntensity:1.2
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
const forkGeometry=utensil([[-.005,-.104],[.005,-.104],[.007,-.095],[.005,.031],
  [.012,.047],[.012,.104],[.008,.104],[.007,.061],[.004,.061],[.003,.106],[-.001,.106],
  [-.003,.061],[-.006,.061],[-.007,.104],[-.011,.104],[-.012,.05],[-.006,.031]]);
const placements=[[.25,.42,0],[-.46,.05,1.48],[.24,-.43,Math.PI]];
function placeSettings(goblet) {
  for(const [x,z,angle] of placements) {
    const setting=new T.Group();
    setting.position.set(x,.77,z);
    setting.rotation.y=angle;
    table.add(setting);
    lathe(porcelain,[[0,.004],[.069,.004],[.079,.001],[.09,.002],[.098,.006],
      [.135,.015],[.139,.021],[.135,.026],[.121,.026],[.098,.015],[.081,.01],[0,.01]],0,0,0,setting,72);
    const napkin=mesh(new T.BoxGeometry(.145,.009,.073,8,1,4),linen,0,.023,.004,setting);
    const nodes=napkin.geometry.getAttribute('position');
    for(let i=0;i<nodes.count;i++) {
      const xPos=nodes.getX(i),zPos=nodes.getZ(i);
      nodes.setY(i,nodes.getY(i)+Math.cos(xPos*43+zPos*44)*.0032+Math.sin(zPos*51)*.0018);
    }
    napkin.geometry.computeVertexNormals();
    mesh(forkGeometry,cutlery,-.167,.006,.02,setting).rotation.y=.03;
    mesh(knifeGeometry,cutlery,.166,.006,.018,setting).rotation.y=-.04;
    const stemware=goblet.clone();
    stemware.position.set(.145,0,-.145);
    stemware.scale.setScalar(1.13);
    setting.add(stemware);
  }
}

const {scene:assets}=await new GLTFLoader().loadAsync('../assets/table-furniture.glb?v=2');
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
spot(0xffc78b,40,[.9,2.55,1.25],[0,.65,0],.59,true);
spot(0xb8cef7,26,[-2.55,2.15,-.2],[0,.6,0],.71,true);
spot(0xf4ab62,23,[1.5,2.6,-2.7],[.2,.58,-.2],.84);
spot(0xa56b4a,36,[-1,1.7,-1.2],[0,1.1,-3.6],.84);

const shots={
  close:{position:[1.85,1.68,2.17],target:[0,.67,0]},
  seat:{position:[.51,1.22,1.03],target:[-.08,.79,-.25]}
};
camera.position.fromArray(shots.close.position);
controls.target.fromArray(shots.close.target);
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
  camera.aspect=stage.clientWidth/stage.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(stage.clientWidth,stage.clientHeight,false);
}
new ResizeObserver(resize).observe(stage);
resize();
renderer.shadowMap.autoUpdate=false;
renderer.shadowMap.needsUpdate=true;
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
    stage.dataset.scene='ready';
    document.querySelector('#status').hidden=true;
  }
});
