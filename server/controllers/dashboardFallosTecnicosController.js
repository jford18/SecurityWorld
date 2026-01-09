import { pool } from "../db.js";

const BASE_CTE = `
WITH PARAMS AS (
    SELECT
        $1::INT[] AS CLIENTE_IDS,
        $2::INT AS HACIENDA_ID,
        $3::TEXT AS MES,
        $4::INT AS PROBLEMA_ID,
        $5::INT AS CONSOLA_ID
),
BASE AS (
    SELECT
        A.ID,
        A.FECHA,
        A.FECHA_RESOLUCION,
        A.ESTADO,
        CASE
            WHEN A.ESTADO = 'PENDIENTE' OR A.FECHA_RESOLUCION IS NULL THEN 1
            ELSE 0
        END AS ES_PENDIENTE,
        CASE
            WHEN A.ESTADO = 'RESUELTO' OR A.FECHA_RESOLUCION IS NOT NULL THEN 1
            ELSE 0
        END AS ES_RESUELTO,
        CASE
            WHEN A.FECHA_RESOLUCION IS NOT NULL THEN EXTRACT(EPOCH FROM (A.FECHA_RESOLUCION::TIMESTAMP - A.FECHA::TIMESTAMP)) / 86400.0
            ELSE NULL
        END AS DIAS_SOLUCION,
        COALESCE(B.DESCRIPCION, 'Sin problema') AS TIPO_PROBLEMA,
        COALESCE(A.TIPO_AFECTACION, '') AS TIPO_AFECTACION,
        COALESCE(C.NOMBRE, 'Sin departamento') AS DEPARTAMENTO,
        D.ID AS SITIO_ID,
        COALESCE(E.NOMBRE, 'Sin hacienda') AS HACIENDA,
        F.ID AS CLIENTE_ID,
        COALESCE(F.NOMBRE, 'Sin cliente') AS CLIENTE
    FROM FALLOS_TECNICOS A
    LEFT JOIN CATALOGO_TIPO_PROBLEMA B ON (B.ID = A.TIPO_PROBLEMA_ID)
    LEFT JOIN DEPARTAMENTOS_RESPONSABLES C ON (C.ID = A.DEPARTAMENTO_ID)
    LEFT JOIN SITIOS D ON (D.ID = A.SITIO_ID)
    LEFT JOIN HACIENDA E ON (E.ID = D.HACIENDA_ID)
    LEFT JOIN CLIENTES F ON (F.ID = D.CLIENTE_ID)
    JOIN PARAMS G ON (1 = 1)
    WHERE 1 = 1
      AND (G.CONSOLA_ID IS NULL OR A.CONSOLA_ID = G.CONSOLA_ID)
      AND (G.HACIENDA_ID IS NULL OR E.ID = G.HACIENDA_ID)
      AND (G.PROBLEMA_ID IS NULL OR B.ID = G.PROBLEMA_ID)
      AND (G.MES IS NULL OR TO_CHAR(A.FECHA::DATE, 'YYYY-MM') = G.MES)
      AND (G.CLIENTE_IDS IS NULL OR F.ID = ANY(G.CLIENTE_IDS))
)
`;

const KPI_QUERY = `
${BASE_CTE}
SELECT
    COUNT(1) AS FALLOS_REPORTADOS,
    AVG(CASE WHEN A.ES_RESUELTO = 1 THEN A.DIAS_SOLUCION ELSE NULL END) AS T_PROM_SOLUCION_DIAS,
    (COUNT(1) FILTER (WHERE A.ES_PENDIENTE = 1)::DECIMAL / NULLIF(COUNT(1), 0)) * 100 AS PCT_PENDIENTES,
    (COUNT(1) FILTER (WHERE A.ES_RESUELTO = 1)::DECIMAL / NULLIF(COUNT(1), 0)) * 100 AS PCT_RESUELTOS
FROM BASE A;
`;

const PENDIENTES_DEPARTAMENTO_QUERY = `
${BASE_CTE}
SELECT
    A.DEPARTAMENTO AS DEPARTAMENTO,
    COUNT(1) AS TOTAL
FROM BASE A
WHERE A.ES_PENDIENTE = 1
GROUP BY A.DEPARTAMENTO
ORDER BY TOTAL DESC;
`;

const PENDIENTES_PROBLEMA_HACIENDA_QUERY = `
${BASE_CTE}
SELECT
    (COALESCE(A.TIPO_AFECTACION, '') || ' ' || COALESCE(A.TIPO_PROBLEMA, '')) AS PROBLEMA_LABEL,
    A.HACIENDA AS HACIENDA,
    COUNT(1) AS TOTAL
FROM BASE A
WHERE A.ES_PENDIENTE = 1
GROUP BY (COALESCE(A.TIPO_AFECTACION, '') || ' ' || COALESCE(A.TIPO_PROBLEMA, '')), A.HACIENDA
ORDER BY TOTAL DESC;
`;

const TABLA_CLIENTES_QUERY = `
${BASE_CTE}
WITH PENDIENTES AS (
    SELECT
        A.CLIENTE,
        A.DIAS_SOLUCION,
        A.ES_RESUELTO,
        A.ES_PENDIENTE
    FROM BASE A
),
TOTAL_PENDIENTES AS (
    SELECT COUNT(1) AS TOTAL_PENDIENTES
    FROM PENDIENTES A
    WHERE A.ES_PENDIENTE = 1
)
SELECT
    A.CLIENTE AS CLIENTE,
    AVG(CASE WHEN A.ES_RESUELTO = 1 THEN A.DIAS_SOLUCION ELSE NULL END) AS T_PROM_SOLUCION_DIAS,
    COUNT(1) FILTER (WHERE A.ES_PENDIENTE = 1) AS NUM_FALLOS,
    (COUNT(1) FILTER (WHERE A.ES_PENDIENTE = 1)::DECIMAL / NULLIF(B.TOTAL_PENDIENTES, 0)) * 100 AS PCT_FALLOS
FROM PENDIENTES A
JOIN TOTAL_PENDIENTES B ON (1 = 1)
GROUP BY A.CLIENTE, B.TOTAL_PENDIENTES
ORDER BY NUM_FALLOS DESC, A.CLIENTE ASC;
`;

const TENDENCIA_PENDIENTES_QUERY = `
${BASE_CTE}
WITH PENDIENTES AS (
    SELECT
        TO_CHAR(A.FECHA::DATE, 'YYYY-MM') AS MES,
        A.ES_PENDIENTE
    FROM BASE A
),
TOTAL_PENDIENTES AS (
    SELECT COUNT(1) AS TOTAL_PENDIENTES
    FROM PENDIENTES A
    WHERE A.ES_PENDIENTE = 1
)
SELECT
    A.MES AS MES,
    COUNT(1) FILTER (WHERE A.ES_PENDIENTE = 1) AS NUM_FALLOS,
    (COUNT(1) FILTER (WHERE A.ES_PENDIENTE = 1)::DECIMAL / NULLIF(B.TOTAL_PENDIENTES, 0)) * 100 AS PCT_TG
FROM PENDIENTES A
JOIN TOTAL_PENDIENTES B ON (1 = 1)
GROUP BY A.MES, B.TOTAL_PENDIENTES
ORDER BY A.MES ASC;
`;

const CLIENTES_QUERY = `
WITH PARAMS AS (
    SELECT
        $1::INT AS CONSOLA_ID
)
SELECT DISTINCT
    F.ID AS ID,
    COALESCE(F.NOMBRE, 'Sin cliente') AS NOMBRE
FROM FALLOS_TECNICOS A
LEFT JOIN SITIOS D ON (D.ID = A.SITIO_ID)
LEFT JOIN CLIENTES F ON (F.ID = D.CLIENTE_ID)
JOIN PARAMS B ON (1 = 1)
WHERE 1 = 1
  AND (B.CONSOLA_ID IS NULL OR A.CONSOLA_ID = B.CONSOLA_ID)
ORDER BY NOMBRE ASC;
`;

const HACIENDAS_QUERY = `
WITH PARAMS AS (
    SELECT
        $1::INT AS CONSOLA_ID
)
SELECT DISTINCT
    E.ID AS ID,
    COALESCE(E.NOMBRE, 'Sin hacienda') AS NOMBRE
FROM FALLOS_TECNICOS A
LEFT JOIN SITIOS D ON (D.ID = A.SITIO_ID)
LEFT JOIN HACIENDA E ON (E.ID = D.HACIENDA_ID)
JOIN PARAMS B ON (1 = 1)
WHERE 1 = 1
  AND (B.CONSOLA_ID IS NULL OR A.CONSOLA_ID = B.CONSOLA_ID)
ORDER BY NOMBRE ASC;
`;

const PROBLEMAS_QUERY = `
WITH PARAMS AS (
    SELECT
        $1::INT AS CONSOLA_ID
)
SELECT DISTINCT
    B.ID AS ID,
    COALESCE(B.DESCRIPCION, 'Sin problema') AS NOMBRE
FROM FALLOS_TECNICOS A
LEFT JOIN CATALOGO_TIPO_PROBLEMA B ON (B.ID = A.TIPO_PROBLEMA_ID)
JOIN PARAMS C ON (1 = 1)
WHERE 1 = 1
  AND (C.CONSOLA_ID IS NULL OR A.CONSOLA_ID = C.CONSOLA_ID)
ORDER BY NOMBRE ASC;
`;

const MESES_QUERY = `
WITH PARAMS AS (
    SELECT
        $1::INT AS CONSOLA_ID
)
SELECT DISTINCT
    TO_CHAR(A.FECHA::DATE, 'YYYY-MM') AS MES
FROM FALLOS_TECNICOS A
JOIN PARAMS B ON (1 = 1)
WHERE 1 = 1
  AND (B.CONSOLA_ID IS NULL OR A.CONSOLA_ID = B.CONSOLA_ID)
ORDER BY MES ASC;
`;

const toOptionalNumber = (value) => {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return undefined;
  }
  return parsed;
};

const parseClienteIds = (value) => {
  if (!value) {
    return null;
  }

  const rawList = Array.isArray(value) ? value : String(value).split(",");
  const parsed = rawList
    .map((item) => Number(String(item).trim()))
    .filter((item) => Number.isFinite(item) && item > 0);

  return parsed.length > 0 ? parsed : null;
};

export const getDashboardFallosTecnicosResumen = async (req, res) => {
  try {
    const clienteIdsRaw = req.query.CLIENTE_IDS ?? req.query.cliente_ids;
    const haciendaIdRaw = req.query.HACIENDA_ID ?? req.query.hacienda_id;
    const mesRaw = req.query.MES ?? req.query.mes;
    const problemaIdRaw = req.query.PROBLEMA_ID ?? req.query.problema_id;
    const consolaIdRaw = req.query.CONSOLA_ID ?? req.query.consola_id;

    const clienteIds = parseClienteIds(clienteIdsRaw);
    const haciendaId = toOptionalNumber(haciendaIdRaw);
    const problemaId = toOptionalNumber(problemaIdRaw);
    const consolaId = toOptionalNumber(consolaIdRaw);

    if (haciendaIdRaw && haciendaId === undefined) {
      return res.status(400).json({ message: "El parámetro HACIENDA_ID debe ser válido." });
    }

    if (problemaIdRaw && problemaId === undefined) {
      return res.status(400).json({ message: "El parámetro PROBLEMA_ID debe ser válido." });
    }

    if (consolaIdRaw && consolaId === undefined) {
      return res.status(400).json({ message: "El parámetro CONSOLA_ID debe ser válido." });
    }

    const mes =
      mesRaw && typeof mesRaw === "string" && mesRaw.trim().length > 0
        ? mesRaw.trim()
        : null;

    const baseParams = [clienteIds, haciendaId, mes, problemaId, consolaId];
    const filtrosParams = [consolaId];

    const [
      kpiResult,
      pendientesDepartamentoResult,
      pendientesProblemaHaciendaResult,
      tablaClientesResult,
      tendenciaPendientesResult,
      clientesResult,
      haciendasResult,
      problemasResult,
      mesesResult,
    ] = await Promise.all([
      pool.query(KPI_QUERY, baseParams),
      pool.query(PENDIENTES_DEPARTAMENTO_QUERY, baseParams),
      pool.query(PENDIENTES_PROBLEMA_HACIENDA_QUERY, baseParams),
      pool.query(TABLA_CLIENTES_QUERY, baseParams),
      pool.query(TENDENCIA_PENDIENTES_QUERY, baseParams),
      pool.query(CLIENTES_QUERY, filtrosParams),
      pool.query(HACIENDAS_QUERY, filtrosParams),
      pool.query(PROBLEMAS_QUERY, filtrosParams),
      pool.query(MESES_QUERY, filtrosParams),
    ]);

    const kpis = kpiResult.rows[0] ?? {
      fallos_reportados: 0,
      t_prom_solucion_dias: 0,
      pct_pendientes: 0,
      pct_resueltos: 0,
    };

    return res.json({
      kpis: {
        fallos_reportados: Number(kpis.fallos_reportados ?? 0),
        t_prom_solucion_dias: Number(kpis.t_prom_solucion_dias ?? 0),
        pct_pendientes: Number(kpis.pct_pendientes ?? 0),
        pct_resueltos: Number(kpis.pct_resueltos ?? 0),
      },
      pendientes_por_departamento: pendientesDepartamentoResult.rows ?? [],
      pendientes_por_problema_hacienda: pendientesProblemaHaciendaResult.rows ?? [],
      tabla_clientes: tablaClientesResult.rows ?? [],
      tendencia_pendientes_mes: tendenciaPendientesResult.rows ?? [],
      filtros: {
        clientes: clientesResult.rows ?? [],
        haciendas: haciendasResult.rows ?? [],
        problemas: problemasResult.rows ?? [],
        meses: (mesesResult.rows ?? []).map((row) => row.mes).filter(Boolean),
      },
    });
  } catch (error) {
    console.error("[API][ERROR] /api/dashboard/fallos-tecnicos/resumen:", error);
    return res.status(500).json({
      message: "Error al obtener el resumen de fallos técnicos",
      details: error.message,
    });
  }
};
