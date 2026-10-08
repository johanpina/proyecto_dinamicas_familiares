#!/usr/bin/env python3
"""Administración de las cuentas de las docentes.

    python usuarios.py listar
    python usuarios.py crear zoraida "Zoraida Cárdenas" --rol coordinador
    python usuarios.py clave zoraida
    python usuarios.py desactivar zoraida
"""
from __future__ import annotations

import argparse
import getpass
import sys

from sqlalchemy import select

from app.db import Base, Sesion, engine
from app.models import Usuario
from app.seguridad import cifrar_clave


def _pedir_clave() -> str:
    a = getpass.getpass("Contraseña nueva: ")
    b = getpass.getpass("Repítala: ")
    if a != b:
        sys.exit("Las contraseñas no coinciden.")
    if len(a) < 8:
        sys.exit("Use al menos 8 caracteres.")
    return a


def main() -> None:
    Base.metadata.create_all(engine)
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="accion", required=True)

    sub.add_parser("listar")

    c = sub.add_parser("crear")
    c.add_argument("usuario")
    c.add_argument("nombre")
    c.add_argument("--rol", choices=["docente", "coordinador"], default="docente")

    k = sub.add_parser("clave")
    k.add_argument("usuario")

    d = sub.add_parser("desactivar")
    d.add_argument("usuario")

    args = p.parse_args()

    with Sesion() as s:
        if args.accion == "listar":
            for u in s.scalars(select(Usuario).order_by(Usuario.usuario)):
                estado = "activa" if u.activo else "INACTIVA"
                print(f"{u.usuario:<20} {u.rol:<12} {estado:<9} {u.nombre}")
            return

        if args.accion == "crear":
            usuario = args.usuario.strip().lower()
            if s.scalar(select(Usuario).where(Usuario.usuario == usuario)):
                sys.exit(f"El usuario «{usuario}» ya existe.")
            s.add(Usuario(usuario=usuario, nombre=args.nombre,
                          clave_hash=cifrar_clave(_pedir_clave()), rol=args.rol))
            s.commit()
            print(f"Cuenta «{usuario}» creada como {args.rol}.")
            return

        u = s.scalar(select(Usuario).where(Usuario.usuario == args.usuario.strip().lower()))
        if not u:
            sys.exit("No existe esa cuenta.")

        if args.accion == "clave":
            u.clave_hash = cifrar_clave(_pedir_clave())
            s.commit()
            print("Contraseña cambiada.")
        elif args.accion == "desactivar":
            u.activo = False
            s.commit()
            print("Cuenta desactivada.")


if __name__ == "__main__":
    main()
