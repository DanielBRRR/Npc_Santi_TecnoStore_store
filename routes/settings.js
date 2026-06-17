const express = require('express');
const db = require('../config/database');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

const router = express.Router();

// GET /api/settings — leer configuración (solo admin)
router.get('/', authMiddleware, adminMiddleware, (req, res) => {
    db.all('SELECT key, value FROM settings', (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        const settings = {};
        rows.forEach(r => { settings[r.key] = r.value; });
        res.json(settings);
    });
});

// POST /api/settings — guardar configuración (solo admin)
router.post('/', authMiddleware, adminMiddleware, (req, res) => {
    const allowed = ['dolibarr_url', 'dolibarr_api_key'];
    const updates = [];

    allowed.forEach(key => {
        if (req.body[key] !== undefined) {
            updates.push({ key, value: req.body[key] });
        }
    });

    if (updates.length === 0) {
        return res.status(400).json({ error: 'No se proporcionaron campos válidos.' });
    }

    let pending = updates.length;
    const errors = [];

    updates.forEach(({ key, value }) => {
        db.run(
            'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
            [key, value],
            (err) => {
                if (err) errors.push(err.message);
                pending--;
                if (pending === 0) {
                    if (errors.length) return res.status(500).json({ error: errors.join(', ') });
                    res.json({ success: true });
                }
            }
        );
    });
});

// POST /api/settings/test — verificar conectividad con Dolibarr (solo admin)
router.post('/test', authMiddleware, adminMiddleware, async (req, res) => {
    const dolibarr = require('../lib/dolibarr');
    try {
        const settings = await dolibarr.getSettings(db);
        if (!dolibarr.isConfigured(settings)) {
            return res.status(400).json({ connected: false, error: 'ERP no configurado' });
        }
        const result = await dolibarr.request(settings, 'GET', 'status');
        if (result.ok) {
            res.json({ connected: true });
        } else {
            res.json({ connected: false, error: result.error || `HTTP ${result.code}` });
        }
    } catch (e) {
        res.json({ connected: false, error: e.message });
    }
});

// POST /api/settings/setup-erp — poblar el ERP con todos los productos del almacén (solo admin)
// Útil tras la instalación inicial de Dolibarr para sincronizar el inventario existente de una vez.
router.post('/setup-erp', authMiddleware, adminMiddleware, async (req, res) => {
    const dolibarr = require('../lib/dolibarr');
    try {
        const settings = await dolibarr.getSettings(db);
        if (!dolibarr.isConfigured(settings)) {
            return res.status(400).json({ error: 'ERP no configurado. Introduce la URL y API Key primero.' });
        }

        const products = await new Promise((resolve, reject) => {
            db.all('SELECT * FROM products ORDER BY category, name', (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        if (products.length === 0) {
            return res.json({ success: true, total: 0, created: 0, existing: 0, errors: [] });
        }

        let created = 0;
        let existing = 0;
        const errors = [];

        for (const product of products) {
            const result = await dolibarr.createProduct(db, product);
            if (result.ok) {
                if (result.existing) existing++;
                else created++;
            } else {
                errors.push({ sku: product.sku, error: result.error });
            }
        }

        res.json({
            success: true,
            total:    products.length,
            created,
            existing,
            errors,
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
