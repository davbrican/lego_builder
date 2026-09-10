import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PART_MAP} from '../src/catalog.js';
import {MECHANICAL_PARTS,MECHANICAL_PROFILES,mechanicalCandidates,mechanicalConnectors,mechanicalJoints} from '../src/mechanical.js';
import {placementError,collides,connectedIds,assemblyIds,candidateFromHit} from '../src/placement.js';
import {rotateAssembly,translateAssembly,snapAssembly,assemblyPlacementError,AssemblyDraft} from '../src/assemblies.js';
import {parseProject,History} from '../src/model.js';
const p=(part,overrides={})=>({id:part,part,color:'#c73536',x:8,y:0,z:8,rotation:0,...overrides});
const project=pieces=>({format:'bricklab',version:2,name:'Asas y clips',size:32,pieces});

test('all five reviewed moulds have current, bounded fine collision profiles and oriented connectors',()=>{
  assert.equal(Object.keys(MECHANICAL_PARTS).length,5);
  for(const [id,profile] of Object.entries(MECHANICAL_PROFILES)){
    assert.equal(profile.geometrySha256,PART_MAP[id].sha256);
    assert.equal(profile.resolution,20);
    assert.ok(profile.columns.length>0);
    assert.ok(profile.columns.every(c=>c.every(Number.isFinite)&&c[0]>=0&&c[0]<PART_MAP[id].w*20&&c[1]>=0&&c[1]<PART_MAP[id].d*20&&c[3]>c[2]));
    for(const c of mechanicalConnectors(p(id)))assert.equal(c.radius,.2);
  }
  assert.equal(mechanicalConnectors(p('60470b')).length,2);
  assert.equal(mechanicalConnectors(p('18649')).length,2);
});
test('each handle fits each clip mould, in both placement orders and all four world rotations',()=>{
  for(const clipId of ['61252','60470b','15712'])for(const barId of ['48336','18649']){
    const clip=p(clipId);let matches=[];
    for(const rotation of [0,90,180,270]){
      matches.push(...mechanicalCandidates(p(barId,{rotation}),clip).filter(o=>!placementError(o.piece,[clip],32)));
    }
    assert.ok(matches.length,`${barId} → ${clipId}`);
    for(const match of matches)for(let turns=0;turns<4;turns++){
      const [a,b]=rotateAssembly([clip,match.piece],turns,{x:10,z:10});
      assert.ok(mechanicalJoints(a,b).length);
      assert.equal(collides(a,b),false);assert.equal(collides(b,a),false);
      assert.equal(placementError(b,[a],32),null);
      assert.equal(placementError(a,[b],32,{allowFloating:true}),null);
      assert.equal(connectedIds([a,b]).size,2);
      assert.equal(assemblyIds([a,b],b.id).size,2);
      assert.deepEqual(parseProject(project([a,b])).pieces,[a,b]);
      assert.deepEqual(parseProject(project([b,a])).pieces,[b,a]);
    }
  }
});
test('48336 engages both 60470b jaws and auto snapping chooses that complete connection',()=>{
  const clip=p('60470b'),bar=p('48336',{rotation:180});
  const hit={piece:clip,point:{x:8.5,y:.5,z:9.5}};
  const placed=candidateFromHit(bar,hit,{pieces:[clip],size:32});
  assert.deepEqual([placed.x,placed.y,placed.z],[8,.5,9]);
  assert.equal(mechanicalJoints(placed,clip).length,2);
  assert.equal(placementError(placed,[clip],32),null);
  const studs=candidateFromHit(bar,{piece:clip,point:{x:8.5,y:.6,z:8.5}},{connection:'studs'});
  assert.equal(mechanicalJoints(studs,clip).length,0);
  assert.notDeepEqual(studs,placed);
  const forced=candidateFromHit(bar,{piece:clip,point:{x:8.5,y:.6,z:8.5}},{connection:'mechanical'});
  assert.equal(mechanicalJoints(forced,clip).length,2);
});
test('joints never exempt unrelated body collisions, off-axis shafts, wrong heights or third objects',()=>{
  const clip=p('60470b'),bar=p('48336',{rotation:180,x:8,y:.5,z:9});
  const backToFront=p('48336',{x:8,y:.5,z:8});
  assert.equal(mechanicalJoints(backToFront,clip).length,2,'axes alone are not enough');
  assert.equal(collides(backToFront,clip),true,'plate bodies still collide');
  for(const misplaced of [{...bar,z:8.5},{...bar,y:1},{...bar,rotation:90}]){
    assert.equal(mechanicalJoints(misplaced,clip).length,0);
    assert.ok(placementError(misplaced,[clip],32));
  }
  const blocker=p('3005',{x:8,y:.5,z:10});
  assert.match(placementError(bar,[clip,blocker],32,{allowFloating:true}),/ocupada/);
  assert.equal(mechanicalJoints(clip,p('61252')).length,0);
  assert.equal(mechanicalJoints(bar,p('18649')).length,0);
  assert.equal(mechanicalJoints(p('3633'),p('61252')).length,0,'lattice is not an invented handle');
});
test('mechanical support propagates, disappears after removal, and assemblies snap and undo atomically',()=>{
  const clip=p('60470b'),bar=p('48336',{rotation:180,x:8,y:.5,z:9});
  const top=p('3004',{id:'top',x:8,y:1.5,z:10});
  assert.equal(placementError(top,[clip,bar],32),null);
  assert.equal(connectedIds([clip,bar,top]).size,3);
  assert.equal(connectedIds([bar,top]).size,0);
  const original=project([clip,bar,top]),draft=new AssemblyDraft(original.pieces,bar.id),history=new History();
  assert.equal(draft.ids.size,3);
  draft.pieces=translateAssembly(draft.pieces,{x:4,y:0,z:0});
  assert.equal(assemblyPlacementError(draft.pieces,draft.others,32),null);
  const moved=draft.result(original);history.record(original);
  assert.deepEqual(history.undo(moved),original);assert.deepEqual(history.redo(original),moved);
  const near=translateAssembly([bar,top],{x:0,y:.5,z:0});
  const snap=snapAssembly(near,[clip],32);
  assert.ok(snap);assert.equal(mechanicalJoints(snap.pieces[0],clip).length,2);
  assert.equal(connectedIds([clip,...snap.pieces]).size,3);
});
