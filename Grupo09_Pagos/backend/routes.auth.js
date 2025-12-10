const express = require('express');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
// Asegúrate de que tu auth.js pueda manejar el campo 'phone'
const { createUser, findUserByEmail, generateToken, verifyPassword } = require('./auth'); 
const { pool } = require('./db');

// Creamos el router
const router = express.Router();

// Configura tu correo REAL aquí
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'gestionagil097@gmail.com', // ⚠️ CAMBIA ESTO
    pass: 'ejvb vfxf awvx pmea' // ⚠️ CAMBIA ESTO
  }
});

// Helper para hashear (necesario para el reset de password)
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hashed = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hashed}`;
}

// --- REGISTRO (CORREGIDO CON CAMPO PHONE) ---
router.post('/register', async (req, res) => {
  try {
    // AÑADIMOS 'phone' para recibirlo del frontend
    const { name, email, password, phone } = req.body; 
    
    if (!name || !email || !password || !phone) return res.status(400).json({ error: 'Faltan datos obligatorios (nombre, email, teléfono o contraseña)' });

    const existing = await findUserByEmail(email);
    if (existing) return res.status(409).json({ error: 'Correo ya registrado' });

    // PASAMOS EL TELÉFONO al createUser (debiste modificarlo antes)
    const user = await createUser({ name, email, password, phone }); 
    const token = generateToken(user);
    res.status(201).json({ token, user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message || 'Error en registro' });
  }
});

// --- LOGIN ---
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await findUserByEmail(email);
    
    if (!user || !verifyPassword(password, user.password_hash)) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const token = generateToken(user);
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, avatar: user.avatar } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error en login' });
  }
});

// --- RECUPERACIÓN 1: PEDIR CÓDIGO ---
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  try {
    const user = await findUserByEmail(email);
    if (!user) return res.json({ message: 'Código enviado' }); // Seguridad

    const code = Math.floor(100000 + Math.random() * 900000).toString();

    await pool.query(
      `UPDATE users SET reset_token = $1, reset_token_expires = NOW() + interval '15 minutes' WHERE id = $2`,
      [code, user.id]
    );

    // Enviar correo
    await transporter.sendMail({
      from: 'Debt Manager <no-reply@debtmanager.com>',
      to: email,
      subject: 'Tu código de recuperación',
      text: `Tu código es: ${code}`
    });

    res.json({ message: 'Código enviado' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al enviar correo' });
  }
});

// --- RECUPERACIÓN 2: CAMBIAR PASSWORD ---
router.post('/reset-password', async (req, res) => {
  const { email, code, newPassword } = req.body;
  try {
    const result = await pool.query(
      `SELECT * FROM users WHERE email = $1 AND reset_token = $2 AND reset_token_expires > NOW()`,
      [email, code]
    );

    if (result.rows.length === 0) return res.status(400).json({ error: 'Código inválido o expirado' });

    const user = result.rows[0];
    const newHash = hashPassword(newPassword);

    await pool.query(
      `UPDATE users SET password_hash = $1, reset_token = NULL, reset_token_expires = NULL WHERE id = $2`,
      [newHash, user.id]
    );

    res.json({ message: 'Contraseña actualizada' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al cambiar contraseña' });
  }
});

module.exports = router; // <-- ¡Esta línea es la clave y debe ser la última!