// Asegurar Corte — portado de MeteoroCosechaJSApp (Xamarin, AseguradorCorteViewModel.cs).
// Audita la calidad del corte: se abre una revisión numerada del día para un cortador y se le
// agregan pares Item de calidad → Observación (cascada, mismo patrón que Variedad→Clon).
// Guarda siempre local primero (offline-first) — nunca llama directo al API al guardar.

const sesion = JSON.parse(sessionStorage.getItem("labores_usuario") || "null");
if (!sesion) {
  window.location.href = "./login.html";
}

const apiStatusPill = document.querySelector("#apiStatusPill");
const pendientesPill = document.querySelector("#pendientesPill");
const usuarioPill = document.querySelector("#usuarioPill");
const sincronizarBtn = document.querySelector("#sincronizarBtn");

const aseguradorSeleccionadoEl = document.querySelector("#aseguradorSeleccionado");

const colaboradorBuscar = document.querySelector("#colaboradorBuscar");
const colaboradorLista = document.querySelector("#colaboradorLista");
const colaboradorNombre = document.querySelector("#colaboradorNombre");
const colaboradorCodigo = document.querySelector("#colaboradorCodigo");
const colaboradorRevision = document.querySelector("#colaboradorRevision");

const modalidadSelect = document.querySelector("#modalidad");
const itemSelect = document.querySelector("#item");
const observacionSelect = document.querySelector("#observacion");
const agregarBtn = document.querySelector("#agregarBtn");

const temporalesVacio = document.querySelector("#temporalesVacio");
const temporalesLista = document.querySelector("#temporalesLista");
const guardarBtn = document.querySelector("#guardarBtn");

const resultState = document.querySelector("#resultState");
const resultStatus = document.querySelector("#resultStatus");

usuarioPill.textContent = sesion ? sesion.empleadoNombre || sesion.username : "Usuario";

let catalogo = { items: [], observaciones: [], colaboradores: [] };
let colaboradorSeleccionado = null;
// El asegurador es "el mismo usuario" logueado (pedido explicito, sin selector) -- pero
// tblcorte.asegurador es varchar(6), el mismo codigo de Empleado que colaborador, no el
// username. Se resuelve UNA vez al abrir la pantalla via UsuariosApp.Cedula -> Empleado.docId
// (ver ObtenerAseguradorPorUsuarioAsync en el server) y se guarda en localStorage para que
// siga disponible sin red despues de la primera vez.
let aseguradorSeleccionado = null;
let siguienteRevision = null;
let temporales = []; // { idItem, item, idObservacion, observacion }

function marcarResultado(estado, mensaje) {
  resultStatus.classList.remove("ok", "warning", "error");
  if (estado) resultStatus.classList.add(estado);
  resultState.textContent = mensaje;
}

// ---------------------------------------------------------------------------
// Buscador de cortador — mismo patrón crearListaFiltrable de siembra.js (mousedown, no click,
// para no perder la selección contra el blur del input).
// ---------------------------------------------------------------------------

function crearListaFiltrable({ inputEl, listaEl, obtenerItems, getLabel, onSeleccionar, mensajeVacio }) {
  function render(filtro) {
    const texto = (filtro || "").trim().toLowerCase();
    const items = obtenerItems().filter((it) => !texto || getLabel(it).toLowerCase().includes(texto));
    if (items.length === 0) {
      listaEl.innerHTML = `<p class="hint" style="margin:0;">${mensajeVacio || "Sin resultados."}</p>`;
      return;
    }
    const visibles = items.slice(0, 40);
    listaEl.innerHTML = visibles
      .map((it, idx) => `<div class="pending-item" style="cursor:pointer; padding:8px 10px;" data-idx="${idx}"><span style="margin:0;">${getLabel(it)}</span></div>`)
      .join("");
    listaEl.querySelectorAll(".pending-item").forEach((el) => {
      el.addEventListener("mousedown", (ev) => {
        ev.preventDefault();
        const item = visibles[Number(el.dataset.idx)];
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
}

const ASEGURADOR_CACHE_KEY = "aseguradorActualCache";

async function resolverAseguradorActual() {
  try {
    const resultado = await SyncEngine.apiGetOnline(`/api/aseguramiento-corte/asegurador-actual?username=${encodeURIComponent(sesion.username)}`);
    aseguradorSeleccionado = resultado;
    localStorage.setItem(ASEGURADOR_CACHE_KEY, JSON.stringify(resultado));
    aseguradorSeleccionadoEl.textContent = `${resultado.nombre} (${resultado.codigo})`;
  } catch (err) {
    // Sin red: usar lo que ya se resolvio una vez antes en este dispositivo.
    const cache = localStorage.getItem(ASEGURADOR_CACHE_KEY);
    if (cache) {
      aseguradorSeleccionado = JSON.parse(cache);
      aseguradorSeleccionadoEl.textContent = `${aseguradorSeleccionado.nombre} (${aseguradorSeleccionado.codigo})`;
      return;
    }
    aseguradorSeleccionado = null;
    aseguradorSeleccionadoEl.textContent = "⚠ Tu usuario no está vinculado a un empleado real todavía. Pide que se configure antes de usar Asegurar Corte.";
  }
}

crearListaFiltrable({
  inputEl: colaboradorBuscar,
  listaEl: colaboradorLista,
  obtenerItems: () => catalogo.colaboradores,
  getLabel: (c) => `${c.nombre} (${c.codigo})`,
  mensajeVacio: "No hay cortadores cargados -- sincroniza con red antes de salir a campo.",
  onSeleccionar: (c) => seleccionarColaborador(c),
});

async function seleccionarColaborador(c) {
  const localesHoy = await SyncEngine.contarRevisionesHoyLocal(c.codigo);
  const revisionBase = Math.max(c.revision || 0, localesHoy);

  colaboradorSeleccionado = c;
  siguienteRevision = revisionBase + 1;

  colaboradorNombre.textContent = c.nombre;
  colaboradorCodigo.textContent = c.codigo;

  if (siguienteRevision > 10) {
    colaboradorRevision.textContent = "Completa (10/10)";
    marcarResultado("error", `${c.nombre} ya tiene las 10 revisiones del día. Selecciona otro cortador.`);
    guardarBtn.disabled = true;
  } else {
    colaboradorRevision.textContent = String(siguienteRevision);
    guardarBtn.disabled = false;
    marcarResultado(null, "Agrega los items de control de esta revisión.");
  }

  temporales = [];
  renderTemporales();
}

// ---------------------------------------------------------------------------
// Cascada Item → Observación.
// ---------------------------------------------------------------------------

function renderItems() {
  itemSelect.innerHTML = catalogo.items.map((it) => `<option value="${it.id}">${it.nombre}</option>`).join("");
  renderObservaciones();
}

function renderObservaciones() {
  const itemId = Number(itemSelect.value);
  const hijos = SyncEngine.observacionesDelItem(catalogo.observaciones, itemId);
  observacionSelect.innerHTML = hijos.map((o) => `<option value="${o.id}">${o.nombre}</option>`).join("");
}

itemSelect.addEventListener("change", renderObservaciones);

// ---------------------------------------------------------------------------
// Agregar / quitar items de control de la revisión en curso -- mismas reglas de negocio que
// AgregarObservacion() en AseguradorCorteViewModel.cs: no repetir el mismo Item, y el Item
// id=1 ("RAMO CONFORME") es excluyente con cualquier otro.
// ---------------------------------------------------------------------------

const ID_RAMO_CONFORME = 1;

function renderTemporales() {
  temporalesVacio.hidden = temporales.length > 0;
  temporalesLista.innerHTML = temporales
    .map(
      (t, idx) => `
        <div class="pending-item">
          <strong>${t.item}</strong>
          <span>${t.observacion}</span>
          <button class="ghost-btn" type="button" data-idx="${idx}" style="margin-top:8px;">Quitar</button>
        </div>`
    )
    .join("");
  temporalesLista.querySelectorAll("button[data-idx]").forEach((btn) => {
    btn.addEventListener("click", () => {
      temporales.splice(Number(btn.dataset.idx), 1);
      renderTemporales();
    });
  });
}

function agregarObservacion() {
  if (!colaboradorSeleccionado) {
    marcarResultado("error", "Selecciona primero un cortador.");
    return;
  }
  const idItem = Number(itemSelect.value);
  const idObservacion = Number(observacionSelect.value);
  if (!idItem || !idObservacion) {
    marcarResultado("error", "Selecciona un Item y una Observación.");
    return;
  }

  if (temporales.some((t) => t.idItem === idItem)) {
    marcarResultado("error", "Ya tienes un item de control igual en esta revisión, selecciona otro o guarda la revisión.");
    return;
  }
  const hayNoConforme = temporales.some((t) => t.idItem !== ID_RAMO_CONFORME);
  if (idItem === ID_RAMO_CONFORME && hayNoConforme) {
    marcarResultado("error", "Ya tienes un item no conforme, no puedes agregar Ramo Conforme.");
    return;
  }
  if (temporales.some((t) => t.idItem === ID_RAMO_CONFORME) && idItem !== ID_RAMO_CONFORME) {
    marcarResultado("error", "Ya tienes item de control Ramo Conforme, no puedes agregar otro.");
    return;
  }

  const item = catalogo.items.find((it) => it.id === idItem);
  const observacion = catalogo.observaciones.find((o) => o.id === idObservacion);
  temporales.push({ idItem, item: item?.nombre || "", idObservacion, observacion: observacion?.nombre || "" });
  renderTemporales();
  marcarResultado(null, "Item agregado. Continúa agregando o guarda la revisión.");
}

agregarBtn.addEventListener("click", agregarObservacion);

// ---------------------------------------------------------------------------
// Guardar revisión — offline-first: se encola en corteRevisiones y se sube con "Sincronizar".
// ---------------------------------------------------------------------------

async function guardarRevision() {
  if (!aseguradorSeleccionado) {
    marcarResultado("error", "Selecciona quién está haciendo la revisión (Asegurador).");
    return;
  }
  if (!colaboradorSeleccionado) {
    marcarResultado("error", "Selecciona un cortador.");
    return;
  }
  if (temporales.length === 0) {
    marcarResultado("error", "No tienes ningún item de control agregado. Agrega al menos uno.");
    return;
  }

  const semanas = await OfflineDb.getAll("semanas");
  const semanaActual = SyncEngine.semanaQueContiene(semanas, new Date());

  const revision = {
    asegurador: aseguradorSeleccionado.codigo,
    colaborador: colaboradorSeleccionado.codigo,
    docid: colaboradorSeleccionado.docid || null,
    nrevision: siguienteRevision,
    modalidad: Number(modalidadSelect.value),
    // 0 si el catálogo de semanas nunca se sincronizó en este equipo -- no se inventa un
    // número de semana con una fórmula que podría no coincidir con el calendario real.
    semana: semanaActual ? semanaActual.semana : 0,
    fecha: new Date().toISOString(),
    observaciones: temporales.map((t) => ({ idObservacion: t.idObservacion })),
  };

  const guardada = await SyncEngine.guardarRevisionCorteLocal(revision);
  marcarResultado("ok", `Revisión #${guardada.nrevision} de ${colaboradorSeleccionado.nombre} guardada localmente (pendiente de sincronizar).`);

  colaboradorSeleccionado = null;
  siguienteRevision = null;
  colaboradorNombre.textContent = "Sin cortador seleccionado";
  colaboradorCodigo.textContent = "—";
  colaboradorRevision.textContent = "—";
  guardarBtn.disabled = false;
  temporales = [];
  renderTemporales();

  await actualizarPendientes();
}

guardarBtn.addEventListener("click", guardarRevision);

// ---------------------------------------------------------------------------
// Sincronización.
// ---------------------------------------------------------------------------

async function actualizarPendientes() {
  const total = await SyncEngine.contarPendientesCorte();
  pendientesPill.hidden = total === 0;
  pendientesPill.textContent = `${total} pendiente(s)`;
}

async function cargarCatalogoLocal() {
  catalogo = await SyncEngine.obtenerCatalogoCorteLocal();
  renderItems();
}

async function checkApi() {
  try {
    await SyncEngine.apiGetOnline("/api/aseguramiento-corte/items");
    apiStatusPill.textContent = "En línea";
    apiStatusPill.classList.add("ok");
    await SyncEngine.sincronizarCatalogoCorte();
    await cargarCatalogoLocal();
  } catch {
    apiStatusPill.textContent = "Sin conexión (modo offline)";
    apiStatusPill.classList.add("warn");
  } finally {
    if (catalogo.items.length === 0) {
      marcarResultado("error", "⚠ Catálogo vacío en este equipo. Conéctate a internet una vez antes de salir a campo.");
    }
    await actualizarPendientes();
  }
}

async function sincronizar() {
  sincronizarBtn.disabled = true;
  try {
    const resultado = await SyncEngine.sincronizarPendientesCorte();
    await SyncEngine.sincronizarCatalogoCorte();
    await cargarCatalogoLocal();
    marcarResultado(
      "ok",
      resultado.fallidas > 0
        ? `Sincronizado: ${resultado.subidas} revisión(es) subida(s), ${resultado.fallidas} fallida(s) (sin red o rechazadas).`
        : resultado.subidas > 0
        ? `Sincronizado: ${resultado.subidas} revisión(es) subida(s) correctamente.`
        : "Todo estaba sincronizado."
    );
  } catch (err) {
    marcarResultado("error", "No fue posible sincronizar: sin conexión con el servidor.");
  } finally {
    sincronizarBtn.disabled = false;
    await actualizarPendientes();
  }
}

sincronizarBtn.addEventListener("click", sincronizar);

window.addEventListener("online", () => {
  apiStatusPill.textContent = "En línea";
  apiStatusPill.classList.remove("warn");
  apiStatusPill.classList.add("ok");
  sincronizar();
});
window.addEventListener("offline", () => {
  apiStatusPill.textContent = "Sin conexión";
  apiStatusPill.classList.remove("ok");
  apiStatusPill.classList.add("warn");
});

(async function iniciar() {
  await cargarCatalogoLocal();
  await resolverAseguradorActual();
  checkApi();
})();
