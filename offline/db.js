// IndexedDB local — mirror de lo que AppLabores guarda en Siembras.db3 (SQLite) en Android.
// Se usa nativo, sin librería externa: solo lectura/escritura offline-first para Pronósticos y Siembra.

const DB_NAME = "labores-jn-offline";
const DB_VERSION = 23;

function abrirDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    // Sin esto, si OTRA pestaña/contexto del mismo origen (ej. el icono de "Agregar a
    // pantalla de inicio" quedo abierto en segundo plano con una version vieja de la base)
    // sigue con una conexion abierta a una version anterior, este open() se queda esperando
    // en silencio -- la promesa nunca se resuelve ni rechaza, el login (o cualquier otra
    // pantalla) se "cuelga" para siempre sin ningun mensaje. Bug real encontrado en campo
    // 17/09/2026 (subio DB_VERSION de 8 a 9 con la app instalada abierta en otro lado).
    req.onblocked = () => {
      reject(new Error("La app sigue abierta en otra pestaña/ventana con una version anterior -- cierra las demas pestañas de Labores JN (incluido el icono instalado si lo tienes) e intenta de nuevo."));
    };

    req.onupgradeneeded = () => {
      const db = req.result;

      if (!db.objectStoreNames.contains("usuarios")) {
        db.createObjectStore("usuarios", { keyPath: "username" });
      }
      if (!db.objectStoreNames.contains("variedades")) {
        db.createObjectStore("variedades", { keyPath: "codigo" });
      }
      // Clones: keyPath compuesto (variedad+codigo), NO solo "codigo" -- dbo.Clon.codigo no es
      // unico globalmente (hay codigos repetidos entre variedades distintas, ej. "021031" existe
      // para la variedad 13100702 Y para la 01010221). Con keyPath="codigo" solo, guardar el
      // catalogo completo offline hacia que un clon se pisara silenciosamente con el de otra
      // variedad que compartia el mismo codigo -- la lista de Clon salia vacia o con el clon
      // equivocado de forma intermitente, solo para esas variedades puntuales. Bug real
      // encontrado en campo 18/09/2026. Se borra y recrea el store en cada upgrade porque es
      // solo cache de solo-lectura (se resincroniza completo, no hay cola de pendientes aca).
      if (db.objectStoreNames.contains("clones")) {
        db.deleteObjectStore("clones");
      }
      {
        const clones = db.createObjectStore("clones", { keyPath: "clave" });
        clones.createIndex("variedad", "variedad");
      }
      if (!db.objectStoreNames.contains("origenes")) {
        db.createObjectStore("origenes", { keyPath: "codigo" });
      }
      if (!db.objectStoreNames.contains("sembradores")) {
        db.createObjectStore("sembradores", { keyPath: "username" });
      }
      if (!db.objectStoreNames.contains("empleados")) {
        db.createObjectStore("empleados", { keyPath: "codigo" });
      }
      if (!db.objectStoreNames.contains("causas")) {
        db.createObjectStore("causas", { keyPath: "codigo" });
      }
      if (!db.objectStoreNames.contains("camas")) {
        const camas = db.createObjectStore("camas", { keyPath: "clave" });
        camas.createIndex("bloque", "bloque");
      }
      // Calendario real de semanas (domingo-sabado, dbo.tblsemana) -- para poner "Semana
      // programada" por defecto en la semana actual real, disponible sin red.
      if (!db.objectStoreNames.contains("semanas")) {
        db.createObjectStore("semanas", { keyPath: "clave" });
      }
      if (!db.objectStoreNames.contains("siembras")) {
        const siembras = db.createObjectStore("siembras", { keyPath: "id" });
        siembras.createIndex("fecha", "fecha");
        siembras.createIndex("syncStatus", "syncStatus");
      }
      if (!db.objectStoreNames.contains("pronosticosResumen")) {
        db.createObjectStore("pronosticosResumen", { keyPath: "variedadCodigo" });
      }
      if (!db.objectStoreNames.contains("pronosticosFloracion")) {
        db.createObjectStore("pronosticosFloracion", { keyPath: "variedadCodigo" });
      }
      if (!db.objectStoreNames.contains("pronosticosDias")) {
        const dias = db.createObjectStore("pronosticosDias", { keyPath: "clave" });
        dias.createIndex("syncStatus", "syncStatus");
      }
      if (!db.objectStoreNames.contains("pronosticosMovimientos")) {
        db.createObjectStore("pronosticosMovimientos", { keyPath: "idOperacion" });
      }
      // Historial de movimientos YA sincronizados (Envia/Recibe reales) -- distinto de
      // "pronosticosMovimientos" (la cola de pendientes por subir). Se descarga completo con
      // el mismo horizonte de semanas que el resumen, para poder ver "Ver movimientos" de un
      // dia especifico aunque el pronosticador ya este en campo sin señal.
      if (!db.objectStoreNames.contains("movimientosHistorial")) {
        db.createObjectStore("movimientosHistorial", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("meta")) {
        db.createObjectStore("meta", { keyPath: "key" });
      }
      // Asegurar Corte -- catalogo real (dbo.tblitem/tblobservacion) cacheado para uso 100%
      // offline, igual que variedades/clones. corteRevisiones es la cola de revisiones
      // guardadas localmente (con sus observaciones embebidas) pendientes de subir.
      if (!db.objectStoreNames.contains("corteItems")) {
        db.createObjectStore("corteItems", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("corteObservaciones")) {
        const corteObservaciones = db.createObjectStore("corteObservaciones", { keyPath: "id" });
        corteObservaciones.createIndex("item", "item");
      }
      if (!db.objectStoreNames.contains("corteColaboradores")) {
        db.createObjectStore("corteColaboradores", { keyPath: "codigo" });
      }
      // "corteAseguradores" (diseño original: catalogo de TODOS los empleados para elegir el
      // asegurador a mano) quedo sin uso -- el asegurador se resuelve solo por el usuario en
      // sesion y se cachea en localStorage (ver resolverAseguradorActual() en asegurar-corte.js).
      // Se borra en dispositivos que ya lo habian creado; no se vuelve a crear.
      if (db.objectStoreNames.contains("corteAseguradores")) {
        db.deleteObjectStore("corteAseguradores");
      }
      if (!db.objectStoreNames.contains("corteRevisiones")) {
        const corteRevisiones = db.createObjectStore("corteRevisiones", { keyPath: "correlationId" });
        corteRevisiones.createIndex("syncStatus", "syncStatus");
      }
      // Calidad Siembra -- catalogos cacheados y cola offline de evaluaciones.
      if (!db.objectStoreNames.contains("calidadItems")) {
        db.createObjectStore("calidadItems", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("calidadColaboradores")) {
        db.createObjectStore("calidadColaboradores", { keyPath: "codigo" });
      }
      if (!db.objectStoreNames.contains("calidadEvaluaciones")) {
        const calidadEvaluaciones = db.createObjectStore("calidadEvaluaciones", { keyPath: "correlationId" });
        calidadEvaluaciones.createIndex("syncStatus", "syncStatus");
      }
      // Horas trabajadas por colaborador/dia (dbo.Horas) -- para calcular Rendimiento en
      // Promedios. Clave sintetica fecha+empleado (esa tabla no tiene un id propio). Pedido
      // 18/09/2026: antes "Horas" se digitaba en pantalla pero nunca se guardaba.
      if (!db.objectStoreNames.contains("horasColaborador")) {
        const horas = db.createObjectStore("horasColaborador", { keyPath: "clave" });
        horas.createIndex("fecha", "fecha");
        horas.createIndex("syncStatus", "syncStatus");
      }
      // Bandejas Enraizamiento — registros operativos locales mientras se define la API.
      if (!db.objectStoreNames.contains("bandejasEnraizamiento")) {
        const bandejas = db.createObjectStore("bandejasEnraizamiento", { keyPath: "id" });
        bandejas.createIndex("fecha", "fecha");
        bandejas.createIndex("syncStatus", "syncStatus");
      }
      // Bandejas Enraizamiento — tiempos de otras actividades para calcular tiempo real de labor.
      if (!db.objectStoreNames.contains("bandejasTiempos")) {
        const tiempos = db.createObjectStore("bandejasTiempos", { keyPath: "id" });
        tiempos.createIndex("fecha", "fecha");
        tiempos.createIndex("syncStatus", "syncStatus");
      }
      // Corte — tiempos por Cortador, Transportador y Recogedor.
      if (!db.objectStoreNames.contains("corteTiempos")) {
        const corteTiempos = db.createObjectStore("corteTiempos", { keyPath: "id" });
        corteTiempos.createIndex("fecha", "fecha");
        corteTiempos.createIndex("rol", "rol");
        corteTiempos.createIndex("syncStatus", "syncStatus");
      }
      // Preparación Camas — tiempos por colaborador.
      if (!db.objectStoreNames.contains("preparacionCamasTiempos")) {
        const preparacionTiempos = db.createObjectStore("preparacionCamasTiempos", { keyPath: "id" });
        preparacionTiempos.createIndex("fecha", "fecha");
        preparacionTiempos.createIndex("syncStatus", "syncStatus");
      }
      // Desbotonado y Mallas — tiempos por colaborador para calcular tiempo real de labor.
      if (!db.objectStoreNames.contains("desbotonadoMallasTiempos")) {
        const desbotonadoTiempos = db.createObjectStore("desbotonadoMallasTiempos", { keyPath: "id" });
        desbotonadoTiempos.createIndex("fecha", "fecha");
        desbotonadoTiempos.createIndex("syncStatus", "syncStatus");
      }
      // Poscosecha — tiempos de rendimiento por Surtidor, Zunchador, Digitador y Empacador.
      if (!db.objectStoreNames.contains("poscosechaRendimientoTiempos")) {
        const poscosechaRendimiento = db.createObjectStore("poscosechaRendimientoTiempos", { keyPath: "id" });
        poscosechaRendimiento.createIndex("fecha", "fecha");
        poscosechaRendimiento.createIndex("rol", "rol");
        poscosechaRendimiento.createIndex("syncStatus", "syncStatus");
      }
      // Poscosecha — evaluaciones de calidad locales por rol.
      if (!db.objectStoreNames.contains("poscosechaCalidadEvaluaciones")) {
        const poscosechaCalidad = db.createObjectStore("poscosechaCalidadEvaluaciones", { keyPath: "id" });
        poscosechaCalidad.createIndex("fecha", "fecha");
        poscosechaCalidad.createIndex("rol", "rol");
        poscosechaCalidad.createIndex("syncStatus", "syncStatus");
      }
      // MIPE — tiempos de rendimiento por Aspersión y Tanquista.
      if (!db.objectStoreNames.contains("mipeRendimientoTiempos")) {
        const mipeRendimiento = db.createObjectStore("mipeRendimientoTiempos", { keyPath: "id" });
        mipeRendimiento.createIndex("fecha", "fecha");
        mipeRendimiento.createIndex("rol", "rol");
        mipeRendimiento.createIndex("syncStatus", "syncStatus");
      }
      // MIPE — evaluaciones de calidad locales por Aspersión y Tanquista.
      if (!db.objectStoreNames.contains("mipeCalidadEvaluaciones")) {
        const mipeCalidad = db.createObjectStore("mipeCalidadEvaluaciones", { keyPath: "id" });
        mipeCalidad.createIndex("fecha", "fecha");
        mipeCalidad.createIndex("rol", "rol");
        mipeCalidad.createIndex("syncStatus", "syncStatus");
      }
      // Siembra Rendimiento opera en almacenes independientes del Registro original.
      if (!db.objectStoreNames.contains("siembraRendimientoRegistros")) {
        const labor = db.createObjectStore("siembraRendimientoRegistros", { keyPath: "id" });
        labor.createIndex("fecha", "fecha");
        labor.createIndex("colaborador", "colaborador");
      }
      if (!db.objectStoreNames.contains("siembraRendimientoTiempos")) {
        const tiempos = db.createObjectStore("siembraRendimientoTiempos", { keyPath: "id" });
        tiempos.createIndex("fecha", "fecha");
        tiempos.createIndex("syncStatus", "syncStatus");
      }
      // Corte / Cortador: registro de camas independiente del resto de funciones.
      if (!db.objectStoreNames.contains("cortadorRendimientoRegistros")) {
        const cortes = db.createObjectStore("cortadorRendimientoRegistros", { keyPath: "id" });
        cortes.createIndex("fecha", "fecha");
        cortes.createIndex("colaborador", "colaborador");
      }
    };

    req.onsuccess = () => {
      const db = req.result;
      // Si OTRA pestaña abre despues con una version mas nueva, esta conexion se cierra sola
      // en vez de quedarse abierta bloqueando a la otra (evita el mismo cuelgue, del otro lado).
      db.onversionchange = () => db.close();
      resolve(db);
    };
    req.onerror = () => reject(req.error);
  });
}

let dbPromise = null;
function getDb() {
  if (!dbPromise) {
    // Si abrirDb() rechaza (ej. onblocked), no dejar la promesa rota cacheada para siempre --
    // sin esto, cualquier reintento durante la misma carga de pagina recibiria el mismo
    // rechazo aunque el usuario ya haya cerrado la pestaña que bloqueaba.
    dbPromise = abrirDb().catch((err) => {
      dbPromise = null;
      throw err;
    });
  }
  return dbPromise;
}

function txStore(db, storeName, mode) {
  return db.transaction(storeName, mode).objectStore(storeName);
}

function reqToPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

const OfflineDb = {
  // Ciclo persistente y relación explícita con cada revisión de Calidad Siembra.
  // Ambas escrituras se hacen en UNA transacción IndexedDB: nunca queda una
  // revisión sin asociar si falla el registro del seguimiento.
  async guardarCalidadConCiclo(registro) {
    const db=await getDb();
    const normalize=v=>{
      const t=String(v??"").trim().toUpperCase();
      return /^\d+$/.test(t)?String(Number(t)):t;
    };
    if(!registro?.correlationId||!registro?.fecha||
      !normalize(registro.bloque)||!normalize(registro.cama))
      throw new Error("La revisión necesita identificador, fecha, bloque y cama.");
    const prefix="calidadSiembraConteoCiclo:v2:";
    return new Promise((resolve,reject)=>{
      const tx=db.transaction(["meta","calidadEvaluaciones"],"readwrite");
      const meta=tx.objectStore("meta"),quality=tx.objectStore("calidadEvaluaciones");
      let saved,finished=false;
      const fail=err=>{if(!finished){finished=true;reject(err)}};
      tx.onerror=()=>fail(tx.error||new Error("No se pudo registrar la revisión y su ciclo"));
      tx.onabort=()=>fail(tx.error||new Error("Registro del ciclo cancelado"));
      tx.oncomplete=()=>{if(!finished){finished=true;resolve(saved)}};
      meta.getAll().onsuccess=e=>{
        try{
          const pendientes=(e.target.result||[]).filter(x=>{
            if(!String(x.key).startsWith(prefix))return false;
            const c=x.value||{};
            return c.estado==="Pendiente"&&!c.fechaFin&&
              normalize(c.bloque)===normalize(registro.bloque)&&
              normalize(c.cama)===normalize(registro.cama);
          });
          if(pendientes.length>1)throw new Error("Existen varios ciclos pendientes para esta cama; revisa el seguimiento.");
          const actual=pendientes[0]?.value;
          const now=new Date().toISOString();
          const id=actual?.id||("ciclo-"+registro.correlationId);
          const revision={correlationId:registro.correlationId,
            fecha:String(registro.fecha).slice(0,10),semana:Number(registro.semana)||null,
            anio:Number(String(registro.fecha).slice(0,4)),revision:registro.revision,
            colaborador:String(registro.colaborador)};
          const refs=Array.isArray(actual?.revisiones)?[...actual.revisiones]:[];
          if(!refs.some(x=>x.correlationId===revision.correlationId))refs.push(revision);
          const ciclo={...actual,id,bloque:String(registro.bloque).trim(),
            cama:String(registro.cama).trim(),estado:"Pendiente",
            fechaInicio:actual?.fechaInicio&&actual.fechaInicio<revision.fecha?actual.fechaInicio:revision.fecha,
            fechaUltimaRevision:actual?.fechaUltimaRevision&&actual.fechaUltimaRevision>revision.fecha?
              actual.fechaUltimaRevision:revision.fecha,
            fechaFin:null,fechaConteo:null,revisiones:refs,
            creadoEn:actual?.creadoEn||now,updatedAt:now,
            syncStatus:"Solo local"};
          saved={...registro,cicloSiembraId:id,conteoLineasEstado:"Pendiente"};
          meta.put({key:prefix+id,value:ciclo});
          quality.put(saved);
        }catch(err){
          fail(err);tx.abort();
        }
      };
    });
  },
  // Cierre/corrección atómica: se conserva la semana original de cada
  // revisión y solamente se materializa el resultado del ítem de conteo.
  async cerrarCalidadCiclo(id,datos) {
    if(!id)throw new Error("Falta el identificador del ciclo");
    const db=await getDb(),prefix="calidadSiembraConteoCiclo:v2:";
    const reporte=Number(datos?.reporte),aseguradas=Number(datos?.aseguradas);
    if(!/^\d+$/.test(String(datos?.reporte??""))||
       !/^\d+$/.test(String(datos?.aseguradas??""))||
       !Number.isSafeInteger(reporte)||!Number.isSafeInteger(aseguradas))
      throw new Error("Completa los dos conteos con números enteros válidos.");
    const fecha=String(datos?.fechaConteo??"").slice(0,10);
    if(!/^\d{4}-\d{2}-\d{2}$/.test(fecha))
      throw new Error("Indica la fecha del conteo.");
    const diferencia=aseguradas-reporte;
    const estado=Math.abs(diferencia)>=3?"Inconforme":"Conforme";
    return new Promise((resolve,reject)=>{
      const tx=db.transaction(["meta","calidadEvaluaciones"],"readwrite");
      const meta=tx.objectStore("meta"),quality=tx.objectStore("calidadEvaluaciones");
      let resultado,finished=false;
      const fail=e=>{if(!finished){finished=true;reject(e)}};
      tx.onerror=()=>fail(tx.error||new Error("No se pudo cerrar el ciclo"));
      tx.onabort=()=>fail(tx.error||new Error("Cierre cancelado"));
      tx.oncomplete=()=>{if(!finished){finished=true;resolve(resultado)}};
      meta.get(prefix+id).onsuccess=e=>{
        try{
          const ciclo=e.target.result?.value;
          if(!ciclo)throw new Error("No existe el seguimiento de esta cama.");
          if(fecha<ciclo.fechaInicio||
            (ciclo.fechaUltimaRevision&&fecha<ciclo.fechaUltimaRevision))
            throw new Error("No puedes cerrar una cama antes de su última revisión.");
          const refs=Array.isArray(ciclo.revisiones)?ciclo.revisiones:[];
          const next={...ciclo,fechaFin:fecha,fechaConteo:fecha,
            estado,reporte:String(reporte),aseguradas:String(aseguradas),
            diferencia,updatedAt:new Date().toISOString(),syncStatus:"Solo local"};
          meta.put({key:prefix+id,value:next});
          // El ID, y no la fecha ni el número de cama, determina los vínculos.
          for(const ref of refs){
            const req=quality.get(ref.correlationId);
            req.onsuccess=()=>{
              const row=req.result;
              if(row&&row.cicloSiembraId===id)
                quality.put({...row,conteoLineasEstado:estado});
            };
          }
          resultado=next;
        }catch(err){fail(err);tx.abort()}
      };
    });
  },
  async put(storeName, value) {
    const db = await getDb();
    return reqToPromise(txStore(db, storeName, "readwrite").put(value));
  },

  async putMany(storeName, values) {
    const db = await getDb();
    const store = txStore(db, storeName, "readwrite");
    await Promise.all(values.map((v) => reqToPromise(store.put(v))));
  },

  async get(storeName, key) {
    const db = await getDb();
    return reqToPromise(txStore(db, storeName, "readonly").get(key));
  },

  async getAll(storeName) {
    const db = await getDb();
    return reqToPromise(txStore(db, storeName, "readonly").getAll());
  },

  async getAllByIndex(storeName, indexName, value) {
    const db = await getDb();
    const idx = txStore(db, storeName, "readonly").index(indexName);
    return reqToPromise(idx.getAll(value));
  },

  async delete(storeName, key) {
    const db = await getDb();
    return reqToPromise(txStore(db, storeName, "readwrite").delete(key));
  },

  async clear(storeName) {
    const db = await getDb();
    return reqToPromise(txStore(db, storeName, "readwrite").clear());
  },

  async setMeta(key, value) {
    return this.put("meta", { key, value });
  },

  async getMeta(key) {
    const row = await this.get("meta", key);
    return row ? row.value : null;
  },

  // siguiente id temporal para un registro de siembra creado offline (negativo, nunca choca con un id real de servidor)
  async proximoIdTemporalSiembra() {
    const actual = (await this.getMeta("siembraTempIdSeq")) || 0;
    const siguiente = actual - 1;
    await this.setMeta("siembraTempIdSeq", siguiente);
    return siguiente;
  },
};
