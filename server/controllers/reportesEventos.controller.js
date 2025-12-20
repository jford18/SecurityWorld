import { pool } from "../db.js";
import { buildIntrusionesFilterConfig } from "./intrusiones.controller.js";

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

  const porcAutorizados = toNumberOrNull(row.porc_autorizados ?? row.porcentaje_autorizados);
  const porcNoAutorizados = toNumberOrNull(
    row.porc_no_autorizados ?? row.porcentaje_no_autorizados
  );

  return {
    total_eventos: toNumber(row.total_eventos),
    eventos_autorizados: toNumber(row.eventos_autorizados),
    eventos_no_autorizados: toNumber(row.eventos_no_autorizados),
    porcentaje_autorizados: porcAutorizados,
    porc_autorizados: porcAutorizados,
    porcentaje_no_autorizados: porcNoAutorizados,
    porc_no_autorizados: porcNoAutorizados,
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

const normalizeReportesFilters = (query) => ({
  ...query,
  fechaDesde: query?.fechaDesde ?? query?.fechaInicio,
  fechaHasta: query?.fechaHasta ?? query?.fechaFin,
});

const buildBaseIntrusionesCTE = (metadata, whereClause) => {
  const tipoIntrusionExpression = metadata.hasTipoIntrusionId
    ? "COALESCE(cti.descripcion, CAST(i.tipo_intrusion_id AS TEXT))"
    : "i.tipo";
  const protocoloExpression = metadata.hasTipoIntrusionId
    ? "NULLIF(TRIM(cti.protocolo), '')"
    : "NULL";

  const sitioNombreExpression = "COALESCE(NULLIF(TRIM(s.descripcion), ''), s.nombre)";

  const joins = ["LEFT JOIN public.sitios AS s ON s.id = i.sitio_id"];

  if (metadata.hasTipoIntrusionId) {
    joins.push("LEFT JOIN public.catalogo_tipo_intrusion AS cti ON cti.id = i.tipo_intrusion_id");
  }

  return `WITH base_intrusiones AS (
    SELECT
        i.id,
        i.sitio_id,
        ${sitioNombreExpression}          AS sitio_nombre,
        s.latitud,
        s.longitud,
        ${tipoIntrusionExpression}            AS tipo_intrusion,
        i.fecha_evento,
        i.fecha_reaccion,
        (i.fecha_evento AT TIME ZONE 'UTC')::DATE             AS fecha,
        EXTRACT(ISODOW FROM i.fecha_evento)                   AS dia_semana,
        EXTRACT(HOUR   FROM i.fecha_evento)                   AS hora,
        CASE WHEN ${protocoloExpression} IS NULL THEN 1 ELSE 0 END AS es_autorizado,
        CASE WHEN ${protocoloExpression} IS NOT NULL THEN 1 ELSE 0 END AS es_no_autorizado,
        CASE
            WHEN i.fecha_reaccion IS NOT NULL THEN
                EXTRACT(EPOCH FROM (i.fecha_reaccion - i.fecha_evento)) / 60.0
            ELSE NULL
        END AS minutos_reaccion
    FROM public.intrusiones AS i
    ${joins.join("\n    ")}
    ${whereClause}
  )`;
};

export const getInformeMensualEventos = async (req, res) => {
  const normalizedFilters = normalizeReportesFilters(req.query);

  const filterConfig = await buildIntrusionesFilterConfig(normalizedFilters);

  if (filterConfig?.error) {
    const { status = 400, message } = filterConfig.error;
    return res.status(status).json({ mensaje: message });
  }

  const { metadata, values, whereClause } = filterConfig;

  const baseCTE = buildBaseIntrusionesCTE(metadata, whereClause);

  const resumenQuery = `${baseCTE}
/* Este reporte usa únicamente datos de INTRUSIONES, no incluye fallos técnicos. */
SELECT
    COUNT(*)                                           AS total_eventos,
    SUM(ES_AUTORIZADO)                                 AS eventos_autorizados,
    SUM(ES_NO_AUTORIZADO)                              AS eventos_no_autorizados,
    COALESCE(ROUND(100.0 * SUM(ES_AUTORIZADO) / NULLIF(COUNT(*),0), 2), 0)    AS porc_autorizados,
    COALESCE(ROUND(100.0 * SUM(ES_NO_AUTORIZADO) / NULLIF(COUNT(*),0), 2), 0) AS porc_no_autorizados,
    COUNT(DISTINCT SITIO_ID)                          AS sitios_con_eventos,
    ROUND(AVG(MINUTOS_REACCION)::NUMERIC, 2)          AS t_prom_reaccion_min
FROM base_intrusiones;`;

  const porTipoQuery = `${baseCTE}
SELECT
    TIPO_INTRUSION                   AS tipo,
    COUNT(*)                         AS n_eventos,
    COUNT(DISTINCT SITIO_ID)         AS n_sitios_con_evento
FROM base_intrusiones
GROUP BY TIPO_INTRUSION
ORDER BY n_eventos DESC;`;

  const porDiaQuery = `${baseCTE}
SELECT
    FECHA,
    COUNT(*) AS n_eventos
FROM base_intrusiones
GROUP BY FECHA
ORDER BY FECHA;`;

  const porDiaSemanaTipoQuery = `${baseCTE}
SELECT
    DIA_SEMANA,
    TIPO_INTRUSION,
    COUNT(*) AS n_eventos
FROM base_intrusiones
GROUP BY DIA_SEMANA, TIPO_INTRUSION
ORDER BY DIA_SEMANA, TIPO_INTRUSION;`;

  const porHoraTipoQuery = `${baseCTE}
SELECT
    HORA,
    TIPO_INTRUSION,
    COUNT(*) AS n_eventos
FROM base_intrusiones
GROUP BY HORA, TIPO_INTRUSION
ORDER BY HORA, TIPO_INTRUSION;`;

  try {
    const [resumenResult, porTipoResult, porDiaResult, porDiaSemanaTipoResult, porHoraTipoResult] =
      await Promise.all([
        pool.query(resumenQuery, values),
        pool.query(porTipoQuery, values),
        pool.query(porDiaQuery, values),
        pool.query(porDiaSemanaTipoQuery, values),
        pool.query(porHoraTipoQuery, values),
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
  const normalizedFilters = normalizeReportesFilters(req.query);
  const filterConfig = await buildIntrusionesFilterConfig(normalizedFilters);

  if (filterConfig?.error) {
    const { status = 400, message } = filterConfig.error;
    return res.status(status).json({ mensaje: message });
  }

  const { metadata, values, whereClause } = filterConfig;

  const baseCTE = buildBaseIntrusionesCTE(metadata, whereClause);

  const eventosPorSitioQuery = `${baseCTE}
SELECT
  SITIO_ID,
  SITIO_NOMBRE,
  latitud,
  longitud,
  COUNT(*) AS total_eventos
FROM base_intrusiones
WHERE latitud IS NOT NULL
  AND longitud IS NOT NULL
GROUP BY SITIO_ID, SITIO_NOMBRE, latitud, longitud
ORDER BY SITIO_NOMBRE;`;

  try {
    const result = await pool.query(eventosPorSitioQuery, values);

    return res.json(result.rows.map(mapEventosPorSitioRow));
  } catch (error) {
    console.error("Error al obtener los eventos por sitio:", error);
    return res
      .status(500)
      .json({ mensaje: "Ocurrió un error al obtener los eventos por sitio." });
  }
};
