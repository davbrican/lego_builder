import {Group,Object3D,BoxHelper} from 'three';
import {TransformControls} from 'three/addons/controls/TransformControls.js';
import {brickGroup,disposeGroup} from './geometry.js';
import {PLATE_HEIGHT as H} from './catalog.js';
import {half} from './assemblies.js';

// This controller is attached only while the new assembly tool has a draft.
export class AssemblyControls {
  constructor(scene,{onStart,onChange,onEnd}){
    this.scene=scene;
    this.anchor=new Object3D();scene.scene.add(this.anchor);
    this.control=new TransformControls(scene.camera,scene.renderer.domElement);
    this.control.enabled=false;
    this.helper=this.control.getHelper();scene.scene.add(this.helper);
    this.control.setRotationSnap(Math.PI/2);
    this.control.showE=false;this.control.showXYZE=false;
    this.control.addEventListener('mouseDown',()=>{
      this.start=this.anchor.position.clone();
      this.startAngle=this.anchor.rotation.y;
      scene.suppressPointer=true;scene.pressed=null;scene.controls.enabled=false;
      onStart();
    });
    this.control.addEventListener('objectChange',()=>{
      if(!this.start)return;
      onChange({
        delta:{x:half(this.anchor.position.x-this.start.x),y:half((this.anchor.position.y-this.start.y)/H),z:half(this.anchor.position.z-this.start.z)},
        turns:-Math.round((this.anchor.rotation.y-this.startAngle)/(Math.PI/2)),
        pivot:{x:this.start.x,y:this.start.y/H,z:this.start.z},
      });
    });
    this.control.addEventListener('mouseUp',()=>{
      queueMicrotask(()=>{
        scene.suppressPointer=false;scene.controls.enabled=true;scene.touchIds.clear();scene.pressed=null;
        this.start=null;onEnd();
      });
    });
    // OrbitControls was registered first. Disable it in capture phase when a
    // handle is hit, before either it or the single-piece click handler runs.
    scene.renderer.domElement.addEventListener('pointerdown',event=>{
      if(!this.control.enabled||!this.control.object||event.button!==0)return;
      const rect=scene.renderer.domElement.getBoundingClientRect();
      this.control.pointerHover({x:(event.clientX-rect.left)/rect.width*2-1,y:-(event.clientY-rect.top)/rect.height*2+1});
      if(this.control.axis){scene.controls.enabled=false;scene.suppressPointer=true;scene.pressed=null;}
    },true);
    scene.renderer.domElement.addEventListener('pointercancel',()=>{
      this.control.pointerUp({button:0});scene.suppressPointer=false;scene.controls.enabled=true;
    });
  }
  setMode(mode='translate'){
    this.mode=mode;
    this.control.setMode(mode);
    this.control.showX=mode==='translate';this.control.showY=true;this.control.showZ=mode==='translate';
    this.control.showXY=mode==='translate';this.control.showXZ=mode==='translate';this.control.showYZ=mode==='translate';
  }
  attach(pivot){
    if(this.control.dragging)return;
    this.anchor.position.set(pivot.x,pivot.y*H,pivot.z);this.anchor.rotation.set(0,0,0);
    this.control.enabled=true;this.control.attach(this.anchor);this.setMode(this.mode||'translate');
  }
  detach(){this.control.enabled=false;this.control.detach();}
  preview(pieces,valid){
    const key=JSON.stringify([pieces,valid]);if(key===this.previewKey)return;
    this.previewKey=key;
    if(this.group)disposeGroup(this.group);
    if(this.outline){this.outline.geometry.dispose();this.outline.material.dispose();this.outline.removeFromParent();}
    this.group=new Group();
    for(const piece of pieces)this.group.add(brickGroup(piece,{ghost:true,valid}));
    this.scene.scene.add(this.group);
    this.outline=new BoxHelper(this.group,valid?'#f8b628':'#ef6867');
    this.outline.material.depthTest=false;this.outline.renderOrder=10;this.scene.scene.add(this.outline);
  }
  clear(){
    this.detach();this.start=null;this.previewKey=null;
    this.control.dragging=false;this.control.axis=null;
    if(this.group){disposeGroup(this.group);this.group=null;}
    if(this.outline){this.outline.geometry.dispose();this.outline.material.dispose();this.outline.removeFromParent();this.outline=null;}
    this.scene.suppressPointer=false;this.scene.controls.enabled=true;
  }
}
