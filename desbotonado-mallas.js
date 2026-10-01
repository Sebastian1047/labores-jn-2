const form = document.querySelector("#formDesbotonado");
const empleadoSelect = document.querySelector("#desbotonador"); const empleadoBuscar = document.querySelector("#desbotonadorBuscar"); const empleadoLista = document.querySelector("#desbotonadorLista"); const bloqueLista = document.querySelector("#bloqueLista");
const bloqueInput = document.querySelector("#bloque");
const bloquesList = document.querySelector("#bloquesDisponibles");
const camaSelect = document.querySelector("#cama");
const camaBuscar = document.querySelector("#camaBuscar");
const camaLista = document.querySelector("#camaLista");
const registros = [];
let catalogos = { empleados: [], camas: [] };

const texto = (obj, ...keys) => { for (const key of keys) if (obj?.[key] != null) return String(obj[key]); return ""; };
function cargarEmpleados(filtro = "") {
  const consulta = filtro.trim().toLowerCase();
  const visibles = catalogos.empleados
    .slice()
    .sort((a,b) => texto(a,"nombre","Nombre").localeCompare(texto(b,"nombre","Nombre"),"es"))
    .filter((e) => `${texto(e,"nombre","Nombre","descripcion")} (${texto(e,"codigo","Codigo","cedula","Cedula")})`.toLowerCase().includes(consulta))
    .slice(0,40);
  empleadoSelect.innerHTML = '<option value="">Seleccione un desbotonador</option>';
  empleadoLista.innerHTML = visibles.length
    ? visibles.map((e,i) => `<div class="pending-item" data-index="${i}" style="cursor:pointer;padding:8px 10px"><span>${texto(e,"nombre","Nombre","descripcion")} (${texto(e,"codigo","Codigo","cedula","Cedula")})</span></div>`).join("")
    : '<p class="hint" style="margin:0">No hay empleados que coincidan con la búsqueda.</p>';
  empleadoLista.querySelectorAll("[data-index]").forEach((el) => el.addEventListener("mousedown", (event) => {
    event.preventDefault();
    const e = visibles[Number(el.dataset.index)];
    const codigo = texto(e,"codigo","Codigo","cedula","Cedula");
    const nombre = texto(e,"nombre","Nombre","descripcion") || codigo;
    const option = new Option(`${nombre} (${codigo})`, codigo); option.dataset.nombre = nombre; empleadoSelect.add(option);
    empleadoSelect.value = codigo;
    empleadoBuscar.value = "";
    empleadoLista.innerHTML = "";
    render();
  }));
}
function cargarBloques(filtro = "") {
  const consulta = filtro.trim().toLowerCase();
  const bloques = [...new Set(catalogos.camas.map(c => texto(c,"bloque","Bloque")).filter(Boolean))]
    .sort((a,b)=>a.localeCompare(b,"es",{numeric:true}))
    .filter((bloque) => `Bloque ${bloque}`.toLowerCase().includes(consulta));
  bloqueLista.innerHTML = bloques.length
    ? bloques.map((bloque,i) => `<div class="pending-item" data-index="${i}" style="cursor:pointer;padding:8px 10px"><span>Bloque ${bloque}</span></div>`).join("")
    : '<p class="hint" style="margin:0">No hay bloques que coincidan con la búsqueda.</p>';
  bloqueLista.querySelectorAll("[data-index]").forEach((el) => el.addEventListener("mousedown", (event) => {
    event.preventDefault();
    bloqueInput.value = bloques[Number(el.dataset.index)];
    bloqueLista.innerHTML = "";
    cargarCamas();
  }));
}
function cargarCamas(filtro = "") {
  const bloque = bloqueInput.value.trim();
  const consulta = filtro.trim().toLowerCase();
  const camas = [...new Set(catalogos.camas.filter(c => texto(c,"bloque","Bloque") === bloque).map(c => texto(c,"cama","Cama")))]
    .sort((a,b)=>a.localeCompare(b,"es",{numeric:true}))
    .filter(cama => `Cama ${cama}`.toLowerCase().includes(consulta));
  camaLista.innerHTML = bloque
    ? (camas.length ? camas.map((cama,i) => `<div class="pending-item" data-index="${i}" style="cursor:pointer;padding:8px 10px"><span>Cama ${cama}</span></div>`).join("") : '<p class="hint" style="margin:0">No hay camas que coincidan con la búsqueda.</p>')
    : '<p class="hint" style="margin:0">Seleccione primero un bloque.</p>';
  camaLista.querySelectorAll("[data-index]").forEach(el => el.addEventListener("mousedown", event => {
    event.preventDefault();
    const cama = camas[Number(el.dataset.index)];
    camaSelect.innerHTML = "";
    camaSelect.add(new Option(cama,cama));
    camaSelect.value = cama;
    camaBuscar.value = cama;
    camaLista.innerHTML = "";
    cargarTallosCama(bloque, cama);
  }));
}

async function cargarTallosCama(bloque, cama) {
  const tallosInput = document.querySelector("#tallosCama");
  const mensaje = document.querySelector("#apiMensaje");
  tallosInput.value = "";
  mensaje.textContent = "Consultando tallos de la cama…";
  try {
    const resultado = await SyncEngine.apiGetOnline(`/api/siembra/online/tallos-cama?bloque=${encodeURIComponent(bloque)}&cama=${encodeURIComponent(cama)}`);
    tallosInput.value = Number(resultado.totalTallos || 0);
    mensaje.textContent = resultado.registros?.length
      ? `${resultado.registros.length} registro(s) usados · líneas × densidad = ${resultado.totalTallos}`
      : "No hay registros de SiembraOnline para esta cama.";
  } catch (error) {
    mensaje.textContent = `No se pudieron consultar los tallos: ${error.message}`;
  }
}
async function cargarCatalogos() {
  try { if (navigator.onLine) await SyncEngine.sincronizarCatalogos(); } catch (e) { console.warn("No se pudieron actualizar catálogos", e); }
  try { const c = await SyncEngine.obtenerCatalogosLocal(); catalogos.empleados=c.empleados||[]; let camas=[]; try { if (navigator.onLine) camas=await SyncEngine.apiGetOnline("/api/siembra/online/bloques-camas"); } catch (_) {} catalogos.camas=(camas.length?camas:c.camas||[]).map(item=>({bloque:texto(item,"bloque","Bloque").trim(),cama:texto(item,"cama","Cama").trim()})).filter(item=>item.bloque&&item.cama); } catch (e) { console.error(e); }
  empleadoLista.innerHTML = ""; bloqueLista.innerHTML = ""; cargarCamas();
  document.querySelector("#apiStatusPill").textContent = navigator.onLine ? "En línea" : "Sin conexión";
}
empleadoBuscar.addEventListener("focus",()=>cargarEmpleados(empleadoBuscar.value));
empleadoBuscar.addEventListener("input",()=>cargarEmpleados(empleadoBuscar.value));
bloqueInput.addEventListener("focus",()=>cargarBloques(bloqueInput.value));
bloqueInput.addEventListener("input",()=>{cargarBloques(bloqueInput.value); camaBuscar.value=""; camaSelect.innerHTML='<option value=""></option>'; camaLista.innerHTML=""; document.querySelector("#tallosCama").value="";});
camaBuscar.addEventListener("focus",()=>cargarCamas(camaBuscar.value));
camaBuscar.addEventListener("input",()=>{camaSelect.innerHTML='<option value=""></option>'; document.querySelector("#tallosCama").value=""; cargarCamas(camaBuscar.value);});
document.addEventListener("click", (event) => {
  if (event.target !== empleadoBuscar && !empleadoLista.contains(event.target)) empleadoLista.innerHTML = "";
  if (event.target !== bloqueInput && !bloqueLista.contains(event.target)) bloqueLista.innerHTML = "";
  if (event.target !== camaBuscar && !camaLista.contains(event.target)) camaLista.innerHTML = "";
});
function horasEntre(i,f){const [hi,mi]=i.split(":").map(Number),[hf,mf]=f.split(":").map(Number);let a=hi*60+mi,b=hf*60+mf;if(b<a)b+=1440;return (b-a)/60;}
function numero(v,d=2){return new Intl.NumberFormat("es-CO",{maximumFractionDigits:d}).format(v);}
function render(){const tbody=document.querySelector("#tablaRegistros");const nombre=empleadoSelect.selectedOptions[0]?.dataset.nombre||"";document.querySelector("#nombreResumen").textContent=nombre?`Desbotonador: ${nombre}`:"Seleccione un desbotonador";if(!registros.length){tbody.innerHTML='<tr><td colspan="7">Todavía no hay camas registradas.</td></tr>';["totalCamas","totalTallos","totalHoras","rendimientoAcumulado"].forEach((id,i)=>document.querySelector(`#${id}`).textContent=i===0?"0":i===1?"0":i===2?"0 h":"0 tallos/h");return;}tbody.innerHTML=registros.map(r=>`<tr><td>${r.tipoLabor}</td><td>${r.bloque}</td><td>${r.cama}</td><td>${numero(r.mediosCuadros,1)}</td><td>${numero(r.tallos,2)}</td><td>${numero(r.horas,2)} h</td><td><strong>${numero(r.rendimiento,2)} tallos/h</strong></td></tr>`).join("");const tallos=registros.reduce((s,r)=>s+r.tallos,0),horas=registros.reduce((s,r)=>s+r.horas,0);document.querySelector("#totalCamas").textContent=registros.length;document.querySelector("#totalTallos").textContent=numero(tallos);document.querySelector("#totalHoras").textContent=`${numero(horas)} h`;document.querySelector("#rendimientoAcumulado").textContent=horas?`${numero(tallos/horas)} tallos/h`:"0 tallos/h";}
form.addEventListener("submit",e=>{e.preventDefault();if(!empleadoSelect.value)return alert("Seleccione un desbotonador.");const tallosCama=Number(document.querySelector("#tallosCama").value),err=Number(document.querySelector("#erradicaciones").value),medios=Number(document.querySelector("#mediosCuadros").value),horas=horasEntre(document.querySelector("#horaInicio").value,document.querySelector("#horaFin").value);if(err>tallosCama)return alert("Las erradicaciones no pueden ser mayores que los tallos de la cama.");if(horas<=0)return alert("La hora final debe ser diferente de la inicial.");const tallos=(tallosCama-err)/16*medios;registros.push({tipoLabor:document.querySelector("#tipoLabor").value,bloque:bloqueInput.value.trim(),cama:camaSelect.value,mediosCuadros:medios,tallos,horas,rendimiento:tallos/horas});render();form.reset();cargarCamas();});
document.querySelector("#btnLimpiarCama").addEventListener("click",()=>{form.reset();cargarCamas();});document.querySelector("#btnNuevoDesbotonador").addEventListener("click",()=>{if(registros.length&&!confirm("¿Desea iniciar otro desbotonador? Se borrarán los registros de esta sesión."))return;registros.length=0;empleadoSelect.value="";render();});
cargarCatalogos();render();




