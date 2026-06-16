require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');

const app = express();

// Ocultar la cabecera por defecto de Express para mitigar el escaneo de vulnerabilidades
app.disable('x-powered-by'); 

const PORT = process.env.PORT || 3000;

// =========================================================================
// 1. CONFIGURACIÓN DE SEGURIDAD GLOBAL (POLÍTICAS Y CABECERAS)
// =========================================================================

// Helmet: Configura cabeceras HTTP seguras para proteger contra ataques comunes
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            // Permite scripts locales
            scriptSrc: ["'self'"], 
            // Permite eventos en línea como onclick/onsubmit en el HTML frontend
            scriptSrcAttr: ["'unsafe-inline'"], 
            // Permite estilos locales y bloques <style> inline si los tienes
            styleSrc: ["'self'", "'unsafe-inline'"], 
            imgSrc: ["'self'", "data:"],
            connectSrc: ["'self'"]
        },
    },
}));

// CORS: Configuración de orígenes permitidos (No usar '*' en producción)
const allowedOrigins = process.env.ALLOWED_ORIGINS 
    ? process.env.ALLOWED_ORIGINS.split(',') 
    : ['http://localhost:3000', `http://localhost:${PORT}`];

app.use(cors({
    origin: function (origin, callback) {
        // Permitir peticiones sin origen (como herramientas de desarrollo/Postman o apps nativas)
        if (!origin) return callback(null, true);
        
        if (allowedOrigins.indexOf(origin) === -1) {
            const msg = 'La política de CORS de TecnoStore no permite el acceso desde el origen especificado.';
            return callback(new Error(msg), false);
        }
        return callback(null, true);
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true // Cambiar a true si manejas cookies de sesión o cookies seguras de JWT
}));

// Rate Limiting: Previene ataques de fuerza bruta o denegación de servicio (DoS)
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // Ventana de tiempo: 15 minutos
    max: 150, // Límite de 150 peticiones por IP en este rango de tiempo
    message: { error: 'Demasiadas peticiones desde esta IP. Por favor, inténtelo de nuevo más tarde.' },
    standardHeaders: true, // Devuelve información de límites en cabeceras estándar `RateLimit-*`
    legacyHeaders: false,  // Desactiva cabeceras antiguas `X-RateLimit-*`
});

// Aplicamos el límite de peticiones estrictamente a todas las rutas que comiencen con /api
app.use('/api/', apiLimiter);

// Control de tamaño del Body: Evita la inyección de payloads masivos que congelen el servidor
app.use(express.json({ limit: '15kb' })); 
app.use(express.urlencoded({ extended: true, limit: '15kb' }));

// Servidor de archivos estáticos (Frontend)
app.use(express.static(path.join(__dirname, 'public')));


// =========================================================================
// 2. RUTAS DE LA API (CONTROLADORES)
// =========================================================================
app.use('/api/auth',     require('./routes/auth'));
app.use('/api/products', require('./routes/products'));
app.use('/api/users',    require('./routes/users'));
app.use('/api/tokens',   require('./routes/tokens'));
app.use('/api/export',   require('./routes/export'));
app.use('/api/sales',    require('./routes/sales'));
app.use('/api/settings', require('./routes/settings'));


// =========================================================================
// 3. FALLBACK PARA SPA (SINGLE PAGE APPLICATION)
// =========================================================================
// Redirige cualquier ruta del navegador que no sea de la API directamente al index.html
app.get(/^(?!\/api).*/, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});


// =========================================================================
// 4. CONTROLADOR CENTRALIZADO DE ERRORES (MANEJO SEGURO)
// =========================================================================
// Evita que la aplicación colapse ante un fallo no controlado y oculta detalles del sistema
app.use((err, req, res, next) => {
    // Registramos internamente el error completo para auditoría técnica
    console.error(`[Error de Servidor]:`, err.stack); 

    res.status(500).json({
        error: 'Ocurrió un error interno en el servidor.',
        // Solo expone detalles técnicos si estás en un entorno local de desarrollo
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});


// =========================================================================
// 5. INICIALIZACIÓN DEL SERVIDOR
// =========================================================================
app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(` TecnoStore Almacén está corriendo de forma segura`);
    console.log(` Entorno: ${process.env.NODE_ENV || 'development'}`);
    console.log(` Puerto: ${PORT}`);
    console.log(`====================================================`);
});