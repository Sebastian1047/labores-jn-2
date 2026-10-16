// Panel visual de Tiempos, reutilizable en los seis módulos de rendimiento.
// Mantiene las estructuras y tiendas locales de cada módulo; no afirma sincronización remota.
(function () {
  "use strict";

  const modulo = location.pathname.split("/").pop().replace(".html", "");
  const opciones = {
    "bandejas-enraizamiento": { titulo: "Bandejas de enraizamiento", tienda: "bandejasTiempos", empleado: "sembrador", nombre: "sembradorNombre" },
    "corte": { titulo: "Corte", tienda: "corteTiempos", empleado: "colaborador", nombre: "colaboradorNombre", roles: true },
    "desbotonado-mallas": { titulo: "Desbotón y mallas", tienda: "desbotonadoMallasTiempos", empleado: "colaborador", nombre: "colaboradorNombre" },
    "preparacion-camas": { titulo: "Preparación de camas", tienda: "preparacionCamasTiempos", empleado: "colaborador", nombre: "colaboradorNombre" },
    "poscosecha-modulo": { titulo: "Poscosecha", tienda: "poscosechaRendimientoTiempos", empleado: "colaborador", nombre: "colaboradorNombre", roles: true },
    "mipe-modulo": { titulo: "MIPE", tienda: "mipeRendimientoTiempos", empleado: "colaborador", nombre: "colaboradorNombre", roles: true }
  };
  const cfg = opciones[modulo];
  if (!cfg) return;

  const CAMPOS = [
    ["horasLaboralesMin", "Tiempo programado"],
    ["horasExtraMin", "Horas extra"],
    ["pAbuelasMin", "Plantas abuelas"],
    ["pMadresMin", "Plantas madres"],
    ["pausasMin", "Pausas"],
    ["incapacidadMin", "Incapacidad"],
    ["cambioLaborMin", "Cambio de labor"],
    ["capacitacionMin", "Capacitación"],
    ["vacacionesMin", "Vacaciones"],
    ["examenMedicoMin", "Examen médico"],
    ["otrosMin", "Otros"]
  ];
  const DESCUENTOS = CAMPOS.slice(2).map((c) => c[0]);
  const escape = (s) => String(s ?? "").replace(/&/g, "&amp;")
    .replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  const codigo = (e) => String(e.codigo ?? e.Codigo ?? e.docid ?? e.id ?? "").trim();
  const nombre = (e) => String(e.nombre ?? e.Nombre ?? e.empleadoNombre ?? e.descripcion ?? codigo(e)).trim();
  const enCola = (r) => r.syncStatus && r.syncStatus !== "Sincronizado";
  const horas = (min) => TiemposLaboresJN.formatearHoras(min);

  function arrancar() {
    const vista = document.getElementById("vistaTiempos");
    const fechaPrincipal = document.getElementById("fecha");
    if (!vista || !fechaPrincipal || typeof OfflineDb === "undefined" || typeof SyncEngine === "undefined" || !window.TiemposLaboresJN) return;
    const original = document.createElement("div");
    original.hidden = true;
    original.className = "tp-original-oculto";
    while (vista.firstChild) original.appendChild(vista.firstChild);
    vista.appendChild(original);

    const panel = document.createElement("div");
    panel.className = "tp-panel";
    const entradas = CAMPOS.map(([id, etiqueta]) =>
      '<label class="tp-campo"><span>' + escape(etiqueta) + '</span>' +
      '<input type="text" inputmode="decimal" autocomplete="off" data-tp-campo="' + id +
      '" value="' + (id === "horasLaboralesMin" ? escape(TiemposLaboresJN.horasJornada(fechaPrincipal.value)) : "0") +
      '" aria-label="' + escape(etiqueta) + ' en horas decimales"></label>'
    ).join("");

    panel.innerHTML =
      '<section class="tp-cabecera">' +
        '<div><h2>Tiempos de ' + escape(cfg.titulo.toLowerCase()) + '</h2>' +
        '<p>Registra los tiempos diarios de los colaboradores.</p></div>' +
      '</section>' +
      '<section class="tp-tarjeta tp-personas">' +
        '<div class="tp-busqueda"><input id="tpBuscar" type="search" placeholder="Buscar por nombre o código…" autocomplete="off">' +
          '<div class="tp-filtros">' +
            '<button type="button" class="active" data-tp-filtro="pendientes">Pendientes</button>' +
            '<button type="button" data-tp-filtro="guardados">Guardados</button>' +
          '</div></div>' +
        '<div class="tp-seleccion"><span id="tpCantidad">0 empleados seleccionados</span>' +
          '<label><input type="checkbox" id="tpSeleccionarTodos"> Seleccionar visibles</label></div>' +
        '<div id="tpEmpleados" class="tp-empleados" role="group" aria-label="Colaboradores"></div>' +
      '</section>' +
      '<section class="tp-tarjeta"><h3>Registrar tiempo</h3>' +
        '<p class="tp-ayuda">Horas decimales: 0,5 equivale a 30 minutos. Los descuentos no pueden superar el tiempo disponible.</p>' +
        '<div class="tp-campos">' + entradas + '</div>' +
        '<label class="tp-observaciones"><span>Observaciones</span><textarea id="tpObservaciones" rows="3"></textarea></label>' +
        '<div class="tp-resumen" aria-live="polite"><span>Tiempo disponible: <b id="tpDisponible">0 h</b></span>' +
          '<span>Tiempo efectivo: <b id="tpReal">0 h</b></span></div>' +
        '<div class="tp-acciones">' +
          '<button type="button" class="tp-guardar" data-tp-accion="guardar">✓ Guardar tiempos</button>' +
          '<button type="button" data-tp-accion="limpiar">Limpiar campos</button>' +
        '</div><p class="tp-mensaje" id="tpMensaje" role="status" aria-live="polite"></p>' +
      '</section>' +
      '<details class="tp-detalle-cola"><summary>Registros pendientes de sincronización <span id="tpTotalCola">0</span></summary>' +
        '<div id="tpCola"></div><p class="tp-ayuda">Los tiempos se guardan en este equipo. El envío al servidor no está disponible hasta contar con una API de sincronización.</p>' +
      '</details>';
    vista.appendChild(panel);

    const buscar = panel.querySelector("#tpBuscar");
    const lista = panel.querySelector("#tpEmpleados");
    const checks = panel.querySelector("#tpSeleccionarTodos");
    const vistaNombre = document.querySelector("[data-corte-rol].active")?.dataset.corteRol;
    const estado = { empleados: [], guardados: [], seleccionados: new Set(), filtro: "pendientes", rol: "" };
    const rol = () => {
      if (modulo === "corte") return document.querySelector("[data-corte-rol].active")?.dataset.corteRol || new URLSearchParams(location.search).get("rol") || "cortador";
      return new URLSearchParams(location.search).get("rol") || "";
    };
    estado.rol = vistaNombre || rol();

    const getCampo = (id) => panel.querySelector('[data-tp-campo="' + id + '"]');
    const registroDe = (e) => estado.guardados.find((r) => String(r[cfg.empleado]) === codigo(e) && r.fecha === fechaPrincipal.value);
    const estadoDe = (e) => registroDe(e) ? "guardado" : "pendiente";
    function visibles() {
      const q = buscar.value.trim().toLocaleLowerCase("es");
      return estado.empleados.filter((e) => {
        const coincide = (nombre(e) + " " + codigo(e)).toLocaleLowerCase("es").includes(q);
        return coincide && estadoDe(e) === (estado.filtro === "guardados" ? "guardado" : "pendiente");
      });
    }
    function seleccion() {
      panel.querySelector("#tpCantidad").textContent = estado.seleccionados.size + " colaboradores seleccionados";
      const actuales = visibles();
      checks.checked = actuales.length > 0 && actuales.every((e) => estado.seleccionados.has(codigo(e)));
      checks.indeterminate = actuales.some((e) => estado.seleccionados.has(codigo(e))) && !checks.checked;
    }
    function pintar() {
      const actuales = visibles();
      lista.innerHTML = actuales.length ? actuales.map((e) => {
        const id = codigo(e), tipo = estadoDe(e);
        return '<label class="tp-persona"><input type="checkbox" data-tp-empleado="' + escape(id) +
          '"' + (estado.seleccionados.has(id) ? ' checked' : '') + '>' +
          '<span><b>' + escape(nombre(e)) + '</b><small>' + escape(id) + '</small></span>' +
          '<em class="tp-etiqueta tp-' + tipo + '">' + tipo.toUpperCase() + '</em></label>';
      }).join("") : '<p class="tp-vacio">No hay colaboradores para este filtro. Cambia de filtro para ver los demás.</p>';
      panel.querySelectorAll("[data-tp-filtro]").forEach((b) => b.classList.toggle("active", b.dataset.tpFiltro === estado.filtro));
      seleccion();
      const porFecha = estado.guardados.filter((r) => r.fecha === fechaPrincipal.value);
      const cola = porFecha.filter(enCola);
      panel.querySelector("#tpTotalCola").textContent = "(" + cola.length + ")";
      panel.querySelector("#tpCola").innerHTML = cola.length
        ? cola.slice(0, 30).map((r) => '<div class="tp-cola-fila"><b>' + escape(r[cfg.nombre] || r[cfg.empleado]) +
          '</b><span>' + escape(r.fecha) + ' · ' + escape(horas(r.tiempoRealMin)) + ' h · En cola local</span></div>').join("")
        : '<p class="tp-vacio">No hay registros pendientes.</p>';
    }
    const reporte = (texto, error = false) => {
      const nodo = panel.querySelector("#tpMensaje");
      nodo.textContent = texto;
      nodo.classList.toggle("tp-error", error);
    };
    function detalles() {
      const datos = {};
      const inputs = CAMPOS.map(([id]) => getCampo(id));
      for (const [id] of CAMPOS) {
        const input = getCampo(id), valor = input.value.trim();
        if (valor && !/^\d+(?:[.,]\d+)?$/.test(valor)) throw new Error("Revisa el valor de " + input.getAttribute("aria-label") + ".");
        datos[id] = TiemposLaboresJN.leerMinutos(input);
      }
      const disponible = datos.horasLaboralesMin + datos.horasExtraMin;
      const descontado = DESCUENTOS.reduce((total, id) => total + datos[id], 0);
      if (disponible <= 0) throw new Error("Ingresa el tiempo programado o las horas extra.");
      if (descontado > disponible) throw new Error("Las actividades descontadas superan las horas disponibles.");
      const aviso = TiemposLaboresJN.validar(inputs);
      if (aviso) throw new Error(aviso);
      return { ...datos, otrasLaboresMin: descontado,
        tiempoDisponibleMin: disponible, tiempoRealMin: disponible - descontado,
        desplazamientoMin: 0, calisteniaMin: 0,
        observaciones: panel.querySelector("#tpObservaciones").value.trim() };
    }
    function calcular() {
      const disponibles = TiemposLaboresJN.leerMinutos(getCampo("horasLaboralesMin")) +
        TiemposLaboresJN.leerMinutos(getCampo("horasExtraMin"));
      const descontados = DESCUENTOS.reduce((sum, id) => sum + TiemposLaboresJN.leerMinutos(getCampo(id)), 0);
      panel.querySelector("#tpDisponible").textContent = horas(disponibles) + " h";
      panel.querySelector("#tpReal").textContent = horas(Math.max(0, disponibles - descontados)) + " h";
    }
    function limpiar() {
      CAMPOS.forEach(([id]) => { getCampo(id).value = id === "horasLaboralesMin" ? TiemposLaboresJN.horasJornada(fechaPrincipal.value) : "0"; });
      panel.querySelector("#tpObservaciones").value = "";
      calcular();
    }
    function guardarRegistro(e, datos) {
      const id = codigo(e);
      const existente = registroDe(e);
      if (existente && existente.syncStatus === "Sincronizado") {
        throw new Error("Ya existe un registro sincronizado para " + nombre(e) + ". No se sobrescribirá.");
      }
      const r = {
        ...(existente || {}),
        ...datos,
        id: existente?.id || SyncEngine.generarUUID(),
        fecha: fechaPrincipal.value,
        [cfg.empleado]: id,
        [cfg.nombre]: nombre(e),
        syncStatus: "PendienteBackend",
        usuario: JSON.parse(sessionStorage.getItem("labores_usuario") || "null")?.username || "",
        createdAt: existente?.createdAt || new Date().toISOString()
      };
      if (cfg.roles) {
        r.rol = estado.rol;
        r.rolNombre = modulo === "corte"
          ? ({ cortador: "Cortador", garruchero: "Transportador", recogedor: "Recogedor" }[estado.rol] || estado.rol)
          : estado.rol;
        if (modulo === "mipe-modulo") r.area = "MIPE";
        if (modulo === "poscosecha-modulo") r.area = "Poscosecha";
      }
      if (modulo === "mipe-modulo") {
        r.bloque = document.getElementById("bloque")?.value || "";
        r.cama = document.getElementById("cama")?.value || "";
      }
      return r;
    }
    async function cargar() {
      try {
        const catalogos = await SyncEngine.obtenerCatalogosLocal();
        const unicos = new Map();
        (catalogos.empleados || []).forEach((e) => {
          if (e.activo === false || e.retirado === 1 || e.retirado === true) return;
          if (codigo(e)) unicos.set(codigo(e), e);
        });
        estado.empleados = [...unicos.values()].sort((a, b) => nombre(a).localeCompare(nombre(b), "es"));
        estado.guardados = (await OfflineDb.getAll(cfg.tienda)).filter((r) => !cfg.roles || r.rol === estado.rol);
        pintar();
      } catch (err) {
        reporte("No se pudo cargar el catálogo o los tiempos: " + err.message, true);
      }
    }

    // Una única fecha (la del encabezado) y un único buscador visible en Tiempos.
    const origenBuscar = document.querySelector("#sembradorBuscar, #desbotonadorBuscar, #colaboradorBuscar");
    origenBuscar?.parentElement?.classList.add("tp-colaborador-origen");
    function sincronizarVista() {
      document.body.classList.toggle("tp-vista-activa", !vista.hidden && vista.getClientRects().length > 0);
    }
    document.querySelectorAll("[data-bandejas-vista], [data-corte-vista], [data-desbotonado-vista], [data-preparacion-vista], [data-poscosecha-vista], [data-mipe-vista]")
      .forEach((btn) => btn.addEventListener("click", () => setTimeout(sincronizarVista, 0)));
    setTimeout(sincronizarVista, 0);

    fechaPrincipal.addEventListener("change", () => {
      estado.seleccionados.clear();
      limpiar();
      pintar();
    });

    buscar.addEventListener("input", pintar);
    checks.addEventListener("change", () => {
      visibles().forEach((e) => checks.checked ? estado.seleccionados.add(codigo(e)) : estado.seleccionados.delete(codigo(e)));
      pintar();
    });
    lista.addEventListener("change", (event) => {
      const input = event.target.closest("[data-tp-empleado]");
      if (!input) return;
      input.checked ? estado.seleccionados.add(input.dataset.tpEmpleado) : estado.seleccionados.delete(input.dataset.tpEmpleado);
      seleccion();
    });
    panel.querySelectorAll("[data-tp-filtro]").forEach((button) => button.addEventListener("click", () => {
      estado.filtro = button.dataset.tpFiltro;
      pintar();
    }));
    panel.querySelectorAll("[data-tp-campo]").forEach((input) => input.addEventListener("input", calcular));

    // Guardar aplica directamente los tiempos a la selección.
    panel.querySelector("[data-tp-accion='guardar']").addEventListener("click", async () => {
      const button = panel.querySelector("[data-tp-accion='guardar']");
      if (button.disabled) return;
      if (!fechaPrincipal.value) return reporte("Selecciona la fecha de la jornada.", true);
      if (!estado.seleccionados.size) return reporte("Selecciona al menos un colaborador.", true);
      try {
        const datos = detalles();
        const seleccionados = [...estado.seleccionados]
          .map((id) => estado.empleados.find((e) => codigo(e) === id))
          .filter(Boolean);
        if (!seleccionados.length) return reporte("No hay colaboradores válidos seleccionados.", true);
        if (seleccionados.some((e) => registroDe(e)?.syncStatus === "Sincronizado")) {
          return reporte("No se pueden sustituir registros sincronizados. Desmarca esos colaboradores.", true);
        }
        const repetidos = seleccionados.filter((e) => registroDe(e));
        if (repetidos.length && !window.confirm(
          "Hay " + repetidos.length + " colaborador(es) con tiempos guardados para esta fecha. ¿Actualizar sus registros locales?"
        )) return;
        button.disabled = true;
        let guardados = 0;
        for (const e of seleccionados) {
          const registro = guardarRegistro(e, datos);
          await OfflineDb.put(cfg.tienda, registro);
          guardados++;
        }
        estado.seleccionados.clear();
        await cargar();
        reporte(guardados + " registro(s) guardado(s) en este equipo. Su sincronización con el servidor continúa pendiente.");
      } catch (err) {
        reporte("No se completó el guardado: " + err.message, true);
        await cargar();
      } finally {
        button.disabled = false;
        pintar();
      }
    });
    panel.querySelector("[data-tp-accion='limpiar']").addEventListener("click", () => {
      limpiar();
      reporte("Campos limpiados. Los registros guardados se conservan.");
    });

    // Corte puede cambiar de rol sin cambiar de página. Mantener cada cola por rol.
    document.addEventListener("click", (event) => {
      if (modulo !== "corte" || !event.target.closest("[data-corte-rol]")) return;
      setTimeout(() => {
        const nuevo = rol();
        if (nuevo === estado.rol) return;
        estado.rol = nuevo;
        estado.seleccionados.clear();
        reporte("");
        cargar();
      }, 0);
    });
    limpiar();
    cargar();
    setTimeout(() => cargar(), 1100); // los demás módulos pueden cargar el catálogo de forma asíncrona
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", arrancar, { once: true });
  else arrancar();
})();
