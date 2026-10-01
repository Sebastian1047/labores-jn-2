// resolveApiBaseUrl/API_BASE_URL ahora viven en offline/api-base.js (cargado antes que este archivo).
const SEDE = "JN";
const HORIZONTE_SEMANAS = 8;

const sesion = JSON.parse(sessionStorage.getItem("labores_usuario") || "null") || { username: "PRUEBA.WEB", role: "Administrador", empleadoNombre: "Modo prueba" };
if (!sesion) {
  window.location.href = "./login.html";
}
const USUARIO = sesion ? sesion.username : "prueba.web";

function isoWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
}

const apiStatusPill = document.querySelector("#apiStatusPill");
const usuarioLabel = document.querySelector("#usuarioLabel");
const variedadSelect = document.querySelector("#variedadSelect");
const variedadBuscar = document.querySelector("#variedadBuscar");
const semanaInicioInput = document.querySelector("#semanaInicio");
const anoInput = document.querySelector("#ano");
const variedadTitulo = document.querySelector("#variedadTitulo");
const semanasContenedor = document.querySelector("#semanasContenedor");
const resumenVariedad = document.querySelector("#resumenVariedad");
const refreshBtn = document.querySelector("#refreshBtn");
const sincronizarBtn = document.querySelector("#sincronizarBtn");
const exportarExcelBtn = document.querySelector("#exportarExcelBtn");
const syncEstado = document.querySelector("#syncEstado");

const moverRamosModal = document.querySelector("#moverRamosModal");
const moverVariedadLabel = document.querySelector("#moverVariedadLabel");
const moverDiaOrigen = document.querySelector("#moverDiaOrigen");
const moverSemanaDestino = document.querySelector("#moverSemanaDestino");
const moverCantidad = document.querySelector("#moverCantidad");
const moverObservacion = document.querySelector("#moverObservacion");
const moverCerrarBtn = document.querySelector("#moverCerrarBtn");
const moverConfirmarBtn = document.querySelector("#moverConfirmarBtn");
const moverResultado = document.querySelector("#moverResultado");

const movimientosDiaModal = document.querySelector("#movimientosDiaModal");
const movimientosVariedadLabel = document.querySelector("#movimientosVariedadLabel");
const movimientosLista = document.querySelector("#movimientosLista");
const movimientosCerrarBtn = document.querySelector("#movimientosCerrarBtn");

usuarioLabel.textContent = USUARIO;
const hoy = new Date();
anoInput.value = hoy.getFullYear();
semanaInicioInput.value = isoWeek(hoy);

/** @type {Map<string, any>} variedades por codigoVariedad, cada una con .semanas[] */
let variedadesData = new Map();
/** @type {Map<string, any>} dias editables por "variedad|fechaISO" */
let diasEditables = new Map();
/** @type {any[]} historial completo de movimientos YA sincronizados (Envia/Recibe reales),
 * descargado con el mismo horizonte de semanas que el resumen -- disponible offline. */
let movimientosHistorial = [];
let variedadActiva = null;
/** @type {Set<string>} claves de días guardados localmente y aún no subidos al servidor */
let clavesPendientes = new Set();

const apiGet = SyncEngine.apiGetOnline;
const apiPost = SyncEngine.apiPostOnline;

function fmtDate(value) {
  if (!value) return "-";
  return String(value).substring(0, 10);
}

async function checkApi() {
  try {
    await apiGet(`/api/pronosticos/resumen-agrupado/1?ano=${anoInput.value}`);
    apiStatusPill.textContent = "En línea";
    apiStatusPill.classList.add("ok");
  } catch {
    apiStatusPill.textContent = "Sin conexión (modo offline)";
    apiStatusPill.classList.add("warn");
  }
}

function claveDia(variedadCodigo, fechaISO) {
  return `${variedadCodigo}|${fechaISO}`;
}

async function refrescarPendientes() {
  const [dias, movs] = await Promise.all([SyncEngine.listarDiasPendientes(), SyncEngine.listarMovimientosPendientes()]);
  clavesPendientes = new Set(dias.map((d) => d.clave));
  if (movs.length > 0) {
    syncEstado.textContent = `${dias.length} día(s) y ${movs.length} movimiento(s) pendientes de sincronizar.`;
  } else if (dias.length > 0) {
    syncEstado.textContent = `${dias.length} día(s) pendientes de sincronizar.`;
  }
}

async function cargarTodo() {
  const semanaInicio = Number(semanaInicioInput.value) || 1;
  const ano = Number(anoInput.value);

  try {
    const [resumen, dias, movimientos] = await Promise.all([
      apiGet(`/api/pronosticos/resumen-agrupado/${semanaInicio}?ano=${ano}`),
      apiGet(
        `/api/pronosticos/dias?sedeCodigo=${SEDE}&ano=${ano}&semanaInicio=${semanaInicio}&semanas=${HORIZONTE_SEMANAS}`
      ).catch(() => []),
      apiGet(
        `/api/pronosticos/movimientos?sedeCodigo=${SEDE}&ano=${ano}&semanaInicio=${semanaInicio}&semanas=${HORIZONTE_SEMANAS}`
      ).catch(() => []),
    ]);

    variedadesData = new Map(resumen.map((v) => [v.codigoVariedad, v]));

    diasEditables = new Map();
    for (const dia of dias) {
      diasEditables.set(claveDia(dia.variedadCodigo, fmtDate(dia.fechaReal)), dia);
    }

    movimientosHistorial = movimientos;

    await OfflineDb.clear("pronosticosResumen");
    await OfflineDb.putMany(
      "pronosticosResumen",
      resumen.map((v) => ({ variedadCodigo: v.codigoVariedad, ano, semanaInicio, datos: v }))
    );
    await OfflineDb.clear("movimientosHistorial");
    await OfflineDb.putMany("movimientosHistorial", movimientos);
  } catch (err) {
    if (!(err instanceof SyncEngine.RedNoDisponibleError)) throw err;

    // Cada sincronizacion exitosa limpia "pronosticosResumen" completo antes de re-llenarlo
    // (OfflineDb.clear + putMany abajo), asi que en un momento dado TODO lo cacheado es
    // siempre de la misma semanaInicio -- la de la ultima vez que si hubo red. Antes esto
    // exigia que esa semanaInicio coincidiera EXACTO con lo que el usuario tuviera tipeado
    // ahora mismo (ej. si el campo volvio a su default al recargar la pagina), y si no
    // coincidia se quedaba vacio en silencio aunque SI hubiera datos utiles guardados --
    // "Mover Ramos" y todo lo demas quedaba sin nada que mostrar. Bug real de campo, 17/09/2026.
    const cache = await OfflineDb.getAll("pronosticosResumen");
    const cacheDelAno = cache.filter((c) => c.ano === ano);
    variedadesData = new Map(cacheDelAno.map((c) => [c.variedadCodigo, c.datos]));
    if (cacheDelAno.length > 0 && cacheDelAno[0].semanaInicio !== semanaInicio) {
      // Reflejar en el campo la semana real de los datos que se estan mostrando, para no
      // dejar la pantalla diciendo "Semana Inicial: 38" mientras en realidad muestra la 37.
      semanaInicioInput.value = cacheDelAno[0].semanaInicio;
    }
    diasEditables = new Map();
    movimientosHistorial = await OfflineDb.getAll("movimientosHistorial");
  }

  // Reaplicar ediciones locales aún no sincronizadas encima de lo recién cargado.
  for (const pendiente of await SyncEngine.listarDiasPendientes()) {
    diasEditables.set(pendiente.clave, {
      variedadCodigo: pendiente.variedadCodigo,
      fechaReal: pendiente.fechaReal,
      totalFinalDia: pendiente.totalFinalDia,
    });
  }
  await refrescarPendientes();

  poblarVariedadSelect();

  if (variedadActiva && variedadesData.has(variedadActiva)) {
    renderVariedad(variedadActiva);
  } else if (variedadesData.size > 0) {
    variedadActiva = [...variedadesData.keys()][0];
    variedadSelect.value = variedadActiva;
    renderVariedad(variedadActiva);
  } else {
    variedadTitulo.textContent = "Sin siembras en este rango de semanas";
    semanasContenedor.innerHTML = "<p class='hint'>No hay variedades con floración estimada para estas semanas.</p>";
  }
}

function poblarVariedadSelect() {
  const filtro = (variedadBuscar.value || "").trim().toLowerCase();
  const opciones = [...variedadesData.values()]
    .filter(
      (v) =>
        !filtro ||
        v.nombreVariedad.toLowerCase().includes(filtro) ||
        v.codigoVariedad.toLowerCase().includes(filtro)
    )
    .sort((a, b) => a.categoria.localeCompare(b.categoria) || a.nombreVariedad.localeCompare(b.nombreVariedad));

  const seleccionPrevia = variedadSelect.value;
  variedadSelect.innerHTML = opciones
    .map((v) => `<option value="${v.codigoVariedad}">${v.categoria} · ${v.nombreVariedad}</option>`)
    .join("");

  if (opciones.some((v) => v.codigoVariedad === seleccionPrevia)) {
    variedadSelect.value = seleccionPrevia;
  }
}

function totalFinalDia(variedadCodigo, dia) {
  const registro = diasEditables.get(claveDia(variedadCodigo, dia.fechaReal));
  if (registro) {
    return { valor: Number(registro.totalFinalDia), editado: true, registro };
  }
  return { valor: Number(dia.totalRamosDia), editado: false, registro: null };
}

function semaforoClase(sbr, nuevoTotal) {
  if (nuevoTotal == null) return "semaforo-nueva";
  if (nuevoTotal === sbr) return "semaforo-igual";
  return nuevoTotal > sbr ? "semaforo-subio" : "semaforo-bajo";
}

// "Segun donde este el pronosticador parado": no es un filtro manual aparte -- se filtra solo
// por la variedad y el dia que ya esta viendo (mismo patron que VerMovimientosDiaCommand en
// AppLabores), sobre el historial ya descargado con el mismo horizonte semanaInicio/año.
function movimientosDelDia(codigoVariedad, fechaISO) {
  return movimientosHistorial.filter(
    (m) => m.variedadCodigo === codigoVariedad && (m.diaOrigen === fechaISO || m.diaDestino === fechaISO)
  );
}

function renderVariedad(codigoVariedad) {
  variedadActiva = codigoVariedad;
  const variedad = variedadesData.get(codigoVariedad);
  if (!variedad) return;

  variedadTitulo.textContent = `${variedad.categoria} · ${variedad.nombreVariedad}`;

  const semanasHtml = variedad.semanas
    .map((semana) => {
      const totalNuevo = semana.dias.reduce((acc, dia) => acc + totalFinalDia(codigoVariedad, dia).valor, 0);
      const sema = semaforoClase(semana.totalRamosSemana, totalNuevo);

      const diasHtml = semana.dias
        .map((dia) => {
          const { valor, editado } = totalFinalDia(codigoVariedad, dia);
          const pendiente = clavesPendientes.has(claveDia(codigoVariedad, fmtDate(dia.fechaReal)));
          const movsDia = movimientosDelDia(codigoVariedad, fmtDate(dia.fechaReal));
          return `
            <div class="dia-row" data-fecha="${dia.fechaReal}">
              <div class="dia-fecha">
                <strong>${dia.diaTexto}</strong>
                <span>Base calculado: ${dia.totalRamosDia} ramos (${dia.totalTallosDia} tallos)</span>
              </div>
              <input type="number" class="dia-total-input" min="0" step="1" value="${valor}" />
              <label><input type="checkbox" class="dia-confirmado" ${editado ? "checked" : ""} disabled /> Guardado</label>
              ${pendiente ? '<span class="pill" style="color: var(--amber); border-color: var(--amber);">pendiente</span>' : ""}
              ${movsDia.length > 0 ? `<button type="button" class="ghost-btn ver-movimientos-btn" data-fecha="${dia.fechaReal}" data-dia-texto="${dia.diaTexto}">Ver movimientos (${movsDia.length})</button>` : ""}
            </div>`;
        })
        .join("");

      return `
        <article class="semana-card" data-semana="${semana.numeroSemana}">
          <div class="semana-card-head">
            <span class="semana-badge"><span class="semaforo-dot ${sema}"></span>Semana ${semana.numeroSemana} (${fmtDate(
        semana.fechaInicio
      )} - ${fmtDate(semana.fechaFin)})</span>
            <div class="semana-totales">
              <div class="semana-total-item"><span>Sbr (fijo)</span><strong>${semana.totalRamosSemana}</strong></div>
              <div class="semana-total-item"><span>Nuevo total</span><strong id="nuevoTotal-${semana.numeroSemana}">${totalNuevo}</strong></div>
            </div>
          </div>

          <div class="dias-list">${diasHtml || "<p class='hint'>Sin días de floración calculados en esta semana.</p>"}</div>

          <textarea class="semana-nota" placeholder="Nota de la semana (opcional)" data-semana="${semana.numeroSemana}"></textarea>

          <div class="action-row" style="margin-bottom: 0;">
            <button class="success-btn guardar-semana-btn" type="button" data-semana="${semana.numeroSemana}">Guardar semana</button>
            ${semana.dias.length > 0 ? `<button class="ghost-btn mover-ramos-btn" type="button" data-semana="${semana.numeroSemana}">Mover ramos</button>` : ""}
          </div>
        </article>`;
    })
    .join("");

  semanasContenedor.innerHTML = semanasHtml || "<p class='hint'>Esta variedad no tiene semanas en el rango consultado.</p>";

  semanasContenedor.querySelectorAll(".dia-total-input").forEach((input) => {
    input.addEventListener("input", (ev) => {
      const card = ev.target.closest(".semana-card");
      const numeroSemana = card.dataset.semana;
      const total = [...card.querySelectorAll(".dia-total-input")].reduce((acc, el) => acc + (Number(el.value) || 0), 0);
      card.querySelector(`#nuevoTotal-${numeroSemana}`).textContent = total;
    });
  });

  semanasContenedor.querySelectorAll(".guardar-semana-btn").forEach((btn) => {
    btn.addEventListener("click", () => guardarSemana(codigoVariedad, Number(btn.dataset.semana)));
  });

  semanasContenedor.querySelectorAll(".mover-ramos-btn").forEach((btn) => {
    btn.addEventListener("click", () => abrirModalMover(codigoVariedad, Number(btn.dataset.semana)));
  });

  semanasContenedor.querySelectorAll(".ver-movimientos-btn").forEach((btn) => {
    btn.addEventListener("click", () => abrirModalMovimientos(codigoVariedad, btn.dataset.fecha, btn.dataset.diaTexto));
  });

  renderResumenVariedad(variedad);
}

function renderResumenVariedad(variedad) {
  const totalSbr = variedad.semanas.reduce((acc, s) => acc + s.totalRamosSemana, 0);
  const totalNuevo = variedad.semanas.reduce(
    (acc, s) => acc + s.dias.reduce((a, d) => a + totalFinalDia(variedad.codigoVariedad, d).valor, 0),
    0
  );
  resumenVariedad.innerHTML = `
    <div class="pending-item">
      <strong>${variedad.nombreVariedad}</strong>
      <span>Categoría: ${variedad.categoria}</span>
      <span>Código: ${variedad.codigoVariedad}</span>
      <span>Semanas con floración: ${variedad.semanas.length}</span>
      <span>Sbr total del horizonte: ${totalSbr}</span>
      <span>Nuevo total del horizonte: ${totalNuevo}</span>
    </div>`;
}

async function guardarDia(codigoVariedad, categoria, numeroSemana, fechaReal, totalFinal, totalBase, nota, syncBatchId) {
  const request = {
    sedeCodigo: SEDE,
    variedadCodigo: codigoVariedad,
    tipo: categoria,
    semana: numeroSemana,
    ano: Number(anoInput.value),
    usuario: USUARIO,
    fechaReal,
    totalFinalDia: totalFinal,
    totalBaseDia: totalBase,
    dispositivoCodigo: "WEB-PRONOSTICOS",
    observacion: nota || null,
    origenModificacion: "WEB",
    syncVersionCliente: null,
    syncBatchId: syncBatchId || null,
  };

  const clave = claveDia(codigoVariedad, fmtDate(fechaReal));

  try {
    await apiPost("/api/pronosticos/dias", request);
    await SyncEngine.limpiarDiaPendiente(clave);
  } catch (err) {
    if (!(err instanceof SyncEngine.RedNoDisponibleError)) throw err;
    await SyncEngine.guardarDiaPendiente(clave, request);
  }

  diasEditables.set(clave, {
    variedadCodigo: codigoVariedad,
    fechaReal,
    totalFinalDia: totalFinal,
  });
  await refrescarPendientes();
}

async function guardarSemana(codigoVariedad, numeroSemana) {
  const variedad = variedadesData.get(codigoVariedad);
  const semana = variedad.semanas.find((s) => s.numeroSemana === numeroSemana);
  const card = semanasContenedor.querySelector(`.semana-card[data-semana="${numeroSemana}"]`);
  const nota = card.querySelector(".semana-nota").value.trim();

  const filas = [...card.querySelectorAll(".dia-row")];
  let errores = 0;

  for (const fila of filas) {
    const fechaReal = fila.dataset.fecha;
    const totalFinal = Number(fila.querySelector(".dia-total-input").value);
    const diaBase = semana.dias.find((d) => d.fechaReal === fechaReal);

    try {
      await guardarDia(codigoVariedad, variedad.categoria, numeroSemana, fechaReal, totalFinal, diaBase ? diaBase.totalRamosDia : null, nota, null);
    } catch (err) {
      errores += 1;
      console.error("Error guardando dia", fechaReal, err);
    }
  }

  renderVariedad(codigoVariedad);
  const btnActualizado = semanasContenedor.querySelector(`.semana-card[data-semana="${numeroSemana}"] .guardar-semana-btn`);
  btnActualizado.textContent = errores ? `Error en ${errores} día(s)` : "Guardado ✓";
  setTimeout(() => {
    btnActualizado.textContent = "Guardar semana";
  }, 2500);
}

async function sincronizarTodo() {
  sincronizarBtn.disabled = true;
  syncEstado.textContent = "Iniciando sincronización…";
  try {
    const inicio = await apiPost("/api/pronosticos/sync/iniciar", {
      sedeCodigo: SEDE,
      usuario: USUARIO,
      dispositivoCodigo: "WEB-PRONOSTICOS",
    });
    const syncBatchId = inicio.datos.syncBatchId;

    // Primero, movimientos de "Mover ramos" hechos sin conexión.
    for (const mov of await SyncEngine.listarMovimientosPendientes()) {
      try {
        await apiPost("/api/pronosticos/movimientos", mov);
        await SyncEngine.limpiarMovimientoPendiente(mov.idOperacion);
      } catch (err) {
        console.error("No se pudo subir movimiento pendiente", mov.idOperacion, err);
      }
    }

    let enviados = 0;
    let errores = 0;
    for (const variedad of variedadesData.values()) {
      for (const semana of variedad.semanas) {
        for (const dia of semana.dias) {
          const totalFinal = totalFinalDia(variedad.codigoVariedad, dia).valor;
          try {
            await guardarDia(
              variedad.codigoVariedad,
              variedad.categoria,
              semana.numeroSemana,
              dia.fechaReal,
              totalFinal,
              dia.totalRamosDia,
              null,
              syncBatchId
            );
            enviados += 1;
          } catch (err) {
            errores += 1;
            console.error("Error en sincronizacion", variedad.codigoVariedad, dia.fechaReal, err);
          }
        }
      }
    }

    await apiPost("/api/pronosticos/sync/completar", {
      syncBatchId,
      estado: errores > 0 ? "INCOMPLETA" : "COMPLETA",
      filasDiaEnviadas: enviados,
      observacion: errores > 0 ? `${errores} día(s) fallaron` : null,
    });

    await refrescarPendientes();
    syncEstado.textContent = `Sincronizado: ${enviados} día(s)${errores ? `, ${errores} con error` : ""}.`;
    if (variedadActiva) renderVariedad(variedadActiva);
  } catch (err) {
    if (err instanceof SyncEngine.RedNoDisponibleError) {
      syncEstado.textContent = "Sin conexión: tus cambios ya están guardados en este equipo y se sincronizarán cuando vuelva la señal.";
    } else {
      syncEstado.textContent = `Error de sincronización: ${err.message}`;
    }
  } finally {
    sincronizarBtn.disabled = false;
  }
}

function exportarExcel() {
  const semanaInicio = Number(semanaInicioInput.value) || 1;
  const ano = Number(anoInput.value);
  window.location.href = `${API_BASE_URL}/api/pronosticos/resumen-agrupado/${semanaInicio}/excel?sedeCodigo=${SEDE}&ano=${ano}`;
}

function abrirModalMovimientos(codigoVariedad, fechaISO, diaTexto) {
  const variedad = variedadesData.get(codigoVariedad);
  const movs = movimientosDelDia(codigoVariedad, fechaISO);

  movimientosVariedadLabel.textContent = `${variedad?.nombreVariedad || codigoVariedad} — ${diaTexto}`;
  movimientosLista.innerHTML = movs
    .map((m) => {
      const esEnvia = m.tipo === "Envia";
      const otroLado = esEnvia ? `→ semana ${m.semanaDestino ?? "-"}` : `← semana ${m.semanaOrigen ?? "-"}`;
      return `
        <div class="pending-item">
          <strong>${esEnvia ? "📤 Envía" : "📥 Recibe"} ${Number(m.cantidad)} ramos</strong>
          <span>${otroLado} · ${m.usuario}${m.fechaMovimiento ? " · " + fmtDate(m.fechaMovimiento) : ""}</span>
          ${m.observacion ? `<span>Obs: ${m.observacion}</span>` : ""}
        </div>`;
    })
    .join("");
  if (movs.length === 0) {
    movimientosLista.innerHTML = "<p class='hint'>Sin movimientos registrados para este día.</p>";
  }

  movimientosDiaModal.hidden = false;
}

function abrirModalMover(codigoVariedad, numeroSemanaOrigen) {
  const variedad = variedadesData.get(codigoVariedad);
  const semanaOrigen = variedad.semanas.find((s) => s.numeroSemana === numeroSemanaOrigen);

  moverVariedadLabel.textContent = `${variedad.nombreVariedad} — semana origen ${numeroSemanaOrigen}`;
  moverDiaOrigen.innerHTML = semanaOrigen.dias
    .map((d) => `<option value="${d.fechaReal}">${d.diaTexto} (${totalFinalDia(codigoVariedad, d).valor} ramos)</option>`)
    .join("");
  moverSemanaDestino.innerHTML = variedad.semanas
    .filter((s) => s.numeroSemana !== numeroSemanaOrigen)
    .map((s) => `<option value="${s.numeroSemana}">Semana ${s.numeroSemana} (${fmtDate(s.fechaInicio)})</option>`)
    .join("");
  moverCantidad.value = "";
  moverObservacion.value = "";
  moverResultado.textContent = "Sin mover aún";
  moverConfirmarBtn.dataset.variedad = codigoVariedad;
  moverConfirmarBtn.dataset.semanaOrigen = numeroSemanaOrigen;

  moverRamosModal.hidden = false;
}

async function confirmarMover() {
  const codigoVariedad = moverConfirmarBtn.dataset.variedad;
  const semanaOrigen = Number(moverConfirmarBtn.dataset.semanaOrigen);
  const semanaDestino = Number(moverSemanaDestino.value);
  const fechaOrigen = moverDiaOrigen.value;
  const cantidad = Number(moverCantidad.value);
  const variedad = variedadesData.get(codigoVariedad);
  const semanaDestinoObj = variedad.semanas.find((s) => s.numeroSemana === semanaDestino);
  const fechaDestino = semanaDestinoObj?.dias?.[0]?.fechaReal ?? null;

  if (!cantidad || cantidad <= 0) {
    moverResultado.textContent = "La cantidad debe ser mayor que cero";
    return;
  }

  const base = {
    sedeCodigo: SEDE,
    variedadCodigo: codigoVariedad,
    usuario: USUARIO,
    cantidad,
    semanaOrigen,
    semanaDestino,
    diaOrigen: fechaOrigen,
    diaDestino: fechaDestino,
    fechaOrigen,
    fechaDestino,
    observacion: moverObservacion.value.trim() || null,
    origenModificacion: "WEB",
  };
  const envia = { ...base, idOperacion: generarUUID(), tipo: "Envia" };
  const recibe = { ...base, idOperacion: generarUUID(), tipo: "Recibe" };

  try {
    await apiPost("/api/pronosticos/movimientos", envia);
    await apiPost("/api/pronosticos/movimientos", recibe);
    moverResultado.textContent = "Movimiento registrado";
    await cargarTodo();
  } catch (err) {
    if (!(err instanceof SyncEngine.RedNoDisponibleError)) {
      moverResultado.textContent = err.message;
      return;
    }
    await SyncEngine.guardarMovimientoPendiente(envia);
    await SyncEngine.guardarMovimientoPendiente(recibe);
    aplicarMovimientoLocal(codigoVariedad, fechaOrigen, fechaDestino, cantidad);
    await refrescarPendientes();
    moverResultado.textContent = "Sin conexión: movimiento guardado localmente (pendiente de sincronizar).";
    renderVariedad(variedadActiva);
  }

  setTimeout(() => {
    moverRamosModal.hidden = true;
  }, 900);
}

function aplicarMovimientoLocal(codigoVariedad, fechaOrigen, fechaDestino, cantidad) {
  const variedad = variedadesData.get(codigoVariedad);
  const todosLosDias = variedad.semanas.flatMap((s) => s.dias);
  const diaOrigen = todosLosDias.find((d) => d.fechaReal === fechaOrigen);
  const diaDestino = todosLosDias.find((d) => d.fechaReal === fechaDestino);

  if (diaOrigen) {
    const actual = totalFinalDia(codigoVariedad, diaOrigen).valor;
    diasEditables.set(claveDia(codigoVariedad, fmtDate(fechaOrigen)), {
      variedadCodigo: codigoVariedad,
      fechaReal: fechaOrigen,
      totalFinalDia: actual - cantidad,
    });
  }
  if (diaDestino) {
    const actual = totalFinalDia(codigoVariedad, diaDestino).valor;
    diasEditables.set(claveDia(codigoVariedad, fmtDate(fechaDestino)), {
      variedadCodigo: codigoVariedad,
      fechaReal: fechaDestino,
      totalFinalDia: actual + cantidad,
    });
  }
}

variedadSelect.addEventListener("change", () => renderVariedad(variedadSelect.value));
variedadBuscar.addEventListener("input", poblarVariedadSelect);
semanaInicioInput.addEventListener("change", cargarTodo);
anoInput.addEventListener("change", cargarTodo);
refreshBtn.addEventListener("click", cargarTodo);
sincronizarBtn.addEventListener("click", sincronizarTodo);
exportarExcelBtn.addEventListener("click", exportarExcel);
moverCerrarBtn.addEventListener("click", () => {
  moverRamosModal.hidden = true;
});
moverConfirmarBtn.addEventListener("click", confirmarMover);
movimientosCerrarBtn.addEventListener("click", () => {
  movimientosDiaModal.hidden = true;
});

checkApi();
cargarTodo();
