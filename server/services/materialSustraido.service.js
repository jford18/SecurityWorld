import pool from '../db.js';
import {
  buildMaterialSustraidoCountQuery,
  buildMaterialSustraidoListQuery,
  buildUpdateMaterialSustraidoQuery,
  findMaterialSustraidoByDescripcionQuery,
  getMaterialSustraidoByIdQuery,
  insertMaterialSustraidoQuery,
  softDeleteMaterialSustraidoQuery,
} from '../queries/materialSustraido.queries.js';

const normalizeText = (value) => (typeof value === 'string' ? value.trim() : '');

const normalizeBoolean = (value, defaultValue = null) => {
  if (value === undefined || value === null) {
    return defaultValue;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return value !== 0;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['1', 'true', 't', 'on', 'si', 'sí', 'activo', 'yes', 'y'].includes(normalized)) {
      return true;
    }
    if (['0', 'false', 'f', 'off', 'no', 'n', 'inactivo'].includes(normalized)) {
      return false;
    }
  }

  return defaultValue;
};

const mapRow = (row) => ({
  id: row.id,
  descripcion: row.descripcion,
  estado: row.estado,
});

export const listMaterialSustraido = async ({ search, estado, page, limit } = {}) => {
  const filters = [];
  const values = [];

  const searchValue = normalizeText(search);
  if (searchValue) {
    values.push(`%${searchValue}%`);
    filters.push(`A.DESCRIPCION ILIKE $${values.length}`);
  }

  const estadoValue = normalizeBoolean(estado, null);
  if (estadoValue !== null) {
    values.push(estadoValue);
    filters.push(`A.ESTADO = $${values.length}`);
  }

  const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

  const parsedPage = Number.parseInt(page, 10);
  const parsedLimit = Number.parseInt(limit, 10);
  const safePage = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const safeLimit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 10;
  const offset = (safePage - 1) * safeLimit;

  const countQuery = buildMaterialSustraidoCountQuery(whereClause);
  const countResult = await pool.query(countQuery, values);
  const total = Number(countResult.rows?.[0]?.total ?? 0);

  const dataQuery = buildMaterialSustraidoListQuery(
    whereClause,
    values.length + 1,
    values.length + 2
  );
  const dataParams = [...values, safeLimit, offset];
  const dataResult = await pool.query(dataQuery, dataParams);

  return {
    data: dataResult.rows.map(mapRow),
    total,
  };
};

export const getMaterialSustraidoById = async (id) => {
  const result = await pool.query(getMaterialSustraidoByIdQuery, [id]);
  return result.rowCount > 0 ? mapRow(result.rows[0]) : null;
};

export const findMaterialSustraidoByDescripcion = async (descripcion, excludeId) => {
  const trimmed = normalizeText(descripcion);
  if (!trimmed) {
    return null;
  }

  const query = findMaterialSustraidoByDescripcionQuery(excludeId);
  const params = excludeId ? [trimmed, excludeId] : [trimmed];
  const result = await pool.query(query, params);
  return result.rowCount > 0 ? result.rows[0] : null;
};

export const createMaterialSustraido = async ({ descripcion, estado }) => {
  const trimmed = normalizeText(descripcion);
  const normalizedEstado = normalizeBoolean(estado, true);
  const result = await pool.query(insertMaterialSustraidoQuery, [trimmed, normalizedEstado]);
  return mapRow(result.rows[0]);
};

export const updateMaterialSustraido = async (id, { descripcion, estado } = {}) => {
  const updates = [];
  const values = [];
  let index = 1;

  if (descripcion !== undefined) {
    const trimmed = normalizeText(descripcion);
    updates.push(`DESCRIPCION = $${index}`);
    values.push(trimmed);
    index += 1;
  }

  if (estado !== undefined) {
    const normalizedEstado = normalizeBoolean(estado, null);
    updates.push(`ESTADO = $${index}`);
    values.push(normalizedEstado);
    index += 1;
  }

  if (updates.length === 0) {
    return null;
  }

  values.push(id);

  const query = buildUpdateMaterialSustraidoQuery(updates.join(', '), index);
  const result = await pool.query(query, values);
  return result.rowCount > 0 ? mapRow(result.rows[0]) : null;
};

export const softDeleteMaterialSustraido = async (id) => {
  const result = await pool.query(softDeleteMaterialSustraidoQuery, [id]);
  return result.rowCount > 0;
};
