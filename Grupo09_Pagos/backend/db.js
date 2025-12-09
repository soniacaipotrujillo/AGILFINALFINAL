const { Pool } = require('pg');
const dotenv = require('dotenv');
dotenv.config();

const pool = new Pool({
  host: process.env.PGHOST,
  port: process.env.PGPORT,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
  // SSL es necesario para Render (producción), pero a veces da problemas en local.
  // Esta configuración es híbrida para que funcione en ambos.
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// --- CONFIGURACIÓN DE ZONA HORARIA PERÚ (UTC-5) ---
pool.on('connect', async (client) => {
  try {
    // Esto obliga a la BD a pensar como si estuviera en Lima
    await client.query("SET TIME ZONE 'America/Lima';");
  } catch (error) {
    console.error("Error configurando zona horaria:", error);
  }
});

module.exports = { pool };