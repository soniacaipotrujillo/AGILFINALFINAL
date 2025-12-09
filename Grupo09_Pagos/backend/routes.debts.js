const express = require('express');
const { pool } = require('./db');
const { authMiddleware } = require('./auth');

const router = express.Router();

function buildFilters(query) {
  const conditions = ['user_id = $1'];
  const params = [];
  const userIdIndex = 1;
  params.push(query.userId);

  if (query.status) {
    conditions.push('status = $2');
    params.push(query.status);
  }

  if (query.month && query.year) {
    conditions.push(`EXTRACT(MONTH FROM due_date) = $${params.length + 1}`);
    params.push(Number(query.month));
    conditions.push(`EXTRACT(YEAR FROM due_date) = $${params.length + 1}`);
    params.push(Number(query.year));
  } else {
    // Vista por defecto: mes actual y pendientes anteriores
    conditions.push(`(date_trunc('month', due_date) = date_trunc('month', CURRENT_DATE) OR status = 'overdue')`);
  }

  return { where: conditions.join(' AND '), params, nextIndex: params.length + 1 };
}

function decorateDebt(row) {
  const dueDate = new Date(row.due_date);
  const today = new Date();
  const oneWeek = 7 * 24 * 60 * 60 * 1000;
  const diff = dueDate - today;

  let urgency = 'normal';
  if (row.status !== 'paid') {
    if (dueDate.toDateString() === today.toDateString()) {
      urgency = 'due_today';
    } else if (diff <= oneWeek && diff >= 0) {
      urgency = 'due_soon';
    } else if (dueDate < today) {
      urgency = 'overdue';
    }
  }

  return {
    id: row.id,
    bank_name: row.bank_name,
    description: row.description,
    amount: Number(row.amount),
    paid_amount: Number(row.paid_amount),
    remaining_amount: Number(row.amount) - Number(row.paid_amount),
    due_date: row.due_date,
    frequency: row.frequency,
    status: row.status,
    created_date: row.created_date,
    urgency,
  };
}

router.use(authMiddleware);

router.get('/', async (req, res) => {
  try {
    const { where, params } = buildFilters({ ...req.query, userId: req.user.id });
    const query = `
      SELECT d.id, d.bank_name, d.description, d.amount, d.paid_amount, d.due_date, d.frequency, d.status, d.created_date
      FROM debts d
      WHERE ${where}
      ORDER BY d.due_date ASC
    `;
    const { rows } = await pool.query(query, params);
    return res.json(rows.map(decorateDebt));
  } catch (error) {
    console.error('Error al listar deudas', error);
    return res.status(500).json({ error: 'No se pudieron obtener las deudas' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const query = `
      SELECT id, bank_name, description, amount, paid_amount, due_date, frequency, status, created_date
      FROM debts
      WHERE id = $1 AND user_id = $2
    `;
    const { rows } = await pool.query(query, [req.params.id, req.user.id]);
    if (!rows.length) {
      return res.status(404).json({ error: 'Deuda no encontrada' });
    }
    return res.json(decorateDebt(rows[0]));
  } catch (error) {
    console.error('Error al obtener deuda', error);
    return res.status(500).json({ error: 'No se pudo obtener la deuda' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { bank_name, description, amount, due_date, frequency = 'mensual' } = req.body;
    if (!bank_name || !description || !amount || !due_date) {
      return res.status(400).json({ error: 'Banco, descripción, monto y fecha de vencimiento son obligatorios' });
    }

    const query = `
      INSERT INTO debts (user_id, bank_name, description, amount, due_date, frequency, status)
      VALUES ($1, $2, $3, $4, $5, $6, 'pending')
      RETURNING id, bank_name, description, amount, paid_amount, due_date, frequency, status, created_date
    `;
    const { rows } = await pool.query(query, [req.user.id, bank_name, description, amount, due_date, frequency]);
    return res.status(201).json(decorateDebt(rows[0]));
  } catch (error) {
    console.error('Error al crear deuda', error);
    return res.status(500).json({ error: 'No se pudo crear la deuda' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { bank_name, description, amount, due_date, frequency, status, paid_amount } = req.body;
    const query = `
      UPDATE debts
      SET bank_name = COALESCE($1, bank_name),
          description = COALESCE($2, description),
          amount = COALESCE($3, amount),
          due_date = COALESCE($4, due_date),
          frequency = COALESCE($5, frequency),
          status = COALESCE($6, status),
          paid_amount = COALESCE($7, paid_amount)
      WHERE id = $8 AND user_id = $9
      RETURNING id, bank_name, description, amount, paid_amount, due_date, frequency, status, created_date
    `;
    const { rows } = await pool.query(query, [
      bank_name,
      description,
      amount,
      due_date,
      frequency,
      status,
      paid_amount,
      req.params.id,
      req.user.id,
    ]);

    if (!rows.length) {
      return res.status(404).json({ error: 'Deuda no encontrada' });
    }

    return res.json(decorateDebt(rows[0]));
  } catch (error) {
    console.error('Error al actualizar deuda', error);
    return res.status(500).json({ error: 'No se pudo actualizar la deuda' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM debts WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    if (!rowCount) {
      return res.status(404).json({ error: 'Deuda no encontrada' });
    }
    return res.status(204).send();
  } catch (error) {
    console.error('Error al eliminar deuda', error);
    return res.status(500).json({ error: 'No se pudo eliminar la deuda' });
  }
});

module.exports = router;
