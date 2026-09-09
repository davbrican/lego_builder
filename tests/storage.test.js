import {test} from 'node:test';
import assert from 'node:assert/strict';
import {loadAutosave,saveAutosave,saveProject,listProjects,removeProject} from '../src/storage.js';
import {demoProject} from '../src/model.js';

test('autosave and named snapshots round trip independently; deleting one preserves the others',()=>{
  const data=new Map();
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)}});
  try{
    assert.equal(loadAutosave(),null);
    const p=demoProject();saveAutosave(p);assert.deepEqual(loadAutosave(),p);
    saveProject(p);saveProject({...p,name:'Otra versión'});
    assert.equal(listProjects().length,2);const entry=listProjects()[0];removeProject(entry.id);
    assert.equal(listProjects()[0].project.name,p.name);assert.deepEqual(loadAutosave(),p);
    data.set('bricklab.autosave.v1','bad json');assert.throws(loadAutosave);
  }finally{delete globalThis.localStorage;}
});
