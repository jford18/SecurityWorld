import { pool } from "../db.js";

const BASE_CTE = `WITH base AS (
    SELECT
        I.ID,
        I.SITIO_ID,
    S.NOMBRE          AS SITIO_NOMBRE,
    S.latitud,
    S.longitud,
        I.TIPO            AS TIPO_INTRUSION,
        I.FECHA_EVENTO,
        I.FECHA_REACCION,
        (I.FECHA_EVENTO AT TIME ZONE 'UTC')::DATE             AS FECHA,
        EXTRACT(ISODOW FROM I.FECHA_EVENTO)                   AS DIA_SEMANA,
        EXTRACT(HOUR   FROM I.FECHA_EVENTO)                   AS HORA,
        CASE WHEN I.TIPO ILIKE 'Autorizado%' THEN 1 ELSE 0 END AS ES_AUTORIZADO,
        CASE
            WHEN I.FECHA_REACCION IS NOT NULL THEN
                EXTRACT(EPOCH FROM (I.FECHA_REACCION - I.FECHA_EVENTO)) / 60.0
            ELSE NULL
        END AS MINUTOS_REACCION
    FROM PUBLIC.INTRUSIONES I
    LEFT JOIN PUBLIC.SITIOS S ON S.ID = I.SITIO_ID
    WHERE I.FECHA_EVENTO >= $1::TIMESTAMP
      AND I.FECHA_EVENTO <  $2::TIMESTAMP
)`;

const formatDateOnly = (value) => {
  if (!value || typeof value !== "string") {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString().slice(0, 10);
};

const addOneDay = (value) => {
  const parsed = new Date(value);
  parsed.setUTCDate(parsed.getUTCDate() + 1);
  return parsed.toISOString().slice(0, 10);
};

const toNumber = (value, fallback = 0) => {
  if (value === null || value === undefined) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const toNumberOrNull = (value) => {
  if (value === null || value === undefined) {
    return null;
  }

  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
};

const mapResumenRow = (row) => {
  if (!row) {
    return null;
  }

  return {
    total_eventos: toNumber(row.total_eventos),
    porcentaje_autorizados: toNumberOrNull(row.porcentaje_autorizados),
    porcentaje_no_autorizados: toNumberOrNull(row.porcentaje_no_autorizados),
    sitios_con_eventos: toNumber(row.sitios_con_eventos),
    t_prom_reaccion_min: toNumberOrNull(row.t_prom_reaccion_min),
  };
};

const mapPorTipoRow = (row) => ({
  tipo: row?.tipo ?? row?.tipo_intrusion ?? "",
  n_eventos: toNumber(row?.n_eventos),
  n_sitios_con_evento: toNumber(row?.n_sitios_con_evento),
});

const mapPorDiaRow = (row) => ({
  fecha: row?.fecha ?? null,
  n_eventos: toNumber(row?.n_eventos),
});

const mapPorDiaSemanaTipoRow = (row) => ({
  dia_semana: toNumber(row?.dia_semana),
  tipo_intrusion: row?.tipo_intrusion ?? "",
  n_eventos: toNumber(row?.n_eventos),
});

const mapPorHoraTipoRow = (row) => ({
  hora: toNumber(row?.hora),
  tipo_intrusion: row?.tipo_intrusion ?? "",
  n_eventos: toNumber(row?.n_eventos),
});

const mapEventosPorSitioRow = (row) => ({
  sitio_id: toNumberOrNull(row?.sitio_id),
  sitio_nombre: row?.sitio_nombre ?? "",
  latitud: row?.latitud === null || row?.latitud === undefined ? null : Number(row.latitud),
  longitud: row?.longitud === null || row?.longitud === undefined ? null : Number(row.longitud),
  total_eventos: toNumber(row?.total_eventos),
});

export const getInformeMensualEventos = async (req, res) => {
  const { fechaInicio, fechaFin } = req.query ?? {};

  const fechaInicioParam = formatDateOnly(fechaInicio);
  const fechaFinParam = formatDateOnly(fechaFin);

  if (!fechaInicioParam || !fechaFinParam) {
    return res
      .status(400)
      .json({
        mensaje:
          "Debe proporcionar los parámetros fechaInicio y fechaFin en formato YYYY-MM-DD.",
      });
  }

  if (fechaFinParam < fechaInicioParam) {
    return res.status(400).json({ mensaje: "El rango de fechas no es válido." });
  }

  const fechaFinExclusive = addOneDay(`${fechaFinParam}T00:00:00Z`);

  const resumenQuery = `${BASE_CTE}
SELECT
    COUNT(*)                                           AS total_eventos,
    ROUND(100.0 * SUM(ES_AUTORIZADO) / NULLIF(COUNT(*),0), 2)          AS porcentaje_autorizados,
    ROUND(100.0 * (COUNT(*) - SUM(ES_AUTORIZADO)) / NULLIF(COUNT(*),0), 2) AS porcentaje_no_autorizados,
    COUNT(DISTINCT SITIO_ID)                          AS sitios_con_eventos,
    ROUND(AVG(MINUTOS_REACCION)::NUMERIC, 2)          AS t_prom_reaccion_min
FROM base;`;

  const porTipoQuery = `${BASE_CTE}
SELECT
    TIPO_INTRUSION                   AS tipo,
    COUNT(*)                         AS n_eventos,
    COUNT(DISTINCT SITIO_ID)         AS n_sitios_con_evento
FROM base
GROUP BY TIPO_INTRUSION
ORDER BY n_eventos DESC;`;

  const porDiaQuery = `${BASE_CTE}
SELECT
    FECHA,
    COUNT(*) AS n_eventos
FROM base
GROUP BY FECHA
ORDER BY FECHA;`;

  const porDiaSemanaTipoQuery = `${BASE_CTE}
SELECT
    DIA_SEMANA,
    TIPO_INTRUSION,
    COUNT(*) AS n_eventos
FROM base
GROUP BY DIA_SEMANA, TIPO_INTRUSION
ORDER BY DIA_SEMANA, TIPO_INTRUSION;`;

  const porHoraTipoQuery = `${BASE_CTE}
SELECT
    HORA,
    TIPO_INTRUSION,
    COUNT(*) AS n_eventos
FROM base
GROUP BY HORA, TIPO_INTRUSION
ORDER BY HORA, TIPO_INTRUSION;`;

  try {
    const queryParams = [fechaInicioParam, fechaFinExclusive];

    const [resumenResult, porTipoResult, porDiaResult, porDiaSemanaTipoResult, porHoraTipoResult] =
      await Promise.all([
        pool.query(resumenQuery, queryParams),
        pool.query(porTipoQuery, queryParams),
        pool.query(porDiaQuery, queryParams),
        pool.query(porDiaSemanaTipoQuery, queryParams),
        pool.query(porHoraTipoQuery, queryParams),
      ]);

    return res.json({
      resumen: mapResumenRow(resumenResult.rows[0]),
      porTipo: porTipoResult.rows.map(mapPorTipoRow),
      porDia: porDiaResult.rows.map(mapPorDiaRow),
      porDiaSemanaTipo: porDiaSemanaTipoResult.rows.map(mapPorDiaSemanaTipoRow),
      porHoraTipo: porHoraTipoResult.rows.map(mapPorHoraTipoRow),
    });
  } catch (error) {
    console.error("Error al obtener el informe mensual de eventos:", error);
    return res
      .status(500)
      .json({ mensaje: "Ocurrió un error al obtener el informe mensual de eventos." });
  }
};

export const getEventosPorSitio = async (req, res) => {
  const { fechaInicio, fechaFin } = req.query ?? {};

  const fechaInicioParam = formatDateOnly(fechaInicio);
  const fechaFinParam = formatDateOnly(fechaFin);

  if (!fechaInicioParam || !fechaFinParam) {
    return res.status(400).json({
      mensaje: "Debe proporcionar los parámetros fechaInicio y fechaFin en formato YYYY-MM-DD.",
    });
  }

  if (fechaFinParam < fechaInicioParam) {
    return res.status(400).json({ mensaje: "El rango de fechas no es válido." });
  }

  const fechaFinExclusive = addOneDay(`${fechaFinParam}T00:00:00Z`);

  const eventosPorSitioQuery = `${BASE_CTE}
SELECT
  SITIO_ID,
  SITIO_NOMBRE,
  latitud,
  longitud,
  COUNT(*) AS total_eventos
FROM base
WHERE latitud IS NOT NULL
  AND longitud IS NOT NULL
GROUP BY SITIO_ID, SITIO_NOMBRE, latitud, longitud
ORDER BY SITIO_NOMBRE;`;

  try {
    const queryParams = [fechaInicioParam, fechaFinExclusive];
    const result = await pool.query(eventosPorSitioQuery, queryParams);

    return res.json(result.rows.map(mapEventosPorSitioRow));
  } catch (error) {
    console.error("Error al obtener los eventos por sitio:", error);
    return res
      .status(500)
      .json({ mensaje: "Ocurrió un error al obtener los eventos por sitio." });
  }
};
