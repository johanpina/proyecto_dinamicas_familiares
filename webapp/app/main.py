"""API y servidor de la aplicación.

    Familia, diversidad y territorio: dinámicas familiares en el Eje Cafetero
    Universidad de Caldas — Colectivo Estudios de Familia · GESEXREC · GITIR

Rutas web
    /                app de la entrevista — ABIERTA, cualquiera puede responder
    /panel           panel para revisar y exportar lo recogido — requiere cuenta
    /consentimiento  documento completo del consentimiento informado

Responder la entrevista no necesita cuenta: se comparte el enlace y ya. El inicio
de sesión existe solo para ver, revisar y exportar los resultados.

La app funciona sin señal: guarda en el teléfono y sincroniza cuando vuelve la
conexión, por eso los identificadores de entrevista los crea el cliente.
"""
from __future__ import annotations

import csv
import hmac
import io
import os
import time
from datetime import datetime, timezone
from pathlib import Path

from fastapi import BackgroundTasks, Depends, FastAPI, Header, HTTPException, Query, Request
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .db import Base, engine, obtener_sesion
from . import clasificador
from .dimensiones import DIMENSIONES, POR_CLAVE, activa, claves_categoria
from .models import Clasificacion, Entrevista, Rechazo, Usuario
from .municipios import normalizar as normalizar_municipio
from .seguridad import cifrar_clave, crear_token, leer_token, verificar_clave

ESTATICOS = Path(__file__).resolve().parent.parent / "static"

app = FastAPI(title="Dinámicas familiares — Eje Cafetero", docs_url="/api/docs", redoc_url=None)


@app.on_event("startup")
def preparar() -> None:
    Base.metadata.create_all(engine)
    _crear_usuario_inicial()


def _crear_usuario_inicial() -> None:
    """Crea la cuenta coordinadora la primera vez, para poder entrar al panel."""
    from .db import Sesion

    with Sesion() as s:
        if s.scalar(select(func.count()).select_from(Usuario)):
            return
        usuario = os.getenv("USUARIO_INICIAL", "coordinacion")
        clave = os.getenv("CLAVE_INICIAL", "cambiar-esta-clave")
        s.add(Usuario(
            usuario=usuario, nombre="Coordinación de la investigación",
            clave_hash=cifrar_clave(clave), rol="coordinador",
        ))
        s.commit()
        print(f"[inicio] Usuario coordinador creado: {usuario} / {clave}  ← cámbielo cuanto antes")


# --------------------------------- sesión ---------------------------------

def usuario_actual(
    authorization: str | None = Header(default=None),
    s: Session = Depends(obtener_sesion),
) -> Usuario:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(401, "Inicie sesión para continuar")
    uid = leer_token(authorization.split(" ", 1)[1].strip())
    if uid is None:
        raise HTTPException(401, "La sesión venció, vuelva a entrar")
    u = s.get(Usuario, uid)
    if not u or not u.activo:
        raise HTTPException(401, "Usuario no disponible")
    return u


def solo_coordinador(u: Usuario = Depends(usuario_actual)) -> Usuario:
    if not u.es_coordinador:
        raise HTTPException(403, "Solo la coordinación puede hacer esto")
    return u


@app.post("/api/login")
def login(cuerpo: dict, s: Session = Depends(obtener_sesion)):
    usuario = (cuerpo.get("usuario") or "").strip().lower()
    clave = cuerpo.get("clave") or ""
    u = s.scalar(select(Usuario).where(func.lower(Usuario.usuario) == usuario))
    if not u or not u.activo or not verificar_clave(clave, u.clave_hash):
        raise HTTPException(401, "Usuario o contraseña incorrectos")
    return {"token": crear_token(u.id), "usuario": _perfil(u)}


def _perfil(u: Usuario) -> dict:
    return {"id": u.id, "usuario": u.usuario, "nombre": u.nombre, "rol": u.rol}


@app.get("/api/yo")
def yo(u: Usuario = Depends(usuario_actual)):
    return _perfil(u)


@app.post("/api/clave")
def cambiar_clave(cuerpo: dict, u: Usuario = Depends(usuario_actual), s: Session = Depends(obtener_sesion)):
    if not verificar_clave(cuerpo.get("actual") or "", u.clave_hash):
        raise HTTPException(400, "La contraseña actual no coincide")
    nueva = cuerpo.get("nueva") or ""
    if len(nueva) < 8:
        raise HTTPException(400, "La contraseña nueva debe tener al menos 8 caracteres")
    u.clave_hash = cifrar_clave(nueva)
    s.commit()
    return {"ok": True}


# ------------------------------- entrevistas -------------------------------

MASCOTAS = ("mascota", "perro", "gato")   # perro y gato: figuras de versiones anteriores


def _es_mascota(figura: dict) -> bool:
    return figura.get("tipo_integrante") == "mascota" or figura.get("figura") in MASCOTAS


def _especie(figura: dict) -> str:
    """Qué animal es. Las versiones anteriores lo decían solo con la figura."""
    if not _es_mascota(figura):
        return ""
    return figura.get("especie") or {"perro": "Perro", "gato": "Gato"}.get(figura.get("figura"), "")


def _contar(datos: dict) -> tuple[int, int]:
    """Las mascotas van en el dibujo pero no se cuentan como personas."""
    figuras = (datos.get("dibujo") or {}).get("personas") or []
    personas = sum(1 for f in figuras if not _es_mascota(f))
    respuestas = (datos.get("respuestas") or {})
    if isinstance(respuestas, list):
        respondidas = sum(1 for r in respuestas if str(r.get("respuesta", "")).strip())
    else:
        respondidas = sum(1 for v in respuestas.values() if str(v).strip())
    return personas, respondidas


# --- código de acceso de las rutas abiertas ---
# Si CODIGO_ACCESO está definido, para responder la entrevista hay que llegar con
# el enlace completo (…/?c=elcodigo). No es una contraseña: solo evita que entre
# gente por casualidad. Si se deja vacío, el formulario queda totalmente abierto.
CODIGO_ACCESO = os.getenv("CODIGO_ACCESO", "").strip()


def _verificar_codigo(peticion: Request) -> None:
    if not CODIGO_ACCESO:
        return
    dado = (peticion.headers.get("x-codigo-acceso") or "").strip()
    if not hmac.compare_digest(dado.casefold(), CODIGO_ACCESO.casefold()):
        raise HTTPException(403, "El enlace no es válido. Pida el enlace completo al equipo de investigación.")


@app.get("/api/config")
def config_publica():
    """Le dice a la app si pide código de acceso y si la base es temporal."""
    return {
        "requiere_codigo": bool(CODIGO_ACCESO),
        "almacenamiento_efimero": _almacenamiento_efimero(),
    }


@app.post("/api/verificar-codigo")
def verificar_codigo(peticion: Request):
    _verificar_codigo(peticion)
    return {"ok": True}


# --- control básico de abuso en las rutas abiertas ---
LIMITE_POR_IP = int(os.getenv("LIMITE_POR_IP", "120"))   # envíos por hora y por IP
_visitas: dict[str, list[float]] = {}


def _limitar(peticion: Request) -> None:
    ip = (peticion.headers.get("x-forwarded-for", "").split(",")[0].strip()
          or (peticion.client.host if peticion.client else "?"))
    ahora_s = time.time()
    marcas = [t for t in _visitas.get(ip, []) if ahora_s - t < 3600]
    if len(marcas) >= LIMITE_POR_IP:
        raise HTTPException(429, "Demasiados envíos desde este dispositivo. Intente más tarde.")
    marcas.append(ahora_s)
    _visitas[ip] = marcas
    if len(_visitas) > 5000:            # no dejar crecer la memoria sin control
        for k in [k for k, v in _visitas.items() if not v or ahora_s - v[-1] > 3600]:
            _visitas.pop(k, None)


@app.put("/api/entrevistas/{ident}")
def guardar_entrevista(
    ident: str,
    datos: dict,
    peticion: Request,
    tareas: BackgroundTasks,
    s: Session = Depends(obtener_sesion),
):
    """Crea o actualiza una entrevista. Ruta ABIERTA: no exige cuenta.

    El identificador lo genera el celular y es aleatorio, así que solo puede
    actualizar su propia entrevista quien la está respondiendo. Una vez revisada
    por el equipo, deja de aceptar cambios.

    Cuando la entrevista pasa a «enviada» se clasifica sola con IA, después de
    guardarla: el celular no espera a la IA y si esta falla no se pierde nada."""
    _verificar_codigo(peticion)
    _limitar(peticion)

    e = s.get(Entrevista, ident)
    estado_antes = e.estado if e else None
    if e is None:
        e = Entrevista(id=ident)
        s.add(e)
    elif e.estado == "revisada":
        raise HTTPException(409, "Esta entrevista ya fue revisada por el equipo de investigación")

    ficha = datos.get("datos") or {}
    consent = datos.get("consentimiento") or {}

    e.codigo = datos.get("codigo") or e.codigo or ident
    e.departamento = ficha.get("departamento", "")
    municipio = normalizar_municipio(ficha.get("municipio", ""))
    ficha["municipio"] = municipio           # queda normalizado también en el JSON
    datos["datos"] = ficha
    e.municipio = municipio
    e.lugar = ficha.get("lugar", "")
    e.zona = ficha.get("zona", "")
    e.fecha = ficha.get("fecha", "")
    e.identidad = ficha.get("identidad", "")
    e.edad = str(ficha.get("edad", ""))
    e.consentimiento = bool(consent.get("acepta"))
    e.grabacion = bool(consent.get("grabacion"))
    e.datos = datos
    e.personas, e.respondidas = _contar(datos)
    e.estado = "enviada" if datos.get("terminada") else (e.estado or "borrador")
    e.actualizada = datetime.now(timezone.utc)
    s.commit()
    # Solo al pasar a «enviada», no en cada guardado automático: una consulta por envío
    if e.estado == "enviada" and estado_antes != "enviada" and clasificador.disponible():
        tareas.add_task(clasificar_automaticamente, e.id)
    return {"ok": True, "id": e.id, "estado": e.estado, "actualizada": e.actualizada.isoformat()}


@app.get("/api/entrevistas")
def listar(
    municipio: str | None = Query(default=None),
    estado: str | None = Query(default=None),
    u: Usuario = Depends(usuario_actual),
    s: Session = Depends(obtener_sesion),
):
    q = select(Entrevista).order_by(Entrevista.actualizada.desc())
    if municipio:
        q = q.where(Entrevista.municipio.ilike(f"%{municipio}%"))
    if estado:
        q = q.where(Entrevista.estado == estado)
    return [e.resumen() for e in s.scalars(q).all()]


@app.get("/api/entrevistas/{ident}")
def ver(ident: str, u: Usuario = Depends(usuario_actual), s: Session = Depends(obtener_sesion)):
    e = s.get(Entrevista, ident)
    if not e:
        raise HTTPException(404, "No existe esa entrevista")
    return {**e.resumen(), "datos": e.datos}


@app.post("/api/entrevistas/{ident}/revision")
def revisar(
    ident: str,
    cuerpo: dict,
    u: Usuario = Depends(usuario_actual),
    s: Session = Depends(obtener_sesion),
):
    """Marca la entrevista como revisada (o la devuelve a 'enviada') con una nota."""
    e = s.get(Entrevista, ident)
    if not e:
        raise HTTPException(404, "No existe esa entrevista")
    estado = cuerpo.get("estado", "revisada")
    if estado not in ("borrador", "enviada", "revisada"):
        raise HTTPException(400, "Estado no válido")
    e.estado = estado
    e.nota_revision = cuerpo.get("nota", "")
    e.revisada_por = u.nombre if estado == "revisada" else ""
    e.revisada_en = datetime.now(timezone.utc) if estado == "revisada" else None
    s.commit()
    return {"ok": True, "estado": e.estado}


@app.post("/api/mantenimiento/normalizar-municipios")
def normalizar_municipios(u: Usuario = Depends(solo_coordinador), s: Session = Depends(obtener_sesion)):
    """Deja en una sola grafía los municipios ya guardados («Manizales », «manizales»
    → «Manizales»). Es idempotente: se puede correr las veces que haga falta."""
    cambios: list[dict] = []
    for e in s.scalars(select(Entrevista)).all():
        antes = e.municipio or ""
        despues = normalizar_municipio(antes)
        datos = e.datos or {}
        ficha = dict(datos.get("datos") or {})
        cambia_json = normalizar_municipio(ficha.get("municipio", "")) != ficha.get("municipio", "")
        if despues == antes and not cambia_json:
            continue
        e.municipio = despues
        if ficha:
            ficha["municipio"] = despues
            datos = {**datos, "datos": ficha}
            e.datos = datos
        cambios.append({"codigo": e.codigo, "antes": antes, "despues": despues})
    s.commit()
    return {"ok": True, "revisadas": s.scalar(select(func.count()).select_from(Entrevista)),
            "corregidas": len(cambios), "cambios": cambios}


@app.delete("/api/entrevistas/{ident}")
def borrar(ident: str, u: Usuario = Depends(solo_coordinador), s: Session = Depends(obtener_sesion)):
    e = s.get(Entrevista, ident)
    if e:
        for c in s.scalars(select(Clasificacion).where(Clasificacion.entrevista_id == ident)).all():
            s.delete(c)
        s.delete(e)
        s.commit()
    return {"ok": True}


@app.post("/api/rechazos")
def registrar_rechazo(cuerpo: dict, peticion: Request, s: Session = Depends(obtener_sesion)):
    """Deja constancia de que alguien no aceptó participar. Ruta abierta y anónima:
    no guarda ningún dato de la persona."""
    _verificar_codigo(peticion)
    _limitar(peticion)
    s.add(Rechazo(municipio=cuerpo.get("municipio", ""), zona=cuerpo.get("zona", "")))
    s.commit()
    return {"ok": True}


@app.get("/api/estadisticas")
def estadisticas(u: Usuario = Depends(usuario_actual), s: Session = Depends(obtener_sesion)):
    filas = s.scalars(select(Entrevista)).all()
    por_municipio: dict[str, int] = {}
    for e in filas:
        por_municipio[e.municipio or "(sin municipio)"] = por_municipio.get(e.municipio or "(sin municipio)", 0) + 1
    return {
        "total": len(filas),
        "borrador": sum(1 for e in filas if e.estado == "borrador"),
        "enviadas": sum(1 for e in filas if e.estado == "enviada"),
        "revisadas": sum(1 for e in filas if e.estado == "revisada"),
        "personas_dibujadas": sum(e.personas for e in filas),
        "mascotas": sum(
            1 for e in filas
            for f in ((e.datos or {}).get("dibujo") or {}).get("personas", [])
            if _es_mascota(f)
        ),
        "rechazos": s.scalar(select(func.count()).select_from(Rechazo)) or 0,
        "por_municipio": dict(sorted(por_municipio.items(), key=lambda x: -x[1])),
    }


# ------------------------------- clasificación -------------------------------
# Cada entrevista recibe UNA categoría por dimensión (ver dimensiones.py). La IA
# propone y el equipo confirma o corrige desde el panel; se guardan las dos.

def _dimension(clave: str) -> dict:
    d = POR_CLAVE.get(clave)
    if not d:
        raise HTTPException(404, "No existe esa dimensión")
    return d


def _elegible(d: dict, e: Entrevista) -> bool:
    """Se clasifica toda entrevista con consentimiento que respondió algo del módulo."""
    return bool(e.consentimiento) and clasificador.tiene_respuestas(d, e.datos or {})


def _clasificaciones(s: Session, dimension: str) -> dict[str, Clasificacion]:
    q = select(Clasificacion).where(Clasificacion.dimension == dimension)
    return {c.entrevista_id: c for c in s.scalars(q).all()}


def _iso(t: datetime | None) -> str | None:
    return t.isoformat() if t else None


def _clasificacion_json(d: dict, e: Entrevista, c: Clasificacion | None) -> dict | None:
    if c is None or not c.categoria:
        return None
    desactualizada = bool(c.categoria_ia) and (
        c.huella != clasificador.huella(d, e.datos or {}) or c.version_reglas != d.get("version"))
    return {
        "categoria": c.categoria,
        "categoria_ia": c.categoria_ia,
        "categoria_final": c.categoria_final,
        "justificacion": c.justificacion,
        "evidencias": c.evidencias or {},
        "confianza": c.confianza,
        "modelo": c.modelo,
        "version_reglas": c.version_reglas,
        "clasificada_en": _iso(c.clasificada_en),
        "revisada_por": c.revisada_por,
        "revisada_en": _iso(c.revisada_en),
        "motivo": c.motivo,
        "historial": c.historial or [],
        "desactualizada": desactualizada,
        # la propuesta vigente la hizo un modelo distinto del configurado hoy
        "otro_modelo": bool(c.categoria_ia) and not clasificador.es_modelo_actual(c.modelo),
    }


def _fila_clasificacion(d: dict, e: Entrevista, c: Clasificacion | None) -> dict:
    return {
        "id": e.id, "codigo": e.codigo, "municipio": e.municipio, "zona": e.zona,
        "estado": e.estado, "clasificacion": _clasificacion_json(d, e, c),
    }


def _anotar(c: Clasificacion, **cambio) -> None:
    # JSON en SQLAlchemy no detecta cambios dentro de la lista: se reemplaza entera
    c.historial = [*(c.historial or []), {"fecha": datetime.now(timezone.utc).isoformat(), **cambio}]


@app.get("/api/dimensiones")
def listar_dimensiones(u: Usuario = Depends(usuario_actual), s: Session = Depends(obtener_sesion)):
    """Las dimensiones de análisis con sus categorías y cuántas entrevistas hay en cada una."""
    entrevistas = s.scalars(select(Entrevista)).all()
    salida = []
    for d in DIMENSIONES:
        conteo = {"elegibles": 0, "clasificadas": 0, "revisadas": 0,
                  "por_categoria": {k: 0 for k in claves_categoria(d)}}
        if activa(d):
            clas = _clasificaciones(s, d["clave"])
            for e in entrevistas:
                c = clas.get(e.id)
                if not _elegible(d, e) and not (c and c.categoria):
                    continue
                conteo["elegibles"] += 1
                if c and c.categoria:
                    conteo["clasificadas"] += 1
                    conteo["por_categoria"][c.categoria] = conteo["por_categoria"].get(c.categoria, 0) + 1
                    if c.categoria_final:
                        conteo["revisadas"] += 1
        salida.append({
            "clave": d["clave"], "nombre": d["nombre"], "bloques": d["bloques"],
            "activa": activa(d), "version": d.get("version", ""), "fuente": d.get("fuente", ""),
            "categorias": [{k: c[k] for k in ("clave", "nombre", "definicion", "incluye")}
                           for c in d.get("categorias", [])],
            "conteo": conteo,
        })
    return {"total_entrevistas": len(entrevistas),
            "ia": {"disponible": clasificador.disponible(), "modelo": clasificador.modelo()},
            "dimensiones": salida}


@app.get("/api/clasificaciones/{dimension}")
def listar_clasificaciones(dimension: str, u: Usuario = Depends(usuario_actual),
                           s: Session = Depends(obtener_sesion)):
    d = _dimension(dimension)
    clas = _clasificaciones(s, dimension)
    filas = []
    for e in s.scalars(select(Entrevista).order_by(Entrevista.codigo)).all():
        c = clas.get(e.id)
        if _elegible(d, e) or (c and c.categoria):
            filas.append(_fila_clasificacion(d, e, c))
    return {"dimension": dimension, "entrevistas": filas,
            "ia": {"disponible": clasificador.disponible(), "modelo": clasificador.modelo()}}


def _buscar(s: Session, d: dict, ident: str) -> tuple[Entrevista, Clasificacion | None]:
    e = s.get(Entrevista, ident)
    if not e:
        raise HTTPException(404, "No existe esa entrevista")
    c = s.scalar(select(Clasificacion).where(
        Clasificacion.entrevista_id == ident, Clasificacion.dimension == d["clave"]))
    return e, c


@app.post("/api/clasificaciones/{dimension}/{ident}/ia")
def clasificar_con_ia(dimension: str, ident: str, cuerpo: dict | None = None,
                      u: Usuario = Depends(usuario_actual), s: Session = Depends(obtener_sesion)):
    """Pide a la IA la categoría de una entrevista. Si ya tiene una vigente no gasta
    otra consulta, salvo con `forzar`. Nunca cambia la decisión del equipo."""
    d = _dimension(dimension)
    if not activa(d):
        raise HTTPException(400, "Esta dimensión todavía no tiene reglas de clasificación")
    e, c = _buscar(s, d, ident)
    if not _elegible(d, e):
        raise HTTPException(400, "La entrevista no tiene respuestas en este módulo")
    vigente = _clasificacion_json(d, e, c) if c else None
    if vigente and c.categoria_ia and not vigente["desactualizada"] and not (cuerpo or {}).get("forzar"):
        return _fila_clasificacion(d, e, c)

    try:
        c = _aplicar_ia(s, d, e, c, u.nombre)
    except clasificador.ErrorIA as err:
        raise HTTPException(502, str(err)) from err
    return _fila_clasificacion(d, e, c)


def _aplicar_ia(s: Session, d: dict, e: Entrevista, c: Clasificacion | None, quien: str) -> Clasificacion:
    """Consulta a la IA y guarda su propuesta. La decisión del equipo no se toca."""
    r = clasificador.clasificar(d, e.datos or {})
    if c is None:
        c = Clasificacion(entrevista_id=e.id, dimension=d["clave"])
        s.add(c)
    _anotar(c, tipo="ia", usuario=quien, de=c.categoria_ia, a=r["categoria"], modelo=r["modelo"])
    c.categoria_ia = r["categoria"]
    c.justificacion = r["justificacion"]
    c.evidencias = r["evidencias"]
    c.confianza = r["confianza"]
    c.modelo = r["modelo"]
    c.version_reglas = d.get("version", "")
    c.huella = clasificador.huella(d, e.datos or {})
    c.clasificada_en = datetime.now(timezone.utc)
    s.commit()
    return c


def clasificar_automaticamente(ident: str) -> None:
    """Clasifica una entrevista recién enviada en todas las dimensiones con reglas.

    Corre después de responderle al celular, con su propia sesión. Un error se
    registra y se sigue: la entrevista queda «por clasificar» en el panel."""
    from .db import Sesion

    with Sesion() as s:
        e = s.get(Entrevista, ident)
        if not e:
            return
        for d in DIMENSIONES:
            if not activa(d) or not _elegible(d, e):
                continue
            c = s.scalar(select(Clasificacion).where(
                Clasificacion.entrevista_id == ident, Clasificacion.dimension == d["clave"]))
            vigente = _clasificacion_json(d, e, c) if c else None
            if vigente and c.categoria_ia and not vigente["desactualizada"]:
                continue
            try:
                _aplicar_ia(s, d, e, c, "Clasificación automática")
            except Exception as err:          # nunca debe tumbar el guardado
                s.rollback()
                print(f"[clasificación] {e.codigo} · {d['clave']}: no se pudo clasificar — {err}")


@app.post("/api/clasificaciones/{dimension}/{ident}/asignar")
def asignar_categoria(dimension: str, ident: str, cuerpo: dict,
                      u: Usuario = Depends(usuario_actual), s: Session = Depends(obtener_sesion)):
    """El equipo confirma o cambia la categoría (arrastrando en el diagrama).
    Con `categoria` vacía se quita la decisión del equipo y vuelve a valer la de la IA."""
    d = _dimension(dimension)
    if not activa(d):
        raise HTTPException(400, "Esta dimensión todavía no tiene reglas de clasificación")
    categoria = cuerpo.get("categoria") or None
    if categoria is not None and categoria not in claves_categoria(d):
        raise HTTPException(400, "Categoría no válida")
    e, c = _buscar(s, d, ident)
    if c is None:
        if categoria is None:
            return _fila_clasificacion(d, e, None)
        c = Clasificacion(entrevista_id=e.id, dimension=dimension)
        s.add(c)
    motivo = str(cuerpo.get("motivo") or "").strip()[:1000]
    _anotar(c, tipo="equipo", usuario=u.nombre, de=c.categoria, a=categoria or c.categoria_ia, motivo=motivo)
    c.categoria_final = categoria
    c.revisada_por = u.nombre if categoria else ""
    c.revisada_en = datetime.now(timezone.utc) if categoria else None
    c.motivo = motivo if categoria else ""
    s.commit()
    return _fila_clasificacion(d, e, c)


# -------------------------------- exportación --------------------------------

def _entrevistas_visibles(u: Usuario, s: Session) -> list[Entrevista]:
    return list(s.scalars(select(Entrevista).order_by(Entrevista.municipio, Entrevista.codigo)).all())


def _csv(filas: list[list]) -> StreamingResponse:
    buf = io.StringIO()
    buf.write("﻿")                      # BOM: Excel en español abre bien los acentos
    w = csv.writer(buf, delimiter=";", quoting=csv.QUOTE_ALL)
    w.writerows(filas)
    buf.seek(0)
    return StreamingResponse(iter([buf.getvalue()]), media_type="text/csv; charset=utf-8")


@app.get("/api/exportar/entrevistas.json")
def exportar_json(u: Usuario = Depends(usuario_actual), s: Session = Depends(obtener_sesion)):
    filas = _entrevistas_visibles(u, s)
    salida = {
        "proyecto": "Familia, diversidad y territorio: dinámicas familiares en el Eje Cafetero",
        "institucion": "Universidad de Caldas",
        "exportado": datetime.now(timezone.utc).isoformat(),
        "n": len(filas),
        "entrevistas": [{**e.resumen(), "datos": e.datos} for e in filas],
    }
    return JSONResponse(
        salida,
        headers={"Content-Disposition": 'attachment; filename="entrevistas.json"'},
    )


@app.get("/api/exportar/respuestas.csv")
def exportar_respuestas(u: Usuario = Depends(usuario_actual), s: Session = Depends(obtener_sesion)):
    filas: list[list] = [[
        "codigo", "estado", "departamento", "municipio", "lugar", "zona", "fecha",
        "participante", "edad", "bloque", "campo", "pregunta", "respuesta",
    ]]
    for e in _entrevistas_visibles(u, s):
        for r in (e.datos or {}).get("respuestas", []):
            filas.append([
                e.codigo, e.estado, e.departamento,
                e.municipio, e.lugar, e.zona, e.fecha, e.identidad, e.edad,
                r.get("bloque", ""), r.get("campo", ""), r.get("pregunta", ""),
                str(r.get("respuesta", "")).replace("\n", " ⏎ "),
            ])
    r = _csv(filas)
    r.headers["Content-Disposition"] = 'attachment; filename="respuestas.csv"'
    return r


@app.get("/api/exportar/personas.csv")
def exportar_personas(u: Usuario = Depends(usuario_actual), s: Session = Depends(obtener_sesion)):
    filas: list[list] = [[
        "codigo", "municipio", "zona", "integrante_id", "nombre", "parentesco",
        "tipo_integrante", "figura", "ubicacion", "ubicacion_texto", "especie",
    ]]
    for e in _entrevistas_visibles(u, s):
        for p in ((e.datos or {}).get("dibujo") or {}).get("personas", []):
            filas.append([
                e.codigo, e.municipio, e.zona, p.get("id", ""), p.get("nombre", ""),
                p.get("parentesco", ""), "mascota" if _es_mascota(p) else "persona",
                p.get("figura", ""), p.get("ubicacion", ""), p.get("ubicacion_texto", ""),
                _especie(p),
            ])
    r = _csv(filas)
    r.headers["Content-Disposition"] = 'attachment; filename="personas.csv"'
    return r


@app.get("/api/exportar/clasificaciones.csv")
def exportar_clasificaciones(u: Usuario = Depends(usuario_actual), s: Session = Depends(obtener_sesion)):
    """Una fila por entrevista y dimensión clasificada, con la propuesta de la IA y
    la decisión del equipo lado a lado, para medir cuánto coinciden."""
    filas: list[list] = [[
        "codigo", "municipio", "zona", "estado_entrevista", "dimension", "categoria",
        "categoria_ia", "categoria_equipo", "coincide", "confianza_ia", "justificacion_ia",
        "evidencias_ia", "modelo", "version_reglas", "revisada_por", "motivo", "desactualizada",
    ]]
    entrevistas = {e.id: e for e in _entrevistas_visibles(u, s)}
    for c in s.scalars(select(Clasificacion).order_by(Clasificacion.dimension)).all():
        e, d = entrevistas.get(c.entrevista_id), POR_CLAVE.get(c.dimension)
        if not e or not d or not c.categoria:
            continue
        j = _clasificacion_json(d, e, c)
        evid = " | ".join(f"{k}: {t}" for k, v in (c.evidencias or {}).items() for t in v)
        filas.append([
            e.codigo, e.municipio, e.zona, e.estado, c.dimension, c.categoria,
            c.categoria_ia or "", c.categoria_final or "",
            "" if not (c.categoria_ia and c.categoria_final) else ("sí" if c.categoria_ia == c.categoria_final else "no"),
            c.confianza, c.justificacion.replace("\n", " "), evid, c.modelo, c.version_reglas,
            c.revisada_por, c.motivo.replace("\n", " "), "sí" if j["desactualizada"] else "no",
        ])
    r = _csv(filas)
    r.headers["Content-Disposition"] = 'attachment; filename="clasificaciones.csv"'
    return r


# ------------------------------ páginas y estáticos ------------------------------

def _almacenamiento_efimero() -> bool:
    """True si la base vive en un disco que se borra al reiniciar (Vercel y
    similares con SQLite en /tmp). Ahí HAY QUE definir DATABASE_URL."""
    from .db import DATABASE_URL, DIR_DATOS
    return DATABASE_URL.startswith("sqlite") and str(DIR_DATOS).startswith("/tmp")


@app.get("/salud")
def salud():
    return {"ok": True, "almacenamiento_efimero": _almacenamiento_efimero()}


@app.on_event("startup")
def avisar_almacenamiento() -> None:
    if _almacenamiento_efimero():
        print("[ALERTA] La base está en almacenamiento temporal: las entrevistas se "
              "PERDERÁN al reiniciar. Defina DATABASE_URL con una PostgreSQL.")


def _pagina(nombre: str) -> FileResponse:
    return FileResponse(ESTATICOS / nombre, media_type="text/html")


@app.get("/", response_class=HTMLResponse)
def inicio():
    return _pagina("index.html")


@app.get("/panel", response_class=HTMLResponse)
def panel():
    return _pagina("panel.html")


@app.get("/consentimiento", response_class=HTMLResponse)
def consentimiento():
    return _pagina("consentimiento.html")


@app.get("/sw.js")
def service_worker():
    # El service worker debe servirse desde la raíz para poder cachear toda la app
    return FileResponse(ESTATICOS / "sw.js", media_type="application/javascript")


app.mount("/static", StaticFiles(directory=ESTATICOS), name="static")
