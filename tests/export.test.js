import {test} from 'node:test';
import assert from 'node:assert/strict';
import {BuilderScene} from '../src/scene.js';
import {demoProject} from '../src/model.js';

test('GLB export produces a self-contained model with metre scale and geometry',async()=>{
  // Browser FileReader adapter for exercising the real exporter in Node.
  globalThis.FileReader=class {
    readAsArrayBuffer(blob){blob.arrayBuffer().then(result=>{this.result=result;this.onloadend?.();});}
  };
  try{
    const buffer=await BuilderScene.prototype.exportGLB.call({pieces:demoProject().pieces});
    const view=new DataView(buffer);
    assert.equal(view.getUint32(0,true),0x46546c67);
    assert.equal(view.getUint32(4,true),2);
    assert.equal(view.getUint32(8,true),buffer.byteLength);
    assert.equal(view.getUint32(16,true),0x4e4f534a);
    const json=JSON.parse(new TextDecoder().decode(new Uint8Array(buffer,20,view.getUint32(12,true))));
    assert.equal(json.asset.version,'2.0');
    assert.ok(json.meshes.length>0);
    assert.ok(json.nodes.some(node=>node.scale?.every(value=>value===.008) ||
      (node.matrix && [0,5,10].every(i=>node.matrix[i]===.008))), 'the root transform converts studs to metres');
    assert.ok(json.buffers.every(buffer=>!buffer.uri),'geometry is embedded, without network resources');
    assert.ok(!json.extensionsRequired?.includes('EXT_mesh_gpu_instancing'));
  }finally{delete globalThis.FileReader;}
});
