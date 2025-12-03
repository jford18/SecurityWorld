import pool from "../db.js";

const formatSuccess = (message, data = null) => ({
  status: "success",
  message,
  data,
});

const formatError = (message) => ({
  status: "error",
  message,
});

const normalizeBoolean = (value, defaultValue = true) => {
  if (value === undefined) return defaultValue;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return ["true", "1", "t", "on", "yes", "y", "si", "sí"].includes(normalized);
  }
  return Boolean(value);
};

const mapRow = (row) => ({
  id: row.id,
  nombre: row.nombre,
  descripcion: row.descripcion ?? null,
  activo: row.activo,
  fecha_creacion: row.fecha_creacion,
});

export const listCatalogoTipoEquipoAfectado = async (req, res) => {
  try {
    const { search = "", page = 0, limit = 10 } = req.query ?? {};

    // Normalización segura de page y limit
    const safePageNumber = Number.parseInt(page, 10);
    const safePageSize = Number.parseInt(limit, 10);

    const safePage = Number.isFinite(safePageNumber) && safePageNumber >= 0 ? safePageNumber : 0;
    const safeLimit = Number.isFinite(safePageSize) && safePageSize > 0 ? safePageSize : 10;

    const offset = safePage * safeLimit;

    // Filtros dinámicos
    const filters = [];
    const params = [];

    if (typeof search === "string" && search.trim()) {
      params.push(`%${search.trim()}%`);
      filters.push(`nombre ILIKE $${params.length}`);
    }

    const whereClause = filters.length > 0 ? `WHERE ${filters.join(" AND ")}` : "";

    // 1) Total de registros (sin paginar)
    const totalQuery = `
      SELECT COUNT(*) AS total
      FROM public.catalogo_tipo_equipo_afectado
      ${whereClause}
    `;

    const totalResult = await pool.query(totalQuery, params);
    const totalRecords = Number(totalResult.rows[0]?.total ?? 0);

    // 2) Datos paginados
    // OJO: LIMIT y OFFSET usan SIEMPRE los dos últimos parámetros,
    // por eso se construyen con params.length + 1 y params.length + 2
    const dataQuery = `
      SELECT id, nombre, descripcion, activo, fecha_creacion
      FROM public.catalogo_tipo_equipo_afectado
      ${whereClause}
      ORDER BY id ASC
      LIMIT $${params.length + 1}
      OFFSET $${params.length + 2}
    `;

    const dataParams = [...params, safeLimit, offset];
    const result = await pool.query(dataQuery, dataParams);

    const items = result.rows.map(mapRow);

    return res.status(200).json({
      data: items,
      total: totalRecords,
    });
  } catch (error) {
    console.error("Error al listar tipos de equipo afectado:", error);
    return res
      .status(500)
      .json(formatError("Error al listar los tipos de equipo afectado"));
  }
};

export const getCatalogoTipoEquipoAfectadoById = async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      "SELECT id, nombre, descripcion, activo, fecha_creacion FROM public.catalogo_tipo_equipo_afectado WHERE id = $1",
      [id]
    );

    if (result.rowCount === 0) {
      return res
        .status(404)
        .json(formatError("El tipo de equipo afectado solicitado no existe"));
    }

    res
      .status(200)
      .json(
        formatSuccess(
          "Tipo de equipo afectado obtenido correctamente",
          mapRow(result.rows[0])
        )
      );
  } catch (error) {
    console.error("Error al obtener tipo de equipo afectado:", error);
    res
      .status(500)
      .json(formatError("Error al obtener el tipo de equipo afectado"));
  }
};

export const createCatalogoTipoEquipoAfectado = async (req, res) => {
  const { nombre, descripcion, activo } = req.body ?? {};
  const trimmedNombre = typeof nombre === "string" ? nombre.trim() : "";

  if (!trimmedNombre) {
    return res
      .status(400)
      .json(formatError("El nombre es obligatorio"));
  }

  try {
    const normalizedActivo = normalizeBoolean(activo, true);
    const result = await pool.query(
      "INSERT INTO public.catalogo_tipo_equipo_afectado (nombre, descripcion, activo) VALUES ($1, $2, $3) RETURNING id, nombre, descripcion, activo, fecha_creacion",
      [trimmedNombre, descripcion ?? null, normalizedActivo]
    );

    res
      .status(201)
      .json(
        formatSuccess(
          "Tipo de equipo afectado creado correctamente",
          mapRow(result.rows[0])
        )
      );
  } catch (error) {
    console.error("Error al crear tipo de equipo afectado:", error);
    res
      .status(500)
      .json(formatError("Error al crear el tipo de equipo afectado"));
  }
};

export const updateCatalogoTipoEquipoAfectado = async (req, res) => {
  const { id } = req.params;
  const { nombre, descripcion, activo } = req.body ?? {};

  const trimmedNombre = typeof nombre === "string" ? nombre.trim() : "";
  if (!trimmedNombre) {
    return res
      .status(400)
      .json(formatError("El nombre es obligatorio"));
  }

  const normalizedActivo = normalizeBoolean(activo, true);

  try {
    const result = await pool.query(
      "UPDATE public.catalogo_tipo_equipo_afectado SET nombre = $1, descripcion = $2, activo = $3 WHERE id = $4 RETURNING id, nombre, descripcion, activo, fecha_creacion",
      [trimmedNombre, descripcion ?? null, normalizedActivo, id]
    );

    if (result.rowCount === 0) {
      return res
        .status(404)
        .json(formatError("El tipo de equipo afectado indicado no existe"));
    }

    res
      .status(200)
      .json(
        formatSuccess(
          "Tipo de equipo afectado actualizado correctamente",
          mapRow(result.rows[0])
        )
      );
  } catch (error) {
    console.error("Error al actualizar tipo de equipo afectado:", error);
    res
      .status(500)
      .json(formatError("Error al actualizar el tipo de equipo afectado"));
  }
};

export const deleteCatalogoTipoEquipoAfectado = async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      "DELETE FROM public.catalogo_tipo_equipo_afectado WHERE id = $1 RETURNING id",
      [id]
    );

    if (result.rowCount === 0) {
      return res
        .status(404)
        .json(formatError("El tipo de equipo afectado indicado no existe"));
    }

    res.status(204).send();
  } catch (error) {
    console.error("Error al eliminar tipo de equipo afectado:", error);
    res
      .status(500)
      .json(formatError("Error al eliminar el tipo de equipo afectado"));
  }
};
