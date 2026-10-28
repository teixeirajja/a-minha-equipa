import {client,$,$$,context,state,esc,csv,toast,personSort,eligible,rowsFor,personFor,progress,statusLabel,load} from './listagens-core.js?v=6.14';

let editId=null,detailId=null,selected=new Set();

function dialogs(){
  if($('#qglEditor'))return;
  document.body.insertAdjacentHTML('beforeend',`
  <dialog id="qglEditor" class="qgl-dialog"><div class="modal-head"><div><h3 id="qglEditorTitle">Nova listagem</h3><small class="muted">Não cria eventos nem altera disponibilidade.</small></div><button class="icon qgl-ec">×</button></div>
  <div class="qgl-dialog-body"><div class="qgl-editor-grid"><label>Título<input id="qglTitle" maxlength="120" placeholder="Ex.: Fotografias"></label><label>Campo adicional (opcional)<input id="qglExtra" maxlength="80" placeholder="Ex.: Tamanho / Nº cartão"></label><label class="full">Descrição<textarea id="qglDesc" maxlength="1200"></textarea></label></div>
  <div class="qgl-person-toolbar"><input id="qglPS" type="search" placeholder="Pesquisar pessoa..."><button class="secondary" id="qglAll">Selecionar todos</button><button class="secondary" id="qglNone">Limpar</button><span id="qglCount"></span></div><div id="qglPicker" class="qgl-people-picker"></div></div>
  <div class="modal-actions"><button class="secondary qgl-ec">Cancelar</button><button class="primary" id="qglSaveList">Guardar listagem</button></div></dialog>
  <dialog id="qglDetail" class="qgl-dialog"><div class="modal-head"><div><h3 id="qglDT">Listagem</h3><small id="qglDS" class="muted"></small></div><button class="icon qgl-dc">×</button></div>
  <div class="qgl-detail-actions"><button class="secondary" id="qglEdit">Editar</button><button class="secondary" id="qglDup">Duplicar</button><button class="secondary" id="qglCsv">CSV</button><button class="secondary" id="qglPdf">PDF</button><button class="secondary" id="qglArch"></button><button class="danger" id="qglDel">Apagar</button></div>
  <div class="qgl-detail-body"><div id="qglProg"></div><div class="qgl-detail-filter"><input id="qglSearch" type="search" placeholder="Pesquisar pessoa..."><select id="qglStatus"><option value="">Todos os estados</option><option value="PENDENTE">Pendentes</option><option value="FEITO">Feitos</option><option value="NAO_APLICAVEL">Não aplicável</option></select></div><div class="table-wrap"><table class="qgl-detail-table"><thead id="qglHead"></thead><tbody id="qglBody"></tbody></table></div></div>
  <div class="modal-actions"><button class="secondary qgl-dc">Fechar</button><button class="primary" id="qglSaveRows">Guardar alterações</button></div></dialog>`);
}
function pick(){
  const q=String($('#qglPS').value||'').toLowerCase();
  const people=eligible().filter(p=>!q||[p.numero_corpo,p.nome,p.posto,p.ramo,p.curso,p.nim].some(v=>String(v||'').toLowerCase().includes(q)));
  $('#qglPicker').innerHTML=people.map(p=>`<label class="qgl-person-choice"><input type="checkbox" value="${p.id}" ${selected.has(String(p.id))?'checked':''}><span><b>${esc(p.numero_corpo||'—')} · ${esc(p.nome)}</b><small>${esc(p.posto||'')} · ${esc(p.ramo||'')} ${esc(p.curso||'')}</small></span></label>`).join('')||'<div class="qgl-empty">Sem pessoas.</div>';
  $$('#qglPicker input').forEach(ch=>ch.onchange=()=>{ch.checked?selected.add(String(ch.value)):selected.delete(String(ch.value));count()});count();
}
function count(){if($('#qglCount'))$('#qglCount').textContent=`${selected.size} selecionada${selected.size===1?'':'s'}`}
function openEditor(id=null){
  dialogs();editId=id;
  const l=id?state.lists.find(x=>String(x.id)===String(id)):null;
  $('#qglEditorTitle').textContent=l?'Editar listagem':'Nova listagem';$('#qglTitle').value=l?.titulo||'';$('#qglExtra').value=l?.campo_extra_nome||'';$('#qglDesc').value=l?.descricao||'';$('#qglPS').value='';
  selected=new Set(l?rowsFor(l.id).map(r=>String(r.pessoa_id)):eligible().map(p=>String(p.id)));pick();$('#qglEditor').showModal();
}
async function saveList(){
  const titulo=$('#qglTitle').value.trim(),descricao=$('#qglDesc').value.trim(),campo=$('#qglExtra').value.trim();
  if(!titulo)return toast('Indica um título.');if(!selected.size)return toast('Seleciona pelo menos uma pessoa.');
  const {data:{user}}=await client.auth.getUser();if(!user)throw new Error('Sessão expirada.');
  let id=editId;
  if(id){
    const r=await client.from('listagens').update({titulo,descricao:descricao||null,campo_extra_nome:campo||null,atualizado_em:new Date().toISOString()}).eq('id',id);if(r.error)throw r.error;
  }else{
    const r=await client.from('listagens').insert({user_id:user.id,contexto:context,titulo,descricao:descricao||null,campo_extra_nome:campo||null}).select('id').single();if(r.error)throw r.error;id=r.data.id;
  }
  const old=rowsFor(id),oldIds=new Set(old.map(r=>String(r.pessoa_id))),add=[...selected].filter(x=>!oldIds.has(x)),rem=old.filter(r=>!selected.has(String(r.pessoa_id))).map(r=>r.id);
  if(add.length){const r=await client.from('listagem_pessoas').insert(add.map(pessoa_id=>({listagem_id:id,pessoa_id,estado:'PENDENTE'})));if(r.error)throw r.error}
  if(rem.length){const r=await client.from('listagem_pessoas').delete().in('id',rem);if(r.error)throw r.error}
  $('#qglEditor').close();await load();toast(editId?'Listagem atualizada.':'Listagem criada.');if(editId)openDetail(id);
}
function detailRows(){
  const q=String($('#qglSearch')?.value||'').toLowerCase(),st=$('#qglStatus')?.value||'';
  return rowsFor(detailId).filter(r=>{const p=personFor(r);return p&&(!st||r.estado===st)&&(!q||[p.numero_corpo,p.nome,p.posto,p.ramo,p.curso,r.valor_extra,r.observacao].some(v=>String(v||'').toLowerCase().includes(q)))}).sort((a,b)=>personSort(personFor(a)||{},personFor(b)||{}));
}
function renderRows(){
  const l=state.lists.find(x=>String(x.id)===String(detailId));if(!l)return;
  $('#qglHead').innerHTML=`<tr><th>Nº</th><th>Nome</th><th>Estado</th>${l.campo_extra_nome?`<th>${esc(l.campo_extra_nome)}</th>`:''}<th>Observação</th><th>Concluído</th></tr>`;
  $('#qglBody').innerHTML=detailRows().map(r=>{const p=personFor(r)||{};return `<tr data-id="${r.id}"><td>${esc(p.numero_corpo||'—')}</td><td><b>${esc(p.nome||'—')}</b><br><small>${esc(p.posto||'')} · ${esc(p.ramo||'')} ${esc(p.curso||'')}</small></td><td><select class="qgl-st"><option value="PENDENTE" ${r.estado==='PENDENTE'?'selected':''}>Pendente</option><option value="FEITO" ${r.estado==='FEITO'?'selected':''}>Feito</option><option value="NAO_APLICAVEL" ${r.estado==='NAO_APLICAVEL'?'selected':''}>Não aplicável</option></select></td>${l.campo_extra_nome?`<td><input class="qgl-ex" value="${esc(r.valor_extra||'')}"></td>`:''}<td><input class="qgl-no" value="${esc(r.observacao||'')}"></td><td>${r.concluido_em?new Date(r.concluido_em).toLocaleDateString('pt-PT'):'—'}</td></tr>`}).join('')||`<tr><td colspan="${l.campo_extra_nome?6:5}" class="muted">Sem resultados.</td></tr>`;
}
function openDetail(id){
  dialogs();detailId=id;const l=state.lists.find(x=>String(x.id)===String(id));if(!l)return;const p=progress(l);
  $('#qglDT').textContent=l.titulo;$('#qglDS').textContent=l.descricao||'Sem descrição.';$('#qglArch').textContent=l.arquivada?'Restaurar':'Arquivar';
  $('#qglProg').innerHTML=`<div class="qgl-detail-progress-card"><div><b>${p.done}/${p.total}</b><span> concluídos</span></div><strong>${p.pct}%</strong></div><div class="qgl-progress"><span style="width:${p.pct}%"></span></div>`;
  $('#qglSearch').value='';$('#qglStatus').value='';renderRows();$('#qglDetail').showModal();
}
async function saveRows(){
  for(const tr of $$('#qglBody tr[data-id]')){
    const r=state.rows.find(x=>String(x.id)===String(tr.dataset.id));if(!r)continue;
    const estado=tr.querySelector('.qgl-st').value,valor_extra=tr.querySelector('.qgl-ex')?.value.trim()||null,observacao=tr.querySelector('.qgl-no')?.value.trim()||null;
    let concluido_em=r.concluido_em;if(estado==='FEITO'&&r.estado!=='FEITO')concluido_em=new Date().toISOString();if(estado!=='FEITO')concluido_em=null;
    const x=await client.from('listagem_pessoas').update({estado,valor_extra,observacao,concluido_em}).eq('id',r.id);if(x.error)throw x.error;
  }
  await client.from('listagens').update({atualizado_em:new Date().toISOString()}).eq('id',detailId);await load();openDetail(detailId);toast('Alterações guardadas.');
}
async function archive(){
  const l=state.lists.find(x=>String(x.id)===String(detailId));if(!l)return;
  const r=await client.from('listagens').update({arquivada:!l.arquivada,atualizado_em:new Date().toISOString()}).eq('id',l.id);if(r.error)throw r.error;
  $('#qglDetail').close();await load();toast(l.arquivada?'Listagem restaurada.':'Listagem arquivada.');
}
async function del(){
  const l=state.lists.find(x=>String(x.id)===String(detailId));if(!l||!confirm(`Apagar definitivamente "${l.titulo}"?`))return;
  const r=await client.from('listagens').delete().eq('id',l.id);if(r.error)throw r.error;$('#qglDetail').close();await load();toast('Listagem apagada.');
}
async function dup(){
  const l=state.lists.find(x=>String(x.id)===String(detailId));if(!l)return;const {data:{user}}=await client.auth.getUser();
  const x=await client.from('listagens').insert({user_id:user.id,contexto:l.contexto,titulo:`${l.titulo} — cópia`,descricao:l.descricao,campo_extra_nome:l.campo_extra_nome}).select('id').single();if(x.error)throw x.error;
  const rows=rowsFor(l.id);if(rows.length){const y=await client.from('listagem_pessoas').insert(rows.map(r=>({listagem_id:x.data.id,pessoa_id:r.pessoa_id,estado:'PENDENTE'})));if(y.error)throw y.error}
  $('#qglDetail').close();await load();toast('Listagem duplicada.');
}
function exportCsv(){
  const l=state.lists.find(x=>String(x.id)===String(detailId));if(!l)return;const rows=rowsFor(l.id).sort((a,b)=>personSort(personFor(a)||{},personFor(b)||{}));
  const h=['Nº Corpo','Nome','Posto','Ramo','Curso','Estado'];if(l.campo_extra_nome)h.push(l.campo_extra_nome);h.push('Observação','Concluído em');
  const data=[h,...rows.map(r=>{const p=personFor(r)||{},a=[p.numero_corpo||'',p.nome||'',p.posto||'',p.ramo||'',p.curso||'',statusLabel(r.estado)];if(l.campo_extra_nome)a.push(r.valor_extra||'');a.push(r.observacao||'',r.concluido_em?new Date(r.concluido_em).toLocaleDateString('pt-PT'):'');return a})];
  const blob=new Blob(['\ufeff',data.map(r=>r.map(csv).join(';')).join('\r\n')],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`${l.titulo.replace(/[^\p{L}\p{N}_-]+/gu,'_')}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function exportPdf(){
  const l=state.lists.find(x=>String(x.id)===String(detailId));if(!l)return;const p=progress(l),rows=rowsFor(l.id).sort((a,b)=>personSort(personFor(a)||{},personFor(b)||{})),w=window.open('','_blank','width=1100,height=800');if(!w)return toast('O browser bloqueou a janela de impressão.');
  const trs=rows.map((r,i)=>{const x=personFor(r)||{};return `<tr><td>${i+1}</td><td>${esc(x.numero_corpo||'')}</td><td>${esc(x.nome||'')}</td><td>${esc(statusLabel(r.estado))}</td>${l.campo_extra_nome?`<td>${esc(r.valor_extra||'')}</td>`:''}<td>${esc(r.observacao||'')}</td></tr>`}).join('');
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(l.titulo)}</title><style>body{font-family:Arial;margin:28px}button{float:right}table{width:100%;border-collapse:collapse}th,td{border:1px solid #bbb;padding:7px;font-size:12px;text-align:left}th{background:#eee}@media print{button{display:none}}</style></head><body><button onclick="print()">Imprimir / Guardar PDF</button><h1>${esc(l.titulo)}</h1><p>${esc(l.descricao||'')}<br><b>Progresso:</b> ${p.done}/${p.total} · ${p.pct}%</p><table><thead><tr><th>#</th><th>Nº</th><th>Nome</th><th>Estado</th>${l.campo_extra_nome?`<th>${esc(l.campo_extra_nome)}</th>`:''}<th>Observação</th></tr></thead><tbody>${trs}</tbody></table></body></html>`);w.document.close();w.focus();
}
export function bind(){
  dialogs();
  document.addEventListener('qgl:new',()=>openEditor());
  document.addEventListener('qgl:open',e=>openDetail(e.detail));
  $$('.qgl-ec').forEach(b=>b.onclick=()=>$('#qglEditor').close());$$('.qgl-dc').forEach(b=>b.onclick=()=>$('#qglDetail').close());
  $('#qglPS').oninput=pick;$('#qglAll').onclick=()=>{selected=new Set(eligible().map(p=>String(p.id)));pick()};$('#qglNone').onclick=()=>{selected.clear();pick()};
  $('#qglSaveList').onclick=()=>saveList().catch(e=>toast(e.message));$('#qglSearch').oninput=renderRows;$('#qglStatus').onchange=renderRows;$('#qglSaveRows').onclick=()=>saveRows().catch(e=>toast(e.message));
  $('#qglEdit').onclick=()=>{const id=detailId;$('#qglDetail').close();openEditor(id)};$('#qglArch').onclick=()=>archive().catch(e=>toast(e.message));$('#qglDel').onclick=()=>del().catch(e=>toast(e.message));$('#qglDup').onclick=()=>dup().catch(e=>toast(e.message));$('#qglCsv').onclick=exportCsv;$('#qglPdf').onclick=exportPdf;
}
