const {COLORS, SUBJECT_ICONS} = require('./subjectOptions');
const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
function dateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(value + 'T12:00:00');
  return !Number.isNaN(+d) && dateKey(d) === value;
}
const validTime = value => typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
function initialState() {
  const today = dateKey();
  return {version: 1, settings: {name: 'study buddy', goal: 10, focus: 25, break: 5, dark: false},
    subjects: [{id: 'bio', name: 'Biology', color: COLORS[0], icon: 'leaf'}, {id: 'math', name: 'Math', color: COLORS[1], icon: 'calculator'}, {id: 'lit', name: 'Literature', color: COLORS[2], icon: 'book'}],
    sessions: [{id: 's1', subjectId: 'bio', title: 'Read Chapter 4', date: today, time: '09:00', duration: 60, done: false}, {id: 's2', subjectId: 'math', title: 'Practice problems', date: today, time: '11:00', duration: 45, done: false}, {id: 's3', subjectId: 'lit', title: 'Review notes', date: today, time: '14:00', duration: 30, done: false}],
    tasks: [{id: 't1', subjectId: 'bio', title: 'Read Chapter 4', due: today, priority: 'Medium', done: false}, {id: 't2', subjectId: 'math', title: 'Finish worksheet', due: today, priority: 'High', done: false}],
    cards: [{id: 'c1', subjectId: 'bio', question: 'What is photosynthesis?', answer: 'Plants use sunlight to turn water and carbon dioxide into glucose and oxygen.', interval: 0, due: today}, {id: 'c2', subjectId: 'bio', question: 'What is the function of mitochondria?', answer: 'They produce energy (ATP) through cellular respiration.', interval: 0, due: today}],
    notes: [], exams: [], logs: [], timer: null};
}
function reviewCard(card, remembered, today = new Date()) {
  const interval = remembered ? Math.min(180, Math.max(1, card.interval * 2)) : 0;
  const next = new Date(today); next.setDate(next.getDate() + interval);
  return {...card, interval, due: dateKey(next)};
}
function weekDates(anchor = new Date()) {
  const start = new Date(anchor); start.setHours(12, 0, 0, 0); start.setDate(start.getDate() - (start.getDay() + 6) % 7);
  return Array.from({length: 7}, (_, i) => {const d = new Date(start); d.setDate(d.getDate() + i); return d;});
}
function remainingSeconds(timer, now = Date.now()) {
  if (!timer) return 0;
  return timer.running ? Math.max(0, Math.ceil((timer.endsAt - now) / 1000)) : timer.remaining;
}
function streak(logs, today = new Date()) {
  const days = new Set(logs.map(l => l.date));
  const d = new Date(today); let count = 0;
  if (!days.has(dateKey(d))) d.setDate(d.getDate() - 1);
  while (days.has(dateKey(d))) { count++; d.setDate(d.getDate() - 1); }
  return count;
}
function validateBackup(value) {
  const fail = () => {throw new Error('This is not a valid Study Bloom backup.');};
  if (!value || value.version !== 1 || !value.settings || typeof value.settings.name !== 'string' || value.settings.name.length > 100) fail();
  for (const [key, max] of [['goal', 100], ['focus', 180], ['break', 60]]) {
    if (!Number.isFinite(value.settings[key]) || value.settings[key] < 1 || value.settings[key] > max) fail();
  }
  if (typeof value.settings.dark !== 'boolean') fail();
  for (const key of ['subjects', 'sessions', 'tasks', 'cards', 'notes', 'exams', 'logs']) {
    if (!Array.isArray(value[key]) || value[key].length > 10000) fail();
    const ids = new Set();
    for (const item of value[key]) {if (!item || typeof item.id !== 'string' || !item.id || ids.has(item.id)) fail(); ids.add(item.id);}
  }
  const text = v => typeof v === 'string' && v.length <= 20000;
  const subjects = new Set(value.subjects.map(s => s.id));
  for (const s of value.subjects) if (!text(s.name) || !s.name.trim() || !COLORS.includes(s.color) || !SUBJECT_ICONS.some(option=>option.value===s.icon)) fail();
  for (const key of ['sessions', 'tasks', 'cards', 'notes', 'exams']) for (const x of value[key]) {
    if (!subjects.has(x.subjectId)) fail();
    if (['tasks','exams'].includes(key) && x.remindDays !== undefined && x.remindDays !== null && (![0,1,3,7].includes(x.remindDays) || !validTime(x.reminderTime))) fail();
    if (key === 'tasks' && x.steps !== undefined) {
      if (!Array.isArray(x.steps) || x.steps.length > 50) fail();
      const ids = new Set();
      for (const step of x.steps) {
        if (!step || typeof step.id !== 'string' || !step.id || ids.has(step.id) || !text(step.title) || !step.title.trim() || step.title.length > 200 || typeof step.done !== 'boolean') fail();
        ids.add(step.id);
      }
      if (x.steps.length && x.done !== x.steps.every(step=>step.done)) fail();
    }
    if (key === 'sessions' && (!text(x.title) || !validDate(x.date) || !validTime(x.time) || !Number.isFinite(x.duration) || x.duration < 5 || x.duration > 240 || typeof x.done !== 'boolean')) fail();
    if (key === 'tasks' && (!text(x.title) || !validDate(x.due) || !['Low','Medium','High'].includes(x.priority) || typeof x.done !== 'boolean')) fail();
    if (key === 'cards' && (!text(x.question) || !text(x.answer) || !validDate(x.due) || !Number.isFinite(x.interval) || x.interval < 0 || x.interval > 180)) fail();
    if (key === 'notes' && (!text(x.title) || !text(x.body))) fail();
    if (key === 'exams' && (!text(x.title) || !validDate(x.date))) fail();
  }
  for (const l of value.logs) if (!text(l.subjectId) || !validDate(l.date) || !Number.isFinite(l.minutes) || l.minutes <= 0 || l.minutes > 1440) fail();
  return {...value, timer: null};
}
function hydratePlanner(value) {
  const state=validateBackup(value);
  const timer=value.timer;
  // Portable backups omit active timers; device reloads preserve valid ones.
  if(timer && typeof timer.id==='string' && ['focus','break'].includes(timer.mode) && typeof timer.running==='boolean' && Number.isFinite(timer.total) && timer.total>=60 && timer.total<=10800 && Number.isFinite(timer.remaining) && timer.remaining>=0 && timer.remaining<=timer.total && Number.isFinite(timer.endsAt) && (timer.mode==='break'||state.subjects.some(s=>s.id===timer.subjectId))) state.timer=timer;
  return state;
}
module.exports = {COLORS, uid, dateKey, validDate, validTime, initialState, reviewCard, weekDates, remainingSeconds, streak, validateBackup, hydratePlanner};
