// Calidad Preparación de Camas: integrantes por etapa, búsqueda y demo segura.
// Este módulo no altera los catálogos ni envía colaboradores de prueba a la API.
(function () {
  "use strict";
  const CANTIDAD_GRUPOS = 7;
  const GRUPOS_CON_PERSONAL = 6; // Aseo (índice 6) solo refleja los grupos anteriores.
  const usuario = (() => {
    try { return JSON.parse(sessionStorage.getItem("labores_usuario") || "null")?.username || "local"; }
    catch { return "local"; }
  })();
  const hoy = new Date();
  const fecha = [hoy.getFullYear(), String(hoy.getMonth()+1).padStart(2,"0"), String(hoy.getDate()).padStart(2,"0")].join("-");
  const CLAVE = "laboresJN:preparacion:personal:v1:" + usuario + ":" + fecha;
  const CLAVE_PRUEBAS = "laboresJN:preparacion:evaluacionesPrueba:v1:" + usuario;
  const demo = Array.from({length:GRUPOS_CON_PERSONAL}, (_, i) =>
    Array.from({length:2}, (_, j) => ({
      codigo: "PRUEBA-PC-" + (i+1) + "-" + (j+1),
      nombre: "COLABORADOR PRUEBA " + (i*2+j+1),
      prueba: true
    }))
  );
  const limpio = (persona) => ({
    codigo: String(persona.codigo ?? "").trim(),
    nombre: String(persona.nombre ?? "").trim(),
    prueba: Boolean(persona.prueba)
  });
  function normalizarGuardado(valor) {
    // Compatible con listas antiguas de siete posiciones: descartar las
    // asignaciones independientes de Aseo sin modificar los seis grupos reales.
    if (!Array.isArray(valor) || valor.length < GRUPOS_CON_PERSONAL) return null;
    return valor.slice(0,GRUPOS_CON_PERSONAL).map(lista => Array.isArray(lista)
      ? [...new Map(lista.map(limpio).filter(p => p.codigo && p.nombre)
        .map(p => [p.codigo,p])).values()]
      : []);
  }
  function restaurar() {
    try {
      const raw = localStorage.getItem(CLAVE);
      if (!raw) return demo.map(lista => lista.map(p => ({...p})));
      return normalizarGuardado(JSON.parse(raw)) || demo.map(lista => lista.map(p => ({...p})));
    } catch { return demo.map(lista => lista.map(p => ({...p}))); }
  }
  const personal = restaurar();
  let catalogo = [];
  let configurado = false;
  const escapar = (s) => String(s ?? "").replace(/&/g,"&amp;")
    .replace(/</g,"&lt;").replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;").replace(/'/g,"&#39;");
  const normal = (s) => String(s ?? "").normalize("NFD")
    .replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();
  function guardarPersonal() {
    try { localStorage.setItem(CLAVE, JSON.stringify(personal)); }
    catch (e) { console.warn("No se pudo conservar la lista de colaboradores.",e); }
  }
  function integrantesDe(index) {
    if (index >= 0 && index < GRUPOS_CON_PERSONAL) return [...personal[index]];
    if (index !== 6) return [];
    // Aseo es solo la unión de los seis grupos; un trabajador repetido cuenta una vez.
    const unicos = new Map();
    personal.forEach(lista => lista.forEach(persona => {
      if (!unicos.has(persona.codigo)) unicos.set(persona.codigo, persona);
    }));
    return [...unicos.values()];
  }
  function etiquetas(index) {
    const integrantes = integrantesDe(index);
    return integrantes.length
      ? integrantes.map(p => '<span class="pc-persona' + (p.prueba ? ' pc-prueba' : '') + '">' +
        '<span class="pc-persona-nombre">' + escapar(p.nombre) +
        ' <small>(' + escapar(p.codigo) + ')</small></span>' +
        (p.prueba ? '<span class="pc-etiqueta-prueba">Prueba</span>' : '') +
        (index === 6 ? '' :
          '<button type="button" class="pc-quitar" data-pc-quitar="' + index +
          '" data-pc-codigo="' + escapar(p.codigo) +
          '" aria-label="Quitar a ' + escapar(p.nombre) + ' de la evaluación" title="Quitar de la evaluación">×</button>') +
        '</span>').join("")
      : '<p class="pc-sin-personal">' + (index === 6
        ? 'Sin colaboradores en Aseo. Agrega personas en los grupos anteriores.'
        : 'No hay personas en este grupo. Búscalas para agregarlas.') + '</p>';
  }
  function htmlGrupo(index) {
    const total = integrantesDe(index).length;
    return '<div class="pc-equipo" data-pc-grupo="' + index + '">' +
      '<div class="pc-equipo-cabecera"><strong>Colaboradores del grupo</strong>' +
      '<span class="pc-total" data-pc-total="' + index + '">' + total +
      (total === 1 ? ' persona' : ' personas') + '</span></div>' +
      (index === 6 ? '<p class="pc-explicacion">Esta lista se actualiza automáticamente con las personas de los seis grupos anteriores. Para agregar o quitar una persona, hazlo en su grupo de origen.</p>' : '') +
      '<div class="pc-personas" data-pc-personas="' + index + '">' + etiquetas(index) + '</div>' +
      (index === 6 ? '' :
        '<label class="pc-buscar-etiqueta" for="pc-buscar-' + index + '">Agregar colaborador</label>' +
        '<input class="pc-buscador" id="pc-buscar-' + index + '" type="search" data-pc-buscar="' + index +
        '" placeholder="Buscar por nombre o código…" autocomplete="off" aria-label="Buscar colaborador para este grupo" />' +
        '<div class="pc-resultados" data-pc-resultados="' + index + '" role="listbox" hidden></div>') +
      '</div>';
  }
  function actualizar() {
    for (let i=0;i<CANTIDAD_GRUPOS;i++) {
      const caja = document.querySelector('[data-pc-personas="' + i + '"]');
      const total = document.querySelector('[data-pc-total="' + i + '"]');
      if (caja) caja.innerHTML = etiquetas(i);
      if (total) {
        const n = integrantesDe(i).length;
        total.textContent = n + (n === 1 ? " persona" : " personas");
      }
    }
  }
  function quitar(index,codigo) {
    if (!Number.isInteger(index) || index < 0 || index >= GRUPOS_CON_PERSONAL) return;
    personal[index] = personal[index].filter(p => p.codigo !== codigo);
    guardarPersonal();
    actualizar(); // Aseo se recalcula automáticamente.
  }
  function agregar(index, persona) {
    if (!Number.isInteger(index) || index < 0 || index >= GRUPOS_CON_PERSONAL) return;
    const nuevo = limpio(persona);
    if (!nuevo.codigo || !nuevo.nombre || nuevo.prueba) return;
    if (!personal[index].some(p => p.codigo === nuevo.codigo)) {
      personal[index].push(nuevo);
      guardarPersonal();
    }
    actualizar();
    const buscador = document.querySelector('[data-pc-buscar="' + index + '"]');
    const resultados = document.querySelector('[data-pc-resultados="' + index + '"]');
    if (buscador) buscador.value = "";
    if (resultados) { resultados.hidden = true; resultados.innerHTML = ""; }
  }
  function buscar(index, texto) {
    if (!Number.isInteger(index) || index < 0 || index >= GRUPOS_CON_PERSONAL) return;
    const destino = document.querySelector('[data-pc-resultados="' + index + '"]');
    if (!destino) return;
    const q = normal(texto);
    if (!q) { destino.hidden = true; destino.innerHTML = ""; return; }
    const yaEnGrupo = new Set(integrantesDe(index).map(p => p.codigo));
    const encontrados = catalogo.filter(p => !yaEnGrupo.has(p.codigo) &&
      (normal(p.nombre).includes(q) || normal(p.codigo).includes(q))).slice(0,12);
    destino.innerHTML = encontrados.length
      ? encontrados.map(p => '<button type="button" class="pc-opcion" role="option" data-pc-agregar="' + index +
        '" data-pc-codigo="' + escapar(p.codigo) + '">' +
        escapar(p.nombre) + ' <small>(' + escapar(p.codigo) + ')</small></button>').join("")
      : '<p class="pc-sin-coincidencias">' +
        (catalogo.length ? "Sin coincidencias disponibles." : "No hay catálogo de trabajadores. Sincroniza la aplicación.") +
        '</p>';
    destino.hidden = false;
  }
  function configurarEventos() {
    if (configurado) return;
    const lista = document.getElementById("criteriosLista");
    if (!lista) return;
    configurado = true;
    lista.addEventListener("click", (evento) => {
      const quitarBtn = evento.target.closest("[data-pc-quitar]");
      if (quitarBtn) {
        quitar(Number(quitarBtn.dataset.pcQuitar),quitarBtn.dataset.pcCodigo);
        return;
      }
      const boton = evento.target.closest("[data-pc-agregar]");
      if (boton) {
        const persona = catalogo.find(p => p.codigo === boton.dataset.pcCodigo);
        if (persona) agregar(Number(boton.dataset.pcAgregar),persona);
      }
    });
    lista.addEventListener("input", (evento) => {
      const input = evento.target.closest("[data-pc-buscar]");
      if (input) buscar(Number(input.dataset.pcBuscar),input.value);
    });
    // Preparación conforme excluye todos los incumplimientos, y viceversa.
    lista.addEventListener("change", (evento) => {
      const checkbox = evento.target;
      if (!checkbox.matches(".calidad-item-x-input")) return;
      const conforme = lista.querySelector("[data-pc-conforme]");
      if (!conforme) return;
      if (checkbox === conforme && conforme.checked) {
        lista.querySelectorAll(".calidad-item-x-input:not([data-pc-conforme])")
          .forEach(input => { input.checked = false; });
      } else if (checkbox !== conforme && checkbox.checked) {
        conforme.checked = false;
      }
    });
    lista.addEventListener("keydown", (evento) => {
      const input = evento.target.closest("[data-pc-buscar]");
      if (!input) return;
      const index = Number(input.dataset.pcBuscar);
      if (evento.key === "Escape") {
        const opciones = document.querySelector('[data-pc-resultados="' + index + '"]');
        if (opciones) opciones.hidden = true;
      }
      if (evento.key === "Enter") {
        const primero = document.querySelector('[data-pc-resultados="' + index + '"] [data-pc-agregar]');
        if (primero?.dataset.pcCodigo) {
          evento.preventDefault();
          const persona = catalogo.find(p => p.codigo === primero.dataset.pcCodigo);
          if (persona) agregar(index,persona);
        }
      }
    });
    document.addEventListener("click", (evento) => {
      if (evento.target.closest(".pc-equipo")) return;
      document.querySelectorAll("[data-pc-resultados]").forEach(el => { el.hidden = true; });
    });
  }
  function setCatalogo(empleados) {
    const codigos = new Set();
    catalogo = (empleados || []).map(p => ({
      codigo: String(p.codigo ?? p.docid ?? p.id ?? "").trim(),
      nombre: String(p.nombre ?? p.empleadoNombre ?? "").trim(),
      prueba: false
    })).filter(p => {
      if (!p.codigo || !p.nombre || codigos.has(p.codigo) ||
          /^PRUEBA-PC-/i.test(p.codigo)) return false;
      codigos.add(p.codigo); return true;
    });
  }
  function estaPreparacionConforme() {
    return Boolean(document.querySelector("#criteriosLista [data-pc-conforme]:checked"));
  }
  function obtenerEvaluaciones() {
    const conforme = estaPreparacionConforme();
    const porPersona = new Map();
    for (let i=0;i<CANTIDAD_GRUPOS;i++) {
      const caja = document.querySelector('.calidad-preparacion-grupo[data-grupo="' + i + '"]');
      if (!caja) continue;
      const fallos = (conforme ? [] :
        [...caja.querySelectorAll(".calidad-item-x-input:checked")]).map(input => ({
        idItem: Number(input.dataset.itemId),
        item: input.dataset.itemNombre || "",
        subitem: "",
        cantidad: 1,
        marcadoX: true
      }));
      for (const persona of integrantesDe(i)) {
        let dato = porPersona.get(persona.codigo);
        if (!dato) {
          dato = { ...persona, grupos: [], fallosDetalle: [], incumplimientos: [], preparacionConforme: conforme };
          porPersona.set(persona.codigo,dato);
        }
        dato.grupos.push(i+1);
        fallos.forEach(fallo => {
          if (!dato.incumplimientos.includes(fallo.idItem)) {
            dato.incumplimientos.push(fallo.idItem);
            dato.fallosDetalle.push({...fallo});
          }
        });
      }
    }
    return [...porPersona.values()];
  }
  function guardarPruebas(evaluaciones,fechaEvaluacion) {
    if (!evaluaciones.length) return;
    const nuevas = evaluaciones.map(p => ({
      fecha: fechaEvaluacion, codigo: p.codigo, nombre: p.nombre,
      grupos: p.grupos, preparacionConforme: Boolean(p.preparacionConforme),
      incumplimientos: p.incumplimientos,
      fallosDetalle: p.fallosDetalle, esPrueba: true
    }));
    try {
      const actual = JSON.parse(localStorage.getItem(CLAVE_PRUEBAS) || "[]");
      const anteriores = Array.isArray(actual) ? actual : [];
      localStorage.setItem(CLAVE_PRUEBAS,JSON.stringify([...anteriores,...nuevas].slice(-300)));
    } catch (error) { console.warn("No se pudo guardar la simulación en este navegador.",error); }
  }
  window.PreparacionCamasGrupos = {
    htmlGrupo, configurarEventos, setCatalogo,
    obtenerEvaluaciones, guardarPruebas, estaPreparacionConforme,
    // Utilidades de lectura para verificar la agrupación sin registros reales.
    integrantesDe
  };
})();