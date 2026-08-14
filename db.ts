import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

// Configuración profesional con soporte SSL para Render (producción)
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' || process.env.DATABASE_URL?.includes('render.com')
    ? { rejectUnauthorized: false }
    : false,
});

export const query = (text: string, params?: any[]) => pool.query(text, params);

// Función profesional para inicializar y verificar las tablas automáticamente al arrancar
async function initDB() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          username VARCHAR(50) UNIQUE NOT NULL,
          password VARCHAR(255) NOT NULL,
          balance NUMERIC(12, 2) DEFAULT 0.00 NOT NULL CHECK (balance >= 0),
          bonus_balance NUMERIC(12, 2) DEFAULT 5.00 NOT NULL CHECK (bonus_balance >= 0),
          received_promo_bonus BOOLEAN DEFAULT TRUE NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS deposits (
          id SERIAL PRIMARY KEY,
          user_id INT REFERENCES users(id) ON DELETE CASCADE,
          amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 10.00),
          status VARCHAR(20) DEFAULT 'pending' NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS withdrawals (
          id SERIAL PRIMARY KEY,
          user_id INT REFERENCES users(id) ON DELETE CASCADE,
          amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 25.00),
          status VARCHAR(20) DEFAULT 'pending' NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS bets (
          id SERIAL PRIMARY KEY,
          user_id INT REFERENCES users(id) ON DELETE CASCADE,
          game_name VARCHAR(50) NOT NULL,
          bet_amount NUMERIC(12, 2) NOT NULL,
          win_amount NUMERIC(12, 2) DEFAULT 0.00 NOT NULL,
          result VARCHAR(20) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("✅ Base de datos inicializada: Tablas verificadas o creadas correctamente.");
  } catch (error) {
    console.error("❌ Error al inicializar las tablas en la base de datos:", error);
  }
}

// Ejecutar la inicialización al arrancar el módulo
initDB();