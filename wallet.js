(function () {
  const API_URL = window.WALLET_API || "https://ai2-production-80d2.up.railway.app";

  // ==========================================
  // 👇 BU YERDAN NARXLARNI SOZLASHINGIZ MUMKIN:
  // ==========================================
  const NARXLAR = {
    stars50: 15000,       // 50 Stars narxi (so'mda)
    stars100: 28000,      // 100 Stars narxi (so'mda)
    stars250: 65000,      // 250 Stars narxi (so'mda)
    premium1oy: 45000     // 1 Oylik Telegram Premium narxi (so'mda)
  };

  const style = document.createElement("style");
  style.innerHTML = `
    .wallet-modal-overlay {
      position: fixed; inset: 0; z-index: 999999;
      background: rgba(11, 6, 32, 0.82);
      backdrop-filter: blur(12px);
      display: flex; align-items: center; justify-content: center;
      padding: 14px; opacity: 0; pointer-events: none;
      transition: all 0.3s ease;
    }
    .wallet-modal-overlay.active {
      opacity: 1; pointer-events: auto;
    }
    .wallet-card {
      background: #150C33;
      border: 1px solid rgba(255, 209, 102, 0.35);
      width: 100%; max-width: 410px;
      max-height: 90vh; overflow-y: auto;
      border-radius: 24px; padding: 22px;
      box-shadow: 0 20px 50px rgba(0,0,0,0.7);
      color: #F4F1FF; font-family: 'Manrope', sans-serif;
      text-align: center; position: relative;
    }
    .wallet-close-btn {
      position: absolute; top: 16px; right: 16px;
      background: rgba(255,255,255,0.08); border: none;
      width: 32px; height: 32px; border-radius: 50%;
      color: #fff; cursor: pointer; font-size: 16px;
      display: flex; align-items: center; justify-content: center;
    }
    .wallet-badge {
      display: inline-block; padding: 4px 12px;
      background: rgba(255, 209, 102, 0.15); border-radius: 20px;
      color: #FFD166; font-size: 0.8rem; font-weight: 700; margin-bottom: 8px;
    }
    .wallet-val {
      font-size: 2rem; font-weight: 800;
      color: #fff; font-family: 'Sora', sans-serif; margin-bottom: 4px;
    }
    .wallet-user-phone {
      color: #A79EC9; font-size: 0.85rem; margin-bottom: 16px;
    }
    .wallet-section-title {
      font-size: 0.95rem; font-weight: 700; color: #45F0C4;
      text-align: left; margin: 16px 0 10px 0; font-family: 'Sora', sans-serif;
    }
    .exchange-grid {
      display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 12px;
    }
    .exchange-card {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 14px; padding: 12px; text-align: center;
      cursor: pointer; transition: all 0.2s ease;
    }
    .exchange-card:hover {
      background: rgba(255, 255, 255, 0.1);
      border-color: #FFD166; transform: translateY(-2px);
    }
    .exchange-card.full-width {
      grid-column: span 2;
      background: linear-gradient(135deg, rgba(155, 107, 255, 0.15), rgba(69, 240, 196, 0.15));
      border: 1px solid rgba(155, 107, 255, 0.4);
    }
    .card-icon { font-size: 1.4rem; margin-bottom: 4px; }
    .card-title { font-size: 0.9rem; font-weight: 700; color: #fff; }
    .card-price { font-size: 0.8rem; color: #FFD166; font-weight: 600; margin-top: 4px; }

    .wallet-action-btn {
      width: 100%;
      background: linear-gradient(135deg, #45F0C4, #9B6BFF);
      color: #0B0620; font-weight: 700; padding: 12px;
      border: none; border-radius: 14px; cursor: pointer; font-size: 0.9rem;
      margin-top: 8px;
    }
    .wallet-info-box {
      background: rgba(255,255,255,0.05); padding: 10px;
      border-radius: 12px; font-size: 0.78rem; color: #A79EC9;
      margin-top: 14px; line-height: 1.4;
    }
  `;
  document.head.appendChild(style);

  const modal = document.createElement("div");
  modal.className = "wallet-modal-overlay";
  modal.id = "walletModal";
  modal.innerHTML = `
    <div class="wallet-card">
      <button class="wallet-close-btn" id="closeWalletModal">✕</button>
      <span class="wallet-badge">HAMYON BALANSI</span>
      <div class="wallet-val" id="modalBalanceDisplay">0 so'm</div>
      <div class="wallet-user-phone" id="modalUserPhone">-</div>
      
      <div class="wallet-section-title">⭐ Stars & Premium Almashtirish</div>
      
      <div class="exchange-grid">
        <div class="exchange-card" onclick="window.exchangeItem('50 Telegram Stars', ${NARXLAR.stars50})">
          <div class="card-icon">⭐</div>
          <div class="card-title">50 Stars</div>
          <div class="card-price">${NARXLAR.stars50.toLocaleString()} so'm</div>
        </div>

        <div class="exchange-card" onclick="window.exchangeItem('100 Telegram Stars', ${NARXLAR.stars100})">
          <div class="card-icon">⭐</div>
          <div class="card-title">100 Stars</div>
          <div class="card-price">${NARXLAR.stars100.toLocaleString()} so'm</div>
        </div>

        <div class="exchange-card" onclick="window.exchangeItem('250 Telegram Stars', ${NARXLAR.stars250})">
          <div class="card-icon">🌟</div>
          <div class="card-title">250 Stars</div>
          <div class="card-price">${NARXLAR.stars250.toLocaleString()} so'm</div>
        </div>

        <div class="exchange-card full-width" onclick="window.exchangeItem('1 Oylik Telegram Premium', ${NARXLAR.premium1oy})">
          <div class="card-icon">👑</div>
          <div class="card-title">1 Oylik Telegram Premium</div>
          <div class="card-price">${NARXLAR.premium1oy.toLocaleString()} so'm</div>
        </div>
      </div>

      <button class="wallet-action-btn" id="refreshBalanceBtn">🔄 Balansni yangilash</button>

      <div class="wallet-info-box">
        💡 Hisobingizda yetarli mablag' bo'lsa xarid qiling va bot orqali adminga murojaat qiling.
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  let userBalance = 0;

  async function fetchBalance() {
    const phone = localStorage.getItem("web_user_phone");
    if (!phone) return;

    const cleanPhone = phone.replace("+", "").trim();
    document.getElementById("modalUserPhone").textContent = "+" + cleanPhone;

    try {
      const res = await fetch(`${API_URL}/api/balance?phone=${cleanPhone}`);
      const data = await res.json();
      userBalance = data.balance || 0;
      const formatted = Number(userBalance).toLocaleString("uz-UZ") + " so'm";
      document.getElementById("modalBalanceDisplay").textContent = formatted;
      const navText = document.getElementById("walletBalanceText");
      if (navText) navText.textContent = formatted;
    } catch (err) {
      console.log("Balansni yuklab bo'lmadi:", err);
    }
  }

  // Almashtirish tugmasi bosilgandagi harakat
  window.exchangeItem = function (nomi, narxi) {
    if (userBalance < narxi) {
      alert(`Mablag'ingiz yetarli emas!\n\nKerakli summa: ${narxi.toLocaleString()} so'm\nSizning balansingiz: ${userBalance.toLocaleString()} so'm`);
      return;
    }

    const tasdiq = confirm(`${nomi} mahsulotini sotib olishni tasdiqlaysizmi?\nNarxi: ${narxi.toLocaleString()} so'm`);
    if (tasdiq) {
      alert(`Buyurtma qabul qilindi! Iltimos, Telegram bot orqali /admin ga yozing:\n"Men ${nomi} sotib olmoqchiman".`);
    }
  };

  window.openWalletModal = function () {
    modal.classList.add("active");
    fetchBalance();
  };

  document.getElementById("closeWalletModal").addEventListener("click", () => {
    modal.classList.remove("active");
  });

  modal.addEventListener("click", (e) => {
    if (e.target === modal) modal.classList.remove("active");
  });

  document.getElementById("refreshBalanceBtn").addEventListener("click", fetchBalance);
  fetchBalance();
})();
