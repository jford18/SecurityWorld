import pool from "../db.js";

const BASE_SELECT = `
  SELECT id, nombre, identificacion, direccion, telefono, activo, fecha_creacion
    FROM public.proveedores
`;

export const findAllProveedores = async (searchTerm) => {
  if (searchTerm && searchTerm.trim().length > 0) {
    const term = `%${searchTerm.trim()}%`;
    const result = await pool.query(
      `${BASE_SELECT}
       WHERE nombre ILIKE $1
          OR identificacion ILIKE $1
          OR telefono ILIKE $1
          OR direccion ILIKE $1
       ORDER BY id`,
      [term]
    );
    return result.rows ?? [];
  }

  const result = await pool.query(`${BASE_SELECT} ORDER BY id`);
  return result.rows ?? [];
};

export const findProveedorById = async (id) => {
  const result = await pool.query(
    `${BASE_SELECT}
     WHERE id = $1`,
    [id]
  );
  return result.rows?.[0] ?? null;
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
  insertProveedor,
  updateProveedorById,
  deleteProveedorById,
};
