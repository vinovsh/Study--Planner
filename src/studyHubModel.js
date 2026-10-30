const {uid,dateKey,validDate,validTime}=require('./model');
const {shiftDate,hasSessionConflict}=require('./planning');
const ACCENTS={Lavender:'#8063B4',Indigo:'#4E61C9',Rose:'#BA527C',Teal:'#327F78',Sky:'#287BAD',Amber:'#936217'};
const STATUS=['Not started','Learning','Completed','Revised'];
const EXTRAS=['chapters','formulas','questions','attempts','grades'];
function examSubjects(exam){return exam.subjectIds?.length?exam.subjectIds:[exam.subjectId];}
function chapterReady(chapter){return ['Completed','Revised'].includes(chapter.status);}
function normalizeHub(data){return {...data,...Object.fromEntries(EXTRAS.map(key=>[key,data[key]===undefined?[]:data[key]])),settings:{dailyGoal:120,studyDays:[1,2,3,4,5,6,0],studyStart:'17:00',accent:'Lavender',tabLabels:true,dailyReminder:false,nightlyRecap:false,morningTime:'08:00',recapTime:'21:00',...data.settings}};}
function validateHub(value){
  const data=normalizeHub(value),fail=()=>{throw Error('Invalid study tools data in backup.');};
  const text=(v,max=20000)=>typeof v==='string'&&v.length<=max;
  const subjects=new Set(data.subjects.map(s=>s.id));
  const exams=new Set(data.exams.map(e=>e.id));
  const s=data.settings;
  if(!Number.isInteger(s.dailyGoal)||s.dailyGoal<5||s.dailyGoal>720||!Object.prototype.hasOwnProperty.call(ACCENTS,s.accent)||typeof s.tabLabels!=='boolean'||!validTime(s.studyStart)||!validTime(s.morningTime)||!validTime(s.recapTime)||typeof s.dailyReminder!=='boolean'||typeof s.nightlyRecap!=='boolean'||!Array.isArray(s.studyDays)||!s.studyDays.length||s.studyDays.some(d=>!Number.isInteger(d)||d<0||d>6)||new Set(s.studyDays).size!==s.studyDays.length)fail();
  for(const key of EXTRAS){
    if(!Array.isArray(data[key])||data[key].length>10000)fail();
    const ids=new Set();
    for(const item of data[key]){if(!item||!text(item.id,100)||!item.id||ids.has(item.id))fail();ids.add(item.id);}
  }
  for(const e of data.exams)if(e.subjectIds!==undefined&&(!Array.isArray(e.subjectIds)||!e.subjectIds.length||new Set(e.subjectIds).size!==e.subjectIds.length||e.subjectIds.some(id=>!subjects.has(id))||!e.subjectIds.includes(e.subjectId)))fail();
  for(const ch of data.chapters)if(!subjects.has(ch.subjectId)||!text(ch.title,200)||!ch.title.trim()||!STATUS.includes(ch.status)||!Number.isInteger(ch.minutes)||ch.minutes<5||ch.minutes>240||(ch.examId&&(!exams.has(ch.examId)||!examSubjects(data.exams.find(e=>e.id===ch.examId)).includes(ch.subjectId)))||(ch.completedOn&&!validDate(ch.completedOn)))fail();
  const chapters=new Map(data.chapters.map(ch=>[ch.id,ch]));
  for(const key of ['formulas','questions'])for(const item of data[key]){
    if(!subjects.has(item.subjectId)||(item.chapterId&&chapters.get(item.chapterId)?.subjectId!==item.subjectId))fail();
    if(key==='formulas'&&(!text(item.title,200)||!item.title.trim()||!text(item.body)||!item.body.trim()))fail();
    if(key==='questions'&&!validQuestion(item))fail();
  }
  for(const a of data.attempts)if(!text(a.title,200)||!validDate(a.date)||!Number.isFinite(a.finishedAt)||!['practice','mock'].includes(a.mode)||!Array.isArray(a.questions)||!a.questions.length||a.questions.length>100||!a.questions.every(validQuestion)||!Array.isArray(a.answers)||a.answers.length!==a.questions.length||a.answers.some(n=>!Number.isInteger(n)||n< -1||n>3))fail();
  for(const g of data.grades)if(!subjects.has(g.subjectId)||!text(g.title,200)||!g.title.trim()||!validDate(g.date)||!Number.isFinite(g.score)||!Number.isFinite(g.total)||g.total<=0||g.total>100000||g.score<0||g.score>g.total)fail();
  return data;
}
function validQuestion(q){return !!q&&typeof q.id==='string'&&q.id.length>0&&typeof q.prompt==='string'&&q.prompt.trim().length>0&&q.prompt.length<=2000&&Array.isArray(q.options)&&q.options.length===4&&q.options.every(v=>typeof v==='string'&&v.trim()&&v.length<=500)&&new Set(q.options.map(v=>v.trim().toLocaleLowerCase())).size===4&&Number.isInteger(q.correct)&&q.correct>=0&&q.correct<4&&typeof q.explanation==='string'&&q.explanation.length<=5000;}
function readiness(data,examId=''){
  const exam=data.exams.find(e=>e.id===examId);
  const chapters=data.chapters.filter(ch=>!exam||examSubjects(exam).includes(ch.subjectId)&&(!ch.examId||ch.examId===exam.id));
  return {total:chapters.length,completed:chapters.filter(chapterReady).length,revised:chapters.filter(ch=>ch.status==='Revised').length};
}
function dailyPlan(data,today=dateKey(),examId=''){
  const exam=data.exams.find(e=>e.id===examId);
  if(!data.settings.studyDays.includes(new Date(`${today}T12:00:00`).getDay()))return {chapters:[],minutes:0,restDay:true,remaining:0};
  const dueFor=ch=>{
    const dates=data.exams.filter(e=>e.date>=today&&examSubjects(e).includes(ch.subjectId)&&(!ch.examId||ch.examId===e.id)).map(e=>e.date).sort();
    return dates[0]||'9999-12-31';
  };
  const candidates=data.chapters.filter(ch=>!chapterReady(ch)&&(!exam||examSubjects(exam).includes(ch.subjectId)&&(!ch.examId||ch.examId===exam.id))).sort((a,b)=>dueFor(a).localeCompare(dueFor(b))||a.title.localeCompare(b.title));
  // Round robin subjects in deadline order; oversized chapters stay visible as a warning.
  const queues=new Map();for(const ch of candidates){if(!queues.has(ch.subjectId))queues.set(ch.subjectId,[]);queues.get(ch.subjectId).push(ch);}
  const quotas=new Map();
  for(const [subjectId,queue] of queues){
    const due=dueFor(queue[0]);let available=0;
    if(due!=='9999-12-31')for(let date=today,i=0;date<due&&i<366;i++,date=shiftDate(date,1))if(data.settings.studyDays.includes(new Date(`${date}T12:00:00`).getDay()))available++;
    quotas.set(subjectId,due==='9999-12-31'?queue.length:Math.max(1,Math.ceil(queue.length/Math.max(1,available))));
  }
  const chosen=new Map();
  const selected=[];let minutes=0,changed=true;
  while(changed){changed=false;for(const [subjectId,queue] of queues){
    if((chosen.get(subjectId)||0)>=quotas.get(subjectId))continue;
    const index=queue.findIndex(ch=>minutes+ch.minutes<=data.settings.dailyGoal);
    if(index>=0){const [ch]=queue.splice(index,1);selected.push(ch);minutes+=ch.minutes;chosen.set(subjectId,(chosen.get(subjectId)||0)+1);changed=true;}
  }}
  return {chapters:selected,minutes,remaining:candidates.length-selected.length,restDay:false,oversized:candidates.filter(ch=>ch.minutes>data.settings.dailyGoal).length};
}
function revisionSchedule(data,exam,today=dateKey(),now=Date.now()){
  if(!exam||!validDate(exam.date)||exam.date<=today)throw Error('Choose an exam after today.');
  const remaining=data.chapters.filter(ch=>!chapterReady(ch)&&examSubjects(exam).includes(ch.subjectId)&&(!ch.examId||ch.examId===exam.id));
  const already=new Set(data.sessions.filter(s=>!s.done&&s.examId===exam.id&&s.date>=today&&s.date<exam.date).map(s=>s.chapterId));
  const pending=remaining.filter(ch=>!already.has(ch.id));
  const ordered=[];const groups=new Map();for(const ch of pending){if(!groups.has(ch.subjectId))groups.set(ch.subjectId,[]);groups.get(ch.subjectId).push(ch);}while([...groups.values()].some(g=>g.length))for(const group of groups.values())if(group.length)ordered.push(group.shift());pending.splice(0,pending.length,...ordered);
  const sessions=[],working=[...data.sessions];
  const start=data.settings.studyStart.split(':').map(Number);const startMinute=start[0]*60+start[1];
  let date=today;
  for(let day=0;date<exam.date&&day<366;day++,date=shiftDate(date,1)){
    if(!data.settings.studyDays.includes(new Date(`${date}T12:00:00`).getDay()))continue;
    let daysLeft=0;for(let next=date,i=0;next<exam.date&&i<366;i++,next=shiftDate(next,1))if(data.settings.studyDays.includes(new Date(`${next}T12:00:00`).getDay()))daysLeft++;
    const quota=Math.max(1,Math.ceil(pending.length/Math.max(1,daysLeft)));let placedToday=0;
    let used=working.filter(s=>s.date===date).reduce((sum,s)=>sum+s.duration,0);
    for(let i=0;i<pending.length&&placedToday<quota;){
      const ch=pending[i];if(used+ch.minutes>data.settings.dailyGoal){i++;continue;}
      let placed=false;
      for(let minute=startMinute;minute+ch.minutes<=1440;minute+=5){
        const time=`${String(Math.floor(minute/60)).padStart(2,'0')}:${String(minute%60).padStart(2,'0')}`;
        if(new Date(`${date}T${time}:00`).getTime()<=now)continue;
        const session={id:uid(),subjectId:ch.subjectId,chapterId:ch.id,examId:exam.id,title:`Revise: ${ch.title}`,date,time,duration:ch.minutes,done:false};
        if(!hasSessionConflict(working,[session])){sessions.push(session);working.push(session);used+=ch.minutes;pending.splice(i,1);placedToday++;placed=true;break;}
      }
      if(!placed)i++;
    }
  }
  return {sessions,unallocated:pending.length,alreadyPlanned:already.size};
}
function createQuiz(questions,{mode='practice',minutes=30,count=10,title='Study practice'}={},now=Date.now(),random=Math.random){
  if(!['practice','mock'].includes(mode)||!Number.isInteger(count)||count<1||count>100||!Number.isInteger(minutes)||minutes<5||minutes>180)throw Error('Choose 1–100 questions and 5–180 minutes.');
  if(!questions.length||questions.some(q=>!validQuestion(q)))throw Error('Add valid questions first.');
  const pool=questions.map(q=>({...q,options:[...q.options]}));for(let i=pool.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]];}
  const selected=pool.slice(0,count);
  return {id:uid(),mode,title,questions:selected,answers:selected.map(()=>-1),index:0,checked:false,endsAt:mode==='mock'?now+minutes*60000:null};
}
function validQuiz(q){return !!q&&typeof q.id==='string'&&typeof q.title==='string'&&['mock','practice'].includes(q.mode)&&Array.isArray(q.questions)&&q.questions.length>0&&q.questions.length<=100&&q.questions.every(validQuestion)&&Array.isArray(q.answers)&&q.answers.length===q.questions.length&&q.answers.every(n=>Number.isInteger(n)&&n>=-1&&n<4)&&Number.isInteger(q.index)&&q.index>=0&&q.index<q.questions.length&&typeof q.checked==='boolean'&&(q.mode==='practice'?q.endsAt===null:Number.isFinite(q.endsAt));}
function quizResult(q,now=Date.now()){
  if(!validQuiz(q))throw Error('Invalid quiz.');
  const correct=q.questions.filter((item,i)=>item.correct===q.answers[i]).length;
  return {id:q.id,title:q.title,mode:q.mode,date:dateKey(new Date(now)),finishedAt:now,questions:q.questions,answers:q.answers,correct,total:q.questions.length};
}
function mistakes(data){return new Set(data.attempts.flatMap(a=>a.questions.filter((q,i)=>q.correct!==a.answers[i]).map(q=>q.id)));}
function searchAll(data,query){
  const text=query.trim().toLocaleLowerCase();if(!text)return [];
  const config=[['subjects','Subject',['name']],['chapters','Chapter',['title']],['tasks','Assignment',['title']],['sessions','Session',['title','date']],['notes','Note',['title','body']],['cards','Flashcard',['question','answer']],['exams','Exam',['title','date']],['formulas','Formula / fact',['title','body']],['questions','Practice question',['prompt','explanation']],['grades','Grade',['title']]];
  return config.flatMap(([key,kind,fields])=>(data[key]===undefined?[]:data[key]).filter(x=>[...fields.map(f=>x[f]||''),data.subjects.find(s=>s.id===x.subjectId)?.name||''].join(' ').toLocaleLowerCase().includes(text)).map(item=>({key,kind,item,title:item.title||item.name||item.question||item.prompt})));
}
function calendarItems(data,date){return [...data.sessions.filter(s=>s.date===date).map(item=>({kind:'session',item,title:item.title,detail:`${item.time} · ${item.duration} min`})),...data.tasks.filter(t=>t.due===date).map(item=>({kind:'task',item,title:item.title,detail:item.done?'Completed':'Assignment due'})),...data.exams.filter(e=>e.date===date).map(item=>({kind:'exam',item,title:item.title,detail:'Exam'}))];}
function monthGrid(anchor){const first=new Date(anchor.getFullYear(),anchor.getMonth(),1,12);const offset=(first.getDay()+6)%7;first.setDate(first.getDate()-offset);return Array.from({length:42},(_,i)=>{const d=new Date(first);d.setDate(d.getDate()+i);return {date:dateKey(d),day:d.getDate(),inMonth:d.getMonth()===anchor.getMonth()};});}
function dailyMinutes(data,date=dateKey()){return data.logs.filter(l=>l.date===date).reduce((sum,l)=>sum+l.minutes,0);}
function deleteHubItem(data,key,item){
  let next={...data,[key]:data[key].filter(x=>x.id!==item.id)};
  if(key==='chapters')for(const name of ['questions','formulas','sessions'])next[name]=next[name].map(x=>x.chapterId===item.id?{...x,chapterId:''}:x);
  if(key==='exams'){
    next.chapters=next.chapters.map(ch=>ch.examId===item.id?{...ch,examId:''}:ch);
    next.sessions=next.sessions.map(s=>s.examId===item.id?{...s,examId:''}:s);
  }
  if(key==='subjects'){
    for(const name of ['sessions','tasks','cards','notes','chapters','formulas','questions','grades'])next[name]=next[name].filter(x=>x.subjectId!==item.id);
    next.exams=next.exams.map(e=>{const ids=examSubjects(e).filter(id=>id!==item.id);return {...e,subjectId:ids[0],subjectIds:ids};}).filter(e=>e.subjectIds.length);
    const exams=new Set(next.exams.map(e=>e.id));next.chapters=next.chapters.map(ch=>ch.examId&&!exams.has(ch.examId)?{...ch,examId:''}:ch);
    next.sessions=next.sessions.map(s=>s.examId&&!exams.has(s.examId)?{...s,examId:''}:s);
    if(next.timer?.subjectId===item.id)next.timer=null;
    if(next.activeQuiz?.questions.some(q=>q.subjectId===item.id))next.activeQuiz=null;
  }
  return next;
}
module.exports={ACCENTS,STATUS,EXTRAS,examSubjects,chapterReady,normalizeHub,validateHub,readiness,dailyPlan,revisionSchedule,validQuestion,createQuiz,validQuiz,quizResult,mistakes,searchAll,calendarItems,monthGrid,dailyMinutes,deleteHubItem};
