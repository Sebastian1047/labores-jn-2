const sesion = JSON.parse(sessionStorage.getItem("labores_usuario") || "null") || { username: "PRUEBA.WEB", role: "Administrador", empleadoNombre: "Modo prueba" };
if (!sesion) {
  window.location.href = "./login.html";
}

const apiStatusPill = document.querySelector("#apiStatusPill");
const usuarioPill = document.querySelector("#usuarioPill");
const pendientesAviso = document.querySelector("#pendientesAviso");
const cardSincronizarHint = document.querySelector("#cardSincronizarHint");
const ultimaSincroAviso = document.querySelector("#ultimaSincroAviso");

usuarioPill.textContent = sesion ? sesion.empleadoNombre || sesion.username : "Usuario";

async function mostrarUltimaSincronizacion() {
  const at = await OfflineDb.getMeta("siembrasSyncAt");
  if (!at) {
    ultimaSincroAviso.textContent = "Todavía no se ha sincronizado en este equipo.";
    return;
  }
  const fecha = new Date(at);
  ultimaSincroAviso.textContent = `Última sincronización: ${fecha.toLocaleDateString("es-CO")} ${fecha.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}`;
}

async function checkApi() {
  try {
    await SyncEngine.apiGetOnline("/api/siembra/online/origenes");
    apiStatusPill.textContent = "En línea";
    apiStatusPill.classList.add("ok");
    // Con red disponible, aprovechar para refrescar catálogos y el histórico reciente en segundo plano.
    SyncEngine.sincronizarCatalogos().catch(() => {});
    SyncEngine.sincronizarSiembrasDesdeServidor().catch(() => {});
  } catch {
    apiStatusPill.textContent = "Sin conexión";
    apiStatusPill.classList.add("warn");
  }
}

async function consultarPendientes() {
  const todas = await SyncEngine.obtenerTodasSiembrasLocal();
  const conError = todas.filter((s) => s.syncStatus === "Error");
  const pendientes = todas.filter((s) => s.syncStatus && s.syncStatus !== "Sincronizado" && s.syncStatus !== "Error");
  const total = conError.length + pendientes.length;

  if (conError.length > 0) {
    pendientesAviso.textContent = `⚠️ ${conError.length} siembra(s) con error al sincronizar: ${conError[0].errorMensaje || "revise la conexión"}.`;
  } else if (pendientes.length > 0) {
    pendientesAviso.textContent = `⚠️ Tienes ${pendientes.length} siembra(s) sin sincronizar en este equipo.`;
  } else {
    pendientesAviso.textContent = "";
  }
  cardSincronizarHint.textContent = total > 0 ? `${total} pendiente(s) por subir` : "Info OffLine";
  await mostrarUltimaSincronizacion();
}

async function sincronizar() {
  cardSincronizarHint.textContent = "Sincronizando…";
  try {
    const resultado = await SyncEngine.sincronizarPendientesSiembra();
    await SyncEngine.sincronizarCatalogos();
    await SyncEngine.sincronizarSiembrasDesdeServidor();
    await SyncEngine.sincronizarPendientesHoras().catch(() => {});
    pendientesAviso.textContent =
      resultado.fallidas > 0
        ? `Sincronizado: ${resultado.subidas} subida(s), ${resultado.fallidas} fallida(s) (sin red o rechazadas).`
        : resultado.subidas > 0
        ? `Sincronizado: ${resultado.subidas} siembra(s) subida(s) correctamente.`
        : "Todo estaba sincronizado.";
  } catch (err) {
    pendientesAviso.textContent = "No fue posible sincronizar: sin conexión con el servidor.";
  } finally {
    await consultarPendientes();
  }
}

document.querySelector("#cardRegistro").addEventListener("click", () => (window.location.href = "./siembra.html"));
document.querySelector("#cardRevision").addEventListener("click", () => (window.location.href = "./siembra-revision.html"));
document.querySelector("#cardDetalle").addEventListener("click", () => (window.location.href = "./siembra-promedios.html"));
document.querySelector("#cardSincronizar").addEventListener("click", sincronizar);

// Al volver la red (el navegador dispara "online" apenas detecta conectividad), reintentar
// automaticamente en vez de esperar a que alguien toque "Sincronizar" -- checklist offline-first.
window.addEventListener("online", () => {
  apiStatusPill.textContent = "En línea";
  apiStatusPill.classList.remove("warn");
  apiStatusPill.classList.add("ok");
  sincronizar();
});
window.addEventListener("offline", () => {
  apiStatusPill.textContent = "Sin conexión";
  apiStatusPill.classList.remove("ok");
  apiStatusPill.classList.add("warn");
});

checkApi();
consultarPendientes();
