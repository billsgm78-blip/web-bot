/* =====================================================================
   Bilols AI — SAYT DIZAYNI: ▲ Axiom (qora + to'q sariq).
   Boshqa dizaynlar (Neon, Premium) olib tashlangan; tanlash yo'q.
   Bu fayl faqat ko'rinishni o'zgartiradi.
   ===================================================================== */
(function () {
    var root = document.documentElement;
    root.setAttribute('data-design', 'axiom');
    try { localStorage.removeItem('bilols_design_live'); } catch (e) {}   // eski tanlov keshi

    var l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Inter+Tight:wght@400;500;600;700&display=swap';
    document.head.appendChild(l);

    // Fon qatlamlari (faqat transform/opacity bilan harakatlanadi — telefonni qiynamaydi)
    function mount() {
        if (!document.body || document.getElementById('ds-bg')) return;
        var bg = document.createElement('div');
        bg.id = 'ds-bg';
        bg.setAttribute('aria-hidden', 'true');
        var html = '<i class="l1"></i><i class="l2"></i><i class="l3"></i><i class="l4"></i>';
        for (var i = 0; i < 12; i++) html += '<b></b>';
        bg.innerHTML = html;
        document.body.insertBefore(bg, document.body.firstChild);
    }

    window.BILOLS_DESIGN = { current: 'axiom', mount: mount };
    if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);
})();
