/* إدخال القضايا وجلسات التراضي من رسائل واتساب.
   1) في «إضافة قضية» و«إضافة جلسة تراضي»: خانة للصق الرسالة → استخراج البيانات وتعبئة الحقول الفارغة،
      ويُحفظ نص الرسالة مع السجل. إذا كانت الرسالة فيها موعد جلسة للقضية تُضاف الجلسة تلقائيًا بعد الحفظ.
   2) داخل القضية أو جلسة التراضي: خانة «رسالة موعد جديد» — إذا حدد القاضي جلسة أخرى بتاريخ مختلف:
      - القضية: تُضاف جلسة جديدة مرتبطة بها (وتبقى الجلسات السابقة سجلًا تاريخيًا).
      - جلسة التراضي: يُحدَّث موعدها، ويُحفظ الموعد السابق ونص الرسالة في سجل المواعيد.
   كل شيء يُعرض للمراجعة قبل الحفظ، ولا يكتب فوق ما أدخله المستخدم. */
(function(root){
  'use strict';
  const digits = s => String(s ?? '').replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[‎‏‪-‮]/g, '');
  const clean = s => String(s || '').replace(/[*_~()«»"“”]+/g, '').replace(/\s+/g, ' ').replace(/^[\s:：\-–—]+|[\s،,.\-–—]+$/g, '').trim();

  // استخراج الحقول النصية من رسالة (القيم الزمنية تأتي من محلل الإشعارات الموجود في البرنامج)
  function parseText(raw){
    const t = digits(raw);
    const out = {};
    const ALL_LABELS = /^(?:رقم|المدعي|المدعى|المحكمة|الدائرة|تاريخ|الموضوع|موضوع|نوع|التصنيف|حالة|الحالة|المبلغ|قيمة|طالب|الطرف|المقامة|ضد|الساعة|الوقت)/;
    const label = (labels, max = 80) => {
      for (const l of labels){
        const m = new RegExp('(?:^|\\n|\\s)(?:' + l + ')\\s*[:：\\-]\\s*([^\\n]{2,' + max + '})').exec(t);
        if (m) return clean(m[1]);
      }
      // بدون نقطتين: «التسمية    القيمة» في سطر واحد، أو التسمية وحدها والقيمة في السطر التالي
      for (const l of labels){
        const a = new RegExp('(?:^|\\n)\\s*(?:' + l + ')[ \\t]{2,}([^\\n]{2,' + max + '})').exec(t);
        if (a && !ALL_LABELS.test(a[1].trim())) return clean(a[1]);
        const b = new RegExp('(?:^|\\n)\\s*(?:' + l + ')\\s*\\n\\s*([^\\n]{2,' + max + '})').exec(t);
        if (b && !ALL_LABELS.test(b[1].trim()) && !/^\\d+$/.test(b[1].trim())) return clean(b[1]);
      }
      return '';
    };
    // رقم القضية: يشمل «للقضية رقم:» و«للدعوى» والرقم في السطر التالي
    const cn = /(?:ال|لل|ل)?(?:قضية|قضيه|دعوى|دعوي)\s*(?:رقم)?\s*[:：#(]?\s*(\d{6,})/.exec(t);
    if (cn) out.caseNo = cn[1];
    // صيغة ناجز: «المقامة من: …» ثم «ضد: …» كل واحدة في سطر
    out.plaintiff = label(['اسم المدعي','المدعي','المدعية','بيانات المدعي','طالب الصلح','مقدم الطلب','طالب التنفيذ','المقامة من','المقامه من','مقامة من','المرفوعة من','المقدمة من']);
    out.defendant = label(['اسم المدعى عليه','المدعى عليه','المدعى عليها','بيانات المدعى عليه','المدعي عليه','الطرف الآخر','الطرف الثاني','المطلوب ضده الصلح','المنفذ ضده','ضد','في مواجهة']);
    const vs = /(?:مقامة|المقامة|المرفوعة|مرفوعة|المقدمة|مقدمة)\s+من\s+(?:قبل\s+)?(.{3,60}?)\s+(?:ضد|على)\s+(.{3,60}?)(?=[\n،,.]|\s+(?:لدى|في|أمام|بتاريخ|وموعد)|$)/.exec(t);
    if (vs){ out.plaintiff = out.plaintiff || clean(vs[1]); out.defendant = out.defendant || clean(vs[2]); }
    // رسائل ناجز الموجهة لصاحب الهوية: «الدعوى المقامة ضدكم من X» أو «المقامة منكم ضد X»
    const COMPANY = 'شركة تمكين الدولية';
    const stop = '(?=[\\n،,.]|\\s+(?:لدى|في|أمام|بتاريخ|وموعد|موعد|برقم|رقم)|$)';
    const against = new RegExp('(?:المقامة|المرفوعة|المقدمة|مقامة|مرفوعة|مقدمة)\\s+(?:عليكم|ضدكم|ضدك|عليك)\\s+(?:من|بواسطة)\\s+(?:قبل\\s+)?[(«"]?(.{3,70}?)[)»"]?' + stop).exec(t);
    const byYou = new RegExp('(?:المقامة|المرفوعة|المقدمة|مقامة|مرفوعة|مقدمة)\\s+(?:منكم|منك)\\s+(?:ضد|على)\\s+[(«"]?(.{3,70}?)[)»"]?' + stop).exec(t);
    if (against){ out.plaintiff = out.plaintiff || clean(against[1]); out.defendant = out.defendant || COMPANY; out.side = 'مدعى عليها'; }
    else if (byYou){ out.defendant = out.defendant || clean(byYou[1]); out.plaintiff = out.plaintiff || COMPANY; out.side = 'مدعية'; }
    else if (/(?:ضدكم|عليكم)/.test(t) && out.plaintiff && !out.defendant){ out.defendant = COMPANY; out.side = 'مدعى عليها'; }
    else if (out.plaintiff && /تمكين/.test(out.plaintiff)) out.side = 'مدعية';
    else if (out.defendant && /تمكين/.test(out.defendant)) out.side = 'مدعى عليها';
    out.subject = label(['موضوع الدعوى','نوع الدعوى الفرعي','التصنيف الفرعي للدعوى','موضوع القضية','موضوع النزاع','موضوع الطلب','نوع الدعوى','التصنيف الفرعي','التصنيف','الموضوع']);
    const court = /(المحكمة\s+(?:ال)?[ء-ي]+(?:\s+(?:ال)?[ء-ي]+){0,3}?(?:\s+(?:ب|في\s+)[ء-ي]+)?)(?=[\n،,.]|\s+(?:الدائرة|بتاريخ|وموعد|موعد|رقم|في\s+تمام|الساعة|حفظه|حفظها|وفقه|سلمه)|$)/.exec(t);
    if (court) out.court = clean(court[1]);
    const circuit = /(الدائرة\s+(?:[ء-ي]+|\d+)(?:\s+(?:[ء-ي]+|\d+)){0,4}?)(?=[\n،,.]|\s+(?:بالمحكمة|في\s+المحكمة|لدى|بتاريخ|وموعد|موعد|في\s+تمام|الساعة)|$)/.exec(t);
    if (circuit) out.circuit = clean(circuit[1]);
    const amt = /(?:بمبلغ|مبلغ\s+(?:المطالبة|الدعوى)?|قيمة\s+المطالبة|المطالبة\s+بمبلغ)\s*[:：]?[\s(]*(\d[\d,٬]*(?:\.\d+)?)[\s)]*(?:ريال|ر\.?\s?س)/.exec(t) || /(\d[\d,٬]{3,}(?:\.\d+)?)[\s)]*(?:ريال|ر\.?\s?س)/.exec(t);
    if (amt){ const n = Number(amt[1].replace(/[,٬\s]/g, '')); if (n > 0) out.claimAmount = n; }
    if (/(?:مرئية|عن\s+بعد|افتراضية|عبر\s+(?:منصة\s+)?(?:ناجز|الاتصال|المرئي))/.test(t)) out.place = 'جلسة مرئية';
    const place = label(['مقر الجلسة','مكان الجلسة','القاعة','المكان'], 60);
    if (place) out.place = place;
    for (const k of Object.keys(out)) if (out[k] === '' || out[k] == null) delete out[k];
    return out;
  }
  const fmtDate = g => { try { return root.fmtDate ? root.fmtDate({orig:'g', g, h: root.g2h ? root.g2h(g) : '', verified:true}) : g; } catch(e){ return g; } };

  const core = {parseText, digits};
  if (typeof module === 'object' && module.exports){ module.exports = core; return; }
  root.TamkeenWhatsApp = core;

  /* ===== التحليل الكامل في البرنامج ===== */
  function parseFull(mod, raw){
    const base = mod === 'taradi' && root.taradiNoticeParse ? root.taradiNoticeParse(raw) : (root.hearingNoticeParse ? root.hearingNoticeParse(raw) : {});
    const txt = parseText(raw);
    const r = Object.assign({}, txt);
    for (const k of ['caseNo','reqNo','date','time','link']) if (base[k]) r[k] = base[k];
    for (const k of ['plaintiff','defendant','subject']) if (!r[k] && base[k]) r[k] = base[k];
    r.ambiguous = !!base.ambiguous;
    return r;
  }
  const LABELS = {side:'صفة الشركة', caseNo:'رقم القضية', reqNo:'رقم طلب الصلح', plaintiff:'المدعي', defendant:'المدعى عليه', court:'المحكمة', circuit:'الدائرة', subject:'الموضوع', claimAmount:'قيمة المطالبة', date:'تاريخ الجلسة', time:'الوقت', place:'المكان', link:'رابط الجلسة'};
  const showVal = (k, v) => k === 'date' ? fmtDate(v) : k === 'claimAmount' ? Number(v).toLocaleString('ar-SA-u-nu-latn') + ' ريال' : String(v);
  const box = (cls, ...kids) => root.h('div', {class: 'banner ' + cls}, ...kids);
  const styleTA = 'width:100%;min-height:96px;padding:12px;border:1px solid var(--line);border-radius:12px;background:var(--surface-2);color:var(--ink);font:inherit;line-height:1.7';

  /* ===== قارئ الملفات (صور أو PDF) — يحوّلها لنص ثم يمر على نفس المحلل ===== */
  async function filesToText(files, progress){
    let text = '', methods = new Set(); const kinds = [];
    for (const f of files){
      const pages = await root.TamkeenOcr.readFilePages(f, progress, 10);
      let ft = '';
      for (const pg of pages){ ft += (ft ? '\n' : '') + pg.text; methods.add(pg.method); }
      kinds.push({name: f.name, kind: docKind(ft)});
      text += (text ? '\n' : '') + ft;
    }
    filesToText.lastKinds = kinds;
    if (!text.trim() && !files.some(f => /pdf|image/i.test(f.type) || /\.(pdf|jpe?g|png|webp)$/i.test(f.name))) throw new Error('ارفع صورة (لقطة شاشة من ناجز أو واتساب) أو ملف PDF.');
    filesToText.lastMethods = [...methods];
    return text.trim();
  }
  function docKind(text){
    const t = String(text || '');
    // الأكثر تحديدًا أولًا: المذكرة قد تذكر «فاتورة» في متنها
    if (/(?:مذكرة جوابية|مذكرة رد|مذكرة دفاع|لائحة اعتراضية|لائحة الاعتراض|مذكرة)/.test(t)) return 'مذكرة';
    if (/(?:صحيفة الدعوى|صحيفة دعوى)/.test(t)) return 'صحيفة دعوى';
    if (/(?:منطوق الحكم|حكمت الدائرة|نص الحكم|صك الحكم)/.test(t)) return 'صك حكم';
    if (/(?:مشفرة تمامًا|مشفرة تماما|مشغرة|الرسائل والمكالمات|WhatsApp|آخر ظهور|ليس ضمن جهات الاتصال)/.test(t)) return 'محادثة واتساب (لقطات شاشة)';
    if (/(?:الرقم الضريبي|ضريبة القيمة|مبلغ الضريبة|سياسة الاستبدال|سياسة الإستبدال|فاتورة ضريبية)/.test(t)) return 'فاتورة';
    if (/(?:الطرف الأول|الطرف الاول)/.test(t) && /(?:عقد|العقد)/.test(t)) return 'عقد';
    // القراءة الضوئية قد تشوّه «الرقم الضريبي»؛ نكتفي بعلامتين من علامات الفاتورة
    if ((t.match(/(?:الإجمالي|الاجمالي|صافي القيمة|كود الصنف|المبلغ|القيمة|الكمية|ريال)/g) || []).length >= 4) return 'فاتورة';
    return '';
  }
  function readerControls(onText){
    const inp = root.h('input', {type:'file', multiple:true, accept:'image/png,image/jpeg,image/webp,application/pdf', style:'display:none'});
    const prog = root.h('span', {class:'small muted', 'aria-live':'polite'});
    const btn = root.h('button', {type:'button', class:'btn sm', onclick: () => inp.click()}, '📎 قراءة من صورة أو PDF');
    inp.onchange = async () => {
      const files = [...inp.files].slice(0, 6); inp.value = ''; if (!files.length) return;
      btn.disabled = true;
      try { const text = await filesToText(files, m => { prog.textContent = m; }); prog.textContent = text ? 'قُرئ الملف.' : 'ما قدرت أقرأ نصًا من الملف.'; await onText(text, files); }
      catch (e){ prog.textContent = e.message || String(e); }
      finally { btn.disabled = false; }
    };
    return [btn, inp, prog];
  }
  let pendingFiles = null;       // ملفات تُرفق بالسجل الجديد بعد حفظه
  async function attachPending(mod, id){
    const pf = pendingFiles; if (!pf || pf.mod !== mod) return; pendingFiles = null;
    try { await root.uploadFiles(pf.files, [mod + ':' + id], () => {}, mod === 'taradi' ? 'إشعار جلسة' : 'مستندات القضية'); root.toast && root.toast('أُرفقت ' + pf.files.length + ' ملفات بالسجل'); }
    catch (e){ root.toast && root.toast('تعذر إرفاق الملفات: ' + e.message); }
  }

  /* ===== 1) نموذج «إضافة جديد» ===== */
  let formData = null;           // بيانات النموذج المفتوح (تُلتقط من fieldInput)
  let pendingHearing = null;     // موعد جلسة ينتظر إنشاء القضية

  function newFormPanel(mod, view){
    const ta = root.h('textarea', {dir:'auto', style: styleTA, 'aria-label':'نص رسالة واتساب', placeholder: mod === 'taradi'
      ? 'الصق رسالة واتساب الخاصة بجلسة الصلح هنا (رقم الطلب، الأطراف، الموعد، الرابط…)'
      : 'الصق رسالة واتساب الخاصة بالقضية هنا (رقم القضية، المحكمة، الأطراف، موعد الجلسة…)'});
    const out = root.h('div', {'aria-live':'polite'});
    const btn = root.h('button', {type:'button', class:'btn primary sm', onclick: run}, 'استخراج البيانات وتعبئة النموذج');
    function run(){
      out.replaceChildren();
      const raw = ta.value.trim();
      if (!raw){ out.append(box('warn', 'الصق الرسالة أولًا.')); return; }
      const p = parseFull(mod, raw);
      const map = mod === 'taradi'
        ? {reqNo:'reqNo', plaintiff:'plaintiff', defendant:'defendant', subject:'subject', claimAmount:'claimAmount', time:'time', place:'place', link:'link'}
        : {caseNo:'caseNo', plaintiff:'plaintiff', defendant:'defendant', court:'court', circuit:'circuit', subject:'subject', claimAmount:'claimAmount', side:'side'};
      const label = k => mod === 'taradi' ? ({plaintiff:'طالب الصلح', defendant:'الطرف الآخر'}[k] || LABELS[k]) : LABELS[k];
      const filled = [], skipped = [];
      const d = formData || {};
      for (const [pk, fk] of Object.entries(map)){
        if (p[pk] == null || p[pk] === '') continue;
        if (d[fk] != null && d[fk] !== ''){ skipped.push(label(pk)); continue; }
        setVal(d, fk, p[pk]); filled.push(label(pk));
      }
      if (mod === 'taradi' && p.date){
        if (d.date && (d.date.g || d.date.h)) skipped.push(LABELS.date);
        else { setDate(d, 'date', p.date); filled.push(LABELS.date); }
      }
      setVal(d, 'noticeMessage', raw);
      if (mod === 'cases'){
        pendingHearing = p.date && p.time ? {date:p.date, time:p.time, link:p.link || '', place:p.place || '', message: raw, at: Date.now(), caseNo: p.caseNo || ''} : null;
      }
      const kids = [];
      if (filled.length) kids.push(box('ok', 'عُبّئ: ' + filled.join('، ') + '. راجعها قبل الحفظ.'));
      if (skipped.length) kids.push(box('info', 'لم أغيّر ما أدخلته بنفسك: ' + skipped.join('، ') + '.'));
      if (mod === 'cases' && pendingHearing) kids.push(box('info', 'في الرسالة موعد جلسة ' + fmtDate(p.date) + ' الساعة ' + p.time + ' — ستُضاف الجلسة للقضية تلقائيًا بعد الحفظ.'));
      if (mod === 'cases' && p.date && !p.time) kids.push(box('warn', 'في الرسالة تاريخ بدون وقت؛ أضف الجلسة من صفحة القضية بعد الحفظ.'));
      if (p.ambiguous) kids.push(box('warn', 'الرسالة فيها أكثر من رقم أو تاريخ؛ تأكد من القيم المختارة.'));
      if (mod === 'cases' && !d.plaintiff) kids.push(box('warn', 'الرسالة ما فيها اسم المدعي بشكل واضح — اكتبه يدويًا في خانة «المدعي» (حقل إلزامي للحفظ).'));
      if (mod === 'taradi'){
        const miss = [['plaintiff','طالب الصلح'],['defendant','الطرف الآخر'],['subject','موضوع النزاع']].filter(([k]) => !d[k]).map(([, l]) => l);
        if (miss.length) kids.push(box('warn', 'الرسالة ما فيها: ' + miss.join('، ') + ' — أكملها يدويًا (حقول إلزامية للحفظ).'));
      }
      // منع التكرار: نفس رقم القضية/الطلب موجود مسبقًا
      const nn = v => (root.normDigits ? root.normDigits(String(v || '')) : String(v || '')).replace(/[\s\-–—]/g, '');
      const num = mod === 'taradi' ? p.reqNo : p.caseNo;
      if (num){
        const dup = root.recs(mod).find(r => nn(mod === 'taradi' ? r.reqNo : r.caseNo) === nn(num));
        if (dup) kids.unshift(box('warn', root.h('span', null, (mod === 'taradi' ? 'طلب الصلح' : 'القضية') + ' رقم ' + num + ' موجود مسبقًا في البرنامج. إذا كانت هذه رسالة موعد جديد ',
          root.h('a', {href: '#' + mod + '-' + dup.id}, 'افتح السجل الموجود'), ' والصق الرسالة في «' + (mod === 'taradi' ? 'تحديث موعد الجلسة' : 'إضافة الجلسة القادمة') + '» بدل إنشاء سجل مكرر.')));
      }
      if (!filled.length && !pendingHearing) kids.push(box('warn', 'ما قدرت أستخرج بيانات من الرسالة. عبّئ الحقول يدويًا، وحُفظ نص الرسالة مع السجل.'));
      out.replaceChildren(...kids);
    }
    return root.h('div', {class:'panel wa-intake'},
      root.h('h2', {style:'margin:0 0 6px;font-size:1.05rem'}, 'من رسالة واتساب أو ملف'),
      root.h('p', {class:'small muted', style:'margin:0 0 10px'}, mod === 'taradi'
        ? 'الصق الرسالة، أو ارفع صورة/لقطة شاشة أو PDF لإشعار الجلسة. البرنامج يعبّي الحقول الفارغة ويحفظ النص مع السجل، ويرفق الملف بعد الحفظ.'
        : 'الصق الرسالة، أو ارفع صورة/لقطة شاشة من ناجز أو صحيفة الدعوى (صورة أو PDF). البرنامج يعبّي الحقول الفارغة ويحفظ النص مع القضية، ويرفق الملف بعد الحفظ.'),
      ta, root.h('div', {class:'row', style:'margin-top:10px;gap:8px;flex-wrap:wrap;align-items:center'}, btn, ...readerControls((text, files) => {
        pendingFiles = {mod, files};
        const p = text ? parseFull(mod, text) : {};
        const useful = ['caseNo','reqNo','plaintiff','defendant','court','circuit','date'].some(k => p[k]);
        const kinds = filesToText.lastKinds || [];
        const list = kinds.length > 1 || (kinds[0] && kinds[0].kind) ? box('info', 'الملفات: ' + kinds.map(k => k.name + ' ← ' + (k.kind || 'غير مصنّف')).join(' · ') + '. كلها ستُرفق بالسجل بعد الحفظ.') : null;
        if (text && useful){ ta.value = (ta.value.trim() ? ta.value.trim() + '\n' : '') + text; run(); if (list) out.prepend(list); }
        else if (text) out.replaceChildren(...[list, box('info', 'الملفات قُرئت لكنها لا تحتوي بيانات القضية (رقم القضية أو الأطراف أو الموعد) — تبدو مستندات مؤيدة، وستُرفق بالسجل بعد الحفظ.')].filter(Boolean));
        else out.replaceChildren(box('warn', 'ما قدرت أقرأ نصًا واضحًا من الملف؛ عبّئ الحقول يدويًا. سيُرفق الملف بالسجل بعد الحفظ.'));
      })), out);
  }
  function setVal(d, k, v){
    d[k] = v;
    const el = document.getElementById('f_' + k);
    if (el){
      el.value = v == null ? '' : String(v);
      el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', {bubbles:true}));
    }
  }
  function setDate(d, k, g){
    d[k] = {orig:'g', g, h: root.g2h ? root.g2h(g) : '', verified:true};
    const el = document.getElementById('f_' + k);
    if (el && el.type === 'date'){ el.value = g; el.dispatchEvent(new Event('input', {bubbles:true})); }
  }

  /* بعد حفظ قضية جديدة: إضافة الجلسة التي في الرسالة */
  async function afterCaseSaved(id){
    const p = pendingHearing; if (!p) return;
    if (Date.now() - p.at > 30 * 60 * 1000){ pendingHearing = null; return; }
    const c = root.rec('cases', id); if (!c) return;
    if (p.caseNo && root.normDigits && root.normDigits(c.caseNo || '').replace(/\s/g,'') !== p.caseNo) return;
    pendingHearing = null;
    try {
      const hid = await root.hearingNoticeSave({caseId:id, date:p.date, time:p.time, link:p.link, place:p.place, message:p.message});
      root.toast && root.toast('أُضيفت جلسة ' + fmtDate(p.date) + ' الساعة ' + p.time + ' للقضية');
      return hid;
    } catch (e){ root.toast && root.toast('لم تُضف الجلسة: ' + e.message); }
  }

  /* ===== 2) داخل القضية / جلسة التراضي: موعد جديد ===== */
  function updatePanel(mod, id){
    const ta = root.h('textarea', {dir:'auto', style: styleTA, 'aria-label':'رسالة الموعد الجديد',
      placeholder: 'حدد القاضي جلسة أخرى؟ الصق رسالة الموعد الجديد هنا'});
    const out = root.h('div', {'aria-live':'polite'});
    const details = root.h('details', {class:'panel wa-update'},
      root.h('summary', {style:'cursor:pointer;font-weight:700'}, mod === 'taradi' ? 'تحديث موعد الجلسة من رسالة' : 'إضافة الجلسة القادمة من رسالة'),
      root.h('p', {class:'small muted'}, mod === 'taradi'
        ? 'يُحدَّث موعد جلسة الصلح، ويُحفظ الموعد السابق ونص الرسالة في سجل المواعيد.'
        : 'تُضاف جلسة جديدة مرتبطة بهذه القضية، وتبقى الجلسات السابقة كما هي.'),
      ta, root.h('div', {class:'row', style:'margin-top:10px;gap:8px;flex-wrap:wrap;align-items:center'}, root.h('button', {type:'button', class:'btn primary sm', onclick: analyse}, 'قراءة الموعد'), ...readerControls(async (text, files) => {
        if (text){ ta.value = text; analyse(); }
        if (!root.S?.readOnly){ try { await root.uploadFiles(files, [mod + ':' + id], () => {}, 'إشعار جلسة'); out.prepend(box('info', 'أُرفق الملف بالسجل.')); } catch (e){ out.prepend(box('warn', 'تعذر إرفاق الملف: ' + e.message)); } }
      })), out);
    function analyse(){
      out.replaceChildren();
      const raw = ta.value.trim(); if (!raw){ out.append(box('warn', 'الصق الرسالة أولًا.')); return; }
      const p = parseFull(mod, raw);
      const r = root.rec(mod, id); if (!r){ out.append(box('bad', 'السجل غير موجود.')); return; }
      // تحقق من أن الرسالة لنفس القضية/الطلب إن ذُكر رقم
      const num = mod === 'taradi' ? p.reqNo : p.caseNo, mine = mod === 'taradi' ? r.reqNo : r.caseNo;
      const n = s => root.normDigits ? root.normDigits(String(s || '')).replace(/[\s\-–—]/g,'') : String(s || '');
      if (num && mine && n(num) !== n(mine)) out.append(box('warn', 'رقم ' + (mod === 'taradi' ? 'الطلب' : 'القضية') + ' في الرسالة (' + num + ') يختلف عن رقم هذا السجل (' + mine + '). تأكد أنها الرسالة الصحيحة.'));
      if (!p.date){ out.append(box('warn', 'ما لقيت تاريخًا واضحًا في الرسالة.' + (p.ambiguous ? ' فيها أكثر من تاريخ.' : ''))); return; }
      // الوقت: من الرسالة، وإلا يُكتب يدويًا
      const timeIn = root.h('input', {type:'time', value: p.time || (mod === 'taradi' ? (r.time || '') : ''), 'aria-label':'الوقت', style:'max-width:150px'});
      const cur = mod === 'taradi' ? (root.dateG ? root.dateG(r.date) : '') : '';
      const same = mod === 'taradi' && cur === p.date && (r.time || '') === (p.time || '');
      const rows = [['التاريخ', fmtDate(p.date)], ...(p.link ? [['الرابط', p.link]] : []), ...(p.place ? [['المكان', p.place]] : [])];
      const save = root.h('button', {type:'button', class:'btn primary sm', disabled: same || root.S?.readOnly, onclick: async () => {
        save.disabled = true;
        try {
          const time = timeIn.value;
          if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error('أدخل وقت الجلسة.');
          if (mod === 'cases'){
            const hid = await root.hearingNoticeSave({caseId:id, date:p.date, time, link:p.link || '', place:p.place || '', message: raw});
            out.replaceChildren(box('ok', root.h('span', null, 'أُضيفت الجلسة. ', root.h('a', {href:'#hearings-' + hid}, 'فتح الجلسة'))));
          } else {
            const fresh = root.rec('taradi', id);
            const hist = Array.isArray(fresh.dateHistory) ? fresh.dateHistory.slice() : [];
            hist.push({date: fresh.date || null, time: fresh.time || '', changedAt: new Date().toISOString(), message: raw.slice(0, 4000)});
            const patch = {date:{orig:'g', g:p.date, h: root.g2h ? root.g2h(p.date) : '', verified:true}, time, dateHistory: hist,
              noticeMessage: [fresh.noticeMessage, raw].filter(Boolean).join('\n— — —\n').slice(-20000), status: 'مجدولة'};
            if (p.link) patch.link = p.link; if (p.place) patch.place = p.place;
            const res = await root.writeDoc('taradi', id, patch, fresh.rev);
            if (!res || !res.ok) throw new Error(res && res.conflict ? 'عُدّل السجل من جهاز آخر؛ حدّث الصفحة وأعد المحاولة.' : 'تعذر الحفظ؛ أعد المحاولة.');
            root.audit && root.audit('تحديث موعد من رسالة', 'taradi', id, p.date + ' ' + time);
            out.replaceChildren(box('ok', 'تم تحديث موعد الجلسة إلى ' + fmtDate(p.date) + ' الساعة ' + time + '، وحُفظ الموعد السابق في السجل.'));
          }
          ta.value = '';
        } catch (e){ out.append(box('bad', e.message)); save.disabled = false; }
      }}, mod === 'taradi' ? 'تحديث الموعد' : 'إضافة الجلسة');
      out.append(root.h('div', {class:'wa-preview', style:'display:grid;gap:8px;margin-top:8px'},
        ...rows.map(([k, v]) => root.h('div', null, root.h('b', null, k + ': '), root.h('span', {dir:'auto'}, v))),
        root.h('label', {class:'f', style:'max-width:220px'}, root.h('span', null, 'الوقت'), timeIn),
        same ? box('info', 'هذا هو نفس الموعد المسجل حاليًا.') : null,
        mod === 'taradi' && cur && !same ? box('info', 'الموعد الحالي: ' + fmtDate(cur) + (r.time ? ' الساعة ' + r.time : '') + ' — سيُحفظ في سجل المواعيد.') : null,
        root.h('div', {class:'row'}, save)));
    }
    return details;
  }
  // سجل المواعيد السابقة لجلسة التراضي
  function historyPanel(id){
    const r = root.rec('taradi', id); const hist = r && Array.isArray(r.dateHistory) ? r.dateHistory : [];
    if (!hist.length) return null;
    return root.h('details', {class:'panel wa-hist'}, root.h('summary', {style:'cursor:pointer;font-weight:700'}, 'المواعيد السابقة (' + hist.length + ')'),
      root.h('ul', {style:'margin:8px 0 0;padding-inline-start:20px;line-height:2'}, hist.slice().reverse().map(x =>
        root.h('li', null, (x.date ? fmtDate(root.dateG ? root.dateG(x.date) : x.date) : '—') + (x.time ? ' الساعة ' + x.time : '') + ' · غُيّر في ' + new Date(x.changedAt).toLocaleDateString('ar-SA-u-nu-latn-ca-gregory')))));
  }

  /* ===== الربط ===== */
  function hook(){
    if (typeof MODS !== 'undefined'){
      for (const m of ['cases','taradi']) if (MODS[m] && !MODS[m].fields.some(f => f.k === 'noticeMessage'))
        MODS[m].fields.push({k:'noticeMessage', l:'نص الرسالة الواردة (واتساب)', t:'area', w:1});
    }
    if (typeof root.fieldInput === 'function' && !root.fieldInput.__wa){
      const orig = root.fieldInput;
      root.fieldInput = function(f, val, onCh, ro, data){ if (data && !data.id && !ro) formData = data; return orig.apply(this, arguments); };
      root.fieldInput.__wa = true;
    }
    if (typeof root.viewNew === 'function' && !root.viewNew.__wa){
      const orig = root.viewNew;
      root.viewNew = function(mod){
        formData = null;
        const v = orig.apply(this, arguments);
        try {
          if ((mod === 'cases' || mod === 'taradi') && v && v.el && !root.S?.readOnly){
            const panel = newFormPanel(mod, v.el);
            const head = v.el.querySelector('.page-head');
            head ? head.after(panel) : v.el.prepend(panel);
          }
        } catch (e){ console.warn('wa new', e); }
        return v;
      };
      root.viewNew.__wa = true;
    }
    if (typeof root.viewDetail === 'function' && !root.viewDetail.__wa){
      const orig = root.viewDetail;
      root.viewDetail = function(mod, id){
        const v = orig.apply(this, arguments);
        try {
          if ((mod === 'cases' || mod === 'taradi') && v && v.el){
            if (mod === 'cases' && pendingHearing) setTimeout(() => afterCaseSaved(id), 300);
            if (pendingFiles && pendingFiles.mod === mod) setTimeout(() => attachPending(mod, id), 500);
            if (!root.S?.readOnly && root.rec(mod, id)){
              const panel = updatePanel(mod, id);
              let hist = null;
              // يُعاد وضع اللوحة إذا أعادت الصفحة رسم نفسها (مثلًا بعد حفظ جلسة)
              const place = () => {
                const head = v.el.querySelector('.page-head');
                const at = head || v.el.firstChild;
                if (mod === 'taradi'){ const nh = historyPanel(id); if (hist && hist !== nh) hist.remove(); hist = nh; }
                if (!v.el.contains(panel)){ if (at && at.after) at.after(panel); else v.el.prepend(panel); }
                if (hist && !v.el.contains(hist)) panel.after(hist);
              };
              place();
              const r = v.refresh; if (typeof r === 'function') v.refresh = function(){ const out = r.apply(this, arguments); try { place(); } catch(e){} return out; };
              new MutationObserver(() => { if (!v.el.contains(panel)) place(); }).observe(v.el, {childList:true});
            }
          }
        } catch (e){ console.warn('wa detail', e); }
        return v;
      };
      root.viewDetail.__wa = true;
    }
  }
  if (document.readyState !== 'loading') hook(); else document.addEventListener('DOMContentLoaded', hook);
})(typeof window !== 'undefined' ? window : globalThis);
// تنسيق اللوحات القابلة للطي حتى لا تأخذ مساحة فارغة وهي مغلقة
(function(){ if (typeof document === 'undefined') return; const st = document.createElement('style');
  st.textContent = 'details.wa-update,details.wa-hist{padding-block:14px!important;display:block!important}details.wa-update:not([open])>:not(summary),details.wa-hist:not([open])>:not(summary){display:none!important}details.wa-update>summary,details.wa-hist>summary{list-style-position:inside}.wa-intake textarea:focus,.wa-update textarea:focus{outline:2px solid var(--accent);outline-offset:1px}';
  document.head.appendChild(st); })();
