import db from "../db.js";

export const getTipoArea = async (req, res) => {
  try {
    const result = await db.query(`
      SELECT id, nombre 
      FROM public.tipo_area 
      WHERE activo = true 
      ORDER BY nombre ASC;
    `);
    res.json(result.rows);
  } catch (error) {
    console.error("[API][ERROR] /api/tipo_area:", error);
    res.status(500).json({ 
      error: "[API][ERROR] /api/tipo_area", 
      details: error.message 
    });
  }
};
