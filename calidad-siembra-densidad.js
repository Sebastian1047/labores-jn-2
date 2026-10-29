// Calidad Siembra Campo / Seguimiento Conteo de Líneas.
// Tabla por fecha, bloque y cama. Se alimenta de siembras sincronizadas y
// registros de Rendimiento locales; los conteos se guardan localmente en meta.
(function () {
  "use strict";
  const abrir = document.getElementById("abrirSeguimientoDensidad");
  const panel = document.getElementById("seguimientoDensidadPanel");
  const fecha = document.getElementById("seguimientoDensidadFecha");
  const desde = document.getElementById("seguimientoDensidadDesde");
  const vista = document.getElementById("seguimientoDensidadVista");
  const consultar = document.getElementById("consultarSeguimientoDensidad");
  const cuerpo = document.getElementById("seguimientoDensidadFilas");
  const mensaje = document.getElementById("seguimientoDensidadMensaje");
  const alternar = document.getElementById("cambiarModoPruebaLineas");
  const restaurar = document.getElementById("restaurarDatosPruebaLineas");
  const aviso = document.getElementById("avisoDatosPruebaLineas");
  if (!abrir || !panel || !fecha || !desde || !vista || !consultar || !cuerpo || !mensaje || !alternar || !restaurar || !aviso) return;

  const STORE_PREFIX = "calidadSiembraDensidad:v1:";
  const CICLO_PREFIX = "calidadSiembraConteoCiclo:v2:";
  const CHANNEL = "labores-jn-conteo-lineas";
  const DEMO_PREFIX = "calidadSiembraConteoLineas:datosDePrueba:v1:";
  let modoPrueba = new URLSearchParams(window.location.search).get("pruebas") === "1";
  let registros = [];
  let carga = 0;
  let cargando = false;

  const escapar = texto => String(texto ?? "").replace(/&/g, "&amp;")
    .replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  const codigo = texto => {
    const valor = String(texto ?? "").trim().toUpperCase();
    return /^\d+$/.test(valor) ? String(Number(valor)) : valor;
  };
  const etiqueta = persona => String(persona.nombre ?? persona.empleadoNombre ??
    persona.colaboradorNombre ?? persona.codigo ?? persona.empleado ?? persona.colaborador ?? "").trim();
  const hoy = () => SyncEngine.fechaLocalISO();
  const clave = registro => STORE_PREFIX + registro.fecha + "|" +
    codigo(registro.bloque) + "|" + codigo(registro.cama);
  const claveCama = registro => codigo(registro.bloque)+"|"+codigo(registro.cama);
  const diaEnRango = (dia,inicio,fin) => dia>=inicio&&dia<=fin;
  const fechasCiclo = c=>[String(c.fechaInicio||c.fecha||"").slice(0,10),
    String(c.fechaFin||c.fecha||"").slice(0,10)];
  const generarId = ()=>"ciclo-"+Date.now().toString(36)+"-"+Math.random().toString(36).slice(2,10);
  const notificar = () => {
    try{const channel=new BroadcastChannel(CHANNEL);channel.postMessage({tipo:"conteo-actualizado"});channel.close();}
    catch(error){console.warn("No se pudo notificar el cambio a otras pestañas",error);}
  };
  async function ciclosGuardados(){
    const metas=await OfflineDb.getAll("meta");
    return metas.filter(x=>String(x.key||"").startsWith(CICLO_PREFIX)&&x.value)
      .map(x=>x.value);
  }


  function clasificar(reporte, aseguradas) {
    if (reporte === "" || aseguradas === "") return { diferencia:null, estado:"Pendiente" };
    if (!/^\d+$/.test(reporte) || !/^\d+$/.test(aseguradas) ||
        !Number.isSafeInteger(Number(reporte)) || !Number.isSafeInteger(Number(aseguradas))) {
      return { diferencia:null, estado:"Revisar números" };
    }
    const diferencia = Number(aseguradas) - Number(reporte);
    return { diferencia, estado:Math.abs(diferencia) >= 3 ? "Inconforme" : "Conforme" };
  }
  function mostrarCalculo(tr, valores) {
    const calculo = clasificar(valores.reporte, valores.aseguradas);
    const diferencia = tr.querySelector("[data-densidad-diferencia]");
    const estado = tr.querySelector("[data-densidad-estado]");
    if (diferencia) diferencia.textContent = calculo.diferencia === null ? "—" :
      (calculo.diferencia > 0 ? "+" : "") + calculo.diferencia;
    if (estado) {
      estado.textContent = calculo.estado;
      estado.className = "cs-resultado " + (calculo.estado === "Conforme" ? "cs-conforme" :
        calculo.estado === "Inconforme" ? "cs-inconforme" : "cs-pendiente");
    }
    return calculo;
  }
  function actualizarResumen() {
    const conformes = registros.filter(r=>clasificar(r.reporte,r.aseguradas).estado==="Conforme").length;
    const inconformes = registros.filter(r=>clasificar(r.reporte,r.aseguradas).estado==="Inconforme").length;
    const prefix = modoPrueba ? "DATOS DE PRUEBA · " : "";
    mensaje.textContent = vista.value==="pendientes"
      ? prefix + registros.length + " cama(s) pendiente(s). Las camas de semanas anteriores permanecen aquí hasta finalizar el conteo."
      : prefix + registros.length + " cama(s) terminada(s) · "+ conformes +
        " conforme(s) · "+ inconformes + " inconforme(s). Historial conservado por ciclo.";
  }
  function pintar() {
    cuerpo.innerHTML = registros.length ? registros.map((r,i) =>
      '<tr data-densidad-indice="' + i + '">' +
      '<td>' + escapar(r.bloque) + (r.esPrueba ? ' <span class="cs-tag-prueba">Prueba</span>' : '') +
      '</td><td>' + escapar(r.cama) +
       '<small style="display:block;opacity:.72">Inicio: '+escapar(r.fechaInicio)+
       ' · '+(r.fechaFin?'Cierre: '+escapar(r.fechaFin):'Aún en siembra')+'</small>'+
       (r.detalles?.length?'<details style="margin-top:5px;text-align:left"><summary>'+
       r.detalles.length+' revisiones · ver fechas y semanas</summary>'+
       '<div style="max-height:155px;overflow:auto;line-height:1.55;font-size:.77rem">'+
       r.detalles.map(x=>escapar(x.fecha)+' · S'+escapar(x.semana)+
         ' · Rev. '+escapar(x.revision)+' · '+escapar(x.colaborador)).join('<hr style="margin:2px 0;border:0;border-top:1px solid #ddd">')+
       '</div></details>':'')+'</td>' +
      '<td class="cs-personas">' + r.personas.map(p=>'<span>' +
        escapar(p.nombre) + (p.codigo ? ' <small>(' + escapar(p.codigo) + ')</small>' : '') +
        '</span>').join("") + '</td>' +
      '<td><input type="number" min="0" step="1" inputmode="numeric" ' +
        (r.estado && r.estado!=="Pendiente" ? ' disabled title="Seguimiento terminado" ' : '') +
        'data-densidad-campo="reporte" aria-label="Líneas reportadas, bloque ' +
        escapar(r.bloque) + ' cama ' + escapar(r.cama) + '" value="' + escapar(r.reporte) + '"></td>' +
      '<td><input type="number" min="0" step="1" inputmode="numeric" ' +
        (r.estado && r.estado!=="Pendiente" ? ' disabled title="Seguimiento terminado" ' : '') +
        'data-densidad-campo="aseguradas" aria-label="Líneas aseguradas, bloque ' +
        escapar(r.bloque) + ' cama ' + escapar(r.cama) + '" value="' + escapar(r.aseguradas) + '"></td>' +
      '<td data-densidad-diferencia>—</td><td><span data-densidad-estado class="cs-resultado cs-pendiente">Pendiente</span></td></tr>'
    ).join("") :
      '<tr><td colspan="7" class="cs-sin-registros">' +
      (vista.value==="pendientes" ? "No hay camas pendientes. Al guardar una revisión de Siembra Campo se creará o actualizará el seguimiento." :
        "No hay camas terminadas en el período seleccionado. Las pendientes siguen disponibles en la otra vista.") +
      '</td></tr>';
    cuerpo.querySelectorAll("[data-densidad-indice]").forEach(tr=>{
      const dato=registros[Number(tr.dataset.densidadIndice)];
      mostrarCalculo(tr,dato);
    });
    actualizarResumen();
  }
  async function fuentesLocales(dia) {
    const [ciclos,empleados,calidad] = await Promise.all([
      ciclosGuardados(),OfflineDb.getAll("empleados"),OfflineDb.getAll("calidadColaboradores")
    ]);
    const nombres=new Map();
    [...empleados,...calidad].forEach(p=>{
      const id=String(p.codigo??p.docid??p.id??"").trim();
      if(id)nombres.set(id,etiqueta(p)||id);
    });
    // Los pendientes pasan de semana sin límite de fecha. Los terminados
    // únicamente aparecen en su historial y nunca se duplican en Pendientes.
    const inicio=desde.value,fin=dia;
    const visibles=ciclos.filter(c=>c.id&&c.bloque!=null&&c.cama!=null&&
      (vista.value==="pendientes"
        ? c.estado==="Pendiente"&&!c.fechaFin
        : (c.estado==="Conforme"||c.estado==="Inconforme")&&
          c.fechaFin>=inicio&&c.fechaFin<=fin));
    const filas=visibles.map(c=>{
      const detalles=(Array.isArray(c.revisiones)?c.revisiones:[]).map(x=>({
        correlationId:x.correlationId,fecha:String(x.fecha||"").slice(0,10),
        semana:x.semana,anio:x.anio,revision:x.revision,
        colaborador:String(x.colaborador??"")
      })).sort((a,b)=>a.fecha.localeCompare(b.fecha)||
        Number(a.revision)-Number(b.revision));
      const personas=[...new Set(detalles.map(x=>x.colaborador).filter(Boolean))]
        .map(codigo=>({codigo,nombre:nombres.get(codigo)||codigo}));
      // Compatibilidad con seguimientos cerrados de la versión anterior.
      if(!personas.length&&Array.isArray(c.personas))
        personas.push(...c.personas);
      return {...c,fecha:fin,personas,detalles,
        revisiones:detalles.length,esCiclo:true,
        fechaInicio:c.fechaInicio||detalles[0]?.fecha||"",
        fechaFin:c.fechaFin||"",
        reporte:String(c.reporte??""),aseguradas:String(c.aseguradas??"")};
    });
    filas.sort((a,b)=>a.bloque.localeCompare(b.bloque,"es",{numeric:true})||
      a.cama.localeCompare(b.cama,"es",{numeric:true})||
      a.fechaInicio.localeCompare(b.fechaInicio));
    return filas;
  }

  // Ejemplos ficticios: almacenamiento separado por fecha y sin sincronización.
  function ejemplos(dia) {
    const personas=(...ids)=>ids.map(n=>({
      codigo:"PRUEBA-L"+String(n).padStart(2,"0"),
      nombre:"COLABORADOR PRUEBA "+String(n).padStart(2,"0")
    }));
    const ejemploSemanaCruzada=[
      {fecha:"2026-10-23",semana:43,revision:1,colaborador:"PRUEBA-L01"},
      {fecha:"2026-10-23",semana:43,revision:2,colaborador:"PRUEBA-L01"},
      {fecha:"2026-10-26",semana:44,revision:1,colaborador:"PRUEBA-L01"},
      {fecha:"2026-10-26",semana:44,revision:2,colaborador:"PRUEBA-L02"},
      {fecha:"2026-10-26",semana:44,revision:3,colaborador:"PRUEBA-L02"}
    ];
    const base=[
      {bloque:"PRUEBA-01",cama:"001",personas:personas(1,2),
       fechaInicio:"2026-10-23",fechaFin:"",detalles:ejemploSemanaCruzada,
       reporte:"20",aseguradas:""},
      {bloque:"PRUEBA-01",cama:"002",personas:personas(3),reporte:"18",aseguradas:"20"},
      {bloque:"PRUEBA-02",cama:"003",personas:personas(4,5),reporte:"16",aseguradas:"13"},
      {bloque:"PRUEBA-02",cama:"004",personas:personas(6),reporte:"10",aseguradas:"14"},
      {bloque:"PRUEBA-03",cama:"005",personas:personas(7,8),reporte:"12",aseguradas:"11"},
      {bloque:"PRUEBA-03",cama:"006",personas:personas(9),reporte:"15",aseguradas:""},
      {bloque:"PRUEBA-04",cama:"007",personas:personas(10,11),reporte:"7",aseguradas:"10"}
    ];
    let guardados={};
    try {
      const valor=JSON.parse(localStorage.getItem(DEMO_PREFIX+dia)||"{}");
      if (valor && typeof valor==="object" && !Array.isArray(valor)) guardados=valor;
    } catch(e) { console.warn("Datos de prueba no disponibles",e); }
    return base.map(r=>{
      const cambio=guardados[r.bloque+"|"+r.cama]||{};
      return {...r,fecha:dia,fechaInicio:r.fechaInicio||dia,
        fechaFin:r.fechaFin??dia,revisiones:r.detalles?.length??0,esPrueba:true,
        reporte:String(cambio.reporte??r.reporte),
        aseguradas:String(cambio.aseguradas??r.aseguradas)};
    });
  }
  function guardarCambiosPrueba(dia) {
    const datos={};
    registros.filter(r=>r.esPrueba && r.fecha===dia).forEach(r=>{
      datos[r.bloque+"|"+r.cama]={reporte:r.reporte,aseguradas:r.aseguradas};
    });
    localStorage.setItem(DEMO_PREFIX+dia,JSON.stringify(datos));
  }
  function actualizarModo() {
    document.querySelectorAll("[data-densidad-solo-terminadas]").forEach(label=>{
      label.hidden=vista.value!=="terminadas";
    });
    alternar.textContent=modoPrueba?"Volver a registros reales":"Ver datos de prueba";
    alternar.setAttribute("aria-pressed",String(modoPrueba));
    alternar.classList.toggle("cs-modo-prueba",modoPrueba);
    aviso.hidden=!modoPrueba;restaurar.hidden=!modoPrueba;
    consultar.textContent=modoPrueba?"Recargar ejemplos":"Actualizar seguimiento";
  }
  function alternarModo(valor) {
    modoPrueba=Boolean(valor);
    const url=new URL(window.location.href);
    if(modoPrueba)url.searchParams.set("pruebas","1");
    else url.searchParams.delete("pruebas");
    window.history.replaceState(null,"",url);
    panel.hidden=false;abrir.classList.add("active");
    abrir.setAttribute("aria-expanded","true");
    actualizarModo();void cargar();
  }

  async function cargar({sincronizar=false}={}) {
    const solicitud=++carga,dia=fecha.value;
    if(vista.value==="terminadas"&&(!dia||!desde.value||desde.value>dia)){
      mensaje.textContent="Selecciona un intervalo válido para el historial de terminadas.";return;
    }
    cargando=true;consultar.disabled=true;
    mensaje.textContent="Consultando seguimientos pendientes y terminados…";
    try {
      registros=modoPrueba?ejemplos(dia):await fuentesLocales(dia);
      if (solicitud!==carga)return;
      pintar();
      if (sincronizar && !modoPrueba) {
        try {
          await SyncEngine.sincronizarSiembrasDesdeServidor({fechaInicio:dia,fechaFinal:dia});
          if (solicitud!==carga)return;
          registros=await fuentesLocales(dia);
          if (solicitud!==carga)return;
          pintar();
        } catch (e) {
          if (solicitud===carga)
            mensaje.textContent+=" No se pudo actualizar desde el servidor; se muestran los registros locales.";
        }
      }
    }catch(error){
      if(solicitud===carga)mensaje.textContent="No fue posible consultar las siembras: "+error.message;
    }finally{
      if(solicitud===carga){cargando=false;consultar.disabled=false;}
    }
  }
  async function guardarFila(registro) {
    if(registro.esPrueba){guardarCambiosPrueba(registro.fecha);return;}
    const resultado=clasificar(registro.reporte,registro.aseguradas);
    if(resultado.estado==="Revisar números")
      throw new Error("Verifica los números digitados.");
    if(!registro.id)throw new Error("Esta cama no tiene un ciclo identificado. No se pueden afectar revisiones sin una vinculación segura.");
    if(registro.estado!=="Pendiente"||registro.fechaFin)
      throw new Error("Esta cama ya está cerrada. Consulta su resultado en el historial.");
    if(resultado.estado==="Pendiente"){
      // Un avance parcial se conserva incluso si se continúa la siguiente semana.
      await OfflineDb.guardarConteoPendiente(registro.id,{
        reporte:registro.reporte,aseguradas:registro.aseguradas
      });
      return;
    }
    const cerrado=await OfflineDb.cerrarCalidadCiclo(registro.id,{
      reporte:registro.reporte,aseguradas:registro.aseguradas,
      fechaConteo:SyncEngine.fechaLocalISO()
    });
    registro.estado=cerrado.estado;
    registro.fechaFin=cerrado.fechaFin;
    registro.diferencia=cerrado.diferencia;
    mensaje.textContent="Conteo "+cerrado.estado.toLowerCase()+" guardado. Se actualizaron "+
      (cerrado.revisiones||[]).length+" revisiones vinculadas de sus respectivas semanas. La cama pasó al historial.";
    notificar();
    void cargar();
  }
  cuerpo.addEventListener("input",event=>{
    const input=event.target.closest("[data-densidad-campo]");
    if(!input)return;
    const tr=input.closest("[data-densidad-indice]");
    const r=registros[Number(tr?.dataset.densidadIndice)];
    if(!r)return;
    r[input.dataset.densidadCampo]=input.value.trim();
    mostrarCalculo(tr,r);
    actualizarResumen();
  });
  cuerpo.addEventListener("change",async event=>{
    const input=event.target.closest("[data-densidad-campo]");
    if(!input)return;
    const tr=input.closest("[data-densidad-indice]");
    const r=registros[Number(tr?.dataset.densidadIndice)];
    if(!r)return;
    try {await guardarFila(r);}
    catch(e){mensaje.textContent="No se pudo guardar la medición local: "+e.message;}
  });
  abrir.addEventListener("click",()=>{
    const visible=panel.hidden;
    panel.hidden=!visible;
    abrir.classList.toggle("active",visible);
    abrir.setAttribute("aria-expanded",String(visible));
    if(visible)void cargar();
  });
  consultar.addEventListener("click",()=>void cargar());
  vista.addEventListener("change",()=>{actualizarModo();void cargar();});
  alternar.addEventListener("click",()=>alternarModo(!modoPrueba));
  restaurar.addEventListener("click",()=>{
    try{localStorage.removeItem(DEMO_PREFIX+fecha.value);}
    catch(e){mensaje.textContent="No se pudieron restablecer los ejemplos: "+e.message;return;}
    void cargar();
  });
  fecha.addEventListener("change",()=>{
    if(desde.value>fecha.value)desde.value=fecha.value;
    void cargar();
  });
  desde.addEventListener("change",()=>void cargar());
  fecha.value=hoy();
  const inicial=new Date(fecha.value+"T12:00:00Z");
  inicial.setUTCDate(inicial.getUTCDate()-7);
  desde.value=inicial.toISOString().slice(0,10);
  actualizarModo();
  if(modoPrueba){
    panel.hidden=false;abrir.classList.add("active");
    abrir.setAttribute("aria-expanded","true");void cargar();
  }
  async function actualizarSiAbierto(){
    if(!panel.hidden&&!modoPrueba)await cargar();
  }
  window.CalidadSiembraDensidad={clasificar,cargar,ejemplos,actualizarSiAbierto};
})();