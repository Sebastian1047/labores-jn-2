const sesionPoscosecha = JSON.parse(sessionStorage.getItem("labores_usuario") || "null");
if (!sesionPoscosecha) window.location.href = "./login.html";

const params = new URLSearchParams(window.location.search);
const rol = String(params.get("rol") || "").toLowerCase();
const tipo = String(params.get("tipo") || "").toLowerCase();

const ROLES = {
  surtidor: "Surtidor",
  zunchador: "Zunchador",
  digitador: "Digitador",
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
const vistaPlaceholder = document.querySelector("#vistaPlaceholder");
const moduloEstado = document.querySelector("#moduloEstado");
const moduloDescripcion = document.querySelector("#moduloDescripcion");

usuarioPill.textContent =
  sesionPoscosecha?.empleadoNombre || sesionPoscosecha?.username || "Usuario";

moduloTitulo.textContent = `${tipoInfo.icono} ${rolNombre} - ${tipoInfo.nombre}`;

if (tipo !== "rendimiento") {
  vistaRendimiento.hidden = true;
  vistaPlaceholder.hidden = false;
  moduloEstado.textContent = `Módulo de ${tipoInfo.nombre} de ${rolNombre} creado.`;
  moduloDescripcion.textContent =
    "La estructura ya está disponible dentro de Poscosecha. Los campos específicos se agregarán según el flujo definido para este módulo.";
} else {
  vistaRendimiento.hidden = false;
  vistaPlaceholder.hidden = true;
  iniciarRendimiento();
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
