const test=require('node:test');
const assert=require('node:assert/strict');
const m=require('../src/model');
const p=require('../src/planning');
const task=(id,due,extra={})=>({id,subjectId:'bio',title:id,due,priority:'Medium',done:false,...extra});

test('recurring sessions cross years, respect weekdays, and are independent records',()=>{
  const session={id:'old',subjectId:'bio',title:'Read',date:'2026-12-30',time:'09:00',duration:30,done:true};
  const result=p.repeatSessions(session,2,[1,3,3]);
  assert.deepEqual(result.map(s=>s.date),['2026-12-30','2027-01-04','2027-01-06','2027-01-11']);
  assert.equal(new Set(result.map(s=>s.id)).size,4);
  assert.ok(result.every(s=>!s.done&&s.id!=='old'));
  result[0].title='Changed';assert.equal(result[1].title,'Read');assert.equal(session.title,'Read');
});
test('recurrence is bounded and rejects missing or invalid days',()=>{
  const s={date:'2026-10-30'};
  assert.equal(p.repeatSessions(s,12,[0,1,2,3,4,5,6]).length,84);
  for(const [weeks,days] of [[0,[1]],[13,[1]],[2,[]],[2,[7]],[1.5,[1]]])assert.throws(()=>p.repeatSessions(s,weeks,days));
  assert.throws(()=>p.repeatSessions({date:'2026-02-30'},2,[1]));
});
test('session conflicts include overnight overlaps, allow adjacent sessions, and ignore the edited record',()=>{
  const session={id:'a',date:'2026-12-31',time:'23:30',duration:60};
  assert.equal(p.hasSessionConflict([session],[{...session,id:'b',date:'2027-01-01',time:'00:15'}]),true);
  assert.equal(p.hasSessionConflict([session],[{...session,id:'b',date:'2027-01-01',time:'00:30'}]),false);
  assert.equal(p.hasSessionConflict([session],[session],'a'),false);
  assert.equal(p.hasSessionConflict([],[session,{...session,id:'b'}]),true);
});
test('checklist progress and parent completion stay consistent when completing and reopening',()=>{
  let t=task('essay','2026-11-02',{steps:[{id:'a',title:'Read',done:false},{id:'b',title:'Write',done:false}]});
  t=p.toggleStep(t,'a');assert.equal(t.done,false);assert.deepEqual(p.taskProgress(t),{done:1,total:2});
  t=p.toggleStep(t,'b');assert.equal(t.done,true);
  t=p.toggleStep(t,'a');assert.equal(t.done,false);
  t=p.completeTask(t);assert.equal(t.done,true);assert.ok(t.steps.every(s=>s.done));
  t=p.completeTask(t);assert.equal(t.done,false);assert.ok(t.steps.every(s=>!s.done));
  assert.equal(p.completeTask(task('a','2026-11-01')).done,true);
});
test('assignment filters combine status, subject and checklist text without changing stored order',()=>{
  const tasks=[task('low','2026-11-01',{priority:'Low'}),task('high','2026-11-01',{priority:'High'}),task('late','2026-10-29'),task('done','2026-10-29',{done:true}),task('other','2026-10-29',{subjectId:'math'}),task('essay','2026-11-03',{steps:[{id:'s',title:'Read mitochondria',done:false}]})];
  const before=JSON.stringify(tasks);
  assert.deepEqual(p.filterTasks(tasks,{status:'overdue',subjectId:'bio'},'2026-10-30').map(t=>t.id),['late']);
  assert.deepEqual(p.filterTasks(tasks,{query:'  MITOCHONDRIA ',subjectId:'bio'},'2026-10-30').map(t=>t.id),['essay']);
  assert.deepEqual(p.filterTasks(tasks,{status:'done'},'2026-10-30').map(t=>t.id),['done']);
  const open=p.filterTasks(tasks,{},'2026-10-30').map(t=>t.id);assert.ok(open.indexOf('high')<open.indexOf('low'));assert.ok(!open.includes('done'));
  assert.equal(JSON.stringify(tasks),before);
});
test('dashboard includes overdue assignments and next seven days, excluding finished tasks and past exams',()=>{
  const data={tasks:[task('late','2026-10-01'),task('today','2026-10-30'),task('future','2026-11-07'),task('done','2026-10-01',{done:true})],exams:[{id:'past',title:'past',date:'2026-10-29'},{id:'exam',title:'exam',date:'2026-11-06'}]};
  assert.deepEqual(p.upcomingDeadlines(data,'2026-10-30').map(x=>x.id),['late','today','exam']);
});
test('reminders cover sessions, assignments, exams and timers; completion and disabled settings cancel eligibility',()=>{
  const data=m.initialState();const now=new Date('2026-12-31T08:00:00').getTime();
  data.settings.reminders=true;
  data.sessions=[{id:'session',subjectId:'bio',title:'Read',date:'2026-12-31',time:'09:00',duration:30,done:false}];
  data.tasks=[task('essay','2027-01-01',{remindDays:1,reminderTime:'10:00'})];
  data.exams=[{id:'exam',title:'Final',subjectId:'bio',date:'2027-01-03',remindDays:3,reminderTime:'11:00'}];
  data.timer={running:true,mode:'focus',endsAt:now+60000};
  const records=p.reminderRecords(data,now);
  assert.deepEqual(records.map(r=>r.id),['session','tasks:essay','exams:exam','focus']);
  assert.equal(records[1].time,new Date('2026-12-31T10:00:00').getTime());
  data.sessions[0].done=true;data.tasks[0].done=true;data.exams=[];data.timer.running=false;
  assert.deepEqual(p.reminderRecords(data,now),[]);
  data.tasks[0].done=false;data.settings.reminders=false;assert.deepEqual(p.reminderRecords(data,now),[]);
});
test('expired alerts are not scheduled, and date offsets use local calendar days across DST',()=>{
  const data=m.initialState();data.settings.reminders=true;data.sessions=[];data.exams=[];
  data.tasks=[task('essay','2026-03-09',{remindDays:1,reminderTime:'09:00'})];
  assert.equal(p.reminderRecords(data,new Date('2026-03-07T09:00:00').getTime())[0].time,new Date('2026-03-08T09:00:00').getTime());
  assert.equal(p.reminderRecords(data,new Date('2026-03-10T09:00:00').getTime()).length,0);
});
test('legacy backups and new checklists/reminders round trip, invalid new fields are rejected',()=>{
  const data=m.initialState();assert.equal(m.validateBackup(data).version,1);
  data.tasks=[task('a','2026-11-01',{steps:[{id:'step',title:'Read',done:false}],remindDays:1,reminderTime:'09:30'})];
  const roundtrip=m.validateBackup(JSON.parse(JSON.stringify(data)));assert.deepEqual(roundtrip.tasks,data.tasks);
  for(const changes of [{remindDays:2},{reminderTime:'25:00'},{steps:[{id:'s',title:'',done:false}]},{steps:[{id:'s',title:'Read',done:true}]},{steps:[{id:'s',title:'Read',done:false},{id:'s',title:'Read again',done:false}]}])assert.throws(()=>m.validateBackup({...data,tasks:[{...data.tasks[0],...changes}]}));
});
test('local reload preserves a running or paused timer; portable restore strips it; invalid timers are discarded',()=>{
  const data=m.initialState();data.timer={id:'timer',mode:'focus',total:1500,remaining:1200,running:true,endsAt:Date.now()+1200000,subjectId:'bio'};
  assert.deepEqual(m.hydratePlanner(data).timer,data.timer);
  assert.equal(m.validateBackup(data).timer,null);
  assert.equal(m.hydratePlanner({...data,timer:{...data.timer,running:false}}).timer.running,false);
  for(const changes of [{total:-1},{endsAt:NaN},{subjectId:'missing'},{remaining:2000}])assert.equal(m.hydratePlanner({...data,timer:{...data.timer,...changes}}).timer,null);
});
