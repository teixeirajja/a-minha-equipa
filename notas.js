import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const supabase=createClient(
  'https://nfnxqiseohcnkgjbgata.supabase.co',
  'sb_publishable_LR4VwEg_DQLmMhS7C7MZUA_ZTKk4KVl'
);

const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];
const esc=(v='')=>String(v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const uid=()=>crypto.randomUUID?.()||`${Date.now()}-${Math.random().toString(16).slice(2)}`;

let session=null;
let entries=[];
let activeFilter='ativas';
let editingId=null;
let editingType='NOTA';
let draftItems=[];

function toast(message){
  const el=$('#toast');
  el.textContent=message;
  el.classList.remove('hidden');
  clearTimeout(toast.timer);
  toast.timer=setTimeout(()=>el.classList.add('hidden'),2200);
}

function setStatus(text){$('#notesStatus').textContent=text}
function showError(message=''){
  const el=$('#notesError');
  el.textContent=message;
  el.classList.toggle('hidden',!message);
}
function fmtDate(value){
  if(!value)return '';
  const d=new Date(value);
  if(Number.isNaN(d.getTime()))return '';
  return new Intl.DateTimeFormat('pt-PT',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(d);
}

function normalizeItems(value){
  if(!Array.isArray(value))return [];
  return value.map(x=>({
    id:String(x?.id||uid()),
    texto:String(x?.texto||''),
    feito:Boolean(x?.feito)
  }));
}

async function loadNotes(){
  setStatus('A sincronizar…');
  showError('');
  const {data,error}=await supabase
    .from('notas_listas')
    .select('*')
    .order('fixada',{ascending:false})
    .order('atualizado_em',{ascending:false});

  if(error){
    if(error.code==='42P01' || error.code==='PGRST205'){
      showError('O módulo ainda precisa da migração 18_migracao_notas_listas.sql no Supabase.');
      entries=[];
      render();
      setStatus('Base de dados por preparar');
      return;
    }
    throw error;
  }

  entries=(data||[]).map(x=>({...x,itens:normalizeItems(x.itens)}));
  render();
  setStatus(`Sincronizado · ${new Date().toLocaleTimeString('pt-PT',{hour:'2-digit',minute:'2-digit'})}`);
}

function filteredEntries(){
  const q=String($('#notesSearch')?.value||'').trim().toLowerCase();
  return entries.filter(n=>{
    if(activeFilter==='ativas' && n.arquivada)return false;
    if(activeFilter==='nota' && (n.tipo!=='NOTA' || n.arquivada))return false;
    if(activeFilter==='lista' && (n.tipo!=='LISTA' || n.arquivada))return false;
    if(activeFilter==='fixadas' && (!n.fixada || n.arquivada))return false;
    if(activeFilter==='arquivadas' && !n.arquivada)return false;

    if(q){
      const hay=[n.titulo,n.conteudo,...normalizeItems(n.itens).map(i=>i.texto)]
        .join(' ')
        .toLowerCase();
      if(!hay.includes(q))return false;
    }
    return true;
  }).sort((a,b)=>
    Number(b.fixada)-Number(a.fixada) ||
    String(b.atualizado_em||'').localeCompare(String(a.atualizado_em||''))
  );
}

function listPreview(n){
  const items=normalizeItems(n.itens);
  const visible=items.slice(0,6);
  return `<div class="note-check-preview">
    ${visible.map(i=>`<label class="note-check-row ${i.feito?'done':''}">
      <input class="quick-check" data-note="${n.id}" data-item="${esc(i.id)}" type="checkbox" ${i.feito?'checked':''}>
      <span>${esc(i.texto||'Sem texto')}</span>
    </label>`).join('')}
    ${items.length>visible.length?`<div class="note-check-more">+ ${items.length-visible.length} item(ns)</div>`:''}
    ${items.length===0?'<div class="note-check-more">Lista vazia</div>':''}
  </div>`;
}

function render(){
  const rows=filteredEntries();
  const active=entries.filter(n=>!n.arquivada);
  const lists=active.filter(n=>n.tipo==='LISTA');
  const pending=lists.reduce((sum,n)=>sum+normalizeItems(n.itens).filter(i=>!i.feito).length,0);

  $('#notesSummary').innerHTML=`
    <span><strong>${active.length}</strong> ativo${active.length===1?'':'s'}</span>
    <span><strong>${lists.length}</strong> lista${lists.length===1?'':'s'}</span>
    <span><strong>${pending}</strong> item${pending===1?'':'s'} por concluir</span>
    <span><strong>${entries.filter(n=>n.fixada&&!n.arquivada).length}</strong> fixada${entries.filter(n=>n.fixada&&!n.arquivada).length===1?'':'s'}</span>`;

  $('#notesGrid').innerHTML=rows.length?rows.map(n=>{
    const type=n.tipo==='LISTA'?'Lista':'Nota';
    return `<article class="note-card ${n.fixada?'pinned':''} ${n.arquivada?'archived':''}" data-id="${n.id}">
      <div class="note-card-head">
        <span class="note-card-type">${n.tipo==='LISTA'?'☑':'✎'} ${type}${n.fixada?' · Fixada':''}</span>
        <span class="note-card-date">${esc(fmtDate(n.atualizado_em))}</span>
      </div>
      <h3>${esc(n.titulo)}</h3>
      ${n.tipo==='LISTA'
        ? listPreview(n)
        : `<p class="note-preview">${esc(n.conteudo||'Sem conteúdo.')}</p>`}
      <div class="note-card-actions">
        <button type="button" data-action="edit">Editar</button>
        <button type="button" data-action="pin">${n.fixada?'Desafixar':'Fixar'}</button>
        <button type="button" data-action="archive">${n.arquivada?'Restaurar':'Arquivar'}</button>
        <button type="button" class="danger" data-action="delete">Apagar</button>
      </div>
    </article>`;
  }).join(''):`<div class="notes-empty"><strong>Nada por aqui.</strong><span>Cria uma nota ou uma lista para começar.</span></div>`;

  bindCardEvents();
}

function bindCardEvents(){
  $$('.note-card-actions button').forEach(btn=>btn.onclick=async()=>{
    const card=btn.closest('.note-card');
    const id=card?.dataset.id;
    const note=entries.find(n=>String(n.id)===String(id));
    if(!note)return;
    const action=btn.dataset.action;
    if(action==='edit')return openEditor(note.tipo,note);
    if(action==='delete')return deleteNote(note);
    if(action==='pin')return patchNote(note.id,{fixada:!note.fixada});
    if(action==='archive')return patchNote(note.id,{arquivada:!note.arquivada});
  });

  $$('.quick-check').forEach(ch=>ch.onchange=async e=>{
    e.stopPropagation();
    const note=entries.find(n=>String(n.id)===String(ch.dataset.note));
    if(!note)return;
    const items=normalizeItems(note.itens).map(i=>
      String(i.id)===String(ch.dataset.item)?{...i,feito:ch.checked}:i
    );
    try{
      await patchNote(note.id,{itens:items},false);
      toast(ch.checked?'Item concluído.':'Item reaberto.');
    }catch(e){
      ch.checked=!ch.checked;
      toast(e.message);
    }
  });
}

async function patchNote(id,patch,notify=true){
  const payload={...patch,atualizado_em:new Date().toISOString()};
  const {error}=await supabase.from('notas_listas').update(payload).eq('id',id);
  if(error)throw error;
  await loadNotes();
  if(notify)toast('Atualizado.');
}

async function deleteNote(note){
  if(!confirm(`Apagar definitivamente “${note.titulo}”?`))return;
  const {error}=await supabase.from('notas_listas').delete().eq('id',note.id);
  if(error)return toast(error.message);
  await loadNotes();
  toast('Apagado.');
}

function openEditor(type,note=null){
  editingId=note?.id||null;
  editingType=type==='LISTA'?'LISTA':'NOTA';
  draftItems=editingType==='LISTA'?normalizeItems(note?.itens):[];

  $('#noteEditorTitle').textContent=note
    ? `Editar ${editingType==='LISTA'?'lista':'nota'}`
    : `Nova ${editingType==='LISTA'?'lista':'nota'}`;
  $('#noteTitle').value=note?.titulo||'';
  $('#noteContent').value=note?.conteudo||'';
  $('#noteTextBox').classList.toggle('hidden',editingType!=='NOTA');
  $('#noteListBox').classList.toggle('hidden',editingType!=='LISTA');
  renderCheckEditor();
  $('#noteEditor').showModal();
  setTimeout(()=>$('#noteTitle').focus(),50);
}

function renderCheckEditor(){
  if(editingType!=='LISTA')return;
  $('#checkEditor').innerHTML=draftItems.length?draftItems.map((i,index)=>`
    <div class="check-editor-row" data-index="${index}">
      <input class="draft-check" type="checkbox" ${i.feito?'checked':''} aria-label="Concluído">
      <input class="draft-text" type="text" maxlength="500" value="${esc(i.texto)}" placeholder="Novo item">
      <button class="draft-delete" type="button" aria-label="Eliminar item">×</button>
    </div>`).join(''):'<div class="notes-status">Ainda não há itens.</div>';

  $$('.check-editor-row').forEach(row=>{
    const index=Number(row.dataset.index);
    row.querySelector('.draft-check').onchange=e=>draftItems[index].feito=e.target.checked;
    row.querySelector('.draft-text').oninput=e=>draftItems[index].texto=e.target.value;
    row.querySelector('.draft-delete').onclick=()=>{
      draftItems.splice(index,1);
      renderCheckEditor();
    };
  });
}

async function saveEditor(){
  const titulo=$('#noteTitle').value.trim();
  if(!titulo)return toast('Indica um título.');

  const payload={
    tipo:editingType,
    titulo,
    conteudo:editingType==='NOTA'?$('#noteContent').value.trim():'',
    itens:editingType==='LISTA'
      ? draftItems.map(i=>({...i,texto:String(i.texto||'').trim()})).filter(i=>i.texto)
      : [],
    atualizado_em:new Date().toISOString()
  };

  $('#noteEditorSave').disabled=true;
  try{
    let error;
    if(editingId){
      ({error}=await supabase.from('notas_listas').update(payload).eq('id',editingId));
    }else{
      ({error}=await supabase.from('notas_listas').insert({...payload,user_id:session.user.id}));
    }
    if(error)throw error;
    $('#noteEditor').close();
    await loadNotes();
    toast(editingId?'Alterações guardadas.':'Criado.');
  }catch(e){
    toast(e.message);
  }finally{
    $('#noteEditorSave').disabled=false;
  }
}

function closeEditor(){
  if($('#noteEditor').open)$('#noteEditor').close();
}

async function boot(){
  const {data,error}=await supabase.auth.getSession();
  if(error){showError(error.message);return}
  session=data.session;
  if(!session){window.location.replace('index.html');return}
  $('#notesEmail').textContent=session.user.email||'';
  try{await loadNotes()}catch(e){showError(e.message);setStatus('Erro de sincronização')}
}

$('#newNoteBtn').onclick=()=>openEditor('NOTA');
$('#newListBtn').onclick=()=>openEditor('LISTA');
$('#noteEditorClose').onclick=closeEditor;
$('#noteEditorCancel').onclick=closeEditor;
$('#noteEditorSave').onclick=saveEditor;
$('#addCheckItem').onclick=()=>{
  draftItems.push({id:uid(),texto:'',feito:false});
  renderCheckEditor();
  const fields=$$('.draft-text');
  fields.at(-1)?.focus();
};
$('#notesSearch').oninput=render;
$$('.notes-filter').forEach(btn=>btn.onclick=()=>{
  activeFilter=btn.dataset.filter;
  $$('.notes-filter').forEach(x=>x.classList.toggle('active',x===btn));
  render();
});
$('#notesLogout').onclick=()=>supabase.auth.signOut();
supabase.auth.onAuthStateChange((event,newSession)=>{
  if(event==='SIGNED_OUT' || (!newSession && event!=='INITIAL_SESSION')){
    window.location.replace('index.html');
  }
});

boot();
