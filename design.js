/* =====================================================================
   Bilols AI — SAYT DIZAYNI
   3 ta dizayn: 🌌 Kosmik · ✨ Modern · 🏛 Klassik
   Admin panel → 🎨 Dizayn → bitta tugma: hamma foydalanuvchida avtomat almashadi
   (tanlov /api/design orqali saqlanadi). Bu fayl faqat ko'rinishni o'zgartiradi.
   ===================================================================== */
(function () {
    var DEFAULT = 'cosmic';
    var LIST = {
        cosmic:  { name: 'Kosmik',  emoji: '🌌' },
        modern:  { name: 'Modern',  emoji: '✨' },
        classic: { name: 'Klassik', emoji: '🏛' }
    };
    var OLD = { current: 'modern', smooth: 'modern' };   // eski nomlar
    var CACHE = 'bilols_design_live';
    var root = document.documentElement;

    function norm(d) { d = OLD[d] || d; return LIST[d] ? d : null; }
    var forced = null;
    try { forced = norm(new URLSearchParams(location.search).get('design')); } catch (e) {}
    var cached = null;
    try { cached = norm(localStorage.getItem(CACHE)); } catch (e) {}

    function apply(d) {
        root.setAttribute('data-design', d);
        window.BILOLS_DESIGN.current = d;
    }

    // Fon qatlamlari (faqat transform/opacity bilan harakatlanadi — telefonni qiynamaydi)
    function mount() {
        if (document.getElementById('ds-bg') || !document.body) return;
        var bg = document.createElement('div');
        bg.id = 'ds-bg';
        bg.setAttribute('aria-hidden', 'true');
        var html = '<i class="l1"></i><i class="l2"></i><i class="l3"></i><i class="l4"></i>';
        for (var i = 0; i < 12; i++) html += '<b></b>';
        bg.innerHTML = html;
        document.body.insertBefore(bg, document.body.firstChild);
    }

    window.BILOLS_DESIGN = {
        list: LIST, current: null, cacheKey: CACHE, mount: mount,
        set: function (d) { d = norm(d); if (!d) return; try { localStorage.setItem(CACHE, d); } catch (e) {} if (!forced) apply(d); }
    };
    apply(forced || cached || DEFAULT);
    if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);

    // Admin tanlagan dizaynni serverdan olamiz (keyingi ochilishda darhol to'g'ri chiqadi)
    try {
        fetch('/api/design', { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
            var d = j && norm(j.design);
            if (d) window.BILOLS_DESIGN.set(d);
        }).catch(function () {});
    } catch (e) {}
})();
