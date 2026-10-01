// Calidad Siembra: evaluación offline-first con sincronización hacia la API oficial.
const sesionCalidad = JSON.parse(sessionStorage.getItem("labores_usuario") || "null");
if (!sesionCalidad) window.location.href = "./login.html";

const criteriosSiembraCampo = [
  { id: 1, nombre: "Cama Conforme" },
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

const criteriosCalidadGenericos = [
  { id: 1, nombre: "Siembra conforme" },
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

const esFormularioPreparacionCamas = window.location.pathname.endsWith("/calidad-preparacion-camas.html");
let criteriosCalidad = esFormularioPreparacionCamas ? [...criteriosSiembraCampo] : [...criteriosCalidadGenericos];
const CATALOGO_CALIDAD_VERSION = 2;
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
  lista.innerHTML = visibles.length ? visibles.map((item, i) => `<div class="pending-item" data-index="${i}" style="cursor:pointer;padding:8px 10px"><span>${nombreSembrador(item)}</span></div>`).join("") : '<p class="hint" style="margin:0">No hay sembradores disponibles en el catálogo local.</p>';
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
    estadoCalidad("error", `${$calidad("sembradorNombre").textContent} ya tiene las 30 revisiones de la semana. Selecciona otro sembrador.`);
    return;
  }
  estadoCalidad(null, "Selecciona los criterios que no cumplen y guarda la evaluación.");
}

function renderCriterios() {
  $calidad("criteriosLista").innerHTML = criteriosCalidad
    .map((item) => `<label class="calidad-criterio"><input type="checkbox" value="${item.id}" /><span class="calidad-criterio-check" aria-hidden="true"></span><span class="calidad-criterio-text">${item.nombre}</span></label>`)
    .join("");
}

function limpiarFormularioCalidad() {
  sembradorSeleccionado = null;
  siguienteRevisionCalidad = null;
  $calidad("sembradorBuscar").value = "";
  $calidad("sembradorLista").innerHTML = "";
  $calidad("sembradorNombre").textContent = "Sin sembrador seleccionado";
  $calidad("sembradorCodigo").textContent = "—";
  $calidad("sembradorRevision").textContent = "Selecciona un sembrador";
  $calidad("guardarCalidadBtn").disabled = false;
  document.querySelectorAll("#criteriosLista input").forEach((item) => { item.checked = false; });
}

async function cargarCatalogoCalidadLocal() {
  const catalogo = await SyncEngine.obtenerCatalogoCalidadLocal();
  if (!esFormularioPreparacionCamas && catalogo.items.length) {
    criteriosCalidad = catalogo.items.map((item) => ({ id: Number(item.id), nombre: item.nombre }));
  }
  renderCriterios();
  sembradores = catalogo.colaboradores.filter((x) => x.activo !== false && x.retirado !== 1 && x.retirado !== true);
  renderSembradores();
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
    if (!criteriosCalidad.length || !sembradores.length) estadoCalidad("error", "Conéctate una vez para descargar el catálogo de Calidad Siembra.");
  } finally {
    await actualizarPendientesCalidad();
  }
}

async function guardarCalidad() {
  if (guardandoCalidad) return;
  if (!sembradorSeleccionado) return estadoCalidad("error", "Selecciona un sembrador antes de guardar.");
  if (!semanaActual) return estadoCalidad("error", "No hay semana válida descargada desde la base de datos. Conéctate y vuelve a intentar.");
  if (!siguienteRevisionCalidad || siguienteRevisionCalidad > 30) return estadoCalidad("error", "Selecciona un sembrador con revisiones disponibles.");

  guardandoCalidad = true;
  $calidad("guardarCalidadBtn").disabled = true;
  try {
    const incumplimientos = [...document.querySelectorAll('#criteriosLista input:checked')].map((x) => Number(x.value));
    if (incumplimientos.length === 0) {
      const confirmar = await confirmarEvaluacionConforme();
      if (!confirmar) return;
    }
    const colaborador = sembradorSeleccionado.codigo || sembradorSeleccionado.docid || sembradorSeleccionado.id;
    const nombreColaborador = sembradorSeleccionado.nombre || sembradorSeleccionado.empleadoNombre || String(colaborador);
    const revisionGuardada = siguienteRevisionCalidad;
    const evaluacion = { fecha: fechaLocalCalidad(), semana: semanaActual.semana, asegurador: sesionCalidad.username || sesionCalidad.codigo || "", colaborador: String(colaborador), revision: revisionGuardada, incumplimientos };
    await SyncEngine.guardarEvaluacionCalidadLocal(evaluacion);

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
  await cargarSemanaActual();
  await checkApiCalidad();
})();
