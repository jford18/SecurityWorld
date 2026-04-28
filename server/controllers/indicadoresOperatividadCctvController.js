import XLSX from "xlsx";
import { pool } from "../db.js";

const DEFAULT_FROM_TIME = "00:00:00";
const DEFAULT_TO_TIME = "23:59:59";

const toTimestampBounds = (fechaDesde, fechaHasta) => ({
  fromTs: `${fechaDesde} ${DEFAULT_FROM_TIME}`,
  toTs: `${fechaHasta} ${DEFAULT_TO_TIME}`,
});

const parseFilters = (query) => {
  const fechaDesde = query.fechaDesde;
  const fechaHasta = query.fechaHasta;

  if (!fechaDesde || !fechaHasta) {
    return { error: "Los parámetros 'fechaDesde' y 'fechaHasta' son obligatorios." };
  }

  const normalized = {
    fechaDesde,
    fechaHasta,
    cliente: query.cliente?.trim() || null,
    haciendaSitio: query.haciendaSitio?.trim() || null,
    area: query.area?.trim() || null,
    name: query.name?.trim() || null,
  };

  return { value: normalized };
};

const BASE_FILTERS_CTE = `
WITH params AS (
  SELECT
    $1::timestamp AS from_ts,
    $2::timestamp AS to_ts,
    NULLIF($3::text, '') AS cliente,
    NULLIF($4::text, '') AS hacienda_sitio,
    NULLIF($5::text, '') AS area,
    NULLIF($6::text, '') AS camera_name
),
base AS (
  SELECT
    COALESCE(h.id, 0) AS id,
    COALESCE(NULLIF(TRIM(h.cliente), ''), 'SIN CLIENTE') AS cliente,
    COALESCE(NULLIF(TRIM(h.hacienda_sitio), ''), COALESCE(NULLIF(TRIM(h.area), ''), 'SIN HACIENDA-SITIO')) AS hacienda_sitio,
    COALESCE(NULLIF(TRIM(h.area), ''), 'SIN AREA') AS area,
    COALESCE(NULLIF(TRIM(h.camera_name), ''), 'SIN NOMBRE') AS camera_name,
    COALESCE(NULLIF(TRIM(h.device_code), ''), 'SIN DEVICE_CODE') AS device_code,
    COALESCE(NULLIF(TRIM(h.online_status), ''), 'UNKNOWN') AS online_status,
    LOWER(TRIM(COALESCE(h.online_status, ''))) AS online_status_norm,
    h.auto_check_time,
    h.last_online_time
  FROM PUBLIC.HIK_CAMERA_RESOURCE_STATUS_HIST h
  JOIN params p ON 1 = 1
  WHERE h.auto_check_time IS NOT NULL
    AND h.auto_check_time >= p.from_ts
    AND h.auto_check_time <= p.to_ts
    AND (p.cliente IS NULL OR TRIM(COALESCE(h.cliente, '')) = p.cliente)
    AND (p.hacienda_sitio IS NULL OR TRIM(COALESCE(h.hacienda_sitio, '')) = p.hacienda_sitio)
    AND (p.area IS NULL OR TRIM(COALESCE(h.area, '')) = p.area)
    AND (p.camera_name IS NULL OR TRIM(COALESCE(h.camera_name, '')) = p.camera_name)
),
ordered AS (
  SELECT
    b.*,
    LEAD(b.auto_check_time) OVER (
      PARTITION BY b.camera_name, b.device_code
      ORDER BY b.auto_check_time
    ) AS next_auto_check_time,
    CONCAT(b.camera_name, '||', b.device_code) AS camera_key
  FROM base b
),
intervals AS (
  SELECT
    o.*,
    GREATEST(o.auto_check_time, p.from_ts) AS interval_start,
    LEAST(COALESCE(o.next_auto_check_time, p.to_ts), p.to_ts) AS interval_end,
    GREATEST(
      0,
      EXTRACT(
        EPOCH FROM (
          LEAST(COALESCE(o.next_auto_check_time, p.to_ts), p.to_ts)
          - GREATEST(o.auto_check_time, p.from_ts)
        )
      ) / 3600.0
    )::numeric AS interval_hours
  FROM ordered o
  JOIN params p ON 1 = 1
),
valid_intervals AS (
  SELECT *
  FROM intervals
  WHERE interval_end > interval_start
),
camera_count AS (
  SELECT COUNT(DISTINCT camera_key)::numeric AS total_camaras
  FROM ordered
),
range_hours AS (
  SELECT GREATEST(EXTRACT(EPOCH FROM (p.to_ts - p.from_ts)) / 3600.0, 0)::numeric AS horas_rango
  FROM params p
),
latest_camera_status AS (
  SELECT DISTINCT ON (camera_key)
    camera_key,
    camera_name,
    cliente,
    hacienda_sitio,
    area,
    online_status,
    online_status_norm,
    auto_check_time
  FROM ordered
  ORDER BY camera_key, auto_check_time DESC
)
`;

const FILTERS_QUERY = `
${BASE_FILTERS_CTE}
SELECT
  ARRAY_REMOVE(ARRAY_AGG(DISTINCT cliente ORDER BY cliente), NULL) AS clientes,
  ARRAY_REMOVE(ARRAY_AGG(DISTINCT hacienda_sitio ORDER BY hacienda_sitio), NULL) AS haciendas_sitio,
  ARRAY_REMOVE(ARRAY_AGG(DISTINCT area ORDER BY area), NULL) AS areas,
  ARRAY_REMOVE(ARRAY_AGG(DISTINCT camera_name ORDER BY camera_name), NULL) AS camera_names
FROM base;
`;

const RESUMEN_QUERY = `
${BASE_FILTERS_CTE}
SELECT
  COALESCE(cc.total_camaras, 0)::int AS total_camaras,
  COALESCE(SUM(CASE WHEN lcs.online_status_norm = 'online' THEN 1 ELSE 0 END), 0)::int AS camaras_online,
  COALESCE(SUM(CASE WHEN lcs.online_status_norm = 'offline' THEN 1 ELSE 0 END), 0)::int AS camaras_offline,
  ROUND(COALESCE(rh.horas_rango, 0) * COALESCE(cc.total_camaras, 0), 2) AS tiempo_disponible_horas,
  ROUND(COALESCE(SUM(CASE WHEN vi.online_status_norm = 'offline' THEN vi.interval_hours ELSE 0 END), 0), 2) AS total_hours_offline,
  ROUND(
    GREATEST(
      0,
      (COALESCE(rh.horas_rango, 0) * COALESCE(cc.total_camaras, 0))
      - COALESCE(SUM(CASE WHEN vi.online_status_norm = 'offline' THEN vi.interval_hours ELSE 0 END), 0)
    ),
    2
  ) AS total_hours_online,
  COALESCE(SUM(CASE WHEN vi.online_status_norm = 'offline' THEN 1 ELSE 0 END), 0)::int AS times_offline,
  ROUND(
    CASE
      WHEN (COALESCE(rh.horas_rango, 0) * COALESCE(cc.total_camaras, 0)) <= 0 THEN 0
      ELSE (
        GREATEST(
          0,
          (COALESCE(rh.horas_rango, 0) * COALESCE(cc.total_camaras, 0))
          - COALESCE(SUM(CASE WHEN vi.online_status_norm = 'offline' THEN vi.interval_hours ELSE 0 END), 0)
        )
        / (COALESCE(rh.horas_rango, 0) * COALESCE(cc.total_camaras, 0))
      ) * 100
    END,
    2
  ) AS uptime_pct
FROM camera_count cc
CROSS JOIN range_hours rh
LEFT JOIN valid_intervals vi ON 1 = 1
LEFT JOIN latest_camera_status lcs ON 1 = 1;
`;

const DETALLE_QUERY = `
${BASE_FILTERS_CTE},
camera_metrics AS (
  SELECT
    camera_key,
    MAX(cliente) AS cliente,
    MAX(hacienda_sitio) AS hacienda_sitio,
    MAX(area) AS area,
    MAX(camera_name) AS camera_name,
    ROUND(COALESCE(SUM(CASE WHEN online_status_norm = 'offline' THEN interval_hours ELSE 0 END), 0), 2) AS total_hours_offline,
    COALESCE(SUM(CASE WHEN online_status_norm = 'offline' THEN 1 ELSE 0 END), 0)::int AS times_offline
  FROM valid_intervals
  GROUP BY camera_key
)
SELECT
  cm.cliente,
  cm.hacienda_sitio,
  cm.area,
  cm.camera_name AS name,
  lcs.online_status AS network_status,
  lcs.auto_check_time,
  cm.total_hours_offline,
  ROUND(GREATEST(0, COALESCE(rh.horas_rango, 0) - cm.total_hours_offline), 2) AS total_hours_online,
  cm.times_offline,
  ROUND(
    CASE
      WHEN COALESCE(rh.horas_rango, 0) <= 0 THEN 0
      ELSE (GREATEST(0, COALESCE(rh.horas_rango, 0) - cm.total_hours_offline) / rh.horas_rango) * 100
    END,
    2
  ) AS uptime_pct
FROM camera_metrics cm
JOIN latest_camera_status lcs ON lcs.camera_key = cm.camera_key
CROSS JOIN range_hours rh
ORDER BY cm.cliente, cm.hacienda_sitio, cm.area, cm.camera_name;
`;

const UPTIME_CLIENTE_QUERY = `
${BASE_FILTERS_CTE},
cliente_base AS (
  SELECT
    cliente,
    COUNT(DISTINCT camera_key)::numeric AS total_camaras,
    COALESCE(SUM(CASE WHEN online_status_norm = 'offline' THEN interval_hours ELSE 0 END), 0)::numeric AS total_hours_offline,
    COALESCE(SUM(CASE WHEN online_status_norm = 'offline' THEN 1 ELSE 0 END), 0)::int AS times_offline
  FROM valid_intervals
  GROUP BY cliente
)
SELECT
  cb.cliente,
  cb.total_camaras::int AS total_camaras,
  ROUND(cb.total_hours_offline, 2) AS total_hours_offline,
  ROUND(GREATEST(0, (rh.horas_rango * cb.total_camaras) - cb.total_hours_offline), 2) AS total_hours_online,
  cb.times_offline,
  ROUND(
    CASE
      WHEN (rh.horas_rango * cb.total_camaras) <= 0 THEN 0
      ELSE (
        GREATEST(0, (rh.horas_rango * cb.total_camaras) - cb.total_hours_offline)
        / (rh.horas_rango * cb.total_camaras)
      ) * 100
    END,
    2
  ) AS uptime_pct
FROM cliente_base cb
CROSS JOIN range_hours rh
ORDER BY cb.cliente;
`;

const UPTIME_DIA_QUERY = `
${BASE_FILTERS_CTE},
days AS (
  SELECT generate_series(date_trunc('day', p.from_ts), date_trunc('day', p.to_ts), interval '1 day') AS day_start
  FROM params p
),
camera_by_day AS (
  SELECT
    d.day_start::date AS day,
    COUNT(DISTINCT o.camera_key)::numeric AS total_camaras
  FROM days d
  LEFT JOIN ordered o
    ON date_trunc('day', o.auto_check_time) = d.day_start
  GROUP BY d.day_start
),
offline_by_day AS (
  SELECT
    d.day_start::date AS day,
    COALESCE(
      SUM(
        CASE
          WHEN vi.online_status_norm = 'offline'
           AND vi.interval_end > d.day_start
           AND vi.interval_start < d.day_start + interval '1 day'
          THEN EXTRACT(
            EPOCH FROM (
              LEAST(vi.interval_end, d.day_start + interval '1 day')
              - GREATEST(vi.interval_start, d.day_start)
            )
          ) / 3600.0
          ELSE 0
        END
      ),
      0
    )::numeric AS total_hours_offline
  FROM days d
  LEFT JOIN valid_intervals vi ON 1 = 1
  GROUP BY d.day_start
)
SELECT
  cbd.day,
  cbd.total_camaras::int AS total_camaras,
  ROUND(obd.total_hours_offline, 2) AS total_hours_offline,
  ROUND(GREATEST(0, (24 * cbd.total_camaras) - obd.total_hours_offline), 2) AS total_hours_online,
  ROUND(
    CASE
      WHEN (24 * cbd.total_camaras) <= 0 THEN 0
      ELSE (GREATEST(0, (24 * cbd.total_camaras) - obd.total_hours_offline) / (24 * cbd.total_camaras)) * 100
    END,
    2
  ) AS uptime_pct
FROM camera_by_day cbd
JOIN offline_by_day obd ON obd.day = cbd.day
ORDER BY cbd.day;
`;

const REINCIDENCIA_QUERY = `
${BASE_FILTERS_CTE},
reincidencia AS (
  SELECT
    camera_name AS name,
    cliente,
    hacienda_sitio,
    area,
    COUNT(*) FILTER (WHERE online_status_norm = 'offline')::int AS times_offline_7d
  FROM ordered
  JOIN params p ON 1 = 1
  WHERE auto_check_time >= (p.to_ts - interval '7 day')
  GROUP BY camera_name, cliente, hacienda_sitio, area
)
SELECT
  name,
  cliente,
  hacienda_sitio,
  area,
  times_offline_7d
FROM reincidencia
WHERE times_offline_7d > 0
ORDER BY times_offline_7d DESC, name
LIMIT 20;
`;

const runQuery = async (sql, filters) => {
  const { fromTs, toTs } = toTimestampBounds(filters.fechaDesde, filters.fechaHasta);
  const params = [fromTs, toTs, filters.cliente, filters.haciendaSitio, filters.area, filters.name];
  return pool.query(sql, params);
};

export const getFiltrosOperatividadCctv = async (req, res) => {
  try {
    const parsed = parseFilters(req.query);
    if (parsed.error) {
      return res.status(400).json({ message: parsed.error });
    }

    const result = await runQuery(FILTERS_QUERY, parsed.value);
    const row = result.rows[0] ?? {};

    return res.json({
      cliente: row.clientes ?? [],
      haciendaSitio: row.haciendas_sitio ?? [],
      area: row.areas ?? [],
      cameraName: row.camera_names ?? [],
    });
  } catch (error) {
    console.error("[API][ERROR] /api/dashboards/operatividad-cctv/filtros", error);
    return res.status(500).json({
      message: "Error al obtener filtros de operatividad CCTV",
      details: error.message,
    });
  }
};

export const getResumenOperatividadCctv = async (req, res) => {
  try {
    const parsed = parseFilters(req.query);
    if (parsed.error) {
      return res.status(400).json({ message: parsed.error });
    }

    const result = await runQuery(RESUMEN_QUERY, parsed.value);
    return res.json(result.rows[0] ?? {});
  } catch (error) {
    console.error("[API][ERROR] /api/dashboards/operatividad-cctv/resumen", error);
    return res.status(500).json({ message: "Error al obtener resumen", details: error.message });
  }
};

export const getDetalleOperatividadCctv = async (req, res) => {
  try {
    const parsed = parseFilters(req.query);
    if (parsed.error) {
      return res.status(400).json({ message: parsed.error });
    }

    const result = await runQuery(DETALLE_QUERY, parsed.value);
    return res.json(result.rows ?? []);
  } catch (error) {
    console.error("[API][ERROR] /api/dashboards/operatividad-cctv/detalle", error);
    return res.status(500).json({ message: "Error al obtener detalle", details: error.message });
  }
};

export const getUptimeClienteOperatividadCctv = async (req, res) => {
  try {
    const parsed = parseFilters(req.query);
    if (parsed.error) {
      return res.status(400).json({ message: parsed.error });
    }

    const result = await runQuery(UPTIME_CLIENTE_QUERY, parsed.value);
    return res.json(result.rows ?? []);
  } catch (error) {
    console.error("[API][ERROR] /api/dashboards/operatividad-cctv/uptime-cliente", error);
    return res.status(500).json({ message: "Error al obtener uptime por cliente", details: error.message });
  }
};

export const getUptimeDiaOperatividadCctv = async (req, res) => {
  try {
    const parsed = parseFilters(req.query);
    if (parsed.error) {
      return res.status(400).json({ message: parsed.error });
    }

    const result = await runQuery(UPTIME_DIA_QUERY, parsed.value);
    return res.json(result.rows ?? []);
  } catch (error) {
    console.error("[API][ERROR] /api/dashboards/operatividad-cctv/uptime-dia", error);
    return res.status(500).json({ message: "Error al obtener uptime por día", details: error.message });
  }
};

export const getReincidenciaOperatividadCctv = async (req, res) => {
  try {
    const parsed = parseFilters(req.query);
    if (parsed.error) {
      return res.status(400).json({ message: parsed.error });
    }

    const result = await runQuery(REINCIDENCIA_QUERY, parsed.value);
    return res.json(result.rows ?? []);
  } catch (error) {
    console.error("[API][ERROR] /api/dashboards/operatividad-cctv/reincidencia", error);
    return res.status(500).json({ message: "Error al obtener reincidencia", details: error.message });
  }
};

const formatExcelTimestamp = () => {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;
};

export const exportExcelOperatividadCctv = async (req, res) => {
  try {
    const parsed = parseFilters(req.query);
    if (parsed.error) {
      return res.status(400).json({ message: parsed.error });
    }

    const result = await runQuery(DETALLE_QUERY, parsed.value);
    const rows = result.rows ?? [];

    const worksheetData = [
      [
        "CLIENTE",
        "HACIENDA-SITIO",
        "AREA",
        "NAME",
        "NETWORK STATUS",
        "AUTO CHECK TIME",
        "TOTAL HOURS OFFLINE",
        "TOTAL HOURS ONLINE",
        "TIMES OFFLINE",
        "% UP TIME",
      ],
      ...rows.map((row) => [
        row.cliente,
        row.hacienda_sitio,
        row.area,
        row.name,
        row.network_status,
        row.auto_check_time,
        row.total_hours_offline,
        row.total_hours_online,
        row.times_offline,
        row.uptime_pct,
      ]),
    ];

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
    XLSX.utils.book_append_sheet(workbook, worksheet, "Operatividad CCTV");

    const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "buffer" });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="INDICADORES_OPERATIVIDAD_CCTV_${formatExcelTimestamp()}.xlsx"`,
    );

    return res.send(buffer);
  } catch (error) {
    console.error("[API][ERROR] /api/dashboards/operatividad-cctv/export-excel", error);
    return res.status(500).json({ message: "Error al exportar Excel", details: error.message });
  }
};
