/* Hamyon moduli: balans tugmasi (chap tepada), sovg'alar oynasi, pul tushganda musiqa.
   index.html ga faqat shu faylni ulash kifoya (pastda README). */
(function () {
  const API = (window.WALLET_API || '').replace(/\/$/, '');
  let initData = '', balance = null, gifts = [];

  const css = `
  .w-pill{display:flex;align-items:center;gap:6px;padding:6px 12px;border-radius:999px;border:1px solid var(--cyan,#45F0C4);background:rgba(69,240,196,.08);color:var(--cyan,#45F0C4);font:700 .82rem 'Manrope',sans-serif;cursor:pointer;white-space:nowrap}
  .w-pill.pulse{animation:wp 1s ease-in-out 3}
  @keyframes wp{50%{transform:scale(1.15);box-shadow:0 0 16px var(--cyan,#45F0C4)}}
  .w-ov{position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.6);display:none;align-items:flex-end}
  .w-ov.show{display:flex}
  .w-sheet{width:100%;max-width:760px;margin:0 auto;max-height:80%;overflow:auto;background:var(--bg-panel,#150C33);border-radius:22px 22px 0 0;padding:18px;color:var(--text,#F4F1FF);font-family:'Manrope',sans-serif}
  .w-sheet h2{font-family:'Sora',sans-serif;font-size:1.1rem;margin-bottom:4px}
  .w-sheet .w-bal{color:var(--muted,#A79EC9);font-size:.85rem;margin-bottom:14px}
  .w-item{display:flex;align-items:center;gap:12px;padding:12px;margin-bottom:8px;border-radius:14px;background:var(--bg-panel-2,#1C1140)}
  .w-item .ic{font-size:1.6rem}
  .w-item .tt{flex:1;font-weight:600;font-size:.92rem}
  .w-item .pr{color:var(--cyan,#45F0C4);font-size:.8rem;font-weight:700}
  .w-item button{border:none;border-radius:10px;padding:9px 14px;font-weight:700;color:#0B0620;cursor:pointer;background:linear-gradient(135deg,var(--cyan,#45F0C4),var(--violet,#9B6BFF))}
  .w-item button:disabled{opacity:.35;cursor:not-allowed}
  .w-toast{position:fixed;top:18px;left:50%;transform:translateX(-50%);z-index:10000;background:var(--bg-panel-2,#1C1140);border:1px solid var(--cyan,#45F0C4);color:var(--text,#F4F1FF);padding:10px 18px;border-radius:14px;font:600 .9rem 'Manrope',sans-serif;max-width:90%;text-align:center}`;
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  const fmt = n => n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'K' : String(n);
  const num = n => Number(n).toLocaleString('en-US');

  // ---------- Musiqa ----------
  const audio = new Audio('music.mp3'); audio.preload = 'auto';
  addEventListener('pointerdown', () => {   // brauzer ovozni faqat bosishdan keyin ruxsat beradi
    audio.muted = true;
    audio.play().then(() => { audio.pause(); audio.currentTime = 0; audio.muted = false; })
      .catch(() => { audio.muted = false; });
  }, { once: true });
  function beep() {                          // music.mp3 topilmasa oddiy "ding"
    try {
      const c = new (window.AudioContext || window.webkitAudioContext)();
      [660, 880, 1320].forEach((f, i) => {
        const o = c.createOscillator(), g = c.createGain(), t = c.currentTime + i * .15;
        o.frequency.value = f; o.connect(g); g.connect(c.destination);
        g.gain.setValueAtTime(.2, t); g.gain.exponentialRampToValueAtTime(.001, t + .3);
        o.start(t); o.stop(t + .3);
      });
    } catch (e) {}
  }
  function playSound() {
    audio.currentTime = 0;
    audio.play().then(() => setTimeout(() => audio.pause(), 12000)).catch(beep);
  }

  // ---------- UI ----------
  const pill = document.createElement('div'); pill.className = 'w-pill';
  pill.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><rect x="3" y="6" width="18" height="13" rx="3" stroke="currentColor" stroke-width="2"/><path d="M16 12.5h2M7 6l2-3h6l2 3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg><span>0 UZS</span>';
  const amt = pill.querySelector('span');
  const header = document.querySelector('header');
  header ? header.prepend(pill) : document.body.appendChild(pill);

  const ov = document.createElement('div'); ov.className = 'w-ov';
  ov.innerHTML = '<div class="w-sheet"><h2>🎁 Sovg\'alar</h2><div class="w-bal"></div><div class="w-list"></div></div>';
  document.body.appendChild(ov);
  const balEl = ov.querySelector('.w-bal'), listEl = ov.querySelector('.w-list');
  ov.addEventListener('click', e => { if (e.target === ov) ov.classList.remove('show'); });

  function toast(msg) {
    const t = document.createElement('div'); t.className = 'w-toast'; t.textContent = msg;
    document.body.appendChild(t); setTimeout(() => t.remove(), 3500);
  }

  function renderList() {
    balEl.textContent = 'Balansingiz: ' + num(balance || 0) + ' UZS';
    listEl.innerHTML = '';
    gifts.forEach(g => {
      const row = document.createElement('div'); row.className = 'w-item';
      const ic = document.createElement('div'); ic.className = 'ic'; ic.textContent = g.icon;
      const box = document.createElement('div'); box.className = 'tt'; box.textContent = g.title;
      const pr = document.createElement('div'); pr.className = 'pr'; pr.textContent = num(g.price) + ' UZS';
      box.appendChild(pr);
      const btn = document.createElement('button'); btn.textContent = 'Olish';
      btn.disabled = (balance || 0) < g.price;
      btn.onclick = () => redeem(g, btn);
      row.append(ic, box, btn); listEl.appendChild(row);
    });
  }

  pill.addEventListener('click', () => { renderList(); ov.classList.add('show'); });

  // ---------- Server bilan aloqa ----------
  async function api(path, body) {
    const r = await fetch(API + path, {
      method: 'POST', headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(Object.assign({ initData }, body || {})),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || 'Xatolik yuz berdi');
    return d;
  }

  function setBalance(n) {
    if (balance !== null && n > balance) {   // pul tushdi
      playSound(); toast('💰 +' + num(n - balance) + ' UZS');
      pill.classList.add('pulse'); setTimeout(() => pill.classList.remove('pulse'), 3000);
    }
    balance = n; amt.textContent = fmt(n) + ' UZS';
    if (ov.classList.contains('show')) renderList();
  }

  async function refresh() {
    try { const d = await api('/api/state'); gifts = d.gifts; setBalance(d.balance); } catch (e) {}
  }

  async function redeem(g, btn) {
    if (!confirm(g.title + ' — ' + num(g.price) + ' UZS. Tasdiqlaysizmi?')) return;
    btn.disabled = true;
    try {
      const d = await api('/api/redeem', { gift_id: g.id });
      setBalance(d.balance);
      ov.classList.remove('show');
      toast('✅ So\'rov yuborildi. Admin sovg\'ani tez orada yuboradi.');
    } catch (e) { toast('⚠️ ' + e.message); renderList(); }
  }

  function boot() {
    const tg = window.Telegram && window.Telegram.WebApp;
    initData = tg ? tg.initData : '';
    if (!initData || !API) { pill.style.display = 'none'; return; }  // Telegramdan tashqarida ko'rinmaydi
    refresh(); setInterval(refresh, 5000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
  }

  if (window.Telegram && window.Telegram.WebApp) boot();
  else {
    const s = document.createElement('script');
    s.src = 'https://telegram.org/js/telegram-web-app.js';
    s.onload = boot; s.onerror = boot; document.head.appendChild(s);
  }
})();
