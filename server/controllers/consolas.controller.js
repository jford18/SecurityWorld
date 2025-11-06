import pool from "../db.js";

export const getConsolas = async (_req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, nombre FROM consolas WHERE activo = true ORDER BY nombre"
    );
    res.status(200).json(result.rows);
  } catch (error) {
    console.error("Error al obtener consolas:", error);
    res.status(500).json({ message: "Error al obtener consolas" });
  }
};

export const createConsola = async (req, res) => {
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
    res.status(500).json({ message: "Error interno del servidor" });
  }
};

export const updateConsola = async (req, res) => {
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
    res.status(500).json({ message: "Error interno del servidor" });
  }
};

export const deleteConsola = async (req, res) => {
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
    res.status(500).json({ message: "Error interno del servidor" });
  }
};
