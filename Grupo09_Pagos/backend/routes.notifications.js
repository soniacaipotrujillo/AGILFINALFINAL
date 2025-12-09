const express = require('express');
const { pool } = require('./db');
const { authMiddleware } = require('./auth');

const router = express.Router();
router.use(authMiddleware);

router.get('/', async (req, res) => {
  try {
    const onlyUnread = req.query.is_read === 'false';
    const query = `
      SELECT id, debt_id, type, title, message, is_read, created_at
      FROM notifications
      WHERE user_id = $1 ${onlyUnread ? 'AND is_read = false' : ''}
      ORDER BY created_at DESC
    `;
    const { rows } = await pool.query(query, [req.user.id]);
    return res.json(rows);
  } catch (error) {
    console.error('Error al obtener notificaciones', error);
    return res.status(500).json({ error: 'No se pudieron obtener las notificaciones' });
  }
});

router.put('/:id/read', async (req, res) => {
  try {
    const { rowCount } = await pool.query(
      'UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id],
    );
    if (!rowCount) {
      return res.status(404).json({ error: 'Notificación no encontrada' });
    }
    return res.json({ success: true });
  } catch (error) {
    console.error('Error al marcar notificación', error);
    return res.status(500).json({ error: 'No se pudo actualizar la notificación' });
  }
});

module.exports = router;
