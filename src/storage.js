import {parseProject} from './model.js';
const AUTO='bricklab.autosave.v1', LIBRARY='bricklab.projects.v1';
export function loadAutosave(){const s=localStorage.getItem(AUTO);return s?parseProject(JSON.parse(s)):null;}
export function saveAutosave(project){localStorage.setItem(AUTO,JSON.stringify(project));}
export function listProjects(){
  const raw=JSON.parse(localStorage.getItem(LIBRARY)||'[]');
  if(!Array.isArray(raw))throw new Error('No se ha podido leer la colección guardada.');
  return raw.map(entry=>({id:entry.id,updated:entry.updated,project:parseProject(entry.project)}));
}
export function saveProject(project){
  const entries=listProjects();
  entries.unshift({id:crypto.randomUUID(),updated:new Date().toISOString(),project:structuredClone(project)});
  localStorage.setItem(LIBRARY,JSON.stringify(entries));
}
export function removeProject(id){localStorage.setItem(LIBRARY,JSON.stringify(listProjects().filter(p=>p.id!==id)));}
