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
    const pages = [];
    for (const f of files){
      if (/pdf/i.test(f.type) || /\.pdf$/i.test(f.name)){
        progress('تجهيز ' + f.name + '…');
        const buf = await f.arrayBuffer();
        const r = await root.renderPdfPages(buf, MAX_PAGES);
        for (const p of r.pages) pages.push({blob: p.blob, file: f.name});
      } else if (/^image\//.test(f.type)) pages.push({blob: f, file: f.name});
      if (pages.length >= MAX_PAGES) break;
    }
    if (!pages.length) throw new Error('لم أجد صفحات قابلة للقراءة. ارفع صورًا (JPG/PNG) أو ملفات PDF.');
    const w = await root.uxLangWorker();
    const info = {}, types = [];
    for (let i = 0; i < pages.length; i++){
      progress('قراءة الصفحة ' + (i + 1) + ' من ' + pages.length + ' (' + pages[i].file + ')…');
      const r = await w.recognize(pages[i].blob);
      const x = root.uxReadPage(r.data.text || '');
      info[i + 1] = x; types.push({file: pages[i].file, type: x.type});
    }
    return {info, types, pages: pages.length};
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

  function setVal(d, k, v){
    if (v && typeof v === 'object'){ d[k] = v; const el = document.getElementById('f_' + k); if (el && el.type === 'date' && v.g){ el.value = v.g; el.dispatchEvent(new Event('input', {bubbles:true})); } return; }
    if (root.setField) root.setField(d, k, v, null); else d[k] = v;
  }

  function panel(mode, id){
    const inp = root.h('input', {type:'file', multiple:true, accept:'image/png,image/jpeg,image/webp,application/pdf', style:'display:none'});
    const out = root.h('div', {'aria-live':'polite', style:'display:grid;gap:8px;margin-top:10px'});
    const prog = root.h('div', {class:'small muted', 'aria-live':'polite'});
    const pick = root.h('button', {type:'button', class:'btn primary', onclick: () => inp.click()}, '📄 رفع مستندات العميل وقراءتها');
    let busy = false;
    inp.onchange = async () => {
      const files = [...inp.files].slice(0, MAX_FILES); inp.value = '';
      if (!files.length || busy) return;
      busy = true; pick.disabled = true; out.replaceChildren(); prog.textContent = 'أول قراءة تحمّل حزمة اللغة العربية مرة واحدة، قد تأخذ دقيقة…';
      try {
        const {info, types, pages} = await readFiles(files, m => { prog.textContent = m; });
        prog.textContent = 'قُرئت ' + pages + ' صفحة.';
        const d = mode === 'new' ? (formData || {}) : root.rec('contracts', id);
        if (!d) throw new Error('العقد غير موجود.');
        const rows = contractRows(info, d);
        const empty = rows.filter(r => r.kind === 'empty' && !r.conflict), diff = rows.filter(r => r.kind === 'diff' || r.conflict);
        out.append(root.h('div', {class:'small'}, root.h('b', null, 'المستندات: '), types.map(t => t.file + ' ← ' + (TYPE_AR[t.type] || t.type)).join(' · ')));
        if (mode === 'new'){
          for (const r of empty) setVal(d, r.fk, r.fv);
          if (empty.length) out.append(box('ok', 'عُبّئ ' + NF(empty.length) + ': ' + empty.map(r => LBL(r.fk)).join('، ') + '. راجعها مقابل المستندات قبل الحفظ.'));
          pendingFiles = files;
          out.append(box('info', 'ستُرفق المستندات بالعقد تلقائيًا بعد الحفظ.'));
        } else {
          if (empty.length){
            const btn = root.h('button', {type:'button', class:'btn primary sm', onclick: async () => {
              btn.disabled = true;
              const fresh = root.rec('contracts', id), patch = {};
              for (const r of empty) patch[r.fk] = r.fv;
              const res = await root.writeDoc('contracts', id, patch, fresh.rev);
              if (res && res.ok){ root.audit && root.audit('تعبئة من قراءة المستندات', 'contracts', id, NF(empty.length)); btn.replaceWith(box('ok', 'حُفظت الحقول.')); }
              else { btn.disabled = false; out.append(box('bad', res && res.conflict ? 'عُدّل العقد من جهاز آخر؛ حدّث الصفحة وأعد المحاولة.' : 'تعذر الحفظ.')); }
            }}, 'تعبئة الحقول الفارغة (' + NF(empty.length) + ')');
            out.append(box('ok', root.h('span', null, 'حقول فارغة وجدت لها قيمًا: ' + empty.map(r => LBL(r.fk) + ' = ' + showV(r.fv)).join('، ') + ' ')), btn);
          }
          try { await root.uploadFiles(files, ['contracts:' + id], m => out.append(typeof m === 'string' ? box('info', m) : m), 'مستندات العميل'); } catch (e){ out.append(box('warn', 'تعذر إرفاق الملفات: ' + e.message)); }
        }
        if (diff.length){
          out.append(root.h('div', {class:'small', style:'margin-top:4px'}, root.h('b', null, 'قيم تحتاج قرارك:')));
          for (const r of diff){
            const apply = root.h('button', {type:'button', class:'btn sm', onclick: async () => {
              if (mode === 'new'){ setVal(formData || {}, r.fk, r.fv); apply.replaceWith(root.h('span', {class:'small'}, '✓ طُبّقت')); return; }
              apply.disabled = true; const fresh = root.rec('contracts', id);
              const res = await root.writeDoc('contracts', id, {[r.fk]: r.fv}, fresh.rev);
              apply.replaceWith(root.h('span', {class:'small'}, res && res.ok ? '✓ حُفظت' : 'تعذر الحفظ'));
            }}, 'استخدم قيمة المستند');
            out.append(root.h('div', {class:'banner warn', style:'display:flex;gap:10px;align-items:center;flex-wrap:wrap'},
              root.h('span', null, LBL(r.fk) + ': في المستند «' + showV(r.fv) + '»' + (r.cur ? '، والمسجّل «' + r.cur + '»' : '') + (r.alts.length ? ' — وفي مستند آخر: ' + r.alts.join(' / ') : '')), apply));
          }
        }
        if (!rows.length) out.append(box('warn', 'ما لقيت بيانات جديدة في المستندات. إذا كانت الصور غير واضحة جرّب صورة أوضح أو ملف PDF.'));
      } catch (e){ out.append(box('bad', e.message || String(e))); prog.textContent = ''; }
      finally { busy = false; pick.disabled = false; }
    };
    return root.h('div', {class:'panel cr-reader'},
      root.h('h2', {style:'margin:0 0 6px;font-size:1.05rem'}, 'قارئ مستندات العميل'),
      root.h('p', {class:'small muted', style:'margin:0 0 10px'}, 'ارفع السجل التجاري والهوية والعنوان الوطني والرخصة أو صفحات العقد (صور أو PDF، حتى ' + MAX_FILES + ' ملفات). يقرأها البرنامج ويعبّي الحقول الفارغة، ويعرض لك أي قيمة مختلفة عن المسجّل لتقرر.'),
      root.h('div', {class:'row'}, pick, inp), prog, out);
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
          if (mod === 'contracts' && v && v.el && !root.S?.readOnly){
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
            if (!root.S?.readOnly && root.rec('contracts', id)){
              const p = root.h('details', {class:'panel cr-reader-d'}, root.h('summary', {style:'cursor:pointer;font-weight:700'}, '📄 قراءة مستندات العميل وتعبئة العقد'), panel('detail', id));
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
