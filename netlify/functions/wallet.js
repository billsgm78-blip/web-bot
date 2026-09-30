"""
Hamyon: balans (sqlite) + mini app uchun API + admin /pul buyrug'i.
  /pul <telegram_id> <miqdor>   (faqat admin)
"""
import hashlib
import hmac
import json
import logging
import os
import sqlite3
import time
from urllib.parse import parse_qsl

from aiohttp import web
from telegram import Update
from telegram.ext import ContextTypes

from config import BOT_TOKEN, ADMIN_CHAT_ID

log = logging.getLogger(__name__)

# Railway'da Volume ulab, WALLET_DB=/data/wallet.db qo'ying, aks holda deploy'da balans o'chadi
DB = os.getenv("WALLET_DB", "wallet.db")

# Sovg'alar va narxlari (UZS, o'yinchoq pul). Shu yerdan o'zgartiring.
GIFTS = [
    {"id": "gift15", "icon": "🧸", "title": "Telegram sovg'a — 15 ⭐", "price": 15000},
    {"id": "gift24", "icon": "🎁", "title": "Telegram sovg'a — 24 ⭐", "price": 24000},
    {"id": "premium1", "icon": "💎", "title": "Telegram Premium — 1 oy", "price": 200000},
]


# ---------- Baza ----------
def _db():
    con = sqlite3.connect(DB)
    con.execute("CREATE TABLE IF NOT EXISTS wallet(user_id INTEGER PRIMARY KEY, balance INTEGER NOT NULL DEFAULT 0)")
    return con


def get_balance(uid: int) -> int:
    with _db() as c:
        r = c.execute("SELECT balance FROM wallet WHERE user_id=?", (uid,)).fetchone()
    return r[0] if r else 0


def add_balance(uid: int, amount: int) -> int:
    with _db() as c:
        c.execute(
            "INSERT INTO wallet(user_id, balance) VALUES(?, MAX(?, 0)) "
            "ON CONFLICT(user_id) DO UPDATE SET balance = MAX(balance + ?, 0)",
            (uid, amount, amount),
        )
    return get_balance(uid)


def spend(uid: int, price: int) -> bool:
    with _db() as c:
        cur = c.execute(
            "UPDATE wallet SET balance = balance - ? WHERE user_id=? AND balance >= ?",
            (price, uid, price),
        )
        return cur.rowcount == 1


# ---------- Telegram initData tekshiruvi (soxta so'rovlardan himoya) ----------
def verify(init_data: str):
    try:
        data = dict(parse_qsl(init_data, keep_blank_values=True))
        got_hash = data.pop("hash", "")
        check = "\n".join(f"{k}={v}" for k, v in sorted(data.items()))
        secret = hmac.new(b"WebAppData", BOT_TOKEN.encode(), hashlib.sha256).digest()
        calc = hmac.new(secret, check.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(calc, got_hash):
            return None
        if time.time() - int(data.get("auth_date", 0)) > 86400:
            return None
        return json.loads(data["user"])
    except Exception:
        return None


# ---------- API ----------
async def _body(request):
    try:
        return json.loads(await request.text())
    except Exception:
        return {}


async def state(request):
    user = verify((await _body(request)).get("initData", ""))
    if not user:
        return web.json_response({"error": "Ruxsat yo'q"}, status=401)
    return web.json_response({"balance": get_balance(user["id"]), "gifts": GIFTS})


async def redeem(request):
    data = await _body(request)
    user = verify(data.get("initData", ""))
    if not user:
        return web.json_response({"error": "Ruxsat yo'q"}, status=401)

    gift = next((g for g in GIFTS if g["id"] == data.get("gift_id")), None)
    if not gift:
        return web.json_response({"error": "Sovg'a topilmadi"}, status=404)
    if not spend(user["id"], gift["price"]):
        return web.json_response({"error": "Balans yetarli emas"}, status=400)

    try:
        await request.app["bot"].send_message(
            chat_id=ADMIN_CHAT_ID,
            text=(
                f"🎁 Sovg'a so'rovi!\n"
                f"Foydalanuvchi: {user.get('first_name', '')} (@{user.get('username', '-')})\n"
                f"Telegram ID: {user['id']}\n"
                f"Sovg'a: {gift['title']}\n"
                f"Narxi: {gift['price']:,} UZS"
            ),
        )
    except Exception:
        log.exception("Adminga sovg'a so'rovi yuborilmadi — pul qaytarildi")
        add_balance(user["id"], gift["price"])
        return web.json_response({"error": "Server xatosi, qayta urinib ko'ring"}, status=500)

    return web.json_response({"balance": get_balance(user["id"])})


@web.middleware
async def cors(request, handler):
    resp = web.Response(status=204) if request.method == "OPTIONS" else await handler(request)
    resp.headers["Access-Control-Allow-Origin"] = "*"
    resp.headers["Access-Control-Allow-Headers"] = "*"
    resp.headers["Access-Control-Allow-Methods"] = "POST, OPTIONS"
    return resp


async def start_api(bot):
    app = web.Application(middlewares=[cors])
    app["bot"] = bot
    app.router.add_get("/", lambda r: web.Response(text="ok"))
    app.router.add_post("/api/state", state)
    app.router.add_post("/api/redeem", redeem)
    runner = web.AppRunner(app)
    await runner.setup()
    await web.TCPSite(runner, "0.0.0.0", int(os.getenv("PORT", "8080"))).start()
    log.info("Wallet API ishga tushdi")


# ---------- /pul (faqat admin) ----------
async def pul_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not ADMIN_CHAT_ID or str(update.effective_chat.id) != str(ADMIN_CHAT_ID):
        return

    a = context.args
    if len(a) != 2 or not all(x.lstrip("-").isdigit() for x in a):
        await update.message.reply_text("Foydalanish: /pul <telegram_id> <miqdor>\nMasalan: /pul 123456789 5000")
        return

    uid, amount = int(a[0]), int(a[1])
    bal = add_balance(uid, amount)
    await update.message.reply_text(f"✅ {uid}: {amount:+,} UZS\nBalans: {bal:,} UZS")
    try:
        await context.bot.send_message(uid, f"💰 Hisobingizga {amount:+,} UZS qo'shildi.\nBalans: {bal:,} UZS")
    except Exception:
        await update.message.reply_text("(Foydalanuvchiga xabar yuborib bo'lmadi)")
