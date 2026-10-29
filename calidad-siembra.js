// Calidad Siembra: evaluación offline-first con sincronización hacia la API oficial.
const sesionCalidad = JSON.parse(sessionStorage.getItem("labores_usuario") || "null");
if (!sesionCalidad) window.location.href = "./login.html";

const criteriosPreparacionCamas = [
  { id: 2, nombre: "Limpieza de Terreno" },
  { id: 3, nombre: "Distribución de Enmiendas" },
  { id: 4, nombre: "Nivelación del Suelo" },
  { id: 5, nombre: "(Estado, Distribución y Cantidad de Durmientes)" },
  { id: 6, nombre: "Profundidad de la Preparación" },
  { id: 7, nombre: "Riego" },
  { id: 8, nombre: "Aseo" },
  { id: 9, nombre: "Instalación de la Malla" },
  { id: 10, nombre: "Instalación de Mangueras de Goteo" },
];

// Agrupación visual exclusiva de Calidad Preparación de Camas.
// Se mantienen los IDs originales para conservar las evaluaciones y su sincronización.
const GRUPOS_PREPARACION_CAMAS = [
  { titulo: "Limpieza y nivelación del terreno", ids: [2, 4] },
  { titulo: "Enmiendas y durmientes", ids: [3, 5] },
  { titulo: "Profundidad de la preparación", ids: [6] },
  { titulo: "Riego", ids: [7] },
  { titulo: "Instalación de la malla", ids: [9] },
  { titulo: "Instalación de mangueras de goteo", ids: [10] },
  { titulo: "Aseo", ids: [8] },
];

const criteriosDesbotonPompon = [
  { id: 1, nombre: "Tallos con Botón Principal", nota: "tolerancia: 3 plantas con boton" },
  { id: 2, nombre: "Tallos con Tocón Largo", nota: "tocon 1 cm max" },
  { id: 3, nombre: "Daño Mecánico", nota: "tolerancia: tres tallos por sitio" },
  { id: 4, nombre: "Aseo de Labor" },
];

const criteriosDesbotonSpiderCremon = [
  { id: 1, nombre: "Plantas con Botón o Tocón" },
  { id: 2, nombre: "Plantas con Tocón Largo" },
  { id: 3, nombre: "Daño Mecánico" },
  { id: 4, nombre: "Desbotón a 15 cm de la Base" },
  { id: 5, nombre: "Aseo Caminos" },
];

const criteriosBandejasEnraizamiento = [
  { id: 2, nombre: "Estado de Esqueje" },
  { id: 3, nombre: "Ubicación del Esqueje" },
  { id: 4, nombre: "Esqueje Inclinado" },
  { id: 5, nombre: "Espacios Vacíos" },
  { id: 6, nombre: "Daño Mecánico" },
  { id: 7, nombre: "Hundimiento del Sustrato al momento de la Siembra" },
  { id: 8, nombre: "Marcación" },
];

const criteriosCalidadGenericos = [
  { id: 2, nombre: "Estado de la planta" },
  { id: 3, nombre: "Distribución" },
  { id: 4, nombre: "Densidad" },
  { id: 5, nombre: "Profundidad de la planta" },
  { id: 6, nombre: "Planta inclinada" },
  { id: 7, nombre: "Ubicación de mangueras" },
  { id: 8, nombre: "Selección de esqueje" },
  { id: 9, nombre: "Siembra con marcador" },
  { id: 10, nombre: "Aseo sitio de trabajo" },
  { id: 11, nombre: "Uso de EPP" },
  { id: 12, nombre: "Acuerdos de oro" },
  { id: 13, nombre: "Conteo de líneas" },
];

const criteriosMallas = [
  { id: 2, nombre: "Estado de la Malla" },
  { id: 3, nombre: "Posición de la Malla" },
  { id: 4, nombre: "Daño Mecánico" },
  { id: 5, nombre: "Enmallado Oportuno" },
  { id: 6, nombre: "Uso de las Herramientas" },
  { id: 7, nombre: "Estado de la Flor" },
];

const ITEMS_SELECCION_X_SIEMBRA = new Set([
  "ubicacion de mangueras",
  "siembra con marcador",
  "aseo sitio de trabajo",
  "uso de epp",
  "acuerdos de oro",
  "conteo de lineas",
]);

const ITEMS_SELECCION_X_BANDEJAS = new Set([
  "estado de esqueje",
  "espacios vacios",
  "hundimiento del sustrato al momento de la siembra",
  "marcacion",
]);

const ITEMS_SELECCION_X_MALLAS = new Set([
  "dano mecanico",
  "enmallado oportuno",
  "uso de las herramientas",
  "estado de la flor",
]);

const ITEMS_SELECCION_X_POMPON = new Set([
  "aseo de labor",
]);

const ITEMS_SELECCION_X_SPIDER = new Set([
  "desboton a 15 cm de la base",
  "aseo caminos",
]);

const ITEMS_SELECCION_X_PREPARACION = new Set([
  "limpieza de terreno",
  "distribucion de enmiendas",
  "nivelacion del suelo",
  "estado distribucion y cantidad de durmientes",
  "profundidad de la preparacion",
  "riego",
  "aseo",
  "instalacion de la malla",
  "instalacion de mangueras de goteo",
]);

const SUBITEMS_CALIDAD_PRODUCCION = {
  siembraCampo: {
    "estado de la planta": [
      "Botrytis severa",
      "Daño mecánico",
    ],
  },
  bandejas: {
    "dano mecanico": [
      "Esqueje partido",
      "Esqueje sin cogollo",
    ],
  },
  pompon: {
    "dano mecanico": [
      "Tallos partidos",
      "Exceso de desbotonado",
      "Tallos heridos en tocón",
    ],
  },
  spider: {
    "dano mecanico": [
      "Tallos partidos",
      "Desbotón de tallo principal",
      "Tallos heridos en tocón",
    ],
  },
  mallas: {
    "estado de la malla": [
      "Sucia",
      "Rota",
      "Mojada",
    ],
    "posicion de la malla": [
      "Muy arriba",
      "Muy abajo",
    ],
  },
};

function claveTextoCalidad(valor) {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function subitemsDelCriterioCalidad(item) {
  const grupo = esFormularioSiembraCampo
    ? SUBITEMS_CALIDAD_PRODUCCION.siembraCampo
    : esFormularioBandejasEnraizamiento
      ? SUBITEMS_CALIDAD_PRODUCCION.bandejas
      : esFormularioDesbotonMallasUnificado && vistaCalidadDesbotonMallas === "spider"
        ? SUBITEMS_CALIDAD_PRODUCCION.spider
        : esFormularioDesbotonMallasUnificado && vistaCalidadDesbotonMallas === "pompon"
          ? SUBITEMS_CALIDAD_PRODUCCION.pompon
          : esFormularioDesbotonMallasUnificado && vistaCalidadDesbotonMallas === "mallas"
            ? SUBITEMS_CALIDAD_PRODUCCION.mallas
            : null;
  return grupo?.[claveTextoCalidad(item.nombre)] || [];
}

function esItemConformeCalidad(item) {
  return claveTextoCalidad(item?.nombre).includes("conforme");
}

function usaSeleccionXSoloItem(item) {
  const clave = claveTextoCalidad(item?.nombre);
  return (esFormularioSiembraCampo && ITEMS_SELECCION_X_SIEMBRA.has(clave))
    || (esFormularioBandejasEnraizamiento && ITEMS_SELECCION_X_BANDEJAS.has(clave))
    || (esFormularioPreparacionCamas && ITEMS_SELECCION_X_PREPARACION.has(clave))
    || (esFormularioDesbotonMallasUnificado
      && vistaCalidadDesbotonMallas === "spider"
      && ITEMS_SELECCION_X_SPIDER.has(clave))
    || (esFormularioDesbotonMallasUnificado
      && vistaCalidadDesbotonMallas === "pompon"
      && ITEMS_SELECCION_X_POMPON.has(clave))
    || (esFormularioDesbotonMallasUnificado
      && vistaCalidadDesbotonMallas === "mallas"
      && ITEMS_SELECCION_X_MALLAS.has(clave));
}

function escaparHtmlCalidad(valor) {
  return String(valor ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function campoSeleccionXCalidad(item) {
  return `<label class="calidad-item-x-row">
    <span class="calidad-item-x-label">${escaparHtmlCalidad(item.nombre)}</span>
    <input
      class="calidad-item-x-input"
      type="checkbox"
      data-item-id="${escaparHtmlCalidad(String(item.id))}"
      data-item-nombre="${escaparHtmlCalidad(item.nombre)}"
      aria-label="Marcar incumplimiento: ${escaparHtmlCalidad(item.nombre)}"
    />
    <span class="calidad-item-x-box" aria-hidden="true">×</span>
  </label>`;
}

function notaCriterioCalidad(item) {
  return item.nota
    ? `<small class="calidad-item-nota">${escaparHtmlCalidad(item.nota)}</small>`
    : "";
}

function campoFallosCalidad(item, subitem = "", indice = 0) {
  const idItem = String(item.id);
  const nombre = escaparHtmlCalidad(item.nombre);
  const sub = escaparHtmlCalidad(subitem);
  const etiqueta = subitem || item.nombre;
  return `<label class="calidad-fallo-row">
    <span class="calidad-fallo-label">${escaparHtmlCalidad(etiqueta)}${subitem ? "" : notaCriterioCalidad(item)}</span>
    <input
      class="calidad-fallos-input"
      type="number"
      min="0"
      step="1"
      inputmode="numeric"
      value="0"
      aria-label="Fallos: ${escaparHtmlCalidad(etiqueta)}"
      data-item-id="${escaparHtmlCalidad(idItem)}"
      data-item-nombre="${nombre}"
      data-subitem="${sub}"
      data-subitem-indice="${indice}"
    />
  </label>`;
}

function obtenerFallosDetalleCalidad() {
  const numericos = [...document.querySelectorAll("#criteriosLista .calidad-fallos-input")]
    .map((input) => {
      const cantidad = Math.max(0, Math.floor(Number(input.value) || 0));
      const idNumerico = Number(input.dataset.itemId);
      return {
        idItem: Number.isFinite(idNumerico) ? idNumerico : null,
        item: input.dataset.itemNombre || "",
        subitem: input.dataset.subitem || "",
        cantidad,
      };
    })
    .filter((detalle) => detalle.cantidad > 0);

  const marcados = [...document.querySelectorAll("#criteriosLista .calidad-item-x-input:checked")]
    .map((input) => {
      const idNumerico = Number(input.dataset.itemId);
      return {
        idItem: Number.isFinite(idNumerico) ? idNumerico : null,
        item: input.dataset.itemNombre || "",
        subitem: "",
        cantidad: 1,
        marcadoX: true,
      };
    });

  return [...numericos, ...marcados];
}

const esFormularioSiembraCampo = window.location.pathname.endsWith("/calidad-siembra.html");
const esFormularioPreparacionCamas = window.location.pathname.endsWith("/calidad-preparacion-camas.html");
const esFormularioDesbotonPompon = window.location.pathname.endsWith("/calidad-desboton-pompon.html");
const esFormularioDesbotonSpiderCremon = window.location.pathname.endsWith("/calidad-desboton-spider-cremon.html");
const esFormularioBandejasEnraizamiento = window.location.pathname.endsWith("/calidad-bandejas-enraizamiento.html");
const esFormularioDesbotonMallasUnificado = window.location.pathname.endsWith("/calidad-menu.html");

const vistaSolicitada = esFormularioDesbotonMallasUnificado
  ? new URLSearchParams(window.location.search).get("vista")
  : null;
let vistaCalidadDesbotonMallas = ["spider", "pompon", "mallas"].includes(vistaSolicitada)
  ? vistaSolicitada
  : "spider";

function criteriosVistaDesbotonMallas(vista) {
  if (vista === "pompon") return [...criteriosDesbotonPompon];
  if (vista === "mallas") return [...criteriosMallas];
  return [...criteriosDesbotonSpiderCremon];
}

let criteriosCalidad = esFormularioDesbotonMallasUnificado
  ? criteriosVistaDesbotonMallas(vistaCalidadDesbotonMallas)
  : esFormularioPreparacionCamas
    ? [...criteriosPreparacionCamas]
    : esFormularioDesbotonPompon
      ? [...criteriosDesbotonPompon]
      : esFormularioDesbotonSpiderCremon
        ? [...criteriosDesbotonSpiderCremon]
        : esFormularioBandejasEnraizamiento
          ? [...criteriosBandejasEnraizamiento]
          : [...criteriosCalidadGenericos];
const $calidad = (id) => document.querySelector(`#${id}`);
const almacenamientoCalidad = "calidadSiembraEvaluacionesLocal";
let sembradores = [];
let sembradorSeleccionado = null;
let semanaActual = null;
let siguienteRevisionCalidad = null;
let guardandoCalidad = false;
let sincronizacionCalidadEnCurso = null;

function confirmarEvaluacionConforme() {
  const modal = $calidad("confirmacionConformeModal");
  const confirmarBtn = $calidad("confirmarConformeBtn");
  const cancelarBtn = $calidad("cancelarConformeBtn");
  modal.hidden = false;
  confirmarBtn.focus();

  return new Promise((resolve) => {
    const cerrar = (respuesta) => {
      modal.hidden = true;
      confirmarBtn.removeEventListener("click", confirmar);
      cancelarBtn.removeEventListener("click", cancelar);
      modal.removeEventListener("click", cancelarAlFondo);
      document.removeEventListener("keydown", cancelarConEscape);
      resolve(respuesta);
    };
    const confirmar = () => cerrar(true);
    const cancelar = () => cerrar(false);
    const cancelarAlFondo = (event) => {
      if (event.target === modal) cancelar();
    };
    const cancelarConEscape = (event) => {
      if (event.key === "Escape") cancelar();
    };
    confirmarBtn.addEventListener("click", confirmar);
    cancelarBtn.addEventListener("click", cancelar);
    modal.addEventListener("click", cancelarAlFondo);
    document.addEventListener("keydown", cancelarConEscape);
  });
}

function estadoCalidad(tipo, mensaje) {
  const panel = $calidad("calidadResultado");
  panel.classList.remove("ok", "warning", "error");
  if (tipo) panel.classList.add(tipo);
  $calidad("calidadMensaje").textContent = mensaje;
}

async function migrarEvaluacionesCalidadAnteriores() {
  const anteriores = JSON.parse(localStorage.getItem(almacenamientoCalidad) || "[]");
  if (!anteriores.length) return;
  for (const registro of anteriores) {
    if (!registro || registro.estado === "Sincronizado") continue;
    const existente = (await OfflineDb.getAll("calidadEvaluaciones")).find((e) =>
      e.fecha === registro.fecha && String(e.colaborador || e.sembrador) === String(registro.colaborador || registro.sembrador) && Number(e.revision) === Number(registro.revision) && Number(e.semana) === Number(registro.semana)
    );
    if (!existente) {
      await SyncEngine.guardarEvaluacionCalidadLocal({
        fecha: registro.fecha,
        semana: registro.semana,
        asegurador: registro.asegurador || registro.evaluador || sesionCalidad?.username || "",
        colaborador: String(registro.colaborador || registro.sembrador),
        revision: registro.revision,
        incumplimientos: registro.incumplimientos || [],
      });
    }
  }
  localStorage.removeItem(almacenamientoCalidad);
}

async function actualizarPendientesCalidad() {
  const pendientes = await SyncEngine.obtenerPendientesCalidad();
  const pill = $calidad("calidadPendientes");
  pill.hidden = pendientes.length === 0;
  pill.textContent = `${pendientes.length} pendiente(s)`;

  const detalle = $calidad("calidadPendientesDetalle");
  const lista = $calidad("calidadPendientesLista");
  detalle.hidden = pendientes.length === 0;
  lista.replaceChildren();
  if (!pendientes.length) return;

  const colaboradores = await OfflineDb.getAll("calidadColaboradores");
  const porCodigo = new Map(colaboradores.map((item) => [String(item.codigo || item.docid || item.id), item]));
  for (const evaluacion of pendientes) {
    const colaborador = porCodigo.get(String(evaluacion.colaborador));
    const tarjeta = document.createElement("article");
    tarjeta.className = "pending-item";
    const titulo = document.createElement("strong");
    titulo.textContent = colaborador?.nombre || colaborador?.empleadoNombre || `Colaborador ${evaluacion.colaborador}`;
    const datos = document.createElement("span");
    datos.textContent = `Semana ${evaluacion.semana || "—"} · Revisión ${evaluacion.revision || "por asignar"}`;
    const motivo = document.createElement("em");
    motivo.textContent = evaluacion.syncStatus === "Error"
      ? `Error: ${evaluacion.errorMensaje || "La API rechazó la evaluación."}`
      : "Pendiente: se enviará cuando haya conexión con la API.";
    tarjeta.append(titulo, datos, motivo);
    lista.append(tarjeta);
  }
}

async function ejecutarSincronizacionCalidad() {
  if (sincronizacionCalidadEnCurso) return sincronizacionCalidadEnCurso;
  const tarea = (async () => {
    try {
      return await SyncEngine.sincronizarPendientesCalidad();
    } finally {
      await cargarCatalogoCalidadLocal();
      await actualizarPendientesCalidad();
    }
  })();
  sincronizacionCalidadEnCurso = tarea;
  try {
    return await tarea;
  } finally {
    if (sincronizacionCalidadEnCurso === tarea) sincronizacionCalidadEnCurso = null;
  }
}

async function sincronizarCalidad() {
  const boton = $calidad("sincronizarCalidadBtn");
  boton.disabled = true;
  try {
    const resultado = await ejecutarSincronizacionCalidad();
    const pendientesSinRed = resultado.errores.filter((error) => error.reintentable).length;
    const rechazadas = resultado.fallidas - pendientesSinRed;
    estadoCalidad(resultado.fallidas ? "warning" : "ok", resultado.fallidas
      ? rechazadas
        ? `Sincronizado: ${resultado.subidas} evaluación(es) subida(s), ${rechazadas} con error de validación.`
        : `Sin conexión: ${pendientesSinRed} evaluación(es) pendiente(s) de sincronizar.`
      : resultado.subidas ? `Sincronizado: ${resultado.subidas} evaluación(es) subida(s) correctamente.` : "Todo estaba sincronizado.");
  } catch {
    estadoCalidad("error", "No fue posible sincronizar: sin conexión con el servidor.");
  } finally {
    boton.disabled = false;
    await actualizarPendientesCalidad();
  }
}

async function cargarSemanaActual() {
  const semanas = await OfflineDb.getAll("semanas");
  semanaActual = SyncEngine.semanaQueContiene(semanas, new Date());
  $calidad("semanaActual").textContent = semanaActual
    ? `Semana ${semanaActual.semana} de ${semanaActual.ano}`
    : "Sin calendario descargado";
  if (!semanaActual) estadoCalidad("warning", "No hay calendario de semanas en este equipo. Conéctate una vez para descargarlo.");
}

function nombreSembrador(item) { return `${item.nombre || item.empleadoNombre || item.codigo} (${item.codigo || item.docid || item.id})`; }

function fechaLocalCalidad() {
  const ahora = new Date();
  return new Date(ahora.getTime() - ahora.getTimezoneOffset() * 60000).toISOString().slice(0, 19);
}

function renderSembradores(filtro = "") {
  const texto = filtro.trim().toLowerCase();
  const visibles = sembradores.filter((x) => nombreSembrador(x).toLowerCase().includes(texto)).slice(0, 40);
  const lista = $calidad("sembradorLista");
  lista.innerHTML = visibles.length ? visibles.map((item, i) => `<div class="pending-item" data-index="${i}" style="cursor:pointer;padding:8px 10px"><span>${nombreSembrador(item)}</span></div>`).join("") : '<p class="hint" style="margin:0">No hay colaboradores disponibles en el catálogo local.</p>';
  lista.querySelectorAll("[data-index]").forEach((el) => el.addEventListener("mousedown", (event) => {
    event.preventDefault();
    seleccionarSembrador(visibles[Number(el.dataset.index)]);
  }));
}

async function seleccionarSembrador(item) {
  sembradorSeleccionado = item;
  $calidad("sembradorBuscar").value = "";
  $calidad("sembradorLista").innerHTML = "";
  $calidad("sembradorNombre").textContent = item.nombre || item.empleadoNombre || "Sin nombre";
  $calidad("sembradorCodigo").textContent = item.codigo || item.docid || item.id || "—";
  const codigo = item.codigo || item.docid || item.id;
  // Igual que Asegurar Corte: mostrar el dato que ya está en IndexedDB sin esperar
  // la red. Así al trabajar sin conexión (o con señal lenta) la revisión aparece
  // apenas se selecciona el colaborador.
  const mayorRevisionLocal = await SyncEngine.obtenerMayorRevisionCalidadLocal(codigo, semanaActual?.semana || 0);
  const revisionDescargada = Number(item.semanaRevision) === Number(semanaActual?.semana)
    ? Number(item.revision) || 0
    : 0;
  siguienteRevisionCalidad = Math.max(revisionDescargada, mayorRevisionLocal) + 1;
  mostrarRevisionCalidad();

  // Con señal, validar en segundo plano contra el servidor. Nunca baja el número
  // local porque puede haber evaluaciones de este equipo aún pendientes de subir.
  try {
    const response = await fetch(`${API_BASE_URL}/api/calidad/siguiente-revision?colaborador=${encodeURIComponent(codigo)}&semana=${encodeURIComponent(semanaActual?.semana || 0)}`, { cache: "no-store" });
    if (!response.ok) throw new Error();
    const siguienteServidor = Number((await response.json()).siguiente);
    if (sembradorSeleccionado !== item) return;
    if (Number.isInteger(siguienteServidor) && siguienteServidor > siguienteRevisionCalidad) siguienteRevisionCalidad = siguienteServidor;
    mostrarRevisionCalidad();
  } catch {}
}

function mostrarRevisionCalidad() {
  $calidad("sembradorRevision").textContent = siguienteRevisionCalidad > 30 ? "Completa (30/30)" : String(siguienteRevisionCalidad);
  $calidad("guardarCalidadBtn").disabled = siguienteRevisionCalidad > 30;
  if (siguienteRevisionCalidad > 30) {
    estadoCalidad("error", `${$calidad("sembradorNombre").textContent} ya tiene las 30 revisiones de la semana. Selecciona otro colaborador.`);
    return;
  }
  estadoCalidad(null, "Registra la cantidad de fallos encontrados y guarda la evaluación.");
}

function configurarConformeCalidad() {
  const conforme = document.querySelector("#criteriosLista .calidad-conforme-input");
  if (!conforme) return;

  const aplicar = () => {
    const activo = conforme.checked;
    document.querySelectorAll("#criteriosLista .calidad-fallos-input").forEach((input) => {
      if (activo) input.value = "0";
      input.disabled = activo;
    });
    document.querySelectorAll("#criteriosLista .calidad-item-x-input").forEach((input) => {
      if (activo) input.checked = false;
      input.disabled = activo;
    });
    document.querySelectorAll("#criteriosLista .calidad-item-fallos:not(.calidad-item-conforme)").forEach((item) => {
      item.classList.toggle("calidad-item-deshabilitado", activo);
    });
  };

  conforme.addEventListener("change", aplicar);
  aplicar();
}

function renderCriterios() {
  const lista = $calidad("criteriosLista");
  if (esFormularioDesbotonMallasUnificado && vistaCalidadDesbotonMallas === "mallas" && criteriosCalidad.length === 0) {
    lista.classList.add("calidad-criterios-numericos");
    lista.innerHTML = '<p class="hint" style="margin:0;">Los criterios de calidad de Mallas están pendientes de configurar.</p>';
    return;
  }

  lista.classList.add("calidad-criterios-numericos");
  // Conteo de líneas (ítem 13) se califica únicamente al cerrar la cama.
  // No permitir que una X manual duplique el conteo del seguimiento.
  const tarjetas = criteriosCalidad
    .filter(item=>!(esFormularioSiembraCampo&&Number(item.id)===13))
    .map((item) => {
    if (esItemConformeCalidad(item)) {
      return `<section class="calidad-item-fallos calidad-item-conforme">
        <label class="calidad-conforme-selector">
          <input class="calidad-conforme-input" type="checkbox" aria-label="${escaparHtmlCalidad(item.nombre)}" />
          <span class="calidad-conforme-circulo" aria-hidden="true"></span>
          <span class="calidad-conforme-texto">${escaparHtmlCalidad(item.nombre)}</span>
        </label>
      </section>`;
    }

    if (usaSeleccionXSoloItem(item)) {
      return `<section class="calidad-item-fallos calidad-item-x">
        ${campoSeleccionXCalidad(item)}
      </section>`;
    }

    const subitems = subitemsDelCriterioCalidad(item);
    if (subitems.length > 1) {
      return `<section class="calidad-item-fallos">
        <div class="calidad-item-fallos-titulo">${escaparHtmlCalidad(item.nombre)}${notaCriterioCalidad(item)}</div>
        <div class="calidad-subitems-fallos">
          ${subitems.map((subitem, indice) => campoFallosCalidad(item, subitem, indice)).join("")}
        </div>
      </section>`;
    }

    return `<section class="calidad-item-fallos calidad-item-fallos-simple">
      ${campoFallosCalidad(item)}
    </section>`;
  });

  if (esFormularioPreparacionCamas) {
    // Solo cambia la presentación: los mismos checkboxes y data-item-id
    // continúan siendo usados por obtenerFallosDetalleCalidad y guardarCalidad.
    const tarjetasPorId = new Map(criteriosCalidad.map((item, indice) =>
      [Number(item.id), tarjetas[indice]]));
    const agrupados = new Set();
    const grupos = GRUPOS_PREPARACION_CAMAS.map((grupo, indice) => {
      const ids = grupo.ids.filter(id => tarjetasPorId.has(id));
      ids.forEach(id => agrupados.add(id));
      return `<section class="calidad-preparacion-grupo" data-grupo="${indice}" data-cantidad="${ids.length}"
        aria-labelledby="calidad-preparacion-titulo-${indice + 1}">
        <div class="calidad-preparacion-encabezado">
          <span class="calidad-preparacion-numero" aria-hidden="true">${indice + 1}</span>
          <h3 class="calidad-preparacion-titulo" id="calidad-preparacion-titulo-${indice + 1}">
            ${escaparHtmlCalidad(grupo.titulo)}
          </h3>
        </div>
        <div class="calidad-preparacion-items">
          ${ids.map(id => tarjetasPorId.get(id)).join("")}
        </div>
        ${window.PreparacionCamasGrupos?.htmlGrupo(indice) || ""}
      </section>`;
    });
    // Si se agrega un criterio nuevo en el futuro, no desaparece por
    // carecer de grupo: se muestra en una sección adicional.
    const sinGrupo = criteriosCalidad
      .filter(item => !agrupados.has(Number(item.id)))
      .map(item => tarjetasPorId.get(Number(item.id)));
    if (sinGrupo.length) {
      grupos.push(`<section class="calidad-preparacion-grupo" data-cantidad="${sinGrupo.length}">
        <div class="calidad-preparacion-encabezado">
          <h3 class="calidad-preparacion-titulo">Otros criterios</h3>
        </div>
        <div class="calidad-preparacion-items">${sinGrupo.join("")}</div>
      </section>`);
    }
    const preparadoConforme = `<section class="calidad-item-fallos calidad-item-x pc-preparacion-conforme">
      <label class="calidad-item-x-row">
        <span class="calidad-item-x-label">Preparación conforme</span>
        <input class="calidad-item-x-input" type="checkbox" data-pc-conforme
          aria-label="Marcar preparación conforme para todos los colaboradores" />
        <span class="calidad-item-x-box" aria-hidden="true">×</span>
      </label>
      <p class="pc-explicacion" data-pc-conforme-alcance>Si la marcas, todos los criterios de cada colaborador de los seis grupos y Aseo quedarán conformes.</p>
    </section>`;
    lista.innerHTML = preparadoConforme + grupos.join("");
  } else {
    lista.innerHTML = tarjetas.join("");
  }
  configurarConformeCalidad();
  if (esFormularioPreparacionCamas) window.PreparacionCamasGrupos?.actualizarAseoSeleccion();
}

function limpiarFormularioCalidad() {
  sembradorSeleccionado = null;
  if (esFormularioSiembraCampo || esFormularioDesbotonMallasUnificado) {
    const bloque = $calidad("calidadSiembraBloque");
    const cama = $calidad("calidadSiembraCama");
    if (bloque) bloque.value = "";
    if (cama) cama.value = "";
  }
  const observaciones = $calidad("calidadObservaciones");
  if (observaciones) observaciones.value = "";
  siguienteRevisionCalidad = null;
  $calidad("sembradorBuscar").value = "";
  $calidad("sembradorLista").innerHTML = "";
  $calidad("sembradorNombre").textContent = "Sin colaborador seleccionado";
  $calidad("sembradorCodigo").textContent = "—";
  $calidad("sembradorRevision").textContent = "Selecciona un colaborador";
  $calidad("guardarCalidadBtn").disabled =
    esFormularioDesbotonMallasUnificado &&
    vistaCalidadDesbotonMallas === "mallas" &&
    criteriosCalidad.length === 0;
  const conforme = document.querySelector("#criteriosLista .calidad-conforme-input");
  if (conforme) conforme.checked = false;
  document.querySelectorAll("#criteriosLista .calidad-fallos-input").forEach((item) => {
    item.value = "0";
    item.disabled = false;
  });
  document.querySelectorAll("#criteriosLista .calidad-item-x-input").forEach((item) => {
    item.checked = false;
    item.disabled = false;
  });
  document.querySelectorAll("#criteriosLista .calidad-item-fallos").forEach((item) => {
    item.classList.remove("calidad-item-deshabilitado");
  });
}

function aplicarVistaDesbotonMallas(vista) {
  if (!esFormularioDesbotonMallasUnificado) return;
  vistaCalidadDesbotonMallas = ["spider", "pompon", "mallas"].includes(vista) ? vista : "spider";
  criteriosCalidad = criteriosVistaDesbotonMallas(vistaCalidadDesbotonMallas);

  const nombres = {
    spider: "Spider/Cremon",
    pompon: "Pompón",
    mallas: "Mallas",
  };
  const titulo = $calidad("vistaCalidadTitulo");
  if (titulo) titulo.textContent = `✅ Calidad Desbotón y Mallas - ${nombres[vistaCalidadDesbotonMallas]}`;

  document.querySelectorAll("[data-calidad-vista]").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.calidadVista === vistaCalidadDesbotonMallas);
  });

  const url = new URL(window.location.href);
  url.searchParams.set("vista", vistaCalidadDesbotonMallas);
  window.history.replaceState({}, "", url);

  limpiarFormularioCalidad();
  renderCriterios();

  $calidad("guardarCalidadBtn").disabled = false;
  estadoCalidad(
    null,
    vistaCalidadDesbotonMallas === "mallas"
      ? "Selecciona un colaborador y registra la cantidad de fallos encontrados en Mallas."
      : "Selecciona un colaborador para iniciar una evaluación."
  );
}

if (esFormularioDesbotonMallasUnificado) {
  document.querySelectorAll("[data-calidad-vista]").forEach((btn) => {
    btn.addEventListener("click", () => aplicarVistaDesbotonMallas(btn.dataset.calidadVista));
  });
}

async function cargarCatalogoCalidadLocal() {
  const catalogo = await SyncEngine.obtenerCatalogoCalidadLocal();
  if (!esFormularioSiembraCampo && !esFormularioPreparacionCamas && !esFormularioDesbotonPompon && !esFormularioDesbotonSpiderCremon && !esFormularioBandejasEnraizamiento && !esFormularioDesbotonMallasUnificado && catalogo.items.length) {
    criteriosCalidad = catalogo.items.map((item) => ({ id: Number(item.id), nombre: item.nombre }));
  }
  renderCriterios();
  sembradores = catalogo.colaboradores.filter((x) => x.activo !== false && x.retirado !== 1 && x.retirado !== true);
  if (esFormularioPreparacionCamas) window.PreparacionCamasGrupos?.setCatalogo(sembradores);
  renderSembradores();
  if (esFormularioSiembraCampo || esFormularioDesbotonMallasUnificado) {
    // Sugerencias del maestro de camas; los campos siguen disponibles sin conexión.
    try {
      const camas = await OfflineDb.getAll("camas");
      const listaBloques = $calidad("calidadSiembraBloques");
      if (listaBloques) listaBloques.replaceChildren(
        ...[...new Set(camas.map(c=>String(c.bloque||"").trim()).filter(Boolean))]
          .sort((a,b)=>a.localeCompare(b,"es",{numeric:true}))
          .map(v=>new Option("",v))
      );
      const inputBloque = $calidad("calidadSiembraBloque");
      const inputCama = $calidad("calidadSiembraCama");
      if (inputBloque && inputCama) {
        const actualizarCamas = () => {
          const listaCamas = $calidad("calidadSiembraCamas");
          if (listaCamas) listaCamas.replaceChildren(
            ...[...new Set(camas.filter(c=>String(c.bloque||"").trim()===inputBloque.value.trim())
              .map(c=>String(c.cama||"").trim()).filter(Boolean))]
              .sort((a,b)=>a.localeCompare(b,"es",{numeric:true}))
              .map(v=>new Option("",v))
          );
        };
        inputBloque.addEventListener("input", actualizarCamas);
        actualizarCamas();
      }
    } catch (e) { console.warn("No fue posible cargar sugerencias de camas.",e); }
  }
}

async function checkApiCalidad() {
  try {
    await SyncEngine.apiGetOnline("/api/calidad/items");
    $calidad("calidadEstado").textContent = "En línea";
    $calidad("calidadEstado").classList.remove("warn");
    $calidad("calidadEstado").classList.add("ok");
    await SyncEngine.sincronizarCatalogoCalidad();
    await cargarCatalogoCalidadLocal();
    await sincronizarCalidad();
  } catch {
    $calidad("calidadEstado").textContent = "Sin conexión";
    $calidad("calidadEstado").classList.remove("ok");
    $calidad("calidadEstado").classList.add("warn");
    await cargarCatalogoCalidadLocal();
    if (!criteriosCalidad.length || !sembradores.length) estadoCalidad("error", "Conéctate una vez para descargar el catálogo de Calidad.");
  } finally {
    await actualizarPendientesCalidad();
  }
}


async function guardarCalidadPreparacionGrupos() {
  if (guardandoCalidad) return;
  const control = window.PreparacionCamasGrupos;
  if (!control) return estadoCalidad("error", "No se pudo iniciar la selección de grupos.");
  if (control.aseoPendienteSeleccion()) {
    return estadoCalidad("warning",
      "Marcaste el ítem Aseo. Selecciona al menos una persona que incumplió o desmarca Aseo si todos están conformes.");
  }
  const personas = control.obtenerEvaluaciones();
  if (!personas.length) return estadoCalidad("warning", "Agrega colaboradores a los grupos antes de evaluar.");
  const reales = personas.filter(p => !p.prueba);
  const pruebas = personas.filter(p => p.prueba);
  if (reales.length && !semanaActual) {
    return estadoCalidad("error", "Para guardar colaboradores reales necesitas el calendario semanal descargado.");
  }
  const porCodigo = new Map(sembradores.map(item => [String(item.codigo ?? item.docid ?? item.id), item]));
  const planes = [];
  try {
    // Validar todas las revisiones reales antes de escribir cualquier evaluación.
    for (const persona of reales) {
      const catalogo = porCodigo.get(persona.codigo);
      if (!catalogo) throw new Error("El colaborador " + persona.nombre + " ya no está en el catálogo activo.");
      const revisionActual = Number(catalogo.semanaRevision) === Number(semanaActual.semana)
        ? Number(catalogo.revision) || 0 : 0;
      const mayorLocal = await SyncEngine.obtenerMayorRevisionCalidadLocal(persona.codigo, semanaActual.semana);
      const siguiente = Math.max(revisionActual,mayorLocal) + 1;
      if (siguiente > 30) throw new Error(persona.nombre + " ya alcanzó el máximo de 30 revisiones semanales.");
      planes.push({persona,revision:siguiente});
    }
    if (!personas.some(p => p.incumplimientos.length) && !control.estaPreparacionConforme()) {
      const confirmado = await confirmarEvaluacionConforme();
      if (!confirmado) return;
    }
    if (reales.length && !window.confirm(
      "Se guardarán " + reales.length + " evaluaciones REALES (una por persona) y " +
      pruebas.length + " evaluaciones de PRUEBA solo en este navegador. ¿Continuar?"
    )) return;
    guardandoCalidad = true;
    $calidad("guardarCalidadBtn").disabled = true;
    const fecha = fechaLocalCalidad();
    const observaciones = $calidad("calidadObservaciones")?.value.trim() || "";
    let guardados = 0;
    for (const {persona,revision} of planes) {
      await SyncEngine.guardarEvaluacionCalidadLocal({
        fecha,
        semana: semanaActual.semana,
        asegurador: sesionCalidad.username || sesionCalidad.codigo || "",
        colaborador: persona.codigo,
        revision,
        incumplimientos: persona.incumplimientos,
        fallosDetalle: persona.fallosDetalle,
        gruposPreparacion: persona.grupos,
        evaluacionesGrupo: persona.evaluacionesGrupo,
        preparacionConforme: Boolean(persona.preparacionConforme),
        observaciones,
        conformeSeleccionado: Boolean(persona.preparacionConforme) || persona.incumplimientos.length === 0
      });
      guardados++;
    }
    control.guardarPruebas(pruebas,fecha);
    document.querySelectorAll("#criteriosLista .calidad-item-x-input:checked")
      .forEach(input => { input.checked = false; });
    control.limpiarSeleccionAseo();
    if ($calidad("calidadObservaciones")) $calidad("calidadObservaciones").value = "";
    estadoCalidad("ok",guardados + " evaluación(es) reales guardadas localmente y " +
      pruebas.length + " de prueba registradas solo en este navegador. " +
      (guardados ? "Las reales quedan pendientes de sincronizar." : "Los datos de prueba nunca se envían al servidor."));
    if (guardados) {
      await actualizarPendientesCalidad();
      void ejecutarSincronizacionCalidad().catch(() => {});
    }
  } catch (error) {
    estadoCalidad("error","No se completó el registro por grupos: " + error.message +
      ". Revisa las evaluaciones pendientes antes de reintentar.");
  } finally {
    guardandoCalidad = false;
    $calidad("guardarCalidadBtn").disabled = false;
  }
}

async function guardarCalidad() {
  if (esFormularioPreparacionCamas) return guardarCalidadPreparacionGrupos();
  if (guardandoCalidad) return;
  if (esFormularioDesbotonMallasUnificado && vistaCalidadDesbotonMallas === "mallas" && criteriosCalidad.length === 0) {
    return estadoCalidad("warning", "Los criterios de calidad de Mallas aún no están configurados.");
  }
  if (!sembradorSeleccionado) return estadoCalidad("error", "Selecciona un colaborador antes de guardar.");
  if (!semanaActual) return estadoCalidad("error", "No hay semana válida descargada desde la base de datos. Conéctate y vuelve a intentar.");
  if (!siguienteRevisionCalidad || siguienteRevisionCalidad > 30) return estadoCalidad("error", "Selecciona un colaborador con revisiones disponibles.");
  const requiereUbicacion = esFormularioSiembraCampo || esFormularioDesbotonMallasUnificado;
  const bloqueCalidad = requiereUbicacion ? ($calidad("calidadSiembraBloque")?.value.trim() || "") : "";
  const camaCalidad = requiereUbicacion ? ($calidad("calidadSiembraCama")?.value.trim() || "") : "";
  if (requiereUbicacion && (!bloqueCalidad || !camaCalidad))
    return estadoCalidad("error", "Selecciona Bloque y Cama antes de guardar la evaluación.");

  guardandoCalidad = true;
  $calidad("guardarCalidadBtn").disabled = true;
  try {
    const conformeSeleccionado = Boolean(document.querySelector("#criteriosLista .calidad-conforme-input:checked"));
    const fallosDetalle = obtenerFallosDetalleCalidad();
    const incumplimientos = [...new Set(
      fallosDetalle
        .map((detalle) => detalle.idItem)
        .filter((idItem) => Number.isFinite(idItem))
    )];
    if (!conformeSeleccionado && fallosDetalle.length === 0) {
      const confirmar = await confirmarEvaluacionConforme();
      if (!confirmar) return;
    }
    const colaborador = sembradorSeleccionado.codigo || sembradorSeleccionado.docid || sembradorSeleccionado.id;
    const nombreColaborador = sembradorSeleccionado.nombre || sembradorSeleccionado.empleadoNombre || String(colaborador);
    const revisionGuardada = siguienteRevisionCalidad;
    const evaluacion = {
      fecha: fechaLocalCalidad(),
      semana: semanaActual.semana,
      asegurador: sesionCalidad.username || sesionCalidad.codigo || "",
      colaborador: String(colaborador),
      revision: revisionGuardada,
      ...(requiereUbicacion ? { bloque:bloqueCalidad, cama:camaCalidad } : {}),
      ...(esFormularioSiembraCampo
        ? { moduloCalidad:"siembra-campo" }
        : esFormularioDesbotonMallasUnificado
          ? { moduloCalidad:"desboton-mallas", tipoLaborCalidad:vistaCalidadDesbotonMallas }
          : {}),
      incumplimientos,
      fallosDetalle,
      conformeSeleccionado,
      observaciones: $calidad("calidadObservaciones")?.value.trim() || ""
    };
    await SyncEngine.guardarEvaluacionCalidadLocal(evaluacion);
    if(esFormularioSiembraCampo) {
      void window.CalidadSiembraDensidad?.actualizarSiAbierto().catch(error=>
        console.warn("No se pudo refrescar el seguimiento",error));
    }

    // El registro ya existe en IndexedDB: la persona puede continuar de inmediato.
    estadoCalidad("ok", `Revisión #${revisionGuardada} de ${nombreColaborador} guardada localmente. Sincronizando en segundo plano.`);
    await actualizarPendientesCalidad();
    limpiarFormularioCalidad();
    void ejecutarSincronizacionCalidad().catch(() => {});
  } finally {
    guardandoCalidad = false;
    if (sembradorSeleccionado) mostrarRevisionCalidad();
    else $calidad("guardarCalidadBtn").disabled = false;
  }
}

$calidad("calidadUsuario").textContent = sesionCalidad?.empleadoNombre || sesionCalidad?.username || "Usuario";
$calidad("evaluadorNombre").textContent = sesionCalidad?.empleadoNombre || sesionCalidad?.username || "Usuario actual";
$calidad("sembradorBuscar").addEventListener("focus", () => renderSembradores($calidad("sembradorBuscar").value));
$calidad("sembradorBuscar").addEventListener("input", (e) => renderSembradores(e.target.value));
document.addEventListener("click", (event) => {
  const buscador = $calidad("sembradorBuscar");
  const lista = $calidad("sembradorLista");
  if (event.target !== buscador && !lista.contains(event.target)) {
    lista.innerHTML = "";
  }
});
$calidad("guardarCalidadBtn").addEventListener("click", guardarCalidad);
$calidad("sincronizarCalidadBtn").addEventListener("click", sincronizarCalidad);
renderCriterios();
if (esFormularioPreparacionCamas) window.PreparacionCamasGrupos?.configurarEventos();
window.addEventListener("online", () => {
  $calidad("calidadEstado").textContent = "En línea";
  $calidad("calidadEstado").classList.remove("warn");
  $calidad("calidadEstado").classList.add("ok");
  checkApiCalidad();
});
window.addEventListener("offline", () => {
  $calidad("calidadEstado").textContent = "Sin conexión";
  $calidad("calidadEstado").classList.remove("ok");
  $calidad("calidadEstado").classList.add("warn");
});
(async function iniciarCalidad() {
  await migrarEvaluacionesCalidadAnteriores();
  await cargarCatalogoCalidadLocal();
  if (esFormularioDesbotonMallasUnificado) aplicarVistaDesbotonMallas(vistaCalidadDesbotonMallas);
  await cargarSemanaActual();
  await checkApiCalidad();
  if (esFormularioDesbotonMallasUnificado && vistaCalidadDesbotonMallas === "mallas") {
    aplicarVistaDesbotonMallas("mallas");
  }
})();
