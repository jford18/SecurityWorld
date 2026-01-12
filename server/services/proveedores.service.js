import pool from "../db.js";

const BASE_SELECT = `
  SELECT
    A.id,
    A.nombre,
    A.identificacion,
    A.direccion,
    A.telefono,
    A.activo,
    A.fecha_creacion
  FROM public.proveedores A
`;

export const findAllProveedores = async (searchTerm) => {
  if (searchTerm && searchTerm.trim().length > 0) {
    const term = `%${searchTerm.trim()}%`;
    const result = await pool.query(
      `${BASE_SELECT}
       WHERE A.nombre ILIKE $1
          OR A.identificacion ILIKE $1
          OR A.telefono ILIKE $1
          OR A.direccion ILIKE $1
       ORDER BY A.id`,
      [term]
    );
    return result.rows ?? [];
  }

  const result = await pool.query(`${BASE_SELECT} ORDER BY A.id`);
  return result.rows ?? [];
};

export const findProveedorById = async (id) => {
  const result = await pool.query(
    `${BASE_SELECT}
     WHERE A.id = $1`,
    [id]
  );
  return result.rows?.[0] ?? null;
};

export const exportProveedores = async (searchTerm) => {
  const filters = [];
  const values = [];

  if (searchTerm && searchTerm.trim().length > 0) {
    const term = `%${searchTerm.trim()}%`;
    values.push(term);
    filters.push(
      `(A.NOMBRE ILIKE $${values.length}
        OR A.IDENTIFICACION ILIKE $${values.length}
        OR A.TELEFONO ILIKE $${values.length}
        OR A.DIRECCION ILIKE $${values.length})`
    );
  }

  const filterClause = filters.length ? `\n  AND ${filters.join("\n  AND ")}` : "";

  const result = await pool.query(
    `SELECT
    A.ID,
    A.NOMBRE,
    A.IDENTIFICACION,
    A.TELEFONO,
    A.DIRECCION,
    A.ACTIVO,
    A.FECHA_CREACION
FROM PUBLIC.PROVEEDORES A
WHERE 1=1${filterClause}
ORDER BY A.FECHA_CREACION DESC;
-- Comentario: PUBLIC.PROVEEDORES A tabla principal; filtros = los del UI; export sin LIMIT/OFFSET.`,
    values
  );

  return result.rows ?? [];
};

export const insertProveedor = async (data) => {
  const { nombre, identificacion = "", direccion = "", telefono = "", activo = true } = data;
  const result = await pool.query(
    `INSERT INTO public.proveedores (nombre, identificacion, direccion, telefono, activo)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, nombre, identificacion, direccion, telefono, activo, fecha_creacion`,
    [nombre, identificacion, direccion, telefono, Boolean(activo)]
  );
  return result.rows?.[0] ?? null;
};

export const updateProveedorById = async (id, updates) => {
  const sets = [];
  const values = [];
  let index = 1;

  if (updates.nombre !== undefined) {
    sets.push(`nombre = $${index}`);
    values.push(updates.nombre);
    index += 1;
  }

  if (updates.identificacion !== undefined) {
    sets.push(`identificacion = $${index}`);
    values.push(updates.identificacion);
    index += 1;
  }

  if (updates.direccion !== undefined) {
    sets.push(`direccion = $${index}`);
    values.push(updates.direccion);
    index += 1;
  }

  if (updates.telefono !== undefined) {
    sets.push(`telefono = $${index}`);
    values.push(updates.telefono);
    index += 1;
  }

  if (updates.activo !== undefined) {
    sets.push(`activo = $${index}`);
    values.push(Boolean(updates.activo));
    index += 1;
  }

  if (sets.length === 0) {
    return null;
  }

  values.push(id);

  const result = await pool.query(
    `UPDATE public.proveedores
        SET ${sets.join(", ")}
      WHERE id = $${index}
      RETURNING id, nombre, identificacion, direccion, telefono, activo, fecha_creacion`,
    values
  );

  return result.rows?.[0] ?? null;
};

export const deleteProveedorById = async (id) => {
  const result = await pool.query(
    `DELETE FROM public.proveedores
      WHERE id = $1
      RETURNING id`,
    [id]
  );
  return result.rows?.[0] ?? null;
};

export default {
  findAllProveedores,
  findProveedorById,
  exportProveedores,
  insertProveedor,
  updateProveedorById,
  deleteProveedorById,
};
