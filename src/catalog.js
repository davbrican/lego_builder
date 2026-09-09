import parts from './generated/parts.json' with {type:'json'};

export const PARTS=parts;
export const PART_MAP=Object.fromEntries(PARTS.map(part=>[part.id,part]));
export const CATEGORIES=['Todas',...new Set(PARTS.map(part=>part.category))];
export const PLATE_HEIGHT=.4;
export const MAX_PIECES=2000;
export const FORMAT_VERSION=2;
export function dimensions(piece){
  const part=PART_MAP[piece.part];
  return piece.rotation%180===0?{w:part.w,d:part.d,h:part.h}:{w:part.d,d:part.w,h:part.h};
}
export function rotatePoint([x,y,z],part,rotation){
  switch(rotation){
    case 90:return [part.d-z,y,x];
    case 180:return [part.w-x,y,part.d-z];
    case 270:return [z,y,part.w-x];
    default:return [x,y,z];
  }
}
export function contactPoints(piece,type='top'){
  const part=PART_MAP[piece.part];
  return part[type].map(point=>{const [x,y,z]=rotatePoint(point,part,piece.rotation);return [x+piece.x,y+piece.y,z+piece.z];});
}
const normalize=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s*[x×]\s*/g,'x').replace(/\s+/g,' ').trim();
export function searchParts(query='',category='Todas'){
  const tokens=normalize(query).split(' ').filter(Boolean);
  return PARTS.filter(part=>(category==='Todas'||part.category===category)&&tokens.every(token=>normalize(`${part.id} ${part.name} ${part.description} ${part.category}`).includes(token)));
}
export const COLORS = [
  {name:'Rojo',hex:'#c73536'}, {name:'Naranja',hex:'#ed8537'},
  {name:'Amarillo',hex:'#f5ca43'}, {name:'Crema',hex:'#e6d4af'},
  {name:'Verde',hex:'#32926b'}, {name:'Verde bosque',hex:'#226454'},
  {name:'Azul',hex:'#3475bd'}, {name:'Azul cielo',hex:'#77bed9'},
  {name:'Azul noche',hex:'#243c65'}, {name:'Morado',hex:'#8456a4'},
  {name:'Rosa',hex:'#de86b0'}, {name:'Marrón',hex:'#805441'},
  {name:'Blanco',hex:'#f2f0e8'}, {name:'Gris claro',hex:'#aeb7bb'},
  {name:'Gris oscuro',hex:'#5b636b'}, {name:'Negro',hex:'#252a31'},
];
