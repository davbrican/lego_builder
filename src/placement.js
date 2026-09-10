import {PART_MAP,dimensions,MAX_PIECES,contactPoints,rotatePoint} from './catalog.js';

export function overlapXZ(a,b){
  const da=dimensions(a),db=dimensions(b);
  return a.x<b.x+db.w&&a.x+da.w>b.x&&a.z<b.z+db.d&&a.z+da.d>b.z;
}
const shapeCache=new Map();
function shape(piece){
  const key=`${piece.part}/${piece.rotation}`;
  if(shapeCache.has(key))return shapeCache.get(key);
  const part=PART_MAP[piece.part],map=new Map(),list=[];
  for(const [x,z,low,high] of part.columns){
    const point=rotatePoint([(x+.5)/4,0,(z+.5)/4],part,piece.rotation);
    const rx=Math.round(point[0]*4-.5),rz=Math.round(point[2]*4-.5);
    const column=[rx,rz,low,high];list.push(column);map.set(`${rx}/${rz}`,column);
  }
  const result={map,list};shapeCache.set(key,result);return result;
}
export function collides(a,b){
  if(!overlapXZ(a,b)||a.y>=b.y+dimensions(b).h-.002||b.y>=a.y+dimensions(a).h-.002)return false;
  let sa=shape(a),sb=shape(b);
  if(sa.list.length>sb.list.length){[a,b]=[b,a];[sa,sb]=[sb,sa];}
  const dx=Math.round((a.x-b.x)*4),dz=Math.round((a.z-b.z)*4);
  for(const [x,z,low,high] of sa.list){
    const other=sb.map.get(`${x+dx}/${z+dz}`);
    if(other&&a.y+low<b.y+other[3]-.002&&a.y+high>b.y+other[2]+.002)return true;
  }
  return false;
}
const contactKey=point=>point.map(n=>Math.round(n*1000)).join('/');
const connectionCache=new WeakMap();
function connections(pieces){
  if(connectionCache.has(pieces))return connectionCache.get(pieces);
  const top=new Map(),bottom=new Map(),linked=new Map(pieces.map(p=>[p.id,new Set()]));
  for(const piece of pieces)for(const [kind,map] of [['top',top],['bottom',bottom]]){
    for(const point of contactPoints(piece,kind)){
      const key=contactKey(point);if(!map.has(key))map.set(key,[]);map.get(key).push(piece.id);
    }
  }
  for(const [key,above] of bottom)for(const a of above)for(const b of top.get(key)||[]){
    if(a!==b){linked.get(a).add(b);linked.get(b).add(a);}
  }
  const connected=new Set(pieces.filter(p=>p.y===0).map(p=>p.id)),queue=[...connected];
  for(let i=0;i<queue.length;i++)for(const id of linked.get(queue[i]))if(!connected.has(id)){connected.add(id);queue.push(id);}
  const result={connected,top,bottom,linked};connectionCache.set(pieces,result);return result;
}
export function connectedIds(pieces){return connections(pieces).connected;}
// The base supports pieces, but never joins two separate assemblies.
export function assemblyIds(pieces,seedId){
  const {linked}=connections(pieces),ids=new Set();
  if(!linked.has(seedId))return ids;
  const queue=[seedId];ids.add(seedId);
  for(let i=0;i<queue.length;i++)for(const id of linked.get(queue[i]))if(!ids.has(id)){ids.add(id);queue.push(id);}
  return ids;
}
export function placementError(candidate,pieces,size,{allowFloating=false,ignoreId=null}={}){
  const d=dimensions(candidate);
  if(![candidate.x,candidate.y,candidate.z].every(n=>Number.isFinite(n)&&Number.isInteger(n*2)))return 'La posición debe coincidir con la cuadrícula de medio tetón o media placa.';
  if(candidate.x<0||candidate.z<0||candidate.x+d.w>size||candidate.z+d.d>size)return 'La pieza queda fuera de la base.';
  if(candidate.y<0||candidate.y+d.h>300)return 'Altura fuera de los límites (0–300 placas).';
  const others=ignoreId?pieces.filter(p=>p.id!==ignoreId):pieces;
  if(others.length>=MAX_PIECES)return `Has alcanzado el límite de ${MAX_PIECES} piezas.`;
  if(others.some(p=>collides(candidate,p)))return 'Esta posición está ocupada por otra pieza.';
  if(!allowFloating&&candidate.y===0&&PART_MAP[candidate.part].bottom.length){
    const aligned=contactPoints(candidate,'bottom').some(([x,,z])=>Number.isInteger(x-.5)&&Number.isInteger(z-.5));
    if(!aligned)return 'Los huecos deben alinearse con los tetones de la base.';
  }
  if(!allowFloating&&candidate.y>0){
    const {connected,top,bottom}=connections(others);
    const touches=contactPoints(candidate,'bottom').some(p=>(top.get(contactKey(p))||[]).some(id=>connected.has(id)))||
      contactPoints(candidate,'top').some(p=>(bottom.get(contactKey(p))||[]).some(id=>connected.has(id)));
    if(!touches)return PART_MAP[candidate.part].category==='Ruedas'?'Las ruedas no tienen tetones. Colócalas en la base o activa «Permitir piezas en el aire».':'Necesita alinear sus huecos con tetones reales. Puedes activar «Permitir piezas en el aire».';
  }
  return null;
}
export const GRAB_ANCHORS=[
  {id:'center',label:'Centro'},
  {id:'min-min',label:'Esquina X− Z−'},
  {id:'max-min',label:'Esquina X+ Z−'},
  {id:'max-max',label:'Esquina X+ Z+'},
  {id:'min-max',label:'Esquina X− Z+'},
];
export function grabPoint(template,anchor='center'){
  const part=PART_MAP[template.part],d=dimensions(template);
  const [sideX,sideZ]=anchor.split('-');
  const target=anchor==='center'?[d.w/2,0,d.d/2]:[sideX==='min'?.5:d.w-.5,0,sideZ==='min'?.5:d.d-.5];
  const receivers=part.bottom.map(p=>rotatePoint(p,part,template.rotation));
  if(!receivers.length)return target;
  return receivers.reduce((a,b)=>Math.hypot(a[0]-target[0],a[2]-target[2])<=Math.hypot(b[0]-target[0],b[2]-target[2])?a:b);
}
export function candidateFromHit(template,hit,{anchor='center'}={}){
  const part=PART_MAP[template.part],d=dimensions(template);
  const result={...template,x:Math.floor(hit.point.x)-Math.floor(d.w/2),z:Math.floor(hit.point.z)-Math.floor(d.d/2),y:hit.layer??0};
  const grip=grabPoint(template,anchor);
  if(hit.layer!==undefined){result.x=Math.round((hit.point.x-(anchor==='center'?d.w/2:grip[0]))*2)/2;result.z=Math.round((hit.point.z-(anchor==='center'?d.d/2:grip[2]))*2)/2;return result;}
  if(!hit.piece){
    if(anchor!=='center')return {...result,x:Math.floor(hit.point.x)+.5-grip[0],z:Math.floor(hit.point.z)+.5-grip[2]};
    const socket=contactPoints({...template,x:0,y:0,z:0},'bottom')[0];
    if(socket){result.x+=.5-((socket[0]%1)+1)%1;result.z+=.5-((socket[2]%1)+1)%1;}
    return result;
  }
  const studs=contactPoints(hit.piece,'top');
  const receivers=part.bottom.map(p=>rotatePoint(p,part,template.rotation));
  if(studs.length&&receivers.length){
    const nearest=studs.reduce((a,b)=>Math.hypot(a[0]-hit.point.x,a[2]-hit.point.z)<=Math.hypot(b[0]-hit.point.x,b[2]-hit.point.z)?a:b);
    return {...result,x:nearest[0]-grip[0],y:nearest[1]-grip[1],z:nearest[2]-grip[2]};
  }
  result.y=hit.piece.y+dimensions(hit.piece).h;return result;
}
