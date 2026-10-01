// Promedios ("Detalle") — igual a InfoIndividualView de AppLabores: agrupa por colaborador
// (campo Empleado) las siembras del rango y calcula Rendimiento = Esquejes / Horas.
// Horas SÍ se guarda (dbo.Horas, ver HorasService.cs) — pedido 18/09/2026, antes solo vivía en
// esta pantalla y se perdía al salir. Granularidad real: un valor de horas por colaborador/día
// (igual que la tabla legacy). Por eso solo se puede editar/guardar cuando el rango es UN SOLO
// día (fechaInicio === fechaFinal) -- si se está viendo un rango de varios días, Horas se
// muestra de solo lectura como la suma de lo ya guardado día por día (para el reporte/export).
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
const guardarHorasBtn = document.querySelector("#guardarHorasBtn");
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
  guardarHorasBtn.hidden = !editable;
  horasStatus.textContent = editable
    ? ""
    : "Rango de varios días: Horas se muestra de solo lectura (suma de lo ya guardado por día). Para editar, ponga la misma fecha inicial y final.";

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
  const horasGuardadas = await SyncEngine.obtenerHorasLocalPorRango(desde, hasta);
  const horasPorEmpleado = new Map();
  for (const h of horasGuardadas) {
    horasPorEmpleado.set(h.empleado, (horasPorEmpleado.get(h.empleado) || 0) + (Number(h.horas) || 0));
  }

  const porColaborador = new Map(); // codigo -> { colaborador, esquejes }
  for (const s of enRango) {
    const codigo = s.empleado || "";
    const previo = porColaborador.get(codigo) || { colaborador: nombreEmpleado(s.empleado, s.empleadoNombre), esquejes: 0 };
    previo.esquejes += s.lineas * s.densidad;
    porColaborador.set(codigo, previo);
  }

  grupos = [...porColaborador.entries()]
    .sort((a, b) => a[1].colaborador.localeCompare(b[1].colaborador))
    .map(([codigo, { colaborador, esquejes }]) => ({
      codigo,
      colaborador,
      esquejes,
      horas: horasPorEmpleado.get(codigo) || 0,
    }));

  render();
}

function calcularTotales() {
  const totalEsquejes = grupos.reduce((acc, g) => acc + g.esquejes, 0);
  const totalHoras = grupos.reduce((acc, g) => acc + (Number(g.horas) || 0), 0);
  const sumaPromedios = grupos.reduce((acc, g) => acc + (g.horas > 0 ? g.esquejes / g.horas : 0), 0);
  const rendimientoGrupal = totalHoras > 0 ? totalEsquejes / totalHoras : 0;
  return { totalEsquejes, totalHoras, sumaPromedios, rendimientoGrupal };
}

function render() {
  if (grupos.length === 0) {
    tablaColaboradores.innerHTML = `<tr><td colspan="4">Sin siembras en este rango.</td></tr>`;
  } else {
    tablaColaboradores.innerHTML = grupos
      .map((g, idx) => {
        const celdaHoras = editable
          ? `<input type="number" min="0" step="0.5" value="${g.horas || ""}" data-idx="${idx}" style="width:90px; height:32px; padding:0 8px;" />`
          : `${g.horas || 0}`;
        return `
        <tr>
          <td>${g.colaborador}</td>
          <td>${g.esquejes}</td>
          <td>${celdaHoras}</td>
          <td>${g.horas > 0 ? (g.esquejes / g.horas).toFixed(2) : "-"}</td>
        </tr>`;
      })
      .join("");

    if (editable) {
      tablaColaboradores.querySelectorAll("input[data-idx]").forEach((input) => {
        input.addEventListener("input", () => {
          grupos[Number(input.dataset.idx)].horas = Number(input.value) || 0;
          actualizarTotales();
        });
      });
    }
  }

  actualizarTotales();
}

function actualizarTotales() {
  const { totalEsquejes, sumaPromedios, rendimientoGrupal } = calcularTotales();
  totalEsquejesEl.textContent = totalEsquejes;
  sumaPromediosEl.textContent = sumaPromedios.toFixed(2);
  rendimientoGrupalEl.textContent = rendimientoGrupal.toFixed(2);

  // refrescar solo la columna Rendimiento sin perder el foco del input de Horas
  tablaColaboradores.querySelectorAll("tr").forEach((tr, idx) => {
    const g = grupos[idx];
    if (!g) return;
    const celdaRendimiento = tr.children[3];
    if (celdaRendimiento) celdaRendimiento.textContent = g.horas > 0 ? (g.esquejes / g.horas).toFixed(2) : "-";
  });
}

async function guardarHoras() {
  if (!editable) return;
  const fecha = fechaInicioInput.value;
  const conHoras = grupos.filter((g) => g.codigo && g.horas > 0);
  if (conHoras.length === 0) {
    horasStatus.textContent = "No hay horas para guardar -- digite al menos una.";
    return;
  }

  guardarHorasBtn.disabled = true;
  horasStatus.textContent = "Guardando…";
  try {
    for (const g of conHoras) {
      await SyncEngine.guardarHorasLocal(fecha, g.codigo, g.horas);
    }
    const resultado = await SyncEngine.sincronizarPendientesHoras();
    if (resultado.fallidas === 0) {
      horasStatus.textContent = `Horas guardadas y sincronizadas (${resultado.subidas}).`;
    } else {
      horasStatus.textContent = `Horas guardadas localmente. Sin conexión para subir ${resultado.fallidas} -- se sincronizan solas más tarde con señal.`;
    }
  } catch (err) {
    horasStatus.textContent = `Error guardando horas: ${err.message}`;
  } finally {
    guardarHorasBtn.disabled = false;
  }
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
guardarHorasBtn.addEventListener("click", guardarHoras);
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
