const form = document.querySelector("#formDesbotonado");
const fechaInput = document.querySelector("#fecha");
const empleadoSelect = document.querySelector("#desbotonador");
const empleadoBuscar = document.querySelector("#desbotonadorBuscar");
const empleadoLista = document.querySelector("#desbotonadorLista");
const colaboradorSeleccionadoEl = document.querySelector("#colaboradorSeleccionado");
const bloqueLista = document.querySelector("#bloqueLista");
const bloqueInput = document.querySelector("#bloque");
const camaSelect = document.querySelector("#cama");
const camaBuscar = document.querySelector("#camaBuscar");
const camaLista = document.querySelector("#camaLista");

const viewTabs = [...document.querySelectorAll("[data-desbotonado-vista]")];
const vistaRegistro = document.querySelector("#vistaRegistro");
const vistaTiempos = document.querySelector("#vistaTiempos");

const horasLaboralesMin = document.querySelector("#horasLaboralesMin");
const horasExtraMin = document.querySelector("#horasExtraMin");
const pMadresMin = document.querySelector("#pMadresMin");
const pAbuelasMin = document.querySelector("#pAbuelasMin");
const desplazamientoMin = document.querySelector("#desplazamientoMin");
const calisteniaMin = document.querySelector("#calisteniaMin");
const capacitacionMin = document.querySelector("#capacitacionMin");
const otrasLaboresMin = document.querySelector("#otrasLaboresMin");
const tiempoDisponibleTexto = document.querySelector("#tiempoDisponibleTexto");
const tiempoRealTexto = document.querySelector("#tiempoRealTexto");
const guardarTiemposBtn = document.querySelector("#guardarTiemposBtn");
const limpiarTiemposBtn = document.querySelector("#limpiarTiemposBtn");
const tiemposResultStatus = document.querySelector("#tiemposResultStatus");
const tiemposResultState = document.querySelector("#tiemposResultState");
const tiemposRegistrosLista = document.querySelector("#tiemposRegistrosLista");

const registros = [];
let catalogos = { empleados: [], camas: [] };

const texto = (obj, ...keys) => {
  for (const key of keys) if (obj?.[key] != null) return String(obj[key]);
  return "";
};

function fechaLocal() {
  const hoy = new Date();
  const yyyy = hoy.getFullYear();
  const mm = String(hoy.getMonth() + 1).padStart(2, "0");
  const dd = String(hoy.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function aplicarVista(vista) {
  const esTiempos = vista === "tiempos";
  vistaRegistro.hidden = esTiempos;
  vistaTiempos.hidden = !esTiempos;
  viewTabs.forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.desbotonadoVista === (esTiempos ? "tiempos" : "registro"));
  });
}

viewTabs.forEach((btn) => {
  btn.addEventListener("click", () => aplicarVista(btn.dataset.desbotonadoVista));
});

function cargarEmpleados(filtro = "") {
  const consulta = filtro.trim().toLowerCase();
  const visibles = catalogos.empleados
    .slice()
    .sort((a,b) => texto(a,"nombre","Nombre").localeCompare(texto(b,"nombre","Nombre"),"es"))
    .filter((e) => `${texto(e,"nombre","Nombre","descripcion")} (${texto(e,"codigo","Codigo","cedula","Cedula")})`.toLowerCase().includes(consulta))
    .slice(0,40);

  empleadoSelect.innerHTML = '<option value="">Seleccione un colaborador</option>';
  empleadoLista.innerHTML = visibles.length
    ? visibles.map((e,i) => `<div class="pending-item" data-index="${i}" style="cursor:pointer;padding:8px 10px"><span>${texto(e,"nombre","Nombre","descripcion")} (${texto(e,"codigo","Codigo","cedula","Cedula")})</span></div>`).join("")
    : '<p class="hint" style="margin:0">No hay empleados que coincidan con la búsqueda.</p>';

  empleadoLista.querySelectorAll("[data-index]").forEach((el) => el.addEventListener("mousedown", (event) => {
    event.preventDefault();
    const e = visibles[Number(el.dataset.index)];
    const codigo = texto(e,"codigo","Codigo","cedula","Cedula");
    const nombre = texto(e,"nombre","Nombre","descripcion") || codigo;
    const option = new Option(`${nombre} (${codigo})`, codigo);
    option.dataset.nombre = nombre;
    empleadoSelect.add(option);
    empleadoSelect.value = codigo;
    colaboradorSeleccionadoEl.textContent = `${nombre} (${codigo})`;
    empleadoBuscar.value = "";
    empleadoLista.innerHTML = "";
    render();
  }));
}

function cargarBloques(filtro = "") {
  const consulta = filtro.trim().toLowerCase();
  const bloques = [...new Set(catalogos.camas.map(c => texto(c,"bloque","Bloque")).filter(Boolean))]
    .sort((a,b)=>a.localeCompare(b,"es",{numeric:true}))
    .filter((bloque) => `Bloque ${bloque}`.toLowerCase().includes(consulta));

  bloqueLista.innerHTML = bloques.length
    ? bloques.map((bloque,i) => `<div class="pending-item" data-index="${i}" style="cursor:pointer;padding:8px 10px"><span>Bloque ${bloque}</span></div>`).join("")
    : '<p class="hint" style="margin:0">No hay bloques que coincidan con la búsqueda.</p>';

  bloqueLista.querySelectorAll("[data-index]").forEach((el) => el.addEventListener("mousedown", (event) => {
    event.preventDefault();
    bloqueInput.value = bloques[Number(el.dataset.index)];
    bloqueLista.innerHTML = "";
    cargarCamas();
  }));
}

function cargarCamas(filtro = "") {
  const bloque = bloqueInput.value.trim();
  const consulta = filtro.trim().toLowerCase();
  const camas = [...new Set(
    catalogos.camas
      .filter(c => texto(c,"bloque","Bloque") === bloque)
      .map(c => texto(c,"cama","Cama"))
  )]
    .sort((a,b)=>a.localeCompare(b,"es",{numeric:true}))
    .filter(cama => `Cama ${cama}`.toLowerCase().includes(consulta));

  camaLista.innerHTML = bloque
    ? (camas.length
      ? camas.map((cama,i) => `<div class="pending-item" data-index="${i}" style="cursor:pointer;padding:8px 10px"><span>Cama ${cama}</span></div>`).join("")
      : '<p class="hint" style="margin:0">No hay camas que coincidan con la búsqueda.</p>')
    : '<p class="hint" style="margin:0">Seleccione primero un bloque.</p>';

  camaLista.querySelectorAll("[data-index]").forEach(el => el.addEventListener("mousedown", event => {
    event.preventDefault();
    const cama = camas[Number(el.dataset.index)];
    camaSelect.innerHTML = "";
    camaSelect.add(new Option(cama,cama));
    camaSelect.value = cama;
    camaBuscar.value = cama;
    camaLista.innerHTML = "";
    cargarTallosCama(bloque, cama);
  }));
}

async function cargarTallosCama(bloque, cama) {
  const tallosInput = document.querySelector("#tallosCama");
  const mensaje = document.querySelector("#apiMensaje");
  tallosInput.value = "";
  mensaje.textContent = "Consultando tallos de la cama…";
  try {
    const resultado = await SyncEngine.apiGetOnline(`/api/siembra/online/tallos-cama?bloque=${encodeURIComponent(bloque)}&cama=${encodeURIComponent(cama)}`);
    tallosInput.value = Number(resultado.totalTallos || 0);
    mensaje.textContent = resultado.registros?.length
      ? `${resultado.registros.length} registro(s) usados · líneas × densidad = ${resultado.totalTallos}`
      : "No hay registros de SiembraOnline para esta cama.";
  } catch (error) {
    mensaje.textContent = `No se pudieron consultar los tallos: ${error.message}`;
  }
}

async function cargarCatalogos() {
  try {
    if (navigator.onLine) await SyncEngine.sincronizarCatalogos();
  } catch (e) {
    console.warn("No se pudieron actualizar catálogos", e);
  }

  try {
    const c = await SyncEngine.obtenerCatalogosLocal();
    catalogos.empleados = (c.empleados || []).filter(
      (item) => item.activo !== false && item.retirado !== 1 && item.retirado !== true
    );

    let camas = [];
    try {
      if (navigator.onLine) camas = await SyncEngine.apiGetOnline("/api/siembra/online/bloques-camas");
    } catch (_) {}

    catalogos.camas = (camas.length ? camas : c.camas || [])
      .map(item => ({
        bloque: texto(item,"bloque","Bloque").trim(),
        cama: texto(item,"cama","Cama").trim()
      }))
      .filter(item => item.bloque && item.cama);
  } catch (e) {
    console.error(e);
  }

  empleadoLista.innerHTML = "";
  bloqueLista.innerHTML = "";
  cargarCamas();
  document.querySelector("#apiStatusPill").textContent = navigator.onLine ? "En línea" : "Sin conexión";
}

empleadoBuscar.addEventListener("focus",()=>cargarEmpleados(empleadoBuscar.value));
empleadoBuscar.addEventListener("input",()=>cargarEmpleados(empleadoBuscar.value));
bloqueInput.addEventListener("focus",()=>cargarBloques(bloqueInput.value));
bloqueInput.addEventListener("input",()=>{
  cargarBloques(bloqueInput.value);
  camaBuscar.value="";
  camaSelect.innerHTML='<option value=""></option>';
  camaLista.innerHTML="";
  document.querySelector("#tallosCama").value="";
});
camaBuscar.addEventListener("focus",()=>cargarCamas(camaBuscar.value));
camaBuscar.addEventListener("input",()=>{
  camaSelect.innerHTML='<option value=""></option>';
  document.querySelector("#tallosCama").value="";
  cargarCamas(camaBuscar.value);
});

document.addEventListener("click", (event) => {
  if (event.target !== empleadoBuscar && !empleadoLista.contains(event.target)) empleadoLista.innerHTML = "";
  if (event.target !== bloqueInput && !bloqueLista.contains(event.target)) bloqueLista.innerHTML = "";
  if (event.target !== camaBuscar && !camaLista.contains(event.target)) camaLista.innerHTML = "";
});

function numero(v,d=2) {
  return new Intl.NumberFormat("es-CO",{maximumFractionDigits:d}).format(v);
}

function render() {
  const tbody = document.querySelector("#tablaRegistros");
  const nombre = empleadoSelect.selectedOptions[0]?.dataset.nombre || "";
  document.querySelector("#nombreResumen").textContent = nombre
    ? `Colaborador: ${nombre}`
    : "Seleccione un colaborador";

  if (!registros.length) {
    tbody.innerHTML = '<tr><td colspan="5">Todavía no hay camas registradas.</td></tr>';
    document.querySelector("#totalCamas").textContent = "0";
    document.querySelector("#totalTallos").textContent = "0";
    return;
  }

  tbody.innerHTML = registros.map(r => `
    <tr>
      <td>${r.tipoLabor}</td>
      <td>${r.bloque}</td>
      <td>${r.cama}</td>
      <td>${numero(r.mediosCuadros,1)}</td>
      <td>${numero(r.tallos,2)}</td>
    </tr>
  `).join("");

  const tallos = registros.reduce((s,r)=>s+r.tallos,0);
  document.querySelector("#totalCamas").textContent = registros.length;
  document.querySelector("#totalTallos").textContent = numero(tallos);
}

form.addEventListener("submit", e => {
  e.preventDefault();

  if (!fechaInput.value) return alert("Seleccione la fecha.");
  if (!empleadoSelect.value) return alert("Seleccione un colaborador.");

  const tallosCama = Number(document.querySelector("#tallosCama").value);
  const erradicaciones = Number(document.querySelector("#erradicaciones").value);
  const medios = Number(document.querySelector("#mediosCuadros").value);

  if (erradicaciones > tallosCama) {
    return alert("Las erradicaciones no pueden ser mayores que los tallos de la cama.");
  }

  const tallos = (tallosCama - erradicaciones) / 16 * medios;
  registros.push({
    fecha: fechaInput.value,
    colaborador: empleadoSelect.value,
    tipoLabor: document.querySelector("#tipoLabor").value,
    bloque: bloqueInput.value.trim(),
    cama: camaSelect.value,
    mediosCuadros: medios,
    tallos
  });

  render();
  form.reset();
  cargarCamas();
});

document.querySelector("#btnLimpiarCama").addEventListener("click",()=>{
  form.reset();
  cargarCamas();
});

document.querySelector("#btnNuevoDesbotonador").addEventListener("click",()=>{
  if (registros.length && !confirm("¿Desea iniciar otro colaborador? Se borrarán los registros de esta sesión.")) return;
  registros.length = 0;
  empleadoSelect.innerHTML = '<option value=""></option>';
  empleadoSelect.value = "";
  empleadoBuscar.value = "";
  colaboradorSeleccionadoEl.textContent = "Sin colaborador seleccionado";
  render();
});

function minutosCampo(input) {
  const valor = Number(input.value || 0);
  return Number.isFinite(valor) && valor > 0 ? Math.floor(valor) : 0;
}

function formatoMinutos(total) {
  const minutos = Math.max(0, Number(total) || 0);
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  return horas > 0 ? `${horas} h ${resto} min` : `${resto} min`;
}

function actualizarCalculoTiempos() {
  const laborales = minutosCampo(horasLaboralesMin);
  const extras = minutosCampo(horasExtraMin);
  const otros =
    minutosCampo(pMadresMin) +
    minutosCampo(pAbuelasMin) +
    minutosCampo(desplazamientoMin) +
    minutosCampo(calisteniaMin) +
    minutosCampo(capacitacionMin);

  const disponible = laborales + extras;
  const real = Math.max(0, disponible - otros);

  otrasLaboresMin.value = String(otros);
  tiempoDisponibleTexto.textContent = formatoMinutos(disponible);
  tiempoRealTexto.textContent = formatoMinutos(real);

  return { laborales, extras, otros, disponible, real };
}

[horasLaboralesMin, horasExtraMin, pMadresMin, pAbuelasMin, desplazamientoMin, calisteniaMin, capacitacionMin]
  .forEach((input) => input.addEventListener("input", actualizarCalculoTiempos));

function marcarResultadoTiempos(tipo, mensaje) {
  tiemposResultStatus.classList.remove("ok", "warning", "error");
  if (tipo) tiemposResultStatus.classList.add(tipo);
  tiemposResultState.textContent = mensaje;
}

function limpiarTiempos() {
  [horasLaboralesMin, horasExtraMin, pMadresMin, pAbuelasMin, desplazamientoMin, calisteniaMin, capacitacionMin]
    .forEach((input) => { input.value = ""; });
  actualizarCalculoTiempos();
}

async function renderRegistrosTiempos() {
  const registrosTiempos = (await OfflineDb.getAll("desbotonadoMallasTiempos"))
    .sort((a,b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));

  tiemposRegistrosLista.innerHTML = registrosTiempos.length
    ? registrosTiempos.slice(0,20).map((r) => `
        <article class="pending-item">
          <strong>${r.fecha} · ${r.colaboradorNombre}</strong>
          <span>Laborales: ${formatoMinutos(r.horasLaboralesMin)} · Extra: ${formatoMinutos(r.horasExtraMin)}</span>
          <span>Otras actividades: ${formatoMinutos(r.otrasLaboresMin)}</span>
          <span>Tiempo real de labor: ${formatoMinutos(r.tiempoRealMin)}</span>
        </article>
      `).join("")
    : '<p class="hint" style="margin:0;">Todavía no hay registros de tiempo guardados.</p>';
}

async function guardarTiempos() {
  const fecha = fechaInput.value;
  if (!fecha) return marcarResultadoTiempos("error", "Selecciona la fecha.");
  if (!empleadoSelect.value) return marcarResultadoTiempos("error", "Selecciona un colaborador.");

  const calculo = actualizarCalculoTiempos();
  if (calculo.disponible <= 0) {
    return marcarResultadoTiempos("error", "Ingresa los minutos de Horas Laborales o de Horas Extra.");
  }

  const nombre = empleadoSelect.selectedOptions[0]?.dataset.nombre || empleadoSelect.value;

  const registro = {
    id: SyncEngine.generarUUID(),
    fecha,
    colaborador: empleadoSelect.value,
    colaboradorNombre: nombre,
    horasLaboralesMin: calculo.laborales,
    horasExtraMin: calculo.extras,
    pMadresMin: minutosCampo(pMadresMin),
    pAbuelasMin: minutosCampo(pAbuelasMin),
    desplazamientoMin: minutosCampo(desplazamientoMin),
    calisteniaMin: minutosCampo(calisteniaMin),
    capacitacionMin: minutosCampo(capacitacionMin),
    otrasLaboresMin: calculo.otros,
    tiempoDisponibleMin: calculo.disponible,
    tiempoRealMin: calculo.real,
    usuario: sesion?.username || "",
    syncStatus: "PendienteBackend",
    createdAt: new Date().toISOString()
  };

  await OfflineDb.put("desbotonadoMallasTiempos", registro);
  marcarResultadoTiempos("ok", `Tiempos guardados. Tiempo real dedicado a la labor: ${formatoMinutos(registro.tiempoRealMin)}.`);
  limpiarTiempos();
  await renderRegistrosTiempos();
}

guardarTiemposBtn.addEventListener("click", guardarTiempos);
limpiarTiemposBtn.addEventListener("click", () => {
  limpiarTiempos();
  marcarResultadoTiempos(null, "Ingresa los tiempos en minutos para calcular el tiempo real de labor.");
});

window.addEventListener("online", cargarCatalogos);

(async function iniciarDesbotonadoMallas() {
  fechaInput.value = fechaLocal();
  limpiarTiempos();
  aplicarVista("registro");
  await cargarCatalogos();
  render();
  await renderRegistrosTiempos();
})();
