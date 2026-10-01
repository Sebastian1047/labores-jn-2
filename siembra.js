// Registro / Edición de Siembra Campo — mismas reglas que RegistroSiembraViewModel /
// EditRegistroViewModel de AppLabores: guarda siempre local primero (offline-first),
// nunca llama directo al API. La sincronización real ocurre desde el Hub.

const sesion = JSON.parse(sessionStorage.getItem("labores_usuario") || "null");
if (!sesion) {
  window.location.href = "./login.html";
}

const apiStatusPill = document.querySelector("#apiStatusPill");
const usuarioPill = document.querySelector("#usuarioPill");
const formTitulo = document.querySelector("#formTitulo");
const modoEtiqueta = document.querySelector("#modoEtiqueta");
const nuevoBtn = document.querySelector("#nuevoBtn");

const fechaInput = document.querySelector("#fecha");
const lineasInput = document.querySelector("#lineas");
const densidadInput = document.querySelector("#densidad");
const origenSelect = document.querySelector("#origen");
const semanaInput = document.querySelector("#semanaProgramada");
const anoInput = document.querySelector("#anoProgramado");
const revisoWrap = document.querySelector("#revisoWrap");
const revisoInput = document.querySelector("#reviso");

const guardarBtn = document.querySelector("#guardarBtn");
const resultState = document.querySelector("#resultState");
const resultStatus = document.querySelector("#resultStatus");

usuarioPill.textContent = sesion ? sesion.empleadoNombre || sesion.username : "Usuario";

let editandoId = null;
let usuarioRegistroLogin = null;
let variedadSeleccionadaCodigo = null;
let clonSeleccionadoCodigo = null;
let empleadoSeleccionadoCodigo = null;
let bloqueSeleccionadoCodigo = null;
let camaSeleccionadaCodigo = null;

// ---------------------------------------------------------------------------
// Listas filtrables (Variedad / Clon / Empleado) — reemplazan los <select> planos
// para igualar el buscador + lista de Android (SearchBar + ListView).
// ---------------------------------------------------------------------------

// Usa mousedown (no click) con preventDefault: dispara ANTES de que el input pierda el foco,
// evitando la carrera click-vs-blur que hacía que la selección se perdiera intermitentemente.
// maxItems: la lista tiene scroll propio (max-height en el HTML), asi que el tope solo evita pintar
// cientos de filas de golpe. Con 40 fijo, un bloque de 145-265 camas mostraba solo las primeras 40
// y parecia que "faltaban camas" (reportado 21/09/2026) -- las camas suben el tope a 400 (el bloque
// mas grande tiene 265); el resto (variedad/empleado) sigue en 40 con aviso y buscador.
function crearListaFiltrable({ inputEl, listaEl, etiquetaEl, obtenerItems, getLabel, getValue, onSeleccionar, placeholderVacio, mensajeVacio, maxItems = 40 }) {
  function render(filtro) {
    const texto = (filtro || "").trim().toLowerCase();
    const items = obtenerItems().filter((it) => !texto || getLabel(it).toLowerCase().includes(texto));
    if (items.length === 0) {
      listaEl.innerHTML = `<p class="hint" style="margin:0;">${mensajeVacio || "Sin resultados."}</p>`;
      return;
    }
    const visibles = items.slice(0, maxItems);
    const aviso = items.length > visibles.length
      ? `<p class="hint" style="margin:6px 10px;">Mostrando ${visibles.length} de ${items.length} -- escriba para filtrar.</p>`
      : "";
    listaEl.innerHTML = visibles
      .map((it, idx) => `<div class="pending-item" style="cursor:pointer; padding:8px 10px;" data-idx="${idx}"><span style="margin:0;">${getLabel(it)}</span></div>`)
      .join("") + aviso;
    listaEl.querySelectorAll(".pending-item").forEach((el) => {
      el.addEventListener("mousedown", (ev) => {
        ev.preventDefault();
        const item = visibles[Number(el.dataset.idx)];
        etiquetaEl.textContent = getLabel(item);
        listaEl.innerHTML = "";
        inputEl.value = "";
        onSeleccionar(item);
      });
    });
  }

  inputEl.addEventListener("focus", () => render(inputEl.value));
  inputEl.addEventListener("input", () => render(inputEl.value));
  document.addEventListener("click", (ev) => {
    if (ev.target !== inputEl && !listaEl.contains(ev.target)) {
      listaEl.innerHTML = "";
    }
  });

  if (placeholderVacio) etiquetaEl.textContent = placeholderVacio;
  return { render: () => render(inputEl.value) };
}

let catalogos = { variedades: [], clones: [], origenes: [], empleados: [], causas: [], camas: [] };

// Bloques reales (distintos, del maestro legacy.camas precargado offline) -- reemplaza el
// texto libre que dejaba escribir cualquier cosa, incluida una cama que no existe.
function bloquesDisponibles() {
  const vistos = new Set();
  const lista = [];
  for (const c of catalogos.camas) {
    if (!vistos.has(c.bloque)) {
      vistos.add(c.bloque);
      lista.push({ bloque: c.bloque });
    }
  }
  return lista.sort((a, b) => a.bloque.localeCompare(b.bloque, "es", { numeric: true }));
}

crearListaFiltrable({
  inputEl: document.querySelector("#bloqueBuscar"),
  listaEl: document.querySelector("#bloqueLista"),
  etiquetaEl: document.querySelector("#bloqueSeleccionado"),
  obtenerItems: bloquesDisponibles,
  getLabel: (b) => `Bloque ${b.bloque}`,
  getValue: (b) => b.bloque,
  placeholderVacio: "Sin bloque seleccionado",
  mensajeVacio: "No hay bloques cargados -- sincroniza con red antes de salir a campo.",
  onSeleccionar: (b) => {
    bloqueSeleccionadoCodigo = b.bloque;
    camaSeleccionadaCodigo = null;
    document.querySelector("#camaSeleccionada").textContent = "Sin cama seleccionada";
  },
});

crearListaFiltrable({
  inputEl: document.querySelector("#camaBuscar"),
  listaEl: document.querySelector("#camaLista"),
  etiquetaEl: document.querySelector("#camaSeleccionada"),
  obtenerItems: () => catalogos.camas.filter((c) => c.bloque === bloqueSeleccionadoCodigo),
  getLabel: (c) => `Cama ${c.cama}${c.nave ? ` (nave ${c.nave})` : ""}${c.ocupada ? " · OCUPADA" : ""}`,
  getValue: (c) => c.cama,
  placeholderVacio: "Sin cama seleccionada",
  mensajeVacio: "Selecciona primero un Bloque.",
  maxItems: 400,
  onSeleccionar: (c) => {
    camaSeleccionadaCodigo = c.cama;
  },
});

crearListaFiltrable({
  inputEl: document.querySelector("#variedadBuscar"),
  listaEl: document.querySelector("#variedadLista"),
  etiquetaEl: document.querySelector("#variedadSeleccionada"),
  obtenerItems: () => catalogos.variedades,
  getLabel: (v) => v.nombre,
  getValue: (v) => v.codigo,
  placeholderVacio: "Sin variedad seleccionada",
  onSeleccionar: (v) => {
    variedadSeleccionadaCodigo = v.codigo;
    clonSeleccionadoCodigo = null;
    document.querySelector("#clonSeleccionado").textContent = "(ninguno)";
  },
});

crearListaFiltrable({
  inputEl: document.querySelector("#clonBuscar"),
  listaEl: document.querySelector("#clonLista"),
  etiquetaEl: document.querySelector("#clonSeleccionado"),
  obtenerItems: () => catalogos.clones.filter((c) => c.variedad === variedadSeleccionadaCodigo),
  getLabel: (c) => c.nombre,
  getValue: (c) => c.codigo,
  placeholderVacio: "(ninguno)",
  mensajeVacio: "Selecciona primero una variedad, o no hay clones para ella.",
  onSeleccionar: (c) => {
    clonSeleccionadoCodigo = c.codigo;
  },
});

// Un solo combo de personal (app.personal, cedula real) -- reemplaza a los dos combos viejos
// (uno de UsuariosApp + Empleado desde dbo.Empleado, ese ultimo era data de JN).
// IMPORTANTE (corregido 09/09/2026): el Empleado seleccionado aqui ES el sembrador -- la
// persona que sembro de verdad. El campo Login NO es el sembrador, es solo quien esta
// registrando el dato (puede ser un supervisor digitando por otra persona) -- por eso ya no
// se elige a mano: se toma siempre del usuario en sesion, ver abajo (cargarCatalogosLocal/
// limpiarFormulario), y se guarda como "login" (registrado por), nunca como sembrador.
crearListaFiltrable({
  inputEl: document.querySelector("#empleadoBuscar"),
  listaEl: document.querySelector("#empleadoLista"),
  etiquetaEl: document.querySelector("#empleadoSeleccionado"),
  obtenerItems: () => catalogos.empleados,
  getLabel: (e) => `${e.nombre} (${e.codigo})`,
  getValue: (e) => e.codigo,
  placeholderVacio: "Sin empleado seleccionado",
  onSeleccionar: (e) => {
    empleadoSeleccionadoCodigo = e.codigo;
  },
});

// ---------------------------------------------------------------------------
// Validaciones exactas de AppLabores.
// ---------------------------------------------------------------------------

const REGEX_LINEAS = /^\d{1,3}$/;
const REGEX_DENSIDAD = /^\d{1,5}$/;

// Erradicación se sacó de esta pantalla (14/09/2026) -- se hace desde una pantalla propia que
// primero busca la siembra activa real por Bloque/Cama en vez de re-digitarla como si fuera
// nueva. Este formulario ya solo registra siembra nueva o la edita.
//
// Líneas es opcional al registrar (16/09/2026): la sembradora pre-registra Bloque/Cama/Variedad
// mientras el operario todavía está sembrando la cama, sin Líneas todavía -- se guarda como 0
// ("pendiente de conteo", mismo criterio que ya soporta el backend). Quien revisa (ej. Joana)
// entra después por "Ver/Editar" en Revisión y ajusta las Líneas reales una vez el operario
// terminó. Un valor en blanco es válido; si se escribe algo, debe ser numérico.
function validar() {
  if (!bloqueSeleccionadoCodigo) return "Debes seleccionar un Bloque.";
  if (!camaSeleccionadaCodigo) return "Debes seleccionar una Cama.";
  if (lineasInput.value.trim() && !REGEX_LINEAS.test(lineasInput.value.trim())) return "El campo Líneas debe tener entre 1 y 3 dígitos numéricos (o dejarlo en blanco si aún no se cuenta).";
  if (!REGEX_DENSIDAD.test(densidadInput.value.trim())) return "El campo Densidad debe tener entre 1 y 5 dígitos numéricos.";
  if (!variedadSeleccionadaCodigo) return "Debes seleccionar una Variedad.";
  if (!origenSelect.value) return "Debes seleccionar un Origen.";
  if (!empleadoSeleccionadoCodigo) return "Debes seleccionar un Empleado.";
  if (!semanaInput.value) return "Debes indicar la Semana de planeación.";
  if (!fechaInput.value) return "Debes indicar la Fecha.";
  return null;
}

// ---------------------------------------------------------------------------
// Carga de catálogos (siempre desde IndexedDB local; se refrescan aparte si hay red).
// ---------------------------------------------------------------------------

async function cargarCatalogosLocal() {
  catalogos = await SyncEngine.obtenerCatalogosLocal();
  origenSelect.innerHTML = catalogos.origenes.map((o) => `<option value="${o.nombre}">${o.nombre}</option>`).join("");

  // El login queda siempre atado al usuario en sesion (ya no se elige a mano).
  if (sesion) {
    usuarioRegistroLogin = sesion.username;
  }
}

// Aviso explicito si salio a campo sin haber sincronizado nunca -- sin esto, offline no sirve
// de nada (no hay Bloque/Cama/Variedad/Empleado para elegir). Se revisa despues de cargar
// local Y despues de intentar sincronizar, para que el aviso desaparezca solo si la red si
// estaba disponible y ya se completo la descarga (no debe quedar pegado tapando otros mensajes).
function avisarSiCatalogosVacios() {
  const faltan = catalogos.camas.length === 0 || catalogos.variedades.length === 0 || catalogos.empleados.length === 0;
  if (faltan) {
    resultStatus.classList.remove("ok");
    resultStatus.classList.add("error");
    resultState.textContent = "⚠ Catálogos vacíos en este equipo (Bloques/Variedades/Empleados). Conéctate a internet una vez antes de salir a campo.";
  } else if (resultState.textContent.startsWith("⚠ Catálogos vacíos")) {
    resultStatus.classList.remove("error");
    resultState.textContent = "Catálogos listos. Sin guardar aún.";
  }
}

// Semana programada = semana actual real (domingo-sabado, dbo.tblsemana). Solo la pone si el
// campo esta vacio -- no pisa nada que el usuario ya haya escrito a mano.
function ponerSemanaActualPorDefecto() {
  if (semanaInput.value || editandoId) return;
  const semanaActual = SyncEngine.semanaQueContiene(catalogos.semanas, new Date());
  if (semanaActual) {
    semanaInput.value = semanaActual.semana;
    anoInput.value = semanaActual.ano;
  }
}

async function checkApi() {
  try {
    await SyncEngine.apiGetOnline("/api/siembra/online/origenes");
    apiStatusPill.textContent = "En línea";
    apiStatusPill.classList.add("ok");
    await SyncEngine.sincronizarCatalogos();
    await cargarCatalogosLocal();
  } catch {
    apiStatusPill.textContent = "Sin conexión (modo offline)";
    apiStatusPill.classList.add("warn");
  } finally {
    avisarSiCatalogosVacios();
    // Si el primer intento (antes de sincronizar) dejo la semana vacia porque el catalogo
    // todavia no existia localmente, esto la completa apenas termine de sincronizar.
    ponerSemanaActualPorDefecto();
  }
}

// ---------------------------------------------------------------------------
// Modo edición vía ?editar=<id>
// ---------------------------------------------------------------------------

async function cargarParaEditar(id) {
  const registro = await OfflineDb.get("siembras", id);
  if (!registro) {
    resultStatus.classList.add("error");
    resultState.textContent = `No se encontró la siembra #${id} en este equipo. Sincroniza primero.`;
    return;
  }

  // Erradicación (Lineas=-1) ya no se edita desde esta pantalla -- tiene su propio flujo.
  if (Number(registro.lineas) < 0) {
    resultStatus.classList.add("error");
    resultState.textContent = `La siembra #${id} es una erradicación -- edítala desde la pantalla de Erradicación, no desde Registro.`;
    guardarBtn.disabled = true;
    return;
  }

  editandoId = id;
  formTitulo.textContent = "Editar Siembra Campo";
  modoEtiqueta.textContent = `Editando #${id}`;
  nuevoBtn.hidden = false;
  revisoWrap.hidden = false;
  revisoInput.checked = !!registro.reviso;

  fechaInput.value = registro.fecha;
  densidadInput.value = registro.densidad;
  origenSelect.value = registro.origen || "";
  semanaInput.value = registro.semanaProgramada || "";
  anoInput.value = registro.anoProgramado || "";
  lineasInput.value = registro.lineas;

  // Al editar se conserva el login original (quien la creo), no el usuario en sesion.
  usuarioRegistroLogin = registro.login || sesion?.username || null;

  bloqueSeleccionadoCodigo = String(registro.bloque).trim() || null;
  document.querySelector("#bloqueSeleccionado").textContent = bloqueSeleccionadoCodigo ? `Bloque ${bloqueSeleccionadoCodigo}` : "Sin bloque seleccionado";

  camaSeleccionadaCodigo = String(registro.cama).trim() || null;
  document.querySelector("#camaSeleccionada").textContent = camaSeleccionadaCodigo ? `Cama ${camaSeleccionadaCodigo}` : "Sin cama seleccionada";

  variedadSeleccionadaCodigo = registro.variedad || null;
  document.querySelector("#variedadSeleccionada").textContent = registro.variedadNombre || registro.variedad || "Sin variedad seleccionada";

  clonSeleccionadoCodigo = registro.vclon || null;
  document.querySelector("#clonSeleccionado").textContent = registro.vclon || "(ninguno)";

  empleadoSeleccionadoCodigo = registro.empleado || null;
  const empleadoCat = catalogos.empleados.find((e) => e.codigo === registro.empleado);
  document.querySelector("#empleadoSeleccionado").textContent = empleadoCat
    ? `${empleadoCat.nombre} (${empleadoCat.codigo})`
    : registro.empleado || "Sin empleado seleccionado";
}

function limpiarFormulario() {
  editandoId = null;
  formTitulo.textContent = "Registro Siembra Campo";
  modoEtiqueta.textContent = "Nuevo";
  nuevoBtn.hidden = true;
  revisoWrap.hidden = true;
  revisoInput.checked = false;
  lineasInput.disabled = false;
  guardarBtn.disabled = false;

  fechaInput.value = SyncEngine.fechaLocalISO();
  lineasInput.value = "";
  densidadInput.value = "";
  semanaInput.value = "";
  anoInput.value = "";
  ponerSemanaActualPorDefecto();

  bloqueSeleccionadoCodigo = null;
  document.querySelector("#bloqueSeleccionado").textContent = "Sin bloque seleccionado";
  camaSeleccionadaCodigo = null;
  document.querySelector("#camaSeleccionada").textContent = "Sin cama seleccionada";
  variedadSeleccionadaCodigo = null;
  document.querySelector("#variedadSeleccionada").textContent = "Sin variedad seleccionada";
  clonSeleccionadoCodigo = null;
  document.querySelector("#clonSeleccionado").textContent = "(ninguno)";
  empleadoSeleccionadoCodigo = null;
  document.querySelector("#empleadoSeleccionado").textContent = "Sin empleado seleccionado";

  usuarioRegistroLogin = sesion?.username || null;

  history.replaceState(null, "", "./siembra.html");
}

async function guardarSiembra() {
  const error = validar();
  if (error) {
    resultStatus.classList.remove("ok");
    resultStatus.classList.add("error");
    resultState.textContent = error;
    return;
  }

  const datos = {
    fecha: fechaInput.value,
    bloque: bloqueSeleccionadoCodigo.padStart(2, "0"),
    cama: camaSeleccionadaCodigo.padStart(4, "0"),
    variedad: variedadSeleccionadaCodigo,
    variedadNombre: document.querySelector("#variedadSeleccionada").textContent,
    lineas: Number(lineasInput.value),
    densidad: Number(densidadInput.value),
    empleado: empleadoSeleccionadoCodigo,
    vclon: clonSeleccionadoCodigo,
    origen: origenSelect.value || null,
    login: usuarioRegistroLogin,
    semanaProgramada: semanaInput.value ? Number(semanaInput.value) : null,
    anoProgramado: anoInput.value ? Number(anoInput.value) : null,
    reviso: revisoWrap.hidden ? null : revisoInput.checked,
    causa: null,
  };

  const eraEdicion = editandoId !== null;
  guardarBtn.disabled = true; // evita un segundo toque mientras guarda/regresa
  const guardado = await SyncEngine.guardarSiembraLocal(datos, editandoId);

  resultStatus.classList.remove("error");
  resultStatus.classList.add("ok");

  if (eraEdicion) {
    // Al terminar de editar se vuelve a las tarjetas de Revision -- el formulario no debe quedar
    // abierto en blanco, porque desde ahi alguien podia empezar a registrar una siembra nueva
    // por error creyendo que seguia editando (pedido 18/09/2026).
    resultState.textContent = `Cambios guardados (siembra #${guardado.id}). Volviendo a Revisión…`;
    setTimeout(() => { window.location.href = "./siembra-revision.html"; }, 600);
    return;
  }

  resultState.textContent = `Guardado localmente: siembra #${guardado.id} (pendiente de sincronizar).`;
  limpiarFormulario();
}

guardarBtn.addEventListener("click", guardarSiembra);
nuevoBtn.addEventListener("click", limpiarFormulario);

(async function iniciar() {
  await cargarCatalogosLocal();
  checkApi();

  const params = new URLSearchParams(window.location.search);
  const idEditar = params.get("editar");
  if (idEditar) {
    limpiarFormulario();
    await cargarParaEditar(Number(idEditar));
  } else {
    limpiarFormulario();
  }
})();
