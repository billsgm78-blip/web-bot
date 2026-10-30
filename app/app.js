/* Bilols AI — Android ilova (alohida dizayn, o'sha server).
   Sayt bilan bir xil API: Railway (hisob, hamyon, do'kon, yordam) va bilolsai.uz (AI chat, rasm). */
(function () {
    'use strict';
    var RAIL = 'https://bilolsai-api.onrender.com';
    var SITE = 'https://www.bilolsai.uz';
    var VERSION = (window.BilolsNative && BilolsNative.version && BilolsNative.version()) || '3.1.0';
    var N = window.BilolsNative || null;
    var $ = function (id) { return document.getElementById(id); };

    function ls(k, v) {
        try {
            if (v === undefined) return localStorage.getItem(k);
            if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v);
        } catch (e) { return null; }
    }
    function lsJSON(k, def) { try { var v = JSON.parse(ls(k) || 'null'); return v == null ? def : v; } catch (e) { return def; } }

    /* ================= Tillar ================= */
    var lang = ls('ba_lang') || 'uz';
    function L(uz, ru, en) { return lang === 'ru' ? (ru || uz) : lang === 'en' ? (en || uz) : uz; }
    var D = {
        retry: ["Qayta urinish", "Повторить", "Try again"],
        privacy: ["Maxfiylik siyosati", "Политика конфиденциальности", "Privacy policy"],
        authSub: ["Shaxsiy AI yordamchingiz", "Ваш личный AI-помощник", "Your personal AI assistant"],
        login: ["Kirish", "Вход", "Log in"],
        register: ["Ro'yxatdan o'tish", "Регистрация", "Sign up"],
        name: ["Ismingiz", "Ваше имя", "Your name"],
        phone: ["Telefon raqam", "Номер телефона", "Phone number"],
        password: ["Parol", "Пароль", "Password"],
        codeLabel: ["Telegram botga kelgan kod", "Код из Telegram-бота", "Code from the Telegram bot"],
        getCode: ["Kod olish", "Получить код", "Get code"],
        verify: ["Tasdiqlash", "Подтвердить", "Confirm"],
        forgot: ["Parolni unutdingizmi?", "Забыли пароль?", "Forgot password?"],
        tChat: ["Chat", "Чат", "Chat"],
        tImage: ["Rasm", "Фото", "Image"],
        tShop: ["Do'kon", "Магазин", "Shop"],
        tWallet: ["Hamyon", "Кошелёк", "Wallet"],
        imgTitle: ["Rasm yaratish", "Создать изображение", "Create an image"],
        imgGo: ["✨ Yaratish", "✨ Создать", "✨ Generate"],
        imgRecent: ["Oxirgi rasmlar", "Последние изображения", "Recent images"],
        shopHint: ["Sotib olganingizdan so'ng admin buyurtmani Telegram hisobingizga bajaradi. Holatini Hamyon → Tarix bo'limida ko'rasiz.",
            "После покупки админ выполнит заказ на ваш Telegram. Статус — в Кошелёк → История.",
            "After purchase the admin delivers the order to your Telegram. Track it in Wallet → History."],
        balance: ["Balans", "Баланс", "Balance"],
        sum: ["so'm", "сум", "UZS"],
        copy: ["Nusxa", "Копировать", "Copy"],
        topup: ["To'ldirish", "Пополнить", "Top up"],
        promo: ["Promo-kod", "Промокод", "Promo code"],
        bonus: ["Bonus", "Бонус", "Bonus"],
        invite: ["Taklif", "Пригласить", "Invite"],
        history: ["Tarix", "История", "History"],
        refresh: ["Yangilash", "Обновить", "Refresh"],
        support: ["Yordam", "Поддержка", "Support"]
    };
    function T(k) { var v = D[k]; return v ? L(v[0], v[1], v[2]) : k; }
    function applyI18n() {
        document.documentElement.lang = lang;
        document.querySelectorAll('[data-t]').forEach(function (e) { e.textContent = T(e.getAttribute('data-t')); });
        pvPaint();
        $('c-in').placeholder = L('Savolingizni yozing…', 'Напишите вопрос…', 'Ask anything…');
        $('sp-in').placeholder = L('Xabar yozing…', 'Напишите сообщение…', 'Write a message…');
        $('i-prompt').placeholder = L("Masalan: tog'lar orasida quyosh botishi, akvarel uslubida", 'Например: закат в горах, акварель', 'E.g. a sunset in the mountains, watercolor');
        $('a-name').placeholder = L('Masalan: Bilol', 'Например: Билол', 'e.g. Bilol');
        paintAuthBtn(); paintAuthHead(); paintLanding();
        if (state.inMain) { paintTitle(); paintModes(); paintModel(); renderChat(); paintIdeas(); paintImgPrice(); paintShop(); paintWalletActs(); paintTpl(); }
    }

    /* ================= Holat ================= */
    var state = {
        phone: ls('ba_phone') || '', pass: ls('ba_pass') || '', name: ls('ba_name') || '',
        balance: null, rewards: null, status: null, models: [], shop: null, tab: 'chat', inMain: false
    };
    function money(n) { return Number(n || 0).toLocaleString('ru-RU').replace(/ | /g, ' '); }
    function esc(s) { var d = document.createElement('div'); d.textContent = s == null ? '' : String(s); return d.innerHTML; }
    function feature(k) { var f = state.status && state.status.features && state.status.features[k]; return f && f.off ? (f.msg || L("Bu funksiya vaqtincha o'chirilgan.", 'Функция временно отключена.', 'This feature is temporarily disabled.')) : ''; }

    /* ================= Tarmoq ================= */
    async function api(path, extra) {
        var body = { phone: state.phone, password: state.pass, lang: lang };
        if (extra) for (var k in extra) body[k] = extra[k];
        var r = await fetch(RAIL + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        var j = {};
        try { j = await r.json(); } catch (e) {}
        j._status = r.status;
        if (r.status === 403 && j.error && /Qaytadan kiring/i.test(j.error) && state.inMain) sessionExpired();
        return j;
    }
    async function getJSON(url) {
        var r = await fetch(url, { cache: 'no-store' });
        return r.json();
    }
    function netErr() { toast(L("Internet yoki server bilan aloqa yo'q", 'Нет связи с сервером', 'No connection to the server'), 'err'); }

    /* ================= Bildirishnoma ================= */
    function toast(msg, type, ms) {
        // Saytdagi kabi xabarnomalar (rang, stiker, ovoz — admin paneldan boshqariladi)
        if (window.BilolNotify) { window.BilolNotify.show(msg, ({ ok: 'success', err: 'error', warn: 'warning' })[type] || 'info'); return; }
        var t = document.createElement('div');
        t.className = 'toast ' + (type || '');
        t.textContent = msg;
        $('toasts').appendChild(t);
        if (type === 'err' && navigator.vibrate) { try { navigator.vibrate(40); } catch (e) {} }
        setTimeout(function () { t.classList.add('out'); setTimeout(function () { t.remove(); }, 260); }, ms || (type === 'err' ? 3800 : 2600));
    }

    /* ================= Pastki oyna ================= */
    var sheetClose = null;
    function openSheet(html, onMount) {
        var sh = $('sheet'), body = $('sheet-body');
        body.innerHTML = html;
        sh.hidden = false;
        requestAnimationFrame(function () { requestAnimationFrame(function () { sh.classList.add('on'); }); });
        if (onMount) onMount(body);
        return new Promise(function (resolve) {
            sheetClose = function (v) {
                sheetClose = null;
                sh.classList.remove('on');
                setTimeout(function () { if (!sheetClose) { sh.hidden = true; body.innerHTML = ''; } }, 260);
                resolve(v);
            };
        });
    }
    function closeSheet(v) { if (sheetClose) sheetClose(v); }
    $('sheet-bg').onclick = function () { closeSheet(false); };
    function ask(title, text, ok, danger) {
        var p = openSheet('<div class="sh-title"></div><p class="sh-sub"></p><div class="sh-row"><button class="btn ghost" data-v="0"></button><button class="btn ' + (danger ? 'danger' : 'primary') + '" data-v="1"></button></div>',
            function (b) {
                b.querySelector('.sh-title').textContent = title;
                b.querySelector('.sh-sub').textContent = text || '';
                b.querySelector('[data-v="0"]').textContent = L('Bekor qilish', 'Отмена', 'Cancel');
                b.querySelector('[data-v="1"]').textContent = ok || L('Ha', 'Да', 'Yes');
                b.querySelectorAll('[data-v]').forEach(function (x) { x.onclick = function () { closeSheet(x.getAttribute('data-v') === '1'); }; });
            });
        return p;
    }

    /* ================= Tashqi havola, nusxa, ulashish ================= */
    var PRIVACY_URL = 'https://www.bilolsai.uz/maxfiylik';
    var pv = { mode: 'view', read: false, loaded: false, ok: ls('ba_privacy_ok') === '1' };
    function pvPaint() {
        if (!pv) return;
        var b = $('pv-ok');
        if (pv.mode === 'view') { b.disabled = false; b.textContent = L('Yopish', 'Закрыть', 'Close'); }
        else {
            b.disabled = !pv.read;
            b.textContent = pv.read ? L("✅ O'qib chiqdim, roziman", '✅ Прочитал(а) и согласен(на)', '✅ I have read and agree') : L("⬇️ Oxirigacha o'qing", '⬇️ Дочитайте до конца', '⬇️ Scroll to the end');
        }
        $('c-box').classList.toggle('on', pv.ok);
        $('c-text').innerHTML = L("Men <a>Maxfiylik siyosati</a>ni o'qib chiqdim va roziman", 'Я прочитал(а) и принимаю <a>Политику конфиденциальности</a>', 'I have read and agree to the <a>Privacy policy</a>');
    }
    function pvScroll() {
        var el = $('pv-body'), max = el.scrollHeight - el.clientHeight, p = max <= 4 ? 1 : el.scrollTop / max;
        $('pv-bar').style.width = Math.min(100, Math.round(p * 100)) + '%';
        if (pv.loaded && !pv.read && p > 0.97) { pv.read = true; pvPaint(); }
    }
    $('pv-body').addEventListener('scroll', pvScroll, { passive: true });
    function openPrivacy(mode) {
        pv.mode = mode || 'view';
        $('privacy').classList.add('on'); pvPaint();
        if (!pv.loaded || pv.lang !== lang) {
            pv.loaded = false;
            $('pv-body').innerHTML = '<div class="skel-row"></div><div class="skel-row"></div><div class="skel-row"></div>';
            fetch('privacy.html').then(function (r) { if (!r.ok) throw 0; return r.text(); }).then(function (h) {
                var a = new DOMParser().parseFromString(h, 'text/html').querySelector('article');
                $('pv-body').innerHTML = a ? a.innerHTML : '';
                // siyosat 3 tilda — faqat ilova tilidagisi qoladi
                var pl = $('pv-body').querySelectorAll('.pv-lang'), has = [].some.call(pl, function (s) { return s.lang === lang; });
                [].forEach.call(pl, function (s) { if (s.lang !== (has ? lang : 'uz')) s.remove(); });
                pv.loaded = true; pv.lang = lang; $('pv-body').scrollTop = 0; pvScroll();
            }).catch(function () {
                $('pv-body').innerHTML = '<p>' + esc(L("Yuklab bo'lmadi. Internetni tekshiring.", 'Не удалось загрузить.', 'Could not load.')) + '</p>';
            });
        } else { $('pv-body').scrollTop = 0; pvScroll(); }
    }
    function closePrivacy() { $('privacy').classList.remove('on'); }
    $('pv-back').onclick = closePrivacy;
    $('pv-ok').onclick = function () {
        if (pv.mode === 'consent') { if (!pv.read) return; pv.ok = true; ls('ba_privacy_ok', '1'); pvPaint(); authMsg(''); }
        closePrivacy();
    };
    $('c-box').onclick = function () { if (pv.ok) { pv.ok = false; ls('ba_privacy_ok', '0'); pvPaint(); } else openPrivacy('consent'); };
    $('c-text').onclick = function (e) { if (e.target.tagName === 'A') openPrivacy('consent'); };
    document.addEventListener('click', function (e) { var t = e.target.closest && e.target.closest('[data-privacy]'); if (t) { e.preventDefault(); openPrivacy(); } });
    function openExternal(url) {
        if (!url) return;
        if (N && N.openExternal) N.openExternal(url); else window.open(url, '_blank');
    }
    function copyText(t) {
        var done = function () { toast(L('Nusxa olindi', 'Скопировано', 'Copied'), 'ok'); };
        if (N && N.copy) { N.copy(t); done(); return; }
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(done, fallback); else fallback();
        function fallback() {
            var ta = document.createElement('textarea'); ta.value = t; document.body.appendChild(ta); ta.select();
            try { document.execCommand('copy'); done(); } catch (e) {}
            ta.remove();
        }
    }
    function shareText(t) {
        if (N && N.share) N.share(t);
        else if (navigator.share) navigator.share({ text: t }).catch(function () {});
        else copyText(t);
    }

    /* ================= Ekranlar ================= */
    // Kompyuter (keng ekran, sichqoncha): boshlang'ich sahifa o'rniga darhol ikki ustunli kirish oynasi
    var deskMq = window.matchMedia ? matchMedia('(min-width: 900px) and (pointer: fine)') : null;
    function isDesk() { return !!(deskMq && deskMq.matches); }
    function paintDesk() {
        document.documentElement.classList.toggle('desk', isDesk());
        if (isDesk() && $('landing').classList.contains('on')) openAuth(auth.mode || 'login');
    }
    function show(id) {
        if (id === 'landing' && isDesk()) { openAuth(auth.mode || 'login'); return; }
        ['splash', 'lock', 'landing', 'auth', 'main'].forEach(function (s) { $(s).classList.toggle('on', s === id); });
        if (id !== 'landing') closeLpMenu();
    }

    /* ================= Sayt holati (blok, e'lon, modellar) ================= */
    async function loadStatus() {
        try { state.status = await getJSON(RAIL + '/api/site-status'); } catch (e) { return state.status; }
        try { ls('ba_status', JSON.stringify(state.status)); } catch (e) {}
        var st = state.status || {};
        state.models = st.models || [];
        if (st.notify && window.BilolNotify) window.BilolNotify.setConfig(st.notify);
        var app = st.app || { lock: !!st.lockAll, lockTitle: st.lockTitle, lockMsg: st.lockMsg };
        try { ls('ba_lock', JSON.stringify({ lock: !!app.lock, lockTitle: app.lockTitle || '', lockMsg: app.lockMsg || '' })); } catch (e) {}
        state.appLocked = !!app.lock;
        // Ilova sayt blokidan alohida: admin paneldagi "Ilovani bloklash"
        if (app.lock) {
            showLock(app.lockTitle || L("Vaqtincha to'xtatildi", 'Временно приостановлено', 'Temporarily unavailable'),
                app.lockMsg || L("Texnik ishlar olib borilmoqda. Tez orada qaytamiz!", 'Идут технические работы. Скоро вернёмся!', 'Maintenance in progress. Back soon!'),
                '🛠', T('retry'), function () { loadStatus(); });
            st.lockAll = true;
            return st;
        }
        st.lockAll = false;
        // Yangi versiya chiqqan bo'lsa
        if (N && app.latest && verLess(appVer(), app.latest)) {
            if (app.force) {
                showLock(L('Yangilash kerak', 'Нужно обновление', 'Update required'), (app.updateMsg || '') + '\n\n' + L('Sizda: v', 'У вас: v', 'You have: v') + appVer() + ' → v' + app.latest,
                    '⬆️', L('Yangilash', 'Обновить', 'Update'), function () { openExternal(app.url); });
                st.lockAll = true;
                return st;
            }
            if (ls('ba_upd_seen') !== app.latest && !state.updAsked) {
                state.updAsked = true;
                setTimeout(function () {
                    ask('⬆️ ' + L('Yangi versiya ', 'Новая версия ', 'New version ') + 'v' + app.latest, app.updateMsg || '', L('Yangilash', 'Обновить', 'Update'))
                        .then(function (ok) { ls('ba_upd_seen', app.latest); if (ok) openExternal(app.url); });
                }, 1500);
            }
        }
        if ($('lock').classList.contains('on') && !state.starting) start();
        paintAnn();
        if (state.inMain) paintModel(); else paintLanding();   // narxlar serverdan kelgach yangilanadi
        return st;
    }
    var lockAction = function () { loadStatus(); };
    $('lock-retry').onclick = function () { lockAction(); };
    function showLock(title, msg, ico, btn, action) {
        $('lock-title').textContent = title;
        $('lock-msg').textContent = msg;
        document.querySelector('#lock .big-ico').textContent = ico || '🛠';
        $('lock-retry').textContent = btn || T('retry');
        lockAction = action || function () { loadStatus(); };
        closeSheet(false); closeSupport();
        show('lock');
    }
    function appVer() { try { return (N && N.version && N.version()) || VERSION; } catch (e) { return VERSION; } }
    function verLess(a, b) {
        var x = String(a || '0').split('.').map(Number), y = String(b || '0').split('.').map(Number);
        for (var i = 0; i < Math.max(x.length, y.length); i++) { var d = (x[i] || 0) - (y[i] || 0); if (d) return d < 0; }
        return false;
    }
    function ping() {
        var day = new Date().toDateString() + '|' + (state.phone || '');
        if (ls('ba_ping') === day) return;
        var dev = ls('ba_dev');
        if (!dev) { dev = 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10); ls('ba_dev', dev); }
        fetch(RAIL + '/api/app/ping', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(state.phone && state.pass ? { device: dev, ver: appVer(), phone: state.phone, password: state.pass } : { device: dev, ver: appVer() }) })
            .then(function (r) { if (r.ok) ls('ba_ping', day); }).catch(function () {});
    }
    function paintAnn() {
        var a = state.status && state.status.announcement;
        var box = $('ann');
        if (!a || !a.text || ls('ba_ann_closed') === String(a.id)) { box.hidden = true; return; }
        box.className = 'ann ' + (a.style || 'info');
        $('ann-text').textContent = (a.title ? a.title + ' — ' : '') + a.text;
        box.hidden = false;
    }
    $('ann-x').onclick = function () { var a = state.status && state.status.announcement; if (a) ls('ba_ann_closed', String(a.id)); $('ann').hidden = true; };

    /* ================= Kirish / ro'yxatdan o'tish ================= */
    var auth = { mode: 'login', waiting: false };
    function normPhone(v) {
        var d = String(v || '').replace(/\D/g, '');
        if (d.length === 12 && d.indexOf('998') === 0) return d;
        if (d.length === 9) return '998' + d;
        return d;
    }
    function authMsg(t, cls) { var m = $('a-msg'); m.textContent = t || ''; m.className = 'auth-msg ' + (cls || ''); }
    function paintAuthBtn() { $('a-go').textContent = auth.waiting ? T('verify') : T('getCode'); }
    function resetOtp() { auth.waiting = false; $('f-code').hidden = true; $('a-code').value = ''; paintAuthBtn(); saveDraft(); }
    /* Kirish jarayoni 5 daqiqa saqlanadi: kodni ko'rish uchun Telegram'ga o'tib qaytganda Android sahifani
       qayta yuklasa ham, raqam va "kod kutilmoqda" holati yo'qolmaydi — kod kiritish joyidan davom etadi. */
    var DRAFT_TTL = 5 * 60 * 1000;
    function saveDraft() {
        try {
            if (state.inMain) { ls('ba_auth_draft', null); return; }
            ls('ba_auth_draft', JSON.stringify({ m: auth.mode, w: auth.waiting, t: auth.waiting ? (auth.sentAt || Date.now()) : Date.now(),
                p: $('a-phone').value, s: $('a-pass').value, n: $('a-name').value, c: $('a-code').value }));
        } catch (e) {}
    }
    function clearDraft() { ls('ba_auth_draft', null); }
    function restoreDraft() {
        var d = lsJSON('ba_auth_draft', null);
        if (!d || !d.t || Date.now() - d.t > DRAFT_TTL) { clearDraft(); return; }
        if (d.m === 'register') { var rb = document.querySelector('#auth-seg [data-mode="register"]'); if (rb) rb.onclick(); }
        $('a-phone').value = d.p || ''; $('a-pass').value = d.s || ''; $('a-name').value = d.n || '';
        if (d.w) {
            auth.waiting = true; auth.sentAt = d.t; auth.sentPhone = normPhone(d.p || '');
            $('f-code').hidden = false; $('a-code').value = d.c || ''; paintAuthBtn();
            authMsg(L('Kod Telegram botingizga yuborilgan 🤖 Kodni kiriting.', 'Код отправлен в ваш Telegram-бот 🤖 Введите его.', 'The code was sent to your Telegram bot 🤖 Enter it.'), 'ok');
        }
        saveDraft();
    }
    ['a-phone', 'a-pass', 'a-name', 'a-code'].forEach(function (id) { $(id).addEventListener('input', function () { saveDraft(); }); });
    document.querySelectorAll('#auth-seg button').forEach(function (b) {
        b.onclick = function () {
            auth.mode = b.getAttribute('data-mode');
            document.querySelectorAll('#auth-seg button').forEach(function (x) { x.classList.toggle('on', x === b); });
            $('f-name').hidden = auth.mode !== 'register';
            $('f-consent').hidden = auth.mode !== 'register'; pvPaint();
            $('a-forgot').hidden = auth.mode !== 'login';
            $('a-pass').autocomplete = auth.mode === 'login' ? 'current-password' : 'new-password';
            paintAuthHead();
            resetOtp(); authMsg('');
        };
    });
    // Faqat raqam HAQIQATAN boshqa raqamga o'zgarsa kod bosqichi bekor bo'ladi.
    // (Android avtomatik to'ldirish/klaviatura kod maydoniga bosilganda raqam maydoniga xuddi shu raqamni
    //  qayta yozadi — ilgari bu kod bosqichini o'chirib, "Tasdiqlash" yana "Kod olish"ga aylanardi.)
    $('a-phone').addEventListener('input', function () {
        if (auth.waiting && normPhone($('a-phone').value) !== auth.sentPhone) resetOtp();
    });
    $('a-eye').onclick = function () { var p = $('a-pass'); p.type = p.type === 'password' ? 'text' : 'password'; };
    function needBot(url) {
        authMsg(L("Avval Telegram botimizga kiring va «Start» bosing, keyin qaytib kod oling.", 'Сначала откройте наш Telegram-бот и нажмите «Start», затем вернитесь за кодом.', 'Open our Telegram bot and press "Start" first, then come back for the code.'), 'err');
        if (url) ask(L('Telegram bot', 'Telegram-бот', 'Telegram bot'), L("Kod Telegram bot orqali keladi. Botni ochib «Start» bosing.", 'Код приходит через Telegram-бот. Откройте бот и нажмите «Start».', 'The code comes via the Telegram bot. Open it and press "Start".'),
            L('Botni ochish', 'Открыть бот', 'Open bot')).then(function (ok) { if (ok) openExternal(url); });
    }
    $('a-go').onclick = async function () {
        var btn = this;
        if (auth.busy) return;   // ikki marta bosilsa — ikkinchi so'rov yuborilmaydi
        var phone = normPhone($('a-phone').value), pass = $('a-pass').value.trim(), name = $('a-name').value.trim();
        if (phone.length !== 12) { authMsg(L("Telefon raqamni to'liq kiriting", 'Введите номер полностью', 'Enter the full phone number'), 'err'); return; }
        if (!pass || pass.length < 4) { authMsg(L("Parol kamida 4 belgi bo'lsin", 'Пароль — минимум 4 символа', 'Password must be at least 4 characters'), 'err'); return; }
        if (auth.mode === 'register' && !name) { authMsg(L('Ismingizni yozing', 'Укажите имя', 'Enter your name'), 'err'); return; }
        if (auth.mode === 'register' && !pv.ok) {
            authMsg(L("Avval Maxfiylik siyosatini o'qib, rozilik bildiring", 'Сначала прочитайте и примите Политику конфиденциальности', 'Please read and accept the Privacy policy first'), 'err');
            var cf = $('f-consent'); cf.classList.remove('shake'); void cf.offsetWidth; cf.classList.add('shake');
            openPrivacy('consent'); return;
        }
        var feat = auth.mode === 'register' ? feature('auth') : '';
        if (feat) { authMsg(feat, 'err'); return; }
        btn.disabled = true; auth.busy = true;
        try {
            if (!auth.waiting) {
                authMsg(L('Yuborilmoqda…', 'Отправка…', 'Sending…'));
                var r = await fetch(RAIL + (auth.mode === 'login' ? '/api/login-code' : '/api/register'), {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ phone: phone, password: pass, name: name, action: 'send_code', lang: lang })
                });
                var j = {}; try { j = await r.json(); } catch (e) {}
                if (j.needBot) { needBot(j.botUrl); return; }
                if (!r.ok || !j.success) { authMsg(j.error || L("Kod yuborib bo'lmadi", 'Не удалось отправить код', 'Could not send the code'), 'err'); return; }
                auth.waiting = true; auth.sentAt = Date.now(); auth.sentPhone = phone;
                $('f-code').hidden = false;
                paintAuthBtn(); saveDraft();
                authMsg(L('Kod Telegram botingizga yuborildi 🤖', 'Код отправлен в ваш Telegram-бот 🤖', 'Code sent to your Telegram bot 🤖'), 'ok');
                setTimeout(function () { $('a-code').focus(); }, 100);
                return;
            }
            var code = $('a-code').value.replace(/\D/g, '');
            if (!code) { authMsg(L('Kodni kiriting', 'Введите код', 'Enter the code'), 'err'); return; }
            authMsg(L('Tekshirilmoqda…', 'Проверка…', 'Checking…'));
            var r2 = await fetch(RAIL + (auth.mode === 'login' ? '/api/login' : '/api/register'), {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone: phone, password: pass, name: name, code: code, action: 'verify', lang: lang })
            });
            var d = {}; try { d = await r2.json(); } catch (e) {}
            if (!r2.ok || !d.success) {
                var em = d.error || L("Kod noto'g'ri", 'Неверный код', 'Wrong code');
                // kod eskirgan / topilmagan / urinishlar tugagan — yangi kod so'rash holatiga qaytamiz
                if (/topilmadi|eskirgan|ko'p xato|so'rang/i.test(em)) { resetOtp(); em += ' 🔄'; }
                authMsg(em, 'err'); return;
            }
            state.phone = phone; state.pass = pass; state.name = d.name || name || '';
            ls('ba_phone', phone); ls('ba_pass', pass); ls('ba_name', state.name);
            if (d.balance != null) state.balance = Number(d.balance);
            resetOtp(); authMsg(''); clearDraft();
            enterMain();
            toast(L('Xush kelibsiz! 👋', 'Добро пожаловать! 👋', 'Welcome! 👋'), 'ok');
        } catch (e) {
            authMsg(L("Server bilan aloqa yo'q. Internetni tekshiring.", 'Нет связи с сервером. Проверьте интернет.', 'No connection. Check your internet.'), 'err');
        } finally { btn.disabled = false; auth.busy = false; }
    };
    $('a-forgot').onclick = async function () {
        var phone = normPhone($('a-phone').value);
        if (phone.length !== 12) { authMsg(L('Avval telefon raqamingizni kiriting', 'Сначала введите номер телефона', 'Enter your phone number first'), 'err'); return; }
        try {
            var r = await fetch(RAIL + '/api/reset/request', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: phone, lang: lang }) });
            var j = {}; try { j = await r.json(); } catch (e) {}
            if (r.ok && j.success) authMsg(L("Telegram botingizga parolni tiklash havolasi yuborildi. O'sha yerda yangi parol o'rnating.", 'Ссылка для сброса пароля отправлена в ваш Telegram-бот.', 'A reset link was sent to your Telegram bot.'), 'ok');
            else authMsg(j.error || 'Error', 'err');
        } catch (e) { netErr(); }
    };
    function paintLangRow(box) {
        box.innerHTML = '';
        [['uz', "O'zbekcha"], ['ru', 'Русский'], ['en', 'English']].forEach(function (l) {
            var b = document.createElement('button');
            b.textContent = l[1];
            if (l[0] === lang) b.className = 'on';
            b.onclick = function () { setLang(l[0]); };
            box.appendChild(b);
        });
    }
    function setLang(l) { lang = l; ls('ba_lang', l); applyI18n(); paintLangRow($('auth-lang')); }

    /* ================= Kirish sahifasi (landing) va menyu ================= */
    var BOT_URL = 'https://t.me/BilolsAIbot';
    function lpMenuOpen() { return $('lp-menu').classList.contains('on'); }
    function openLpMenu() { $('lp-menu').classList.add('on'); $('lp-menu').setAttribute('aria-hidden', 'false'); haptic(); }
    function closeLpMenu() { var m = $('lp-menu'); if (!m) return; m.classList.remove('on'); m.setAttribute('aria-hidden', 'true'); }
    function openAuth(mode) {
        var b = document.querySelector('#auth-seg [data-mode="' + mode + '"]');
        if (b && auth.mode !== mode) b.onclick(); else paintAuthHead();
        show('auth'); haptic();
        $('auth').scrollTop = 0;
    }
    /* ---------- QR orqali kirish (kompyuter): telefon skanerlab tasdiqlaydi — saytdagi bilan bir xil tizim ---------- */
    var QR = { run: 0, timer: 0, id: null, secret: null, ver: 0, exp: 0, scanned: false };
    function qrLib() {
        if (window.qrcode) return Promise.resolve();
        return new Promise(function (res, rej) { var s = document.createElement('script'); s.src = '/vendor/qrcode-generator-1.4.4.js'; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
    }
    async function qrPost(path, body) {
        var r = await fetch(RAIL + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        try { return await r.json(); } catch (e) { return {}; }
    }
    function qrSt(t, cls) { var e = $('qr-st'); e.textContent = t || ''; e.className = 'au-qr-st ' + (cls || ''); }
    function qrBadge(t) { var b = $('qr-badge'); b.hidden = !t; b.textContent = t || ''; $('qr-box').classList.toggle('dim', !!t); }
    function qrOpen() { $('auth').classList.add('qr'); $('au-qr').hidden = false; qrNew(); }
    function qrClose() { QR.run++; clearInterval(QR.timer); $('auth').classList.remove('qr'); $('au-qr').hidden = true; }
    function qrExpired() { QR.run++; clearInterval(QR.timer); qrBadge(L('QR kod eskirdi', 'QR-код устарел', 'QR code expired')); qrSt(''); $('qr-new').hidden = false; }
    function qrTick() {
        var s = Math.max(0, Math.round((QR.exp - Date.now()) / 1000));
        if (s <= 0) return qrExpired();
        if (!QR.scanned) qrSt(L('Kod amal qiladi: ', 'Код действует: ', 'Code valid for: ') + Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'));
    }
    async function qrNew() {
        var run = ++QR.run; clearInterval(QR.timer); QR.scanned = false;
        $('qr-new').hidden = true; qrBadge(''); qrSt('');
        $('qr-box').innerHTML = '<div class="au-qr-spin"></div>';
        try {
            await qrLib();
            var j = await qrPost('/api/qr/new', { ua: navigator.userAgent });
            if (run !== QR.run) return;
            if (!j || !j.success) throw new Error((j && j.error) || '');
            QR.id = j.id; QR.secret = j.secret; QR.ver = 0; QR.exp = Date.now() + (j.ttl || 120) * 1000;
            var q = qrcode(0, 'M'); q.addData('https://www.bilolsai.uz/?qrl=' + encodeURIComponent(j.id)); q.make();
            $('qr-box').innerHTML = q.createSvgTag({ cellSize: 6, margin: 0, scalable: true });
            qrTick(); QR.timer = setInterval(qrTick, 1000);
            qrPoll(run);
        } catch (e) {
            if (run !== QR.run) return;
            $('qr-box').innerHTML = ''; qrBadge(L("QR kod yaratib bo'lmadi", 'Не удалось создать QR-код', 'Could not create a QR code'));
            qrSt((e && e.message) || L('Internetni tekshiring', 'Проверьте интернет', 'Check your internet'), 'err'); $('qr-new').hidden = false;
        }
    }
    async function qrPoll(run) {
        while (run === QR.run) {
            var j = null;
            try { j = await qrPost('/api/qr/poll', { id: QR.id, secret: QR.secret, ver: QR.ver }); } catch (e) {}
            if (run !== QR.run) return;
            if (!j || !j.success) { await new Promise(function (r) { setTimeout(r, 2000); }); continue; }
            if (typeof j.ver === 'number') QR.ver = j.ver;
            if (j.status === 'scanned') {
                QR.scanned = true; QR.exp = Date.now() + 90000;
                qrBadge('📱 ' + L('Skanerlandi', 'Отсканировано', 'Scanned'));
                qrSt((j.name || L('Hisob', 'Аккаунт', 'Account')) + (j.phone ? ' (' + j.phone + ')' : '') + ' — ' + L('telefoningizda tasdiqlang', 'подтвердите на телефоне', 'confirm on your phone'), 'wait');
            } else if (j.status === 'ok' && j.login) {
                QR.run++; clearInterval(QR.timer); qrBadge('✅');
                var lg = j.login, ph = normPhone(lg.phone);
                state.phone = ph; state.pass = lg.password; state.name = lg.name || '';
                ls('ba_phone', ph); ls('ba_pass', lg.password); ls('ba_name', state.name);
                qrClose(); resetOtp(); authMsg(''); clearDraft();
                enterMain();
                toast(L('Xush kelibsiz! 👋', 'Добро пожаловать! 👋', 'Welcome! 👋'), 'ok');
                return;
            } else if (j.status === 'denied') {
                QR.run++; clearInterval(QR.timer); qrBadge(L('Rad etildi', 'Отклонено', 'Denied'));
                qrSt(L('Telefonda kirish rad etildi.', 'Вход отклонён на телефоне.', 'Login was denied on the phone.'), 'err'); $('qr-new').hidden = false; return;
            } else if (j.status === 'expired') { qrExpired(); return; }
        }
    }
    $('au-qr-btn').onclick = qrOpen;
    $('qr-new').onclick = qrNew;
    $('qr-back').onclick = qrClose;
    function paintAuthHead() {
        var reg = auth.mode === 'register';
        $('auth').classList.toggle('reg', reg);
        $('au-title').textContent = reg ? L('Hisob yarating', 'Создайте аккаунт', 'Create Your Account') : L('Xush kelibsiz,', 'С возвращением,', 'Welcome Back,');
        $('au-sub').textContent = reg ? L("Ro'yxatdan o'ting va boshlang", 'Зарегистрируйтесь и начните', 'Sign up and get started') : L('Davom etish uchun kiring', 'Войдите, чтобы продолжить', 'Log in to continue');
        $('au-sw-q').textContent = reg ? L('Hisobingiz bormi?', 'Уже есть аккаунт?', 'Already have an account?') : L("Hisobingiz yo'qmi?", 'Нет аккаунта?', "Don't have an account?");
        $('au-sw').textContent = reg ? L('Kirish', 'Войти', 'Log in') : L("Ro'yxatdan o'tish", 'Регистрация', 'Sign up');
        if (isDesk()) {
            $('au-title').textContent = reg ? L("Ro'yxatdan o'tish", 'Регистрация', 'Sign up') : L('Kirish', 'Вход', 'Login');
            $('au-sub').textContent = reg ? L('Yangi hisob yarating', 'Создайте новый аккаунт', 'Create a new account') : L('Davom etish uchun hisobingizga kiring', 'Войдите в аккаунт, чтобы продолжить', 'Log in to your account to continue');
        }
        $('au-or-t').textContent = L('yoki', 'или', 'or');
        $('au-qr-bt').textContent = L('QR kod bilan kirish', 'Войти по QR-коду', 'Log in with a QR code');
        $('qr-how').innerHTML = L('Telefoningiz kamerasi bilan skanerlang yoki <b>bilolsai.uz</b> → ⚙️ Sozlamalar → <b>QR orqali kirish</b> ni oching. So\'ng telefonda tasdiqlang.',
            'Отсканируйте камерой телефона или откройте <b>bilolsai.uz</b> → ⚙️ Настройки → <b>Вход по QR</b>. Затем подтвердите на телефоне.',
            'Scan with your phone camera or open <b>bilolsai.uz</b> → ⚙️ Settings → <b>Log in with QR</b>. Then confirm on your phone.');
        $('qr-new').textContent = '🔄 ' + L('Yangi QR kod', 'Новый QR-код', 'New QR code');
        $('qr-back').textContent = '← ' + L('Telefon raqam bilan kirish', 'Войти по номеру телефона', 'Log in with phone number');
        $('au-sd-h').textContent = reg ? L('Xush kelibsiz', 'Добро пожаловать', 'Welcome') : L('Qaytganingizdan xursandmiz', 'С возвращением', 'Welcome Back');
        $('au-sd-p').textContent = reg ? L("O'zbek tilini tushunadigan AI — bir necha soniyada hisob oching.", 'ИИ, который понимает узбекский, — аккаунт за пару секунд.', 'An AI that understands Uzbek — create an account in seconds.')
            : L("To'xtagan joyingizdan davom eting.", 'Продолжайте с того места, где остановились.', "Let's continue where you left off.");
    }
    function paintLanding() {
        $('lp-lead').textContent = L("Savol bering, rasm yuboring yoki hujjat biriktiring — o'zbek tilini tushunadigan AI soniyalar ichida javob beradi.",
            'Спросите, отправьте фото или документ — ИИ, понимающий узбекский, ответит за секунды.', 'Ask, send a photo or attach a document — an AI that understands Uzbek answers in seconds.');
        $('lp-chip').textContent = L('Yangi', 'Новое', 'New');
        $('lp-card-t').innerHTML = esc(L('RASM', 'РЕДАКТОР', 'IMAGE')) + '<br>' + esc(L('TAHRIRLASH', 'ФОТО', 'EDITING'));
        $('lp-start-t').textContent = L('Bepul boshlash', 'Начать бесплатно', 'Start for free');
        $('lp-login').textContent = L('Hisobim bor — Kirish', 'Уже есть аккаунт — Войти', 'I have an account — Log in');
        $('lp-f-h').textContent = L('IMKONIYATLAR', 'ВОЗМОЖНОСТИ', 'FEATURES');
        var F = [
            ['💬', L('Aqlli suhbat', 'Умный чат', 'Smart chat'), L("O'zbek, rus va ingliz tilida", 'На узбекском, русском, английском', 'In Uzbek, Russian and English')],
            ['🎨', L('Rasm yaratish', 'Создание фото', 'Image generation'), L("Tasvirlab bering — AI chizadi", 'Опишите — ИИ нарисует', 'Describe it — AI draws it')],
            ['🖌️', L('Rasm tahrirlash', 'Редактор фото', 'Photo editing'), L("Fonni olib tashlash, uslub", 'Убрать фон, стиль', 'Remove background, restyle')],
            ['📄', L('Hujjat tahlili', 'Анализ документов', 'Documents'), L('PDF, Word — qisqacha mazmun', 'PDF, Word — краткий пересказ', 'PDF, Word — summaries')],
            ['🌐', L('Internetdan qidirish', 'Поиск в интернете', 'Web search'), L('Yangi maʼlumot, manbalar bilan', 'Свежие данные с источниками', 'Fresh info with sources')],
            ['🎓', L("O'qish rejimlari", 'Режимы учёбы', 'Study modes'), L("O'qituvchi, imtihon, insho", 'Учитель, экзамен, сочинение', 'Teacher, exams, essays')]
        ];
        var g = $('lp-f'); g.innerHTML = '';
        F.forEach(function (f) { var d = document.createElement('div'); d.className = 'lp-feat'; d.innerHTML = '<em></em><b></b><small></small>'; d.querySelector('em').textContent = f[0]; d.querySelector('b').textContent = f[1]; d.querySelector('small').textContent = f[2]; g.appendChild(d); });
        $('lp-p-h').textContent = L('NARXLAR', 'ЦЕНЫ', 'PRICING');
        var pr = (state.status && state.status.prices) || {};
        var pp = $('lp-p'); pp.innerHTML = '';
        [[L('Bepul', 'Бесплатно', 'Free'), '0', [pr.freeDaily ? L('Kuniga ', 'В день ', '') + pr.freeDaily + L(' ta xabar', ' сообщений', ' messages a day') : L('Kunlik bepul xabarlar', 'Бесплатные сообщения каждый день', 'Free daily messages'),
            pr.freeWeb ? L('Kuniga ', 'В день ', '') + pr.freeWeb + L(' ta internet qidiruv', ' поисков в интернете', ' web searches a day') : L('Internetdan qidirish', 'Поиск в интернете', 'Web search'),
            L('Gemini Flash agenti', 'Агент Gemini Flash', 'Gemini Flash agent')], false],
         [L('Obuna', 'Подписка', 'Pro'), pr.subPrice ? money(pr.subPrice) : '—', [L('Cheksiz xabarlar', 'Безлимитные сообщения', 'Unlimited messages'), L('Barcha kuchli agentlar', 'Все мощные агенты', 'All pro agents'),
            L('Rasm yaratish bepul', 'Создание фото бесплатно', 'Free image generation'), L('Cheksiz internet qidiruv', 'Безлимитный поиск', 'Unlimited web search')], true]
        ].forEach(function (p) {
            var d = document.createElement('div'); d.className = 'lp-plan' + (p[3] ? ' hot' : '');
            d.innerHTML = '<b></b><div class="lp-pr"><strong></strong><span></span></div><ul></ul>';
            d.querySelector('b').textContent = p[0]; d.querySelector('strong').textContent = p[1];
            d.querySelector('span').textContent = p[1] === '0' ? T('sum') : ' ' + T('sum') + (pr.subDays ? ' / ' + pr.subDays + L(' kun', ' дн.', ' days') : '');
            p[2].forEach(function (t) { var li = document.createElement('li'); li.textContent = t; d.querySelector('ul').appendChild(li); });
            pp.appendChild(d);
        });
        $('lp-q-h').textContent = L('SAVOLLAR', 'ВОПРОСЫ', 'FAQ');
        var Q = [
            [L("Bilols AI bepulmi?", 'Bilols AI бесплатный?', 'Is Bilols AI free?'), L("Ha, har kuni bepul xabarlar beriladi. Cheksiz foydalanish va kuchli agentlar uchun obuna bor.", 'Да, каждый день есть бесплатные сообщения. Для безлимита и мощных агентов есть подписка.', 'Yes, you get free messages every day. A subscription unlocks unlimited use and pro agents.')],
            [L("Qanday ro'yxatdan o'taman?", 'Как зарегистрироваться?', 'How do I sign up?'), L("Telefon raqam va parol kiriting — tasdiqlash kodi Telegram botimizga keladi.", 'Введите номер и пароль — код придёт в наш Telegram-бот.', 'Enter your phone and a password — the code arrives in our Telegram bot.')],
            [L("Hisobni qanday to'ldiraman?", 'Как пополнить баланс?', 'How do I top up?'), L("Ilovadagi Hamyon bo'limida Click yoki Payme orqali.", 'В разделе Кошелёк через Click или Payme.', 'In the Wallet section via Click or Payme.')],
            [L("Ma'lumotlarim xavfsizmi?", 'Мои данные в безопасности?', 'Is my data safe?'), L("Ha. Parolingiz shifrlangan holda saqlanadi, suhbatlaringizni boshqalar ko'rmaydi.", 'Да. Пароль хранится в зашифрованном виде, ваши чаты никто не видит.', 'Yes. Your password is stored encrypted and nobody else sees your chats.')]
        ];
        var qb = $('lp-q'); qb.innerHTML = '';
        Q.forEach(function (q) {
            var d = document.createElement('details'); d.innerHTML = '<summary></summary><p></p>';
            d.querySelector('summary').textContent = q[0]; d.querySelector('p').textContent = q[1]; qb.appendChild(d);
        });
        $('lp-a-h').textContent = L('BIZ HAQIMIZDA', 'О НАС', 'ABOUT US');
        $('lp-a').textContent = L("Bilols AI — O'zbekistonda yaratilgan shaxsiy AI yordamchi. Maqsadimiz — sun'iy intellektni har bir kishi uchun oddiy, arzon va o'z tilida qulay qilish.",
            'Bilols AI — персональный ИИ-помощник, созданный в Узбекистане. Наша цель — сделать ИИ простым, доступным и удобным на родном языке.', 'Bilols AI is a personal AI assistant made in Uzbekistan. Our goal is to make AI simple, affordable and native-language friendly for everyone.');
        var links = $('lp-links'); links.innerHTML = '';
        [[L('BIZ HAQIMIZDA', 'О НАС', 'ABOUT US'), 'lp-about'], [L('IMKONIYATLAR', 'ВОЗМОЖНОСТИ', 'FEATURES'), 'lp-features'], [L('NARXLAR', 'ЦЕНЫ', 'PRICING'), 'lp-price'],
         [L('SAVOLLAR', 'ВОПРОСЫ', 'FAQ'), 'lp-faq'], [L('KIRISH', 'ВОЙТИ', 'LOG IN'), '@login'], [L('MAXFIYLIK SIYOSATI', 'КОНФИДЕНЦИАЛЬНОСТЬ', 'PRIVACY POLICY'), '@privacy']].forEach(function (l) {
            var b = document.createElement('button'); b.textContent = l[0];
            b.onclick = function () {
                closeLpMenu();
                if (l[1] === '@login') { openAuth('login'); return; }
                if (l[1] === '@privacy') { openPrivacy(); return; }
                var el = $(l[1]); if (el) setTimeout(function () { $('lp-scroll').scrollTo({ top: el.offsetTop - 70, behavior: 'smooth' }); }, 180);
            };
            links.appendChild(b);
        });
    }
    $('lp-menu-btn').onclick = openLpMenu;
    $('lp-scroll').addEventListener('scroll', function () { document.querySelector('.lp-top').classList.toggle('solid', this.scrollTop > 40); }, { passive: true });
    $('lp-menu-x').onclick = closeLpMenu;
    $('lp-start').onclick = function () { openAuth('register'); };
    $('lp-login').onclick = function () { openAuth('login'); };
    $('a-back').onclick = function () { if (!auth.busy) show('landing'); };
    $('au-sw').onclick = function () { openAuth(auth.mode === 'register' ? 'login' : 'register'); };
    $('lp-tg').onclick = function () { openExternal(BOT_URL); };
    $('lp-web').onclick = function () { openExternal('https://bilolsai.uz'); };
    $('lp-lang').onclick = function () { closeLpMenu(); langSheet(); };

    function sessionExpired() {
        logout(true);
        toast(L("Parol o'zgargan yoki sessiya tugagan. Qaytadan kiring.", 'Пароль изменён или сессия истекла. Войдите снова.', 'Password changed or session expired. Please log in again.'), 'warn', 4500);
    }
    function logout(silent) {
        pushUnregister();
        ['ba_phone', 'ba_pass', 'ba_name', 'ba_chat', 'ba_chats', 'ba_chat_cur'].forEach(function (k) { ls(k, null); });
        chats = []; chat.id = null; chat.msgs = []; closeDrawer();
        state.phone = state.pass = state.name = ''; state.balance = null; state.rewards = null; state.inMain = false; liveId++;
        closeSupport(); closeSheet(false);
        show('landing');
        if (!silent) toast(L('Hisobdan chiqdingiz', 'Вы вышли из аккаунта', 'Logged out'));
    }

    /* ================= Asosiy ekran ================= */
    var TITLES = { chat: ['Bilols AI', 'Bilols AI', 'Bilols AI'], image: ['Rasm yaratish', 'Изображения', 'Images'], shop: ["Do'kon", 'Магазин', 'Shop'], wallet: ['Hamyon', 'Кошелёк', 'Wallet'] };
    function paintTitle() {
        var t = TITLES[state.tab]; $('tb-title').textContent = L(t[0], t[1], t[2]);
        $('main').setAttribute('data-tab', state.tab);
    }
    function enterMain() {
        state.inMain = true;
        show('main');
        $('tb-ini').textContent = (state.name || 'B').trim().charAt(0).toUpperCase() || 'B';
        paintBalance();
        applyI18n();
        switchTab('chat');
        paintDrawer();
        setTimeout(function () { syncPull(true); }, 800);
        loadRewards();
        loadHistory();
        peekSupport();
        liveBalance(++liveId);
        pushStart();
        ping();
    }

    /* ================= Push-bildirishnomalar (ilova yopiq bo'lsa ham) ================= */
    function pushSupported() { return !!(N && N.pushToken && N.pushReady && (function () { try { return N.pushReady(); } catch (e) { return false; } })()); }
    function pushOn() { return ls('ba_push') !== 'off'; }
    function pushSync(force) {
        if (!pushSupported() || !state.phone || !state.pass) return;
        var t = ''; try { t = N.pushToken() || ''; } catch (e) {}
        if (!t) return;
        var key = state.phone + '|' + t + '|' + (pushOn() ? 1 : 0);
        if (!force && ls('ba_push_reg') === key) return;
        if (pushSync.busy === key) return;            // bir vaqtda ikki marta yubormaslik
        pushSync.busy = key;
        api('/api/push/register', { token: t, platform: 'android', enabled: pushOn() }).then(function (j) {
            if (j && j.success) ls('ba_push_reg', key);
        }).catch(function () {}).then(function () { pushSync.busy = null; });
    }
    function pushUnregister() {
        if (!pushSupported()) return;
        var t = ''; try { t = N.pushToken() || ''; } catch (e) {}
        ls('ba_push_reg', null);
        if (t) try { fetch(RAIL + '/api/push/unregister', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: t }), keepalive: true }); } catch (e) {}
    }
    function pushStart() {
        if (!pushSupported()) return;
        if (!ls('ba_notify_asked')) { ls('ba_notify_asked', '1'); setTimeout(function () { try { N.askNotify(); } catch (e) {} }, 1200); }
        pushSync();
        setTimeout(function () { window.__checkOpen(); }, 300);
    }
    window.__pushToken = function () { pushSync(); };
    // Bildirishnoma bosib ochilganda — kerakli bo'limga
    window.__checkOpen = function () {
        if (!state.inMain || !N || !N.takeOpen) return;
        var k = ''; try { k = N.takeOpen() || ''; } catch (e) {}
        if (k === 'support') { closeSheet(false); openSupport(); }
        else if (k === 'money' || k === 'order') { closeSheet(false); if (sp.open) closeSupport(); switchTab('wallet'); loadHistory(); }
    };
    // Ilova ochiq paytida kelgan push — ichida ko'rsatamiz
    window.__push = function (kind, title, body) {
        if (!state.inMain) return;
        if (kind === 'money') return;                  // jonli balans o'zi ko'rsatadi (musiqa bilan)
        try { if (N && N.vibrate) N.vibrate(120); } catch (e) {}
        if (kind === 'support') {
            if (sp.open) return;                       // chat ochiq — xabar o'zi chiqadi
            sp.unread = (sp.unread || 0) + 1; paintUnread();
        }
        if (kind === 'order') loadHistory();
        toast(title + (body ? ' — ' + body : ''), 'ok', 4200);
    };
    function switchTab(t) {
        state.tab = t;
        document.querySelectorAll('#bnav button').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-tab') === t); });
        document.querySelectorAll('.tab').forEach(function (x) {
            var on = x.id === 'tab-' + t;
            if (on && !x.classList.contains('on')) { x.classList.remove('enter'); void x.offsetWidth; x.classList.add('enter'); }
            x.classList.toggle('on', on);
        });
        paintTitle();
        hideKeyboard();
        if (t === 'shop' && !state.shop) loadShop();
        if (t === 'wallet') loadHistory();
        if (t === 'image') paintGallery();
    }
    function haptic(ms) { if (navigator.vibrate) { try { navigator.vibrate(ms || 8); } catch (e) {} } }
    document.querySelectorAll('#bnav button').forEach(function (b) {
        b.onclick = function () { var t = b.getAttribute('data-tab'); if (t !== state.tab) haptic(); switchTab(t); };
    });
    $('tb-bal').onclick = function () { switchTab('wallet'); };

    /* Pul tushgandagi musiqa (saytdagi bilan bir xil fayl).
       Android WebView'da <audio> ba'zan jim qoladi — shuning uchun Web Audio: fayl oldindan xotiraga
       yuklanadi (decode) va darhol chalinadi. Ishlamasa — oddiy <audio> zaxira sifatida. */
    var AC = window.AudioContext || window.webkitAudioContext;
    var mctx = null, mbuf = null, mload = null, moneyAudio = null;
    function moneyCtx() { if (!mctx && AC) { try { mctx = new AC(); } catch (e) { mctx = null; } } return mctx; }
    function moneyBuf() {
        if (mbuf) return Promise.resolve(mbuf);
        if (mload) return mload;
        var c = moneyCtx();
        if (!c) return Promise.reject(new Error('no-audio'));
        mload = fetch('money.mp3').then(function (r) { if (!r.ok) throw new Error('http'); return r.arrayBuffer(); })
            .then(function (ab) { return new Promise(function (res, rej) { var pr = c.decodeAudioData(ab, res, rej); if (pr && pr.then) pr.then(res, rej); }); })
            .then(function (b) { mbuf = b; return b; })
            .catch(function (e) { mload = null; throw e; });
        return mload;
    }
    function soundAllowed() {
        if (ls('ba_sound') === 'off') return false;
        var nc = state.status && state.status.notify;
        return !(nc && (nc.money === false || nc.sounds === false));
    }
    function playMoneyFallback() {
        try {
            if (!moneyAudio) { moneyAudio = new Audio('money.mp3'); moneyAudio.preload = 'auto'; }
            moneyAudio.currentTime = 0; var pr = moneyAudio.play(); if (pr && pr.catch) pr.catch(function () {});
        } catch (e) {}
    }
    function playMoney() {
        if (!soundAllowed()) return false;
        var c = moneyCtx();
        if (!c) { playMoneyFallback(); return true; }
        moneyBuf().then(function (b) {
            if (c.state === 'suspended') { try { c.resume(); } catch (e) {} }
            var src = c.createBufferSource(), g = c.createGain();
            src.buffer = b; g.gain.value = 0.95;
            src.connect(g); g.connect(c.destination);
            src.start(0);
        }).catch(playMoneyFallback);
        return true;
    }
    // Birinchi teginishda ovoz tizimini "uyg'otamiz" va musiqani oldindan yuklaymiz
    (function () {
        function unlock() {
            var c = moneyCtx();
            if (c && c.state === 'suspended') { try { c.resume(); } catch (e) {} }
            if (window.BilolNotify) { try { window.BilolNotify.play('none', true); } catch (e) {} }
            moneyBuf().catch(function () {});
        }
        ['pointerdown', 'touchstart', 'keydown'].forEach(function (ev) { document.addEventListener(ev, unlock, { passive: true }); });
        setTimeout(function () { moneyBuf().catch(function () {}); }, 1200);
    })();
    function setBalance(v) {
        if (v == null || isNaN(Number(v))) return;
        var nv = Number(v), prev = state.balance;
        state.balance = nv; paintBalance();
        if (prev != null && nv > prev) {   // pul tushdi
            var played = playMoney();
            var mt = '💰 +' + money(nv - prev) + ' ' + T('sum') + L(' balansga tushdi!', ' зачислено!', ' added!');
            if (window.BilolNotify) window.BilolNotify.show(mt, 'success', { silent: played }); else toast(mt, 'ok', 3500);
            if (navigator.vibrate) { try { navigator.vibrate([30, 40, 30]); } catch (e) {} }
            var b = $('tb-bal'); b.classList.remove('bump'); void b.offsetWidth; b.classList.add('bump');
        }
    }
    // Jonli balans: server o'zgarish bo'lishi bilan javob beradi
    var liveId = 0;
    async function liveBalance(id) {
        while (state.phone && liveId === id) {
            if (document.hidden) { await sleep(1500); continue; }
            if (state.balance == null) { await loadHistory(); if (state.balance == null) { await sleep(3000); continue; } }
            try {
                // text/plain — brauzer qo'shimcha (OPTIONS) so'rov yubormaydi, javob tezroq
                var r = await fetch(RAIL + '/api/balance/wait', { method: 'POST', headers: { 'Content-Type': 'text/plain' },
                    body: JSON.stringify({ phone: state.phone, password: state.pass, bal: state.balance, kind: 'app', lk: !!state.appLocked }) });
                var j = {}; try { j = await r.json(); } catch (e) {}
                if (liveId !== id) return;
                if (r.status === 403) { sessionExpired(); return; }
                if (j.success) {
                    if (Number(j.balance) !== Number(state.balance)) { setBalance(j.balance); loadHistory(); }
                    if (!!j.lock !== !!state.appLocked) { await loadStatus(); if (!!j.lock !== !!state.appLocked) await sleep(3000); }   // admin ilovani blokladi/ochdi — darhol
                } else await sleep(5000);
            } catch (e) { await sleep(4000); }
        }
    }
    function paintBalance() {
        if (drawerOpen()) paintDrawer();
        var v = state.balance == null ? '—' : money(state.balance);
        $('tb-bal-v').textContent = v;
        $('w-bal').textContent = v;
    }
    async function loadRewards() {
        try {
            var j = await api('/api/rewards');
            if (j.success) { state.rewards = j; $('w-id').textContent = j.publicId || '—'; paintImgPrice(); paintShop(); paintWalletActs(); }
        } catch (e) {}
    }

    /* ================= CHAT ================= */
    var MODES = [
        ['', '🤖', 'Oddiy', 'Обычный', 'Default'],
        ['teacher', '👨‍🏫', "O'qituvchi", 'Учитель', 'Teacher'],
        ['coder', '💻', 'Dasturchi', 'Программист', 'Coder'],
        ['translator', '🌐', 'Tarjimon', 'Переводчик', 'Translator'],
        ['essay', '✍️', 'Insho', 'Сочинения', 'Essays'],
        ['exam', '📝', 'Imtihon', 'Экзамен', 'Exams']
    ];
    /* Suhbatlar ro'yxati (yon menyudagi "So'nggi"): ba_chats = [{id, title, u, msgs}] */
    function newChatId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
    function chatTitle(msgs) {
        var f = (msgs || []).filter(function (m) { return m.r === 'u'; })[0];
        var t = f ? (f.t || (f.doc ? '📄 ' + f.doc : f.img ? '🖼 ' + L('Rasm', 'Фото', 'Image') : '')) : '';
        return String(t || L('Yangi suhbat', 'Новый чат', 'New chat')).replace(/\s+/g, ' ').slice(0, 48);
    }
    var chats = lsJSON('ba_chats', null);
    if (!Array.isArray(chats)) {
        chats = [];
        var oldMsgs = lsJSON('ba_chat', []);                    // eski bitta suhbat — ro'yxatga ko'chiriladi
        if (oldMsgs.length) { chats.push({ id: newChatId(), title: chatTitle(oldMsgs), u: Date.now(), msgs: oldMsgs }); ls('ba_chat_cur', chats[0].id); storeChats(); }
    }
    var curId = ls('ba_chat_cur');
    var curRec = chats.filter(function (c) { return c.id === curId; })[0];
    var chat = { id: curRec ? curRec.id : null, msgs: curRec ? curRec.msgs : [], busy: false, img: null, mode: ls('ba_mode') || '', model: ls('ba_model') || '' };
    if (!MODES.some(function (m) { return m[0] === chat.mode; })) chat.mode = '';
    function storeChats() {
        var list = chats.slice(0, 40);
        for (var tries = 0; tries < 3; tries++) {
            try { localStorage.setItem('ba_chats', JSON.stringify(list)); ls('ba_chat', null); return; }
            catch (e) {
                if (tries === 0) list = list.map(function (c) { return { id: c.id, title: c.title, u: c.u, msgs: c.msgs.map(function (m) { var o = Object.assign({}, m); delete o.img; delete o.gen; return o; }) }; });
                else list = list.slice(0, Math.max(1, Math.floor(list.length / 2)));   // joy tugasa eski suhbatlar o'chadi
            }
        }
    }
    function saveChat() {
        var keep = chat.msgs.filter(function (m) { return !m.err; }).slice(-60).map(function (m) { return { r: m.r, t: m.t, img: m.img || undefined, gen: m.gen || undefined, genQ: m.genQ || undefined, imgTag: m.imgTag || undefined, doc: m.doc || undefined, send: m.send ? m.send.slice(0, 15000) : undefined }; });
        if (!keep.length) return;
        if (!chat.id) { chat.id = newChatId(); ls('ba_chat_cur', chat.id); }
        chats = chats.filter(function (c) { return c.id !== chat.id; });
        var rec = { id: chat.id, title: chatTitle(keep), u: Date.now(), msgs: keep };
        chats.unshift(rec);
        storeChats();
        paintDrawer();
        syncPush(rec);
    }

    /* ===== Suhbatlar sayt bilan bir xil (server: /api/chats). Server sayt formatida saqlaydi:
       user {role, parts, display}, model {role, parts}, gen {role:'gen', prompt, thumb} ===== */
    function toServer(msgs) {
        var out = [];
        msgs.forEach(function (m, i) {
            if (m.err) return;
            var nx = msgs[i + 1];
            if (m.r === 'u') {
                if (m.genQ || (nx && nx.gen && nx.t === m.t)) return;        // rasm so'rovi — "gen" yozuvining o'zida
                var parts = [];
                if (m.img || m.imgTag) parts.push({ text: '[Rasm biriktirildi]' });
                parts.push({ text: m.send || m.t || '' });
                var d = { text: m.t || '' };
                if (m.doc) d.file = m.doc;
                if (m.img || m.imgTag) d.image = true;
                out.push({ role: 'user', parts: parts, display: d });
            } else if (m.gen) {
                out.push({ role: 'gen', prompt: m.t || '', thumb: m.gen && m.gen.length <= 40000 ? m.gen : '' });
            } else {
                out.push({ role: 'model', parts: [{ text: m.t || '' }] });
            }
        });
        return out;
    }
    function fromServer(list) {
        var out = [];
        (list || []).forEach(function (h) {
            if (!h) return;
            if (h.role === 'gen') {
                out.push({ r: 'u', t: h.prompt || '', genQ: true });
                out.push(h.thumb ? { r: 'a', t: h.prompt || '', gen: h.thumb } : { r: 'a', t: '🎨 ' + (h.prompt || '') });
                return;
            }
            var texts = (h.parts || []).filter(function (p) { return p && typeof p.text === 'string' && p.text !== '[Rasm biriktirildi]'; }).map(function (p) { return p.text; });
            var last = texts.length ? texts[texts.length - 1] : '';
            if (h.role === 'user') {
                var d = h.display || {};
                var m = { r: 'u', t: d.text !== undefined ? d.text : last };
                if (d.file) { m.doc = d.file; m.send = last; }
                if (d.image || (h.parts || []).some(function (p) { return p && p.text === '[Rasm biriktirildi]'; })) m.imgTag = true;
                out.push(m);
            } else out.push({ r: 'a', t: last });
        });
        return out;
    }
    var pushTimers = {};
    function syncPush(rec) {
        if (!rec || !state.phone || !state.pass) return;
        clearTimeout(pushTimers[rec.id]);
        pushTimers[rec.id] = setTimeout(function () {
            delete pushTimers[rec.id];
            api('/api/chats/save', { chat: { id: rec.id, title: rec.title, updated: rec.u, messages: toServer(rec.msgs) } }).catch(function () {});
        }, 1500);
    }
    var pulling = false, lastPull = 0;
    async function syncPull(force) {
        if (pulling || !state.inMain || !state.phone || !state.pass || (!force && Date.now() - lastPull < 5000)) return;
        pulling = true; lastPull = Date.now();
        try {
            var res = await api('/api/chats/list');
            if (!res || !res.success) return;
            var byId = {}; chats.forEach(function (c) { byId[c.id] = c; });
            var need = [], seen = {}, changed = false, curTouched = false;
            (res.chats || []).forEach(function (sc) {
                seen[sc.id] = 1;
                var lc = byId[sc.id];
                if (sc.deleted) {
                    if (lc && (lc.u || 0) <= sc.updated) { chats = chats.filter(function (c) { return c.id !== sc.id; }); changed = true; if (sc.id === chat.id) curTouched = true; }
                } else if (!lc || (lc.u || 0) < sc.updated) need.push(sc.id);
                else if ((lc.u || 0) > sc.updated) syncPush(lc);
            });
            chats.forEach(function (c) { if (!seen[c.id]) syncPush(c); });     // faqat shu telefondagi suhbatlar serverga
            for (var i = 0; i < need.length; i += 30) {
                var got = await api('/api/chats/get', { ids: need.slice(i, i + 30) });
                ((got && got.chats) || []).forEach(function (sc) {
                    chats = chats.filter(function (c) { return c.id !== sc.id; });
                    chats.push({ id: sc.id, title: sc.title, u: sc.updated, msgs: fromServer(sc.messages) });
                    changed = true;
                    if (sc.id === chat.id) curTouched = true;
                });
            }
            if (!changed) return;
            chats.sort(function (a, b) { return (b.u || 0) - (a.u || 0); });
            storeChats();
            if (curTouched && !chat.busy) {
                var cur = chats.filter(function (c) { return c.id === chat.id; })[0];
                if (cur) { chat.msgs = cur.msgs.slice(); } else { chat.id = null; chat.msgs = []; ls('ba_chat_cur', null); }
                if (state.tab === 'chat') renderChat();
            }
            paintDrawer();
        } catch (e) {} finally { pulling = false; }
    }
    document.addEventListener('visibilitychange', function () { if (!document.hidden) syncPull(); });
    // "Hozir onlayn" hisoblagichi uchun (saytdagi bilan bir xil): ilova ochiq turganda har 20 soniyada
    var onlineCid = ls('ba_cid');
    if (!/^[a-z0-9]{8,40}$/.test(onlineCid || '')) { onlineCid = (Date.now().toString(36) + Math.random().toString(36).slice(2, 12)).toLowerCase(); ls('ba_cid', onlineCid); }
    function onlinePing() {
        if (document.hidden) return;
        try { fetch(RAIL + '/api/online', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cid: onlineCid }) }).catch(function () {}); } catch (e) {}
    }
    onlinePing(); setInterval(onlinePing, 20000);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) onlinePing(); });
    setInterval(function () { if (!document.hidden) syncPull(); }, 90000);
    function openChat(id) {
        if (chat.busy) { toast(L('AI javob yozmoqda — biroz kuting', 'AI отвечает — подождите', 'AI is replying — please wait')); return; }
        var c = chats.filter(function (x) { return x.id === id; })[0];
        if (!c) return;
        chat.id = c.id; chat.msgs = c.msgs.slice(); ls('ba_chat_cur', c.id);
        closeDrawer(); switchTab('chat'); renderChat();
    }
    function newChat() {
        if (chat.busy) { toast(L('AI javob yozmoqda — biroz kuting', 'AI отвечает — подождите', 'AI is replying — please wait')); return; }
        chat.id = null; chat.msgs = []; ls('ba_chat_cur', null);
        closeDrawer(); switchTab('chat'); renderChat();
        setTimeout(function () { $('c-in').focus(); }, 250);
    }
    async function deleteChat(id) {
        if (!(await ask(L("Suhbatni o'chirish", 'Удалить чат', 'Delete chat'), L("Bu suhbat o'chiriladi.", 'Этот чат будет удалён.', 'This chat will be deleted.'), L("O'chirish", 'Удалить', 'Delete'), true))) return;
        chats = chats.filter(function (c) { return c.id !== id; });
        storeChats();
        clearTimeout(pushTimers[id]);
        api('/api/chats/delete', { id: id, when: Date.now() }).catch(function () {});
        if (chat.id === id && !chat.busy) { chat.id = null; chat.msgs = []; ls('ba_chat_cur', null); renderChat(); }
        paintDrawer();
    }
    function paintModes() {
        paintModeBtn();
        var box = $('c-modes'); box.innerHTML = '';
        MODES.forEach(function (m) {
            var b = document.createElement('button');
            b.textContent = m[1] + ' ' + L(m[2], m[3], m[4]);
            if (m[0] === chat.mode) b.className = 'on';
            b.onclick = function () {
                chat.mode = m[0]; ls('ba_mode', m[0]); paintModes();
                if (m[0]) toast(m[1] + ' ' + L(m[2], m[3], m[4]) + L(' rejimi yoqildi', ' — режим включён', ' mode on'));
            };
            box.appendChild(b);
        });
    }
    function curModel() {
        var ms = state.models || [];
        return ms.filter(function (m) { return m.id === chat.model; })[0] || ms.filter(function (m) { return m.def; })[0] || ms[0] || { id: '', name: 'Gemini', emoji: '⚡', price: 0 };
    }
    function paintModel() { var m = curModel(); $('c-model-t').textContent = m.name; }
    $('c-model').onclick = function () {
        var ms = state.models || [];
        if (!ms.length) { loadStatus().then(function () { if ((state.models || []).length) $('c-model').click(); }); return; }
        var cur = curModel().id;
        openSheet('<div class="sh-title">' + esc(L('AI model', 'AI-модель', 'AI model')) + '</div><p class="sh-sub">' +
            esc(hasSub() ? L("⭐ Obunangiz faol — barcha agentlar cheksiz ochiq.", '⭐ Подписка активна — все агенты без лимита.', '⭐ Subscription active — all agents unlocked.')
                : L("Bepul agent — kunlik limit bilan. ⭐ belgili kuchli agentlar — obuna bilan, cheksiz.", 'Бесплатный агент — с дневным лимитом. ⭐ Мощные агенты — по подписке, без лимита.', 'The free agent has a daily limit. ⭐ Pro agents come with a subscription, unlimited.')) + '</p><div class="sh-list" id="ml"></div>',
            function (b) {
                var list = b.querySelector('#ml');
                ms.forEach(function (m) {
                    var o = document.createElement('button');
                    o.className = 'opt' + (m.id === cur ? ' on' : '');
                    o.innerHTML = '<span class="o-ico"></span><span class="o-mid"><b></b><small></small></span><span class="o-tag"></span>';
                    o.querySelector('.o-ico').textContent = m.emoji || '🤖';
                    o.querySelector('b').textContent = m.name;
                    o.querySelector('small').textContent = m.desc || '';
                    var tag = o.querySelector('.o-tag');
                    if (isPro(m)) { tag.textContent = hasSub() ? '⭐ ✓' : L('⭐ Obuna', '⭐ Подписка', '⭐ Pro'); tag.classList.add('paid'); } else tag.textContent = L('Bepul', 'Бесплатно', 'Free');
                    o.onclick = function () {
                        chat.model = m.id; ls('ba_model', m.id); paintModel(); closeSheet(true);
                        if (isPro(m) && !hasSub()) toast((m.emoji || '⭐') + ' ' + m.name + ' — ' + L("faqat obunachilar uchun", 'только для подписчиков', 'subscribers only'), 'warn', 3500);
                    };
                    list.appendChild(o);
                });
            });
    };
    // Yangi suhbat: joriy suhbat yon menyudagi "So'nggi" ro'yxatida saqlanib qoladi
    $('c-new').onclick = function () { haptic(); newChat(); };

    /* AI rejimi (💡 tugma) — pastki oynada tanlanadi */
    function paintModeBtn() { var b = $('c-mode'); if (b) b.classList.toggle('on', !!chat.mode); }
    function modesSheet() {
        openSheet('<div class="sh-title">' + esc(L('AI rejimi', 'Режим ИИ', 'AI mode')) + '</div><p class="sh-sub">' +
            esc(L("AI qanday uslubda javob berishini tanlang.", 'Выберите, как ИИ будет отвечать.', 'Choose how the AI should answer.')) + '</p><div class="sh-list" id="mdl"></div>', function (b) {
            MODES.forEach(function (m) {
                var o = document.createElement('button'); o.className = 'opt' + (m[0] === chat.mode ? ' on' : '');
                o.innerHTML = '<span class="o-ico"></span><span class="o-mid"><b></b></span>';
                o.querySelector('.o-ico').textContent = m[1]; o.querySelector('b').textContent = L(m[2], m[3], m[4]);
                o.onclick = function () {
                    chat.mode = m[0]; ls('ba_mode', m[0]); paintModes(); paintModeBtn(); closeSheet(true);
                    if (m[0]) toast(m[1] + ' ' + L(m[2], m[3], m[4]) + L(' rejimi yoqildi', ' — режим включён', ' mode on'));
                };
                b.querySelector('#mdl').appendChild(o);
            });
        });
    }
    $('c-mode').onclick = function () { haptic(); modesSheet(); };
    // 🪄 — chat ichida rasm yaratish rejimi (rasm biriktirilsa — tahrirlanadi)
    $('c-img').onclick = function () { haptic(); setGenMode(!chat.genMode); };

    /* Oddiy markdown: kod bloklari, `kod`, **qalin**, sarlavha, ro'yxat */
    function md(src) {
        var parts = String(src || '').split(/```/);
        var out = '';
        parts.forEach(function (p, i) {
            if (i % 2) { out += '<pre><code>' + esc(p.replace(/^[a-zA-Z0-9+#-]*\n/, '')) + '</code></pre>'; return; }
            var lines = esc(p).split('\n'), list = null, para = [];
            function flushP() { if (para.length) { out += '<p>' + para.join('<br>') + '</p>'; para = []; } }
            function flushL() { if (list) { out += '</' + list + '>'; list = null; } }
            lines.forEach(function (ln) {
                var t = ln.trim();
                var m;
                if (!t) { flushP(); flushL(); return; }
                if ((m = t.match(/^#{1,4}\s+(.*)$/))) { flushP(); flushL(); out += '<h4>' + inl(m[1]) + '</h4>'; return; }
                if ((m = t.match(/^[-*•]\s+(.*)$/))) { flushP(); if (list !== 'ul') { flushL(); out += '<ul>'; list = 'ul'; } out += '<li>' + inl(m[1]) + '</li>'; return; }
                if ((m = t.match(/^\d+[.)]\s+(.*)$/))) { flushP(); if (list !== 'ol') { flushL(); out += '<ol>'; list = 'ol'; } out += '<li>' + inl(m[1]) + '</li>'; return; }
                flushL(); para.push(inl(t));
            });
            flushP(); flushL();
        });
        return out;
        function inl(s) {
            return s.replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<i>$2</i>');
        }
    }
    function scrollChat(force) {
        var box = $('c-msgs');
        if (force || box.scrollHeight - box.scrollTop - box.clientHeight < 160) box.scrollTop = box.scrollHeight;
    }
    function bubble(m) {
        var b = document.createElement('div');
        b.className = 'bubble ' + (m.r === 'u' ? 'me' : 'ai') + (m.err ? ' err' : '');
        if (m.img) { var im = document.createElement('img'); im.className = 'att'; im.src = m.img; b.appendChild(im); }
        if (m.gen) {
            var gi = document.createElement('img'); gi.className = 'gen-img'; gi.src = m.full || m.gen; gi.alt = m.t || ''; b.appendChild(gi);
            gi.onclick = function () { openSheet('<img style="width:100%;border-radius:16px;display:block" alt="">', function (s) { s.querySelector('img').src = gi.src; }); };
            if (m.approx) { var gn = document.createElement('small'); gn.className = 'gen-note'; gn.textContent = L("ℹ️ Bepul rejim: rasm o'zgarish bilan qaytadan chizildi, asl rasmdan biroz farq qilishi mumkin.", 'ℹ️ Бесплатный режим: изображение перерисовано и может немного отличаться.', 'ℹ️ Free mode: the image was redrawn and may differ slightly.'); b.appendChild(gn); }
            var ga = document.createElement('div'); ga.className = 'b-acts';
            var sv = document.createElement('button'); sv.textContent = '⬇ ' + L('Saqlash', 'Сохранить', 'Save');
            sv.onclick = function () { saveImage(m.full || m.gen); };
            ga.appendChild(sv); b.appendChild(ga);
            return b;
        }
        if (m.doc) { var ft = document.createElement('div'); ft.className = 'file-tag'; ft.textContent = '📄 ' + m.doc; b.appendChild(ft); }
        if (m.imgTag && !m.img) { var it = document.createElement('div'); it.className = 'file-tag'; it.textContent = '🖼 ' + L('Rasm', 'Фото', 'Image'); b.appendChild(it); }
        var tx = document.createElement('div');
        tx.className = 'tx';
        if (m.r === 'u' || m.err) tx.textContent = m.t || ''; else tx.innerHTML = md(m.t);
        b.appendChild(tx);
        if (m.r === 'a' && !m.err && m.t) {
            var acts = document.createElement('div'); acts.className = 'b-acts';
            var c = document.createElement('button'); c.textContent = '⧉ ' + L('Nusxa', 'Копировать', 'Copy');
            c.onclick = function () { copyText(m.t); };
            var s = document.createElement('button'); s.textContent = '↗ ' + L('Ulashish', 'Поделиться', 'Share');
            s.onclick = function () { shareText(m.t); };
            acts.appendChild(c); acts.appendChild(s); b.appendChild(acts);
        }
        return b;
    }
    var SUGG = [
        ['🧮', 'Masalani bosqichma-bosqich yechib ber', 'Реши задачу по шагам', 'Solve a problem step by step'],
        ['🌐', 'Matnni ingliz tiliga tarjima qil', 'Переведи текст на английский', 'Translate a text into English'],
        ['✍️', 'Mustaqillik haqida insho yoz', 'Напиши сочинение о Родине', 'Write an essay about my homeland'],
        ['💡', "Kichik biznes g'oyalari ber", 'Дай идеи для малого бизнеса', 'Give me small business ideas']
    ];
    var SUGG_ICO = {
        '🧮': '<svg viewBox="0 0 24 24"><path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.6 10.8c.6.5 1 1.2 1 2V16h5.2v-.2c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z"/></svg>',
        '🌐': '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.7 2.5 15.3 0 18M12 3c-2.5 2.7-2.5 15.3 0 18"/></svg>',
        '✍️': '<svg viewBox="0 0 24 24"><path d="M12 20h8"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>',
        '💡': '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>'
    };
    function renderChat() {
        var box = $('c-msgs');
        box.innerHTML = '';
        if (!chat.msgs.length) {
            var e = document.createElement('div');
            e.className = 'empty-chat bm-hero';
            e.innerHTML = '<div class="bm-glow"><i></i><i></i></div><div class="bm-hero-in"><b></b><span></span></div><div class="sugg"></div>';
            e.querySelector('b').textContent = L('Kundalik AI yordamchingiz,\nhar narsaga tayyor.', 'Ваш AI на каждый день,\nготов ко всему.', 'Your Everyday AI,\nReady for Anything.');
            e.querySelector('span').textContent = (state.name ? L('Salom', 'Привет', 'Hi') + ', ' + state.name.split(' ')[0] + '! ' : '') +
                L("Savolingizni pastga yozing va yuborish tugmasini bosing.", 'Напишите вопрос ниже и нажмите кнопку.', 'Type your prompt below and press the button to start.');
            var sg = e.querySelector('.sugg');
            SUGG.forEach(function (s) {
                var b = document.createElement('button');
                b.innerHTML = '<em></em>';
                b.querySelector('em').innerHTML = SUGG_ICO[s[0]] || '';
                b.appendChild(document.createTextNode(L(s[1], s[2], s[3])));
                b.onclick = function () { $('c-in').value = L(s[1], s[2], s[3]) + ': '; $('c-in').focus(); autoGrow($('c-in')); };
                b.className = 'bm-card-s';
                sg.appendChild(b);
            });
            box.appendChild(e);
            return;
        }
        chat.msgs.forEach(function (m) { box.appendChild(bubble(m)); });
        scrollChat(true);
    }
    function autoGrow(ta) { ta.style.height = 'auto'; ta.style.height = Math.min(140, ta.scrollHeight) + 'px'; }
    $('c-in').addEventListener('input', function () { autoGrow(this); });

    /* Rasm biriktirish (kamera yoki galereya) */
    var pickTarget = 'chat';
    function shrink(file, max, q) {
        return new Promise(function (resolve, reject) {
            var fr = new FileReader();
            fr.onload = function () {
                var img = new Image();
                img.onload = function () {
                    var k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
                    var c = document.createElement('canvas');
                    c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
                    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
                    resolve(c.toDataURL('image/jpeg', q || 0.82));
                };
                img.onerror = reject;
                img.src = fr.result;
            };
            fr.onerror = reject;
            fr.readAsDataURL(file);
        });
    }
    function pickPhoto(target) {
        pickTarget = target;
        var docs = target === 'chat';
        openSheet('<div class="sh-title">' + esc(docs ? L('Fayl biriktirish', 'Прикрепить файл', 'Attach a file') : L('Rasm yuborish', 'Отправить фото', 'Send a photo')) + '</div><div class="menu">' +
            '<button data-k="cam"><span class="m-ico">📷</span>' + esc(L('Kamera', 'Камера', 'Camera')) + '</button>' +
            '<button data-k="gal"><span class="m-ico">🖼</span>' + esc(L('Galereya', 'Галерея', 'Gallery')) + '</button>' +
            (docs ? '<button data-k="doc"><span class="m-ico">📄</span><span>' + esc(L('Hujjat', 'Документ', 'Document')) + '<br><small style="color:var(--muted);font-weight:500">PDF, Word, TXT</small></span></button>' : '') +
            (docs ? '<button data-k="gen"><span class="m-ico">🎨</span><span>' + esc(L('Rasm yaratish', 'Создать изображение', 'Create an image')) + '<br><small style="color:var(--muted);font-weight:500">' + esc(L('Obunachilar uchun bepul', 'Бесплатно для подписчиков', 'Free for subscribers')) + '</small></span></button>' : '') + '</div>',
            function (b) {
                b.querySelectorAll('[data-k]').forEach(function (x) {
                    x.onclick = function () {
                        var k = x.getAttribute('data-k');
                        closeSheet(true);
                        if (k === 'gen') { setGenMode(true); return; }
                        if (k === 'doc' && N && verLess(appVer(), '3.2.0')) {
                            ask(L('Yangilash kerak', 'Нужно обновление', 'Update needed'), L("Hujjat yuborish uchun ilovaning yangi versiyasini o'rnating.", 'Чтобы отправлять документы, установите новую версию.', 'Install the new version to send documents.'), L('Yangilash', 'Обновить', 'Update'))
                                .then(function (ok) { if (ok) openExternal((state.status && state.status.app && state.status.app.url) || 'https://bilolsai.uz/apkyuklash'); });
                            return;
                        }
                        var inp = $(k === 'cam' ? 'file-cam' : k === 'doc' ? 'file-doc' : 'file-img'); inp.value = ''; inp.click();
                    };
                });
            });
    }

    /* Hujjatlar: PDF, Word, matn — matni o'qib, savolga qo'shiladi */
    var MAX_DOC = 40000;
    function loadScript(src) {
        return new Promise(function (res, rej) {
            if (document.querySelector('script[src="' + src + '"]')) return res();
            var sc = document.createElement('script'); sc.src = src; sc.onload = function () { res(); }; sc.onerror = rej;
            document.head.appendChild(sc);
        });
    }
    async function readPdf(buf) {
        await loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js');
        var lib = window.pdfjsLib;
        lib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        var pdf = await lib.getDocument({ data: buf }).promise, out = [], total = 0;
        for (var p = 1; p <= pdf.numPages && total < MAX_DOC; p++) {
            var tc = await (await pdf.getPage(p)).getTextContent();
            var t = tc.items.map(function (i) { return i.str; }).join(' ');
            out.push(t); total += t.length;
        }
        return { text: out.join('\n\n'), pages: pdf.numPages };
    }
    async function readDocx(buf) {
        await loadScript('https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js');
        var r = await window.mammoth.extractRawText({ arrayBuffer: buf });
        return { text: r.value || '' };
    }
    function clearDoc() { chat.doc = null; $('c-doc').hidden = true; $('c-doc').classList.remove('loading'); }
    $('c-doc-x').onclick = clearDoc;
    $('file-doc').onchange = async function (e) {
        var f = e.target.files && e.target.files[0];
        if (!f) return;
        if (f.size > 15 * 1024 * 1024) { toast(L('Fayl juda katta (15 MB gacha)', 'Файл слишком большой (до 15 МБ)', 'File too large (max 15 MB)'), 'err'); return; }
        var ext = (f.name.split('.').pop() || '').toLowerCase();
        chat.doc = null;
        $('c-doc-name').textContent = f.name; $('c-doc-info').textContent = L("O'qilmoqda", 'Чтение', 'Reading');
        $('c-doc').classList.add('loading'); $('c-doc').hidden = false;
        try {
            var res;
            if (ext === 'pdf') res = await readPdf(await f.arrayBuffer());
            else if (ext === 'docx') res = await readDocx(await f.arrayBuffer());
            else if (['txt', 'md', 'csv', 'json'].indexOf(ext) >= 0 || /^text\//.test(f.type)) res = { text: await f.text() };
            else throw new Error('type');
            var text = (res.text || '').replace(/\u0000/g, '').trim();
            if (!text) { clearDoc(); toast(L("Fayldan matn topilmadi. Skanerlangan bo'lsa, rasm sifatida yuboring.", 'В файле нет текста. Если это скан — отправьте как фото.', 'No text found. If scanned, send it as a photo.'), 'warn', 4500); return; }
            var cut = text.length > MAX_DOC;
            if (cut) text = text.slice(0, MAX_DOC) + '\n[...]';
            chat.doc = { name: f.name, text: text };
            $('c-doc').classList.remove('loading');
            $('c-doc-info').textContent = (res.pages ? res.pages + L(' sahifa · ', ' стр. · ', ' pages · ') : '') + (text.length >= 1000 ? Math.round(text.length / 1000) + 'k' : text.length) + L(' belgi', ' симв.', ' chars') + (cut ? L(' · qisqartirildi', ' · обрезано', ' · trimmed') : '');
        } catch (err) {
            clearDoc();
            toast(err && err.message === 'type' ? L('Faqat PDF, Word (.docx) va matn fayllari', 'Только PDF, Word (.docx) и текст', 'Only PDF, Word (.docx) and text files') : L("Faylni o'qib bo'lmadi", 'Не удалось прочитать файл', 'Could not read the file'), 'err');
        }
    };
    function onPicked(e) {
        var f = e.target.files && e.target.files[0];
        if (!f) return;
        if (!/^image\//.test(f.type)) { toast(L('Faqat rasm tanlang', 'Выберите изображение', 'Please pick an image'), 'err'); return; }
        shrink(f, 1280, 0.82).then(function (full) {
            shrink(f, 360, 0.7).then(function (thumb) {
                if (pickTarget === 'support') { sp.img = full; $('sp-att-img').src = thumb; $('sp-att').hidden = false; }
                else { chat.img = { full: full, thumb: thumb }; $('c-att-img').src = thumb; $('c-att').hidden = false; }
            });
        }).catch(function () { toast(L("Rasmni o'qib bo'lmadi", 'Не удалось прочитать фото', 'Could not read the image'), 'err'); });
    }
    $('file-img').onchange = onPicked;
    $('file-cam').onchange = onPicked;
    $('c-pick').onclick = function () { var f = feature('files'); if (f) { toast(f, 'warn'); return; } pickPhoto('chat'); };
    $('c-att-x').onclick = function () { chat.img = null; $('c-att').hidden = true; };

    function buildHistory() {
        var recent = chat.msgs.filter(function (m) { return !m.err && !m.gen && !m.genQ; }).slice(-12);
        return recent.map(function (m, i) {
            var parts = [];
            var isLast = i === recent.length - 1;
            if (isLast && m.r === 'u' && chat._sendImg) parts.push({ inline_data: { mime_type: 'image/jpeg', data: chat._sendImg.split(',')[1] } });
            if (m.send || m.t) parts.push({ text: m.send || m.t });
            else if (m.img) parts.push({ text: L('[Rasm]', '[Фото]', '[Image]') });
            return { role: m.r === 'u' ? 'user' : 'model', parts: parts };
        }).filter(function (h) { return h.parts.length; });
    }
    function isPro(m) { return !!(m && (m.sub || m.price > 0)); }
    function hasSub() { var r = state.rewards; return !!(r && r.subUntil && r.subUntil * 1000 > Date.now()); }
    function chatCTA(b, kind) {
        var btn = document.createElement('button');
        btn.className = 'btn primary b-cta';
        if (kind === 'money') { btn.textContent = '💳 ' + L("Hisobni to'ldirish", 'Пополнить баланс', 'Top up balance'); btn.onclick = function () { switchTab('wallet'); openTopup(); }; }
        else if (kind === 'limit') { btn.textContent = '♾️ ' + L('Cheksiz obuna', 'Безлимит', 'Unlimited plan'); btn.onclick = function () { switchTab('shop'); }; }
        else if (kind === 'sub') { btn.textContent = '⭐ ' + L('Obuna olish — barcha agentlar', 'Подписка — все агенты', 'Subscribe — all agents'); btn.onclick = function () { switchTab('shop'); }; }
        else if (kind === 'free') { btn.className = 'btn ghost b-cta'; btn.textContent = '⚡ ' + L("Bepul agentga o'tish", 'Перейти на бесплатного агента', 'Switch to the free agent'); btn.onclick = function () { var f = (state.models || []).filter(function (m) { return !isPro(m); })[0]; if (f) { chat.model = f.id; ls('ba_model', f.id); paintModel(); toast(f.name, 'ok'); } }; }
        b.appendChild(btn);
    }
    async function sendChat() {
        if (chat.busy) return;
        var ta = $('c-in');
        var text = ta.value.trim();
        if (chat.genMode) { genInChat(text); return; }
        if ($('c-doc').classList.contains('loading')) { toast(L("Fayl o'qilmoqda, biroz kuting", 'Файл читается, подождите', 'Reading the file, please wait')); return; }
        if (!text && !chat.img && !chat.doc) return;
        var off = feature('chat'); if (off) { toast(off, 'warn'); return; }
        var m = { r: 'u', t: text };
        if (chat.doc) {
            var askT = text || L("Ushbu hujjatni qisqacha tahlil qilib, asosiy fikrlarini ayt.", 'Кратко проанализируй документ и перечисли главные мысли.', 'Briefly analyze this document and list its key points.');
            m.doc = chat.doc.name;
            m.send = '[' + L('Biriktirilgan fayl', 'Прикреплённый файл', 'Attached file') + ': ' + chat.doc.name + ']\n"""\n' + chat.doc.text + '\n"""\n\n' + askT;
            if (!text) m.t = askT;
            clearDoc();
        }
        if (chat.img) { m.img = chat.img.thumb; chat._sendImg = chat.img.full; } else chat._sendImg = null;
        chat.msgs.push(m);
        chat.img = null; $('c-att').hidden = true;
        ta.value = ''; autoGrow(ta);
        renderChat(); saveChat();
        chat.busy = true; $('c-send').disabled = true;
        var box = $('c-msgs');
        var typing = document.createElement('div'); typing.className = 'typing'; typing.innerHTML = '<i></i><i></i><i></i>';
        box.appendChild(typing); scrollChat(true);
        var aiB = null, reply = '';
        var ctrl = new AbortController(); var to = setTimeout(function () { ctrl.abort(); }, 90000);
        try {
            var res = await fetch(SITE + '/api/chat', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: ctrl.signal,
                body: JSON.stringify({ history: buildHistory(), lang: lang, stream: true, mode: chat.mode, model: curModel().id, phone: state.phone, password: state.pass })
            });
            setBalance(res.headers.get('X-Balance'));
            var ct = res.headers.get('content-type') || '';
            if (res.ok && ct.indexOf('text/plain') >= 0 && res.body && res.body.getReader) {
                var rd = res.body.getReader(), dec = new TextDecoder(), last = 0;
                while (true) {
                    var chunk = await rd.read();
                    if (chunk.done) break;
                    reply += dec.decode(chunk.value, { stream: true });
                    if (!aiB && reply) { typing.remove(); aiB = bubble({ r: 'a', t: '' }); aiB.querySelector('.b-acts') && aiB.querySelector('.b-acts').remove(); box.appendChild(aiB); }
                    var now = Date.now();
                    if (aiB && now - last > (reply.length > 3000 ? 260 : 150)) { last = now; var tx = aiB.querySelector('.tx'); tx.innerHTML = md(reply); tx.classList.add('caret'); scrollChat(); }
                }
                reply += dec.decode();
            } else {
                var j = {};
                try { j = await res.json(); } catch (e) {}
                typing.remove();
                if (j.text) reply = j.text;
                else {
                    // xato: savol tarixdan olinadi, matn qaytariladi
                    var lastU = chat.msgs[chat.msgs.length - 1];
                    if (lastU && lastU.r === 'u') { chat.msgs.pop(); if (!ta.value && lastU.t) { ta.value = lastU.t; autoGrow(ta); } }
                    if (j.needLogin) { sessionExpired(); return; }
                    var eb = bubble({ r: 'a', t: '⚠️ ' + (j.error || L("Javob olib bo'lmadi", 'Не удалось получить ответ', 'Could not get a reply')), err: true });
                    if (j.insufficient) { chatCTA(eb, 'money'); chatCTA(eb, 'free'); setBalance(j.balance); }
                    if (j.needSub) { chatCTA(eb, 'sub'); chatCTA(eb, 'free'); }
                    if (j.limitReached) chatCTA(eb, 'limit');
                    renderChat(); box.appendChild(eb); scrollChat(true); saveChat();
                    return;
                }
            }
            reply = String(reply || '').trim();
            if (!reply) throw new Error('empty');
            if (curModel().price > 0 && !res.headers.get('X-Balance')) loadHistory();
            chat.msgs.push({ r: 'a', t: reply });
            saveChat(); renderChat();
        } catch (e) {
            typing.remove();
            var msg = e.name === 'AbortError' ? L("Javob juda cho'zildi. Qayta urinib ko'ring.", 'Ответ занял слишком долго. Попробуйте снова.', 'The reply took too long. Try again.')
                : L("AI bilan aloqada xatolik. Internetni tekshirib, qayta yuboring.", 'Ошибка связи с AI. Проверьте интернет.', 'Error reaching the AI. Check your internet.');
            if (reply.trim()) { chat.msgs.push({ r: 'a', t: reply.trim() }); saveChat(); renderChat(); }
            else { if (aiB) aiB.remove(); box.appendChild(bubble({ r: 'a', t: '⚠️ ' + msg, err: true })); scrollChat(true); }
        } finally {
            clearTimeout(to);
            chat.busy = false; $('c-send').disabled = false; chat._sendImg = null;
        }
    }
    $('c-send').onclick = sendChat;

    /* Chatda rasm yaratish (saytdagidek): 📎 → 🎨 Rasm yaratish. Rasm biriktirilsa — o'sha rasm tahrirlanadi */
    function setGenMode(on) {
        chat.genMode = on;
        $('c-gen').hidden = !on;
        $('c-img').classList.toggle('on', !!on);
        $('c-gen-t').textContent = L('Rasm yaratish', 'Создание изображения', 'Image generation');
        $('c-gen-s').textContent = (hasSub() ? L('Obunangiz bor — bepul', 'Подписка активна — бесплатно', 'Subscribed — free') : L('Obunachilar uchun bepul', 'Бесплатно для подписчиков', 'Free for subscribers'))
            + ' · ' + L('rasm biriktirsangiz — tahrirlanadi', 'прикрепите фото — отредактирую', 'attach a photo to edit it');
        $('c-in').placeholder = on ? L("Masalan: tog'lar ortida quyosh botmoqda, akvarel", 'Например: закат за горами, акварель', 'E.g. sunset behind mountains, watercolor') : L('Savolingizni yozing…', 'Напишите вопрос…', 'Ask anything…');
        if (on) $('c-in').focus();
    }
    $('c-gen-x').onclick = function () { setGenMode(false); };
    function imgAspect(src) {
        return new Promise(function (res) { var i = new Image(); i.onload = function () { res(i.naturalWidth / (i.naturalHeight || 1)); }; i.onerror = function () { res(1); }; i.src = src; });
    }
    async function genInChat(prompt) {
        var ta = $('c-in');
        if (!prompt) { ta.focus(); return; }
        var off = feature('image'); if (off) { toast(off, 'warn'); return; }
        var src = chat.img ? chat.img.full : null;
        var q = { r: 'u', t: prompt, genQ: true };
        if (chat.img) q.img = chat.img.thumb;
        chat.msgs.push(q);
        chat.img = null; $('c-att').hidden = true;
        ta.value = ''; autoGrow(ta);
        renderChat(); saveChat();
        chat.busy = true; $('c-send').disabled = true;
        var box = $('c-msgs');
        var wait = document.createElement('div'); wait.className = 'bubble ai gen-wait-b';
        wait.innerHTML = '<div class="gen-wait"></div><div class="tx"></div>';
        wait.querySelector('.tx').textContent = '🎨 ' + (src ? L('Rasm tahrirlanmoqda… (10–40 soniya)', 'Редактирую… (10–40 сек)', 'Editing… (10–40 s)') : L('Rasm chizilmoqda… (10–30 soniya)', 'Рисую… (10–30 сек)', 'Drawing… (10–30 s)'));
        box.appendChild(wait); scrollChat(true);
        try {
            var r = await fetch(SITE + '/api/image', { method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone: state.phone, password: state.pass, prompt: prompt, image: src || undefined, aspect: src ? await imgAspect(src) : undefined }) });
            var j = {}; try { j = await r.json(); } catch (e) {}
            wait.remove();
            if (j.balance != null) setBalance(j.balance);
            if (!r.ok || !j.image) {
                if (j.needLogin) { sessionExpired(); return; }
                var eb = bubble({ r: 'a', err: true, t: '⚠️ ' + (j.needSub ? L("Rasm yaratish faqat obunachilar uchun — obunada bepul va cheksiz.", 'Создание изображений только для подписчиков — бесплатно и без лимита.', 'Image generation is for subscribers only — free and unlimited with a subscription.')
                    : j.noMoney ? L('Balans yetarli emas. Rasm narxi: ', 'Недостаточно средств. Цена: ', 'Not enough balance. Price: ') + money(j.price) + ' ' + T('sum')
                    : (j.error || L("Rasm yaratib bo'lmadi", 'Не удалось создать изображение', 'Could not create the image'))) });
                if (j.needSub) chatCTA(eb, 'sub'); else if (j.noMoney) chatCTA(eb, 'money');
                box.appendChild(eb); scrollChat(true);
                return;
            }
            var th = await thumbOf(j.image);
            var a = { r: 'a', t: prompt, gen: th || j.image, full: j.image, approx: !!j.approx };
            chat.msgs.push(a); saveChat(); renderChat(); scrollChat(true);
            if (th) {
                var g = lsJSON('ba_gal', []);
                g.unshift({ thumb: th, prompt: prompt });
                g = g.slice(0, 12);
                try { ls('ba_gal', JSON.stringify(g)); } catch (e) { ls('ba_gal', JSON.stringify(g.slice(0, 4))); }
            }
        } catch (e) {
            wait.remove();
            box.appendChild(bubble({ r: 'a', err: true, t: '⚠️ ' + L("Server bilan bog'lanib bo'lmadi.", 'Ошибка соединения с сервером.', 'Server connection error.') })); scrollChat(true);
        } finally {
            chat.busy = false; $('c-send').disabled = false;
        }
    }

    /* ================= RASM YARATISH ================= */
    var IDEAS = [
        ['Kosmosdagi mushuk, multfilm uslubida', 'Кот в космосе, мультяшный стиль', 'A cat in space, cartoon style'],
        ["Samarqand Registoni kechasi, realistik", 'Регистан ночью, реалистично', 'Registan at night, realistic'],
        ["Logotip: chaqmoq va 'B' harfi, minimal", "Логотип: молния и буква 'B', минимализм", "Logo: lightning and letter 'B', minimal"],
        ["Kelajak shahri, neon chiroqlar", 'Город будущего, неон', 'Future city with neon lights'],
        ["Tog'larda quyosh botishi, akvarel", 'Закат в горах, акварель', 'Sunset in the mountains, watercolor']
    ];
    function paintIdeas() {
        var box = $('i-ideas'); box.innerHTML = '';
        IDEAS.forEach(function (i) {
            var b = document.createElement('button'); b.textContent = L(i[0], i[1], i[2]);
            b.onclick = function () { $('i-prompt').value = b.textContent; };
            box.appendChild(b);
        });
    }
    function paintImgPrice() {
        // Rasm yaratish — faqat obunachilar uchun va bepul
        $('i-price').textContent = hasSub()
            ? L('✅ Obunangiz bor — bepul, cheksiz · 10–30 soniya', '✅ Подписка активна — бесплатно, без лимита · 10–30 сек', '✅ Subscribed — free, unlimited · 10–30 s')
            : L('⭐ Faqat obunachilar uchun — obunada bepul', '⭐ Только для подписчиков — бесплатно по подписке', '⭐ Subscribers only — free with a subscription');
        if (typeof chat !== 'undefined' && chat.genMode) setGenMode(true);
    }
    function paintGallery() {
        var g = lsJSON('ba_gal', []), box = $('i-gal');
        box.innerHTML = '';
        if (!g.length) { var n = document.createElement('div'); n.className = 'none'; n.textContent = L("Hali rasm yaratilmagan", 'Пока нет изображений', 'No images yet'); box.appendChild(n); return; }
        g.forEach(function (it) {
            var im = document.createElement('img'); im.src = it.thumb; im.alt = it.prompt || '';
            im.onclick = function () {
                openSheet('<img style="width:100%;border-radius:16px;display:block" alt=""><p class="sh-sub" style="margin-top:10px"></p>', function (b) {
                    b.querySelector('img').src = it.thumb; b.querySelector('p').textContent = it.prompt || '';
                });
            };
            box.appendChild(im);
        });
    }
    function thumbOf(src) {
        return new Promise(function (resolve) {
            var img = new Image(); img.crossOrigin = 'anonymous';
            img.onload = function () {
                try {
                    var s = 300, c = document.createElement('canvas'); c.width = s; c.height = s;
                    var k = Math.max(s / img.naturalWidth, s / img.naturalHeight), w = img.naturalWidth * k, h = img.naturalHeight * k;
                    c.getContext('2d').drawImage(img, (s - w) / 2, (s - h) / 2, w, h);
                    resolve(c.toDataURL('image/jpeg', 0.7));
                } catch (e) { resolve(/^https?:/.test(src) ? src : ''); }
            };
            img.onerror = function () { resolve(''); };
            img.src = src;
        });
    }
    function saveImage(src) {
        if (N && N.saveImage) { N.saveImage(src); return; }
        var a = document.createElement('a'); a.href = src; a.download = 'bilols-ai.jpg'; document.body.appendChild(a); a.click(); a.remove();
    }
    $('i-go').onclick = async function () {
        var btn = this, prompt = $('i-prompt').value.trim();
        if (!prompt) { $('i-prompt').focus(); return; }
        var off = feature('image'); if (off) { toast(off, 'warn'); return; }
        var box = $('i-result');
        box.innerHTML = '<div class="gen-wait"></div>';
        box.firstChild.textContent = '🎨 ' + L('Rasm chizilmoqda…\n10–30 soniya', 'Рисую…\n10–30 сек', 'Drawing…\n10–30 s');
        btn.disabled = true;
        try {
            var r = await fetch(SITE + '/api/image', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: state.phone, password: state.pass, prompt: prompt }) });
            var j = {}; try { j = await r.json(); } catch (e) {}
            if (j.balance != null) setBalance(j.balance);
            if (!r.ok || !j.image) {
                box.innerHTML = '';
                var eb = bubble({ r: 'a', err: true, t: '⚠️ ' + (j.needSub ? L("Rasm yaratish faqat obunachilar uchun — obunada bepul va cheksiz.", 'Создание изображений только для подписчиков — бесплатно и без лимита.', 'Image generation is for subscribers only — free and unlimited with a subscription.') : j.noMoney ? L('Balans yetarli emas. Rasm narxi: ', 'Недостаточно средств. Цена: ', 'Not enough balance. Price: ') + money(j.price) + ' ' + T('sum') : (j.error || L("Rasm yaratib bo'lmadi", 'Не удалось создать изображение', 'Could not create the image'))) });
                eb.style.maxWidth = '100%';
                if (j.needSub) chatCTA(eb, 'sub');
                else if (j.noMoney) chatCTA(eb, 'money');
                box.appendChild(eb);
                return;
            }
            box.innerHTML = '<div class="gen-card"><img alt=""><div class="gc-row"><button class="btn primary" id="gc-save"></button><button class="btn ghost" id="gc-new"></button></div></div>';
            box.querySelector('img').src = j.image;
            $('gc-save').textContent = '⬇ ' + L('Saqlash', 'Сохранить', 'Save');
            $('gc-new').textContent = '✨ ' + L('Yana', 'Ещё', 'Again');
            $('gc-save').onclick = function () { saveImage(j.image); };
            $('gc-new').onclick = function () { $('i-go').click(); };
            var th = await thumbOf(j.image);
            if (th) {
                var g = lsJSON('ba_gal', []);
                g.unshift({ thumb: th, prompt: prompt });
                g = g.slice(0, 12);
                try { ls('ba_gal', JSON.stringify(g)); } catch (e) { ls('ba_gal', JSON.stringify(g.slice(0, 4))); }
                paintGallery();
            }
            loadHistory();
        } catch (e) { box.innerHTML = ''; netErr(); }
        finally { btn.disabled = false; }
    };

    /* ================= DO'KON ================= */
    async function loadShop() {
        try { var j = await getJSON(RAIL + '/api/shop'); state.shop = j.items || []; } catch (e) { state.shop = null; }
        paintShop();
    }
    function prodCard(it) {
        var b = document.createElement('button');
        b.className = 'prod';
        b.innerHTML = '<span class="p-ico"></span><b></b><span class="p-price"></span>';
        b.querySelector('.p-ico').textContent = it.kind === 'premium' ? '💎' : '⭐';
        b.querySelector('b').textContent = it.name;
        b.querySelector('.p-price').textContent = money(it.price) + ' ' + T('sum');
        if (it.old && it.old > it.price) { var s = document.createElement('s'); s.textContent = money(it.old) + ' ' + T('sum'); b.appendChild(s); }
        b.onclick = function () { buy(it); };
        return b;
    }
    function paintShop() {
        var st = $('s-stars'), pr = $('s-prem');
        if (!st) return;
        st.innerHTML = ''; pr.innerHTML = '';
        if (state.shop) state.shop.forEach(function (it) { (it.kind === 'premium' ? pr : st).appendChild(prodCard(it)); });
        else st.innerHTML = '<div class="skel-card"></div><div class="skel-card"></div><div class="skel-card"></div><div class="skel-card"></div>';
        var r = state.rewards, sub = $('s-sub');
        if (!r) { sub.hidden = true; return; }
        sub.hidden = false;
        var active = r.subUntil && r.subUntil * 1000 > Date.now();
        sub.innerHTML = '<b></b><p></p><button class="btn primary"></button>';
        sub.querySelector('b').textContent = '⭐ ' + L('Obuna — barcha AI agentlar', 'Подписка — все AI-агенты', 'Subscription — all AI agents');
        sub.querySelector('p').textContent = active
            ? L('Faol: ', 'Активно до: ', 'Active until: ') + new Date(r.subUntil * 1000).toLocaleDateString() + L(' · barcha agentlar ochiq', ' · все агенты открыты', ' · all agents unlocked')
            : L("GPT-4o, Gemini 2.5, DeepSeek va boshqa kuchli agentlar + cheksiz xabar. Bepul agentda kunlik limit: ", 'GPT-4o, Gemini 2.5, DeepSeek и другие мощные агенты + безлимит. Лимит бесплатного агента: ', 'GPT-4o, Gemini 2.5, DeepSeek and other pro agents + unlimited messages. Free agent daily limit: ') + (r.freeLimit || '—') + L(' ta xabar.', ' сообщ.', ' messages.');
        var sb = sub.querySelector('.btn');
        sb.textContent = (active ? L('Uzaytirish', 'Продлить', 'Extend') : L('Olish', 'Оформить', 'Get')) + ' · ' + money(r.subPrice) + ' ' + T('sum') + ' / ' + r.subDays + L(' kun', ' дн.', ' days');
        sb.onclick = subscribe;
    }
    function notEnough(price) {
        if (state.balance != null && Number(state.balance) < Number(price)) {
            ask(L('Balans yetarli emas', 'Недостаточно средств', 'Not enough balance'),
                L('Yana ', 'Нужно ещё ', 'You need ') + money(price - state.balance) + ' ' + T('sum') + L(' kerak.', '.', ' more.'),
                '💳 ' + L("To'ldirish", 'Пополнить', 'Top up')).then(function (ok) { if (ok) { switchTab('wallet'); openTopup(); } });
            return true;
        }
        return false;
    }
    async function buy(it) {
        var off = feature('shop'); if (off) { toast(off, 'warn'); return; }
        if (notEnough(it.price)) return;
        if (!await ask(it.name, L('Hisobingizdan ', 'С баланса спишется ', 'Your balance will be charged ') + money(it.price) + ' ' + T('sum') + L(' yechiladi.', '.', '.'), L('Sotib olish', 'Купить', 'Buy'))) return;
        try {
            var r = await fetch(RAIL + '/api/deduct-balance', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: state.phone, password: state.pass, amount: it.price, item: it.name }) });
            var j = {}; try { j = await r.json(); } catch (e) {}
            if (r.status === 403) { sessionExpired(); return; }
            if (!r.ok || !j.success) { toast(j.error || L('Balans yetarli emas', 'Недостаточно средств', 'Not enough balance'), 'err'); return; }
            setBalance(j.balance);
            toast('✅ ' + it.name + L(' — buyurtma qabul qilindi!', ' — заказ принят!', ' — order placed!'), 'ok', 3500);
            loadHistory();
        } catch (e) { netErr(); }
    }
    async function subscribe() {
        var r = state.rewards; if (!r) return;
        var off = feature('sub'); if (off) { toast(off, 'warn'); return; }
        if (notEnough(r.subPrice)) return;
        if (!await ask('⭐ ' + L('Obuna — barcha agentlar', 'Подписка — все агенты', 'Subscription — all agents'), money(r.subPrice) + ' ' + T('sum') + ' / ' + r.subDays + L(' kun · barcha AI agentlar va cheksiz xabar', ' дн. · все AI-агенты и безлимит', ' days · all AI agents and unlimited messages'), L('Olish', 'Оформить', 'Get'))) return;
        try {
            var j = await api('/api/subscribe');
            if (!j.success) { toast(j.error || 'Error', 'err'); return; }
            setBalance(j.balance); r.subUntil = j.subUntil; paintShop();
            toast(L('Obuna faollashdi ♾️', 'Подписка активна ♾️', 'Plan activated ♾️'), 'ok');
        } catch (e) { netErr(); }
    }

    /* ================= HAMYON ================= */
    var KIND_ICO = { topup: '💳', purchase: '🛒', deduct: '➖' };
    async function loadHistory() {
        var hb = $('w-hist');
        if (hb && !hb.children.length) hb.innerHTML = '<div class="skel-row"></div><div class="skel-row"></div><div class="skel-row"></div>';
        try {
            var j = await api('/api/history');
            if (!j.success) return;
            setBalance(j.balance);
            var box = $('w-hist'); box.innerHTML = '';
            var items = (j.items || []).slice(0, 60);
            if (!items.length) { box.innerHTML = '<div class="h-empty"></div>'; box.firstChild.textContent = L("Hozircha amallar yo'q", 'Пока нет операций', 'No transactions yet'); return; }
            items.forEach(function (it) {
                var inc = it.kind === 'topup';
                var row = document.createElement('div'); row.className = 'h-row';
                row.innerHTML = '<span class="h-ico"></span><span class="h-mid"><b></b><small></small></span><span class="h-amt"></span>';
                var ico = KIND_ICO[it.kind] || '•';
                if (it.source === 'bonus') ico = '🎁'; else if (it.source === 'promo') ico = '🎟️'; else if (it.source === 'ai') ico = '🤖'; else if (it.source === 'image') ico = '🎨'; else if (it.source === 'sub') ico = '♾️';
                row.querySelector('.h-ico').textContent = ico;
                row.querySelector('b').textContent = it.item || (inc ? L("Hisob to'ldirildi", 'Пополнение', 'Top-up') : L('Xarid', 'Покупка', 'Purchase'));
                var d = new Date((it.created_at || 0) * 1000);
                var stx = it.status === 'pending' ? ' · ⏳ ' + L('kutilmoqda', 'в обработке', 'pending') : it.status === 'done' ? ' · ✅' : it.status === 'refunded' ? ' · ↩️' : '';
                row.querySelector('small').textContent = d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + stx;
                var a = row.querySelector('.h-amt');
                a.textContent = (inc ? '+' : '−') + money(Math.abs(it.amount));
                if (inc) a.classList.add('plus');
                box.appendChild(row);
            });
        } catch (e) {}
    }
    $('w-hist-re').onclick = function () { loadHistory(); loadRewards(); };
    $('w-id-copy').onclick = function () { var id = state.rewards && state.rewards.publicId; if (id) copyText(String(id)); };
    function paintWalletActs() {
        var r = state.rewards;
        $('w-bonus').classList.toggle('done', !!(r && r.claimedToday));
    }
    function openTopup() {
        var off = feature('topup'); if (off) { toast(off, 'warn'); return; }
        openSheet('<div class="sh-title">💳 ' + esc(L("Karta orqali to'ldirish", 'Пополнение картой', 'Top up by card')) + '</div>' +
            '<p class="sh-sub">' + esc(L("Summani tanlang. So'rov Telegram botingizga boradi: kartaga o'tkazib, chek skrinshotini yuborasiz — pul balansga tushadi.",
                'Выберите сумму. Запрос придёт в ваш Telegram-бот: переведите на карту и отправьте скриншот чека — деньги зачислятся.',
                'Pick an amount. The request goes to your Telegram bot: transfer to the card and send the receipt screenshot — the money is credited.')) + '</p>' +
            '<div class="amounts" id="amts"></div><input class="sh-input" id="t-amt" inputmode="numeric" placeholder="' + esc(L('Boshqa summa', 'Другая сумма', 'Other amount')) + '">' +
            '<button class="btn primary big" id="t-go">' + esc(L('Davom etish', 'Продолжить', 'Continue')) + '</button>',
            function (b) {
                var inp = b.querySelector('#t-amt');
                [10000, 20000, 50000, 100000, 200000, 500000].forEach(function (v) {
                    var x = document.createElement('button'); x.textContent = money(v);
                    x.onclick = function () { inp.value = money(v); };
                    b.querySelector('#amts').appendChild(x);
                });
                inp.oninput = function () { var d = inp.value.replace(/\D/g, ''); inp.value = d ? money(Number(d)) : ''; };
                b.querySelector('#t-go').onclick = async function () {
                    var amount = Number(inp.value.replace(/\D/g, ''));
                    if (!amount || amount < 1000) { toast(L("Kamida 1 000 so'm", 'Минимум 1 000 сум', 'At least 1,000 UZS'), 'err'); return; }
                    this.disabled = true;
                    try {
                        var j = await api('/api/card/topup', { amount: amount });
                        if (j.needBot && j.botUrl) { closeSheet(true); openExternal(j.botUrl); return; }
                        if (!j.success) { toast(j.error || 'Error', 'err'); this.disabled = false; return; }
                        closeSheet(true);
                        var ok = await ask('✅ ' + L("So'rov yuborildi", 'Запрос отправлен', 'Request sent'),
                            L("Telegram botingizni oching: karta raqami va summa o'sha yerda. To'lovdan keyin chek skrinshotini botga yuboring.", 'Откройте Telegram-бот: там номер карты и сумма. После оплаты отправьте скриншот чека в бот.', 'Open your Telegram bot: the card number and amount are there. After paying, send the receipt screenshot to the bot.'),
                            L('Botni ochish', 'Открыть бот', 'Open bot'));
                        if (ok && j.botUrl) openExternal(j.botUrl);
                    } catch (e) { netErr(); this.disabled = false; }
                };
            });
    }
    $('w-top').onclick = openTopup;
    $('w-promo').onclick = function () {
        var off = feature('promo'); if (off) { toast(off, 'warn'); return; }
        openSheet('<div class="sh-title">🎟️ ' + esc(T('promo')) + '</div><input class="sh-input" id="p-code" autocapitalize="characters" placeholder="BILOLS2026"><button class="btn primary big" id="p-go">' + esc(L('Faollashtirish', 'Активировать', 'Redeem')) + '</button>',
            function (b) {
                setTimeout(function () { b.querySelector('#p-code').focus(); }, 200);
                b.querySelector('#p-go').onclick = async function () {
                    var code = b.querySelector('#p-code').value.trim();
                    if (!code) return;
                    this.disabled = true;
                    try {
                        var j = await api('/api/promo/redeem', { code: code });
                        if (!j.success) { toast(j.error || 'Error', 'err'); this.disabled = false; return; }
                        setBalance(j.balance); closeSheet(true); loadHistory();
                        toast('🎉 +' + money(j.amount) + ' ' + T('sum'), 'ok');
                    } catch (e) { netErr(); this.disabled = false; }
                };
            });
    };
    $('w-bonus').onclick = async function () {
        var off = feature('bonus'); if (off) { toast(off, 'warn'); return; }
        if (state.rewards && state.rewards.claimedToday) { toast(L('Bugungi bonus olingan. Ertaga qayting!', 'Бонус уже получен. Приходите завтра!', 'Already claimed today. Come back tomorrow!')); return; }
        try {
            var j = await api('/api/daily-bonus');
            if (j.success) { setBalance(j.balance); toast('🎁 +' + money(j.amount) + ' ' + T('sum'), 'ok'); loadHistory(); }
            else toast(j.error || 'Error', j.already ? '' : 'err');
            if (state.rewards && (j.success || j.already)) { state.rewards.claimedToday = true; paintWalletActs(); }
        } catch (e) { netErr(); }
    };
    $('w-ref').onclick = function () {
        var r = state.rewards;
        if (!r) { loadRewards(); return; }
        var link = r.botRefUrl || ('https://bilolsai.uz/?ref=' + (r.refCode || ''));
        openSheet('<div class="sh-title">👥 ' + esc(L("Do'stlarni taklif qiling", 'Пригласите друзей', 'Invite friends')) + '</div><p class="sh-sub"></p><div class="ref-box"><code></code></div>' +
            '<div class="sh-row"><button class="btn ghost" id="r-copy"></button><button class="btn primary" id="r-share"></button></div>',
            function (b) {
                b.querySelector('.sh-sub').textContent = L("Har bir do'stingiz uchun ", 'За каждого друга — ', 'For each friend: ') + money(r.refBonus) + ' ' + T('sum') + '.\n' +
                    L('Taklif qilinganlar: ', 'Приглашено: ', 'Invited: ') + (r.invited || 0) + ' · ' + L('Ishlangan: ', 'Заработано: ', 'Earned: ') + money(r.earned) + ' ' + T('sum');
                b.querySelector('code').textContent = link;
                b.querySelector('#r-copy').textContent = L('Nusxa', 'Копировать', 'Copy');
                b.querySelector('#r-share').textContent = L('Ulashish', 'Поделиться', 'Share');
                b.querySelector('#r-copy').onclick = function () { copyText(link); };
                b.querySelector('#r-share').onclick = function () { shareText(L('Bilols AI — shaxsiy AI yordamchi. Shu havola orqali qo\'shiling: ', 'Bilols AI — личный AI-помощник. Присоединяйтесь: ', 'Bilols AI — personal AI assistant. Join here: ') + link); };
            });
    };

    /* ================= YON MENYU ================= */
    var IC = {
        chat: '<svg viewBox="0 0 24 24"><path d="M20 12a8 8 0 0 1-11.6 7.1L4 20l1-4.2A8 8 0 1 1 20 12z"/></svg>',
        mode: '<svg viewBox="0 0 24 24"><path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.6 10.8c.6.5 1 1.2 1 2V16h5.2v-.2c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z"/></svg>',
        image: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/></svg>',
        edit: '<svg viewBox="0 0 24 24"><path d="M4 20L15 9"/><path d="M14 4l1 2 2 1-2 1-1 2-1-2-2-1 2-1z"/><path d="M15 9l2-2"/></svg>',
        file: '<svg viewBox="0 0 24 24"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/></svg>',
        gear: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
        shop: '<svg viewBox="0 0 24 24"><path d="M6 7h12l-1 13H7z"/><path d="M9 7a3 3 0 0 1 6 0"/></svg>',
        wallet: '<svg viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="13" rx="3"/><path d="M3 10h18M16 14h2"/></svg>',
        help: '<svg viewBox="0 0 24 24"><path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1v-6h3zM3 19a2 2 0 0 0 2 2h1v-6H3z"/></svg>',
        x: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>'
    };
    function drawerOpen() { return $('drawer').classList.contains('on'); }
    function openDrawer() { hideKeyboard(); paintDrawer(); syncPull(); $('drawer').classList.add('on'); $('drawer').setAttribute('aria-hidden', 'false'); haptic(); }
    function closeDrawer() { var d = $('drawer'); if (!d) return; d.classList.remove('on'); d.setAttribute('aria-hidden', 'true'); }
    function drItem(icon, text, onClick, right, cls) {
        var b = document.createElement('button');
        b.className = 'dr-item' + (cls ? ' ' + cls : '');
        b.innerHTML = '<span class="dr-ic">' + icon + '</span><span class="dr-tx"></span>' + (right ? '<span class="dr-r"></span>' : '');
        b.querySelector('.dr-tx').textContent = text;
        if (right) { b.querySelector('.dr-r').textContent = right.text; if (right.cls) b.querySelector('.dr-r').className = 'dr-r ' + right.cls; }
        b.onclick = function () { haptic(); onClick(); };
        return b;
    }
    function paintDrawer() {
        if (!$('dr-recent')) return;
        $('dr-new-t').textContent = L('Yangi suhbat', 'Новый чат', 'New Chat');
        $('dr-recent-h').textContent = L("So'nggi", 'Недавние', 'Recent');
        $('dr-tools-h').textContent = L('Vositalar', 'Инструменты', 'Tools');
        $('dr-acc-h').textContent = L('Hisob', 'Аккаунт', 'Account');
        var rec = $('dr-recent'); rec.innerHTML = '';
        if (!chats.length) {
            var em = document.createElement('div'); em.className = 'dr-empty';
            em.textContent = L("Hali suhbatlar yo'q", 'Пока нет чатов', 'No chats yet');
            rec.appendChild(em);
        }
        chats.slice(0, 30).forEach(function (c) {
            var it = drItem(IC.chat, c.title || L('Suhbat', 'Чат', 'Chat'), function () { openChat(c.id); }, null, c.id === chat.id && state.tab === 'chat' ? 'on' : '');
            var del = document.createElement('span'); del.className = 'dr-del'; del.innerHTML = IC.x;
            del.onclick = function (e) { e.stopPropagation(); deleteChat(c.id); };
            it.appendChild(del);
            rec.appendChild(it);
        });
        var tools = $('dr-tools'); tools.innerHTML = '';
        var md0 = MODES.filter(function (m) { return m[0] === chat.mode; })[0];
        tools.appendChild(drItem(IC.mode, L('AI rejimi', 'Режим ИИ', 'AI mode'), function () { closeDrawer(); modesSheet(); }, chat.mode && md0 ? { text: md0[1] + ' ' + L(md0[2], md0[3], md0[4]) } : null));
        tools.appendChild(drItem(IC.image, L('Rasm yaratish', 'Создать изображение', 'Create Image'), function () { closeDrawer(); switchTab('chat'); setGenMode(true); }));
        tools.appendChild(drItem(IC.edit, L('Rasmni tahrirlash', 'Редактировать фото', 'Edit Image'), function () {
            closeDrawer(); switchTab('chat'); setGenMode(true); pickTarget = 'chat'; var inp = $('file-img'); inp.value = ''; inp.click();
        }));
        tools.appendChild(drItem(IC.file, L('Fayl yoki rasm tahlili', 'Анализ файла или фото', 'Analyze a file or photo'), function () { closeDrawer(); switchTab('chat'); $('c-pick').click(); }));
        var acc = $('dr-acc'); acc.innerHTML = '';
        acc.appendChild(drItem(IC.gear, L('Sozlamalar', 'Настройки', 'Preferences'), function () { closeDrawer(); $('tb-me').onclick(); }));
        acc.appendChild(drItem(IC.shop, L("Do'kon", 'Магазин', 'Shop'), function () { closeDrawer(); switchTab('shop'); }, hasSub() ? { text: '⭐', cls: 'gold' } : null, state.tab === 'shop' ? 'on' : ''));
        acc.appendChild(drItem(IC.wallet, L('Hamyon', 'Кошелёк', 'Wallet'), function () { closeDrawer(); switchTab('wallet'); },
            { text: state.balance == null ? '—' : money(state.balance) + ' ' + T('sum') }, state.tab === 'wallet' ? 'on' : ''));
        acc.appendChild(drItem(IC.help, L('Admin bilan chat', 'Чат с админом', 'Chat with admin'), function () { closeDrawer(); openSupport(); },
            sp.unread > 0 ? { text: String(sp.unread), cls: 'badge' } : null));
        $('dr-ava').textContent = (state.name || 'B').trim().charAt(0).toUpperCase() || 'B';
        $('dr-name').textContent = state.name || 'Bilols AI';
        $('dr-phone').textContent = state.phone ? '+' + state.phone : '';
    }
    $('tb-menu').onclick = openDrawer;
    $('dr-close').onclick = closeDrawer;
    $('dr-bg').onclick = closeDrawer;
    $('dr-new').onclick = function () { haptic(); newChat(); };
    $('dr-me').onclick = function () { closeDrawer(); $('tb-me').onclick(); };
    // Chap chetdan o'ngga surilsa — menyu ochiladi, menyuda chapga surilsa — yopiladi
    (function () {
        var x0 = 0, y0 = 0, edge = false, inDr = false;
        document.addEventListener('touchstart', function (e) {
            if (!state.inMain || sheetClose || e.touches.length !== 1) return;
            x0 = e.touches[0].clientX; y0 = e.touches[0].clientY;
            edge = !drawerOpen() && x0 < 24 && $('main').classList.contains('on') && !sp.open;
            inDr = drawerOpen();
        }, { passive: true });
        document.addEventListener('touchend', function (e) {
            var t = e.changedTouches && e.changedTouches[0]; if (!t) return;
            var dx = t.clientX - x0, dy = Math.abs(t.clientY - y0);
            if (edge && dx > 60 && dy < 60) openDrawer();
            else if (inDr && dx < -60 && dy < 60) closeDrawer();
            edge = inDr = false;
        }, { passive: true });
    })();

    /* ================= PROFIL ================= */
    $('tb-me').onclick = function () {
        var r = state.rewards || {};
        openSheet('<div class="me-head"><div class="me-ava"></div><div><b></b><small></small></div></div><div class="menu">' +
            '<button data-k="sup"><span class="m-ico">💬</span>' + esc(L('Yordam — admin bilan chat', 'Поддержка — чат с админом', 'Support — chat with admin')) + '<span class="m-badge" id="m-unread" hidden></span></button>' +
            '<button data-k="lang"><span class="m-ico">🌍</span>' + esc(L('Til', 'Язык', 'Language')) + '<span class="m-r">' + ({ uz: "O'zbekcha", ru: 'Русский', en: 'English' })[lang] + '</span></button>' +
            (pushSupported() ? '<button data-k="push"><span class="m-ico">📳</span>' + esc(L('Bildirishnomalar', 'Уведомления', 'Notifications')) + '<span class="m-r" id="m-push"></span></button>' : '') +
            '<button data-k="snd"><span class="m-ico">🔔</span>' + esc(L("Pul tushganda ovoz", 'Звук при зачислении', 'Sound on top-up')) + '<span class="m-r" id="m-snd">' + (ls('ba_sound') === 'off' ? L("O'chiq", 'Выкл', 'Off') : L('Yoqilgan', 'Вкл', 'On')) + '</span></button>' +
            '<button data-k="pass"><span class="m-ico">🔑</span>' + esc(L("Parolni o'zgartirish", 'Сменить пароль', 'Change password')) + '</button>' +
            '<button data-k="bot"><span class="m-ico">✈️</span>' + esc(L('Telegram botni ochish', 'Открыть Telegram-бот', 'Open Telegram bot')) + '</button>' +
            '<button data-k="site"><span class="m-ico">🌐</span>bilolsai.uz</button>' +
            '<button data-k="priv"><span class="m-ico">🔒</span>' + esc(L('Maxfiylik siyosati', 'Политика конфиденциальности', 'Privacy policy')) + '</button>' +
            '<button data-k="out" class="red"><span class="m-ico">⏻</span>' + esc(L('Chiqish', 'Выйти', 'Log out')) + '</button></div>' +
            '<p class="sh-sub" style="text-align:center;margin-top:8px">Bilols AI · v' + VERSION + '</p>',
            function (b) {
                b.querySelector('.me-ava').textContent = (state.name || 'B').charAt(0).toUpperCase();
                b.querySelector('.me-head b').textContent = state.name || 'Bilols AI';
                b.querySelector('.me-head small').textContent = '+' + state.phone + (r.publicId ? ' · 🆔 ' + r.publicId : '');
                if (sp.unread) { var u = b.querySelector('#m-unread'); u.textContent = sp.unread; u.hidden = false; }
                function paintPush() {
                    var e = b.querySelector('#m-push'); if (!e) return;
                    var allowed = false; try { allowed = N.notifyAllowed(); } catch (er) {}
                    e.textContent = !allowed ? L('Ruxsat yo\'q', 'Нет доступа', 'Not allowed') : pushOn() ? L('Yoqilgan', 'Вкл', 'On') : L("O'chiq", 'Выкл', 'Off');
                }
                paintPush();
                b.querySelectorAll('[data-k]').forEach(function (x) {
                    x.onclick = function () {
                        var k = x.getAttribute('data-k');
                        if (k === 'sup') { closeSheet(true); openSupport(); }
                        else if (k === 'lang') { langSheet(); }
                        else if (k === 'snd') {
                            var off = ls('ba_sound') !== 'off';
                            ls('ba_sound', off ? 'off' : 'on');
                            ls('bilol_ai_sound', off ? 'false' : 'true');
                            $('m-snd').textContent = off ? L("O'chiq", 'Выкл', 'Off') : L('Yoqilgan', 'Вкл', 'On');
                            if (!off) playMoney();
                        }
                        else if (k === 'push') {
                            var allowed = false; try { allowed = N.notifyAllowed(); } catch (er) {}
                            if (!allowed) {
                                try { if (ls('ba_notify_denied')) N.openNotifySettings(); else { ls('ba_notify_denied', '1'); N.askNotify(); } } catch (er) {}
                                setTimeout(paintPush, 1500);
                            } else {
                                ls('ba_push', pushOn() ? 'off' : 'on'); pushSync(true); paintPush();
                                if (pushOn()) { try { N.vibrate(150); } catch (er) {} }
                                toast(pushOn() ? L('📳 Bildirishnomalar yoqildi', '📳 Уведомления включены', '📳 Notifications on') : L("🔕 Bildirishnomalar o'chirildi", '🔕 Уведомления выключены', '🔕 Notifications off'));
                            }
                        }
                        else if (k === 'pass') { passSheet(); }
                        else if (k === 'bot') { closeSheet(true); openExternal((r.botRefUrl || '').split('?')[0] || 'https://t.me/'); }
                        else if (k === 'site') { closeSheet(true); openExternal('https://bilolsai.uz'); }
                        else if (k === 'priv') { closeSheet(true); openPrivacy(); }
                        else if (k === 'out') { ask(L('Chiqish', 'Выход', 'Log out'), L('Hisobingizdan chiqasizmi?', 'Выйти из аккаунта?', 'Log out of your account?'), L('Chiqish', 'Выйти', 'Log out'), true).then(function (ok) { if (ok) logout(); }); }
                    };
                });
            });
    };
    function langSheet() {
        openSheet('<div class="sh-title">🌍 ' + esc(L('Til', 'Язык', 'Language')) + '</div><div class="sh-list" id="ll"></div>', function (b) {
            [['uz', "O'zbekcha", '🇺🇿'], ['ru', 'Русский', '🇷🇺'], ['en', 'English', '🇬🇧']].forEach(function (l) {
                var o = document.createElement('button'); o.className = 'opt' + (l[0] === lang ? ' on' : '');
                o.innerHTML = '<span class="o-ico"></span><span class="o-mid"><b></b></span>';
                o.querySelector('.o-ico').textContent = l[2]; o.querySelector('b').textContent = l[1];
                o.onclick = function () { setLang(l[0]); closeSheet(true); };
                b.querySelector('#ll').appendChild(o);
            });
        });
    }
    function passSheet() {
        openSheet('<div class="sh-title">🔑 ' + esc(L("Parolni o'zgartirish", 'Сменить пароль', 'Change password')) + '</div>' +
            '<input class="sh-input" id="pw-old" type="password" placeholder="' + esc(L('Joriy parol', 'Текущий пароль', 'Current password')) + '">' +
            '<input class="sh-input" id="pw-new" type="password" placeholder="' + esc(L('Yangi parol', 'Новый пароль', 'New password')) + '">' +
            '<button class="btn primary big" id="pw-go">' + esc(L('Saqlash', 'Сохранить', 'Save')) + '</button>',
            function (b) {
                b.querySelector('#pw-go').onclick = async function () {
                    var o = b.querySelector('#pw-old').value.trim(), n = b.querySelector('#pw-new').value.trim();
                    if (!o || n.length < 4) { toast(L("Yangi parol kamida 4 belgi", 'Новый пароль — от 4 символов', 'New password: 4+ characters'), 'err'); return; }
                    this.disabled = true;
                    try {
                        var r = await fetch(RAIL + '/api/change-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: state.phone, oldPassword: o, newPassword: n }) });
                        var j = {}; try { j = await r.json(); } catch (e) {}
                        if (!r.ok || !j.success) { toast(j.error || 'Error', 'err'); this.disabled = false; return; }
                        state.pass = n; ls('ba_pass', n);
                        closeSheet(true); toast(L('Parol yangilandi', 'Пароль обновлён', 'Password updated'), 'ok');
                    } catch (e) { netErr(); this.disabled = false; }
                };
            });
    }

    /* ================= YORDAM CHATI ================= */
    var sp = { open: false, ver: null, msgs: [], img: null, unread: 0, loop: 0 };
    var TPL = [
        ["🔑 Parolni unutdim", '🔑 Забыл пароль', '🔑 Forgot password'],
        ["💳 To'lov tushmadi", '💳 Оплата не пришла', '💳 Payment not received'],
        ['⭐ Stars kelmadi', '⭐ Stars не пришли', '⭐ Stars not received'],
        ['❓ Savolim bor', '❓ У меня вопрос', '❓ I have a question']
    ];
    function paintTpl() {
        var box = $('sp-tpl'); box.innerHTML = '';
        TPL.forEach(function (t) {
            var b = document.createElement('button'); b.textContent = L(t[0], t[1], t[2]);
            b.onclick = function () { $('sp-in').value = b.textContent + ': '; $('sp-in').focus(); };
            box.appendChild(b);
        });
    }
    function presence(a) {
        var el = $('sp-status');
        if (!a) { el.textContent = ''; return; }
        if (a.online) { el.textContent = '🟢 ' + L('Admin onlayn', 'Админ онлайн', 'Admin online'); el.className = 'on'; }
        else {
            el.className = '';
            var mins = a.lastSeen ? Math.round((Date.now() / 1000 - a.lastSeen) / 60) : null;
            el.textContent = mins == null || mins > 60 * 24 * 7 ? L('Admin tez orada javob beradi', 'Админ скоро ответит', 'Admin will reply soon')
                : mins < 60 ? L('Oxirgi marta ', 'Был(а) ', 'Last seen ') + Math.max(1, mins) + L(' daq. oldin', ' мин. назад', ' min ago')
                : L('Oxirgi marta ', 'Был(а) ', 'Last seen ') + Math.round(mins / 60) + L(' soat oldin', ' ч. назад', ' h ago');
        }
    }
    function renderSupport() {
        var box = $('sp-msgs'); box.innerHTML = '';
        if (!sp.msgs.length) {
            var e = document.createElement('div'); e.className = 'empty-chat';
            e.innerHTML = '<div class="ec-ico">💬</div><b></b><span></span>';
            e.querySelector('b').textContent = L('Savolingiz bormi?', 'Есть вопрос?', 'Have a question?');
            e.querySelector('span').textContent = L("Yozing — admin javob beradi. Chek yoki skrinshot ham yuborishingiz mumkin.", 'Напишите — админ ответит. Можно отправить чек или скриншот.', 'Write and the admin will reply. You can attach a receipt or screenshot.');
            box.appendChild(e); return;
        }
        var lastDay = '';
        sp.msgs.forEach(function (m) {
            var d = new Date(m.at * 1000), day = d.toLocaleDateString();
            if (day !== lastDay) { lastDay = day; var dd = document.createElement('div'); dd.className = 'sp-day'; dd.textContent = day; box.appendChild(dd); }
            var b = document.createElement('div'); b.className = 'bubble ' + (m.sender === 'user' ? 'me' : 'ai');
            if (m.image) { var im = document.createElement('img'); im.className = 'sp-img'; im.src = RAIL + '/api/support/img/' + encodeURIComponent(m.image); im.onclick = function () { openSheet('<img style="width:100%;border-radius:16px" alt="">', function (s) { s.querySelector('img').src = im.src; }); }; b.appendChild(im); }
            if (m.text) { var tx = document.createElement('div'); tx.className = 'tx'; tx.textContent = m.text; b.appendChild(tx); }
            var meta = document.createElement('div'); meta.className = 'sp-meta';
            meta.textContent = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + (m.sender === 'user' ? (m.pending ? ' 🕓' : m.read ? ' ✓✓' : ' ✓') : '');
            b.appendChild(meta); box.appendChild(b);
        });
        box.scrollTop = box.scrollHeight;
    }
    async function supportLoad(waitVer) {
        var j = await api('/api/support/list', waitVer == null ? null : { ver: waitVer });
        if (!j.success) return false;
        var srv = j.messages || [];
        var pend = sp.msgs.filter(function (m) {
            return m.pending && !srv.some(function (x) { return x.sender === 'user' && x.text === m.text && Math.abs(x.at - m.at) < 120; });
        });
        sp.ver = j.ver; sp.msgs = srv.concat(pend); presence(j.admin);
        sp.unread = 0; paintUnread();
        if (sp.open) renderSupport();
        return true;
    }
    async function supportLoop(id) {
        while (sp.open && sp.loop === id) {
            try { if (!await supportLoad(sp.ver)) await sleep(4000); }
            catch (e) { await sleep(4000); }
        }
    }
    function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
    function openSupport() {
        sp.open = true;
        $('support').classList.add('on');
        paintTpl(); renderSupport();
        supportLoad(null).then(function () { var id = ++sp.loop; supportLoop(id); }).catch(function () {});
    }
    function closeSupport() { sp.open = false; sp.loop++; $('support').classList.remove('on'); }
    $('sp-back').onclick = closeSupport;
    $('sp-pick').onclick = function () { pickPhoto('support'); };
    $('sp-att-x').onclick = function () { sp.img = null; $('sp-att').hidden = true; };
    $('sp-in').addEventListener('input', function () { autoGrow(this); });
    $('sp-send').onclick = async function () {
        var ta = $('sp-in'), text = ta.value.trim();
        if (!text && !sp.img) return;
        var btn = this;
        if (btn.disabled) return;
        btn.disabled = true;
        var img = sp.img;
        // Darhol ko'rsatamiz (vaqtinchalik), server javobidan keyin almashtiramiz
        var tmp = { id: 'tmp' + Date.now(), sender: 'user', text: text, at: Date.now() / 1000, read: false, pending: true };
        sp.msgs.push(tmp); renderSupport();
        ta.value = ''; autoGrow(ta); sp.img = null; $('sp-att').hidden = true;
        function dropTmp() { var i = sp.msgs.indexOf(tmp); if (i >= 0) sp.msgs.splice(i, 1); }
        try {
            var j = await api('/api/support/send', img ? { text: text, image: img } : { text: text });
            if (!j.success) { dropTmp(); renderSupport(); ta.value = text; autoGrow(ta); toast(j.error || 'Error', 'err'); return; }
            dropTmp();
            // Uzoq so'rov (long-poll) xabarni allaqachon olib kelgan bo'lishi mumkin — ikki marta qo'shmaymiz
            if (j.message && !sp.msgs.some(function (m) { return m.id === j.message.id; })) sp.msgs.push(Object.assign({ read: false }, j.message));
            renderSupport();
            presence(j.admin);
        } catch (e) { dropTmp(); renderSupport(); ta.value = text; autoGrow(ta); netErr(); }
        finally { btn.disabled = false; }
    };
    function paintUnread() { $('tb-me').classList.toggle('dot', sp.unread > 0); $('tb-menu-dot').hidden = !(sp.unread > 0); paintDrawer(); }
    async function peekSupport() {
        if (!state.inMain) return;
        if (!sp.open) {
            try { var j = await api('/api/support/list', { peek: true }); if (j.success) { sp.unread = j.unread || 0; paintUnread(); } } catch (e) {}
        }
        setTimeout(peekSupport, 30000);
    }

    /* ================= Klaviatura va "Orqaga" tugmasi ================= */
    function hideKeyboard() { var a = document.activeElement; if (a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA')) a.blur(); }
    // Yozish maydonidan tashqariga bosilsa — klaviatura yopiladi
    document.addEventListener('touchstart', function (e) {
        var t = e.target;
        if (t.closest && t.closest('input, textarea, .send, #c-pick, #sp-pick, .comp-row, .sh-input, .field')) return;
        hideKeyboard();
    }, { passive: true });
    var maxH = window.innerHeight;
    window.addEventListener('resize', function () {
        maxH = Math.max(maxH, window.innerHeight);
        document.body.classList.toggle('kb', window.innerHeight < maxH - 150);
        if (state.tab === 'chat') scrollChat(true);
    });
    window.__back = function () {
        if (sheetClose) { closeSheet(false); return true; }
        if (drawerOpen()) { closeDrawer(); return true; }
        if (lpMenuOpen()) { closeLpMenu(); return true; }
        if (!state.inMain && $('auth').classList.contains('on') && !auth.busy) { show('landing'); return true; }
        if ($('privacy').classList.contains('on')) { closePrivacy(); return true; }
        if (sp.open) { closeSupport(); return true; }
        if (state.inMain && state.tab !== 'chat') { switchTab('chat'); return true; }
        return false;
    };
    window.addEventListener('keydown', function (e) { if (e.key === 'Escape') window.__back(); });

    /* ================= Tepadan pastga tortib yangilash ================= */
    (function () {
        var ptr = $('ptr'), startY = 0, dy = 0, active = false, el = null;
        var LIMIT = 70;
        function scroller(t) { return t.closest && t.closest('.scroll, .msgs, #auth'); }
        document.addEventListener('touchstart', function (e) {
            if (sheetClose || e.touches.length !== 1) return;
            el = scroller(e.target);
            if (!el || el.scrollTop > 0) { active = false; return; }
            startY = e.touches[0].clientY; dy = 0; active = true;
            ptr.classList.remove('anim');
        }, { passive: true });
        document.addEventListener('touchmove', function (e) {
            if (!active) return;
            dy = e.touches[0].clientY - startY;
            if (dy <= 0 || el.scrollTop > 0) { ptr.style.opacity = 0; ptr.style.transform = 'translateY(-70px)'; return; }
            var d = Math.min(dy * 0.5, 110);
            ptr.style.opacity = Math.min(1, d / LIMIT);
            ptr.style.transform = 'translateY(' + (d - 50) + 'px) rotate(' + (d * 3) + 'deg)';
            ptr.classList.toggle('ready', d >= LIMIT);
        }, { passive: true });
        document.addEventListener('touchend', function () {
            if (!active) return;
            active = false;
            ptr.classList.add('anim');
            if (dy * 0.5 >= LIMIT) {
                ptr.style.transform = 'translateY(30px)'; ptr.style.opacity = 1; ptr.classList.add('spin');
                if (navigator.vibrate) { try { navigator.vibrate(15); } catch (e) {} }
                setTimeout(function () { location.reload(); }, 350);   // yangi dizayn va ma'lumotlar bilan qayta yuklanadi
            } else { ptr.style.transform = 'translateY(-70px)'; ptr.style.opacity = 0; ptr.classList.remove('ready'); }
        });
    })();

    /* ================= Ishga tushirish ================= */
    async function start() {
        document.documentElement.classList.toggle('desk', isDesk());
        if (deskMq) { if (deskMq.addEventListener) deskMq.addEventListener('change', paintDesk); else if (deskMq.addListener) deskMq.addListener(paintDesk); }
        applyI18n();
        paintLangRow($('auth-lang'));
        paintModes();
        // Oldin bloklangan bo'lsa — blok oynasi darhol (server javobini kutmasdan)
        var cl = lsJSON('ba_lock', null);
        if (cl && cl.lock && !$('lock').classList.contains('on')) {
            state.appLocked = true;
            showLock(cl.lockTitle || L("Vaqtincha to'xtatildi", 'Временно приостановлено', 'Temporarily unavailable'), cl.lockMsg || '', '🛠', T('retry'), function () { loadStatus(); });
        }
        // Tezlik: oxirgi saqlangan holat bilan darhol ochiladi, server javobi orqa fonda keladi
        var cached = lsJSON('ba_status', null);
        if (cached && !state.status) {
            state.status = cached; state.models = cached.models || [];
            if (cached.notify && window.BilolNotify) window.BilolNotify.setConfig(cached.notify);
        }
        var quick = !(cl && cl.lock) && state.phone && state.pass && cached;
        if (quick) { enterMain(); setTimeout(function () { document.body.classList.add('ready'); }, 30); }
        state.starting = true;
        var st;
        try { st = await loadStatus(); } finally { state.starting = false; }
        ping();
        if (quick) { paintModel(); return; }
        if (st && st.lockAll) { if (state.phone && state.pass) liveBalance(++liveId); return; }
        if (state.phone && state.pass) enterMain();
        else {
            var dr = lsJSON('ba_auth_draft', null);
            if (dr && dr.t && Date.now() - dr.t < DRAFT_TTL) { show('auth'); restoreDraft(); }   // kod kutilayotgan bo'lsa — davom
            else show('landing');
        }
        setTimeout(function () { document.body.classList.add('ready'); }, 30);
    }
    // Serverda yangi dizayn yuklandi (Android qobig'i xabar beradi)
    window.__uiUpdated = function () {
        // Kirish ekranida foydalanuvchi hali hech narsa yozmagan bo'lsa — darhol; yozayotgan bo'lsa — keyingi ochilishda
        if (!state.inMain && !$('lock').classList.contains('on')) {
            if (!auth.waiting && !auth.busy && !$('a-phone').value && !$('a-pass').value) location.reload();
            return;
        }
        toast(L('✨ Yangi versiya tayyor — tepadan pastga tortib yangilang', '✨ Обновление готово — потяните вниз', '✨ Update ready — pull down to refresh'));
    };
    setInterval(function () { loadStatus(); }, 30000);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) loadStatus(); });
    start();
})();
