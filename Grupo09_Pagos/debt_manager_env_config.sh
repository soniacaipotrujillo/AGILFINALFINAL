# =====================================================
# ARCHIVO .env - Variables de Entorno
# =====================================================

# Base de datos PostgreSQL
DB_HOST=localhost
DB_PORT=5432
DB_NAME=debt_manager
DB_USER=postgres
DB_PASSWORD=tu_password_aqui

# JWT Secret (cambiar en producción)
JWT_SECRET=tu_clave_secreta_super_segura_aqui_2024

# Puerto del servidor
PORT=3000

# Entorno (development, production)
NODE_ENV=development

# =====================================================
# ARCHIVO package.json
# =====================================================

{
  "name": "debt-manager-api",
  "version": "1.0.0",
  "description": "API REST para Gestor Inteligente de Deudas",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js",
    "db:setup": "psql -U postgres -f database/schema.sql",
    "db:seed": "node database/seed.js"
  },
  "keywords": ["debt", "finance", "api", "rest"],
  "author": "Tu Nombre",
  "license": "MIT",
  "dependencies": {
    "express": "^4.18.2",
    "pg": "^8.11.3",
    "cors": "^2.8.5",
    "bcrypt": "^5.1.1",
    "jsonwebtoken": "^9.0.2",
    "dotenv": "^16.3.1"
  },
  "devDependencies": {
    "nodemon": "^3.0.1"
  }
}

# =====================================================
# INSTALACIÓN Y CONFIGURACIÓN
# =====================================================

# 1. Instalar PostgreSQL (si no lo tienes)
# En Ubuntu/Debian:
sudo apt update
sudo apt install postgresql postgresql-contrib

# En macOS con Homebrew:
brew install postgresql
brew services start postgresql

# En Windows: Descargar desde https://www.postgresql.org/download/

# 2. Crear la base de datos
sudo -u postgres psql
CREATE DATABASE debt_manager;
\q

# 3. Ejecutar el schema SQL
psql -U postgres -d debt_manager -f schema.sql

# 4. Clonar o crear el proyecto
mkdir debt-manager-api
cd debt-manager-api

# 5. Crear los archivos necesarios
# - server.js (el código de la API)
# - .env (las variables de entorno)
# - package.json (las dependencias)

# 6. Instalar dependencias
npm install

# 7. Configurar el archivo .env con tus credenciales

# 8. Iniciar el servidor
npm run dev  # Modo desarrollo con nodemon
# o
npm start    # Modo producción

# =====================================================
# COMANDOS ÚTILES DE PostgreSQL
# =====================================================

# Conectar a la base de datos
psql -U postgres -d debt_manager

# Ver todas las tablas
\dt

# Describir una tabla
\d debts

# Ver todos los usuarios
SELECT * FROM users;

# Ver todas las deudas
SELECT * FROM debts;

# Eliminar todos los datos (cuidado!)
TRUNCATE users, debts, payment_history, notifications, banks RESTART IDENTITY CASCADE;

# Backup de la base de datos
pg_dump -U postgres debt_manager > backup.sql

# Restaurar backup
psql -U postgres debt_manager < backup.sql

# =====================================================
# ESTRUCTURA DEL PROYECTO
# =====================================================

debt-manager-api/
├── server.js                 # Servidor principal
├── package.json              # Dependencias
├── .env                      # Variables de entorno
├── .gitignore               # Archivos a ignorar
├── README.md                # Documentación
├── database/
│   ├── schema.sql           # Schema de la base de datos
│   └── seed.js              # Datos de prueba
├── middleware/
│   ├── auth.js              # Middleware de autenticación
│   └── validation.js        # Validación de datos
├── routes/
│   ├── auth.js              # Rutas de autenticación
│   ├── debts.js             # Rutas de deudas
│   ├── payments.js          # Rutas de pagos
│   ├── statistics.js        # Rutas de estadísticas
│   └── notifications.js     # Rutas de notificaciones
└── config/
    └── database.js          # Configuración de DB

# =====================================================
# ARCHIVO .gitignore
# =====================================================

# Dependencias
node_modules/

# Variables de entorno
.env
.env.local
.env.production

# Logs
*.log
npm-debug.log*

# Sistema operativo
.DS_Store
Thumbs.db

# IDE
.vscode/
.idea/
*.swp
*.swo

# =====================================================
# ENDPOINTS PRINCIPALES DE LA API
# =====================================================

# AUTENTICACIÓN
POST   /api/auth/register         # Registrar usuario
POST   /api/auth/login            # Iniciar sesión

# DEUDAS
GET    /api/debts                 # Obtener todas las deudas
GET    /api/debts/:id             # Obtener deuda específica
POST   /api/debts                 # Crear nueva deuda
PUT    /api/debts/:id             # Actualizar deuda
DELETE /api/debts/:id             # Eliminar deuda

# PAGOS
POST   /api/payments              # Registrar pago
GET    /api/payments/debt/:id    # Historial de pagos

# ESTADÍSTICAS
GET    /api/statistics            # Estadísticas del usuario

# NOTIFICACIONES
GET    /api/notifications         # Obtener notificaciones
PUT    /api/notifications/:id/read # Marcar como leída

# BANCOS
GET    /api/banks                 # Listar bancos

# =====================================================
# EJEMPLOS DE USO CON CURL
# =====================================================

# Registrar usuario
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Kristel",
    "email": "kristel@example.com",
    "password": "password123"
  }'

# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "kristel@example.com",
    "password": "password123"
  }'

# Crear deuda (requiere token)
curl -X POST http://localhost:3000/api/debts \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TU_TOKEN_AQUI" \
  -d '{
    "bank_name": "BCP",
    "description": "Préstamo Personal",
    "amount": 10000,
    "due_date": "2024-12-31",
    "frequency": "mensual"
  }'

# Obtener deudas
curl -X GET http://localhost:3000/api/debts \
  -H "Authorization: Bearer TU_TOKEN_AQUI"

# Registrar pago
curl -X POST http://localhost:3000/api/payments \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TU_TOKEN_AQUI" \
  -d '{
    "debt_id": 1,
    "amount": 500,
    "payment_date": "2024-12-07",
    "payment_method": "tarjeta",
    "reference": "OP123456"
  }'

# Obtener estadísticas
curl -X GET http://localhost:3000/api/statistics \
  -H "Authorization: Bearer TU_TOKEN_AQUI"