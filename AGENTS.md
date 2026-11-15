# AGENTS.md

Contexto del proyecto para agentes de IA y colaboradores. Actualizar este archivo cuando el proyecto cambie (nuevas columnas del CSV/Excel, nuevas fases, decisiones de arquitectura).

## Resumen

Dashboard web de análisis de flota **100% client-side**. Carga un archivo local en formato CSV o Excel (`.xlsx`, `.xls` — exportaciones de aplicaciones de datos o reportes institucionales, hasta 30 MB / 10 000+ registros), procesa los datos en el navegador y genera un reporte PDF. Ningún dato sale del dispositivo.

- Flota objetivo: EnergyCompany (cliente de demostración).
- Estatus soportados del CSV/Excel: OPERATIVO, EN REPARACION, INOPERATIVO, POR DESINCORPORAR, DESINCORPORADO, POR UBICAR, HURTADO, OTROS ENTES.

## Stack

- HTML5 + Tailwind CSS v3 (Play CDN) — necesario para compatibilidad con html2canvas (no soporta colores `oklch` de Tailwind v4).
- PapaParse (CSV parsing, `worker: true` para no bloquear la UI).
- SheetJS (`xlsx.full.min.js`, para lectura local de archivos Excel `.xlsx` / `.xls`).
- Chart.js (donut + barras horizontales).
- html2canvas-pro (fork mantenido de html2canvas) + jsPDF: export PDF Letter landscape multipágina por sección (279.4×215.9 mm), con encabezado institucional (línea separadora `#0EA5E9`), pie/numeración y fuentes incrustadas.
- Tipografía: Poppins (cuerpo y datos numéricos con distintos pesos) + JetBrains Mono.

## Sistema de diseño (heredado del design system del proyecto padre)

El dashboard replica el design system del frontend del proyecto padre: primario **sky** (`sky.500` #0EA5E9), superficies **slate** (fondo `slate-100/70` en claro / `slate-950` en oscuro, tarjetas `rounded-md` con borde `slate-300/80` y sombra sutil `shadow-xs` para óptimo contraste y accesibilidad), labels `text-xs font-semibold uppercase tracking-wider`. Semántica de operatividad: verde ≥80% / amarillo ≥50% / rojo <50%. Los colores de estatus siguen siendo semánticos del proyecto (`STATUS_ORDER` en `js/config.js`), siempre en hex para html2canvas.

**Estructura y alineación:** Contenedores estandarizados exclusivamente mediante CSS Grid (`grid gap-4 sm:gap-5` con `grid-cols-12` o `grid-cols-3`) y relleno homogéneo en todas las tarjetas de primer nivel (`p-4 sm:p-5`). Se evitan márgenes negativos (`-m-*`) y dobles envolturas de padding para asegurar la alineación milimétrica con los márgenes de la página y la barra de filtros.

**Modo claro/oscuro:** Tailwind con `darkMode: 'class'` — la clase `dark` se aplica en `<html>` (no en `<body>`). Toggle vía botón `#themeBtn` en el header (visible siempre), implementado en `js/theme.js`. Preferencia persistida en `localStorage['scf-theme']`; en el primer arranque sigue `prefers-color-scheme` (script inline anti-FOUC en `<head>`). Paleta oscura: fondo `slate-950`, tarjetas `slate-800/900`, bordes `slate-700/800`, textos `slate-100/300/400`, chips con tinte al 10–15% (`dark:bg-*-500/15`). Los charts (`js/charts.js`) resuelven ticks/grid/bordes según el tema al renderizar, y el toggle dispara `FleetUI.refresh()` para repintarlos. **La exportación PDF fuerza siempre tema claro**: `js/export.js` inserta un wrapper clonado fuera de pantalla y `FleetCharts.renderLightChartsIn()` re-renderiza sus charts con `theme:'light'`, mientras que `captureElement` elimina la clase `dark` del documento clonado en `onclone` — el DOM visible (y sus charts) jamás se modifica, por lo que no hay parpadeo al exportar. Reporte institucional de fondo blanco.

## Estructura

```text
index.html          UI (Bento UI con CSS Grid uniforme, filtros interactivos por Estado y Flota Activa con píldora contextual para archivos mono-estado, primera parte con Hero, estatus, KPIs y distribución compacta por combustible y clase, bloque siguiente con mapa nacional o split view de diagnóstico estadal + mini-localizador cartográfico, header compacto, footer minimalista, sin márgenes negativos)
js/config.js        STATUS_MAP (estatus → categoría, incluye sinónimos) + STATUS_ORDER (colores) + ACTIVE_STATUSES/isActiveFleet + VENEZUELA_STATES/STATE_ALIASES (mapeo CSV → mapa) + candidatos de columnas (prioriza GPS INSTALADO, denominación, tipo de vehículo, clase, marca y modelo)
js/parser.js        PapaParse + SheetJS (lectura no bloqueante de Excel en Web Worker inline con fallback síncrono) + detección de columnas por coincidencia exacta y substring (incluye detección de denominación, tipo de vehículo, clase, marca y modelo)
js/processing.js    Agregaciones O(n): estatus, geo (operatividad por estado), combustible (con restante 'POR IDENTIFICAR' al 100%), tipo/denominación de vehículo en mayúsculas, modelo, clase, GPS (detección afirmativa de 'Y', 'SI', etc.), verificado y diagnóstico estadal (flota recuperable %, top denominaciones/tipos)
js/charts.js        Chart.js con destroy por instancia, paleta cromática con asignación neutra (#94A3B8) para categorías no identificadas
js/map.js           Mapa interactivo de Venezuela (`FleetMap`): inyecta SVG embebido en `js/venezuela-data.js`, colorea estados por % de operatividad (verde ≥80 / ámbar ≥50 / rojo <50), gestiona badges vectoriales y leader lines sin solapamiento, conmutador de tags segmented pill, inspección in-situ de entidades con Ficha Diagnóstica y resaltado perimetral sin redirección brusca, leyenda dinámica interactiva con conteo de entidades por rango y hover highlighting para todos los tiers, modo pantalla completa y renderMiniMap para enfoque estadal
js/venezuela-data.js SVG de Venezuela embebido como string (`window.FleetMapData`): 24 estados + Distrito Capital + Dependencias Federales + Guayana Esequiba (`VE-ES`), viewBox 0 0 636 530, grupos vectoriales de paths, leader lines y badges calibrados
js/ui.js            Render de hero (5/12), distribución por estatus (7/12, adaptable a 2 columnas cuando ≥ 5 estatus, con barra inferior 100% continua en linear-gradient y tooltips nativos), fila KPI siempre balanceada con 3 tarjetas según contexto (nacional: mayor/menor operatividad + GPS; estadal filtrado: posición nacional + tipo + GPS; mono-estado: flota en recuperación % sin redundancia de conteo + tipo + GPS/verificado), fila secundaria compacta (combustible en donut + leyenda lateral y clase de vehículo), sección adaptativa (mapa nacional o split view dedicado a 'Composición del Parque Automotor · Estado [Estado]' con pestañas interactivas entre Denominación/Tipo y Marca/Modelo con progress bars en mayúsculas, y mini-localizador cartográfico centrado sin tarjetas redundantes), leyendas
js/export.js        Export PDF Letter landscape (2 páginas ejecutivas: Página 1 con Hero, estatus, KPIs y distribución por combustible y clase; Página 2 con mapa de Venezuela o diagnóstico estadal + mini-localizador), precarga en segundo plano de tipografías (`prefetchFonts`), encabezado institucional con separador sky, pie/numeración y fuentes incrustadas; repinta los charts del clon en claro (`renderLightChartsIn`) sin tocar el DOM visible; omite secciones ocultas (`offsetParent === null`), protege el mini-mapa y normaliza los colores del SVG del mapa a claro en `onclone`
js/tv.js            Modo TV: fullscreen (requestFullscreen/exitFullscreen) + clase `tv-mode` en <body>; oculta header, filtros, banner de calidad y footer; amplía main a todo el ancho. Salida con Esc (fullscreenchange) o botón flotante `#tvExitBtn`
js/theme.js         Modo claro/oscuro: toggle `#themeBtn`, clase `dark` en <html>, persistencia en `localStorage['scf-theme']` y `FleetUI.refresh()` al cambiar; dispara `storage` para sincronizar pestañas
js/app.js           Inicialización de eventos de la aplicación, detección automática de archivos mono-estado vs multi-estado, control de filtros (Estado y Flota Activa) y flujo principal de carga/filtrado
assets/             Banner principal (`banner.png`)
template/           Plantillas de referencia (solo flota_template.csv y flota_template.xlsx se versionan; datos sintéticos)
CHANGELOG.md        Registro estandarizado de cambios del proyecto siguiendo Keep a Changelog y SemVer
README.md           Documentación pública del proyecto
AGENTS.md           Contexto operativo y directrices técnicas para agentes de IA y colaboradores
```

## Comandos

- Servidor local: `python3 -m http.server 8080` → http://localhost:8080
- Validar sintaxis JS: `for f in js/*.js; do node --check "$f"; done`
- Test del motor (Node): leer `template/flota_template.csv` y ejecutar `FleetProcessing.analyze` con `global.window = global` (ver historial de PLAN.md). Requiere Node ≥ 14.

## Despliegue

- **Hosting:** Vercel, vía **integración GitHub** (no CLI). Proyecto estático sin build: no hay `package.json` ni `vercel.json`; Build Command vacío y Output Directory en la raíz.
- **GitHub Flow aplicado:** `main` = producción (el push/merge a `main` dispara el deploy); cada PR de `feature/*` genera una preview URL. Sin CI/CD adicional.
- **URL:** https://scf-dashboard-generator.vercel.app (ver Settings → Domains para un dominio propio).
- El deploy no cambia la arquitectura: el sitio sigue siendo 100% client-side; Vercel solo sirve archivos estáticos.

## Convenciones

- NO agregar comentarios en el código salvo que se pidan.
- Git: **GitHub Flow** — `main` siempre estable, ramas cortas por feature (`feature/nombre`) y PR hacia `main`. Sin CI/CD: el "merge a main = deploy" queda conceptual. No realizar `git commit` ni `git push` salvo indicación explícita del usuario.
- Commits: **Conventional Commits**, tipos en inglés estándar + descripción en español (imperativo). No usar tipos traducidos (rompen tooling tipo semantic-release/commitlint).
  - `feat` nueva funcionalidad · `fix` bug · `docs` AGENTS.md/PLAN.md/README · `refactor` sin cambio de comportamiento · `style` formato/estilos visuales · `chore` mantenimiento/tooling · `test` tests del motor.
  - Formato: `tipo(scope): descripción`. Ej.: `feat(export): agregar numeración de páginas al PDF`, `fix(parser): normalizar sinónimos de estatus`.
- Los valores crudos del CSV/Excel se normalizan (mayúsculas, sin acentos) y se mapean en `js/config.js` → `STATUS_MAP`. Agregar aquí cualquier estatus o sinónimo nuevo (p. ej. `EN RUTA`/`DISPONIBLE` → `operativo`).
- Detección de columnas: coincidencia exacta primero, luego substring (ver `js/parser.js`). Candidata prioritaria para GPS: `GPS INSTALADO`, normalizando cobertura afirmativa con `Y`, `SI`, `S`, `YES`, `1`, `TRUE` o URLs de rastreo.
- Layout y componentes: uso exclusivo de CSS Grid (`grid gap-4 sm:gap-5`) con padding homogéneo `p-4 sm:p-5` en tarjetas; prohibido el uso de márgenes negativos (`-m-*`) o envolturas intermedias con padding extra que causen desalineación perimetral.
- El dashboard usa 8 categorías semánticas + `sin_clasificar` (reserva para valores desconocidos).
- Mapeo CSV → mapa: los nombres de estado se resuelven con `FleetConfig.resolveStateName()` (normalización + alias en `STATE_ALIASES`, ej. `LA GUAIRA` → Vargas, `DTTO. CAPITAL` → Distrito Capital). Los colores del SVG del mapa van siempre como atributos de presentación (`fill`/`stroke`), nunca solo CSS: html2canvas serializa el SVG sin las reglas de la página.
- La exportación usa `html2canvas-pro` (fork mantenido, no volver a `html2canvas`) y `data-report-section` para el flujo por sección del PDF, omitiendo elementos con `data-report-exclude` (ver `js/export.js`).
- Los CSV/Excel reales con datos personales (cédulas, correos, teléfonos) NUNCA se versionan (ver `.gitignore`).
- `PLAN.md` es local y no se versiona; refleja la planificación y decisiones.

## Neutralidad del producto y prevención de datos sensibles

El proyecto se mantiene enfocado en **Venezuela** a nivel territorial y cartográfico, pero sin vínculos a una empresa o proceso concreto. Estas reglas son permanentes salvo instrucción explícita en contrario del propietario:

- **Ámbito geográfico (Venezuela):** La herramienta está orientada a Venezuela por el momento (cartografía de 24 estados + Distrito Capital + Dependencias Federales + Guayana Esequiba). Los datos de muestra y plantillas usan entidades federales venezolanas.
- **Sin marca institucional:** No incluir referencias a CORPOELEC ni a ninguna otra empresa u organización real (nombres, siglas, logos, eslóganes, unidades organizativas). Reemplazar con placeholders genéricos: `EnergyCompany`, `Client`, "cliente de demostración".
- **Anonimización de datos:** Prohibido incluir datos reales de clientes, empleados o infraestructura: nombres, cédulas, correos, teléfonos, placas reales, direcciones, inventario real.
- **Datos de demo = mock data:** Los archivos de prueba (CSV/Excel/dumps) solo contienen datos ficticios con entidades de Venezuela.
- **Sin secretos ni endpoints:** No versionar contraseñas, tokens, API keys, credenciales de bases de datos ni rutas de red internas. Las únicas URLs permitidas son CDNs públicos necesarios para la funcionalidad (librerías, fuentes).
- **Solo datos ficticios versionados:** Cualquier archivo de datos con contenido potencialmente real queda en `.gitignore` (ver `*.csv` / `*.xlsx` / `*.xls` / `!template/flota_template.csv` / `!template/flota_template.xlsx`). Los archivos versionados siempre son sintéticos.
- **Autor y atribución:** El pie de página incluye la atribución de autoría a Daniel Caraballo con enlaces a GitHub, manteniendo la privacidad garantizada de procesamiento 100% client-side.
- **Revisión antes de commit/PR:** Buscar referencias sensibles en código, comentarios, nombres de variables, assets y documentos antes de publicar. Comando de referencia: `grep -riE "corpoelec|[a-z0-9._%+-]+@[a-z0-9.-]+" .`.

## Cómo se actualiza este archivo

Cuando el proyecto cambie de forma relevante (nuevos widgets, columnas, stack o fases), actualizar las secciones correspondientes de este archivo y registrar el cambio en `PLAN.md` (sección "Registro de cambios").
