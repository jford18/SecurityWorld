import pool from "../db.js";

// NEW: Controlador para obtener la lista de consolas ordenada por identificador ascendente.
export const getConsolas = async (_req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, nombre, fecha_creacion FROM consolas ORDER BY id ASC"
    );
    res.json({ data: result.rows });
  } catch (error) {
    console.error("Error en consolas:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
};

// NEW: Controlador para registrar una nueva consola validando nombre obligatorio y duplicados.
export const createConsola = async (req, res) => {
  try {
    const rawName = typeof req.body?.nombre === "string" ? req.body.nombre : "";
    const nombre = rawName.trim();

    if (!nombre) {
      // FIX: Validación de nombre vacío con respuesta 422 exclusivamente en JSON.
      return res.status(422).json({ message: "El nombre es obligatorio" });
    }

    const duplicateCheck = await pool.query(
      "SELECT id FROM consolas WHERE LOWER(nombre) = LOWER($1) LIMIT 1",
      [nombre]
    );

    if (duplicateCheck.rowCount > 0) {
      // FIX: Gestión de nombres duplicados devolviendo el código 409 indicado.
      return res.status(409).json({ message: "La consola ya existe" });
    }

    const insertResult = await pool.query(
      "INSERT INTO consolas (nombre) VALUES ($1) RETURNING id, nombre, fecha_creacion",
      [nombre]
    );

    res
      .status(201)
      .json({ message: "Consola creada", data: insertResult.rows[0] });
  } catch (error) {
    console.error("Error en consolas:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
};

// NEW: Controlador para actualizar el nombre de una consola existente garantizando reglas de validación.
export const updateConsola = async (req, res) => {
  try {
    const id = Number.parseInt(req.params?.id, 10);
    if (!Number.isFinite(id)) {
      // FIX: Validación de identificador inválido retornando JSON consistente.
      return res.status(400).json({ message: "Identificador inválido" });
    }

    const rawName = typeof req.body?.nombre === "string" ? req.body.nombre : "";
    const nombre = rawName.trim();

    if (!nombre) {
      // FIX: Se respeta el código 422 cuando el nombre viene vacío en el cuerpo de la petición.
      return res.status(422).json({ message: "El nombre es obligatorio" });
    }

    const duplicateCheck = await pool.query(
      "SELECT id FROM consolas WHERE LOWER(nombre) = LOWER($1) AND id <> $2 LIMIT 1",
      [nombre, id]
    );

    if (duplicateCheck.rowCount > 0) {
      // FIX: Validación de duplicados al actualizar el nombre de la consola.
      return res.status(409).json({ message: "La consola ya existe" });
    }

    const updateResult = await pool.query(
      "UPDATE consolas SET nombre = $1 WHERE id = $2 RETURNING id, nombre, fecha_creacion",
      [nombre, id]
    );

    if (updateResult.rowCount === 0) {
      return res.status(404).json({ message: "Consola no encontrada" });
    }

    res.json({ message: "Consola actualizada", data: updateResult.rows[0] });
  } catch (error) {
    console.error("Error en consolas:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
};

// NEW: Controlador para eliminar una consola retornando siempre JSON legible por el frontend.
export const deleteConsola = async (req, res) => {
  try {
    const id = Number.parseInt(req.params?.id, 10);
    if (!Number.isFinite(id)) {
      // FIX: Validación de identificador inválido al eliminar una consola.
      return res.status(400).json({ message: "Identificador inválido" });
    }

    const deleteResult = await pool.query(
      "DELETE FROM consolas WHERE id = $1 RETURNING id, nombre, fecha_creacion",
      [id]
    );

    if (deleteResult.rowCount === 0) {
      return res.status(404).json({ message: "Consola no encontrada" });
    }

    res.json({ message: "Consola eliminada", data: deleteResult.rows[0] });
  } catch (error) {
    console.error("Error en consolas:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
};
