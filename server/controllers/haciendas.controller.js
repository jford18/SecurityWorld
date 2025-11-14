import db from "../db.js";

export const getHaciendas = async (_req, res) => {
  try {
    const result = await db.query(`
      SELECT id, nombre, direccion, activo
      FROM public.hacienda
      WHERE activo = true
      ORDER BY nombre ASC;
    `);
    res.json(result.rows);
  } catch (error) {
    console.error("[API][ERROR] /api/haciendas:", error);
    res.status(500).json({
      error: "[API][ERROR] /api/haciendas",
      details: error.message,
    });
  }
};

export const createHacienda = async (req, res) => {
  try {
    const { nombre, direccion, activo } = req.body;

    if (!nombre) {
      return res.status(400).json({ message: "El nombre es requerido" });
    }

    const result = await db.query(
      `
        INSERT INTO public.hacienda (nombre, direccion, activo)
        VALUES ($1, $2, $3)
        RETURNING id, nombre, direccion, activo;
      `,
      [nombre, direccion, activo ?? true]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("[HACIENDAS][POST] Error:", error);
    res.status(500).json({ message: "Error al crear la hacienda" });
  }
};

export const updateHacienda = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, direccion, activo } = req.body;

    if (!nombre) {
      return res.status(400).json({ message: "El nombre es requerido" });
    }

    const result = await db.query(
      `
        UPDATE public.hacienda
        SET nombre = $1, direccion = $2, activo = $3
        WHERE id = $4
        RETURNING id, nombre, direccion, activo;
      `,
      [nombre, direccion, activo ?? true, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Hacienda no encontrada" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("[HACIENDAS][PUT] Error:", error);
    res.status(500).json({ message: "Error al actualizar la hacienda" });
  }
};

export const deleteHacienda = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `
        DELETE FROM public.hacienda
        WHERE id = $1
        RETURNING id;
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Hacienda no encontrada" });
    }

    res.status(204).send();
  } catch (error) {
    console.error("[HACIENDAS][DELETE] Error:", error);
    res.status(500).json({ message: "Error al eliminar la hacienda" });
  }
};