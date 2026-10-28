import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const supabase=createClient(
  'https://nfnxqiseohcnkgjbgata.supabase.co',
  'sb_publishable_LR4VwEg_DQLmMhS7C7MZUA_ZTKk4KVl'
);

const $=s=>document.querySelector(s);
const today=()=>new Date().toISOString().slice(0,10);

function datePlusDays(days){
  const d=new Date();
  d.setHours(12,0,0,0);
  d.setDate(d.getDate()+days);
  return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
}

function shortDate(iso){
  if(!iso)return '—';
  const d=new Date(`${iso}T12:00:00`);
  return new Intl.DateTimeFormat('pt-PT',{day:'2-digit',month:'short'}).format(d).replace('.','');
}

function eventCancelled(e){
  return String(e.estado||'').toUpperCase()==='CANCELADO';
}

function uniqueEvaluations(rows){
  const map=new Map();
  for(const e of rows){
    const key=[e.data,e.cadeira,e.tipo].map(x=>String(x||'').trim().toLowerCase()).join('|');
    if(!map.has(key))map.set(key,e);
  }
  return [...map.values()];
}

async function loadSelectorData(){
  const [peopleRes,eventsRes,evalRes]=await Promise.all([
    supabase.from('pessoas').select('id,nome,numero_corpo,curso,ano,ativo,integra_equipa'),
    supabase.from('eventos').select('id,nome,data,hora_inicio,estado'),
    supabase.from('avaliacoes_turma').select('id,data,cadeira,tipo').then(r=>{
      if(r.error && ['42P01','PGRST205'].includes(r.error.code))return {data:[],error:null};
      return r;
    })
  ]);

  if(peopleRes.error)throw peopleRes.error;
  if(eventsRes.error)throw eventsRes.error;
  if(evalRes.error)throw evalRes.error;

  const people=peopleRes.data||[];
  const events=eventsRes.data||[];
  const evaluations=evalRes.data||[];
  const team=people.filter(p=>p.ativo!==false && p.integra_equipa!==false);
  const tm=people.filter(p=>p.ativo!==false && String(p.curso||'').trim().toUpperCase()==='TM' && Number(p.ano)===6);
  const todayIso=today();
  const end7=datePlusDays(7);

  $('#moduleTeamCount').textContent=team.length;
  $('#moduleClassCount').textContent=tm.length;

  const upcoming=events.filter(e=>!eventCancelled(e) && String(e.data||'')>=todayIso && String(e.data||'')<=end7);
  $('#moduleTeamUpcomingEvents').textContent=upcoming.length;
  $('#moduleTeamUpcomingEventsLabel').textContent=`evento${upcoming.length===1?'':'s'} · 7 dias`;

  $('#moduleTeamTomorrowUnavailable').textContent='…';
  try{
    const tomorrow=datePlusDays(1);
    const {data,error}=await supabase.rpc('consultar_disponibilidade',{p_data:tomorrow,p_hora:null,p_ignorar_evento:null});
    if(error)throw error;
    const teamIds=new Set(team.map(p=>String(p.id)));
    const count=(data||[]).filter(r=>teamIds.has(String(r.pessoa_id||'')) && r.estado==='INDISPONIVEL').length;
    $('#moduleTeamTomorrowUnavailable').textContent=count;
  }catch{
    $('#moduleTeamTomorrowUnavailable').textContent='—';
  }

  const unique=uniqueEvaluations(evaluations)
    .filter(e=>String(e.data||'')>=todayIso)
    .sort((a,b)=>String(a.data||'').localeCompare(String(b.data||'')) || String(a.cadeira||'').localeCompare(String(b.cadeira||''),'pt'));
  const next=unique[0];
  const week=unique.filter(e=>String(e.data||'')<=end7);

  $('#moduleClassNextEvaluation').textContent=next?`${shortDate(next.data)} · ${next.cadeira}`:'Sem avaliações';
  $('#moduleClassWeekEvaluations').textContent=week.length;
  $('#moduleDataUpdated').textContent=`Dados carregados às ${new Date().toLocaleTimeString('pt-PT',{hour:'2-digit',minute:'2-digit'})}`;
}

function showLoggedOut(){
  $('#loginView').classList.remove('hidden');
  $('#moduleView').classList.add('hidden');
}

async function showLoggedIn(session){
  $('#loginView').classList.add('hidden');
  $('#moduleView').classList.remove('hidden');
  $('#moduleEmail').textContent=session.user.email||'';
  try{await loadSelectorData()}catch(e){
    $('#moduleDataUpdated').textContent=`Erro ao carregar dados: ${e.message}`;
  }
}

$('#loginForm').onsubmit=async e=>{
  e.preventDefault();
  $('#loginError').textContent='';
  const {error}=await supabase.auth.signInWithPassword({
    email:$('#loginEmail').value,
    password:$('#loginPassword').value
  });
  if(error)$('#loginError').textContent=error.message;
};

$('#openTeamModule').onclick=()=>{window.location.href='equipa.html'};
$('#openClassModule').onclick=()=>{window.location.href='turma.html'};
$('#moduleLogoutBtn').onclick=()=>supabase.auth.signOut();

supabase.auth.onAuthStateChange((_event,session)=>{
  if(session)showLoggedIn(session);
  else showLoggedOut();
});

const {data}=await supabase.auth.getSession();
if(data.session)await showLoggedIn(data.session);
else showLoggedOut();
