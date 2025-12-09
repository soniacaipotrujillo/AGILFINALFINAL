// api.js - Módulo para manejar llamadas a la API
const API_URL = 'http://localhost:3000/api';

class DebtAPI {
    constructor() {
        this.token = localStorage.getItem('token');
    }

    getHeaders(includeAuth = true) {
        const headers = {
            'Content-Type': 'application/json'
        };
        if (includeAuth && this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }
        return headers;
    }

    async handleResponse(response) {
        const data = await response.json();
        if (!response.ok) {
            if (response.status === 401) {
                this.logout();
                throw new Error('Sesión expirada. Por favor inicia sesión nuevamente.');
            }
            throw new Error(data.error || 'Error en la solicitud');
        }
        return data;
    }

    // --- AUTENTICACIÓN ---
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
        window.location.href = 'login.html';
    }

    isAuthenticated() {
        return !!this.token;
    }

    getCurrentUser() {
        const userStr = localStorage.getItem('user');
        return userStr ? JSON.parse(userStr) : null;
    }

    // --- DEUDAS ---
    async getAllDebts(filters = {}) {
        const params = new URLSearchParams(filters);
        const response = await fetch(`${API_URL}/debts?${params}`, { headers: this.getHeaders() });
        return await this.handleResponse(response);
    }

    async createDebt(debtData) {
        const response = await fetch(`${API_URL}/debts`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify(debtData)
        });
        return await this.handleResponse(response);
    }

    async updateDebt(id, debtData) {
        const response = await fetch(`${API_URL}/debts/${id}`, {
            method: 'PUT',
            headers: this.getHeaders(),
            body: JSON.stringify(debtData)
        });
        return await this.handleResponse(response);
    }

    async deleteDebt(id) {
        const response = await fetch(`${API_URL}/debts/${id}`, {
            method: 'DELETE',
            headers: this.getHeaders()
        });
        // Si es 204 No Content, no intentamos parsear JSON
        if (response.status === 204) return true;
        return await this.handleResponse(response);
    }

    // --- PAGOS ---
    async createPayment(paymentData) {
        const response = await fetch(`${API_URL}/payments`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify(paymentData)
        });
        return await this.handleResponse(response);
    }

    // --- ESTADÍSTICAS ---
    async getStatistics() {
        const response = await fetch(`${API_URL}/statistics`, { headers: this.getHeaders() });
        return await this.handleResponse(response);
    }

    // --- BANCOS ---
    async getBanks() {
        const response = await fetch(`${API_URL}/banks`, { headers: this.getHeaders(false) });
        return await this.handleResponse(response);
    }
}

// INSTANCIA GLOBAL
// Esta línea es CRUCIAL. Hace que la variable 'api' exista para todos los archivos HTML.
const api = new DebtAPI();
console.log('API inicializada correctamente');