const express = require('express');
const db = require('../config/database');
const { authMiddleware, apiTokenMiddleware } = require('../middleware/auth');

const router = express.Router();

// POST /api/sales — WordPress notifica una venta completada
// Requiere JWT con scope write:products o admin
router.post('/', apiTokenMiddleware('write:products'), (req, res) => {
    const { order_id, items, customer_email, status } = req.body;

    if (!order_id || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'order_id e items son obligatorios.' });
    }

    const saleStatus = status || 'completed';
    const results = { registered: 0, stock_updated: 0, errors: [] };
    let pending = items.length;

    items.forEach(item => {
        const { sku, name, quantity, unit_price } = item;

        if (!sku || !quantity) {
            results.errors.push(`Item sin SKU o cantidad: ${JSON.stringify(item)}`);
            pending--;
            if (pending === 0) res.json({ success: true, ...results });
            return;
        }

        const qty   = parseInt(quantity);
        const price = parseFloat(unit_price) || 0;
        const total = price * qty;

        // Registrar la venta
        db.run(
            `INSERT INTO sales (order_id, product_sku, product_name, quantity, unit_price, total, customer_email, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [order_id, sku, name || sku, qty, price, total, customer_email || null, saleStatus],
            (err) => {
                if (err) {
                    results.errors.push(`Error registrando ${sku}: ${err.message}`);
                } else {
                    results.registered++;
                }

                // Descontar stock si la venta está completada
                if (saleStatus === 'completed') {
                    db.get('SELECT id, stock FROM products WHERE sku = ?', [sku], (err, product) => {
                        if (product) {
                            const newStock = Math.max(0, product.stock - qty);
                            db.run(
                                `UPDATE products SET stock = ?, updated_at = strftime('%s','now') WHERE id = ?`,
                                [newStock, product.id]
                            );
                            db.run(
                                `INSERT INTO stock_movements (product_id, quantity_change, reason, created_by)
                                 VALUES (?, ?, ?, ?)`,
                                [product.id, -qty, `Venta WooCommerce #${order_id}`, null]
                            );
                            results.stock_updated++;
                        }

                        pending--;
                        if (pending === 0) res.json({ success: true, ...results });
                    });
                } else {
                    pending--;
                    if (pending === 0) res.json({ success: true, ...results });
                }
            }
        );
    });
});

// GET /api/sales — listado de ventas
router.get('/', authMiddleware, (req, res) => {
    const limit  = parseInt(req.query.limit)  || 50;
    const offset = parseInt(req.query.offset) || 0;
    const sku    = req.query.sku    || '';
    const status = req.query.status || '';

    let where  = [];
    let params = [];

    if (sku)    { where.push("product_sku LIKE ?");  params.push(`%${sku}%`); }
    if (status) { where.push("status = ?");           params.push(status); }

    const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';

    db.all(
        `SELECT * FROM sales ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
        [...params, limit, offset],
        (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows);
        }
    );
});

// GET /api/sales/stats — estadísticas de ventas
router.get('/stats', authMiddleware, (req, res) => {
    db.get(
        `SELECT
            COUNT(*)                          AS total_lines,
            COUNT(DISTINCT order_id)          AS total_orders,
            COALESCE(SUM(total), 0)           AS total_revenue,
            COALESCE(SUM(quantity), 0)        AS total_units,
            COALESCE(AVG(total), 0)           AS avg_order_value
         FROM sales WHERE status = 'completed'`,
        (err, stats) => {
            if (err) return res.status(500).json({ error: err.message });

            db.all(
                `SELECT product_sku, product_name, SUM(quantity) AS units_sold, SUM(total) AS revenue
                 FROM sales WHERE status = 'completed'
                 GROUP BY product_sku ORDER BY units_sold DESC LIMIT 5`,
                (err, top) => {
                    if (err) return res.status(500).json({ error: err.message });
                    res.json({ ...stats, top_products: top });
                }
            );
        }
    );
});

// GET /api/sales/order/:order_id — detalle de un pedido completo
router.get('/order/:order_id', authMiddleware, (req, res) => {
    db.all(
        'SELECT * FROM sales WHERE order_id = ? ORDER BY id ASC',
        [req.params.order_id],
        (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            if (rows.length === 0) return res.status(404).json({ error: 'Pedido no encontrado.' });
            res.json(rows);
        }
    );
});

// GET /api/sales/:id — detalle de una línea de venta
router.get('/:id', authMiddleware, (req, res) => {
    db.get('SELECT * FROM sales WHERE id = ?', [req.params.id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: 'Venta no encontrada.' });
        res.json(row);
    });
});

// PATCH /api/sales/:id/status — actualizar estado de una línea
router.patch('/:id/status', authMiddleware, (req, res) => {
    const { status } = req.body;
    const valid = ['completed', 'pending', 'cancelled', 'refunded'];

    if (!valid.includes(status)) {
        return res.status(400).json({ error: `Estado inválido. Opciones: ${valid.join(', ')}` });
    }

    db.run(
        'UPDATE sales SET status = ? WHERE id = ?',
        [status, req.params.id],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });
            if (this.changes === 0) return res.status(404).json({ error: 'Venta no encontrada.' });
            res.json({ success: true, status });
        }
    );
});

module.exports = router;
