require('dotenv').config();

const bcrypt = require('bcryptjs');
const db = require('./config/database');


// ===============================
// Protección ejecución seed
// ===============================

if (process.env.SEED_ENABLED !== "true") {

    console.error(
        "Seed deshabilitado. Activa SEED_ENABLED=true"
    );

    process.exit(1);

}



if (process.env.NODE_ENV === "production") {

    console.error(
        "No ejecutes seed en producción"
    );

    process.exit(1);

}



console.log(
    "Iniciando seed...\n"
);




// ===============================
// Usuarios
// ===============================


const users = [

    {
        username:
        process.env.ADMIN_USER,

        email:
        process.env.ADMIN_EMAIL,

        password:
        process.env.ADMIN_PASSWORD,

        role:"admin"
    },


    {
        username:
        process.env.STOCK_USER,

        email:
        process.env.STOCK_EMAIL,

        password:
        process.env.STOCK_PASSWORD,

        role:"user"
    },


    {
        username:
        process.env.MANAGER_USER,

        email:
        process.env.MANAGER_EMAIL,

        password:
        process.env.MANAGER_PASSWORD,

        role:"admin"
    }

];



async function insertUsers(){


    for(const u of users){


        if(!u.password){

            console.error(
                `Password faltante para ${u.username}`
            );

            continue;

        }


        const hash =
        await bcrypt.hash(
            u.password,
            12
        );



        await new Promise((resolve)=>{


            db.run(

                `
                INSERT OR IGNORE INTO users
                (
                    username,
                    email,
                    password,
                    role
                )
                VALUES (?, ?, ?, ?)
                `,

                [
                    u.username,
                    u.email,
                    hash,
                    u.role
                ],


                err=>{


                    if(err){

                        console.error(
                            `[ERROR] Usuario ${u.username}:`,
                            err.message
                        );


                    }else{


                        console.log(
                            `[OK] Usuario creado: ${u.username}`
                        );


                    }


                    resolve();

                }

            );


        });


    }


}



// ===============================
// Productos
// ===============================

async function insertProducts(){


    for(const p of products){


        await new Promise(resolve=>{


            db.run(

                `
                INSERT OR IGNORE INTO products
                (
                    sku,
                    name,
                    description,
                    price,
                    stock,
                    category
                )

                VALUES (?, ?, ?, ?, ?, ?)

                `,


                [
                    p.sku,
                    p.name,
                    p.description,
                    p.price,
                    p.stock,
                    p.category
                ],


                err=>{


                    if(err){

                        console.error(
                            `[ERROR] ${p.sku}:`,
                            err.message
                        );


                    }else{


                        console.log(
                            `[OK] Producto: ${p.sku}`
                        );


                    }


                    resolve();


                }


            );


        });


    }


}



// ===============================
// Ejecutar
// ===============================


(async()=>{


    try{


        await insertUsers();


        console.log("");

        await insertProducts();



        console.log(
            "\nSeed completado correctamente"
        );


    }


    catch(error){


        console.error(
            "Error crítico seed:",
            error.message
        );


        process.exitCode = 1;


    }


    finally{


        if(db.close){

            db.close();

        }


    }


})();