/* تحسين القراءة الآلية المحلية (OCR) — مجاني وداخل المتصفح.
   1) تجهيز الصورة قبل القراءة: تكبير الصور الصغيرة، تحويل للرمادي، رفع التباين، وتنعيم الخلفية.
   2) قراءتان للصفحة: قراءة عامة للنص العربي/الإنجليزي، وقراءة ثانية للأرقام فقط لالتقاط
      أرقام الهوية والسجل والجوال بدقة أعلى.
   3) تحقق من صحة الأرقام قبل اقتراحها: رقم الهوية/الإقامة (خوارزمية التحقق)، السجل التجاري،
      الرقم الضريبي، والجوال. الرقم غير الصحيح لا يُقترح، ويُبحث عن رقم صحيح بديل في نص الصفحة.
   لا يغيّر شيئًا في البيانات؛ يحسّن فقط ما يُقترح على المستخدم ليراجعه. */
(function(root){
  'use strict';
  const toLatin = s => String(s ?? '').replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d));

  /* ===== التحقق من الأرقام ===== */
  // رقم الهوية الوطنية أو الإقامة: 10 أرقام يبدأ بـ1 أو 2 مع رقم تحقق (خوارزمية لون)
  function validSaudiId(v){
    const s = toLatin(v).replace(/\D/g,'');
    if (!/^[12]\d{9}$/.test(s)) return false;
    let sum = 0;
    for (let i = 0; i < 10; i++){
      let n = +s[i];
      if (i % 2 === 0){ n *= 2; if (n > 9) n -= 9; }
      sum += n;
    }
    return sum % 10 === 0;
  }
  const validCr = v => /^(70\d{8}|[1-5]\d{9})$/.test(toLatin(v).replace(/\D/g,''));
  const validVat = v => /^3\d{13}3$/.test(toLatin(v).replace(/\D/g,''));
  const normMobile = v => { const s = toLatin(v).replace(/[^\d+]/g,'').replace(/^\+?966/,'0').replace(/^5/,'05'); return /^05\d{8}$/.test(s) ? s : null; };

  // كل التسلسلات الرقمية في النص، مع دمج الأرقام المفصولة بمسافات أو شرطات
  function numberCandidates(text){
    const t = toLatin(text);
    const out = new Set();
    for (const m of t.matchAll(/\d[\d \-]{6,20}\d/g)) out.add(m[0].replace(/[ \-]/g,''));
    for (const m of t.matchAll(/\d{9,16}/g)) out.add(m[0]);
    return [...out];
  }
  const firstValid = (cands, test, not=[]) => cands.find(n => test(n) && !not.includes(n)) || null;

  // تصحيح ما استخرجه قارئ الصفحة: إسقاط غير الصحيح، والبحث عن بديل صحيح في النص
  function fixFields(x, text){
    if (!x || !x.fields) return x;
    const f = x.fields, cands = numberCandidates(text), notes = [];
    const fixId = k => {
      if (f[k] == null) return;
      if (validSaudiId(f[k])) return;
      const alt = firstValid(cands, validSaudiId, [f.cr_no].filter(Boolean));
      if (alt){ notes.push('صُحّح رقم الهوية بعد التحقق'); f[k] = alt; } else { delete f[k]; notes.push('أُسقط رقم هوية غير صحيح'); }
    };
    for (const k of ['id_no','manager_id','e1_id','e2_id']) fixId(k);
    if (x.type === 'national_id' && f.id_no == null){ const alt = firstValid(cands, validSaudiId); if (alt){ f.id_no = alt; x.number = alt; } }
    if (f.cr_no != null && !validCr(f.cr_no)){ const alt = firstValid(cands, validCr); if (alt) f.cr_no = alt; else delete f.cr_no; }
    if (x.type === 'cr' && !f.cr_city){
      const m = /(?:مدينة الإصدار|مدينة الاصدار|المدينة|مدينه)\s*[:：]\s*([\u0621-\u064a]+(?:\s[\u0621-\u064a]+)?)/.exec(String(text || ''));
      if (m) f.cr_city = m[1].trim();
    }
    if (x.type === 'cr' && f.cr_no == null){ const alt = firstValid(cands, validCr); if (alt){ f.cr_no = alt; x.number = alt; } }
    if (f.vat_no != null && !validVat(f.vat_no)){ const alt = firstValid(cands, validVat); if (alt) f.vat_no = alt; else delete f.vat_no; }
    if (x.type === 'vat' && f.vat_no == null){ const alt = firstValid(cands, validVat); if (alt){ f.vat_no = alt; x.number = alt; } }
    for (const k of ['manager_mobile','e1_mobile','e2_mobile']) if (f[k] != null){ const m = normMobile(f[k]); if (m) f[k] = m; else delete f[k]; }
    if (!f.manager_mobile && x.type === 'contract_auth'){
      const m = (toLatin(text).replace(/[\s\-]/g,'').match(/(?:\+?966|0)5\d{8}/) || [])[0];
      if (m) f.manager_mobile = normMobile(m);
    }
    if (x.type === 'national_id' && x.number && !validSaudiId(x.number)) x.number = f.id_no || null;
    if (x.type === 'cr' && x.number && !validCr(x.number)) x.number = f.cr_no || null;
    if (notes.length) x.note = (x.note ? x.note + ' · ' : '') + notes.join(' · ');
    return x;
  }

  /* ===== تجهيز الصورة ===== */
  // عتبة أوتسو لفصل الكتابة عن الخلفية
  function otsu(hist, total){
    let sum = 0; for (let i = 0; i < 256; i++) sum += i * hist[i];
    let sumB = 0, wB = 0, best = 0, th = 127;
    for (let i = 0; i < 256; i++){
      wB += hist[i]; if (!wB) continue; const wF = total - wB; if (!wF) break;
      sumB += i * hist[i];
      const mB = sumB / wB, mF = (sum - sumB) / wF, v = wB * wF * (mB - mF) ** 2;
      if (v > best){ best = v; th = i; }
    }
    return th;
  }
  // يرجع الحد الأدنى والأقصى بعد استبعاد 1% من الأطراف (لرفع التباين دون تأثر بالنقاط الشاذة)
  function stretchBounds(hist, total){
    let lo = 0, hi = 255, acc = 0;
    for (let i = 0; i < 256; i++){ acc += hist[i]; if (acc > total * 0.01){ lo = i; break; } }
    acc = 0; for (let i = 255; i >= 0; i--){ acc += hist[i]; if (acc > total * 0.01){ hi = i; break; } }
    return hi - lo < 30 ? [0,255] : [lo, hi];
  }
  // يحوّل البيانات الرمادية: رفع تباين، ثم تبييض الخلفية مع إبقاء درجات الكتابة (أفضل من الأبيض والأسود الحاد للعربي)
  function enhanceGray(gray){
    const hist = new Uint32Array(256); for (let i = 0; i < gray.length; i++) hist[gray[i]]++;
    const [lo, hi] = stretchBounds(hist, gray.length), span = hi - lo || 1;
    const out = new Uint8ClampedArray(gray.length), h2 = new Uint32Array(256);
    for (let i = 0; i < gray.length; i++){ const v = Math.max(0, Math.min(255, ((gray[i] - lo) * 255 / span) | 0)); out[i] = v; h2[v]++; }
    const th = otsu(h2, out.length);
    // تبييض الخلفية فقط عندما تكون بعيدة بوضوح عن العتبة، حتى لا تُمسح الكتابة الباهتة
    const cut = Math.min(250, th + Math.max(40, (255 - th) * 0.5));
    for (let i = 0; i < out.length; i++) if (out[i] > cut) out[i] = 255;
    return out;
  }
  async function toCanvas(src){
    if (typeof HTMLCanvasElement !== 'undefined' && src instanceof HTMLCanvasElement) return src;
    const bmp = await createImageBitmap(src);
    const c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height;
    c.getContext('2d').drawImage(bmp, 0, 0); bmp.close && bmp.close(); return c;
  }
  // تكبير الصور الصغيرة حتى ~2200 بكسل عرضًا (حد أقصى 3200) — Tesseract يحتاج حروفًا لا تقل عن ~20 بكسل
  async function prepare(src){
    const c0 = await toCanvas(src);
    const target = 2200, scale = Math.min(2.5, Math.max(1, target / Math.max(1, c0.width)));
    const w = Math.min(3200, Math.round(c0.width * scale)), h = Math.round(c0.height * (w / c0.width));
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d', {willReadFrequently:true});
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high'; g.drawImage(c0, 0, 0, w, h);
    if ((root.TamkeenOcrMode || 'scale') === 'scale') return c;
    const img = g.getImageData(0, 0, w, h), d = img.data, gray = new Uint8ClampedArray(w * h);
    for (let i = 0, j = 0; i < d.length; i += 4, j++) gray[j] = (d[i] * 299 + d[i+1] * 587 + d[i+2] * 114) / 1000;
    const out = enhanceGray(gray);
    for (let i = 0, j = 0; i < d.length; i += 4, j++){ d[i] = d[i+1] = d[i+2] = out[j]; d[i+3] = 255; }
    g.putImageData(img, 0, 0);
    return c;
  }

  const core = {toLatin, validSaudiId, validCr, validVat, normMobile, numberCandidates, fixFields, otsu, stretchBounds, enhanceGray};
  if (typeof module === 'object' && module.exports){ module.exports = core; return; }
  root.TamkeenOcr = Object.assign({prepare}, core);

  /* ===== الربط بقارئ البرنامج ===== */
  // جودة القراءة = الثقة × كمية النص المقروء فعلًا (نص فارغ بثقة عالية لا يُعتد به)
  const quality = r => { const t = (r && r.data && r.data.text) || ''; const n = (t.match(/[\u0600-\u06FFA-Za-z0-9]/g) || []).length; return (r.data.confidence || 0) * Math.min(1, n / 60); };
  function wrapWorker(w){
    if (!w || w.__boost) return w;
    const recognize = w.recognize.bind(w);
    let queue = Promise.resolve();
    const run = async (img) => {
      let canvas = null;
      try { canvas = await prepare(img); } catch (e) { console.warn('ocr prepare', e); }
      let input = canvas || img;
      await w.setParameters({tessedit_char_whitelist:'', tessedit_pageseg_mode:'3'}).catch(()=>{});
      let main = await recognize(input);
      // شبكة أمان: إذا كانت الثقة منخفضة نقرأ الصورة الأصلية ونأخذ الأفضل
      if (canvas && quality(main) < 60){
        try {
          const plain = await recognize(img);
          if (quality(plain) > quality(main)){ main = plain; input = img; }
        } catch (e) {}
      }
      let digits = '';
      try {
        await w.setParameters({tessedit_char_whitelist:'0123456789٠١٢٣٤٥٦٧٨٩+-/', tessedit_pageseg_mode:'11'});
        digits = (await recognize(input)).data.text || '';
      } catch (e) {} finally {
        await w.setParameters({tessedit_char_whitelist:'', tessedit_pageseg_mode:'3'}).catch(()=>{});
      }
      if (canvas && canvas !== img){ canvas.width = canvas.height = 0; }
      const text = (main.data.text || '') + (digits ? '\n' + digits : '');
      return Object.assign({}, main, {data: Object.assign({}, main.data, {text, mainText: main.data.text || '', digitsText: digits, enhanced: input !== img})});
    };
    // تسلسل الطلبات لأن تغيير الإعدادات مشترك على نفس المحرك
    w.recognize = (img, ...rest) => { const p = queue.then(() => run(img, ...rest)); queue = p.catch(()=>{}); return p; };
    w.__boost = true;
    return w;
  }
  function hook(){
    if (typeof root.uxLangWorker === 'function' && !root.uxLangWorker.__boost){
      const orig = root.uxLangWorker;
      root.uxLangWorker = async function(){ return wrapWorker(await orig.apply(this, arguments)); };
      root.uxLangWorker.__boost = true;
    }
    if (typeof root.uxReadPage === 'function' && !root.uxReadPage.__boost){
      const orig = root.uxReadPage;
      root.uxReadPage = function(raw){ return fixFields(orig.apply(this, arguments), raw); };
      root.uxReadPage.__boost = true;
    }
  }
  if (document.readyState !== 'loading') hook(); else document.addEventListener('DOMContentLoaded', hook);
})(typeof window !== 'undefined' ? window : globalThis);
