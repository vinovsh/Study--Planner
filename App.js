import React, {useEffect, useRef, useState} from 'react';
import {View, Text, ScrollView, Pressable, StyleSheet, SafeAreaView, StatusBar, Modal, TextInput, Alert, AppState, Switch, NativeModules, PermissionsAndroid, Platform, Vibration, KeyboardAvoidingView, Image, Keyboard} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, {Circle} from 'react-native-svg';
import {Icon, CatGarden} from './src/art';
import {SubjectAppearanceFields, SubjectAppearancePopup} from './src/SubjectAppearance';
import BloomHero, {BOOKWORM} from './src/BloomHero';
import StudyHub,{StudyToolsMenu,DailyStudyCard,StudyPreferences,SyllabusProgress,HubButton} from './src/StudyHub';
const {ACCENTS,examSubjects,deleteHubItem}=require('./src/studyHubModel');
import {RepeatFields,ReminderFields,TaskSteps,TaskFilters} from './src/PlanningFields';
const {repeatSessions,hasSessionConflict,taskProgress,completeTask,toggleStep,filterTasks,upcomingDeadlines,reminderRecords}=require('./src/planning');
const {dateLabel,timeLabel,durationLabel,validDuration} = require('./src/timeFields');
const {COLORS, uid, dateKey, validDate, validTime, initialState, reviewCard, weekDates, remainingSeconds, streak, validateBackup, hydratePlanner} = require('./src/model');
const KEY = 'study-bloom-v1';
const Native = NativeModules.BloomDevice;
const light = {bg:'#FFF9F0', card:'#FFFCF7', ink:'#35274D', muted:'#8B8196', line:'#EDE5DA', purple:'#A18AD4', pale:'#EAE0F8', green:'#91B77B'};
const dark = {bg:'#211D2A', card:'#302938', ink:'#F8EEF9', muted:'#C0AFCE', line:'#4A3E55', purple:'#B39BEB', pale:'#453854', green:'#A1C587'};
let saveQueue = Promise.resolve();
export default function App() {
  const [data,setData] = useState(null), [error,setError] = useState(''), [tab,setTab] = useState('home'), [page,setPage] = useState(null);
  const [selected,setSelected] = useState(dateKey()), [anchor,setAnchor] = useState(new Date()), [form,setForm] = useState(null), [draft,setDraft] = useState({});
  const [seconds,setSeconds] = useState(0), [focusSubject,setFocusSubject] = useState('bio'), [revealed,setRevealed] = useState(false), [cardSubject,setCardSubject] = useState('bio');
  const [focusChapter,setFocusChapter]=useState('');
  const [celebration,setCelebration] = useState(0);
  const [appearance,setAppearance] = useState(null);
  const [calendarDay,setCalendarDay]=useState(dateKey());
  const [repeat,setRepeat]=useState({enabled:false,weeks:4,days:[]});
  const [taskFilter,setTaskFilter]=useState({query:'',status:'open',subjectId:''});
  const reminderQueue=useRef(Promise.resolve()), syncedReminders=useRef(null);
  const changeAppearance=(key,value)=>setDraft(d=>({...d,[key]:value}));
  const [noteOpen,setNoteOpen] = useState(null), [toast,setToast] = useState('');
  const current = useRef(null), ready = useRef(false), toastTimer = useRef(null), finishGuard = useRef(null);
  const base = data?.settings.dark ? dark : light;
  const c = {...base,purple:ACCENTS[data?.settings.accent]||base.purple};
  const goStudy=id=>{if(id==='home'){setPage(null);setTab('home');}else setPage(id);};
  const focusOn=(subjectId,chapterId='')=>{if(current.current?.timer){say('Finish or reset the active timer before starting a chapter.');return;}setFocusSubject(subjectId);setFocusChapter(chapterId);setPage(null);setTab('focus');};
  const say = text => {setToast(text); clearTimeout(toastTimer.current); toastTimer.current = setTimeout(()=>setToast(''),3500);};
  useEffect(()=>()=>clearTimeout(toastTimer.current),[]);
  async function load() {
    setError('');
    try {
      const raw = await AsyncStorage.getItem(KEY);
      const state = raw ? hydratePlanner(JSON.parse(raw)) : initialState();
      current.current = state; ready.current = true; setData(state);
      setFocusSubject(state.subjects[0]?.id || ''); setCardSubject(state.subjects[0]?.id || '');
    } catch (e) {setError('Your saved planner could not be loaded. Retry before making changes.');}
  }
  useEffect(()=>{load();},[]);
  function update(fn) {
    if (!ready.current) return;
    const next = typeof fn === 'function' ? fn(current.current) : fn;
    current.current = next; setData(next);
    saveQueue = saveQueue.catch(()=>{}).then(()=>AsyncStorage.setItem(KEY,JSON.stringify(next))).catch(()=>say('Could not save. Please check device storage.'));
  }
  const subject = id => data?.subjects.find(x=>x.id===id) || {name:'Archived subject',color:COLORS[3],icon:'book'};
  const today = calendarDay;
  const sessions = data?.sessions.filter(s=>s.date===today).sort((a,b)=>a.time.localeCompare(b.time)) || [];
  function finishTimer(timer) {
    if (!timer || finishGuard.current === timer.id || current.current?.timer?.id !== timer.id) return;
    finishGuard.current = timer.id;
    update(d=>({...d,timer:null,logs:timer.mode==='focus'?[...d.logs,{id:uid(),subjectId:timer.subjectId,chapterId:timer.chapterId||'',date:dateKey(new Date(timer.endsAt)),minutes:timer.total/60}]:d.logs}));
    Vibration.vibrate(400);
    Alert.alert(timer.mode==='focus'?'You bloomed a little!':'Break is over',timer.mode==='focus'?'Your focus time is saved. Take a gentle break.':'Ready for another little step?', timer.mode==='focus'?[{text:'Done'},{text:'Start break',onPress:()=>startTimer('break')}]:[{text:'Lovely'}]);
  }
  useEffect(()=>{
    const tick = ()=>{setCalendarDay(dateKey());const timer=current.current?.timer; setSeconds(timer ? remainingSeconds(timer) : (current.current?.settings.focus||25)*60); if(timer?.running && remainingSeconds(timer)===0) finishTimer(timer);};
    tick(); const interval=setInterval(tick,1000); const listener=AppState.addEventListener('change',s=>{if(s==='active')tick();});
    return ()=>{clearInterval(interval);listener.remove();};
  },[]);
  useEffect(()=>{
    if(!data)return;
    const records=reminderRecords(data);
    reminderQueue.current=reminderQueue.current.catch(()=>{}).then(async()=>{
      try {
        const days={};
        const summary=date=>days[date]||(days[date]={minutes:0,sessions:0,chapters:0});
        data.logs.forEach(log=>{summary(log.date).minutes+=Math.round(log.minutes);});
        data.sessions.filter(s=>s.done).forEach(s=>{summary(s.date).sessions++;});
        data.chapters.filter(ch=>ch.completedOn).forEach(ch=>{summary(ch.completedOn).chapters++;});
        if(data.timer?.running&&data.timer.mode==='focus')days._timer={endsAt:data.timer.endsAt,minutes:data.timer.total/60};
        await Native?.setStudySummary?.(JSON.stringify(days));
        if(syncedReminders.current===null){await Native?.cancelAllReminders();syncedReminders.current=new Map();}
        const previous=syncedReminders.current;
        const next=new Map(records.map(r=>[r.id,JSON.stringify(r)]));
        for(const [id] of previous)if(!next.has(id)){await Native?.cancelReminder(id);previous.delete(id);}
        for(const r of records)if(previous.get(r.id)!==next.get(r.id)){
          if(r.daily)await Native?.scheduleDailyReminder(r.id,r.title,r.body,r.hour,r.minute);
          else await Native?.scheduleReminder(r.id,r.title,r.body,r.time);
          previous.set(r.id,next.get(r.id));
        }
      } catch {say('Some reminders could not be scheduled. Toggle Local reminders in Settings to retry.');syncedReminders.current=null;}
    });
  },[data]);
  async function enableReminders(value) {
    if(value && Platform.OS==='android' && Platform.Version>=33) {
      const result=await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
      if(result!==PermissionsAndroid.RESULTS.GRANTED){say('Allow notifications in Android settings to receive reminders.');return;}
    }
    update(d=>({...d,settings:{...d.settings,reminders:value}}));
    if(!value)return;
    say('Reminders enabled. Android may deliver them a little late in battery saver.');
  }
  function startTimer(mode='focus') {
    const latest=current.current;
    if(mode==='focus' && !latest.subjects.length){say('Add a subject first.');return;}
    const total=latest.settings[mode==='focus'?'focus':'break']*60;
    const timer={id:uid(),mode,total,remaining:total,running:true,endsAt:Date.now()+total*1000,subjectId:latest.subjects.some(s=>s.id===focusSubject)?focusSubject:latest.subjects[0]?.id,chapterId:latest.chapters.some(ch=>ch.id===focusChapter&&ch.subjectId===focusSubject)?focusChapter:''};
    finishGuard.current=null;update(d=>({...d,timer}));setSeconds(total);
  }
  function toggleTimer() {
    if(!data.timer){startTimer();return;}
    const timer=data.timer;
    if(timer.running){update(d=>({...d,timer:{...timer,running:false,remaining:remainingSeconds(timer)}}));}
    else {const next={...timer,running:true,endsAt:Date.now()+timer.remaining*1000};update(d=>({...d,timer:next}));}
  }
  async function chooseDate() {
    Keyboard.dismiss();
    const key=form==='task'?'due':'date';
    try {const value=await Native.pickDate(draft[key]||today);if(value&&validDate(value))setDraft(d=>({...d,[key]:value}));}
    catch {Alert.alert('Date picker','Could not open the calendar. Please try again.');}
  }
  async function chooseTime() {
    Keyboard.dismiss();
    try {const value=await Native.pickTime(draft.time||'09:00');if(value&&validTime(value))setDraft(d=>({...d,time:value}));}
    catch {Alert.alert('Clock picker','Could not open the clock. Please try again.');}
  }
  async function chooseDuration() {
    Keyboard.dismiss();
    try {
      const value=await Native.pickDuration(Number(draft.duration)||30);
      if(value===null)return;
      if(!validDuration(value)){Alert.alert('Study duration','Choose a duration from 5 minutes to 4 hours.');return;}
      setDraft(d=>({...d,duration:value}));
    } catch {Alert.alert('Duration picker','Could not open the clock. Please try again.');}
  }
  function openForm(type,item=null) {
    setRepeat({enabled:false,weeks:4,days:[new Date(`${item?.date||selected}T12:00:00`).getDay()]});
    setAppearance(null);setForm(type);setDraft(item ? {...item} : {subjectId:data.subjects[0]?.id||'',date:selected,due:today,time:'09:00',duration:'30',color:COLORS[0],icon:'leaf',priority:'Medium',title:'',name:'',question:'',answer:'',body:''});
  }
  function saveForm() {
    const x={...draft,id:draft.id||uid()};
    if(form==='subject') {
      if(!x.name?.trim()){say('Give your subject a name.');return;}
      x.name=x.name.trim();
    } else {
      if(!data.subjects.some(s=>s.id===x.subjectId)){say('Add a subject first.');return;}
      if(form==='card' && (!x.question?.trim() || !x.answer?.trim())){say('Add a question and an answer.');return;}
      if(form!=='card' && !x.title?.trim()){say('Add a title.');return;}
    }
    if(form==='session') {
      x.duration=Number(x.duration);
      if(!validDate(x.date)||!validTime(x.time)||!Number.isFinite(x.duration)||x.duration<5||x.duration>240){say('Use a valid date, 24-hour time, and 5–240 minutes.');return;}
      x.done=x.done||false;
    }
    if(form==='task' && !validDate(x.due)){say('Use a valid due date: YYYY-MM-DD.');return;}
    if(form==='task') x.done=x.done||false;
    if(form==='task') {
      x.steps=(x.steps||[]).map(step=>({...step,title:step.title.trim()}));
      if(x.steps.some(step=>!step.title)){say('Give each checklist step a title or remove the empty step.');return;}
      if(x.steps.length)x.done=x.steps.every(step=>step.done);
    }
    if(form==='exam'){x.subjectIds=Array.from(new Set([x.subjectId,...(x.subjectIds||[])])).filter(id=>data.subjects.some(sub=>sub.id===id));}
    if(form==='exam' && !validDate(x.date)){say('Use a valid exam date: YYYY-MM-DD.');return;}
    if(['task','exam'].includes(form)&&Number.isInteger(x.remindDays)) {
      if(![0,1,3,7].includes(x.remindDays)||!validTime(x.reminderTime)){say('Choose a valid reminder time.');return;}
      // Old reminders may be in the past when editing an overdue item; only new or changed alerts must be future-dated.
      const before=(form==='task'?data.tasks:data.exams).find(v=>v.id===x.id);
      const date=form==='task'?x.due:x.date;
      const oldDate=before&&(form==='task'?before.due:before.date);
      const changed=!before||before.remindDays!==x.remindDays||before.reminderTime!==x.reminderTime||oldDate!==date;
      const at=new Date(`${date}T${x.reminderTime}:00`);at.setDate(at.getDate()-x.remindDays);
      if(changed&&at.getTime()<=Date.now()){say('This reminder is in the past. Choose a later time or turn it off.');return;}
    }
    if(form==='card'){x.interval=x.interval||0;x.due=x.due||today;}
    const key={subject:'subjects',session:'sessions',task:'tasks',card:'cards',note:'notes',exam:'exams'}[form];
    let additions=[x];
    if(form==='session'&&!draft.id&&repeat.enabled){
      try{additions=repeatSessions(x,repeat.weeks,repeat.days);}catch(e){say(e.message);return;}
    }
    if(!draft.id&&data[key].length+additions.length>10000){say('Planner limit reached. Remove older items before adding more.');return;}
    const commit=()=>{
      update(d=>({...d,[key]:draft.id?d[key].map(v=>v.id===x.id?x:v):[...d[key],...additions]}));
      setForm(null);say(additions.length>1?`${additions.length} study sessions saved`:draft.id?'Changes saved':'A little plan, saved');
    };
    if(form==='session'&&hasSessionConflict(data.sessions,additions,draft.id)) {
      Alert.alert('Study sessions overlap','At least one session overlaps another planned session. Adjust the time or keep both.',[{text:'Adjust time',style:'cancel'},{text:'Keep both',onPress:commit}]);return;
    }
    commit();
  }
  function remove(type,item) {
    Alert.alert(`Delete ${type}?`,type==='subject'?'Its sessions, tasks and study materials will be removed. Shared exams and saved study history are kept.':'This item will be removed.',[{text:'Cancel',style:'cancel'},{text:'Delete',style:'destructive',onPress:()=>{
      const key={subject:'subjects',session:'sessions',task:'tasks',card:'cards',note:'notes',exam:'exams'}[type];
      update(d=>deleteHubItem(d,key,item));
      setForm(null);setNoteOpen(null);
    }}]);
  }
  function toggleSession(item) {
    if(!item.done)setCelebration(n=>n+1);
    update(d=>({...d,sessions:d.sessions.map(s=>s.id===item.id?{...s,done:!s.done}:s)}));
  }
  const titleStyle=[s.title,{color:c.ink}], muted=[s.muted,{color:c.muted}];
  const cardStyle=[s.card,{backgroundColor:c.card,borderColor:c.line}];
  function Button({label,onPress,secondary=false,icon,small=false,disabled=false}) {
    return <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress} style={({pressed})=>[s.button,{backgroundColor:secondary?c.pale:c.purple,opacity:disabled?.4:pressed?.75:1},small&&s.smallButton]}>{icon&&<Icon name={icon} size={19} color={secondary?c.ink:'#fff'}/>}<Text style={[s.buttonText,{color:secondary?c.ink:'#fff'}]}>{label}</Text></Pressable>;
  }
  function Heading({title,subtitle,action}) {
    return <View style={s.heading}><View style={{flex:1}}><Text style={titleStyle}>{title}</Text>{subtitle&&<Text style={[muted,{marginTop:5}]}>{subtitle}</Text>}</View>{action}</View>;
  }
  function Bar({value,color=c.green}) {return <View style={[s.bar,{backgroundColor:c.line}]}><View style={{height:'100%',width:`${Math.min(100,Math.max(0,value))}%`,backgroundColor:color,borderRadius:8}}/></View>;}
  function Empty({text,action}) {return <View style={[cardStyle,{alignItems:'center',paddingVertical:30}]}><Icon name="leaf" color={c.green} size={32}/><Text style={[muted,{textAlign:'center',marginVertical:12}]}>{text}</Text>{action}</View>;}
  function SubjectChip({item,active,onPress}) {return <Pressable accessibilityRole="button" onPress={onPress} style={[s.chip,{backgroundColor:active?c.purple:c.card,borderColor:active?c.purple:c.line}]}><Icon name={item.icon} size={17} color={active?'#fff':c.green}/><Text style={{color:active?'#fff':c.ink,fontWeight:'600'}}>{item.name}</Text></Pressable>;}
  function SubjectPicker({value,onChange}) {return <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:8,paddingVertical:8}}>{data.subjects.map(item=><SubjectChip key={item.id} item={item} active={value===item.id} onPress={()=>onChange(item.id)}/>)}</ScrollView>;}
  function SessionRow({item}) {
    const sub=subject(item.subjectId);
    return <View style={[s.sessionRow,{borderColor:c.line}]}><View style={[s.subjectIcon,{backgroundColor:sub.color}]}><Icon name={sub.icon} color="#7D8B65"/></View><Pressable style={{flex:1}} accessibilityLabel={`Edit ${item.title}`} onPress={()=>openForm('session',item)}><Text style={[s.bodyBold,{color:c.ink,textDecorationLine:item.done?'line-through':'none'}]}>{sub.name}</Text><Text style={[muted,{fontSize:12}]}>{timeLabel(item.time)} · {durationLabel(item.duration)}</Text></Pressable><Pressable accessibilityRole="checkbox" accessibilityLabel={`Complete ${item.title}`} accessibilityState={{checked:item.done}} onPress={()=>toggleSession(item)} style={[s.checkbox,{borderColor:item.done?c.green:c.muted,backgroundColor:item.done?c.green:'transparent'}]}>{item.done&&<Icon name="check" size={16} color="#fff"/>}</Pressable></View>;
  }
  if(!data) return <SafeAreaView style={[s.safe,{backgroundColor:light.bg}]}><View style={s.loading}><Image source={BOOKWORM} style={{width:210,height:210}} resizeMode="contain"/><Text style={[s.title,{color:light.ink}]}>Study Bloom</Text><Text style={[s.muted,{marginVertical:20}]}>{error||'A little space for your big dreams…'}</Text>{error&&<Button label="Retry" onPress={load}/>}</View></SafeAreaView>;
  const completed=sessions.filter(x=>x.done).length;
  const activePage=page||tab;
  const minutes=data.logs.reduce((n,l)=>n+l.minutes,0);
  const dates=weekDates(anchor);
  const weekLogs=data.logs.filter(l=>dates.some(d=>dateKey(d)===l.date));
  const weekMinutes=weekLogs.reduce((n,l)=>n+l.minutes,0);
  const cards=data.cards.filter(x=>x.subjectId===cardSubject && x.due<=today);
  const activeCard=cards[0];
  const deadlines=upcomingDeadlines(data,today);
  const visibleTasks=filterTasks(data.tasks,taskFilter,today);
  const timer=data.timer;
  const timerTotal=timer?.total || data.settings.focus*60;
  async function backup() {try{await saveQueue;await Native.exportBackup(JSON.stringify({...current.current,timer:null,activeQuiz:null}));say('Backup saved');}catch(e){if(e.code!=='CANCELLED')say('Backup could not be saved.');}}
  async function restore() {
    try{const raw=await Native.importBackup();const next=validateBackup(JSON.parse(raw));Alert.alert('Restore backup?','This replaces your current planner. Export a backup first if you want to keep it.',[{text:'Cancel',style:'cancel'},{text:'Restore',onPress:()=>{syncedReminders.current=null;update(next);setFocusSubject(next.subjects[0]?.id||'');setCardSubject(next.subjects[0]?.id||'');setNoteOpen(null);setFocusChapter('');setTaskFilter({query:'',status:'open',subjectId:''});say('Backup restored. Your enabled reminders are rescheduled.');}}]);}catch(e){if(e.code!=='CANCELLED')say('That file is not a valid Study Bloom backup.');}
  }
  return <SafeAreaView style={[s.safe,{backgroundColor:c.bg}]}>
    <StatusBar barStyle={data.settings.dark?'light-content':'dark-content'} backgroundColor={c.bg}/>
    {activePage!=='home'&&<View style={s.top}><Pressable accessibilityLabel={page?'Back':'Study Bloom'} onPress={()=>setPage(null)} style={s.brand}>{page?<Icon name="back" color={c.ink}/>:<Text style={{fontSize:22}}>🌼</Text>}<Text style={[s.brandText,{color:c.ink}]}>{page?{subjects:'My subjects',cards:'Flashcards',notes:'My notes',exams:'Exam garden',settings:'Settings',chapters:'Chapter plan',practice:'Practice',mock:'Mock exams',formulas:'Formulas & facts',calendar:'Calendar',search:'Search',grades:'Grades',guide:'Guide'}[page]:'Study Bloom'}</Text></Pressable><Pressable accessibilityLabel="Open settings" onPress={()=>setPage('settings')} style={s.iconButton}><Icon name="settings" color={c.muted}/></Pressable></View>}
    <ScrollView key={activePage} keyboardShouldPersistTaps="handled" contentContainerStyle={[s.content,activePage==='home'&&{paddingTop:18}]} showsVerticalScrollIndicator={false}>
    {activePage==='home'&&<>
      <View style={[s.heading,{gap:7,marginBottom:8}]}><View style={{flex:1}}><Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={.8} style={[titleStyle,{fontSize:23}]}>Hi, {data.settings.name}!</Text><Text style={[muted,{marginTop:6,fontSize:14}]}>{new Date().toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'})}</Text></View><View style={[s.offline,{backgroundColor:'#E6F1DC',paddingHorizontal:8}]}><View style={s.dot}/><Text style={{fontSize:10,color:'#577247'}}>Offline ready</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Open settings" onPress={()=>setPage('settings')} style={{width:34,height:44,alignItems:'center',justifyContent:'center'}}><Icon name="settings" color={c.ink} size={23}/></Pressable></View>
      <BloomHero celebration={celebration} dark={data.settings.dark} onFocus={()=>{setPage(null);setTab('focus');}} onPet={()=>say('Your study buddy is cheering you on ♡')}/>
      <View accessibilityLabel="Today’s progress" style={[cardStyle,{padding:15}]}><View style={[s.row,{gap:15}]}><View style={{width:74,height:74,alignItems:'center',justifyContent:'center'}}><Svg style={StyleSheet.absoluteFill} width={74} height={74}><Circle cx={37} cy={37} r={31} fill="none" stroke={c.pale} strokeWidth={8}/><Circle cx={37} cy={37} r={31} fill="none" stroke={c.green} strokeWidth={8} strokeDasharray={`${(sessions.length?completed/sessions.length:0)*195} 195`} rotation={-90} origin="37,37" strokeLinecap="round"/></Svg><Text style={[s.bodyBold,{color:c.ink,fontSize:22}]}>{completed}/{sessions.length}</Text></View><View style={{flex:1,gap:11}}><Text style={[s.bodyBold,{color:c.ink,fontSize:16}]}>{completed} of {sessions.length} sessions done</Text><Bar value={sessions.length?completed/sessions.length*100:0}/><Text style={[muted,{fontSize:12}]}>You’re doing great!</Text></View></View></View>
      <Heading title="Today’s plan" action={<Pressable onPress={()=>{setSelected(today);setTab('planner');}}><Text style={{color:c.purple,fontWeight:'600'}}>See all ›</Text></Pressable>}/>
      <View style={[cardStyle,{paddingHorizontal:13,paddingVertical:6}]}>{sessions.length?sessions.map(item=><SessionRow key={item.id} item={item}/>):<Text style={[muted,{padding:15}]}>A fresh page. Plan a little study time.</Text>}<Button secondary label="Add study session" icon="plus" onPress={()=>{setSelected(today);openForm('session');setDraft(d=>({...d,date:today}));}}/></View>
      <DailyStudyCard data={data} c={c} onNavigate={goStudy} onFocus={focusOn} onUpdate={update}/>
      <Heading title="Deadlines & revision" subtitle="Overdue work and the next 7 days"/>
      <View style={cardStyle}>{deadlines.length?deadlines.slice(0,5).map(item=><Pressable key={`${item.kind}:${item.id}`} accessibilityRole="button" onPress={()=>openForm(item.kind,item)} style={{paddingVertical:12,borderBottomWidth:.5,borderColor:c.line}}><Text style={[s.bodyBold,{color:c.ink}]}>{item.kind==='exam'?'📚 Exam · ':''}{item.title}</Text><Text style={[muted,{marginTop:5,color:item.deadline<today?'#C57B86':c.muted}]}>{subject(item.subjectId).name} · {item.deadline<today?'Overdue · ':item.deadline===today?'Today · ':''}{dateLabel(item.deadline)}</Text></Pressable>):<Text style={muted}>No deadlines coming up. Keep taking small steps.</Text>}{deadlines.length>5&&<Text style={[muted,{marginTop:10}]}>{deadlines.length-5} more deadlines in Planner and Exams</Text>}<Button secondary small label="View assignments" onPress={()=>{setPage(null);setTab('planner');setTaskFilter({query:'',status:'open',subjectId:''});}}/></View>
      <View style={s.quickGrid}>{[['subjects','book','Subjects'],['cards','cards','Flashcards'],['notes','note','Notes'],['exams','calendar','Exams']].map(([id,icon,label])=><Pressable key={id} accessibilityRole="button" onPress={()=>setPage(id)} style={[s.quickCard,{backgroundColor:c.card,borderColor:c.line}]}><View style={[s.subjectIcon,{backgroundColor:c.pale}]}><Icon name={icon} color={c.purple}/></View><Text style={[s.bodyBold,{color:c.ink}]}>{label}</Text><Icon name="chevron" size={16} color={c.muted}/></Pressable>)}</View>
    </>}
    {activePage==='home'&&<StudyToolsMenu c={c} onNavigate={goStudy}/>}
    {['chapters','practice','mock','formulas','calendar','search','grades','guide'].includes(activePage)&&<StudyHub key={activePage} page={activePage} data={data} update={update} c={c} onEdit={openForm} onFocus={focusOn} onNavigate={goStudy}/>}
    {activePage==='planner'&&<>
      <Heading title="Your week 🌱" subtitle="Small steps, brighter days" action={<Button small label="Add" icon="plus" onPress={()=>openForm('session')}/>}/>
      <View style={[s.row,{justifyContent:'space-between',marginBottom:12}]}><Pressable accessibilityLabel="Previous week" style={s.iconButton} onPress={()=>{const d=new Date(anchor);d.setDate(d.getDate()-7);setAnchor(d);setSelected(dateKey(d));}}><Icon name="back" color={c.ink}/></Pressable><Text style={[s.bodyBold,{color:c.ink}]}>{dates[0].toLocaleDateString('en-US',{month:'short',day:'numeric'})} – {dates[6].toLocaleDateString('en-US',{month:'short',day:'numeric'})}</Text><Pressable accessibilityLabel="Next week" style={s.iconButton} onPress={()=>{const d=new Date(anchor);d.setDate(d.getDate()+7);setAnchor(d);setSelected(dateKey(d));}}><Icon name="chevron" color={c.ink}/></Pressable></View>
      <View style={[s.row,{gap:5,marginBottom:20}]}>{dates.map(d=><Pressable key={dateKey(d)} accessibilityLabel={`Select ${dateKey(d)}`} onPress={()=>setSelected(dateKey(d))} style={[s.day,{backgroundColor:selected===dateKey(d)?c.purple:c.card,borderColor:c.line}]}><Text style={{fontSize:11,color:selected===dateKey(d)?'#fff':c.muted}}>{d.toLocaleDateString('en-US',{weekday:'short'})}</Text><Text style={{fontSize:17,fontWeight:'700',marginTop:5,color:selected===dateKey(d)?'#fff':c.ink}}>{d.getDate()}</Text>{dateKey(d)===today&&<View style={[s.dot,{backgroundColor:selected===dateKey(d)?'#fff':c.green,marginTop:5}]}/>}</Pressable>)}</View>
      {data.sessions.filter(x=>x.date===selected).sort((a,b)=>a.time.localeCompare(b.time)).map(item=><View key={item.id} style={[s.row,{alignItems:'flex-start',marginBottom:14}]}><Text style={[muted,{width:44,paddingTop:18}]}>{item.time}</Text><View style={[s.planCard,{backgroundColor:subject(item.subjectId).color}]}><View style={s.row}><View style={{flex:1}}><Text style={[s.bodyBold,{color:'#35274D'}]}>{subject(item.subjectId).name}</Text><Text style={{color:'#655873',fontSize:12,marginTop:4}}>{item.title} · {item.duration} min</Text></View><Pressable accessibilityLabel="Edit session" style={s.iconButton} onPress={()=>openForm('session',item)}><Text style={{color:'#655873',fontSize:24}}>···</Text></Pressable></View><Pressable onPress={()=>toggleSession(item)} style={{alignSelf:'flex-start',marginTop:10,padding:6}}><Text style={{color:'#655873',fontSize:12}}>{item.done?'✓ Completed':'○ Mark complete'}</Text></Pressable></View></View>)}
      {!data.sessions.some(x=>x.date===selected)&&<Empty text="Your day has room to bloom." action={<Button label="Plan a session" small onPress={()=>openForm('session')}/>}/>}
      <Heading title="Assignments" action={<Button small label="Add assignment" icon="plus" onPress={()=>openForm('task')}/>}/>
      <TaskFilters value={taskFilter} onChange={setTaskFilter} subjects={data.subjects} c={c}/>
      {visibleTasks.length?<View style={cardStyle}>{visibleTasks.map(t=>{const progress=taskProgress(t);return <View key={t.id} style={{paddingVertical:12,borderBottomWidth:.5,borderColor:c.line}}><View style={s.row}><Pressable accessibilityRole="checkbox" accessibilityState={{checked:t.done}} accessibilityLabel={`Complete ${t.title}`} onPress={()=>{if(!t.done)setCelebration(n=>n+1);update(d=>({...d,tasks:d.tasks.map(x=>x.id===t.id?completeTask(x):x)}));}} style={[s.iconButton,{borderRadius:12,backgroundColor:t.done?c.green:c.pale}]}><Text style={{color:c.ink}}>{t.done?'✓':'○'}</Text></Pressable><Pressable style={{flex:1,minHeight:44,justifyContent:'center'}} onPress={()=>openForm('task',t)}><Text style={[s.bodyBold,{color:c.ink,textDecorationLine:t.done?'line-through':'none'}]}>{t.title}</Text><Text style={[muted,{fontSize:12,marginTop:5,color:!t.done&&t.due<today?'#C57B86':c.muted}]}>{subject(t.subjectId).name} · {t.due} · {t.priority}{!t.done&&t.due<today?' · Overdue':''}</Text></Pressable></View>{progress.total>0&&<View style={{marginTop:12}}><Text style={[muted,{marginBottom:8}]}>{progress.done} of {progress.total} steps done</Text><Bar value={progress.done/progress.total*100}/>{(t.steps||[]).map(step=><Pressable key={step.id} accessibilityRole="checkbox" accessibilityState={{checked:step.done}} accessibilityLabel={step.title} onPress={()=>update(d=>({...d,tasks:d.tasks.map(x=>x.id===t.id?toggleStep(x,step.id):x)}))} style={{minHeight:44,flexDirection:'row',alignItems:'center',gap:10}}><Text style={{color:c.green,fontSize:20}}>{step.done?'✓':'○'}</Text><Text style={{flex:1,color:c.ink,textDecorationLine:step.done?'line-through':'none'}}>{step.title}</Text></Pressable>)}</View>}</View>;})}</View>:<Empty text={data.tasks.length?"No assignments match these filters.":"No assignments yet."}/>}

    </>}
    {activePage==='subjects'&&<>
      <Heading title="My subjects 🌸" subtitle="A little garden of things to learn"/>
      {data.subjects.map(sub=>{const tasks=data.tasks.filter(t=>t.subjectId===sub.id);const done=tasks.filter(t=>t.done).length;return <View key={sub.id} style={cardStyle}><Pressable onPress={()=>openForm('subject',sub)} style={[s.row,{padding:12,borderRadius:14,backgroundColor:sub.color,marginBottom:8}]}><Icon name={sub.icon} color="#7D8B65"/><View style={{flex:1}}><Text style={[s.bodyBold,{color:'#35274D'}]}>{sub.name}</Text><Text style={{fontSize:11,color:'#655873',marginVertical:5}}>{done} / {tasks.length} tasks</Text><Bar value={tasks.length?done/tasks.length*100:0}/></View><Icon name="chevron" color="#655873" size={18}/></Pressable>{tasks.map(t=><Pressable key={t.id} onPress={()=>openForm('task',t)} style={[s.row,{paddingVertical:9}]}><View style={[s.checkbox,{borderColor:c.green,backgroundColor:t.done?c.green:'transparent'}]}>{t.done&&<Icon name="check" size={16} color="#fff"/>}</View><Text style={[muted,{color:c.ink}]}>{t.title}</Text></Pressable>)}<Pressable onPress={()=>{openForm('task');setDraft(d=>({...d,subjectId:sub.id}));}} style={{paddingVertical:10}}><Text style={{color:c.purple,fontWeight:'600'}}>+ Add task</Text></Pressable></View>;})}
      <Button label="Add a subject" icon="plus" onPress={()=>openForm('subject')}/>
    </>}
    {activePage==='focus'&&<>
      <Heading title={timer?.mode==='break'?'A gentle little break ☕':'Time to bloom 🌸'} subtitle="Focus now, brighter tomorrow ♡"/>
      <View style={{alignItems:'center',marginVertical:20}}><View style={{width:270,height:270,alignItems:'center',justifyContent:'center'}}><Svg width={270} height={270} style={StyleSheet.absoluteFill}><Circle cx={135} cy={135} r={122} fill="none" stroke={c.pale} strokeWidth={12}/><Circle cx={135} cy={135} r={122} fill="none" stroke={c.purple} strokeWidth={12} strokeDasharray={`${seconds/timerTotal*767} 767`} rotation={-90} origin="135,135" strokeLinecap="round"/></Svg><Text style={{fontSize:54,color:c.ink,fontWeight:'700',fontVariant:['tabular-nums']}}>{String(Math.floor(seconds/60)).padStart(2,'0')}:{String(seconds%60).padStart(2,'0')}</Text><Image source={BOOKWORM} style={{width:105,height:100}} resizeMode="contain"/></View></View>
      <SubjectPicker value={timer?.subjectId||focusSubject} onChange={id=>{if(timer)say('Finish or reset your current timer to change subjects.');else {setFocusSubject(id);setFocusChapter('');}}}/>
      {(timer?.chapterId||focusChapter)&&<Text style={[muted,{textAlign:'center',marginBottom:12}]}>Chapter: {data.chapters.find(ch=>ch.id===(timer?.chapterId||focusChapter))?.title||'Archived chapter'}</Text>}
      <Button label={!timer?'▶ Start focus':timer.running?'Ⅱ Pause':'▶ Resume'} onPress={toggleTimer}/>
      {timer&&<Button secondary label="Reset timer" onPress={()=>Alert.alert('Reset timer?','This unfinished session will not be counted.',[{text:'Keep going'},{text:'Reset',onPress:()=>{update(d=>({...d,timer:null}));}}])}/>}
      <View style={s.row}><View style={[cardStyle,{flex:1}]}><Text style={muted}>Pomodoro</Text><Text style={[s.bodyBold,{color:c.ink,marginTop:8}]}>{data.settings.focus} min</Text></View><View style={[cardStyle,{flex:1}]}><Text style={muted}>Short break</Text><Text style={[s.bodyBold,{color:c.ink,marginTop:8}]}>{data.settings.break} min</Text></View></View>
      <Pressable onPress={()=>setPage('settings')} style={{alignSelf:'center',padding:12}}><Text style={{color:c.purple}}>Customize your timer ›</Text></Pressable>
    </>}
    {activePage==='cards'&&<>
      <Heading title="Little lessons 🌸" subtitle="Small facts, big progress ♡" action={<Button small label="Add" icon="plus" onPress={()=>openForm('card')}/>}/>
      <SubjectPicker value={cardSubject} onChange={id=>{setCardSubject(id);setRevealed(false);}}/>
      {activeCard?<><Text style={[muted,{textAlign:'center',marginVertical:12}]}>{cards.length} cards ready to review</Text><Pressable accessibilityRole="button" accessibilityLabel="Flip flashcard" onPress={()=>setRevealed(!revealed)} onLongPress={()=>openForm('card',activeCard)} style={[s.flashcard,{backgroundColor:revealed?'#DFF0CF':'#FFDDE4'}]}><Text style={{fontSize:30}}>🌷</Text><Text style={{fontSize:23,lineHeight:33,fontWeight:'700',textAlign:'center',color:'#4F3A72',marginVertical:24}}>{revealed?activeCard.answer:activeCard.question}</Text><Text style={{color:'#796489',fontSize:12}}>{revealed?'Tap to see question':'Tap to reveal · Hold to edit'}</Text></Pressable><View style={s.row}><View style={{flex:1}}><Button secondary disabled={!revealed} label="↻ Again" onPress={()=>{update(d=>({...d,cards:[...d.cards.filter(x=>x.id!==activeCard.id),reviewCard(activeCard,false)]}));setRevealed(false);}}/></View><View style={{flex:1}}><Button disabled={!revealed} label="✓ Got it" onPress={()=>{update(d=>({...d,cards:d.cards.map(x=>x.id===activeCard.id?reviewCard(x,true):x)}));setRevealed(false);}}/></View></View></>:<Empty text="You’re all caught up! Cards return when it’s time to review."/>}
      <Heading title="Your cards"/>{data.cards.filter(x=>x.subjectId===cardSubject).map(x=><Pressable key={x.id} onPress={()=>openForm('card',x)} style={cardStyle}><Text style={[s.bodyBold,{color:c.ink}]}>{x.question}</Text><Text style={[muted,{marginTop:6}]}>Next review: {x.due} ›</Text></Pressable>)}
    </>}
    {activePage==='notes'&&<>
      <Heading title="Thoughts & little notes" subtitle="Keep your learning close" action={<Button small label="Add" icon="plus" onPress={()=>openForm('note')}/>}/>
      {data.notes.length?data.notes.map(n=><Pressable key={n.id} style={cardStyle} onPress={()=>setNoteOpen(n)}><Text style={[s.bodyBold,{color:c.ink}]}>{n.title}</Text><Text style={[muted,{marginVertical:6}]}>{subject(n.subjectId).name}</Text><Text style={{color:c.ink,lineHeight:22}} numberOfLines={3}>{n.body}</Text></Pressable>):<Empty text="A cozy home for your study notes."/>}
    </>}
    {activePage==='exams'&&<>
      <Heading title="Exam garden 🌱" subtitle="Prepare a little, worry a little less" action={<Button small label="Add" icon="plus" onPress={()=>openForm('exam')}/>}/>
      {data.exams.length?[...data.exams].sort((a,b)=>a.date.localeCompare(b.date)).map(e=>{const days=Math.round((new Date(e.date+'T12:00:00')-new Date(today+'T12:00:00'))/86400000);return <View key={e.id} style={cardStyle}><Pressable onPress={()=>openForm('exam',e)}><Text style={[s.bodyBold,{color:c.ink,fontSize:18}]}>{e.title}</Text><Text style={[muted,{marginTop:6}]}>{examSubjects(e).map(id=>subject(id).name).join(', ')} · {e.date}</Text></Pressable><View style={[s.offline,{backgroundColor:c.pale,alignSelf:'flex-start',marginVertical:16}]}><Text style={{color:c.ink,fontWeight:'700'}}>{days<0?'Exam completed':days===0?'Today — you’ve got this!':`${days} days to grow`}</Text></View>{days>=0&&<HubButton c={c} secondary label="Open chapter revision planner" onPress={()=>goStudy('chapters')}/>} {days>=0&&<Button secondary small label="Plan revision" onPress={()=>{openForm('session');setDraft(d=>({...d,subjectId:e.subjectId,title:`Revise for ${e.title}`,date:today}));}}/>}</View>;}):<Empty text="Add an exam and make room for revision."/>}
    </>}
    {activePage==='progress'&&<>
      <SyllabusProgress data={data} c={c}/>
      <Heading title="Look how you grew! 🌷" subtitle="Consistency creates amazing things ♡"/>
      <View style={[cardStyle,{backgroundColor:data.settings.dark?c.card:'#FFECDD'}]}><View style={s.row}><Text style={{fontSize:34}}>🔥</Text><View style={{flex:1}}><Text style={[s.bodyBold,{color:c.ink,fontSize:19}]}>{streak(data.logs)} day streak</Text><Text style={[muted,{marginTop:5}]}>Keep going, you’re blooming!</Text></View></View></View>
      <View style={cardStyle}><Heading title="Weekly study hours" subtitle="Focus timer sessions" action={<Text style={[s.bodyBold,{color:c.ink}]}>{(weekMinutes/60).toFixed(1)}h</Text>}/><View style={[s.row,{justifyContent:'space-between'}]}><Pressable onPress={()=>{const d=new Date(anchor);d.setDate(d.getDate()-7);setAnchor(d);}} style={s.iconButton}><Icon name="back" color={c.muted}/></Pressable><Text style={muted}>{dates[0].toLocaleDateString('en-US',{month:'short',day:'numeric'})} – {dates[6].getDate()}</Text><Pressable onPress={()=>{const d=new Date(anchor);d.setDate(d.getDate()+7);setAnchor(d);}} style={s.iconButton}><Icon name="chevron" color={c.muted}/></Pressable></View><View style={[s.row,{alignItems:'flex-end',height:160,gap:9,marginTop:12}]}>{dates.map((d,i)=>{const n=weekLogs.filter(l=>l.date===dateKey(d)).reduce((a,l)=>a+l.minutes,0);const max=Math.max(60,...dates.map(dt=>weekLogs.filter(l=>l.date===dateKey(dt)).reduce((a,l)=>a+l.minutes,0)));return <View key={i} style={{flex:1,alignItems:'center'}}><Text style={[muted,{fontSize:10,marginBottom:8}]}>{(n/60).toFixed(1)}h</Text><View style={{width:'100%',height:Math.max(4,n/max*100),backgroundColor:COLORS[i%5],borderRadius:6}}/><Text style={[muted,{fontSize:10,marginTop:8}]}>{d.toLocaleDateString('en-US',{weekday:'short'})}</Text></View>;})}</View></View>
      <View style={cardStyle}><Text style={[s.bodyBold,{color:c.ink,marginBottom:12}]}>Weekly goal · {data.settings.goal} hours</Text><Bar value={weekMinutes/(data.settings.goal*60)*100}/><Text style={[muted,{marginTop:10}]}>{Math.min(100,Math.round(weekMinutes/(data.settings.goal*60)*100))}% grown this week</Text></View>
      <View style={cardStyle}><Text style={[s.bodyBold,{color:c.ink,marginBottom:14}]}>Subject breakdown</Text>{data.subjects.map(sub=>{const n=data.logs.filter(l=>l.subjectId===sub.id).reduce((a,l)=>a+l.minutes,0);return <View key={sub.id} style={[s.row,{marginVertical:9}]}><Icon name={sub.icon} color={c.green}/><Text style={[muted,{flex:1,color:c.ink}]}>{sub.name}</Text><Text style={[s.bodyBold,{color:c.ink}]}>{(n/60).toFixed(1)}h</Text></View>;})}</View>
      <View style={cardStyle}><Text style={[s.bodyBold,{color:c.ink,marginBottom:12}]}>Little milestones</Text>{[[data.tasks.filter(t=>t.done).length>=10,'🌱','Completed 10 tasks'],[minutes>=600,'⭐','Studied 10 hours'],[streak(data.logs)>=7,'💗','7 day streak']].map(([achieved,emoji,label])=><Text key={label} style={[muted,{paddingVertical:7,opacity:achieved?1:.6}]}>{emoji} {label} {achieved?'✓':'· Keep growing'}</Text>)}</View><Text style={[muted,{textAlign:'center',marginVertical:10}]}>🌿 Saved on this device</Text>
    </>}
    {activePage==='settings'&&<>
      <Heading title="Make it yours" subtitle="Your planner, your pace"/>
      <View style={cardStyle}><Text style={[s.label,{color:c.ink}]}>Your name</Text><TextInput accessibilityLabel="Your name" value={data.settings.name} maxLength={40} onChangeText={name=>update(d=>({...d,settings:{...d.settings,name}}))} style={[s.input,{color:c.ink,backgroundColor:c.bg,borderColor:c.line}]}/><View style={[s.row,{justifyContent:'space-between',marginTop:16}]}><Text style={[s.bodyBold,{color:c.ink}]}>Moonlight mode</Text><Switch accessibilityLabel="Moonlight mode" value={data.settings.dark} onValueChange={darkMode=>update(d=>({...d,settings:{...d.settings,dark:darkMode}}))} trackColor={{false:c.line,true:c.purple}}/></View><View style={[s.row,{justifyContent:'space-between',marginTop:16}]}><Text style={[s.bodyBold,{color:c.ink}]}>Local reminders</Text><Switch accessibilityLabel="Local reminders" value={!!data.settings.reminders} onValueChange={enableReminders} trackColor={{false:c.line,true:c.purple}}/></View><Text style={[muted,{fontSize:12,marginTop:6}]}>Session, assignment, exam and timer alerts. No internet needed.</Text></View>
      <View style={cardStyle}>{[['focus','Focus minutes',5,180,5],['break','Break minutes',1,60,1],['goal','Weekly goal (hours)',1,100,1]].map(([key,label,min,max,step])=><View key={key} style={[s.row,{justifyContent:'space-between',paddingVertical:10}]}><Text style={[muted,{color:c.ink,flex:1}]}>{label}</Text><Pressable accessibilityLabel={`Decrease ${label}`} style={[s.stepper,{backgroundColor:c.pale}]} onPress={()=>update(d=>({...d,settings:{...d.settings,[key]:Math.max(min,d.settings[key]-step)}}))}><Text style={{color:c.ink,fontSize:23}}>−</Text></Pressable><Text style={[s.bodyBold,{color:c.ink,width:32,textAlign:'center'}]}>{data.settings[key]}</Text><Pressable accessibilityLabel={`Increase ${label}`} style={[s.stepper,{backgroundColor:c.pale}]} onPress={()=>update(d=>({...d,settings:{...d.settings,[key]:Math.min(max,d.settings[key]+step)}}))}><Text style={{color:c.ink,fontSize:23}}>+</Text></Pressable></View>)}</View>
      <View style={cardStyle}><Text style={[s.bodyBold,{color:c.ink,marginBottom:12}]}>Keep a little backup</Text><Text style={[muted,{lineHeight:21,marginBottom:15}]}>Everything lives on this device. Save a backup file before uninstalling or changing phones.</Text><Button label="Export backup" icon="download" onPress={backup}/><Button secondary label="Restore backup" onPress={restore}/></View>
      <StudyPreferences data={data} update={update} c={c} onNavigate={goStudy}/>
      <Text style={[muted,{textAlign:'center',lineHeight:22}]}>Study Bloom · 1.5.0{"\n"}No accounts. No ads. Always offline. ♡</Text>
    </>}
    </ScrollView>
    <View style={[s.nav,{backgroundColor:c.card,borderColor:c.line}]}>{[['home','home','Home'],['planner','calendar','Planner'],['focus','timer','Focus'],['progress','chart','Progress']].map(([id,icon,label])=><Pressable key={id} accessibilityRole="tab" accessibilityLabel={label} accessibilityState={{selected:!page&&tab===id}} onPress={()=>{setPage(null);setTab(id);}} style={s.navItem}><View style={[s.navIcon,{backgroundColor:!page&&tab===id?c.pale:'transparent'}]}><Icon name={icon} color={!page&&tab===id?c.purple:c.muted}/></View>{data.settings.tabLabels&&<Text style={{fontSize:11,marginTop:4,color:!page&&tab===id?c.purple:c.muted,fontWeight:!page&&tab===id?'700':'400'}}>{label}</Text>}</Pressable>)}</View>
    <Modal visible={!!form} animationType="slide" transparent onRequestClose={()=>appearance?setAppearance(null):setForm(null)}><KeyboardAvoidingView behavior={Platform.OS==='ios'?'padding':undefined} style={s.modalOverlay}><View accessibilityElementsHidden={!!appearance} importantForAccessibility={appearance?'no-hide-descendants':'auto'} style={[s.sheet,{backgroundColor:c.bg}]}><View style={s.heading}><Text style={[titleStyle,{flex:1}]}>{draft.id?'Edit':'New'} {form}</Text><Pressable accessibilityLabel="Close editor" style={s.iconButton} onPress={()=>setForm(null)}><Icon name="close" color={c.ink}/></Pressable></View><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{paddingBottom:20}}>
      {form!=='subject'&&<><Text style={[s.label,{color:c.ink}]}>Subject</Text><SubjectPicker value={draft.subjectId} onChange={id=>setDraft(d=>({...d,subjectId:id}))}/>{!data.subjects.length&&<Text style={muted}>Create a subject from Home → Subjects first.</Text>}</>}
      {(form==='subject'?[['name','Subject name','e.g. Biology']]:form==='card'?[['question','Question','What would you like to remember?'],['answer','Answer','Write the answer…']]:[['title','Title',form==='session'?'e.g. Revise Chapter 4':'Give it a name…']]).map(([key,label,placeholder])=><View key={key}><Text style={[s.label,{color:c.ink}]}>{label}</Text><TextInput accessibilityLabel={label} placeholder={placeholder} placeholderTextColor={c.muted} value={draft[key]||''} onChangeText={text=>setDraft(d=>({...d,[key]:text}))} maxLength={key==='answer'?10000:200} multiline={key==='answer'} style={[s.input,{color:c.ink,backgroundColor:c.card,borderColor:c.line},key==='answer'&&{minHeight:110,textAlignVertical:'top'}]}/></View>)}
      {form==='exam'&&<><Text style={[s.label,{color:c.ink}]}>Additional subjects in this exam</Text><View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>{data.subjects.filter(sub=>sub.id!==draft.subjectId).map(sub=><Pressable key={sub.id} accessibilityRole="checkbox" accessibilityState={{checked:(draft.subjectIds||[]).includes(sub.id)}} accessibilityLabel={`Include ${sub.name} in exam`} onPress={()=>setDraft(d=>({...d,subjectIds:(d.subjectIds||[]).includes(sub.id)?d.subjectIds.filter(id=>id!==sub.id):[...(d.subjectIds||[]),sub.id]}))} style={[s.chip,{minHeight:44,backgroundColor:(draft.subjectIds||[]).includes(sub.id)?c.purple:c.card,borderColor:c.line}]}><Text style={{color:(draft.subjectIds||[]).includes(sub.id)?'#fff':c.ink}}>{sub.name}</Text></Pressable>)}</View></>}
      {form==='subject'&&<SubjectAppearanceFields draft={draft} onChange={changeAppearance} onMore={type=>{Keyboard.dismiss();setAppearance(type);}} c={c}/>}
      {['session','exam','task'].includes(form)&&<><Text style={[s.label,{color:c.ink}]}>{form==='task'?'Due date':'Date'}</Text><Pressable accessibilityRole="button" accessibilityLabel="Choose date" onPress={chooseDate} style={({pressed})=>[s.input,s.row,{justifyContent:'space-between',backgroundColor:pressed?c.pale:c.card,borderColor:c.line}]}><Text style={{color:c.ink,fontSize:15}}>{dateLabel(form==='task'?draft.due:draft.date)}</Text><Icon name="calendar" color={c.purple}/></Pressable></>}
      {form==='session'&&<><Text style={[s.label,{color:c.ink}]}>Time &amp; length</Text><View style={[s.row,{gap:10}]}><Pressable accessibilityRole="button" accessibilityLabel="Choose start time" onPress={chooseTime} style={({pressed})=>[s.input,{flex:1,backgroundColor:pressed?c.pale:c.card,borderColor:c.line}]}><View style={[s.row,{gap:6}]}><Icon name="timer" color={c.purple} size={18}/><Text style={[muted,{fontSize:11}]}>Start time</Text></View><Text style={[s.bodyBold,{color:c.ink,marginTop:7}]}>{timeLabel(draft.time)}</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel="Choose duration" onPress={chooseDuration} style={({pressed})=>[s.input,{flex:1,backgroundColor:pressed?c.pale:c.card,borderColor:c.line}]}><Text style={[muted,{fontSize:11}]}>Hours &amp; minutes</Text><Text style={[s.bodyBold,{color:c.ink,marginTop:10}]}>{durationLabel(draft.duration)}</Text></Pressable></View></>}
      {form==='session'&&!draft.id&&<RepeatFields date={draft.date} value={repeat} onChange={setRepeat} c={c}/>}
      {['task','exam'].includes(form)&&<ReminderFields draft={draft} onChange={changes=>setDraft(d=>({...d,...changes}))} onTime={async()=>{Keyboard.dismiss();try{const time=await Native.pickTime(draft.reminderTime||'09:00');if(time&&validTime(time))setDraft(d=>({...d,reminderTime:time}));}catch{say('Could not open the reminder clock.');}}} c={c}/>}
      {form==='task'&&<TaskSteps steps={draft.steps||[]} onChange={steps=>setDraft(d=>({...d,steps,done:steps.length?steps.every(step=>step.done):d.done}))} c={c}/>}
      {form==='task'&&<><Text style={[s.label,{color:c.ink}]}>Priority</Text><View style={s.row}>{['Low','Medium','High'].map(priority=><Pressable key={priority} onPress={()=>setDraft(d=>({...d,priority}))} style={[s.chip,{backgroundColor:draft.priority===priority?c.purple:c.card,borderColor:c.line}]}><Text style={{color:draft.priority===priority?'#fff':c.ink}}>{priority}</Text></Pressable>)}</View></>}
      {form==='note'&&<><Text style={[s.label,{color:c.ink}]}>Note</Text><TextInput accessibilityLabel="Note body" multiline value={draft.body||''} onChangeText={body=>setDraft(d=>({...d,body}))} maxLength={20000} placeholder="A thought worth keeping…" placeholderTextColor={c.muted} style={[s.input,{color:c.ink,backgroundColor:c.card,borderColor:c.line,minHeight:200,textAlignVertical:'top'}]}/></>}
      <Button label="Save little plan" icon="check" onPress={saveForm}/>{draft.id&&<Pressable onPress={()=>remove(form,draft)} style={{alignSelf:'center',padding:15}}><Text style={{color:'#C57B86'}}>Delete {form}</Text></Pressable>}
    </ScrollView></View><SubjectAppearancePopup type={appearance} draft={draft} onChange={changeAppearance} onClose={()=>setAppearance(null)} c={c}/></KeyboardAvoidingView></Modal>
    <Modal visible={!!noteOpen} animationType="slide" onRequestClose={()=>setNoteOpen(null)}><SafeAreaView style={[s.safe,{backgroundColor:c.bg}]}><ScrollView contentContainerStyle={s.content}><Heading title={noteOpen?.title} action={<Pressable onPress={()=>setNoteOpen(null)} style={s.iconButton}><Icon name="close" color={c.ink}/></Pressable>}/><Text style={{color:c.ink,lineHeight:26,fontSize:16,marginBottom:25}}>{noteOpen?.body}</Text><Button label="Edit note" onPress={()=>{const n=noteOpen;setNoteOpen(null);openForm('note',n);}}/></ScrollView></SafeAreaView></Modal>
    {!!toast&&<View pointerEvents="none" style={[s.toast,{backgroundColor:c.ink}]}><Text style={{color:c.bg,textAlign:'center',lineHeight:20}}>{toast}</Text></View>}
  </SafeAreaView>;
}
const s=StyleSheet.create({
  safe:{flex:1}, loading:{flex:1,alignItems:'center',justifyContent:'center',padding:30},top:{paddingHorizontal:22,paddingVertical:10,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},brand:{flexDirection:'row',alignItems:'center',gap:9},brandText:{fontSize:17,fontWeight:'800',letterSpacing:.3},content:{padding:22,paddingTop:12,paddingBottom:30},heading:{flexDirection:'row',alignItems:'center',gap:12,marginBottom:17,marginTop:5},title:{fontSize:24,fontWeight:'800',letterSpacing:-.4},muted:{fontSize:13},bodyBold:{fontSize:15,fontWeight:'700'},row:{flexDirection:'row',alignItems:'center',gap:14},card:{borderRadius:22,padding:18,borderWidth:1,marginBottom:16},hero:{borderRadius:23,alignItems:'center',marginBottom:20,paddingBottom:22,overflow:'hidden'},heroText:{fontSize:19,lineHeight:28,fontStyle:'italic',textAlign:'center',letterSpacing:1},offline:{flexDirection:'row',alignItems:'center',gap:6,paddingHorizontal:10,paddingVertical:7,borderRadius:20},dot:{width:6,height:6,borderRadius:3,backgroundColor:'#89AD75'},bar:{height:8,borderRadius:8,overflow:'hidden'},button:{borderRadius:17,minHeight:49,paddingHorizontal:18,paddingVertical:13,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,marginVertical:6},buttonText:{fontSize:15,fontWeight:'700'},smallButton:{minHeight:42,paddingHorizontal:13,paddingVertical:9},subjectIcon:{width:35,height:35,borderRadius:10,alignItems:'center',justifyContent:'center'},sessionRow:{flexDirection:'row',alignItems:'center',gap:11,paddingVertical:13,borderBottomWidth:.5},checkbox:{width:21,height:21,borderWidth:1.3,borderRadius:5,alignItems:'center',justifyContent:'center'},quickGrid:{flexDirection:'row',flexWrap:'wrap',gap:10,marginTop:16},quickCard:{width:'48%',borderWidth:1,borderRadius:17,padding:12,flexDirection:'row',alignItems:'center',gap:7},nav:{flexDirection:'row',borderTopWidth:1,paddingTop:10,paddingBottom:12,paddingHorizontal:14},navItem:{flex:1,alignItems:'center'},navIcon:{paddingHorizontal:18,paddingVertical:6,borderRadius:15},iconButton:{minWidth:44,minHeight:44,alignItems:'center',justifyContent:'center'},day:{flex:1,minHeight:75,paddingVertical:10,alignItems:'center',borderRadius:14,borderWidth:1},planCard:{flex:1,borderRadius:17,padding:13},taskRow:{flexDirection:'row',alignItems:'center',gap:12,paddingVertical:14,borderBottomWidth:.5},chip:{borderWidth:1,borderRadius:16,paddingHorizontal:14,paddingVertical:11,flexDirection:'row',alignItems:'center',gap:7},flashcard:{borderRadius:27,minHeight:300,padding:28,alignItems:'center',justifyContent:'center',marginVertical:16},label:{fontSize:13,fontWeight:'700',marginTop:16,marginBottom:9},input:{borderWidth:1,borderRadius:14,paddingHorizontal:14,paddingVertical:13,fontSize:16,minHeight:48},stepper:{width:34,height:36,borderRadius:10,alignItems:'center',justifyContent:'center'},modalOverlay:{flex:1,justifyContent:'flex-end',backgroundColor:'#241D4260'},sheet:{maxHeight:'92%',padding:22,paddingBottom:5,borderTopLeftRadius:28,borderTopRightRadius:28},toast:{position:'absolute',bottom:95,left:24,right:24,padding:15,borderRadius:16,elevation:6},
});
