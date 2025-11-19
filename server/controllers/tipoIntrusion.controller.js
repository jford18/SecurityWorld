import pool from "../db.js";

const RECORD_NOT_FOUND_MESSAGE = "El tipo de intrusión solicitado no existe";

const formatSuccess = (message, data = null) => ({
  status: "success",
  message,
  data,
});

const formatError = (message) => ({
  status: "error",
  message,
});

const normalizeActiveValue = (value) => {
  if (value === undefined) return undefined;
  return typeof value === "string"
    ? ["1", "true", "t", "on"].includes(value.trim().toLowerCase())
    : Boolean(value);
};

export const listTiposIntrusion = async (req, res) => {
  const { search = "", page, limit } = req.query ?? {};

  const filters = [];
  const values = [];

  if (typeof search === "string" && search.trim()) {
    values.push(`%${search.trim()}%`);
    filters.push(`descripcion ILIKE $${values.length}`);
  }

  const whereClause = filters.length > 0 ? `WHERE ${filters.join(" AND ")}` : "";
  const orderClause = "ORDER BY id";

  let paginationClause = "";
  const pageNumber = Number(page);
  const pageSize = Number(limit);

  if (Number.isFinite(pageNumber) && Number.isFinite(pageSize) && pageNumber > 0 && pageSize > 0) {
    const offset = (pageNumber - 1) * pageSize;
    values.push(pageSize, offset);
    paginationClause = ` LIMIT $${values.length - 1} OFFSET $${values.length}`;
  }

  try {
    const result = await pool.query(
      `SELECT id, descripcion, activo, fecha_creacion FROM catalogo_tipo_intrusion ${whereClause} ${orderClause}${paginationClause}`.trim(),
      values
    );

    res
      .status(200)
      .json(formatSuccess("Listado de tipos de intrusión", result.rows));
  } catch (error) {
    console.error("Error al listar tipos de intrusión:", error);
    res
      .status(500)
      .json(formatError("Error al listar los tipos de intrusión"));
  }
};

export const getTipoIntrusionById = async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      "SELECT id, descripcion, activo, fecha_creacion FROM catalogo_tipo_intrusion WHERE id = $1",
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json(formatError(RECORD_NOT_FOUND_MESSAGE));
    }

    res
      .status(200)
      .json(
        formatSuccess(
          "Tipo de intrusión obtenido correctamente",
          result.rows[0]
        )
      );
  } catch (error) {
    console.error("Error al obtener tipo de intrusión:", error);
    res.status(500).json(formatError("Error al obtener el tipo de intrusión"));
  }
};

export const createTipoIntrusion = async (req, res) => {
  const { descripcion, activo } = req.body ?? {};
  const trimmedDescripcion =
    typeof descripcion === "string" ? descripcion.trim() : "";

  if (!trimmedDescripcion) {
    return res
      .status(422)
      .json(formatError("La descripción del tipo de intrusión es obligatoria"));
  }

  try {
    const duplicate = await pool.query(
      "SELECT id FROM catalogo_tipo_intrusion WHERE LOWER(descripcion) = LOWER($1)",
      [trimmedDescripcion]
    );

    if (duplicate.rowCount > 0) {
      return res
        .status(409)
        .json(formatError("Ya existe un tipo de intrusión con esa descripción"));
    }

    const normalizedActive = normalizeActiveValue(activo);
    const insertResult = await pool.query(
      "INSERT INTO catalogo_tipo_intrusion (descripcion, activo) VALUES ($1, COALESCE($2, true)) RETURNING id, descripcion, activo, fecha_creacion",
      [trimmedDescripcion, normalizedActive]
    );

    res
      .status(201)
      .json(
        formatSuccess(
          "Tipo de intrusión creado correctamente",
          insertResult.rows[0]
        )
      );
  } catch (error) {
    console.error("Error al crear tipo de intrusión:", error);
    res
      .status(500)
      .json(formatError("Error al crear el tipo de intrusión"));
  }
};

export const updateTipoIntrusion = async (req, res) => {
  const { id } = req.params;
  const { descripcion, activo } = req.body ?? {};

  const updates = [];
  const values = [];
  let index = 1;

  if (descripcion !== undefined) {
    const trimmedDescripcion =
      typeof descripcion === "string" ? descripcion.trim() : "";

    if (!trimmedDescripcion) {
      return res
        .status(422)
        .json(formatError("La descripción del tipo de intrusión es obligatoria"));
    }

    try {
      const duplicate = await pool.query(
        "SELECT id FROM catalogo_tipo_intrusion WHERE LOWER(descripcion) = LOWER($1) AND id <> $2",
        [trimmedDescripcion, id]
      );

      if (duplicate.rowCount > 0) {
        return res
          .status(409)
          .json(formatError("Ya existe un tipo de intrusión con esa descripción"));
      }
    } catch (error) {
      console.error("Error al validar duplicados de tipo de intrusión:", error);
      return res
        .status(500)
        .json(formatError("Error al actualizar el tipo de intrusión"));
    }

    updates.push(`descripcion = $${index}`);
    values.push(trimmedDescripcion);
    index += 1;
  }

  if (activo !== undefined) {
    const normalizedActive = normalizeActiveValue(activo);
    updates.push(`activo = $${index}`);
    values.push(normalizedActive);
    index += 1;
  }

  if (updates.length === 0) {
    return res
      .status(400)
      .json(formatError("No se enviaron campos para actualizar"));
  }

  values.push(id);

  try {
    const result = await pool.query(
      `UPDATE catalogo_tipo_intrusion SET ${updates.join(", ")} WHERE id = $${index} RETURNING id, descripcion, activo, fecha_creacion`,
      values
    );

    if (result.rowCount === 0) {
      return res.status(404).json(formatError(RECORD_NOT_FOUND_MESSAGE));
    }

    res
      .status(200)
      .json(
        formatSuccess(
          "Tipo de intrusión actualizado correctamente",
          result.rows[0]
        )
      );
  } catch (error) {
    console.error("Error al actualizar tipo de intrusión:", error);
    res
      .status(500)
      .json(formatError("Error al actualizar el tipo de intrusión"));
  }
};

export const deleteTipoIntrusion = async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      "UPDATE catalogo_tipo_intrusion SET activo = false WHERE id = $1 AND activo = true RETURNING id",
      [id]
    );

    if (result.rowCount === 0) {
      return res
        .status(404)
        .json(formatError("El tipo de intrusión ya estaba inactivo o no existe"));
    }

    res
      .status(200)
      .json(formatSuccess("Tipo de intrusión desactivado correctamente"));
  } catch (error) {
    console.error("Error al desactivar tipo de intrusión:", error);
    res
      .status(500)
      .json(formatError("Error al desactivar el tipo de intrusión"));
  }
};
