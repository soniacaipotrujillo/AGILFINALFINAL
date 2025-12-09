const express = require('express');
const { pool } = require('./db');
const { authMiddleware } = require('./auth');
const router = express.Router();

router.use(authMiddleware);

// CREAR DEUDA
router.post('/', async (req, res) => {
    const { bank_name, description, amount, due_date, frequency } = req.body;
    
    try {
        const result = await pool.query(
            `INSERT INTO debts (user_id, bank_name, description, amount, due_date, frequency, status) 
             VALUES ($1, $2, $3, $4, $5, $6, 'pending') 
             RETURNING *`,
            [req.user.id, bank_name, description, amount, due_date, frequency]
        );
        res.status(201).json(result.rows[0]);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

// OBTENER DEUDAS (MODIFICADO PARA VER FUTURAS)
router.get('/', async (req, res) => {
    try {
        // Esta consulta trae TODAS las deudas que no estén pagadas (incluyendo 2026, 2030, etc.)
        const query = `
            SELECT *, 
            (amount - paid_amount) as remaining_amount,
            CASE 
                WHEN status = 'paid' THEN 'normal'
                WHEN status = 'overdue' THEN 'overdue'
                WHEN due_date <= CURRENT_DATE + INTERVAL '7 days' THEN 'due_soon'
                ELSE 'normal'
            END as urgency
            FROM debts 
            WHERE user_id = $1 
            AND status != 'paid' 
            ORDER BY due_date ASC`;
            
        const { rows } = await pool.query(query, [req.user.id]);
        res.json(rows);
    } catch (e) { 
        console.error(e);
        res.status(500).json({ error: e.message }); 
    }
});

// ACTUALIZAR DEUDA (PUT)
router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const { bank_name, description, amount, due_date } = req.body;
    try {
        const result = await pool.query(
            `UPDATE debts SET bank_name = $1, description = $2, amount = $3, due_date = $4 
             WHERE id = $5 AND user_id = $6 RETURNING *`,
            [bank_name, description, amount, due_date, id, req.user.id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Deuda no encontrada' });
        res.json(result.rows[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ELIMINAR DEUDA (DELETE)
router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query(
            'DELETE FROM debts WHERE id = $1 AND user_id = $2 RETURNING *',
            [id, req.user.id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Deuda no encontrada' });
        res.json({ message: 'Deuda eliminada' });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;