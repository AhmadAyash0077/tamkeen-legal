/* مكتب الموظفين الإلكترونيين: تعطي الموظف مهمة فيقوم بها.
   - موظف التقارير والمتابعة، وموظف البيانات: ينفّذان المهمة كاملة داخل البرنامج (مجانًا، بقواعد ثابتة).
   - المستشار والصائغ: يجهّز طلب الصياغة/التحليل كاملًا من بيانات السجل (مع إخفاء الهويات والجوالات)
     ويفتحه في حساب المستخدم على Claude. إذا كانت قراءة Claude مربوطة في البرنامج يكتب النتيجة هنا مباشرة.
   لا يرسل شيئًا لأي جهة دون ضغطة من المستخدم، ولا يعدّل السجلات إلا في المهام التي تنصّ على ذلك
   (تجهيز التجديدات والمطابقة) وبنفس منطق الموظفين الموجودين في البرنامج. */
(function(root){
  'use strict';
  const h = (...a) => root.h(...a);
  const box = (cls, ...kids) => h('div', {class:'banner ' + cls}, ...kids);
  const N = n => Number(n || 0).toLocaleString('ar-SA-u-nu-latn');
  const fd = v => { try { return root.fmtDate(v, false); } catch(e){ return ''; } };
  const link = (mod, r, label) => h('a', {href:'#' + mod + '-' + r.id}, label || root.titleOf(mod, r));
  const list = items => items.length ? h('ul', {style:'margin:6px 0 0;padding-inline-start:20px;line-height:2'}, items.map(x => h('li', null, ...[].concat(x)))) : h('p', {class:'muted small'}, 'لا شيء.');
  const LOGK = 'tl_ai_tasks';
  const log = (emp, task) => { try { const a = JSON.parse(localStorage.getItem(LOGK) || '[]'); a.unshift({emp, task, at: new Date().toISOString()}); localStorage.setItem(LOGK, JSON.stringify(a.slice(0, 30))); } catch(e){} };
  const readLog = () => { try { return JSON.parse(localStorage.getItem(LOGK) || '[]'); } catch(e){ return []; } };
  const isOpen = (mod, r) => { let closed = []; try { closed = MODS[mod].closed || []; } catch(e){} return !r.status || !closed.includes(r.status); };

  /* ===== موظف التقارير والمتابعة ===== */
  // تقرير بهوية شركة تمكين: الشعار، الكحلي والذهبي، رأس الإدارة، التاريخ، «أعدّه»، وخانة الاعتماد
  function printable(title, bodyHtml){
    const w = window.open('', '_blank'); if (!w){ root.toast && root.toast('اسمح بالنوافذ المنبثقة لعرض التقرير'); return; }
    const logo = (typeof LOGO !== 'undefined') ? LOGO : '';
    const today = (typeof todayISO === 'function' ? todayISO() : new Date().toISOString().slice(0, 10));
    let dateTxt = today; try { dateTxt = root.fmtG(today) + ' — ' + root.fmtH(root.g2h(today)); } catch(e){}
    const me = (typeof S !== 'undefined' && S.me && S.me.name) || (function(){ try { return localStorage.getItem('tl_user_name'); } catch(e){ return ''; } })();
    const prep = esc(me || 'إدارة الشؤون القانونية');
    w.document.write('<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + esc(title) + ' — ' + esc(today) + '</title>'
      + '<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;700&display=swap" rel="stylesheet"><style>'
      + ':root{--ink:#14202e;--ink2:#5a6878;--line:#e3e7ec;--brand:#0f2a44;--gold:#b08a3e;--soft:#f5f6f8}*{box-sizing:border-box}html{-webkit-print-color-adjust:exact;print-color-adjust:exact}'
      + 'body{margin:0;background:#e9ecf0;color:var(--ink);font-family:"IBM Plex Sans Arabic",Tahoma,sans-serif;font-size:13px;line-height:1.6}'
      + '.bar{position:sticky;top:0;z-index:5;display:flex;gap:10px;justify-content:center;padding:12px;background:var(--brand)}.bar button{font:inherit;font-weight:700;border:0;border-radius:10px;padding:10px 20px;cursor:pointer;background:var(--gold);color:#fff}'
      + '.page{width:210mm;max-width:100%;margin:18px auto;padding:16mm 15mm;background:#fff;box-shadow:0 10px 40px -20px rgba(0,0,0,.35)}'
      + 'header{display:flex;justify-content:space-between;align-items:center;gap:16px;border-bottom:3px solid var(--gold);padding-bottom:12px;margin-bottom:14px}header img{height:60px;width:auto}header h1{margin:0;font-size:22px;color:var(--brand)}header .sub{color:var(--ink2);font-size:12px}'
      + '.meta{display:flex;flex-wrap:wrap;gap:6px 22px;background:var(--soft);border:1px solid var(--line);border-radius:10px;padding:8px 12px;margin-bottom:14px;color:var(--ink2)}.meta b{color:var(--ink)}'
      + '.kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:0 0 14px}.kpi{border:1px solid var(--line);border-top:3px solid var(--brand);border-radius:10px;padding:10px 12px}.kpi .l{color:var(--ink2);font-size:12px}.kpi .v{font-size:20px;font-weight:700;color:var(--brand)}'
      + 'h2{font-size:15px;color:var(--brand);margin:18px 0 8px;border-inline-start:4px solid var(--gold);padding-inline-start:8px}table{width:100%;border-collapse:collapse;font-size:12px}th{background:var(--brand);color:#fff;font-weight:600}td,th{border:1px solid var(--line);padding:6px 8px;text-align:right}tr:nth-child(even) td{background:var(--soft)}'
      + '.sign{display:flex;justify-content:space-between;gap:20px;margin-top:28px;padding-top:12px;border-top:1px dashed var(--line)}footer{margin-top:18px;text-align:center;color:var(--ink2);font-size:11px;border-top:1px solid var(--line);padding-top:8px}'
      + '@media print{body{background:#fff}.bar{display:none}.page{margin:0;box-shadow:none;width:auto}}</style></head><body>'
      + '<div class="bar"><button onclick="print()">🖨 طباعة / حفظ PDF</button></div><section class="page">'
      + '<header><div><h1>' + esc(title) + '</h1><div class="sub">إدارة الشؤون القانونية — شركة تمكين الدولية للأجهزة المنزلية</div></div>' + (logo ? '<img src="' + logo + '" alt="تمكين">' : '') + '</header>'
      + '<div class="meta"><span>تاريخ التقرير: <b>' + esc(dateTxt) + '</b></span><span>أعدّه: <b>' + prep + '</b></span></div>'
      + bodyHtml
      + '<div class="sign"><div>أعدّه: <b>' + prep + '</b></div></div>'
      + '<footer>شركة تمكين الدولية للأجهزة المنزلية — إدارة الشؤون القانونية</footer></section></body></html>');
    w.document.close();
  }
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  function upcoming(days){
    const out = [];
    for (const r of root.recs('hearings')){ const d = root.daysUntil(root.dateG(r.date)); if (d != null && d >= 0 && d <= days){ const c = root.rec('cases', r.caseId); out.push({d, mod:'hearings', r, t:'جلسة' + (c ? ' — ' + root.titleOf('cases', c) : ''), when: fd(r.date) + (r.time ? ' ' + r.time : '')}); } }
    for (const r of root.recs('taradi')){ const d = root.daysUntil(root.dateG(r.date)); if (d != null && d >= 0 && d <= days) out.push({d, mod:'taradi', r, t:'جلسة تراضي — ' + root.titleOf('taradi', r), when: fd(r.date) + (r.time ? ' ' + r.time : '')}); }
    try { for (const a of root.uxAlerts().list) if (a.days != null && a.days >= 0 && a.days <= days && a.kind !== 'h_soon' && a.mod !== 'hearings') out.push({d:a.days, mod:a.mod, r:a.r, t:a.title + ' — ' + root.titleOf(a.mod, a.r), when: a.days === 0 ? 'اليوم' : a.days === 1 ? 'غدًا' : 'خلال ' + a.days + (a.days <= 10 ? ' أيام' : ' يومًا')}); } catch(e){}
    return out.sort((a, b) => a.d - b.d);
  }
  const REPORTS = {
    'تقرير القضايا المفتوحة': () => {
      const rows = root.recs('cases').filter(r => isOpen('cases', r));
      const sum = rows.reduce((s, r) => s + (Number(r.claimAmount) || 0), 0);
      const by = k => { const m = new Map(); for (const r of rows){ const v = (r[k] || 'غير محدد'); m.set(v, (m.get(v) || 0) + 1); } return [...m].sort((a, b) => b[1] - a[1]); };
      const hs = upcoming(30).filter(x => x.mod === 'hearings');
      const html = '<div class="kpis"><div class="kpi"><div class="l">عدد القضايا المفتوحة</div><div class="v">' + N(rows.length) + '</div></div><div class="kpi"><div class="l">إجمالي المطالبات</div><div class="v">' + N(sum) + ' ريال</div></div><div class="kpi"><div class="l">جلسات خلال 30 يومًا</div><div class="v">' + N(hs.length) + '</div></div></div>'
        + '<h2>حسب المحكمة</h2><table><tr><th>المحكمة</th><th>عدد القضايا</th></tr>' + by('court').map(([k, v]) => '<tr><td>' + esc(k) + '</td><td>' + v + '</td></tr>').join('') + '</table>'
        + '<h2>الجلسات القادمة</h2><table><tr><th>الموعد</th><th>القضية</th></tr>' + hs.map(x => '<tr><td>' + esc(x.when) + '</td><td>' + esc(x.t) + '</td></tr>').join('') + '</table>'
        + '<h2>تفاصيل القضايا</h2><table><tr><th>رقم القضية</th><th>المدعي</th><th>المدعى عليه</th><th>المحكمة</th><th>الحالة</th><th>المطالبة</th></tr>'
        + rows.map(r => '<tr><td>' + esc(r.caseNo) + '</td><td>' + esc(r.plaintiff) + '</td><td>' + esc(r.defendant) + '</td><td>' + esc(r.court) + '</td><td>' + esc(r.status) + '</td><td>' + (r.claimAmount ? N(r.claimAmount) : '') + '</td></tr>').join('') + '</table>';
      printable('تقرير القضايا المفتوحة', html);
      return box('ok', 'جُهّز التقرير: ' + N(rows.length) + ' قضية مفتوحة بمطالبات ' + N(sum) + ' ريال، و' + N(hs.length) + ' جلسة خلال 30 يومًا. فُتح في نافذة جديدة للطباعة أو الحفظ PDF.');
    },
    'تقرير طلبات التنفيذ': () => { const rows = root.recs('executions'); root.execReport(rows, ['جميع الطلبات']); return box('ok', 'جُهّز تقرير ' + N(rows.length) + ' طلب تنفيذ.'); },
    'تقرير العقود': () => { const rows = root.recs('contracts'); root.contractsReport(rows, ['جميع العقود']); return box('ok', 'جُهّز تقرير ' + N(rows.length) + ' عقد.'); },
    'تقرير المخالفات': () => { const rows = root.recs('violations'); root.violationsReport(rows, ['جميع المخالفات']); return box('ok', 'جُهّز تقرير ' + N(rows.length) + ' مخالفة.'); },
    'الجلسات والمهل خلال 14 يومًا': () => { const u = upcoming(14); return h('div', null, box(u.length ? 'warn' : 'ok', u.length ? N(u.length) + ' موعد خلال 14 يومًا:' : 'لا مواعيد خلال 14 يومًا.'), list(u.map(x => [h('b', null, x.when + ' — '), link(x.mod, x.r, x.t)]))); },
    'ملخص اليوم على واتساب': () => {
      // نفس محتوى البريد اليومي: أعداد ومواعيد وأرقام مرجعية فقط، بدون أسماء أشخاص أو هويات أو جوالات
      const today = (typeof todayISO === 'function' ? todayISO() : new Date().toISOString().slice(0, 10));
      const dm = g => { const [y, m, d] = String(g).split('-'); return d + '/' + m + '/' + y; };
      const rel = g => { const n = root.daysUntil(g); return n === 0 ? ' (اليوم)' : n === 1 ? ' (غدًا)' : ''; };
      const L = [];
      const hs = root.recs('hearings').filter(r => { const n = root.daysUntil(root.dateG(r.date)); return n != null && n >= 0 && n <= 7; })
        .sort((a, b) => String(root.dateG(a.date) + (a.time || '')).localeCompare(root.dateG(b.date) + (b.time || '')));
      const ts = root.recs('taradi').filter(r => { const n = root.daysUntil(root.dateG(r.date)); return n != null && n >= 0 && n <= 7; });
      let late = [], soon = [];
      for (const v of root.recs('violations')){
        if (['مسدد','مسددة','ملغاة','ملغى'].includes(v.status || '')) continue;
        const ds = ['objDeadline','payDeadline','deadline'].map(k => root.dateG(v[k])).filter(Boolean).sort();
        if (!ds.length) continue; const n = root.daysUntil(ds[0]);
        if (n < 0) late.push([ds[0], v]); else if (n <= 7) soon.push([ds[0], v]);
      }
      const noRes = root.recs('hearings').filter(r => { const n = root.daysUntil(root.dateG(r.date)); return n != null && n < 0 && n >= -30 && !String(r.result || '').trim(); });
      const inst = root.recs('contracts').filter(c => (c.fileKind === 'تركيب' || c.ctype === 'تركيب') && !c.renewedTo && (() => { const n = root.daysUntil(root.dateG(c.end)); return n != null && n >= 0 && n <= 30; })());
      L.push('📋 ملخص الشؤون القانونية — ' + dm(today));
      L.push('جلسات الأسبوع ' + hs.length + ' · تراضي ' + ts.length + ' · مهل متأخرة ' + late.length + ' · مهل قريبة ' + soon.length + ' · جلسات بلا نتيجة ' + noRes.length + ' · عقود تركيب تنتهي ' + inst.length);
      if (hs.length){ L.push('', '⚖️ الجلسات:'); for (const r of hs){ const c = root.rec('cases', r.caseId); L.push('• ' + dm(root.dateG(r.date)) + rel(root.dateG(r.date)) + (r.time ? ' ' + r.time : '') + (c && c.caseNo ? ' — قضية ' + c.caseNo : '') + ' — ' + ((c && c.court) || r.place || '')); } }
      if (ts.length){ L.push('', '🤝 جلسات تراضي:'); for (const r of ts) L.push('• ' + dm(root.dateG(r.date)) + rel(root.dateG(r.date)) + (r.time ? ' ' + r.time : '') + (r.reqNo ? ' — طلب ' + r.reqNo : '')); }
      const grp = arr => { const m = new Map(); for (const [g, v] of arr){ const k = g + '|' + (v.authority || ''); const e = m.get(k) || {g, a: v.authority || '', nums: []}; e.nums.push(v.number || '—'); m.set(k, e); } return [...m.values()]; };
      if (late.length){ L.push('', '⚠️ مهل مخالفات متأخرة:'); for (const e of grp(late)) L.push('• ' + dm(e.g) + ' — ' + e.nums.length + ' مخالفة' + (e.a ? ' (' + e.a + ')' : '')); }
      if (soon.length){ L.push('', '⏳ مهل مخالفات قريبة:'); for (const e of grp(soon)) L.push('• ' + dm(e.g) + rel(e.g) + ' — ' + e.nums.length + ' مخالفة' + (e.a ? ' (' + e.a + ')' : '')); }
      if (noRes.length) L.push('', '📝 جلسات مضت بلا نتيجة: ' + noRes.length + ' — سجّل نتائجها');
      if (inst.length) L.push('', '🔁 عقود تركيب تنتهي خلال 30 يومًا: ' + inst.length);
      if (!hs.length && !ts.length && !late.length && !soon.length && !noRes.length && !inst.length) L.push('', 'لا جلسات أو مهل خلال الأسبوع القادم.');
      L.push('', 'التفاصيل: https://ahmadayash0077.github.io/tamkeen-legal/');
      const text = L.join('\n');
      const ta = h('textarea', {dir:'auto', rows:10, style:'width:100%', 'aria-label':'نص الملخص'}); ta.value = text;
      const send = h('button', {type:'button', class:'btn primary', onclick: () => window.open('https://wa.me/?text=' + encodeURIComponent(ta.value), '_blank', 'noopener')}, '🟢 افتح واتساب وأرسل');
      const copy = h('button', {type:'button', class:'btn', onclick: async () => { try { await navigator.clipboard.writeText(ta.value); root.toast && root.toast('نُسخ الملخص'); } catch(e){ ta.select(); } }}, 'نسخ');
      return h('div', {style:'display:grid;gap:8px'}, box('ok', 'جُهّز ملخص اليوم. اضغط «افتح واتساب» واختر نفسك أو الزميل، ثم إرسال. (أعداد ومواعيد وأرقام مرجعية فقط — بدون أسماء أو هويات)'), ta, h('div', {class:'row', style:'gap:8px'}, send, copy));
    },
    'طلبات التنفيذ المتوقفة': () => { let l = []; try { l = root.uxCollectList().filter(x => !x.done && ['stale','paygap','grace'].includes(x.n.k)); } catch(e){}
      return h('div', null, box(l.length ? 'warn' : 'ok', l.length ? N(l.length) + ' طلب يحتاج متابعة:' : 'لا طلبات متوقفة.'), list(l.slice(0, 40).map(x => [link('executions', x.r), ' — ' + x.n.t]))); }
  };

  /* ===== موظف البيانات ===== */
  const DATA = {
    'فحص البيانات الناقصة في كل الأقسام': () => { let q = []; try { q = root.uxQualityChecks().filter(c => c.rows.length); } catch(e){}
      const total = q.reduce((s, c) => s + c.rows.length, 0);
      return h('div', null, box(total ? 'warn' : 'ok', total ? N(total) + ' سجل يحتاج إكمال:' : 'البيانات مكتملة.'), list(q.map(c => [h('b', null, c.t + ' (' + c.rows.length + '): '), ...c.rows.slice(0, 5).flatMap((r, i) => [i ? '، ' : '', link(c.mod, r)]), c.rows.length > 5 ? ' …' : '']))); },
    'تجهيز تجديدات عقود التركيب': async () => { if ((typeof S !== 'undefined' && S.readOnly)) return box('warn', 'صلاحيتك مشاهدة فقط.'); let n = 0; try { n = await root.uxRenewAuto(true); } catch(e){ return box('bad', 'تعذر: ' + e.message); }
      return box(n ? 'ok' : 'info', n ? 'جُهّز ' + N(n) + ' عقد تجديد كمسودة للمراجعة في «عقود التركيب».' : 'لا عقود تركيب تنتهي خلال 30 يومًا وتحتاج تجديدًا.'); },
    'مطابقة ملفات الجملة مع طلبات التنفيذ': async () => { if ((typeof S !== 'undefined' && S.readOnly)) return box('warn', 'صلاحيتك مشاهدة فقط.'); let n = 0, likely = 0;
      try { const s = root.uxMatchScan(); likely = (s.likely || []).length; n = await root.uxMatchAuto(true); } catch(e){ return box('bad', 'تعذر: ' + e.message); }
      return box('ok', 'نُقل ' + N(n || 0) + ' تطابق مؤكد' + (likely ? '، و' + N(likely) + ' تطابق محتمل ينتظر مراجعتك في «موظف المطابقة».' : '.')); },
    'فحص العملاء في قائمة الإفلاس': () => { let m = []; try { m = root.uxBkrMatches(); } catch(e){}
      return h('div', null, box(m.length ? 'warn' : 'ok', m.length ? N(m.length) + ' عميل يطابق قائمة الإفلاس:' : 'لا تطابق مع قائمة الإفلاس.'), list(m.slice(0, 30).map(x => String(x.name || (x.c && x.c.name) || (x.b && x.b.name) || '') + (x.how ? ' (' + x.how + ')' : '')))); }
  };

  /* ===== المستشار والصائغ ===== */
  const EXTRA = {
    'ملخص القضية': 'لخّص القضية في نقاط: الأطراف، موضوع النزاع، المطالبات، آخر الإجراءات والجلسات، والمطلوب من الشركة الآن.',
    'إنذار رسمي': 'اكتب إنذارًا رسميًا باسم الشركة للطرف الآخر يتضمن الوقائع والمطالبة ومهلة محددة للوفاء والإجراء النظامي عند عدم الاستجابة.',
    'تحليل عقد ومخاطره': 'حلّل بيانات العقد: الالتزامات، مدة العقد والتجديد، الضمانات والسندات، البيانات الناقصة، والمخاطر على الشركة مع توصيات.'
  };
  function draftTypes(){ const t = Object.assign({}, (typeof ADV_TYPES !== 'undefined' ? ADV_TYPES : {}), EXTRA); delete t['سؤال حر']; t['سؤال حر'] = ''; return t; }
  const MOD_OPTS = [['cases','قضية'], ['taradi','جلسة تراضي'], ['executions','طلب تنفيذ'], ['violations','مخالفة'], ['contracts','عقد']];
  function buildPrompt(type, mod, r, notes){
    const T = draftTypes();
    let rec = ''; try { rec = root.advRecordText(mod, r, true); } catch(e){}
    let mem = ''; try { mem = root.TamkeenMemory?.context ? (root.TamkeenMemory.context(mod, r) || '') : ''; } catch(e){}
    return (T[type] || 'أجب عن الطلب التالي') + '\n\nنوع السجل: ' + MODS[mod].one + '\n' + rec + (notes ? '\n\nتفاصيل من المستخدم:\n' + notes : '') + (typeof ADV_RULES !== 'undefined' ? ADV_RULES : '') + (mem ? '\n' + mem : '');
  }
  function drafterForm(out){
    const T = draftTypes();
    const type = h('select', {'aria-label':'نوع المهمة'}, Object.keys(T).map(k => h('option', {value:k}, k)));
    const mod = h('select', {'aria-label':'نوع السجل'}, MOD_OPTS.map(([k, l]) => h('option', {value:k}, l)));
    const q = h('input', {type:'search', placeholder:'ابحث بالاسم أو الرقم', 'aria-label':'بحث عن السجل'});
    const recSel = h('select', {'aria-label':'السجل'});
    const notes = h('textarea', {dir:'auto', rows:3, placeholder:'تفاصيل إضافية (اختياري): ما يدعيه الخصم، أو الصق نص صحيفة الدعوى أو مذكرة الخصم…', style:'width:100%'});
    const fill = () => {
      const m = mod.value, s = (q.value || '').trim();
      const rows = root.recs(m).filter(r => !s || root.titleOf(m, r).includes(s) || String(r.caseNo || r.reqNo || r.number || r.cr_no || '').includes(s)).slice(0, 200);
      recSel.replaceChildren(...rows.map(r => h('option', {value:r.id}, root.titleOf(m, r))));
      if (!rows.length) recSel.append(h('option', {value:''}, 'لا سجلات'));
    };
    mod.onchange = () => { q.value = ''; fill(); }; q.oninput = fill; fill();
    const go = h('button', {type:'button', class:'btn primary', onclick: async () => {
      const r = root.rec(mod.value, recSel.value); if (!r){ out.replaceChildren(box('warn', 'اختر السجل أولًا.')); return; }
      const prompt = buildPrompt(type.value, mod.value, r, notes.value.trim());
      log('المستشار والصائغ', type.value + ' — ' + root.titleOf(mod.value, r));
      const ta = h('textarea', {dir:'auto', rows:8, style:'width:100%', value: prompt, 'aria-label':'نص الطلب'}); ta.value = prompt;
      const copy = async () => { try { await navigator.clipboard.writeText(ta.value); return true; } catch(e){ ta.select(); try { return document.execCommand('copy'); } catch(_){ return false; } } };
      const toClaude = h('button', {type:'button', class:'btn primary', onclick: async () => {
        const t = ta.value; await copy(); window.open(t.length <= 6000 ? 'https://claude.ai/new?q=' + encodeURIComponent(t) : 'https://claude.ai/new', '_blank', 'noopener');
        root.audit && root.audit('مهمة للمستشار الإلكتروني', mod.value, r.id, type.value);
        res.replaceChildren(box('info', t.length <= 6000 ? 'فُتحت محادثة في Claude والطلب مكتوب فيها — اضغط إرسال، ثم انسخ النتيجة.' : 'الطلب طويل: نُسخ للحافظة. في المحادثة الجديدة الصق (Ctrl+V) ثم أرسل.'));
      }}, '✍️ اكتبها في Claude');
      const res = h('div');
      const kids = [box('ok', 'جهّز المستشار طلب «' + type.value + '» من بيانات «' + root.titleOf(mod.value, r) + '». أُخفيت أرقام الهوية والجوال. راجع النص ثم أرسله:'), ta, h('div', {class:'row', style:'gap:8px;flex-wrap:wrap'}, toClaude, h('button', {type:'button', class:'btn', onclick: async () => { if (await copy()) root.toast && root.toast('نُسخ النص'); }}, 'نسخ النص'))];
      // إن كانت قراءة Claude مربوطة في البرنامج: يكتب هنا مباشرة
      try { if (typeof root.aiEnabled === 'function' && root.aiEnabled() && typeof sampleFn === 'function'){
        kids.push(h('button', {type:'button', class:'btn', onclick: async e => { e.target.disabled = true; res.replaceChildren(box('info', 'يكتب المستشار…')); try { const o = await sampleFn(ta.value); res.replaceChildren(h('div', {class:'panel', style:'white-space:pre-wrap;line-height:1.9'}, o.text || '')); } catch(err){ res.replaceChildren(box('bad', 'تعذر: ' + (err.message || err))); } e.target.disabled = false; }}, 'اكتبها هنا داخل البرنامج'));
      } } catch(e){}
      kids.push(res); out.replaceChildren(...kids);
    }}, 'جهّز المهمة');
    return h('div', {style:'display:grid;gap:10px'},
      h('div', {class:'row', style:'gap:8px;flex-wrap:wrap'}, field('المهمة', type), field('نوع السجل', mod)),
      h('div', {class:'row', style:'gap:8px;flex-wrap:wrap'}, field('بحث', q), field('السجل', recSel)),
      field('تفاصيل إضافية', notes), h('div', {class:'row'}, go));
  }
  const field = (l, c) => h('label', {class:'f', style:'flex:1;min-width:200px'}, h('span', null, l), c);

  /* ===== الواجهة ===== */
  const EMPS = [
    {id:'reports', icon:'📊', name:'موظف التقارير والمتابعة', desc:'يجهّز التقارير ويطلّع لك المواعيد والطلبات المتوقفة', tasks: REPORTS},
    {id:'data', icon:'🗂️', name:'موظف البيانات', desc:'يفحص النواقص ويجهّز التجديدات ويطابق ويفحص الإفلاس', tasks: DATA},
    {id:'drafter', icon:'✍️', name:'المستشار والصائغ', desc:'يكتب المذكرات واللوائح والردود ويحلّل القضايا والعقود', tasks: null},
    // الموظفون الذين يعملون تلقائيًا (لكل واحد صفحته في البرنامج)
    {id:'morning', icon:'☀️', name:'مساعد الصباح', desc:'ملخص يومك: الجلسات والمهل والمتأخرات', href:'#team~morning', stat: () => { const m = root.uxMorning(); return m.hs.length + ' جلسة اليوم · ' + m.soon.length + ' مهلة قريبة'; }},
    {id:'collect', icon:'💰', name:'مساعد التحصيل', desc:'يرتّب طلبات التنفيذ حسب الأولوية ويقترح الخطوة التالية', href:'#team~collect', stat: () => root.uxCollectList().filter(x => !x.done).length + ' طلب بانتظار المتابعة'},
    {id:'quality', icon:'🛡️', name:'مساعد جودة البيانات', desc:'يكتشف السجلات الناقصة ويوصلك لها', href:'#team~quality', stat: () => { const n = root.uxQualityChecks().reduce((a, c) => a + c.rows.length, 0); return n ? n + ' سجل يحتاج إكمال' : 'البيانات مكتملة'; }},
    {id:'renew', icon:'🔁', name:'موظف التجديد', desc:'يجهّز عقود التركيب الجديدة قبل انتهاء القديمة', href:'#team~renew', stat: () => { const d = root.uxRenewDue(); return d.soon.length + ' تنتهي قريبًا · ' + d.drafts.length + ' مسودة'; }},
    {id:'match', icon:'🔗', name:'موظف المطابقة', desc:'يقارن ملفات الجملة بطلبات التنفيذ وينقل المتطابق', href:'#team~match', stat: () => { const s = root.uxMatchScan(); return (s.sure || []).length + ' مؤكد · ' + (s.likely || []).length + ' محتمل'; }},
    {id:'ocr', icon:'📄', name:'قارئ الملفات', desc:'يقرأ ملفات العملاء الممسوحة ويقترح البيانات', href:'#team~ocr', stat: () => root.uxOcrPending().length + ' اقتراح بانتظار المراجعة'},
    {id:'bkr', icon:'⚖️', name:'موظف الإفلاس', desc:'يتأكد إن عملاءك مو عليهم إجراءات إفلاس', href:'#team~bkr', stat: () => { const n = root.uxBkrMatches().length; return n ? n + ' تطابق يحتاج مراجعة' : 'لا تطابق'; }},
    {id:'library', icon:'📚', name:'أمين المكتبة', desc:'يتابع الأنظمة واللوائح السارية', href:'#team~library'}
  ];
  function desk(){
    const out = h('div', {'aria-live':'polite', style:'margin-top:12px'});
    let cur = EMPS[0];
    const taskSel = h('select', {'aria-label':'المهمة'});
    const body = h('div');
    const tabs = h('div', {class:'ai-emps'});
    const histBox = h('div');
    const paintHist = () => { const a = readLog().slice(0, 6); histBox.replaceChildren(a.length ? h('details', {style:'margin-top:12px'}, h('summary', {class:'small muted', style:'cursor:pointer'}, 'آخر المهام المنفّذة على هذا الجهاز'), list(a.map(x => x.emp + ': ' + x.task + ' — ' + new Date(x.at).toLocaleString('ar-SA-u-nu-latn-ca-gregory')))) : ''); };
    const paint = () => {
      tabs.replaceChildren(...EMPS.map(e => {
        let st = e.href ? 'يعمل تلقائيًا' : 'أعطه مهمة';
        if (e.stat){ try { st = e.stat(); } catch(_){} }
        return h('button', {type:'button', class:'ai-emp' + (e === cur ? ' on' : ''), 'aria-pressed':String(e === cur), title: e.desc,
          onclick: () => { if (e.href){ location.hash = e.href; return; } cur = e; out.replaceChildren(); paint(); }},
          h('span', {class:'ai-emp-ic', 'aria-hidden':'true'}, e.icon), h('b', null, e.name), h('small', null, e.desc), h('em', null, h('i'), st));
      }));
      if (cur.tasks){
        taskSel.replaceChildren(...Object.keys(cur.tasks).map(k => h('option', {value:k}, k)));
        const run = h('button', {type:'button', class:'btn primary', onclick: async () => {
          run.disabled = true; out.replaceChildren(box('info', cur.name + ' يشتغل على: ' + taskSel.value + '…'));
          try { const r = await cur.tasks[taskSel.value](); out.replaceChildren(r); log(cur.name, taskSel.value); paintHist(); }
          catch(e){ out.replaceChildren(box('bad', 'تعذر تنفيذ المهمة: ' + (e.message || e))); }
          finally { run.disabled = false; }
        }}, '▶ نفّذ');
        body.replaceChildren(h('p', {class:'small muted', style:'margin:0 0 8px'}, cur.desc), h('div', {class:'row', style:'gap:8px;flex-wrap:wrap;align-items:end'}, field('المهمة', taskSel), run));
      } else body.replaceChildren(h('p', {class:'small muted', style:'margin:0 0 8px'}, cur.desc + '. يجهّز الطلب كاملًا من بيانات السجل ويفتحه في حسابك على Claude (مجانًا).'), drafterForm(out));
    };
    paint(); paintHist();
    return h('section', {class:'panel ai-desk'},
      h('h2', {style:'margin:0 0 4px;font-size:1.25rem'}, '🤖 الموظفون الإلكترونيون'),
      h('p', {class:'small muted', style:'margin:0'}, 'كل الموظفين في مكان واحد. الثلاثة الأولى تعطيهم مهمة فيقومون بها، والباقون يعملون تلقائيًا — اضغط أي موظف لتفتح شغله.'),
      tabs, body, out, histBox);
  }

  const css = document.createElement('style');
  css.textContent = '.ai-emps{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:10px;margin:12px 0 14px}'
    + '.ai-emp{display:grid;grid-template-columns:auto 1fr;grid-template-rows:auto auto auto;column-gap:10px;row-gap:2px;align-items:start;text-align:start;padding:12px 14px;border-radius:16px;border:1px solid var(--line);background:var(--surface);color:var(--ink);font:inherit;cursor:pointer;transition:transform .2s,box-shadow .2s,border-color .2s}'
    + '.ai-emp:hover{transform:translateY(-2px);box-shadow:0 10px 24px -16px rgba(0,0,0,.45)}.ai-emp.on{border-color:var(--accent);box-shadow:0 0 0 2px color-mix(in srgb,var(--accent) 35%,transparent)}'
    + '.ai-emp-ic{grid-row:1/4;font-size:1.6rem;line-height:1}.ai-emp b{font-size:.98rem}.ai-emp small{color:var(--ink-2);font-size:.8rem;line-height:1.5}'
    + '.ai-emp em{font-style:normal;font-size:.78rem;color:var(--ok,#1f7a4a);display:flex;align-items:center;gap:6px}.ai-emp em i{width:7px;height:7px;border-radius:50%;background:currentColor;display:inline-block}';
  document.head.appendChild(css);

  function hook(){
    if (typeof root.uxTeamView === 'function' && !root.uxTeamView.__desk){
      const orig = root.uxTeamView;
      root.uxTeamView = function(tab){
        const v = orig.apply(this, arguments);
        try { if ((!tab || tab === 'coordination') && v && v.el){ const d = desk(); const head = v.el.querySelector('.page-head, h1'); const at = head && head.closest('.page-head') || head; at && at.parentNode ? at.parentNode.insertBefore(d, at.nextSibling) : v.el.prepend(d); } }
        catch(e){ console.warn('ai desk', e); }
        return v;
      };
      root.uxTeamView.__desk = true;
    }
  }
  if (document.readyState !== 'loading') hook(); else document.addEventListener('DOMContentLoaded', hook);
})(window);
