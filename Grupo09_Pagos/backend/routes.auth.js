const express = require('express');
const nodemailer = require('nodemailer');
const {
  createUser,
  findUserByEmail,
  generateToken,
  hashPassword,
  verifyPassword,
} = require('./auth');

const router = express.Router();

// Almacenamiento temporal de códigos
const resetCodes = new Map(); 

// --- CONFIGURACIÓN DE CORREO (CORREGIDA PARA RENDER) ---
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,        // CAMBIO 1: Usamos puerto SSL
  secure: true,     // CAMBIO 2: true para puerto 465
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  tls: {
    rejectUnauthorized: false
  },
  // Mantenemos family: 4 por si acaso, aunque en 465 suele dar igual
  family: 4 
});

// --- RUTAS ---

router.post('/register', async (req, res) => {
  const { name, email, password, phone } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'Faltan datos' });

  try {
    const existing = await findUserByEmail(email);
    if (existing) return res.status(400).json({ error: 'Email ya registrado' });

    const user = await createUser({ name, email, password, phone });
    const token = generateToken(user);
    return res.status(201).json({ token, user });
  } catch (error) {
    console.error('Error registro:', error);
    return res.status(500).json({ error: 'Error al registrar' });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Faltan credenciales' });

  try {
    const user = await findUserByEmail(email);
    if (!user || !verifyPassword(password, user.password_hash)) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }
    const token = generateToken(user);
    const { password_hash, ...safeUser } = user;
    return res.json({ token, user: safeUser });
  } catch (error) {
    console.error('Error login:', error);
    return res.status(500).json({ error: 'Error al iniciar sesión' });
  }
});

router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email es requerido' });

  try {
    const user = await findUserByEmail(email);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000;
    resetCodes.set(email, { code, expiresAt });

    // Mensaje de log modificado para saber que estamos en la nueva versión
    console.log(`[DEBUG v2-IPv4] Enviando código a ${email}...`);

    await transporter.sendMail({
      from: `"Soporte Gestión Ágil" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: '🔐 Código de Recuperación',
      html: `
        <div style="font-family: sans-serif; padding: 20px; color: #333;">
          <h2 style="color: #667eea;">Recuperación de Contraseña</h2>
          <p>Hola <b>${user.name}</b>,</p>
          <p>Tu código de verificación es:</p>
          <div style="background: #f3f4f6; padding: 15px; border-radius: 10px; text-align: center; margin: 20px 0;">
            <span style="font-size: 24px; font-weight: bold; letter-spacing: 5px; color: #333;">${code}</span>
          </div>
          <p style="font-size: 12px; color: #666;">Expira en 10 minutos.</p>
        </div>
      `,
    });

    return res.json({ message: 'Código enviado correctamente' });

  } catch (error) {
    console.error('❌ Error enviando correo:', error);
    // Devolvemos el error específico para verlo en el frontend si es necesario
    return res.status(500).json({ error: 'Error de conexión con el servidor de correo' });
  }
});

router.post('/reset-password', async (req, res) => {
  const { email, code, newPassword } = req.body;
  if (!email || !code || !newPassword) return res.status(400).json({ error: 'Faltan datos' });

  const stored = resetCodes.get(email);
  if (!stored || stored.code !== code || stored.expiresAt < Date.now()) {
    return res.status(400).json({ error: 'Código inválido o expirado' });
  }

  try {
    const user = await findUserByEmail(email);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    const passwordHash = hashPassword(newPassword);
    const { pool } = require('./db');
    await pool.query('UPDATE users SET password_hash = $1 WHERE email = $2', [passwordHash, email]);

    resetCodes.delete(email);
    return res.json({ message: 'Contraseña actualizada' });
  } catch (error) {
    console.error('Error reset:', error);
    return res.status(500).json({ error: 'Error al actualizar' });
  }
});

module.exports = router;