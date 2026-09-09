import {PART_MAP} from './catalog.js';

export function modelAttribution(pieces){
  return {
    library:'LDraw.org Parts Library',release:'2026-08',
    licenseUrls:['https://creativecommons.org/licenses/by/2.0/','https://creativecommons.org/licenses/by/4.0/'],
    modifications:'Triangulated, indexed, rescaled and recoloured in Bricklab; edge lines omitted.',
    parts:[...new Set(pieces.map(p=>p.part))].map(id=>{
      const {sourceUrl,authors,licenses}=PART_MAP[id];return {id,sourceUrl,authors,licenses};
    }),
  };
}

// Preserve the full attribution in the PNG itself, even after it leaves the app.
// iTXt is a standard uncompressed UTF-8 PNG metadata chunk.
export function pngWithAttribution(dataUrl,metadata){
  const png=Uint8Array.from(atob(dataUrl.split(',')[1]),c=>c.charCodeAt(0));
  const text=new TextEncoder().encode('LDraw attribution\0\0\0\0\0'+JSON.stringify(metadata));
  const type=new TextEncoder().encode('iTXt');
  const chunk=new Uint8Array(text.length+12),view=new DataView(chunk.buffer);
  view.setUint32(0,text.length);chunk.set(type,4);chunk.set(text,8);
  let crc=0xffffffff;
  for(const byte of chunk.subarray(4,chunk.length-4)){
    crc^=byte;for(let bit=0;bit<8;bit++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);
  }
  view.setUint32(chunk.length-4,(crc^0xffffffff)>>>0);
  return new Blob([png.subarray(0,png.length-12),chunk,png.subarray(png.length-12)],{type:'image/png'});
}
