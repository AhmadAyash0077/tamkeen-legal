/* Local reader for the Tamkeen wholesale intake draft. No document bytes are sent to a service. */
(() => {
  const labels={
    trade_name:'الاسم التجاري',unified:'الرقم الوطني الموحّد',old_registration:'رقم السجل التجاري',
    city:'مدينة الإصدار',confirm:'تاريخ التأكيد السنوي',activity:'نشاط المنشأة',address:'العنوان الوطني المختصر',
    manager:'اسم الشخص المسؤول',title:'الوظيفة',mobile:'رقم الجوال',email:'البريد الإلكتروني',
    ref:'الرقم أعلى النموذج',date:'تاريخ النموذج (ميلادي)',hijri:'الموافق (هجري)',
    e1_name:'اسم المفوّض الأول',e1_nat:'جنسية المفوّض الأول',e1_id:'هوية المفوّض الأول',
    e1_title:'وظيفة المفوّض الأول',e1_mobile:'جوال المفوّض الأول',
    e2_name:'اسم المفوّض الثاني',e2_nat:'جنسية المفوّض الثاني',e2_id:'هوية المفوّض الثاني',
    e2_title:'وظيفة المفوّض الثاني',e2_mobile:'جوال المفوّض الثاني'
  };
  const clean=s=>String(s||'').normalize('NFKC').replace(/[\u200e\u200f\u202a-\u202e]/g,'')
    .replace(/[٠-٩۰-۹]/g,d=>'٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹'.indexOf(d)%10).replace(/\s+/g,' ').trim();
  const ar=s=>clean(s).replace(/[ً-ْـ]/g,'').replace(/[أإآ]/g,'ا').replace(/ة/g,'ه');
  const arabic=s=>{
    const t=clean(s).replace(/^[^\p{Script=Arabic}]+|[^\p{Script=Arabic}]+$/gu,'');
    return /\p{Script=Arabic}{2}/u.test(t)&&!/^[*\s]+$/.test(t)?t:'';
  };
  const digits=s=>clean(s).replace(/\s/g,'');
  const mobile=s=>{
    const n=digits(s).replace(/^(?:\+?966|00966|0)/,'');
    return /^5\d{8}$/.test(n)?'0'+n:'';
  };
  const address=s=>{
    const n=digits(s).toUpperCase();
    return /^[A-Z]{4}\d{4}$/.test(n)?n:'';
  };
  const dateValue=(s,hijri=false)=>{
    const value=digits(s).replace(/[.\/–—−]/g,'-');
    const match=value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$|^(\d{1,2})-(\d{1,2})-(\d{4})$/);
    if(!match)return '';
    const [y,m,d]=(match[1]?[match[1],match[2],match[3]]:[match[6],match[5],match[4]]).map(Number);
    if(m<1||m>12||d<1||d>31||(hijri?(y<1400||y>1500||d>30):(y<1900||y>2100||new Date(Date.UTC(y,m-1,d)).getUTCDate()!==d)))return '';
    return [y,String(m).padStart(2,'0'),String(d).padStart(2,'0')].join('-');
  };
  function normalized(key,s){
    if(key==='unified')return /^70\d{8}$/.test(digits(s))?digits(s):'';
    if(key==='old_registration')return /^[1-9]\d{9}$/.test(digits(s))&&!/^70/.test(digits(s))?digits(s):'';
    if(key==='ref')return /^\d{2,8}$/.test(digits(s))?digits(s):'';
    if(key==='confirm'||key==='date'||key==='hijri')return dateValue(s,key==='hijri');
    if(key==='address')return address(s);
    if(key.endsWith('mobile'))return mobile(s);
    if(key.endsWith('_id'))return /^[12]\d{9}$/.test(digits(s))&&uxIdOk(digits(s))?digits(s):'';
    if(key==='email')return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean(s))?clean(s):'';
    return arabic(s);
  }
  function sources(){
    const rows=new Map();
    return {
      put(key,value,source){
        const candidate=normalized(key,value);
        if(!candidate)return;
        const list=rows.get(key)||[];
        if(!list.some(x=>ar(x.value)===ar(candidate)))list.push({value:candidate,source});
        rows.set(key,list);
      },
      result(){return Object.entries(labels).map(([key,label])=>({key,label,candidates:rows.get(key)||[]}));}
    };
  }
  function extractTextSource(raw,source,out){
    const lines=String(raw||'').split(/\n/).map(clean).filter(Boolean);
    const text=lines.join('\n');
    const flat=ar(text);
    if(/شهاد[هة] السجل التجاري|commercial registration certificate/i.test(flat)){
      const id=text.match(/(?:الرقم الوطني الموحد)\s*[:：]?\s*(70\d{8})|(70\d{8})\s*[:：]?\s*(?:الرقم الوطني الموحد)/)?.slice(1).find(Boolean);
      if(id)out.put('unified',id,source);
      const heading=lines.findIndex(x=>/شهاد[هة] السجل التجاري/.test(ar(x)));
      const candidate=lines.slice(Math.max(0,heading),heading+7).map(x=>x.match(/(?:شركة|مؤسسة)\s+[\p{Script=Arabic}][\p{Script=Arabic}\s]{3,100}/u)?.[0])
        .find(x=>x&&!/ذات مسؤولي|شخص واحد/.test(x));
      if(candidate)out.put('trade_name',candidate,source);
    }
    if(/اثبات عنوان|address proof|العنوان المختصر|short address/i.test(flat)){
      const short=text.match(/\b[A-Z]\s*[A-Z]\s*[A-Z]\s*[A-Z]\s*\d\s*\d\s*\d\s*\d\b/i)?.[0];
      if(short)out.put('address',short,source);
    }
  }
  // Proportions measured from the supplied Tamkeen form. Confirm the headings before reading its cells.
  const template={
    trade_name:[752,435,1068,475],unified:[430,435,545,477],city:[145,435,265,477],
    confirm:[670,486,825,512],activity:[145,487,451,526],address:[699,532,1069,570],
    manager:[146,534,406,572],title:[920,583,1068,618],mobile:[620,584,780,618],email:[145,585,399,619],
    e1_name:[912,931,1182,963],e1_nat:[728,931,900,963],e1_id:[520,931,718,963],
    e1_title:[331,931,512,963],e1_mobile:[147,931,322,963],
    e2_name:[912,973,1182,1004],e2_nat:[728,973,900,1004],e2_id:[520,973,718,1004],
    e2_title:[331,973,512,1004],e2_mobile:[147,973,322,1004]
  };
  async function cropText(worker,canvas,[left,top,right,bottom]){
    const sx=canvas.width/1376, sy=canvas.height/1780;
    const rectangle={left:Math.round(left*sx),top:Math.round(top*sy),
      width:Math.round((right-left)*sx),height:Math.round((bottom-top)*sy)};
    return (await worker.recognize(canvas,{rectangle})).data.text;
  }
  async function readNumber(canvas,worker,[left,top,right,bottom]){
    const sx=canvas.width/1376,sy=canvas.height/1780;
    const width=Math.round((right-left)*sx),height=Math.round((bottom-top)*sy);
    const crop=document.createElement('canvas');
    crop.width=width*3+32;crop.height=height*3+32;
    const ctx=crop.getContext('2d');
    ctx.fillStyle='#fff';ctx.fillRect(0,0,crop.width,crop.height);
    ctx.drawImage(canvas,Math.round(left*sx),Math.round(top*sy),width,height,16,16,width*3,height*3);
    return digits((await worker.recognize(crop)).data.text);
  }
  async function readTemplate(canvas,worker,source,out){
    if(Math.abs(canvas.width/canvas.height-1376/1780)>.045)return false;
    await worker.setParameters({tessedit_pageseg_mode:'7'});
    const title=ar(await cropText(worker,canvas,[347,719,1000,778]));
    if(!/تفويض.*تمثيل.*المنش.*طلب.*شراء.*استلام/.test(title))return false;
    const result={};
    for(const [key,rect] of Object.entries(template)){
      if(/^e2_/.test(key)&&key!=='e2_name'&&!result.e2_name)continue;
      const raw=await cropText(worker,canvas,rect);
      if(key==='unified'&&/^[1-6]\d{9}$/.test(digits(raw)))out.put('old_registration',raw,source);
      result[key]=normalized(key,raw);
    }
    await worker.setParameters({tessedit_char_whitelist:'0123456789-/.'});
    result.date=dateValue(await readNumber(canvas,worker,[218,309,350,340]));
    result.hijri=dateValue(await readNumber(canvas,worker,[218,344,350,373]),true);
    if(result.date&&result.hijri){
      const formatter=new Intl.DateTimeFormat('en-CA-u-ca-islamic-umalqura-nu-latn',{
        timeZone:'Asia/Riyadh',year:'numeric',month:'2-digit',day:'2-digit'
      });
      const parts=Object.fromEntries(formatter.formatToParts(new Date(result.date+'T12:00:00Z')).map(p=>[p.type,p.value]));
      if([parts.year,parts.month,parts.day].join('-')!==result.hijri){
        result.date='';result.hijri='';
      }
    }
    if(!result.confirm){
      await worker.setParameters({tessedit_char_whitelist:'0123456789-/.'});
      result.confirm=dateValue(await cropText(worker,canvas,[670,485,825,515]));
    }
    await worker.setParameters({tessedit_char_whitelist:'0123456789'});
    result.ref=await readNumber(canvas,worker,[238,273,334,304]);
    if(result.unified){

      const stampUnified=await readNumber(canvas,worker,[197,1689,301,1710]);
      if(stampUnified===result.unified){
        out.put('old_registration',await readNumber(canvas,worker,[197,1671,301,1691]),source+' · ختم الغرفة');
      }
    }
    await worker.setParameters({tessedit_char_whitelist:''});
    for(const [key,value] of Object.entries(result))if(value)out.put(key,value,source);
    return true;
  }
  async function scan(files,progress){
    if(!files.length||files.length>12)throw Error('اختر من مستند واحد إلى 12 مستندًا للقراءة.');
    const result=sources();let worker;
    const getWorker=async()=>{
      if(worker)return worker;
      await libLoad(UX_OCR_LIB);
      worker=await window.Tesseract.createWorker(['ara','eng'],1,{
        workerPath:'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/worker.min.js',
        corePath:'https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1'
      });
      return worker;
    };
    const failures=[];
    try{
      for(const file of files){
        if(file.size>20*1024*1024){failures.push(file.name);continue;}
        try{
          if(/\.pdf$/i.test(file.name)){
            const pdfjs=await pdfLib();
            const doc=await pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer()),isEvalSupported:false}).promise;
            try{
              const scanned=[];
              for(let i=1;i<=Math.min(doc.numPages,10);i++){
                const page=await doc.getPage(i);
                const data=await page.getTextContent();
                const text=data.items.map(item=>item.str+(item.hasEOL?'\n':' ')).join('');
                const source=file.name+' · صفحة '+i;
                if(clean(text).length<40 || /[\uFE70-\uFEFF]\s+[\uFE70-\uFEFF]\s+[\uFE70-\uFEFF]/u.test(text))scanned.push(i);
                else extractTextSource(text,source,result);
              }
              const priority=[...new Set([5,4,6,...scanned])].filter(i=>scanned.includes(i)).slice(0,3);
              for(const i of priority){
                progress('تجري قراءة الصفحة '+i+' ضوئيًا…');
                const page=await doc.getPage(i);
                const view=page.getViewport({scale:2.45});
                const canvas=document.createElement('canvas');
                canvas.width=Math.ceil(view.width);canvas.height=Math.ceil(view.height);
                await page.render({canvasContext:canvas.getContext('2d'),viewport:view}).promise;
                const source=file.name+' · صفحة '+i;
                const w=await getWorker();
                if(!await readTemplate(canvas,w,source,result)){
                  await w.setParameters({tessedit_pageseg_mode:'11'});
                  extractTextSource((await w.recognize(canvas)).data.text,source,result);
                }
                canvas.width=canvas.height=0;
              }
            }finally{await doc.destroy();}
          }else if(/\.(png|jpe?g|webp)$/i.test(file.name)){
            progress('تجري قراءة الصورة…');
            const bitmap=await createImageBitmap(file);
            const ratio=Math.min(1,2200/Math.max(bitmap.width,bitmap.height));
            const canvas=document.createElement('canvas');
            canvas.width=Math.ceil(bitmap.width*ratio);canvas.height=Math.ceil(bitmap.height*ratio);
            canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);
            bitmap.close();
            const w=await getWorker();
            if(!await readTemplate(canvas,w,file.name,result)){
              await w.setParameters({tessedit_pageseg_mode:'11'});
              extractTextSource((await w.recognize(canvas)).data.text,file.name,result);
            }
          }else failures.push(file.name);
        }catch{failures.push(file.name);}
      }
      return {rows:result.result(),failures};
    }finally{if(worker)await worker.terminate();}
  }
  window.tamkeenWholesaleReader={scan,labels:Object.freeze(labels)};
})();
