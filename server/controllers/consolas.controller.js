import pool from "../db.js";

export const getConsolas = async (_req, res) => {
  res.setHeader("Content-Type", "application/json"); // FIX: Forzar respuestas JSON válidas.
  try {
    const result = await pool.query(
      "SELECT id, nombre, fecha_creacion FROM consolas ORDER BY id ASC"
    );
    res.status(200).json(result.rows); // FIX: Garantizar respuesta JSON explícita.
  } catch (error) {
    console.error("Error al obtener consolas:", error);
    // FIX: Respuesta de error consistente en formato JSON.
    res.status(500).json({ message: "Error interno del servidor" });
  }
};

export const createConsola = async (req, res) => {
  res.setHeader("Content-Type", "application/json"); // FIX: Forzar respuestas JSON válidas.
  try {
    const { nombre } = req.body;
    if (!nombre || nombre.trim() === "") {
      return res.status(422).json({ message: "El nombre es obligatorio" });
    }

    const existe = await pool.query(
      "SELECT id FROM consolas WHERE LOWER(nombre) = LOWER($1)",
      [nombre]
    );
    if (existe.rowCount > 0) {
      return res.status(409).json({ message: "La consola ya existe" });
    }

    const result = await pool.query(
      "INSERT INTO consolas (nombre) VALUES ($1) RETURNING id, nombre, fecha_creacion",
      [nombre]
    );

    res
      .status(201)
      .json({
        message: "Consola creada correctamente",
        data: result.rows[0],
      });
  } catch (error) {
    console.error("Error al crear consola:", error);
    // FIX: Respuesta de error consistente en formato JSON.
    res.status(500).json({ message: "Error interno del servidor" });
  }
};

export const updateConsola = async (req, res) => {
  res.setHeader("Content-Type", "application/json"); // FIX: Forzar respuestas JSON válidas.
  try {
    const { id } = req.params;
    const { nombre } = req.body;
    if (!nombre || nombre.trim() === "") {
      return res.status(422).json({ message: "El nombre es obligatorio" });
    }

    const result = await pool.query(
      "UPDATE consolas SET nombre = $1 WHERE id = $2 RETURNING id, nombre, fecha_creacion",
      [nombre, id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Consola no encontrada" });
    }

    res
      .status(200)
      .json({ message: "Consola actualizada", data: result.rows[0] }); // FIX: Garantizar respuesta JSON explícita.
  } catch (error) {
    console.error("Error al actualizar consola:", error);
    // FIX: Respuesta de error consistente en formato JSON.
    res.status(500).json({ message: "Error interno del servidor" });
  }
};

export const deleteConsola = async (req, res) => {
  res.setHeader("Content-Type", "application/json"); // FIX: Forzar respuestas JSON válidas.
  try {
    const { id } = req.params;
    const result = await pool.query("DELETE FROM consolas WHERE id = $1", [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Consola no encontrada" });
    }
    res
      .status(200)
      .json({ message: "Consola eliminada correctamente" }); // FIX: Garantizar respuesta JSON explícita.
  } catch (error) {
    console.error("Error al eliminar consola:", error);
    // FIX: Respuesta de error consistente en formato JSON.
    res.status(500).json({ message: "Error interno del servidor" });
  }
};
