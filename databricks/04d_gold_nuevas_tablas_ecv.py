# Databricks notebook source
# MAGIC %md
# MAGIC # 04d · Gold · Nuevas tablas ECV (vivienda, servicios, salud, TIC)
# MAGIC
# MAGIC Crea las 4 tablas Gold ECV faltantes, todas con columna `municipio`
# MAGIC via JOIN con `silver.ecv_datosviv` (cod_municipio).
# MAGIC
# MAGIC | Tabla | Fuente Silver | Temática |
# MAGIC |---|---|---|
# MAGIC | gold.vivienda_ecv | ecv_datosviv + craccompohog | Tipo de vivienda y clase territorial |
# MAGIC | gold.servicios_hogar_ecv | ecv_servhog + craccompohog + datosviv | Cuartos, ingresos, preparación alimentos |
# MAGIC | gold.salud_ecv | ecv_salud + craccompohog + datosviv | Afiliación salud y cuidado (nivel jefe) |
# MAGIC | gold.tic_ecv | ecv_teccom + craccompohog + datosviv | Acceso a internet y TIC |

# COMMAND ----------

# MAGIC %md
# MAGIC ## TABLA 1 · gold.vivienda_ecv
# MAGIC
# MAGIC ecv_datosviv ya tiene cod_municipio — no necesita JOIN adicional para municipio.
# MAGIC JOIN con craccompohog para obtener sexo del jefe.

# COMMAND ----------

# MAGIC %sql
# MAGIC CREATE OR REPLACE TABLE workspace.gold.vivienda_ecv AS
# MAGIC SELECT
# MAGIC     d.departamento,
# MAGIC     d.cod_municipio          AS municipio,
# MAGIC     d.clase,
# MAGIC     d.tipo_vivienda,
# MAGIC     j.sexo_nacer             AS sexo_jefe,
# MAGIC     COUNT(*)                 AS total_hogares
# MAGIC FROM workspace.silver.ecv_datosviv d
# MAGIC JOIN workspace.silver.ecv_craccompohog j ON d.DIRECTORIO = j.DIRECTORIO
# MAGIC GROUP BY d.departamento, d.cod_municipio, d.clase, d.tipo_vivienda, j.sexo_nacer
# MAGIC ORDER BY departamento, municipio, clase, tipo_vivienda

# COMMAND ----------

# MAGIC %md
# MAGIC ### Verificación vivienda_ecv

# COMMAND ----------

# MAGIC %sql
# MAGIC SELECT departamento, municipio, clase, tipo_vivienda, SUM(total_hogares) AS hogares
# MAGIC FROM workspace.gold.vivienda_ecv
# MAGIC GROUP BY departamento, municipio, clase, tipo_vivienda
# MAGIC ORDER BY departamento, hogares DESC
# MAGIC LIMIT 20

# COMMAND ----------

# MAGIC %sql
# MAGIC -- Validar: total Gold debe = filas Silver craccompohog
# MAGIC SELECT 'gold'   AS origen, departamento, SUM(total_hogares) AS total
# MAGIC FROM workspace.gold.vivienda_ecv GROUP BY departamento
# MAGIC UNION ALL
# MAGIC SELECT 'silver', departamento, COUNT(*)
# MAGIC FROM workspace.silver.ecv_craccompohog GROUP BY departamento
# MAGIC ORDER BY departamento, origen

# COMMAND ----------

# MAGIC %md
# MAGIC ## TABLA 2 · gold.servicios_hogar_ecv
# MAGIC
# MAGIC ecv_servhog es nivel hogar (1 fila por hogar).
# MAGIC Las columnas de ingreso y cuartos son STRING en Silver — se castean a DOUBLE para promedios.

# COMMAND ----------

# MAGIC %sql
# MAGIC CREATE OR REPLACE TABLE workspace.gold.servicios_hogar_ecv AS
# MAGIC SELECT
# MAGIC     s.departamento,
# MAGIC     d.cod_municipio                                         AS municipio,
# MAGIC     j.sexo_nacer                                           AS sexo_jefe,
# MAGIC     s.lugar_preparacion_alimentos,
# MAGIC     COUNT(*)                                               AS total_hogares,
# MAGIC     ROUND(AVG(CAST(s.num_cuartos_hogar AS DOUBLE)), 1)    AS promedio_cuartos,
# MAGIC     ROUND(AVG(CAST(s.cant_personas_hogar AS DOUBLE)), 1)  AS promedio_personas_hogar,
# MAGIC     ROUND(AVG(CAST(s.ingreso_percapita AS DOUBLE)), 0)    AS ingreso_percapita_promedio
# MAGIC FROM workspace.silver.ecv_servhog s
# MAGIC JOIN workspace.silver.ecv_craccompohog j ON s.DIRECTORIO = j.DIRECTORIO
# MAGIC JOIN workspace.silver.ecv_datosviv d     ON s.DIRECTORIO = d.DIRECTORIO
# MAGIC GROUP BY s.departamento, d.cod_municipio, j.sexo_nacer, s.lugar_preparacion_alimentos
# MAGIC ORDER BY departamento, municipio, sexo_jefe

# COMMAND ----------

# MAGIC %md
# MAGIC ### Verificación servicios_hogar_ecv

# COMMAND ----------

# MAGIC %sql
# MAGIC SELECT departamento, municipio, sexo_jefe,
# MAGIC        SUM(total_hogares)           AS hogares,
# MAGIC        AVG(promedio_cuartos)        AS cuartos_prom,
# MAGIC        AVG(ingreso_percapita_promedio) AS ingreso_prom
# MAGIC FROM workspace.gold.servicios_hogar_ecv
# MAGIC GROUP BY departamento, municipio, sexo_jefe
# MAGIC ORDER BY departamento, hogares DESC
# MAGIC LIMIT 20

# COMMAND ----------

# MAGIC %sql
# MAGIC -- Validar totales
# MAGIC SELECT 'gold'   AS origen, departamento, SUM(total_hogares) AS total
# MAGIC FROM workspace.gold.servicios_hogar_ecv GROUP BY departamento
# MAGIC UNION ALL
# MAGIC SELECT 'silver', departamento, COUNT(*)
# MAGIC FROM workspace.silver.ecv_craccompohog GROUP BY departamento
# MAGIC ORDER BY departamento, origen

# COMMAND ----------

# MAGIC %md
# MAGIC ## TABLA 3 · gold.salud_ecv
# MAGIC
# MAGIC ecv_salud es nivel persona (num_orden_persona).
# MAGIC Filtramos num_orden_persona = '1' para obtener solo el registro del jefe de hogar.
# MAGIC Si la celda falla con cero filas, verificar con:
# MAGIC SELECT DISTINCT num_orden_persona FROM workspace.silver.ecv_salud LIMIT 10

# COMMAND ----------

# MAGIC %sql
# MAGIC CREATE OR REPLACE TABLE workspace.gold.salud_ecv AS
# MAGIC SELECT
# MAGIC     s.departamento,
# MAGIC     d.cod_municipio              AS municipio,
# MAGIC     j.sexo_nacer                 AS sexo_jefe,
# MAGIC     s.afiliado_sgsss,
# MAGIC     s.regimen_salud,
# MAGIC     s.quien_paga_afiliacion,
# MAGIC     s.recibe_ayuda_cuidado_otras_personas,
# MAGIC     s.cuidador_principal,
# MAGIC     s.cuidador_sexo,
# MAGIC     s.cuidador_dejo_trabajar,
# MAGIC     COUNT(*)                     AS total_jefes
# MAGIC FROM workspace.silver.ecv_salud s
# MAGIC JOIN workspace.silver.ecv_craccompohog j ON s.DIRECTORIO = j.DIRECTORIO
# MAGIC JOIN workspace.silver.ecv_datosviv d     ON s.DIRECTORIO = d.DIRECTORIO
# MAGIC WHERE s.num_orden_persona = '1'
# MAGIC GROUP BY
# MAGIC     s.departamento, d.cod_municipio, j.sexo_nacer,
# MAGIC     s.afiliado_sgsss, s.regimen_salud, s.quien_paga_afiliacion,
# MAGIC     s.recibe_ayuda_cuidado_otras_personas, s.cuidador_principal,
# MAGIC     s.cuidador_sexo, s.cuidador_dejo_trabajar
# MAGIC ORDER BY departamento, municipio, sexo_jefe

# COMMAND ----------

# MAGIC %md
# MAGIC ### Verificación salud_ecv

# COMMAND ----------

# MAGIC %sql
# MAGIC SELECT departamento, afiliado_sgsss, regimen_salud, SUM(total_jefes) AS total
# MAGIC FROM workspace.gold.salud_ecv
# MAGIC GROUP BY departamento, afiliado_sgsss, regimen_salud
# MAGIC ORDER BY departamento, total DESC

# COMMAND ----------

# MAGIC %sql
# MAGIC -- Validar totales vs craccompohog
# MAGIC SELECT 'gold'   AS origen, departamento, SUM(total_jefes) AS total
# MAGIC FROM workspace.gold.salud_ecv GROUP BY departamento
# MAGIC UNION ALL
# MAGIC SELECT 'silver', departamento, COUNT(*)
# MAGIC FROM workspace.silver.ecv_craccompohog GROUP BY departamento
# MAGIC ORDER BY departamento, origen

# COMMAND ----------

# MAGIC %md
# MAGIC ## TABLA 4 · gold.tic_ecv
# MAGIC
# MAGIC ecv_teccom es nivel hogar (sin num_orden_persona).

# COMMAND ----------

# MAGIC %sql
# MAGIC CREATE OR REPLACE TABLE workspace.gold.tic_ecv AS
# MAGIC SELECT
# MAGIC     t.departamento,
# MAGIC     d.cod_municipio                       AS municipio,
# MAGIC     j.sexo_nacer                          AS sexo_jefe,
# MAGIC     t.internet_en_hogar,
# MAGIC     t.sitios_acceso_internet,
# MAGIC     t.internet_en_trabajo,
# MAGIC     t.internet_en_institucion_educativa,
# MAGIC     t.internet_acceso_publico_gratis,
# MAGIC     t.internet_cafe_internet,
# MAGIC     COUNT(*)                              AS total_hogares
# MAGIC FROM workspace.silver.ecv_teccom t
# MAGIC JOIN workspace.silver.ecv_craccompohog j ON t.DIRECTORIO = j.DIRECTORIO
# MAGIC JOIN workspace.silver.ecv_datosviv d     ON t.DIRECTORIO = d.DIRECTORIO
# MAGIC GROUP BY
# MAGIC     t.departamento, d.cod_municipio, j.sexo_nacer,
# MAGIC     t.internet_en_hogar, t.sitios_acceso_internet,
# MAGIC     t.internet_en_trabajo, t.internet_en_institucion_educativa,
# MAGIC     t.internet_acceso_publico_gratis, t.internet_cafe_internet
# MAGIC ORDER BY departamento, municipio, sexo_jefe

# COMMAND ----------

# MAGIC %md
# MAGIC ### Verificación tic_ecv

# COMMAND ----------

# MAGIC %sql
# MAGIC SELECT departamento, municipio, internet_en_hogar, SUM(total_hogares) AS hogares
# MAGIC FROM workspace.gold.tic_ecv
# MAGIC GROUP BY departamento, municipio, internet_en_hogar
# MAGIC ORDER BY departamento, hogares DESC
# MAGIC LIMIT 20

# COMMAND ----------

# MAGIC %sql
# MAGIC -- Validar totales
# MAGIC SELECT 'gold'   AS origen, departamento, SUM(total_hogares) AS total
# MAGIC FROM workspace.gold.tic_ecv GROUP BY departamento
# MAGIC UNION ALL
# MAGIC SELECT 'silver', departamento, COUNT(*)
# MAGIC FROM workspace.silver.ecv_craccompohog GROUP BY departamento
# MAGIC ORDER BY departamento, origen

# COMMAND ----------

# MAGIC %md
# MAGIC ## Verificación final — 8 tablas Gold ECV con columna municipio

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
