const test=require('node:test');const assert=require('node:assert');
globalThis.todayISO=()=>'2026-11-12';globalThis.g2h=g=>'1448-01-01';globalThis.h2g=h=>/^1448-0?6-0?1$/.test(h.replace(/\//g,'-'))?'2026-11-11':null;
globalThis.normDigits=s=>String(s??'').replace(/[٠-٩]/g,d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d));
globalThis.parseNum=s=>{const n=Number(String(s).replace(/[,٬\s]/g,''));return isFinite(n)?n:NaN};
globalThis.statRecs=()=>[{id:'c1',caseNo:'4870483955'}];
const F=(k,l,t,o)=>({k,l,t,o});
globalThis.MODS={executions:{fields:[F('respondent','المنفذ ضده','text'),F('reqNo','رقم الطلب','ltr'),F('claimAmount','مبلغ المطالبة','money'),F('filed','تاريخ التقديم','date')]},
 violations:{fields:[F('number','رقم المخالفة','ltr'),F('amount','القيمة','money'),F('date','تاريخ المخالفة','date'),F('authority','الجهة','text')]},
 hearings:{fields:[F('caseId','القضية','ref'),F('date','تاريخ','date'),F('time','الوقت','time'),F('link','رابط','ltr')]}};
const E=require('../easy-entry.js');
test('parseDate',()=>{
  assert.equal(E.parseDate('اليوم').g,'2026-11-12');assert.equal(E.parseDate('بكرة').g,'2026-11-13');
  assert.equal(E.parseDate('18/11').g,'2026-11-18');assert.equal(E.parseDate('٥/١٢/٢٠٢٦').g,'2026-12-05');
  assert.equal(E.parseDate('بعد أسبوع').g,'2026-11-19');assert.equal(E.parseDate('بعد 10 أيام').g,'2026-11-22');
  assert.equal(E.parseDate('بعد شهرين').g,'2027-01-12');assert.equal(E.parseDate('2026-12-01').g,'2026-12-01');
  const h=E.parseDate('1448/6/1');assert.equal(h.orig,'h');assert.equal(h.g,'2026-11-11');assert.equal(h.verified,false);
  assert.equal(E.parseDate('31/02/2026'),null);assert.equal(E.parseDate('كلام'),null);assert.equal(E.parseDate('45/13'),null)});
test('parsePaste executions',()=>{const o=E.parsePaste('executions','رقم الطلب: 4012345678\nالمنفذ ضده: مؤسسة النور للتجارة\nمبلغ المطالبة: 125,500.00 ريال\nتاريخ التقديم: 03/11/2026');
  assert.equal(o.reqNo,'4012345678');assert.equal(o.respondent,'مؤسسة النور للتجارة');assert.equal(o.claimAmount,125500);assert.equal(o.filed.g,'2026-11-03')});
test('parsePaste violations: no guessing',()=>{const o=E.parsePaste('violations','تم رصد شيء بمبلغ 5000 ريال يوم 1/2/2026');assert.deepEqual(o,{})});
test('parsePaste hearings',()=>{const o=E.parsePaste('hearings','تم تحديد جلسة في القضية رقم 4870483955 بتاريخ 18/11/2026 الساعة 12:05 م https://x.example/abc');
  assert.equal(o.caseId,'c1');assert.equal(o.date.g,'2026-11-18');assert.equal(o.time,'12:05');assert.equal(o.link,'https://x.example/abc')});
