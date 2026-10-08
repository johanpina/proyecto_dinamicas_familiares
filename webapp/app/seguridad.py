"""Contraseñas y sesiones, solo con la librería estándar (sin dependencias extra).

- Contraseñas: PBKDF2-HMAC-SHA256 con sal aleatoria por usuario.
- Sesión: token firmado con HMAC que lleva el id del usuario y la fecha de vencimiento.
  Dura 30 días para que una docente pueda seguir trabajando sin señal en el municipio.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import os
import secrets
import time
from pathlib import Path

from .db import DIR_DATOS

ITERACIONES = 200_000
DIAS_SESION = 30


def _clave_secreta() -> bytes:
    """Toma SECRET_KEY del entorno; si no existe, genera una y la guarda en disco
    para que los tokens sigan siendo válidos al reiniciar el servidor."""
    env = os.getenv("SECRET_KEY")
    if env:
        return env.encode()
    try:
        archivo = Path(DIR_DATOS) / "secret.key"
        if not archivo.exists():
            archivo.write_text(secrets.token_urlsafe(48))
            archivo.chmod(0o600)
        return archivo.read_text().strip().encode()
    except OSError:
        # Sin disco donde guardarla: se usa una temporal. Las sesiones del panel
        # se caen en cada reinicio, así que en producción hay que definir SECRET_KEY.
        print("[aviso] No se pudo guardar la llave de sesión. Defina SECRET_KEY.")
        return secrets.token_urlsafe(48).encode()


SECRETO = _clave_secreta()


# ------------------------------- contraseñas -------------------------------

def cifrar_clave(clave: str) -> str:
    sal = secrets.token_bytes(16)
    dk = hashlib.pbkdf2_hmac("sha256", clave.encode(), sal, ITERACIONES)
    return f"pbkdf2${ITERACIONES}${base64.b64encode(sal).decode()}${base64.b64encode(dk).decode()}"


def verificar_clave(clave: str, guardado: str) -> bool:
    try:
        _, iters, sal_b64, dk_b64 = guardado.split("$")
        sal = base64.b64decode(sal_b64)
        esperado = base64.b64decode(dk_b64)
        dk = hashlib.pbkdf2_hmac("sha256", clave.encode(), sal, int(iters))
        return hmac.compare_digest(dk, esperado)
    except Exception:
        return False


# --------------------------------- sesiones ---------------------------------

def _firmar(mensaje: bytes) -> str:
    return base64.urlsafe_b64encode(hmac.new(SECRETO, mensaje, hashlib.sha256).digest()).decode().rstrip("=")


def crear_token(usuario_id: int) -> str:
    vence = int(time.time()) + DIAS_SESION * 86400
    cuerpo = f"{usuario_id}.{vence}".encode()
    cuerpo_b64 = base64.urlsafe_b64encode(cuerpo).decode().rstrip("=")
    return f"{cuerpo_b64}.{_firmar(cuerpo)}"


def leer_token(token: str) -> int | None:
    """Devuelve el id del usuario si el token es válido y no ha vencido."""
    try:
        cuerpo_b64, firma = token.split(".", 1)
        relleno = "=" * (-len(cuerpo_b64) % 4)
        cuerpo = base64.urlsafe_b64decode(cuerpo_b64 + relleno)
        if not hmac.compare_digest(firma, _firmar(cuerpo)):
            return None
        uid, vence = cuerpo.decode().split(".")
        if int(vence) < time.time():
            return None
        return int(uid)
    except Exception:
        return None
