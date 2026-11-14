# Kalkulace plotů a faktury

Jednoduchý web pro tátu: výpočet ceny zakázky (montáž plotů, branek, bran, pohonů) a vystavení faktury.

- **Zakázka** – rychlé přidání plotu (pletivo, 2D, 3D, betonový…, s/bez podhrabové desky 20/30 cm), branek a bran (patka, pohon, 3D/WPC příplatek), cokoliv z ceníku nebo vlastní řádek. Pásmo A/B/C (0–25 / 26–150 / 151+ m) se volí automaticky podle délky, jde přepnout ručně. Cenu na řádku jde přepsat.
- **Přirážka 30 %** na všechny ceny z ceníku (měnitelná v Nastavení), doprava 12 Kč/km (min. 500 Kč), hlídání minimální ceny montáže 3 500 Kč.
- **Ceník** – předvyplněný podle „Ceník prací pro montážní partnery“ (rev. 3. 11. 2026), vše editovatelné, vlastní položky.
- **Faktury** – vytvoření ze zakázky, ruční úprava všech polí a řádků, tisk / uložení do PDF, číslování RRRRNNNN, plátce/neplátce DPH.
- **Tisk cenové nabídky** ze zakázky.

Data se ukládají v prohlížeči (localStorage) – v Nastavení je záloha/obnova do JSON.

## Spuštění

Stačí otevřít `public/index.html`. Nasazení na Cloudflare: `npx wrangler deploy`.
