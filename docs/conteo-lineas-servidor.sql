-- OBSOLETO DESDE v1.0.160: NO EJECUTAR. La tabla Conteo de Líneas es
-- manual e independiente; no debe enlazarse a revisiones ni a conformidades.
-- Se conserva este script únicamente como referencia histórica.

-- CONTRATO PROPUESTO PARA EL BACKEND EXISTENTE /produccion-api-jn
-- SQL Server: ejecutar únicamente tras revisión por el administrador de base de datos.
-- Este script NO se ha aplicado a ninguna base empresarial.
IF OBJECT_ID(N'dbo.CalidadSiembraCiclo',N'U') IS NULL
BEGIN
  CREATE TABLE dbo.CalidadSiembraCiclo (
    CicloId NVARCHAR(100) NOT NULL PRIMARY KEY,
    Bloque NVARCHAR(60) NOT NULL,
    Cama NVARCHAR(60) NOT NULL,
    BloqueNormalizado NVARCHAR(60) NOT NULL,
    CamaNormalizada NVARCHAR(60) NOT NULL,
    FechaInicio DATE NOT NULL,
    FechaUltimaRevision DATE NOT NULL,
    FechaCierre DATE NULL,
    LineasReportadas INT NULL,
    LineasAseguradas INT NULL,
    Estado NVARCHAR(16) NOT NULL DEFAULT N'Pendiente',
    ActualizadoEn DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    FilaVersion ROWVERSION NOT NULL,
    CONSTRAINT CK_CicloEstado CHECK (Estado IN(N'Pendiente',N'Conforme',N'Inconforme')),
    CONSTRAINT CK_CicloLineas CHECK (
       (LineasReportadas IS NULL AND LineasAseguradas IS NULL)
       OR (LineasReportadas >= 0 AND LineasAseguradas >= 0)
    ),
    CONSTRAINT CK_CicloCierre CHECK (FechaCierre IS NULL OR FechaCierre>=FechaUltimaRevision)
  );
  CREATE UNIQUE INDEX UX_CamaCicloPendiente
  ON dbo.CalidadSiembraCiclo(BloqueNormalizado,CamaNormalizada)
  WHERE Estado=N'Pendiente';
END;
GO
IF OBJECT_ID(N'dbo.CalidadSiembraCicloRevision',N'U') IS NULL
BEGIN
  CREATE TABLE dbo.CalidadSiembraCicloRevision (
    CorrelationId NVARCHAR(100) NOT NULL PRIMARY KEY,
    CicloId NVARCHAR(100) NOT NULL,
    Fecha DATE NOT NULL,
    Anio SMALLINT NOT NULL,
    Semana TINYINT NOT NULL,
    Revision TINYINT NOT NULL,
    Colaborador NVARCHAR(100) NOT NULL,
    CONSTRAINT FK_CicloRevision_Ciclo FOREIGN KEY(CicloId)
      REFERENCES dbo.CalidadSiembraCiclo(CicloId),
    CONSTRAINT CK_CicloRevision_Semana CHECK(Semana BETWEEN 1 AND 53),
    CONSTRAINT CK_CicloRevision_Num CHECK(Revision BETWEEN 1 AND 30)
  );
  CREATE INDEX IX_CicloRevision_Ciclo ON dbo.CalidadSiembraCicloRevision(CicloId);
  CREATE INDEX IX_CicloRevision_Periodo ON dbo.CalidadSiembraCicloRevision(Anio,Semana,Colaborador);
END;
GO

-- El backend debe usar transacciones para:
-- 1. POST de revisión: UPSERT idempotente por CorrelationId, creación del único ciclo
--    pendiente por BloqueNormalizado + CamaNormalizada y vinculación CicloId.
-- 2. PUT de cierre: validar conteos; actualizar SOLO el ciclo y devolver los IDs
--    de revisión asociados. Las revisiones conservan Fecha, Anio y Semana.
-- 3. Rechazar conflictos: dos ciclos pendientes para una cama, cierres anteriores a
--    última revisión y reutilización del mismo CorrelationId para otro CicloId.
-- 4. El resultado de conteo se obtiene por JOIN con CalidadSiembraCiclo.
--    No sobrescribir otros ítems de calidad ni duplicar incumplimientos.
