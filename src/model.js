import {PART_MAP, dimensions, MAX_PIECES, FORMAT_VERSION} from './catalog.js';

import {placementError} from './placement.js';
export {placementError,collides,overlapXZ,connectedIds,candidateFromHit} from './placement.js';

export const uid = () => globalThis.crypto?.randomUUID?.() ?? `b-${Date.now()}-${Math.random().toString(36).slice(2)}`;
export function parseProject(raw) {
  if(!raw || raw.format!=='bricklab' || raw.version!==FORMAT_VERSION) throw new Error('El archivo no es un proyecto Bricklab compatible (versión 2, catálogo LDraw).');
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
  return {format:'bricklab',version:FORMAT_VERSION,name:raw.name.trim(),size:raw.size,pieces};
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
  add('41539','#e6d4af',12,0,12);
  for(let y=1;y<10;y+=3){
    add('2456','#f2f0e8',12,y,12);
    add('2456','#f2f0e8',12,y,14,90);
    add('2456','#f2f0e8',18,y,12,90);
    add('3003','#f2f0e8',14,y,18);
    add('3003','#f2f0e8',18,y,18);
  }
  add('41539','#243c65',12,10,12);
  add('41539','#243c65',12,11,12);
  for(let y=12;y<18;y+=3) add('3003','#c73536',15,y,14);
  add('3068b','#f5ca43',15,18,14);
  for(let z=20;z<26;z+=2)add('3068b','#aeb7bb',16,0,z);
  for(const [x,z] of [[7,14],[22,18]]){
    add('3031','#32926b',x,0,z);
    add('3003','#805441',x+1,1,z+1);
    add('3001','#226454',x,4,z+1);
    add('3003','#32926b',x+1,7,z+1);
  }
  return {format:'bricklab',version:FORMAT_VERSION,name:'El pequeño pabellón',size:32,pieces};
}
