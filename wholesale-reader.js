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
    const value=clean(s);return /[\p{L}]{2}/u.test(value)&&value.length<=160?value:'';
  }
  function sources(){
    const rows=new Map();let accepted=0;
    return {
      put(key,value,source){
        const candidate=normalized(key,value);
        if(!candidate)return;
        accepted++;
        const list=rows.get(key)||[];
        if(!list.some(x=>ar(x.value)===ar(candidate)))list.push({value:candidate,source});
        rows.set(key,list);
      },
      count(){return accepted;},
      result(){return Object.entries(labels).map(([key,label])=>({key,label,candidates:rows.get(key)||[]}));}
    };
  }
  const aliases={
    trade_name:['الاسم التجاري','اسم المنشأة','اسم المؤسسة','اسم الشركة','اسم العميل','اسم التاجر','Trade name','Commercial name','Company name','Establishment name'],
    unified:['الرقم الوطني الموحد','الرقم الموحد للمنشأة','الرقم الموحد','Unified national number','Unified number'],
    old_registration:['رقم السجل التجاري','السجل التجاري رقم','Commercial registration number','CR number','CR No.'],
    city:['مدينة الإصدار','مكان الإصدار','مدينة السجل','Issuance city'],
    confirm:['تاريخ التأكيد السنوي','Annual confirmation date'],
    activity:['نشاط المنشأة','النشاط التجاري','نوع النشاط','Business activity'],
    address:['العنوان الوطني المختصر','العنوان المختصر','Short address'],
    manager:['اسم الشخص المسؤول','اسم المسؤول','اسم المدير','الشخص المسؤول','Manager name','Contact person'],
    title:['المسمى الوظيفي','الوظيفة','Job title'],mobile:['رقم الجوال','رقم الهاتف المحمول','الجوال','Mobile number','Mobile'],
    email:['البريد الإلكتروني','البريد الالكتروني','البريد','E-mail','Email'],
    ref:['الرقم أعلى النموذج','رقم النموذج'],date:['تاريخ النموذج ميلادي','تاريخ النموذج','التاريخ الميلادي'],hijri:['التاريخ الهجري','الموافق هجري'],
    e1_name:['اسم المفوض الأول','اسم المفوض الاول'],e1_nat:['جنسية المفوض الأول','جنسية المفوض الاول'],
    e1_id:['هوية المفوض الأول','هوية المفوض الاول'],e1_title:['وظيفة المفوض الأول','وظيفة المفوض الاول'],e1_mobile:['جوال المفوض الأول','جوال المفوض الاول'],
    e2_name:['اسم المفوض الثاني'],e2_nat:['جنسية المفوض الثاني'],e2_id:['هوية المفوض الثاني'],e2_title:['وظيفة المفوض الثاني'],e2_mobile:['جوال المفوض الثاني']
  };
  const escaped=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const fieldNames=Object.entries(aliases).flatMap(([key,names])=>names.map(name=>({key,label:ar(name).toLowerCase()}))).sort((a,b)=>b.label.length-a.label.length);
  const fieldPattern=new RegExp('(?:^|[\\s:：|])('+fieldNames.map(x=>escaped(x.label)).join('|')+')(?=$|[\\s:：|])','g');
  function foundLabels(line){
    const normalized=ar(line).toLowerCase();const found=[];
    for(const match of normalized.matchAll(fieldPattern)){
      const label=match[1],key=fieldNames.find(x=>x.label===label).key;
      found.push({key,start:match.index+match[0].length-label.length,end:match.index+match[0].length});
    }
    return found;
  }
  function candidate(key,value){
    const text=clean(value).replace(/^[\s:：|=\-]+|[\s:：|]+$/g,'');
    if(!text||/^(?:غير متوفر|لا يوجد|اسم|رقم|التوقيع|الختم|name|number)$/i.test(ar(text)))return '';
    if(['unified','old_registration'].includes(key)){
      const matches=text.match(/(?<!\d)\d(?:[ \t]*\d){9}(?!\d)/g)||[];
      return matches.map(digits).find(x=>key==='unified'?/^70\d{8}$/.test(x):/^[1-9]\d{9}$/.test(x)&&!/^70/.test(x))||'';
    }
    if(key.endsWith('mobile'))return (text.match(/(?:\+?966|00966|0)?5(?:[ -]*\d){8}(?!\d)/g)||[]).map(x=>mobile(x.replace(/-/g,''))).find(Boolean)||'';
    if(key==='address')return text.match(/\b[A-Z](?:\s*[A-Z]){3}(?:\s*\d){4}\b/i)?.[0]||'';
    if(key==='email')return text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0]||'';
    if(['confirm','date','hijri'].includes(key))return text.match(/\d{1,4}\s*[-/.]\s*\d{1,2}\s*[-/.]\s*\d{1,4}/)?.[0]||'';
    return text;
  }
  function extractTextSource(raw,source,out){
    const lines=String(raw||'').normalize('NFKC').replace(/[\u200e\u200f\u202a-\u202eً-ْـ]/g,'').split(/\r?\n/).map(clean).filter(Boolean);
    const before=out.count();
    lines.forEach((line,index)=>{
      const fields=foundLabels(line);
      fields.forEach((field,n)=>{
        let value=line.slice(field.end,fields[n+1]?.start??line.length);
        if(!clean(value).replace(/[:：|\-]/g,'').trim()){
          // A value can precede its label in PDF visual order, or occupy the next line.
          const prefix=n===0?line.slice(0,field.start):'';
          if(prefix.trim())value=prefix;
          else if(lines[index+1]&&!foundLabels(lines[index+1]).length)value=lines[index+1];
        }
        const parsed=candidate(field.key,value);if(parsed)out.put(field.key,parsed,source);
        // Modern commercial certificates may place the unified number under the CR label.
        if(field.key==='old_registration'){const unified=candidate('unified',value);if(unified)out.put('unified',unified,source)}
      });
    });
    const text=lines.join('\n'),flat=ar(text);
    if(/شهاده السجل التجاري|commercial registration certificate/i.test(flat)){
      const heading=lines.findIndex(x=>/شهاده السجل التجاري|commercial registration certificate/i.test(ar(x)));
      const company=lines.slice(heading+1,heading+7).find(x=>/^(شركة|مؤسسة)\s+/.test(x)&&x.length<=120&&!foundLabels(x).length&&!/ذات مسؤولي|شخص واحد/.test(x));
      if(company)out.put('trade_name',company,source);
    }
    if(/اثبات عنوان|address proof|العنوان المختصر|short address/i.test(flat)){
      const short=candidate('address',text);if(short)out.put('address',short,source);
    }
    return out.count()-before;
  }
  function pdfText(items){
    if(!items.some(x=>Array.isArray(x.transform)))return items.map(x=>x.str+(x.hasEOL?'\n':' ')).join('');
    const rows=[];
    for(const item of items){
      if(!item.str)continue;
      const y=item.transform?.[5]??0;let row=rows.find(x=>Math.abs(x.y-y)<3);
      if(!row){row={y,items:[]};rows.push(row)}row.items.push(item);
    }
    return rows.sort((a,b)=>b.y-a.y).map(row=>{
      const rtl=row.items.some(x=>x.dir==='rtl'||/\p{Script=Arabic}/u.test(x.str));
      return row.items.sort((a,b)=>rtl?(b.transform?.[4]||0)-(a.transform?.[4]||0):(a.transform?.[4]||0)-(b.transform?.[4]||0)).map(x=>x.str).join(' ');
    }).join('\n');
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
  async function scan(files,progress=()=>{},options={}){
    if(!files.length||files.length>12)throw Error('اختر من مستند واحد إلى 12 مستندًا للقراءة.');
    const result=sources(),failures=[],reports=[];let worker,workerFailure;
    const check=()=>{if(options.signal?.aborted)throw new DOMException('أوقفت القراءة.','AbortError')};
    const timed=async(promise,ms,label)=>{let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(label)),ms)})])}finally{clearTimeout(timer)}};
    const getWorker=async()=>{
      check();if(worker)return worker;if(workerFailure)throw workerFailure;
      try{
        await timed(libLoad(UX_OCR_LIB),30000,'تعذر تحميل محرك قراءة الصور؛ تحقق من الإنترنت.');
        const pending=window.Tesseract.createWorker(['ara','eng'],1,{workerPath:'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/worker.min.js',corePath:'https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1'});
        pending.then(w=>{if(workerFailure)w.terminate().catch(()=>{})},()=>{});
        worker=await timed(pending,90000,'تعذر تحميل حزم اللغة العربية والإنجليزية خلال المهلة.');return worker;
      }catch(error){workerFailure=error;throw error}
    };
    const ocr=async(canvas,source,report)=>{
      check();const w=await getWorker();
      try{
        await timed((async()=>{
          await w.setParameters({tessedit_char_whitelist:'',tessedit_pageseg_mode:'11'});
          const raw=(await w.recognize(canvas)).data.text||'';
          report.texts.push({source,method:'قراءة ضوئية',text:raw.slice(0,16000)});
          extractTextSource(raw,source,result);
          // Specialized form reading supplements the general reader; it never suppresses it.
          await readTemplate(canvas,w,source,result);
        })(),120000,'تجاوزت قراءة الصفحة المهلة؛ جرّب صورة أوضح أو قص الصفحة.');
      }catch(error){workerFailure=error;await w.terminate().catch(()=>{});worker=null;throw error}
      finally{canvas.width=canvas.height=0}
    };
    try{
      for(const [fileIndex,file] of [...files].entries()){
        check();const before=result.count();const report={name:file.name,pages:0,totalPages:1,ocrPages:0,issues:[],texts:[],candidates:0};reports.push(report);
        progress('ملف '+(fileIndex+1)+' من '+files.length+' · '+file.name);
        if(file.size>20*1024*1024){report.issues.push('حجم الملف يتجاوز 20 ميجابايت.');failures.push(file.name);continue}
        try{
          if(/\.pdf$/i.test(file.name)||file.type==='application/pdf'){
            const pdfjs=await pdfLib();
            const task=pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer()),isEvalSupported:false});
            const doc=await task.promise;
            report.totalPages=doc.numPages;
            try{
              for(let i=1;i<=Math.min(doc.numPages,10);i++){
                check();const source=file.name+' · صفحة '+i;
                progress('ملف '+(fileIndex+1)+' من '+files.length+' · '+file.name+' · صفحة '+i+' من '+Math.min(doc.numPages,10));
                try{
                  const page=await doc.getPage(i);let text='';
                  try{text=pdfText((await page.getTextContent()).items)}catch{}
                  report.pages++;
                  if(text.trim())report.texts.push({source,method:'نص PDF',text:text.slice(0,16000)});
                  const found=extractTextSource(text,source,result);
                  if(!found||clean(text).length<40||/[\uFFFD]/u.test(text)){
                    const original=page.getViewport({scale:1});const scale=Math.min(2.45,3000/Math.max(original.width,original.height));
                    const view=page.getViewport({scale});const canvas=document.createElement('canvas');
                    canvas.width=Math.ceil(view.width);canvas.height=Math.ceil(view.height);
                    await page.render({canvasContext:canvas.getContext('2d'),viewport:view}).promise;
                    report.ocrPages++;await ocr(canvas,source,report);
                  }
                  page.cleanup?.();
                }catch(error){if(error.name==='AbortError')throw error;report.issues.push('صفحة '+i+': '+errorReason(error))}
              }
              if(doc.numPages>10)report.issues.push('فُحصت أول 10 صفحات من '+doc.numPages+'؛ اختر الصفحات المتبقية في ملف مستقل لقراءتها.');
            }finally{await doc.destroy()}
          }else if(/\.(png|jpe?g|webp)$/i.test(file.name)||/^image\/(png|jpeg|webp)$/.test(file.type)){
            const bitmap=await createImageBitmap(file);const ratio=Math.min(2,3000/Math.max(bitmap.width,bitmap.height));
            const canvas=document.createElement('canvas');canvas.width=Math.ceil(bitmap.width*ratio);canvas.height=Math.ceil(bitmap.height*ratio);
            const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();
            report.pages=1;report.ocrPages=1;await ocr(canvas,file.name,report);
          }else report.issues.push('صيغة غير مدعومة. اختر PDF أو PNG أو JPG أو WebP.');
        }catch(error){if(error.name==='AbortError')throw error;report.issues.push(errorReason(error))}
        report.candidates=result.count()-before;
        if(report.issues.length)failures.push(file.name);
        report.status=report.candidates?'استُخرجت بيانات تحتاج مراجعة':report.issues.length?'تعذرت القراءة كليًا أو جزئيًا':report.texts.some(x=>x.text.trim())?'قُرئ النص ولم تُطابق حقول العميل':'لم يظهر نص قابل للقراءة';
      }
      return {rows:result.result(),failures,reports};
    }finally{if(worker)await worker.terminate().catch(()=>{})}
  }
  function errorReason(error){
    if(error?.name==='PasswordException')return 'الملف محمي بكلمة مرور؛ اختر نسخة مفتوحة.';
    if(error?.name==='InvalidPDFException')return 'ملف PDF تالف أو غير صالح.';
    if(/fetch|network|load|importScripts/i.test(error?.message||''))return 'تعذر تحميل مكوّن القراءة أو اللغة؛ تحقق من الإنترنت وأعد المحاولة.';
    return String(error?.message||'تعذرت قراءة الصفحة.').slice(0,200);
  }
  window.tamkeenWholesaleReader={scan,labels:Object.freeze(labels),extractText:(raw)=>{const out=sources();extractTextSource(raw,'نص مستند',out);return out.result()},pdfText};
})();
