# Familia, diversidad y territorio — aplicación de entrevista

Aplicación web para aplicar la entrevista semiestructurada del proyecto
**«Familia, diversidad y territorio: dinámicas familiares en el Eje Cafetero»**
(Universidad de Caldas — Colectivo Estudios de Familia · GESEXREC · GITIR).

**Responder la entrevista es abierto**: se comparte el enlace y cualquier persona la
diligencia, sin usuario ni contraseña. El inicio de sesión existe solo para que el
equipo vea, revise y exporte los resultados.

Está pensada para el **celular, en los municipios**, incluso donde no hay señal: la
entrevista se guarda en el teléfono y se envía sola al servidor apenas vuelve la conexión.

## Qué incluye

| Ruta | Para qué sirve | Cuenta |
|---|---|---|
| `/` | La entrevista: consentimiento, ficha, dibujo de la familia y las preguntas | **abierta** |
| `/consentimiento` | Documento completo del consentimiento informado | **abierta** |
| `/panel` | Revisar lo recogido, marcar entrevistas revisadas y exportar | requiere cuenta |
| `/api/docs` | Documentación de la API | — |

## Cómo se usa en campo

1. Se comparte el enlace de `/` (o se abre en el celular de quien acompaña).
2. Lo primero que aparece es el **consentimiento informado** resumido, con el enlace
   al documento completo.
   - Si acepta → se despliega el formulario.
   - Si no acepta → aparece «Gracias por participar» y no se guarda ningún dato suyo
     (solo un conteo anónimo de no aceptación).
3. Se diligencia la ficha, se hace el **dibujo de la familia** y se responden las preguntas.
4. El indicador de la barra inferior dice en todo momento si ya se envió al servidor
   o si está pendiente por falta de señal.

Cada entrevista tiene un identificador aleatorio que crea el propio teléfono: solo
puede seguir editándola quien la está respondiendo, y una vez el equipo la marca como
**revisada** deja de aceptar cambios. Las rutas abiertas tienen un tope de envíos por
IP por hora (`LIMITE_POR_IP`, 120 por defecto) para evitar abusos.

### Código de acceso en el enlace

Si define `CODIGO_ACCESO`, el formulario solo responde a quien llegue con el enlace
completo:

```
https://…/?c=EL-CODIGO
```

El código queda guardado en el teléfono, así que se pide una sola vez y la app sigue
funcionando sin señal. A quien llegue sin él se le muestra una pantalla para escribirlo.
No es una contraseña —va en la URL—: sirve para que no entre gente por casualidad ni
buscadores. Si se deja la variable vacía, el formulario queda abierto para cualquiera.

En Android/iOS se puede instalar como aplicación desde el navegador
(«Agregar a la pantalla de inicio»): es una PWA.

## Correr en el computador

```bash
cd webapp
uv venv .venv && uv pip install -r requirements.txt --python .venv/bin/python
USUARIO_INICIAL=coordinacion CLAVE_INICIAL=una-clave-larga \
  .venv/bin/python -m uvicorn app.main:app --reload --port 8000
```

Abra <http://127.0.0.1:8000>. La primera vez se crea la cuenta de coordinación con
los valores de `USUARIO_INICIAL` y `CLAVE_INICIAL`, y la base queda en
`datos/entrevistas.db` (SQLite).

Para que las docentes prueben desde el celular en la misma red, levante el servidor
con `--host 0.0.0.0` y entren a `http://IP-DEL-COMPUTADOR:8000`.

> El service worker (modo sin señal) y la instalación como app requieren HTTPS,
> salvo en `localhost`. En producción use un dominio con certificado.

## Desplegar con Docker

```bash
cp .env.example .env      # y complete SECRET_KEY, CLAVE_INICIAL y CLAVE_DB
docker compose up -d --build
```

Levanta la aplicación en el puerto 8000 con PostgreSQL. Ponga un proxy con HTTPS
(Caddy, Nginx o el que use la Universidad) por delante.

## Publicar en Vercel

El repositorio trae `vercel.json` y `api/index.py`, así que basta con importar la
carpeta `webapp/` en Vercel. **Dos condiciones**, porque Vercel no tiene disco:

1. **Base de datos externa.** Cree una PostgreSQL (Vercel Postgres, Neon o Supabase)
   y ponga la cadena en la variable `DATABASE_URL`, con el driver `psycopg`:

   ```
   DATABASE_URL=postgresql+psycopg://usuario:clave@host/basedatos?sslmode=require
   ```

2. **Variables de entorno del proyecto**, en *Settings → Environment Variables*:

   | Variable | Valor |
   |---|---|
   | `DATABASE_URL` | la cadena de PostgreSQL |
   | `SECRET_KEY` | `python -c "import secrets;print(secrets.token_urlsafe(48))"` |
   | `CLAVE_INICIAL` | contraseña de la cuenta de coordinación |
   | `CODIGO_ACCESO` | el código del enlace (opcional) |
   | `USUARIO_INICIAL` | `coordinacion` (opcional) |

   Sin `SECRET_KEY` fija, las sesiones del panel se caen en cada arranque.

3. **Quitar la protección de Vercel.** Por defecto Vercel exige iniciar sesión en
   Vercel para abrir el sitio, lo que impide que las personas respondan. En
   *Settings → Deployment Protection → Vercel Authentication* hay que ponerlo en
   **Disabled** (o conectar un dominio propio, que queda exento).

Mientras falte `DATABASE_URL`, la app muestra una franja roja de «modo de prueba»
avisando que lo que se responda se pierde.

## Cuentas para ver los resultados

```bash
.venv/bin/python usuarios.py listar
.venv/bin/python usuarios.py crear zoraida "Zoraida Cárdenas" --rol coordinador
.venv/bin/python usuarios.py crear docente1 "Nombre de la docente"
.venv/bin/python usuarios.py clave docente1
.venv/bin/python usuarios.py desactivar docente1
```

Toda cuenta activa ve el panel completo; solo **coordinador** puede borrar entrevistas.

## Exportación para el análisis

Desde el panel, o directamente por API con la sesión iniciada:

- `GET /api/exportar/entrevistas.json` — todo, incluido el dibujo
- `GET /api/exportar/respuestas.csv` — una fila por pregunta (para NVivo, Atlas.ti, pandas)
- `GET /api/exportar/personas.csv` — una fila por persona del dibujo

Los CSV usan `;` como separador y llevan BOM, así que Excel en español los abre bien.

## Estructura

```
webapp/
├── app/
│   ├── main.py        API y rutas web
│   ├── models.py      tablas: usuarios, entrevistas, rechazos
│   ├── db.py          conexión (SQLite por defecto, PostgreSQL con DATABASE_URL)
│   └── seguridad.py   contraseñas y tokens de sesión (solo librería estándar)
├── static/
│   ├── index.html     la entrevista
│   ├── panel.html     panel de revisión
│   ├── consentimiento.html
│   ├── js/app.js      guía de preguntas, pasos, guardado y sincronización
│   ├── js/dibujo.js   el dibujo de la familia
│   └── js/panel.js
├── usuarios.py        administración de cuentas
└── docker-compose.yml
```

## Sobre los datos

La guía de entrevista se define en un solo lugar, `static/js/app.js` (constante
`BLOQUES`). Si cambia una pregunta, las entrevistas ya guardadas **no se pierden**:
la respuesta se conserva por su clave (`r3a`, `r6f`, …) y el texto de la pregunta
viaja junto con cada respuesta en el JSON, de modo que siempre se sabe qué se
preguntó exactamente en cada entrevista.

Los datos personales que se recogen son los que autoriza el consentimiento
informado. La base guarda nombres de pila y parentescos del dibujo: al transcribir
y publicar deben sustituirse por códigos, tal como lo establece el documento.
