const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { pool } = require('./db');

const authRoutes = require('./routes.auth');
const debtRoutes = require('./routes.debts');
const paymentRoutes = require('./routes.payments');
const notificationRoutes = require('./routes.notifications');
const bankRoutes = require('./routes.banks');
const statisticsRoutes = require('./routes.statistics');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const API_PREFIX = '/api';

app.get('/', (_req, res) => {
  res.json({ message: 'API de gestión de deudas operativa' });
});

app.use(`${API_PREFIX}/auth`, authRoutes);
app.use(`${API_PREFIX}/debts`, debtRoutes);
app.use(`${API_PREFIX}/payments`, paymentRoutes);
app.use(`${API_PREFIX}/notifications`, notificationRoutes);
app.use(`${API_PREFIX}/banks`, bankRoutes);
app.use(`${API_PREFIX}/statistics`, statisticsRoutes);

app.use((err, _req, res, _next) => {
  console.error('Error no controlado', err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

const port = process.env.PORT || 3000;
app.listen(port, async () => {
  try {
    await pool.query('SELECT 1');
    console.log(`Servidor escuchando en http://localhost:${port}`);
  } catch (err) {
    console.error('No se pudo conectar a la base de datos', err);
  }
});
