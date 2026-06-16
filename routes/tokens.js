const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');

const db = require('../config/database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// =========================
// CONFIG SEGURA
// =========================

if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET no configurado en variables de entorno');
}

const JWT_SECRET = process.env.JWT_SECRET;

// =========================
// ROLES / SCOPES
// =========================

const SCOPES = {
    READ: 'read:products',
    WRITE: 'write:products',
    ADMIN: 'admin'
};

// =========================
// MIDDLEWARES SEGURIDAD
// =========================

const requireAdmin = (req, res, next) => {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Acceso denegado (admin requerido)' });
    }
    next();
};

const tokenLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { error: 'Demasiadas peticiones, intenta más tarde' }
});

// =========================
// UTILIDADES
// =========================

const hashToken = (token) => {
    return crypto.createHash('sha256').update(token).digest('hex');
};

const auditLog = (userId, action, target = null) => {
    db.run(
        `INSERT INTO audit_logs (user_id, action, target)
         VALUES (?, ?, ?)`,
        [userId, action, target],
        () => {}
    );
};

// =========================
// VALIDACIÓN
// =========================

const validateGenerateToken = [
    body('scope')
        .isString()
        .notEmpty(),

    body('description')
        .optional()
        .isString()
        .isLength({ max: 255 })
];

// =========================
// POST /generate
// =========================

router.post(
    '/generate',
    tokenLimiter,
    authMiddleware,
    requireAdmin,
    validateGenerateToken,
    (req, res) => {

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { scope, description } = req.body;

        // Validar scopes permitidos
        const validScopes = Object.values(SCOPES);

        if (!validScopes.includes(scope)) {
            return res.status(400).json({
                error: `Scope inválido. Opciones: ${validScopes.join(', ')}`
            });
        }

        // Evitar abuso de admin scope
        if (scope === SCOPES.ADMIN && req.user.role !== 'superadmin') {
            return res.status(403).json({
                error: 'Solo superadmin puede generar tokens admin'
            });
        }

        const tokenId = crypto.randomUUID();

        const token = jwt.sign(
            {
                jti: tokenId,
                type: 'warehouse_api',
                scope,
                issued_by: req.user.userId,
                description: description || ''
            },
            JWT_SECRET,
            { expiresIn: '30d' }
        );

        const tokenHash = hashToken(token);

        db.run(
            `INSERT INTO api_tokens
             (token_hash, scope, description, created_by)
             VALUES (?, ?, ?, ?)`,
            [tokenHash, scope, description || '', req.user.userId],
            function (err) {
                if (err) {
                    return res.status(500).json({ error: err.message });
                }

                auditLog(req.user.userId, 'TOKEN_CREATED', tokenId);

                res.json({
                    id: this.lastID,
                    token,
                    scope,
                    description
                });
            }
        );
    }
);

// =========================
// GET / (solo admin)
// =========================

router.get(
    '/',
    authMiddleware,
    requireAdmin,
    (req, res) => {

        db.all(
            `SELECT t.id, t.scope, t.description, t.created_at,
                    u.username as created_by
             FROM api_tokens t
             LEFT JOIN users u ON t.created_by = u.id
             ORDER BY t.created_at DESC`,
            (err, rows) => {
                if (err) {
                    return res.status(500).json({ error: err.message });
                }

                res.json(rows);
            }
        );
    }
);

// =========================
// DELETE /:id (solo admin)
// =========================

router.delete(
    '/:id',
    authMiddleware,
    requireAdmin,
    (req, res) => {

        const tokenId = req.params.id;

        db.run(
            'DELETE FROM api_tokens WHERE id = ?',
            [tokenId],
            function (err) {
                if (err) {
                    return res.status(500).json({ error: err.message });
                }

                if (this.changes === 0) {
                    return res.status(404).json({
                        error: 'Token no encontrado'
                    });
                }

                auditLog(req.user.userId, 'TOKEN_DELETED', tokenId);

                res.json({ success: true });
            }
        );
    }
);

module.exports = router;