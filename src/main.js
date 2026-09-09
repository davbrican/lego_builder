import './style.css';
import {createIcons, Box, Plus, MousePointer2, Move, Paintbrush, Eraser, RotateCw, Undo2, Redo2, Save, FolderOpen, Download, Upload, Search, X, Copy, Trash2, Grid3x3, Layers, ChevronDown, Expand, Camera, HelpCircle, Check, ZoomIn, ZoomOut, Package, Menu, ArrowUpRight} from 'lucide';
import {PARTS, PART_MAP, COLORS, dimensions} from './catalog.js';
import {uid, placementError, parseProject, inventory, bounds, connectedIds, History, demoProject} from './model.js';
import {loadAutosave, saveAutosave, saveProject, listProjects, removeProject} from './storage.js';
import {BuilderScene, renderThumbnails} from './scene.js';

const icons={Box,Plus,MousePointer2,Move,Paintbrush,Eraser,RotateCw,Undo2,Redo2,Save,FolderOpen,Download,Upload,Search,X,Copy,Trash2,Grid3x3,Layers,ChevronDown,Expand,Camera,HelpCircle,Check,ZoomIn,ZoomOut,Package,Menu,ArrowUpRight};
const icon=name=>`<i data-lucide="${name}" aria-hidden="true"></i>`;
const $=s=>document.querySelector(s);
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const button=(action,label,ico,cls='')=>`<button data-action="${action}" class="${cls}" title="${label}" aria-label="${label}">${icon(ico)}</button>`;
const history=new History();
let project=demoProject(),storageError=null,autosavePaused=false;
try{project=loadAutosave()||project;}catch(e){storageError='No se pudo recuperar el autoguardado. Puedes importar una copia o iniciar un proyecto nuevo.';autosavePaused=true;}
let scene, mode='build',partId='brick-2x4',color=COLORS[0].hex,rotation=0,selectedId=null,moving=null,candidate=null,candidateError=null,category='Todas',filter='',thumbs={},saveTimer,toastTimer,lastHit=null,allowFloating=false,manualLayer=null;

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
      <label class="search-field">${icon('search')}<input id="search" placeholder="Buscar una pieza…" aria-label="Buscar pieza"></label>
      <div class="categories" role="group" aria-label="Tipo de pieza">${['Todas','Ladrillos','Placas','Baldosas'].map(c=>`<button data-category="${c}" aria-pressed="${c==='Todas'}" class="${c==='Todas'?'active':''}">${c}</button>`).join('')}</div>
      <div class="catalog-meta"><span id="catalog-count">${PARTS.length} piezas</span><span>Tetones ${icon('grid3x3')}</span></div>
      <div class="parts-grid" id="parts-grid"></div>
      <section class="palette"><div class="section-title"><h2>Color</h2><span id="color-name">Rojo</span></div><div class="swatches">${COLORS.map(c=>`<button data-color="${c.hex}" class="swatch" style="--swatch:${c.hex}" title="${c.name}" aria-label="${c.name}" aria-pressed="${c.hex===color}"></button>`).join('')}</div></section>
      <div class="catalog-footer">${icon('box')}<span>Sin límite de imaginación.</span></div>
    </aside>
    <section class="stage" id="stage" aria-label="Editor 3D">
      <div class="stage-top">
        <div class="stage-label"><span class="eyebrow">MESA DE CONSTRUCCIÓN</span><span id="base-label">Base ${project.size} × ${project.size}</span></div>
        <div class="stage-options">${button('new','Nuevo proyecto','plus')}${button('settings','Base y encaje','layers')}${button('help','Controles y atajos','help-circle')}</div>
      </div>
      <div class="toolrail" role="group" aria-label="Herramientas">
        <button data-action="toggle-catalog" class="mobile-only" title="Piezas" aria-label="Abrir piezas">${icon('menu')}</button>
        ${[['build','plus','Construir (B)'],['select','mouse-pointer-2','Seleccionar (V)'],['move','move','Mover (M)'],['paint','paintbrush','Pintar (P)'],['erase','eraser','Borrar (X)']].map(([m,i,t])=>`<button data-mode="${m}" title="${t}" aria-label="${t}" aria-pressed="${mode===m}" class="${mode===m?'active':''}">${icon(i)}</button>`).join('')}
        <span class="tool-divider"></span>${button('undo','Deshacer (Ctrl/Cmd Z)','undo-2')}${button('redo','Rehacer (Ctrl/Cmd Shift Z)','redo-2')}
      </div>
      <div class="selection-card" id="selection-card" hidden></div>
      <div class="view-controls"><button data-view="iso" class="view-main" title="Vista isométrica">3D</button><button data-view="top" title="Vista superior">Superior</button><button data-view="front" title="Vista frontal">Frontal</button><span></span>${button('fit','Centrar modelo (F)','expand')}${button('zoom-in','Acercar','zoom-in')}${button('zoom-out','Alejar','zoom-out')}</div>
      <div class="floating-notice" id="floating-notice" hidden></div>
      <div class="build-dock"><div class="active-part"><span class="active-swatch" id="active-swatch"></span><div><strong id="active-part-name">Ladrillo 2 × 4</strong><span id="active-mode-label">Clic en la base para construir</span></div></div><button data-action="rotate" title="Girar 90° (R)">${icon('rotate-cw')}<span id="rotation-label">0°</span><kbd>R</kbd></button></div>
      <div class="canvas-help">Arrastra para orbitar <span>·</span> Rueda para acercar <span>·</span> Botón derecho para desplazar</div>
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
  const normalized=filter.toLowerCase().replaceAll('x','×');
  const parts=PARTS.filter(p=>(category==='Todas'||p.category===category)&&p.name.toLowerCase().includes(normalized));
  $('#catalog-count').textContent=`${parts.length} piezas`;
  $('#parts-grid').innerHTML=parts.length?parts.map(p=>`<button class="part-card ${p.id===partId?'active':''}" data-part="${p.id}" aria-label="${p.name}" aria-pressed="${p.id===partId}"><span class="part-check">${icon('check')}</span>${thumbs[p.id]?`<img src="${thumbs[p.id]}" alt="" draggable="false">`:`<span class="part-fallback">${p.w} × ${p.d}</span>`}<strong>${p.w} × ${p.d}</strong><span>${p.category==='Ladrillos'?'Ladrillo':p.category==='Placas'?'Placa':'Baldosa lisa'}</span></button>`).join(''):'<p class="empty-message">No hay piezas con ese nombre.</p>';
  refreshIcons();
}
function selected(){return project.pieces.find(p=>p.id===selectedId);}
function renderSelection(){
  const piece=selected(),el=$('#selection-card');el.hidden=!piece;
  if(!piece)return;
  el.innerHTML=`<div class="section-title"><span class="eyebrow">PIEZA SELECCIONADA</span>${button('deselect','Deseleccionar','x')}</div><h2>${PART_MAP[piece.part].name}</h2><p>Posición en tetones · altura en placas</p><div class="coordinates">${['x','y','z'].map(axis=>`<label>${axis.toUpperCase()}<input data-coordinate="${axis}" type="number" step="1" min="0" max="${axis==='y'?299:project.size-1}" value="${piece[axis]}" aria-label="Posición ${axis.toUpperCase()}"></label>`).join('')}</div><button class="position-apply" data-action="apply-position">Aplicar posición</button><div class="selection-actions">${button('move-selection','Mover pieza (M)','move')}${button('duplicate','Duplicar (Ctrl/Cmd D)','copy')}${button('rotate-selection','Girar pieza','rotate-cw')}${button('delete','Eliminar (Supr)','trash-2')}</div>`;
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
function commit(next){history.record(project);project=next;renderState();}
function editPieces(pieces){commit({...project,pieces});}
function updateDock(){
  $('#active-part-name').textContent=moving?`Moviendo ${PART_MAP[moving.part].name.toLowerCase()}`:PART_MAP[partId].name;
  const labels={build:'Clic para colocar · R para girar',select:'Clic en una pieza para editarla',move:moving?'Clic para colocar · Esc para cancelar':'Elige la pieza que quieres mover',paint:'Clic en una pieza para pintarla',erase:'Clic en una pieza para borrarla'};
  $('#active-mode-label').textContent=labels[mode];$('#rotation-label').textContent=`${rotation}°`;
  $('#active-swatch').style.background=moving?.color||color;
  $('#color-name').textContent=COLORS.find(c=>c.hex===color)?.name||color;
  document.querySelectorAll('[data-color]').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.color===color)));
  document.querySelectorAll('[data-mode]').forEach(el=>{el.classList.toggle('active',el.dataset.mode===mode);el.setAttribute('aria-pressed',String(el.dataset.mode===mode));});
}
function cancelMove(){if(moving){scene?.hidePiece(moving.id,false);moving=null;}candidate=null;scene?.setGhost(null);}
function setMode(next){cancelMove();mode=next;updateDock();setStatus(({build:'Elige una pieza y colócala en la base',select:'Selecciona una pieza',move:'Selecciona la pieza que quieres mover',paint:'Elige un color y pulsa una pieza',erase:'Pulsa una pieza para borrarla'})[mode]);}
function setSelected(id){selectedId=id;scene?.select(id);renderSelection();}
function beginMove(piece){if(!piece){toast('Selecciona primero una pieza.');return;}cancelMove();mode='move';moving={...piece};rotation=piece.rotation;scene?.hidePiece(piece.id,true);setSelected(piece.id);updateDock();setStatus('Coloca la pieza en su nueva posición. Esc cancela.');}
function hover(hit){
  lastHit=hit;
  if(!hit || (mode!=='build' && !(mode==='move'&&moving))){candidate=null;scene?.setGhost(null);return;}
  const base=moving||{id:'preview',part:partId,color,rotation};
  const d=dimensions({...base,rotation});
  candidate={...base,rotation,x:Math.floor(hit.point.x)-Math.floor(d.w/2),z:Math.floor(hit.point.z)-Math.floor(d.d/2),y:hit.layer??(hit.piece?hit.piece.y+dimensions(hit.piece).h:0)};
  candidateError=placementError(candidate,project.pieces,project.size,{allowFloating,ignoreId:moving?.id});
  scene?.setGhost(candidate,!candidateError);
  setStatus(candidateError||`Colocar en X ${candidate.x} · Y ${candidate.y} · Z ${candidate.z}`,!!candidateError);
}
function clickScene(hit){
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
function rotate(){if(mode==='select'&&selected())return rotateSelected();rotation=(rotation+90)%360;updateDock();hover(lastHit);}
function undo(redo=false){cancelMove();const next=redo?history.redo(project):history.undo(project);if(next){project=next;selectedId=null;renderState();setStatus(redo?'Cambio rehecho':'Cambio deshecho');}}
function load(next){cancelMove();selectedId=null;autosavePaused=false;manualLayer=null;if(scene)scene.manualLayer=null;commit(next);scene?.view('iso');closeDialog();}
function download(blob,extension){
  const url=typeof blob==='string'?blob:URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`${project.name.replace(/[^\p{L}\p{N}_-]+/gu,'-').slice(0,80)||'bricklab'}.${extension}`;a.click();if(typeof blob!=='string')setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function openDialog(title,content){$('#dialog-title').textContent=title;$('#dialog-content').innerHTML=content;refreshIcons();if(!$('#dialog').open)$('#dialog').showModal();}
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
  openDialog('Lista de piezas',`<p class="dialog-intro">${project.pieces.length} piezas en ${rows.length} combinaciones de tipo y color.</p><div class="inventory-table"><table><thead><tr><th>Pieza</th><th>Color</th><th>Cantidad</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${PART_MAP[r.part].name}</td><td><span class="inventory-swatch" style="background:${r.color}"></span>${COLORS.find(c=>c.hex===r.color)?.name||r.color}</td><td>${r.count}</td></tr>`).join('')}</tbody></table></div><button data-action="export-csv" class="primary wide">${icon('download')}Descargar lista CSV</button>`);
}
function showSettings(){openDialog('Base y encaje',`<label class="field-label">Tamaño de la base<select id="base-size">${[16,32,48,64].map(s=>`<option value="${s}" ${project.size===s?'selected':''}>${s} × ${s} tetones</option>`).join('')}</select></label><p class="field-help">La base no se puede reducir si alguna pieza queda fuera.</p><label class="toggle-row"><span>Mostrar cuadrícula y tetones</span><input id="grid-toggle" type="checkbox" ${scene?.grid.visible?'checked':''}></label><label class="toggle-row"><span>Permitir piezas en el aire</span><input id="floating-toggle" type="checkbox" ${allowFloating?'checked':''}></label><p class="field-help">Útil para bocetar. Las piezas sin conexión a la base se señalan en el editor.</p><label class="toggle-row"><span>Elegir la altura manualmente</span><input id="layer-toggle" type="checkbox" ${manualLayer!==null?'checked':''}></label><label class="field-label">Altura de colocación (placas)<input id="manual-layer" type="number" min="0" max="299" step="1" value="${manualLayer??0}" ${manualLayer===null?'disabled':''}></label><p class="field-help">1 ladrillo = 3 placas. En automático, se usa la superficie que señales.</p>`);}
function showHelp(){openDialog('Unas pistas para construir',`<div class="help-steps"><p><strong>1. Elige una pieza y un color.</strong> La silueta muestra dónde se colocará. Verde significa que encaja; rojo indica un solapamiento o falta de apoyo.</p><p><strong>2. Pulsa para colocar; arrastra para mirar.</strong> En móvil, toca para colocar y usa dos dedos para acercar o desplazar la cámara.</p><p><strong>3. Construye sobre los tetones.</strong> Los ladrillos tienen 3 placas de altura. Las baldosas son lisas: no permiten encajar otra pieza por encima.</p></div><dl class="shortcuts">${[['B / V','Construir / seleccionar'],['M / P / X','Mover / pintar / borrar'],['R','Girar 90°'],['Supr / Retroceso','Eliminar selección'],['Ctrl o ⌘ + D','Duplicar selección'],['Ctrl o ⌘ + Z','Deshacer'],['Ctrl o ⌘ + Shift + Z','Rehacer'],['Ctrl o ⌘ + S','Guardar una copia'],['F','Centrar la cámara'],['Esc','Cancelar movimiento o selección']].map(([key,value])=>`<div><dt>${key}</dt><dd>${value}</dd></div>`).join('')}</dl><p class="field-help">Las dimensiones son nominales. Bricklab es un prototipo independiente de construcción; no calcula resistencia, tolerancias de fabricación ni disponibilidad de piezas comerciales.</p>`);}

const actions={
  new:showNew,blank:()=>load({format:'bricklab',version:1,name:'Mi nueva construcción',size:32,pieces:[]}),demo:()=>load(demoProject()),
  library:showLibrary,export:showExport,inventory:showInventory,settings:showSettings,help:showHelp,
  'close-dialog':closeDialog,'toggle-catalog':()=>$('#catalog-panel').classList.toggle('is-open'),
  save:()=>{try{saveProject(project);toast('Copia guardada en Mis proyectos.');}catch(e){toast('No se pudo guardar. Exporta el proyecto como JSON para conservarlo.',true);}},
  import:()=>$('#import-file').click(),
  'export-json':()=>download(new Blob([JSON.stringify(project,null,2)],{type:'application/json'}),'json'),
  'export-png':()=>{if(!scene)return toast('La vista 3D no está disponible.',true);download(scene.capture(),'png');},
  'export-glb':async()=>{if(!scene)return toast('La vista 3D no está disponible.',true);if(!project.pieces.length)return toast('Añade alguna pieza antes de exportar.');toast('Preparando el modelo 3D…');try{const buffer=await scene.exportGLB();download(new Blob([buffer],{type:'model/gltf-binary'}),'glb');toast('Modelo 3D exportado.');}catch(e){toast('No se ha podido exportar el modelo 3D. Conserva una copia JSON.',true);}},
  'export-csv':()=>{const rows=[['Pieza','Color','Hex','Cantidad'],...inventory(project.pieces).map(r=>[PART_MAP[r.part].name,COLORS.find(c=>c.hex===r.color)?.name||r.color,r.color,r.count])];download(new Blob(['\ufeff'+rows.map(r=>r.map(v=>`"${String(v).replaceAll('"','""')}"`).join(';')).join('\r\n')],{type:'text/csv;charset=utf-8'}),'csv');},
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
  if(el.dataset.action){await actions[el.dataset.action]?.();return;}
  if(el.dataset.mode){setMode(el.dataset.mode);return;}
  if(el.dataset.part){partId=el.dataset.part;rotation=0;setMode('build');renderCatalog();$('#catalog-panel').classList.remove('is-open');return;}
  if(el.dataset.color){color=el.dataset.color;if(mode==='select'&&selected())editPieces(project.pieces.map(p=>p.id===selectedId?{...p,color}:p));updateDock();hover(lastHit);return;}
  if(el.dataset.category){category=el.dataset.category;document.querySelectorAll('[data-category]').forEach(b=>{b.classList.toggle('active',b.dataset.category===category);b.setAttribute('aria-pressed',String(b.dataset.category===category));});renderCatalog();return;}
  if(el.dataset.view){scene?.view(el.dataset.view);return;}
  if(el.dataset.load){try{const entry=listProjects().find(p=>p.id===el.dataset.load);if(entry)load(entry.project);}catch(error){toast('No se pudo abrir el proyecto.',true);}return;}
  if(el.dataset.remove){const id=el.dataset.remove;openDialog('¿Borrar esta copia?',`<p class="dialog-intro">Se eliminará de Mis proyectos. La construcción que tienes abierta se conserva.</p><button class="danger wide" id="confirm-remove">Borrar copia</button>`);$('#confirm-remove').onclick=()=>{try{removeProject(id);showLibrary();}catch(error){toast('No se pudo borrar la copia.',true);}};}
});
$('#search').addEventListener('input',e=>{filter=e.target.value;renderCatalog();});
$('#project-name').addEventListener('change',e=>{const name=e.target.value.trim()||'Sin título';if(name!==project.name)commit({...project,name});else e.target.value=name;});
$('#dialog').addEventListener('click',e=>{if(e.target===$('#dialog')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeDialog();}});
document.addEventListener('change',e=>{
  if(e.target.id==='base-size'){
    const size=Number(e.target.value),error=project.pieces.some(p=>{const d=dimensions(p);return p.x+d.w>size||p.z+d.d>size;});
    if(error){toast('Hay piezas fuera de esa base. Muévelas antes de reducirla.',true);e.target.value=project.size;return;}cancelMove();commit({...project,size});scene?.view('iso');
  }
  if(e.target.id==='grid-toggle')scene?.toggleGrid(e.target.checked);
  if(e.target.id==='floating-toggle')allowFloating=e.target.checked;
  if(e.target.id==='layer-toggle'){$('#manual-layer').disabled=!e.target.checked;manualLayer=e.target.checked?Number($('#manual-layer').value):null;if(scene)scene.manualLayer=manualLayer;}
  if(e.target.id==='manual-layer'){const n=Number(e.target.value);if(!Number.isInteger(n)||n<0||n>299){e.target.value=manualLayer??0;return;}manualLayer=n;if(scene)scene.manualLayer=n;}
});
$('#import-file').addEventListener('change',async e=>{
  const file=e.target.files?.[0];if(!file)return;
  try{if(file.size>5*1024*1024)throw new Error('El archivo supera el límite de 5 MB.');const next=parseProject(JSON.parse(await file.text()));load(next);toast('Proyecto importado.');}catch(error){toast(error instanceof SyntaxError?'El archivo no contiene un JSON válido.':error.message,true);}finally{e.target.value='';}
});
document.addEventListener('keydown',e=>{
  if(e.target.closest('input,textarea,select,[contenteditable="true"]')||$('#dialog').open)return;
  const key=e.key.toLowerCase(),cmd=e.ctrlKey||e.metaKey;
  if(cmd&&['z','y','s','d'].includes(key)){e.preventDefault();if(key==='z')undo(e.shiftKey);if(key==='y')undo(true);if(key==='s')actions.save();if(key==='d')actions.duplicate();return;}
  if(cmd||e.altKey)return;
  if(key==='escape'){cancelMove();setSelected(null);updateDock();}
  if(key==='delete'||key==='backspace'){e.preventDefault();actions.delete();}
  if(key==='r')rotate();if(key==='f')scene?.view('iso');
  const modes={b:'build',v:'select',m:'move',p:'paint',x:'erase'};
  if(modes[key]){if(key==='m'&&selected())beginMove(selected());else setMode(modes[key]);}
});
window.addEventListener('pagehide',()=>{if(!autosavePaused){try{saveAutosave(project);}catch(e){/* the visible save indicator reports failures while the page is active */}}});

try{scene=new BuilderScene($('#stage'),{onHover:hover,onClick:clickScene});thumbs=renderThumbnails();}catch(error){console.error('3D initialization failed',error);$('#webgl-error').hidden=false;}
renderCatalog();renderState();scene?.view('iso');refreshIcons();
if(storageError)toast(storageError,true);
