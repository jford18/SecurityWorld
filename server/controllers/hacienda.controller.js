import db from "../db.js";

const sanitizeText = (value) =>
  typeof value === "string" ? value.trim() : "";

const parseBoolean = (value) => {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["1", "true", "t", "yes", "y", "activo"].includes(normalized)) {
      return true;
    }
    if (["0", "false", "f", "no", "n", "inactivo"].includes(normalized)) {
      return false;
    }
  }
  if (typeof value === "number") {
    return value !== 0;
  }
  return null;
};

const ensurePositiveInteger = (value, defaultValue) => {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return defaultValue;
  }
  return parsed;
};

const buildListFilters = (query) => {
  const rawSearch = sanitizeText(query.q);
  const search = rawSearch.length > 0 ? rawSearch : null;

  const rawActivo = typeof query.activo === "string" ? query.activo.trim().toLowerCase() : null;
  const activo = rawActivo === "true" || rawActivo === "false" ? rawActivo : null;

  const requestedPage = ensurePositiveInteger(query.page, 1);
  const requestedLimit = ensurePositiveInteger(query.limit, 10);
  const limit = Math.min(Math.max(requestedLimit, 1), 100);
  const page = Math.max(requestedPage, 1);
  const offset = (page - 1) * limit;

  return { search, activo, page, limit, offset };
};

const haciendaColumns = `
  ID,
  NOMBRE,
  DIRECCION,
  ACTIVO,
  FECHA_CREACION
`;

export const listHacienda = async (req, res, next) => {
  const { search, activo, page, limit, offset } = buildListFilters(req.query ?? {});

  const listQuery = `
    SELECT ${haciendaColumns}
    FROM PUBLIC.HACIENDA
    WHERE ($1::text IS NULL OR NOMBRE ILIKE ('%' || $1 || '%'))
      AND (
        $2::text IS NULL OR (
          CASE
            WHEN $2 = 'true' THEN ACTIVO = TRUE
            WHEN $2 = 'false' THEN ACTIVO = FALSE
            ELSE TRUE
          END
        )
      )
    ORDER BY NOMBRE ASC
    LIMIT $3 OFFSET $4
  `;

  const countQuery = `
    SELECT COUNT(*) AS total
    FROM PUBLIC.HACIENDA
    WHERE ($1::text IS NULL OR NOMBRE ILIKE ('%' || $1 || '%'))
      AND (
        $2::text IS NULL OR (
          CASE
            WHEN $2 = 'true' THEN ACTIVO = TRUE
            WHEN $2 = 'false' THEN ACTIVO = FALSE
            ELSE TRUE
          END
        )
      )
  `;

  try {
    const [listResult, countResult] = await Promise.all([
      db.query(listQuery, [search, activo, limit, offset]),
      db.query(countQuery, [search, activo]),
    ]);

    const total = Number.parseInt(countResult.rows?.[0]?.total ?? "0", 10) || 0;

    res.json({
      data: listResult.rows ?? [],
      meta: {
        page,
        limit,
        total,
      },
    });
  } catch (error) {
    console.error("[HACIENDA] Error al listar registros", error);
    next(error);
  }
};

export const getHacienda = async (req, res, next) => {
  const id = ensurePositiveInteger(req.params?.id, null);

  if (!id) {
    return res.status(400).json({ message: "Identificador de hacienda inválido" });
  }

  try {
    const result = await db.query(
      `SELECT ${haciendaColumns} FROM PUBLIC.HACIENDA WHERE ID = $1`,
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "La hacienda solicitada no existe" });
    }

    res.json({ data: result.rows[0] });
  } catch (error) {
    console.error("[HACIENDA] Error al obtener hacienda", error);
    next(error);
  }
};

export const createHacienda = async (req, res, next) => {
  const nombre = sanitizeText(req.body?.nombre);
  const direccion = sanitizeText(req.body?.direccion);
  const activo = parseBoolean(req.body?.activo);
  const normalizedActivo = activo === null ? true : activo;

  if (!nombre) {
    return res.status(422).json({ message: "El nombre de la hacienda es obligatorio" });
  }

  if (nombre.length > 150) {
    return res
      .status(422)
      .json({ message: "El nombre de la hacienda no puede superar los 150 caracteres" });
  }

  try {
    const insertQuery = `
      INSERT INTO PUBLIC.HACIENDA (NOMBRE, DIRECCION, ACTIVO)
      VALUES ($1, NULLIF($2, ''), $3)
      RETURNING ${haciendaColumns}
    `;

    const values = [nombre, direccion, normalizedActivo];
    const result = await db.query(insertQuery, values);

    res.status(201).json({ data: result.rows[0] });
  } catch (error) {
    if (error?.code === "23505") {
      return res.status(409).json({ message: "Ya existe una hacienda con ese nombre" });
    }

    console.error("[HACIENDA] Error al crear hacienda", error);
    next(error);
  }
};

export const updateHacienda = async (req, res, next) => {
  const id = ensurePositiveInteger(req.params?.id, null);

  if (!id) {
    return res.status(400).json({ message: "Identificador de hacienda inválido" });
  }

  const { nombre, direccion, activo } = req.body ?? {};

  const updates = [];
  const values = [];
  let paramIndex = 1;

  if (nombre !== undefined) {
    const sanitizedNombre = sanitizeText(nombre);
    if (!sanitizedNombre) {
      return res.status(422).json({ message: "El nombre de la hacienda es obligatorio" });
    }
    if (sanitizedNombre.length > 150) {
      return res
        .status(422)
        .json({ message: "El nombre de la hacienda no puede superar los 150 caracteres" });
    }
    updates.push(`NOMBRE = $${paramIndex}`);
    values.push(sanitizedNombre);
    paramIndex += 1;
  }

  if (direccion !== undefined) {
    const sanitizedDireccion = sanitizeText(direccion);
    updates.push(`DIRECCION = NULLIF($${paramIndex}, '')`);
    values.push(sanitizedDireccion);
    paramIndex += 1;
  }

  if (activo !== undefined) {
    const parsedActivo = parseBoolean(activo);
    if (parsedActivo === null) {
      return res.status(422).json({ message: "El estado activo recibido es inválido" });
    }
    updates.push(`ACTIVO = $${paramIndex}`);
    values.push(parsedActivo);
    paramIndex += 1;
  }

  if (updates.length === 0) {
    return res.status(400).json({ message: "No se proporcionaron campos para actualizar" });
  }

  try {
    const updateQuery = `
      UPDATE PUBLIC.HACIENDA
      SET ${updates.join(", ")}
      WHERE ID = $${paramIndex}
      RETURNING ${haciendaColumns}
    `;

    values.push(id);
    const result = await db.query(updateQuery, values);

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "La hacienda solicitada no existe" });
    }

    res.json({ data: result.rows[0] });
  } catch (error) {
    if (error?.code === "23505") {
      return res.status(409).json({ message: "Ya existe una hacienda con ese nombre" });
    }

    console.error("[HACIENDA] Error al actualizar hacienda", error);
    next(error);
  }
};

export const deleteHacienda = async (req, res, next) => {
  const id = ensurePositiveInteger(req.params?.id, null);

  if (!id) {
    return res.status(400).json({ message: "Identificador de hacienda inválido" });
  }

  try {
    const deleteQuery = `
      UPDATE PUBLIC.HACIENDA
      SET ACTIVO = FALSE
      WHERE ID = $1
      RETURNING ${haciendaColumns}
    `;

    const result = await db.query(deleteQuery, [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "La hacienda solicitada no existe" });
    }

    res.json({ data: result.rows[0] });
  } catch (error) {
    console.error("[HACIENDA] Error al eliminar hacienda", error);
    next(error);
  }
};
