/* ============================================================================
   Panel — Clasificación de las entrevistas por dimensiones
   ----------------------------------------------------------------------------
   Diagrama de red en dos niveles:
     1. Las dimensiones (módulos de la guía) alrededor del corpus.
     2. Al tocar una: sus categorías, y alrededor de cada una un circulito por
        entrevista. Los circulitos se arrastran a otra categoría para que el
        equipo corrija la propuesta de la IA; un toque simple abre la ficha.
   La tabla al pie muestra lo mismo sin depender del diagrama.
   Usa api(), aviso(), esc(), $, $$ y verDetalle() de panel.js.
   ========================================================================== */

const Clasificacion = (() => {
  const NS = "http://www.w3.org/2000/svg";
  const R_PUNTO = 8, R_HUB = 32, UMBRAL_ARRASTRE = 6;

  let info = null;          // respuesta de /api/dimensiones
  let dim = null;           // dimensión abierta (nivel 2) o null (nivel 1)
  let filas = [];           // entrevistas de la dimensión abierta
  let ia = {disponible:false, modelo:""};
  let lienzo = {W:1000, H:680};
  let hubs = [];            // posiciones de las categorías en el nivel 2
  let corriendo = false;    // clasificación por lotes en curso
  let cargada = false;

  /* ------------------------------ utilidades ------------------------------ */

  function el(tag, attrs = {}, padre){
    const n = document.createElementNS(NS, tag);
    for(const [k,v] of Object.entries(attrs)) if(v != null) n.setAttribute(k, v);
    if(padre) padre.appendChild(n);
    return n;
  }
  function texto(padre, x, y, contenido, clase, extra = {}){
    const t = el("text", {x, y, class:clase, ...extra}, padre);
    t.textContent = contenido;
    return t;
  }
  /* Corre una etiqueta lo necesario para que no se salga del lienzo */
  function dentro(t, x){
    const mitad = t.getComputedTextLength() / 2, m = 10;
    const nx = Math.min(Math.max(x, m + mitad), lienzo.W - m - mitad);
    if(nx !== x) t.setAttribute("x", nx.toFixed(1));
  }

  /* Color fijo por posición de la categoría en su dimensión; «sin información» es neutra */
  function colorDe(d, clave){
    if(!clave) return "none";
    if(clave === "sin_info") return "var(--cat-neutro)";
    const i = d.categorias.filter(c => c.clave !== "sin_info").findIndex(c => c.clave === clave);
    return `var(--cat-${Math.min(i + 1, 3)})`;
  }
  const tintaSobre = clave => clave === "sin_info" ? "var(--texto)" : "#fff";
  const nombreCat = (d, clave) => (d.categorias.find(c => c.clave === clave) || {}).nombre || "Por clasificar";
  const dimAbierta = () => info?.dimensiones.find(x => x.clave === dim);

  /* Estado de revisión de cada entrevista, para los filtros, la leyenda y la tabla */
  function estadoDe(f){
    const c = f.clasificacion;
    if(!c) return "pendiente";
    if(c.categoria_final && c.categoria_ia && c.categoria_final !== c.categoria_ia) return "movida";
    if(c.categoria_final) return "equipo";
    return "ia";
  }
  const ETIQUETA_ESTADO = {pendiente:"Por clasificar", ia:"Propuesta de la IA", equipo:"Revisada por el equipo",
                           movida:"Movida por el equipo"};

  function filtradas(){
    const m = $("#cl-municipio").value, r = $("#cl-revision").value;
    return filas.filter(f => (!m || f.municipio === m) && (!r ||
      (r === "vieja" ? !!f.clasificacion?.desactualizada : estadoDe(f) === r)));
  }

  function medirLienzo(){
    const ancho = $("#cl-red-caja").clientWidth || 1000;
    lienzo = ancho < 640 ? {W:600, H:860} : {W:1000, H:680};
    $("#cl-red").setAttribute("viewBox", `0 0 ${lienzo.W} ${lienzo.H}`);
    $("#cl-red").classList.toggle("angosto", ancho < 640);
  }

  /* --------------------------------- datos --------------------------------- */

  async function cargarDimensiones(){
    info = await api("/dimensiones");
    ia = info.ia;
  }
  async function cargarFilas(){
    const r = await api("/clasificaciones/" + dim);
    filas = r.entrevistas; ia = r.ia;
    const municipios = [...new Set(filas.map(f => f.municipio).filter(Boolean))].sort((a,b) => a.localeCompare(b, "es"));
    const sel = $("#cl-municipio"), antes = sel.value;
    sel.innerHTML = `<option value="">Todos los municipios</option>` +
      municipios.map(m => `<option value="${esc(m)}">${esc(m)}</option>`).join("");
    if(municipios.includes(antes)) sel.value = antes;
  }
  function reemplazarFila(nueva){
    const i = filas.findIndex(f => f.id === nueva.id);
    if(i >= 0) filas[i] = nueva; else filas.push(nueva);
  }

  /* ------------------------------- navegación ------------------------------- */

  async function abrir(){
    if(!cargada){ conectar(); cargada = true; }
    try{
      await cargarDimensiones();
      if(dim) await cargarFilas();
      pintar();
    }catch(e){ aviso(e.message); }
  }
  async function irA(clave){
    dim = clave;
    $("#cl-revision").value = ""; $("#cl-municipio").value = "";
    try{
      if(dim) await cargarFilas(); else await cargarDimensiones();
      pintar();
    }catch(e){ aviso(e.message); }
  }

  function pintar(){
    medirLienzo();
    ocultarTip();
    const nivel2 = !!dim;
    $("#cl-filtros").classList.toggle("oculto", !nivel2);
    const migas = $("#cl-migas");
    migas.innerHTML = nivel2
      ? `<button type="button" id="cl-volver">Dimensiones</button><span aria-hidden="true">›</span>${esc(dimAbierta().nombre)}`
      : "Dimensiones";
    if(nivel2) $("#cl-volver").onclick = () => irA(null);
    if(nivel2) pintarDimension(); else pintarDimensiones();
  }

  /* ------------------------ nivel 1: las dimensiones ------------------------ */

  function pintarDimensiones(){
    const {W, H} = lienzo, cx = W/2, cy = H/2;
    const dims = info.dimensiones, total = info.total_entrevistas;
    $("#cl-titulo").textContent = "Dimensiones de análisis";
    $("#cl-bajada").textContent = "Cada círculo es un módulo de la entrevista. Toque uno con reglas para ver cómo quedaron clasificadas sus entrevistas.";
    $("#cl-ayuda").textContent = "El tamaño de cada círculo crece con las entrevistas clasificadas; el anillo muestra cómo se reparten entre las categorías.";

    const svg = $("#cl-red"); svg.innerHTML = "";
    const capaEnlaces = el("g", {}, svg), capaNodos = el("g", {}, svg);
    const rx = W * (W < 700 ? 0.33 : 0.34), ry = H * (W < 700 ? 0.34 : 0.33);

    // El corpus en el centro
    const centro = el("g", {}, capaNodos);
    el("circle", {cx, cy, r:50, fill:"var(--superficie)", stroke:"var(--borde-2)", "stroke-width":1.5}, centro);
    texto(centro, cx, cy - 4, String(total), "tx-n", {fill:"var(--texto)", style:"font-size:24px"});
    texto(centro, cx, cy + 22, "entrevistas", "tx-s");

    dims.forEach((d, i) => {
      const a = -Math.PI/2 + i / dims.length * Math.PI * 2;
      const x = cx + rx * Math.cos(a), y = cy + ry * Math.sin(a);
      const n = d.conteo.clasificadas;
      const r = d.activa ? 30 + 26 * Math.sqrt(n / Math.max(1, total)) : 24;
      el("line", {x1:cx, y1:cy, x2:x, y2:y, class:"enlace" + (d.activa ? "" : " tenue")}, capaEnlaces);

      const g = el("g", {class:"nodo" + (d.activa ? "" : " inactivo"), "data-dim":d.clave}, capaNodos);
      if(d.activa){
        g.setAttribute("tabindex", "0");
        g.setAttribute("role", "button");
        g.setAttribute("aria-label", `${d.nombre}: ${n} de ${d.conteo.elegibles} entrevistas clasificadas. Abrir.`);
      }
      el("circle", {cx:x, cy:y, r, fill:"var(--superficie)", class:"aro-foco",
        stroke: d.activa ? "var(--texto)" : "var(--borde-2)", "stroke-width": d.activa ? 1.5 : 1.2,
        "stroke-dasharray": d.activa ? null : "5 5"}, g);
      if(d.activa){
        anillo(g, d, x, y, r + 7);
        texto(g, x, y, String(n), "tx-n", {fill:"var(--texto)"});
      }
      const abajo = y >= cy - 1;
      const ty = abajo ? y + r + (d.activa ? 34 : 22) : y - r - (d.activa ? 30 : 18);
      dentro(texto(g, x, ty, d.nombre, "tx"), x);
      dentro(texto(g, x, ty + 21, d.activa ? `${n} de ${d.conteo.elegibles} clasificadas` : "Sin reglas aún", "tx-s"), x);
    });

    pintarLeyendaDimensiones();
    pintarTablaDimensiones();
  }

  /* Anillo de la distribución por categoría alrededor del nodo de la dimensión */
  function anillo(g, d, x, y, r){
    const total = Object.values(d.conteo.por_categoria).reduce((a,b) => a+b, 0);
    if(!total){
      el("circle", {cx:x, cy:y, r, fill:"none", stroke:"var(--borde)", "stroke-width":6}, g);
      return;
    }
    const hueco = 2 / r;     // 2px de superficie entre segmentos
    let a0 = -Math.PI/2;
    d.categorias.forEach(c => {
      const v = d.conteo.por_categoria[c.clave] || 0;
      if(!v) return;
      const da = v / total * Math.PI * 2;
      const ini = a0 + (v < total ? hueco/2 : 0), fin = a0 + da - (v < total ? hueco/2 : 0);
      a0 += da;
      if(v === total){
        el("circle", {cx:x, cy:y, r, fill:"none", stroke:colorDe(d, c.clave), "stroke-width":6}, g);
        return;
      }
      const p = t => `${(x + r*Math.cos(t)).toFixed(1)} ${(y + r*Math.sin(t)).toFixed(1)}`;
      el("path", {d:`M ${p(ini)} A ${r} ${r} 0 ${fin - ini > Math.PI ? 1 : 0} 1 ${p(fin)}`,
        fill:"none", stroke:colorDe(d, c.clave), "stroke-width":6, "stroke-linecap":"butt"}, g);
    });
  }

  function pintarLeyendaDimensiones(){
    const activas = info.dimensiones.filter(d => d.activa);
    $("#cl-leyenda").innerHTML = activas.map(d => d.categorias.map(c =>
      `<span>${muestra(colorDe(d, c.clave))}<b>${esc(c.nombre)}</b></span>`).join("")).join("") +
      `<span>${muestraVacia()}Módulo sin reglas</span>`;
  }

  function pintarTablaDimensiones(){
    $("#cl-tabla").innerHTML = `<thead><tr><th>Dimensión</th><th>Estado</th><th>Clasificadas</th>
      <th>Revisadas por el equipo</th><th>Por categoría</th></tr></thead><tbody>` +
      info.dimensiones.map(d => `<tr>
        <td><b>${esc(d.nombre)}</b></td>
        <td>${d.activa ? "Con reglas" : "Sin reglas aún"}</td>
        <td>${d.activa ? `${d.conteo.clasificadas} de ${d.conteo.elegibles}` : "—"}</td>
        <td>${d.activa ? d.conteo.revisadas : "—"}</td>
        <td>${d.activa ? d.categorias.map(c => `${esc(c.nombre)}: ${d.conteo.por_categoria[c.clave] || 0}`).join(" · ") : "—"}</td>
      </tr>`).join("") + `</tbody>`;
  }

  /* --------------------- nivel 2: categorías y entrevistas --------------------- */

  function pintarDimension(){
    const d = dimAbierta();
    const {W, H} = lienzo, cx = W/2, cy = H/2;
    const vista = filtradas();
    $("#cl-titulo").textContent = d.nombre;
    $("#cl-bajada").textContent = `Cada circulito es una entrevista, ubicada en la categoría que tiene hoy en esta dimensión. ` +
      `Arrástrelo a otra categoría para corregirla o tóquelo para ver por qué quedó ahí.`;
    $("#cl-ayuda").textContent = ia.disponible
      ? `La IA (${ia.modelo}) propone y el equipo decide: una categoría puesta por el equipo no se cambia al volver a clasificar.`
      : "La clasificación automática no está disponible: falta configurar OPENAI_API_KEY en el servidor. Igual puede ubicar las entrevistas a mano.";
    pintarBoton();

    // Grupos: las categorías de la dimensión y, si hay, las entrevistas por clasificar
    const grupos = d.categorias.map(c => ({clave:c.clave, nombre:c.nombre}));
    if(vista.some(f => !f.clasificacion)) grupos.push({clave:null, nombre:"Por clasificar"});
    const rx = W * (W < 700 ? 0.27 : 0.30), ry = H * (W < 700 ? 0.31 : 0.30);
    hubs = grupos.map((gr, i) => {
      const a = -Math.PI/2 + i / grupos.length * Math.PI * 2;
      return {...gr, x: cx + rx*Math.cos(a), y: cy + ry*Math.sin(a), a};
    });

    const svg = $("#cl-red"); svg.innerHTML = "";
    const capaEnlaces = el("g", {}, svg), capaHubs = el("g", {}, svg), capaPuntos = el("g", {}, svg);

    // La dimensión en el centro
    el("circle", {cx, cy, r:42, fill:"var(--superficie)", stroke:"var(--texto)", "stroke-width":1.5}, capaHubs);
    texto(capaHubs, cx, cy, String(vista.length), "tx-n", {fill:"var(--texto)", style:"font-size:21px"});

    hubs.forEach(h => {
      const miembros = vista.filter(f => (f.clasificacion?.categoria || null) === h.clave)
        .sort((a,b) => a.codigo.localeCompare(b.codigo, "es"));
      h.n = miembros.length;
      el("line", {x1:cx, y1:cy, x2:h.x, y2:h.y, class:"enlace"}, capaEnlaces);

      const g = el("g", {class:"hub", "data-hub":h.clave ?? ""}, capaHubs);
      el("circle", {cx:h.x, cy:h.y, r:R_HUB, class:"aro-foco",
        fill: h.clave ? colorDe(d, h.clave) : "var(--superficie)",
        stroke: h.clave ? "var(--superficie-2)" : "var(--borde-2)", "stroke-width":2,
        "stroke-dasharray": h.clave ? null : "5 5"}, g);
      texto(g, h.x, h.y, String(h.n), "tx-n", {fill: h.clave ? tintaSobre(h.clave) : "var(--texto)"});

      // Los circulitos en espiral (filotaxis) alrededor de su categoría
      const r0 = R_HUB + 18, rmax = Math.min(W < 700 ? 150 : 140, Math.max(r0 + 20, 22 + 15 * Math.sqrt(h.n)));
      const paso = Math.max(9.5, Math.min(15.5, (rmax - r0) / Math.sqrt(Math.max(1, h.n - 1))));
      h.radio = r0 + paso * Math.sqrt(Math.max(0, h.n - 1)) + R_PUNTO;
      miembros.forEach((f, i) => {
        const rr = r0 + paso * Math.sqrt(i), ang = i * 2.39996 + h.a;
        f._x = h.x + rr * Math.cos(ang); f._y = h.y + rr * Math.sin(ang);
        el("line", {x1:h.x, y1:h.y, x2:f._x, y2:f._y, class:"enlace tenue"}, capaEnlaces);
        pintarPunto(capaPuntos, d, f);
      });

      // Nombre de la categoría por fuera del grupo, del lado opuesto al centro
      const fuera = Math.sin(h.a) >= -0.2;    // abajo o a los lados → debajo
      const ty = fuera ? h.y + h.radio + 22 : h.y - h.radio - 26;
      dentro(texto(g, h.x, ty, h.nombre, "tx"), h.x);
      dentro(texto(g, h.x, ty + 21, `${h.n} entrevista${h.n === 1 ? "" : "s"}`, "tx-s"), h.x);
    });

    pintarLeyendaDimension(d);
    pintarTablaDimension(d, vista);
  }

  function pintarPunto(capa, d, f){
    const c = f.clasificacion, estado = estadoDe(f);
    const g = el("g", {class:"punto", "data-id":f.id, tabindex:0, role:"button",
      style:`transform:translate(${f._x.toFixed(1)}px,${f._y.toFixed(1)}px)`,
      "aria-label":`${f.codigo}, ${f.municipio || "sin municipio"}: ${c ? nombreCat(d, c.categoria) : "por clasificar"}, ${ETIQUETA_ESTADO[estado].toLowerCase()}. Abrir ficha.`}, capa);
    el("circle", {r:13, fill:"transparent", class:"golpe", stroke:"none"}, g);      // área de toque de 26px
    if(c?.desactualizada)
      el("circle", {r:R_PUNTO + 4.5, fill:"none", stroke:"var(--estado-aviso)", "stroke-width":2, "stroke-dasharray":"3 2.5"}, g);
    if(!c){
      el("circle", {r:R_PUNTO - 1, fill:"var(--superficie)", stroke:"var(--suave)", "stroke-width":1.5}, g);
    }else{
      const revisada = estado === "equipo" || estado === "movida";
      el("circle", {r:R_PUNTO, fill:colorDe(d, c.categoria),
        stroke: revisada ? "var(--texto)" : "var(--superficie-2)", "stroke-width": revisada ? 2.5 : 2}, g);
      if(estado === "movida") el("circle", {r:2.6, fill:"var(--superficie)"}, g);
    }
  }

  function pintarLeyendaDimension(d){
    const cats = d.categorias.map(c => `<span>${muestra(colorDe(d, c.clave))}<b>${esc(c.nombre)}</b></span>`).join("");
    $("#cl-leyenda").innerHTML = cats +
      `<span>${muestraPunto("ia")}Propuesta de la IA</span>` +
      `<span>${muestraPunto("equipo")}Revisada por el equipo</span>` +
      `<span>${muestraPunto("movida")}Movida por el equipo</span>` +
      `<span>${muestraPunto("vieja")}Desactualizada</span>` +
      `<span>${muestraPunto("pendiente")}Por clasificar</span>`;
  }

  function pintarTablaDimension(d, vista){
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

  /* Muestras pequeñas para la leyenda */
  const muestra = color => `<svg width="14" height="14" aria-hidden="true"><circle cx="7" cy="7" r="6" fill="${color}"/></svg>`;
  const muestraVacia = () => `<svg width="14" height="14" aria-hidden="true"><circle cx="7" cy="7" r="5.5" fill="none" stroke="var(--borde-2)" stroke-dasharray="3 3"/></svg>`;
  function muestraPunto(tipo){
    const base = `<svg width="22" height="22" viewBox="-11 -11 22 22" aria-hidden="true">`;
    if(tipo === "pendiente") return base + `<circle r="6" fill="var(--superficie)" stroke="var(--suave)" stroke-width="1.5"/></svg>`;
    if(tipo === "vieja") return base + `<circle r="9.5" fill="none" stroke="var(--estado-aviso)" stroke-width="2" stroke-dasharray="3 2.5"/><circle r="6" fill="var(--cat-neutro)"/></svg>`;
    const anillo = tipo === "ia" ? "" : ` stroke="var(--texto)" stroke-width="2.2"`;
    return base + `<circle r="6.5" fill="var(--cat-neutro)"${anillo}/>` +
      (tipo === "movida" ? `<circle r="2.3" fill="var(--superficie)"/>` : "") + `</svg>`;
  }
  const chip = (d, clave) => `<span class="cl-chip"><i style="background:${colorDe(d, clave)}"></i>${esc(nombreCat(d, clave))}</span>`;

  /* ------------------------------ tooltip ------------------------------ */

  function mostrarTip(ev, f){
    const d = dimAbierta(), c = f.clasificacion, tip = $("#cl-tip");
    tip.replaceChildren();
    const b = document.createElement("b"); b.textContent = f.codigo; tip.appendChild(b);
    const lin = (t, color) => {
      const s = document.createElement("div");
      if(color){ const i = document.createElement("i"); i.style.background = color; s.appendChild(i); }
      s.appendChild(document.createTextNode(t)); tip.appendChild(s);
    };
    lin(f.municipio || "Sin municipio");
    lin(c ? nombreCat(d, c.categoria) : "Por clasificar", c ? colorDe(d, c.categoria) : null);
    lin(ETIQUETA_ESTADO[estadoDe(f)] + (c?.confianza && !c.categoria_final ? ` · confianza ${c.confianza}` : ""));
    if(c?.categoria_final && c.categoria_ia && c.categoria_final !== c.categoria_ia) lin(`La IA había propuesto: ${nombreCat(d, c.categoria_ia)}`);
    if(c?.desactualizada) lin("⚠ Las respuestas cambiaron o las reglas son nuevas");
    tip.classList.remove("oculto");
    moverTip(ev);
  }
  function moverTip(ev){
    const tip = $("#cl-tip"), caja = $("#cl-red-caja").getBoundingClientRect();
    let x = ev.clientX - caja.left + 14, y = ev.clientY - caja.top + 14;
    if(x + tip.offsetWidth > caja.width - 6) x = ev.clientX - caja.left - tip.offsetWidth - 14;
    if(y + tip.offsetHeight > caja.height - 6) y = ev.clientY - caja.top - tip.offsetHeight - 14;
    tip.style.left = Math.max(6, x) + "px"; tip.style.top = Math.max(6, y) + "px";
  }
  const ocultarTip = () => $("#cl-tip")?.classList.add("oculto");

  /* ------------------------------ arrastrar ------------------------------ */

  let arr = null;

  function aSvg(ev){
    const svg = $("#cl-red"), pt = svg.createSVGPoint();
    pt.x = ev.clientX; pt.y = ev.clientY;
    return pt.matrixTransform(svg.getScreenCTM().inverse());
  }
  function hubBajo(x, y){
    let mejor = null, dmin = Infinity;
    for(const h of hubs){
      if(!h.clave) continue;                       // a «por clasificar» no se suelta
      const dd = Math.hypot(h.x - x, h.y - y);
      if(dd < Math.max(R_HUB + 34, h.radio * 0.8) && dd < dmin){ mejor = h; dmin = dd; }
    }
    return mejor;
  }
  function marcarDestino(h){
    $$("#cl-red .hub").forEach(g => g.classList.toggle("destino", !!h && g.dataset.hub === h.clave));
  }

  function alPresionar(ev){
    const g = ev.target.closest(".punto"); if(!g || ev.button > 0) return;
    const f = filas.find(x => x.id === g.dataset.id); if(!f) return;
    arr = {g, f, x0:ev.clientX, y0:ev.clientY, moviendo:false, id:ev.pointerId};
    $("#cl-red").setPointerCapture(ev.pointerId);
  }
  function alMover(ev){
    if(!arr){
      const g = ev.target.closest?.(".punto");
      if(g){ const f = filas.find(x => x.id === g.dataset.id); if(f) mostrarTip(ev, f); }
      else ocultarTip();
      return;
    }
    if(!arr.moviendo && Math.hypot(ev.clientX - arr.x0, ev.clientY - arr.y0) < UMBRAL_ARRASTRE) return;
    if(!arr.moviendo){
      arr.moviendo = true; ocultarTip();
      arr.g.classList.add("arrastrando");
      arr.g.parentNode.appendChild(arr.g);        // queda encima de los demás
    }
    const p = aSvg(ev);
    arr.g.style.transform = `translate(${p.x.toFixed(1)}px,${p.y.toFixed(1)}px)`;
    arr.destino = hubBajo(p.x, p.y);
    marcarDestino(arr.destino);
  }
  function alSoltar(){
    if(!arr) return;
    const {g, f, moviendo, destino} = arr;
    arr = null;
    marcarDestino(null);
    g.classList.remove("arrastrando");
    if(!moviendo){ abrirFicha(f.id); return; }
    const actual = f.clasificacion?.categoria || null;
    const volver = () => { g.style.transform = `translate(${f._x.toFixed(1)}px,${f._y.toFixed(1)}px)`; };
    if(!destino || destino.clave === actual){ volver(); return; }
    confirmarMovida(f, destino.clave).then(ok => { if(!ok) volver(); });
  }

  /* Confirmación con motivo opcional; resuelve true si se movió */
  function confirmarMovida(f, a){
    const d = dimAbierta(), dlg = $("#dlg-mover");
    const de = f.clasificacion ? `de «${nombreCat(d, f.clasificacion.categoria)}» ` : "";
    $("#mover-texto").textContent = `¿Mover la entrevista ${f.codigo} ${de}a «${nombreCat(d, a)}»?`;
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
    const antes = f.clasificacion ? f.clasificacion.categoria_final : null;
    try{
      const nueva = await api(`/clasificaciones/${dim}/${f.id}/asignar`,
        {method:"POST", body: JSON.stringify({categoria, motivo})});
      reemplazarFila(nueva);
      pintar();
      if(deshacible) ofrecerDeshacer(`${f.codigo} quedó en «${nombreCat(dimAbierta(), categoria)}»`, async () => {
        const vuelta = await api(`/clasificaciones/${dim}/${f.id}/asignar`,
          {method:"POST", body: JSON.stringify({categoria: antes, motivo: "Deshacer"})});
        reemplazarFila(vuelta); pintar(); aviso("Cambio deshecho");
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
    ocultarTip();
    const d = dimAbierta(), c = f.clasificacion, estado = estadoDe(f);
    const fecha = t => t ? new Date(t).toLocaleString("es-CO", {dateStyle:"medium", timeStyle:"short"}) : "";
    const otras = d.categorias.filter(x => x.clave !== c?.categoria);
    const evid = c ? d.categorias.filter(x => (c.evidencias?.[x.clave] || []).length).map(x => `
      <div class="pq">${chip(d, x.clave)}</div>
      <ul class="cl-citas">${c.evidencias[x.clave].map(t => `<li>«${esc(t)}»</li>`).join("")}</ul>`).join("") : "";

    $("#clas-ficha").innerHTML = `
      <div class="gorro">${esc(d.nombre)}</div>
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
      if(acc === "ia") await clasificarUna(f, true);
      abrirFicha(id);
    });
    $("#clas-ver").onclick = () => { dlg.close(); verDetalle(id); };
    if(!dlg.open) dlg.showModal();
  }

  /* ------------------------------ clasificar con IA ------------------------------ */

  async function clasificarUna(f, forzar){
    try{
      const nueva = await api(`/clasificaciones/${dim}/${f.id}/ia`, {method:"POST", body: JSON.stringify({forzar})});
      reemplazarFila(nueva);
      pintar();
      return true;
    }catch(e){ aviso(e.message); return false; }
  }

  const pendientes = () => filas.filter(f => !f.clasificacion?.categoria_ia || f.clasificacion.desactualizada);

  function pintarBoton(){
    const b = $("#cl-clasificar"), n = pendientes().length;
    if(corriendo){ b.textContent = "Detener"; b.disabled = false; return; }
    b.textContent = n ? `Clasificar con IA (${n})` : "Todo clasificado";
    b.disabled = !n || !ia.disponible;
    b.title = ia.disponible ? "" : "Falta configurar OPENAI_API_KEY en el servidor";
  }

  async function clasificarPendientes(){
    if(corriendo){ corriendo = false; return; }
    const cola = pendientes(); if(!cola.length) return;
    corriendo = true; pintarBoton();
    let hechas = 0;
    for(const f of cola){
      if(!corriendo) break;
      $("#cl-progreso").textContent = `Clasificando ${hechas + 1} de ${cola.length}…`;
      if(!await clasificarUna(f, false)) break;       // un error de clave o saldo detiene el lote
      hechas++;
    }
    corriendo = false;
    $("#cl-progreso").textContent = hechas ? `${hechas} clasificada${hechas === 1 ? "" : "s"}` : "";
    pintarBoton();
  }

  /* ------------------------------ eventos ------------------------------ */

  function conectar(){
    const svg = $("#cl-red");
    svg.addEventListener("pointerdown", alPresionar);
    svg.addEventListener("pointermove", alMover);
    svg.addEventListener("pointerup", alSoltar);
    svg.addEventListener("pointercancel", () => { if(arr){ arr = null; marcarDestino(null); pintar(); } });
    svg.addEventListener("pointerleave", () => { if(!arr) ocultarTip(); });
    svg.addEventListener("click", ev => {
      const n = ev.target.closest(".nodo:not(.inactivo)");
      if(n && !dim) irA(n.dataset.dim);
    });
    svg.addEventListener("keydown", ev => {
      if(ev.key !== "Enter" && ev.key !== " ") return;
      const n = ev.target.closest(".nodo:not(.inactivo)"), p = ev.target.closest(".punto");
      if(n && !dim){ ev.preventDefault(); irA(n.dataset.dim); }
      if(p){ ev.preventDefault(); abrirFicha(p.dataset.id); }
    });
    svg.addEventListener("focusin", ev => {
      const p = ev.target.closest(".punto"); if(!p) return;
      const f = filas.find(x => x.id === p.dataset.id), r = p.getBoundingClientRect();
      if(f) mostrarTip({clientX: r.right, clientY: r.bottom}, f);
    });
    svg.addEventListener("focusout", ocultarTip);
    $("#cl-municipio").onchange = pintar;
    $("#cl-revision").onchange = pintar;
    $("#cl-clasificar").onclick = clasificarPendientes;
    $("#clas-cerrar").onclick = () => $("#dlg-clas").close();
    let t; window.addEventListener("resize", () => {
      clearTimeout(t); t = setTimeout(() => { if(!$("#vista-clasificacion").classList.contains("oculto")) pintar(); }, 200);
    });
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
