const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../config/database');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

const router = express.Router();

// GET /api/users — solo admins (enforced en backend)
router.get('/', authMiddleware, adminMiddleware, (req, res) => {
    db.all('SELECT id, username, email, role, created_at FROM users ORDER BY created_at DESC', (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// GET /api/users/:id
router.get('/:id', authMiddleware, adminMiddleware, (req, res) => {
    db.get('SELECT id, username, email, role, created_at FROM users WHERE id = ?', [req.params.id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: 'Usuario no encontrado.' });
        res.json(row);
    });
});

// POST /api/users
router.post('/', authMiddleware, adminMiddleware, async (req, res) => {
    const { username, email, password, role } = req.body;

    if (!username || !email || !password) {
        return res.status(400).json({ error: 'Username, email y contraseña son obligatorios.' });
    }

    const hashed = await bcrypt.hash(password, 10);

    db.run(
        'INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)',
        [username, email, hashed, role || 'user'],
        function (err) {
            if (err) {
                if (err.message.includes('UNIQUE')) {
                    return res.status(409).json({ error: 'El username o email ya existe.' });
                }
                return res.status(500).json({ error: err.message });
            }
            res.status(201).json({ id: this.lastID, username, email, role: role || 'user' });
        }
    );
});

// PUT /api/users/:id
router.put('/:id', authMiddleware, adminMiddleware, async (req, res) => {
    const { username, email, password, role } = req.body;
    const userId = req.params.id;

    let hashed = null;
    if (password) {
        hashed = await bcrypt.hash(password, 10);
    }

    const fields = [];
    const values = [];

    if (username) { fields.push('username = ?'); values.push(username); }
    if (email)    { fields.push('email = ?');    values.push(email); }
    if (hashed)   { fields.push('password = ?'); values.push(hashed); }
    if (role)     { fields.push('role = ?');     values.push(role); }

    if (fields.length === 0) {
        return res.status(400).json({ error: 'No se proporcionaron campos para actualizar.' });
    }

    values.push(userId);

    db.run(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values, function (err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(404).json({ error: 'Usuario no encontrado.' });
        res.json({ success: true });
    });
});

// DELETE /api/users/:id
router.delete('/:id', authMiddleware, adminMiddleware, (req, res) => {
    if (parseInt(req.params.id) === req.user.userId) {
        return res.status(400).json({ error: 'No puedes eliminar tu propio usuario.' });
    }

    db.run('DELETE FROM users WHERE id = ?', [req.params.id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(404).json({ error: 'Usuario no encontrado.' });
        res.json({ success: true });
    });
});

module.exports = router;
