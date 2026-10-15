import React, {useEffect, useRef, useState} from 'react';
import {AccessibilityInfo, Animated, AppState, Easing, Image, Pressable, StyleSheet, Text, View} from 'react-native';
import Svg, {Circle, Ellipse, G, Path, Defs, RadialGradient, Stop} from 'react-native-svg';

export const BOOKWORM = require('./assets/happy-bookworm.png');
const messages = ['A little progress,\nevery day', 'You’re doing great!\nKeep growing', 'Small steps,\nbrighter days', 'One page at a time,\none happy little win'];
function Flower({x,y,scale=1,color='#F6BBCB'}) {
  return <G transform={`translate(${x} ${y}) scale(${scale})`}>
    <Path d="M0 0Q9 24 0 58M3 39Q-20 17-15 41Q-7 50 3 39M6 24Q29 1 23 30Q14 42 6 24" fill="#99B075" stroke="#748C5D" strokeWidth="1.1"/>
    <Path d="M1 53Q-25 39-19 57Q-4 65 1 53" fill="#B4C38A"/>
    {[0,72,144,216,288].map(a=><Ellipse key={a} cx="0" cy="-7" rx="6" ry="9" fill={color} stroke="#FFFFFF" strokeOpacity=".25" strokeWidth="1.5" transform={`rotate(${a})`}/>)}
    <Circle r="4.5" fill="#EFC974"/><Circle cx="-1" cy="-1.3" r="2" fill="#FFF4CB"/>
  </G>;
}
function Garden({side}) {
  return <Svg width="100%" height="100%" viewBox="0 0 90 220">
    {side==='left'?<>
      <Flower x={35} y={48} scale={.9} color="#F4B2C5"/><Flower x={16} y={86} scale={.72} color="#F7C2CD"/>
      <Flower x={58} y={143} scale={.73} color="#FFF6D7"/><Flower x={32} y={177} scale={.54} color="#FFF5DB"/>
      <Path d="M34 177Q15 154 9 163Q5 177 34 177M31 202Q52 183 65 190Q58 207 31 202" fill="#A1B480"/>
      <Path d="M25 20Q8 4 13 35Q28 39 25 20" fill="#B7C58D"/>
    </>:<>
      <Flower x={53} y={70} scale={.95} color="#F4B6CA"/><Flower x={73} y={122} scale={.62} color="#F7BED0"/>
      <Flower x={30} y={160} scale={.7} color="#FFF3D2"/><Flower x={53} y={189} scale={.51} color="#FFF6D7"/>
      <Path d="M58 95Q45 67 32 82Q27 98 58 95M49 141Q78 122 78 139Q73 154 49 141" fill="#A9BA83"/>
    </>}
  </Svg>;
}

export default function BloomHero({dark=false,onFocus,onPet,celebration=0}) {
  const [width,setWidth]=useState(320), [quote,setQuote]=useState(0);
  const [reduceMotion,setReduceMotion]=useState(true), [foreground,setForeground]=useState(AppState.currentState==='active');
  const breathe=useRef(new Animated.Value(0)).current, sway=useRef(new Animated.Value(0)).current;
  const press=useRef(new Animated.Value(1)).current, love=useRef(new Animated.Value(0)).current;
  const hop=useRef(new Animated.Value(0)).current, tiltX=useRef(new Animated.Value(0)).current, tiltY=useRef(new Animated.Value(0)).current;
  const burst=useRef(null), dance=useRef(null), lastCelebration=useRef(0);
  useEffect(()=>{
    let mounted=true;
    AccessibilityInfo.isReduceMotionEnabled().then(value=>{if(mounted)setReduceMotion(value);}).catch(()=>{});
    const a=AccessibilityInfo.addEventListener('reduceMotionChanged',setReduceMotion);
    const b=AppState.addEventListener('change',state=>setForeground(state==='active'));
    return()=>{mounted=false;a.remove();b.remove();burst.current?.stop();dance.current?.stop();};
  },[]);
  useEffect(()=>{
    if(reduceMotion||!foreground){breathe.setValue(0);sway.setValue(0);burst.current?.stop();dance.current?.stop();love.setValue(0);hop.setValue(0);return;}
    const loop=(value,duration)=>Animated.loop(Animated.sequence([
      Animated.timing(value,{toValue:1,duration,easing:Easing.inOut(Easing.sin),useNativeDriver:true,isInteraction:false}),
      Animated.timing(value,{toValue:0,duration,easing:Easing.inOut(Easing.sin),useNativeDriver:true,isInteraction:false}),
    ]));
    const a=loop(breathe,2100), b=loop(sway,2800);a.start();b.start();
    return()=>{a.stop();b.stop();};
  },[reduceMotion,foreground,breathe,sway,love,hop]);
  function bounce(big=false) {
    if(reduceMotion)return;
    dance.current?.stop();hop.setValue(0);
    dance.current=Animated.sequence([
      Animated.timing(hop,{toValue:big?1.4:1,duration:170,easing:Easing.out(Easing.cubic),useNativeDriver:true}),
      Animated.spring(hop,{toValue:0,speed:16,bounciness:12,useNativeDriver:true}),
    ]);dance.current.start();
    burst.current?.stop();love.setValue(0);
    burst.current=Animated.sequence([
      Animated.timing(love,{toValue:1,duration:850,easing:Easing.out(Easing.cubic),useNativeDriver:true}),
      Animated.timing(love,{toValue:0,duration:450,useNativeDriver:true}),
    ]);burst.current.start();
  }
  useEffect(()=>{
    if(celebration>lastCelebration.current){lastCelebration.current=celebration;setQuote(1);bounce(true);}
  },[celebration]);
  function touch(value,event) {
    if(reduceMotion){press.setValue(1);return;}
    Animated.spring(press,{toValue:value,speed:18,bounciness:7,useNativeDriver:true}).start();
    if(value<1 && event){track(event);}else{
      Animated.parallel([tiltX,tiltY].map(v=>Animated.spring(v,{toValue:0,speed:13,bounciness:6,useNativeDriver:true}))).start();
    }
  }
  function track(event) {
    if(reduceMotion)return;
    const {locationX,locationY}=event.nativeEvent;
    tiltY.setValue(Math.max(-1,Math.min(1,(locationX-width/2)/(width/2))));
    tiltX.setValue(Math.max(-1,Math.min(1,(locationY-height/2)/(height/2))));
  }
  function pet(){setQuote(value=>(value+1)%3);onPet?.();bounce();}
  function readBook(event){event.stopPropagation();setQuote(3);bounce(true);}
  const height=Math.min(310,Math.max(252,width*.86));
  const catHeight=height-72;
  const catWidth=catHeight*1.03;
  return <View onLayout={e=>setWidth(e.nativeEvent.layout.width)} style={[styles.space,{height}]}>
    <View pointerEvents="none" style={[styles.glow,{top:4,height:catHeight,backgroundColor:dark?'#392E47':'#FFF2E1'}]}/>
    <Animated.View style={[styles.garden,{left:-8,top:height-235,transform:[{rotate:sway.interpolate({inputRange:[0,1],outputRange:['-2deg','2deg']})}]}]} pointerEvents="none" importantForAccessibility="no-hide-descendants"><Garden side="left"/></Animated.View>
    <Animated.View style={[styles.garden,{right:-8,top:height-235,transform:[{rotate:sway.interpolate({inputRange:[0,1],outputRange:['2deg','-2deg']})}]}]} pointerEvents="none" importantForAccessibility="no-hide-descendants"><Garden side="right"/></Animated.View>
    <View pointerEvents="none" style={[styles.banner,{backgroundColor:dark?'#4D3A65':'#E1CFF2',borderColor:dark?'#69517F':'#D3BDEB'}]}>
      <View style={styles.bannerHighlight}/>
    </View>
    <Animated.View pointerEvents="none" style={[styles.cat,{left:(width-catWidth)/2,width:catWidth,height:catHeight,transform:[
      {perspective:700},{translateY:Animated.add(breathe.interpolate({inputRange:[0,1],outputRange:[0,-3]}),hop.interpolate({inputRange:[0,1],outputRange:[0,-15]}))},
      {rotateX:tiltX.interpolate({inputRange:[-1,1],outputRange:['4deg','-4deg']})},{rotateY:tiltY.interpolate({inputRange:[-1,1],outputRange:['-7deg','7deg']})},
      {rotate:sway.interpolate({inputRange:[0,1],outputRange:['-.8deg','.8deg']})},{scale:press},
    ]}]}><Image source={BOOKWORM} resizeMode="contain" style={StyleSheet.absoluteFill} accessible={false}/></Animated.View>
    <View pointerEvents="none" style={styles.quote}><Text accessibilityLiveRegion="polite" maxFontSizeMultiplier={1.2} style={[styles.quoteText,{color:dark?'#F0E2FF':'#59426D'}]}>{messages[quote]}</Text></View>
    <View pointerEvents="none" importantForAccessibility="no-hide-descendants" style={[styles.sparkle,{left:width*.16,top:height*.19}]}><Text style={styles.star}>✧</Text></View>
    <View pointerEvents="none" importantForAccessibility="no-hide-descendants" style={[styles.sparkle,{right:width*.15,top:height*.13}]}><Text style={styles.star}>✦</Text></View>
    <Animated.View pointerEvents="none" importantForAccessibility="no-hide-descendants" style={[styles.hearts,{opacity:love,transform:[{translateY:love.interpolate({inputRange:[0,1],outputRange:[15,-28]})},{scale:love.interpolate({inputRange:[0,1],outputRange:[.7,1.2]})}]}]}><Text style={styles.heart}>♡   ♥   ♡</Text></Animated.View>
    <Pressable accessibilityRole="button" accessibilityLabel="Pet your study buddy" accessibilityHint="Tap for encouragement, drag gently to tilt, or hold to open Focus." onPress={pet} onLongPress={onFocus} delayLongPress={600} onPressIn={e=>touch(.975,e)} onPressOut={()=>touch(1)} onTouchMove={track} style={StyleSheet.absoluteFill}/>
    <Pressable accessibilityRole="button" accessibilityLabel="Play with the book" accessibilityHint="Tap for a reading cheer, or hold to open Focus." onPress={readBook} onLongPress={onFocus} delayLongPress={600} onPressIn={e=>touch(.975,e)} onPressOut={()=>touch(1)} onTouchMove={track} style={{position:'absolute',top:catHeight*.62,left:width*.36,width:width*.28,height:catHeight*.24}}/>
    <Pressable accessibilityRole="button" accessibilityLabel="Tap to play" onPress={pet} style={({pressed})=>[styles.play,{backgroundColor:dark?'#684453':'#FFE2EB',borderColor:dark?'#976078':'#F6C9D9',transform:[{scale:pressed?.95:1}]}]}><Text style={{fontSize:12,fontWeight:'600',color:dark?'#FFD4E2':'#C75E82'}}>Tap to play ♡</Text></Pressable>
  </View>;
}
const styles=StyleSheet.create({
  space:{marginTop:0,marginBottom:23},glow:{position:'absolute',left:'16%',right:'16%',borderRadius:130,opacity:.65},
  garden:{position:'absolute',width:86,height:224},
  banner:{position:'absolute',height:84,bottom:6,left:12,right:12,borderWidth:1,borderRadius:29,elevation:3,shadowColor:'#A583AD',shadowOffset:{width:0,height:5},shadowOpacity:.18,shadowRadius:10},
  bannerHighlight:{position:'absolute',top:2,left:7,right:7,height:12,borderTopLeftRadius:28,borderTopRightRadius:28,backgroundColor:'#FFFFFF',opacity:.13},
  cat:{position:'absolute',top:-3,elevation:4},quote:{position:'absolute',bottom:28,left:44,right:44,alignItems:'center',elevation:5},
  quoteText:{fontSize:19,lineHeight:25,fontWeight:'700',textAlign:'center',letterSpacing:.1},
  play:{position:'absolute',alignSelf:'center',bottom:-7,paddingHorizontal:15,minHeight:31,alignItems:'center',justifyContent:'center',borderWidth:1,borderRadius:17,elevation:6},
  sparkle:{position:'absolute'},star:{color:'#E5B65F',fontSize:19},hearts:{position:'absolute',top:26,left:0,right:0,alignItems:'center'},heart:{color:'#E997AA',fontSize:23,letterSpacing:8},
});
