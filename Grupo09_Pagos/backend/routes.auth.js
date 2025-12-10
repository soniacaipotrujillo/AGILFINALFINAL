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

// Almacenamiento temporal de códigos (se borra si reinicias el servidor)
const resetCodes = new Map(); 

// --- CONFIGURACIÓN DE NODEMAILER (GMAIL) ---
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER, // Lee gestionagil097@gmail.com del archivo .env
    pass: process.env.EMAIL_PASS, // Lee tu contraseña de aplicación del archivo .env
  },
});

// --- RUTAS ---

router.post('/register', async (req, res) => {
  const { name, email, password, phone } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Nombre, email y contraseña son obligatorios' });
  }

  try {
    const existing = await findUserByEmail(email);
    if (existing) {
      return res.status(400).json({ error: 'Ya existe un usuario con ese email' });
    }

    const user = await createUser({ name, email, password, phone });
    const token = generateToken(user);

    return res.status(201).json({ token, user });
  } catch (error) {
    console.error('Error registrando usuario', error);
    return res.status(500).json({ error: 'No se pudo registrar el usuario' });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email y contraseña son obligatorios' });
  }

  try {
    const user = await findUserByEmail(email);
    if (!user || !verifyPassword(password, user.password_hash)) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const token = generateToken(user);
    const { password_hash, ...safeUser } = user;

    return res.json({ token, user: safeUser });
  } catch (error) {
    console.error('Error en login', error);
    return res.status(500).json({ error: 'No se pudo iniciar sesión' });
  }
});

// --- RUTA MODIFICADA PARA ENVIAR CORREO REAL ---
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email es requerido' });
  }

  try {
    const user = await findUserByEmail(email);
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // Generar código de 6 dígitos
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutos
    resetCodes.set(email, { code, expiresAt });

    console.log(`[DEBUG] Enviando código a ${email}...`);

    // Enviar el correo real
    await transporter.sendMail({
      from: `"Soporte Gestión Ágil" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: '🔐 Código de Recuperación de Contraseña',
      html: `
        <div style="font-family: sans-serif; padding: 20px; color: #333;">
          <h2 style="color: #667eea;">Recuperación de Contraseña</h2>
          <p>Hola <b>${user.name}</b>,</p>
          <p>Has solicitado restablecer tu contraseña. Usa el siguiente código:</p>
          <div style="background: #f3f4f6; padding: 15px; border-radius: 10px; text-align: center; margin: 20px 0;">
            <span style="font-size: 24px; font-weight: bold; letter-spacing: 5px; color: #333;">${code}</span>
          </div>
          <p style="font-size: 12px; color: #666;">Este código expira en 10 minutos. Si no fuiste tú, ignora este mensaje.</p>
        </div>
      `,
    });

    return res.json({ message: 'Código de recuperación enviado a tu correo.' });

  } catch (error) {
    console.error('Error enviando correo de recuperación:', error);
    return res.status(500).json({ error: 'No se pudo enviar el correo. Intenta más tarde.' });
  }
});

router.post('/reset-password', async (req, res) => {
  const { email, code, newPassword } = req.body;
  if (!email || !code || !newPassword) {
    return res.status(400).json({ error: 'Todos los campos son obligatorios' });
  }

  const stored = resetCodes.get(email);
  if (!stored || stored.code !== code || stored.expiresAt < Date.now()) {
    return res.status(400).json({ error: 'Código inválido o expirado' });
  }

  try {
    const user = await findUserByEmail(email);
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const passwordHash = hashPassword(newPassword);
    
    // Acceso directo a la pool para el update
    const { pool } = require('./db');
    await pool.query('UPDATE users SET password_hash = $1 WHERE email = $2', [passwordHash, email]);

    resetCodes.delete(email); // Borramos el código usado

    return res.json({ message: 'Contraseña actualizada correctamente' });
  } catch (error) {
    console.error('Error actualizando contraseña', error);
    return res.status(500).json({ error: 'No se pudo actualizar la contraseña' });
  }
});

module.exports = router;