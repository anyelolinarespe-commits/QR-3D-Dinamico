# Guía de Integración para Servidores y Clientes Externos

Este proyecto de ejemplo demuestra cómo cualquier aplicación web externa (desarrollada en React, Vue, Svelte, Angular, PHP, Django, Spring Boot o HTML estático) puede consumir la **API 3D-QR**.

---

## 1. Instalación del Visor 3D

Solo debes incluir el script del Web Component en el `<head>` o antes de cerrar el `<body>`:

```html
<!-- Cargar el Web Component desde la API -->
<script src="https://tu-servidor-api.com/widget/3dqr-viewer.js" type="module"></script>
```

---

## 2. Embeber el Componente en Cualquier Página

Coloca la etiqueta personalizada `<qr-3d-viewer>` en cualquier lugar de tu HTML:

```html
<qr-3d-viewer
  qr-id="qr_123456"
  api-url="https://tu-servidor-api.com"
  width="100%"
  height="500px"
  auto-rotate="true">
</qr-3d-viewer>
```

### Atributos disponibles:

| Atributo | Tipo | Descripción | Default |
|----------|------|-------------|---------|
| `qr-id` | `string` | ID del código QR registrado en la API | Requerido |
| `api-url` | `string` | URL base de la API 3D-QR | Host actual |
| `width` | `string` | Ancho del contenedor (ej: `100%`, `600px`) | `100%` |
| `height` | `string` | Alto del contenedor (ej: `480px`, `60vh`) | `480px` |
| `auto-rotate` | `boolean` | Giro orbital continuo automático | `true` |

---

## 3. ¿Cómo funciona la reactividad sin recarga?

1. El componente renderiza el modelo 3D usando **Three.js** con aceleración por hardware WebGL.
2. Abre automáticamente un canal de eventos **Server-Sent Events (SSE)** hacia `/api/qr/:qrId/events`.
3. Cuando un usuario escanea el código en el mundo real, la API emite el evento `qr_updated`.
4. El visor actualiza exclusivamente la textura del recuadro del código QR mediante una transición suave de opacidad.
5. **Cero recargas de página** y **cero interrupciones en la animación 3D**.
