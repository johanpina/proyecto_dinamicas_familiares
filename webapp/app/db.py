"""Conexión a la base de datos.

Por defecto usa SQLite en `datos/entrevistas.db` (no requiere instalar nada).
Para PostgreSQL basta con definir la variable de entorno DATABASE_URL, por ejemplo:

    DATABASE_URL=postgresql+psycopg://usuario:clave@localhost:5432/familias
"""
from __future__ import annotations

import os
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

DIR_DATOS = Path(os.getenv("DIR_DATOS", Path(__file__).resolve().parent.parent / "datos"))
try:
    DIR_DATOS.mkdir(parents=True, exist_ok=True)
except OSError:
    # En plataformas sin disco de escritura (Vercel y similares) solo /tmp sirve.
    # Ahí es obligatorio definir DATABASE_URL y SECRET_KEY.
    DIR_DATOS = Path("/tmp/uc-familias")
    DIR_DATOS.mkdir(parents=True, exist_ok=True)

def _normalizar(url: str) -> str:
    """Acepta la cadena tal como la entregan Neon, Supabase o Vercel.

    Todas usan `postgres://…` o `postgresql://…`, que en SQLAlchemy intentaría abrir
    con psycopg2; aquí el driver instalado es psycopg (v3), así que se ajusta solo.
    """
    for prefijo in ("postgresql+psycopg://", "postgresql+psycopg2://", "sqlite"):
        if url.startswith(prefijo):
            return url
    if url.startswith("postgresql://"):
        return "postgresql+psycopg://" + url[len("postgresql://"):]
    if url.startswith("postgres://"):
        return "postgresql+psycopg://" + url[len("postgres://"):]
    return url


# Vercel + Neon inyectan varias variables; se toma la primera que exista.
_cruda = (os.getenv("DATABASE_URL") or os.getenv("POSTGRES_URL")
          or os.getenv("DATABASE_URL_UNPOOLED") or "").strip()
DATABASE_URL = _normalizar(_cruda) if _cruda else f"sqlite:///{DIR_DATOS / 'entrevistas.db'}"

_kwargs: dict = {"pool_pre_ping": True}
if DATABASE_URL.startswith("sqlite"):
    # SQLite necesita esto para servir varias peticiones concurrentes de FastAPI
    _kwargs["connect_args"] = {"check_same_thread": False}
elif os.getenv("VERCEL") or os.getenv("AWS_LAMBDA_FUNCTION_NAME"):
    # En serverless cada instancia vive poco: guardar conexiones abiertas solo
    # sirve para agotar las de la base. El pooler de Neon ya hace ese trabajo.
    from sqlalchemy.pool import NullPool
    _kwargs["poolclass"] = NullPool
    _kwargs.pop("pool_pre_ping")

engine = create_engine(DATABASE_URL, **_kwargs)
Sesion = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    pass


def obtener_sesion():
    """Dependencia de FastAPI: entrega una sesión y la cierra al terminar."""
    s = Sesion()
    try:
        yield s
    finally:
        s.close()
