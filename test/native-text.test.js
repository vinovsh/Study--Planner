const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const babel=require('@babel/core');

test('native containers never receive literal text children, including stray inline spaces',()=>{
  const containers=new Set(['View','ScrollView','SafeAreaView','Pressable','KeyboardAvoidingView','Modal','Panel']);
  const files=['App.js',...fs.readdirSync('src').filter(f=>f.endsWith('.js')).map(f=>'src/'+f)];
  const failures=[];
  for(const file of files){
    const {ast}=babel.transformFileSync(file,{configFile:false,babelrc:false,presets:[require.resolve('@react-native/babel-preset')],ast:true,code:false});
    function walk(node){
      if(!node||typeof node!=='object')return;
      const callee=node.callee?.type==='SequenceExpression'?node.callee.expressions.at(-1):node.callee;
      if(node.type==='CallExpression'&&callee?.type==='MemberExpression'&&['createElement','jsx','jsxs'].includes(callee.property.name)){
        const component=node.arguments[0];const name=component?.type==='MemberExpression'?component.property.name:component?.name;
        const childrenProp=node.arguments[1]?.properties?.find(p=>p.key?.name==='children')?.value;
        const children=callee.property.name==='createElement'?node.arguments.slice(2):childrenProp?.type==='ArrayExpression'?childrenProp.elements:[childrenProp];
        if(containers.has(name)&&children.some(child=>child?.type==='StringLiteral'&&child.value.length>0))failures.push(`${file}: ${name} has a text child; wrap it in Text or remove spacing.`);
      }
      for(const [key,value] of Object.entries(node))if(!['loc','comments','leadingComments','trailingComments','innerComments'].includes(key)){
        if(Array.isArray(value))value.forEach(walk);else if(value&&typeof value==='object')walk(value);
      }
    }
    walk(ast);
  }
  assert.deepEqual(failures,[]);
});
