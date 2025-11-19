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

const normalizeBoolean = (value, defaultValue = false) => {
  if (value === undefined) {
    return defaultValue;
  }

  if (typeof value === "string") {
    return ["1", "true", "t", "on", "si", "sí"].includes(value.trim().toLowerCase());
  }

  return Boolean(value);
};

export const listCargos = async (req, res) => {
  const search = typeof req.query.search === "string" ? req.query.search.trim() : "";

  try {
    const values = [];
    let query =
      "SELECT id, descripcion, activo, fecha_creacion FROM catalogo_cargo";

    if (search) {
      values.push(`%${search}%`);
      query += ` WHERE descripcion ILIKE $${values.length}`;
    }

    query += " ORDER BY id ASC";

    const result = await pool.query(query, values);

    res
      .status(200)
      .json(formatSuccess("Listado de cargos", result.rows));
  } catch (error) {
    console.error("Error al listar cargos:", error);
    res.status(500).json(formatError("Error al listar los cargos"));
  }
};

export const getCargoById = async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      "SELECT id, descripcion, activo, fecha_creacion FROM catalogo_cargo WHERE id = $1",
      [id]
    );

    if (result.rowCount === 0) {
      return res
        .status(404)
        .json(formatError("El cargo solicitado no existe"));
    }

    res
      .status(200)
      .json(formatSuccess("Cargo obtenido correctamente", result.rows[0]));
  } catch (error) {
    console.error("Error al obtener cargo:", error);
    res.status(500).json(formatError("Error al obtener el cargo"));
  }
};

export const createCargo = async (req, res) => {
  const { descripcion, activo } = req.body ?? {};
  const trimmedDescription =
    typeof descripcion === "string" ? descripcion.trim() : "";

  if (!trimmedDescription) {
    return res
      .status(422)
      .json(formatError("La descripción del cargo es obligatoria"));
  }

  try {
    const duplicate = await pool.query(
      "SELECT id FROM catalogo_cargo WHERE LOWER(descripcion) = LOWER($1)",
      [trimmedDescription]
    );

    if (duplicate.rowCount > 0) {
      return res
        .status(409)
        .json(formatError("Ya existe un cargo con esa descripción"));
    }

    const normalizedActive = normalizeBoolean(activo, true);

    const insertResult = await pool.query(
      "INSERT INTO catalogo_cargo (descripcion, activo) VALUES ($1, $2) RETURNING id, descripcion, activo, fecha_creacion",
      [trimmedDescription, normalizedActive]
    );

    res
      .status(201)
      .json(
        formatSuccess(
          "Cargo creado correctamente",
          insertResult.rows[0]
        )
      );
  } catch (error) {
    console.error("Error al crear cargo:", error);
    res.status(500).json(formatError("Error al crear el cargo"));
  }
};

export const updateCargo = async (req, res) => {
  const { id } = req.params;
  const { descripcion, activo } = req.body ?? {};

  const updates = [];
  const values = [];
  let index = 1;

  if (descripcion !== undefined) {
    const trimmedDescription =
      typeof descripcion === "string" ? descripcion.trim() : "";

    if (!trimmedDescription) {
      return res
        .status(422)
        .json(formatError("La descripción del cargo es obligatoria"));
    }

    try {
      const duplicate = await pool.query(
        "SELECT id FROM catalogo_cargo WHERE LOWER(descripcion) = LOWER($1) AND id <> $2",
        [trimmedDescription, id]
      );

      if (duplicate.rowCount > 0) {
        return res
          .status(409)
          .json(formatError("Ya existe un cargo con esa descripción"));
      }
    } catch (error) {
      console.error("Error al validar duplicados de cargo:", error);
      return res
        .status(500)
        .json(formatError("Error al actualizar el cargo"));
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
      `UPDATE catalogo_cargo SET ${updates.join(", ")} WHERE id = $${index} RETURNING id, descripcion, activo, fecha_creacion`,
      values
    );

    if (result.rowCount === 0) {
      return res
        .status(404)
        .json(formatError("El cargo solicitado no existe"));
    }

    res
      .status(200)
      .json(formatSuccess("Cargo actualizado correctamente", result.rows[0]));
  } catch (error) {
    console.error("Error al actualizar cargo:", error);
    res.status(500).json(formatError("Error al actualizar el cargo"));
  }
};

export const deleteCargo = async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      "UPDATE catalogo_cargo SET activo = false WHERE id = $1 AND activo = true RETURNING id",
      [id]
    );

    if (result.rowCount === 0) {
      return res
        .status(404)
        .json(formatError("El cargo ya estaba inactivo o no existe"));
    }

    res
      .status(200)
      .json(formatSuccess("Cargo desactivado correctamente"));
  } catch (error) {
    console.error("Error al desactivar cargo:", error);
    res.status(500).json(formatError("Error al desactivar el cargo"));
  }
};
