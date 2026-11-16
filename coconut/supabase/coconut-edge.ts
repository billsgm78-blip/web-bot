// Coconut Simulator server (Supabase edge function "coconut").
// Bu fayl — nusxa: o'zgartirsangiz, Supabase'ga qayta deploy qilish kerak.
//
// O'yinchi: 6 xonali ID + maxfiy token. Bilols AI hisobi bilan kirganlar — hisob orqali (bilolsai serverida tekshiriladi).
// Admin: admin.bilolsai.uz sessiya tokeni (bilolsai serverida tekshiriladi).
import { createClient } from "npm:@supabase/supabase-js@2";

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const BILOLS_API = "https://bilolsai-api.onrender.com";
const ORIGIN_RX = /^(https:\/\/(coconut|admin)\.bilolsai\.uz|https:\/\/coconut-simulator[a-z0-9-]*\.vercel\.app|https:\/\/web-bot[a-z0-9-]*\.vercel\.app|http:\/\/localhost(:\d+)?)$/;

function cors(origin: string | null) {
  return {
    "Access-Control-Allow-Origin": origin && ORIGIN_RX.test(origin) ? origin : "https://coconut.bilolsai.uz",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type, authorization, apikey, x-client-info",
    "Vary": "Origin",
  };
}
async function sha(s: string) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(b)).map((x) => x.toString(16).padStart(2, "0")).join("");
}
function safeEq(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
const num = (v: unknown, max = 1e300) => { const n = Number(v); return Number.isFinite(n) && n >= 0 ? Math.min(n, max) : 0; };
const str = (v: unknown, n: number) => String(v ?? "").replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, n);
const digits = (v: unknown) => String(v ?? "").replace(/\D/g, "").slice(0, 15);

// Toshkent vaqti bo'yicha kun va hafta
function tashkentDate(d = new Date()) { return new Date(d.getTime() + 5 * 3600e3).toISOString().slice(0, 10); }
function weekKey(d = new Date()) {
  const t = new Date(d.getTime() + 5 * 3600e3), day = (t.getUTCDay() + 6) % 7;   // dushanba = 0
  t.setUTCDate(t.getUTCDate() - day);
  return t.toISOString().slice(0, 10);
}

// ---- Sozlamalar (event, e'lon) ----
let setCache: { at: number; v: Record<string, any> } = { at: 0, v: {} };
async function settings() {
  if (Date.now() - setCache.at < 10000) return setCache.v;
  const { data } = await sb.from("coco_settings").select("key, value");
  const v: Record<string, any> = {};
  (data || []).forEach((r: any) => { v[r.key] = r.value; });
  setCache = { at: Date.now(), v };
  return v;
}
async function setSetting(key: string, value: unknown) {
  await sb.from("coco_settings").upsert({ key, value, updated_at: new Date().toISOString() });
  setCache.at = 0;
}
function activeEvent(s: Record<string, any>) {
  const e = s.event;
  return e && e.mult > 1 && e.until > Date.now() ? e : null;
}

// ---- Bilols AI hisobi (telefon + sessiya) — 10 daqiqa keshlanadi ----
const acctCache = new Map<string, { key: string; exp: number }>();
async function accountKey(phone: unknown, token: unknown): Promise<string | null> {
  const p = digits(phone), t = String(token ?? "").slice(0, 300);
  if (p.length < 9 || t.length < 8) return null;
  const ck = await sha(p + "|" + t), c = acctCache.get(ck);
  if (c && c.exp > Date.now()) return c.key;
  try {
    const r = await fetch(BILOLS_API + "/api/auth-check", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: p, password: t }), signal: AbortSignal.timeout(15000),
    });
    const j = await r.json().catch(() => ({}));
    if (r.status === 200 && j.success) {
      const key = await sha("coco-acct:" + p);
      acctCache.set(ck, { key, exp: Date.now() + 600000 });
      return key;
    }
  } catch (e) { console.error("acct check", e); }
  return null;
}

// ---- admin.bilolsai.uz sessiyasi — 60 s keshlanadi ----
const adminCache = new Map<string, number>();
async function isAdmin(token: unknown) {
  const t = String(token ?? "");
  if (t.length < 16 || t.length > 300) return false;
  const key = await sha(t), now = Date.now();
  if ((adminCache.get(key) || 0) > now) return true;
  try {
    const r = await fetch(BILOLS_API + "/api/admin/panic_get", {
      method: "POST", headers: { "Content-Type": "application/json", "X-Admin-Token": t },
      body: JSON.stringify({ ver: 1 }), signal: AbortSignal.timeout(15000),
    });
    const j = await r.json().catch(() => ({}));
    if (r.status === 200 && j.success) { adminCache.set(key, now + 60000); return true; }
  } catch (e) { console.error("admin check", e); }
  return false;
}

// O'yinchini aniqlash: ID+token yoki (hisobga ulangan bo'lsa) Bilols AI hisobi orqali
async function authPlayer(d: Record<string, unknown>) {
  const pid = str(d.pid, 10);
  if (!/^\d{6}$/.test(pid)) return { p: null, akey: null };
  const { data: p } = await sb.from("coco_players").select("*").eq("pid", pid).maybeSingle();
  if (!p) return { p: null, akey: null };
  const token = str(d.token, 100);
  const tokenOk = token.length >= 20 && safeEq(p.token_hash, await sha(token));
  const akey = d.acct ? await accountKey((d.acct as any).phone, (d.acct as any).token) : null;
  if (tokenOk || (akey && p.account_key === akey)) return { p, akey };
  return { p: null, akey };
}

// Aldovdan himoya: ikki sync orasida "jami coin" qancha o'sishi mumkin
function maxGain(dtSec: number, base: number, mult: number) {
  const dt = Math.max(1, Math.min(dtSec, 9 * 3600));
  return (2e4 * dt + Math.max(base, 1e4) * (Math.pow(3, Math.min(dt, 900) / 60) - 1) + (dt > 900 ? base * 50 : 0)) * mult;
}

const LB_COLS: Record<string, string> = { all: "lb_total", week: "week_earned", typed: "typed" };

Deno.serve(async (req) => {
  const h = { ...cors(req.headers.get("origin")), "Content-Type": "application/json" };
  if (req.method === "OPTIONS") return new Response("ok", { headers: h });
  const out = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: h });
  if (req.method !== "POST") return out({ ok: false }, 405);
  let d: Record<string, unknown> = {};
  try { d = await req.json(); } catch { return out({ ok: false, error: "bad json" }, 400); }
  const denied = () => out({ ok: false, auth: false, error: "Admin sessiyasi tugagan. Qaytadan kiring." }, 401);

  try {
    switch (d.action) {
      // ---- O'yinchi: yangi ID ----
      case "register": {
        const token = str(d.token, 100);
        if (token.length < 20) return out({ ok: false, error: "token" }, 400);
        const th = await sha(token);
        for (let i = 0; i < 8; i++) {
          const pid = String(100000 + Math.floor(Math.random() * 900000));
          const { error } = await sb.from("coco_players").insert({
            pid, token_hash: th, name: str(d.name, 24) || "Mehmon", is_account: !!d.acct,
            coins: num(d.coins), total: num(d.total), clicks: Math.floor(num(d.clicks, 1e15)),
            lb_total: Math.min(num(d.total), 1e5), week_key: weekKey(), last_sync: new Date().toISOString(),
          });
          if (!error) return out({ ok: true, pid });
          if (error.code !== "23505") throw error;
        }
        return out({ ok: false, error: "busy" }, 503);
      }

      // ---- Bilols AI hisobi bilan kirganda: shu hisobning bulutdagi o'yini ----
      case "cloud_load": {
        const akey = await accountKey((d.acct as any)?.phone, (d.acct as any)?.token);
        if (!akey) return out({ ok: false, error: "acct" }, 401);
        const { data: p } = await sb.from("coco_players").select("pid, save, saved_at, banned").eq("account_key", akey).maybeSingle();
        if (!p) return out({ ok: true, none: true });
        return out({ ok: true, pid: p.pid, save: p.save, saved_at: p.saved_at, banned: p.banned });
      }

      // ---- O'yinchi: holat, bulutga saqlash, admin coinlari, event, e'lon ----
      case "sync": {
        const { p, akey } = await authPlayer(d);
        if (!p) return out({ ok: false, error: "auth" }, 401);
        const s = await settings(), ev = activeEvent(s), now = new Date();
        const dt = p.last_sync ? (now.getTime() - new Date(p.last_sync).getTime()) / 1000 : 15;
        const total = num(d.total), prevTotal = Number(p.total) || 0;
        const delta = Math.max(0, total - prevTotal);                       // prestijda total kamayadi — delta 0
        const allow = maxGain(dt, Number(p.lb_total) || 0, ev ? ev.mult : 1) + (Number(p.pending_allow) || 0);
        const accepted = Math.min(delta, allow);
        const suspicious = delta > allow * 1.5 && delta > 1e5;
        const wk = weekKey(now);
        const typedIn = Math.floor(num(d.typed, 1e9)), typedOk = Math.min(typedIn, p.typed + Math.ceil(Math.max(dt, 2) / 2));
        const upd: Record<string, unknown> = {
          name: str(d.name, 24) || "Mehmon", is_account: !!d.acct, coins: num(d.coins), total,
          clicks: Math.floor(num(d.clicks, 1e15)), last_seen: now.toISOString(), last_sync: now.toISOString(),
          lb_total: (Number(p.lb_total) || 0) + accepted,
          week_key: wk, week_earned: (p.week_key === wk ? Number(p.week_earned) || 0 : 0) + accepted,
          typed: Math.max(p.typed, typedOk), pending_allow: 0,
          flags: p.flags + (suspicious ? 1 : 0),
        };
        // Bilols AI hisobi: shu ID ni hisobga ulash va o'yinni bulutga saqlash
        let linked = !!p.account_key;
        if (akey && !p.account_key) {
          const { data: other } = await sb.from("coco_players").select("pid").eq("account_key", akey).maybeSingle();
          if (!other) { upd.account_key = akey; linked = true; }
        }
        if (akey && (p.account_key === akey || upd.account_key === akey) && d.save && typeof d.save === "object") {
          const js = JSON.stringify(d.save);
          if (js.length < 30000) { upd.save = d.save; upd.saved_at = now.toISOString(); }
        }
        await sb.from("coco_players").update(upd).eq("pid", p.pid);
        const { data: g, error } = await sb.from("coco_grants").update({ claimed_at: now.toISOString() })
          .eq("pid", p.pid).is("claimed_at", null).select("amount, note");
        if (error) throw error;
        const plus = (g || []).reduce((a: number, x: any) => a + Math.max(0, x.amount), 0);
        if (plus > 0) await sb.from("coco_players").update({ pending_allow: plus }).eq("pid", p.pid);
        return out({
          ok: true, grants: g || [], banned: p.banned, linked, event: ev,
          announce: s.announce && s.announce.text ? s.announce : null, daily: { day: p.daily_day, streak: p.daily_streak, today: tashkentDate(now) },
        });
      }

      // ---- Kunlik bonus ----
      case "daily": {
        const { p } = await authPlayer(d);
        if (!p) return out({ ok: false, error: "auth" }, 401);
        if (p.banned) return out({ ok: false, error: "banned" }, 403);
        const today = tashkentDate(), yest = tashkentDate(new Date(Date.now() - 86400e3));
        if (p.daily_day === today) return out({ ok: false, already: true, streak: p.daily_streak });
        const streak = p.daily_day === yest ? p.daily_streak + 1 : 1;
        const day = ((streak - 1) % 7) + 1;
        const allow = day * Math.max(5000, (Number(p.lb_total) || 0) * 0.1);
        await sb.from("coco_players").update({
          daily_day: today, daily_streak: streak, pending_allow: (Number(p.pending_allow) || 0) + allow,
        }).eq("pid", p.pid);
        return out({ ok: true, day, streak, skin: streak >= 7 ? "tropic" : null });
      }

      // ---- Reyting ----
      case "top": {
        const kind = LB_COLS[String(d.kind)] ? String(d.kind) : "all", col = LB_COLS[kind];
        let q = sb.from("coco_players").select("pid, name, is_account, " + col).eq("banned", false).gt(col, 0)
          .order(col, { ascending: false }).limit(20);
        if (kind === "week") q = q.eq("week_key", weekKey());
        const { data, error } = await q;
        if (error) throw error;
        let me = null;
        const pid = str(d.pid, 10);
        if (/^\d{6}$/.test(pid)) {
          const { data: mine } = await sb.from("coco_players").select("pid, name, " + col + ", week_key").eq("pid", pid).maybeSingle();
          if (mine) {
            const val = kind === "week" && (mine as any).week_key !== weekKey() ? 0 : Number((mine as any)[col]) || 0;
            let cq = sb.from("coco_players").select("pid", { count: "exact", head: true }).eq("banned", false).gt(col, val);
            if (kind === "week") cq = cq.eq("week_key", weekKey());
            const { count } = await cq;
            me = { pid, name: (mine as any).name, value: val, rank: (count || 0) + 1 };
          }
        }
        return out({ ok: true, kind, rows: (data || []).map((r: any) => ({ pid: r.pid, name: r.name, acct: r.is_account, value: Number(r[col]) || 0 })), me });
      }

      // ---- Admin (admin.bilolsai.uz) ----
      case "admin_list": {
        if (!(await isAdmin(d.token))) return denied();
        const q = str(d.q, 40);
        let qb = sb.from("coco_players").select("pid, name, is_account, coins, total, lb_total, typed, clicks, banned, flags, account_key, daily_streak, created_at, last_seen")
          .order("last_seen", { ascending: false }).limit(100);
        if (/^\d{1,6}$/.test(q)) qb = qb.like("pid", q + "%");
        else if (q === "!") qb = qb.gt("flags", 0);
        else if (q) qb = qb.ilike("name", "%" + q.replace(/[%_\\]/g, "") + "%");
        const { data, error } = await qb;
        if (error) throw error;
        const { count } = await sb.from("coco_players").select("pid", { count: "exact", head: true });
        const since = new Date(Date.now() - 5 * 60000).toISOString();
        const { count: online } = await sb.from("coco_players").select("pid", { count: "exact", head: true }).gte("last_seen", since);
        const { data: recent } = await sb.from("coco_grants").select("pid, amount, note, created_at, claimed_at")
          .order("created_at", { ascending: false }).limit(30);
        const s = await settings();
        return out({
          ok: true, count, online, recent: recent || [], event: activeEvent(s), announce: s.announce || null,
          players: (data || []).map((r: any) => ({ ...r, account_key: undefined, linked: !!r.account_key })),
        });
      }
      // amount > 0 — coin berish, amount < 0 — coin ayirish
      case "admin_grant": {
        if (!(await isAdmin(d.token))) return denied();
        const pid = str(d.pid, 10), amount = Number(d.amount);
        if (!/^\d{6}$/.test(pid)) return out({ ok: false, error: "ID 6 xonali raqam bo'lishi kerak" }, 400);
        if (!Number.isFinite(amount) || amount === 0 || Math.abs(amount) > 1e18) return out({ ok: false, error: "Coin miqdori noto'g'ri" }, 400);
        const { data: pl } = await sb.from("coco_players").select("pid, name").eq("pid", pid).maybeSingle();
        if (!pl) return out({ ok: false, error: "Bunday ID li o'yinchi yo'q" }, 404);
        const { error } = await sb.from("coco_grants").insert({ pid, amount, note: str(d.note, 80) });
        if (error) throw error;
        return out({ ok: true, name: pl.name });
      }
      case "admin_grant_all": {
        if (!(await isAdmin(d.token))) return denied();
        const amount = Number(d.amount);
        if (!Number.isFinite(amount) || amount === 0 || Math.abs(amount) > 1e18) return out({ ok: false, error: "Coin miqdori noto'g'ri" }, 400);
        const { data: n, error } = await sb.rpc("coco_grant_all", { p_amount: amount, p_note: str(d.note, 80) });
        if (error) throw error;
        return out({ ok: true, count: n });
      }
      case "admin_ban": {
        if (!(await isAdmin(d.token))) return denied();
        const pid = str(d.pid, 10);
        if (!/^\d{6}$/.test(pid)) return out({ ok: false, error: "ID noto'g'ri" }, 400);
        const upd: Record<string, unknown> = { banned: !!d.banned };
        if (!d.banned) upd.flags = 0;
        const { error } = await sb.from("coco_players").update(upd).eq("pid", pid);
        if (error) throw error;
        return out({ ok: true });
      }
      case "admin_event": {
        if (!(await isAdmin(d.token))) return denied();
        const mult = Math.max(1, Math.min(10, Number(d.mult) || 1)), minutes = Math.max(0, Math.min(7 * 24 * 60, Number(d.minutes) || 0));
        const ev = mult > 1 && minutes > 0 ? { mult, until: Date.now() + minutes * 60000, title: str(d.title, 60) || `x${mult} coin!` } : { mult: 1, until: 0 };
        await setSetting("event", ev);
        return out({ ok: true, event: activeEvent({ event: ev }) });
      }
      case "admin_announce": {
        if (!(await isAdmin(d.token))) return denied();
        const text = str(d.text, 200);
        const v = text ? { id: Date.now(), text } : { id: 0, text: "" };
        await setSetting("announce", v);
        return out({ ok: true, announce: v });
      }
    }
    return out({ ok: false, error: "action" }, 400);
  } catch (e) {
    console.error(e);
    return out({ ok: false, error: "Server xatosi" }, 500);
  }
});
