require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');

const app = express();


// =====================================================
// CONFIGURACIÓN GENERAL
// =====================================================

app.disable('x-powered-by');

const PORT = process.env.PORT || 3000;


// =====================================================
// SEGURIDAD HTTP - HELMET
// =====================================================

app.use(
    helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],

                scriptSrc: [
                    "'self'"
                ],

                styleSrc: [
                    "'self'",
                    "'unsafe-inline'"
                ],

                imgSrc: [
                    "'self'",
                    "data:"
                ],

                connectSrc: [
                    "'self'"
                ]
            }
        }
    })
);


// =====================================================
// CORS
// =====================================================

const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',')
    : [
        `http://localhost:${PORT}`,
        'http://localhost:5173'
    ];


app.use(
    cors({

        origin: (origin, callback)=>{


            // Permitir Postman y herramientas sin origin
            if(!origin){
                return callback(null,true);
            }


            if(!allowedOrigins.includes(origin)){

                return callback(
                    new Error(
                        'Origen bloqueado por CORS'
                    )
                );

            }


            callback(null,true);

        },


        methods:[
            'GET',
            'POST',
            'PUT',
            'DELETE'
        ],


        allowedHeaders:[
            'Content-Type',
            'Authorization'
        ],


        credentials:false

    })
);



// =====================================================
// RATE LIMIT
// =====================================================

const limiter = rateLimit({

    windowMs:
        15 * 60 * 1000,


    max:
        150,


    message:{
        error:
        'Demasiadas peticiones, intenta más tarde'
    },


    standardHeaders:true,


    legacyHeaders:false

});


app.use(
    '/api',
    limiter
);



// =====================================================
// BODY PARSER
// =====================================================

app.use(
    express.json({
        limit:'15kb'
    })
);


app.use(
    express.urlencoded({
        extended:true,
        limit:'15kb'
    })
);



// =====================================================
// ARCHIVOS FRONTEND
// =====================================================

app.use(
    express.static(
        path.join(__dirname,'public')
    )
);



// =====================================================
// RUTAS API
// =====================================================


const authRoutes =
    require('./routes/auth');


const productsRoutes =
    require('./routes/products');


const usersRoutes =
    require('./routes/users');


const tokensRoutes =
    require('./routes/tokens');


const exportRoutes =
    require('./routes/export');


const salesRoutes =
    require('./routes/sales');


const settingsRoutes =
    require('./routes/settings');



// Debug opcional
console.log("Routes cargadas correctamente");



app.use(
    '/api/auth',
    authRoutes
);


app.use(
    '/api/products',
    productsRoutes
);


app.use(
    '/api/users',
    usersRoutes
);


app.use(
    '/api/tokens',
    tokensRoutes
);


app.use(
    '/api/export',
    exportRoutes
);


app.use(
    '/api/sales',
    salesRoutes
);


app.use(
    '/api/settings',
    settingsRoutes
);



// =====================================================
// SPA FALLBACK
// =====================================================

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



// =====================================================
// ERROR HANDLER
// =====================================================

app.use(
    (err,req,res,next)=>{


        console.error(
            '[SERVER ERROR]',
            err.message
        );


        res.status(500).json({

            error:
            'Error interno del servidor'

        });


    }
);



// =====================================================
// START SERVER
// =====================================================

app.listen(
    PORT,
    ()=>{


        console.log(`
========================================

 TecnoStore Almacén iniciado

 Puerto:
 ${PORT}

 Entorno:
 ${process.env.NODE_ENV || 'development'}

========================================
        `);


    }
);