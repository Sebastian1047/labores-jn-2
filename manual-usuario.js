const MANUALES = {
  pronosticos: {
    titulo: "Pronósticos",
    objetivo: "Consultar la estimación de floración, revisar movimientos y trasladar ramos entre días o semanas.",
    pasos: [
      "Selecciona una variedad o usa el campo Buscar para localizarla.",
      "Define la semana inicial y el año para cargar el periodo que deseas revisar.",
      "Usa Actualizar para refrescar la información disponible.",
      "Para mover ramos, selecciona el día de origen, la semana destino, la cantidad y, si aplica, una observación.",
      "Confirma el movimiento y revisa la sección Movimientos del día.",
      "Usa Sincronizar pronóstico a corte cuando corresponda y Exportar Excel para obtener el reporte."
    ],
    notas: [
      "El resumen depende de la información sincronizada disponible.",
      "Revisa la cantidad antes de confirmar un movimiento para evitar traslados incorrectos."
    ]
  },
  floracion: {
    titulo: "Floración x Siembra",
    objetivo: "Consultar la floración relacionada con siembras mediante filtros de semana, variedad, categoría y bloque.",
    pasos: [
      "Selecciona la semana inicial y el año.",
      "Usa los filtros Semana, Variedad, Categoría y Bloque para reducir los resultados.",
      "Pulsa Actualizar para consultar nuevamente la información.",
      "Usa Limpiar filtros para volver a la vista completa."
    ],
    notas: ["Puedes combinar varios filtros al mismo tiempo para ubicar una siembra específica."]
  },
  siembraHub: {
    titulo: "Siembra Campo",
    objetivo: "Acceder a las funciones de registro, revisión, detalle y sincronización del proceso de siembra.",
    pasos: [
      "En Registro crea nuevas siembras de campo.",
      "En Revisión consulta los registros por rango de fechas.",
      "En Detalle revisa promedios y horas trabajadas.",
      "Usa Sincronizar cuando necesites enviar o actualizar la información pendiente."
    ],
    notas: ["Cada opción abre una pantalla especializada del proceso de Siembra Campo."]
  },
  siembra: {
    titulo: "Registro Siembra Campo",
    objetivo: "Registrar una siembra indicando ubicación, material, empleado y planeación.",
    pasos: [
      "Verifica la Fecha.",
      "Selecciona Bloque y Cama.",
      "Selecciona Variedad y luego el Clon correspondiente.",
      "Selecciona el Empleado que realizó la labor.",
      "Selecciona el Origen.",
      "Ingresa Líneas si ya se conocen; puede quedar en blanco cuando el conteo esté pendiente.",
      "Ingresa la Densidad y completa Semana y Año de planeación.",
      "Pulsa Guardar. Usa + Nuevo registro para limpiar y comenzar otro."
    ],
    notas: ["Antes de guardar revisa que bloque, cama, variedad, clon y empleado correspondan a la labor realizada."]
  },
  siembraRevision: {
    titulo: "Revisión Siembra",
    objetivo: "Consultar y revisar registros de siembra por rango de fechas.",
    pasos: [
      "Selecciona Fecha inicial y Fecha final.",
      "Si necesitas ubicar un dato puntual, usa Buscar.",
      "Pulsa Ver fechas para cargar los registros del periodo.",
      "Usa Exportar JSON si necesitas conservar o compartir la información consultada."
    ],
    notas: ["El rango de fechas debe incluir el día en el que se realizó la siembra que deseas revisar."]
  },
  siembraPromedios: {
    titulo: "Detalle y Promedios de Siembra",
    objetivo: "Consultar detalle de siembra, registrar horas trabajadas y revisar promedios de rendimiento.",
    pasos: [
      "Selecciona Fecha inicial y Fecha final.",
      "Pulsa Ver fechas para consultar el periodo.",
      "Revisa el detalle y los promedios mostrados.",
      "Cuando corresponda, registra las horas del colaborador y pulsa Guardar horas.",
      "Usa Exportar Excel para obtener el reporte."
    ],
    notas: ["Las horas guardadas se usan en el cálculo de rendimiento del colaborador."]
  },
  bandejas: {
    titulo: "Bandejas Enraizamiento",
    objetivo: "Registrar por trabajador cada combinación de cama, densidad y variedad, y calcular el tiempo real dedicado a la labor.",
    pasos: [
      "Verifica la Fecha y selecciona el Sembrador.",
      "En Registro de labor ingresa el Bloque y la Cama, selecciona la Densidad, ingresa la Cantidad y selecciona la Variedad.",
      "Pulsa + Agregar registro. El registro aparecerá en la tabla Registros del día por trabajador.",
      "Si la misma densidad se reparte entre dos camas, agrega un registro independiente para cada cama.",
      "Si cambia la densidad aunque continúe en la misma cama, agrega un nuevo registro.",
      "Si cambia la variedad, agrega un nuevo registro.",
      "La tabla inferior muestra únicamente los registros del sembrador seleccionado.",
      "Debajo de la tabla aparecen los nombres de los trabajadores que ya tienen registros; toca un nombre para cargarlo nuevamente en el formulario y seguir agregando registros.",
      "En Tiempos ingresa los minutos de Horas Laborales y, si aplica, Horas Extra.",
      "Registra los minutos destinados a PMadres, PAbuelas, Desplazamiento, Calistenia/Acondicionamiento/Fortalecimiento y Capacitación/Reunión.",
      "Revisa Tiempo disponible y Tiempo real dedicado a la labor y pulsa Guardar tiempos."
    ],
    notas: [
      "Cada cambio de bloque, cama, densidad o variedad genera un registro independiente.",
      "Después de agregar un registro se conserva el trabajador y los datos de labor, pero se limpia la Cantidad para reducir duplicados accidentales.",
      "Tiempo real = Horas Laborales + Horas Extra - Otras labores.",
      "Los campos de tiempos se diligencian en minutos."
    ]
  },
  desbotonado: {
    titulo: "Desbotonado y Mallas",
    objetivo: "Registrar camas trabajadas y controlar el tiempo real de labor del colaborador.",
    pasos: [
      "Verifica la Fecha y selecciona el Colaborador.",
      "En Registrar labor selecciona Desbotón Pompón, Desbotón Spider o Malla.",
      "Selecciona el Bloque y el Número de cama.",
      "Verifica Tallos por cama, registra Erradicaciones y Medios cuadros trabajados.",
      "Pulsa + Agregar cama y revisa el detalle de la jornada.",
      "En Tiempos registra Horas Laborales, Horas Extra y los minutos de las demás actividades.",
      "Revisa Tiempo disponible y Tiempo real dedicado a la labor.",
      "Pulsa Guardar tiempos."
    ],
    notas: [
      "La hora de inicio y la hora final ya no se solicitan.",
      "Las erradicaciones no pueden superar los tallos de la cama."
    ]
  },
  corte: {
    titulo: "Corte",
    objetivo: "Trabajar con Cortador, Transportador o Recogedor dentro de un único módulo y registrar sus tiempos.",
    pasos: [
      "Selecciona arriba Cortador, Transportador o Recogedor.",
      "Verifica la Fecha y busca el colaborador correspondiente al rol seleccionado.",
      "Cuando trabajes como Cortador, selecciona el Bloque y luego la Cama debajo del buscador del cortador.",
      "Usa Registrar labor para ingresar la información operativa cuando los campos del rol estén habilitados.",
      "En Tiempos registra Horas Laborales y Horas Extra en minutos.",
      "Registra PMadres, PAbuelas, Desplazamiento, Calistenia/Acondicionamiento/Fortalecimiento y Capacitación/Reunión.",
      "Revisa el cálculo de Tiempo disponible y Tiempo real dedicado a la labor.",
      "Pulsa Guardar tiempos."
    ],
    notas: [
      "Los registros de tiempos quedan separados por Cortador, Transportador y Recogedor.",
      "Al cambiar de rol debes seleccionar el colaborador correspondiente."
    ]
  },
  preparacion: {
    titulo: "Preparación Camas",
    objetivo: "Seleccionar al colaborador, ubicar el bloque y la cama, y registrar los tiempos asociados a la preparación de camas.",
    pasos: [
      "Verifica la Fecha y selecciona el Colaborador.",
      "En Registrar labor selecciona primero el Bloque.",
      "Luego selecciona la Cama correspondiente al bloque elegido.",
      "En Tiempos registra Horas Laborales y Horas Extra.",
      "Registra PMadres, PAbuelas, Desplazamiento, Calistenia/Acondicionamiento/Fortalecimiento y Capacitación/Reunión.",
      "Revisa Tiempo disponible y Tiempo real dedicado a la labor.",
      "Pulsa Guardar tiempos."
    ],
    notas: [
      "La lista de Camas se filtra según el Bloque seleccionado.",
      "Todos los tiempos se ingresan en minutos."
    ]
  },
  calidadSiembra: {
    titulo: "Calidad Siembra Campo",
    objetivo: "Evaluar al colaborador de Siembra Campo mediante los criterios de calidad definidos.",
    pasos: [
      "Verifica el Evaluador y la Semana.",
      "Busca y selecciona el Colaborador que será evaluado.",
      "Revisa los Criterios de calidad.",
      "Marca Conforme cuando la revisión no presente incumplimientos o selecciona los criterios que correspondan.",
      "Pulsa Guardar evaluación.",
      "Usa Revisar ítems para confirmar la selección antes de guardar y Sincronizar cuando necesites actualizar catálogos o pendientes."
    ],
    notas: ["Evita seleccionar Conforme junto con un incumplimiento para la misma evaluación."]
  },
  calidadBandejas: {
    titulo: "Calidad Bandejas Enraizamiento",
    objetivo: "Registrar la evaluación de calidad del colaborador que realiza Bandejas Enraizamiento.",
    pasos: [
      "Verifica el Evaluador y la Semana.",
      "Selecciona el Colaborador.",
      "Revisa cada criterio de calidad disponible.",
      "Si no existen incumplimientos, usa la opción Conforme.",
      "Pulsa Guardar evaluación y confirma cuando el sistema lo solicite.",
      "Usa Revisar ítems para validar la selección antes de guardar."
    ],
    notas: ["Sincroniza antes de iniciar cuando necesites actualizar colaboradores o catálogos."]
  },
  calidadCorte: {
    titulo: "Calidad Corte",
    objetivo: "Evaluar la calidad de Cortador, Transportador y Recogedor desde un solo módulo.",
    pasos: [
      "Selecciona Cortador, Transportador o Recogedor.",
      "Verifica el Asegurador/Evaluador y la Semana.",
      "Busca el Colaborador que será revisado.",
      "Selecciona los criterios de calidad o la opción Conforme según el resultado.",
      "Cuando la vista lo permita, agrega la observación correspondiente al ítem.",
      "Pulsa Guardar revisión o Guardar evaluación según la vista activa.",
      "Usa Sincronizar para actualizar la información cuando tengas conexión."
    ],
    notas: ["La lista de criterios cambia según el rol seleccionado."]
  },
  asegurarCorte: {
    titulo: "Aseguramiento de Corte",
    objetivo: "Realizar revisiones de calidad del proceso de corte con los ítems y observaciones disponibles.",
    pasos: [
      "Identifica al colaborador que será revisado.",
      "Selecciona el ítem de calidad.",
      "Selecciona la modalidad u observación cuando corresponda.",
      "Agrega los hallazgos necesarios.",
      "Guarda la revisión y sincroniza cuando haya conexión."
    ],
    notas: ["Esta pantalla conserva el flujo de aseguramiento de Corte usado por la aplicación."]
  },
  calidadDesbotonado: {
    titulo: "Calidad Desbotón y Mallas",
    objetivo: "Evaluar Spider/Cremon, Pompón o Mallas con los criterios de calidad correspondientes.",
    pasos: [
      "Selecciona Spider/Cremon, Pompón o Mallas.",
      "Verifica el Evaluador y la Semana.",
      "Busca y selecciona el Colaborador.",
      "Revisa los Criterios de calidad de la opción seleccionada.",
      "Marca Conforme cuando no haya incumplimientos o selecciona los criterios aplicables.",
      "Pulsa Guardar evaluación y confirma la información.",
      "Usa Revisar ítems antes de guardar cuando necesites comprobar la selección."
    ],
    notas: ["La opción Mallas puede mostrar criterios diferentes de Spider/Cremon y Pompón."]
  },
  calidadPreparacion: {
    titulo: "Calidad Preparación Camas",
    objetivo: "Evaluar el cumplimiento de los criterios de calidad en Preparación Camas.",
    pasos: [
      "Verifica el Evaluador y la Semana.",
      "Selecciona el Colaborador.",
      "Revisa todos los Criterios de calidad.",
      "Marca Conforme si la labor cumple o selecciona los criterios de incumplimiento.",
      "Pulsa Guardar evaluación.",
      "Usa Revisar ítems para validar la selección."
    ],
    notas: ["Sincroniza cuando necesites actualizar los catálogos disponibles."]
  },
  calidadInforme: {
    titulo: "Informe Calidad Siembra",
    objetivo: "Consultar la información consolidada de evaluaciones de calidad de Siembra.",
    pasos: [
      "Selecciona o aplica los filtros disponibles en el informe.",
      "Revisa los resultados consolidados.",
      "Usa las opciones de exportación disponibles cuando necesites conservar el informe."
    ],
    notas: ["El informe refleja la información que se encuentre sincronizada y disponible."]
  }
};

const archivoActual = new URLSearchParams(location.search).get("modulo") || "siembraHub";
const manual = MANUALES[archivoActual] || {
  titulo: "Labores JN",
  objetivo: "Guía general de uso del formulario.",
  pasos: [
    "Verifica la fecha y el colaborador cuando estos campos estén disponibles.",
    "Completa los datos obligatorios del formulario.",
    "Revisa la información antes de guardar.",
    "Usa las opciones de sincronización cuando trabajes con conexión."
  ],
  notas: []
};

const manualModulo = document.querySelector("#manualModulo");
const manualTitulo = document.querySelector("#manualTitulo");
const manualObjetivo = document.querySelector("#manualObjetivo");
const manualContenido = document.querySelector("#manualContenido");
const descargarManualBtn = document.querySelector("#descargarManualBtn");
const volverManualBtn = document.querySelector("#volverManualBtn");

manualModulo.textContent = manual.titulo;
manualTitulo.textContent = manual.titulo;
manualObjetivo.textContent = manual.objetivo;

manualContenido.innerHTML = `
  <h3>Cómo usar este formulario</h3>
  <ol>${manual.pasos.map((paso) => `<li>${paso}</li>`).join("")}</ol>
  ${manual.notas.length ? `
    <h3>Notas importantes</h3>
    <ul>${manual.notas.map((nota) => `<li>${nota}</li>`).join("")}</ul>
  ` : ""}
`;

volverManualBtn.addEventListener("click", () => {
  if (history.length > 1) history.back();
  else location.href = "./menu.html";
});

function textoPdfSeguro(valor) {
  return String(valor)
    .replace(/[–—]/g, "-")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/…/g, "...")
    .replace(/[^ -ÿ]/g, "");
}

function envolverTexto(texto, max = 84) {
  const palabras = textoPdfSeguro(texto).split(/\s+/).filter(Boolean);
  const lineas = [];
  let linea = "";
  for (const palabra of palabras) {
    const candidata = linea ? `${linea} ${palabra}` : palabra;
    if (candidata.length > max && linea) {
      lineas.push(linea);
      linea = palabra;
    } else {
      linea = candidata;
    }
  }
  if (linea) lineas.push(linea);
  return lineas;
}

function escaparPdf(texto) {
  return texto.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function aBytesBinarios(texto) {
  const bytes = new Uint8Array(texto.length);
  for (let i = 0; i < texto.length; i += 1) bytes[i] = texto.charCodeAt(i) & 0xff;
  return bytes;
}

function crearPdfManual() {
  const lineas = [];
  lineas.push(`MANUAL DE USUARIO - ${manual.titulo}`);
  lineas.push("");
  lineas.push(...envolverTexto(manual.objetivo));
  lineas.push("");
  lineas.push("COMO USAR ESTE FORMULARIO");
  manual.pasos.forEach((paso, i) => {
    const envueltas = envolverTexto(`${i + 1}. ${paso}`);
    lineas.push(...envueltas);
  });

  if (manual.notas.length) {
    lineas.push("");
    lineas.push("NOTAS IMPORTANTES");
    manual.notas.forEach((nota) => lineas.push(...envolverTexto(`- ${nota}`)));
  }

  lineas.push("");
  lineas.push(...envolverTexto("Recomendacion general: antes de guardar, verifica la fecha, el colaborador y los valores digitados."));

  const porPagina = 46;
  const paginas = [];
  for (let i = 0; i < lineas.length; i += porPagina) paginas.push(lineas.slice(i, i + porPagina));

  const totalPaginas = paginas.length;
  const objetos = [];
  const kids = [];

  objetos[0] = "<< /Type /Catalog /Pages 2 0 R >>";
  objetos[2] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";

  paginas.forEach((pagina, idx) => {
    const pageObj = 4 + idx * 2;
    const contentObj = pageObj + 1;
    kids.push(`${pageObj} 0 R`);

    const comandos = [
      "BT",
      "/F1 11 Tf",
      "50 792 Td",
      "14 TL",
      ...pagina.flatMap((linea) => [`(${escaparPdf(textoPdfSeguro(linea))}) Tj`, "T*"]),
      "ET"
    ].join("\n");

    objetos[pageObj - 1] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentObj} 0 R >>`;
    objetos[contentObj - 1] = `<< /Length ${comandos.length} >>\nstream\n${comandos}\nendstream`;
  });

  objetos[1] = `<< /Type /Pages /Kids [${kids.join(" ")}] /Count ${totalPaginas} >>`;

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (let i = 0; i < objetos.length; i += 1) {
    if (!objetos[i]) continue;
    offsets[i + 1] = pdf.length;
    pdf += `${i + 1} 0 obj\n${objetos[i]}\nendobj\n`;
  }

  const xref = pdf.length;
  pdf += `xref\n0 ${objetos.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let i = 1; i <= objetos.length; i += 1) {
    const offset = offsets[i] || 0;
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;

  return new Blob([aBytesBinarios(pdf)], { type: "application/pdf" });
}

descargarManualBtn.addEventListener("click", () => {
  const blob = crearPdfManual();
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = `Manual-${manual.titulo.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ]+/g, "-")}.pdf`;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
});
