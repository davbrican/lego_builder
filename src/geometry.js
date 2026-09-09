import {BufferGeometry,Float32BufferAttribute,Mesh,MeshStandardMaterial,Group} from 'three';
import {PART_MAP,PLATE_HEIGHT} from './catalog.js';

const geometries=new Map(),pending=new Map();
let readGeometry=async part=>{
  const response=await fetch(`${part.geometry}?v=${part.sha256.slice(0,12)}`);
  if(!response.ok)throw new Error(`No se pudo cargar la pieza ${part.id}.`);
  return response.json();
};
// The same geometry pipeline can read local files in tests or a Node exporter.
export function setGeometryReader(reader){readGeometry=reader;}
export const hasGeometry=id=>geometries.has(id);
export function decodeGeometry(data){
  if(data.version!==1||!Array.isArray(data.position)||data.position.length!==data.normal?.length||data.position.length%3||!Array.isArray(data.index))throw new Error('Geometría de pieza no válida.');
  const geometry=new BufferGeometry();
  geometry.setAttribute('position',new Float32BufferAttribute(data.position,3));
  geometry.setAttribute('normal',new Float32BufferAttribute(data.normal.map(n=>n/32767),3));
  geometry.setIndex(data.index);geometry.computeBoundingBox();geometry.computeBoundingSphere();
  return geometry;
}
export async function ensureGeometry(id){
  if(geometries.has(id))return geometries.get(id);
  if(pending.has(id))return pending.get(id);
  const part=PART_MAP[id];if(!part)throw new Error('Referencia desconocida.');
  const job=(async()=>{
    let data;
    data=await readGeometry(part);
    const geometry=decodeGeometry(data);geometries.set(id,geometry);return geometry;
  })();
  pending.set(id,job);
  try{return await job;}finally{pending.delete(id);}
}
export async function ensureGeometries(ids){await Promise.all([...new Set(ids)].map(ensureGeometry));}
export function brickGroup(piece,{ghost=false,valid=true}={}){
  const geometry=geometries.get(piece.part);if(!geometry)throw new Error(`La geometría ${piece.part} aún no está cargada.`);
  const part=PART_MAP[piece.part];
  const material=new MeshStandardMaterial({color:ghost?(valid?'#72bb82':'#ef6867'):piece.color,roughness:.29,metalness:.015,transparent:ghost,opacity:ghost?.48:1,depthWrite:!ghost});
  const mesh=new Mesh(geometry,material),group=new Group();
  mesh.rotation.y=-piece.rotation*Math.PI/180;
  const offsets={0:[0,0],90:[part.d,0],180:[part.w,part.d],270:[0,part.w]};
  const [x,z]=offsets[piece.rotation];mesh.position.set(x,0,z);
  mesh.castShadow=!ghost;mesh.receiveShadow=true;mesh.userData.pieceId=piece.id;
  group.add(mesh);group.position.set(piece.x,piece.y*PLATE_HEIGHT,piece.z);group.userData.pieceId=piece.id;
  return group;
}
export function disposeGroup(group){
  const materials=new Set();group.traverse(o=>{if(o.material)for(const m of [].concat(o.material))materials.add(m);});
  materials.forEach(m=>m.dispose());group.removeFromParent();
}
