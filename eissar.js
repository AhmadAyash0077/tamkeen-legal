/* Public Eissar announcements. Customer data stays in this browser. */
'use strict';
const UXEIS_API='https://bankruptcy.gov.sa/eservices/api/AnnouncementNewDataPagedAPI';
const UXEIS_LIST='https://bankruptcy.gov.sa/ar/Announcements/Pages/default.aspx';
const UXEIS_TTL=6*60*60*1000;
const UXEIS={items:[],lastAt:'',busy:false,error:'',progress:0,totalPages:0,total:0,listeners:new Set()};
function uxEisText(value){return String(value??'').replace(/<[^>]*>/g,' ').replace(/&nbsp;|&#160;/g,' ').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim();}
function uxEisItem(row){
  const id=Number(row.AnnId||row.Id);const name=uxEisText(row.Header||row.debtorName);const alias=uxEisText(row.debtorName);
  if(!Number.isSafeInteger(id)||id<=0||!name)throw Error('بيانات إعلان غير مكتملة');
  // debtorIdentifier can also be a natural person's national ID. Do not label it a CR.
  const rawCr=uxDig(row.debtorIdentifier);return{id,name,alias,cr:/^7\d{9}$/.test(rawCr)?rawCr:'',procedure:uxEisText(row.ActionType),date:String(row.PublishDate||'').slice(0,10),court:uxEisText(row.CourtType),brief:uxEisText(row.Comment).slice(0,400)};
}
function uxEisLink(item){return 'https://bankruptcy.gov.sa/ar/Announcements/Pages/announcementDetails.aspx?AdID='+Number(item.id);}
function uxEisEmit(){for(const fn of [...UXEIS.listeners])try{fn()}catch(e){UXEIS.listeners.delete(fn)}}
async function uxEisPage(page){
  const abort=new AbortController();const timer=setTimeout(()=>abort.abort(),25000);
  try{const response=await fetch(UXEIS_API+'?page='+page+'&pageSize=100',{credentials:'omit',headers:{Accept:'application/json'},signal:abort.signal});if(!response.ok)throw Error('استجابة إيسار '+response.status);if(!/application\/json/i.test(response.headers?.get('content-type')||''))throw Error('لم يُرجع إيسار بيانات الإعلانات للصفحة '+page+'؛ تعذّر التحقق من الاتصال');const d=await response.json();
    if(!Array.isArray(d.Items)||!Number.isSafeInteger(d.TotalRecords)||d.TotalRecords<1||!Number.isSafeInteger(d.TotalPages)||d.TotalPages<1||d.TotalPages>250||d.Page!==page||d.PageSize!==100)throw Error('تغيّر تنسيق بيانات إيسار أو لم تكتمل الاستجابة');
    return d;
  }finally{clearTimeout(timer)}
}
async function uxEisSync(){
  if(UXEIS.busy)return;UXEIS.busy=true;UXEIS.error='';UXEIS.progress=0;UXEIS.totalPages=0;uxEisEmit();
  try{const first=await uxEisPage(1);const rows=[...first.Items];UXEIS.totalPages=first.TotalPages;UXEIS.progress=1;uxEisEmit();
    // Read one public page at a time without sending any client identifiers.
    for(let page=2;page<=first.TotalPages;page++){await new Promise(resolve=>setTimeout(resolve,2500));const data=await uxEisPage(page);if(data.TotalRecords!==first.TotalRecords||data.TotalPages!==first.TotalPages)throw Error('تغيّرت قائمة الإعلانات أثناء القراءة؛ أعد المزامنة');rows.push(...data.Items);UXEIS.progress++;uxEisEmit()}
    const items=[...new Map(rows.map(row=>{const item=uxEisItem(row);return[item.id,item]})).values()];
    if(items.length!==first.TotalRecords)throw Error('عدد الإعلانات المستلمة لا يطابق المصدر؛ لم تُعتمد المزامنة');
    items.sort((a,b)=>b.date.localeCompare(a.date)||b.id-a.id);UXEIS.items=items;UXEIS.total=first.TotalRecords;UXEIS.lastAt=new Date().toISOString();
    LS.set('uxEissarPublicV1',{items,lastAt:UXEIS.lastAt,total:UXEIS.total});
  }catch(error){UXEIS.error=error?.name==='AbortError'?'انتهت مهلة الاتصال بإيسار':String(error.message||'تعذّر الاتصال بإيسار');}
  finally{UXEIS.busy=false;uxEisEmit()}
}
function uxEisName(name){return uxMtKey(uxEisText(name)).full;}
function uxEisMatches(){
  const byCr=new Map(),byName=new Map();
  for(const a of UXEIS.items){if(a.cr){if(!byCr.has(a.cr))byCr.set(a.cr,[]);byCr.get(a.cr).push(a)}for(const key of new Set([uxEisName(a.name),uxEisName(a.alias)])){if(key.split(' ').filter(Boolean).length>=2){if(!byName.has(key))byName.set(key,[]);byName.get(key).push(a)}}}
  const matches=[];for(const client of uxBkrClients()){
    const exact=client.crs.flatMap(cr=>byCr.get(cr)||[]);let ads=exact,how='رقم السجل';
    if(!ads.length){ads=(byName.get(uxEisName(client.name))||[]).filter(a=>!a.cr||!client.crs.length||client.crs.includes(a.cr));how='الاسم — يحتاج مراجعة';}
    if(ads.length)matches.push({...client,ads:[...new Map(ads.map(a=>[a.id,a])).values()],how});
  }return matches;
}
function uxEisPanel(){
  const box=h('section',{class:'ux-panel',style:'--pc:#30d158'});let shown=20;
  const paint=()=>{const matches=uxEisMatches();const stale=UXEIS.lastAt&&Date.now()-Date.parse(UXEIS.lastAt)>UXEIS_TTL;
    const state=UXEIS.busy?`جارٍ قراءة إعلانات إيسار (${UXEIS.progress} / ${UXEIS.totalPages||'…'})`:UXEIS.error?'تعذّرت المزامنة':UXEIS.lastAt?(stale?'البيانات تحتاج تحديثاً':'متصل بإيسار'):'لم تتم المزامنة بعد';
    box.replaceChildren(h('div',{class:'ux-panel-h'},h('h2',null,icon('link'),' الربط المباشر مع إيسار'),h('button',{class:'btn primary',disabled:UXEIS.busy,onclick:uxEisSync},icon('refresh'),'مزامنة إيسار الآن')),
      h('div',{class:'banner '+(UXEIS.error?'bad':stale?'warn':'info')},state),
      h('p',{class:'small muted'},'يقرأ الإعلانات العامة من إيسار ويطابقها مع عملاء العقود وطلبات التنفيذ داخل متصفحك. لا تُرسل بيانات العملاء إلى إيسار. تتحدث البيانات عند فتح البرنامج إذا مضت 6 ساعات.'),
      UXEIS.lastAt?h('p',{class:'small'},`آخر مزامنة مكتملة: ${fmtTs(UXEIS.lastAt)} · ${nf.format(UXEIS.items.length)} إعلان · ${matches.length} عميل له مطابقة`):null,
      UXEIS.error?h('p',{class:'small'},UXEIS.error+(UXEIS.lastAt?' — تُعرض نتائج آخر مزامنة مكتملة فقط.':' — لا توجد نتيجة تحقق معتمدة.')):null,
      h('p',{class:'small muted'},'نطاق الربط: الإعلانات العامة المتاحة في إيسار، وليس شهادة من سجل الإفلاس. المطابقة بالاسم تحتاج مراجعة الإعلان ورقم السجل. عدم وجود مطابقة لا يعني أن العميل سليم، وتاريخ النشر لا يعني أن الإجراء ما زال قائماً.'),
      h('div',{class:'row'},h('a',{class:'btn sm',href:UXEIS_LIST,target:'_blank',rel:'noopener noreferrer'},'فتح الإعلانات الرسمية')),
      matches.length?h('div',null,h('h3',null,'مطابقات إعلانات إيسار للمراجعة'),matches.slice(0,shown).map(m=>h('div',{class:'panel',style:'margin-top:10px'},h('a',{href:'#'+m.mod+'-'+m.r.id},h('b',null,m.name)),h('span',{class:'pill warn',style:'margin-inline-start:8px'},m.how),
        m.ads.slice(0,5).map(a=>h('div',{class:'small',style:'margin-top:8px'},h('a',{href:uxEisLink(a),target:'_blank',rel:'noopener noreferrer'},a.name+' — '+(a.procedure||'إعلان')+' — '+(a.date||'تاريخ غير مذكور')),h('p',{class:'muted'},a.brief))),m.ads.length>5?h('small',null,`وله ${m.ads.length-5} إعلانات أخرى؛ راجع المصدر الرسمي`):null)),matches.length>shown?h('button',{class:'btn',onclick:()=>{shown+=20;paint()}},'عرض المزيد'):null):UXEIS.lastAt?h('p',null,'لا توجد مطابقة في الإعلانات المقروءة. يُستكمل التحقق الرسمي من سجل الإفلاس عند الحاجة.'):null);
  };
  const listener=()=>{if(!box.isConnected){UXEIS.listeners.delete(listener);return}paint()};UXEIS.listeners.add(listener);paint();return box;
}
{
  const original=uxBkrPanel;uxBkrPanel=function(){return h('section',{class:'ux-eissar-connected'},uxEisPanel(),original())};
  const originalDetail=viewDetail;viewDetail=function(mod,id){const view=originalDetail(mod,id);if(mod!=='contracts'&&mod!=='executions')return view;
    const inject=()=>{view.el.querySelector('#uxEissarMatch')?.remove();const match=uxEisMatches().find(m=>m.mod===mod&&m.r.id===id);if(!match)return;const main=view.el.querySelector('.mainc');if(main)main.prepend(h('div',{id:'uxEissarMatch',class:'banner warn'},'إيسار: إعلان يطابق هذا العميل ('+match.how+'). راجع المصدر قبل اعتماد النتيجة. ',h('a',{href:uxEisLink(match.ads[0]),target:'_blank',rel:'noopener noreferrer'},'فتح الإعلان الرسمي')))};
    const refresh=view.refresh;view.refresh=(...args)=>{if(refresh)refresh(...args);inject()};inject();return view;
  };
}
try{const cache=LS.get('uxEissarPublicV1',null);if(cache&&Array.isArray(cache.items)&&cache.items.length===cache.total&&Number.isFinite(Date.parse(cache.lastAt))&&cache.items.every(a=>Number.isSafeInteger(a.id)&&typeof a.name==='string'&&typeof a.date==='string')){UXEIS.items=cache.items;UXEIS.lastAt=cache.lastAt;UXEIS.total=cache.total;}}catch(e){}
// Sync only while the app is open; no background service or account credentials are required.
setTimeout(()=>{if(!UXEIS.lastAt||Date.now()-Date.parse(UXEIS.lastAt)>UXEIS_TTL)uxEisSync()},3000);
