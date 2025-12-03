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
  const { search = "", page, limit } = req.query ?? {};

  const filters = [];
  const filterValues = [];

  if (typeof search === "string" && search.trim()) {
    filterValues.push(`%${search.trim()}%`);
    filters.push(`nombre ILIKE $${filterValues.length}`);
  }

  const whereClause = filters.length > 0 ? `WHERE ${filters.join(" AND ")}` : "";
  const orderClause = "ORDER BY id";

  let paginationClause = "";
  const pageNumber = Number(page);
  const pageSize = Number(limit);
  const hasPagination =
    Number.isFinite(pageNumber) && pageNumber >= 0 && Number.isFinite(pageSize) && pageSize > 0;

  const dataValues = [...filterValues];

  if (hasPagination) {
    const offset = pageNumber * pageSize;
    const limitIndex = dataValues.length + 1;
    const offsetIndex = dataValues.length + 2;
    paginationClause = ` LIMIT $${limitIndex} OFFSET $${offsetIndex}`;
    dataValues.push(pageSize, offset);
  }

  try {
    const baseQuery = `FROM public.catalogo_tipo_equipo_afectado ${whereClause}`;
    const countResult = await pool.query(`SELECT COUNT(*) ${baseQuery}`, filterValues);
    const totalRecords = Number(countResult.rows[0]?.count ?? 0);

    const result = await pool.query(
      `SELECT id, nombre, descripcion, activo, fecha_creacion ${baseQuery} ${orderClause}${paginationClause}`,
      dataValues
    );

    const items = result.rows.map(mapRow);
    const responsePayload = {
      data: items,
      total: totalRecords,
      page: hasPagination ? pageNumber : 0,
      limit: hasPagination ? pageSize : items.length,
    };

    res.status(200).json(responsePayload);
  } catch (error) {
    console.error("Error al listar tipos de equipo afectado:", error);
    res
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
