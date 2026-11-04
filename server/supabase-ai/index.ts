// خادم المساعدين الذكيين على Supabase Edge Functions (اسم الدالة: ai)
// السر المطلوب: ANTHROPIC_API_KEY  — يُضاف من Supabase ← Edge Functions ← Secrets
// الدخول: جلسة مستخدم مسجّل في البرنامج فقط (members)، بدون أي رمز إضافي.
import { createClient } from 'npm:@supabase/supabase-js@2';
const ALLOWED_ORIGIN = 'https://ahmadayash0077.github.io';
const MODELS: Record<string, string> = { default: 'claude-sonnet-5-5', complex: 'claude-opus-5-5' };
const MAX_TOKENS = 8000;
const cors = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Max-Age': '86400',
  'Vary': 'Origin',
};
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...cors } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') return json({ error: 'method' }, 405);
  const origin = req.headers.get('origin') || '';
  if (origin !== ALLOWED_ORIGIN) return json({ error: 'origin' }, 403);
  const auth = req.headers.get('authorization') || '';
  if (!auth.startsWith('Bearer ')) return json({ error: 'not_granted' }, 401);
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } });
  const { data: role } = await sb.rpc('my_role');
  if (!role) return json({ error: 'not_granted' }, 401);
  const key = Deno.env.get('ANTHROPIC_API_KEY');
  if (!key) return json({ error: 'no_key' }, 503);
  let body: any;
  try { body = await req.json(); } catch { return json({ error: 'bad_json' }, 400); }
  if (body.ping) return json({ ok: true });
  const content: any[] = [];
  for (const im of (body.images || []).slice(0, 4)) {
    if (/^image\/(png|jpeg|webp|gif)$/.test(im.type) && typeof im.data === 'string' && im.data.length < 7_000_000)
      content.push({ type: 'image', source: { type: 'base64', media_type: im.type, data: im.data } });
  }
  const prompt = String(body.prompt || '');
  if (!prompt || prompt.length > 600000) return json({ error: 'prompt_too_large' }, 400);
  content.push({ type: 'text', text: prompt });
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: MODELS[body.tier] || MODELS.default, max_tokens: MAX_TOKENS, messages: [{ role: 'user', content }] }),
  });
  const data: any = await r.json().catch(() => ({}));
  if (!r.ok) return json({ error: r.status === 429 ? 'rate_limited' : 'upstream', detail: data?.error?.message || '' }, r.status === 429 ? 429 : 502);
  const text = (data.content || []).filter((b: any) => b.type === 'text').map((b: any) => b.text).join('');
  return json({ text, usage: data.usage || null });
});
