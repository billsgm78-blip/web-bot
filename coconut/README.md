# 🥥 Coconut Simulator — coconut.bilolsai.uz

Kokosni bosib coin yig'adigan o'yin: ishchilar, upgrade'lar, 6 ta kiyimli skin, ⌨️ qiyin inglizcha so'zlarni yozish (copy-paste yo'q), prestij, yutuqlar.

- `index.html` — sahifa va dizayn, `app.js` — o'yin mantig'i.
- `api/bl.js` — Bilols AI API proksi (Google bilan kirish: `qr/new`, `qr/poll`, `auth-check`, `session/logout`).
- O'yinchi ID va admin bergan coinlar — Supabase edge function `coconut` (jadvallar `coco_players`, `coco_grants`).
  Admin: admin.bilolsai.uz → 🥥 Coconut o'yini.

Deploy: Vercel loyihasi `coconut-simulator`, root directory = `coconut`.
