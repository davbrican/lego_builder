export const PARTS = [
  ...[[1,1],[1,2],[1,3],[1,4],[1,6],[1,8],[2,2],[2,3],[2,4],[2,6],[2,8]].map(([w,d]) => ({id:`brick-${w}x${d}`, name:`Ladrillo ${w} × ${d}`, category:'Ladrillos', w,d,h:3, studs:true})),
  ...[[1,1],[1,2],[1,4],[2,2],[2,3],[2,4],[2,6],[4,4],[4,6],[6,6],[8,8]].map(([w,d]) => ({id:`plate-${w}x${d}`, name:`Placa ${w} × ${d}`, category:'Placas', w,d,h:1, studs:true})),
  ...[[1,1],[1,2],[1,4],[2,2],[2,4]].map(([w,d]) => ({id:`tile-${w}x${d}`, name:`Baldosa ${w} × ${d}`, category:'Baldosas', w,d,h:1, studs:false})),
];
export const PART_MAP = Object.fromEntries(PARTS.map(p=>[p.id,p]));
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
export const PLATE_HEIGHT = 0.4;
export const MAX_PIECES = 2000;
export const dimensions = piece => {
  const part = PART_MAP[piece.part];
  return piece.rotation % 180 === 0 ? {w:part.w,d:part.d,h:part.h} : {w:part.d,d:part.w,h:part.h};
};
