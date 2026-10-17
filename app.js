import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const supabase=createClient(
  'https://nfnxqiseohcnkgjbgata.supabase.co',
  'sb_publishable_LR4VwEg_DQLmMhS7C7MZUA_ZTKk4KVl'
);
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
let S={people:[],constraints:[],schedules:[],schedulePeople:[],scheduleModels:[],scheduleModelPeople:[],events:[],assigned:[],history:[],availability:[]};
let constraintSort={key:'inicio',dir:-1};
let constraintFilters={pessoa:'',tipo:'',estado:'',inicio:'',fim:'',observacao:''};
let expandedConstraints=new Set();

let peopleSort={key:'nome',dir:1};
let peopleFilters={numero_corpo:'',nome:'',posto:'',ano:'',ramo:'',curso:'',idade:'',localidade:''};

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
const titles={inicio:['Resumo','Visão geral da equipa.'],consulta:['Consultar disponibilidade','Disponíveis e indisponíveis por dia e hora.'],eventos:['Eventos','Criar eventos e empenhar pessoal.'],pessoas:['Equipa','Gerir os elementos da equipa.'],constrangimentos:['Constrangimentos','ERASMUS e restantes registos.'],horarios:['Horários','Horários semanais completos e associações.'],historico:['Histórico','Alterações registadas na base.']};
const esc=(v='')=>String(v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const fmt=d=>{if(!d)return'—';const [y,m,x]=String(d).slice(0,10).split('-');return`${x}/${m}/${y}`};
const today=()=>new Date().toISOString().slice(0,10);
const pName=id=>S.people.find(p=>p.id===id)?.nome||'—';
const day=n=>['','Segunda','Terça','Quarta','Quinta','Sexta','Sábado','Domingo'][n]||n;
function toast(x){$('#toast').textContent=x;$('#toast').classList.remove('hidden');setTimeout(()=>$('#toast').classList.add('hidden'),2200)}
async function sel(t,c='*'){const {data,error}=await supabase.from(t).select(c);if(error)throw error;return data||[]}
async function load(){
  const [people,constraints,schedules,sp,scheduleModels,scheduleModelPeople,events,assigned,history]=await Promise.all([
    sel('pessoas'),
    sel('constrangimentos'),
    sel('horarios_base'),
    sel('horario_pessoas'),
    sel('horario_modelos'),
    sel('horario_modelo_pessoas'),
    sel('eventos'),
    sel('evento_empenhados'),
    supabase.from('historico').select('*').order('alterado_em',{ascending:false}).limit(100).then(r=>{if(r.error)throw r.error;return r.data||[]})
  ]);
  Object.assign(S,{
    people:people.sort((a,b)=>a.nome.localeCompare(b.nome)),
    constraints,
    schedules,
    schedulePeople:sp,
    scheduleModels:scheduleModels.sort((a,b)=>a.nome.localeCompare(b.nome,'pt')),
    scheduleModelPeople,
    events:events.sort((a,b)=>(a.data+a.hora_inicio).localeCompare(b.data+b.hora_inicio)),
    assigned,
    history
  });
  render();
}
function render(){renderHome();renderPeople();renderExternalPeople();renderConstraints();renderSchedules();renderEvents();renderHistory()}

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


/* Restored in v5.6.1 after accidental omission */
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

function renderSchedules(){
  const models=S.scheduleModels;

  const modelHtml=models.map(m=>{
    const blocks=S.schedules
      .filter(h=>h.horario_modelo_id===m.id)
      .sort((a,b)=>a.dia_semana-b.dia_semana||a.hora_inicio.localeCompare(b.hora_inicio));

    const peopleCount=S.scheduleModelPeople
      .filter(x=>x.horario_modelo_id===m.id).length;

    const dayCounts=new Map();
    blocks.forEach(b=>dayCounts.set(b.dia_semana,(dayCounts.get(b.dia_semana)||0)+1));

    return `<div class="schedule-model-card">
      <div class="schedule-model-top">
        <div>
          <h4>${esc(m.nome)}</h4>
          <div class="schedule-model-meta">
            ${fmt(m.data_inicio)} → ${fmt(m.data_fim)}
            · ${blocks.length} bloco(s)
            · ${peopleCount} pessoa(s)
          </div>
          <div class="schedule-day-chips">
            ${[...dayCounts.entries()].map(([d,n])=>`<span class="schedule-chip">${day(d)} · ${n}</span>`).join('')}
          </div>
        </div>
        <div class="schedule-model-actions">
          <button class="export-btn view-model-schedule" data-id="${m.id}" title="Ver horário">Ver</button>
          <button class="icon edit-model-schedule" data-id="${m.id}" title="Editar">✎</button>
          <button class="icon delete-model-schedule" data-id="${m.id}" title="Apagar">🗑</button>
        </div>
      </div>
    </div>`;
  }).join('');

  const legacy=S.schedules.filter(h=>!h.horario_modelo_id);
  const legacyHtml=legacy.length
    ? `<div class="legacy-schedules">
        <div class="summary"><b>Blocos antigos</b> — continuam válidos, mas os novos horários devem ser criados pelo editor completo.</div>
        ${legacy.map(h=>`<div class="card">
          <div>
            <h4>${esc(h.nome)}</h4>
            <p>${day(h.dia_semana)} · ${h.hora_inicio.slice(0,5)}–${h.hora_fim.slice(0,5)} · ${esc(h.tipo_aula)}</p>
            <p>${fmt(h.data_inicio)} → ${fmt(h.data_fim)} · ${S.schedulePeople.filter(x=>x.horario_id===h.id).length} pessoa(s)</p>
          </div>
          <div class="row-actions">
            <button class="icon edit-legacy-schedule" data-id="${h.id}">✎</button>
            <button class="icon delete-legacy-schedule" data-id="${h.id}">🗑</button>
          </div>
        </div>`).join('')}
      </div>`
    : '';

  $('#scheduleList').innerHTML=
    (modelHtml||'<div class="summary">Ainda não existem horários completos.</div>')+
    legacyHtml;

  $$('.view-model-schedule').forEach(b=>b.onclick=()=>openScheduleViewerByModel(b.dataset.id));
  $$('.edit-model-schedule').forEach(b=>b.onclick=()=>openScheduleWizard(
    S.scheduleModels.find(x=>x.id===b.dataset.id)
  ));
  $$('.delete-model-schedule').forEach(b=>b.onclick=()=>deleteScheduleModel(b.dataset.id));

  $$('.edit-legacy-schedule').forEach(b=>b.onclick=()=>openLegacySchedule(
    S.schedules.find(x=>x.id===b.dataset.id)
  ));
  $$('.delete-legacy-schedule').forEach(b=>b.onclick=()=>del('horarios_base','id',b.dataset.id));
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

function renderHistory(){$('#historyBody').innerHTML=S.history.map(h=>`<tr><td>${new Date(h.alterado_em).toLocaleString('pt-PT')}</td><td>${esc(h.tabela)}</td><td>${esc(h.acao)}</td><td>${esc(h.registo_id||'')}</td></tr>`).join('')}

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
          <div class="profile-list-item"><span>Origem</span><b>${p.integra_equipa===false?'Pessoa externa':'Equipa'}</b></div>
          <div class="profile-list-item"><span>Função</span><b>${esc(p.funcao||'—')}</b></div>
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

function renderHome(){
  const d=today();
  const active=S.people.filter(p=>p.ativo!==false && p.integra_equipa!==false);

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
function badge(st){
  const cls=st==='DISPONIVEL'?'green':st==='POR_CONFIRMAR'?'amber':'red';
  const label=st==='POR_CONFIRMAR'?'POR CONFIRMAR':st;
  return`<span class="badge ${cls}">${esc(label)}</span>`;
}
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
  const pc=rows.filter(r=>r.estado==='POR_CONFIRMAR').length;
  const al=rows.filter(r=>r.tem_alerta_aula).length;

  $('#availSummary').textContent=
    `${rows.length} pessoa(s) mostradas · ${av} disponíveis · ${un} indisponíveis · ${pc} por confirmar · ${al} alerta(s) de aula`;

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
  $$('#peopleTable [data-pfilter]').forEach(el=>{
    peopleFilters[el.dataset.pfilter]=String(el.value||'').trim().toLowerCase();
  });

  let rows=S.people.filter(p=>p.integra_equipa!==false).filter(p=>{
    if(peopleFilters.numero_corpo && !String(p.numero_corpo||'').toLowerCase().includes(peopleFilters.numero_corpo)) return false;
    if(peopleFilters.nome && !String(p.nome||'').toLowerCase().includes(peopleFilters.nome)) return false;
    if(peopleFilters.posto && !String(p.posto||'').toLowerCase().includes(peopleFilters.posto)) return false;
    if(peopleFilters.ano && !String(p.ano||'').toLowerCase().includes(peopleFilters.ano)) return false;
    if(peopleFilters.ramo && String(p.ramo||'').toLowerCase()!==peopleFilters.ramo) return false;
    if(peopleFilters.curso && !String(p.curso||'').toLowerCase().includes(peopleFilters.curso)) return false;
    if(peopleFilters.idade && !String(p.idade||'').toLowerCase().includes(peopleFilters.idade)) return false;
    if(peopleFilters.localidade && !String(p.localidade||'').toLowerCase().includes(peopleFilters.localidade)) return false;
    return true;
  });

  rows=[...rows].sort((a,b)=>{
    let av=a[peopleSort.key],bv=b[peopleSort.key];

    if(peopleSort.key==='numero_corpo'){
      const an=Number(av),bn=Number(bv);
      if(!Number.isNaN(an)&&!Number.isNaN(bn)) return (an-bn)*peopleSort.dir;
    }

    if(['ano','idade'].includes(peopleSort.key)){
      return ((Number(av)||0)-(Number(bv)||0))*peopleSort.dir;
    }

    return String(av??'').localeCompare(String(bv??''),'pt',{numeric:true,sensitivity:'base'})*peopleSort.dir;
  });

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

  $$('#peopleTable .sort-head').forEach(btn=>{
    btn.classList.toggle('active',btn.dataset.psort===peopleSort.key);
    btn.querySelector('span').textContent=
      btn.dataset.psort===peopleSort.key
      ? (peopleSort.dir===1?'↑':'↓')
      : '↕';
  });
}

function renderExternalPeople(){
  const rows=S.people
    .filter(p=>p.integra_equipa===false)
    .sort((a,b)=>a.nome.localeCompare(b.nome,'pt'));

  $('#externalPeopleCount').textContent=rows.length;

  $('#externalPeopleBody').innerHTML=rows.map(p=>`
    <tr class="external-person-row" data-profile="${p.id}">
      <td>${esc(p.numero_corpo||'—')}</td>
      <td><b>${esc(p.nome)}</b></td>
      <td>${esc(p.posto||'')}</td>
      <td>${esc(p.funcao||'—')}</td>
      <td>${esc(p.ramo||'')}</td>
      <td>${esc(p.curso||'')}</td>
      <td>
        <div class="row-actions">
          <button class="icon epx" data-id="${p.id}" title="Editar">✎</button>
          <button class="icon dpx" data-id="${p.id}" title="Apagar">🗑</button>
        </div>
      </td>
    </tr>
  `).join('');

  $$('.external-person-row').forEach(row=>row.onclick=e=>{
    if(e.target.closest('button'))return;
    openProfile(row.dataset.profile);
  });

  $$('.epx').forEach(b=>b.onclick=e=>{
    e.stopPropagation();
    openPerson(S.people.find(p=>p.id===b.dataset.id),true);
  });

  $$('.dpx').forEach(b=>b.onclick=e=>{
    e.stopPropagation();
    del('pessoas','id',b.dataset.id);
  });
}

function openPerson(p=null,forceExternal=false){
  const isExternal=forceExternal || p?.integra_equipa===false;

  modal(
    p?'Editar pessoa':(isExternal?'Nova pessoa externa':'Nova pessoa'),
    `<div class="grid2">
      <label>Nº Corpo
        <input name="numero_corpo" value="${esc(p?.numero_corpo||'')}">
      </label>

      <label>Posto
        <input name="posto" value="${esc(p?.posto||'')}">
      </label>

      <label class="full">Nome
        <input name="nome" required value="${esc(p?.nome||'')}">
      </label>

      <label>Ano
        <input name="ano" type="number" value="${p?.ano||''}">
      </label>

      <label>Ramo
        <select name="ramo">
          <option value="EXE" ${p?.ramo==='EXE'?'selected':''}>EXE</option>
          <option value="GNR" ${p?.ramo==='GNR'?'selected':''}>GNR</option>
        </select>
      </label>

      <label>Curso
        <input name="curso" value="${esc(p?.curso||'')}">
      </label>

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

      <label>Integra a equipa
        <select name="integra_equipa">
          <option value="true" ${!isExternal?'selected':''}>Sim</option>
          <option value="false" ${isExternal?'selected':''}>Não — externa</option>
        </select>
      </label>

      <label>Função
        <select name="funcao">
          <option value="" ${!p?.funcao?'selected':''}>Sem função</option>
          <option value="CPel" ${p?.funcao==='CPel'?'selected':''}>CPel</option>
          <option value="CBat" ${p?.funcao==='CBat'?'selected':''}>CBat</option>
          <option value="CCA" ${p?.funcao==='CCA'?'selected':''}>CCA</option>
          <option value="CACA" ${p?.funcao==='CACA'?'selected':''}>CACA</option>
          <option value="OUTRA" ${p?.funcao==='OUTRA'?'selected':''}>Outra</option>
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
        curso:f.get('curso')||null,
        idade:f.get('idade')?Number(f.get('idade')):null,
        sexo:f.get('sexo')||null,
        localidade:f.get('localidade')||null,
        integra_equipa:f.get('integra_equipa')==='true',
        funcao:f.get('funcao')||null
      };

      const r=p
        ? await supabase.from('pessoas').update(x).eq('id',p.id)
        : await supabase.from('pessoas').insert(x);

      if(r.error)return toast(r.error.message);

      closeModal();
      toast('Pessoa guardada');
      await load();
    }
  );
}

function constraintStatusBadge(c){
  const map={
    IMPEDITIVO:['red','Impeditivo'],
    POR_CONFIRMAR:['amber','Por confirmar'],
    ACEITE:['green','Aceite'],
    NAO_ACEITE:['gray','Não aceite']
  };
  const [cls,label]=map[c.estado||'IMPEDITIVO']||['gray',c.estado||'—'];
  return `<span class="badge ${cls}">${esc(label)}</span>`;
}

function constraintDateTime(date,time){
  return `${fmt(date)}${time?` · ${time.slice(0,5)}`:''}`;
}

function constraintTimestamp(c,which='start'){
  const d=which==='start'?c.data_inicio:c.data_fim;
  const t=which==='start'?(c.hora_inicio||'00:00'):(c.hora_fim||'23:59');
  return `${d||''}T${t}`;
}

function isPastConstraint(c){
  const end=new Date(constraintTimestamp(c,'end'));
  return end < new Date();
}

function getConstraintRows(past=false){
  $$('#constraintsTable [data-cfilter]').forEach(el=>{
    constraintFilters[el.dataset.cfilter]=String(el.value||'').trim().toLowerCase();
  });

  let rows=S.constraints.filter(c=>isPastConstraint(c)===past);

  rows=rows.filter(c=>{
    const person=pName(c.pessoa_id);
    const ini=constraintDateTime(c.data_inicio,c.hora_inicio);
    const fim=constraintDateTime(c.data_fim,c.hora_fim);

    if(constraintFilters.pessoa && !String(person).toLowerCase().includes(constraintFilters.pessoa)) return false;
    if(constraintFilters.tipo && !String(c.tipo||'').toLowerCase().includes(constraintFilters.tipo)) return false;
    if(constraintFilters.estado && String(c.estado||'IMPEDITIVO').toLowerCase()!==constraintFilters.estado) return false;
    if(constraintFilters.inicio && !String(ini).toLowerCase().includes(constraintFilters.inicio)) return false;
    if(constraintFilters.fim && !String(fim).toLowerCase().includes(constraintFilters.fim)) return false;
    if(constraintFilters.observacao && !String(c.observacao||'').toLowerCase().includes(constraintFilters.observacao)) return false;

    return true;
  });

  rows.sort((a,b)=>{
    let av,bv;
    if(constraintSort.key==='pessoa'){av=pName(a.pessoa_id);bv=pName(b.pessoa_id);}
    else if(constraintSort.key==='inicio'){av=constraintTimestamp(a,'start');bv=constraintTimestamp(b,'start');}
    else if(constraintSort.key==='fim'){av=constraintTimestamp(a,'end');bv=constraintTimestamp(b,'end');}
    else {av=a[constraintSort.key]??'';bv=b[constraintSort.key]??'';}

    return String(av).localeCompare(String(bv),'pt',{numeric:true,sensitivity:'base'})*constraintSort.dir;
  });

  return rows;
}

function constraintRowsHtml(rows){
  return rows.map(c=>`
    <tr>
      <td>${esc(pName(c.pessoa_id))}</td>
      <td>${esc(c.tipo)}</td>
      <td>${constraintStatusBadge(c)}</td>
      <td>${constraintDateTime(c.data_inicio,c.hora_inicio)}</td>
      <td>${constraintDateTime(c.data_fim,c.hora_fim)}</td>
      <td>${esc(c.observacao||'')}</td>
      <td>
        <div class="row-actions">
          <button class="expand-row-btn xc" data-id="${c.id}" title="Ver detalhes">${expandedConstraints.has(c.id)?'Fechar':'Ver'}</button>
          <button class="icon ec" data-id="${c.id}" title="Editar">✎</button>
          <button class="icon dc" data-id="${c.id}" title="Apagar">🗑</button>
        </div>
      </td>
    </tr>
    ${expandedConstraints.has(c.id)?`
      <tr class="constraint-detail-row">
        <td colspan="7">
          <div class="constraint-detail">
            <div class="constraint-detail-item"><span>Pessoa</span><b>${esc(pName(c.pessoa_id))}</b></div>
            <div class="constraint-detail-item"><span>Tipo</span><b>${esc(c.tipo||'—')}</b></div>
            <div class="constraint-detail-item"><span>Estado</span><b>${esc(c.estado||'IMPEDITIVO')}</b></div>
            <div class="constraint-detail-item"><span>Observação</span><b>${esc(c.observacao||'—')}</b></div>
            <div class="constraint-detail-item"><span>Data início</span><b>${fmt(c.data_inicio)}</b></div>
            <div class="constraint-detail-item"><span>Hora início</span><b>${c.hora_inicio?c.hora_inicio.slice(0,5):'Dia inteiro'}</b></div>
            <div class="constraint-detail-item"><span>Data fim</span><b>${fmt(c.data_fim)}</b></div>
            <div class="constraint-detail-item"><span>Hora fim</span><b>${c.hora_fim?c.hora_fim.slice(0,5):'Dia inteiro'}</b></div>
          </div>
        </td>
      </tr>
    `:''}
  `).join('');
}

function bindConstraintRowActions(){
  $$('.xc').forEach(b=>b.onclick=()=>{
    expandedConstraints.has(b.dataset.id)
      ? expandedConstraints.delete(b.dataset.id)
      : expandedConstraints.add(b.dataset.id);
    renderConstraints();
  });
  $$('.ec').forEach(b=>b.onclick=()=>openConstraint(S.constraints.find(c=>c.id===b.dataset.id)));
  $$('.dc').forEach(b=>b.onclick=()=>del('constrangimentos','id',b.dataset.id));
}

function renderConstraints(){
  const current=getConstraintRows(false);
  const past=getConstraintRows(true);

  $('#constraintsBody').innerHTML=current.length
    ? constraintRowsHtml(current)
    : '<tr><td colspan="7" class="muted">Sem constrangimentos atuais/futuros.</td></tr>';

  $('#pastConstraintsBody').innerHTML=past.length
    ? constraintRowsHtml(past)
    : '<tr><td colspan="7" class="muted">Sem constrangimentos passados.</td></tr>';

  $('#pastConstraintsCount').textContent=past.length;

  $$('#constraintsTable .sort-head').forEach(btn=>{
    btn.classList.toggle('active',btn.dataset.csort===constraintSort.key);
    btn.querySelector('span').textContent=
      btn.dataset.csort===constraintSort.key
      ? (constraintSort.dir===1?'↑':'↓')
      : '↕';
  });

  bindConstraintRowActions();
}
function openConstraint(c=null){
  const currentPerson=c?S.people.find(p=>p.id===c.pessoa_id):null;
  const currentState=c?.estado||'IMPEDITIVO';

  modal(
    c?'Editar constrangimento':'Novo constrangimento',
    `<div class="grid2">
      ${
        c
        ? `<label class="full">
            Pessoa
            <input value="${esc(currentPerson?personLabel(currentPerson):'')}" disabled>
            <small class="muted">Ao editar, alteras apenas o registo desta pessoa.</small>
          </label>`
        : `<div class="full">
            <label>Pessoas</label>
            <div class="multi-people-box">
              <div class="multi-people-toolbar">
                <input id="constraintPeopleSearch" placeholder="Pesquisar nº, nome, curso...">
                <button id="constraintSelectVisible" type="button" class="secondary">Selecionar visíveis</button>
                <button id="constraintClearPeople" type="button" class="secondary">Limpar</button>
              </div>
              <div id="constraintPeopleList" class="multi-people-list"></div>
              <div id="constraintPeopleCount" class="multi-people-count">0 selecionadas</div>
            </div>
          </div>`
      }

      <label>Tipo
        <input name="tipo" value="${esc(c?.tipo||'')}" placeholder="Ex.: Doente, ERASMUS, treino..." required>
      </label>

      <label>Estado
        <select name="estado">
          <option value="IMPEDITIVO" ${currentState==='IMPEDITIVO'?'selected':''}>Impeditivo</option>
          <option value="POR_CONFIRMAR" ${currentState==='POR_CONFIRMAR'?'selected':''}>Por confirmar</option>
          <option value="ACEITE" ${currentState==='ACEITE'?'selected':''}>Aceite</option>
          <option value="NAO_ACEITE" ${currentState==='NAO_ACEITE'?'selected':''}>Não aceite</option>
        </select>
      </label>

      <label class="full">Observação
        <input name="observacao" value="${esc(c?.observacao||'')}" placeholder="Motivo / informação adicional">
      </label>

      <label>Data início
        <input type="date" name="data_inicio" value="${c?.data_inicio||''}" required>
      </label>

      <label>Hora início <span class="optional">(opcional)</span>
        <input type="time" name="hora_inicio" value="${c?.hora_inicio?.slice(0,5)||''}">
      </label>

      <label>Data fim
        <input type="date" name="data_fim" value="${c?.data_fim||''}" required>
      </label>

      <label>Hora fim <span class="optional">(opcional)</span>
        <input type="time" name="hora_fim" value="${c?.hora_fim?.slice(0,5)||''}">
      </label>

      <div class="constraint-help full">
        <b>Como funciona:</b>
        <span><strong>Impeditivo</strong> e <strong>Aceite</strong> deixam a pessoa indisponível.</span>
        <span><strong>Por confirmar</strong> aparece como aviso na disponibilidade.</span>
        <span><strong>Não aceite</strong> fica registado, mas deixa de afetar a disponibilidade.</span>
        <span>Se não colocares horas, o constrangimento aplica-se ao dia inteiro.</span>
      </div>
    </div>`,
    async f=>{
      const horaInicio=f.get('hora_inicio')||null;
      const horaFim=f.get('hora_fim')||null;

      if((horaInicio&&!horaFim)||(!horaInicio&&horaFim)){
        return toast('Se usares horas, preenche hora de início e hora de fim.');
      }

      const base={
        tipo:f.get('tipo').trim(),
        estado:f.get('estado'),
        observacao:f.get('observacao')||null,
        data_inicio:f.get('data_inicio'),
        hora_inicio:horaInicio,
        data_fim:f.get('data_fim'),
        hora_fim:horaFim
      };

      if(base.data_fim<base.data_inicio){
        return toast('A data de fim não pode ser anterior à data de início.');
      }

      if(
        base.data_inicio===base.data_fim &&
        base.hora_inicio &&
        base.hora_fim &&
        base.hora_fim<=base.hora_inicio
      ){
        return toast('A hora de fim tem de ser posterior à hora de início.');
      }

      if(c){
        const r=await supabase
          .from('constrangimentos')
          .update({...base,pessoa_id:c.pessoa_id})
          .eq('id',c.id);

        if(r.error)return toast(r.error.message);

        closeModal();
        toast('Constrangimento guardado');
        await load();
        return;
      }

      const selected=[...constraintSelectedPeople];
      if(!selected.length)return toast('Seleciona pelo menos uma pessoa.');

      const payload=selected.map(pessoa_id=>({
        ...base,
        pessoa_id
      }));

      const r=await supabase
        .from('constrangimentos')
        .insert(payload);

      if(r.error)return toast(r.error.message);

      closeModal();
      toast(`Constrangimento criado para ${selected.length} pessoa(s).`);
      await load();
    }
  );

  if(!c){
    setupConstraintMultiPeople();
  }
}

let constraintSelectedPeople=new Set();

function constraintVisiblePeople(){
  const q=String($('#constraintPeopleSearch')?.value||'').trim().toLowerCase();

  return S.people.filter(p=>{
    if(!q)return true;
    return [
      p.numero_corpo,
      p.nome,
      p.posto,
      p.ano,
      p.ramo,
      p.curso
    ].some(v=>String(v||'').toLowerCase().includes(q));
  });
}

function renderConstraintMultiPeople(){
  const list=$('#constraintPeopleList');
  if(!list)return;

  const rows=constraintVisiblePeople();

  list.innerHTML=rows.map(p=>`
    <label class="multi-person-row">
      <input
        type="checkbox"
        class="constraint-person-check"
        value="${p.id}"
        ${constraintSelectedPeople.has(p.id)?'checked':''}>
      <span>
        <b>${esc(p.numero_corpo||'—')} · ${esc(p.nome)}</b>
        <small>${esc(p.ramo)} · ${esc(p.curso)} · ${p.ano||'—'}º ano</small>
      </span>
    </label>
  `).join('');

  $$('.constraint-person-check').forEach(ch=>{
    ch.onchange=()=>{
      ch.checked
        ? constraintSelectedPeople.add(ch.value)
        : constraintSelectedPeople.delete(ch.value);

      $('#constraintPeopleCount').textContent=
        `${constraintSelectedPeople.size} selecionada(s)`;
    };
  });

  $('#constraintPeopleCount').textContent=
    `${constraintSelectedPeople.size} selecionada(s)`;
}

function setupConstraintMultiPeople(){
  constraintSelectedPeople=new Set();

  $('#constraintPeopleSearch').oninput=renderConstraintMultiPeople;

  $('#constraintSelectVisible').onclick=()=>{
    constraintVisiblePeople().forEach(p=>constraintSelectedPeople.add(p.id));
    renderConstraintMultiPeople();
  };

  $('#constraintClearPeople').onclick=()=>{
    constraintSelectedPeople.clear();
    renderConstraintMultiPeople();
  };

  renderConstraintMultiPeople();
}



function scheduleBlocksForModel(modelId){
  return S.schedules
    .filter(h=>h.horario_modelo_id===modelId)
    .sort((a,b)=>a.dia_semana-b.dia_semana||a.hora_inicio.localeCompare(b.hora_inicio));
}

function schedulePeopleForModel(modelId){
  const ids=new Set(
    S.scheduleModelPeople
      .filter(x=>x.horario_modelo_id===modelId)
      .map(x=>x.pessoa_id)
  );
  return S.people.filter(p=>ids.has(p.id));
}

function renderViewerWeekGrid(blocks){
  const startMin=8*60;
  const endMin=20*60;
  const slot=30;
  const slots=(endMin-startMin)/slot;
  const days=['','Seg','Ter','Qua','Qui','Sex','Sáb','Dom'];

  let html=`<div class="week-head" style="grid-column:1;grid-row:1"></div>`;

  for(let d=1;d<=7;d++){
    html+=`<div class="week-head" style="grid-column:${d+1};grid-row:1">${days[d]}</div>`;
  }

  for(let i=0;i<slots;i++){
    const mins=startMin+i*slot;
    const hh=String(Math.floor(mins/60)).padStart(2,'0');
    const mm=String(mins%60).padStart(2,'0');

    html+=`<div class="week-time" style="grid-column:1;grid-row:${i+2}">${hh}:${mm}</div>`;

    for(let d=1;d<=7;d++){
      html+=`<div class="week-cell" style="grid-column:${d+1};grid-row:${i+2}"></div>`;
    }
  }

  blocks.forEach(b=>{
    const s=minutesFromTime(b.hora_inicio);
    const e=minutesFromTime(b.hora_fim);

    if(s<startMin||e>endMin)return;

    const rowStart=Math.floor((s-startMin)/slot)+2;
    const span=Math.max(1,Math.ceil((e-s)/slot));

    const cls=b.tipo_aula==='LABORATORIO'
      ? 'laboratorio'
      : b.tipo_aula==='PROBLEMAS'
        ? 'problemas'
        : b.tipo_aula==='TEORICO_PRATICA'
          ? 'teorico-pratica'
          : b.tipo_aula==='OUTRA'
            ? 'outra'
            : '';

    html+=`<div class="week-block ${cls}"
      style="grid-column:${Number(b.dia_semana)+1};grid-row:${rowStart}/span ${span}">
      <b>${esc(b.disciplina||b.nome||'Aula')}</b>
      <small>${esc(b.hora_inicio.slice(0,5))}–${esc(b.hora_fim.slice(0,5))}</small>
    </div>`;
  });

  $('#scheduleViewerGrid').innerHTML=html;
}

function openScheduleViewer(title,subtitle,blocks,meta=[]){
  $('#scheduleViewerTitle').textContent=title;
  $('#scheduleViewerSub').textContent=subtitle||'';

  $('#scheduleViewerMeta').innerHTML=meta.map(x=>`<span class="badge gray">${esc(x)}</span>`).join('');

  $('#scheduleViewerBlocks').innerHTML=blocks.map(b=>`
    <tr>
      <td>${day(b.dia_semana)}</td>
      <td>${b.hora_inicio.slice(0,5)}</td>
      <td>${b.hora_fim.slice(0,5)}</td>
      <td><b>${esc(b.disciplina||b.nome||'')}</b></td>
      <td>${esc(b.tipo_aula)}</td>
    </tr>
  `).join('') || '<tr><td colspan="5">Sem blocos.</td></tr>';

  renderViewerWeekGrid(blocks);
  $('#scheduleViewer').showModal();
}

function openScheduleViewerByModel(modelId){
  const m=S.scheduleModels.find(x=>x.id===modelId);
  if(!m)return;

  const blocks=scheduleBlocksForModel(modelId);
  const people=schedulePeopleForModel(modelId);

  openScheduleViewer(
    m.nome,
    `${fmt(m.data_inicio)} → ${fmt(m.data_fim)}`,
    blocks,
    [
      `${blocks.length} bloco(s)`,
      `${people.length} pessoa(s)`,
      ...people.slice(0,5).map(p=>`${p.numero_corpo||'—'} · ${p.nome}`),
      ...(people.length>5?[`+${people.length-5} pessoa(s)`]:[])
    ]
  );
}

function openPersonSchedulePicker(){
  $('#personScheduleSearch').value='';
  renderPersonSchedulePicker();
  $('#personSchedulePicker').showModal();
}

function renderPersonSchedulePicker(){
  const q=String($('#personScheduleSearch').value||'').trim().toLowerCase();

  const rows=S.people.filter(p=>{
    if(!q)return true;
    return [
      p.numero_corpo,p.nome,p.posto,p.ano,p.ramo,p.curso
    ].some(v=>String(v||'').toLowerCase().includes(q));
  });

  $('#personScheduleList').innerHTML=rows.map(p=>{
    const modelIds=S.scheduleModelPeople
      .filter(x=>x.pessoa_id===p.id)
      .map(x=>x.horario_modelo_id);

    const legacyIds=S.schedulePeople
      .filter(x=>x.pessoa_id===p.id)
      .map(x=>x.horario_id);

    const count=modelIds.length+legacyIds.length;

    return `<div class="person-schedule-item">
      <div>
        <b>${esc(p.numero_corpo||'—')} · ${esc(p.nome)}</b>
        <small>${esc(p.ramo)} · ${esc(p.curso)} · ${p.ano||'—'}º ano · ${count} horário(s)</small>
      </div>
      <button type="button" class="secondary view-person-schedule" data-id="${p.id}">Ver horário</button>
    </div>`;
  }).join('');

  $$('.view-person-schedule').forEach(b=>b.onclick=()=>{
    $('#personSchedulePicker').close();
    openScheduleViewerByPerson(b.dataset.id);
  });
}

function openScheduleViewerByPerson(personId){
  const p=S.people.find(x=>x.id===personId);
  if(!p)return;

  const modelIds=S.scheduleModelPeople
    .filter(x=>x.pessoa_id===personId)
    .map(x=>x.horario_modelo_id);

  const blocks=S.schedules
    .filter(h=>{
      if(h.horario_modelo_id && modelIds.includes(h.horario_modelo_id)) return true;

      if(!h.horario_modelo_id){
        return S.schedulePeople.some(
          sp=>sp.pessoa_id===personId&&sp.horario_id===h.id
        );
      }

      return false;
    })
    .sort((a,b)=>a.dia_semana-b.dia_semana||a.hora_inicio.localeCompare(b.hora_inicio));

  const models=S.scheduleModels.filter(m=>modelIds.includes(m.id));

  openScheduleViewer(
    `Horário — ${p.nome}`,
    `Nº ${p.numero_corpo||'—'} · ${p.ramo} · ${p.curso} · ${p.ano||'—'}º ano`,
    blocks,
    [
      `${blocks.length} bloco(s)`,
      ...models.map(m=>m.nome)
    ]
  );
}

let SW={
  model:null,
  blocks:[],
  people:new Set()
};

const minutesFromTime=t=>{
  const [h,m]=String(t||'00:00').split(':').map(Number);
  return h*60+m;
};

const normalizeTime=t=>{
  const m=String(t||'').match(/(\d{1,2})[:.](\d{2})/);
  if(!m)return '';
  return `${String(Number(m[1])).padStart(2,'0')}:${m[2]}`;
};

function parseDayValue(v){
  const s=String(v||'').trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  const map={
    '1':1,'segunda':1,'segunda-feira':1,'seg':1,
    '2':2,'terca':2,'terca-feira':2,'ter':2,
    '3':3,'quarta':3,'quarta-feira':3,'qua':3,
    '4':4,'quinta':4,'quinta-feira':4,'qui':4,
    '5':5,'sexta':5,'sexta-feira':5,'sex':5,
    '6':6,'sabado':6,'sab':6,
    '7':7,'domingo':7,'dom':7
  };
  return map[s]||null;
}

function normalizeLessonType(v){
  const s=String(v||'')
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g,'')
    .replace(/[-\s]+/g,'_');

  if(['T','TEORICA'].includes(s)) return 'TEORICA';
  if(['TP','T_P','TEORICO_PRATICA','TEORICOPRATICA'].includes(s)) return 'TEORICO_PRATICA';
  if(['P','PB','PROBLEMA','PROBLEMAS'].includes(s)) return 'PROBLEMAS';
  if(['L','LAB','LABORATORIO','LABORATORIOS'].includes(s)) return 'LABORATORIO';
  return 'OUTRA';
}
function openScheduleWizard(model=null){
  SW.model=model;
  SW.blocks=model
    ? S.schedules
        .filter(h=>h.horario_modelo_id===model.id)
        .map(h=>({
          id:h.id,
          dia_semana:Number(h.dia_semana),
          hora_inicio:h.hora_inicio.slice(0,5),
          hora_fim:h.hora_fim.slice(0,5),
          disciplina:h.disciplina||'',
          tipo_aula:h.tipo_aula||'OUTRA'
        }))
    : [];

  SW.people=new Set(
    model
      ? S.scheduleModelPeople
          .filter(x=>x.horario_modelo_id===model.id)
          .map(x=>x.pessoa_id)
      : []
  );

  $('#scheduleWizardTitle').textContent=model?'Editar horário completo':'Novo horário completo';
  $('#swName').value=model?.nome||'';
  $('#swStartDate').value=model?.data_inicio||'';
  $('#swEndDate').value=model?.data_fim||'';
  $('#swNote').value=model?.observacao||'';

  $('#swDay').value='1';
  $('#swBlockStart').value='';
  $('#swBlockEnd').value='';
  $('#swSubject').value='';
  $('#swType').value='TEORICA';
  $('#swBulk').value='';
  $('#swPeopleSearch').value='';

  renderScheduleBlocks();
  renderSchedulePeople();
  $('#scheduleWizard').showModal();
}

function closeScheduleWizard(){
  $('#scheduleWizard').close();
}

function renderScheduleBlocks(){
  SW.blocks.sort((a,b)=>
    a.dia_semana-b.dia_semana ||
    a.hora_inicio.localeCompare(b.hora_inicio)
  );

  $('#swBlockCount').textContent=`${SW.blocks.length} bloco(s)`;

  $('#swBlocksBody').innerHTML=SW.blocks.map((b,i)=>`
    <tr>
      <td>${day(b.dia_semana)}</td>
      <td>${esc(b.hora_inicio)}</td>
      <td>${esc(b.hora_fim)}</td>
      <td><b>${esc(b.disciplina||'—')}</b></td>
      <td>${esc(b.tipo_aula)}</td>
      <td><button type="button" class="icon remove-schedule-block" data-index="${i}" title="Remover">×</button></td>
    </tr>
  `).join('') || '<tr><td colspan="6" class="muted">Ainda não adicionaste blocos.</td></tr>';

  $$('.remove-schedule-block').forEach(b=>b.onclick=()=>{
    SW.blocks.splice(Number(b.dataset.index),1);
    renderScheduleBlocks();
  });

  renderWeekGrid();
}

function addScheduleBlock(block){
  if(!block.dia_semana)return toast('Escolhe um dia válido.');
  if(!block.hora_inicio||!block.hora_fim)return toast('Indica início e fim.');
  if(minutesFromTime(block.hora_fim)<=minutesFromTime(block.hora_inicio)){
    return toast('A hora de fim tem de ser posterior à de início.');
  }

  SW.blocks.push({
    dia_semana:Number(block.dia_semana),
    hora_inicio:block.hora_inicio,
    hora_fim:block.hora_fim,
    disciplina:block.disciplina||'',
    tipo_aula:block.tipo_aula||'OUTRA'
  });

  renderScheduleBlocks();
}

function renderWeekGrid(){
  const startMin=8*60;
  const endMin=20*60;
  const slot=30;
  const slots=(endMin-startMin)/slot;
  const days=['','Seg','Ter','Qua','Qui','Sex','Sáb','Dom'];

  let html=`<div class="week-head" style="grid-column:1;grid-row:1"></div>`;

  for(let d=1;d<=7;d++){
    html+=`<div class="week-head" style="grid-column:${d+1};grid-row:1">${days[d]}</div>`;
  }

  for(let i=0;i<slots;i++){
    const mins=startMin+i*slot;
    const hh=String(Math.floor(mins/60)).padStart(2,'0');
    const mm=String(mins%60).padStart(2,'0');

    html+=`<div class="week-time" style="grid-column:1;grid-row:${i+2}">${hh}:${mm}</div>`;

    for(let d=1;d<=7;d++){
      html+=`<div class="week-cell" style="grid-column:${d+1};grid-row:${i+2}"></div>`;
    }
  }

  SW.blocks.forEach(b=>{
    const s=minutesFromTime(b.hora_inicio);
    const e=minutesFromTime(b.hora_fim);

    if(s<startMin||e>endMin)return;

    const rowStart=Math.floor((s-startMin)/slot)+2;
    const span=Math.max(1,Math.ceil((e-s)/slot));
    const cls=b.tipo_aula==='LABORATORIO'
      ? 'laboratorio'
      : b.tipo_aula==='PROBLEMAS'
        ? 'problemas'
        : b.tipo_aula==='TEORICO_PRATICA'
          ? 'teorico-pratica'
          : b.tipo_aula==='OUTRA'
            ? 'outra'
            : '';

    html+=`<div class="week-block ${cls}"
      style="grid-column:${Number(b.dia_semana)+1};grid-row:${rowStart}/span ${span}">
      <b>${esc(b.disciplina||'Aula')}</b>
      <small>${esc(b.hora_inicio)}–${esc(b.hora_fim)}</small>
    </div>`;
  });

  $('#swWeekGrid').innerHTML=html;
}

function visibleSchedulePeople(){
  const q=$('#swPeopleSearch').value.trim().toLowerCase();
  return S.people.filter(p=>{
    if(!q)return true;
    return [
      p.numero_corpo,p.nome,p.posto,p.ano,p.ramo,p.curso
    ].some(v=>String(v||'').toLowerCase().includes(q));
  });
}

function renderSchedulePeople(){
  const rows=visibleSchedulePeople();

  $('#swPeopleCount').textContent=`${SW.people.size} selecionada(s)`;

  $('#swPeople').innerHTML=rows.map(p=>`
    <label class="schedule-person">
      <input type="checkbox" class="sw-person-check" value="${p.id}" ${SW.people.has(p.id)?'checked':''}>
      <span>
        <b>${esc(p.numero_corpo||'—')} · ${esc(p.nome)}</b>
        <small>${esc(p.ramo)} · ${esc(p.curso)} · ${p.ano||'—'}º ano</small>
      </span>
    </label>
  `).join('');

  $$('.sw-person-check').forEach(c=>c.onchange=()=>{
    c.checked?SW.people.add(c.value):SW.people.delete(c.value);
    $('#swPeopleCount').textContent=`${SW.people.size} selecionada(s)`;
  });
}

function splitBulkScheduleLine(line){
  const raw=String(line||'').trim();
  if(!raw) return [];

  // 1) Excel / TSV
  if(raw.includes('\t')){
    return raw.split('\t').map(x=>x.trim()).filter(Boolean);
  }

  // 2) ponto e vírgula
  if(raw.includes(';')){
    return raw.split(';').map(x=>x.trim()).filter(Boolean);
  }

  // 3) vírgula
  if(raw.includes(',')){
    return raw.split(',').map(x=>x.trim()).filter(Boolean);
  }

  // 4) texto escrito/colado com espaços:
  //    "Terça 13:00 14:30 EG TEORICA"
  //    O primeiro token é o dia, os dois seguintes são horas,
  //    o último é o tipo e tudo no meio é disciplina.
  return raw.split(/\s+/).filter(Boolean);
}

function addBulkScheduleBlocks(){
  const text=$('#swBulk').value.trim();
  if(!text)return toast('Cola primeiro as linhas.');

  const lines=text.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  let added=0;
  let invalid=0;

  for(const line of lines){
    const cols=splitBulkScheduleLine(line);

    if(cols.length<5){
      invalid++;
      continue;
    }

    const dia=parseDayValue(cols[0]);
    const inicio=normalizeTime(cols[1]);
    const fim=normalizeTime(cols[2]);

    // último campo = tipo; tudo entre as horas e o tipo = disciplina
    const tipoRaw=cols[cols.length-1];
    const disciplina=cols.slice(3,-1).join(' ').trim();
    const tipo=normalizeLessonType(tipoRaw);

    if(
      !dia ||
      !inicio ||
      !fim ||
      !disciplina ||
      minutesFromTime(fim)<=minutesFromTime(inicio)
    ){
      invalid++;
      continue;
    }

    SW.blocks.push({
      dia_semana:dia,
      hora_inicio:inicio,
      hora_fim:fim,
      disciplina,
      tipo_aula:tipo
    });

    added++;
  }

  renderScheduleBlocks();

  if(added){
    $('#swBulk').value='';
  }

  if(!added){
    toast('Nenhuma linha válida. Exemplo: Terça 13:00 14:30 EG T');
    return;
  }

  toast(
    invalid
      ? `${added} bloco(s) adicionados · ${invalid} linha(s) ignoradas`
      : `${added} bloco(s) adicionados`
  );
}


async function saveScheduleWizard(){
  const nome=$('#swName').value.trim();
  const dataInicio=$('#swStartDate').value;
  const dataFim=$('#swEndDate').value;
  const observacao=$('#swNote').value.trim()||null;

  if(!nome)return toast('Dá um nome ao horário.');
  if(!dataInicio||!dataFim)return toast('Indica as datas de validade.');
  if(dataFim<dataInicio)return toast('A data de fim não pode ser anterior à data de início.');
  if(!SW.blocks.length)return toast('Adiciona pelo menos um bloco.');

  $('#scheduleWizardSave').disabled=true;

  try{
    let modelId=SW.model?.id;

    if(modelId){
      const {error}=await supabase
        .from('horario_modelos')
        .update({
          nome,
          data_inicio:dataInicio,
          data_fim:dataFim,
          observacao,
          atualizado_em:new Date().toISOString()
        })
        .eq('id',modelId);

      if(error)throw error;
    }else{
      const {data,error}=await supabase
        .from('horario_modelos')
        .insert({
          nome,
          data_inicio:dataInicio,
          data_fim:dataFim,
          observacao
        })
        .select()
        .single();

      if(error)throw error;
      modelId=data.id;
    }

    // Pessoas: associação única ao horário completo
    {
      const {error}=await supabase
        .from('horario_modelo_pessoas')
        .delete()
        .eq('horario_modelo_id',modelId);
      if(error)throw error;

      if(SW.people.size){
        const {error:insertPeopleError}=await supabase
          .from('horario_modelo_pessoas')
          .insert([...SW.people].map(pessoa_id=>({
            horario_modelo_id:modelId,
            pessoa_id
          })));
        if(insertPeopleError)throw insertPeopleError;
      }
    }

    // Blocos: todos são guardados em conjunto
    {
      const {error}=await supabase
        .from('horarios_base')
        .delete()
        .eq('horario_modelo_id',modelId);
      if(error)throw error;

      const payload=SW.blocks.map(b=>({
        horario_modelo_id:modelId,
        nome,
        dia_semana:Number(b.dia_semana),
        tipo_aula:b.tipo_aula,
        hora_inicio:b.hora_inicio,
        hora_fim:b.hora_fim,
        data_inicio:dataInicio,
        data_fim:dataFim,
        disciplina:b.disciplina||null
      }));

      const {error:insertBlocksError}=await supabase
        .from('horarios_base')
        .insert(payload);
      if(insertBlocksError)throw insertBlocksError;
    }

    closeScheduleWizard();
    toast('Horário completo guardado.');
    await load();
  }catch(e){
    toast(e.message||'Erro ao guardar o horário.');
  }finally{
    $('#scheduleWizardSave').disabled=false;
  }
}

async function deleteScheduleModel(id){
  const m=S.scheduleModels.find(x=>x.id===id);
  if(!m)return;

  if(!confirm(`Apagar o horário completo "${m.nome}" e todos os seus blocos?`))return;

  const {error}=await supabase
    .from('horario_modelos')
    .delete()
    .eq('id',id);

  if(error)return toast(error.message);

  toast('Horário apagado.');
  await load();
}

function openLegacySchedule(h=null){const ids=h?S.schedulePeople.filter(x=>x.horario_id===h.id).map(x=>x.pessoa_id):[];modal(h?'Editar horário':'Novo horário',`<div class="grid2"><label class="full">Nome<input name="nome" required value="${esc(h?.nome||'')}"></label><label>Dia<select name="dia_semana">${[1,2,3,4,5,6,7].map(n=>`<option value="${n}" ${h?.dia_semana===n?'selected':''}>${day(n)}</option>`).join('')}</select></label><label>Tipo<select name="tipo_aula">${['TEORICA','PRATICA','OUTRA'].map(v=>`<option ${h?.tipo_aula===v?'selected':''}>${v}</option>`).join('')}</select></label><label>Início<input type="time" name="hora_inicio" required value="${h?.hora_inicio?.slice(0,5)||''}"></label><label>Fim<input type="time" name="hora_fim" required value="${h?.hora_fim?.slice(0,5)||''}"></label><label>Data início<input type="date" name="data_inicio" required value="${h?.data_inicio||''}"></label><label>Data fim<input type="date" name="data_fim" required value="${h?.data_fim||''}"></label><label class="full">Disciplina<input name="disciplina" value="${esc(h?.disciplina||'')}"></label><label class="full">Pessoas${peopleChecks(ids)}</label></div>`,async f=>{const persons=f.getAll('persons'),x={nome:f.get('nome'),dia_semana:Number(f.get('dia_semana')),tipo_aula:f.get('tipo_aula'),hora_inicio:f.get('hora_inicio'),hora_fim:f.get('hora_fim'),data_inicio:f.get('data_inicio'),data_fim:f.get('data_fim'),disciplina:f.get('disciplina')||null};let id=h?.id;if(h){const r=await supabase.from('horarios_base').update(x).eq('id',id);if(r.error)return toast(r.error.message)}else{const r=await supabase.from('horarios_base').insert(x).select().single();if(r.error)return toast(r.error.message);id=r.data.id}await supabase.from('horario_pessoas').delete().eq('horario_id',id);if(persons.length){const r=await supabase.from('horario_pessoas').insert(persons.map(pessoa_id=>({horario_id:id,pessoa_id})));if(r.error)return toast(r.error.message)}closeModal();await load()})}
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
  $('#wePeople').innerHTML=rows.map(r=>{
    const p=S.people.find(x=>x.id===r.pessoa_id);
    const origin=p?.integra_equipa===false
      ? `Externo${p?.funcao?` · ${esc(p.funcao)}`:''}`
      : `${esc(r.curso||'')} · ${r.ano||''}º`;
    const detail=[
      origin,
      r.motivo?`Motivo: ${esc(r.motivo)}`:'',
      r.tem_alerta_aula?`Aula: ${esc(r.detalhe_aula||'')}`:''
    ].filter(Boolean).join(' · ');

    return `<label class="person-choice">
      <input class="assignCheck" type="checkbox" value="${r.pessoa_id}" ${W.selected.has(r.pessoa_id)?'checked':''}>
      <span>
        <b>${esc(r.numero_corpo||'—')} · ${esc(r.nome)}</b>
        <small>${detail}</small>
      </span>
      ${badge(r.estado)}
    </label>`;
  }).join('');
  $$('.assignCheck').forEach(c=>c.onchange=()=>{c.checked?W.selected.add(c.value):W.selected.delete(c.value);$('#weCount').textContent=`${W.selected.size} empenhado(s)`});
}

let participantTempSelection=new Set();

function participantRows(){
  const q=String($('#participantsSearch')?.value||'').trim().toLowerCase();
  const state=$('#participantsStateFilter')?.value||'';
  const group=$('#participantsGroupFilter')?.value||'';

  return S.people.filter(p=>{
    if(group==='equipa' && p.integra_equipa===false)return false;
    if(group==='externos' && p.integra_equipa!==false)return false;

    const a=W.availability.find(x=>x.pessoa_id===p.id);

    if(state && a?.estado!==state)return false;

    if(q){
      const values=[
        p.numero_corpo,p.nome,p.posto,p.funcao,p.ano,p.ramo,p.curso
      ].map(v=>String(v||'').toLowerCase());

      if(!values.some(v=>v.includes(q)))return false;
    }

    return true;
  });
}

function renderParticipantsSummary(){
  const selected=[...participantTempSelection];
  const infos=selected
    .map(id=>W.availability.find(a=>a.pessoa_id===id))
    .filter(Boolean);

  const unavailable=infos.filter(a=>a.estado==='INDISPONIVEL').length;
  const pending=infos.filter(a=>a.estado==='POR_CONFIRMAR').length;
  const externals=selected
    .map(id=>S.people.find(p=>p.id===id))
    .filter(p=>p?.integra_equipa===false).length;

  $('#participantsSummary').textContent=
    `${selected.length} selecionado(s) · ${externals} externo(s) · ${unavailable} indisponível(eis) · ${pending} por confirmar`;
}

function renderParticipantsDialog(){
  const rows=participantRows();

  $('#participantsBody').innerHTML=rows.map(p=>{
    const a=W.availability.find(x=>x.pessoa_id===p.id);
    const state=a?.estado||'—';

    return `<tr>
      <td>
        <input type="checkbox" class="participant-check" value="${p.id}" ${participantTempSelection.has(p.id)?'checked':''}>
      </td>
      <td>${esc(p.numero_corpo||'—')}</td>
      <td>
        <b>${esc(p.nome)}</b>
        <br><small>${esc(p.posto||'')}</small>
      </td>
      <td>
        <div class="participant-origin">
          <b>${p.integra_equipa===false?'Externo':'Equipa'}</b>
          <small>${esc(p.funcao||'')}</small>
        </div>
      </td>
      <td>${p.ano||'—'} · ${esc(p.curso||'—')}</td>
      <td>${badge(state)}</td>
      <td class="participant-reason">${esc(a?.motivo||'—')}</td>
      <td class="participant-class">${a?.tem_alerta_aula?esc(a?.detalhe_aula||'Aula'):'—'}</td>
    </tr>`;
  }).join('');

  $$('.participant-check').forEach(ch=>ch.onchange=()=>{
    ch.checked
      ? participantTempSelection.add(ch.value)
      : participantTempSelection.delete(ch.value);

    renderParticipantsSummary();
  });

  renderParticipantsSummary();
}

async function openParticipantsDialog(){
  const d=$('#weDate').value;
  const t=$('#weStart').value;

  if(!d||!t)return toast('Indica primeiro a data e a hora de início.');

  try{
    W.availability=await checkAvailability(d,t,W.event?.id||null);
    participantTempSelection=new Set(W.selected);

    $('#participantsDialogTitle').textContent=
      `Participantes — ${$('#weName').value||'Evento'}`;

    $('#participantsDialogSub').textContent=
      `${fmt(d)} · ${t}${$('#weEnd').value?'–'+$('#weEnd').value:''}`;

    $('#participantsSearch').value='';
    $('#participantsStateFilter').value='';
    $('#participantsGroupFilter').value='';

    renderParticipantsDialog();
    $('#participantsDialog').showModal();
  }catch(e){
    toast(e.message);
  }
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
$('#wizardClose').onclick=$('#wizardCancel').onclick=()=>$('#eventWizard').close();$('#wizardSave').onclick=saveWizard;$('#weOpenParticipants').onclick=openParticipantsDialog;
$('#participantsDialogClose').onclick=()=>$('#participantsDialog').close();
$('#participantsCancel').onclick=()=>$('#participantsDialog').close();

$('#participantsSearch').oninput=renderParticipantsDialog;
$('#participantsStateFilter').onchange=renderParticipantsDialog;
$('#participantsGroupFilter').onchange=renderParticipantsDialog;

$('#participantsSelectAvailable').onclick=()=>{
  participantRows().forEach(p=>{
    const a=W.availability.find(x=>x.pessoa_id===p.id);
    if(a?.estado==='DISPONIVEL')participantTempSelection.add(p.id);
  });
  renderParticipantsDialog();
};

$('#participantsClear').onclick=()=>{
  participantTempSelection.clear();
  renderParticipantsDialog();
};

$('#participantsApply').onclick=()=>{
  W.selected=new Set(participantTempSelection);
  $('#participantsDialog').close();
  renderWizardPeople();
};

$('#weCheck').onclick=wizardCheck;$('#weScope').onchange=()=>{updateScope();if(W.availability.length)renderWizardPeople()};$('#weScopeValue').onchange=()=>{if(W.availability.length)renderWizardPeople()};

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
};$('#personSearch').oninput=renderPeople;$('#newEventBtn').onclick=()=>openEventWizard();$('#newExternalPersonBtn').onclick=()=>openPerson(null,true);$('#newPersonBtn').onclick=()=>openPerson();
$$('#constraintsTable [data-cfilter]').forEach(el=>{
  el.addEventListener('input',renderConstraints);
  el.addEventListener('change',renderConstraints);
});
$$('#constraintsTable .sort-head').forEach(btn=>{
  btn.addEventListener('click',()=>{
    const key=btn.dataset.csort;
    if(constraintSort.key===key) constraintSort.dir*=-1;
    else {constraintSort.key=key;constraintSort.dir=1;}
    renderConstraints();
  });
});
$('#resetConstraintFilters').onclick=()=>{
  $$('#constraintsTable [data-cfilter]').forEach(el=>el.value='');
  constraintSort={key:'inicio',dir:-1};
  renderConstraints();
};

$$('#peopleTable [data-pfilter]').forEach(el=>{
  el.addEventListener('input',renderPeople);
  el.addEventListener('change',renderPeople);
});
$$('#peopleTable .sort-head').forEach(btn=>{
  btn.addEventListener('click',()=>{
    const key=btn.dataset.psort;
    if(peopleSort.key===key) peopleSort.dir*=-1;
    else {peopleSort.key=key;peopleSort.dir=1;}
    renderPeople();
  });
});
$('#resetPeopleFilters').onclick=()=>{
  $$('#peopleTable [data-pfilter]').forEach(el=>el.value='');
  peopleSort={key:'nome',dir:1};
  renderPeople();
};

$('#newConstraintBtn').onclick=()=>openConstraint();$('#viewPersonScheduleBtn').onclick=openPersonSchedulePicker;
$('#scheduleViewerClose').onclick=()=>$('#scheduleViewer').close();
$('#personSchedulePickerClose').onclick=()=>$('#personSchedulePicker').close();
$('#personScheduleSearch').oninput=renderPersonSchedulePicker;
$('#newScheduleBtn').onclick=()=>openScheduleWizard();$('#scheduleWizardClose').onclick=closeScheduleWizard;
$('#scheduleWizardCancel').onclick=closeScheduleWizard;
$('#scheduleWizardSave').onclick=saveScheduleWizard;
$('#swPeopleSearch').oninput=renderSchedulePeople;

$('#swSelectVisible').onclick=()=>{
  visibleSchedulePeople().forEach(p=>SW.people.add(p.id));
  renderSchedulePeople();
};

$('#swClearPeople').onclick=()=>{
  SW.people.clear();
  renderSchedulePeople();
};

$('#swAddBlock').onclick=()=>{
  addScheduleBlock({
    dia_semana:Number($('#swDay').value),
    hora_inicio:$('#swBlockStart').value,
    hora_fim:$('#swBlockEnd').value,
    disciplina:$('#swSubject').value.trim(),
    tipo_aula:$('#swType').value
  });

  $('#swSubject').value='';
};

$('#swBulkAdd').onclick=addBulkScheduleBlocks;

$('#refreshBtn').onclick=load;$$('nav button').forEach(b=>b.onclick=()=>page(b.dataset.page));
$('#availDate').value=today();

$('#loginForm').onsubmit=async e=>{e.preventDefault();const r=await supabase.auth.signInWithPassword({email:$('#loginEmail').value,password:$('#loginPassword').value});$('#loginError').textContent=r.error?.message||''};
$('#logoutBtn').onclick=()=>supabase.auth.signOut();
supabase.auth.onAuthStateChange(async(_e,s)=>{$('#loginView').classList.toggle('hidden',!!s);$('#appView').classList.toggle('hidden',!s);if(s){$('#sessionEmail').textContent=s.user.email||'';try{await load()}catch(e){toast(e.message)}}});
