// IndexedDB local — mirror de lo que AppLabores guarda en Siembras.db3 (SQLite) en Android.
// Se usa nativo, sin librería externa: solo lectura/escritura offline-first para Pronósticos y Siembra.

const DB_NAME = "labores-jn-offline";
const DB_VERSION = 19;

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
      // Poscosecha — tiempos de rendimiento por Surtidor, Zunchador y Digitador.
      if (!db.objectStoreNames.contains("poscosechaRendimientoTiempos")) {
        const poscosechaRendimiento = db.createObjectStore("poscosechaRendimientoTiempos", { keyPath: "id" });
        poscosechaRendimiento.createIndex("fecha", "fecha");
        poscosechaRendimiento.createIndex("rol", "rol");
        poscosechaRendimiento.createIndex("syncStatus", "syncStatus");
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
