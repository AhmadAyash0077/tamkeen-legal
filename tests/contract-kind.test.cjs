const {test}=require('node:test');const assert=require('node:assert/strict');const vm=require('node:vm');const fs=require('node:fs');
const html=fs.readFileSync('index.html','utf8');
const line=k=>{const i=html.indexOf('const '+k+'=');assert.ok(i>=0,k);return html.slice(i,html.indexOf("\n",i)).replace(/\r$/,"")};
const ctx={};vm.createContext(ctx);vm.runInContext([line('uxCtKind'),line('uxCtMixed'),'this.uxCtKind=uxCtKind;this.uxCtMixed=uxCtMixed;'].join('\n'),ctx);
test('file kind decides the list; contract type only for legacy rows',()=>{
  assert.equal(ctx.uxCtKind({fileKind:'جملة',ctype:'تركيب'}),'جملة');
  assert.equal(ctx.uxCtKind({fileKind:'تركيب',ctype:'توريد بضاعة آجل'}),'تركيب');
  assert.equal(ctx.uxCtKind({fileKind:'تركيب',ctype:'تركيب'}),'تركيب');
  assert.equal(ctx.uxCtKind({ctype:'تركيب'}),'تركيب');
  assert.equal(ctx.uxCtKind({}),'جملة');
});
test('mismatched kind and type are flagged for review',()=>{
  assert.equal(ctx.uxCtMixed({fileKind:'جملة',ctype:'تركيب'}),true);
  assert.equal(ctx.uxCtMixed({fileKind:'تركيب',ctype:'توريد بضاعة آجل'}),true);
  assert.equal(ctx.uxCtMixed({fileKind:'جملة',ctype:'توريد بضاعة آجل'}),false);
  assert.equal(ctx.uxCtMixed({fileKind:'جملة'}),false);
  assert.equal(ctx.uxCtMixed({fileKind:'تركيب',ctype:'تركيب'}),false);
});
