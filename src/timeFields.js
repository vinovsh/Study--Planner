const {validDate, validTime} = require('./model');
function timeLabel(value) {
  if (!validTime(value)) return 'Choose time';
  const [h,m] = value.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2,'0')} ${h>=12?'PM':'AM'}`;
}
function durationLabel(value) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 5 || n > 240) return 'Choose duration';
  return `${n>=60?`${Math.floor(n/60)} hr`:''}${n>=60&&n%60?' ':''}${n%60?`${n%60} min`:''}`;
}
function dateLabel(value) {
  if (!validDate(value)) return 'Choose date';
  return new Date(value+'T12:00:00').toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric',year:'numeric'});
}
const validDuration = value => Number.isInteger(value) && value>=5 && value<=240;
module.exports = {timeLabel,durationLabel,dateLabel,validDuration};
