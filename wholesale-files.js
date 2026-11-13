/* Wholesale onboarding uses the cloud session and a dedicated, role-checked RPC. */
(() => {
  const routeHash = '#team~wholesale';
  const signers = ['أحمد عياش','سلطان القصيمي','زهير بن زاهر — المدير التنفيذي'];
  const statuses = {signatures:'بانتظار التوقيعات',accounting:'بانتظار كود المحاسب',requirements:'بانتظار استيفاء المتطلبات',active:'مكتمل وساري'};
  const kinds = {support:'مستند داعم',nafith:'سند نافذ موقّع',chamber:'تصديق الغرفة',customer:'توقيع العميل',zoho:'شهادة إتمام Zoho Sign'};
  const providerStatus={completed:'مكتمل',inprogress:'قيد التوقيع',draft:'مسودة',declined:'مرفوض',expired:'منتهي',recalled:'مسترجع'};
  const actions = {create:'إنشاء الملف',intake:'حفظ رسالة ومرفقات',document:'إضافة نسخة مستند',prepare:'تجهيز بيانات سند نافذ',review_documents:'مراجعة مستندات العميل',proof:'توثيق متطلب',signature:'توثيق توقيع',code:'إضافة كود العميل',sign_check:'موافقة على قراءة Zoho Sign'};
  const errors = {
    wholesale_forbidden:'حسابك غير مخوّل لفتح ملفات العملاء أو تنفيذ هذه الخطوة.',
    invalid_identity:'أدخل اسم المنشأة ورقم سجل أو رقمًا موحدًا من 10 أرقام.',
    duplicate_client:'يوجد ملف بهذا الرقم أو بالعقد المرتبط. أعد التحقق وافتح الملف القائم.',
    legacy_link_required:'يوجد عقد جملة بالرقم نفسه. اختره للربط.',
    legacy_conflict:'العقد المحدد لا يطابق البيانات المدخلة.',
    legacy_review_required:'راجع تشابه الأسماء قبل إنشاء ملف مستقل.',
    mail_disabled:'الاستقبال من Zoho Mail بانتظار التهيئة.',
    duplicate_intake:'سبق حفظ الرسالة أو معرفها.',
    duplicate_code:'الكود مستخدم في ملف آخر.',
    invalid_code:'أدخل كود العميل.',
    invalid_intake:'الصق رسالة واتساب أو أرفق مستندًا صالحًا.',
    invalid_document:'تحقق من نوع المرفق وحجمه. الحد 5 ميجابايت للملف.',
    invalid_nafith:'أدخل اسم محرر السند والمبلغ بالريال وتاريخ الاستحقاق.',
    nafith_already_verified:'وثّق السند بناء على البيانات المحفوظة. تعديلها بعد التوثيق يتطلب مراجعة مسؤول النظام.',
    invalid_profile:'راجع خانات بيانات العميل والرقم الموحّد قبل الحفظ.',
    profile_changed:'تغيرت بيانات الملف منذ فتحه. أعد فتح الملف وقارن القيم قبل الحفظ.',
    intake_size_limit:'مجموع المرفقات يتجاوز 16 ميجابايت. احفظ جزءًا منها ثم أضف البقية إلى الملف نفسه.',
    invalid_documents_review:'حدد النسخ الحالية من المستندات المطلوبة واكتب ما تحققت من صلاحيته.',
    invalid_proof:'اختر مستند الإثبات واكتب المرجع وأكّد مراجعته.',
    invalid_signature:'تحقق من رقم طلب Zoho والتاريخ وشهادة الإتمام.',
    signature_order:'أثبت التوقيعات حسب ترتيبها ومن الطلب والشهادة نفسيهما.',
    signature_reused:'رقم طلب Zoho مستخدم في ملف آخر.',
    zoho_verification_required:'تحقق من اكتمال الطلب في Zoho Sign أولًا، ثم راجع شهادة الإتمام.',
    signatures_pending:'يلزم اكتمال التوقيعات الثلاثة قبل إدخال كود العميل.',
    setup_required:'خدمة ملفات الجملة أو ربط Zoho Sign بانتظار إعداد مسؤول النظام.',
    sign_mismatch:'بيانات طلب Zoho لا تطابق هذا الملف وتسلسل الموقّعين المعتمد.',
    sign_unavailable:'تعذرت قراءة طلب Zoho Sign. تحقّق من الرقم والربط.'
  };
  const attachmentLimit=12, attachmentBytes=5*1024*1024, batchBytes=16*1024*1024;
  const btn = (label, callback, cls='btn') => h('button',{class:cls,type:'button',onclick:callback},label);
  const field=(label,control)=>{
    control.setAttribute('aria-label',label);
    return h('label',{class:'f'},h('span',null,label),control);
  };
  const input = (value='', attrs={}) => h('input',{type:'text',value,...attrs});
  const select = (options,selected='') => {
    const node = h('select',null,options.map(([value,label])=>h('option',{value},label)));
    node.value = selected;
    return node;
  };
  const panel = (title,...children) => h('section',{class:'panel wf-panel'},h('h2',null,title),...children);
  const grid = (...children) => h('div',{class:'wf-grid'},...children);
  const check = (label) => {
    const box = h('input',{type:'checkbox'});
    return {box,label:h('label',{class:'wf-check'},box,h('span',null,label))};
  };
  const date = value => new Date(value).toLocaleString('ar-SA-u-ca-gregory',{timeZone:'Asia/Riyadh'});
  const digit = value => value.trim().replace(/[٠-٩۰-۹]/g,x=>'٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹'.indexOf(x)%10);
  function fileInput(multiple=false) {
    return h('input',{type:'file',multiple,accept:'.pdf,.png,.jpg,.jpeg,.webp,.docx,.xlsx'});
  }
  function encode(file) {
    if (!file || !file.size || file.size>attachmentBytes) throw Error('invalid_document');
    return new Promise((resolve,reject)=>{
      const reader = new FileReader();
      reader.onload=()=>resolve({name:file.name,content:reader.result.split(',')[1]});
      reader.onerror=()=>reject(Error('invalid_document'));
      reader.readAsDataURL(file);
    });
  }
  function profileRows(profile={}){
    const labels=window.tamkeenWholesaleReader?.labels||{};
    return Object.entries(labels).filter(([key])=>profile[key]).map(([key,label])=>({key,label,value:profile[key]}));
  }
  function profileFields(profile){
    return grid(...profileRows(profile).map(({label,value})=>h('div',{class:'wf-result'},
      h('strong',null,label),h('p',{dir:'auto'},value))));
  }
  function download(doc) {
    const bytes=Uint8Array.from(atob(doc.content),c=>c.charCodeAt(0));
    const url=URL.createObjectURL(new Blob([bytes],{type:'application/octet-stream'}));
    h('a',{href:url,download:doc.name}).click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function message(error) {
    return errors[error?.message] || (/PGRST202|not find.*function|schema cache/i.test(error?.message||'')
      ? errors.setup_required : 'تعذر تنفيذ الطلب. تحقق من المدخلات والاتصال ثم أعد المحاولة.');
  }

  function workspace() {
    const el=h('div',{class:'ux-page wf',dir:'rtl'});
    const status=h('p',{class:'wf-notice',role:'status','aria-live':'polite'});
    const body=h('div',{class:'wf-body'});
    el.append(h('header',{class:'wf-header'},
      h('a',{href:'#contracts~ct_whole'},'عقود الجملة'),
      h('h1',null,'ملفات عملاء الجملة'),
      h('p',null,'استقبل طلبات واتساب، راجع هوية العميل، وتابع التوقيعات حتى تفعيل الملف.')),
    status,body);
    const view={key:'team',el,refresh:()=>{}};
    let role, busy=false;
    const api=(action,data={})=>window.__CLOUD.wholesale(action,data);
    const feedback=(value)=>{status.textContent=value;status.hidden=!value;};
    const run=fn=>async()=>{
      if(busy)return;
      busy=true;
      body.setAttribute('aria-busy','true');
      const buttons=[...body.querySelectorAll('button:not([disabled])')];
      buttons.forEach(button=>button.disabled=true);
      feedback('جارٍ التحقق…');
      try {await fn(); if(status.textContent==='جارٍ التحقق…')feedback('');}
      catch(error){feedback(message(error));}
      finally{busy=false;body.removeAttribute('aria-busy');buttons.forEach(button=>button.disabled=false);}
    };
    async function list(){
      const result=await api('list');

      role=result.role;
      const query=input('',{type:'search',placeholder:'الاسم أو رقم السجل أو الكود'});
      const filter=select([['','جميع الحالات'],...Object.entries(statuses)],role==='accountant'?'accounting':'');
      const rows=h('div',{class:'wf-rows'});
      const refresh=()=>{
        const q=digit(query.value).toLowerCase();
        const clients=result.clients.filter(c=>(!filter.value||filter.value===c.status)&&
          [c.name,c.registration,c.customer_code].some(v=>String(v||'').toLowerCase().includes(q)));
        rows.replaceChildren(...clients.map(c=>h('div',{class:'wf-row'},
          h('div',null,h('b',null,c.name),h('p',{class:'muted'},h('bdi',null,c.registration),c.customer_code?' · كود '+c.customer_code:'')),
          h('span',{class:'wf-badge','data-state':c.status},statuses[c.status]),
          btn('فتح الملف',run(()=>detail(c.id))))));
        if(!clients.length)rows.append(h('p',{class:'muted'},'لا توجد ملفات مطابقة.'));
      };
      query.addEventListener('input',refresh);
      filter.addEventListener('change',refresh);
      refresh();
      body.replaceChildren(panel(role==='accountant'?'قائمة المحاسب':'ملفات العملاء',
        h('div',{class:'row'},role==='legal'?btn('استقبال طلب واتساب',()=>creation(),'btn primary'):null,role==='legal'?btn('قراءة مستندات العميل',reader):null,result.mail_enabled?btn('استقبال من Zoho Mail',mailIntake):null,btn('تحديث القائمة',run(list))),
        grid(field('بحث في الملفات',query),field('حالة الملف',filter)),rows));
    }
    function reader(){
      feedback('');
      const file=h('input',{type:'file',multiple:true,accept:'.pdf,.png,.jpg,.jpeg,.webp'});
      const progress=h('p',{role:'status','aria-live':'polite'});
      const result=h('div');
      const back=btn('العودة إلى القائمة',run(list),'btn ghost');
      file.addEventListener('change',async()=>{
        const originals=[...file.files];
        if(!originals.length)return;
        file.disabled=true;
        result.replaceChildren();
        progress.textContent='تجري قراءة المستندات داخل المتصفح…';
        try{
          const report=await window.tamkeenWholesaleReader.scan(originals,value=>progress.textContent=value);
          const filled=report.rows.filter(row=>row.candidates.length===1).length;
          const conflicts=report.rows.filter(row=>row.candidates.length>1).length;
          progress.textContent=(filled||conflicts?'اكتملت محاولة القراءة · '+filled+' خانة لها قراءة واحدة · '+conflicts+' تحتاج مقارنة.':'لم تُستخرج بيانات العميل. راجع نتيجة كل ملف والنص المقروء أدناه، أو أدخل البيانات يدويًا بعد مراجعة الأصل.')
            +(report.failures.length?' تعذرت قراءة مستند أو صفحة من '+report.failures.length+' ملف.':'');
          const controls={};
          const section=(title,rows)=>panel(title,grid(...rows.map(({key,label,candidates})=>{
            const defaultValue=candidates.length===1?candidates[0].value:'';
            const control=controls[key]=input(defaultValue,{maxlength:160,dir:'auto'});
            const explanation=candidates.length===1?'المصدر · '+candidates[0].source:
              candidates.length?'توجد قراءات مختلفة. راجع المصدر وأدخل القيمة الصحيحة.':'بانتظار البيانات من المستند.';
            return h('div',{class:'wf-result'},field(label,control),h('small',{class:'muted'},explanation),
              candidates.length>1?h('ul',null,...candidates.map(x=>h('li',null,x.value+' · '+x.source))):null);
          })));
          const groups=[['بيانات العميل',report.rows.filter(row=>!/^e[12]_/.test(row.key))],
            ['المفوّض الأول',report.rows.filter(row=>row.key.startsWith('e1_'))],
            ['المفوّض الثاني',report.rows.filter(row=>row.key.startsWith('e2_'))]];
          result.replaceChildren(panel('نتيجة قراءة الملفات',...(report.reports||[]).map(item=>h('details',null,
            h('summary',null,item.name+' — '+(item.status||'تعذرت القراءة')),
            h('p',{class:'muted'},'الصفحات المفحوصة: '+item.pages+' من '+item.totalPages+' · القراءة الضوئية: '+item.ocrPages),
            ...item.issues.map(issue=>h('p',null,issue)),
            ...item.texts.map(part=>h('details',null,h('summary',null,part.source+' · '+part.method),h('pre',{style:'white-space:pre-wrap;overflow-wrap:anywhere;max-height:300px;overflow:auto;direction:rtl'},part.text))),
            !item.texts.length?h('p',null,'لم يتوفر نص مقروء من هذا الملف.'):null))),...groups.map(([title,rows])=>section(title,rows)),
            btn('متابعة إلى حفظ ملف العميل وأوراقه',()=>{
              const name=controls.trade_name.value.trim();
              const registration=digit(controls.unified.value)||digit(controls.old_registration.value);
              if(!name||!/^\d{10}$/.test(registration)){progress.textContent='راجع الاسم ورقم السجل أو الرقم الموحّد أولًا.';return;}
              const profile=Object.fromEntries(Object.entries(controls).filter(([key,control])=>key!=='trade_name'&&control.value.trim())
                .map(([key,control])=>[key,control.value.trim()]));
              if(profile.unified)profile.unified=digit(profile.unified);
              creation(intakeFields(originals,profile),{name,registration});
            },'btn primary'));
        }catch(error){progress.textContent=error?.message||'تعذرت قراءة المستندات.';}
        finally{file.disabled=false;}
      });
      body.replaceChildren(panel('قراءة مستندات العميل',back,
        h('p',null,'اختر أوراق العميل بصيغة PDF أو صور. راجع الخانات المقروءة، ثم تابع لحفظ البيانات مع الأوراق الأصلية في ملف العميل.'),
        h('p',{class:'muted'},'يُقرأ حتى 12 مستندًا. يفحص القارئ أول عشر صفحات من كل PDF، وتبقى جميع صفحات المستند الأصلي ضمن الملف عند الحفظ.'),
        field('مستندات العميل للقراءة',file),progress,result));
    }
    function intakeFields(originals=[],profile={}){
      let receipt=crypto.randomUUID();
      const attachments=[...originals];
      const text=h('textarea',{rows:4,maxlength:32000,placeholder:'الصق نص الطلب كما ورد في واتساب'});
      const files=fileInput(true);
      const selected=h('ul',{class:'wf-docs','aria-label':'الأوراق التي ستحفظ في الملف'});
      const renew=()=>{receipt=crypto.randomUUID();};
      const renderAttachments=()=>{
        selected.replaceChildren(...attachments.map((file,index)=>h('li',null,h('bdi',null,file.name),
          btn('إزالة المرفق',()=>{attachments.splice(index,1);renew();renderAttachments();},'btn sm ghost'))));
        if(!attachments.length)selected.append(h('li',{class:'muted'},'لم تختر أوراقًا بعد.'));
      };
      const attachListeners=[];
      files.addEventListener('change',()=>{
        const added=[...files.files];
        attachments.push(...added);files.value='';renew();renderAttachments();
        for(const listener of attachListeners)listener(added);
      });
      text.addEventListener('input',renew);
      renderAttachments();
      const startedWithProfile=Object.keys(profile).length>0;
      return {onAttach:listener=>attachListeners.push(listener),heading:startedWithProfile?'حفظ ملف العميل وأوراقه':'استقبال طلب واتساب',profile,
        node:h('div',null,grid(field('رسالة واتساب',text),field('مرفقات الطلب · حتى 12 ورقة، 5 ميجابايت لكل ملف',files)),
          selected,h('p',{class:'muted'},'يمكن حفظ حتى 16 ميجابايت في الدفعة الواحدة، وإضافة دفعات أخرى إلى الملف نفسه.')),
        data:async(base)=>{
          const batch=[...attachments];
          const message=text.value;
          const requestId=receipt;
          if(batch.length>attachmentLimit||(!message.trim()&&!batch.length))throw Error('invalid_intake');
          if(batch.reduce((total,file)=>total+file.size,0)>batchBytes)throw Error('intake_size_limit');
          return {receipt:requestId,channel:'whatsapp',message,files:await Promise.all(batch.map(encode)),
            ...(Object.keys(profile).length>0?{profile,profile_reviewed:true,...(base?{profile_base:base}:{})}:{})};
        }};
    }
    function mailIntake(){
      feedback('');
      const consent=check('أوافق على قراءة مسودات بريد العقود من Zoho Mail لاختيار رسالة.');
      const choices=h('div',{class:'wf-result'});
      const load=btn('قراءة مسودات البريد',run(async()=>{
        if(!consent.box.checked){feedback('أكّد موافقة القراءة أولًا.');return;}
        if(!window.__WHOLESALE_MAIL)throw Error('mail_disabled');
        let drafts;
        try{drafts=await window.__WHOLESALE_MAIL.drafts();}catch{throw Error('mail_disabled');}
        const option=select([['','اختر الرسالة'],...drafts.map(d=>[d.id,d.subject+' · '+d.sender])]);
        choices.replaceChildren(field('مسودة البريد',option),btn('مراجعة الرسالة',()=>{
          const d=drafts.find(row=>row.id===option.value);
          if(!d){feedback('اختر رسالة من القائمة.');return;}
          const downloadConsent=check('راجعت الرسالة وأوافق على جلب المرفقات المحددة وحفظها مع الطلب.');
          const files=d.attachments.map(a=>({attachment:a,...check(a.name)}));
          for(const file of files)file.box.checked=true;
          const receipt=crypto.randomUUID();
          creation({
            heading:'استقبال من Zoho Mail',
            node:h('div',null,h('p',null,d.subject+' · '+d.sender),h('p',{class:'wf-message',dir:'auto'},d.text),
              files.map(file=>file.label),downloadConsent.label),
            data:async()=>{
              const selected=files.filter(file=>file.box.checked).map(file=>file.attachment);
              if(!downloadConsent.box.checked || selected.length>3)throw Error('invalid_intake');
              const encoded=await Promise.all(selected.map(async a=>encode(await window.__WHOLESALE_MAIL.attachment(d,a))));
              return {receipt,channel:'zoho',source_ref:d.id,message:[d.subject,d.sender,d.text].join('\n'),files:encoded};
            }
          });
        }));
      }));
      body.replaceChildren(panel('استقبال من Zoho Mail',btn('العودة إلى القائمة',run(list),'btn ghost'),consent.label,load,choices));
    }
    function creation(intake=intakeFields(),draft={}){
      feedback('');
      const name=input(draft.name||'',{maxlength:160}), number=input(draft.registration||'',{dir:'ltr',inputmode:'numeric',readonly:!!draft.registration});
      const result=h('div',{class:'wf-result'});
      const identity=()=>({name:name.value.trim(),registration:digit(number.value)});
      for(const field of [name,number])field.addEventListener('input',()=>result.replaceChildren());
      const verify=run(async()=>{
        const snapshot=identity();
        const checkResult=await api('check',snapshot);
        if(name.value.trim()!==snapshot.name||digit(number.value)!==snapshot.registration)return;
        if(checkResult.existing){
          result.replaceChildren(h('p',null,'يوجد ملف بالرقم نفسه. افتحه لإضافة الأوراق والبيانات إلى الملف القائم.'),
            btn('فتح الملف القائم',run(()=>detail(checkResult.existing,intake)),'btn primary'));
          return;
        }
        const candidates=checkResult.legacy;
        const sameNumber=candidates.filter(c=>c.registration_no===snapshot.registration);
        const eligible=sameNumber.length?sameNumber:candidates.filter(c=>!c.registration_no);
        const legacy=select([['',sameNumber.length?'اختر العقد المطابق':'ملف مستقل'],
          ...eligible.map(c=>[c.path,c.trade_name+' · '+(c.registration_no||'بدون رقم')])]);
        const review=check('راجعت النتائج وقارنت المستندات وهوية المنشأة.');
        const hasMatches=candidates.length||checkResult.similar.length;
        result.replaceChildren(h('p',null,hasMatches?'راجع العقود والملفات المطابقة قبل الحفظ.':'لم يظهر ملف أو عقد جملة مطابق في الفحص.'),
          hasMatches?h('ul',null,...[...candidates,...checkResult.similar].map(c=>h('li',null,(c.trade_name||c.name)+' · '+(c.registration_no||c.registration||'بدون رقم')))):null,
          eligible.length?field('ربط بعقد جملة قائم',legacy):null,
          hasMatches?review.label:null,
          btn('حفظ ملف العميل والطلب',run(async()=>{
            if(hasMatches&&!review.box.checked)throw Error('legacy_review_required');
            if(sameNumber.length&&!legacy.value)throw Error('legacy_link_required');
            if(JSON.stringify(snapshot)!==JSON.stringify(identity()))throw Error('legacy_review_required');
            const result=await api('create',{...snapshot,...await intake.data(),legacy_path:legacy.value,reviewed:review.box.checked});
            await detail(result.id);
            feedback('حُفظ ملف العميل والبيانات والأوراق المرفقة.');
          }),'btn primary'));
      });
      // قراءة تلقائية: عند إرفاق ملف يُستخرج الاسم ورقم السجل وباقي الخانات بدون كتابة. لا يُكتب فوق ما أدخله المستخدم.
      const autoStatus=h('p',{class:'muted',role:'status','aria-live':'polite'});
      const profileBox=h('div');
      const renderProfile=(open)=>profileBox.replaceChildren(...(intake.profile&&profileRows(intake.profile).length?
        [h('details',open?{open:''}:null,h('summary',null,'الخانات التي ستُحفظ مع الملف — راجعها'),profileFields(intake.profile))]:[]));
      renderProfile(false);
      const nameFromFile=files=>{for(const file of files){
        const base=String(file.name||'').replace(/\.[a-z0-9]{2,5}$/i,'').replace(/[_]+/g,' ').replace(/\s+/g,' ').trim();
        if(/^(مؤسسة|مؤسسه|شركة|شركه|مصنع|مجموعة|محل|معرض|مكتب)\s+\S+/.test(base)&&!/\d{4,}/.test(base)&&base.length<=120)return base;}return ''};
      let reading=0;
      const autoRead=async files=>{
        const readable=files.filter(file=>/\.(pdf|png|jpe?g|webp)$/i.test(file.name)||/^(application\/pdf|image\/(png|jpeg|webp))$/.test(file.type));
        const filled=[];const turn=++reading;
        const useFileName=()=>{if(!name.value.trim()){const guess=nameFromFile(files);if(guess){name.value=guess;filled.push('الاسم التجاري (من اسم الملف)');}}};
        if(!readable.length||!window.tamkeenWholesaleReader){useFileName();if(filled.length){result.replaceChildren();autoStatus.textContent='عبّيت: '+filled.join('، ')+'. راجعها قبل الحفظ.';}return;}
        autoStatus.textContent='جارٍ قراءة الملف واستخراج البيانات…';
        try{
          const report=await window.tamkeenWholesaleReader.scan(readable,value=>{if(turn===reading)autoStatus.textContent='جارٍ قراءة الملف… '+value;});
          const one=key=>{const row=report.rows.find(item=>item.key===key);return row&&row.candidates.length===1?String(row.candidates[0].value||'').trim():'';};
          const conflicts=report.rows.filter(row=>row.candidates.length>1).map(row=>row.label);
          const readName=one('trade_name');
          if(!name.value.trim()&&readName){name.value=readName;filled.push('الاسم التجاري');}
          useFileName();
          const registration=digit(one('unified'))||digit(one('old_registration'));
          if(!number.value.trim()&&!number.readOnly&&/^\d{10}$/.test(registration)){number.value=registration;filled.push('رقم السجل');}
          let extra=0;
          if(intake.profile)for(const row of report.rows){
            if(row.key==='trade_name'||row.candidates.length!==1||intake.profile[row.key])continue;
            const value=row.key==='unified'?digit(row.candidates[0].value):String(row.candidates[0].value||'').trim();
            if(value){intake.profile[row.key]=value;extra++;}
          }
          if(extra)renderProfile(true);
          if(filled.length||extra)result.replaceChildren();
          autoStatus.textContent=(filled.length||extra?'قريت الملف وعبّيت: '+[...filled,extra?extra+' خانة إضافية (تحت)':''].filter(Boolean).join('، ')+'. راجعها قبل الحفظ.'
            :'قريت الملف وما لقيت بيانات واضحة — أدخل الاسم ورقم السجل يدويًا.')
            +(conflicts.length?' قراءات متعارضة ما عبّيتها: '+conflicts.join('، ')+'.':'')
            +(!number.value.trim()?' رقم السجل ما انقرأ بثقة، أدخله يدويًا.':'');
        }catch(error){useFileName();autoStatus.textContent='تعذرت قراءة الملف تلقائيًا — أدخل البيانات يدويًا.'+(filled.length?' (أخذت الاسم من اسم الملف)':'');}
      };
      if(typeof intake.onAttach==='function')intake.onAttach(files=>{autoRead(files);});
      body.replaceChildren(panel(intake.heading,btn('العودة إلى القائمة',run(list),'btn ghost'),
        intake.node,autoStatus,grid(field('الاسم التجاري',name),field('رقم السجل التجاري أو الرقم الموحد',number)),
        profileBox,
        btn('التحقق من التكرار',verify,'btn primary'),result));
      name.focus();
    }
    async function detail(id, retainedIntake){
      const c=await api('detail',{id});

      const save=(action,data,success='تم الحفظ.')=>run(async()=>{
        await api(action,{id,...await data()});await detail(id);feedback(success);
      });
      const legal=role==='legal';
      const savedProfile=c.profile||{};
      const missing=['nafith','chamber','customer'].filter(kind=>!c.proofs.some(p=>p.kind===kind)).map(kind=>kinds[kind]);
      if(!c.documents_review)missing.push('مراجعة المستندات المطلوبة');
      const nextStep={
        signatures:c.zoho_status?.status==='completed'
          ? 'القانونية · توثيق توقيع '+signers[c.signatures.length]+' من شهادة الإتمام'
          : 'القانونية · تجهيز الطلب ومتابعة التوقيعات في Zoho',
        accounting:'المحاسب · إضافة كود العميل',
        requirements:'القانونية · استكمال '+missing.join('، '),
        active:'استوفيت متطلبات الاعتماد ويمكن الرجوع إلى الإثباتات في هذا الملف.'
      };
      const nav=panel(c.name,btn('العودة إلى القائمة',run(list),'btn ghost'),
        h('div',{class:'row'},h('bdi',null,c.registration),
          h('span',{class:'wf-badge','data-state':c.status},statuses[c.status]),
          c.legacy_path?h('a',{href:'#contracts-'+c.legacy_path.split('/').pop()},'فتح عقد الجملة المرتبط'):null), h('p',null,nextStep[c.status]));
      const documents=panel('المستندات والنسخ',
        c.documents.length?h('ul',{class:'wf-docs'},...c.documents.map(d=>h('li',null,
          h('span',null,d.filename+' · نسخة '+d.version+' · '+kinds[d.kind]),
          btn('تنزيل',run(async()=>download(await api('download',{id,document_id:d.id}))))))):h('p',{class:'muted'},'لا توجد مستندات.'));
      if(legal){
        const kind=select(Object.entries(kinds),'support'), file=fileInput();
        documents.append(grid(field('نوع المستند',kind),field('الملف · حتى 5 ميجابايت',file)),
          btn('حفظ نسخة المستند',save('document',async()=>({...await encode(file.files[0]),kind:kind.value}))));
      }
      const supporting=c.documents.filter(d=>d.kind==='support'&&!c.documents.some(other=>
        other.kind===d.kind&&other.filename===d.filename&&other.version>d.version));
      const reviewList=supporting.map(d=>({id:d.id,...check(d.filename+' · نسخة '+d.version)}));
      const reviewMemo=h('textarea',{rows:2,maxlength:500,value:c.documents_review?.reference||'',
        placeholder:'مثال: سجل المنشأة ومستندات المفوّض حسب القائمة المعتمدة'});
      const reviewValidity=check('راجعت المستندات المطلوبة وتحققت من اكتمالها وصلاحيتها.');
      const reviewPanel=h('details',{class:'wf-evidence'},h('summary',null,'المستندات المطلوبة · '+(c.documents_review?'تمت المراجعة':'بانتظار المراجعة')),
        c.documents_review?h('p',null,c.documents_review.reference+' · '+date(c.documents_review.reviewed_at)):null,
        legal&&reviewList.length?[reviewList.map(item=>item.label),field('المستندات التي تحققت منها',reviewMemo),reviewValidity.label,
          btn('اعتماد مراجعة المستندات',save('review_documents',()=>({reference:reviewMemo.value,reviewed:reviewValidity.box.checked,
            documents:reviewList.filter(item=>item.box.checked).map(item=>item.id)})))]:null);
      documents.append(reviewPanel);
      const amount=input(c.nafith?.amount||'',{inputmode:'decimal',dir:'ltr'});
      const issuer=input(c.nafith?.issuer||'',{maxlength:160});
      const due=input(c.nafith?.due||'',{type:'date'});
      const nafith=panel('بيانات سند نافذ',
        h('p',{class:'muted'},'بيانات للمراجعة والإدخال في نافذ. وثّق السند الموقّع بعد صدوره.'),
        legal&&!c.proofs.some(p=>p.kind==='nafith')?[grid(field('مبلغ السند بالريال',amount),field('اسم محرر السند',issuer),field('تاريخ الاستحقاق',due)),
          btn('حفظ بيانات السند',save('prepare',()=>({amount:digit(amount.value).replace('٫','.'),issuer:issuer.value,due:due.value})))]
          :h('p',null,c.nafith?c.nafith.issuer+' · '+c.nafith.amount+' ريال · '+c.nafith.due:'بانتظار التجهيز.'));
      const evidence=(kind)=>{
        const proof=c.proofs.find(p=>p.kind===kind);
        const docs=c.documents.filter(d=>d.kind===kind);
        const reference=input(proof?.reference||'',{maxlength:160});
        const doc=select([['','اختر مستند الإثبات'],...docs.map(d=>[d.id,d.filename+' · نسخة '+d.version])],proof?.document_id||'');
        const reviewed=check('راجعت المستند وتحققت من صحة الإثبات.');
        return h('details',{class:'wf-evidence'},h('summary',null,kinds[kind]+' · '+(proof?'موثق':'بانتظار الإثبات')),
          proof?h('p',null,'المرجع: ',h('bdi',null,proof.reference)):null,
          legal&&docs.length?[grid(field('رقم المرجع أو وصف الإثبات',reference),field('المستند',doc)),reviewed.label,
            btn('حفظ التوثيق',save('proof',()=>({kind,reference:reference.value,document_id:doc.value||null,reviewed:reviewed.box.checked})))]
            :legal&&!proof?h('p',{class:'muted'},'أرفق مستندًا من هذا النوع في قسم المستندات أولًا.'):null);
      };
      const approvals=panel('توقيعات Zoho Sign',
        h('ol',{class:'wf-signers'},...signers.map((name,i)=>h('li',null,h('b',null,name),' · ',
          c.signatures[i]?'موثق '+date(c.signatures[i].signed_at):i===c.signatures.length?'التوقيع التالي':'بانتظار السابق'))),
        c.zoho_status?h('p',null,'آخر تحقق من Zoho · '+providerStatus[c.zoho_status.status]+' · '+c.zoho_status.signed+' من 3 وقّعوا · '+date(c.zoho_status.checked_at)):null);
      if(legal&&c.signatures.length<3){
        const next=c.signatures.length+1;
        const previous=c.signatures[0];
        const req=input(previous?.request_id||c.zoho_status?.request_id||'',{dir:'ltr',inputmode:'numeric',readonly:!!previous||c.zoho_status?.status==='completed'});
        const when=input('',{type:'datetime-local'});
        const docs=c.documents.filter(d=>d.kind==='zoho');
        const cert=select([['','اختر شهادة الإتمام'],...docs.map(d=>[d.id,d.filename+' · نسخة '+d.version])],previous?.certificate_id||'');
        if(previous)cert.disabled=true;
        const reviewed=check('راجعت شهادة Zoho وتحققت من هوية الموقّع وترتيبه وتاريخ توقيعه بتوقيت الرياض.');
        const external=check('أوافق على قراءة حالة هذا الطلب من Zoho Sign.');
        approvals.append(h('p',{class:'muted'},'جهّز الطلب في Zoho Sign بالتسلسل الظاهر، وراجع المستلمين قبل إرساله من Zoho. اسم الطلب المطلوب للقراءة من النظام: ',
          h('bdi',null,'Tamkeen Wholesale / '+id)),
          field('رقم طلب Zoho Sign',req),external.label,btn('قراءة حالة الطلب من Zoho',run(async()=>{
            if(!external.box.checked) {feedback('أكّد موافقة القراءة أولًا.');return;}
            const result=await window.__CLOUD.wholesaleSign({id,request_id:digit(req.value),approved:true});
            await detail(id);
            feedback('حُفظت نتيجة التحقق من Zoho · '+providerStatus[result.status]+' · '+result.signed+' من 3 وقّعوا.');
            external.box.checked=false;
          })),
          c.zoho_status?.status==='completed'?h('details',{class:'wf-evidence'},h('summary',null,'توثيق التوقيع التالي من شهادة الإتمام'),
            grid(field('تاريخ ووقت التوقيع · الرياض',when),field('شهادة الإتمام',cert)),reviewed.label,
            btn('توثيق توقيع '+signers[next-1],save('signature',()=>({step:next,request_id:digit(req.value),signed_at:when.value?when.value+'+03:00':null,document_id:cert.value||null,reviewed:reviewed.box.checked})))):null);
      }
      const code=input(c.customer_code||'',{dir:'ltr',maxlength:64});
      const accounting=panel('كود العميل',h('p',null,c.customer_code?h('bdi',null,c.customer_code):c.signatures.length<3?'يفتح للمحاسب بعد اكتمال التوقيعات الثلاثة.':'الملف في قائمة المحاسب.'),
        role==='accountant'&&c.signatures.length===3&&!c.customer_code?[field('كود العميل',code),
          btn('حفظ كود العميل',save('code',()=>({code:code.value})),'btn primary')]:null);
      const intake=retainedIntake||intakeFields();
      const incomingRows=profileRows(retainedIntake?.profile);
      const differences=incomingRows.filter(({key,value})=>savedProfile[key]&&savedProfile[key]!==value);
      const updateReview=check('راجعت الفروق وأوافق على تحديث الخانات المعروضة.');
      const receipts=panel('سجل الاستقبال',
        c.intake.map(r=>h('details',{class:'wf-evidence'},h('summary',null,(r.channel==='whatsapp'?'واتساب':r.channel==='zoho'?'Zoho Mail':'إدخال يدوي')+' · '+date(r.created_at)),
          h('p',{class:'wf-message',dir:'auto'},r.message||'مرفقات فقط'),
          h('ul',null,...c.documents.filter(d=>d.intake_id===r.id).map(d=>h('li',null,d.filename))),
          profileRows(r.profile).length?h('details',null,h('summary',null,'الخانات المحفوظة مع هذه الدفعة'),profileFields(r.profile)):null)),
        legal?h('details',{open:!!retainedIntake,class:'wf-evidence'},h('summary',null,retainedIntake?.heading||'إضافة طلب واتساب إلى الملف'),intake.node,
          incomingRows.length?h('div',null,h('h3',null,'بيانات هذه الدفعة'),profileFields(retainedIntake.profile),
            differences.length?h('ul',null,...differences.map(({key,label,value})=>h('li',null,label+' · الحالي: '+savedProfile[key]+' · المقترح: '+value))):null,
            updateReview.label):null,
          btn(incomingRows.length?'حفظ البيانات والأوراق في الملف القائم':'حفظ الرسالة ومرفقاتها',save('intake',()=>{
            if(incomingRows.length&&!updateReview.box.checked)throw Error('invalid_profile');
            return intake.data(savedProfile);
          }))):null);
      const audit=panel('سجل العمل',h('details',null,h('summary',null,'آخر الإجراءات'),
        h('ol',null,...c.audit.map(a=>h('li',null,(actions[a.action]||a.action)+' · '+date(a.created_at))))));
      body.replaceChildren(nav,panel('بيانات العميل المحفوظة',profileRows(savedProfile).length?profileFields(savedProfile):h('p',{class:'muted'},'لم تُحفظ خانات قراءة في هذا الملف بعد.')),documents,grid(approvals,accounting),grid(nafith,panel('الإثباتات',...['nafith','chamber','customer'].map(evidence))),
        receipts,audit);
      nav.querySelector('button')?.focus({preventScroll:true});
    }

    if(!window.__CLOUD?.active())feedback('سجّل الدخول إلى النسخة السحابية لفتح ملفات عملاء الجملة.');
    else run(list)();
    return view;
  }

  const previous=uxTeamView;
  uxTeamView=function(tab){return tab==='wholesale'?workspace():previous(tab);};
  window.wholesaleWorkspaceLink=()=>h('a',{class:'btn primary',href:routeHash},'ملفات عملاء الجملة');
})();
