const express = require('express');
const {
  createUser,
  findUserByEmail,
  generateToken,
  hashPassword,
  verifyPassword,
} = require('./auth');

const router = express.Router();

// Almacenamiento temporal de códigos de recuperación
const resetCodes = new Map(); // email -> { code, expiresAt }

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

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutos
    resetCodes.set(email, { code, expiresAt });

    console.log(`Código de recuperación para ${email}: ${code}`);
    return res.json({ message: 'Código de recuperación generado' });
  } catch (error) {
    console.error('Error generando código de recuperación', error);
    return res.status(500).json({ error: 'No se pudo generar el código' });
  }
});

router.post('/reset-password', async (req, res) => {
  const { email, code, newPassword } = req.body;
  if (!email || !code || !newPassword) {
    return res.status(400).json({ error: 'Email, código y nueva contraseña son obligatorios' });
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
    await require('./db').pool.query('UPDATE users SET password_hash = $1 WHERE email = $2', [passwordHash, email]);

    resetCodes.delete(email);

    return res.json({ message: 'Contraseña actualizada correctamente' });
  } catch (error) {
    console.error('Error actualizando contraseña', error);
    return res.status(500).json({ error: 'No se pudo actualizar la contraseña' });
  }
});

module.exports = router;
