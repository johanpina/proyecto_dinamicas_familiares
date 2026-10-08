"""Modelo de datos.

La entrevista completa se guarda como JSON en `datos` (fuente de verdad, resiste
cambios en la guía) y además se copian a columnas los campos que sirven para
filtrar, listar y exportar sin abrir el JSON.
"""
from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


def ahora() -> datetime:
    return datetime.now(timezone.utc)


class Usuario(Base):
    """Docente o coordinadora que aplica y revisa las entrevistas."""

    __tablename__ = "usuarios"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    usuario: Mapped[str] = mapped_column(String(60), unique=True, index=True)
    nombre: Mapped[str] = mapped_column(String(120))
    clave_hash: Mapped[str] = mapped_column(String(255))
    rol: Mapped[str] = mapped_column(String(20), default="docente")  # docente | coordinador
    activo: Mapped[bool] = mapped_column(Boolean, default=True)
    creado: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=ahora)

    entrevistas: Mapped[list["Entrevista"]] = relationship(back_populates="autora")

    @property
    def es_coordinador(self) -> bool:
        return self.rol == "coordinador"


class Entrevista(Base):
    """Una entrevista aplicada. `id` lo genera el celular para poder trabajar sin señal."""

    __tablename__ = "entrevistas"

    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    codigo: Mapped[str] = mapped_column(String(40), index=True)

    usuario_id: Mapped[int | None] = mapped_column(ForeignKey("usuarios.id"), index=True)
    autora: Mapped[Usuario | None] = relationship(back_populates="entrevistas")

    # --- campos de la ficha, copiados para poder filtrar y exportar ---
    departamento: Mapped[str] = mapped_column(String(80), default="")
    municipio: Mapped[str] = mapped_column(String(80), default="", index=True)
    lugar: Mapped[str] = mapped_column(String(120), default="")
    zona: Mapped[str] = mapped_column(String(30), default="")
    fecha: Mapped[str] = mapped_column(String(12), default="")
    identidad: Mapped[str] = mapped_column(String(40), default="")
    edad: Mapped[str] = mapped_column(String(8), default="")

    consentimiento: Mapped[bool] = mapped_column(Boolean, default=False)
    # La app ya no pide autorización de grabación (no se graba audio). La columna
    # se conserva para no romper los registros y las bases ya creadas.
    grabacion: Mapped[bool] = mapped_column(Boolean, default=False)

    # borrador | enviada | revisada
    estado: Mapped[str] = mapped_column(String(20), default="borrador", index=True)
    nota_revision: Mapped[str] = mapped_column(Text, default="")
    revisada_por: Mapped[str] = mapped_column(String(120), default="")
    revisada_en: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    personas: Mapped[int] = mapped_column(Integer, default=0)
    respondidas: Mapped[int] = mapped_column(Integer, default=0)

    datos: Mapped[dict] = mapped_column(JSON, default=dict)

    creada: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=ahora)
    actualizada: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=ahora, onupdate=ahora)

    def resumen(self) -> dict:
        return {
            "id": self.id,
            "codigo": self.codigo,
            "municipio": self.municipio,
            "lugar": self.lugar,
            "zona": self.zona,
            "fecha": self.fecha,
            "identidad": self.identidad,
            "edad": self.edad,
            "estado": self.estado,
            "personas": self.personas,
            "respondidas": self.respondidas,
            "autora": self.autora.nombre if self.autora else "",
            "nota_revision": self.nota_revision,
            "revisada_por": self.revisada_por,
            "actualizada": self.actualizada.isoformat() if self.actualizada else None,
        }


class Rechazo(Base):
    """Registro anónimo de quien no aceptó participar. No guarda ningún dato personal."""

    __tablename__ = "rechazos"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    usuario_id: Mapped[int | None] = mapped_column(ForeignKey("usuarios.id"))
    municipio: Mapped[str] = mapped_column(String(80), default="")
    zona: Mapped[str] = mapped_column(String(30), default="")
    creado: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=ahora)
