import { pool } from "../db.js";

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

    const params = [];
    const filtros = [];
    let consolaParamIndex = null;

    if (consolaId) {
      params.push(consolaId);
      consolaParamIndex = params.length;
      filtros.push(`AND A.CONSOLA_ID = $${consolaParamIndex}`);
    }

    if (clienteIds && clienteIds.length > 0) {
      params.push(clienteIds);
      filtros.push(`AND F.ID = ANY($${params.length})`);
    }

    if (haciendaId) {
      params.push(haciendaId);
      filtros.push(`AND E.ID = $${params.length}`);
    }

    if (problemaId) {
      params.push(problemaId);
      filtros.push(`AND B.ID = $${params.length}`);
    }

    if (mes) {
      params.push(mes);
      filtros.push(`AND TO_CHAR(A.FECHA::DATE, 'YYYY-MM') = $${params.length}`);
    }

    const consolaFilter =
      consolaParamIndex !== null ? `AND A.CONSOLA_ID = $${consolaParamIndex}` : "";

    const whereBase = `WHERE 1 = 1 ${filtros.join(" ")}`;

    const sql = `
WITH BASE AS (
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
    ${whereBase}
),
KPI AS (
    SELECT
        COUNT(1) AS FALLOS_REPORTADOS,
        AVG(CASE WHEN A.ES_RESUELTO = 1 THEN A.DIAS_SOLUCION ELSE NULL END) AS T_PROM_SOLUCION_DIAS,
        (COUNT(1) FILTER (WHERE A.ES_PENDIENTE = 1)::DECIMAL / NULLIF(COUNT(1), 0)) * 100 AS PCT_PENDIENTES,
        (COUNT(1) FILTER (WHERE A.ES_RESUELTO = 1)::DECIMAL / NULLIF(COUNT(1), 0)) * 100 AS PCT_RESUELTOS,
        COUNT(1) FILTER (WHERE A.ES_PENDIENTE = 1) AS TOTAL_PENDIENTES
    FROM BASE A
),
PEND_DEPARTAMENTO AS (
    SELECT
        A.DEPARTAMENTO,
        COUNT(1) AS TOTAL
    FROM BASE A
    WHERE A.ES_PENDIENTE = 1
    GROUP BY A.DEPARTAMENTO
),
PEND_PROBLEMA_HACIENDA AS (
    SELECT
        (COALESCE(A.TIPO_AFECTACION, '') || ' ' || COALESCE(A.TIPO_PROBLEMA, '')) AS PROBLEMA_LABEL,
        A.HACIENDA,
        COUNT(1) AS TOTAL
    FROM BASE A
    WHERE A.ES_PENDIENTE = 1
    GROUP BY (COALESCE(A.TIPO_AFECTACION, '') || ' ' || COALESCE(A.TIPO_PROBLEMA, '')), A.HACIENDA
),
TABLA_CLIENTE AS (
    SELECT
        A.CLIENTE,
        AVG(CASE WHEN A.ES_RESUELTO = 1 THEN A.DIAS_SOLUCION ELSE NULL END) AS T_PROM_SOLUCION_DIAS,
        COUNT(1) FILTER (WHERE A.ES_PENDIENTE = 1) AS NUM_FALLOS
    FROM BASE A
    GROUP BY A.CLIENTE
),
TENDENCIA_MES AS (
    SELECT
        TO_CHAR(A.FECHA::DATE, 'YYYY-MM') AS MES,
        COUNT(1) FILTER (WHERE A.ES_PENDIENTE = 1) AS NUM_FALLOS
    FROM BASE A
    GROUP BY TO_CHAR(A.FECHA::DATE, 'YYYY-MM')
),
CLIENTES AS (
    SELECT DISTINCT
        F.ID AS ID,
        COALESCE(F.NOMBRE, 'Sin cliente') AS NOMBRE
    FROM FALLOS_TECNICOS A
    LEFT JOIN SITIOS D ON (D.ID = A.SITIO_ID)
    LEFT JOIN CLIENTES F ON (F.ID = D.CLIENTE_ID)
    WHERE 1 = 1
    ${consolaFilter}
),
HACIENDAS AS (
    SELECT DISTINCT
        E.ID AS ID,
        COALESCE(E.NOMBRE, 'Sin hacienda') AS NOMBRE
    FROM FALLOS_TECNICOS A
    LEFT JOIN SITIOS D ON (D.ID = A.SITIO_ID)
    LEFT JOIN HACIENDA E ON (E.ID = D.HACIENDA_ID)
    WHERE 1 = 1
    ${consolaFilter}
),
PROBLEMAS AS (
    SELECT DISTINCT
        B.ID AS ID,
        COALESCE(B.DESCRIPCION, 'Sin problema') AS NOMBRE
    FROM FALLOS_TECNICOS A
    LEFT JOIN CATALOGO_TIPO_PROBLEMA B ON (B.ID = A.TIPO_PROBLEMA_ID)
    WHERE 1 = 1
    ${consolaFilter}
),
MESES AS (
    SELECT DISTINCT
        TO_CHAR(A.FECHA::DATE, 'YYYY-MM') AS MES
    FROM FALLOS_TECNICOS A
    WHERE 1 = 1
    ${consolaFilter}
)
SELECT
    JSON_BUILD_OBJECT(
        'kpis', (SELECT JSON_BUILD_OBJECT(
            'fallos_reportados', K.FALLOS_REPORTADOS,
            't_prom_solucion_dias', COALESCE(K.T_PROM_SOLUCION_DIAS, 0),
            'pct_pendientes', COALESCE(K.PCT_PENDIENTES, 0),
            'pct_resueltos', COALESCE(K.PCT_RESUELTOS, 0)
        ) FROM KPI K),
        'pendientes_por_departamento', (SELECT COALESCE(JSON_AGG(P), '[]'::JSON) FROM PEND_DEPARTAMENTO P),
        'pendientes_por_problema_hacienda', (SELECT COALESCE(JSON_AGG(PH), '[]'::JSON) FROM PEND_PROBLEMA_HACIENDA PH),
        'tabla_clientes', (
            SELECT COALESCE(
                JSON_AGG(
                    JSON_BUILD_OBJECT(
                        'cliente', TC.CLIENTE,
                        't_prom_solucion_dias', TC.T_PROM_SOLUCION_DIAS,
                        'num_fallos', TC.NUM_FALLOS,
                        'pct_fallos', CASE WHEN K.TOTAL_PENDIENTES > 0 THEN (TC.NUM_FALLOS::DECIMAL / K.TOTAL_PENDIENTES) * 100 ELSE 0 END
                    )
                    ORDER BY TC.NUM_FALLOS DESC, TC.CLIENTE ASC
                ),
                '[]'::JSON
            )
            FROM TABLA_CLIENTE TC
            CROSS JOIN KPI K
        ),
        'tendencia_pendientes_mes', (
            SELECT COALESCE(
                JSON_AGG(
                    JSON_BUILD_OBJECT(
                        'mes', TM.MES,
                        'num_fallos', TM.NUM_FALLOS,
                        'pct_tg', CASE WHEN K.TOTAL_PENDIENTES > 0 THEN (TM.NUM_FALLOS::DECIMAL / K.TOTAL_PENDIENTES) * 100 ELSE 0 END
                    )
                    ORDER BY TM.MES
                ),
                '[]'::JSON
            )
            FROM TENDENCIA_MES TM
            CROSS JOIN KPI K
        ),
        'filtros', JSON_BUILD_OBJECT(
            'clientes', (SELECT COALESCE(JSON_AGG(C ORDER BY C.NOMBRE), '[]'::JSON) FROM CLIENTES C),
            'haciendas', (SELECT COALESCE(JSON_AGG(H ORDER BY H.NOMBRE), '[]'::JSON) FROM HACIENDAS H),
            'problemas', (SELECT COALESCE(JSON_AGG(PR ORDER BY PR.NOMBRE), '[]'::JSON) FROM PROBLEMAS PR),
            'meses', (SELECT COALESCE(JSON_AGG(M.MES ORDER BY M.MES), '[]'::JSON) FROM MESES M)
        )
    ) AS DATA;
    `.trim();

    console.log("[DASHBOARD_SQL]", sql);
    console.log("[DASHBOARD_PARAMS]", params);

    const { rows } = await pool.query(sql, params);
    return res.json(rows?.[0]?.data ?? rows?.[0]?.DATA ?? {});
  } catch (error) {
    console.error("[API][ERROR] /api/dashboard/fallos-tecnicos/resumen:", error);
    return res.status(500).json({
      message: "Error al obtener el resumen de fallos técnicos",
      details: error.message,
    });
  }
};
