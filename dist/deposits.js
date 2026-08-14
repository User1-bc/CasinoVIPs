"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startDepositChecker = startDepositChecker;
const axios_1 = __importDefault(require("axios"));
const db_1 = require("./db");
// Contrato oficial de USDT en TRON (TRC20)
const USDT_CONTRACT = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
function startDepositChecker(bot) {
    // Escanear la blockchain cada 20 segundos de forma optimizada
    setInterval(async () => {
        try {
            const wallet = process.env.CASINO_TRON_WALLET;
            const apiKey = process.env.TRON_API_KEY;
            if (!wallet || wallet.includes("TU_DIRECCION"))
                return;
            // Consultar las últimas transferencias TRC20 hacia la billetera del casino
            const url = `https://api.trongrid.io/v1/accounts/${wallet}/transactions/trc20?contract_address=${USDT_CONTRACT}&limit=30`;
            const response = await axios_1.default.get(url, {
                headers: { "TRON-PRO-API-KEY": apiKey || "" }
            });
            const transactions = response.data?.data || [];
            for (const tx of transactions) {
                // Verificar obligatoriamente que la transferencia sea entrante (hacia nuestra wallet)
                if (tx.to !== wallet)
                    continue;
                const txHash = tx.transaction_id;
                const rawAmount = parseFloat(tx.value) / 1000000; // Convertir valor real de USDT
                // 1. Verificar si el hash de la transacción ya fue registrado en la base de datos
                const existingTx = await (0, db_1.query)("SELECT id FROM transactions WHERE tx_hash = $1", [txHash]);
                if (existingTx.rows.length > 0)
                    continue;
                // 2. Validar regla de negocio: Depósito mínimo de $10 USDT
                if (rawAmount < 10)
                    continue;
                // 3. Buscar una orden pendiente que coincida exactamente con el monto y que esté activa (ej. creada en menos de 1 hora)
                const pendingRes = await (0, db_1.query)(`SELECT id, telegram_id FROM pending_deposits 
           WHERE amount = $1 AND status = 'pending' AND created_at > NOW() - INTERVAL '1 hour' 
           LIMIT 1`, [rawAmount]);
                if (pendingRes.rows.length === 0) {
                    // Si no hay orden con ese monto exacto, se registra como huérfana para auditoría manual del admin
                    console.warn(`⚠️ [Depósito Huérfano] Monto: $${rawAmount} USDT | Hash: ${txHash}`);
                    continue;
                }
                const depositOrderId = pendingRes.rows[0].id;
                const telegramId = pendingRes.rows[0].telegram_id;
                // 4. Calcular bono profesional (Ej: 50% si deposita $50 o más)
                let bonus = 0;
                if (rawAmount >= 50) {
                    bonus = rawAmount * 0.5;
                }
                // 5. EJECUTAR TRANSACCIÓN SEGURA EN LA BASE DE DATOS (ACID)
                // Usamos una secuencia para asegurar consistencia total en los saldos
                await (0, db_1.query)("BEGIN");
                try {
                    // Registrar la transacción oficial
                    await (0, db_1.query)("INSERT INTO transactions (tx_hash, telegram_id, amount, bonus_amount) VALUES ($1, $2, $3, $4)", [txHash, telegramId, rawAmount, bonus]);
                    // Acreditar el balance real y el bono al usuario correspondiente
                    await (0, db_1.query)("UPDATE users SET balance = balance + $1, bonus_balance = bonus_balance + $2 WHERE telegram_id = $3", [rawAmount, bonus, telegramId]);
                    // Marcar la orden pendiente como completada
                    await (0, db_1.query)("UPDATE pending_deposits SET status = 'completed' WHERE id = $1", [depositOrderId]);
                    await (0, db_1.query)("COMMIT");
                    console.log(`✅ [Depósito Exitoso] Usuario: ${telegramId} | Monto: $${rawAmount} USDT | Bono: $${bonus} USDT | Hash: ${txHash}`);
                    // 6. Notificar al usuario de forma elegante por Telegram
                    try {
                        await bot.api.sendMessage(telegramId, `🎉 **¡DEPÓSITO ACREDITADO CON ÉXITO!** 🎉\n\n` +
                            `💵 **Monto Recibido:** $${rawAmount.toFixed(2)} USDT\n` +
                            `🎁 **Bono de Casino:** $${bonus.toFixed(2)} USDT\n\n` +
                            `¡Tus fondos ya están disponibles para jugar en el casino! 🎰`, { parse_mode: "Markdown" });
                    }
                    catch (notifErr) {
                        console.error(`Error al enviar notificación de Telegram al usuario ${telegramId}:`, notifErr);
                    }
                }
                catch (dbError) {
                    await (0, db_1.query)("ROLLBACK");
                    console.error("❌ Error crítico aplicando la transacción en la base de datos:", dbError);
                }
            }
        }
        catch (error) {
            console.error("⚠️ Error de conexión consultando la red TRON en TronGrid:", error);
        }
    }, 20000); // Escanea cada 20 segundos
}
