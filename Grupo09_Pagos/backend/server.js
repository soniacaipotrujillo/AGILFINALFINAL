const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { pool } = require('./db');

// Cargar variables de entorno ANTES de importar módulos que las usen (cron/notifications)
dotenv.config();

// --- 1. Importación de Funciones de Cron ---
let iniciarTareasProgramadas;
try {
    const cronModule = require('./cronJobs');
    iniciarTareasProgramadas = cronModule.iniciarTareasProgramadas;
} catch (e) {
    console.warn('⚠️ No se iniciarán alertas diarias (cronJobs.js no cargado).');
}

const app = express();

// Middlewares
app.use(cors({
    origin: 'https://gestor-deudas-frontend.onrender.com', 
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// --- 2. Importación y Uso de Rutas (Asegurando la consistencia de nombres) ---
const API_PREFIX = '/api';

try {
    // Estas son las variables que deben ser funciones/routers
    const authRoutes = require('./routes.auth');
    const debtsRoutes = require('./routes.debts'); // Nombre en plural
    const paymentRoutes = require('./routes.payments');
    const notificationModule = require('./routes.notifications');
    const notificationRoutes = notificationModule.router || notificationModule;
    const bankRoutes = require('./routes.banks');
    const statisticsRoutes = require('./routes.statistics');

    // Mapeo de rutas (usando 'debtsRoutes' en lugar de 'debtRoutes' para consistencia)
    app.use(`${API_PREFIX}/auth`, authRoutes);
    app.use(`${API_PREFIX}/debts`, debtsRoutes);
    app.use(`${API_PREFIX}/payments`, paymentRoutes);
    app.use(`${API_PREFIX}/notifications`, notificationRoutes);
    app.use(`${API_PREFIX}/banks`, bankRoutes);
    app.use(`${API_PREFIX}/statistics`, statisticsRoutes);

} catch (error) {
    console.error('❌ ERROR CRÍTICO al cargar una ruta:', error.message);
    console.error('Revise la sintaxis de sus archivos routes.*.js y asegúrese de que terminen con: module.exports = router;');
    process.exit(1); // Detenemos el servidor para forzar la corrección
}


// Ruta de prueba
app.get('/', (_req, res) => {
    res.json({ message: 'API de gestión de deudas operativa' });
});

// Manejo de errores 404
app.use((req, res, next) => {
    res.status(404).send("Lo siento, no se encontró esa ruta.");
});

// --- INICIO DE TAREAS PROGRAMADAS ---
if (iniciarTareasProgramadas) {
    iniciarTareasProgramadas();
}

const port = process.env.PORT || 3000;


app.listen(port, '0.0.0.0', async () => {
    console.log(`🚀 Servidor escuchando en puerto ${port}`);
    try {
        await pool.query('SELECT 1');
        console.log(`✅ Base de datos conectada`);
    } catch (err) {
        console.error('❌ Error de BD:', err);
    }
});