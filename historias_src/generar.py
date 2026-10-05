# -*- coding: utf-8 -*-
"""Genera las 27 historias municipales (historia_<slug>.html) en la raíz del repo.

Fuentes (historias_src/datos):
  sisben_v5.json, dane_v5.json, ecv_v5.json  -> tablero publicado (V5)
  fichas_oficiales.json                       -> fichas CNPV 2018 e IPM 2018 DANE
  fotos.json                                  -> fotos de Wikimedia Commons
Uso: python3 historias_src/generar.py
"""
import json, os, re, html
from meta import MUNICIPIOS, FOTOS_FIJAS

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(AQUI)
D = lambda f: json.load(open(os.path.join(AQUI, "datos", f), encoding="utf-8"))

SIS = D("sisben_v5.json"); DANE = D("dane_v5.json"); ECV = D("ecv_v5.json")
FICH = D("fichas_oficiales.json"); META_ACT = D("_meta_actual.json")
try:
    FOTOS = D("fotos.json")
except FileNotFoundError:
    FOTOS = {}
CSS = open(os.path.join(AQUI, "estilos.css"), encoding="utf-8").read()

ECV_MIN = 40      # por debajo de esta muestra no se presenta la ECV municipal
ECV_ROBUSTA = 100  # desde aquí se presenta sin advertencia de muestra pequeña

# ---------- formato ----------
def nf(x):
    return f"{int(round(x)):,}".replace(",", ".")
def d1(x):
    return f"{x:.1f}".replace(".", ",")
def pc(x):
    return d1(x) + "%"
def esc(s):
    return html.escape(s, quote=True)

# ---------- color ----------
def _rgb(h): h = h.lstrip("#"); return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))
def _hex(c): return "#" + "".join(f"{max(0,min(255,round(v))):02x}" for v in c)
def mix(a, b, t): A, B = _rgb(a), _rgb(b); return _hex(tuple(A[i] + (B[i]-A[i])*t for i in range(3)))
def _lum(h):
    def ch(v):
        v /= 255; return v/12.92 if v <= .03928 else ((v+.055)/1.055)**2.4
    r, g, b = _rgb(h); return .2126*ch(r) + .7152*ch(g) + .0722*ch(b)
def contraste(a, b):
    la, lb = sorted([_lum(a), _lum(b)], reverse=True); return (la+.05)/(lb+.05)
def tinta_acento(ac):
    """Oscurece el acento hasta 5:1 sobre blanco para usarlo en texto."""
    c = ac; t = 0
    while contraste(c, "#ffffff") < 5.0 and t < 1:
        t += .04; c = mix(ac, "#15191e", t)
    return c

# ---------- percentiles (solo para elegir énfasis; nunca se muestran) ----------
NOMBRES = [m["nombre"] for m in MUNICIPIOS]
def rango(valores, v):
    vs = sorted(x for x in valores if x is not None)
    if v is None or not vs: return 0
    return sum(1 for x in vs if x < v) / max(1, len(vs)-1)

def indicadores(n):
    s = SIS[n]; d5 = DANE["d2005"][n]; d8 = DANE["d2018"][n]; f = FICH[n]; e = ECV.get(n, {"n": 0})
    pob = None
    if f.get("pob2005") and f.get("pob2018"):
        pob = (f["pob2018"] - f["pob2005"]) / f["pob2005"] * 100
    ecv_ok = e.get("n", 0) >= ECV_MIN
    return dict(
        caida_pob=(-pob if pob is not None else None),
        crece_pob=pob,
        envej=f.get("envej2018"),
        busca=s["ocup"][1], oficios=s["ocup"][2], trabaja=s["ocup"][0],
        uni_sis=s["uni"], uni_cambio=d8["dist"][0]-d5["dist"][0],
        jef_cambio=d8["jefT"]-d5["jefT"], jef18=d8["jefT"],
        pobreza_sis=s["pobP"], ingreso_bajo=-s["ingr"],
        ipm_rural=(f.get("ipm") or {}).get("rural"),
        rural=s["rural"], disc=s["disc"],
        internet_bajo=-((f.get("serv2018") or {}).get("internet") or 100),
        acued_bajo=-((f.get("serv2018") or {}).get("acueducto") or 100),
        inseg=(e.get("insegAny") if ecv_ok else None),
        pobre_ecv=(e.get("pobre") if ecv_ok else None),
        hacin=s["hacP"], analf=s["alfP"],
    )
IND = {n: indicadores(n) for n in NOMBRES}
def pr(n, k):
    return rango([IND[m][k] for m in NOMBRES], IND[n][k])

# ---------- piezas SVG ----------
def svg_dumbbell(d5, d8, ac, W=720):
    labs = ["1 persona", "2 personas", "3 personas", "4 personas", "5 personas", "6 o más"]
    L, R, row = (132, 40, 46) if W > 500 else (100, 34, 44)
    H = row*6 + 40
    mx = max(max(d5), max(d8)) * 1.12
    x = lambda v: L + (W-L-R) * v / mx
    out = [f'<svg class="chart" viewBox="0 0 {W} {H}" role="img" aria-label="Porcentaje de hogares según número de personas, 2005 y 2018">']
    for t in range(0, int(mx)+1, 10):
        out.append(f'<line x1="{x(t):.1f}" x2="{x(t):.1f}" y1="8" y2="{H-28}" stroke="var(--line)" />'
                   f'<text x="{x(t):.1f}" y="{H-8}" font-size="13" fill="var(--ink-3)" text-anchor="middle">{t}%</text>')
    for i in range(6):
        y = 26 + i*row; a, b = d5[i], d8[i]
        out.append(f'<text x="0" y="{y+5}" font-size="16" fill="var(--ink)">{labs[i]}</text>')
        out.append(f'<line class="grow" x1="{x(min(a,b)):.1f}" x2="{x(max(a,b)):.1f}" y1="{y}" y2="{y}" stroke="{mix(ac,"#ffffff",.45)}" stroke-width="6" stroke-linecap="round" style="transform-origin:{x(min(a,b)):.1f}px {y}px"/>')
        out.append(f'<circle cx="{x(a):.1f}" cy="{y}" r="8" fill="var(--past)"/>')
        out.append(f'<circle class="dot" cx="{x(b):.1f}" cy="{y}" r="10" fill="var(--ac)"/>')
        left, right = (a, b) if a <= b else (b, a)
        la = "end" if a <= b else "start"; lb = "start" if a <= b else "end"
        ox = -14 if a <= b else 14
        out.append(f'<text x="{x(a)+ox:.1f}" y="{y+5}" font-size="14" fill="var(--ink-3)" text-anchor="{la}">{d1(a)}</text>')
        out.append(f'<text class="dot" x="{x(b)-ox:.1f}" y="{y+5}" font-size="15" font-weight="700" fill="var(--ac-ink)" text-anchor="{lb}">{d1(b)}</text>')
    out.append("</svg>")
    return "".join(out)

def svg_tres_puntos(v05, v18, vsis, etiqueta):
    W, H, T, B = 440, 280, 44, 50
    mx = max(v05, v18, vsis) * 1.18
    y = lambda v: T + (H-T-B) * (1 - v/mx)
    xs = [56, 220, 384]
    out = [f'<svg class="chart" viewBox="0 0 {W} {H}" role="img" aria-label="{esc(etiqueta)}: censo 2005 {d1(v05)}%, censo 2018 {d1(v18)}%, SISBÉN 2026 {d1(vsis)}%">']
    out.append(f'<line x1="{xs[0]}" y1="{y(v05):.1f}" x2="{xs[1]}" y2="{y(v18):.1f}" stroke="var(--ac)" stroke-width="5" stroke-linecap="round"/>')
    out.append(f'<line x1="{xs[1]}" y1="{y(v18):.1f}" x2="{xs[2]}" y2="{y(vsis):.1f}" stroke="var(--sis)" stroke-width="3" stroke-dasharray="2 9" stroke-linecap="round"/>')
    pts = [(xs[0], v05, "var(--past)", "Censo 2005"), (xs[1], v18, "var(--ac)", "Censo 2018"), (xs[2], vsis, "var(--sis)", "SISBÉN 2026")]
    for cx, v, c, lab in pts:
        out.append(f'<circle class="dot" cx="{cx}" cy="{y(v):.1f}" r="11" fill="{c}"/>')
        out.append(f'<text x="{cx}" y="{y(v)-22:.1f}" font-size="26" font-weight="800" fill="var(--ink)" text-anchor="middle">{d1(v)}%</text>')
        out.append(f'<text x="{cx}" y="{H-14}" font-size="14.5" fill="var(--ink-3)" text-anchor="middle">{lab}</text>')
    out.append("</svg>")
    return "".join(out)

def svg_edades(e05, e18, ac, W=720):
    labs = ["0 a 11", "12 a 17", "18 a 27", "28 a 59", "60 y más"]
    tones = [mix(ac, "#ffffff", t) for t in (.82, .64, .44, .22, 0)]
    L, rowh = (64, 58) if W > 500 else (52, 64)
    H = rowh*2 + 26
    out = [f'<svg class="chart" viewBox="0 0 {W} {H}" role="img" aria-label="Distribución de la población por edad, 2005 y 2018">']
    for r, (yr, arr) in enumerate((("2005", e05), ("2018", e18))):
        y = 10 + r*(rowh+14); x = L
        out.append(f'<text x="0" y="{y+rowh/2+6}" font-size="17" font-weight="700" fill="var(--ink)">{yr}</text>')
        tot = sum(arr)
        for i, v in enumerate(arr):
            w = (W-L) * v / tot
            out.append(f'<rect class="grow" x="{x:.1f}" y="{y}" width="{max(w-2,0):.1f}" height="{rowh}" rx="4" fill="{tones[i]}" style="transform-origin:{L}px {y}px"/>')
            if w > 44:
                fc = "#ffffff" if contraste(tones[i], "#ffffff") >= 4.5 else "#15191e"
                out.append(f'<text class="dot" x="{x+w/2:.1f}" y="{y+rowh/2+6}" font-size="15" font-weight="700" fill="{fc}" text-anchor="middle">{d1(v)}%</text>')
            x += w
    out.append("</svg>")
    return "".join(out)

def svg_columnas(vals, ac, resaltar):
    labs = ["1", "2", "3", "4", "5", "6+"]
    W, H, B, T = 440, 250, 40, 34
    mx = max(vals) * 1.15
    bw = 48; gap = (W - bw*6) / 6
    out = [f'<svg class="chart" viewBox="0 0 {W} {H}" role="img" aria-label="Ingreso promedio mensual del hogar según número de personas, en miles de pesos">']
    for i, v in enumerate(vals):
        h = (H-B-T) * v / mx; x = gap/2 + i*(bw+gap); y = H-B-h
        c = "var(--ac)" if i == resaltar else "var(--line-2)"
        out.append(f'<rect class="grow" x="{x:.1f}" y="{y:.1f}" width="{bw}" height="{h:.1f}" rx="5" fill="{c}" style="transform-origin:{x:.1f}px {H-B}px;transform-box:fill-box"/>')
        out.append(f'<text x="{x+bw/2:.1f}" y="{y-10:.1f}" font-size="15" font-weight="700" fill="var(--ink)" text-anchor="middle">${nf(v)}</text>')
        out.append(f'<text x="{x+bw/2:.1f}" y="{H-16}" font-size="14" fill="var(--ink-3)" text-anchor="middle">{labs[i]}</text>')
    out.append("</svg>")
    return "".join(out)

def svg_servicios(s05, s18):
    rows = [("Energía", "energia"), ("Acueducto", "acueducto"), ("Alcantarillado", "alcantarillado"), ("Gas natural", "gas"), ("Internet", "internet")]
    W, L, R, row = 480, 118, 22, 46
    H = row*len(rows) + 36
    x = lambda v: L + (W-L-R) * v / 100
    out = [f'<svg class="chart" viewBox="0 0 {W} {H}" role="img" aria-label="Cobertura de servicios públicos en la vivienda, 2005 y 2018">']
    for t in (0, 25, 50, 75, 100):
        out.append(f'<line x1="{x(t):.1f}" x2="{x(t):.1f}" y1="6" y2="{H-26}" stroke="var(--line)"/><text x="{x(t):.1f}" y="{H-6}" font-size="13" fill="var(--ink-3)" text-anchor="middle">{t}%</text>')
    for i, (lab, k) in enumerate(rows):
        y = 26 + i*row; a = (s05 or {}).get(k); b = (s18 or {}).get(k)
        out.append(f'<text x="0" y="{y+5}" font-size="16" fill="var(--ink)">{lab}</text>')
        if a is not None and b is not None:
            out.append(f'<line x1="{x(min(a,b)):.1f}" x2="{x(max(a,b)):.1f}" y1="{y}" y2="{y}" stroke="var(--line-2)" stroke-width="5" stroke-linecap="round"/>')
        if a is not None:
            out.append(f'<circle cx="{x(a):.1f}" cy="{y}" r="7" fill="var(--past)"/>')
        if b is not None:
            out.append(f'<circle class="dot" cx="{x(b):.1f}" cy="{y}" r="9" fill="var(--ac)"/>')
            tx = x(b) + 16 if b < 88 else x(b) - 16
            anc = "start" if b < 88 else "end"
            if a is not None and b < a and b >= 12:
                tx, anc = x(b) - 16, "end"
            out.append(f'<text class="dot" x="{tx:.1f}" y="{y-12}" font-size="14.5" font-weight="700" fill="var(--ac-ink)" text-anchor="{anc}">{d1(b)}%</text>')
    out.append("</svg>")
    return "".join(out)

def dos(ancho, angosto):
    return f'<div class="cw">{ancho}</div><div class="cn">{angosto}</div>'

def waffle(p):
    k = int(round(p))
    return '<div class="grid10" aria-hidden="true">' + "".join('<i class="on"></i>' if i < k else "<i></i>" for i in range(100)) + "</div>"

def barra(v, mx, clase):
    return f'<div class="bar {clase} grow" style="width:{max(2, 100*v/mx):.1f}%"></div>'

# ---------- textos según datos ----------
def frase_poblacion(n, f):
    p5, p8 = f.get("pob2005"), f.get("pob2018")
    if not p5 or not p8:
        return None, f"En el censo de 2018 se contaron {nf(p8)} habitantes."
    ch = (p8-p5)/p5*100
    if ch <= -15:
        return ch, f"Entre 2005 y 2018 pasó de {nf(p5)} a {nf(p8)} habitantes: perdió {d1(-ch)}% de su población."
    if ch < -2:
        return ch, f"Entre 2005 y 2018 pasó de {nf(p5)} a {nf(p8)} habitantes, una caída de {d1(-ch)}%."
    if ch <= 2:
        return ch, f"La población se mantuvo estable: {nf(p5)} habitantes en 2005 y {nf(p8)} en 2018."
    return ch, f"La población creció de {nf(p5)} a {nf(p8)} habitantes entre 2005 y 2018 ({d1(ch)}% más)."

def peso(n, k, sev):
    """Mezcla la magnitud propia del indicador (sev, 0 a 1) con su posición
    entre los 27 municipios. Solo sirve para ordenar; no se muestra."""
    return .55 * max(0, min(1, sev)) + .45 * pr(n, k)

def destacado(n, f, s, d5, d8, e):
    """Elige el hecho más llamativo del municipio."""
    c = []
    ch = IND[n]["crece_pob"]
    if ch is not None and ch <= -8:
        c.append((peso(n, "caida_pob", -ch / 25), d1(-ch), "%", "menos habitantes que en 2005.",
                  f"El censo pasó de {nf(f['pob2005'])} a {nf(f['pob2018'])} personas. La salida de población joven deja hogares más pequeños y a cargo de personas mayores.",
                  "Fichas CNPV 2018, DANE"))
    if ch is not None and ch >= 5:
        c.append((peso(n, "crece_pob", ch / 25), d1(ch), "%", "más habitantes que en 2005.",
                  f"El censo pasó de {nf(f['pob2005'])} a {nf(f['pob2018'])} personas. Crecer exige más vivienda, servicios y empleo para las familias que llegan.",
                  "Fichas CNPV 2018, DANE"))
    if f.get("envej2018"):
        c.append((peso(n, "envej", (f["envej2018"] - 40) / 80), d1(f["envej2018"]), "", "personas de 65 años o más por cada 100 menores de 15.",
                  f"En 2005 el índice era {d1(f['envej2005'])}. " + ("Ya hay más personas mayores que niños: el cuidado se vuelve una tarea central de las familias." if f["envej2018"] >= 100 else "El cuidado de las personas mayores gana peso en la vida de las familias."),
                  "Fichas CNPV 2018, DANE"))
    c.append((peso(n, "busca", s["ocup"][1] / 40), d1(s["ocup"][1]), "%", "de los jefes de hogar del SISBÉN está buscando trabajo.",
              f"{pc(s['ocup'][0])} está trabajando. Sin empleo estable, el ingreso promedio del hogar llega a ${nf(s['ingr'])} mil al mes.",
              "SISBÉN IV 2026, tablero del proyecto"))
    c.append((peso(n, "oficios", s["ocup"][2] / 40), d1(s["ocup"][2]), "%", "de los jefes de hogar del SISBÉN se dedica a oficios del hogar.",
              "Es trabajo de cuidado que sostiene a la familia pero no recibe pago. En el SISBÉN, las mujeres encabezan el " + pc(s["jefF"]) + " de los hogares.",
              "SISBÉN IV 2026, tablero del proyecto"))
    c.append((peso(n, "uni_sis", (s["uni"] - 15) / 35), d1(s["uni"]), "%", "de los hogares del SISBÉN son de una sola persona.",
              f"En el censo de 2018 eran {pc(d8['dist'][0])} de todos los hogares. Vivir solo, sobre todo en la vejez, aumenta el riesgo de quedar sin apoyo.",
              "SISBÉN IV 2026 y censo 2018"))
    c.append((peso(n, "jef_cambio", (d8["jefT"] - d5["jefT"]) / 20), d1(d8["jefT"]), "%", "de los hogares tiene a una mujer como jefa.",
              f"En 2005 eran {pc(d5['jefT'])}. En la zona rural pasaron de {pc(d5['jefR'])} a {pc(d8['jefR'])}.",
              "Censos DANE 2005 y 2018"))
    c.append((peso(n, "pobreza_sis", s["pobP"] / 40), d1(s["pobP"]), "%", "de los hogares del SISBÉN vive en pobreza multidimensional.",
              "Son hogares con varias carencias a la vez en educación, salud, trabajo, vivienda o niñez.",
              "SISBÉN IV 2026, tablero del proyecto"))
    if e.get("n", 0) >= ECV_ROBUSTA:
        c.append((peso(n, "inseg", e["insegAny"] / 50), d1(e["insegAny"]), "%", "de los hogares encuestados reporta al menos una dificultad para alimentarse.",
                  f"Incluye preocupación por no tener comida, poca variedad o saltarse comidas. Encuesta de Calidad de Vida, {nf(e['n'])} hogares encuestados en el municipio.",
                  "Encuesta de Calidad de Vida, tablero del proyecto"))
    c.sort(key=lambda t: t[0], reverse=True)
    return c[0]

def agenda(n, f, s, d5, d8, e):
    sv = f.get("serv2018") or {}; ipm = f.get("ipm") or {}
    temas = []
    def add(score, titulo, ev, accion):
        temas.append((score, titulo, ev, accion))
    if f.get("envej2018"):
        add(peso(n, "envej", (f["envej2018"] - 40) / 80), "Cuidado de las personas mayores",
            f"Índice de envejecimiento de {d1(f['envej2018'])} en 2018 (era {d1(f['envej2005'])} en 2005).",
            "Centros día, cuidado en casa y apoyo a quienes cuidan, con prioridad para quienes viven solos.")
    add(peso(n, "uni_sis", (s["uni"] - 15) / 35), "Hogares de una sola persona",
        f"{pc(s['uni'])} de los hogares del SISBÉN y {pc(d8['dist'][0])} en el censo de 2018.",
        "Redes de acompañamiento, visitas periódicas y rutas de atención para quienes viven solos.")
    add(peso(n, "busca", s["ocup"][1] / 40), "Empleo e ingresos",
        f"{pc(s['ocup'][1])} de los jefes del SISBÉN busca trabajo; el ingreso promedio es de ${nf(s['ingr'])} mil al mes.",
        "Intermediación laboral, formación para el trabajo y apoyo a negocios locales.")
    add(peso(n, "oficios", s["ocup"][2] / 40), "Trabajo de cuidado sin pago",
        f"{pc(s['ocup'][2])} de los jefes del SISBÉN se dedica a oficios del hogar.",
        "Servicios de cuidado infantil y de personas mayores que liberen tiempo para estudiar o trabajar.")
    if IND[n]["caida_pob"] is not None and IND[n]["caida_pob"] > 0:
        add(peso(n, "caida_pob", IND[n]["caida_pob"] / 25), "Que la gente joven pueda quedarse",
            f"La población bajó {d1(IND[n]['caida_pob'])}% entre 2005 y 2018.",
            "Educación, empleo y vivienda para que los jóvenes encuentren razones para quedarse.")
    if IND[n]["crece_pob"] is not None and IND[n]["crece_pob"] >= 5:
        add(peso(n, "crece_pob", IND[n]["crece_pob"] / 25), "Crecer con servicios",
            f"La población aumentó {d1(IND[n]['crece_pob'])}% entre 2005 y 2018.",
            "Vivienda, transporte y servicios que acompañen la llegada de nuevas familias.")
    add(peso(n, "jef_cambio", d8["jefT"] / 55), "Jefas de hogar",
        f"{pc(d8['jefT'])} de los hogares tenía jefatura femenina en 2018; en el SISBÉN es {pc(s['jefF'])}.",
        "Prioridad para las jefas de hogar en programas de ingreso, cuidado y vivienda.")
    if ipm.get("rural") is not None:
        add(.5 * peso(n, "ipm_rural", ipm["rural"] / 55) + .5 * peso(n, "rural", s["rural"] / 70), "El campo",
            f"Pobreza multidimensional de {pc(ipm['rural'])} en la zona rural y {pc(ipm['cab'])} en la cabecera; {pc(s['rural'])} de los hogares del SISBÉN es rural.",
            "Llevar servicios, transporte y programas sociales a las veredas.")
    if sv.get("internet") is not None:
        add(peso(n, "internet_bajo", (100 - sv["internet"]) / 100 * .85), "Conectividad",
            f"Solo {pc(sv['internet'])} de los hogares tenía internet en 2018.",
            "Puntos de conexión en veredas y formación digital para jóvenes y personas mayores.")
    if sv.get("acueducto") is not None:
        add(peso(n, "acued_bajo", (100 - sv["acueducto"]) / 40), "Agua y saneamiento",
            f"Acueducto en {pc(sv['acueducto'])} y alcantarillado en {pc(sv.get('alcantarillado') or 0)} de los hogares (2018).",
            "Acueductos veredales y soluciones de saneamiento para la zona rural.")
    if e.get("n", 0) >= ECV_MIN:
        add(peso(n, "inseg", e["insegAny"] / 50) * (1 if e["n"] >= ECV_ROBUSTA else .85), "Alimentación",
            f"{pc(e['insegAny'])} de los hogares encuestados reporta dificultades para alimentarse (ECV, {nf(e['n'])} hogares).",
            "Huertas, mercados campesinos y apoyo alimentario focalizado.")
    add(peso(n, "disc", s["disc"] / 25), "Discapacidad",
        f"{pc(s['disc'])} de los hogares del SISBÉN tiene al menos una persona con discapacidad.",
        "Rehabilitación en la comunidad y apoyo a las familias que cuidan.")
    add(peso(n, "pobreza_sis", s["pobP"] / 40), "Pobreza multidimensional",
        f"{pc(s['pobP'])} de los hogares del SISBÉN tiene varias carencias a la vez.",
        "Atención integral que combine ingreso, educación, salud y vivienda en los mismos hogares.")
    temas.sort(key=lambda t: t[0], reverse=True)
    return temas[:5]

# ---------- página ----------
def pagina(m):
    n = m["nombre"]; slug = m["slug"]
    s = SIS[n]; d5 = DANE["d2005"][n]; d8 = DANE["d2018"][n]; f = FICH[n]; e = ECV.get(n, {"n": 0})
    ac = m["acento"]; aci = tinta_acento(ac)
    ac_tint = mix(ac, "#ffffff", .86); ac_deep = mix(ac, "#15191e", .55)
    foto = None; credito = None
    fx = FOTOS.get(n)
    if slug in FOTOS_FIJAS or fx == "keep":
        foto = META_ACT[slug]["photo"]; credito = "Wikimedia Commons"
    elif isinstance(fx, dict) and fx.get("url"):
        foto = fx["url"]; credito = f"{fx.get('author','')}, {fx.get('license','')}, Wikimedia Commons".strip(", ")
    sv5, sv8 = f.get("serv2005"), f.get("serv2018"); ipm = f.get("ipm") or {}
    ch, frase_pob = frase_poblacion(n, f)

    # ---- portada
    hero_bg = f"var(--ac-deep)"
    ph = f'<div class="ph" style="background-image:url(&quot;{esc(foto)}&quot;)" role="img" aria-label="Paisaje de {esc(n)}"></div>' if foto else ""
    portada = f'''
<header class="hero" id="inicio">
  {ph}
  <div class="wrap">
    <div class="eyebrow" data-r>{esc(m["sub"])} · Caldas</div>
    <h1 data-r="2">{esc(n)}</h1>
    <p data-r="3">{esc(m["bajada"])}</p>
    <a class="btn solid" href="#cifras" data-r="3">Leer el informe</a>
  </div>
</header>'''

    # ---- en cifras
    pob_txt = (f"En 2005 eran {nf(f['pob2005'])}." if f.get("pob2005") else "Población censada en 2018.")
    if ch is not None:
        pob_txt = f"{'Más' if ch > 0 else 'Menos'} que en 2005, cuando eran {nf(f['pob2005'])} ({'+' if ch > 0 else ''}{d1(ch)}%)."
    env_txt = (f"Personas de 65 años o más por cada 100 menores de 15. En 2005 era {d1(f['envej2005'])}." if f.get("envej2005") else "Personas de 65 años o más por cada 100 menores de 15.")
    cifras = f'''
<section class="s" id="cifras" aria-labelledby="t-cifras">
  <div class="wrap">
    <h2 id="t-cifras" data-r>{esc(n)} en cinco cifras</h2>
    <p class="lead" data-r="2">{frase_pob} {texto_resumen(n, f, s, d5, d8)}</p>
    <div class="cifras" data-r="2">
      <div class="cifra big"><div class="n" data-count="{f['pob2018']}">{nf(f['pob2018'])}</div><div class="k">Habitantes en 2018</div><div class="d">{pob_txt}</div></div>
      <div class="cifra"><div class="n">{d1(d8['tam'])}</div><div class="k">Personas por hogar</div><div class="d">Eran {d1(d5['tam'])} en 2005.</div></div>
      <div class="cifra"><div class="n">{d1(d8['jefT'])}<small style="font-size:.5em">%</small></div><div class="k">Hogares con jefa</div><div class="d">Eran {pc(d5['jefT'])} en 2005.</div></div>
      <div class="row2">
        <div class="cifra"><div class="n">{d1(f['envej2018']) if f.get('envej2018') else 's. d.'}</div><div class="k">Índice de envejecimiento</div><div class="d">{env_txt}</div></div>
        <div class="cifra"><div class="n">${nf(s['ingr'])} <small style="font-size:.42em;font-weight:700">mil</small></div><div class="k">Ingreso promedio del hogar al mes</div><div class="d">Entre los {nf(s['hog'])} hogares registrados en el SISBÉN IV.</div></div>
      </div>
    </div>
    <p class="src">Fuentes: fichas CNPV 2018 DANE (población y envejecimiento), censos DANE 2005 y 2018 y SISBÉN IV 2026 (tablero del proyecto).</p>
  </div>
</section>'''

    # ---- destacado
    sc, num, suf, h, txt, fuente = destacado(n, f, s, d5, d8, e)
    dest = f'''
<section class="s destacado" aria-labelledby="t-dest">
  <div class="wrap">
    <div class="big" data-r>{num}<small>{suf}</small></div>
    <h2 id="t-dest" data-r="2">{h}</h2>
    <p class="lead" data-r="3">{txt}</p>
    <p class="src">{fuente}</p>
  </div>
</section>'''

    # ---- hogares
    uni_ch = d8["dist"][0] - d5["dist"][0]; grandes05 = d5["dist"][4] + d5["dist"][5]; grandes18 = d8["dist"][4] + d8["dist"][5]
    hogares = f'''
<section class="s tint" id="hogares" aria-labelledby="t-hog">
  <div class="wrap">
    <h2 id="t-hog" data-r>Hogares más pequeños</h2>
    <p class="lead" data-r="2">Los hogares de 5 o más personas pasaron de <b>{pc(grandes05)}</b> a <b>{pc(grandes18)}</b>, mientras los de una y dos personas ganaron espacio. El hogar promedio bajó de {d1(d5['tam'])} a {d1(d8['tam'])} personas.</p>
    <div class="mt" data-r="2">{dos(svg_dumbbell(d5['dist'], d8['dist'], ac), svg_dumbbell(d5['dist'], d8['dist'], ac, 360))}</div>
    <div class="legend"><span><i style="background:var(--past)"></i>Censo 2005</span><span><i style="background:var(--ac)"></i>Censo 2018</span></div>
    <p class="src">Porcentaje de hogares según número de personas. Microdato censal DANE 2005 y 2018, tablero del proyecto.</p>
  </div>
</section>'''

    # ---- vivir solo
    solos = f'''
<section class="s" id="solos" aria-labelledby="t-solos">
  <div class="wrap split">
    <div>
      <h2 id="t-solos" data-r>{"Cada vez más personas viven solas" if uni_ch > 3 else "Vivir solo"}</h2>
      <p class="lead" data-r="2">Los hogares de una sola persona pasaron de <b>{pc(d5['dist'][0])}</b> en 2005 a <b>{pc(d8['dist'][0])}</b> en 2018. Entre los hogares del SISBÉN, que son los más vulnerables, llegan a <b>{pc(s['uni'])}</b>.</p>
      <p class="note" data-r="3">El SISBÉN no cubre a toda la población: registra a los hogares que buscan acceder a programas sociales. Por eso su cifra se lee aparte del censo y se dibuja con línea punteada.</p>
    </div>
    <div data-r="2">{svg_tres_puntos(d5['dist'][0], d8['dist'][0], s['uni'], 'Hogares de una persona')}
      <p class="src">Porcentaje de hogares de una persona. Censos DANE 2005 y 2018; SISBÉN IV 2026.</p>
    </div>
  </div>
</section>'''

    # ---- jefatura
    mxj = max(d5["jefU"], d8["jefU"], d5["jefR"], d8["jefR"], 1)
    jef_tit = "Más hogares encabezados por mujeres" if d8["jefT"] - d5["jefT"] >= 4 else "Quién encabeza el hogar"
    if d8["jefT"] < 30:
        jef_tit = "La jefatura sigue siendo, sobre todo, masculina"
    gap = d8["jefU"] - d8["jefR"]
    jef_brecha = (f"En la cabecera la jefatura femenina es mucho más común que en el campo ({pc(d8['jefU'])} frente a {pc(d8['jefR'])})." if gap >= 12
                  else f"En el campo creció con fuerza: pasó de {pc(d5['jefR'])} a {pc(d8['jefR'])}." if d8["jefR"] - d5["jefR"] >= 12
                  else f"Cabecera y zona rural muestran niveles parecidos ({pc(d8['jefU'])} y {pc(d8['jefR'])}).")
    jefatura = f'''
<section class="s tint" id="jefatura" aria-labelledby="t-jef">
  <div class="wrap">
    <h2 id="t-jef" data-r>{jef_tit}</h2>
    <p class="lead" data-r="2">En 2018, {pc(d8['jefT'])} de los hogares tenía a una mujer como jefa (en 2005 eran {pc(d5['jefT'])}), y {pc(100-d8['jefT'])} a un hombre. {jef_brecha} En el SISBÉN, las jefas son <b>{pc(s['jefF'])}</b>.</p>
    <div class="versus mt">
      <div class="vs" data-r="2"><h3>Cabecera</h3>
        <div class="pair"><span class="from">{pc(d5['jefU'])}</span><span class="arrow" aria-hidden="true">→</span><span class="to">{pc(d8['jefU'])}</span></div>
        <div class="bars">{barra(d5['jefU'], mxj, 'past')}{barra(d8['jefU'], mxj, 'now')}</div>
        <p class="cap">Hogares con jefa, 2005 y 2018</p></div>
      <div class="vs" data-r="3"><h3>Zona rural</h3>
        <div class="pair"><span class="from">{pc(d5['jefR'])}</span><span class="arrow" aria-hidden="true">→</span><span class="to">{pc(d8['jefR'])}</span></div>
        <div class="bars">{barra(d5['jefR'], mxj, 'past')}{barra(d8['jefR'], mxj, 'now')}</div>
        <p class="cap">Hogares con jefa, 2005 y 2018</p></div>
    </div>
    <div class="legend"><span><i class="sq" style="background:var(--past)"></i>Censo 2005</span><span><i class="sq" style="background:var(--ac)"></i>Censo 2018</span></div>
    <p class="src">Microdato censal DANE 2005 y 2018; SISBÉN IV 2026. Tablero del proyecto.</p>
  </div>
</section>'''

    # ---- edades
    m60_5, m60_8 = d5["edadAll"][4], d8["edadAll"][4]; ni5, ni8 = d5["edadAll"][0], d8["edadAll"][0]
    dep = f.get("dep2018")
    dep_txt = f" La razón de dependencia es de {d1(dep)} personas menores de 15 o mayores de 64 por cada 100 en edad de trabajar." if dep else ""
    tones = [mix(ac, "#ffffff", t) for t in (.82, .64, .44, .22, 0)]
    ley_ed = "".join(f'<span><i class="sq" style="background:{tones[i]}"></i>{lab}</span>' for i, lab in enumerate(["0 a 11", "12 a 17", "18 a 27", "28 a 59", "60 y más"]))
    edades = f'''
<section class="s" id="edades" aria-labelledby="t-edad">
  <div class="wrap">
    <h2 id="t-edad" data-r>Menos niños, más personas mayores</h2>
    <p class="lead" data-r="2">Las personas de 60 años o más pasaron de <b>{pc(m60_5)}</b> a <b>{pc(m60_8)}</b> de quienes viven en los hogares, y los niños de 0 a 11 años, de {pc(ni5)} a {pc(ni8)}.{dep_txt}</p>
    <div class="mt" data-r="2">{dos(svg_edades(d5['edadAll'], d8['edadAll'], ac), svg_edades(d5['edadAll'], d8['edadAll'], ac, 360))}</div>
    <div class="legend">{ley_ed}</div>
    <p class="src">Personas en los hogares censados según grupo de edad. Microdato censal DANE 2005 y 2018 (tablero); dependencia: ficha CNPV 2018.</p>
  </div>
</section>'''

    # ---- trabajo e ingreso (SISBÉN)
    oc_labs = ["Trabajando", "Buscando trabajo", "Oficios del hogar", "Estudiando", "Otra actividad"]
    orden = sorted(range(5), key=lambda i: -s["ocup"][i]); mxo = max(s["ocup"])
    filas = "".join(f'<div class="rk{" top" if j == 0 else ""}"><div class="lab"><span>{oc_labs[i]}</span><b>{pc(s["ocup"][i])}</b></div>{barra(s["ocup"][i], mxo, "")}</div>' for j, i in enumerate(orden))
    top = orden[0]
    trab_lead = {
        0: (f"En los hogares del SISBÉN, la mayoría de jefes y jefas está trabajando ({pc(s['ocup'][0])})" if s['ocup'][0] > 50 else f"En los hogares del SISBÉN, la actividad más común de jefes y jefas es trabajar ({pc(s['ocup'][0])})") + f". Aun así, el ingreso promedio del hogar es de <b>${nf(s['ingr'])} mil al mes</b>.",
        1: f"<b>{pc(s['ocup'][1])}</b> de los jefes de hogar del SISBÉN está buscando trabajo, más que quienes están trabajando ({pc(s['ocup'][0])}). El ingreso promedio es de ${nf(s['ingr'])} mil al mes.",
        2: f"<b>{pc(s['ocup'][2])}</b> de los jefes de hogar del SISBÉN se dedica a oficios del hogar: trabajo de cuidado sin pago. El ingreso promedio es de ${nf(s['ingr'])} mil al mes.",
        3: f"Una parte de los jefes de hogar del SISBÉN está estudiando ({pc(s['ocup'][3])}). El ingreso promedio es de ${nf(s['ingr'])} mil al mes.",
        4: f"{pc(s['ocup'][4])} de los jefes de hogar del SISBÉN reporta otra actividad, distinta de trabajar, buscar empleo, estudiar u oficios del hogar. Le siguen quienes están trabajando ({pc(s['ocup'][0])}). El ingreso promedio del hogar es de <b>${nf(s['ingr'])} mil al mes</b>.",
    }[top]
    gi = s["gIngr"]; imin = min(range(6), key=lambda i: gi[i])
    ing_txt = f"Los hogares de {'una persona' if imin == 0 else str(imin+1) + (' o más personas' if imin == 5 else ' personas')} son los de menor ingreso: ${nf(gi[imin])} mil al mes en promedio."
    if s["hog"] < 1000:
        ing_txt += f" El registro es pequeño ({nf(s['hog'])} hogares), así que estas cifras se leen con cautela."
    trabajo = f'''
<section class="s tint" id="trabajo" aria-labelledby="t-trab">
  <div class="wrap">
    <h2 id="t-trab" data-r>El trabajo y el ingreso del hogar</h2>
    <p class="lead" data-r="2">{trab_lead}</p>
    <div class="split mt">
      <div data-r="2"><h3 style="font-size:19px;margin-bottom:18px">Actividad principal del jefe o jefa de hogar</h3><div class="ranked">{filas}</div></div>
      <div data-r="3"><h3 style="font-size:19px;margin-bottom:6px">Ingreso promedio según tamaño del hogar</h3><p class="note" style="margin:0 0 10px">Miles de pesos al mes, por número de personas.</p>{svg_columnas(gi, ac, imin)}<p class="note">{ing_txt}</p></div>
    </div>
    <p class="src">SISBÉN IV 2026, {nf(s['hog'])} hogares registrados. Tablero del proyecto.</p>
  </div>
</section>'''

    # ---- vulnerabilidad (bento)
    fotocell = (f'<div class="cell photo wide" style="background-image:url(&quot;{esc(foto)}&quot;)"><div class="n">{pc(s["rural"])}</div><div class="k">de los hogares del SISBÉN vive en la zona rural</div></div>'
                if foto else f'<div class="cell dark wide"><div class="n">{pc(s["rural"])}</div><div class="k">de los hogares del SISBÉN vive en la zona rural</div></div>')
    vuln = f'''
<section class="s" id="vulnerabilidad" aria-labelledby="t-vul">
  <div class="wrap">
    <h2 id="t-vul" data-r>A quién llegar primero</h2>
    <p class="lead" data-r="2">El SISBÉN muestra qué carencias se concentran en los hogares más vulnerables del municipio y cuántos reciben hoy algún apoyo.</p>
    <div class="bento" data-r="2">
      <div class="cell a"><div class="n">{pc(s['pobP'])}</div><div class="k">de los hogares del SISBÉN vive en <b>pobreza multidimensional</b>: varias carencias a la vez en educación, salud, trabajo o vivienda.</div></div>
      <div class="cell"><div class="n">{pc(s['disc'])}</div><div class="k">tiene al menos una persona con discapacidad</div></div>
      <div class="cell"><div class="n">{pc(s['alfP'])}</div><div class="k">tiene personas que no saben leer ni escribir</div></div>
      {fotocell}
      <div class="cell"><div class="n">{pc(s['hacP'])}</div><div class="k">vive en hacinamiento crítico</div></div>
      <div class="cell"><div class="n">{pc(s['colm'])}</div><div class="k">recibe Colombia Mayor</div></div>
      <div class="cell"><div class="n">{pc(s['fam'])}</div><div class="k">recibe Familias en Acción</div></div>
      <div class="cell"><div class="n">{pc(s['jefF'])}</div><div class="k">tiene a una mujer como jefa</div></div>
    </div>
    <p class="src">Porcentaje de hogares registrados en el SISBÉN IV 2026. Tablero del proyecto.</p>
  </div>
</section>'''

    # ---- ECV
    ecv = ""
    if e.get("n", 0) >= ECV_MIN:
        aviso = (f'<span class="caveat">Muestra de {nf(e["n"])} hogares encuestados en el municipio: cifras indicativas, con margen de error amplio.</span>'
                 if e["n"] < ECV_ROBUSTA else f'<span class="caveat">{nf(e["n"])} hogares encuestados en el municipio.</span>')
        items = [(e["pobre"], "de los hogares se considera pobre"), (e["ingNoAlcanza"], "dice que sus ingresos no alcanzan para los gastos mínimos"),
                 (e["insegAny"], "reporta al menos una dificultad para alimentarse"), (e["satisAlta"], "está muy satisfecho con su vida (8 a 10 de 10)")]
        wf = "".join(f'<div class="wf" data-r="{2 + i % 2}">{waffle(v)}<div class="n">{pc(v)}</div><div class="k">{k}</div></div>' for i, (v, k) in enumerate(items))
        ecv = f'''
<section class="s tint" id="voz" aria-labelledby="t-ecv">
  <div class="wrap">
    <h2 id="t-ecv" data-r>Lo que dicen los propios hogares</h2>
    <p class="lead" data-r="2">La Encuesta de Calidad de Vida pregunta a las familias cómo perciben su situación. Sus respuestas complementan los registros administrativos.</p>
    {aviso}
    <div class="waffles">{wf}</div>
    <p class="src">Encuesta de Calidad de Vida (módulo del tablero del proyecto). Cada cuadrícula representa 100 hogares.</p>
  </div>
</section>'''

    # ---- territorio
    ipm_txt = ""
    if ipm.get("total") is not None:
        brecha = (ipm["rural"] / ipm["cab"]) if ipm.get("cab") else None
        ipm_txt = f"La pobreza multidimensional censal fue de <b>{pc(ipm['total'])}</b> en 2018: {pc(ipm['cab'])} en la cabecera y <b>{pc(ipm['rural'])}</b> en la zona rural" + (f", {d1(brecha)} veces más." if brecha and brecha >= 1.3 else ".")
    priv = ipm.get("priv") or []
    priv_html = ""
    if priv:
        mxp = max(p[1] for p in priv)
        priv_html = '<h3 style="font-size:19px;margin:0 0 18px">Privaciones más extendidas (IPM 2018)</h3><div class="ranked">' + "".join(
            f'<div class="rk{" top" if j == 0 else ""}"><div class="lab"><span>{esc(p[0])}</span><b>{pc(p[1])}</b></div>{barra(p[1], mxp, "")}</div>' for j, p in enumerate(priv[:5])) + "</div>"
    net = (sv8 or {}).get("internet")
    nom = {"energia": "energía", "acueducto": "acueducto", "alcantarillado": "alcantarillado", "gas": "gas natural"}
    sube = [nom[k] for k in nom if sv5 and sv8 and sv5.get(k) is not None and sv8.get(k) is not None and sv8[k] - sv5[k] >= 3]
    baja = [nom[k] for k in nom if sv5 and sv8 and sv5.get(k) is not None and sv8.get(k) is not None and sv5[k] - sv8[k] >= 3]
    yj = lambda L: L[0] if len(L) == 1 else ", ".join(L[:-1]) + " y " + L[-1]
    serv_lead = ""
    if sube: serv_lead += f"Entre 2005 y 2018 aumentó la cobertura de {yj(sube)}. "
    if baja: serv_lead += f"La de {yj(baja)} bajó entre los dos censos. "
    if net is not None: serv_lead += f"En 2018, {pc(net)} de los hogares tenía internet."
    territorio = f'''
<section class="s" id="territorio" aria-labelledby="t-ter">
  <div class="wrap">
    <h2 id="t-ter" data-r>Servicios y pobreza en el territorio</h2>
    <p class="lead" data-r="2">{ipm_txt} {serv_lead}</p>
    <div class="split mt">
      <div data-r="2"><h3 style="font-size:19px;margin-bottom:12px">Servicios en la vivienda</h3>{svg_servicios(sv5, sv8)}
        <div class="legend"><span><i style="background:var(--past)"></i>2005</span><span><i style="background:var(--ac)"></i>2018</span></div></div>
      <div data-r="3">{priv_html}</div>
    </div>
    <p class="src">Fichas CNPV 2018 DANE (servicios) e Índice de Pobreza Multidimensional censal 2018, DANE. El censo de 2005 no midió internet.</p>
  </div>
</section>'''

    # ---- contexto
    contexto = f'''
<section class="s tint" id="contexto" aria-labelledby="t-ctx">
  <div class="wrap">
    <div class="ctx" data-r>
      <div class="img" {f'style="background-image:url(&quot;{esc(foto)}&quot;)"' if foto else ''} role="img" aria-label="Paisaje de {esc(n)}"></div>
      <div class="txt"><h2 id="t-ctx" style="font-size:clamp(28px,3.4vw,40px)">De qué vive {esc(n)}</h2><p>{m['econ']}</p></div>
    </div>
  </div>
</section>'''

    # ---- agenda
    ag = agenda(n, f, s, d5, d8, e)
    li = "".join(f'<li data-r="{2 + i % 2}"><h3>{esc(t)}</h3><p class="ev">{ev}</p><p class="ac">{a}</p></li>' for i, (_, t, ev, a) in enumerate(ag))
    agenda_html = f'''
<section class="s" id="agenda" aria-labelledby="t-ag">
  <div class="wrap">
    <h2 id="t-ag" data-r>Prioridades para la política pública</h2>
    <p class="lead" data-r="2">Ordenadas según el peso que tiene cada tema en los datos de {esc(n)}. Cada una indica la evidencia y una línea de acción.</p>
    <ol class="agenda">{li}</ol>
  </div>
</section>'''

    # ---- fuentes
    foto_cred = f"<details><summary>Fotografía</summary><p>{esc(credito)}.</p></details>" if credito else ""
    fuentes = f'''
<section class="s tint" id="fuentes" aria-labelledby="t-fu">
  <div class="wrap">
    <h2 id="t-fu" style="font-size:clamp(26px,3vw,34px)">Fuentes y notas</h2>
    <div class="fuentes">
      <details><summary>Censos DANE 2005 y 2018</summary><p>Microdato censal integrado en el tablero del proyecto. Tamaño y tipo de hogar, jefatura por zona, discapacidad y edades de las personas en los hogares. El tablero registra hasta seis integrantes por hogar.</p></details>
      <details><summary>Fichas CNPV 2018 e IPM 2018</summary><p>Población censada 2005 y 2018, índice de envejecimiento, razón de dependencia y servicios de la vivienda (DANE). Índice de Pobreza Multidimensional censal 2018 por cabecera y zona rural.</p></details>
      <details><summary>SISBÉN IV 2026</summary><p>Hogares registrados en el SISBÉN IV del municipio, según el tablero publicado del proyecto. No representa a toda la población: reúne a los hogares que buscan acceder a programas sociales.</p></details>
      <details><summary>Encuesta de Calidad de Vida</summary><p>Módulo ECV del tablero del proyecto. {"Para este municipio la muestra es de " + nf(e["n"]) + " hogares." if e.get("n", 0) else "Para este municipio no hay hogares encuestados, por eso la historia no incluye esta fuente."} Con menos de {ECV_MIN} hogares no se presentan resultados municipales; entre {ECV_MIN} y {ECV_ROBUSTA - 1} se presentan como indicativos.</p></details>
      {foto_cred}
      <details><summary>Cómo citar</summary><p>Proyecto Dinámicas Familiares, Universidad de Caldas (2026). Historia municipal de {esc(n)}. johanpina.github.io/proyecto_dinamicas_familiares</p></details>
    </div>
    <p class="note" style="margin-top:28px"><a href="dashboard_comparativa_hogares.html">Explorar los datos en el tablero interactivo</a></p>
  </div>
</section>'''

    opts = "".join(f'<option value="historia_{x["slug"]}.html"{" selected" if x["slug"] == slug else ""}>{esc(x["nombre"])}</option>' for x in sorted(MUNICIPIOS, key=lambda x: x["slug"]))
    pills = "".join(f'<a href="historia_{x["slug"]}.html"{" aria-current=\"page\"" if x["slug"] == slug else ""}>{esc(x["nombre"])}</a>' for x in sorted(MUNICIPIOS, key=lambda x: x["slug"]))
    desc = f"{n}: cómo han cambiado las familias entre 2005 y 2026. {m['bajada']}"
    preload = f'<link rel="preload" as="image" href="{esc(foto)}">' if foto else ""

    return f'''<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{esc(n)} · Dinámicas familiares en Caldas</title>
<meta name="description" content="{esc(desc)}">
<meta property="og:title" content="{esc(n)} · Dinámicas familiares en Caldas">
<meta property="og:description" content="{esc(m['bajada'])}">
{f'<meta property="og:image" content="{esc(foto)}">' if foto else ''}
<meta name="theme-color" content="{ac_deep}">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Public+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
{preload}
<style>
{CSS}
:root{{--ac:{ac};--ac-ink:{aci};--ac-tint:{ac_tint};--ac-deep:{ac_deep};--hero-bg:{ac_deep}}}
</style>
</head>
<body>
<a class="skip" href="#cifras">Saltar al contenido</a>
<div class="top">
  <div class="wrap">
    <a class="home" href="familias.html">Dinámicas familiares <span>· Caldas</span></a>
    <div class="sp"></div>
    <label for="mpio">Municipio</label>
    <select id="mpio" onchange="location.href=this.value">{opts}</select>
    <button class="btn ghost pdf" type="button" onclick="window.print()">Guardar PDF</button>
  </div>
  <div class="progress" aria-hidden="true"></div>
</div>
<main>
{portada}
{cifras}
{dest}
{hogares}
{solos}
{jefatura}
{edades}
{trabajo}
{vuln}
{ecv}
{territorio}
{contexto}
{agenda_html}
{fuentes}
</main>
<footer>
  <div class="wrap">
    <h2>Otras historias de Caldas</h2>
    <nav class="mpios" aria-label="Historias por municipio">{pills}</nav>
    <div class="fin"><span>Proyecto Dinámicas Familiares · Universidad de Caldas · 2026</span><a href="familias.html">Volver a la portada</a><a href="index.html">Tableros</a></div>
  </div>
</footer>
<script>
document.documentElement.classList.add("js");
(function(){{
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var els = document.querySelectorAll("[data-r], section.s");
  if (reduce || !("IntersectionObserver" in window)) {{ els.forEach(function(e){{ e.classList.add("in"); }}); return; }}
  var io = new IntersectionObserver(function(entries){{
    entries.forEach(function(en){{ if (en.isIntersecting) {{ en.target.classList.add("in"); io.unobserve(en.target); }} }});
  }}, {{ rootMargin: "0px 0px -12% 0px", threshold: 0.12 }});
  els.forEach(function(e){{ io.observe(e); }});
  requestAnimationFrame(function(){{ document.querySelectorAll(".hero [data-r]").forEach(function(e){{ e.classList.add("in"); }}); }});
  window.addEventListener("beforeprint", function(){{ els.forEach(function(e){{ e.classList.add("in"); }}); }});
}})();
</script>
</body>
</html>
'''

def texto_resumen(n, f, s, d5, d8):
    partes = []
    if d8["tam"] < d5["tam"]:
        partes.append(f"Los hogares son más pequeños ({d1(d5['tam'])} a {d1(d8['tam'])} personas)")
    if d8["jefT"] > d5["jefT"] + 3:
        partes.append(f"más hogares tienen a una mujer como jefa ({pc(d8['jefT'])})")
    if f.get("envej2018") and f.get("envej2005"):
        partes.append(f"y la población envejece: el índice de envejecimiento pasó de {d1(f['envej2005'])} a {d1(f['envej2018'])}")
    if not partes:
        return ""
    t = ", ".join(partes) + "."
    return t.replace(", y la", " y la")

def foto_de(m):
    fx = FOTOS.get(m["nombre"])
    if m["slug"] in FOTOS_FIJAS or fx == "keep":
        return META_ACT[m["slug"]]["photo"]
    if isinstance(fx, dict) and fx.get("url"):
        return fx["url"]
    return None

def portada():
    def agg(y, k):
        D_ = DANE[y]; H = sum(D_[n]["hog"] for n in NOMBRES)
        return sum(D_[n]["hog"] * D_[n][k] for n in NOMBRES) / H
    def agg_dist(y, i):
        D_ = DANE[y]; H = sum(D_[n]["hog"] for n in NOMBRES)
        return sum(D_[n]["hog"] * D_[n]["dist"][i] for n in NOMBRES) / H
    tam05, tam18 = agg("d2005", "tam"), agg("d2018", "tam")
    uni05, uni18 = agg_dist("d2005", 0), agg_dist("d2018", 0)
    jef05, jef18 = agg("d2005", "jefT"), agg("d2018", "jefT")
    subs = ["Norte", "Alto Occidente", "Bajo Occidente", "Centro Sur", "Alto Oriente", "Magdalena Caldense"]
    fotos = [foto_de(m) for m in MUNICIPIOS if foto_de(m)]
    mos = "".join(f'<div style="background-image:url(&quot;{esc(u)}&quot;)" role="img" aria-label="Paisaje de Caldas"></div>' for u in fotos[:5]) if len(fotos) >= 5 else ""
    tarjetas = []
    for m in sorted(MUNICIPIOS, key=lambda x: (subs.index(x["sub"]), x["slug"])):
        n = m["nombre"]; d8 = DANE["d2018"][n]; f = FICH[n]; u = foto_de(m)
        ac = m["acento"]
        im = (f'<div class="im" style="background-image:url(&quot;{esc(u)}&quot;)"></div>' if u
              else f'<div class="im" style="background:{mix(ac, "#15191e", .35)}"></div>')
        tarjetas.append(f'''<a class="tj" href="historia_{m['slug']}.html" data-sub="{esc(m['sub'])}">{im}<div class="bd">
<div class="sb">{esc(m['sub'])}</div><h3>{esc(n)}</h3><p>{esc(m['bajada'])}</p>
<dl><div><dt>Personas por hogar</dt><dd>{d1(d8['tam'])}</dd></div><div><dt>Hogares con jefa</dt><dd>{pc(d8['jefT'])}</dd></div><div><dt>Envejecimiento</dt><dd>{d1(f['envej2018']) if f.get('envej2018') else 's. d.'}</dd></div></dl>
</div></a>''')
    botones = '<button type="button" aria-pressed="true" data-f="">Todas</button>' + "".join(f'<button type="button" aria-pressed="false" data-f="{esc(x)}">{esc(x)}</button>' for x in subs)
    ac = "#2f6690"; css_vars = f":root{{--ac:{ac};--ac-ink:{tinta_acento(ac)};--ac-tint:{mix(ac,'#ffffff',.86)};--ac-deep:{mix(ac,'#15191e',.55)}}}"
    return f'''<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Dinámicas familiares en Caldas</title>
<meta name="description" content="Historias de datos sobre cómo han cambiado las familias en los 27 municipios de Caldas, con censos DANE 2005 y 2018, SISBÉN IV 2026 y la Encuesta de Calidad de Vida.">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Public+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
{CSS}
{css_vars}
</style>
</head>
<body>
<a class="skip" href="#historias">Saltar a las historias</a>
<div class="top"><div class="wrap"><a class="home" href="index.html">Dinámicas familiares <span>· Caldas</span></a><div class="sp"></div><a class="btn ghost" href="dashboard_comparativa_hogares.html">Tablero</a></div></div>
<main>
<header class="intro">
  <div class="wrap">
    <div class="eyebrow">Universidad de Caldas · 2026</div>
    <h1>Cómo cambian las familias en Caldas</h1>
    <p class="lead">Una historia por municipio, con datos oficiales, para orientar decisiones de política pública sobre familia y cuidado.</p>
    <div class="mosaico">{mos}</div>
  </div>
</header>
<section class="s" aria-labelledby="t-caldas">
  <div class="wrap">
    <h2 id="t-caldas">Lo que cambió entre 2005 y 2018</h2>
    <div class="cifras">
      <div class="cifra big"><div class="n">{d1(tam05)} → {d1(tam18)}</div><div class="k">Personas por hogar</div><div class="d">Promedio de los 27 municipios, ponderado por número de hogares.</div></div>
      <div class="cifra"><div class="n">{pc(uni18)}</div><div class="k">Hogares de una persona</div><div class="d">Eran {pc(uni05)} en 2005.</div></div>
      <div class="cifra"><div class="n">{pc(jef18)}</div><div class="k">Hogares con jefa</div><div class="d">Eran {pc(jef05)} en 2005.</div></div>
    </div>
    <p class="src">Microdato censal DANE 2005 y 2018, tablero del proyecto.</p>
  </div>
</section>
<section class="s tint" id="historias" aria-labelledby="t-hist">
  <div class="wrap">
    <h2 id="t-hist">Historias por municipio</h2>
    <p class="lead">Cada historia sigue los mismos temas, hogares, jefatura, envejecimiento, trabajo y servicios, y termina con prioridades de política pública ordenadas según los datos del municipio.</p>
    <div class="filtros" role="group" aria-label="Filtrar por subregión">{botones}</div>
    <div class="tarjetas">{"".join(tarjetas)}</div>
  </div>
</section>
<section class="s" aria-labelledby="t-tab">
  <div class="wrap">
    <h2 id="t-tab">Los datos completos</h2>
    <div class="tableros">
      <a href="dashboard_comparativa_hogares.html"><b>Tablero comparativo de hogares</b><span>SISBÉN IV 2026, censos DANE 2005 y 2018 y Encuesta de Calidad de Vida, con filtros por municipio.</span></a>
      <a href="index.html"><b>Todos los tableros del proyecto</b><span>Versiones anteriores, SIVIGILA y el panel del Eje Cafetero.</span></a>
    </div>
  </div>
</section>
</main>
<footer><div class="wrap"><h2>Proyecto Dinámicas Familiares</h2><div class="fin"><span>Universidad de Caldas · 2026</span><a href="https://github.com/johanpina/proyecto_dinamicas_familiares">Repositorio en GitHub</a></div></div></footer>
<script>
(function(){{
  var bs = document.querySelectorAll(".filtros button"), cs = document.querySelectorAll(".tj");
  bs.forEach(function(b){{ b.addEventListener("click", function(){{
    var f = b.getAttribute("data-f");
    bs.forEach(function(x){{ x.setAttribute("aria-pressed", x === b ? "true" : "false"); }});
    cs.forEach(function(c){{ c.hidden = !!f && c.getAttribute("data-sub") !== f; }});
  }}); }});
}})();
</script>
</body>
</html>
'''

def main():
    for m in MUNICIPIOS:
        out = os.path.join(RAIZ, f"historia_{m['slug']}.html")
        with open(out, "w", encoding="utf-8") as fh:
            fh.write(pagina(m))
    with open(os.path.join(RAIZ, "familias.html"), "w", encoding="utf-8") as fh:
        fh.write(portada())
    print(f"{len(MUNICIPIOS)} historias generadas + familias.html")

if __name__ == "__main__":
    main()
