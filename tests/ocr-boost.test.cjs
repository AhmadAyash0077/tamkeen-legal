const {test}=require('node:test');const assert=require('node:assert/strict');
const O=require('../ocr-boost.js');
test('Saudi ID check digit, Arabic digits and wrong digits',()=>{
  assert.equal(O.validSaudiId('1012345672'),true);assert.equal(O.validSaudiId('2109876546'),true);
  assert.equal(O.validSaudiId('١٠١٢٣٤٥٦٧٢'),true);
  assert.equal(O.validSaudiId('1012345673'),false);assert.equal(O.validSaudiId('3012345672'),false);assert.equal(O.validSaudiId('101234567'),false);
});
test('CR, VAT and mobile formats',()=>{
  assert.equal(O.validCr('7012345678'),true);assert.equal(O.validCr('1010123456'),true);assert.equal(O.validCr('9010123456'),false);
  assert.equal(O.validVat('300123456700003'),true);assert.equal(O.validVat('300123456700001'),false);
  assert.equal(O.normMobile('+966 55 123 4567'),'0551234567');assert.equal(O.normMobile('٠٥٥١٢٣٤٥٦٧'),'0551234567');assert.equal(O.normMobile('0441234567'),null);
});
test('candidates join numbers split by spaces',()=>{
  const c=O.numberCandidates('رقم الهوية: 1012 345 672 والسجل ١٠١٠١٢٣٤٥٦');
  assert.ok(c.includes('1012345672'));assert.ok(c.includes('1010123456'));
});
test('fixFields replaces a misread ID with a valid one from the text and drops bad values',()=>{
  const text='الهوية الوطنية\n1012345673\n1012345672\nجوال 0551234567';
  const x=O.fixFields({type:'national_id',number:'1012345673',fields:{id_no:'1012345673'}},text);
  assert.equal(x.fields.id_no,'1012345672');assert.equal(x.number,'1012345672');assert.match(x.note,/صُحّح/);
  const y=O.fixFields({type:'contract_auth',fields:{id_no:'1111111111',manager_mobile:'12345'}},'لا أرقام صالحة 0551234567');
  assert.equal(y.fields.id_no,undefined);assert.equal(y.fields.manager_mobile,'0551234567');
  const z=O.fixFields({type:'cr',fields:{cr_no:'99'}},'السجل التجاري 7012345678');assert.equal(z.fields.cr_no,'7012345678');
});
test('image enhancement whitens background and keeps dark text',()=>{
  const g=new Uint8ClampedArray(1000);for(let i=0;i<1000;i++)g[i]=i<100?40:200+(i%20);
  const out=O.enhanceGray(g);assert.ok(out[10]<60);assert.equal(out[500],255);
});
