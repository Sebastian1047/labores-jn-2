// Panel visual de Tiempos, reutilizable en los seis módulos de rendimiento.
// Mantiene las estructuras y tiendas locales de cada módulo; no afirma sincronización remota.
(function () {
  "use strict";

  const modulo = location.pathname.split("/").pop().replace(".html", "");
  const opciones = {
    "bandejas-enraizamiento": { titulo: "Bandejas de enraizamiento", tienda: "bandejasTiempos", empleado: "sembrador", nombre: "sembradorNombre" },
    "siembra-rendimiento": { titulo: "siembra rendimiento", tienda: "siembraRendimientoTiempos", empleado: "colaborador", nombre: "colaboradorNombre" },
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
  const enCola = (r) => r.syncStatus && !["Sincronizado", "PruebaLocal", "SoloLocal"].includes(r.syncStatus);
  const horas = (min) => TiemposLaboresJN.formatearHoras(min);

  // Lista de colaboradores añadidos desde Registrar labor, por módulo,
  // fecha y rol. Es independiente del catálogo general de empleados.
  const CLAVE_LABOR = "laboresJN:colaboradores-labor:v1:";
  function claveLabor(fecha, rol) {
    return CLAVE_LABOR + modulo + ":" + (rol || "") + ":" + (fecha || "");
  }
  function obtenerLabor(fecha, rol) {
    try {
      const guardado = JSON.parse(sessionStorage.getItem(claveLabor(fecha, rol)) || "[]");
      return Array.isArray(guardado) ? guardado : [];
    } catch (_) {
      return [];
    }
  }
  window.RegistroLaborTiemposJN = {
    agregar({ codigo: id, nombre: etiqueta, fecha, rol = "" }) {
      const colaborador = String(id ?? "").trim();
      if (!colaborador || !fecha) return;
      const guardados = obtenerLabor(fecha, rol);
      if (!guardados.some((e) => String(e.codigo) === colaborador)) {
        guardados.push({ codigo: colaborador, nombre: String(etiqueta || colaborador) });
        try { sessionStorage.setItem(claveLabor(fecha, rol), JSON.stringify(guardados)); }
        catch (error) { console.warn("No se pudo conservar la selección de Registrar labor", error); }
      }
      window.dispatchEvent(new CustomEvent("laboresjn:registro-labor", { detail: { fecha, rol } }));
    },
    // Confirmar SOLO que se guardó una labor. No crea registros en la
    // tabla de Tiempos ni marca al colaborador como "Guardado" en esa vista.
    guardarLabor({ codigo: id, nombre: etiqueta, fecha, rol = "" }) {
      if (!fecha || !id) return;
      const colaborador = String(id).trim();
      const guardados = obtenerLabor(fecha, rol);
      let entrada = guardados.find((e) => String(e.codigo) === colaborador);
      if (!entrada) {
        entrada = { codigo: colaborador, nombre: String(etiqueta || colaborador) };
        guardados.push(entrada);
      }
      // La primera labor guardada determina el inicio. Guardar más camas no
      // reinicia el estado de los tiempos ya asignados al día.
      const primeraLabor = !entrada.laborGuardadaEn;
      if (primeraLabor) {
        entrada.laborGuardadaEn = new Date().toISOString();
        try { sessionStorage.setItem(claveLabor(fecha, rol), JSON.stringify(guardados)); }
        catch (error) { console.warn("No se pudo registrar la labor en sesión", error); }
        window.dispatchEvent(new CustomEvent("laboresjn:registro-labor", {
          detail: { fecha, rol, laborGuardada: true }
        }));
      }
    }
  };

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
      '<section class="tp-tarjeta tp-personas"><h3>Colaboradores agregados en Registrar labor</h3>' +
        '<p class="tp-ayuda">Pendientes: labor registrada sin tiempos asignados. Guardados: tiempos confirmados con el botón Guardar tiempos.</p>' +
        '<div class="tp-busqueda"><input id="tpBuscar" type="search" placeholder="Buscar entre colaboradores de Registrar labor…" autocomplete="off">' +
          '<div class="tp-filtros">' +
            '<button type="button" class="active" data-tp-filtro="pendientes">Pendientes</button>' +
            '<button type="button" data-tp-filtro="guardados">Guardados</button>' +
          '</div></div>' +
        '<div class="tp-seleccion"><span id="tpCantidad">0 empleados seleccionados</span>' +
          '<label><input type="checkbox" id="tpSeleccionarTodos"> Seleccionar visibles</label></div>' +
        '<div id="tpEmpleados" class="tp-empleados" role="group" aria-label="Colaboradores"></div>' +
      '</section>' +
      '<section class="tp-tarjeta"><h3 id="tpFormularioTitulo">Registrar tiempo</h3>' +
        '<div class="tp-modo-edicion" id="tpModoEdicion" hidden><span id="tpModoEdicionTexto"></span>' +
          '<button type="button" data-tp-accion="cancelar-edicion">Cancelar modificación</button></div>' +
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
      '<section class="tp-tarjeta tp-tabla-guardados">' +
        '<div class="tp-tabla-titulo"><div><h3>Tiempos guardados por colaborador</h3>' +
          '<p class="tp-ayuda">Selecciona Modificar en la fila correspondiente. Los cambios se guardan con Guardar tiempos.</p></div>' +
          '<span id="tpGuardadosContador" class="tp-tabla-contador">0 registros</span></div>' +
        '<div class="tp-tabla-scroll"><table class="tp-tabla-registros">' +
          '<thead><tr>' +
            '<th>Colaborador</th><th>Programado</th><th>Horas extra</th>' +
            '<th>Actividades descontadas</th><th>Tiempo efectivo</th>' +
            '<th>Observaciones</th><th>Acción</th>' +
          '</tr></thead><tbody id="tpTablaGuardados"></tbody>' +
        '</table></div>' +
      '</section>' +
      '<details class="tp-detalle-cola"><summary>Registros pendientes de sincronización <span id="tpTotalCola">0</span></summary>' +
        '<div id="tpCola"></div><p class="tp-ayuda">Los tiempos se guardan en este equipo. El envío al servidor no está disponible hasta contar con una API de sincronización.</p>' +
      '</details>';
    vista.appendChild(panel);

    const buscar = panel.querySelector("#tpBuscar");
    const lista = panel.querySelector("#tpEmpleados");
    const checks = panel.querySelector("#tpSeleccionarTodos");
    const vistaNombre = document.querySelector("[data-corte-rol].active")?.dataset.corteRol;
    const estado = { empleados: [], guardados: [], seleccionados: new Set(), filtro: "pendientes", rol: "", editando: null };
    const rol = () => {
      if (modulo === "corte") return document.querySelector("[data-corte-rol].active")?.dataset.corteRol || new URLSearchParams(location.search).get("rol") || "cortador";
      return new URLSearchParams(location.search).get("rol") || "";
    };
    estado.rol = vistaNombre || rol();

    const getCampo = (id) => panel.querySelector('[data-tp-campo="' + id + '"]');
    // Registrar labor y Guardar tiempos son procesos diferentes. En Desbotón
    // solo cuentan los tiempos guardados DESPUÉS de la primera labor de la
    // jornada; un tiempo antiguo de ensayo no confirma una labor nueva.
    const registroDe = (e) => {
      const guardados = estado.guardados.filter((r) =>
        String(r[cfg.empleado]) === codigo(e) && r.fecha === fechaPrincipal.value
      ).sort((a, b) => String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || "")));
      if (modulo !== "desbotonado-mallas") return guardados[0] || null;
      const labor = obtenerLabor(fechaPrincipal.value, "").find((r) =>
        String(r.codigo) === codigo(e)
      );
      const inicio = Date.parse(labor?.laborGuardadaEn || "");
      if (!Number.isFinite(inicio)) return null;
      return guardados.find((r) => {
        const guardadoEn = Date.parse(r.createdAt || "");
        return Number.isFinite(guardadoEn) && guardadoEn >= inicio &&
          Number.isFinite(Number(r.tiempoRealMin)) &&
          Number.isFinite(Number(r.tiempoDisponibleMin)) &&
          Number(r.tiempoDisponibleMin) > 0;
      }) || null;
    };
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
      checks.disabled = Boolean(estado.editando);
    }
    // La misma lectura de minutos alimenta la tabla y el formulario de edición,
    // incluidos los registros anteriores a la estructura vigente.
    function minutosGuardados(registro, campo) {
      if (campo === "otrosMin" && registro.otrosMin == null) {
        const conocidos = DESCUENTOS.filter((k) => k !== "otrosMin")
          .reduce((total, k) => total + (Number(registro[k]) || 0), 0);
        return Math.max(0, (Number(registro.otrasLaboresMin) || 0) - conocidos);
      }
      const minutos = Number(registro[campo]);
      return Number.isFinite(minutos) && minutos > 0 ? minutos : 0;
    }

    function pintarTablaGuardados() {
      const trabajadores = estado.empleados
        .map((e) => ({ empleado: e, registro: registroDe(e) }))
        .filter((x) => Boolean(x.registro));
      const cuerpo = panel.querySelector("#tpTablaGuardados");
      panel.querySelector("#tpGuardadosContador").textContent =
        trabajadores.length + (trabajadores.length === 1 ? " registro" : " registros");
      cuerpo.innerHTML = trabajadores.length ? trabajadores.map(({ empleado, registro }) => {
        const descuentos = DESCUENTOS
          .map((campo) => ({ campo, minutos: minutosGuardados(registro, campo) }))
          .filter((item) => item.minutos > 0);
        const detalle = descuentos.length
          ? descuentos.map(({ campo, minutos }) => {
              const etiqueta = CAMPOS.find(([id]) => id === campo)?.[1] || campo;
              return '<span class="tp-descuento">' + escape(etiqueta) + ': <b>' +
                escape(horas(minutos)) + ' h</b></span>';
            }).join("")
          : '<span class="tp-sin-descuentos">Sin descuentos (0 h)</span>';
        const activo = estado.editando?.id === registro.id;
        return '<tr' + (activo ? ' class="tp-fila-editando"' : '') + '>' +
          '<td class="tp-celda-colaborador"><b>' + escape(nombre(empleado)) + '</b>' +
            '<small>' + escape(codigo(empleado)) + '</small></td>' +
          '<td>' + escape(horas(minutosGuardados(registro, "horasLaboralesMin"))) + ' h</td>' +
          '<td>' + escape(horas(minutosGuardados(registro, "horasExtraMin"))) + ' h</td>' +
          '<td class="tp-celda-descuentos">' + detalle + '</td>' +
          '<td class="tp-celda-efectivo"><b>' + escape(horas(registro.tiempoRealMin)) + ' h</b></td>' +
          '<td class="tp-celda-observaciones">' + escape(registro.observaciones || "—") + '</td>' +
          '<td><button type="button" class="tp-modificar" data-tp-modificar="' +
             escape(codigo(empleado)) + '"' + (estado.editando ? ' disabled' : '') +
             ' aria-label="Modificar tiempos de ' + escape(nombre(empleado)) + '">' +
             (activo ? 'Modificando…' : 'Modificar') + '</button></td></tr>';
      }).join("")
      : '<tr><td colspan="7" class="tp-tabla-vacia">' +
          'Todavía no hay colaboradores con tiempos guardados para esta fecha.' +
        '</td></tr>';
    }

    function pintar() {
      const actuales = visibles();
      lista.innerHTML = actuales.length ? actuales.map((e) => {
        const id = codigo(e), tipo = estadoDe(e);
        const selector = tipo === "guardado"
          ? '<span class="tp-persona-check" aria-hidden="true">✓</span>'
          : '<input type="checkbox" data-tp-empleado="' + escape(id) +
            '" aria-label="Seleccionar ' + escape(nombre(e)) + '"' +
            (estado.seleccionados.has(id) ? ' checked' : '') +
            (estado.editando ? ' disabled' : '') + '>';
        return '<div class="tp-persona">' +
          selector + '<span><b>' + escape(nombre(e)) + '</b><small>' + escape(id) + '</small></span>' +
          '<em class="tp-etiqueta tp-' + tipo + '">' + tipo.toUpperCase() + '</em></div>';
      }).join("") : '<p class="tp-vacio">' +
        (estado.empleados.length
          ? 'No hay colaboradores para este filtro. Prueba con Pendientes o Guardados.'
          : 'Todavía no se han agregado colaboradores en Registrar labor para esta fecha.') +
        '</p>';
      panel.querySelectorAll("[data-tp-filtro]").forEach((b) => b.classList.toggle("active", b.dataset.tpFiltro === estado.filtro));
      // En Guardados cada persona se modifica desde su propio botón;
      // no hay selección múltiple para evitar cambios accidentales.
      panel.querySelector(".tp-seleccion").hidden = estado.filtro === "guardados";
      seleccion();
      pintarTablaGuardados();
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
    function salirEdicion(limpiarCampos = true) {
      estado.editando = null;
      panel.querySelector("#tpModoEdicion").hidden = true;
      panel.querySelector("#tpModoEdicionTexto").textContent = "";
      if (limpiarCampos) limpiar();
    }
    function iniciarEdicion(id) {
      const empleado = estado.empleados.find((e) => codigo(e) === id);
      const guardado = empleado && registroDe(empleado);
      if (!guardado) return reporte("No se encontró un registro de tiempos guardado para este colaborador.", true);
      estado.editando = {
        codigo: id, id: guardado.id,
        fecha: fechaPrincipal.value, rol: estado.rol
      };
      estado.seleccionados.clear();
      estado.filtro = "guardados";
      CAMPOS.forEach(([campo]) => {
        getCampo(campo).value = horas(minutosGuardados(guardado, campo));
      });
      panel.querySelector("#tpObservaciones").value = guardado.observaciones || "";
      panel.querySelector("#tpModoEdicionTexto").textContent =
        "Modificando tiempos de " + nombre(empleado) + " · " + fechaPrincipal.value;
      panel.querySelector("#tpModoEdicion").hidden = false;
      calcular();
      pintar();
      reporte("Puedes corregir los valores y pulsar Guardar tiempos para actualizar solo a " + nombre(empleado) + ".");
      panel.querySelector("#tpFormularioTitulo").scrollIntoView({ behavior: "smooth", block: "start" });
    }
    function guardarRegistro(e, datos, existente = registroDe(e)) {
      const id = codigo(e);
      const r = {
        ...(existente || {}),
        ...datos,
        id: existente?.id || SyncEngine.generarUUID(),
        fecha: fechaPrincipal.value,
        [cfg.empleado]: id,
        [cfg.nombre]: nombre(e),
        esPrueba: TiemposLaboresJN.esColaboradorPrueba(id),
        syncStatus: TiemposLaboresJN.esColaboradorPrueba(id) ? "PruebaLocal" : (modulo === "siembra-rendimiento" ? "SoloLocal" : "PendienteBackend"),
        usuario: JSON.parse(sessionStorage.getItem("labores_usuario") || "null")?.username || "",
        createdAt: existente?.createdAt || new Date().toISOString(),
        updatedAt: existente ? new Date().toISOString() : undefined
      };
      // Los campos retirados de la captura no deben reaparecer al actualizar
      // registros de versiones anteriores.
      delete r.pMadresMin;
      delete r.pAbuelasMin;
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
        const fecha = fechaPrincipal.value;
        let desdeLabor = obtenerLabor(fecha, cfg.roles ? estado.rol : "");
        // Bandejas conserva sus registros de labor en IndexedDB.
        // Recuperar solo los sembradores de la fecha, incluso sin catálogo.
        if (modulo === "bandejas-enraizamiento" || modulo === "siembra-rendimiento") {
          const esBandejas = modulo === "bandejas-enraizamiento";
          const trabajos = await OfflineDb.getAll(esBandejas ? "bandejasEnraizamiento" : "siembraRendimientoRegistros");
          desdeLabor = trabajos.filter((r) => r.fecha === fecha).map((r) => ({
            codigo: String(esBandejas ? r.sembrador || "" : r.colaborador || ""),
            nombre: esBandejas ? (r.sembradorNombre || String(r.sembrador || "")) :
              (r.colaboradorNombre || String(r.colaborador || ""))
          }));
        }
        const unicos = new Map();
        desdeLabor.forEach((e) => {
          const id = codigo(e);
          if (id && !unicos.has(id)) unicos.set(id, { codigo: id, nombre: nombre(e) });
        });
        estado.empleados = [...unicos.values()].sort((a, b) => nombre(a).localeCompare(nombre(b), "es"));
        estado.guardados = (await OfflineDb.getAll(cfg.tienda)).filter((r) => !cfg.roles || r.rol === estado.rol);
        const validos = new Set(estado.empleados.map((e) => codigo(e)));
        for (const id of estado.seleccionados) if (!validos.has(id)) estado.seleccionados.delete(id);
        pintar();
      } catch (err) {
        reporte("No se pudieron cargar los colaboradores de Registrar labor: " + err.message, true);
      }
    }
    window.addEventListener("laboresjn:registro-labor", (event) => {
      if (event.detail?.fecha === fechaPrincipal.value &&
          (!cfg.roles || event.detail?.rol === estado.rol)) {
        if (event.detail?.laborGuardada && modulo === "desbotonado-mallas") {
          estado.filtro = "pendientes";
        }
        cargar();
      }
    });

    // Una única fecha (la del encabezado) y un único buscador visible en Tiempos.
    const origenBuscar = document.querySelector("#sembradorBuscar, #desbotonadorBuscar, #colaboradorBuscar");
    origenBuscar?.parentElement?.classList.add("tp-colaborador-origen");
    function sincronizarVista() {
      document.body.classList.toggle("tp-vista-activa", !vista.hidden && vista.getClientRects().length > 0);
    }
    document.querySelectorAll("[data-bandejas-vista], [data-corte-vista], [data-desbotonado-vista], [data-preparacion-vista], [data-poscosecha-vista], [data-mipe-vista], [data-siembra-vista]")
      .forEach((btn) => btn.addEventListener("click", () => setTimeout(() => {
        sincronizarVista();
        if (!vista.hidden) cargar();
      }, 0)));
    setTimeout(sincronizarVista, 0);

    fechaPrincipal.addEventListener("change", () => {
      if (estado.editando) salirEdicion();
      estado.seleccionados.clear();
      limpiar();
      cargar();
    });

    buscar.addEventListener("input", pintar);
    checks.addEventListener("change", () => {
      if (estado.editando) return;
      visibles().filter((e) => estadoDe(e) === "pendiente")
        .forEach((e) => checks.checked ? estado.seleccionados.add(codigo(e)) : estado.seleccionados.delete(codigo(e)));
      pintar();
    });
    lista.addEventListener("change", (event) => {
      const input = event.target.closest("[data-tp-empleado]");
      if (!input || estado.editando) return;
      input.checked ? estado.seleccionados.add(input.dataset.tpEmpleado) : estado.seleccionados.delete(input.dataset.tpEmpleado);
      seleccion();
    });
    panel.querySelector("#tpTablaGuardados").addEventListener("click", (event) => {
      const boton = event.target.closest("[data-tp-modificar]");
      if (boton && !boton.disabled) iniciarEdicion(boton.dataset.tpModificar);
    });
    panel.querySelectorAll("[data-tp-filtro]").forEach((button) => button.addEventListener("click", () => {
      if (estado.editando) salirEdicion();
      estado.seleccionados.clear();
      estado.filtro = button.dataset.tpFiltro;
      pintar();
    }));
    panel.querySelectorAll("[data-tp-campo]").forEach((input) => input.addEventListener("input", calcular));

    // Guardar aplica directamente los tiempos a la selección.
    panel.querySelector("[data-tp-accion='guardar']").addEventListener("click", async () => {
      const button = panel.querySelector("[data-tp-accion='guardar']");
      if (button.disabled) return;
      if (!fechaPrincipal.value) return reporte("Selecciona la fecha de la jornada.", true);
      if (!estado.editando && !estado.seleccionados.size) return reporte("Selecciona al menos un colaborador.", true);
      try {
        const datos = detalles();
        if (estado.editando) {
          const edicion = estado.editando;
          if (edicion.fecha !== fechaPrincipal.value || edicion.rol !== estado.rol) {
            return reporte("La fecha o el rol cambió. Vuelve a seleccionar Modificar tiempos.", true);
          }
          const empleado = estado.empleados.find((e) => codigo(e) === edicion.codigo);
          const guardado = empleado && registroDe(empleado);
          if (!guardado || guardado.id !== edicion.id) {
            return reporte("El registro cambió. Actualiza la lista y vuelve a modificar los tiempos.", true);
          }
          button.disabled = true;
          const actualizado = guardarRegistro(empleado, datos, guardado);
          await OfflineDb.put(cfg.tienda, actualizado);
          salirEdicion();
          estado.seleccionados.clear();
          estado.filtro = "guardados";
          await cargar();
          return reporte("Tiempos de " + nombre(empleado) + " actualizados correctamente en este equipo. No se creó otro registro.");
        }
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
        // Mostrar los registros recién guardados y su acción Modificar tiempos.
        estado.filtro = "guardados";
        await cargar();
        reporte(guardados + " registro(s) de tiempos guardado(s) localmente. Los colaboradores PRUEBA quedan identificados como datos de ensayo y no se envían al servidor.");
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
      reporte(estado.editando
        ? "Campos restablecidos. Sigues modificando al mismo colaborador; pulsa Guardar tiempos para aplicar cambios."
        : "Campos limpiados. Los registros guardados se conservan.");
    });
    panel.querySelector("[data-tp-accion='cancelar-edicion']").addEventListener("click", () => {
      salirEdicion();
      pintar();
      reporte("Modificación cancelada. No se cambió ningún tiempo guardado.");
    });

    // Corte puede cambiar de rol sin cambiar de página. Mantener cada cola por rol.
    document.addEventListener("click", (event) => {
      if (modulo !== "corte" || !event.target.closest("[data-corte-rol]")) return;
      setTimeout(() => {
        const nuevo = rol();
        if (nuevo === estado.rol) return;
        if (estado.editando) salirEdicion();
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
