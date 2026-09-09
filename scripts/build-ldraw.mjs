/** Bake the reviewed LDraw source bundle into local, indexed render geometry.
 * No browser, external service or network is needed. Original attribution is retained.
 * Coordinate conversion: 20 LDU = 1 stud; 8 LDU = 1 plate.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {LDrawLoader} from 'three/addons/loaders/LDrawLoader.js';
import {LDrawConditionalLineMaterial} from 'three/addons/materials/LDrawConditionalLineMaterial.js';
import {mergeGeometries, mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const bundle=JSON.parse(await fs.readFile(path.join(ROOT,'scripts/ldraw-sources.json'),'utf8'));
const output=path.join(ROOT,'public/ldraw/geometry');
await fs.mkdir(output,{recursive:true});
const isStud=name=>/^p\/stud(?:2a?|10|15)?\.dat$/.test(name);
const round=(n,d=4)=>Number(n.toFixed(d));
const references=text=>text.split('\n').filter(l=>l.startsWith('1 ')).map(l=>l.trim().split(/\s+/));
function closure(root){
  const visited=new Set();
  function visit(name){if(visited.has(name))return;if(!bundle.files[name])throw new Error(`Missing ${name}`);visited.add(name);for(const t of references(bundle.files[name]))visit(t[14]);}
  visit(root);return [...visited];
}
function localMatrix(t){return new THREE.Matrix4().set(+t[5],+t[6],+t[7],+t[2],+t[8],+t[9],+t[10],+t[3],+t[11],+t[12],+t[13],+t[4],0,0,0,1);}
function studPoints(root){
  const points=[];
  function visit(name,matrix){
    if(isStud(name)){
      const normal=new THREE.Vector3(0,-1,0).transformDirection(matrix);
      if(normal.y<-.999)points.push(new THREE.Vector3().applyMatrix4(matrix));
      return;
    }
    for(const t of references(bundle.files[name]))visit(t[14],matrix.clone().multiply(localMatrix(t)));
  }
  visit(root,new THREE.Matrix4());return points;
}
async function parse(root,files,bodyOnly=false){
  const text=files.map(file=>`0 FILE ${file}\n`+bundle.files[file].split('\n').filter(line=>{
    const t=line.split(/\s+/);return !bodyOnly || t[0]!=='1' || !isStud(t[14]);
  }).join('\n')).join('\n');
  const loader=new LDrawLoader().setConditionalLineMaterial(LDrawConditionalLineMaterial);
  loader.addDefaultMaterials();
  const group=await new Promise((resolve,reject)=>loader.parse(text,resolve,reject));
  group.updateMatrixWorld(true);
  const geometries=[];
  group.traverse(node=>{
    if(!node.isMesh)return;
    const geometry=node.geometry.clone().applyMatrix4(node.matrixWorld);
    for(const attribute of Object.keys(geometry.attributes))if(!['position','normal'].includes(attribute))geometry.deleteAttribute(attribute);
    geometries.push(geometry.index?geometry.toNonIndexed():geometry);
  });
  if(!geometries.length)throw new Error(`No geometry for ${root}`);
  const merged=mergeGeometries(geometries,false);
  geometries.forEach(g=>g.dispose());
  return merged;
}

// Clip triangles to quarter-stud columns, retaining the external vertical envelope.
// This is conservative (e.g. lateral Technic holes are not axle connections), but
// unlike bounding boxes it keeps the space under arches and beside slopes empty.
function clip(vertices,axis,limit,keepGreater){
  const result=[];
  for(let i=0;i<vertices.length;i++){
    const a=vertices[i],b=vertices[(i+1)%vertices.length];
    const insideA=keepGreater?a[axis]>=limit:a[axis]<=limit;
    const insideB=keepGreater?b[axis]>=limit:b[axis]<=limit;
    if(insideA)result.push(a);
    if(insideA!==insideB){const t=(limit-a[axis])/(b[axis]-a[axis]);result.push(a.map((v,j)=>v+t*(b[j]-v)));}
  }
  return result;
}
function columns(geometry,w,d){
  const map=new Map(),pos=geometry.attributes.position;
  for(let i=0;i<pos.count;i+=3){
    const triangle=[0,1,2].map(j=>[pos.getX(i+j),pos.getY(i+j)/.4,pos.getZ(i+j)]);
    const x0=Math.max(0,Math.floor(Math.min(...triangle.map(v=>v[0]))*4));
    const x1=Math.min(w*4-1,Math.ceil(Math.max(...triangle.map(v=>v[0]))*4)-1);
    const z0=Math.max(0,Math.floor(Math.min(...triangle.map(v=>v[2]))*4));
    const z1=Math.min(d*4-1,Math.ceil(Math.max(...triangle.map(v=>v[2]))*4)-1);
    for(let x=x0;x<=x1;x++)for(let z=z0;z<=z1;z++){
      let polygon=clip(triangle,0,x/4+.00001,true);
      polygon=clip(polygon,0,(x+1)/4-.00001,false);
      polygon=clip(polygon,2,z/4+.00001,true);
      polygon=clip(polygon,2,(z+1)/4-.00001,false);
      if(!polygon.length)continue;
      const low=Math.max(0,Math.min(...polygon.map(v=>v[1]))),high=Math.max(...polygon.map(v=>v[1]));
      const key=x*d*4+z,old=map.get(key);
      map.set(key,[x,z,old?Math.min(old[2],low):low,old?Math.max(old[3],high):high]);
    }
  }
  return [...map.values()].filter(c=>c[3]-c[2]>.001).map(c=>c.map(n=>round(n,3)));
}
function nameFor(description){
  const replacements=[
    ['Slope Brick Curved','Pendiente curva'],['Slope Brick','Pendiente'],['Technic Brick','Ladrillo Technic'],
    ['Wheel Rim','Llanta'],['Technic Wedge Belt Wheel Tyre','Neumático de polea'],['Tyre','Neumático'],
    ['Brick','Ladrillo'],['Plate','Placa'],['Tile','Baldosa'],['Arch','Arco'],['Window','Ventana'],
    ['Door','Puerta'],['Fence Lattice','Valla de celosía'],['Fence Spindled','Valla de barrotes'],
    ['Cylinder','Cilindro'],['Cone','Cono'],['Dish','Disco'],
  ];
  let name=description.replace(/^[~=]/,'').replace(/\s+/g,' ').replace(/ x /g,' × ');
  for(const [en,es] of replacements)if(name.startsWith(en)){name=es+name.slice(en.length);break;}
  return name.replace(/ with .*/,'').replace(/ without .*/,'').replace(/ Inverted/,' invertida')
    .replace(/ Round/,' redonda').replace(/ Corner/,' en esquina').replace(/ Double/,' doble')
    .replace(/ Triple/,' triple').replace(/ Convex/,' convexa').replace(/ Concave/,' cóncava')
    .replace(/ Grille/,' con rejilla').replace(/ Frame/,' · marco').replace(/ Log/,' · troncos');
}

const catalog=[],attributions=[];
for(const spec of bundle.parts){
  const root=`parts/${spec.id}.dat`,files=closure(root);
  const geometry=await parse(root,files);
  const body=await parse(root,files,true);
  const flip=new THREE.Matrix4().makeRotationX(Math.PI).scale(new THREE.Vector3(.05,.05,.05));
  geometry.applyMatrix4(flip);body.applyMatrix4(flip);body.computeBoundingBox();
  const box=body.boundingBox;
  const offset=new THREE.Vector3(-Math.floor((box.min.x+.0001)*2)/2,
    spec.category==='Ruedas'?-box.min.y:Math.ceil((-box.min.y-.0001)*5)/5,
    -Math.floor((box.min.z+.0001)*2)/2);
  geometry.translate(offset.x,offset.y,offset.z);body.translate(offset.x,offset.y,offset.z);body.computeBoundingBox();
  const w=Math.ceil((body.boundingBox.max.x-.0001)*2)/2,d=Math.ceil((body.boundingBox.max.z-.0001)*2)/2;
  let h=Math.ceil((body.boundingBox.max.y/.4-.0001)*2)/2;
  const seen=new Set();
  const rawStuds=studPoints(root);
  // These two window moulds build their outer truncated studs inline, rather
  // than through stud primitives. Their positions are explicit in the source.
  if(['60594','60596'].includes(spec.id))rawStuds.push(new THREE.Vector3(-30,0,0),new THREE.Vector3(30,0,0));
  const top=rawStuds.map(p=>p.applyMatrix4(flip).add(offset)).map(p=>[round(p.x),round(p.y/.4),round(p.z)])
    .filter(p=>{const key=p.join('/');if(seen.has(key))return false;seen.add(key);return true;});
  let profile=columns(body,w,d);
  if(spec.category==='Ventanas y vallas'&&top.length){
    const contactHeight=Math.max(...top.map(p=>p[1]));
    if(h-contactHeight>0&&h-contactHeight<=.5){h=contactHeight;profile=profile.map(c=>[...c.slice(0,3),Math.min(c[3],h)]).filter(c=>c[3]>c[2]);}
  }
  // Bottom receivers require a part of the underside in the stud's cell. This
  // excludes unsupported arch spans, removed corners, and inverted-slope overhangs.
  let bottom=[];
  if(spec.category!=='Ruedas')for(let x=.5;x<w;x++)for(let z=.5;z<d;z++){
    if(profile.some(c=>c[0]>=Math.floor(x)*4&&c[0]<(Math.floor(x)+1)*4&&c[1]>=Math.floor(z)*4&&c[1]<(Math.floor(z)+1)*4&&c[2]<.15))bottom.push([x,0,z]);
  }
  // Explicit connection review: the two end feet are the only receivers on
  // these bridge arches. Curved edges touching a cell do not make a socket.
  if(['3659','3307','16577','6182','92950'].includes(spec.id))bottom=[[.5,0,.5],[w-.5,0,.5]];
  const indexed=mergeVertices(geometry,1e-5);
  const payload={version:1,position:Array.from(indexed.attributes.position.array,n=>round(n)),
    normal:Array.from(indexed.attributes.normal.array,n=>Math.round(Math.max(-1,Math.min(1,n))*32767)),
    index:Array.from(indexed.index.array)};
  const serialized=JSON.stringify(payload);
  await fs.writeFile(path.join(output,`${spec.id}.json`),serialized);
  const authors=[...new Set(files.flatMap(file=>bundle.files[file].split('\n').filter(l=>l.startsWith('0 Author:')).map(l=>l.slice(10).trim())))];
  const licenses=[...new Set(files.flatMap(file=>bundle.files[file].split('\n').filter(l=>l.startsWith('0 !LICENSE')).map(l=>l.slice(11).trim())))];
  const sourceUrl=`https://library.ldraw.org/library/official/parts/${spec.id}.dat`;
  catalog.push({...spec,name:nameFor(spec.description),w,d,h,studs:top.length>0,top,bottom,columns:profile,
    geometry:`/ldraw/geometry/${spec.id}.json`,sourceUrl,authors,licenses,sha256:createHash('sha256').update(serialized).digest('hex')});
  attributions.push({id:spec.id,description:spec.description,sourceUrl,authors,licenses,files,
    modifications:'Triangulated with Three.js LDrawLoader; axes and units converted; vertices indexed and rounded to 0.0001 stud; surface colours replaced by the editor colour; edge lines omitted.'});
  geometry.dispose();body.dispose();indexed.dispose();
  console.log(`${catalog.length}/${bundle.parts.length} ${spec.id}: ${w}×${d}, ${h} plates, ${top.length} studs, ${bottom.length} receivers`);
}
await fs.mkdir(path.join(ROOT,'src/generated'),{recursive:true});
await fs.writeFile(path.join(ROOT,'src/generated/parts.json'),JSON.stringify(catalog)+'\n');
await fs.writeFile(path.join(ROOT,'public/ldraw/attribution.json'),JSON.stringify({library:'LDraw.org Parts Library',release:bundle.release,archiveSha256:bundle.archiveSha256,parts:attributions},null,2)+'\n');
console.log(`Built ${catalog.length} local LDraw geometries.`);
