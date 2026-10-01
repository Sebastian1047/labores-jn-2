// Única implementación de resolveApiBaseUrl para todas las páginas (antes había 3 versiones
// ligeramente distintas repetidas en app.js/login.js/siembra.js).
function resolveApiBaseUrl() {
  return `${window.location.origin}/produccion-api-jn`;
}

const API_BASE_URL = resolveApiBaseUrl();
