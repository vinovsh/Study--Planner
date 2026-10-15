const test=require('node:test');
const assert=require('node:assert/strict');
const {timeLabel,durationLabel,dateLabel,validDuration}=require('../src/timeFields');
test('clock field combines hours and minutes and formats midnight and noon',()=>{
  assert.equal(timeLabel('00:05'),'12:05 AM');
  assert.equal(timeLabel('12:00'),'12:00 PM');
  assert.equal(timeLabel('23:59'),'11:59 PM');
  assert.equal(timeLabel('25:00'),'Choose time');
});
test('duration picker retains minute precision and rejects values outside the supported session length',()=>{
  assert.equal(durationLabel(30),'30 min');assert.equal(durationLabel(60),'1 hr');
  assert.equal(durationLabel(95),'1 hr 35 min');assert.equal(durationLabel(240),'4 hr');
  for(const n of [0,4,241,NaN,5.2])assert.equal(validDuration(n),false);
  for(const n of [5,59,60,240])assert.equal(validDuration(n),true);
});
test('date labels preserve the chosen local calendar day',()=>{
  assert.match(dateLabel('2028-02-29'),/Feb 29, 2028/);
  assert.equal(dateLabel('2026-02-30'),'Choose date');
});
