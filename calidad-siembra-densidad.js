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
  if (!abrir || !panel || !fecha || !consultar || !cuerpo || !mensaje) return;

  const STORE_PREFIX = "calidadSiembraDensidad:v1:";
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
    mensaje.textContent = registros.length + " cama(s) para " + fecha.value +
      " · " + terminadas + " conforme(s) · " + inconformes +
      " inconforme(s) · " + (registros.length-terminadas-inconformes) + " pendiente(s).";
  }
  function pintar() {
    cuerpo.innerHTML = registros.length ? registros.map((r,i) =>
      '<tr data-densidad-indice="' + i + '">' +
      '<td>' + escapar(r.bloque) + '</td><td>' + escapar(r.cama) + '</td>' +
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
  async function cargar({sincronizar=false}={}) {
    const solicitud=++carga,dia=fecha.value;
    if (!dia) {mensaje.textContent="Selecciona una fecha válida.";return;}
    cargando=true;consultar.disabled=true;
    mensaje.textContent="Cargando siembras del " + dia + "…";
    try {
      registros=await fuentesLocales(dia);
      if (solicitud!==carga)return;
      pintar();
      if (sincronizar) {
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
  fecha.addEventListener("change",()=>void cargar());
  fecha.value=hoy();
  window.CalidadSiembraDensidad={clasificar,cargar};
})();