/* Internal team roles route work through the existing legal requests (platform roles retired). */
(() => {
  const roster = [
    ['lead','المدير التنفيذي الذكي','توزيع المهام ومتابعة الإنجاز','داخلي','#requests','أخرى'],
    ['nafith_issue','نافذ · إعداد السندات','إعداد مسودات السندات ومراجعة بيانات الإصدار','بانتظار ربط نافذ','#bonds','تحصيل'],
    ['nafith_track','نافذ · متابعة السندات','متابعة التوقيع والاستحقاق والتجديد','بانتظار ربط نافذ','#bonds','تحصيل'],
    ['najiz_cases','ناجز · القضايا والجلسات','متابعة القضايا والجلسات والمواعيد','بانتظار ربط ناجز','#cases','قضية'],
    ['najiz_exec','ناجز · طلبات التنفيذ','متابعة حالة طلبات التنفيذ والتحصيل','بانتظار ربط ناجز','#executions','تحصيل'],
    ['qiwa_contracts','قوى · عقود العمل','متابعة العقود وتوثيق بياناتها','بانتظار ربط قوى',null,'مراجعة عقد'],
    ['qiwa_renew','قوى · التجديدات','متابعة انتهاء العقود وتجديدها','بانتظار ربط قوى',null,'مراجعة عقد'],
    ['wholesale','مسؤول ملفات عملاء الجملة','استقبال الطلب ومتابعة الإثباتات والاعتماد','مسار داخلي','#team~wholesale','مراجعة عقد'],
    ['mail','مسؤول البريد والمراسلات','مراجعة العقود والتجديدات الواردة من Zoho Mail','يتطلب ربط الصندوق','#team~mail','مراجعة عقد'],
    ['review','المدقق القانوني','مراجعة المستندات والنتائج قبل اعتمادها','مراجعة داخلية','#requests','أخرى']
  ].map(([id,name,scope,readiness,href,kind])=>({id,name,scope,readiness,href,kind}));
  // أدوار المنصات الحكومية أُلغيت: ناجز ونافذ وقوى لا تتيح ربطًا آليًا. تبقى في الخريطة لعرض المهام القديمة فقط.
  const retired = new Set(['nafith_issue','nafith_track','najiz_cases','najiz_exec','qiwa_contracts','qiwa_renew']);
  const active = roster.filter(r => !retired.has(r.id));
  const finished = new Set(['معتمد','مغلق','مرفوض','ملغى']);
  const roleById = new Map(roster.map(role=>[role.id,role]));
  const state = (r)=>r.status||'مقدم';
  const overdue = (r)=>!finished.has(state(r))&&dateG(r.due)&&dateG(r.due)<todayISO();
  const button=(label,onclick,cls='btn')=>h('button',{type:'button',class:cls,onclick},label);
  const field=(label,control)=>{
    control.setAttribute('aria-label',label);
    return h('label',{class:'f'},h('span',null,label),control);
  };

  function board(){
    const el=h('div',{class:'ux-page wf',dir:'rtl'});
    const status=h('p',{class:'wf-notice',role:'status',hidden:true});
    const tasks=h('div',{class:'wf-body'}), cards=h('div',{class:'tc-cards'}), counts=h('div',{class:'tc-counts'});
    const query=h('input',{type:'search',placeholder:'عنوان المهمة'});
    const roleSelect=h('select',null,h('option',{value:''},'كل الأدوار'),active.map(r=>h('option',{value:r.id},r.name)));
    const stateSelect=h('select',null,h('option',{value:''},'كل الحالات'),h('option',{value:'late'},'المتأخرة'),
      REQ_ST_LIST.map(s=>h('option',{value:s},s)));
    const form=h('div');
    const canCreate=window.__CLOUD?.active()&&!S.readOnly;
    const say=(text)=>{status.textContent=text;status.hidden=!text;};
    function paint(){
      const records=recs('requests').filter(r=>roleById.has(r.teamRole));
      const relevant=records.filter(r=>(!roleSelect.value||r.teamRole===roleSelect.value)
        &&(!stateSelect.value||(stateSelect.value==='late'?overdue(r):stateSelect.value==='open'?!finished.has(state(r)):state(r)===stateSelect.value))
        &&String(r.title||'').toLowerCase().includes(query.value.trim().toLowerCase()))
        .sort((a,b)=>Number(!!overdue(b))-Number(!!overdue(a))||String(b.createdAt||'').localeCompare(String(a.createdAt||'')));
      const tile=(label,value)=>h('div',{class:'panel tc-count'},h('strong',null,value),h('span',null,label));
      counts.replaceChildren(tile('أدوار الفريق',active.length),tile('مهام مفتوحة',records.filter(r=>!finished.has(state(r))).length),
        tile('مهام متأخرة',records.filter(overdue).length),tile('مهام معتمدة أو مغلقة',records.filter(r=>['معتمد','مغلق'].includes(state(r))).length));
      cards.replaceChildren(...active.map(r=>{
        const assigned=records.filter(t=>t.teamRole===r.id&&!finished.has(state(t))).length;
        return h('article',{class:'panel tc-role','data-team-role':r.id},h('h3',null,r.name),h('p',null,r.scope),
          h('span',{class:'wf-badge'},r.readiness),h('div',{class:'row'},
            button('المهام المفتوحة '+assigned,()=>{
              roleSelect.value=r.id;stateSelect.value='open';paint();tasks.scrollIntoView({block:'nearest'});
            },'btn sm'),r.href?h('a',{class:'btn sm ghost',href:r.href},'فتح القسم'):null));
      }));
      tasks.replaceChildren(...relevant.map(r=>h('div',{class:'wf-row'},h('div',null,
        h('b',null,r.title),h('p',{class:'muted'},roleById.get(r.teamRole).name+(retired.has(r.teamRole)?' (دور ملغى)':''),dateG(r.due)?' · '+dateG(r.due):'')),
        h('span',{class:'wf-badge'},state(r)+(overdue(r)?' · متأخرة':'')),
        h('a',{class:'btn sm',href:'#requests-'+r.id},'فتح المهمة'))));
      if(!relevant.length)tasks.append(h('p',{class:'muted'},'لا توجد مهام مطابقة.'));
    }
    stateSelect.append(h('option',{value:'open'},'المفتوحة'));
    for(const control of [query,roleSelect,stateSelect])control.addEventListener('input',paint);
    function create(){
      say('');
      const title=h('input',{required:true,maxlength:160});
      const detail=h('textarea',{rows:3,maxlength:4000});
      const target=h('select',{required:true},h('option',{value:''},'اختر الدور المطلوب'),active.map(r=>h('option',{value:r.id},r.name)));
      const due=h('input',{type:'date'});
      const save=h('button',{type:'submit',class:'btn primary'},'حفظ وإسناد داخلي');
      const id=uid();
      const fields=h('form',{class:'panel tc-create',onsubmit:async e=>{
        e.preventDefault();
        if(save.disabled)return;
        const role=roleById.get(target.value);
        if(!role||title.value.trim().length<2){say('أدخل عنوان المهمة واختر الدور المختص.');return;}
        save.disabled=true;
        try{
          const deadline=due.value||addDays(todayISO(),10);
          const res=await writeDoc('requests',id,{
            title:title.value.trim(),details:detail.value.trim(),teamRole:role.id,assignee:role.name,
            reviewer:role.id==='review'?'':'المدقق القانوني',requester:S.me.name,kind:role.kind,
            priority:'عادية',status:'مقدم',due:{orig:'g',g:deadline,h:g2h(deadline),verified:true}
          },null,{create:true});
          if(!res.ok){say('تعذر حفظ المهمة. راجع قائمة الطلبات قبل إعادة المحاولة.');return;}
          audit('إسناد مهمة داخلية لفريق تمكين','requests',id,role.name);
          form.replaceChildren();roleSelect.value=role.id;stateSelect.value='';query.value='';paint();
          say('حُفظت المهمة وأُسندت إلى '+role.name+'.');
        } catch {say('تعذر حفظ المهمة. راجع المدخلات والاتصال.');}
        finally {save.disabled=false;}
      }},h('h2',null,'إسناد مهمة'),h('div',{class:'wf-grid'},field('عنوان المهمة',title),field('الدور المختص',target),
        field('الموعد المطلوب',due),field('تفاصيل المهمة',detail)),h('div',{class:'row'},save,button('إلغاء',()=>form.replaceChildren(),'btn ghost')));
      form.replaceChildren(fields);
      title.focus();
    }
    el.append(h('header',{class:'wf-header'},h('h1',null,'لوحة فريق تمكين'),
      h('p',null,'أدوار لتوزيع المهام الداخلية على فريقك ومتابعتها.')),
      status,h('div',{class:'row'},canCreate?button('إسناد مهمة',create,'btn primary'):null),
      form,counts,h('section',{class:'tc-section'},h('h2',null,'الأدوار المعتمدة'),cards),
      h('section',{class:'panel tc-section'},h('h2',null,'مهام الفريق'),h('div',{class:'tc-filters'},
        field('البحث',query),field('الدور',roleSelect),field('الحالة',stateSelect)),tasks));
    paint();
    return {key:'team',el,refresh:paint};
  }

  const prior=uxTeamView;
  uxTeamView=function(tab){return !tab||tab==='coordination'?board():prior(tab==='tools'?'':tab);};
})();
