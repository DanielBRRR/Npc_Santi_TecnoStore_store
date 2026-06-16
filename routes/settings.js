const express = require('express');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');

const db = require('../config/database');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

const router = express.Router();


// ==============================
// RATE LIMIT
// ==============================

const settingsLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: {
        error: 'Demasiadas peticiones'
    }
});


// ==============================
// CAMPOS PERMITIDOS
// ==============================

const ALLOWED_SETTINGS = [
    'dolibarr_url',
    'dolibarr_api_key'
];


// ==============================
// ENCRIPTAR SECRETOS
// ==============================

const encrypt = (value) => {

    const key = crypto
        .createHash('sha256')
        .update(process.env.JWT_SECRET)
        .digest();

    const iv = crypto.randomBytes(16);

    const cipher = crypto.createCipheriv(
        'aes-256-cbc',
        key,
        iv
    );

    const encrypted = Buffer.concat([
        cipher.update(value),
        cipher.final()
    ]);


    return iv.toString('hex') +
        ':' +
        encrypted.toString('hex');
};



const decrypt = (data) => {

    const parts = data.split(':');

    const iv = Buffer.from(parts[0], 'hex');

    const encrypted = Buffer.from(
        parts[1],
        'hex'
    );


    const key = crypto
        .createHash('sha256')
        .update(process.env.JWT_SECRET)
        .digest();


    const decipher = crypto.createDecipheriv(
        'aes-256-cbc',
        key,
        iv
    );


    return Buffer.concat([
        decipher.update(encrypted),
        decipher.final()
    ]).toString();

};



// ==============================
// AUDITORIA
// ==============================


const audit = (
    user,
    action
)=>{

    db.run(
        `
        INSERT INTO audit_logs
        (user_id, action)
        VALUES (?,?)
        `,
        [
            user.userId,
            action
        ]
    );

};




// ==============================
// VALIDACION
// ==============================


const validateSettings = [

    body('dolibarr_url')
        .optional()
        .isURL()
        .withMessage('URL inválida'),


    body('dolibarr_api_key')
        .optional()
        .isLength({
            min:20,
            max:500
        })

];





// ==============================
// GET SETTINGS
// ==============================


router.get(
'/',
authMiddleware,
adminMiddleware,
settingsLimiter,

(req,res)=>{


db.all(
`
SELECT key,value
FROM settings
`,
(err,rows)=>{


if(err){

return res.status(500)
.json({
error:'Error interno'
});

}



const settings={};


rows.forEach(r=>{


if(
r.key === 'dolibarr_api_key'
){

settings[r.key]='********';

}
else{

settings[r.key]=r.value;

}



});


res.json(settings);



});


});






// ==============================
// UPDATE SETTINGS
// ==============================



router.post(
'/',
authMiddleware,
adminMiddleware,
settingsLimiter,

validateSettings,

(req,res)=>{


const errors =
validationResult(req);


if(!errors.isEmpty()){

return res.status(400)
.json({
errors:errors.array()
});

}



const updates=[];



ALLOWED_SETTINGS.forEach(key=>{


if(req.body[key] !== undefined){


let value=req.body[key];


// cifrar API KEY
if(key === 'dolibarr_api_key'){

value = encrypt(value);

}



updates.push({
key,
value
});


}


});



if(updates.length===0){

return res.status(400)
.json({
error:'Nada que actualizar'
});

}




let pending=updates.length;

let failed=false;



updates.forEach(
({key,value})=>{


db.run(

`
INSERT INTO settings(key,value)
VALUES(?,?)

ON CONFLICT(key)
DO UPDATE SET value=excluded.value

`,

[
key,
value
],


(err)=>{


if(err){

failed=true;

}


pending--;



if(pending===0){


if(failed){

return res.status(500)
.json({
error:'No se pudo guardar'
});

}



audit(
req.user,
'SETTINGS_UPDATED'
);



res.json({
success:true
});


}



});


});



});







// ==============================
// TEST ERP
// ==============================



router.post(
'/test',
authMiddleware,
adminMiddleware,
settingsLimiter,

async(req,res)=>{


try{


const dolibarr =
require('../lib/dolibarr');



const settings =
await dolibarr.getSettings(db);



if(!dolibarr.isConfigured(settings)){


return res.status(400)
.json({

connected:false,

error:'ERP no configurado'

});


}



const result =
await dolibarr.request(
settings,
'GET',
'status'
);



audit(
req.user,
'ERP_TEST'
);



res.json({

connected:result.ok,

error:
result.ok
? null
: 'No conectado'

});



}

catch(err){


res.status(500)
.json({

error:'Error conectando ERP'

});


}



});










// ==============================
// SETUP ERP
// ==============================



router.post(

'/setup-erp',

authMiddleware,
adminMiddleware,
rateLimit({

windowMs:60*60*1000,

max:3

}),


async(req,res)=>{


try{


const dolibarr =
require('../lib/dolibarr');



const settings =
await dolibarr.getSettings(db);



if(!dolibarr.isConfigured(settings)){


return res.status(400)
.json({

error:'ERP no configurado'

});

}




const products =
await new Promise(
(resolve,reject)=>{


db.all(

`
SELECT *
FROM products
LIMIT 1000
`,

(err,rows)=>{


if(err)
reject(err);

else
resolve(rows);


});


});





let created=0;
let existing=0;
let errors=[];



for(
const product of products
){


try{


const result =
await dolibarr.createProduct(
db,
product
);



if(result.ok){


result.existing
? existing++
: created++;


}

else{


errors.push({

sku:product.sku,

error:'fallo sincronización'

});


}


}

catch(e){


errors.push({

sku:product.sku,

error:'error interno'

});


}


}




audit(
req.user,
'ERP_FULL_SYNC'
);



res.json({

success:true,

total:products.length,

created,

existing,

errors

});




}
catch(e){


res.status(500)
.json({

error:'Error interno'

});


}



});




module.exports = router;