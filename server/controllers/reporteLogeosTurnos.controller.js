import XLSX from "xlsx";
import { pool } from "../db.js";

const formatTimestamp = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");

  return `${year}${month}${day}_${hours}${minutes}${seconds}`;
};

const formatDateValue = (value) => {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().split("T")[0];
};

const formatTimeValue = (value) => {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().split("T")[1]?.split(".")[0] ?? "";
  }
  return String(value);
};

const buildTurnoFilter = (turno) => {
  if (!turno) return null;
  const normalized = turno.toString().trim().toUpperCase();
  if (normalized === "DIURNO") {
    return "A.FECHA_LOGEO::TIME >= TIME '07:00:00' AND A.FECHA_LOGEO::TIME < TIME '19:00:00'";
  }
  if (normalized === "NOCTURNO") {
    return "A.FECHA_LOGEO::TIME < TIME '07:00:00' OR A.FECHA_LOGEO::TIME >= TIME '19:00:00'";
  }
  return null;
};

const toPositiveNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const buildReporteLogeosTurnosFilters = ({
  fecha_desde,
  fecha_hasta,
  turno,
  consola_id,
  usuario,
}) => {
  if (!fecha_desde || !fecha_hasta) {
    return {
      error: {
        status: 400,
        message: "Los parámetros fecha_desde y fecha_hasta son obligatorios",
      },
    };
  }

  const filters = ["A.FECHA_LOGEO::DATE BETWEEN $1 AND $2"];
  const values = [fecha_desde, fecha_hasta];
  let parameterIndex = values.length + 1;

  const turnoFilter = buildTurnoFilter(turno);
  if (turno && !turnoFilter) {
    return {
      error: { status: 400, message: "El turno debe ser DIURNO o NOCTURNO" },
    };
  }
  if (turnoFilter) {
    filters.push(turnoFilter);
  }

  const consolaId = toPositiveNumber(consola_id);
  if (consola_id !== undefined && consolaId === null) {
    return { error: { status: 400, message: "consola_id debe ser numérico" } };
  }
  if (consolaId !== null) {
    filters.push(`A.CONSOLA_ID = $${parameterIndex}`);
    values.push(consolaId);
    parameterIndex += 1;
  }

  const usuarioFilter = typeof usuario === "string" ? usuario.trim() : "";
  if (usuarioFilter) {
    filters.push(
      `(B.NOMBRE_USUARIO ILIKE $${parameterIndex} OR B.NOMBRE_COMPLETO ILIKE $${parameterIndex})`
    );
    values.push(`%${usuarioFilter}%`);
    parameterIndex += 1;
  }

  const whereClause = filters.length > 0 ? `WHERE ${filters.join(" AND ")}` : "";

  return { whereClause, values, parameterIndex };
};

export const getReporteLogeosTurnos = async (req, res) => {
  try {
    const page = Number(req.query.page ?? 0);
    const limit = Number(req.query.limit ?? 10);
    const safePage = Number.isFinite(page) && page >= 0 ? page : 0;
    const safeLimit = Number.isFinite(limit) && limit > 0 ? limit : 10;
    const offset = safePage * safeLimit;

    const filterResult = buildReporteLogeosTurnosFilters(req.query);
    if (filterResult.error) {
      return res.status(filterResult.error.status).json({ message: filterResult.error.message });
    }

    const { whereClause, values, parameterIndex } = filterResult;

    const baseFrom =
      "FROM LOG_USUARIO_LOGIN A LEFT JOIN USUARIOS B ON (B.ID = A.USUARIO_ID) LEFT JOIN CONSOLAS C ON (C.ID = A.CONSOLA_ID)";

    const selectQuery = `SELECT\n  A.ID AS ID_LOG,\n  A.FECHA_LOGEO::DATE AS FECHA_LOGEO,\n  A.FECHA_LOGEO::TIME AS HORA_LOGEO,\n  CASE\n    WHEN (A.FECHA_LOGEO::TIME >= TIME '07:00:00' AND A.FECHA_LOGEO::TIME < TIME '19:00:00') THEN 'DIURNO'\n    ELSE 'NOCTURNO'\n  END AS TURNO,\n  B.NOMBRE_USUARIO AS USUARIO,\n  B.NOMBRE_COMPLETO AS NOMBRE_COMPLETO,\n  COALESCE(C.NOMBRE, 'SIN CONSOLA') AS CONSOLA\n${baseFrom}\n${whereClause}\nORDER BY A.FECHA_LOGEO DESC\nLIMIT $${parameterIndex} OFFSET $${parameterIndex + 1}`;

    const countQuery = `SELECT COUNT(1) AS total\n${baseFrom}\n${whereClause}`;

    const queryValues = [...values, safeLimit, offset];

    const [dataResult, countResult] = await Promise.all([
      pool.query(selectQuery, queryValues),
      pool.query(countQuery, values),
    ]);

    return res.json({ data: dataResult.rows, total: Number(countResult.rows[0]?.total ?? 0) });
  } catch (error) {
    console.error("Error al obtener reporte de logeos por turno", error);
    return res.status(500).json({ message: "Error interno del servidor" });
  }
};

export const exportReporteLogeosTurnosExcel = async (req, res) => {
  try {
    const filterResult = buildReporteLogeosTurnosFilters(req.query);
    if (filterResult.error) {
      return res.status(filterResult.error.status).json({ message: filterResult.error.message });
    }

    const { whereClause, values } = filterResult;

    const baseFrom =
      "FROM LOG_USUARIO_LOGIN A LEFT JOIN USUARIOS B ON (B.ID = A.USUARIO_ID) LEFT JOIN CONSOLAS C ON (C.ID = A.CONSOLA_ID)";

    const selectQuery = `SELECT\n  A.ID AS ID_LOG,\n  A.FECHA_LOGEO::DATE AS FECHA_LOGEO,\n  A.FECHA_LOGEO::TIME AS HORA_LOGEO,\n  CASE\n    WHEN (A.FECHA_LOGEO::TIME >= TIME '07:00:00' AND A.FECHA_LOGEO::TIME < TIME '19:00:00') THEN 'DIURNO'\n    ELSE 'NOCTURNO'\n  END AS TURNO,\n  B.NOMBRE_USUARIO AS USUARIO,\n  B.NOMBRE_COMPLETO AS NOMBRE_COMPLETO,\n  COALESCE(C.NOMBRE, 'SIN CONSOLA') AS CONSOLA\n${baseFrom}\n${whereClause}\nORDER BY A.FECHA_LOGEO DESC`;

    const { rows } = await pool.query(selectQuery, values);

    const worksheetData = [
      ["ID_LOG", "FECHA_LOGEO", "HORA_LOGEO", "TURNO", "USUARIO", "NOMBRE_COMPLETO", "CONSOLA"],
      ...rows.map((row) => [
        row?.id_log ?? "",
        formatDateValue(row?.fecha_logeo),
        formatTimeValue(row?.hora_logeo),
        row?.turno ?? "",
        row?.usuario ?? "",
        row?.nombre_completo ?? "",
        row?.consola ?? "",
      ]),
    ];

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
    XLSX.utils.book_append_sheet(workbook, worksheet, "Logeos por turno");

    const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "buffer" });
    const timestamp = formatTimestamp();

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=\"LOGEOS_TURNOS_${timestamp}.xlsx\"`
    );
    res.setHeader(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, proxy-revalidate"
    );
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.setHeader("Surrogate-Control", "no-store");
    res.removeHeader("ETag");

    return res.status(200).send(buffer);
  } catch (error) {
    console.error("Error al exportar reporte de logeos por turno", error);
    return res.status(500).json({
      message: "No se pudo exportar reporte de logeos por turno",
      detail: error?.message,
    });
  }
};
