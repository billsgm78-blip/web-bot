/* Bilols AI — xabarnomalar (toast): vaziyatga qarab rang, stiker va ovoz.
   Sozlamalar admin paneldan keladi (site-status → notify). Sayt va admin panel shu faylni ishlatadi. */
(function () {
    var DEF = {
        success: { c1: '#10b981', c2: '#059669', emoji: '🎉', sound: 'chime' },
        error: { c1: '#ef4444', c2: '#b91c1c', emoji: '😕', sound: 'error' },
        warning: { c1: '#f59e0b', c2: '#d97706', emoji: '⚠️', sound: 'beep' },
        info: { c1: '#3b82f6', c2: '#6366f1', emoji: '💬', sound: 'pop' },
        duration: 3, position: 'top', shake: true, sounds: true
    };
    var cfg = JSON.parse(JSON.stringify(DEF));

    function setConfig(c) {
        if (!c || typeof c !== 'object') return;
        ['success', 'error', 'warning', 'info'].forEach(function (t) {
            if (c[t] && typeof c[t] === 'object') for (var k in DEF[t]) if (c[t][k] != null && c[t][k] !== '') cfg[t][k] = c[t][k];
        });
        ['duration', 'position', 'shake', 'sounds'].forEach(function (k) { if (c[k] != null) cfg[k] = c[k]; });
    }

    // Matnga qarab turini aniqlash (uz / ru / en)
    var RX = {
        error: /❌|⛔|🚫|yetarli emas|yetmaydi|xato|xatolik|bo'lmadi|bo‘lmadi|yuborilmadi|noto'g'ri|rad etildi|bloklan|error|failed|not enough|insufficient|ошибк|недостаточно|не удалось|неверн/i,
        warning: /⚠️|🔒|⏳|tugadi|limit|vaqtincha|o'chirilgan|kuting|avval|kiriting|ended|disabled|please|закончил|временно|сначала|отключен/i,
        success: /✅|🎉|✓|muvaffaqiyat|tushdi|qo'shildi|olindi|saqlandi|yoqildi|nusxalandi|tozalandi|yuborildi|success|copied|saved|added|успешно|зачислен|скопирован|сохранен/i
    };
    function detect(text) {
        var s = String(text || '');
        if (RX.error.test(s)) return 'error';
        if (RX.warning.test(s)) return 'warning';
        if (RX.success.test(s)) return 'success';
        return 'info';
    }

    // ---------- ovozlar (fayl kerak emas, WebAudio) ----------
    var ctx = null;
    function vol() {
        try { var v = localStorage.getItem('bilol_ai_volume'); return v === 'low' ? 0.35 : v === 'mid' ? 0.65 : 1; } catch (e) { return 1; }
    }
    function userSoundOn() { try { return localStorage.getItem('bilol_ai_sound') !== 'false'; } catch (e) { return true; } }
    function tone(f, at, dur, type, gain, slide) {
        var t = ctx.currentTime + at;
        var o = ctx.createOscillator(), g = ctx.createGain();
        o.type = type || 'sine';
        o.frequency.setValueAtTime(f, t);
        if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
        var peak = Math.max(0.0002, gain * vol());
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(peak, t + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g); g.connect(ctx.destination);
        o.start(t); o.stop(t + dur + 0.05);
    }
    var SOUNDS = {
        none: function () {},
        chime: function () { tone(1047, 0, 0.22, 'sine', 0.22); tone(1568, 0.09, 0.35, 'sine', 0.2); },
        pop: function () { tone(620, 0, 0.12, 'sine', 0.25, 260); },
        coin: function () { tone(1319, 0, 0.09, 'square', 0.07); tone(1976, 0.08, 0.32, 'square', 0.07); },
        beep: function () { tone(880, 0, 0.16, 'triangle', 0.22); tone(880, 0.2, 0.16, 'triangle', 0.18); },
        error: function () { tone(330, 0, 0.16, 'sawtooth', 0.09, 300); tone(220, 0.17, 0.3, 'sawtooth', 0.1, 180); },
        bell: function () { tone(1568, 0, 0.9, 'sine', 0.18); tone(2349, 0.01, 0.6, 'sine', 0.08); tone(3136, 0.02, 0.4, 'sine', 0.04); }
    };
    function play(name, force) {
        if (!force && (!cfg.sounds || !userSoundOn())) return;
        try {
            var AC = window.AudioContext || window.webkitAudioContext;
            if (!AC) return;
            if (!ctx) ctx = new AC();
            if (ctx.state === 'suspended') ctx.resume();
            (SOUNDS[name] || SOUNDS.none)();
        } catch (e) {}
    }

    // ---------- ko'rinish ----------
    var css = document.createElement('style');
    css.textContent =
        '.bn-toast{position:fixed;left:50%;z-index:2147483600;display:flex;align-items:center;gap:12px;width:max-content;max-width:min(92vw,460px);box-sizing:border-box;padding:12px 20px 12px 14px;' +
        'border-radius:22px;color:#fff;font:700 14px/1.35 Outfit,Inter,system-ui,sans-serif;box-shadow:0 18px 44px rgba(0,0,0,.45);border:1px solid rgba(255,255,255,.3);' +
        'touch-action:none;user-select:none;cursor:grab;overflow:hidden;transition:transform .25s cubic-bezier(.175,.885,.32,1.275),opacity .25s ease}' +
        '.bn-toast.top{top:calc(18px + env(safe-area-inset-top));animation:bnIn .38s cubic-bezier(.18,.89,.32,1.28) both}' +
        '.bn-toast.bottom{bottom:calc(96px + env(safe-area-inset-bottom));animation:bnInB .38s cubic-bezier(.18,.89,.32,1.28) both}' +
        '.bn-toast .bn-st{font-size:26px;line-height:1;flex-shrink:0;display:inline-block;animation:bnSt 1.2s ease-in-out infinite}' +
        '.bn-toast.error.shake{animation:bnIn .3s ease both,bnShake .42s ease .25s both}' +
        '.bn-toast.bottom.error.shake{animation:bnInB .3s ease both,bnShake .42s ease .25s both}' +
        '.bn-toast::after{content:"";position:absolute;top:0;left:-80%;width:40%;height:100%;background:linear-gradient(90deg,transparent,rgba(255,255,255,.35),transparent);transform:skewX(-20deg);animation:bnShine 1.8s ease-in-out infinite;pointer-events:none}' +
        '.bn-toast .bn-bar{position:absolute;left:0;bottom:0;height:3px;background:rgba(255,255,255,.55);animation:bnBar linear forwards}' +
        '@keyframes bnIn{from{transform:translate(-50%,-30px) scale(.85);opacity:0}to{transform:translate(-50%,0) scale(1);opacity:1}}' +
        '@keyframes bnInB{from{transform:translate(-50%,30px) scale(.85);opacity:0}to{transform:translate(-50%,0) scale(1);opacity:1}}' +
        '@keyframes bnShake{0%,100%{transform:translate(-50%,0)}20%{transform:translate(calc(-50% - 10px),0)}40%{transform:translate(calc(-50% + 9px),0)}60%{transform:translate(calc(-50% - 6px),0)}80%{transform:translate(calc(-50% + 4px),0)}}' +
        '@keyframes bnSt{0%,100%{transform:scale(1) rotate(0)}50%{transform:scale(1.15) rotate(-8deg)}}' +
        '@keyframes bnShine{0%{left:-80%}60%,100%{left:130%}}' +
        '@keyframes bnBar{from{width:100%}to{width:0}}';
    (document.head || document.documentElement).appendChild(css);

    var LEAD = /^(?:[☀-➿️‍⃣]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|\uD83E[\uDD00-\uDFFF])+\s*/;
    function esc(s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

    function show(text, type, opts) {
        opts = opts || {};
        type = cfg[type] && typeof cfg[type] === 'object' ? type : detect(text);
        var c = cfg[type];
        var msg = String(text == null ? '' : text).replace(LEAD, '');
        document.querySelectorAll('.bn-toast').forEach(function (x) { x.remove(); });
        var el = document.createElement('div');
        var pos = cfg.position === 'bottom' ? 'bottom' : 'top';
        el.className = 'bn-toast ' + pos + ' ' + type + (type === 'error' && cfg.shake ? ' shake' : '');
        el.style.background = 'linear-gradient(135deg,' + c.c1 + ',' + c.c2 + ')';
        var dur = Math.max(1500, (+cfg.duration || 3) * 1000) + (type === 'error' ? 800 : 0);
        el.innerHTML = '<span class="bn-st">' + esc(c.emoji || '') + '</span><span>' + esc(msg) + '</span><i class="bn-bar" style="animation-duration:' + dur + 'ms"></i>';
        el.style.transform = 'translate(-50%,0)';
        document.body.appendChild(el);
        if (!opts.silent) play(c.sound);
        if (type === 'error' && navigator.vibrate) { try { navigator.vibrate([40, 40, 60]); } catch (e) {} }

        var timer = setTimeout(close, dur), sx = 0, sy = 0, drag = false;
        function close() {
            if (!el.parentNode) return;
            el.style.transition = 'all .45s ease';
            el.style.transform = 'translate(-50%,' + (pos === 'top' ? '-40px' : '40px') + ') scale(.85)';
            el.style.opacity = '0';
            setTimeout(function () { el.remove(); }, 380);
        }
        el.addEventListener('touchstart', function (e) { drag = true; clearTimeout(timer); sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
        el.addEventListener('touchmove', function (e) {
            if (!drag) return;
            var dx = e.touches[0].clientX - sx, dy = e.touches[0].clientY - sy;
            el.style.animation = 'none';
            el.style.transform = 'translate(calc(-50% + ' + dx + 'px),' + dy + 'px)';
            el.style.opacity = Math.max(0.1, 1 - (Math.abs(dx) + Math.abs(dy)) / 120);
            if ((pos === 'top' ? dy < -35 : dy > 35) || Math.abs(dx) > 60) { drag = false; close(); }
        }, { passive: true });
        el.addEventListener('touchend', function () { if (!drag) return; drag = false; el.style.transform = 'translate(-50%,0)'; el.style.opacity = '1'; timer = setTimeout(close, 1200); });
        el.addEventListener('click', close);
        return el;
    }

    window.BilolNotify = { show: show, play: play, detect: detect, setConfig: setConfig, config: function () { return cfg; }, defaults: DEF, sounds: Object.keys(SOUNDS) };
})();
