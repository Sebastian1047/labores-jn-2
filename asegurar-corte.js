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
const vistaTitulo = document.querySelector("#vistaTitulo");
const rolEtiqueta = document.querySelector("#rolEtiqueta");
const roleTabs = [...document.querySelectorAll(".quality-role-tab")];
const vistaCortador = document.querySelector("#vistaCortador");
const vistaAuxiliar = document.querySelector("#vistaAuxiliar");

const aseguradorSeleccionadoEl = document.querySelector("#aseguradorSeleccionado");

const colaboradorBuscar = document.querySelector("#colaboradorBuscar");
const colaboradorLista = document.querySelector("#colaboradorLista");
const colaboradorNombre = document.querySelector("#colaboradorNombre");
const colaboradorCodigo = document.querySelector("#colaboradorCodigo");
const colaboradorRevision = document.querySelector("#colaboradorRevision");

const modalidadSelect = document.querySelector("#modalidad");
const corteCriteriosNumericos = document.querySelector("#corteCriteriosNumericos");
const itemSelect = document.querySelector("#item");
const observacionSelect = document.querySelector("#observacion");
const agregarBtn = document.querySelector("#agregarBtn");

const temporalesVacio = document.querySelector("#temporalesVacio");
const temporalesLista = document.querySelector("#temporalesLista");
const guardarBtn = document.querySelector("#guardarBtn");
const corteCalidadObservaciones = document.querySelector("#corteCalidadObservaciones");

const resultState = document.querySelector("#resultState");
const resultStatus = document.querySelector("#resultStatus");

usuarioPill.textContent = sesion ? sesion.empleadoNombre || sesion.username : "Usuario";

let catalogo = { items: [], observaciones: [], colaboradores: [] };
const ROLES_CALIDAD_CORTE = {
  cortador: "Cortador",
  garruchero: "Transportador",
  recogedor: "Recogedor",
};

const CRITERIOS_CORTE_DOCUMENTO = {
  "1": [
    { id: 1, nombre: "Ramo conforme", subitems: [] },
    { id: 2, nombre: "Deshoje", subitems: ["Deshoje por debajo de altura", "Deshoje sobre tolerancia"] },
    { id: 3, nombre: "Daño mecánico", subitems: [
      "Flores quebradas/maltratadas",
      "Hojas quebradas/maltratadas",
      "Tallos quebrados/maltratados",
      "Lateral partido (leve)",
      "2 hojas quebradas (leve)",
      "≥2 puntos florales partidos",
      "≥2 laterales partidos",
      "Cama no conforme tras corte",
    ] },
    { id: 4, nombre: "Peso del ramo y/o número de tallos", subitems: ["Peso fuera de especificación", "Menos tallos mínimos para el peso", "Tallos ≠ orden de producción"] },
    { id: 5, nombre: "Número de puntos florales por tallo", subitems: ["Menos de 4 puntos florales", "3 puntos no permitidos", "4.º punto fuera de condición"] },
    { id: 6, nombre: "Cauchos", subitems: ["Posición incorrecta", "Desalineados", "Color incorrecto", "Cantidad incorrecta", "Vueltas ≠ 3"] },
    { id: 7, nombre: "Longitud del ramo", subitems: [] },
    { id: 8, nombre: "Base del ramo", subitems: ["Corte de base disparejo", "Tallos rasgados en la base"] },
    { id: 9, nombre: "Alineación de la flor", subitems: [] },
    { id: 10, nombre: "Follaje", subitems: ["Follaje amarillento", "Follaje quemado", "Follaje deshidratado", "Follaje necrótico"] },
    { id: 11, nombre: "Fitosanidad", subitems: ["Botrytis", "Stemphylium", "Quemazón", "Minador", "Trips", "Áfidos", "Gusano cogollero"] },
    { id: 12, nombre: "Presentación del ramo", subitems: ["Capuchón sucio", "Arrugado no reutilizado", "Capuchón rasgado", "Ubicación incorrecta", "Capuchón ≠ orden"] },
    { id: 13, nombre: "Hidratación", subitems: [] },
    { id: 14, nombre: "Apertura abierta/cerrada/mezclas", subitems: ["Apertura sobre estándar", "Apertura bajo estándar", "Mezcla de aperturas"] },
    { id: 15, nombre: "Flor sucia", subitems: ["Flor cortada con suelo", "Flor dejada con suelo"] },
    { id: 16, nombre: "Acuerdos de oro", subitems: ["Falta de respeto", "Indisciplina", "Falta de responsabilidad", "Falta de trabajo en equipo", "Mal trato a compañeros", "Falta de compromiso"] },
  ],
  "2": [
    { id: 1, nombre: "Ramo conforme", subitems: [] },
    { id: 2, nombre: "Deshoje", subitems: ["Deshoje sobre rango", "Deshoje bajo rango", "Follaje sobre el capuchón"] },
    { id: 3, nombre: "Daño mecánico", subitems: ["Cabezas quebradas", "Cabezas maltratadas", "Hojas quebradas", "Hojas maltratadas", "Tallos quebrados", "Tallos maltratados", "Novedad en entrega de cama"] },
    { id: 4, nombre: "Número de tallos", subitems: [] },
    { id: 5, nombre: "Cauchos", subitems: ["Posición incorrecta", "Desalineados", "Color incorrecto", "Cantidad incorrecta", "Vueltas ≠ 3"] },
    { id: 6, nombre: "Longitud del ramo", subitems: ["Longitud sobre estándar", "Longitud bajo estándar"] },
    { id: 7, nombre: "Base del ramo", subitems: ["Corte de base disparejo", "Tallos muy rasgados"] },
    { id: 8, nombre: "Alineación de la flor", subitems: ["Cabezas desalineadas", "Segundo nivel fuera de 2 cm"] },
    { id: 9, nombre: "Follaje", subitems: ["Follaje amarillento", "Follaje quemado", "Follaje deshidratado", "Follaje necrótico"] },
    { id: 10, nombre: "Fitosanidad", subitems: ["Botrytis", "Stemphylium", "Quemazón", "Minador", "Trips", "Áfidos", "Gusano cogollero"] },
    { id: 11, nombre: "Presentación del ramo", subitems: ["Capuchón sucio", "Arrugado no reutilizado", "Capuchón rasgado", "Ubicación incorrecta", "Capuchón ≠ orden"] },
    { id: 12, nombre: "Ramos en malla", subitems: [] },
    { id: 13, nombre: "Apertura abierta", subitems: [] },
    { id: 14, nombre: "Apertura cerrada", subitems: [] },
    { id: 15, nombre: "Mezclas", subitems: ["Diámetros de apertura diferentes", "Diámetro fuera del estándar"] },
    { id: 16, nombre: "Flor sucia", subitems: ["Flor cortada con suelo", "Flor dejada con suelo"] },
  ],
};

function normalizarCorte(valor) {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function escaparCorte(valor) {
  return String(valor ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function itemCatalogoParaCriterio(criterio) {
  if (!catalogo.items.length) return null;
  const objetivo = normalizarCorte(criterio.nombre);
  return catalogo.items.find((item) => {
    const actual = normalizarCorte(item.nombre);
    return actual === objetivo ||
      (actual.length > 5 && objetivo.includes(actual)) ||
      (objetivo.length > 5 && actual.includes(objetivo));
  }) || null;
}

function criteriosCorteVisibles() {
  const base = CRITERIOS_CORTE_DOCUMENTO[String(modalidadSelect.value)] || [];
  if (!catalogo.items.length) return base.map((criterio) => ({ ...criterio, idCatalogo: criterio.id }));

  const coincidentes = base
    .map((criterio) => {
      const itemCatalogo = itemCatalogoParaCriterio(criterio);
      return itemCatalogo ? { ...criterio, idCatalogo: Number(itemCatalogo.id) } : null;
    })
    .filter(Boolean);

  // Si el catálogo antiguo usa nombres muy distintos, se conserva la tabla correspondiente
  // a la modalidad en vez de dejar el formulario vacío.
  return coincidentes.length >= 3
    ? coincidentes
    : base.map((criterio) => ({ ...criterio, idCatalogo: criterio.id }));
}

function campoFallosCorte(criterio, subitem = "") {
  const etiqueta = subitem || criterio.nombre;
  return `<label class="calidad-fallo-row">
    <span class="calidad-fallo-label">${escaparCorte(etiqueta)}</span>
    <input class="calidad-fallos-input corte-fallos-input" type="number" min="0" step="1" inputmode="numeric" value="0"
      data-doc-item-id="${criterio.id}"
      data-catalogo-item-id="${criterio.idCatalogo ?? criterio.id}"
      data-item-nombre="${escaparCorte(criterio.nombre)}"
      data-subitem="${escaparCorte(subitem)}"
      aria-label="Fallos: ${escaparCorte(etiqueta)}" />
  </label>`;
}

function renderCriteriosNumericosCorte() {
  if (!corteCriteriosNumericos || rolActivo !== "cortador") return;
  const criterios = criteriosCorteVisibles();
  corteCriteriosNumericos.innerHTML = criterios.map((criterio) => {
    if ((criterio.subitems || []).length > 1) {
      return `<section class="calidad-item-fallos">
        <div class="calidad-item-fallos-titulo">${escaparCorte(criterio.nombre)}</div>
        <div class="calidad-subitems-fallos">
          ${criterio.subitems.map((subitem) => campoFallosCorte(criterio, subitem)).join("")}
        </div>
      </section>`;
    }
    return `<section class="calidad-item-fallos calidad-item-fallos-simple">${campoFallosCorte(criterio)}</section>`;
  }).join("");
}

function obtenerFallosDetalleCorte() {
  return [...document.querySelectorAll("#corteCriteriosNumericos .corte-fallos-input")]
    .map((input) => ({
      idItemDocumento: Number(input.dataset.docItemId),
      idItemCatalogo: Number(input.dataset.catalogoItemId),
      item: input.dataset.itemNombre || "",
      subitem: input.dataset.subitem || "",
      cantidad: Math.max(0, Math.floor(Number(input.value) || 0)),
    }))
    .filter((detalle) => detalle.cantidad > 0);
}

function encontrarObservacionCatalogo(detalle) {
  const hijos = SyncEngine.observacionesDelItem(catalogo.observaciones, detalle.idItemCatalogo);
  if (!hijos.length) return null;
  if (!detalle.subitem) return hijos[0];

  const objetivo = normalizarCorte(detalle.subitem);
  return hijos.find((obs) => normalizarCorte(obs.nombre) === objetivo)
    || hijos.find((obs) => {
      const actual = normalizarCorte(obs.nombre);
      return actual.includes(objetivo) || objetivo.includes(actual);
    })
    || hijos[0];
}

function observacionesBackendDesdeFallos(fallosDetalle) {
  const ids = fallosDetalle
    .map((detalle) => encontrarObservacionCatalogo(detalle)?.id)
    .filter((id) => Number.isFinite(Number(id)))
    .map(Number);

  if (!ids.length && fallosDetalle.length === 0) {
    const conforme = criteriosCorteVisibles().find((criterio) => criterio.id === 1);
    if (conforme) {
      const hijos = SyncEngine.observacionesDelItem(catalogo.observaciones, conforme.idCatalogo ?? conforme.id);
      if (hijos[0]) ids.push(Number(hijos[0].id));
    }
  }
  return [...new Set(ids)];
}

function limpiarFallosCorte() {
  document.querySelectorAll("#corteCriteriosNumericos .corte-fallos-input")
    .forEach((input) => { input.value = "0"; });
}

let rolActivo = "cortador";
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

function nombreRol() {
  return ROLES_CALIDAD_CORTE[rolActivo] || "Colaborador";
}

function nombreRolMinuscula() {
  return nombreRol().toLowerCase();
}

function resetearRevisionVista() {
  colaboradorSeleccionado = null;
  siguienteRevision = null;
  colaboradorNombre.textContent = `Sin ${nombreRolMinuscula()} seleccionado`;
  colaboradorCodigo.textContent = "—";
  colaboradorRevision.textContent = "—";
  colaboradorBuscar.value = "";
  colaboradorLista.innerHTML = "";
  temporales = [];
  if (corteCalidadObservaciones) corteCalidadObservaciones.value = "";
  limpiarFallosCorte();
  renderTemporales();
}

function aplicarVistaRol(nuevoRol) {
  rolActivo = ROLES_CALIDAD_CORTE[nuevoRol] ? nuevoRol : "cortador";
  const nombre = nombreRol();

  roleTabs.forEach((btn) => btn.classList.toggle("active", btn.dataset.rol === rolActivo));
  vistaTitulo.textContent = `✅ Calidad Corte - ${nombre}`;

  const esCortador = rolActivo === "cortador";
  vistaCortador.hidden = !esCortador;
  vistaAuxiliar.hidden = esCortador;
  vistaCortador.style.display = esCortador ? "" : "none";
  vistaAuxiliar.style.display = esCortador ? "none" : "";

  if (esCortador) {
    rolEtiqueta.textContent = "Cortador";
    colaboradorBuscar.placeholder = "Buscar cortador por nombre o código…";
    renderItems();
    renderCriteriosNumericosCorte();
    actualizarPendientes();
    marcarResultado(null, "Selecciona un cortador y registra la cantidad de fallos.");
    return;
  }

  pendientesPill.hidden = true;
  if (window.CalidadCorteAux) {
    window.CalidadCorteAux.activarRol(rolActivo);
  }
}

roleTabs.forEach((btn) => {
  btn.addEventListener("click", () => aplicarVistaRol(btn.dataset.rol));
});

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
  mensajeVacio: "No hay colaboradores cargados -- sincroniza con red antes de salir a campo.",
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
    marcarResultado("error", `${c.nombre} ya tiene las 10 revisiones del día. Selecciona otro ${nombreRolMinuscula()}.`);
    guardarBtn.disabled = true;
  } else {
    colaboradorRevision.textContent = String(siguienteRevision);
    guardarBtn.disabled = false;
    marcarResultado(null, "Registra la cantidad de fallos encontrados y guarda la revisión.");
  }

  temporales = [];
  renderTemporales();
}

// ---------------------------------------------------------------------------
// Cascada Item → Observación.
// ---------------------------------------------------------------------------

function renderItems() {
  if (rolActivo !== "cortador") {
    itemSelect.innerHTML = "";
    observacionSelect.innerHTML = "";
    itemSelect.disabled = true;
    observacionSelect.disabled = true;
    return;
  }

  itemSelect.disabled = false;
  observacionSelect.disabled = false;
  const itemsOrdenados = [...catalogo.items].sort((a, b) => {
    const aConforme = /conforme/i.test(String(a.nombre || ""));
    const bConforme = /conforme/i.test(String(b.nombre || ""));
    return Number(bConforme) - Number(aConforme);
  });
  itemSelect.innerHTML = itemsOrdenados.map((it) => `<option value="${it.id}">${it.nombre}</option>`).join("");
  renderObservaciones();
}

function renderObservaciones() {
  if (rolActivo !== "cortador") {
    observacionSelect.innerHTML = "";
    return;
  }
  const itemId = Number(itemSelect.value);
  const hijos = SyncEngine.observacionesDelItem(catalogo.observaciones, itemId);
  observacionSelect.innerHTML = hijos.map((o) => `<option value="${o.id}">${o.nombre}</option>`).join("");
}

itemSelect.addEventListener("change", renderObservaciones);
modalidadSelect.addEventListener("change", () => {
  renderCriteriosNumericosCorte();
  limpiarFallosCorte();
});

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
  if (rolActivo !== "cortador") {
    marcarResultado("error", `Los ítems y observaciones de ${nombreRol()} aún no están configurados.`);
    return;
  }
  if (!colaboradorSeleccionado) {
    marcarResultado("error", `Selecciona primero un ${nombreRolMinuscula()}.`);
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
  if (rolActivo !== "cortador") {
    marcarResultado("error", `Los ítems y observaciones de ${nombreRol()} aún no están configurados.`);
    return;
  }
  if (!aseguradorSeleccionado) {
    marcarResultado("error", "Selecciona quién está haciendo la revisión (Asegurador).");
    return;
  }
  if (!colaboradorSeleccionado) {
    marcarResultado("error", `Selecciona un ${nombreRolMinuscula()}.`);
    return;
  }
  const fallosDetalle = obtenerFallosDetalleCorte();
  const observacionesIds = observacionesBackendDesdeFallos(fallosDetalle);

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
    observacionesGenerales: corteCalidadObservaciones?.value.trim() || "",
    fallosDetalle,
    observaciones: observacionesIds.map((idObservacion) => ({ idObservacion })),
  };

  const guardada = await SyncEngine.guardarRevisionCorteLocal(revision);
  marcarResultado("ok", `Revisión #${guardada.nrevision} de ${colaboradorSeleccionado.nombre} guardada localmente con ${fallosDetalle.reduce((suma, x) => suma + x.cantidad, 0)} fallo(s) registrado(s).`);

  colaboradorSeleccionado = null;
  siguienteRevision = null;
  colaboradorNombre.textContent = `Sin ${nombreRolMinuscula()} seleccionado`;
  colaboradorCodigo.textContent = "—";
  colaboradorRevision.textContent = "—";
  guardarBtn.disabled = false;
  temporales = [];
  if (corteCalidadObservaciones) corteCalidadObservaciones.value = "";
  limpiarFallosCorte();
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
  renderCriteriosNumericosCorte();
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
    if (rolActivo === "cortador" && catalogo.items.length === 0) {
      marcarResultado("error", "⚠ Catálogo vacío en este equipo. Conéctate a internet una vez antes de salir a campo.");
    }
    await actualizarPendientes();
  }
}

async function sincronizar() {
  if (rolActivo !== "cortador" && window.CalidadCorteAux) {
    sincronizarBtn.disabled = true;
    try {
      await window.CalidadCorteAux.sincronizar();
    } finally {
      sincronizarBtn.disabled = false;
    }
    return;
  }
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
  aplicarVistaRol("cortador");
  await resolverAseguradorActual();
  checkApi();
})();
