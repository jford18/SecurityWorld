import db from "../config/db.js";

const pool = db;

export const getNodos = async (_req, res) => {
  const client = await pool.connect();

  try {
    const result = await client.query(
      "SELECT id, nombre FROM nodos ORDER BY nombre"
    );

    return res.json(result.rows ?? []);
  } catch (error) {
    console.error("Error al obtener los nodos:", error);
    return res
      .status(500)
      .json({ mensaje: "Ocurrió un error al obtener los nodos." });
  } finally {
    client.release();
  }
};

export default getNodos;
