"""Punto de entrada para Vercel (runtime de Python).

Vercel no tiene disco donde guardar, así que en el proyecto hay que definir
las variables de entorno DATABASE_URL (PostgreSQL) y SECRET_KEY.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.main import app  # noqa: E402

__all__ = ["app"]
