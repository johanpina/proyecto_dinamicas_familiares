# Databricks notebook source
# MAGIC %md
# MAGIC # 05 · Gold · Diccionarios de Datos
# MAGIC
# MAGIC Genera `gold.diccionarios` con los **nombres reales de columnas** de las tablas Silver y Gold,
# MAGIC incluyendo tipo de dato y valores posibles para columnas categóricas.
# MAGIC
# MAGIC Esquema final:
# MAGIC | columna | descripción |
# MAGIC |---------|-------------|
# MAGIC | fuente | ECV / DANE / SISBEN / SIVIGILA |
# MAGIC | tabla | Nombre completo (silver.ecv_craccompohog, gold.jefes_hogar_dane, …) |
# MAGIC | columna | Nombre real de la columna en la tabla |
# MAGIC | tipo_dato | string / int / double / … |
# MAGIC | tipo_columna | ID / categorica / numerica / texto_libre |
# MAGIC | valores_posibles | Valores únicos (categóricas) o "min=X, max=Y, media=Z" (numéricas) |
# MAGIC | n_valores_unicos | Cardinalidad aproximada |

# COMMAND ----------

from pyspark.sql import functions as F
from pyspark.sql.types import StringType, IntegerType, LongType, DoubleType, FloatType

# ─────────────────────────────────────────────────────────────────────────────
# CONFIGURACIÓN
# ─────────────────────────────────────────────────────────────────────────────

CATALOGO = "workspace"
MAX_CATEGORICAS = 40      # cardinalidad máxima para listar valores únicos
SAMPLE_FRAC    = 0.05     # fracción de muestra para tablas grandes (5%)
SAMPLE_UMBRAL  = 500_000  # filas a partir de las cuales se muestrea

# Tablas a procesar: (fuente, tabla)
TABLAS = [
    # ── Silver ECV ──────────────────────────────────────────────────────────
    ("ECV",      "silver.ecv_craccompohog"),   # Composición del hogar (jefes)
    ("ECV",      "silver.ecv_fuertra"),         # Fuerza de trabajo
    ("ECV",      "silver.ecv_salud"),           # Salud
    ("ECV",      "silver.ecv_educacion"),       # Educación
    ("ECV",      "silver.ecv_condvidhog"),      # Condiciones de vida
    ("ECV",      "silver.ecv_servhog"),         # Servicios del hogar
    ("ECV",      "silver.ecv_atennin5"),        # Atención niños < 5 años
    ("ECV",      "silver.ecv_condvidhogpro"),   # Programas sociales
    ("ECV",      "silver.ecv_datosviv"),        # Datos de la vivienda
    ("ECV",      "silver.ecv_teccom"),          # Tecnologías / internet
    ("ECV",      "silver.ecv_trainf"),          # Trabajo infantil
    # ── Silver DANE ─────────────────────────────────────────────────────────
    ("DANE",     "silver.dane_personas"),
    ("DANE",     "silver.dane_hogares"),
    ("DANE",     "silver.dane_viviendas"),
    # ── Silver SISBEN ───────────────────────────────────────────────────────
    ("SISBEN",   "silver.sisben"),
    # ── Silver SIVIGILA ─────────────────────────────────────────────────────
    ("SIVIGILA", "silver.sivigila_intsui"),
    ("SIVIGILA", "silver.sivigila_vigsalpub"),
    # ── Gold ────────────────────────────────────────────────────────────────
    ("DANE",     "gold.jefes_hogar_dane"),
    ("DANE",     "gold.composicion_hogar_dane"),
    ("ECV",      "gold.jefes_hogar_ecv"),
    ("ECV",      "gold.fuerza_trabajo_ecv"),
    ("SIVIGILA", "gold.sivigila_intsui"),
    ("SIVIGILA", "gold.sivigila_vigsalpub"),
    ("SISBEN",   "gold.sisben_municipio"),
    ("SISBEN",   "gold.sisben_jefatura"),
    ("ECV",      "gold.condiciones_vida_ecv"),
    ("ECV",      "gold.educacion_ecv"),
    ("ECV",      "gold.vivienda_ecv"),
    ("ECV",      "gold.servicios_hogar_ecv"),
    ("ECV",      "gold.salud_ecv"),
    ("ECV",      "gold.tic_ecv"),
]

# Columnas que son IDs / llaves de unión — no aportan como diccionario
COLS_ID = {
    "DIRECTORIO", "SECUENCIA_ENCUESTA", "SECUENCIA_P", "ORDEN",
    "FEX_C", "tipo_registro", "numero_registro",
    "codigo_encuesta", "numero_vivienda", "numero_hogar_en_vivienda",
    "numero_persona_en_hogar", "num_orden_informante",
}

TIPOS_NUMERICOS = (IntegerType, LongType, DoubleType, FloatType)

# ─────────────────────────────────────────────────────────────────────────────
# FUNCIÓN PRINCIPAL
# ─────────────────────────────────────────────────────────────────────────────

def procesar_tabla(fuente: str, tabla: str) -> list[dict]:
    print(f"\n{'='*60}")
    print(f"  Procesando: {tabla}")
    print(f"{'='*60}")

    try:
        df = spark.table(tabla)
    except Exception as e:
        print(f"  ✗ No se pudo leer {tabla}: {e}")
        return []

    n_filas = df.count()
    print(f"  Filas totales: {n_filas:,}")

    # Muestra para tablas grandes
    if n_filas > SAMPLE_UMBRAL:
        df_sample = df.sample(fraction=SAMPLE_FRAC, seed=42)
        print(f"  Usando muestra del {SAMPLE_FRAC*100:.0f}% ({int(n_filas*SAMPLE_FRAC):,} filas)")
    else:
        df_sample = df

    schema = {f.name: f.dataType for f in df.schema.fields}
    filas = []

    for col_name, col_type in schema.items():
        es_id = col_name.upper() in {c.upper() for c in COLS_ID}
        es_numerico = isinstance(col_type, TIPOS_NUMERICOS)

        # Cardinalidad aproximada (rápido)
        try:
            n_unicos = df_sample.select(
                F.approx_count_distinct(F.col(col_name)).alias("n")
            ).collect()[0]["n"]
        except Exception:
            n_unicos = -1

        # Clasificar columna
        if es_id:
            tipo_col = "id"
            valores = "Llave de unión / identificador"
        elif es_numerico and n_unicos > MAX_CATEGORICAS:
            tipo_col = "numerica"
            try:
                stats = df_sample.select(
                    F.min(col_name).alias("min"),
                    F.max(col_name).alias("max"),
                    F.round(F.avg(col_name), 2).alias("media"),
                ).collect()[0]
                valores = f"min={stats['min']}, max={stats['max']}, media={stats['media']}"
            except Exception:
                valores = "numérica continua"
        elif n_unicos <= MAX_CATEGORICAS and n_unicos > 0:
            tipo_col = "categorica"
            try:
                rows = (
                    df_sample
                    .groupBy(col_name)
                    .count()
                    .orderBy(F.col("count").desc())
                    .limit(MAX_CATEGORICAS)
                    .collect()
                )
                valores = " | ".join(
                    f"{r[col_name]}={r['count']:,}"
                    for r in rows
                    if r[col_name] is not None
                )
            except Exception:
                valores = "categórica"
        elif n_unicos > MAX_CATEGORICAS:
            tipo_col = "texto_libre" if isinstance(col_type, StringType) else "numerica"
            valores = f"alta cardinalidad ({n_unicos:,} valores únicos)"
        else:
            tipo_col = "desconocida"
            valores = ""

        filas.append({
            "fuente":           fuente,
            "tabla":            tabla,
            "columna":          col_name,
            "tipo_dato":        str(col_type),
            "tipo_columna":     tipo_col,
            "valores_posibles": valores,
            "n_valores_unicos": int(n_unicos) if n_unicos >= 0 else None,
        })
        print(f"  ✓ {col_name:45s} [{tipo_col}]  n_únicos={n_unicos}")

    return filas

# ─────────────────────────────────────────────────────────────────────────────
# EJECUTAR PARA TODAS LAS TABLAS
# ─────────────────────────────────────────────────────────────────────────────

todas_filas = []
for fuente, tabla in TABLAS:
    filas = procesar_tabla(fuente, tabla)
    todas_filas.extend(filas)

print(f"\n\nTotal de filas del diccionario: {len(todas_filas):,}")

# ─────────────────────────────────────────────────────────────────────────────
# CREAR gold.diccionarios
# ─────────────────────────────────────────────────────────────────────────────

from pyspark.sql.types import StructType, StructField, StringType as ST, IntegerType as IT

schema_dic = StructType([
    StructField("fuente",           ST(), True),
    StructField("tabla",            ST(), True),
    StructField("columna",          ST(), True),
    StructField("tipo_dato",        ST(), True),
    StructField("tipo_columna",     ST(), True),
    StructField("valores_posibles", ST(), True),
    StructField("n_valores_unicos", IT(), True),
])

df_dic = spark.createDataFrame(todas_filas, schema=schema_dic)

(
    df_dic
    .write
    .format("delta")
    .mode("overwrite")
    .option("overwriteSchema", "true")
    .saveAsTable(f"{CATALOGO}.gold.diccionarios")
)

print("\n✓ gold.diccionarios creada correctamente")
print(f"  Total columnas documentadas: {len(todas_filas):,}")

# ─────────────────────────────────────────────────────────────────────────────
# VERIFICACIÓN
# ─────────────────────────────────────────────────────────────────────────────

# COMMAND ----------

# MAGIC %sql
# MAGIC SELECT fuente, tabla, COUNT(*) AS n_columnas
# MAGIC FROM workspace.gold.diccionarios
# MAGIC GROUP BY fuente, tabla
# MAGIC ORDER BY fuente, tabla

# COMMAND ----------

# MAGIC %sql
# MAGIC -- Vista previa: columnas categóricas con sus valores
# MAGIC SELECT tabla, columna, tipo_dato, valores_posibles
# MAGIC FROM workspace.gold.diccionarios
# MAGIC WHERE tipo_columna = 'categorica'
# MAGIC   AND tabla LIKE '%ecv_craccompohog%'
# MAGIC ORDER BY columna
# MAGIC LIMIT 30
