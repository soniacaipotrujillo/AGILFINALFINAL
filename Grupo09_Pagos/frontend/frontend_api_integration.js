// frontend/frontend_api_integration.js

const API_URL = 'http://localhost:3000/api';

class DebtAPI {
    constructor() {
        this.token = localStorage.getItem('token');
    }

    getHeaders(includeAuth = true) {
        const headers = { 'Content-Type': 'application/json' };
        if (includeAuth && this.token) headers['Authorization'] = `Bearer ${this.token}`;
        return headers;
    }

    async handleResponse(response) {
        const data = await response.json();
        if (!response.ok) {
            if (response.status === 401) {
                this.logout();
                throw new Error('Sesión expirada');
            }
            throw new Error(data.error || 'Error en la solicitud');
        }
        return data;
    }

    // --- AUTENTICACIÓN ---
    async register(name, email, password) {
        const res = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: this.getHeaders(false),
            body: JSON.stringify({ name, email, password })
        });
        const data = await this.handleResponse(res);
        this.saveSession(data);
        return data;
    }

    async login(email, password) {
        const res = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: this.getHeaders(false),
            body: JSON.stringify({ email, password })
        });
        const data = await this.handleResponse(res);
        this.saveSession(data);
        return data;
    }

    saveSession(data) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        this.token = data.token;
    }

    logout() {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = 'login.html';
    }

    isAuthenticated() { return !!this.token; }
    getCurrentUser() { return JSON.parse(localStorage.getItem('user')); }

    // --- DEUDAS ---
    async createDebt(debtData) {
        const res = await fetch(`${API_URL}/debts`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify(debtData)
        });
        return await this.handleResponse(res);
    }

    async getAllDebts() {
        const res = await fetch(`${API_URL}/debts`, { headers: this.getHeaders() });
        return await this.handleResponse(res);
    }

    // --- ESTADÍSTICAS ---
    async getStatistics() {
        const res = await fetch(`${API_URL}/statistics`, { headers: this.getHeaders() });
        return await this.handleResponse(res);
    }
    
    // --- PAGOS ---
    async createPayment(data) {
        const res = await fetch(`${API_URL}/payments`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify(data)
        });
        return await this.handleResponse(res);
    }

    // Solicitar el código al correo
    async requestResetCode(email) {
        const response = await fetch(`${API_URL}/auth/forgot-password`, {
            method: 'POST',
            headers: this.getHeaders(false),
            body: JSON.stringify({ email })
        });
        return await this.handleResponse(response);
    }

    // Enviar el código y la nueva contraseña
    async confirmPasswordReset(email, code, newPassword) {
        const response = await fetch(`${API_URL}/auth/reset-password`, {
            method: 'POST',
            headers: this.getHeaders(false),
            body: JSON.stringify({ email, code, newPassword })
        });
        return await this.handleResponse(response);
    }
}

// ESTA LÍNEA ES LA MÁS IMPORTANTE:
window.api = new DebtAPI(); 
const api = window.api;