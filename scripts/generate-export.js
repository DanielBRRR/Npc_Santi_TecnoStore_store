const sqlite3 = require('sqlite3').verbose();

const fs = require('fs');
const path = require('path');


// ===============================
// Configuración segura
// ===============================


const args = process.argv.slice(2);


const dbArg =
    args.find(a => a.startsWith('--db='));

const outArg =
    args.find(a => a.startsWith('--output='));



if (!dbArg || !outArg) {

    console.error(
        'Uso: node generate-export.js --db=<ruta> --output=<fichero.csv>'
    );

    process.exitCode = 1;
    return;

}



const dbPath =
    path.resolve(
        dbArg.split('=')[1]
    );


const outPath =
    path.resolve(
        outArg.split('=')[1]
    );



// ===============================
// Restricciones rutas
// ===============================


// Solo permitir bases dentro del proyecto

const allowedDbDir =
    path.resolve(__dirname);


if(!dbPath.startsWith(allowedDbDir)){


    console.error(
        "Ruta de base de datos no permitida"
    );

    process.exitCode = 1;
    return;

}



// Exportaciones solo en carpeta exports

const exportDir =
    path.resolve(
        __dirname,
        'exports'
    );


if(!outPath.startsWith(exportDir)){


    console.error(
        "Ruta de exportación no permitida"
    );

    process.exitCode = 1;
    return;

}



// ===============================
// CSV seguro
// ===============================


function escapeCSV(value){


    if(value === null || value === undefined){

        return '';

    }


    let str =
        String(value);


    // Protección CSV Injection

    if(
        /^[=+\-@]/.test(str)
    ){

        str =
        "'" + str;

    }



    return `"${str.replace(/"/g,'""')}"`;

}



// ===============================
// Database
// ===============================


const db =
new sqlite3.Database(
    dbPath,
    sqlite3.OPEN_READONLY,
    err=>{


        if(err){

            console.error(
                "Error DB:",
                err.message
            );

            process.exitCode = 1;

        }

    }
);



// ===============================
// Export
// ===============================


db.all(

`
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

`,

(err,rows)=>{


    if(err){


        console.error(
            "Error consulta:",
            err.message
        );


        db.close();

        process.exitCode = 1;

        return;

    }



    const header =
    [
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



    const lines = rows.map(r =>

        [

            r.id,

            escapeCSV(r.sku),

            escapeCSV(r.name),

            escapeCSV(r.description),

            r.price,

            r.stock,

            escapeCSV(r.category),

            escapeCSV(r.created_at),

            escapeCSV(r.updated_at)


        ].join(',')

    );



    // Crear carpeta segura

    if(
        !fs.existsSync(exportDir)
    ){

        fs.mkdirSync(
            exportDir,
            {
                recursive:true,
                mode:0o750
            }
        );

    }



    fs.writeFileSync(

        outPath,

        header +
        lines.join('\n'),

        {
            encoding:'utf8',
            mode:0o640
        }

    );



    console.log(
        `Exportados ${rows.length} productos`
    );


    console.log(
        `Archivo: ${outPath}`
    );


    db.close();



});

