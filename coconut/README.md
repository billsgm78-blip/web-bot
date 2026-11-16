# 🥥 Coconut Simulator — coconut.bilolsai.uz

Kokosni bosib coin yig'adigan o'yin: ishchilar, upgrade'lar, 6 ta kiyimli skin, ⌨️ qiyin inglizcha so'zlarni yozish (copy-paste yo'q), prestij, yutuqlar.

- `index.html` — sahifa va dizayn, `app.js` — o'yin mantig'i.
- `api/bl.js` — Bilols AI API proksi (Google bilan kirish: `qr/new`, `qr/poll`, `auth-check`, `session/logout`).
- O'yinchi ID va admin bergan coinlar — Supabase edge function `coconut` (jadvallar `coco_players`, `coco_grants`).
  Admin: admin.bilolsai.uz → 🥥 Coconut o'yini.

## Imkoniyatlar (v2)
- 🏆 Reyting: jami coin, shu hafta (dushanbadan), so'zlar. Server tasdiqlagan coinlar hisoblanadi.
- ☁️ Bulutda saqlash: Bilols AI hisobi bilan kirganlar — progress serverda, boshqa qurilmada ham ochiladi.
- 🎁 Kunlik bonus: ketma-ket kunlar uchun kattaroq; 7 kun — 🌺 «Tropik qahramon» skini.
- 🛡 Aldovdan himoya: server ikki sync orasidagi o'sishni cheklaydi, shubhalilar admin panelda ⚠️ bilan.
- ⌨️ So'z: 3 daraja, 🇺🇿→🇬🇧 tarjima rejimi (x1.5), 🔊 talaffuz.
- Admin: hammaga coin berish/ayirish, xabar (e'lon), ⚡ event (xN coin), 🚫 bloklash.

Server kodi nusxasi: `supabase/coconut-edge.ts` (o'zgartirilsa — Supabase'ga qayta deploy qilinadi).

Deploy: Vercel loyihasi `coconut-simulator`, root directory = `coconut`.
