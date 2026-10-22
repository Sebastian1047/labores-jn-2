const form = document.querySelector("#formDesbotonado");
const fechaInput = document.querySelector("#fecha");
const empleadoSelect = document.querySelector("#desbotonador");
const empleadoBuscar = document.querySelector("#desbotonadorBuscar");
const empleadoLista = document.querySelector("#desbotonadorLista");
const colaboradorSeleccionadoEl = document.querySelector("#colaboradorSeleccionado");
const bloqueLista = document.querySelector("#bloqueLista");
const bloqueInput = document.querySelector("#bloque");
const camaBuscar = document.querySelector("#camaBuscar");
const camaLista = document.querySelector("#camaLista");
const desbotonadoObservaciones = document.querySelector("#desbotonadoObservaciones");

const viewTabs = [...document.querySelectorAll("[data-desbotonado-vista]")];
const vistaRegistro = document.querySelector("#vistaRegistro");
const vistaTiempos = document.querySelector("#vistaTiempos");

const TIPOS_LABOR = ["Desbotón Pompón", "Desbotón Spider", "Malla"];
let tipoLaborActivo = TIPOS_LABOR[0];
const registros = [];
// Índice del registro de cama que está abierto para corregir; null significa nuevo registro.
let indiceRegistroEditando = null;
// Los colaboradores y sus camas se conservan al alternar trabajadores y vistas.
const colaboradoresJornada = new Map();
const SESSION_LABOR_KEY = "laboresJn:desbotonado-mallas:jornada:" +
  (JSON.parse(sessionStorage.getItem("labores_usuario") || "null")?.username || "local");
let catalogos = { empleados: [], camas: [] };
/* Los tiempos tienen la misma estructura para las tres actividades, sin mezclar fechas ni roles.
   Solo colaboradores con al menos una cama guardada aparecen en Tiempos. */
window.DesbotonadoLaborTiemposSnapshot = function () {
  const fecha=fechaInput.value,rol=tipoLaborActivo;
  const personas=new Map();
  registros.filter(r=>r.fecha===fecha&&r.tipoLabor===rol&&r.colaborador).forEach(r=>{
    const codigo=String(r.colaborador);
    const persona=personas.get(codigo)||{
      codigo,colaborador:r.colaboradorNombre||
        colaboradoresJornada.get(claveColaborador(fecha,codigo,rol))?.nombre||codigo,
      camas:0
    };
    persona.camas++;
    personas.set(codigo,persona);
  });
  return {fecha,rol,grupos:[...personas.values()].sort((a,b)=>a.colaborador.localeCompare(b.colaborador,"es"))};
};


function claveColaborador(fecha, codigo, tipoLabor = tipoLaborActivo) {
  return [String(fecha || ""), String(tipoLabor || "Sin clasificar"), String(codigo || "")].join("|");
}

function guardarJornada() {
  try {
    sessionStorage.setItem(SESSION_LABOR_KEY, JSON.stringify({
      colaboradores: [...colaboradoresJornada.values()],
      registros
    }));
  } catch (error) {
    console.warn("No fue posible conservar esta jornada en la sesión", error);
  }
}

function restaurarJornada() {
  try {
    const datos = JSON.parse(sessionStorage.getItem(SESSION_LABOR_KEY) || "{}");
    if (Array.isArray(datos.colaboradores)) datos.colaboradores.forEach((c) => {
      if (!c?.fecha || !c?.codigo) return;
      // Los colaboradores antiguos sin una actividad conocida NO se mezclan.
      const tipo = TIPOS_LABOR.includes(c.tipoLabor) ? c.tipoLabor : "Sin clasificar";
      colaboradoresJornada.set(claveColaborador(c.fecha, c.codigo, tipo), {
        fecha: String(c.fecha), codigo: String(c.codigo),
        nombre: String(c.nombre || c.codigo), tipoLabor: tipo
      });
    });
    if (Array.isArray(datos.registros)) datos.registros.forEach((r) => {
      if (!r?.fecha || !r?.colaborador || !r?.cama) return;
      registros.push(r);
      if (!TIPOS_LABOR.includes(r.tipoLabor)) return;
      const key = claveColaborador(r.fecha, r.colaborador, r.tipoLabor);
      if (!colaboradoresJornada.has(key)) colaboradoresJornada.set(key, {
        fecha: r.fecha, codigo: String(r.colaborador),
        nombre: r.colaboradorNombre || String(r.colaborador),
        tipoLabor: r.tipoLabor
      });
    });
  } catch (error) {
    console.warn("No se pudieron restaurar los registros de la jornada", error);
  }
}

function escaparHtml(value) {
  return String(value ?? "").replace(/&/g, "&amp;")
    .replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

// Un registro es único por fecha + colaborador + tipo + bloque + cama.
// Normalizar la escritura evita repetir la cama usando "Cama 09" y "9".
function normalizarUbicacion(valor) {
  const limpio = String(valor ?? "").trim().toLocaleUpperCase("es").replace(/\s+/g, "");
  return /^0+\d+$/.test(limpio) ? limpio.replace(/^0+(?=\d)/, "") : limpio;
}
function normalizarNumeroCama(valor) {
  const sinPrefijo = String(valor ?? "").trim().replace(/^CAMA[\s#:.–-]+/i, "");
  return normalizarUbicacion(sinPrefijo);
}
function registroCamaDuplicado({ fecha, colaborador, tipoLabor, bloque, cama, excluirIndice = null }) {
  const bloqueNormalizado = normalizarUbicacion(bloque);
  const camaNormalizada = normalizarNumeroCama(cama);
  return registros.some((r, indice) =>
    indice !== excluirIndice &&
    r.fecha === fecha &&
    String(r.colaborador) === String(colaborador) &&
    String(r.tipoLabor || "").trim() === String(tipoLabor || "").trim() &&
    normalizarUbicacion(r.bloque) === bloqueNormalizado &&
    normalizarNumeroCama(r.cama) === camaNormalizada
  );
}

const texto = (obj, ...keys) => {
  for (const key of keys) if (obj?.[key] != null) return String(obj[key]);
  return "";
};

function fechaLocal() {
  const hoy = new Date();
  const yyyy = hoy.getFullYear();
  const mm = String(hoy.getMonth() + 1).padStart(2, "0");
  const dd = String(hoy.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function aplicarVista(vista) {
  const esTiempos = vista === "tiempos";
  vistaRegistro.hidden = esTiempos;
  vistaTiempos.hidden = !esTiempos;
  if(esTiempos)window.DesbotonadoDetalleRecargar?.();
  viewTabs.forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.desbotonadoVista === (esTiempos ? "tiempos" : "registro"));
  });
}

viewTabs.forEach((btn) => {
  btn.addEventListener("click", () => aplicarVista(btn.dataset.desbotonadoVista));
});
function cambiarTipoLabor(tipo) {
  if (!TIPOS_LABOR.includes(tipo)) return;
  tipoLaborActivo = tipo;
  document.querySelectorAll("[data-desbotonado-labor]").forEach((btn) => {
    const activo = btn.dataset.desbotonadoLabor === tipo;
    btn.classList.toggle("active", activo);
    btn.setAttribute("aria-pressed", String(activo));
  });
  document.querySelector("#laborSeleccionadaTexto").textContent = tipo;
  document.querySelector("#encabezadoRegistroLabor").textContent = "Registrar cama · " + tipo;
  document.querySelector("#tituloDetalleLabor").textContent = "Detalle de la jornada · " + tipo;
  empleadoSelect.innerHTML = '<option value=""></option>';
  empleadoBuscar.value = "";
  empleadoLista.innerHTML = "";
  colaboradorSeleccionadoEl.textContent = "Sin colaborador seleccionado";
  limpiarCamposCama();
  document.querySelector("#apiMensaje").textContent = "Registro local disponible · " + tipo;
  aplicarVista("registro");
  render();
}
document.querySelectorAll("[data-desbotonado-labor]").forEach((btn) => {
  btn.addEventListener("click", () => cambiarTipoLabor(btn.dataset.desbotonadoLabor));
});

function cargarEmpleados(filtro = "") {
  const consulta = filtro.trim().toLowerCase();
  const visibles = catalogos.empleados
    .slice()
    .sort((a,b) => texto(a,"nombre","Nombre").localeCompare(texto(b,"nombre","Nombre"),"es"))
    .filter((e) => `${texto(e,"nombre","Nombre","descripcion")} (${texto(e,"codigo","Codigo","cedula","Cedula")})`.toLowerCase().includes(consulta))
    .slice(0,40);

  empleadoSelect.innerHTML = '<option value="">Seleccione un colaborador</option>';
  empleadoLista.innerHTML = visibles.length
    ? visibles.map((e,i) => `<div class="pending-item" data-index="${i}" style="cursor:pointer;padding:8px 10px"><span>${texto(e,"nombre","Nombre","descripcion")} (${texto(e,"codigo","Codigo","cedula","Cedula")})</span></div>`).join("")
    : '<p class="hint" style="margin:0">No hay empleados que coincidan con la búsqueda.</p>';

  empleadoLista.querySelectorAll("[data-index]").forEach((el) => el.addEventListener("mousedown", (event) => {
    event.preventDefault();
    const e = visibles[Number(el.dataset.index)];
    const codigo = texto(e,"codigo","Codigo","cedula","Cedula");
    const nombre = texto(e,"nombre","Nombre","descripcion") || codigo;
    const option = new Option(`${nombre} (${codigo})`, codigo);
    option.dataset.nombre = nombre;
    empleadoSelect.add(option);
    empleadoSelect.value = codigo;
    colaboradorSeleccionadoEl.textContent = `${nombre} (${codigo})`;
    empleadoBuscar.value = "";
    empleadoLista.innerHTML = "";
    limpiarCamposCama();
    render();
  }));
}

function cargarBloques(filtro = "") {
  const consulta = filtro.trim().toLowerCase();
  const bloques = [...new Set(catalogos.camas.map(c => texto(c,"bloque","Bloque")).filter(Boolean))]
    .sort((a,b)=>a.localeCompare(b,"es",{numeric:true}))
    .filter((bloque) => `Bloque ${bloque}`.toLowerCase().includes(consulta));

  bloqueLista.innerHTML = bloques.length
    ? bloques.map((bloque,i) => `<div class="pending-item" data-index="${i}" style="cursor:pointer;padding:8px 10px"><span>Bloque ${bloque}</span></div>`).join("")
    : '<p class="hint" style="margin:0">No hay bloques que coincidan con la búsqueda.</p>';

  bloqueLista.querySelectorAll("[data-index]").forEach((el) => el.addEventListener("mousedown", (event) => {
    event.preventDefault();
    bloqueInput.value = bloques[Number(el.dataset.index)];
    bloqueLista.innerHTML = "";
    cargarCamas();
  }));
}

function cargarCamas(filtro = "") {
  const bloque = bloqueInput.value.trim();
  const consulta = filtro.trim().toLowerCase();
  const camas = [...new Set(
    catalogos.camas
      .filter(c => texto(c,"bloque","Bloque") === bloque)
      .map(c => texto(c,"cama","Cama"))
  )]
    .sort((a,b)=>a.localeCompare(b,"es",{numeric:true}))
    .filter(cama => `Cama ${cama}`.toLowerCase().includes(consulta));

  const trabajador = colaboradorActual();
  const tipoLabor = tipoLaborActivo;
  camaLista.innerHTML = bloque
    ? (camas.length
      ? camas.map((cama, i) => {
          const ocupada = trabajador && tipoLabor && registroCamaDuplicado({
            fecha: fechaInput.value,
            colaborador: trabajador.codigo,
            tipoLabor, bloque, cama,
            excluirIndice: indiceRegistroEditando
          });
          return ocupada
            ? `<div class="pending-item" aria-disabled="true" style="opacity:.6;padding:8px 10px"><span>Cama ${escaparHtml(cama)} · Ya registrada para esta labor</span></div>`
            : `<div class="pending-item" data-index="${i}" style="cursor:pointer;padding:8px 10px"><span>Cama ${escaparHtml(cama)}</span></div>`;
        }).join("")
      : '<p class="hint" style="margin:0">No hay camas que coincidan con la búsqueda.</p>')
    : '<p class="hint" style="margin:0">Seleccione primero un bloque.</p>';

  camaLista.querySelectorAll("[data-index]").forEach(el => el.addEventListener("mousedown", event => {
    event.preventDefault();
    const cama = camas[Number(el.dataset.index)];
    camaBuscar.value = cama;
    camaLista.innerHTML = "";
  }));
}

async function cargarCatalogos() {
  try {
    if (navigator.onLine) await SyncEngine.sincronizarCatalogos();
  } catch (e) {
    console.warn("No se pudieron actualizar catálogos", e);
  }

  try {
    const c = await SyncEngine.obtenerCatalogosLocal();
    catalogos.empleados = TiemposLaboresJN.conColaboradoresPrueba(
      (c.empleados || []).filter(
        (item) => item.activo !== false && item.retirado !== 1 && item.retirado !== true
      )
    );

    let camas = [];
    try {
      if (navigator.onLine) camas = await SyncEngine.apiGetOnline("/api/siembra/online/bloques-camas");
    } catch (_) {}

    catalogos.camas = TiemposLaboresJN.conCamasPrueba(
      (camas.length ? camas : c.camas || [])
        .map(item => ({
          bloque: texto(item,"bloque","Bloque").trim(),
          cama: texto(item,"cama","Cama").trim()
        }))
        .filter(item => item.bloque && item.cama)
    );
  } catch (e) {
    console.error(e);
    catalogos.empleados = TiemposLaboresJN.conColaboradoresPrueba(catalogos.empleados);
    catalogos.camas = TiemposLaboresJN.conCamasPrueba(catalogos.camas);
  }

  empleadoLista.innerHTML = "";
  bloqueLista.innerHTML = "";
  cargarCamas();
  document.querySelector("#apiStatusPill").textContent = navigator.onLine ? "En línea" : "Sin conexión";
}

empleadoBuscar.addEventListener("focus",()=>cargarEmpleados(empleadoBuscar.value));
empleadoBuscar.addEventListener("input",()=>cargarEmpleados(empleadoBuscar.value));
bloqueInput.addEventListener("focus",()=>cargarBloques(bloqueInput.value));
bloqueInput.addEventListener("input",()=>{
  cargarBloques(bloqueInput.value);
  camaBuscar.value="";
  camaLista.innerHTML="";
});
camaBuscar.addEventListener("focus",()=>cargarCamas(camaBuscar.value));
camaBuscar.addEventListener("input",()=>{
  cargarCamas(camaBuscar.value);
});


document.addEventListener("click", (event) => {
  if (event.target !== empleadoBuscar && !empleadoLista.contains(event.target)) empleadoLista.innerHTML = "";
  if (event.target !== bloqueInput && !bloqueLista.contains(event.target)) bloqueLista.innerHTML = "";
  if (event.target !== camaBuscar && !camaLista.contains(event.target)) camaLista.innerHTML = "";
});

function numero(v,d=2) {
  return new Intl.NumberFormat("es-CO",{maximumFractionDigits:d}).format(v);
}

function colaboradorActual() {
  const codigo = empleadoSelect.value;
  return colaboradoresJornada.get(claveColaborador(fechaInput.value, codigo, tipoLaborActivo)) || null;
}

function seleccionarColaboradorDeJornada(colaborador, enfocar = true) {
  empleadoSelect.innerHTML = '<option value=""></option>';
  const opcion = new Option(
    colaborador.nombre + " (" + colaborador.codigo + ")",
    colaborador.codigo
  );
  opcion.dataset.nombre = colaborador.nombre;
  empleadoSelect.add(opcion);
  empleadoSelect.value = colaborador.codigo;
  empleadoBuscar.value = "";
  empleadoLista.innerHTML = "";
  colaboradorSeleccionadoEl.textContent =
    colaborador.nombre + " (" + colaborador.codigo + ")";
  limpiarCamposCama();
  render();

  if (enfocar) {
    bloqueInput.scrollIntoView({ behavior: "smooth", block: "center" });
    bloqueInput.focus({ preventScroll: true });
  }
}

function agregarColaboradorActual() {
  if (!fechaInput.value) return alert("Selecciona la fecha de la jornada.");
  if (!empleadoSelect.value) return alert("Busca y selecciona un colaborador.");

  const codigo = empleadoSelect.value;
  const nombre = empleadoSelect.selectedOptions[0]?.dataset.nombre || codigo;
  const colaborador = { fecha: fechaInput.value, codigo, nombre, tipoLabor: tipoLaborActivo };
  const clave = claveColaborador(colaborador.fecha, colaborador.codigo, tipoLaborActivo);
  if (!colaboradoresJornada.has(clave)) {
    colaboradoresJornada.set(clave, colaborador);
    guardarJornada();
    // Solo los colaboradores con camas guardadas entran en Pendientes de Tiempos.
  }
  seleccionarColaboradorDeJornada(colaboradoresJornada.get(clave));
}

function limpiarCamposCama() {
  indiceRegistroEditando = null;
  document.querySelector("#avisoEdicionCama").hidden = true;
  form.reset();
  bloqueInput.value = "";
  bloqueLista.innerHTML = "";
  camaBuscar.value = "";
  camaLista.innerHTML = "";
}

function iniciarEdicionCama(indice) {
  const registro = registros[indice];
  const trabajador = colaboradorActual();
  if (!registro || !trabajador || registro.fecha !== fechaInput.value ||
      String(registro.colaborador) !== trabajador.codigo) {
    return alert("No se encontró esta cama para el colaborador y la fecha seleccionados.");
  }
  limpiarCamposCama();
  indiceRegistroEditando = indice;
  if (registro.tipoLabor !== tipoLaborActivo) return alert("Esta cama pertenece a otra actividad.");
  bloqueInput.value = registro.bloque;
  camaBuscar.value = registro.cama;
  document.querySelector("#mediosCuadros").value = registro.mediosCuadros;
  desbotonadoObservaciones.value = registro.observaciones || "";
  document.querySelector("#textoEdicionCama").textContent =
    `Modificando ${registro.tipoLabor} · Bloque ${registro.bloque} · Cama ${registro.cama} de ${trabajador.nombre}`;
  document.querySelector("#avisoEdicionCama").hidden = false;
  document.querySelector("#apiMensaje").textContent =
    "Modifica los datos necesarios y pulsa Guardar para actualizar esta misma fila.";
  render();
  bloqueInput.scrollIntoView({ behavior: "smooth", block: "center" });
  bloqueInput.focus({ preventScroll: true });
}

document.querySelector("#tablaRegistros").addEventListener("click", (event) => {
  const boton = event.target.closest("[data-registro-indice]");
  if (boton) iniciarEdicionCama(Number(boton.dataset.registroIndice));
});

document.querySelector("#btnCancelarEdicionCama").addEventListener("click", () => {
  limpiarCamposCama();
  document.querySelector("#apiMensaje").textContent =
    "Modificación cancelada. Los registros guardados no han cambiado.";
  render();
});

function renderColaboradoresJornada() {
  const lista = document.querySelector("#colaboradoresRegistradosLista");
  const colaboradores = [...colaboradoresJornada.values()].filter((c) =>
    c.fecha === fechaInput.value && c.tipoLabor === tipoLaborActivo
  );
  document.querySelector("#cantidadColaboradoresJornada").textContent =
    colaboradores.length + (colaboradores.length === 1 ? " colaborador" : " colaboradores");
  lista.innerHTML = colaboradores.length
    ? colaboradores.map((c) => {
        const camas = registros.filter((r) =>
          r.fecha === c.fecha && String(r.colaborador) === c.codigo &&
          r.tipoLabor === tipoLaborActivo
        ).length;
        const activo = colaboradorActual()?.codigo === c.codigo;
        return `<button type="button" class="colaborador-jornada-btn${activo ? " active" : ""}"
          data-colaborador-codigo="${escaparHtml(c.codigo)}"
          aria-pressed="${activo}">
          <span>${escaparHtml(c.nombre)}</span><span class="camas-badge">${camas} ${camas === 1 ? "cama" : "camas"}</span>
        </button>`;
      }).join("")
    : '<span class="hint">Todavía no has agregado colaboradores para esta fecha.</span>';
}

document.querySelector("#colaboradoresRegistradosLista").addEventListener("click", (event) => {
  const boton = event.target.closest("[data-colaborador-codigo]");
  if (!boton) return;
  const colaborador = colaboradoresJornada.get(
    claveColaborador(fechaInput.value, boton.dataset.colaboradorCodigo, tipoLaborActivo)
  );
  if (colaborador) seleccionarColaboradorDeJornada(colaborador);
});

function numero(v,d=2) {
  return new Intl.NumberFormat("es-CO",{maximumFractionDigits:d}).format(v);
}

function render() {
  const tbody = document.querySelector("#tablaRegistros");
  const trabajador = colaboradorActual();
  const registrosActuales = trabajador
    ? registros.filter((r) => r.fecha === fechaInput.value &&
        String(r.colaborador) === trabajador.codigo && r.tipoLabor === tipoLaborActivo)
    : [];

  document.querySelector("#nombreResumen").textContent = trabajador
    ? `Colaborador activo: ${trabajador.nombre}`
    : "Selecciona y agrega un colaborador";
  document.querySelector("#nombreResumenTabla").textContent = trabajador
    ? `${trabajador.nombre} · ${registrosActuales.length} cama(s) registradas en esta fecha.`
    : "Selecciona un colaborador agregado para consultar sus camas.";

  tbody.innerHTML = registrosActuales.length
    ? registrosActuales.map((r) => {
        const indice = registros.indexOf(r);
        const editando = indiceRegistroEditando === indice;
        return `<tr${editando ? ' class="fila-cama-editando"' : ''}>
          <td>${escaparHtml(r.tipoLabor)}</td>
          <td>${escaparHtml(r.bloque)}</td>
          <td>${escaparHtml(r.cama)}</td>
          <td>${numero(r.mediosCuadros, 1)}</td>
          <td>${escaparHtml(r.observaciones || "—")}</td>
          <td><button type="button" class="btn-modificar-cama"
            data-registro-indice="${indice}"${editando ? ' disabled' : ''}>
            ${editando ? "Modificando…" : "Modificar"}</button></td>
        </tr>`;
      }).join("")
    : '<tr><td colspan="6">' + (trabajador
      ? "Este colaborador todavía no tiene camas registradas."
      : "Selecciona un colaborador de la lista superior.") + '</td></tr>';

  document.querySelector("#totalCamas").textContent = registrosActuales.length;
  renderColaboradoresJornada();
  window.DesbotonadoDetalleRecargar?.();
}

document.querySelector("#btnAgregarColaborador").addEventListener("click", agregarColaboradorActual);

form.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!fechaInput.value) return alert("Selecciona la fecha.");
  const trabajador = colaboradorActual();
  if (!trabajador) return alert("Primero agrega un colaborador y selecciónalo en la lista.");

  // Permitir camas escritas directamente, aunque no aparezcan en el catálogo.
  const bloque = bloqueInput.value.trim();
  const cama = camaBuscar.value.trim();
  if (!bloque) return alert("Ingresa el bloque.");
  if (!cama) return alert("Ingresa el número de cama.");
  const tipoLabor = tipoLaborActivo;
  const anterior = indiceRegistroEditando === null
    ? null
    : registros[indiceRegistroEditando];
  if (indiceRegistroEditando !== null &&
      (!anterior || anterior.fecha !== fechaInput.value ||
       String(anterior.colaborador) !== trabajador.codigo ||
       anterior.tipoLabor !== tipoLaborActivo)) {
    return alert("El registro que intentas modificar ya no corresponde a este colaborador o fecha.");
  }
  if (registroCamaDuplicado({
    fecha: fechaInput.value, colaborador: trabajador.codigo, tipoLabor, bloque, cama,
    excluirIndice: indiceRegistroEditando
  })) {
    const mensaje = "Esta cama ya fue registrada por este colaborador para el mismo tipo de labor en la fecha seleccionada. Elige otra cama.";
    document.querySelector("#apiMensaje").textContent = mensaje;
    return alert(mensaje);
  }
  const medios = Number(document.querySelector("#mediosCuadros").value);
  if (!Number.isFinite(medios) || medios <= 0 || medios > 16) {
    return alert("Revisa los medios cuadros trabajados (entre 0,5 y 16).");
  }
  const datos = {
    fecha: fechaInput.value,
    colaborador: trabajador.codigo,
    colaboradorNombre: trabajador.nombre,
    tipoLabor,
    bloque,
    cama,
    mediosCuadros: medios,
    observaciones: desbotonadoObservaciones.value.trim()
  };
  const esModificacion = indiceRegistroEditando !== null;
  if (esModificacion) {
    // Actualizar en la misma posición: no agregar una nueva cama ni borrar datos de otras personas.
    registros[indiceRegistroEditando] = { ...anterior, ...datos };
  } else {
    registros.push(datos);
  }
  guardarJornada();
  // Guardar una cama no equivale a registrar sus tiempos.
  limpiarCamposCama();
  render();
  document.querySelector("#apiMensaje").textContent = esModificacion
    ? `Registro actualizado: bloque ${bloque}, cama ${cama} para ${trabajador.nombre}.`
    : `Guardado: bloque ${bloque}, cama ${cama} para ${trabajador.nombre}.`;
});

document.querySelector("#btnLimpiarCama").addEventListener("click", () => {
  limpiarCamposCama();
  render();
});

fechaInput.addEventListener("change", () => {
  empleadoSelect.innerHTML = '<option value=""></option>';
  empleadoBuscar.value = "";
  empleadoLista.innerHTML = "";
  colaboradorSeleccionadoEl.textContent = "Sin colaborador seleccionado";
  limpiarCamposCama();
  render();
});

window.addEventListener("online", cargarCatalogos);

(async function iniciarDesbotonadoMallas() {
  fechaInput.value = fechaLocal();
  cambiarTipoLabor(tipoLaborActivo);
  aplicarVista("registro");
  await cargarCatalogos();
  restaurarJornada();
  // La jornada se restaura de sesión; los tiempos guardados permanecen en IndexedDB.
  render();
})();
