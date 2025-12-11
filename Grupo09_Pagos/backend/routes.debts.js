const express = require('express');
const { pool } = require('./db');
const { authMiddleware } = require('./auth');
const { enviarResumenVencidas } = require('./routes.notifications');

const router = express.Router();
router.use(authMiddleware);

// ==========================================
// 1. OBTENER DEUDAS (ORDENADAS)
// ==========================================
router.get('/', async (req, res) => {
    try {
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
            ORDER BY due_date ASC
        `;
        const { rows } = await pool.query(query, [req.user.id]);
        res.json(rows);
    } catch (e) {
        console.error('Error al obtener deudas:', e);
        res.status(500).json({ error: 'Error al obtener deudas' });
    }
});

// ==========================================
// 2. CREAR DEUDA (CRONOGRAMA)
// ==========================================
router.post('/', async (req, res) => {
    const { bank_name, description, amount, due_date, frequency = 'mensual', installments = 1 } = req.body;

    if (!bank_name || !description || !amount || !due_date) {
        return res.status(400).json({ error: 'Faltan datos obligatorios' });
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const totalCuotas = parseInt(installments) || 1;
        const listaDeudasCreadas = [];
        let primeraDeudaEsVencida = false;

        for (let i = 0; i < totalCuotas; i++) {
            const fechaBase = new Date(due_date);
            const fechaCuota = new Date(fechaBase);

            if (frequency.toLowerCase() === 'quincenal') {
                fechaCuota.setDate(fechaBase.getDate() + (i * 15));
            } else if (frequency.toLowerCase() === 'semanal') {
                fechaCuota.setDate(fechaBase.getDate() + (i * 7));
            } else {
                fechaCuota.setMonth(fechaBase.getMonth() + i);
            }

            let estadoInicial = 'pending';
            const hoy = new Date();
            hoy.setHours(0,0,0,0);
            const checkFecha = new Date(fechaCuota);
            checkFecha.setHours(0,0,0,0);

            if (checkFecha < hoy) {
                estadoInicial = 'overdue';
                primeraDeudaEsVencida = true;
            }

            const result = await client.query(
                `INSERT INTO debts (
                    user_id, bank_name, description, amount, due_date, frequency, 
                    status, total_installments, current_installment
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                RETURNING *`,
                [
                    req.user.id, bank_name, description, amount, fechaCuota, 
                    frequency, estadoInicial, totalCuotas, i + 1
                ]
            );
            listaDeudasCreadas.push(result.rows[0]);
        }

        await client.query('COMMIT');
        
        if (primeraDeudaEsVencida) {
            enviarResumenVencidas(req.user.id).catch(err => console.error("Error alerta:", err));
        }

        res.status(201).json(listaDeudasCreadas);

    } catch (e) {
        await client.query('ROLLBACK');
        console.error('Error al crear:', e);
        res.status(500).json({ error: e.message });
    } finally {
        client.release();
    }
});

// ==========================================
// 3. EDITAR DEUDA (LÓGICA INTELIGENTE DE ESTADO)
// ==========================================
router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const { bank_name, description, amount, due_date } = req.body;

    const client = await pool.connect();
    try {
        // 1. Obtener la deuda actual para comparar
        const currentRes = await client.query('SELECT * FROM debts WHERE id = $1 AND user_id = $2', [id, req.user.id]);
        if (currentRes.rows.length === 0) {
            return res.status(404).json({ error: 'Deuda no encontrada' });
        }
        const currentDebt = currentRes.rows[0];

        // 2. Determinar los nuevos valores (si no se envía uno, se usa el actual)
        const newAmount = amount !== undefined ? parseFloat(amount) : parseFloat(currentDebt.amount);
        const newDateVal = due_date !== undefined ? due_date : currentDebt.due_date;
        const paidAmount = parseFloat(currentDebt.paid_amount);

        // 3. Recalcular el ESTADO automáticamente
        let newStatus = 'pending';
        const hoy = new Date();
        hoy.setHours(0,0,0,0);
        
        // Ajustamos la fecha para comparar correctamente (UTC vs Local issues fix)
        const fechaVencimiento = new Date(newDateVal);
        // Aseguramos que la fecha se interprete como inicio del día para la comparación
        const checkFecha = new Date(fechaVencimiento.getFullYear(), fechaVencimiento.getMonth(), fechaVencimiento.getDate());

        if (paidAmount >= newAmount) {
            newStatus = 'paid';
        } else if (checkFecha < hoy) {
            newStatus = 'overdue'; // Si la fecha es anterior a hoy, es Vencida
        } else {
            newStatus = 'pending'; // Si es hoy o futuro, es Pendiente
        }

        // 4. Actualizar en la base de datos
        const updateQuery = `
            UPDATE debts
            SET bank_name = COALESCE($1, bank_name),
                description = COALESCE($2, description),
                amount = $3,
                due_date = $4,
                status = $5
            WHERE id = $6 AND user_id = $7
            RETURNING *
        `;
        
        const { rows } = await client.query(updateQuery, [
            bank_name, description, newAmount, newDateVal, newStatus, id, req.user.id
        ]);

        return res.json(rows[0]);

    } catch (error) {
        console.error('Error al actualizar deuda', error);
        return res.status(500).json({ error: 'No se pudo actualizar la deuda' });
    } finally {
        client.release();
    }
});

// ==========================================
// 4. ELIMINAR DEUDA
// ==========================================
router.delete('/:id', async (req, res) => {
    try {
        const { rowCount } = await pool.query('DELETE FROM debts WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
        if (!rowCount) return res.status(404).json({ error: 'Deuda no encontrada' });
        return res.status(204).send();
    } catch (error) {
        console.error('Error al eliminar deuda', error);
        return res.status(500).json({ error: 'Error al eliminar' });
    }
});

module.exports = router;