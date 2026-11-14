// Materiál RETIC CZ – ceník PARTNER platný od 1. 10. 2026, ceny BEZ DPH a BEZ přirážky.
// Přirážka na materiál (výchozí 30 %) se počítá v aplikaci. Vše jde upravit v záložce Ceník.
'use strict';

const MAT_CATS = [
  ['mat-pletivo', 'Materiál – čtyřhranné pletivo'],
  ['mat-sloupky', 'Materiál – sloupky a vzpěry k pletivu'],
  ['mat-plet-pris', 'Materiál – příslušenství k pletivu, dráty'],
  ['mat-panely', 'Materiál – plotové panely 3D a 2D'],
  ['mat-pan-sloupky', 'Materiál – sloupky k panelům'],
  ['mat-pan-pris', 'Materiál – příchytky k panelům'],
  ['mat-pd', 'Materiál – podhrabové desky a držáky'],
  ['mat-svar', 'Materiál – svařované pletivo'],
  ['mat-brany', 'Materiál – branky a brány'],
  ['mat-ostatni', 'Materiál – ostatní (stínění, vruty, ostnatý drát…)'],
];

const DEFAULT_MATERIALS = (() => {
  const out = [];
  const slug = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  // id se tvoří z původního názvu z ceníku RETIC (kvůli uloženým datům), zobrazuje se srozumitelný název (label)
  const M = (cat, orig, unit, price, label) => { if (price) out.push({ id: 'm-' + slug(cat.slice(4) + '-' + orig), cat, name: label || orig, orig, unit, tiered: false, price, material: true }); };
  // řada podle výšek: M pro každou dvojici výška/cena (prázdné ceny se přeskočí)
  const R = (cat, fmt, unit, heights, prices, lab) => heights.forEach((h, i) => M(cat, fmt(h), unit, prices[i], lab ? lab(h) : ''));
  const cm = mm => Math.round(mm / 10);

  // --- Čtyřhranné pletivo (Kč/m) ---
  const H6 = [100, 125, 150, 160, 180, 200];
  R('mat-pletivo', h => `Pletivo poplast. oko 50, 2,5 mm, BND, výška ${h} cm`, 'm', H6, [39.60, 49.48, 59.36, 63.31, 71.21, 79.12], h => `Čtyřhranné pletivo zelené/antracit PVC bez ND, výška ${h} cm, drát 2,5 mm, oko 55 mm`);
  R('mat-pletivo', h => `Pletivo poplast. oko 50, 2,5 mm, SND (se zapleteným drátem), výška ${h} cm`, 'm', H6, [42.41, 52.29, 62.17, 66.12, 74.02, 81.93], h => `Čtyřhranné pletivo zelené/antracit PVC s ND, výška ${h} cm, drát 2,5 mm, oko 55 mm`);
  R('mat-pletivo', h => `Pletivo poplast. oko 60, 2,5 mm, BND, výška ${h} cm`, 'm', H6, [34.66, 43.32, 51.98, 55.48, 62.40, 69.31], h => `Čtyřhranné pletivo zelené PVC bez ND, výška ${h} cm, drát 2,5 mm, oko 65 mm`);
  R('mat-pletivo', h => `Pletivo pozink. oko 50, 2,0 mm, BND, výška ${h} cm`, 'm', H6, [37.85, 47.27, 56.77, 60.50, 68.10, 75.62], h => `Čtyřhranné pletivo pozinkované Zn bez ND, výška ${h} cm, drát 2,0 mm, oko 55 mm`);
  R('mat-pletivo', h => `Pletivo pozink. oko 50, 2,0 mm, SND, výška ${h} cm`, 'm', H6, [41.19, 50.69, 60.12, 63.92, 71.44, 79.04], h => `Čtyřhranné pletivo pozinkované Zn s ND, výška ${h} cm, drát 2,0 mm, oko 55 mm`);
  R('mat-pletivo', h => `Pletivo pozink. oko 60, 2,0 mm, BND, výška ${h} cm`, 'm', H6, [33.21, 41.50, 49.78, 53.12, 59.74, 66.35], h => `Čtyřhranné pletivo pozinkované Zn bez ND, výška ${h} cm, drát 2,0 mm, oko 65 mm`);
  R('mat-pletivo', h => `Tenisové pletivo poplast. oko 45, 3,0 mm, výška ${h} cm`, 'm', [300, 400], [193.34, 257.72], h => `Tenisové pletivo zelené PVC, výška ${h} cm, drát 3,0 mm, oko 45 mm`);

  // --- Sloupky a vzpěry k pletivu (Kč/ks) ---
  const HS = [150, 175, 200, 220, 230, 250, 280, 300];
  R('mat-sloupky', h => `Sloupek BPL Ø 48 mm poplast., ${h} cm`, 'ks', HS, [109.44, 127.68, 145.92, 160.36, 167.96, 181.64, 203.68, 218.12], h => `Plotový sloupek zelený/antracit Ø 48 mm, výška ${h} cm`);
  R('mat-sloupky', h => `Sloupek BPL Ø 38 mm poplast., ${h} cm`, 'ks', HS, [69.92, 81.32, 92.72, 101.84, 106.40, 115.52, 129.96, 139.08], h => `Plotový sloupek zelený Ø 38 mm, výška ${h} cm`);
  R('mat-sloupky', h => `Sloupek BPL Ø 60 mm poplast., ${h} cm`, 'ks', [400, 500], [1065.52, 1272.24], h => `Plotový sloupek silnostěnný zelený Ø 60 mm, výška ${h} cm (tenis)`);
  const HV = [150, 175, 200, 230, 250, 280, 300];
  R('mat-sloupky', h => `Vzpěra UNI-BPL Ø 38 mm poplast., ${h} cm`, 'ks', HV, [104.88, 122.36, 139.84, 161.12, 175.56, 196.08, 209.76], h => `Vzpěra zelená/antracit Ø 38 mm, výška ${h} cm`);
  R('mat-sloupky', h => `Sloupek ZN Ø 48 mm pozink., ${h} cm`, 'ks', HV, [115.52, 133.00, 150.48, 171.76, 186.20, 207.48, 221.16], h => `Plotový sloupek pozinkovaný Zn Ø 48 mm, výška ${h} cm`);
  R('mat-sloupky', h => `Sloupek ZN Ø 38 mm pozink., ${h} cm`, 'ks', HV, [79.80, 91.20, 103.36, 117.80, 127.68, 142.12, 151.24], h => `Plotový sloupek pozinkovaný Zn Ø 38 mm, výška ${h} cm`);
  R('mat-sloupky', h => `Vzpěra ZN Ø 38 mm pozink., ${h} cm`, 'ks', HV, [121.60, 134.52, 146.68, 161.88, 171.76, 186.96, 196.84], h => `Vzpěra pozinkovaná Zn Ø 38 mm, výška ${h} cm`);

  // --- Příslušenství k pletivu, dráty ---
  const P = 'mat-plet-pris';
  M(P, 'Napínák PVC (RAL 6005, 7016)', 'ks', 8.13, 'Napínák (ráčna) zelený/antracit PVC');
  M(P, 'Napínák ZN', 'ks', 9.42, 'Napínák (ráčna) pozinkovaný Zn');
  M(P, 'Čepička PVC Ø 38/48 mm', 'ks', 7.68, 'Čepička na kulatý sloupek Ø 38/48 mm');
  M(P, 'Čepička PVC Ø 60 mm', 'ks', 10.11, 'Čepička na kulatý sloupek Ø 60 mm');
  M(P, 'Základová patka na sloupek Ø 38/48 mm', 'ks', 198.97, 'Patka na sloupek Ø 38/48 mm (přišroubování)');
  M(P, 'Základová patka na vzpěru Ø 38 mm', 'ks', 198.97, 'Patka na vzpěru Ø 38 mm');
  M(P, 'Hákový šroub komplet', 'ks', 8.89, 'Hákový šroub ke vzpěře');
  M(P, 'Násadka na boční vzpěru', 'ks', 15.35, 'Násadka na vzpěru');
  M(P, 'Opasek PVC na sloupek Ø 38/48 mm', 'ks', 5.93, 'Opasek na napínák, sloupek Ø 38/48 mm, PVC');
  M(P, 'Opasek PVC na sloupek Ø 60 mm', 'ks', 7.30, 'Opasek na napínák, sloupek Ø 60 mm, PVC');
  M(P, 'Opasek nerez na sloupek Ø 38/48 mm', 'ks', 13.22, 'Opasek na napínák, sloupek Ø 38/48 mm, nerez');
  M(P, 'Očko na přichycení napínáku', 'ks', 8.06, 'Očko na napínák');
  R(P, l => `Napínací tyč ZN/PVC ${l} mm`, 'ks', [1050, 1300, 1550, 1650, 1850, 2050], [48.87, 59.20, 65.82, 73.34, 79.88, 84.59], l => `Napínací tyč zelená PVC / pozink Zn ${l} mm`);
  M(P, 'Vodící příchytka PVC na napínací drát (1000 ks)', '1000 ks', 4034.92, 'Příchytka z PVC na napínací drát (balení 1000 ks)');
  M(P, 'Spona PLOTFIX PVC (1000 ks)', '1000 ks', 323.38, 'Spony na pletivo zelené PVC (balení 1000 ks)');
  M(P, 'Spona PLOTFIX Zn (1000 ks)', '1000 ks', 178.52, 'Spony na pletivo pozinkované (balení 1000 ks)');
  M(P, 'Barva RAL 6005/7016/9005 – sprej', 'ks', 133.46, 'Barva ve spreji zelená/antracit/černá');
  M(P, 'Napínací drát poplast. 2,20/3,20 mm', 'kg', 37.70, 'Napínací drát zelený PVC 3,2 mm');
  M(P, 'Napínací drát poplast. 2,50/3,50 mm', 'kg', 37.01, 'Napínací drát zelený/antracit PVC 3,5 mm');
  M(P, 'Vázací drát poplast. 1,65/2,50 mm', 'kg', 39.44, 'Vázací drát zelený/antracit PVC 2,5 mm');
  M(P, 'Drát poplast. 1,90/3,00 mm', 'kg', 38.84, 'Drát zelený/antracit PVC 3,0 mm');
  M(P, 'Napínací drát pozink. 3,10 mm', 'kg', 31.54, 'Napínací drát pozinkovaný Zn 3,1 mm');
  M(P, 'Vázací drát pozink. 2,00 mm', 'kg', 32.30, 'Vázací drát pozinkovaný Zn 2,0 mm');

  // --- Plotové panely (Kč/ks, délka 2500 mm) ---
  const PA = 'mat-panely';
  const H3 = [830, 1030, 1230, 1530, 1730, 2030];
  R(PA, h => `Panel 3D PLUTO PVC ${h}×2500 mm`, 'ks', H3, [317.68, 357.20, 421.80, 545.68, 606.48, 703.00], h => `Plotový panel 3D PLUTO – ${cm(h)} cm, drát 5 mm, zelený/antracit`);
  R(PA, h => `Panel 3D PLUTO HNZ ${h}×2500 mm`, 'ks', H3, [432.44, 490.20, 558.60, 687.04, 766.84, 899.84], h => `Plotový panel 3D PLUTO – ${cm(h)} cm, drát 5 mm, pozink`);
  R(PA, h => `Panel 3D PLUTO LIGHT PVC ${h}×2500 mm`, 'ks', H3, [247.76, 256.12, 290.32, 368.60, 415.72, 482.60], h => `Plotový panel 3D PLUTO LIGHT – ${cm(h)} cm, drát 4 mm, zelený/antracit`);
  R(PA, h => `Panel 3D PLUTO LIGHT HNZ ${h}×2500 mm`, 'ks', H3, [0, 316.16, 362.52, 433.96, 502.36, 580.64], h => `Plotový panel 3D PLUTO LIGHT – ${cm(h)} cm, drát 4 mm, pozink`);
  R(PA, h => `Panel 3D JUPITER PVC ${h}×2500 mm (doprodej)`, 'ks', H3, [241.68, 247.76, 279.68, 333.64, 383.80, 456.00], h => `Plotový panel 3D JUPITER – ${cm(h)} cm, drát 4 mm, zelený (doprodej)`);
  R(PA, h => `Panel 3D JUPITER HNZ ${h}×2500 mm (doprodej)`, 'ks', H3, [292.60, 316.92, 364.80, 437.00, 490.20, 577.60], h => `Plotový panel 3D JUPITER – ${cm(h)} cm, drát 4 mm, pozink (doprodej)`);
  const H2 = [830, 1030, 1230, 1430, 1630, 1830, 2030];
  R(PA, h => `Panel 2D DOUBLE 6/5/6 PVC ${h}×2500 mm`, 'ks', H2, [389.88, 449.92, 532.00, 613.32, 695.40, 773.68, 858.80], h => `Plotový panel 2D DOUBLE – ${cm(h)} cm, drát 6/5/6 mm, zelený/antracit`);
  R(PA, h => `Panel 2D DOUBLE 6/5/6 HNZ ${h}×2500 mm`, 'ks', H2, [615.60, 677.16, 801.04, 918.08, 986.48, 1107.32, 1231.20], h => `Plotový panel 2D DOUBLE – ${cm(h)} cm, drát 6/5/6 mm, pozink`);
  R(PA, h => `Panel 2D DOUBLE 5/4/5 LIGHT PVC ${h}×2500 mm`, 'ks', H2, [352.64, 405.84, 450.68, 516.80, 570.00, 623.20, 680.96], h => `Plotový panel 2D DOUBLE LIGHT – ${cm(h)} cm, drát 5/4/5 mm, zelený/antracit`);

  // --- Sloupky k panelům ---
  const PS = 'mat-pan-sloupky';
  const HG = [1600, 1800, 2000, 2200, 2400, 2600, 2800, 3000];
  R(PS, h => `Sloupek GALAXIA PVC ${h} mm`, 'ks', HG, [140.60, 158.08, 175.56, 193.04, 210.52, 228.00, 249.28, 267.52], h => `Sloupek 60x40 mm zelený/antracit PVC, výška ${cm(h)} cm`);
  R(PS, h => `Sloupek GALAXIA PVC s patkou ${h} mm`, 'ks', [1200, 1400, 1600, 1800, 2100], [252.32, 280.44, 307.80, 335.92, 377.72], h => `Sloupek 60x40 mm zelený/antracit PVC s navařenou patkou, výška ${cm(h)} cm`);
  R(PS, h => `Sloupek GALAXIA HNZ ${h} mm`, 'ks', HG, [257.64, 289.56, 322.24, 354.16, 386.08, 418.76, 450.68, 482.60], h => `Sloupek 60x40 mm pozink Zn, výška ${cm(h)} cm`);
  R(PS, h => `Sloupek GALAXIA HNZ s patkou ${h} mm`, 'ks', [1200, 1400, 1600, 1800, 2100], [323.00, 341.24, 379.24, 412.68, 466.64], h => `Sloupek 60x40 mm pozink Zn s navařenou patkou, výška ${cm(h)} cm`);
  const H60 = [1700, 2000, 2200, 2400, 2600, 3000];
  R(PS, h => `Sloupek 60×60 PVC ${h} mm`, 'ks', H60, [239.40, 278.16, 304.76, 330.60, 356.44, 435.48], h => `Sloupek 60x60 mm zelený/antracit PVC, výška ${cm(h)} cm`);
  R(PS, h => `Sloupek 60×60 HNZ ${h} mm`, 'ks', H60, [294.12, 342.00, 374.68, 406.60, 440.04, 524.40], h => `Sloupek 60x60 mm pozink Zn, výška ${cm(h)} cm`);

  // --- Příchytky k panelům ---
  const PP = 'mat-pan-pris';
  M(PP, 'Příchytka panelu ke sloupku GALAXIA PVC', 'ks', 29.18, 'Příchytka panelu na sloupek 60x40 – zelená/antracit');
  M(PP, 'Příchytka panelu ke sloupku GALAXIA HNZ', 'ks', 29.18, 'Příchytka panelu na sloupek 60x40 – pozink');
  M(PP, 'Příchytka panelu ke sloupku Ø 48/60 mm PVC', 'ks', 29.18, 'Příchytka panelu na kulatý sloupek Ø 48/60 mm – zelená');
  M(PP, 'Příchytka panelu ke sloupku Ø 48/60 mm HNZ', 'ks', 28.20, 'Příchytka panelu na kulatý sloupek Ø 48/60 mm – pozink');
  M(PP, 'Příchytka NYLOFOR 2D plast', 'ks', 17.48, 'Příchytka panelu 2D plastová (NYLOFOR)');
  M(PP, 'Příchytka NYLOFOR 3D plast', 'ks', 19.00, 'Příchytka panelu 3D plastová (NYLOFOR)');
  M(PP, 'Příchytka PVC univerzální samořezná 40 mm', 'ks', 18.62, 'Příchytka panelu univerzální plastová, samořezná');
  M(PP, 'Příchytka AW na sloupek', 'ks', 8.06, 'Příchytka panelu AW (drátěná)');
  M(PP, 'Příchytka „U43“ na panel PVC', 'ks', 20.29, 'Příchytka panelu U43 – zelená');
  M(PP, 'Příchytka L-clip na panel PVC', 'ks', 4.79, 'Příchytka panelu L-clip – zelená');
  M(PP, 'Spojka panelů PVC', 'ks', 16.95, 'Spojka panelů – zelená');
  M(PP, 'Čepička na sloupek GALAXIA / 60×40', 'ks', 7.68, 'Čepička na sloupek 60x40 mm');
  M(PP, 'Šroub TEX 6,3×38 k příchytce 2D (1000 ks)', '1000 ks', 5244.00, 'Šrouby TEX 6,3×38 k příchytce 2D (balení 1000 ks)');
  M(PP, 'Šroub TEX 6,3×50 k příchytce 3D (1000 ks)', '1000 ks', 6555.00, 'Šrouby TEX 6,3×50 k příchytce 3D (balení 1000 ks)');
  M(PP, 'Vymezovač do příchytek (1000 ks)', '1000 ks', 1535.88, 'Vymezovač do příchytek (balení 1000 ks)');

  // --- Podhrabové desky a držáky ---
  const PD = 'mat-pd';
  M(PD, 'Podhrabová deska 2450×200×50 mm', 'ks', 522.12, 'Betonová podhrabová deska 2450 x 200 x 50 mm');
  M(PD, 'Podhrabová deska 2450×300×50 mm', 'ks', 621.68, 'Betonová podhrabová deska 2450 x 300 x 50 mm');
  M(PD, 'Podhrabová deska 2500×200×40 mm', 'ks', 296.40, 'Betonová podhrabová deska 2500 x 200 x 40 mm');
  M(PD, 'Podhrabová deska 2500×200×50 mm', 'ks', 386.84, 'Betonová podhrabová deska 2500 x 200 x 50 mm');
  M(PD, 'Podhrabová deska 2500×300×50 mm', 'ks', 562.40, 'Betonová podhrabová deska 2500 x 300 x 50 mm');
  M(PD, 'Podhrabová deska 2950×200×50 mm', 'ks', 585.96, 'Betonová podhrabová deska 2950 x 200 x 50 mm');
  M(PD, 'Podhrabová deska 2950×300×50 mm', 'ks', 687.04, 'Betonová podhrabová deska 2950 x 300 x 50 mm');
  M(PD, 'Kazetová podhrabová deska 2500×200×50 mm', 'ks', 307.80, 'Betonová podhrabová deska kazetová 2500 x 200 x 50 mm');
  M(PD, 'Kazetová podhrabová deska 2500×300×50 mm', 'ks', 431.68, 'Betonová podhrabová deska kazetová 2500 x 300 x 50 mm');
  M(PD, 'Držák PD plastový na sloupek BPL 48 mm', 'ks', 57.91, 'Držák podhrabové desky plastový na kulatý sloupek Ø 48 mm');
  M(PD, 'Držák PD plastový na sloupek 60×40 mm', 'ks', 76.99, 'Držák podhrabové desky plastový na sloupek 60x40 mm');
  M(PD, 'Držák PD ZN koncový U 50×200 mm', 'ks', 60.04, 'Držák podhrabové desky koncový 200 mm (Zn)');
  M(PD, 'Držák PD ZN koncový U 50×300 mm', 'ks', 79.04, 'Držák podhrabové desky koncový 300 mm (Zn)');
  M(PD, 'Držák PD ZN průběžný 50×200 mm, sloup 48', 'ks', 92.72, 'Držák podhrabové desky průběžný 200 mm na sloupek Ø 48 (Zn)');
  M(PD, 'Držák PD ZN průběžný 50×300 mm, sloup 48', 'ks', 124.64, 'Držák podhrabové desky průběžný 300 mm na sloupek Ø 48 (Zn)');
  M(PD, 'Držák PD ZN rohový 50×200 mm, sloup 48', 'ks', 240.92, 'Držák podhrabové desky rohový 200 mm na sloupek Ø 48 (Zn)');
  M(PD, 'Držák PD ZN rohový 50×300 mm, sloup 48', 'ks', 321.48, 'Držák podhrabové desky rohový 300 mm na sloupek Ø 48 (Zn)');
  M(PD, 'Držák vzpěry na podhrabovou desku U50+38', 'ks', 87.40, 'Držák vzpěry na podhrabovou desku');

  // --- Svařované pletivo ---
  const SV = 'mat-svar';
  R(SV, h => `Svařované pletivo E-Plast 100×50, 2,2 mm, výška ${h} cm`, 'm', [40, 60, 80, 100, 120, 150, 180, 200], [15.20, 18.24, 24.17, 30.10, 36.40, 45.14, 54.26, 60.57], h => `Svařované pletivo zelené E-Plast, výška ${h} cm, drát 2,2 mm, oko 100x50 mm`);
  R(SV, h => `Svařované pletivo H-Plast 100×50, 2,5 mm, výška ${h} cm`, 'm', [60, 80, 100, 120, 150, 180, 200], [25.54, 34.28, 42.71, 51.45, 64.37, 76.99, 85.73], h => `Svařované pletivo zelené/antracit H-Plast, výška ${h} cm, drát 2,5 mm, oko 100x50 mm`);
  R(SV, h => `Svařované pletivo V-Plast 50×50, 2,5 mm, výška ${h} cm`, 'm', [100, 120, 150, 180, 200], [45.14, 54.11, 67.64, 81.09, 90.14], h => `Svařované pletivo zelené V-Plast, výška ${h} cm, drát 2,5 mm, oko 50x50 mm`);
  R(SV, h => `Sloupek AQUIGRAF Ø 48 mm, ${h} cm`, 'ks', [150, 180, 200, 220, 250], [139.08, 167.20, 185.44, 238.64, 290.32], h => `Sloupek ke svařovanému pletivu AQUIGRAF zelený Ø 48 mm, výška ${h} cm`);
  M(SV, 'Příchytky AGRAFES nerez (1000 ks)', '1000 ks', 1653.68, 'Příchytky na svařované pletivo AGRAFES (balení 1000 ks)');

  // --- Branky a brány ---
  const B = 'mat-brany';
  const HB = [1000, 1250, 1500, 1600, 1800, 2000];
  R(B, h => `Branka GARDEN jednokřídlá ${h}×1000 mm`, 'ks', HB, [2334.72, 2410.72, 2615.16, 2733.72, 2952.60, 3182.88], h => `Branka zahradní GARDEN (pletivo), výška ${cm(h)} × šířka 100 cm`);
  R(B, h => `Brána GARDEN dvoukřídlá ${h}×3600 mm`, 'ks', HB, [4981.04, 5443.12, 5649.08, 5755.48, 6197.04, 6719.92], h => `Brána dvoukřídlá GARDEN (pletivo), výška ${cm(h)} × šířka 360 cm`);
  R(B, h => `Branka ECO jednokřídlá ${h}×1000 mm`, 'ks', HB, [2585.52, 2941.20, 3451.92, 3610.00, 3992.28, 4053.08], h => `Branka zahradní ECO (svař. rohož), výška ${cm(h)} × šířka 100 cm`);
  R(B, h => `Brána ECO dvoukřídlá ${h}×3600 mm`, 'ks', HB, [5237.16, 5538.88, 6257.84, 6571.72, 7997.48, 8672.36], h => `Brána dvoukřídlá ECO (svař. rohož), výška ${cm(h)} × šířka 360 cm`);
  const HO = [1000, 1200, 1500, 1700, 2000];
  R(B, h => `Branka ORION jednokřídlá ${h}×1000 mm`, 'ks', HO, [2991.36, 3087.12, 3553.00, 3917.04, 4674.76], h => `Branka zahradní ORION (panel), výška ${cm(h)} × šířka 100 cm`);
  R(B, h => `Branka UNIVERZAL jednokřídlá ${h}×1000 mm`, 'ks', HO, [4774.32, 4774.32, 4949.88, 5671.12, 0], h => `Branka zahradní UNIVERZAL (panel, pozink+PVC), výška ${cm(h)} × šířka 100 cm`);
  R(B, h => `Brána ORION dvoukřídlá ${h}×4000 mm`, 'ks', HO, [5474.28, 5854.28, 7530.08, 9104.80, 10724.36], h => `Brána dvoukřídlá ORION (panel), výška ${cm(h)} × šířka 400 cm`);
  R(B, h => `Brána UNIVERZAL dvoukřídlá ${h}×4000 mm`, 'ks', HO, [10861.16, 11841.56, 14811.64, 16782.32, 0], h => `Brána dvoukřídlá UNIVERZAL (panel, pozink+PVC), výška ${cm(h)} × šířka 400 cm`);
  M(B, 'Automatika pro posuvnou bránu (pohon ROGER TW90, anténa…)', 'ks', 21883.44, 'Pohon pro posuvnou bránu ROGER TW90 (motor, anténa…)');
  M(B, 'Ozubená lišta k pohonu', 'm', 650.56, 'Ozubená hřebenová lišta k pohonu');
  M(B, 'Fotobuňky (set 2 ks)', 'ks', 956.84, 'Fotobuňky k pohonu (sada 2 ks)');
  M(B, 'Dodatečné dálkové ovládání', 'ks', 497.80, 'Dálkový ovladač k pohonu');
  M(B, 'Elektrodoraz – příplatek k brance BJ Speciál', 'ks', 1722.16);

  // --- Ostatní ---
  const O = 'mat-ostatni';
  M(O, 'Stínící výplet do panelů 4,8 cm / 35 m + 20 lišt (balík)', 'balík', 184.15, 'Stínící páska do panelů 4,8 cm, role 35 m + 20 lišt');
  M(O, 'Stínící výplet do panelů 19 cm / 35 m + 20 lišt (balík)', 'balík', 460.33, 'Stínící páska do panelů 19 cm, role 35 m + 20 lišt');
  R(O, h => `Stínící úplet 180 g zelený, výška ${h} cm`, 'm', [100, 120, 150, 180, 200], [21.05, 25.23, 31.54, 37.77, 42.03], h => `Stínící tkanina na pletivo zelená 180 g, výška ${h} cm`);
  M(O, 'Ostnatý drát ZN 50 m', 'bal', 209.00, 'Ostnatý drát pozinkovaný Zn, 50 m');
  M(O, 'Ostnatý drát ZN 100 m', 'bal', 378.48, 'Ostnatý drát pozinkovaný Zn, 100 m');
  M(O, 'Ostnatý drát ZN 250 m', 'bal', 887.68, 'Ostnatý drát pozinkovaný Zn, 250 m');
  M(O, 'Ostnatý drát PVC 50 m', 'bal', 243.96, 'Ostnatý drát zelený PVC, 50 m');
  M(O, 'Ostnatý drát PVC 100 m', 'bal', 429.40, 'Ostnatý drát zelený PVC, 100 m');
  M(O, 'Žiletkový drát CONCERTINA Ø 450 mm (8 m)', 'bal', 437.76, 'Žiletkový drát Concertina Ø 45 cm (cca 8 m)');
  M(O, 'Žiletkový drát CONCERTINA Ø 700 mm (10 m)', 'bal', 656.64, 'Žiletkový drát Concertina Ø 70 cm (cca 10 m)');
  M(O, 'Bavolet Ø 48 mm AL+PVC', 'ks', 197.37, 'Bavolet na kulatý sloupek Ø 48 mm');
  M(O, 'Bavolet Ø 60 mm AL+PVC', 'ks', 216.14, 'Bavolet na kulatý sloupek Ø 60 mm');
  M(O, 'Bavolet 60×40 mm AL+PVC', 'ks', 216.14, 'Bavolet na sloupek 60x40 mm');
  M(O, 'Bavolet „Y“ 48 mm AL+PVC', 'ks', 394.67, 'Bavolet do V na sloupek Ø 48 mm');
  M(O, 'Bavolet „Y“ 60 mm AL+PVC', 'ks', 507.38, 'Bavolet do V na sloupek Ø 60 mm');
  M(O, 'Zemní vrut 60×1,7×550 (BPL/Zn 38, 48 mm)', 'ks', 160.82, 'Zemní vrut 550 mm na kulatý sloupek Ø 38/48');
  M(O, 'Zemní vrut 68×1,5×650 (BPL/Zn 38, 48 mm)', 'ks', 194.03, 'Zemní vrut 650 mm na kulatý sloupek Ø 38/48');
  M(O, 'Zemní vrut 80×2,5×800 (Zn, BPL 48, Galaxia)', 'ks', 389.12, 'Zemní vrut 800 mm na sloupek Ø 48 / 60x40');
  M(O, 'Zavrtávací klíč', 'ks', 762.20, 'Zavrtávací klíč na zemní vruty');
  M(O, 'Gabionová síť 100×100 cm, oko 100×100', 'ks', 89.53);
  M(O, 'Gabionová síť 200×100 cm, oko 100×100', 'ks', 171.46);
  M(O, 'Gabionová síť 100×100 cm, oko 100×50', 'ks', 125.70);
  M(O, 'Gabionová síť 200×100 cm, oko 100×50', 'ks', 266.68);
  M(O, 'Gabion – spojovací spirála 110 cm', 'ks', 9.73);
  M(O, 'Gabion – distanční táhlo 50 cm', 'ks', 5.40);
  M(O, 'Svařovaná rohož FE 50×50×4, 1000×2000 mm', 'ks', 312.82);
  M(O, 'Svařovaná rohož FE 50×50×4, 1500×2000 mm', 'ks', 498.94);
  return out;
})();
