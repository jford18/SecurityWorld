import db from "../db.js";

const formatSuccess = (message, data = null) => ({
  status: "success",
  message,
  data,
});

const formatError = (message) => ({
  status: "error",
  message,
});

const sanitizeDescripcion = (value) =>
  typeof value === "string" ? value.trim() : "";

const mapRow = (row) => ({
  id: row.id,
  descripcion: row.descripcion,
});

const ensureDescripcionIsUnique = async (descripcion, excludeId = null) => {
  const params = [descripcion];
  let sql = `
    SELECT 1
    FROM public.catalogo_tipo_problema
    WHERE LOWER(descripcion) = LOWER($1)
  `;

  if (excludeId !== null) {
    sql += " AND id <> $2";
    params.push(excludeId);
  }

  const existing = await db.query(sql, params);
  return existing.rowCount === 0;
};

export const getCatalogoTiposProblema = async (_req, res) => {
  try {
    const sql = `
      SELECT id, descripcion
      FROM public.catalogo_tipo_problema
      ORDER BY id ASC
    `;
    const { rows } = await db.query(sql);
    res
      .status(200)
      .json(
        formatSuccess(
          "Listado de tipos de problema",
          rows?.map(mapRow) ?? []
        )
      );
  } catch (error) {
    console.error("[API][ERROR] /api/v1/catalogo-tipo-problema:", error);
    res
      .status(500)
      .json(formatError("Error al obtener el catálogo de tipos de problema"));
  }
};

export const getCatalogoTipoProblemaById = async (req, res) => {
  const { id } = req.params;

  try {
    const sql = `
      SELECT id, descripcion
      FROM public.catalogo_tipo_problema
      WHERE id = $1
    `;
    const { rows, rowCount } = await db.query(sql, [id]);

    if (rowCount === 0) {
      return res
        .status(404)
        .json(formatError("El tipo de problema solicitado no existe"));
    }

    res
      .status(200)
      .json(formatSuccess("Tipo de problema encontrado", mapRow(rows[0])));
  } catch (error) {
    console.error("[API][ERROR] /api/v1/catalogo-tipo-problema/:id", error);
    res
      .status(500)
      .json(formatError("Error al obtener el tipo de problema solicitado"));
  }
};

export const createCatalogoTipoProblema = async (req, res) => {
  const descripcion = sanitizeDescripcion(req.body?.descripcion);

  if (!descripcion) {
    return res
      .status(422)
      .json(formatError("La descripción del tipo de problema es obligatoria"));
  }

  try {
    const isUnique = await ensureDescripcionIsUnique(descripcion);
    if (!isUnique) {
      return res
        .status(409)
        .json(formatError("El tipo de problema ya existe"));
    }

    const sql = `
      INSERT INTO public.catalogo_tipo_problema (descripcion)
      VALUES ($1)
      RETURNING id, descripcion
    `;
    const { rows } = await db.query(sql, [descripcion]);

    res
      .status(201)
      .json(
        formatSuccess(
          "Tipo de problema creado correctamente",
          mapRow(rows[0])
        )
      );
  } catch (error) {
    console.error("[API][ERROR] POST /api/v1/catalogo-tipo-problema", error);
    res
      .status(500)
      .json(formatError("Error al crear el tipo de problema"));
  }
};

export const updateCatalogoTipoProblema = async (req, res) => {
  const { id } = req.params;
  const descripcion = sanitizeDescripcion(req.body?.descripcion);

  if (!descripcion) {
    return res
      .status(422)
      .json(formatError("La descripción del tipo de problema es obligatoria"));
  }

  try {
    const isUnique = await ensureDescripcionIsUnique(descripcion, id);
    if (!isUnique) {
      return res
        .status(409)
        .json(formatError("Ya existe otro tipo de problema con esa descripción"));
    }

    const sql = `
      UPDATE public.catalogo_tipo_problema
      SET descripcion = $1
      WHERE id = $2
      RETURNING id, descripcion
    `;
    const { rows, rowCount } = await db.query(sql, [descripcion, id]);

    if (rowCount === 0) {
      return res
        .status(404)
        .json(formatError("El tipo de problema indicado no existe"));
    }

    res
      .status(200)
      .json(
        formatSuccess(
          "Tipo de problema actualizado correctamente",
          mapRow(rows[0])
        )
      );
  } catch (error) {
    console.error("[API][ERROR] PUT /api/v1/catalogo-tipo-problema/:id", error);
    res
      .status(500)
      .json(formatError("Error al actualizar el tipo de problema"));
  }
};

export const deleteCatalogoTipoProblema = async (req, res) => {
  const { id } = req.params;

  try {
    const sql = `
      DELETE FROM public.catalogo_tipo_problema
      WHERE id = $1
      RETURNING id
    `;
    const { rowCount } = await db.query(sql, [id]);

    if (rowCount === 0) {
      return res
        .status(404)
        .json(formatError("El tipo de problema indicado no existe"));
    }

    res
      .status(200)
      .json(formatSuccess("Tipo de problema eliminado correctamente"));
  } catch (error) {
    console.error("[API][ERROR] DELETE /api/v1/catalogo-tipo-problema/:id", error);
    res
      .status(500)
      .json(formatError("Error al eliminar el tipo de problema"));
  }
};
