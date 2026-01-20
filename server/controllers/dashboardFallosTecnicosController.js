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

const REPORTADO_COLUMNS = ["reportado_al_cliente", "reportado_cliente"];

const resolveReportadoClienteColumn = async () => {
  const { rows } = await pool.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'fallos_tecnicos'
       AND column_name = ANY($1)
     ORDER BY column_name`,
    [REPORTADO_COLUMNS]
  );

  return rows?.[0]?.column_name ?? null;
};

const normalizeReportadoClienteFilter = (value) => {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const normalized = String(value).trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  const truthy = ["true", "t", "1", "s", "si", "sí", "y", "yes"];
  const falsy = ["false", "f", "0", "n", "no"];

  if (truthy.includes(normalized)) {
    return truthy;
  }

  if (falsy.includes(normalized)) {
    return falsy;
  }

  return undefined;
};

export const getDashboardFallosTecnicosResumen = async (req, res) => {
  try {
    const clienteIdsRaw = req.query.CLIENTE_IDS ?? req.query.cliente_ids ?? req.query.cliente_id;
    const haciendaIdRaw = req.query.HACIENDA_ID ?? req.query.hacienda_id;
    const mesRaw = req.query.MES ?? req.query.mes;
    const fechaDesdeRaw = req.query.FECHA_DESDE ?? req.query.fecha_desde;
    const fechaHastaRaw = req.query.FECHA_HASTA ?? req.query.fecha_hasta;
    const problemaIdRaw =
      req.query.TIPO_PROBLEMA_ID ??
      req.query.tipo_problema_id ??
      req.query.PROBLEMA_ID ??
      req.query.problema_id;
    const consolaIdRaw = req.query.CONSOLA_ID ?? req.query.consola_id;
    const reportadoClienteRaw = req.query.REPORTADO_CLIENTE ?? req.query.reportado_cliente;
    const tipoAfectacionRaw = req.query.TIPO_AFECTACION ?? req.query.tipo_afectacion;

    const clienteIds = parseClienteIds(clienteIdsRaw);
    const haciendaId = toOptionalNumber(haciendaIdRaw);
    const problemaId = toOptionalNumber(problemaIdRaw);
    const consolaId = toOptionalNumber(consolaIdRaw);
    const reportadoClienteValues = normalizeReportadoClienteFilter(reportadoClienteRaw);
    const tipoAfectacion =
      tipoAfectacionRaw && String(tipoAfectacionRaw).trim().length > 0
        ? String(tipoAfectacionRaw).trim()
        : null;

    if (haciendaIdRaw && haciendaId === undefined) {
      return res.status(400).json({ message: "El parámetro HACIENDA_ID debe ser válido." });
    }

    if (problemaIdRaw && problemaId === undefined) {
      return res.status(400).json({ message: "El parámetro PROBLEMA_ID debe ser válido." });
    }

    if (consolaIdRaw && consolaId === undefined) {
      return res.status(400).json({ message: "El parámetro CONSOLA_ID debe ser válido." });
    }

    if (reportadoClienteRaw && reportadoClienteValues === undefined) {
      return res
        .status(400)
        .json({ message: "El parámetro REPORTADO_CLIENTE debe ser válido." });
    }

    const mes =
      mesRaw && typeof mesRaw === "string" && mesRaw.trim().length > 0
        ? mesRaw.trim()
        : null;
    const fechaDesde =
      fechaDesdeRaw && typeof fechaDesdeRaw === "string" && fechaDesdeRaw.trim().length > 0
        ? fechaDesdeRaw.trim()
        : null;
    const fechaHasta =
      fechaHastaRaw && typeof fechaHastaRaw === "string" && fechaHastaRaw.trim().length > 0
        ? fechaHastaRaw.trim()
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
      filtros.push(`AND A.TIPO_PROBLEMA_ID = $${params.length}`);
    }

    if (tipoAfectacion) {
      params.push(tipoAfectacion);
      filtros.push(`AND A.TIPO_AFECTACION = $${params.length}`);
    }

    if (mes) {
      params.push(mes);
      filtros.push(`AND TO_CHAR(A.FECHA::DATE, 'YYYY-MM') = $${params.length}`);
    }

    if (fechaDesde) {
      params.push(fechaDesde);
      filtros.push(`AND A.FECHA::DATE >= $${params.length}`);
    }

    if (fechaHasta) {
      params.push(fechaHasta);
      filtros.push(`AND A.FECHA::DATE <= $${params.length}`);
    }

    if (reportadoClienteValues) {
      const reportadoColumn = await resolveReportadoClienteColumn();
      if (reportadoColumn) {
        params.push(reportadoClienteValues);
        filtros.push(
          `AND LOWER(CAST(A.${reportadoColumn} AS TEXT)) = ANY($${params.length})`
        );
      }
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
        CASE
            WHEN UPPER(A.TIPO_AFECTACION) = 'EQUIPO' THEN COALESCE(
                NULLIF(TRIM(
                    CASE
                        WHEN A.CAMERA_ID IS NOT NULL THEN (CAM.CAMERA_NAME || ' - ' || CAM.IP_ADDRESS)
                        WHEN A.ENCODING_DEVICE_ID IS NOT NULL THEN ENC.NAME
                        WHEN A.IP_SPEAKER_ID IS NOT NULL THEN SPK.NAME
                        WHEN A.ALARM_INPUT_ID IS NOT NULL THEN ALM.NAME
                        ELSE A.EQUIPO_AFECTADO
                    END
                ), ''),
                'Sin información'
            )
            ELSE NULL
        END AS NOMBRE_EQUIPO,
        C.ID AS DEPARTAMENTO_ID,
        COALESCE(C.NOMBRE, 'Sin departamento') AS DEPARTAMENTO,
        D.ID AS SITIO_ID,
        COALESCE(D.NOMBRE, 'Sin sitio') AS SITIO,
        E.ID AS HACIENDA_ID,
        COALESCE(E.NOMBRE, 'Sin hacienda') AS HACIENDA,
        F.ID AS CLIENTE_ID,
        COALESCE(F.NOMBRE, 'Sin cliente') AS CLIENTE
    FROM FALLOS_TECNICOS A
    LEFT JOIN CATALOGO_TIPO_PROBLEMA B ON (B.ID = A.TIPO_PROBLEMA_ID)
    LEFT JOIN DEPARTAMENTOS_RESPONSABLES C ON (C.ID = A.DEPARTAMENTO_ID)
    LEFT JOIN SITIOS D ON (D.ID = A.SITIO_ID)
    LEFT JOIN HACIENDA E ON (E.ID = D.HACIENDA_ID)
    LEFT JOIN CLIENTES F ON (F.ID = D.CLIENTE_ID)
    LEFT JOIN HIK_CAMERA_RESOURCE_STATUS CAM ON (CAM.ID = A.CAMERA_ID)
    LEFT JOIN HIK_ENCODING_DEVICE_STATUS ENC ON (ENC.ID = A.ENCODING_DEVICE_ID)
    LEFT JOIN HIK_IP_SPEAKER_STATUS SPK ON (SPK.ID = A.IP_SPEAKER_ID)
    LEFT JOIN HIK_ALARM_INPUT_STATUS ALM ON (ALM.ID = A.ALARM_INPUT_ID)
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
        COUNT(1) AS TOTAL,
        STRING_AGG(DISTINCT A.NOMBRE_EQUIPO, ', ' ORDER BY A.NOMBRE_EQUIPO) AS EQUIPOS
    FROM BASE A
    WHERE A.ES_PENDIENTE = 1
    GROUP BY (COALESCE(A.TIPO_AFECTACION, '') || ' ' || COALESCE(A.TIPO_PROBLEMA, '')), A.HACIENDA
),
TABLA_DEPARTAMENTO AS (
    SELECT
        A.DEPARTAMENTO,
        COUNT(1) FILTER (WHERE A.ES_PENDIENTE = 1) AS FALLOS_PENDIENTES,
        COUNT(1) FILTER (WHERE A.ES_RESUELTO = 1) AS FALLOS_RESUELTOS,
        AVG(CASE WHEN A.ES_RESUELTO = 1 THEN A.DIAS_SOLUCION ELSE NULL END) AS T_PROM_SOLUCION_DIAS
    FROM BASE A
    GROUP BY A.DEPARTAMENTO
),
TABLA_DEPARTAMENTO_ARBOL AS (
    SELECT
        A.DEPARTAMENTO_ID,
        A.DEPARTAMENTO,
        A.CLIENTE_ID,
        A.CLIENTE,
        A.HACIENDA_ID,
        A.HACIENDA,
        A.SITIO_ID,
        A.SITIO,
        COUNT(1) FILTER (WHERE A.ES_PENDIENTE = 1) AS FALLOS_PENDIENTES,
        COUNT(1) FILTER (WHERE A.ES_RESUELTO = 1) AS FALLOS_RESUELTOS,
        SUM(CASE WHEN A.ES_RESUELTO = 1 THEN A.DIAS_SOLUCION ELSE 0 END) AS SUM_DIAS_SOLUCION,
        COUNT(1) FILTER (WHERE A.ES_RESUELTO = 1) AS COUNT_RESUELTOS
    FROM BASE A
    GROUP BY
        A.DEPARTAMENTO_ID,
        A.DEPARTAMENTO,
        A.CLIENTE_ID,
        A.CLIENTE,
        A.HACIENDA_ID,
        A.HACIENDA,
        A.SITIO_ID,
        A.SITIO
),
TENDENCIA_MES AS (
    SELECT
        TO_CHAR(A.FECHA::DATE, 'YYYY-MM') AS MES,
        COUNT(1) FILTER (WHERE A.ES_PENDIENTE = 1) AS FALLOS_PENDIENTES,
        COUNT(1) FILTER (WHERE A.ES_RESUELTO = 1) AS FALLOS_RESUELTOS,
        COALESCE(
            AVG(CASE WHEN A.ES_RESUELTO = 1 THEN A.DIAS_SOLUCION ELSE NULL END),
            0
        ) AS T_PROM_SOLUCION_DIAS
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
        'tabla_departamentos', (
            SELECT COALESCE(
                JSON_AGG(
                    JSON_BUILD_OBJECT(
                        'departamento', TD.DEPARTAMENTO,
                        'fallos_pendientes', TD.FALLOS_PENDIENTES,
                        'fallos_resueltos', TD.FALLOS_RESUELTOS,
                        'porc_resueltos',
                        CASE
                            WHEN (TD.FALLOS_PENDIENTES + TD.FALLOS_RESUELTOS) > 0
                            THEN (TD.FALLOS_RESUELTOS::DECIMAL / (TD.FALLOS_PENDIENTES + TD.FALLOS_RESUELTOS)) * 100
                            ELSE 0
                        END,
                        't_prom_solucion_dias', TD.T_PROM_SOLUCION_DIAS
                    )
                    ORDER BY TD.FALLOS_PENDIENTES DESC, TD.FALLOS_RESUELTOS DESC, TD.DEPARTAMENTO ASC
                ),
                '[]'::JSON
            )
            FROM TABLA_DEPARTAMENTO TD
        ),
        'tabla_departamentos_arbol', (
            SELECT COALESCE(
                JSON_AGG(
                    JSON_BUILD_OBJECT(
                        'departamento_id', TDA.DEPARTAMENTO_ID,
                        'departamento_nombre', TDA.DEPARTAMENTO,
                        'cliente_id', TDA.CLIENTE_ID,
                        'cliente_nombre', TDA.CLIENTE,
                        'hacienda_id', TDA.HACIENDA_ID,
                        'hacienda_nombre', TDA.HACIENDA,
                        'sitio_id', TDA.SITIO_ID,
                        'sitio_nombre', TDA.SITIO,
                        'fallos_pendientes', TDA.FALLOS_PENDIENTES,
                        'fallos_resueltos', TDA.FALLOS_RESUELTOS,
                        'sum_dias_solucion', TDA.SUM_DIAS_SOLUCION,
                        'count_resueltos', TDA.COUNT_RESUELTOS
                    )
                    ORDER BY
                        TDA.DEPARTAMENTO ASC,
                        TDA.CLIENTE ASC,
                        TDA.HACIENDA ASC,
                        TDA.SITIO ASC
                ),
                '[]'::JSON
            )
            FROM TABLA_DEPARTAMENTO_ARBOL TDA
        ),
        'tendencia_pendientes_mes', (
            SELECT COALESCE(
                JSON_AGG(
                    JSON_BUILD_OBJECT(
                        'mes', TM.MES,
                        'fallos_pendientes', TM.FALLOS_PENDIENTES,
                        'fallos_resueltos', TM.FALLOS_RESUELTOS,
                        't_prom_solucion_dias', TM.T_PROM_SOLUCION_DIAS
                    )
                    ORDER BY TM.MES
                ),
                '[]'::JSON
            )
            FROM TENDENCIA_MES TM
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
