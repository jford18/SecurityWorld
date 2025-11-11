import pool from '../db.js';

export const getAll = async () => {
  const result = await pool.query('SELECT * FROM "tipo_Area" ORDER BY id ASC');
  return result.rows;
};

export const getById = async (id) => {
  const result = await pool.query('SELECT * FROM "tipo_Area" WHERE id = $1', [id]);
  return result.rows[0];
};

export const create = async (tipoArea) => {
  const { nombre, descripcion } = tipoArea;
  const result = await pool.query(
    'INSERT INTO "tipo_Area" (nombre, descripcion) VALUES ($1, $2) RETURNING *',
    [nombre, descripcion]
  );
  return result.rows[0];
};

export const update = async (id, tipoArea) => {
  const { nombre, descripcion, activo } = tipoArea;
  const result = await pool.query(
    'UPDATE "tipo_Area" SET nombre = $1, descripcion = $2, activo = $3, fecha_actualizacion = NOW() WHERE id = $4 RETURNING *',
    [nombre, descripcion, activo, id]
  );
  return result.rows[0];
};

export const logicalDelete = async (id) => {
    const result = await pool.query(
    'UPDATE "tipo_Area" SET activo = FALSE, fecha_actualizacion = NOW() WHERE id = $1 RETURNING *',
    [id]
  );
  return result.rows[0];
};
