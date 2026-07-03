# Publicacion automatica en YouTube

La subida usa YouTube Data API v3 con OAuth. Por seguridad, la primera conexion
del canal requiere abrir una URL de Google y autorizar manualmente. Despues el
token queda guardado en `output/youtube/oauth-token.json`, ignorado por git.

## Configuracion

1. En Google Cloud, crea un proyecto.
2. Habilita YouTube Data API v3.
3. Crea un OAuth Client ID.
4. Agrega estas variables en `.env`:

```env
YOUTUBE_CLIENT_ID="..."
YOUTUBE_CLIENT_SECRET="..."
YOUTUBE_REDIRECT_URI="http://127.0.0.1:53682/oauth2callback"
YOUTUBE_PRIVACY_STATUS="private"
YOUTUBE_CATEGORY_ID="24"
YOUTUBE_NOTIFY_SUBSCRIBERS="false"
```

## Comandos

Autorizar el canal una sola vez:

```bash
npm run youtube:auth
```

Subir un Short ya renderizado:

```bash
npm run youtube:upload -- --id=109 --privacy=private
```

Generar, renderizar y subir automaticamente:

```bash
npm run generate:publish -- --count=20 --privacy=private
```

Por defecto se sube como `private`. Google indica que proyectos de API no
verificados creados despues del 28 de julio de 2020 pueden quedar limitados a
videos privados hasta completar auditoria.
