import pool from "../db.js";

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

const normalizeSitioPayload = (body) => {
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

  return { nombre, descripcion, ubicacion, activo, link_mapa, latitud, longitud };
};

export const getSitios = async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, nombre, descripcion, ubicacion, link_mapa, latitud, longitud, activo, fecha_creacion
       FROM sitios
       ORDER BY nombre`
    );
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
      `SELECT id, nombre, descripcion, ubicacion, link_mapa, latitud, longitud, activo, fecha_creacion
       FROM sitios
       WHERE id = $1`,
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
    const { nombre, descripcion, ubicacion, activo, link_mapa, latitud, longitud } =
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

    const existe = await pool.query(
      "SELECT id FROM sitios WHERE LOWER(nombre) = LOWER($1)",
      [nombre]
    );

    if (existe.rowCount > 0) {
      return res.status(409).json({ message: "El sitio ya existe" });
    }

    const result = await pool.query(
      `INSERT INTO sitios (nombre, descripcion, ubicacion, activo, link_mapa, latitud, longitud)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, nombre, descripcion, ubicacion, link_mapa, latitud, longitud, activo, fecha_creacion`,
      [nombre, descripcion, ubicacion, activo, link_mapa, latitud, longitud]
    );

    res.status(201).json({
      message: "Sitio creado correctamente",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Error al crear el sitio:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
};

export const updateSitio = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, descripcion, ubicacion, activo, link_mapa, latitud, longitud } =
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

    const existe = await pool.query(
      "SELECT id FROM sitios WHERE LOWER(nombre) = LOWER($1) AND id <> $2",
      [nombre, id]
    );

    if (existe.rowCount > 0) {
      return res.status(409).json({ message: "Ya existe otro sitio con ese nombre" });
    }

    const result = await pool.query(
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
      return res.status(404).json({ message: "Sitio no encontrado" });
    }

    res.status(200).json({
      message: "Sitio actualizado correctamente",
      data: result.rows[0],
    });
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
