/* ============================================================================
   Panel de revisión — para las docentes y la coordinación.
   Lista lo recogido, permite abrir cada entrevista, marcarla como revisada
   y descargar el conjunto en JSON o CSV.
   ========================================================================== */

const $  = (s,r=document) => r.querySelector(s);
const $$ = (s,r=document) => [...r.querySelectorAll(s)];
const esc = s => String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

let token = localStorage.getItem("uc_token") || "";
let perfil = null;
let actual = null;

function aviso(m){
  const t = $("#aviso"); t.textContent = m; t.classList.add("on");
  clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove("on"), 2400);
}

async function api(ruta, opciones = {}){
  const r = await fetch("/api" + ruta, {
    ...opciones,
    headers:{ "Content-Type":"application/json",
              ...(token ? {Authorization:"Bearer "+token} : {}),
              ...(opciones.headers||{}) }
  });
  if(r.status === 401){ salir(); throw new Error("La sesión venció"); }
  if(!r.ok){
    let m = "Error de conexión";
    try { m = (await r.json()).detail || m; } catch(e){}
    throw new Error(m);
  }
  return r.json();
}

function salir(){
  token = ""; localStorage.removeItem("uc_token"); localStorage.removeItem("uc_perfil");
  $("#pantalla-panel").classList.add("oculto");
  $("#pantalla-login").classList.remove("oculto");
}

async function entrar(){
  const err = $("#login-error"); err.classList.add("oculto");
  try{
    const r = await api("/login", {method:"POST", body: JSON.stringify({
      usuario: $("#in-usuario").value.trim(), clave: $("#in-clave").value })});
    token = r.token; perfil = r.usuario;
    localStorage.setItem("uc_token", token);
    localStorage.setItem("uc_perfil", JSON.stringify(perfil));
    abrirPanel();
  }catch(e){ err.textContent = e.message; err.classList.remove("oculto"); }
}

async function abrirPanel(){
  try { perfil = await api("/yo"); } catch(e){ return salir(); }
  $("#pantalla-login").classList.add("oculto");
  $("#pantalla-panel").classList.remove("oculto");
  $("#quien").textContent = `${perfil.nombre} · ${perfil.rol}`;
  ["x-json","x-resp","x-pers"].forEach(id => $("#"+id).onclick = ev => { ev.preventDefault(); descargar(id); });
  await Promise.all([cargarKpis(), cargarLista()]);
}

/* Las descargas van con el token en la cabecera, por eso se piden con fetch */
async function descargar(cual){
  const rutas = {
    "x-json": ["/exportar/entrevistas.json", "entrevistas.json"],
    "x-resp": ["/exportar/respuestas.csv", "respuestas.csv"],
    "x-pers": ["/exportar/personas.csv", "personas.csv"]
  };
  const [ruta, nombre] = rutas[cual];
  try{
    const r = await fetch("/api"+ruta, {headers:{Authorization:"Bearer "+token}});
    if(!r.ok) throw new Error("no se pudo descargar");
    const b = await r.blob();
    const url = URL.createObjectURL(b), a = document.createElement("a");
    a.href = url; a.download = nombre; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }catch(e){ aviso("No se pudo descargar"); }
}

async function cargarKpis(){
  const k = await api("/estadisticas");
  const municipios = Object.entries(k.por_municipio).slice(0,3)
    .map(([m,n]) => `${m} (${n})`).join(" · ") || "—";
  $("#kpis").innerHTML = `
    <div class="kpi"><b>${k.total}</b><span>entrevistas</span></div>
    <div class="kpi"><b>${k.enviadas}</b><span>por revisar</span></div>
    <div class="kpi"><b>${k.revisadas}</b><span>revisadas</span></div>
    <div class="kpi"><b>${k.borrador}</b><span>en borrador</span></div>
    <div class="kpi"><b>${k.personas_dibujadas}</b><span>personas dibujadas</span></div>
    <div class="kpi"><b>${k.mascotas ?? 0}</b><span>mascotas</span></div>
    <div class="kpi"><b>${k.rechazos}</b><span>no aceptaron</span></div>
    <div class="kpi" style="grid-column:span 2"><b style="font-size:16px;line-height:1.4">${esc(municipios)}</b>
      <span>municipios con más registros</span></div>`;
}

async function cargarLista(){
  const q = new URLSearchParams();
  if($("#f-municipio").value.trim()) q.set("municipio", $("#f-municipio").value.trim());
  if($("#f-estado").value) q.set("estado", $("#f-estado").value);
  const filas = await api("/entrevistas" + (q.toString() ? "?"+q : ""));
  $("#filas").innerHTML = filas.length ? filas.map(e => `
    <tr>
      <td><b>${esc(e.codigo)}</b></td>
      <td>${esc(e.municipio||"—")}<br><small style="color:var(--suave)">${esc(e.lugar||"")}</small></td>
      <td>${esc(e.zona||"—")}</td>
      <td>${esc(e.fecha||"—")}</td>
      <td>${esc(e.identidad||"—")}${e.edad?`, ${esc(e.edad)}`:""}</td>
      <td>${e.personas}</td>
      <td>${e.respondidas}</td>
      <td><span class="etiqueta et-${e.estado}">${e.estado}</span></td>
      <td><button class="btn chico" data-ver="${e.id}">Ver</button></td>
    </tr>`).join("")
    : `<tr><td colspan="9" style="color:var(--suave)">No hay entrevistas con ese filtro.</td></tr>`;
  $$("#filas [data-ver]").forEach(b => b.onclick = () => verDetalle(b.dataset.ver));
}

async function verDetalle(id){
  const e = await api("/entrevistas/"+id);
  actual = e;
  const d = e.datos || {};
  const ficha = d.datos || {};
  const personas = (d.dibujo || {}).personas || [];
  const esMascota = p => Dibujo.esMascota(p.figura);
  const gente = personas.filter(p => !esMascota(p));
  const mascotas = personas.filter(esMascota);
  const svg = personas.length
    ? `<div style="max-width:420px;margin:12px 0;border:1px solid var(--borde);border-radius:12px;overflow:hidden">
         <svg viewBox="0 0 ${Dibujo.W} ${Dibujo.H}" style="display:block;width:100%">${
           Dibujo.svg(personas.map(p => ({...p, tipo:p.figura, zona:p.ubicacion})), null, true)}</svg></div>`
    : `<p style="color:var(--suave)">No se hizo el dibujo.</p>`;

  $("#detalle").innerHTML = `
    <h2 class="titulo" style="font-size:21px">${esc(e.codigo)}</h2>
    <p class="bajada" style="font-size:14.5px">
      ${esc(ficha.departamento||"")} · ${esc(ficha.municipio||"—")} ${ficha.lugar?"· "+esc(ficha.lugar):""}
      · ${esc(ficha.zona||"")} · ${esc(ficha.fecha||"")}<br>
      Participante: ${esc(ficha.identidad||"—")}${ficha.edad?`, ${esc(ficha.edad)} años`:""} ·
      Consentimiento: ${d.consentimiento?.acepta ? "aceptado" : "sin registro"}
    </p>

    <h3>Dibujo de la familia</h3>
    ${svg}
    <p style="font-size:14.5px">
      <b>En la casa:</b> ${gente.filter(p=>p.ubicacion==="casa").map(p=>esc(`${p.nombre||"?"} (${p.parentesco||"—"})`)).join(", ") || "—"}<br>
      <b>Cercanas:</b> ${gente.filter(p=>p.ubicacion!=="casa").map(p=>esc(`${p.nombre||"?"} (${p.parentesco||"—"})`)).join(", ") || "—"}${
        mascotas.length ? `<br><b>Mascotas:</b> 🐾 ${mascotas.map(p=>esc(`${p.nombre||"?"} (${[p.especie||p.figura, p.parentesco].filter(Boolean).join(", ")})`)).join(", ")}` : ""}
    </p>

    <h3>Respuestas</h3>
    ${(d.respuestas||[]).map(r => `
      <div class="pq">${esc(r.pregunta)}</div>
      <div class="rp ${String(r.respuesta).trim() ? "" : "vacia"}">${esc(String(r.respuesta).trim() || "sin respuesta")}</div>
    `).join("")}

    <h3>Revisión</h3>
    <textarea id="d-nota" class="corto" placeholder="Observaciones de la revisión…">${esc(e.nota_revision||"")}</textarea>
    ${e.revisada_por ? `<p style="font-size:13.5px;color:var(--suave);margin-top:8px">Revisada por ${esc(e.revisada_por)}.</p>` : ""}`;
  $("#dlg-detalle").showModal();
}

async function marcar(estado){
  if(!actual) return;
  try{
    await api(`/entrevistas/${actual.id}/revision`, {method:"POST",
      body: JSON.stringify({estado, nota: $("#d-nota")?.value || ""})});
    $("#dlg-detalle").close();
    aviso(estado === "revisada" ? "Marcada como revisada" : "Devuelta a «enviada»");
    await Promise.all([cargarKpis(), cargarLista()]);
  }catch(e){ aviso(e.message); }
}

function init(){
  $("#btn-entrar").onclick = entrar;
  $("#in-clave").addEventListener("keydown", e => { if(e.key === "Enter") entrar(); });
  $("#btn-salir").onclick = salir;
  $("#btn-app").onclick = () => window.open("/", "_blank");
  $("#f-aplicar").onclick = cargarLista;
  $("#f-municipio").addEventListener("keydown", e => { if(e.key === "Enter") cargarLista(); });
  $("#f-estado").onchange = cargarLista;
  $("#d-cerrar").onclick = () => $("#dlg-detalle").close();
  $("#d-revisar").onclick = () => marcar("revisada");
  $("#d-devolver").onclick = () => marcar("enviada");
  if(token) abrirPanel();
}
init();
