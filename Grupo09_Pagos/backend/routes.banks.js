const express = require('express');
const { pool } = require('./db');
const { authMiddleware } = require('./auth'); // Agregamos authMiddleware, aunque no es estrictamente necesario, es buena práctica si la ruta es protegida.

const router = express.Router();
router.use(authMiddleware); // Protegemos la ruta

router.get('/', async (_req, res) => {
  try {
    const { rows } = await pool.query('SELECT id, name, code, logo_url FROM banks WHERE active = true ORDER BY name ASC');
    return res.json(rows);
  } catch (error) {
    console.error('Error al obtener bancos', error);
    return res.status(500).json({ error: 'No se pudieron obtener los bancos' });
  }
});

module.exports = router; // <-- ¡Aseguramos el export!