import pool from "../config/db.js";

export const getNodos = async (_req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, nombre FROM nodos ORDER BY nombre"
    );

    return res.json(result.rows ?? []);
  } catch (error) {
    console.error(
      `[${new Date().toISOString()}] Error en /api/nodos (getNodos):`,
      error.message
    );
    return res
      .status(500)
      .json({ message: "Error al obtener los nodos." });
  }
};

export default getNodos;
