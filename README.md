# Proyecto Dinámicas Familiares — SISBEN IV Caldas 🏠

Dashboard interactivo de caracterización y composición de hogares registrados en **SISBEN IV** para el departamento de **Caldas, Colombia** (corte 2026).

---

## 🎯 Objetivo

Visualizar, explorar y caracterizar la composición de los **255.845 hogares** registrados en SISBEN IV en los 27 municipios de Caldas, permitiendo análisis por tipología familiar, distribución demográfica, programas sociales y condiciones de vida, con cruce dinámico de variables (cross-filtering).

---

## 📊 El Dashboard

El archivo `dashboard_hogares_sisben.html` es un dashboard **100 % autocontenido** (sin dependencias externas) que puede abrirse directamente en cualquier navegador moderno.

### Características técnicas
- **Autocontenido**: Plotly.js (4.7 MB) y Leaflet.js embebidos inline — no requiere conexión a internet
- **Cross-filtering**: todos los gráficos se comunican entre sí; clic en cualquier barra, municipio o segmento filtra el universo completo
- **Bit-packed data**: 255.845 hogares codificados en Int32Array (22 bits por hogar) para máximo rendimiento en el navegador
- **Tiempo de respuesta**: <70 ms por actualización completa (filtrado + recálculo + render)

### Gráficos incluidos

| Gráfico | Descripción |
|---|---|
| Mapa coroplético | Concentración de hogares por municipio (27 municipios) |
| Género | Distribución por sexo de **todos** los miembros del hogar |
| Tipología del hogar | Tamaño: 1 a 6+ personas |
| Estado civil del jefe | Soltero, casado, unión libre, viudo, separado |
| Zona | Rural vs. urbano |
| Edad | Distribución de **todos** los miembros (Menor, Adolescente, Adulto joven, Adulto, Adulto mayor) |
| Ocupación | Actividad del jefe de hogar |
| Discapacidad | % hogares con al menos un miembro con discapacidad funcional |
| Programas sociales | Familias en Acción y Colombia Mayor |
| Ingreso | Distribución de ingresos del hogar |
| Combinaciones de parentesco | Tipos de relación en hogares de 2 personas |
| Composición por posición | Parentesco de personas 2 a 6 respecto al jefe |

---

## 🗂️ Estructura del repositorio

```
proyecto_dinamicas_familiares/
│
├── dashboard_hogares_sisben.html     # Dashboard interactivo principal
│
├── docs/
│   ├── caracterizacion_familias_caldas.md   # Marco de variables (DNP + SISBEN IV)
│   ├── caracterizacion_familias_caldas.pdf  # Versión PDF del marco
│   └── RESUMEN_SESION_TRABAJO.md            # Bitácora técnica del proyecto
│
└── README.md
```

---

## 🔧 Metodología de construcción de datos

### 1. Fuente de datos

- **SISBEN IV Caldas** — base de datos oficial del DNP (corte 2026)
- 605.843 personas en 255.845 hogares, 27 municipios
- Diccionario de variables: ~200 campos en secciones vivienda, hogar y persona

### 2. Preprocesamiento (Python / pandas)

```
Archivos fuente SISBEN IV
        ↓
Pipeline ETL (pandas)
        ↓
sisben_hogar_data.pkl
   ├── jefes: DataFrame (255.845 filas × ~110 cols)  ← referencia hogar
   └── df:    DataFrame (605.843 filas × ~110 cols)  ← todos los miembros
```

Variables derivadas calculadas:
- `rango_edad`: clasificación en 5 grupos de curso de vida (DNP)
- `grupo_hogar`: tipología por tamaño (1 a 6+ personas)
- `ingreso_hogar`: suma de todos los ingresos formales del hogar
- `hogar_con_discap`: verdadero si **algún** miembro tiene alguna de las 7 discapacidades funcionales
- `familias_accion`, `colombia_mayor`: boolean desde los subsidios registrados
- `zona`: urbano/rural desde `clase_area`

### 3. Empaquetado de datos para el dashboard

Cada hogar se comprime en **un entero de 32 bits** (bit-packing):

```
Bit  0      → sexo jefe (0=Hombre, 1=Mujer)
Bits 1–5    → índice municipio (27 municipios → 5 bits)
Bits 6–8    → grupo hogar (1–6+ personas → 3 bits)
Bit  9      → zona (0=Rural, 1=Urbano)
Bits 10–12  → estado civil (6 categorías → 3 bits)
Bits 13–15  → rango edad jefe (5 grupos → 3 bits)
Bits 16–18  → ocupación jefe (5 categorías → 3 bits)
Bit  19     → discapacidad hogar (cualquier miembro)
Bit  20     → Familias en Acción
Bit  21     → Colombia Mayor
```

Los miembros en posiciones 2–6 se empacan en **1 byte por persona**:

```
Bits 0–3  → parentesco (10 categorías)
Bits 4–6  → rango de edad (5 grupos)
Bit  7    → sexo (0=Hombre, 1=Mujer)
```

Los ingresos se almacenan en un segundo `Int32Array` (valor en miles de COP).

### 4. JavaScript cross-filter engine

```
applyFilters()          → Uint8Array mask (1 bit por hogar)  ~5–10 ms
computeStats(mask)      → agrega hogar-nivel + todos miembros  ~20–40 ms
computeMemberStats()    → parentesco/edad por posición  ~10 ms
draw*()  ×12            → actualiza gráficos Plotly  ~20–30 ms
─────────────────────────────────────────────────
Total update cycle:     < 70 ms
```

### 5. Marco de caracterización (Tipología DNP)

El documento `caracterizacion_familias_caldas.md` organiza las variables del SISBEN IV según las dimensiones del **Observatorio de Familias del DNP**:

| Dimensión | Fuente |
|---|---|
| Tipología estructural | Boletín No. 16 — DNP (dic. 2021) |
| Tipología generacional | Boletín No. 17 — DNP (jul. 2023) |
| Ciclo de vida familiar | Documento de Trabajo No. 8 — DNP |
| Curso de vida individual | Documento de Trabajo No. 9 — DNP |
| Privaciones IPM (i1–i15) | Metodología SISBEN IV — DNP |

---

## 📈 Cifras clave del dataset

| Indicador | Valor |
|---|---|
| Total hogares | 255.845 |
| Total personas | 605.843 |
| Municipios | 27 |
| Municipio con más hogares | Manizales (65.494 — 25,6 %) |
| % Hogares urbanos | 68,8 % |
| % Jefas de hogar mujer | 55,5 % |
| % Mujeres (todos los miembros) | 52,5 % |
| Edad promedio (todos los miembros) | 38,7 años |
| % Hogares con discapacidad | 21,3 % (54.571 hogares) |
| % Hogares — Familias en Acción | 3,2 % (8.242 hogares) |
| % Hogares — Colombia Mayor | 5,8 % (14.840 hogares) |
| Ingreso hogar promedio | $ 275.806 COP/mes |
| % Hogares unipersonales | 36,1 % |

---

## 🛠️ Stack tecnológico

| Componente | Tecnología |
|---|---|
| Procesamiento de datos | Python 3 · pandas · numpy · pickle |
| Empaquetado de datos | Int32Array bit-packing · Base64 |
| Visualización | Plotly.js 2.x (inline) |
| Mapa | Leaflet.js 1.9 + GeoJSON municipios Caldas |
| Dashboard | HTML5 vanilla · sin frameworks · sin servidor |

---

## 📚 Referencias

- **DNP — Observatorio de Familias:** Boletines 16 (2021) y 17 (2023), Documentos de Trabajo 8 y 9
- **DANE — ECV 2024:** Encuesta Nacional de Calidad de Vida (referencia contextual departamental)
- **DNP — SISBEN IV:** Metodología, diccionario de variables y fichas técnicas

---

## 👤 Autor

**Johan Pina** — Análisis y gestión de información social, Caldas, Colombia
Proyecto desarrollado con asistencia de **Claude (Anthropic)** — Cowork mode — marzo 2026

---

*Los datos del SISBEN IV son de uso oficial y restringido. Este repositorio contiene únicamente el código y la metodología del dashboard; los microdatos originales no se incluyen.*
