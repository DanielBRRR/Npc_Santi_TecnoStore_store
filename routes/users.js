const express = require('express');
const bcrypt = require('bcryptjs');
const validator = require('validator');
const db = require('../config/database');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

const router = express.Router();

const ALLOWED_ROLES = ['user', 'admin'];
const BCRYPT_ROUNDS = 12;

function isValidId(id) {
    const num = Number(id);
    return Number.isInteger(num) && num > 0;
}

// =====================
// GET /api/users
// =====================
router.get('/', authMiddleware, adminMiddleware, (req, res) => {
    db.all(
        `SELECT id, username, email, role, created_at
         FROM users
         ORDER BY created_at DESC`,
        [],
        (err, rows) => {
            if (err) {
                console.error(err);
                return res.status(500).json({
                    error: 'Error interno del servidor.'
                });
            }

            res.json(rows);
        }
    );
});

// =====================
// GET /api/users/:id
// =====================
router.get('/:id', authMiddleware, adminMiddleware, (req, res) => {
    if (!isValidId(req.params.id)) {
        return res.status(400).json({
            error: 'ID inválido.'
        });
    }

    db.get(
        `SELECT id, username, email, role, created_at
         FROM users
         WHERE id = ?`,
        [req.params.id],
        (err, row) => {
            if (err) {
                console.error(err);
                return res.status(500).json({
                    error: 'Error interno del servidor.'
                });
            }

            if (!row) {
                return res.status(404).json({
                    error: 'Usuario no encontrado.'
                });
            }

            res.json(row);
        }
    );
});

// =====================
// POST /api/users
// =====================
router.post('/', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        let { username, email, password, role } = req.body;

        username = typeof username === 'string' ? username.trim() : '';
        email = typeof email === 'string' ? email.trim().toLowerCase() : '';

        if (!username || username.length < 3 || username.length > 50) {
            return res.status(400).json({
                error: 'Username inválido.'
            });
        }

        if (!validator.isEmail(email)) {
            return res.status(400).json({
                error: 'Email inválido.'
            });
        }

        if (typeof password !== 'string' || password.length < 12) {
            return res.status(400).json({
                error: 'La contraseña debe tener al menos 12 caracteres.'
            });
        }

        role = ALLOWED_ROLES.includes(role) ? role : 'user';

        db.get(
            `SELECT id FROM users
             WHERE username = ? OR email = ?`,
            [username, email],
            async (err, existing) => {
                if (err) {
                    console.error(err);
                    return res.status(500).json({
                        error: 'Error interno del servidor.'
                    });
                }

                if (existing) {
                    return res.status(409).json({
                        error: 'El username o email ya existe.'
                    });
                }

                const hashed = await bcrypt.hash(password, BCRYPT_ROUNDS);

                db.run(
                    `INSERT INTO users
                    (username, email, password, role)
                    VALUES (?, ?, ?, ?)`,
                    [username, email, hashed, role],
                    function (err) {
                        if (err) {
                            console.error(err);
                            return res.status(500).json({
                                error: 'Error interno del servidor.'
                            });
                        }

                        res.status(201).json({
                            id: this.lastID,
                            username,
                            email,
                            role
                        });
                    }
                );
            }
        );
    } catch (err) {
        console.error(err);

        res.status(500).json({
            error: 'Error interno del servidor.'
        });
    }
});

// =====================
// PUT /api/users/:id
// =====================
router.put('/:id', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        if (!isValidId(req.params.id)) {
            return res.status(400).json({
                error: 'ID inválido.'
            });
        }

        const userId = Number(req.params.id);

        let { username, email, password, role } = req.body;

        const fields = [];
        const values = [];

        if (username !== undefined) {
            username = username.trim();

            if (username.length < 3 || username.length > 50) {
                return res.status(400).json({
                    error: 'Username inválido.'
                });
            }

            fields.push('username = ?');
            values.push(username);
        }

        if (email !== undefined) {
            email = email.trim().toLowerCase();

            if (!validator.isEmail(email)) {
                return res.status(400).json({
                    error: 'Email inválido.'
                });
            }

            fields.push('email = ?');
            values.push(email);
        }

        if (password !== undefined) {
            if (password.length < 12) {
                return res.status(400).json({
                    error: 'La contraseña debe tener al menos 12 caracteres.'
                });
            }

            const hashed = await bcrypt.hash(password, BCRYPT_ROUNDS);

            fields.push('password = ?');
            values.push(hashed);
        }

        if (role !== undefined) {
            if (!ALLOWED_ROLES.includes(role)) {
                return res.status(400).json({
                    error: 'Rol inválido.'
                });
            }

            if (
                req.user.userId === userId &&
                role !== 'admin'
            ) {
                return res.status(400).json({
                    error: 'No puedes quitarte el rol de administrador.'
                });
            }

            fields.push('role = ?');
            values.push(role);
        }

        if (fields.length === 0) {
            return res.status(400).json({
                error: 'No hay campos para actualizar.'
            });
        }

        db.get(
            `SELECT id
             FROM users
             WHERE (username = ? OR email = ?)
             AND id != ?`,
            [
                username || '',
                email || '',
                userId
            ],
            (err, duplicate) => {
                if (err) {
                    console.error(err);

                    return res.status(500).json({
                        error: 'Error interno del servidor.'
                    });
                }

                if (duplicate) {
                    return res.status(409).json({
                        error: 'El username o email ya está en uso.'
                    });
                }

                values.push(userId);

                db.run(
                    `UPDATE users
                     SET ${fields.join(', ')}
                     WHERE id = ?`,
                    values,
                    function (err) {
                        if (err) {
                            console.error(err);

                            return res.status(500).json({
                                error: 'Error interno del servidor.'
                            });
                        }

                        if (this.changes === 0) {
                            return res.status(404).json({
                                error: 'Usuario no encontrado.'
                            });
                        }

                        res.json({
                            success: true
                        });
                    }
                );
            }
        );
    } catch (err) {
        console.error(err);

        res.status(500).json({
            error: 'Error interno del servidor.'
        });
    }
});

// =====================
// DELETE /api/users/:id
// =====================
router.delete('/:id', authMiddleware, adminMiddleware, (req, res) => {
    if (!isValidId(req.params.id)) {
        return res.status(400).json({
            error: 'ID inválido.'
        });
    }

    const userId = Number(req.params.id);

    if (userId === req.user.userId) {
        return res.status(400).json({
            error: 'No puedes eliminar tu propio usuario.'
        });
    }

    db.get(
        `SELECT role FROM users WHERE id = ?`,
        [userId],
        (err, targetUser) => {
            if (err) {
                console.error(err);

                return res.status(500).json({
                    error: 'Error interno del servidor.'
                });
            }

            if (!targetUser) {
                return res.status(404).json({
                    error: 'Usuario no encontrado.'
                });
            }

            if (targetUser.role === 'admin') {
                db.get(
                    `SELECT COUNT(*) AS total
                     FROM users
                     WHERE role = 'admin'`,
                    [],
                    (err, row) => {
                        if (err) {
                            console.error(err);

                            return res.status(500).json({
                                error: 'Error interno del servidor.'
                            });
                        }

                        if (row.total <= 1) {
                            return res.status(400).json({
                                error: 'No se puede eliminar el último administrador.'
                            });
                        }

                        removeUser(userId, res);
                    }
                );
            } else {
                removeUser(userId, res);
            }
        }
    );
});

function removeUser(userId, res) {
    db.run(
        `DELETE FROM users WHERE id = ?`,
        [userId],
        function (err) {
            if (err) {
                console.error(err);

                return res.status(500).json({
                    error: 'Error interno del servidor.'
                });
            }

            if (this.changes === 0) {
                return res.status(404).json({
                    error: 'Usuario no encontrado.'
                });
            }

            res.json({
                success: true
            });
        }
    );
}

module.exports = router;