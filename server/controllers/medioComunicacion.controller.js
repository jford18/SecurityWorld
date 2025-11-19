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

const sanitizeDescription = (value) =>
  typeof value === "string" ? value.trim() : "";

export const listMediosComunicacion = async (req, res) => {
  const searchRaw = typeof req.query?.search === "string" ? req.query.search : "";
  const search = searchRaw.trim();

  const params = [];
  let query =
    "SELECT id, descripcion, fecha_creacion FROM catalogo_medio_comunicacion";

  if (search) {
    params.push(`%${search}%`);
    query += " WHERE descripcion ILIKE $1";
  }

  query += " ORDER BY id ASC";

  try {
    const result = await pool.query(query, params);
    res
      .status(200)
      .json(
        formatSuccess(
          "Listado de medios de comunicación",
          result.rows
        )
      );
  } catch (error) {
    console.error("Error al listar medios de comunicación:", error);
    res
      .status(500)
      .json(formatError("Error al listar los medios de comunicación"));
  }
};

export const getMedioComunicacionById = async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      "SELECT id, descripcion, fecha_creacion FROM catalogo_medio_comunicacion WHERE id = $1",
      [id]
    );

    if (result.rowCount === 0) {
      return res
        .status(404)
        .json(formatError("El medio de comunicación solicitado no existe"));
    }

    res
      .status(200)
      .json(
        formatSuccess(
          "Medio de comunicación obtenido correctamente",
          result.rows[0]
        )
      );
  } catch (error) {
    console.error("Error al obtener medio de comunicación:", error);
    res
      .status(500)
      .json(formatError("Error al obtener el medio de comunicación"));
  }
};

export const createMedioComunicacion = async (req, res) => {
  const descripcion = sanitizeDescription(req.body?.descripcion);

  if (!descripcion) {
    return res
      .status(422)
      .json(formatError("La descripción del medio de comunicación es obligatoria"));
  }

  try {
    const duplicate = await pool.query(
      "SELECT id FROM catalogo_medio_comunicacion WHERE LOWER(descripcion) = LOWER($1)",
      [descripcion]
    );

    if (duplicate.rowCount > 0) {
      return res
        .status(409)
        .json(formatError("Ya existe un medio de comunicación con esa descripción"));
    }

    const insertResult = await pool.query(
      "INSERT INTO catalogo_medio_comunicacion (descripcion) VALUES ($1) RETURNING id, descripcion, fecha_creacion",
      [descripcion]
    );

    res
      .status(201)
      .json(
        formatSuccess(
          "Medio de comunicación creado correctamente",
          insertResult.rows[0]
        )
      );
  } catch (error) {
    console.error("Error al crear medio de comunicación:", error);
    res
      .status(500)
      .json(formatError("Error al crear el medio de comunicación"));
  }
};

export const updateMedioComunicacion = async (req, res) => {
  const { id } = req.params;
  const descripcion = sanitizeDescription(req.body?.descripcion);

  if (!descripcion) {
    return res
      .status(422)
      .json(formatError("La descripción del medio de comunicación es obligatoria"));
  }

  try {
    const duplicate = await pool.query(
      "SELECT id FROM catalogo_medio_comunicacion WHERE LOWER(descripcion) = LOWER($1) AND id <> $2",
      [descripcion, id]
    );

    if (duplicate.rowCount > 0) {
      return res
        .status(409)
        .json(formatError("Ya existe un medio de comunicación con esa descripción"));
    }

    const result = await pool.query(
      "UPDATE catalogo_medio_comunicacion SET descripcion = $1 WHERE id = $2 RETURNING id, descripcion, fecha_creacion",
      [descripcion, id]
    );

    if (result.rowCount === 0) {
      return res
        .status(404)
        .json(formatError("El medio de comunicación solicitado no existe"));
    }

    res
      .status(200)
      .json(
        formatSuccess(
          "Medio de comunicación actualizado correctamente",
          result.rows[0]
        )
      );
  } catch (error) {
    console.error("Error al actualizar medio de comunicación:", error);
    res
      .status(500)
      .json(formatError("Error al actualizar el medio de comunicación"));
  }
};

export const deleteMedioComunicacion = async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      "DELETE FROM catalogo_medio_comunicacion WHERE id = $1 RETURNING id",
      [id]
    );

    if (result.rowCount === 0) {
      return res
        .status(404)
        .json(formatError("El medio de comunicación solicitado no existe"));
    }

    res
      .status(200)
      .json(formatSuccess("Medio de comunicación eliminado correctamente"));
  } catch (error) {
    console.error("Error al eliminar medio de comunicación:", error);
    res
      .status(500)
      .json(formatError("Error al eliminar el medio de comunicación"));
  }
};
