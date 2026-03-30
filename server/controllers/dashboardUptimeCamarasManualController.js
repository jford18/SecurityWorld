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

const TIPO_PROBLEMA_OBJETIVO = "PÉRDIDA DE VISUAL";
const DEBUG_DISTINCT_TIPO_PROBLEMA_QUERY = `
SELECT DISTINCT
    tipo_problema_id
FROM fallos_tecnicos
ORDER BY tipo_problema_id;
`;

const DEBUG_CATALOGO_QUERY = `
SELECT id, descripcion
FROM catalogo_tipo_problema
ORDER BY id;
`;


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
        A.TIPO_PROBLEMA_ID,
        COALESCE(S.NOMBRE, S_FALLBACK.NOMBRE, B.SITE_NAME) AS SITE_NAME,
        A.FECHA_CREACION AS START_TS,
        COALESCE(
            CASE
                WHEN A.FECHA_RESOLUCION IS NOT NULL AND A.HORA_RESOLUCION IS NOT NULL THEN
                    (A.FECHA_RESOLUCION::TIMESTAMP + A.HORA_RESOLUCION)
                ELSE NULL
            END,
            NOW()::TIMESTAMP
        ) AS END_TS
    FROM PUBLIC.FALLOS_TECNICOS A
    LEFT JOIN PUBLIC.HIK_CAMERA_RESOURCE_STATUS B ON (B.ID = A.CAMERA_ID)
    LEFT JOIN PUBLIC.SITIOS S ON (S.ID = A.SITIO_ID)
    LEFT JOIN PUBLIC.SITIOS S_FALLBACK ON (A.SITIO_ID IS NULL AND S_FALLBACK.NOMBRE = B.SITE_NAME)
    LEFT JOIN PUBLIC.CATALOGO_TIPO_PROBLEMA C ON (C.ID = A.TIPO_PROBLEMA_ID)
    WHERE A.FECHA_CREACION IS NOT NULL
      AND UPPER(TRIM(C.DESCRIPCION)) = UPPER(TRIM($5))
    ${reportadoFilterSql}
),
KPI AS (
    SELECT
        A.CAMARAS,
        (DATE(D.TO_TS) - DATE(D.FROM_TS) + 1)::INT AS DIAS,
        ((DATE(D.TO_TS) - DATE(D.FROM_TS) + 1)::INT * 24 * A.CAMARAS)::NUMERIC(18,2) AS T_DISPONIBLE_H
    FROM CAMERAS A
    JOIN PARAMS D ON (1 = 1)
)
SELECT
    A.DIAS,
    A.CAMARAS,
    A.T_DISPONIBLE_H,
    0::NUMERIC(18,2) AS T_CAIDO_H,
    0::NUMERIC(18,2) AS UPTIME_PCT
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
CAMERAS_BY_SITE AS (
    SELECT
        A.SITE_NAME,
        COUNT(DISTINCT A.DEVICE_CODE) AS N_CAMARAS
    FROM PUBLIC.HIK_CAMERA_RESOURCE_STATUS A
    WHERE A.DEVICE_CODE IS NOT NULL
    GROUP BY A.SITE_NAME
),
TOTAL_CAMERAS AS (
    SELECT
        COUNT(DISTINCT DEVICE_CODE) AS TOTAL
    FROM PUBLIC.HIK_CAMERA_RESOURCE_STATUS
    WHERE DEVICE_CODE IS NOT NULL
),
DETAIL_BASE AS (
    SELECT
        A.ID,
        TO_CHAR(A.FECHA_CREACION, 'YYYY-MM') AS MES,
        CASE
            WHEN UPPER(A.TIPO_AFECTACION) = 'EQUIPO' THEN 'Equipo'
            WHEN UPPER(A.TIPO_AFECTACION) = 'PUNTO' THEN 'Punto'
            WHEN UPPER(A.TIPO_AFECTACION) = 'NODO' THEN 'Nodo'
            WHEN UPPER(A.TIPO_AFECTACION) = 'MASIVO' THEN 'Masivo'
            ELSE A.TIPO_AFECTACION
        END AS TIPO_AFECTACION,
        B.NOMBRE AS SITIO,
        A.FECHA_CREACION AS FECHA_FALLO,
        A.FECHA_RESOLUCION,
        A.HORA_RESOLUCION,
        C.DESCRIPCION AS TIPO_PROBLEMA,
        EXTRACT(
            EPOCH FROM (
                (
                    COALESCE(
                        (A.FECHA_RESOLUCION::TIMESTAMP + A.HORA_RESOLUCION),
                        NOW()
                    )
                    - A.FECHA_CREACION
                )
            )
        ) / 3600.0 AS DURACION_TOTAL_H,
        CASE
            WHEN UPPER(A.TIPO_AFECTACION) = 'EQUIPO' THEN 1
            WHEN UPPER(A.TIPO_AFECTACION) = 'PUNTO' THEN COALESCE(CS.N_CAMARAS, 0)
            WHEN UPPER(A.TIPO_AFECTACION) = 'NODO' THEN COALESCE((
                SELECT SUM(COALESCE(CS2.N_CAMARAS, 0))
                FROM NODOS_SITIOS NS
                JOIN SITIOS S2 ON (S2.ID = NS.SITIO_ID)
                LEFT JOIN CAMERAS_BY_SITE CS2 ON (CS2.SITE_NAME = S2.NOMBRE)
                WHERE NS.NODO_ID = (
                    SELECT N.ID
                    FROM NODOS N
                    WHERE UPPER(TRIM(N.NOMBRE)) = UPPER(TRIM(A.EQUIPO_AFECTADO))
                    LIMIT 1
                )
            ), 0)
            WHEN UPPER(A.TIPO_AFECTACION) = 'MASIVO' THEN (SELECT TOTAL FROM TOTAL_CAMERAS)
            ELSE 0
        END AS N_CAMARAS
    FROM PUBLIC.FALLOS_TECNICOS A
    LEFT JOIN PUBLIC.SITIOS B ON (B.ID = A.SITIO_ID)
    LEFT JOIN PUBLIC.CATALOGO_TIPO_PROBLEMA C ON (C.ID = A.TIPO_PROBLEMA_ID)
    LEFT JOIN CAMERAS_BY_SITE CS ON (CS.SITE_NAME = B.NOMBRE)
    JOIN PARAMS P ON (1 = 1)
    WHERE (
        UPPER(TRIM(C.DESCRIPCION)) = UPPER(TRIM($5))
      )
      AND A.FECHA_CREACION IS NOT NULL
      AND A.FECHA_CREACION BETWEEN P.FROM_TS AND P.TO_TS
      AND (P.HACIENDA_ID IS NULL OR B.HACIENDA_ID = P.HACIENDA_ID)
      AND (P.CLIENTE_ID IS NULL OR B.CLIENTE_ID = P.CLIENTE_ID)
      ${reportadoFilterSql}
)
SELECT
    DB.*,
    (COALESCE(DB.DURACION_TOTAL_H, 0) * COALESCE(DB.N_CAMARAS, 0)) AS TIEMPO_OFFLINE_H
FROM DETAIL_BASE DB
ORDER BY DB.FECHA_FALLO DESC;
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

    const kpiParams = [
      fromTs,
      toTs,
      parsedHaciendaId,
      parsedClienteId,
      TIPO_PROBLEMA_OBJETIVO,
    ];
    const detalleParams = [
      fromTs,
      toTs,
      parsedHaciendaId,
      parsedClienteId,
      TIPO_PROBLEMA_OBJETIVO,
    ];
    const reportadoFilterSql =
      reportadoClienteValues !== null
        ? `AND ${reportadoBooleanSqlExpression('A')} = $6`
        : "";

    if (reportadoFilterSql) {
      kpiParams.push(reportadoClienteValues);
      detalleParams.push(reportadoClienteValues);
    }

    console.log("QUERY UPTIME CAMARAS:");
    console.log(DETAIL_QUERY(reportadoFilterSql));

    console.log("[UPTIME-CAMARAS-MANUAL][DEBUG] SQL DISTINCT tipo_problema_id =>", DEBUG_DISTINCT_TIPO_PROBLEMA_QUERY);
    const [distinctTipoProblemaResult, catalogoTipoProblemaResult] = await Promise.all([
      pool.query(DEBUG_DISTINCT_TIPO_PROBLEMA_QUERY),
      pool.query(DEBUG_CATALOGO_QUERY),
    ]);
    console.log("[UPTIME-CAMARAS-MANUAL][DEBUG] DISTINCT tipo_problema_id =>", distinctTipoProblemaResult.rows);
    console.log("[UPTIME-CAMARAS-MANUAL][DEBUG] catalogo_tipo_problema =>", catalogoTipoProblemaResult.rows);

    console.log("[UPTIME-CAMARAS-MANUAL] SQL =>", KPI_QUERY(reportadoFilterSql));
    console.log("[UPTIME-CAMARAS-MANUAL] PARAMS =>", kpiParams);
    console.log("[UPTIME-CAMARAS-MANUAL] SQL =>", DETAIL_QUERY(reportadoFilterSql));
    console.log("[UPTIME-CAMARAS-MANUAL] PARAMS =>", detalleParams);

    const [kpiResult, detalleResult] = await Promise.all([
      pool.query(KPI_QUERY(reportadoFilterSql), kpiParams),
      pool.query(DETAIL_QUERY(reportadoFilterSql), detalleParams),
    ]);

    console.log("[DEBUG N_CAMARAS]");
    detalleResult.rows.forEach((r) => {
      console.log(r.tipo_afectacion, r.sitio, r.n_camaras);
    });

    const kpisBase = kpiResult.rows[0] ?? {
      dias: 0,
      camaras: 0,
      t_disponible_h: 0,
      t_caido_h: 0,
      uptime_pct: 0,
    };

    const detalle = (detalleResult.rows ?? []).map((row) => {
      const fechaFallo = row.fecha_fallo;
      const falloDate = fechaFallo ? new Date(fechaFallo) : null;
      const horaFallo =
        falloDate && !Number.isNaN(falloDate.getTime()) ? falloDate.toLocaleTimeString() : "";

      return {
        ...row,
        fecha_fallo: fechaFallo,
        hora_fallo: horaFallo,
        fecha_resolucion: row.fecha_resolucion || null,
        hora_resolucion: row.hora_resolucion || null,
        duracion_total_h: Number(row.duracion_total_h) || 0,
        tiempo_offline_h: Number(row.tiempo_offline_h) || 0,
      };
    });

    const tiempoCaido = detalle.reduce((acc, row) => {
      return acc + Number(row.tiempo_offline_h || 0);
    }, 0);
    const tDisponible = Number(kpisBase.t_disponible_h) || 0;
    const uptime = tDisponible > 0 ? (1 - tiempoCaido / tDisponible) * 100 : 0;

    console.log("TIEMPO CAIDO GRID:", tiempoCaido);
    console.log(
      "FILAS:",
      detalle.map((r) => r.tiempo_offline_h),
    );

    const kpis = {
      ...kpisBase,
      t_caido_h: Number(tiempoCaido.toFixed(2)),
      uptime_pct: Number(uptime.toFixed(2)),
      tiempo_caido_h: Number(tiempoCaido.toFixed(2)),
      uptime_manual_pct: Number(uptime.toFixed(2)),
    };

    return res.json({
      kpis: {
        dias: kpis.dias,
        camaras: kpis.camaras,
        t_disponible_h: kpis.t_disponible_h,
        t_caido_h: kpis.t_caido_h,
        uptime_pct: kpis.uptime_pct,
        tiempo_caido_h: kpis.tiempo_caido_h,
        uptime_manual_pct: kpis.uptime_manual_pct,
      },
      detalle,
      data: detalle,
    });
  } catch (error) {
    console.error("[API][ERROR] /api/dashboards/uptime-camaras-manual:", error);
    return res.status(500).json({
      message: "Error al obtener el dashboard de uptime de cámaras (manual)",
      details: error.message,
    });
  }
};
