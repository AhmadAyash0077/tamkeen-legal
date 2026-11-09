/* Memory stays inside the source record, using its existing permissions. */
(() => {
  const core=window.LegalMemoryCore;
  const selected=new Map();
  const scope=(mod,id)=>mod+':'+id;
  async function change(mod,id,mutate){
    if(S.readOnly||!canSee(mod))throw Error('لا تملك صلاحية التعديل');
    const snap=await db.collection(mod).doc(id).get();
    if(!snap.exists||snap.data().deleted)throw Error('السجل غير متاح');
    const current=snap.data();
    const result=await writeDoc(mod,id,{assistantMemory:mutate(current)},current.rev||0);
    if(!result.ok)throw Error(result.conflict?'تغيّرت البيانات؛ أعد المحاولة بعد تحديث السجل.':'لم تُحفظ الذاكرة.');
    audit('تحديث ذاكرة السجل',mod,id,'');
    return result.data;
  }
  async function save(mod,id,text,question='',kind='note'){
    return change(mod,id,r=>core.append(r,{id:crypto.randomUUID(),text,question,kind,by:S.me.id,at:new Date().toISOString()}));
  }
  function context(mod,id){return canSee(mod)?core.context(rec(mod,id),selected.get(scope(mod,id))||[]):''}
  async function bridge(path,body){
    const token=await window.__CLOUD.mailSessionToken();
    const response=await fetch('http://127.0.0.1:37721'+path,{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+token},body:JSON.stringify(body),signal:AbortSignal.timeout(20000)});
    const data=await response.json();
    if(!response.ok)throw Error(data.error||'تعذر الربط المحلي');
    return data;
  }
  function panel(mod,initial){
    const id=initial.id,key=scope(mod,id),box=h('section',{class:'panel legal-memory','data-memory-record':key});
    const list=h('div'),status=h('p',{class:'small muted',role:'status'});
    const note=h('textarea',{rows:3,maxlength:core.MAX_TEXT,'aria-label':'إضافة إلى ذاكرة السجل',placeholder:'قرار سابق، ملخص متابعة، أو نتيجة تحتاج مراجعة…'});
    let current=initial;
    const run=async(fn)=>{try{current=await fn();paint();status.textContent='حُفظت الذاكرة على السجل.'}catch(e){status.textContent=e.message}};
    function paint(){
      const readonly=S.readOnly||current.deleted;
      list.replaceChildren(...core.entries(current).map(item=>{
        const cb=h('input',{type:'checkbox',disabled:!item.reviewed||item.withdrawn,checked:(selected.get(key)||[]).includes(item.id),'aria-label':'تضمين بند الذاكرة في التحليل',onchange:()=>{
          const ids=new Set(selected.get(key)||[]);cb.checked?ids.add(item.id):ids.delete(item.id);selected.set(key,[...ids]);
        }});
        const review=!readonly&&!item.reviewed&&!item.withdrawn&&canAdmin()?h('button',{class:'btn sm',onclick:()=>run(()=>change(mod,id,r=>core.entries(r).map(x=>x.id===item.id?{...x,reviewed:true,reviewedBy:S.me.id,reviewedAt:new Date().toISOString()}:x)))},'تأكيد المراجعة'):null;
        const withdraw=!readonly&&!item.withdrawn?h('button',{class:'btn sm ghost',onclick:()=>run(()=>change(mod,id,r=>core.entries(r).map(x=>x.id===item.id?{...x,withdrawn:true,withdrawnBy:S.me.id,withdrawnAt:new Date().toISOString()}:x)))},'استبعاد من الاستخدام'):null;
        return h('details',null,h('summary',null,item.withdrawn?'مستبعد':item.reviewed?'مُراجع':'مسودة تحتاج مراجعة',' · ',String(item.at||'').slice(0,10),' · ',item.text.slice(0,90)),
          item.question?h('p',null,'السؤال: '+item.question):null,h('p',{style:'white-space:pre-wrap'},item.text),h('div',{class:'row'},h('label',{class:'check'},cb,'تضمينه في التحليل التالي'),review,withdraw));
      }));
      if(!core.entries(current).length)list.append(h('p',{class:'muted'},'لا توجد ذاكرة محفوظة لهذا السجل بعد.'));
    }
    const add=h('button',{class:'btn sm primary',disabled:S.readOnly||initial.deleted,onclick:()=>run(async()=>{const r=await save(mod,id,note.value);note.value='';return r})},'حفظ في ذاكرة السجل');
    const sync=window.__CLOUD?.role()==='owner'?h('button',{class:'btn sm',onclick:async()=>{
      status.textContent='جارٍ مزامنة الذاكرة المراجعة مع claude-mem على هذا الجهاز…';
      try{const result=await bridge('/sync',{mod,id});status.textContent=result.empty?'لا توجد بنود مراجعة فعّالة؛ أزيلت النسخة المحلية السابقة.':'تمت مزامنة '+result.count+' بنود مع claude-mem على هذا الجهاز.'}catch(e){status.textContent='الذاكرة السحابية محفوظة. تعذرت المزامنة المحلية: '+e.message}
    }},'مزامنة مع claude-mem'):null;
    box.append(h('h3',null,'ذاكرة السجل والموظف'),h('p',{class:'small muted'},'تُحفظ الملاحظات والمحادثات هنا بصلاحيات السجل نفسه. راجع البنود ثم حدد ما تريد تضمينه في التحليل؛ لا تُرسل الذاكرة تلقائيًا. المزامنة المحلية تنسخ البنود المراجعة فقط إلى جهاز مدير النظام، وتحتاج إعادة المزامنة بعد تغييرها أو استبعادها.'),list,note,h('div',{class:'row'},add,sync),status);
    paint();return box;
  }
  function capture(mod,id,text,question){
    return h('button',{class:'btn sm',onclick:async e=>{const button=e.currentTarget;button.disabled=true;try{await save(mod,id,text,question,'analysis');button.textContent='حُفظ الرد كمسودة في الذاكرة'}catch(error){toast(error.message);button.disabled=false}}},'حفظ السؤال والرد في الذاكرة');
  }
  window.TamkeenMemory={panel,context,capture,save};
})();
