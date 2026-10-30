const {dateKey, validDate, validTime, uid} = require('./model');

function shiftDate(date, days) {
  if (!validDate(date)) throw new Error('Choose a valid date.');
  const value = new Date(`${date}T12:00:00`);
  value.setDate(value.getDate() + days);
  const result=dateKey(value);
  if(!Number.isInteger(days)||!validDate(result))throw new Error('Choose a date within the supported calendar.');
  return result;
}

// A bounded batch of independent sessions: editing one never changes the others.
function repeatSessions(session, weeks, weekdays) {
  if (!Number.isInteger(weeks) || weeks < 1 || weeks > 12 || !Array.isArray(weekdays) || !weekdays.length || weekdays.some(d=>!Number.isInteger(d)||d<0||d>6)) throw new Error('Choose days and 1–12 weeks.');
  const days = new Set(weekdays);
  const result = [];
  for (let i=0; i<weeks*7; i++) {
    const date = shiftDate(session.date, i);
    if (days.has(new Date(`${date}T12:00:00`).getDay())) result.push({...session, id:uid(), date, done:false});
  }
  return result;
}

function hasSessionConflict(existing, additions, editedId=null) {
  const seen=existing.filter(s=>s.id!==editedId);
  const start=s=>new Date(`${s.date}T${s.time}:00`).getTime();
  for(const item of additions){
    const from=start(item),until=from+item.duration*60000;
    if(seen.some(s=>from<start(s)+s.duration*60000&&until>start(s)))return true;
    seen.push(item);
  }
  return false;
}

function taskProgress(task) {
  const steps = task.steps || [];
  return {done:steps.filter(s=>s.done).length, total:steps.length};
}
function completeTask(task) {
  const done = !task.done;
  return {...task, done, steps:(task.steps||[]).map(step=>({...step,done}))};
}
function toggleStep(task, id) {
  const steps=(task.steps||[]).map(step=>step.id===id?{...step,done:!step.done}:step);
  return {...task,steps,done:steps.length>0&&steps.every(step=>step.done)};
}

function filterTasks(tasks, {query='', status='open', subjectId=''}={}, today=dateKey()) {
  const search=query.trim().toLocaleLowerCase();
  const priority={High:0,Medium:1,Low:2};
  return tasks.filter(t=>(!subjectId||t.subjectId===subjectId)&&(!search||`${t.title} ${(t.steps||[]).map(s=>s.title).join(' ')}`.toLocaleLowerCase().includes(search))&&(status==='all'||status==='done'&&t.done||status==='open'&&!t.done||status==='overdue'&&!t.done&&t.due<today))
    .sort((a,b)=>Number(a.done)-Number(b.done)||a.due.localeCompare(b.due)||priority[a.priority]-priority[b.priority]);
}

function upcomingDeadlines(data, today=dateKey()) {
  const end=shiftDate(today,7);
  return [...data.tasks.filter(t=>!t.done&&t.due<=end).map(t=>({...t,kind:'task',deadline:t.due})),...data.exams.filter(e=>e.date>=today&&e.date<=end).map(e=>({...e,kind:'exam',deadline:e.date}))]
    .sort((a,b)=>a.deadline.localeCompare(b.deadline)||a.title.localeCompare(b.title));
}

function reminderRecords(data, now=Date.now()) {
  if (!data.settings.reminders) return [];
  const records=[];
  const add=(id,title,body,time)=>{if(Number.isFinite(time)&&time>now)records.push({id,title,body,time});};
  const subject=id=>data.subjects.find(s=>s.id===id)?.name||'Study';
  data.sessions.filter(s=>!s.done).forEach(s=>add(s.id,`Time for ${subject(s.subjectId)}`,s.title,new Date(`${s.date}T${s.time}:00`).getTime()));
  for(const [key,kind] of [['tasks','Assignment'],['exams','Exam']]) {
    data[key].filter(x=>!x.done&&Number.isInteger(x.remindDays)).forEach(x=>{
      const date=key==='tasks'?x.due:x.date;
      if(validTime(x.reminderTime)) add(`${key}:${x.id}`,`${kind}: ${x.title}`,`${subject(x.subjectId)} · ${key==='tasks'?'Due':'Exam'} ${date}`,new Date(`${shiftDate(date,-x.remindDays)}T${x.reminderTime}:00`).getTime());
    });
  }
  if(data.timer?.running)add('focus','Study Bloom',data.timer.mode==='focus'?'Your focus session is complete. Time for a break!':'Your break is over.',data.timer.endsAt);
  return records;
}
module.exports={shiftDate,repeatSessions,hasSessionConflict,taskProgress,completeTask,toggleStep,filterTasks,upcomingDeadlines,reminderRecords};
