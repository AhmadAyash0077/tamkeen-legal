/* إدخال أسهل — إضافات فوق النماذج الحالية بدون تغيير طريقة الحفظ:
   1) «الصق وخلّص» في طلبات التنفيذ والمخالفات والجلسات والسندات: تلصق نص الرسالة أو الإشعار فيوزَّع على الخانات الفارغة.
   2) اسحب ملفًا على أي صفحة: يُقرأ محليًا ويُفتح النموذج المناسب معبّأ، ويُرفق الملف بعد الحفظ.
   3) تعديل داخل الجدول (قلم عند المرور على الخانة) + تعديل جماعي لعدة سجلات.
   4) يتذكر آخر اختياراتك (المحكمة، المحامي، المدينة…) ويعرضها مع زر مسح.
   5) تاريخ سريع: اليوم، بكرة، +أسبوع، +شهر، أو كتابة «18/11» / «بعد 10 أيام» / تاريخ هجري.
   6) «حفظ وإضافة آخر» و«تكرار السجل».
   القاعدة: لا يُكتب فوق ما أدخله المستخدم، ولا يُخمَّن شيء غير مذكور بتسميته في النص. */
(function(root){
  'use strict';
  const EE = root.__ee = {prefill:null, again:null, noSticky:false, pendingFile:null, forms:new WeakSet(), lastForm:null};
  const LSg = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch(e){ return d; } };
  const LSs = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch(e){} };
  const nd = s => normDigits(s);
  const today = () => todayISO();
  const iso = d => d.toISOString().slice(0, 10);
  const addDays = (g, n) => { const d = new Date(g + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return iso(d); };
  const addMonths = (g, n) => { const d = new Date(g + 'T12:00:00Z'); d.setUTCMonth(d.getUTCMonth() + n); return iso(d); };
  const dv = g => ({orig:'g', g, h: g2h(g) || '', verified:true});
  const filled = v => !(v == null || v === '' || (typeof v === 'object' && !Array.isArray(v) && !v.g && !v.h));
  const newMod = () => { const m = /^#new-([a-z]+)$/.exec(location.hash); return m && MODS[m[1]] ? m[1] : null; };
  const pad = n => String(n).padStart(2, '0');

  /* ---------- تحليل التاريخ المكتوب ---------- */
  function parseDate(raw){
    let s = nd(raw).replace(/[‎‏]/g, '').trim(); if (!s) return null;
    const t = today();
    if (/^اليوم$/.test(s)) return dv(t);
    if (/^(بكر[ةه]|غد[اً]?|غدا)$/.test(s)) return dv(addDays(t, 1));
    if (/^أمس|^امس/.test(s)) return dv(addDays(t, -1));
    let m = /^(?:بعد|\+)\s*(\d{1,3})?\s*(يوم(?:ين)?|[اأ]يام|[اأ]سبوع(?:ين)?|[اأ]سابيع|شهر(?:ين)?|[اأ]شهر|شهور)?$/.exec(s);
    if (m && (m[1] || m[2])){
      let n = m[1] ? +m[1] : 1; const u = m[2] || 'يوم';
      if (/ين$/.test(u) && !m[1]) n = 2;
      if (/سبوع|سابيع/.test(u)) return dv(addDays(t, n * 7));
      if (/شهر|شهور/.test(u)) return dv(addMonths(t, n));
      return dv(addDays(t, n));
    }
    const hij = /هـ|ه$/.test(s); s = s.replace(/\s*(هـ|ه|م)\s*$/, '').trim();
    m = /^(\d{4})\s*[-\/.]\s*(\d{1,2})\s*[-\/.]\s*(\d{1,2})$/.exec(s);
    let y, mo, d;
    if (m){ y = +m[1]; mo = +m[2]; d = +m[3]; }
    else if ((m = /^(\d{1,2})\s*[-\/.]\s*(\d{1,2})\s*[-\/.]\s*(\d{4})$/.exec(s))){ d = +m[1]; mo = +m[2]; y = +m[3]; }
    else if ((m = /^(\d{1,2})\s*[-\/.]\s*(\d{1,2})$/.exec(s))){ d = +m[1]; mo = +m[2]; y = hij ? null : +t.slice(0, 4); }
    else return null;
    if (y == null || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
    if (hij || (y >= 1300 && y <= 1600)){
      const hs = `${y}-${pad(mo)}-${pad(d)}`; const g = h2g(hs); if (!g) return null;
      return {orig:'h', h:hs, g, verified:false};
    }
    if (y < 1900 || y > 2100) return null;
    const g = `${y}-${pad(mo)}-${pad(d)}`; const chk = new Date(g + 'T12:00:00Z');
    if (isNaN(chk) || chk.getUTCDate() !== d) return null;
    return dv(g);
  }
  // أول تاريخ داخل نص حر
  function findDate(text){
    const s = nd(text);
    const m = /(\d{4}\s*[-\/.]\s*\d{1,2}\s*[-\/.]\s*\d{1,2}|\d{1,2}\s*[-\/.]\s*\d{1,2}\s*[-\/.]\s*\d{4})\s*(هـ|م)?/.exec(s);
    return m ? parseDate(m[1] + (m[2] || '')) : null;
  }
  function findTime(text){
    const s = nd(text); const m = /(\d{1,2})\s*[:٫.]\s*(\d{2})\s*(ص|م|صباح[اً]?|مساء[اً]?|AM|PM)?/i.exec(s);
    if (!m) return null; let hh = +m[1]; const mm = +m[2]; if (hh > 23 || mm > 59) return null;
    const ap = m[3] || ''; if (/^م|مساء|PM/i.test(ap) && hh < 12) hh += 12; if (/^ص|صباح|AM/i.test(ap) && hh === 12) hh = 0;
    return pad(hh) + ':' + pad(mm);
  }

  /* ---------- «الصق وخلّص»: تسميات كل قسم ---------- */
  const LABELS = {
    executions: {
      reqNo:['رقم الطلب التنفيذي','رقم طلب التنفيذ','رقم الطلب'], respondent:['المنفذ ضده','المنفذ ضدها','المنفذ ضدهم'],
      applicant:['طالب التنفيذ','طالبة التنفيذ'], claimAmount:['مبلغ المطالبة','المبلغ المطالب به','مبلغ الطلب','مبلغ التنفيذ'],
      filed:['تاريخ التقديم','تاريخ تقديم الطلب','تاريخ الطلب','تاريخ القيد'], decision:['القرار الحالي','نوع القرار','القرار'], branch:['الفرع']
    },
    violations: {
      number:['رقم المخالفة','رقم القرار','رقم الفاتورة','رقم السداد'], authority:['الجهة المصدرة','الجهة'],
      reason:['سبب المخالفة','وصف المخالفة','نوع المخالفة'], amount:['قيمة المخالفة','مبلغ المخالفة','مبلغ الغرامة','قيمة الغرامة','الغرامة'],
      date:['تاريخ المخالفة','تاريخ القرار','تاريخ الرصد'], city:['المدينة'], branch:['الفرع أو الموقع','الفرع','الموقع'],
      payDeadline:['آخر موعد للسداد','تاريخ انتهاء السداد','مهلة السداد'], objDeadline:['آخر موعد للاعتراض','تاريخ انتهاء الاعتراض','مهلة الاعتراض']
    },
    bonds: {
      bondNo:['رقم السند'], debtor:['المدين','محرر السند','المحرر'], creditor:['الدائن','المستفيد'],
      issueDate:['تاريخ السند','تاريخ الإنشاء','تاريخ الانشاء','تاريخ التحرير'], dueDate:['تاريخ الاستحقاق']
    },
    hearings: { place:['القاعة','المكان','مكان الجلسة'], attendee:['من سيحضر','الحاضر'] }
  };
  const ANY_LABEL = /^(رقم|تاريخ|المنفذ|طالب|مبلغ|القرار|الفرع|الجهة|سبب|وصف|نوع|قيمة|الغرامة|المدينة|الموقع|آخر|مهلة|المدين|الدائن|المستفيد|المحرر|القاعة|المكان|الحالة|الوقت)/;
  function labelValue(text, labels){
    for (const l of labels){
      const e = l.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      let m = new RegExp('(?:^|\\n|[\\s،])' + e + '\\s*[:：\\-–]\\s*([^\\n]{1,120})').exec(text);
      if (!m) m = new RegExp('(?:^|\\n)\\s*' + e + '[ \\t]{2,}([^\\n]{1,120})').exec(text);
      if (!m){ const b = new RegExp('(?:^|\\n)\\s*' + e + '\\s*\\n\\s*([^\\n]{1,120})').exec(text); if (b && !ANY_LABEL.test(b[1].trim())) m = b; }
      if (m){ const v = m[1].replace(/[*_~«»"“”]+/g, '').replace(/\s+/g, ' ').replace(/^[\s:：\-–]+|[\s،,.\-–]+$/g, '').trim(); if (v) return v; }
    }
    return '';
  }
  function parsePaste(mod, raw){
    const text = nd(raw).replace(/[‎‏‪-‮]/g, ''); const M = MODS[mod]; const out = {}; const map = LABELS[mod] || {};
    for (const [k, labels] of Object.entries(map)){
      const f = M.fields.find(x => x.k === k); if (!f) continue;
      const v = labelValue(text, labels); if (!v) continue;
      if (f.t === 'date'){ const d = findDate(v); if (d) out[k] = d; }
      else if (f.t === 'money' || f.t === 'int'){ const m = /(\d[\d,٬]*(?:[.٫]\d+)?)/.exec(v); if (m){ const n = parseNum(m[1]); if (n != null && !Number.isNaN(n) && n > 0) out[k] = n; } }
      else if (f.t === 'ltr'){ const m = /([A-Za-z0-9][A-Za-z0-9\-\/]{2,40})/.exec(v); if (m) out[k] = m[1]; }
      else if (f.t === 'select'){ const o = (f.o || []).find(x => v.includes(x)); if (o) out[k] = o; }
      else out[k] = v.slice(0, 120);
    }
    if (mod === 'hearings'){
      const d = findDate(text); if (d) out.date = d;
      const tm = findTime(text); if (tm) out.time = tm;
      const url = /(https?:\/\/[^\s<>"']+)/.exec(text); if (url) out.link = url[1];
      const nums = text.match(/\d{8,12}/g) || [];
      const c = statRecs('cases').find(c => c.caseNo && nums.includes(String(c.caseNo).trim()));
      if (c) out.caseId = c.id;
    }
    return out;
  }
  const PASTE_TIP = {executions:'نص إشعار ناجز أو بيانات الطلب', violations:'نص إشعار المخالفة أو رسالة الجهة', hearings:'رسالة موعد الجلسة (يتعرف على القضية من رقمها)', bonds:'بيانات السند كما تظهر في نافذ'};
  function fieldLabel(mod, k){ const f = MODS[mod].fields.find(x => x.k === k); return f ? f.l : k; }

  EE.parseDate = parseDate; EE.parsePaste = parsePaste; EE.findTime = findTime;
  if (typeof module === 'object' && module.exports && typeof document === 'undefined'){ module.exports = {parseDate, parsePaste, findTime, findDate}; return; }

  function applyToForm(mod, vals, note){
    const cur = EE.lastForm && EE.lastForm.mod === mod ? EE.lastForm.data : {};
    const merged = {}; const used = [];
    for (const [k, v] of Object.entries(cur)) if (filled(v)) merged[k] = v;
    for (const [k, v] of Object.entries(vals)){ if (!filled(merged[k]) || (EE.lastForm && EE.lastForm.sticky && EE.lastForm.sticky.includes(k))){ merged[k] = v; used.push(k); } }
    EE.prefill = {mod, vals:merged, exact:true}; EE.noSticky = true;
    if (location.hash === '#new-' + mod) route(); else location.hash = '#new-' + mod;
    if (note !== false) toast(used.length ? 'عبّيت ' + used.length + ' خانة: ' + used.map(k => fieldLabel(mod, k)).join('، ') : 'ما لقيت بيانات بتسميات واضحة في النص — ما عبّيت شي', 5200);
    return used;
  }
  function pasteBox(mod){
    const ta = h('textarea', {dir:'auto', rows:4, placeholder:'الصق هنا ' + (PASTE_TIP[mod] || 'النص') + '…', 'aria-label':'نص للصق'});
    const go = h('button', {type:'button', class:'btn primary sm', onclick:() => {
      if (!ta.value.trim()){ toast('الصق النص أول'); return; }
      applyToForm(mod, parsePaste(mod, ta.value));
    }}, 'وزّع على الخانات');
    return h('details', {class:'more ee-paste', open: LSg('ee_paste_open', true) || null, ontoggle:e => LSs('ee_paste_open', e.target.open)},
      h('summary', null, '⚡ الصق وخلّص — عبّي الخانات من نص رسالة أو إشعار'),
      h('div', {class:'ee-paste-body'}, ta, h('div', {class:'row'}, go, h('span', {class:'small muted'}, 'يعبّي الخانات الفارغة فقط، وما يخمّن شي غير مكتوب بتسميته. راجع قبل الحفظ.'))));
  }

  /* ---------- يتذكر آخر الاختيارات ---------- */
  const STICKY = {
    cases:['court','lawyerId','side','owner'], hearings:['attendee','place'], executions:['applicant','rep','branch'],
    violations:['city','authority','owner','recordKind'], taradi:['attendee','place','side','owner'], bonds:['creditor'], attest:['requester','chamber'], poa:['issuer','owner']
  };
  function rememberLast(mod, data){
    const keys = STICKY[mod]; if (!keys || !data) return; const o = {};
    for (const k of keys) if (typeof data[k] === 'string' && data[k].trim()) o[k] = data[k];
    if (Object.keys(o).length) LSs('ee_last_' + mod, o);
  }

  /* ---------- ربط النماذج: التقاط بيانات «جديد» + التعبئة المسبقة ---------- */
  function hookForms(){
    if (typeof root.fieldInput === 'function' && !root.fieldInput.__ee){
      const orig = root.fieldInput;
      root.fieldInput = function(f, val, onCh, ro, data){
        const mod = newMod();
        if (mod && data && !data.id && !ro && !EE.forms.has(data)){
          EE.forms.add(data); const info = {mod, data, sticky:[]}; EE.lastForm = info;
          const p = EE.prefill && EE.prefill.mod === mod ? EE.prefill : null; EE.prefill = null;
          if (p){ for (const [k, v] of Object.entries(p.vals)) if (p.exact || !filled(data[k])) data[k] = v; }
          if (!EE.noSticky && LSg('ee_sticky_on', true)){
            const last = LSg('ee_last_' + mod, null);
            if (last) for (const [k, v] of Object.entries(last)){
              const fd = MODS[mod].fields.find(x => x.k === k); if (!fd || filled(data[k])) continue;
              if (fd.t === 'ref' && !rec(fd.ref, v)) continue;
              if (fd.t === 'select' && !(fd.o || []).includes(v)) continue;
              data[k] = v; info.sticky.push(k);
            }
          }
          EE.noSticky = false;
          val = data[f.k];
        }
        return orig.call(this, f, val, onCh, ro, data);
      };
      root.fieldInput.__ee = true;
    }
    if (typeof root.dateField === 'function' && !root.dateField.__ee){
      const orig = root.dateField;
      const build = function(f, val, onCh, ro){
        const node = orig.call(this, f, val, onCh, ro);
        if (ro || !node || !node.classList) return node;
        node.classList.add('ee-df');
        const set = (v, keep) => { if (!v) return; onCh(v); const fresh = build(f, v, onCh, ro); node.replaceWith(fresh); if (keep){ const i = fresh.querySelector('input'); if (i) i.focus(); } };
        const chip = (l, fn) => h('button', {type:'button', class:'ee-chip', tabindex:-1, onclick:() => set(dv(fn()), true)}, l);
        const base = () => { const i = node.querySelector('input[type=date]'); return (i && i.value) || (val && typeof val === 'object' && val.g) || today(); };
        const txt = h('input', {type:'text', class:'ee-dtxt', dir:'auto', placeholder:'اكتب: 18/11 أو بعد 10 أيام أو 1448/6/1', 'aria-label':'كتابة سريعة للتاريخ',
          onkeydown:e => { if (e.key === 'Enter'){ if (!txt.value.trim()) return; e.preventDefault(); const v = parseDate(txt.value); if (v) set(v); else { txt.classList.add('bad-in'); toast('ما فهمت التاريخ. أمثلة: 18/11 — 18/11/2026 — بعد أسبوع — 1448/6/1'); } } },
          oninput:() => txt.classList.remove('bad-in')});
        node.append(h('div', {class:'ee-dq'}, chip('اليوم', today), chip('بكرة', () => addDays(today(), 1)), chip('+أسبوع', () => addDays(base(), 7)), chip('+شهر', () => addMonths(base(), 1)), txt));
        return node;
      };
      root.dateField = build; root.dateField.__ee = true;
    }
    if (typeof root.viewNew === 'function' && !root.viewNew.__ee){
      const orig = root.viewNew;
      root.viewNew = function(mod){
        const v = orig.apply(this, arguments);
        try { decorateNew(mod, v); } catch(e){ console.warn('easy-entry new', e); }
        return v;
      };
      root.viewNew.__ee = true;
    }
    if (typeof root.viewDetail === 'function' && !root.viewDetail.__ee){
      const orig = root.viewDetail;
      root.viewDetail = function(mod, id){
        const v = orig.apply(this, arguments);
        try { decorateDetail(mod, id, v); } catch(e){ console.warn('easy-entry detail', e); }
        return v;
      };
      root.viewDetail.__ee = true;
    }
  }
  function decorateNew(mod, v){
    if (!v || !v.el || !MODS[mod]) return;
    const info = EE.lastForm && EE.lastForm.mod === mod ? EE.lastForm : null;
    const sb = [...v.el.querySelectorAll('button.btn.primary')].find(b => /^حفظ$/.test((b.textContent || '').trim()));
    const panel = (sb && sb.closest('.panel')) || v.el.querySelector('.panel'); if (!panel) return;
    // الصق وخلّص
    if (LABELS[mod]) panel.before(pasteBox(mod));
    // ملف مسحوب بانتظار الإرفاق
    if (EE.pendingFile && EE.pendingFile.mod === mod)
      panel.before(h('div', {class:'banner info ee-note'}, '📎 الملف «' + EE.pendingFile.file.name + '» بيترفق تلقائيًا بعد الحفظ. ',
        h('button', {type:'button', class:'btn sm ghost', onclick:e => { EE.pendingFile = null; e.target.closest('.ee-note').remove(); }}, 'لا ترفقه')));
    // آخر الاختيارات
    if (info && info.sticky.length)
      panel.before(h('div', {class:'banner info ee-note'}, 'عبّيت من آخر إدخال: ' + info.sticky.map(k => fieldLabel(mod, k)).join('، ') + '. ',
        h('button', {type:'button', class:'btn sm ghost', onclick:() => { const keep = {}; for (const [k, x] of Object.entries(info.data)) if (filled(x) && !info.sticky.includes(k)) keep[k] = x; EE.prefill = {mod, vals:keep, exact:true}; EE.noSticky = true; route(); }}, 'امسحها'),
        h('button', {type:'button', class:'btn sm ghost', onclick:() => { LSs('ee_sticky_on', false); EE.noSticky = true; route(); toast('وقّفت التذكّر. ترجّعه من الإعدادات > إدخال أسهل'); }}, 'لا تتذكر')));
    // حفظ وإضافة آخر
    const save = [...panel.querySelectorAll('button.btn.primary')].find(b => /^حفظ$/.test((b.textContent || '').trim()));
    if (save && !panel.querySelector('.ee-again')){
      const again = h('button', {type:'button', class:'btn ee-again', title:'يحفظ السجل ويفتح نموذجًا جديدًا مباشرة', onclick:() => { EE.again = {mod, at:Date.now()}; save.click(); }}, 'حفظ وإضافة آخر');
      save.after(again);
    }
  }
  const NO_COPY = /^(id|rev|status|source|links|deleted|notes|result|decision|judgment|caseNo|reqNo|number|bondNo|ref_no|customer_code|objRef|judgmentNo|link|time|paid|remaining|awarded|nextTasks)$/;
  function decorateDetail(mod, id, v){
    if (!v || !v.el || !S.canWrite || !MODS[mod] || mod === 'contracts') return;
    const head = v.el.querySelector('.page-head'); if (!head || head.querySelector('.ee-dup')) return;
    const btn = h('button', {type:'button', class:'btn ee-dup', title:'يفتح نموذجًا جديدًا بنفس البيانات العامة (بدون الأرقام والتواريخ)', onclick:() => {
      const r = rec(mod, id); if (!r) return; const vals = {};
      for (const f of MODS[mod].fields){ if (NO_COPY.test(f.k) || f.t === 'date' || f.t === 'area') continue; if (filled(r[f.k])) vals[f.k] = r[f.k]; }
      EE.prefill = {mod, vals, exact:true}; EE.noSticky = true; location.hash = '#new-' + mod;
      toast('نسخت البيانات العامة. عبّي الأرقام والتواريخ الجديدة.', 4200);
    }}, 'تكرار السجل');
    const row = head.querySelector(':scope>.row'); if (row) row.append(btn); else head.append(h('div', {class:'row'}, btn));
  }

  /* ---------- بعد الحفظ: تذكّر + إضافة آخر + إرفاق الملف المسحوب ---------- */
  let prevHash = location.hash;
  root.addEventListener('hashchange', () => {
    const was = prevHash; prevHash = location.hash;
    const m = /^#new-([a-z]+)$/.exec(was); if (!m) return; const mod = m[1];
    const n = new RegExp('^#' + mod + '-(.+)$').exec(location.hash); if (!n) { if (EE.again && EE.again.mod === mod && location.hash !== was) EE.again = null; return; }
    const id = decodeURIComponent(n[1]);
    if (EE.lastForm && EE.lastForm.mod === mod) rememberLast(mod, EE.lastForm.data);
    if (EE.pendingFile && EE.pendingFile.mod === mod && typeof uploadFiles === 'function'){
      const pf = EE.pendingFile; EE.pendingFile = null;
      uploadFiles([pf.file], [mod + ':' + id], (msg, cl) => { if (cl === 'bad') toast(typeof msg === 'string' ? msg : 'تعذر إرفاق الملف'); })
        .then(() => toast('تم إرفاق «' + pf.file.name + '» بالسجل'), () => toast('تعذر إرفاق الملف — ارفعه يدويًا من صفحة السجل'));
    }
    if (EE.again && EE.again.mod === mod && Date.now() - EE.again.at < 60000){
      EE.again = null; toast('تم الحفظ ✓ — أضف التالي', 2600);
      setTimeout(() => { location.replace('#new-' + mod); }, 60);
    }
  });

  /* ---------- اسحب ملفًا على أي صفحة ---------- */
  const GUESS = [
    ['hearings', 'موعد جلسة', /موعد\s*(ال)?جلس|جلسة\s*(مرئية|قضائية)|تم\s*تحديد\s*جلسة/],
    ['executions', 'طلب تنفيذ', /المنفذ\s*ضد|طلب\s*(ال)?تنفيذ|محكمة\s*التنفيذ|قرار\s*34|قرار\s*46/],
    ['violations', 'مخالفة', /مخالف[ةه]|غرام[ةه]|إشعار\s*مخالفة/],
    ['bonds', 'سند لأمر', /سند\s*ل[أا]مر|السندات\s*التنفيذية|نافذ/],
    ['cases', 'قضية', /صحيفة\s*(ال)?دعوى|رقم\s*القضية|المدعى\s*عليه|لائحة\s*دعوى/],
    ['contracts', 'عقد أو مستندات عميل', /السجل\s*التجاري|العنوان\s*الوطني|الطرف\s*الثاني|عقد\s*(توريد|تركيب)|فتح\s*حساب/]
  ];
  let overlay = null, dragDepth = 0;
  const hasFiles = e => e.dataTransfer && [...(e.dataTransfer.types || [])].includes('Files');
  const inOwnZone = el => !!(el && el.closest && el.closest('.drop,input[type=file],label,dialog,.ee-ignore-drop,[class*="dropzone"],[class*="-drop"]'));
  function showOverlay(on){
    if (on && !overlay){ overlay = h('div', {class:'ee-overlay'}, h('div', {class:'ee-overlay-box'}, h('b', null, 'أفلت الملف هنا'), h('span', null, 'أقراه وأفتح لك النموذج المناسب معبّأ'))); document.body.append(overlay); }
    if (!on && overlay){ overlay.remove(); overlay = null; }
  }
  async function readDropped(file, status){
    if (!root.TamkeenOcr || typeof root.TamkeenOcr.readFilePages !== 'function') throw new Error('قارئ الملفات غير جاهز. حدّث الصفحة وجرّب مرة ثانية.');
    const pages = await root.TamkeenOcr.readFilePages(file, m => { try { status(typeof m === 'string' ? m : 'جارٍ القراءة…'); } catch(e){} }, 3);
    return (pages || []).map(p => p.textWithDigits || p.text || '').join('\n');
  }
  function chooseDialog(file, text){
    const g = GUESS.filter(x => x[2].test(text) && MODS[x[0]] && canSee(x[0]));
    const best = g[0] ? g[0][0] : null;
    const dlg = h('dialog', {class:'ee-dlg'});
    const pick = mod => { dlg.close(); dlg.remove(); openWith(mod, file, text); };
    const btns = GUESS.filter(x => MODS[x[0]] && canSee(x[0])).map(x => h('button', {type:'button', class:'btn' + (x[0] === best ? ' primary' : ''), onclick:() => pick(x[0])}, x[1]));
    dlg.append(h('h3', {style:'margin:0 0 6px'}, 'قريت «' + file.name + '»'),
      h('p', {class:'small muted', style:'margin:0 0 12px'}, text.trim() ? (best ? 'يبدو أنه ' + g[0][1] + '. اختر وين أفتحه:' : 'ما عرفت نوعه بثقة. اختر وين أفتحه:') : 'ما قدرت أقرا نص من الملف، لكن أقدر أفتح لك النموذج وأرفقه بعد الحفظ. اختر النوع:'),
      h('div', {class:'row'}, btns), h('div', {class:'row', style:'margin-top:12px'}, h('button', {type:'button', class:'btn ghost sm', onclick:() => { dlg.close(); dlg.remove(); }}, 'إلغاء')));
    document.body.append(dlg); dlg.showModal();
  }
  function openWith(mod, file, text){
    if (mod === 'contracts' || mod === 'cases' || mod === 'taradi'){
      EE.lastForm = null; location.hash = '#new-' + mod;
      let tries = 0; const t = setInterval(() => {
        const inp = document.querySelector('#view input[type=file][multiple][accept*="application/pdf"]');
        if (inp || ++tries > 40){ clearInterval(t);
          let ok = false;
          if (inp){ try { const dt = new DataTransfer(); dt.items.add(file); inp.files = dt.files; inp.dispatchEvent(new Event('change', {bubbles:true})); ok = true; } catch(e){} }
          toast(ok ? 'سلّمت الملف لقارئ المستندات في النموذج' : 'ارفع الملف من خانة قراءة المستندات في النموذج', 4200); }
      }, 150);
      return;
    }
    let vals = parsePaste(mod, text);
    EE.pendingFile = {mod, file}; EE.lastForm = null;
    applyToForm(mod, vals);
  }
  async function handleDrop(file){
    if (file.size > 25 * 1024 * 1024){ toast('الملف أكبر من 25 ميجا'); return; }
    if (!/\.(pdf|png|jpe?g|webp|tiff?|bmp)$/i.test(file.name) && !/^(image\/|application\/pdf)/.test(file.type || '')){ toast('أقرا ملفات PDF والصور فقط'); return; }
    const st = h('div', {class:'toast ee-reading', role:'status'}, 'جارٍ قراءة «' + file.name + '»…'); document.body.append(st);
    let text = '';
    try { text = await readDropped(file, m => { st.textContent = 'جارٍ قراءة «' + file.name + '»… ' + m; }); }
    catch(e){ console.warn('easy-entry drop', e); }
    st.remove(); chooseDialog(file, text);
  }
  document.addEventListener('dragenter', e => { if (!hasFiles(e) || !S || !S.canWrite) return; dragDepth++; if (!inOwnZone(e.target)) showOverlay(true); });
  document.addEventListener('dragleave', e => { if (!hasFiles(e)) return; dragDepth = Math.max(0, dragDepth - 1); if (!dragDepth) showOverlay(false); });
  document.addEventListener('dragover', e => { if (!hasFiles(e) || !S || !S.canWrite) return; if (inOwnZone(e.target)){ showOverlay(false); return; } e.preventDefault(); });
  document.addEventListener('drop', e => {
    dragDepth = 0; const own = inOwnZone(e.target); showOverlay(false);
    if (!hasFiles(e) || own || e.defaultPrevented || !S || !S.canWrite) return;
    e.preventDefault(); const f = e.dataTransfer.files && e.dataTransfer.files[0]; if (f) handleDrop(f);
  });

  /* ---------- تعديل داخل الجدول + تعديل جماعي ---------- */
  const listMod = () => { const m = /^#([a-z]+)(~[\w]+)?$/.exec(location.hash); return m && MODS[m[1]] ? m[1] : null; };
  const EDITABLE = f => f && ['text','ltr','select','ref','money','int','time', undefined].includes(f.t);
  const B = {on:false, ids:new Set(), bar:null};
  function colField(mod, label){
    const M = MODS[mod]; if (label === 'الحالة') return {k:'status', l:'الحالة', t:'select', o:M.st};
    const f = M.fields.find(x => x.l === label); return EDITABLE(f) ? f : null;
  }
  function editorFor(mod, f, cur){
    if (f.t === 'select'){ const s = h('select', null, f.k === 'status' ? null : h('option', {value:''}, '—'), (f.o || []).map(o => h('option', {value:o}, o))); s.value = cur || ''; return s; }
    if (f.t === 'ref'){ const s = h('select', null, h('option', {value:''}, '— اختر —'), recs(f.ref).map(r => h('option', {value:r.id}, titleOf(f.ref, r)))); s.value = cur || ''; return s; }
    if (f.t === 'time') return h('input', {type:'time', value:cur || ''});
    return h('input', {type:'text', dir:f.t === 'ltr' || f.t === 'money' || f.t === 'int' ? 'ltr' : 'auto', value:cur == null ? '' : String(cur)});
  }
  function readEditor(f, el){
    const v = el.value;
    if (f.t === 'money' || f.t === 'int'){ if (String(v).trim() === '') return {ok:true, v:null}; const n = parseNum(v); return Number.isNaN(n) ? {ok:false} : {ok:true, v:n}; }
    return {ok:true, v: typeof v === 'string' ? v.trim() : v};
  }
  async function saveField(mod, id, f, v){
    const r = rec(mod, id); if (!r) return false;
    if (f.k === 'status' && !v) return false;
    if (f.req && (v == null || v === '')){ toast('«' + f.l + '» خانة إلزامية'); return false; }
    if ((r[f.k] ?? '') === (v ?? '')) return true;
    const res = await writeDoc(mod, id, {[f.k]: v === '' ? null : v}, r.rev);
    if (res && res.ok){ try { audit('تعديل', mod, id, titleOf(mod, r)); } catch(e){} return true; }
    return false;
  }
  function inlineEdit(td, mod, id, f){
    if (td.querySelector('.ee-ed')) return;
    const r = rec(mod, id); if (!r) return;
    const ed = editorFor(mod, f, r[f.k]); ed.classList.add('ee-ed');
    const old = [...td.childNodes]; td.replaceChildren(ed); td.classList.add('ee-editing'); ed.focus(); if (ed.select) try { ed.select(); } catch(e){}
    let done = false;
    const cancel = () => { if (done) return; done = true; td.classList.remove('ee-editing'); td.replaceChildren(...old); };
    const commit = async () => { if (done) return; const x = readEditor(f, ed); if (!x.ok){ ed.classList.add('bad-in'); toast('رقم غير صالح'); return; }
      done = true; td.classList.remove('ee-editing'); ed.disabled = true;
      const ok = await saveField(mod, id, f, x.v);
      if (!ok){ toast('ما انحفظ التعديل — جرّب من صفحة السجل'); td.replaceChildren(...old); }
      else { toast('تم الحفظ ✓', 1500); if (td.isConnected && td.contains(ed)) td.replaceChildren(...old); } };
    ed.addEventListener('click', e => e.stopPropagation());
    ed.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter'){ e.preventDefault(); commit(); } else if (e.key === 'Escape'){ e.preventDefault(); cancel(); } });
    if (ed.tagName === 'SELECT') ed.addEventListener('change', commit);
    ed.addEventListener('blur', () => setTimeout(() => { if (!done) (ed.tagName === 'SELECT' ? cancel : commit)(); }, 120));
  }
  function decorateTable(){
    const mod = listMod(); const view = document.getElementById('view'); if (!mod || !view || !S || !S.canWrite) return;
    const table = view.querySelector('.table-wrap>table'); if (!table) return;
    const ths = [...table.querySelectorAll('thead th')].filter(th => !th.classList.contains('ee-th'));
    const fields = ths.map(th => colField(mod, (th.textContent || '').trim()));
    // زر التعديل الجماعي
    const headRow = view.querySelector('.page-head>.row') || view.querySelector('.page-head');
    if (headRow && !view.querySelector('.ee-bulk-btn')){
      headRow.append(h('button', {type:'button', class:'btn ee-bulk-btn', onclick:() => { B.on = !B.on; if (!B.on) B.ids.clear(); paintBulk(); decorateTable(); }}, 'تعديل جماعي'));
    }
    const trs = table.querySelectorAll('tbody tr[data-id]');
    for (const tr of trs){
      const id = tr.dataset.id;
      if (!tr.dataset.ee){
        tr.dataset.ee = '1';
        const tds = [...tr.children];
        tds.forEach((td, i) => { const f = fields[i]; if (!f) return; td.classList.add('ee-can');
          td.append(h('button', {type:'button', class:'ee-pen', title:'تعديل ' + f.l, 'aria-label':'تعديل ' + f.l, tabindex:-1, onclick:e => { e.stopPropagation(); e.preventDefault(); inlineEdit(td, mod, id, f); }}, '✎')); });
      }
      let cb = tr.querySelector(':scope>td.ee-sel');
      if (B.on && !cb){ const c = h('input', {type:'checkbox', 'aria-label':'تحديد السجل', checked:B.ids.has(id)}); cb = h('td', {class:'ee-sel', onclick:e => e.stopPropagation()}, c); c.addEventListener('change', () => { c.checked ? B.ids.add(id) : B.ids.delete(id); tr.classList.toggle('ee-picked', c.checked); paintBulk(); }); tr.prepend(cb); tr.classList.toggle('ee-picked', B.ids.has(id)); }
      if (!B.on && cb){ cb.remove(); tr.classList.remove('ee-picked'); }
    }
    const hr = table.querySelector('thead tr'); let hth = hr && hr.querySelector('.ee-th');
    if (B.on && hr && !hth){ const all = h('input', {type:'checkbox', 'aria-label':'تحديد الكل', onchange:e => { table.querySelectorAll('tbody tr[data-id]').forEach(tr => { e.target.checked ? B.ids.add(tr.dataset.id) : B.ids.delete(tr.dataset.id); const c = tr.querySelector('.ee-sel input'); if (c) c.checked = e.target.checked; tr.classList.toggle('ee-picked', e.target.checked); }); paintBulk(); }}); hr.prepend(h('th', {class:'ee-th'}, all)); }
    if (!B.on && hth) hth.remove();
  }
  function paintBulk(){
    const mod = listMod();
    if (!B.on || !mod){ if (B.bar){ B.bar.remove(); B.bar = null; } document.documentElement.classList.remove('ee-bulk-on'); return; }
    document.documentElement.classList.add('ee-bulk-on');
    const M = MODS[mod];
    const opts = [{k:'status', l:'الحالة', t:'select', o:M.st}, ...M.fields.filter(f => ['select','ref','text'].includes(f.t) && !/name|title|subject|reason|plaintiff|defendant|respondent|debtor/i.test(f.k))];
    if (!B.bar){ B.bar = h('div', {class:'ee-bar ee-ignore-drop', role:'region', 'aria-label':'تعديل جماعي'}); document.body.append(B.bar); B.fk = 'status'; }
    if (!opts.some(o => o.k === B.fk)) B.fk = 'status';
    const f = opts.find(o => o.k === B.fk);
    const fs = h('select', {'aria-label':'الخانة', onchange:e => { B.fk = e.target.value; B.confirm = false; paintBulk(); }}, opts.map(o => h('option', {value:o.k}, o.l))); fs.value = B.fk;
    const ed = editorFor(mod, f, ''); ed.setAttribute('aria-label', 'القيمة الجديدة'); if (f.t === 'text') ed.placeholder = 'القيمة الجديدة';
    const n = B.ids.size;
    const go = h('button', {type:'button', class:'btn primary sm', disabled: !n || null, onclick:async () => {
      const x = readEditor(f, ed); if (!x.ok || x.v === '' || x.v == null){ toast('اختر القيمة الجديدة'); return; }
      if (!B.confirm){ B.confirm = true; go.textContent = 'تأكيد: تغيير «' + f.l + '» في ' + n + ' سجل'; go.classList.add('ee-confirm'); setTimeout(() => { if (go.isConnected){ B.confirm = false; go.textContent = 'طبّق'; go.classList.remove('ee-confirm'); } }, 6000); return; }
      B.confirm = false; go.disabled = true; let ok = 0, bad = 0;
      for (const id of [...B.ids]){ go.textContent = 'جارٍ الحفظ ' + (ok + bad + 1) + '/' + n; (await saveField(mod, id, f, x.v)) ? ok++ : bad++; }
      toast('تم تعديل ' + ok + ' سجل' + (bad ? ' — ' + bad + ' ما انحفظ (جرّبه من صفحته)' : ''), 5000);
      B.ids.clear(); paintBulk(); decorateTable();
    }}, 'طبّق');
    B.bar.replaceChildren(h('b', null, 'محدد: ' + n), h('span', {class:'small'}, 'غيّر'), fs, h('span', {class:'small'}, 'إلى'), ed, go,
      h('button', {type:'button', class:'btn ghost sm', onclick:() => { B.on = false; B.ids.clear(); paintBulk(); decorateTable(); }}, 'إغلاق'));
  }

  /* ---------- تشغيل ---------- */
  let queued = false;
  const queue = () => { if (queued) return; queued = true; requestAnimationFrame(() => { queued = false; try { decorateTable(); } catch(e){ console.warn('easy-entry table', e); } }); };
  function start(){
    hookForms();
    const v = document.getElementById('view'); if (v) new MutationObserver(queue).observe(v, {childList:true, subtree:true});
    root.addEventListener('hashchange', () => { if (B.on){ B.on = false; B.ids.clear(); paintBulk(); } });
    // خيار التذكّر في الإعدادات
    if (typeof root.viewPrefs === 'function' && !root.viewPrefs.__ee){
      const orig = root.viewPrefs;
      root.viewPrefs = function(){ const v = orig.apply(this, arguments);
        try { const box = h('div', {class:'panel'}); const paint = () => { const on = LSg('ee_sticky_on', true); box.replaceChildren(h('h2', {style:'margin:0 0 6px;font-size:1.1rem'}, 'إدخال أسهل'), h('p', {class:'small muted', style:'margin:0 0 12px'}, 'تذكّر آخر اختياراتي في النماذج الجديدة (المحكمة، المحامي، المدينة…). يُحفظ على هذا الجهاز فقط.'), h('div', {class:'row'}, h('button', {type:'button', class:'btn sm' + (on ? ' primary' : ''), onclick:() => { LSs('ee_sticky_on', true); paint(); }}, 'مفعّل'), h('button', {type:'button', class:'btn sm' + (!on ? ' primary' : ''), onclick:() => { LSs('ee_sticky_on', false); paint(); }}, 'موقّف'))); }; paint();
          const place = () => { const g = v.el.querySelector('.grid-dash'); if (g && !g.contains(box)) g.append(box); else if (!g && !v.el.contains(box)) v.el.append(box); }; place(); const r = v.refresh; if (typeof r === 'function') v.refresh = function(){ r.apply(this, arguments); place(); };
        } catch(e){} return v; };
      root.viewPrefs.__ee = true;
    }
  }
  if (document.readyState !== 'loading') start(); else document.addEventListener('DOMContentLoaded', start);
})(typeof window !== 'undefined' ? window : globalThis);
