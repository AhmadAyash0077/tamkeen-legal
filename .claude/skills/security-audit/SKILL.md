---
name: security-audit
description: فحص أمان شامل لبرنامج المساعد القانوني (Supabase + GitHub Pages + الخوادم). استخدمه عند طلب «فحص أمان» أو «security audit» أو قبل نشر تعديل كبير.
---

# فحص أمان المساعد القانوني

افحص بالترتيب، واكتب النتيجة بالعربي: ✅ سليم / ⚠️ يحتاج إصلاح (مع الخطورة والإصلاح المقترح). لا تغيّر قاعدة البيانات أو تنشر شيئًا قبل موافقة المستخدم، ولا تنسخ بيانات حقيقية (قضايا، هويات، أسماء) في التقرير.

## 1) قاعدة البيانات (مشروع Supabase qimtlfvgpvpualtqimam)
- `get_advisors` نوع security: اذكر كل تحذير WARN/ERROR.
- RLS مفعّل على كل جداول `public` و`wholesale_private`؛ سياسات `records` و`storage.objects` (bucket `files`) مبنية على `my_role()`: القراءة لأي عضو، الكتابة لـ owner/editor فقط.
- كل دالة `SECURITY DEFINER`: تأكد أن لها `search_path` ثابت، وأن دوال الإدارة (`tl_admin_*`، `tl_resolve_request`، `tl_access_requests`، `access_log_list`) تبدأ بفحص `tl_is_owner()` أو `my_role()='owner'`، وأن `tl_wholesale` يفحص `wholesale_private.staff`.
- الدوال المتاحة لـ anon (`tl_request_access`، `keepalive`، `tl_is_owner`) يجب أن تبقى محدودة (تحقق مدخلات، حد للطلبات، بدون إرجاع بيانات).
- `tl_digest_check` متاحة لـ service_role فقط.

## 2) الخوادم (Edge Functions و Cloudflare)
- `ai`: `verify_jwt=true` + فحص `my_role()` + تقييد origin.
- `daily-digest`: `verify_jwt=false` لكن تتحقق من ترويسة `x-digest-secret` عبر Vault؛ جرّب استدعاءً بسر خاطئ ويجب أن يرجع 403.
- `server/worker.js`: origin محدد + `APP_TOKEN` + المفتاح من أسرار Cloudflare فقط.
- لا مفاتيح في المستودع: `git ls-files | xargs grep -nE "sk-ant-|re_[A-Za-z0-9]{20}|eyJhbGciOi"`.

## 3) الواجهة (index.html والسكربتات المساعدة)
- كل `innerHTML` يحتوي متغيرات يجب أن يكون مُهرَّبًا (`&<>"`)؛ الأفضل `h()`/`textContent`.
- المكتبات الخارجية بإصدارات مثبتة (cdnjs/jsdelivr).
- طلبات الذكاء الاصطناعي: فقط الحقول/السجلات التي اختارها المستخدم ومع معاينة الإخفاء (انظر CLAUDE.md).
- الملخصات المرسلة خارج البرنامج (واتساب/بريد): أعداد ومواعيد وأرقام مرجعية فقط.

## 4) الحساب والإعدادات
- Leaked password protection في Supabase Auth (يفعّله المالك من اللوحة).
- المستخدمون في `members` وأدوارهم منطقية؛ لا حسابات قديمة لموظفين تركوا.

## 5) الاختبارات
- `node --test tests/*.test.cjs` و `node --test server/memory/*.test.mjs`.

اختم بجدول: البند · الحالة · الخطورة · الإصلاح · من ينفذه (Claude بعد الموافقة / المالك من اللوحة).
