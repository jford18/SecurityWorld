import { pool } from "../db.js";

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
    return true;
  }

  if (falsy.includes(normalized)) {
    return false;
  }

  return undefined;
};

const reportadoBooleanSqlExpression = (alias) =>
  `COALESCE(${alias}.reportado_al_cliente, FALSE)`;


const KPI_QUERY = (reportadoFilterSql = "") => `
WITH PARAMS AS (
    SELECT
        $1::TIMESTAMP AS FROM_TS,
        $2::TIMESTAMP AS TO_TS,
        $3::INT AS HACIENDA_ID,
        $4::INT AS CLIENTE_ID
),
SITE_CAMERAS AS (
    SELECT
        A.SITE_NAME,
        COUNT(*)::INT AS N_CAMARAS
    FROM PUBLIC.HIK_CAMERA_RESOURCE_STATUS A
    WHERE A.SITE_NAME IS NOT NULL
      AND TRIM(A.SITE_NAME) <> ''
    GROUP BY A.SITE_NAME
),
CAMERAS AS (
    SELECT
        COUNT(DISTINCT A.DEVICE_CODE) AS CAMARAS
    FROM PUBLIC.HIK_CAMERA_RESOURCE_STATUS A
    LEFT JOIN PUBLIC.SITIOS B ON (B.NOMBRE = A.SITE_NAME)
    LEFT JOIN PUBLIC.HACIENDA C ON (C.ID = B.HACIENDA_ID)
    JOIN PARAMS D ON (1 = 1)
    WHERE A.DEVICE_CODE IS NOT NULL
      AND (D.HACIENDA_ID IS NULL OR C.ID = D.HACIENDA_ID)
      AND (D.CLIENTE_ID IS NULL OR B.CLIENTE_ID = D.CLIENTE_ID)
),
INCIDENTS AS (
    SELECT
        A.ID,
        A.CAMERA_ID,
        A.SITIO_ID,
        COALESCE(S.NOMBRE, S_FALLBACK.NOMBRE, B.SITE_NAME) AS SITE_NAME,
        (A.FECHA::TIMESTAMP + COALESCE(A.HORA, '00:00:00'::TIME)) AS START_TS,
        COALESCE(
            (COALESCE(A.FECHA_RESOLUCION, NOW()::DATE)::TIMESTAMP + COALESCE(A.HORA_RESOLUCION, NOW()::TIME)),
            NOW()::TIMESTAMP
        ) AS END_TS
    FROM PUBLIC.FALLOS_TECNICOS A
    LEFT JOIN PUBLIC.HIK_CAMERA_RESOURCE_STATUS B ON (B.ID = A.CAMERA_ID)
    LEFT JOIN PUBLIC.SITIOS S ON (S.ID = A.SITIO_ID)
    LEFT JOIN PUBLIC.SITIOS S_FALLBACK ON (A.SITIO_ID IS NULL AND S_FALLBACK.NOMBRE = B.SITE_NAME)
    WHERE A.FECHA IS NOT NULL
    ${reportadoFilterSql}
),
DOWNTIME AS (
    SELECT
        SUM(
            GREATEST(
                0,
                EXTRACT(
                    EPOCH FROM (
                        LEAST(A.END_TS, D.TO_TS)
                        - GREATEST(A.START_TS, D.FROM_TS)
                    )
                ) / 3600.0
            )
            * COALESCE(C.N_CAMARAS, 0)
        )::NUMERIC(18,2) AS T_CAIDO_H
    FROM INCIDENTS A
    LEFT JOIN PUBLIC.SITIOS S ON (S.NOMBRE = A.SITE_NAME)
    LEFT JOIN PUBLIC.HACIENDA H ON (H.ID = S.HACIENDA_ID)
    LEFT JOIN SITE_CAMERAS C ON (C.SITE_NAME = A.SITE_NAME)
    JOIN PARAMS D ON (1 = 1)
    WHERE A.END_TS > D.FROM_TS
      AND A.START_TS < D.TO_TS
      AND (D.HACIENDA_ID IS NULL OR H.ID = D.HACIENDA_ID)
      AND (D.CLIENTE_ID IS NULL OR S.CLIENTE_ID = D.CLIENTE_ID)
),
KPI AS (
    SELECT
        A.CAMARAS,
        (DATE(D.TO_TS) - DATE(D.FROM_TS) + 1)::INT AS DIAS,
        ((DATE(D.TO_TS) - DATE(D.FROM_TS) + 1)::INT * 24 * A.CAMARAS)::NUMERIC(18,2) AS T_DISPONIBLE_H,
        COALESCE(B.T_CAIDO_H, 0)::NUMERIC(18,2) AS T_CAIDO_H
    FROM CAMERAS A
    JOIN PARAMS D ON (1 = 1)
    LEFT JOIN DOWNTIME B ON (1 = 1)
)
SELECT
    A.DIAS,
    A.CAMARAS,
    A.T_DISPONIBLE_H,
    A.T_CAIDO_H,
    CASE
        WHEN A.T_DISPONIBLE_H <= 0 THEN 0
        ELSE ROUND((1 - (A.T_CAIDO_H / A.T_DISPONIBLE_H)) * 100, 2)
    END AS UPTIME_PCT
FROM KPI A;
`;

const DETAIL_QUERY = (reportadoFilterSql = "") => `
WITH PARAMS AS (
    SELECT
        $1::TIMESTAMP AS FROM_TS,
        $2::TIMESTAMP AS TO_TS,
        $3::INT AS HACIENDA_ID,
        $4::INT AS CLIENTE_ID
),
SITE_CAMERAS AS (
    SELECT
        A.SITE_NAME,
        COUNT(*)::INT AS N_CAMARAS
    FROM PUBLIC.HIK_CAMERA_RESOURCE_STATUS A
    WHERE A.SITE_NAME IS NOT NULL
      AND TRIM(A.SITE_NAME) <> ''
    GROUP BY A.SITE_NAME
),
INCIDENTS AS (
    SELECT
        A.ID,
        A.CAMERA_ID,
        A.SITIO_ID,
        COALESCE(A.TIPO_AFECTACION, 'SIN INFORMACION') AS TIPO_AFECTACION,
        COALESCE(S.NOMBRE, S_FALLBACK.NOMBRE, B.SITE_NAME) AS SITE_NAME,
        COALESCE(S.DESCRIPCION, S_FALLBACK.DESCRIPCION, B.SITE_NAME, 'SIN SITIO') AS SITIO_AFECTADO_FINAL,
        COALESCE(H.NOMBRE, 'SIN HACIENDA') AS HACIENDA,
        (A.FECHA::TIMESTAMP + COALESCE(A.HORA, '00:00:00'::TIME)) AS START_TS,
        COALESCE(
            (COALESCE(A.FECHA_RESOLUCION, NOW()::DATE)::TIMESTAMP + COALESCE(A.HORA_RESOLUCION, NOW()::TIME)),
            NOW()::TIMESTAMP
        ) AS END_TS
    FROM PUBLIC.FALLOS_TECNICOS A
    LEFT JOIN PUBLIC.HIK_CAMERA_RESOURCE_STATUS B ON (B.ID = A.CAMERA_ID)
    LEFT JOIN PUBLIC.SITIOS S ON (S.ID = A.SITIO_ID)
    LEFT JOIN PUBLIC.SITIOS S_FALLBACK ON (A.SITIO_ID IS NULL AND S_FALLBACK.NOMBRE = B.SITE_NAME)
    LEFT JOIN PUBLIC.HACIENDA H ON (H.ID = COALESCE(S.HACIENDA_ID, S_FALLBACK.HACIENDA_ID))
    WHERE A.FECHA IS NOT NULL
    ${reportadoFilterSql}
),
BASE AS (
    SELECT
        EXTRACT(MONTH FROM A.START_TS)::INT AS MES,
        A.TIPO_AFECTACION,
        COALESCE(A.SITE_NAME, 'SIN SITIO') AS SITE_NAME,
        A.SITIO_AFECTADO_FINAL,
        A.HACIENDA,
        A.START_TS,
        A.END_TS,
        ROUND(
            GREATEST(
                0,
                EXTRACT(
                    EPOCH FROM (
                        LEAST(A.END_TS, P.TO_TS)
                        - GREATEST(A.START_TS, P.FROM_TS)
                    )
                ) / 3600.0
            )::NUMERIC,
            2
        ) AS TIEMPO_TOTAL_FALLO_H,
        COALESCE(C.N_CAMARAS, 0)::INT AS N_CAMARAS,
        ROUND(
            (
                GREATEST(
                    0,
                    EXTRACT(
                        EPOCH FROM (
                            LEAST(A.END_TS, P.TO_TS)
                            - GREATEST(A.START_TS, P.FROM_TS)
                        )
                    ) / 3600.0
                ) * COALESCE(C.N_CAMARAS, 0)
            )::NUMERIC,
            2
        ) AS TIEMPO_OFFLINE_H
    FROM INCIDENTS A
    JOIN PARAMS P ON (1 = 1)
    LEFT JOIN SITE_CAMERAS C ON (C.SITE_NAME = A.SITE_NAME)
    LEFT JOIN PUBLIC.SITIOS S ON (S.NOMBRE = A.SITE_NAME)
    WHERE A.END_TS > P.FROM_TS
      AND A.START_TS < P.TO_TS
      AND (P.HACIENDA_ID IS NULL OR S.HACIENDA_ID = P.HACIENDA_ID)
      AND (P.CLIENTE_ID IS NULL OR S.CLIENTE_ID = P.CLIENTE_ID)
),
AGR AS (
    SELECT
        MES,
        TIPO_AFECTACION,
        SITE_NAME,
        MAX(SITIO_AFECTADO_FINAL) AS SITIO_AFECTADO_FINAL,
        MAX(HACIENDA) AS HACIENDA,
        MIN(START_TS) AS INICIO,
        MAX(END_TS) AS FIN,
        SUM(TIEMPO_TOTAL_FALLO_H)::NUMERIC(18,2) AS TIEMPO_TOTAL_FALLO_H,
        SUM(TIEMPO_OFFLINE_H)::NUMERIC(18,2) AS TIEMPO_OFFLINE_H,
        SUM(N_CAMARAS)::INT AS N_CAMARAS
    FROM BASE
    GROUP BY MES, TIPO_AFECTACION, SITE_NAME
)
SELECT
    A.MES,
    (
        'MAN-'
        || TO_CHAR(A.INICIO, 'YYYYMMDDHH24MI')
        || '-'
        || REGEXP_REPLACE(COALESCE(A.SITE_NAME, 'SIN-SITIO'), '\\s+', '', 'g')
        || '-'
        || REGEXP_REPLACE(COALESCE(A.TIPO_AFECTACION, 'SIN-INFO'), '\\s+', '', 'g')
    ) AS ID,
    A.TIPO_AFECTACION,
    A.SITIO_AFECTADO_FINAL,
    A.SITE_NAME,
    A.INICIO::DATE AS FECHA_FALLO,
    A.INICIO::TIME AS HORA_FALLO,
    A.FIN::DATE AS FECHA_RECUPERACION,
    A.FIN::TIME AS HORA_RECUPERACION,
    A.TIEMPO_TOTAL_FALLO_H,
    A.TIEMPO_OFFLINE_H,
    CASE
        WHEN A.N_CAMARAS <= 0 THEN 0
        ELSE ROUND((A.TIEMPO_OFFLINE_H / A.N_CAMARAS)::NUMERIC, 2)
    END AS TIEMPO_OFFLINE_POR_CAMARA_H,
    A.N_CAMARAS,
    A.HACIENDA
FROM AGR A
ORDER BY A.INICIO DESC;
`;

export const getDashboardUptimeCamarasManual = async (req, res) => {
  try {
    const { from, to, hacienda_id: haciendaIdRaw, cliente_id: clienteIdRaw, reportado_cliente } =
      req.query;

    if (!from || !to) {
      return res.status(400).json({ message: "Los parámetros 'from' y 'to' son obligatorios" });
    }

    const parsedHaciendaId =
      haciendaIdRaw === undefined || haciendaIdRaw === null || haciendaIdRaw === ""
        ? null
        : Number(haciendaIdRaw);

    if (haciendaIdRaw && (Number.isNaN(parsedHaciendaId) || parsedHaciendaId <= 0)) {
      return res.status(400).json({ message: "El parámetro 'hacienda_id' debe ser un número válido" });
    }

    const parsedClienteId =
      clienteIdRaw === undefined || clienteIdRaw === null || clienteIdRaw === ""
        ? null
        : Number(clienteIdRaw);

    if (clienteIdRaw && (Number.isNaN(parsedClienteId) || parsedClienteId <= 0)) {
      return res.status(400).json({ message: "El parámetro 'cliente_id' debe ser un número válido" });
    }

    const reportadoClienteValues = normalizeReportadoClienteFilter(reportado_cliente);

    if (reportado_cliente && reportadoClienteValues === undefined) {
      return res.status(400).json({ message: "El parámetro 'reportado_cliente' debe ser válido" });
    }

    const fromTs = `${from} 00:00:00`;
    const toTs = `${to} 23:59:59`;

    const kpiParams = [fromTs, toTs, parsedHaciendaId, parsedClienteId];
    const detalleParams = [fromTs, toTs, parsedHaciendaId, parsedClienteId];
    const reportadoFilterSql =
      reportadoClienteValues !== null
        ? `AND ${reportadoBooleanSqlExpression('A')} = $5`
        : "";

    if (reportadoFilterSql) {
      kpiParams.push(reportadoClienteValues);
      detalleParams.push(reportadoClienteValues);
    }

    console.log("[UPTIME-CAMARAS-MANUAL] SQL =>", KPI_QUERY(reportadoFilterSql));
    console.log("[UPTIME-CAMARAS-MANUAL] PARAMS =>", kpiParams);
    console.log("[UPTIME-CAMARAS-MANUAL] SQL =>", DETAIL_QUERY(reportadoFilterSql));
    console.log("[UPTIME-CAMARAS-MANUAL] PARAMS =>", detalleParams);

    const [kpiResult, detalleResult] = await Promise.all([
      pool.query(KPI_QUERY(reportadoFilterSql), kpiParams),
      pool.query(DETAIL_QUERY(reportadoFilterSql), detalleParams),
    ]);

    const kpis = kpiResult.rows[0] ?? {
      dias: 0,
      camaras: 0,
      t_disponible_h: 0,
      t_caido_h: 0,
      uptime_pct: 0,
    };

    return res.json({
      kpis,
      detalle: detalleResult.rows ?? [],
    });
  } catch (error) {
    console.error("[API][ERROR] /api/dashboards/uptime-camaras-manual:", error);
    return res.status(500).json({
      message: "Error al obtener el dashboard de uptime de cámaras (manual)",
      details: error.message,
    });
  }
};
