"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const grammy_1 = require("grammy");
const dotenv = __importStar(require("dotenv"));
const db_1 = require("./db");
dotenv.config();
const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
    console.error("❌ ERROR: No se encontró el TELEGRAM_BOT_TOKEN en el archivo .env");
    process.exit(1);
}
const bot = new grammy_1.Bot(token);
// URL de tu sitio web oficial (cambiala por la tuya)
const WEB_URL = "https://tu-casino-web.com";
// Comando /start informativo
bot.command("start", async (ctx) => {
    const telegramId = ctx.from?.id;
    const username = ctx.from?.username || null;
    const firstName = ctx.from?.first_name || "Jugador";
    if (!telegramId)
        return;
    try {
        // Mantenemos el registro en la base de datos si el usuario es nuevo
        await (0, db_1.query)(`INSERT INTO users (telegram_id, username, first_name)
       VALUES ($1, $2, $3)
       ON CONFLICT (telegram_id) DO NOTHING`, [telegramId, username, firstName]);
        const webKeyboard = new grammy_1.InlineKeyboard()
            .url("🌐 Ir a la Web Oficial", WEB_URL);
        await ctx.reply(`¡Hola **${firstName}**! 👋\n\n` +
            `🎰 **Bienvenido a nuestro Casino** 🎰\n\n` +
            `Te informamos que hemos trasladado toda la experiencia de juego, depósitos y retiros directamente a nuestra plataforma web para mayor velocidad y seguridad.\n\n` +
            `🔗 Haz clic en el botón de abajo para ingresar a la web y empezar a jugar:`, { reply_markup: webKeyboard, parse_mode: "Markdown" });
    }
    catch (error) {
        console.error("❌ Error DB en /start:", error);
        await ctx.reply("⚠️ Error al conectar con tu perfil.");
    }
});
// Mensaje general para cualquier texto que envíen al bot
bot.on("message:text", async (ctx) => {
    const webKeyboard = new grammy_1.InlineKeyboard()
        .url("🌐 Ir a la Web Oficial", WEB_URL);
    await ctx.reply("💬 Todos nuestros juegos y la gestión de tu saldo se encuentran disponibles exclusivamente en nuestra web oficial.", { reply_markup: webKeyboard });
});
// Iniciar el bot usando grammy
bot.start();
console.log("🤖 Bot de Telegram iniciado en modo informativo.");
