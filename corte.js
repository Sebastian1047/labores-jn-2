const sesionCorte = JSON.parse(sessionStorage.getItem("labores_usuario") || "null");
if (!sesionCorte) {
  window.location.href = "./login.html";
}

const ROLES_CORTE = {
  cortador: { nombre: "Cortador", icono: "✂️" },
  garruchero: { nombre: "Garruchero", icono: "🪝" },
  recogedor: { nombre: "Recogedor", icono: "🧺" },
};

const usuarioPill = document.querySelector("#usuarioPill");
const corteTitulo = document.querySelector("#corteTitulo");
const rolSeleccionado = document.querySelector("#rolSeleccionado");
const estadoModulo = document.querySelector("#estadoModulo");
const tabs = [...document.querySelectorAll("[data-corte-rol]")];

usuarioPill.textContent = sesionCorte
  ? sesionCorte.empleadoNombre || sesionCorte.username
  : "Usuario";

function aplicarRol(rol) {
  const seleccionado = ROLES_CORTE[rol] ? rol : "cortador";
  const datos = ROLES_CORTE[seleccionado];

  tabs.forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.corteRol === seleccionado);
  });

  corteTitulo.textContent = `${datos.icono} Corte - ${datos.nombre}`;
  rolSeleccionado.textContent = datos.nombre;
  estadoModulo.textContent = `Formulario de ${datos.nombre} listo para agregar sus campos.`;

  const url = new URL(window.location.href);
  url.searchParams.set("rol", seleccionado);
  window.history.replaceState({}, "", url);
}

tabs.forEach((btn) => {
  btn.addEventListener("click", () => aplicarRol(btn.dataset.corteRol));
});

const rolSolicitado = new URLSearchParams(window.location.search).get("rol");
aplicarRol(rolSolicitado || "cortador");
