// Login online-first con caída a verificación local (IndexedDB + bcrypt) cuando no hay red,
// igual en resultado al login 100% offline de AppLabores, pero sin mandar la tabla completa
// de hashes al navegador: solo se recuerda, por dispositivo, la última contraseña válida de
// cada usuario que ya inició sesión aquí una vez con conexión.

const usernameInput = document.querySelector("#username");
const passwordInput = document.querySelector("#password");
const loginBtn = document.querySelector("#loginBtn");
const loginMensaje = document.querySelector("#loginMensaje");
const loginResultStatus = document.querySelector("#loginResultStatus");
const offlineHint = document.querySelector("#offlineHint");

if (sessionStorage.getItem("labores_usuario")) {
  window.location.href = "./menu.html";
}

function marcarEstado(estado, mensaje) {
  loginResultStatus.classList.remove("ok", "warning", "error");
  if (estado) loginResultStatus.classList.add(estado);
  loginMensaje.textContent = mensaje;
}

function guardarSesion(datos) {
  sessionStorage.setItem(
    "labores_usuario",
    JSON.stringify({ username: datos.username, role: datos.role, empleadoNombre: datos.empleadoNombre })
  );
}

async function intentarLoginOnline(username, password) {
  const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
    signal: AbortSignal.timeout(6000),
  });
  const data = await response.json();
  return { ok: response.ok, data };
}

async function intentarLoginOffline(username, password) {
  const local = await OfflineDb.get("usuarios", username);
  if (!local || !local.localHash) return null;
  const valido = dcodeIO.bcrypt.compareSync(password, local.localHash);
  if (!valido) return { success: false, message: "Contraseña incorrecta (verificación local sin conexión)." };
  return { success: true, username: local.username, role: local.role, empleadoNombre: local.empleadoNombre };
}

async function iniciarSesion() {
  // Normalizado a MAYUSCULAS aqui mismo -- el servidor ya guarda/compara el username asi
  // (AuthService.cs, usernameUpper), pero la verificacion OFFLINE es una busqueda exacta en
  // IndexedDB sin ese normalizado de por medio. Si alguien tecleaba el usuario con un casing
  // distinto la segunda vez (muy comun con auto-capitalizacion del teclado del celular), la
  // busqueda offline no encontraba la fila aunque SI estuviera guardada -- parecia "sin sesion
  // guardada" para un usuario que unos minutos antes si habia entrado bien (bug real
  // encontrado en campo 17/09/2026, con JOANA.GALLEGO).
  const username = usernameInput.value.trim().toUpperCase();
  const password = passwordInput.value;
  offlineHint.textContent = "";

  if (!username || !password) {
    marcarEstado("error", "Usuario y contraseña son obligatorios.");
    return;
  }

  loginBtn.disabled = true;
  marcarEstado(null, "Verificando…");

  try {
    let data;
    try {
      const respuesta = await intentarLoginOnline(username, password);
      if (!respuesta.ok || !respuesta.data.success) {
        marcarEstado("error", respuesta.data.message || "No fue posible iniciar sesión.");
        return;
      }
      data = respuesta.data;

      // Guardar/actualizar credencial local para poder entrar offline la próxima vez.
      await OfflineDb.put("usuarios", {
        username: data.username,
        localHash: dcodeIO.bcrypt.hashSync(password, 10),
        role: data.role,
        empleadoNombre: data.empleadoNombre,
      });
    } catch (err) {
      // Cualquier excepción aquí es fallo de red (timeout/fetch) — un rechazo real de
      // credenciales ya se resolvió arriba con `return` sin lanzar excepción.
      offlineHint.textContent = "Sin conexión: verificando con la última sesión guardada en este equipo…";
      const offlineResult = await intentarLoginOffline(username, password);
      if (!offlineResult) {
        marcarEstado("error", "Sin conexión y sin sesión previa guardada en este equipo para este usuario.");
        return;
      }
      if (!offlineResult.success) {
        marcarEstado("error", offlineResult.message);
        return;
      }
      data = offlineResult;
    }

    guardarSesion(data);
    marcarEstado("ok", "Inicio de sesión exitoso.");
    window.location.href = "./menu.html";
  } finally {
    loginBtn.disabled = false;
  }
}

loginBtn.addEventListener("click", iniciarSesion);
passwordInput.addEventListener("keydown", (ev) => {
  if (ev.key === "Enter") iniciarSesion();
});
