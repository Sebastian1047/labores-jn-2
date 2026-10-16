// Reglas comunes para los seis formularios de Tiempos de Labores JN.
// La captura utiliza horas decimales (coma o punto), pero los registros
// existentes y nuevos permanecen almacenados en MINUTOS para compatibilidad.
(function () {
  "use strict";
  const CAMPOS = [
    "horasLaboralesMin", "horasExtraMin", "pMadresMin", "pAbuelasMin",
    "desplazamientoMin", "calisteniaMin", "capacitacionMin"
  ];

  function leerHoras(input) {
    const texto = String(input?.value ?? "").trim().replace(",", ".");
    if (!texto) return 0;
    const valor = Number(texto);
    return Number.isFinite(valor) ? valor : NaN;
  }

  function leerMinutos(input) {
    const valor = leerHoras(input);
    return Number.isFinite(valor) && valor > 0 ? Math.round(valor * 60) : 0;
  }

  function formatearHoras(minutos) {
    return (Math.max(0, Number(minutos) || 0) / 60)
      .toFixed(2).replace(/\.?0+$/, "").replace(".", ",");
  }

  function horasJornada(fechaISO) {
    // Referencia de Tiempos Cosecha: 7,25 h de lunes a viernes;
    // los sábados el tiempo programado es 5,75 h.
    const fecha = /^\d{4}-\d{2}-\d{2}$/.test(fechaISO || "")
      ? new Date(fechaISO + "T12:00:00Z")
      : new Date();
    return fecha.getUTCDay() === 6 ? "5,75" : "7,25";
  }

  function validar(campos) {
    const sospechosos = [];
    for (const input of campos) {
      if (!input) continue;
      const crudo = String(input.value || "").trim();
      if (crudo && !/^\d+(?:[.,]\d+)?$/.test(crudo)) {
        return "Revisa el valor de " + input.closest("label")?.textContent.trim() +
          ". Usa horas decimales positivas, por ejemplo 0,5.";
      }
      const valor = leerHoras(input);
      if (!Number.isFinite(valor) || valor < 0) {
        return "Los tiempos deben ser números mayores o iguales a cero.";
      }
      if (valor > 12) {
        const etiqueta = input.closest("label")?.textContent.trim() || input.id;
        sospechosos.push(etiqueta + ": " + valor + " h");
      }
    }
    if (sospechosos.length && !window.confirm(
      "Hay tiempos superiores a 12 horas en un mismo campo:\n\n" +
      sospechosos.join("\n") + "\n\n" +
      "Comprueba que la coma decimal no haya alterado el valor. ¿Son correctos?"
    )) {
      return "Revisa los valores superiores a 12 horas antes de guardar.";
    }
    return "";
  }

  function preparar() {
    const vista = document.querySelector("#vistaTiempos");
    const laborales = vista?.querySelector("#horasLaboralesMin");
    if (!laborales) return;
    const fecha = document.querySelector("#fecha");
    if (!String(laborales.value).trim()) laborales.value = horasJornada(fecha?.value);
    laborales.addEventListener("input", () => {
      laborales.dataset.tiempoEditado = "1";
    });
    fecha?.addEventListener("change", () => {
      if (laborales.dataset.tiempoEditado !== "1") {
        laborales.value = horasJornada(fecha.value);
        laborales.dispatchEvent(new Event("input", { bubbles: false }));
        laborales.dataset.tiempoEditado = "0";
      }
    });
    laborales.dispatchEvent(new Event("input", { bubbles: false }));
    laborales.dataset.tiempoEditado = "0";
  }

  const COLABORADORES_PRUEBA = Object.freeze([
    { codigo: "PRUEBA001", nombre: "COLABORADOR PRUEBA 1", activo: true, esPrueba: true },
    { codigo: "PRUEBA002", nombre: "COLABORADOR PRUEBA 2", activo: true, esPrueba: true },
    { codigo: "PRUEBA003", nombre: "COLABORADOR PRUEBA 3", activo: true, esPrueba: true },
    { codigo: "PRUEBA004", nombre: "COLABORADOR PRUEBA 4", activo: true, esPrueba: true }
  ]);

  function esColaboradorPrueba(codigo) {
    return COLABORADORES_PRUEBA.some((e) => e.codigo === String(codigo || "").trim());
  }

  function conColaboradoresPrueba(empleados) {
    const existentes = Array.isArray(empleados) ? empleados : [];
    const codigos = new Set(existentes.map((e) =>
      String(e.codigo ?? e.Codigo ?? e.docid ?? e.id ?? "").trim()
    ));
    return [
      ...COLABORADORES_PRUEBA.filter((e) => !codigos.has(e.codigo)).map((e) => ({ ...e })),
      ...existentes
    ];
  }

  const CAMAS_PRUEBA = Object.freeze([
    { bloque: "PRUEBA-B1", cama: "CAMA-P1", esPrueba: true },
    { bloque: "PRUEBA-B1", cama: "CAMA-P2", esPrueba: true },
    { bloque: "PRUEBA-B2", cama: "CAMA-P1", esPrueba: true }
  ]);
  function conCamasPrueba(camas) {
    const existentes = Array.isArray(camas) ? camas : [];
    const claves = new Set(existentes.map((c) =>
      String(c.bloque ?? c.Bloque ?? "") + "|" + String(c.cama ?? c.Cama ?? "")
    ));
    return [
      ...CAMAS_PRUEBA.filter((c) => !claves.has(c.bloque + "|" + c.cama)).map((c) => ({ ...c })),
      ...existentes
    ];
  }

  window.TiemposLaboresJN = {
    CAMPOS, leerHoras, leerMinutos, formatearHoras, horasJornada, validar, preparar,
    COLABORADORES_PRUEBA, esColaboradorPrueba, conColaboradoresPrueba,
    CAMAS_PRUEBA, conCamasPrueba
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", preparar, { once: true });
  } else {
    preparar();
  }
})();
