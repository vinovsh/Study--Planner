import React, {useEffect, useRef, useState} from 'react';
import {View, Text, ScrollView, Pressable, StyleSheet, SafeAreaView, StatusBar, Modal, TextInput, Alert, AppState, Switch, NativeModules, PermissionsAndroid, Platform, Vibration, KeyboardAvoidingView} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, {Circle} from 'react-native-svg';
import {Icon, CatGarden} from './src/art';
import BloomHero from './src/BloomHero';
const {COLORS, uid, dateKey, validDate, validTime, initialState, reviewCard, weekDates, remainingSeconds, streak, validateBackup} = require('./src/model');
const KEY = 'study-bloom-v1';
const Native = NativeModules.BloomDevice;
const light = {bg:'#FFF9F0', card:'#FFFCF7', ink:'#35274D', muted:'#8B8196', line:'#EDE5DA', purple:'#A18AD4', pale:'#EAE0F8', green:'#91B77B'};
const dark = {bg:'#211D2A', card:'#302938', ink:'#F8EEF9', muted:'#C0AFCE', line:'#4A3E55', purple:'#B39BEB', pale:'#453854', green:'#A1C587'};
let saveQueue = Promise.resolve();
export default function App() {
  const [data,setData] = useState(null), [error,setError] = useState(''), [tab,setTab] = useState('home'), [page,setPage] = useState(null);
  const [selected,setSelected] = useState(dateKey()), [anchor,setAnchor] = useState(new Date()), [form,setForm] = useState(null), [draft,setDraft] = useState({});
  const [seconds,setSeconds] = useState(0), [focusSubject,setFocusSubject] = useState('bio'), [revealed,setRevealed] = useState(false), [cardSubject,setCardSubject] = useState('bio');
  const [noteOpen,setNoteOpen] = useState(null), [toast,setToast] = useState('');
  const current = useRef(null), ready = useRef(false), toastTimer = useRef(null), finishGuard = useRef(null);
  const c = data?.settings.dark ? dark : light;
  const say = text => {setToast(text); clearTimeout(toastTimer.current); toastTimer.current = setTimeout(()=>setToast(''),3500);};
  useEffect(()=>()=>clearTimeout(toastTimer.current),[]);
  async function load() {
    setError('');
    try {
      const raw = await AsyncStorage.getItem(KEY);
      const state = raw ? JSON.parse(raw) : initialState();
      if (raw) validateBackup(state);
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
  const today = dateKey();
  const sessions = data?.sessions.filter(s=>s.date===today).sort((a,b)=>a.time.localeCompare(b.time)) || [];
  function finishTimer(timer) {
    if (!timer || finishGuard.current === timer.id || current.current?.timer?.id !== timer.id) return;
    finishGuard.current = timer.id;
    update(d=>({...d,timer:null,logs:timer.mode==='focus'?[...d.logs,{id:uid(),subjectId:timer.subjectId,date:dateKey(),minutes:timer.total/60}]:d.logs}));
    Native?.cancelReminder('focus'); Vibration.vibrate(400);
    Alert.alert(timer.mode==='focus'?'You bloomed a little!':'Break is over',timer.mode==='focus'?'Your focus time is saved. Take a gentle break.':'Ready for another little step?', timer.mode==='focus'?[{text:'Done'},{text:'Start break',onPress:()=>startTimer('break')}]:[{text:'Lovely'}]);
  }
  useEffect(()=>{
    const tick = ()=>{const timer=current.current?.timer; setSeconds(timer ? remainingSeconds(timer) : (current.current?.settings.focus||25)*60); if(timer?.running && remainingSeconds(timer)===0) finishTimer(timer);};
    tick(); const interval=setInterval(tick,1000); const listener=AppState.addEventListener('change',s=>{if(s==='active')tick();});
    return ()=>{clearInterval(interval);listener.remove();};
  },[]);
  async function notify(id,title,body,time) {
    if (!current.current?.settings.reminders || time <= Date.now()) return;
    try {await Native?.scheduleReminder(id,title,body,time);} catch {say('Reminder could not be scheduled.');}
  }
  async function enableReminders(value) {
    if(value && Platform.OS==='android' && Platform.Version>=33) {
      const result=await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
      if(result!==PermissionsAndroid.RESULTS.GRANTED){say('Allow notifications in Android settings to receive reminders.');return;}
    }
    update(d=>({...d,settings:{...d.settings,reminders:value}}));
    if(!value){Native?.cancelAllReminders();return;}
    data.sessions.filter(s=>!s.done).forEach(s=>notify(s.id,`Time for ${subject(s.subjectId).name}`,s.title,new Date(`${s.date}T${s.time}:00`).getTime()));
    if(data.timer?.running) notify('focus','Study Bloom',data.timer.mode==='focus'?'Your focus session is complete.':'Your break is over.',data.timer.endsAt);
    say('Reminders enabled. Android may deliver them a little late in battery saver.');
  }
  function startTimer(mode='focus') {
    const latest=current.current;
    if(mode==='focus' && !latest.subjects.length){say('Add a subject first.');return;}
    const total=latest.settings[mode==='focus'?'focus':'break']*60;
    const timer={id:uid(),mode,total,remaining:total,running:true,endsAt:Date.now()+total*1000,subjectId:latest.subjects.some(s=>s.id===focusSubject)?focusSubject:latest.subjects[0]?.id};
    finishGuard.current=null;update(d=>({...d,timer}));setSeconds(total);
    notify('focus','Study Bloom',mode==='focus'?'Your focus session is complete. Time for a break!':'Your break is over.',timer.endsAt);
  }
  function toggleTimer() {
    if(!data.timer){startTimer();return;}
    const timer=data.timer;
    if(timer.running){update(d=>({...d,timer:{...timer,running:false,remaining:remainingSeconds(timer)}}));Native?.cancelReminder('focus');}
    else {const next={...timer,running:true,endsAt:Date.now()+timer.remaining*1000};update(d=>({...d,timer:next}));notify('focus','Study Bloom','Your timer is complete.',next.endsAt);}
  }
  function openForm(type,item=null) {
    setForm(type);setDraft(item ? {...item} : {subjectId:data.subjects[0]?.id||'',date:selected,due:today,time:'09:00',duration:'30',color:COLORS[0],icon:'leaf',priority:'Medium',title:'',name:'',question:'',answer:'',body:''});
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
    if(form==='exam' && !validDate(x.date)){say('Use a valid exam date: YYYY-MM-DD.');return;}
    if(form==='card'){x.interval=x.interval||0;x.due=x.due||today;}
    const key={subject:'subjects',session:'sessions',task:'tasks',card:'cards',note:'notes',exam:'exams'}[form];
    update(d=>({...d,[key]:draft.id?d[key].map(v=>v.id===x.id?x:v):[...d[key],x]}));
    if(form==='session') {Native?.cancelReminder(x.id);if(!x.done)notify(x.id,`Time for ${subject(x.subjectId).name}`,x.title,new Date(`${x.date}T${x.time}:00`).getTime());}
    setForm(null);say(draft.id?'Changes saved':'A little plan, saved');
  }
  function remove(type,item) {
    Alert.alert(`Delete ${type}?`,type==='subject'?'Its sessions, tasks, cards, notes, and exams will also be removed. Study history is kept.':'This item will be removed.',[{text:'Cancel',style:'cancel'},{text:'Delete',style:'destructive',onPress:()=>{
      const key={subject:'subjects',session:'sessions',task:'tasks',card:'cards',note:'notes',exam:'exams'}[type];
      if(type==='subject') {
        data.sessions.filter(s=>s.subjectId===item.id).forEach(s=>Native?.cancelReminder(s.id));
        if(data.timer?.subjectId===item.id){Native?.cancelReminder('focus');}
        update(d=>({...d,subjects:d.subjects.filter(s=>s.id!==item.id),sessions:d.sessions.filter(s=>s.subjectId!==item.id),tasks:d.tasks.filter(s=>s.subjectId!==item.id),cards:d.cards.filter(s=>s.subjectId!==item.id),notes:d.notes.filter(s=>s.subjectId!==item.id),exams:d.exams.filter(s=>s.subjectId!==item.id),timer:d.timer?.subjectId===item.id?null:d.timer}));
      } else {update(d=>({...d,[key]:d[key].filter(s=>s.id!==item.id)}));if(type==='session')Native?.cancelReminder(item.id);}
      setForm(null);setNoteOpen(null);
    }}]);
  }
  function toggleSession(item) {
    update(d=>({...d,sessions:d.sessions.map(s=>s.id===item.id?{...s,done:!s.done}:s)}));
    Native?.cancelReminder(item.id);
    if(item.done)notify(item.id,`Time for ${subject(item.subjectId).name}`,item.title,new Date(`${item.date}T${item.time}:00`).getTime());
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
    return <View style={[s.sessionRow,{borderColor:c.line}]}><View style={[s.subjectIcon,{backgroundColor:sub.color}]}><Icon name={sub.icon} color="#7D8B65"/></View><Pressable style={{flex:1}} accessibilityLabel={`Edit ${item.title}`} onPress={()=>openForm('session',item)}><Text style={[s.bodyBold,{color:c.ink,textDecorationLine:item.done?'line-through':'none'}]}>{sub.name}</Text><Text style={[muted,{fontSize:12}]}>{item.time} · {item.duration} min · {item.title}</Text></Pressable><Pressable accessibilityRole="checkbox" accessibilityLabel={`Complete ${item.title}`} accessibilityState={{checked:item.done}} onPress={()=>toggleSession(item)} style={[s.checkbox,{borderColor:item.done?c.green:c.muted,backgroundColor:item.done?c.green:'transparent'}]}>{item.done&&<Icon name="check" size={16} color="#fff"/>}</Pressable></View>;
  }
  if(!data) return <SafeAreaView style={[s.safe,{backgroundColor:light.bg}]}><View style={s.loading}><CatGarden/><Text style={[s.title,{color:light.ink}]}>Study Bloom</Text><Text style={[s.muted,{marginVertical:20}]}>{error||'A little space for your big dreams…'}</Text>{error&&<Button label="Retry" onPress={load}/>}</View></SafeAreaView>;
  const completed=sessions.filter(x=>x.done).length;
  const activePage=page||tab;
  const minutes=data.logs.reduce((n,l)=>n+l.minutes,0);
  const dates=weekDates(anchor);
  const weekLogs=data.logs.filter(l=>dates.some(d=>dateKey(d)===l.date));
  const weekMinutes=weekLogs.reduce((n,l)=>n+l.minutes,0);
  const cards=data.cards.filter(x=>x.subjectId===cardSubject && x.due<=today);
  const activeCard=cards[0];
  const timer=data.timer;
  const timerTotal=timer?.total || data.settings.focus*60;
  async function backup() {try{await saveQueue;await Native.exportBackup(JSON.stringify({...current.current,timer:null}));say('Backup saved');}catch(e){if(e.code!=='CANCELLED')say('Backup could not be saved.');}}
  async function restore() {
    try{const raw=await Native.importBackup();const next=validateBackup(JSON.parse(raw));Alert.alert('Restore backup?','This replaces your current planner. Export a backup first if you want to keep it.',[{text:'Cancel',style:'cancel'},{text:'Restore',onPress:()=>{Native.cancelAllReminders();update(next);setFocusSubject(next.subjects[0]?.id||'');setCardSubject(next.subjects[0]?.id||'');setNoteOpen(null);say('Backup restored. Toggle reminders on to reschedule them.');}}]);}catch(e){if(e.code!=='CANCELLED')say('That file is not a valid Study Bloom backup.');}
  }
  return <SafeAreaView style={[s.safe,{backgroundColor:c.bg}]}>
    <StatusBar barStyle={data.settings.dark?'light-content':'dark-content'} backgroundColor={c.bg}/>
    <View style={s.top}><Pressable accessibilityLabel={page?'Back':'Study Bloom'} onPress={()=>setPage(null)} style={s.brand}>{page?<Icon name="back" color={c.ink}/>:<Text style={{fontSize:22}}>🌼</Text>}<Text style={[s.brandText,{color:c.ink}]}>{page?{subjects:'My subjects',cards:'Flashcards',notes:'My notes',exams:'Exam garden',settings:'Settings'}[page]:'Study Bloom'}</Text></Pressable><Pressable accessibilityLabel="Open settings" onPress={()=>setPage('settings')} style={s.iconButton}><Icon name="settings" color={c.muted}/></Pressable></View>
    <ScrollView key={activePage} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
    {activePage==='home'&&<>
      <View style={s.heading}><View style={{flex:1}}><Text style={titleStyle}>Hi, {data.settings.name}!</Text><Text style={[muted,{marginTop:6}]}>{new Date().toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'})}</Text></View><View style={[s.offline,{backgroundColor:'#E6F1DC'}]}><View style={s.dot}/><Text style={{fontSize:11,color:'#577247'}}>Offline ready</Text></View></View>
      <BloomHero dark={data.settings.dark} onFocus={()=>{setPage(null);setTab('focus');}} onPet={()=>say('Your study buddy is cheering you on ♡')}/>
      <View style={cardStyle}><Text style={[s.bodyBold,{color:c.ink}]}>Today’s progress</Text><View style={[s.row,{marginTop:16}]}><View style={{width:84,height:84,alignItems:'center',justifyContent:'center'}}><Svg style={StyleSheet.absoluteFill} width={84} height={84}><Circle cx={42} cy={42} r={34} fill="none" stroke={c.pale} strokeWidth={9}/><Circle cx={42} cy={42} r={34} fill="none" stroke={c.green} strokeWidth={9} strokeDasharray={`${(sessions.length?completed/sessions.length:0)*214} 214`} rotation={-90} origin="42,42" strokeLinecap="round"/></Svg><Text style={[s.bodyBold,{color:c.ink,fontSize:22}]}>{completed}/{sessions.length}</Text></View><View style={{flex:1,gap:12}}><Text style={muted}>🌱 {completed} of {sessions.length} sessions done</Text><Bar value={sessions.length?completed/sessions.length*100:0}/><Text style={[s.muted,{color:c.ink}]}>You’re growing at your own pace.</Text></View></View></View>
      <Heading title="Today’s plan" action={<Pressable onPress={()=>{setSelected(today);setTab('planner');}}><Text style={{color:c.purple,fontWeight:'600'}}>See all ›</Text></Pressable>}/>
      {sessions.length?<View style={cardStyle}>{sessions.map(item=><SessionRow key={item.id} item={item}/>)}</View>:<Empty text="A fresh page. Plan a little study time."/>}
      <Button label="Add a study session" icon="plus" onPress={()=>{setSelected(today);openForm('session');setDraft(d=>({...d,date:today}));}}/>
      <View style={s.quickGrid}>{[['subjects','book','Subjects'],['cards','cards','Flashcards'],['notes','note','Notes'],['exams','calendar','Exams']].map(([id,icon,label])=><Pressable key={id} accessibilityRole="button" onPress={()=>setPage(id)} style={[s.quickCard,{backgroundColor:c.card,borderColor:c.line}]}><View style={[s.subjectIcon,{backgroundColor:c.pale}]}><Icon name={icon} color={c.purple}/></View><Text style={[s.bodyBold,{color:c.ink}]}>{label}</Text><Icon name="chevron" size={16} color={c.muted}/></Pressable>)}</View>
    </>}
    {activePage==='planner'&&<>
      <Heading title="Your week 🌱" subtitle="Small steps, brighter days" action={<Button small label="Add" icon="plus" onPress={()=>openForm('session')}/>}/>
      <View style={[s.row,{justifyContent:'space-between',marginBottom:12}]}><Pressable accessibilityLabel="Previous week" style={s.iconButton} onPress={()=>{const d=new Date(anchor);d.setDate(d.getDate()-7);setAnchor(d);setSelected(dateKey(d));}}><Icon name="back" color={c.ink}/></Pressable><Text style={[s.bodyBold,{color:c.ink}]}>{dates[0].toLocaleDateString('en-US',{month:'short',day:'numeric'})} – {dates[6].toLocaleDateString('en-US',{month:'short',day:'numeric'})}</Text><Pressable accessibilityLabel="Next week" style={s.iconButton} onPress={()=>{const d=new Date(anchor);d.setDate(d.getDate()+7);setAnchor(d);setSelected(dateKey(d));}}><Icon name="chevron" color={c.ink}/></Pressable></View>
      <View style={[s.row,{gap:5,marginBottom:20}]}>{dates.map(d=><Pressable key={dateKey(d)} accessibilityLabel={`Select ${dateKey(d)}`} onPress={()=>setSelected(dateKey(d))} style={[s.day,{backgroundColor:selected===dateKey(d)?c.purple:c.card,borderColor:c.line}]}><Text style={{fontSize:11,color:selected===dateKey(d)?'#fff':c.muted}}>{d.toLocaleDateString('en-US',{weekday:'short'})}</Text><Text style={{fontSize:17,fontWeight:'700',marginTop:5,color:selected===dateKey(d)?'#fff':c.ink}}>{d.getDate()}</Text>{dateKey(d)===today&&<View style={[s.dot,{backgroundColor:selected===dateKey(d)?'#fff':c.green,marginTop:5}]}/>}</Pressable>)}</View>
      {data.sessions.filter(x=>x.date===selected).sort((a,b)=>a.time.localeCompare(b.time)).map(item=><View key={item.id} style={[s.row,{alignItems:'flex-start',marginBottom:14}]}><Text style={[muted,{width:44,paddingTop:18}]}>{item.time}</Text><View style={[s.planCard,{backgroundColor:subject(item.subjectId).color}]}><View style={s.row}><View style={{flex:1}}><Text style={[s.bodyBold,{color:'#35274D'}]}>{subject(item.subjectId).name}</Text><Text style={{color:'#655873',fontSize:12,marginTop:4}}>{item.title} · {item.duration} min</Text></View><Pressable accessibilityLabel="Edit session" style={s.iconButton} onPress={()=>openForm('session',item)}><Text style={{color:'#655873',fontSize:24}}>···</Text></Pressable></View><Pressable onPress={()=>toggleSession(item)} style={{alignSelf:'flex-start',marginTop:10,padding:6}}><Text style={{color:'#655873',fontSize:12}}>{item.done?'✓ Completed':'○ Mark complete'}</Text></Pressable></View></View>)}
      {!data.sessions.some(x=>x.date===selected)&&<Empty text="Your day has room to bloom." action={<Button label="Plan a session" small onPress={()=>openForm('session')}/>}/>}
      <Heading title="Assignments" action={<Pressable onPress={()=>openForm('task')}><Icon name="plus" color={c.purple}/></Pressable>}/>
      {data.tasks.length?<View style={cardStyle}>{[...data.tasks].sort((a,b)=>Number(a.done)-Number(b.done)||a.due.localeCompare(b.due)).map(t=><View key={t.id} style={[s.taskRow,{borderColor:c.line}]}><Pressable accessibilityRole="checkbox" accessibilityState={{checked:t.done}} accessibilityLabel={`Complete ${t.title}`} onPress={()=>update(d=>({...d,tasks:d.tasks.map(x=>x.id===t.id?{...x,done:!x.done}:x)}))} style={[s.checkbox,{borderColor:c.green,backgroundColor:t.done?c.green:'transparent'}]}>{t.done&&<Icon name="check" size={16} color="#fff"/>}</Pressable><Pressable style={{flex:1}} onPress={()=>openForm('task',t)}><Text style={[s.bodyBold,{color:c.ink,textDecorationLine:t.done?'line-through':'none'}]}>{t.title}</Text><Text style={[muted,{fontSize:11,marginTop:5,color:!t.done&&t.due<today?'#C57B86':c.muted}]}>{subject(t.subjectId).name} · {t.due} · {t.priority}</Text></Pressable></View>)}</View>:<Empty text="No assignments yet."/>}
    </>}
    {activePage==='subjects'&&<>
      <Heading title="My subjects 🌸" subtitle="A little garden of things to learn"/>
      {data.subjects.map(sub=>{const tasks=data.tasks.filter(t=>t.subjectId===sub.id);const done=tasks.filter(t=>t.done).length;return <View key={sub.id} style={cardStyle}><Pressable onPress={()=>openForm('subject',sub)} style={[s.row,{padding:12,borderRadius:14,backgroundColor:sub.color,marginBottom:8}]}><Icon name={sub.icon} color="#7D8B65"/><View style={{flex:1}}><Text style={[s.bodyBold,{color:'#35274D'}]}>{sub.name}</Text><Text style={{fontSize:11,color:'#655873',marginVertical:5}}>{done} / {tasks.length} tasks</Text><Bar value={tasks.length?done/tasks.length*100:0}/></View><Icon name="chevron" color="#655873" size={18}/></Pressable>{tasks.map(t=><Pressable key={t.id} onPress={()=>openForm('task',t)} style={[s.row,{paddingVertical:9}]}><View style={[s.checkbox,{borderColor:c.green,backgroundColor:t.done?c.green:'transparent'}]}>{t.done&&<Icon name="check" size={16} color="#fff"/>}</View><Text style={[muted,{color:c.ink}]}>{t.title}</Text></Pressable>)}<Pressable onPress={()=>{openForm('task');setDraft(d=>({...d,subjectId:sub.id}));}} style={{paddingVertical:10}}><Text style={{color:c.purple,fontWeight:'600'}}>+ Add task</Text></Pressable></View>;})}
      <Button label="Add a subject" icon="plus" onPress={()=>openForm('subject')}/>
    </>}
    {activePage==='focus'&&<>
      <Heading title={timer?.mode==='break'?'A gentle little break ☕':'Time to bloom 🌸'} subtitle="Focus now, brighter tomorrow ♡"/>
      <View style={{alignItems:'center',marginVertical:20}}><View style={{width:270,height:270,alignItems:'center',justifyContent:'center'}}><Svg width={270} height={270} style={StyleSheet.absoluteFill}><Circle cx={135} cy={135} r={122} fill="none" stroke={c.pale} strokeWidth={12}/><Circle cx={135} cy={135} r={122} fill="none" stroke={c.purple} strokeWidth={12} strokeDasharray={`${seconds/timerTotal*767} 767`} rotation={-90} origin="135,135" strokeLinecap="round"/></Svg><Text style={{fontSize:54,color:c.ink,fontWeight:'700',fontVariant:['tabular-nums']}}>{String(Math.floor(seconds/60)).padStart(2,'0')}:{String(seconds%60).padStart(2,'0')}</Text><CatGarden width={210} height={92}/></View></View>
      <SubjectPicker value={timer?.subjectId||focusSubject} onChange={id=>{if(timer)say('Finish or reset your current timer to change subjects.');else setFocusSubject(id);}}/>
      <Button label={!timer?'▶ Start focus':timer.running?'Ⅱ Pause':'▶ Resume'} onPress={toggleTimer}/>
      {timer&&<Button secondary label="Reset timer" onPress={()=>Alert.alert('Reset timer?','This unfinished session will not be counted.',[{text:'Keep going'},{text:'Reset',onPress:()=>{update(d=>({...d,timer:null}));Native?.cancelReminder('focus');}}])}/>}
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
      {data.exams.length?[...data.exams].sort((a,b)=>a.date.localeCompare(b.date)).map(e=>{const days=Math.round((new Date(e.date+'T12:00:00')-new Date(today+'T12:00:00'))/86400000);return <View key={e.id} style={cardStyle}><Pressable onPress={()=>openForm('exam',e)}><Text style={[s.bodyBold,{color:c.ink,fontSize:18}]}>{e.title}</Text><Text style={[muted,{marginTop:6}]}>{subject(e.subjectId).name} · {e.date}</Text></Pressable><View style={[s.offline,{backgroundColor:c.pale,alignSelf:'flex-start',marginVertical:16}]}><Text style={{color:c.ink,fontWeight:'700'}}>{days<0?'Exam completed':days===0?'Today — you’ve got this!':`${days} days to grow`}</Text></View>{days>=0&&<Button secondary small label="Plan revision" onPress={()=>{openForm('session');setDraft(d=>({...d,subjectId:e.subjectId,title:`Revise for ${e.title}`,date:today}));}}/>}</View>;}):<Empty text="Add an exam and make room for revision."/>}
    </>}
    {activePage==='progress'&&<>
      <Heading title="Look how you grew! 🌷" subtitle="Consistency creates amazing things ♡"/>
      <View style={[cardStyle,{backgroundColor:data.settings.dark?c.card:'#FFECDD'}]}><View style={s.row}><Text style={{fontSize:34}}>🔥</Text><View style={{flex:1}}><Text style={[s.bodyBold,{color:c.ink,fontSize:19}]}>{streak(data.logs)} day streak</Text><Text style={[muted,{marginTop:5}]}>Keep going, you’re blooming!</Text></View></View></View>
      <View style={cardStyle}><Heading title="Weekly study hours" subtitle="Focus timer sessions" action={<Text style={[s.bodyBold,{color:c.ink}]}>{(weekMinutes/60).toFixed(1)}h</Text>}/><View style={[s.row,{justifyContent:'space-between'}]}><Pressable onPress={()=>{const d=new Date(anchor);d.setDate(d.getDate()-7);setAnchor(d);}} style={s.iconButton}><Icon name="back" color={c.muted}/></Pressable><Text style={muted}>{dates[0].toLocaleDateString('en-US',{month:'short',day:'numeric'})} – {dates[6].getDate()}</Text><Pressable onPress={()=>{const d=new Date(anchor);d.setDate(d.getDate()+7);setAnchor(d);}} style={s.iconButton}><Icon name="chevron" color={c.muted}/></Pressable></View><View style={[s.row,{alignItems:'flex-end',height:160,gap:9,marginTop:12}]}>{dates.map((d,i)=>{const n=weekLogs.filter(l=>l.date===dateKey(d)).reduce((a,l)=>a+l.minutes,0);const max=Math.max(60,...dates.map(dt=>weekLogs.filter(l=>l.date===dateKey(dt)).reduce((a,l)=>a+l.minutes,0)));return <View key={i} style={{flex:1,alignItems:'center'}}><Text style={[muted,{fontSize:10,marginBottom:8}]}>{(n/60).toFixed(1)}h</Text><View style={{width:'100%',height:Math.max(4,n/max*100),backgroundColor:COLORS[i%5],borderRadius:6}}/><Text style={[muted,{fontSize:10,marginTop:8}]}>{d.toLocaleDateString('en-US',{weekday:'short'})}</Text></View>;})}</View></View>
      <View style={cardStyle}><Text style={[s.bodyBold,{color:c.ink,marginBottom:12}]}>Weekly goal · {data.settings.goal} hours</Text><Bar value={weekMinutes/(data.settings.goal*60)*100}/><Text style={[muted,{marginTop:10}]}>{Math.min(100,Math.round(weekMinutes/(data.settings.goal*60)*100))}% grown this week</Text></View>
      <View style={cardStyle}><Text style={[s.bodyBold,{color:c.ink,marginBottom:14}]}>Subject breakdown</Text>{data.subjects.map(sub=>{const n=data.logs.filter(l=>l.subjectId===sub.id).reduce((a,l)=>a+l.minutes,0);return <View key={sub.id} style={[s.row,{marginVertical:9}]}><Icon name={sub.icon} color={c.green}/><Text style={[muted,{flex:1,color:c.ink}]}>{sub.name}</Text><Text style={[s.bodyBold,{color:c.ink}]}>{(n/60).toFixed(1)}h</Text></View>;})}</View>
      <View style={cardStyle}><Text style={[s.bodyBold,{color:c.ink,marginBottom:12}]}>Little milestones</Text>{[[data.tasks.filter(t=>t.done).length>=10,'🌱','Completed 10 tasks'],[minutes>=600,'⭐','Studied 10 hours'],[streak(data.logs)>=7,'💗','7 day streak']].map(([achieved,emoji,label])=><Text key={label} style={[muted,{paddingVertical:7,opacity:achieved?1:.6}]}>{emoji} {label} {achieved?'✓':'· Keep growing'}</Text>)}</View><Text style={[muted,{textAlign:'center',marginVertical:10}]}>🌿 Saved on this device</Text>
    </>}
    {activePage==='settings'&&<>
      <Heading title="Make it yours" subtitle="Your planner, your pace"/>
      <View style={cardStyle}><Text style={[s.label,{color:c.ink}]}>Your name</Text><TextInput accessibilityLabel="Your name" value={data.settings.name} maxLength={40} onChangeText={name=>update(d=>({...d,settings:{...d.settings,name}}))} style={[s.input,{color:c.ink,backgroundColor:c.bg,borderColor:c.line}]}/><View style={[s.row,{justifyContent:'space-between',marginTop:16}]}><Text style={[s.bodyBold,{color:c.ink}]}>Moonlight mode</Text><Switch value={data.settings.dark} onValueChange={darkMode=>update(d=>({...d,settings:{...d.settings,dark:darkMode}}))} trackColor={{false:c.line,true:c.purple}}/></View><View style={[s.row,{justifyContent:'space-between',marginTop:16}]}><Text style={[s.bodyBold,{color:c.ink}]}>Local reminders</Text><Switch value={!!data.settings.reminders} onValueChange={enableReminders} trackColor={{false:c.line,true:c.purple}}/></View><Text style={[muted,{fontSize:12,marginTop:6}]}>Study session and timer alerts. No internet needed.</Text></View>
      <View style={cardStyle}>{[['focus','Focus minutes',5,180,5],['break','Break minutes',1,60,1],['goal','Weekly goal (hours)',1,100,1]].map(([key,label,min,max,step])=><View key={key} style={[s.row,{justifyContent:'space-between',paddingVertical:10}]}><Text style={[muted,{color:c.ink,flex:1}]}>{label}</Text><Pressable accessibilityLabel={`Decrease ${label}`} style={[s.stepper,{backgroundColor:c.pale}]} onPress={()=>update(d=>({...d,settings:{...d.settings,[key]:Math.max(min,d.settings[key]-step)}}))}><Text style={{color:c.ink,fontSize:23}}>−</Text></Pressable><Text style={[s.bodyBold,{color:c.ink,width:32,textAlign:'center'}]}>{data.settings[key]}</Text><Pressable accessibilityLabel={`Increase ${label}`} style={[s.stepper,{backgroundColor:c.pale}]} onPress={()=>update(d=>({...d,settings:{...d.settings,[key]:Math.min(max,d.settings[key]+step)}}))}><Text style={{color:c.ink,fontSize:23}}>+</Text></Pressable></View>)}</View>
      <View style={cardStyle}><Text style={[s.bodyBold,{color:c.ink,marginBottom:12}]}>Keep a little backup</Text><Text style={[muted,{lineHeight:21,marginBottom:15}]}>Everything lives on this device. Save a backup file before uninstalling or changing phones.</Text><Button label="Export backup" icon="download" onPress={backup}/><Button secondary label="Restore backup" onPress={restore}/></View>
      <Text style={[muted,{textAlign:'center',lineHeight:22}]}>Study Bloom · 1.1.0{"\n"}No accounts. No ads. Always offline. ♡</Text>
    </>}
    </ScrollView>
    <View style={[s.nav,{backgroundColor:c.card,borderColor:c.line}]}>{[['home','home','Home'],['planner','calendar','Planner'],['focus','timer','Focus'],['progress','chart','Progress']].map(([id,icon,label])=><Pressable key={id} accessibilityRole="tab" accessibilityState={{selected:!page&&tab===id}} onPress={()=>{setPage(null);setTab(id);}} style={s.navItem}><View style={[s.navIcon,{backgroundColor:!page&&tab===id?c.pale:'transparent'}]}><Icon name={icon} color={!page&&tab===id?c.purple:c.muted}/></View><Text style={{fontSize:11,marginTop:4,color:!page&&tab===id?c.purple:c.muted,fontWeight:!page&&tab===id?'700':'400'}}>{label}</Text></Pressable>)}</View>
    <Modal visible={!!form} animationType="slide" transparent onRequestClose={()=>setForm(null)}><KeyboardAvoidingView behavior={Platform.OS==='ios'?'padding':undefined} style={s.modalOverlay}><View style={[s.sheet,{backgroundColor:c.bg}]}><View style={s.heading}><Text style={[titleStyle,{flex:1}]}>{draft.id?'Edit':'New'} {form}</Text><Pressable accessibilityLabel="Close editor" style={s.iconButton} onPress={()=>setForm(null)}><Icon name="close" color={c.ink}/></Pressable></View><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{paddingBottom:20}}>
      {form!=='subject'&&<><Text style={[s.label,{color:c.ink}]}>Subject</Text><SubjectPicker value={draft.subjectId} onChange={id=>setDraft(d=>({...d,subjectId:id}))}/>{!data.subjects.length&&<Text style={muted}>Create a subject from Home → Subjects first.</Text>}</>}
      {(form==='subject'?[['name','Subject name','e.g. Biology']]:form==='card'?[['question','Question','What would you like to remember?'],['answer','Answer','Write the answer…']]:[['title','Title',form==='session'?'e.g. Revise Chapter 4':'Give it a name…']]).map(([key,label,placeholder])=><View key={key}><Text style={[s.label,{color:c.ink}]}>{label}</Text><TextInput accessibilityLabel={label} placeholder={placeholder} placeholderTextColor={c.muted} value={draft[key]||''} onChangeText={text=>setDraft(d=>({...d,[key]:text}))} maxLength={key==='answer'?10000:200} multiline={key==='answer'} style={[s.input,{color:c.ink,backgroundColor:c.card,borderColor:c.line},key==='answer'&&{minHeight:110,textAlignVertical:'top'}]}/></View>)}
      {form==='subject'&&<><Text style={[s.label,{color:c.ink}]}>Your color</Text><View style={s.row}>{COLORS.map(color=><Pressable key={color} accessibilityLabel={`Select color ${color}`} onPress={()=>setDraft(d=>({...d,color}))} style={{height:42,width:42,borderRadius:21,backgroundColor:color,borderWidth:draft.color===color?3:0,borderColor:c.purple}}/>)}</View><Text style={[s.label,{color:c.ink}]}>Icon</Text><View style={s.row}>{['leaf','calculator','book'].map(icon=><Pressable key={icon} accessibilityLabel={`Select ${icon} icon`} onPress={()=>setDraft(d=>({...d,icon}))} style={[s.iconButton,{backgroundColor:draft.icon===icon?c.pale:c.card,borderRadius:12}]}><Icon name={icon} color={c.purple}/></Pressable>)}</View></>}
      {['session','exam','task'].includes(form)&&<><Text style={[s.label,{color:c.ink}]}>{form==='task'?'Due date':'Date'} (YYYY-MM-DD)</Text><TextInput accessibilityLabel="Date YYYY-MM-DD" value={form==='task'?draft.due:draft.date} onChangeText={text=>setDraft(d=>({...d,[form==='task'?'due':'date']:text}))} placeholder="2026-10-14" placeholderTextColor={c.muted} maxLength={10} style={[s.input,{color:c.ink,backgroundColor:c.card,borderColor:c.line}]}/></>}
      {form==='session'&&<><Text style={[s.label,{color:c.ink}]}>Start time (24-hour HH:MM)</Text><TextInput accessibilityLabel="Start time HH:MM" value={draft.time} onChangeText={time=>setDraft(d=>({...d,time}))} maxLength={5} style={[s.input,{color:c.ink,backgroundColor:c.card,borderColor:c.line}]}/><Text style={[s.label,{color:c.ink}]}>Duration (minutes)</Text><TextInput accessibilityLabel="Duration minutes" value={String(draft.duration||'')} keyboardType="number-pad" onChangeText={duration=>setDraft(d=>({...d,duration}))} maxLength={3} style={[s.input,{color:c.ink,backgroundColor:c.card,borderColor:c.line}]}/></>}
      {form==='task'&&<><Text style={[s.label,{color:c.ink}]}>Priority</Text><View style={s.row}>{['Low','Medium','High'].map(priority=><Pressable key={priority} onPress={()=>setDraft(d=>({...d,priority}))} style={[s.chip,{backgroundColor:draft.priority===priority?c.purple:c.card,borderColor:c.line}]}><Text style={{color:draft.priority===priority?'#fff':c.ink}}>{priority}</Text></Pressable>)}</View></>}
      {form==='note'&&<><Text style={[s.label,{color:c.ink}]}>Note</Text><TextInput accessibilityLabel="Note body" multiline value={draft.body||''} onChangeText={body=>setDraft(d=>({...d,body}))} maxLength={20000} placeholder="A thought worth keeping…" placeholderTextColor={c.muted} style={[s.input,{color:c.ink,backgroundColor:c.card,borderColor:c.line,minHeight:200,textAlignVertical:'top'}]}/></>}
      <Button label="Save little plan" icon="check" onPress={saveForm}/>{draft.id&&<Pressable onPress={()=>remove(form,draft)} style={{alignSelf:'center',padding:15}}><Text style={{color:'#C57B86'}}>Delete {form}</Text></Pressable>}
    </ScrollView></View></KeyboardAvoidingView></Modal>
    <Modal visible={!!noteOpen} animationType="slide" onRequestClose={()=>setNoteOpen(null)}><SafeAreaView style={[s.safe,{backgroundColor:c.bg}]}><ScrollView contentContainerStyle={s.content}><Heading title={noteOpen?.title} action={<Pressable onPress={()=>setNoteOpen(null)} style={s.iconButton}><Icon name="close" color={c.ink}/></Pressable>}/><Text style={{color:c.ink,lineHeight:26,fontSize:16,marginBottom:25}}>{noteOpen?.body}</Text><Button label="Edit note" onPress={()=>{const n=noteOpen;setNoteOpen(null);openForm('note',n);}}/></ScrollView></SafeAreaView></Modal>
    {!!toast&&<View pointerEvents="none" style={[s.toast,{backgroundColor:c.ink}]}><Text style={{color:c.bg,textAlign:'center',lineHeight:20}}>{toast}</Text></View>}
  </SafeAreaView>;
}
const s=StyleSheet.create({
  safe:{flex:1}, loading:{flex:1,alignItems:'center',justifyContent:'center',padding:30},top:{paddingHorizontal:22,paddingVertical:10,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},brand:{flexDirection:'row',alignItems:'center',gap:9},brandText:{fontSize:17,fontWeight:'800',letterSpacing:.3},content:{padding:22,paddingTop:12,paddingBottom:30},heading:{flexDirection:'row',alignItems:'center',gap:12,marginBottom:17,marginTop:5},title:{fontSize:24,fontWeight:'800',letterSpacing:-.4},muted:{fontSize:13},bodyBold:{fontSize:15,fontWeight:'700'},row:{flexDirection:'row',alignItems:'center',gap:14},card:{borderRadius:22,padding:18,borderWidth:1,marginBottom:16},hero:{borderRadius:23,alignItems:'center',marginBottom:20,paddingBottom:22,overflow:'hidden'},heroText:{fontSize:19,lineHeight:28,fontStyle:'italic',textAlign:'center',letterSpacing:1},offline:{flexDirection:'row',alignItems:'center',gap:6,paddingHorizontal:10,paddingVertical:7,borderRadius:20},dot:{width:6,height:6,borderRadius:3,backgroundColor:'#89AD75'},bar:{height:8,borderRadius:8,overflow:'hidden'},button:{borderRadius:17,minHeight:49,paddingHorizontal:18,paddingVertical:13,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,marginVertical:6},buttonText:{fontSize:15,fontWeight:'700'},smallButton:{minHeight:42,paddingHorizontal:13,paddingVertical:9},subjectIcon:{width:35,height:35,borderRadius:10,alignItems:'center',justifyContent:'center'},sessionRow:{flexDirection:'row',alignItems:'center',gap:11,paddingVertical:13,borderBottomWidth:.5},checkbox:{width:21,height:21,borderWidth:1.3,borderRadius:5,alignItems:'center',justifyContent:'center'},quickGrid:{flexDirection:'row',flexWrap:'wrap',gap:10,marginTop:16},quickCard:{width:'48%',borderWidth:1,borderRadius:17,padding:12,flexDirection:'row',alignItems:'center',gap:7},nav:{flexDirection:'row',borderTopWidth:1,paddingTop:10,paddingBottom:12,paddingHorizontal:14},navItem:{flex:1,alignItems:'center'},navIcon:{paddingHorizontal:18,paddingVertical:6,borderRadius:15},iconButton:{minWidth:44,minHeight:44,alignItems:'center',justifyContent:'center'},day:{flex:1,minHeight:75,paddingVertical:10,alignItems:'center',borderRadius:14,borderWidth:1},planCard:{flex:1,borderRadius:17,padding:13},taskRow:{flexDirection:'row',alignItems:'center',gap:12,paddingVertical:14,borderBottomWidth:.5},chip:{borderWidth:1,borderRadius:16,paddingHorizontal:14,paddingVertical:11,flexDirection:'row',alignItems:'center',gap:7},flashcard:{borderRadius:27,minHeight:300,padding:28,alignItems:'center',justifyContent:'center',marginVertical:16},label:{fontSize:13,fontWeight:'700',marginTop:16,marginBottom:9},input:{borderWidth:1,borderRadius:14,paddingHorizontal:14,paddingVertical:13,fontSize:16,minHeight:48},stepper:{width:34,height:36,borderRadius:10,alignItems:'center',justifyContent:'center'},modalOverlay:{flex:1,justifyContent:'flex-end',backgroundColor:'#241D4260'},sheet:{maxHeight:'92%',padding:22,paddingBottom:5,borderTopLeftRadius:28,borderTopRightRadius:28},toast:{position:'absolute',bottom:95,left:24,right:24,padding:15,borderRadius:16,elevation:6},
});
