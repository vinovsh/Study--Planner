import React from 'react';
import Svg, {Path, Circle, Ellipse, G} from 'react-native-svg';

const paths = {
  home: 'M3 11 12 3l9 8M5 10v11h5v-6h4v6h5V10',
  calendar: 'M5 5h14v16H5zM5 10h14M8 3v4M16 3v4M8 14h2M14 14h2M8 17h2',
  timer: 'M9 2h6M12 5v2M18 6l2 2M12 10v5l3 2 M20 15a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
  chart: 'M4 20h16M5 17V12h3v5M11 17V8h3v9M17 17V4h3v13',
  book: 'M12 5C8 3 4 3 2 5v15c4-2 7-2 10 0 3-2 6-2 10 0V5c-4-2-7-2-10 0v15',
  leaf: 'M5 19C1 7 11 3 21 3c0 11-5 17-13 14M5 21 16 9M10 15v-5M10 15h5',
  calculator: 'M5 3h14v18H5zM8 6h8v4H8zM8 14h1M15 14h1M8 17h1M15 17h1',
  plus: 'M12 5v14M5 12h14', chevron: 'm9 5 7 7-7 7', back: 'm15 5-7 7 7 7',
  check: 'm5 12 4 4L19 6', close: 'm6 6 12 12M6 18 18 6',
  settings: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2',
  cards: 'M6 5h14v16H6zM3 17V2h14M9 10h8M9 14h6',
  note: 'M5 3h14v18H5zM8 8h8M8 12h8M8 16h5',
  moon: 'M20 15A9 9 0 0 1 9 3a9 9 0 1 0 11 12',
  fire: 'M13 2c2 5 0 6 2 9 1-2 2-3 3-4 5 7 3 15-6 15C3 22 1 13 8 8c-1 6 3 7 4 4 2-3 0-5 1-10',
  download: 'M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4',
};
export function Icon({name, size=22, color='#6E6480'}) {
  return <Svg width={size} height={size} viewBox="0 0 24 24"><Path d={paths[name] || paths.book} stroke={color} strokeWidth="1.7" fill="none" strokeLinecap="round" strokeLinejoin="round"/></Svg>;
}
function Flower({x,y,scale=1,color='#F6BBCB'}) {
  return <G transform={`translate(${x} ${y}) scale(${scale})`}><Path d="M0 0 Q4 19 0 34M1 21Q-15 8-9 25Q-3 28 1 21M1 15Q15 0 12 18Q5 25 1 15" fill="#A9BC82" stroke="#809863" strokeWidth="1.4"/>{[0,72,144,216,288].map(a=><Ellipse key={a} cx="0" cy="-6" rx="4.5" ry="7" fill={color} transform={`rotate(${a})`}/>)}<Circle r="4" fill="#E4B452"/></G>;
}
export function CatGarden({width=260,height=125}) {
  return <Svg width={width} height={height} viewBox="0 0 300 145">
    <Flower x={32} y={64} scale={1.1}/><Flower x={65} y={43} scale={.8} color="#FFE3A4"/>
    <Flower x={252} y={45} scale={1.2} color="#FFE3A4"/><Flower x={275} y={83} scale={.7}/>
    <Ellipse cx="151" cy="124" rx="91" ry="9" fill="#B4A1D0" opacity=".22"/>
    <Ellipse cx="130" cy="91" rx="70" ry="33" fill="#FFF8EC" stroke="#85786D" strokeWidth="2.5"/>
    <Path d="M78 72Q94 51 123 60Q134 76 122 88Q94 99 78 72" fill="#B7A392"/>
    <Path d="M83 96Q44 81 52 113Q56 129 98 119" fill="#FFF8EC" stroke="#85786D" strokeWidth="2.5"/>
    <Path d="M79 105Q59 106 66 114" fill="none" stroke="#85786D" strokeWidth="2"/>
    <Path d="M163 73 167 39Q173 33 193 56L211 53Q234 30 235 39L239 79Q253 115 216 125L177 121Q150 104 163 73" fill="#FFF8EC" stroke="#85786D" strokeWidth="2.5"/>
    <Path d="m172 48 4 19 14-8zM220 59l10-15 1 24z" fill="#F4BDAF"/>
    <Path d="M204 55q10-3 18 0l7 16q-1 18-17 18-17-2-8-34" fill="#B7A392"/>
    <Path d="M174 94q6 7 12 0M217 94q6 7 12 0" stroke="#695F57" strokeWidth="2.6" fill="none" strokeLinecap="round"/>
    <Path d="m198 98 5 0-2.5 3zM201 101q-5 7-9 2M201 101q5 7 9 2" fill="#CC9388" stroke="#A37870" strokeWidth="1.4"/>
    <Ellipse cx="179" cy="103" rx="8" ry="4" fill="#F6C5C5"/><Ellipse cx="225" cy="103" rx="8" ry="4" fill="#F6C5C5"/>
    <Ellipse cx="162" cy="120" rx="20" ry="8" fill="#FFF8EC" stroke="#85786D" strokeWidth="2"/>
    <Flower x={26} y={116} scale={.6} color="#C5B3E4"/><Flower x={258} y={114} scale={.7} color="#C5B3E4"/>
  </Svg>;
}
