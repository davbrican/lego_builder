import {contactPoints,dimensions,PLATE_HEIGHT,MAX_PIECES} from './catalog.js';
import {assemblyIds,connectedIds,placementError} from './placement.js';
import {MECHANICAL_PARTS,mechanicalCandidates} from './mechanical.js';

export {assemblyIds};
export const half=n=>Math.round(n*2)/2;
export function translateAssembly(pieces,delta){
  return pieces.map(p=>({...p,x:p.x+delta.x,y:p.y+delta.y,z:p.z+delta.z}));
}
// Positive turns use the same clockwise convention as single-piece rotation.
// Rotate bounding-box corners as well as orientations, keeping the assembly rigid.
export function rotateAssembly(pieces,turns,pivot){
  const count=((turns%4)+4)%4;
  return pieces.map(p=>{
    const d=dimensions(p),corners=[[p.x,p.z],[p.x+d.w,p.z],[p.x,p.z+d.d],[p.x+d.w,p.z+d.d]];
    const rotated=corners.map(([x,z])=>{
      x-=pivot.x;z-=pivot.z;
      for(let i=0;i<count;i++)[x,z]=[-z,x];
      return [x+pivot.x,z+pivot.z];
    });
    return {...p,x:Math.min(...rotated.map(c=>c[0])),z:Math.min(...rotated.map(c=>c[1])),rotation:(p.rotation+count*90)%360};
  });
}
export function assemblyPlacementError(group,others,size,{allowFloating=false}={}){
  if(!group.length)return 'No hay ningún conjunto seleccionado.';
  if(group.length+others.length>MAX_PIECES)return `El proyecto admite ${MAX_PIECES} piezas.`;
  for(const piece of group){
    const error=placementError(piece,others,size,{allowFloating:true});
    if(error)return error;
    if(!allowFloating&&piece.y===0){
      const baseError=placementError(piece,[],size);
      if(baseError)return baseError;
    }
  }
  if(!allowFloating){
    const grounded=connectedIds([...others,...group]);
    if(group.some(p=>!grounded.has(p.id)))return 'El conjunto necesita encajar en la base o en otra construcción. Puedes permitir piezas en el aire en los ajustes.';
  }
  return null;
}
const key=p=>p.map(Math.floor).join('/');
const world=([x,y,z])=>[x,y*PLATE_HEIGHT,z];

// Spatial buckets bound the nearby connector search; never choose an arbitrary
// distant stud or a colliding candidate merely because its connector is closest.
export function snapAssembly(group,others,size,options={}){
  const radius=.7,buckets={top:new Map(),bottom:new Map()};
  for(const piece of others)for(const type of ['top','bottom'])for(const point of contactPoints(piece,type)){
    const k=key(world(point)),bucket=buckets[type];
    if(!bucket.has(k))bucket.set(k,[]);
    bucket.get(k).push({point,id:piece.id});
  }
  const proposals=new Map();
  for(const piece of group.filter(p=>MECHANICAL_PARTS[p.part]))for(const target of others.filter(p=>MECHANICAL_PARTS[p.part])){
    for(const option of mechanicalCandidates(piece,target)){
      const delta={x:option.piece.x-piece.x,y:option.piece.y-piece.y,z:option.piece.z-piece.z};
      const distance=Math.hypot(delta.x,delta.y*PLATE_HEIGHT,delta.z);
      if(distance>radius)continue;
      proposals.set(`${delta.x}/${delta.y}/${delta.z}`,{delta,distance,targetId:target.id});
    }
  }
  for(const piece of group)for(const type of ['top','bottom'])for(const point of contactPoints(piece,type)){
    const origin=world(point),cell=origin.map(Math.floor),bucket=buckets[type==='top'?'bottom':'top'];
    for(let x=-1;x<=1;x++)for(let y=-1;y<=1;y++)for(let z=-1;z<=1;z++){
      for(const target of bucket.get(`${cell[0]+x}/${cell[1]+y}/${cell[2]+z}`)||[]){
        const delta={x:target.point[0]-point[0],y:target.point[1]-point[1],z:target.point[2]-point[2]};
        const distance=Math.hypot(delta.x,delta.y*PLATE_HEIGHT,delta.z);
        if(distance>radius||![delta.x,delta.y,delta.z].every(n=>Number.isInteger(n*2)))continue;
        const k=`${delta.x}/${delta.y}/${delta.z}`;
        if(!proposals.has(k))proposals.set(k,{delta,distance,targetId:target.id});
      }
    }
  }
  for(const proposal of [...proposals.values()].sort((a,b)=>a.distance-b.distance)){
    const pieces=translateAssembly(group,proposal.delta);
    if(!assemblyPlacementError(pieces,others,size,options))return {...proposal,pieces};
  }
  return null;
}

// A draft owns copies. Nothing reaches history/autosave until explicit commit.
export class AssemblyDraft {
  constructor(pieces,seedId){
    this.ids=assemblyIds(pieces,seedId);
    this.original=pieces.filter(p=>this.ids.has(p.id)).map(p=>({...p}));
    this.pieces=this.original.map(p=>({...p}));
    this.others=pieces.filter(p=>!this.ids.has(p.id));
  }
  result(project,pieces=this.pieces){
    const replacements=new Map(pieces.map(p=>[p.id,p]));
    return {...project,pieces:project.pieces.map(p=>replacements.get(p.id)||p)};
  }
}
