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
  function printable(title, bodyHtml){
    const w = window.open('', '_blank'); if (!w){ root.toast && root.toast('اسمح بالنوافذ المنبثقة لعرض التقرير'); return; }
    w.document.write('<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>' + title + '</title><style>body{font-family:"IBM Plex Sans Arabic",Tahoma,sans-serif;margin:32px;color:#14202e;line-height:1.8}h1{font-size:22px;margin:0 0 4px}h2{font-size:16px;margin:22px 0 6px;border-bottom:1px solid #e3e7ec;padding-bottom:4px}table{width:100%;border-collapse:collapse;font-size:13px}td,th{border:1px solid #e3e7ec;padding:6px 8px;text-align:right}th{background:#f5f6f8}.k{display:inline-block;margin:0 0 0 18px}.k b{font-size:20px;display:block}button{margin:0 0 18px;padding:8px 18px;font:inherit}@media print{button{display:none}}</style></head><body><button onclick="print()">طباعة / حفظ PDF</button>' + bodyHtml + '</body></html>');
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
      const html = '<h1>تقرير القضايا المفتوحة</h1><div>' + esc(fd({orig:'g', g: (typeof todayISO === 'function' ? todayISO() : new Date().toISOString().slice(0, 10)), h:'', verified:true})) + '</div>'
        + '<p><span class="k">عدد القضايا<b>' + N(rows.length) + '</b></span><span class="k">إجمالي المطالبات<b>' + N(sum) + ' ريال</b></span><span class="k">جلسات خلال 30 يومًا<b>' + N(hs.length) + '</b></span></p>'
        + '<h2>حسب المحكمة</h2><table>' + by('court').map(([k, v]) => '<tr><td>' + esc(k) + '</td><td>' + v + '</td></tr>').join('') + '</table>'
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
    'طلبات التنفيذ المتوقفة': () => { let l = []; try { l = root.uxCollectList().filter(x => !x.done && ['stale','paygap','grace'].includes(x.n.k)); } catch(e){}
      return h('div', null, box(l.length ? 'warn' : 'ok', l.length ? N(l.length) + ' طلب يحتاج متابعة:' : 'لا طلبات متوقفة.'), list(l.slice(0, 40).map(x => [link('executions', x.r), ' — ' + x.n.t]))); }
  };

  /* ===== موظف البيانات ===== */
  const DATA = {
    'فحص البيانات الناقصة في كل الأقسام': () => { let q = []; try { q = root.uxQualityChecks().filter(c => c.rows.length); } catch(e){}
      const total = q.reduce((s, c) => s + c.rows.length, 0);
      return h('div', null, box(total ? 'warn' : 'ok', total ? N(total) + ' سجل يحتاج إكمال:' : 'البيانات مكتملة.'), list(q.map(c => [h('b', null, c.t + ' (' + c.rows.length + '): '), ...c.rows.slice(0, 5).flatMap((r, i) => [i ? '، ' : '', link(c.mod, r)]), c.rows.length > 5 ? ' …' : '']))); },
    'تجهيز تجديدات عقود التركيب': async () => { if (root.S?.readOnly) return box('warn', 'صلاحيتك مشاهدة فقط.'); let n = 0; try { n = await root.uxRenewAuto(true); } catch(e){ return box('bad', 'تعذر: ' + e.message); }
      return box(n ? 'ok' : 'info', n ? 'جُهّز ' + N(n) + ' عقد تجديد كمسودة للمراجعة في «عقود التركيب».' : 'لا عقود تركيب تنتهي خلال 30 يومًا وتحتاج تجديدًا.'); },
    'مطابقة ملفات الجملة مع طلبات التنفيذ': async () => { if (root.S?.readOnly) return box('warn', 'صلاحيتك مشاهدة فقط.'); let n = 0, likely = 0;
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
    {id:'drafter', icon:'✍️', name:'المستشار والصائغ', desc:'يكتب المذكرات واللوائح والردود ويحلّل القضايا والعقود', tasks: null}
  ];
  function desk(){
    const out = h('div', {'aria-live':'polite', style:'margin-top:12px'});
    let cur = EMPS[0];
    const taskSel = h('select', {'aria-label':'المهمة'});
    const body = h('div');
    const tabs = h('div', {class:'row', style:'gap:8px;flex-wrap:wrap;margin:6px 0 12px'});
    const histBox = h('div');
    const paintHist = () => { const a = readLog().slice(0, 6); histBox.replaceChildren(a.length ? h('details', {style:'margin-top:12px'}, h('summary', {class:'small muted', style:'cursor:pointer'}, 'آخر المهام المنفّذة على هذا الجهاز'), list(a.map(x => x.emp + ': ' + x.task + ' — ' + new Date(x.at).toLocaleString('ar-SA-u-nu-latn-ca-gregory')))) : ''); };
    const paint = () => {
      tabs.replaceChildren(...EMPS.map(e => h('button', {type:'button', class:'btn sm' + (e === cur ? ' primary' : ''), 'aria-pressed':String(e === cur), onclick: () => { cur = e; out.replaceChildren(); paint(); }}, e.icon + ' ' + e.name)));
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
      h('h2', {style:'margin:0 0 4px;font-size:1.25rem'}, '🤖 مكتب الموظفين الإلكترونيين'),
      h('p', {class:'small muted', style:'margin:0'}, 'اختر الموظف وأعطه المهمة، ويقوم بها مباشرة.'),
      tabs, body, out, histBox);
  }

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
