const {test}=require('node:test'),assert=require('node:assert/strict');
const core=require('../legal-memory-core.js');
test('only explicitly selected reviewed active memory enters prompt',()=>{
  const record={assistantMemory:[{id:'a',text:'approved',reviewed:true},{id:'b',text:'draft'},{id:'c',text:'withdrawn',reviewed:true,withdrawn:true}]};
  assert.equal(core.context(record,[]),'');
  const result=core.context(record,['a','b','c']);assert.match(result,/approved/);assert.doesNotMatch(result,/draft|withdrawn/);
  assert.equal(core.context({...record,deleted:true},['a']),'');
});
test('append preserves prior notes and never silently drops history or trusts incoming review',()=>{
  const existing={assistantMemory:[{id:'old',text:'old'}]};const rows=core.append(existing,{id:'new',text:'new',reviewed:true});
  assert.equal(rows.length,2);assert.equal(rows[1].reviewed,false);assert.equal(existing.assistantMemory.length,1);
  assert.throws(()=>core.append({assistantMemory:Array.from({length:60},(_,i)=>({id:String(i),text:'x'}))},{id:'new',text:'x'}));
  assert.throws(()=>core.append({deleted:true},{id:'new',text:'x'}));
});
test('context cannot borrow another record and bounds length',()=>{
  assert.equal(core.context({assistantMemory:[{id:'own',text:'safe',reviewed:true}]},['foreign']),'');
  const text=core.context({assistantMemory:[{id:'a',text:'x'.repeat(20000),reviewed:true}]},['a']);assert.ok(text.length<19000);
});
