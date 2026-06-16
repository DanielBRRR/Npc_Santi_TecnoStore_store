const express = require('express');
const db = require('../config/database');
const { authMiddleware, apiTokenMiddleware } = require('../middleware/auth');

const router = express.Router();

// POST /api/sales — WordPress notifica una venta completada
// Requiere JWT con scope write:products o admin
router.post('/', apiTokenMiddleware('write:products'), (req, res) => {
    const { order_id, items, customer_email, status = 'completed' } = req.body;

    if (
        !order_id ||
        !Array.isArray(items) ||
        items.length === 0 ||
        items.length > 1000
    ) {
        return res.status(400).json({
            error: 'Petición inválida.'
        });
    }

    const validStatuses = ['completed', 'pending', 'cancelled', 'refunded'];

    if (!validStatuses.includes(status)) {
        return res.status(400).json({
            error: 'Estado inválido.'
        });
    }

    // Validación previa de todos los items
    for (const item of items) {
        if (!item.sku) {
            return res.status(400).json({
                error: 'Todos los productos deben tener SKU.'
            });
        }

        const qty = Number(item.quantity);
        const price = Number(item.unit_price ?? 0);

        if (!Number.isInteger(qty) || qty <= 0) {
            return res.status(400).json({
                error: `Cantidad inválida para SKU ${item.sku}`
            });
        }

        if (!Number.isFinite(price) || price < 0) {
            return res.status(400).json({
                error: `Precio inválido para SKU ${item.sku}`
            });
        }
    }

    db.serialize(() => {

        db.run("BEGIN TRANSACTION");

        let failed = false;
        let completed = 0;

        const rollback = (err) => {
            if (failed) return;

            failed = true;

            db.run("ROLLBACK", () => {
                res.status(500).json({
                    error: err.message || "Error interno."
                });
            });
        };

        for (const item of items) {

            const qty = Number(item.quantity);
            const price = Number(item.unit_price ?? 0);
            const total = qty * price;

            // Evita duplicados
            db.get(
                `SELECT id
                 FROM sales
                 WHERE order_id = ?
                 AND product_sku = ?`,
                [order_id, item.sku],
                (err, existing) => {

                    if (failed) return;

                    if (err) {
                        return rollback(err);
                    }

                    if (existing) {
                        return rollback(
                            new Error(`La venta ${order_id}/${item.sku} ya existe.`)
                        );
                    }

                    db.run(
                        `INSERT INTO sales
                        (
                            order_id,
                            product_sku,
                            product_name,
                            quantity,
                            unit_price,
                            total,
                            customer_email,
                            status
                        )
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                        [
                            order_id,
                            item.sku,
                            item.name || item.sku,
                            qty,
                            price,
                            total,
                            customer_email || null,
                            status
                        ],
                        function (err) {

                            if (failed) return;

                            if (err) {
                                return rollback(err);
                            }

                            if (status !== 'completed') {
                                completed++;

                                if (completed === items.length) {
                                    db.run("COMMIT", () => {
                                        res.json({
                                            success: true
                                        });
                                    });
                                }

                                return;
                            }

                            db.get(
                                `SELECT id, stock
                                 FROM products
                                 WHERE sku = ?`,
                                [item.sku],
                                (err, product) => {

                                    if (failed) return;

                                    if (err) {
                                        return rollback(err);
                                    }

                                    if (!product) {
                                        return rollback(
                                            new Error(`Producto ${item.sku} no encontrado.`)
                                        );
                                    }

                                    const newStock = Math.max(
                                        0,
                                        product.stock - qty
                                    );

                                    db.run(
                                        `UPDATE products
                                         SET stock = ?,
                                             updated_at = strftime('%s','now')
                                         WHERE id = ?`,
                                        [
                                            newStock,
                                            product.id
                                        ],
                                        (err) => {

                                            if (failed) return;

                                            if (err) {
                                                return rollback(err);
                                            }

                                            db.run(
                                                `INSERT INTO stock_movements
                                                (
                                                    product_id,
                                                    quantity_change,
                                                    reason,
                                                    created_by
                                                )
                                                VALUES (?, ?, ?, ?)`,
                                                [
                                                    product.id,
                                                    -qty,
                                                    `Venta WooCommerce #${order_id}`,
                                                    null
                                                ],
                                                (err) => {

                                                    if (failed) return;

                                                    if (err) {
                                                        return rollback(err);
                                                    }

                                                    completed++;

                                                    if (completed === items.length) {

                                                        db.run(
                                                            "COMMIT",
                                                            (err) => {

                                                                if (err) {
                                                                    return rollback(err);
                                                                }

                                                                res.json({
                                                                    success: true
                                                                });
                                                            }
                                                        );

                                                    }

                                                }
                                            );

                                        }
                                    );

                                }
                            );

                        }
                    );

                }
            );

        }

    });

});