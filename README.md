# Kalkulace plotů, nabídky a faktury

Web pro tátu: výpočet ceny zakázky (montáž + materiál + beton + doprava) → cenová nabídka → po potvrzení faktura s QR platbou.

## Jak se to používá

1. **Zakázka** – naklikáš plot (druh, podhrabová deska 20/30 cm, výška, délka), branky/brány (patka, pohon, 3D/WPC), materiál z ceníku RETIC (vyhledávání), beton (odhad 0,03 m³ na sloupek, cena za m³ se zadá u zakázky) a km dopravy.
2. **Vytvořit cenovou nabídku** – vznikne nabídka N2026xxxx se všemi položkami (práce, materiál, beton, doprava). Dá se upravovat; když se zakázka změní, tlačítkem „Aktualizovat nabídku“ se přepíše.
3. **Nabídky** – stavy Koncept → Odeslaná → Potvrzená / Zamítnutá. Z potvrzené nabídky tlačítko **Vytvořit fakturu**.
4. **Faktury** – přehled za rok (vyfakturováno, zaplaceno, čeká, po splatnosti), filtr, odškrtávání zaplacení, tisk / PDF s **QR platbou** (IBAN se dopočítá z čísla účtu).

Přirážka: práce +30 %, materiál +30 %, beton bez přirážky (vše v Nastavení).
Ceníky: práce – „Ceník prací pro montážní partnery“ (rev. 3. 11. 2026), materiál – RETIC CZ PARTNER (od 1. 10. 2026, bez DPH).

## Ukládání dat

Na Cloudflare se data ukládají do databáze D1 přes Worker (`src/worker.js`), takže jsou stejná na každém zařízení. Přístup je chráněný heslem.
Otevřené ze souboru (`public/index.html`) se data ukládají jen v prohlížeči. V Nastavení je i záloha do souboru.

## Nasazení (jednou)

```bash
npx wrangler d1 create tata-db          # vypíše database_id → vlož do wrangler.jsonc
npx wrangler secret put APP_PASSWORD    # heslo, které se bude zadávat na webu
npx wrangler deploy
```

Lokálně: `echo APP_PASSWORD=heslo > .dev.vars && npx wrangler dev`.
