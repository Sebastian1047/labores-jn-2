const sesionPoscosecha = JSON.parse(sessionStorage.getItem("labores_usuario") || "null");
if (!sesionPoscosecha) window.location.href = "./login.html";

const params = new URLSearchParams(window.location.search);
const rol = String(params.get("rol") || "").toLowerCase();
const tipo = String(params.get("tipo") || "").toLowerCase();

const ROLES = {
  surtidor: "Surtidor",
  zunchador: "Zunchador",
  digitador: "Digitador",
  empacador: "Empacador",
};

const TIPOS = {
  rendimiento: { nombre: "Rendimiento", icono: "📊" },
  calidad: { nombre: "Calidad", icono: "✅" },
};

const rolNombre = ROLES[rol] || "Poscosecha";
const tipoInfo = TIPOS[tipo] || { nombre: "Módulo", icono: "💐" };

const usuarioPill = document.querySelector("#usuarioPill");
const estadoPill = document.querySelector("#estadoPill");
const moduloTitulo = document.querySelector("#moduloTitulo");
const vistaRendimiento = document.querySelector("#vistaRendimiento");
const vistaCalidadEmpacador = document.querySelector("#vistaCalidadEmpacador");
const vistaPlaceholder = document.querySelector("#vistaPlaceholder");
const moduloEstado = document.querySelector("#moduloEstado");
const moduloDescripcion = document.querySelector("#moduloDescripcion");

usuarioPill.textContent =
  sesionPoscosecha?.empleadoNombre || sesionPoscosecha?.username || "Usuario";

moduloTitulo.textContent = `${tipoInfo.icono} ${rolNombre} - ${tipoInfo.nombre}`;

const CRITERIOS_CALIDAD_POSCOSECHA = {
  empacador: [
    { id: 1, nombre: "Caja Conforme" },
    { id: 2, nombre: "Área de Empaque limpia y Ordenada" },
    { id: 3, nombre: "Tipo de Caja" },
    { id: 4, nombre: "Simetría" },
    { id: 5, nombre: "Ubicación del logo de capuchón" },
    { id: 6, nombre: "Código Empaque" },
    { id: 7, nombre: "Presentación de Ramos" },
    { id: 8, nombre: "Número de Ramos por Caja" },
    { id: 9, nombre: "Especificaciones de PO, SO y OM" },
    { id: 10, nombre: "Marcación / Código" },
    { id: 11, nombre: "Daño Mecánico" },
    { id: 12, nombre: "UPC y Capuchón Manchado, rasgado" },
  ],
  surtidor: [
    { id: 1, nombre: "Surtido Conforme" },
    { id: 2, nombre: "Surtido" },
    { id: 3, nombre: "Apertura" },
    { id: 4, nombre: "Daño Mecánico" },
    { id: 5, nombre: "Marcación" },
  ],
  zunchador: [
    { id: 1, nombre: "Zuncho Conforme" },
    { id: 2, nombre: "Zunchos" },
    { id: 3, nombre: "Daño mecánico" },
  ],
  digitador: [
    { id: 1, nombre: "Digitación conforme" },
    { id: 2, nombre: "Mala marcación" },
  ],
};

if (tipo === "rendimiento") {
  vistaRendimiento.hidden = false;
  vistaCalidadEmpacador.hidden = true;
  vistaPlaceholder.hidden = true;
  iniciarRendimiento();
} else if (tipo === "calidad" && CRITERIOS_CALIDAD_POSCOSECHA[rol]) {
  vistaRendimiento.hidden = true;
  vistaCalidadEmpacador.hidden = false;
  vistaPlaceholder.hidden = true;
  iniciarCalidadPoscosecha();
} else {
  vistaRendimiento.hidden = true;
  vistaCalidadEmpacador.hidden = true;
  vistaPlaceholder.hidden = false;
  moduloEstado.textContent = `Módulo de ${tipoInfo.nombre} de ${rolNombre} creado.`;
  moduloDescripcion.textContent =
    "La estructura ya está disponible dentro de Poscosecha. Los campos específicos se agregarán según el flujo definido para este módulo.";
}

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

function iniciarRendimiento() {
  const fechaInput = document.querySelector("#fecha");
  const colaboradorEtiqueta = document.querySelector("#colaboradorEtiqueta");
  const colaboradorBuscar = document.querySelector("#colaboradorBuscar");
  const colaboradorLista = document.querySelector("#colaboradorLista");
  const colaboradorSeleccionadoEl = document.querySelector("#colaboradorSeleccionado");
  const rendimientoObservaciones = document.querySelector("#rendimientoObservaciones");

  const viewTabs = [...document.querySelectorAll("[data-poscosecha-vista]")];
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
  const tiemposObservaciones = document.querySelector("#tiemposObservaciones");
  const guardarTiemposBtn = document.querySelector("#guardarTiemposBtn");
  const limpiarTiemposBtn = document.querySelector("#limpiarTiemposBtn");
  const tiemposResultStatus = document.querySelector("#tiemposResultStatus");
  const tiemposResultState = document.querySelector("#tiemposResultState");
  const tiemposRegistrosLista = document.querySelector("#tiemposRegistrosLista");

  let colaboradores = [];
  let colaboradorSeleccionado = null;

  colaboradorEtiqueta.textContent = rolNombre;
  colaboradorBuscar.placeholder = `Buscar ${rolNombre.toLowerCase()} por nombre o código…`;
  colaboradorSeleccionadoEl.textContent = `Sin ${rolNombre.toLowerCase()} seleccionado`;
  fechaInput.value = fechaLocal();

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
      btn.classList.toggle("active", btn.dataset.poscosechaVista === (esTiempos ? "tiempos" : "registro"));
    });
  }

  viewTabs.forEach((btn) => {
    btn.addEventListener("click", () => aplicarVista(btn.dataset.poscosechaVista));
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

  function marcarResultadoTiempos(tipoResultado, mensaje) {
    tiemposResultStatus.classList.remove("ok", "warning", "error");
    if (tipoResultado) tiemposResultStatus.classList.add(tipoResultado);
    tiemposResultState.textContent = mensaje;
  }

  function limpiarTiempos() {
    [horasLaboralesMin, horasExtraMin, pMadresMin, pAbuelasMin, desplazamientoMin, calisteniaMin, capacitacionMin]
      .forEach((input) => { input.value = ""; });
    tiemposObservaciones.value = "";
    actualizarCalculoTiempos();
  }

  async function renderRegistrosTiempos() {
    const registros = (await OfflineDb.getAll("poscosechaRendimientoTiempos"))
      .filter((r) => r.rol === rol)
      .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));

    tiemposRegistrosLista.innerHTML = registros.length
      ? registros.slice(0, 20).map((r) => `
          <article class="pending-item">
            <strong>${r.fecha} · ${r.colaboradorNombre}</strong>
            <span>${r.rolNombre}</span>
            <span>Laborales: ${formatoMinutos(r.horasLaboralesMin)} · Extra: ${formatoMinutos(r.horasExtraMin)}</span>
            <span>Otras actividades: ${formatoMinutos(r.otrasLaboresMin)}</span>
            <span>Tiempo real de labor: ${formatoMinutos(r.tiempoRealMin)}</span>
            ${r.observaciones ? `<span>Observaciones: ${r.observaciones}</span>` : ""}
          </article>
        `).join("")
      : `<p class="hint" style="margin:0;">Todavía no hay registros de tiempo para ${rolNombre}.</p>`;
  }

  async function guardarTiempos() {
    const fecha = fechaInput.value;
    if (!fecha) return marcarResultadoTiempos("error", "Selecciona la fecha.");
    if (!colaboradorSeleccionado) {
      return marcarResultadoTiempos("error", `Selecciona un ${rolNombre.toLowerCase()}.`);
    }

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
      area: "Poscosecha",
      rol,
      rolNombre,
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
      observaciones: tiemposObservaciones.value.trim(),
      observacionesLabor: rendimientoObservaciones.value.trim(),
      usuario: sesionPoscosecha?.username || "",
      syncStatus: "PendienteBackend",
      createdAt: new Date().toISOString(),
    };

    await OfflineDb.put("poscosechaRendimientoTiempos", registro);
    marcarResultadoTiempos(
      "ok",
      `Tiempos guardados. Tiempo real dedicado a la labor: ${formatoMinutos(registro.tiempoRealMin)}.`
    );
    limpiarTiempos();
    rendimientoObservaciones.value = "";
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

      if (navigator.onLine) {
        try {
          await SyncEngine.sincronizarCatalogos();
          const actualizados = await SyncEngine.obtenerCatalogosLocal();
          colaboradores = (actualizados.empleados || []).filter(
            (item) => item.activo !== false && item.retirado !== 1 && item.retirado !== true
          );
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

  (async function iniciarFormularioRendimiento() {
    limpiarTiempos();
    aplicarVista("registro");
    await cargarColaboradores();
    await renderRegistrosTiempos();
  })();
}


function iniciarCalidadPoscosecha() {
  const evaluadorNombre = document.querySelector("#calidadEvaluadorNombre");
  const semanaActualEl = document.querySelector("#calidadSemanaActual");
  const revisionEl = document.querySelector("#calidadRevision");
  const buscar = document.querySelector("#calidadColaboradorBuscar");
  const lista = document.querySelector("#calidadColaboradorLista");
  const rolEtiqueta = document.querySelector("#calidadRolEtiqueta");
  const criteriosHint = document.querySelector("#calidadCriteriosHint");
  const registrosHint = document.querySelector("#calidadRegistrosHint");
  const nombreEl = document.querySelector("#calidadColaboradorNombre");
  const codigoEl = document.querySelector("#calidadColaboradorCodigo");
  const criteriosEl = document.querySelector("#calidadEmpacadorCriterios");
  const observacionesEl = document.querySelector("#calidadEmpacadorObservaciones");
  const guardarBtn = document.querySelector("#guardarCalidadEmpacadorBtn");
  const resultado = document.querySelector("#calidadEmpacadorResultado");
  const mensaje = document.querySelector("#calidadEmpacadorMensaje");
  const registrosEl = document.querySelector("#calidadEmpacadorRegistros");

  let colaboradores = [];
  let colaboradorSeleccionado = null;
  let semanaActual = null;
  let siguienteRevision = null;

  const criteriosCalidad = CRITERIOS_CALIDAD_POSCOSECHA[rol] || [];

  evaluadorNombre.textContent =
    sesionPoscosecha?.empleadoNombre || sesionPoscosecha?.username || "Usuario actual";

  if (rolEtiqueta) rolEtiqueta.textContent = rolNombre;
  buscar.placeholder = `Buscar ${rolNombre.toLowerCase()} por nombre o código…`;
  nombreEl.textContent = `Sin ${rolNombre.toLowerCase()} seleccionado`;
  if (criteriosHint) criteriosHint.textContent = `Marca los ítems que correspondan a la evaluación de ${rolNombre.toLowerCase()}.`;
  if (registrosHint) registrosHint.textContent = `Registros locales de Calidad ${rolNombre}.`;

  criteriosEl.innerHTML = criteriosCalidad.map((item) =>
    `<label class="calidad-criterio">
      <input type="checkbox" value="${item.id}" />
      <span class="calidad-criterio-check" aria-hidden="true"></span>
      <span class="calidad-criterio-text">${item.nombre}</span>
    </label>`
  ).join("");

  function estado(tipoResultado, texto) {
    resultado.classList.remove("ok", "warning", "error");
    if (tipoResultado) resultado.classList.add(tipoResultado);
    mensaje.textContent = texto;
  }

  function codigoEmpleado(item) {
    return String(item?.codigo || item?.docid || item?.id || "");
  }

  function nombreEmpleado(item) {
    return item?.nombre || item?.empleadoNombre || codigoEmpleado(item) || rolNombre;
  }

  function etiqueta(item) {
    return `${nombreEmpleado(item)} (${codigoEmpleado(item)})`;
  }

  async function cargarSemana() {
    const semanas = await OfflineDb.getAll("semanas");
    semanaActual = SyncEngine.semanaQueContiene(semanas, new Date());
    semanaActualEl.textContent = semanaActual
      ? `Semana ${semanaActual.semana} de ${semanaActual.ano}`
      : "Sin calendario descargado";
  }

  async function calcularSiguienteRevision(codigo) {
    const semana = Number(semanaActual?.semana || 0);
    const registros = await OfflineDb.getAll("poscosechaCalidadEvaluaciones");
    const mayor = registros
      .filter((r) =>
        r.rol === rol &&
        String(r.colaborador) === String(codigo) &&
        Number(r.semana) === semana
      )
      .reduce((acc, r) => Math.max(acc, Number(r.revision) || 0), 0);
    return mayor + 1;
  }

  function renderLista(filtro = "") {
    const texto = filtro.trim().toLowerCase();
    const visibles = colaboradores
      .filter((item) => !texto || etiqueta(item).toLowerCase().includes(texto))
      .slice(0, 50);

    lista.innerHTML = visibles.length
      ? visibles.map((item, idx) =>
          `<div class="pending-item" data-index="${idx}" style="cursor:pointer;padding:8px 10px"><span>${etiqueta(item)}</span></div>`
        ).join("")
      : '<p class="hint" style="margin:0;">No hay colaboradores disponibles en el catálogo local.</p>';

    lista.querySelectorAll("[data-index]").forEach((el) => {
      el.addEventListener("mousedown", async (event) => {
        event.preventDefault();
        const item = visibles[Number(el.dataset.index)];
        colaboradorSeleccionado = item;
        buscar.value = "";
        lista.innerHTML = "";
        nombreEl.textContent = nombreEmpleado(item);
        codigoEl.textContent = codigoEmpleado(item) || "—";
        siguienteRevision = await calcularSiguienteRevision(codigoEmpleado(item));
        revisionEl.textContent = siguienteRevision > 30 ? "Completa (30/30)" : String(siguienteRevision);
        guardarBtn.disabled = siguienteRevision > 30;
        estado(
          siguienteRevision > 30 ? "warning" : null,
          siguienteRevision > 30
            ? `Este ${rolNombre.toLowerCase()} ya tiene 30 revisiones en la semana.`
            : "Selecciona los ítems de la evaluación y guarda."
        );
      });
    });
  }

  buscar.addEventListener("focus", () => renderLista(buscar.value));
  buscar.addEventListener("input", () => renderLista(buscar.value));
  document.addEventListener("click", (event) => {
    if (event.target !== buscar && !lista.contains(event.target)) lista.innerHTML = "";
  });

  async function renderRegistros() {
    const registros = (await OfflineDb.getAll("poscosechaCalidadEvaluaciones"))
      .filter((r) => r.rol === rol)
      .sort((a,b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));

    registrosEl.innerHTML = registros.length
      ? registros.slice(0,20).map((r) => `
          <article class="pending-item">
            <strong>${r.colaboradorNombre} · Revisión ${r.revision}</strong>
            <span>Semana ${r.semana || "—"} · ${r.fecha}</span>
            <span>Ítems: ${r.itemsNombres?.length ? r.itemsNombres.join(", ") : "Sin ítems seleccionados"}</span>
            ${r.observaciones ? `<span>Observaciones: ${r.observaciones}</span>` : ""}
          </article>
        `).join("")
      : `<p class="hint" style="margin:0;">Todavía no hay evaluaciones guardadas para ${rolNombre}.</p>`;
  }

  async function guardarEvaluacion() {
    if (!colaboradorSeleccionado) {
      return estado("error", `Selecciona un ${rolNombre.toLowerCase()} antes de guardar.`);
    }
    if (!semanaActual) {
      return estado("error", "No hay calendario de semanas descargado. Conéctate una vez y vuelve a intentar.");
    }
    if (!siguienteRevision || siguienteRevision > 30) {
      return estado("error", `No hay una revisión disponible para este ${rolNombre.toLowerCase()}.`);
    }

    const items = [...criteriosEl.querySelectorAll('input:checked')].map((input) => Number(input.value));
    const itemsNombres = items.map((id) => criteriosCalidad.find((item) => item.id === id)?.nombre).filter(Boolean);
    const codigo = codigoEmpleado(colaboradorSeleccionado);
    const registro = {
      id: SyncEngine.generarUUID(),
      area: "Poscosecha",
      rol,
      rolNombre,
      fecha: fechaLocal(),
      semana: semanaActual.semana,
      ano: semanaActual.ano,
      evaluador: sesionPoscosecha?.username || "",
      colaborador: codigo,
      colaboradorNombre: nombreEmpleado(colaboradorSeleccionado),
      revision: siguienteRevision,
      items,
      itemsNombres,
      observaciones: observacionesEl.value.trim(),
      syncStatus: "PendienteBackend",
      createdAt: new Date().toISOString(),
    };

    await OfflineDb.put("poscosechaCalidadEvaluaciones", registro);
    estado("ok", `Revisión #${registro.revision} de ${registro.colaboradorNombre} guardada localmente.`);

    colaboradorSeleccionado = null;
    siguienteRevision = null;
    buscar.value = "";
    lista.innerHTML = "";
    nombreEl.textContent = `Sin ${rolNombre.toLowerCase()} seleccionado`;
    codigoEl.textContent = "—";
    revisionEl.textContent = "Selecciona un colaborador";
    criteriosEl.querySelectorAll("input").forEach((input) => { input.checked = false; });
    observacionesEl.value = "";
    guardarBtn.disabled = false;
    await renderRegistros();
  }

  guardarBtn.addEventListener("click", guardarEvaluacion);

  async function cargarColaboradoresCalidad() {
    try {
      const local = await SyncEngine.obtenerCatalogosLocal();
      colaboradores = (local.empleados || []).filter(
        (item) => item.activo !== false && item.retirado !== 1 && item.retirado !== true
      );

      if (navigator.onLine) {
        try {
          await SyncEngine.sincronizarCatalogos();
          const actualizados = await SyncEngine.obtenerCatalogosLocal();
          colaboradores = (actualizados.empleados || []).filter(
            (item) => item.activo !== false && item.retirado !== 1 && item.retirado !== true
          );
          estadoPill.textContent = "Catálogos actualizados";
          estadoPill.classList.remove("warn");
          estadoPill.classList.add("ok");
        } catch {
          estadoPill.textContent = "Datos locales";
          estadoPill.classList.add("warn");
        }
      }
    } catch {
      colaboradores = [];
      estadoPill.textContent = "Sin catálogo";
      estadoPill.classList.add("warn");
    }
  }

  (async function iniciarFormularioCalidadPoscosecha() {
    await cargarSemana();
    await cargarColaboradoresCalidad();
    await renderRegistros();
  })();
}
