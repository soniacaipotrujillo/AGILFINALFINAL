const express = require('express');
const { pool } = require('./db');
const { authMiddleware } = require('./auth');

const router = express.Router();
router.use(authMiddleware);

router.post('/', async (req, res) => {
  const client = await pool.connect();
  try {
    const { debt_id, amount, payment_date, payment_method = 'transferencia', reference, notes } = req.body;

    if (!debt_id || !amount || !payment_date) {
      return res.status(400).json({ error: 'Deuda, monto y fecha de pago son obligatorios' });
    }

    await client.query('BEGIN');

    const { rows: debtRows } = await client.query(
      'SELECT amount, paid_amount, status FROM debts WHERE id = $1 AND user_id = $2 FOR UPDATE',
      [debt_id, req.user.id],
    );
    if (!debtRows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Deuda no encontrada' });
    }

    const debt = debtRows[0];
    const newPaid = Number(debt.paid_amount) + Number(amount);
    const status = newPaid >= Number(debt.amount) ? 'paid' : 'pending';

    const insertPayment = `
      INSERT INTO payment_history (debt_id, amount, payment_date, payment_method, reference, notes)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, debt_id, amount, payment_date, payment_method, reference, notes, created_at
    `;
    const { rows: paymentRows } = await client.query(insertPayment, [
      debt_id,
      amount,
      payment_date,
      payment_method,
      reference,
      notes,
    ]);

    await client.query('UPDATE debts SET paid_amount = $1, status = $2 WHERE id = $3', [newPaid, status, debt_id]);

    await client.query('COMMIT');
    return res.status(201).json({ ...paymentRows[0], status, paid_amount: newPaid });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al registrar pago', error);
    return res.status(500).json({ error: 'No se pudo registrar el pago' });
  } finally {
    client.release();
  }
});

router.get('/debt/:id', async (req, res) => {
  try {
    const query = `
      SELECT id, debt_id, amount, payment_date, payment_method, reference, notes, created_at
      FROM payment_history
      WHERE debt_id = $1
      ORDER BY payment_date DESC
    `;
    const { rows } = await pool.query(query, [req.params.id]);
    return res.json(rows);
  } catch (error) {
    console.error('Error al obtener historial de pagos', error);
    return res.status(500).json({ error: 'No se pudo obtener el historial de pagos' });
  }
});

module.exports = router;
