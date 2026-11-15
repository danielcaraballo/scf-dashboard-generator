![Banner Tablero de Control de Flota](assets/banner.png)

# SCF · Generador de Tableros · Control de Flota

Generador de tableros de control y analítica visual de flota vehicular **100% Client-Side**. Diseñado para procesar exportaciones CSV y planillas Excel (`.xlsx`, `.xls`) de gran volumen (hasta 30 MB / 50 000 registros) directamente en el navegador, garantizando máxima privacidad sin enviar ningún dato a servidores externos.

---

## 🚀 Características Principales

- **Privacidad y Procesamiento 100% Local:** Carga y analiza datos íntegramente en el navegador usando PapaParse (Web Workers multihilo) y SheetJS (Worker dedicado con fallback síncrono). Ningún registro sale de tu dispositivo ni se transmite a internet.
- **Soporte Universal CSV y Excel:** Compatible con archivos `.csv` delimitados por coma o punto y coma, así como libros de Excel `.xlsx` y `.xls` generados por sistemas ERP o herramientas institucionales.
- **Detección Inteligente de Columnas:** Mapeo heurístico de columnas (exacto y por substrings) para estatus, ubicación geográfica, combustible, clase, denominación/tipo de vehículo, marca, modelo, cobertura GPS y verificación.
- **Semántica Operativa Estandarizada:** Clasificación automática en 8 categorías de estatus (Operativo, En Reparación, Inoperativo, Por Desincorporar, Desincorporado, Por Ubicar, Hurtado, Otros Entes) y reserva para valores desconocidos, con semáforo cromático (Verde &ge;80%, Ámbar &ge;50%, Rojo &lt;50%).
- **Mapa Interactivo de Venezuela:** Visualización cartográfica vectorial completa (24 estados, Distrito Capital, Dependencias Federales y Guayana Esequiba) coloreada por operatividad, con conmutador de etiquetas (*segmented pills*), inspección in-situ de entidades con Ficha Diagnóstica, leyenda dinámica interactiva con conteo de entidades por rango y *hover highlighting*.
- **Enfoque y Diagnóstico Estadal Adaptativo:** Split View automático para archivos mono-estado o filtros estadales desde datos nacionales, con pestañas interactivas (*Denominación / Tipo* vs. *Marca / Modelo*), barras de progreso con TOP 10 y categoría residual calculada al 100%, acompañado de un mini-localizador cartográfico nacional.
- **Filtros Combinables:** Selector interactivo de entidades geográficas y botón de **Flota Activa** (aísla unidades operativas, en taller e inoperativas) con recálculo instantáneo de todos los gráficos y KPIs.
- **Modo Claro y Oscuro Nativo:** Sistema de temas con detección de preferencias del sistema operativo (`prefers-color-scheme`), persistencia en `localStorage` y adaptación cromática en tiempo real de gráficos e interfaces.
- **Modo TV (Pantalla Completa):** Vista para centros de monitoreo (NOC) y salas situacionales que maximiza el espacio útil ocultando controles periféricos mediante `requestFullscreen` y salida rápida con tecla `Escape`.
- **Exportación Ejecutiva a PDF:** Generación en 2 páginas horizontales fijas tamaño Carta (Letter landscape, 279.4 &times; 215.9 mm) mediante `html2canvas-pro` y `jsPDF`, con encabezado institucional, metadata contextual, fuentes vectoriales incrustadas (Poppins + JetBrains Mono) y renderizado garantizado en tema claro.

---

## 🛠️ Stack Tecnológico

| Tecnología | Rol en el Proyecto |
| :--- | :--- |
| **HTML5 + Vanilla JS (ES6+)** | Arquitectura nativa modular (IIFE) sin frameworks pesados ni dependencias de compilación. |
| **Tailwind CSS v3 (Play CDN)** | Sistema de diseño basado en superficies Slate y tonos Sky, con soporte completo para `darkMode: 'class'`. |
| **PapaParse** | Parser multihilo para archivos CSV (`worker: true`) que evita el bloqueo de la interfaz. |
| **SheetJS (xlsx.full.min.js)** | Parser en Web Worker para libros de cálculo Excel (`.xlsx`, `.xls`) con fallback síncrono. |
| **Chart.js v4** | Motor de renderizado para gráficos de dona y barras horizontales con paleta semántica adaptativa. |
| **html2canvas-pro + jsPDF** | Captura vectorial de secciones del DOM y renderizado de reportes PDF multipágina de alta definición. |
| **SVG Cartográfico de Venezuela** | Vectorial embebido (636 &times; 530) con 25 entidades, badges de datos y líneas guía (*leader lines*). |

---

## 📂 Estructura del Proyecto

```text
scf-dashboard-generator/
├── assets/
│   └── banner.png             # Banner principal del proyecto
├── js/
│   ├── app.js                 # Flujo de carga, eventos y control de filtros
│   ├── charts.js              # Inicialización, temas y gestión de Chart.js
│   ├── config.js              # Mapeos de estatus, alias geográficos, límites y utilidades
│   ├── export.js              # Motor de exportación PDF Letter landscape con fuentes incrustadas
│   ├── map.js                 # Mapa interactivo de Venezuela, inspector in-situ y mini-mapa
│   ├── parser.js              # Lectura no bloqueante CSV/Excel y detección de columnas
│   ├── processing.js          # Agregaciones estadísticas O(n) y diagnóstico de flota
│   ├── theme.js               # Control de modo claro/oscuro y persistencia
│   ├── tv.js                  # Modo TV de pantalla completa para salas de control
│   ├── ui.js                  # Renderizado de Bento UI, tarjetas KPI y vistas adaptativas
│   └── venezuela-data.js      # Cartografía SVG embebida de Venezuela (25 entidades)
├── template/
│   ├── flota_template.csv     # Plantilla CSV sintética de referencia
│   └── flota_template.xlsx    # Plantilla Excel sintética rellenable
├── favicon.svg                # Logotipo e isotipo vectorial del proyecto
├── index.html                 # Interfaz principal (Bento Grid layout)
├── CHANGELOG.md               # Historial estandarizado de versiones y cambios
├── AGENTS.md                  # Contexto y directrices para agentes de IA y colaboradores
└── README.md                  # Documentación del proyecto
```

---

## ⚙️ Ejecución Local

El proyecto es **100% estático** y no requiere instalación de dependencias (`npm install`), Node.js ni procesos de compilación (*build step*).

1. **Clonar el repositorio:**

   ```bash
   git clone https://github.com/danielcaraballo/scf-dashboard-generator.git
   cd scf-dashboard-generator
   ```

2. **Iniciar un servidor local:**

   Cualquier servidor estático HTTP es compatible:

   ```bash
   # Opción 1: Python 3
   python3 -m http.server 8080

   # Opción 2: Node.js (npx)
   npx serve .
   ```

3. **Abrir en el navegador:**

   Accede a `http://localhost:8080` y arrastra la plantilla sintética `template/flota_template.csv` o tu propio archivo de datos.

---

## ⌨️ Atajos y Navegación

| Acción | Interacción |
| :--- | :--- |
| **Cerrar ficha diagnóstica en el mapa** | Presionar `Escape`, hacer clic en 'Cerrar' o hacer clic en el fondo del mapa. |
| **Salir de Modo TV (Pantalla Completa)** | Presionar `Escape` o hacer clic en el botón flotante inferior. |
| **Alternar Modo Claro / Oscuro** | Clic en el botón con icono de Sol/Luna en el encabezado. |
| **Filtrar por rango de operatividad** | Pasar el cursor sobre los niveles de la leyenda del mapa (&ge;80%, 50–79%, &lt;50%, Sin datos). |
| **Restablecer filtros globales** | Clic en el botón 'Limpiar' o seleccionar 'Todos los Estados'. |

---

## 🔒 Privacidad y Seguridad

- **Cero transferencia de red:** Todos los cálculos, agregaciones y renderizados se ejecutan en la memoria RAM del navegador del cliente.
- **Protección XSS:** Sanitización sistemática de cadenas en etiquetas, nombres de columnas y valores de celdas mediante `FleetConfig.escapeHtml()`.
- **Neutralidad de datos:** El repositorio no almacena credenciales, rutas internas ni datos sensibles reales.

---

## 📄 Licencia

Este proyecto está distribuido bajo la licencia [MIT](LICENSE).
© 2026 Daniel Caraballo. Todos los derechos reservados.
