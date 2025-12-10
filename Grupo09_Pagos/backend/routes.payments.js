const express = require('express');
const { pool } = require('./db');
const { authMiddleware } = require('./auth');
const router = express.Router();

router.use(authMiddleware);

// --- BASE DE DATOS DEL BANCO FICTICIO ---
const MOCK_BANK_DB = [
    { number: '4000123456789010', exp: '2028-12', cvv: '123', balance: 5000.00, status: 'active' }, // Visa VIP
    { number: '5000123456789010', exp: '2026-10', cvv: '456', balance: 50.00, status: 'active' },   // Pobre
    { number: '4111111111111111', exp: '2030-01', cvv: '999', balance: 10000.00, status: 'blocked'} // Robada
];

router.post('/', async (req, res) => {
    const client = await pool.connect();
    
    try {
        const { debt_id, amount, payment_date, cardNumber, cardExp, cardCvv } = req.body;

        // 1. VALIDACIONES DE FORMULARIO
        if (!amount || amount <= 0) return res.status(400).json({ error: "Monto inválido" });
        if (!cardNumber || !cardExp || !cardCvv) return res.status(400).json({ error: "Datos de tarjeta incompletos" });

        // =========================================================
        // 2. SIMULACIÓN DE CONEXIÓN CON EL BANCO
        // =========================================================
        
        const cleanCard = cardNumber.replace(/\s/g, '');
        const bankCard = MOCK_BANK_DB.find(c => c.number === cleanCard);

        if (!bankCard) {
            await new Promise(r => setTimeout(r, 1000));
            return res.status(400).json({ error: "⛔ TRANSACCIÓN RECHAZADA: Tarjeta inválida o no existe." });
        }

        if (bankCard.cvv !== cardCvv) return res.status(400).json({ error: "⛔ RECHAZADO: Código de seguridad (CVV) incorrecto." });
        if (bankCard.status === 'blocked') return res.status(400).json({ error: "⛔ ALERTA DE SEGURIDAD: Tarjeta reportada como robada." });

        if (bankCard.balance < amount) {
            return res.status(400).json({ error: `⛔ FONDOS INSUFICIENTES. Tu saldo es S/ ${bankCard.balance}` });
        }

        // =========================================================
        // 3. PROCESAMIENTO INTERNO (Si el banco aprobó)
        // =========================================================

        const debtCheck = await client.query('SELECT * FROM debts WHERE id = $1', [debt_id]);
        if (debtCheck.rows.length === 0) return res.status(404).json({ error: "La deuda no existe en el sistema." });

        const debt = debtCheck.rows[0];
        const newPaidAmount = parseFloat(debt.paid_amount) + parseFloat(amount);

        if (newPaidAmount > parseFloat(debt.amount)) {
            return res.status(400).json({ error: `El pago excede el total. Solo debes S/ ${(debt.amount - debt.paid_amount).toFixed(2)}` });
        }

        await client.query('BEGIN');

        const bankAuthCode = `AUT-${Math.floor(100000 + Math.random() * 900000)}`;

        await client.query(
            `INSERT INTO payment_history (debt_id, amount, payment_date, payment_method, reference, notes)
             VALUES ($1, $2, $3, 'tarjeta', $4, $5)`,
            [debt_id, amount, payment_date, bankAuthCode, `Tarjeta terminada en ****${cleanCard.slice(-4)}`]
        );

        let newStatus = debt.status;
        if (newPaidAmount >= parseFloat(debt.amount)) {
            newStatus = 'paid';
        } else if (debt.status === 'overdue') {
            newStatus = 'pending';
        }

        await client.query('UPDATE debts SET paid_amount = $1, status = $2 WHERE id = $3', [newPaidAmount, newStatus, debt_id]);

        await client.query(
            `INSERT INTO notifications (user_id, debt_id, type, title, message) VALUES ($1, $2, 'payment_success', 'Pago Aprobado', $3)`,
            [req.user.id, debt_id, `Pago de S/ ${amount} procesado con éxito. Ref: ${bankAuthCode}`]
        );

        await client.query('COMMIT');

        res.json({
            success: true,
            transaction_id: bankAuthCode,
            new_balance: (debt.amount - newPaidAmount).toFixed(2),
            message: "Pago procesado exitosamente por Visa/Mastercard"
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error(error);
        res.status(500).json({ error: "Error de comunicación con el banco" });
    } finally {
        client.release();
    }
});

// Ruta para ver historial (GET)
router.get('/', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT ph.*, d.description as debt_name 
             FROM payment_history ph
             JOIN debts d ON ph.debt_id = d.id
             WHERE d.user_id = $1
             ORDER BY ph.payment_date DESC`,
            [req.user.id]
        );
        res.json(result.rows);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router; // <-- ¡Esto debe estar al final!