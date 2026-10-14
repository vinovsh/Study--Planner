const test = require('node:test');
const assert = require('node:assert/strict');
const m = require('../src/model');
test('valid dates and times reject overflow', () => {
  assert.equal(m.validDate('2026-02-30'), false); assert.equal(m.validDate('2028-02-29'), true);
  assert.equal(m.validTime('24:00'), false); assert.equal(m.validTime('09:05'), true);
});
test('spaced repetition crosses month boundary', () => {
  const c = m.reviewCard({interval: 2}, true, new Date(2026, 0, 30, 12));
  assert.equal(c.interval, 4); assert.equal(c.due, '2026-02-03');
  assert.equal(m.reviewCard(c, false, new Date(2026, 0, 30, 12)).due, '2026-01-30');
});
test('week starts Monday even on Sunday', () => {
  const dates = m.weekDates(new Date(2026, 9, 18, 12)).map(m.dateKey);
  assert.equal(dates[0], '2026-10-12'); assert.equal(dates[6], '2026-10-18');
});
test('timer uses deadline so background time is counted', () => {
  assert.equal(m.remainingSeconds({running:true, endsAt:100000}, 75000), 25);
  assert.equal(m.remainingSeconds({running:true, endsAt:100000}, 150000), 0);
  assert.equal(m.remainingSeconds({running:false,remaining:15}, 150000), 15);
});
test('streak preserves yesterday and ignores duplicate sessions', () => {
  assert.equal(m.streak([{date:'2026-10-13'}, {date:'2026-10-13'}, {date:'2026-10-12'}], new Date(2026,9,14,12)), 2);
});
test('backup validates relations and strips timer', () => {
  const state = m.initialState(); assert.equal(m.validateBackup(state).timer, null);
  assert.throws(() => m.validateBackup({...state, sessions:[{...state.sessions[0], subjectId:'missing'}]}));
  assert.throws(() => m.validateBackup({...state, cards:[{...state.cards[0], question:42}]}));
  assert.throws(() => m.validateBackup({...state, settings:{...state.settings,focus:-1}}));
});
