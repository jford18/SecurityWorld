import { pool } from "../db.js";

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

export const getReporteLogeosTurnos = async (req, res) => {
  try {
    const {
      fecha_desde,
      fecha_hasta,
      turno,
      consola_id,
      usuario,
    } = req.query;

    if (!fecha_desde || !fecha_hasta) {
      return res.status(400).json({ message: "Los parámetros fecha_desde y fecha_hasta son obligatorios" });
    }

    const page = Number(req.query.page ?? 0);
    const limit = Number(req.query.limit ?? 10);
    const safePage = Number.isFinite(page) && page >= 0 ? page : 0;
    const safeLimit = Number.isFinite(limit) && limit > 0 ? limit : 10;
    const offset = safePage * safeLimit;

    const filters = ["A.FECHA_LOGEO::DATE BETWEEN $1 AND $2"];
    const values = [fecha_desde, fecha_hasta];
    let parameterIndex = values.length + 1;

    const turnoFilter = buildTurnoFilter(turno);
    if (turno && !turnoFilter) {
      return res.status(400).json({ message: "El turno debe ser DIURNO o NOCTURNO" });
    }
    if (turnoFilter) {
      filters.push(turnoFilter);
    }

    const consolaId = toPositiveNumber(consola_id);
    if (consola_id !== undefined && consolaId === null) {
      return res.status(400).json({ message: "consola_id debe ser numérico" });
    }
    if (consolaId !== null) {
      filters.push(`A.CONSOLA_ID = $${parameterIndex}`);
      values.push(consolaId);
      parameterIndex += 1;
    }

    const usuarioFilter = typeof usuario === "string" ? usuario.trim() : "";
    if (usuarioFilter) {
      filters.push(`(B.NOMBRE_USUARIO ILIKE $${parameterIndex} OR B.NOMBRE_COMPLETO ILIKE $${parameterIndex})`);
      values.push(`%${usuarioFilter}%`);
      parameterIndex += 1;
    }

    const whereClause = filters.length > 0 ? `WHERE ${filters.join(" AND ")}` : "";

    const baseFrom =
      "FROM LOG_USUARIO_LOGIN A LEFT JOIN USUARIOS B ON (B.ID = A.USUARIO_ID) LEFT JOIN CONSOLAS C ON (C.ID = A.CONSOLA_ID)";

    const selectQuery = `SELECT\n  A.ID AS ID_LOG,\n  A.FECHA_LOGEO::DATE AS FECHA_LOGEO,\n  A.FECHA_LOGEO::TIME AS HORA_LOGEO,\n  CASE\n    WHEN (A.FECHA_LOGEO::TIME >= TIME '07:00:00' AND A.FECHA_LOGEO::TIME < TIME '19:00:00') THEN 'DIURNO'\n    ELSE 'NOCTURNO'\n  END AS TURNO,\n  B.NOMBRE_USUARIO AS USUARIO,\n  COALESCE(C.NOMBRE, 'SIN CONSOLA') AS CONSOLA\n${baseFrom}\n${whereClause}\nORDER BY A.FECHA_LOGEO DESC\nLIMIT $${parameterIndex} OFFSET $${parameterIndex + 1}`;

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
