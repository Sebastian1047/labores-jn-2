// Versión visible del build + registro del Service Worker + verificación/actualización forzada
// de versión en TODAS las pantallas (no solo el menú) -- antes este chequeo solo vivía en
// menu.html, así que una pantalla que se dejaba abierta o a la que se entraba directo (sin pasar
// por el menú) seguía sirviendo JS viejo cacheado aunque el servidor ya tuviera una versión
// nueva. Bug real 18/09/2026: Revisión seguía mostrando el filtro de 3 días ya corregido en el
// servidor porque esa pestaña nunca volvió a pasar por menu.html. "version.json" nunca se cachea
// (ver service-worker.js) -- se lee siempre fresco del servidor cuando hay señal.
const APP_VERSION = "1.0.48";

const appVersionEl = document.querySelector("#appVersion");
if (appVersionEl) appVersionEl.textContent = `Labores JN · v${APP_VERSION}`;

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("./service-worker.js", { updateViaCache: "none" })
      .then((registration) => registration.update())
      .catch((err) => console.error("SW registro falló", err));
  });
}

(async function verificarVersionApp() {
  // Guardado por versión (no un simple flag fijo) -- si el recargue SI trajo la version nueva,
  // esta constante cambia y el chequeo vuelve a correr normal en la proxima carga; si por algun
  // motivo el recargue NO trajo nada nuevo (ej. version.json tambien quedo mal cacheado), no se
  // queda en loop de recargas infinitas contra la misma version vieja.
  if (sessionStorage.getItem("laboresJnVersionVerificada") === APP_VERSION) return;
  try {
    const resp = await fetch(`./version.json?_=${Date.now()}`, { cache: "no-store" });
    if (!resp.ok) return;
    const data = await resp.json();
    if (data.version && data.version !== APP_VERSION) {
      sessionStorage.setItem("laboresJnVersionVerificada", APP_VERSION);

      // Si esta pantalla tiene el overlay de carga (hoy solo menu.html), aprovecharlo para
      // avisar antes de recargar; en las demas paginas simplemente se recarga sola.
      const overlay = document.querySelector("#cargaOverlay");
      const spinner = document.querySelector("#cargaSpinner");
      const aviso = document.querySelector("#descargaAviso");
      if (overlay) {
        overlay.hidden = false;
        if (spinner) {
          spinner.style.animation = "girar 1.1s linear infinite";
          spinner.textContent = "🔄";
        }
        if (aviso) aviso.textContent = "Hay una versión nueva disponible, actualizando…";
      }

      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) await reg.update();
      setTimeout(() => window.location.reload(), overlay ? 1200 : 400);
    }
  } catch (err) {
    // Sin red o version.json no disponible -- seguir con lo que ya está cacheado.
  }
})();










(function agregarBotonManualUsuario() {
  const archivo = location.pathname.split("/").pop() || "index.html";
  const manualesPorArchivo = {
    "index.html": "pronosticos",
    "floracion-siembra.html": "floracion",
    "siembra-hub.html": "siembraHub",
    "siembra.html": "siembra",
    "siembra-revision.html": "siembraRevision",
    "siembra-promedios.html": "siembraPromedios",
    "asegurar-corte.html": "asegurarCorte",
    "bandejas-enraizamiento.html": "bandejas",
    "desbotonado-mallas.html": "desbotonado",
    "corte.html": "corte",
    "preparacion-camas.html": "preparacion",
    "calidad-siembra.html": "calidadSiembra",
    "calidad-bandejas-enraizamiento.html": "calidadBandejas",
    "calidad-corte.html": "calidadCorte",
    "calidad-menu.html": "calidadDesbotonado",
    "calidad-preparacion-camas.html": "calidadPreparacion",
    "calidad-siembra-informe.html": "calidadInforme"
  };

  const modulo = manualesPorArchivo[archivo];
  if (!modulo || document.querySelector("#manualUsuarioBtn")) return;

  const barra = document.querySelector(".status-strip");
  if (!barra) return;

  const boton = document.createElement("a");
  boton.id = "manualUsuarioBtn";
  boton.className = "pill";
  boton.href = `./manual-usuario.html?modulo=${encodeURIComponent(modulo)}`;
  boton.textContent = "📘 Manual de usuario";
  barra.insertBefore(boton, barra.firstChild);
})();
