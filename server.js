require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));


// Cargar rutas de forma segura
const routes = [
    { path: '/api/auth', file: './routes/auth' },
    { path: '/api/products', file: './routes/products' },
    { path: '/api/users', file: './routes/users' },
    { path: '/api/tokens', file: './routes/tokens' },
    { path: '/api/export', file: './routes/export' },
    { path: '/api/sales', file: './routes/sales' },
    { path: '/api/settings', file: './routes/settings' }
];


routes.forEach(route => {
    try {

        const router = require(route.file);

        console.log(
            route.file,
            '=>',
            typeof router
        );

        if (typeof router !== 'function') {
            throw new Error(
                `${route.file} no exporta un router válido`
            );
        }

        app.use(route.path, router);

        console.log(`✓ Ruta cargada: ${route.path}`);

    } catch (error) {

        console.error(
            `✗ Error cargando ${route.file}:`,
            error.message
        );

        process.exit(1);
    }
});


// SPA fallback
app.get(/^(?!\/api).*/, (req, res) => {
    res.sendFile(
        path.join(__dirname, 'public', 'index.html')
    );
});


// Servidor
app.listen(PORT, () => {
    console.log(
        `TecnoStore Almacén corriendo en http://localhost:${PORT}`
    );
});