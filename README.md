# 💰 Gestor Inteligente de Deudas

![Estado](https://img.shields.io/badge/Estado-Funcional-brightgreen)
![Node.js](https://img.shields.io/badge/Node.js-v18%2B-green)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14%2B-blue)
![Twilio](https://img.shields.io/badge/Notificaciones-WhatsApp-25D366)

Un sistema web integral para la gestión financiera personal. Permite organizar deudas, generar cronogramas de pagos automáticos y recibir alertas en tiempo real vía WhatsApp sobre vencimientos próximos o pagos atrasados.

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

---

## 🛠️ Stack Tecnológico

* **Frontend:** HTML5, CSS3 (Diseño responsivo), JavaScript Vanilla (ES6+).
* **Backend:** Node.js, Express.js.
* **Base de Datos:** PostgreSQL (Uso intensivo de Triggers y Funciones PL/pgSQL).
* **Servicios Externos:** Twilio API (WhatsApp).
* **Seguridad:** JWT (JSON Web Tokens) y Bcrypt.

---

## ⚙️ Instalación y Configuración

### 1. Prerrequisitos
* Node.js y npm instalados.
* PostgreSQL corriendo localmente.
* Una cuenta de Twilio (opcional, para notificaciones).

### 2. Base de Datos
1.  Crea la base de datos: `CREATE DATABASE debt_manager;`
2.  Ejecuta el script `db/debt_manager_db_schema.sql` para crear tablas y triggers.

### 3. Backend
Navega a la carpeta `backend` e instala dependencias:
```
cd Grupo09_Pagos/backend
npm install
Crea un archivo .env en la carpeta backend con la siguiente configuración:
Fragmento de código
# Base de Datos
PGHOST=localhost
PGPORT=5432
PGDATABASE=debt_manager
PGUSER=postgres
PGPASSWORD=tu_contraseña

# Servidor
PORT=3000
JWT_SECRET=tu_clave_secreta_segura
JWT_TTL=86400

# Twilio (WhatsApp) - Opcional
TWILIO_SID=tu_account_sid
TWILIO_TOKEN=tu_auth_token
TWILIO_WHATSAPP_NUMBER=+14155238886
Inicia el servidor en modo desarrollo:Bashnpm run dev
4. FrontendAbre el archivo frontend/login.html o index.html en tu navegador. El proyecto incluye integración API directa sin necesidad de un servidor de frontend complejo.📂 Estructura del ProyectoPlaintextGrupo09_Pagos/
├── backend/
│   ├── routes/
│   │   ├── routes.debts.js      # Lógica de cronogramas y cuotas
│   │   ├── routes.notifications.js # Integración con Twilio
│   │   ├── routes.payments.js   # Simulador bancario
│   │   └── ...
│   ├── cronJobs.js              # Tareas programadas (8:00 AM)
│   ├── db.js                    # Conexión PG
│   └── server.js                # Entry point
├── db/
│   └── debt_manager_db_schema.sql
├── frontend/
│   ├── index.html               # Dashboard principal
│   ├── frontend_api_integration.js # Cliente HTTP
│   └── ...
└── README.md
🔗 Endpoints ClaveMétodoEndpointDescripciónPOST/api/debtsCrea una deuda y genera automáticamente todas las cuotas futuras.GET/api/debtsLista todas las deudas ordenadas cronológicamente para el calendario.POST/api/paymentsProcesa un pago validando contra el "Banco Mock".POST/api/auth/registerRegistra usuario y su teléfono para alertas.📄 LicenciaEste proyecto es de uso académico para el Grupo 09.
### Tip extra para VS Code:
Si abres este archivo en VS Code y ves el código "crudo" (con los símbolos `#` y `*`), puedes presi