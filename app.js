import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const supabase=createClient(
  'https://nfnxqiseohcnkgjbgata.supabase.co',
  'sb_publishable_LR4VwEg_DQLmMhS7C7MZUA_ZTKk4KVl'
);
const QG_PAGE=document.body.dataset.qgPage||'selector';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
let S={people:[],constraints:[],schedules:[],schedulePeople:[],scheduleModels:[],scheduleModelPeople:[],events:[],assigned:[],manualAvailability:[],eventCourseTargets:[],history:[],evaluations:[],availability:[]};
let constraintSorts=[{key:'inicio',dir:-1}];
let constraintFilters={pessoa:'',tipo:'',estado:'',inicio:'',fim:'',observacao:''};
let expandedConstraints=new Set();

let peopleGroupPreset='';
let peopleSorts=[{key:'nome',dir:1}];
let peopleFilters={numero_corpo:'',nome:'',posto:'',ano:'',ramo:'',curso:'',idade:'',localidade:''};

let eventSorts=[{key:'data',dir:1},{key:'hora',dir:1}];
let historySorts=[{key:'data',dir:-1}];
let externalSorts=[{key:'nome',dir:1}];
let scheduleBlockSorts=[{key:'dia',dir:1},{key:'inicio',dir:1}];
let currentScheduleViewerBlocks=[];
let classScheduleIndex=0;
let classAgendaMonth=new Date(new Date().getFullYear(),new Date().getMonth(),1);
let classAgendaView='calendar';
let classAgendaFilters={subject:'',type:'',person:'',group:''};
let moduleDataLoadedAt=null;

let classSorts=[{key:'nome',dir:1}];
let classFilters={numero_corpo:'',nome:'',posto:'',ano:'',ramo:'',nim:''};
let availSorts=[{key:'nome',dir:1}];
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

function multiSortClick(sorts,key){
  const index=sorts.findIndex(s=>s.key===key);

  if(index===0){
    sorts[0].dir*=-1;
    return;
  }

  if(index>0){
    const [existing]=sorts.splice(index,1);
    sorts.unshift(existing);
    return;
  }

  sorts.unshift({key,dir:1});
}

function multiSortIndicator(buttons,sorts,dataKey){
  buttons.forEach(btn=>{
    const key=btn.dataset[dataKey];
    const index=sorts.findIndex(s=>s.key===key);
    const active=index!==-1;

    btn.classList.toggle('active',active);

    const span=btn.querySelector('span');
    if(span){
      span.textContent=active
        ? `${sorts[index].dir===1?'↑':'↓'}${index+1}`
        : '↕';
    }

    btn.title=active
      ? `${index+1}.º critério de ordenação`
      : 'Adicionar como critério principal';
  });
}


function isEngineeringCourse(course){
  const c=String(course||'').trim().toUpperCase();

  // MAT é o nome pedido para o grupo. Mantemos SMAT incluído também
  // para continuar compatível com registos já existentes na base.
  return ['TM','MAT','SMAT','ENG'].includes(c);
}

function matchesCourseFilter(course,filterValue){
  const raw=String(filterValue||'').trim();
  if(!raw)return true;

  const tokens=raw
    .split(/[;,]/)
    .map(x=>x.trim())
    .filter(Boolean);

  const c=String(course||'').trim().toUpperCase();

  return tokens.some(token=>{
    const t=token.toUpperCase();

    if(['ENGENHEIROS','ENGENHEIRO'].includes(t)){
      return isEngineeringCourse(c);
    }

    return c.includes(t);
  });
}

function genericCompare(a,b,key,dir=1,numericKeys=[]){
  let av=a?.[key]??'',bv=b?.[key]??'';

  if(numericKeys.includes(key)){
    const an=Number(av),bn=Number(bv);
    if(!Number.isNaN(an)&&!Number.isNaN(bn)){
      return (an-bn)*dir;
    }
  }

  return String(av).localeCompare(
    String(bv),
    'pt',
    {numeric:true,sensitivity:'base'}
  )*dir;
}

function toast(x){$('#toast').textContent=x;$('#toast').classList.remove('hidden');setTimeout(()=>$('#toast').classList.add('hidden'),2200)}
async function sel(t,c='*'){const {data,error}=await supabase.from(t).select(c);if(error)throw error;return data||[]}
async function selOptional(t,c='*'){
  const {data,error}=await supabase.from(t).select(c);
  if(error){
    // Permite abrir a app antes de correr a migração nova.
    if(error.code==='42P01' || error.code==='PGRST205')return [];
    throw error;
  }
  return data||[];
}

async function load(){
  const [people,constraints,schedules,sp,scheduleModels,scheduleModelPeople,events,assigned,manualAvailability,eventCourseTargets,history,evaluations]=await Promise.all([
    sel('pessoas'),
    sel('constrangimentos'),
    sel('horarios_base'),
    sel('horario_pessoas'),
    sel('horario_modelos'),
    sel('horario_modelo_pessoas'),
    sel('eventos'),
    sel('evento_empenhados'),
    sel('evento_disponibilidade_manual'),
    sel('evento_cursos_alvo'),
    supabase.from('historico').select('*').order('alterado_em',{ascending:false}).limit(100).then(r=>{if(r.error)throw r.error;return r.data||[]}),
    selOptional('avaliacoes_turma')
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
    manualAvailability,
    eventCourseTargets,
    history,
    evaluations
  });
  moduleDataLoadedAt=new Date();
  render();
}
function render(){renderHome();renderPeople();renderExternalPeople();renderConstraints();renderSchedules();renderEvents();renderHistory();renderClassModule();renderModuleCounts()}


function tmPeople(){
  return S.people.filter(
    p=>p.ativo!==false &&
       String(p.curso||'').trim().toUpperCase()==='TM' &&
       Number(p.ano)===6
  );
}

function indexDatePlusDays(days){
  const base=new Date();
  base.setHours(12,0,0,0);
  base.setDate(base.getDate()+days);
  return [
    base.getFullYear(),
    String(base.getMonth()+1).padStart(2,'0'),
    String(base.getDate()).padStart(2,'0')
  ].join('-');
}

function shortIndexDate(iso){
  if(!iso)return '—';
  const d=new Date(`${iso}T12:00:00`);
  return new Intl.DateTimeFormat('pt-PT',{
    day:'2-digit',
    month:'short'
  }).format(d).replace('.','');
}

async function renderModuleCounts(){
  const team=S.people.filter(p=>p.ativo!==false && p.integra_equipa!==false);
  const tm=tmPeople();

  if($('#moduleTeamCount'))$('#moduleTeamCount').textContent=team.length;
  if($('#moduleClassCount'))$('#moduleClassCount').textContent=tm.length;

  const todayIso=today();
  const end7Iso=indexDatePlusDays(7);

  // EQUIPA — próximos eventos nos 7 dias seguintes.
  const upcomingEvents=S.events.filter(e=>
    !eventIsCancelled(e) &&
    String(e.data||'')>=todayIso &&
    String(e.data||'')<=end7Iso
  );

  if($('#moduleTeamUpcomingEvents')){
    $('#moduleTeamUpcomingEvents').textContent=upcomingEvents.length;
    const label=$('#moduleTeamUpcomingEventsLabel');
    if(label){
      label.textContent=`evento${upcomingEvents.length===1?'':'s'} · 7 dias`;
    }
  }

  // EQUIPA — disponibilidade de amanhã pela mesma RPC usada pelo módulo.
  const tomorrow=indexDatePlusDays(1);
  const unavailableTarget=$('#moduleTeamTomorrowUnavailable');

  if(unavailableTarget){
    unavailableTarget.textContent='…';

    try{
      const rows=await checkAvailability(tomorrow);
      const teamIds=new Set(team.map(p=>String(p.id)));

      const unavailable=rows.filter(r=>{
        const rowId=String(r.pessoa_id||r.id||'');
        const belongs=rowId
          ? teamIds.has(rowId)
          : team.some(p=>
              String(p.numero_corpo||'')===String(r.numero_corpo||'')
            );

        return belongs && r.estado==='INDISPONIVEL';
      }).length;

      unavailableTarget.textContent=unavailable;
    }catch{
      unavailableTarget.textContent='—';
    }
  }

  // TURMA — avaliações únicas, para não contar a mesma prova uma vez por pessoa.
  const classEvaluations=aggregateAgendaEvaluations(classEvaluationRows())
    .filter(ev=>String(ev.data||'')>=todayIso)
    .sort((a,b)=>
      String(a.data||'').localeCompare(String(b.data||'')) ||
      String(a.cadeira||'').localeCompare(String(b.cadeira||''),'pt')
    );

  const nextEvaluation=classEvaluations[0]||null;
  const weekEvaluations=classEvaluations.filter(ev=>
    String(ev.data||'')<=end7Iso
  );

  if($('#moduleClassNextEvaluation')){
    $('#moduleClassNextEvaluation').textContent=nextEvaluation
      ? `${shortIndexDate(nextEvaluation.data)} · ${nextEvaluation.cadeira}`
      : 'Sem avaliações';
  }

  if($('#moduleClassWeekEvaluations')){
    $('#moduleClassWeekEvaluations').textContent=weekEvaluations.length;
  }

  // Rodapé: hora real em que os dados foram carregados nesta sessão.
  const footer=$('#moduleDataUpdated');
  if(footer && moduleDataLoadedAt){
    footer.textContent=`Dados carregados às ${moduleDataLoadedAt.toLocaleTimeString('pt-PT',{
      hour:'2-digit',
      minute:'2-digit'
    })}`;
  }
}

function showModuleSelector(){
  $('#moduleView').classList.remove('hidden');
  $('#appView').classList.add('hidden');
  $('#classView').classList.add('hidden');
}

function showTeamModule(){
  $('#moduleView').classList.add('hidden');
  $('#classView').classList.add('hidden');
  $('#appView').classList.remove('hidden');
}

function showClassModule(){
  $('#moduleView').classList.add('hidden');
  $('#appView').classList.add('hidden');
  $('#classView').classList.remove('hidden');
  renderClassModule();
}

const classTitles={
  classInicio:['Resumo da Turma','Turma TM · 6.º ano.'],
  classPessoas:['Turma TM · 6.º ano','Todos os TM do 6.º ano.'],
  classAgenda:['Agenda da Turma','Calendário de avaliações do 6.º ano TM.'],
  classHorarios:['Horários da Turma','Horários 6.º ANO TM_1 a 6.º ANO TM_4.']
};

function classPage(id){
  $$('.class-page').forEach(x=>x.classList.toggle('active',x.id===id));
  $$('.class-nav button').forEach(x=>x.classList.toggle('active',x.dataset.classPage===id));
  const t=classTitles[id];
  if(t){$('#classPageTitle').textContent=t[0];$('#classPageSubtitle').textContent=t[1]}
  if(id==='classAgenda')renderClassAgenda();
}

function classOrigin(p){
  return p.integra_equipa===false?'Externo':'Equipa';
}




function isoDateFromLocalDate(date){
  return [
    date.getFullYear(),
    String(date.getMonth()+1).padStart(2,'0'),
    String(date.getDate()).padStart(2,'0')
  ].join('-');
}

function addDaysToDate(date,days){
  const d=new Date(date.getFullYear(),date.getMonth(),date.getDate());
  d.setDate(d.getDate()+days);
  return d;
}

// Gregorian Easter (Meeus/Jones/Butcher), used for movable Portuguese holidays.
function easterSunday(year){
  const a=year%19;
  const b=Math.floor(year/100);
  const c=year%100;
  const d=Math.floor(b/4);
  const e=b%4;
  const f=Math.floor((b+8)/25);
  const g=Math.floor((b-f+1)/3);
  const h=(19*a+b-d-g+15)%30;
  const i=Math.floor(c/4);
  const k=c%4;
  const l=(32+2*e+2*i-h-k)%7;
  const m=Math.floor((a+11*h+22*l)/451);
  const month=Math.floor((h+l-7*m+114)/31);
  const day=((h+l-7*m+114)%31)+1;
  return new Date(year,month-1,day);
}

function portugueseNationalHolidays(year){
  const easter=easterSunday(year);

  const fixed=[
    [`${year}-01-01`,'Ano Novo'],
    [`${year}-04-25`,'Dia da Liberdade'],
    [`${year}-05-01`,'Dia do Trabalhador'],
    [`${year}-06-10`,'Dia de Portugal'],
    [`${year}-08-15`,'Assunção de Nossa Senhora'],
    [`${year}-10-05`,'Implantação da República'],
    [`${year}-11-01`,'Dia de Todos os Santos'],
    [`${year}-12-01`,'Restauração da Independência'],
    [`${year}-12-08`,'Imaculada Conceição'],
    [`${year}-12-25`,'Natal']
  ].map(([data,nome])=>({data,nome,tipo:'Feriado'}));

  const movable=[
    {
      data:isoDateFromLocalDate(addDaysToDate(easter,-2)),
      nome:'Sexta-feira Santa',
      tipo:'Feriado'
    },
    {
      data:isoDateFromLocalDate(easter),
      nome:'Domingo de Páscoa',
      tipo:'Feriado'
    },
    {
      data:isoDateFromLocalDate(addDaysToDate(easter,60)),
      nome:'Corpo de Deus',
      tipo:'Feriado'
    }
  ];

  return [...fixed,...movable].sort((a,b)=>a.data.localeCompare(b.data));
}

function classAgendaHolidaysForRange(startDate,endDate){
  const years=new Set();
  for(let y=startDate.getFullYear();y<=endDate.getFullYear();y++)years.add(y);

  const start=isoDateFromLocalDate(startDate);
  const end=isoDateFromLocalDate(endDate);

  return [...years]
    .flatMap(y=>portugueseNationalHolidays(y))
    .filter(h=>h.data>=start&&h.data<=end);
}

function classEvaluationRows(){
  const turmaIds=new Set(tmPeople().map(p=>p.id));

  return S.evaluations
    .filter(ev=>turmaIds.has(ev.pessoa_id))
    .map(ev=>({
      ...ev,
      pessoa:S.people.find(p=>p.id===ev.pessoa_id)||null
    }))
    .filter(ev=>ev.pessoa);
}

function agendaTypeClass(tipo){
  const s=String(tipo||'Outro')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g,'');

  if(s==='teste')return 'teste';
  if(s==='exame')return 'exame';
  if(s==='trabalho')return 'trabalho';
  if(s==='apresentacao')return 'apresentacao';
  return 'outro';
}

function evaluationGroupKey(ev){
  return [
    ev.data||'',
    String(ev.cadeira||'').trim().toLowerCase(),
    String(ev.tipo||'').trim().toLowerCase(),
    String(ev.observacao||'').trim().toLowerCase()
  ].join('|');
}

function aggregateAgendaEvaluations(rows){
  const grouped=new Map();

  rows.forEach(ev=>{
    const key=evaluationGroupKey(ev);

    if(!grouped.has(key)){
      grouped.set(key,{
        key,
        data:ev.data,
        cadeira:ev.cadeira||'—',
        tipo:ev.tipo||'Outro',
        observacao:ev.observacao||'',
        people:[],
        records:[]
      });
    }

    grouped.get(key).people.push(ev.pessoa);
    grouped.get(key).records.push(ev);
  });

  return [...grouped.values()];
}

function findAgendaGroupByKey(key){
  return aggregateAgendaEvaluations(classEvaluationRows())
    .find(group=>group.key===key)||null;
}

function agendaShortName(name){
  const parts=String(name||'').trim().split(/\s+/).filter(Boolean);
  if(parts.length<=2)return parts.join(' ');
  return `${parts[0]} ${parts[parts.length-1]}`;
}


function classSubjectOptions(){
  const subjects=new Set();

  tmPeople().forEach(p=>{
    subjectsForPerson(p.id).forEach(s=>subjects.add(s));
  });

  return [...subjects].sort((a,b)=>
    a.localeCompare(b,'pt',{sensitivity:'base'})
  );
}

function openAgendaEvaluationEditor(defaultDate='',group=null){
  const isEdit=Boolean(group);
  const people=[...tmPeople()].sort((a,b)=>{
    const an=Number(a.numero_corpo),bn=Number(b.numero_corpo);
    if(!Number.isNaN(an)&&!Number.isNaN(bn))return an-bn;
    return String(a.nome||'').localeCompare(String(b.nome||''),'pt');
  });

  const selectedIds=new Set(
    isEdit
      ? group.people.map(p=>String(p.id))
      : []
  );

  const subjects=classSubjectOptions();
  const subjectOptions=subjects
    .map(s=>`<option value="${esc(s)}"></option>`)
    .join('');

  const currentType=isEdit?String(group.tipo||'Teste'):'Teste';

  modal(
    isEdit?'Gerir avaliação':'Nova avaliação da turma',
    `<div class="agenda-create-form">
      <div class="grid2">
        <label class="full">Cadeira
          <input
            name="cadeira"
            list="agendaEvaluationSubjects"
            required
            value="${esc(isEdit?group.cadeira:'')}"
            placeholder="Escolhe ou escreve a cadeira">
          <datalist id="agendaEvaluationSubjects">${subjectOptions}</datalist>
        </label>

        <label>Tipo
          <select name="tipo">
            ${['Teste','Exame','Trabalho','Apresentação','Outro']
              .map(t=>`<option value="${t}" ${currentType===t?'selected':''}>${t}</option>`)
              .join('')}
          </select>
        </label>

        <label>Data
          <input name="data" type="date" required
            value="${esc(isEdit?group.data:(defaultDate||today()))}">
        </label>

        <label class="full">Observação
          <input name="observacao"
            value="${esc(isEdit?(group.observacao||''):'')}"
            placeholder="Opcional">
        </label>
      </div>

      <div class="agenda-person-picker">
        <div class="agenda-person-picker-head">
          <div>
            <b>Associar pessoas</b>
            <small>Seleciona uma ou mais pessoas da turma.</small>
          </div>
          <span id="agendaSelectedPeopleCount">0 selecionadas</span>
        </div>

        <div class="agenda-group-select">
          <span>Seleção rápida por horário</span>
          <div class="agenda-group-buttons">
            <button type="button" class="secondary agenda-group-btn" data-group="all">Toda a turma</button>
            ${[1,2,3,4].map(n=>`
              <button type="button" class="secondary agenda-group-btn" data-group="${n}">
                TM_${n} · ${classSchedulePeopleByGroup(n).length}
              </button>
            `).join('')}
          </div>
        </div>

        <div class="agenda-person-picker-tools">
          <input id="agendaPersonSearch" type="search" placeholder="Pesquisar nº ou nome...">
          <button id="agendaSelectVisible" type="button" class="secondary">Selecionar visíveis</button>
          <button id="agendaClearPeople" type="button" class="secondary">Limpar</button>
        </div>

        <div id="agendaPersonList" class="agenda-person-list">
          ${people.map(p=>`
            <label class="agenda-person-option"
                   data-search="${esc(`${p.numero_corpo||''} ${p.nome||''}`.toLowerCase())}">
              <input type="checkbox" name="pessoa_id" value="${p.id}"
                ${selectedIds.has(String(p.id))?'checked':''}>
              <span>
                <b>${esc(p.numero_corpo||'—')} · ${esc(p.nome)}</b>
                <small>${esc(p.ramo||'—')} · TM · 6.º ano</small>
              </span>
            </label>
          `).join('')}
        </div>
      </div>

      ${isEdit?`
        <div class="agenda-edit-danger">
          <div>
            <b>Eliminar avaliação</b>
            <small>Apaga esta avaliação para todas as pessoas atualmente associadas.</small>
          </div>
          <button id="agendaDeleteEvaluationGroup" type="button" class="danger-btn">
            Eliminar para todos
          </button>
        </div>
      `:''}
    </div>`,
    async f=>{
      const personIds=f.getAll('pessoa_id').map(String);

      if(!personIds.length){
        return toast('Seleciona pelo menos uma pessoa.');
      }

      const cadeira=String(f.get('cadeira')||'').trim();
      const tipo=String(f.get('tipo')||'Teste');
      const data=String(f.get('data')||'');
      const observacao=String(f.get('observacao')||'').trim()||null;

      if(!cadeira || !data){
        return toast('Preenche a cadeira e a data.');
      }

      if(!isEdit){
        const existing=new Set(
          S.evaluations
            .filter(ev=>
              String(ev.data||'')===data &&
              String(ev.cadeira||'').trim().toLowerCase()===cadeira.toLowerCase() &&
              String(ev.tipo||'').trim().toLowerCase()===tipo.toLowerCase()
            )
            .map(ev=>String(ev.pessoa_id))
        );

        const newIds=personIds.filter(id=>!existing.has(id));

        if(!newIds.length){
          return toast('Essa avaliação já está associada às pessoas selecionadas.');
        }

        const rows=newIds.map(personId=>({
          pessoa_id:personId,
          cadeira,
          tipo,
          data,
          observacao
        }));

        const {error}=await supabase
          .from('avaliacoes_turma')
          .insert(rows);

        if(error)return toast(error.message);

        closeModal();
        await refreshEvaluations();
        renderClassModule();

        const skipped=personIds.length-newIds.length;
        toast(
          skipped
            ? `Avaliação adicionada a ${newIds.length} pessoa(s); ${skipped} já tinha(m) esse registo.`
            : `Avaliação adicionada a ${newIds.length} pessoa(s).`
        );
        return;
      }

      const groupRecords=group.records||[];
      const groupRecordIds=groupRecords.map(r=>r.id);
      const currentIds=new Set(groupRecords.map(r=>String(r.pessoa_id)));
      const selectedSet=new Set(personIds);

      const commonPayload={cadeira,tipo,data,observacao};

      // Atualiza os registos que já pertenciam a esta avaliação.
      if(groupRecordIds.length){
        const {error:updateError}=await supabase
          .from('avaliacoes_turma')
          .update(commonPayload)
          .in('id',groupRecordIds);

        if(updateError)return toast(updateError.message);
      }

      // Remove pessoas que foram desmarcadas.
      const removeIds=groupRecords
        .filter(r=>!selectedSet.has(String(r.pessoa_id)))
        .map(r=>r.id);

      if(removeIds.length){
        const {error:deleteError}=await supabase
          .from('avaliacoes_turma')
          .delete()
          .in('id',removeIds);

        if(deleteError)return toast(deleteError.message);
      }

      // Adiciona novas pessoas, evitando duplicados já existentes fora do grupo.
      const targetOutside=new Set(
        S.evaluations
          .filter(ev=>
            !groupRecordIds.includes(ev.id) &&
            String(ev.data||'')===data &&
            String(ev.cadeira||'').trim().toLowerCase()===cadeira.toLowerCase() &&
            String(ev.tipo||'').trim().toLowerCase()===tipo.toLowerCase()
          )
          .map(ev=>String(ev.pessoa_id))
      );

      const addIds=personIds.filter(id=>
        !currentIds.has(id) &&
        !targetOutside.has(id)
      );

      if(addIds.length){
        const {error:insertError}=await supabase
          .from('avaliacoes_turma')
          .insert(addIds.map(personId=>({
            pessoa_id:personId,
            ...commonPayload
          })));

        if(insertError)return toast(insertError.message);
      }

      closeModal();
      await refreshEvaluations();
      renderClassModule();

      const skipped=personIds.filter(id=>!currentIds.has(id)&&targetOutside.has(id)).length;
      toast(
        skipped
          ? `Avaliação atualizada. ${skipped} associação(ões) já existia(m).`
          : 'Avaliação atualizada.'
      );
    }
  );

  const search=$('#agendaPersonSearch');
  const options=()=>$$('.agenda-person-option');

  const updateCount=()=>{
    const n=$$('.agenda-person-option input:checked').length;
    $('#agendaSelectedPeopleCount').textContent=
      `${n} selecionada${n===1?'':'s'}`;
  };

  const filterPeople=()=>{
    const q=String(search.value||'').trim().toLowerCase();
    options().forEach(label=>{
      label.classList.toggle(
        'hidden',
        Boolean(q) && !String(label.dataset.search||'').includes(q)
      );
    });
  };

  search.oninput=filterPeople;

  options().forEach(label=>{
    label.querySelector('input').onchange=updateCount;
  });

  $('#agendaSelectVisible').onclick=()=>{
    options()
      .filter(label=>!label.classList.contains('hidden'))
      .forEach(label=>{
        label.querySelector('input').checked=true;
      });
    updateCount();
  };

  $('#agendaClearPeople').onclick=()=>{
    options().forEach(label=>{
      label.querySelector('input').checked=false;
    });
    updateCount();
  };

  $$('.agenda-group-btn').forEach(btn=>{
    btn.onclick=()=>{
      const groupNumber=btn.dataset.group;

      if(groupNumber==='all'){
        options().forEach(label=>{
          label.querySelector('input').checked=true;
        });
      }else{
        const ids=new Set(
          classSchedulePeopleByGroup(Number(groupNumber)).map(p=>String(p.id))
        );

        options().forEach(label=>{
          const input=label.querySelector('input');
          if(ids.has(String(input.value)))input.checked=true;
        });
      }

      updateCount();
    };
  });

  if(isEdit){
    $('#agendaDeleteEvaluationGroup').onclick=async()=>{
      if(!confirm(
        `Eliminar "${group.cadeira}" de ${fmt(group.data)} para todas as ${group.records.length} pessoa(s) associadas?`
      ))return;

      const ids=(group.records||[]).map(r=>r.id);
      if(!ids.length)return;

      const {error}=await supabase
        .from('avaliacoes_turma')
        .delete()
        .in('id',ids);

      if(error)return toast(error.message);

      closeModal();
      await refreshEvaluations();
      renderClassModule();
      toast('Avaliação eliminada para todos.');
    };
  }

  updateCount();
}



function agendaPeopleLabel(people){
  const sorted=[...people].sort((a,b)=>
    String(a.nome||'').localeCompare(String(b.nome||''),'pt')
  );

  if(sorted.length<=3){
    return sorted
      .map(p=>`${p.numero_corpo||'—'} · ${agendaShortName(p.nome)}`)
      .join(' · ');
  }

  return `${sorted.slice(0,3)
    .map(p=>`${p.numero_corpo||'—'} · ${agendaShortName(p.nome)}`)
    .join(' · ')} · +${sorted.length-3}`;
}


function renderAgendaFilterOptions(groups){
  const subject=$('#agendaFilterSubject');
  const person=$('#agendaFilterPerson');
  if(!subject||!person)return;

  const subjects=[...new Set(
    groups.map(g=>String(g.cadeira||'').trim()).filter(Boolean)
  )].sort((a,b)=>a.localeCompare(b,'pt',{sensitivity:'base'}));

  const people=[...tmPeople()].sort((a,b)=>{
    const an=Number(a.numero_corpo),bn=Number(b.numero_corpo);
    if(!Number.isNaN(an)&&!Number.isNaN(bn))return an-bn;
    return String(a.nome||'').localeCompare(String(b.nome||''),'pt');
  });

  subject.innerHTML=
    '<option value="">Todas</option>'+
    subjects.map(s=>`<option value="${esc(s)}">${esc(s)}</option>`).join('');

  person.innerHTML=
    '<option value="">Todas</option>'+
    people.map(p=>`
      <option value="${p.id}">
        ${esc(p.numero_corpo||'—')} · ${esc(p.nome)}
      </option>
    `).join('');

  subject.value=classAgendaFilters.subject;
  $('#agendaFilterType').value=classAgendaFilters.type;
  person.value=classAgendaFilters.person;
  $('#agendaFilterGroup').value=classAgendaFilters.group;
}

function filterAgendaGroups(groups){
  let result=[...groups];

  if(classAgendaFilters.subject){
    const target=classAgendaFilters.subject.toLowerCase();
    result=result.filter(g=>
      String(g.cadeira||'').trim().toLowerCase()===target
    );
  }

  if(classAgendaFilters.type){
    result=result.filter(g=>
      String(g.tipo||'')===classAgendaFilters.type
    );
  }

  if(classAgendaFilters.person){
    result=result.filter(g=>
      g.people.some(p=>String(p.id)===String(classAgendaFilters.person))
    );
  }

  if(classAgendaFilters.group){
    const groupIds=new Set(
      classSchedulePeopleByGroup(Number(classAgendaFilters.group))
        .map(p=>String(p.id))
    );

    result=result.filter(g=>
      g.people.some(p=>groupIds.has(String(p.id)))
    );
  }

  return result;
}

function bindAgendaFilters(){
  const map=[
    ['#agendaFilterSubject','subject'],
    ['#agendaFilterType','type'],
    ['#agendaFilterPerson','person'],
    ['#agendaFilterGroup','group']
  ];

  map.forEach(([selector,key])=>{
    const el=$(selector);
    if(!el)return;
    el.onchange=()=>{
      classAgendaFilters[key]=el.value;
      renderClassAgenda();
    };
  });

  const clear=$('#agendaClearFilters');
  if(clear){
    clear.onclick=()=>{
      classAgendaFilters={subject:'',type:'',person:'',group:''};
      renderClassAgenda();
    };
  }
}

function bindAgendaEvaluationManagement(){
  $$('.agenda-evaluation-manage').forEach(el=>{
    el.onclick=e=>{
      e.stopPropagation();
      const key=decodeURIComponent(el.dataset.evalKey||'');
      const group=findAgendaGroupByKey(key);
      if(group)openAgendaEvaluationEditor(group.data,group);
    };
  });
}

function renderClassAgendaList(all,holidays=[]){
  const target=$('#classAgendaList');
  if(!target)return;

  const todayIso=today();

  const evalItems=[...all].map(ev=>({
    kind:'evaluation',
    data:ev.data,
    value:ev
  }));

  const holidayItems=[...holidays].map(h=>({
    kind:'holiday',
    data:h.data,
    value:h
  }));

  const items=[...evalItems,...holidayItems];

  const upcoming=items
    .filter(item=>String(item.data||'')>=todayIso)
    .sort((a,b)=>
      String(a.data||'').localeCompare(String(b.data||'')) ||
      String(a.kind).localeCompare(String(b.kind))
    );

  const past=items
    .filter(item=>String(item.data||'')<todayIso)
    .sort((a,b)=>
      String(b.data||'').localeCompare(String(a.data||'')) ||
      String(a.kind).localeCompare(String(b.kind))
    );

  const rows=(rows,pastMode=false)=>rows.map(item=>{
    if(item.kind==='holiday'){
      const h=item.value;
      return `
        <div class="agenda-list-row holiday-row ${pastMode?'past':''}">
          <div class="agenda-list-date">
            <strong>${fmt(h.data)}</strong>
            <span>${new Intl.DateTimeFormat('pt-PT',{weekday:'short'}).format(new Date(`${h.data}T12:00:00`))}</span>
          </div>

          <div class="agenda-list-type feriado">Feriado</div>

          <div class="agenda-list-main">
            <b>${esc(h.nome)}</b>
            <small>Feriado nacional</small>
          </div>

          <div class="agenda-list-people">
            <span>Turma</span>
            <small>Sem atividade letiva associada</small>
          </div>
        </div>`;
    }

    const ev=item.value;
    const cls=agendaTypeClass(ev.tipo);
    const people=[...ev.people].sort((a,b)=>
      String(a.nome||'').localeCompare(String(b.nome||''),'pt')
    );

    return `
      <div class="agenda-list-row agenda-evaluation-manage ${pastMode?'past':''}"
           data-eval-key="${esc(encodeURIComponent(ev.key))}"
           title="Abrir e gerir esta avaliação">
        <div class="agenda-list-date">
          <strong>${fmt(ev.data)}</strong>
          <span>${new Intl.DateTimeFormat('pt-PT',{weekday:'short'}).format(new Date(`${ev.data}T12:00:00`))}</span>
        </div>

        <div class="agenda-list-type ${cls}">${esc(ev.tipo||'Outro')}</div>

        <div class="agenda-list-main">
          <b>${esc(ev.cadeira||'—')}</b>
          ${ev.observacao?`<small>${esc(ev.observacao)}</small>`:''}
        </div>

        <div class="agenda-list-people">
          <span>${esc(agendaPeopleLabel(people))}</span>
          <small>${people.length} pessoa${people.length===1?'':'s'}</small>
        </div>
      </div>`;
  }).join('');

  target.innerHTML=`
    <div class="agenda-list-section">
      <div class="agenda-list-section-head">
        <h3>Próximos compromissos</h3>
        <span>${upcoming.length}</span>
      </div>
      ${upcoming.length?rows(upcoming):'<div class="summary">Sem compromissos futuros.</div>'}
    </div>

    ${past.length?`
      <details class="agenda-past-details">
        <summary>Anteriores · ${past.length}</summary>
        <div class="agenda-list-section past-section">
          ${rows(past,true)}
        </div>
      </details>
    `:''}
  `;
}

function syncAgendaView(){
  const calendar=$('#classCalendarViewWrap');
  const list=$('#classAgendaList');
  const calendarBtn=$('#agendaCalendarView');
  const listBtn=$('#agendaListView');

  if(!calendar||!list||!calendarBtn||!listBtn)return;

  const listMode=classAgendaView==='list';
  calendar.classList.toggle('hidden',listMode);
  list.classList.toggle('hidden',!listMode);
  calendarBtn.classList.toggle('active',!listMode);
  listBtn.classList.toggle('active',listMode);

  // Month navigation only matters in calendar mode.
  ['#agendaPrevMonth','#agendaToday','#agendaNextMonth']
    .forEach(sel=>$(sel)?.classList.toggle('hidden',listMode));
}

function renderClassAgenda(){
  const grid=$('#classCalendarGrid');
  const title=$('#agendaMonthTitle');
  const summary=$('#agendaMonthSummary');
  if(!grid||!title||!summary)return;

  const year=classAgendaMonth.getFullYear();
  const month=classAgendaMonth.getMonth();

  title.textContent=new Intl.DateTimeFormat(
    'pt-PT',
    {month:'long',year:'numeric'}
  ).format(classAgendaMonth).replace(/^./,c=>c.toUpperCase());

  // Monday-based 6-week grid.
  const first=new Date(year,month,1);
  const firstWeekday=(first.getDay()+6)%7; // Seg=0 ... Dom=6
  const gridStart=new Date(year,month,1-firstWeekday);

  const allUnfiltered=aggregateAgendaEvaluations(classEvaluationRows());
  renderAgendaFilterOptions(allUnfiltered);
  bindAgendaFilters();

  const all=filterAgendaGroups(allUnfiltered);

  const calendarEnd=new Date(gridStart);
  calendarEnd.setDate(calendarEnd.getDate()+41);

  const holidays=classAgendaHolidaysForRange(gridStart,calendarEnd);
  renderClassAgendaList(
    all,
    classAgendaHolidaysForRange(
      new Date(year,0,1),
      new Date(year+1,11,31)
    )
  );

  const byDate=new Map();
  all.forEach(ev=>{
    if(!byDate.has(ev.data))byDate.set(ev.data,[]);
    byDate.get(ev.data).push(ev);
  });

  const holidaysByDate=new Map();
  holidays.forEach(h=>{
    if(!holidaysByDate.has(h.data))holidaysByDate.set(h.data,[]);
    holidaysByDate.get(h.data).push(h);
  });

  const monthPrefix=`${year}-${String(month+1).padStart(2,'0')}-`;
  const monthItems=all.filter(ev=>String(ev.data||'').startsWith(monthPrefix));
  const monthHolidays=holidays.filter(h=>String(h.data||'').startsWith(monthPrefix));

  const rawCount=classEvaluationRows()
    .filter(ev=>String(ev.data||'').startsWith(monthPrefix))
    .length;

  const evalText=monthItems.length===rawCount
    ? `${rawCount} avaliação${rawCount===1?'':'ões'}`
    : `${monthItems.length} avaliação${monthItems.length===1?'':'ões'} · ${rawCount} registo${rawCount===1?'':'s'}`;

  const holidayText=`${monthHolidays.length} feriado${monthHolidays.length===1?'':'s'}`;
  summary.textContent=`${evalText} · ${holidayText}`;

  const todayIso=today();

  let html='';

  for(let i=0;i<42;i++){
    const d=new Date(gridStart);
    d.setDate(gridStart.getDate()+i);

    const iso=[
      d.getFullYear(),
      String(d.getMonth()+1).padStart(2,'0'),
      String(d.getDate()).padStart(2,'0')
    ].join('-');

    const isCurrent=d.getMonth()===month;
    const isToday=iso===todayIso;
    const isWeekend=d.getDay()===0||d.getDay()===6;
    const evaluations=(byDate.get(iso)||[])
      .sort((a,b)=>
        String(a.cadeira||'').localeCompare(String(b.cadeira||''),'pt',{sensitivity:'base'})
      );

    const holidayCards=(holidaysByDate.get(iso)||[]).map(h=>`
      <div class="agenda-holiday" title="${esc(h.nome)}">
        <b>${esc(h.nome)}</b>
        <span>Feriado nacional</span>
      </div>
    `).join('');

    const cards=evaluations.map(ev=>{
      const cls=agendaTypeClass(ev.tipo);
      const people=ev.people
        .sort((a,b)=>String(a.nome||'').localeCompare(String(b.nome||''),'pt'));

      const tooltip=people.map(p=>`${p.numero_corpo||'—'} · ${p.nome}`).join(' | ');
      const obs=ev.observacao?` · ${ev.observacao}`:'';

      const peopleHtml=people.map(p=>`
        <span class="agenda-evaluation-person">
          ${esc(p.numero_corpo||'—')} · ${esc(agendaShortName(p.nome))}
        </span>
      `).join('');

      return `
        <div class="agenda-evaluation agenda-evaluation-manage ${cls}"
             data-eval-key="${esc(encodeURIComponent(ev.key))}"
             title="${esc(`Abrir · ${ev.tipo} · ${ev.cadeira}${obs} · ${tooltip}`)}">
          <div class="agenda-evaluation-top">
            <b>${esc(ev.cadeira)}</b>
            <span>${esc(ev.tipo)}</span>
          </div>
          <div class="agenda-evaluation-people">
            ${peopleHtml}
          </div>
        </div>`;
    }).join('');

    html+=`
      <div class="class-calendar-day ${isCurrent?'':'outside'} ${isToday?'today':''} ${isWeekend?'weekend':''}">
        <div class="class-calendar-day-head">
          <span>${d.getDate()}</span>
          <div class="class-calendar-day-actions">
            ${isToday?'<em>Hoje</em>':''}
            <button type="button"
                    class="agenda-day-add"
                    data-date="${iso}"
                    title="Adicionar avaliação neste dia"
                    aria-label="Adicionar avaliação neste dia">+</button>
          </div>
        </div>
        <div class="class-calendar-events">
          ${holidayCards}
          ${cards}
        </div>
      </div>`;
  }

  grid.innerHTML=html;

  bindAgendaEvaluationManagement();

  $$('.agenda-day-add').forEach(btn=>{
    btn.onclick=e=>{
      e.stopPropagation();
      openAgendaEvaluationEditor(btn.dataset.date);
    };
  });

  $('#agendaAddEvaluation').onclick=()=>openAgendaEvaluationEditor();

  $('#agendaCalendarView').onclick=()=>{
    classAgendaView='calendar';
    syncAgendaView();
  };

  $('#agendaListView').onclick=()=>{
    classAgendaView='list';
    syncAgendaView();
  };

  syncAgendaView();

  $('#agendaPrevMonth').onclick=()=>{
    classAgendaMonth=new Date(year,month-1,1);
    renderClassAgenda();
  };

  $('#agendaNextMonth').onclick=()=>{
    classAgendaMonth=new Date(year,month+1,1);
    renderClassAgenda();
  };

  $('#agendaToday').onclick=()=>{
    const now=new Date();
    classAgendaMonth=new Date(now.getFullYear(),now.getMonth(),1);
    renderClassAgenda();
  };
}


function classScheduleGroupNumber(model){
  const name=String(model?.nome||'')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g,'')
    .replace(/º/g,'');

  const match=name.match(/6\s*ANO\s*TM[\s_-]*([1-4])\b/);
  return match?Number(match[1]):null;
}

function classSchedulePeopleByGroup(groupNumber){
  const modelIds=new Set(
    classScheduleModels()
      .filter(m=>classScheduleGroupNumber(m)===Number(groupNumber))
      .map(m=>m.id)
  );

  const personIds=new Set(
    S.scheduleModelPeople
      .filter(x=>modelIds.has(x.horario_modelo_id))
      .map(x=>x.pessoa_id)
  );

  return tmPeople().filter(p=>personIds.has(p.id));
}

function classPeopleWithSchedule(){
  const modelIds=new Set(classScheduleModels().map(m=>m.id));
  const personIds=new Set(
    S.scheduleModelPeople
      .filter(x=>modelIds.has(x.horario_modelo_id))
      .map(x=>x.pessoa_id)
  );
  return personIds;
}

function classScheduleModels(){
  return S.scheduleModels
    .filter(m=>{
      const name=String(m.nome||'')
        .toUpperCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g,'')
        .replace(/º/g,'')
        .replace(/\s+/g,' ');

      // Apanha 6ºANO TM_1 ... TM_4, tolerando espaços/hífens.
      return /6\s*ANO\s*TM[\s_-]*[1-4]\b/.test(name);
    })
    .sort((a,b)=>
      String(a.nome||'').localeCompare(
        String(b.nome||''),
        'pt',
        {numeric:true,sensitivity:'base'}
      )
    );
}

function renderClassSchedules(){
  const target=$('#classScheduleList');
  if(!target)return;

  const models=classScheduleModels();

  if(!models.length){
    target.innerHTML=`
      <div class="summary">
        Não foram encontrados horários com nomes
        <b>6.º ANO TM_1</b> até <b>6.º ANO TM_4</b>.
      </div>`;
    return;
  }

  if(classScheduleIndex<0)classScheduleIndex=models.length-1;
  if(classScheduleIndex>=models.length)classScheduleIndex=0;

  const m=models[classScheduleIndex];
  const blocks=scheduleBlocksForModel(m.id);
  const people=schedulePeopleForModel(m.id)
    .sort((a,b)=>{
      const an=Number(a.numero_corpo),bn=Number(b.numero_corpo);
      if(!Number.isNaN(an)&&!Number.isNaN(bn))return an-bn;
      return String(a.nome||'').localeCompare(String(b.nome||''),'pt');
    });

  const peopleHtml=people.length
    ? people.map(p=>`
        <span class="class-schedule-person">
          <b>${esc(p.numero_corpo||'—')}</b> · ${esc(p.nome)}
        </span>
      `).join('')
    : '<span class="muted">Sem pessoas associadas.</span>';

  target.innerHTML=`
    <div class="class-schedule-carousel">
      <div class="class-schedule-carousel-head">
        <button type="button" class="class-schedule-arrow" id="classSchedulePrev"
          title="Horário anterior" aria-label="Horário anterior">←</button>

        <div class="class-schedule-current">
          <small>Horário ${classScheduleIndex+1} de ${models.length}</small>
          <h3>${esc(m.nome)}</h3>
          <p>${fmt(m.data_inicio)} → ${fmt(m.data_fim)} · ${blocks.length} bloco(s)</p>
        </div>

        <button type="button" class="class-schedule-arrow" id="classScheduleNext"
          title="Próximo horário" aria-label="Próximo horário">→</button>
      </div>

      <div class="class-schedule-owners">
        <div class="class-schedule-owners-title">
          ${people.length===1?'Pertence a 1 pessoa':`Pertence a ${people.length} pessoas`}
        </div>
        <div class="class-schedule-people">${peopleHtml}</div>
      </div>

      <div class="weekly-grid-wrap class-inline-week-wrap">
        <div class="weekly-grid class-inline-week-grid">
          ${buildWeekGridHtml(blocks)}
        </div>
      </div>

      <div class="class-schedule-nav-bottom">
        <button type="button" class="secondary" id="classSchedulePrevBottom">← Anterior</button>
        <span>${classScheduleIndex+1} / ${models.length}</span>
        <button type="button" class="secondary" id="classScheduleNextBottom">Seguinte →</button>
      </div>
    </div>
  `;

  const previous=()=>{
    classScheduleIndex=(classScheduleIndex-1+models.length)%models.length;
    renderClassSchedules();
  };

  const next=()=>{
    classScheduleIndex=(classScheduleIndex+1)%models.length;
    renderClassSchedules();
  };

  $('#classSchedulePrev').onclick=previous;
  $('#classScheduleNext').onclick=next;
  $('#classSchedulePrevBottom').onclick=previous;
  $('#classScheduleNextBottom').onclick=next;
}


function classEvaluationConflicts(){
  const todayIso=today();
  const perPerson=new Map();

  classEvaluationRows()
    .filter(ev=>String(ev.data||'')>=todayIso)
    .forEach(ev=>{
      const pid=String(ev.pessoa_id);
      if(!perPerson.has(pid))perPerson.set(pid,new Map());

      const byDate=perPerson.get(pid);
      if(!byDate.has(ev.data))byDate.set(ev.data,[]);

      const identity=[
        String(ev.cadeira||'').trim().toLowerCase(),
        String(ev.tipo||'').trim().toLowerCase()
      ].join('|');

      if(!byDate.get(ev.data).some(x=>x.identity===identity)){
        byDate.get(ev.data).push({identity,ev});
      }
    });

  const conflicts=[];

  perPerson.forEach((dateMap,pid)=>{
    const person=S.people.find(p=>String(p.id)===pid);
    if(!person)return;

    const dates=[...dateMap.keys()].sort();

    dates.forEach(date=>{
      const items=dateMap.get(date)||[];
      if(items.length>=2){
        conflicts.push({
          person,
          kind:'same-day',
          date,
          items:items.map(x=>x.ev),
          sortDate:date
        });
      }
    });

    for(let i=0;i<dates.length-1;i++){
      const a=dates[i],b=dates[i+1];
      const diff=Math.round(
        (new Date(`${b}T12:00:00`)-new Date(`${a}T12:00:00`))/86400000
      );

      if(diff===1){
        conflicts.push({
          person,
          kind:'consecutive',
          date:a,
          nextDate:b,
          items:[
            ...dateMap.get(a).map(x=>x.ev),
            ...dateMap.get(b).map(x=>x.ev)
          ],
          sortDate:a
        });
      }
    }
  });

  return conflicts.sort((a,b)=>
    String(a.sortDate).localeCompare(String(b.sortDate)) ||
    String(a.person.nome||'').localeCompare(String(b.person.nome||''),'pt')
  );
}

function renderClassConflicts(){
  const target=$('#classConflictSummary');
  const count=$('#classConflictCount');
  if(!target||!count)return;

  const conflicts=classEvaluationConflicts();
  const peopleCount=new Set(conflicts.map(c=>String(c.person.id))).size;

  count.textContent=conflicts.length
    ? `${conflicts.length} alerta${conflicts.length===1?'':'s'}`
    : 'Sem alertas';

  if(!conflicts.length){
    target.innerHTML=`
      <div class="profile-empty conflict-clear">
        Não foram detetadas avaliações múltiplas no mesmo dia nem em dias consecutivos.
      </div>`;
    return;
  }

  const visible=conflicts.slice(0,8);

  target.innerHTML=`
    <div class="conflict-overview">
      <b>${peopleCount} pessoa${peopleCount===1?'':'s'} com possível sobrecarga</b>
      <span>São apenas alertas de planeamento; não impedem o registo das avaliações.</span>
    </div>

    <div class="conflict-list">
      ${visible.map(c=>{
        const labels=[...new Set(c.items.map(ev=>`${ev.cadeira} (${ev.tipo})`))];

        if(c.kind==='same-day'){
          return `
            <div class="conflict-row severe">
              <div class="conflict-icon">!</div>
              <div>
                <b>${esc(c.person.numero_corpo||'—')} · ${esc(c.person.nome)}</b>
                <span>${fmt(c.date)} · ${c.items.length} avaliações no mesmo dia</span>
                <small>${esc(labels.join(' · '))}</small>
              </div>
            </div>`;
        }

        return `
          <div class="conflict-row consecutive">
            <div class="conflict-icon">↔</div>
            <div>
              <b>${esc(c.person.numero_corpo||'—')} · ${esc(c.person.nome)}</b>
              <span>${fmt(c.date)} e ${fmt(c.nextDate)} · dias consecutivos</span>
              <small>${esc(labels.join(' · '))}</small>
            </div>
          </div>`;
      }).join('')}

      ${conflicts.length>visible.length
        ? `<div class="conflict-more">+ ${conflicts.length-visible.length} alerta(s)</div>`
        : ''}
    </div>`;
}

function renderClassModule(){
  const people=tmPeople();
  if(!$('#cTotal'))return;

  const todayIso=today();
  const end7=new Date(`${todayIso}T12:00:00`);
  end7.setDate(end7.getDate()+7);
  const end7Iso=[
    end7.getFullYear(),
    String(end7.getMonth()+1).padStart(2,'0'),
    String(end7.getDate()).padStart(2,'0')
  ].join('-');

  const uniqueEvaluations=aggregateAgendaEvaluations(classEvaluationRows())
    .sort((a,b)=>
      String(a.data||'').localeCompare(String(b.data||'')) ||
      String(a.cadeira||'').localeCompare(String(b.cadeira||''),'pt')
    );

  const upcoming=uniqueEvaluations.filter(ev=>String(ev.data||'')>=todayIso);
  const next7=upcoming.filter(ev=>String(ev.data||'')<=end7Iso);
  const next=upcoming[0]||null;

  const todayDate=new Date(`${todayIso}T12:00:00`);
  const end7Date=new Date(`${end7Iso}T12:00:00`);
  const holidays7=classAgendaHolidaysForRange(todayDate,end7Date);

  const scheduledIds=classPeopleWithSchedule();
  const noAce=people.filter(p=>!String(p.ace||'').trim());
  const noSchedule=people.filter(p=>!scheduledIds.has(p.id));

  $('#cTotal').textContent=people.length;
  $('#cEval7').textContent=next7.length;
  $('#cNoAce').textContent=noAce.length;
  $('#cNoSchedule').textContent=noSchedule.length;

  $('#cExe').textContent=people.filter(p=>p.ramo==='EXE').length;
  $('#cGnr').textContent=people.filter(p=>p.ramo==='GNR').length;
  $('#cTeam').textContent=people.filter(p=>p.integra_equipa!==false).length;
  $('#cExternal').textContent=people.filter(p=>p.integra_equipa===false).length;
  $('#cFunction').textContent=people.filter(p=>String(p.funcao||'').trim()).length;
  $('#cWithAce').textContent=people.filter(p=>String(p.ace||'').trim()).length;

  const nextBox=$('#classNextEvaluation');
  if(nextBox){
    if(next){
      const days=Math.round(
        (new Date(`${next.data}T12:00:00`)-new Date(`${todayIso}T12:00:00`)) /
        86400000
      );
      const when=days===0?'Hoje':days===1?'Amanhã':`Daqui a ${days} dias`;

      nextBox.innerHTML=`
        <div class="next-eval-date">
          <span>${when}</span>
          <strong>${fmt(next.data)}</strong>
        </div>
        <div class="next-eval-main">
          <span class="badge ${agendaTypeClass(next.tipo)}">${esc(next.tipo||'Avaliação')}</span>
          <h3>${esc(next.cadeira||'—')}</h3>
          <p>${next.observacao?esc(next.observacao):'Sem observação.'}</p>
        </div>
        <div class="next-eval-people">
          <b>${next.people.length} pessoa${next.people.length===1?'':'s'}</b>
          <span>${esc(agendaPeopleLabel(next.people))}</span>
        </div>`;
    }else{
      nextBox.innerHTML='<div class="profile-empty">Não existem avaliações futuras registadas.</div>';
    }
  }

  const weekBox=$('#classWeekAgenda');
  if(weekBox){
    const alertRows=[];

    const agendaRows=[
      ...next7.map(ev=>({
        kind:'evaluation',
        data:ev.data,
        value:ev
      })),
      ...holidays7.map(h=>({
        kind:'holiday',
        data:h.data,
        value:h
      }))
    ].sort((a,b)=>String(a.data).localeCompare(String(b.data)));

    agendaRows.slice(0,6).forEach(item=>{
      if(item.kind==='holiday'){
        const h=item.value;
        alertRows.push(`
          <div class="week-agenda-row holiday">
            <div>
              <b>${fmt(h.data)} · ${esc(h.nome)}</b>
              <small>Feriado nacional</small>
            </div>
            <span class="agenda-mini-dot feriado"></span>
          </div>`);
        return;
      }

      const ev=item.value;
      alertRows.push(`
        <div class="week-agenda-row">
          <div>
            <b>${fmt(ev.data)} · ${esc(ev.cadeira||'—')}</b>
            <small>${esc(ev.tipo||'Avaliação')} · ${ev.people.length} pessoa${ev.people.length===1?'':'s'}</small>
          </div>
          <span class="agenda-mini-dot ${agendaTypeClass(ev.tipo)}"></span>
        </div>`);
    });

    if(noSchedule.length){
      alertRows.push(`
        <div class="week-agenda-row warning">
          <div>
            <b>${noSchedule.length} sem horário associado</b>
            <small>${esc(noSchedule.slice(0,3).map(p=>agendaShortName(p.nome)).join(', '))}${noSchedule.length>3?'…':''}</small>
          </div>
          <span>!</span>
        </div>`);
    }

    if(noAce.length){
      alertRows.push(`
        <div class="week-agenda-row muted-row">
          <div>
            <b>${noAce.length} sem ACE</b>
            <small>Dados por completar.</small>
          </div>
        </div>`);
    }

    weekBox.innerHTML=alertRows.join('') ||
      '<div class="profile-empty">Sem alertas para os próximos 7 dias.</div>';
  }

  renderClassPeople();
  renderClassAgenda();
  renderClassConflicts();
  renderClassSchedules();
}

function renderClassPeople(){
  $$('#classPeopleTable [data-tfilter]').forEach(el=>{
    classFilters[el.dataset.tfilter]=String(el.value||'').trim().toLowerCase();
  });
  const q=String($('#classSearch')?.value||'').trim().toLowerCase();

  let rows=tmPeople().filter(p=>{
    const origin=p.integra_equipa===false?'externo':'equipa';
    if(q && ![p.numero_corpo,p.nome,p.posto,p.nim,p.ramo,p.ano]
      .some(v=>String(v||'').toLowerCase().includes(q))) return false;
    if(classFilters.numero_corpo && !String(p.numero_corpo||'').toLowerCase().includes(classFilters.numero_corpo))return false;
    if(classFilters.nome && !String(p.nome||'').toLowerCase().includes(classFilters.nome))return false;
    if(classFilters.posto && !String(p.posto||'').toLowerCase().includes(classFilters.posto))return false;
    if(classFilters.ano && String(p.ano||'')!==classFilters.ano)return false;
    if(classFilters.ramo && String(p.ramo||'').toLowerCase()!==classFilters.ramo)return false;
    if(classFilters.nim && !String(p.nim||'').toLowerCase().includes(classFilters.nim))return false;
    return true;
  });

  rows=[...rows].sort((a,b)=>{
    for(const sort of classSorts){
      let av,bv,cmp=0;
      av=a[sort.key]??'';
      bv=b[sort.key]??'';
      if(['ano','numero_corpo','nim'].includes(sort.key)){
        const an=Number(av),bn=Number(bv);
        if(!Number.isNaN(an)&&!Number.isNaN(bn))cmp=an-bn;
        else cmp=String(av).localeCompare(String(bv),'pt',{numeric:true,sensitivity:'base'});
      }else cmp=String(av).localeCompare(String(bv),'pt',{numeric:true,sensitivity:'base'});
      if(cmp!==0)return cmp*sort.dir;
    }
    return 0;
  });

  $('#classPeopleBody').innerHTML=rows.map(p=>`
    <tr class="class-person-row" data-profile="${p.id}" title="Abrir ficha individual">
      <td>${esc(p.numero_corpo||'—')}</td>
      <td><b>${esc(p.nome)}</b></td>
      <td>${esc(p.posto||'')}</td>
      <td>${p.ano||'—'}</td>
      <td>${esc(p.ramo||'—')}</td>
      <td>${esc(p.nim||'—')}</td>
    </tr>`).join('') || '<tr><td colspan="6" class="muted">Sem resultados.</td></tr>';

  $$('.class-person-row').forEach(row=>{
    row.onclick=()=>openProfile(row.dataset.profile,true);
  });

  multiSortIndicator($$('.class-sort-head'),classSorts,'tsort');
}

function eventAutoStatus(e){
  if(e.estado_manual) return e.estado_manual;

  const now=new Date();

  // Supabase pode devolver TIME como HH:MM:SS.
  // Não acrescentar ':00' cegamente, senão 16:00:00 virava 16:00:00:00.
  const normalizeTime=t=>{
    const s=String(t||'00:00').trim();
    if(/^\d{2}:\d{2}$/.test(s)) return `${s}:00`;
    if(/^\d{2}:\d{2}:\d{2}/.test(s)) return s.slice(0,8);
    return '00:00:00';
  };

  const start=new Date(`${e.data}T${normalizeTime(e.hora_inicio)}`);

  let end;
  if(e.hora_fim){
    end=new Date(`${e.data}T${normalizeTime(e.hora_fim)}`);
  }else{
    end=new Date(start.getTime()+60*60*1000);
  }

  // Salvaguarda: se algum dado vier inválido, não marcar como finalizado por engano.
  if(Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())){
    return 'AGENDADO';
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
  const rows=[...S.events].sort((a,b)=>{
    for(const sort of eventSorts){
      let av='',bv='',cmp=0;

      if(sort.key==='data'){
        av=a.data||'';bv=b.data||'';
      }else if(sort.key==='hora'){
        av=a.hora_inicio||'';bv=b.hora_inicio||'';
      }else if(sort.key==='nome'){
        av=a.nome||'';bv=b.nome||'';
      }else if(sort.key==='estado'){
        av=eventAutoStatus(a);bv=eventAutoStatus(b);
      }else if(sort.key==='empenhados'){
        cmp=S.assigned.filter(x=>x.evento_id===a.id).length-
            S.assigned.filter(x=>x.evento_id===b.id).length;

        if(cmp!==0)return cmp*sort.dir;
        continue;
      }

      cmp=String(av).localeCompare(String(bv),'pt',{numeric:true,sensitivity:'base'});
      if(cmp!==0)return cmp*sort.dir;
    }

    return 0;
  });

  $('#eventsBody').innerHTML=rows.map(e=>`
    <tr>
      <td>${fmt(e.data)}</td>
      <td>${e.hora_inicio?.slice(0,5)||''}${e.hora_fim?'–'+e.hora_fim.slice(0,5):''}</td>
      <td>
        <b>${esc(e.nome)}</b>
        <br><small class="muted">${
          e.alvo_tipo==='CURSOS'
            ? S.eventCourseTargets
                .filter(x=>x.evento_id===e.id)
                .map(x=>`${x.ramo} · ${x.curso}`)
                .join(', ')
            : e.alvo_tipo==='ANO'
              ? `${e.alvo_ano||'—'}º ano`
              : 'Toda a equipa'
        }</small>
      </td>
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

  multiSortIndicator($$('.event-sort-head'),eventSorts,'esort');
}

function renderHistory(){
  const rows=[...S.history].sort((a,b)=>{
    for(const sort of historySorts){
      let av='',bv='',cmp=0;

      if(sort.key==='data'){
        av=a.alterado_em||'';bv=b.alterado_em||'';
      }else if(sort.key==='tabela'){
        av=a.tabela||'';bv=b.tabela||'';
      }else if(sort.key==='acao'){
        av=a.acao||'';bv=b.acao||'';
      }else if(sort.key==='registo'){
        av=a.registo_id||'';bv=b.registo_id||'';
      }

      cmp=String(av).localeCompare(String(bv),'pt',{numeric:true,sensitivity:'base'});
      if(cmp!==0)return cmp*sort.dir;
    }

    return 0;
  });

  $('#historyBody').innerHTML=rows.map(h=>`
    <tr>
      <td>${new Date(h.alterado_em).toLocaleString('pt-PT')}</td>
      <td>${esc(h.tabela)}</td>
      <td>${esc(h.acao)}</td>
      <td>${esc(h.registo_id||'')}</td>
    </tr>
  `).join('');

  multiSortIndicator($$('.history-sort-head'),historySorts,'hsort');
}


function subjectsForPerson(personId){
  const modelIds=new Set(
    S.scheduleModelPeople
      .filter(x=>x.pessoa_id===personId)
      .map(x=>x.horario_modelo_id)
  );

  const legacyIds=new Set(
    S.schedulePeople
      .filter(x=>x.pessoa_id===personId)
      .map(x=>x.horario_id)
  );

  const subjects=new Set();

  S.schedules.forEach(h=>{
    const belongsToModel=h.horario_modelo_id && modelIds.has(h.horario_modelo_id);
    const belongsLegacy=!h.horario_modelo_id && legacyIds.has(h.id);

    if(belongsToModel || belongsLegacy){
      const subject=String(h.disciplina||h.nome||'').trim();
      if(subject)subjects.add(subject);
    }
  });

  return [...subjects].sort((a,b)=>a.localeCompare(b,'pt',{sensitivity:'base'}));
}

function personEvaluations(personId){
  return S.evaluations
    .filter(x=>x.pessoa_id===personId)
    .sort((a,b)=>{
      const ad=String(a.data||'');
      const bd=String(b.data||'');
      if(ad!==bd)return ad.localeCompare(bd);
      return String(a.cadeira||'').localeCompare(String(b.cadeira||''),'pt');
    });
}

async function refreshEvaluations(){
  S.evaluations=await selOptional('avaliacoes_turma');
}

function openAceEditor(personId){
  const p=S.people.find(x=>x.id===personId);
  if(!p)return;

  modal(
    'ACE',
    `<label>ACE em que está inscrito
      <input name="ace" value="${esc(p.ace||'')}" placeholder="Ex.: Natação, Futebol, Judo...">
    </label>
    <small class="muted">Deixa vazio se não estiver inscrito em nenhuma ACE.</small>`,
    async f=>{
      const ace=String(f.get('ace')||'').trim()||null;
      const {error}=await supabase.from('pessoas').update({ace}).eq('id',personId);

      if(error)return toast(error.message);

      p.ace=ace;
      closeModal();
      toast('ACE atualizada');
      await openProfile(personId,true);
    }
  );
}

function openEvaluationEditor(personId,evaluation=null){
  const subjects=subjectsForPerson(personId);
  const subjectOptions=subjects
    .map(s=>`<option value="${esc(s)}"></option>`)
    .join('');

  modal(
    evaluation?'Editar avaliação':'Nova avaliação',
    `<div class="grid2">
      <label class="full">Cadeira
        <input
          name="cadeira"
          list="evaluationSubjects"
          required
          value="${esc(evaluation?.cadeira||'')}"
          placeholder="Escolhe ou escreve a cadeira">
        <datalist id="evaluationSubjects">${subjectOptions}</datalist>
      </label>

      <label>Tipo
        <select name="tipo">
          <option value="Teste" ${evaluation?.tipo==='Teste'?'selected':''}>Teste</option>
          <option value="Exame" ${evaluation?.tipo==='Exame'?'selected':''}>Exame</option>
          <option value="Trabalho" ${evaluation?.tipo==='Trabalho'?'selected':''}>Trabalho</option>
          <option value="Apresentação" ${evaluation?.tipo==='Apresentação'?'selected':''}>Apresentação</option>
          <option value="Outro" ${evaluation?.tipo==='Outro'?'selected':''}>Outro</option>
        </select>
      </label>

      <label>Data
        <input name="data" type="date" required value="${evaluation?.data||''}">
      </label>

      <label class="full">Observação
        <input name="observacao" value="${esc(evaluation?.observacao||'')}" placeholder="Opcional">
      </label>
    </div>`,
    async f=>{
      const payload={
        pessoa_id:personId,
        cadeira:String(f.get('cadeira')||'').trim(),
        tipo:String(f.get('tipo')||'Teste'),
        data:f.get('data'),
        observacao:String(f.get('observacao')||'').trim()||null
      };

      const query=evaluation
        ? supabase.from('avaliacoes_turma').update(payload).eq('id',evaluation.id)
        : supabase.from('avaliacoes_turma').insert(payload);

      const {error}=await query;
      if(error)return toast(error.message);

      closeModal();
      await refreshEvaluations();
      toast(evaluation?'Avaliação atualizada':'Avaliação adicionada');
      await openProfile(personId,true);
    }
  );
}

async function deleteEvaluation(personId,evaluationId){
  if(!confirm('Apagar esta avaliação?'))return;

  const {error}=await supabase
    .from('avaliacoes_turma')
    .delete()
    .eq('id',evaluationId);

  if(error)return toast(error.message);

  await refreshEvaluations();
  toast('Avaliação apagada');
  await openProfile(personId,true);
}

async function openProfile(personId,turmaMode=false){
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

  const turmaSubjects=turmaMode?subjectsForPerson(personId):[];
  const turmaEvaluations=turmaMode?personEvaluations(personId):[];

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
          ${turmaMode?'':`
          <div class="profile-list-item"><span>Origem</span><b>${p.integra_equipa===false?'Pessoa externa':'Equipa'}</b></div>
          <div class="profile-list-item"><span>Função</span><b>${esc(p.funcao||'—')}</b></div>
          `}
          <div class="profile-list-item"><span>NIM</span><b>${esc(p.nim||'—')}</b></div>
          <div class="profile-list-item"><span>Localidade</span><b>${esc(p.localidade||'Por preencher')}</b></div>
          <div class="profile-list-item"><span>Sexo</span><b>${esc(sexLabel)}</b></div>
          <div class="profile-list-item"><span>Curso</span><b>${esc(p.ramo)} · ${esc(p.curso)}</b></div>
          <div class="profile-list-item"><span>Ano</span><b>${p.ano?`${p.ano}º`:'—'}</b></div>
          <div class="profile-list-item"><span>Posto</span><b>${esc(p.posto||'—')}</b></div>
        </div>
      </div>

      ${turmaMode?`
      <div class="profile-section turma-academic-card">
        <div class="profile-section-head">
          <h4>Cadeiras</h4>
          <span class="badge gray">${turmaSubjects.length}</span>
        </div>
        ${
          turmaSubjects.length
          ? `<div class="subject-tags">${turmaSubjects.map(s=>`<span class="subject-tag">${esc(s)}</span>`).join('')}</div>`
          : '<div class="profile-empty">Sem cadeiras encontradas no horário associado.</div>'
        }
      </div>

      <div class="profile-section turma-academic-card">
        <div class="profile-section-head">
          <h4>ACE</h4>
          <button type="button" class="secondary tiny-btn" id="profileAceEditBtn">Editar</button>
        </div>
        <div class="ace-profile-value">${p.ace?esc(p.ace):'<span class="muted">Sem ACE registada.</span>'}</div>
      </div>

      <div class="profile-section full turma-academic-card">
        <div class="profile-section-head">
          <div>
            <h4>Avaliações</h4>
            <small class="muted">Datas de testes, exames, trabalhos e outras avaliações.</small>
          </div>
          <button type="button" class="primary tiny-btn" id="profileAddEvaluationBtn">+ Avaliação</button>
        </div>

        ${
          turmaEvaluations.length
          ? `<div class="evaluation-list">${turmaEvaluations.map(ev=>`
              <div class="evaluation-row ${String(ev.data)>=today()?'upcoming':'past'}">
                <div class="evaluation-date">
                  <strong>${fmt(ev.data)}</strong>
                  <span>${esc(ev.tipo||'Avaliação')}</span>
                </div>
                <div class="evaluation-main">
                  <b>${esc(ev.cadeira||'—')}</b>
                  ${ev.observacao?`<small>${esc(ev.observacao)}</small>`:''}
                </div>
                <div class="evaluation-actions">
                  <button type="button" class="icon profile-eval-edit" data-id="${ev.id}" title="Editar">✎</button>
                  <button type="button" class="icon profile-eval-delete" data-id="${ev.id}" title="Apagar">🗑</button>
                </div>
              </div>
            `).join('')}</div>`
          : '<div class="profile-empty">Sem avaliações registadas.</div>'
        }
      </div>
      `:''}

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

  if(turmaMode){
    $('#profileAceEditBtn').onclick=()=>openAceEditor(personId);
    $('#profileAddEvaluationBtn').onclick=()=>openEvaluationEditor(personId);

    $$('.profile-eval-edit').forEach(btn=>{
      btn.onclick=()=>{
        const ev=S.evaluations.find(x=>String(x.id)===String(btn.dataset.id));
        if(ev)openEvaluationEditor(personId,ev);
      };
    });

    $$('.profile-eval-delete').forEach(btn=>{
      btn.onclick=()=>deleteEvaluation(personId,btn.dataset.id);
    });
  }

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
    ['#','Ano','Posto','Nº Corpo','Nome','NIM','Ramo','Curso']
  ];

  people.forEach(p=>{
    rows.push([
      index+1,
      p.ano||'',
      p.posto||'',
      p.numero_corpo||'',
      p.nome||'',
      p.nim||'',
      p.ramo||'',
      p.curso||''
    ]);
  });

  const csv=rows.map(r=>r.map(csvEscape).join(';')).join('\r\n');
  const filename=`${safeFileName(e.nome)}_${e.data}_empenhados.csv`;
  downloadText(filename,csv,'text/csv;charset=utf-8');
  toast(`CSV exportado: ${people.length} empenhado(s).`);
}

let pendingPdfEventId=null;

function comparePdfValue(a,b,key){
  if(['ano','numero_corpo','nim'].includes(key)){
    const an=Number(a?.[key]);
    const bn=Number(b?.[key]);
    if(!Number.isNaN(an)&&!Number.isNaN(bn)){
      if(an<bn)return -1;
      if(an>bn)return 1;
      return 0;
    }
  }
  return String(a?.[key]??'').localeCompare(
    String(b?.[key]??''),
    'pt',
    {numeric:true,sensitivity:'base'}
  );
}

function sortPdfPeople(people,criteria){
  return [...people].sort((a,b)=>{
    for(const c of criteria){
      if(!c.key)continue;
      const cmp=comparePdfValue(a,b,c.key);
      if(cmp!==0)return c.dir==='desc'?-cmp:cmp;
    }
    return 0;
  });
}

function exportEventPdf(eventId){
  pendingPdfEventId=eventId;

  // Valor inicial sugerido.
  $('#pdfSort1').value='ano';
  $('#pdfSort1Dir').value='asc';
  $('#pdfSort2').value='curso';
  $('#pdfSort2Dir').value='asc';
  $('#pdfSort3').value='numero_corpo';
  $('#pdfSort3Dir').value='asc';

  $('#pdfSortDialog').showModal();
}

function generateEventPdfWithSort(eventId,criteria){
  const e=S.events.find(x=>x.id===eventId);
  if(!e)return toast('Evento não encontrado.');

  const people=sortPdfPeople(eventAssignedPeople(eventId),criteria);

  const rows=people.length
    ? people.map((p,i)=>`
      <tr>
        <td>${i+1}</td>
        <td>${esc(p.ano||'')}</td>
        <td>${esc(p.posto||'')}</td>
        <td>${esc(p.numero_corpo||'')}</td>
        <td>${esc(p.nome||'')}</td>
        <td>${esc(p.nim||'')}</td>
        <td>${esc(p.ramo||'')}</td>
        <td>${esc(p.curso||'')}</td>
      </tr>`).join('')
    : '<tr><td colspan="8">Sem pessoas empenhadas.</td></tr>';

  const labels={
    numero_corpo:'Nº Corpo',
    ano:'Ano',
    posto:'Posto',
    nome:'Nome',
    nim:'NIM',
    ramo:'Ramo',
    curso:'Curso'
  };

  const sortText=criteria
    .filter(c=>c.key)
    .map((c,i)=>`${i+1}. ${labels[c.key]} (${c.dir==='desc'?'desc.':'asc.'})`)
    .join(' · ');

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
  .meta{margin-bottom:8px;color:#444}
  .meta span{margin-right:18px}
  .sort-info{margin-bottom:20px;color:#666;font-size:11px}
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

  <div class="sort-info"><b>Ordenação:</b> ${esc(sortText)}</div>

  <table>
    <thead>
      <tr><th>#</th><th>Ano</th><th>Posto</th><th>Nº Corpo</th><th>Nome</th><th>NIM</th><th>Ramo</th><th>Curso</th></tr>
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


async function renderHome(){
  const d=today();

  const active=S.people.filter(
    p=>p.ativo!==false && p.integra_equipa!==false
  );

  const externalWithFunction=S.people.filter(
    p=>p.ativo!==false &&
       p.integra_equipa===false &&
       Boolean(String(p.funcao||'').trim())
  );

  $('#sPeople').textContent=active.length;
  $('#sYear5').textContent=active.filter(p=>Number(p.ano)===5).length;
  $('#sYear6').textContent=active.filter(p=>Number(p.ano)===6).length;

  const weekEnd=new Date(`${d}T12:00:00`);
  weekEnd.setDate(weekEnd.getDate()+7);
  const weekEndIso=[
    weekEnd.getFullYear(),
    String(weekEnd.getMonth()+1).padStart(2,'0'),
    String(weekEnd.getDate()).padStart(2,'0')
  ].join('-');

  const tomorrowDate=new Date(`${d}T12:00:00`);
  tomorrowDate.setDate(tomorrowDate.getDate()+1);
  const tomorrowIso=[
    tomorrowDate.getFullYear(),
    String(tomorrowDate.getMonth()+1).padStart(2,'0'),
    String(tomorrowDate.getDate()).padStart(2,'0')
  ].join('-');

  const nextWeekEvents=S.events.filter(
    e=>e.data>=d &&
       e.data<=weekEndIso &&
       !eventIsCancelled(e)
  );

  $('#sEvents').textContent=nextWeekEvents.length;

  // Disponibilidade operacional dos cartões principais.
  const teamIds=new Set(active.map(p=>String(p.id)));

  const countUnavailable=rows=>rows.filter(r=>{
    const rid=String(r.pessoa_id||'');
    const belongs=rid
      ? teamIds.has(rid)
      : active.some(p=>String(p.numero_corpo||'')===String(r.numero_corpo||''));

    return belongs && r.estado==='INDISPONIVEL';
  }).length;

  $('#sUnavailableToday').textContent='…';
  $('#sUnavailableTomorrow').textContent='…';

  try{
    const [todayRows,tomorrowRows]=await Promise.all([
      checkAvailability(d),
      checkAvailability(tomorrowIso)
    ]);

    $('#sUnavailableToday').textContent=countUnavailable(todayRows);
    $('#sUnavailableTomorrow').textContent=countUnavailable(tomorrowRows);
  }catch{
    $('#sUnavailableToday').textContent='—';
    $('#sUnavailableTomorrow').textContent='—';
  }

  const engineeringCourses=new Set(['TM','MAT','SMAT','ENG']);

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

  // Pessoas por curso.
  const grouped=new Map();

  const ensureGroup=p=>{
    const ramo=String(p.ramo||'').trim();
    const curso=String(p.curso||'').trim();

    if(!ramo || !curso) return null;

    const key=`${ramo} · ${curso}`;

    if(!grouped.has(key)){
      grouped.set(key,{
        label:key,
        team:0,
        functional:0
      });
    }

    return grouped.get(key);
  };

  active.forEach(p=>{
    const g=ensureGroup(p);
    if(g)g.team++;
  });

  externalWithFunction.forEach(p=>{
    const g=ensureGroup(p);
    if(g)g.functional++;
  });

  const groups=[...grouped.values()]
    .map(g=>({...g,total:g.team+g.functional}))
    .sort((a,b)=>
      b.total-a.total ||
      b.team-a.team ||
      a.label.localeCompare(b.label,'pt')
    );

  const max=Math.max(1,...groups.map(g=>g.total));

  $('#courseStats').innerHTML=groups.map(g=>{
    const teamWidth=(g.team/max)*100;
    const functionWidth=(g.functional/max)*100;

    const counts=g.functional>0
      ? `<div class="metric-counts">
          <span class="metric-count-team" title="Equipa">${g.team}</span>
          <span class="metric-count-function" title="Pessoal externo/com função">${g.functional}</span>
          <span class="metric-count-total" title="Total">${g.total}</span>
        </div>`
      : `<div class="metric-counts only-total">
          <span class="metric-count-total" title="Total">${g.total}</span>
        </div>`;

    return `
      <div class="metric-row">
        <div class="metric-label">${esc(g.label)}</div>
        <div class="metric-bar stacked"
             title="Equipa: ${g.team} · Pessoal com função: ${g.functional} · Total: ${g.total}">
          <span class="metric-team" style="width:${teamWidth}%"></span>
          <span class="metric-function" style="width:${functionWidth}%"></span>
        </div>
        ${counts}
      </div>
    `;
  }).join('') || '<div class="summary">Sem dados.</div>';

  const future=[...nextWeekEvents]
    .sort((a,b)=>
      String(a.data+a.hora_inicio).localeCompare(
        String(b.data+b.hora_inicio)
      )
    );

  // Próximo evento destacado.
  const nextEvent=future[0]||null;
  const nextBox=$('#homeNextEvent');

  if(nextBox){
    if(nextEvent){
      const assigned=S.assigned.filter(a=>a.evento_id===nextEvent.id).length;
      nextBox.innerHTML=`
        <div class="team-next-event-date">
          <span>${fmt(nextEvent.data)}</span>
          <strong>${nextEvent.hora_inicio?.slice(0,5)||'—'}</strong>
        </div>
        <div class="team-next-event-main">
          <span>${eventStatusBadge(nextEvent)}</span>
          <h3>${esc(nextEvent.nome)}</h3>
          <p>${nextEvent.observacoes?esc(nextEvent.observacoes):'Sem observações.'}</p>
        </div>
        <div class="team-next-event-meta">
          <b>${assigned}</b>
          <span>empenhado${assigned===1?'':'s'}</span>
          <button id="homeOpenNextEventBtn" type="button" class="secondary">Abrir evento</button>
        </div>
      `;

      $('#homeOpenNextEventBtn').onclick=()=>openEventWizard(nextEvent);
    }else{
      nextBox.innerHTML='<div class="profile-empty">Sem eventos nos próximos 7 dias.</div>';
    }
  }

  // Alertas operacionais.
  const currentFutureConstraints=S.constraints.filter(c=>!isPastConstraint(c));
  const pending=currentFutureConstraints.filter(c=>c.estado==='POR_CONFIRMAR');
  const conditioned=currentFutureConstraints.filter(c=>c.estado==='CONDICIONADO');

  const startingSoon=currentFutureConstraints.filter(c=>
    c.estado!=='NAO_ACEITE' &&
    String(c.data_inicio||'')>=d &&
    String(c.data_inicio||'')<=weekEndIso
  );

  const noAssignedEvents=future.filter(
    e=>S.assigned.filter(a=>a.evento_id===e.id).length===0
  );

  const scheduledPeople=new Set([
    ...S.schedulePeople.map(x=>String(x.pessoa_id)),
    ...S.scheduleModelPeople.map(x=>String(x.pessoa_id))
  ]);

  const withoutSchedule=active.filter(
    p=>!scheduledPeople.has(String(p.id))
  );

  const alerts=[];

  if(pending.length){
    alerts.push({
      cls:'amber',
      title:`${pending.length} constrangimento${pending.length===1?'':'s'} por confirmar`,
      text:'Existem situações que ainda precisam de decisão.'
    });
  }

  if(conditioned.length){
    alerts.push({
      cls:'blue',
      title:`${conditioned.length} situação${conditioned.length===1?'':'ões'} condicionada${conditioned.length===1?'':'s'}`,
      text:'Estão registadas, mas não dispensam das atividades.'
    });
  }

  if(startingSoon.length){
    alerts.push({
      cls:'gray',
      title:`${startingSoon.length} constrangimento${startingSoon.length===1?'':'s'} começa${startingSoon.length===1?'':'m'} nos próximos 7 dias`,
      text:'Convém ter estas datas presentes no planeamento.'
    });
  }

  if(noAssignedEvents.length){
    alerts.push({
      cls:'red',
      title:`${noAssignedEvents.length} evento${noAssignedEvents.length===1?'':'s'} sem empenhados`,
      text:'Há eventos próximos ainda sem pessoas associadas.'
    });
  }

  if(withoutSchedule.length){
    alerts.push({
      cls:'gray',
      title:`${withoutSchedule.length} pessoa${withoutSchedule.length===1?'':'s'} sem horário associado`,
      text:withoutSchedule.slice(0,3).map(p=>p.nome).join(', ')+(withoutSchedule.length>3?'…':'')
    });
  }

  $('#homeTeamAlerts').innerHTML=alerts.length
    ? alerts.slice(0,6).map(a=>`
        <div class="team-alert-row">
          <span class="team-alert-dot ${a.cls}"></span>
          <div>
            <b>${esc(a.title)}</b>
            <small>${esc(a.text)}</small>
          </div>
        </div>
      `).join('')
    : '<div class="profile-empty">Sem alertas operacionais neste momento.</div>';

  $('#homeEvents').innerHTML=future.map(e=>`
    <tr>
      <td>${fmt(e.data)}</td>
      <td>${e.hora_inicio?.slice(0,5)||''}</td>
      <td>${esc(e.nome)}</td>
      <td>${S.assigned.filter(a=>a.evento_id===e.id).length}</td>
    </tr>
  `).join('') || '<tr><td colspan="4" class="muted">Sem eventos nos próximos 7 dias.</td></tr>';

  // Ações rápidas.
  if($('#homeNewEventBtn'))$('#homeNewEventBtn').onclick=()=>openEventWizard();
  if($('#homeNewConstraintBtn'))$('#homeNewConstraintBtn').onclick=()=>openConstraint();
  if($('#homeCheckAvailBtn'))$('#homeCheckAvailBtn').onclick=()=>{
    page('consulta');
    $('#availDate').value=today();
    renderAvailability();
  };
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
      !matchesCourseFilter(r.curso,availColumnFilters.curso)) return false;

    if(availColumnFilters.estado &&
      String(r.estado||'').toLowerCase()!==availColumnFilters.estado) return false;

    if(availColumnFilters.motivo &&
      !String(r.motivo||'').toLowerCase().includes(availColumnFilters.motivo)) return false;

    if(availColumnFilters.alerta==='sim' && !r.tem_alerta_aula) return false;
    if(availColumnFilters.alerta==='nao' && r.tem_alerta_aula) return false;

    return true;
  });

  rows=[...rows].sort((a,b)=>{
    for(const sort of availSorts){
      let av=a[sort.key], bv=b[sort.key];

      if(sort.key==='detalhe_aula'){
        av=a.tem_alerta_aula ? (a.detalhe_aula||'Aula') : '';
        bv=b.tem_alerta_aula ? (b.detalhe_aula||'Aula') : '';
      }

      let cmp=0;

      if(sort.key==='ano'){
        cmp=(Number(av)||0)-(Number(bv)||0);
      }else if(sort.key==='numero_corpo'){
        const an=Number(av),bn=Number(bv);
        if(!Number.isNaN(an)&&!Number.isNaN(bn)){
          cmp=an-bn;
        }else{
          cmp=String(av??'').localeCompare(
            String(bv??''),
            'pt',
            {numeric:true,sensitivity:'base'}
          );
        }
      }else{
        cmp=String(av??'').localeCompare(
          String(bv??''),
          'pt',
          {numeric:true,sensitivity:'base'}
        );
      }

      if(cmp!==0) return cmp*sort.dir;
    }

    return 0;
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
    const index=availSorts.findIndex(s=>s.key===btn.dataset.sort);
    const active=index!==-1;
    btn.classList.toggle('active',active);

    const span=btn.querySelector('span');

    if(active){
      const sort=availSorts[index];
      span.textContent=`${sort.dir===1?'↑':'↓'}${index+1}`;
      btn.title=`${index+1}.º critério de ordenação`;
    }else{
      span.textContent='↕';
      btn.title='Adicionar como critério principal';
    }
  });
}
function renderPeople(){
  $$('#peopleTable [data-pfilter]').forEach(el=>{
    peopleFilters[el.dataset.pfilter]=String(el.value||'').trim().toLowerCase();
  });

  let rows=S.people
    .filter(p=>p.integra_equipa!==false)
    .filter(p=>{
      // Grupo rápido
      if(peopleGroupPreset==='ENGENHEIROS'){
        if(!isEngineeringCourse(p.curso)) return false;
      }else if(peopleGroupPreset){
        if(String(p.curso||'').toUpperCase()!==peopleGroupPreset) return false;
      }

      if(peopleFilters.numero_corpo &&
        !String(p.numero_corpo||'').toLowerCase().includes(peopleFilters.numero_corpo)) return false;

      if(peopleFilters.nome &&
        !String(p.nome||'').toLowerCase().includes(peopleFilters.nome)) return false;

      if(peopleFilters.posto &&
        !String(p.posto||'').toLowerCase().includes(peopleFilters.posto)) return false;

      if(peopleFilters.ano &&
        !String(p.ano||'').toLowerCase().includes(peopleFilters.ano)) return false;

      if(peopleFilters.ramo &&
        String(p.ramo||'').toLowerCase()!==peopleFilters.ramo) return false;

      // Curso: aceita vários valores separados por ; ou ,
      // Ex.: TM;ENG;SMAT
      if(peopleFilters.curso){
        if(!matchesCourseFilter(p.curso,peopleFilters.curso)) return false;
      }

      if(peopleFilters.idade &&
        !String(p.idade||'').toLowerCase().includes(peopleFilters.idade)) return false;

      if(peopleFilters.localidade &&
        !String(p.localidade||'').toLowerCase().includes(peopleFilters.localidade)) return false;

      return true;
    });

  rows=[...rows].sort((a,b)=>{
    for(const sort of peopleSorts){
      const key=sort.key;

      if(key==='numero_corpo'){
        const an=Number(a.numero_corpo),bn=Number(b.numero_corpo);
        if(!Number.isNaN(an)&&!Number.isNaN(bn)){
          const cmp=an-bn;
          if(cmp!==0)return cmp*sort.dir;
          continue;
        }
      }

      if(['ano','idade'].includes(key)){
        const cmp=(Number(a[key])||0)-(Number(b[key])||0);
        if(cmp!==0)return cmp*sort.dir;
        continue;
      }

      const cmp=String(a[key]??'').localeCompare(
        String(b[key]??''),
        'pt',
        {numeric:true,sensitivity:'base'}
      );

      if(cmp!==0)return cmp*sort.dir;
    }

    return 0;
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

  multiSortIndicator($$('#peopleTable .sort-head'),peopleSorts,'psort');
}

function renderExternalPeople(){
  const rows=S.people
    .filter(p=>p.integra_equipa===false)
    .sort((a,b)=>{
      for(const sort of externalSorts){
        if(sort.key==='numero_corpo'){
          const an=Number(a.numero_corpo),bn=Number(b.numero_corpo);
          if(!Number.isNaN(an)&&!Number.isNaN(bn)){
            const cmp=an-bn;
            if(cmp!==0)return cmp*sort.dir;
            continue;
          }
        }

        const cmp=String(a[sort.key]??'').localeCompare(
          String(b[sort.key]??''),
          'pt',
          {numeric:true,sensitivity:'base'}
        );

        if(cmp!==0)return cmp*sort.dir;
      }

      return 0;
    });

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

  multiSortIndicator($$('.external-sort-head'),externalSorts,'xsort');
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

      <label>NIM
        <input
          name="nim"
          inputmode="numeric"
          placeholder="NIM"
          value="${esc(p?.nim||'')}">
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
        nim:f.get('nim')||null,
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
    CONDICIONADO:['blue','Condicionado'],
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
    for(const sort of constraintSorts){
      let av,bv;

      if(sort.key==='pessoa'){av=pName(a.pessoa_id);bv=pName(b.pessoa_id);}
      else if(sort.key==='inicio'){av=constraintTimestamp(a,'start');bv=constraintTimestamp(b,'start');}
      else if(sort.key==='fim'){av=constraintTimestamp(a,'end');bv=constraintTimestamp(b,'end');}
      else {av=a[sort.key]??'';bv=b[sort.key]??'';}

      const cmp=String(av).localeCompare(String(bv),'pt',{numeric:true,sensitivity:'base'});
      if(cmp!==0)return cmp*sort.dir;
    }
    return 0;
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

  multiSortIndicator(
    [...$$('#constraintsTable .sort-head'),...$$('#pastConstraintsTable .sort-head')],
    constraintSorts,
    'csort'
  );

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
          <option value="CONDICIONADO" ${currentState==='CONDICIONADO'?'selected':''}>Condicionado</option>
          <option value="ACEITE" ${currentState==='ACEITE'?'selected':''}>Aceite</option>
          <option value="NAO_ACEITE" ${currentState==='NAO_ACEITE'?'selected':''}>Não aceite</option>
        </select>
      </label>

      <div class="full constraint-state-help">
        <b>Condicionado</b>
        <span>Regista a situação, mas a pessoa continua disponível para atividades. Serve como aviso, não como dispensa.</span>
      </div>

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

function buildWeekGridHtml(blocks){
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

  return html;
}

function renderViewerWeekGrid(blocks){
  $('#scheduleViewerGrid').innerHTML=buildWeekGridHtml(blocks);
}

function renderScheduleViewerBlocks(){
  const rows=[...currentScheduleViewerBlocks].sort((a,b)=>{
    for(const sort of scheduleBlockSorts){
      let av='',bv='',cmp=0;

      if(sort.key==='dia'){
        cmp=(Number(a.dia_semana)||0)-(Number(b.dia_semana)||0);
        if(cmp!==0)return cmp*sort.dir;
        continue;
      }

      if(sort.key==='inicio'){
        av=a.hora_inicio||'';bv=b.hora_inicio||'';
      }else if(sort.key==='fim'){
        av=a.hora_fim||'';bv=b.hora_fim||'';
      }else if(sort.key==='disciplina'){
        av=a.disciplina||a.nome||'';bv=b.disciplina||b.nome||'';
      }else if(sort.key==='tipo'){
        av=a.tipo_aula||'';bv=b.tipo_aula||'';
      }

      cmp=String(av).localeCompare(String(bv),'pt',{numeric:true,sensitivity:'base'});
      if(cmp!==0)return cmp*sort.dir;
    }

    return 0;
  });

  $('#scheduleViewerBlocks').innerHTML=rows.map(b=>`
    <tr>
      <td>${day(b.dia_semana)}</td>
      <td>${b.hora_inicio.slice(0,5)}</td>
      <td>${b.hora_fim.slice(0,5)}</td>
      <td><b>${esc(b.disciplina||b.nome||'')}</b></td>
      <td>${esc(b.tipo_aula)}</td>
    </tr>
  `).join('') || '<tr><td colspan="5">Sem blocos.</td></tr>';

  multiSortIndicator($$('.schedule-block-sort-head'),scheduleBlockSorts,'ssort');
}

function openScheduleViewer(title,subtitle,blocks,meta=[]){
  $('#scheduleViewerTitle').textContent=title;
  $('#scheduleViewerSub').textContent=subtitle||'';

  $('#scheduleViewerMeta').innerHTML=meta.map(x=>`<span class="badge gray">${esc(x)}</span>`).join('');

  currentScheduleViewerBlocks=[...blocks];
  scheduleBlockSorts=[{key:'dia',dir:1},{key:'inicio',dir:1}];

  renderScheduleViewerBlocks();
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
function courseTargetKey(p){
  return `${p.ramo||''}|${p.curso||''}`;
}

function availableCourseTargets(){
  const map=new Map();

  S.people
    .filter(p=>p.ramo&&p.curso)
    .forEach(p=>{
      const key=courseTargetKey(p);
      if(!map.has(key)){
        map.set(key,{
          key,
          ramo:p.ramo,
          curso:p.curso,
          label:`${p.ramo} · ${p.curso}`
        });
      }
    });

  return [...map.values()].sort((a,b)=>a.label.localeCompare(b.label,'pt'));
}

function renderCourseTargets(){
  const options=availableCourseTargets();

  $('#courseTargetList').innerHTML=options.map(x=>`
    <label class="course-target-option">
      <input
        type="checkbox"
        class="course-target-check"
        value="${esc(x.key)}"
        ${W.targetCourses?.has(x.key)?'checked':''}>
      <span>${esc(x.label)}</span>
    </label>
  `).join('');

  $$('.course-target-check').forEach(ch=>ch.onchange=()=>{
    if(!W.targetCourses)W.targetCourses=new Set();

    ch.checked
      ? W.targetCourses.add(ch.value)
      : W.targetCourses.delete(ch.value);

    pruneSelectionToScope();

    if(W.availability.length){
      renderWizardPeople();
    }
  });
}

function updateScope(){
  const scope=$('#weScope').value;
  const box=$('#scopeValueBox');
  const courseBox=$('#courseTargetBox');
  const yearBox=$('#yearTargetBox');

  courseBox.classList.add('hidden');
  yearBox.classList.add('hidden');

  if(scope==='all'){
    box.classList.add('hidden');
    pruneSelectionToScope();
    return;
  }

  box.classList.remove('hidden');

  if(scope==='course'){
    courseBox.classList.remove('hidden');
    renderCourseTargets();
  }

  if(scope==='year'){
    yearBox.classList.remove('hidden');

    const vals=[...new Set(
      S.people.map(p=>p.ano).filter(Boolean)
    )].sort((a,b)=>a-b);

    $('#weScopeValue').innerHTML=vals
      .map(v=>`<option value="${esc(v)}">${esc(v)}º</option>`)
      .join('');

    if(W.targetYear){
      $('#weScopeValue').value=String(W.targetYear);
    }

    W.targetYear=Number($('#weScopeValue').value)||null;
  }

  pruneSelectionToScope();
}

function scopePeople(){
  const scope=$('#weScope').value;

  if(scope==='course'){
    const targets=W.targetCourses||new Set();

    return S.people.filter(p=>
      targets.has(courseTargetKey(p))
    );
  }

  if(scope==='year'){
    const year=Number($('#weScopeValue').value||W.targetYear);
    return S.people.filter(p=>Number(p.ano)===year);
  }

  return S.people;
}

function pruneSelectionToScope(){
  if(!W?.selected)return;

  const allowed=new Set(scopePeople().map(p=>p.id));

  W.selected=new Set(
    [...W.selected].filter(id=>allowed.has(id))
  );

  participantTempSelection=new Set(
    [...participantTempSelection].filter(id=>allowed.has(id))
  );

  if($('#weCount')){
    $('#weCount').textContent=`${W.selected.size} empenhado(s)`;
  }
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


let participantManualOverrides=new Map();

function effectiveParticipantState(personId){
  const auto=W.availability.find(x=>x.pessoa_id===personId);
  const manual=participantManualOverrides.get(personId);

  if(manual?.estado){
    return {
      estado:manual.estado,
      motivo:manual.motivo||'Decisão manual para este evento',
      manual:true
    };
  }

  return {
    estado:auto?.estado||'DISPONIVEL',
    motivo:auto?.motivo||null,
    manual:false
  };
}

async function saveParticipantManualOverrides(eventId){
  const {error:deleteError}=await supabase
    .from('evento_disponibilidade_manual')
    .delete()
    .eq('evento_id',eventId);

  if(deleteError)throw deleteError;

  const payload=[...participantManualOverrides.entries()]
    .filter(([,x])=>x?.estado)
    .map(([pessoa_id,x])=>({
      evento_id:eventId,
      pessoa_id,
      estado:x.estado,
      motivo:x.motivo||null,
      atualizado_em:new Date().toISOString()
    }));

  if(payload.length){
    const {error}=await supabase
      .from('evento_disponibilidade_manual')
      .insert(payload);

    if(error)throw error;
  }
}

let participantSorts=[{key:'numero',dir:1}];
let participantTempSelection=new Set();

function participantRows(){
  const q=String($('#participantsSearch')?.value||'').trim().toLowerCase();
  const state=$('#participantsStateFilter')?.value||'';
  const year=$('#participantsYearFilter')?.value||'';
  const course=$('#participantsCourseFilter')?.value||'';
  const group=$('#participantsGroupFilter')?.value||'';

  const allowed=new Set(scopePeople().map(p=>p.id));

  let rows=S.people.filter(p=>{
    if(!allowed.has(p.id))return false;

    if(group==='equipa' && p.integra_equipa===false)return false;
    if(group==='externos' && p.integra_equipa!==false)return false;

    const effective=effectiveParticipantState(p.id);
    if(state && effective.estado!==state)return false;

    if(year && String(p.ano)!==String(year))return false;

    if(course){
      if(course==='__ENGENHEIROS__'){
        if(!isEngineeringCourse(p.curso))return false;
      }else if(`${p.ramo||''}|${p.curso||''}`!==course){
        return false;
      }
    }

    if(q){
      const values=[
        p.numero_corpo,p.nome,p.posto,p.funcao,p.ano,p.ramo,p.curso
      ].map(v=>String(v||'').toLowerCase());

      if(!values.some(v=>v.includes(q)))return false;
    }

    return true;
  });

  rows.sort((a,b)=>{
    for(const sort of participantSorts){
      let av,bv,cmp=0;

      if(sort.key==='numero'){
        const an=Number(a.numero_corpo),bn=Number(b.numero_corpo);

        if(!Number.isNaN(an)&&!Number.isNaN(bn)){
          cmp=an-bn;
        }else{
          cmp=String(a.numero_corpo||'').localeCompare(
            String(b.numero_corpo||''),
            'pt',
            {numeric:true,sensitivity:'base'}
          );
        }
      }else if(sort.key==='nome'){
        cmp=String(a.nome||'').localeCompare(String(b.nome||''),'pt',{numeric:true,sensitivity:'base'});
      }else if(sort.key==='ano'){
        cmp=(Number(a.ano)||0)-(Number(b.ano)||0);

        if(cmp===0){
          cmp=String(a.curso||'').localeCompare(String(b.curso||''),'pt',{numeric:true,sensitivity:'base'});
        }
      }else if(sort.key==='curso'){
        av=`${a.ramo||''} ${a.curso||''}`;
        bv=`${b.ramo||''} ${b.curso||''}`;
        cmp=av.localeCompare(bv,'pt',{numeric:true,sensitivity:'base'});
      }else if(sort.key==='disponibilidade'){
        const rank={INDISPONIVEL:1,POR_CONFIRMAR:2,DISPONIVEL:3};
        cmp=(rank[effectiveParticipantState(a.id).estado]||9)-
            (rank[effectiveParticipantState(b.id).estado]||9);
      }

      if(cmp!==0)return cmp*sort.dir;
    }

    return 0;
  });

  return rows;
}

function populateParticipantFilters(){
  const allowed=scopePeople();

  const years=[...new Set(
    allowed.map(p=>p.ano).filter(Boolean)
  )].sort((a,b)=>a-b);

  const yearSelect=$('#participantsYearFilter');
  const previousYear=yearSelect.value;

  yearSelect.innerHTML=
    '<option value="">Todos os anos</option>'+
    years.map(y=>`<option value="${y}">${y}º ano</option>`).join('');

  if(years.map(String).includes(previousYear)){
    yearSelect.value=previousYear;
  }

  const courses=[...new Map(
    allowed
      .filter(p=>p.ramo&&p.curso)
      .map(p=>[
        `${p.ramo}|${p.curso}`,
        {key:`${p.ramo}|${p.curso}`,label:`${p.ramo} · ${p.curso}`}
      ])
  ).values()].sort((a,b)=>a.label.localeCompare(b.label,'pt'));

  const courseSelect=$('#participantsCourseFilter');
  const previousCourse=courseSelect.value;

  courseSelect.innerHTML=
    '<option value="">Todos os cursos</option>'+
    '<option value="__ENGENHEIROS__">Engenheiros (TM + MAT + ENG)</option>'+
    courses.map(c=>`<option value="${esc(c.key)}">${esc(c.label)}</option>`).join('');

  if(previousCourse==='__ENGENHEIROS__' || courses.some(c=>c.key===previousCourse)){
    courseSelect.value=previousCourse;
  }
}

function syncParticipantSortSelect(){
  const primary=participantSorts[0]||{key:'numero',dir:1};
  const key=primary.key;
  const dir=primary.dir;

  let value='numero_asc';

  if(key==='numero')value=dir===1?'numero_asc':'numero_desc';
  if(key==='nome')value=dir===1?'nome_asc':'nome_desc';
  if(key==='ano')value=dir===1?'ano_asc':'ano_desc';
  if(key==='curso')value='curso_asc';
  if(key==='disponibilidade')value='disponibilidade';

  $('#participantsSort').value=value;
  multiSortIndicator($$('.participant-sort-head'),participantSorts,'sort');
}

function renderParticipantsSummary(){
  const selected=[...participantTempSelection];
  const states=selected.map(id=>effectiveParticipantState(id));

  const unavailable=states.filter(x=>x.estado==='INDISPONIVEL').length;
  const pending=states.filter(x=>x.estado==='POR_CONFIRMAR').length;
  const externals=selected
    .map(id=>S.people.find(p=>p.id===id))
    .filter(p=>p?.integra_equipa===false).length;
  const manual=selected.filter(id=>participantManualOverrides.has(id)).length;

  $('#participantsSummary').textContent=
    `${selected.length} selecionado(s) · ${externals} externo(s) · ${unavailable} indisponível(eis) · ${pending} por confirmar · ${manual} decisão(ões) manual(ais)`;
}

function renderParticipantsDialog(){
  populateParticipantFilters();
  syncParticipantSortSelect();
  const rows=participantRows();

  $('#participantsBody').innerHTML=rows.map(p=>{
    const auto=W.availability.find(x=>x.pessoa_id===p.id);
    const manual=participantManualOverrides.get(p.id);
    const effective=effectiveParticipantState(p.id);

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
      <td>
        <div class="participant-auto-state">
          ${badge(effective.estado)}
          <small>${effective.manual?'Manual':'Automático'}</small>
        </div>
      </td>
      <td class="manual-availability-cell">
        <select class="manual-availability-select" data-person="${p.id}">
          <option value="" ${!manual?.estado?'selected':''}>Automático</option>
          <option value="DISPONIVEL" ${manual?.estado==='DISPONIVEL'?'selected':''}>Disponível</option>
          <option value="INDISPONIVEL" ${manual?.estado==='INDISPONIVEL'?'selected':''}>Indisponível</option>
          <option value="POR_CONFIRMAR" ${manual?.estado==='POR_CONFIRMAR'?'selected':''}>Por confirmar</option>
        </select>
        <input
          class="manual-reason-input"
          data-person="${p.id}"
          placeholder="Motivo manual (opcional)"
          value="${esc(manual?.motivo||'')}">
      </td>
      <td class="participant-reason">
        ${esc(effective.motivo||auto?.motivo||'—')}
      </td>
      <td class="participant-class">
        ${auto?.tem_alerta_aula?esc(auto?.detalhe_aula||'Aula'):'—'}
      </td>
    </tr>`;
  }).join('');

  $$('.participant-check').forEach(ch=>ch.onchange=()=>{
    ch.checked
      ? participantTempSelection.add(ch.value)
      : participantTempSelection.delete(ch.value);
    renderParticipantsSummary();
  });

  $$('.manual-availability-select').forEach(sel=>sel.onchange=()=>{
    const id=sel.dataset.person;
    const reason=$(`.manual-reason-input[data-person="${id}"]`)?.value||'';

    if(!sel.value){
      participantManualOverrides.delete(id);
    }else{
      participantManualOverrides.set(id,{
        estado:sel.value,
        motivo:reason
      });
    }

    renderParticipantsDialog();
  });

  $$('.manual-reason-input').forEach(inp=>inp.onchange=()=>{
    const id=inp.dataset.person;
    const current=participantManualOverrides.get(id);

    if(current){
      participantManualOverrides.set(id,{
        ...current,
        motivo:inp.value
      });
      renderParticipantsSummary();
    }
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

    participantManualOverrides=new Map();

    if(W.event?.id){
      S.manualAvailability
        .filter(x=>x.evento_id===W.event.id)
        .forEach(x=>participantManualOverrides.set(x.pessoa_id,{
          estado:x.estado,
          motivo:x.motivo||''
        }));
    }

    $('#participantsDialogTitle').textContent=
      `Participantes — ${$('#weName').value||'Evento'}`;

    $('#participantsDialogSub').textContent=
      `${fmt(d)} · ${t}${$('#weEnd').value?'–'+$('#weEnd').value:''}`;

    $('#participantsSearch').value='';
    $('#participantsStateFilter').value='';
    $('#participantsYearFilter').value='';
    $('#participantsCourseFilter').value='';
    $('#participantsGroupFilter').value='';
    participantSorts=[{key:'numero',dir:1}];

    renderParticipantsDialog();
    $('#participantsDialog').showModal();
  }catch(e){
    toast(e.message);
  }
}

async function openEventWizard(e=null){
  W={
    event:e,
    availability:[],
    selected:new Set(e?S.assigned.filter(a=>a.evento_id===e.id).map(a=>a.pessoa_id):[]),
    targetCourses:new Set(),
    targetYear:e?.alvo_ano||null
  };

  if(e?.id){
    S.eventCourseTargets
      .filter(x=>x.evento_id===e.id)
      .forEach(x=>W.targetCourses.add(`${x.ramo}|${x.curso}`));
  }

  participantManualOverrides=new Map();
  if(e?.id){
    S.manualAvailability
      .filter(x=>x.evento_id===e.id)
      .forEach(x=>participantManualOverrides.set(x.pessoa_id,{
        estado:x.estado,
        motivo:x.motivo||''
      }));
  }
  $('#wizardTitle').textContent=e?'Editar evento':'Novo evento';$('#weName').value=e?.nome||'';$('#weDate').value=e?.data||'';$('#weStart').value=e?.hora_inicio?.slice(0,5)||'';$('#weEnd').value=e?.hora_fim?.slice(0,5)||'';$('#weStatus').value=e?.estado_manual||'';$('#weNote').value=e?.observacao||'';
  $('#weScope').value=e?.alvo_tipo==='CURSOS'?'course':e?.alvo_tipo==='ANO'?'year':'all';
  updateScope();
  $('#wePeople').innerHTML='<p class="muted">Carrega em “Ver disponibilidade”.</p>';$('#weCount').textContent=`${W.selected.size} empenhado(s)`;$('#eventWizard').showModal();
  if(e?.data&&e?.hora_inicio)await wizardCheck();
}
async function saveWizard(){
  const scope=$('#weScope').value;

  if(scope==='course' && (!W.targetCourses || W.targetCourses.size===0)){
    return toast('Seleciona pelo menos um curso para este evento.');
  }

  const x={
    nome:$('#weName').value.trim(),
    data:$('#weDate').value,
    hora_inicio:$('#weStart').value,
    hora_fim:$('#weEnd').value||null,
    estado_manual:$('#weStatus').value||null,
    observacao:$('#weNote').value.trim()||null,
    alvo_todos:scope==='all',
    alvo_tipo:scope==='course'?'CURSOS':scope==='year'?'ANO':'TODOS',
    alvo_ano:scope==='year'?Number($('#weScopeValue').value):null
  };
  if(!x.nome||!x.data||!x.hora_inicio)return toast('Preenche nome, data e hora.');
  let id=W.event?.id;
  if(id){const r=await supabase.from('eventos').update(x).eq('id',id);if(r.error)return toast(r.error.message)}
  else{const r=await supabase.from('eventos').insert(x).select().single();if(r.error)return toast(r.error.message);id=r.data.id}
  const ctDel=await supabase.from('evento_cursos_alvo').delete().eq('evento_id',id);
  if(ctDel.error)return toast(ctDel.error.message);

  if(scope==='course' && W.targetCourses.size){
    const targets=[...W.targetCourses].map(key=>{
      const [ramo,...rest]=key.split('|');
      return {
        evento_id:id,
        ramo,
        curso:rest.join('|')
      };
    });

    const ctIns=await supabase.from('evento_cursos_alvo').insert(targets);
    if(ctIns.error)return toast(ctIns.error.message);
  }

  pruneSelectionToScope();

  const d=await supabase.from('evento_empenhados').delete().eq('evento_id',id);if(d.error)return toast(d.error.message);
  if(W.selected.size){const r=await supabase.from('evento_empenhados').insert([...W.selected].map(pessoa_id=>({evento_id:id,pessoa_id})));if(r.error)return toast(r.error.message)}
  try{
    await saveParticipantManualOverrides(id);
  }catch(e){
    return toast(e.message);
  }
  $('#eventWizard').close();toast('Evento guardado.');await load();
}
$('#wizardClose').onclick=$('#wizardCancel').onclick=()=>$('#eventWizard').close();$('#wizardSave').onclick=saveWizard;$('#weOpenParticipants').onclick=openParticipantsDialog;
$('#pdfSortClose').onclick=$('#pdfSortCancel').onclick=()=>$('#pdfSortDialog').close();

$('#pdfSortGenerate').onclick=()=>{
  if(!pendingPdfEventId)return;

  const criteria=[
    {key:$('#pdfSort1').value,dir:$('#pdfSort1Dir').value},
    {key:$('#pdfSort2').value,dir:$('#pdfSort2Dir').value},
    {key:$('#pdfSort3').value,dir:$('#pdfSort3Dir').value}
  ];

  const used=new Set();
  for(const c of criteria){
    if(!c.key)continue;
    if(used.has(c.key)){
      return toast('Não escolhas o mesmo critério mais do que uma vez.');
    }
    used.add(c.key);
  }

  $('#pdfSortDialog').close();
  generateEventPdfWithSort(pendingPdfEventId,criteria);
};

$('#participantsDialogClose').onclick=()=>$('#participantsDialog').close();
$('#participantsCancel').onclick=()=>$('#participantsDialog').close();

$('#participantsSearch').oninput=renderParticipantsDialog;
$('#participantsStateFilter').onchange=renderParticipantsDialog;
$('#participantsYearFilter').onchange=renderParticipantsDialog;
$('#participantsCourseFilter').onchange=renderParticipantsDialog;
$('#participantsSort').onchange=()=>{
  const v=$('#participantsSort').value;

  let next={key:'numero',dir:1};

  if(v==='numero_asc')next={key:'numero',dir:1};
  else if(v==='numero_desc')next={key:'numero',dir:-1};
  else if(v==='nome_asc')next={key:'nome',dir:1};
  else if(v==='nome_desc')next={key:'nome',dir:-1};
  else if(v==='ano_asc')next={key:'ano',dir:1};
  else if(v==='ano_desc')next={key:'ano',dir:-1};
  else if(v==='curso_asc')next={key:'curso',dir:1};
  else if(v==='disponibilidade')next={key:'disponibilidade',dir:1};

  const oldIndex=participantSorts.findIndex(s=>s.key===next.key);
  if(oldIndex!==-1)participantSorts.splice(oldIndex,1);

  participantSorts.unshift(next);
  renderParticipantsDialog();
};

$$('.participant-sort-head').forEach(btn=>btn.onclick=()=>{
  multiSortClick(participantSorts,btn.dataset.sort);
  renderParticipantsDialog();
});

$('#participantsGroupFilter').onchange=renderParticipantsDialog;

$('#participantsSelectAvailable').onclick=()=>{
  participantRows().forEach(p=>{
    if(effectiveParticipantState(p.id).estado==='DISPONIVEL'){
      participantTempSelection.add(p.id);
    }
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

$('#weCheck').onclick=wizardCheck;

$('#weScope').onchange=()=>{
  updateScope();
  if(W.availability.length)renderWizardPeople();
};

$('#weScopeValue').onchange=()=>{
  W.targetYear=Number($('#weScopeValue').value)||null;
  pruneSelectionToScope();
  if(W.availability.length)renderWizardPeople();
};

$('#checkAvailBtn').onclick=renderAvailability;
$('#availFilter').onchange=filterAvailability;

$$('#availTable [data-colfilter]').forEach(el=>{
  el.addEventListener('input',filterAvailability);
  el.addEventListener('change',filterAvailability);
});

$$('#availTable .sort-head').forEach(btn=>{
  btn.addEventListener('click',()=>{
    const key=btn.dataset.sort;
    const index=availSorts.findIndex(s=>s.key===key);

    if(index===0){
      // Se já for o critério principal, alterna ascendente/descendente.
      availSorts[0].dir*=-1;
    }else if(index>0){
      // Se já existir como critério secundário, passa a principal.
      const [existing]=availSorts.splice(index,1);
      availSorts.unshift(existing);
    }else{
      // Nova coluna: passa a principal e mantém as anteriores como desempate.
      availSorts.unshift({key,dir:1});
    }

    filterAvailability();
  });
});

$('#resetAvailFiltersBtn').onclick=()=>{
  $('#availFilter').value='all';
  $$('#availTable [data-colfilter]').forEach(el=>el.value='');
  availSorts=[{key:'nome',dir:1}];
  filterAvailability();
};$('#personSearch').oninput=renderPeople;$('#newEventBtn').onclick=()=>openEventWizard();$('#newExternalPersonBtn').onclick=()=>openPerson(null,true);$('#newPersonBtn').onclick=()=>openPerson();
$$('#constraintsTable [data-cfilter]').forEach(el=>{
  el.addEventListener('input',renderConstraints);
  el.addEventListener('change',renderConstraints);
});
[...$$('#constraintsTable .sort-head'),...$$('#pastConstraintsTable .sort-head')].forEach(btn=>{
  btn.addEventListener('click',()=>{
    multiSortClick(constraintSorts,btn.dataset.csort);
    renderConstraints();
  });
});
$('#resetConstraintFilters').onclick=()=>{
  $$('#constraintsTable [data-cfilter]').forEach(el=>el.value='');
  constraintSorts=[{key:'inicio',dir:-1}];
  renderConstraints();
};

$$('#peopleTable [data-pfilter]').forEach(el=>{
  el.addEventListener('input',renderPeople);
  el.addEventListener('change',renderPeople);
});
$$('#peopleTable .sort-head').forEach(btn=>{
  btn.addEventListener('click',()=>{
    multiSortClick(peopleSorts,btn.dataset.psort);
    renderPeople();
  });
});
$('#peopleGroupPreset').onchange=()=>{
  peopleGroupPreset=$('#peopleGroupPreset').value;
  renderPeople();
};

$('#resetPeopleFilters').onclick=()=>{
  $$('#peopleTable [data-pfilter]').forEach(el=>el.value='');
  $('#peopleGroupPreset').value='';
  peopleGroupPreset='';
  peopleSorts=[{key:'nome',dir:1}];
  renderPeople();
};


$$('.event-sort-head').forEach(btn=>btn.onclick=()=>{
  multiSortClick(eventSorts,btn.dataset.esort);
  renderEvents();
});

$$('.history-sort-head').forEach(btn=>btn.onclick=()=>{
  multiSortClick(historySorts,btn.dataset.hsort);
  renderHistory();
});

$$('.external-sort-head').forEach(btn=>btn.onclick=()=>{
  multiSortClick(externalSorts,btn.dataset.xsort);
  renderExternalPeople();
});

$$('.schedule-block-sort-head').forEach(btn=>btn.onclick=()=>{
  multiSortClick(scheduleBlockSorts,btn.dataset.ssort);
  renderScheduleViewerBlocks();
});

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

$('#refreshBtn').onclick=load;$$('#appView nav button').forEach(b=>b.onclick=()=>page(b.dataset.page));
$('#availDate').value=today();


$('#openTeamModule').onclick=()=>{window.location.href='equipa.html'};
$('#openClassModule').onclick=()=>{window.location.href='turma.html'};
$('#backToModulesBtn').onclick=()=>{window.location.href='index.html'};
$('#classBackToModulesBtn').onclick=()=>{window.location.href='index.html'};
$('#moduleLogoutBtn').onclick=()=>supabase.auth.signOut();
$('#classLogoutBtn').onclick=()=>supabase.auth.signOut();
$('#classRefreshBtn').onclick=async()=>{await load();renderClassModule()};
$$('.class-nav button').forEach(b=>b.onclick=()=>classPage(b.dataset.classPage));
$('#classSearch').oninput=renderClassPeople;
$$('#classPeopleTable [data-tfilter]').forEach(el=>{
  el.addEventListener('input',renderClassPeople);
  el.addEventListener('change',renderClassPeople);
});
$$('.class-sort-head').forEach(btn=>btn.onclick=()=>{
  multiSortClick(classSorts,btn.dataset.tsort);
  renderClassPeople();
});

$('#loginForm').onsubmit=async e=>{e.preventDefault();const r=await supabase.auth.signInWithPassword({email:$('#loginEmail').value,password:$('#loginPassword').value});$('#loginError').textContent=r.error?.message||''};
$('#logoutBtn').onclick=()=>supabase.auth.signOut();
supabase.auth.onAuthStateChange(async(_e,s)=>{
  if(!s){
    if(QG_PAGE!=='selector'){
      window.location.replace('index.html');
      return;
    }

    $('#loginView').classList.remove('hidden');
    $('#moduleView').classList.add('hidden');
    $('#appView').classList.add('hidden');
    $('#classView').classList.add('hidden');
    return;
  }

  $('#loginView').classList.add('hidden');

  const email=s.user.email||'';
  $('#sessionEmail').textContent=email;
  $('#classSessionEmail').textContent=email;
  $('#moduleEmail').textContent=email;

  try{
    await load();

    if(QG_PAGE==='team'){
      showTeamModule();
    }else if(QG_PAGE==='class'){
      showClassModule();
    }else{
      showModuleSelector();
    }
  }catch(e){
    toast(e.message);
  }
});
