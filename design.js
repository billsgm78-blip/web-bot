/* =====================================================================
   Bilols AI — SAYT DIZAYNI
   Saytdagi hamma foydalanuvchi shu yerda tanlangan dizaynni ko'radi.

   👉 Dizaynni almashtirish uchun faqat pastdagi ACTIVE qatorini o'zgartiring:
        'cosmic'  — 🌌 Kosmik (yulduzlar, tumanlik, sayyora nuri)
        'current' — ✨ Hozirgi (avvalgi neon dizayn, o'zgarishsiz)
        'smooth'  — ⚡ Silliq (eng yengil: effektsiz, har qanday telefonda tez)

   Admin panel → 🎨 Dizayn bo'limida 3 tasini ko'rib chiqish mumkin.
   ===================================================================== */
(function () {
    var ACTIVE = 'cosmic';

    var LIST = {
        cosmic:  { name: 'Kosmik',  emoji: '🌌' },
        current: { name: 'Hozirgi', emoji: '✨' },
        smooth:  { name: 'Silliq',  emoji: '⚡' }
    };
    var KEY = 'bilols_design_preview';   // faqat admin o'z qurilmasida sinab ko'rishi uchun
    var d = LIST[ACTIVE] ? ACTIVE : 'current';
    var preview = null;
    try {
        var q = new URLSearchParams(location.search).get('design');
        if (q === 'off') { localStorage.removeItem(KEY); }
        else if (q && LIST[q]) { preview = q; }
        else { var s = localStorage.getItem(KEY); if (s && LIST[s]) preview = s; }
    } catch (e) {}
    if (preview) d = preview;

    var root = document.documentElement;
    root.setAttribute('data-design', d);
    // Silliq dizayn: saytning mavjud "yengil rejimi" ham yoqiladi (og'ir effektlar o'chadi)
    if (d === 'smooth') root.classList.add('lite');

    window.BILOLS_DESIGN = { active: ACTIVE, current: d, preview: preview, list: LIST, key: KEY };
})();
