const path = require('path');
const express = require('express');
const cors = require('cors');
const { query } = require('./db'); // Tu archivo de conexión a PostgreSQL
const bcrypt = require('bcrypt');
const app = express();

app.use(cors());
app.use(express.json());
// Para servir los archivos estáticos de tu web (HTML, CSS, imágenes)
app.use(express.static(path.join(__dirname, 'public')));

// RUTA DE REGISTRO MEJORADA
app.post('/api/register', async (req, res) => {
    const { username, password } = req.body;
    try {
        // Verificar si el usuario ya existe
        const userExists = await query("SELECT * FROM users WHERE username = $1", [username]);
        if (userExists.rows.length > 0) {
            return res.status(400).json({ error: "El nombre de usuario ya está en uso." });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Inserta el usuario con 0.00 en balance y 5.00 en bonus_balance por primera vez
        const insertRes = await query(
            `INSERT INTO users (username, password, balance, bonus_balance, received_promo_bonus)
             VALUES ($1, $2, $3, $4, TRUE) RETURNING *`,
            [username, hashedPassword, 0.00, 5.00] 
        );

        res.status(201).json({ 
            message: "Usuario registrado con bono", 
            user: insertRes.rows[0] 
        });
    } catch (error) {
        res.status(500).json({ error: "Error al registrar: " + error.message });
    }
});

// RUTA PARA INICIAR SESIÓN (Lo que llama tu HTML)
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const userRes = await query("SELECT * FROM users WHERE username = $1", [username]);
        
        if (userRes.rows.length > 0) {
            const user = userRes.rows[0];
            const valid = await bcrypt.compare(password, user.password);
            if (valid) {
                return res.json({ 
                    success: true, 
                    username: user.username,
                    balance: user.balance, 
                    bonus_balance: user.bonus_balance 
                });
            }
        }
        res.status(401).json({ error: "Credenciales incorrectas" });
    } catch (error) {
        res.status(500).json({ error: "Error en el servidor: " + error.message });
    }
});

// RUTA PARA ACTUALIZAR SALDOS DESPUÉS DE UNA JUGADA (PERSISTENCIA REAL)
app.post('/api/update-balance', async (req, res) => {
    const { username, balance, bonus_balance } = req.body;

    try {
        const updateRes = await query(
            `UPDATE users SET balance = $1, bonus_balance = $2 WHERE username = $3 RETURNING username, balance, bonus_balance`,
            [balance, bonus_balance, username]
        );

        if (updateRes.rows.length === 0) {
            return res.status(404).json({ error: "Usuario no encontrado" });
        }

        res.json({
            success: true,
            message: "Saldos actualizados correctamente",
            user: updateRes.rows[0]
        });
    } catch (error) {
        res.status(500).json({ error: "Error en el servidor: " + error.message });
    }
});

// RUTA DE DEPÓSITO (Mínimo 10 USDT)
app.post('/api/deposit', async (req, res) => {
    const { username, amount } = req.body;

    if (amount < 10.00) {
        return res.status(400).json({ error: "El monto mínimo de depósito es de 10.00 USDT" });
    }

    try {
        const userCheck = await query("SELECT id FROM users WHERE username = $1", [username]);
        if (userCheck.rows.length === 0) {
            return res.status(404).json({ error: "Usuario no encontrado" });
        }
        const userId = userCheck.rows[0].id;

        // Registrar el depósito y sumar al balance
        await query(
            `INSERT INTO deposits (user_id, amount, status) VALUES ($1, $2, 'completed')`,
            [userId, amount]
        );

        const updateRes = await query(
            `UPDATE users SET balance = balance + $1 WHERE id = $2 RETURNING username, balance, bonus_balance`,
            [amount, userId]
        );

        res.json({
            success: true,
            message: `Depósito de ${amount} USDT acreditado correctamente.`,
            user: updateRes.rows[0]
        });
    } catch (error) {
        res.status(500).json({ error: "Error en el servidor: " + error.message });
    }
});

// RUTA DE RETIRO (Mínimo 25 USDT)
app.post('/api/withdraw', async (req, res) => {
    const { username, amount } = req.body;

    if (amount < 25.00) {
        return res.status(400).json({ error: "El monto mínimo de retiro es de 25.00 USDT" });
    }

    try {
        const userRes = await query("SELECT * FROM users WHERE username = $1", [username]);
        if (userRes.rows.length === 0) {
            return res.status(404).json({ error: "Usuario no encontrado" });
        }

        const user = userRes.rows[0];
        if (Number(user.balance) < Number(amount)) {
            return res.status(400).json({ error: "Saldo insuficiente para realizar el retiro" });
        }

        // Registrar solicitud y descontar del balance
        await query(
            `INSERT INTO withdrawals (user_id, amount, status) VALUES ($1, $2, 'pending')`,
            [user.id, amount]
        );

        const updateRes = await query(
            `UPDATE users SET balance = balance - $1 WHERE id = $2 RETURNING username, balance`,
            [amount, user.id]
        );

        res.json({
            success: true,
            message: "Solicitud de retiro creada con éxito (Pendiente de aprobación).",
            user: updateRes.rows[0]
        });
    } catch (error) {
        res.status(500).json({ error: "Error en el servidor: " + error.message });
    }
});

// RUTA DE ADMINISTRADOR: Recargar saldo manualmente
app.post('/api/admin/recharge', async (req, res) => {
    const { username, amount, adminSecret } = req.body;
    const ADMIN_SECRET_KEY = "MI_CLAVE_SECRETA_ADMIN"; 

    if (adminSecret !== ADMIN_SECRET_KEY) {
        return res.status(403).json({ error: "No autorizado. Clave de administrador incorrecta." });
    }

    try {
        const userCheck = await query("SELECT * FROM users WHERE username = $1", [username]);
        if (userCheck.rows.length === 0) {
            return res.status(404).json({ error: "Usuario no encontrado" });
        }

        const updateRes = await query(
            `UPDATE users SET balance = balance + $1 WHERE username = $2 RETURNING username, balance, bonus_balance`,
            [amount, username]
        );

        res.json({
            success: true,
            message: `Se han acreditado ${amount} exitosamente al usuario ${username}.`,
            user: updateRes.rows[0]
        });

    } catch (error) {
        res.status(500).json({ error: "Error en el servidor al recargar: " + error.message });
    }
});

// Ruta explícita para la página principal
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(3000, () => console.log("Servidor corriendo en puerto 3000"));