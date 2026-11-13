/* قارئ مستندات داخل نموذج عقود الجملة والتركيب.
   ترفع مستندات العميل (السجل التجاري، الهوية، العنوان الوطني، الرخصة، صفحات العقد — صور أو PDF)
   فيقرأها البرنامج محليًا (OCR مجاني داخل المتصفح، أو قراءة Claude إن كانت مربوطة) ويعبّي الحقول الفارغة.
   القيم المختلفة عن المُدخل تُعرض كاقتراحات لا تُطبَّق إلا بضغطة. وتُرفق الملفات بالعقد بعد الحفظ. */
(function(root){
  'use strict';
  const MAX_FILES = 8, MAX_PAGES = 14;
  let formData = null;     // بيانات نموذج «عقد جديد» المفتوح
  let pendingFiles = null; // ملفات تُرفق بعد حفظ العقد الجديد

  const NF = n => n === 1 ? 'حقل واحد' : n === 2 ? 'حقلين' : n <= 10 ? n + ' حقول' : n + ' حقلًا';
  const LBL = k => { try { const f = MODS.contracts.fields.find(x => x.k === k); return f ? f.l : k; } catch(e){ return k; } };
  const box = (cls, ...kids) => root.h('div', {class:'banner ' + cls}, ...kids);
  const showV = v => v && typeof v === 'object' ? (root.fmtDate ? root.fmtDate(v, false) : (v.g || '')) : String(v);

  // قراءة الملفات صفحةً صفحة
  async function readFiles(files, progress){
    const info = {}, types = [], texts = []; let n = 0;
    for (const f of files){
      const pages = await root.TamkeenOcr.readFilePages(f, progress, MAX_PAGES);
      for (const pg of pages){
        n++; const t = pg.textWithDigits || pg.text || ''; const x = root.uxReadPage(t);
        info[n] = x; texts.push(t); types.push({file: f.name, f, type: x.type, method: pg.method});
        if (n >= MAX_PAGES) break;
      }
      if (n >= MAX_PAGES) break;
    }
    if (!n) throw new Error('لم أجد صفحات قابلة للقراءة. ارفع صورًا (JPG/PNG) أو ملفات PDF.');
    return {info, types, texts, pages: n};
  }
  const TYPE_AR = {cr:'سجل تجاري', national_id:'هوية', address:'عنوان وطني', license:'رخصة', vat:'شهادة ضريبية', bond:'سند', contract_auth:'نموذج التفويض', contract_cover:'غلاف العقد', internal_approval:'اعتماد داخلي', shop_photo:'صورة محل', other:'غير مصنّف'};

  // تحويل نتائج القراءة إلى خانات العقد
  function contractRows(info, d){
    const cd = root.mergeClientData(info, null, null);
    let rows = root.cdContractDiffs(cd, d);
    if ((d.fileKind || '') === 'تركيب') rows = rows.map(r => r.fk === 'e1_id' ? {...r, fk:'manager_id'} : r.fk === 'e1_nat' ? {...r, fk:'manager_nat'} : r);
    // الحقول التي لها أكثر من قيمة مختلفة في المستندات لا تُعبّأ تلقائيًا
    const conflicted = new Set(Object.entries(cd).filter(([, it]) => it && it.alt && it.alt.length).map(([k]) => k));
    return rows.map(r => ({...r, conflict: conflicted.has(r.ck), alts: (cd[r.ck] && cd[r.ck].alt || []).map(a => a.v)}));
  }

  /* ===== السند: قراءة رقم السند ومبلغه وتاريخه ومحرره ونوعه ===== */
  const dig = s => (root.normDigits ? root.normDigits(String(s || '')) : String(s || '').replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
  function toDate(raw){
    const t = dig(raw); let m = /(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})/.exec(t), y, mo, d;
    if (m){ y = +m[1]; mo = +m[2]; d = +m[3]; } else if ((m = /(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/.exec(t))){ d = +m[1]; mo = +m[2]; y = +m[3]; } else return null;
    const iso = y + '-' + String(mo).padStart(2, '0') + '-' + String(d).padStart(2, '0');
    if (y > 1350 && y < 1600){ const g = root.h2g ? root.h2g(iso) : null; return g ? {orig:'h', g, h: iso, verified:false} : null; }
    if (y > 1950 && y < 2100) return {orig:'g', g: iso, h: root.g2h ? root.g2h(iso) : '', verified:true};
    return null;
  }
  function bondFields(text){
    const t = dig(text), f = {};
    if (!/(?:سند\s*لأمر|سند\s*لامر|السند|نافذ|(?:^|[\s،,و])سند)/.test(t)) return f;
    const lab = (labels, re) => { for (const l of labels){ const m = new RegExp('(?:' + l + ')\\s*[:：\\-]?\\s*' + re).exec(t); if (m) return m[1].trim(); } return ''; };
    const no = lab(['رقم السند','رقم سند الأمر','رقم سند لأمر'], '([\\d\\-]{4,30})'); if (no) f.bond_no = no;
    const amt = lab(['قيمة السند','مبلغ السند','المبلغ المستحق','المبلغ','قيمة'], '([\\d,٬]+(?:\\.\\d+)?)');
    if (amt){ const n = Number(amt.replace(/[,٬]/g, '')); if (n > 0) f.bond_amount = n; }
    // صيغة رسائل الواتس: «سند الكتروني 30 الف» / «سند ورقي بمبلغ 50,000»
    if (!f.bond_amount){ const m = /سند[^\n\d]{0,30}?(\d[\d,٬.]*)\s*(ألف|الف|آلاف|الاف|k)?/i.exec(t); if (m){ let n = Number(m[1].replace(/[,٬]/g, '')); if (m[2]) n *= 1000; if (n >= 1000 && n <= 50000000) f.bond_amount = n; } }
    const dt = lab(['تاريخ الإنشاء','تاريخ الانشاء','تاريخ إنشاء السند','تاريخ الإصدار','تاريخ الاصدار','تاريخ السند','تاريخ التحرير'], '([\\d]{1,4}[\\/\\-.][\\d]{1,2}[\\/\\-.][\\d]{1,4})');
    const dd = dt ? toDate(dt) : null; if (dd) f.bond_date = dd;
    const iss = lab(['اسم المدين','المدين','محرر السند','اسم محرر السند'], '([^\\n]{3,70})');
    if (iss && !/\d{5,}/.test(iss)) f.bond_issuer = iss.replace(/[:：]+$/, '').trim();
    if (/سند\s*ورقي/.test(t) && /سند\s*(?:إ|ا)لكتروني|نافذ/.test(t)) f.bond_type = 'إلكتروني + ورقي';
    else if (/سند\s*ورقي/.test(t)) f.bond_type = 'ورقي';
    else if (/نافذ|إلكتروني|الكتروني/.test(t)) f.bond_type = 'إلكتروني (نافذ)';
    return f;
  }
  // صفوف السند: فارغ ← تعبئة، مختلف ← قرار المستخدم
  function bondRows(texts, d){
    const all = {};
    for (const t of texts){ const f = bondFields(t); for (const [k, v] of Object.entries(f)) if (all[k] == null) all[k] = v; }
    const rows = [];
    const same = (a, b) => (a && typeof a === 'object' ? a.g : String(a ?? '').replace(/[\s,]/g, '')) === (b && typeof b === 'object' ? b.g : String(b ?? '').replace(/[\s,]/g, ''));
    for (const [k, v] of Object.entries(all)){
      const cur = d[k];
      const empty = cur == null || cur === '' || (typeof cur === 'object' && !cur.g && !cur.h);
      if (empty) rows.push({fk:k, fv:v, kind:'empty', alts:[]});
      else if (!same(cur, v)) rows.push({fk:k, fv:v, kind:'diff', cur: showV(cur), alts:[]});
    }
    return rows;
  }

  // حقول عامة تُقرأ من أي نص (مفيدة لرسائل التحديث): الجوال، السجل التجاري، العنوان الوطني، الاسم التجاري
  function genericFields(text){
    const t = dig(text), f = {};
    const O = root.TamkeenOcr || {};
    const mob = (t.replace(/[\s\-]/g, '').match(/(?:\+?966|0)5\d{8}/) || [])[0];
    if (mob && O.normMobile) f.manager_mobile = O.normMobile(mob);
    const cr = /(?:السجل التجاري|رقم السجل|الرقم الموحد|سجل تجاري)[^\d\n]{0,15}(\d{10})/.exec(t);
    if (cr && (!O.validCr || O.validCr(cr[1]))) f.cr_no = cr[1];
    const na = shortAddr(t); if (na) f.national_address = na;
    const tn = /(?:الاسم التجاري|اسم المنشأة|اسم المنشاة)\s*(?:لل(?:مؤسسة|شركة|منشأة|منشاة))?\s*[:：]?\s*([^\n]{3,70})/.exec(t); if (tn) f.trade_name = cleanName(tn[1]);
    if (!f.cr_no){ const c2 = /(?:السجل|الموحد|سجل|المنشأة)[^\d\n]{0,40}((?:70|[1-5]\d)\d{8})(?!\d)/.exec(t); if (c2 && (!O.validCr || O.validCr(c2[1]))) f.cr_no = c2[1]; }
    const city = /(?:مدينة الإصدار|مدينة الاصدار|المدينة|المقر الرئيسي)\s*[:：]?\s*([ء-ي]{2,15})/.exec(t); if (city) f.cr_city = city[1];
    const act = /(?:نشاط المنشأة|نشاط المنشاة|النشاط الرئيسي|الأنشطة|الانشطة|النشاط)\s*[:：]?\s*([^\n]{4,70})/.exec(t); if (act) f.activity = act[1].replace(/[^ء-ي0-9 ()\-،,]/g, ' ').replace(/\s+/g, ' ').trim();
    if (f.activity && f.activity.length < 4) delete f.activity;
    const br = /(?:تابع(?:ين|ة)?\s*(?:ل)?)?فرع\s+(?:مدينة\s+)?([ء-ي]{2,15})/.exec(t); if (br && !/^(?:الشركة|رئيسي|الرئيسي)$/.test(br[1])) f.branch = br[1].replace(/^الاحساء$/, 'الأحساء');
    return f;
  }
  // العنوان المختصر: 4 حروف + 4 أرقام، حتى لو جاء في مربعات منفصلة «F H G H 4 2 7 5» أو معكوسًا «5 7 2 4 H G H F»
  function shortAddr(text){
    const t = String(text || '').toUpperCase();
    let m = /(?<![A-Z0-9])([A-Z])[\s|]*([A-Z])[\s|]*([A-Z])[\s|]*([A-Z])[\s|]*(\d)[\s|]*(\d)[\s|]*(\d)[\s|]*(\d)(?![A-Z0-9])/.exec(t);
    if (m) return m.slice(1, 9).join('');
    m = /(?<![A-Z0-9])(\d)[\s|]*(\d)[\s|]*(\d)[\s|]*(\d)[\s|]*([A-Z])[\s|]*([A-Z])[\s|]*([A-Z])[\s|]*([A-Z])(?![A-Z0-9])/.exec(t);
    if (m && /العنوان\s*المختصر|Short\s*Address|National\s*Address|العنوان\s*الوطني/i.test(text)) return m.slice(1, 9).reverse().join('');
    return '';
  }
  // يشيل البادئات مثل «للمؤسسة :» والرموز الشاذة من الاسم التجاري
  function cleanName(v){ return String(v || '').replace(/^\s*(?:لل(?:مؤسسة|شركة|منشأة|منشاة)|للمنشأة)\s*[:：]?\s*/, '').replace(/^[\s:：\-–|]+/, '').replace(/[^ء-ي0-9A-Za-z ()\-&.]/g, ' ').replace(/\s+/g, ' ').trim(); }
  function genericRows(texts, d){
    const all = {};
    for (const t of texts){ const f = genericFields(t); for (const [k, v] of Object.entries(f)) if (all[k] == null) all[k] = v; }
    const rows = [];
    for (const [k, v] of Object.entries(all)){
      const cur = d[k]; const cs = String(cur ?? '').trim();
      if (!cs) rows.push({fk:k, fv:v, kind:'empty', alts:[]});
      else if (cs.replace(/\s/g, '') !== String(v).replace(/\s/g, '')) rows.push({fk:k, fv:v, kind:'diff', cur: cs, alts:[]});
    }
    return rows;
  }
  // صفوف السجل التجاري من uxCrExtract
  function crRows(ci, d){
    const D = g => ({orig:'g', g, h: root.g2h ? root.g2h(g) : '', verified:true});
    const F = [['trade_name', ci.name], ['cr_no', ci.unified || ci.oldCr], ['cr_city', ci.city], ['cr_entity', ci.entity], ['cr_state', ci.state], ['cr_confirm', ci.confirm && D(ci.confirm)], ['cr_issue', ci.issue && D(ci.issue)]];
    const rows = [];
    for (const [k, v] of F){
      if (!v) continue;
      if (k === 'cr_issue' && !(typeof MODS !== 'undefined' && MODS.contracts.fields.some(f => f.k === 'cr_issue'))) { if (!d.cr_issue) d.cr_issue = v; continue; }
      const cur = d[k]; const cs = cur && typeof cur === 'object' ? (cur.g || '') : String(cur ?? '').trim(); const vs = typeof v === 'object' ? v.g : String(v);
      if (!cs) rows.push({fk:k, fv:v, kind:'empty', alts:[]});
      else if (cs.replace(/\s/g, '') !== vs.replace(/\s/g, '')) rows.push({fk:k, fv:v, kind:'diff', cur: cs, alts:[]});
    }
    return rows;
  }
  // السند: تاريخه = تاريخ إنشاء العقد، ومحرره = العميل (الاسم التجاري) إذا كانت فاضية
  function bondDefaults(rows, d){
    const has = k => rows.some(r => r.fk === k);
    const val = k => { const r = rows.find(x => x.fk === k); return r ? r.fv : d[k]; };
    const bondKnown = ['bond_type', 'bond_amount', 'bond_no'].some(k => has(k) || (d[k] && d[k] !== 'ما فيه سند'));
    if (!bondKnown || val('bond_type') === 'ما فيه سند') return rows;
    const out = rows.slice();
    const cd = d.date && (d.date.g || (typeof d.date === 'string' ? d.date : ''));
    if (!has('bond_date') && !(d.bond_date && d.bond_date.g) && cd) out.push({fk:'bond_date', fv:{orig:'g', g:cd, h: root.g2h ? root.g2h(cd) : '', verified:true}, kind:'empty', alts:[]});
    const tn = val('trade_name');
    if (!has('bond_issuer') && !String(d.bond_issuer || '').trim() && tn) out.push({fk:'bond_issuer', fv: String(tn), kind:'empty', alts:[]});
    return out;
  }
  // دمج الصفوف: قراءة البرنامج الأصلية أولًا، ثم ما ينقص من السند والحقول العامة (بدون تكرار)
  // قيمة فيها عناوين خانات أخرى = قراءة خاطئة لخانة فاضية في النموذج (مثل «رقم الجوال البريد الالكتروني…»)
  const LABELISH = /(?:رقم\s*(?:ال)?جوال|البريد\s*(?:الإ|الا)?ل?كترو|اسم\s*الشخص|نموذج\s*التوقيع|العنوان\s*الوطني|رقم\s*السجل|اسم\s*الموظف|رقم\s*الهوية)/;
  function mergeRows(...lists){
    const seen = new Set(), out = [];
    for (const l of lists) for (let r of l){ if (seen.has(r.fk)) continue; if (r.fk === 'trade_name' && typeof r.fv === 'string'){ r = {...r, fv: cleanName(r.fv)}; if (!r.fv) continue; } if (typeof r.fv === 'string' && LABELISH.test(r.fv)) continue; seen.add(r.fk); out.push(r); }
    return out;
  }
  root.TamkeenContractReader = {bondFields, bondRows, genericFields, cleanName, shortAddr, bondDefaults};
  function setVal(d, k, v){
    if (v && typeof v === 'object'){ d[k] = v; const el = document.getElementById('f_' + k); if (el && el.type === 'date' && v.g){ el.value = v.g; el.dispatchEvent(new Event('input', {bubbles:true})); } return; }
    const el = document.getElementById('f_' + k);
    if (el && el.tagName === 'SELECT'){ d[k] = v; el.value = v; el.dispatchEvent(new Event('change', {bubbles:true})); return; }
    if (root.setField) root.setField(d, k, v, null); else d[k] = v;
  }
  const readOnly = () => typeof S !== 'undefined' && !!S.readOnly;

  // عرض النتائج (مشترك بين رفع الملفات ولصق الرسالة)
  function render(mode, id, out, rows, srcWord){
    const d = mode === 'new' ? (formData || {}) : root.rec('contracts', id);
    const empty = rows.filter(r => r.kind === 'empty' && !r.conflict), diff = rows.filter(r => r.kind === 'diff' || r.conflict);
    if (mode === 'new'){
      for (const r of empty) setVal(d, r.fk, r.fv);
      if (empty.length) out.append(box('ok', 'عُبّئ ' + NF(empty.length) + ': ' + empty.map(r => LBL(r.fk)).join('، ') + '. راجعها قبل الحفظ.'));
    } else if (empty.length){
      const btn = root.h('button', {type:'button', class:'btn primary sm', disabled: readOnly(), onclick: async () => {
        btn.disabled = true;
        const fresh = root.rec('contracts', id), patch = {};
        for (const r of empty) patch[r.fk] = r.fv;
        const res = await root.writeDoc('contracts', id, patch, fresh.rev);
        if (res && res.ok){ root.audit && root.audit('تحديث العقد من ' + srcWord, 'contracts', id, NF(empty.length)); btn.replaceWith(box('ok', 'حُفظت الحقول.')); }
        else { btn.disabled = false; out.append(box('bad', res && res.conflict ? 'عُدّل العقد من جهاز آخر؛ حدّث الصفحة وأعد المحاولة.' : 'تعذر الحفظ.')); }
      }}, 'تعبئة الحقول الفارغة (' + NF(empty.length) + ')');
      out.append(box('ok', root.h('span', null, 'حقول فارغة وجدت لها قيمًا: ' + empty.map(r => LBL(r.fk) + ' = ' + showV(r.fv)).join('، ') + ' ')), btn);
    }
    if (diff.length){
      out.append(root.h('div', {class:'small', style:'margin-top:4px'}, root.h('b', null, 'قيم تحتاج قرارك (التحديث لا يُطبَّق إلا بضغطتك):')));
      for (const r of diff){
        const apply = root.h('button', {type:'button', class:'btn sm', disabled: mode !== 'new' && readOnly(), onclick: async () => {
          if (mode === 'new'){ setVal(formData || {}, r.fk, r.fv); apply.replaceWith(root.h('span', {class:'small'}, '✓ طُبّقت')); return; }
          apply.disabled = true; const fresh = root.rec('contracts', id);
          const res = await root.writeDoc('contracts', id, {[r.fk]: r.fv}, fresh.rev);
          if (res && res.ok) root.audit && root.audit('تحديث العقد من ' + srcWord, 'contracts', id, LBL(r.fk));
          apply.replaceWith(root.h('span', {class:'small'}, res && res.ok ? '✓ حُفظت' : 'تعذر الحفظ'));
        }}, 'استخدم القيمة الجديدة');
        out.append(root.h('div', {class:'banner warn', style:'display:flex;gap:10px;align-items:center;flex-wrap:wrap'},
          root.h('span', null, LBL(r.fk) + ': في ' + srcWord + ' «' + showV(r.fv) + '»' + (r.cur ? '، والمسجّل «' + r.cur + '»' : '') + (r.alts && r.alts.length ? ' — وفي مستند آخر: ' + r.alts.join(' / ') : '')), apply));
      }
    }
    if (!rows.length) out.append(box('warn', srcWord === 'الرسالة' ? 'ما لقيت في الرسالة بيانات جديدة أو مختلفة عن المسجّل.' : 'ما لقيت بيانات جديدة في المستندات. إذا كانت الصور غير واضحة جرّب صورة أوضح أو ملف PDF.'));
  }

  function panel(mode, id){
    const inp = root.h('input', {type:'file', multiple:true, accept:'image/png,image/jpeg,image/webp,application/pdf', style:'display:none'});
    const out = root.h('div', {'aria-live':'polite', style:'display:grid;gap:8px;margin-top:10px'});
    const prog = root.h('div', {class:'small muted', 'aria-live':'polite'});
    const pick = root.h('button', {type:'button', class:'btn primary', onclick: () => inp.click()}, '📄 رفع مستندات وقراءتها');
    let busy = false;
    inp.onchange = async () => {
      const files = [...inp.files].slice(0, MAX_FILES); inp.value = '';
      if (!files.length || busy) return;
      busy = true; pick.disabled = true; out.replaceChildren(); prog.textContent = 'أول قراءة تحمّل حزمة اللغة العربية مرة واحدة، قد تأخذ دقيقة…';
      try {
        const {info, types, texts, pages} = await readFiles(files, m => { prog.textContent = m; });
        prog.textContent = 'قُرئت ' + pages + ' صفحة.';
        const d = mode === 'new' ? (formData || {}) : root.rec('contracts', id);
        if (!d) throw new Error('العقد غير موجود.');
        // السجل التجاري: قراءة كاملة (الباركود + الرقم الموحد + الكيان + الحالة + التواريخ) قبل الحفظ
        let crR = [];
        const crFile = (types.find(t => t.type === 'cr') || {}).f;
        if (crFile && typeof root.uxCrExtract === 'function'){
          try { const {info: ex, qr} = await root.uxCrExtract(crFile, m => { prog.textContent = m; }); const ci = Object.assign({}, ex); if (typeof root.uxCrParse === 'function'){ const crTxt = types.map((t, i) => t.f === crFile ? texts[i] : '').join('\n'); const cp = root.uxCrParse(crTxt); for (const [k, v] of Object.entries(cp)) if (v) ci[k] = v; } crR = crRows(ci, d); if (qr && /^https:\/\/([a-z0-9-]+\.)*(saudibusiness\.gov\.sa|mc\.gov\.sa)\//i.test(qr) && !d.cr_qr) d.cr_qr = qr; prog.textContent = 'قُرئت ' + pages + ' صفحة' + (qr ? ' · وقُرئ باركود السجل' : '') + '.'; } catch (e) {}
        }
        const rows = bondDefaults(mergeRows(crR, contractRows(info, d), bondRows(texts, d), genericRows(texts, d)), d);
        out.append(root.h('div', {class:'small'}, root.h('b', null, 'المستندات: '), types.map(t => t.file + ' ← ' + (TYPE_AR[t.type] || t.type) + (t.method ? ' (' + t.method + ')' : '')).join(' · ')));
        render(mode, id, out, rows, 'المستند');
        if (mode === 'new'){ pendingFiles = files; out.append(box('info', 'ستُرفق المستندات بالعقد تلقائيًا بعد الحفظ.')); }
        else if (!readOnly()){ try { await root.uploadFiles(files, ['contracts:' + id], m => out.append(typeof m === 'string' ? box('info', m) : m), 'مستندات العميل'); } catch (e){ out.append(box('warn', 'تعذر إرفاق الملفات: ' + e.message)); } }
      } catch (e){ out.append(box('bad', e.message || String(e))); prog.textContent = ''; }
      finally { busy = false; pick.disabled = false; }
    };
    // تحديث من رسالة أو بريد (داخل العقد)
    let msgBox = null;
    {
      const msgOut = root.h('div', {'aria-live':'polite', style:'display:grid;gap:8px'});
      const ta = root.h('textarea', {dir:'auto', rows:4, style:'width:100%;padding:12px;border:1px solid var(--line);border-radius:12px;background:var(--surface-2);color:var(--ink);font:inherit', 'aria-label':'نص رسالة التحديث',
        placeholder:'الصق رسالة أو بريد التحديث هنا: سجل تجاري جديد، جوال أو عنوان جديد، مفوض جديد، سند جديد (رقم السند، المبلغ، التاريخ)…'});
      const read = root.h('button', {type:'button', class:'btn sm', onclick: () => {
        msgOut.replaceChildren(); const t = ta.value.trim();
        if (!t){ msgOut.append(box('warn', 'الصق الرسالة أولًا.')); return; }
        const d = mode === 'new' ? (formData || {}) : root.rec('contracts', id); if (!d){ msgOut.append(box('bad', 'العقد غير موجود.')); return; }
        const rows = bondDefaults(mergeRows(contractRows({1: root.uxReadPage(t)}, d), bondRows([t], d), genericRows([t], d)), d);
        render(mode, id, msgOut, rows, 'الرسالة');
      }}, 'قراءة الرسالة');
      msgBox = root.h('div', {style:'margin-top:12px;display:grid;gap:8px'}, root.h('b', null, mode === 'new' ? '✉️ رسالة المندوب (واتساب): الجوال، السند ومبلغه، الفرع…' : '✉️ أو الصق رسالة / بريد التحديث'), ta, root.h('div', {class:'row'}, read), msgOut);
    }
    return root.h('div', {class:'panel cr-reader'},
      root.h('h2', {style:'margin:0 0 6px;font-size:1.05rem'}, mode === 'new' ? 'قارئ مستندات العميل' : 'تحديث العقد من مستند أو رسالة'),
      root.h('p', {class:'small muted', style:'margin:0 0 10px'}, 'ارفع السجل التجاري أو الهوية أو العنوان الوطني أو الرخصة أو السند أو صفحات العقد (صور أو PDF، حتى ' + MAX_FILES + ' ملفات). يعبّي البرنامج الحقول الفارغة، ويعرض لك أي قيمة مختلفة عن المسجّل لتقرر.'),
      root.h('div', {class:'row'}, pick, inp), prog, msgBox, out);
  }

  async function attachPending(id){
    const files = pendingFiles; if (!files) return; pendingFiles = null;
    try { await root.uploadFiles(files, ['contracts:' + id], () => {}, 'مستندات العميل'); root.toast && root.toast('أُرفقت ' + files.length + ' مستندات بالعقد'); }
    catch (e){ root.toast && root.toast('تعذر إرفاق المستندات: ' + e.message); }
  }

  function hook(){
    if (typeof root.fieldInput === 'function' && !root.fieldInput.__cr){
      const orig = root.fieldInput;
      root.fieldInput = function(f, val, onCh, ro, data){ if (data && !data.id && !ro) formData = data; return orig.apply(this, arguments); };
      root.fieldInput.__cr = true;
    }
    if (typeof root.viewNew === 'function' && !root.viewNew.__cr){
      const orig = root.viewNew;
      root.viewNew = function(mod){
        if (mod === 'contracts'){ formData = null; pendingFiles = null; }
        const v = orig.apply(this, arguments);
        try {
          if (mod === 'contracts' && v && v.el && !(typeof S !== 'undefined' && S.readOnly)){
            const p = panel('new'); const head = v.el.querySelector('.page-head');
            head ? head.after(p) : v.el.prepend(p);
          }
        } catch (e){ console.warn('contract reader new', e); }
        return v;
      };
      root.viewNew.__cr = true;
    }
    if (typeof root.viewDetail === 'function' && !root.viewDetail.__cr){
      const orig = root.viewDetail;
      root.viewDetail = function(mod, id){
        const v = orig.apply(this, arguments);
        try {
          if (mod === 'contracts' && v && v.el){
            if (pendingFiles) setTimeout(() => attachPending(id), 400);
            if (!(typeof S !== 'undefined' && S.readOnly) && root.rec('contracts', id)){
              const p = root.h('details', {class:'panel cr-reader-d'}, root.h('summary', {style:'cursor:pointer;font-weight:700'}, '📄 تحديث العقد من مستند أو رسالة'), panel('detail', id));
              const place = () => { if (v.el.contains(p)) return; const head = v.el.querySelector('.page-head'); head ? head.after(p) : v.el.prepend(p); };
              place();
              const r = v.refresh; if (typeof r === 'function') v.refresh = function(){ const o = r.apply(this, arguments); try { place(); } catch(e){} return o; };
              new MutationObserver(() => place()).observe(v.el, {childList:true});
            }
          }
        } catch (e){ console.warn('contract reader detail', e); }
        return v;
      };
      root.viewDetail.__cr = true;
    }
    const st = document.createElement('style');
    st.textContent = 'details.cr-reader-d{padding-block:14px!important;display:block!important}details.cr-reader-d:not([open])>:not(summary){display:none!important}details.cr-reader-d .cr-reader{border:0!important;box-shadow:none!important;padding:10px 0 0!important;background:transparent!important}';
    document.head.appendChild(st);
  }
  if (document.readyState !== 'loading') hook(); else document.addEventListener('DOMContentLoaded', hook);
})(window);
