-- Base de datos: debt_manager
-- Sistema de gestión de deudas

-- Tabla de usuarios
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    avatar VARCHAR(10) DEFAULT 'K',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de bancos/instituciones financieras
CREATE TABLE banks (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(50) UNIQUE,
    logo_url VARCHAR(255),
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de deudas
CREATE TABLE debts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    bank_id INTEGER REFERENCES banks(id),
    bank_name VARCHAR(100) NOT NULL,
    description VARCHAR(255) NOT NULL,
    amount DECIMAL(12, 2) NOT NULL CHECK (amount > 0),
    paid_amount DECIMAL(12, 2) DEFAULT 0 CHECK (paid_amount >= 0),
    due_date DATE NOT NULL,
    frequency VARCHAR(20) CHECK (frequency IN ('mensual', 'quincenal', 'semanal', 'unico')),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'overdue', 'paid')),
    created_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_paid_amount CHECK (paid_amount <= amount)
);

-- Tabla de historial de pagos
CREATE TABLE payment_history (
    id SERIAL PRIMARY KEY,
    debt_id INTEGER NOT NULL REFERENCES debts(id) ON DELETE CASCADE,
    amount DECIMAL(12, 2) NOT NULL CHECK (amount > 0),
    payment_date DATE NOT NULL,
    payment_method VARCHAR(50) CHECK (payment_method IN ('tarjeta', 'transferencia', 'efectivo', 'otro')),
    reference VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de notificaciones
CREATE TABLE notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    debt_id INTEGER REFERENCES debts(id) ON DELETE CASCADE,
    type VARCHAR(50) CHECK (type IN ('overdue', 'due_soon', 'payment_reminder', 'payment_success')),
    title VARCHAR(150) NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para optimizar consultas
CREATE INDEX idx_debts_user_id ON debts(user_id);
CREATE INDEX idx_debts_status ON debts(status);
CREATE INDEX idx_debts_due_date ON debts(due_date);
CREATE INDEX idx_payment_history_debt_id ON payment_history(debt_id);
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);

-- Trigger para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_debts_updated_at BEFORE UPDATE ON debts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger para actualizar el estado de deudas vencidas automáticamente
CREATE OR REPLACE FUNCTION check_overdue_debts()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.due_date < CURRENT_DATE AND NEW.status = 'pending' AND NEW.paid_amount < NEW.amount THEN
        NEW.status = 'overdue';
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER trigger_check_overdue BEFORE INSERT OR UPDATE ON debts
    FOR EACH ROW EXECUTE FUNCTION check_overdue_debts();

-- Función para obtener estadísticas de deudas por usuario
CREATE OR REPLACE FUNCTION get_debt_statistics(p_user_id INTEGER)
RETURNS TABLE (
    total_debts BIGINT,
    total_amount DECIMAL(12, 2),
    pending_count BIGINT,
    pending_amount DECIMAL(12, 2),
    overdue_count BIGINT,
    overdue_amount DECIMAL(12, 2),
    paid_count BIGINT,
    paid_amount DECIMAL(12, 2)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::BIGINT as total_debts,
        COALESCE(SUM(amount), 0) as total_amount,
        COUNT(*) FILTER (WHERE status = 'pending')::BIGINT as pending_count,
        COALESCE(SUM(amount - paid_amount) FILTER (WHERE status = 'pending'), 0) as pending_amount,
        COUNT(*) FILTER (WHERE status = 'overdue')::BIGINT as overdue_count,
        COALESCE(SUM(amount - paid_amount) FILTER (WHERE status = 'overdue'), 0) as overdue_amount,
        COUNT(*) FILTER (WHERE status = 'paid')::BIGINT as paid_count,
        COALESCE(SUM(paid_amount) FILTER (WHERE status = 'paid'), 0) as paid_amount
    FROM debts
    WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- Datos iniciales: Bancos peruanos
INSERT INTO banks (name, code) VALUES 
    ('BCP', 'BCP'),
    ('BBVA', 'BBVA'),
    ('Interbank', 'INTERBANK'),
    ('Scotiabank', 'SCOTIABANK'),
    ('Banco de la Nación', 'BN'),
    ('Banco Pichincha', 'PICHINCHA'),
    ('Banco Falabella', 'FALABELLA'),
    ('MiBanco', 'MIBANCO'),
    ('Otro', 'OTHER');

-- Vista para consultas rápidas de deudas con información relacionada
CREATE VIEW debts_detailed AS
SELECT 
    d.id,
    d.user_id,
    d.bank_name,
    b.logo_url as bank_logo,
    d.description,
    d.amount,
    d.paid_amount,
    (d.amount - d.paid_amount) as remaining_amount,
    d.due_date,
    d.frequency,
    d.status,
    d.created_date,
    CASE 
        WHEN d.due_date < CURRENT_DATE AND d.status != 'paid' THEN 'overdue'
        WHEN d.due_date = CURRENT_DATE AND d.status != 'paid' THEN 'due_today'
        WHEN d.due_date <= CURRENT_DATE + INTERVAL '7 days' AND d.status != 'paid' THEN 'due_soon'
        ELSE 'normal'
    END as urgency,
    (d.due_date - CURRENT_DATE) as days_until_due,
    COUNT(ph.id) as payment_count,
    d.created_at,
    d.updated_at
FROM debts d
LEFT JOIN banks b ON d.bank_id = b.id
LEFT JOIN payment_history ph ON d.id = ph.debt_id
GROUP BY d.id, b.logo_url;