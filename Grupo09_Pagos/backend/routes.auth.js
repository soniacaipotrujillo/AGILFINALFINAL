const express = require('express');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { createUser, findUserByEmail, generateToken, verifyPassword } = require('./auth');
const { pool } = require('./db');

const router = express.Router();

// Configura tu correo REAL aquí o usa ethereal.email para pruebas
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'gestionagil097@gmail.com', // ⚠️ CAMBIA ESTO
    pass: 'ejvb vfxf awvx pmea' // ⚠️ CAMBIA ESTO
  }
});

// Helper para hashear (mismo que en auth.js)
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hashed = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hashed}`;
}

// --- REGISTRO ---
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'Faltan datos' });

    const existing = await findUserByEmail(email);
    if (existing) return res.status(409).json({ error: 'Correo ya registrado' });

    const user = await createUser({ name, email, password });
    const token = generateToken(user);
    res.status(201).json({ token, user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error en registro' });
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

    // Código de 6 dígitos
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // Guardar en BD (15 min validez)
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

module.exports = router;