require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();

const PORT = process.env.PORT || 3000;


// =========================
// SEGURIDAD
// =========================

// Oculta Express
app.disable('x-powered-by');


// Cabeceras seguras
app.use(
    helmet({
        contentSecurityPolicy: false
    })
);


// Limitar peticiones
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 200,
    message: {
        error: "Demasiadas peticiones, intenta más tarde"
    }
});

app.use('/api', limiter);


// CORS seguro
app.use(
    cors({
        origin: process.env.FRONTEND_URL || 'http://localhost:3000',
        methods: [
            'GET',
            'POST',
            'PUT',
            'DELETE'
        ],
        credentials: true
    })
);


// =========================
// MIDDLEWARES
// =========================

app.use(
    express.json({
        limit: '10kb'
    })
);


app.use(
    express.urlencoded({
        extended: true,
        limit: '10kb'
    })
);


app.use(
    express.static(
        path.join(__dirname, 'public'),
        {
            maxAge: '1d'
        }
    )
);



// =========================
// RUTAS
// =========================


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


        if (typeof router !== 'function') {

            throw new Error(
                `${route.file} no exporta un router válido`
            );

        }


        app.use(
            route.path,
            router
        );


        console.log(
            `✓ Ruta cargada: ${route.path}`
        );


    } catch(error) {


        console.error(
            `✗ Error cargando ${route.file}:`,
            error.message
        );


        // No rompe todo el proyecto
        // si una ruta falla

    }

});



// =========================
// FRONTEND SPA
// =========================


app.get(
    /^(?!\/api).*/,
    (req,res)=>{

        res.sendFile(
            path.join(
                __dirname,
                'public',
                'index.html'
            )
        );

    }
);



// =========================
// ERRORES
// =========================


// Ruta inexistente API

app.use(
    '/api',
    (req,res)=>{

        res.status(404).json({
            error:"Endpoint no encontrado"
        });

    }
);



// Error global

app.use(
    (err,req,res,next)=>{


        console.error(
            err.stack
        );


        res.status(
            err.status || 500
        )
        .json({

            error:
            process.env.NODE_ENV === 'production'
            ?
            "Error interno del servidor"
            :
            err.message

        });


    }
);




// =========================
// START
// =========================


app.listen(
    PORT,
    ()=>{

        console.log(
            `TecnoStore Almacén corriendo en http://localhost:${PORT}`
        );

    }
);