import {test} from 'node:test';
import assert from 'node:assert/strict';
import {candidateFromHit,placementError,grabPoint,GRAB_ANCHORS} from '../src/placement.js';
import {PlacementCursor,keyboardDelta} from '../src/precision.js';
import {contactPoints} from '../src/catalog.js';
import {parseProject} from '../src/model.js';
const brick=(id,overrides={})=>({id,part:'3008',color:'#e6d4af',x:8,y:0,z:8,rotation:0,...overrides});

test('a 6×6 tile can use any corner socket instead of the centre over a wall endpoint',()=>{
  const wall=brick('wall'),tile=brick('tile',{part:'10202'});
  const hit={piece:wall,point:{x:8.5,y:1.2,z:8.5}};
  const central=candidateFromHit(tile,hit);
  const corner=candidateFromHit(tile,hit,{anchor:'min-min'});
  assert.deepEqual([corner.x,corner.y,corner.z],[8,3,8]);
  assert.notDeepEqual([central.x,central.z],[corner.x,corner.z]);
  for(const rotation of [0,90,180,270])for(const {id:anchor} of GRAB_ANCHORS){
    const candidate=candidateFromHit({...tile,rotation},hit,{anchor});
    assert.equal(placementError(candidate,[wall],32),null,`${rotation}/${anchor}`);
    const grip=grabPoint(candidate,anchor);
    assert.deepEqual([candidate.x+grip[0],candidate.y+grip[1],candidate.z+grip[2]],[8.5,3,8.5]);
    assert.ok(contactPoints(candidate,'bottom').some(p=>p[0]===8.5&&p[2]===8.5));
  }
});
test('keyboard steps distinguish studs from plates and Shift halves every step',()=>{
  assert.deepEqual(keyboardDelta('ArrowRight'),{x:1,y:0,z:0});
  assert.deepEqual(keyboardDelta('ArrowUp',true),{x:0,y:0,z:-.5});
  assert.deepEqual(keyboardDelta('PageUp'),{x:0,y:1,z:0});
  assert.deepEqual(keyboardDelta('PageDown',true),{x:0,y:-.5,z:0});
  assert.equal(keyboardDelta('r'),null);
});
test('nudging locks the preview against mouse hits until explicitly resumed; reset cancels it',()=>{
  const cursor=new PlacementCursor(),original=brick('moving');
  cursor.follow(original);cursor.nudge(keyboardDelta('ArrowRight',true));
  const adjusted=structuredClone(cursor.piece);
  assert.equal(cursor.locked,true);assert.equal(original.x,8);
  cursor.follow(brick('moving',{x:25,y:90}));cursor.follow(null);
  assert.deepEqual(cursor.piece,adjusted);
  cursor.resume();cursor.follow(brick('moving',{x:12}));assert.equal(cursor.piece.x,12);
  cursor.reset();assert.equal(cursor.piece,null);assert.equal(cursor.locked,false);
});
test('rotation in fixed mode preserves the chosen grip, and collisions remain enforced',()=>{
  const wall=brick('wall'),cursor=new PlacementCursor();
  cursor.set(candidateFromHit(brick('tile',{part:'87079'}),{piece:wall,point:{x:8.5,y:1.2,z:8.5}},{anchor:'max-min'}));
  const before=cursor.piece,grip=grabPoint(before,'max-min');
  cursor.rotate(90,'max-min');
  const after=cursor.piece,rotatedGrip=grabPoint(after,'max-min');
  assert.deepEqual([before.x+grip[0],before.y+grip[1],before.z+grip[2]],[after.x+rotatedGrip[0],after.y+rotatedGrip[1],after.z+rotatedGrip[2]]);
  assert.equal(placementError(after,[wall],32),null);
  cursor.nudge(keyboardDelta('PageDown'));assert.match(placementError(cursor.piece,[wall],32),/ocupada/);
  assert.deepEqual(parseProject({format:'bricklab',version:2,name:'Precisión',size:32,pieces:[wall,after]}).pieces,[wall,after]);
});
