const cron = require('node-cron');
const twilio = require('twilio');
const { pool } = require('./db');

// Importamos la función de envío para el cron job
const { enviarResumenVencidas } = require('./notifications'); 

const iniciarTareasProgramadas = () => {
    console.log('🕒 Sistema de Notificaciones Diario Iniciado (8:00 AM PE)...');

    // Se ejecuta todos los días a las 8:00 AM Perú (13:00 UTC)
    cron.schedule('0 13 * * *', async () => {
        console.log('🔔 Iniciando revisión diaria de deudas vencidas...');
        
        const dbClient = await pool.connect();
        try {
            // 1. Encontrar todos los usuarios que tienen deudas vencidas
            const query = `
                SELECT DISTINCT d.user_id
                FROM debts d
                WHERE d.status != 'paid' 
                AND d.due_date <= CURRENT_DATE
            `;
            
            const res = await dbClient.query(query);
            const usuariosAAlertar = res.rows;

            if (usuariosAAlertar.length > 0) {
                // 2. Enviar mensaje a cada usuario encontrado
                for (const user of usuariosAAlertar) {
                    // Llamamos a la función que agrupa las deudas y envía el WhatsApp
                    await enviarResumenVencidas(user.user_id);
                }
                console.log(`✅ [CRON] Se procesaron alertas para ${usuariosAAlertar.length} usuarios.`);
            } else {
                console.log('👍 No hay deudas vencidas para notificar hoy.');
            }

        } catch (error) {
            console.error('❌ Error en el proceso diario:', error);
        } finally {
            dbClient.release();
        }
    });
};

module.exports = { iniciarTareasProgramadas };