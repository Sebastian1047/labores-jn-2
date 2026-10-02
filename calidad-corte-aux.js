(() => {
  const sesionAux = JSON.parse(sessionStorage.getItem("labores_usuario") || "null");
  const ROLES = {
    garruchero: "Transportador",
    recogedor: "Recogedor",
  };

  const vistaAuxiliar = document.querySelector("#vistaAuxiliar");
  const evaluadorNombre = document.querySelector("#auxEvaluadorNombre");
  const semanaActualEl = document.querySelector("#auxSemanaActual");
  const revisionEl = document.querySelector("#auxRevision");
  const rolEtiqueta = document.querySelector("#auxRolEtiqueta");
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

  function nombreRol() {
    return ROLES[rolActivo] || "Colaborador";
  }

  function nombreRolMinuscula() {
    return nombreRol().toLowerCase();
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

  function limpiar() {
    colaboradorSeleccionado = null;
    buscar.value = "";
    lista.innerHTML = "";
    nombreEl.textContent = `Sin ${nombreRolMinuscula()} seleccionado`;
    codigoEl.textContent = "—";
    revisionEl.textContent = "Selecciona un colaborador";
    criteriosLista.innerHTML = '<p class="hint" style="margin:0;">Criterios pendientes de configurar.</p>';
    guardarBtn.disabled = true;
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
        codigoEl.textContent = item.codigo || item.docid || item.id || "—";
        revisionEl.textContent = "Pendiente de configurar";
        estado(null, `${nombreRol()} seleccionado. Los criterios de calidad aún están pendientes de configurar.`);
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
      estado("ok", `Catálogo actualizado. Los criterios de ${nombreRol()} siguen pendientes de configurar.`);
    } catch {
      apiStatus.textContent = "Sin conexión";
      apiStatus.classList.remove("ok");
      apiStatus.classList.add("warn");
      estado("warning", "No fue posible actualizar el catálogo. Se usarán los colaboradores guardados en este equipo.");
    }
  }

  async function activarRol(rol) {
    rolActivo = ROLES[rol] ? rol : "garruchero";
    const nombre = nombreRol();
    rolEtiqueta.textContent = nombre;
    buscar.placeholder = `Buscar ${nombre.toLowerCase()} por nombre o código…`;
    limpiar();
    evaluadorNombre.textContent = sesionAux?.empleadoNombre || sesionAux?.username || "Usuario actual";
    await cargarSemana();
    await cargarColaboradores();
    estado(null, `Vista de ${nombre} lista. Los criterios de calidad están pendientes de configurar.`);
  }

  buscar.addEventListener("focus", () => renderLista(buscar.value));
  buscar.addEventListener("input", () => renderLista(buscar.value));
  document.addEventListener("click", (event) => {
    if (event.target !== buscar && !lista.contains(event.target)) lista.innerHTML = "";
  });

  window.CalidadCorteAux = {
    activarRol,
    sincronizar,
  };
})();
