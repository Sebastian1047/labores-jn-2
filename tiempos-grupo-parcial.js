// Edición grupal selectiva para tiempos de Siembra Campo y Desbotonado y Mallas.
(function(){
  "use strict";
  const campos=[
    ["horasLaboralesMin","Tiempo programado"],["horasExtraMin","Horas extra"],
    ["pausasMin","Pausas"],["incapacidadMin","Incapacidad"],
    ["cambioLaborMin","Cambio de labor"],["capacitacionMin","Capacitación"],
    ["vacacionesMin","Vacaciones"],["examenMedicoMin","Examen médico"],
    ["otrosMin","Otros"],["descuentoMin","Descuento"],["observaciones","Observaciones"]
  ];
  const descuentos=campos.slice(2,10).map(([k])=>k);
  const esc=s=>String(s??"").replace(/&/g,"&amp;").replace(/</g,"&lt;")
    .replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
  function formulario(){
    return '<form id="dtFormGrupoGuardados"><p class="dt-parcial-ayuda">'+
      'Marca solo los campos que deseas cambiar. El nuevo valor se aplicará a todos los seleccionados; el resto se conservará para cada persona.</p>'+
      '<div class="dt-grid dt-parcial-grid">'+campos.map(([k,n])=>
        '<label class="dt-campo dt-parcial-campo"><span class="dt-parcial-nombre">'+
        '<input type="checkbox" data-dt-grupo-habilitar="'+k+'" aria-label="Modificar '+esc(n)+'"> '+esc(n)+'</span>'+
        (k==="observaciones"
          ?'<textarea data-dt-grupo-valor="'+k+'" rows="2" disabled placeholder="Observaciones comunes"></textarea>'
          :'<input type="text" inputmode="decimal" data-dt-grupo-valor="'+k+'" disabled autocomplete="off" placeholder="Horas decimales, ej. 0,5">')+
        '</label>').join("")+'</div>'+
      '<p class="dt-parcial-ayuda">Tiempo programado se interpreta como el total visible, incluidas horas extra y descuentos. Los totales se recalculan por persona.</p>'+
      '<div class="dt-pie-form"><span class="hint">Solo se sobrescriben los campos marcados.</span>'+
      '<button type="submit" class="success-btn">Aplicar cambios al grupo</button></div></form>';
  }
  function leerCambios(form){
    const cambios=new Map();
    for(const [k,n] of campos){
      const check=form.querySelector('[data-dt-grupo-habilitar="'+k+'"]');
      if(!check?.checked)continue;
      const input=form.querySelector('[data-dt-grupo-valor="'+k+'"]');
      if(!input)throw Error("Falta el campo "+n+".");
      if(k==="observaciones"){cambios.set(k,String(input.value??"").trim());continue;}
      const raw=String(input.value??"").trim();
      if(!/^\d+(?:[.,]\d+)?$/.test(raw))throw Error("Introduce un valor válido para "+n+".");
      const v=Number(raw.replace(",","."));
      if(!Number.isFinite(v)||v<0||v>24)throw Error("Revisa "+n+": admite entre 0 y 24 horas.");
      cambios.set(k,Math.round(v*60));
    }
    if(!cambios.size)throw Error("Marca al menos un campo para modificar.");
    return cambios;
  }
  function cambiar(registro,cambios){
    if(!registro||registro.syncStatus==="Sincronizado")throw Error("Hay un registro que no admite edición.");
    const nuevo={...registro};
    // Migración en memoria del saldo de Otros en registros de versiones antiguas.
    if(nuevo.otrosMin==null&&nuevo.otrasLaboresMin!=null){
      const clasificados=descuentos.filter(k=>k!=="otrosMin")
        .reduce((s,k)=>s+(Number(nuevo[k])||0),0);
      nuevo.otrosMin=Math.max(0,(Number(nuevo.otrasLaboresMin)||0)-clasificados);
    }
    for(const [k,v] of cambios)if(k!=="horasLaboralesMin")nuevo[k]=v;
    const extra=Number(nuevo.horasExtraMin)||0;
    const descuento=descuentos.reduce((s,k)=>s+(Number(nuevo[k])||0),0);
    if(cambios.has("horasLaboralesMin")){
      // El total visible común puede requerir bases distintas según cada trabajador.
      nuevo.horasLaboralesMin=cambios.get("horasLaboralesMin")-extra+descuento;
    }
    const base=Number(nuevo.horasLaboralesMin);
    const disponible=base+extra,efectivo=disponible-descuento;
    if(!Number.isFinite(base)||base<0||extra<0||descuento<0||disponible<=0||efectivo<0)
      throw Error("Los nuevos tiempos no son válidos para "+(registro.colaboradorNombre||registro.colaborador)+
        ". No se modificó ningún registro.");
    nuevo.tiempoDisponibleMin=disponible;
    nuevo.otrasLaboresMin=descuento;
    nuevo.tiempoRealMin=efectivo;
    return nuevo;
  }
  window.TiemposGrupoGuardadosJN={formulario,leerCambios,cambiar,
    nombres:c=>campos.filter(([k])=>c.has(k)).map(([,n])=>n)};
})();