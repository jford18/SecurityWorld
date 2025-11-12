import db from "../db.js";

export const getHaciendas = async (req, res) => {
  try {
    const result = await db.query(`
      SELECT id, nombre
      FROM public.hacienda
      WHERE activo = true
      ORDER BY nombre ASC;
    `);
    res.json(result.rows);
  } catch (error) {
    console.error("[API][ERROR] /api/haciendas:", error);
    res.status(500).json({
      error: "[API][ERROR] /api/haciendas",
      details: error.message
    });
  }
};