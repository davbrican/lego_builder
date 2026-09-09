import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {PART_MAP, PARTS, PLATE_HEIGHT as H, dimensions} from './catalog.js';
import {bounds} from './model.js';

const geometryCache=new Map();
function box(w,h,d,rounded=true){
  const key=`${w}/${h}/${d}/${rounded}`;
  if(!geometryCache.has(key)) geometryCache.set(key,rounded?new RoundedBoxGeometry(w,h,d,2,0.025):new THREE.BoxGeometry(w,h,d));
  return geometryCache.get(key);
}
const studGeo=new THREE.CylinderGeometry(.295,.305,.17,20);
const tubeGeo=new THREE.CylinderGeometry(.31,.31,1,16,1,true);
function brickGroup(piece,{ghost=false,valid=true}={}){
  const p=PART_MAP[piece.part],{w,d,h}=dimensions(piece),height=h*H;
  const group=new THREE.Group();
  const material=new THREE.MeshStandardMaterial({color:ghost?(valid?'#72bb82':'#ef6867'):piece.color,roughness:.29,metalness:.015,transparent:ghost,opacity:ghost?.48:1,depthWrite:!ghost});
  function mesh(geo,x,y,z){const m=new THREE.Mesh(geo,material);m.position.set(x,y,z);m.castShadow=!ghost;m.receiveShadow=true;m.userData.pieceId=piece.id;group.add(m);return m;}
  // Open underside, with a top skin and four side walls.
  const wall=.13,top=.14;
  mesh(box(w-.045,top,d-.045),w/2,height-top/2,d/2);
  const sideH=height-top;
  mesh(box(w-.045,sideH,wall),w/2,sideH/2,wall/2+.0225);
  mesh(box(w-.045,sideH,wall),w/2,sideH/2,d-wall/2-.0225);
  mesh(box(wall,sideH,d-.045-wall*2),wall/2+.0225,sideH/2,d/2);
  mesh(box(wall,sideH,d-.045-wall*2),w-wall/2-.0225,sideH/2,d/2);
  if(p.studs){
    const studs=new THREE.InstancedMesh(studGeo,material,w*d),matrix=new THREE.Matrix4();
    for(let x=0,i=0;x<w;x++)for(let z=0;z<d;z++,i++){matrix.makeTranslation(x+.5,height+.075,z+.5);studs.setMatrixAt(i,matrix);}
    studs.userData.pieceId=piece.id;studs.castShadow=!ghost;studs.receiveShadow=true;group.add(studs);
  }
  // Underside reinforcement tubes; kept hollow for inspection from below.
  if(w>1 && d>1){
    const tubes=new THREE.InstancedMesh(tubeGeo,material,(w-1)*(d-1)),matrix=new THREE.Matrix4();
    for(let x=1,i=0;x<w;x++)for(let z=1;z<d;z++,i++){
      matrix.compose(new THREE.Vector3(x,sideH/2,z),new THREE.Quaternion(),new THREE.Vector3(1,sideH,1));tubes.setMatrixAt(i,matrix);
    }
    tubes.userData.pieceId=piece.id;group.add(tubes);
  }
  group.position.set(piece.x,piece.y*H,piece.z);group.userData.pieceId=piece.id;
  return group;
}
function disposeGroup(group){
  const materials=new Set();group.traverse(o=>{if(o.material)materials.add(o.material);if(o.isInstancedMesh)o.dispose();});
  materials.forEach(m=>m.dispose());group.removeFromParent();
}

export class BuilderScene {
  constructor(container,{onHover,onClick,onReady}){
    this.container=container;this.onHover=onHover;this.onClick=onClick;this.objects=new Map();this.pieces=[];this.size=32;
    this.scene=new THREE.Scene();this.scene.background=new THREE.Color('#dbe3e8');
    this.scene.fog=new THREE.Fog('#dbe3e8',100,210);
    this.camera=new THREE.PerspectiveCamera(38,1,.1,500);
    this.renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
    this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.15;
    this.renderer.domElement.setAttribute('aria-label','Mesa de construcción 3D. Clic para colocar; arrastrar para girar la cámara.');
    this.renderer.domElement.tabIndex=0;container.prepend(this.renderer.domElement);
    this.scene.add(new THREE.HemisphereLight('#ffffff','#899daa',2.8));
    const sun=new THREE.DirectionalLight('#fff4dc',3.4);sun.position.set(-15,55,30);sun.castShadow=true;
    sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-70,right:70,top:70,bottom:-70,far:160});sun.shadow.bias=-.0004;sun.shadow.normalBias=.035;
    sun.target.position.set(16,0,16);this.scene.add(sun,sun.target);
    const fill=new THREE.DirectionalLight('#c8e0ff',1.2);fill.position.set(40,20,-20);this.scene.add(fill);
    this.buildGroup=new THREE.Group();this.scene.add(this.buildGroup);
    this.controls=new OrbitControls(this.camera,this.renderer.domElement);
    this.controls.enableDamping=true;this.controls.dampingFactor=.09;this.controls.maxPolarAngle=Math.PI*.86;
    this.controls.minDistance=4;this.controls.maxDistance=170;this.controls.target.set(16,2,16);
    this.controls.mouseButtons={LEFT:THREE.MOUSE.ROTATE,MIDDLE:THREE.MOUSE.DOLLY,RIGHT:THREE.MOUSE.PAN};
    this.controls.touches={ONE:THREE.TOUCH.ROTATE,TWO:THREE.TOUCH.DOLLY_PAN};
    this.raycaster=new THREE.Raycaster();this.pointer=new THREE.Vector2();
    this.pointerActive=false;this.pressed=null;this.touchIds=new Set();
    const el=this.renderer.domElement;
    el.addEventListener('pointermove',e=>{this.pointerActive=true;this.lastEvent={clientX:e.clientX,clientY:e.clientY};if(this.pressed&&Math.hypot(e.clientX-this.pressed.x,e.clientY-this.pressed.y)>5)this.pressed.dragged=true;this.inspectPointer();});
    el.addEventListener('pointerdown',e=>{this.touchIds.add(e.pointerId);if(this.touchIds.size>1 && this.pressed)this.pressed.dragged=true;if(e.button===0&&this.touchIds.size===1)this.pressed={x:e.clientX,y:e.clientY,dragged:false,id:e.pointerId};});
    el.addEventListener('pointerup',e=>{const click=this.pressed?.id===e.pointerId&&!this.pressed.dragged&&e.button===0;this.touchIds.delete(e.pointerId);this.pressed=null;if(click){this.lastEvent={clientX:e.clientX,clientY:e.clientY};this.pointerActive=true;const hit=this.inspectPointer();this.onClick(hit);}});
    el.addEventListener('pointercancel',e=>{this.touchIds.delete(e.pointerId);this.pressed=null;});
    el.addEventListener('pointerleave',()=>{if(!this.pressed){this.pointerActive=false;this.onHover(null);}});
    el.addEventListener('contextmenu',e=>e.preventDefault());
    this.controls.addEventListener('change',()=>{if(this.pointerActive && !this.pressed?.dragged)this.inspectPointer();});
    this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(container);
    this.setBase(32);this.view('iso');this.resize();
    this.renderer.setAnimationLoop(()=>{this.controls.update();this.renderer.render(this.scene,this.camera);});
    onReady?.();
  }
  resize(){const {width,height}=this.container.getBoundingClientRect();if(!width||!height)return;this.camera.aspect=width/height;this.camera.updateProjectionMatrix();this.renderer.setSize(width,height);}
  setBase(size){
    this.size=size;
    const gridVisible=this.grid?.visible??true;
    if(this.base){this.base.geometry.dispose();this.base.material.dispose();this.scene.remove(this.base);}
    if(this.grid){this.grid.geometry.dispose();this.grid.material.dispose();this.scene.remove(this.grid);}
    this.base=new THREE.Mesh(new THREE.BoxGeometry(size,.3,size),new THREE.MeshStandardMaterial({color:'#95ac9d',roughness:.82}));
    this.base.position.set(size/2,-.15,size/2);this.base.receiveShadow=true;this.scene.add(this.base);
    this.grid=new THREE.GridHelper(size,size,'#607f6b','#7f9b87');this.grid.position.set(size/2,.008,size/2);this.grid.material.opacity=.45;this.grid.material.transparent=true;this.scene.add(this.grid);
    if(this.baseStuds){this.baseStuds.dispose();this.baseStuds.material.dispose();this.scene.remove(this.baseStuds);}
    this.baseStuds=new THREE.InstancedMesh(studGeo,new THREE.MeshStandardMaterial({color:'#9ab09f',roughness:.6}),size*size);
    const matrix=new THREE.Matrix4();for(let x=0,i=0;x<size;x++)for(let z=0;z<size;z++,i++){matrix.makeTranslation(x+.5,.07,z+.5);this.baseStuds.setMatrixAt(i,matrix);}
    this.baseStuds.receiveShadow=true;this.scene.add(this.baseStuds);this.toggleGrid(gridVisible);
  }
  sync(pieces){
    this.pieces=pieces;
    const ids=new Set(pieces.map(p=>p.id));
    for(const [id,record] of this.objects)if(!ids.has(id)){disposeGroup(record.group);this.objects.delete(id);}
    for(const piece of pieces){
      const key=JSON.stringify(piece),record=this.objects.get(piece.id);
      if(record?.key===key)continue;
      if(record)disposeGroup(record.group);
      const group=brickGroup(piece);this.buildGroup.add(group);this.objects.set(piece.id,{key,group});
    }
    this.select(this.selectedId);
  }
  select(id){
    this.selectedId=id;
    if(this.outline){this.outline.geometry.dispose();this.outline.material.dispose();this.scene.remove(this.outline);this.outline=null;}
    const record=this.objects.get(id);
    if(record){record.group.updateWorldMatrix(true,true);this.outline=new THREE.BoxHelper(record.group,'#f8b628');this.outline.material.depthTest=false;this.outline.renderOrder=10;this.scene.add(this.outline);}
  }
  hidePiece(id,hidden){const group=this.objects.get(id)?.group;if(group)group.visible=!hidden;}
  setGhost(piece,valid){
    const key=piece?JSON.stringify([piece,valid]):null;if(this.ghostKey===key)return;this.ghostKey=key;
    if(this.ghost){disposeGroup(this.ghost);this.ghost=null;}
    if(piece){this.ghost=brickGroup(piece,{ghost:true,valid});this.scene.add(this.ghost);}
  }
  inspectPointer(){
    if(!this.lastEvent)return null;
    const rect=this.renderer.domElement.getBoundingClientRect();
    this.pointer.set((this.lastEvent.clientX-rect.left)/rect.width*2-1,-(this.lastEvent.clientY-rect.top)/rect.height*2+1);
    this.camera.updateMatrixWorld();this.scene.updateMatrixWorld();this.raycaster.setFromCamera(this.pointer,this.camera);
    const objects=[this.base,...[...this.objects.values()].filter(r=>r.group.visible).map(r=>r.group)];
    const hits=this.raycaster.intersectObjects(objects,true);const first=hits[0];
    let hit=first?{point:first.point,piece:this.pieces.find(p=>p.id===first.object.userData.pieceId)||null}:null;
    if(this.manualLayer!==null && this.manualLayer!==undefined){
      const point=new THREE.Vector3();
      if(this.raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),-this.manualLayer*H),point))hit={point,piece:hit?.piece??null,layer:this.manualLayer};else hit=null;
    }
    this.onHover(hit);return hit;
  }
  view(type){
    const b=bounds(this.pieces),center=this.pieces.length?new THREE.Vector3(b.x+b.w/2,b.y*H+b.h*H/2,b.z+b.d/2):new THREE.Vector3(this.size/2,0,this.size/2);
    const span=this.pieces.length?Math.max(b.w,b.d,b.h*H,14):this.size;
    const distance=Math.max(span*1.9,26)*(this.camera.aspect<1?1/this.camera.aspect:1);
    const dirs={iso:[1,.85,1],top:[0,1,.001],front:[0,.08,1],right:[1,.08,0]};
    this.controls.target.copy(center);this.camera.position.copy(center).add(new THREE.Vector3(...dirs[type]).normalize().multiplyScalar(distance));this.controls.update();
  }
  zoom(factor){const offset=this.camera.position.clone().sub(this.controls.target);offset.multiplyScalar(factor);offset.clampLength(this.controls.minDistance,this.controls.maxDistance);this.camera.position.copy(this.controls.target).add(offset);this.controls.update();}
  toggleGrid(visible){this.grid.visible=visible;this.baseStuds.visible=visible;}
  capture(){
    const ghost=this.ghost?.visible,outline=this.outline?.visible;
    if(this.ghost)this.ghost.visible=false;if(this.outline)this.outline.visible=false;
    this.renderer.render(this.scene,this.camera);const url=this.renderer.domElement.toDataURL('image/png');
    if(this.ghost)this.ghost.visible=ghost;if(this.outline)this.outline.visible=outline;return url;
  }
  async exportGLB(){
    const group=new THREE.Group();
    // Normal meshes ensure portable GLB even in viewers without instancing support.
    for(const piece of this.pieces){
      const source=brickGroup(piece);source.updateMatrixWorld(true);
      source.traverse(o=>{
        if(o.isInstancedMesh){const m=new THREE.Matrix4();for(let i=0;i<o.count;i++){o.getMatrixAt(i,m);const mesh=new THREE.Mesh(o.geometry,o.material.clone());mesh.applyMatrix4(o.matrixWorld.clone().multiply(m));group.add(mesh);}}
        else if(o.isMesh){const mesh=new THREE.Mesh(o.geometry,o.material.clone());mesh.applyMatrix4(o.matrixWorld);group.add(mesh);}
      });disposeGroup(source);
    }
    // 1 stud = 8 mm; glTF units are metres.
    group.scale.setScalar(.008);
    try{return await new GLTFExporter().parseAsync(group,{binary:true});}finally{disposeGroup(group);}
  }
}

export function renderThumbnails(){
  const renderer=new THREE.WebGLRenderer({alpha:true,antialias:true});renderer.setSize(150,104);renderer.setPixelRatio(1.5);
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.3;
  const scene=new THREE.Scene();scene.add(new THREE.HemisphereLight('#ffffff','#718392',3));const light=new THREE.DirectionalLight('#ffffff',4);light.position.set(-3,8,5);scene.add(light);
  const camera=new THREE.OrthographicCamera(-4,4,2.8,-2.8,.1,100),result={};
  for(const part of PARTS){
    const p={id:'thumb',part:part.id,color:'#e8edf1',rotation:90,x:0,y:0,z:0};const {w,d,h}=dimensions(p),group=brickGroup(p);scene.add(group);
    const s=Math.max(w,d,3)*.68;camera.left=-s;camera.right=s;camera.top=s*104/150;camera.bottom=-camera.top;camera.updateProjectionMatrix();
    const center=new THREE.Vector3(w/2,h*H/2,d/2);camera.position.copy(center).add(new THREE.Vector3(8,7,10));camera.lookAt(center);renderer.render(scene,camera);result[part.id]=renderer.domElement.toDataURL();disposeGroup(group);
  }
  renderer.dispose();renderer.forceContextLoss();return result;
}
