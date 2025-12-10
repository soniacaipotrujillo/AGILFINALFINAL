const express = require('express');
const twilio = require('twilio');
const { pool } = require('./db');

const router = express.Router();

// --- 1. Inicialización SEGURA de Twilio ---
let twilioClient = null;
let twilioFrom = process.env.TWILIO_WHATSAPP_NUMBER;

if (process.env.TWILIO_SID && process.env.TWILIO_TOKEN) {
    // Si las credenciales están, inicializamos el cliente
    twilioClient = twilio(process.env.TWILIO_SID, process.env.TWILIO_TOKEN);
} else {
    console.error('❌ ERROR CRÍTICO: Variables de entorno de Twilio (SID/TOKEN) no encontradas. Las notificaciones de WhatsApp están deshabilitadas.');
}

if (!twilioFrom) {
    console.error('❌ ERROR CRÍTICO: TWILIO_WHATSAPP_NUMBER no está configurado. Las alertas no se enviarán.');
} else if (!twilioFrom.startsWith('whatsapp:')) {
    twilioFrom = `whatsapp:${twilioFrom}`;
}
// ------------------------------------------

async function obtenerUsuario(dbClient, userId) {
    const userRes = await dbClient.query('SELECT name, phone FROM users WHERE id = $1', [userId]);
    return userRes.rows[0];
}

function construirLineaDeuda(deuda) {
    const monto = (deuda.amount - deuda.paid_amount).toFixed(2);
    const fecha = new Date(deuda.due_date).toLocaleDateString('es-PE');
    return `\n➖ *${deuda.description}* (${deuda.bank_name})\n   💰 Debes: S/ ${monto} | Vence: ${fecha}`;
}

async function enviarMensajeWhatsApp(user, cuerpo) {
    if (!twilioClient) {
        return;
    }

    if (!twilioFrom) {
        console.error('❌ No se puede enviar WhatsApp: falta TWILIO_WHATSAPP_NUMBER.');
        return;
    }

    if (!user || !user.phone || !user.phone.startsWith('+') || user.phone.length < 10) {
        console.log(`⚠️ Usuario ${user?.id ?? 'desconocido'} no tiene teléfono válido. No se envió alerta.`);
        return;
    }

    const targetPhone = `whatsapp:${user.phone}`;

    await twilioClient.messages.create({
        from: twilioFrom,
        to: targetPhone,
        body: cuerpo,
    });
}

/**
 * Busca todas las deudas vencidas de un usuario y envía un solo mensaje de WhatsApp con el resumen.
 * @param {number} userId - ID del usuario a notificar.
 */
async function enviarResumenVencidas(userId) {
    const dbClient = await pool.connect();
    try {
        const user = await obtenerUsuario(dbClient, userId);

        // 1. Buscar TODAS las deudas vencidas de ese usuario
        const deudasRes = await dbClient.query(`
            SELECT * FROM debts
            WHERE user_id = $1
            AND status != 'paid'
            AND due_date <= CURRENT_DATE
            ORDER BY due_date ASC
        `, [userId]);

        const deudas = deudasRes.rows;

        if (deudas.length === 0) {
            return;
        }

        // 2. Construir mensaje
        let mensaje = `🚨 *ALERTA DE VENCIMIENTO* 🚨\n`;
        mensaje += `Hola ${user.name}, tienes ${deudas.length} pagos vencidos y pendientes:\n`;

        deudas.forEach((d) => {
            mensaje += construirLineaDeuda(d);
        });

        mensaje += `\n\n👉 _Ingresa a la web para regularizar tus cuentas._`;

        await enviarMensajeWhatsApp(user, mensaje);
        console.log(`✅ Alerta instantánea enviada a ${user.phone}`);
    } catch (error) {
        console.error('❌ Error enviando notificación de vencidas:', error.message);
    } finally {
        dbClient.release();
    }
}

/**
 * Envía un resumen completo (pendientes y vencidas) para el recordatorio diario.
 * @param {number} userId - ID del usuario a notificar.
 */
async function enviarResumenCompleto(userId) {
    const dbClient = await pool.connect();
    try {
        const user = await obtenerUsuario(dbClient, userId);
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);

        const deudasRes = await dbClient.query(`
            SELECT * FROM debts
            WHERE user_id = $1
              AND status != 'paid'
            ORDER BY due_date ASC
        `, [userId]);

        const deudas = deudasRes.rows;
        if (deudas.length === 0) {
            console.log(`👍 Usuario ${userId} no tiene deudas activas que notificar.`);
            return;
        }

        const vencidas = deudas.filter((d) => new Date(d.due_date) <= hoy || d.status === 'overdue');
        const pendientes = deudas.filter((d) => new Date(d.due_date) > hoy && d.status !== 'overdue');

        let mensaje = `📅 *Resumen diario de deudas*\n`;
        mensaje += `Hola ${user.name}, este es tu estado actual:\n`;

        if (vencidas.length) {
            mensaje += `\n🚨 *Vencidas (${vencidas.length})*`;
            vencidas.forEach((d) => {
                mensaje += construirLineaDeuda(d);
            });
        }

        if (pendientes.length) {
            mensaje += `\n⏳ *Pendientes (${pendientes.length})*`;
            pendientes.forEach((d) => {
                mensaje += construirLineaDeuda(d);
            });
        }

        mensaje += `\n\n👉 _Ingresa a la web para revisar y pagar tus deudas._`;

        await enviarMensajeWhatsApp(user, mensaje);
        console.log(`✅ Resumen diario enviado a ${user.phone}`);
    } catch (error) {
        console.error('❌ Error enviando resumen diario:', error.message);
    } finally {
        dbClient.release();
    }
}

// Endpoint de diagnóstico para verificar que el módulo de notificaciones está operativo
router.get('/health', (_req, res) => {
    const ready = Boolean(twilioClient);
    const message = ready
        ? 'Servicio de notificaciones operativo'
        : 'Servicio de notificaciones degradado: Twilio no configurado';
    res.json({ ready, message });
});

module.exports = { router, enviarResumenVencidas, enviarResumenCompleto };
