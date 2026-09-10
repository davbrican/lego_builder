import {test} from 'node:test';
import assert from 'node:assert/strict';
import {AssemblyDraft,assemblyIds,translateAssembly,rotateAssembly,assemblyPlacementError,snapAssembly} from '../src/assemblies.js';
import {History,parseProject} from '../src/model.js';
import {contactPoints} from '../src/catalog.js';
import {collides,candidateFromHit,placementError} from '../src/placement.js';
import {Scene,PerspectiveCamera} from 'three';
import {AssemblyControls} from '../src/assembly-controls.js';

const brick=(id,overrides={})=>({id,part:'3003',color:'#c73536',x:4,y:0,z:4,rotation:0,...overrides});
const scene=()=>[brick('foot'),brick('bridge',{part:'3001',y:3}),brick('hanging',{part:'3022',x:6,y:2}),brick('separate',{x:12}),brick('touching',{x:2})];
const project=pieces=>({format:'bricklab',version:2,name:'Conjuntos',size:32,pieces});

test('component selection follows a bridge in both directions, not the shared base or adjacent faces',()=>{
  const pieces=scene();
  for(const seed of ['foot','bridge','hanging'])assert.deepEqual([...assemblyIds(pieces,seed)].sort(),['bridge','foot','hanging']);
  assert.deepEqual([...assemblyIds(pieces,'separate')],['separate']);
  assert.deepEqual([...assemblyIds(pieces,'touching')],['touching']);
  assert.equal(assemblyIds(pieces,'missing').size,0);
  const floating=pieces.slice(0,3).map(p=>({...p,y:p.y+10}));
  assert.equal(assemblyIds(floating,'hanging').size,3);
});
test('a draft never changes saved pieces, and a whole move is a single undoable transaction',()=>{
  const original=project(scene()),snapshot=structuredClone(original),draft=new AssemblyDraft(original.pieces,'bridge');
  draft.pieces=translateAssembly(draft.pieces,{x:0,y:0,z:6});
  assert.deepEqual(original,snapshot,'cancel can just discard the draft');
  const result=draft.result(original),history=new History();
  assert.equal(assemblyPlacementError(draft.pieces,draft.others,32),null);
  assert.deepEqual(result.pieces.find(p=>p.id==='separate'),original.pieces.find(p=>p.id==='separate'));
  assert.deepEqual(parseProject(result),result);
  history.record(original);
  assert.deepEqual(history.undo(result),original);assert.deepEqual(history.redo(original),result);
});
test('quarter turns preserve all contact offsets, colours, ids and internal empty space',()=>{
  const draft=new AssemblyDraft(scene(),'foot'),pivot={x:6,z:5};
  let group=draft.original;
  for(let turn=1;turn<=4;turn++){
    group=rotateAssembly(group,1,pivot);
    assert.equal(assemblyIds(group,'foot').size,3);
    assert.equal(assemblyPlacementError(group,[],32),null);
    for(let i=0;i<group.length;i++)for(let j=i+1;j<group.length;j++)assert.equal(collides(group[i],group[j]),false);
    assert.deepEqual(group.map(p=>[p.id,p.color,p.part]),draft.original.map(p=>[p.id,p.color,p.part]));
  }
  assert.deepEqual(group,draft.original);
  assert.deepEqual(rotateAssembly(draft.original,-1,pivot),rotateAssembly(draft.original,3,pivot));
});
test('a complete assembly is validated against obstacles, bounds and support, not its own pieces',()=>{
  const draft=new AssemblyDraft(scene(),'foot');
  assert.equal(assemblyPlacementError(draft.pieces,draft.others,32),null);
  assert.match(assemblyPlacementError(translateAssembly(draft.pieces,{x:8,y:0,z:0}),draft.others,32),/ocupada/);
  assert.match(assemblyPlacementError(translateAssembly(draft.pieces,{x:30,y:0,z:0}),[],32),/fuera/);
  assert.match(assemblyPlacementError(translateAssembly(draft.pieces,{x:0,y:1,z:0}),[],32),/encajar/);
  assert.equal(assemblyPlacementError(translateAssembly(draft.pieces,{x:0,y:1,z:0}),[],32,{allowFloating:true}),null);
  assert.match(assemblyPlacementError(translateAssembly(draft.pieces,{x:0,y:-1,z:0}),[],32,{allowFloating:true}),/Altura/);
});
test('nearby snap moves every member equally and merges the two connected components on commit',()=>{
  const target=brick('target',{x:14}),group=[brick('a',{x:14.5,y:3.5}),brick('b',{x:14.5,y:6.5})];
  const before=structuredClone(group),snap=snapAssembly(group,[target],32);
  assert.ok(snap);assert.deepEqual(group,before);assert.equal(snap.targetId,'target');
  assert.equal(snap.pieces[1].y-snap.pieces[0].y,3);
  assert.equal(assemblyIds([target,...snap.pieces],'a').size,3);
  assert.equal(assemblyPlacementError(snap.pieces,[target],32),null);
  assert.equal(snapAssembly(group.map(p=>({...p,x:25})),[target],32),null,'no distant magnet');
});
test('snapping supports hanging connections and rejects false studs on smooth tiles',()=>{
  const support=brick('foot',{x:12}),roof=brick('roof',{part:'3001',x:12,y:3});
  const hanging=[brick('hanging',{part:'3022',x:14.5,y:2.5})];
  const snap=snapAssembly(hanging,[support,roof],32);
  assert.ok(snap);assert.equal(snap.pieces[0].y,2);
  const tile=brick('tile',{part:'3068b'});
  assert.equal(snapAssembly([brick('a',{y:1})],[tile],32),null);
  const blocked=brick('block',{y:3});
  assert.equal(snapAssembly([brick('a',{y:3})],[brick('target'),blocked],32),null);
});
test('99206 preserves its two stud heights and side volume; clips snap using elevated receivers',()=>{
  const part=brick('side',{part:'99206'});
  assert.deepEqual([...new Set(contactPoints(part).map(p=>p[1]))].sort(),[1,2]);
  for(const rotation of [0,90,180,270]){
    const candidate=candidateFromHit({...part,rotation},{point:{x:10,z:10}});
    assert.equal(placementError(candidate,[],32),null);
  }
  const host=brick('host'),clip=brick('clip',{part:'61252'});
  const candidate=candidateFromHit(clip,{piece:host,point:{x:4.5,y:1.2,z:5.5}});
  const underside=contactPoints(candidate,'bottom');
  assert.ok(underside.some(p=>p[1]===3));
  assert.equal(placementError(candidate,[host],32),null);
});

test('3D controls stay disabled for individual tools, convert world height to plates, and release the camera',async()=>{
  // An event target is enough: no browser, canvas renderer or DOM inspection.
  const element=new EventTarget();element.style={};
  const scene={scene:new Scene(),camera:new PerspectiveCamera(),renderer:{domElement:element},controls:{enabled:true},touchIds:new Set()};
  let started=0,ended=0,change;
  const controls=new AssemblyControls(scene,{onStart:()=>started++,onChange:value=>change=value,onEnd:()=>ended++});
  assert.equal(controls.control.enabled,false);
  controls.attach({x:4,y:3,z:4});controls.control.dragging=true;
  controls.control.dispatchEvent({type:'mouseDown'});
  assert.equal(started,1);assert.equal(scene.controls.enabled,false);assert.equal(scene.suppressPointer,true);
  controls.anchor.position.y+=.4;controls.anchor.position.x+=1;
  controls.control.dispatchEvent({type:'objectChange'});
  assert.deepEqual(change.delta,{x:1,y:1,z:0});
  controls.setMode('rotate');controls.anchor.rotation.y=-Math.PI/2;
  controls.control.dispatchEvent({type:'objectChange'});assert.equal(change.turns,1);
  assert.equal(controls.control.showX,false);assert.equal(controls.control.showZ,false);assert.equal(controls.control.showY,true);
  controls.control.dispatchEvent({type:'mouseUp'});controls.control.dragging=false;
  await Promise.resolve();
  assert.equal(ended,1);assert.equal(scene.controls.enabled,true);assert.equal(scene.suppressPointer,false);
  controls.clear();assert.equal(controls.control.enabled,false);assert.equal(controls.control.object,undefined);
  controls.control.dispose();
});
