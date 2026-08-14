import { Bot, InlineKeyboard } from "grammy";
import * as dotenv from "dotenv";
import { query } from "./db";

dotenv.config();

const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
  console.error("❌ ERROR: No se encontró el TELEGRAM_BOT_TOKEN en el archivo .env");
  process.exit(1);
}

const bot = new Bot(token);

// URL de tu sitio web oficial (cambiala por la tuya)
const WEB_URL = "https://tu-casino-web.com"; 

// Comando /start informativo
bot.command("start", async (ctx) => {
  const telegramId = ctx.from?.id;
  const username = ctx.from?.username || null;
  const firstName = ctx.from?.first_name || "Jugador";

  if (!telegramId) return;

  try {
    // Mantenemos el registro en la base de datos si el usuario es nuevo
    await query(
      `INSERT INTO users (telegram_id, username, first_name)
       VALUES ($1, $2, $3)
       ON CONFLICT (telegram_id) DO NOTHING`,
      [telegramId, username, firstName]
    );

    const webKeyboard = new InlineKeyboard()
      .url("🌐 Ir a la Web Oficial", WEB_URL);

    await ctx.reply(
      `¡Hola **${firstName}**! 👋\n\n` +
      `🎰 **Bienvenido a nuestro Casino** 🎰\n\n` +
      `Te informamos que hemos trasladado toda la experiencia de juego, depósitos y retiros directamente a nuestra plataforma web para mayor velocidad y seguridad.\n\n` +
      `🔗 Haz clic en el botón de abajo para ingresar a la web y empezar a jugar:`,
      { reply_markup: webKeyboard, parse_mode: "Markdown" }
    );

  } catch (error) {
    console.error("❌ Error DB en /start:", error);
    await ctx.reply("⚠️ Error al conectar con tu perfil.");
  }
});

// Mensaje general para cualquier texto que envíen al bot
bot.on("message:text", async (ctx) => {
  const webKeyboard = new InlineKeyboard()
    .url("🌐 Ir a la Web Oficial", WEB_URL);

  await ctx.reply(
    "💬 Todos nuestros juegos y la gestión de tu saldo se encuentran disponibles exclusivamente en nuestra web oficial.",
    { reply_markup: webKeyboard }
  );
});

// Iniciar el bot usando grammy
bot.start();
console.log("🤖 Bot de Telegram iniciado en modo informativo.");