import { pool } from "../db.js";

const KPI_QUERY = `
WITH PARAMS AS (
    SELECT
        $1::TIMESTAMP AS FROM_TS,
        $2::TIMESTAMP AS TO_TS,
        $3::INT AS HACIENDA_ID
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
),
DOWNTIME AS (
    SELECT
        SUM(
            GREATEST(
                0,
                EXTRACT(
                    EPOCH FROM (
                        LEAST(COALESCE(A.OFFLINE_END_AT, NOW()::TIMESTAMP), D.TO_TS)
                        - GREATEST(A.OFFLINE_START_AT, D.FROM_TS)
                    )
                ) / 3600.0
            )
        )::NUMERIC(18,2) AS T_CAIDO_H
    FROM PUBLIC.VW_HIK_CAMERA_OFFLINE A
    LEFT JOIN PUBLIC.SITIOS B ON (B.NOMBRE = A.SITE_NAME)
    LEFT JOIN PUBLIC.HACIENDA C ON (C.ID = B.HACIENDA_ID)
    JOIN PARAMS D ON (1 = 1)
    WHERE A.OFFLINE_START_AT < D.TO_TS
      AND COALESCE(A.OFFLINE_END_AT, NOW()::TIMESTAMP) > D.FROM_TS
      AND (D.HACIENDA_ID IS NULL OR C.ID = D.HACIENDA_ID)
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

const DETAIL_QUERY = `
WITH PARAMS AS (
    SELECT
        $1::TIMESTAMP AS FROM_TS,
        $2::TIMESTAMP AS TO_TS,
        $3::INT AS HACIENDA_ID
),
OFFLINE AS (
    SELECT
        A.DEVICE_CODE,
        A.SITE_NAME,
        A.OFFLINE_START_AT,
        COALESCE(A.OFFLINE_END_AT, NOW()::TIMESTAMP) AS OFFLINE_END_AT,
        ROUND(
            GREATEST(
                0,
                EXTRACT(
                    EPOCH FROM (
                        LEAST(COALESCE(A.OFFLINE_END_AT, NOW()::TIMESTAMP), B.TO_TS)
                        - GREATEST(A.OFFLINE_START_AT, B.FROM_TS)
                    )
                ) / 3600.0
            )::NUMERIC,
            2
        ) AS TIEMPO_OFFLINE_H
    FROM PUBLIC.VW_HIK_CAMERA_OFFLINE A
    JOIN PARAMS B ON (1 = 1)
    LEFT JOIN PUBLIC.SITIOS C ON (C.NOMBRE = A.SITE_NAME)
    LEFT JOIN PUBLIC.HACIENDA D ON (D.ID = C.HACIENDA_ID)
    WHERE A.OFFLINE_START_AT < B.TO_TS
      AND COALESCE(A.OFFLINE_END_AT, NOW()::TIMESTAMP) > B.FROM_TS
      AND (B.HACIENDA_ID IS NULL OR D.ID = B.HACIENDA_ID)
),
AGR AS (
    SELECT
        EXTRACT(MONTH FROM A.OFFLINE_START_AT)::INT AS MES,
        A.SITE_NAME,
        DATE_TRUNC('minute', A.OFFLINE_START_AT) AS INICIO,
        DATE_TRUNC('minute', A.OFFLINE_END_AT) AS FIN,
        SUM(A.TIEMPO_OFFLINE_H)::NUMERIC(18,2) AS TIEMPO_OFFLINE_H,
        COUNT(DISTINCT A.DEVICE_CODE) AS N_CAMARAS
    FROM OFFLINE A
    GROUP BY
        EXTRACT(MONTH FROM A.OFFLINE_START_AT)::INT,
        A.SITE_NAME,
        DATE_TRUNC('minute', A.OFFLINE_START_AT),
        DATE_TRUNC('minute', A.OFFLINE_END_AT)
)
SELECT
    A.MES,
    ('CAM-' || TO_CHAR(A.INICIO, 'YYYYMMDDHH24MI') || '-' || REGEXP_REPLACE(A.SITE_NAME, '\\s+', '', 'g')) AS ID,
    A.SITE_NAME AS SITIO_AFECTADO_FINAL,
    A.INICIO::DATE AS FECHA_FALLO,
    A.INICIO::TIME AS HORA_FALLO,
    A.FIN::DATE AS FECHA_RECUPERACION,
    A.FIN::TIME AS HORA_RECUPERACION,
    A.TIEMPO_OFFLINE_H,
    A.N_CAMARAS,
    COALESCE(D.NOMBRE, 'SIN HACIENDA') AS HACIENDA
FROM AGR A
LEFT JOIN PUBLIC.SITIOS B ON (B.NOMBRE = A.SITE_NAME)
LEFT JOIN PUBLIC.HACIENDA D ON (D.ID = B.HACIENDA_ID)
ORDER BY A.INICIO DESC;
`;

export const getDashboardUptimeCamaras = async (req, res) => {
  try {
    const { from, to, hacienda_id: haciendaIdRaw } = req.query;

    if (!from || !to) {
      return res.status(400).json({ message: "Los parámetros 'from' y 'to' son obligatorios" });
    }

    const parsedHaciendaId =
      haciendaIdRaw === undefined || haciendaIdRaw === null || haciendaIdRaw === ''
        ? null
        : Number(haciendaIdRaw);

    if (haciendaIdRaw && (Number.isNaN(parsedHaciendaId) || parsedHaciendaId <= 0)) {
      return res.status(400).json({ message: "El parámetro 'hacienda_id' debe ser un número válido" });
    }

    const fromTs = `${from} 00:00:00`;
    const toTs = `${to} 23:59:59`;

    const [kpiResult, detalleResult] = await Promise.all([
      pool.query(KPI_QUERY, [fromTs, toTs, parsedHaciendaId]),
      pool.query(DETAIL_QUERY, [fromTs, toTs, parsedHaciendaId]),
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
    console.error("[API][ERROR] /api/dashboards/uptime-camaras:", error);
    return res.status(500).json({
      message: "Error al obtener el dashboard de uptime de cámaras",
      details: error.message,
    });
  }
};
