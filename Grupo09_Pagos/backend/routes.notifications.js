const express = require('express');
const twilio = require('twilio');
const { pool } = require('./db');

const router = express.Router();

// --- 1. Inicialización SEGURA de Twilio ---
let twilioClient = null;

if (process.env.TWILIO_SID && process.env.TWILIO_TOKEN) {
    // Si las credenciales están, inicializamos el cliente
    twilioClient = twilio(process.env.TWILIO_SID, process.env.TWILIO_TOKEN);
} else {
    console.error('❌ ERROR CRÍTICO: Variables de entorno de Twilio (SID/TOKEN) no encontradas. Las notificaciones de WhatsApp están deshabilitadas.');
}
// ------------------------------------------

/**
 * Busca todas las deudas vencidas de un usuario y envía un solo mensaje de WhatsApp con el resumen.
 * @param {number} userId - ID del usuario a notificar.
 */
async function enviarResumenVencidas(userId) {
    // Si el cliente no se inicializó correctamente, salimos de la función
    if (!twilioClient) {
        return; 
    }

    const dbClient = await pool.connect();
    try {
        // 1. Obtener datos del usuario
        const userRes = await dbClient.query('SELECT name, phone FROM users WHERE id = $1', [userId]);
        const user = userRes.rows[0];

        // VALIDACIÓN CLAVE: El número debe tener el formato de WhatsApp de Twilio
        if (!user || !user.phone || !user.phone.startsWith('+') || user.phone.length < 10) {
            console.log(`⚠️ Usuario ${userId} no tiene teléfono válido. No se envió alerta.`);
            return;
        }

        // 2. Buscar TODAS las deudas vencidas de ese usuario
        const deudasRes = await dbClient.query(`
            SELECT * FROM debts 
            WHERE user_id = $1 
            AND status != 'paid' 
            AND due_date <= CURRENT_DATE
            ORDER BY due_date ASC
        `, [userId]);

        const deudas = deudasRes.rows;

        if (deudas.length > 0) {
            // 3. Construir mensaje
            let mensaje = `🚨 *ALERTA DE VENCIMIENTO* 🚨\n`;
            mensaje += `Hola ${user.name}, tienes ${deudas.length} pagos vencidos y pendientes:\n`;

            deudas.forEach(d => {
                const monto = (d.amount - d.paid_amount).toFixed(2);
                const fecha = new Date(d.due_date).toLocaleDateString('es-PE');
                
                mensaje += `\n➖ *${d.description}* (${d.bank_name})`;
                mensaje += `\n   💰 Debes: S/ ${monto} | Venció: ${fecha}`;
            });

            mensaje += `\n\n👉 _Ingresa a la web para regularizar tus cuentas._`;

            // 4. Enviar WhatsApp (Aseguramos el prefijo 'whatsapp:')
            const targetPhone = `whatsapp:${user.phone}`; 

            await twilioClient.messages.create({
                from: process.env.TWILIO_WHATSAPP_NUMBER,
                to: targetPhone,
                body: mensaje
            });

            console.log(`✅ Alerta instantánea enviada a ${user.phone}`);
        }

    } catch (error) {
        console.error('❌ Error enviando notificación:', error.message);
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

module.exports = { router, enviarResumenVencidas };