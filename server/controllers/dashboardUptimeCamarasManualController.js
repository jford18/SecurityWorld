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
INCIDENTS AS (
    SELECT
        A.ID,
        A.CAMERA_ID,
        A.SITIO_ID,
        (A.FECHA::TIMESTAMP + COALESCE(A.HORA, '00:00:00'::TIME)) AS START_TS,
        COALESCE(
            (COALESCE(A.FECHA_RESOLUCION, NOW()::DATE)::TIMESTAMP + COALESCE(A.HORA_RESOLUCION, NOW()::TIME)),
            NOW()::TIMESTAMP
        ) AS END_TS
    FROM PUBLIC.FALLOS_TECNICOS A
    WHERE A.CAMERA_ID IS NOT NULL
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
        )::NUMERIC(18,2) AS T_CAIDO_H
    FROM INCIDENTS A
    LEFT JOIN PUBLIC.HIK_CAMERA_RESOURCE_STATUS B ON (B.ID = A.CAMERA_ID)
    LEFT JOIN PUBLIC.SITIOS S ON (S.ID = A.SITIO_ID)
    LEFT JOIN PUBLIC.SITIOS S_FALLBACK ON (A.SITIO_ID IS NULL AND S_FALLBACK.NOMBRE = B.SITE_NAME)
    LEFT JOIN PUBLIC.HACIENDA H ON (H.ID = COALESCE(S.HACIENDA_ID, S_FALLBACK.HACIENDA_ID))
    JOIN PARAMS D ON (1 = 1)
    WHERE A.END_TS > D.FROM_TS
      AND A.START_TS < D.TO_TS
      AND (D.HACIENDA_ID IS NULL OR H.ID = D.HACIENDA_ID)
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
INCIDENTS AS (
    SELECT
        A.ID,
        A.CAMERA_ID,
        A.SITIO_ID,
        (A.FECHA::TIMESTAMP + COALESCE(A.HORA, '00:00:00'::TIME)) AS START_TS,
        COALESCE(
            (COALESCE(A.FECHA_RESOLUCION, NOW()::DATE)::TIMESTAMP + COALESCE(A.HORA_RESOLUCION, NOW()::TIME)),
            NOW()::TIMESTAMP
        ) AS END_TS
    FROM PUBLIC.FALLOS_TECNICOS A
    WHERE A.CAMERA_ID IS NOT NULL
)
SELECT
    EXTRACT(MONTH FROM A.START_TS)::INT AS MES,
    (
        'MAN-'
        || TO_CHAR(A.START_TS, 'YYYYMMDDHH24MI')
        || '-'
        || COALESCE(B.DEVICE_CODE, 'NA')
        || '-'
        || COALESCE(A.ID::TEXT, 'NA')
    ) AS ID,
    COALESCE(B.CAMERA_NAME, 'SIN NOMBRE') AS CAMARA,
    COALESCE(S.DESCRIPCION, S_FALLBACK.DESCRIPCION, B.SITE_NAME, 'SIN SITIO') AS SITIO_AFECTADO_FINAL,
    A.START_TS::DATE AS FECHA_FALLO,
    A.START_TS::TIME AS HORA_FALLO,
    A.END_TS::DATE AS FECHA_RECUPERACION,
    A.END_TS::TIME AS HORA_RECUPERACION,
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
    ) AS TIEMPO_OFFLINE_H,
    1 AS N_CAMARAS,
    COALESCE(H.NOMBRE, 'SIN HACIENDA') AS HACIENDA
FROM INCIDENTS A
JOIN PARAMS P ON (1 = 1)
LEFT JOIN PUBLIC.HIK_CAMERA_RESOURCE_STATUS B ON (B.ID = A.CAMERA_ID)
LEFT JOIN PUBLIC.SITIOS S ON (S.ID = A.SITIO_ID)
LEFT JOIN PUBLIC.SITIOS S_FALLBACK ON (A.SITIO_ID IS NULL AND S_FALLBACK.NOMBRE = B.SITE_NAME)
LEFT JOIN PUBLIC.HACIENDA H ON (H.ID = COALESCE(S.HACIENDA_ID, S_FALLBACK.HACIENDA_ID))
WHERE A.END_TS > P.FROM_TS
  AND A.START_TS < P.TO_TS
  AND (P.HACIENDA_ID IS NULL OR H.ID = P.HACIENDA_ID)
ORDER BY A.START_TS DESC;
`;

export const getDashboardUptimeCamarasManual = async (req, res) => {
  try {
    const { from, to, hacienda_id: haciendaIdRaw } = req.query;

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

    const fromTs = `${from} 00:00:00`;
    const toTs = `${to} 23:59:59`;

    const kpiParams = [fromTs, toTs, parsedHaciendaId];
    const detalleParams = [fromTs, toTs, parsedHaciendaId];

    console.log("[UPTIME-CAMARAS-MANUAL] SQL =>", KPI_QUERY);
    console.log("[UPTIME-CAMARAS-MANUAL] PARAMS =>", kpiParams);
    console.log("[UPTIME-CAMARAS-MANUAL] SQL =>", DETAIL_QUERY);
    console.log("[UPTIME-CAMARAS-MANUAL] PARAMS =>", detalleParams);

    const [kpiResult, detalleResult] = await Promise.all([
      pool.query(KPI_QUERY, kpiParams),
      pool.query(DETAIL_QUERY, detalleParams),
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
