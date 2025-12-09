const express = require('express');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { createUser, findUserByEmail, generateToken, verifyPassword } = require('./auth');
const { pool } = require('./db');

const router = express.Router();

// Configuración de Nodemailer (GMAIL)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Helper para hashear contraseña (mismo método que en auth.js)
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hashed = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hashed}`;
}

// ... (Rutas de Login y Register se mantienen igual) ...
router.post('/register', async (req, res) => { /* ... Tu código de registro ... */ });
router.post('/login', async (req, res) => { /* ... Tu código de login ... */ });


// 1. SOLICITAR CÓDIGO
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  try {
    const user = await findUserByEmail(email);
    if (!user) return res.json({ message: 'Código enviado' }); // Seguridad

    // Generar código numérico de 6 dígitos
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // Guardar en BD con 15 minutos de validez
    await pool.query(
      `UPDATE users SET reset_token = $1, reset_token_expires = NOW() + interval '15 minutes' WHERE id = $2`,
      [code, user.id]
    );

    // Enviar correo
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Código de Recuperación - Debt Manager',
      text: `Tu código de seguridad es: ${code}. Vence en 15 minutos.`
    });

    res.json({ message: 'Código enviado' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al enviar código' });
  }
});

// 2. VERIFICAR CÓDIGO Y CAMBIAR CONTRASEÑA
router.post('/reset-password', async (req, res) => {
  const { email, code, newPassword } = req.body;
  try {
    // Buscar usuario por email y código válido
    const result = await pool.query(
      `SELECT * FROM users WHERE email = $1 AND reset_token = $2 AND reset_token_expires > NOW()`,
      [email, code]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Código inválido o expirado' });
    }

    const user = result.rows[0];
    const newHash = hashPassword(newPassword);

    // Actualizar contraseña y borrar el código usado
    await pool.query(
      `UPDATE users SET password_hash = $1, reset_token = NULL, reset_token_expires = NULL WHERE id = $2`,
      [newHash, user.id]
    );

    res.json({ message: 'Contraseña actualizada correctamente' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al actualizar contraseña' });
  }
});

module.exports = router;