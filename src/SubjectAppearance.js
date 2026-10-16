import React from 'react';
import {View,Text,Pressable,ScrollView,StyleSheet} from 'react-native';
import {Icon} from './art';
const {SUBJECT_COLORS,SUBJECT_ICONS}=require('./subjectOptions');
// Keep a newly selected option visible without expanding the editor.
function quick(options,count,value) {
  const items=options.slice(0,count);
  if(!items.some(x=>x.value===value))items[count-1]=options.find(x=>x.value===value)||items[count-1];
  return items;
}
function Choice({item,color,selected,onPress,c,compact=false}) {
  return <Pressable accessibilityRole="button" accessibilityLabel={`Select ${item.name} ${color?'color':'icon'}`} accessibilityState={{selected}} onPress={onPress} style={({pressed})=>[styles.choice,compact?styles.compact:styles.tile,{backgroundColor:selected?c.pale:c.card,borderColor:selected?c.purple:c.line,opacity:pressed ? .7 : 1}]}>
    {color?<View style={[styles.swatch,{backgroundColor:item.value,borderColor:selected?c.purple:'transparent'}]}>{selected&&<Icon name="check" size={19} color="#35274D"/>}</View>:<Icon name={item.value} size={compact?24:27} color={c.purple}/>}
    {!compact&&<Text style={{color:c.ink,fontSize:12,textAlign:'center'}}>{item.name}</Text>}
  </Pressable>;
}
export function SubjectAppearanceFields({draft,onChange,onMore,c}) {
  return <>{[['colors','Your color',SUBJECT_COLORS,5,draft.color],['icons','Icon',SUBJECT_ICONS,3,draft.icon]].map(([type,label,options,count,value])=><View key={type}>
    <Text style={[styles.label,{color:c.ink}]}>{label}</Text>
    <View style={styles.row}>{quick(options,count,value).map(item=><Choice key={item.value} item={item} color={type==='colors'} compact selected={value===item.value} onPress={()=>onChange(type==='colors'?'color':'icon',item.value)} c={c}/>)}
      <Pressable accessibilityRole="button" accessibilityLabel={`More ${type}`} onPress={()=>onMore(type)} style={({pressed})=>[styles.more,{backgroundColor:pressed?c.pale:c.card,borderColor:c.purple}]}><Icon name="plus" size={18} color={c.purple}/><Text style={{fontSize:11,fontWeight:'700',color:c.purple}}>More</Text></Pressable>
    </View>
  </View>)}</>;
}
export function SubjectAppearancePopup({type,draft,onChange,onClose,c}) {
  if(!type)return null;
  const color=type==='colors',options=color?SUBJECT_COLORS:SUBJECT_ICONS;
  return <View style={styles.overlay} accessibilityViewIsModal>
    <Pressable accessibilityRole="button" accessibilityLabel="Close appearance popup" onPress={onClose} style={StyleSheet.absoluteFill}/>
    <View style={[styles.popup,{backgroundColor:c.bg}]}>
      <View style={styles.heading}><View style={{flex:1}}><Text accessibilityRole="header" style={{fontSize:22,fontWeight:'800',color:c.ink}}>{color?'Choose a color':'Choose an icon'}</Text><Text style={{fontSize:13,color:c.muted,marginTop:5}}>{color?'A little color for every subject':'Find a little symbol for your subject'}</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Close choices" onPress={onClose} style={styles.close}><Icon name="close" color={c.ink}/></Pressable></View>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.grid}>{options.map(item=><Choice key={item.value} item={item} color={color} selected={(color?draft.color:draft.icon)===item.value} onPress={()=>{onChange(color?'color':'icon',item.value);onClose();}} c={c}/>)}</ScrollView>
    </View>
  </View>;
}
const styles=StyleSheet.create({
  label:{fontSize:13,fontWeight:'700',marginTop:16,marginBottom:9},row:{flexDirection:'row',alignItems:'center',gap:5},
  choice:{alignItems:'center',justifyContent:'center',borderWidth:2,borderRadius:14,gap:7},compact:{flexShrink:1,width:44,height:48},tile:{width:'30.5%',minHeight:85,padding:7},
  swatch:{width:32,height:32,borderRadius:16,borderWidth:2,alignItems:'center',justifyContent:'center'},more:{minWidth:46,minHeight:48,borderWidth:1,borderStyle:'dashed',borderRadius:14,alignItems:'center',justifyContent:'center',gap:1},
  overlay:{...StyleSheet.absoluteFillObject,backgroundColor:'#160F2999',justifyContent:'center',padding:18},popup:{maxHeight:'85%',borderRadius:25,padding:17,elevation:12},
  heading:{flexDirection:'row',alignItems:'center',gap:6,marginBottom:17},close:{minWidth:44,minHeight:44,alignItems:'center',justifyContent:'center'},grid:{flexDirection:'row',flexWrap:'wrap',justifyContent:'space-between',rowGap:10,paddingBottom:8},
});
