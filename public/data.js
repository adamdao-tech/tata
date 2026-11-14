// Výchozí ceník — ceny BEZ přirážky (podle "Ceník prací pro montážní partnery", rev. 3.11.2026).
// Přirážka (výchozí 30 %) se počítá automaticky v aplikaci. Vše jde přepsat v záložce Ceník.
'use strict';

const CATS = [
  ['pletivo', 'Čtyřhranné pletivo'],
  ['p2d', 'Plotové panely 2D'],
  ['p3d', 'Plotové panely 3D'],
  ['beton', 'Betonový plot'],
  ['magic', 'Betonový plot MAGICRETE'],
  ['hlinik', 'Hliníková lamelová pole'],
  ['wpc', 'WPC'],
  ['jine', 'Ostatní oplocení'],
  ['branky', 'Branky a křídlové brány'],
  ['posuvne', 'Samonosné a posuvné brány'],
  ['pohony', 'Pohony a příslušenství'],
  ['sloupky', 'Sloupky a vzpěry'],
  ['doplnky', 'Doplňky'],
  ['prace', 'Práce navíc'],
  ['vlastni', 'Vlastní položky'],
];

const T = (id, cat, name, unit, a, b, c) => ({ id, cat, name, unit, tiered: true, prices: { A: a, B: b, C: c } });
const P = (id, cat, name, unit, price, min) => ({ id, cat, name, unit, tiered: false, price, ...(min ? { min } : {}) });

function panels(cat, label) {
  return [
    T(`${cat}-klas`, cat, `Panely ${label} – klasická montáž (beton, patky)`, 'bm', 346, 269, 249),
    T(`${cat}-pd20`, cat, `Panely ${label} – s podhrabovou deskou 20 cm`, 'bm', 444, 347, 314),
    T(`${cat}-pd30`, cat, `Panely ${label} – s podhrabovou deskou 30 cm`, 'bm', 468, 370, 336),
    T(`${cat}-2pd`, cat, `Panely ${label} – s 2× podhrabovou deskou`, 'bm', 546, 422, 380),
    T(`${cat}-bd`, cat, `Panely ${label} – s betonovou deskou místo PD`, 'bm', 546, 422, 380),
    T(`${cat}-stav`, cat, `Panely ${label} – na stávající sloupky`, 'bm', 181, 153, 134),
    T(`${cat}-2n`, cat, `Panely ${label} – 2 panely nad sebou`, 'bm', 432, 357, 305),
    T(`${cat}-2n-pd20`, cat, `Panely ${label} – 2 panely nad sebou s PD 20 cm`, 'bm', 540, 419, 374),
    T(`${cat}-2n-pd30`, cat, `Panely ${label} – 2 panely nad sebou s PD 30 cm`, 'bm', 571, 441, 403),
    P(`${cat}-krac`, cat, `Krácení panelu ${label} (1 řez)`, 'ks', 50),
  ];
}

const DEFAULT_CATALOG = [
  // Pletivo
  T('plet-klas', 'pletivo', 'Čtyřhranné pletivo – klasická montáž (beton, patky)', 'bm', 312, 241, 219),
  T('plet-vruty', 'pletivo', 'Čtyřhranné pletivo – montáž na zemní vruty', 'bm', 312, 241, 219),
  T('plet-pd20', 'pletivo', 'Čtyřhranné pletivo – s podhrabovou deskou 20 cm', 'bm', 402, 327, 299),
  T('plet-pd30', 'pletivo', 'Čtyřhranné pletivo – s podhrabovou deskou 30 cm', 'bm', 414, 333, 304),
  T('plet-2pd', 'pletivo', 'Čtyřhranné pletivo – s 2× podhrabovou deskou', 'bm', 472, 374, 352),
  T('plet-nat', 'pletivo', 'Natažení pletiva na stávající sloupky', 'bm', 168, 114, 104),
  P('plet-uchyt', 'pletivo', 'Úchyt oplocení k podhrabové desce', 'ks', 52),

  ...panels('p2d', '2D'),
  ...panels('p3d', '3D'),

  // Betonový plot
  T('bet-100', 'beton', 'Betonový plot 100 cm', 'bm', 605, 495, 446),
  T('bet-150', 'beton', 'Betonový plot 150 cm', 'bm', 660, 550, 500),
  T('bet-200', 'beton', 'Betonový plot 175–200 cm', 'bm', 715, 605, 556),
  T('bet-200p', 'beton', 'Betonový plot nad 200 cm (+ lešení)', 'bm', 779, 717, 612),
  P('bet-krac', 'beton', 'Krácení betonových desek (1 řez)', 'ks', 50),

  // Magicrete
  T('mag-100', 'magic', 'MAGICRETE 100 cm', 'bm', 787, 705, 577),
  T('mag-150', 'magic', 'MAGICRETE 150 cm', 'bm', 849, 766, 604),
  T('mag-200', 'magic', 'MAGICRETE 175 a 200 cm', 'bm', 912, 827, 699),
  T('mag-200p', 'magic', 'MAGICRETE nad 200 cm', 'bm', 1047, 951, 803),
  P('mag-strs', 'magic', 'MAGICRETE – stříška na sloupek', 'ks', 45),
  P('mag-strd', 'magic', 'MAGICRETE – stříška na desku', 'ks', 70),
  P('mag-krac', 'magic', 'MAGICRETE – krácení desky vč. broušení (1 řez)', 'ks', 100),

  // Hliník
  T('hl-klas', 'hlinik', 'Hliníková lamelová pole – klasická montáž', 'bm', 526, 484, 400),
  T('hl-pd20', 'hlinik', 'Hliníková lamelová pole – s PD 20 cm', 'bm', 657, 604, 500),
  T('hl-pd30', 'hlinik', 'Hliníková lamelová pole – s PD 30 cm', 'bm', 710, 653, 540),

  // WPC
  P('wpc-pole', 'wpc', 'Plotové pole z WPC do betonových sloupků', 'ks', 975),
  P('wpc-1', 'wpc', 'WPC plotovky – bez nosníků', 'bm', 693),
  P('wpc-2', 'wpc', 'WPC plotovky – včetně nosníků', 'bm', 770),
  P('wpc-3', 'wpc', 'WPC plotovky – vč. nosníků a sloupků', 'bm', 891),
  P('wpc-4', 'wpc', 'WPC plotovky – vč. nosníků, sloupků a PD/betonové desky', 'bm', 990),
  P('wpc-krac', 'wpc', 'Krácení WPC plotovek', 'ks', 50),

  // Ostatní oplocení
  T('ten-klas', 'jine', 'Tenisové pletivo – klasická montáž', 'bm', 528, 440, 400),
  T('ten-nat', 'jine', 'Tenisové pletivo – natažení', 'bm', 259, 229, 211),
  T('ost-1', 'jine', 'Ostnatý drát na příchytky (1 řada)', 'bm', 42, 27, 25),
  T('ost-3', 'jine', 'Ostnatý drát na bavolety (3 řady)', 'bm', 70, 59, 59),
  T('ost-con', 'jine', 'Concertina', 'bm', 70, 59, 59),
  T('ost-ziz', 'jine', 'Žiletková páska', 'bm', 46, 31, 31),
  T('ost-v', 'jine', 'Na bavolety do V', 'bm', 134, 113, 109),
  T('folie', 'jine', 'Fólie pod plot (položení + fixace)', 'bm', 40, 27, 27),
  P('lesni', 'jine', 'Uzlové lesnické pletivo (betonování / dřevěné kůly)', 'bm', 242),
  P('mobil', 'jine', 'Mobilní oplocení', 'bm', 68),
  P('ziz-plet', 'jine', 'Žiletkové pletivo', 'bm', 650),
  P('plech-s', 'jine', 'Plotové pole (plech/tahokov/hliník) vč. sloupků', 'bm', 360),
  P('plech-b', 'jine', 'Plotové pole (plech/tahokov/hliník) bez sloupků', 'ks', 454),
  P('gab-ryha', 'jine', 'Gabion – základová rýha š. 20–30 cm', 'bm', 270),
  P('gab-stena', 'jine', 'Gabion – montáž sypané stěny', 'bm', 630),
  P('gab-napl', 'jine', 'Gabion – naplnění kamenivem', 'bm', 450),

  // Branky a křídlové brány
  P('br-branka', 'branky', 'Montáž jednokřídlé branky do 2 m', 'ks', 1950),
  P('br-dvou-5', 'branky', 'Montáž dvoukřídlé brány do 5 m', 'ks', 2415),
  P('br-dvou-5p', 'branky', 'Montáž dvoukřídlé brány od 5 m', 'ks', 3450),
  P('br-3d', 'branky', 'Příplatek – branka/brána ve variantě 3D', 'ks', 500),
  P('br-wpc', 'branky', 'Příplatek – dvoukřídlá brána s WPC', 'ks', 750),
  P('br-demont', 'branky', 'Demontáž brány / branky', 'ks', 1500),

  // Samonosné a posuvné brány
  P('pos-sam-m', 'posuvne', 'Samonosná/posuvná brána do 4,99 m – montáž', 'ks', 4950),
  P('pos-sam-p', 'posuvne', 'Samonosná/posuvná brána do 4,99 m – betonová patka', 'ks', 5885),
  P('pos-sam5-m', 'posuvne', 'Samonosná/posuvná brána od 5 m – montáž', 'ks', 7700),
  P('pos-sam5-p', 'posuvne', 'Samonosná/posuvná brána od 5 m – betonová patka', 'ks', 8025),
  P('pos-tel-m', 'posuvne', 'Teleskopická posuvná brána – montáž', 'ks', 10055),
  P('pos-tel-p', 'posuvne', 'Teleskopická posuvná brána – patka', 'ks', 8287),
  P('pos-kol-m', 'posuvne', 'Brána na kolejnici do 4,99 m – montáž', 'ks', 4950),
  P('pos-kol-p', 'posuvne', 'Brána na kolejnici do 4,99 m – patka + pás + kolejnice', 'ks', 6465),
  P('pos-kol5-m', 'posuvne', 'Brána na kolejnici od 5 m – montáž', 'ks', 7700),
  P('pos-kol5-p', 'posuvne', 'Brána na kolejnici od 5 m – patka + pás + kolejnice', 'ks', 10775),

  // Pohony
  P('poh-pos', 'pohony', 'Montáž a zapojení pohonu – posuvná/samonosná brána', 'ks', 5500),
  P('poh-kridl', 'pohony', 'Montáž a zapojení pohonu – křídlová brána', 'ks', 5500),
  P('poh-chran', 'pohony', 'Zakopání chráničky mezi sloupky', 'ks', 900),
  P('poh-wifi', 'pohony', 'Wi-Fi ovládání', 'ks', 500),
  P('poh-magnet', 'pohony', 'Poziční magnet', 'ks', 500),
  P('poh-bidi', 'pohony', 'BIDI WiFi chytrá domácnost', 'ks', 500),
  P('poh-gsm', 'pohony', 'GSM modul (do 3 ks v ceně)', 'ks', 800),
  P('poh-klav', 'pohony', 'Digitální klávesnice', 'ks', 1000),
  P('poh-karty', 'pohony', 'Snímač karet/čipů (do 10 ks v ceně)', 'ks', 1000),
  P('poh-klic', 'pohony', 'Klíčový spínač', 'ks', 1000),
  P('poh-spz', 'pohony', 'Kamera pro snímání SPZ', 'ks', 4950),
  P('poh-zamek', 'pohony', 'Elektrický zámek', 'ks', 1500),
  P('poh-ovl', 'pohony', 'Nastavení dálkového ovladače nad 10 ks', 'ks', 50),

  // Sloupky
  P('sl-ks', 'sloupky', 'Montáž sloupku (samostatně)', 'ks', 200),
  P('sl-vzp', 'sloupky', 'Montáž vzpěry (samostatně)', 'ks', 200),
  P('sl-plet', 'sloupky', 'Sloupky u pletiva bez PD (díry + betonáž)', 'bm', 156),
  P('sl-plet-pd', 'sloupky', 'Sloupky u pletiva vč. usazení PD', 'bm', 282),
  P('sl-pan', 'sloupky', 'Sloupky u panelů 2D/3D bez PD', 'bm', 240),
  P('sl-pan-pd', 'sloupky', 'Sloupky u panelů 2D/3D vč. usazení PD', 'bm', 384),
  P('sl-krac', 'sloupky', 'Krácení sloupku', 'ks', 30),
  P('ren-nater', 'sloupky', 'Renovace – nátěr sloupku', 'ks', 110),
  P('ren-uprava', 'sloupky', 'Renovace – povrchová úprava před nátěrem', 'ks', 135),
  P('ren-mat', 'sloupky', 'Renovace – spotřební materiál', 'ks', 250),

  // Doplňky
  P('ox-plot', 'doplnky', 'OX BOX v rámci montáže plotu', 'ks', 1500),
  P('ox-sam', 'doplnky', 'OX BOX samostatně', 'ks', 2300),
  P('schranka', 'doplnky', 'Instalace poštovní schránky', 'ks', 400),
  P('zahon', 'doplnky', 'Betonový záhon', 'ks', 1735),
  P('stin-plet', 'doplnky', 'Stínící tkanina – pletivo', 'bm', 63, 500),
  P('stin-pan', 'doplnky', 'Stínící tkanina – panely', 'bm', 94, 500),
  P('vypln-plast', 'doplnky', 'Plastové výplně do panelů', 'bm', 236),
  P('ratan-panel', 'doplnky', 'Ratanové/plastové pásy – ukončení na panelu (řada 2,5 m)', 'ks', 70),
  P('ratan-role', 'doplnky', 'Plastové pásy – ukončení po roli', 'bm', 20),

  // Práce navíc
  P('dem-oplo', 'prace', 'Demontáž oplocení bez sloupků', 'bm', 27, 700),
  P('kop-ruc', 'prace', 'Ruční kopání děr', 'ks', 240),
  P('kop-pik', 'prace', 'Pikování děr (sbíjecí kladivo)', 'ks', 600),
  P('zak-15', 'prace', 'Zakopání PD 5–15 cm pod terén', 'bm', 59),
  P('zak-30', 'prace', 'Zakopání PD 15–30 cm pod terén', 'bm', 72),
  P('pokos', 'prace', 'Pokos trávníku v trase plotu', 'bm', 40),
  P('lesen', 'prace', 'Použití lešení', 'den', 1600),
  P('elcentr', 'prace', 'Použití elektrocentrály', 'den', 500),
  P('dlazba', 'prace', 'Rozebrání a složení zámkové dlažby', 'm²', 1000),

];

// Rychlé přidání plotu: typ → varianty [popisek, id položky]
const FENCE_TYPES = {
  pletivo: { label: 'Čtyřhranné pletivo', heights: [80, 100, 125, 150, 160, 175, 180, 200], spacing: 2.5, variants: [
    ['Bez podhrabové desky', 'plet-klas'], ['S PD 20 cm', 'plet-pd20'], ['S PD 30 cm', 'plet-pd30'],
    ['S 2× PD', 'plet-2pd'], ['Na zemní vruty', 'plet-vruty'], ['Na stávající sloupky', 'plet-nat']] },
  p2d: { label: '2D plot (panely)', heights: [83, 103, 123, 143, 163, 183, 203], spacing: 2.5, variants: [
    ['Bez podhrabové desky', 'p2d-klas'], ['S PD 20 cm', 'p2d-pd20'], ['S PD 30 cm', 'p2d-pd30'],
    ['S 2× PD', 'p2d-2pd'], ['S betonovou deskou místo PD', 'p2d-bd'], ['Na stávající sloupky', 'p2d-stav'],
    ['2 panely nad sebou', 'p2d-2n'], ['2 nad sebou s PD 20 cm', 'p2d-2n-pd20'], ['2 nad sebou s PD 30 cm', 'p2d-2n-pd30']] },
  p3d: { label: '3D plot (panely)', heights: [83, 103, 123, 153, 173, 203], spacing: 2.5, variants: [
    ['Bez podhrabové desky', 'p3d-klas'], ['S PD 20 cm', 'p3d-pd20'], ['S PD 30 cm', 'p3d-pd30'],
    ['S 2× PD', 'p3d-2pd'], ['S betonovou deskou místo PD', 'p3d-bd'], ['Na stávající sloupky', 'p3d-stav'],
    ['2 panely nad sebou', 'p3d-2n'], ['2 nad sebou s PD 20 cm', 'p3d-2n-pd20'], ['2 nad sebou s PD 30 cm', 'p3d-2n-pd30']] },
  beton: { label: 'Betonový plot', heights: [], spacing: 2, variants: [
    ['100 cm', 'bet-100'], ['150 cm', 'bet-150'], ['175–200 cm', 'bet-200'], ['Nad 200 cm', 'bet-200p']] },
  magic: { label: 'Betonový plot MAGICRETE', heights: [], spacing: 2, variants: [
    ['100 cm', 'mag-100'], ['150 cm', 'mag-150'], ['175 a 200 cm', 'mag-200'], ['Nad 200 cm', 'mag-200p']] },
  hlinik: { label: 'Hliníková lamelová pole', heights: [100, 120, 140, 160, 180, 200], spacing: 2.5, variants: [
    ['Bez PD', 'hl-klas'], ['S PD 20 cm', 'hl-pd20'], ['S PD 30 cm', 'hl-pd30']] },
};

// Rychlé přidání brány: typ → montáž, patka (jen posuvné), druh pohonu
// Varianty plotu, kde se nebetonují sloupky (vruty, stávající sloupky)
const NO_BETON = ['plet-vruty', 'plet-nat', 'p2d-stav', 'p3d-stav'];

// Beton: počet sloupků na jednotku položky (plot se počítá z délky: pole á spacing m + 1 sloupek).
// Spotřeba na sloupek je v Nastavení (výchozí 0,03 m³ = 10 sloupků → 0,3 m³).
const POSTS_PER_ITEM = {
  'br-branka': 2, 'br-dvou-5': 2, 'br-dvou-5p': 2,
  'sl-ks': 1, 'sl-vzp': 1, 'sl-plet': 1 / 2.5, 'sl-plet-pd': 1 / 2.5, 'sl-pan': 1 / 2.5, 'sl-pan-pd': 1 / 2.5,
  'wpc-3': 1 / 1.8, 'wpc-4': 1 / 1.8, 'wpc-pole': 1, 'plech-s': 1 / 2.5, 'lesni': 1 / 3,
};
// Pevné množství betonu na kus (m³) – patky posuvných bran (ceník: do 6 m = 2 m³, nad 6 m = 3 m³)
const BETON_FIXED = { 'pos-sam-p': 2, 'pos-sam5-p': 2, 'pos-tel-p': 3, 'pos-kol-p': 2, 'pos-kol5-p': 2 };

const GATE_TYPES = {
  branka: { label: 'Branka (jednokřídlá do 2 m)', item: 'br-branka', kind: 'kridl' },
  dvou5: { label: 'Brána dvoukřídlá do 5 m', item: 'br-dvou-5', kind: 'kridl' },
  dvou5p: { label: 'Brána dvoukřídlá od 5 m', item: 'br-dvou-5p', kind: 'kridl' },
  sam: { label: 'Samonosná brána do 4,99 m', item: 'pos-sam-m', patka: 'pos-sam-p', kind: 'pos' },
  sam5: { label: 'Samonosná brána od 5 m', item: 'pos-sam5-m', patka: 'pos-sam5-p', kind: 'pos' },
  tel: { label: 'Teleskopická posuvná brána', item: 'pos-tel-m', patka: 'pos-tel-p', kind: 'pos' },
  kol: { label: 'Posuvná brána na kolejnici do 4,99 m', item: 'pos-kol-m', patka: 'pos-kol-p', kind: 'pos' },
  kol5: { label: 'Posuvná brána na kolejnici od 5 m', item: 'pos-kol5-m', patka: 'pos-kol5-p', kind: 'pos' },
};

const DEFAULT_SETTINGS = {
  markup: 30,            // přirážka v % na všechny položky ceníku
  kmRate: 12,            // Kč/km (tam i zpět)
  kmMin: 500,            // minimální doprava
  markupTransport: true, // přirážka i na dopravu
  minWork: 3500,         // minimální cena montáže bez dopravy a materiálu
  minWorkOn: true,
  betonPrice: 0,         // výchozí Kč/m³ (nepovinné – cena se zadává u každé zakázky)
  markupBeton: false,    // přirážka na beton (táta ji nedává)
  matMarkup: 30,         // přirážka na materiál v %
  settingsVersion: 4,
  betonPerPost: 0.03,    // m³ betonu na 1 sloupek (10 sloupků = 0,3 m³)
  vatPayer: false,
  vatRate: 21,
  dueDays: 14,
  nextInvNo: 1,
  nextQuoteNo: 1,
  quoteValidDays: 30,
  quotePayment: 'Platba: 70 % předem na základě proforma faktury, 30 % při předání stavby.',
  supplier: { name: '', address: '', ico: '', dic: '', bank: '', iban: '', phone: '', email: '', web: '' },
};
