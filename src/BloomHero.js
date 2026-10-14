import React, {useEffect, useRef, useState} from 'react';
import {AccessibilityInfo, Animated, AppState, Easing, Pressable, StyleSheet, Text, View} from 'react-native';
import Svg, {Circle, Ellipse, G, Path} from 'react-native-svg';

const messages = ['A little progress,\nevery day', 'You’re doing great!\nKeep growing', 'Small steps,\nbrighter days'];

function Flower({x, y, scale=1, color='#FFF0BD'}) {
  return <G transform={`translate(${x} ${y}) scale(${scale})`}>
    <Path d="M0 0Q8 24 1 50M3 32Q-17 16-11 36Q-3 41 3 32M5 23Q22 7 16 30Q8 36 5 23" fill="#A6B77D" stroke="#778E5F" strokeWidth="1.2"/>
    {[0,72,144,216,288].map(a=><Ellipse key={a} cx="0" cy="-6" rx="4.4" ry="7" fill={color} stroke="#CDAF87" strokeWidth=".6" transform={`rotate(${a})`}/>)}
    <Circle r="3.6" fill="#E7BE60"/>
  </G>;
}

function Garden({width, height, side}) {
  return <Svg width={width} height={height} viewBox="0 0 65 170">
    {side==='left'?<>
      <Flower x={18} y={47} scale={.67} color="#D9C5EF"/>
      <Flower x={40} y={29} scale={.8} color="#FFE5A3"/>
      <Flower x={46} y={62} scale={.55} color="#F4C1CB"/>
      <Flower x={22} y={137} scale={.75} color="#FFF5CC"/>
      <Flower x={39} y={124} scale={.53} color="#DCC8F0"/>
      <Path d="M12 166q-10-12-9-27 15 5 17 27M25 167q9-17 23-21-2 18-23 21" fill="#8AA16E"/>
    </>:<>
      <Flower x={37} y={18} scale={.88} color="#FFE5A3"/>
      <Flower x={18} y={55} scale={.75} color="#FFF5D3"/>
      <Flower x={45} y={65} scale={.6} color="#D8C6E9"/>
      <Flower x={27} y={138} scale={.65} color="#FFF5CC"/>
      <Flower x={44} y={121} scale={.58} color="#FFF2C1"/>
      <Path d="M20 167q-14-10-14-22 20 1 22 19M31 165q11-18 23-20-2 21-23 20" fill="#8AA16E"/>
    </>}
  </Svg>;
}

function SleepingCat({width}) {
  return <Svg width={width} height={width*.47} viewBox="0 0 300 141">
    <Ellipse cx="149" cy="129" rx="113" ry="7" fill="#8B739C" opacity=".14"/>
    <Path d="M44 110Q28 83 52 53Q77 18 128 24Q169 26 194 74L189 117Q135 133 68 128Z" fill="#FFF9EF" stroke="#81756B" strokeWidth="2.8"/>
    <Path d="M58 48Q71 32 95 29Q112 27 121 35Q114 55 97 63Q69 72 58 48" fill="#B4A08E"/>
    <Path d="M71 98Q35 83 26 110Q23 130 71 128L87 121" fill="#FFF9EF" stroke="#81756B" strokeWidth="2.8"/>
    <Path d="M29 107Q31 129 55 125Q69 119 71 109Q66 95 54 100" fill="#B4A08E"/>
    <Path d="M161 77Q155 52 173 43L192 15Q197 9 201 15L214 45Q233 46 246 57L277 49Q283 47 279 59L263 90Q270 115 242 128Q214 143 182 127Q155 111 161 77Z" fill="#FFF9EF" stroke="#81756B" strokeWidth="2.8"/>
    <Path d="m178 44 19-22 8 26zM251 66l20-9-12 22z" fill="#F2BFA9"/>
    <Path d="M225 48Q243 47 250 60L262 78Q263 98 245 103Q228 101 229 82Q231 69 225 48" fill="#B4A08E"/>
    <Path d="M187 83q3 11 14 11M231 105q7 8 15 1" fill="none" stroke="#6F635B" strokeWidth="3" strokeLinecap="round"/>
    <Path d="m211 105 7 2-5 4zM213 111q-6 4-10 0M213 111q2 7 9 6" fill="#B6817D" stroke="#9D7570" strokeWidth="1.5" strokeLinecap="round"/>
    <Ellipse cx="186" cy="101" rx="10" ry="4.5" fill="#F1C2BD" opacity=".8"/>
    <Ellipse cx="246" cy="118" rx="9" ry="4" fill="#F1C2BD" opacity=".8"/>
    <Path d="M98 101Q128 99 146 107Q160 113 152 124Q143 135 102 130Q89 119 98 101Z" fill="#FFF9EF" stroke="#81756B" strokeWidth="2.8"/>
    <Path d="M137 121v7M144 120l1 6" fill="none" stroke="#B5A597" strokeWidth="1.3" strokeLinecap="round"/>
    <Path d="m196 103-12-3m13 8-14 1m51 9 13 3" fill="none" stroke="#A38A7B" strokeWidth="1.2" strokeLinecap="round"/>
  </Svg>;
}

export default function BloomHero({dark=false, onFocus, onPet}) {
  const [width,setWidth]=useState(320), [quote,setQuote]=useState(0), [reduceMotion,setReduceMotion]=useState(true), [foreground,setForeground]=useState(AppState.currentState==='active');
  const breathe=useRef(new Animated.Value(0)).current;
  const sway=useRef(new Animated.Value(0)).current;
  const press=useRef(new Animated.Value(1)).current;
  const love=useRef(new Animated.Value(0)).current;
  const burst=useRef(null);
  useEffect(()=>{
    let mounted=true;
    AccessibilityInfo.isReduceMotionEnabled().then(value=>{if(mounted)setReduceMotion(value);}).catch(()=>{});
    const accessibility=AccessibilityInfo.addEventListener('reduceMotionChanged',setReduceMotion);
    const lifecycle=AppState.addEventListener('change',state=>setForeground(state==='active'));
    return()=>{mounted=false;accessibility.remove();lifecycle.remove();burst.current?.stop();};
  },[]);
  useEffect(()=>{
    if(reduceMotion || !foreground){breathe.setValue(0);sway.setValue(0);return;}
    const gentle=Animated.loop(Animated.sequence([
      Animated.timing(breathe,{toValue:1,duration:2300,easing:Easing.inOut(Easing.sin),useNativeDriver:true,isInteraction:false}),
      Animated.timing(breathe,{toValue:0,duration:2300,easing:Easing.inOut(Easing.sin),useNativeDriver:true,isInteraction:false}),
    ]));
    const garden=Animated.loop(Animated.sequence([
      Animated.timing(sway,{toValue:1,duration:3000,easing:Easing.inOut(Easing.sin),useNativeDriver:true,isInteraction:false}),
      Animated.timing(sway,{toValue:0,duration:3000,easing:Easing.inOut(Easing.sin),useNativeDriver:true,isInteraction:false}),
    ]));
    gentle.start();garden.start();
    return()=>{gentle.stop();garden.stop();};
  },[reduceMotion,foreground,breathe,sway]);
  function touch(value) {
    if(reduceMotion){press.setValue(1);return;}
    Animated.spring(press,{toValue:value,speed:18,bounciness:8,useNativeDriver:true}).start();
  }
  function pet() {
    setQuote(value=>(value+1)%messages.length);
    onPet?.();
    if(reduceMotion)return;
    burst.current?.stop();love.setValue(0);
    burst.current=Animated.sequence([
      Animated.timing(love,{toValue:1,duration:900,easing:Easing.out(Easing.cubic),useNativeDriver:true}),
      Animated.timing(love,{toValue:0,duration:350,useNativeDriver:true}),
    ]);
    burst.current.start();
  }
  const catWidth=Math.min(260,width*.75);
  return <View onLayout={e=>setWidth(e.nativeEvent.layout.width)} style={styles.space}>
    <Animated.View style={[styles.composition,{transform:[{scale:press}]}]}>
      <View style={[styles.banner,{backgroundColor:dark?'#4D3A65':'#DCCBF0'}]}/>
      <Animated.View pointerEvents="none" style={[styles.garden,{left:0,transform:[{rotate:sway.interpolate({inputRange:[0,1],outputRange:['-1.5deg','1.5deg']})}]}]}><Garden width={64} height={172} side="left"/></Animated.View>
      <Animated.View pointerEvents="none" style={[styles.garden,{right:0,transform:[{rotate:sway.interpolate({inputRange:[0,1],outputRange:['1.5deg','-1.5deg']})}]}]}><Garden width={64} height={172} side="right"/></Animated.View>
      <Animated.View pointerEvents="none" style={[styles.cat,{left:(width-catWidth)/2,transform:[{translateY:breathe.interpolate({inputRange:[0,1],outputRange:[0,-2]})},{scaleY:breathe.interpolate({inputRange:[0,1],outputRange:[1,1.016]})}]}]}><SleepingCat width={catWidth}/></Animated.View>
      <View pointerEvents="none" style={styles.quote}><Text accessibilityLiveRegion="polite" style={[styles.quoteText,{color:dark?'#F0E2FF':'#675181'}]}>{messages[quote]} <Text style={{color:'#E997AA'}}>♥</Text></Text></View>
      <Animated.View pointerEvents="none" accessible={false} style={[styles.hearts,{opacity:love,transform:[{translateY:love.interpolate({inputRange:[0,1],outputRange:[6,-22]})},{scale:love.interpolate({inputRange:[0,1],outputRange:[.6,1.2]})}]}]}><Text style={styles.heart}>♡  ♥  ♡</Text></Animated.View>
      <Pressable accessibilityRole="button" accessibilityLabel="Pet your study buddy" accessibilityHint="Tap for encouragement. Hold to open your focus timer." onPress={pet} onLongPress={onFocus} delayLongPress={550} onPressIn={()=>touch(.975)} onPressOut={()=>touch(1)} style={StyleSheet.absoluteFill}/>
    </Animated.View>
  </View>;
}

const styles=StyleSheet.create({
  space:{height:184,marginTop:0,marginBottom:14},
  composition:{flex:1},
  banner:{position:'absolute',top:96,bottom:0,left:0,right:0,borderRadius:21},
  garden:{position:'absolute',top:5,width:64,height:172},
  cat:{position:'absolute',top:-2},
  quote:{position:'absolute',top:120,left:44,right:44,alignItems:'center'},
  quoteText:{fontSize:18,lineHeight:26,letterSpacing:.6,fontStyle:'italic',textAlign:'center'},
  hearts:{position:'absolute',top:27,left:0,right:0,alignItems:'center'},
  heart:{color:'#E997AA',fontSize:22,letterSpacing:7},
});
