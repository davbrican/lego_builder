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
  const result={connected,top,bottom};connectionCache.set(pieces,result);return result;
}
export function connectedIds(pieces){return connections(pieces).connected;}
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
export function candidateFromHit(template,hit){
  const part=PART_MAP[template.part],d=dimensions(template);
  const result={...template,x:Math.floor(hit.point.x)-Math.floor(d.w/2),z:Math.floor(hit.point.z)-Math.floor(d.d/2),y:hit.layer??0};
  if(hit.layer!==undefined){result.x=Math.round((hit.point.x-d.w/2)*2)/2;result.z=Math.round((hit.point.z-d.d/2)*2)/2;return result;}
  if(!hit.piece)return result;
  const studs=contactPoints(hit.piece,'top');
  const receivers=part.bottom.map(p=>rotatePoint(p,part,template.rotation));
  if(studs.length&&receivers.length){
    const nearest=studs.reduce((a,b)=>Math.hypot(a[0]-hit.point.x,a[2]-hit.point.z)<=Math.hypot(b[0]-hit.point.x,b[2]-hit.point.z)?a:b);
    const anchor=receivers.reduce((a,b)=>Math.hypot(a[0]-d.w/2,a[2]-d.d/2)<=Math.hypot(b[0]-d.w/2,b[2]-d.d/2)?a:b);
    return {...result,x:nearest[0]-anchor[0],y:nearest[1],z:nearest[2]-anchor[2]};
  }
  result.y=hit.piece.y+dimensions(hit.piece).h;return result;
}
