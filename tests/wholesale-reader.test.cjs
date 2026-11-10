const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function setup(extra={}){
 const ctx={window:{},Intl,Date,Map,Set,DOMException,setTimeout,clearTimeout,uxIdOk:()=>true,...extra};
 vm.createContext(ctx);vm.runInContext(fs.readFileSync('wholesale-reader.js','utf8'),ctx);return ctx.window.tamkeenWholesaleReader;
}
const values=rows=>Object.fromEntries(rows.map(x=>[x.key,x.candidates.map(c=>c.value)]));
test('labeled Arabic fields work without certificate heading; supports Arabic digits and following lines',()=>{
 const r=values(setup().extractText('الاسم التجاري: مؤسسة اختبار للتجارة\nالرقم الوطني الموحّد\n٧٠٠١٢٣٤٥٦٧\nمدينة الإصدار: جدة\nالبريد الإلكتروني: test@example.com\nرقم الجوال: ٠٥٥١٢٣٤٥٦٧\nالعنوان المختصر: ABCD 1234\nتاريخ التأكيد السنوي: 2026/11/10'));
 assert.deepEqual(Array.from(r.trade_name),['مؤسسة اختبار للتجارة']);assert.equal(r.unified[0],'7001234567');assert.equal(r.city[0],'جدة');assert.equal(r.email[0],'test@example.com');assert.equal(r.mobile[0],'0551234567');assert.equal(r.address[0],'ABCD1234');assert.equal(r.confirm[0],'2026-11-10');
});
test('multiple fields in one line and English labels; unknown values never fabricated',()=>{
 const r=values(setup().extractText('Company name: Sample Trading Company\nUnified number: 7001234567\nالاسم التجاري: مؤسسة ألف مدينة الإصدار: الرياض\nاسم المسؤول\nالبريد الإلكتروني\nالتوقيع'));
 assert.equal(r.trade_name.length,2);assert.equal(r.city[0],'الرياض');assert.equal(r.manager.length,0);assert.equal(r.email.length,0);
});
test('Arabic PDF lines are reconstructed by coordinates instead of arbitrary item order',()=>{
 const r=setup();const text=r.pdfText([{str:'7001234567',transform:[1,0,0,1,10,50]},{str:'الرقم الوطني الموحد',transform:[1,0,0,1,200,50],dir:'rtl'},{str:'الاسم التجاري: مؤسسة اختبار',transform:[1,0,0,1,10,100],dir:'rtl'}]);
 assert.equal(values(r.extractText(text)).unified[0],'7001234567');assert.ok(text.startsWith('الاسم التجاري'));
});
test('no arbitrary unlabeled identity, money or document number becomes company registration',()=>{
 const r=values(setup().extractText('مبلغ السند 100000\nهوية المالك 1234567890\nرقم فاتورة 7001234567'));
 assert.equal(r.unified.length,0);assert.equal(r.old_registration.length,0);
});
function scanSetup({pages=5,ocrFails=false,text='هذا نص طويل داخل الملف لكنه لا يحتوي على حقول العميل المطلوبة ولا على بيانات موثوقة للاستخراج'}={}){
 let ocrCount=0,destroyed=0;const worker={setParameters:async()=>{},recognize:async(_canvas,opts)=>{if(!opts?.rectangle)ocrCount++;if(ocrFails)throw Error('network failed');return {data:{text:'الاسم التجاري: مؤسسة اختبار\nالرقم الوطني الموحد: 7001234567'}}},terminate:async()=>{}};
 const reader=setup({UX_OCR_LIB:'test',libLoad:async()=>{},window:{Tesseract:{createWorker:async()=>worker}},document:{createElement:()=>({width:0,height:0,getContext:()=>({})})},pdfLib:async()=>({getDocument:()=>({promise:Promise.resolve({numPages:pages,getPage:async()=>({getTextContent:async()=>({items:[{str:text}]}),getViewport:({scale})=>({width:600*scale,height:800*scale}),render:()=>({promise:Promise.resolve()}),cleanup:()=>{}}),destroy:async()=>{destroyed++}})})})});
 return {reader,counts:()=>({ocrCount,destroyed})};
}
test('all first ten PDF pages receive OCR fallback when a long text layer produces no fields',async()=>{
 const {reader,counts}=scanSetup({pages:12});const result=await reader.scan([{name:'test.pdf',size:100,arrayBuffer:async()=>new ArrayBuffer(1)}]);
 assert.equal(counts().ocrCount,10);assert.equal(counts().destroyed,1);assert.equal(result.reports[0].pages,10);assert.match(result.reports[0].issues[0],/12/);assert.equal(values(result.rows).trade_name[0],'مؤسسة اختبار');
});
test('zero extraction exposes each file reason and readable source, not a false success',async()=>{
 const {reader}=scanSetup({pages:1,ocrFails:true});const result=await reader.scan([{name:'test.pdf',size:100,arrayBuffer:async()=>new ArrayBuffer(1)},{name:'bad.docx',size:100}]);
 assert.equal(result.failures.length,2);assert.match(result.reports[0].issues[0],/الإنترنت/);assert.equal(result.reports[0].texts.length,1);assert.match(result.reports[1].issues[0],/صيغة/);
});
test('usable text avoids OCR and cancellation is honored before reading files',async()=>{
 const {reader,counts}=scanSetup({pages:2,text:'الاسم التجاري: مؤسسة اختبار للتجارة\nالرقم الوطني الموحد: 7001234567'});
 await reader.scan([{name:'text.pdf',size:100,arrayBuffer:async()=>new ArrayBuffer(1)}]);assert.equal(counts().ocrCount,0);
 await assert.rejects(reader.scan([{name:'test.pdf',size:100}],()=>{},{signal:{aborted:true}}),e=>e.name==='AbortError');
});
