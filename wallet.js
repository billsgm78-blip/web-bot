// Точный URL бэкенда Railway
const API_BASE_URL = "https://ai2-production-80d2.up.railway.app";

// Конфигурация тарифов
const STARS_PACKS = [
    { stars: 50, price: 15000 },
    { stars: 100, price: 29000 },
    { stars: 250, price: 70000 },
    { stars: 500, price: 135000 },
    { stars: 1000, price: 260000 }
];

const PREMIUM_PACKS = [
    { months: 3, price: 160000 },
    { months: 6, price: 240000 },
    { months: 12, price: 390000 }
];

// Функция получения баланса по номеру телефона
async function getBalance(phone) {
    const cleanPhone = phone.replace(/[^0-9]/g, "");
    try {
        const response = await fetch(`${API_BASE_URL}/api/balance?phone=${cleanPhone}`);
        
        if (!response.ok) {
            throw new Error(`Server xatosi: ${response.status}`);
        }

        const data = await response.json();
        return data.balance || 0;
    } catch (err) {
        console.error("Balansni olishda xatolik:", err);
        throw err;
    }
}

// Функция пополнения / изменения баланса
async function updateBalance(phone, amount) {
    const cleanPhone = phone.replace(/[^0-9]/g, "");
    try {
        const response = await fetch(`${API_BASE_URL}/api/add-balance`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                phone: cleanPhone,
                amount: Number(amount)
            })
        });

        if (!response.ok) {
            throw new Error(`Server xatosi: ${response.status}`);
        }

        const data = await response.json();
        return data;
    } catch (err) {
        console.error("Balansni o'zgartirishda xatolik:", err);
        throw err;
    }
}

// Инициализация при нажатии кнопки "Boshlash"
document.addEventListener("DOMContentLoaded", () => {
    const startBtn = document.getElementById("start-btn") || document.querySelector(".start-btn");
    const phoneInput = document.getElementById("phone-input");
    const resultBox = document.getElementById("result-box");

    if (startBtn) {
        startBtn.addEventListener("click", async () => {
            const phone = phoneInput ? phoneInput.value.trim() : "";
            
            if (!phone) {
                if (resultBox) resultBox.innerText = "Iltimos, telefon raqamingizni kiriting!";
                return;
            }

            if (resultBox) resultBox.innerText = "Yuklanmoqda... ⏳";

            try {
                const balance = await getBalance(phone);
                if (resultBox) {
                    resultBox.innerText = `Sizning balansingiz: ${balance.toLocaleString()} so'm`;
                }
            } catch (error) {
                if (resultBox) {
                    resultBox.innerText = `Xatolik: Serverga ulanib bo'lmadi (${error.message})`;
                }
            }
        });
    }
});
