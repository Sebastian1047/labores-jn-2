const sesionPreparacion = JSON.parse(sessionStorage.getItem("labores_usuario") || "null");
if (!sesionPreparacion) window.location.href = "./login.html";

const usuarioPill = document.querySelector("#usuarioPill");
const estadoPill = document.querySelector("#estadoPill");
const fechaInput = document.querySelector("#fecha");
const colaboradorBuscar = document.querySelector("#colaboradorBuscar");
const colaboradorLista = document.querySelector("#colaboradorLista");
const colaboradorSeleccionadoEl = document.querySelector("#colaboradorSeleccionado");
const bloqueSelect = document.querySelector("#bloque");
const camaSelect = document.querySelector("#cama");
const viewTabs = [...document.querySelectorAll("[data-preparacion-vista]")];
const vistaRegistro = document.querySelector("#vistaRegistro");
const vistaTiempos = document.querySelector("#vistaTiempos");
const preparacionObservaciones = document.querySelector("#preparacionObservaciones");
const preparacionTiemposObservaciones = document.querySelector("#preparacionTiemposObservaciones");

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

usuarioPill.textContent = sesionPreparacion?.empleadoNombre || sesionPreparacion?.username || "Usuario";

let colaboradores = [];
let camas = [];
let colaboradorSeleccionado = null;

function fechaLocal() {
  const hoy = new Date();
  const yyyy = hoy.getFullYear();
  const mm = String(hoy.getMonth() + 1).padStart(2, "0");
  const dd = String(hoy.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function etiquetaEmpleado(item) {
  const nombre = item.nombre || item.empleadoNombre || item.codigo || "Sin nombre";
  const codigo = item.codigo || item.docid || item.id || "—";
  return `${nombre} (${codigo})`;
}
function valorCatalogo(item, minuscula, mayuscula) {
  return String(item?.[minuscula] ?? item?.[mayuscula] ?? "").trim();
}

function cargarBloques() {
  const bloques = [...new Set(camas.map((item) => valorCatalogo(item, "bloque", "Bloque")).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "es", { numeric: true }));

  bloqueSelect.innerHTML =
    '<option value="">Seleccione un bloque</option>' +
    bloques.map((bloque) => `<option value="${bloque}">${bloque}</option>`).join("");

  cargarCamasDelBloque();
}

function cargarCamasDelBloque() {
  const bloque = bloqueSelect.value;
  const disponibles = [...new Set(
    camas
      .filter((item) => valorCatalogo(item, "bloque", "Bloque") === bloque)
      .map((item) => valorCatalogo(item, "cama", "Cama"))
      .filter(Boolean)
  )].sort((a, b) => a.localeCompare(b, "es", { numeric: true }));

  if (!bloque) {
    camaSelect.disabled = true;
    camaSelect.innerHTML = '<option value="">Seleccione primero un bloque</option>';
    return;
  }

  camaSelect.disabled = false;
  camaSelect.innerHTML =
    '<option value="">Seleccione una cama</option>' +
    disponibles.map((cama) => `<option value="${cama}">${cama}</option>`).join("");
}

bloqueSelect.addEventListener("change", cargarCamasDelBloque);

function renderListaColaboradores() {
  const texto = colaboradorBuscar.value.trim().toLowerCase();
  const visibles = colaboradores
    .filter((item) => !texto || etiquetaEmpleado(item).toLowerCase().includes(texto))
    .slice(0, 50);

  colaboradorLista.innerHTML = visibles.length
    ? visibles.map((item, idx) =>
        `<div class="pending-item" data-index="${idx}" style="cursor:pointer;padding:8px 10px"><span>${etiquetaEmpleado(item)}</span></div>`
      ).join("")
    : '<p class="hint" style="margin:0;">No hay colaboradores disponibles en el catálogo local.</p>';

  colaboradorLista.querySelectorAll("[data-index]").forEach((el) => {
    el.addEventListener("mousedown", (event) => {
      event.preventDefault();
      const item = visibles[Number(el.dataset.index)];
      colaboradorSeleccionado = item;
      colaboradorSeleccionadoEl.textContent = etiquetaEmpleado(item);
      colaboradorBuscar.value = "";
      colaboradorLista.innerHTML = "";
    });
  });
}

colaboradorBuscar.addEventListener("focus", renderListaColaboradores);
colaboradorBuscar.addEventListener("input", renderListaColaboradores);
document.addEventListener("click", (event) => {
  if (event.target !== colaboradorBuscar && !colaboradorLista.contains(event.target)) {
    colaboradorLista.innerHTML = "";
  }
});

function aplicarVista(vista) {
  const esTiempos = vista === "tiempos";
  vistaRegistro.hidden = esTiempos;
  vistaTiempos.hidden = !esTiempos;
  viewTabs.forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.preparacionVista === (esTiempos ? "tiempos" : "registro"));
  });
}

viewTabs.forEach((btn) => {
  btn.addEventListener("click", () => aplicarVista(btn.dataset.preparacionVista));
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
  preparacionTiemposObservaciones.value = "";
  actualizarCalculoTiempos();
}

async function renderRegistrosTiempos() {
  const registros = (await OfflineDb.getAll("preparacionCamasTiempos"))
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));

  tiemposRegistrosLista.innerHTML = registros.length
    ? registros.slice(0, 20).map((r) => `
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
  if (!colaboradorSeleccionado) return marcarResultadoTiempos("error", "Selecciona un colaborador.");

  const calculo = actualizarCalculoTiempos();
  if (calculo.disponible <= 0) {
    return marcarResultadoTiempos("error", "Ingresa los minutos de Horas Laborales o de Horas Extra.");
  }

  const codigo =
    colaboradorSeleccionado.codigo ||
    colaboradorSeleccionado.docid ||
    colaboradorSeleccionado.id;

  const registro = {
    id: SyncEngine.generarUUID(),
    fecha,
    colaborador: String(codigo),
    colaboradorNombre:
      colaboradorSeleccionado.nombre ||
      colaboradorSeleccionado.empleadoNombre ||
      String(codigo),
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
    observaciones: preparacionTiemposObservaciones.value.trim(),
    usuario: sesionPreparacion?.username || "",
    syncStatus: "PendienteBackend",
    createdAt: new Date().toISOString(),
  };

  await OfflineDb.put("preparacionCamasTiempos", registro);
  marcarResultadoTiempos(
    "ok",
    `Tiempos guardados. Tiempo real dedicado a la labor: ${formatoMinutos(registro.tiempoRealMin)}.`
  );
  limpiarTiempos();
  await renderRegistrosTiempos();
}

guardarTiemposBtn.addEventListener("click", guardarTiempos);
limpiarTiemposBtn.addEventListener("click", () => {
  limpiarTiempos();
  marcarResultadoTiempos(null, "Ingresa los tiempos en minutos para calcular el tiempo real de labor.");
});

async function cargarColaboradores() {
  try {
    const local = await SyncEngine.obtenerCatalogosLocal();
    colaboradores = (local.empleados || []).filter(
      (item) => item.activo !== false && item.retirado !== 1 && item.retirado !== true
    );
    camas = local.camas || [];
    cargarBloques();

    if (navigator.onLine) {
      try {
        await SyncEngine.sincronizarCatalogos();
        const actualizados = await SyncEngine.obtenerCatalogosLocal();
        colaboradores = (actualizados.empleados || []).filter(
          (item) => item.activo !== false && item.retirado !== 1 && item.retirado !== true
        );
        camas = actualizados.camas || [];
        cargarBloques();
        estadoPill.textContent = "Catálogos actualizados";
        estadoPill.classList.remove("warn");
        estadoPill.classList.add("ok");
      } catch {
        estadoPill.textContent = "Datos locales";
        estadoPill.classList.add("warn");
      }
    }

    if (!colaboradores.length) {
      estadoPill.textContent = "Sin catálogo";
      estadoPill.classList.add("warn");
    }
  } catch {
    colaboradores = [];
    estadoPill.textContent = "Sin catálogo";
    estadoPill.classList.add("warn");
  }
}

window.addEventListener("online", cargarColaboradores);

(async function iniciarPreparacionCamas() {
  fechaInput.value = fechaLocal();
  limpiarTiempos();
  aplicarVista("registro");
  await cargarColaboradores();
  await renderRegistrosTiempos();
})();
