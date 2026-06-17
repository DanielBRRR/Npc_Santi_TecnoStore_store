const express = require('express');
const jwt = require('jsonwebtoken');
const db = require('../config/database');

const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'w4r3h0us3_jwt_s3cr3t';


// Middleware de administrador
const adminMiddleware = (req, res, next) => {

    if (!req.user) {
        return res.status(401).json({
            error: 'Usuario no autenticado'
        });
    }


    if (req.user.role !== 'admin') {
        return res.status(403).json({
            error: 'Acceso denegado. Se requieren permisos de administrador'
        });
    }


    next();
};





/*
POST /api/tokens/generate

Generar token API

Solo administradores
*/
router.post(
    '/generate',
    authMiddleware,
    adminMiddleware,
    (req, res) => {


        const { scope, description } = req.body;


        const validScopes = [
            'read:products',
            'write:products',
            'admin'
        ];


        if (!scope || !validScopes.includes(scope)) {

            return res.status(400).json({
                error: `Scope inválido. Opciones: ${validScopes.join(', ')}`
            });

        }



        const tokenPayload = {

            type: 'warehouse_api',

            scope,

            issued_by: req.user.userId,

            description: description || ''

        };



        const token = jwt.sign(

            tokenPayload,

            JWT_SECRET,

            {
                expiresIn: '365d'
            }

        );




        db.run(

            `
            INSERT INTO api_tokens
            (
                token,
                scope,
                description,
                created_by
            )

            VALUES (?, ?, ?, ?)

            `,

            [
                token,
                scope,
                description || '',
                req.user.userId
            ],


            function(err){


                if(err){

                    return res.status(500).json({
                        error: err.message
                    });

                }



                res.status(201).json({

                    id: this.lastID,

                    token,

                    scope,

                    description: description || ''

                });


            }


        );


    }

);









/*
GET /api/tokens

Listar tokens

Solo admins
*/
router.get(
    '/',
    authMiddleware,
    adminMiddleware,
    (req,res)=>{


        db.all(

            `
            SELECT 

            t.id,
            t.scope,
            t.description,
            t.created_at,

            u.username AS created_by


            FROM api_tokens t


            LEFT JOIN users u

            ON t.created_by = u.id


            ORDER BY t.created_at DESC

            `,


            (err,rows)=>{


                if(err){

                    return res.status(500).json({

                        error:err.message

                    });

                }



                res.json(rows);


            }


        );


    }

);









/*
DELETE /api/tokens/:id

Eliminar token

Admin puede borrar cualquiera
Usuario normal solo el suyo
*/
router.delete(
    '/:id',
    authMiddleware,
    async(req,res)=>{


        const tokenId = req.params.id;



        db.get(

            `
            SELECT created_by

            FROM api_tokens

            WHERE id = ?

            `,

            [
                tokenId
            ],


            (err,token)=>{


                if(err){

                    return res.status(500).json({
                        error:err.message
                    });

                }




                if(!token){

                    return res.status(404).json({

                        error:'Token no encontrado'

                    });

                }




                // Si no es admin solo puede borrar sus tokens

                if(

                    req.user.role !== 'admin'

                    &&

                    token.created_by !== req.user.userId

                ){

                    return res.status(403).json({

                        error:'No puedes eliminar este token'

                    });

                }




                db.run(

                    `
                    DELETE FROM api_tokens

                    WHERE id = ?

                    `,

                    [
                        tokenId
                    ],


                    function(err){


                        if(err){

                            return res.status(500).json({

                                error:err.message

                            });

                        }




                        res.json({

                            success:true

                        });



                    }


                );



            }



        );


    }

);






module.exports = router;