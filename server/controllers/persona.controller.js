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

const fetchPersonaWithCargo = async (id) => {
  const result = await pool.query(
    `SELECT p.id, p.nombre, p.apellido, p.cargo_id, c.descripcion AS cargo_descripcion, p.estado, p.fecha_creacion
     FROM persona p
     INNER JOIN catalogo_cargo c ON c.id = p.cargo_id
     WHERE p.id = $1`,
    [id]
  );

  return result;
};

const ensureCargoExists = async (cargoId) => {
  const cargoResult = await pool.query(
    "SELECT id FROM catalogo_cargo WHERE id = $1",
    [cargoId]
  );

  return cargoResult.rowCount > 0;
};

export const listPersonas = async (req, res) => {
  const search = typeof req.query.search === "string" ? req.query.search.trim() : "";

  try {
    const values = [];
    let query =
      "SELECT p.id, p.nombre, p.apellido, p.cargo_id, c.descripcion AS cargo_descripcion, p.estado, p.fecha_creacion FROM persona p INNER JOIN catalogo_cargo c ON c.id = p.cargo_id";

    if (search) {
      values.push(`%${search}%`);
      query += " WHERE (p.nombre ILIKE $1 OR p.apellido ILIKE $1)";
    }

    query += " ORDER BY p.id ASC";

    const result = await pool.query(query, values);

    res
      .status(200)
      .json(formatSuccess("Listado de personas", result.rows));
  } catch (error) {
    console.error("Error al listar personas:", error);
    res.status(500).json(formatError("Error al listar las personas"));
  }
};

export const getPersonaById = async (req, res) => {
  const { id } = req.params;

  try {
    const result = await fetchPersonaWithCargo(id);

    if (result.rowCount === 0) {
      return res
        .status(404)
        .json(formatError("La persona solicitada no existe"));
    }

    res
      .status(200)
      .json(formatSuccess("Persona obtenida correctamente", result.rows[0]));
  } catch (error) {
    console.error("Error al obtener persona:", error);
    res.status(500).json(formatError("Error al obtener la persona"));
  }
};

export const createPersona = async (req, res) => {
  const { nombre, apellido, cargo_id, estado } = req.body ?? {};

  const trimmedNombre = typeof nombre === "string" ? nombre.trim() : "";
  const trimmedApellido = typeof apellido === "string" ? apellido.trim() : "";

  if (!trimmedNombre) {
    return res
      .status(422)
      .json(formatError("El nombre de la persona es obligatorio"));
  }

  if (!trimmedApellido) {
    return res
      .status(422)
      .json(formatError("El apellido de la persona es obligatorio"));
  }

  const parsedCargoId = Number(cargo_id);
  if (!Number.isInteger(parsedCargoId) || parsedCargoId <= 0) {
    return res
      .status(422)
      .json(formatError("El cargo seleccionado no es válido"));
  }

  try {
    const cargoExists = await ensureCargoExists(parsedCargoId);

    if (!cargoExists) {
      return res
        .status(404)
        .json(formatError("El cargo seleccionado no existe"));
    }

    const normalizedEstado = normalizeBoolean(estado, true);

    const insertResult = await pool.query(
      `WITH inserted AS (
        INSERT INTO persona (nombre, apellido, cargo_id, estado)
        VALUES ($1, $2, $3, $4)
        RETURNING id, nombre, apellido, cargo_id, estado, fecha_creacion
      )
      SELECT i.id, i.nombre, i.apellido, i.cargo_id, c.descripcion AS cargo_descripcion, i.estado, i.fecha_creacion
      FROM inserted i
      INNER JOIN catalogo_cargo c ON c.id = i.cargo_id`,
      [trimmedNombre, trimmedApellido, parsedCargoId, normalizedEstado]
    );

    res
      .status(201)
      .json(
        formatSuccess(
          "Persona creada correctamente",
          insertResult.rows[0]
        )
      );
  } catch (error) {
    console.error("Error al crear persona:", error);
    res.status(500).json(formatError("Error al crear la persona"));
  }
};

export const updatePersona = async (req, res) => {
  const { id } = req.params;
  const { nombre, apellido, cargo_id, estado } = req.body ?? {};

  const updates = [];
  const values = [];
  let index = 1;

  if (nombre !== undefined) {
    const trimmedNombre = typeof nombre === "string" ? nombre.trim() : "";

    if (!trimmedNombre) {
      return res
        .status(422)
        .json(formatError("El nombre de la persona es obligatorio"));
    }

    updates.push(`nombre = $${index}`);
    values.push(trimmedNombre);
    index += 1;
  }

  if (apellido !== undefined) {
    const trimmedApellido = typeof apellido === "string" ? apellido.trim() : "";

    if (!trimmedApellido) {
      return res
        .status(422)
        .json(formatError("El apellido de la persona es obligatorio"));
    }

    updates.push(`apellido = $${index}`);
    values.push(trimmedApellido);
    index += 1;
  }

  if (cargo_id !== undefined) {
    const parsedCargoId = Number(cargo_id);
    if (!Number.isInteger(parsedCargoId) || parsedCargoId <= 0) {
      return res
        .status(422)
        .json(formatError("El cargo seleccionado no es válido"));
    }

    try {
      const cargoExists = await ensureCargoExists(parsedCargoId);
      if (!cargoExists) {
        return res
          .status(404)
          .json(formatError("El cargo seleccionado no existe"));
      }
    } catch (error) {
      console.error("Error al validar cargo:", error);
      return res
        .status(500)
        .json(formatError("Error al actualizar la persona"));
    }

    updates.push(`cargo_id = $${index}`);
    values.push(parsedCargoId);
    index += 1;
  }

  if (estado !== undefined) {
    const normalizedEstado = normalizeBoolean(estado);
    updates.push(`estado = $${index}`);
    values.push(normalizedEstado);
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
      `WITH updated AS (
        UPDATE persona
        SET ${updates.join(", ")}
        WHERE id = $${index}
        RETURNING id, nombre, apellido, cargo_id, estado, fecha_creacion
      )
      SELECT u.id, u.nombre, u.apellido, u.cargo_id, c.descripcion AS cargo_descripcion, u.estado, u.fecha_creacion
      FROM updated u
      INNER JOIN catalogo_cargo c ON c.id = u.cargo_id`,
      values
    );

    if (result.rowCount === 0) {
      return res
        .status(404)
        .json(formatError("La persona solicitada no existe"));
    }

    res
      .status(200)
      .json(formatSuccess("Persona actualizada correctamente", result.rows[0]));
  } catch (error) {
    console.error("Error al actualizar persona:", error);
    res.status(500).json(formatError("Error al actualizar la persona"));
  }
};

export const deletePersona = async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      "UPDATE persona SET estado = false WHERE id = $1 AND estado = true RETURNING id",
      [id]
    );

    if (result.rowCount === 0) {
      return res
        .status(404)
        .json(formatError("La persona ya estaba inactiva o no existe"));
    }

    res
      .status(200)
      .json(formatSuccess("Persona inactivada correctamente"));
  } catch (error) {
    console.error("Error al eliminar persona:", error);
    res.status(500).json(formatError("Error al eliminar la persona"));
  }
};

export const getPersonasDisponiblesParaCliente = async (req, res) => {
  const { clienteId } = req.params;
  const parsedClienteId = Number(clienteId);

  if (!Number.isInteger(parsedClienteId) || parsedClienteId < 0) {
    return res
      .status(400)
      .json(
        formatError("El identificador del cliente proporcionado no es válido")
      );
  }

  try {
    const result = await pool.query(
      `SELECT p.id, p.nombre, p.apellido, p.cargo_id, c.descripcion AS cargo_descripcion
         FROM persona p
         INNER JOIN catalogo_cargo c ON c.id = p.cargo_id
        WHERE p.estado = TRUE
          AND NOT EXISTS (
            SELECT 1
              FROM public.cliente_persona cp
             WHERE cp.persona_id = p.id
               AND cp.cliente_id <> $1
          )
        ORDER BY p.apellido ASC, p.nombre ASC, p.id ASC`,
      [parsedClienteId]
    );

    res
      .status(200)
      .json(
        formatSuccess(
          "Personas disponibles para asignar",
          result.rows ?? []
        )
      );
  } catch (error) {
    console.error(
      "[PERSONA] Error al obtener personas disponibles para cliente:",
      error
    );
    res
      .status(500)
      .json(
        formatError(
          "Ocurrió un error al obtener las personas disponibles para asignar"
        )
      );
  }
};
