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
const catName = id => (CATS.find(c => c[0] === id) || [, id])[1];

// ---------- data ----------
const KEY = 'tata-ploty-v1';

function newOrder() {
  return { id: uid(), name: '', date: today(), place: '', km: 0, note: '',
    customer: { name: '', address: '', phone: '', email: '', ico: '', dic: '' }, lines: [] };
}

function load() {
  let d = null;
  try { d = JSON.parse(localStorage.getItem(KEY)); } catch (e) { /* nic */ }
  d = d || {};
  d.settings = { ...DEFAULT_SETTINGS, ...(d.settings || {}), supplier: { ...DEFAULT_SETTINGS.supplier, ...(d.settings?.supplier || {}) } };
  const cat = d.catalog || [];
  const ids = new Set(cat.map(i => i.id));
  for (const i of DEFAULT_CATALOG) if (!ids.has(i.id)) cat.push(JSON.parse(JSON.stringify(i)));
  d.catalog = cat;
  d.orders = d.orders || [];
  d.invoices = d.invoices || [];
  d.current = d.current || newOrder();
  return d;
}
let S = load();
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(S)); }
  catch (e) { alert('Nepodařilo se uložit data: ' + e.message); }
}

// ---------- výpočty ----------
const item = id => S.catalog.find(i => i.id === id);
const mk = () => 1 + num(S.settings.markup) / 100;
const tierFor = q => (q <= 25 ? 'A' : q <= 150 ? 'B' : 'C');
const basePrice = (it, tier) => it.tiered ? num(it.prices[tier]) : num(it.price);
const finalPrice = (it, tier) => Math.round(basePrice(it, tier) * mk());

function lineCalc(l) {
  const it = l.itemId ? item(l.itemId) : null;
  let tier = null;
  if (it && it.tiered) tier = l.tier && l.tier !== 'auto' ? l.tier : tierFor(num(l.qty));
  const hasOverride = l.price !== null && l.price !== undefined && l.price !== '';
  const unit = hasOverride ? num(l.price) : (it ? finalPrice(it, tier) : 0);
  let total = unit * num(l.qty);
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
  return it ? it.name : '(položka smazána z ceníku)';
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
      material: it && it.cat === 'material', calc: c };
  });
  const extra = [];
  const work = rows.filter(r => !r.material).reduce((a, r) => a + r.total, 0);
  if (s.minWorkOn && work > 0) {
    const m = Math.round(num(s.minWork) * mk());
    if (work < m) extra.push({ name: 'Doplatek do minimální ceny montáže', unit: 'ks', qty: 1, price: m - work, total: m - work, auto: true });
  }
  const km = num(o.km);
  if (km > 0) {
    let t = Math.max(km * num(s.kmRate), num(s.kmMin));
    if (s.markupTransport) t = Math.round(t * mk());
    extra.push({ name: `Doprava (${km} km)`, unit: 'ks', qty: 1, price: t, total: t, auto: true });
  }
  return { rows, extra, all: [...rows, ...extra] };
}

function totals(rows, vatPayer, vatRate) {
  const base = rows.reduce((a, r) => a + num(r.qty) * num(r.price), 0);
  const vat = vatPayer ? Math.round(base * num(vatRate)) / 100 : 0;
  return { base, vat, total: base + vat };
}

// ---------- navigace ----------
let tab = 'zakazka';
let editInvoiceId = null;
let catFilter = '';

function go(t) { tab = t; if (t !== 'faktura') editInvoiceId = null; render(); window.scrollTo(0, 0); }

function render() {
  document.querySelectorAll('nav button').forEach(b => b.classList.toggle('active', b.dataset.tab === tab || (tab === 'faktura' && b.dataset.tab === 'faktury')));
  const v = $('#view');
  if (tab === 'zakazka') v.innerHTML = viewOrder();
  else if (tab === 'zakazky') v.innerHTML = viewOrders();
  else if (tab === 'faktury') v.innerHTML = viewInvoices();
  else if (tab === 'faktura') v.innerHTML = viewInvoice();
  else if (tab === 'cenik') v.innerHTML = viewCatalog();
  else if (tab === 'nastaveni') v.innerHTML = viewSettings();
}

// ---------- ZAKÁZKA ----------
function viewOrder() {
  const o = S.current;
  const c = o.customer;
  const { rows, extra, all } = orderRows(o);
  const t = totals(all, S.settings.vatPayer, S.settings.vatRate);
  const saved = S.orders.some(x => x.id === o.id);
  const fenceOpts = Object.entries(FENCE_TYPES).map(([k, v]) => `<option value="${k}">${esc(v.label)}</option>`).join('');
  const gateOpts = Object.entries(GATE_TYPES).map(([k, v]) => `<option value="${k}">${esc(v.label)}</option>`).join('');
  const catOpts = CATS.map(([k, n]) => `<option value="${k}">${esc(n)}</option>`).join('');

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
    <h3>📋 Z ceníku / vlastní řádek</h3>
    <div class="row wrap">
      <select id="cCat" onchange="app.fillCatItems()">${catOpts}</select>
      <select id="cItem">${catItemOpts('pletivo')}</select>
      <input id="cQty" type="number" min="0" step="0.5" placeholder="množství" style="width:110px">
      <button onclick="app.addFromCat()">Přidat</button>
      <button class="ghost" onclick="app.addCustom()">+ Vlastní řádek</button>
    </div>
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
      <div class="big">Celkem ${S.settings.vatPayer ? 's DPH' : ''} <b>${kc(t.total)}</b></div>
      <div class="muted small">Ceny obsahují přirážku ${S.settings.markup} %. ${S.settings.vatPayer ? '' : 'Neplátce DPH.'}</div>
    </div>
    <label>Poznámka<textarea onchange="app.setO('note',this.value)" rows="2">${esc(o.note)}</textarea></label>
    <div class="row wrap">
      <button onclick="app.invoiceFromOrder()">🧾 Vytvořit fakturu</button>
      <button class="ghost" onclick="app.printQuote()">🖨️ Tisk cenové nabídky</button>
    </div>
  </section>`;
}

function lineRow(r) {
  const l = r.line, c = r.calc;
  const tierSel = c.it && c.it.tiered
    ? `<select onchange="app.updLine('${l.id}','tier',this.value)" title="A 0–25 m, B 26–150 m, C 151 m+">
        ${['auto', 'A', 'B', 'C'].map(x => `<option value="${x}" ${(l.tier || 'auto') === x ? 'selected' : ''}>${x === 'auto' ? 'auto (' + c.tier + ')' : x}</option>`).join('')}
       </select>` : '';
  return `<tr>
    <td><input class="wide" value="${esc(lineName(l))}" onchange="app.updLine('${l.id}','name',this.value)">${c.minApplied ? '<div class="small muted">použita minimální cena</div>' : ''}</td>
    <td>${tierSel}</td>
    <td class="r"><input class="n" type="number" min="0" step="0.5" value="${esc(l.qty)}" onchange="app.updLine('${l.id}','qty',this.value)"></td>
    <td><input class="u" value="${esc(r.unit)}" onchange="app.updLine('${l.id}','unit',this.value)"></td>
    <td class="r"><input class="n ${c.hasOverride ? 'ovr' : ''}" type="number" step="1" value="${c.hasOverride ? esc(l.price) : ''}" placeholder="${c.unit}" title="Prázdné = cena z ceníku. Vyplň pro ruční cenu." onchange="app.updLine('${l.id}','price',this.value)"></td>
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

// ---------- FAKTURY ----------
function invTotals(inv) { return totals(inv.lines, inv.vatPayer, inv.vatRate); }

function viewInvoices() {
  const list = [...S.invoices].sort((a, b) => String(b.number).localeCompare(String(a.number)));
  return `<section class="card"><div class="row between"><h2>Faktury</h2><button onclick="app.newInvoice()">+ Prázdná faktura</button></div>
  ${list.length ? `<div class="tablewrap"><table>
    <thead><tr><th>Číslo</th><th>Odběratel</th><th>Vystaveno</th><th>Splatnost</th><th class="r">Celkem</th><th>Zaplaceno</th><th></th></tr></thead><tbody>
    ${list.map(i => `<tr class="${!i.paid && i.due < today() ? 'overdue' : ''}">
      <td><b>${esc(i.number)}</b></td><td>${esc(i.customer.name)}</td><td>${fmtDate(i.issued)}</td><td>${fmtDate(i.due)}</td>
      <td class="r">${kc(invTotals(i).total)}</td>
      <td><input type="checkbox" ${i.paid ? 'checked' : ''} onchange="app.setPaid('${i.id}',this.checked)"></td>
      <td class="nowrap"><button onclick="app.editInvoice('${i.id}')">Upravit</button>
      <button class="ghost" onclick="app.printInvoice('${i.id}')">🖨️</button>
      <button class="x" onclick="app.delInvoice('${i.id}')">✕</button></td></tr>`).join('')}
    </tbody></table></div>` : '<p class="muted">Zatím žádné faktury. Vytvoř ji ze zakázky tlačítkem „Vytvořit fakturu“.</p>'}
  </section>`;
}

function viewInvoice() {
  const i = S.invoices.find(x => x.id === editInvoiceId);
  if (!i) { tab = 'faktury'; return viewInvoices(); }
  const c = i.customer, s = i.supplier;
  const t = invTotals(i);
  const F = (path, label, type = 'text') => `<label>${label}<input type="${type}" value="${esc(getPath(i, path))}" onchange="app.setInv('${path}',this.value)"></label>`;
  return `
  <section class="card">
    <div class="row between"><h2>Faktura ${esc(i.number)}</h2>
      <div class="row"><button onclick="app.printInvoice('${i.id}')">🖨️ Tisk / PDF</button><button class="ghost" onclick="app.go('faktury')">← Zpět</button></div></div>
    <div class="grid">
      ${F('number', 'Číslo faktury')}
      ${F('vs', 'Variabilní symbol')}
      ${F('issued', 'Datum vystavení', 'date')}
      ${F('duzp', 'DUZP', 'date')}
      ${F('due', 'Splatnost', 'date')}
      ${F('payment', 'Způsob úhrady')}
    </div>
    <h3>Odběratel</h3>
    <div class="grid">
      ${F('customer.name', 'Jméno / firma')}${F('customer.address', 'Adresa')}
      ${F('customer.ico', 'IČO')}${F('customer.dic', 'DIČ')}
      ${F('customer.email', 'E-mail')}${F('customer.phone', 'Telefon')}
    </div>
    <details><summary>Dodavatel na této faktuře</summary>
      <div class="grid">${F('supplier.name', 'Jméno / firma')}${F('supplier.address', 'Adresa')}${F('supplier.ico', 'IČO')}${F('supplier.dic', 'DIČ')}
      ${F('supplier.bank', 'Číslo účtu')}${F('supplier.iban', 'IBAN')}${F('supplier.phone', 'Telefon')}${F('supplier.email', 'E-mail')}</div>
      <button class="ghost" onclick="app.refreshSupplier()">Načíst z Nastavení</button>
    </details>
    <label class="chk"><input type="checkbox" ${i.vatPayer ? 'checked' : ''} onchange="app.setInv('vatPayer',this.checked)"> plátce DPH (sazba ${i.vatRate} %)</label>
  </section>
  <section class="card">
    <h3>Položky</h3>
    <div class="tablewrap"><table class="lines">
      <thead><tr><th>Popis</th><th class="r">Množství</th><th>Jedn.</th><th class="r">Cena/j.</th><th class="r">Celkem</th><th></th></tr></thead><tbody>
      ${i.lines.map((l, k) => `<tr>
        <td><input class="wide" value="${esc(l.name)}" onchange="app.setInvLine(${k},'name',this.value)"></td>
        <td class="r"><input class="n" type="number" step="0.5" value="${esc(l.qty)}" onchange="app.setInvLine(${k},'qty',this.value)"></td>
        <td><input class="u" value="${esc(l.unit)}" onchange="app.setInvLine(${k},'unit',this.value)"></td>
        <td class="r"><input class="n" type="number" step="1" value="${esc(l.price)}" onchange="app.setInvLine(${k},'price',this.value)"></td>
        <td class="r">${kc(num(l.qty) * num(l.price))}</td>
        <td><button class="x" onclick="app.delInvLine(${k})">✕</button></td></tr>`).join('')}
      </tbody></table></div>
    <button class="ghost" onclick="app.addInvLine()">+ Řádek</button>
    <div class="totals">
      ${i.vatPayer ? `<div>Základ <b>${kc(t.base)}</b></div><div>DPH ${i.vatRate} % <b>${kc(t.vat)}</b></div>` : ''}
      <div class="big">K úhradě <b>${kc(t.total)}</b></div>
    </div>
    <label>Text na faktuře (poznámka)<textarea rows="2" onchange="app.setInv('note',this.value)">${esc(i.note)}</textarea></label>
  </section>
  <section class="card"><h3>Náhled</h3><div class="preview">${docHTML('invoice', i)}</div></section>`;
}

function getPath(o, p) { return p.split('.').reduce((a, k) => (a ? a[k] : ''), o) ?? ''; }
function setPath(o, p, v) { const ks = p.split('.'); const last = ks.pop(); ks.reduce((a, k) => a[k], o)[last] = v; }

// ---------- CENÍK ----------
function viewCatalog() {
  const f = catFilter.toLowerCase();
  const groups = CATS.map(([cat, name]) => {
    const items = S.catalog.filter(i => i.cat === cat && (!f || i.name.toLowerCase().includes(f)));
    if (!items.length && (f || cat !== 'vlastni')) return '';
    return `<section class="card"><h3>${esc(name)}</h3><div class="tablewrap"><table class="cat">
      <thead><tr><th>Položka</th><th>Jedn.</th><th class="r">Základ (z ceníku)</th><th class="r">S přirážkou ${S.settings.markup} %</th><th></th></tr></thead><tbody>
      ${items.map(i => `<tr>
        <td><input class="wide" value="${esc(i.name)}" onchange="app.setItem('${i.id}','name',this.value)"></td>
        <td><input class="u" value="${esc(i.unit)}" onchange="app.setItem('${i.id}','unit',this.value)"></td>
        <td class="r nowrap">${i.tiered
          ? ['A', 'B', 'C'].map(t => `<span class="tier">${t}<input class="n" type="number" value="${esc(i.prices[t])}" onchange="app.setItem('${i.id}','${t}',this.value)"></span>`).join('')
          : `<input class="n" type="number" value="${esc(i.price)}" onchange="app.setItem('${i.id}','price',this.value)">`}
          ${i.min ? `<div class="small muted">min. ${i.min} Kč</div>` : ''}</td>
        <td class="r nowrap"><b>${i.tiered ? ['A', 'B', 'C'].map(t => finalPrice(i, t)).join(' / ') : finalPrice(i)}</b> Kč</td>
        <td class="nowrap"><button class="ghost" onclick="app.quickAdd('${i.id}')" title="Přidat do aktuální zakázky">+ do zakázky</button>
          ${i.custom ? `<button class="x" onclick="app.delItem('${i.id}')">✕</button>` : ''}</td></tr>`).join('')}
      </tbody></table></div></section>`;
  }).join('');
  return `<section class="card">
    <div class="row between wrap"><h2>Ceník</h2><input placeholder="🔍 hledat…" value="${esc(catFilter)}" oninput="app.filterCat(this.value)" id="catSearch"></div>
    <p class="muted small">Zadávají se základní ceny z ceníku, přirážka ${S.settings.markup} % se dopočítá sama (změníš v Nastavení).
    Pásma: <b>A</b> 0–25 m, <b>B</b> 26–150 m, <b>C</b> 151 m+.</p>
    <details><summary>+ Přidat vlastní položku</summary>
      <div class="row wrap">
        <select id="niCat">${CATS.map(([k, n]) => `<option value="${k}" ${k === 'vlastni' ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select>
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
  const s = S.settings, p = s.supplier;
  const SF = (k, label) => `<label>${label}<input value="${esc(p[k])}" onchange="app.setSup('${k}',this.value)"></label>`;
  const N = (k, label, step = 1) => `<label>${label}<input type="number" step="${step}" value="${esc(s[k])}" onchange="app.setS('${k}',this.value,true)"></label>`;
  return `
  <section class="card"><h2>Dodavatel (táta)</h2>
    <div class="grid">${SF('name', 'Jméno / firma')}${SF('address', 'Adresa')}${SF('ico', 'IČO')}${SF('dic', 'DIČ')}
    ${SF('bank', 'Číslo účtu')}${SF('iban', 'IBAN')}${SF('phone', 'Telefon')}${SF('email', 'E-mail')}${SF('web', 'Web')}</div>
  </section>
  <section class="card"><h2>Výpočet</h2>
    <div class="grid">
      ${N('markup', 'Přirážka na ceník (%)')}
      ${N('kmRate', 'Doprava Kč/km')}
      ${N('kmMin', 'Minimální doprava (Kč)')}
      ${N('minWork', 'Minimální cena montáže (Kč, bez přirážky)')}
    </div>
    <label class="chk"><input type="checkbox" ${s.markupTransport ? 'checked' : ''} onchange="app.setS('markupTransport',this.checked)"> přirážka i na dopravu</label>
    <label class="chk"><input type="checkbox" ${s.minWorkOn ? 'checked' : ''} onchange="app.setS('minWorkOn',this.checked)"> hlídat minimální cenu montáže</label>
  </section>
  <section class="card"><h2>Faktury</h2>
    <div class="grid">
      ${N('dueDays', 'Splatnost (dní)')}
      ${N('nextInvNo', 'Další pořadové číslo faktury')}
      ${N('vatRate', 'Sazba DPH (%)')}
    </div>
    <label class="chk"><input type="checkbox" ${s.vatPayer ? 'checked' : ''} onchange="app.setS('vatPayer',this.checked)"> jsem plátce DPH</label>
    <p class="muted small">Další faktura dostane číslo <b>${nextInvNumber()}</b>.</p>
  </section>
  <section class="card"><h2>Záloha dat</h2>
    <p class="muted small">Data se ukládají jen v tomhle prohlížeči. Občas si stáhni zálohu.</p>
    <div class="row wrap">
      <button onclick="app.exportData()">⬇️ Stáhnout zálohu</button>
      <label class="btn ghost">⬆️ Nahrát zálohu<input type="file" accept=".json" hidden onchange="app.importData(this.files[0])"></label>
      <button class="x" onclick="app.resetCatalog()">Obnovit původní ceník</button>
    </div>
  </section>`;
}

function nextInvNumber() { return `${new Date().getFullYear()}${String(S.settings.nextInvNo).padStart(4, '0')}`; }

// ---------- dokument pro tisk ----------
function docHTML(kind, d) {
  const isInv = kind === 'invoice';
  const s = d.supplier, c = d.customer;
  const lines = d.lines;
  const t = totals(lines, d.vatPayer, d.vatRate);
  const title = isInv ? (d.vatPayer ? 'Faktura – daňový doklad' : 'Faktura') : 'Cenová nabídka';
  const party = (h, p) => `<div class="party"><div class="lbl">${h}</div><b>${esc(p.name) || '—'}</b>
    ${p.address ? `<div>${esc(p.address).replace(/\n/g, '<br>')}</div>` : ''}
    ${p.ico ? `<div>IČO: ${esc(p.ico)}</div>` : ''}${p.dic ? `<div>DIČ: ${esc(p.dic)}</div>` : ''}
    ${p.phone ? `<div>Tel.: ${esc(p.phone)}</div>` : ''}${p.email ? `<div>${esc(p.email)}</div>` : ''}</div>`;
  return `<div class="doc">
    <div class="doc-head"><h1>${title}</h1><div class="docno">${isInv ? 'č. ' + esc(d.number) : esc(d.name || '')}</div></div>
    <div class="parties">${party(isInv ? 'Dodavatel' : 'Zhotovitel', s)}${party(isInv ? 'Odběratel' : 'Zákazník', c)}</div>
    <div class="meta">
      ${isInv ? `<div>Datum vystavení: <b>${fmtDate(d.issued)}</b></div><div>DUZP: <b>${fmtDate(d.duzp)}</b></div>
      <div>Datum splatnosti: <b>${fmtDate(d.due)}</b></div><div>Způsob úhrady: <b>${esc(d.payment)}</b></div>
      ${s.bank ? `<div>Číslo účtu: <b>${esc(s.bank)}</b></div>` : ''}${s.iban ? `<div>IBAN: <b>${esc(s.iban)}</b></div>` : ''}
      <div>Variabilní symbol: <b>${esc(d.vs)}</b></div>`
      : `<div>Datum: <b>${fmtDate(d.date)}</b></div>${d.place ? `<div>Místo realizace: <b>${esc(d.place)}</b></div>` : ''}`}
    </div>
    <table class="doc-lines"><thead><tr><th>Popis</th><th class="r">Množství</th><th>Jedn.</th><th class="r">Cena/j.</th><th class="r">Celkem</th></tr></thead><tbody>
      ${lines.map(l => `<tr><td>${esc(l.name)}</td><td class="r">${num(l.qty).toLocaleString('cs-CZ')}</td><td>${esc(l.unit)}</td><td class="r">${kc(l.price)}</td><td class="r">${kc(num(l.qty) * num(l.price))}</td></tr>`).join('')}
    </tbody></table>
    <div class="doc-totals">
      ${d.vatPayer ? `<div>Základ daně: <b>${kc(t.base)}</b></div><div>DPH ${d.vatRate} %: <b>${kc(t.vat)}</b></div>` : ''}
      <div class="big">${isInv ? 'K úhradě' : 'Cena celkem'}: <b>${kc(t.total)}</b></div>
    </div>
    ${d.note ? `<p class="doc-note">${esc(d.note).replace(/\n/g, '<br>')}</p>` : ''}
    <p class="doc-foot">${d.vatPayer ? '' : 'Dodavatel není plátcem DPH.'} ${isInv ? '' : 'Nabídka je platná 30 dní.'}</p>
  </div>`;
}

function doPrint(html) {
  $('#print').innerHTML = html;
  setTimeout(() => window.print(), 50);
}

function orderToDoc(o) {
  return { name: o.name, date: o.date, place: o.place, note: o.note, customer: o.customer, supplier: S.settings.supplier,
    vatPayer: S.settings.vatPayer, vatRate: S.settings.vatRate,
    lines: orderRows(o).all.map(r => ({ name: r.name, unit: r.unit, qty: r.qty, price: Math.round(r.price * 100) / 100 })) };
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
  saveOrder() {
    const o = JSON.parse(JSON.stringify(S.current));
    const k = S.orders.findIndex(x => x.id === o.id);
    if (k >= 0) S.orders[k] = o; else S.orders.push(o);
    save(); render(); toast('Zakázka uložena');
  },
  openOrder(id) { const o = S.orders.find(x => x.id === id); if (!o) return; S.current = JSON.parse(JSON.stringify(o)); save(); go('zakazka'); },
  copyOrder(id) { const o = S.orders.find(x => x.id === id); if (!o) return; const c = JSON.parse(JSON.stringify(o)); c.id = uid(); c.name = (c.name || '') + ' (kopie)'; c.date = today(); S.current = c; save(); go('zakazka'); },
  delOrder(id) { if (!confirm('Smazat zakázku?')) return; S.orders = S.orders.filter(x => x.id !== id); save(); render(); },
  addLine(itemId, qty, extra = {}) { S.current.lines.push({ id: uid(), itemId, qty: num(qty) || 1, tier: 'auto', price: '', ...extra }); },
  fillFenceVariants() { $('#fVar').innerHTML = fenceVariantOpts($('#fType').value); },
  addFence() {
    const len = num($('#fLen').value);
    if (!len) { alert('Zadej délku plotu v metrech.'); $('#fLen').focus(); return; }
    app.addLine($('#fVar').value, len); save(); render();
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
  addCustom() { S.current.lines.push({ id: uid(), itemId: null, name: 'Vlastní položka', unit: 'ks', qty: 1, price: 0 }); save(); render(); },
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
  printQuote() { doPrint(docHTML('quote', orderToDoc(S.current))); },

  // faktury
  invoiceFromOrder() {
    const o = S.current;
    if (!o.lines.length) { alert('Zakázka nemá žádné položky.'); return; }
    if (!S.orders.some(x => x.id === o.id)) app.saveOrder();
    const doc = orderToDoc(o);
    const inv = makeInvoice({ customer: JSON.parse(JSON.stringify(o.customer)), lines: doc.lines, orderId: o.id,
      note: o.place ? `Montáž oplocení – ${o.place}` : 'Montáž oplocení' });
    editInvoiceId = inv.id; tab = 'faktura'; render(); window.scrollTo(0, 0);
  },
  newInvoice() {
    const inv = makeInvoice({ customer: { name: '', address: '', ico: '', dic: '', email: '', phone: '' }, lines: [{ name: '', unit: 'ks', qty: 1, price: 0 }] });
    editInvoiceId = inv.id; tab = 'faktura'; render();
  },
  editInvoice(id) { editInvoiceId = id; tab = 'faktura'; render(); window.scrollTo(0, 0); },
  setInv(path, v) { const i = S.invoices.find(x => x.id === editInvoiceId); setPath(i, path, v); save(); render(); },
  setInvLine(k, f, v) { const i = S.invoices.find(x => x.id === editInvoiceId); i.lines[k][f] = (f === 'qty' || f === 'price') ? num(v) : v; save(); render(); },
  addInvLine() { const i = S.invoices.find(x => x.id === editInvoiceId); i.lines.push({ name: '', unit: 'ks', qty: 1, price: 0 }); save(); render(); },
  delInvLine(k) { const i = S.invoices.find(x => x.id === editInvoiceId); i.lines.splice(k, 1); save(); render(); },
  refreshSupplier() { const i = S.invoices.find(x => x.id === editInvoiceId); i.supplier = { ...S.settings.supplier }; save(); render(); },
  setPaid(id, v) { S.invoices.find(x => x.id === id).paid = v; save(); render(); },
  delInvoice(id) { if (!confirm('Smazat fakturu?')) return; S.invoices = S.invoices.filter(x => x.id !== id); save(); render(); },
  printInvoice(id) { doPrint(docHTML('invoice', S.invoices.find(x => x.id === id))); },

  // ceník
  setItem(id, k, v) {
    const it = item(id);
    if (['A', 'B', 'C'].includes(k)) it.prices[k] = num(v);
    else if (k === 'price') it.price = num(v);
    else it[k] = v;
    save(); render();
  },
  filterCat(v) { catFilter = v; render(); const el = $('#catSearch'); el.focus(); el.setSelectionRange(v.length, v.length); },
  addItem() {
    const name = $('#niName').value.trim(); if (!name) { alert('Zadej název.'); return; }
    S.catalog.push({ id: 'c-' + uid(), cat: $('#niCat').value, name, unit: $('#niUnit').value || 'ks', tiered: false, price: num($('#niPrice').value), custom: true });
    save(); render();
  },
  delItem(id) { if (!confirm('Smazat položku z ceníku?')) return; S.catalog = S.catalog.filter(i => i.id !== id); save(); render(); },
  resetCatalog() {
    if (!confirm('Vrátit všechny ceny na původní ceník? Vlastní položky zůstanou.')) return;
    S.catalog = [...JSON.parse(JSON.stringify(DEFAULT_CATALOG)), ...S.catalog.filter(i => i.custom)];
    save(); render(); toast('Ceník obnoven');
  },

  // nastavení
  setS(k, v, isNum) { S.settings[k] = isNum ? num(v) : v; save(); render(); },
  setSup(k, v) { S.settings.supplier[k] = v; save(); },
  exportData() {
    const blob = new Blob([JSON.stringify(S, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `ploty-zaloha-${today()}.json`; a.click();
  },
  importData(file) {
    if (!file) return;
    file.text().then(t => {
      try { const d = JSON.parse(t); if (!d.catalog || !d.settings) throw new Error('neplatný soubor');
        if (!confirm('Přepsat současná data zálohou?')) return;
        localStorage.setItem(KEY, JSON.stringify(d)); S = load(); render(); toast('Záloha nahrána');
      } catch (e) { alert('Soubor se nepodařilo načíst: ' + e.message); }
    });
  },
};

function makeInvoice({ customer, lines, orderId = null, note = '' }) {
  const s = S.settings;
  const number = nextInvNumber();
  s.nextInvNo = num(s.nextInvNo) + 1;
  const inv = { id: uid(), number, vs: number, issued: today(), duzp: today(), due: addDays(today(), num(s.dueDays) || 14),
    payment: 'Bankovní převod', supplier: { ...s.supplier }, customer, lines, note, orderId, paid: false,
    vatPayer: s.vatPayer, vatRate: s.vatRate };
  S.invoices.push(inv); save();
  return inv;
}

function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 1800);
}

window.app = app;
document.querySelectorAll('nav button').forEach(b => b.addEventListener('click', () => go(b.dataset.tab)));
render();
