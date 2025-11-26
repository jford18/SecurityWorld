import pool from "../db.js";

const TABLE_NAME = '"TIPO_SERVICIO"';

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
    return ["true", "1", "t", "on", "yes", "y"].includes(normalized);
  }
  return Boolean(value);
};

export const getAllTipoServicio = async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT "ID", "NOMBRE", "DESCRIPCION", "ACTIVO", "FECHA_CREACION" FROM ${TABLE_NAME} ORDER BY "ID"`
    );

    return res
      .status(200)
      .json(formatSuccess("Listado de tipos de servicio", result.rows));
  } catch (error) {
    console.error("Error al obtener los tipos de servicio:", error);
    return res
      .status(500)
      .json(formatError("Error al obtener los tipos de servicio"));
  }
};

export const getTipoServicioById = async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      `SELECT "ID", "NOMBRE", "DESCRIPCION", "ACTIVO", "FECHA_CREACION" FROM ${TABLE_NAME} WHERE "ID" = $1`,
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json(formatError("Tipo de servicio no encontrado"));
    }

    return res
      .status(200)
      .json(formatSuccess("Tipo de servicio obtenido", result.rows[0]));
  } catch (error) {
    console.error("Error al obtener el tipo de servicio:", error);
    return res
      .status(500)
      .json(formatError("Error al obtener el tipo de servicio"));
  }
};

export const createTipoServicio = async (req, res) => {
  const { nombre, descripcion, activo } = req.body ?? {};
  const trimmedNombre = typeof nombre === "string" ? nombre.trim() : "";

  if (!trimmedNombre) {
    return res
      .status(422)
      .json(formatError("El nombre del tipo de servicio es obligatorio"));
  }

  const normalizedActivo = normalizeBoolean(activo, true);

  try {
    const result = await pool.query(
      `INSERT INTO ${TABLE_NAME} ("NOMBRE", "DESCRIPCION", "ACTIVO") VALUES ($1, $2, $3) RETURNING "ID", "NOMBRE", "DESCRIPCION", "ACTIVO", "FECHA_CREACION"`,
      [trimmedNombre, descripcion ?? null, normalizedActivo]
    );

    return res
      .status(201)
      .json(
        formatSuccess(
          "Tipo de servicio creado correctamente",
          result.rows[0]
        )
      );
  } catch (error) {
    console.error("Error al crear el tipo de servicio:", error);
    return res
      .status(500)
      .json(formatError("Error al crear el tipo de servicio"));
  }
};

export const updateTipoServicio = async (req, res) => {
  const { id } = req.params;
  const { nombre, descripcion, activo } = req.body ?? {};

  const updates = [];
  const values = [];
  let index = 1;

  if (nombre !== undefined) {
    const trimmedNombre = typeof nombre === "string" ? nombre.trim() : "";
    if (!trimmedNombre) {
      return res
        .status(422)
        .json(formatError("El nombre del tipo de servicio es obligatorio"));
    }
    updates.push(`"NOMBRE" = $${index}`);
    values.push(trimmedNombre);
    index += 1;
  }

  if (descripcion !== undefined) {
    updates.push(`"DESCRIPCION" = $${index}`);
    values.push(descripcion ?? null);
    index += 1;
  }

  if (activo !== undefined) {
    updates.push(`"ACTIVO" = $${index}`);
    values.push(normalizeBoolean(activo));
    index += 1;
  }

  if (updates.length === 0) {
    return res
      .status(400)
      .json(formatError("No se enviaron campos para actualizar"));
  }

  values.push(id);

  try {
    const existing = await pool.query(
      `SELECT "ID" FROM ${TABLE_NAME} WHERE "ID" = $1`,
      [id]
    );

    if (existing.rowCount === 0) {
      return res.status(404).json(formatError("Tipo de servicio no encontrado"));
    }

    const updateQuery = `UPDATE ${TABLE_NAME} SET ${updates.join(", ")} WHERE "ID" = $${index} RETURNING "ID", "NOMBRE", "DESCRIPCION", "ACTIVO", "FECHA_CREACION"`;

    const result = await pool.query(updateQuery, values);

    return res
      .status(200)
      .json(
        formatSuccess(
          "Tipo de servicio actualizado correctamente",
          result.rows[0]
        )
      );
  } catch (error) {
    console.error("Error al actualizar el tipo de servicio:", error);
    return res
      .status(500)
      .json(formatError("Error al actualizar el tipo de servicio"));
  }
};

export const toggleActivoTipoServicio = async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      `UPDATE ${TABLE_NAME} SET "ACTIVO" = NOT "ACTIVO" WHERE "ID" = $1 RETURNING "ID", "NOMBRE", "DESCRIPCION", "ACTIVO", "FECHA_CREACION"`,
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json(formatError("Tipo de servicio no encontrado"));
    }

    const nuevoEstado = result.rows[0]?.ACTIVO ?? result.rows[0]?.activo;

    return res
      .status(200)
      .json(
        formatSuccess(
          `Estado actualizado correctamente: ${nuevoEstado ? "ACTIVO" : "INACTIVO"}`,
          result.rows[0]
        )
      );
  } catch (error) {
    console.error("Error al cambiar el estado del tipo de servicio:", error);
    return res
      .status(500)
      .json(
        formatError(
          "Error al cambiar el estado del tipo de servicio"
        )
      );
  }
};

export default {
  getAllTipoServicio,
  getTipoServicioById,
  createTipoServicio,
  updateTipoServicio,
  toggleActivoTipoServicio,
};
