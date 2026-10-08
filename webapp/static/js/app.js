/* ============================================================================
   Familia, diversidad y territorio: dinámicas familiares en el Eje Cafetero
   Universidad de Caldas — Colectivo Estudios de Familia · GESEXREC · GITIR

   App de la entrevista. Es abierta: cualquiera puede responderla con el enlace,
   sin cuenta ni contraseña. El inicio de sesión vive en /panel y sirve solo para
   que el equipo vea, revise y exporte los resultados.

   Funciona sin señal: todo se guarda primero en el teléfono y se envía al
   servidor apenas hay conexión.
   ========================================================================== */

/* ---------------------------- La guía de entrevista ---------------------------- */

const BLOQUES = [
  { clave:"p1", gorro:"Su familia", titulo:"Cambios en su familia",
    campos:[
      {k:"r1a", q:"¿Cuáles han sido las situaciones más importantes que ha vivido su familia y cómo esos cambios transformaron la manera de vivir juntos?"},
      {k:"r1b", q:"Si en los últimos 5 años llegaron o salieron personas, ¿qué ha pasado en su familia?"}
    ]},

  { clave:"p2", gorro:"Una situación que los cambió",
    titulo:"Una situación vivida por un integrante que transformó la vida de todos",
    intro:"Comparta una situación vivida por un integrante de la familia que haya transformado la vida de todos ustedes.",
    campos:[
      {k:"r2a", q:"¿Qué ocurrió?"},
      {k:"r2b", q:"¿Cómo reaccionó la familia?"},
      {k:"r2c", q:"¿Quiénes asumieron nuevas responsabilidades?"},
      {k:"r2d", q:"¿Qué aprendizajes dejó esa experiencia?"}
    ]},

  { clave:"p3", gorro:"El cuidado", titulo:"En su familia…",
    campos:[
      {k:"r3a", q:"¿A quién cuido?"},
      {k:"r3b", q:"¿Cómo cuido?"},
      {k:"r3c", q:"¿Quién me cuida?"},
      {k:"r3d", q:"¿Cómo me cuido?"}
    ]},

  { clave:"p4", gorro:"El cuidado", titulo:"¿Quién cuida a…?",
    intro:"Escriba quién se encarga en cada caso. Si en la familia no hay alguien de ese grupo, puede dejarlo vacío.",
    campos:[
      {k:"r4a", q:"Los niños y las niñas", corto:true},
      {k:"r4b", q:"Los jóvenes", corto:true},
      {k:"r4c", q:"Los adultos mayores", corto:true},
      {k:"r4d", q:"Los integrantes con discapacidad", corto:true},
      {k:"r4e", q:"Las personas enfermas", corto:true}
    ]},

  { clave:"p5", gorro:"El cuidado", titulo:"Acuerdos y apoyos para cuidar",
    campos:[
      {k:"r5a", q:"¿Cómo acuerdan quién cuida?"},
      {k:"r5b", q:"¿Quién suele asumir mayores responsabilidades en las tareas de cuidado?"},
      {k:"r5c", q:"¿Reciben apoyo de familiares, instituciones o comunidad para el cuidado de algún integrante de la familia?"}
    ]},

  { clave:"p6", gorro:"Las decisiones", titulo:"¿Cómo toman las decisiones en su familia?",
    intro:"Cuéntenos quién decide y cómo se ponen de acuerdo en cada caso.",
    campos:[
      {k:"r6a", q:"Las vacaciones", corto:true},
      {k:"r6b", q:"La compra del mercado", corto:true},
      {k:"r6c", q:"Los permisos", corto:true},
      {k:"r6d", q:"La distribución del dinero", corto:true},
      {k:"r6e", q:"Las tareas domésticas", corto:true},
      {k:"r6f", q:"Las inversiones: electrodomésticos, vivienda, medios de transporte, entre otros", corto:true}
    ]},

  { clave:"p7", gorro:"Apoyos y territorio", titulo:"Quiénes y qué espacios los han apoyado",
    campos:[
      {k:"r7a", q:"Además de las personas que viven en este hogar, ¿quiénes o qué espacios han sido fundamentales para que su familia salga adelante?"},
      {k:"r7b", q:"¿De qué manera el lugar donde viven ha influido en la forma como organizan su vida familiar?"}
    ]},

  { clave:"p8", gorro:"El futuro", titulo:"Su familia dentro de 5 años",
    campos:[
      {k:"r8a", q:"Pensando en el futuro, ¿cómo imagina a su familia en 5 años?"},
      {k:"r8b", q:"¿Cuáles cree que serán sus principales desafíos?"}
    ]},

  { clave:"p9", gorro:"Para terminar", titulo:"Algo más que quiera contar",
    campos:[
      {k:"r9", q:"¿Hay algo importante sobre su familia o sobre su experiencia que no le haya preguntado y que considere importante compartir?"}
    ]}
];

const DEPARTAMENTOS = ["Caldas","Risaralda","Quindío","Antioquia","Tolima","Valle del Cauca"];

/* Los 27 municipios de Caldas. Se eligen de una lista para que el municipio
   quede siempre escrito igual y las estadísticas no se partan en tres. */
const MUNICIPIOS_CALDAS = [
  "Aguadas","Anserma","Aranzazu","Belalcázar","Chinchiná","Filadelfia","La Dorada",
  "La Merced","Manizales","Manzanares","Marmato","Marquetalia","Marulanda","Neira",
  "Norcasia","Pácora","Palestina","Pensilvania","Riosucio","Risaralda","Salamina",
  "Samaná","San José","Supía","Victoria","Villamaría","Viterbo"
];
const OTRO_MUNICIPIO = "__otro__";

/* Paso 0 = ficha de datos, 1 = dibujo, 2..N = bloques, último = cierre */
const TOTAL = 2 + BLOQUES.length + 1;

/* --------------------------------- Utilidades --------------------------------- */

const $  = (s,r=document) => r.querySelector(s);
const $$ = (s,r=document) => [...r.querySelectorAll(s)];
const esc = s => String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const uid = p => p + Math.random().toString(36).slice(2,9) + Date.now().toString(36).slice(-4);
const clamp = (v,a,b) => Math.max(a, Math.min(b, v));

function aviso(m){
  const t = $("#aviso"); t.textContent = m; t.classList.add("on");
  clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove("on"), 2400);
}
function ajustar(t){
  if(!t || !t.value){ t.style.height = ""; return; }
  t.style.height = "auto";
  const h = t.scrollHeight;
  t.style.height = (h && t.offsetParent) ? (h+2)+"px" : "";
}

/* ------------------------------- Almacenamiento ------------------------------- */

const LS_ENTREVISTAS = "uc_entrevistas", LS_ACTUAL = "uc_actual", LS_PENDIENTES = "uc_pendientes";
const LS_CODIGO = "uc_codigo_acceso";

const leerJSON = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch(e){ return d; } };
const guardarJSON = (k, v) => localStorage.setItem(k, JSON.stringify(v));

/* Código de acceso: llega en el enlace (…/?c=elcodigo) y queda guardado en el
   teléfono para que la app siga sirviendo sin señal y sin volver a pedirlo. */
let codigoAcceso = (new URLSearchParams(location.search).get("c") || "").trim()
                   || localStorage.getItem(LS_CODIGO) || "";

/* ---------------------------------- Servidor ---------------------------------- */

async function api(ruta, opciones = {}){
  const r = await fetch("/api" + ruta, {
    ...opciones,
    headers: {
      "Content-Type": "application/json",
      ...(codigoAcceso ? {"X-Codigo-Acceso": codigoAcceso} : {}),
      ...(opciones.headers || {})
    }
  });
  if(!r.ok){
    let msg = "No se pudo conectar";
    try { msg = (await r.json()).detail || msg; } catch(e){}
    const err = new Error(msg);
    err.estado = r.status;
    throw err;
  }
  return r.status === 204 ? null : r.json();
}

/* ------------------------------ Estado en memoria ------------------------------ */

function nueva(){
  const respuestas = {};
  BLOQUES.forEach(b => b.campos.forEach(c => respuestas[c.k] = ""));
  const d = new Date(), pad = n => String(n).padStart(2,"0");
  return {
    id: uid("e"),
    codigo: `ENT-${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`,
    creada: d.toISOString(),
    actualizada: d.toISOString(),
    paso: 0,
    terminada: false,
    consentimiento: { acepta:false, aceptado_en:null },
    datos: { departamento:"Caldas", municipio:"", lugar:"", zona:"",
             fecha:d.toISOString().slice(0,10), identidad:"", edad:"" },
    dibujo: { personas:[] },
    respuestas
  };
}

function reparar(e){
  const base = nueva();
  e.consentimiento = Object.assign(base.consentimiento, e.consentimiento || {});
  e.datos = Object.assign(base.datos, e.datos || {});
  e.dibujo = Object.assign({personas:[]}, e.dibujo || {});
  e.dibujo.personas = (e.dibujo.personas || []).map(p => ({
    id: p.id || uid("m"), tipo: p.tipo || p.figura || "mujer",
    nombre: p.nombre || "", parentesco: p.parentesco || "",
    x: p.x ?? Dibujo.CX, y: p.y ?? Dibujo.CY,
    zona: p.zona || (p.ubicacion === "fuera" || p.ubicacion === "cerca" ? "fuera" : "casa")
  }));
  // si la guía cambió, conserva lo que exista y agrega las claves nuevas vacías
  e.respuestas = Object.assign(base.respuestas, e.respuestas || {});
  e.codigo = e.codigo || base.codigo;
  e.paso = e.paso || 0;
  return e;
}

let S = nueva();
let sel = null;        // muñeco seleccionado
let arrastre = null;

/* --------------------------- Guardar y sincronizar --------------------------- */

function paquete(e){
  e = e || S;
  const respuestas = [];
  BLOQUES.forEach(b => b.campos.forEach(c => respuestas.push({
    bloque: b.clave, bloque_titulo: b.titulo, campo: c.k,
    pregunta: c.q, respuesta: e.respuestas[c.k] || ""
  })));
  const personas = e.dibujo.personas.map(p => {
    const mascota = Dibujo.esMascota(p.tipo);
    return {
      id: p.id, nombre: p.nombre, parentesco: p.parentesco, figura: p.tipo,
      tipo_integrante: mascota ? "mascota" : "persona",
      ubicacion: p.zona,
      ubicacion_texto: p.zona === "casa"
        ? (mascota ? "Mascota que vive en la casa" : "Vive en la misma casa")
        : (mascota ? "Mascota que no vive en la casa" : "Persona cercana importante que no vive ahí"),
      x: p.x, y: p.y
    };
  });
  const soloPersonas = personas.filter(p => p.tipo_integrante === "persona");
  const soloMascotas = personas.filter(p => p.tipo_integrante === "mascota");
  return {
    formato: "uc.familia.entrevista/3",
    proyecto: "Familia, diversidad y territorio: dinámicas familiares en el Eje Cafetero",
    id: e.id, codigo: e.codigo, creada: e.creada, actualizada: e.actualizada,
    terminada: !!e.terminada,
    consentimiento: e.consentimiento,
    datos: e.datos,
    dibujo: {
      personas,
      resumen: {
        total: personas.length,
        personas: soloPersonas.length,
        mascotas: soloMascotas.length,
        en_la_casa: soloPersonas.filter(p => p.ubicacion === "casa").length,
        cercanas: soloPersonas.filter(p => p.ubicacion === "fuera").length,
        mascotas_en_la_casa: soloMascotas.filter(p => p.ubicacion === "casa").length
      }
    },
    respuestas
  };
}

let tGuardar = null;
function guardar(ya){
  clearTimeout(tGuardar);
  const hacer = () => {
    S.actualizada = new Date().toISOString();
    const t = leerJSON(LS_ENTREVISTAS, {});
    t[S.id] = S;
    guardarJSON(LS_ENTREVISTAS, t);
    localStorage.setItem(LS_ACTUAL, S.id);
    encolar(S.id);
    sincronizar();
  };
  ya ? hacer() : (tGuardar = setTimeout(hacer, 600));
}

function encolar(id){
  const p = new Set(leerJSON(LS_PENDIENTES, []));
  p.add(id);
  guardarJSON(LS_PENDIENTES, [...p]);
  pintarSincro();
}

let sincronizando = false;
let repetirSincro = false;

async function sincronizar(){
  // Si ya hay un envío en curso, se marca para repetirlo al terminar: así no se
  // pierde lo que se escriba mientras se está enviando.
  if(sincronizando){ repetirSincro = true; return; }
  if(!navigator.onLine){ pintarSincro(); return; }

  if(!leerJSON(LS_PENDIENTES, []).length){ pintarSincro(); return; }
  sincronizando = true; pintarSincro();

  // Cada entrevista se saca de la cola ANTES de enviarla y se relee del teléfono
  // en ese momento. Si mientras se envía la docente escribe algo, `encolar` la
  // vuelve a poner en la cola y se envía en la siguiente vuelta.
  let vueltas = 0;
  while(vueltas++ < 25){
    const cola = leerJSON(LS_PENDIENTES, []);
    if(!cola.length) break;
    const id = cola[0];
    guardarJSON(LS_PENDIENTES, cola.slice(1));
    const e = leerJSON(LS_ENTREVISTAS, {})[id];
    if(!e) continue;
    try {
      await api(`/entrevistas/${id}`, {method:"PUT", body: JSON.stringify(paquete(e))});
    } catch(err){
      // 409 = ya la revisó el equipo; reintentar no sirve de nada
      if(err.estado !== 409) encolar(id);
      break;
    }
  }

  sincronizando = false;
  pintarSincro();
  if(repetirSincro){ repetirSincro = false; sincronizar(); }
}

function pintarSincro(){
  const el = $("#sincro"); if(!el) return;
  const n = leerJSON(LS_PENDIENTES, []).length;
  let clase = "ok", texto = "Enviado al servidor";
  if(sincronizando){ clase = "espera"; texto = "Enviando…"; }
  else if(!navigator.onLine){ clase = "espera"; texto = n ? `Sin señal · ${n} por enviar` : "Sin señal"; }
  else if(n){ clase = "espera"; texto = `${n} por enviar`; }
  el.innerHTML = `<i class="punto ${clase}"></i><span>${texto}</span>`;
}

window.addEventListener("online", sincronizar);
window.addEventListener("offline", pintarSincro);
setInterval(sincronizar, 45000);

/* --------------------------------- Pantallas --------------------------------- */

function mostrar(cual){
  ["codigo","consent","gracias","form"].forEach(p =>
    $("#pantalla-"+p).classList.toggle("oculto", p !== cual));
  document.body.classList.toggle("con-nav", cual === "form");
  window.scrollTo({top:0});
}

/* ------------------------------ Código de acceso ------------------------------ */

async function codigoSirve(codigo){
  const previo = codigoAcceso;
  codigoAcceso = codigo;
  try { await api("/verificar-codigo", {method:"POST", body:"{}"}); return true; }
  catch(e){
    if(e.estado === 403){ codigoAcceso = previo; return false; }
    return true;      // sin señal no se puede comprobar: se deja pasar
  }
}

/* Aviso grande cuando el servidor todavía no tiene base de datos permanente:
   sirve para demostrar la app, pero no para recoger entrevistas de verdad. */
function avisarBaseTemporal(){
  if($("#aviso-temporal")) return;
  const d = document.createElement("div");
  d.id = "aviso-temporal";
  d.style.cssText = "background:#a83232;color:#fff;padding:10px 16px;font-size:14px;" +
    "text-align:center;position:sticky;top:0;z-index:60;line-height:1.4";
  d.innerHTML = "<b>Modo de prueba.</b> Este servidor aún no tiene base de datos " +
    "permanente: lo que se responda aquí <b>se pierde</b>. No lo use en campo todavía.";
  document.body.prepend(d);
}

/* Devuelve true si se puede seguir a la entrevista */
async function revisarAcceso(){
  let cfg;
  try { cfg = await api("/config"); }
  catch(e){ return true; }                 // sin señal: se confía en lo guardado
  if(cfg.almacenamiento_efimero) avisarBaseTemporal();
  if(!cfg.requiere_codigo) return true;
  if(codigoAcceso && await codigoSirve(codigoAcceso)){
    localStorage.setItem(LS_CODIGO, codigoAcceso);
    return true;
  }
  return false;
}

function pedirCodigo(){
  mostrar("codigo");
  const err = $("#codigo-error");
  $("#in-codigo").value = "";
  $("#btn-codigo").onclick = async () => {
    const valor = $("#in-codigo").value.trim();
    err.classList.add("oculto");
    if(!valor){ err.textContent = "Escriba el código."; err.classList.remove("oculto"); return; }
    if(await codigoSirve(valor)){
      localStorage.setItem(LS_CODIGO, valor);
      arrancarEntrevista();
    } else {
      err.textContent = "Ese código no es válido. Verifíquelo con el equipo de investigación.";
      err.classList.remove("oculto");
    }
  };
  $("#in-codigo").addEventListener("keydown", e => { if(e.key === "Enter") $("#btn-codigo").click(); });
}

/* Empieza una entrevista nueva en la pantalla del consentimiento */
function arrancarEntrevista(){
  S = nueva(); sel = null;
  mostrar("consent");
}

function aceptarConsentimiento(){
  S.consentimiento.acepta = true;
  S.consentimiento.aceptado_en = new Date().toISOString();
  guardar(true);
  pintarValores();
  mostrar("form");
  irA(0);
}

async function rechazarConsentimiento(){
  mostrar("gracias");
  try { await api("/rechazos", {method:"POST", body: JSON.stringify({municipio:"", zona:""})}); } catch(e){}
}

/* ------------------------------ Armado de pasos ------------------------------ */

function pintarPasos(){
  let h = "";

  /* Paso 0 — ficha */
  h += `<div class="paso oculto" data-paso="0"><div class="tarjeta">
    <div class="gorro">Paso 1</div>
    <h2 class="titulo">Datos de la entrevista</h2>
    <p class="bajada">Los diligencia la persona que acompaña la entrevista.</p>

    <div class="fila" style="margin-top:18px">
      <div><label class="mini" for="d-dep">Departamento</label>
        <input type="text" id="d-dep" data-d="departamento" list="dl-dep" autocomplete="off">
        <datalist id="dl-dep">${DEPARTAMENTOS.map(d=>`<option value="${d}">`).join("")}</datalist></div>
      <div><label class="mini" for="d-mun">Municipio</label>
        <select id="d-mun">
          <option value="">Elija el municipio…</option>
          ${MUNICIPIOS_CALDAS.map(m=>`<option value="${esc(m)}">${esc(m)}</option>`).join("")}
          <option value="${OTRO_MUNICIPIO}">Otro municipio…</option>
        </select>
        <input type="text" id="d-mun-otro" class="oculto" style="margin-top:8px"
          placeholder="Escriba el municipio" autocomplete="off"></div>
    </div>

    <div class="campo"><label class="mini" for="d-lugar">Vereda o barrio</label>
      <input type="text" id="d-lugar" data-d="lugar" autocomplete="off"></div>

    <div class="campo"><label class="q">Zona</label>
      <div class="ops">${["Urbana","Rural","Centro poblado"].map(z=>
        `<label><input type="radio" name="zona" value="${z}"> <span>${z}</span></label>`).join("")}</div></div>

    <div class="campo" style="max-width:260px"><label class="mini" for="d-fecha">Fecha</label>
      <input type="date" id="d-fecha" data-d="fecha"></div>

    <div class="campo"><label class="q">Participante</label>
      <div class="ops">${["Mujer","Hombre","Otra identidad de género"].map(g=>
        `<label><input type="radio" name="ident" value="${g}"> <span>${g}</span></label>`).join("")}</div></div>

    <div class="campo" style="max-width:200px"><label class="mini" for="d-edad">Edad</label>
      <input type="number" id="d-edad" data-d="edad" min="0" max="120" inputmode="numeric"></div>
  </div></div>`;

  /* Paso 1 — el dibujo */
  h += `<div class="paso oculto" data-paso="1" id="paso-dibujo"><div class="tarjeta">
    <div class="gorro">Paso 2</div>
    <h2 class="titulo">El dibujo de su familia</h2>
    <p class="bajada"><b>Arrastre</b> un muñeco por cada integrante, incluidas las mascotas:
    <b>adentro del círculo</b> quienes viven juntos, <b>afuera</b> los cercanos importantes.</p>

    <div class="paleta" id="paleta">
      ${Dibujo.MUNECOS.map(m=>`<button type="button" class="pieza" data-tipo="${m.v}">
        <svg width="40" height="46" viewBox="-28 -34 56 62" aria-hidden="true">
          <g fill="#2f7d5f" transform="scale(${Dibujo.escala(m.v)})">${Dibujo.glifo(m.v)}</g></svg>
        <span>${m.l}</span></button>`).join("")}
    </div>

    <div class="lienzo-caja" id="lienzo-caja">
      <div class="lienzo"><svg id="dibujo" viewBox="0 0 ${Dibujo.W} ${Dibujo.H}"
        role="img" aria-label="Dibujo de la familia"></svg></div>

      <!-- Ficha flotante: aparece sobre el muñeco para no mover la pantalla -->
      <div class="globo oculto" id="globo">
        <i class="pico"></i>
        <input type="text" id="g-nombre" placeholder="Nombre. Ej. María" autocomplete="off">
        <input type="text" id="g-par" list="dl-par" placeholder="¿Qué es de usted? Ej. Mamá" autocomplete="off">
        <datalist id="dl-par">${Dibujo.PARENTESCOS.map(v=>`<option value="${esc(v)}">`).join("")}</datalist>
        <div class="donde">
          <button type="button" id="g-casa">🏠 Vive aquí</button>
          <button type="button" id="g-fuera" class="fuera">💛 No vive aquí</button>
        </div>
        <div class="globo-pie">
          <button type="button" class="btn chico peligro" id="g-quitar">Quitar</button>
          <span style="flex:1"></span>
          <button type="button" class="btn chico pri" id="g-listo">Listo</button>
        </div>
      </div>
    </div>

    <div class="listas">
      <div class="lista casa"><h4>🏠 Viven en la misma casa</h4><div id="lista-casa"></div></div>
      <div class="lista fuera"><h4>💛 Personas cercanas importantes</h4><div id="lista-fuera"></div></div>
    </div>
  </div></div>`;

  /* Pasos 2..N — bloques de preguntas */
  BLOQUES.forEach((b,i)=>{
    h += `<div class="paso oculto" data-paso="${2+i}"><div class="tarjeta">
      <div class="gorro">${esc(b.gorro)}</div>
      <h2 class="titulo">${esc(b.titulo)}</h2>
      ${b.intro ? `<p class="bajada">${esc(b.intro)}</p>` : ""}
      ${b.campos.map(c=>`<div class="campo">
          <label class="q" for="i-${c.k}">${esc(c.q)}</label>
          <textarea id="i-${c.k}" data-r="${c.k}" class="${c.corto?"corto":""}"
            placeholder="Escriba aquí la respuesta…"></textarea>
        </div>`).join("")}
    </div></div>`;
  });

  /* Último — cierre */
  h += `<div class="paso oculto" data-paso="${TOTAL-1}"><div class="tarjeta">
    <div class="gorro">Listo</div>
    <h2 class="titulo">Gracias por compartir su historia</h2>
    <p class="bajada">La entrevista quedó guardada con el código <b id="cod-final"></b>.</p>
    <div class="nota" id="resumen-final"></div>
    <div style="display:flex;flex-direction:column;gap:10px;margin-top:18px">
      <button class="btn pri ancho" id="f-enviar">Enviar</button>
      <button class="btn ancho" id="f-nueva">＋ Empezar otra entrevista</button>
    </div>
  </div></div>`;

  $("#pasos").innerHTML = h;
}

function irA(n){
  S.paso = clamp(n, 0, TOTAL-1);
  $$(".paso").forEach(d => d.classList.toggle("oculto", +d.dataset.paso !== S.paso));
  $("#barra").style.width = ((S.paso+1)/TOTAL*100) + "%";
  $("#paso-num").textContent = S.paso === TOTAL-1 ? "" : `Paso ${S.paso+1} de ${TOTAL-1}`;
  $("#btn-atras").style.visibility = S.paso === 0 ? "hidden" : "visible";
  $("#btn-sig").classList.toggle("oculto", S.paso === TOTAL-1);

  if(S.paso === 1){ conectarDibujo(); pintarDibujo(); }
  if(S.paso === TOTAL-1) pintarFinal();
  window.scrollTo({top:0, behavior:"smooth"});
  guardar();
}

function pintarFinal(){
  $("#cod-final").textContent = S.codigo;
  const P = S.dibujo.personas.filter(p => !Dibujo.esMascota(p.tipo));
  const M = S.dibujo.personas.filter(p => Dibujo.esMascota(p.tipo));
  const total = Object.keys(S.respuestas).length;
  const hechas = Object.values(S.respuestas).filter(v => String(v).trim()).length;
  $("#resumen-final").innerHTML =
    `<b>Resumen.</b> ${P.filter(p=>p.zona==="casa").length} persona(s) viven en la casa ·
     ${P.filter(p=>p.zona==="fuera").length} persona(s) cercanas` +
    (M.length ? ` · ${M.length} mascota(s)` : "") +
    ` · ${hechas} de ${total} preguntas respondidas.`;
}

/* -------------------------------- El dibujo -------------------------------- */

function pintarDibujo(){
  const svg = $("#dibujo"); if(!svg) return;
  svg.innerHTML = Dibujo.svg(S.dibujo.personas, sel, false);
  pintarGlobo();
  pintarListas();
}
function repintarLienzo(){
  const svg = $("#dibujo"); if(!svg) return;
  svg.innerHTML = Dibujo.svg(S.dibujo.personas, sel, false);
  pintarListas();
}

/* ------------------------ Ficha flotante sobre el muñeco ------------------------
   Se muestra pegada al muñeco seleccionado, dentro del lienzo, para que la
   persona no tenga que bajar la pantalla ni perder de vista el dibujo.        */

function cerrarGlobo(){
  const g = $("#globo"); if(g) g.classList.add("oculto");
}

function pintarGlobo(){
  const g = $("#globo"); if(!g) return;
  const p = S.dibujo.personas.find(x => x.id === sel);
  if(!p){ cerrarGlobo(); return; }

  const mascota = Dibujo.esMascota(p.tipo);
  $("#g-nombre").value = p.nombre;
  $("#g-nombre").placeholder = mascota ? "Nombre. Ej. Firulais" : "Nombre. Ej. María";
  $("#g-par").value = p.parentesco;
  $("#g-par").placeholder = mascota ? "¿Qué es de usted? Ej. Perro de la casa" : "¿Qué es de usted? Ej. Mamá";
  $("#dl-par").innerHTML = (mascota ? Dibujo.VINCULOS_MASCOTA : Dibujo.PARENTESCOS)
    .map(v => `<option value="${esc(v)}">`).join("");
  $("#g-casa").classList.toggle("on", p.zona === "casa");
  $("#g-fuera").classList.toggle("on", p.zona === "fuera");
  g.classList.remove("oculto");
  ubicarGlobo(p);
  // Si el globo quedó fuera de la vista, se acerca lo mínimo necesario
  const r = g.getBoundingClientRect();
  if(r.top < 60 || r.bottom > window.innerHeight - 90)
    g.scrollIntoView({behavior:"smooth", block:"nearest"});
}

function ubicarGlobo(p){
  const g = $("#globo"), svg = $("#dibujo"), caja = $("#lienzo-caja");
  if(!g || !svg || !caja) return;
  const rs = svg.getBoundingClientRect(), rc = caja.getBoundingClientRect();
  if(!rs.width) return;
  const k = rs.width / Dibujo.W;                    // píxeles por unidad del dibujo
  const cx = (rs.left - rc.left) + p.x * k;
  const cy = (rs.top  - rc.top ) + p.y * k;
  const alto = g.offsetHeight, ancho = g.offsetWidth;
  const margenMuneco = 42 * k;

  const izq = clamp(cx - ancho/2, 8, Math.max(8, rc.width - ancho - 8));
  let arriba = true;
  let top = cy - margenMuneco - alto - 10;
  if(top < 6){ arriba = false; top = cy + margenMuneco + 10; }
  top = clamp(top, 6, Math.max(6, rc.height - alto - 6));

  g.style.left = izq + "px";
  g.style.top  = top + "px";

  const pico = $(".pico", g);
  pico.style.left = clamp(cx - izq - 7, 14, Math.max(14, ancho - 28)) + "px";
  if(arriba){ pico.style.top = (alto - 8) + "px"; pico.style.transform = "rotate(45deg)"; }
  else      { pico.style.top = "-8px";            pico.style.transform = "rotate(225deg)"; }
}

function conectarGlobo(){
  const g = $("#globo"); if(!g || g._listo) return;
  g._listo = true;
  const actual = () => S.dibujo.personas.find(x => x.id === sel);

  $("#g-nombre").oninput = e => { const p = actual(); if(!p) return;
    p.nombre = e.target.value; guardar(); repintarLienzo(); };
  $("#g-par").oninput = e => { const p = actual(); if(!p) return;
    p.parentesco = e.target.value; guardar(); repintarLienzo(); };

  const mover = z => {
    const p = actual(); if(!p || p.zona === z) return;
    p.zona = z;
    const otros = S.dibujo.personas.filter(x => x.id !== p.id);
    Object.assign(p, Dibujo.puntoLibre(otros, z));
    guardar(); pintarDibujo();
  };
  $("#g-casa").onclick  = () => mover("casa");
  $("#g-fuera").onclick = () => mover("fuera");

  $("#g-quitar").onclick = () => {
    S.dibujo.personas = S.dibujo.personas.filter(x => x.id !== sel);
    sel = null; guardar(); pintarDibujo();
  };
  $("#g-listo").onclick = () => { sel = null; guardar(); pintarDibujo(); };
  $("#g-par").addEventListener("keydown", e => { if(e.key === "Enter") $("#g-listo").click(); });
}

function pintarListas(){
  const c = $("#lista-casa"), f = $("#lista-fuera"); if(!c) return;
  const html = arr => arr.length
    ? `<ul>${arr.map(p=>`<li>${Dibujo.esMascota(p.tipo) ? "🐾 " : ""}${esc(p.nombre||"(sin nombre)")}${p.parentesco?` — ${esc(p.parentesco)}`:""}</li>`).join("")}</ul>`
    : `<p class="nada">Todavía no hay nadie aquí.</p>`;
  c.innerHTML = html(S.dibujo.personas.filter(p=>p.zona==="casa"));
  f.innerHTML = html(S.dibujo.personas.filter(p=>p.zona==="fuera"));
}

function aSvg(ev){
  const svg = $("#dibujo"), pt = svg.createSVGPoint();
  pt.x = ev.clientX; pt.y = ev.clientY;
  const m = svg.getScreenCTM();
  if(!m) return {x:Dibujo.CX, y:Dibujo.CY};
  const q = pt.matrixTransform(m.inverse());
  return {x:q.x, y:q.y};
}

function moverse(ev){
  if(!arrastre) return;
  const p = S.dibujo.personas.find(z => z.id === arrastre.id); if(!p) return;
  const q = aSvg(ev);
  p.x = clamp(Math.round(q.x - arrastre.dx), 44, Dibujo.W-44);
  p.y = clamp(Math.round(q.y - arrastre.dy), 46, Dibujo.H-80);
  p.zona = Dibujo.zonaDe(p.x, p.y);
  arrastre.movio = true;
  if(!moverse._raf) moverse._raf = requestAnimationFrame(() => { moverse._raf = null; repintarLienzo(); });
}

function soltar(){
  window.removeEventListener("pointermove", moverse);
  if(arrastre){
    // Si el muñeco se soltó fuera del lienzo, se lleva a un lugar válido
    const p = S.dibujo.personas.find(z => z.id === arrastre.id);
    if(p && arrastre.desdePaleta && !arrastre.entroAlLienzo){
      Object.assign(p, Dibujo.puntoLibre(S.dibujo.personas.filter(x => x.id !== p.id), "casa"));
      p.zona = "casa";
    }
    guardar();
    sel = arrastre.id;
    pintarDibujo();
    if(arrastre.desdePaleta) setTimeout(() => $("#g-nombre")?.focus(), 60);
  }
  arrastre = null;
}

function conectarDibujo(){
  const svg = $("#dibujo"), paleta = $("#paleta");
  if(!svg || !paleta || svg._listo) return;
  svg._listo = true;
  conectarGlobo();

  /* Arrastrar desde la paleta: el muñeco nace bajo el dedo y se suelta donde
     corresponda. Un toque simple también sirve: queda en un lugar libre. */
  paleta.addEventListener("pointerdown", ev => {
    const b = ev.target.closest(".pieza"); if(!b) return;
    ev.preventDefault();
    const p = { id:uid("m"), tipo:b.dataset.tipo, nombre:"", parentesco:"", zona:"casa",
                ...Dibujo.puntoLibre(S.dibujo.personas, "casa") };
    S.dibujo.personas.push(p);
    sel = p.id;
    cerrarGlobo();
    repintarLienzo();
    arrastre = { id:p.id, dx:0, dy:0, desdePaleta:true, entroAlLienzo:false };
    window.addEventListener("pointermove", seguirDesdePaleta);
    window.addEventListener("pointerup", soltarDesdePaleta, {once:true});
  });

  /* Seleccionar y arrastrar los que ya están en el dibujo */
  svg.addEventListener("pointerdown", ev => {
    const g = ev.target.closest("[data-id]");
    if(!g){ if(sel){ sel = null; pintarDibujo(); } return; }
    const p = S.dibujo.personas.find(z => z.id === g.dataset.id); if(!p) return;
    const q = aSvg(ev);
    arrastre = { id:p.id, dx:q.x-p.x, dy:q.y-p.y };
    sel = p.id;
    cerrarGlobo();                       // la ficha reaparece al soltar
    repintarLienzo();
    ev.preventDefault();
    window.addEventListener("pointermove", moverse);
    window.addEventListener("pointerup", soltar, {once:true});
  });

  window.addEventListener("resize", () => {
    const p = S.dibujo.personas.find(x => x.id === sel);
    if(p && !$("#globo").classList.contains("oculto")) ubicarGlobo(p);
  });
}

/* Mientras se arrastra desde la paleta el dedo va por fuera del SVG, así que
   solo se empieza a seguir cuando entra al lienzo. */
function seguirDesdePaleta(ev){
  if(!arrastre) return;
  const r = $("#dibujo").getBoundingClientRect();
  const dentro = ev.clientX >= r.left && ev.clientX <= r.right &&
                 ev.clientY >= r.top  && ev.clientY <= r.bottom;
  if(!dentro) return;
  arrastre.entroAlLienzo = true;
  moverse(ev);
}
function soltarDesdePaleta(){
  window.removeEventListener("pointermove", seguirDesdePaleta);
  soltar();
}

/* --------------------------------- Valores --------------------------------- */

function pintarMunicipio(){
  const sel = $("#d-mun"), otro = $("#d-mun-otro");
  if(!sel) return;
  const valor = S.datos.municipio || "";
  const enLista = MUNICIPIOS_CALDAS.includes(valor);
  sel.value = valor ? (enLista ? valor : OTRO_MUNICIPIO) : "";
  otro.value = enLista ? "" : valor;
  otro.classList.toggle("oculto", sel.value !== OTRO_MUNICIPIO);
}

function pintarValores(){
  $$("[data-d]").forEach(el => el.value = S.datos[el.dataset.d] ?? "");
  pintarMunicipio();
  $$('input[name=zona]').forEach(r => r.checked = (r.value === S.datos.zona));
  $$('input[name=ident]').forEach(r => r.checked = (r.value === S.datos.identidad));
  $$("[data-r]").forEach(el => { el.value = S.respuestas[el.dataset.r] ?? ""; ajustar(el); });
}

function conectarCampos(){
  $$("[data-d]").forEach(el => el.oninput = () => { S.datos[el.dataset.d] = el.value; guardar(); });

  $("#d-mun").onchange = e => {
    const otro = $("#d-mun-otro");
    const esOtro = e.target.value === OTRO_MUNICIPIO;
    otro.classList.toggle("oculto", !esOtro);
    S.datos.municipio = esOtro ? otro.value.trim() : e.target.value;
    if(esOtro) otro.focus();
    guardar();
  };
  $("#d-mun-otro").oninput = e => { S.datos.municipio = e.target.value.trim(); guardar(); };
  $$('input[name=zona]').forEach(r => r.onchange = () => { S.datos.zona = r.value; guardar(); });
  $$('input[name=ident]').forEach(r => r.onchange = () => { S.datos.identidad = r.value; guardar(); });
  $$("[data-r]").forEach(el => el.oninput = () => { S.respuestas[el.dataset.r] = el.value; ajustar(el); guardar(); });

  $("#f-enviar").onclick = async () => {
    S.terminada = true; guardar(true);
    await sincronizar();
    const quedan = leerJSON(LS_PENDIENTES, []).length;
    aviso(quedan ? "Guardada. Se enviará cuando haya señal." : "¡Enviada!");
  };
  $("#f-nueva").onclick = () => { guardar(true); arrancarEntrevista(); };
}

/* ----------------------------------- Menú ----------------------------------- */

function abrirMenu(){
  const locales = leerJSON(LS_ENTREVISTAS, {});
  const pendientes = new Set(leerJSON(LS_PENDIENTES, []));
  const lista = Object.values(locales).sort((a,b) => (b.actualizada||"").localeCompare(a.actualizada||""));
  $("#lista-locales").innerHTML = lista.length ? lista.map(e=>{
    const hechas = Object.values(e.respuestas||{}).filter(v => String(v).trim()).length;
    return `<div class="lista" style="display:flex;gap:10px;align-items:center;padding:10px 12px">
      <div style="flex:1;min-width:0">
        <b style="font-size:14.5px">${esc(e.codigo)}</b>
        <div style="font-size:12.5px;color:var(--suave)">
          ${esc(e.datos?.municipio || "sin municipio")} · ${hechas} respuestas ·
          ${(e.dibujo?.personas||[]).length} personas ${pendientes.has(e.id) ? "· <b>por enviar</b>" : "· enviada"}
        </div>
      </div>
      <button class="btn chico" data-abrir="${e.id}">Abrir</button>
    </div>`;
  }).join("") : `<p class="bajada" style="font-size:14.5px">Todavía no hay entrevistas en este teléfono.</p>`;

  $$("#lista-locales [data-abrir]").forEach(b => b.onclick = () => {
    guardar(true);
    const t = leerJSON(LS_ENTREVISTAS, {});
    if(t[b.dataset.abrir]){
      S = reparar(t[b.dataset.abrir]); sel = null;
      pintarValores(); mostrar("form"); irA(S.paso || 0);
      $("#dlg-menu").close(); aviso("Entrevista abierta");
    }
  });
  $("#dlg-menu").showModal();
}

/* ---------------------------------- Arranque ---------------------------------- */

async function init(){
  pintarPasos();
  conectarCampos();

  $("#btn-acepto").onclick = aceptarConsentimiento;
  $("#btn-no-acepto").onclick = rechazarConsentimiento;
  $("#btn-otra-persona").onclick = arrancarEntrevista;

  $("#btn-sig").onclick   = () => irA(S.paso+1);
  $("#btn-atras").onclick = () => irA(S.paso-1);
  $("#btn-menu").onclick  = abrirMenu;
  $("#btn-menu-c").onclick = abrirMenu;
  $("#m-cerrar").onclick  = () => $("#dlg-menu").close();
  $("#m-nueva").onclick   = () => { guardar(true); $("#dlg-menu").close(); arrancarEntrevista(); };
  $("#m-sincronizar").onclick = async () => { await sincronizar(); aviso(leerJSON(LS_PENDIENTES,[]).length ? "Aún faltan por enviar" : "Todo enviado"); };
  $("#m-panel").onclick   = () => window.open("/panel", "_blank");

  window.addEventListener("beforeunload", () => guardar(true));

  pintarSincro();
  if(!await revisarAcceso()){ pedirCodigo(); return; }

  const t = leerJSON(LS_ENTREVISTAS, {});
  const ultima = localStorage.getItem(LS_ACTUAL);
  if(ultima && t[ultima] && !t[ultima].terminada && t[ultima].consentimiento?.acepta){
    S = reparar(t[ultima]);
    pintarValores(); mostrar("form"); irA(S.paso || 0);
  } else {
    arrancarEntrevista();
  }
  sincronizar();
  requestAnimationFrame(() => $$("textarea").forEach(ajustar));
}

if("serviceWorker" in navigator){
  window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(()=>{}));
}

init();
