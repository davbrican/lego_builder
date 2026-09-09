import {PART_MAP, dimensions, MAX_PIECES} from './catalog.js';

export const uid = () => globalThis.crypto?.randomUUID?.() ?? `b-${Date.now()}-${Math.random().toString(36).slice(2)}`;
export const overlapXZ = (a,b) => {
  const da=dimensions(a), db=dimensions(b);
  return a.x < b.x+db.w && a.x+da.w > b.x && a.z < b.z+db.d && a.z+da.d > b.z;
};
export const collides = (a,b) => overlapXZ(a,b) && a.y < b.y+dimensions(b).h && a.y+dimensions(a).h > b.y;

const connectionCache=new WeakMap();
export function connectedIds(pieces) {
  if(connectionCache.has(pieces)) return connectionCache.get(pieces);
  // Contact only transmits through studs. Side contact alone is not an attachment.
  // Flood the undirected attachment graph from the base (also supports overhangs).
  const linked=new Map(pieces.map(p=>[p.id,[]]));
  for(let i=0;i<pieces.length;i++) for(let j=i+1;j<pieces.length;j++) {
    const a=pieces[i], b=pieces[j];
    if(!overlapXZ(a,b)) continue;
    if((a.y+dimensions(a).h===b.y && PART_MAP[a.part].studs) || (b.y+dimensions(b).h===a.y && PART_MAP[b.part].studs)) {
      linked.get(a.id).push(b.id); linked.get(b.id).push(a.id);
    }
  }
  const seen=new Set(pieces.filter(p=>p.y===0).map(p=>p.id)), queue=[...seen];
  for(let i=0;i<queue.length;i++) for(const id of linked.get(queue[i])) if(!seen.has(id)){seen.add(id);queue.push(id);}
  connectionCache.set(pieces,seen);return seen;
}

export function placementError(candidate,pieces,size,{allowFloating=false,ignoreId=null}={}) {
  const d=dimensions(candidate);
  if(![candidate.x,candidate.y,candidate.z].every(Number.isInteger)) return 'La posición debe coincidir con la cuadrícula.';
  if(candidate.x<0 || candidate.z<0 || candidate.x+d.w>size || candidate.z+d.d>size) return 'La pieza queda fuera de la base.';
  if(candidate.y<0 || candidate.y+d.h>300) return 'Altura fuera de los límites (0–300 placas).';
  const others=ignoreId?pieces.filter(p=>p.id!==ignoreId):pieces;
  if(others.length>=MAX_PIECES) return `Has alcanzado el límite de ${MAX_PIECES} piezas.`;
  if(others.some(p=>collides(candidate,p))) return 'Esta posición está ocupada por otra pieza.';
  if(!allowFloating && candidate.y>0){
    const supported=connectedIds(others);
    const touches=others.some(p=>supported.has(p.id) && overlapXZ(candidate,p) &&
      ((p.y+dimensions(p).h===candidate.y && PART_MAP[p.part].studs) ||
       (candidate.y+d.h===p.y && PART_MAP[candidate.part].studs)));
    if(!touches) return 'Necesita encajar en una pieza con tetones. Puedes activar «Permitir piezas en el aire».';
  }
  return null;
}

export function parseProject(raw) {
  if(!raw || raw.format!=='bricklab' || raw.version!==1) throw new Error('El archivo no es un proyecto Bricklab compatible (versión 1).');
  if(typeof raw.name!=='string' || !raw.name.trim() || raw.name.length>100) throw new Error('El nombre del proyecto no es válido.');
  if(![16,32,48,64].includes(raw.size)) throw new Error('El tamaño de la base no es válido.');
  if(!Array.isArray(raw.pieces) || raw.pieces.length>MAX_PIECES) throw new Error(`El proyecto admite hasta ${MAX_PIECES} piezas.`);
  const ids=new Set(), pieces=[];
  for(const p of raw.pieces){
    if(!p || typeof p.id!=='string' || !p.id || p.id.length>100 || ids.has(p.id) || typeof p.part!=='string' || !Object.hasOwn(PART_MAP,p.part) ||
      ![0,90,180,270].includes(p.rotation) || typeof p.color!=='string' || !/^#[0-9a-f]{6}$/i.test(p.color)) throw new Error('El archivo contiene una pieza no válida o un identificador repetido.');
    const clean={id:p.id,part:p.part,color:p.color,rotation:p.rotation,x:p.x,y:p.y,z:p.z};
    const error=placementError(clean,pieces,raw.size,{allowFloating:true});
    if(error) throw new Error(`Proyecto no válido: ${error}`);
    ids.add(p.id); pieces.push(clean);
  }
  return {format:'bricklab',version:1,name:raw.name.trim(),size:raw.size,pieces};
}

export function inventory(pieces){
  const rows=new Map();
  for(const p of pieces){const k=p.part+p.color; const row=rows.get(k); if(row) row.count++; else rows.set(k,{part:p.part,color:p.color,count:1});}
  return [...rows.values()].sort((a,b)=>a.part.localeCompare(b.part)||a.color.localeCompare(b.color));
}

export function bounds(pieces){
  if(!pieces.length) return {x:0,y:0,z:0,w:0,h:0,d:0};
  const min={x:Infinity,y:Infinity,z:Infinity},max={x:-Infinity,y:-Infinity,z:-Infinity};
  for(const p of pieces){const d=dimensions(p);min.x=Math.min(min.x,p.x);min.y=Math.min(min.y,p.y);min.z=Math.min(min.z,p.z);max.x=Math.max(max.x,p.x+d.w);max.y=Math.max(max.y,p.y+d.h);max.z=Math.max(max.z,p.z+d.d);}
  return {...min,w:max.x-min.x,h:max.y-min.y,d:max.z-min.z};
}

export class History {
  constructor(limit=80){this.limit=limit;this.past=[];this.future=[];}
  record(state){this.past.push(structuredClone(state));if(this.past.length>this.limit)this.past.shift();this.future=[];}
  undo(state){if(!this.past.length)return null;this.future.push(structuredClone(state));return this.past.pop();}
  redo(state){if(!this.future.length)return null;this.past.push(structuredClone(state));return this.future.pop();}
}

export function demoProject(){
  const pieces=[];
  const add=(part,color,x,y,z,rotation=0)=>pieces.push({id:uid(),part,color,x,y,z,rotation});
  // A small garden pavilion: supports, open doorway, flat roof and a red tower.
  add('plate-8x8','#e6d4af',12,0,12);
  for(let y=1;y<10;y+=3){
    add('brick-2x6','#f2f0e8',12,y,12,90);
    add('brick-2x6','#f2f0e8',12,y,14);
    add('brick-2x6','#f2f0e8',18,y,12);
    add('brick-2x2','#f2f0e8',14,y,18);
    add('brick-2x2','#f2f0e8',18,y,18);
  }
  add('plate-8x8','#243c65',12,10,12);
  add('plate-8x8','#243c65',12,11,12);
  for(let y=12;y<18;y+=3) add('brick-2x2','#c73536',15,y,14);
  add('tile-2x2','#f5ca43',15,18,14);
  for(let z=20;z<26;z+=2)add('tile-2x2','#aeb7bb',16,0,z);
  for(const [x,z] of [[7,14],[22,18]]){
    add('plate-4x4','#32926b',x,0,z);
    add('brick-2x2','#805441',x+1,1,z+1);
    add('brick-2x4','#226454',x,4,z+1,90);
    add('brick-2x2','#32926b',x+1,7,z+1);
  }
  return {format:'bricklab',version:1,name:'El pequeño pabellón',size:32,pieces};
}
