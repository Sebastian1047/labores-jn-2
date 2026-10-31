// Seguimiento Conteo de Líneas: registro manual independiente de Calidad Siembra.
// No consulta revisiones, ciclos de siembra ni calificaciones. Solo su propio espacio local.
(function () {
  "use strict";
  const $ = id => document.getElementById(id);
  const abrir = $("abrirSeguimientoDensidad");
  const panel = $("seguimientoDensidadPanel");
  const fecha = $("seguimientoDensidadFecha");
  const todos = $("seguimientoDensidadTodos");
  const agregar = $("agregarSeguimientoDensidad");
  const actualizar = $("consultarSeguimientoDensidad");
  const tabla = $("seguimientoDensidadFilas");
  const mensaje = $("seguimientoDensidadMensaje");
  const alternar = $("cambiarModoPruebaLineas");
  const restaurar = $("restaurarDatosPruebaLineas");
  const aviso = $("avisoDatosPruebaLineas");
  if (![abrir,panel,fecha,todos,agregar,actualizar,tabla,mensaje,alternar,restaurar,aviso].every(Boolean)) return;

  // Un prefijo nuevo evita que los registros antiguos vinculados a revisiones
  // contaminen esta tabla. No se elimina ni altera ningún registro histórico.
  const PREFIX = "calidadSiembraConteoManual:v1:";
  const DEMO_KEY = "calidadSiembraConteoManual:pruebas:v1";
  let modoPrueba = new URLSearchParams(window.location.search).get("pruebas") === "1";
  let filas = [],catalogo = [],cargando = false;
  let revisionesSiembra = [],semanasCalendario = [],nombresColaboradores = new Map();
  const escapar = value => String(value ?? "").replace(/[&<>"']/g, char =>
    ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[char]));
  const comparar = (a,b) => a.localeCompare(b,"es",{numeric:true});
  const normalizar = value => {
    const s = String(value ?? "").trim().toUpperCase();
    return /^\d+$/.test(s) ? String(Number(s)) : s;
  };
  const fechaLocal = () => SyncEngine.fechaLocalISO();
  const crearId = () => (typeof crypto !== "undefined" && crypto.randomUUID)
    ? crypto.randomUUID() : "manual-"+Date.now().toString(36)+"-"+Math.random().toString(36).slice(2);
  function clasificar(reporte,aseguradas) {
    const a = String(reporte ?? ""), b = String(aseguradas ?? "");
    if (!a || !b) return {diferencia:null,estado:"Pendiente"};
    if (!/^\d+$/.test(a) || !/^\d+$/.test(b) ||
        !Number.isSafeInteger(Number(a)) || !Number.isSafeInteger(Number(b)))
      return {diferencia:null,estado:"Revisar números"};
    const diferencia=Number(b)-Number(a);
    return {diferencia,estado:Math.abs(diferencia)>=3?"Inconforme":"Conforme"};
  }
  function ejemplos() {
    const d=fecha.value;
    return [
      {id:"demo-1",fecha:d,bloque:"1",cama:"101",reporte:"20",aseguradas:"20",sembradorCodigo:"",sembradorNombre:""},
      {id:"demo-2",fecha:d,bloque:"1",cama:"102",reporte:"16",aseguradas:"19",sembradorCodigo:"",sembradorNombre:""},
      {id:"demo-3",fecha:d,bloque:"2",cama:"201",reporte:"12",aseguradas:"",sembradorCodigo:"",sembradorNombre:""}
    ];
  }
  function leerPrueba() {
    try {
      const x=JSON.parse(localStorage.getItem(DEMO_KEY)||"null");
      return Array.isArray(x)?x:ejemplos();
    } catch {return ejemplos();}
  }
  function guardarPrueba() {localStorage.setItem(DEMO_KEY,JSON.stringify(filas));}
  async function cargarCatalogo() {
    let local=[],remoto=[];
    try{local=await OfflineDb.getAll("camas");}catch(e){console.warn("Catálogo de camas local no disponible",e);}
    try{
      if (navigator.onLine && SyncEngine.apiGetOnline)
        remoto=await SyncEngine.apiGetOnline("/api/siembra/online/bloques-camas");
    }catch(e){console.warn("Catálogo en línea no disponible, usando datos locales",e);}
    const fuente=[...(Array.isArray(local)?local:[]),...(Array.isArray(remoto)?remoto:[])];
    const visto=new Set();
    catalogo=fuente.map(x=>({
      bloque:String(x.bloque??x.Bloque??"").trim(),
      cama:String(x.cama??x.Cama??"").trim()
    })).filter(x=>{
      if(!x.bloque||!x.cama)return false;
      const key=normalizar(x.bloque)+"|"+normalizar(x.cama);
      if(visto.has(key))return false;
      visto.add(key);return true;
    });
  }

  // Consulta en modo solo lectura las revisiones ya registradas; no crea,
  // modifica ni puntúa ninguna evaluación de Calidad Siembra Campo.
  function fechaCorta(r){return String(r.fecha??r.fechaRevision??"").slice(0,10);}
  function fechaLocalDeTexto(texto){
    const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(texto??""));
    if(!m)return null;
    const d=new Date(Number(m[1]),Number(m[2])-1,Number(m[3]),12);
    return Number.isFinite(d.getTime())&&d.getFullYear()===Number(m[1])&&
      d.getMonth()===Number(m[2])-1&&d.getDate()===Number(m[3])?d:null;
  }
  function formatearFecha(d){
    return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+
      "-"+String(d.getDate()).padStart(2,"0");
  }
  function semanaDeFila(dia){
    const calendario=semanasCalendario.find(w=>
      dia>=String(w.fechaIni??"").slice(0,10)&&
      dia<=String(w.fechaFin??"").slice(0,10));
    if(calendario)return {
      inicio:String(calendario.fechaIni).slice(0,10),fin:String(calendario.fechaFin).slice(0,10),
      numero:Number(calendario.semana),anio:Number(calendario.ano??calendario.anio)
    };
    const d=fechaLocalDeTexto(dia);
    if(!d)return null;
    const ini=new Date(d);
    ini.setDate(d.getDate()-d.getDay()); // Domingo a sábado (calendario de la finca).
    const fin=new Date(ini);fin.setDate(ini.getDate()+6);
    return {inicio:formatearFecha(ini),fin:formatearFecha(fin),numero:null,anio:null};
  }
  function esRevisionSiembra(r){
    if(!r||typeof r!=="object")return false;
    if(r.moduloCalidad)return r.moduloCalidad==="siembra-campo";
    if(r.tipoLaborCalidad||r.gruposPreparacion||r.grupoPreparacion)return false;
    // Antes de guardar moduloCalidad, el formulario Siembra ya registraba Bloque/Cama.
    return Boolean(String(r.bloque??"").trim()&&String(r.cama??"").trim());
  }
  async function cargarRevisionesSemana(){
    const leer=async n=>{
      try{return await OfflineDb.getAll(n)}catch(e){console.warn("No se pudo consultar "+n,e);return []}
    };
    const [revisiones,empleados,colaboradores,semanas]=await Promise.all([
      leer("calidadEvaluaciones"),leer("empleados"),leer("calidadColaboradores"),leer("semanas")
    ]);
    semanasCalendario=Array.isArray(semanas)?semanas:[];
    nombresColaboradores=new Map();
    for(const x of [...empleados,...colaboradores]){
      const codigo=String(x.codigo??x.docid??x.codigo_origen??x.id??"").trim();
      const nombre=String(x.nombre??x.empleadoNombre??x.colaboradorNombre??"").trim();
      if(codigo&&nombre)nombresColaboradores.set(codigo,nombre);
    }
    revisionesSiembra=(Array.isArray(revisiones)?revisiones:[]).filter(esRevisionSiembra);
    if(navigator.onLine&&typeof SyncEngine.apiGetOnline==="function"){
      try{
        // /api/calidad/informe contiene revisiones de Calidad Siembra.
        const remotas=await SyncEngine.apiGetOnline("/api/calidad/informe");
        if(Array.isArray(remotas))revisionesSiembra.push(...remotas.filter(x=>
          x&&(!x.moduloCalidad||x.moduloCalidad==="siembra-campo")));
      }catch(e){console.warn("Sin revisiones remotas; se usa el historial local",e)}
    }
  }
  function opcionesSembrador(r){
    const semana=semanaDeFila(r.fecha);
    const encontrados=new Map();
    if(semana){
      for(const rev of revisionesSiembra){
        const dia=fechaCorta(rev);
        let corresponde=Boolean(dia&&dia>=semana.inicio&&dia<=semana.fin);
        if(!dia&&semana.numero!=null){
          const año=Number(rev.anio??rev.ano);
          corresponde=Number(rev.semana)===semana.numero&&
            Number.isFinite(año)&&año===semana.anio;
        }
        if(!corresponde)continue;
        const codigo=String(rev.colaborador??rev.sembrador??"").trim();
        if(!codigo)continue;
        const nombre=String(rev.colaboradorNombre??rev.sembradorNombre??
          nombresColaboradores.get(codigo)??"").trim()||codigo;
        const previo=encontrados.get(codigo);
        if(!previo||previo===codigo)encontrados.set(codigo,nombre);
      }
    }
    if(modoPrueba){
      for(const [codigo,nombre] of [["PRUEBA-01","Ana Pérez (prueba)"],
        ["PRUEBA-02","Carlos Ruiz (prueba)"],["PRUEBA-03","María López (prueba)"]])
        encontrados.set(codigo,nombre);
    }
    const actual=String(r.sembradorCodigo??"").trim();
    const actualNombre=String(r.sembradorNombre??"").trim();
    // Conservar visualmente una selección previamente guardada aunque en
    // otro dispositivo aún no estén disponibles las revisiones de su semana.
    if(actual&&!encontrados.has(actual))
      encontrados.set(actual,actualNombre||nombresColaboradores.get(actual)||actual);
    const ordered=[...encontrados.entries()].sort((a,b)=>comparar(a[1],b[1]));
    const label=semana?.numero!=null?"Semana "+semana.numero+" de "+semana.anio:
      (semana?"Del "+semana.inicio+" al "+semana.fin:"Fecha no válida");
    return {
      label,cantidad:ordered.length,
      opciones:'<option value="">'+(ordered.length?"Seleccionar sembrador":"Sin revisiones esta semana")+
        '</option>'+ordered.map(([codigo,nombre])=>
        '<option value="'+escapar(codigo)+'"'+(codigo===actual?' selected':'')+'>'+
          escapar(nombre)+(nombre!==codigo?' ('+escapar(codigo)+')':'')+'</option>').join(""),
      nombres:encontrados
    };
  }

  function opcionesBloque(valor) {
    const opciones=new Map();
    catalogo.forEach(x=>opciones.set(normalizar(x.bloque),x.bloque));
    filas.forEach(x=>{if(x.bloque)opciones.set(normalizar(x.bloque),x.bloque)});
    if(modoPrueba) [["1","1"],["2","2"]].forEach(x=>opciones.set(x[0],x[1]));
    const ordered=[...opciones.values()].sort(comparar);
    return '<option value="">Seleccionar bloque</option>'+ordered.map(x=>
      '<option value="'+escapar(x)+'"'+(normalizar(x)===normalizar(valor)?' selected':'')+'>'+
      escapar(x)+'</option>').join("");
  }
  function opcionesCama(bloque,valor) {
    const opciones=new Map();
    catalogo.filter(x=>normalizar(x.bloque)===normalizar(bloque))
      .forEach(x=>opciones.set(normalizar(x.cama),x.cama));
    filas.filter(x=>normalizar(x.bloque)===normalizar(bloque)&&x.cama)
      .forEach(x=>opciones.set(normalizar(x.cama),x.cama));
    if(modoPrueba){
      const demo=normalizar(bloque)==="1"?["101","102","103"]:
        normalizar(bloque)==="2"?["201","202"]:[];
      demo.forEach(x=>opciones.set(normalizar(x),x));
    }
    const ordered=[...opciones.values()].sort(comparar);
    return '<option value="">Seleccionar cama</option>'+ordered.map(x=>
      '<option value="'+escapar(x)+'"'+(normalizar(x)===normalizar(valor)?' selected':'')+'>'+
      escapar(x)+'</option>').join("");
  }
  function pintarEstado(tr,r) {
    const result=clasificar(r.reporte,r.aseguradas);
    const diff=tr.querySelector("[data-seguimiento-diferencia]");
    const status=tr.querySelector("[data-seguimiento-estado]");
    if(diff)diff.textContent=result.diferencia===null?"—":
      (result.diferencia>0?"+":"")+result.diferencia;
    if(status){
      status.textContent=result.estado;
      status.className="cs-resultado "+(result.estado==="Conforme"?"cs-conforme":
        result.estado==="Inconforme"?"cs-inconforme":"cs-pendiente");
    }
    return result;
  }
  function actualizarResumen(){
    const conformes=filas.filter(x=>clasificar(x.reporte,x.aseguradas).estado==="Conforme").length;
    const inconformes=filas.filter(x=>clasificar(x.reporte,x.aseguradas).estado==="Inconforme").length;
    const pendientes=filas.length-conformes-inconformes;
    mensaje.textContent=(modoPrueba?"DATOS DE PRUEBA · ":"")+filas.length+
      " registro(s) manual(es) · "+conformes+" conforme(s) · "+inconformes+
      " inconforme(s) · "+pendientes+" pendiente(s). Esta tabla NO modifica las revisiones de calidad.";
  }
  function pintar(){
    tabla.innerHTML=filas.length?filas.map((r,i)=>
      '<tr data-seguimiento-indice="'+i+'">'+
      '<td><select data-seguimiento-campo="bloque" aria-label="Bloque, fila '+(i+1)+'">'+
      opcionesBloque(r.bloque)+'</select></td>'+
      '<td><select data-seguimiento-campo="cama" aria-label="Cama, fila '+(i+1)+'"'+
      (!r.bloque?' disabled':'')+'>'+opcionesCama(r.bloque,r.cama)+'</select></td>'+
      '<td><input data-seguimiento-campo="reporte" type="number" min="0" step="1" inputmode="numeric" '+
      'aria-label="Líneas reporte, fila '+(i+1)+'" value="'+escapar(r.reporte)+'"></td>'+
      '<td><input data-seguimiento-campo="aseguradas" type="number" min="0" step="1" inputmode="numeric" '+
      'aria-label="Líneas aseguradas, fila '+(i+1)+'" value="'+escapar(r.aseguradas)+'"></td>'+
      '<td data-seguimiento-diferencia>—</td>'+
      '<td><select data-seguimiento-campo="sembradorCodigo" aria-label="Nombre del sembrador, fila '+(i+1)+'">'+
      opcionesSembrador(r).opciones+'</select>'+
      '<small class="cs-semana-sembrador">'+escapar(opcionesSembrador(r).label)+'</small></td>'+
      '<td class="cs-manual-acciones"><small>'+escapar(r.fecha)+'</small>'+
      '<button type="button" data-seguimiento-eliminar="'+i+'" aria-label="Eliminar fila '+(i+1)+'">Eliminar</button></td></tr>'
    ).join(""):'<tr><td colspan="7" class="cs-sin-registros">'+
      'Sin registros manuales para esta fecha. Usa «Agregar fila» para seleccionar bloque y cama.'+
      '</td></tr>';
    tabla.querySelectorAll("[data-seguimiento-indice]").forEach(tr=>
      pintarEstado(tr,filas[Number(tr.dataset.seguimientoIndice)]));
    actualizarResumen();
  }
  async function cargar(){
    if(cargando)return;
    cargando=true;actualizar.disabled=true;
    try{
      await cargarRevisionesSemana();
      if(modoPrueba)filas=leerPrueba();
      else{
        const stored=await OfflineDb.getAll("meta");
        filas=stored.filter(x=>String(x.key??"").startsWith(PREFIX)&&x.value)
          .map(x=>x.value).filter(x=>todos.checked||x.fecha===fecha.value);
      }
      filas.sort((a,b)=>String(b.fecha).localeCompare(String(a.fecha))||
        String(a.bloque).localeCompare(String(b.bloque),"es",{numeric:true})||
        String(a.cama).localeCompare(String(b.cama),"es",{numeric:true}));
      pintar();
    }catch(e){mensaje.textContent="No se pudo consultar el seguimiento manual: "+e.message;}
    finally{cargando=false;actualizar.disabled=false;}
  }
  async function guardarFila(r){
    const result=clasificar(r.reporte,r.aseguradas);
    if(result.estado==="Revisar números")throw new Error("Las líneas deben ser enteros no negativos.");
    if(r.bloque&&r.cama){
      const iguales=filas.filter(x=>x.id!==r.id&&x.fecha===r.fecha&&
        normalizar(x.bloque)===normalizar(r.bloque)&&
        normalizar(x.cama)===normalizar(r.cama));
      if(iguales.length)throw new Error("Esa cama ya tiene una fila en la fecha seleccionada.");
    }
    r.updatedAt=new Date().toISOString();
    if(modoPrueba)guardarPrueba();
    else await OfflineDb.setMeta(PREFIX+r.id,{...r});
  }
  function nuevo(){
    if(!modoPrueba&&!catalogo.length){
      mensaje.textContent="No hay bloques y camas disponibles. Actualiza el catálogo conectado o sincroniza las camas en Labores JN.";
      return;
    }
    const r={id:crearId(),fecha:fecha.value||fechaLocal(),bloque:"",cama:"",
      reporte:"",aseguradas:"",sembradorCodigo:"",sembradorNombre:"",updatedAt:""};
    filas.unshift(r);pintar();
    void guardarFila(r).catch(e=>{mensaje.textContent="No se pudo crear la fila: "+e.message});
  }
  tabla.addEventListener("input",e=>{
    const input=e.target.closest("[data-seguimiento-campo]");
    if(!input||!["reporte","aseguradas"].includes(input.dataset.seguimientoCampo))return;
    const tr=input.closest("[data-seguimiento-indice]"),r=filas[Number(tr?.dataset.seguimientoIndice)];
    if(!r)return;
    r[input.dataset.seguimientoCampo]=input.value.trim();
    pintarEstado(tr,r);actualizarResumen();
  });
  tabla.addEventListener("change",async e=>{
    const input=e.target.closest("[data-seguimiento-campo]");
    if(!input)return;
    const tr=input.closest("[data-seguimiento-indice]"),r=filas[Number(tr?.dataset.seguimientoIndice)];
    if(!r)return;
    const field=input.dataset.seguimientoCampo,old=r[field];
    const oldNombre=r.sembradorNombre;
    if(field==="bloque"){
      r.bloque=input.value;r.cama="";
      pintar();
    }else if(field==="sembradorCodigo"){
      r.sembradorCodigo=input.value.trim();
      r.sembradorNombre=opcionesSembrador(r).nombres.get(r.sembradorCodigo)||"";
    }else{
      r[field]=input.value.trim();
    }
    try{
      await guardarFila(r);
      if(field==="cama")actualizarResumen();
    }catch(err){
      r[field]=old;
      if(field==="sembradorCodigo")r.sembradorNombre=oldNombre;
      pintar();mensaje.textContent="No fue posible guardar: "+err.message;
    }
  });
  tabla.addEventListener("click",async e=>{
    const button=e.target.closest("[data-seguimiento-eliminar]");
    if(!button)return;
    const r=filas[Number(button.dataset.seguimientoEliminar)];
    if(!r||!window.confirm("¿Eliminar este registro manual de bloque y cama?"))return;
    try{
      if(modoPrueba){filas=filas.filter(x=>x.id!==r.id);guardarPrueba();}
      else await OfflineDb.delete("meta",PREFIX+r.id);
      await cargar();
    }catch(err){mensaje.textContent="No fue posible eliminar: "+err.message;}
  });
  async function iniciar(){
    fecha.value=fechaLocal();
    await cargarCatalogo();
    await cargar();
  }
  abrir.addEventListener("click",()=>{
    const mostrar=panel.hidden;
    panel.hidden=!mostrar;abrir.classList.toggle("active",mostrar);
    abrir.setAttribute("aria-expanded",String(mostrar));
    if(mostrar)void iniciar();
  });
  agregar.addEventListener("click",nuevo);
  actualizar.addEventListener("click",async()=>{await cargarCatalogo();await cargar()});
  fecha.addEventListener("change",()=>{if(!todos.checked)void cargar()});
  todos.addEventListener("change",()=>void cargar());
  alternar.addEventListener("click",()=>{
    modoPrueba=!modoPrueba;
    alternar.textContent=modoPrueba?"Volver a registros reales":"Ver datos de prueba";
    aviso.hidden=!modoPrueba;restaurar.hidden=!modoPrueba;
    if(modoPrueba&&todos.checked)todos.checked=false;
    void cargar();
  });
  restaurar.addEventListener("click",()=>{
    localStorage.removeItem(DEMO_KEY);void cargar();
  });
  alternar.textContent=modoPrueba?"Volver a registros reales":"Ver datos de prueba";
  aviso.hidden=!modoPrueba;restaurar.hidden=!modoPrueba;
  if(modoPrueba){panel.hidden=false;abrir.classList.add("active");void iniciar();}
  // Sin listener sobre evaluaciones de Calidad: independencia deliberada.
  window.CalidadSiembraDensidad={clasificar,cargar,ejemplos};
})();