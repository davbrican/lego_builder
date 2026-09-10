// Refine collision columns around the five reviewed bar/clip moulds. The
// ordinary catalog remains unchanged. Finer cells distinguish a clip's ends
// from the adjacent handle supports that touch them without overlapping.
import fs from 'node:fs/promises';
const root=new URL('../',import.meta.url),parts=JSON.parse(await fs.readFile(new URL('src/generated/parts.json',root)));
const resolution=20;
function clip(vertices,axis,limit,greater){
  const out=[];
  for(let i=0;i<vertices.length;i++){
    const a=vertices[i],b=vertices[(i+1)%vertices.length],ia=greater?a[axis]>=limit:a[axis]<=limit,ib=greater?b[axis]>=limit:b[axis]<=limit;
    if(ia)out.push(a);
    if(ia!==ib){const t=(limit-a[axis])/(b[axis]-a[axis]);out.push(a.map((n,j)=>n+t*(b[j]-n)));}
  }
  return out;
}
const profiles={};
for(const id of ['48336','18649','61252','60470b','15712']){
  const part=parts.find(p=>p.id===id),mesh=JSON.parse(await fs.readFile(new URL(`public${part.geometry}`,root))),cells=new Map();
  for(let i=0;i<mesh.index.length;i+=3){
    const triangle=mesh.index.slice(i,i+3).map(index=>mesh.position.slice(index*3,index*3+3));
    const minX=Math.max(0,Math.floor(Math.min(...triangle.map(p=>p[0]))*resolution));
    const maxX=Math.min(part.w*resolution-1,Math.ceil(Math.max(...triangle.map(p=>p[0]))*resolution)-1);
    const minZ=Math.max(0,Math.floor(Math.min(...triangle.map(p=>p[2]))*resolution));
    const maxZ=Math.min(part.d*resolution-1,Math.ceil(Math.max(...triangle.map(p=>p[2]))*resolution)-1);
    for(let x=minX;x<=maxX;x++)for(let z=minZ;z<=maxZ;z++){
      let polygon=clip(triangle,0,x/resolution+.00001,true);
      polygon=clip(polygon,0,(x+1)/resolution-.00001,false);
      polygon=clip(polygon,2,z/resolution+.00001,true);
      polygon=clip(polygon,2,(z+1)/resolution-.00001,false);
      if(!polygon.length)continue;
      const low=Math.min(...polygon.map(p=>p[1]/.4)),high=Math.max(...polygon.map(p=>p[1]/.4)),key=`${x}/${z}`,old=cells.get(key);
      cells.set(key,[x,z,old?Math.min(old[2],low):low,old?Math.max(old[3],high):high]);
    }
  }
  profiles[id]={resolution,geometrySha256:part.sha256,columns:[...cells.values()].filter(c=>c[3]-c[2]>.001).map(c=>c.map(n=>Number(n.toFixed(4))))};
  console.log(`${id}: ${profiles[id].columns.length} fine collision columns`);
}
await fs.writeFile(new URL('src/generated/mechanical-collisions.json',root),JSON.stringify(profiles)+'\n');
