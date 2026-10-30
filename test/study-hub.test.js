const test=require('node:test');
const assert=require('node:assert/strict');
const m=require('../src/model');
const h=require('../src/studyHubModel');
const p=require('../src/planning');
const chapter=(id,subjectId='bio',extra={})=>({id,title:id,subjectId,status:'Not started',minutes:30,...extra});
const question=(id='q')=>({id,subjectId:'bio',prompt:'Which answer is correct?',options:['One','Two','Three','Four'],correct:1,explanation:'Two is correct.'});
function fixture(){const d=m.initialState();d.sessions=[];d.tasks=[];d.exams=[{id:'exam',subjectId:'bio',subjectIds:['bio','math'],title:'Finals',date:'2030-01-14'}];d.chapters=[chapter('a'),chapter('b'),chapter('c','math'),chapter('d','math')];return d;}
test('legacy planner gets study-tool defaults without changing saved records',()=>{
  const old=m.initialState();for(const key of h.EXTRAS)delete old[key];delete old.settings.dailyGoal;delete old.settings.studyDays;
  const data=m.validateBackup(JSON.parse(JSON.stringify(old)));
  assert.deepEqual(data.sessions,old.sessions);assert.equal(data.settings.dailyGoal,120);assert.deepEqual(data.questions,[]);
});
test('daily chapter plan spreads subjects and paces to the exam instead of cramming all chapters',()=>{
  const data=fixture();const plan=h.dailyPlan(data,'2030-01-07');
  assert.equal(plan.chapters.length,2);assert.equal(new Set(plan.chapters.map(c=>c.subjectId)).size,2);assert.ok(plan.minutes<=120);
  data.chapters[0].status='Completed';assert.ok(!h.dailyPlan(data,'2030-01-07').chapters.some(c=>c.id==='a'));
  data.settings.studyDays=[2];assert.equal(h.dailyPlan(data,'2030-01-07').restDay,true);
});
test('oversized chapters are explicitly reported and daily targets are never exceeded',()=>{
  const data=fixture();data.settings.dailyGoal=20;
  const plan=h.dailyPlan(data,'2030-01-07');assert.equal(plan.chapters.length,0);assert.equal(plan.oversized,4);
});
test('revision schedule respects capacity, weekdays, existing sessions and the exam boundary',()=>{
  const data=fixture();data.settings.studyDays=[1,3,5];data.settings.dailyGoal=60;data.settings.studyStart='17:00';
  data.sessions=[{id:'busy',subjectId:'bio',title:'Class',date:'2030-01-07',time:'17:00',duration:30,done:false}];
  const r=h.revisionSchedule(data,data.exams[0],'2030-01-07',new Date('2030-01-07T00:00:00').getTime());
  assert.equal(r.unallocated,0);assert.equal(r.sessions.length,4);assert.ok(new Set(r.sessions.map(s=>s.date)).size>1);
  assert.ok(r.sessions.every(s=>s.date<'2030-01-14'&&[1,3,5].includes(new Date(s.date+'T12:00:00').getDay())));
  for(const s of r.sessions)assert.equal(p.hasSessionConflict([...data.sessions,...r.sessions.filter(x=>x.id!==s.id)],[s]),false);
  for(const date of new Set(r.sessions.map(s=>s.date)))assert.ok([...r.sessions,...data.sessions].filter(s=>s.date===date).reduce((n,s)=>n+s.duration,0)<=60);
  const again=h.revisionSchedule({...data,sessions:[...data.sessions,...r.sessions]},data.exams[0],'2030-01-07',0);assert.equal(again.sessions.length,0);
});
test('revision preview reports insufficient capacity rather than scheduling after the exam',()=>{
  const data=fixture();data.exams[0].date='2030-01-08';data.settings.dailyGoal=30;
  const r=h.revisionSchedule(data,data.exams[0],'2030-01-07',0);assert.equal(r.sessions.length,1);assert.equal(r.unallocated,3);
  assert.throws(()=>h.revisionSchedule(data,{...data.exams[0],date:'2030-01-07'},'2030-01-07',0));
});
test('question validation rejects ambiguous or empty answer choices',()=>{
  assert.ok(h.validQuestion(question()));
  assert.equal(h.validQuestion({...question(),options:['One',' one ','Three','Four']}),false);
  assert.equal(h.validQuestion({...question(),correct:4}),false);
});
test('mock exams snapshot questions, save answers and score unanswered questions as incorrect',()=>{
  const q=question();const quiz=h.createQuiz([q],{mode:'mock',minutes:10,count:20},1000,()=>.5);
  assert.equal(quiz.questions.length,1);assert.equal(quiz.endsAt,601000);q.options[1]='Changed later';assert.equal(quiz.questions[0].options[1],'Two');
  assert.equal(h.quizResult(quiz).correct,0);quiz.answers[0]=1;assert.equal(h.quizResult(quiz).correct,1);
  assert.throws(()=>h.createQuiz([]));assert.throws(()=>h.createQuiz([question()],{count:0}));
});
test('running tests survive local reload and are excluded from portable restore',()=>{
  const data=fixture();data.activeQuiz=h.createQuiz([question()],{mode:'mock',count:1});data.activeQuiz.answers[0]=1;
  const restored=m.hydratePlanner(JSON.parse(JSON.stringify(data)));assert.equal(restored.activeQuiz.answers[0],1);
  assert.equal(m.validateBackup(data).activeQuiz,null);
  assert.equal(m.hydratePlanner({...data,activeQuiz:{...data.activeQuiz,index:99}}).activeQuiz,null);
});
test('new study material, exam subjects, grades and historical answers round trip through backup',()=>{
  const data=fixture();data.questions=[question()];data.formulas=[{id:'f',subjectId:'bio',chapterId:'a',title:'A fact',body:'A useful fact'}];data.grades=[{id:'g',subjectId:'bio',title:'Quiz',score:8,total:10,date:'2030-01-07'}];
  const quiz=h.createQuiz(data.questions,{count:1});data.attempts=[h.quizResult(quiz)];
  const restored=m.validateBackup(JSON.parse(JSON.stringify(data)));assert.deepEqual(restored.attempts,data.attempts);assert.deepEqual(restored.chapters,data.chapters);
  assert.throws(()=>m.validateBackup({...data,grades:[{...data.grades[0],score:11}]}));
  assert.throws(()=>m.validateBackup({...data,questions:[{...question(),chapterId:'missing'}]}));
  assert.throws(()=>m.validateBackup({...data,exams:[{...data.exams[0],subjectIds:['bio','missing']}]}));
  assert.throws(()=>m.validateBackup({...data,settings:{...data.settings,studyDays:[]}}));
});
test('subject deletion preserves shared exams and historical tests but removes linked learning material',()=>{
  const data=fixture();data.questions=[question()];data.attempts=[h.quizResult(h.createQuiz(data.questions,{count:1}))];
  const next=h.deleteHubItem(data,'subjects',data.subjects.find(s=>s.id==='bio'));
  assert.deepEqual(next.exams[0].subjectIds,['math']);assert.equal(next.questions.length,0);assert.equal(next.attempts.length,1);assert.ok(next.chapters.every(c=>c.subjectId!=='bio'));assert.doesNotThrow(()=>m.validateBackup(next));
});
test('deleting a chapter detaches live material and deleting exams removes stale target links',()=>{
  const data=fixture();data.questions=[{...question(),chapterId:'a'}];data.chapters[0].examId='exam';
  const next=h.deleteHubItem(data,'chapters',data.chapters[0]);assert.equal(next.questions[0].chapterId,'');
  const removed=h.deleteHubItem(data,'exams',data.exams[0]);assert.equal(removed.chapters[0].examId,'');assert.doesNotThrow(()=>m.validateBackup(removed));
});
test('global search includes note bodies, subject names and question explanations',()=>{
  const data=fixture();data.questions=[question()];data.notes=[{id:'n',subjectId:'bio',title:'Notes',body:'Mitochondria make ATP'}];
  assert.equal(h.searchAll(data,'  atp  ')[0].key,'notes');assert.ok(h.searchAll(data,'biology').some(r=>r.key==='chapters'));assert.ok(h.searchAll(data,'Two is correct').some(r=>r.key==='questions'));assert.deepEqual(h.searchAll(data,'  '),[]);
});
test('calendar uses complete Monday-first weeks across leap years and combines deadlines',()=>{
  const grid=h.monthGrid(new Date(2028,1,15));assert.equal(grid.length,42);assert.ok(grid.some(d=>d.date==='2028-02-29'&&d.inMonth));assert.equal(new Date(grid[0].date+'T12:00:00').getDay(),1);
  const data=fixture();data.tasks=[{id:'task',title:'Essay',due:'2030-01-14',done:false}];assert.deepEqual(h.calendarItems(data,'2030-01-14').map(r=>r.kind),['task','exam']);
});
test('daily nudges have stable IDs, clock times and opt-out semantics',()=>{
  const data=fixture();data.settings={...data.settings,reminders:true,dailyReminder:true,nightlyRecap:true,morningTime:'07:30',recapTime:'20:45'};
  const records=p.reminderRecords(data);assert.deepEqual(records.filter(r=>r.daily).map(r=>[r.id,r.hour,r.minute]),[['daily-plan',7,30],['daily-recap',20,45]]);
  data.settings.reminders=false;assert.deepEqual(p.reminderRecords(data),[]);
});
test('accent buttons maintain at least 4.5:1 contrast for their white text',()=>{
  for(const color of Object.values(h.ACCENTS)){
    const rgb=[1,3,5].map(i=>parseInt(color.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
    const luminance=rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;
    assert.ok(1.05/(luminance+.05)>=4.5,`${color} needs more contrast`);
  }
});
