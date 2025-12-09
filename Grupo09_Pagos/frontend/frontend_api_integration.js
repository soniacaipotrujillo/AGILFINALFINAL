// api.js - Módulo para manejar llamadas a la API

const API_URL = 'http://localhost:3000/api';

// Clase para manejar la API
class DebtAPI {
    constructor() {
        this.token = localStorage.getItem('token');
    }

    // Headers para las peticiones
    getHeaders(includeAuth = true) {
        const headers = {
            'Content-Type': 'application/json'
        };
        
        if (includeAuth && this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }
        
        return headers;
    }

    // Manejo de errores
    async handleResponse(response) {
        const data = await response.json();
        
        if (!response.ok) {
            if (response.status === 401) {
                // Token expirado o inválido
                this.logout();
                throw new Error('Sesión expirada. Por favor inicia sesión nuevamente.');
            }
            throw new Error(data.error || 'Error en la solicitud');
        }
        
        return data;
    }

    // ==================== AUTENTICACIÓN ====================

    async register(name, email, password) {
        try {
            const response = await fetch(`${API_URL}/auth/register`, {
                method: 'POST',
                headers: this.getHeaders(false),
                body: JSON.stringify({ name, email, password })
            });

            const data = await this.handleResponse(response);
            this.token = data.token;
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            
            return data;
        } catch (error) {
            console.error('Error en registro:', error);
            throw error;
        }
    }

    async login(email, password) {
        try {
            const response = await fetch(`${API_URL}/auth/login`, {
                method: 'POST',
                headers: this.getHeaders(false),
                body: JSON.stringify({ email, password })
            });

            const data = await this.handleResponse(response);
            this.token = data.token;
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            
            return data;
        } catch (error) {
            console.error('Error en login:', error);
            throw error;
        }
    }

    logout() {
        this.token = null;
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login.html';
    }

    isAuthenticated() {
        return !!this.token;
    }

    getCurrentUser() {
        const userStr = localStorage.getItem('user');
        return userStr ? JSON.parse(userStr) : null;
    }

    // ==================== DEUDAS ====================

    async getAllDebts(filters = {}) {
        try {
            const params = new URLSearchParams(filters);
            const response = await fetch(`${API_URL}/debts?${params}`, {
                headers: this.getHeaders()
            });

            return await this.handleResponse(response);
        } catch (error) {
            console.error('Error al obtener deudas:', error);
            throw error;
        }
    }

    async getDebt(id) {
        try {
            const response = await fetch(`${API_URL}/debts/${id}`, {
                headers: this.getHeaders()
            });

            return await this.handleResponse(response);
        } catch (error) {
            console.error('Error al obtener deuda:', error);
            throw error;
        }
    }

    async createDebt(debtData) {
        try {
            const response = await fetch(`${API_URL}/debts`, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify(debtData)
            });

            return await this.handleResponse(response);
        } catch (error) {
            console.error('Error al crear deuda:', error);
            throw error;
        }
    }

    async updateDebt(id, debtData) {
        try {
            const response = await fetch(`${API_URL}/debts/${id}`, {
                method: 'PUT',
                headers: this.getHeaders(),
                body: JSON.stringify(debtData)
            });

            return await this.handleResponse(response);
        } catch (error) {
            console.error('Error al actualizar deuda:', error);
            throw error;
        }
    }

    async deleteDebt(id) {
        try {
            const response = await fetch(`${API_URL}/debts/${id}`, {
                method: 'DELETE',
                headers: this.getHeaders()
            });

            return await this.handleResponse(response);
        } catch (error) {
            console.error('Error al eliminar deuda:', error);
            throw error;
        }
    }

    // ==================== PAGOS ====================

    async createPayment(paymentData) {
        try {
            const response = await fetch(`${API_URL}/payments`, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify(paymentData)
            });

            return await this.handleResponse(response);
        } catch (error) {
            console.error('Error al registrar pago:', error);
            throw error;
        }
    }

    async getPaymentHistory(debtId) {
        try {
            const response = await fetch(`${API_URL}/payments/debt/${debtId}`, {
                headers: this.getHeaders()
            });

            return await this.handleResponse(response);
        } catch (error) {
            console.error('Error al obtener historial:', error);
            throw error;
        }
    }

    // ==================== ESTADÍSTICAS ====================

    async getStatistics() {
        try {
            const response = await fetch(`${API_URL}/statistics`, {
                headers: this.getHeaders()
            });

            return await this.handleResponse(response);
        } catch (error) {
            console.error('Error al obtener estadísticas:', error);
            throw error;
        }
    }

    // ==================== NOTIFICACIONES ====================

    async getNotifications(onlyUnread = false) {
        try {
            const params = onlyUnread ? '?is_read=false' : '';
            const response = await fetch(`${API_URL}/notifications${params}`, {
                headers: this.getHeaders()
            });

            return await this.handleResponse(response);
        } catch (error) {
            console.error('Error al obtener notificaciones:', error);
            throw error;
        }
    }

    async markNotificationAsRead(id) {
        try {
            const response = await fetch(`${API_URL}/notifications/${id}/read`, {
                method: 'PUT',
                headers: this.getHeaders()
            });

            return await this.handleResponse(response);
        } catch (error) {
            console.error('Error al marcar notificación:', error);
            throw error;
        }
    }

    // ==================== BANCOS ====================

    async getBanks() {
        try {
            const response = await fetch(`${API_URL}/banks`, {
                headers: this.getHeaders(false)
            });

            return await this.handleResponse(response);
        } catch (error) {
            console.error('Error al obtener bancos:', error);
            throw error;
        }
    }
}

// ==================== EJEMPLO DE USO EN EL FRONTEND ====================

// Instanciar la API
const api = new DebtAPI();

// Modificar la función initApp para cargar desde la API
async function initApp() {
    try {
        // Verificar autenticación
        if (!api.isAuthenticated()) {
            window.location.href = '/login.html';
            return;
        }

        // Mostrar usuario actual
        const user = api.getCurrentUser();
        document.querySelector('.welcome').textContent = `¡Hola, ${user.name}! 👋`;
        document.querySelector('.user-avatar').textContent = user.avatar;

        // Cargar datos desde la API
        await loadDebtsFromAPI();
        await loadStatisticsFromAPI();
        await loadNotificationsFromAPI();
        
        updateMonthDisplay();
    } catch (error) {
        console.error('Error al inicializar:', error);
        alert('Error al cargar los datos: ' + error.message);
    }
}

// Cargar deudas desde la API
async function loadDebtsFromAPI() {
    try {
        const response = await api.getAllDebts();
        debts = response.debts.map(debt => ({
            id: debt.id,
            bank: debt.bank_name,
            description: debt.description,
            amount: parseFloat(debt.amount),
            paidAmount: parseFloat(debt.paid_amount),
            dueDate: debt.due_date,
            frequency: debt.frequency,
            status: debt.status,
            createdDate: debt.created_date,
            paymentHistory: []
        }));
        
        renderDebts();
    } catch (error) {
        console.error('Error al cargar deudas:', error);
        throw error;
    }
}

// Cargar estadísticas desde la API
async function loadStatisticsFromAPI() {
    try {
        const response = await api.getStatistics();
        const stats = response.statistics;
        
        // Actualizar UI con estadísticas
        document.getElementById('totalDebt').textContent = 
            `S/ ${parseFloat(stats.total_amount).toLocaleString('es-PE', {minimumFractionDigits: 2})}`;
        document.getElementById('pendingDebt').textContent = 
            `S/ ${parseFloat(stats.pending_amount).toLocaleString('es-PE', {minimumFractionDigits: 2})}`;
        document.getElementById('overdueDebt').textContent = 
            `S/ ${parseFloat(stats.overdue_amount).toLocaleString('es-PE', {minimumFractionDigits: 2})}`;
        document.getElementById('paidDebt').textContent = 
            `S/ ${parseFloat(stats.paid_amount).toLocaleString('es-PE', {minimumFractionDigits: 2})}`;
        
        document.getElementById('totalCount').textContent = `${stats.total_debts} deudas`;
        document.getElementById('pendingCount').textContent = `${stats.pending_count} deudas`;
        document.getElementById('overdueCountStats').textContent = `${stats.overdue_count} deudas`;
        document.getElementById('paidCount').textContent = `${stats.paid_count} deudas`;
        
        document.getElementById('thisMonthCount').textContent = 
            parseInt(stats.pending_count) + parseInt(stats.overdue_count);
        document.getElementById('overdueCount').textContent = stats.overdue_count;
    } catch (error) {
        console.error('Error al cargar estadísticas:', error);
    }
}

// Cargar notificaciones desde la API
async function loadNotificationsFromAPI() {
    try {
        const response = await api.getNotifications(true);
        notifications = response.notifications;
        
        document.getElementById('notificationCount').textContent = 
            response.notifications.length;
    } catch (error) {
        console.error('Error al cargar notificaciones:', error);
    }
}

// Modificar saveDebt para usar la API
async function saveDebt(event) {
    event.preventDefault();
    
    try {
        const debtData = {
            bank_name: document.getElementById('bankName').value,
            description: document.getElementById('debtDescription').value,
            amount: parseFloat(document.getElementById('debtAmount').value),
            due_date: document.getElementById('dueDate').value,
            frequency: document.getElementById('paymentFrequency').value
        };
        
        const response = await api.createDebt(debtData);
        
        closeModal();
        await loadDebtsFromAPI();
        await loadStatisticsFromAPI();
        
        alert('Deuda agregada exitosamente');
    } catch (error) {
        alert('Error al guardar la deuda: ' + error.message);
    }
}

// Modificar processPayment para usar la API
async function processPayment(debtId, paymentMethod) {
    try {
        const paymentAmount = parseFloat(document.getElementById('paymentAmount').value);
        const paymentDate = document.getElementById('paymentDate').value;
        const reference = document.getElementById('paymentReference').value || '';
        
        if (!paymentAmount || paymentAmount <= 0) {
            alert('Por favor ingrese un monto válido');
            return;
        }

        const paymentData = {
            debt_id: debtId,
            amount: paymentAmount,
            payment_date: paymentDate,
            payment_method: paymentMethod,
            reference: reference
        };

        const response = await api.createPayment(paymentData);
        
        closeModal();
        await loadDebtsFromAPI();
        await loadStatisticsFromAPI();
        
        // Mostrar confirmación
        const debt = debts.find(d => d.id === debtId);
        showPaymentConfirmation(debt, paymentAmount, paymentMethod);
    } catch (error) {
        alert('Error al procesar el pago: ' + error.message);
    }
}

// ==================== PÁGINA DE LOGIN ====================

// HTML para login.html
const loginHTML = `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Login - Gestor de Deudas</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        
        .login-container {
            background: white;
            border-radius: 20px;
            padding: 40px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            width: 90%;
            max-width: 400px;
        }
        
        h1 {
            text-align: center;
            color: #333;
            margin-bottom: 30px;
        }
        
        .form-group {
            margin-bottom: 20px;
        }
        
        label {
            display: block;
            color: #555;
            font-weight: 500;
            margin-bottom: 8px;
        }
        
        input {
            width: 100%;
            padding: 12px;
            border: 2px solid #e5e7eb;
            border-radius: 10px;
            font-size: 16px;
        }
        
        input:focus {
            outline: none;
            border-color: #667eea;
        }
        
        button {
            width: 100%;
            padding: 14px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            border-radius: 10px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            margin-top: 20px;
        }
        
        button:hover {
            transform: translateY(-2px);
            box-shadow: 0 10px 25px rgba(102, 126, 234, 0.3);
        }
        
        .toggle-form {
            text-align: center;
            margin-top: 20px;
            color: #666;
        }
        
        .toggle-form a {
            color: #667eea;
            text-decoration: none;
            font-weight: 600;
        }
        
        .error {
            background: #fee2e2;
            color: #dc2626;
            padding: 10px;
            border-radius: 8px;
            margin-bottom: 20px;
            display: none;
        }
    </style>
</head>
<body>
    <div class="login-container">
        <h1>Gestor de Deudas</h1>
        
        <div id="errorMessage" class="error"></div>
        
        <form id="loginForm">
            <div class="form-group">
                <label>Email</label>
                <input type="email" id="email" required>
            </div>
            
            <div class="form-group">
                <label>Contraseña</label>
                <input type="password" id="password" required>
            </div>
            
            <button type="submit">Iniciar Sesión</button>
        </form>
        
        <div class="toggle-form">
            ¿No tienes cuenta? <a href="/register.html">Regístrate</a>
        </div>
    </div>
    
    <script src="api.js"></script>
    <script>
        const api = new DebtAPI();
        
        document.getElementById('loginForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            
            try {
                await api.login(email, password);
                window.location.href = '/index.html';
            } catch (error) {
                const errorDiv = document.getElementById('errorMessage');
                errorDiv.textContent = error.message;
                errorDiv.style.display = 'block';
            }
        });
    </script>
</body>
</html>
`;

console.log('Módulo de API listo para usar');