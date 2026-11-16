// ---------- BILOLS AI HISOBI BILAN KIRISH ----------
// coconut.bilolsai.uz -> bilolsai.uz/?gauth=ID (u yerda Google bilan kiriladi) -> bu sahifa sessiyani oladi.
// Hisobiga email ulanmagan foydalanuvchiga bilolsai.uz o'zi "emailni ulang" deb aytadi.
window.COCO_AUTH = (function () {
  const AK = 'coconut-auth';
  let user = null;
  try { user = JSON.parse(localStorage.getItem(AK) || 'null'); } catch (e) {}
  if (!user || !user.phone || !user.token) user = null;
  const api = (path, data) => fetch('/api/bl?p=' + encodeURIComponent(path), {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data || {})
  }).then(r => r.json().catch(() => ({ success: false })).then(j => (j._http = r.status, j)));
  const $ = id => document.getElementById(id);
  const status = (msg, kind) => { const e = $('astatus'); e.className = 'astatus' + (kind ? ' ' + kind : ''); e.textContent = msg || ''; };
  function logout() {
    const u = user; user = null; localStorage.removeItem(AK);
    if (u) api('session/logout', { phone: u.phone, password: u.token }).catch(() => {});
    location.reload();
  }
  let run = 0;
  async function login() {
    const btn = $('gLogin'), my = ++run;
    // oynani darhol (bosish paytida) ochamiz, aks holda brauzer popupni bloklaydi
    let w = null; try { w = window.open('about:blank', '_blank'); } catch (e) {}
    btn.disabled = true; status("Bilols AI bilan bog'lanilmoqda…");
    let q;
    try { q = await api('qr/new', { ua: navigator.userAgent, kind: 'google' }); } catch (e) { q = {}; }
    if (!q.success) { if (w) w.close(); btn.disabled = false; status(q.error || "Server bilan bog'lanib bo'lmadi. Qaytadan urining.", 'err'); return; }
    const url = 'https://www.bilolsai.uz/?gauth=' + encodeURIComponent(q.id);
    if (w) w.location.href = url; else location.href = url;  // popup bloklansa — shu oynada
    btn.disabled = false; $('gLoginT').textContent = 'Qaytadan ochish';
    status("Ochilgan bilolsai.uz oynasida «Google bilan davom etish» ni bosing va hisobingizni tanlang. Keyin shu yerga qayting — o'zi kiradi.", 'ok');
    let ver = 0; const until = Date.now() + (q.ttl || 600) * 1000;
    while (my === run && Date.now() < until) {
      let p = null;
      try { p = await api('qr/poll', { id: q.id, secret: q.secret, ver }); } catch (e) {}
      if (my !== run) return;
      if (!p || !p.success) { await new Promise(r => setTimeout(r, 2500)); continue; }
      if (typeof p.ver === 'number') ver = p.ver;
      if (p.status === 'ok' && p.login) {
        localStorage.setItem(AK, JSON.stringify({ phone: String(p.login.phone || '').replace(/\D/g, ''), token: p.login.password, name: p.login.name || '' }));
        status('✅ Kirdingiz! O\'yin ochilmoqda…', 'ok');
        try { if (w && !w.closed) w.close(); } catch (e) {}
        location.reload(); return;
      }
      if (p.status === 'expired' || p.status === 'denied') break;
    }
    if (my === run) { $('gLoginT').textContent = 'Google bilan kirish'; status('Kirish vaqti tugadi. «Google bilan kirish» ni qaytadan bosing.', 'err'); }
  }
  function init() {
    $('gLogin').onclick = login;
    $('logoutBtn').onclick = () => { if (confirm('Hisobdan chiqasizmi?')) logout(); };
    const hide = () => document.body.classList.remove('show-login');
    $('aClose').onclick = hide; $('aGuest').onclick = hide;
    $('loginBtn').onclick = () => document.body.classList.add('show-login');
    if (!user) return;
    $('loginBtn').style.display = 'none';
    $('achip').style.display = 'flex';
    $('aname').textContent = '👤 ' + (user.name || ('+' + user.phone));
    // sessiya hali amal qiladimi (parol o'zgargan / boshqa joyda "chiqish" bosilgan bo'lsa — qayta kirish)
    api('auth-check', { phone: user.phone, password: user.token }).then(j => {
      if (!j.success && (j._http === 401 || j._http === 403)) {
        localStorage.removeItem(AK); alert('Bilols AI sessiyasi tugagan — qaytadan kiring.'); location.reload();
      }
    }).catch(() => {});
  }
  init();
  return { user, saveKey: user ? 'coconut-sim-v1:' + user.phone : 'coconut-sim-v1' };
})();

(() => {
'use strict';

// ---------- DATA ----------
const WORKERS = [
  { id:'monkey',   em:'🐒', name:'Maymun',          desc:'Palmadan kokos tushiradi', base:15,        cps:0.1 },
  { id:'kid',      em:'🧒', name:'Bola',            desc:'Plyajdan kokos teradi',    base:100,       cps:1 },
  { id:'farmer',   em:'👨‍🌾', name:'Fermer',          desc:'Kokos palmalarini ekadi',  base:1100,      cps:8 },
  { id:'boat',     em:'⛵', name:'Qayiq',           desc:'Orollardan kokos olib keladi', base:12000, cps:47 },
  { id:'factory',  em:'🏭', name:'Zavod',           desc:'Kokos suti ishlab chiqaradi', base:130000, cps:260 },
  { id:'island',   em:'🏝️', name:'Orol',            desc:'Butun kokos oroli!',       base:1.4e6,     cps:1400 },
  { id:'rocket',   em:'🚀', name:'Raketa',          desc:'Koinotdan kokos keltiradi', base:2e7,      cps:7800 },
  { id:'planet',   em:'🪐', name:'Kokos sayyorasi', desc:'Butun sayyora kokos',      base:3.3e8,     cps:44000 },
  { id:'portal',   em:'🌀', name:'Portal',          desc:'Boshqa olamdan kokos',     base:5.1e9,     cps:260000 },
  { id:'god',      em:'👑', name:'Kokos Xudosi',    desc:'Kokoslar hukmdori',        base:7.5e10,    cps:1.6e6 },
];

const UPGRADES = [
  { id:'c1', em:'👆', name:'Kuchli barmoq',   desc:'Bosish x2',           cost:100,     type:'click', mult:2 },
  { id:'c2', em:'🥊', name:'Boks qo\'lqopi',  desc:'Bosish x2',           cost:1000,    type:'click', mult:2 },
  { id:'c3', em:'🔨', name:'Bolg\'a',         desc:'Bosish x3',           cost:15000,   type:'click', mult:3 },
  { id:'c4', em:'⚒️', name:'Oltin bolg\'a',   desc:'Bosish x5',           cost:250000,  type:'click', mult:5 },
  { id:'c5', em:'⚡', name:'Chaqmoq qo\'l',   desc:'Bosish x10',          cost:5e6,     type:'click', mult:10 },
  { id:'cp', em:'🖐️', name:'Aqlli bosish',    desc:'Bosish +1% sekundlik daromad', cost:50000, type:'clickcps', val:0.01 },
  { id:'cp2',em:'🧠', name:'Daho bosish',     desc:'Bosish +4% sekundlik daromad', cost:5e6,   type:'clickcps', val:0.04 },
  { id:'cr1',em:'🎯', name:'Omadli zarba',    desc:'5% kritik zarba (x10)', cost:5000,  type:'crit', val:0.05 },
  { id:'cr2',em:'🍀', name:'Beda',            desc:'+10% kritik imkoniyat', cost:500000, type:'crit', val:0.10 },
  { id:'g1', em:'✨', name:'Oltin kokos',     desc:'Oltin kokoslar tez-tez chiqadi', cost:20000, type:'golden', val:0.5 },
  { id:'w1', em:'🍌', name:'Banan',           desc:'Maymunlar x3',        cost:500,     type:'worker', w:'monkey', mult:3 },
  { id:'w2', em:'🧃', name:'Sharbat',         desc:'Bolalar x3',          cost:5000,    type:'worker', w:'kid', mult:3 },
  { id:'w3', em:'🚜', name:'Traktor',         desc:'Fermerlar x3',        cost:55000,   type:'worker', w:'farmer', mult:3 },
  { id:'w4', em:'🛥️', name:'Motor',           desc:'Qayiqlar x3',         cost:600000,  type:'worker', w:'boat', mult:3 },
  { id:'w5', em:'🤖', name:'Robotlar',        desc:'Zavodlar x3',         cost:6.5e6,   type:'worker', w:'factory', mult:3 },
  { id:'w6', em:'🌋', name:'Vulqon',          desc:'Orollar x3',          cost:7e7,     type:'worker', w:'island', mult:3 },
  { id:'w7', em:'☢️', name:'Yadro dvigatel',  desc:'Raketalar x3',        cost:1e9,     type:'worker', w:'rocket', mult:3 },
  { id:'w8', em:'🌌', name:'Galaktika',       desc:'Sayyoralar x3',       cost:1.6e10,  type:'worker', w:'planet', mult:3 },
  { id:'a1', em:'🌴', name:'Palma o\'rmoni',  desc:'Hamma daromad x1.5',  cost:1e5,     type:'all', mult:1.5 },
  { id:'a2', em:'🌞', name:'Tropik quyosh',   desc:'Hamma daromad x2',    cost:1e7,     type:'all', mult:2 },
  { id:'a3', em:'🌈', name:'Kamalak',         desc:'Hamma daromad x3',    cost:1e9,     type:'all', mult:3 },
];

const SKINS = [
  { id:'coco',   em:'🥥', name:'Klassik kokos',  desc:'Trubochka va soyabon',            cost:0,     bonus:0,    col:['#b5733f','#5a3017'] },
  { id:'sport',  em:'🧢', name:'Sportchi',       desc:'Kepka + hushtak · +10% bosish',  cost:1000,  bonus:0.10, col:['#4fd1c5','#1c6e8c'] },
  { id:'cowboy', em:'🤠', name:'Kovboy',         desc:'Shlyapa + ro\'mol · +25% bosish', cost:5e4,   bonus:0.25, col:['#f0b36b','#a0592a'] },
  { id:'pirate', em:'🏴‍☠️', name:'Pirat',          desc:'Uchburchak shlyapa + ko\'z bog\'ich · +50% bosish', cost:2e6, bonus:0.50, col:['#a78bfa','#4c1d95'] },
  { id:'hero',   em:'🦸', name:'Superqahramon',  desc:'Niqob + plash · +100% bosish',   cost:1e8,   bonus:1.00, col:['#ff7a9a','#c0264f'] },
  { id:'king',   em:'👑', name:'Oltin Qirol',    desc:'Olmosli toj, qirollik plashi, oltin zanjir · +200% bosish', cost:1e10, bonus:2.00, col:['#ffe680','#c98a00'] },
];

const ACHIEVEMENTS = [
  { id:'cl1',  em:'👆', name:'Birinchi bosish', test:s=>s.clicks>=1 },
  { id:'cl2',  em:'🖱️', name:'100 bosish',      test:s=>s.clicks>=100 },
  { id:'cl3',  em:'💪', name:'1 000 bosish',    test:s=>s.clicks>=1000 },
  { id:'cl4',  em:'🦾', name:'10 000 bosish',   test:s=>s.clicks>=10000 },
  { id:'e1',   em:'🪙', name:'1 000 coin',      test:s=>s.total>=1e3 },
  { id:'e2',   em:'💰', name:'1 million coin',  test:s=>s.total>=1e6 },
  { id:'e3',   em:'🏦', name:'1 milliard coin', test:s=>s.total>=1e9 },
  { id:'e4',   em:'🤑', name:'1 trillion coin', test:s=>s.total>=1e12 },
  { id:'w10',  em:'🐒', name:'10 ta maymun',    test:s=>(s.workers.monkey||0)>=10 },
  { id:'wall', em:'🏗️', name:'Hamma ishchilar', test:s=>WORKERS.every(w=>(s.workers[w.id]||0)>0) },
  { id:'gold', em:'✨', name:'Oltin kokos ushla', test:s=>s.goldenCaught>=1 },
  { id:'sk',   em:'🎨', name:'Hamma skinlar',   test:s=>SKINS.every(k=>s.skins.includes(k.id)) },
  { id:'pr',   em:'💎', name:'Birinchi prestij', test:s=>s.prestiges>=1 },
  { id:'ty1',  em:'⌨️', name:'Birinchi so\'z yozildi', test:s=>(s.typed||0)>=1 },
  { id:'ty2',  em:'📚', name:'50 ta qiyin so\'z', test:s=>(s.typed||0)>=50 },
  { id:'ty3',  em:'🔥', name:'10 ta ketma-ket xatosiz', test:s=>(s.typeBest||0)>=10 },
];

// ---------- STATE ----------
const KEY = window.COCO_AUTH.saveKey;
// mehmon progressi birinchi kirgan hisobga o'tadi (ID ham birga o'tadi)
try { const old = localStorage.getItem('coconut-sim-v1'); if (KEY !== 'coconut-sim-v1' && old && !localStorage.getItem(KEY)) { localStorage.setItem(KEY, old); localStorage.removeItem('coconut-sim-v1'); } } catch(e){}
const fresh = () => ({
  coins:0, total:0, allTime:0, clicks:0, workers:{}, upgrades:[], skins:['coco'], skin:'coco',
  gems:0, prestiges:0, goldenCaught:0, ach:[], started:Date.now(), last:Date.now(), sound:true, pid:'', ptok:'', typed:0, typeBest:0, typeCoins:0
});
let S = fresh();
try { const s = JSON.parse(localStorage.getItem(KEY)); if (s) S = Object.assign(fresh(), s); } catch(e){}
S.skins = (S.skins || []).filter(id => SKINS.some(k => k.id === id)); if (!S.skins.includes('coco')) S.skins.unshift('coco');
if (!S.skins.includes(S.skin)) S.skin = 'coco';

let boost = { mult:1, until:0, click:1 };
let buyN = 1;
let tab = 'workers';

// ---------- FORMAT ----------
const SUF = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];
function fmt(n){
  if (n < 1000) return n < 10 && n % 1 ? n.toFixed(1) : Math.floor(n).toString();
  const i = Math.min(Math.floor(Math.log10(n)/3), SUF.length-1);
  return (n/Math.pow(1000,i)).toFixed(2).replace(/\.?0+$/,'') + SUF[i];
}

// ---------- CALC ----------
const has = id => S.upgrades.includes(id);
const gemMult = () => 1 + S.gems * 0.02;
function allMult(){ let m = gemMult(); UPGRADES.forEach(u=>{ if(u.type==='all'&&has(u.id)) m*=u.mult; }); return m; }
function workerCps(w){
  let m = 1; UPGRADES.forEach(u=>{ if(u.type==='worker'&&u.w===w.id&&has(u.id)) m*=u.mult; });
  return w.cps * m;
}
function cps(){
  let t = 0; WORKERS.forEach(w=> t += (S.workers[w.id]||0) * workerCps(w));
  return t * allMult() * boost.mult;
}
function perClick(){
  let c = 1; UPGRADES.forEach(u=>{ if(u.type==='click'&&has(u.id)) c*=u.mult; });
  let pc = 0; UPGRADES.forEach(u=>{ if(u.type==='clickcps'&&has(u.id)) pc+=u.val; });
  const sk = SKINS.find(k=>k.id===S.skin);
  c = c * (1 + (sk?sk.bonus:0)) * allMult();
  return (c + cps()*pc) * boost.click;
}
function critChance(){ let c=0; UPGRADES.forEach(u=>{ if(u.type==='crit'&&has(u.id)) c+=u.val; }); return c; }
function workerCost(w, n){
  const owned = S.workers[w.id]||0, r = 1.15;
  return w.base * Math.pow(r, owned) * (Math.pow(r, n) - 1) / (r - 1);
}
function gain(n){ S.coins += n; S.total += n; S.allTime += n; }
function gemsOnPrestige(){ return Math.floor(Math.sqrt(S.total / 1e6)); }

// ---------- SOUND ----------
let actx;
function beep(freq=520, dur=0.06, type='sine', vol=0.08){
  if (!S.sound) return;
  try{
    actx = actx || new (window.AudioContext||window.webkitAudioContext)();
    const o = actx.createOscillator(), g = actx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, actx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + dur);
    o.connect(g); g.connect(actx.destination); o.start(); o.stop(actx.currentTime + dur);
  }catch(e){}
}

// ---------- UI HELPERS ----------
const $ = id => document.getElementById(id);
function toast(msg){
  const t = document.createElement('div'); t.className='toast'; t.textContent=msg;
  document.body.appendChild(t); setTimeout(()=>t.remove(), 2200);
}
function floatText(x, y, txt, crit){
  const f = document.createElement('div'); f.className='float'+(crit?' crit':'');
  f.textContent = txt; f.style.left = (x-20)+'px'; f.style.top = (y-20)+'px';
  document.body.appendChild(f); setTimeout(()=>f.remove(), 1000);
}
function particles(x, y, em){
  for (let i=0;i<5;i++){
    const p = document.createElement('div'); p.className='particle'; p.textContent = em;
    p.style.left=x+'px'; p.style.top=y+'px';
    p.style.setProperty('--dx', (Math.random()*160-80)+'px');
    p.style.setProperty('--dy', (Math.random()*120+40)+'px');
    p.style.setProperty('--r', (Math.random()*360)+'deg');
    document.body.appendChild(p); setTimeout(()=>p.remove(), 1000);
  }
}

// ---------- CLICK ----------
const coco = $('coconut');
function doClick(x, y){
  let v = perClick(), crit = Math.random() < critChance();
  if (crit) v *= 10;
  gain(v); S.clicks++;
  floatText(x, y, '+'+fmt(v), crit);
  if (Math.random()<0.35) particles(x, y, Math.random()<0.5?'🪙':'💧');
  beep(crit?880:420+Math.random()*120, 0.05, crit?'triangle':'sine');
  squish(x, y);
  $('hint').style.display='none';
  renderTop();
}
coco.addEventListener('pointerdown', e => { e.preventDefault(); doClick(e.clientX, e.clientY); });
document.addEventListener('keydown', e => {
  if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
  if (e.code === 'Space' && !e.repeat) { e.preventDefault(); const r = coco.getBoundingClientRect(); doClick(r.left+r.width/2, r.top+r.height/3); }
});

// ---------- GOLDEN COCONUT ----------
function spawnGolden(){
  const g = document.createElement('div'); g.className='golden'; g.textContent='🌟';
  g.style.left = (40 + Math.random()*(innerWidth-120))+'px';
  g.style.top = (100 + Math.random()*(innerHeight-220))+'px';
  g.onclick = e => {
    g.remove(); S.goldenCaught++; beep(990,0.2,'triangle',0.12);
    const r = Math.random();
    if (r < 0.4){ boost = {mult:7, click:1, until:Date.now()+30000}; toast('🔥 30 sekund daromad x7!'); }
    else if (r < 0.7){ boost = {mult:1, click:20, until:Date.now()+15000}; toast('⚡ 15 sekund bosish x20!'); }
    else { const v = Math.max(cps()*120, perClick()*50, 50); gain(v); floatText(e.clientX,e.clientY,'+'+fmt(v),true); toast('💰 Bonus: +'+fmt(v)+' coin!'); }
    render();
  };
  document.body.appendChild(g);
  setTimeout(()=>g.remove(), 9000);
}
function scheduleGolden(){
  const f = has('g1') ? 0.5 : 1;
  setTimeout(()=>{ spawnGolden(); scheduleGolden(); }, (40000 + Math.random()*60000) * f);
}

// ---------- CHARACTER (spring physics, eyes, faces) ----------
const eyes = $('eyes'), pupils = $('pupils');
const spring = { sx:1, sy:1, vx:0, vy:0, r:0, vr:0, ty:0, vty:0 };
let faceTimer = 0, clickTimes = [], lastSkin = null, bubbleCount = 0;
const QUOTES = ['Voy! 😆','Yana bos!','Qitiq bo\'ldi 😂','Ehtiyot bo\'l!','Men kokosman! 🥥','Ooo, coin!','Ha-ha-ha!','Boshim aylandi 😵',
  'Yana, yana!','Sut chiqib ketadi!','Kuchliroq! 💪','Ayyy!','Bu kulgili 🤣','Palmaga qaytaman 🌴'];
function applySkin(){
  if (lastSkin === S.skin) return; lastSkin = S.skin;
  const sk = SKINS.find(k=>k.id===S.skin) || SKINS[0];
  $('c1').setAttribute('stop-color', sk.col[0]); $('c2').setAttribute('stop-color', sk.col[1]);
  $('straw').style.display = sk.id==='coco' ? '' : 'none';
  document.querySelectorAll('#coconut .ofit').forEach(g => g.style.display = g.dataset.s === sk.id ? 'inline' : 'none');
}
function squish(x, y){
  const r = coco.getBoundingClientRect();
  const side = (x - (r.left + r.width/2)) / (r.width/2);
  spring.vy -= 6.5; spring.vx += 5.5; spring.vr += side * 60 + (Math.random()*20-10); spring.vty += 90;
  spring.vy = Math.max(spring.vy, -9); spring.vx = Math.min(spring.vx, 8); spring.vr = Math.max(-90, Math.min(90, spring.vr)); spring.vty = Math.min(spring.vty, 140);
  const now = performance.now();
  clickTimes = clickTimes.filter(t => now - t < 1000); clickTimes.push(now);
  coco.classList.remove('hit','dizzy');
  coco.classList.add(clickTimes.length >= 9 ? 'dizzy' : 'hit');
  clearTimeout(faceTimer);
  faceTimer = setTimeout(()=>coco.classList.remove('hit','dizzy'), clickTimes.length >= 9 ? 900 : 220);
  if (++bubbleCount % 12 === 0 || (clickTimes.length === 9)) say(clickTimes.length >= 9 ? 'Boshim aylandi 😵‍💫' : QUOTES[Math.floor(Math.random()*QUOTES.length)]);
}
function say(t){
  document.querySelectorAll('.bubble').forEach(b=>b.remove());
  const b = document.createElement('div'); b.className='bubble'; b.textContent=t;
  coco.parentElement.appendChild(b); setTimeout(()=>b.remove(), 1600);
}
let lastAnim = performance.now();
function animChar(t){
  const dt = Math.min((t - lastAnim)/1000, 0.05); lastAnim = t;
  const k = 260, d = 11;               // stiffness / damping -> wobbly jelly
  spring.vx += (-k*(spring.sx-1) - d*spring.vx) * dt; spring.sx += spring.vx * dt;
  spring.vy += (-k*(spring.sy-1) - d*spring.vy) * dt; spring.sy += spring.vy * dt;
  spring.sx = Math.max(.75, Math.min(1.3, spring.sx)); spring.sy = Math.max(.72, Math.min(1.25, spring.sy));
  spring.vr += (-200*spring.r - 9*spring.vr) * dt;     spring.r  += spring.vr * dt;
  spring.vty += (-300*spring.ty - 14*spring.vty) * dt; spring.ty += spring.vty * dt;
  const breathe = Math.sin(t/650) * 0.018, sway = Math.sin(t/1300) * 2.2, hop = Math.abs(Math.sin(t/900)) * -3;
  coco.style.transform = `translateY(${spring.ty*0.35 + hop}px) rotate(${spring.r + sway}deg) scale(${spring.sx - breathe}, ${spring.sy + breathe})`;
  requestAnimationFrame(animChar);
}
requestAnimationFrame(animChar);
document.addEventListener('pointermove', e => {
  const r = coco.getBoundingClientRect();
  const dx = e.clientX - (r.left + r.width/2), dy = e.clientY - (r.top + r.height*0.48);
  const len = Math.hypot(dx, dy) || 1, m = Math.min(len/40, 1) * 6;
  pupils.style.transform = `translate(${dx/len*m}px, ${dy/len*m}px)`;
});
pupils.style.transition = 'transform .12s ease-out';
(function blink(){
  eyes.classList.add('closed'); setTimeout(()=>eyes.classList.remove('closed'), 130);
  if (Math.random() < 0.25) setTimeout(()=>{ eyes.classList.add('closed'); setTimeout(()=>eyes.classList.remove('closed'), 110); }, 260);
  setTimeout(blink, 1800 + Math.random()*3500);
})();
coco.addEventListener('pointerenter', ()=>{ spring.vy += 1.5; spring.vx -= 1; });
setTimeout(()=>say('Salom! Meni bos! 👋'), 800);

// ---------- ⌨️ SO'Z YOZISH: eng qiyin inglizcha so'zlar, copy-paste yo'q ----------
const WORDS = [
  ['rhythm','ritm'],['squirrel','olmaxon'],['colonel','polkovnik'],['pharaoh','fir\'avn'],['fuchsia','fuksiya (rang)'],
  ['zucchini','qovoqcha'],['epitome','timsol, namuna'],['liaison','aloqa, bog\'lovchi'],['mnemonic','eslab qolish usuli'],
  ['pneumonia','zotiljam'],['xylophone','ksilofon'],['pseudonym','taxallus'],['bourgeois','burjua'],['dichotomy','ikkiga bo\'linish'],
  ['acquiesce','rozi bo\'lmoq'],['necessary','zarur'],['embarrass','uyaltirmoq'],['millennium','ming yillik'],['quarantine','karantin'],
  ['silhouette','siluet'],['psychology','psixologiya'],['phenomenon','hodisa'],['rhinoceros','karkidon'],['lieutenant','leytenant'],
  ['hemorrhage','qon ketish'],['pterodactyl','pterodaktil'],['accommodate','joylashtirmoq'],['mischievous','sho\'x, sho\'rtumshuq'],
  ['bureaucracy','byurokratiya'],['archipelago','arxipelag'],['connoisseur','bilimdon, ixlosmand'],['sovereignty','suverenitet'],
  ['handkerchief','dastro\'mol'],['entrepreneur','tadbirkor'],['surveillance','kuzatuv'],['perseverance','qat\'iyat'],
  ['kaleidoscope','kaleydoskop'],['onomatopoeia','tovushga taqlid so\'z'],['jurisprudence','huquqshunoslik'],['questionnaire','so\'rovnoma'],
  ['miscellaneous','turli-tuman'],['conscientious','vijdonli'],['idiosyncrasy','o\'ziga xoslik'],['chrysanthemum','xrizantema gul'],
  ['unequivocally','shubhasiz'],['quintessential','mukammal namuna'],['sesquipedalian','juda uzun so\'zli'],
  ['incomprehensibility','tushunib bo\'lmaslik'],['otorhinolaryngologist','LOR shifokori'],
  ['floccinaucinihilipilification','biror narsani qadrsiz deb bilish'],['antidisestablishmentarianism','davlat cherkovini saqlash tarafdorligi'],
];
const RARE = /[qxzjkvwy]/g;
function wordDiff(w){ return w.length + 2 * ((w.match(RARE) || []).length) + (/(.)\1/.test(w) ? 3 : 0) + (w.length >= 15 ? 12 : 0); }
function wordStars(w){ const d = wordDiff(w); return d < 12 ? 1 : d < 16 ? 2 : d < 22 ? 3 : d < 32 ? 4 : 5; }
const T = { word:'', mean:'', start:0, mistakes:0, streak:0, last:'', ui:null, cv:null, inp:null, msg:null, prev:'' };
function pickWord(){
  let w; do { w = WORDS[Math.floor(Math.random() * WORDS.length)]; } while (WORDS.length > 1 && w[0] === T.word);
  T.word = w[0]; T.mean = w[1]; T.start = 0; T.mistakes = 0; T.prev = '';
  if (T.inp){ T.inp.value = ''; T.inp.maxLength = T.word.length; }
  if (T.ui){ T.ui.querySelector('.mean').textContent = '🇺🇿 ' + T.mean; T.ui.querySelector('.lvl').textContent = 'Qiyinlik: ' + '★'.repeat(wordStars(T.word)) + '☆'.repeat(5 - wordStars(T.word)) + ' · ' + T.word.length + ' harf'; }
  drawWord();
}
function typeBase(){ return Math.max(10, perClick() * 4 + cps() / Math.max(1, boost.mult) * 3); }
function drawWord(){
  const cv = T.cv; if (!cv) return;
  const dpr = window.devicePixelRatio || 1, w = cv.clientWidth || 360, h = cv.clientHeight || 120;
  cv.width = w * dpr; cv.height = h * dpr;
  const c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, w, h);
  const typed = T.inp ? T.inp.value : '', n = T.word.length;
  let fs = Math.min(44, (w - 24) / (n * 0.62)); fs = Math.max(fs, 11);
  c.font = '800 ' + fs + 'px ui-monospace,Menlo,Consolas,monospace'; c.textBaseline = 'middle';
  const cw = c.measureText('M').width, x0 = (w - cw * n) / 2;
  for (let i = 0; i < n; i++){
    const ch = T.word[i], t = typed[i];
    c.fillStyle = t == null ? '#fff8ec' : (t.toLowerCase() === ch ? '#3ddc84' : '#ff5d5d');
    if (i === typed.length){ c.fillStyle = '#ffc83d'; c.fillRect(x0 + i * cw, h / 2 + fs * 0.55, cw - 2, 3); }
    c.fillText(ch, x0 + i * cw, h / 2);
  }
  // nusxalash/OCR ni qiyinlashtiruvchi yengil shovqin
  c.globalAlpha = .08; c.strokeStyle = '#fff';
  for (let i = 0; i < 6; i++){ c.beginPath(); c.moveTo(Math.random() * w, Math.random() * h); c.lineTo(Math.random() * w, Math.random() * h); c.stroke(); }
  c.globalAlpha = 1;
}
function tmsg(t, k){ if (T.msg){ T.msg.textContent = t; T.msg.className = 'tmsg' + (k ? ' ' + k : ''); } }
function badInput(why){
  T.inp.value = T.prev; T.inp.classList.remove('bad'); void T.inp.offsetWidth; T.inp.classList.add('bad');
  tmsg(why, 'err'); beep(160, 0.12, 'square', 0.05);
}
function onType(e){
  const v = T.inp.value;
  const it = e.inputType || '';
  // copy-paste, sudrab tashlash, avto-to'ldirish va bir yo'la bir necha harf — taqiqlanadi
  if (/insertFromPaste|insertFromDrop|insertReplacementText|insertFromYank|insertTranspose/.test(it) || (e.data && e.data.length > 1) || v.length > T.prev.length + 1){
    badInput("🚫 Copy-paste mumkin emas — harfma-harf yozing!"); return;
  }
  if (!/^[a-zA-Z]*$/.test(v)){ badInput('Faqat inglizcha harflar'); return; }
  if (!T.start && v.length) T.start = performance.now();
  if (v.length > T.prev.length){
    const i = v.length - 1;
    if (v[i].toLowerCase() !== T.word[i]){ T.mistakes++; T.inp.classList.remove('bad'); void T.inp.offsetWidth; T.inp.classList.add('bad'); beep(200, 0.06, 'square', 0.03); }
    else beep(600 + i * 12, 0.03, 'sine', 0.04);
  }
  T.prev = v; drawWord();
  if (v.toLowerCase() === T.word) finishWord();
}
function finishWord(){
  const sec = Math.max(0.3, (performance.now() - T.start) / 1000), speed = T.word.length / sec;   // harf/sekund
  const diff = wordDiff(T.word), spM = Math.max(0.6, Math.min(2.2, speed / 3)), accM = Math.max(0.25, 1 - 0.12 * T.mistakes);
  if (T.mistakes === 0) T.streak++; else T.streak = 0;
  S.typeBest = Math.max(S.typeBest || 0, T.streak);
  const stM = 1 + Math.min(T.streak, 10) * 0.1;
  const reward = Math.floor(typeBase() * diff * spM * accM * stM);
  gain(reward); S.typed = (S.typed || 0) + 1; S.typeCoins = (S.typeCoins || 0) + reward; save();
  const r = T.inp.getBoundingClientRect(); floatText(r.left + r.width / 2, r.top, '+' + fmt(reward), T.mistakes === 0);
  beep(990, 0.18, 'triangle', 0.1);
  tmsg('✅ ' + T.word + ' · +' + fmt(reward) + ' coin · ' + speed.toFixed(1) + ' harf/s · ' + (T.mistakes ? T.mistakes + ' xato' : 'xatosiz 🔥') + (T.streak > 1 ? ' · seriya x' + T.streak : ''), 'ok');
  pickWord(); paintTypeStats(); renderTop();
}
function paintTypeStats(){
  if (!T.ui) return;
  T.ui.querySelector('#tyN').textContent = '📚 ' + (S.typed || 0) + ' so\'z';
  T.ui.querySelector('#tyS').textContent = '🔥 Seriya: ' + T.streak + ' (rekord ' + (S.typeBest || 0) + ')';
  T.ui.querySelector('#tyC').textContent = '🪙 ' + fmt(S.typeCoins || 0) + ' coin topildi';
}
function typeUI(){
  if (!T.ui){
    const d = document.createElement('div'); d.className = 'tw';
    d.innerHTML = '<div class="lvl"></div><canvas></canvas><div class="mean"></div>' +
      '<input type="text" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" inputmode="text" enterkeyhint="done" placeholder="Shu yerga yozing…" aria-label="So\'zni yozing">' +
      '<div class="tmsg"></div>' +
      '<div class="trow"><button class="tbtn" id="tySkip">⏭ Boshqa so\'z</button><button class="tbtn" id="tyClr">⌫ Tozalash</button><button class="tbtn" id="tyHint">💡 Qoida</button></div>' +
      '<div class="stats"><div class="stat"><div class="v" id="tyN" style="font-size:15px"></div></div><div class="stat"><div class="v" id="tyS" style="font-size:15px"></div></div><div class="stat" style="grid-column:1/-1"><div class="v" id="tyC" style="font-size:15px"></div></div></div>' +
      '<div class="rule" id="tyRule" style="display:none">🪙 Coin = so\'z qiyinligi (uzunlik, kam uchraydigan harflar q x z j k v w y, qo\'sh harflar) × tezlik (tezroq — ko\'proq, x2.2 gacha) × aniqlik (har xato −12%) × seriya (ketma-ket xatosiz so\'zlar +10% dan, x2 gacha). Daromadingiz o\'sgani sari har so\'z ham qimmatlashadi. Copy-paste, sudrab tashlash va avto-to\'ldirish ishlamaydi.</div>';
    T.ui = d; T.cv = d.querySelector('canvas'); T.inp = d.querySelector('input'); T.msg = d.querySelector('.tmsg');
    T.inp.addEventListener('input', onType);
    ['paste','drop','copy','cut','contextmenu','dragstart'].forEach(ev => d.addEventListener(ev, e => { e.preventDefault(); if (ev === 'paste' || ev === 'drop') badInput("🚫 Copy-paste mumkin emas — harfma-harf yozing!"); }));
    T.inp.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && /^[vV]$/.test(e.key)) { e.preventDefault(); badInput("🚫 Copy-paste mumkin emas — harfma-harf yozing!"); } });
    d.querySelector('#tySkip').onclick = () => { T.streak = 0; tmsg('⏭ So\'z almashtirildi — seriya 0 ga tushdi'); pickWord(); paintTypeStats(); T.inp.focus(); };
    d.querySelector('#tyClr').onclick = () => { T.inp.value = ''; T.prev = ''; drawWord(); T.inp.focus(); };
    d.querySelector('#tyHint').onclick = () => { const r = d.querySelector('#tyRule'); r.style.display = r.style.display === 'none' ? '' : 'none'; };
    T.cv.addEventListener('click', () => T.inp.focus());
    window.addEventListener('resize', drawWord);
    pickWord();
  }
  paintTypeStats();
  setTimeout(drawWord, 30);
  return T.ui;
}

// ---------- RENDER ----------
function renderTop(){
  $('coins').textContent = fmt(S.coins);
  $('perClick').textContent = fmt(perClick());
  $('perSec').textContent = fmt(cps());
  $('gems').textContent = S.gems;
  $('gemBonus').textContent = S.gems*2;
  applySkin();
  const left = boost.until - Date.now();
  $('boostBox').innerHTML = left > 0
    ? `<div class="boost">${boost.mult>1?'🔥 Daromad x'+boost.mult:'⚡ Bosish x'+boost.click} — ${Math.ceil(left/1000)}s</div>` : '';
  if (left <= 0 && (boost.mult!==1||boost.click!==1)) boost = {mult:1, click:1, until:0};
  updateAffordability();
  document.title = fmt(S.coins) + ' 🥥 Coconut Simulator';
}

function updateAffordability(){
  document.querySelectorAll('[data-cost]').forEach(el=>{
    const c = +el.dataset.cost, ok = S.coins >= c;
    el.closest('.item').classList.toggle('locked', !ok);
    el.classList.toggle('no', !ok);
  });
}

function render(){
  const L = $('list');
  $('buymode').style.display = tab==='workers' ? 'flex' : 'none';
  let h = '';
  if (tab === 'workers'){
    WORKERS.forEach((w,i)=>{
      const prevOwned = i===0 || (S.workers[WORKERS[i-1].id]||0)>0 || (S.workers[w.id]||0)>0;
      const cost = workerCost(w, buyN);
      if (!prevOwned){ h += `<div class="item locked"><div class="em">❓</div><div class="info"><div class="name">???</div><div class="desc">Oldingi ishchini sotib ol</div></div></div>`; return; }
      h += `<div class="item" data-buy="${w.id}">
        <div class="em">${w.em}</div>
        <div class="info"><div class="name">${w.name}</div>
        <div class="desc">${w.desc} · +${fmt(workerCps(w)*allMult())}/s</div>
        <div class="price" data-cost="${cost}">🪙 ${fmt(cost)}</div></div>
        <div class="cnt">${S.workers[w.id]||0}</div></div>`;
    });
  } else if (tab === 'upgrades'){
    const avail = UPGRADES.filter(u=>!has(u.id) && (u.type!=='worker' || (S.workers[u.w]||0)>0)).sort((a,b)=>a.cost-b.cost);
    const owned = UPGRADES.filter(u=>has(u.id));
    if (!avail.length) h += `<div class="pill" style="text-align:center">Hozircha yangi upgrade yo'q — ishchi sotib ol!</div>`;
    avail.forEach(u=>{
      h += `<div class="item" data-up="${u.id}"><div class="em">${u.em}</div>
        <div class="info"><div class="name">${u.name}</div><div class="desc">${u.desc}</div>
        <div class="price" data-cost="${u.cost}">🪙 ${fmt(u.cost)}</div></div></div>`;
    });
    if (owned.length){
      h += `<div class="sec">Sotib olingan (${owned.length}/${UPGRADES.length})</div>`;
      owned.forEach(u=>{ h += `<div class="item owned"><div class="em">${u.em}</div><div class="info"><div class="name">${u.name} ✅</div><div class="desc">${u.desc}</div></div></div>`; });
    }
  } else if (tab === 'skins'){
    SKINS.forEach(k=>{
      const own = S.skins.includes(k.id), eq = S.skin===k.id;
      h += `<div class="item ${own?'owned':''} ${eq?'equipped':''}" data-skin="${k.id}" style="${own?'cursor:pointer':''}">
        <div class="em">${k.em}</div><div class="info"><div class="name">${k.name}</div><div class="desc">${k.desc}</div>
        ${own ? `<div class="price" style="color:var(--green)">${eq?'✔ Kiyilgan':'Kiyish'}</div>` : `<div class="price" data-cost="${k.cost}">🪙 ${fmt(k.cost)}</div>`}
        </div></div>`;
    });
  } else {
    const g = gemsOnPrestige();
    const mins = Math.floor((Date.now()-S.started)/60000);
    h += `<div class="stats">
      <div class="stat"><div class="k">Jami coin</div><div class="v">${fmt(S.total)}</div></div>
      <div class="stat"><div class="k">Butun vaqt</div><div class="v">${fmt(S.allTime)}</div></div>
      <div class="stat"><div class="k">Bosishlar</div><div class="v">${fmt(S.clicks)}</div></div>
      <div class="stat"><div class="k">Oltin kokoslar</div><div class="v">${S.goldenCaught}</div></div>
      <div class="stat"><div class="k">Kritik imkoniyat</div><div class="v">${Math.round(critChance()*100)}%</div></div>
      <div class="stat"><div class="k">O'ynalgan vaqt</div><div class="v">${mins} daq</div></div>
      <div class="stat"><div class="k">🆔 Sizning ID</div><div class="v">${S.pid || '…'}</div></div>
      <div class="stat"><div class="k">⌨️ Yozilgan so'zlar</div><div class="v">${S.typed||0}</div></div>
      <div class="stat"><div class="k">Hisob</div><div class="v">${window.COCO_AUTH.user ? 'Bilols AI ✅' : 'Mehmon'}</div></div>
    </div>
    <div class="sec">💎 Prestij</div>
    <div class="desc" style="color:var(--muted);font-size:13px">Hammasini boshidan boshlab olmos ol. Har bir olmos +2% daromad beradi (doimiy). 1M coin yig'gandan keyin ochiladi.</div>
    <button class="prestige" id="prestigeBtn" ${g<1?'disabled':''}>Prestij: +${g} 💎</button>
    <div class="sec">🏆 Yutuqlar (${S.ach.length}/${ACHIEVEMENTS.length})</div>`;
    ACHIEVEMENTS.forEach(a=>{ h += `<div class="ach ${S.ach.includes(a.id)?'':'no'}"><span style="font-size:24px">${a.em}</span><b>${a.name}</b></div>`; });
  }
  L.innerHTML = h;
  renderTop();
}

// ---------- ACTIONS ----------
$('list').addEventListener('click', e => {
  const it = e.target.closest('.item'); if (!it) return;
  if (it.dataset.buy){
    const w = WORKERS.find(x=>x.id===it.dataset.buy), c = workerCost(w, buyN);
    if (S.coins < c) return beep(160,0.1,'square',0.04);
    S.coins -= c; S.workers[w.id] = (S.workers[w.id]||0) + buyN; beep(660,0.08,'triangle'); render();
  } else if (it.dataset.up){
    const u = UPGRADES.find(x=>x.id===it.dataset.up);
    if (S.coins < u.cost) return beep(160,0.1,'square',0.04);
    S.coins -= u.cost; S.upgrades.push(u.id); beep(780,0.1,'triangle'); toast(u.em+' '+u.name+' sotib olindi!'); render();
  } else if (it.dataset.skin){
    const k = SKINS.find(x=>x.id===it.dataset.skin);
    if (S.skins.includes(k.id)){ S.skin = k.id; render(); return; }
    if (S.coins < k.cost) return beep(160,0.1,'square',0.04);
    S.coins -= k.cost; S.skins.push(k.id); S.skin = k.id; beep(880,0.12,'triangle'); toast(k.em+' '+k.name+' skin olindi!'); render();
  }
});
$('list').addEventListener('click', e => {
  if (e.target.id !== 'prestigeBtn') return;
  const g = gemsOnPrestige(); if (g < 1) return;
  if (!confirm(`Prestij qilasizmi? Coin, ishchilar va upgradelar o'chadi, lekin +${g} 💎 olasiz (skinlar qoladi).`)) return;
  Object.assign(S, { coins:0, total:0, workers:{}, upgrades:[], gems:S.gems+g, prestiges:S.prestiges+1 });
  toast('💎 +'+g+' olmos!'); save(); render();
});
document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>{
  document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active')); b.classList.add('active');
  tab = b.dataset.tab; render();
});
document.querySelectorAll('.bm').forEach(b=>b.onclick=()=>{
  document.querySelectorAll('.bm').forEach(x=>x.classList.remove('active')); b.classList.add('active');
  buyN = +b.dataset.n; render();
});
$('soundBtn').onclick = () => { S.sound = !S.sound; $('soundBtn').textContent = S.sound?'🔊':'🔇'; save(); };
$('soundBtn').textContent = S.sound?'🔊':'🔇';
$('resetBtn').onclick = () => {
  if (confirm('Hamma progressni o\'chirib, boshidan boshlaysizmi?')){ const keep = { pid:S.pid, ptok:S.ptok }; localStorage.removeItem(KEY); S = Object.assign(fresh(), keep); save(); render(); }
};

// ---------- LOOP / SAVE ----------
function save(){ S.last = Date.now(); localStorage.setItem(KEY, JSON.stringify(S)); }
function checkAch(){
  ACHIEVEMENTS.forEach(a=>{ if (!S.ach.includes(a.id) && a.test(S)){ S.ach.push(a.id); toast('🏆 Yutuq: '+a.name); beep(1040,0.2,'triangle',0.1); } });
}

// offline earnings (50%, max 8h)
(() => {
  const sec = Math.min((Date.now() - (S.last||Date.now()))/1000, 8*3600);
  const earned = cps() * sec * 0.5;
  if (sec > 30 && earned > 0){ gain(earned); setTimeout(()=>toast('😴 Offline paytda: +'+fmt(earned)+' coin'), 600); }
})();

let lastT = performance.now(), tick = 0;
function loop(t){
  const dt = Math.min((t - lastT)/1000, 1); lastT = t;
  const c = cps(); if (c > 0) gain(c * dt);
  if (++tick % 6 === 0) renderTop();
  requestAnimationFrame(loop);
}
// when tab hidden, rAF pauses — catch up via interval
setInterval(()=>{ checkAch(); save(); if (tab==='workers'||tab==='upgrades') render(); }, 3000);
let hiddenAt = 0;
document.addEventListener('visibilitychange', ()=>{
  if (document.hidden){ hiddenAt = Date.now(); save(); }
  else { if (hiddenAt){ gain(cps() * Math.min((Date.now()-hiddenAt)/1000, 8*3600)); hiddenAt = 0; } lastT = performance.now(); renderTop(); }
});
window.addEventListener('beforeunload', save);

// ---------- SERVER: o'yinchi ID va admin bergan coinlar ----------
const SRV = 'https://blwapspmzvcpadoydzwg.supabase.co/functions/v1/coconut';
if (!S.ptok){ const a = new Uint8Array(24); crypto.getRandomValues(a); S.ptok = Array.from(a, x => x.toString(16).padStart(2,'0')).join(''); }
const pname = () => (window.COCO_AUTH.user && window.COCO_AUTH.user.name) || 'Mehmon';
function showPid(){ $('pidT').textContent = S.pid || '…'; }
$('idchip').onclick = () => { if (!S.pid) return; try { navigator.clipboard.writeText(S.pid); } catch(e){} toast('🆔 ID nusxalandi: ' + S.pid); };
let syncing = false;
async function sync(){
  if (syncing) return; syncing = true;
  try {
    const base = { token:S.ptok, name:pname(), acct:!!window.COCO_AUTH.user, coins:Math.floor(S.coins), total:Math.floor(S.total), clicks:S.clicks };
    if (!S.pid){
      const r = await (await fetch(SRV, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ action:'register', ...base }) })).json();
      if (r.ok && r.pid){ S.pid = r.pid; save(); showPid(); toast('🆔 Sizning ID: ' + r.pid); }
      return;
    }
    const res = await fetch(SRV, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ action:'sync', pid:S.pid, ...base }) });
    const r = await res.json();
    if (res.status === 401){ S.pid = ''; showPid(); return; }   // server bu ID ni tanimadi — yangisi olinadi
    (r.grants || []).forEach(g => {
      gain(g.amount); save(); beep(990,0.25,'triangle',0.12);
      toast('🎁 Admin sizga +' + fmt(g.amount) + ' coin berdi!' + (g.note ? ' (' + g.note + ')' : ''));
      floatText(innerWidth/2, innerHeight/3, '+' + fmt(g.amount), true);
      renderTop();
    });
  } catch(e){} finally { syncing = false; }
}
showPid(); setTimeout(sync, 400); setInterval(sync, 15000);

$('typeBox').appendChild(typeUI());
// ---------- 📱 Telefon: pastki menyu, sarlavhada coin, klaviatura ----------
(function mobile(){
  const nav = $('mnav'), hc = $('hcoins'), stage = document.querySelector('.stage');
  const targets = { top: () => window.scrollTo({ top: 0, behavior: 'smooth' }),
    type: () => document.querySelector('.typebox').scrollIntoView({ behavior: 'smooth', block: 'start' }),
    shop: () => document.querySelector('.panel').scrollIntoView({ behavior: 'smooth', block: 'start' }) };
  nav.addEventListener('click', e => { const b = e.target.closest('button'); if (b) targets[b.dataset.go](); });
  function onScroll(){
    const y = window.scrollY, tb = document.querySelector('.typebox').offsetTop, pn = document.querySelector('.panel').offsetTop;
    const cur = y + 140 >= pn ? 'shop' : y + 200 >= tb ? 'type' : 'top';
    nav.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.go === cur));
    hc.classList.toggle('on', stage.getBoundingClientRect().bottom < 60);
  }
  window.addEventListener('scroll', onScroll, { passive: true }); onScroll();
  setInterval(() => { if (hc.classList.contains('on')) hc.textContent = '🪙 ' + fmt(S.coins); }, 250);
  // klaviatura ochilganda yozish maydoni ko'rinib tursin
  T.inp.addEventListener('focus', () => { if (innerWidth <= 900) setTimeout(() => T.inp.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300); });
})();

render(); requestAnimationFrame(loop); scheduleGolden();
})();
