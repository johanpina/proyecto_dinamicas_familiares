/* ============================================================================
   Panel — Clasificación de las entrevistas por módulo
   ----------------------------------------------------------------------------
   Todos los módulos de la entrevista en una sola pantalla, uno debajo del
   otro, cada uno con su diagrama de Sankey:

     con reglas:  Entrevistas → respondieron / no → confianza de la IA
                  → propuesta de la IA → categoría final
     sin reglas:  Entrevistas → respondieron / no → «sin reglas aún»

   El color de cada cinta es la propuesta de la IA y se mantiene de punta a
   punta; una cinta que llega a una categoría de otro color fue movida por el
   equipo. Un punto por entrevista recorre su camino. La primera vez que un
   módulo aparece en pantalla los contadores arrancan en cero y suben a medida
   que llegan los puntos, hasta el valor final; después los puntos siguen
   circulando (se puede pausar; nada se mueve si el sistema pide reducir el
   movimiento). Al filtrar, cintas y números cambian de forma gradual.

   Al tocar una cinta o una categoría se listan sus entrevistas debajo de ese
   módulo; cada tarjeta se arrastra a una categoría de la columna final para
   reclasificarla, o se toca para abrir su ficha.
   Usa api(), aviso(), esc(), $, $$ y verDetalle() de panel.js.
   ========================================================================== */

const Clasificacion = (() => {
  const NS = "http://www.w3.org/2000/svg";
  const ANCHO_NODO = 16, HUECO = 14, UMBRAL_ARRASTRE = 6, DURACION = 650;
  const sinMovimiento = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let info = null;          // /api/dimensiones: módulos, entrevistas y quién respondió cada módulo
  const datos = {};         // clave del módulo → {filas} de los módulos con reglas
  const diagramas = {};     // clave del módulo → diagrama dibujado
  let dim = null, filas = [];   // módulo con el que se está trabajando (lista, ficha, mover, IA)
  let ia = {disponible:false, modelo:""};
  let corriendo = false;    // clasificación por lotes en curso: {clave, modo}
  let cargada = false;
  let seleccion = null;     // {dim, tipo:"enlace"|"nodo", clave}
  let pausado = false;
  try{ pausado = localStorage.getItem("uc_sankey_pausa") === "1"; }catch(e){}

  /* ------------------------------ utilidades ------------------------------ */

  function el(tag, attrs = {}, padre){
    const n = document.createElementNS(NS, tag);
    poner(n, attrs);
    if(padre) padre.appendChild(n);
    return n;
  }
  function poner(n, attrs){
    for(const [k, v] of Object.entries(attrs)){
      if(v == null) n.removeAttribute(k); else n.setAttribute(k, v);
    }
  }
  const dimDe = clave => info?.dimensiones.find(x => x.clave === clave);
  const dimAbierta = () => dimDe(dim);
  const plural = (n, s, p) => `${n} ${n === 1 ? s : (p || s + "s")}`;
  const corto = nombre => nombre.split(" (")[0];          // «Cuidado indirecto (trabajo doméstico)» → «Cuidado indirecto»
  const suave = t => t < .5 ? 4*t*t*t : 1 - Math.pow(-2*t + 2, 3) / 2;

  /* Color fijo por posición de la categoría en su módulo; «sin información» es neutra */
  function colorDe(d, clave){
    if(!clave || clave === "pend" || clave === "sin" || clave === "x") return "var(--borde-2)";
    if(clave === "sin_info") return "var(--cat-neutro)";
    const i = d.categorias.filter(c => c.clave !== "sin_info").findIndex(c => c.clave === clave);
    return `var(--cat-${Math.min(i + 1, 3)})`;
  }
  const nombreCat = (d, clave) => (d.categorias.find(c => c.clave === clave) || {}).nombre || "Por clasificar";

  function estadoDe(f){
    const c = f.clasificacion;
    if(!c) return "pendiente";
    if(c.categoria_final && c.categoria_ia && c.categoria_final !== c.categoria_ia) return "movida";
    if(c.categoria_final) return "equipo";
    return "ia";
  }
  const ETIQUETA_ESTADO = {pendiente:"Por clasificar", ia:"Propuesta de la IA", equipo:"Revisada por el equipo",
                           movida:"Movida por el equipo"};

  /* Los filtros valen para todos los módulos */
  const filtros = () => ({m: $("#cl-municipio").value, r: $("#cl-revision").value, k: $("#cl-confianza").value});
  function filtrarFilas(lista){
    const {m, r, k} = filtros();
    return lista.filter(f => (!m || f.municipio === m) && (!r ||
      (r === "vieja" ? !!f.clasificacion?.desactualizada : estadoDe(f) === r)) &&
      (!k || f.clasificacion?.confianza === k));
  }
  /* Entrevistas sin clasificación que entran al diagrama de un módulo: las que no
     lo respondieron y, en los módulos sin reglas, todas. Los filtros de revisión y
     de confianza las dejan por fuera porque no tienen esos datos. */
  function filtrarSueltas(lista){
    const {m, r, k} = filtros();
    if(r || k) return [];
    return lista.filter(f => !m || f.municipio === m);
  }

  function renglones(t, max){
    const salida = []; let linea = "";
    for(const p of t.split(" ")){
      if(linea && (linea + " " + p).length > max){ salida.push(linea); linea = p; }
      else linea = linea ? linea + " " + p : p;
    }
    if(linea) salida.push(linea);
    return salida;
  }
  const coloresResueltos = {};
  function colorReal(c){
    if(!c.startsWith("var(")) return c;
    if(!coloresResueltos[c]) coloresResueltos[c] =
      getComputedStyle(document.body).getPropertyValue(c.slice(4, -1)).trim() || "#888";
    return coloresResueltos[c];
  }

  /* --------------------------------- datos --------------------------------- */

  async function cargar(){
    info = await api("/dimensiones");
    ia = info.ia;
    const activas = info.dimensiones.filter(d => d.activa);
    await Promise.all(activas.map(async d => {
      const r = await api("/clasificaciones/" + d.clave);
      datos[d.clave] = {filas: r.entrevistas};
      ia = r.ia;
    }));
    trabajarEn(dim && datos[dim] ? dim : (activas[0]?.clave || null));
    const municipios = [...new Set(info.entrevistas.map(f => f.municipio).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es"));
    const sel = $("#cl-municipio"), antes = sel.value;
    sel.innerHTML = `<option value="">Todos los municipios</option>` +
      municipios.map(m => `<option value="${esc(m)}">${esc(m)}</option>`).join("");
    if(municipios.includes(antes)) sel.value = antes;
  }
  /* Fija el módulo con el que se trabaja: lo usan la lista, la ficha, mover y la IA */
  function trabajarEn(clave){
    dim = clave;
    filas = clave && datos[clave] ? datos[clave].filas : [];
  }
  function reemplazarFila(nueva, clave = dim){
    const lista = datos[clave]?.filas; if(!lista) return;
    const i = lista.findIndex(f => f.id === nueva.id);
    if(i >= 0) lista[i] = nueva; else lista.push(nueva);
    if(clave === dim) filas = lista;
  }

  async function abrir(){
    if(!cargada){ conectar(); cargada = true; }
    try{
      await cargar();
      pintar(true);
    }catch(e){ aviso(e.message); }
    arrancarParticulas();
  }

  /* ============================== motor del Sankey ==============================
     columnas: [[{clave, etiqueta, n, color, punteado, minimo, destino, lado, maxCar, ids}]]
     enlaces:  [{clave, de, a, n, color, ids, cambio, orden}]                      */

  function disponer({columnas, enlaces, xs, arriba, alto}){
    const total = Math.max(1, ...columnas.map(c => c.reduce((s, n) => s + n.n, 0)));
    const masNodos = Math.max(...columnas.map(c => c.length));
    // Cada nodo ocupa al menos el alto de su etiqueta, para que las categorías
    // pequeñas no se monten una sobre otra. La escala se ajusta para que quepa.
    const espacio = n => (renglones(n.etiqueta, n.maxCar || 30).length + 1) * 17 + 6;
    const libre = alto - arriba - 12 - HUECO * (masNodos - 1);
    let k = Math.max(0.3, libre / total);
    for(let i = 0; i < 4; i++){
      const extra = Math.max(...columnas.map(c => c.reduce((s, n) => s + Math.max(0, espacio(n) - Math.max(n.n * k, n.minimo || 0)), 0)));
      k = Math.max(0.3, (libre - extra) / total);
    }
    const nodos = {};
    columnas.forEach((col, ci) => {
      let y = arriba;
      col.forEach((n, i) => {
        const h = Math.max(n.n * k, n.minimo || 0), bloque = Math.max(h, espacio(n));
        nodos[n.clave] = {...n, x: xs[ci], y: y + (bloque - h) / 2, h, col: ci, orden: i, sale: 0, entra: 0};
        y += bloque + HUECO;
      });
    });
    const lista = enlaces.filter(e => e.n > 0 && nodos[e.de] && nodos[e.a]).map(e => ({...e, w: e.n * k}));
    // Dentro de cada nodo las cintas se apilan por destino (u origen) y luego por
    // propuesta de la IA, para que crucen lo menos posible
    [...lista].sort((a, b) => nodos[a.a].orden - nodos[b.a].orden || a.orden - b.orden).forEach(e => {
      const n = nodos[e.de]; e.sy = n.y + n.sale; n.sale += e.w;
    });
    [...lista].sort((a, b) => nodos[a.de].orden - nodos[b.de].orden || a.orden - b.orden).forEach(e => {
      const n = nodos[e.a]; e.ty = n.y + n.entra; n.entra += e.w;
    });
    const salida = {};
    lista.forEach(e => { salida[e.clave] = {...e, x0: nodos[e.de].x + ANCHO_NODO, x1: nodos[e.a].x, col: nodos[e.de].col}; });
    return {nodos, enlaces: salida};
  }

  function cinta(x0, sy, x1, ty, w){
    const xm = (x0 + x1) / 2;
    return `M${x0},${sy}C${xm},${sy} ${xm},${ty} ${x1},${ty}L${x1},${ty + w}C${xm},${ty + w} ${xm},${sy + w} ${x0},${sy + w}Z`;
  }
  /* La cinta pintada solo hasta la fracción f (0–1) de su largo: se corta la curva
     con de Casteljau, así el borde de la pintura sigue exactamente la curva */
  function cintaParcial(e, w, f){
    if(f >= .999) return cinta(e.x0, e.sy, e.x1, e.ty, w);
    const xm = (e.x0 + e.x1) / 2;
    const corte = (y0, y1) => {
      const P = [[e.x0, y0], [xm, y0], [xm, y1], [e.x1, y1]];
      const l = (a, b) => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
      const a = l(P[0], P[1]), b = l(P[1], P[2]), c = l(P[2], P[3]), ab = l(a, b), bc = l(b, c);
      return [P[0], a, ab, l(ab, bc)];
    };
    const [A0, A1, A2, A3] = corte(e.sy, e.ty), [B0, B1, B2, B3] = corte(e.sy + w, e.ty + w);
    const p = q => `${q[0].toFixed(1)},${q[1].toFixed(1)}`;
    return `M${p(A0)}C${p(A1)} ${p(A2)} ${p(A3)}L${p(B3)}C${p(B2)} ${p(B1)} ${p(B0)}Z`;
  }

  /* Punto de la curva a una altura relativa `u` (0–1) del grosor de la cinta, en t (0–1) */
  function puntoEn(e, u, t){
    const y0 = e.sy + u * e.w, y1 = e.ty + u * e.w, xm = (e.x0 + e.x1) / 2, s = 1 - t;
    return {x: s*s*s*e.x0 + 3*s*s*t*xm + 3*s*t*t*xm + t*t*t*e.x1, y: s*s*s*y0 + 3*s*s*t*y0 + 3*s*t*t*y1 + t*t*t*y1};
  }

  /* Interpola dos geometrías; también los números, para que cambien de a poco */
  function mezclar(a, b, t){
    const lerp = (p, q) => p + (q - p) * t;
    const nodos = {}, enlaces = {};
    for(const k of new Set([...Object.keys(a.nodos), ...Object.keys(b.nodos)])){
      const p = a.nodos[k], q = b.nodos[k], base = q || p;
      nodos[k] = {...base, y: lerp(p ? p.y : q.y + q.h / 2, q ? q.y : p.y + p.h / 2), h: lerp(p ? p.h : 0, q ? q.h : 0),
        mostrar: Math.round(lerp(p ? (p.mostrar ?? p.n) : 0, q ? q.n : 0)), opacidad: p && q ? 1 : (q ? t : 1 - t)};
    }
    for(const k of new Set([...Object.keys(a.enlaces), ...Object.keys(b.enlaces)])){
      const p = a.enlaces[k], q = b.enlaces[k], base = q || p;
      enlaces[k] = {...base, x0: lerp((p || q).x0, (q || p).x0), x1: lerp((p || q).x1, (q || p).x1),
        sy: lerp(p ? p.sy : q.sy + q.w / 2, q ? q.sy : p.sy + p.w / 2),
        ty: lerp(p ? p.ty : q.ty + q.w / 2, q ? q.ty : p.ty + p.w / 2), w: lerp(p ? p.w : 0, q ? q.w : 0)};
    }
    return {...b, nodos, enlaces};
  }

  /* ------------------------------- un diagrama -------------------------------
     Cada módulo tiene el suyo: su SVG, su geometría, sus puntos y su llenado.
     Los elementos se crean una vez y luego solo se actualizan, así los cambios
     de opacidad al elegir o al pasar el mouse se animan con CSS. */

  function crearDiagrama(clave, svg){
    const D = {clave, svg, geo: null, raf: 0, vivos: {flujos: new Map(), nodos: new Map()},
      particulas: [], recorridos: new Map(), llenado: null, visto: false, visible: false,
      lienzo: {W:1000, H:600, angosto:false}};
    // Si va a haber llenado, el diagrama nace vacío y así espera hasta aparecer en pantalla
    if(!sinMovimiento() && !pausado) D.llenado = {cuenta: {}, entran: {}, frente: {}, pendientes: 0, esperando: true};
    const capas = {titulos: el("g", {}, svg), flujos: el("g", {}, svg),
      particulas: el("g", {class:"cl-particulas", "aria-hidden":"true"}, svg), nodos: el("g", {}, svg)};

    D.dibujar = geo => {
      const {W, H} = D.lienzo;
      poner(svg, {viewBox: `0 0 ${W} ${H}`});
      svg.classList.toggle("angosto", D.lienzo.angosto);
      capas.titulos.replaceChildren();
      (geo.titulos || []).forEach(t => {
        el("text", {x:t.x, y:22, class:"cl-col", "text-anchor":t.ancla}, capas.titulos).textContent = t.texto;
      });

      const suya = seleccion?.dim === clave ? seleccion : null;
      const elegidos = idsElegidos(D);
      const vistos = new Set();
      for(const [k, e] of Object.entries(geo.enlaces)){
        vistos.add(k);
        let p = D.vivos.flujos.get(k);
        if(!p){ p = el("path", {"data-enlace": k, tabindex: 0, role: "button"}, capas.flujos); D.vivos.flujos.set(k, p); }
        const marcado = suya && (suya.tipo === "enlace" ? suya.clave === k : e.ids.some(id => elegidos.has(id)));
        poner(p, {d: D.trazo(k, e), fill: e.color,
          "aria-label": `${e.textoDe} → ${e.textoA}: ${plural(e.n, "entrevista")}. Ver la lista.`});
        p.setAttribute("class", "cl-flujo" + (e.cambio ? " cambio" : "") + (suya ? (marcado ? " elegido" : " tenue") : ""));
      }
      for(const [k, p] of D.vivos.flujos) if(!vistos.has(k)){ p.remove(); D.vivos.flujos.delete(k); }
      svg.classList.toggle("llenando", !!D.llenado);

      const vistosN = new Set();
      for(const [k, n] of Object.entries(geo.nodos)){
        if(n.h < 0.05 && !n.minimo && (n.opacidad ?? 1) <= 0) continue;
        vistosN.add(k);
        let g = D.vivos.nodos.get(k);
        if(!g){
          g = el("g", {"data-nodo": k}, capas.nodos);
          el("rect", {class:"cl-barra", rx:3, width:ANCHO_NODO}, g);
          el("text", {class:"cl-etiqueta"}, g);
          D.vivos.nodos.set(k, g);
        }
        const elegido = suya?.tipo === "nodo" && suya.clave === k;
        g.classList.toggle("destino", !!n.destino);
        g.classList.toggle("elegido", elegido);
        g.classList.add("cl-nodo");
        poner(g, {"data-destino": n.destino || null, opacity: D.opacidadNodo(k, n),
          tabindex: n.n ? 0 : null, role: n.n ? "button" : null,
          "aria-label": n.n ? `${n.etiqueta}: ${plural(n.n, "entrevista")}. Ver la lista.` : null});
        const alto = Math.max(n.h, n.minimo || 0);
        const hb = D.altoBarra(k, n);
        poner(g.firstChild, {x: n.x, y: (n.y + (alto - hb) / 2).toFixed(1), height: hb.toFixed(1),
          fill: n.punteado ? "var(--superficie)" : n.color,
          stroke: n.punteado ? "var(--suave)" : null, "stroke-dasharray": n.punteado ? "4 3" : null});
        const izq = n.lado === "izq", lx = izq ? n.x - 9 : n.x + ANCHO_NODO + 9;
        const lineas = renglones(n.etiqueta, n.maxCar || 30);
        const cy = n.y + alto / 2 - ((lineas.length + 1) * 17) / 2 + 13;
        const t = g.lastChild;
        poner(t, {x: lx, y: cy.toFixed(1), "text-anchor": izq ? "end" : "start"});
        const firma = lineas.join("|");
        if(t.dataset.firma !== firma){
          t.dataset.firma = firma;
          t.replaceChildren();
          lineas.forEach((l, i) => { el("tspan", {x: lx, dy: i ? 17 : 0}, t).textContent = l; });
          g._cuenta = el("tspan", {x: lx, dy: 17, class: "cl-cuenta"}, t);
        }else t.querySelectorAll("tspan").forEach(s => s.setAttribute("x", lx));
        D.ponerCuenta(k, n);
      }
      for(const [k, g] of D.vivos.nodos) if(!vistosN.has(k)){ g.remove(); D.vivos.nodos.delete(k); }
    };

    /* Durante el llenado cada cinta se pinta de izquierda a derecha hasta donde va el
       punto más adelantado, y se ensancha desde su centro con cada entrevista que entra */
    D.trazo = (k, e) => {
      if(!D.llenado) return cinta(e.x0, e.sy, e.x1, e.ty, Math.max(0, e.w));
      const entran = D.llenado.entran[k] || 0;
      if(!entran) return "";
      // El grosor crece desde el centro de la cinta hacia sus dos bordes
      const w = Math.max(.8, e.w * entran / Math.max(1, e.n)), m = (e.w - w) / 2;
      return cintaParcial({...e, sy: e.sy + m, ty: e.ty + m}, w, D.llenado.frente[k] || 0);
    };
    /* Las barras crecen desde su centro con los puntos que llegan (en la primera columna, con los que salen) */
    D.altoBarra = (k, n) => {
      const alto = Math.max(n.h, n.minimo || 0);
      if(!D.llenado || !n.n) return alto;
      return alto * Math.min(1, (D.llenado.cuenta[k] || 0) / n.n);
    };
    /* Mientras se llena, un nodo aparece cuando le llega (o le sale) el primer punto */
    D.opacidadNodo = (k, n) => {
      if(D.llenado) return (D.llenado.cuenta[k] || 0) > 0 ? null : "0";
      return (n.opacidad ?? 1) < 1 ? n.opacidad.toFixed(2) : null;
    };
    D.pintarLlenado = () => {
      const geo = D.geo;
      for(const [k, p] of D.vivos.flujos){ const e = geo.enlaces[k]; if(e) p.setAttribute("d", D.trazo(k, e)); }
      for(const [k, g] of D.vivos.nodos){
        const n = geo.nodos[k]; if(!n) continue;
        // La barra también crece desde su centro
        const alto = Math.max(n.h, n.minimo || 0), hb = D.altoBarra(k, n);
        g.firstChild.setAttribute("y", (n.y + (alto - hb) / 2).toFixed(1));
        g.firstChild.setAttribute("height", hb.toFixed(1));
        const o = D.opacidadNodo(k, n); if(o == null) g.removeAttribute("opacity"); else g.setAttribute("opacity", o);
      }
    };

    /* Número que se ve en cada nodo: durante el llenado, los puntos que ya llegaron */
    D.ponerCuenta = (k, n) => {
      const g = D.vivos.nodos.get(k); if(!g?._cuenta || !n) return;
      const valor = D.llenado ? (D.llenado.cuenta[k] || 0) : (n.mostrar ?? n.n);
      const txt = String(valor);
      if(g._cuenta.textContent !== txt) g._cuenta.textContent = txt;
    };

    D.animarHacia = geo => {
      cancelAnimationFrame(D.raf);
      const previa = D.geo;
      if(!previa || previa.forma !== geo.forma || sinMovimiento()){ D.geo = geo; D.dibujar(geo); return; }
      const t0 = performance.now();
      const paso = ahora => {
        const t = Math.min(1, Math.max(0, (ahora - t0) / DURACION));
        D.geo = t < 1 ? mezclar(previa, geo, suave(t)) : geo;
        D.dibujar(D.geo);
        if(t < 1) D.raf = requestAnimationFrame(paso);
      };
      D.raf = requestAnimationFrame(paso);
    };

    /* Un punto por entrevista, con su recorrido (las cintas que atraviesa, en orden) */
    D.prepararParticulas = ids => {
      const ruta = {};
      for(const [k, e] of Object.entries(D.geo.enlaces)) for(const id of e.ids) (ruta[id] = ruta[id] || []).push([e.col, k]);
      D.particulas = [];
      for(const id of ids){
        const tramos = (ruta[id] || []).sort((a, b) => a[0] - b[0]).map(x => x[1]);
        if(!tramos.length) continue;
        let p = D.recorridos.get(id);
        if(!p){
          // Arranca en un lugar al azar de su recorrido: desde el primer cuadro hay movimiento
          p = {id, u: .12 + Math.random() * .76, tramo: Math.floor(Math.random() * tramos.length), t: Math.random(),
               espera: Math.random() < .15 ? Math.random() * 2 : 0, velocidad: 1 / (1.7 + Math.random() * 1.1)};
          D.recorridos.set(id, p);
        }
        p.tramos = tramos;
        if(p.tramo >= tramos.length){ p.tramo = 0; p.t = 0; }
        D.particulas.push(p);
      }
      const capa = capas.particulas, r = D.lienzo.angosto ? 5 : 4;
      while(capa.childElementCount < D.particulas.length) el("circle", {}, capa);
      while(capa.childElementCount > D.particulas.length) capa.lastChild.remove();
      [...capa.children].forEach(c => c.setAttribute("r", r));
      if(D.llenado) D.llenado.pendientes = D.particulas.filter(p => p.llenando).length;
    };

    /* Llenado: los puntos salen escalonados desde «Entrevistas» y cada nodo cuenta
       los que le van llegando, hasta su valor final. Después siguen circulando. */
    D.empezarLlenado = () => {
      if(sinMovimiento() || pausado || !D.geo || !D.particulas.length){ if(D.llenado) terminarLlenado(); return; }
      const N = D.particulas.length;
      D.particulas.forEach((p, i) => {
        p.tramo = 0; p.t = 0; p.llenando = true; p.salio = false;
        p.espera = (i / N) * 2.6 + Math.random() * .3;
        p.velocidad = 1 / (.7 + Math.random() * .35);
      });
      D.llenado = {cuenta: {}, entran: {}, frente: {}, pendientes: N, esperando: false};
      D.dibujar(D.geo);
    };
    const sumar = k => {
      D.llenado.cuenta[k] = (D.llenado.cuenta[k] || 0) + 1;
      D.ponerCuenta(k, D.geo.nodos[k]);
      const g = D.vivos.nodos.get(k);
      if(g){ g.classList.remove("pulso"); void g.getBBox(); g.classList.add("pulso"); }
    };
    const terminarLlenado = () => {
      D.llenado = null;
      D.dibujar(D.geo);
    };
    const entra = k => { D.llenado.entran[k] = (D.llenado.entran[k] || 0) + 1; };

    D.moverParticulas = dt => {
      const capa = capas.particulas, geo = D.geo; if(!geo) return;
      if(D.llenado?.esperando){ [...capa.children].forEach(c => c.setAttribute("opacity", "0")); return; }
      const suya = seleccion?.dim === clave, elegidos = suya ? idsElegidos(D) : null;
      D.particulas.forEach((p, i) => {
        const c = capa.children[i]; if(!c) return;
        if(dt){
          if(p.espera > 0){
            p.espera -= dt;
            // Al salir, el punto ya cuenta en «Entrevistas»
            if(p.espera <= 0 && p.llenando && !p.salio && D.llenado){
              p.salio = true;
              const e0 = geo.enlaces[p.tramos[0]]; if(e0){ sumar(e0.de); entra(p.tramos[0]); }
            }
          }else{
            p.t += dt * p.velocidad;
            if(p.t >= 1){
              const e = geo.enlaces[p.tramos[p.tramo]];
              if(p.llenando && D.llenado && e){
                sumar(e.a); D.llenado.frente[p.tramos[p.tramo]] = 1;
                if(p.tramo + 1 < p.tramos.length) entra(p.tramos[p.tramo + 1]);
              }
              p.t = 0; p.tramo++;
              if(p.tramo >= p.tramos.length){
                p.tramo = 0; p.espera = 1 + Math.random() * 4;
                if(p.llenando){
                  p.llenando = false; p.velocidad = 1 / (1.7 + Math.random() * 1.1);
                  if(D.llenado && --D.llenado.pendientes <= 0) terminarLlenado();
                }
              }
            }
          }
        }
        const e = geo.enlaces[p.tramos[p.tramo]];
        if(p.llenando && D.llenado && p.espera <= 0 && e){
          const k = p.tramos[p.tramo];
          if((D.llenado.frente[k] || 0) < p.t) D.llenado.frente[k] = p.t;
        }
        if(!e || p.espera > 0 || e.w < .5){ c.setAttribute("opacity", "0"); return; }
        // Mientras se llena, el punto viaja dentro de la franja ya pintada (centrada)
        let via = e;
        if(D.llenado){
          const ancho = Math.max(.8, e.w * (D.llenado.entran[p.tramos[p.tramo]] || 1) / Math.max(1, e.n)), m = (e.w - ancho) / 2;
          via = {...e, sy: e.sy + m, ty: e.ty + m, w: ancho};
        }
        const {x, y} = puntoEn(via, p.u, p.t);
        let a = .9;
        if(p.tramo === 0 && p.t < .15 && !p.llenando) a *= p.t / .15;
        if(p.tramo === p.tramos.length - 1 && p.t > .8 && !p.llenando) a *= (1 - p.t) / .2;
        if(suya && !elegidos.has(p.id)) a *= .15;
        c.setAttribute("cx", x.toFixed(1)); c.setAttribute("cy", y.toFixed(1));
        c.setAttribute("fill", colorReal(e.colorPunto || e.color)); c.setAttribute("opacity", a.toFixed(2));
      });
      if(dt && D.llenado) D.pintarLlenado();
    };
    /* Sin animación: los números quedan en su valor final */
    D.detener = () => { if(D.llenado) terminarLlenado(); D.particulas.forEach(p => { p.llenando = false; }); D.moverParticulas(0); };
    return D;
  }

  /* ----------------------- la geometría de cada módulo ----------------------- */

  const CONFIANZAS = [["alta","Alta"], ["media","Media"], ["baja","Baja"], ["sin","Sin IA"]];

  function rutaDe(f){
    const c = f.clasificacion;
    return {conf: c?.categoria_ia ? (c.confianza || "media") : "sin", ia: c?.categoria_ia || "sin", fin: c?.categoria || "pend"};
  }

  /* Geometría del módulo y la lista de entrevistas (ids) que recorren su diagrama */
  function geometriaDe(d, angosto){
    const W = angosto ? 600 : 1000, H = angosto ? 720 : 600;
    const base = info.entrevistas;
    const cats = d.categorias.map(c => c.clave);
    const ordenIA = k => k === "x" ? -1 : (k === "sin" ? cats.length : cats.indexOf(k));
    const cuenta = {}, cintas = {};
    const sumar = (nodo, id) => (cuenta[nodo] = cuenta[nodo] || []).push(id);
    const tramo = (de, a, iaK, id, extra = {}) => {
      const k = `${de}>${a}|${iaK}`;
      (cintas[k] = cintas[k] || {clave: k, de, a, ia: iaK, ids: [], ...extra}).ids.push(id);
    };
    let con, sin;
    if(d.activa){
      con = filtrarFilas(datos[d.clave].filas);
      const ids = new Set(datos[d.clave].filas.map(f => f.id));
      sin = filtrarSueltas(base.filter(e => !ids.has(e.id)));
      con.forEach(f => {
        const r = rutaDe(f);
        ["todas", "con", "conf:" + r.conf, "ia:" + r.ia, "fin:" + r.fin].forEach(n => sumar(n, f.id));
        tramo("todas", "con", r.ia, f.id);
        tramo("con", "conf:" + r.conf, r.ia, f.id);
        tramo("conf:" + r.conf, "ia:" + r.ia, r.ia, f.id);
        tramo("ia:" + r.ia, "fin:" + r.fin, r.ia, f.id, {fin: r.fin});
      });
    }else{
      const respondieron = new Set(d.respondieron), sueltas = filtrarSueltas(base);
      con = sueltas.filter(e => respondieron.has(e.id));
      sin = sueltas.filter(e => !respondieron.has(e.id));
      con.forEach(f => {
        ["todas", "con", "reglas"].forEach(n => sumar(n, f.id));
        tramo("todas", "con", "x", f.id); tramo("con", "reglas", "x", f.id);
      });
    }
    sin.forEach(f => { sumar("todas", f.id); sumar("sin", f.id); tramo("todas", "sin", "x", f.id); });

    const n = k => (cuenta[k] || []).length;
    const nombreNodo = k => {
      if(k === "todas") return "Entrevistas";
      if(k === "con") return "Respondieron el módulo";
      if(k === "sin") return "No respondieron";
      if(k === "reglas") return "Sin reglas de clasificación aún";
      const [col, v] = k.split(":");
      if(col === "conf") return CONFIANZAS.find(x => x[0] === v)[1];
      if(v === "sin") return "Sin propuesta";
      if(v === "pend") return "Por clasificar";
      return corto(nombreCat(d, v));
    };
    const nodo = (k, extra = {}) => {
      const v = k.includes(":") ? k.split(":")[1] : k;
      return {clave: k, etiqueta: nombreNodo(k), n: n(k), ids: cuenta[k] || [], lado: "der",
        color: k === "todas" ? "var(--texto)" : k === "con" || k.startsWith("conf") ? "var(--suave)"
             : k === "sin" ? "var(--borde-2)" : colorDe(d, v),
        punteado: (v === "sin" && k !== "sin") || v === "pend" || k === "reglas", ...extra};
    };

    let columnas, xs, titulos;
    if(d.activa){
      const fin = [...cats.map(k => nodo("fin:" + k, {destino: k, minimo: 4, maxCar: angosto ? 12 : 18})),
                   ...(n("fin:pend") ? [nodo("fin:pend", {maxCar: angosto ? 12 : 18})] : [])];
      const confs = CONFIANZAS.map(([k]) => nodo("conf:" + k, {maxCar: angosto ? 8 : 30})).filter(x => x.n);
      const props = [...cats, "sin"].map(k => nodo("ia:" + k, {maxCar: angosto ? 10 : 24})).filter(x => x.n);
      // En pantallas angostas se omiten las dos primeras columnas; el resumen da esos números
      columnas = angosto ? [confs, props, fin]
        : [[nodo("todas", {lado: "izq"})], [nodo("con", {maxCar: 14}), nodo("sin", {maxCar: 14})].filter(x => x.n), confs, props, fin];
      xs = angosto ? [24, 230, 420] : [110, 280, 460, 640, 815];
      titulos = angosto ? ["Confianza", "IA", "Final"] : ["Entrevistas", "Módulo", "Confianza IA", "Propuesta IA", "Categoría final"];
    }else{
      columnas = [[nodo("todas", {lado: angosto ? "der" : "izq"})],
                  [nodo("con", {maxCar: 14}), nodo("sin", {maxCar: 14})].filter(x => x.n),
                  n("reglas") ? [nodo("reglas", {maxCar: angosto ? 12 : 22})] : []];
      xs = angosto ? [24, 230, 420] : [110, 400, 690];
      titulos = angosto ? ["", "Módulo", "Clasificación"] : ["Entrevistas", "Módulo", "Clasificación"];
    }

    const texto = k => {
      const nombre = nombreNodo(k), min = nombre.toLowerCase();
      if(k.startsWith("conf:")) return k === "conf:sin" ? "Sin propuesta de la IA" : `Confianza ${min}`;
      if(k.startsWith("ia:")) return `IA: ${min}`;
      if(k.startsWith("fin:")) return `Final: ${min}`;
      return nombre;
    };
    const quitar = angosto && d.activa;
    const enlaces = Object.values(cintas)
      .filter(c => !quitar || !(c.de === "todas" || c.de === "con"))
      .map(c => ({...c, n: c.ids.length,
        color: c.ia === "x" ? (c.a === "sin" ? "var(--borde)" : "var(--borde-2)") : colorDe(d, c.ia),
        // Sobre las cintas grises, el punto va en un gris más claro para que se vea
        colorPunto: c.ia === "x" || c.ia === "sin" ? "var(--suave)" : colorDe(d, c.ia),
        orden: ordenIA(c.ia), cambio: !!c.fin && c.ia !== "sin" && c.fin !== "pend" && c.ia !== c.fin,
        textoDe: texto(c.de),
        textoA: texto(c.a) + (c.ia !== "x" && !c.a.startsWith("ia:") && !c.a.startsWith("fin:")
          ? ` (IA: ${c.ia === "sin" ? "sin propuesta" : corto(nombreCat(d, c.ia)).toLowerCase()})` : "")}));

    columnas = columnas.filter(c => c.length);
    const geo = disponer({columnas, enlaces, xs, arriba: 46, alto: H});
    geo.forma = (angosto ? "angosto:" : "ancho:") + d.clave;
    geo.titulos = titulos.slice(0, columnas.length).map((t, i) => ({x: i === 0 && !angosto ? xs[0] + ANCHO_NODO : xs[i],
      ancla: i === 0 && !angosto ? "end" : "start", texto: t}));
    // El lienzo se ajusta al alto que de verdad ocupa el diagrama
    const altoReal = Math.ceil(Math.max(120, ...Object.values(geo.nodos).map(x => x.y + Math.max(x.h, 40))) + 40);
    return {geo, lienzo: {W, H: altoReal, angosto}, ids: [...con, ...sin].map(f => f.id),
            resumen: {total: con.length + sin.length, con: con.length}};
  }

  /* ---------------------------- la pantalla completa ---------------------------- */

  function pintar(primeraVez){
    ocultarTips();
    for(const k in coloresResueltos) delete coloresResueltos[k];   // por si cambió el tema claro/oscuro
    const caja = $("#cl-modulos");
    if(!info) return;
    // Las secciones se crean una vez; después solo se actualizan
    if(primeraVez || caja.childElementCount !== info.dimensiones.length){
      Object.values(diagramas).forEach(D => observador.unobserve(D.seccion));
      Object.keys(diagramas).forEach(k => delete diagramas[k]);
      $("#cl-modulos").after($("#cl-lista"));
      caja.innerHTML = info.dimensiones.map((d, i) => `
        <section class="cl-modulo${d.activa ? "" : " sin-reglas"}" data-dim="${esc(d.clave)}" aria-labelledby="cl-mod-${esc(d.clave)}">
          <div class="cl-mod-cab">
            <div class="cl-mod-titulo">
              <div class="cl-mod-gorro"><span class="cl-mod-num">Módulo ${i + 1} de ${info.dimensiones.length}</span>
                <span class="cl-mod-estado">${d.activa ? "Con reglas de clasificación" : "Sin reglas aún"}</span></div>
              <h3 id="cl-mod-${esc(d.clave)}">${esc(d.nombre)}</h3>
              <p class="cl-mod-resumen"></p>
            </div>
            ${d.activa ? `<div class="cl-mod-acciones">
              <span class="cl-progreso" aria-live="polite"></span>
              <button class="btn chico oculto" data-accion="reclasificar"></button>
              <button class="btn chico pri" data-accion="clasificar"></button>
            </div>` : ""}
          </div>
          ${d.activa ? `<div class="cl-leyenda">${d.categorias.map(c =>
            `<span>${muestraFlujo(colorDe(d, c.clave))}<b>${esc(c.nombre)}</b></span>`).join("")}</div>` : ""}
          <div class="cl-red-caja">
            <svg class="cl-red" role="group" aria-label="Diagrama de Sankey del módulo ${esc(d.nombre)}"></svg>
            <div class="cl-tip oculto" role="tooltip"></div>
          </div>
          <div class="cl-lista-hueco"></div>
        </section>`).join("");
      info.dimensiones.forEach(d => {
        const sec = caja.querySelector(`[data-dim="${CSS.escape(d.clave)}"]`);
        const D = crearDiagrama(d.clave, sec.querySelector(".cl-red"));
        D.seccion = sec;
        diagramas[d.clave] = D;
        observador.observe(sec);
      });
    }
    const ancho = caja.querySelector(".cl-red-caja")?.clientWidth || 1000, angosto = ancho < 640;
    info.dimensiones.forEach(d => {
      const D = diagramas[d.clave];
      const {geo, lienzo, ids, resumen} = geometriaDe(d, angosto);
      if(D.geo && D.geo.forma !== geo.forma) D.geo = null;
      D.lienzo = lienzo;
      if(seleccion?.dim === d.clave && !(seleccion.tipo === "enlace" ? geo.enlaces[seleccion.clave] : geo.nodos[seleccion.clave]?.n)) seleccion = null;
      D.animarHacia(geo);
      D.prepararParticulas(ids);
      D.moverParticulas(0);
      pintarResumen(d, D.seccion, resumen, angosto);
      if(d.activa) pintarBotones(d.clave);
    });
    $("#cl-pausa").classList.toggle("oculto", sinMovimiento());
    pintarPausa();
    pintarLista();
    pintarTabla();
  }

  function pintarResumen(d, sec, r, angosto){
    const partes = [`${r.con} de ${r.total} entrevistas respondieron`,
                    `bloque${d.bloques.length > 1 ? "s" : ""} ${d.bloques.join(", ")} de la guía`];
    if(d.activa){
      const fs = filtrarFilas(datos[d.clave].filas);
      partes.push(`${fs.filter(f => f.clasificacion).length} clasificadas`,
                  `${fs.filter(f => f.clasificacion?.categoria_final).length} revisadas por el equipo`);
    }
    sec.querySelector(".cl-mod-resumen").textContent = partes.join(" · ");
  }

  /* Cuando un módulo entra en pantalla por primera vez, arranca su llenado */
  const observador = new IntersectionObserver(entradas => {
    entradas.forEach(en => {
      const D = diagramas[en.target.dataset.dim]; if(!D) return;
      D.visible = en.isIntersecting;
      if(en.isIntersecting && !D.visto){ D.visto = true; D.empezarLlenado(); }
    });
  }, {threshold: .2});

  /* --------------------------------- partículas --------------------------------- */

  let rafParticulas = 0, ultimo = 0;
  function arrancarParticulas(){
    cancelAnimationFrame(rafParticulas);
    if(pausado || sinMovimiento()){ Object.values(diagramas).forEach(D => D.detener()); return; }
    ultimo = performance.now();
    const paso = ahora => {
      if($("#vista-clasificacion").classList.contains("oculto")) return;     // se reanuda al volver
      const dt = Math.min(.1, Math.max(0, (ahora - ultimo) / 1000)); ultimo = ahora;
      // Solo se mueven los módulos que están a la vista
      Object.values(diagramas).forEach(D => { if(D.visible) D.moverParticulas(dt); });
      rafParticulas = requestAnimationFrame(paso);
    };
    rafParticulas = requestAnimationFrame(paso);
  }
  function pintarPausa(){
    const b = $("#cl-pausa");
    b.textContent = pausado ? "▶ Animar" : "⏸ Pausar animación";
    b.setAttribute("aria-pressed", String(pausado));
  }
  function alternarPausa(){
    pausado = !pausado;
    try{ localStorage.setItem("uc_sankey_pausa", pausado ? "1" : "0"); }catch(e){}
    pintarPausa();
    arrancarParticulas();
  }

  /* ------------------ lista de entrevistas de lo elegido ------------------ */

  function idsElegidos(D){
    if(!seleccion || !D?.geo || seleccion.dim !== D.clave) return new Set();
    const x = seleccion.tipo === "enlace" ? D.geo.enlaces[seleccion.clave] : D.geo.nodos[seleccion.clave];
    return new Set(x?.ids || []);
  }

  /* La lista aparece debajo del diagrama del módulo donde se eligió */
  function pintarLista(){
    const caja = $("#cl-lista");
    if(!seleccion){ caja.classList.add("oculto"); caja.replaceChildren(); return; }
    const D = diagramas[seleccion.dim], d = dimDe(seleccion.dim);
    D.seccion.querySelector(".cl-lista-hueco").appendChild(caja);
    caja.classList.remove("oculto");
    const ids = idsElegidos(D);
    const lista = (datos[d.clave]?.filas || []).filter(f => ids.has(f.id)).sort((a, b) => a.codigo.localeCompare(b.codigo, "es"));
    const otrasN = ids.size - lista.length;
    const g = D.geo;
    const titulo = seleccion.tipo === "enlace"
      ? `${g.enlaces[seleccion.clave].textoDe} → ${g.enlaces[seleccion.clave].textoA}` : g.nodos[seleccion.clave].etiqueta;
    caja.innerHTML = `
      <div class="cl-lista-cab">
        <h3><span class="cl-lista-mod">${esc(d.nombre)}</span>${esc(titulo)} · ${plural(ids.size, "entrevista")}</h3>
        <button type="button" class="btn chico" id="cl-soltar">Quitar selección</button>
      </div>
      ${lista.length ? `<p class="cl-lista-ayuda">Arrastre una tarjeta (o su asa <span aria-hidden="true">⠿</span> en el celular) hasta una
        categoría de la columna «Categoría final» de este módulo para moverla. Tóquela para ver su ficha.</p>` : ""}
      ${otrasN ? `<p class="cl-lista-ayuda">${plural(otrasN, "entrevista")} ${d.activa
        ? `no ${otrasN === 1 ? "respondió" : "respondieron"} este módulo: no hay nada que clasificar.`
        : `de un módulo que aún no tiene reglas de clasificación: todavía no hay nada que revisar.`}</p>` : ""}
      <div class="cl-tarjetas">${lista.map(f => {
        const c = f.clasificacion, est = estadoDe(f);
        return `<div class="cl-tarjeta" data-id="${esc(f.id)}" tabindex="0" role="button"
            aria-label="${esc(f.codigo)}, ${esc(f.municipio || "sin municipio")}: abrir ficha">
          <span class="cl-asa" aria-hidden="true">⠿</span>
          <span class="cl-tarjeta-txt">
            <b>${esc(f.codigo)}</b>
            <small>${esc(f.municipio || "Sin municipio")}${c?.confianza ? ` · confianza ${esc(c.confianza)}` : ""}</small>
            <small>${c ? chip(d, c.categoria) : "Por clasificar"} · ${ETIQUETA_ESTADO[est]}${c?.desactualizada ? " · ⚠" : ""}</small>
          </span>
        </div>`;}).join("")}</div>`;
    $("#cl-soltar").onclick = () => elegir(null);
  }

  function elegir(sel){
    const igual = seleccion && sel && seleccion.dim === sel.dim && seleccion.tipo === sel.tipo && seleccion.clave === sel.clave;
    const antes = seleccion?.dim;
    seleccion = igual ? null : sel;
    if(seleccion?.dim && datos[seleccion.dim]) trabajarEn(seleccion.dim);
    for(const k of new Set([antes, seleccion?.dim].filter(Boolean))){
      const D = diagramas[k]; if(D?.geo){ D.dibujar(D.geo); D.moverParticulas(0); }
    }
    pintarLista();
    pintarTabla();
    if(seleccion) $("#cl-lista").scrollIntoView({behavior: sinMovimiento() ? "auto" : "smooth", block:"nearest"});
  }

  /* ------------- arrastrar una tarjeta a una categoría final ------------- */

  let arr = null;

  function destinoBajo(x, y){
    const n = document.elementFromPoint(x, y)?.closest?.("[data-destino]");
    // Solo valen las categorías del mismo módulo
    return n && n.closest(".cl-modulo")?.dataset.dim === dim ? n.dataset.destino : null;
  }
  function marcarDestino(cat){
    $$(`.cl-modulo[data-dim="${CSS.escape(dim || "")}"] [data-destino]`).forEach(g => g.classList.toggle("sobre", g.dataset.destino === cat));
  }
  function alPresionarTarjeta(ev){
    const t = ev.target.closest(".cl-tarjeta"); if(!t || ev.button > 0) return;
    // En pantallas táctiles se arrastra desde el asa, para no impedir el desplazamiento de la página
    if(ev.pointerType === "touch" && !ev.target.closest(".cl-asa")) return;
    arr = {t, id: t.dataset.id, x0: ev.clientX, y0: ev.clientY, moviendo: false, fantasma: null};
    t.setPointerCapture(ev.pointerId);
  }
  function alMoverTarjeta(ev){
    if(!arr) return;
    if(!arr.moviendo){
      if(Math.hypot(ev.clientX - arr.x0, ev.clientY - arr.y0) < UMBRAL_ARRASTRE) return;
      arr.moviendo = true;
      const f = arr.t.cloneNode(true); f.classList.add("cl-fantasma"); f.removeAttribute("tabindex");
      f.style.width = arr.t.offsetWidth + "px";
      document.body.appendChild(f); arr.fantasma = f;
      arr.t.classList.add("arrastrada");
      diagramas[dim]?.svg.classList.add("soltando");
    }
    arr.fantasma.style.transform = `translate(${ev.clientX + 12}px, ${ev.clientY + 12}px)`;
    arr.destino = destinoBajo(ev.clientX, ev.clientY);
    marcarDestino(arr.destino);
  }
  function terminarArrastre(){
    arr?.fantasma?.remove(); arr?.t.classList.remove("arrastrada");
    $$(".cl-red.soltando").forEach(s => s.classList.remove("soltando")); marcarDestino(null);
  }
  function alSoltarTarjeta(){
    if(!arr) return;
    const {id, moviendo, destino} = arr;
    terminarArrastre(); arr = null;
    if(!moviendo){ abrirFicha(id); return; }
    const f = filas.find(x => x.id === id);
    if(f && destino && destino !== f.clasificacion?.categoria) confirmarMovida(f, destino);
  }

  /* ------------------------------ tabla ------------------------------ */

  function pintarTabla(){
    const d = dimAbierta();
    $("#cl-tabla-titulo").textContent = d ? `Ver como tabla · ${d.nombre}` : "Ver como tabla";
    if(!d){ $("#cl-tabla").innerHTML = ""; return; }
    const vista = filtrarFilas(filas);
    $("#cl-tabla").innerHTML = `<thead><tr><th>Código</th><th>Municipio</th><th>Categoría</th>
      <th>Propuesta de la IA</th><th>Confianza</th><th>Revisión</th><th></th></tr></thead><tbody>` +
      (vista.length ? [...vista].sort((a,b) => a.codigo.localeCompare(b.codigo, "es")).map(f => {
        const c = f.clasificacion;
        return `<tr>
          <td><b>${esc(f.codigo)}</b></td>
          <td>${esc(f.municipio || "—")}</td>
          <td>${c ? chip(d, c.categoria) : "—"}</td>
          <td>${c?.categoria_ia ? esc(nombreCat(d, c.categoria_ia)) : "—"}</td>
          <td>${esc(c?.confianza || "—")}</td>
          <td>${ETIQUETA_ESTADO[estadoDe(f)]}${c?.desactualizada ? " · ⚠ desactualizada" : ""}</td>
          <td><button class="btn chico" data-ficha="${esc(f.id)}">Ficha</button></td>
        </tr>`;}).join("")
      : `<tr><td colspan="7" style="color:var(--suave)">No hay entrevistas con ese filtro.</td></tr>`) + `</tbody>`;
    $$("#cl-tabla [data-ficha]").forEach(b => b.onclick = () => abrirFicha(b.dataset.ficha));
  }

  const muestraFlujo = color => `<svg width="22" height="12" aria-hidden="true"><path d="M1 2C11 2 11 6 21 6L21 11C11 11 11 7 1 7Z" fill="${color}" opacity=".75"/></svg>`;
  const chip = (d, clave) => `<span class="cl-chip"><i style="background:${colorDe(d, clave)}"></i>${esc(nombreCat(d, clave))}</span>`;

  /* ------------------------------ tooltip ------------------------------ */

  function mostrarTip(sec, ev, lineas){
    const tip = sec.querySelector(".cl-tip");
    tip.replaceChildren();
    lineas.forEach(([texto, color], i) => {
      const s = document.createElement(i ? "div" : "b");
      if(color){ const k = document.createElement("i"); k.style.background = color; s.appendChild(k); }
      s.appendChild(document.createTextNode(texto)); tip.appendChild(s);
    });
    tip.classList.remove("oculto");
    const caja = sec.querySelector(".cl-red-caja").getBoundingClientRect();
    let x = ev.clientX - caja.left + 14, y = ev.clientY - caja.top + 14;
    if(x + tip.offsetWidth > caja.width - 6) x = ev.clientX - caja.left - tip.offsetWidth - 14;
    if(y + tip.offsetHeight > caja.height - 6) y = ev.clientY - caja.top - tip.offsetHeight - 14;
    tip.style.left = Math.max(6, x) + "px"; tip.style.top = Math.max(6, y) + "px";
  }
  const ocultarTips = () => $$(".cl-tip").forEach(t => t.classList.add("oculto"));

  function tipDe(ev){
    const sec = ev.target.closest?.(".cl-modulo"); if(!sec) return ocultarTips();
    const D = diagramas[sec.dataset.dim]; if(!D?.geo) return;
    const e = ev.target.closest?.("[data-enlace]"), n = ev.target.closest?.("[data-nodo]");
    if(e){
      const g = D.geo.enlaces[e.dataset.enlace]; if(!g) return ocultarTips();
      const lineas = [[plural(g.n, "entrevista")], [`${g.textoDe} → ${g.textoA}`, g.color]];
      if(g.cambio) lineas.push(["Movidas por el equipo"]);
      lineas.push(["Toque para ver la lista"]);
      return mostrarTip(sec, ev, lineas);
    }
    if(n){
      const g = D.geo.nodos[n.dataset.nodo]; if(!g) return ocultarTips();
      const lineas = [[plural(g.n, "entrevista")], [g.etiqueta, g.punteado ? null : g.color]];
      if(g.destino) lineas.push(["Suelte aquí una tarjeta para moverla a esta categoría"]);
      else if(g.n) lineas.push(["Toque para ver la lista"]);
      return mostrarTip(sec, ev, lineas);
    }
    ocultarTips();
  }

  /* --------------------------- mover y deshacer --------------------------- */

  /* Confirmación con motivo opcional; resuelve true si se movió */
  function confirmarMovida(f, a){
    const d = dimAbierta(), dlg = $("#dlg-mover");
    const de = f.clasificacion ? `de «${nombreCat(d, f.clasificacion.categoria)}» ` : "";
    $("#mover-texto").textContent = `Módulo «${d.nombre}»: ¿mover la entrevista ${f.codigo} ${de}a «${nombreCat(d, a)}»?`;
    $("#mover-motivo").value = "";
    dlg.showModal();
    return new Promise(res => {
      const fin = async ok => {
        $("#mover-si").onclick = $("#mover-no").onclick = null; dlg.onclose = null;
        if(dlg.open) dlg.close();
        if(!ok) return res(false);
        res(await asignar(f, a, $("#mover-motivo").value, true));
      };
      $("#mover-si").onclick = () => fin(true);
      $("#mover-no").onclick = () => fin(false);
      dlg.onclose = () => fin(false);
    });
  }

  /* Guarda la categoría del equipo. Con `deshacible` ofrece volver atrás unos segundos. */
  async function asignar(f, categoria, motivo, deshacible){
    const clave = dim, antes = f.clasificacion ? f.clasificacion.categoria_final : null;
    try{
      const nueva = await api(`/clasificaciones/${clave}/${f.id}/asignar`, {method:"POST", body: JSON.stringify({categoria, motivo})});
      reemplazarFila(nueva, clave);
      pintar();
      if(deshacible) ofrecerDeshacer(`${f.codigo} quedó en «${nombreCat(dimDe(clave), categoria)}»`, async () => {
        const vuelta = await api(`/clasificaciones/${clave}/${f.id}/asignar`,
          {method:"POST", body: JSON.stringify({categoria: antes, motivo: "Deshacer"})});
        reemplazarFila(vuelta, clave); pintar(); aviso("Cambio deshecho");
      });
      else aviso("Categoría guardada");
      return true;
    }catch(e){ aviso(e.message); pintar(); return false; }
  }

  function ofrecerDeshacer(mensaje, accion){
    document.querySelector(".cl-deshacer")?.remove();
    const t = document.createElement("div"); t.className = "cl-deshacer"; t.setAttribute("role", "status");
    const s = document.createElement("span"); s.textContent = mensaje;
    const b = document.createElement("button"); b.type = "button"; b.textContent = "Deshacer";
    b.onclick = async () => { t.remove(); try{ await accion(); }catch(e){ aviso(e.message); } };
    t.append(s, b); document.body.appendChild(t);
    setTimeout(() => t.remove(), 7000);
  }

  /* ------------------------------ ficha ------------------------------ */

  function abrirFicha(id){
    const f = filas.find(x => x.id === id); if(!f) return;
    ocultarTips();
    const d = dimAbierta(), c = f.clasificacion, estado = estadoDe(f);
    const fecha = t => t ? new Date(t).toLocaleString("es-CO", {dateStyle:"medium", timeStyle:"short"}) : "";
    const otras = d.categorias.filter(x => x.clave !== c?.categoria);
    const evid = c ? d.categorias.filter(x => (c.evidencias?.[x.clave] || []).length).map(x => `
      <div class="pq">${chip(d, x.clave)}</div>
      <ul class="cl-citas">${c.evidencias[x.clave].map(t => `<li>«${esc(t)}»</li>`).join("")}</ul>`).join("") : "";

    $("#clas-ficha").innerHTML = `
      <div class="gorro">Módulo: ${esc(d.nombre)}</div>
      <h2 class="titulo" id="clas-titulo" style="font-size:21px">${esc(f.codigo)}</h2>
      <p class="bajada" style="font-size:14.5px">${esc(f.municipio || "Sin municipio")} · entrevista ${esc(f.estado)}</p>
      ${c?.desactualizada ? `<div class="cl-aviso"><span aria-hidden="true">⚠</span><span>Las respuestas cambiaron o las reglas
        son nuevas desde que la IA la clasificó. Conviene volver a clasificarla.</span></div>` : ""}

      <h3>Categoría</h3>
      <p style="margin:0;font-size:16px">${c ? chip(d, c.categoria) : "Todavía no está clasificada."}
        <span style="color:var(--suave);font-size:14px"> · ${ETIQUETA_ESTADO[estado]}</span></p>
      ${c?.categoria_final ? `<p style="font-size:14px;color:var(--suave);margin:6px 0 0">Decisión de ${esc(c.revisada_por)}
        el ${fecha(c.revisada_en)}${c.motivo ? `: «${esc(c.motivo)}»` : ""}.</p>` : ""}

      ${c?.categoria_ia ? `<h3>Propuesta de la IA</h3>
        <p style="margin:0;font-size:15px">${chip(d, c.categoria_ia)} <span style="color:var(--suave)">· confianza ${esc(c.confianza)}</span></p>
        <div class="rp" style="margin-top:8px">${esc(c.justificacion)}</div>
        ${evid ? `<h3>Lo que dijo la persona</h3>${evid}` : ""}` : ""}

      <h3>Acciones</h3>
      <div class="cl-acciones">
        ${c && !c.categoria_final ? `<button class="btn chico pri" data-acc="confirmar">Confirmar «${esc(nombreCat(d, c.categoria))}»</button>` : ""}
        <select id="clas-otra" aria-label="Cambiar a otra categoría">
          <option value="">Cambiar a…</option>
          ${otras.map(x => `<option value="${esc(x.clave)}">${esc(x.nombre)}</option>`).join("")}
        </select>
        <button class="btn chico" data-acc="cambiar">Guardar cambio</button>
        ${c?.categoria_final && c.categoria_ia ? `<button class="btn chico" data-acc="volver">Volver a la propuesta de la IA</button>` : ""}
        ${ia.disponible ? `<button class="btn chico" data-acc="ia">${c?.categoria_ia ? "Clasificar de nuevo con IA" : "Clasificar con IA"}</button>` : ""}
      </div>

      ${c?.historial?.length ? `<details class="cl-hist"><summary>Historial (${c.historial.length})</summary><ul>${
        [...c.historial].reverse().map(h => `<li>${fecha(h.fecha)} · ${h.tipo === "ia" ? `IA (${esc(h.modelo || "")})` : esc(h.usuario || "")}:
          ${h.de ? `${esc(nombreCat(d, h.de))} → ` : ""}${esc(h.a ? nombreCat(d, h.a) : "sin categoría")}${h.motivo ? ` — «${esc(h.motivo)}»` : ""}</li>`).join("")
      }</ul></details>` : ""}`;

    const dlg = $("#dlg-clas");
    $$("#clas-ficha [data-acc]").forEach(b => b.onclick = async () => {
      const acc = b.dataset.acc;
      if(acc === "cambiar" && !$("#clas-otra").value) return aviso("Elija la categoría nueva");
      b.disabled = true;
      if(acc === "confirmar") await asignar(f, c.categoria, "", false);
      if(acc === "cambiar"){ dlg.close(); await confirmarMovida(f, $("#clas-otra").value); return; }
      if(acc === "volver") await asignar(f, null, "", false);
      if(acc === "ia") await clasificarUna(f, true, dim);
      abrirFicha(id);
    });
    $("#clas-ver").onclick = () => { dlg.close(); verDetalle(id); };
    if(!dlg.open) dlg.showModal();
  }

  /* ------------------------------ clasificar con IA ------------------------------ */

  async function clasificarUna(f, forzar, clave){
    try{
      const nueva = await api(`/clasificaciones/${clave}/${f.id}/ia`, {method:"POST", body: JSON.stringify({forzar})});
      reemplazarFila(nueva, clave);
      pintar();
      return true;
    }catch(e){ aviso(e.message); return false; }
  }

  const pendientesDe = clave => (datos[clave]?.filas || []).filter(f => !f.clasificacion?.categoria_ia || f.clasificacion.desactualizada);
  /* Propuestas vigentes hechas con un modelo anterior. El botón para rehacerlas
     solo aparece mientras queden: al terminar, desaparece solo. */
  const deOtroModeloDe = clave => (datos[clave]?.filas || []).filter(f => f.clasificacion?.otro_modelo && !f.clasificacion.desactualizada);

  function pintarBotones(clave){
    const sec = diagramas[clave]?.seccion; if(!sec) return;
    const b = sec.querySelector('[data-accion="clasificar"]'), r = sec.querySelector('[data-accion="reclasificar"]');
    if(!b) return;
    const n = pendientesDe(clave).length, m = deOtroModeloDe(clave).length;
    if(corriendo){
      b.disabled = r.disabled = true;
      if(corriendo.clave === clave){
        const activo = corriendo.modo === "reclasificar" ? r : b;
        activo.textContent = "Detener"; activo.disabled = false;
      }
      return;
    }
    b.textContent = n ? `Clasificar con IA (${n})` : "Todo clasificado";
    b.disabled = !n || !ia.disponible;
    b.title = ia.disponible ? "" : "Falta configurar OPENAI_API_KEY en el servidor";
    r.classList.toggle("oculto", !m || !ia.disponible);
    r.disabled = false;
    r.textContent = `Reclasificar con ${ia.modelo} (${m})`;
    r.title = "Estas propuestas las hizo otro modelo. Las decisiones del equipo se mantienen.";
  }

  /* Corre la IA de a una entrevista; un error de clave o saldo detiene el lote */
  async function clasificarLote(clave, modo){
    if(corriendo){ corriendo = false; return; }
    const reclasificar = modo === "reclasificar";
    const cola = reclasificar ? deOtroModeloDe(clave) : pendientesDe(clave); if(!cola.length) return;
    const nombre = dimDe(clave).nombre;
    if(reclasificar && !confirm(
      `Se volverán a clasificar ${cola.length} entrevista${cola.length === 1 ? "" : "s"} del módulo «${nombre}» con ${ia.modelo}, ` +
      `una por una (unos segundos cada una). Se reemplaza solo la propuesta de la IA: ` +
      `las categorías que el equipo confirmó o movió se mantienen.\n\n¿Continuar?`)) return;
    corriendo = {clave, modo};
    Object.keys(datos).forEach(pintarBotones);
    const prog = diagramas[clave].seccion.querySelector(".cl-progreso");
    let hechas = 0;
    for(const f of cola){
      if(!corriendo) break;
      prog.textContent = `${reclasificar ? "Reclasificando" : "Clasificando"} ${hechas + 1} de ${cola.length}…`;
      if(!await clasificarUna(f, reclasificar, clave)) break;
      hechas++;
    }
    corriendo = false;
    prog.textContent = hechas ? `${hechas} ${reclasificar ? "reclasificada" : "clasificada"}${hechas === 1 ? "" : "s"}` : "";
    Object.keys(datos).forEach(pintarBotones);
  }

  /* ------------------------------ eventos ------------------------------ */

  function conectar(){
    const caja = $("#cl-modulos"), lista = $("#cl-lista");
    caja.addEventListener("pointermove", ev => { if(!arr) tipDe(ev); });
    caja.addEventListener("pointerleave", ocultarTips);
    caja.addEventListener("click", ev => {
      const accion = ev.target.closest("[data-accion]");
      if(accion){
        const clave = accion.closest(".cl-modulo").dataset.dim;
        trabajarEn(clave);
        return clasificarLote(clave, accion.dataset.accion === "reclasificar" ? "reclasificar" : "pendientes");
      }
      const sec = ev.target.closest(".cl-modulo");
      if(!sec || !ev.target.closest(".cl-red")) return;
      const clave = sec.dataset.dim, D = diagramas[clave];
      const e = ev.target.closest("[data-enlace]"), n = ev.target.closest("[data-nodo]");
      if(e) return elegir({dim: clave, tipo:"enlace", clave: e.dataset.enlace});
      if(n && D?.geo?.nodos[n.dataset.nodo]?.n) return elegir({dim: clave, tipo:"nodo", clave: n.dataset.nodo});
      if(seleccion) elegir(null);
    });
    caja.addEventListener("keydown", ev => {
      if(ev.key !== "Enter" && ev.key !== " ") return;
      const sec = ev.target.closest(".cl-modulo"), e = ev.target.closest("[data-enlace]"), n = ev.target.closest("[data-nodo]");
      if(!sec) return;
      if(e){ ev.preventDefault(); elegir({dim: sec.dataset.dim, tipo:"enlace", clave: e.dataset.enlace}); }
      else if(n){ ev.preventDefault(); elegir({dim: sec.dataset.dim, tipo:"nodo", clave: n.dataset.nodo}); }
    });
    caja.addEventListener("focusin", ev => {
      if(!ev.target.closest?.(".cl-red")) return;
      const r = ev.target.getBoundingClientRect?.(); if(r) tipDe({target: ev.target, clientX: r.right, clientY: r.top + r.height / 2});
    });
    caja.addEventListener("focusout", ocultarTips);

    lista.addEventListener("pointerdown", alPresionarTarjeta);
    lista.addEventListener("pointermove", alMoverTarjeta);
    lista.addEventListener("pointerup", alSoltarTarjeta);
    lista.addEventListener("pointercancel", () => { if(arr){ terminarArrastre(); arr = null; } });
    lista.addEventListener("keydown", ev => {
      const t = ev.target.closest(".cl-tarjeta");
      if(t && (ev.key === "Enter" || ev.key === " ")){ ev.preventDefault(); abrirFicha(t.dataset.id); }
    });

    $("#cl-pausa").onclick = alternarPausa;
    $("#cl-municipio").onchange = () => pintar();
    $("#cl-revision").onchange = () => pintar();
    $("#cl-confianza").onchange = () => pintar();
    $("#clas-cerrar").onclick = () => $("#dlg-clas").close();
    let t, anchoAntes = 0;
    window.addEventListener("resize", () => {
      clearTimeout(t); t = setTimeout(() => {
        const ancho = $("#cl-modulos .cl-red-caja")?.clientWidth || 0;
        if(ancho === anchoAntes || $("#vista-clasificacion").classList.contains("oculto")) return;
        anchoAntes = ancho; pintar();
      }, 200);
    });
    window.matchMedia("(prefers-reduced-motion: reduce)").addEventListener?.("change", () => { pintar(); arrancarParticulas(); });
  }

  return { abrir };
})();

/* ------------------------------ pestañas del panel ------------------------------ */

(() => {
  const tabs = {entrevistas: $("#tab-entrevistas"), clasificacion: $("#tab-clasificacion")};
  function mostrar(cual){
    for(const [k, b] of Object.entries(tabs)){
      b.setAttribute("aria-selected", String(k === cual));
      $("#vista-" + k).classList.toggle("oculto", k !== cual);
    }
    try{ localStorage.setItem("uc_pestana", cual); }catch(e){}
    if(cual === "clasificacion") Clasificacion.abrir();
  }
  tabs.entrevistas.onclick = () => mostrar("entrevistas");
  tabs.clasificacion.onclick = () => mostrar("clasificacion");
  let guardada = null;
  try{ guardada = localStorage.getItem("uc_pestana"); }catch(e){}
  if(guardada === "clasificacion" && token) mostrar("clasificacion");
})();
