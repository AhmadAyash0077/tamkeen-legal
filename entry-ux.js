/* إدخال أسرع وأسلس في كل نماذج البرنامج — بدون تغيير الحقول أو طريقة الحفظ.
   - Enter ينقل للحقل التالي (بدل لا شيء)، وShift+Enter للسابق. في مربعات النص الطويل يبقى Enter سطرًا جديدًا.
   - Ctrl+S (أو ⌘S) يحفظ النموذج المفتوح.
   - المؤشر يبدأ تلقائيًا في أول حقل فارغ عند فتح «إضافة جديد».
   - الأرقام العربية/الهندية (٠١٢٣) تتحول تلقائيًا إلى 0123 في حقول الأرقام والهويات والجوال.
   - شريط تقدّم صغير يوضح كم حقلًا إلزاميًا بقي قبل الحفظ. */
(function(){
  'use strict';
  const toLatin = s => s.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d));
  const isField = el => el && el.matches && el.matches('input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=file]):not([disabled]):not([readonly]),select:not([disabled]),textarea:not([disabled]):not([readonly])');
  const visible = el => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
  const scope = el => el.closest('form, dialog, .panel, .content') || document;
  const fieldsIn = root => [...root.querySelectorAll('input,select,textarea')].filter(el => isField(el) && visible(el) && !el.closest('.search'));
  const numericLike = el => el.tagName === 'INPUT' && (el.inputMode === 'numeric' || el.inputMode === 'decimal' || el.getAttribute('dir') === 'ltr' || el.classList.contains('num') || el.classList.contains('ltr') || el.type === 'tel');

  // Enter / Shift+Enter للتنقل
  document.addEventListener('keydown', e => {
    const el = e.target;
    if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey && !e.altKey && isField(el) && el.tagName !== 'TEXTAREA'){
      if (el.closest('.search') || el.type === 'search') return; // البحث له سلوكه
      if (el.getAttribute('list') && document.activeElement === el && e.isComposing) return;
      const list = fieldsIn(scope(el)); const i = list.indexOf(el);
      if (i < 0) return;
      const next = list[i + (e.shiftKey ? -1 : 1)];
      if (next){ e.preventDefault(); next.focus(); if (next.select && next.tagName === 'INPUT') try { next.select(); } catch(_){} }
    }
    // Ctrl/⌘+S للحفظ
    if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S' || e.code === 'KeyS')){
      const root = document.querySelector('dialog[open]') || document.getElementById('view') || document;
      const btn = [...root.querySelectorAll('button.btn.primary, .btn.primary')].find(b => visible(b) && !b.disabled && /حفظ/.test(b.textContent || ''));
      if (btn){ e.preventDefault(); btn.click(); }
    }
  }, true);

  // تحويل الأرقام عند الكتابة/اللصق في حقول الأرقام
  document.addEventListener('input', e => {
    const el = e.target;
    if (!numericLike(el)) return;
    const v = el.value, t = toLatin(v);
    if (t !== v){ const pos = el.selectionStart; el.value = t; try { el.setSelectionRange(pos, pos); } catch(_){} el.dispatchEvent(new Event('input', {bubbles:true})); }
  }, true);

  // بداية تلقائية في أول حقل فارغ + شريط التقدم في صفحات «إضافة جديد»
  let lastHash = null;
  function onPage(){
    const hash = location.hash;
    if (hash === lastHash) return; lastHash = hash;
    if (!/^#new-/.test(hash)) return;
    let tries = 0;
    const t = setInterval(() => {
      const view = document.getElementById('view');
      const list = view ? fieldsIn(view) : [];
      if (list.length || ++tries > 20){
        clearInterval(t);
        const first = list.find(el => !el.value) || list[0];
        if (first && !view.contains(document.activeElement)) first.focus({preventScroll:false});
        if (view) progress(view);
      }
    }, 100);
  }
  // شريط التقدّم: يحسب الحقول المعلَّمة بنجمة (*)
  function progress(view){
    if (view.querySelector('.eu-progress')) return;
    const req = () => [...view.querySelectorAll('.f')].filter(f => f.querySelector('label .req') && visible(f));
    if (!req().length) return;
    const bar = document.createElement('div'); bar.className = 'eu-progress'; bar.setAttribute('role','status'); bar.setAttribute('aria-live','polite');
    bar.innerHTML = '<span class="eu-track"><i></i></span><b></b>';
    const head = view.querySelector('.page-head'); (head ? head.after(bar) : view.prepend(bar));
    const paint = () => {
      const all = req(); const done = all.filter(f => { const i = f.querySelector('input,select,textarea'); return i && String(i.value || '').trim(); }).length;
      bar.querySelector('i').style.width = (all.length ? done / all.length * 100 : 0) + '%';
      const left = all.length - done, word = left === 1 ? 'حقل إلزامي واحد' : left === 2 ? 'حقلان إلزاميان' : left <= 10 ? left + ' حقول إلزامية' : left + ' حقلًا إلزاميًا';
      bar.querySelector('b').textContent = left === 0 ? 'الحقول الإلزامية مكتملة — تقدر تحفظ (Ctrl+S)' : 'باقي ' + word;
      bar.classList.toggle('ok', done === all.length);
    };
    paint(); view.addEventListener('input', paint); view.addEventListener('change', paint);
  }
  window.addEventListener('hashchange', onPage);
  if (document.readyState !== 'loading') setTimeout(onPage, 0); else document.addEventListener('DOMContentLoaded', () => setTimeout(onPage, 0));

  // أنماط شريط التقدّم (تعمل مع كل السمات)
  const css = document.createElement('style');
  css.textContent = '.eu-progress{display:flex;align-items:center;gap:12px;margin:4px 0 14px;font-size:.88rem;color:var(--ink-2)}'
    + '.eu-progress .eu-track{flex:0 0 160px;height:6px;border-radius:999px;background:color-mix(in srgb,var(--ink) 10%,transparent);overflow:hidden}'
    + '.eu-progress .eu-track i{display:block;height:100%;width:0;border-radius:inherit;background:var(--brass,var(--accent));transition:width .35s cubic-bezier(.22,1,.36,1)}'
    + '.eu-progress.ok b{color:var(--ok,#1f7a4a)}.eu-progress.ok .eu-track i{background:var(--ok,#1f7a4a)}';
  document.head.appendChild(css);
})();
