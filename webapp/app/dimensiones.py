"""Dimensiones de análisis para clasificar las entrevistas.

Cada dimensión corresponde a un módulo de la guía de entrevista: toma las
respuestas de sus pantallas (las `claves` de BLOQUES en static/js/app.js) y las
clasifica en UNA de sus categorías. Una entrevista tiene una sola categoría por
dimensión, pero puede quedar en categorías distintas en dimensiones distintas.

Una dimensión sin `categorias` aparece en el panel como pendiente de reglas.
Si cambian las definiciones o las reglas, hay que subir `version`: así se sabe
con qué reglas se clasificó cada entrevista y el panel marca las anteriores
como desactualizadas.
"""
from __future__ import annotations

# Categoría que existe en todas las dimensiones: la IA la usa cuando las
# respuestas no alcanzan para decidir.
SIN_INFO = {
    "clave": "sin_info",
    "nombre": "Sin información suficiente",
    "definicion": "Las respuestas del módulo están vacías o no describen actividades "
                  "que permitan ubicar la entrevista en alguna de las otras categorías.",
    "incluye": [],
}

CUIDADO = {
    "clave": "cuidado",
    "nombre": "El cuidado",
    "version": "cuidado-v1",
    "fuente": "Definiciones del equipo a partir del Boletín estadístico ONU Mujeres – DANE "
              "«Cuidado no remunerado de las mujeres» (mayo de 2020).",
    "bloques": ["p3", "p4", "p5"],
    # Texto de cada pregunta, por si la entrevista viene de una versión que no lo guardó
    "campos": {
        "r3a": "¿A quién cuido?",
        "r3b": "¿Cómo cuido?",
        "r3c": "¿Quién me cuida?",
        "r3d": "¿Cómo me cuido?",
        "r4a": "¿Quién cuida a los niños y las niñas?",
        "r4b": "¿Quién cuida a los jóvenes?",
        "r4c": "¿Quién cuida a los adultos mayores?",
        "r4d": "¿Quién cuida a los integrantes con discapacidad?",
        "r4e": "¿Quién cuida a las personas enfermas?",
        "r5a": "¿Cómo acuerdan quién cuida?",
        "r5b": "¿Quién suele asumir mayores responsabilidades en las tareas de cuidado?",
        "r5c": "¿Reciben apoyo de familiares, instituciones o comunidad para el cuidado de algún integrante de la familia?",
    },
    "categorias": [
        {
            "clave": "directo",
            "nombre": "Cuidado directo",
            "definicion": "Actividades en las que existe una interacción interpersonal directa entre "
                          "la persona cuidadora y quien recibe el cuidado o apoyo, para satisfacer "
                          "necesidades básicas de la vida diaria.",
            "incluye": [
                "Alimentar a otras personas: dar de comer o ayudar a lactar o alimentarse a niños, "
                "adultos mayores o personas con dependencia.",
                "Higiene personal: bañar, vestir, cambiar pañales o asear a alguien más.",
                "Apoyo a la salud: suministrar medicamentos, dar terapias o cuidar a personas enfermas.",
                "Acompañamiento: llevar o acompañar a citas médicas, trámites o espacios de recreación.",
                "Apoyo escolar y crianza: ayudar con tareas escolares, supervisar o cuidar a niños y niñas.",
                "Atención a personas mayores o con discapacidad: asistencia física o emocional continua.",
                "Vigilar o estar pendiente de quien requiere atención (lo que el DANE llama cuidado "
                "pasivo) también es cuidado directo.",
            ],
        },
        {
            "clave": "indirecto",
            "nombre": "Cuidado indirecto (trabajo doméstico)",
            "definicion": "Actividades destinadas a crear y mantener las condiciones habitacionales y "
                          "de bienestar del hogar para que el cuidado directo y la vida cotidiana sean "
                          "posibles. No requieren necesariamente una interacción cara a cara con la "
                          "persona asistida.",
            "incluye": [
                "Preparación y servido de alimentos: cocinar, lavar la loza y organizar la cocina.",
                "Limpieza y mantenimiento de la vivienda: barrer, trapear, tender camas, ordenar "
                "espacios y hacer reparaciones menores.",
                "Mantenimiento del vestuario: lavar, planchar y remendar la ropa y el calzado.",
                "Compras y administración del hogar: hacer el mercado, planear menús y gestionar el "
                "presupuesto o los trámites domésticos.",
                "Apoyo a otros hogares y a la comunidad: servicios no pagados a vecinos o parientes "
                "y trabajo voluntario.",
            ],
        },
        SIN_INFO,
    ],
    "reglas": [
        "Clasifique el cuidado que realizan los integrantes de la familia, incluida la persona "
        "entrevistada, hacia otras personas. «¿Quién me cuida?» cuenta: describe el cuidado que "
        "otro integrante le da a la persona entrevistada.",
        "El autocuidado («¿Cómo me cuido?») y el apoyo que dan instituciones o personas ajenas a la "
        "familia no cuentan para decidir la categoría; úselos solo como contexto en la justificación.",
        "Cada entrevista va en UNA sola categoría. Si aparecen cuidado directo e indirecto, elija el "
        "que PREDOMINA en el relato: el que tiene más actividades distintas, más detalle, más tiempo "
        "dedicado o más centralidad en lo que cuenta la persona. No decida por cantidad de palabras.",
        "Que alguien sea señalado como quien cuida a niños, jóvenes, adultos mayores, personas con "
        "discapacidad o enfermas es evidencia de cuidado directo, aunque no describa actividades; "
        "pesa menos que una descripción concreta de lo que hace.",
        "Use «Sin información suficiente» solo cuando las respuestas estén vacías o no describan "
        "ninguna actividad de cuidado directo ni indirecto.",
        "Las evidencias deben ser frases copiadas textualmente de las respuestas, cortas, sin "
        "corregirlas ni resumirlas. Si no hay evidencia de un tipo, deje esa lista vacía.",
        "Confianza: «alta» si un tipo domina con claridad; «media» si ambos aparecen pero uno pesa "
        "más; «baja» si están parejos o hay muy poca información.",
    ],
}

# Orden en que aparecen en el panel. Las que no tienen categorías esperan sus reglas.
DIMENSIONES: list[dict] = [
    {"clave": "cambios", "nombre": "Cambios en la familia", "bloques": ["p1"], "categorias": []},
    {"clave": "situacion", "nombre": "Una situación que los cambió", "bloques": ["p2"], "categorias": []},
    CUIDADO,
    {"clave": "decisiones", "nombre": "Las decisiones", "bloques": ["p6"], "categorias": []},
    {"clave": "apoyos", "nombre": "Apoyos y territorio", "bloques": ["p7"], "categorias": []},
    {"clave": "futuro", "nombre": "El futuro", "bloques": ["p8"], "categorias": []},
]

POR_CLAVE = {d["clave"]: d for d in DIMENSIONES}


def activa(d: dict) -> bool:
    return bool(d.get("categorias"))


def claves_categoria(d: dict) -> list[str]:
    return [c["clave"] for c in d.get("categorias", [])]
