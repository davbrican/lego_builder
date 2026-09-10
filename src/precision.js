import {grabPoint} from './placement.js';

export function keyboardDelta(key,fine=false){
  const step=fine?.5:1;
  const vectors={arrowleft:[-1,0,0],arrowright:[1,0,0],arrowup:[0,0,-1],arrowdown:[0,0,1],pageup:[0,1,0],pagedown:[0,-1,0]};
  const vector=vectors[key.toLowerCase()];
  return vector?{x:vector[0]*step,y:vector[1]*step,z:vector[2]*step}:null;
}
export class PlacementCursor {
  constructor(){this.reset();}
  reset(){this.piece=null;this.locked=false;}
  follow(piece){if(!this.locked)this.piece=piece;return this.piece;}
  set(piece){this.piece={...piece};this.locked=true;return this.piece;}
  nudge(delta){
    if(!this.piece)return null;
    const p=this.piece;return this.set({...p,x:p.x+delta.x,y:p.y+delta.y,z:p.z+delta.z});
  }
  rotate(rotation,anchor){
    if(!this.piece)return null;
    const p=this.piece,next={...p,rotation},before=grabPoint(p,anchor),after=grabPoint(next,anchor);
    this.piece={...next,x:p.x+before[0]-after[0],y:p.y+before[1]-after[1],z:p.z+before[2]-after[2]};
    return this.piece;
  }
  resume(){this.locked=false;}
}
