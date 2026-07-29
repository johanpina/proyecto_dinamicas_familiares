# Databricks notebook source
# MAGIC %md
# MAGIC # 04c · Gold Fix · ECV con municipio (tablas originales)
# MAGIC
# MAGIC Reconstruye las 4 tablas Gold ECV que ya existían, añadiendo columna `municipio`.
# MAGIC Correcciones aplicadas vs versión anterior:
# MAGIC - `edad` → `edad_anos` (nombre real de la columna en craccompohog)
# MAGIC
# MAGIC | Tabla | Cambio |
# MAGIC |---|---|
# MAGIC | gold.jefes_hogar_ecv | + municipio (edad_anos corregido) |
# MAGIC | gold.condiciones_vida_ecv | + municipio |
# MAGIC | gold.educacion_ecv | + municipio |
# MAGIC | gold.fuerza_trabajo_ecv | + municipio |

# COMMAND ----------

# MAGIC %md
# MAGIC ## TABLA 1 · gold.jefes_hogar_ecv

# COMMAND ----------

# MAGIC %sql
# MAGIC CREATE OR REPLACE TABLE workspace.gold.jefes_hogar_ecv AS
# MAGIC SELECT
# MAGIC     c.departamento,
# MAGIC     d.cod_municipio                                AS municipio,
# MAGIC     c.sexo_nacer                                   AS sexo_jefe,
# MAGIC     c.estado_civil,
# MAGIC     COUNT(*)                                       AS total_jefes,
# MAGIC     ROUND(AVG(CAST(c.edad_anos AS DOUBLE)), 1)     AS edad_promedio
# MAGIC FROM workspace.silver.ecv_craccompohog c
# MAGIC JOIN workspace.silver.ecv_datosviv d ON c.DIRECTORIO = d.DIRECTORIO
# MAGIC GROUP BY c.departamento, d.cod_municipio, c.sexo_nacer, c.estado_civil
# MAGIC ORDER BY departamento, municipio, sexo_jefe

# COMMAND ----------

# MAGIC %md
# MAGIC ### Verificación jefes_hogar_ecv

# COMMAND ----------

# MAGIC %sql
# MAGIC SELECT departamento, municipio, sexo_jefe, SUM(total_jefes) AS total
# MAGIC FROM workspace.gold.jefes_hogar_ecv
# MAGIC GROUP BY departamento, municipio, sexo_jefe
# MAGIC ORDER BY departamento, total DESC
# MAGIC LIMIT 20

# COMMAND ----------

# MAGIC %sql
# MAGIC SELECT 'gold'   AS origen, departamento, SUM(total_jefes) AS total
# MAGIC FROM workspace.gold.jefes_hogar_ecv GROUP BY departamento
# MAGIC UNION ALL
# MAGIC SELECT 'silver', departamento, COUNT(*)
# MAGIC FROM workspace.silver.ecv_craccompohog GROUP BY departamento
# MAGIC ORDER BY departamento, origen

# COMMAND ----------

# MAGIC %md
# MAGIC ## TABLA 2 · gold.condiciones_vida_ecv

# COMMAND ----------

# MAGIC %sql
# MAGIC CREATE OR REPLACE TABLE workspace.gold.condiciones_vida_ecv AS
# MAGIC WITH base AS (
# MAGIC     SELECT
# MAGIC         c.departamento,
# MAGIC         d.cod_municipio                                                     AS municipio,
# MAGIC         j.sexo_nacer                                                        AS sexo_jefe,
# MAGIC         c.se_considera_pobre,
# MAGIC         c.situacion_ingresos_hogar,
# MAGIC         CASE
# MAGIC             WHEN c.subsidio_colombia_mayor         = 'Sí'
# MAGIC               OR c.subsidio_renta_ciudadana_hambre = 'Sí'
# MAGIC               OR c.subsidio_renta_ciudadana_iva    = 'Sí'
# MAGIC               OR c.subsidio_otro                   = 'Sí'
# MAGIC             THEN 'Sí' ELSE 'No'
# MAGIC         END AS recibe_subsidio,
# MAGIC         CASE
# MAGIC             WHEN c.alim_preocupacion_no_suficiente = 'Sí'
# MAGIC               OR c.alim_no_pudo_comer_saludable    = 'Sí'
# MAGIC               OR c.alim_poca_variedad              = 'Sí'
# MAGIC               OR c.alim_salto_comida               = 'Sí'
# MAGIC               OR c.alim_comio_menos                = 'Sí'
# MAGIC               OR c.alim_hogar_sin_alimentos        = 'Sí'
# MAGIC               OR c.alim_tuvo_hambre_sin_comer      = 'Sí'
# MAGIC               OR c.alim_no_comio_dia_entero        = 'Sí'
# MAGIC             THEN 'Sí' ELSE 'No'
# MAGIC         END AS inseguridad_alimentaria,
# MAGIC         c.percepcion_economia_hogar_vs_hace_12m AS percepcion_economia
# MAGIC     FROM workspace.silver.ecv_condvidhog c
# MAGIC     JOIN workspace.silver.ecv_craccompohog j ON c.DIRECTORIO = j.DIRECTORIO
# MAGIC     JOIN workspace.silver.ecv_datosviv d     ON c.DIRECTORIO = d.DIRECTORIO
# MAGIC )
# MAGIC SELECT
# MAGIC     departamento, municipio, sexo_jefe, se_considera_pobre,
# MAGIC     situacion_ingresos_hogar, recibe_subsidio, inseguridad_alimentaria,
# MAGIC     percepcion_economia,
# MAGIC     COUNT(*) AS total_hogares
# MAGIC FROM base
# MAGIC GROUP BY
# MAGIC     departamento, municipio, sexo_jefe, se_considera_pobre,
# MAGIC     situacion_ingresos_hogar, recibe_subsidio, inseguridad_alimentaria,
# MAGIC     percepcion_economia
# MAGIC ORDER BY departamento, municipio, sexo_jefe

# COMMAND ----------

# MAGIC %md
# MAGIC ### Verificación condiciones_vida_ecv

# COMMAND ----------

# MAGIC %sql
# MAGIC SELECT 'gold'   AS origen, departamento, SUM(total_hogares) AS total
# MAGIC FROM workspace.gold.condiciones_vida_ecv GROUP BY departamento
# MAGIC UNION ALL
# MAGIC SELECT 'silver', departamento, COUNT(*)
# MAGIC FROM workspace.silver.ecv_craccompohog GROUP BY departamento
# MAGIC ORDER BY departamento, origen

# COMMAND ----------

# MAGIC %md
# MAGIC ## TABLA 3 · gold.educacion_ecv

# COMMAND ----------

# MAGIC %sql
# MAGIC CREATE OR REPLACE TABLE workspace.gold.educacion_ecv AS
# MAGIC SELECT
# MAGIC     e.departamento,
# MAGIC     d.cod_municipio        AS municipio,
# MAGIC     j.sexo_nacer           AS sexo_jefe,
# MAGIC     e.nivel_educativo_alcanzado,
# MAGIC     COUNT(*)               AS total_jefes
# MAGIC FROM workspace.silver.ecv_educacion e
# MAGIC JOIN workspace.silver.ecv_craccompohog j
# MAGIC   ON e.DIRECTORIO = j.DIRECTORIO
# MAGIC  AND e.ORDEN      = j.ORDEN
# MAGIC JOIN workspace.silver.ecv_datosviv d
# MAGIC   ON e.DIRECTORIO = d.DIRECTORIO
# MAGIC GROUP BY e.departamento, d.cod_municipio, j.sexo_nacer, e.nivel_educativo_alcanzado
# MAGIC ORDER BY departamento, municipio, sexo_jefe, nivel_educativo_alcanzado

# COMMAND ----------

# MAGIC %md
# MAGIC ### Verificación educacion_ecv

# COMMAND ----------

# MAGIC %sql
# MAGIC SELECT 'educacion_ecv'   AS tabla, departamento, SUM(total_jefes) AS total
# MAGIC FROM workspace.gold.educacion_ecv GROUP BY departamento
# MAGIC UNION ALL
# MAGIC SELECT 'jefes_hogar_ecv', departamento, SUM(total_jefes)
# MAGIC FROM workspace.gold.jefes_hogar_ecv GROUP BY departamento
# MAGIC ORDER BY departamento, tabla

# COMMAND ----------

# MAGIC %md
# MAGIC ## TABLA 4 · gold.fuerza_trabajo_ecv

# COMMAND ----------

# MAGIC %sql
# MAGIC CREATE OR REPLACE TABLE workspace.gold.fuerza_trabajo_ecv AS
# MAGIC SELECT
# MAGIC     f.departamento,
# MAGIC     d.cod_municipio          AS municipio,
# MAGIC     f.actividad_semana_pasada,
# MAGIC     f.posicion_ocupacional,
# MAGIC     COUNT(*)                 AS total_personas
# MAGIC FROM workspace.silver.ecv_fuertra f
# MAGIC JOIN workspace.silver.ecv_datosviv d ON f.DIRECTORIO = d.DIRECTORIO
# MAGIC GROUP BY f.departamento, d.cod_municipio, f.actividad_semana_pasada, f.posicion_ocupacional
# MAGIC ORDER BY departamento, municipio, actividad_semana_pasada

# COMMAND ----------

# MAGIC %md
# MAGIC ### Verificación fuerza_trabajo_ecv

# COMMAND ----------

# MAGIC %sql
# MAGIC SELECT departamento, municipio, actividad_semana_pasada, SUM(total_personas) AS total
# MAGIC FROM workspace.gold.fuerza_trabajo_ecv
# MAGIC GROUP BY departamento, municipio, actividad_semana_pasada
# MAGIC ORDER BY departamento, total DESC
# MAGIC LIMIT 20

# COMMAND ----------

# MAGIC %md
# MAGIC ## Verificación final — 8 tablas Gold ECV con municipio

# COMMAND ----------

# MAGIC %sql
# MAGIC SELECT table_name, column_name
# MAGIC FROM workspace.information_schema.columns
# MAGIC WHERE table_schema = 'gold'
# MAGIC   AND table_name IN (
# MAGIC     'jefes_hogar_ecv', 'condiciones_vida_ecv', 'educacion_ecv',
# MAGIC     'fuerza_trabajo_ecv', 'vivienda_ecv', 'servicios_hogar_ecv',
# MAGIC     'salud_ecv', 'tic_ecv'
# MAGIC   )
# MAGIC   AND column_name = 'municipio'
# MAGIC ORDER BY table_name
