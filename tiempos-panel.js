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
        '<div class="tp-cabecera-acciones"><label>Fecha<input type="date" id="tpFecha"></label>' +
        '<button type="button" data-tp-accion="refrescar">Refrescar</button>' +
        '<button type="button" class="tp-dorado" data-tp-accion="reiniciar">↻ Reiniciar</button></div>' +
      '</section>' +
      '<div class="tp-contadores" id="tpContadores">' +
        '<div><span>PENDIENTES</span><strong>0</strong></div><div><span>APLICADOS</span><strong>0</strong></div>' +
        '<div><span>EN COLA</span><strong>0</strong></div><div><span>GUARDADOS</span><strong>0</strong></div>' +
      '</div>' +
      '<section class="tp-tarjeta tp-personas">' +
        '<div class="tp-busqueda"><input id="tpBuscar" type="search" placeholder="Buscar por nombre o código…" autocomplete="off">' +
          '<div class="tp-filtros">' +
            '<button type="button" class="active" data-tp-filtro="todos">Todos</button>' +
            '<button type="button" data-tp-filtro="pendientes">Pendientes</button>' +
            '<button type="button" data-tp-filtro="guardados">Guardados</button>' +
            '<button type="button" data-tp-filtro="temporales">Temporales</button>' +
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
          '<button type="button" data-tp-accion="aplicar">+ Aplicar</button>' +
          '<button type="button" class="tp-guardar" data-tp-accion="guardar">✓ Guardar</button>' +
          '<button type="button" data-tp-accion="limpiar">Limpiar</button>' +
          '<button type="button" class="tp-peligro" data-tp-accion="limpiar-aplicado">Limpiar aplicado</button>' +
        '</div><p class="tp-mensaje" id="tpMensaje" role="status" aria-live="polite"></p>' +
      '</section>' +
      '<section class="tp-tarjeta tp-cola"><h3>Pendientes por sincronizar</h3>' +
        '<div id="tpCola"></div><p class="tp-ayuda">Los registros de Tiempos se conservan en este equipo; no se confirma envío al servidor sin una API de sincronización disponible.</p>' +
      '</section>';
    vista.appendChild(panel);

    const buscar = panel.querySelector("#tpBuscar");
    const fecha = panel.querySelector("#tpFecha");
    const lista = panel.querySelector("#tpEmpleados");
    const contadores = [...panel.querySelector("#tpContadores").children];
    const checks = panel.querySelector("#tpSeleccionarTodos");
    const vistaNombre = document.querySelector("[data-corte-rol].active")?.dataset.corteRol;
    const estado = { empleados: [], guardados: [], aplicados: new Map(), seleccionados: new Set(), filtro: "todos", rol: "" };
    const rol = () => {
      if (modulo === "corte") return document.querySelector("[data-corte-rol].active")?.dataset.corteRol || new URLSearchParams(location.search).get("rol") || "cortador";
      return new URLSearchParams(location.search).get("rol") || "";
    };
    estado.rol = vistaNombre || rol();

    const getCampo = (id) => panel.querySelector('[data-tp-campo="' + id + '"]');
    const registroDe = (e) => estado.guardados.find((r) => String(r[cfg.empleado]) === codigo(e) && r.fecha === fecha.value);
    const estadoDe = (e) => estado.aplicados.has(codigo(e)) ? "temporal" : (registroDe(e) ? "guardado" : "pendiente");
    function visibles() {
      const q = buscar.value.trim().toLocaleLowerCase("es");
      return estado.empleados.filter((e) => {
        const coincide = (nombre(e) + " " + codigo(e)).toLocaleLowerCase("es").includes(q);
        return coincide && (estado.filtro === "todos" ||
          (estado.filtro === "pendientes" && estadoDe(e) === "pendiente") ||
          (estado.filtro === "guardados" && estadoDe(e) === "guardado") ||
          (estado.filtro === "temporales" && estadoDe(e) === "temporal"));
      });
    }
    function seleccion() {
      panel.querySelector("#tpCantidad").textContent = estado.seleccionados.size + " empleados seleccionados";
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
      }).join("") : '<p class="tp-vacio">No hay colaboradores para este filtro. Puedes usar Refrescar para actualizar el catálogo.</p>';
      panel.querySelectorAll("[data-tp-filtro]").forEach((b) => b.classList.toggle("active", b.dataset.tpFiltro === estado.filtro));
      seleccion();
      const porFecha = estado.guardados.filter((r) => r.fecha === fecha.value);
      const cola = porFecha.filter(enCola);
      const valores = [
        estado.empleados.filter((e) => estadoDe(e) === "pendiente").length,
        estado.aplicados.size,
        cola.length,
        porFecha.length
      ];
      contadores.forEach((c, i) => c.querySelector("strong").textContent = String(valores[i]));
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
      CAMPOS.forEach(([id]) => { getCampo(id).value = id === "horasLaboralesMin" ? TiemposLaboresJN.horasJornada(fecha.value) : "0"; });
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
        fecha: fecha.value,
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
    async function cargar(actualizarCatalogo = false) {
      try {
        if (actualizarCatalogo && navigator.onLine) {
          try { await SyncEngine.sincronizarCatalogos(); } catch (_) { /* conservar datos locales */ }
        }
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
    function reiniciar() {
      estado.aplicados.clear();
      estado.seleccionados.clear();
      buscar.value = "";
      estado.filtro = "todos";
      limpiar();
      reporte("Formulario reiniciado; los registros guardados no se borraron.");
      pintar();
    }

    fecha.value = fechaPrincipal.value || new Date().toISOString().slice(0, 10);
    fecha.addEventListener("change", () => {
      fechaPrincipal.value = fecha.value;
      fechaPrincipal.dispatchEvent(new Event("change", { bubbles: true }));
      estado.aplicados.clear();
      estado.seleccionados.clear();
      limpiar();
      pintar();
    });
    fechaPrincipal.addEventListener("change", () => {
      if (fecha.value !== fechaPrincipal.value) {
        fecha.value = fechaPrincipal.value;
        estado.aplicados.clear();
        estado.seleccionados.clear();
        limpiar();
        pintar();
      }
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

    panel.querySelector("[data-tp-accion='aplicar']").addEventListener("click", () => {
      try {
        if (!estado.seleccionados.size) throw new Error("Selecciona al menos un colaborador.");
        const data = detalles();
        estado.seleccionados.forEach((id) => estado.aplicados.set(id, { ...data }));
        reporte("Tiempos aplicados temporalmente a " + estado.seleccionados.size + " colaborador(es). Pulsa Guardar para registrarlos.");
        pintar();
      } catch (err) { reporte(err.message, true); }
    });
    panel.querySelector("[data-tp-accion='guardar']").addEventListener("click", async () => {
      const button = panel.querySelector("[data-tp-accion='guardar']");
      if (button.disabled) return;
      try {
        // Si se pulsa Guardar sin aplicar primero, se aplica a la selección actual.
        if (!estado.aplicados.size && estado.seleccionados.size) {
          const data = detalles();
          estado.seleccionados.forEach((id) => estado.aplicados.set(id, { ...data }));
        }
        if (!estado.aplicados.size) throw new Error("Selecciona colaboradores y pulsa Aplicar primero.");
        button.disabled = true;
        const listaGuardar = [...estado.aplicados.entries()];
        let guardados = 0;
        for (const [id, datos] of listaGuardar) {
          const e = estado.empleados.find((c) => codigo(c) === id);
          if (!e) continue;
          const r = guardarRegistro(e, datos);
          await OfflineDb.put(cfg.tienda, r);
          estado.aplicados.delete(id);
          guardados++;
        }
        estado.seleccionados.clear();
        await cargar();
        reporte(guardados + " registro(s) guardado(s) localmente; quedan en cola mientras no exista sincronización de Tiempos con el servidor.");
      } catch (err) {
        reporte("No se completó el guardado: " + err.message, true);
      } finally {
        button.disabled = false;
        pintar();
      }
    });
    panel.querySelector("[data-tp-accion='limpiar']").addEventListener("click", () => { limpiar(); reporte("Campos limpiados. Los tiempos aplicados y guardados se conservan."); });
    panel.querySelector("[data-tp-accion='limpiar-aplicado']").addEventListener("click", () => {
      const ids = estado.seleccionados.size ? [...estado.seleccionados] : [...estado.aplicados.keys()];
      ids.forEach((id) => estado.aplicados.delete(id));
      reporte("Se limpiaron " + ids.length + " tiempos aplicados temporalmente. No se eliminaron registros guardados.");
      pintar();
    });
    panel.querySelector("[data-tp-accion='reiniciar']").addEventListener("click", reiniciar);
    panel.querySelector("[data-tp-accion='refrescar']").addEventListener("click", () => cargar(true));

    // Corte puede cambiar de rol sin cambiar de página. Mantener cada cola por rol.
    document.addEventListener("click", (event) => {
      if (modulo !== "corte" || !event.target.closest("[data-corte-rol]")) return;
      setTimeout(() => {
        const nuevo = rol();
        if (nuevo === estado.rol) return;
        estado.rol = nuevo;
        estado.aplicados.clear();
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
