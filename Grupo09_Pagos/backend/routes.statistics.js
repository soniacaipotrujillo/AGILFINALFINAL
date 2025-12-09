const express = require('express');
const { pool } = require('./db');
const { authMiddleware } = require('./auth');

const router = express.Router();
router.use(authMiddleware);

router.get('/', async (req, res) => {
  try {
    const query = 'SELECT * FROM get_debt_statistics($1)';
    const { rows } = await pool.query(query, [req.user.id]);
    if (!rows.length) {
      return res.json({});
    }
    return res.json(rows[0]);
  } catch (error) {
    console.error('Error al obtener estadísticas', error);
    return res.status(500).json({ error: 'No se pudieron obtener las estadísticas' });
  }
});

module.exports = router;
