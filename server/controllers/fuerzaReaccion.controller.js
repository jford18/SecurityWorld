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

const TABLE = "catalogo_fuerza_reaccion";

export const listFuerzasReaccion = async (req, res) => {
  const searchRaw = req.query?.search;
  const searchTerm =
    typeof searchRaw === "string" && searchRaw.trim().length > 0
      ? `%${searchRaw.trim()}%`
      : null;

  const params = [];
  const conditions = [];

  if (searchTerm) {
    params.push(searchTerm);
    conditions.push(`descripcion ILIKE $${params.length}`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  try {
    const result = await pool.query(
      `SELECT id, descripcion, activo, fecha_creacion FROM ${TABLE} ${whereClause} ORDER BY id ASC`,
      params
    );

    res
      .status(200)
      .json(formatSuccess("Listado de fuerzas de reacción", result.rows));
  } catch (error) {
    console.error("Error al listar fuerzas de reacción:", error);
    res.status(500).json(formatError("Error al listar las fuerzas de reacción"));
  }
};

export const getFuerzaReaccionById = async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      `SELECT id, descripcion, activo, fecha_creacion FROM ${TABLE} WHERE id = $1`,
      [id]
    );

    if (result.rowCount === 0) {
      return res
        .status(404)
        .json(formatError("La fuerza de reacción solicitada no existe"));
    }

    res
      .status(200)
      .json(
        formatSuccess("Fuerza de reacción obtenida correctamente", result.rows[0])
      );
  } catch (error) {
    console.error("Error al obtener fuerza de reacción:", error);
    res.status(500).json(formatError("Error al obtener la fuerza de reacción"));
  }
};

const normalizeDescripcion = (descripcion) =>
  typeof descripcion === "string" ? descripcion.trim() : "";

const normalizeActivo = (activo) => {
  if (activo === undefined) {
    return true;
  }

  if (typeof activo === "string") {
    return ["1", "true", "t", "on", "si", "sí"].includes(
      activo.trim().toLowerCase()
    );
  }

  return Boolean(activo);
};

export const createFuerzaReaccion = async (req, res) => {
  const { descripcion, activo } = req.body ?? {};
  const normalizedDescripcion = normalizeDescripcion(descripcion);

  if (!normalizedDescripcion) {
    return res
      .status(422)
      .json(formatError("La descripción de la fuerza de reacción es obligatoria"));
  }

  try {
    const duplicate = await pool.query(
      `SELECT id FROM ${TABLE} WHERE LOWER(descripcion) = LOWER($1)`,
      [normalizedDescripcion]
    );

    if (duplicate.rowCount > 0) {
      return res
        .status(409)
        .json(formatError("Ya existe una fuerza de reacción con esa descripción"));
    }

    const result = await pool.query(
      `INSERT INTO ${TABLE} (descripcion, activo) VALUES ($1, $2) RETURNING id, descripcion, activo, fecha_creacion`,
      [normalizedDescripcion, normalizeActivo(activo)]
    );

    res
      .status(201)
      .json(
        formatSuccess(
          "Fuerza de reacción creada correctamente",
          result.rows[0]
        )
      );
  } catch (error) {
    console.error("Error al crear fuerza de reacción:", error);
    res
      .status(500)
      .json(formatError("Error al crear la fuerza de reacción"));
  }
};

export const updateFuerzaReaccion = async (req, res) => {
  const { id } = req.params;
  const { descripcion, activo } = req.body ?? {};

  const updates = [];
  const values = [];
  let index = 1;

  if (descripcion !== undefined) {
    const normalizedDescripcion = normalizeDescripcion(descripcion);

    if (!normalizedDescripcion) {
      return res
        .status(422)
        .json(formatError("La descripción de la fuerza de reacción es obligatoria"));
    }

    try {
      const duplicate = await pool.query(
        `SELECT id FROM ${TABLE} WHERE LOWER(descripcion) = LOWER($1) AND id <> $2`,
        [normalizedDescripcion, id]
      );

      if (duplicate.rowCount > 0) {
        return res
          .status(409)
          .json(formatError("Ya existe una fuerza de reacción con esa descripción"));
      }
    } catch (error) {
      console.error("Error al validar duplicados de fuerza de reacción:", error);
      return res
        .status(500)
        .json(formatError("Error al actualizar la fuerza de reacción"));
    }

    updates.push(`descripcion = $${index}`);
    values.push(normalizedDescripcion);
    index += 1;
  }

  if (activo !== undefined) {
    updates.push(`activo = $${index}`);
    values.push(normalizeActivo(activo));
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
      `UPDATE ${TABLE} SET ${updates.join(", ")} WHERE id = $${index} RETURNING id, descripcion, activo, fecha_creacion`,
      values
    );

    if (result.rowCount === 0) {
      return res
        .status(404)
        .json(formatError("La fuerza de reacción solicitada no existe"));
    }

    res
      .status(200)
      .json(
        formatSuccess("Fuerza de reacción actualizada correctamente", result.rows[0])
      );
  } catch (error) {
    console.error("Error al actualizar fuerza de reacción:", error);
    res
      .status(500)
      .json(formatError("Error al actualizar la fuerza de reacción"));
  }
};

export const deleteFuerzaReaccion = async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      `UPDATE ${TABLE} SET activo = false WHERE id = $1 AND activo = true RETURNING id`,
      [id]
    );

    if (result.rowCount === 0) {
      return res
        .status(404)
        .json(formatError("La fuerza de reacción ya estaba inactiva o no existe"));
    }

    res
      .status(200)
      .json(formatSuccess("Fuerza de reacción desactivada correctamente"));
  } catch (error) {
    console.error("Error al desactivar fuerza de reacción:", error);
    res
      .status(500)
      .json(formatError("Error al desactivar la fuerza de reacción"));
  }
};
