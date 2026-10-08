const sesionMipe = JSON.parse(sessionStorage.getItem("labores_usuario") || "null");
if (!sesionMipe) window.location.href = "./login.html";

const paramsMipe = new URLSearchParams(window.location.search);
const rolMipe = String(paramsMipe.get("rol") || "").toLowerCase();
const tipoMipe = String(paramsMipe.get("tipo") || "").toLowerCase();

const ROLES_MIPE = {
  aspersion: { nombre: "Aspersión", colaborador: "Asperjador" },
  tanquista: { nombre: "Tanquista", colaborador: "Tanquista" },
};
const TIPOS_MIPE = {
  rendimiento: { nombre: "Rendimiento", icono: "📊" },
  calidad: { nombre: "Calidad", icono: "✅" },
};

const rolInfoMipe = ROLES_MIPE[rolMipe] || { nombre: "MIPE", colaborador: "Colaborador" };
const tipoInfoMipe = TIPOS_MIPE[tipoMipe] || { nombre: "Módulo", icono: "🪲" };

const usuarioPillMipe = document.querySelector("#usuarioPill");
const estadoPillMipe = document.querySelector("#estadoPill");
const tituloMipe = document.querySelector("#moduloTitulo");
const vistaRendimientoMipe = document.querySelector("#vistaRendimiento");
const vistaCalidadMipe = document.querySelector("#vistaCalidad");

usuarioPillMipe.textContent = sesionMipe?.empleadoNombre || sesionMipe?.username || "Usuario";
tituloMipe.textContent = `${tipoInfoMipe.icono} ${rolInfoMipe.nombre} - ${tipoInfoMipe.nombre}`;

if (tipoMipe === "rendimiento") {
  vistaRendimientoMipe.hidden = false;
  vistaCalidadMipe.hidden = true;
  iniciarRendimientoMipe();
} else if (tipoMipe === "calidad" && ROLES_MIPE[rolMipe]) {
  vistaRendimientoMipe.hidden = true;
  vistaCalidadMipe.hidden = false;
  iniciarCalidadMipe();
}

function fechaLocalMipe() {
  const hoy = new Date();
  const yyyy = hoy.getFullYear();
  const mm = String(hoy.getMonth() + 1).padStart(2, "0");
  const dd = String(hoy.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function codigoEmpleadoMipe(item) {
  return String(item?.codigo || item?.docid || item?.id || "");
}

function nombreEmpleadoMipe(item) {
  return item?.nombre || item?.empleadoNombre || codigoEmpleadoMipe(item) || rolInfoMipe.colaborador;
}

function etiquetaEmpleadoMipe(item) {
  return `${nombreEmpleadoMipe(item)} (${codigoEmpleadoMipe(item)})`;
}

function valorCatalogoMipe(item, minuscula, mayuscula) {
  return String(item?.[minuscula] ?? item?.[mayuscula] ?? "").trim();
}

function iniciarRendimientoMipe() {
  const fecha = document.querySelector("#fecha");
  const etiqueta = document.querySelector("#colaboradorEtiqueta");
  const buscar = document.querySelector("#colaboradorBuscar");
  const lista = document.querySelector("#colaboradorLista");
  const seleccionadoEl = document.querySelector("#colaboradorSeleccionado");
  const bloque = document.querySelector("#bloque");
  const cama = document.querySelector("#cama");
  const observacionesLabor = document.querySelector("#rendimientoObservaciones");
  const tabs = [...document.querySelectorAll("[data-mipe-vista]")];
  const vistaRegistro = document.querySelector("#vistaRegistro");
  const vistaTiempos = document.querySelector("#vistaTiempos");

  const laborales = document.querySelector("#horasLaboralesMin");
  const extras = document.querySelector("#horasExtraMin");
  const pMadres = document.querySelector("#pMadresMin");
  const pAbuelas = document.querySelector("#pAbuelasMin");
  const desplazamiento = document.querySelector("#desplazamientoMin");
  const calistenia = document.querySelector("#calisteniaMin");
  const capacitacion = document.querySelector("#capacitacionMin");
  const otras = document.querySelector("#otrasLaboresMin");
  const disponibleTexto = document.querySelector("#tiempoDisponibleTexto");
  const realTexto = document.querySelector("#tiempoRealTexto");
  const obsTiempos = document.querySelector("#tiemposObservaciones");
  const guardar = document.querySelector("#guardarTiemposBtn");
  const limpiar = document.querySelector("#limpiarTiemposBtn");
  const resultado = document.querySelector("#tiemposResultado");
  const mensaje = document.querySelector("#tiemposMensaje");
  const registrosEl = document.querySelector("#tiemposRegistrosLista");

  let colaboradores = [];
  let camasCatalogo = [];
  let seleccionado = null;

  fecha.value = fechaLocalMipe();
  etiqueta.textContent = rolInfoMipe.colaborador;
  buscar.placeholder = `Buscar ${rolInfoMipe.colaborador.toLowerCase()} por nombre o código…`;
  seleccionadoEl.textContent = `Sin ${rolInfoMipe.colaborador.toLowerCase()} seleccionado`;

  function cargarBloques() {
    const bloques = [...new Set(camasCatalogo.map((x) => valorCatalogoMipe(x,"bloque","Bloque")).filter(Boolean))]
      .sort((a,b) => a.localeCompare(b,"es",{numeric:true}));
    bloque.innerHTML = '<option value="">Seleccione un bloque</option>' +
      bloques.map((x) => `<option value="${x}">${x}</option>`).join("");
    cargarCamas();
  }

  function cargarCamas() {
    const b = bloque.value;
    const disponibles = [...new Set(camasCatalogo
      .filter((x) => valorCatalogoMipe(x,"bloque","Bloque") === b)
      .map((x) => valorCatalogoMipe(x,"cama","Cama"))
      .filter(Boolean))]
      .sort((a,b) => a.localeCompare(b,"es",{numeric:true}));

    if (!b) {
      cama.disabled = true;
      cama.innerHTML = '<option value="">Seleccione primero un bloque</option>';
      return;
    }
    cama.disabled = false;
    cama.innerHTML = '<option value="">Seleccione una cama</option>' +
      disponibles.map((x) => `<option value="${x}">${x}</option>`).join("");
  }
  bloque.addEventListener("change", cargarCamas);

  function renderColaboradores() {
    const texto = buscar.value.trim().toLowerCase();
    const visibles = colaboradores.filter((x) => !texto || etiquetaEmpleadoMipe(x).toLowerCase().includes(texto)).slice(0,50);
    lista.innerHTML = visibles.length
      ? visibles.map((x,i) => `<div class="pending-item" data-index="${i}" style="cursor:pointer;padding:8px 10px"><span>${etiquetaEmpleadoMipe(x)}</span></div>`).join("")
      : '<p class="hint" style="margin:0;">No hay colaboradores disponibles.</p>';
    lista.querySelectorAll("[data-index]").forEach((el) => el.addEventListener("mousedown",(event) => {
      event.preventDefault();
      seleccionado = visibles[Number(el.dataset.index)];
      seleccionadoEl.textContent = etiquetaEmpleadoMipe(seleccionado);
      buscar.value = "";
      lista.innerHTML = "";
    }));
  }
  buscar.addEventListener("focus",renderColaboradores);
  buscar.addEventListener("input",renderColaboradores);

  function aplicarVista(vista) {
    const esTiempos = vista === "tiempos";
    vistaRegistro.hidden = esTiempos;
    vistaTiempos.hidden = !esTiempos;
    tabs.forEach((btn) => btn.classList.toggle("active", btn.dataset.mipeVista === (esTiempos ? "tiempos" : "registro")));
  }
  tabs.forEach((btn) => btn.addEventListener("click",() => aplicarVista(btn.dataset.mipeVista)));

  function min(input) {
    const n = Number(input.value || 0);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  }
  function formato(total) {
    const n = Math.max(0,Number(total)||0), h=Math.floor(n/60), m=n%60;
    return h ? `${h} h ${m} min` : `${m} min`;
  }
  function calcular() {
    const l=min(laborales), e=min(extras);
    const o=min(pMadres)+min(pAbuelas)+min(desplazamiento)+min(calistenia)+min(capacitacion);
    const d=l+e, r=Math.max(0,d-o);
    otras.value=String(o); disponibleTexto.textContent=formato(d); realTexto.textContent=formato(r);
    return {l,e,o,d,r};
  }
  [laborales,extras,pMadres,pAbuelas,desplazamiento,calistenia,capacitacion].forEach((x)=>x.addEventListener("input",calcular));

  function estado(tipo,texto) {
    resultado.classList.remove("ok","warning","error");
    if(tipo) resultado.classList.add(tipo);
    mensaje.textContent=texto;
  }
  function limpiarTiempos() {
    [laborales,extras,pMadres,pAbuelas,desplazamiento,calistenia,capacitacion].forEach((x)=>{x.value=""});
    obsTiempos.value=""; calcular();
  }
  async function renderRegistros() {
    const registros=(await OfflineDb.getAll("mipeRendimientoTiempos"))
      .filter((r)=>r.rol===rolMipe)
      .sort((a,b)=>String(b.createdAt||"").localeCompare(String(a.createdAt||"")));
    registrosEl.innerHTML=registros.length
      ? registros.slice(0,20).map((r)=>`<article class="pending-item"><strong>${r.fecha} · ${r.colaboradorNombre}</strong><span>${r.rolNombre}</span><span>Tiempo real: ${formato(r.tiempoRealMin)}</span>${r.observaciones?`<span>Observaciones: ${r.observaciones}</span>`:""}</article>`).join("")
      : `<p class="hint" style="margin:0;">Todavía no hay registros para ${rolInfoMipe.nombre}.</p>`;
  }
  async function guardarTiempos() {
    if(!fecha.value) return estado("error","Selecciona la fecha.");
    if(!seleccionado) return estado("error",`Selecciona un ${rolInfoMipe.colaborador.toLowerCase()}.`);
    const calc=calcular();
    if(calc.d<=0) return estado("error","Ingresa los minutos de Horas Laborales o Horas Extra.");

    const registro={
      id:SyncEngine.generarUUID(),area:"MIPE",rol:rolMipe,rolNombre:rolInfoMipe.nombre,
      fecha:fecha.value,colaborador:codigoEmpleadoMipe(seleccionado),colaboradorNombre:nombreEmpleadoMipe(seleccionado),
      bloque:bloque.value,cama:cama.value,
      horasLaboralesMin:calc.l,horasExtraMin:calc.e,pMadresMin:min(pMadres),pAbuelasMin:min(pAbuelas),
      desplazamientoMin:min(desplazamiento),calisteniaMin:min(calistenia),capacitacionMin:min(capacitacion),
      otrasLaboresMin:calc.o,tiempoDisponibleMin:calc.d,tiempoRealMin:calc.r,
      observaciones:obsTiempos.value.trim(),observacionesLabor:observacionesLabor.value.trim(),
      usuario:sesionMipe?.username||"",syncStatus:"PendienteBackend",createdAt:new Date().toISOString()
    };
    await OfflineDb.put("mipeRendimientoTiempos",registro);
    estado("ok",`Tiempos guardados. Tiempo real: ${formato(registro.tiempoRealMin)}.`);
    limpiarTiempos(); await renderRegistros();
  }
  guardar.addEventListener("click",guardarTiempos);
  limpiar.addEventListener("click",()=>{limpiarTiempos();estado(null,"Ingresa los tiempos en minutos para calcular el tiempo real de labor.")});

  async function cargarCatalogos() {
    try {
      let local=await SyncEngine.obtenerCatalogosLocal();
      colaboradores=(local.empleados||[]).filter((x)=>x.activo!==false&&x.retirado!==1&&x.retirado!==true);
      camasCatalogo=local.camas||[]; cargarBloques();

      if(navigator.onLine) {
        try {
          await SyncEngine.sincronizarCatalogos();
          local=await SyncEngine.obtenerCatalogosLocal();
          colaboradores=(local.empleados||[]).filter((x)=>x.activo!==false&&x.retirado!==1&&x.retirado!==true);
          camasCatalogo=local.camas||[]; cargarBloques();
          estadoPillMipe.textContent="Catálogos actualizados";
          estadoPillMipe.classList.add("ok");
        } catch {
          estadoPillMipe.textContent="Datos locales";
          estadoPillMipe.classList.add("warn");
        }
      }
    } catch {
      colaboradores=[];camasCatalogo=[];cargarBloques();
      estadoPillMipe.textContent="Sin catálogo";estadoPillMipe.classList.add("warn");
    }
  }

  (async()=>{limpiarTiempos();aplicarVista("registro");await cargarCatalogos();await renderRegistros()})();
}

function iniciarCalidadMipe() {
  const evaluador=document.querySelector("#calidadEvaluadorNombre");
  const semanaEl=document.querySelector("#calidadSemanaActual");
  const revisionEl=document.querySelector("#calidadRevision");
  const rolEtiqueta=document.querySelector("#calidadRolEtiqueta");
  const buscar=document.querySelector("#calidadColaboradorBuscar");
  const lista=document.querySelector("#calidadColaboradorLista");
  const nombreEl=document.querySelector("#calidadColaboradorNombre");
  const codigoEl=document.querySelector("#calidadColaboradorCodigo");
  const obs=document.querySelector("#calidadObservaciones");
  const guardar=document.querySelector("#guardarCalidadBtn");
  const resultado=document.querySelector("#calidadResultado");
  const mensaje=document.querySelector("#calidadMensaje");
  const registrosEl=document.querySelector("#calidadRegistrosLista");
  const grupos=[...document.querySelectorAll("[data-mipe-calidad-rol]")];
  grupos.forEach((g)=>{const activo=g.dataset.mipeCalidadRol===rolMipe;g.hidden=!activo;g.style.display=activo?"grid":"none"});
  const criteriosEl=document.querySelector(`[data-mipe-calidad-rol="${rolMipe}"]`);

  let colaboradores=[],seleccionado=null,semana=null,siguienteRevision=null;
  evaluador.textContent=sesionMipe?.empleadoNombre||sesionMipe?.username||"Usuario actual";
  rolEtiqueta.textContent=rolInfoMipe.colaborador;
  buscar.placeholder=`Buscar ${rolInfoMipe.colaborador.toLowerCase()} por nombre o código…`;
  nombreEl.textContent=`Sin ${rolInfoMipe.colaborador.toLowerCase()} seleccionado`;

  function estado(tipo,texto){resultado.classList.remove("ok","warning","error");if(tipo)resultado.classList.add(tipo);mensaje.textContent=texto}
  function itemsCatalogo(){
    return [...criteriosEl.querySelectorAll("input")].map((x)=>({id:Number(x.value),nombre:x.closest("label").querySelector(".calidad-criterio-text").textContent.trim()}));
  }
  async function cargarSemana(){
    const semanas=await OfflineDb.getAll("semanas");
    semana=SyncEngine.semanaQueContiene(semanas,new Date());
    semanaEl.textContent=semana?`Semana ${semana.semana} de ${semana.ano}`:"Sin calendario descargado";
  }
  async function siguiente(codigo){
    const registros=await OfflineDb.getAll("mipeCalidadEvaluaciones");
    return registros.filter((r)=>r.rol===rolMipe&&String(r.colaborador)===String(codigo)&&Number(r.semana)===Number(semana?.semana||0))
      .reduce((m,r)=>Math.max(m,Number(r.revision)||0),0)+1;
  }
  function renderLista(){
    const texto=buscar.value.trim().toLowerCase();
    const visibles=colaboradores.filter((x)=>!texto||etiquetaEmpleadoMipe(x).toLowerCase().includes(texto)).slice(0,50);
    lista.innerHTML=visibles.length
      ? visibles.map((x,i)=>`<div class="pending-item" data-index="${i}" style="cursor:pointer;padding:8px 10px"><span>${etiquetaEmpleadoMipe(x)}</span></div>`).join("")
      : '<p class="hint" style="margin:0;">No hay colaboradores disponibles.</p>';
    lista.querySelectorAll("[data-index]").forEach((el)=>el.addEventListener("mousedown",async(event)=>{
      event.preventDefault();seleccionado=visibles[Number(el.dataset.index)];
      buscar.value="";lista.innerHTML="";nombreEl.textContent=nombreEmpleadoMipe(seleccionado);codigoEl.textContent=codigoEmpleadoMipe(seleccionado)||"—";
      siguienteRevision=await siguiente(codigoEmpleadoMipe(seleccionado));
      revisionEl.textContent=siguienteRevision>30?"Completa (30/30)":String(siguienteRevision);
      guardar.disabled=siguienteRevision>30;
      estado(null,"Selecciona los criterios que no cumplen y guarda la evaluación.");
    }));
  }
  buscar.addEventListener("focus",renderLista);buscar.addEventListener("input",renderLista);

  async function renderRegistros(){
    const registros=(await OfflineDb.getAll("mipeCalidadEvaluaciones")).filter((r)=>r.rol===rolMipe)
      .sort((a,b)=>String(b.createdAt||"").localeCompare(String(a.createdAt||"")));
    registrosEl.innerHTML=registros.length
      ? registros.slice(0,20).map((r)=>`<article class="pending-item"><strong>${r.colaboradorNombre} · Revisión ${r.revision}</strong><span>Semana ${r.semana||"—"} · ${r.fecha}</span><span>Ítems: ${r.itemsNombres?.length?r.itemsNombres.join(", "):"Sin ítems seleccionados"}</span>${r.observaciones?`<span>Observaciones: ${r.observaciones}</span>`:""}</article>`).join("")
      : `<p class="hint" style="margin:0;">Todavía no hay evaluaciones para ${rolInfoMipe.nombre}.</p>`;
  }

  async function guardarEvaluacion(){
    if(!seleccionado) return estado("error",`Selecciona un ${rolInfoMipe.colaborador.toLowerCase()} antes de guardar.`);
    if(!semana) return estado("error","No hay calendario de semanas descargado.");
    if(!siguienteRevision||siguienteRevision>30) return estado("error","No hay una revisión disponible.");

    const catalogo=itemsCatalogo();
    const items=[...criteriosEl.querySelectorAll("input:checked")].map((x)=>Number(x.value));
    const itemsNombres=items.map((id)=>catalogo.find((x)=>x.id===id)?.nombre).filter(Boolean);
    const registro={
      id:SyncEngine.generarUUID(),area:"MIPE",rol:rolMipe,rolNombre:rolInfoMipe.nombre,
      fecha:fechaLocalMipe(),semana:semana.semana,ano:semana.ano,evaluador:sesionMipe?.username||"",
      colaborador:codigoEmpleadoMipe(seleccionado),colaboradorNombre:nombreEmpleadoMipe(seleccionado),
      revision:siguienteRevision,items,itemsNombres,observaciones:obs.value.trim(),
      syncStatus:"PendienteBackend",createdAt:new Date().toISOString()
    };
    await OfflineDb.put("mipeCalidadEvaluaciones",registro);
    estado("ok",`Revisión #${registro.revision} guardada localmente.`);
    seleccionado=null;siguienteRevision=null;buscar.value="";lista.innerHTML="";nombreEl.textContent=`Sin ${rolInfoMipe.colaborador.toLowerCase()} seleccionado`;
    codigoEl.textContent="—";revisionEl.textContent="Selecciona un colaborador";criteriosEl.querySelectorAll("input").forEach((x)=>{x.checked=false});obs.value="";guardar.disabled=false;
    await renderRegistros();
  }
  guardar.addEventListener("click",guardarEvaluacion);

  async function cargarColaboradores(){
    try {
      let local=await SyncEngine.obtenerCatalogosLocal();
      colaboradores=(local.empleados||[]).filter((x)=>x.activo!==false&&x.retirado!==1&&x.retirado!==true);
      if(navigator.onLine){
        try{await SyncEngine.sincronizarCatalogos();local=await SyncEngine.obtenerCatalogosLocal();colaboradores=(local.empleados||[]).filter((x)=>x.activo!==false&&x.retirado!==1&&x.retirado!==true);estadoPillMipe.textContent="Catálogos actualizados";estadoPillMipe.classList.add("ok")}
        catch{estadoPillMipe.textContent="Datos locales";estadoPillMipe.classList.add("warn")}
      }
    } catch {colaboradores=[];estadoPillMipe.textContent="Sin catálogo";estadoPillMipe.classList.add("warn")}
  }

  (async()=>{await cargarSemana();await cargarColaboradores();await renderRegistros()})();
}
