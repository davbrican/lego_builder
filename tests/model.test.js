import {test} from 'node:test';
import assert from 'node:assert/strict';
import {dimensions} from '../src/catalog.js';
import {placementError, connectedIds, parseProject, demoProject, inventory, bounds, History, collides} from '../src/model.js';
const brick=(overrides={})=>({id:'a',part:'3001',color:'#c73536',x:0,y:0,z:0,rotation:0,...overrides});
const project=pieces=>({format:'bricklab',version:2,name:'Test',size:32,pieces});

test('rotation swaps footprint and catches the new collisions and base boundary',()=>{
  const a=brick({rotation:90});assert.deepEqual(dimensions(a),{w:2,d:4,h:3});
  assert.equal(placementError(a,[],32),null);
  assert.match(placementError({...a,x:31},[],32),/fuera/);
  assert.equal(collides(a,brick({id:'b',x:1,z:1})),true);
  assert.equal(collides(a,brick({id:'b',x:2,z:0})),false);
});
test('bricks stack at three plates and plates stack at one',()=>{
  const bottom=brick();
  assert.equal(placementError(brick({id:'b',y:3}),[bottom],32),null);
  assert.match(placementError(brick({id:'b',y:2}),[bottom],32),/ocupada/);
  const plate=brick({part:'3020'});
  assert.equal(placementError(brick({id:'b',y:1}),[plate],32),null);
});
test('smooth tiles cannot support an attached brick, floating mode is explicit',()=>{
  const tile=brick({part:'87079'});
  assert.match(placementError(brick({id:'b',y:1}),[tile],32),/tetones/);
  assert.equal(placementError(brick({id:'b',y:1}),[tile],32,{allowFloating:true}),null);
  assert.match(placementError(brick({id:'b',y:0}),[tile],32,{allowFloating:true}),/ocupada/);
});
test('bridge, hanging attachment, detached assemblies and support deletion',()=>{
  const base=brick({part:'3003'});
  const bridge=brick({id:'b',y:3});
  const hanging=brick({id:'c',part:'3022',x:2,y:2});
  assert.equal(placementError(bridge,[base],32),null);
  assert.equal(placementError(hanging,[base,bridge],32),null);
  assert.equal(connectedIds([base,bridge,hanging]).size,3);
  assert.equal(connectedIds([bridge,hanging]).size,0);
  assert.match(placementError(brick({id:'d',y:6}),[bridge],32),/tetones/);
  assert.match(placementError(brick({id:'side',x:2,y:1}),[base],32),/tetones/);
});
test('moving ignores itself but still rejects overlaps with other pieces',()=>{
  const a=brick(),b=brick({id:'b',x:5});
  assert.equal(placementError({...a,x:1},[a,b],32,{ignoreId:'a'}),null);
  assert.match(placementError({...a,x:2},[a,b],32,{ignoreId:'a'}),/ocupada/);
  assert.equal(a.x,0);
});
test('negative, fractional, non-finite and excessive positions are rejected',()=>{
  for(const pos of [{x:-1},{y:-1},{z:NaN},{x:.25},{y:Infinity},{y:300}])assert.ok(placementError(brick(pos),[],32));
});
test('demo round trips with no collisions and all pieces connected',()=>{
  const demo=demoProject();assert.deepEqual(parseProject(JSON.parse(JSON.stringify(demo))),demo);
  assert.equal(connectedIds(demo.pieces).size,demo.pieces.length);
  for(let i=0;i<demo.pieces.length;i++)assert.equal(placementError(demo.pieces[i],demo.pieces.slice(0,i),demo.size),null,`demo piece ${i}`);
});
test('import rejects unknown/prototype parts, malformed schema, duplicated ids and collisions',()=>{
  for(const bad of [null,{}, {...project([]),version:3},{...project([]),size:100},{...project([]),name:''},project([brick({part:'toString'})]),project([brick({part:'unknown'})]),project([brick({color:'red'})]),project([brick({rotation:45})]),project([brick(),brick()]),project([brick(),brick({id:'b'})]),project([brick({x:'1'})]),project(Array(2001).fill(brick()))])assert.throws(()=>parseProject(bad));
  assert.equal(parseProject(project([brick({y:20})])).pieces[0].y,20,'intentionally disconnected designs remain importable');
});
test('undo and redo restore entire projects, discard future on edits and bound memory',()=>{
  const history=new History(2),a=project([]),b=project([brick()]),c={...b,name:'Renamed',size:48};
  history.record(a);history.record(b);assert.deepEqual(history.undo(c),b);assert.deepEqual(history.undo(b),a);assert.equal(history.undo(a),null);assert.deepEqual(history.redo(a),b);
  history.record(b);assert.equal(history.redo(c),null);history.record(c);history.record(a);assert.equal(history.past.length,2);
  c.pieces[0].x=99;assert.notEqual(history.past[0].pieces[0].x,99);
});
test('inventory groups type and color; dimensions include rotated footprints and height',()=>{
  const pieces=[brick(),brick({id:'b',x:4}),brick({id:'c',x:8,color:'#ffffff',rotation:90,y:3})];
  const rows=inventory(pieces);assert.equal(rows.length,2);assert.equal(rows.find(r=>r.color==='#c73536').count,2);
  assert.deepEqual(bounds(pieces),{x:0,y:0,z:0,w:10,h:6,d:4});assert.equal(bounds([]).h,0);
});
