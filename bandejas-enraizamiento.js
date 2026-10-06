const sesionBandejas = JSON.parse(sessionStorage.getItem("labores_usuario") || "null");
if (!sesionBandejas) window.location.href = "./login.html";

const usuarioPill = document.querySelector("#usuarioPill");
const estadoPill = document.querySelector("#estadoPill");
const fechaInput = document.querySelector("#fecha");
const bloqueInput = document.querySelector("#bloque");
const camaInput = document.querySelector("#cama");
const densidadInput = document.querySelector("#densidad");
const cantidadInput = document.querySelector("#cantidad");
const sembradorBuscar = document.querySelector("#sembradorBuscar");
const sembradorLista = document.querySelector("#sembradorLista");
const sembradorSeleccionadoEl = document.querySelector("#sembradorSeleccionado");
const variedadSelect = document.querySelector("#variedad");

const VARIEDADES_POR_TIPO = {
  "CREMON": [
    "9551° (KOLOUSSUS)",
    "ABRIANA",
    "ALJONKA DARK",
    "ANDREA CR",
    "ARCTIC QUEEN CR",
    "ASTROID",
    "BACHATA",
    "BERNAL CR",
    "CADIZ",
    "CHESTNUT",
    "CONTESSA",
    "CORAZON",
    "COOPER",
    "FUZZBALL",
    "GALORE",
    "GRAND PRESTIGE",
    "KAMALIYA",
    "LAMIRA",
    "LINETTE CR",
    "LOTSO",
    "MAGNUM",
    "MAISY CR",
    "MORGAN",
    "PETRUSKA",
    "PRIMAVERA",
    "PURA",
    "RED TORNADO",
    "ROJO",
    "ROSSANO",
    "ROSSETA",
    "SOLEMIO",
    "TUSCA CR"
  ],
  "CUSHION": [
    "ALLSTAR",
    "ANDREA",
    "ARCTIC QUEEN",
    "AVILA",
    "BERNAL",
    "BRAZUCA",
    "CHAMPAGNE YELLOW",
    "CHIANTI",
    "CORAZON",
    "COOPER",
    "CREME BRULEE",
    "CRUISE",
    "DARK COPPER",
    "DORITO",
    "FOGATA",
    "FORRESTER",
    "GRAND PRESTIGE",
    "HERTZ",
    "IMPULSE",
    "LAMIRA",
    "LEMONADA",
    "LINETTE",
    "LOVATO",
    "LOVATO APRICOT",
    "MADERA",
    "MAISY",
    "MAISY LIME",
    "PRINZ",
    "RANJA",
    "RAPSBERRY BRULEE",
    "REAL DEAL",
    "ROCK",
    "SEI RUBEUS",
    "SKYLIE",
    "SNOW CREST",
    "SOLEADO",
    "SWEET DREAMS",
    "TESTARROSA",
    "TRISSIA",
    "VERITY",
    "VERONICA",
    "VERONICA PEACH",
    "YOLANDA",
    "ZUMBA"
  ],
  "DAISY": [
    "AIRBRUSH",
    "ALMA",
    "AMETHYST DARK",
    "AQUAREL PINK",
    "ATLANTIS",
    "ATLANTIS DARK PINK",
    "ATLANTIS ORANGE",
    "BRAHMA",
    "BRASSA",
    "BRAZILIAM",
    "CANCAN",
    "CAÑO CRISTALES",
    "COLORADO SPRING",
    "DENZEL",
    "DOREMI",
    "FACTOR",
    "FELINA",
    "FIREFLY",
    "FUNSTRIPE",
    "KALI PROV.",
    "KANATA",
    "KARLO",
    "KINTARO",
    "LINA",
    "MADDOX",
    "MANAGUA ORANGE",
    "MELINDA",
    "MELROSE",
    "MELROSE DARK",
    "MORNING",
    "PLASMA",
    "PRADA SWEET",
    "RANDALL",
    "RUBLE",
    "SPECTRA",
    "STRIPY",
    "SUNNY DAY",
    "TEQUILA SUNRISE",
    "TOP DOLLAR",
    "UVITA",
    "VALENTINO",
    "VESPA SPLENDID",
    "VITAMIN C"
  ],
  "MICROPOMPON BUTTON": [
    "CANDY CRUSH MINT",
    "CANDY CRUSH PINK",
    "CANDY CRUSH PURPLE",
    "CANDY CRUSH RED",
    "CANDY CRUSH WHITE",
    "CANDY CRUSH YELLOW",
    "DOTTY BRONZE",
    "DOTTY PINK",
    "KAROL (12038)",
    "ORO"
  ],
  "MICROPOMPON DAISY": [
    "ESPERANZA PURA",
    "GREICY",
    "ILSEY",
    "KATY",
    "LUCY",
    "MOLLY PURPLE",
    "MOLLY YELLOW",
    "PANCRAS DARK",
    "PICANTE",
    "REESES",
    "SUPER B",
    "WALLACE",
    "YING YANG XL",
    "YODA"
  ],
  "NOVELTY": [
    "AIPOM",
    "ALEMANI",
    "AMARIS",
    "ARTIGAS",
    "BLANCA NIEVES",
    "BONSAI",
    "CABARET",
    "CHIKORITA",
    "CRESTA PURPLE",
    "DELIROCK",
    "DELIROCK PINK",
    "FLORANGE DARK",
    "FUZZBALL",
    "HOT ROD",
    "HOW SWEET",
    "LAURISSIA",
    "LEXI",
    "LIVY",
    "MARK TWAIN",
    "NIVEA",
    "OKADA",
    "PAINT BALL SUNNY",
    "PASION BELEN",
    "PILOT",
    "PINKON",
    "PRINCESS PEACH",
    "ROSELLE",
    "ROSSIA",
    "SHORTCAKE",
    "SHORTCAKE BRONZE",
    "SOLAR ECLIPSE",
    "TARAPACA",
    "TIARA",
    "WHATSAPP",
    "ZIPPO"
  ],
  "SPIDER": [
    "ALIS",
    "ANASTASIA DARK GREEN",
    "ANASTASIA YELLOW",
    "BAMBU",
    "CALAFURIA",
    "CALAFURIA SUNNY",
    "CHISPA",
    "ELEVEN",
    "MARCELA",
    "MIMOSA",
    "SELDIS",
    "TIANA DARK",
    "TOPSPIN",
    "WALHALLA"
  ]
};
const guardarBtn = document.querySelector("#guardarBtn");
const limpiarBtn = document.querySelector("#limpiarBtn");
const resultStatus = document.querySelector("#resultStatus");
const resultState = document.querySelector("#resultState");
const registrosTablaBody = document.querySelector("#registrosTablaBody");
const registrosDiaHint = document.querySelector("#registrosDiaHint");

const bandejasTabs = [...document.querySelectorAll("[data-bandejas-vista]")];
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

usuarioPill.textContent = sesionBandejas?.empleadoNombre || sesionBandejas?.username || "Usuario";

let catalogos = { empleados: [] };
let sembradorSeleccionado = null;

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

const VARIEDADES = [...new Set(Object.values(VARIEDADES_POR_TIPO).flat())]
  .sort((a, b) => a.localeCompare(b, "es"));

function cargarVariedades() {
  variedadSelect.innerHTML =
    '<option value="">Seleccione una variedad</option>' +
    VARIEDADES.map((nombre) => `<option value="${nombre}">${nombre}</option>`).join("");
}

function aplicarVistaBandejas(vista) {
  const esTiempos = vista === "tiempos";
  vistaRegistro.hidden = esTiempos;
  vistaTiempos.hidden = !esTiempos;
  bandejasTabs.forEach((btn) => btn.classList.toggle("active", btn.dataset.bandejasVista === vista));
}

bandejasTabs.forEach((btn) => {
  btn.addEventListener("click", () => aplicarVistaBandejas(btn.dataset.bandejasVista));
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

function limpiarFormularioTiempos() {
  [horasLaboralesMin, horasExtraMin, pMadresMin, pAbuelasMin, desplazamientoMin, calisteniaMin, capacitacionMin]
    .forEach((input) => { input.value = ""; });
  actualizarCalculoTiempos();
}

async function renderRegistrosTiempos() {
  const registros = (await OfflineDb.getAll("bandejasTiempos"))
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));

  tiemposRegistrosLista.innerHTML = registros.length
    ? registros.slice(0, 20).map((r) => `
        <article class="pending-item">
          <strong>${r.fecha} · ${r.sembradorNombre}</strong>
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
  if (!sembradorSeleccionado) return marcarResultadoTiempos("error", "Selecciona un sembrador.");

  const calculo = actualizarCalculoTiempos();
  if (calculo.disponible <= 0) {
    return marcarResultadoTiempos("error", "Ingresa los minutos de Horas Laborales o de Horas Extra.");
  }

  const sembradorCodigo =
    sembradorSeleccionado.codigo ||
    sembradorSeleccionado.docid ||
    sembradorSeleccionado.id;

  const registro = {
    id: SyncEngine.generarUUID(),
    fecha,
    sembrador: String(sembradorCodigo),
    sembradorNombre:
      sembradorSeleccionado.nombre ||
      sembradorSeleccionado.empleadoNombre ||
      String(sembradorCodigo),
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
    usuario: sesionBandejas?.username || "",
    syncStatus: "PendienteBackend",
    createdAt: new Date().toISOString(),
  };

  await OfflineDb.put("bandejasTiempos", registro);
  marcarResultadoTiempos(
    "ok",
    `Tiempos guardados. Tiempo real dedicado a la labor: ${formatoMinutos(registro.tiempoRealMin)}.`
  );
  limpiarFormularioTiempos();
  await renderRegistrosTiempos();
}

function limpiarLabor() {
  bloqueInput.value = "";
  camaInput.value = "";
  densidadInput.value = "";
  cantidadInput.value = "";
  variedadSelect.value = "";
}

function limpiarFormularioCompleto() {
  fechaInput.value = fechaLocal();
  sembradorSeleccionado = null;
  sembradorBuscar.value = "";
  sembradorLista.innerHTML = "";
  sembradorSeleccionadoEl.textContent = "Sin sembrador seleccionado";
  limpiarLabor();
}

async function renderRegistros() {
  const fecha = fechaInput.value;
  const registros = (await OfflineDb.getAll("bandejasEnraizamiento"))
    .filter((r) => !fecha || r.fecha === fecha)
    .sort((a, b) => String(a.createdAt || "").localeCompare(String(b.createdAt || "")));

  registrosDiaHint.textContent = fecha
    ? `Registros acumulados del ${fecha}. Cada cambio de cama, densidad o variedad aparece como un registro independiente.`
    : "Selecciona una fecha para ver los registros.";

  registrosTablaBody.innerHTML = registros.length
    ? registros.map((r, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${r.sembradorNombre || r.sembrador || "—"}</td>
          <td>${r.bloque || "—"}</td>
          <td>${r.cama || "—"}</td>
          <td>${r.densidad ?? "—"}</td>
          <td>${r.cantidad ?? "—"}</td>
          <td>${r.variedadNombre || r.variedad || "—"}</td>
        </tr>
      `).join("")
    : '<tr><td colspan="7">Todavía no hay registros para esta fecha.</td></tr>';
}

async function guardarRegistro() {
  const fecha = fechaInput.value;
  const bloque = bloqueInput.value.trim();
  const cama = camaInput.value.trim();
  const densidad = densidadInput.value.trim();
  const cantidad = cantidadInput.value.trim();

  if (!fecha) return marcarResultado("error", "Selecciona la fecha.");
  if (!sembradorSeleccionado) return marcarResultado("error", "Selecciona un sembrador.");
  if (!bloque) return marcarResultado("error", "Ingresa el bloque.");
  if (!cama) return marcarResultado("error", "Ingresa la cama.");
  if (!densidad) return marcarResultado("error", "Selecciona la densidad.");
  if (!cantidad) return marcarResultado("error", "Ingresa la cantidad.");
  if (!/^\d+$/.test(cantidad) || Number(cantidad) <= 0) {
    return marcarResultado("error", "La cantidad debe ser un número entero mayor que cero.");
  }
  if (!variedadSelect.value) return marcarResultado("error", "Selecciona una variedad.");

  const sembradorCodigo =
    sembradorSeleccionado.codigo ||
    sembradorSeleccionado.docid ||
    sembradorSeleccionado.id;
  const variedadNombre = variedadSelect.value;

  const registro = {
    id: SyncEngine.generarUUID(),
    fecha,
    bloque,
    cama,
    densidad: Number(densidad),
    cantidad: Number(cantidad),
    sembrador: String(sembradorCodigo),
    sembradorNombre:
      sembradorSeleccionado.nombre ||
      sembradorSeleccionado.empleadoNombre ||
      String(sembradorCodigo),
    variedad: variedadNombre,
    variedadNombre,
    usuario: sesionBandejas?.username || "",
    syncStatus: "PendienteBackend",
    createdAt: new Date().toISOString(),
  };

  await OfflineDb.put("bandejasEnraizamiento", registro);
  marcarResultado(
    "ok",
    `Registro agregado: ${registro.sembradorNombre} · Bloque ${registro.bloque} · Cama ${registro.cama} · Densidad ${registro.densidad} · ${registro.variedadNombre}.`
  );

  // Mantener trabajador, fecha, bloque, cama, densidad y variedad facilita registrar los escenarios
  // consecutivos; solo se limpia la cantidad para evitar repetirla por accidente.
  cantidadInput.value = "";
  cantidadInput.focus();
  await renderRegistros();
}

async function cargarCatalogos() {
  try {
    const local = await SyncEngine.obtenerCatalogosLocal();
    catalogos.empleados = (local.empleados || []).filter((x) => x.activo !== false && x.retirado !== 1 && x.retirado !== true);

    if (navigator.onLine) {
      try {
        await SyncEngine.sincronizarCatalogos();
        const actualizados = await SyncEngine.obtenerCatalogosLocal();
        catalogos.empleados = (actualizados.empleados || []).filter((x) => x.activo !== false && x.retirado !== 1 && x.retirado !== true);
        estadoPill.textContent = "Catálogos actualizados";
        estadoPill.classList.add("ok");
      } catch {
        estadoPill.textContent = "Datos locales";
        estadoPill.classList.add("warn");
      }
    }

    if (!catalogos.empleados.length) {
      marcarResultado("warning", "Conéctate una vez para descargar los sembradores.");
    }
  } catch {
    marcarResultado("error", "No fue posible cargar los catálogos del equipo.");
  }
}

guardarBtn.addEventListener("click", guardarRegistro);
guardarTiemposBtn.addEventListener("click", guardarTiempos);
limpiarTiemposBtn.addEventListener("click", () => {
  limpiarFormularioTiempos();
  marcarResultadoTiempos(null, "Ingresa los tiempos en minutos para calcular el tiempo real de labor.");
});

limpiarBtn.addEventListener("click", () => {
  limpiarLabor();
  marcarResultado(null, "Complete bloque, cama, densidad, cantidad y variedad para agregar el registro.");
});

fechaInput.addEventListener("change", renderRegistros);
window.addEventListener("online", cargarCatalogos);

(async function iniciarBandejas() {
  cargarVariedades();
  limpiarFormularioCompleto();
  limpiarFormularioTiempos();
  aplicarVistaBandejas("registro");
  await cargarCatalogos();
  await renderRegistros();
  await renderRegistrosTiempos();
})();
