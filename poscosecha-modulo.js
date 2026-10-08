const sesionPoscosecha = JSON.parse(sessionStorage.getItem("labores_usuario") || "null");
if (!sesionPoscosecha) window.location.href = "./login.html";

const params = new URLSearchParams(window.location.search);
const rol = String(params.get("rol") || "").toLowerCase();
const tipo = String(params.get("tipo") || "").toLowerCase();

const ROLES = {
  surtidor: "Surtidor",
  zunchador: "Zunchador",
  digitador: "Digitador",
};

const TIPOS = {
  rendimiento: { nombre: "Rendimiento", icono: "📊" },
  calidad: { nombre: "Calidad", icono: "✅" },
};

const rolNombre = ROLES[rol] || "Poscosecha";
const tipoInfo = TIPOS[tipo] || { nombre: "Módulo", icono: "💐" };

document.querySelector("#usuarioPill").textContent =
  sesionPoscosecha?.empleadoNombre || sesionPoscosecha?.username || "Usuario";

document.querySelector("#moduloTitulo").textContent =
  `${tipoInfo.icono} ${rolNombre} - ${tipoInfo.nombre}`;

document.querySelector("#moduloEstado").textContent =
  `Módulo de ${tipoInfo.nombre} de ${rolNombre} creado.`;

document.querySelector("#moduloDescripcion").textContent =
  "La estructura ya está disponible dentro de Poscosecha. Los campos específicos se agregarán según el flujo definido para este módulo.";
