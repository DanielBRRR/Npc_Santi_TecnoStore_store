# TecnoStore — App de Almacén

Sistema de gestión de almacén para la plataforma TecnoStore. Proporciona una API REST que consume la tienda WordPress para sincronizar el inventario y registrar ventas, y un panel web de administración para la gestión diaria del stock.

---

## Qué hace

- **Gestión de productos:** catálogo con SKU, precio, stock y categoría. Permite crear, editar y eliminar productos.
- **Control de stock:** registro de movimientos de entrada y salida con historial completo.
- **Ventas:** recibe y almacena los pedidos generados por la tienda WordPress.
- **Usuarios y roles:** sistema de autenticación JWT con roles `admin` y `user`.
- **Tokens de API:** generación de tokens JWT de larga duración para que WordPress se autentique.
- **Exportación / importación:** exporta el catálogo a CSV e importa productos desde fichero.
- **Integración ERP:** sincronización bidireccional con Dolibarr (productos y facturas).

---

## Requisitos

| Componente | Versión mínima |
|------------|----------------|
| Node.js    | 14.x           |
| npm        | 6.x            |

---

## Instalación

```bash
cd app_almacen
npm install
```

---

## Variables de entorno

Crea un fichero `.env` en la raíz de `app_almacen/` con el siguiente contenido:

```env
PORT=3000
JWT_SECRET=cambia_este_secreto_en_produccion
DB_PATH=./database.sqlite
```

| Variable     | Descripción                                                        | Por defecto                  |
|--------------|--------------------------------------------------------------------|------------------------------|
| `PORT`       | Puerto en el que escucha el servidor                               | `3000`                       |
| `JWT_SECRET` | Clave secreta para firmar los tokens JWT de usuario y de API       | `w4r3h0us3_jwt_s3cr3t`       |
| `DB_PATH`    | Ruta al fichero SQLite de la base de datos                         | `./database.sqlite`          |

> **Importante:** en un entorno de producción cambia siempre `JWT_SECRET` por una cadena aleatoria larga. Los tokens de usuario y los tokens de API que WordPress usa para autenticarse se firman con esta clave.

---

## Arranque

```bash
# Producción
npm start

# Desarrollo (reinicio automático con nodemon)
npm run dev
```

El servidor queda disponible en `http://localhost:3000` (o el puerto configurado en `.env`).

---

## Carga inicial de datos

El script de seed crea los usuarios por defecto y el catálogo inicial de productos. Ejecútalo **una sola vez** tras la primera instalación:

```bash
npm run seed
```

### Usuarios creados

| Usuario   | Contraseña      | Rol   |
|-----------|-----------------|-------|
| `admin`   | `admin123`      | admin |
| `almacen` | `Almacen2024!`  | user  |
| `manager` | `Manager2024!`  | admin |

El script es idempotente: si los usuarios o productos ya existen no los duplica.

---

## Generación del token para WordPress

WordPress necesita un token JWT para autenticarse contra la API del almacén y poder sincronizar productos y registrar ventas.

### Desde el panel web

1. Accede al panel en `http://localhost:3000` e inicia sesión como `admin`.
2. Ve a **Integración WP** en el menú lateral.
3. Introduce una descripción (ej: `WordPress producción`) y haz clic en **Generar token**.
4. Copia el token — solo se muestra completo en este momento.
5. Pégalo en el panel de WordPress: **Panel de administración > TecnoStore > JWT Token**.

### Desde la API (curl)

```bash
# 1. Obtener un JWT de usuario
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")

# 2. Generar el token de API
curl -s -X POST http://localhost:3000/api/tokens/generate \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"scope":"admin","description":"WordPress producción"}'
```

---

## ERP — Dolibarr 17.0.0

### Por qué esta versión

El proyecto requiere específicamente **Dolibarr 17.0.0**. Esta es la versión de referencia sobre la que se han desarrollado y validado las integraciones de la API REST (endpoints de productos, facturas y terceros). El uso de versiones superiores puede introducir cambios en la API que rompan la integración.

---

### Instalación con Docker (recomendado)

La forma más rápida de levantar Dolibarr es con Docker. Crea el siguiente `docker-compose.yml` en la carpeta que prefieras (por ejemplo `dolibarr/`):

```yaml
version: "3.8"

services:
  mariadb:
    image: mariadb:10.6
    environment:
      MYSQL_ROOT_PASSWORD: rootpassword
      MYSQL_DATABASE: dolibarr
      MYSQL_USER: dolibarr
      MYSQL_PASSWORD: dolibarr
    volumes:
      - dolibarr_db:/var/lib/mysql
    restart: unless-stopped

  dolibarr:
    image: tuxgasy/dolibarr:17.0.0
    environment:
      DOLI_DB_HOST:     mariadb
      DOLI_DB_NAME:     dolibarr
      DOLI_DB_USER:     dolibarr
      DOLI_DB_PASSWORD: dolibarr
      DOLI_DB_TYPE:     mysqli
      DOLI_URL_ROOT:    http://localhost:8080
      DOLI_ADMIN_LOGIN: admin
      DOLI_ADMIN_PASSWORD: admin
      DOLI_MODULES:     modSociete,modFacture,modProduit
    ports:
      - "8080:80"
    depends_on:
      - mariadb
    volumes:
      - dolibarr_html:/var/www/html/documents
    restart: unless-stopped

volumes:
  dolibarr_db:
  dolibarr_html:
```

Arrancar:

```bash
docker compose up -d
```

Dolibarr quedará disponible en `http://localhost:8080`.
Las credenciales de acceso iniciales son `admin` / `admin`.

> Si el contenedor de Dolibarr arranca antes de que MariaDB esté listo verás un error de conexión al entrar por primera vez. Espera 30 segundos y recarga el navegador.

---

### Instalación manual en Linux (sin Docker)

Si prefieres instalación nativa en un servidor Linux:

```bash
# 1. Descargar Dolibarr 17.0.0
wget https://github.com/Dolibarr/dolibarr/archive/refs/tags/17.0.0.tar.gz
tar -xzf 17.0.0.tar.gz -C /var/www/html/
mv /var/www/html/dolibarr-17.0.0 /var/www/html/dolibarr

# 2. Permisos
chown -R www-data:www-data /var/www/html/dolibarr
chmod -R 755 /var/www/html/dolibarr

# 3. Crear base de datos
mysql -u root -p -e "CREATE DATABASE dolibarr CHARACTER SET utf8mb4;"
mysql -u root -p -e "CREATE USER 'dolibarr'@'localhost' IDENTIFIED BY 'dolibarr';"
mysql -u root -p -e "GRANT ALL PRIVILEGES ON dolibarr.* TO 'dolibarr'@'localhost';"
```

Luego accede a `http://TU_SERVIDOR/dolibarr` y completa el asistente de instalación web.

---

### Configuración inicial tras la instalación

Una vez dentro del panel de Dolibarr:

#### 1. Activar el módulo de API REST

```
Inicio > Configuración > Módulos > Herramientas > API / Web services REST → Activar
```

#### 2. Obtener la API Key del usuario admin

```
Inicio > Usuarios y grupos > admin → Pestaña "Clave API"
```

Genera o copia la clave. Esta es la `DOLAPIKEY` que debes introducir en:
- La app de almacén: **Configuración > Integración ERP**
- El WordPress: **Panel de administración > TecnoStore > Conexión con el ERP**

#### 3. Verificar que la API funciona

```bash
curl -s -H "DOLAPIKEY: TU_API_KEY" http://localhost:8080/api/index.php/status
```

La respuesta debe ser un JSON con `{"success": 1, ...}`.

---

### Poblar el ERP con el inventario del almacén

Una vez configurada la integración (URL + API Key guardadas en la app de almacén), lanza la sincronización inicial para importar todos los productos del almacén al catálogo de Dolibarr de una sola vez.

#### Desde el panel web del almacén

1. Ve a **Configuración** en el menú lateral.
2. Introduce y guarda la URL y API Key de Dolibarr.
3. Haz clic en **Sincronizar inventario con el ERP**.

El panel mostrará un resumen con cuántos productos se han creado y cuántos ya existían.

#### Desde la API (curl)

```bash
# 1. Obtener JWT de usuario
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")

# 2. Lanzar la sincronización
curl -s -X POST http://localhost:3000/api/settings/setup-erp \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"
```

Respuesta esperada:

```json
{
  "success": true,
  "total": 23,
  "created": 23,
  "existing": 0,
  "errors": []
}
```

> Este endpoint es idempotente: si un producto con el mismo SKU ya existe en Dolibarr, no se duplica. Puedes ejecutarlo tantas veces como necesites.

---

## Estructura de la API REST

### Autenticación

Todos los endpoints protegidos requieren el header:

```
Authorization: Bearer <token>
```

El token se obtiene con `POST /api/auth/login`. Los endpoints que WordPress usa aceptan también un token de API generado desde el panel de integración.

### Endpoints principales

| Método | Ruta                              | Auth          | Descripción                                 |
|--------|-----------------------------------|---------------|---------------------------------------------|
| POST   | `/api/auth/login`                 | —             | Login, devuelve JWT                         |
| POST   | `/api/auth/forgot-password`       | —             | Solicitar reset de contraseña               |
| GET    | `/api/products`                   | API token     | Listar productos (usado por WordPress)      |
| GET    | `/api/products/:id`               | JWT usuario   | Detalle de producto                         |
| POST   | `/api/products`                   | JWT usuario   | Crear producto (sincroniza con ERP)         |
| PUT    | `/api/products/:id`               | JWT usuario   | Actualizar producto                         |
| PATCH  | `/api/products/:id/stock`         | JWT usuario   | Ajustar stock con registro de movimiento    |
| GET    | `/api/products/:id/movements`     | JWT usuario   | Historial de movimientos de stock           |
| POST   | `/api/sales`                      | API token     | Registrar venta (llamado por WordPress)     |
| GET    | `/api/sales`                      | JWT usuario   | Listar ventas                               |
| GET    | `/api/sales/stats`                | JWT usuario   | Estadísticas de ventas                      |
| POST   | `/api/tokens/generate`            | JWT usuario   | Generar token de API para WordPress         |
| GET    | `/api/tokens`                     | JWT usuario   | Listar tokens generados                     |
| DELETE | `/api/tokens/:id`                 | JWT usuario   | Revocar token                               |
| GET    | `/api/users`                      | JWT admin     | Listar usuarios                             |
| POST   | `/api/export/csv`                 | JWT admin     | Exportar catálogo a CSV                     |
| POST   | `/api/export/import`              | JWT admin     | Importar productos desde fichero            |
| GET    | `/api/settings`                   | JWT admin     | Leer configuración del ERP                  |
| POST   | `/api/settings`                   | JWT admin     | Guardar URL y API Key de Dolibarr           |
| POST   | `/api/settings/test`              | JWT admin     | Verificar conectividad con Dolibarr         |
| POST   | `/api/settings/setup-erp`         | JWT admin     | Sincronizar todo el inventario con el ERP   |

---

## Despliegue en AWS

Arquitectura base recomendada:

- **EC2** — servidor Node.js (con PM2 o systemd para gestionar el proceso)
- **Security Groups** — exponer solo el puerto necesario; el acceso directo a la API desde internet debe estar restringido por IP o tras un ALB
- **EBS** — volumen persistente para el fichero SQLite (`database.sqlite`)

La arquitectura final, las decisiones de red y la configuración de seguridad de cada servicio son responsabilidad del equipo de infraestructura.
