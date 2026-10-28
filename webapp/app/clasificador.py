"""Clasificación de entrevistas con IA (API de OpenAI).

Corre solo en el servidor: la clave vive en la variable OPENAI_API_KEY y nunca
llega al navegador. A la IA se le envían únicamente las respuestas del módulo
que se clasifica, sin la ficha (nombre, municipio, edad…).

Se pide una respuesta con esquema JSON estricto, así la IA solo puede devolver
una de las categorías definidas en `dimensiones.py`. Sin librerías externas,
igual que el resto del servidor: basta urllib.

Variables:
    OPENAI_API_KEY  la clave de la API (obligatoria para clasificar)
    MODELO_IA       el modelo a usar (por defecto gpt-5.6-luna)
"""
from __future__ import annotations

import hashlib
import json
import os
import urllib.error
import urllib.request

from .dimensiones import activa, claves_categoria

URL_API = "https://api.openai.com/v1/chat/completions"
ESPERA_S = 50          # Vercel corta la función a los 60 s


def modelo() -> str:
    return os.getenv("MODELO_IA", "gpt-5.6-luna").strip() or "gpt-5.6-luna"


def disponible() -> bool:
    return bool(os.getenv("OPENAI_API_KEY", "").strip())


class ErrorIA(Exception):
    """Falla al clasificar, con un mensaje que se puede mostrar en el panel."""


# ------------------------------ respuestas del módulo ------------------------------

def respuestas_modulo(d: dict, datos: dict) -> list[dict]:
    """Las preguntas del módulo con su respuesta, en el orden de la guía.

    Acepta las dos formas en que se han guardado las respuestas: la lista que
    manda la app (con el texto de la pregunta) y el diccionario clave → texto."""
    crudas = (datos or {}).get("respuestas") or []
    por_campo: dict[str, dict] = {}
    if isinstance(crudas, dict):
        por_campo = {k: {"campo": k, "respuesta": v} for k, v in crudas.items()}
    else:
        por_campo = {r.get("campo"): r for r in crudas if isinstance(r, dict)}
    salida = []
    for campo, pregunta in d.get("campos", {}).items():
        r = por_campo.get(campo) or {}
        salida.append({
            "campo": campo,
            "pregunta": r.get("pregunta") or pregunta,
            "respuesta": str(r.get("respuesta") or "").strip(),
        })
    return salida


def tiene_respuestas(d: dict, datos: dict) -> bool:
    return any(r["respuesta"] for r in respuestas_modulo(d, datos))


def huella(d: dict, datos: dict) -> str:
    """Resume las respuestas del módulo: si cambia, la clasificación quedó vieja."""
    texto = json.dumps([[r["campo"], r["respuesta"]] for r in respuestas_modulo(d, datos)],
                       ensure_ascii=False)
    return hashlib.sha256(texto.encode("utf-8")).hexdigest()[:24]


# ------------------------------------ la consulta ------------------------------------

def _instrucciones(d: dict) -> str:
    partes = [
        "Usted apoya a un equipo de investigación de la Universidad de Caldas (Colombia) que "
        "analiza entrevistas cualitativas sobre dinámicas familiares en el Eje Cafetero.",
        f"Debe clasificar la entrevista en la dimensión «{d['nombre']}», a partir solo de las "
        "respuestas que se le entregan. Las respuestas están escritas por personas del común, "
        "a veces con errores de ortografía o de forma muy breve: interprételas con cuidado y "
        "no invente lo que no dicen.",
        "",
        "CATEGORÍAS",
    ]
    for c in d["categorias"]:
        partes.append(f"\n[{c['clave']}] {c['nombre']}\n{c['definicion']}")
        for i in c.get("incluye", []):
            partes.append(f"  - {i}")
    partes += ["", "REGLAS"] + [f"{n}. {r}" for n, r in enumerate(d.get("reglas", []), 1)]
    partes += ["", "Escriba la justificación en español, en dos o tres frases."]
    return "\n".join(partes)


def _entrevista(d: dict, datos: dict) -> str:
    lineas = []
    for r in respuestas_modulo(d, datos):
        lineas.append(f"Pregunta ({r['campo']}): {r['pregunta']}\n"
                      f"Respuesta: {r['respuesta'] or '(sin respuesta)'}")
    return "\n\n".join(lineas)


def _esquema(d: dict) -> dict:
    con_evidencia = [c for c in claves_categoria(d) if c != "sin_info"]
    lista = {"type": "array", "items": {"type": "string"}}
    return {
        "type": "object",
        "additionalProperties": False,
        # La evidencia va primero: la IA revisa ambos tipos antes de decidir
        "required": ["evidencias", "categoria", "justificacion", "confianza"],
        "properties": {
            "evidencias": {
                "type": "object",
                "additionalProperties": False,
                "required": con_evidencia,
                "properties": {c: lista for c in con_evidencia},
            },
            "categoria": {"type": "string", "enum": claves_categoria(d)},
            "justificacion": {"type": "string"},
            "confianza": {"type": "string", "enum": ["alta", "media", "baja"]},
        },
    }


def clasificar(d: dict, datos: dict) -> dict:
    """Pide la clasificación a la IA. Devuelve categoría, justificación, evidencias y confianza."""
    if not activa(d):
        raise ErrorIA("Esta dimensión todavía no tiene reglas de clasificación")
    clave = os.getenv("OPENAI_API_KEY", "").strip()
    if not clave:
        raise ErrorIA("Falta configurar OPENAI_API_KEY en el servidor")

    cuerpo = {
        "model": modelo(),
        "messages": [
            {"role": "system", "content": _instrucciones(d)},
            {"role": "user", "content": _entrevista(d, datos)},
        ],
        "response_format": {
            "type": "json_schema",
            "json_schema": {"name": "clasificacion", "strict": True, "schema": _esquema(d)},
        },
    }
    peticion = urllib.request.Request(
        URL_API, data=json.dumps(cuerpo).encode("utf-8"), method="POST",
        headers={"Authorization": f"Bearer {clave}", "Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(peticion, timeout=ESPERA_S) as r:
            respuesta = json.loads(r.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        try:
            detalle = json.loads(e.read().decode("utf-8")).get("error", {}).get("message", "")
        except Exception:
            detalle = ""
        if e.code == 401:
            raise ErrorIA("La clave de OpenAI no es válida") from e
        if e.code == 429:
            raise ErrorIA("OpenAI rechazó la petición por límite de uso o saldo agotado") from e
        if e.code == 404:
            raise ErrorIA(f"El modelo «{modelo()}» no está disponible para esta clave; "
                          "cámbielo con MODELO_IA") from e
        raise ErrorIA(f"OpenAI respondió con error {e.code}. {detalle}".strip()) from e
    except (urllib.error.URLError, TimeoutError) as e:
        motivo = getattr(e, "reason", e)
        if "CERTIFICATE_VERIFY_FAILED" in str(motivo):
            raise ErrorIA("No se pudo verificar el certificado de OpenAI: a este Python le faltan "
                          "certificados (en Mac, defina SSL_CERT_FILE=/etc/ssl/cert.pem)") from e
        raise ErrorIA(f"No se pudo conectar con OpenAI ({motivo}); intente de nuevo") from e

    try:
        mensaje = respuesta["choices"][0]["message"]
        if mensaje.get("refusal"):
            raise ErrorIA("La IA se negó a clasificar esta entrevista")
        salida = json.loads(mensaje["content"])
    except (KeyError, IndexError, TypeError, json.JSONDecodeError) as e:
        raise ErrorIA("La respuesta de la IA llegó incompleta; intente de nuevo") from e

    if salida.get("categoria") not in claves_categoria(d):
        raise ErrorIA("La IA devolvió una categoría que no existe")
    return {
        "categoria": salida["categoria"],
        "justificacion": str(salida.get("justificacion", "")).strip(),
        "evidencias": salida.get("evidencias") or {},
        "confianza": salida.get("confianza", "media"),
        "modelo": respuesta.get("model") or modelo(),
    }
