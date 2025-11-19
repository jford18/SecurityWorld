import pool from "../db.js";

const TABLE_NAME = "catalogo_conclusion_evento";

const formatSuccess = (message, data = null) => ({
  status: "success",
  message,
  data,
});

const formatError = (message) => ({
  status: "error",
  message,
});

const normalizeBoolean = (value, defaultValue = false) => {
  if (value === undefined) {
    return defaultValue;
  }

  if (typeof value === "string") {
    return ["1", "true", "t", "on", "si", "sí"].includes(value.trim().toLowerCase());
  }

  return Boolean(value);
};

export const listConclusionesEvento = async (req, res) => {
  const search = typeof req.query.search === "string" ? req.query.search.trim() : "";

  try {
    const values = [];
    let query = `SELECT id, descripcion, activo, fecha_creacion FROM ${TABLE_NAME}`;

    if (search) {
      values.push(`%${search}%`);
      query += ` WHERE descripcion ILIKE $${values.length}`;
    }

    query += " ORDER BY id ASC";

    const result = await pool.query(query, values);

    res
      .status(200)
      .json(formatSuccess("Listado de conclusiones del evento", result.rows));
  } catch (error) {
    console.error("Error al listar conclusiones del evento:", error);
    res
      .status(500)
      .json(formatError("Error al listar las conclusiones del evento"));
  }
};

export const getConclusionEventoById = async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      `SELECT id, descripcion, activo, fecha_creacion FROM ${TABLE_NAME} WHERE id = $1`,
      [id]
    );

    if (result.rowCount === 0) {
      return res
        .status(404)
        .json(formatError("La conclusión del evento solicitada no existe"));
    }

    res
      .status(200)
      .json(formatSuccess("Conclusión del evento obtenida correctamente", result.rows[0]));
  } catch (error) {
    console.error("Error al obtener conclusión del evento:", error);
    res
      .status(500)
      .json(formatError("Error al obtener la conclusión del evento"));
  }
};

export const createConclusionEvento = async (req, res) => {
  const { descripcion, activo } = req.body ?? {};
  const trimmedDescription = typeof descripcion === "string" ? descripcion.trim() : "";

  if (!trimmedDescription) {
    return res
      .status(422)
      .json(formatError("La descripción de la conclusión es obligatoria"));
  }

  try {
    const duplicate = await pool.query(
      `SELECT id FROM ${TABLE_NAME} WHERE LOWER(descripcion) = LOWER($1)`,
      [trimmedDescription]
    );

    if (duplicate.rowCount > 0) {
      return res
        .status(409)
        .json(formatError("Ya existe una conclusión del evento con esa descripción"));
    }

    const normalizedActive = normalizeBoolean(activo, true);

    const insertResult = await pool.query(
      `INSERT INTO ${TABLE_NAME} (descripcion, activo) VALUES ($1, $2) RETURNING id, descripcion, activo, fecha_creacion`,
      [trimmedDescription, normalizedActive]
    );

    res
      .status(201)
      .json(
        formatSuccess(
          "Conclusión del evento creada correctamente",
          insertResult.rows[0]
        )
      );
  } catch (error) {
    console.error("Error al crear conclusión del evento:", error);
    res
      .status(500)
      .json(formatError("Error al crear la conclusión del evento"));
  }
};

export const updateConclusionEvento = async (req, res) => {
  const { id } = req.params;
  const { descripcion, activo } = req.body ?? {};

  const updates = [];
  const values = [];
  let index = 1;

  if (descripcion !== undefined) {
    const trimmedDescription = typeof descripcion === "string" ? descripcion.trim() : "";

    if (!trimmedDescription) {
      return res
        .status(422)
        .json(formatError("La descripción de la conclusión es obligatoria"));
    }

    try {
      const duplicate = await pool.query(
        `SELECT id FROM ${TABLE_NAME} WHERE LOWER(descripcion) = LOWER($1) AND id <> $2`,
        [trimmedDescription, id]
      );

      if (duplicate.rowCount > 0) {
        return res
          .status(409)
          .json(formatError("Ya existe una conclusión del evento con esa descripción"));
      }
    } catch (error) {
      console.error("Error al validar duplicados de conclusión del evento:", error);
      return res
        .status(500)
        .json(formatError("Error al actualizar la conclusión del evento"));
    }

    updates.push(`descripcion = $${index}`);
    values.push(trimmedDescription);
    index += 1;
  }

  if (activo !== undefined) {
    const normalizedActive = normalizeBoolean(activo);
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
      `UPDATE ${TABLE_NAME} SET ${updates.join(", ")} WHERE id = $${index} RETURNING id, descripcion, activo, fecha_creacion`,
      values
    );

    if (result.rowCount === 0) {
      return res
        .status(404)
        .json(formatError("La conclusión del evento solicitada no existe"));
    }

    res
      .status(200)
      .json(formatSuccess("Conclusión del evento actualizada correctamente", result.rows[0]));
  } catch (error) {
    console.error("Error al actualizar conclusión del evento:", error);
    res
      .status(500)
      .json(formatError("Error al actualizar la conclusión del evento"));
  }
};

export const deleteConclusionEvento = async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      `UPDATE ${TABLE_NAME} SET activo = false WHERE id = $1 AND activo = true RETURNING id`,
      [id]
    );

    if (result.rowCount === 0) {
      return res
        .status(404)
        .json(formatError("La conclusión del evento ya estaba inactiva o no existe"));
    }

    res
      .status(200)
      .json(formatSuccess("Conclusión del evento desactivada correctamente"));
  } catch (error) {
    console.error("Error al desactivar conclusión del evento:", error);
    res
      .status(500)
      .json(formatError("Error al desactivar la conclusión del evento"));
  }
};
