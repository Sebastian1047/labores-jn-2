// Calidad Siembra Campo / Seguimiento Conteo de Líneas.
// Tabla por fecha, bloque y cama. Se alimenta de siembras sincronizadas y
// registros de Rendimiento locales; los conteos se guardan localmente en meta.
(function () {
  "use strict";
  const abrir = document.getElementById("abrirSeguimientoDensidad");
  const panel = document.getElementById("seguimientoDensidadPanel");
  const fecha = document.getElementById("seguimientoDensidadFecha");
  const consultar = document.getElementById("consultarSeguimientoDensidad");
  const cuerpo = document.getElementById("seguimientoDensidadFilas");
  const mensaje = document.getElementById("seguimientoDensidadMensaje");
  const alternar = document.getElementById("cambiarModoPruebaLineas");
  const restaurar = document.getElementById("restaurarDatosPruebaLineas");
  const aviso = document.getElementById("avisoDatosPruebaLineas");
  if (!abrir || !panel || !fecha || !consultar || !cuerpo || !mensaje || !alternar || !restaurar || !aviso) return;

  const STORE_PREFIX = "calidadSiembraDensidad:v1:";
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
      '</td><td>' + escapar(r.cama) + '</td>' +
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
    const [siembras,rendimiento,empleados,calidad] = await Promise.all([
      OfflineDb.getAll("siembras"),
      OfflineDb.getAll("siembraRendimientoRegistros"),
      OfflineDb.getAll("empleados"),
      OfflineDb.getAll("calidadColaboradores")
    ]);
    const nombres = new Map();
    [...empleados,...calidad].forEach(p=>{
      const id=String(p.codigo ?? p.docid ?? p.id ?? "").trim();
      if (id) nombres.set(id,etiqueta(p) || id);
    });
    const grupos = new Map();
    // Ambos módulos registran siembras: se muestran juntos, pero una
    // persona repetida dentro de la cama aparece una sola vez.
    for (const r of [...siembras,...rendimiento]) {
      if (r.fecha !== dia || r.bloque == null || r.cama == null ||
          !String(r.bloque).trim() || !String(r.cama).trim()) continue;
      const id=String(r.empleado ?? r.colaborador ?? "").trim();
      const key=codigo(r.bloque)+"|"+codigo(r.cama);
      let grupo=grupos.get(key);
      if (!grupo) {
        grupo={fecha:dia,bloque:String(r.bloque).trim(),
          cama:String(r.cama).trim(),personas:[],ids:new Set(),reporte:"",aseguradas:""};
        grupos.set(key,grupo);
      }
      if (id && !grupo.ids.has(id)) {
        const nombre=String(r.empleadoNombre ?? r.colaboradorNombre ?? "").trim() ||
          nombres.get(id) || id;
        grupo.ids.add(id);
        grupo.personas.push({codigo:id,nombre});
      }
    }
    const filas=[...grupos.values()].map(r=>{
      delete r.ids;
      r.personas.sort((a,b)=>a.nombre.localeCompare(b.nombre,"es"));
      return r;
    });
    filas.sort((a,b)=>a.bloque.localeCompare(b.bloque,"es",{numeric:true}) ||
      a.cama.localeCompare(b.cama,"es",{numeric:true}));
    await Promise.all(filas.map(async r=>{
      const guardado=await OfflineDb.getMeta(clave(r));
      if (guardado) {
        r.reporte=String(guardado.reporte ?? "");
        r.aseguradas=String(guardado.aseguradas ?? "");
      }
    }));
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
      return {...r,fecha:dia,esPrueba:true,
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
    if (!dia) {mensaje.textContent="Selecciona una fecha válida.";return;}
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
    const resultado=clasificar(registro.reporte,registro.aseguradas);
    if(resultado.estado==="Revisar números")return;
    const fechaGuardado=new Date().toISOString();
    await OfflineDb.setMeta(clave(registro),{
      fecha:registro.fecha,bloque:registro.bloque,cama:registro.cama,
      personas:registro.personas, reporte:registro.reporte,aseguradas:registro.aseguradas,
      diferencia:resultado.diferencia,estado:resultado.estado,updatedAt:fechaGuardado
    });
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
  fecha.addEventListener("change",()=>void cargar());
  fecha.value=hoy();
  actualizarModo();
  if(modoPrueba){
    panel.hidden=false;abrir.classList.add("active");
    abrir.setAttribute("aria-expanded","true");void cargar();
  }
  window.CalidadSiembraDensidad={clasificar,cargar,ejemplos};
})();