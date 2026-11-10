const {test}=require('node:test');const assert=require('node:assert/strict');
const A=require('../autofill.js');
test('suggestions rank repeated values and merge spelling variants',()=>{
  const rows=[{court:'المحكمة التجارية بالرياض'},{court:'المحكمه التجارية بالرياض'},{court:'المحكمة العمالية'},{court:''},{}];
  const s=A.suggestions(rows,'court');assert.equal(s.length,2);assert.equal(s[0],'المحكمة التجارية بالرياض');
});
test('source match uses exact digits for ids and normalized text for names',()=>{
  const rows=[{id:'a',cr_no:'1010123456',trade_name:'مؤسسة الأمل',updatedAt:'2026-01-01'},{id:'b',cr_no:'١٠١٠١٢٣٤٥٦',trade_name:'مؤسسة الامل',updatedAt:'2026-05-01'},{id:'c',cr_no:'1010999999',deleted:true}];
  const cr=A.COPY_RULES.contracts.find(r=>r.key==='cr_no'),tn=A.COPY_RULES.contracts.find(r=>r.key==='trade_name');
  assert.equal(A.findSource(rows,cr,'1010123456').id,'b');
  assert.equal(A.findSource(rows,tn,'مؤسسة الأمل').id,'b');
  assert.equal(A.findSource(rows,cr,'1010999999'),null);
  assert.equal(A.findSource(rows,tn,'مؤ'),null);
});
test('plan fills only empty fields and keeps customer code within the same file kind',()=>{
  const cr=A.COPY_RULES.contracts.find(r=>r.key==='cr_no');
  const src={fileKind:'جملة',cr_no:'1010123456',trade_name:'مؤسسة',manager_name:'سالم',cr_city:'الرياض',customer_code:'CW-000001'};
  const p=A.plan('contracts',cr,src,{fileKind:'تركيب',manager_name:'أحمد'});const keys=p.map(x=>x[0]);
  assert.ok(keys.includes('trade_name')&&keys.includes('cr_city'));assert.ok(!keys.includes('manager_name'));assert.ok(!keys.includes('customer_code'));assert.ok(!keys.includes('cr_no'));
  assert.ok(A.plan('contracts',cr,src,{fileKind:'جملة'}).some(x=>x[0]==='customer_code'));
});
test('field count wording',()=>{assert.equal(A.fields(1),'حقل واحد');assert.equal(A.fields(2),'حقلين');assert.equal(A.fields(5),'5 حقول');assert.equal(A.fields(12),'12 حقلًا')});
