// ملخص الشؤون القانونية اليومي بالبريد — يُستدعى من pg_cron فقط.
// - التحقق: ترويسة x-digest-secret تُقارن بسر في Vault عبر الدالة public.tl_digest_check (لا تُقبل أي استدعاءات أخرى).
// - المحتوى: أعداد ومواعيد وأرقام مرجعية فقط (رقم القضية/الطلب، المحكمة، الجهة) — بدون أسماء أشخاص أو هويات أو جوالات.
// - الإرسال: Resend (RESEND_API_KEY) إلى DIGEST_TO فقط. ?dry=1 يرجع الملخص بدون إرسال.
import { createClient } from "jsr:@supabase/supabase-js@2";

const APP_URL = "https://ahmadayash0077.github.io/tamkeen-legal/";
const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

type Rec = Record<string, any> & { id: string };
const dateG = (v: any): string | null => {
  if (!v) return null;
  const s = typeof v === "string" ? v : v.g;
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null;
};
const todayRiyadh = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh" }).format(new Date());
const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
const dm = (g: string) => g.split("-").reverse().join("/");
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

async function load(coll: string): Promise<Rec[]> {
  const out: Rec[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from("records").select("path,data").like("path", coll + "/%").range(from, from + 999);
    if (error) throw error;
    for (const r of data || []) {
      const d = r.data || {};
      if (d.deleted) continue;
      out.push({ ...d, id: String(r.path).slice(coll.length + 1) });
    }
    if (!data || data.length < 1000) break;
  }
  return out;
}

function build(today: string, col: Record<string, Rec[]>) {
  const rel = (g: string) => { const n = daysBetween(today, g); return n === 0 ? " (اليوم)" : n === 1 ? " (غدًا)" : ""; };
  const within = (g: string | null, lo: number, hi: number) => g != null && daysBetween(today, g) >= lo && daysBetween(today, g) <= hi;
  const cases = new Map(col.cases.map((c) => [c.id, c]));
  const hs = col.hearings.filter((r) => within(dateG(r.date), 0, 7))
    .sort((a, b) => (dateG(a.date)! + (a.time || "")).localeCompare(dateG(b.date)! + (b.time || "")));
  const ts = col.taradi.filter((r) => within(dateG(r.date), 0, 7) && !["تم الصلح", "تعذر الصلح", "ملغاة", "محولة إلى قضية"].includes(r.status || ""))
    .sort((a, b) => (dateG(a.date)! + (a.time || "")).localeCompare(dateG(b.date)! + (b.time || "")));
  const late: [string, Rec][] = [], soon: [string, Rec][] = [];
  for (const v of col.violations) {
    if (["مسدد", "مسددة", "ملغاة", "ملغى"].includes(v.status || "")) continue;
    const ds = ["objDeadline", "payDeadline", "deadline"].map((k) => dateG(v[k])).filter(Boolean).sort() as string[];
    if (!ds.length) continue;
    const n = daysBetween(today, ds[0]);
    if (n < 0) late.push([ds[0], v]); else if (n <= 7) soon.push([ds[0], v]);
  }
  const noRes = col.hearings.filter((r) => within(dateG(r.date), -30, -1) && !String(r.result || "").trim());
  const inst = col.contracts.filter((c) => (c.fileKind === "تركيب" || c.ctype === "تركيب") && !c.renewedTo && within(dateG(c.end), 0, 30));

  const grp = (arr: [string, Rec][]) => {
    const m = new Map<string, { g: string; a: string; n: number }>();
    for (const [g, v] of arr) { const a = /غير\s*مذكور/.test(v.authority || "") ? "" : (v.authority || ""); const k = g + "|" + a; const e = m.get(k) || { g, a, n: 0 }; e.n++; m.set(k, e); }
    return [...m.values()].sort((x, y) => x.g.localeCompare(y.g));
  };
  const sections: { title: string; items: string[] }[] = [];
  if (hs.length) sections.push({ title: "⚖️ جلسات الأسبوع", items: hs.map((r) => { const g = dateG(r.date)!; const c = cases.get(r.caseId); return `${dm(g)}${rel(g)}${r.time ? " " + r.time : ""}${c?.caseNo ? " — قضية " + c.caseNo : ""}${(c?.court || r.place) ? " — " + (c?.court || r.place) : ""}`; }) });
  if (ts.length) sections.push({ title: "🤝 جلسات تراضي", items: ts.map((r) => { const g = dateG(r.date)!; return `${dm(g)}${rel(g)}${r.time ? " " + r.time : ""}${r.reqNo ? " — طلب " + r.reqNo : ""}`; }) });
  if (late.length) sections.push({ title: "⚠️ مهل مخالفات متأخرة", items: grp(late).map((e) => `${dm(e.g)} — ${e.n} مخالفة${e.a ? " (" + e.a + ")" : ""}`) });
  if (soon.length) sections.push({ title: "⏳ مهل مخالفات خلال 7 أيام", items: grp(soon).map((e) => `${dm(e.g)}${rel(e.g)} — ${e.n} مخالفة${e.a ? " (" + e.a + ")" : ""}`) });
  if (noRes.length) sections.push({ title: "📝 جلسات مضت بلا نتيجة", items: [`${noRes.length} جلسة خلال آخر 30 يومًا — سجّل نتائجها`] });
  if (inst.length) sections.push({ title: "🔁 عقود تركيب تنتهي خلال 30 يومًا", items: inst.map((c) => { const g = dateG(c.end)!; return `${dm(g)}${c.ref_no ? " — عقد " + c.ref_no : ""}`; }) });
  const counts = { hearings: hs.length, taradi: ts.length, late: late.length, soon: soon.length, noResult: noRes.length, install: inst.length };
  return { sections, counts };
}

function html(today: string, r: ReturnType<typeof build>) {
  const c = r.counts;
  const kpi = (t: string, n: number, warn = false) => `<td style="padding:10px 6px;text-align:center;border:1px solid #e6e2d3;border-radius:10px;background:${warn && n ? "#fff4f2" : "#faf8f1"}"><div style="font:700 22px Arial;color:${warn && n ? "#c0392b" : "#1d2a44"}">${n}</div><div style="font:12px Arial;color:#6b6b6b">${t}</div></td>`;
  const body = r.sections.length
    ? r.sections.map((s) => `<h3 style="font:700 16px Arial;color:#1d2a44;margin:22px 0 8px">${esc(s.title)}</h3><ul style="margin:0;padding:0 18px 0 0;font:14px/1.9 Arial;color:#222">${s.items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>`).join("")
    : `<p style="font:15px Arial;color:#1f7a4a;margin:22px 0">✅ لا جلسات أو مهل خلال الأسبوع القادم.</p>`;
  return `<!doctype html><html lang="ar" dir="rtl"><body style="margin:0;background:#f3f1ea;padding:20px">
<div style="max-width:640px;margin:auto;background:#fff;border-radius:14px;padding:24px;border-top:6px solid #b8955a" dir="rtl">
<div style="font:700 20px Arial;color:#1d2a44">ملخص الشؤون القانونية</div>
<div style="font:13px Arial;color:#6b6b6b;margin-top:4px">شركة تمكين الدولية للأجهزة المنزلية — ${dm(today)}</div>
<table role="presentation" style="width:100%;border-spacing:6px;margin-top:16px"><tr>${kpi("جلسات الأسبوع", c.hearings)}${kpi("تراضي", c.taradi)}${kpi("مهل متأخرة", c.late, true)}${kpi("مهل قريبة", c.soon, true)}</tr></table>
${body}
<p style="margin:26px 0 0"><a href="${APP_URL}" style="display:inline-block;background:#1d2a44;color:#fff;text-decoration:none;font:700 14px Arial;padding:10px 18px;border-radius:10px">فتح المساعد القانوني</a></p>
<p style="font:11px Arial;color:#999;margin-top:18px">رسالة تلقائية تحتوي أعدادًا ومواعيد وأرقامًا مرجعية فقط. التفاصيل داخل البرنامج بعد تسجيل الدخول.</p>
</div></body></html>`;
}

Deno.serve(async (req) => {
  try {
    const secret = req.headers.get("x-digest-secret") || "";
    const { data: ok, error: e1 } = await sb.rpc("tl_digest_check", { p: secret });
    if (e1 || ok !== true) return new Response(JSON.stringify({ error: "forbidden" }), { status: 403 });

    const today = todayRiyadh();
    const [cases, hearings, taradi, violations, contracts] = await Promise.all(["cases", "hearings", "taradi", "violations", "contracts"].map(load));
    const r = build(today, { cases, hearings, taradi, violations, contracts });
    const dry = new URL(req.url).searchParams.get("dry") === "1";
    if (dry) return Response.json({ today, ...r });

    const key = Deno.env.get("RESEND_API_KEY"), to = Deno.env.get("DIGEST_TO");
    if (!key || !to) return Response.json({ error: "missing_config", need: [!key && "RESEND_API_KEY", !to && "DIGEST_TO"].filter(Boolean) }, { status: 503 });
    const from = Deno.env.get("DIGEST_FROM") || "المساعد القانوني <onboarding@resend.dev>";
    const c = r.counts;
    const subject = `ملخص الشؤون القانونية ${dm(today)} — جلسات ${c.hearings} · مهل متأخرة ${c.late}`;
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: to.split(",").map((s) => s.trim()).filter(Boolean), subject, html: html(today, r) }),
    });
    const out = await res.json().catch(() => ({}));
    return Response.json({ sent: res.ok, status: res.status, id: out.id, error: res.ok ? undefined : out.message, counts: c }, { status: res.ok ? 200 : 502 });
  } catch (e) {
    return Response.json({ error: String((e as Error).message || e) }, { status: 500 });
  }
});
