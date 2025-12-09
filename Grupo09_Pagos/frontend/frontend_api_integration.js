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

    // AUTENTICACIÓN
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
        localStorage.clear();
        window.location.href = 'login.html';
    }

    isAuthenticated() { return !!this.token; }
    getCurrentUser() { return JSON.parse(localStorage.getItem('user')); }

    // NEGOCIO
    async getStatistics() { return this.req('/statistics'); }
    async getAllDebts(params) { 
        const qs = new URLSearchParams(params).toString();
        const res = await fetch(`${API_URL}/debts?${qs}`, { headers: this.getHeaders() });
        return await this.handleResponse(res);
    }
    async createDebt(data) { 
        const res = await fetch(`${API_URL}/debts`, { 
            method: 'POST', headers: this.getHeaders(), body: JSON.stringify(data) 
        });
        return await this.handleResponse(res);
    }
    async createPayment(data) {
        const res = await fetch(`${API_URL}/payments`, {
            method: 'POST', headers: this.getHeaders(), body: JSON.stringify(data)
        });
        return await this.handleResponse(res);
    }
    
    // RECUPERACIÓN (Si la usas)
    async requestResetCode(email) {
        const res = await fetch(`${API_URL}/auth/forgot-password`, {
            method: 'POST', headers: this.getHeaders(false), body: JSON.stringify({ email })
        });
        return await this.handleResponse(res);
    }
    async confirmPasswordReset(email, code, newPassword) {
        const res = await fetch(`${API_URL}/auth/reset-password`, {
            method: 'POST', headers: this.getHeaders(false), body: JSON.stringify({ email, code, newPassword })
        });
        return await this.handleResponse(res);
    }
}

// --- SOLUCIÓN DEL ERROR ---
// Guardamos la API en la ventana global para que todos la vean
window.api = new DebtAPI(); 
// NO declaramos 'const api' aquí para evitar conflictos.
console.log('API lista en window.api');