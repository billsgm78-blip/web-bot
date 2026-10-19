/* Bilols AI — admin panel uchun yuz skaneri (kamera, to'liq ekran, doira, "yaqinlashing / uzoqlashing").
   Brauzerning o'zida ishlaydi (face-api), serverga faqat 128 ta raqam (yuz "izi") yuboriladi, rasm emas.
   FaceScan.run({ mode: 'register' | 'login' }) → Promise<descriptors[]> */
(function () {
    var LIB = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.14/dist/face-api.js';
    var MODELS = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.14/model';
    var loading = null;

    function loadLib() {
        if (loading) return loading;
        loading = new Promise(function (res, rej) {
            if (window.faceapi) return res();
            var s = document.createElement('script');
            s.src = LIB; s.onload = function () { res(); }; s.onerror = function () { loading = null; rej(new Error("Kutubxona yuklanmadi")); };
            document.head.appendChild(s);
        }).then(async function () {
            var f = window.faceapi;
            // WebGL (tez) bo'lmasa — CPU
            try { await f.tf.setBackend('webgl'); await f.tf.ready(); } catch (e) {}
            if (f.tf.getBackend() !== 'webgl') { try { await f.tf.setBackend('cpu'); await f.tf.ready(); } catch (e) {} }
            return Promise.all([
                f.nets.tinyFaceDetector.loadFromUri(MODELS),
                f.nets.faceLandmark68Net.loadFromUri(MODELS),
                f.nets.faceRecognitionNet.loadFromUri(MODELS)
            ]);
        });
        return loading;
    }

    var css = document.createElement('style');
    css.textContent =
        '#fs-wrap{position:fixed;inset:0;z-index:2147483500;background:#000;display:none;color:#fff;font-family:Inter,system-ui,sans-serif;overflow:hidden}' +
        '#fs-wrap.open{display:block}' +
        '#fs-video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;transform:scaleX(-1)}' +
        '#fs-dim{position:absolute;inset:0;background:rgba(5,7,12,.78);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);' +
        '-webkit-mask:radial-gradient(circle at 50% var(--cy) , transparent var(--r), #000 calc(var(--r) + 1px));mask:radial-gradient(circle at 50% var(--cy), transparent var(--r), #000 calc(var(--r) + 1px))}' +
        '#fs-ring{position:absolute;left:50%;top:var(--cy);transform:translate(-50%,-50%)}' +
        '#fs-ring .trk{stroke:rgba(255,255,255,.18)}#fs-ring .prg{stroke:#22c55e;transition:stroke-dashoffset .35s ease;filter:drop-shadow(0 0 8px rgba(34,197,94,.8))}' +
        '#fs-ring.bad .prg{stroke:#ef4444;filter:drop-shadow(0 0 8px rgba(239,68,68,.8))}' +
        '#fs-ring .tick{stroke:rgba(255,255,255,.35)}#fs-ring .tick.on{stroke:#22c55e}' +
        '#fs-scan{position:absolute;left:50%;top:var(--cy);width:calc(var(--r) * 2);height:calc(var(--r) * 2);transform:translate(-50%,-50%);border-radius:50%;overflow:hidden;pointer-events:none}' +
        '#fs-scan::after{content:"";position:absolute;left:0;right:0;height:30%;background:linear-gradient(180deg,transparent,rgba(59,130,246,.35),transparent);animation:fsLine 1.8s ease-in-out infinite}' +
        '@keyframes fsLine{0%{top:-30%}100%{top:100%}}' +
        '#fs-title{position:absolute;left:0;right:0;top:calc(var(--cy) + var(--r) + 40px);text-align:center;font-size:28px;font-weight:800;padding:0 20px;text-shadow:0 2px 12px rgba(0,0,0,.6)}' +
        '#fs-hint{position:absolute;left:0;right:0;top:calc(var(--cy) + var(--r) + 84px);text-align:center;font-size:15px;color:#cbd5e1;padding:0 24px}' +
        '#fs-top{position:absolute;left:0;right:0;top:calc(14px + env(safe-area-inset-top));display:flex;align-items:center;justify-content:space-between;padding:0 16px}' +
        '#fs-top b{font-size:16px}#fs-x{width:44px;height:44px;border-radius:14px;border:1px solid rgba(255,255,255,.25);background:rgba(0,0,0,.35);color:#fff;font-size:22px;cursor:pointer}' +
        '#fs-steps{position:absolute;left:0;right:0;bottom:calc(30px + env(safe-area-inset-bottom));display:flex;justify-content:center;gap:8px}' +
        '#fs-steps i{width:34px;height:6px;border-radius:3px;background:rgba(255,255,255,.2)}#fs-steps i.on{background:#22c55e}#fs-steps i.cur{background:#3b82f6}' +
        '#fs-arrow{position:absolute;left:50%;top:calc(var(--cy) - var(--r) - 46px);transform:translate(-50%,-50%);font-size:44px;opacity:0;transition:opacity .2s;pointer-events:none;text-shadow:0 0 20px rgba(0,0,0,.6)}' +
        '#fs-arrow.show{opacity:.9;animation:fsPulse 1s ease-in-out infinite}@keyframes fsPulse{50%{transform:translate(-50%,-50%) scale(1.25)}}';
    document.head.appendChild(css);

    var wrap = null;
    function ui() {
        if (wrap) return wrap;
        wrap = document.createElement('div');
        wrap.id = 'fs-wrap';
        wrap.innerHTML = '<video id="fs-video" playsinline muted autoplay></video><div id="fs-dim"></div><div id="fs-scan"></div>' +
            '<svg id="fs-ring"></svg><div id="fs-arrow"></div>' +
            '<div id="fs-top"><button type="button" id="fs-x" aria-label="Yopish">×</button><b>🛡 Yuz skaneri</b><span style="width:44px"></span></div>' +
            '<div id="fs-title"></div><div id="fs-hint"></div><div id="fs-steps"></div>';
        document.body.appendChild(wrap);
        return wrap;
    }
    function layout() {
        var vw = window.innerWidth, vh = window.innerHeight;
        var r = Math.round(Math.min(vw * 0.38, vh * 0.25));
        var cy = Math.round(vh * 0.40);
        wrap.style.setProperty('--r', r + 'px');
        wrap.style.setProperty('--cy', cy + 'px');
        var size = r * 2 + 40, c = size / 2, R = r + 12, L = 2 * Math.PI * R;
        var ticks = '';
        for (var i = 0; i < 60; i++) {
            var a = i / 60 * Math.PI * 2, x1 = c + Math.cos(a) * (R + 6), y1 = c + Math.sin(a) * (R + 6), x2 = c + Math.cos(a) * (R + 14), y2 = c + Math.sin(a) * (R + 14);
            ticks += '<line class="tick" data-i="' + i + '" x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" stroke-width="3" stroke-linecap="round"/>';
        }
        var svg = document.getElementById('fs-ring');
        svg.setAttribute('width', size + 30); svg.setAttribute('height', size + 30);
        svg.setAttribute('viewBox', (-15) + ' ' + (-15) + ' ' + (size + 30) + ' ' + (size + 30));
        svg.innerHTML = ticks + '<circle class="trk" cx="' + c + '" cy="' + c + '" r="' + R + '" fill="none" stroke-width="5"/>' +
            '<circle class="prg" cx="' + c + '" cy="' + c + '" r="' + R + '" fill="none" stroke-width="6" stroke-linecap="round" stroke-dasharray="' + L + '" stroke-dashoffset="' + L + '" transform="rotate(-90 ' + c + ' ' + c + ')"/>';
        svg.dataset.len = L;
    }
    function setProgress(p, bad) {
        var svg = document.getElementById('fs-ring'), L = +svg.dataset.len;
        svg.querySelector('.prg').setAttribute('stroke-dashoffset', L * (1 - Math.max(0, Math.min(1, p))));
        svg.classList.toggle('bad', !!bad);
        var on = Math.round(p * 60);
        svg.querySelectorAll('.tick').forEach(function (t) { t.classList.toggle('on', +t.dataset.i < on); });
    }
    function say(title, hint, arrow) {
        document.getElementById('fs-title').textContent = title;
        document.getElementById('fs-hint').textContent = hint || '';
        var a = document.getElementById('fs-arrow');
        a.textContent = arrow || ''; a.classList.toggle('show', !!arrow);
    }
    function steps(n, cur) {
        var box = document.getElementById('fs-steps'); box.innerHTML = '';
        for (var i = 0; i < n; i++) { var e = document.createElement('i'); if (i < cur) e.className = 'on'; else if (i === cur) e.className = 'cur'; box.appendChild(e); }
    }
    function beep(ok) {
        try {
            var AC = window.AudioContext || window.webkitAudioContext; var ctx = beep.ctx || (beep.ctx = new AC());
            var o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime;
            o.frequency.setValueAtTime(ok ? 1200 : 300, t); o.type = 'sine';
            g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.15, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
            o.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t + 0.2);
        } catch (e) {}
        if (navigator.vibrate) try { navigator.vibrate(ok ? 30 : [40, 30, 40]); } catch (e) {}
    }

    function run(opts) {
        opts = opts || {};
        var mode = opts.mode === 'register' ? 'register' : 'login';
        ui(); layout(); wrap.classList.add('open'); setProgress(0); steps(5, 0);
        say('⏳ Tayyorlanmoqda...', "Birinchi marta biroz vaqt oladi");
        var video = document.getElementById('fs-video');
        var stream = null, stopped = false, timer = null;
        window.addEventListener('resize', layout);

        return new Promise(function (resolve, reject) {
            function finish(err, val) {
                if (stopped) return; stopped = true;
                clearTimeout(timer);
                window.removeEventListener('resize', layout);
                if (stream) stream.getTracks().forEach(function (t) { t.stop(); });
                setTimeout(function () { wrap.classList.remove('open'); }, err ? 0 : 650);
                err ? reject(err) : resolve(val);
            }
            document.getElementById('fs-x').onclick = function () { finish(new Error('cancel')); };

            Promise.all([
                loadLib(),
                navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 960 } }, audio: false })
            ]).then(function (r) {
                if (stopped) { r[1].getTracks().forEach(function (t) { t.stop(); }); return; }
                stream = r[1]; video.srcObject = stream;
                return video.play().then(loop);
            }).catch(function (e) {
                finish(new Error(e && e.name === 'NotAllowedError' ? 'Kameraga ruxsat berilmadi' : (e && e.message) || 'Kamera ochilmadi'));
            });

            timer = setTimeout(function () { finish(new Error('Vaqt tugadi — qaytadan urining')); }, 90000);

            var f = null, step = 0, base = 0, hold = 0, yawL = false, yawR = false, descs = [];
            var STEPS = [
                ['Yuzingizni doira ichiga joylang', "To'g'riga qarang, yorug' joyda turing", ''],
                ['Yaqinlashing', 'Telefonni yuzingizga yaqinroq olib keling', '⬆️'],
                ['Uzoqlashing', 'Endi telefonni biroz uzoqlashtiring', '⬇️'],
                ['Boshingizni sekin chapga va o\'ngga burang', '3D skanerlash — ikki tomonga ham', '↔️'],
                ["To'g'riga qarang", 'Oxirgi qadam', '']
            ];
            function nextStep() {
                step++; hold = 0; beep(true);
                steps(5, step); setProgress(step / 5);
                if (step >= STEPS.length) {
                    say('✅ Yuz skanerlandi', mode === 'register' ? 'Saqlanmoqda...' : 'Tekshirilmoqda...');
                    return finish(null, descs);
                }
                say.apply(null, STEPS[step]);
            }
            say.apply(null, STEPS[0]);

            async function capture(det) {
                try {
                    var full = await f.detectSingleFace(video, new f.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 })).withFaceLandmarks().withFaceDescriptor();
                    if (full && full.descriptor) descs.push(Array.from(full.descriptor).map(function (x) { return Math.round(x * 100000) / 100000; }));
                } catch (e) {}
            }

            async function loop() {
                f = window.faceapi;
                while (!stopped) {
                    var det = null;
                    try { det = await f.detectSingleFace(video, new f.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 })).withFaceLandmarks(); } catch (e) {}
                    if (stopped) break;
                    var vw = video.videoWidth || 1, vh = video.videoHeight || 1;
                    if (!det) { setProgress(step / 5, true); document.getElementById('fs-hint').textContent = '🙈 Yuz ko\'rinmayapti'; await sleep(120); continue; }
                    var b = det.detection.box, size = b.width / vw, cx = (b.x + b.width / 2) / vw, cy = (b.y + b.height / 2) / vh;
                    var lm = det.landmarks.positions, nose = lm[30], l = lm[36], r = lm[45];
                    var yaw = (nose.x - l.x) / Math.max(1, (r.x - l.x)) - 0.5;
                    var centered = Math.abs(cx - 0.5) < 0.17 && Math.abs(cy - 0.45) < 0.2;
                    setProgress(step / 5, !centered && step !== 3);
                    if (step === 0) {
                        if (centered && size > 0.18 && size < 0.7 && Math.abs(yaw) < 0.1) {
                            if (++hold >= 4) { base = size; await capture(); if (mode === 'register') await capture(); nextStep(); }
                        } else { hold = 0; document.getElementById('fs-hint').textContent = !centered ? 'Yuzingizni doiraning o\'rtasiga olib keling' : size <= 0.18 ? 'Yaqinroq keling' : size >= 0.7 ? 'Biroz uzoqlashing' : "To'g'riga qarang"; }
                    } else if (step === 1) {
                        if (size > base * 1.22) { if (mode === 'register') await capture(); nextStep(); }
                    } else if (step === 2) {
                        if (size < base * 0.88) { await capture(); nextStep(); }
                    } else if (step === 3) {
                        if (yaw < -0.13) yawL = true;
                        if (yaw > 0.13) yawR = true;
                        document.getElementById('fs-arrow').textContent = yawL && !yawR ? '➡️' : yawR && !yawL ? '⬅️' : '↔️';
                        if (yawL && yawR) nextStep();
                    } else if (step === 4) {
                        if (centered && Math.abs(yaw) < 0.08) { if (++hold >= 3) { await capture(); if (mode === 'register') await capture(); nextStep(); } } else hold = 0;
                    }
                    await sleep(80);
                }
            }
        });
    }
    function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

    window.FaceScan = { run: run, preload: function () { return loadLib().catch(function () {}); } };
})();
