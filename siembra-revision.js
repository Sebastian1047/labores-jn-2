// Revisión — igual a ListSiembrasViewPage de AppLabores: filtro por rango de fechas + búsqueda
// libre, checkbox "Revisada" de solo lectura, y "Ver/Editar" que abre el registro en edición.

const sesion = JSON.parse(sessionStorage.getItem("labores_usuario") || "null");
if (!sesion) {
  window.location.href = "./login.html";
}

const apiStatusPill = document.querySelector("#apiStatusPill");
const usuarioPill = document.querySelector("#usuarioPill");
const fechaInicioInput = document.querySelector("#fechaInicio");
const fechaFinalInput = document.querySelector("#fechaFinal");
const buscarInput = document.querySelector("#buscar");
const verBtn = document.querySelector("#verBtn");
const exportarBtn = document.querySelector("#exportarBtn");
const listaRevision = document.querySelector("#listaRevision");
const totalSiembrasEl = document.querySelector("#totalSiembras");
const totalEsquejesEl = document.querySelector("#totalEsquejes");

usuarioPill.textContent = sesion ? sesion.empleadoNombre || sesion.username : "Usuario";

let registrosVigentes = [];
let empleadosPorCodigo = new Map();

// El nombre real ya viene resuelto desde el servidor (JOIN contra app.personal +
// legacy.empleados_codigo_historico, cubre cedula nueva y codigo viejo de 6 digitos).
// El mapa local solo queda de respaldo por si un registro offline no trae empleadoNombre.
function nombreEmpleado(codigo, empleadoNombre) {
  if (!codigo) return "-";
  if (empleadoNombre) return `${empleadoNombre} (${codigo})`;
  const e = empleadosPorCodigo.get(codigo);
  return e ? `${e.nombre} (${codigo})` : codigo;
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

  try {
    await SyncEngine.sincronizarSiembrasDesdeServidor({ fechaInicio: desde, fechaFinal: hasta });
  } catch {
    // sin red: se sigue con lo que ya hay guardado localmente
  }

  const todas = await OfflineDb.getAll("siembras");
  registrosVigentes = todas.filter((s) => s.fecha >= desde && s.fecha <= hasta);
  render();
}

function render() {
  const filtro = (buscarInput.value || "").trim().toLowerCase();
  const filtrados = registrosVigentes.filter((s) => {
    if (!filtro) return true;
    const campos = [s.bloque, s.cama, s.variedadNombre, s.variedad, s.vclon, s.origen, s.empleado, nombreEmpleado(s.empleado, s.empleadoNombre)];
    return campos.some((c) => (c || "").toString().toLowerCase().includes(filtro));
  });

  totalSiembrasEl.textContent = filtrados.length;
  totalEsquejesEl.textContent = filtrados.reduce((acc, s) => acc + s.lineas * s.densidad, 0);

  if (filtrados.length === 0) {
    listaRevision.innerHTML = `<p class="hint">Sin siembras en este rango.</p>`;
    return;
  }

  listaRevision.innerHTML = filtrados
    .sort((a, b) => (a.fecha < b.fecha ? 1 : -1))
    .map(
      (s) => `
      <div class="pending-item ${s.syncStatus && s.syncStatus !== "Sincronizado" ? "mixed" : ""} ${Number(s.lineas) < 0 ? "mixed" : ""}">
        <strong>${s.variedadNombre || s.variedad}${s.vclon ? " · " + s.vclon : ""}${Number(s.lineas) < 0 ? " · ⚠ ERRADICADA" : ""}</strong>
        <span>${s.fecha} · Bloque ${s.bloque} / Cama ${s.cama} · Origen ${s.origen || "-"}</span>
        <span>Líneas ${s.lineas} · Densidad ${s.densidad} · ${s.lineas * s.densidad} esquejes · Sem ${s.semanaProgramada ?? "-"}/${s.anoProgramado ?? "-"}</span>
        <span>Sembrador: ${nombreEmpleado(s.empleado, s.empleadoNombre)} · Registrado por: ${s.login || "-"}</span>
        ${Number(s.lineas) < 0 ? `<span>Causa de erradicación: ${s.causaNombre || s.causa || "-"}</span>` : ""}
        <label style="display:flex; align-items:center; gap:6px; margin-top:6px;">
          <input type="checkbox" disabled ${s.reviso ? "checked" : ""} style="width:16px;height:16px;" />
          <span style="margin:0; color: var(--muted); font-size: 0.82rem;">Revisada</span>
        </label>
        ${s.syncStatus && s.syncStatus !== "Sincronizado" ? `<em>Pendiente de sincronizar</em>` : ""}
        <div class="action-row" style="margin: 10px 0 0;">
          <button class="ghost-btn" type="button" data-id="${s.id}">Ver / Editar</button>
        </div>
      </div>`
    )
    .join("");

  listaRevision.querySelectorAll("button[data-id]").forEach((btn) => {
    btn.addEventListener("click", () => {
      window.location.href = `./siembra.html?editar=${btn.dataset.id}`;
    });
  });
}

function exportarJson() {
  const blob = new Blob([JSON.stringify(registrosVigentes, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `backup_siembra_${fechaInicioInput.value || "todo"}_${fechaFinalInput.value || ""}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

verBtn.addEventListener("click", verFechas);
buscarInput.addEventListener("input", render);
exportarBtn.addEventListener("click", exportarJson);

(async function iniciar() {
  // Por defecto SIEMPRE el dia de hoy nada mas (18/09/2026) -- un rango puesto por defecto es
  // peligroso: si alguien no se fija que hay un filtro de varios dias, supone que TODO lo que ve
  // es de hoy. El selector de fechas sigue editable si se necesita buscar algo mas viejo.
  const hoy = new Date();
  fechaFinalInput.value = SyncEngine.fechaLocalISO(hoy);
  fechaInicioInput.value = SyncEngine.fechaLocalISO(hoy);

  const empleados = await OfflineDb.getAll("empleados");
  empleadosPorCodigo = new Map(empleados.map((e) => [e.codigo, e]));

  checkApi();
  verFechas();
})();
