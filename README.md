# API 3D-QR — QRs Tridimensionales Dinámicos y Desechables

API REST de alto rendimiento y escalabilidad multi-inquilino para la creación, manipulación y visualización de **códigos QR incrustados en modelos 3D interactivos**.

Diseñada para cartelería digital, stands de eventos, accesos VIP y productos físicos inteligentes con **actualización reactiva en tiempo real (SSE) sin recarga de página ni reinicio del modelo 3D**.

---

## Características Principales

1. **Modelos 3D Interactivos (Three.js):**
   - Soporte para **GLB, glTF, OBJ, FBX y STL** (hasta 100 MB).
   - Generación automática de un **Tótem 3D estilizado PBR** con pedestal si no se sube un archivo 3D.
   - Rotación libre tridimensional, zoom orbital y auto-giro fluido.

2. **Paleta de Colores Adaptativa:**
   - La API analiza mediante **Sharp** la imagen o logo proporcionado.
   - Extrae el color dominante y calcula el contraste perceptual para que los módulos del QR combinen armónicamente con la estructura del modelo sin perder legibilidad ante cámaras móviles.

3. **QR Desechable (One-Time Scan) & SSE Reactivo:**
   - Al escanear el QR, el código de acceso se invalida y el servidor rota automáticamente la textura.
   - A través de **Server-Sent Events (SSE)**, el recuadro del código QR se actualiza en el navegador de manera reactiva: **la página no se recarga y el modelo 3D no se ve interrumpido**.

4. **Multi-Inquilino y Escalabilidad:**
   - Autenticación por **API Keys** (`x-api-key`).
   - Base de datos transaccional **PostgreSQL 16** (`bytea` + `jsonb`) para cero pérdida de datos.
   - **Redis 7** para pub/sub distribuido de eventos SSE y rate-limiting horizontal.
   - Modo de ejecución *Zero-Config* con almacenamiento resiliente integrado para pruebas locales instantáneas.

5. **Panel Administrativo con Guía 3D / IA Integrada:**
   - Dashboard completo accesible desde `/admin/`.
   - Incluye tabla comparativa de formatos 3D y enlaces directos a herramientas de IA generativa de modelos 3D (**Meshy.ai**, **Tripo AI**, **TripoSR**, y el rol de automatización de **Claude / Gemini**).

---

## Inicio Rápido

### Opción A: Desarrollo Local (Node.js)

```bash
# 1. Instalar dependencias
npm install

# 2. Iniciar servidor
npm start
```

El servidor estará disponible en:
- **Panel Administrativo:** [http://localhost:3000/admin/](http://localhost:3000/admin/)
- **Proyecto de Ejemplo en Vivo:** [http://localhost:3000/example/](http://localhost:3000/example/)
- **Widget Embebible:** `http://localhost:3000/widget/3dqr-viewer.js`

### Opción B: Producción con Docker Compose

```bash
docker compose up -d --build
```
Levanta automáticamente la API, PostgreSQL 16 y Redis 7 listos para producción.

---

## Pruebas Automatizadas

Para ejecutar la suite de pruebas unitarias y de integración:

```bash
npm test
```

---

## Referencia de la API REST

### Autenticación
Envía tu clave en el encabezado HTTP:
`x-api-key: tk_live_demo_123456789`

### Endpoints Principales

| Método | Ruta | Descripción | Auth |
|--------|------|-------------|------|
| `POST` | `/api/qr` | Crea un nuevo QR 3D (soporta `target_url` http(s) o `/ruta`, `view_slug`, `link_mode: static \| dynamic`, `rotation_strategy`, `rotation_interval_seconds`, `rotating_urls`) | Requerido |
| `GET` | `/api/qr` | Lista todos los QRs del inquilino (incluye `viewUrl`, estado estático/dinámico y conteo diario `summary`) | Requerido |
| `GET` | `/api/stats/daily` | Resumen diario global de ingresos al link y personas únicas de hoy | Requerido |
| `GET` | `/api/qr/:qrId/daily-stats` | Conteo diario (`dailyScans`, `dailyUniqueVisitors`) e historial por día (`?days=30`) | Requerido |
| `GET` | `/api/qr/:qrId` | Retorna metadatos de un QR (título, colores, estadísticas diarias/totales, `viewUrl`) | Opcional |
| `GET` | `/api/qr/:qrId/view-link` | Retorna exclusivamente el link público de vista (`viewUrl`) para sistemas o empresas externas | Requerido |
| `PATCH` | `/api/qr/:qrId/view-link` | Edita la ruta pública personalizada (`/view/<view_slug>`) o activa/desactiva `view_enabled` | Requerido |
| `POST` | `/api/qr/:qrId/view-link/rotate` | Revoca y regenera el `viewToken` del link público de vista | Requerido |
| `PATCH` | `/api/qr/:qrId/link` | Cambia `target_url` (URL o `/ruta`), `view_slug`, `rotating_urls`, modo estático/dinámico, intervalo o visibilidad sin tocar el modelo 3D | Requerido |
| `POST` | `/api/qr/:qrId/rotate` | Rota inmediatamente el enlace activo del QR y notifica por SSE | Requerido |
| `GET` | `/view/:viewToken` | **Vista Pública Unida (Modelo 3D + QR)** solo lectura, aislada del panel administrativo e incrustable en `<iframe>` | Público |
| `GET` | `/api/qr/:qrId/model` | Descarga el modelo 3D GLB con la textura QR incrustada | Público |
| `GET` | `/api/qr/:qrId/image` | Retorna la imagen PNG activa del código QR | Público |
| `GET` | `/api/qr/:qrId/events` | Stream SSE en tiempo real para eventos de recambio | Público |
| `GET` | `/scan/:qrId` | Endpoint público de escaneo (redirige al destino o marca expirado) | Público |
| `PUT` | `/api/qr/:qrId` | Actualiza título, URL, estrategia, estilo visual o rota el código manualmente | Requerido |
| `DELETE`| `/api/qr/:qrId` | Elimina un item QR | Requerido |
| `GET` | `/health` | Healthcheck del sistema (estado de DB y Redis) | Público |

### Estrategias de Enlace (Estático vs Dinámico)
- **`static` / `continuous`**: El código QR permanece estático con enlace fijo sin rotar al escanearse ni por tiempo.
- **`one_time`**: Desechable tras 1 escaneo; rota automáticamente y se actualiza por SSE sin recargar la vista.
- **`timed`**: Cambia su enlace automáticamente cada `rotation_interval_seconds` segundos (mín. 2s), con soporte opcional de lista `rotating_urls`.
- **`dynamic`**: Combina rotación automática por intervalo de tiempo y descarte inmediato tras cada escaneo.

---

## Integración del Widget Web Component

Para incrustar el visor interactivo en cualquier sitio web externo (React, Vue, WordPress, HTML puro):

```html
<!-- 1. Importar el Web Component -->
<script src="http://localhost:3100/widget/3dqr-viewer.js" type="module"></script>

<!-- 2. Colocar el visor -->
<qr-3d-viewer
  qr-id="qr_abc123"
  api-url="http://localhost:3100"
  width="100%"
  height="480px"
  auto-rotate="true">
</qr-3d-viewer>
```

---

## Formatos 3D y Generación con IA

### Tabla de Formatos Soportados

| Formato | Programa de Creación | ¿IA puede generarlo? |
|---------|---------------------|----------------------|
| **GLB** (Recomendado) | Blender, Sketchfab | Soportado: Meshy, Tripo AI |
| **OBJ** | Blender, Maya, ZBrush | Soportado: Meshy, CSM AI |
| **FBX** | Maya, Cinema 4D | Soportado: Meshy (export) |
| **STL** | Fusion 360, Tinkercad | Limitado: sin textura (solo geometría) |

### Creación de Modelos con IA (Image → 3D)

Si solo tienes una imagen y no cuentas con un modelo 3D previo:
- **[Meshy.ai](https://meshy.ai):** Genera modelos GLB texturizados a partir de una o varias fotos en segundos.
- **[Tripo3D](https://tripo3d.ai):** Reconstrucción tridimensional ultrarrápida optimizada para la web.
- **Rol de Claude y Gemini:** Aunque los LLMs no sintetizan mallas tridimensionales como vértices binarios, son ideales para **automatizar el pipeline completo**: reciben la foto conceptual del usuario, generan el prompt optimizado para la API de Meshy/Tripo y envían el archivo `.glb` directamente a esta API.
