// API pro ukládání dat aplikace do Cloudflare D1. Statické soubory obsluhuje ASSETS.
// Data jsou chráněná heslem (secret APP_PASSWORD), posílá se v hlavičce X-Password.

const KEYS = ['settings', 'catalog', 'orders', 'quotes', 'invoices', 'current'];

const json = (obj, status = 200) => new Response(JSON.stringify(obj), {
  status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
});

async function ensureTable(db) {
  await db.prepare('CREATE TABLE IF NOT EXISTS store (k TEXT PRIMARY KEY, v TEXT NOT NULL, updated INTEGER NOT NULL)').run();
}

function timingSafeEqual(a, b) {
  const x = new TextEncoder().encode(a), y = new TextEncoder().encode(b);
  if (x.length !== y.length) return false;
  let r = 0;
  for (let i = 0; i < x.length; i++) r |= x[i] ^ y[i];
  return r === 0;
}

async function handleApi(request, env) {
  if (!env.APP_PASSWORD) return json({ error: 'Na serveru není nastavené heslo (APP_PASSWORD).' }, 500);
  if (!env.DB) return json({ error: 'Chybí databáze D1 (binding DB).' }, 500);
  const pw = request.headers.get('x-password') || '';
  if (!timingSafeEqual(pw, env.APP_PASSWORD)) return json({ error: 'Špatné heslo' }, 401);

  await ensureTable(env.DB);
  const url = new URL(request.url);

  if (url.pathname === '/api/data' && request.method === 'GET') {
    const { results } = await env.DB.prepare('SELECT k, v, updated FROM store').all();
    if (!results.length) return json({ data: null, updated: 0 });
    const data = {};
    let updated = 0;
    for (const r of results) {
      if (r.k === '_meta') { updated = Number(JSON.parse(r.v).updated) || 0; continue; }
      data[r.k] = JSON.parse(r.v);
    }
    return json({ data, updated });
  }

  if (url.pathname === '/api/data' && request.method === 'PUT') {
    let body;
    try { body = await request.json(); } catch { return json({ error: 'Neplatná data' }, 400); }
    const { data, updated, base, force } = body || {};
    if (!data || typeof data !== 'object' || !updated) return json({ error: 'Neplatná data' }, 400);

    // Ochrana proti přepsání novějších dat z jiného zařízení
    const meta = await env.DB.prepare("SELECT v FROM store WHERE k = '_meta'").first();
    const serverUpdated = meta ? Number(JSON.parse(meta.v).updated) || 0 : 0;
    if (!force && serverUpdated && base !== serverUpdated) return json({ error: 'conflict', updated: serverUpdated }, 409);

    const stmts = KEYS.filter(k => k in data).map(k =>
      env.DB.prepare('INSERT INTO store (k, v, updated) VALUES (?1, ?2, ?3) ON CONFLICT(k) DO UPDATE SET v = ?2, updated = ?3')
        .bind(k, JSON.stringify(data[k]), updated));
    stmts.push(env.DB.prepare("INSERT INTO store (k, v, updated) VALUES ('_meta', ?1, ?2) ON CONFLICT(k) DO UPDATE SET v = ?1, updated = ?2")
      .bind(JSON.stringify({ updated }), updated));
    await env.DB.batch(stmts);
    return json({ ok: true, updated });
  }

  return json({ error: 'Nenalezeno' }, 404);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
      try { return await handleApi(request, env); }
      catch (e) { return json({ error: String(e && e.message || e) }, 500); }
    }
    return env.ASSETS.fetch(request);
  },
};
