// Siembra Rendimiento: jornada por colaborador, registros de siembra y tiempos.
// Almacenes locales independientes del Registro Siembra Campo existente.
(function () {
  "use strict";

  const sesion = JSON.parse(sessionStorage.getItem("labores_usuario") || "null");
  if (!sesion) {
    window.location.replace("./login.html");
    return;
  }
  const $ = (id) => document.getElementById(id);
  const STORE = "siembraRendimientoRegistros";
  const usuario = String(sesion.username || "local");
  const SESSION_KEY = "laboresJn:siembraRendimiento:colaboradores:" + usuario;
  const fecha = $("fecha");
  const formulario = $("siembraRendimientoForm");
  const campos = {
    origen: $("origen"),
    lineas: $("lineas"),
    densidad: $("densidad"),
    semanaProgramada: $("semanaProgramada"),
    anoProgramado: $("anoProgramado"),
    bloque: $("bloqueBuscar"),
    cama: $("camaBuscar"),
    variedad: $("variedadBuscar"),
    clon: $("clonBuscar"),
    observaciones: $("observaciones")
  };
  const trabajadorInput = $("sembradorBuscar");
  let catalogos = { empleados:[], camas:[], variedades:[], clones:[], origenes:[], semanas:[] };
  let trabajadores = [];
  let registros = [];
  let seleccionado = null;
  let activo = null;
  let editando = null;
  let variedadCodigo = null;
  let clonCodigo = null;
  let cargarNumero = 0;
  let guardando = false;

  const normal = (v) => String(v == null ? "" : v).trim().toLocaleLowerCase("es");
  const codigo = (e) => String(e.codigo ?? e.Codigo ?? e.id ?? e.docid ?? "").trim();
  const nombre = (e) => String(e.nombre ?? e.Nombre ?? e.descripcion ?? codigo(e)).trim();
  const escapar = (v) => String(v == null ? "" : v).replace(/&/g,"&amp;")
    .replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")
    .replace(/'/g,"&#39;");
  const hoyLocal = () => {
    const d = new Date();
    return [d.getFullYear(), String(d.getMonth()+1).padStart(2,"0"), String(d.getDate()).padStart(2,"0")].join("-");
  };
  function semanaCalendario(iso) {
    const d = new Date(iso + "T12:00:00");
    if (Number.isNaN(d.getTime())) return "";
    d.setDate(d.getDate() + 4 - (d.getDay() || 7));
    const inicio = new Date(d.getFullYear(),0,1);
    return Math.ceil((((d-inicio)/86400000)+1)/7);
  }
  function estado(msg, error=false) {
    $("registroMensaje").textContent = msg;
    $("registroMensaje").classList.toggle("error", Boolean(error));
  }
  function guardarColaboradoresSesion() {
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(trabajadores));
    } catch (error) {
      console.warn("No se pudo conservar la selección de colaboradores", error);
    }
  }
  function restaurarColaboradoresSesion() {
    try {
      const data = JSON.parse(sessionStorage.getItem(SESSION_KEY) || "[]");
      trabajadores = Array.isArray(data) ? data.filter((c) => c.fecha && c.codigo && c.nombre) : [];
    } catch (_) { trabajadores = []; }
  }
  function combinacionTrabajador(c) {
    return c.fecha + "|" + c.codigo;
  }
  function integradosEnFecha() {
    const nuevos = new Map();
    trabajadores.filter((c) => c.fecha === fecha.value)
      .forEach((c) => nuevos.set(combinacionTrabajador(c),c));
    registros.filter((r) => r.fecha === fecha.value)
      .forEach((r) => {
        const key = r.fecha + "|" + r.colaborador;
        if (!nuevos.has(key)) nuevos.set(key,{
          fecha:r.fecha,codigo:String(r.colaborador),nombre:r.colaboradorNombre || r.colaborador
        });
      });
    return [...nuevos.values()].sort((a,b) => a.nombre.localeCompare(b.nombre,"es"));
  }
  function mostrarSugerencias(input,lista,items,label,elegir,limite=60) {
    lista.innerHTML = "";
    const busqueda = normal(input.value);
    const visibles = items.filter((item) =>
      normal(label(item)).includes(busqueda)).slice(0,limite);
    if (!visibles.length) {
      const vacio = document.createElement("p");
      vacio.className = "hint";
      vacio.textContent = "No hay coincidencias. Puedes escribir el valor si todavía no aparece en el catálogo.";
      lista.appendChild(vacio);
    }
    visibles.forEach((item) => {
      const opcion = document.createElement("button");
      opcion.type = "button";
      opcion.textContent = label(item);
      opcion.addEventListener("mousedown",(event) => {
        event.preventDefault();
        elegir(item);
        lista.hidden = true;
        lista.innerHTML = "";
      });
      lista.appendChild(opcion);
    });
    lista.hidden = false;
  }
  function conectarBuscador(input,lista,obtener,label,elegir) {
    const pintar = () => mostrarSugerencias(input,lista,obtener(),label,elegir);
    input.addEventListener("focus",pintar);
    input.addEventListener("input",pintar);
    input.addEventListener("blur",() => {
      // Mousedown de cada opción se ejecuta antes del blur.
      setTimeout(() => { lista.hidden = true; },130);
    });
    return pintar;
  }
  function actualizarCatalogos() {
    campos.origen.innerHTML = '<option value="">Seleccione un origen</option>';
    const origenes = [...catalogos.origenes];
    if (!origenes.length) origenes.push({nombre:"Origen de prueba"});
    const encontrados = new Set();
    origenes.forEach((item) => {
      const n = String(item.nombre || item.Nombre || "").trim();
      if (!n || encontrados.has(n)) return;
      encontrados.add(n);
      campos.origen.add(new Option(n,n));
    });
  }
  function cambiarVariedad(articulo) {
    campos.variedad.value = nombre(articulo);
    variedadCodigo = codigo(articulo) || campos.variedad.value;
    campos.clon.value = "";
    clonCodigo = null;
  }
  function cambiarClon(item) {
    campos.clon.value = nombre(item);
    clonCodigo = codigo(item) || campos.clon.value;
  }

  conectarBuscador(trabajadorInput,$("sembradorLista"),
    () => catalogos.empleados,
    (item) => nombre(item) + " (" + codigo(item) + ")",
    (item) => {
      seleccionado = {codigo:codigo(item),nombre:nombre(item)};
      trabajadorInput.value = "";
      $("sembradorSeleccionado").textContent = seleccionado.nombre + " (" + seleccionado.codigo + ")";
    });
  conectarBuscador(campos.bloque,$("bloqueLista"),
    () => [...new Set(catalogos.camas.map((x)=>String(x.bloque || "").trim()).filter(Boolean))],
    (n) => "Bloque " + n,
    (n) => { campos.bloque.value = n;campos.cama.value = ""; });
  conectarBuscador(campos.cama,$("camaLista"),
    () => [...new Set(catalogos.camas.filter((c)=>normal(c.bloque)===normal(campos.bloque.value))
      .map((c)=>String(c.cama || "").trim()).filter(Boolean))],
    (n)=>"Cama "+n,
    (n)=>{campos.cama.value=n;});
  conectarBuscador(campos.variedad,$("variedadLista"),
    () => catalogos.variedades,
    (e) => nombre(e),
    cambiarVariedad);
  conectarBuscador(campos.clon,$("clonLista"),
    () => catalogos.clones.filter((e) => !variedadCodigo ||
      normal(e.variedad) === normal(variedadCodigo)),
    (e) => nombre(e),
    cambiarClon);

  campos.variedad.addEventListener("input",()=> {
    variedadCodigo = null;
    clonCodigo = null;
    campos.clon.value = "";
  });
  campos.clon.addEventListener("input",()=> {clonCodigo=null;});
  campos.bloque.addEventListener("input",()=> {campos.cama.value="";});

  function limpiarFormulario() {
    editando = null;
    $("avisoEdicion").hidden = true;
    formulario.reset();
    variedadCodigo = null;
    clonCodigo = null;
    campos.semanaProgramada.value = semanaCalendario(fecha.value);
    campos.anoProgramado.value = fecha.value.slice(0,4);
    $("bloqueLista").hidden = true;
    $("camaLista").hidden = true;
    $("variedadLista").hidden = true;
    $("clonLista").hidden = true;
  }
  function seleccionarColaborador(c, enfocar=true) {
    activo = {codigo:c.codigo,nombre:c.nombre};
    seleccionado = activo;
    $("sembradorSeleccionado").textContent = c.nombre + " (" + c.codigo + ")";
    limpiarFormulario();
    pintar();
    if (enfocar) {
      $("origen").scrollIntoView({behavior:"smooth",block:"center"});
      $("origen").focus({preventScroll:true});
    }
  }
  function agregarColaborador() {
    if (!fecha.value) return estado("Selecciona primero una fecha.",true);
    if (!seleccionado) return estado("Busca un colaborador y selecciónalo en la lista.",true);
    const entry = {fecha:fecha.value,...seleccionado};
    if (!trabajadores.some((t) => combinacionTrabajador(t)===combinacionTrabajador(entry))) {
      trabajadores.push(entry);
      guardarColaboradoresSesion();
    }
    seleccionarColaborador(entry);
    estado("Colaborador agregado. Registra una siembra y pulsa Guardar.");
  }
  $("agregarColaborador").addEventListener("click",agregarColaborador);
  $("listaColaboradores").addEventListener("click",(event)=>{
    const b=event.target.closest("[data-sr-colaborador]");
    if (!b) return;
    const c=integradosEnFecha().find((c)=>c.codigo===b.dataset.srColaborador);
    if (c) seleccionarColaborador(c);
  });

  function numero(v) {
    return new Intl.NumberFormat("es-CO",{maximumFractionDigits:2}).format(Number(v)||0);
  }
  function pintar() {
    const total = integradosEnFecha();
    $("contadorColaboradores").textContent=total.length+(total.length===1?" colaborador":" colaboradores");
    $("listaColaboradores").innerHTML=total.length ? total.map((c)=>{
      const registrosPersona = registros.filter((r)=>r.fecha===fecha.value&&String(r.colaborador)===c.codigo);
      const selected = activo?.codigo===c.codigo;
      return '<button type="button" data-sr-colaborador="'+escapar(c.codigo)+'" class="'+(selected?'active':'')+
        '" aria-pressed="'+selected+'"><span>'+escapar(c.nombre)+'</span><span class="sr-count">'+
        registrosPersona.length+' '+(registrosPersona.length===1?'registro':'registros')+'</span></button>';
    }).join(""):'<span class="hint">Todavía no hay colaboradores agregados para esta fecha.</span>';
    $("colaboradorActivo").textContent=activo ?
      "Colaborador activo: "+activo.nombre+" ("+activo.codigo+")" :
      "Selecciona un colaborador de la lista superior.";
    const filas=activo ? registros.filter((r)=>r.fecha===fecha.value &&
      String(r.colaborador)===activo.codigo) : [];
    $("detallePersona").textContent=activo ?
      activo.nombre+" · "+filas.length+" registros de siembra para esta fecha." :
      "Selecciona un colaborador para consultar sus registros.";
    $("contadorRegistros").textContent=filas.length+(filas.length===1?" registro":" registros");
    $("tablaRegistros").innerHTML=filas.length? filas.map((r)=>{
      const editing=editando?.id===r.id;
      return '<tr'+(editing?' class="sr-editando"':'')+'>'+
        '<td>'+escapar(r.origen)+'</td><td>'+escapar(r.bloque)+'</td><td>'+escapar(r.cama)+'</td>'+
        '<td>'+escapar(r.variedadNombre || r.variedad)+'</td><td>'+escapar(r.clonNombre || r.vclon || "—")+'</td>'+
        '<td>'+escapar(r.lineas || "Pendiente")+'</td><td>'+escapar(r.densidad)+'</td>'+
        '<td>'+escapar(r.semanaProgramada)+'</td><td>'+escapar(r.anoProgramado)+'</td>'+
        '<td>'+escapar(r.observaciones || "—")+'</td>'+
        '<td><button type="button" class="sr-modificar" data-sr-editar="'+escapar(r.id)+
        '"'+(editing?' disabled':'')+'>'+(editing?'Modificando…':'Modificar')+'</button></td></tr>';
    }).join(""):'<tr><td colspan="11">'+
       (activo?"Este colaborador todavía no tiene siembras registradas.":"Selecciona un colaborador.")+
       '</td></tr>';
  }

  function valoresFormulario() {
    if (!activo) throw new Error("Primero agrega o selecciona un colaborador.");
    const bloque=campos.bloque.value.trim();
    const cama=campos.cama.value.trim();
    const variedad=campos.variedad.value.trim();
    const origen=campos.origen.value.trim();
    const lineas=campos.lineas.value.trim();
    const densidad=campos.densidad.value.trim();
    if (!fecha.value || !bloque || !cama || !variedad || !origen) {
      throw new Error("Completa fecha, origen, bloque, cama y variedad.");
    }
    if (lineas && !/^\d{1,3}$/.test(lineas)) {
      throw new Error("Líneas debe tener entre 1 y 3 dígitos, o quedar en blanco.");
    }
    if (!/^\d{1,5}$/.test(densidad) || Number(densidad)<=0) {
      throw new Error("La densidad debe ser numérica, de 1 a 5 dígitos.");
    }
    const semana=Number(campos.semanaProgramada.value);
    const ano=Number(campos.anoProgramado.value);
    if (!Number.isInteger(semana)||semana<1||semana>53||!Number.isInteger(ano)||ano<2000||ano>2100) {
      throw new Error("Revisa la semana (1-53) y el año de planeación.");
    }
    const variedadElegida = catalogos.variedades.find((v)=>
      (variedadCodigo && codigo(v)===variedadCodigo) || normal(nombre(v))===normal(variedad));
    const clonElegido = catalogos.clones.find((c)=>
      (clonCodigo && codigo(c)===clonCodigo) || normal(nombre(c))===normal(campos.clon.value));
    return {
      fecha:fecha.value,colaborador:activo.codigo,colaboradorNombre:activo.nombre,
      empleado:activo.codigo,origen,bloque,cama,
      lineas:lineas?Number(lineas):0,densidad:Number(densidad),
      variedad:variedadElegida?codigo(variedadElegida):variedad,
      variedadNombre:variedad,vclon:campos.clon.value.trim()?(clonElegido?codigo(clonElegido):campos.clon.value.trim()):null,
      clonNombre:campos.clon.value.trim()||null,
      semanaProgramada:semana,anoProgramado:ano,
      observaciones:campos.observaciones.value.trim(),
      login:usuario
    };
  }
  function yaRegistrado(data,ignorarId=null) {
    const normalCama=(valor)=>normal(valor).replace(/^cama[\s\-#:.]+/,"").replace(/^0+(?=\d)/,"");
    return registros.some((r)=>r.id!==ignorarId && r.fecha===data.fecha &&
      String(r.colaborador)===data.colaborador &&
      normal(r.origen)===normal(data.origen) &&
      normal(r.bloque)===normal(data.bloque) &&
      normalCama(r.cama)===normalCama(data.cama) &&
      normal(r.variedad)===normal(data.variedad) &&
      normal(r.vclon)===normal(data.vclon) &&
      Number(r.densidad)===data.densidad);
  }
  function cargarEdicion(id) {
    const r=registros.find((e)=>e.id===id);
    if (!r || r.fecha!==fecha.value || !activo || String(r.colaborador)!==activo.codigo) {
      estado("Ese registro no pertenece al colaborador y fecha seleccionados.",true);return;
    }
    limpiarFormulario();
    editando={id:r.id,fecha:r.fecha,colaborador:r.colaborador};
    campos.origen.value=r.origen;
    campos.lineas.value=r.lineas ? String(r.lineas) : "";
    campos.densidad.value=String(r.densidad ?? "");
    campos.semanaProgramada.value=String(r.semanaProgramada ?? "");
    campos.anoProgramado.value=String(r.anoProgramado ?? "");
    campos.bloque.value=r.bloque;
    campos.cama.value=r.cama;
    campos.variedad.value=r.variedadNombre||r.variedad||"";
    variedadCodigo=r.variedad||null;
    campos.clon.value=r.clonNombre||r.vclon||"";
    clonCodigo=r.vclon||null;
    campos.observaciones.value=r.observaciones||"";
    $("textoEdicion").textContent="Modificando siembra: bloque "+r.bloque+", cama "+r.cama+", colaborador "+activo.nombre;
    $("avisoEdicion").hidden=false;
    estado("Edita los campos necesarios y pulsa Guardar para actualizar la misma fila.");
    pintar();
    $("origen").scrollIntoView({behavior:"smooth",block:"center"});
    $("origen").focus({preventScroll:true});
  }
  $("tablaRegistros").addEventListener("click",(ev)=>{
    const b=ev.target.closest("[data-sr-editar]");
    if(b&&!b.disabled)cargarEdicion(b.dataset.srEditar);
  });
  $("cancelarEdicion").addEventListener("click",()=>{
    limpiarFormulario();pintar();estado("Modificación cancelada. Los registros permanecen intactos.");
  });
  $("limpiarLabor").addEventListener("click",()=>{
    limpiarFormulario();pintar();estado("Formulario limpio. Los registros guardados permanecen intactos.");
  });
  formulario.addEventListener("submit",async(ev)=>{
    ev.preventDefault();
    if (guardando) return;
    try {
      const datos=valoresFormulario();
      const previo=editando?registros.find((r)=>r.id===editando.id):null;
      if (editando && (!previo || previo.fecha!==fecha.value ||
        String(previo.colaborador)!==activo.codigo)) {
        throw new Error("No se puede modificar este registro porque cambió la fecha o el colaborador.");
      }
      if (yaRegistrado(datos,previo?.id||null)) {
        throw new Error("Esta misma siembra ya está registrada para el colaborador y la fecha. Modifica el registro existente.");
      }
      guardando=true;
      $("guardarLabor").disabled=true;
      const row={
        ...(previo||{}),...datos,
        id:previo?.id||SyncEngine.generarUUID(),
        createdAt:previo?.createdAt||new Date().toISOString(),
        updatedAt:new Date().toISOString(),
        syncStatus:"SoloLocal",esPrueba:!!TiemposLaboresJN.esColaboradorPrueba(activo.codigo)
      };
      await OfflineDb.put(STORE,row);
      const idx=registros.findIndex((r)=>r.id===row.id);
      if(idx>=0)registros[idx]=row;else registros.push(row);
      const actualizada=Boolean(previo);
      limpiarFormulario();
      pintar();
      estado(actualizada?"Registro actualizado correctamente; la tabla refleja los cambios.":
        "Siembra guardada para "+datos.colaboradorNombre+"; aparece en la tabla de su jornada.");
    }catch(err){
      estado(err.message||"No fue posible guardar la siembra.",true);
    }finally{
      guardando=false;
      $("guardarLabor").disabled=false;
    }
  });

  function cambiarFecha(){
    activo=null;seleccionado=null;
    $("sembradorSeleccionado").textContent="Sin colaborador seleccionado";
    limpiarFormulario();
    pintar();
  }
  fecha.addEventListener("change",cambiarFecha);
  function cambiarVista(tipo) {
    const tiempos=tipo==="tiempos";
    $("vistaRegistro").hidden=tiempos;
    $("vistaTiempos").hidden=!tiempos;
    document.querySelectorAll("[data-siembra-vista]").forEach((b)=>
      b.classList.toggle("active",b.dataset.siembraVista===tipo));
  }
  document.querySelectorAll("[data-siembra-vista]").forEach((b)=>
    b.addEventListener("click",()=>cambiarVista(b.dataset.siembraVista)));

  async function refrescarCatalogos(local=true){
    try {
      catalogos=await SyncEngine.obtenerCatalogosLocal();
      catalogos.empleados=TiemposLaboresJN.conColaboradoresPrueba(catalogos.empleados||[]);
      catalogos.camas=TiemposLaboresJN.conCamasPrueba(catalogos.camas||[]);
      actualizarCatalogos();
      $("apiStatusPill").textContent=local?"Catálogos locales":"Catálogos actualizados";
    }catch(error){
      catalogos.empleados=TiemposLaboresJN.conColaboradoresPrueba([]);
      catalogos.camas=TiemposLaboresJN.conCamasPrueba([]);
      actualizarCatalogos();
      estado("Puedes ensayar con colaboradores y camas de prueba. No se cargaron los catálogos reales.",true);
    }
  }
  async function recargarRegistros(){
    const carga=++cargarNumero;
    try{
      const datos=await OfflineDb.getAll(STORE);
      if(carga!==cargarNumero) return;
      registros=datos;
      pintar();
    }catch(error){estado("No fue posible recuperar los registros locales: "+error.message,true);}
  }

  (async function iniciar(){
    $("usuarioPill").textContent=sesion.empleadoNombre||usuario;
    fecha.value=hoyLocal();
    restaurarColaboradoresSesion();
    limpiarFormulario();
    cambiarVista("registro");
    await refrescarCatalogos();
    await recargarRegistros();
    if(navigator.onLine){
      SyncEngine.sincronizarCatalogos().then(()=>refrescarCatalogos(false)).catch(()=>{
        $("apiStatusPill").textContent="Catálogos locales";
      });
    }
  })();
})();
