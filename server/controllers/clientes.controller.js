import pool from "../db.js";

console.log("[API] Controlador CLIENTES activo y conectado a la tabla public.clientes");

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
  FROM public.clientes
  ORDER BY id
`;

const parsePositiveInteger = (value) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
};

const ensureClienteExists = async (clienteId) => {
  const result = await pool.query(
    "SELECT id, nombre FROM public.clientes WHERE id = $1",
    [clienteId]
  );
  if (result.rowCount === 0) {
    return null;
  }
  return result.rows[0];
};

const fetchPersonaForAssignment = async (personaId) => {
  const result = await pool.query(
    `SELECT id, nombre, apellido, cargo_id, estado
     FROM persona
     WHERE id = $1`,
    [personaId]
  );

  if (result.rowCount === 0) {
    return null;
  }

  return result.rows[0];
};

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
      INSERT INTO public.clientes (nombre, identificacion, direccion, telefono, activo)
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
      UPDATE public.clientes
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
      DELETE FROM public.clientes
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

export const getPersonasByCliente = async (req, res) => {
  const parsedClienteId = parsePositiveInteger(req.params?.clienteId);
  if (!parsedClienteId) {
    return res
      .status(400)
      .json(formatError("El identificador del cliente no es válido"));
  }

  try {
    const cliente = await ensureClienteExists(parsedClienteId);
    if (!cliente) {
      return res
        .status(404)
        .json(formatError("El cliente solicitado no existe"));
    }

    const result = await pool.query(
      `SELECT cp.id, cp.cliente_id, cp.persona_id, cp.fecha_asignacion,
              p.nombre, p.apellido, p.cargo_id, p.estado,
              c.descripcion AS cargo_descripcion
         FROM public.cliente_persona cp
         INNER JOIN persona p ON p.id = cp.persona_id
         LEFT JOIN catalogo_cargo c ON c.id = p.cargo_id
        WHERE cp.cliente_id = $1
        ORDER BY cp.fecha_asignacion DESC, p.apellido ASC, p.nombre ASC`,
      [parsedClienteId]
    );

    res.status(200).json(
      formatSuccess("Personas asociadas al cliente", result.rows ?? [])
    );
  } catch (error) {
    console.error("[CLIENTES] Error al obtener personas por cliente:", error);
    res
      .status(500)
      .json(
        formatError(
          "Ocurrió un error al obtener las personas asociadas al cliente"
        )
      );
  }
};

export const addPersonaToCliente = async (req, res) => {
  const parsedClienteId = parsePositiveInteger(req.params?.clienteId);
  const parsedPersonaId = parsePositiveInteger(req.body?.persona_id);

  if (!parsedClienteId || !parsedPersonaId) {
    return res
      .status(400)
      .json(formatError("Los identificadores proporcionados no son válidos"));
  }

  try {
    const cliente = await ensureClienteExists(parsedClienteId);
    if (!cliente) {
      return res
        .status(404)
        .json(formatError("El cliente solicitado no existe"));
    }

    const persona = await fetchPersonaForAssignment(parsedPersonaId);
    if (!persona) {
      return res
        .status(404)
        .json(formatError("La persona seleccionada no existe"));
    }

    if (!Boolean(persona.estado)) {
      return res
        .status(400)
        .json(formatError("Solo se pueden asignar personas activas"));
    }

    try {
      const assignmentResult = await pool.query(
        `WITH inserted AS (
           INSERT INTO public.cliente_persona (cliente_id, persona_id)
           VALUES ($1, $2)
           RETURNING id, cliente_id, persona_id, fecha_asignacion
         )
         SELECT i.id, i.cliente_id, i.persona_id, i.fecha_asignacion,
                p.nombre, p.apellido, p.cargo_id, p.estado,
                c.descripcion AS cargo_descripcion
           FROM inserted i
           INNER JOIN persona p ON p.id = i.persona_id
           LEFT JOIN catalogo_cargo c ON c.id = p.cargo_id`,
        [parsedClienteId, parsedPersonaId]
      );

      res.status(201).json(
        formatSuccess(
          "Persona asignada al cliente correctamente",
          assignmentResult.rows[0]
        )
      );
    } catch (error) {
      if (error?.code === "23505") {
        return res
          .status(400)
          .json(
            formatError("La persona ya se encuentra asignada a otro cliente")
          );
      }
      throw error;
    }
  } catch (error) {
    console.error("[CLIENTES] Error al asignar persona a cliente:", error);
    res
      .status(500)
      .json(formatError("Ocurrió un error al asignar la persona"));
  }
};

export const removePersonaFromCliente = async (req, res) => {
  const parsedClienteId = parsePositiveInteger(req.params?.clienteId);
  const parsedPersonaId = parsePositiveInteger(req.params?.personaId);

  if (!parsedClienteId || !parsedPersonaId) {
    return res
      .status(400)
      .json(formatError("Los identificadores proporcionados no son válidos"));
  }

  try {
    const cliente = await ensureClienteExists(parsedClienteId);
    if (!cliente) {
      return res
        .status(404)
        .json(formatError("El cliente solicitado no existe"));
    }

    const deleteResult = await pool.query(
      `DELETE FROM public.cliente_persona
        WHERE cliente_id = $1 AND persona_id = $2
        RETURNING id, persona_id`,
      [parsedClienteId, parsedPersonaId]
    );

    if (deleteResult.rowCount === 0) {
      return res
        .status(404)
        .json(
          formatError(
            "La relación solicitada no existe o ya fue eliminada"
          )
        );
    }

    res.status(200).json(
      formatSuccess("Persona desvinculada del cliente", deleteResult.rows[0])
    );
  } catch (error) {
    console.error("[CLIENTES] Error al eliminar relación cliente-persona:", error);
    res
      .status(500)
      .json(formatError("Ocurrió un error al eliminar la relación"));
  }
};
