// خادم المساعد القانوني — يمرر طلبات المستشار الذكي إلى Claude ويحفظ المفتاح سرًا.
// الأسرار المطلوبة (تُضاف من لوحة Cloudflare، لا تُكتب هنا):
//   ANTHROPIC_API_KEY : مفتاح Anthropic API
//   APP_TOKEN         : رمز دخول تختاره أنت، وتكتبه في إعدادات البرنامج
const ALLOWED_ORIGIN = 'https://ahmadayash0077.github.io';
const MODELS = { default: 'claude-sonnet-5-5', complex: 'claude-opus-5-5' };
const MAX_TOKENS = 8000;

function cors(origin) {
  return {
    'Access-Control-Allow-Origin': origin === ALLOWED_ORIGIN ? origin : ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type, x-app-token',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}
const json = (obj, status, origin) => new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...cors(origin) } });

export default {
  async fetch(req, env) {
    const origin = req.headers.get('origin') || '';
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(origin) });
    if (req.method !== 'POST') return json({ error: 'method' }, 405, origin);
    if (origin !== ALLOWED_ORIGIN) return json({ error: 'origin' }, 403, origin);
    const tok = req.headers.get('x-app-token') || '';
    if (!env.APP_TOKEN || tok.length !== env.APP_TOKEN.length || tok !== env.APP_TOKEN) return json({ error: 'not_granted' }, 401, origin);
    if (!env.ANTHROPIC_API_KEY) return json({ error: 'no_key' }, 500, origin);
    let body;
    try { body = await req.json(); } catch { return json({ error: 'bad_json' }, 400, origin); }
    if (body.ping) return json({ ok: true }, 200, origin);
    const content = [];
    for (const im of (body.images || []).slice(0, 4)) {
      if (/^image\/(png|jpeg|webp|gif)$/.test(im.type) && typeof im.data === 'string' && im.data.length < 7_000_000)
        content.push({ type: 'image', source: { type: 'base64', media_type: im.type, data: im.data } });
    }
    const prompt = String(body.prompt || '');
    if (!prompt || prompt.length > 600000) return json({ error: 'prompt_too_large' }, 400, origin);
    content.push({ type: 'text', text: prompt });
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: MODELS[body.tier] || MODELS.default, max_tokens: MAX_TOKENS, messages: [{ role: 'user', content }] }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) return json({ error: r.status === 429 ? 'rate_limited' : 'upstream', detail: data?.error?.message || '' }, r.status === 429 ? 429 : 502, origin);
    const text = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
    return json({ text, usage: data.usage || null }, 200, origin);
  },
};
