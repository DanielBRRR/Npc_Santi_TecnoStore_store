require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Rutas API
app.use('/api/auth',    require('./routes/auth'));
app.use('/api/products', require('./routes/products'));
app.use('/api/users',   require('./routes/users'));
app.use('/api/tokens',  require('./routes/tokens'));
app.use('/api/export',  require('./routes/export'));
app.use('/api/sales',    require('./routes/sales'));
app.use('/api/settings', require('./routes/settings'));

// SPA fallback — todas las rutas del frontend apuntan al index
app.get(/^(?!\/api).*/, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`TecnoStore Almacén corriendo en http://localhost:${PORT}`);
});