# Caracterización de Familias en Caldas — Marco de Variables SISBEN IV
**Referencia metodológica:** DNP Observatorio de Familias, Boletines 16 (2021) y 17 (2023) · Documento de Trabajo No. 8 (2021)
**Fuente de datos:** `sisben_feb2026.csv` — 605,843 personas · 255,845 hogares · 27 municipios
**Fecha de elaboración:** Marzo 2026

---

## 1. Dimensión 1 — Tipología de Estructura Familiar

La tipología de estructura familiar se construye a partir del **parentesco de cada miembro con el jefe del hogar**, siguiendo la metodología Flórez & Cote (2016) adoptada por el DNP en el RSH/SISBEN IV.

### Variables base
| Campo SISBEN | Descripción | Disponibilidad |
|---|---|---|
| `tip_parentesco` | Parentesco con el jefe del hogar (19 categorías) | ✅ En `df` |
| `num_personas_hogar` | Total de personas en el hogar | ✅ En `jefes` |
| `sexo_persona` | Sexo del jefe (masculino/femenino) | ✅ En `jefes` |
| `tip_estado_civil` | Estado civil del jefe | ✅ En `jefes` |

### Tipologías derivadas (ya implementadas en el dashboard)
La clasificación ya está construida en `jefes['tipologia']` usando las siguientes reglas de parentesco:

| Tipología | Regla | % en Caldas 2026 |
|---|---|---|
| **Nuclear** | Tiene cónyuge y/o hijo(a), sin otros parientes ni no-parientes | 43.9% |
| **Unipersonal** | Hogar de una sola persona | 36.1% |
| **Extenso** | Tiene núcleo conyugal/filial + otros parientes, sin no-parientes | 12.4% |
| **Familiar sin núcleo** | Sin cónyuge ni hijo, pero con parientes colaterales | 6.6% |
| **Compuesto** | Tiene núcleo + personas no-parientes | 0.7% |
| **No familiar sin núcleo** | Sin parentesco entre los miembros | 0.3% |

### Desagregaciones analíticas recomendadas
- **Nuclear biparental vs monoparental**: se obtiene verificando si hay cónyuge (`tip_parentesco == 2`) en hogares nucleares.
- **Hogares con jefatura femenina**: `sexo_persona == 'Mujer'` en el jefe.
- **Extenso monoparental**: extensos sin cónyuge presente.

---

## 2. Dimensión 2 — Tipología Generacional y Curso de Vida

La composición etaria de los miembros del hogar permite identificar el perfil generacional y la etapa del curso de vida, que el DNP usa como el principal eje estructurante de la desigualdad social (Boletín 17, CEPAL 2016).

### Variables base
| Campo SISBEN | Descripción | Disponibilidad |
|---|---|---|
| `edad_calculada` | Edad de cada miembro del hogar | ✅ En `df` |
| `tip_parentesco` | Para identificar NNA, adultos, adultos mayores | ✅ En `df` |

### Grupos generacionales (DNP Boletines 16 y 17)
Tres cohortes construidas a partir de `edad_calculada` de los miembros del hogar:

| Grupo | Rango | Rol en el análisis |
|---|---|---|
| **NNA** | 0 – 14 años | Dependencia, trabajo infantil, cuidado |
| **Generación intermedia** | 15 – 59 años | Mercado laboral, carga del hogar |
| **Adultos mayores** | 60+ años | Pensiones, cuidados, aislamiento |

**6 tipologías generacionales del hogar:**

| Tipología | Descripción | Característica de pobreza |
|---|---|---|
| Sin adultos mayores | Solo NNA + gen. intermedia | Mayor prevalencia en Q1 de ingreso (62.1% nacional) |
| Sin niños | Solo gen. intermedia + adultos mayores | — |
| Multigeneracional | Las 3 generaciones presentes | Menor desigualdad interna (Boletín 17) |
| Generacional de gen. intermedia | Solo adultos 15-59 | Mayor proporción en Q5 (44.9% nacional) |
| Generacional de adultos mayores | Solo 60+ | Mayor desigualdad interna (ratio Q5/Q1 = 22x) |
| Sin generación intermedia | NNA + adultos mayores | Mayor pobreza multidimensional (60%+ con jefatura femenina) |

### Cursos de vida individuales (Boletín 17)
Para el análisis a nivel de persona, se usan 6 etapas del curso de vida basadas en `edad_calculada`:

| Etapa | Rango | Variables clave a analizar |
|---|---|---|
| **Primera infancia** | 0 – 5 años | `tip_cuidado_niños`, `ind_recibe_comida`, `i5` (barreras cuidado) |
| **Infancia** | 6 – 11 años | `ind_estudia`, `i3` (inasistencia), `i6` (trabajo infantil) |
| **Adolescencia** | 12 – 17 años | `ind_estudia`, `i4` (rezago escolar), `tip_actividad_mes` |
| **Juventud** | 18 – 28 años | `tip_actividad_mes`, `tip_empleado`, `niv_educativo` |
| **Adultez** | 29 – 59 años | `ind_fondo_pensiones`, `tip_empleado`, `vlr_ingr_salario` |
| **Adultez mayor** | 60+ años | `tip_seg_social`, `ind_fondo_pensiones`, `vlr_ingr_pension` |

---

## 3. Dimensión 3 — Ciclo de Vida del Hogar Nuclear

Para hogares nucleares, el DNP (Documento de Trabajo No. 8) identifica 6 etapas del ciclo de vida basadas en la presencia y edad de los hijos y el estado del núcleo:

### Variables base
| Campo SISBEN | Descripción | Disponibilidad |
|---|---|---|
| `edad_calculada` del jefe | Edad del jefe | ✅ En `jefes` |
| `edad_calculada` de hijos | Edades de los miembros con `tip_parentesco == 3` | ✅ En `df` |
| `ind_conyuge_vive_hogar` | Si el cónyuge vive en el hogar | ✅ En `df` |

### Etapas del ciclo de vida (solo hogares nucleares)
| Etapa | Descripción |
|---|---|
| 1. Inicio | Pareja sin hijos |
| 2. Expansión | Hijo menor tiene 0–5 años |
| 3. Consolidación | Hijo menor tiene 6–12 años |
| 4. Salida | Hijo menor tiene 13–18 años |
| 5. Nido vacío | Sin hijos en el hogar, cónyuge presente |
| 6. Disolución | Sin cónyuge, sin hijos (hogar que fue nuclear) |

---

## 4. Dimensión 4 — Caracterización Socioeconómica

### 4.1 Clasificación SISBEN IV y Pobreza

| Campo SISBEN | Descripción | Disponibilidad |
|---|---|---|
| `Grupo` | Grupo SISBEN (A/B/C/D) | ✅ En `df` |
| `Nivel` | Subgrupo (A1–A5, B1–B7, C1–C18, D1–D21) | ✅ En `df` |
| `Clasificación` | Concatenación Grupo + Nivel | ✅ En `df` |
| `h5` | Indicador de Pobreza Multidimensional (proxy IPM) | ✅ En `df` |
| `C` | Número de privaciones IPM del hogar | ✅ En `df` |

**Las 15 privaciones IPM** (calculadas por DNP, disponibles en la base):

| Variable | Privación |
|---|---|
| `i1` | Bajo logro educativo |
| `i2` | Analfabetismo |
| `i3` | Inasistencia escolar |
| `i4` | Rezago escolar |
| `i5` | Barreras al cuidado de primera infancia |
| `i6` | Trabajo infantil |
| `i7` | Desempleo de larga duración |
| `i8` | Trabajo informal |
| `i9` | Sin aseguramiento en salud |
| `i10` | Barreras de acceso a servicios de salud |
| `i11` | Sin acceso a fuentes de agua mejorada |
| `i12` | Inadecuada eliminación de excretas |
| `i13` | Material inadecuado de pisos |
| `i14` | Material inadecuado de paredes exteriores |
| `i15` | Hacinamiento crítico |

---

### 4.2 Territorio y Vivienda

| Campo SISBEN | Descripción | Disponibilidad |
|---|---|---|
| `Cod_mpio` / `nom_mpio` | Municipio | ✅ |
| `cod_clase` | Zona: 1=Cabecera, 2=Centro poblado, 3=Rural disperso | ✅ |
| `tip_vivienda` | Tipo: casa, apartamento, cuarto, otro, indígena | ✅ |
| `tip_ocupa_vivienda` | Tenencia: arriendo, propia pagada, propia pagando, permiso, posesión | ✅ |
| `tip_mat_paredes` | Material paredes (8 categorías) | ✅ |
| `tip_mat_pisos` | Material pisos (6 categorías) | ✅ |
| `num_cuartos_exclusivos` | Cuartos del hogar | ✅ |
| `num_cuartos_dormir` | Cuartos para dormir (para calcular hacinamiento) | ✅ |
| `tip_sanitario` | Tipo de sanitario | ✅ |
| `tip_origen_agua` | Fuente de agua (9 categorías) | ✅ |
| `ind_tiene_acueducto` | Acceso a acueducto | ✅ |
| `ind_tiene_alcantarillado` | Acceso a alcantarillado | ✅ |
| `ind_tiene_energia` | Acceso a energía eléctrica | ✅ |
| `ind_tiene_gas` | Gas natural domiciliario | ✅ |
| `ind_tiene_recoleccion` | Servicio de recolección de basuras | ✅ |
| `tip_energia_cocina` | Combustible para cocinar | ✅ |
| `num_habita_vivienda` | Tiempo de residencia en la vivienda | ✅ |

**Indicadores derivados:**
- **Hacinamiento**: `num_personas_hogar / num_cuartos_dormir` > 3 (crítico según IPM)
- **Déficit cualitativo de vivienda**: combinación de materiales inadecuados + servicios faltantes

---

### 4.3 Capacidad Económica del Hogar

#### Gastos reportados
| Campo SISBEN | Descripción |
|---|---|
| `vlr_gasto_alimento` | Gasto mensual en alimentación |
| `vlr_gasto_transporte` | Gasto mensual en transporte |
| `vlr_gasto_educacion` | Gasto mensual en educación |
| `vlr_gasto_salud` | Gasto mensual en salud |
| `vlr_gasto_servicios_publicos` | Gasto mensual en servicios públicos |
| `vlr_gasto_arriendo` | Gasto mensual en arriendo |
| `vlr_gasto_celular` | Gasto mensual en celular |
| `vlr_gasto_otros` | Otros gastos mensuales |

#### Activos del hogar
| Campo SISBEN | Descripción |
|---|---|
| `ind_tiene_nevera` | Nevera |
| `ind_tiene_lavadora` | Lavadora |
| `ind_tiene_pc` | Computador |
| `ind_tiene_internet` | Conexión a internet |
| `ind_tiene_moto` | Moto |
| `ind_tiene_carro` | Carro |
| `ind_tiene_tractor` | Tractor (relevante zona rural) |
| `ind_tiene_bien_raiz` | Bienes raíces adicionales |

**Índice de activos recomendado:** sumar activos ponderados (nevera=1, lavadora=1, PC=2, internet=2, carro=3, tractor=2, bien raíz=3) para construir un score de capacidad económica.

---

### 4.4 Variables Demográficas Individuales

| Campo SISBEN | Descripción |
|---|---|
| `sexo_persona` | Sexo (1=Hombre, 2=Mujer) |
| `edad_calculada` | Edad en años |
| `tip_parentesco` | Parentesco con jefe (19 categorías) |
| `tip_estado_civil` | Estado civil (Unión libre, Casado, Viudo, Separado, Soltero) |
| `cod_pais_documento` | País de nacimiento (170=Colombia; otros=extranjero) |

**Indicadores de discapacidad por dimensión:**
| Campo | Dimensión |
|---|---|
| `ind_discap_ver` | Dificultad para ver |
| `ind_discap_oir` | Dificultad para oír |
| `ind_discap_hablar` | Dificultad para hablar |
| `ind_discap_moverse` | Dificultad para moverse |
| `ind_discap_bañarse` | Dificultad para autocuidado |
| `ind_discap_salir` | Dificultad para salir |
| `ind_discap_entender` | Dificultad cognitiva |

---

### 4.5 Educación

| Campo SISBEN | Descripción | Uso analítico |
|---|---|---|
| `ind_leer_escribir` | Sabe leer y escribir | Alfabetismo por curso de vida |
| `ind_estudia` | Asiste actualmente a educación | Cobertura escolar por edad |
| `niv_educativo` | Nivel educativo alcanzado (7 categorías) | Logro educativo por generación |
| `grado_alcanzado` | Grado dentro del nivel | Rezago escolar |
| `i1` | Privación: bajo logro educativo | Proxy IPM |
| `i2` | Privación: analfabetismo | Proxy IPM |
| `i3` | Privación: inasistencia escolar | Proxy IPM |
| `i4` | Privación: rezago escolar | Proxy IPM |
| `i6` | Privación: trabajo infantil | Proxy IPM |

**Niveles educativos:** Ninguno · Preescolar · Básica Primaria (1°-5°) · Básica Secundaria (6°-9°) · Media (10°-13°) · Técnico/Tecnológico · Universitario · Postgrado

---

### 4.6 Salud y Fecundidad

| Campo SISBEN | Descripción | Uso analítico |
|---|---|---|
| `tip_seg_social` | Régimen: Contributivo/Especial/Subsidiado/Ninguno | Cobertura salud por tipología |
| `ind_enfermo_30` | Morbilidad en últimos 30 días | Demanda potencial de servicios |
| `ind_acudio_salud` | Acudió a IPS cuando estuvo enfermo | Acceso efectivo |
| `ind_fue_atendido_salud` | Lo atendieron | Barrera de acceso |
| `ind_esta_embarazada` | Embarazo actual | Fecundidad activa |
| `ind_tuvo_hijos` | Ha tenido hijos | Historia reproductiva |
| `tip_cuidado_niños` | Cuidador de niños menores | Primera infancia |
| `ind_recibe_comida` | Niño recibe desayuno/almuerzo donde está | Seguridad alimentaria |
| `i9` | Privación: sin aseguramiento en salud | Proxy IPM |
| `i10` | Privación: barreras de acceso a salud | Proxy IPM |
| `i5` | Privación: barreras cuidado primera infancia | Proxy IPM |

---

### 4.7 Mercado Laboral

| Campo SISBEN | Descripción | Uso analítico |
|---|---|---|
| `tip_actividad_mes` | Actividad principal último mes (8 categorías) | Condición de actividad |
| `tip_empleado` | Posición ocupacional (10 categorías) | Calidad del empleo |
| `ind_fondo_pensiones` | Cotiza a pensión / es pensionado | Formalidad laboral |
| `num_sem_buscando` | Semanas buscando trabajo | Desempleo de larga duración |
| `i7` | Privación: desempleo de larga duración | Proxy IPM |
| `i8` | Privación: trabajo informal | Proxy IPM |

**Fuentes de ingreso individuales:**
| Campo | Fuente |
|---|---|
| `vlr_ingr_salario` | Salario |
| `vlr_ingr_honorarios` | Honorarios / trabajo independiente |
| `vlr_ingr_Cosecha` | Negocio o cosecha (relevante zona rural cafetero) |
| `vlr_ingr_pension` | Pensión |
| `vlr_ingr_Remesa_pais` | Remesas nacionales |
| `vlr_ingr_Remesa_exterior` | Remesas del exterior |
| `vlr_ingr_Arriendos` | Arriendos |
| `vlr_ingr_fam_accion` | Subsidio Familias en Acción |
| `vlr_ingr_col_mayor` | Subsidio Colombia Mayor |
| `vlr_ingr_otro_subsidio` | Otros subsidios del Estado |

**Actividad principal (8 categorías):** Trabajando · Buscando trabajo · Estudiando · Oficios del hogar · Rentista · Jubilado/pensionado · Incapacitado permanentemente · Sin actividad

**Posición ocupacional:** Empleado empresa particular · Empleado gobierno · Empleado doméstico · Profesional independiente · Cuenta propia · Patrón/empleador · Trabajador de finca/parcela · Sin remuneración · Jornalero/peón

---

### 4.8 Cobertura de Programas Sociales (Criterios SISBEN IV — Caldas)

Según el diccionario de programas vigente para Caldas:

| Programa | Entidad | Criterio SISBEN IV |
|---|---|---|
| Régimen Subsidiado | Min Salud | A1 a C18 |
| Familias en Acción | DPS | A1 a B4 |
| Jóvenes en Acción | DPS | A1 a C1 |
| Ingreso Solidario | DPS | A1 a C5 |
| Colombia Mayor | DPS | A1 a C1 |
| Inclusión Productiva | DPS | A1 a B7 |
| RESA | DPS | A1 a B4 |
| Primera Infancia | ICBF | A1 a C7 |
| Infancia | ICBF | A1 a C5 |
| Adolescencia y Juventud | ICBF | A1 a C7 |
| Nutrición | ICBF | A1 a B7 |
| Tú Eliges (educación superior) | ICETEX | A1 a C7 |
| Generación E Equidad | Min Educación | A1 a C1 |
| Casa Digna Vida Digna | Min Vivienda | Georreferenciación + IPM |

---

### 4.9 Vulnerabilidad Territorial y Ambiental

Variables disponibles para el análisis de riesgo de desastres naturales (relevante para Eje Cafetero — zona sísmica y de ladera):

| Campo SISBEN | Evento |
|---|---|
| `ind_evento_inundacion` / `num_evento_inundacion` | Inundaciones |
| `ind_evento_avalancha` / `num_evento_avalancha` | Avalanchas |
| `ind_evento_terremoto` / `num_evento_terremoto` | Terremotos |
| `ind_evento_incendio` / `num_evento_incendio` | Incendios |
| `ind_evento_vendaval` / `num_evento_vendaval` | Vendavales |
| `ind_evento_hundimiento` / `num_evento_hundimiento` | Hundimientos |
| `coord_x_auto_rec` / `coord_y_auto_rec` | Georreferenciación del hogar |

---

## 5. Matriz Resumen: Variables por Dimensión de Caracterización

| Dimensión | Variables clave | Nivel de análisis | Fuente en la base |
|---|---|---|---|
| Estructura familiar | `tip_parentesco`, `num_personas_hogar`, `sexo jefe`, `tip_estado_civil` | Hogar | `df` + `jefes` |
| Tipología generacional | `edad_calculada` (todos los miembros) | Hogar | `df` |
| Curso de vida individual | `edad_calculada`, `sexo_persona` | Persona | `df` |
| Ciclo de vida nuclear | `edad_calculada` jefe + hijos, `ind_conyuge_vive_hogar` | Hogar | `df` |
| Pobreza y clasificación | `Grupo`, `h5`, `i1`–`i15`, `C` | Persona/Hogar | `df` |
| Territorio y vivienda | `cod_clase`, `tip_vivienda`, `tip_ocupa_vivienda`, servicios | Hogar/Vivienda | `df` |
| Economía del hogar | gastos, activos, ingresos | Hogar/Persona | `df` |
| Educación | `ind_leer_escribir`, `ind_estudia`, `niv_educativo` | Persona | `df` |
| Salud | `tip_seg_social`, acceso, fecundidad | Persona | `df` |
| Mercado laboral | `tip_actividad_mes`, `tip_empleado`, `ind_fondo_pensiones` | Persona | `df` |
| Cobertura programas | `vlr_ingr_fam_accion`, `vlr_ingr_col_mayor`, + criterio grupo | Persona/Hogar | `df` |
| Vulnerabilidad ambiental | eventos desastres, georreferenciación | Hogar/Vivienda | `df` |

---

## 6. Variables Prioritarias para el Eje Cafetero (Especificidades Regionales)

El contexto del Eje Cafetero (economía cafetera, ruralidad dispersa, minería en algunos municipios, municipios PDET) agrega relevancia a las siguientes variables:

1. **`vlr_ingr_Cosecha`** — Captura ingresos de economía agraria (café, plátano), estacional y variable.
2. **`tip_energia_cocina`** — Alta presencia de leña en zona rural dispersa; indicador de pobreza energética.
3. **`ind_tiene_tractor`** — Propiedad de medios de producción agrícola.
4. **`cod_clase == 3`** (Rural disperso) — Identifica hogares en veredas; correlaciona con menor acceso a salud, educación superior y mercado laboral formal.
5. **`ind_evento_avalancha` + `ind_evento_terremoto`** — Eje Cafetero = zona de alta sismicidad y riesgo de movimientos en masa.
6. **`cod_pais_documento != 170`** — Presencia venezolana relevante en Manizales y municipios cafeteros (1.91% del total Caldas, 97.1% venezolanos).
7. **`tip_empleado == 7`** (Trabajador de finca propia/arrendada/aparcería) — Captura la economía cafetera informal y la relación tierra-trabajo.
8. **`niv_educativo` en zona rural** — Brecha educativa rural/urbana documentada en Boletín 17: solo 2% de jóvenes rurales dispersos alcanza título universitario.
9. **`tip_cuidado_niños`** — En hogares extensos rurales, frecuente que los niños queden al cuidado de parientes mientras los adultos trabajan en el campo.
10. **`i8` (trabajo informal)** — Alta informalidad laboral en municipios cafeteros y mineros (Riosucio, Marmato, Supía).

---

## 7. Propuesta de Consultas Exploratorias Sugeridas

Con base en este marco, las siguientes consultas permitirían construir una caracterización completa de las familias caldenses:

1. **Consulta 4** — Tipología generacional de los hogares por municipio y zona (urbana/rural).
2. **Consulta 5** — Incidencia proxy IPM (h5) por tipología de estructura familiar y sexo del jefe — replicando la metodología del Boletín 16 para Caldas.
3. **Consulta 6** — Acceso a salud (régimen, morbilidad, atención efectiva) por tipología familiar y curso de vida.
4. **Consulta 7** — Logro educativo y analfabetismo por etapa del curso de vida, zona y tipología familiar.
5. **Consulta 8** — Mercado laboral: actividad principal, posición ocupacional e informalidad (i8) según tipología y generación.
6. **Consulta 9** — Fuentes de ingreso del hogar según tipología familiar (identificando el peso de cosechas, subsidios y remesas).
7. **Consulta 10** — Cobertura de programas sociales vs. criterio de elegibilidad SISBEN IV (identificar hogares elegibles que no reciben subsidio).
8. **Consulta 11** — Caracterización de hogares en zona rural dispersa vs. cabecera municipal: brechas en servicios, educación y salud.

---

*Documento elaborado con base en: DNP Observatorio de Familias, Boletín No. 16 (Dic. 2021) "La Familia y el Sisbén"; Boletín No. 17 (Jul. 2023) "Familias y matriz de la desigualdad social en Colombia"; Documento de Trabajo No. 8 (Oct. 2021) "Análisis de la estructura familiar a la luz del RSH"; Diccionario Sisbén IV FINAL (DNP); Base SISBEN Caldas Febrero 2026.*
