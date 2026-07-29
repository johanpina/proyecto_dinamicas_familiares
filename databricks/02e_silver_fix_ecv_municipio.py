# Databricks notebook source
# MAGIC %md
# MAGIC # 02e · Silver Fix · Añadir municipio a módulos ECV
# MAGIC
# MAGIC Añade columna `municipio` (nombre en texto) a los 10 módulos Silver ECV
# MAGIC que no la tienen, via LEFT JOIN con `silver.ecv_datosviv.cod_municipio` ON DIRECTORIO.
# MAGIC
# MAGIC `ecv_datosviv` ya tiene `cod_municipio` — se omite de este proceso.
# MAGIC
# MAGIC Módulos a actualizar:
# MAGIC | Módulo | Nivel |
# MAGIC |---|---|
# MAGIC | ecv_craccompohog | hogar (jefes) |
# MAGIC | ecv_condvidhog | hogar |
# MAGIC | ecv_servhog | hogar |
# MAGIC | ecv_teccom | hogar |
# MAGIC | ecv_fuertra | persona |
# MAGIC | ecv_salud | persona |
# MAGIC | ecv_educacion | persona |
# MAGIC | ecv_atennin5 | submuestra hogar |
# MAGIC | ecv_trainf | submuestra persona |
# MAGIC | ecv_condvidhogpro | submuestra hogar |

# COMMAND ----------

from pyspark.sql import functions as F

CATALOGO = "workspace"

# Módulos a actualizar (ecv_datosviv se omite — ya tiene cod_municipio)
MODULOS = [
    "ecv_craccompohog",
    "ecv_condvidhog",
    "ecv_servhog",
    "ecv_teccom",
    "ecv_fuertra",
    "ecv_salud",
    "ecv_educacion",
    "ecv_atennin5",
    "ecv_trainf",
    "ecv_condvidhogpro",
]

# Cargar tabla de referencia municipio una sola vez
df_mpio = (
    spark.table(f"{CATALOGO}.silver.ecv_datosviv")
    .select("DIRECTORIO", F.col("cod_municipio").alias("municipio"))
    .dropDuplicates(["DIRECTORIO"])
)

print(f"Municipios de referencia: {df_mpio.count():,} registros")
print(f"Departamentos y municipios cubiertos:")
(
    spark.table(f"{CATALOGO}.silver.ecv_datosviv")
    .select("departamento", "cod_municipio")
    .distinct()
    .orderBy("departamento", "cod_municipio")
    .show(60, truncate=False)
)

# COMMAND ----------

# MAGIC %md
# MAGIC ## Verificación previa — cobertura de municipios por departamento

# COMMAND ----------

# MAGIC %sql
# MAGIC SELECT departamento, COUNT(DISTINCT cod_municipio) AS n_municipios,
# MAGIC        COUNT(*) AS n_hogares
# MAGIC FROM workspace.silver.ecv_datosviv
# MAGIC GROUP BY departamento
# MAGIC ORDER BY departamento

# COMMAND ----------

# MAGIC %md
# MAGIC ## Reconstruir módulos Silver con columna municipio

# COMMAND ----------

resultados = []

for modulo in MODULOS:
    tabla = f"{CATALOGO}.silver.{modulo}"
    print(f"\n{'='*55}")
    print(f"  Procesando: {modulo}")
    print(f"{'='*55}")

    try:
        df = spark.table(tabla)
        filas_antes = df.count()

        # Verificar si ya tiene columna municipio
        if "municipio" in df.columns:
            print(f"  ⚠️  Ya tiene columna 'municipio' — eliminando y reconstruyendo…")
            df = df.drop("municipio")

        # LEFT JOIN con tabla de referencia de municipios
        df_nuevo = df.join(df_mpio, on="DIRECTORIO", how="left")

        filas_despues = df_nuevo.count()
        nulos_municipio = df_nuevo.filter(F.col("municipio").isNull()).count()

        print(f"  Filas antes:   {filas_antes:,}")
        print(f"  Filas después: {filas_despues:,}")
        print(f"  Municipio NULL: {nulos_municipio:,}")

        if filas_antes != filas_despues:
            print(f"  ⛔ ERROR: el JOIN duplicó o eliminó filas. Verificar DIRECTORIO.")
            resultados.append((modulo, "ERROR", filas_antes, filas_despues))
            continue

        # Guardar
        (
            df_nuevo.write
            .format("delta")
            .mode("overwrite")
            .option("overwriteSchema", "true")
            .saveAsTable(tabla)
        )
        print(f"  ✓ {modulo} guardada con columna municipio")
        resultados.append((modulo, "OK", filas_antes, filas_despues))

    except Exception as e:
        print(f"  ✗ Error en {modulo}: {e}")
        resultados.append((modulo, f"ERROR: {e}", 0, 0))

# COMMAND ----------

# MAGIC %md
# MAGIC ## Resumen del proceso

# COMMAND ----------

print("\n" + "="*60)
print("  RESUMEN")
print("="*60)
print(f"{'Módulo':<25} {'Estado':<10} {'Filas antes':>12} {'Filas después':>14}")
print("-"*65)
for modulo, estado, antes, despues in resultados:
    nombre = modulo.replace("ecv_", "")
    print(f"  {nombre:<23} {estado:<10} {antes:>12,} {despues:>14,}")

errores = [r for r in resultados if r[1] != "OK"]
if errores:
    print(f"\n⛔ {len(errores)} módulo(s) con error — revisar antes de continuar.")
else:
    print(f"\n✓ Todos los módulos actualizados correctamente.")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Verificación final — municipio en los 3 departamentos

# COMMAND ----------

# MAGIC %sql
# MAGIC -- Confirmar cobertura de municipio en todos los módulos Silver ECV
# MAGIC SELECT 'craccompohog'  AS modulo, departamento, COUNT(DISTINCT municipio) AS municipios, COUNT(*) AS filas
# MAGIC FROM workspace.silver.ecv_craccompohog GROUP BY departamento
# MAGIC UNION ALL
# MAGIC SELECT 'condvidhog',   departamento, COUNT(DISTINCT municipio), COUNT(*)
# MAGIC FROM workspace.silver.ecv_condvidhog GROUP BY departamento
# MAGIC UNION ALL
# MAGIC SELECT 'servhog',      departamento, COUNT(DISTINCT municipio), COUNT(*)
# MAGIC FROM workspace.silver.ecv_servhog GROUP BY departamento
# MAGIC UNION ALL
# MAGIC SELECT 'teccom',       departamento, COUNT(DISTINCT municipio), COUNT(*)
# MAGIC FROM workspace.silver.ecv_teccom GROUP BY departamento
# MAGIC UNION ALL
# MAGIC SELECT 'fuertra',      departamento, COUNT(DISTINCT municipio), COUNT(*)
# MAGIC FROM workspace.silver.ecv_fuertra GROUP BY departamento
# MAGIC UNION ALL
# MAGIC SELECT 'salud',        departamento, COUNT(DISTINCT municipio), COUNT(*)
# MAGIC FROM workspace.silver.ecv_salud GROUP BY departamento
# MAGIC UNION ALL
# MAGIC SELECT 'educacion',    departamento, COUNT(DISTINCT municipio), COUNT(*)
# MAGIC FROM workspace.silver.ecv_educacion GROUP BY departamento
# MAGIC UNION ALL
# MAGIC SELECT 'atennin5',     departamento, COUNT(DISTINCT municipio), COUNT(*)
# MAGIC FROM workspace.silver.ecv_atennin5 GROUP BY departamento
# MAGIC UNION ALL
# MAGIC SELECT 'trainf',       departamento, COUNT(DISTINCT municipio), COUNT(*)
# MAGIC FROM workspace.silver.ecv_trainf GROUP BY departamento
# MAGIC UNION ALL
# MAGIC SELECT 'condvidhogpro',departamento, COUNT(DISTINCT municipio), COUNT(*)
# MAGIC FROM workspace.silver.ecv_condvidhogpro GROUP BY departamento
# MAGIC ORDER BY modulo, departamento

# COMMAND ----------

# MAGIC %md
# MAGIC ## Verificar columnas de información_schema

# COMMAND ----------

# MAGIC %sql
# MAGIC -- Confirmar que la columna municipio existe en los 10 módulos
# MAGIC SELECT table_name, column_name
# MAGIC FROM workspace.information_schema.columns
# MAGIC WHERE table_schema = 'silver'
# MAGIC   AND table_name IN (
# MAGIC     'ecv_craccompohog', 'ecv_condvidhog', 'ecv_servhog', 'ecv_teccom',
# MAGIC     'ecv_fuertra', 'ecv_salud', 'ecv_educacion',
# MAGIC     'ecv_atennin5', 'ecv_trainf', 'ecv_condvidhogpro'
# MAGIC   )
# MAGIC   AND column_name = 'municipio'
# MAGIC ORDER BY table_name
