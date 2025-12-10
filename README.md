# 💰 Gestor Inteligente de Deudas

![Estado](https://img.shields.io/badge/Estado-Funcional-brightgreen)
![Node.js](https://img.shields.io/badge/Node.js-v18%2B-green)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14%2B-blue)
![Twilio](https://img.shields.io/badge/Notificaciones-WhatsApp-25D366)

Un sistema web integral para la gestión financiera personal. Permite organizar deudas, generar cronogramas de pagos automáticos y recibir alertas en tiempo real vía WhatsApp sobre vencimientos próximos o pagos atrasados.

---

## 🔗 Demo en Vivo
¡El proyecto está desplegado y 100% funcional!
* **Frontend (Cliente):** [https://gestor-deudas-frontend.onrender.com](https://gestor-deudas-frontend.onrender.com)
* **Backend (API):** [https://agilfinalfinal.onrender.com/api](https://agilfinalfinal.onrender.com/api)

---

## 📸 Vistazo del Proyecto

<div align="center">
  <img src="./img/dashboard.png" alt="Dashboard Principal" width="800">
  <p><em>Dashboard con resumen financiero, alertas visuales y gestión de cuotas</em></p>
</div>

---

## 🚀 Características Principales

### 1. 📅 Generación de Cronogramas (Installments)
El sistema ya no registra deudas aisladas. Ahora genera **calendarios de pago completos** al instante:
* **Soporte de Frecuencias:** Mensual, Quincenal, Semanal o Pago Único.
* **Proyección Futura:** Al registrar una deuda de 12 cuotas, el sistema crea automáticamente las 12 fechas futuras en la base de datos, permitiendo visualizar la carga financiera de los próximos meses.

### 2. 🔔 Notificaciones Inteligentes (WhatsApp)
Integración nativa con la API de **Twilio** para alertas directas al celular del usuario:
* **Alerta Instantánea:** Si intentas crear una deuda con fecha pasada, recibes una alerta inmediata.
* **Recordatorio Diario:** Un **Cron Job** se ejecuta todos los días a las 8:00 AM (Hora Perú) para enviar un resumen de deudas vencidas y pendientes del día.

### 3. 💳 Pasarela de Pagos Simulada (Mock Bank)
El sistema incluye un simulador de banco interno que valida:
* Existencia de la tarjeta.
* Saldo suficiente.
* Coincidencia de CVV y Fecha de Vencimiento.
* Estado de la tarjeta (Activa/Bloqueada).

### 4. 🚦 Dashboard Semáforo
Visualización inmediata del estado de las finanzas:
* 🔴 **Rojo (Vencida):** Deudas cuya fecha límite ya pasó.
* 🟡 **Amarillo (Próxima):** Vencen en los próximos 7 días.
* ⚪ **Normal:** Deudas futuras.

### 5. 🔐 Recuperación de Acceso Segura
Implementación de seguridad avanzada para restablecer contraseñas:
* **Códigos OTP:** Generación de códigos numéricos de 6 dígitos con expiración de 10 minutos.
* **Email Transactional:** Envío automático de correos usando **Nodemailer** y SMTP de Gmail.

---

## 🛠️ Stack Tecnológico

* **Frontend:** HTML5, CSS3 (Diseño responsivo), JavaScript Vanilla (ES6+).
* **Backend:** Node.js, Express.js, **Nodemailer**.
* **Base de Datos:** PostgreSQL (Uso intensivo de Triggers y Funciones PL/pgSQL).
* **Servicios Externos:** Twilio API (WhatsApp).
* **Seguridad:** JWT (JSON Web Tokens) y Bcrypt.

---

## 🏦 Bancos Soportados
El sistema incluye integración preconfigurada con las principales entidades financieras:
* BCP, BBVA, Interbank, Scotiabank, Banco de la Nación, Banco Pichincha, Banco Falabella y MiBanco.

---

## ⚙️ Instalación Local

### 1. Prerrequisitos
* Node.js y npm instalados.
* PostgreSQL corriendo localmente.
* Una cuenta de Twilio (opcional, para notificaciones).

### 2. Base de Datos
1. Crea la base de datos: `CREATE DATABASE debt_manager;`
2. Ejecuta el script `db/debt_manager_db_schema.sql` para crear tablas y triggers.

### 3. Backend
Navega a la carpeta `backend` e instala dependencias:
```bash
cd Grupo09_Pagos/backend
npm install
