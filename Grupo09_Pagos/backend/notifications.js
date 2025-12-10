const twilio = require('twilio');
const { pool } = require('./db');

// Configuración de Twilio
const client = twilio(process.env.TWILIO_SID, process.env.TWILIO_TOKEN);

async function enviarResumenVencidas(userId) {
    const dbClient = await pool.connect();
    try {
        // 1. Obtener datos del usuario
        const userRes = await dbClient.query('SELECT name, phone FROM users WHERE id = $1', [userId]);
        const user = userRes.rows[0];

        if (!user || !user.phone) {
            console.log(`⚠️ El usuario ${userId} no tiene teléfono. No se envió alerta.`);
            return;
        }

        // 2. Buscar deudas vencidas
        const deudasRes = await dbClient.query(`
            SELECT * FROM debts 
            WHERE user_id = $1 
            AND status != 'paid' 
            AND due_date <= CURRENT_DATE
        `, [userId]);

        const deudas = deudasRes.rows;

        if (deudas.length > 0) {
            // 3. Construir mensaje
            let mensaje = `🚨 *NUEVA ALERTA DE DEUDAS* 🚨\n`;
            mensaje += `Hola ${user.name}, se actualizaron tus pagos vencidos:\n`;

            deudas.forEach(d => {
                const monto = (d.amount - d.paid_amount).toFixed(2);
                const fecha = new Date(d.due_date).toLocaleDateString('es-PE');
                mensaje += `\n➖ *${d.description}* (${d.bank_name})`;
                mensaje += `\n   💰 Debes: S/ ${monto}`;
                mensaje += `\n   📅 Venció: ${fecha}`;
            });

            mensaje += `\n\n👉 _Ingresa a la web para regularizar._`;

            // 4. Enviar WhatsApp
            await client.messages.create({
                from: process.env.TWILIO_WHATSAPP_NUMBER,
                to: user.phone,
                body: mensaje
            });

            console.log(`✅ Alerta enviada a ${user.phone}`);
        }

    } catch (error) {
        console.error('❌ Error enviando notificación:', error.message);
    } finally {
        dbClient.release();
    }
}

module.exports = { enviarResumenVencidas };