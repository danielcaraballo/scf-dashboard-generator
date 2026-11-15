# Registro de Cambios (Changelog)

Todos los cambios notables en este proyecto serán documentados en este archivo.

El formato está basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/),
y este proyecto se adhiere a [Semantic Versioning (SemVer 2.0.0)](https://semver.org/lang/es/).

---

## [1.0.0] - 2026-11-15

Primera versión mayor estable para disponibilidad general (GA), lista para producción corporativa y auditoría técnica.

### Added
- **Procesamiento de datos 100% Client-Side:** Carga y análisis local de archivos en formatos CSV (delimitados por coma o punto y coma) y Excel (`.xlsx`, `.xls`) de hasta 30 MB / 50 000 registros, procesados en memoria mediante PapaParse (Web Workers multihilo) y SheetJS en Worker dedicado con degradación elegante a modo síncrono.
- **Detección inteligente de columnas:** Mapeo automático exacto y por substrings para estatus, entidad geográfica, combustible, clase, denominación/tipo de vehículo, marca, modelo, cobertura GPS y verificación de registro.
- **Semántica operativa estandarizada:** Clasificación unificada en 8 categorías de estatus vehicular (Operativo, En Reparación, Inoperativo, Por Desincorporar, Desincorporado, Por Ubicar, Hurtado, Otros Entes) y categoría de reserva `sin_clasificar`, con umbrales semafóricos (Verde &ge;80%, Ámbar &ge;50%, Rojo &lt;50%).
- **Mapa interactivo vectorial de Venezuela:** Cartografía SVG embebida (`window.FleetMapData`) con las 25 entidades federales (24 estados, Distrito Capital, Dependencias Federales y Guayana Esequiba), coloreada por tasa de operatividad, compatible con apertura mediante `file://` sin restricciones CORS.
- **Inspección in-situ de entidades:** Ficha diagnóstica lateral que se despliega al interactuar con cualquier estado o etiqueta (cuadrícula 2x2 con operativas/inoperativas/total/posición nacional, semáforo, barra de progreso y botón de filtrado) con resalte luminoso y atenuación perimetral sin transiciones bruscas.
- **Conmutador de etiquetas y líneas guía:** Segmented pills compactos (*Off*, *% Op.*, *Unidades*) para etiquetas vectoriales permanentes con líneas guía (*leader lines*) calibradas para prevenir solapamiento en zonas de alta densidad territorial.
- **Leyenda dinámica con tier hover:** Visualización en tiempo real del conteo de entidades por rango de operatividad (Alta &ge;80%, Media 50–79%, Baja &lt;50% y Sin datos) con resaltado bidireccional sobre el mapa al pasar el cursor por los niveles de la leyenda.
- **Enfoque estadal adaptativo (Split View):** Visualización especializada para archivos mono-estado o filtros territoriales individuales, integrando pestañas interactivas (*Denominación / Tipo* vs. *Marca / Modelo*) con TOP 10 balanceado y categoría residual al 100%, acompañado de un mini-localizador cartográfico nacional centrado.
- **Barra de distribución continua al 100%:** Barra inferior en la tarjeta de estatus implementada mediante CSS `linear-gradient` con paradas dobles exactas y capa de hitboxes interactivos con tooltips nativos.
- **Filtro de Flota Activa:** Botón interactivo para aislar y evaluar exclusivamente unidades operativas, en taller e inoperativas, compatible y combinable con el selector geográfico.
- **Exportación ejecutiva a PDF (2 páginas fijas):** Generación de reportes PDF Letter horizontal (landscape, 279.4 &times; 215.9 mm) mediante `html2canvas-pro` y `jsPDF`, con encabezado institucional, separador sky (`#0EA5E9`), paginación dinámica, fuentes vectoriales incrustadas (Poppins y JetBrains Mono) con precarga en segundo plano (`prefetchFonts`) y normalización forzada a tema claro sin parpadeo del DOM visible.
- **Modo Claro / Oscuro nativo:** Selector de tema con sincronización automática de preferencias del sistema operativo (`prefers-color-scheme`), persistencia en `localStorage`, contraste optimizado para cumplimiento WCAG AA y actualización reactiva de gráficos Chart.js.
- **Modo TV (Pantalla Completa):** Modo para salas de control y centros de operaciones (NOC) que oculta controles periféricos y maximiza la visualización mediante `requestFullscreen`, con salida rápida con tecla `Escape`.
- **Logotipo interactivo y favicon:** Integración de favicon vectorial como logo interactivo en el encabezado con redirección directa a la pantalla inicial.

### Changed
- Reorganización del flujo visual de la Página 1: la distribución de combustible (donut con leyenda lateral al 100% incluyendo remanente `POR IDENTIFICAR`) y clase de vehículo se sitúan de forma compacta inmediatamente debajo de los KPIs.
- Balance permanente de 3 tarjetas KPI en la fila superior (sin espacios vacíos ni métricas redundantes) tanto en vista nacional como en filtros estadales o archivos mono-estado.
- Estandarización de toda la estructura mediante CSS Grid semántico (`grid gap-4 sm:gap-5`) y acolchado uniforme `p-4 sm:p-5` en tarjetas de primer nivel, erradicando márgenes negativos y dobles envolturas.
- Aceleración de normalización de cadenas mediante bypass ASCII y pre-indexación en Map O(1) de estados y alias.
- Rediseño minimalista de encabezado y pie de página con garantías de procesamiento local y atribución con enlaces a GitHub.

### Removed
- Eliminación de archivos y carpetas sin utilizar: archivo de metadatos `assets/banner.png:Zone.Identifier` y carpeta vacía `assets/img/`.
- Depuración de código muerto en JavaScript: ícono `fire` en `FleetUI.ICONS`, propiedad huérfana `geo: null` en `FleetProcessing.analyze`, variable redundante `isStateMode` en `js/app.js` y funciones deprecadas de versiones previas (`exportPng`, `renderVBarStacked`, `copyCanvases`, `renderCompleteness`).
- Remoción de widgets y textos redundantes: métrica secundaria de flota activa en el Hero Card, conteo duplicado en la barra de filtros y tarjeta territorial redundante en el enfoque estadal.

### Fixed
- Corrección de la frontera occidental de la Guayana Esequiba (`VE-ES`) en `js/venezuela-data.js` para compartir vértices continuos con Bolívar (`VE-F`) y Delta Amacuro (`VE-Y`), eliminando solapamiento horizontal.
- Eliminación de reflows continuos en el tooltip del mapa mediante almacenamiento en caché de dimensiones del contenedor.
- Normalización obligatoria a MAYÚSCULAS en denominaciones, tipos de vehículos y modelos para prevenir segmentación artificial de categorías idénticas.
- Soporte de apertura local directa mediante protocolo `file://` eliminando solicitudes `fetch` externas para el mapa vectorial.
- Guardia defensiva contra doble ejecución concurrente en el Web Worker de importación de Excel.

### Security
- Garantía de confidencialidad y zero-knowledge: ninguna solicitud HTTP envía datos, métricas ni archivos fuera del navegador del cliente.
- Prevención de inyecciones XSS mediante sanitización exhaustiva de campos y nombres de columnas con `FleetConfig.escapeHtml()`.
- Exclusión en `.gitignore` de cualquier archivo real CSV o Excel que pudiera contener datos sensibles o personales.
