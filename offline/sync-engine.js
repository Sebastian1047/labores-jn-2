// Motor de sincronización offline-first, compartido por Pronósticos y Siembra.
// Mismo patrón que AppLabores en Android: todo se guarda local primero; "Sincronizar" sube
// pendientes con reintento y luego refresca catálogos — nunca se bloquea por falta de red.

class RedNoDisponibleError extends Error {}
class ErrorApi extends Error {
  constructor(status, mensaje) {
    super(mensaje);
    this.status = status;
  }
}

function esErrorReintentable(error) {
  return error instanceof RedNoDisponibleError || (error instanceof ErrorApi && error.status >= 500);
}

// crypto.randomUUID() exige "contexto seguro" (HTTPS/localhost) -- en este servidor (HTTP
// simple) NO existe y tira "crypto.randomUUID is not a function", reventando el guardado
// completo. crypto.getRandomValues() SI funciona sin HTTPS -- se construye el UUID v4 a mano
// con eso como respaldo universal.
function generarUUID() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0"));
  return `${hex[0]}${hex[1]}${hex[2]}${hex[3]}-${hex[4]}${hex[5]}-${hex[6]}${hex[7]}-${hex[8]}${hex[9]}-${hex[10]}${hex[11]}${hex[12]}${hex[13]}${hex[14]}${hex[15]}`;
}

async function fetchApi(path, options = {}, timeoutMs = 6000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, { ...options, signal: controller.signal });
    clearTimeout(timer);
    return response;
  } catch (err) {
    clearTimeout(timer);
    throw new RedNoDisponibleError(err.message);
  }
}

async function apiGetOnline(path) {
  const response = await fetchApi(path);
  if (!response.ok) throw new Error(`GET ${path} -> ${response.status}`);
  return response.json();
}

async function apiPostOnline(path, body) {
  const response = await fetchApi(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new ErrorApi(response.status, data.mensaje || data.message || `Error ${response.status}`);
  return data;
}

async function apiDeleteOnline(path, body) {
  const response = await fetchApi(path, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.mensaje || data.message || `Error ${response.status}`);
  return data;
}

async function conReintento(fn, intentos = 3) {
  let ultimoError;
  for (let i = 1; i <= intentos; i++) {
    try {
      return await fn();
    } catch (err) {
      ultimoError = err;
      if (!esErrorReintentable(err)) throw err;
    }
  }
  throw ultimoError;
}

function fmtFechaISO(valor) {
  if (!valor) return null;
  return String(valor).substring(0, 10);
}

// ---------------------------------------------------------------------------
// Catálogos (Variedad, Clon, Origen, Empleado) — igual que la sincronización
// de catálogos al abrir AppLabores. El Empleado es el sembrador real; ya no existe
// un catálogo aparte de "sembradores" (era UsuariosApp, un concepto equivocado).
// ---------------------------------------------------------------------------

async function sincronizarCatalogos() {
  const [variedades, origenes, clones, empleados, causas, camas, semanas] = await Promise.all([
    apiGetOnline("/api/siembra/online/variedades"),
    apiGetOnline("/api/siembra/online/origenes"),
    apiGetOnline("/api/siembra/online/clones"),
    apiGetOnline("/api/siembra/online/empleados"),
    apiGetOnline("/api/siembra/online/causas"),
    apiGetOnline("/api/siembra/online/camas"),
    apiGetOnline("/api/siembra/online/semanas"),
  ]);

  await OfflineDb.clear("variedades");
  await OfflineDb.putMany("variedades", variedades);
  await OfflineDb.clear("origenes");
  await OfflineDb.putMany("origenes", origenes);
  await OfflineDb.clear("clones");
  // clave sintetica variedad+codigo -- dbo.Clon.codigo no es unico globalmente entre variedades
  // distintas (ver comentario en db.js), usar solo codigo como llave pisaba clones entre si.
  await OfflineDb.putMany("clones", clones.map((c) => ({ ...c, clave: `${c.variedad}|${c.codigo}` })));
  await OfflineDb.clear("empleados");
  await OfflineDb.putMany("empleados", empleados);
  await OfflineDb.clear("causas");
  await OfflineDb.putMany("causas", causas);
  await OfflineDb.clear("camas");
  // clave sintetica bloque+cama -- legacy.camas no tiene una sola columna que sirva de keyPath.
  await OfflineDb.putMany("camas", camas.map((c) => ({ ...c, clave: `${c.bloque}|${c.cama}` })));
  await OfflineDb.clear("semanas");
  await OfflineDb.putMany("semanas", semanas.map((s) => ({ ...s, clave: `${s.ano}|${s.semana}` })));

  await OfflineDb.setMeta("catalogosSyncAt", new Date().toISOString());
}

async function obtenerCatalogosLocal() {
  const [variedades, origenes, clones, empleados, causas, camas, semanas] = await Promise.all([
    OfflineDb.getAll("variedades"),
    OfflineDb.getAll("origenes"),
    OfflineDb.getAll("clones"),
    OfflineDb.getAll("empleados"),
    OfflineDb.getAll("causas"),
    OfflineDb.getAll("camas"),
    OfflineDb.getAll("semanas"),
  ]);
  return { variedades, origenes, clones, empleados, causas, camas, semanas };
}

// Busca en el calendario real (domingo-sabado) cual semana contiene la fecha dada -- offline,
// sobre lo ya sincronizado. Devuelve null si nunca se sincronizo el catalogo de semanas.
// Usa partes de fecha LOCALES (no toISOString, que es UTC y puede cambiar de dia cerca de la
// medianoche en Colombia, UTC-5).
function semanaQueContiene(semanas, fecha) {
  const yyyy = fecha.getFullYear();
  const mm = String(fecha.getMonth() + 1).padStart(2, "0");
  const dd = String(fecha.getDate()).padStart(2, "0");
  const local = `${yyyy}-${mm}-${dd}`;
  return semanas.find((s) => local >= s.fechaIni && local <= s.fechaFin) || null;
}

// ---------------------------------------------------------------------------
// Siembra (dbo.SiembraOnline) — mirror local + cola de pendientes.
// ---------------------------------------------------------------------------

async function sincronizarSiembrasDesdeServidor({ fechaInicio, fechaFinal } = {}) {
  const params = new URLSearchParams();
  if (fechaInicio) {
    params.set("fechaInicio", fechaInicio);
    params.set("fechaFinal", fechaFinal || fechaLocalISO());
  } else {
    params.set("diasAtras", "365");
  }

  const remotas = await apiGetOnline(`/api/siembra/online/list?${params.toString()}`);

  for (const r of remotas) {
    const local = await OfflineDb.get("siembras", r.id);
    if (local && local.syncStatus && local.syncStatus !== "Sincronizado") {
      continue; // no pisar una edición local aún no subida
    }
    await OfflineDb.put("siembras", {
      id: r.id,
      fecha: fmtFechaISO(r.fecha),
      bloque: r.bloque,
      cama: r.cama,
      variedad: r.variedad,
      variedadNombre: r.variedadNombre,
      lineas: r.lineas,
      densidad: r.densidad,
      empleado: r.empleado,
      empleadoNombre: r.empleadoNombre,
      vclon: r.vclon,
      origen: r.origen,
      login: r.login,
      reviso: r.reviso,
      causa: r.causa,
      causaNombre: r.causaNombre,
      // Antes esto ignoraba lo que trae el servidor y usaba SOLO lo que ya hubiera local,
      // asi que cualquier registro que este equipo nunca habia visto (creado otro dia, o por
      // otra persona/dispositivo) llegaba con semana/año en null aunque el dato real SI
      // estuviera guardado en SQL -- confirmado 18/09/2026 contra Despachos_JN (registros del
      // 14-15/09 con Semprg/Añoprg reales, pero el campo se veia vacio al editar en un
      // dispositivo que los bajaba por primera vez). El chequeo de la linea 158 (no pisar una
      // edicion local aun sin sincronizar) ya cubre el caso que esto intentaba proteger -- aca
      // abajo siempre es seguro usar el valor real del servidor.
      semanaProgramada: r.semanaProgramada ?? (local ? local.semanaProgramada : null),
      anoProgramado: r.anoProgramado ?? (local ? local.anoProgramado : null),
      syncStatus: "Sincronizado",
      updatedAt: new Date().toISOString(),
    });
  }

  // El servidor manda: si una siembra ya sincronizada en este equipo ya no existe alla dentro del
  // rango pedido (se borro, ej. limpieza de ensayos 18/09/2026), se quita de la copia local -- antes
  // esta funcion solo agregaba/actualizaba y las borradas se quedaban para siempre en Revision.
  // Solo con rango explicito y respuesta completa (tope 5000), y nunca toca lo pendiente de subir.
  if (fechaInicio && remotas.length < 5000) {
    const finRango = fechaFinal || fechaLocalISO();
    const idsRemotos = new Set(remotas.map((r) => r.id));
    for (const l of await OfflineDb.getAll("siembras")) {
      const sincronizada = !l.syncStatus || l.syncStatus === "Sincronizado";
      if (l.id > 0 && sincronizada && l.fecha >= fechaInicio && l.fecha <= finRango && !idsRemotos.has(l.id)) {
        await OfflineDb.delete("siembras", l.id);
      }
    }
  }

  await OfflineDb.setMeta("siembrasSyncAt", new Date().toISOString());
  return remotas.length;
}

// Fecha de HOY en hora local (Colombia, UTC-5) como YYYY-MM-DD. input.valueAsDate = new Date()
// usa UTC, asi que despues de las 7 p.m. locales ponia MANANA -- Revision filtraba un dia sin
// registros y Registro guardaba la fecha del dia siguiente.
function fechaLocalISO(fecha = new Date()) {
  const mm = String(fecha.getMonth() + 1).padStart(2, "0");
  const dd = String(fecha.getDate()).padStart(2, "0");
  return `${fecha.getFullYear()}-${mm}-${dd}`;
}

// Descarga de los ultimos dias de siembras + horas para poder revisarlas/editarlas SIN red. El
// menu la usa en la descarga forzada al entrar: antes solo se bajaban al abrir Revision con
// senal, asi que quien llegaba a campo sin haberla abierto no veia nada del servidor (18/09/2026).
async function sincronizarSiembrasRecientes(dias = 7) {
  const hasta = new Date();
  const desde = new Date();
  desde.setDate(hasta.getDate() - dias);
  const rango = { fechaInicio: fechaLocalISO(desde), fechaFinal: fechaLocalISO(hasta) };
  const total = await sincronizarSiembrasDesdeServidor(rango);
  await sincronizarHorasDesdeServidor(rango.fechaInicio, rango.fechaFinal).catch(() => {});
  return total;
}

async function guardarSiembraLocal(datos, idExistente) {
  const registro = { ...datos };
  if (idExistente) {
    registro.id = idExistente;
    registro.syncStatus = idExistente < 0 ? "NuevoModificado" : "Modificado";
    // Bug real encontrado 22/09/2026: editar una siembra que TODAVIA no se ha sincronizado
    // (id local negativo) reconstruia "registro" solo desde los campos del formulario -- que
    // nunca incluyen idOperacion -- y perdia el identificador de idempotencia original. Si esa
    // fila editada se reintentaba sincronizar (señal debil, auto-sync de fondo), cada reintento
    // insertaba una fila nueva sin proteccion (asi se duplicaron siembras reales el 21/09).
    // Se recupera el idOperacion original del registro que ya estaba guardado en IndexedDB.
    if (idExistente < 0 && !registro.idOperacion) {
      const anterior = await OfflineDb.get("siembras", idExistente);
      registro.idOperacion = anterior?.idOperacion || generarUUID();
    }
  } else {
    registro.id = await OfflineDb.proximoIdTemporalSiembra();
    registro.syncStatus = "Nuevo";
    // Generado UNA sola vez aqui, antes de cualquier intento de red, y se conserva igual en
    // cada reintento -- es lo que le permite al servidor reconocer "esto ya se guardo" si la
    // respuesta de un intento anterior se perdio por la red (ver script 129).
    registro.idOperacion = generarUUID();
  }
  registro.updatedAt = new Date().toISOString();
  await OfflineDb.put("siembras", registro);
  return registro;
}

async function contarPendientesSiembra() {
  const todas = await OfflineDb.getAll("siembras");
  return todas.filter((s) => s.syncStatus && s.syncStatus !== "Sincronizado").length;
}

async function obtenerTodasSiembrasLocal() {
  return OfflineDb.getAll("siembras");
}

async function sincronizarPendientesSiembra() {
  const todas = await OfflineDb.getAll("siembras");
  const pendientes = todas.filter((s) => s.syncStatus && s.syncStatus !== "Sincronizado");
  const resultado = { subidas: 0, fallidas: 0 };

  for (const s of pendientes) {
    try {
      const body = {
        id: s.id > 0 ? s.id : null,
        fecha: s.fecha,
        bloque: s.bloque,
        cama: s.cama,
        variedad: s.variedad,
        lineas: s.lineas,
        densidad: s.densidad,
        empleado: s.empleado,
        vclon: s.vclon,
        origen: s.origen,
        login: s.login,
        semanaProgramada: s.semanaProgramada,
        anoProgramado: s.anoProgramado,
        reviso: s.reviso,
        causa: s.causa,
        // Solo tiene sentido en una fila nueva (id local negativo) -- en una edicion el Id real
        // ya identifica la fila sin ambiguedad. Ver script 129_siembra_online_idempotencia.sql.
        idOperacion: s.id < 0 ? s.idOperacion : null,
      };
      const guardado = await conReintento(() => apiPostOnline("/api/siembra/online", body), 3);

      if (s.id !== guardado.id) {
        await OfflineDb.delete("siembras", s.id);
      }
      await OfflineDb.put("siembras", {
        ...s,
        id: guardado.id,
        variedadNombre: guardado.variedadNombre,
        syncStatus: "Sincronizado",
        errorMensaje: null,
        updatedAt: new Date().toISOString(),
      });
      resultado.subidas++;
    } catch (err) {
      resultado.fallidas++;
      // Se deja visible (Registro/Hub pueden mostrarlo) en vez de solo loguear en consola --
      // "Pendiente" ya no distingue entre "todavia no se intento" y "se intento y fallo".
      await OfflineDb.put("siembras", { ...s, syncStatus: "Error", errorMensaje: err.message, updatedAt: new Date().toISOString() });
      console.error("No se pudo sincronizar siembra", s.id, err);
    }
  }

  return resultado;
}

// ---------------------------------------------------------------------------
// Horas trabajadas por colaborador/día (dbo.Horas) — para Rendimiento en Promedios.
// Clave local sintética `fecha|empleado` (esa tabla legacy no tiene id propio).
// ---------------------------------------------------------------------------

function claveHoras(fecha, empleado) {
  return `${fecha}|${empleado}`;
}

async function sincronizarHorasDesdeServidor(fechaInicio, fechaFinal) {
  const params = new URLSearchParams({ desde: fechaInicio, hasta: fechaFinal || fechaInicio });
  const remotas = await apiGetOnline(`/api/siembra/horas?${params.toString()}`);

  for (const r of remotas) {
    const fecha = fmtFechaISO(r.fecha);
    const clave = claveHoras(fecha, r.empleado);
    const local = await OfflineDb.get("horasColaborador", clave);
    if (local && local.syncStatus && local.syncStatus !== "Sincronizado") {
      continue; // no pisar una edición local aún no subida
    }
    await OfflineDb.put("horasColaborador", {
      clave,
      fecha,
      empleado: r.empleado,
      horas: r.horas,
      syncStatus: "Sincronizado",
      updatedAt: new Date().toISOString(),
    });
  }

  // Igual que siembras: lo sincronizado que ya no existe en el servidor dentro del rango se quita.
  const idsRemotos = new Set(remotas.map((r) => claveHoras(fmtFechaISO(r.fecha), r.empleado)));
  const fin = fechaFinal || fechaInicio;
  for (const l of await OfflineDb.getAll("horasColaborador")) {
    if (l.syncStatus === "Sincronizado" && l.fecha >= fechaInicio && l.fecha <= fin && !idsRemotos.has(l.clave)) {
      await OfflineDb.delete("horasColaborador", l.clave);
    }
  }

  return remotas.length;
}

async function obtenerHorasLocalPorRango(fechaInicio, fechaFinal) {
  const todas = await OfflineDb.getAll("horasColaborador");
  return todas.filter((h) => h.fecha >= fechaInicio && h.fecha <= (fechaFinal || fechaInicio));
}

async function guardarHorasLocal(fecha, empleado, horas) {
  const clave = claveHoras(fecha, empleado);
  await OfflineDb.put("horasColaborador", {
    clave,
    fecha,
    empleado,
    horas,
    syncStatus: "Pendiente",
    updatedAt: new Date().toISOString(),
  });
}

async function contarPendientesHoras() {
  const todas = await OfflineDb.getAll("horasColaborador");
  return todas.filter((h) => h.syncStatus && h.syncStatus !== "Sincronizado").length;
}

async function sincronizarPendientesHoras() {
  const todas = await OfflineDb.getAll("horasColaborador");
  const pendientes = todas.filter((h) => h.syncStatus && h.syncStatus !== "Sincronizado");
  const resultado = { subidas: 0, fallidas: 0 };
  if (pendientes.length === 0) return resultado;

  try {
    const body = {
      registros: pendientes.map((h) => ({ empleado: h.empleado, fecha: h.fecha, horas: h.horas })),
    };
    await conReintento(() => apiPostOnline("/api/siembra/horas", body), 3);
    for (const h of pendientes) {
      await OfflineDb.put("horasColaborador", { ...h, syncStatus: "Sincronizado", errorMensaje: null, updatedAt: new Date().toISOString() });
    }
    resultado.subidas = pendientes.length;
  } catch (err) {
    resultado.fallidas = pendientes.length;
    for (const h of pendientes) {
      await OfflineDb.put("horasColaborador", { ...h, syncStatus: "Error", errorMensaje: err.message, updatedAt: new Date().toISOString() });
    }
    console.error("No se pudieron sincronizar las horas", err);
  }

  return resultado;
}

// ---------------------------------------------------------------------------
// Pronósticos — cola de días y movimientos pendientes.
// ---------------------------------------------------------------------------

async function guardarDiaPendiente(clave, datosDia) {
  await OfflineDb.put("pronosticosDias", { clave, ...datosDia, syncStatus: "Pendiente", updatedAt: new Date().toISOString() });
}

async function limpiarDiaPendiente(clave) {
  await OfflineDb.delete("pronosticosDias", clave);
}

async function listarDiasPendientes() {
  return (await OfflineDb.getAll("pronosticosDias")).filter((d) => d.syncStatus === "Pendiente");
}

async function guardarMovimientoPendiente(mov) {
  await OfflineDb.put("pronosticosMovimientos", { ...mov, syncStatus: "Pendiente" });
}

async function limpiarMovimientoPendiente(idOperacion) {
  await OfflineDb.delete("pronosticosMovimientos", idOperacion);
}

async function listarMovimientosPendientes() {
  return (await OfflineDb.getAll("pronosticosMovimientos")).filter((m) => m.syncStatus === "Pendiente");
}

async function contarPendientesPronosticos() {
  const [dias, movs] = await Promise.all([listarDiasPendientes(), listarMovimientosPendientes()]);
  return dias.length + movs.length;
}

// ---------------------------------------------------------------------------
// Asegurar Corte (dbo.tblcorte / tblcorteobservacion) — mismo patron de cola offline que
// Siembra. A diferencia de variedades/clones, el catalogo de Items/Observaciones no cambia
// nunca en campo (son fijos), pero igual se sincroniza como el resto para que quede disponible
// sin red desde la primera vez que el equipo tuvo conexion.
// ---------------------------------------------------------------------------

async function sincronizarCatalogoCorte() {
  // Asegurador ya NO es un catalogo para elegir -- se resuelve aparte, uno solo, por usuario
  // (ver resolverAseguradorActual() en asegurar-corte.js). Aca solo van los catalogos
  // compartidos entre cualquier asegurador: items, observaciones, cortadores, semanas.
  const [items, observaciones, colaboradores, semanas] = await Promise.all([
    apiGetOnline("/api/aseguramiento-corte/items"),
    apiGetOnline("/api/aseguramiento-corte/observaciones"),
    apiGetOnline("/api/aseguramiento-corte/colaboradores"),
    // Reusa el mismo store/formato "semanas" que ya llena sincronizarCatalogos() (Siembra) --
    // asi Asegurar Corte tiene la semana real (domingo-sabado) aunque el equipo nunca haya
    // abierto Siembra/Pronosticos primero.
    apiGetOnline("/api/siembra/online/semanas"),
  ]);

  await OfflineDb.clear("corteItems");
  await OfflineDb.putMany("corteItems", items);
  await OfflineDb.clear("corteObservaciones");
  await OfflineDb.putMany("corteObservaciones", observaciones);
  await OfflineDb.clear("corteColaboradores");
  await OfflineDb.putMany("corteColaboradores", colaboradores);
  await OfflineDb.clear("semanas");
  await OfflineDb.putMany("semanas", semanas.map((s) => ({ ...s, clave: `${s.ano}|${s.semana}` })));

  await OfflineDb.setMeta("corteCatalogoSyncAt", new Date().toISOString());
}

async function obtenerCatalogoCorteLocal() {
  const [items, observaciones, colaboradores] = await Promise.all([
    OfflineDb.getAll("corteItems"),
    OfflineDb.getAll("corteObservaciones"),
    OfflineDb.getAll("corteColaboradores"),
  ]);
  return { items, observaciones, colaboradores };
}

function observacionesDelItem(observaciones, itemId) {
  return observaciones.filter((o) => o.item === itemId);
}

// Cuenta, sobre lo que ya hay en este equipo (sincronizado o todavia pendiente), cuantas
// revisiones tiene HOY un colaborador -- asi "Revision N" no se repite aunque el dispositivo
// nunca haya tenido red hoy. El "revision" que trae /colaboradores es solo el punto de partida
// (lo que el servidor ya tenia la ultima vez que hubo conexion).
async function contarRevisionesHoyLocal(colaboradorCodigo) {
  const hoy = fmtFechaISO(new Date().toISOString());
  const todas = await OfflineDb.getAll("corteRevisiones");
  return todas.filter((r) => r.colaborador === colaboradorCodigo && fmtFechaISO(r.fecha) === hoy).length;
}

async function guardarRevisionCorteLocal(revision) {
  const registro = {
    ...revision,
    correlationId: generarUUID(),
    syncStatus: "Pendiente",
    updatedAt: new Date().toISOString(),
  };
  await OfflineDb.put("corteRevisiones", registro);
  return registro;
}

async function contarPendientesCorte() {
  const todas = await OfflineDb.getAll("corteRevisiones");
  return todas.filter((r) => r.syncStatus && r.syncStatus !== "Sincronizado").length;
}

async function sincronizarPendientesCorte() {
  const todas = await OfflineDb.getAll("corteRevisiones");
  const pendientes = todas.filter((r) => r.syncStatus && r.syncStatus !== "Sincronizado");
  const resultado = { subidas: 0, fallidas: 0 };

  for (const r of pendientes) {
    try {
      const body = {
        asegurador: r.asegurador,
        colaborador: r.colaborador,
        docid: r.docid,
        nrevision: r.nrevision,
        modalidad: r.modalidad,
        semana: r.semana,
        fecha: r.fecha,
        correlationId: r.correlationId,
        observaciones: r.observaciones.map((o) => o.idObservacion),
      };
      await conReintento(() => apiPostOnline("/api/aseguramiento-corte/revision", body), 3);

      await OfflineDb.put("corteRevisiones", { ...r, syncStatus: "Sincronizado", errorMensaje: null, updatedAt: new Date().toISOString() });
      resultado.subidas++;
    } catch (err) {
      resultado.fallidas++;
      await OfflineDb.put("corteRevisiones", { ...r, syncStatus: "Error", errorMensaje: err.message, updatedAt: new Date().toISOString() });
      console.error("No se pudo sincronizar revision de corte", r.correlationId, err);
    }
  }

  return resultado;
}

// ---------------------------------------------------------------------------
// Calidad Siembra -- catalogos y cola offline-first.
// ---------------------------------------------------------------------------

async function sincronizarCatalogoCalidad() {
  const [items, semanas] = await Promise.all([
    apiGetOnline("/api/calidad/items"),
    apiGetOnline("/api/siembra/online/semanas"),
  ]);
  const semanaActual = semanaQueContiene(semanas, new Date());
  if (!semanaActual) throw new Error("No se encontró la semana actual en el calendario descargado");
  const colaboradores = await apiGetOnline(`/api/calidad/empleados?semana=${encodeURIComponent(semanaActual.semana)}`);
  if (!Array.isArray(items) || items.length !== 13) throw new Error("El catálogo de Calidad Siembra no tiene los 13 ítems esperados");
  await OfflineDb.clear("calidadItems");
  await OfflineDb.putMany("calidadItems", items);
  await OfflineDb.clear("calidadColaboradores");
  await OfflineDb.putMany("calidadColaboradores", colaboradores);
  await OfflineDb.clear("semanas");
  await OfflineDb.putMany("semanas", semanas.map((s) => ({ ...s, clave: `${s.ano}|${s.semana}` })));
  await OfflineDb.setMeta("calidadCatalogoSyncAt", new Date().toISOString());
}

async function obtenerCatalogoCalidadLocal() {
  const [items, colaboradores] = await Promise.all([
    OfflineDb.getAll("calidadItems"),
    OfflineDb.getAll("calidadColaboradores"),
  ]);
  return { items, colaboradores };
}

async function obtenerMayorRevisionCalidadLocal(colaborador, semana) {
  const todas = await OfflineDb.getAll("calidadEvaluaciones");
  return todas.filter((e) =>
    String(e.colaborador) === String(colaborador) &&
    Number(e.semana) === Number(semana) &&
    Number.isInteger(Number(e.revision)) && Number(e.revision) > 0
  ).reduce((mayor, e) => Math.max(mayor, Number(e.revision)), 0);
}

async function registrarRevisionCalidadConfirmada(colaborador, revision, semana) {
  const numeroRevision = Number(revision);
  if (!Number.isInteger(numeroRevision) || numeroRevision < 1) return;
  const colaboradores = await OfflineDb.getAll("calidadColaboradores");
  const actual = colaboradores.find((item) => String(item.codigo) === String(colaborador));
  if (!actual) return;
  await OfflineDb.put("calidadColaboradores", {
    ...actual,
    revision: Number(actual.semanaRevision) === Number(semana)
      ? Math.max(Number(actual.revision) || 0, numeroRevision)
      : numeroRevision,
    semanaRevision: Number(semana),
  });
}

async function asignarCorrelationCalidadPendiente(evaluacion) {
  if (evaluacion.correlationId) return evaluacion;
  const corregida = { ...evaluacion, correlationId: generarUUID(), errorMensaje: null, updatedAt: new Date().toISOString() };
  await OfflineDb.put("calidadEvaluaciones", corregida);
  return corregida;
}

async function reservarSiguienteRevisionCalidad(evaluacion, reservas) {
  const clave = `${evaluacion.colaborador}|${evaluacion.semana}`;
  let reserva = reservas.get(clave);
  if (!reserva) {
    const respuesta = await apiGetOnline(`/api/calidad/siguiente-revision?colaborador=${encodeURIComponent(evaluacion.colaborador)}&semana=${encodeURIComponent(evaluacion.semana)}`);
    const siguiente = Number(respuesta?.siguiente);
    if (!Number.isInteger(siguiente) || siguiente < 1 || siguiente > 30) {
      throw new Error("No hay una revisión disponible para esta evaluación pendiente.");
    }
    reserva = { siguiente, mayor: siguiente - 1 };
    reservas.set(clave, reserva);
  }
  const revision = Math.max(reserva.siguiente, reserva.mayor + 1);
  if (revision > 30) throw new Error("El colaborador ya tiene las 30 revisiones permitidas para esta semana.");
  reserva.mayor = revision;
  const corregida = { ...evaluacion, revision, errorMensaje: null, updatedAt: new Date().toISOString() };
  await OfflineDb.put("calidadEvaluaciones", corregida);
  return corregida;
}

async function prepararRevisionCalidadPendiente(evaluacion, reservas) {
  const corregida = await asignarCorrelationCalidadPendiente(evaluacion);
  const revision = Number(corregida.revision);
  return Number.isInteger(revision) && revision > 0
    ? corregida
    : reservarSiguienteRevisionCalidad(corregida, reservas);
}

function cuerpoEvaluacionCalidad(evaluacion) {
  return {
    fecha: evaluacion.fecha,
    semana: evaluacion.semana,
    asegurador: evaluacion.asegurador,
    colaborador: evaluacion.colaborador,
    revision: evaluacion.revision,
    correlationId: evaluacion.correlationId,
    incumplimientos: (evaluacion.incumplimientos || []).map((item) => typeof item === "object" ? Number(item.idItem ?? item.id) : Number(item)),
  };
}

async function guardarEvaluacionCalidadLocal(evaluacion) {
  const registro = {
    ...evaluacion,
    correlationId: generarUUID(),
    syncStatus: "Pendiente",
    updatedAt: new Date().toISOString(),
  };
  await OfflineDb.put("calidadEvaluaciones", registro);
  return registro;
}

async function obtenerPendientesCalidad() {
  const todas = await OfflineDb.getAll("calidadEvaluaciones");
  return todas.filter((e) => e.syncStatus && e.syncStatus !== "Sincronizado");
}

async function contarPendientesCalidad() {
  return (await obtenerPendientesCalidad()).length;
}

async function sincronizarPendientesCalidad() {
  const todas = await OfflineDb.getAll("calidadEvaluaciones");
  const pendientes = todas.filter((e) => e.syncStatus && e.syncStatus !== "Sincronizado");
  const resultado = { subidas: 0, fallidas: 0, subidasIds: [], errores: [] };
  const reservas = new Map();
  for (const e of pendientes) {
    let evaluacion = e;
    try {
      evaluacion = await prepararRevisionCalidadPendiente(e, reservas);
      try {
        // Primero se conserva la misma revisión: si ya llegó a la API con este CorrelationId,
        // el servidor devuelve esa misma evaluación y el pendiente queda confirmado.
        await conReintento(() => apiPostOnline("/api/calidad/evaluaciones", cuerpoEvaluacionCalidad(evaluacion)), 3);
      } catch (err) {
        if (!(err instanceof ErrorApi) || err.status !== 409) throw err;
        // Solo un conflicto real de revisión recibe un número nuevo.
        evaluacion = await reservarSiguienteRevisionCalidad(evaluacion, reservas);
        await conReintento(() => apiPostOnline("/api/calidad/evaluaciones", cuerpoEvaluacionCalidad(evaluacion)), 3);
      }
      await OfflineDb.put("calidadEvaluaciones", { ...evaluacion, syncStatus: "Sincronizado", errorMensaje: null, updatedAt: new Date().toISOString() });
      await registrarRevisionCalidadConfirmada(evaluacion.colaborador, evaluacion.revision, evaluacion.semana);
      resultado.subidas++;
      resultado.subidasIds.push(evaluacion.correlationId);
    } catch (err) {
      const reintentable = esErrorReintentable(err);
      resultado.fallidas++;
      await OfflineDb.put("calidadEvaluaciones", { ...evaluacion, syncStatus: reintentable ? "Pendiente" : "Error", errorMensaje: err.message, updatedAt: new Date().toISOString() });
      resultado.errores.push({ correlationId: evaluacion.correlationId, mensaje: err.message, reintentable });
      console.error("No se pudo sincronizar evaluación de Calidad Siembra", evaluacion.correlationId, err);
    }
  }
  return resultado;
}

const SyncEngine = {
  RedNoDisponibleError,
  esErrorReintentable,
  generarUUID,
  fetchApi,
  apiGetOnline,
  apiPostOnline,
  apiDeleteOnline,
  conReintento,
  fmtFechaISO,
  sincronizarCatalogos,
  obtenerCatalogosLocal,
  semanaQueContiene,
  sincronizarSiembrasDesdeServidor,
  fechaLocalISO,
  sincronizarSiembrasRecientes,
  guardarSiembraLocal,
  contarPendientesSiembra,
  obtenerTodasSiembrasLocal,
  sincronizarPendientesSiembra,
  guardarDiaPendiente,
  limpiarDiaPendiente,
  listarDiasPendientes,
  guardarMovimientoPendiente,
  limpiarMovimientoPendiente,
  listarMovimientosPendientes,
  contarPendientesPronosticos,
  sincronizarCatalogoCorte,
  obtenerCatalogoCorteLocal,
  observacionesDelItem,
  contarRevisionesHoyLocal,
  guardarRevisionCorteLocal,
  contarPendientesCorte,
  sincronizarPendientesCorte,
  sincronizarCatalogoCalidad,
  obtenerCatalogoCalidadLocal,
  obtenerMayorRevisionCalidadLocal,
  registrarRevisionCalidadConfirmada,
  guardarEvaluacionCalidadLocal,
  obtenerPendientesCalidad,
  contarPendientesCalidad,
  sincronizarPendientesCalidad,
  sincronizarHorasDesdeServidor,
  obtenerHorasLocalPorRango,
  guardarHorasLocal,
  contarPendientesHoras,
  sincronizarPendientesHoras,
};
