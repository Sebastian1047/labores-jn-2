(() => {
  const sesionAux = JSON.parse(sessionStorage.getItem("labores_usuario") || "null");
  const ROLES = {
    garruchero: "Transportador",
    recogedor: "Recogedor",
  };

  const CRITERIOS_POMPON = [
    { id: 1, nombre: "Tallos con Botón Principal" },
    { id: 2, nombre: "Tallos con Tacón Largo" },
    { id: 3, nombre: "Daño Mecánico" },
    { id: 4, nombre: "Aseo de Labor" },
    { id: 5, nombre: "Conforme" },
  ];

  const STORAGE_KEY = "calidadCorteAuxEvaluacionesLocal";

  const evaluadorNombre = document.querySelector("#auxEvaluadorNombre");
  const semanaActualEl = document.querySelector("#auxSemanaActual");
  const revisionEl = document.querySelector("#auxRevision");
  const buscar = document.querySelector("#auxColaboradorBuscar");
  const lista = document.querySelector("#auxColaboradorLista");
  const nombreEl = document.querySelector("#auxColaboradorNombre");
  const codigoEl = document.querySelector("#auxColaboradorCodigo");
  const criteriosLista = document.querySelector("#auxCriteriosLista");
  const guardarBtn = document.querySelector("#auxGuardarCalidadBtn");
  const resultado = document.querySelector("#auxCalidadResultado");
  const mensaje = document.querySelector("#auxCalidadMensaje");
  const apiStatus = document.querySelector("#apiStatusPill");

  let rolActivo = "garruchero";
  let colaboradores = [];
  let semanaActual = null;
  let colaboradorSeleccionado = null;
  let siguienteRevision = null;

  function nombreRol() {
    return ROLES[rolActivo] || "Colaborador";
  }

  function estado(tipo, texto) {
    resultado.classList.remove("ok", "warning", "error");
    if (tipo) resultado.classList.add(tipo);
    mensaje.textContent = texto;
  }

  function etiquetaColaborador(item) {
    const nombre = item.nombre || item.empleadoNombre || item.codigo || "Sin nombre";
    const codigo = item.codigo || item.docid || item.id || "—";
    return `${nombre} (${codigo})`;
  }

  function renderCriterios() {
    criteriosLista.innerHTML = CRITERIOS_POMPON
      .map((item) => `<label class="calidad-criterio"><input type="checkbox" value="${item.id}" /><span class="calidad-criterio-check" aria-hidden="true"></span><span class="calidad-criterio-text">${item.nombre}</span></label>`)
      .join("");
  }

  function registrosLocales() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    } catch {
      return [];
    }
  }

  function guardarRegistrosLocales(registros) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(registros));
  }

  function calcularSiguienteRevision(codigo) {
    const semana = semanaActual?.semana || 0;
    const max = registrosLocales()
      .filter((x) => x.rol === rolActivo && String(x.colaborador) === String(codigo) && Number(x.semana) === Number(semana))
      .reduce((acc, x) => Math.max(acc, Number(x.revision) || 0), 0);
    return max + 1;
  }

  function limpiar() {
    colaboradorSeleccionado = null;
    siguienteRevision = null;
    buscar.value = "";
    lista.innerHTML = "";
    nombreEl.textContent = "Sin colaborador seleccionado";
    codigoEl.textContent = "—";
    revisionEl.textContent = "Selecciona un colaborador";
    document.querySelectorAll("#auxCriteriosLista input").forEach((item) => { item.checked = false; });
    guardarBtn.disabled = false;
  }

  function renderLista(filtro = "") {
    const texto = filtro.trim().toLowerCase();
    const visibles = colaboradores
      .filter((item) => etiquetaColaborador(item).toLowerCase().includes(texto))
      .slice(0, 40);

    lista.innerHTML = visibles.length
      ? visibles.map((item, idx) =>
          `<div class="pending-item" data-index="${idx}" style="cursor:pointer;padding:8px 10px"><span>${etiquetaColaborador(item)}</span></div>`
        ).join("")
      : '<p class="hint" style="margin:0">No hay colaboradores disponibles en el catálogo local.</p>';

    lista.querySelectorAll("[data-index]").forEach((el) => {
      el.addEventListener("mousedown", (event) => {
        event.preventDefault();
        const item = visibles[Number(el.dataset.index)];
        colaboradorSeleccionado = item;
        buscar.value = "";
        lista.innerHTML = "";
        nombreEl.textContent = item.nombre || item.empleadoNombre || "Sin nombre";
        const codigo = item.codigo || item.docid || item.id || "—";
        codigoEl.textContent = codigo;
        siguienteRevision = calcularSiguienteRevision(codigo);
        revisionEl.textContent = String(siguienteRevision);
        estado(null, "Selecciona los criterios que no cumplen y guarda la evaluación.");
      });
    });
  }

  async function cargarSemana() {
    try {
      const semanas = await OfflineDb.getAll("semanas");
      semanaActual = SyncEngine.semanaQueContiene(semanas, new Date());
      semanaActualEl.textContent = semanaActual
        ? `Semana ${semanaActual.semana} de ${semanaActual.ano}`
        : "Sin calendario descargado";
    } catch {
      semanaActual = null;
      semanaActualEl.textContent = "Sin calendario descargado";
    }
  }

  async function cargarColaboradores() {
    try {
      const catalogo = await SyncEngine.obtenerCatalogoCalidadLocal();
      colaboradores = (catalogo.colaboradores || []).filter(
        (item) => item.activo !== false && item.retirado !== 1 && item.retirado !== true
      );
    } catch {
      colaboradores = [];
    }
  }

  async function sincronizar() {
    try {
      await SyncEngine.sincronizarCatalogoCalidad();
      await cargarColaboradores();
      await cargarSemana();
      apiStatus.textContent = "En línea";
      apiStatus.classList.remove("warn");
      apiStatus.classList.add("ok");
      estado("ok", "Catálogo de colaboradores actualizado.");
    } catch {
      apiStatus.textContent = "Sin conexión";
      apiStatus.classList.remove("ok");
      apiStatus.classList.add("warn");
      estado("warning", "No fue posible actualizar el catálogo. Se usarán los datos guardados en este equipo.");
    }
  }

  function guardarEvaluacion() {
    if (!colaboradorSeleccionado) {
      estado("error", "Selecciona un colaborador antes de guardar.");
      return;
    }

    const codigo = colaboradorSeleccionado.codigo || colaboradorSeleccionado.docid || colaboradorSeleccionado.id;
    const incumplimientos = [...document.querySelectorAll("#auxCriteriosLista input:checked")].map((x) => Number(x.value));

    const registros = registrosLocales();
    registros.push({
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      rol: rolActivo,
      rolNombre: nombreRol(),
      fecha: new Date().toISOString(),
      semana: semanaActual?.semana || 0,
      asegurador: sesionAux?.username || "",
      colaborador: String(codigo),
      revision: siguienteRevision || calcularSiguienteRevision(codigo),
      incumplimientos,
      estado: "Local",
    });
    guardarRegistrosLocales(registros);

    estado("ok", `Revisión #${siguienteRevision || 1} de ${colaboradorSeleccionado.nombre || "colaborador"} guardada localmente.`);
    limpiar();
  }

  async function activarRol(rol) {
    rolActivo = ROLES[rol] ? rol : "garruchero";
    limpiar();
    evaluadorNombre.textContent = sesionAux?.empleadoNombre || sesionAux?.username || "Usuario actual";
    renderCriterios();
    await cargarSemana();
    await cargarColaboradores();
    estado(null, "Selecciona un colaborador para iniciar una evaluación.");
  }

  buscar.addEventListener("focus", () => renderLista(buscar.value));
  buscar.addEventListener("input", () => renderLista(buscar.value));
  guardarBtn.addEventListener("click", guardarEvaluacion);

  document.addEventListener("click", (event) => {
    if (event.target !== buscar && !lista.contains(event.target)) lista.innerHTML = "";
  });

  renderCriterios();

  window.CalidadCorteAux = {
    activarRol,
    sincronizar,
  };
})();
