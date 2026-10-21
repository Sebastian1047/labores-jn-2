// Siembra Campo / Detalles: tiempos grupales, individuales y ficha desplegable.
// Reutiliza los mismos campos y el mismo almacén de Siembra Rendimiento.
(function () {
  "use strict";
  const tabla = document.getElementById("tablaColaboradores");
  const contenedor = document.getElementById("dtFormularioGeneral");
  const botonGrupal = document.getElementById("modoTiempoGrupal");
  const botonIndividual = document.getElementById("modoTiempoIndividual");
  if (!tabla || !contenedor || !botonGrupal || !botonIndividual) return;

  const STORE = "siembraRendimientoTiempos";
  const CAMPOS = [
    ["horasLaboralesMin", "Tiempo programado"],
    ["horasExtraMin", "Horas extra"],
    ["pausasMin", "Pausas"],
    ["incapacidadMin", "Incapacidad"],
    ["cambioLaborMin", "Cambio de labor"],
    ["capacitacionMin", "Capacitación"],
    ["vacacionesMin", "Vacaciones"],
    ["examenMedicoMin", "Examen médico"],
    ["otrosMin", "Otros"],
    ["descuentoMin", "Descuento"]
  ];
  const DESCUENTOS = CAMPOS.slice(2).map(([k])=>k);
  const escapar = (s) => String(s ?? "").replace(/&/g,"&amp;")
    .replace(/</g,"&lt;").replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;").replace(/'/g,"&#39;");
  const formato = (min) => TiemposLaboresJN.formatearHoras(min);
  const estado = {
    modo:"grupal", fecha:"", editable:true, grupos:[], seleccionados:new Set(),
    guardados:new Map(), expandido:null, version:0, ocupado:false
  };

  function guardadoPara(codigo) { return estado.guardados.get(String(codigo).trim()); }
  function pendienteGrupal(codigo) { return !guardadoPara(codigo); }
  function seleccionablesGrupales() {
    return estado.grupos.filter(g=>pendienteGrupal(g.codigo)).map(g=>String(g.codigo));
  }
  function minutosGuardados(registro, campo) {
    if (!registro) return 0;
    if (campo === "otrosMin" && registro.otrosMin == null) {
      const clasificados = DESCUENTOS.filter(k => k !== "otrosMin")
        .reduce((t,k)=>t+(Number(registro[k])||0),0);
      return Math.max(0,(Number(registro.otrasLaboresMin)||0)-clasificados);
    }
    return Math.max(0,Number(registro[campo])||0);
  }
  function valoresPara(codigo) {
    const registro = guardadoPara(codigo);
    const valores = {};
    CAMPOS.forEach(([campo]) => {
      valores[campo] = registro
        ? formato(minutosGuardados(registro,campo))
        : (campo === "horasLaboralesMin" ?
            TiemposLaboresJN.horasJornada(estado.fecha) : "0");
    });
    valores.observaciones = registro?.observaciones || "";
    return valores;
  }
  function camposFormulario(valores, tipo) {
    return '<div class="dt-grid">' + CAMPOS.map(([campo,etiqueta]) =>
      '<label class="dt-campo"><span>'+escapar(etiqueta)+'</span>'+
      '<input type="text" inputmode="decimal" data-dt-campo="'+campo+'"'+
      (campo==="horasLaboralesMin" ? ' data-dt-base-min="'+
        Math.round(TiemposLaboresJN.leerHoras({value:valores[campo]})*60)+'"' : '')+
      ' value="'+escapar(valores[campo] ?? "0")+'" autocomplete="off" '+
      (campo==="horasLaboralesMin" ? 'title="Tiempo restante para la labor, sin horas extras. Se actualiza con los descuentos." ' : '')+
      (!estado.editable?'disabled':'')+'></label>'
    ).join("") +
    '<label class="dt-campo dt-obs"><span>Observaciones</span>'+
      '<textarea data-dt-observaciones rows="2" '+(!estado.editable?'disabled':'')+'>'+
        escapar(valores.observaciones||"")+'</textarea></label>' +
    '</div><div class="dt-pie-form"><span data-dt-calculo>Tiempo efectivo: —</span>'+
    '<button type="submit" class="success-btn" '+(!estado.editable?'disabled':'')+'>'+
      (tipo === "global" ? '✓ Guardar tiempos' : '✓ Guardar tiempos de esta persona')+
    '</button></div>';
  }

  function mensaje(texto, error=false) {
    for(const [id,activo] of [
      ["dtMensaje",estado.modo==="grupal"],
      ["dtMensajeIndividual",estado.modo==="individual"]
    ]){
      const target=document.getElementById(id);
      if(!target)continue;
      target.textContent=activo?texto:"";
      target.classList.toggle("dt-error",activo&&Boolean(error));
    }
  }
  function calcular(root, editado=null) {
    const inputs=[...root.querySelectorAll("[data-dt-campo]")];
    const porCampo=new Map(inputs.map(i=>[i.dataset.dtCampo,i]));
    const leidos=new Map([...porCampo].map(([k,input])=>[k,TiemposLaboresJN.leerHoras(input)]));
    const valido=[...leidos.values()].every(n=>Number.isFinite(n) && n>=0);
    const programado=porCampo.get("horasLaboralesMin");
    const descuento=DESCUENTOS.reduce((t,k)=>t+(leidos.get(k)||0),0);
    if(valido&&programado){
      if(editado===programado){
        // Si se ajusta manualmente el tiempo visible, recuperar la jornada base
        // sumando los descuentos actuales. Así sigue siendo posible corregir jornadas.
        programado.dataset.dtBaseMin=String(Math.round(
          (leidos.get("horasLaboralesMin")+descuento)*60));
      }else{
        // Nunca descontar dos veces: la jornada original se mantiene aparte.
        const baseMin=Number(programado.dataset.dtBaseMin);
        if(Number.isFinite(baseMin))
          programado.value=formato(Math.max(0,baseMin-Math.round(descuento*60)));
      }
    }
    const baseMin=Number(programado?.dataset.dtBaseMin);
    const disponible=baseMin/60+(leidos.get("horasExtraMin")||0);
    const tiempo=disponible-descuento;
    const indicador=root.querySelector("[data-dt-calculo]");
    if (indicador) {
      indicador.textContent=valido&&Number.isFinite(baseMin)&&disponible>0&&tiempo>=0
        ? "Tiempo efectivo: "+formato(Math.round(tiempo*60))+" h"
        : "Revisa los tiempos: las actividades no deben superar el disponible.";
    }
  }
  function leerDatos(root) {
    const inputs=[...root.querySelectorAll("[data-dt-campo]")];
    const error=TiemposLaboresJN.validar(inputs);
    if(error)throw Error(error);
    const data={};
    for(const input of inputs){
      const n=TiemposLaboresJN.leerHoras(input);
      if(!Number.isFinite(n)||n<0)throw Error("Los tiempos deben ser números no negativos.");
      data[input.dataset.dtCampo]=Math.round(n*60);
    }
    // En pantalla se ve el tiempo tras descuentos; persistimos la jornada base
    // para que al editar o calcular rendimientos los descuentos se resten solo una vez.
    const campoProgramado=root.querySelector('[data-dt-campo="horasLaboralesMin"]');
    data.horasLaboralesMin=Number(campoProgramado?.dataset.dtBaseMin);
    if(!Number.isFinite(data.horasLaboralesMin)||data.horasLaboralesMin<0)
      throw Error("Revisa el tiempo programado.");
    const disponible=data.horasLaboralesMin+data.horasExtraMin;
    const otras=DESCUENTOS.reduce((acc,k)=>acc+data[k],0);
    if(!disponible)throw Error("Ingresa un tiempo programado o horas extra mayor que cero.");
    if(otras>disponible)throw Error("Las actividades descontadas superan el tiempo disponible.");
    data.tiempoDisponibleMin=disponible;
    data.otrasLaboresMin=otras;
    data.tiempoRealMin=disponible-otras;
    data.observaciones=root.querySelector("[data-dt-observaciones]").value.trim();
    return data;
  }

  function actualizarBotonGrupal(){
    // Una asignación grupal requiere al menos dos pendientes seleccionados.
    const activos=estado.grupos.filter(g=>estado.seleccionados.has(String(g.codigo))&&pendienteGrupal(g.codigo));
    const elegibles=seleccionablesGrupales();
    botonGrupal.disabled=!estado.editable||elegibles.length<2||
      (estado.modo==="grupal"&&activos.length<2);
    botonGrupal.title=botonGrupal.disabled
      ?"Tiempo grupal requiere al menos dos colaboradores pendientes seleccionados. Usa Tiempo individual."
      :"Asignar el mismo tiempo a dos o más colaboradores pendientes.";
  }
  function modo(tipo){
    if(!["grupal","individual"].includes(tipo))return;
    if(tipo==="grupal"&&seleccionablesGrupales().length<2)return;
    estado.modo=tipo;
    estado.expandido=null;
    estado.seleccionados=new Set(tipo==="grupal"?seleccionablesGrupales():[]);
    document.getElementById("tiemposSiembraCampo").hidden=tipo==="individual";
    mensaje("");
    botonGrupal.classList.toggle("active",tipo==="grupal");
    botonIndividual.classList.toggle("active",tipo==="individual");
    botonGrupal.setAttribute("aria-pressed",String(tipo==="grupal"));
    botonIndividual.setAttribute("aria-pressed",String(tipo==="individual"));
    document.getElementById("instruccionesSeleccionTiempo").textContent=tipo==="grupal"
      ? "Tiempo grupal: solo se seleccionan los colaboradores pendientes. Los que tienen tiempos guardados no pueden seleccionarse en este modo."
      : "Tiempo individual: selecciona una persona o pulsa su nombre para desplegar su formulario debajo. Las demás se atenúan únicamente después de seleccionar una persona.";
    document.getElementById("dtModoActual").textContent=tipo==="grupal"?"grupales":"individuales";
    pintarTabla();
    pintarResumen();
  }

  function pintarResumen(){
    const disponibles=estado.grupos.filter(g=>estado.seleccionados.has(String(g.codigo)) && (estado.modo!=="grupal"||!guardadoPara(g.codigo)));
    document.getElementById("dtSeleccionResumen").textContent=!estado.editable
      ? "Selecciona un único día en Fecha inicial y Fecha final para registrar tiempos."
      : (estado.modo==="grupal"
        ? (disponibles.length<2
          ? "Tiempo grupal requiere al menos dos colaboradores pendientes seleccionados. Cambia a Tiempo individual."
          : disponibles.length+" de "+estado.grupos.length+" colaboradores seleccionados para asignar el mismo tiempo.")
        : (disponibles.length ? "Tiempo particular de "+disponibles[0].colaborador : "Selecciona una sola persona para registrar su tiempo."));
    const boton=contenedor.querySelector('button[type="submit"]');
    if(boton)boton.disabled=!estado.editable||estado.ocupado||
      (estado.modo==="grupal"?disponibles.length<2:!disponibles.length);
    actualizarBotonGrupal();
  }

  function pintarTabla(){
    if(!estado.grupos.length){
      tabla.innerHTML='<tr><td colspan="5" class="dt-vacio">No hay colaboradores con esquejes mayores que cero para estas fechas. Registra siembras primero.</td></tr>';
      return;
    }
    const resultado=[];
    for(const g of estado.grupos){
      const id=String(g.codigo),guardado=guardadoPara(id);
      const bloqueado=estado.modo==="grupal"&&Boolean(guardado);
      const checked=estado.seleccionados.has(id)&&!bloqueado;
      const expandido=estado.expandido===id &&
        (estado.modo!=="individual"||checked);
      const atenuado=estado.modo==="individual"&&estado.seleccionados.size>0&&!checked;
      resultado.push('<tr class="dt-fila'+(atenuado?' dt-atenuado':'')+'">'+
        '<td><input type="checkbox" data-dt-persona="'+escapar(id)+'" aria-label="Seleccionar '+escapar(g.colaborador)+
          '" '+(checked?'checked ':'')+(!estado.editable||bloqueado?'disabled ':'')+(bloqueado?'title="Ya tiene tiempos guardados. Para modificar utiliza Tiempo individual." ':'')+'></td>'+
        '<td><button type="button" class="dt-abrir" data-dt-abrir="'+escapar(id)+'" aria-expanded="'+expandido+'" '+(bloqueado?'disabled title="Para modificar, selecciona Tiempo individual"':'')+'>'+
          '<span class="dt-identidad"><span class="dt-nombre">'+escapar(g.colaborador)+'</span>'+
          '<span class="dt-estado-tiempo '+(guardado?'dt-guardado':'dt-pendiente')+'">'+
          (guardado?'Guardado':'Pendiente')+'</span></span><small>'+escapar(id)+
          '</small><span class="dt-chevron">'+(expandido?'▴ Ocultar tiempos':'▾ Ver tiempos')+'</span></button></td>'+
        '<td>'+Number(g.esquejes).toLocaleString("es-CO")+'</td>'+
        '<td>'+((Number(g.horas)||0)>0?g.horas.toFixed(2)+' h':'—')+'</td>'+
        '<td>'+((Number(g.horas)||0)>0?(g.esquejes/g.horas).toFixed(2):'—')+'</td></tr>');
      if(expandido){
        resultado.push('<tr class="dt-desplegado"><td colspan="5"><div class="dt-detalle-persona">'+
          '<strong>Tiempos de '+escapar(g.colaborador)+'</strong>'+
          '<p class="hint">'+(guardado?'Edita los tiempos existentes si necesitas corregirlos.':'Aún no hay tiempos guardados para esta persona.')+'</p>'+
          '<form class="dt-form-inline" data-dt-form-persona="'+escapar(id)+'">'+
          camposFormulario(valoresPara(id),"individual")+'</form></div></td></tr>');
      }
    }
    tabla.innerHTML=resultado.join("");
    tabla.querySelectorAll(".dt-form-inline").forEach(calcular);
  }

  async function guardarPara(personas, root, origen) {
    if(estado.ocupado)return;
    if(!estado.editable)throw Error("Los tiempos solo se pueden registrar para un día.");
    if(!personas.length)throw Error("Selecciona al menos un colaborador.");
    if(origen==="grupal"&&personas.length<2)
      throw Error("Para una sola persona, utiliza Tiempo individual.");
    if(origen==="grupal"&&personas.some(g=>!pendienteGrupal(g.codigo)))
      throw Error("El tiempo grupal solo puede aplicarse a colaboradores pendientes.");
    const datos=leerDatos(root);
    const sincronizados=personas.filter(g=>guardadoPara(g.codigo)?.syncStatus==="Sincronizado");
    if(sincronizados.length)throw Error("Hay tiempos sincronizados que no se pueden sobrescribir.");
    const existentes=personas.filter(g=>guardadoPara(g.codigo));
    if(existentes.length && !window.confirm("Se actualizarán los tiempos existentes de "+
      existentes.length+" colaborador(es). ¿Deseas continuar?"))return;
    estado.ocupado=true;pintarResumen();
    try{
      const ahora=new Date().toISOString();
      const usuario=JSON.parse(sessionStorage.getItem("labores_usuario")||"null")?.username||"";
      for(const persona of personas){
        const anterior=guardadoPara(persona.codigo);
        const prueba=/^PRUEBA/i.test(String(persona.codigo))||
          TiemposLaboresJN.esColaboradorPrueba(persona.codigo);
        const fila={
          ...(anterior||{}),...datos,
          id:anterior?.id||SyncEngine.generarUUID(),
          fecha:estado.fecha,
          colaborador:String(persona.codigo),
          colaboradorNombre:persona.colaborador,
          syncStatus:prueba?"PruebaLocal":"SoloLocal",
          esPrueba:prueba,usuario,
          modalidadRegistro:origen,
          createdAt:anterior?.createdAt||ahora,updatedAt:ahora
        };
        delete fila.pMadresMin;delete fila.pAbuelasMin;
        await OfflineDb.put(STORE,fila);
        estado.guardados.set(String(persona.codigo),fila);
        if(origen==="grupal")estado.seleccionados.delete(String(persona.codigo));
      }
      mensaje("Tiempos "+(existentes.length?"actualizados":"guardados")+" para "+
        personas.length+" colaborador(es). Pulsa cualquier nombre para consultar o modificar sus tiempos.");
      pintarTabla();
      await window.SiembraDetalleRecargar?.();
    }finally{estado.ocupado=false;pintarResumen();}
  }

  botonGrupal.addEventListener("click",()=>modo("grupal"));
  botonIndividual.addEventListener("click",()=>modo("individual"));
  tabla.addEventListener("change",(event)=>{
    const input=event.target.closest("[data-dt-persona]");
    if(!input||!estado.editable)return;
    if(estado.modo==="grupal"&&guardadoPara(input.dataset.dtPersona)){
      input.checked=false;return;
    }
    const id=input.dataset.dtPersona;
    if(estado.modo==="individual"){
      estado.seleccionados.clear();
      estado.expandido=input.checked?id:null;
      if(input.checked)estado.seleccionados.add(id);
    }else{
      if(input.checked)estado.seleccionados.add(id);
      else estado.seleccionados.delete(id);
    }
    if(estado.modo==="grupal"){
      const pendientes=estado.grupos.filter(g=>estado.seleccionados.has(String(g.codigo))&&pendienteGrupal(g.codigo));
      if(pendientes.length===1){
        // Al quedar solo una persona, preparar directamente su ficha individual.
        const unica=String(pendientes[0].codigo);
        modo("individual");
        estado.seleccionados=new Set([unica]);
        estado.expandido=unica;
      }
    }
    pintarTabla();
    pintarResumen();
  });
  tabla.addEventListener("click",(event)=>{
    const btn=event.target.closest("[data-dt-abrir]");
    if(!btn)return;
    const id=btn.dataset.dtAbrir;
    if(estado.modo==="grupal"&&guardadoPara(id))return;
    if(estado.modo==="individual"){
      const abrir=estado.expandido!==id;
      estado.seleccionados=new Set(abrir?[id]:[]);
      estado.expandido=abrir?id:null;
      pintarResumen();
    }else{
      estado.expandido=estado.expandido===id?null:id;
    }
    pintarTabla();
  });
  tabla.addEventListener("input",(event)=>{
    const form=event.target.closest(".dt-form-inline");
    if(form)calcular(form,event.target);
  });
  tabla.addEventListener("submit",async(event)=>{
    const form=event.target.closest("[data-dt-form-persona]");
    if(!form)return;
    event.preventDefault();
    const persona=estado.grupos.find(g=>String(g.codigo)===form.dataset.dtFormPersona);
    if(!persona)return;
    try{await guardarPara([persona],form,"individual");}
    catch(error){mensaje(error.message,true);}
  });
  contenedor.addEventListener("submit",async(event)=>{
    const form=event.target.closest("#dtFormGeneral");
    if(!form)return;
    event.preventDefault();
    const personas=estado.grupos.filter(g=>estado.seleccionados.has(String(g.codigo)) && (estado.modo!=="grupal"||pendienteGrupal(g.codigo)));
    try{await guardarPara(personas,form,estado.modo);}
    catch(error){mensaje(error.message,true);}
  });
  contenedor.addEventListener("input",(event)=>{
    const form=event.target.closest("#dtFormGeneral");
    if(form)calcular(form,event.target);
  });

  window.SiembraDetalleTiempos={
    async render(grupos,{editable,fecha}){
      const cambioFecha=fecha!==estado.fecha;
      estado.fecha=fecha;estado.editable=Boolean(editable);
      estado.grupos=grupos.filter(g=>Number(g.esquejes)>0&&g.codigo);
      if(cambioFecha){
        estado.expandido=null;
        estado.guardados=new Map(); // Evitar estados de la fecha anterior durante la carga.
        estado.seleccionados=new Set(estado.modo==="grupal"?
          seleccionablesGrupales():[]);
        mensaje("");
      }else{
        const ids=new Set(estado.grupos.map(g=>String(g.codigo)));
        for(const id of estado.seleccionados)if(!ids.has(id))estado.seleccionados.delete(id);
        if(estado.expandido&&!ids.has(estado.expandido))estado.expandido=null;
        if(estado.modo==="grupal"){
          for(const id of estado.seleccionados)if(guardadoPara(id))estado.seleccionados.delete(id);
        }
      }
      const version=++estado.version;
      try{
        const guardados=(await OfflineDb.getAll(STORE)).filter(r=>r.fecha===fecha&&r.colaborador);
        if(version!==estado.version)return;
        const porPersona=new Map();
        guardados.forEach(r=>{
          const id=String(r.colaborador);
          const previo=porPersona.get(id);
          if(!previo||String(r.updatedAt||r.createdAt||"")>=String(previo.updatedAt||previo.createdAt||""))
            porPersona.set(id,r);
        });
        estado.guardados=porPersona;
        if(estado.modo==="grupal"){
          if(cambioFecha)estado.seleccionados=new Set(seleccionablesGrupales());
          for(const id of estado.seleccionados)if(porPersona.has(id))estado.seleccionados.delete(id);
        }
      }catch(error){mensaje("No se pudieron recuperar los tiempos: "+error.message,true);}
      if(version!==estado.version)return;
      if(estado.modo==="grupal"&&seleccionablesGrupales().length<2){
        // Si inicialmente solo hay un pendiente, no permitir modalidad grupal.
        estado.modo="individual";
        estado.expandido=null;
        estado.seleccionados=new Set();
        document.getElementById("tiemposSiembraCampo").hidden=true;
        botonGrupal.classList.remove("active");
        botonIndividual.classList.add("active");
        botonGrupal.setAttribute("aria-pressed","false");
        botonIndividual.setAttribute("aria-pressed","true");
        document.getElementById("dtModoActual").textContent="individuales";
        document.getElementById("instruccionesSeleccionTiempo").textContent=
          "Tiempo individual: selecciona una persona pendiente o guardada para registrar o modificar sus tiempos.";
      }
      pintarTabla();
      if(!contenedor.children.length||cambioFecha){
        const valores=valoresPara(null);
        contenedor.innerHTML='<form id="dtFormGeneral">'+camposFormulario(valores,"global")+'</form>';
        calcular(contenedor.querySelector("#dtFormGeneral"));
      }
      pintarResumen();
    },
    getState(){return estado;}
  };
})();
