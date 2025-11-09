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

const CLIENTES_BASE_QUERY = `
  SELECT id, nombre, identificacion, direccion, telefono, activo, fecha_creacion
  FROM clientes
  ORDER BY id
`;

export const getClientes = async (_req, res) => {
  try {
    const result = await pool.query(CLIENTES_BASE_QUERY);
    res.status(200).json(
      formatSuccess("Listado de clientes", result.rows ?? [])
    );
  } catch (error) {
    console.error("[CLIENTES] Error al listar clientes:", error);
    res
      .status(500)
      .json(formatError("Ocurrió un error al obtener los clientes"));
  }
};

const normalizeBoolean = (value, fallback = true) => {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["1", "true", "t", "on", "activo", "yes", "y"].includes(normalized)) {
      return true;
    }
    if (["0", "false", "f", "off", "inactivo", "no", "n"].includes(normalized)) {
      return false;
    }
  }
  if (typeof value === "number") {
    return value !== 0;
  }
  return fallback;
};

const sanitizeText = (value) =>
  typeof value === "string" ? value.trim() : "";

export const createCliente = async (req, res) => {
  const {
    nombre,
    identificacion,
    direccion = "",
    telefono = "",
    activo = true,
  } = req.body ?? {};

  const nombreLimpio = sanitizeText(nombre);
  const identificacionLimpia = sanitizeText(identificacion);
  const direccionLimpia = sanitizeText(direccion);
  const telefonoLimpio = sanitizeText(telefono);
  const activoNormalizado = normalizeBoolean(activo, true);

  if (!nombreLimpio || !identificacionLimpia) {
    return res
      .status(422)
      .json(
        formatError(
          "Los campos nombre e identificación son obligatorios"
        )
      );
  }

  try {
    const insertQuery = `
      INSERT INTO clientes (nombre, identificacion, direccion, telefono, activo)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, nombre, identificacion, direccion, telefono, activo, fecha_creacion
    `;

    const values = [
      nombreLimpio,
      identificacionLimpia,
      direccionLimpia,
      telefonoLimpio,
      activoNormalizado,
    ];

    const result = await pool.query(insertQuery, values);

    res.status(201).json(
      formatSuccess("Cliente creado correctamente", result.rows[0])
    );
  } catch (error) {
    console.error("[CLIENTES] Error al crear cliente:", error);
    res
      .status(500)
      .json(formatError("Ocurrió un error al crear el cliente"));
  }
};

export const updateCliente = async (req, res) => {
  const { id } = req.params;
  const { nombre, identificacion, direccion, telefono, activo } = req.body ?? {};

  const updates = [];
  const values = [];
  let index = 1;

  if (nombre !== undefined) {
    const nombreLimpio = sanitizeText(nombre);
    if (!nombreLimpio) {
      return res
        .status(422)
        .json(formatError("El nombre del cliente es obligatorio"));
    }
    updates.push(`nombre = $${index}`);
    values.push(nombreLimpio);
    index += 1;
  }

  if (identificacion !== undefined) {
    const identificacionLimpia = sanitizeText(identificacion);
    if (!identificacionLimpia) {
      return res
        .status(422)
        .json(formatError("La identificación del cliente es obligatoria"));
    }
    updates.push(`identificacion = $${index}`);
    values.push(identificacionLimpia);
    index += 1;
  }

  if (direccion !== undefined) {
    updates.push(`direccion = $${index}`);
    values.push(sanitizeText(direccion));
    index += 1;
  }

  if (telefono !== undefined) {
    updates.push(`telefono = $${index}`);
    values.push(sanitizeText(telefono));
    index += 1;
  }

  if (activo !== undefined) {
    updates.push(`activo = $${index}`);
    values.push(normalizeBoolean(activo));
    index += 1;
  }

  if (updates.length === 0) {
    return res
      .status(400)
      .json(formatError("No se proporcionaron campos para actualizar"));
  }

  try {
    const updateQuery = `
      UPDATE clientes
      SET ${updates.join(", ")}
      WHERE id = $${index}
      RETURNING id, nombre, identificacion, direccion, telefono, activo, fecha_creacion
    `;

    values.push(id);

    const result = await pool.query(updateQuery, values);

    if (result.rowCount === 0) {
      return res
        .status(404)
        .json(formatError("El cliente solicitado no existe"));
    }

    res
      .status(200)
      .json(formatSuccess("Cliente actualizado correctamente", result.rows[0]));
  } catch (error) {
    console.error("[CLIENTES] Error al actualizar cliente:", error);
    res
      .status(500)
      .json(formatError("Ocurrió un error al actualizar el cliente"));
  }
};

export const deleteCliente = async (req, res) => {
  const { id } = req.params;

  try {
    const deleteQuery = `
      DELETE FROM clientes
      WHERE id = $1
      RETURNING id
    `;

    const result = await pool.query(deleteQuery, [id]);

    if (result.rowCount === 0) {
      return res
        .status(404)
        .json(formatError("El cliente solicitado no existe"));
    }

    res
      .status(200)
      .json(formatSuccess("Cliente eliminado correctamente", { id }));
  } catch (error) {
    console.error("[CLIENTES] Error al eliminar cliente:", error);
    res
      .status(500)
      .json(formatError("Ocurrió un error al eliminar el cliente"));
  }
};
