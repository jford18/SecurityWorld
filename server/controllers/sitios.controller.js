import pool from "../db.js";

const SITIO_WITH_CLIENT_BASE_QUERY = `
  SELECT
    S.id,
    S.nombre,
    S.descripcion,
    S.ubicacion,
    S.servidor,
    S.link_mapa,
    S.latitud,
    S.longitud,
    S.activo,
    S.fecha_creacion,
    S.hacienda_id AS hacienda_id,
    S.tipo_area_id AS tipo_area_id,
    S.consola_id AS consola_id,
    S.cliente_id AS cliente_id,
    C.nombre AS cliente_nombre,
    H.nombre AS hacienda_nombre,
    TA.nombre AS tipo_area_nombre,
    TA.descripcion AS tipo_area_descripcion,
    CO.nombre AS consola_nombre
  FROM public.sitios S
  LEFT JOIN public.clientes C ON C.id = S.cliente_id
  LEFT JOIN hacienda H ON H.id = S.hacienda_id
  LEFT JOIN public.tipo_area TA ON TA.id = S.tipo_area_id
  LEFT JOIN consolas CO ON CO.id = S.consola_id
`;

const mapSitioRow = (row) => {
  if (!row || typeof row !== "object") {
    return row ?? null;
  }

  return {
    ...row,
    servidor: row.servidor ?? null,
    clienteId: row.clienteId ?? row.cliente_id ?? null,
    clienteNombre: row.clienteNombre ?? row.cliente_nombre ?? null,
    haciendaId: row.haciendaId ?? row.hacienda_id ?? null,
    haciendaNombre: row.haciendaNombre ?? row.hacienda_nombre ?? null,
    tipoAreaId: row.tipoAreaId ?? row.tipo_area_id ?? null,
    tipoAreaNombre: row.tipoAreaNombre ?? row.tipo_area_nombre ?? null,
    tipoAreaDescripcion:
      row.tipoAreaDescripcion ?? row.tipo_area_descripcion ?? null,
    consolaId: row.consolaId ?? row.consola_id ?? null,
    consolaNombre: row.consolaNombre ?? row.consola_nombre ?? null,
  };
};

const fetchSitioWithClienteById = async (queryable, id) => {
  const result = await queryable.query(`${SITIO_WITH_CLIENT_BASE_QUERY} WHERE S.id = $1`, [id]);
  return mapSitioRow(result.rows[0] ?? null);
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

const parseNullableId = (value) => {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number.parseInt(String(value), 10);

  if (!Number.isFinite(parsed) || parsed <= 0 || !Number.isInteger(parsed)) {
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
  const nombre = typeof body.nombre === "string" ? body.nombre.trim() : "";
  const descripcion =
    typeof body.descripcion === "string" ? body.descripcion.trim() : null;
  const ubicacion =
    typeof body.ubicacion === "string" ? body.ubicacion.trim() : null;
  const servidor = typeof body.servidor === "string" ? body.servidor.trim() : null;
  const rawLinkMapa =
    typeof body.link_mapa === "string" ? body.link_mapa.trim() : null;
  const link_mapa = rawLinkMapa && rawLinkMapa.length > 0 ? rawLinkMapa : null;
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

  const clienteId = parseNullableId(body.clienteId ?? body.cliente_id);
  const haciendaId = parseNullableId(body.haciendaId ?? body.hacienda_id);
  const tipoAreaId = parseNullableId(body.tipoAreaId ?? body.tipo_area_id);
  const consolaId = parseNullableId(body.consolaId ?? body.consola_id);

  return {
    nombre,
    descripcion,
    ubicacion,
    activo,
    link_mapa,
    latitud,
    longitud,
    servidor,
    clienteId,
    haciendaId,
    tipoAreaId,
    consolaId,
  };
};

export const getSitios = async (req, res) => {
  try {
    const { soloDisponibles, sitioActualId, consolaId, consola_id, clienteId, haciendaId } =
      req.query ?? {};

    const onlyAvailable = parseBoolean(soloDisponibles);
    const includeIds = parseSitioIds(sitioActualId);
    const consoleId = parseNullableId(consolaId ?? consola_id);
    const clientId = parseNullableId(clienteId);
    const haciendaFilterId = parseNullableId(haciendaId);

    const filters = [];
    const values = [];
    let hasActiveFilter = false;

    const ensureActiveFilter = () => {
      if (!hasActiveFilter) {
        filters.push("S.activo = TRUE");
        hasActiveFilter = true;
      }
    };

    if (consoleId !== null) {
      values.push(consoleId);
      filters.push(`S.consola_id = $${values.length}`);
      ensureActiveFilter();
    }

    if (clientId !== null) {
      values.push(clientId);
      filters.push(`S.cliente_id = $${values.length}`);
      ensureActiveFilter();
    }

    if (haciendaFilterId !== null) {
      values.push(haciendaFilterId);
      filters.push(`S.hacienda_id = $${values.length}`);
      ensureActiveFilter();
    }

    if (onlyAvailable) {
      ensureActiveFilter();

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
    res.status(200).json(result.rows.map(mapSitioRow));
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

    res.status(200).json(mapSitioRow(result.rows[0]));
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
      servidor,
      activo,
      link_mapa,
      latitud,
      longitud,
      clienteId,
      haciendaId,
      tipoAreaId,
      consolaId,
    } =
      normalizeSitioPayload(
        req.body ?? {}
      );

    const hasLinkData = Boolean(link_mapa);
    const hasCoordinates = latitud !== null && longitud !== null;

    if (!nombre) {
      return res.status(422).json({ message: "El nombre es obligatorio" });
    }

    if (hasLinkData && !hasCoordinates) {
      return res.status(422).json({ message: "El enlace proporcionado no contiene coordenadas válidas" });
    }

    if (clienteId === null) {
      return res.status(422).json({ message: "El cliente es obligatorio" });
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
        `INSERT INTO sitios (nombre, descripcion, ubicacion, servidor, activo, link_mapa, latitud, longitud, hacienda_id, tipo_area_id, consola_id, cliente_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         RETURNING id, nombre, descripcion, ubicacion, servidor, link_mapa, latitud, longitud, activo, fecha_creacion, hacienda_id, tipo_area_id, consola_id, cliente_id`,
        [
          nombre,
          descripcion,
          ubicacion,
          servidor,
          activo,
          link_mapa,
          latitud,
          longitud,
          haciendaId,
          tipoAreaId,
          consolaId,
          clienteId,
        ]
      );

      const sitioInsertado = result.rows[0];
      const sitioId = sitioInsertado.id;

      const sitioConCliente = await fetchSitioWithClienteById(client, sitioId);

      await client.query("COMMIT");
      transactionStarted = false;

      res.status(201).json({
        message: "Sitio creado correctamente",
        data: mapSitioRow(sitioConCliente ?? sitioInsertado),
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
      servidor,
      activo,
      link_mapa,
      latitud,
      longitud,
      clienteId,
      haciendaId,
      tipoAreaId,
      consolaId,
    } =
      normalizeSitioPayload(
        req.body ?? {}
      );

    const hasLinkData = Boolean(link_mapa);
    const hasCoordinates = latitud !== null && longitud !== null;

    if (!nombre) {
      return res.status(422).json({ message: "El nombre es obligatorio" });
    }

    if (hasLinkData && !hasCoordinates) {
      return res.status(422).json({ message: "El enlace proporcionado no contiene coordenadas válidas" });
    }

    if (clienteId === null) {
      return res.status(422).json({ message: "El cliente es obligatorio" });
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
             servidor = $4,
             activo = $5,
             link_mapa = $6,
             latitud = $7,
             longitud = $8,
             hacienda_id = $9,
             tipo_area_id = $10,
             consola_id = $11,
             cliente_id = $12
         WHERE id = $13
         RETURNING id, nombre, descripcion, ubicacion, servidor, link_mapa, latitud, longitud, activo, fecha_creacion, hacienda_id, tipo_area_id, consola_id, cliente_id`,
        [
          nombre,
          descripcion,
          ubicacion,
          servidor,
          activo,
          link_mapa,
          latitud,
          longitud,
          haciendaId,
          tipoAreaId,
          consolaId,
          clienteId,
          id,
        ]
      );

      if (result.rowCount === 0) {
        await client.query("ROLLBACK");
        transactionStarted = false;
        return res.status(404).json({ message: "Sitio no encontrado" });
      }

      const sitioActualizado = await fetchSitioWithClienteById(client, id);

      await client.query("COMMIT");
      transactionStarted = false;

      res.status(200).json({
        message: "Sitio actualizado correctamente",
        data: mapSitioRow(sitioActualizado ?? result.rows[0]),
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
