import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const supabase=createClient(
  'https://nfnxqiseohcnkgjbgata.supabase.co',
  'sb_publishable_LR4VwEg_DQLmMhS7C7MZUA_ZTKk4KVl'
);
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
let S={people:[],constraints:[],schedules:[],schedulePeople:[],events:[],assigned:[],history:[],availability:[]};
let availSort={key:'nome',dir:1};
let availColumnFilters={
  numero_corpo:'',
  nome:'',
  ano:'',
  curso:'',
  estado:'',
  motivo:'',
  alerta:''
};
const titles={inicio:['Resumo','Visão geral da equipa.'],consulta:['Consultar disponibilidade','Disponíveis e indisponíveis por dia e hora.'],eventos:['Eventos','Criar eventos e empenhar pessoal.'],pessoas:['Equipa','Gerir os elementos da equipa.'],constrangimentos:['Constrangimentos','ERASMUS e restantes registos.'],horarios:['Horários','Blocos de aula e associações.'],historico:['Histórico','Alterações registadas na base.']};
const esc=(v='')=>String(v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const fmt=d=>{if(!d)return'—';const [y,m,x]=String(d).slice(0,10).split('-');return`${x}/${m}/${y}`};
const today=()=>new Date().toISOString().slice(0,10);
const pName=id=>S.people.find(p=>p.id===id)?.nome||'—';
const day=n=>['','Segunda','Terça','Quarta','Quinta','Sexta','Sábado','Domingo'][n]||n;
function toast(x){$('#toast').textContent=x;$('#toast').classList.remove('hidden');setTimeout(()=>$('#toast').classList.add('hidden'),2200)}
async function sel(t,c='*'){const {data,error}=await supabase.from(t).select(c);if(error)throw error;return data||[]}
async function load(){
  const [people,constraints,schedules,sp,events,assigned,history]=await Promise.all([
    sel('pessoas'),sel('constrangimentos'),sel('horarios_base'),sel('horario_pessoas'),sel('eventos'),sel('evento_empenhados'),supabase.from('historico').select('*').order('alterado_em',{ascending:false}).limit(100).then(r=>{if(r.error)throw r.error;return r.data||[]})
  ]);
  Object.assign(S,{people:people.sort((a,b)=>a.nome.localeCompare(b.nome)),constraints,schedules, schedulePeople:sp,events:events.sort((a,b)=>(a.data+a.hora_inicio).localeCompare(b.data+b.hora_inicio)),assigned,history});
  render();
}
function render(){renderHome();renderPeople();renderConstraints();renderSchedules();renderEvents();renderHistory()}

function eventAutoStatus(e){
  if(e.estado_manual) return e.estado_manual;

  const now=new Date();
  const start=new Date(`${e.data}T${e.hora_inicio||'00:00'}:00`);
  let end;

  if(e.hora_fim){
    end=new Date(`${e.data}T${e.hora_fim}:00`);
  }else{
    end=new Date(start.getTime()+60*60*1000);
  }

  if(now<start) return 'AGENDADO';
  if(now>=start && now<end) return 'EM_CURSO';
  return 'FINALIZADO';
}

function eventStatusLabel(status){
  return {
    AGENDADO:'Agendado',
    EM_CURSO:'Em curso',
    FINALIZADO:'Finalizado',
    CANCELADO:'Cancelado'
  }[status]||status;
}

function eventStatusBadge(e){
  const status=eventAutoStatus(e);
  const cls=status==='CANCELADO'
    ? 'status-cancelled'
    : status==='FINALIZADO'
      ? 'status-finished'
      : status==='EM_CURSO'
        ? 'status-progress'
        : 'status-scheduled';

  return `<span class="badge ${cls}">${eventStatusLabel(status)}</span>`;
}

function eventIsCancelled(e){
  return eventAutoStatus(e)==='CANCELADO';
}

function renderHome(){
  const d=today();
  const active=S.people.filter(p=>p.ativo!==false);

  $('#sPeople').textContent=active.length;
  $('#sYear5').textContent=active.filter(p=>Number(p.ano)===5).length;
  $('#sYear6').textContent=active.filter(p=>Number(p.ano)===6).length;
  $('#sEvents').textContent=S.events.filter(e=>e.data>=d&&!eventIsCancelled(e)).length;

  const engineeringCourses=new Set(['TM','ENG','SMAT']);
  $('#sEng5').textContent=active.filter(
    p=>engineeringCourses.has(String(p.curso||'').toUpperCase())&&Number(p.ano)===5
  ).length;
  $('#sEng6').textContent=active.filter(
    p=>engineeringCourses.has(String(p.curso||'').toUpperCase())&&Number(p.ano)===6
  ).length;
  $('#sMed5').textContent=active.filter(
    p=>String(p.curso||'').toUpperCase()==='MED'&&Number(p.ano)===5
  ).length;
  $('#sFemale').textContent=active.filter(p=>p.sexo==='F').length;
  $('#sMale').textContent=active.filter(p=>p.sexo==='M').length;
  $('#sSexUnknown').textContent=active.filter(p=>!p.sexo).length;

  const grouped=new Map();
  active.forEach(p=>{
    const key=`${p.ramo} · ${p.curso}`;
    grouped.set(key,(grouped.get(key)||0)+1);
  });
  const groups=[...grouped.entries()].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],'pt'));
  const max=Math.max(1,...groups.map(x=>x[1]));

  $('#courseStats').innerHTML=groups.map(([label,count])=>`
    <div class="metric-row">
      <div class="metric-label">${esc(label)}</div>
      <div class="metric-bar"><span style="width:${Math.round(count/max*100)}%"></span></div>
      <div class="metric-value">${count}</div>
    </div>
  `).join('') || '<div class="summary">Sem dados.</div>';

  const future=S.events.filter(e=>e.data>=d&&!eventIsCancelled(e)).slice(0,8);
  $('#homeEvents').innerHTML=future.map(e=>`
    <tr>
      <td>${fmt(e.data)}</td>
      <td>${e.hora_inicio?.slice(0,5)||''}</td>
      <td>${esc(e.nome)}</td>
      <td>${S.assigned.filter(a=>a.evento_id===e.id).length}</td>
    </tr>
  `).join('');
}
function badge(st){return`<span class="badge ${st==='DISPONIVEL'?'green':'red'}">${esc(st)}</span>`}
async function checkAvailability(date,time='',ignoreEvent=null){
  const {data,error}=await supabase.rpc('consultar_disponibilidade',{p_data:date,p_hora:time||null,p_ignorar_evento:ignoreEvent||null});
  if(error)throw error;return data||[];
}
async function renderAvailability(){
  const date=$('#availDate').value;if(!date)return;
  try{S.availability=await checkAvailability(date,$('#availTime').value);filterAvailability()}catch(e){toast(e.message)}
}
function filterAvailability(){
  const general=$('#availFilter').value;

  $$('#availTable [data-colfilter]').forEach(el=>{
    availColumnFilters[el.dataset.colfilter]=String(el.value||'').trim().toLowerCase();
  });

  let rows=S.availability.filter(r=>{
    if(general!=='all' && (general==='alerta' ? !r.tem_alerta_aula : r.estado!==general)) return false;

    if(availColumnFilters.numero_corpo &&
      !String(r.numero_corpo||'').toLowerCase().includes(availColumnFilters.numero_corpo)) return false;

    if(availColumnFilters.nome &&
      !String(r.nome||'').toLowerCase().includes(availColumnFilters.nome)) return false;

    if(availColumnFilters.ano &&
      !String(r.ano||'').toLowerCase().includes(availColumnFilters.ano)) return false;

    if(availColumnFilters.curso &&
      !String(r.curso||'').toLowerCase().includes(availColumnFilters.curso)) return false;

    if(availColumnFilters.estado &&
      String(r.estado||'').toLowerCase()!==availColumnFilters.estado) return false;

    if(availColumnFilters.motivo &&
      !String(r.motivo||'').toLowerCase().includes(availColumnFilters.motivo)) return false;

    if(availColumnFilters.alerta==='sim' && !r.tem_alerta_aula) return false;
    if(availColumnFilters.alerta==='nao' && r.tem_alerta_aula) return false;

    return true;
  });

  rows=[...rows].sort((a,b)=>{
    let av=a[availSort.key], bv=b[availSort.key];

    if(availSort.key==='detalhe_aula'){
      av=a.tem_alerta_aula ? (a.detalhe_aula||'Aula') : '';
      bv=b.tem_alerta_aula ? (b.detalhe_aula||'Aula') : '';
    }

    if(availSort.key==='ano'){
      return ((Number(av)||0)-(Number(bv)||0))*availSort.dir;
    }

    if(availSort.key==='numero_corpo'){
      const an=Number(av),bn=Number(bv);
      if(!Number.isNaN(an)&&!Number.isNaN(bn)) return (an-bn)*availSort.dir;
    }

    return String(av??'').localeCompare(
      String(bv??''),
      'pt',
      {numeric:true,sensitivity:'base'}
    )*availSort.dir;
  });

  const av=rows.filter(r=>r.estado==='DISPONIVEL').length;
  const un=rows.filter(r=>r.estado==='INDISPONIVEL').length;
  const al=rows.filter(r=>r.tem_alerta_aula).length;

  $('#availSummary').textContent=
    `${rows.length} pessoa(s) mostradas · ${av} disponíveis · ${un} indisponíveis · ${al} alerta(s) de aula`;

  $('#availBody').innerHTML=rows.map(r=>`<tr>
    <td>${esc(r.numero_corpo||'—')}</td>
    <td>${esc(r.nome)}</td>
    <td>${r.ano||''}</td>
    <td>${esc(r.curso)}</td>
    <td>${badge(r.estado)}</td>
    <td>${esc(r.motivo||'')}</td>
    <td>${r.tem_alerta_aula
      ? `<span class="badge amber" title="${esc(r.detalhe_aula||'')}">${esc(r.detalhe_aula||'Aula')}</span>`
      : '—'}</td>
  </tr>`).join('');

  $$('#availTable .sort-head').forEach(btn=>{
    btn.classList.toggle('active',btn.dataset.sort===availSort.key);
    const span=btn.querySelector('span');
    span.textContent=
      btn.dataset.sort===availSort.key
      ? (availSort.dir===1?'↑':'↓')
      : '↕';
  });
}
function renderPeople(){
  const q=$('#personSearch').value?.toLowerCase()||'';
  const rows=S.people.filter(p=>!q||[
    p.nome,p.numero_corpo,p.curso,p.ramo,p.localidade
  ].some(v=>String(v||'').toLowerCase().includes(q)));

  $('#peopleBody').innerHTML=rows.map(p=>`
    <tr class="person-row" data-profile="${p.id}">
      <td>${esc(p.numero_corpo||'—')}</td>
      <td><b>${esc(p.nome)}</b></td>
      <td>${esc(p.posto||'')}</td>
      <td>${p.ano||''}</td>
      <td>${esc(p.ramo)}</td>
      <td>${esc(p.curso)}</td>
      <td>${p.idade??'—'}</td>
      <td>${esc(p.localidade||'—')}</td>
      <td>
        <div class="row-actions">
          <button class="icon ep" data-id="${p.id}" title="Editar">✎</button>
          <button class="icon dp" data-id="${p.id}" title="Apagar">🗑</button>
        </div>
      </td>
    </tr>
  `).join('');

  $$('.person-row').forEach(row=>row.onclick=e=>{
    if(e.target.closest('button')) return;
    openProfile(row.dataset.profile);
  });

  $$('.ep').forEach(b=>b.onclick=e=>{
    e.stopPropagation();
    openPerson(S.people.find(p=>p.id===b.dataset.id));
  });

  $$('.dp').forEach(b=>b.onclick=e=>{
    e.stopPropagation();
    del('pessoas','id',b.dataset.id);
  });
}
function renderConstraints(){
  $('#constraintsBody').innerHTML=S.constraints.map(c=>`<tr><td>${esc(pName(c.pessoa_id))}</td><td>${esc(c.tipo)}</td><td>${fmt(c.data_inicio)}</td><td>${fmt(c.data_fim)}</td><td>${esc(c.observacao||'')}</td><td><div class="row-actions"><button class="icon ec" data-id="${c.id}">✎</button><button class="icon dc" data-id="${c.id}">🗑</button></div></td></tr>`).join('');
  $$('.ec').forEach(b=>b.onclick=()=>openConstraint(S.constraints.find(c=>c.id===b.dataset.id)));$$('.dc').forEach(b=>b.onclick=()=>del('constrangimentos','id',b.dataset.id));
}
function renderSchedules(){
  $('#scheduleList').innerHTML=S.schedules.map(h=>`<div class="card"><div><h4>${esc(h.nome)}</h4><p>${day(h.dia_semana)} · ${h.hora_inicio.slice(0,5)}–${h.hora_fim.slice(0,5)} · ${esc(h.tipo_aula)}</p><p>${fmt(h.data_inicio)} → ${fmt(h.data_fim)} · ${S.schedulePeople.filter(x=>x.horario_id===h.id).length} pessoa(s)</p></div><div class="row-actions"><button class="icon eh" data-id="${h.id}">✎</button><button class="icon dh" data-id="${h.id}">🗑</button></div></div>`).join('')||'<div class="summary">Sem horários.</div>';
  $$('.eh').forEach(b=>b.onclick=()=>openSchedule(S.schedules.find(x=>x.id===b.dataset.id)));$$('.dh').forEach(b=>b.onclick=()=>del('horarios_base','id',b.dataset.id));
}
function renderEvents(){
  $('#eventsBody').innerHTML=S.events.map(e=>`
    <tr>
      <td>${fmt(e.data)}</td>
      <td>${e.hora_inicio?.slice(0,5)||''}${e.hora_fim?'–'+e.hora_fim.slice(0,5):''}</td>
      <td>${esc(e.nome)}</td>
      <td>${eventStatusBadge(e)}</td>
      <td>${S.assigned.filter(a=>a.evento_id===e.id).length}</td>
      <td>
        <div class="event-export-menu">
          <button class="export-btn export-csv" data-id="${e.id}" title="Exportar empenhados para CSV">CSV</button>
          <button class="export-btn export-print" data-id="${e.id}" title="Imprimir ou guardar em PDF">PDF</button>
          <button class="icon ee" data-id="${e.id}" title="Editar">✎</button>
          <button class="icon de" data-id="${e.id}" title="Apagar">🗑</button>
        </div>
      </td>
    </tr>
  `).join('');

  $$('.ee').forEach(b=>b.onclick=()=>openEventWizard(S.events.find(e=>e.id===b.dataset.id)));
  $$('.de').forEach(b=>b.onclick=()=>deleteEvent(b.dataset.id));
  $$('.export-csv').forEach(b=>b.onclick=()=>exportEventCsv(b.dataset.id));
  $$('.export-print').forEach(b=>b.onclick=()=>exportEventPdf(b.dataset.id));
}
function eventAssignedPeople(eventId){
  const ids=new Set(
    S.assigned
      .filter(a=>a.evento_id===eventId)
      .map(a=>a.pessoa_id)
  );

  return S.people
    .filter(p=>ids.has(p.id))
    .sort((a,b)=>{
      const an=Number(a.numero_corpo),bn=Number(b.numero_corpo);
      if(!Number.isNaN(an)&&!Number.isNaN(bn)) return an-bn;
      return a.nome.localeCompare(b.nome,'pt');
    });
}

function csvEscape(value){
  const s=String(value??'');
  if(/[;"\n\r]/.test(s)) return `"${s.replaceAll('"','""')}"`;
  return s;
}

function safeFileName(value){
  return String(value||'evento')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g,'')
    .replace(/[^a-zA-Z0-9_-]+/g,'_')
    .replace(/^_+|_+$/g,'')
    .slice(0,80) || 'evento';
}

function downloadText(filename,text,type='text/plain;charset=utf-8'){
  const blob=new Blob(['\ufeff',text],{type});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;
  a.download=filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}

function exportEventCsv(eventId){
  const e=S.events.find(x=>x.id===eventId);
  if(!e)return toast('Evento não encontrado.');

  const people=eventAssignedPeople(eventId);

  const rows=[
    ['Evento',e.nome],
    ['Data',fmt(e.data)],
    ['Hora início',e.hora_inicio?.slice(0,5)||''],
    ['Hora fim',e.hora_fim?.slice(0,5)||''],
    ['Total empenhados',people.length],
    [],
    ['Nº Corpo','Nome','Posto','Ano','Ramo','Curso']
  ];

  people.forEach(p=>{
    rows.push([
      p.numero_corpo||'',
      p.nome||'',
      p.posto||'',
      p.ano||'',
      p.ramo||'',
      p.curso||''
    ]);
  });

  const csv=rows.map(r=>r.map(csvEscape).join(';')).join('\r\n');
  const filename=`${safeFileName(e.nome)}_${e.data}_empenhados.csv`;
  downloadText(filename,csv,'text/csv;charset=utf-8');
  toast(`CSV exportado: ${people.length} empenhado(s).`);
}

function exportEventPdf(eventId){
  const e=S.events.find(x=>x.id===eventId);
  if(!e)return toast('Evento não encontrado.');

  const people=eventAssignedPeople(eventId);

  const rows=people.length
    ? people.map((p,i)=>`
        <tr>
          <td>${i+1}</td>
          <td>${esc(p.numero_corpo||'—')}</td>
          <td>${esc(p.nome)}</td>
          <td>${esc(p.posto||'')}</td>
          <td>${p.ano||''}</td>
          <td>${esc(p.ramo||'')}</td>
          <td>${esc(p.curso||'')}</td>
        </tr>
      `).join('')
    : '<tr><td colspan="7">Sem pessoas empenhadas.</td></tr>';

  const w=window.open('','_blank','width=1100,height=800');
  if(!w)return toast('O browser bloqueou a janela de impressão.');

  w.document.write(`<!doctype html>
<html lang="pt-PT">
<head>
<meta charset="utf-8">
<title>${esc(e.nome)} — Empenhados</title>
<style>
  body{font-family:Arial,sans-serif;color:#111;margin:32px}
  h1{margin:0 0 6px;font-size:24px}
  .meta{margin-bottom:22px;color:#444}
  .meta span{margin-right:18px}
  table{width:100%;border-collapse:collapse}
  th,td{border:1px solid #bbb;padding:8px 9px;text-align:left;font-size:12px}
  th{background:#f0f0f0}
  .footer{margin-top:18px;font-size:11px;color:#666}
  @media print{
    body{margin:14mm}
    .no-print{display:none}
  }
</style>
</head>
<body>
  <button class="no-print" onclick="window.print()" style="float:right;padding:8px 12px">Imprimir / Guardar PDF</button>
  <h1>${esc(e.nome)}</h1>
  <div class="meta">
    <span><b>Data:</b> ${fmt(e.data)}</span>
    <span><b>Hora:</b> ${esc(e.hora_inicio?.slice(0,5)||'')}${e.hora_fim?'–'+esc(e.hora_fim.slice(0,5)):''}</span>
    <span><b>Empenhados:</b> ${people.length}</span>
  </div>

  <table>
    <thead>
      <tr><th>#</th><th>Nº Corpo</th><th>Nome</th><th>Posto</th><th>Ano</th><th>Ramo</th><th>Curso</th></tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  ${e.observacao?`<p><b>Observação:</b> ${esc(e.observacao)}</p>`:''}
  <div class="footer">Gerado por A Minha Equipa</div>
</body>
</html>`);
  w.document.close();
  w.focus();
}

function renderHistory(){$('#historyBody').innerHTML=S.history.map(h=>`<tr><td>${new Date(h.alterado_em).toLocaleString('pt-PT')}</td><td>${esc(h.tabela)}</td><td>${esc(h.acao)}</td><td>${esc(h.registo_id||'')}</td></tr>`).join('')}
function page(n){$$('.page').forEach(x=>x.classList.toggle('active',x.id===n));$$('nav button').forEach(x=>x.classList.toggle('active',x.dataset.page===n));$('#pageTitle').textContent=titles[n][0];$('#pageSubtitle').textContent=titles[n][1]}
function modal(title,body,save){$('#modalTitle').textContent=title;$('#modalBody').innerHTML=body;$('#modalForm').onsubmit=async e=>{e.preventDefault();await save(new FormData(e.currentTarget))};$('#modal').showModal()}
function closeModal(){$('#modal').close()}
$('#modalClose').onclick=closeModal;$('#modalCancel').onclick=closeModal;
$('#profileClose').onclick=()=>$('#profileModal').close();
const peopleOpts=id=>S.people.map(p=>`<option value="${p.id}" ${p.id===id?'selected':''}>${esc(p.numero_corpo||'—')} · ${esc(p.nome)}</option>`).join('');
const personLabel=p=>`${p.numero_corpo||'—'} · ${p.nome}`;
const personFromSearch=value=>{
  const v=String(value||'').trim().toLowerCase();
  return S.people.find(p=>personLabel(p).toLowerCase()===v)
      || S.people.find(p=>String(p.numero_corpo||'').toLowerCase()===v)
      || S.people.find(p=>p.nome.toLowerCase()===v);
};
const personDatalist=()=>`<datalist id="peopleDatalist">${S.people.map(p=>`<option value="${esc(personLabel(p))}"></option>`).join('')}</datalist>`;

const peopleChecks=ids=>`<div class="check-list">${S.people.map(p=>`<label class="check-row"><input name="persons" type="checkbox" value="${p.id}" ${ids.includes(p.id)?'checked':''}>${esc(p.numero_corpo||'—')} · ${esc(p.nome)}</label>`).join('')}</div>`;
function openPerson(p=null){
  modal(
    p?'Editar pessoa':'Nova pessoa',
    `<div class="grid2">
      <label>Nº Corpo<input name="numero_corpo" value="${esc(p?.numero_corpo||'')}"></label>
      <label>Posto<input name="posto" value="${esc(p?.posto||'')}"></label>
      <label class="full">Nome<input name="nome" required value="${esc(p?.nome||'')}"></label>

      <label>Ano<input name="ano" type="number" value="${p?.ano||''}"></label>

      <label>Ramo
        <select name="ramo">
          <option ${p?.ramo==='EXE'?'selected':''}>EXE</option>
          <option ${p?.ramo==='GNR'?'selected':''}>GNR</option>
        </select>
      </label>

      <label>Curso<input name="curso" value="${esc(p?.curso||'')}"></label>

      <label>Idade
        <input name="idade" type="number" min="15" max="100" value="${p?.idade??''}">
      </label>

      <label>Sexo
        <select name="sexo">
          <option value="" ${!p?.sexo?'selected':''}>Por preencher</option>
          <option value="F" ${p?.sexo==='F'?'selected':''}>Feminino</option>
          <option value="M" ${p?.sexo==='M'?'selected':''}>Masculino</option>
        </select>
      </label>

      <label class="full">Localidade
        <input name="localidade" value="${esc(p?.localidade||'')}">
      </label>
    </div>`,
    async f=>{
      const x={
        numero_corpo:f.get('numero_corpo')||null,
        posto:f.get('posto')||null,
        nome:f.get('nome'),
        ano:f.get('ano')?Number(f.get('ano')):null,
        ramo:f.get('ramo'),
        curso:f.get('curso'),
        idade:f.get('idade')?Number(f.get('idade')):null,
        sexo:f.get('sexo')||null,
        localidade:f.get('localidade')||null
      };

      const r=p
        ? await supabase.from('pessoas').update(x).eq('id',p.id)
        : await supabase.from('pessoas').insert(x);

      if(r.error)return toast(r.error.message);
      closeModal();
      await load();
    }
  );
}

async function openProfile(personId){
  const p=S.people.find(x=>x.id===personId);
  if(!p)return;

  const personConstraints=S.constraints
    .filter(c=>c.pessoa_id===personId)
    .sort((a,b)=>String(b.data_inicio).localeCompare(String(a.data_inicio)));

  const personAssigned=S.assigned.filter(a=>a.pessoa_id===personId);
  const eventIds=new Set(personAssigned.map(a=>a.evento_id));
  const personEvents=S.events
    .filter(e=>eventIds.has(e.id) && !eventIsCancelled(e))
    .sort((a,b)=>(b.data+b.hora_inicio).localeCompare(a.data+a.hora_inicio));

  const currentConstraints=personConstraints.filter(c=>{
    const d=today();
    return c.data_inicio<=d&&c.data_fim>=d;
  });

  const initials=p.nome
    .split(/\s+/)
    .filter(Boolean)
    .slice(0,2)
    .map(x=>x[0])
    .join('')
    .toUpperCase();

  const sexLabel=p.sexo==='F'?'Feminino':p.sexo==='M'?'Masculino':'Por preencher';

  $('#profileBody').innerHTML=`
    <div class="profile-hero">
      <div class="profile-avatar">${esc(initials)}</div>
      <div>
        <h2>${esc(p.nome)}</h2>
        <p>${esc(p.posto||'')} · Nº ${esc(p.numero_corpo||'—')}</p>
        <p>${esc(p.ramo)} · ${esc(p.curso)} · ${p.ano||'—'}º ano</p>
      </div>
      <button class="secondary" id="profileEditBtn">Editar ficha</button>
    </div>

    <div class="profile-stats">
      <div class="profile-stat"><span>Eventos em que participou</span><strong>${personEvents.length}</strong></div>
      <div class="profile-stat"><span>Constrangimentos</span><strong>${personConstraints.length}</strong></div>
      <div class="profile-stat"><span>Idade</span><strong>${p.idade??'—'}</strong></div>
      <div class="profile-stat"><span>Ativos agora</span><strong>${currentConstraints.length}</strong></div>
    </div>

    <div class="profile-grid">
      <div class="profile-section">
        <h4>Dados pessoais</h4>
        <div class="profile-list">
          <div class="profile-list-item"><span>Localidade</span><b>${esc(p.localidade||'Por preencher')}</b></div>
          <div class="profile-list-item"><span>Sexo</span><b>${esc(sexLabel)}</b></div>
          <div class="profile-list-item"><span>Curso</span><b>${esc(p.ramo)} · ${esc(p.curso)}</b></div>
          <div class="profile-list-item"><span>Ano</span><b>${p.ano?`${p.ano}º`:'—'}</b></div>
          <div class="profile-list-item"><span>Posto</span><b>${esc(p.posto||'—')}</b></div>
        </div>
      </div>

      <div class="profile-section">
        <h4>Constrangimentos recentes</h4>
        ${
          personConstraints.length
          ? `<div class="profile-list">${personConstraints.slice(0,6).map(c=>`
              <div class="profile-list-item">
                <span>${esc(c.tipo)}${c.observacao?` · ${esc(c.observacao)}`:''}</span>
                <b>${fmt(c.data_inicio)} → ${fmt(c.data_fim)}</b>
              </div>
            `).join('')}</div>`
          : '<div class="profile-empty">Sem constrangimentos registados.</div>'
        }
      </div>

      <div class="profile-section full">
        <h4>Eventos em que foi empenhado</h4>
        ${
          personEvents.length
          ? `<div class="profile-list">${personEvents.slice(0,10).map(e=>`
              <div class="profile-list-item">
                <span>${esc(e.nome)}</span>
                <b>${fmt(e.data)} · ${esc(e.hora_inicio?.slice(0,5)||'')}</b>
              </div>
            `).join('')}</div>`
          : '<div class="profile-empty">Ainda não participou em eventos registados.</div>'
        }
      </div>
    </div>
  `;

  $('#profileEditBtn').onclick=()=>{
    $('#profileModal').close();
    openPerson(p);
  };

  $('#profileModal').showModal();
}

function openConstraint(c=null){
  const currentPerson=c?S.people.find(p=>p.id===c.pessoa_id):null;

  modal(
    c?'Editar constrangimento':'Novo constrangimento',
    `<div class="grid2">
      <label class="full">
        Pessoa
        <input
          name="pessoa_search"
          list="peopleDatalist"
          autocomplete="off"
          placeholder="Escreve nº ou nome..."
          value="${esc(currentPerson?personLabel(currentPerson):'')}"
          required>
        ${personDatalist()}
        <small class="muted">Podes escrever o nº de corpo ou parte do nome e escolher a sugestão.</small>
      </label>

      <label>Tipo
        <input name="tipo" value="${esc(c?.tipo||'ERASMUS')}" required>
      </label>

      <label>Observação
        <input name="observacao" value="${esc(c?.observacao||'')}">
      </label>

      <label>Início
        <input type="date" name="data_inicio" value="${c?.data_inicio||''}" required>
      </label>

      <label>Fim
        <input type="date" name="data_fim" value="${c?.data_fim||''}" required>
      </label>
    </div>`,
    async f=>{
      const person=personFromSearch(f.get('pessoa_search'));
      if(!person) return toast('Escolhe uma pessoa válida da lista.');

      const x={
        pessoa_id:person.id,
        tipo:f.get('tipo'),
        observacao:f.get('observacao')||null,
        data_inicio:f.get('data_inicio'),
        data_fim:f.get('data_fim')
      };

      if(x.data_fim<x.data_inicio) return toast('A data de fim não pode ser anterior à data de início.');

      const r=c
        ? await supabase.from('constrangimentos').update(x).eq('id',c.id)
        : await supabase.from('constrangimentos').insert(x);

      if(r.error) return toast(r.error.message);

      closeModal();
      toast('Constrangimento guardado');
      await load();
    }
  );
}
function openSchedule(h=null){const ids=h?S.schedulePeople.filter(x=>x.horario_id===h.id).map(x=>x.pessoa_id):[];modal(h?'Editar horário':'Novo horário',`<div class="grid2"><label class="full">Nome<input name="nome" required value="${esc(h?.nome||'')}"></label><label>Dia<select name="dia_semana">${[1,2,3,4,5,6,7].map(n=>`<option value="${n}" ${h?.dia_semana===n?'selected':''}>${day(n)}</option>`).join('')}</select></label><label>Tipo<select name="tipo_aula">${['TEORICA','PRATICA','OUTRA'].map(v=>`<option ${h?.tipo_aula===v?'selected':''}>${v}</option>`).join('')}</select></label><label>Início<input type="time" name="hora_inicio" required value="${h?.hora_inicio?.slice(0,5)||''}"></label><label>Fim<input type="time" name="hora_fim" required value="${h?.hora_fim?.slice(0,5)||''}"></label><label>Data início<input type="date" name="data_inicio" required value="${h?.data_inicio||''}"></label><label>Data fim<input type="date" name="data_fim" required value="${h?.data_fim||''}"></label><label class="full">Disciplina<input name="disciplina" value="${esc(h?.disciplina||'')}"></label><label class="full">Pessoas${peopleChecks(ids)}</label></div>`,async f=>{const persons=f.getAll('persons'),x={nome:f.get('nome'),dia_semana:Number(f.get('dia_semana')),tipo_aula:f.get('tipo_aula'),hora_inicio:f.get('hora_inicio'),hora_fim:f.get('hora_fim'),data_inicio:f.get('data_inicio'),data_fim:f.get('data_fim'),disciplina:f.get('disciplina')||null};let id=h?.id;if(h){const r=await supabase.from('horarios_base').update(x).eq('id',id);if(r.error)return toast(r.error.message)}else{const r=await supabase.from('horarios_base').insert(x).select().single();if(r.error)return toast(r.error.message);id=r.data.id}await supabase.from('horario_pessoas').delete().eq('horario_id',id);if(persons.length){const r=await supabase.from('horario_pessoas').insert(persons.map(pessoa_id=>({horario_id:id,pessoa_id})));if(r.error)return toast(r.error.message)}closeModal();await load()})}
async function del(t,k,id){if(!confirm('Apagar este registo?'))return;const r=await supabase.from(t).delete().eq(k,id);if(r.error)return toast(r.error.message);await load()}
async function deleteEvent(id){if(!confirm('Apagar este evento?'))return;const r=await supabase.from('eventos').delete().eq('id',id);if(r.error)return toast(r.error.message);await load()}

let W={event:null,availability:[],selected:new Set()};
function updateScope(){
  const scope=$('#weScope').value,box=$('#scopeValueBox'),sel=$('#weScopeValue');
  if(scope==='all'){box.classList.add('hidden');return}
  box.classList.remove('hidden');
  const vals=scope==='course'?[...new Set(S.people.map(p=>p.curso))].sort():[...new Set(S.people.map(p=>p.ano).filter(Boolean))].sort((a,b)=>a-b);
  sel.innerHTML=vals.map(v=>`<option value="${esc(v)}">${esc(v)}${scope==='year'?'º':''}</option>`).join('');
}
function scopePeople(){
  const scope=$('#weScope').value,v=$('#weScopeValue').value;
  if(scope==='course')return S.people.filter(p=>p.curso===v);
  if(scope==='year')return S.people.filter(p=>String(p.ano)===String(v));
  return S.people;
}
async function wizardCheck(){
  const d=$('#weDate').value,t=$('#weStart').value;if(!d||!t)return toast('Escolhe data e hora.');
  try{W.availability=await checkAvailability(d,t,W.event?.id||null);renderWizardPeople()}catch(e){toast(e.message)}
}
function renderWizardPeople(){
  const allowed=new Set(scopePeople().map(p=>p.id));
  const rows=W.availability.filter(r=>allowed.has(r.pessoa_id));
  $('#weCount').textContent=`${W.selected.size} empenhado(s)`;
  $('#wePeople').innerHTML=rows.map(r=>`<label class="person-choice"><input class="assignCheck" type="checkbox" value="${r.pessoa_id}" ${W.selected.has(r.pessoa_id)?'checked':''}><span><b>${esc(r.numero_corpo||'—')} · ${esc(r.nome)}</b><small>${esc(r.curso)} · ${r.ano||''}º ${r.tem_alerta_aula?'· Aula: '+esc(r.detalhe_aula||''):''}</small></span>${badge(r.estado)}</label>`).join('');
  $$('.assignCheck').forEach(c=>c.onchange=()=>{c.checked?W.selected.add(c.value):W.selected.delete(c.value);$('#weCount').textContent=`${W.selected.size} empenhado(s)`});
}
async function openEventWizard(e=null){
  W={event:e,availability:[],selected:new Set(e?S.assigned.filter(a=>a.evento_id===e.id).map(a=>a.pessoa_id):[])};
  $('#wizardTitle').textContent=e?'Editar evento':'Novo evento';$('#weName').value=e?.nome||'';$('#weDate').value=e?.data||'';$('#weStart').value=e?.hora_inicio?.slice(0,5)||'';$('#weEnd').value=e?.hora_fim?.slice(0,5)||'';$('#weStatus').value=e?.estado_manual||'';$('#weNote').value=e?.observacao||'';$('#weScope').value='all';updateScope();$('#wePeople').innerHTML='<p class="muted">Carrega em “Ver disponibilidade”.</p>';$('#weCount').textContent=`${W.selected.size} empenhado(s)`;$('#eventWizard').showModal();
  if(e?.data&&e?.hora_inicio)await wizardCheck();
}
async function saveWizard(){
  const x={nome:$('#weName').value.trim(),data:$('#weDate').value,hora_inicio:$('#weStart').value,hora_fim:$('#weEnd').value||null,estado_manual:$('#weStatus').value||null,observacao:$('#weNote').value.trim()||null,alvo_todos:false};
  if(!x.nome||!x.data||!x.hora_inicio)return toast('Preenche nome, data e hora.');
  let id=W.event?.id;
  if(id){const r=await supabase.from('eventos').update(x).eq('id',id);if(r.error)return toast(r.error.message)}
  else{const r=await supabase.from('eventos').insert(x).select().single();if(r.error)return toast(r.error.message);id=r.data.id}
  const d=await supabase.from('evento_empenhados').delete().eq('evento_id',id);if(d.error)return toast(d.error.message);
  if(W.selected.size){const r=await supabase.from('evento_empenhados').insert([...W.selected].map(pessoa_id=>({evento_id:id,pessoa_id})));if(r.error)return toast(r.error.message)}
  $('#eventWizard').close();toast('Evento guardado. Pessoas empenhadas ficaram indisponíveis nesse período.');await load();
}
$('#wizardClose').onclick=$('#wizardCancel').onclick=()=>$('#eventWizard').close();$('#wizardSave').onclick=saveWizard;$('#weCheck').onclick=wizardCheck;$('#weScope').onchange=()=>{updateScope();if(W.availability.length)renderWizardPeople()};$('#weScopeValue').onchange=()=>{if(W.availability.length)renderWizardPeople()};

$('#checkAvailBtn').onclick=renderAvailability;
$('#availFilter').onchange=filterAvailability;

$$('#availTable [data-colfilter]').forEach(el=>{
  el.addEventListener('input',filterAvailability);
  el.addEventListener('change',filterAvailability);
});

$$('#availTable .sort-head').forEach(btn=>{
  btn.addEventListener('click',()=>{
    const key=btn.dataset.sort;
    if(availSort.key===key){
      availSort.dir*=-1;
    }else{
      availSort.key=key;
      availSort.dir=1;
    }
    filterAvailability();
  });
});

$('#resetAvailFiltersBtn').onclick=()=>{
  $('#availFilter').value='all';
  $$('#availTable [data-colfilter]').forEach(el=>el.value='');
  availSort={key:'nome',dir:1};
  filterAvailability();
};$('#personSearch').oninput=renderPeople;$('#newEventBtn').onclick=()=>openEventWizard();$('#newPersonBtn').onclick=()=>openPerson();$('#newConstraintBtn').onclick=()=>openConstraint();$('#newScheduleBtn').onclick=()=>openSchedule();$('#refreshBtn').onclick=load;$$('nav button').forEach(b=>b.onclick=()=>page(b.dataset.page));
$('#availDate').value=today();

$('#loginForm').onsubmit=async e=>{e.preventDefault();const r=await supabase.auth.signInWithPassword({email:$('#loginEmail').value,password:$('#loginPassword').value});$('#loginError').textContent=r.error?.message||''};
$('#logoutBtn').onclick=()=>supabase.auth.signOut();
supabase.auth.onAuthStateChange(async(_e,s)=>{$('#loginView').classList.toggle('hidden',!!s);$('#appView').classList.toggle('hidden',!s);if(s){$('#sessionEmail').textContent=s.user.email||'';try{await load()}catch(e){toast(e.message)}}});
