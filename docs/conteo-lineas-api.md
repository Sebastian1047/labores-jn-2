> **OBSOLETO DESDE v1.0.160:** el seguimiento Conteo de Líneas fue desvinculado de las revisiones de Calidad Siembra Campo. Este contrato de ciclos ya NO se debe implementar. La tabla ahora es un registro manual independiente y no afecta las conformidades. Se conserva este documento únicamente como referencia histórica.

# Integración central pendiente — Conteo de Líneas por ciclo

Este repositorio es el **cliente web estático** de Labores JN. No contiene el código ni el despliegue del servidor `/produccion-api-jn`. El seguimiento funciona en IndexedDB local; **no afirmar que ya sincroniza entre dispositivos**.

## Contrato recomendado
- `POST /api/calidad/conteo-ciclos/revisiones` — idempotencia por `correlationId`. Recibe `{correlationId,cicloSiembraId,fecha,anio,semana,revision,colaborador,bloque,cama}`; crea o reutiliza un ciclo pendiente y devuelve su `cicloSiembraId`. No cambia la fecha ni semana de la revisión.
- `GET /api/calidad/conteo-ciclos?estado=Pendiente` — devuelve las camas abiertas, identificadas por ID, bloque, cama, primera/última revisión y lista vinculada de `{correlationId,fecha,semana,anio,revision,colaborador}`.
- `PUT /api/calidad/conteo-ciclos/{cicloId}/conteo` — recibe `{reporte,aseguradas,fechaConteo}`. En una transacción, calcula diferencia y Conforme/Inconforme, guarda el resultado una vez para el ciclo y conserva las revisiones inalteradas. Idempotencia y control de versión para correcciones.
- `GET /api/calidad/informe` — incluir `cicloSiembraId` junto con cada evaluación. La conformidad del ítem Conteo se obtiene del ciclo: mientras esté pendiente no se le asigna incumplimiento; al cerrar se propaga a todas las revisiones, sin importar semana.
- `GET /api/calidad/conteo-ciclos/actualizados?desde=...` — sincronización incremental hacia otros equipos, con fecha de servidor o número de versión.

## Reglas
1. Un máximo de un ciclo **Pendiente** por bloque/cama normalizados. La siguiente siembra abre uno nuevo solo después del cierre anterior. Para ciclos de históricos, nunca inferir por coincidencia de cama sin evidencia.
2. Una revisión pertenece exactamente a un ciclo, identificado por `correlationId` y `cicloSiembraId`.
3. Las revisiones conservan la fecha, año y semana originales aun cuando el conteo se cierre en una semana posterior.
4. El ítem Conteo de Líneas se expresa por camas únicas; conformidad total/grupal se expresa por revisiones finalizadas, y los informes pendientes deben señalarse como provisionales.
5. No usar el número de revisión de forma aislada como clave: puede repetirse entre semanas.
6. El servidor debe validar autenticación, permisos, entradas numéricas, correlación con registros reales, límites y conflictos de concurrencia.

## Implementación que ya está en el cliente
- `offline/db.js`: transacción atómica en `meta` + `calidadEvaluaciones` para registrar y cerrar ciclos.
- `offline/sync-engine.js`: al guardar Calidad Siembra crea/vincula el ciclo.
- `calidad-siembra-densidad.js`: seguimiento automático y detalle de revisiones; cierre/corrección.
- `calidad-siembra-informe.js`: busca por `cicloSiembraId` y mantiene cada revisión en su semana.
- FlowerLogix JN: lee esos vínculos y estados cuando se ejecuta desde el mismo navegador/origen.

El fichero `docs/conteo-lineas-servidor.sql` es una **migración propuesta no ejecutada**. Antes de habilitar POST/PUT desde el frontend, integrar el contrato en el backend real y probar con la base de datos de staging. No enviar datos a un endpoint hipotético sin comprobar que existe y soporta el contrato.
