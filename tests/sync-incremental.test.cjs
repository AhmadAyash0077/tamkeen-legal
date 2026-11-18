'use strict';
// المزامنة التزايدية: تُستخرج دوال loadAll/loadSince من index.html وتُشغَّل على قاعدة وهمية في الذاكرة (بيانات اصطناعية فقط).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const src = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const a = src.indexOf("let syncCursor=''");
const b = src.indexOf('function idbAll(');
assert.ok(a > 0 && b > a, 'تعذر العثور على كود المزامنة');
const code = src.slice(a, b);

function fakeDb(rows) {
  const log = [];
  const sb = {
    from() {
      const q = { filters: [], orders: [], from: 0, to: Infinity };
      const api = {
        select() { return api; },
        eq(c, v) { q.filters.push(['eq', c, v]); return api; },
        gte(c, v) { q.filters.push(['gte', c, v]); return api; },
        order(c) { q.orders.push(c); return api; },
        range(f, t) { q.from = f; q.to = t; return api; },
        then(res, rej) {
          let out = rows.filter(r => q.filters.every(([op, c, v]) => op === 'eq' ? r[c] === v : r[c] >= v));
          for (const c of [...q.orders].reverse()) out = [...out].sort((x, y) => (x[c] < y[c] ? -1 : x[c] > y[c] ? 1 : 0));
          const page = out.slice(q.from, q.to + 1).map(r => ({ path: r.path, data: r.data, updated_at: r.updated_at }));
          log.push({ filters: q.filters, returned: page.length });
          return Promise.resolve({ data: page, error: null }).then(res, rej);
        }
      };
      return api;
    }
  };
  return { sb, log };
}
const WS = '00000000-0000-0000-0000-000000000001';
const row = (p, n, at) => ({ owner: WS, path: p, data: { n }, updated_at: at });
function make(rows) {
  const { sb, log } = fakeDb(rows);
  const mem = new Map();
  const notified = [];
  const f = new Function('sb', 'mem', 'WS', 'notify', code + '; return { loadAll, loadSince, cursor: () => syncCursor };');
  return { api: f(sb, mem, WS, ps => notified.push(...ps)), mem, notified, log, rows };
}

test('التحميل الكامل يملأ الذاكرة ويضبط المؤشر على أحدث توقيت خادم', async () => {
  const t = make([row('cases/1', 1, '2026-11-01T10:00:00.000Z'), row('cases/2', 2, '2026-11-02T10:00:00.000Z')]);
  await t.api.loadAll();
  assert.equal(t.mem.size, 2);
  assert.equal(t.api.cursor(), '2026-11-02T10:00:00.000Z');
});

test('التحديث التزايدي يجلب المتغيّر فقط ولا يلمس الباقي', async () => {
  const t = make([row('cases/1', 1, '2026-11-01T10:00:00.000Z'), row('cases/2', 2, '2026-11-02T10:00:00.000Z')]);
  await t.api.loadAll();
  t.notified.length = 0; t.log.length = 0;
  t.rows.push(row('cases/3', 3, '2026-11-03T10:00:00.000Z'));
  t.rows.find(r => r.path === 'cases/1').data = { n: 11 };
  t.rows.find(r => r.path === 'cases/1').updated_at = '2026-11-03T11:00:00.000Z';
  await t.api.loadSince();
  assert.deepEqual([...t.notified].sort(), ['cases/1', 'cases/3']);
  assert.deepEqual(t.mem.get('cases/1'), { n: 11 });
  assert.deepEqual(t.mem.get('cases/3'), { n: 3 });
  assert.equal(t.mem.get('cases/2').n, 2);
  assert.equal(t.api.cursor(), '2026-11-03T11:00:00.000Z');
  // الاستعلام استخدم مرشّح الوقت (المؤشر ناقص دقيقة)، لا تحميلًا كاملًا
  const gte = t.log[0].filters.find(f => f[0] === 'gte');
  assert.ok(gte, 'لا مرشح زمني في الاستعلام التزايدي');
  assert.equal(gte[2], '2026-11-02T09:59:00.000Z');
});

test('عدم وجود تغييرات = لا إشعارات', async () => {
  const t = make([row('cases/1', 1, '2026-11-01T10:00:00.000Z')]);
  await t.api.loadAll();
  t.notified.length = 0;
  await t.api.loadSince();
  assert.equal(t.notified.length, 0);
});

test('التزايدي لا يحذف شيئًا، والحذف يُضبط بالتحميل الكامل', async () => {
  const t = make([row('cases/1', 1, '2026-11-01T10:00:00.000Z'), row('cases/2', 2, '2026-11-02T10:00:00.000Z')]);
  await t.api.loadAll();
  t.rows.splice(0, 1); // حُذف cases/1 من القاعدة
  await t.api.loadSince();
  assert.ok(t.mem.has('cases/1'), 'التزايدي لا يحذف');
  await t.api.loadAll();
  assert.ok(!t.mem.has('cases/1'), 'الكامل يحذف المحذوف');
});

test('أكثر من صفحة (2500 تعديل) تُجلب كلها', async () => {
  const rows = [row('cases/0', 0, '2026-11-01T00:00:00.000Z')];
  const t = make(rows);
  await t.api.loadAll();
  for (let i = 1; i <= 2500; i++) rows.push(row('docs/' + i, i, '2026-11-05T00:' + String(Math.floor(i / 60) % 60).padStart(2, '0') + ':' + String(i % 60).padStart(2, '0') + '.000Z'));
  t.notified.length = 0;
  await t.api.loadSince();
  assert.equal(t.notified.length, 2500);
  assert.equal(t.mem.size, 2501);
});

test('بدون مؤشر يرجع للتحميل الكامل', async () => {
  const t = make([row('cases/1', 1, '2026-11-01T10:00:00.000Z')]);
  await t.api.loadSince();
  assert.equal(t.mem.size, 1);
  assert.equal(t.api.cursor(), '2026-11-01T10:00:00.000Z');
});
