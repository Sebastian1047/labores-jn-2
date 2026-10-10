(() => {
  const sesionAux = JSON.parse(sessionStorage.getItem("labores_usuario") || "null");
  const ROLES = {
    garruchero: "Transportador",
    recogedor: "Recogedor",
  };

  const CRITERIOS_POR_ROL = {
    // Transportador conserva temporalmente la réplica de Pompón.
    garruchero: [
      { id: 2, nombre: "Cuidado de Ramos Campo" },
      { id: 3, nombre: "Hidratación en Balde" },
      { id: 4, nombre: "Cantidad de Ramos en Balde" },
      { id: 5, nombre: "Cuidado de Ramos Poscosecha" },
      { id: 6, nombre: "Descargue de Flor en Sala" },
      { id: 7, nombre: "EE PP" },
    ],
    recogedor: [
      { id: 1, nombre: "Conforme" },
      { id: 3, nombre: "Cuidado de Ramos" },
      { id: 4, nombre: "Marcación de etiquetas" },
      { id: 5, nombre: "Cantidad" },
      { id: 6, nombre: "Hidratación en Balde" },
      { id: 7, nombre: "Mezcla de Medidas" },
      { id: 8, nombre: "Ramos en la Malla Caminos" },
      { id: 9, nombre: "Desplazamiento de Baldes" },
      { id: 10, nombre: "Acuerdos de Oro" },
    ],
  };


  const SUBITEMS_TRANSPORTADOR = {
    3: ["Balde sin solución inicial", "Tallos sin contacto con solución"],
  };

  const ITEMS_NUMERICOS_TRANSPORTADOR = new Set([2, 6]);

  function esItemConformeAux(item) {
    return String(item?.nombre || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .includes("conforme");
  }

  function escaparAux(valor) {
    return String(valor ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function campoSeleccionXAux(item, subitem = "") {
    const etiqueta = subitem || item.nombre;
    return `<label class="calidad-item-x-row">
      <span class="calidad-item-x-label">${escaparAux(etiqueta)}</span>
      <input class="calidad-item-x-input aux-item-x-input" type="checkbox"
        data-item-id="${item.id}" data-item-nombre="${escaparAux(item.nombre)}" data-subitem="${escaparAux(subitem)}"
        aria-label="Marcar incumplimiento: ${escaparAux(etiqueta)}" />
      <span class="calidad-item-x-box" aria-hidden="true">×</span>
    </label>`;
  }

  function campoFallosAux(item, subitem = "") {
    const etiqueta = subitem || item.nombre;
    return `<label class="calidad-fallo-row">
      <span class="calidad-fallo-label">${escaparAux(etiqueta)}</span>
      <input class="calidad-fallos-input" type="number" min="0" step="1" inputmode="numeric" value="0"
        data-item-id="${item.id}" data-item-nombre="${escaparAux(item.nombre)}" data-subitem="${escaparAux(subitem)}"
        aria-label="Fallos: ${escaparAux(etiqueta)}" />
    </label>`;
  }

  function obtenerFallosDetalleAux() {
    const numericos = [...document.querySelectorAll("#auxCriteriosLista .calidad-fallos-input")]
      .map((input) => ({
        idItem: Number(input.dataset.itemId),
        item: input.dataset.itemNombre || "",
        subitem: input.dataset.subitem || "",
        cantidad: Math.max(0, Math.floor(Number(input.value) || 0)),
      }))
      .filter((detalle) => detalle.cantidad > 0);

    const marcados = [...document.querySelectorAll("#auxCriteriosLista .aux-item-x-input:checked")]
      .map((input) => ({
        idItem: Number(input.dataset.itemId),
        item: input.dataset.itemNombre || "",
        subitem: input.dataset.subitem || "",
        cantidad: 1,
        marcadoX: true,
      }));

    return [...numericos, ...marcados];
  }

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
  const observacionesEl = document.querySelector("#auxObservaciones");
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

  function configurarConformeAux() {
    const conforme = criteriosLista.querySelector(".calidad-conforme-input");
    if (!conforme) return;

    const aplicar = () => {
      const activo = conforme.checked;
      criteriosLista.querySelectorAll(".calidad-fallos-input").forEach((input) => {
        if (activo) input.value = "0";
        input.disabled = activo;
      });
      criteriosLista.querySelectorAll(".aux-item-x-input").forEach((input) => {
        if (activo) input.checked = false;
        input.disabled = activo;
      });
      criteriosLista.querySelectorAll(".calidad-item-fallos:not(.calidad-item-conforme)").forEach((item) => {
        item.classList.toggle("calidad-item-deshabilitado", activo);
      });
    };

    conforme.addEventListener("change", aplicar);
    aplicar();
  }

  function renderCriterios() {
    const criterios = CRITERIOS_POR_ROL[rolActivo] || [];
    criteriosLista.classList.add("calidad-criterios-numericos");
    criteriosLista.innerHTML = criterios.map((item) => {
      if (esItemConformeAux(item)) {
        return `<section class="calidad-item-fallos calidad-item-conforme">
          <label class="calidad-conforme-selector">
            <input class="calidad-conforme-input" type="checkbox" aria-label="${escaparAux(item.nombre)}" />
            <span class="calidad-conforme-circulo" aria-hidden="true"></span>
            <span class="calidad-conforme-texto">${escaparAux(item.nombre)}</span>
          </label>
        </section>`;
      }

      if (rolActivo === "garruchero") {
        const subitems = SUBITEMS_TRANSPORTADOR[item.id] || [];
        if (subitems.length) {
          return `<section class="calidad-item-fallos">
            <div class="calidad-item-fallos-titulo">${escaparAux(item.nombre)}</div>
            <div class="calidad-subitems-fallos">${subitems.map((subitem) => campoFallosAux(item, subitem)).join("")}</div>
          </section>`;
        }
        if (ITEMS_NUMERICOS_TRANSPORTADOR.has(item.id)) {
          return `<section class="calidad-item-fallos calidad-item-fallos-simple">${campoFallosAux(item)}</section>`;
        }
        return `<section class="calidad-item-fallos calidad-item-x">${campoSeleccionXAux(item)}</section>`;
      }

      return `<section class="calidad-item-fallos calidad-item-fallos-simple">${campoFallosAux(item)}</section>`;
    }).join("");
    configurarConformeAux();
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
    const conforme = criteriosLista.querySelector(".calidad-conforme-input");
    if (conforme) conforme.checked = false;
    criteriosLista.querySelectorAll(".calidad-fallos-input").forEach((item) => {
      item.value = "0";
      item.disabled = false;
    });
    criteriosLista.querySelectorAll(".aux-item-x-input").forEach((item) => {
      item.checked = false;
      item.disabled = false;
    });
    criteriosLista.querySelectorAll(".calidad-item-fallos").forEach((item) => {
      item.classList.remove("calidad-item-deshabilitado");
    });
    if (observacionesEl) observacionesEl.value = "";
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
        estado(null, "Registra la cantidad de fallos encontrados y guarda la evaluación.");
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
    const conformeSeleccionado = Boolean(criteriosLista.querySelector(".calidad-conforme-input:checked"));
    const fallosDetalle = obtenerFallosDetalleAux();
    const incumplimientos = [...new Set(fallosDetalle.map((detalle) => detalle.idItem))];

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
      fallosDetalle,
      conformeSeleccionado,
      observaciones: observacionesEl?.value.trim() || "",
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
