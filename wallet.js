(function () {
  const API_URL = window.WALLET_API || "https://ai2-production-80d2.up.railway.app";

  // Modal oyna uchun CSS stillari
  const style = document.createElement("style");
  style.innerHTML = `
    .wallet-modal-overlay {
      position: fixed; inset: 0; z-index: 999999;
      background: rgba(11, 6, 32, 0.75);
      backdrop-filter: blur(10px);
      display: flex; align-items: center; justify-content: center;
      padding: 16px; opacity: 0; pointer-events: none;
      transition: all 0.3s ease;
    }
    .wallet-modal-overlay.active {
      opacity: 1; pointer-events: auto;
    }
    .wallet-card {
      background: #150C33;
      border: 1px solid rgba(255, 209, 102, 0.3);
      width: 100%; max-width: 380px;
      border-radius: 24px; padding: 24px;
      box-shadow: 0 20px 50px rgba(0,0,0,0.6);
      transform: translateY(20px); transition: transform 0.3s ease;
      color: #F4F1FF; font-family: 'Manrope', sans-serif;
      text-align: center; position: relative;
    }
    .wallet-modal-overlay.active .wallet-card {
      transform: translateY(0);
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
      color: #FFD166; font-size: 0.8rem; font-weight: 700; margin-bottom: 12px;
    }
    .wallet-val {
      font-size: 2.2rem; font-weight: 800;
      color: #fff; font-family: 'Sora', sans-serif; margin-bottom: 6px;
    }
    .wallet-user-phone {
      color: #A79EC9; font-size: 0.85rem; margin-bottom: 20px;
    }
    .wallet-actions {
      display: flex; flex-direction: column; gap: 10px; margin-top: 15px;
    }
    .wallet-action-btn {
      background: linear-gradient(135deg, #45F0C4, #9B6BFF);
      color: #0B0620; font-weight: 700; padding: 13px;
      border: none; border-radius: 14px; cursor: pointer; font-size: 0.95rem;
    }
    .wallet-info-box {
      background: rgba(255,255,255,0.05); padding: 12px;
      border-radius: 12px; font-size: 0.8rem; color: #A79EC9;
      margin-top: 15px; line-height: 1.4;
    }
  `;
  document.head.appendChild(style);

  // Modal oynaning HTML tuzilishi
  const modal = document.createElement("div");
  modal.className = "wallet-modal-overlay";
  modal.id = "walletModal";
  modal.innerHTML = `
    <div class="wallet-card">
      <button class="wallet-close-btn" id="closeWalletModal">✕</button>
      <span class="wallet-badge">HAMYON BALANSI</span>
      <div class="wallet-val" id="modalBalanceDisplay">0 so'm</div>
      <div class="wallet-user-phone" id="modalUserPhone">-</div>
      
      <div class="wallet-actions">
        <button class="wallet-action-btn" id="refreshBalanceBtn">🔄 Balansni yangilash</button>
      </div>

      <div class="wallet-info-box">
        💡 Hisobni to'ldirish uchun Telegram botingizga kiring va <b>/pul 10000</b> deb yuboring.
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  // Pul tushganda chalinadigan musiqa/tovush
  function playCoinSound() {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(987.77, audioCtx.currentTime); // B5 notasi
      osc.frequency.setValueAtTime(1318.51, audioCtx.currentTime + 0.1); // E6 notasi
      gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.5);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.5);
    } catch (e) {}
  }

  let currentBalance = null;

  // Serverdan balansni olish
  async function fetchBalance() {
    const phone = localStorage.getItem("web_user_phone");
    if (!phone) return;

    const cleanPhone = phone.replace("+", "").trim();
    document.getElementById("modalUserPhone").textContent = "+" + cleanPhone;

    try {
      const res = await fetch(`${API_URL}/api/balance?phone=${cleanPhone}`);
      const data = await res.json();
      
      const bal = data.balance !== undefined ? data.balance : (data.amount || 0);
      const formatted = Number(bal).toLocaleString("uz-UZ") + " so'm";
      
      // Agar avvalgi balansdan ko'paygan bo'lsa ovoz chaladi
      if (currentBalance !== null && bal > currentBalance) {
        playCoinSound();
      }
      currentBalance = bal;

      document.getElementById("modalBalanceDisplay").textContent = formatted;
      const navText = document.getElementById("walletBalanceText");
      if (navText) navText.textContent = formatted;
    } catch (err) {
      console.log("Balansni yuklab bo'lmadi:", err);
    }
  }

  // Oynani ochish va yopish
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

  // Sahifa ochilganda balansni birinchi marta olib qo'yish
  fetchBalance();
  // Har 7 soniyada balansni avtomatik tekshirib turish
  setInterval(fetchBalance, 7000);
})();
