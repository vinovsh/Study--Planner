// Exercise the real React screens with a deterministic native bridge adapter.
// Device layout/notification delivery are covered separately by Android CI.
const test=require('node:test');
const assert=require('node:assert/strict');
const Module=require('node:module');
const path=require('node:path');
const fs=require('node:fs');
const React=require('react');
const renderer=require('react-test-renderer');
const babel=require('@babel/core');
const {initialState}=require('../src/model');

test('planner screens save recurring sessions, checklist work and deadline alerts, then cancel completed alerts',async()=>{
  const root=path.resolve(__dirname,'..');
  const originalLoad=Module._load, originalJS=Module._extensions['.js'];
  let saved=initialState(), tree;
  const alarms=new Map();
  const alerts=[];
  const native={pickDate:async()=> '2030-01-07',pickTime:async()=> '09:30',pickDuration:async()=>30,cancelAllReminders:()=>alarms.clear(),cancelReminder:id=>alarms.delete(id),scheduleReminder:async(id,title,body,time)=>alarms.set(id,{title,body,time}),scheduleDailyReminder:async(id,title,body,hour,minute)=>alarms.set(id,{title,body,hour,minute}),setStudySummary(){}};
  const rn={};
  for(const name of ['View','Text','ScrollView','Pressable','SafeAreaView','StatusBar','Modal','TextInput','Switch','KeyboardAvoidingView','Image','FlatList'])rn[name]=name;
  rn.FlatList=props=>React.createElement('FlatList',props,props.data.map(item=>React.createElement(React.Fragment,{key:props.keyExtractor(item)},props.renderItem({item}))));
  Object.assign(rn,{StyleSheet:{create:x=>x,absoluteFill:{}},Alert:{alert:(...args)=>alerts.push(args)},AppState:{addEventListener:()=>({remove(){}})},NativeModules:{BloomDevice:native},PermissionsAndroid:{},Platform:{OS:'android',Version:29},Vibration:{vibrate(){}},Keyboard:{dismiss(){}}});
  const host=name=>props=>React.createElement(name,props);
  Module._load=function(id,parent,...args){
    if(id==='react-native')return rn;
    if(id==='react-native-svg')return {__esModule:true,default:host('Svg'),Circle:host('Circle')};
    if(id==='@react-native-async-storage/async-storage')return {getItem:async()=>JSON.stringify(saved),setItem:async(key,value)=>{saved=JSON.parse(value);}};
    if(id==='./src/art')return {Icon:host('Icon'),CatGarden:host('CatGarden')};
    if(id==='./src/BloomHero')return {__esModule:true,default:host('BloomHero'),BOOKWORM:'mascot'};
    if(id==='./src/SubjectAppearance')return {SubjectAppearanceFields:host('Appearance'),SubjectAppearancePopup:host('AppearancePopup')};
    return originalLoad.call(this,id,parent,...args);
  };
  Module._extensions['.js']=function(mod,file){
    if([path.join(root,'App.js'),path.join(root,'src/PlanningFields.js'),path.join(root,'src/StudyHub.js')].includes(file)){
      const code=babel.transformSync(fs.readFileSync(file,'utf8'),{filename:file,configFile:false,babelrc:false,presets:[require.resolve('@react-native/babel-preset')]}).code;
      return mod._compile(code,file);
    }
    return originalJS(mod,file);
  };
  const flush=async(fn=()=>{})=>renderer.act(async()=>{await fn();await new Promise(resolve=>setImmediate(resolve));});
  const byLabel=(label,type)=>tree.root.findAll(n=>typeof n.type==='string'&&(!type||n.type===type)&&n.props.accessibilityLabel===label)[0];
  const press=async label=>{const node=byLabel(label,'Pressable');assert.ok(node,`Missing button: ${label}`);await flush(()=>node.props.onPress());};
  const text=async(label,value)=>flush(()=>byLabel(label,'TextInput').props.onChangeText(value));
  const buttonText=async label=>{
    const node=tree.root.findAll(n=>n.type==='Pressable'&&n.findAll(x=>x.type==='Text'&&x.props.children===label).length)[0];
    assert.ok(node,`Missing action ${label}`);await flush(()=>node.props.onPress());
  };
  try{
    const App=require('../App').default;
    await flush(()=>{tree=renderer.create(React.createElement(App));});
    await press('Add study session');await text('Title','Weekly Biology');await press('Choose date');
    await flush(()=>byLabel('Repeat study session','Switch').props.onValueChange(true));
    // Pick Monday only, regardless of today's default weekday.
    const days=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    for(const day of days){const node=byLabel(day,'Pressable');if(node.props.accessibilityState.checked!==(day==='Mon'))await press(day);}
    await press('Save little plan');
    assert.equal(saved.sessions.filter(s=>s.title==='Weekly Biology').length,4);
    await buttonText('Planner');await press('Add assignment');await text('Title','Research essay');await press('Choose date');
    await buttonText('+ Add step');await text('Step 1','Read sources');await buttonText('+ Add step');await text('Step 2','Write draft');
    await flush(()=>byLabel('Deadline reminder','Switch').props.onValueChange(true));await press('Choose deadline reminder time');
    await press('Save little plan');
    const essay=saved.tasks.find(t=>t.title==='Research essay');assert.equal(essay.steps.length,2);assert.equal(essay.reminderTime,'09:30');
    await press('Read sources');assert.equal(saved.tasks.find(t=>t.id===essay.id).done,false);
    await text('Search assignments','write draft');assert.ok(byLabel('Complete Research essay'));
    await press('Write draft');assert.equal(saved.tasks.find(t=>t.id===essay.id).done,true);assert.equal(byLabel('Complete Research essay'),undefined);
    await press('Completed');assert.ok(byLabel('Complete Research essay'));await press('Complete Research essay');
    assert.ok(saved.tasks.find(t=>t.id===essay.id).steps.every(s=>!s.done));
    await press('Open settings');
    await flush(()=>byLabel('Local reminders','Switch').props.onValueChange(true));
    assert.ok(alarms.has(`tasks:${essay.id}`));
    await buttonText('Planner');await press('To do');await press('Complete Research essay');assert.equal(alarms.has(`tasks:${essay.id}`),false);
    assert.equal(alerts.length,0);
    // Use the new toolkit through actual screen controls, not just the data helpers.
    await press('Home');await press('📖 Chapters & daily plan');await press('Add chapter');
    await text('Study title','Cell basics');await text('Estimated minutes','25');await press('Save study item');
    const chapter=saved.chapters.find(ch=>ch.title==='Cell basics');assert.ok(chapter);
    await press('Focus on Cell basics');await press('▶ Start focus');
    assert.equal(saved.timer.chapterId,chapter.id);await press('Ⅱ Pause');assert.equal(saved.timer.running,false);
    await press('Reset timer');await flush(()=>alerts.at(-1)[2].find(b=>b.text==='Reset').onPress());
    await press('Home');await press('✍️ Practice questions');await press('Add practice question');
    await text('Practice question','Which organelle produces ATP?');
    for(const [i,value] of ['Nucleus','Mitochondria','Ribosome','Membrane'].entries())await text(`Answer ${'ABCD'[i]}`,value);
    await press('Correct answer B');await text('Why this answer is correct (optional)','Mitochondria produce ATP.');await press('Save study item');
    assert.equal(saved.questions.length,1);await press('Start practice');await press('Quiz answer B');await press('Check answer');
    await press('Submit test');await flush(()=>alerts.at(-1)[2].find(b=>b.text==='Submit').onPress());
    assert.equal(saved.attempts.length,1);assert.equal(saved.attempts[0].correct,1);assert.equal(saved.activeQuiz,null);
    await press(`Review test ${saved.attempts[0].id}`);await press('Close answer review');
    await press('Home');await press('🔎 Search everything');await text('Search study material','Cell basics');
    await press('Cell basics');await text('Study title','Cell biology');await press('Save study item');assert.equal(saved.chapters[0].title,'Cell biology');
    await press('Open settings');await flush(()=>byLabel('Daily plan reminder','Switch').props.onValueChange(true));
    await flush(()=>byLabel('Nightly study recap','Switch').props.onValueChange(true));
    assert.ok(alarms.has('daily-plan'));assert.ok(alarms.has('daily-recap'));
    assert.doesNotThrow(()=>require('../src/model').validateBackup(saved));
    // A timed test cannot gain extra time by closing the app and resuming later.
    saved.activeQuiz=require('../src/studyHubModel').createQuiz(saved.questions,{mode:'mock',count:1,minutes:5},Date.now()-600000);
    await flush(()=>tree.unmount());await flush(()=>{tree=renderer.create(React.createElement(App));});
    await press('Resume unfinished test');
    assert.equal(saved.activeQuiz,null);assert.equal(saved.attempts.length,2);assert.equal(saved.attempts[1].correct,0);
  }finally{
    if(tree)await flush(()=>tree.unmount());
    Module._load=originalLoad;Module._extensions['.js']=originalJS;
  }
});
