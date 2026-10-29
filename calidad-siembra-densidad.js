// Calidad Siembra Campo / Seguimiento Conteo de Líneas.
// Tabla por fecha, bloque y cama. Se alimenta de siembras sincronizadas y
// registros de Rendimiento locales; los conteos se guardan localmente en meta.
(function () {
  "use strict";
  const abrir = document.getElementById("abrirSeguimientoDensidad");
  const panel = document.getElementById("seguimientoDensidadPanel");
  const fecha = document.getElementById("seguimientoDensidadFecha");
  const desde = document.getElementById("seguimientoDensidadDesde");
  const consultar = document.getElementById("consultarSeguimientoDensidad");
  const cuerpo = document.getElementById("seguimientoDensidadFilas");
  const mensaje = document.getElementById("seguimientoDensidadMensaje");
  const alternar = document.getElementById("cambiarModoPruebaLineas");
  const restaurar = document.getElementById("restaurarDatosPruebaLineas");
  const aviso = document.getElementById("avisoDatosPruebaLineas");
  if (!abrir || !panel || !fecha || !desde || !consultar || !cuerpo || !mensaje || !alternar || !restaurar || !aviso) return;

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
    const terminadas = registros.filter(r=>clasificar(r.reporte,r.aseguradas).estado==="Conforme").length;
    const inconformes = registros.filter(r=>clasificar(r.reporte,r.aseguradas).estado==="Inconforme").length;
    mensaje.textContent = (modoPrueba ? "DATOS DE PRUEBA · " : "") + registros.length + " cama(s) para " + fecha.value +
      " · " + terminadas + " conforme(s) · " + inconformes +
      " inconforme(s) · " + (registros.length-terminadas-inconformes) + " pendiente(s).";
  }
  function pintar() {
    cuerpo.innerHTML = registros.length ? registros.map((r,i) =>
      '<tr data-densidad-indice="' + i + '">' +
      '<td>' + escapar(r.bloque) + (r.esPrueba ? ' <span class="cs-tag-prueba">Prueba</span>' : '') +
      '</td><td>' + escapar(r.cama) +
       '<small style="display:block;opacity:.72">Del '+escapar(r.fechaInicio)+' al '+escapar(r.fechaFin)+
       (r.revisiones?' · '+r.revisiones+' revisión(es)':'')+'</small></td>' +
      '<td class="cs-personas">' + r.personas.map(p=>'<span>' +
        escapar(p.nombre) + (p.codigo ? ' <small>(' + escapar(p.codigo) + ')</small>' : '') +
        '</span>').join("") + '</td>' +
      '<td><input type="number" min="0" step="1" inputmode="numeric" ' +
        'data-densidad-campo="reporte" aria-label="Líneas reportadas, bloque ' +
        escapar(r.bloque) + ' cama ' + escapar(r.cama) + '" value="' + escapar(r.reporte) + '"></td>' +
      '<td><input type="number" min="0" step="1" inputmode="numeric" ' +
        'data-densidad-campo="aseguradas" aria-label="Líneas aseguradas, bloque ' +
        escapar(r.bloque) + ' cama ' + escapar(r.cama) + '" value="' + escapar(r.aseguradas) + '"></td>' +
      '<td data-densidad-diferencia>—</td><td><span data-densidad-estado class="cs-resultado cs-pendiente">Pendiente</span></td></tr>'
    ).join("") :
      '<tr><td colspan="7" class="cs-sin-registros">No hay siembras registradas para esta fecha. Puedes cambiar la fecha o registrar siembras primero.</td></tr>';
    cuerpo.querySelectorAll("[data-densidad-indice]").forEach(tr=>{
      const dato=registros[Number(tr.dataset.densidadIndice)];
      mostrarCalculo(tr,dato);
    });
    actualizarResumen();
  }
  async function fuentesLocales(dia) {
    const inicio=desde.value;
    if(!inicio||inicio>dia)throw Error("La fecha inicial debe ser anterior o igual al cierre.");
    const [siembras,rendimiento,empleados,calidad,evaluaciones,ciclos] = await Promise.all([
      OfflineDb.getAll("siembras"),OfflineDb.getAll("siembraRendimientoRegistros"),
      OfflineDb.getAll("empleados"),OfflineDb.getAll("calidadColaboradores"),
      OfflineDb.getAll("calidadEvaluaciones"),ciclosGuardados()
    ]);
    const nombres=new Map();
    [...empleados,...calidad].forEach(p=>{
      const id=String(p.codigo??p.docid??p.id??"").trim();
      if(id)nombres.set(id,etiqueta(p)||id);
    });
    const grupos=new Map();
    const abiertos=new Map();
    // Un ciclo ya cerrado no debe volver a mezclarse con una siembra nueva
    // de la misma cama. Solo se abre para edición en su propia fecha de cierre.
    for(const ciclo of ciclos){
      const [desdeC,hastaC]=fechasCiclo(ciclo);
      const k=claveCama(ciclo);
      if(!desdeC||!hastaC||desdeC>hastaC)continue;
      if(hastaC===dia&&diaEnRango(desdeC,inicio,dia)){
        let existentes=abiertos.get(k)||[];
        existentes.push(ciclo);abiertos.set(k,existentes);
        grupos.set("ciclo:"+ciclo.id,{
          ...ciclo,fecha:dia,fechaInicio:desdeC,fechaFin:hastaC,
          personas:Array.isArray(ciclo.personas)?[...ciclo.personas]:[],
          ids:new Set((ciclo.personas||[]).map(x=>String(x.codigo))),
          revisiones:0,esCiclo:true,
          reporte:String(ciclo.reporte??""),aseguradas:String(ciclo.aseguradas??"")
        });
      }
    }
    for(const r of [...siembras,...rendimiento,...evaluaciones]){
      const fechaRegistro=String(r.fecha||"").slice(0,10);
      if(!diaEnRango(fechaRegistro,inicio,dia)||r.bloque==null||r.cama==null||
         !String(r.bloque).trim()||!String(r.cama).trim())continue;
      const k=codigo(r.bloque)+"|"+codigo(r.cama);
      const covers=ciclos.filter(c=>{
        const [desdeC,hastaC]=fechasCiclo(c);
        return claveCama(c)===k&&diaEnRango(fechaRegistro,desdeC,hastaC);
      });
      if(covers.length>1)continue; // ciclos superpuestos: no atribuir automáticamente.
      const match=covers[0];
      if(match&&match.fechaFin!==dia)continue;
      const key=match?"ciclo:"+match.id:"nueva:"+k;
      let group=grupos.get(key);
      if(!group){
        group={fecha:dia,fechaInicio:fechaRegistro,fechaFin:dia,
          bloque:String(r.bloque).trim(),cama:String(r.cama).trim(),
          personas:[],ids:new Set(),revisiones:0,reporte:"",aseguradas:""};
        grupos.set(key,group);
      }
      if(!group.esCiclo&&fechaRegistro<group.fechaInicio)group.fechaInicio=fechaRegistro;
      const id=String(r.empleado??r.colaborador??r.sembrador??"").trim();
      if(id&&!group.ids.has(id)){
        group.ids.add(id);
        const nombre=String(r.empleadoNombre??r.colaboradorNombre??r.sembradorNombre??"").trim()||
          nombres.get(id)||id;
        group.personas.push({codigo:id,nombre});
      }
      if(r.revision!=null&&String(r.revision)!=="")group.revisiones++;
    }
    const filas=[...grupos.values()].map(r=>{
      delete r.ids;
      r.personas.sort((a,b)=>a.nombre.localeCompare(b.nombre,"es"));
      return r;
    });
    filas.sort((a,b)=>a.bloque.localeCompare(b.bloque,"es",{numeric:true})||
      a.cama.localeCompare(b.cama,"es",{numeric:true})||
      a.fechaInicio.localeCompare(b.fechaInicio,"es"));
    for(const r of filas){
      if(r.esCiclo)continue;
      // Solo compatibilidad con el registro anterior del mismo día,
      // nunca lo atribuimos automáticamente a otra semana.
      if(r.fechaInicio===r.fechaFin){
        const saved=await OfflineDb.getMeta(clave(r));
        if(saved){r.reporte=String(saved.reporte??"");
          r.aseguradas=String(saved.aseguradas??"");}
      }
    }
    return filas;
  }

  // Ejemplos ficticios: almacenamiento separado por fecha y sin sincronización.
  function ejemplos(dia) {
    const personas=(...ids)=>ids.map(n=>({
      codigo:"PRUEBA-L"+String(n).padStart(2,"0"),
      nombre:"COLABORADOR PRUEBA "+String(n).padStart(2,"0")
    }));
    const base=[
      {bloque:"PRUEBA-01",cama:"001",personas:personas(1,2),reporte:"20",aseguradas:"20"},
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
      return {...r,fecha:dia,fechaInicio:dia,fechaFin:dia,revisiones:0,esPrueba:true,
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
    alternar.textContent=modoPrueba?"Volver a registros reales":"Ver datos de prueba";
    alternar.setAttribute("aria-pressed",String(modoPrueba));
    alternar.classList.toggle("cs-modo-prueba",modoPrueba);
    aviso.hidden=!modoPrueba;restaurar.hidden=!modoPrueba;
    consultar.textContent=modoPrueba?"Recargar ejemplos":"Actualizar siembras";
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
    if(!dia||!desde.value||desde.value>dia){
      mensaje.textContent="Selecciona un intervalo válido: inicio anterior o igual al cierre.";return;
    }
    cargando=true;consultar.disabled=true;
    mensaje.textContent="Cargando siembras del " + dia + "…";
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
    const estado=clasificar(registro.reporte,registro.aseguradas);
    if(estado.estado==="Revisar números")return;
    // No cerrar un ciclo nuevo sin las dos mediciones.
    if(estado.estado==="Pendiente"&&!registro.esCiclo)return;
    const inicio=registro.fechaInicio,fin=fecha.value;
    if(!inicio||inicio>fin)throw Error("El inicio no puede ser posterior al cierre.");
    const anteriores=await ciclosGuardados();
    const conflicto=anteriores.find(c=>{
      if(c.id===registro.id||claveCama(c)!==claveCama(registro))return false;
      const [a,b]=fechasCiclo(c);
      return inicio<=b&&a<=fin;
    });
    if(conflicto)throw Error("Esta cama ya tiene un ciclo entre "+conflicto.fechaInicio+
      " y "+conflicto.fechaFin+". Ajusta la fecha inicial para no mezclar siembras.");
    const ciclo={
      id:registro.id||generarId(),bloque:registro.bloque,cama:registro.cama,
      fechaInicio:inicio,fechaFin:fin,fechaConteo:fin,
      personas:registro.personas,reporte:registro.reporte,aseguradas:registro.aseguradas,
      diferencia:estado.diferencia,estado:estado.estado,
      updatedAt:new Date().toISOString()
    };
    await OfflineDb.setMeta(CICLO_PREFIX+ciclo.id,ciclo);
    registro.id=ciclo.id;registro.esCiclo=true;registro.fechaInicio=inicio;
    registro.fechaFin=fin;
    mensaje.textContent="Conteo guardado para el ciclo "+inicio+" al "+fin+
      ". Sus revisiones de ambas semanas utilizarán este resultado al consultar el informe.";
    notificar();
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
  consultar.addEventListener("click",()=>void cargar({sincronizar:true}));
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
  window.CalidadSiembraDensidad={clasificar,cargar,ejemplos};
})();