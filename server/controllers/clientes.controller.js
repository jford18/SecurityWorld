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
  SELECT c.id,
         c.nombre,
         c.identificacion,
         c.direccion,
         c.tipo_servicio_id,
         ts."NOMBRE" AS tipo_servicio_nombre,
         c.activo,
         c.fecha_creacion
    FROM public.clientes c
    LEFT JOIN public."TIPO_SERVICIO" ts ON ts."ID" = c.tipo_servicio_id
   ORDER BY c.id
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

const sanitizeSearch = (value) =>
  typeof value === "string" ? value.trim() : "";

const buildSearchQuery = (term) => ({
  query: `
    SELECT c.id,
           c.nombre,
           c.identificacion,
           c.direccion,
           c.tipo_servicio_id,
           ts."NOMBRE" AS tipo_servicio_nombre,
           c.activo,
           c.fecha_creacion
      FROM public.clientes c
      LEFT JOIN public."TIPO_SERVICIO" ts ON ts."ID" = c.tipo_servicio_id
     WHERE (
       c.nombre ILIKE $1 OR
       c.identificacion ILIKE $1 OR
       c.direccion ILIKE $1 OR
       ts."NOMBRE" ILIKE $1
     )
     ORDER BY c.id
  `,
  values: [`%${term}%`],
});

export const getClientes = async (req, res) => {
  try {
    const rawSearch = sanitizeSearch(req?.query?.q ?? req?.query?.search ?? "");
    const shouldFilter = rawSearch.length > 0;

    const { query, values } = shouldFilter
      ? buildSearchQuery(rawSearch)
      : { query: CLIENTES_BASE_QUERY, values: [] };

    const result = await pool.query(query, values);

    console.log("CLIENTES - registros encontrados:", result.rowCount ?? 0);

    res.json(result.rows ?? []);
  } catch (error) {
    console.error("[CLIENTES] Error al listar clientes:", error);
    res.status(500).json({
      message: "Error obteniendo clientes",
      error,
    });
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
    tipo_servicio_id,
    activo = true,
  } = req.body ?? {};

  const nombreLimpio = sanitizeText(nombre);
  const identificacionLimpia = sanitizeText(identificacion);
  const direccionLimpia = sanitizeText(direccion);
  const tipoServicioId = parsePositiveInteger(tipo_servicio_id);
  const activoNormalizado = normalizeBoolean(activo, true);

  if (!nombreLimpio || !identificacionLimpia || !tipoServicioId) {
    return res
      .status(422)
      .json(
        formatError(
          "Los campos nombre, identificación y tipo de servicio son obligatorios"
        )
      );
  }

  try {
    const insertQuery = `
      WITH inserted AS (
        INSERT INTO public.clientes (nombre, identificacion, direccion, tipo_servicio_id, activo)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, nombre, identificacion, direccion, tipo_servicio_id, activo, fecha_creacion
      )
      SELECT i.id, i.nombre, i.identificacion, i.direccion, i.tipo_servicio_id,
             ts."NOMBRE" AS tipo_servicio_nombre, i.activo, i.fecha_creacion
        FROM inserted i
        LEFT JOIN public."TIPO_SERVICIO" ts ON ts."ID" = i.tipo_servicio_id
    `;

    const values = [
      nombreLimpio,
      identificacionLimpia,
      direccionLimpia,
      tipoServicioId,
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
  const { nombre, identificacion, direccion, tipo_servicio_id, activo } = req.body ?? {};

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

  if (tipo_servicio_id === undefined) {
    return res
      .status(422)
      .json(formatError("El tipo de servicio es obligatorio"));
  }

  const tipoServicioId = parsePositiveInteger(tipo_servicio_id);
  if (!tipoServicioId) {
    return res
      .status(422)
      .json(formatError("El tipo de servicio proporcionado no es válido"));
  }

  updates.push(`tipo_servicio_id = $${index}`);
  values.push(tipoServicioId);
  index += 1;

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
      WITH updated AS (
        UPDATE public.clientes
           SET ${updates.join(", ")}
         WHERE id = $${index}
         RETURNING id, nombre, identificacion, direccion, tipo_servicio_id, activo, fecha_creacion
      )
      SELECT u.id, u.nombre, u.identificacion, u.direccion, u.tipo_servicio_id,
             ts."NOMBRE" AS tipo_servicio_nombre, u.activo, u.fecha_creacion
        FROM updated u
        LEFT JOIN public."TIPO_SERVICIO" ts ON ts."ID" = u.tipo_servicio_id
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
