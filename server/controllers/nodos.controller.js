import pool from "../db.js";

const SITIO_NOT_FOUND_MESSAGE = "No se encontró sitio";

const formatSuccess = (message, data = null) => ({
  status: "success",
  message,
  data,
});

const formatError = (message) => ({
  status: "error",
  message,
});

export const listNodos = async (_req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, nombre, activo, fecha_creacion FROM nodos ORDER BY id"
    );
    res.status(200).json(formatSuccess("Listado de nodos", result.rows));
  } catch (error) {
    console.error("Error al listar nodos:", error);
    res.status(500).json(formatError("Error al listar los nodos"));
  }
};

export const getSitioByNodo = async (req, res) => {
  try {
    const { id } = req.params;
    const query = `
      SELECT S.id, S.nombre
      FROM nodos_sitios NS
      INNER JOIN sitios S ON (S.id = NS.sitio_id)
      WHERE NS.nodo_id = $1
      LIMIT 1;
    `;
    const result = await pool.query(query, [id]);
    if (result.rows.length === 0)
      return res.status(404).json({ message: SITIO_NOT_FOUND_MESSAGE });
    res.json(result.rows[0]);
  } catch (error) {
    console.error("[NODOS] Error al obtener sitio por nodo:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
};

export const getNodoById = async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      "SELECT id, nombre, activo, fecha_creacion FROM nodos WHERE id = $1",
      [id]
    );

    if (result.rowCount === 0) {
      return res
        .status(404)
        .json(formatError("El nodo solicitado no existe"));
    }

    res
      .status(200)
      .json(formatSuccess("Nodo obtenido correctamente", result.rows[0]));
  } catch (error) {
    console.error("Error al obtener nodo:", error);
    res.status(500).json(formatError("Error al obtener el nodo"));
  }
};

export const createNodo = async (req, res) => {
  const { nombre } = req.body ?? {};
  const trimmedName = typeof nombre === "string" ? nombre.trim() : "";

  if (!trimmedName) {
    return res
      .status(422)
      .json(formatError("El nombre del nodo es obligatorio"));
  }

  try {
    const duplicate = await pool.query(
      "SELECT id FROM nodos WHERE LOWER(nombre) = LOWER($1)",
      [trimmedName]
    );

    if (duplicate.rowCount > 0) {
      return res
        .status(409)
        .json(formatError("Ya existe un nodo con ese nombre"));
    }

    const insertResult = await pool.query(
      "INSERT INTO nodos (nombre, activo) VALUES ($1, true) RETURNING id, nombre, activo, fecha_creacion",
      [trimmedName]
    );

    res
      .status(201)
      .json(
        formatSuccess(
          "Nodo creado correctamente",
          insertResult.rows[0]
        )
      );
  } catch (error) {
    console.error("Error al crear nodo:", error);
    res.status(500).json(formatError("Error al crear el nodo"));
  }
};

export const updateNodo = async (req, res) => {
  const { id } = req.params;
  const { nombre, activo } = req.body ?? {};

  const updates = [];
  const values = [];
  let index = 1;

  if (nombre !== undefined) {
    const trimmedName = typeof nombre === "string" ? nombre.trim() : "";

    if (!trimmedName) {
      return res
        .status(422)
        .json(formatError("El nombre del nodo es obligatorio"));
    }

    try {
      const duplicate = await pool.query(
        "SELECT id FROM nodos WHERE LOWER(nombre) = LOWER($1) AND id <> $2",
        [trimmedName, id]
      );

      if (duplicate.rowCount > 0) {
        return res
          .status(409)
          .json(formatError("Ya existe un nodo con ese nombre"));
      }
    } catch (error) {
      console.error("Error al validar duplicados de nodo:", error);
      return res
        .status(500)
        .json(formatError("Error al actualizar el nodo"));
    }

    updates.push(`nombre = $${index}`);
    values.push(trimmedName);
    index += 1;
  }

  if (activo !== undefined) {
    const normalizedActive =
      typeof activo === "string"
        ? ["1", "true", "t", "on"].includes(activo.trim().toLowerCase())
        : Boolean(activo);

    updates.push(`activo = $${index}`);
    values.push(normalizedActive);
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
      `UPDATE nodos SET ${updates.join(", ")} WHERE id = $${index} RETURNING id, nombre, activo, fecha_creacion`,
      values
    );

    if (result.rowCount === 0) {
      return res
        .status(404)
        .json(formatError("El nodo solicitado no existe"));
    }

    res
      .status(200)
      .json(formatSuccess("Nodo actualizado correctamente", result.rows[0]));
  } catch (error) {
    console.error("Error al actualizar nodo:", error);
    res.status(500).json(formatError("Error al actualizar el nodo"));
  }
};

export const deleteNodo = async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query("DELETE FROM nodos WHERE id = $1", [id]);

    if (result.rowCount === 0) {
      return res.status(404).json(formatError("El nodo solicitado no existe"));
    }

    res
      .status(200)
      .json(formatSuccess("Nodo eliminado correctamente"));
  } catch (error) {
    console.error("Error al eliminar nodo:", error);
    res.status(500).json(formatError("Error al eliminar el nodo"));
  }
};

