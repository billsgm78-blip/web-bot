/* =====================================================================
   Bilols AI — SAYT DIZAYNI: ◐ Premium (och, oq — pipdot / Cognivo / Crisply uslubi).
   Boshqa dizaynlar (Neon, Axiom) olib tashlangan; tanlash yo'q.
   Bu fayl faqat ko'rinishni o'zgartiradi.
   ===================================================================== */
(function () {
    var root = document.documentElement;
    try { localStorage.removeItem('bilols_design_live'); } catch (e) {}   // eski tanlov keshi

    /* Premium — och dizayn: saytning tayyor "yorug' rejimi" ustiga quriladi,
       shuning uchun barcha oynalar (hamyon, sozlamalar, yordam...) ham och bo'ladi. */
    var fontAdded = false;
    function addFont() {
        if (fontAdded) return; fontAdded = true;
        var l = document.createElement('link');
        l.rel = 'stylesheet';
        l.href = 'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Inter+Tight:wght@400;500;600;700&display=swap';
        document.head.appendChild(l);
    }
    function userWantsLight() { try { return localStorage.getItem('bilol_ai_light') === '1'; } catch (e) { return false; } }
    function syncLight() {
        var b = document.body;
        if (!b || root.getAttribute('data-page') === 'sub') return;
        var prem = root.getAttribute('data-design') === 'premium';
        if (prem && !b.classList.contains('theme-light')) b.classList.add('theme-light');
        if (!prem && b.classList.contains('theme-light') && b.hasAttribute('data-pm-light') && !userWantsLight()) b.classList.remove('theme-light');
        if (prem) b.setAttribute('data-pm-light', ''); else b.removeAttribute('data-pm-light');
        var meta = document.querySelector('meta[name="theme-color"]');
        if (meta && prem) meta.setAttribute('content', '#f6f3ec');
    }
    var watching = false;
    function watchBody() {
        if (watching || !document.body) return; watching = true;
        // sozlamalardagi "yorug' rejim" kodi klassni olib tashlasa — Premium'da qaytaramiz
        new MutationObserver(function () { if (root.getAttribute('data-design') === 'premium') syncLight(); })
            .observe(document.body, { attributes: true, attributeFilter: ['class'] });
        syncLight();
    }

    function apply() {
        root.setAttribute('data-design', 'premium');
        addFont();
        syncLight();
    }

    // Fon qatlamlari (faqat transform/opacity bilan harakatlanadi — telefonni qiynamaydi)
    function mount() {
        if (!document.body) return;
        watchBody();
        if (document.getElementById('ds-bg')) return;
        var bg = document.createElement('div');
        bg.id = 'ds-bg';
        bg.setAttribute('aria-hidden', 'true');
        var html = '<i class="l1"></i><i class="l2"></i><i class="l3"></i><i class="l4"></i>';
        for (var i = 0; i < 12; i++) html += '<b></b>';
        bg.innerHTML = html;
        document.body.insertBefore(bg, document.body.firstChild);
    }

    window.BILOLS_DESIGN = { current: 'premium', mount: mount };
    apply();
    if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);
})();
