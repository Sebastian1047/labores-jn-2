const sesionInforme = JSON.parse(sessionStorage.getItem("labores_usuario") || "null");
if (!sesionInforme) window.location.href = "./login.html";

const ALMACENAMIENTO_CALIDAD = "calidadSiembraEvaluacionesLocal";
const ITEMS_INFORME = [
  [2, "Estado de la planta"], [3, "Distribución"],
  [4, "Densidad"], [5, "Profundidad de la planta"], [6, "Planta inclinada"],
  [7, "Ubicación de mangueras"], [8, "Selección de esqueje"], [9, "Siembra con marcador"],
  [10, "Aseo sitio de trabajo"], [13, "Conteo de líneas"],
];

const periodoSelect = document.querySelector("#periodoSelect");
const anioSelect = document.querySelector("#anioSelect");
const semanaSelect = document.querySelector("#semanaSelect");
const informeContenido = document.querySelector("#informeContenido");
const nombresColaboradores = new Map();
document.querySelector("#informeUsuario").textContent = sesionInforme?.empleadoNombre || sesionInforme?.username || "Usuario";

function escaparHtml(valor) {
  return String(valor ?? "").replace(/[&<>"']/g, (caracter) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[caracter]));
}

function obtenerEvaluacionesLocales() {
  try {
    const datos = JSON.parse(localStorage.getItem(ALMACENAMIENTO_CALIDAD) || "[]");
    return Array.isArray(datos) ? datos.filter((registro) => registro && registro.anio && registro.semana) : [];
  } catch {
    return [];
  }
}

async function obtenerEvaluaciones() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/calidad/informe`, { cache: "no-store" });
    if (!response.ok) throw new Error("No se pudo consultar el informe en la base");
    return await response.json();
  } catch {
    return obtenerEvaluacionesLocales();
  }
}

function normalizarEvaluacion(evaluacion) {
  const fecha = evaluacion.fecha || new Date().toISOString();
  const codigo = String(evaluacion.sembrador ?? evaluacion.colaborador ?? "");
  return {
    ...evaluacion,
    anio: Number(evaluacion.anio || evaluacion.ano || String(fecha).slice(0, 4)),
    sembrador: codigo,
    sembradorNombre: evaluacion.sembradorNombre || evaluacion.colaboradorNombre || nombresColaboradores.get(codigo) || evaluacion.colaborador || "Sin nombre",
    incumplimientos: (evaluacion.incumplimientos || []).map((item) => typeof item === "object"
      ? { ...item, idItem: item.idItem ?? item.id }
      : item),
  };
}

async function cargarNombresColaboradoresLocales() {
  try {
    const [calidad, empleados] = await Promise.all([
      OfflineDb.getAll("calidadColaboradores"),
      OfflineDb.getAll("empleados"),
    ]);
    [...calidad, ...empleados].forEach((item) => {
      const codigo = item.codigo || item.codigo_origen;
      const nombre = item.nombre || item.empleadoNombre;
      if (codigo && nombre) nombresColaboradores.set(String(codigo), nombre);
    });
  } catch {
    // El informe sigue funcionando con el nombre que entregue la API o el código.
  }
}

function clavePeriodo(registro) {
  return `${registro.anio}|${registro.semana}`;
}

function porcentaje(numerador, denominador) {
  if (!denominador) return "—";
  const valor = 100 * numerador / denominador;
  return `${Math.round(valor)}%`;
}

function tieneIncumplimiento(evaluacion, idItem) {
  return (evaluacion.incumplimientos || []).some((item) => {
    if (typeof item === "object") return Number(item.idItem) === idItem;
    return Number(item) === idItem;
  });
}

function datosPeriodo(evaluaciones) {
  const porPeriodo = new Map();
  evaluaciones.forEach((evaluacion) => {
    const clave = clavePeriodo(evaluacion);
    if (!porPeriodo.has(clave)) porPeriodo.set(clave, []);
    porPeriodo.get(clave).push(evaluacion);
  });
  return [...porPeriodo.entries()]
    .map(([clave, registros]) => {
      const [anio, semana] = clave.split("|").map(Number);
      return { clave, anio, semana, registros };
    })
    .sort((a, b) => a.anio - b.anio || a.semana - b.semana);
}

function poblarFiltros(periodos) {
  const anios = [...new Set(periodos.map((periodo) => periodo.anio))].sort((a, b) => b - a);
  const anioActual = anioSelect.value || String(anios[0] ?? "");
  anioSelect.innerHTML = '<option value="">Todos los años</option>' + anios
    .map((anio) => `<option value="${anio}" ${String(anio) === anioActual ? "selected" : ""}>${anio}</option>`).join("");
  if (anioActual && anios.some((anio) => String(anio) === anioActual)) anioSelect.value = anioActual;
  const anioFiltro = anioSelect.value;
  const semanas = [...new Set(periodos.filter((periodo) => !anioFiltro || String(periodo.anio) === String(anioFiltro)).map((periodo) => periodo.semana))].sort((a, b) => a - b);
  const semanaActual = semanaSelect.value;
  semanaSelect.innerHTML = '<option value="">Todas las semanas</option>' + semanas
    .map((semana) => `<option value="${semana}" ${String(semana) === semanaActual ? "selected" : ""}>Semana ${semana}</option>`).join("");
  if (semanaActual && semanas.some((semana) => String(semana) === semanaActual)) semanaSelect.value = semanaActual;
}

function resumenGrupal(registros) {
  const conformes = registros.filter((evaluacion) => !(evaluacion.incumplimientos || []).length).length;
  return { muestras: registros.length, conformes, porcentaje: registros.length ? 100 * conformes / registros.length : null };
}

function renderGrafica(periodos) {
  if (!periodos.length) return '<p class="hint">Aún no hay semanas con evaluaciones guardadas.</p>';
  const ultimos = periodos.slice(-4);
  return `<div class="print-bars">${ultimos.map((periodo) => {
    const resumen = resumenGrupal(periodo.registros);
    const alto = resumen.porcentaje == null ? 25 : Math.max(25, resumen.porcentaje - 55) * 3;
    return `<div class="print-bar-item"><b>${porcentaje(resumen.conformes, resumen.muestras)}</b><div class="print-bar" style="height:${alto}px"></div><span>SEMANA ${periodo.semana}</span></div>`;
  }).join("")}</div>`;
}

async function renderInforme() {
  const evaluaciones = obtenerEvaluaciones();
  await cargarNombresColaboradoresLocales();
  const datos = (await evaluaciones).map(normalizarEvaluacion);
  const periodos = datosPeriodo(datos);
  if (!periodos.length) {
    periodoSelect.innerHTML = '<option value="">Sin evaluaciones guardadas</option>';
    periodoSelect.disabled = true;
    informeContenido.innerHTML = '<h2>Sin datos para el informe</h2><p class="hint">Registra una evaluación en Calidad Siembra para generar el informe en este equipo.</p>';
    return;
  }

  poblarFiltros(periodos);
  const anioFiltro = anioSelect.value;
  const semanaFiltro = semanaSelect.value;
  const periodosFiltrados = periodos.filter((periodo) =>
    (!anioFiltro || String(periodo.anio) === String(anioFiltro)) &&
    (!semanaFiltro || String(periodo.semana) === String(semanaFiltro))
  );
  if (!periodosFiltrados.length) {
    periodoSelect.innerHTML = '<option value="">Sin semanas para este filtro</option>';
    periodoSelect.disabled = true;
    informeContenido.innerHTML = '<h2>Sin datos para el filtro seleccionado</h2><p class="hint">Elige otro año o semana para consultar evaluaciones.</p>';
    return;
  }
  periodoSelect.disabled = false;

  const seleccionada = periodoSelect.value || periodosFiltrados.at(-1).clave;
  periodoSelect.innerHTML = periodosFiltrados.slice().reverse().map((periodo) =>
    `<option value="${periodo.clave}" ${periodo.clave === seleccionada ? "selected" : ""}>Semana ${periodo.semana} de ${periodo.anio}</option>`
  ).join("");
  const periodo = periodosFiltrados.find((item) => item.clave === periodoSelect.value) || periodosFiltrados.at(-1);
  const resumen = resumenGrupal(periodo.registros);
  const porSembrador = new Map();

  periodo.registros.forEach((evaluacion) => {
    const id = String(evaluacion.sembrador);
    if (!porSembrador.has(id)) porSembrador.set(id, { nombre: evaluacion.sembradorNombre || id, registros: [] });
    porSembrador.get(id).registros.push(evaluacion);
  });

  const filas = [...porSembrador.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, "es")).map((sembrador) => {
    const muestras = sembrador.registros.length;
    const porItem = ITEMS_INFORME.map(([id]) => {
      const fallos = sembrador.registros.filter((evaluacion) => tieneIncumplimiento(evaluacion, id)).length;
      return porcentaje(muestras - fallos, muestras);
    });
    const conformes = sembrador.registros.filter((evaluacion) => !(evaluacion.incumplimientos || []).length).length;
    return `<tr><td class="namecell">${escaparHtml(sembrador.nombre)}</td>${porItem.map((valor) => `<td>${valor}</td>`).join("")}<td>${porcentaje(conformes, muestras)}</td></tr>`;
  }).join("");

  informeContenido.innerHTML = `
    <section class="report-sheet">
      <div class="report-brand">
        <div class="report-logo">
          <img src="./icons/jardines-san-nicolas.jpg" alt="Jardines de San Nicolás S.A.S." />
        </div>
        <div class="report-meta">
          <div class="report-route"><b>RUTA DE<br>APRENDIZAJE</b></div>
        </div>
        <div class="report-logo assurance-logo"><img src="./icons/aseguramiento.png" alt="Aseguramiento" /></div>
        <div class="report-company-wide">JARDINES DE SAN NICOLÁS S.A.S.</div>
        <div class="report-details">
          <div>INDICADOR</div><div>METEORO</div>
          <div>ÁREA</div><div>SIEMBRA EN CAMPO</div>
          <div>RESPONSABLE</div><div>ERASMO GOMEZ</div>
        </div>
      </div>
      <h3 class="table-title">RESULTADOS CONFORMIDAD INDIVIDUAL SEMANA ${periodo.semana} · ${periodo.anio}</h3>
      <div class="table-scroll"><table class="conformity-table"><thead><tr>
        <th>NOMBRE DEL COLABORADOR</th>${ITEMS_INFORME.map(([, nombre]) => `<th>${nombre}</th>`).join("")}<th>CONFORMIDAD TOTAL</th>
      </tr></thead><tbody>${filas}</tbody></table></div>
      <div class="weekly-summary">
        <table class="mini-table"><thead><tr><th>SEMANA</th><th>CONFORMIDAD GRUPAL</th></tr></thead>
          <tbody>${periodosFiltrados.slice(-4).map((semana) => {
            const resumenSemana = resumenGrupal(semana.registros);
            return `<tr><td>SEMANA ${semana.semana}</td><td><b>${porcentaje(resumenSemana.conformes, resumenSemana.muestras)}</b></td></tr>`;
          }).join("")}</tbody>
        </table>
        <div class="print-chart"><h3>METEORO · CONFORMIDAD GRUPAL (SEMANAL)</h3>${renderGrafica(periodosFiltrados)}</div>
      </div>
      <div class="signature-grid"><div>JEFE PRODUCCIÓN</div><div>SUPERVISOR (J)</div><div>SUPERVISOR (M)</div><div>JEFE SAVIA - METEORO</div></div>
    </section>
  `;
}

periodoSelect.addEventListener("change", renderInforme);
anioSelect.addEventListener("change", () => { semanaSelect.value = ""; renderInforme(); });
semanaSelect.addEventListener("change", renderInforme);
document.querySelector("#imprimirBtn").addEventListener("click", () => window.print());
document.querySelector("#pdfBtn").addEventListener("click", () => window.print());
renderInforme();
