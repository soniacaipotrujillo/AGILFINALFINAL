const express = require('express');
const { pool } = require('./db');
const { authMiddleware } = require('./auth');
const { enviarResumenVencidas } = require('./notifications'); // Módulo para enviar WhatsApp

const router = express.Router();
router.use(authMiddleware);

// --- OBTENER DEUDAS (Utiliza la lógica del frontend) ---
router.get('/', async (req, res) => {
    try {
        // Esta consulta trae TODAS las deudas no pagadas (incluye futuras, vencidas, próximas)
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
        console.error('Error al obtener deudas:', e);
        res.status(500).json({ error: 'Error al obtener deudas' }); 
    }
});

// --- CREAR DEUDA (CON ALERTA INSTANTÁNEA) ---
router.post('/', async (req, res) => {
    const { bank_name, description, amount, due_date, frequency = 'mensual' } = req.body;
    
    if (!bank_name || !description || !amount || !due_date) {
        return res.status(400).json({ error: 'Banco, descripción, monto y fecha de vencimiento son obligatorios' });
    }

    try {
        // 1. Insertar la deuda con estado inicial 'pending'
        const result = await pool.query(
            `INSERT INTO debts (user_id, bank_name, description, amount, due_date, frequency, status) 
             VALUES ($1, $2, $3, $4, $5, $6, 'pending') 
             RETURNING *`,
            [req.user.id, bank_name, description, amount, due_date, frequency]
        );
        
        const nuevaDeuda = result.rows[0];

        // 2. Lógica para verificar si la deuda nace VENCIDA
        const fechaVencimiento = new Date(due_date);
        const hoy = new Date();
        // Normalizamos horas para comparar solo fechas
        fechaVencimiento.setHours(0,0,0,0);
        hoy.setHours(0,0,0,0);

        if (fechaVencimiento <= hoy) {
            console.log(`🔔 Deuda vencida detectada al crearla. Disparando alerta...`);
            
            // A. Actualizar el estado en la BD a 'overdue'
            await pool.query("UPDATE debts SET status = 'overdue' WHERE id = $1", [nuevaDeuda.id]);
            
            // B. Enviar WhatsApp AL INSTANTE
            enviarResumenVencidas(req.user.id); 
        }

        res.status(201).json(nuevaDeuda);

    } catch (e) {
        console.error('Error al crear deuda:', e);
        res.status(500).json({ error: e.message || 'No se pudo crear la deuda' });
    }
});

// --- ACTUALIZAR DEUDA ---
router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const { bank_name, description, amount, due_date, frequency, status, paid_amount } = req.body;
    try {
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
            RETURNING *
        `;
        const { rows } = await pool.query(query, [
            bank_name, description, amount, due_date, frequency, status, paid_amount, id, req.user.id
        ]);

        if (!rows.length) {
            return res.status(404).json({ error: 'Deuda no encontrada' });
        }

        return res.json(rows[0]);
    } catch (error) {
        console.error('Error al actualizar deuda', error);
        return res.status(500).json({ error: 'No se pudo actualizar la deuda' });
    }
});

// --- ELIMINAR DEUDA ---
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

module.exports = router; // <-- ¡Esto debe estar al final!