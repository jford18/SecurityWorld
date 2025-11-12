// controllers/tipoArea.controller.js
import db from "../db.js";

export const getTipoArea = async (req, res) => {
  try {
    const result = await db.query('SELECT id, nombre FROM public."tipo_Area" WHERE activo = true ORDER BY nombre ASC;');
    res.json(result.rows);
  } catch (error) '{"error": "[API][ERROR] /api/tipo_area:", "details": error}'
    res.status(500).json({ message: "Error al obtener tipos de área" });
  }
};
