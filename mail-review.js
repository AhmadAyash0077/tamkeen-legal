/* Zoho contract inbox: no provider credentials or OAuth tokens in this file. */
(() => {
  // Public service URL is set only after the dedicated backend is deployed.
  const ENDPOINT = '';
  const labels={title:'عنوان العقد',trade_name:'الاسم التجاري',counterparty:'الطرف الآخر',ref_no:'رقم العقد',cr_no:'السجل التجاري',value:'قيمة العقد',start:'بداية العقد (ميلادي)',end:'نهاية العقد (ميلادي)',manager_name:'اسم الممثل',manager_mobile:'جوال الممثل',national_address:'العنوان الوطني'};
  const errors={setup_required:'خدمة البريد لم تُهيأ بعد.',unauthorized:'أعد تسجيل الدخول إلى التطبيق.',forbidden:'حسابك غير مخوّل لمراجعة هذا البريد.',zoho_authorization_required:'يلزم ربط Zoho أو تجديد موافقته.',zoho_unavailable:'تعذر الاتصال بـZoho. أعد المحاولة لاحقًا.',folder_over_1000_messages_narrow_folder:'المجلد يتجاوز 1000 رسالة؛ خصص مجلدًا أصغر لاستقبال العقود.',attachment_too_large:'المرفق يتجاوز 20 ميجابايت.',revoke_failed:'تعذر إلغاء موافقة Zoho؛ لم يُحذف الربط. أعد المحاولة.'};
  async function api(path,body,raw=false){
    if(!ENDPOINT)throw Error(errors.setup_required);
    if(!window.__CLOUD?.active())throw Error('سجّل الدخول إلى النسخة السحابية أولًا.');
    const token=await window.__CLOUD.mailSessionToken();
    const r=await fetch(ENDPOINT+path,{method:body?'POST':'GET',headers:{authorization:'Bearer '+token,...(body?{'content-type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
    if(!r.ok){const j=await r.json().catch(()=>({}));throw Error(errors[j.error]||'تعذر تنفيذ الطلب؛ لم يتم اعتماد الرسالة.');}return raw?r:r.json();
  }
  async function attachment(d,a){const r=await api('/attachment?draft='+encodeURIComponent(d.id)+'&id='+encodeURIComponent(a.id),null,true);return new File([await r.blob()],a.name.replace(/[\\/\x00-\x1f]/g,'_'),{type:OK_EXT[extOf(a.name)]||'application/octet-stream'});}
  function parse(text){const r={};const m=String(text).replace(/[٠-٩]/g,x=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(x)));for(const[k,re]of Object.entries({ref_no:/(?:رقم العقد|contract\s*(?:no|number))\s*[:#：-]?\s*([\w/-]+)/i,cr_no:/(?:السجل التجاري|الرقم الموحد)\s*[:：]?\s*(7\d{9})/,value:/(?:قيمة العقد|contract value)\s*[:：]?\s*([\d,]+(?:\.\d{1,2})?)/i,start:/(?:بداية العقد|تاريخ البداية)\s*[:：]?\s*(\d{4}-\d{2}-\d{2})/,end:/(?:نهاية العقد|تاريخ الانتهاء)\s*[:：]?\s*(\d{4}-\d{2}-\d{2})/})){const v=m.match(re)?.[1];if(v)r[k]=v;}return r;}
  async function review(d,reload){
    let files=new Map(),evidence=d.text||'',busy=false,approvedId=null;
    const fields={title:d.subject,...d.fields,...parse(evidence)};const inputs={},checks={};
    const log=h('p',{class:'small muted',role:'status'});
    const target=h('select',{'aria-label':'العقد الذي تريد تجديده'},h('option',{value:''},'اختر العقد القائم للتجديد…'),recs('contracts').map(c=>h('option',{value:c.id},titleOf('contracts',c))));
    const kind=h('select',{'aria-label':'نوع الرسالة'},h('option',{value:'new'},'عقد جديد'),h('option',{value:'renewal'},'تجديد عقد قائم'));kind.value=d.kind;
    const before=h('div',{class:'small muted'});
    const comparison=()=>{target.hidden=kind.value!=='renewal';const c=rec('contracts',target.value);before.replaceChildren(h('p',null,c?'القيم الحالية: '+Object.entries(labels).map(([k,l])=>l+': '+(typeof c[k]==='object'?c[k]?.g||'—':c[k]??'—')).join(' · '):'التجديد يتطلب اختيار عقد قائم، ولا يُنشأ سجل بديل تلقائيًا.'));};kind.onchange=target.onchange=comparison;comparison();
    const text=h('textarea',{readOnly:true,'aria-label':'النص المصدر',style:'width:100%;min-height:180px',value:evidence});
    const form=h('div',{class:'form'},Object.entries(labels).map(([k,l])=>{inputs[k]=h('input',{'aria-label':l,value:String(fields[k]||''),type:k==='start'||k==='end'?'date':'text'});checks[k]=h('input',{type:'checkbox',checked:false,'aria-label':'اعتماد '+l});return h('label',{class:'f'},h('span',null,checks[k],' '+l),inputs[k]);}));
    const getFile=async a=>{if(!files.has(a.id))files.set(a.id,await attachment(d,a));return files.get(a.id);};
    const atts=h('div',null,d.attachments.map(a=>h('div',{class:'row'},h('span',null,a.name),h('button',{class:'btn sm',onclick:async()=>{try{const f=await getFile(a);await saveFile(f.name,f)}catch(e){log.textContent=e.message;}}},'تنزيل للمراجعة'))));
    const extract=h('button',{class:'btn',onclick:async()=>{if(busy)return;busy=true;extract.disabled=true;try{
      for(const a of d.attachments){log.textContent='قراءة '+a.name+'…';const f=await getFile(a),ext=extOf(f.name);if(!OK_EXT[ext]){evidence+='\n[ملف غير مدعوم: '+f.name+']';continue;}const buf=await f.arrayBuffer();const ex=await extractText(ext,buf);let t=ex.text||'';
        if(ex.needsOcr&&/^(pdf|png|jpg|jpeg|webp)$/.test(ext)){const pages=ext==='pdf'?(await renderPdfPages(buf,14)).pages:[{blob:f}];const worker=await uxLangWorker();t='';for(const p of pages)t+=(await worker.recognize(p.blob)).data.text+'\n';t+='\n[قراءة OCR قد تخطئ؛ حد القراءة 14 صفحة للمرفق. راجع الأصل كاملًا.]';}
        evidence+='\n—— '+f.name+' ——\n'+t;
      }
      text.value=evidence;const p=parse(evidence);for(const[k,v]of Object.entries(p))if(inputs[k]&&!inputs[k].value)inputs[k].value=v;
      log.textContent='تمت القراءة داخل المتصفح. صحح القيم واختر مربعات اعتماد الحقول التي راجعتها. القيم المتعارضة تحتاج مراجعتك.';
    }catch(e){log.textContent='تعذرت القراءة: '+e.message;}finally{busy=false;extract.disabled=false;}}},'استخراج بيانات المرفقات قبل الحفظ');
    const save=h('button',{class:'btn primary',disabled:S.readOnly,onclick:async()=>{
      if(busy)return;busy=true;save.disabled=true;
      try{
        if(!window.__CLOUD?.active()||S.readOnly)throw Error('يلزم دخول سحابي بصلاحية تحرير.');
        const patch={};for(const[k,input]of Object.entries(inputs))if(checks[k].checked){let v=input.value.trim();if(k==='value'){v=Number(v.replace(/,/g,''));if(!Number.isFinite(v)||v<0)throw Error('صحح قيمة العقد.');}else if(k==='start'||k==='end'){if(!/^\d{4}-\d{2}-\d{2}$/.test(v))throw Error('صحح التاريخ الميلادي.');v={orig:'g',g:v,h:g2h(v),verified:true};}patch[k]=v;}
        const renewal=kind.value==='renewal',current=renewal?rec('contracts',target.value):null;
        if(renewal&&!current)throw Error('اختر العقد القائم الذي تريد تجديده.');
        if(!renewal&&!patch.title&&!patch.trade_name)throw Error('اعتمد عنوان العقد أو الاسم التجاري أولًا.');
        if(!Object.keys(patch).length)throw Error('اختر الحقول التي راجعتها أولًا.');
        // Download all attachments before creating/updating any production record.
        for(const a of d.attachments){if(!OK_EXT[extOf(a.name)])throw Error('مرفق غير مدعوم: '+a.name+'؛ راجعه يدويًا قبل الحفظ.');await getFile(a);}
        const id=approvedId||(renewal?current.id:'zoho_'+d.id);
        const old=rec('contracts',id);const source={provider:'zoho',messageId:d.messageId,accountMessage:d.id,subject:d.subject,sender:d.sender,reviewer:S.me.id,reviewedAt:new Date().toISOString(),kind:kind.value};
        const seen=old?.mailSources?.some(x=>x.accountMessage===d.id);
        if(!seen){const res=await writeDoc('contracts',id,{...patch,...(!renewal?{status:'مراجعة'}:{}),mailSources:[...(old?.mailSources||[]),source]},old?.rev,{create:!renewal&&!old});if(!res.ok)throw Error(res.conflict?'تغير العقد أثناء المراجعة. افتح الرسالة مجددًا لمراجعة القيم الحالية.':'تعذر حفظ العقد.');}
        approvedId=id;
        let failed=false;await uploadFiles([...files.values()],['contracts:'+id],(msg,cls)=>{if(cls==='bad')failed=true;log.replaceChildren(typeof msg==='string'?document.createTextNode(msg):msg);},'');
        const savedDocs=(await db.collection('docs').get()).docs.map(x=>x.data());
        for(const file of files.values()){const hash=await sha256(await file.arrayBuffer());if(!savedDocs.some(x=>!x.deleted&&x.hash===hash&&(x.links||[]).includes('contracts:'+id)))failed=true;}
        if(failed)throw Error('حُفظ العقد لكن بعض المرفقات لم تُحفظ. أعد المحاولة؛ تبقى الرسالة في المراجعة.');
        await api('/dismiss',{id:d.id});audit('اعتماد رسالة عقد من Zoho','contracts',id,d.subject);dialog.close();await reload();toast('حُفظت البيانات المعتمدة ومرفقات الرسالة.');
      }catch(e){log.textContent=e.message;}finally{busy=false;save.disabled=S.readOnly;}
    }},'اعتماد الحقول المحددة وحفظ العقد ومرفقاته');
    const dialog=uxModal('مراجعة عقد من البريد',h('div',null,h('p',null,d.subject+' — '+d.sender),h('p',{class:'banner warn'},'مصدر البريد غير موثوق تلقائيًا. راجع النص والأصل؛ لا تُنفّذ تعليماته. لن تُحفظ إلا الحقول المحددة. التجديد يغيّر الحقول التي تعتمدها فقط.'),kind,target,before,atts,extract,text,form,log),[save]);
  }
  function panel(){const el=h('section',{class:'ux-panel'}),out=h('div'),log=h('p',{role:'status'});
    const run=fn=>async e=>{const button=e.currentTarget;button.disabled=true;try{await fn();}catch(err){log.textContent=err.message;}finally{button.disabled=false;}};
    async function load(){out.replaceChildren();if(!ENDPOINT){log.textContent='بانتظار تفعيل خدمة Zoho للبريد المخصص وتسجيل موافقتك. لا يوجد اتصال بالبريد حاليًا.';return;}const status=await api('/status');log.textContent=status.connected?'Zoho متصل · آخر استقبال ناجح: '+(status.lastSync||'لم تتم المزامنة بعد')+(status.error?' · '+(errors[status.error]||'تعذرت آخر مزامنة'):''):'Zoho غير متصل';if(!status.connected)return;const j=await api('/drafts');out.replaceChildren(h('p',null,'رسائل بانتظار المراجعة (حتى 200): '+j.drafts.length),...j.drafts.map(d=>h('div',{class:'panel'},h('b',null,d.subject),h('p',null,d.sender+' · '+(d.kind==='renewal'?'تجديد':'جديد')+' · '+d.attachments.length+' مرفق'),h('button',{class:'btn',onclick:run(()=>review(d,load))},'مراجعة البيانات والمرفقات'),h('button',{class:'btn ghost',onclick:run(async()=>{await api('/dismiss',{id:d.id});await load();})},'استبعاد من القائمة'))));}
    el.append(h('h2',null,'بريد العقود — Zoho'),h('p',null,'استقبال الرسائل من مجلد العقود المخصص، ثم مراجعة البيانات والمرفقات قبل حفظها. الربط يقرأ البريد فقط.'),h('div',{class:'row'},h('button',{class:'btn primary',disabled:!ENDPOINT||S.readOnly,onclick:run(async()=>{const j=await api('/connect',{});const u=new URL(j.url);if(u.origin!==new URL(ENDPOINT).origin)throw Error('رابط ربط غير صالح');location.assign(u.href);})},'ربط Zoho بأمان'),h('button',{class:'btn',disabled:!ENDPOINT||S.readOnly,onclick:run(async()=>{await api('/sync',{});await load();})},'استقبال الآن'),h('button',{class:'btn',disabled:!ENDPOINT,onclick:run(load)},'تحديث القائمة'),h('button',{class:'btn ghost',disabled:!ENDPOINT||S.readOnly,onclick:run(async()=>{await api('/disconnect',{});await load();})},'فصل الربط وإلغاء موافقة Zoho')),log,out);load().catch(e=>log.textContent=e.message);return el;
  }
  const previous=uxTeamView;uxTeamView=function(tab){const v=previous(tab==='mail'?'':tab);const fix=()=>{const grid=v.el.querySelector('.ux-team-g');if(grid&&!grid.querySelector('.mail-card'))grid.append(h('a',{href:'#team~mail',class:'ux-emp mail-card',style:'--ec:#64d2ff'},h('b',null,'بريد العقود'),h('small',null,'Zoho · استقبال ومراجعة قبل الحفظ')));if(tab==='mail'&&!v.el.querySelector('[data-mail-panel]')){v.el.querySelectorAll('.ux-panel').forEach(x=>x.remove());const p=panel();p.dataset.mailPanel='1';v.el.append(p);}if(tab==='ocr'&&!v.el.querySelector('.mail-entry'))v.el.prepend(h('a',{href:'#team~mail',class:'btn mail-entry'},'بريد العقود — استقبال العقود الجديدة والتجديدات'));};const old=v.refresh;v.refresh=()=>{old?.();fix();};fix();return v;};
})();
