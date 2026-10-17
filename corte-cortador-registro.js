// Registro de labor para Corte/Cortador. Transportador y Recogedor no se modifican.
(function () {
  "use strict";

  const STORE = "cortadorRendimientoRegistros";
  const usuario = String(JSON.parse(sessionStorage.getItem("labores_usuario") || "null")?.username || "local");
  const SESSION_KEY = "laboresJn:corteCortador:colaboradores:" + usuario;
  const $ = (id) => document.getElementById(id);
  const form = $("registroCortadorForm");
  const obs = $("observacionesCortadorNuevo");
  const buscar = $("colaboradorBuscar");
  const seleccionadoTexto = $("colaboradorSeleccionado");
  const fecha = $("fecha");
  const lista = $("listaCortadores");
  const tabla = $("tablaCortadorRegistros");
  const bloque = $("bloqueCortador");
  const cama = $("camaCortador");
  const mensaje = $("mensajeRegistroCortador");

  let trabajadores = [];
  let registros = [];
  let candidato = null;
  let activo = null;
  let editandoId = null;
  let guardando = false;
  let cargarNumero = 0;

  const codigo = (e) => String(e?.codigo ?? e?.docid ?? e?.id ?? "").trim();
  const nombre = (e) => String(e?.nombre ?? e?.empleadoNombre ?? codigo(e)).trim();
  const texto = (v) => String(v ?? "").trim();
  const comparar = (v) => texto(v).toLocaleUpperCase("es").replace(/\s+/g, "")
    .replace(/^0+(?=\d)/, "");
  const escape = (v) => String(v ?? "").replace(/&/g, "&amp;")
    .replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  const clave = (v) => texto(v.fecha) + "|" + texto(v.codigo);

  function feedback(m, error = false) {
    mensaje.textContent = m;
    mensaje.classList.toggle("error", error);
  }
  function guardarSesion() {
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(trabajadores));
    } catch (e) {
      console.warn("No se pudo conservar la lista de cortadores", e);
    }
  }
  function restaurarSesion() {
    try {
      const guardados = JSON.parse(sessionStorage.getItem(SESSION_KEY) || "[]");
      trabajadores = Array.isArray(guardados) ?
        guardados.filter((x) => x?.fecha && x?.codigo && x?.nombre) : [];
    } catch (_) { trabajadores = []; }
  }
  function colaboradoresFecha() {
    const incluidos = new Map();
    trabajadores.filter((x) => x.fecha === fecha.value)
      .forEach((x) => incluidos.set(clave(x), x));
    registros.filter((r) => r.fecha === fecha.value)
      .forEach((r) => {
        const k = r.fecha + "|" + r.colaborador;
        if (!incluidos.has(k)) incluidos.set(k, {
          fecha: r.fecha, codigo: texto(r.colaborador),
          nombre: texto(r.colaboradorNombre || r.colaborador)
        });
      });
    return [...incluidos.values()].sort((a,b)=>a.nombre.localeCompare(b.nombre,"es"));
  }
  function reiniciarFormulario() {
    editandoId = null;
    $("cortadorAvisoEdicion").hidden = true;
    bloque.value = "";
    cargarCamasCortador();
    obs.value = "";
  }
  function activarColaborador(c, enfocar = true) {
    activo = {codigo: texto(c.codigo), nombre: texto(c.nombre)};
    candidato = activo;
    seleccionadoTexto.textContent = activo.nombre + " (" + activo.codigo + ")";
    reiniciarFormulario();
    pintar();
    if (enfocar) {
      bloque.scrollIntoView({behavior:"smooth",block:"center"});
      bloque.focus({preventScroll:true});
    }
  }
  function agregarColaborador() {
    if (rolActivo !== "cortador") return;
    if (!fecha.value) return feedback("Selecciona la fecha antes de agregar un colaborador.",true);
    if (!candidato) return feedback("Busca y selecciona un cortador por nombre o código.",true);
    const item = { fecha: fecha.value, codigo: candidato.codigo, nombre: candidato.nombre };
    if (!trabajadores.some((t) => clave(t) === clave(item))) {
      trabajadores.push(item);
      guardarSesion();
    }
    activarColaborador(item);
    feedback("Colaborador agregado. Registra el bloque y la cama trabajados y pulsa Guardar.");
  }

  function pintar() {
    if (rolActivo !== "cortador") return;
    const activos = colaboradoresFecha();
    $("contadorCortadores").textContent = activos.length +
      (activos.length === 1 ? " colaborador" : " colaboradores");
    lista.innerHTML = activos.length ? activos.map((c) => {
      const susCamas = registros.filter((r) =>
        r.fecha === fecha.value && texto(r.colaborador) === c.codigo).length;
      const elegido = activo?.codigo === c.codigo;
      return '<button type="button" data-cc-colaborador="'+escape(c.codigo)+'"'+
        (elegido?' class="active"':'')+' aria-pressed="'+elegido+'">'+
        '<span>'+escape(c.nombre)+'</span><span class="cc-contador">'+susCamas+' '+
        (susCamas===1?'cama':'camas')+'</span></button>';
    }).join("") : '<span class="hint">Todavía no hay cortadores agregados para esta fecha.</span>';

    $("cortadorActivoTexto").textContent = activo
      ? "Colaborador activo: "+activo.nombre+" ("+activo.codigo+")"
      : "Selecciona un cortador de la lista superior.";
    const filas = activo ? registros.filter((r) => r.fecha === fecha.value &&
      texto(r.colaborador) === activo.codigo) : [];
    $("resumenCortador").textContent = activo ?
      activo.nombre+" · "+filas.length+" cama(s) registradas en esta fecha." :
      "Selecciona un cortador para consultar sus camas.";
    $("contadorCamasCortador").textContent = filas.length +
      (filas.length===1?" cama":" camas");
    tabla.innerHTML = filas.length ? filas.map((r) => {
      const ed = r.id === editandoId;
      return '<tr'+(ed?' class="cc-editando"':'')+'><td>'+escape(r.bloque)+
        '</td><td>'+escape(r.cama)+'</td><td>'+escape(r.observaciones || "—")+
        '</td><td><button type="button" class="cc-modificar" data-cc-id="'+
        escape(r.id)+'"'+(ed?' disabled':'')+'>'+(ed?'Modificando…':'Modificar')+
        '</button></td></tr>';
    }).join("") : '<tr><td colspan="4">'+(activo?
      "Este cortador todavía no tiene camas registradas.":
      "Selecciona un cortador de la lista superior.")+'</td></tr>';
  }
  async function recargarRegistros() {
    const solicitud = ++cargarNumero;
    try {
      const datos = await OfflineDb.getAll(STORE);
      if (solicitud!==cargarNumero) return;
      registros = datos;
      pintar();
    } catch (e) {
      feedback("No se pudieron cargar los registros de Cortador: "+e.message,true);
    }
  }
  function duplicado(datos, excluirId=null) {
    return registros.some((r) => r.id!==excluirId &&
      r.fecha===datos.fecha &&
      texto(r.colaborador)===datos.colaborador &&
      comparar(r.bloque)===comparar(datos.bloque) &&
      comparar(r.cama)===comparar(datos.cama));
  }
  function editar(id) {
    if (rolActivo !== "cortador") return;
    const registro = registros.find((r)=>r.id===id);
    if (!registro || !activo || registro.fecha!==fecha.value ||
      texto(registro.colaborador)!==activo.codigo) {
      return feedback("Ese registro no pertenece al colaborador o fecha seleccionados.",true);
    }
    reiniciarFormulario();
    editandoId = registro.id;
    // Recargar opciones existentes y conservar valores históricos, si el catálogo cambió.
    if (![...bloque.options].some((op)=>op.value===registro.bloque))
      bloque.add(new Option(registro.bloque,registro.bloque));
    bloque.value = registro.bloque;
    cargarCamasCortador();
    if (![...cama.options].some((op)=>op.value===registro.cama))
      cama.add(new Option(registro.cama,registro.cama));
    cama.disabled = false;
    cama.value = registro.cama;
    obs.value = registro.observaciones || "";
    $("cortadorTextoEdicion").textContent =
      "Modificando bloque "+registro.bloque+", cama "+registro.cama+" de "+activo.nombre;
    $("cortadorAvisoEdicion").hidden = false;
    feedback("Modifica los datos necesarios y pulsa Guardar para actualizar la misma fila.");
    pintar();
    bloque.scrollIntoView({behavior:"smooth",block:"center"});
    bloque.focus({preventScroll:true});
  }
  async function guardar(event) {
    event.preventDefault();
    if (rolActivo !== "cortador" || guardando) return;
    if (!activo) return feedback("Primero agrega o selecciona un cortador.",true);
    const datos = {
      fecha:fecha.value,colaborador:activo.codigo,colaboradorNombre:activo.nombre,
      bloque:texto(bloque.value),cama:texto(cama.value),
      observaciones:obs.value.trim()
    };
    if (!datos.fecha || !datos.bloque || !datos.cama)
      return feedback("Completa la fecha, el bloque y la cama.",true);
    const previo = editandoId ? registros.find((r)=>r.id===editandoId) : null;
    if (editandoId && (!previo || previo.fecha!==datos.fecha ||
        texto(previo.colaborador)!==datos.colaborador))
      return feedback("El registro cambió de colaborador o fecha. Selecciona otra vez Modificar.",true);
    if (duplicado(datos,previo?.id||null))
      return feedback("Esta cama ya fue registrada por este cortador en la fecha seleccionada.",true);

    guardando = true;
    $("guardarCortador").disabled = true;
    try {
      const row = {
        ...(previo||{}),...datos,
        id:previo?.id||SyncEngine.generarUUID(),
        createdAt:previo?.createdAt||new Date().toISOString(),
        updatedAt:new Date().toISOString(),
        syncStatus:"SoloLocal",
        esPrueba:TiemposLaboresJN.esColaboradorPrueba(activo.codigo),
        usuario
      };
      await OfflineDb.put(STORE,row);
      const i=registros.findIndex((r)=>r.id===row.id);
      if (i>=0) registros[i]=row;else registros.push(row);
      // Solo el guardado de la labor incorpora a este empleado a Pendientes en Tiempos.
      window.RegistroLaborTiemposJN?.agregar({
        codigo:activo.codigo,nombre:activo.nombre,fecha:fecha.value,rol:"cortador"
      });
      const actualizado=Boolean(previo);
      reiniciarFormulario();
      pintar();
      feedback(actualizado?
        "Registro actualizado correctamente. La tabla muestra la cama corregida.":
        "Labor guardada. La cama aparece en la tabla y el colaborador puede registrar sus tiempos.");
    } catch (e) {
      feedback("No fue posible guardar la labor: "+e.message,true);
    } finally {
      guardando=false;
      $("guardarCortador").disabled=false;
    }
  }

  lista.addEventListener("click",(e)=>{
    const boton=e.target.closest("[data-cc-colaborador]");
    if (!boton || rolActivo!=="cortador") return;
    const persona=colaboradoresFecha().find((c)=>c.codigo===boton.dataset.ccColaborador);
    if (persona) activarColaborador(persona);
  });
  $("agregarCortador").addEventListener("click",agregarColaborador);
  tabla.addEventListener("click",(e)=>{
    const boton=e.target.closest("[data-cc-id]");
    if(boton&&!boton.disabled)editar(boton.dataset.ccId);
  });
  form.addEventListener("submit",guardar);
  $("limpiarCortador").addEventListener("click",()=>{
    reiniciarFormulario();pintar();feedback("Formulario limpio. Los registros guardados permanecen intactos.");
  });
  $("cancelarEdicionCortador").addEventListener("click",()=>{
    reiniciarFormulario();pintar();feedback("Modificación cancelada. Los datos guardados no cambiaron.");
  });
  fecha.addEventListener("change",()=>{
    activo=null;candidato=null;
    seleccionadoTexto.textContent="Sin cortador seleccionado";
    reiniciarFormulario();
    pintar();
  });

  window.CorteCortadorRegistro = {
    seleccionar(e) {
      if (rolActivo!=="cortador") return;
      candidato={codigo:codigo(e),nombre:nombre(e)};
    },
    cambiarRol(rol) {
      const cortador = rol==="cortador";
      $("cortadorColaboradoresPanel").hidden = !cortador;
      $("registroCortadorNuevo").hidden = !cortador;
      $("corteRegistroLegacy").hidden = cortador;
      document.querySelector(".app-shell").classList.toggle("cc-shell-activo",cortador);
      candidato=null;activo=null;
      reiniciarFormulario();
      if (cortador) {recargarRegistros();pintar();}
    }
  };
  restaurarSesion();
  window.CorteCortadorRegistro.cambiarRol(rolActivo);
})();
