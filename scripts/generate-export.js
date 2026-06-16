'use strict';

const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);

const dbArg = args.find(arg => arg.startsWith('--db='));
const outArg = args.find(arg => arg.startsWith('--output='));

if (!dbArg || !outArg) {
    console.error('Uso: node generate-export.js --db=<ruta_db> --output=<archivo.csv>');
    process.exit(1);
}

const dbPath = path.resolve(dbArg.substring(5));
const outPath = path.resolve(outArg.substring(9));

try {
    if (!fs.existsSync(dbPath)) {
        throw new Error(`La base de datos no existe: ${dbPath}`);
    }

    if (path.extname(outPath).toLowerCase() !== '.csv') {
        throw new Error('El fichero de salida debe tener extensión .csv');
    }
} catch (err) {
    console.error(err.message);
    process.exit(1);
}

function sanitizeCSV(value) {
    if (value === null || value === undefined) {
        return '';
    }

    let str = String(value);

    // Protección contra CSV Injection
    if (/^[=+\-@]/.test(str)) {
        str = `'${str}`;
    }

    return `"${str.replace(/"/g, '""')}"`;
}

const db = new sqlite3.Database(
    dbPath,
    sqlite3.OPEN_READONLY,
    (err) => {
        if (err) {
            console.error(`Error abriendo la BD: ${err.message}`);
            process.exit(1);
        }
    }
);

const query = `
    SELECT
        id,
        sku,
        name,
        description,
        price,
        stock,
        category,
        created_at,
        updated_at
    FROM products
    ORDER BY name ASC
`;

db.all(query, [], (err, rows) => {
    try {
        if (err) {
            throw err;
        }

        const header = [
            'id',
            'sku',
            'name',
            'description',
            'price',
            'stock',
            'category',
            'created_at',
            'updated_at'
        ].join(',') + '\n';

        const csvRows = rows.map(row => [
            row.id,
            sanitizeCSV(row.sku),
            sanitizeCSV(row.name),
            sanitizeCSV(row.description),
            row.price ?? 0,
            row.stock ?? 0,
            sanitizeCSV(row.category),
            sanitizeCSV(row.created_at),
            sanitizeCSV(row.updated_at)
        ].join(','));

        const outputDir = path.dirname(outPath);

        fs.mkdirSync(outputDir, { recursive: true });

        fs.writeFileSync(
            outPath,
            header + csvRows.join('\n'),
            {
                encoding: 'utf8',
                mode: 0o600
            }
        );

        console.log(
            `Exportados ${rows.length} productos correctamente a: ${outPath}`
        );
    } catch (error) {
        console.error(`Error durante la exportación: ${error.message}`);
        process.exitCode = 1;
    } finally {
        db.close((closeErr) => {
            if (closeErr) {
                console.error(`Error cerrando la BD: ${closeErr.message}`);
            }
        });
    }
});