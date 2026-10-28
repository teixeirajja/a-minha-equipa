import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

export const client=createClient(
  'https://nfnxqiseohcnkgjbgata.supabase.co',
  'sb_publishable_LR4VwEg_DQLmMhS7C7MZUA_ZTKk4KVl'
);
export const $=s=>document.querySelector(s);
export const $$=s=>[...document.querySelectorAll(s)];
export const context=document.body.dataset.qgPage==='class'?'TURMA':'EQUIPA';
export const state={people:[],lists:[],rows:[],filter:'active',query:''};

export function esc(v=''){
  return String(v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
}
export function csv(v=''){
  const s=String(v??'');
  return /[;"\n\r]/.test(s)?`"${s.replaceAll('"','""')}"`:s;
}
export function toast(msg){
  const t=$('#toast'); if(!t)return;
  t.textContent=msg;t.classList.remove('hidden');
  setTimeout(()=>t.classList.add('hidden'),2200);
}
export function personSort(a,b){
  const an=Number(a.numero_corpo),bn=Number(b.numero_corpo);
  if(!Number.isNaN(an)&&!Number.isNaN(bn)&&an!==bn)return an-bn;
  return String(a.nome||'').localeCompare(String(b.nome||''),'pt',{numeric:true,sensitivity:'base'});
}
export function eligible(){
  return state.people.filter(p=>{
    if(p.ativo===false)return false;
    return context==='TURMA'
      ? String(p.curso||'').trim().toUpperCase()==='TM'&&Number(p.ano)===6
      : p.integra_equipa!==false;
  }).sort(personSort);
}
export const rowsFor=id=>state.rows.filter(r=>String(r.listagem_id)===String(id));
export const personFor=r=>state.people.find(p=>String(p.id)===String(r.pessoa_id));
export function progress(list){
  const rows=rowsFor(list.id),app=rows.filter(r=>r.estado!=='NAO_APLICAVEL');
  const done=app.filter(r=>r.estado==='FEITO').length,total=app.length;
  return {done,total,pct:total?Math.round(done/total*100):0,na:rows.length-total,all:rows.length};
}
export const statusLabel=s=>s==='FEITO'?'Feito':s==='NAO_APLICAVEL'?'Não aplicável':'Pendente';

export async function load(){
  const [a,b,c]=await Promise.all([
    client.from('pessoas').select('*'),
    client.from('listagens').select('*').eq('contexto',context).order('arquivada',{ascending:true}).order('atualizado_em',{ascending:false}),
    client.from('listagem_pessoas').select('*')
  ]);
  for(const r of [a,b,c])if(r.error)throw r.error;
  state.people=a.data||[];state.lists=b.data||[];
  const ids=new Set(state.lists.map(x=>String(x.id)));
  state.rows=(c.data||[]).filter(r=>ids.has(String(r.listagem_id)));
  render();
}
function root(){return context==='TURMA'?$('#classListagensRoot'):$('#teamListagensRoot')}
export function render(){
  const el=root();if(!el)return;
  const q=state.query.trim().toLowerCase();
  let lists=[...state.lists];
  if(state.filter==='active')lists=lists.filter(x=>!x.arquivada);
  if(state.filter==='archived')lists=lists.filter(x=>x.arquivada);
  if(q)lists=lists.filter(x=>[x.titulo,x.descricao,x.campo_extra_nome].some(v=>String(v||'').toLowerCase().includes(q)));
  el.innerHTML=`<div class="qgl-toolbar">
    <input class="qgl-search" type="search" placeholder="Pesquisar listagens..." value="${esc(state.query)}">
    <select class="qgl-filter"><option value="active">Ativas</option><option value="all">Todas</option><option value="archived">Arquivo</option></select>
    <button type="button" class="secondary qgl-refresh">Atualizar</button>
  </div>
  <div class="qgl-summary">${lists.length} listagem${lists.length===1?'':'s'} · ${state.lists.filter(x=>!x.arquivada).length} ativa${state.lists.filter(x=>!x.arquivada).length===1?'':'s'}</div>
  <div class="qgl-cards">${lists.map(list=>{
    const p=progress(list);
    return `<article class="qgl-card ${list.arquivada?'archived':''}">
      <div class="qgl-card-top"><div><div class="qgl-card-kicker">${list.arquivada?'Arquivada':context==='TURMA'?'Turma':'Equipa'}</div><h4>${esc(list.titulo)}</h4></div>
      <span class="qgl-progress-badge">${p.done}/${p.total} · ${p.pct}%</span></div>
      <p>${esc(list.descricao||'Sem descrição.')}</p>
      ${list.campo_extra_nome?`<div class="qgl-extra-label">Campo: <b>${esc(list.campo_extra_nome)}</b></div>`:''}
      <div class="qgl-progress"><span style="width:${p.pct}%"></span></div>
      <div class="qgl-card-foot"><span>${p.all} pessoa${p.all===1?'':'s'}${p.na?` · ${p.na} N/A`:''}</span>
      <button type="button" class="primary qgl-open" data-id="${list.id}">Abrir</button></div>
    </article>`}).join('')||'<div class="qgl-empty">Ainda não existem listagens neste módulo.</div>'}</div>`;
  el.querySelector('.qgl-search').oninput=e=>{state.query=e.target.value;render()};
  const f=el.querySelector('.qgl-filter');f.value=state.filter;f.onchange=e=>{state.filter=e.target.value;render()};
  el.querySelector('.qgl-refresh').onclick=()=>load().catch(e=>toast(e.message));
  el.querySelectorAll('.qgl-open').forEach(b=>b.onclick=()=>document.dispatchEvent(new CustomEvent('qgl:open',{detail:b.dataset.id})));
}

export function installUi(){
  if(!document.querySelector('link[href*="listagens.css"]')){
    const l=document.createElement('link');l.rel='stylesheet';l.href='listagens.css?v=6.14';document.head.appendChild(l);
  }
  const tn=$('#appView nav');
  if(tn&&!$('#qglTeamNav')){
    const b=document.createElement('button');b.id='qglTeamNav';b.type='button';b.textContent='Listagens';
    const h=tn.querySelector('[data-page="historico"]');h?tn.insertBefore(b,h):tn.appendChild(b);
    b.onclick=()=>openPage('EQUIPA');
  }
  const tm=$('#appView main');
  if(tm&&!$('#qglTeamPage')){
    const s=document.createElement('section');s.id='qglTeamPage';s.className='page';
    s.innerHTML=`<div class="panel"><div class="panel-head"><div><h3>Listagens</h3><p>Controlos internos que não contam como eventos nem empenhamentos.</p></div><button class="primary qgl-new" data-ctx="EQUIPA">+ Nova listagem</button></div><div id="teamListagensRoot" class="qgl-root"></div></div>`;
    tm.appendChild(s);
  }
  const cn=$('#classView .class-nav');
  if(cn&&!$('#qglClassNav')){
    const b=document.createElement('button');b.id='qglClassNav';b.type='button';b.textContent='Listagens';cn.appendChild(b);b.onclick=()=>openPage('TURMA');
  }
  const cm=$('#classView main');
  if(cm&&!$('#qglClassPage')){
    const s=document.createElement('section');s.id='qglClassPage';s.className='class-page';
    s.innerHTML=`<div class="panel"><div class="panel-head"><div><h3>Listagens da Turma</h3><p>Fotografias, documentação, material, assinaturas e outros controlos da turma.</p></div><button class="primary qgl-new" data-ctx="TURMA">+ Nova listagem</button></div><div id="classListagensRoot" class="qgl-root"></div></div>`;
    cm.appendChild(s);
  }
  $$('.qgl-new').forEach(b=>b.onclick=()=>{if(b.dataset.ctx===context)document.dispatchEvent(new Event('qgl:new'))});
}
export function openPage(ctx){
  if(ctx==='TURMA'){
    $$('.class-page').forEach(x=>x.classList.toggle('active',x.id==='qglClassPage'));
    $$('#classView .class-nav button').forEach(x=>x.classList.toggle('active',x.id==='qglClassNav'));
    if($('#classPageTitle'))$('#classPageTitle').textContent='Listagens da Turma';
    if($('#classPageSubtitle'))$('#classPageSubtitle').textContent='Listas de controlo da turma sem criar empenhamentos.';
  }else{
    $$('#appView .page').forEach(x=>x.classList.toggle('active',x.id==='qglTeamPage'));
    $$('#appView nav button').forEach(x=>x.classList.toggle('active',x.id==='qglTeamNav'));
    if($('#pageTitle'))$('#pageTitle').textContent='Listagens';
    if($('#pageSubtitle'))$('#pageSubtitle').textContent='Listas de controlo independentes de eventos e empenhamentos.';
  }
  load().catch(e=>toast(e.message));
}
