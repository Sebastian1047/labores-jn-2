// Portado desde AppLabores (FloracionSiembraViewModel/FloracionSiembra.xaml) — panorama
// desglosado por bloque/cama, filtros Variedad/Categoría/Bloque/Semana con "Todos" y
// "Limpiar filtros", igual que la pantalla Android. Misma fuente/fórmula que el Sbr de
// Pronósticos (dbo.SiembraCamp), solo que aquí no se agrega bloque/cama.

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
const semanaInicioInput = document.querySelector("#semanaInicio");
const anoInput = document.querySelector("#ano");
const semanaSelect = document.querySelector("#semanaSelect");
const variedadSelect = document.querySelector("#variedadSelect");
const categoriaSelect = document.querySelector("#categoriaSelect");
const bloqueSelect = document.querySelector("#bloqueSelect");
const refreshBtn = document.querySelector("#refreshBtn");
const limpiarBtn = document.querySelector("#limpiarBtn");
const resumenTotales = document.querySelector("#resumenTotales");
const resultadoContenedor = document.querySelector("#resultadoContenedor");

usuarioLabel.textContent = USUARIO;
const hoy = new Date();
anoInput.value = hoy.getFullYear();
semanaInicioInput.value = isoWeek(hoy);

const apiGet = SyncEngine.apiGetOnline;

/** @type {any[]} lista cruda devuelta por /api/pronosticos/floracion-siembra/{semana} */
let variedadesData = [];

function fmtDate(value) {
  if (!value) return "-";
  return String(value).substring(0, 10);
}

async function checkApi() {
  try {
    await apiGet(`/api/pronosticos/floracion-siembra/1?ano=${anoInput.value}`);
    apiStatusPill.textContent = "En línea";
    apiStatusPill.classList.add("ok");
  } catch {
    apiStatusPill.textContent = "Sin conexión (datos locales)";
    apiStatusPill.classList.add("warn");
  }
}

async function cargarTodo() {
  const semanaInicio = Number(semanaInicioInput.value) || 1;
  const ano = Number(anoInput.value);

  try {
    variedadesData = await apiGet(`/api/pronosticos/floracion-siembra/${semanaInicio}?ano=${ano}`);
    await OfflineDb.clear("pronosticosFloracion");
    await OfflineDb.putMany(
      "pronosticosFloracion",
      variedadesData.map((v) => ({ variedadCodigo: v.codigoVariedad, ano, semanaInicio, datos: v }))
    );
  } catch (err) {
    if (!(err instanceof SyncEngine.RedNoDisponibleError)) throw err;

    const cache = await OfflineDb.getAll("pronosticosFloracion");
    variedadesData = cache.filter((c) => c.ano === ano && c.semanaInicio === semanaInicio).map((c) => c.datos);
  }

  poblarFiltros();
  renderizar();
}

function poblarFiltros() {
  const variedadPrev = variedadSelect.value;
  const categoriaPrev = categoriaSelect.value;
  const bloquePrev = bloqueSelect.value;
  const semanaPrev = semanaSelect.value;

  const variedades = ["Todos", ...new Set(variedadesData.map((v) => v.nombreVariedad))].sort();
  const categorias = ["Todos", ...new Set(variedadesData.map((v) => v.categoria))].sort();
  const bloques = [
    "Todos",
    ...new Set(
      variedadesData.flatMap((v) =>
        v.semanas.flatMap((s) => s.dias.flatMap((d) => d.bloques.map((b) => b.nombreBloque)))
      )
    ),
  ].sort();
  const semanas = [...new Set(variedadesData.flatMap((v) => v.semanas.map((s) => s.numeroSemana)))].sort(
    (a, b) => a - b
  );

  variedadSelect.innerHTML = variedades.map((v) => `<option value="${v}">${v}</option>`).join("");
  categoriaSelect.innerHTML = categorias.map((c) => `<option value="${c}">${c}</option>`).join("");
  bloqueSelect.innerHTML = bloques.map((b) => `<option value="${b}">${b}</option>`).join("");
  semanaSelect.innerHTML =
    `<option value="">Todas</option>` + semanas.map((s) => `<option value="${s}">Semana ${s}</option>`).join("");

  if (variedades.includes(variedadPrev)) variedadSelect.value = variedadPrev;
  if (categorias.includes(categoriaPrev)) categoriaSelect.value = categoriaPrev;
  if (bloques.includes(bloquePrev)) bloqueSelect.value = bloquePrev;
  if (semanaPrev && semanas.some((s) => String(s) === semanaPrev)) semanaSelect.value = semanaPrev;
}

function limpiarFiltros() {
  variedadSelect.value = "Todos";
  categoriaSelect.value = "Todos";
  bloqueSelect.value = "Todos";
  semanaSelect.value = "";
  renderizar();
}

function renderizar() {
  const fVariedad = variedadSelect.value;
  const fCategoria = categoriaSelect.value;
  const fBloque = bloqueSelect.value;
  const fSemana = semanaSelect.value;

  let totalTallos = 0;
  let totalRamos = 0;

  const html = variedadesData
    .filter((v) => fVariedad === "Todos" || !fVariedad || v.nombreVariedad === fVariedad)
    .filter((v) => fCategoria === "Todos" || !fCategoria || v.categoria === fCategoria)
    .map((v) => {
      const semanasHtml = v.semanas
        .filter((s) => !fSemana || String(s.numeroSemana) === fSemana)
        .map((s) => {
          const diasHtml = s.dias
            .map((d) => {
              const bloquesFiltrados = d.bloques.filter(
                (b) => fBloque === "Todos" || !fBloque || b.nombreBloque === fBloque
              );
              if (bloquesFiltrados.length === 0) return "";

              const tallosDia = bloquesFiltrados.reduce((acc, b) => acc + b.totalTallosBloque, 0);
              const ramosDia = bloquesFiltrados.reduce((acc, b) => acc + b.totalRamosBloque, 0);
              totalTallos += tallosDia;
              totalRamos += ramosDia;

              const bloquesHtml = bloquesFiltrados
                .map((b) => {
                  const camasHtml = b.camas
                    .map(
                      (c) =>
                        `<span class="pill">🛏 ${c.nombreCama}: ${c.totalTallosCama} tallos / ${c.totalRamosCama} ramos</span>`
                    )
                    .join(" ");
                  return `
                    <div class="dia-row" style="align-items: flex-start; flex-direction: column; gap: 6px;">
                      <strong>📦 Bloque ${b.nombreBloque || "-"} — ${b.totalTallosBloque} tallos / ${b.totalRamosBloque} ramos</strong>
                      <div style="display: flex; flex-wrap: wrap; gap: 6px;">${camasHtml}</div>
                    </div>`;
                })
                .join("");

              return `
                <article class="semana-card" style="margin-bottom: 8px;">
                  <div class="semana-card-head">
                    <span class="semana-badge">📅 ${d.diaTexto}</span>
                    <div class="semana-totales">
                      <div class="semana-total-item"><span>Tallos</span><strong>${tallosDia}</strong></div>
                      <div class="semana-total-item"><span>Ramos</span><strong>${ramosDia}</strong></div>
                    </div>
                  </div>
                  ${bloquesHtml}
                </article>`;
            })
            .join("");

          if (!diasHtml) return "";

          return `
            <section style="margin-bottom: 16px;">
              <h3>Semana ${s.numeroSemana} (${fmtDate(s.fechaInicio)} - ${fmtDate(s.fechaFin)})</h3>
              ${diasHtml}
            </section>`;
        })
        .join("");

      if (!semanasHtml) return "";

      return `
        <article class="report-card" style="margin-bottom: 18px;">
          <h3 style="padding: 14px;">${v.categoria} · ${v.nombreVariedad}</h3>
          <div style="padding: 0 14px 14px;">${semanasHtml}</div>
        </article>`;
    })
    .join("");

  resumenTotales.textContent = `Total del panorama filtrado: ${Math.round(totalTallos)} tallos / ${Math.round(
    totalRamos
  )} ramos`;
  resultadoContenedor.innerHTML = html || `<p class="hint">Sin datos para estos filtros.</p>`;
}

variedadSelect.addEventListener("change", renderizar);
categoriaSelect.addEventListener("change", renderizar);
bloqueSelect.addEventListener("change", renderizar);
semanaSelect.addEventListener("change", renderizar);
limpiarBtn.addEventListener("click", limpiarFiltros);
refreshBtn.addEventListener("click", cargarTodo);
semanaInicioInput.addEventListener("change", cargarTodo);
anoInput.addEventListener("change", cargarTodo);

checkApi();
cargarTodo();
