require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('./config/database');

console.log('Iniciando seed...\n');

setTimeout(async () => {
    // -----------------------------------------------------------------------
    // Usuarios por defecto
    // -----------------------------------------------------------------------
    const users = [
        { username: 'admin',     email: 'admin@tecnostore.local',   password: 'admin123',     role: 'admin' },
        { username: 'almacen',   email: 'almacen@tecnostore.local', password: 'Almacen2024!', role: 'user' },
        { username: 'manager',   email: 'manager@tecnostore.local', password: 'Manager2024!', role: 'admin' },
    ];

    for (const u of users) {
        const hash = await bcrypt.hash(u.password, 10);
        await new Promise((resolve) => {
            db.run(
                'INSERT OR IGNORE INTO users (username, email, password, role) VALUES (?, ?, ?, ?)',
                [u.username, u.email, hash, u.role],
                (err) => {
                    if (err) console.error(`  [error] ${u.username}:`, err.message);
                    else console.log(`  [ok]   usuario: ${u.username} / ${u.password} (${u.role})`);
                    resolve();
                }
            );
        });
    }

    console.log('');

    // -----------------------------------------------------------------------
    // Productos
    // -----------------------------------------------------------------------
    const products = [
        { sku: 'DLXPS15-I7-16-512', name: 'Laptop Dell XPS 15 — i7, 16GB, 512GB SSD', price: 1349.00, stock: 12, category: 'portatiles', description: 'Portátil premium con pantalla OLED 15.6", Intel Core i7-13700H, 16GB DDR5 y SSD NVMe 512GB.' },
        { sku: 'LNTPX1C-I5-8-256',  name: 'Lenovo ThinkPad X1 Carbon Gen 11 — i5, 8GB, 256GB', price: 1099.00, stock: 8, category: 'portatiles', description: 'Ultrabook empresarial 14", 1.12 kg, batería 15h.' },
        { sku: 'HPEB840-R7-16-512', name: 'HP EliteBook 840 G10 — Ryzen 7, 16GB, 512GB', price: 1199.00, stock: 6, category: 'portatiles', description: 'Portátil profesional AMD Ryzen 7 7730U, WiFi 6E.' },
        { sku: 'ASRGZ14-R9-4060-16', name: 'ASUS ROG Zephyrus G14 — Ryzen 9, RTX 4060, 16GB', price: 1649.00, stock: 5, category: 'portatiles', description: 'Gaming ultracompacto QHD 165Hz, MUX Switch.' },
        { sku: 'CPU-I9-13900K',      name: 'Intel Core i9-13900K — 24 núcleos, LGA1700', price: 549.00, stock: 15, category: 'componentes', description: '8P+16E núcleos, hasta 5.8GHz turbo.' },
        { sku: 'CPU-R9-7950X',       name: 'AMD Ryzen 9 7950X — 16 núcleos, AM5', price: 629.00, stock: 10, category: 'componentes', description: '16 núcleos / 32 hilos, hasta 5.7GHz boost.' },
        { sku: 'GPU-RTX4070TI-12G',  name: 'NVIDIA GeForce RTX 4070 Ti 12GB GDDR6X', price: 799.00, stock: 7, category: 'componentes', description: 'GPU Ada Lovelace, DLSS 3.0, ray tracing.' },
        { sku: 'RAM-COR-DDR5-32G',   name: 'Corsair Vengeance DDR5 32GB 5600MHz', price: 129.00, stock: 25, category: 'componentes', description: 'Kit DDR5 XMP 3.0, compatible Intel 12/13ª gen y AM5.' },
        { sku: 'MB-ASROGZ790E',      name: 'ASUS ROG Strix Z790-E Gaming WiFi', price: 449.00, stock: 9, category: 'componentes', description: 'ATX LGA1700, VRM 18+1, PCIe 5.0, WiFi 6E.' },
        { sku: 'MON-LG27GP950',      name: 'LG 27GP950-B — 27" 4K UHD 144Hz IPS', price: 699.00, stock: 11, category: 'monitores', description: 'Nano IPS, HDMI 2.1, G-Sync Compatible, DCI-P3 98%.' },
        { sku: 'MON-SAM-G9-49',      name: 'Samsung Odyssey G9 — 49" Curved DQHD 240Hz', price: 1299.00, stock: 4, category: 'monitores', description: 'DQHD 5120x1440, HDR1000, G-Sync + FreeSync.' },
        { sku: 'MON-BNQ-PD2705Q',    name: 'BenQ PD2705Q — 27" QHD IPS, Diseño', price: 379.00, stock: 14, category: 'monitores', description: 'Calibración fábrica, sRGB 100%, USB-C 65W.' },
        { sku: 'TEC-LOG-MXMEC-BRN',  name: 'Logitech MX Mechanical — Brown Switches', price: 149.00, stock: 20, category: 'perifericos', description: 'Teclado mecánico inalámbrico, retroiluminación LED, 15 días batería.' },
        { sku: 'RAT-LOG-MXM3S',      name: 'Logitech MX Master 3S — 8000 DPI Silencioso', price: 99.00, stock: 30, category: 'perifericos', description: 'Ergonómico, rueda MagSpeed, Bluetooth Multi-Device.' },
        { sku: 'AUR-SNY-WH1000XM5',  name: 'Sony WH-1000XM5 — ANC 30h', price: 349.00, stock: 16, category: 'perifericos', description: 'Cancelación de ruido adaptativa, carga rápida.' },
        { sku: 'CAM-LOG-BRIO4K',     name: 'Logitech Brio 4K Ultra HD — 90fps HDR', price: 199.00, stock: 18, category: 'perifericos', description: 'Zoom digital 5x, HDR, micrófono estéreo con ANC.' },
        { sku: 'SSD-SAM-990PRO-2T',  name: 'Samsung 990 Pro NVMe M.2 2TB', price: 189.00, stock: 22, category: 'almacenamiento', description: 'PCIe 4.0, lectura 7450 MB/s, escritura 6900 MB/s.' },
        { sku: 'SSD-WD-SN850X-1T',   name: 'WD Black SN850X NVMe M.2 1TB', price: 109.00, stock: 28, category: 'almacenamiento', description: 'Game Mode 2.0, lectura 7300 MB/s, compatible PS5.' },
        { sku: 'HDD-SEA-BARCUDA-4T', name: 'Seagate BarraCuda 4TB — 3.5" SATA III', price: 79.00, stock: 35, category: 'almacenamiento', description: 'Caché 256MB, MultiTier Caching, SATA 6Gb/s.' },
        { sku: 'ROU-ASUS-AX88U',     name: 'ASUS RT-AX88U — WiFi 6 AX6000', price: 299.00, stock: 13, category: 'redes', description: 'Router gaming quad-core 1.8GHz, 8 puertos LAN, VPN integrada.' },
        { sku: 'SWI-TPL-SG1024D',    name: 'TP-Link TL-SG1024D — 24 puertos Gigabit', price: 89.00, stock: 19, category: 'redes', description: 'Switch no gestionable, EEE, carcasa metálica.' },
        { sku: 'WH-STOCK-CABLE-USB',  name: 'Cable USB-C a USB-A 2m — Pack 5 unidades', price: 14.99, stock: 100, category: 'perifericos', description: 'Cable de carga y datos USB 3.1, nylon trenzado.' },
        { sku: 'WH-STOCK-LIMPIEZA',   name: 'Kit de limpieza para ordenadores', price: 12.50, stock: 80, category: 'perifericos', description: 'Spray antiestático, paños de microfibra, soplador de aire.' },
    ];

    for (const p of products) {
        await new Promise((resolve) => {
            db.run(
                `INSERT OR IGNORE INTO products (sku, name, description, price, stock, category)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [p.sku, p.name, p.description, p.price, p.stock, p.category],
                (err) => {
                    if (err) console.error(`  [error] ${p.sku}:`, err.message);
                    else console.log(`  [ok]   ${p.sku} — ${p.name}`);
                    resolve();
                }
            );
        });
    }

    console.log('\nSeed completado.');
    process.exit(0);
}, 500);