const express = require('express');
const { pool } = require('./db');
const { authMiddleware } = require('./auth');

const router = express.Router();
router.use(authMiddleware);

router.get('/', async (req, res) => {
  try {
    const query = `
      SELECT 
        COUNT(*)::integer as total_debts,
        COALESCE(SUM(amount), 0) as total_amount,
        COUNT(*) FILTER (WHERE status = 'pending')::integer as pending_count,
        COALESCE(SUM(amount - paid_amount) FILTER (WHERE status = 'pending'), 0) as pending_amount,
        COUNT(*) FILTER (WHERE status = 'overdue')::integer as overdue_count,
        COALESCE(SUM(amount - paid_amount) FILTER (WHERE status = 'overdue'), 0) as overdue_amount,
        COUNT(*) FILTER (WHERE status = 'paid')::integer as paid_count,
        COALESCE(SUM(paid_amount) FILTER (WHERE status = 'paid'), 0) as paid_amount
      FROM debts
      WHERE user_id = $1
    `;
    
    const { rows } = await pool.query(query, [req.user.id]);
    
    if (!rows.length) {
      return res.json({
        total_debts: 0, total_amount: 0,
        pending_count: 0, pending_amount: 0,
        overdue_count: 0, overdue_amount: 0,
        paid_count: 0, paid_amount: 0
      });
    }
    
    return res.json(rows[0]);
  } catch (error) {
    console.error('Error al obtener estadísticas:', error);
    return res.status(500).json({ error: 'No se pudieron obtener las estadísticas' });
  }
});

module.exports = router;