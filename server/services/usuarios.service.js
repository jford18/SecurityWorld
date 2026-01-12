import pool from "../db.js";

const normalizeText = (value) => (typeof value === "string" ? value.trim() : "");

const normalizeBoolean = (value) => {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    return value !== 0;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["1", "true", "t", "on", "activo", "yes", "y"].includes(normalized)) {
      return true;
    }
    if (["0", "false", "f", "off", "inactivo", "no", "n"].includes(normalized)) {
      return false;
    }
  }

  return null;
};

export const exportUsuarios = async ({
  id,
  usuario,
  nombreCompleto,
  estado,
  fechaCreacion,
} = {}) => {
  const filters = [];
  const values = [];

  const idFilter = normalizeText(id);
  if (idFilter) {
    values.push(`%${idFilter}%`);
    filters.push(`CAST(A.ID AS TEXT) ILIKE $${values.length}`);
  }

  const usuarioFilter = normalizeText(usuario);
  if (usuarioFilter) {
    values.push(`%${usuarioFilter}%`);
    filters.push(`A.NOMBRE_USUARIO ILIKE $${values.length}`);
  }

  const nombreFilter = normalizeText(nombreCompleto);
  if (nombreFilter) {
    values.push(`%${nombreFilter}%`);
    filters.push(`A.NOMBRE_COMPLETO ILIKE $${values.length}`);
  }

  const estadoValue = normalizeBoolean(estado);
  if (estadoValue !== null) {
    values.push(estadoValue);
    filters.push(`A.ACTIVO = $${values.length}`);
  }

  const fechaFilter = normalizeText(fechaCreacion);
  if (fechaFilter) {
    values.push(`%${fechaFilter}%`);
    filters.push(
      `(TO_CHAR(A.FECHA_CREACION, 'DD/MM/YYYY HH24:MI:SS') ILIKE $${values.length} OR TO_CHAR(A.FECHA_CREACION, 'YYYY-MM-DD HH24:MI:SS') ILIKE $${values.length})`
    );
  }

  const filterClause = filters.length ? `\n  AND ${filters.join("\n  AND ")}` : "";

  const result = await pool.query(
    `SELECT
    A.ID,
    A.NOMBRE_USUARIO,
    A.NOMBRE_COMPLETO,
    A.ACTIVO,
    A.FECHA_CREACION
FROM PUBLIC.USUARIOS A
WHERE 1=1${filterClause}
ORDER BY A.FECHA_CREACION DESC;
-- Comentario: PUBLIC.USUARIOS A tabla principal; filtros iguales al UI; export sin LIMIT/OFFSET.`,
    values
  );

  return result.rows ?? [];
};

export default {
  exportUsuarios,
};
