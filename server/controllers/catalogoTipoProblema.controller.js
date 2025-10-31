// NEW: Controlador REST para el catálogo de tipos de problema.
import pool from "../db.js";

const normalizeDescripcion = (descripcion = "") => descripcion.trim();

// NEW: Lista todos los tipos de problema ordenados por id ascendente.
export const getCatalogoTiposProblema = async (_req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT id, descripcion FROM catalogo_tipo_problema ORDER BY id ASC"
    );

    return res.json({ data: rows });
  } catch (error) {
    console.error("Error al obtener catálogo de tipos de problema", error);
    // FIX: Todos los errores devuelven JSON para evitar respuestas HTML inesperadas.
    return res
      .status(500)
      .json({ message: "Error al obtener el catálogo de tipos de problema" });
  }
};

// NEW: Crea un nuevo tipo de problema validando datos y duplicados.
export const createCatalogoTipoProblema = async (req, res) => {
  const { descripcion } = req.body ?? {};
  const normalized = normalizeDescripcion(typeof descripcion === "string" ? descripcion : "");

  if (!normalized) {
    // FIX: Validación de campo obligatorio solicitada en la especificación.
    return res.status(422).json({ message: "La descripción es obligatoria" });
  }

  try {
    const duplicateCheck = await pool.query(
      "SELECT 1 FROM catalogo_tipo_problema WHERE LOWER(descripcion) = LOWER($1) LIMIT 1",
      [normalized]
    );

    if (duplicateCheck.rowCount > 0) {
      // FIX: Validación para evitar insertar descripciones duplicadas en la base de datos.
      return res.status(409).json({ message: "El tipo de problema ya existe" });
    }

    const result = await pool.query(
      "INSERT INTO catalogo_tipo_problema (descripcion) VALUES ($1) RETURNING id, descripcion",
      [normalized]
    );

    return res.status(201).json({ message: "Registro creado", data: result.rows[0] });
  } catch (error) {
    console.error("Error al crear tipo de problema", error);
    return res
      .status(500)
      .json({ message: "Error al crear el tipo de problema" });
  }
};

// NEW: Actualiza un tipo de problema existente con validaciones y control de duplicados.
export const updateCatalogoTipoProblema = async (req, res) => {
  const { id } = req.params;
  const { descripcion } = req.body ?? {};
  const normalized = normalizeDescripcion(typeof descripcion === "string" ? descripcion : "");

  if (!normalized) {
    return res.status(422).json({ message: "La descripción es obligatoria" });
  }

  try {
    const existing = await pool.query(
      "SELECT id FROM catalogo_tipo_problema WHERE id = $1",
      [id]
    );

    if (existing.rowCount === 0) {
      return res.status(404).json({ message: "El tipo de problema no existe" });
    }

    const duplicateCheck = await pool.query(
      "SELECT 1 FROM catalogo_tipo_problema WHERE LOWER(descripcion) = LOWER($1) AND id <> $2 LIMIT 1",
      [normalized, id]
    );

    if (duplicateCheck.rowCount > 0) {
      // FIX: Se impide actualizar a una descripción existente para mantener la restricción UNIQUE.
      return res.status(409).json({ message: "El tipo de problema ya existe" });
    }

    const result = await pool.query(
      "UPDATE catalogo_tipo_problema SET descripcion = $1 WHERE id = $2 RETURNING id, descripcion",
      [normalized, id]
    );

    return res.json({ message: "Registro actualizado", data: result.rows[0] });
  } catch (error) {
    console.error("Error al actualizar tipo de problema", error);
    return res
      .status(500)
      .json({ message: "Error al actualizar el tipo de problema" });
  }
};

// NEW: Elimina un tipo de problema devolviendo siempre JSON.
export const deleteCatalogoTipoProblema = async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      "DELETE FROM catalogo_tipo_problema WHERE id = $1 RETURNING id, descripcion",
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "El tipo de problema no existe" });
    }

    return res.json({ message: "Registro eliminado", data: result.rows[0] });
  } catch (error) {
    console.error("Error al eliminar tipo de problema", error);
    return res
      .status(500)
      .json({ message: "Error al eliminar el tipo de problema" });
  }
};
