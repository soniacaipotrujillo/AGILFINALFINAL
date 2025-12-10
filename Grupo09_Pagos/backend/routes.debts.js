const express = require('express');
const { pool } = require('./db');
const { authMiddleware } = require('./auth');
const { enviarResumenVencidas } = require('./routes.notifications');

const router = express.Router();
router.use(authMiddleware);

// ==========================================
// 1. OBTENER DEUDAS (ORDENADAS PARA TU DISEÑO)
// ==========================================
router.get('/', async (req, res) => {
    try {
        // La clave de tu diseño está en el "ORDER BY status DESC, due_date ASC"
        // 1. status != 'paid': Solo traemos lo que debes (vencido o pendiente).
        // 2. ORDER BY due_date ASC:
        //    - Las Vencidas más viejas (ej: 2023) saldrán primero (arriba).
        //    - Las Pendientes más cercanas (ej: mañana) saldrán justo después.
        //    - Las Pendientes lejanas (ej: próximo mes) saldrán al final.
        // Esto cumple EXACTAMENTE tu requisito de orden visual.
        
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
        
        // NOTA PARA EL FRONTEND:
        // Como el backend te da la lista ordenada por fecha, el Frontend solo debe hacer esto:
        // Recorrer la lista y preguntar: "¿Cambió el mes de esta deuda respecto a la anterior?" 
        // -> Si sí: Dibuja una LÍNEA DE MES.
        // Preguntar: "¿Cambió el status de 'overdue' a 'pending'?"
        // -> Si sí: Dibuja una LÍNEA ROJA SEPARADORA.

        res.json(rows);
    } catch (e) {
        console.error('Error al obtener deudas:', e);
        res.status(500).json({ error: 'Error al obtener deudas' });
    }
});

// ==========================================
// 2. CREAR DEUDA (GENERA TODO EL CALENDARIO DE GOLPE)
// ==========================================
router.post('/', async (req, res) => {
    const { bank_name, description, amount, due_date, frequency = 'mensual', installments = 1 } = req.body;

    if (!bank_name || !description || !amount || !due_date) {
        return res.status(400).json({ error: 'Faltan datos obligatorios' });
    }

    // Usamos un cliente de la pool para poder hacer rollback si algo falla a la mitad
    const client = await pool.connect();

    try {
        await client.query('BEGIN'); // Iniciamos transacción

        const totalCuotas = parseInt(installments) || 1;
        const listaDeudasCreadas = [];
        let primeraDeudaEsVencida = false;

        console.log(`📝 Generando calendario de pagos: ${totalCuotas} cuotas (${frequency})`);

        // BUCLE PARA CREAR TODAS LAS CUOTAS AHORA MISMO
        for (let i = 0; i < totalCuotas; i++) {
            
            // 1. Calcular fecha de esta cuota
            const fechaBase = new Date(due_date);
            const fechaCuota = new Date(fechaBase);

            if (frequency.toLowerCase() === 'quincenal') {
                fechaCuota.setDate(fechaBase.getDate() + (i * 15));
            } else if (frequency.toLowerCase() === 'semanal') {
                fechaCuota.setDate(fechaBase.getDate() + (i * 7));
            } else {
                // Mensual por defecto
                fechaCuota.setMonth(fechaBase.getMonth() + i);
            }

            // 2. Determinar estado inicial (Solo la primera puede nacer vencida, las futuras son pending)
            // (A menos que registres deudas de hace 5 meses, entonces todas nacerán vencidas, lo cual es correcto)
            let estadoInicial = 'pending';
            const hoy = new Date();
            hoy.setHours(0,0,0,0);
            const checkFecha = new Date(fechaCuota);
            checkFecha.setHours(0,0,0,0);

            if (checkFecha <= hoy) {
                estadoInicial = 'overdue';
                primeraDeudaEsVencida = true;
            }

            // 3. Insertar en BD
            const result = await client.query(
                `INSERT INTO debts (
                    user_id, bank_name, description, amount, due_date, frequency, 
                    status, total_installments, current_installment
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                RETURNING *`,
                [
                    req.user.id, 
                    bank_name, 
                    description, // Podrías poner `${description} (Cuota ${i+1})` si quieres diferenciarlas por nombre
                    amount, 
                    fechaCuota, 
                    frequency, 
                    estadoInicial,
                    totalCuotas,
                    i + 1 // Cuota actual (1, 2, 3...)
                ]
            );

            listaDeudasCreadas.push(result.rows[0]);
        }

        await client.query('COMMIT'); // Guardamos todo en la BD
        
        console.log(`✅ ${totalCuotas} cuotas creadas exitosamente.`);

        // Si se generaron deudas vencidas, enviamos alerta (una sola vez por el lote)
        if (primeraDeudaEsVencida) {
            console.log(`🔔 Se detectaron cuotas vencidas en la creación. Enviando alerta...`);
            // Ejecutamos esto fuera del hilo principal para no demorar la respuesta
            enviarResumenVencidas(req.user.id).catch(err => console.error("Error enviando alerta:", err));
        }

        // Devolvemos la lista completa para que el frontend las pinte todas de una vez
        res.status(201).json(listaDeudasCreadas);

    } catch (e) {
        await client.query('ROLLBACK'); // Si falla algo, borramos todo lo que se intentó crear
        console.error('Error al crear deudas:', e);
        res.status(500).json({ error: e.message || 'No se pudo crear la deuda' });
    } finally {
        client.release();
    }
});

// ==========================================
// 3. ACTUALIZAR DEUDA (SOLO PAGO, SIN GENERAR NADA)
// ==========================================
router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const { bank_name, description, amount, due_date, frequency, status, paid_amount } = req.body;

    try {
        // Como ya creamos todas las cuotas al principio, aquí SOLO actualizamos el estado.
        // Simple y limpio.
        
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