import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {Box3,Vector3} from 'three';
import {PARTS,PART_MAP,CATEGORIES,searchParts,dimensions,contactPoints} from '../src/catalog.js';
import {placementError,collides,candidateFromHit,connectedIds} from '../src/placement.js';
import {setGeometryReader,ensureGeometry,brickGroup,disposeGroup} from '../src/geometry.js';
import {pngWithAttribution,modelAttribution} from '../src/attribution.js';
setGeometryReader(async part=>JSON.parse(await readFile(new URL(`../public${part.geometry}`,import.meta.url),'utf8')));
const p=(part,overrides={})=>({id:part,part,color:'#c73536',x:0,y:0,z:0,rotation:0,...overrides});

test('all 181 references have verified local geometry, normals, profiles and attribution',async()=>{
  assert.equal(PARTS.length,181);assert.equal(new Set(PARTS.map(p=>p.id)).size,181);assert.equal(CATEGORIES.length,15);
  const attribution=JSON.parse(await readFile(new URL('../public/ldraw/attribution.json',import.meta.url),'utf8'));
  assert.equal(attribution.parts.length,PARTS.length);
  for(const part of PARTS){
    const bytes=await readFile(new URL(`../public${part.geometry}`,import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'),part.sha256,part.id);
    const data=JSON.parse(bytes);
    assert.ok(data.position.length>0&&data.position.every(Number.isFinite));
    assert.ok(data.index.length%3===0&&data.index.every(i=>Number.isInteger(i)&&i>=0&&i<data.position.length/3));
    assert.ok(data.normal.every(n=>Number.isInteger(n)&&Math.abs(n)<=32767));
    assert.ok(part.columns.length>0&&part.columns.every(c=>c[0]>=0&&c[0]<part.w*4&&c[1]>=0&&c[1]<part.d*4&&c[2]<c[3]));
    assert.ok(part.authors.length&&part.licenses.length,part.id);
    const onBase=candidateFromHit(p(part.id),{point:{x:16,z:16}});
    assert.equal(placementError(onBase,[],64),null,part.id);
    await ensureGeometry(part.id);
    for(const rotation of [0,90,180,270]){
      const piece=p(part.id,{rotation}),group=brickGroup(piece),box=new Box3().setFromObject(group),size=dimensions(piece);
      assert.ok(box.min.x>=-.001&&box.min.z>=-.001&&box.min.y>=-.001,part.id);
      assert.ok(box.max.x<=size.w+.001&&box.max.z<=size.d+.001,part.id);
      disposeGroup(group);
    }
  }
});
test('catalogue searches references, dimensions, Spanish and English names with category filters',()=>{
  assert.ok(searchParts('3039').some(p=>p.id==='3039'));
  assert.ok(searchParts('2x4','Ladrillos').some(p=>p.id==='3001'));
  assert.ok(searchParts('curva').some(p=>p.id==='11477'));
  assert.ok(searchParts('Slope 2 x 2').some(p=>p.id==='3039'));
  assert.deepEqual(searchParts('does-not-exist'),[]);
  assert.ok(searchParts('','Ruedas').every(p=>p.category==='Ruedas'));
});
test('arches and corner bricks keep their empty space and still reject occupied material',()=>{
  const arch=p('3307');
  assert.equal(collides(arch,p('3005',{x:2})),false);
  assert.equal(placementError(p('3005',{x:2}),[arch],32),null);
  assert.equal(collides(arch,p('3005',{x:2,y:4})),true);
  assert.equal(collides(arch,p('3005')),true);
  assert.equal(collides(p('2357'),p('3005',{x:1})),false);
  assert.equal(collides(p('2357'),p('3005',{x:1,z:1})),true);
  assert.equal(PART_MAP['3659'].bottom.length,2);
});
test('slopes attach only at actual studs and rotated contact locations follow the geometry',()=>{
  const slope=p('3039');
  assert.equal(placementError(p('3005',{y:3}),[slope],32),null);
  assert.match(placementError(p('3005',{y:3,z:1}),[slope],32),/tetones/);
  const rotated={...slope,rotation:90};
  assert.deepEqual(contactPoints(rotated),[[1.5,3,.5],[1.5,3,1.5]]);
  assert.equal(placementError(p('3005',{x:1,y:3}),[rotated],32),null);
  assert.equal(PART_MAP['11477'].top.length,0);
});
test('central studs snap to half-stud offsets and do not invent connections on a smooth surface',()=>{
  const cone=p('3942c');
  const candidate=candidateFromHit(p('3005'),{piece:cone,point:{x:1,y:2.4,z:1}});
  assert.deepEqual([candidate.x,candidate.y,candidate.z],[.5,6,.5]);
  assert.equal(placementError(candidate,[cone],32),null);
  assert.equal(connectedIds([cone,candidate]).size,2);
  assert.match(placementError({...candidate,y:0},[],32),/alinearse/);
  assert.match(placementError(p('3005',{y:1}),[p('98138')],32),/tetones/);
});
test('window inline studs remain usable and wheels require free placement above the base',()=>{
  const window=p('60594');
  assert.equal(PART_MAP['60594'].top.length,4);
  assert.equal(placementError(p('3010',{y:9}),[window],32),null);
  assert.match(placementError(p('3482',{y:3}),[],32),/ruedas/);
  assert.equal(placementError(p('3482',{y:3}),[],32,{allowFloating:true}),null);
});
test('exported PNG carries UTF-8 creator, source and licence metadata',async()=>{
  const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aVZsAAAAASUVORK5CYII=';
  const metadata=modelAttribution([p('3001'),p('3001',{id:'another'})]);
  assert.equal(metadata.parts.length,1);
  const buffer=await pngWithAttribution(image,metadata).arrayBuffer();
  const bytes=new Uint8Array(buffer),view=new DataView(buffer);let offset=8,found=false;
  while(offset<bytes.length){
    const size=view.getUint32(offset),type=new TextDecoder().decode(bytes.subarray(offset+4,offset+8));
    if(type==='iTXt'){
      const text=new TextDecoder().decode(bytes.subarray(offset+8,offset+8+size));
      assert.ok(text.includes('James Jessiman')&&text.includes('creativecommons.org')&&text.includes('3001.dat'));found=true;
    }
    offset+=size+12;
  }
  assert.ok(found);assert.equal(offset,bytes.length);
});
