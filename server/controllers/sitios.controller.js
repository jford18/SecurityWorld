import pool from "../db.js";

const SITIO_WITH_CLIENT_BASE_QUERY = `
  SELECT
    S.id,
    S.nombre,
    S.descripcion,
    S.ubicacion,
    S.link_mapa,
    S.latitud,
    S.longitud,
    S.activo,
    S.fecha_creacion,
    C.id AS cliente_id,
    C.nombre AS cliente_nombre
  FROM sitios S
  LEFT JOIN sitios_cliente SC ON SC.sitio_id = S.id AND SC.activo = TRUE
  LEFT JOIN clientes C ON C.id = SC.cliente_id
`;

const fetchSitioWithClienteById = async (queryable, id) => {
  const result = await queryable.query(`${SITIO_WITH_CLIENT_BASE_QUERY} WHERE S.id = $1`, [id]);
  return result.rows[0] ?? null;
};

const coordinatePatterns = [
  /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/,
  /!3d(-?\d+(?:\.\d+)?)[^!]*!4d(-?\d+(?:\.\d+)?)/,
  /q=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/,
  /\/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)(?:\/|\?|$)/,
];

const sanitizeCoordinate = (value, isLatitude) => {
  if (value === null || value === undefined) {
    return null;
  }

  const parsed =
    typeof value === "number" ? value : Number.parseFloat(String(value));

  if (!Number.isFinite(parsed)) {
    return null;
  }

  const limit = isLatitude ? 90 : 180;

  if (Math.abs(parsed) > limit) {
    return null;
  }

  return Math.round(parsed * 1e6) / 1e6;
};

const extractCoordinatesFromLink = (link) => {
  if (typeof link !== "string") {
    return null;
  }

  const trimmed = link.trim();

  if (!trimmed) {
    return null;
  }

  for (const pattern of coordinatePatterns) {
    const match = trimmed.match(pattern);

    if (match) {
      const latitud = sanitizeCoordinate(match[1], true);
      const longitud = sanitizeCoordinate(match[2], false);

      if (latitud !== null && longitud !== null) {
        return { latitud, longitud };
      }
    }
  }

  const fallback = trimmed.match(/(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/);

  if (fallback) {
    const latitud = sanitizeCoordinate(fallback[1], true);
    const longitud = sanitizeCoordinate(fallback[2], false);

    if (latitud !== null && longitud !== null) {
      return { latitud, longitud };
    }
  }

  return null;
};

const parseClienteId = (value) => {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number.parseInt(String(value), 10);

  if (!Number.isFinite(parsed)) {
    return null;
  }

  return parsed;
};

const parseBoolean = (value) => {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return ["true", "1", "yes", "y"].includes(normalized);
  }

  return false;
};

const parseSitioIds = (rawValue) => {
  const values = Array.isArray(rawValue)
    ? rawValue
    : rawValue !== undefined && rawValue !== null
    ? [rawValue]
    : [];

  const parsed = values
    .map((value) => Number.parseInt(String(value), 10))
    .filter((id) => Number.isInteger(id) && id > 0);

  return Array.from(new Set(parsed));
};

const normalizeSitioPayload = (body) => {
  const hasClienteId =
    body !== null &&
    typeof body === "object" &&
    Object.prototype.hasOwnProperty.call(body, "cliente_id");

  const nombre = typeof body.nombre === "string" ? body.nombre.trim() : "";
  const descripcion =
    typeof body.descripcion === "string" ? body.descripcion.trim() : null;
  const ubicacion =
    typeof body.ubicacion === "string" ? body.ubicacion.trim() : null;
  const link_mapa =
    typeof body.link_mapa === "string" ? body.link_mapa.trim() : "";
  const activoRaw = body.activo;

  const activo =
    typeof activoRaw === "boolean"
      ? activoRaw
      : typeof activoRaw === "string"
      ? activoRaw.toLowerCase() === "true"
      : true;

  let latitud = sanitizeCoordinate(body.latitud, true);
  let longitud = sanitizeCoordinate(body.longitud, false);

  if ((latitud === null || longitud === null) && link_mapa) {
    const coords = extractCoordinatesFromLink(link_mapa);
    if (coords) {
      ({ latitud, longitud } = coords);
    }
  }

  const cliente_id = parseClienteId(body.cliente_id);

  return {
    nombre,
    descripcion,
    ubicacion,
    activo,
    link_mapa,
    latitud,
    longitud,
    cliente_id,
    clienteIdProvided: hasClienteId,
  };
};

export const getSitios = async (req, res) => {
  try {
    const { soloDisponibles, sitioActualId } = req.query ?? {};

    const onlyAvailable = parseBoolean(soloDisponibles);
    const includeIds = parseSitioIds(sitioActualId);

    const filters = [];
    const values = [];

    if (onlyAvailable) {
      filters.push("S.activo = TRUE");

      if (includeIds.length > 0) {
        values.push(includeIds);
        const paramIndex = values.length;
        filters.push(
          `(S.id NOT IN (SELECT NS.sitio_id FROM nodos_sitios NS) OR S.id = ANY($${paramIndex}::int[]))`
        );
      } else {
        filters.push("S.id NOT IN (SELECT NS.sitio_id FROM nodos_sitios NS)");
      }
    }

    let query = SITIO_WITH_CLIENT_BASE_QUERY;

    if (filters.length > 0) {
      query += ` WHERE ${filters.join(" AND ")}`;
    }

    query += " ORDER BY S.nombre";

    const result = await pool.query(query, values);
    res.status(200).json(result.rows);
  } catch (error) {
    console.error("Error al obtener sitios:", error);
    res.status(500).json({ message: "Error al obtener sitios" });
  }
};

export const getSitioById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `${SITIO_WITH_CLIENT_BASE_QUERY} WHERE S.id = $1`,
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Sitio no encontrado" });
    }

    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error("Error al obtener el sitio:", error);
    res.status(500).json({ message: "Error al obtener el sitio" });
  }
};

export const createSitio = async (req, res) => {
  try {
    const {
      nombre,
      descripcion,
      ubicacion,
      activo,
      link_mapa,
      latitud,
      longitud,
      cliente_id,
      clienteIdProvided,
    } =
      normalizeSitioPayload(
        req.body ?? {}
      );

    if (!nombre) {
      return res.status(422).json({ message: "El nombre es obligatorio" });
    }

    if (!link_mapa) {
      return res.status(422).json({ message: "El link de Google Maps es obligatorio" });
    }

    if (latitud === null || longitud === null) {
      return res.status(422).json({ message: "El enlace proporcionado no contiene coordenadas válidas" });
    }

    const client = await pool.connect();
    let transactionStarted = false;

    try {
      const existe = await client.query(
        "SELECT id FROM sitios WHERE LOWER(nombre) = LOWER($1)",
        [nombre]
      );

      if (existe.rowCount > 0) {
        return res.status(409).json({ message: "El sitio ya existe" });
      }

      await client.query("BEGIN");
      transactionStarted = true;

      const result = await client.query(
        `INSERT INTO sitios (nombre, descripcion, ubicacion, activo, link_mapa, latitud, longitud)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, nombre, descripcion, ubicacion, link_mapa, latitud, longitud, activo, fecha_creacion`,
        [nombre, descripcion, ubicacion, activo, link_mapa, latitud, longitud]
      );

      const sitioInsertado = result.rows[0];
      const sitioId = sitioInsertado.id;

      if (clienteIdProvided && cliente_id !== null) {
        await client.query(
          `INSERT INTO sitios_cliente (sitio_id, cliente_id, activo, fecha_asignacion)
           VALUES ($1, $2, TRUE, NOW())`,
          [sitioId, cliente_id]
        );
      }

      const sitioConCliente = await fetchSitioWithClienteById(client, sitioId);

      await client.query("COMMIT");
      transactionStarted = false;

      res.status(201).json({
        message: "Sitio creado correctamente",
        data: sitioConCliente ?? sitioInsertado,
      });
    } catch (error) {
      if (transactionStarted) {
        await client.query("ROLLBACK");
      }
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Error al crear el sitio:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
};

export const updateSitio = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      nombre,
      descripcion,
      ubicacion,
      activo,
      link_mapa,
      latitud,
      longitud,
      cliente_id,
      clienteIdProvided,
    } =
      normalizeSitioPayload(
        req.body ?? {}
      );

    if (!nombre) {
      return res.status(422).json({ message: "El nombre es obligatorio" });
    }

    if (!link_mapa) {
      return res.status(422).json({ message: "El link de Google Maps es obligatorio" });
    }

    if (latitud === null || longitud === null) {
      return res.status(422).json({ message: "El enlace proporcionado no contiene coordenadas válidas" });
    }

    const client = await pool.connect();
    let transactionStarted = false;

    try {
      const existe = await client.query(
        "SELECT id FROM sitios WHERE LOWER(nombre) = LOWER($1) AND id <> $2",
        [nombre, id]
      );

      if (existe.rowCount > 0) {
        return res.status(409).json({ message: "Ya existe otro sitio con ese nombre" });
      }

      await client.query("BEGIN");
      transactionStarted = true;

      const result = await client.query(
        `UPDATE sitios
         SET nombre = $1,
             descripcion = $2,
             ubicacion = $3,
             activo = $4,
             link_mapa = $5,
             latitud = $6,
             longitud = $7
         WHERE id = $8
         RETURNING id, nombre, descripcion, ubicacion, link_mapa, latitud, longitud, activo, fecha_creacion`,
        [nombre, descripcion, ubicacion, activo, link_mapa, latitud, longitud, id]
      );

      if (result.rowCount === 0) {
        await client.query("ROLLBACK");
        transactionStarted = false;
        return res.status(404).json({ message: "Sitio no encontrado" });
      }

      if (clienteIdProvided) {
        await client.query(
          "UPDATE sitios_cliente SET activo = FALSE WHERE sitio_id = $1 AND activo = TRUE",
          [id]
        );

        if (cliente_id !== null) {
          await client.query(
            `INSERT INTO sitios_cliente (sitio_id, cliente_id, activo, fecha_asignacion)
             VALUES ($1, $2, TRUE, NOW())`,
            [id, cliente_id]
          );
        }
      }

      const sitioActualizado = await fetchSitioWithClienteById(client, id);

      await client.query("COMMIT");
      transactionStarted = false;

      res.status(200).json({
        message: "Sitio actualizado correctamente",
        data: sitioActualizado ?? result.rows[0],
      });
    } catch (error) {
      if (transactionStarted) {
        await client.query("ROLLBACK");
      }
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Error al actualizar el sitio:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
};

export const deleteSitio = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query("DELETE FROM sitios WHERE id = $1", [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Sitio no encontrado" });
    }

    res.status(200).json({ message: "Sitio eliminado correctamente" });
  } catch (error) {
    console.error("Error al eliminar el sitio:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
};
