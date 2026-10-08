// Service Worker — cache-first del app shell completo (HTML/CSS/JS/vendor/íconos) para que
// Pronósticos y Siembra abran y funcionen sin red, igual que AppLabores en Android.
// Subir CACHE_VERSION en cada deploy para invalidar la caché anterior.
const CACHE_VERSION = "labores-jn-1.0.58";

const APP_SHELL = [
  "./",
  "./login.html",
  "./login.js",
  "./menu.html",
  "./poscosecha-modulo.html",
  "./poscosecha-modulo.js",
  "./mipe-modulo.html",
  "./mipe-modulo.js",
  "./manual-usuario.html",
  "./manual-usuario.js",
  "./index.html",
  "./app.js",
  "./floracion-siembra.html",
  "./floracion-siembra.js",
  "./siembra.html",
  "./siembra.js",
  "./siembra-hub.html",
  "./siembra-hub.js",
  "./siembra-revision.html",
  "./siembra-revision.js",
  "./siembra-promedios.html",
  "./siembra-promedios.js",
  "./asegurar-corte.html",
  "./asegurar-corte.js",
  "./corte.html",
  "./corte.js",
  "./corte-cortador.html",
  "./corte-recogedor.html",
  "./corte-garruchero.html",
  "./calidad-corte.html",
  "./calidad-corte-aux.js",
  "./calidad-menu.html",
  "./calidad-siembra.html",
  "./calidad-bandejas-enraizamiento.html",
  "./bandejas-enraizamiento.html",
  "./bandejas-enraizamiento.js",
  "./calidad-preparacion-camas.html",
  "./preparacion-camas.html",
  "./preparacion-camas.js",
  "./calidad-desboton-spider-cremon.html",
  "./calidad-desboton-pompon.html",
  "./calidad-siembra.js",
  "./calidad-siembra-informe.html",
  "./calidad-siembra-informe.js",
  "./desbotonado-mallas.html",
  "./desbotonado-mallas.js",
  "./desbotonado-mallas.css",
  "./styles.css",
  "./manifest.json",
  "./icons/icon.svg",
  "./icons/jardines-san-nicolas.jpg",
  "./icons/aseguramiento.png",
  "./offline/api-base.js",
  "./offline/db.js",
  "./offline/sync-engine.js",
  "./offline/register-sw.js",
  "./offline/vendor/bcrypt.min.js",
  "./offline/vendor/xlsx.full.min.js",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

// Cache-first para el app shell propio. Las llamadas a la API (/produccion-api/api/...) NO
// se interceptan aquí -- están en el MISMO origen que este sitio (a diferencia de lo que decía
// este comentario antes), así que sin este filtro el navegador las cachearía igual que un
// archivo estático y serviría catálogos/listas viejos para siempre, incluso con internet
// funcionando (bug real encontrado 17/09/2026, el día que este SW empezó a correr de verdad
// por primera vez -- nunca se había registrado sin HTTPS). sync-engine.js ya maneja su propia
// lógica de reintento/timeout/cola offline para esas llamadas.
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  // "version.json" tampoco se cachea -- lo lee menu.html directo del servidor (con
  // cache:"no-store") para detectar si el dispositivo se quedó en una versión vieja.
  if (
    url.origin !== self.location.origin ||
    event.request.method !== "GET" ||
    url.pathname.includes("/api/") ||
    url.pathname.endsWith("/version.json")
  ) {
    return;
  }

  event.respondWith(
    // Red primero: evita que una caché vieja vuelva a servir HTML/JS de otra versión.
    // Sin conexión se usa el app shell cacheado, conservando el funcionamiento offline.
    fetch(event.request, { cache: "no-store" })
      .then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request, { ignoreSearch: true }))
  );
});


