const crypto = require('crypto');
const { pool } = require('./db');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key';
const TOKEN_TTL_SECONDS = (() => {
  const envTtl = process.env.JWT_TTL || '86400';
  if (envTtl.endsWith('d')) {
    return Number(envTtl.replace('d', '')) * 86400;
  }
  if (envTtl.endsWith('h')) {
    return Number(envTtl.replace('h', '')) * 3600;
  }
  return Number(envTtl) || 86400;
})();

async function createUser({ name, email, password }) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hashed = crypto.scryptSync(password, salt, 64).toString('hex');
  const passwordHash = `${salt}:${hashed}`;
  const query = `
    INSERT INTO users (name, email, password_hash, avatar)
    VALUES ($1, $2, $3, $4)
    RETURNING id, name, email, avatar
  `;
  const { rows } = await pool.query(query, [name, email, passwordHash, name[0]?.toUpperCase() || 'U']);
  return rows[0];
}

async function findUserByEmail(email) {
  const { rows } = await pool.query('SELECT id, name, email, password_hash, avatar FROM users WHERE email = $1', [email]);
  return rows[0];
}

function verifyPassword(password, storedHash) {
  const [salt, key] = storedHash.split(':');
  const hashed = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(key, 'hex'), Buffer.from(hashed, 'hex'));
}

function generateToken(user) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = {
    id: user.id,
    email: user.email,
    exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
  };
  const payloadStr = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${header}.${payloadStr}`)
    .digest('base64url');
  return `${header}.${payloadStr}.${signature}`;
}

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ')
    ? authHeader.slice('Bearer '.length)
    : null;

  if (!token) {
    return res.status(401).json({ error: 'No se proporcionó token de autenticación' });
  }

  try {
    const [header, payload, signature] = token.split('.');
    const expected = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${payload}`).digest('base64url');
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
      return res.status(401).json({ error: 'Token inválido' });
    }

    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (decoded.exp && decoded.exp < Math.floor(Date.now() / 1000)) {
      return res.status(401).json({ error: 'Token expirado' });
    }

    req.user = { id: decoded.id, email: decoded.email };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
}

module.exports = {
  authMiddleware,
  createUser,
  findUserByEmail,
  generateToken,
  verifyPassword,
};
