# AI Horror Shorts Factory — Fases 1 y 2

Fábrica local para crear historias breves de terror tecnológico y convertirlas en Shorts verticales.

## Instalación

```bash
npm install
copy .env.example .env
npm run db:setup
```

Además se requieren:

- FFmpeg y FFprobe.
- Piper TTS con un modelo español `.onnx`.
- Stable Diffusion WebUI local iniciado con la API habilitada (`--api`).

Configura sus rutas y la URL en `.env`. Ninguno de estos servicios se descarga automáticamente.

Comprobar la instalación multimedia:

```bash
npm run media:start
npm run media:check
```

`media:start` mantiene la API local de Stable Diffusion activa en el puerto 7861. Debe permanecer ejecutándose mientras se generan Shorts.

## Uso

Generar un episodio con una serie seleccionada al azar:

```bash
npm run generate:episode
```

Elegir una serie:

```bash
npm run generate:episode -- --series="IA Perturbadora"
```

Generar un lote de 100 episodios:

```bash
npm run generate:batch-episodes -- --count=100
```

Los guiones se exportan a `output/scripts` y su metadata a `output/metadata`.

Auditar todos los episodios guardados:

```bash
npm run quality:audit
```

## Scouting de tendencias

Generar las 2 mejores propuestas de tops virales del dia y una lista de clips
candidatos para revisar manualmente. Por defecto intenta leer fuentes web de
tendencias y cae a rotacion local si no hay red:

```bash
npm run trend:scout
```

Opciones:

```bash
npm run trend:scout -- --proposals=2 --candidates=8 --date=2026-07-03
```

Forzar modo local sin consultar fuentes web:

```bash
npm run trend:scout -- --offline=true
```

Resolver clips especificos de YouTube Shorts, con URL y metricas:

```bash
npm run trend:scout -- --resolve-clips=true
```

Para esa busqueda especifica configura `YOUTUBE_SEARCH_API_KEY` en `.env`.

El reporte se exporta a `output/trend-scouting` en JSON y Markdown. Este flujo
solo recomienda ideas, busquedas y criterios de seleccion; los clips finales se
deben descargar/revisar manualmente y guardar en una carpeta aprobada antes de
armar el video.

Si quieres usar otra fuente de tendencias, configura `TREND_SCOUT_RSS_URLS` en
`.env` con una o varias URLs RSS separadas por coma.

## Canales de YouTube

El canal de terror usa el perfil por defecto `horror`. El canal de tops virales
usa `viral-tops`.

Autorizar el canal de terror:

```bash
npm run youtube:auth -- --channel=horror
```

Autorizar el canal de tops:

```bash
npm run youtube:auth -- --channel=viral-tops
```

Subir usando un canal especifico:

```bash
npm run youtube:upload -- --channel=horror
npm run youtube:upload -- --channel=viral-tops
```

Generar, renderizar y subir el canal de terror:

```bash
npm run generate:publish -- --channel=horror --count=1
```

## Construcción de Tops

Crear una carpeta inicial para un top:

```bash
npm run tops:init -- --title="Top 5 fails inesperados"
```

Luego pon los clips en la carpeta generada dentro de `assets/approved_clips`,
ajusta `top.json` y renderiza:

```bash
npm run tops:build -- --manifest=assets/approved_clips/top-5-fails-inesperados/top.json
```

La salida queda en `output/tops`.

## Construcción de Shorts

Renderizar el episodio pendiente más reciente:

```bash
npm run build:short
```

Renderizar un episodio específico:

```bash
npm run build:short -- --id=42
```

Generar y renderizar automáticamente 20 episodios:

```bash
npm run generate:full
```

También puede elegirse otra cantidad o fijarse una serie:

```bash
npm run generate:full -- --count=5 --series="IA Perturbadora"
```

El pipeline crea cuatro escenas por episodio, cuatro imágenes de 1080×1920, narración WAV, subtítulos SRT/TXT y un MP4 vertical con zoom, movimiento, transiciones y subtítulos incrustados.

Salidas:

- `output/images/<episodeId>`
- `output/audio`
- `output/subtitles`
- `output/videos`

El pipeline es reanudable: conserva imágenes existentes y registra el progreso o error en `renderStatus` y `renderError`.

Auditar escenas y subtítulos sin invocar modelos ni renderizar video:

```bash
npm run media:audit
```

## Controles de calidad

- Hook de máximo 12 palabras.
- Narración estimada entre 10 y 20 segundos.
- Títulos, hooks y twists con restricciones únicas en SQLite.
- Regeneración automática si cualquier campo protegido supera 80% de similitud con el historial.
- Puntuación de viralidad estimada de 0 a 100.
