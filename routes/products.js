const express = require('express');
const rateLimit = require('express-rate-limit');
const { body, param, query, validationResult } = require('express-validator');

const db = require('../config/database');
const {
    authMiddleware,
    apiTokenMiddleware,
    adminMiddleware
} = require('../middleware/auth');

const dolibarr = require('../lib/dolibarr');

const router = express.Router();


// =============================
// RATE LIMIT
// =============================

const productLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    message:{
        error:'Demasiadas peticiones'
    }
});


// =============================
// AUDITORIA
// =============================

const audit = (user, action, target)=>{

    db.run(
        `
        INSERT INTO audit_logs
        (user_id,action,target)
        VALUES (?,?,?)
        `,
        [
            user.userId,
            action,
            target
        ]
    );

};



// =============================
// VALIDACIONES
// =============================


const validateProduct = [

    body('sku')
        .isString()
        .isLength({
            min:1,
            max:50
        }),

    body('name')
        .isString()
        .isLength({
            min:1,
            max:150
        }),

    body('price')
        .optional()
        .isFloat({
            min:0
        }),

    body('stock')
        .optional()
        .isInt({
            min:0
        })

];





// =================================
// GET PRODUCTS
// =================================


router.get(
'/',
productLimiter,

apiTokenMiddleware('read:products'),

[
query('search')
.optional()
.isLength({
max:100
}),

query('category')
.optional()
.isLength({
max:50
})

],

(req,res)=>{


const errors =
validationResult(req);


if(!errors.isEmpty()){

return res.status(400)
.json({
error:'Parametros invalidos'
});

}



const search =
req.query.search || '';

const category =
req.query.category || '';



let sql =
`
SELECT *
FROM products
WHERE 1=1
`;



const params=[];



if(search){


sql += `
AND
(
name LIKE ?
OR sku LIKE ?
OR description LIKE ?
)
`;


const value =
`%${search}%`;


params.push(
value,
value,
value
);

}



if(category){


sql += `
AND category = ?
`;

params.push(category);


}



sql += `
ORDER BY name ASC
`;




db.all(
sql,
params,

(err,rows)=>{


if(err){

return res.status(500)
.json({
error:'Error interno'
});

}


res.json(rows);



});


});








// =================================
// GET ONE
// =================================


router.get(
'/:id',

authMiddleware,

param('id').isInt(),

(req,res)=>{


db.get(

`
SELECT *
FROM products
WHERE id=?
`,

[
req.params.id
],

(err,row)=>{


if(err){

return res.status(500)
.json({
error:'Error interno'
});

}



if(!row){

return res.status(404)
.json({
error:'Producto no encontrado'
});

}



res.json(row);



});


});










// =================================
// CREATE
// =================================


router.post(

'/',

authMiddleware,
adminMiddleware,

validateProduct,

(req,res)=>{


const errors =
validationResult(req);


if(!errors.isEmpty()){

return res.status(400)
.json({
error:'Datos invalidos'
});

}



const {
sku,
name,
description,
price,
stock,
category
}=req.body;



db.run(

`
INSERT INTO products
(
sku,
name,
description,
price,
stock,
category
)
VALUES(?,?,?,?,?,?)
`,

[
sku,
name,
description || '',
price || 0,
stock || 0,
category || ''
],


function(err){


if(err){

return res.status(500)
.json({
error:'Error creando producto'
});

}



db.get(
`
SELECT *
FROM products
WHERE id=?
`,
[
this.lastID
],

(err,row)=>{


if(row){

dolibarr
.createProduct(db,row)
.catch(()=>{});

}



audit(
req.user,
'PRODUCT_CREATED',
this.lastID
);



res.status(201)
.json(row);



});



});



});








// =================================
// UPDATE
// =================================


router.put(

'/:id',

authMiddleware,
adminMiddleware,

validateProduct,

(req,res)=>{


const {
sku,
name,
description,
price,
stock,
category
}=req.body;



db.run(

`
UPDATE products SET

sku=?,
name=?,
description=?,
price=?,
stock=?,
category=?,
updated_at=strftime('%s','now')

WHERE id=?

`,

[
sku,
name,
description,
price,
stock,
category,
req.params.id
],


function(err){


if(err){

return res.status(500)
.json({
error:'Error interno'
});

}



if(this.changes===0){

return res.status(404)
.json({
error:'Producto no encontrado'
});

}



audit(
req.user,
'PRODUCT_UPDATED',
req.params.id
);



res.json({
success:true
});


});


});










// =================================
// STOCK
// =================================


router.patch(

'/:id/stock',

authMiddleware,

[
param('id').isInt(),

body('quantity')
.isInt()
.custom(v=>v!==0)

],


(req,res)=>{


const quantity =
Number(req.body.quantity);



db.get(

`
SELECT stock
FROM products
WHERE id=?
`,

[
req.params.id
],

(err,product)=>{


if(err)
return res.status(500)
.json({
error:'Error interno'
});



if(!product){

return res.status(404)
.json({
error:'Producto no encontrado'
});

}



const newStock =
product.stock + quantity;



if(newStock < 0){

return res.status(400)
.json({
error:'Stock insuficiente'
});

}



db.run(

`
UPDATE products
SET stock=?
WHERE id=?
`,

[
newStock,
req.params.id
],

(err)=>{


if(err){

return res.status(500)
.json({
error:'Error actualizando stock'
});

}



db.run(

`
INSERT INTO stock_movements
(
product_id,
quantity_change,
reason,
created_by
)

VALUES(?,?,?,?)

`,

[
req.params.id,
quantity,
req.body.reason || '',
req.user.userId
]


);



audit(
req.user,
'STOCK_UPDATED',
req.params.id
);



res.json({
success:true,
stock:newStock
});



});



});



});









// =================================
// MOVEMENTS
// =================================


router.get(

'/:id/movements',

authMiddleware,


(req,res)=>{


db.all(

`
SELECT sm.*,u.username

FROM stock_movements sm

LEFT JOIN users u
ON sm.created_by=u.id

WHERE sm.product_id=?

ORDER BY sm.created_at DESC

LIMIT 50

`,

[
req.params.id
],

(err,rows)=>{


if(err){

return res.status(500)
.json({
error:'Error interno'
});

}


res.json(rows);



});


});








// =================================
// DELETE
// =================================


router.delete(

'/:id',

authMiddleware,
adminMiddleware,


(req,res)=>{


db.run(

`
DELETE FROM products
WHERE id=?
`,

[
req.params.id
],

function(err){


if(err){

return res.status(500)
.json({
error:'Error interno'
});

}



if(this.changes===0){

return res.status(404)
.json({
error:'Producto no encontrado'
});

}



audit(
req.user,
'PRODUCT_DELETED',
req.params.id
);



res.json({
success:true
});



});


});




module.exports = router;