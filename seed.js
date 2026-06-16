require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('./config/database');

const BCRYPT_ROUNDS = 12;

/**
 * Ejecutar consultas SQLite usando Promesas
 */
function runQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) reject(err);
            else resolve(this);
        });
    });
}

/**
 * Validación de contraseñas seguras
 */
function validatePassword(password) {
    return (
        typeof password === 'string' &&
        password.length >= 12 &&
        /[A-Z]/.test(password) &&
        /[a-z]/.test(password) &&
        /\d/.test(password) &&
        /[^A-Za-z0-9]/.test(password)
    );
}

/**
 * Validación básica de productos
 */
function validateProduct(product) {
    if (!product.sku || product.sku.length < 3) {
        throw new Error(`SKU inválido: ${product.sku}`);
    }

    if (!product.name || product.name.length < 3) {
        throw new Error(`Nombre inválido para SKU ${product.sku}`);
    }

    if (typeof product.price !== 'number' || product.price < 0) {
        throw new Error(`Precio inválido para SKU ${product.sku}`);
    }

    if (!Number.isInteger(product.stock) || product.stock < 0) {
        throw new Error(`Stock inválido para SKU ${product.sku}`);
    }
}

/**
 * Validar entorno
 */
function validateEnvironment() {

    if (process.env.ALLOW_SEED !== 'true') {
        throw new Error(
            'Ejecución bloqueada. Debes establecer ALLOW_SEED=true para ejecutar el seed.'
        );
    }

    const requiredVariables = [
        'SEED_ADMIN_PASSWORD',
        'SEED_ALMACEN_PASSWORD',
        'SEED_MANAGER_PASSWORD'
    ];

    for (const variable of requiredVariables) {
        if (!process.env[variable]) {
            throw new Error(`Falta la variable de entorno: ${variable}`);
        }
    }

    const passwords = [
        process.env.SEED_ADMIN_PASSWORD,
        process.env.SEED_ALMACEN_PASSWORD,
        process.env.SEED_MANAGER_PASSWORD
    ];

    if (!passwords.every(validatePassword)) {
        throw new Error(
            'Las contraseñas deben tener mínimo 12 caracteres, mayúsculas, minúsculas, números y símbolos.'
        );
    }
}

(async () => {

    console.log('🔒 Iniciando proceso seguro de seed...\n');

    try {

        validateEnvironment();

        await runQuery('BEGIN TRANSACTION');

        // ============================================================
        // USUARIOS
        // ============================================================

        const users = [
            {
                username: 'admin',
                email: 'admin@tecnostore.local',
                password: process.env.SEED_ADMIN_PASSWORD,
                role: 'admin'
            },
            {
                username: 'almacen',
                email: 'almacen@tecnostore.local',
                password: process.env.SEED_ALMACEN_PASSWORD,
                role: 'user'
            },
            {
                username: 'manager',
                email: 'manager@tecnostore.local',
                password: process.env.SEED_MANAGER_PASSWORD,
                role: 'admin'
            }
        ];

        console.log('👤 Sincronizando usuarios...\n');

        for (const user of users) {

            const hash = await bcrypt.hash(
                user.password,
                BCRYPT_ROUNDS
            );

            await runQuery(
                `
                INSERT INTO users (
                    username,
                    email,
                    password,
                    role
                )
                VALUES (?, ?, ?, ?)
                ON CONFLICT(email)
                DO UPDATE SET
                    username = excluded.username,
                    password = excluded.password,
                    role = excluded.role
                `,
                [
                    user.username,
                    user.email,
                    hash,
                    user.role
                ]
            );

            console.log(
                `  ✅ Usuario sincronizado: ${user.username} [${user.role}]`
            );

            user.password = null;
        }

        console.log('\n📦 Sincronizando catálogo de productos...\n');

        // ============================================================
        // PRODUCTOS
        // ============================================================

        const products = [
            {
                sku: 'DLXPS15-I7-16-512',
                name: 'Laptop Dell XPS 15 — i7, 16GB, 512GB SSD',
                price: 1349.00,
                stock: 12,
                category: 'portatiles',
                description: 'Portátil premium con pantalla OLED 15.6", Intel Core i7-13700H, 16GB DDR5 y SSD NVMe 512GB.'
            },
            {
                sku: 'LNTPX1C-I5-8-256',
                name: 'Lenovo ThinkPad X1 Carbon Gen 11 — i5, 8GB, 256GB',
                price: 1099.00,
                stock: 8,
                category: 'portatiles',
                description: 'Ultrabook empresarial 14", 1.12 kg, batería 15h.'
            },
            {
                sku: 'HPEB840-R7-16-512',
                name: 'HP EliteBook 840 G10 — Ryzen 7, 16GB, 512GB',
                price: 1199.00,
                stock: 6,
                category: 'portatiles',
                description: 'Portátil profesional AMD Ryzen 7 7730U, WiFi 6E.'
            },
            {
                sku: 'ASRGZ14-R9-4060-16',
                name: 'ASUS ROG Zephyrus G14 — Ryzen 9, RTX 4060, 16GB',
                price: 1649.00,
                stock: 5,
                category: 'portatiles',
                description: 'Gaming ultracompacto QHD 165Hz, MUX Switch.'
            },
            {
                sku: 'CPU-I9-13900K',
                name: 'Intel Core i9-13900K — 24 núcleos, LGA1700',
                price: 549.00,
                stock: 15,
                category: 'componentes',
                description: '8P+16E núcleos, hasta 5.8GHz turbo.'
            },
            {
                sku: 'CPU-R9-7950X',
                name: 'AMD Ryzen 9 7950X — 16 núcleos, AM5',
                price: 629.00,
                stock: 10,
                category: 'componentes',
                description: '16 núcleos / 32 hilos, hasta 5.7GHz boost.'
            }
            // Continúa con el resto de productos...
        ];

        for (const product of products) {

            validateProduct(product);

            await runQuery(
                `
                INSERT INTO products (
                    sku,
                    name,
                    description,
                    price,
                    stock,
                    category
                )
                VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT(sku)
                DO UPDATE SET
                    name = excluded.name,
                    description = excluded.description,
                    price = excluded.price,
                    stock = excluded.stock,
                    category = excluded.category
                `,
                [
                    product.sku,
                    product.name,
                    product.description,
                    product.price,
                    product.stock,
                    product.category
                ]
            );

            console.log(
                `  ✅ Producto sincronizado: ${product.sku}`
            );
        }

        await runQuery('COMMIT');

        delete process.env.SEED_ADMIN_PASSWORD;
        delete process.env.SEED_ALMACEN_PASSWORD;
        delete process.env.SEED_MANAGER_PASSWORD;

        console.log(
            '\n🎉 Seed ejecutado correctamente y de forma segura.'
        );

        process.exit(0);

    } catch (error) {

        try {
            await runQuery('ROLLBACK');
        } catch (_) {}

        console.error(
            '\n❌ Error durante la ejecución del seed:\n'
        );

        console.error(error.message);

        process.exit(1);
    }

})();