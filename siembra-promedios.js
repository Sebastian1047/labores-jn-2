// Promedios ("Detalle") — igual a InfoIndividualView de AppLabores: agrupa por colaborador
// (campo Empleado) las siembras del rango y calcula Rendimiento = Esquejes / Horas.
// La captura de tiempos grupales e individuales se guarda localmente por
// colaborador/fecha en siembraRendimientoTiempos, compartida con Rendimiento.
// La columna Horas se deriva del tiempo efectivo y conserva horas legacy como
// respaldo de datos históricos que aún no tienen el desglose de actividades.
// Exporta a Excel offline con SheetJS (Android lo hace on-device con EPPlus).

const sesion = JSON.parse(sessionStorage.getItem("labores_usuario") || "null");
if (!sesion) {
  window.location.href = "./login.html";
}

const apiStatusPill = document.querySelector("#apiStatusPill");
const usuarioPill = document.querySelector("#usuarioPill");
const fechaInicioInput = document.querySelector("#fechaInicio");
const fechaFinalInput = document.querySelector("#fechaFinal");
const verBtn = document.querySelector("#verBtn");
const horasStatus = document.querySelector("#horasStatus");
const exportarBtn = document.querySelector("#exportarBtn");
const tablaColaboradores = document.querySelector("#tablaColaboradores");
const totalEsquejesEl = document.querySelector("#totalEsquejes");
const sumaPromediosEl = document.querySelector("#sumaPromedios");
const rendimientoGrupalEl = document.querySelector("#rendimientoGrupal");

usuarioPill.textContent = sesion ? sesion.empleadoNombre || sesion.username : "Usuario";

let grupos = []; // [{ codigo, colaborador, esquejes, horas }]
let editable = true; // true solo cuando el rango es un único día
let empleadosPorCodigo = new Map();

// El nombre real ya viene resuelto desde el servidor (ver siembra-revision.js) -- el mapa
// local solo queda de respaldo por si un registro offline no trae empleadoNombre.
function nombreEmpleado(codigo, empleadoNombre) {
  if (!codigo) return "(sin empleado)";
  if (empleadoNombre) return empleadoNombre;
  const e = empleadosPorCodigo.get(codigo);
  return e ? e.nombre : codigo;
}

async function checkApi() {
  try {
    await SyncEngine.apiGetOnline("/api/siembra/online/origenes");
    apiStatusPill.textContent = "En línea";
    apiStatusPill.classList.add("ok");
  } catch {
    apiStatusPill.textContent = "Sin conexión (datos locales)";
    apiStatusPill.classList.add("warn");
  }
}

async function verFechas() {
  const desde = fechaInicioInput.value;
  const hasta = fechaFinalInput.value || desde;
  editable = desde === hasta;
  horasStatus.textContent = editable
    ? ""
    : "Para registrar tiempos, selecciona un solo día: usa la misma fecha inicial y final. En rangos de varios días solo puedes consultar el resumen.";

  try {
    await SyncEngine.sincronizarSiembrasDesdeServidor({ fechaInicio: desde, fechaFinal: hasta });
  } catch {
    // sin red: se calcula con lo ya guardado localmente
  }
  try {
    await SyncEngine.sincronizarHorasDesdeServidor(desde, hasta);
  } catch {
    // sin red: se usa lo ya guardado localmente
  }

  const todas = await OfflineDb.getAll("siembras");
  const enRango = todas.filter((s) => s.fecha >= desde && s.fecha <= hasta);
  const [horasGuardadas, tiemposGuardados] = await Promise.all([
    SyncEngine.obtenerHorasLocalPorRango(desde, hasta),
    OfflineDb.getAll("siembraRendimientoTiempos")
  ]);
  const horasPorEmpleado = new Map();
  for (const h of horasGuardadas) {
    horasPorEmpleado.set(h.empleado, (horasPorEmpleado.get(h.empleado) || 0) + (Number(h.horas) || 0));
  }
  // Los tiempos detallados tienen prioridad sobre "Horas" legacy para una misma
  // persona y día. Si hay varios días, se suman sin duplicar un día.
  const porDia = new Map();
  tiemposGuardados.filter((t) => t.fecha >= desde && t.fecha <= hasta).forEach((t) => {
    const id = String(t.colaborador || t.sembrador || "");
    if (!id) return;
    const key = t.fecha + "|" + id;
    const anterior = porDia.get(key);
    if (!anterior || String(t.updatedAt || t.createdAt || "") >=
          String(anterior.updatedAt || anterior.createdAt || "")) {
      porDia.set(key, t);
    }
  });
  const horasDetallePorEmpleado = new Map();
  const diasConDetalle = new Map();
  for (const [key, t] of porDia) {
    const id = String(t.colaborador || t.sembrador);
    horasDetallePorEmpleado.set(id, (horasDetallePorEmpleado.get(id) || 0) +
      Math.max(0,Number(t.tiempoRealMin) || 0) / 60);
    const dias = diasConDetalle.get(id) || new Set();
    dias.add(t.fecha); diasConDetalle.set(id, dias);
  }
  // Para un solo día, un registro detallado sustituye exactamente las horas
  // legacy. Para varios días se suma el detalle y las horas de días sin detalle.
  for (const [id, valor] of horasDetallePorEmpleado) {
    if (editable) {
      horasPorEmpleado.set(id,valor);
    } else {
      const legacySinDetalle = horasGuardadas.filter((h) =>
        String(h.empleado) === id && !diasConDetalle.get(id)?.has(h.fecha))
        .reduce((total,h)=>total+(Number(h.horas)||0),0);
      horasPorEmpleado.set(id,valor+legacySinDetalle);
    }
  }

  const porColaborador = new Map(); // codigo -> { colaborador, esquejes }
  for (const s of enRango) {
    const codigo = s.empleado || "";
    const previo = porColaborador.get(codigo) || { colaborador: nombreEmpleado(s.empleado, s.empleadoNombre), esquejes: 0 };
    previo.esquejes += s.lineas * s.densidad;
    porColaborador.set(codigo, previo);
  }

  grupos = [...porColaborador.entries()]
    .filter(([codigo, dato]) => codigo && Number(dato.esquejes) > 0)
    .sort((a, b) => a[1].colaborador.localeCompare(b[1].colaborador))
    .map(([codigo, { colaborador, esquejes }]) => ({
      codigo,
      colaborador,
      esquejes,
      horas: horasPorEmpleado.get(codigo) || 0,
    }));

  render();
  // Refrescar los colaboradores del formulario inferior si Detalles recuperó
  // siembras recientes. Los tiempos usan su fecha independiente.
  window.dispatchEvent(new CustomEvent("laboresjn:registro-labor", {
    detail: { fecha: document.querySelector("#fecha")?.value || "" }
  }));
}

function calcularTotales() {
  const totalEsquejes = grupos.reduce((acc, g) => acc + g.esquejes, 0);
  const totalHoras = grupos.reduce((acc, g) => acc + (Number(g.horas) || 0), 0);
  const sumaPromedios = grupos.reduce((acc, g) => acc + (g.horas > 0 ? g.esquejes / g.horas : 0), 0);
  const rendimientoGrupal = totalHoras > 0 ? totalEsquejes / totalHoras : 0;
  return { totalEsquejes, totalHoras, sumaPromedios, rendimientoGrupal };
}

function render() {
  // Selector grupal/individual y despliegue de tiempos pertenecen a un único
  // controlador visual. No se permite digitar Horas por un segundo camino.
  if (window.SiembraDetalleTiempos?.render) {
    window.SiembraDetalleTiempos.render(grupos, {
      editable, fecha:fechaInicioInput.value, hasta:fechaFinalInput.value
    });
  } else {
    tablaColaboradores.innerHTML = '<tr><td colspan="5">Preparando el formulario de tiempos…</td></tr>';
  }
  actualizarTotales();
}

function actualizarTotales() {
  const { totalEsquejes, sumaPromedios, rendimientoGrupal } = calcularTotales();
  totalEsquejesEl.textContent = totalEsquejes;
  sumaPromediosEl.textContent = sumaPromedios.toFixed(2);
  rendimientoGrupalEl.textContent = rendimientoGrupal.toFixed(2);


}


function exportarExcel() {
  const { totalEsquejes, totalHoras, rendimientoGrupal } = calcularTotales();

  const filas = [["Colaborador", "Total Esquejes", "Horas", "Rendimiento"]];
  grupos.forEach((g) => filas.push([g.colaborador, g.esquejes, g.horas || 0, null]));
  filas.push(["TOTAL GRUPAL", totalEsquejes, totalHoras, null]);

  const hoja = XLSX.utils.aoa_to_sheet(filas);
  for (let fila = 1; fila <= grupos.length; fila++) {
    const excelRow = fila + 1;
    hoja[`D${excelRow}`] = { t: "n", f: `IF(C${excelRow}=0,0,B${excelRow}/C${excelRow})` };
  }
  const filaTotal = grupos.length + 2;
  hoja[`D${filaTotal}`] = { t: "n", f: `IF(C${filaTotal}=0,0,B${filaTotal}/C${filaTotal})` };

  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, "Resumen");
  const nombre = `Promedios_${fechaInicioInput.value || "todo"}_${fechaFinalInput.value || ""}.xlsx`;
  XLSX.writeFile(libro, nombre);
}

verBtn.addEventListener("click", verFechas);
exportarBtn.addEventListener("click", exportarExcel);

(async function iniciar() {
  const hoy = new Date();
  fechaFinalInput.value = SyncEngine.fechaLocalISO(hoy);
  fechaInicioInput.value = SyncEngine.fechaLocalISO(hoy);

  const empleados = await OfflineDb.getAll("empleados");
  empleadosPorCodigo = new Map(empleados.map((e) => [e.codigo, e]));

  checkApi();
  verFechas();
})();

window.SiembraDetalleRecargar = verFechas;
