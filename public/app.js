'use strict';

// ---------- pomocné ----------
const $ = (s, el = document) => el.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const kc = n => (Math.round((Number(n) || 0) * 100) / 100).toLocaleString('cs-CZ', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + ' Kč';
const num = v => { const n = parseFloat(String(v).replace(/\s/g, '').replace(',', '.')); return isNaN(n) ? 0 : n; };
const uid = () => Math.random().toString(36).slice(2, 10);
const today = () => new Date().toISOString().slice(0, 10);
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };
const fmtDate = d => d ? new Date(d).toLocaleDateString('cs-CZ') : '';
const WORK_CATS = CATS.filter(c => c[0] !== 'vlastni');
const ALL_CATS = [...WORK_CATS, ...MAT_CATS, ['vlastni', 'Vlastní položky']];
const catName = id => (ALL_CATS.find(c => c[0] === id) || [, id])[1];
const isMat = it => !!it && (!!it.material || String(it.cat).startsWith('mat-'));
const r2 = n => Math.round(n * 100) / 100;

// ---------- data ----------
const KEY = 'tata-ploty-v1';

function newOrder() {
  return { id: uid(), name: '', date: today(), place: '', km: 0, note: '', beton: { m3: '', price: '' },
    customer: { name: '', address: '', phone: '', email: '', ico: '', dic: '' }, lines: [] };
}

function load() {
  let d = null;
  try { d = JSON.parse(localStorage.getItem(KEY)); } catch (e) { /* nic */ }
  d = d || {};
  const oldVer = d.settings ? (d.settings.settingsVersion || 1) : 2;
  d.settings = { ...DEFAULT_SETTINGS, ...(d.settings || {}), supplier: { ...DEFAULT_SETTINGS.supplier, ...(d.settings?.supplier || {}) } };
  if (oldVer < 2) { d.settings.markupBeton = false; d.settings.settingsVersion = 2; } // beton bez přirážky
  const cat = d.catalog || [];
  const ids = new Set(cat.map(i => i.id));
  for (const i of [...DEFAULT_CATALOG, ...DEFAULT_MATERIALS]) if (!ids.has(i.id)) cat.push(JSON.parse(JSON.stringify(i)));
  d.catalog = cat.filter(i => i.id !== 'beton-m3'); // beton je teď samostatná sekce zakázky
  d.orders = d.orders || [];
  d.invoices = d.invoices || [];
  d.quotes = d.quotes || [];
  d.current = d.current || newOrder();
  return d;
}
let S = load();
function save() {
  S._updated = Date.now();
  try { localStorage.setItem(KEY, JSON.stringify(S)); }
  catch (e) { alert('Nepodařilo se uložit data: ' + e.message); }
  schedulePush();
}

// ---------- ukládání na server (Cloudflare Worker + D1) ----------
const API = /^https?:$/.test(location.protocol) ? '/api/data' : null;
const PW_KEY = 'tata-pw', BASE_KEY = 'tata-base';
const SYNC_KEYS = ['settings', 'catalog', 'orders', 'quotes', 'invoices', 'current'];
const sync = { state: API ? 'connecting' : 'local', msg: '', timer: null, busy: false };
const getBase = () => Number(localStorage.getItem(BASE_KEY)) || 0;
const setBase = v => localStorage.setItem(BASE_KEY, String(v));
const dirty = () => (S._updated || 0) > getBase();

function setSync(state, msg = '') {
  sync.state = state; sync.msg = msg;
  const el = $('#sync'); if (!el) return;
  const t = { local: '💾 jen v prohlížeči', connecting: '⏳ připojuji…', saving: '⏳ ukládám…', ok: '☁️ uloženo', error: '⚠️ neuloženo na server', offline: '⚠️ offline' }[state];
  el.textContent = t; el.title = msg || ''; el.className = 'sync s-' + state;
}
function syncText() {
  if (!API) return 'Stránka je otevřená ze souboru – data se ukládají jen v tomhle prohlížeči. Po nasazení na Cloudflare se ukládají na server.';
  if (sync.state === 'local') return 'Server nemá úložiště (API nenalezeno) – data jsou jen v tomhle prohlížeči.';
  return 'Data se ukládají na server, takže jsou stejná na každém zařízení. Stav: ' + ($('#sync') ? $('#sync').textContent : '') + (sync.msg ? ' – ' + esc(sync.msg) : '') + '. Záloha do souboru se ale hodí i tak.';
}
async function apiCall(method, body) {
  return fetch(API, { method, headers: { 'content-type': 'application/json', 'x-password': localStorage.getItem(PW_KEY) || '' },
    body: body ? JSON.stringify(body) : undefined });
}
function askPassword(wrong) {
  const p = prompt((wrong ? 'Špatné heslo. ' : '') + 'Zadej heslo k aplikaci:');
  if (p === null) return false;
  localStorage.setItem(PW_KEY, p); return true;
}
function applyServer(data, updated) {
  const d = { ...data, _updated: updated };
  localStorage.setItem(KEY, JSON.stringify(d)); setBase(updated);
  S = load(); render();
}
async function resolveConflict(serverData, serverUpdated) {
  if (confirm('Na serveru jsou novější data (z jiného zařízení).\n\nOK = načíst data ze serveru (změny z tohoto zařízení od posledního uložení se zahodí)\nZrušit = přepsat server daty z tohoto zařízení')) {
    applyServer(serverData, serverUpdated); setSync('ok');
  } else await push(true);
}
async function pull(wrong) {
  if (!API) return setSync('local');
  try {
    const r = await apiCall('GET');
    if (r.status === 401) { if (askPassword(wrong || !!localStorage.getItem(PW_KEY))) return pull(true); return setSync('error', 'nepřihlášeno'); }
    if (r.status === 404 || r.status === 405) return setSync('local');
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return setSync('error', j.error || ('HTTP ' + r.status));
    if (!j.data || !j.updated) { setBase(0); return push(true); }      // prázdný server → nahraj místní data
    if (j.updated === getBase()) { if (dirty()) return push(); return setSync('ok'); }
    if (!dirty()) { applyServer(j.data, j.updated); return setSync('ok'); }
    await resolveConflict(j.data, j.updated);
  } catch (e) { setSync('offline', String(e.message || e)); }
}
function schedulePush() {
  if (!API || sync.state === 'local') return;
  clearTimeout(sync.timer); setSync('saving');
  sync.timer = setTimeout(() => push(), 800);
}
async function push(force) {
  if (!API) return;
  if (sync.busy) { clearTimeout(sync.timer); sync.timer = setTimeout(() => push(force), 500); return; }
  sync.busy = true;
  try {
    if (!S._updated) S._updated = Date.now();
    const data = {}; SYNC_KEYS.forEach(k => { data[k] = S[k]; });
    const r = await apiCall('PUT', { data, updated: S._updated, base: getBase(), force: !!force });
    const j = await r.json().catch(() => ({}));
    if (r.status === 401) { sync.busy = false; if (askPassword(true)) return push(force); return setSync('error', 'nepřihlášeno'); }
    if (r.status === 409) {
      sync.busy = false;
      const g = await apiCall('GET'); const gj = await g.json();
      return resolveConflict(gj.data, gj.updated);
    }
    if (!r.ok) return setSync('error', j.error || ('HTTP ' + r.status));
    setBase(j.updated); setSync(dirty() ? 'saving' : 'ok');
  } catch (e) { setSync('offline', String(e.message || e)); }
  finally { sync.busy = false; }
}
// Když se vrátíš na stránku (třeba z mobilu), načti změny z jiných zařízení
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && API && !sync.busy && !dirty()) pull(); });
window.addEventListener('online', () => pull());

// ---------- výpočty ----------
const item = id => S.catalog.find(i => i.id === id);
const mk = () => 1 + num(S.settings.markup) / 100;
const tierFor = q => (q <= 25 ? 'A' : q <= 150 ? 'B' : 'C');
const basePrice = (it, tier) => it.tiered ? num(it.prices[tier]) : num(it.price);
const matMk = () => 1 + num(S.settings.matMarkup) / 100;
const finalPrice = (it, tier) => isMat(it) ? r2(basePrice(it, tier) * matMk()) : Math.round(basePrice(it, tier) * mk());

function lineCalc(l) {
  const it = l.itemId ? item(l.itemId) : null;
  let tier = null;
  if (it && it.tiered) tier = l.tier && l.tier !== 'auto' ? l.tier : tierFor(num(l.qty));
  const hasOverride = l.price !== null && l.price !== undefined && l.price !== '';
  const unit = hasOverride ? num(l.price) : (it ? finalPrice(it, tier) : 0);
  let total = r2(unit * num(l.qty));
  let minApplied = false;
  if (it && it.min && !hasOverride) {
    const m = Math.round(it.min * mk());
    if (total > 0 && total < m) { total = m; minApplied = true; }
  }
  return { it, tier, unit, total, minApplied, hasOverride };
}

function lineName(l) {
  if (l.name) return l.name;
  const it = l.itemId && item(l.itemId);
  const n = it ? it.name : '(položka smazána z ceníku)';
  return l.height ? `${n}, výška ${l.height} cm` : n;
}

// ---------- beton ----------
const FENCE_BY_ITEM = {};
for (const ft of Object.values(FENCE_TYPES)) for (const [, id] of ft.variants) FENCE_BY_ITEM[id] = ft;

function betonEstimate(o) {
  let posts = 0, fixed = 0;
  for (const l of o.lines) {
    const q = num(l.qty);
    if (!l.itemId || !q || NO_BETON.includes(l.itemId)) continue;
    const ft = FENCE_BY_ITEM[l.itemId];
    if (ft) posts += Math.ceil(q / ft.spacing) + 1; // sloupky = počet polí + 1
    else if (POSTS_PER_ITEM[l.itemId]) posts += Math.ceil(POSTS_PER_ITEM[l.itemId] * q);
    else if (BETON_FIXED[l.itemId]) fixed += BETON_FIXED[l.itemId] * q;
  }
  const m3 = Math.round((posts * num(S.settings.betonPerPost) + fixed) * 100) / 100;
  return { posts, fixed, m3 };
}

function betonCalc(o) {
  const b = o.beton || { m3: '', price: '' };
  const e = betonEstimate(o);
  const est = e.m3;
  const manual = b.m3 !== '' && b.m3 !== null && b.m3 !== undefined;
  const m3 = manual ? num(b.m3) : est;
  const basePrice = b.price !== '' && b.price !== null && b.price !== undefined ? num(b.price) : num(S.settings.betonPrice);
  const unit = S.settings.markupBeton ? Math.round(basePrice * mk()) : basePrice;
  return { est, e, manual, m3, basePrice, unit, total: Math.round(m3 * unit * 100) / 100 };
}

// Vrátí všechny řádky zakázky v konečné podobě (pro tabulku, nabídku i fakturu)
function orderRows(o) {
  const s = S.settings;
  const rows = o.lines.map(l => {
    const c = lineCalc(l);
    const it = c.it;
    let name = lineName(l);
    if (c.minApplied) name += ' (minimální cena)';
    return { line: l, name, unit: l.unit || (it ? it.unit : 'ks'), qty: num(l.qty),
      price: c.minApplied ? c.total / (num(l.qty) || 1) : c.unit, total: c.total,
      material: isMat(it) || (!it && l.material), calc: c };
  });
  // nejdřív práce, pak materiál
  rows.sort((a, b) => (a.material ? 1 : 0) - (b.material ? 1 : 0));
  const extra = [];
  const work = rows.filter(r => !r.material).reduce((a, r) => a + r.total, 0);
  if (s.minWorkOn && work > 0) {
    const m = Math.round(num(s.minWork) * mk());
    if (work < m) extra.push({ name: 'Doplatek do minimální ceny montáže', unit: 'ks', qty: 1, price: m - work, total: m - work, auto: true });
  }
  const bc = betonCalc(o);
  if (bc.m3 > 0) extra.push({ name: 'Beton', unit: 'm³', qty: bc.m3, price: bc.unit, total: bc.total, auto: true });
  const km = num(o.km);
  if (km > 0) {
    let t = Math.max(km * num(s.kmRate), num(s.kmMin));
    if (s.markupTransport) t = Math.round(t * mk());
    extra.push({ name: `Doprava (${km} km)`, unit: 'ks', qty: 1, price: t, total: t, auto: true });
  }
  const sum = f => r2(rows.filter(f).reduce((a, r) => a + r.total, 0));
  const parts = { work: sum(r => !r.material), material: sum(r => r.material),
    beton: bc.m3 > 0 ? bc.total : 0, transport: r2(extra.filter(x => x.name.startsWith('Doprava')).reduce((a, x) => a + x.total, 0)),
    minFill: r2(extra.filter(x => x.name.startsWith('Doplatek')).reduce((a, x) => a + x.total, 0)) };
  return { rows, extra, all: [...rows, ...extra], parts };
}

function totals(rows, vatPayer, vatRate) {
  const base = r2(rows.reduce((a, r) => a + num(r.qty) * num(r.price), 0));
  const vat = vatPayer ? Math.round(base * num(vatRate)) / 100 : 0;
  return { base, vat, total: base + vat };
}

// ---------- navigace ----------
let tab = 'zakazka';
let editKind = null, editId = null;
let catFilter = '';
let catGroup = 'work';
let setDraft = null; // rozpracované změny nastavení (null = zamčeno)

function go(t) {
  if (setDraft && t !== 'nastaveni') {
    if (JSON.stringify(setDraft) !== JSON.stringify(S.settings) && !confirm('Máš neuložené změny v nastavení. Zahodit je?')) return;
    setDraft = null;
  }
  tab = t; render(); window.scrollTo(0, 0);
}

function render() {
  const navTab = tab === 'doklad' ? (editKind === 'quote' ? 'nabidky' : 'faktury') : tab;
  document.querySelectorAll('nav button').forEach(b => b.classList.toggle('active', b.dataset.tab === navTab));
  const v = $('#view');
  if (tab === 'zakazka') v.innerHTML = viewOrder();
  else if (tab === 'zakazky') v.innerHTML = viewOrders();
  else if (tab === 'nabidky') v.innerHTML = viewQuotes();
  else if (tab === 'faktury') v.innerHTML = viewInvoices();
  else if (tab === 'doklad') { const h = viewDocEditor(); if (typeof h === 'string') v.innerHTML = h; }
  else if (tab === 'cenik') v.innerHTML = viewCatalog();
  else if (tab === 'nastaveni') v.innerHTML = viewSettings();
}

// ---------- ZAKÁZKA ----------
function viewOrder() {
  const o = S.current;
  const c = o.customer;
  const { rows, extra, all, parts } = orderRows(o);
  const t = totals(all, S.settings.vatPayer, S.settings.vatRate);
  const bc = betonCalc(o);
  if (!o.beton) o.beton = { m3: '', price: '' };
  const saved = S.orders.some(x => x.id === o.id);
  const fenceOpts = Object.entries(FENCE_TYPES).map(([k, v]) => `<option value="${k}">${esc(v.label)}</option>`).join('');
  const gateOpts = Object.entries(GATE_TYPES).map(([k, v]) => `<option value="${k}">${esc(v.label)}</option>`).join('');
  const matCatOpts = MAT_CATS.map(([k, n]) => `<option value="${k}">${esc(n.replace('Materiál – ', ''))}</option>`).join('');
  const catOpts = [...WORK_CATS, ['vlastni', 'Vlastní položky']].map(([k, n]) => `<option value="${k}">${esc(n)}</option>`).join('');

  return `
  <section class="card">
    <div class="row between"><h2>${o.name ? esc(o.name) : 'Nová zakázka'} ${saved ? '<span class="tag">uložená</span>' : ''}</h2>
      <div class="row"><button onclick="app.saveOrder()">💾 Uložit zakázku</button><button class="ghost" onclick="app.newOrder()">+ Nová</button></div></div>
    <div class="grid">
      <label>Název zakázky<input value="${esc(o.name)}" onchange="app.setO('name',this.value)" placeholder="např. Novák – plot 3D"></label>
      <label>Datum<input type="date" value="${esc(o.date)}" onchange="app.setO('date',this.value)"></label>
      <label>Místo realizace<input value="${esc(o.place)}" onchange="app.setO('place',this.value)"></label>
      <label>Doprava – km celkem (tam i zpět)<input type="number" min="0" value="${esc(o.km || '')}" onchange="app.setO('km',this.value)" placeholder="0"></label>
    </div>
    <details ${c.name ? 'open' : ''}><summary>Zákazník</summary>
    <div class="grid">
      <label>Jméno / firma<input value="${esc(c.name)}" onchange="app.setC('name',this.value)"></label>
      <label>Adresa<input value="${esc(c.address)}" onchange="app.setC('address',this.value)"></label>
      <label>Telefon<input value="${esc(c.phone)}" onchange="app.setC('phone',this.value)"></label>
      <label>E-mail<input value="${esc(c.email)}" onchange="app.setC('email',this.value)"></label>
      <label>IČO<input value="${esc(c.ico)}" onchange="app.setC('ico',this.value)"></label>
      <label>DIČ<input value="${esc(c.dic)}" onchange="app.setC('dic',this.value)"></label>
    </div></details>
  </section>

  <section class="card add">
    <h3>🧱 Přidat plot</h3>
    <div class="row wrap">
      <select id="fType" onchange="app.fillFenceVariants()">${fenceOpts}</select>
      <select id="fVar">${fenceVariantOpts('pletivo')}</select>
      <span id="fHeightWrap">${heightOpts('pletivo')}</span>
      <input id="fLen" type="number" min="0" step="0.5" placeholder="délka v m" style="width:120px">
      <button onclick="app.addFence()">Přidat</button>
    </div>
    <h3>🚪 Přidat branku / bránu</h3>
    <div class="row wrap">
      <select id="gType" onchange="app.gateChanged()">${gateOpts}</select>
      <input id="gQty" type="number" min="1" value="1" style="width:70px" title="kusů">
      <span id="gOpts">${gateOptsHtml('branka')}</span>
      <button onclick="app.addGate()">Přidat</button>
    </div>
    <h3>📦 Materiál <span class="small muted">(přirážka ${S.settings.matMarkup} %)</span></h3>
    <div class="row wrap">
      <input id="mSearch" placeholder="🔍 hledat materiál, např. pluto 1530" oninput="app.fillMatItems()" style="min-width:230px">
      <select id="mCat" onchange="$('#mSearch').value='';app.fillMatItems()">${matCatOpts}</select>
      <select id="mItem" style="max-width:460px">${matItemOpts('mat-pletivo', '')}</select>
      <input id="mQty" type="number" min="0" step="1" placeholder="množství" style="width:110px">
      <button onclick="app.addMat()">Přidat</button>
      <button class="ghost" onclick="app.addCustom(true)">+ Vlastní materiál</button>
    </div>
    <h3>📋 Práce z ceníku / vlastní řádek</h3>
    <div class="row wrap">
      <select id="cCat" onchange="app.fillCatItems()">${catOpts}</select>
      <select id="cItem">${catItemOpts('pletivo')}</select>
      <input id="cQty" type="number" min="0" step="0.5" placeholder="množství" style="width:110px">
      <button onclick="app.addFromCat()">Přidat</button>
      <button class="ghost" onclick="app.addCustom()">+ Vlastní řádek</button>
    </div>
  </section>


  <section class="card">
    <h3>🪨 Beton</h3>
    <div class="row wrap">
      <label>Množství (m³)<input type="number" min="0" step="0.01" value="${bc.manual ? esc(o.beton.m3) : ''}" placeholder="${bc.est}" onchange="app.setBeton('m3',this.value)" class="${bc.manual ? 'ovr' : ''}" style="width:120px"></label>
      <label>Cena za m³ z betonárky (Kč)<input type="number" min="0" step="10" value="${esc(o.beton.price)}" placeholder="${S.settings.betonPrice || 'Kč/m³'}" onchange="app.setBeton('price',this.value)" style="width:170px"></label>
      <div class="betonsum">${bc.m3 > 0 ? `<b>${String(bc.m3).replace('.', ',')} m³ × ${kc(bc.unit)} = ${kc(bc.total)}</b>` : '<span class="muted">bez betonu</span>'}
        ${S.settings.markupBeton && bc.basePrice ? `<div class="small muted">vč. přirážky ${S.settings.markup} % (${kc(bc.basePrice)}/m³ bez přirážky)</div>` : ''}</div>
    </div>
    <p class="small muted">Odhad: <b>${bc.e.posts} sloupků × ${String(S.settings.betonPerPost).replace('.', ',')} m³</b>${bc.e.fixed ? ` + patky ${String(bc.e.fixed).replace('.', ',')} m³` : ''} = <b>${String(bc.est).replace('.', ',')} m³</b>.
      ${bc.manual ? '<a href="#" onclick="app.setBeton(\'m3\',\'\');return false">Vrátit odhad</a>' : 'Prázdné pole = použije se odhad, 0 = bez betonu.'}</p>
    ${bc.m3 > 0 && !bc.basePrice ? '<p class="warn">⚠️ Zadej cenu betonu za m³.</p>' : ''}
  </section>

  <section class="card">
    <h3>Položky zakázky</h3>
    ${rows.length || extra.length ? `
    <div class="tablewrap"><table class="lines">
      <thead><tr><th>Položka</th><th>Pásmo</th><th class="r">Množství</th><th>Jedn.</th><th class="r">Cena/j. (s přirážkou)</th><th class="r">Celkem</th><th></th></tr></thead>
      <tbody>
      ${rows.map(r => lineRow(r)).join('')}
      ${extra.map(r => `<tr class="auto"><td>${esc(r.name)}</td><td></td><td class="r">${r.qty}</td><td>${esc(r.unit)}</td><td class="r">${kc(r.price)}</td><td class="r">${kc(r.total)}</td><td></td></tr>`).join('')}
      </tbody>
    </table></div>` : '<p class="muted">Zatím žádné položky. Přidej plot, bránu nebo něco z ceníku nahoře.</p>'}
    <div class="totals">
      ${S.settings.vatPayer ? `<div>Základ <b>${kc(t.base)}</b></div><div>DPH ${S.settings.vatRate} % <b>${kc(t.vat)}</b></div>` : ''}
      <div class="parts small">Práce <b>${kc(parts.work + parts.minFill)}</b> · Materiál <b>${kc(parts.material)}</b> · Beton <b>${kc(parts.beton)}</b> · Doprava <b>${kc(parts.transport)}</b></div>
      <div class="big">Celkem ${S.settings.vatPayer ? 's DPH' : ''} <b>${kc(t.total)}</b></div>
      <div class="muted small">Práce +${S.settings.markup} %, materiál +${S.settings.matMarkup} %${S.settings.markupBeton ? ', beton +' + S.settings.markup + ' %' : ', beton bez přirážky'}. ${S.settings.vatPayer ? '' : 'Neplátce DPH.'}</div>
    </div>
    <label>Poznámka<textarea onchange="app.setO('note',this.value)" rows="2">${esc(o.note)}</textarea></label>
    <div class="row wrap">${orderQuoteButtons(o)}</div>
  </section>`;
}

function orderQuoteButtons(o) {
  const q = o.quoteId && S.quotes.find(x => x.id === o.quoteId);
  if (!q) return `<button onclick="app.quoteFromOrder()">📄 Vytvořit cenovou nabídku</button>`;
  if (q.status === 'vyfakturovana') return `<span class="muted">Nabídka ${esc(q.number)} je už vyfakturovaná.</span>
    <button class="ghost" onclick="app.editDoc('quote','${q.id}')">Otevřít nabídku</button>
    <button onclick="app.quoteFromOrder(true)">📄 Nová cenová nabídka</button>`;
  return `<button onclick="app.updateQuote()">🔄 Aktualizovat nabídku ${esc(q.number)}</button>
    <button class="ghost" onclick="app.editDoc('quote','${q.id}')">Otevřít nabídku ${badge(q.status)}</button>`;
}

function lineRow(r) {
  const l = r.line, c = r.calc;
  const tierSel = c.it && c.it.tiered
    ? `<select onchange="app.updLine('${l.id}','tier',this.value)" title="A 0–25 m, B 26–150 m, C 151 m+">
        ${['auto', 'A', 'B', 'C'].map(x => `<option value="${x}" ${(l.tier || 'auto') === x ? 'selected' : ''}>${x === 'auto' ? 'auto (' + c.tier + ')' : x}</option>`).join('')}
       </select>` : '';
  return `<tr class="${r.material ? 'mat' : ''}">
    <td>${r.material ? '<span class="mtag">materiál</span>' : ''}<input class="wide" value="${esc(lineName(l))}" onchange="app.updLine('${l.id}','name',this.value)">${c.minApplied ? '<div class="small muted">použita minimální cena</div>' : ''}</td>
    <td>${tierSel}</td>
    <td class="r"><input class="n" type="number" min="0" step="0.5" value="${esc(l.qty)}" onchange="app.updLine('${l.id}','qty',this.value)"></td>
    <td><input class="u" value="${esc(r.unit)}" onchange="app.updLine('${l.id}','unit',this.value)"></td>
    <td class="r"><input class="n ${c.hasOverride ? 'ovr' : ''}" type="number" step="${r.material ? '0.01' : '1'}" value="${c.hasOverride ? esc(l.price) : ''}" placeholder="${c.unit}" title="Prázdné = cena z ceníku. Vyplň pro ruční cenu." onchange="app.updLine('${l.id}','price',this.value)"></td>
    <td class="r">${kc(r.total)}</td>
    <td><button class="x" onclick="app.delLine('${l.id}')" title="Smazat">✕</button></td>
  </tr>`;
}

function fenceVariantOpts(type) {
  return FENCE_TYPES[type].variants.map(([lab, id]) => {
    const it = item(id);
    const p = it ? ` – ${finalPrice(it, 'A')}/${finalPrice(it, 'B')}/${finalPrice(it, 'C')} Kč/m` : '';
    return `<option value="${id}">${esc(lab + p)}</option>`;
  }).join('');
}
function heightOpts(type) {
  const hs = FENCE_TYPES[type].heights || [];
  if (!hs.length) return '';
  return `<select id="fHeight" onchange="app.heightChanged()" title="Výška plotu">
    <option value="">výška…</option>${hs.map(h => `<option value="${h}">${h} cm</option>`).join('')}<option value="jina">jiná…</option></select>
    <input id="fHeightCustom" type="number" min="0" placeholder="cm" style="width:80px;display:none">`;
}
function gateOptsHtml(type) {
  const g = GATE_TYPES[type];
  let h = '';
  if (g.patka) h += `<label class="chk"><input type="checkbox" id="gPatka" checked> betonová patka</label>`;
  h += `<label class="chk"><input type="checkbox" id="gPohon"> pohon</label>`;
  if (g.kind === 'kridl') {
    h += `<label class="chk"><input type="checkbox" id="gChran"> chránička</label>`;
    h += `<label class="chk"><input type="checkbox" id="g3d"> 3D</label>`;
    if (type !== 'branka') h += `<label class="chk"><input type="checkbox" id="gWpc"> WPC</label>`;
  }
  return h;
}
function matItemOpts(cat, q) {
  const words = q.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').split(/\s+/).filter(Boolean);
  const norm = s => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const list = S.catalog.filter(i => isMat(i) && (words.length ? words.every(w => norm(i.name).includes(w)) : i.cat === cat));
  if (!list.length) return '<option value="">nic nenalezeno</option>';
  return list.slice(0, 300).map(i => `<option value="${i.id}">${esc(i.name)} – ${kc(finalPrice(i))}/${esc(i.unit)}</option>`).join('');
}
function catItemOpts(cat) {
  return S.catalog.filter(i => i.cat === cat).map(i =>
    `<option value="${i.id}">${esc(i.name)} – ${i.tiered ? finalPrice(i, 'A') + '/' + finalPrice(i, 'B') + '/' + finalPrice(i, 'C') : finalPrice(i)} Kč/${esc(i.unit)}</option>`).join('');
}

// ---------- ZAKÁZKY ----------
function viewOrders() {
  if (!S.orders.length) return `<section class="card"><h2>Uložené zakázky</h2><p class="muted">Zatím nic uloženého.</p></section>`;
  const list = [...S.orders].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  return `<section class="card"><h2>Uložené zakázky</h2><div class="tablewrap"><table>
    <thead><tr><th>Datum</th><th>Zakázka</th><th>Zákazník</th><th class="r">Celkem</th><th></th></tr></thead><tbody>
    ${list.map(o => { const t = totals(orderRows(o).all, S.settings.vatPayer, S.settings.vatRate); return `<tr>
      <td>${fmtDate(o.date)}</td><td>${esc(o.name || '(bez názvu)')}</td><td>${esc(o.customer.name)}</td><td class="r">${kc(t.total)}</td>
      <td class="nowrap"><button onclick="app.openOrder('${o.id}')">Otevřít</button>
      <button class="ghost" onclick="app.copyOrder('${o.id}')">Kopie</button>
      <button class="x" onclick="app.delOrder('${o.id}')">✕</button></td></tr>`; }).join('')}
    </tbody></table></div></section>`;
}

// ---------- NABÍDKY A FAKTURY ----------
const QSTATUS = { koncept: 'Koncept', odeslana: 'Odeslaná', potvrzena: 'Potvrzená', zamitnuta: 'Zamítnutá', vyfakturovana: 'Vyfakturovaná' };
const GROUPS = { prace: 'Práce a montáž', material: 'Materiál', ostatni: 'Beton a doprava' };
const docTotals = d => totals(d.lines, d.vatPayer, d.vatRate);
const isOverdue = i => !i.paid && i.due && i.due < today();
const badge = st => `<span class="badge st-${st}">${QSTATUS[st] || st}</span>`;
let invFilter = { year: String(new Date().getFullYear()), status: 'all' };
let quoteFilter = 'all';

function viewQuotes() {
  const all = [...S.quotes].sort((a, b) => String(b.number).localeCompare(String(a.number)));
  const list = all.filter(q => quoteFilter === 'all' || (quoteFilter === 'open' ? ['koncept', 'odeslana', 'potvrzena'].includes(q.status) : q.status === quoteFilter));
  const cnt = st => all.filter(q => q.status === st).length;
  return `<section class="card"><div class="row between wrap"><h2>Cenové nabídky</h2>
    <div class="row wrap"><select onchange="app.setQuoteFilter(this.value)">
      ${[['open', 'Rozpracované'], ['all', 'Všechny'], ...Object.entries(QSTATUS)].map(([k, n]) => `<option value="${k}" ${quoteFilter === k ? 'selected' : ''}>${n}</option>`).join('')}
    </select><button class="ghost" onclick="app.newQuote()">+ Prázdná nabídka</button></div></div>
    <div class="stats">
      <div><span>Koncept</span><b>${cnt('koncept')}</b></div><div><span>Odeslané</span><b>${cnt('odeslana')}</b></div>
      <div><span>Potvrzené</span><b>${cnt('potvrzena')}</b></div><div><span>Vyfakturované</span><b>${cnt('vyfakturovana')}</b></div>
    </div>
    <p class="muted small">Nabídka se vytvoří ze zakázky tlačítkem „Vytvořit cenovou nabídku“. Po potvrzení zákazníkem z ní uděláš fakturu.</p>
    ${list.length ? `<div class="tablewrap"><table>
      <thead><tr><th>Číslo</th><th>Zakázka</th><th>Zákazník</th><th>Datum</th><th>Platnost</th><th class="r">Celkem</th><th>Stav</th><th></th></tr></thead><tbody>
      ${list.map(q => `<tr>
        <td><b>${esc(q.number)}</b></td><td>${esc(q.name)}</td><td>${esc(q.customer.name)}</td><td>${fmtDate(q.date)}</td>
        <td class="${['koncept', 'odeslana'].includes(q.status) && q.validUntil < today() ? 'late' : ''}">${fmtDate(q.validUntil)}</td>
        <td class="r">${kc(docTotals(q).total)}</td><td>${badge(q.status)}</td>
        <td class="nowrap"><button onclick="app.editDoc('quote','${q.id}')">Otevřít</button>
          <button class="ghost" onclick="app.printDoc('quote','${q.id}')">🖨️</button>
          <button class="x" onclick="app.delQuote('${q.id}')">✕</button></td></tr>`).join('')}
      </tbody></table></div>` : '<p class="muted">Žádné nabídky v tomto výběru.</p>'}
  </section>`;
}

function viewInvoices() {
  const years = [...new Set([String(new Date().getFullYear()), ...S.invoices.map(i => (i.issued || '').slice(0, 4))])].filter(Boolean).sort().reverse();
  const inYear = S.invoices.filter(i => invFilter.year === 'all' || (i.issued || '').startsWith(invFilter.year));
  const sum = arr => arr.reduce((a, i) => a + docTotals(i).total, 0);
  const paid = inYear.filter(i => i.paid), unpaid = inYear.filter(i => !i.paid), overdue = inYear.filter(isOverdue);
  const list = inYear.filter(i => invFilter.status === 'all' || (invFilter.status === 'paid' ? i.paid : invFilter.status === 'unpaid' ? !i.paid : isOverdue(i)))
    .sort((a, b) => String(b.number).localeCompare(String(a.number)));
  const quoteNo = id => (S.quotes.find(q => q.id === id) || {}).number || '';
  return `<section class="card"><div class="row between wrap"><h2>Faktury</h2>
    <div class="row wrap">
      <select onchange="app.setInvFilter('year',this.value)">${[...years, 'all'].map(y => `<option value="${y}" ${invFilter.year === y ? 'selected' : ''}>${y === 'all' ? 'Všechny roky' : y}</option>`).join('')}</select>
      <select onchange="app.setInvFilter('status',this.value)">${[['all', 'Všechny'], ['unpaid', 'Nezaplacené'], ['overdue', 'Po splatnosti'], ['paid', 'Zaplacené']].map(([k, n]) => `<option value="${k}" ${invFilter.status === k ? 'selected' : ''}>${n}</option>`).join('')}</select>
      <button class="ghost" onclick="app.newInvoice()">+ Prázdná faktura</button></div></div>
    <div class="stats">
      <div><span>Vyfakturováno (${inYear.length})</span><b>${kc(sum(inYear))}</b></div>
      <div><span>Zaplaceno (${paid.length})</span><b class="ok">${kc(sum(paid))}</b></div>
      <div><span>Čeká na platbu (${unpaid.length})</span><b>${kc(sum(unpaid))}</b></div>
      <div><span>Po splatnosti (${overdue.length})</span><b class="${overdue.length ? 'late' : ''}">${kc(sum(overdue))}</b></div>
    </div>
    ${list.length ? `<div class="tablewrap"><table>
      <thead><tr><th>Číslo</th><th>Odběratel</th><th>Nabídka</th><th>Vystaveno</th><th>Splatnost</th><th class="r">Celkem</th><th>Zaplaceno</th><th></th></tr></thead><tbody>
      ${list.map(i => `<tr class="${isOverdue(i) ? 'overdue' : ''}">
        <td><b>${esc(i.number)}</b></td><td>${esc(i.customer.name)}</td>
        <td>${i.quoteId ? `<a href="#" onclick="app.editDoc('quote','${i.quoteId}');return false">${esc(quoteNo(i.quoteId))}</a>` : ''}</td>
        <td>${fmtDate(i.issued)}</td><td>${fmtDate(i.due)}${isOverdue(i) ? ' <span class="late small">po splatnosti</span>' : ''}</td>
        <td class="r">${kc(docTotals(i).total)}</td>
        <td><label class="chk"><input type="checkbox" ${i.paid ? 'checked' : ''} onchange="app.setPaid('${i.id}',this.checked)">${i.paid && i.paidDate ? fmtDate(i.paidDate) : ''}</label></td>
        <td class="nowrap"><button onclick="app.editDoc('invoice','${i.id}')">Upravit</button>
        <button class="ghost" onclick="app.printDoc('invoice','${i.id}')">🖨️</button>
        <button class="x" onclick="app.delInvoice('${i.id}')">✕</button></td></tr>`).join('')}
      </tbody></table></div>` : '<p class="muted">Žádné faktury v tomto výběru.</p>'}
  </section>`;
}

function curDoc() { return editKind === 'quote' ? S.quotes.find(x => x.id === editId) : S.invoices.find(x => x.id === editId); }

function viewDocEditor() {
  const d = curDoc();
  if (!d) { tab = editKind === 'quote' ? 'nabidky' : 'faktury'; return render(); }
  const isQ = editKind === 'quote';
  const t = docTotals(d);
  const F = (path, label, type = 'text') => `<label>${label}<input type="${type}" value="${esc(getPath(d, path))}" onchange="app.setDoc('${path}',this.value)"></label>`;
  const order = d.orderId && S.orders.find(o => o.id === d.orderId);
  const inv = isQ && d.invoiceId && S.invoices.find(i => i.id === d.invoiceId);
  const quote = !isQ && d.quoteId && S.quotes.find(q => q.id === d.quoteId);
  let actions = `<button onclick="app.printDoc('${editKind}','${d.id}')">🖨️ Tisk / PDF</button>`;
  if (isQ) {
    if (d.status === 'koncept') actions += `<button class="ghost" onclick="app.setQStatus('odeslana')">📨 Označit jako odeslanou</button>`;
    if (['koncept', 'odeslana', 'zamitnuta'].includes(d.status)) actions += `<button class="okbtn" onclick="app.setQStatus('potvrzena')">✅ Zákazník potvrdil</button>`;
    if (['koncept', 'odeslana'].includes(d.status)) actions += `<button class="x" onclick="app.setQStatus('zamitnuta')">Zamítnuto</button>`;
    if (d.status === 'potvrzena') actions += `<button class="okbtn" onclick="app.invoiceFromQuote()">🧾 Vytvořit fakturu</button>`;
    if (inv) actions += `<button class="ghost" onclick="app.editDoc('invoice','${inv.id}')">Otevřít fakturu ${esc(inv.number)}</button>`;
    if (order) actions += `<button class="ghost" onclick="app.openOrder('${order.id}')">Otevřít zakázku</button>`;
  } else if (quote) actions += `<button class="ghost" onclick="app.editDoc('quote','${quote.id}')">Nabídka ${esc(quote.number)}</button>`;
  actions += `<button class="ghost" onclick="app.go('${isQ ? 'nabidky' : 'faktury'}')">← Zpět</button>`;

  return `
  <section class="card">
    <div class="row between wrap"><h2>${isQ ? 'Cenová nabídka' : 'Faktura'} ${esc(d.number)} ${isQ ? badge(d.status) : (d.paid ? '<span class="badge st-potvrzena">Zaplaceno</span>' : isOverdue(d) ? '<span class="badge st-zamitnuta">Po splatnosti</span>' : '')}</h2></div>
    <div class="row wrap actions">${actions}</div>
    ${isQ && d.status === 'vyfakturovana' ? '<p class="warn">Nabídka je už vyfakturovaná – změny tady se do faktury nepromítnou, uprav i fakturu.</p>' : ''}
    <div class="grid">
      ${isQ ? F('number', 'Číslo nabídky') + F('date', 'Datum', 'date') + F('validUntil', 'Platnost do', 'date') + F('name', 'Název zakázky') + F('place', 'Místo realizace')
            : F('number', 'Číslo faktury') + F('vs', 'Variabilní symbol') + F('issued', 'Datum vystavení', 'date') + F('duzp', 'DUZP', 'date') + F('due', 'Splatnost', 'date') + F('payment', 'Způsob úhrady')}
    </div>
    ${!isQ ? `<label class="chk"><input type="checkbox" ${d.paid ? 'checked' : ''} onchange="app.setPaid('${d.id}',this.checked)"> zaplaceno</label>` : ''}
    <h3>${isQ ? 'Zákazník' : 'Odběratel'}</h3>
    <div class="grid">
      ${F('customer.name', 'Jméno / firma')}${F('customer.address', 'Adresa')}
      ${F('customer.ico', 'IČO')}${F('customer.dic', 'DIČ')}
      ${F('customer.email', 'E-mail')}${F('customer.phone', 'Telefon')}
    </div>
    <details><summary>Dodavatel na tomto dokladu</summary>
      <div class="grid">${F('supplier.name', 'Jméno / firma')}${F('supplier.address', 'Adresa')}${F('supplier.ico', 'IČO')}${F('supplier.dic', 'DIČ')}
      ${F('supplier.bank', 'Číslo účtu')}${F('supplier.iban', 'IBAN')}${F('supplier.phone', 'Telefon')}${F('supplier.email', 'E-mail')}</div>
      <button class="ghost" onclick="app.refreshSupplier()">Načíst z Nastavení</button>
    </details>
    <label class="chk"><input type="checkbox" ${d.vatPayer ? 'checked' : ''} onchange="app.setDoc('vatPayer',this.checked)"> plátce DPH (sazba ${d.vatRate} %)</label>
  </section>
  <section class="card">
    <h3>Položky</h3>
    <div class="tablewrap"><table class="lines">
      <thead><tr><th>Popis</th><th>Skupina</th><th class="r">Množství</th><th>Jedn.</th><th class="r">Cena/j.</th><th class="r">Celkem</th><th></th></tr></thead><tbody>
      ${d.lines.map((l, k) => `<tr class="${l.group === 'material' ? 'mat' : ''}">
        <td><input class="wide" value="${esc(l.name)}" onchange="app.setDocLine(${k},'name',this.value)"></td>
        <td><select onchange="app.setDocLine(${k},'group',this.value)">${Object.entries(GROUPS).map(([g, n]) => `<option value="${g}" ${(l.group || 'prace') === g ? 'selected' : ''}>${n}</option>`).join('')}</select></td>
        <td class="r"><input class="n" type="number" step="any" value="${esc(l.qty)}" onchange="app.setDocLine(${k},'qty',this.value)"></td>
        <td><input class="u" value="${esc(l.unit)}" onchange="app.setDocLine(${k},'unit',this.value)"></td>
        <td class="r"><input class="n" type="number" step="0.01" value="${esc(l.price)}" onchange="app.setDocLine(${k},'price',this.value)"></td>
        <td class="r">${kc(num(l.qty) * num(l.price))}</td>
        <td><button class="x" onclick="app.delDocLine(${k})">✕</button></td></tr>`).join('')}
      </tbody></table></div>
    <button class="ghost" onclick="app.addDocLine()">+ Řádek</button>
    <div class="totals">
      ${d.vatPayer ? `<div>Základ <b>${kc(t.base)}</b></div><div>DPH ${d.vatRate} % <b>${kc(t.vat)}</b></div>` : ''}
      <div class="big">${isQ ? 'Celkem' : 'K úhradě'} <b>${kc(t.total)}</b></div>
    </div>
    <label>Text na dokladu (poznámka)<textarea rows="2" onchange="app.setDoc('note',this.value)">${esc(d.note)}</textarea></label>
  </section>
  <section class="card"><h3>Náhled</h3><div class="preview">${docHTML(editKind, d)}</div></section>`;
}

function getPath(o, p) { return p.split('.').reduce((a, k) => (a ? a[k] : ''), o) ?? ''; }
function setPath(o, p, v) { const ks = p.split('.'); const last = ks.pop(); ks.reduce((a, k) => a[k], o)[last] = v; }

// ---------- CENÍK ----------
function viewCatalog() {
  const f = catFilter.toLowerCase();
  const groups = ALL_CATS.filter(([cat]) => catGroup === 'all' || (catGroup === 'mat') === cat.startsWith('mat-')).map(([cat, name]) => {
    const items = S.catalog.filter(i => i.cat === cat && (!f || i.name.toLowerCase().includes(f)));
    if (cat === 'vlastni' && catGroup === 'mat') return '';
    if (!items.length && (f || cat !== 'vlastni')) return '';
    return `<section class="card"><h3>${esc(name)}</h3><div class="tablewrap"><table class="cat">
      <thead><tr><th>Položka</th><th>Jedn.</th><th class="r">Základ (z ceníku)</th><th class="r">S přirážkou ${cat.startsWith('mat-') ? S.settings.matMarkup : S.settings.markup} %</th><th></th></tr></thead><tbody>
      ${items.map(i => `<tr>
        <td><input class="wide" value="${esc(i.name)}" onchange="app.setItem('${i.id}','name',this.value)"></td>
        <td><input class="u" value="${esc(i.unit)}" onchange="app.setItem('${i.id}','unit',this.value)"></td>
        <td class="r nowrap">${i.tiered
          ? ['A', 'B', 'C'].map(t => `<span class="tier">${t}<input class="n" type="number" value="${esc(i.prices[t])}" onchange="app.setItem('${i.id}','${t}',this.value)"></span>`).join('')
          : `<input class="n" type="number" step="${isMat(i) ? '0.01' : '1'}" value="${esc(i.price)}" onchange="app.setItem('${i.id}','price',this.value)">`}
          ${i.min ? `<div class="small muted">min. ${i.min} Kč</div>` : ''}</td>
        <td class="r nowrap"><b>${i.tiered ? ['A', 'B', 'C'].map(t => finalPrice(i, t)).join(' / ') + ' Kč' : kc(finalPrice(i))}</b></td>
        <td class="nowrap"><button class="ghost" onclick="app.quickAdd('${i.id}')" title="Přidat do aktuální zakázky">+ do zakázky</button>
          ${i.custom ? `<button class="x" onclick="app.delItem('${i.id}')">✕</button>` : ''}</td></tr>`).join('')}
      </tbody></table></div></section>`;
  }).join('');
  return `<section class="card">
    <div class="row between wrap"><h2>Ceník</h2>
      <div class="row wrap"><select onchange="app.setCatGroup(this.value)">
        <option value="work" ${catGroup === 'work' ? 'selected' : ''}>Práce (montáž)</option>
        <option value="mat" ${catGroup === 'mat' ? 'selected' : ''}>Materiál</option>
        <option value="all" ${catGroup === 'all' ? 'selected' : ''}>Vše</option></select>
      <input placeholder="🔍 hledat…" value="${esc(catFilter)}" oninput="app.filterCat(this.value)" id="catSearch"></div></div>
    <p class="muted small">Zadávají se základní ceny z ceníku (bez DPH), přirážka se dopočítá sama: práce ${S.settings.markup} %, materiál ${S.settings.matMarkup} % (změníš v Nastavení). Materiál: RETIC CZ, ceník od 1. 10. 2026.
    Pásma: <b>A</b> 0–25 m, <b>B</b> 26–150 m, <b>C</b> 151 m+.</p>
    <details><summary>+ Přidat vlastní položku</summary>
      <div class="row wrap">
        <select id="niCat">${ALL_CATS.map(([k, n]) => `<option value="${k}" ${k === 'vlastni' ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select>
        <input id="niName" placeholder="název" style="flex:1;min-width:200px">
        <input id="niUnit" placeholder="jedn." value="ks" style="width:70px">
        <input id="niPrice" type="number" placeholder="základní cena" style="width:130px">
        <button onclick="app.addItem()">Přidat</button>
      </div>
    </details>
  </section>${groups}`;
}

// ---------- NASTAVENÍ ----------
function viewSettings() {
  const ed = !!setDraft, s = setDraft || S.settings, p = s.supplier, dis = ed ? '' : 'disabled';
  const SF = (k, label) => `<label>${label}<input ${dis} value="${esc(p[k])}" onchange="app.setSup('${k}',this.value)"></label>`;
  const N = (k, label, step = 1) => `<label>${label}<input ${dis} type="number" step="${step}" value="${esc(s[k])}" onchange="app.setS('${k}',this.value,true)"></label>`;
  const C = (k, label) => `<label class="chk"><input ${dis} type="checkbox" ${s[k] ? 'checked' : ''} onchange="app.setS('${k}',this.checked)"> ${label}</label>`;
  const bar = ed
    ? `<div class="setbar editing"><span>✏️ Upravuješ nastavení – změny se projeví až po uložení.</span><span class="row"><button onclick="app.saveSettings()">💾 Uložit</button><button class="ghost" onclick="app.cancelSettings()">Zrušit</button></span></div>`
    : `<div class="setbar"><span>🔒 Nastavení je uložené a zamčené, aby se omylem nezměnilo.</span><button onclick="app.editSettings()">✏️ Upravit nastavení</button></div>`;
  const warnDic = s.vatPayer && !p.dic ? '<p class="warn">⚠️ Je zaškrtnutý plátce DPH, ale chybí DIČ. Pokud táta plátce není, odškrtni to.</p>' : '';
  return `${bar}
  <section class="card"><h2>Dodavatel (táta)</h2>
    <div class="grid">${SF('name', 'Jméno / firma')}${SF('address', 'Adresa')}${SF('ico', 'IČO')}${SF('dic', 'DIČ')}
    ${SF('bank', 'Číslo účtu')}${SF('iban', 'IBAN')}${SF('phone', 'Telefon')}${SF('email', 'E-mail')}${SF('web', 'Web')}</div>
  </section>
  <section class="card"><h2>Výpočet</h2>
    <div class="grid">
      ${N('markup', 'Přirážka na práci (%)')}
      ${N('matMarkup', 'Přirážka na materiál (%)')}
      ${N('kmRate', 'Doprava Kč/km')}
      ${N('kmMin', 'Minimální doprava (Kč)')}
      ${N('minWork', 'Minimální cena montáže (Kč, bez přirážky)')}
      ${N('betonPerPost', 'Beton na 1 sloupek (m³)', 0.01)}
      ${N('betonPrice', 'Výchozí cena betonu Kč/m³ (nepovinné)', 10)}
    </div>
    ${C('markupBeton', 'přirážka i na beton')}${C('markupTransport', 'přirážka i na dopravu')}${C('minWorkOn', 'hlídat minimální cenu montáže')}
  </section>
  <section class="card"><h2>Faktury</h2>
    <div class="grid">
      ${N('dueDays', 'Splatnost (dní)')}
      ${N('nextInvNo', 'Další pořadové číslo faktury')}
      ${N('nextQuoteNo', 'Další pořadové číslo nabídky')}
      ${N('quoteValidDays', 'Platnost nabídky (dní)')}
      ${N('vatRate', 'Sazba DPH (%)')}
    </div>
    ${C('vatPayer', 'jsem plátce DPH')}${warnDic}
    <p class="muted small">Další faktura dostane číslo <b>${nextInvNumber()}</b>, další nabídka <b>${nextQuoteNumber()}</b>.
    QR platba se na fakturu přidá sama, když je vyplněné číslo účtu nebo IBAN${ibanFor(p) ? ` (IBAN: ${esc(ibanFor(p))})` : ''}.</p>
  </section>${ed ? bar : ''}
  <section class="card"><h2>Ukládání a záloha</h2>
    <p class="muted small">${syncText()}</p>
    ${API ? '<p><button class="ghost" onclick="app.logout()">Změnit heslo / odhlásit</button></p>' : ''}
    <div class="row wrap">
      <button onclick="app.exportData()">⬇️ Stáhnout zálohu</button>
      <label class="btn ghost">⬆️ Nahrát zálohu<input type="file" accept=".json" hidden onchange="app.importData(this.files[0])"></label>
      <button class="x" onclick="app.resetCatalog()">Obnovit původní ceník</button>
    </div>
  </section>`;
}

const yr = () => new Date().getFullYear();
function nextInvNumber() { return `${yr()}${String(S.settings.nextInvNo).padStart(4, '0')}`; }
function nextQuoteNumber() { return `N${yr()}${String(S.settings.nextQuoteNo).padStart(4, '0')}`; }

// ---------- QR platba ----------
function czIban(acc) {
  const m = String(acc || '').replace(/\s/g, '').match(/^(?:(\d{1,6})-)?(\d{2,10})\/(\d{4})$/);
  if (!m) return '';
  const bban = m[3] + (m[1] || '').padStart(6, '0') + m[2].padStart(10, '0');
  const chk = 98n - (BigInt(bban + '123500') % 97n);
  return 'CZ' + String(chk).padStart(2, '0') + bban;
}
function ibanFor(s) { const i = String(s.iban || '').replace(/\s/g, '').toUpperCase(); return i || czIban(s.bank); }
function qrSvg(d) {
  if (typeof qrcode !== 'function') return '';
  const iban = ibanFor(d.supplier || {});
  const amount = docTotals(d).total;
  if (!iban || !(amount > 0)) return '';
  const vs = String(d.vs || '').replace(/\D/g, '').slice(0, 10);
  let spd = `SPD*1.0*ACC:${iban}*AM:${amount.toFixed(2)}*CC:CZK`;
  if (vs) spd += `*X-VS:${vs}`;
  spd += `*MSG:FAKTURA ${String(d.number).replace(/[^0-9A-Za-z -]/g, '')}`;
  const qr = qrcode(0, 'M'); qr.addData(spd); qr.make();
  return qr.createSvgTag({ cellSize: 3, margin: 0, scalable: true });
}

// ---------- dokument pro tisk ----------
function docHTML(kind, d) {
  const isInv = kind === 'invoice';
  const s = d.supplier || {}, c = d.customer || {};
  const lines = d.lines;
  const t = docTotals(d);
  const title = isInv ? (d.vatPayer ? 'Faktura – daňový doklad' : 'Faktura') : 'Cenová nabídka';
  const party = (h, p) => `<div class="party"><div class="lbl">${h}</div><b>${esc(p.name) || '—'}</b>
    ${p.address ? `<div>${esc(p.address).replace(/\n/g, '<br>')}</div>` : ''}
    ${p.ico ? `<div>IČO: ${esc(p.ico)}</div>` : ''}${p.dic ? `<div>DIČ: ${esc(p.dic)}</div>` : ''}
    ${p.phone ? `<div>Tel.: ${esc(p.phone)}</div>` : ''}${p.email ? `<div>${esc(p.email)}</div>` : ''}</div>`;
  const row = l => `<tr><td>${esc(l.name)}</td><td class="r">${num(l.qty).toLocaleString('cs-CZ')}</td><td>${esc(l.unit)}</td><td class="r">${kc(l.price)}</td><td class="r">${kc(num(l.qty) * num(l.price))}</td></tr>`;
  const groups = Object.keys(GROUPS).filter(g => lines.some(l => (l.group || 'prace') === g));
  const body = groups.length > 1
    ? groups.map(g => { const ls = lines.filter(l => (l.group || 'prace') === g);
        return `<tr class="grp"><td colspan="4">${GROUPS[g]}</td><td class="r">${kc(ls.reduce((a, l) => a + num(l.qty) * num(l.price), 0))}</td></tr>${ls.map(row).join('')}`; }).join('')
    : lines.map(row).join('');
  const qr = isInv ? qrSvg(d) : '';
  return `<div class="doc">
    <div class="doc-head"><h1>${title}</h1><div class="docno">č. ${esc(d.number)}</div></div>
    <div class="parties">${party(isInv ? 'Dodavatel' : 'Zhotovitel', s)}${party(isInv ? 'Odběratel' : 'Zákazník', c)}</div>
    <div class="meta">
      ${isInv ? `<div>Datum vystavení: <b>${fmtDate(d.issued)}</b></div><div>DUZP: <b>${fmtDate(d.duzp)}</b></div>
      <div>Datum splatnosti: <b>${fmtDate(d.due)}</b></div><div>Způsob úhrady: <b>${esc(d.payment)}</b></div>
      ${s.bank ? `<div>Číslo účtu: <b>${esc(s.bank)}</b></div>` : ''}${ibanFor(s) ? `<div>IBAN: <b>${esc(ibanFor(s))}</b></div>` : ''}
      <div>Variabilní symbol: <b>${esc(d.vs)}</b></div>`
      : `<div>Datum: <b>${fmtDate(d.date)}</b></div><div>Platnost nabídky do: <b>${fmtDate(d.validUntil)}</b></div>
      ${d.name ? `<div>Zakázka: <b>${esc(d.name)}</b></div>` : ''}${d.place ? `<div>Místo realizace: <b>${esc(d.place)}</b></div>` : ''}`}
    </div>
    <table class="doc-lines"><thead><tr><th>Popis</th><th class="r">Množství</th><th>Jedn.</th><th class="r">Cena/j.</th><th class="r">Celkem</th></tr></thead><tbody>
      ${body}
    </tbody></table>
    <div class="doc-bottom">
      ${qr ? `<div class="qr">${qr}<div>QR Platba</div></div>` : '<div></div>'}
      <div class="doc-totals">
        ${d.vatPayer ? `<div>Základ daně: <b>${kc(t.base)}</b></div><div>DPH ${d.vatRate} %: <b>${kc(t.vat)}</b></div>` : ''}
        <div class="big">${isInv ? 'K úhradě' : 'Cena celkem'}: <b>${kc(t.total)}</b></div>
      </div>
    </div>
    ${d.note ? `<p class="doc-note">${esc(d.note).replace(/\n/g, '<br>')}</p>` : ''}
    <p class="doc-foot">${d.vatPayer ? '' : 'Dodavatel není plátcem DPH.'}</p>
  </div>`;
}

function doPrint(html) {
  $('#print').innerHTML = html;
  setTimeout(() => window.print(), 50);
}

function orderLines(o) {
  return orderRows(o).all.map(r => ({ name: r.name, unit: r.unit, qty: r.qty, price: r2(r.price),
    group: r.material ? 'material' : r.auto && !r.name.startsWith('Doplatek') ? 'ostatni' : 'prace' }));
}

function makeQuote(o) {
  const s = S.settings;
  const number = nextQuoteNumber();
  s.nextQuoteNo = num(s.nextQuoteNo) + 1;
  const q = { id: uid(), number, status: 'koncept', date: today(), validUntil: addDays(today(), num(s.quoteValidDays) || 30),
    name: o.name, place: o.place, orderId: o.id, customer: JSON.parse(JSON.stringify(o.customer)), supplier: { ...s.supplier },
    lines: orderLines(o), note: o.note || '', vatPayer: s.vatPayer, vatRate: s.vatRate, invoiceId: null };
  S.quotes.push(q);
  return q;
}

function makeInvoice({ customer, lines, orderId = null, quoteId = null, note = '' }) {
  const s = S.settings;
  const number = nextInvNumber();
  s.nextInvNo = num(s.nextInvNo) + 1;
  const inv = { id: uid(), number, vs: number, issued: today(), duzp: today(), due: addDays(today(), num(s.dueDays) || 14),
    payment: 'Bankovní převod', supplier: { ...s.supplier }, customer, lines, note, orderId, quoteId, paid: false,
    vatPayer: s.vatPayer, vatRate: s.vatRate };
  S.invoices.push(inv);
  return inv;
}

// ---------- akce ----------
const app = {
  go,
  // zakázka
  setO(k, v) { S.current[k] = k === 'km' ? num(v) : v; save(); render(); },
  setC(k, v) { S.current.customer[k] = v; save(); },
  newOrder() {
    if (S.current.lines.length && !S.orders.some(o => o.id === S.current.id) && !confirm('Aktuální zakázka není uložená. Zahodit?')) return;
    S.current = newOrder(); save(); render();
  },
  saveOrder(silent) {
    const o = JSON.parse(JSON.stringify(S.current));
    const k = S.orders.findIndex(x => x.id === o.id);
    if (k >= 0) S.orders[k] = o; else S.orders.push(o);
    save(); if (!silent) { render(); toast('Zakázka uložena'); }
  },
  openOrder(id) { const o = S.orders.find(x => x.id === id); if (!o) return; S.current = JSON.parse(JSON.stringify(o)); save(); go('zakazka'); },
  copyOrder(id) { const o = S.orders.find(x => x.id === id); if (!o) return; const c = JSON.parse(JSON.stringify(o)); c.id = uid(); c.name = (c.name || '') + ' (kopie)'; c.date = today(); S.current = c; save(); go('zakazka'); },
  delOrder(id) { if (!confirm('Smazat zakázku?')) return; S.orders = S.orders.filter(x => x.id !== id); save(); render(); },
  addLine(itemId, qty, extra = {}) { S.current.lines.push({ id: uid(), itemId, qty: num(qty) || 1, tier: 'auto', price: '', ...extra }); },
  fillFenceVariants() { const t = $('#fType').value; $('#fVar').innerHTML = fenceVariantOpts(t); $('#fHeightWrap').innerHTML = heightOpts(t); },
  heightChanged() { const c = $('#fHeightCustom'); c.style.display = $('#fHeight').value === 'jina' ? '' : 'none'; if ($('#fHeight').value === 'jina') c.focus(); },
  addFence() {
    const len = num($('#fLen').value);
    if (!len) { alert('Zadej délku plotu v metrech.'); $('#fLen').focus(); return; }
    const hSel = $('#fHeight');
    let height = '';
    if (hSel) height = hSel.value === 'jina' ? num($('#fHeightCustom').value) || '' : hSel.value;
    app.addLine($('#fVar').value, len, height ? { height } : {}); save(); render();
  },
  setBeton(k, v) {
    if (!S.current.beton) S.current.beton = { m3: '', price: '' };
    S.current.beton[k] = v === '' ? '' : num(v); save(); render();
  },
  gateChanged() { $('#gOpts').innerHTML = gateOptsHtml($('#gType').value); },
  addGate() {
    const type = $('#gType').value, g = GATE_TYPES[type], q = num($('#gQty').value) || 1;
    const on = id => $('#' + id) && $('#' + id).checked;
    app.addLine(g.item, q);
    if (g.patka && on('gPatka')) app.addLine(g.patka, q);
    if (on('gPohon')) app.addLine(g.kind === 'pos' ? 'poh-pos' : 'poh-kridl', q);
    if (on('gChran')) app.addLine('poh-chran', q);
    if (on('g3d')) app.addLine('br-3d', q);
    if (on('gWpc')) app.addLine('br-wpc', q);
    save(); render();
  },
  fillCatItems() { $('#cItem').innerHTML = catItemOpts($('#cCat').value); },
  addFromCat() {
    const id = $('#cItem').value; if (!id) return;
    app.addLine(id, $('#cQty').value || 1); save(); render();
  },
  addCustom(mat) { S.current.lines.push({ id: uid(), itemId: null, name: mat ? 'Materiál' : 'Vlastní položka', unit: 'ks', qty: 1, price: 0, material: !!mat }); save(); render(); },
  fillMatItems() { $('#mItem').innerHTML = matItemOpts($('#mCat').value, $('#mSearch').value); },
  addMat() {
    const id = $('#mItem').value; if (!id) return;
    const q = num($('#mQty').value);
    if (!q) { alert('Zadej množství.'); $('#mQty').focus(); return; }
    app.addLine(id, q); save(); render();
  },
  quickAdd(id) {
    const it = item(id);
    const q = prompt(`Množství (${it.unit}) – ${it.name}`, '1'); if (q === null) return;
    app.addLine(id, q); save(); toast('Přidáno do zakázky');
  },
  updLine(id, k, v) {
    const l = S.current.lines.find(x => x.id === id); if (!l) return;
    if (k === 'qty') v = num(v);
    if (k === 'price') v = v === '' ? '' : num(v);
    if (k === 'name') { const it = l.itemId && item(l.itemId); if (it && v === it.name) v = ''; }
    l[k] = v; save(); render();
  },
  delLine(id) { S.current.lines = S.current.lines.filter(x => x.id !== id); save(); render(); },

  // nabídky
  quoteFromOrder(forceNew) {
    const o = S.current;
    if (!o.lines.length) { alert('Zakázka nemá žádné položky.'); return; }
    const q = makeQuote(o);
    o.quoteId = q.id;
    app.saveOrder(true);
    app.editDoc('quote', q.id); toast('Nabídka ' + q.number + ' vytvořena');
  },
  updateQuote() {
    const o = S.current, q = S.quotes.find(x => x.id === o.quoteId); if (!q) return;
    if (q.status === 'potvrzena' && !confirm('Nabídka je už potvrzená zákazníkem. Přepsat položky podle zakázky?')) return;
    q.lines = orderLines(o); q.customer = JSON.parse(JSON.stringify(o.customer)); q.name = o.name; q.place = o.place;
    app.saveOrder(true);
    app.editDoc('quote', q.id); toast('Nabídka aktualizována');
  },
  newQuote() {
    const q = makeQuote(newOrder()); q.orderId = null; q.lines = [{ name: '', unit: 'ks', qty: 1, price: 0, group: 'prace' }];
    save(); app.editDoc('quote', q.id);
  },
  setQuoteFilter(v) { quoteFilter = v; render(); },
  setQStatus(st) { const q = curDoc(); q.status = st; if (st === 'potvrzena') q.confirmedDate = today(); save(); render(); },
  invoiceFromQuote() {
    const q = curDoc(); if (!q) return;
    const inv = makeInvoice({ customer: JSON.parse(JSON.stringify(q.customer)), lines: JSON.parse(JSON.stringify(q.lines)),
      orderId: q.orderId, quoteId: q.id, note: q.place ? `Montáž oplocení – ${q.place}` : (q.name || 'Montáž oplocení') });
    q.status = 'vyfakturovana'; q.invoiceId = inv.id;
    save(); app.editDoc('invoice', inv.id); toast('Faktura ' + inv.number + ' vytvořena');
  },
  delQuote(id) {
    const q = S.quotes.find(x => x.id === id);
    if (!confirm(`Smazat nabídku ${q.number}?`)) return;
    S.quotes = S.quotes.filter(x => x.id !== id); save(); render();
  },

  // doklady (nabídka i faktura)
  editDoc(kind, id) { editKind = kind; editId = id; tab = 'doklad'; render(); window.scrollTo(0, 0); },
  printDoc(kind, id) { const d = (kind === 'quote' ? S.quotes : S.invoices).find(x => x.id === id); doPrint(docHTML(kind, d)); },
  setDoc(path, v) { setPath(curDoc(), path, v); save(); render(); },
  setDocLine(k, f, v) { curDoc().lines[k][f] = (f === 'qty' || f === 'price') ? num(v) : v; save(); render(); },
  addDocLine() { curDoc().lines.push({ name: '', unit: 'ks', qty: 1, price: 0, group: 'prace' }); save(); render(); },
  delDocLine(k) { curDoc().lines.splice(k, 1); save(); render(); },
  refreshSupplier() { curDoc().supplier = { ...S.settings.supplier }; save(); render(); },

  // faktury
  newInvoice() {
    const inv = makeInvoice({ customer: { name: '', address: '', ico: '', dic: '', email: '', phone: '' }, lines: [{ name: '', unit: 'ks', qty: 1, price: 0, group: 'prace' }] });
    save(); app.editDoc('invoice', inv.id);
  },
  setInvFilter(k, v) { invFilter[k] = v; render(); },
  setPaid(id, v) { const i = S.invoices.find(x => x.id === id); i.paid = v; i.paidDate = v ? today() : null; save(); render(); },
  delInvoice(id) {
    const i = S.invoices.find(x => x.id === id);
    if (!confirm(`Smazat fakturu ${i.number}?`)) return;
    const q = i.quoteId && S.quotes.find(x => x.id === i.quoteId);
    if (q) { q.status = 'potvrzena'; q.invoiceId = null; }
    S.invoices = S.invoices.filter(x => x.id !== id); save(); render();
  },

  // ceník
  setItem(id, k, v) {
    const it = item(id);
    if (['A', 'B', 'C'].includes(k)) it.prices[k] = num(v);
    else if (k === 'price') it.price = num(v);
    else it[k] = v;
    save(); render();
  },
  setCatGroup(v) { catGroup = v; render(); },
  filterCat(v) { catFilter = v; render(); const el = $('#catSearch'); el.focus(); el.setSelectionRange(v.length, v.length); },
  addItem() {
    const name = $('#niName').value.trim(); if (!name) { alert('Zadej název.'); return; }
    const cat = $('#niCat').value;
    S.catalog.push({ id: 'c-' + uid(), cat, name, unit: $('#niUnit').value || 'ks', tiered: false, price: num($('#niPrice').value), custom: true, material: cat.startsWith('mat-') });
    save(); render();
  },
  delItem(id) { if (!confirm('Smazat položku z ceníku?')) return; S.catalog = S.catalog.filter(i => i.id !== id); save(); render(); },
  resetCatalog() {
    if (!confirm('Vrátit všechny ceny na původní ceník? Vlastní položky zůstanou.')) return;
    S.catalog = [...JSON.parse(JSON.stringify([...DEFAULT_CATALOG, ...DEFAULT_MATERIALS])), ...S.catalog.filter(i => i.custom)];
    save(); render(); toast('Ceník obnoven');
  },

  // nastavení
  setS(k, v, isNum) { if (!setDraft) return; setDraft[k] = isNum ? num(v) : v; render(); },
  setSup(k, v) { if (!setDraft) return; setDraft.supplier[k] = v; },
  editSettings() { setDraft = JSON.parse(JSON.stringify(S.settings)); render(); },
  cancelSettings() { setDraft = null; render(); },
  saveSettings() { S.settings = setDraft; setDraft = null; save(); render(); toast('Nastavení uloženo'); },
  logout() { localStorage.removeItem(PW_KEY); location.reload(); },
  exportData() {
    const blob = new Blob([JSON.stringify(S, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `ploty-zaloha-${today()}.json`; a.click();
  },
  importData(file) {
    if (!file) return;
    file.text().then(t => {
      try { const d = JSON.parse(t); if (!d.catalog || !d.settings) throw new Error('neplatný soubor');
        if (!confirm('Přepsat současná data zálohou?')) return;
        localStorage.setItem(KEY, JSON.stringify(d)); S = load(); save(); render(); toast('Záloha nahrána');
      } catch (e) { alert('Soubor se nepodařilo načíst: ' + e.message); }
    });
  },
};

function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 1800);
}

window.app = app;
document.querySelectorAll('nav button').forEach(b => b.addEventListener('click', () => go(b.dataset.tab)));
render();
setSync(sync.state);
pull();
