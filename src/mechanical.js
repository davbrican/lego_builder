import {PART_MAP,rotatePoint,PLATE_HEIGHT as H} from './catalog.js';
import profiles from './generated/mechanical-collisions.json' with {type:'json'};
export const MECHANICAL_PROFILES=profiles;

// Reviewed against the bundled LDraw definitions. Coordinates use studs in
// X/Z and plates in Y; shaft radius/length and clip width use world stud units.
// clip6.dat: centre (0,2,0), X axis, 8 LDU width, 4 LDU shaft radius.
// 15712.dat: centre (0,-6,0), Z axis. Handles use the explicit 4-4cylo shaft.
const bar=(point,axis,halfLength)=>({type:'bar',point,axis,halfLength,radius:.2});
const clip=(point,axis)=>({type:'clip',point,axis,halfLength:.2,radius:.2});
export const MECHANICAL_PARTS={
  '48336':[bar([1,.75,1.5],[1,0,0],.7)],
  '18649':[bar([.5,.75,.5],[0,0,1],.2),bar([3.5,.75,.5],[0,0,1],.2)],
  '61252':[clip([.5,1.25,1.5],[1,0,0])],
  '60470b':[clip([.5,1.25,1.5],[1,0,0]),clip([1.5,1.25,1.5],[1,0,0])],
  '15712':[clip([.5,1.75,.5],[0,0,1])],
};
const EPS=.001;
const world=([x,y,z])=>[x,y*H,z];
const dot=(a,b)=>a.reduce((sum,n,i)=>sum+n*b[i],0);
const subtract=(a,b)=>a.map((n,i)=>n-b[i]);
function rotateAxis(axis,rotation){
  let [x,y,z]=axis;
  for(let i=0;i<rotation/90;i++)[x,z]=[-z,x];
  return [x,y,z];
}
export function mechanicalConnectors(piece){
  return (MECHANICAL_PARTS[piece.part]||[]).map((c,index)=>{
    const point=rotatePoint(c.point,PART_MAP[piece.part],piece.rotation);
    return {...c,index,point:[point[0]+(piece.x||0),point[1]+(piece.y||0),point[2]+(piece.z||0)],axis:rotateAxis(c.axis,piece.rotation)};
  });
}
function compatible(a,b){return a.type!==b.type&&Math.abs(dot(a.axis,b.axis))>1-EPS&&Math.abs(a.radius-b.radius)<EPS;}
function matched(a,b){
  if(!compatible(a,b))return false;
  const bar=a.type==='bar'?a:b,clip=a.type==='clip'?a:b;
  const delta=subtract(world(clip.point),world(bar.point)),along=dot(delta,bar.axis);
  const perpendicular=delta.map((n,i)=>n-along*bar.axis[i]);
  return Math.hypot(...perpendicular)<EPS&&Math.abs(along)+clip.halfLength<=bar.halfLength+EPS;
}
export function mechanicalJoints(a,b){
  const joints=[];
  for(const ac of mechanicalConnectors(a))for(const bc of mechanicalConnectors(b))if(matched(ac,bc)){
    joints.push({bar:ac.type==='bar'?ac:bc,clip:ac.type==='clip'?ac:bc});
  }
  return joints;
}

// Only overlap contained in the engaged shaft aperture is permissible.
// X/Z envelopes come from 1/20-stud collision columns, so their boundary
// is rounded out to the same grid. Y retains the physical 4 LDU shaft radius.
// Body collisions, third pieces, perpendicular axes and unused clip jaws are
// still rejected by the regular collision loop.
export function jointContainsOverlap(joints,min,max){
  return joints.some(({clip})=>{
    const center=world(clip.point),along=clip.axis.findIndex(n=>Math.abs(n)>.9);
    for(let axis=0;axis<3;axis++){
      const extent=axis===along?clip.halfLength:clip.radius;
      const low=axis===1?center[axis]-extent:Math.floor((center[axis]-extent+EPS)*20)/20;
      const high=axis===1?center[axis]+extent:Math.ceil((center[axis]+extent-EPS)*20)/20;
      if(min[axis]<low-EPS||max[axis]>high+EPS)return false;
    }
    return true;
  });
}
function shaftAnchors(bar,clip){
  const extent=bar.halfLength-clip.halfLength;
  if(extent<-EPS)return [];
  // Every half-stud station on the usable shaft, including the centre.
  const points=[];
  for(let offset=-Math.floor((extent+EPS)*2)/2;offset<=extent+EPS;offset+=.5){
    points.push(bar.point.map((n,i)=>n+bar.axis[i]*offset/(i===1?H:1)));
  }
  return points;
}
export function mechanicalCandidates(template,target){
  const local=mechanicalConnectors({...template,x:0,y:0,z:0}),remote=mechanicalConnectors(target),proposals=new Map();
  for(const from of local)for(const to of remote){
    if(!compatible(from,to))continue;
    const pairs=from.type==='bar'?shaftAnchors(from,to).map(point=>[point,to.point]):shaftAnchors(to,from).map(point=>[from.point,point]);
    for(const [source,destination] of pairs){
      const [x,y,z]=subtract(destination,source);
      if(![x,y,z].every(n=>Math.abs(n*2-Math.round(n*2))<EPS))continue;
      const piece={...template,x:Math.round(x*2)/2,y:Math.round(y*2)/2,z:Math.round(z*2)/2};
      const key=`${piece.x}/${piece.y}/${piece.z}`;
      proposals.set(key,{piece,point:destination,joints:mechanicalJoints(piece,target).length});
    }
  }
  return [...proposals.values()];
}
