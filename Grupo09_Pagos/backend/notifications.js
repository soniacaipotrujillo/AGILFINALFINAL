// Este archivo contiene la función que envía el WhatsApp
const express = require('express');

const router = express.Router();
// Esta ruta no necesita lógica, solo actúa como placeholder para ser importada correctamente.
router.get('/', (_req, res) => {
    res.json({ message: "Notificaciones API en espera" });
});

module.exports = router;