/* التعبئة التلقائية في نماذج الإدخال — قواعد ثابتة من بيانات البرنامج نفسه، بدون ذكاء اصطناعي.
   1) اقتراحات: الحقول النصية تقترح القيم المستخدمة سابقًا في نفس الشاشة (الأكثر تكرارًا أولًا).
   2) نسخ من سجل سابق: عند إدخال سجل جديد، إذا طابق حقل تعريفي (مثل رقم السجل التجاري أو المنفذ ضده)
      سجلًا موجودًا، يعرض البرنامج تعبئة الحقول الفارغة فقط من آخر سجل مطابق. لا يكتب فوق ما أدخله المستخدم. */
(function(root){
  'use strict';
  // حقول لا تُقترح قيمها (بيانات شخصية أو فريدة لكل سجل)
  const NO_SUGGEST = {
    contracts: ['trade_name','national_address','manager_name','e1_name','e2_name','title'],
  };
  // الحقل التعريفي ← الحقول التي تُنسخ من آخر سجل مطابق
  const COPY_RULES = {
    contracts: [
      {key:'cr_no', label:'رقم السجل التجاري', exact:true,
       fields:['trade_name','cr_city','cr_entity','cr_state','activity','national_address','manager_name','manager_title','manager_mobile','manager_nat','manager_id','inst_region','e1_name','e1_nat','e1_id','e1_title','e1_mobile','e2_name','e2_nat','e2_id','e2_title','e2_mobile'],
       sameKind:['customer_code']},
      {key:'trade_name', label:'الاسم التجاري',
       fields:['cr_no','cr_city','cr_entity','cr_state','activity','national_address','manager_name','manager_title','manager_mobile','manager_nat','manager_id','inst_region','e1_name','e1_nat','e1_id','e1_title','e1_mobile','e2_name','e2_nat','e2_id','e2_title','e2_mobile'],
       sameKind:['customer_code']}
    ],
    executions: [{key:'respondent', label:'المنفذ ضده', fields:['applicant','rep','branch']}],
    violations: [{key:'branch', label:'الفرع أو الموقع', fields:['city','authority','owner']}],
    cases: [
      {key:'defendant', label:'المدعى عليه', fields:['court','circuit','side','lawyerId','owner']},
      {key:'plaintiff', label:'المدعي', fields:['court','circuit','side','lawyerId','owner']}
    ],
    taradi: [{key:'defendant', label:'الطرف الآخر', fields:['place','attendee','side','owner']}],
    hearings: [{key:'caseId', label:'القضية', exact:true, fields:['place','attendee','link']}],
    poa: [{key:'holder', label:'الوكيل أو صاحب الترخيص', fields:['issuer','owner']}],
    attest: [{key:'title', label:'المستند', fields:['docType','requester','chamber']}]
  };
  const digits = s => String(s ?? '').replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
  const norm = s => digits(s).replace(/[ً-ْـ]/g,'').replace(/[أإآ]/g,'ا').replace(/ة/g,'ه').replace(/ى/g,'ي').replace(/\s+/g,' ').trim().toLowerCase();
  const filled = v => !(v == null || v === '' || (typeof v === 'object' && !v.g && !v.h && !Array.isArray(v)));
  const kindOf = r => r && (r.fileKind ? (r.fileKind === 'تركيب' ? 'تركيب' : 'جملة') : (r.ctype === 'تركيب' ? 'تركيب' : 'جملة'));

  // أكثر القيم تكرارًا لحقل في مجموعة سجلات
  function suggestions(rows, key, limit = 40){
    const m = new Map();
    for (const r of rows){
      const v = r && r[key];
      if (typeof v !== 'string') continue;
      const t = v.trim(); if (!t || t.length > 120) continue;
      const n = norm(t); const e = m.get(n);
      if (e) e.c++; else m.set(n, {v:t, c:1});
    }
    return [...m.values()].sort((a,b) => b.c - a.c || a.v.localeCompare(b.v,'ar')).slice(0, limit).map(x => x.v);
  }
  // آخر سجل مطابق للقيمة التعريفية
  function findSource(rows, rule, value, selfId){
    const want = rule.exact ? digits(value).replace(/\s/g,'') : norm(value);
    if (!want || (!rule.exact && want.length < 3)) return null;
    let best = null;
    for (const r of rows){
      if (!r || r.deleted || r.id === selfId) continue;
      const got = rule.exact ? digits(r[rule.key]).replace(/\s/g,'') : norm(r[rule.key]);
      if (got !== want) continue;
      if (!best || String(r.updatedAt || r.createdAt || '') > String(best.updatedAt || best.createdAt || '')) best = r;
    }
    return best;
  }
  // الحقول الفارغة في النموذج التي لها قيمة في السجل السابق
  function plan(mod, rule, source, data){
    if (!source) return [];
    const keys = [...rule.fields];
    if (rule.sameKind && mod === 'contracts' && kindOf(source) === kindOf(data)) keys.push(...rule.sameKind);
    return keys.filter(k => k !== rule.key && !filled(data[k]) && filled(source[k])).map(k => [k, source[k]]);
  }
  const fields = n => n === 1 ? 'حقل واحد' : n === 2 ? 'حقلين' : n <= 10 ? n + ' حقول' : n + ' حقلًا';
  const core = {fields, NO_SUGGEST, COPY_RULES, norm, suggestions, findSource, plan};
  if (typeof module === 'object' && module.exports) { module.exports = core; return; }
  root.TamkeenAutofill = core;

  /* ===== ربط المنطق بنماذج البرنامج ===== */
  // MODS معرّف بـ const في الصفحة فلا يظهر على window؛ نصل إليه بالاسم مباشرة
  const mods = () => (typeof MODS !== 'undefined' ? MODS : null);
  if (typeof root.fieldInput !== 'function' || !mods()) return;
  // بعض الشاشات تمرّر نسخًا معدّلة من تعريف الحقل، فنستنتج الشاشة من الرابط ثم من مفتاح الحقل
  const modOf = f => {
    const M = mods();
    const direct = Object.keys(M).find(k => (M[k].fields || []).includes(f));
    if (direct) return direct;
    const a = (location.hash.slice(1) || '').split('-'); const m = a[0] === 'new' ? a[1] : a[0].split('~')[0];
    return M[m] && (M[m].fields || []).some(x => x.k === f.k) ? m : null;
  };
  const orig = root.fieldInput;
  let seq = 0;
  root.fieldInput = function(f, val, onCh, ro, data){
    const wrap = orig.apply(this, arguments);
    try {
      if (ro || !wrap || !f) return wrap;
      const mod = modOf(f); if (!mod) return wrap;
      const rows = root.recs(mod);
      const inp = wrap.querySelector('#f_' + f.k);
      // 1) اقتراحات من القيم السابقة
      const plain = !f.t || f.t === 'text';
      if (inp && plain && !f.chk && !(NO_SUGGEST[mod] || []).includes(f.k)){
        const prev = suggestions(rows, f.k);
        const list = [...new Set([...(f.list || []), ...prev])];
        if (list.length){
          const id = 'afl_' + mod + '_' + f.k + '_' + (++seq);
          wrap.querySelector('datalist')?.remove();
          wrap.append(root.h('datalist', {id}, list.map(o => root.h('option', {value:o}))));
          inp.setAttribute('list', id); inp.setAttribute('autocomplete', 'off');
        }
      }
      // 2) نسخ من سجل سابق — للسجلات الجديدة فقط
      const rule = (COPY_RULES[mod] || []).find(x => x.key === f.k);
      if (rule && data && !data.id && inp){
        const box = root.h('div', {class:'af-offer', role:'status', 'aria-live':'polite'});
        wrap.append(box);
        const check = () => {
          const src = findSource(rows, rule, inp.value);
          const todo = plan(mod, rule, src, data);
          if (!src || !todo.length){ box.replaceChildren(); return; }
          const name = root.titleOf ? root.titleOf(mod, src) : '';
          box.replaceChildren(root.h('div', {class:'banner info af-banner'},
            root.h('span', null, 'وجدنا سجلًا سابقًا بنفس «' + rule.label + '»' + (name ? ': ' + name : '') + '. '),
            root.h('button', {type:'button', class:'btn sm primary', onclick:() => {
              for (const [k, v] of todo){
                const el = document.getElementById('f_' + k);
                if (el && el.tagName === 'SELECT' && typeof v === 'string'){ data[k] = v; el.value = v; el.dispatchEvent(new Event('change')); }
                else if (v && typeof v === 'object') { data[k] = JSON.parse(JSON.stringify(v)); }
                else root.setField(data, k, v, onCh);
              }
              box.replaceChildren(root.h('div', {class:'banner ok af-banner'}, 'عُبّئ ' + fields(todo.length) + ' من السجل السابق. راجعها قبل الحفظ.'));
              if (todo.some(([, v]) => v && typeof v === 'object') && root.toast) root.toast('بعض التواريخ نُسخت وتظهر بعد الحفظ');
            }}, 'تعبئة ' + (todo.length === 1 ? 'الحقل الفارغ' : 'الحقول الفارغة') + ' (' + fields(todo.length) + ')')));
        };
        inp.addEventListener(inp.tagName === 'SELECT' ? 'change' : 'input', () => { clearTimeout(box._t); box._t = setTimeout(check, 300); });
        if (inp.value) setTimeout(check, 0);
      }
    } catch (e) { console.warn('autofill', e); }
    return wrap;
  };
})(typeof window !== 'undefined' ? window : globalThis);
