/* Bilols AI — Android ilova (alohida dizayn, o'sha server).
   Sayt bilan bir xil API: Railway (hisob, hamyon, do'kon, yordam) va bilolsai.uz (AI chat, rasm). */
(function () {
    'use strict';
    var RAIL = 'https://ai2-production-7d7e.up.railway.app';
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
        $('c-in').placeholder = L('Savolingizni yozing…', 'Напишите вопрос…', 'Ask anything…');
        $('sp-in').placeholder = L('Xabar yozing…', 'Напишите сообщение…', 'Write a message…');
        $('i-prompt').placeholder = L("Masalan: tog'lar orasida quyosh botishi, akvarel uslubida", 'Например: закат в горах, акварель', 'E.g. a sunset in the mountains, watercolor');
        $('a-name').placeholder = L('Masalan: Bilol', 'Например: Билол', 'e.g. Bilol');
        paintAuthBtn();
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
    function show(id) {
        ['splash', 'lock', 'auth', 'main'].forEach(function (s) { $(s).classList.toggle('on', s === id); });
    }

    /* ================= Sayt holati (blok, e'lon, modellar) ================= */
    async function loadStatus() {
        try { state.status = await getJSON(RAIL + '/api/site-status'); } catch (e) { return state.status; }
        var st = state.status || {};
        state.models = st.models || [];
        var app = st.app || { lock: !!st.lockAll, lockTitle: st.lockTitle, lockMsg: st.lockMsg };
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
        if ($('lock').classList.contains('on')) start();
        paintAnn();
        if (state.inMain) paintModel();
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
        var day = new Date().toDateString();
        if (ls('ba_ping') === day) return;
        var dev = ls('ba_dev');
        if (!dev) { dev = 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10); ls('ba_dev', dev); }
        fetch(RAIL + '/api/app/ping', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ device: dev, ver: appVer() }) })
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
    function resetOtp() { auth.waiting = false; $('f-code').hidden = true; $('a-code').value = ''; paintAuthBtn(); }
    document.querySelectorAll('#auth-seg button').forEach(function (b) {
        b.onclick = function () {
            auth.mode = b.getAttribute('data-mode');
            document.querySelectorAll('#auth-seg button').forEach(function (x) { x.classList.toggle('on', x === b); });
            $('f-name').hidden = auth.mode !== 'register';
            $('a-forgot').hidden = auth.mode !== 'login';
            $('a-pass').autocomplete = auth.mode === 'login' ? 'current-password' : 'new-password';
            resetOtp(); authMsg('');
        };
    });
    $('a-phone').addEventListener('input', resetOtp);
    $('a-eye').onclick = function () { var p = $('a-pass'); p.type = p.type === 'password' ? 'text' : 'password'; };
    function needBot(url) {
        authMsg(L("Avval Telegram botimizga kiring va «Start» bosing, keyin qaytib kod oling.", 'Сначала откройте наш Telegram-бот и нажмите «Start», затем вернитесь за кодом.', 'Open our Telegram bot and press "Start" first, then come back for the code.'), 'err');
        if (url) ask(L('Telegram bot', 'Telegram-бот', 'Telegram bot'), L("Kod Telegram bot orqali keladi. Botni ochib «Start» bosing.", 'Код приходит через Telegram-бот. Откройте бот и нажмите «Start».', 'The code comes via the Telegram bot. Open it and press "Start".'),
            L('Botni ochish', 'Открыть бот', 'Open bot')).then(function (ok) { if (ok) openExternal(url); });
    }
    $('a-go').onclick = async function () {
        var btn = this;
        var phone = normPhone($('a-phone').value), pass = $('a-pass').value.trim(), name = $('a-name').value.trim();
        if (phone.length !== 12) { authMsg(L("Telefon raqamni to'liq kiriting", 'Введите номер полностью', 'Enter the full phone number'), 'err'); return; }
        if (!pass || pass.length < 4) { authMsg(L("Parol kamida 4 belgi bo'lsin", 'Пароль — минимум 4 символа', 'Password must be at least 4 characters'), 'err'); return; }
        if (auth.mode === 'register' && !name) { authMsg(L('Ismingizni yozing', 'Укажите имя', 'Enter your name'), 'err'); return; }
        var feat = auth.mode === 'register' ? feature('auth') : '';
        if (feat) { authMsg(feat, 'err'); return; }
        btn.disabled = true;
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
                auth.waiting = true;
                $('f-code').hidden = false;
                paintAuthBtn();
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
            if (!r2.ok || !d.success) { authMsg(d.error || L("Kod noto'g'ri", 'Неверный код', 'Wrong code'), 'err'); return; }
            state.phone = phone; state.pass = pass; state.name = d.name || name || '';
            ls('ba_phone', phone); ls('ba_pass', pass); ls('ba_name', state.name);
            if (d.balance != null) state.balance = Number(d.balance);
            resetOtp(); authMsg('');
            enterMain();
            toast(L('Xush kelibsiz! 👋', 'Добро пожаловать! 👋', 'Welcome! 👋'), 'ok');
        } catch (e) {
            authMsg(L("Server bilan aloqa yo'q. Internetni tekshiring.", 'Нет связи с сервером. Проверьте интернет.', 'No connection. Check your internet.'), 'err');
        } finally { btn.disabled = false; }
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

    function sessionExpired() {
        logout(true);
        toast(L("Parol o'zgargan yoki sessiya tugagan. Qaytadan kiring.", 'Пароль изменён или сессия истекла. Войдите снова.', 'Password changed or session expired. Please log in again.'), 'warn', 4500);
    }
    function logout(silent) {
        ['ba_phone', 'ba_pass', 'ba_name', 'ba_chat'].forEach(function (k) { ls(k, null); });
        state.phone = state.pass = state.name = ''; state.balance = null; state.rewards = null; state.inMain = false;
        closeSupport(); closeSheet(false);
        show('auth');
        if (!silent) toast(L('Hisobdan chiqdingiz', 'Вы вышли из аккаунта', 'Logged out'));
    }

    /* ================= Asosiy ekran ================= */
    var TITLES = { chat: ['Bilols AI', 'Bilols AI', 'Bilols AI'], image: ['Rasm yaratish', 'Изображения', 'Images'], shop: ["Do'kon", 'Магазин', 'Shop'], wallet: ['Hamyon', 'Кошелёк', 'Wallet'] };
    function paintTitle() { var t = TITLES[state.tab]; $('tb-title').textContent = L(t[0], t[1], t[2]); }
    function enterMain() {
        state.inMain = true;
        show('main');
        $('tb-ini').textContent = (state.name || 'B').trim().charAt(0).toUpperCase() || 'B';
        paintBalance();
        applyI18n();
        switchTab('chat');
        loadRewards();
        loadHistory();
        peekSupport();
    }
    function switchTab(t) {
        state.tab = t;
        document.querySelectorAll('#bnav button').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-tab') === t); });
        document.querySelectorAll('.tab').forEach(function (x) { x.classList.toggle('on', x.id === 'tab-' + t); });
        paintTitle();
        hideKeyboard();
        if (t === 'shop' && !state.shop) loadShop();
        if (t === 'wallet') loadHistory();
        if (t === 'image') paintGallery();
    }
    document.querySelectorAll('#bnav button').forEach(function (b) { b.onclick = function () { switchTab(b.getAttribute('data-tab')); }; });
    $('tb-bal').onclick = function () { switchTab('wallet'); };

    function setBalance(v) { if (v == null || isNaN(Number(v))) return; state.balance = Number(v); paintBalance(); }
    function paintBalance() {
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
    var chat = { msgs: lsJSON('ba_chat', []), busy: false, img: null, mode: ls('ba_mode') || '', model: ls('ba_model') || '' };
    if (!MODES.some(function (m) { return m[0] === chat.mode; })) chat.mode = '';
    function saveChat() {
        var keep = chat.msgs.slice(-60).map(function (m) { return { r: m.r, t: m.t, img: m.img || undefined }; });
        try { ls('ba_chat', JSON.stringify(keep)); } catch (e) { keep.forEach(function (m) { delete m.img; }); ls('ba_chat', JSON.stringify(keep)); }
    }
    function paintModes() {
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
    function paintModel() { var m = curModel(); $('c-model-t').textContent = (m.emoji || '🤖') + ' ' + m.name; }
    $('c-model').onclick = function () {
        var ms = state.models || [];
        if (!ms.length) { loadStatus().then(function () { if ((state.models || []).length) $('c-model').click(); }); return; }
        var cur = curModel().id;
        openSheet('<div class="sh-title">' + esc(L('AI model', 'AI-модель', 'AI model')) + '</div><p class="sh-sub">' +
            esc(L("Bepul model — kunlik limit bilan. Pullik modellarda har bir xabar balansdan yechiladi.", 'Бесплатная — с дневным лимитом. В платных каждое сообщение списывается с баланса.', 'Free model has a daily limit. Paid models charge per message.')) + '</p><div class="sh-list" id="ml"></div>',
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
                    if (m.price > 0) { tag.textContent = money(m.price) + ' ' + T('sum'); tag.classList.add('paid'); } else tag.textContent = L('Bepul', 'Бесплатно', 'Free');
                    o.onclick = function () { chat.model = m.id; ls('ba_model', m.id); paintModel(); closeSheet(true); };
                    list.appendChild(o);
                });
            });
    };
    $('c-new').onclick = async function () {
        if (!chat.msgs.length) return;
        if (await ask(L('Yangi suhbat', 'Новый чат', 'New chat'), L("Joriy suhbat o'chiriladi.", 'Текущий чат будет удалён.', 'The current chat will be cleared.'), L('Boshlash', 'Начать', 'Start'))) {
            chat.msgs = []; saveChat(); renderChat();
        }
    };

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
    function renderChat() {
        var box = $('c-msgs');
        box.innerHTML = '';
        if (!chat.msgs.length) {
            var e = document.createElement('div');
            e.className = 'empty-chat';
            e.innerHTML = '<div class="ec-ico">⚡</div><b></b><span></span><div class="sugg"></div>';
            e.querySelector('b').textContent = L('Salom', 'Привет', 'Hi') + (state.name ? ', ' + state.name.split(' ')[0] : '') + '!';
            e.querySelector('span').textContent = L("Savol bering, rasm yuboring yoki rejim tanlang.", 'Спросите что угодно, отправьте фото или выберите режим.', 'Ask anything, send a photo or pick a mode.');
            var sg = e.querySelector('.sugg');
            SUGG.forEach(function (s) {
                var b = document.createElement('button');
                b.innerHTML = '<em></em>';
                b.querySelector('em').textContent = s[0];
                b.appendChild(document.createTextNode(L(s[1], s[2], s[3])));
                b.onclick = function () { $('c-in').value = L(s[1], s[2], s[3]) + ': '; $('c-in').focus(); autoGrow($('c-in')); };
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
        openSheet('<div class="sh-title">' + esc(L('Rasm yuborish', 'Отправить фото', 'Send a photo')) + '</div><div class="menu">' +
            '<button data-k="cam"><span class="m-ico">📷</span>' + esc(L('Kamera', 'Камера', 'Camera')) + '</button>' +
            '<button data-k="gal"><span class="m-ico">🖼</span>' + esc(L('Galereya', 'Галерея', 'Gallery')) + '</button></div>',
            function (b) {
                b.querySelectorAll('[data-k]').forEach(function (x) {
                    x.onclick = function () { closeSheet(true); var inp = $(x.getAttribute('data-k') === 'cam' ? 'file-cam' : 'file-img'); inp.value = ''; inp.click(); };
                });
            });
    }
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
        var recent = chat.msgs.filter(function (m) { return !m.err; }).slice(-12);
        return recent.map(function (m, i) {
            var parts = [];
            var isLast = i === recent.length - 1;
            if (isLast && m.r === 'u' && chat._sendImg) parts.push({ inline_data: { mime_type: 'image/jpeg', data: chat._sendImg.split(',')[1] } });
            if (m.t) parts.push({ text: m.t });
            else if (m.img) parts.push({ text: L('[Rasm]', '[Фото]', '[Image]') });
            return { role: m.r === 'u' ? 'user' : 'model', parts: parts };
        }).filter(function (h) { return h.parts.length; });
    }
    function chatCTA(b, kind) {
        var btn = document.createElement('button');
        btn.className = 'btn primary b-cta';
        if (kind === 'money') { btn.textContent = '💳 ' + L("Hisobni to'ldirish", 'Пополнить баланс', 'Top up balance'); btn.onclick = function () { switchTab('wallet'); openTopup(); }; }
        else if (kind === 'limit') { btn.textContent = '♾️ ' + L('Cheksiz obuna', 'Безлимит', 'Unlimited plan'); btn.onclick = function () { switchTab('shop'); }; }
        else if (kind === 'free') { btn.textContent = '⚡ ' + L("Bepul modelga o'tish", 'Перейти на бесплатную', 'Switch to free model'); btn.onclick = function () { var f = (state.models || []).filter(function (m) { return !m.price; })[0]; if (f) { chat.model = f.id; ls('ba_model', f.id); paintModel(); toast(f.name, 'ok'); } }; }
        b.appendChild(btn);
    }
    async function sendChat() {
        if (chat.busy) return;
        var ta = $('c-in');
        var text = ta.value.trim();
        if (!text && !chat.img) return;
        var off = feature('chat'); if (off) { toast(off, 'warn'); return; }
        var m = { r: 'u', t: text };
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
                    if (aiB && now - last > 80) { last = now; var tx = aiB.querySelector('.tx'); tx.innerHTML = md(reply); tx.classList.add('caret'); scrollChat(); }
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
        var p = state.rewards && state.rewards.imagePrice;
        $('i-price').textContent = p ? L('Narxi: ', 'Цена: ', 'Price: ') + money(p) + ' ' + T('sum') + L(' · 10–30 soniya', ' · 10–30 сек', ' · 10–30 s') : L('10–30 soniyada tayyor', 'Готово за 10–30 сек', 'Ready in 10–30 s');
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
                var eb = bubble({ r: 'a', err: true, t: '⚠️ ' + (j.noMoney ? L('Balans yetarli emas. Rasm narxi: ', 'Недостаточно средств. Цена: ', 'Not enough balance. Price: ') + money(j.price) + ' ' + T('sum') : (j.error || L("Rasm yaratib bo'lmadi", 'Не удалось создать изображение', 'Could not create the image'))) });
                eb.style.maxWidth = '100%';
                if (j.noMoney) chatCTA(eb, 'money');
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
        else if (state.tab === 'shop') st.innerHTML = '<div class="h-empty" style="grid-column:1/-1">…</div>';
        var r = state.rewards, sub = $('s-sub');
        if (!r) { sub.hidden = true; return; }
        sub.hidden = false;
        var active = r.subUntil && r.subUntil * 1000 > Date.now();
        sub.innerHTML = '<b></b><p></p><button class="btn primary"></button>';
        sub.querySelector('b').textContent = '♾️ ' + L('Cheksiz chat', 'Безлимитный чат', 'Unlimited chat');
        sub.querySelector('p').textContent = active
            ? L('Faol: ', 'Активно до: ', 'Active until: ') + new Date(r.subUntil * 1000).toLocaleDateString()
            : L('Bepul modelda kunlik limit: ', 'Дневной лимит бесплатной модели: ', 'Free model daily limit: ') + (r.freeLimit || '—') + L(' ta xabar. Obuna bilan — cheksiz.', ' сообщений. С подпиской — без лимита.', ' messages. Unlimited with a plan.');
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
        if (!await ask(L('Cheksiz chat', 'Безлимитный чат', 'Unlimited chat'), money(r.subPrice) + ' ' + T('sum') + ' / ' + r.subDays + L(' kun', ' дн.', ' days'), L('Olish', 'Оформить', 'Get'))) return;
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

    /* ================= PROFIL ================= */
    $('tb-me').onclick = function () {
        var r = state.rewards || {};
        openSheet('<div class="me-head"><div class="me-ava"></div><div><b></b><small></small></div></div><div class="menu">' +
            '<button data-k="sup"><span class="m-ico">💬</span>' + esc(L('Yordam — admin bilan chat', 'Поддержка — чат с админом', 'Support — chat with admin')) + '<span class="m-badge" id="m-unread" hidden></span></button>' +
            '<button data-k="lang"><span class="m-ico">🌍</span>' + esc(L('Til', 'Язык', 'Language')) + '<span class="m-r">' + ({ uz: "O'zbekcha", ru: 'Русский', en: 'English' })[lang] + '</span></button>' +
            '<button data-k="pass"><span class="m-ico">🔑</span>' + esc(L("Parolni o'zgartirish", 'Сменить пароль', 'Change password')) + '</button>' +
            '<button data-k="bot"><span class="m-ico">✈️</span>' + esc(L('Telegram botni ochish', 'Открыть Telegram-бот', 'Open Telegram bot')) + '</button>' +
            '<button data-k="site"><span class="m-ico">🌐</span>bilolsai.uz</button>' +
            '<button data-k="out" class="red"><span class="m-ico">⏻</span>' + esc(L('Chiqish', 'Выйти', 'Log out')) + '</button></div>' +
            '<p class="sh-sub" style="text-align:center;margin-top:8px">Bilols AI · v' + VERSION + '</p>',
            function (b) {
                b.querySelector('.me-ava').textContent = (state.name || 'B').charAt(0).toUpperCase();
                b.querySelector('.me-head b').textContent = state.name || 'Bilols AI';
                b.querySelector('.me-head small').textContent = '+' + state.phone + (r.publicId ? ' · 🆔 ' + r.publicId : '');
                if (sp.unread) { var u = b.querySelector('#m-unread'); u.textContent = sp.unread; u.hidden = false; }
                b.querySelectorAll('[data-k]').forEach(function (x) {
                    x.onclick = function () {
                        var k = x.getAttribute('data-k');
                        if (k === 'sup') { closeSheet(true); openSupport(); }
                        else if (k === 'lang') { langSheet(); }
                        else if (k === 'pass') { passSheet(); }
                        else if (k === 'bot') { closeSheet(true); openExternal((r.botRefUrl || '').split('?')[0] || 'https://t.me/'); }
                        else if (k === 'site') { closeSheet(true); openExternal('https://bilolsai.uz'); }
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
            meta.textContent = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + (m.sender === 'user' ? (m.read ? ' ✓✓' : ' ✓') : '');
            b.appendChild(meta); box.appendChild(b);
        });
        box.scrollTop = box.scrollHeight;
    }
    async function supportLoad(waitVer) {
        var j = await api('/api/support/list', waitVer == null ? null : { ver: waitVer });
        if (!j.success) return false;
        sp.ver = j.ver; sp.msgs = j.messages || []; presence(j.admin);
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
        var btn = this; btn.disabled = true;
        try {
            var j = await api('/api/support/send', sp.img ? { text: text, image: sp.img } : { text: text });
            if (!j.success) { toast(j.error || 'Error', 'err'); return; }
            ta.value = ''; autoGrow(ta); sp.img = null; $('sp-att').hidden = true;
            if (j.message) { sp.msgs.push(Object.assign({ read: false }, j.message)); renderSupport(); }
            presence(j.admin);
        } catch (e) { netErr(); }
        finally { btn.disabled = false; }
    };
    function paintUnread() { $('tb-me').classList.toggle('dot', sp.unread > 0); }
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
        if (sp.open) { closeSupport(); return true; }
        if (state.inMain && state.tab !== 'chat') { switchTab('chat'); return true; }
        return false;
    };
    window.addEventListener('keydown', function (e) { if (e.key === 'Escape') window.__back(); });

    /* ================= Ishga tushirish ================= */
    async function start() {
        applyI18n();
        paintLangRow($('auth-lang'));
        paintModes();
        var st = await loadStatus();
        ping();
        if (st && st.lockAll) return;
        if (state.phone && state.pass) enterMain(); else show('auth');
    }
    setInterval(function () { loadStatus(); }, 60000);
    start();
})();
