const sesionInforme = JSON.parse(sessionStorage.getItem("labores_usuario") || "null");
if (!sesionInforme) window.location.href = "./login.html";

const ALMACENAMIENTO_CALIDAD = "calidadSiembraEvaluacionesLocal";
const ITEMS_INFORME = [
  [2, "Estado de la planta"], [3, "Distribución"],
  [4, "Densidad"], [5, "Profundidad de la planta"], [6, "Planta inclinada"],
  [7, "Ubicación de mangueras"], [8, "Selección de esqueje"], [9, "Siembra con marcador"],
  [10, "Aseo sitio de trabajo"], [13, "Conteo de líneas"],
];

const periodoSelect = document.querySelector("#periodoSelect");
const anioSelect = document.querySelector("#anioSelect");
const semanaSelect = document.querySelector("#semanaSelect");
const informeContenido = document.querySelector("#informeContenido");
const nombresColaboradores = new Map();
document.querySelector("#informeUsuario").textContent = sesionInforme?.empleadoNombre || sesionInforme?.username || "Usuario";

function escaparHtml(valor) {
  return String(valor ?? "").replace(/[&<>"']/g, (caracter) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[caracter]));
}

function obtenerEvaluacionesLocales() {
  try {
    const datos = JSON.parse(localStorage.getItem(ALMACENAMIENTO_CALIDAD) || "[]");
    return Array.isArray(datos) ? datos.filter((registro) => registro && registro.anio && registro.semana) : [];
  } catch {
    return [];
  }
}

// Se conservan los datos del servidor y se completan los identificadores
// Bloque/Cama desde la copia local. La API de calidad actual no envía esos
// campos; jamás inventamos la asociación cuando no existe.
function claveRevision(e) {
  const codigo = String(e.sembrador ?? e.colaborador ?? "").trim();
  const semana = String(e.semana ?? "");
  const fecha = String(e.fecha ?? "").slice(0,10);
  const revision = String(e.revision ?? "");
  return e.correlationId ? "id:"+e.correlationId :
    "revision:"+codigo+"|"+semana+"|"+revision+"|"+fecha;
}
async function obtenerEvaluaciones() {
  let recibidas=null;
  try {
    const response = await fetch(`${API_BASE_URL}/api/calidad/informe`, {cache:"no-store"});
    if (!response.ok) throw new Error("No se pudo consultar el informe en la base");
    const datos = await response.json();
    if (!Array.isArray(datos)) throw new Error("Formato de evaluaciones inválido");
    recibidas=datos;
  }catch{
    recibidas=obtenerEvaluacionesLocales();
  }
  let locales=[];
  try {
    locales=(await OfflineDb.getAll("calidadEvaluaciones")).filter(
      e=>e&&e.bloque!=null&&e.cama!=null&&String(e.bloque).trim()&&String(e.cama).trim()
    );
  }catch(error){console.warn("Sin evaluaciones locales adicionales:",error);}
  const merged=new Map();
  for(const e of recibidas) {
    if(e&&typeof e==="object")merged.set(claveRevision(e),e);
  }
  for(const e of locales){
    const key=claveRevision(e);
    // Buscar también por revisión si la API no devuelve correlationId.
    const match=[...merged.entries()].find(([k,v])=>
      k===key || (String(v.colaborador??v.sembrador??"")===String(e.colaborador??e.sembrador??"") &&
      Number(v.semana)===Number(e.semana) && Number(v.revision)===Number(e.revision) &&
      String(v.fecha??"").slice(0,10)===String(e.fecha??"").slice(0,10)));
    if(match){
      const [oldKey,server]=match;
      merged.set(oldKey,{...server,bloque:server.bloque??e.bloque,
       cama:server.cama??e.cama,
       colaboradorNombre:server.colaboradorNombre??e.colaboradorNombre});
    }else merged.set(key,e);
  }
  return [...merged.values()];
}


// Conteo de Líneas es una evaluación por cama, NO una revisión manual.
// La clave vigente en Labores JN es fecha | bloque | cama.
// No se asocian fechas distintas automáticamente: una cama puede reutilizarse.
const CONTEO_META_PREFIX="calidadSiembraDensidad:v1:";
const codificarCama=v=>{
 const s=String(v??"").trim().toUpperCase();
 return /^\d+$/.test(s)?String(Number(s)):s;
};
function claveCama(fecha,bloque,cama){
 const d=String(fecha??"").slice(0,10),b=codificarCama(bloque),c=codificarCama(cama);
 return /^\d{4}-\d{2}-\d{2}$/.test(d)&&b&&c?d+"|"+b+"|"+c:"";
}
function estadoConteo(info) {
 if(!info)return "Pendiente";
 const report=String(info.reporte??""),checked=String(info.aseguradas??"");
 if(!/^\d+$/.test(report)||!/^\d+$/.test(checked)||
    !Number.isSafeInteger(Number(report))||!Number.isSafeInteger(Number(checked)))return "Pendiente";
 return Math.abs(Number(checked)-Number(report))>=3?"Inconforme":"Conforme";
}
async function cargarConteosGuardados(){
 const out=new Map();
 try {
  const meta=await OfflineDb.getAll("meta");
  for(const row of meta){
   if(!String(row.key??"").startsWith(CONTEO_META_PREFIX))continue;
   const r=row.value;
   if(!r)continue;
   const k=claveCama(r.fecha,r.bloque,r.cama);
   if(k)out.set(k,estadoConteo(r));
  }
 }catch(error){console.warn("No se pudieron consultar conteos de líneas:",error);}
 return out;
}
function vincularConteo(e,conteos){
 const key=claveCama(e.fecha,e.bloque,e.cama);
 return {...e,__conteoClave:key,__conteoEstado:conteos.get(key)||"Pendiente"};
}
function conteoCamasPersona(registros){
 const camas=new Map();
 for(const r of registros){
  if(!r.__conteoClave)continue;
  camas.set(r.__conteoClave,r.__conteoEstado);
 }
 const completadas=[...camas.values()].filter(x=>x==="Conforme"||x==="Inconforme");
 const conformes=completadas.filter(x=>x==="Conforme").length;
 return {conformes,completadas:completadas.length,pendientes: camas.size-completadas.length};
}
function revisionConforme(e){
 return e.__conteoEstado==="Conforme"&&
  !(e.incumplimientos||[]).some(x=>{
   const id=Number(x&&typeof x==="object"?x.idItem??x.id:x);
   // El ítem 13 no se puede registrar manualmente en nuevas revisiones.
   return Number.isFinite(id)&&id!==13;
  });
}

function normalizarEvaluacion(evaluacion) {
  const fecha = evaluacion.fecha || new Date().toISOString();
  const codigo = String(evaluacion.sembrador ?? evaluacion.colaborador ?? "");
  return {
    ...evaluacion,
    anio: Number(evaluacion.anio || evaluacion.ano || String(fecha).slice(0, 4)),
    sembrador: codigo,
    sembradorNombre: evaluacion.sembradorNombre || evaluacion.colaboradorNombre || nombresColaboradores.get(codigo) || evaluacion.colaborador || "Sin nombre",
    incumplimientos: (evaluacion.incumplimientos || []).map((item) => typeof item === "object"
      ? { ...item, idItem: item.idItem ?? item.id }
      : item),
  };
}

async function cargarNombresColaboradoresLocales() {
  try {
    const [calidad, empleados] = await Promise.all([
      OfflineDb.getAll("calidadColaboradores"),
      OfflineDb.getAll("empleados"),
    ]);
    [...calidad, ...empleados].forEach((item) => {
      const codigo = item.codigo || item.codigo_origen;
      const nombre = item.nombre || item.empleadoNombre;
      if (codigo && nombre) nombresColaboradores.set(String(codigo), nombre);
    });
  } catch {
    // El informe sigue funcionando con el nombre que entregue la API o el código.
  }
}

function clavePeriodo(registro) {
  return `${registro.anio}|${registro.semana}`;
}

function porcentaje(numerador, denominador) {
  if (!denominador) return "—";
  const valor = 100 * numerador / denominador;
  return `${Math.round(valor)}%`;
}

function tieneIncumplimiento(evaluacion,idItem){
  if(idItem===13)return evaluacion.__conteoEstado==="Inconforme";
  return (evaluacion.incumplimientos||[]).some(item=>
   Number(item&&typeof item==="object"?item.idItem??item.id:item)===idItem);
}

function datosPeriodo(evaluaciones) {
  const porPeriodo = new Map();
  evaluaciones.forEach((evaluacion) => {
    const clave = clavePeriodo(evaluacion);
    if (!porPeriodo.has(clave)) porPeriodo.set(clave, []);
    porPeriodo.get(clave).push(evaluacion);
  });
  return [...porPeriodo.entries()]
    .map(([clave, registros]) => {
      const [anio, semana] = clave.split("|").map(Number);
      return { clave, anio, semana, registros };
    })
    .sort((a, b) => a.anio - b.anio || a.semana - b.semana);
}

function poblarFiltros(periodos) {
  const anios = [...new Set(periodos.map((periodo) => periodo.anio))].sort((a, b) => b - a);
  const anioActual = anioSelect.value || String(anios[0] ?? "");
  anioSelect.innerHTML = '<option value="">Todos los años</option>' + anios
    .map((anio) => `<option value="${anio}" ${String(anio) === anioActual ? "selected" : ""}>${anio}</option>`).join("");
  if (anioActual && anios.some((anio) => String(anio) === anioActual)) anioSelect.value = anioActual;
  const anioFiltro = anioSelect.value;
  const semanas = [...new Set(periodos.filter((periodo) => !anioFiltro || String(periodo.anio) === String(anioFiltro)).map((periodo) => periodo.semana))].sort((a, b) => a - b);
  const semanaActual = semanaSelect.value;
  semanaSelect.innerHTML = '<option value="">Todas las semanas</option>' + semanas
    .map((semana) => `<option value="${semana}" ${String(semana) === semanaActual ? "selected" : ""}>Semana ${semana}</option>`).join("");
  if (semanaActual && semanas.some((semana) => String(semana) === semanaActual)) semanaSelect.value = semanaActual;
}

function resumenGrupal(registros) {
  const terminadas=registros.filter(e=>e.__conteoEstado==="Conforme"||e.__conteoEstado==="Inconforme");
  const conformes=terminadas.filter(revisionConforme).length;
  return {muestras:terminadas.length,conformes,pendientes:registros.length-terminadas.length,
    porcentaje:terminadas.length?100*conformes/terminadas.length:null};
}

function renderGrafica(periodos) {
  if (!periodos.length) return '<p class="hint">Aún no hay semanas con evaluaciones guardadas.</p>';
  const ultimos = periodos.slice(-4);
  return `<div class="print-bars">${ultimos.map((periodo) => {
    const resumen = resumenGrupal(periodo.registros);
    const alto = resumen.porcentaje == null ? 25 : Math.max(25, resumen.porcentaje - 55) * 3;
    return `<div class="print-bar-item"><b>${porcentaje(resumen.conformes, resumen.muestras)}</b><div class="print-bar" style="height:${alto}px"></div><span>SEMANA ${periodo.semana}</span></div>`;
  }).join("")}</div>`;
}

async function renderInforme() {
  const [evaluaciones,conteos] = await Promise.all([obtenerEvaluaciones(),cargarConteosGuardados()]);
  await cargarNombresColaboradoresLocales();
  const datos = evaluaciones.map(normalizarEvaluacion).map(e=>vincularConteo(e,conteos));
  const periodos = datosPeriodo(datos);
  if (!periodos.length) {
    periodoSelect.innerHTML = '<option value="">Sin evaluaciones guardadas</option>';
    periodoSelect.disabled = true;
    informeContenido.innerHTML = '<h2>Sin datos para el informe</h2><p class="hint">Registra una evaluación en Calidad Siembra para generar el informe en este equipo.</p>';
    return;
  }

  poblarFiltros(periodos);
  const anioFiltro = anioSelect.value;
  const semanaFiltro = semanaSelect.value;
  const periodosFiltrados = periodos.filter((periodo) =>
    (!anioFiltro || String(periodo.anio) === String(anioFiltro)) &&
    (!semanaFiltro || String(periodo.semana) === String(semanaFiltro))
  );
  if (!periodosFiltrados.length) {
    periodoSelect.innerHTML = '<option value="">Sin semanas para este filtro</option>';
    periodoSelect.disabled = true;
    informeContenido.innerHTML = '<h2>Sin datos para el filtro seleccionado</h2><p class="hint">Elige otro año o semana para consultar evaluaciones.</p>';
    return;
  }
  periodoSelect.disabled = false;

  const seleccionada = periodoSelect.value || periodosFiltrados.at(-1).clave;
  periodoSelect.innerHTML = periodosFiltrados.slice().reverse().map((periodo) =>
    `<option value="${periodo.clave}" ${periodo.clave === seleccionada ? "selected" : ""}>Semana ${periodo.semana} de ${periodo.anio}</option>`
  ).join("");
  const periodo = periodosFiltrados.find((item) => item.clave === periodoSelect.value) || periodosFiltrados.at(-1);
  const resumen = resumenGrupal(periodo.registros);
  const porSembrador = new Map();

  periodo.registros.forEach((evaluacion) => {
    const id = String(evaluacion.sembrador);
    if (!porSembrador.has(id)) porSembrador.set(id, { nombre: evaluacion.sembradorNombre || id, registros: [] });
    porSembrador.get(id).registros.push(evaluacion);
  });

  const filas = [...porSembrador.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, "es")).map((sembrador) => {
    const muestras = sembrador.registros.length;
    const porItem = ITEMS_INFORME.map(([id]) => {
      if(id===13){
        const camas=conteoCamasPersona(sembrador.registros);
        return porcentaje(camas.conformes,camas.completadas);
      }
      const fallos = sembrador.registros.filter((evaluacion) => tieneIncumplimiento(evaluacion, id)).length;
      return porcentaje(muestras - fallos, muestras);
    });
    const final=resumenGrupal(sembrador.registros);
    const resultado=porcentaje(final.conformes,final.muestras)+(final.pendientes?" *":"");
    return `<tr><td class="namecell">${escaparHtml(sembrador.nombre)}</td>${porItem.map(valor=>`<td>${valor}</td>`).join("")}<td>${resultado}</td></tr>`;
  }).join("");

  informeContenido.innerHTML = `
    <section class="report-sheet">
      <div class="report-brand">
        <div class="report-logo">
          <img src="./icons/jardines-san-nicolas.jpg" alt="Jardines de San Nicolás S.A.S." />
        </div>
        <div class="report-meta">
          <div class="report-route"><b>RUTA DE<br>APRENDIZAJE</b></div>
        </div>
        <div class="report-logo assurance-logo"><img src="./icons/aseguramiento.png" alt="Aseguramiento" /></div>
        <div class="report-company-wide">JARDINES DE SAN NICOLÁS S.A.S.</div>
        <div class="report-details">
          <div>INDICADOR</div><div>METEORO</div>
          <div>ÁREA</div><div>SIEMBRA EN CAMPO</div>
          <div>RESPONSABLE</div><div>ERASMO GOMEZ</div>
        </div>
      </div>
      <h3 class="table-title">RESULTADOS CONFORMIDAD INDIVIDUAL SEMANA ${periodo.semana} · ${periodo.anio}</h3>
      <p class="hint">Conteo de Líneas: porcentaje por camas terminadas. Conformidad total: porcentaje por revisiones con conteo finalizado. Una cama inconforme hace inconformes todas las revisiones asociadas a esa cama, fecha y bloque.</p>
      ${resumen.pendientes?`<p class="hint" style="color:#8e5613"><strong>Informe provisional:</strong> ${resumen.pendientes} de ${periodo.registros.length} revisiones aún esperan el conteo de su cama o no tienen identificador de cama. Los porcentajes totales marcados con * son provisionales; no se consideran revisiones conformes hasta completar el conteo.</p>`:""}
      <div class="table-scroll"><table class="conformity-table"><thead><tr>
        <th>NOMBRE DEL COLABORADOR</th>${ITEMS_INFORME.map(([, nombre]) => `<th>${nombre}</th>`).join("")}<th>CONFORMIDAD TOTAL</th>
      </tr></thead><tbody>${filas}</tbody></table></div>
      <div class="weekly-summary">
        <table class="mini-table"><thead><tr><th>SEMANA</th><th>CONFORMIDAD GRUPAL</th></tr></thead>
          <tbody>${periodosFiltrados.slice(-4).map((semana) => {
            const resumenSemana = resumenGrupal(semana.registros);
            return `<tr><td>SEMANA ${semana.semana}</td><td><b>${porcentaje(resumenSemana.conformes,resumenSemana.muestras)}${resumenSemana.pendientes?" *":""}</b></td></tr>`;
          }).join("")}</tbody>
        </table>
        <div class="print-chart"><h3>METEORO · CONFORMIDAD GRUPAL (SEMANAL)</h3>${renderGrafica(periodosFiltrados)}</div>
      </div>
      <div class="signature-grid"><div>JEFE PRODUCCIÓN</div><div>SUPERVISOR (J)</div><div>SUPERVISOR (M)</div><div>JEFE SAVIA - METEORO</div></div>
    </section>
  `;
}

periodoSelect.addEventListener("change", renderInforme);
anioSelect.addEventListener("change", () => { semanaSelect.value = ""; renderInforme(); });
semanaSelect.addEventListener("change", renderInforme);
document.querySelector("#imprimirBtn").addEventListener("click", () => window.print());
document.querySelector("#pdfBtn").addEventListener("click", () => window.print());
renderInforme();
window.addEventListener("focus",()=>{void renderInforme();});
