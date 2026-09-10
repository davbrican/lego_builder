import './style.css';
import {createIcons, Box, Boxes, Plus, MousePointer2, Move, Paintbrush, Eraser, RotateCw, Undo2, Redo2, Save, FolderOpen, Download, Upload, Search, X, Copy, Trash2, Grid3x3, Layers, ChevronDown, Expand, Camera, HelpCircle, Check, ZoomIn, ZoomOut, Package, Menu, ArrowUpRight} from 'lucide';
import {PARTS, PART_MAP, COLORS, dimensions, CATEGORIES, searchParts, FORMAT_VERSION} from './catalog.js';
import {uid, placementError, parseProject, inventory, bounds, connectedIds, History, demoProject, candidateFromHit} from './model.js';
import {loadAutosave, saveAutosave, saveProject, listProjects, removeProject} from './storage.js';
import {BuilderScene, createThumbnailRenderer} from './scene.js';
import {ensureGeometry,ensureGeometries,hasGeometry} from './geometry.js';
import {AssemblyDraft,translateAssembly,rotateAssembly,assemblyPlacementError,snapAssembly} from './assemblies.js';
import {AssemblyControls} from './assembly-controls.js';

const icons={Box,Boxes,Plus,MousePointer2,Move,Paintbrush,Eraser,RotateCw,Undo2,Redo2,Save,FolderOpen,Download,Upload,Search,X,Copy,Trash2,Grid3x3,Layers,ChevronDown,Expand,Camera,HelpCircle,Check,ZoomIn,ZoomOut,Package,Menu,ArrowUpRight};
const icon=name=>`<i data-lucide="${name}" aria-hidden="true"></i>`;
const $=s=>document.querySelector(s);
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const button=(action,label,ico,cls='')=>`<button data-action="${action}" class="${cls}" title="${label}" aria-label="${label}">${icon(ico)}</button>`;
const history=new History();
let project=demoProject(),storageError=null,autosavePaused=false;
try{project=loadAutosave()||project;}catch(e){storageError='No se pudo recuperar el autoguardado. Puedes importar una copia o iniciar un proyecto nuevo.';autosavePaused=true;}
let thumbnailRenderer,thumbnailObserver;
let assembly=null,assemblyControls=null,assemblySnap=null,assemblyError=null,assemblyPointer=false,assemblyDragSource=null,assemblyConfirmation=null;
const thumbnailJobs=new Map();
let scene, mode='build',partId='3001',color=COLORS[0].hex,rotation=0,selectedId=null,moving=null,candidate=null,candidateError=null,category='Todas',filter='',thumbs={},saveTimer,toastTimer,lastHit=null,allowFloating=false,manualLayer=null;

$('#app').innerHTML=`
  <header class="topbar">
    <a class="brand" href="./" aria-label="Bricklab, inicio"><span class="brand-mark">b.</span><span>bricklab</span></a>
    <span class="header-separator"></span>
    <div class="project-heading"><input id="project-name" aria-label="Nombre del proyecto" maxlength="100" value="${escape(project.name)}"><span id="save-status">Guardado en este navegador</span></div>
    <div class="header-actions">
      <button data-action="library" class="text-button">${icon('folder-open')}<span>Mis proyectos</span></button>
      <button data-action="save" class="text-button">${icon('save')}<span>Guardar</span></button>
      <button data-action="export" class="primary">${icon('download')}<span>Exportar</span></button>
    </div>
  </header>
  <main class="workspace">
    <aside class="catalog" id="catalog-panel" aria-label="Catálogo de piezas">
      <div class="panel-heading"><div><span class="eyebrow">TU CAJA DE PIEZAS</span><h1>Todo empieza<br>con una pieza.</h1></div>${button('toggle-catalog','Cerrar piezas','x','mobile-only')}</div>
      <label class="search-field">${icon('search')}<input id="search" placeholder="Nombre, referencia o tamaño…" aria-label="Buscar pieza"></label>
      <label class="category-filter"><span>Categoría</span><select id="category-filter" aria-label="Categoría de piezas">${CATEGORIES.map(c=>`<option value="${c}">${c}${c==='Todas'?'':` (${PARTS.filter(p=>p.category===c).length})`}</option>`).join('')}</select></label>
      <div class="catalog-meta"><span id="catalog-count">${PARTS.length} piezas</span><button data-action="part-info" class="catalog-info">Ficha de pieza</button></div>
      <div class="parts-grid" id="parts-grid"></div>
      <section class="palette"><div class="section-title"><h2>Color</h2><span id="color-name">Rojo</span></div><div class="swatches">${COLORS.map(c=>`<button data-color="${c.hex}" class="swatch" style="--swatch:${c.hex}" title="${c.name}" aria-label="${c.name}" aria-pressed="${c.hex===color}"></button>`).join('')}</div></section>
      <button class="catalog-footer" data-action="credits">${icon('box')}<span>Modelos LDraw · créditos y fuentes</span></button>
    </aside>
    <section class="stage" id="stage" aria-label="Editor 3D">
      <div class="stage-top">
        <div class="stage-label"><span class="eyebrow">MESA DE CONSTRUCCIÓN</span><span id="base-label">Base ${project.size} × ${project.size}</span></div>
        <div class="stage-options">${button('new','Nuevo proyecto','plus')}${button('settings','Base y encaje','layers')}${button('help','Controles y atajos','help-circle')}</div>
      </div>
      <div class="toolrail" role="group" aria-label="Herramientas">
        <button data-action="toggle-catalog" class="mobile-only" title="Piezas" aria-label="Abrir piezas">${icon('menu')}</button>
        ${[['build','plus','Construir (B)'],['select','mouse-pointer-2','Seleccionar (V)'],['move','move','Mover (M)'],['assembly','boxes','Conjunto conectado (G)'],['paint','paintbrush','Pintar (P)'],['erase','eraser','Borrar (X)']].map(([m,i,t])=>`<button data-mode="${m}" title="${t}" aria-label="${t}" aria-pressed="${mode===m}" class="${mode===m?'active':''}">${icon(i)}</button>`).join('')}
        <span class="tool-divider"></span>${button('undo','Deshacer (Ctrl/Cmd Z)','undo-2')}${button('redo','Rehacer (Ctrl/Cmd Shift Z)','redo-2')}
      </div>
      <div class="selection-card" id="selection-card" hidden></div>
      <div class="view-controls"><button data-view="iso" class="view-main" title="Vista isométrica">3D</button><button data-view="top" title="Vista superior">Superior</button><button data-view="front" title="Vista frontal">Frontal</button><span></span>${button('fit','Centrar modelo (F)','expand')}${button('zoom-in','Acercar','zoom-in')}${button('zoom-out','Alejar','zoom-out')}</div>
      <div class="floating-notice" id="floating-notice" hidden></div>
      <div class="build-dock"><div class="active-part"><span class="active-swatch" id="active-swatch"></span><div><strong id="active-part-name">Ladrillo 2 × 4</strong><span id="active-mode-label">Clic en la base para construir</span></div></div><button data-action="rotate" title="Girar 90° (R)">${icon('rotate-cw')}<span id="rotation-label">0°</span><kbd>R</kbd></button></div>
      <div class="canvas-help">Arrastra para orbitar <span>·</span> Rueda para acercar <span>·</span> Botón derecho para desplazar</div>
      <div class="loading-model" id="loading-model">Cargando las piezas del taller…</div>
      <div class="webgl-error" id="webgl-error" hidden><h2>No se ha podido iniciar la vista 3D</h2><p>Activa la aceleración gráfica de tu navegador y vuelve a abrir la página. Necesitas un navegador compatible con WebGL 2.</p></div>
    </section>
  </main>
  <footer class="statusbar"><div><span class="status-marker"></span><span id="status-text">Listo para construir</span></div><div class="model-stats"><button data-action="inventory">${icon('package')}<span id="piece-count"></span></button><span class="stat-separator"></span><span id="model-dimensions"></span><span class="stat-separator"></span><span class="local-badge">LOCAL</span></div></footer>
  <dialog id="dialog"><div class="dialog-header"><h2 id="dialog-title"></h2>${button('close-dialog','Cerrar','x')}</div><div id="dialog-content"></div></dialog>
  <div class="toast" id="toast" role="status" aria-live="polite" hidden></div>
  <input type="file" id="import-file" accept=".json,application/json" hidden>
`;

function refreshIcons(){createIcons({icons,attrs:{'stroke-width':1.7}});}
function toast(message,error=false){const el=$('#toast');el.textContent=message;el.classList.toggle('error',error);el.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.hidden=true,5000);}
function setStatus(message,invalid=false){$('#status-text').textContent=message;$('.status-marker').classList.toggle('invalid',invalid);}
function queueSave(){
  if(autosavePaused){$('#save-status').textContent='Autoguardado no disponible';return;}
  $('#save-status').textContent='Guardando…';clearTimeout(saveTimer);
  saveTimer=setTimeout(()=>{try{saveAutosave(project);$('#save-status').textContent='Guardado en este navegador';}catch(e){$('#save-status').textContent='No se pudo guardar';toast('No hay espacio o el almacenamiento está bloqueado. Exporta tu proyecto para conservarlo.',true);}},250);
}
function renderCatalog(){
  thumbnailObserver?.disconnect();
  const parts=searchParts(filter,category);
  $('#catalog-count').textContent=`${parts.length} de ${PARTS.length} piezas`;
  $('#parts-grid').innerHTML=parts.length?parts.map(p=>`<button class="part-card ${p.id===partId?'active':''}" data-part="${p.id}" aria-label="${escape(p.name)}, referencia ${p.id}" aria-pressed="${p.id===partId}"><span class="part-check">${icon('check')}</span><span class="part-preview" data-preview="${p.id}">${thumbs[p.id]?`<img src="${thumbs[p.id]}" alt="" draggable="false">`:`<span class="part-fallback">${icon('box')}</span>`}</span><strong>${escape(p.name)}</strong><span class="part-reference">Ref. ${p.id}</span></button>`).join(''):'<p class="empty-message">No hay piezas con ese nombre o referencia.</p>';
  document.querySelectorAll('[data-preview]').forEach(el=>{if(!thumbs[el.dataset.preview])thumbnailObserver?.observe(el);});
  refreshIcons();
}
function observeThumbnails(){
  thumbnailObserver=new IntersectionObserver(entries=>{
    for(const entry of entries){
      if(!entry.isIntersecting)continue;
      const element=entry.target,id=element.dataset.preview;thumbnailObserver.unobserve(element);
      if(!thumbnailJobs.has(id))thumbnailJobs.set(id,thumbnailRenderer(PART_MAP[id]).finally(()=>thumbnailJobs.delete(id)));
      thumbnailJobs.get(id).then(url=>{
        thumbs[id]=url;
        const target=document.querySelector(`[data-preview="${id}"]`);
        if(target){const img=document.createElement('img');img.src=url;img.alt='';img.draggable=false;target.replaceChildren(img);}
      }).catch(()=>{if(element.isConnected)element.textContent='Vista no disponible';});
    }
  },{root:$('#parts-grid'),rootMargin:'100px'});
}
function selected(){return project.pieces.find(p=>p.id===selectedId);}
function renderSelection(){
  if(assembly){renderAssembly();return;}
  const piece=selected(),el=$('#selection-card');el.hidden=!piece;
  el.classList.remove('assembly-card');
  if(!piece)return;
  el.innerHTML=`<div class="section-title"><span class="eyebrow">PIEZA SELECCIONADA</span>${button('deselect','Deseleccionar','x')}</div><h2>${escape(PART_MAP[piece.part].name)}</h2><button class="reference-link" data-action="selection-info">Ref. ${piece.part} · Ver ficha</button><p>Posición en tetones · altura en placas</p><div class="coordinates">${['x','y','z'].map(axis=>`<label>${axis.toUpperCase()}<input data-coordinate="${axis}" type="number" step="0.5" min="0" max="${axis==='y'?299:project.size-1}" value="${piece[axis]}" aria-label="Posición ${axis.toUpperCase()}"></label>`).join('')}</div><button class="position-apply" data-action="apply-position">Aplicar posición</button><div class="selection-actions">${button('move-selection','Mover pieza (M)','move')}${button('duplicate','Duplicar (Ctrl/Cmd D)','copy')}${button('rotate-selection','Girar pieza','rotate-cw')}${button('delete','Eliminar (Supr)','trash-2')}</div>`;
  refreshIcons();
}
function renderState(){
  $('#project-name').value=project.name;
  $('#piece-count').textContent=`${project.pieces.length} piezas`;
  const b=bounds(project.pieces);$('#model-dimensions').textContent=`${(b.w*.8).toFixed(1)} × ${(b.d*.8).toFixed(1)} × ${(b.h*.32).toFixed(1)} cm`;
  $('#base-label').textContent=`Base ${project.size} × ${project.size}`;
  $('[data-action="undo"]').disabled=!history.past.length;$('[data-action="redo"]').disabled=!history.future.length;
  const disconnected=project.pieces.length-connectedIds(project.pieces).size;
  $('#floating-notice').hidden=!disconnected;$('#floating-notice').textContent=`${disconnected} ${disconnected===1?'pieza sin conexión':'piezas sin conexión'} a la base`;
  if(scene){if(scene.size!==project.size)scene.setBase(project.size);scene.sync(project.pieces);scene.select(selectedId);}
  renderSelection();updateDock();queueSave();
}
function commit(next){cancelAssembly();history.record(project);project=next;renderState();}
function editPieces(pieces){commit({...project,pieces});}
function updateDock(){
  $('#active-part-name').textContent=moving?`Moviendo ${PART_MAP[moving.part].name.toLowerCase()}`:PART_MAP[partId].name;
  const labels={build:'Clic para colocar · R para girar',select:'Clic en una pieza para editarla',move:moving?'Clic para colocar · Esc para cancelar':'Elige la pieza que quieres mover',assembly:assembly?`${assembly.ids.size} piezas · Previsualización · Esc cancela`:'Pulsa una pieza para seleccionar su conjunto conectado',paint:'Clic en una pieza para pintarla',erase:'Clic en una pieza para borrarla'};
  $('#active-mode-label').textContent=labels[mode];$('#rotation-label').textContent=`${rotation}°`;
  $('#active-swatch').style.background=moving?.color||color;
  $('#color-name').textContent=COLORS.find(c=>c.hex===color)?.name||color;
  document.querySelectorAll('[data-color]').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.color===color)));
  document.querySelectorAll('[data-mode]').forEach(el=>{el.classList.toggle('active',el.dataset.mode===mode);el.setAttribute('aria-pressed',String(el.dataset.mode===mode));});
}
function cancelMove(){cancelAssembly();if(moving){scene?.hidePiece(moving.id,false);moving=null;}candidate=null;scene?.setGhost(null);}
function setMode(next){cancelMove();mode=next;renderSelection();updateDock();setStatus(({build:'Elige una pieza y colócala en la base',select:'Selecciona una pieza',move:'Selecciona la pieza que quieres mover',assembly:'Pulsa una pieza: se seleccionarán todas las conectadas a ella',paint:'Elige un color y pulsa una pieza',erase:'Pulsa una pieza para borrarla'})[mode]);}
function setSelected(id){selectedId=id;scene?.select(id);renderSelection();}
function beginMove(piece){if(!piece){toast('Selecciona primero una pieza.');return;}cancelMove();mode='move';moving={...piece};rotation=piece.rotation;scene?.hidePiece(piece.id,true);setSelected(piece.id);updateDock();setStatus('Coloca la pieza en su nueva posición. Esc cancela.');}
function assemblyPivot(){
  if(assembly.pivot)return assembly.pivot;
  const b=bounds(assembly.pieces);return {x:Math.floor(b.x+b.w/2),y:b.y,z:Math.floor(b.z+b.d/2)};
}
function cancelAssembly(){
  if(!assembly)return;
  for(const id of assembly.ids)scene?.hidePiece(id,false);
  assemblyControls?.clear();assembly=null;assemblySnap=null;assemblyError=null;assemblyPointer=false;assemblyDragSource=null;assemblyConfirmation=null;
  selectedId=null;scene?.select(null);$('#selection-card').hidden=true;
}
function beginAssembly(id){
  cancelMove();setSelected(null);mode='assembly';assembly=new AssemblyDraft(project.pieces,id);
  for(const pieceId of assembly.ids)scene.hidePiece(pieceId,true);
  refreshAssembly(assembly.pieces,false);updateDock();
}
function renderAssembly(){
  const el=$('#selection-card'),b=bounds(assembly.pieces);el.hidden=false;el.classList.add('assembly-card');
  el.innerHTML=`<div class="section-title"><span class="eyebrow">CONJUNTO CONECTADO</span>${button('assembly-cancel','Cancelar movimiento','x')}</div><h2>${assembly.ids.size} ${assembly.ids.size===1?'pieza':'piezas'} seleccionadas</h2><p>Arrastra los ejes para mover el conjunto. Giro vertical en pasos de 90°.</p><div class="assembly-tools"><button data-action="assembly-translate" aria-pressed="${!assemblyPointer&&assemblyControls?.mode!=='rotate'}">${icon('move')}Mover XYZ</button><button data-action="assembly-gizmo-rotate" aria-pressed="${!assemblyPointer&&assemblyControls?.mode==='rotate'}">${icon('rotate-cw')}Girar Y</button><button data-action="assembly-pointer" aria-pressed="${assemblyPointer}">${icon('mouse-pointer-2')}Colocar con puntero</button></div><div class="coordinates">${['x','y','z'].map(axis=>`<label>${axis.toUpperCase()}<input data-assembly-coordinate="${axis}" type="number" step="0.5" value="${b[axis]}" aria-label="Posición ${axis.toUpperCase()} del conjunto"></label>`).join('')}</div><button class="position-apply" data-action="assembly-position">Previsualizar coordenadas</button><p class="assembly-feedback ${assemblyError?'invalid':''}" role="status">${escape(assemblyError||(assemblySnap?'Encaje encontrado con otra construcción. Confirma para unirlas.':'Posición válida. Confirma para colocar el conjunto.'))}</p><div class="assembly-finish"><button data-action="assembly-apply" class="primary" ${assemblyError?'disabled':''}>${icon('check')}Confirmar</button><button data-action="assembly-cancel">Cancelar</button></div>`;
  refreshIcons();
}
function refreshAssembly(pieces,magnet=true,pivot=null){
  if(!assembly)return;
  const previous=bounds(assembly.pieces),next=bounds(pieces),oldPivot=assemblyPivot();
  const nextPivot=pivot||{x:oldPivot.x+next.x-previous.x,y:oldPivot.y+next.y-previous.y,z:oldPivot.z+next.z-previous.z};
  assemblySnap=magnet?snapAssembly(pieces,assembly.others,project.size,{allowFloating}):null;
  const adjustment=assemblySnap?.delta||{x:0,y:0,z:0};
  assembly.pivot={x:nextPivot.x+adjustment.x,y:nextPivot.y+adjustment.y,z:nextPivot.z+adjustment.z};
  assembly.pieces=assemblySnap?.pieces||pieces;
  assemblyError=assemblyPlacementError(assembly.pieces,assembly.others,project.size,{allowFloating});
  assemblyControls.preview(assembly.pieces,!assemblyError);
  if(!assemblyPointer)assemblyControls.attach(assemblyPivot());
  renderAssembly();setStatus(assemblyError||(assemblySnap?'Encaje encontrado · Confirma para unir los conjuntos':'Conjunto en previsualización · Confirma o cancela'),!!assemblyError);
}
function rotateAssemblyDraft(){
  if(!assembly)return;
  refreshAssembly(rotateAssembly(assembly.pieces,1,assemblyPivot()),true,assemblyPivot());
  if(assemblyPointer)assemblyDragSource=assembly.pieces.map(p=>({...p}));
}
function hoverAssembly(hit){
  const source=assemblyDragSource||assembly.pieces;
  const anchor=source.reduce((a,b)=>a.y<=b.y?a:b);
  const next=candidateFromHit(anchor,hit);
  refreshAssembly(translateAssembly(source,{x:next.x-anchor.x,y:next.y-anchor.y,z:next.z-anchor.z}));
}
function requestAssemblyPlacement(){
  if(!assembly)return;
  if(assemblyError){toast(assemblyError,true);return;}
  assemblyConfirmation=assembly.pieces.map(p=>({...p}));
  openDialog(assemblySnap?'¿Unir los conjuntos aquí?':'¿Colocar el conjunto aquí?',`<p class="dialog-intro">Se moverán ${assembly.ids.size} piezas juntas. ${assemblySnap?'Los tetones y huecos quedan alineados con la otra construcción.':'Se conservarán las posiciones relativas de todas las piezas.'} Puedes deshacer el movimiento completo después.</p><div class="assembly-finish"><button data-action="assembly-confirm" class="primary">Sí, colocar aquí</button><button data-action="close-dialog">Seguir ajustando</button></div>`);
}
function confirmAssembly(){
  if(!assembly||!assemblyConfirmation)return;
  const error=assemblyPlacementError(assemblyConfirmation,assembly.others,project.size,{allowFloating});
  if(error){closeDialog();toast(error,true);return;}
  const next=assembly.result(project,assemblyConfirmation),count=assembly.ids.size;
  const changed=JSON.stringify(next.pieces)!==JSON.stringify(project.pieces);
  closeDialog();cancelAssembly();if(changed)commit(next);else renderState();
  updateDock();setStatus(`${count} piezas colocadas juntas. Pulsa otra pieza para seleccionar un conjunto.`);
}
function hover(hit){
  lastHit=hit;
  if(mode==='assembly'){if(assembly&&assemblyPointer&&hit&&!$('#dialog').open)hoverAssembly(hit);return;}
  if(!hit || (mode!=='build' && !(mode==='move'&&moving))){candidate=null;scene?.setGhost(null);return;}
  const base=moving||{id:'preview',part:partId,color,rotation};
  if(!hasGeometry(base.part)){candidate=null;scene?.setGhost(null);setStatus('Cargando la pieza…');return;}
  candidate=candidateFromHit({...base,rotation},hit);
  candidateError=placementError(candidate,project.pieces,project.size,{allowFloating,ignoreId:moving?.id});
  scene?.setGhost(candidate,!candidateError);
  setStatus(candidateError||`Colocar en X ${candidate.x} · Y ${candidate.y} · Z ${candidate.z}`,!!candidateError);
}
function clickScene(hit){
  if(mode==='assembly'){
    if(assembly){if(assemblyPointer&&hit){hoverAssembly(hit);requestAssemblyPlacement();}return;}
    if(hit?.piece)beginAssembly(hit.piece.id);
    return;
  }
  if(mode==='build'||(mode==='move'&&moving)){
    hover(hit);if(!candidate)return;
    if(candidateError){toast(candidateError,true);return;}
    const id=moving?.id||uid(),piece={...candidate,id};
    const pieces=moving?project.pieces.map(p=>p.id===id?piece:p):[...project.pieces,piece];
    const wasMove=!!moving;cancelMove();selectedId=id;editPieces(pieces);if(wasMove)mode='select';updateDock();setStatus('Pieza colocada');return;
  }
  if(!hit?.piece){setSelected(null);return;}
  if(mode==='select')setSelected(hit.piece.id);
  if(mode==='move')beginMove(hit.piece);
  if(mode==='paint'){setSelected(hit.piece.id);editPieces(project.pieces.map(p=>p.id===hit.piece.id?{...p,color}:p));}
  if(mode==='erase'){selectedId=null;editPieces(project.pieces.filter(p=>p.id!==hit.piece.id));}
}
function rotateSelected(){
  const p=selected();if(!p)return;
  const next={...p,rotation:(p.rotation+90)%360};
  const error=placementError(next,project.pieces,project.size,{allowFloating,ignoreId:p.id});
  if(error)return toast(error,true);
  cancelMove();editPieces(project.pieces.map(piece=>piece.id===next.id?next:piece));
}
function rotate(){if(assembly){rotateAssemblyDraft();return;}if(mode==='select'&&selected())return rotateSelected();rotation=(rotation+90)%360;updateDock();hover(lastHit);}
function undo(redo=false){cancelMove();const next=redo?history.redo(project):history.undo(project);if(next){project=next;selectedId=null;renderState();setStatus(redo?'Cambio rehecho':'Cambio deshecho');}}
async function load(next){await ensureGeometries(next.pieces.map(p=>p.part));cancelMove();selectedId=null;autosavePaused=false;manualLayer=null;mode='build';if(scene)scene.manualLayer=null;commit(next);scene?.view('iso');closeDialog();}
function download(blob,extension){
  const url=typeof blob==='string'?blob:URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`${project.name.replace(/[^\p{L}\p{N}_-]+/gu,'-').slice(0,80)||'bricklab'}.${extension}`;a.click();if(typeof blob!=='string')setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function openDialog(title,content){if(assemblyControls)assemblyControls.control.enabled=false;$('#dialog-title').textContent=title;$('#dialog-content').innerHTML=content;refreshIcons();if(!$('#dialog').open)$('#dialog').showModal();}
function closeDialog(){$('#dialog').close();}
function showNew(){openDialog('Un nuevo comienzo',`<p class="dialog-intro">El proyecto actual se puede recuperar con Deshacer. Guarda una copia si quieres conservarlo en Mis proyectos.</p><div class="option-list"><button data-action="blank">${icon('plus')}<span><strong>Una base en blanco</strong><small>Todo por imaginar. Base de 32 × 32.</small></span></button><button data-action="demo">${icon('box')}<span><strong>El pequeño pabellón</strong><small>Explora y transforma el modelo de ejemplo.</small></span></button></div>`);}
function showLibrary(){
  try{
    const entries=listProjects();
    openDialog('Mis proyectos',`<p class="dialog-intro">Copias guardadas en este navegador. Exporta un archivo para mover un diseño a otro ordenador.</p><button class="primary wide" data-action="import">${icon('upload')}Importar proyecto JSON</button><div class="saved-list">${entries.length?entries.map(e=>`<div class="saved-item"><button data-load="${escape(e.id)}"><strong>${escape(e.project.name)}</strong><small>${e.project.pieces.length} piezas · ${new Date(e.updated).toLocaleString('es-ES')}</small></button><button data-remove="${escape(e.id)}" aria-label="Borrar copia de ${escape(e.project.name)}" title="Borrar copia">${icon('trash-2')}</button></div>`).join(''):'<p class="empty-message">Todavía no has guardado ninguna copia. Usa «Guardar» para añadir tu primer proyecto.</p>'}</div>`);
  }catch(e){toast('No se pueden leer los proyectos guardados. Puedes exportar el proyecto actual.',true);}
}
function showExport(){openDialog('Llévate tu construcción',`<p class="dialog-intro">${project.pieces.length} piezas, una idea tuya.</p><div class="option-list"><button data-action="export-json">${icon('box')}<span><strong>Proyecto editable</strong><small>JSON · Para seguir construyendo en Bricklab</small></span></button><button data-action="export-glb">${icon('download')}<span><strong>Modelo 3D</strong><small>GLB · Para Blender y otros visores. Escala en metros.</small></span></button><button data-action="export-png">${icon('camera')}<span><strong>Foto de tu modelo</strong><small>PNG · La vista actual, sin controles</small></span></button><button data-action="export-csv">${icon('package')}<span><strong>Lista de piezas</strong><small>CSV · Tipo, color y cantidad</small></span></button></div>`);}
function showInventory(){
  const rows=inventory(project.pieces);
  openDialog('Lista de piezas',`<p class="dialog-intro">${project.pieces.length} piezas en ${rows.length} combinaciones de tipo y color.</p><div class="inventory-table"><table><thead><tr><th>Ref.</th><th>Pieza</th><th>Color</th><th>Cantidad</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${r.part}</td><td>${escape(PART_MAP[r.part].name)}</td><td><span class="inventory-swatch" style="background:${r.color}"></span>${COLORS.find(c=>c.hex===r.color)?.name||r.color}</td><td>${r.count}</td></tr>`).join('')}</tbody></table></div><button data-action="export-csv" class="primary wide">${icon('download')}Descargar lista CSV</button>`);
}
function showPartInfo(id=partId){
  const p=PART_MAP[id];
  openDialog(p.name,`<div class="part-detail-preview">${thumbs[id]?`<img src="${thumbs[id]}" alt="${escape(p.name)}">`:''}<strong>Ref. LDraw ${p.id}</strong></div><p class="dialog-intro">${escape(p.description)}</p><dl class="shortcuts"><div><dt>Categoría</dt><dd>${p.category}</dd></div><div><dt>Espacio ocupado</dt><dd>${p.w} × ${p.d} tetones</dd></div><div><dt>Altura del cuerpo</dt><dd>${p.h} placas</dd></div><div><dt>Tetones superiores</dt><dd>${p.top.length||'Cara lisa'}</dd></div></dl><p class="field-help">${p.category==='Ruedas'?'Ruedas y neumáticos son piezas independientes. Puedes colocarlos en la base o usar el modo libre; aún no hay encaje de ejes.':'El encaje usa tetones y huecos verticales. Los tetones laterales, clips y asas se muestran en 3D, pero su unión lateral todavía no está disponible. Los colores son libres.'}</p><div class="source-links"><a href="${p.sourceUrl}" target="_blank" rel="noopener noreferrer">Archivo original LDraw ↗</a><a href="https://www.lego.com/es-es/pick-and-build/pick-a-brick?query=${p.id.replace(/[a-z]+$/,'')}" target="_blank" rel="noopener noreferrer">Buscar referencia en LEGO ↗</a></div><p class="field-help">Geometría de la comunidad LDraw; no es una biblioteca publicada por LEGO. <button data-action="credits" class="inline-link">Autores y licencias</button></p>`);
}
function showCredits(){openDialog('Piezas, fuentes y créditos',`<p class="dialog-intro">${PARTS.length} modelos de la biblioteca LDraw.org, edición 2026-08. LDraw es un proyecto comunitario independiente que representa piezas reales de LEGO.</p><p class="field-help">Los modelos se han triangulado, escalado y recoloreado para Bricklab. Se conservan las atribuciones de los autores y las licencias CC BY 2.0 y/o CC BY 4.0 de cada archivo y sus dependencias.</p><div class="source-links"><a href="https://library.ldraw.org/" target="_blank" rel="noopener noreferrer">Biblioteca LDraw ↗</a><a href="/ldraw/attribution.json" target="_blank" rel="noopener noreferrer">Autores y fuentes de las ${PARTS.length} piezas ↗</a><a href="/ldraw/CAreadme.txt" target="_blank" rel="noopener noreferrer">Condiciones y atribución ↗</a><a href="/ldraw/CAlicense.txt" target="_blank" rel="noopener noreferrer">Licencia CC BY 2.0 ↗</a><a href="/ldraw/CAlicense4.txt" target="_blank" rel="noopener noreferrer">Licencia CC BY 4.0 ↗</a></div><p class="field-help">Los colores son de libre elección; el catálogo no verifica existencias ni combinaciones comerciales. El encaje lateral, los ejes, pasadores y bisagras y las simulaciones de resistencia quedan fuera de esta versión. Los conjuntos giran alrededor del eje vertical; aún no se pueden inclinar en X/Z.</p>`);}
function showSettings(){openDialog('Base y encaje',`<label class="field-label">Tamaño de la base<select id="base-size">${[16,32,48,64].map(s=>`<option value="${s}" ${project.size===s?'selected':''}>${s} × ${s} tetones</option>`).join('')}</select></label><p class="field-help">La base no se puede reducir si alguna pieza queda fuera.</p><label class="toggle-row"><span>Mostrar cuadrícula y tetones</span><input id="grid-toggle" type="checkbox" ${scene?.grid.visible?'checked':''}></label><label class="toggle-row"><span>Permitir piezas en el aire</span><input id="floating-toggle" type="checkbox" ${allowFloating?'checked':''}></label><p class="field-help">Útil para bocetar. Las piezas sin conexión a la base se señalan en el editor.</p><label class="toggle-row"><span>Elegir la altura manualmente</span><input id="layer-toggle" type="checkbox" ${manualLayer!==null?'checked':''}></label><label class="field-label">Altura de colocación (placas)<input id="manual-layer" type="number" min="0" max="299" step="0.5" value="${manualLayer??0}" ${manualLayer===null?'disabled':''}></label><p class="field-help">1 ladrillo = 3 placas. En automático, se usa la superficie que señales.</p>`);}
function showHelp(){openDialog('Unas pistas para construir',`<div class="help-steps"><p><strong>1. Elige una pieza y un color.</strong> La silueta muestra dónde se colocará. Verde significa que encaja; rojo indica un solapamiento o falta de apoyo.</p><p><strong>2. Pulsa para colocar; arrastra para mirar.</strong> En móvil, toca para colocar y usa dos dedos para acercar o desplazar la cámara.</p><p><strong>3. Construye sobre los tetones.</strong> El ladrillo básico tiene 3 placas de altura. Las pendientes solo tienen tetones en su zona de encaje; las baldosas lisas no permiten encajar encima. Puedes buscar piezas por nombre, tamaño o referencia LDraw.</p><p><strong>4. Une construcciones separadas con Conjunto (G).</strong> Pulsa una pieza para recoger todas las conectadas. Arrastra los ejes X/Y/Z, usa el aro de giro vertical o «Colocar con puntero». El encaje cercano se previsualiza y siempre pide confirmación. Esc cancela; Deshacer revierte todo el movimiento.</p></div><dl class="shortcuts">${[['B / V','Construir / seleccionar'],['M / P / X','Mover / pintar / borrar'],['G','Seleccionar conjunto conectado'],['R','Girar 90°'],['Supr / Retroceso','Eliminar selección'],['Ctrl o ⌘ + D','Duplicar selección'],['Ctrl o ⌘ + Z','Deshacer'],['Ctrl o ⌘ + Shift + Z','Rehacer'],['Ctrl o ⌘ + S','Guardar una copia'],['F','Centrar la cámara'],['Esc','Cancelar movimiento o selección']].map(([key,value])=>`<div><dt>${key}</dt><dd>${value}</dd></div>`).join('')}</dl><p class="field-help">Las dimensiones son nominales. Bricklab es un prototipo independiente de construcción; no calcula resistencia, tolerancias de fabricación ni disponibilidad de piezas comerciales.</p>`);}

const actions={
  'assembly-cancel':()=>{cancelAssembly();renderSelection();updateDock();setStatus('Movimiento cancelado. Pulsa una pieza para seleccionar otro conjunto.');},
  'assembly-translate':()=>{if(!assembly)return;assemblyPointer=false;assemblyControls.setMode('translate');assemblyControls.attach(assemblyPivot());renderAssembly();},
  'assembly-gizmo-rotate':()=>{if(!assembly)return;assemblyPointer=false;assemblyControls.setMode('rotate');assemblyControls.attach(assemblyPivot());renderAssembly();},
  'assembly-pointer':()=>{if(!assembly)return;assemblyPointer=true;assemblyDragSource=assembly.pieces.map(p=>({...p}));assemblyControls.detach();renderAssembly();setStatus('Señala el destino y pulsa para revisar la colocación. R gira el conjunto.');},
  'assembly-position':()=>{
    if(!assembly)return;const b=bounds(assembly.pieces),delta={};
    for(const axis of ['x','y','z']){const value=$(`[data-assembly-coordinate="${axis}"]`).value,n=Number(value);if(!value.trim()||!Number.isFinite(n)||!Number.isInteger(n*2))return toast('Usa coordenadas en pasos de 0,5.',true);delta[axis]=n-b[axis];}
    assemblyPointer=false;refreshAssembly(translateAssembly(assembly.pieces,delta));
  },
  'assembly-apply':requestAssemblyPlacement,'assembly-confirm':confirmAssembly,
  'part-info':()=>showPartInfo(), 'selection-info':()=>showPartInfo(selectedId?selected().part:partId),credits:showCredits,
  new:showNew,blank:()=>load({format:'bricklab',version:FORMAT_VERSION,name:'Mi nueva construcción',size:32,pieces:[]}),demo:()=>load(demoProject()),
  library:showLibrary,export:showExport,inventory:showInventory,settings:showSettings,help:showHelp,
  'close-dialog':closeDialog,'toggle-catalog':()=>$('#catalog-panel').classList.toggle('is-open'),
  save:()=>{try{saveProject(project);toast('Copia guardada en Mis proyectos.');}catch(e){toast('No se pudo guardar. Exporta el proyecto como JSON para conservarlo.',true);}},
  import:()=>$('#import-file').click(),
  'export-json':()=>download(new Blob([JSON.stringify(project,null,2)],{type:'application/json'}),'json'),
  'export-png':()=>{if(!scene)return toast('La vista 3D no está disponible.',true);download(scene.capture(),'png');},
  'export-glb':async()=>{if(!scene)return toast('La vista 3D no está disponible.',true);if(!project.pieces.length)return toast('Añade alguna pieza antes de exportar.');toast('Preparando el modelo 3D…');try{const buffer=await scene.exportGLB();download(new Blob([buffer],{type:'model/gltf-binary'}),'glb');toast('Modelo 3D exportado.');}catch(e){toast('No se ha podido exportar el modelo 3D. Conserva una copia JSON.',true);}},
  'export-csv':()=>{const rows=[['Referencia LDraw','Pieza','Color','Hex','Cantidad'],...inventory(project.pieces).map(r=>[r.part,PART_MAP[r.part].name,COLORS.find(c=>c.hex===r.color)?.name||r.color,r.color,r.count])];download(new Blob(['\ufeff'+rows.map(r=>r.map(v=>`"${String(v).replaceAll('"','""')}"`).join(';')).join('\r\n')],{type:'text/csv;charset=utf-8'}),'csv');},
  undo:()=>undo(),redo:()=>undo(true),rotate,'rotate-selection':rotateSelected,
  deselect:()=>{cancelMove();setSelected(null);updateDock();},
  'move-selection':()=>beginMove(selected()),
  duplicate:()=>{const p=selected();if(!p)return toast('Selecciona una pieza para duplicarla.');cancelMove();partId=p.part;color=p.color;rotation=p.rotation;mode='build';renderCatalog();updateDock();toast('Copia lista. Elige dónde colocarla.');},
  delete:()=>{if(!selected())return;cancelMove();const id=selectedId;selectedId=null;editPieces(project.pieces.filter(p=>p.id!==id));},
  'apply-position':()=>{
    const p=selected();if(!p)return;
    const next={...p};for(const axis of ['x','y','z']){const input=$(`[data-coordinate="${axis}"]`);if(!input.value.trim())return toast('Completa las tres coordenadas.',true);next[axis]=Number(input.value);}
    const error=placementError(next,project.pieces,project.size,{allowFloating,ignoreId:p.id});if(error)return toast(error,true);
    cancelMove();editPieces(project.pieces.map(piece=>piece.id===p.id?next:piece));
  },
  fit:()=>scene?.view('iso'),'zoom-in':()=>scene?.zoom(.8),'zoom-out':()=>scene?.zoom(1.25),
};

document.addEventListener('click',async e=>{
  const el=e.target.closest('button');if(!el)return;
  if(el.dataset.action){
    if(assembly&&!el.dataset.action.startsWith('assembly-')&&!['rotate','close-dialog','fit','zoom-in','zoom-out','toggle-catalog'].includes(el.dataset.action)){cancelAssembly();renderSelection();updateDock();}
    await actions[el.dataset.action]?.();return;
  }
  if(el.dataset.mode){setMode(el.dataset.mode);return;}
  if(el.dataset.part){partId=el.dataset.part;rotation=0;setMode('build');renderCatalog();$('#catalog-panel').classList.remove('is-open');try{await ensureGeometry(el.dataset.part);hover(lastHit);}catch(error){toast(error.message,true);}return;}
  if(el.dataset.color){color=el.dataset.color;if(mode==='select'&&selected())editPieces(project.pieces.map(p=>p.id===selectedId?{...p,color}:p));updateDock();hover(lastHit);return;}
  if(el.dataset.view){scene?.view(el.dataset.view);return;}
  if(el.dataset.load){try{const entry=listProjects().find(p=>p.id===el.dataset.load);if(entry)await load(entry.project);}catch(error){toast('No se pudo abrir el proyecto.',true);}return;}
  if(el.dataset.remove){const id=el.dataset.remove;openDialog('¿Borrar esta copia?',`<p class="dialog-intro">Se eliminará de Mis proyectos. La construcción que tienes abierta se conserva.</p><button class="danger wide" id="confirm-remove">Borrar copia</button>`);$('#confirm-remove').onclick=()=>{try{removeProject(id);showLibrary();}catch(error){toast('No se pudo borrar la copia.',true);}};}
});
$('#category-filter').addEventListener('change',e=>{category=e.target.value;renderCatalog();$('#parts-grid').scrollTop=0;});
$('#search').addEventListener('input',e=>{filter=e.target.value;renderCatalog();});
$('#project-name').addEventListener('change',e=>{const name=e.target.value.trim()||'Sin título';if(name!==project.name)commit({...project,name});else e.target.value=name;});
$('#dialog').addEventListener('click',e=>{if(e.target===$('#dialog')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeDialog();}});
$('#dialog').addEventListener('close',()=>{if(assemblyControls)assemblyControls.control.enabled=!!assembly&&!assemblyPointer;assemblyConfirmation=null;});
document.addEventListener('change',e=>{
  if(e.target.id==='base-size'){
    const size=Number(e.target.value),error=project.pieces.some(p=>{const d=dimensions(p);return p.x+d.w>size||p.z+d.d>size;});
    if(error){toast('Hay piezas fuera de esa base. Muévelas antes de reducirla.',true);e.target.value=project.size;return;}cancelMove();commit({...project,size});scene?.view('iso');
  }
  if(e.target.id==='grid-toggle')scene?.toggleGrid(e.target.checked);
  if(e.target.id==='floating-toggle')allowFloating=e.target.checked;
  if(e.target.id==='layer-toggle'){$('#manual-layer').disabled=!e.target.checked;manualLayer=e.target.checked?Number($('#manual-layer').value):null;if(scene)scene.manualLayer=manualLayer;}
  if(e.target.id==='manual-layer'){const n=Number(e.target.value);if(!Number.isInteger(n*2)||n<0||n>299){e.target.value=manualLayer??0;return;}manualLayer=n;if(scene)scene.manualLayer=n;}
});
$('#import-file').addEventListener('change',async e=>{
  const file=e.target.files?.[0];if(!file)return;
  try{if(file.size>5*1024*1024)throw new Error('El archivo supera el límite de 5 MB.');const next=parseProject(JSON.parse(await file.text()));await load(next);toast('Proyecto importado.');}catch(error){toast(error instanceof SyntaxError?'El archivo no contiene un JSON válido.':error.message,true);}finally{e.target.value='';}
});
document.addEventListener('keydown',e=>{
  if(e.target.closest('input,textarea,select,[contenteditable="true"]')||$('#dialog').open)return;
  const key=e.key.toLowerCase(),cmd=e.ctrlKey||e.metaKey;
  if(assembly&&(key==='delete'||key==='backspace'||(cmd&&key==='d'))){e.preventDefault();toast('Confirma o cancela el movimiento del conjunto primero.');return;}
  if(cmd&&['z','y','s','d'].includes(key)){e.preventDefault();if(key==='z')undo(e.shiftKey);if(key==='y')undo(true);if(key==='s')actions.save();if(key==='d')actions.duplicate();return;}
  if(cmd||e.altKey)return;
  if(key==='escape'){cancelMove();setSelected(null);updateDock();}
  if(key==='delete'||key==='backspace'){e.preventDefault();actions.delete();}
  if(key==='r')rotate();if(key==='f')scene?.view('iso');
  const modes={b:'build',v:'select',m:'move',g:'assembly',p:'paint',x:'erase'};
  if(modes[key]){if(key==='m'&&selected())beginMove(selected());else setMode(modes[key]);}
});
window.addEventListener('pagehide',()=>{if(!autosavePaused){try{saveAutosave(project);}catch(e){/* the visible save indicator reports failures while the page is active */}}});

renderCatalog();renderState();refreshIcons();
try{
  await ensureGeometries([...project.pieces.map(p=>p.part),partId]);
  scene=new BuilderScene($('#stage'),{onHover:hover,onClick:clickScene});
  assemblyControls=new AssemblyControls(scene,{
    onStart:()=>{if(assembly)assemblyDragSource=assembly.pieces.map(p=>({...p}));},
    onChange:({delta,turns,pivot})=>{if(assembly&&assemblyDragSource)refreshAssembly(translateAssembly(rotateAssembly(assemblyDragSource,turns,pivot),delta),true,{x:pivot.x+delta.x,y:pivot.y+delta.y,z:pivot.z+delta.z});},
    onEnd:()=>{if(!assembly)return;assemblyControls.attach(assemblyPivot());if(assemblySnap&&!assemblyError)requestAssemblyPlacement();},
  });
  scene.sync(project.pieces);scene.view('iso');
  try{thumbnailRenderer=createThumbnailRenderer();observeThumbnails();renderCatalog();}catch(error){toast('No se pudieron generar las miniaturas. El editor 3D sigue disponible.',true);}
}catch(error){console.error('3D initialization failed',error);$('#webgl-error').hidden=false;}
finally{$('#loading-model').hidden=true;}
if(storageError)toast(storageError,true);
