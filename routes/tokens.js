const express = require('express');
const jwt = require('jsonwebtoken');
const db = require('../config/database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'w4r3h0us3_jwt_s3cr3t';

// POST /api/tokens/generate
// VULNERABLE: el middleware solo verifica que el usuario esté autenticado,
// no que sea admin. La restricción existe solo en la UI del frontend.
router.post('/generate', authMiddleware, (req, res) => {
    const { scope, description } = req.body;

    const validScopes = ['read:products', 'write:products', 'admin'];
    if (!scope || !validScopes.includes(scope)) {
        return res.status(400).json({ error: `Scope inválido. Opciones: ${validScopes.join(', ')}` });
    }

    const token = jwt.sign(
        {
            type: 'warehouse_api',
            scope,
            issued_by: req.user.userId,
            description: description || ''
        },
        JWT_SECRET,
        { expiresIn: '365d' }
    );

    db.run(
        'INSERT INTO api_tokens (token, scope, description, created_by) VALUES (?, ?, ?, ?)',
        [token, scope, description || '', req.user.userId],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ id: this.lastID, token, scope, description });
        }
    );
});

// GET /api/tokens — lista tokens generados (solo admin en UI, no en backend)
router.get('/', authMiddleware, (req, res) => {
    db.all(
        `SELECT t.id, t.scope, t.description, t.created_at, u.username as created_by
         FROM api_tokens t LEFT JOIN users u ON t.created_by = u.id
         ORDER BY t.created_at DESC`,
        (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows);
        }
    );
});

// DELETE /api/tokens/:id
router.delete('/:id', authMiddleware, (req, res) => {
    db.run('DELETE FROM api_tokens WHERE id = ?', [req.params.id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(404).json({ error: 'Token no encontrado.' });
        res.json({ success: true });
    });
});

module.exports = router;
