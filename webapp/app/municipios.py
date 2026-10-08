"""Municipios de Caldas y normalización del nombre.

En campo el municipio llegaba escrito de cualquier forma («Manizales », «manizales»,
«MANIZALES») y las estadísticas lo contaban como municipios distintos. Aquí se
deja una sola grafía canónica.
"""
from __future__ import annotations

import unicodedata

# Los 27 municipios del departamento de Caldas, con su grafía oficial.
CALDAS = [
    "Manizales", "Aguadas", "Anserma", "Aranzazu", "Belalcázar", "Chinchiná",
    "Filadelfia", "La Dorada", "La Merced", "Manzanares", "Marmato", "Marquetalia",
    "Marulanda", "Neira", "Norcasia", "Pácora", "Palestina", "Pensilvania",
    "Riosucio", "Risaralda", "Salamina", "Samaná", "San José", "Supía",
    "Victoria", "Villamaría", "Viterbo",
]


def _plano(texto: str) -> str:
    """Minúsculas, sin tildes y sin espacios de más: sirve solo para comparar."""
    sin_tildes = "".join(
        c for c in unicodedata.normalize("NFD", texto)
        if unicodedata.category(c) != "Mn"
    )
    return " ".join(sin_tildes.lower().split())


_INDICE = {_plano(m): m for m in CALDAS}

# Variantes que la gente escribe y no coinciden letra por letra
_INDICE.update({
    "manizalez": "Manizales",
    "villa maria": "Villamaría",
    "san jose de caldas": "San José",
    "la dorada caldas": "La Dorada",
    "rio sucio": "Riosucio",
    "belalcazar": "Belalcázar",
    "chinchina": "Chinchiná",
    "pacora": "Pácora",
    "samana": "Samaná",
    "supia": "Supía",
    "villamaria": "Villamaría",
    "aranzazu": "Aranzazu",
})

# Palabras que no se capitalizan al reconstruir un nombre desconocido
_MINUSCULAS = {"de", "del", "la", "las", "los", "y", "el"}


def normalizar(municipio: str | None) -> str:
    """Devuelve la grafía oficial si el municipio es de Caldas; si no, lo deja
    limpio de espacios sobrantes y con mayúscula inicial en cada palabra."""
    if not municipio:
        return ""
    limpio = " ".join(str(municipio).split())
    if not limpio:
        return ""
    oficial = _INDICE.get(_plano(limpio))
    if oficial:
        return oficial
    palabras = []
    for i, palabra in enumerate(limpio.split()):
        bajo = palabra.lower()
        palabras.append(bajo if i and bajo in _MINUSCULAS else bajo.capitalize())
    return " ".join(palabras)
