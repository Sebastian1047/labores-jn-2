const sesionBandejas = JSON.parse(sessionStorage.getItem("labores_usuario") || "null");
if (!sesionBandejas) window.location.href = "./login.html";

const usuarioPill = document.querySelector("#usuarioPill");
const estadoPill = document.querySelector("#estadoPill");
const fechaInput = document.querySelector("#fecha");
const densidadInput = document.querySelector("#densidad");
const sembradorBuscar = document.querySelector("#sembradorBuscar");
const sembradorLista = document.querySelector("#sembradorLista");
const sembradorSeleccionadoEl = document.querySelector("#sembradorSeleccionado");
const variedadBuscar = document.querySelector("#variedadBuscar");
const variedadLista = document.querySelector("#variedadLista");
const variedadSeleccionadaEl = document.querySelector("#variedadSeleccionada");
const guardarBtn = document.querySelector("#guardarBtn");
const limpiarBtn = document.querySelector("#limpiarBtn");
const resultStatus = document.querySelector("#resultStatus");
const resultState = document.querySelector("#resultState");
const registrosLista = document.querySelector("#registrosLista");

usuarioPill.textContent = sesionBandejas?.empleadoNombre || sesionBandejas?.username || "Usuario";

let catalogos = { empleados: [], variedades: [] };
let sembradorSeleccionado = null;
let variedadSeleccionada = null;

function fechaLocal() {
  const hoy = new Date();
  const yyyy = hoy.getFullYear();
  const mm = String(hoy.getMonth() + 1).padStart(2, "0");
  const dd = String(hoy.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function marcarResultado(tipo, mensaje) {
  resultStatus.classList.remove("ok", "warning", "error");
  if (tipo) resultStatus.classList.add(tipo);
  resultState.textContent = mensaje;
}

function etiquetaEmpleado(item) {
  return `${item.nombre || item.empleadoNombre || item.codigo} (${item.codigo || item.docid || item.id})`;
}

function etiquetaVariedad(item) {
  return item.nombre || item.descripcion || item.codigo;
}

function crearBuscador({ input, lista, items, etiqueta, seleccionar, mensajeVacio }) {
  function render() {
    const texto = input.value.trim().toLowerCase();
    const visibles = items()
      .filter((item) => !texto || etiqueta(item).toLowerCase().includes(texto))
      .slice(0, 50);

    lista.innerHTML = visibles.length
      ? visibles.map((item, idx) =>
          `<div class="pending-item" data-index="${idx}" style="cursor:pointer;padding:8px 10px"><span>${etiqueta(item)}</span></div>`
        ).join("")
      : `<p class="hint" style="margin:0">${mensajeVacio}</p>`;

    lista.querySelectorAll("[data-index]").forEach((el) => {
      el.addEventListener("mousedown", (event) => {
        event.preventDefault();
        seleccionar(visibles[Number(el.dataset.index)]);
        input.value = "";
        lista.innerHTML = "";
      });
    });
  }

  input.addEventListener("focus", render);
  input.addEventListener("input", render);
  document.addEventListener("click", (event) => {
    if (event.target !== input && !lista.contains(event.target)) lista.innerHTML = "";
  });
}

crearBuscador({
  input: sembradorBuscar,
  lista: sembradorLista,
  items: () => catalogos.empleados,
  etiqueta: etiquetaEmpleado,
  mensajeVacio: "No hay sembradores disponibles en el catálogo local.",
  seleccionar: (item) => {
    sembradorSeleccionado = item;
    sembradorSeleccionadoEl.textContent = etiquetaEmpleado(item);
  },
});

crearBuscador({
  input: variedadBuscar,
  lista: variedadLista,
  items: () => catalogos.variedades,
  etiqueta: etiquetaVariedad,
  mensajeVacio: "No hay variedades disponibles en el catálogo local.",
  seleccionar: (item) => {
    variedadSeleccionada = item;
    variedadSeleccionadaEl.textContent = `${etiquetaVariedad(item)}${item.codigo ? ` (${item.codigo})` : ""}`;
  },
});

function limpiarFormulario() {
  fechaInput.value = fechaLocal();
  densidadInput.value = "";
  sembradorSeleccionado = null;
  variedadSeleccionada = null;
  sembradorBuscar.value = "";
  variedadBuscar.value = "";
  sembradorLista.innerHTML = "";
  variedadLista.innerHTML = "";
  sembradorSeleccionadoEl.textContent = "Sin sembrador seleccionado";
  variedadSeleccionadaEl.textContent = "Sin variedad seleccionada";
}

async function renderRegistros() {
  const registros = (await OfflineDb.getAll("bandejasEnraizamiento"))
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));

  registrosLista.innerHTML = registros.length
    ? registros.slice(0, 20).map((r) => `
        <article class="pending-item">
          <strong>${r.fecha} · ${r.variedadNombre}</strong>
          <span>Sembrador: ${r.sembradorNombre}</span>
          <span>Densidad: ${r.densidad}</span>
        </article>
      `).join("")
    : '<p class="hint" style="margin:0;">Todavía no hay registros guardados.</p>';
}

async function guardarRegistro() {
  const fecha = fechaInput.value;
  const densidad = densidadInput.value.trim();

  if (!fecha) return marcarResultado("error", "Selecciona la fecha.");
  if (!densidad) return marcarResultado("error", "Ingresa la densidad.");
  if (!/^\d+$/.test(densidad)) return marcarResultado("error", "La densidad debe contener solo números.");
  if (!sembradorSeleccionado) return marcarResultado("error", "Selecciona un sembrador.");
  if (!variedadSeleccionada) return marcarResultado("error", "Selecciona una variedad.");

  const sembradorCodigo = sembradorSeleccionado.codigo || sembradorSeleccionado.docid || sembradorSeleccionado.id;
  const variedadCodigo = variedadSeleccionada.codigo || variedadSeleccionada.id;

  const registro = {
    id: SyncEngine.generarUUID(),
    fecha,
    densidad: Number(densidad),
    sembrador: String(sembradorCodigo),
    sembradorNombre: sembradorSeleccionado.nombre || sembradorSeleccionado.empleadoNombre || String(sembradorCodigo),
    variedad: String(variedadCodigo),
    variedadNombre: variedadSeleccionada.nombre || variedadSeleccionada.descripcion || String(variedadCodigo),
    usuario: sesionBandejas?.username || "",
    syncStatus: "PendienteBackend",
    createdAt: new Date().toISOString(),
  };

  await OfflineDb.put("bandejasEnraizamiento", registro);
  marcarResultado("ok", `Registro guardado localmente: ${registro.sembradorNombre} · ${registro.variedadNombre}.`);
  limpiarFormulario();
  await renderRegistros();
}

async function cargarCatalogos() {
  try {
    const local = await SyncEngine.obtenerCatalogosLocal();
    catalogos.empleados = (local.empleados || []).filter((x) => x.activo !== false && x.retirado !== 1 && x.retirado !== true);
    catalogos.variedades = local.variedades || [];

    if (navigator.onLine) {
      try {
        await SyncEngine.sincronizarCatalogos();
        const actualizados = await SyncEngine.obtenerCatalogosLocal();
        catalogos.empleados = (actualizados.empleados || []).filter((x) => x.activo !== false && x.retirado !== 1 && x.retirado !== true);
        catalogos.variedades = actualizados.variedades || [];
        estadoPill.textContent = "Catálogos actualizados";
        estadoPill.classList.add("ok");
      } catch {
        estadoPill.textContent = "Datos locales";
        estadoPill.classList.add("warn");
      }
    }

    if (!catalogos.empleados.length || !catalogos.variedades.length) {
      marcarResultado("warning", "Conéctate una vez para descargar sembradores y variedades.");
    }
  } catch {
    marcarResultado("error", "No fue posible cargar los catálogos del equipo.");
  }
}

guardarBtn.addEventListener("click", guardarRegistro);
limpiarBtn.addEventListener("click", () => {
  limpiarFormulario();
  marcarResultado(null, "Complete los datos para guardar el registro.");
});

window.addEventListener("online", cargarCatalogos);

(async function iniciarBandejas() {
  limpiarFormulario();
  await cargarCatalogos();
  await renderRegistros();
})();
