const {test}=require('node:test');const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');const vm=require('node:vm');
// تحميل ai-employees.js في بيئة متصفح مصغّرة للوصول إلى موجّه الأوامر فقط
function load(){
  const el=()=>({append(){},appendChild(){},setAttribute(){},style:{},textContent:''});
  const win={document:{readyState:'complete',createElement:el,head:{appendChild(){}},addEventListener(){}},localStorage:{getItem:()=>null,setItem(){}}};
  win.window=win;vm.createContext(win);
  vm.runInContext(fs.readFileSync(path.join(__dirname,'..','ai-employees.js'),'utf8'),win);
  return win.aiRouteCommand;
}
const route=load();
test('routes WhatsApp and summary requests to the reports employee',()=>{
  assert.deepEqual({...route('أرسل ملخص اليوم على واتساب')},{emp:'reports',task:'ملخص اليوم على واتساب'});
  assert.equal(route('موجز اليوم').task,'ملخص اليوم على واتساب');
});
test('routes report requests by subject',()=>{
  assert.equal(route('تقرير القضايا المفتوحة').task,'تقرير القضايا المفتوحة');
  assert.equal(route('أبي تقرير العقود').task,'تقرير العقود');
  assert.equal(route('تقرير المخالفات').task,'تقرير المخالفات');
  assert.equal(route('تقرير طلبات التنفيذ').task,'تقرير طلبات التنفيذ');
});
test('routes deadlines, stalled collection and missing data',()=>{
  assert.equal(route('الجلسات والمهل القادمة').task,'الجلسات والمهل خلال 14 يومًا');
  assert.equal(route('طلبات التنفيذ المتوقفة').task,'طلبات التنفيذ المتوقفة');
  const q=route('البيانات الناقصة');assert.equal(q.emp,'data');assert.equal(q.task,'فحص البيانات الناقصة في كل الأقسام');
  assert.equal(route('افحص الإفلاس').task,'فحص العملاء في قائمة الإفلاس');
});
test('maps record-writing requests to their tasks (the desk then waits for نفّذ)',()=>{
  assert.equal(route('جهز التجديدات').task,'تجهيز تجديدات عقود التركيب');
  assert.equal(route('مطابقة ملفات الجملة').task,'مطابقة ملفات الجملة مع طلبات التنفيذ');
});
test('returns null for requests it does not understand',()=>{
  assert.equal(route('كيف الجو اليوم'),null);assert.equal(route(''),null);
});
