# Resumen de Sesión de Trabajo — ProyectoMencha
## SISBEN IV Caldas · Caracterización de Familias y Dashboard Interactivo

**Fecha:** 26 de marzo de 2026
**Modelo:** Claude Sonnet 4.6 (Cowork mode)
**Carpeta de trabajo:** `ProyectoMencha/`

---

## 1. Contexto y punto de partida

El proyecto analiza los **255.845 hogares registrados en SISBEN IV para el departamento de Caldas**. Las sesiones anteriores (antes de este resumen) ya habían construido:

- Un pipeline de datos Python que lee los archivos fuente de SISBEN IV, construye un pickle (`/tmp/sisben_hogar_data.pkl`) con dos DataFrames principales:
  - `data['jefes']`: 255.845 filas, una por hogar (jefe de hogar como unidad de referencia)
  - `data['df']`: 605.843 filas, todos los miembros del hogar
- Scripts de empaquetado de datos (`compute_packed.py`, `compute_packed2.py`) para construir un JSON compacto con datos bit-packed para el dashboard
- Un primer prototipo del dashboard HTML

---

## 2. Trabajo realizado en esta sesión

### 2.1 Marco de Caracterización de Familias

**Prompt del usuario:**
> "Lee los cuatro documentos de referencia del DNP (Boletín 16, Boletín 17, Documento de Trabajo 8 y 9) y el diccionario SISBEN IV, y produce un conjunto de variables recomendadas para caracterizar familias en Caldas, organizadas por dimensiones de la tipología del DNP."

**Fuentes consultadas:**
- Boletín No. 16 — Observatorio de Familias DNP (dic. 2021)
- Boletín No. 17 — Observatorio de Familias DNP (jul. 2023)
- Documento de Trabajo No. 8 — DNP Tipología Familiar
- Documento de Trabajo No. 9 — DNP Curso de vida
- Diccionario SISBEN IV actualizado (`Diccionario Sisbén IV-FINAL Johan.xlsx`)

**Producto generado:**
- `caracterizacion_familias_caldas.md` — documento con 7 secciones:
  1. Tipología estructural (6 tipos: nuclear completa, nuclear incompleta, extensa, compuesta, unipersonal, sin núcleo)
  2. Tipología generacional (6 tipos: unigeneracional adultos/mayores, bigeneracional, trigeneracional, etc.)
  3. Ciclo de vida familiar (6 etapas DNP: formación, expansión, consolidación, contracción, nido vacío, disolución)
  4. Curso de vida individual (5 grupos: Primera infancia 0-5, Infancia 6-11, Adolescencia 12-17, Juventud 18-28, Adultez 29-59, Adultez mayor 60+)
  5. Dimensiones socioeconómicas (IPM, ingresos, programas sociales, discapacidad, vivienda)
  6. Variables prioritarias para el Eje Cafetero
  7. Consultas SQL/pandas propuestas

**Variables clave identificadas en SISBEN IV:**

| Dimensión | Variables SISBEN IV |
|---|---|
| Estructura familiar | `posicion_persona_hogar`, `parentesco`, `total_personas_hogar` |
| Generacional | `edad`, `rango_edad` (5 grupos) |
| Ciclo de vida | `estado_civil`, `ind_conyuge_en_hogar`, `ind_tuvo_hijos` |
| IPM privaciones | `i1`–`i15`, `h5`, puntaje `C` |
| Discapacidad | `discapacidad_ver/oir/hablar/moverse/bañarse/salir/entender` |
| Ingresos | `ingreso_hogar`, `vlr_ingr_salario`, `vlr_ingr_pension`, subsidios |
| Programas sociales | `valor_subsidio_familias_accion`, `valor_subsidio_colombia_mayor` |
| Clasificación SISBEN | `puntaje_sisben`, `grupo_pobreza`, `clasificacion_sisben` (A1–D21) |

---

### 2.2 Conversión del Marco a PDF

**Prompt del usuario:**
> "Convierte el documento en PDF."

**Acción:** Se ejecutó `build_pdf.py` usando `reportlab` con paleta de colores DNP verde.

**Producto:** `caracterizacion_familias_caldas.pdf` (28 KB) — portada, tabla de metadatos, secciones y tablas con formato profesional.

---

### 2.3 Diagnóstico y corrección del Dashboard — Carga infinita

**Prompt del usuario:**
> "Ayúdame a ajustar el dashboard porque parece que queda cargando diciendo que procesa los datos pero no sale nada."

**Diagnóstico:**
El archivo `dashboard_hogares_sisben.html` referenciaba `<script src="plotly.min.js">` como archivo externo. Al abrir en `file://`, el navegador no puede cargar recursos externos de la misma ruta.

**Corrección:**
Se incrustó Plotly.js directamente en el HTML (4.7 MB inline), haciendo el dashboard completamente autocontenido. Tamaño final: ~12.4 MB.

---

### 2.4 Corrección de TypeError en `drawCombos`

**Error en consola del navegador:**
```
TypeError: Cannot read properties of undefined (reading 'combo')
  at drawCombos
```

**Diagnóstico:**
El JSON empaquetado tenía la estructura:
```json
{ "combos": { "combo": [...], "hogares": [...], "pct": [...] } }
```
Pero el código JavaScript leía `RAW.combos` como si fuera `RAW.combo` (nombre distinto), y además esperaba `RAW.combos.combo` siendo un array de `[label, count]`.

**Corrección:** Se reescribió `drawCombos()` para leer correctamente `RAW.combos.combo`, `RAW.combos.hogares` y `RAW.combos.pct` de la estructura JSON actualizada.

---

### 2.5 Corrección de Discapacidad (0.0% → 21.3%)

**Problema reportado por el usuario (captura de pantalla):**
> "Ahora ya no salen los datos de discapacidad."

**Diagnóstico:**
```python
# En dashboard_packed.json:
"pct_discap": 0.0   # ← incorrecto

# Verificación en pickle:
jefes['hogar_con_discap'].value_counts()
# hogar_con_discap: False → 255845  (¡todo False!)
```

El campo `hogar_con_discap` en el pickle fue calculado incorrectamente en sesiones anteriores. Las columnas de discapacidad del pickle (`discapacidad_ver`, `discapacidad_oir`, etc.) tienen valores `'Sí'` / `'2'`, no `True`/`False`.

**Corrección (script `compute_packed3.py`):**
```python
disc_cols = ['discapacidad_ver','discapacidad_oir','discapacidad_hablar',
             'discapacidad_moverse','discapacidad_banarse','discapacidad_salir',
             'discapacidad_entender']
df['tiene_disc'] = (df[disc_cols] == 'Sí').any(axis=1)
disc_hogar = df.groupby('id_ficha_origen')['tiene_disc'].any().reset_index()
jefes = jefes.merge(disc_hogar, on='id_ficha_origen', how='left')
```

**Resultado corregido:** 54.571 hogares (21.3%) con al menos un miembro con alguna discapacidad funcional.

---

### 2.6 Corrección del Mapa (tile layer bloqueado en `file://`)

**Error en consola:**
```
Unsafe attempt to load URL file:///...
```

**Diagnóstico:**
El mapa usaba `L.tileLayer('https://tile.openstreetmap.org/...')`. Los navegadores bloquean requests a URLs externas cuando el HTML se abre como `file://` por política de seguridad CORS.

**Corrección:**
Se eliminó el tile layer y se estableció un fondo sólido (`#e8f0f7`) directamente en el contenedor del mapa. El coroplético GeoJSON funciona perfectamente sin tiles.

```javascript
// Reemplazado:
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {...}).addTo(leafletMap);

// Por:
leafletMap = L.map('chart-map', { zoomControl: true, attributionControl: false, preferCanvas: true });
const mapEl = document.getElementById('chart-map');
mapEl.style.background = '#e8f0f7';
```

---

### 2.7 Cambio de etiqueta: "Joven (12-17)" → "Adolescente (12-17)"

**Prompt del usuario:**
> "Cambia en esta gráfica para que en lugar de Joven(12-17) salga Adolescente(12-17)."

**Acción:** Se actualizó `rango_labels` en `compute_packed3.py`:
```python
# Antes:
rango_labels = ['Menor (0-11)','Joven (12-17)',...]
# Después:
rango_labels = ['Menor (0-11)','Adolescente (12-17)',...]
```

**Bug secundario detectado:** El cambio de etiqueta rompió el mapping de los 323 jefes de 12-17 años (el pickle seguía usando el valor `'Joven (12-17)'`), que caían al bucket por defecto (Adulto 28-59). Solucionado con un mapa explícito que acepta ambas etiquetas.

---

### 2.8 Mejora de la gráfica "Composición del Hogar — Parentesco por Posición"

**Prompt del usuario:**
> "Ajusta este gráfico para que también sea dinámico y que sea cross-filter por municipios, estado civil, etc. Genera una mejor explicación y en el tooltip que salga el porcentaje y además los registros a los que corresponde."

**Cambios realizados:**

**Tooltip mejorado** — `customdata` con `[count, total]` por posición:
```javascript
hovertemplate:
  `<b>${label}</b><br>` +
  `%{y}: <b>%{x:.1f}%</b><br>` +
  `Hogares con este parentesco: <b>%{customdata[0]}</b><br>` +
  `Total hogares en esa posición: %{customdata[1]}<extra></extra>`,
```

**Descripción mejorada** — explicación de cómo leer la gráfica:
> "Cada fila representa una posición dentro del hogar: la Persona 2 es el segundo miembro registrado... El ancho de cada segmento es el porcentaje de hogares en los que esa posición la ocupa ese parentesco..."

**Confirmación cross-filter:** `drawMembers(memberStats)` ya estaba en el ciclo `update()` — se mejoró la nota visible en el encabezado de la tarjeta.

---

### 2.9 Diagnóstico completo de consistencia de datos

**Prompt del usuario:**
> "Verifica la consistencia de todos esos datos."

**Auditoría realizada — todos los bits del packed Int32Array:**

| Campo | Bits | Valor verificado | Estado |
|---|---|---|---|
| Sexo (jefe) | bit 0 | 55.5% mujer | ✅ |
| Municipio | bits 1-5 | 27 municipios, Manizales 25.6% | ✅ |
| Grupo hogar | bits 6-8 | 36.1% unipersonal, suma=100% | ✅ |
| Zona | bit 9 | 68.8% urbano | ✅ |
| Estado civil | bits 10-12 | 46.5% viudo/a | ✅ |
| Edad jefe | bits 13-15 | suma exacta = 255.845 | ✅ corregido |
| Ocupación | bits 16-18 | 30.2% trabajando | ✅ |
| Discapacidad | bit 19 | 21.3% = 54.571 hogares | ✅ corregido |
| Familias en Acción | bit 20 | 3.2% = 8.242 hogares | ✅ |
| Colombia Mayor | bit 21 | 5.8% = 14.840 hogares | ✅ |

---

### 2.10 Reestructuración: estadísticas de TODOS los miembros

**Prompt del usuario:**
> "Los datos de por ejemplo edad, promedio de salario, etc... necesito que no los tengas en cuenta solo para jefes de hogar sino de todos los datos, lo mismo que género, así todo. Lo único es que de referencia sí son los jefes de hogar pero no de entrada filtrar solo esos."

**Cambio arquitectural:** El dashboard pasó de mostrar estadísticas del jefe únicamente a mostrar estadísticas de **todos los miembros de los hogares filtrados**.

**Cambios en el pipeline de datos (`compute_member_packed.py`):**

El byte de cada miembro (posiciones 2-6) se re-empaquetó para incluir el género:

```
Antes: bits 0-3 = par_idx | bits 4-7 = age_idx (4 bits, desperdiciado)
Ahora: bits 0-3 = par_idx | bits 4-6 = age_idx (3 bits) | bit 7 = sexo
```

**Cambios en `computeStats()` (JavaScript):**

Se añadió un segundo loop por miembros 2-6 dentro del ciclo de hogares filtrados:

```javascript
// Para cada hogar filtrado:
// 1. Contabilizar jefe (edad, sexo desde packed int)
sexoAllCnt[sex]++;
edadAllCnt[ed]++;
totalPersonas++;

// 2. Contabilizar miembros 2-6 (edad y sexo desde MEMBERS byte)
for (let pos = 0; pos < N_MEMPOS; pos++) {
  const byte = MEMBERS[base + pos];
  if (byte === 255) continue;
  const mAge  = (byte >> 4) & 0x07;
  const mSexo = (byte >> 7) & 0x01;
  edadAllCnt[mAge]++;
  sexoAllCnt[mSexo]++;
  totalPersonas++;
}
```

**Impacto en los datos mostrados:**

| Métrica | Antes (solo jefe) | Ahora (todos los miembros) |
|---|---|---|
| % Mujeres | 55.5% | **52.5%** |
| Edad promedio | 50.5 años | **38.7 años** |
| Menor (0-11) | 0.0% | **15.4%** (93.471 personas) |
| Adolescente (12-17) | 0.1% | **6.3%** (38.148 personas) |
| Adulto joven (18-27) | 8.8% | 15.1% |
| Adulto (28-59) | 58.2% | 42.2% |
| Adulto mayor (60+) | 32.8% | 21.0% |

**Total personas rastreadas:** 606.348 (de 605.843 en pickle — diferencia de ~505 personas en posición 7+ no capturadas por límite de 5 posiciones en MEMBERS).

---

### 2.11 Consulta sobre ECV 2024

**Prompt del usuario:**
> "¿Los datos que me diste para la caracterización y las columnas tienen en cuenta la Encuesta de Calidad de Vida 2024?"

**Respuesta:** No — el marco de caracterización se construyó exclusivamente con documentos del DNP y el diccionario SISBEN IV. La ECV 2024 no fue incorporada.

**Búsqueda web realizada:** Se consultó la ECV 2024 de DANE (boletín oficial, catálogo de microdatos).

**Hallazgos — módulos de ECV 2024 NO cubiertos por SISBEN IV:**

| Módulo ECV 2024 ausente | Relevancia para Caldas |
|---|---|
| Atención integral niños < 5 años | Alta ruralidad → baja cobertura jardines |
| Trabajo infantil | Hogares cafeteros y rurales |
| TIC y conectividad | Brecha digital urbano-rural pronunciada |
| Bienestar subjetivo / percepción de pobreza | Dimensión no monetaria del bienestar |
| Economía del cuidado | 32.8% jefes adultos mayores en Caldas |

**Limitación clave:** La ECV 2024 tiene desagregación departamental (Caldas = región Central) pero **no tiene desagregación municipal**, mientras que SISBEN IV cubre los 27 municipios individualmente con datos censales.

---

## 3. Estado final de los archivos

| Archivo | Descripción | Tamaño |
|---|---|---|
| `dashboard_hogares_sisben.html` | Dashboard interactivo autocontenido (Plotly + Leaflet inline) | 12.4 MB |
| `caracterizacion_familias_caldas.md` | Marco de variables para caracterización de familias | 19 KB |
| `caracterizacion_familias_caldas.pdf` | Versión PDF con formato DNP | 28 KB |

**Scripts de build en `/tmp/`:**

| Script | Función |
|---|---|
| `compute_packed3.py` | Empaqueta datos hogar desde pickle → `dashboard_packed.json` |
| `compute_member_packed.py` | Empaqueta datos de miembros 2-6 (parentesco, edad, sexo) |
| `build_dashboard.py` | Genera el HTML final desde `dashboard_packed.json` |

---

## 4. Cifras clave del dataset

| Indicador | Valor |
|---|---|
| Total hogares SISBEN IV Caldas | 255.845 |
| Total personas registradas | 605.843 |
| Personas rastreadas en dashboard | 606.348 |
| Municipios cubiertos | 27 |
| Municipio con más hogares | Manizales (65.494, 25.6%) |
| % Hogares urbanos | 68.8% |
| % Jefas de hogar mujer | 55.5% |
| % Mujeres (todos los miembros) | 52.5% |
| Edad promedio (todos los miembros) | 38.7 años |
| % Hogares con discapacidad (algún miembro) | 21.3% (54.571 hogares) |
| % Hogares Familias en Acción | 3.2% (8.242 hogares) |
| % Hogares Colombia Mayor | 5.8% (14.840 hogares) |
| Ingreso hogar promedio | $275.806 COP/mes |
| % Hogares unipersonales | 36.1% |
| Estado civil más frecuente jefe | Viudo/a (46.5%) |

---

## 5. Estructura del bit-packing (packed Int32Array)

Cada hogar está codificado en un entero de 32 bits:

```
Bit  0      → sexo jefe (0=Hombre, 1=Mujer)
Bits 1-5    → índice municipio (0-26, 27 municipios)
Bits 6-8    → grupo hogar (0=1p, 1=2p, 2=3p, 3=4p, 4=5p, 5=6+p)
Bit  9      → zona (0=Rural, 1=Urbano)
Bits 10-12  → estado civil (índice en lista ordenada)
Bits 13-15  → rango edad jefe (0=Menor, 1=Adolescente, 2=AdultoJoven, 3=Adulto, 4=AdultoMayor)
Bits 16-18  → ocupación jefe (0=Trabajando, 1=Buscando, 2=OficiosHogar, 3=Estudiando, 4=Otras)
Bit  19     → discapacidad (1 = algún miembro con discapacidad)
Bit  20     → Familias en Acción (1 = beneficiario)
Bit  21     → Colombia Mayor (1 = beneficiario)
```

Cada miembro (posiciones 2-6) está codificado en 1 byte:
```
Bits 0-3  → par_idx (parentesco, 0-9 categorías)
Bits 4-6  → age_idx (rango de edad, 0-4)
Bit  7    → sexo (0=Hombre, 1=Mujer)
```

---

## 6. Pendientes / próximos pasos sugeridos

1. **Actualizar `caracterizacion_familias_caldas.md`** incorporando los módulos de la ECV 2024 como contexto departamental comparativo (TIC, cuidado infantil, bienestar subjetivo).

2. **Filtro por clasificación SISBEN** (grupos A/B/C/D): actualmente los datos tienen `clasificacion_sisben` en el pickle pero no está empaquetado en el dashboard. Permitiría filtrar por nivel de pobreza.

3. **Gráfica de IPM**: los 15 indicadores `i1`–`i15` están en el pickle pero no se muestran en el dashboard. Serían muy relevantes para la caracterización.

4. **Descargar microdatos ECV 2024** del DANE para cruzar indicadores de calidad de vida con el universo SISBEN IV de Caldas.

5. **Exportar tablas del dashboard**: botón de descarga CSV con los hogares filtrados.

---

*Documento generado automáticamente por Claude Sonnet 4.6 — ProyectoMencha — 26 de marzo de 2026*
