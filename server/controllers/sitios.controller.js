import db from "../config/db.js";

const pool = db;

export const getSitios = async (_req, res) => {
  const client = await pool.connect();

  try {
    const result = await client.query(`
      SELECT
        s.id,
        s.nombre,
        s.cliente_id,
        s.consola_id,
        c.nombre AS cliente_nombre,
        cons.nombre AS consola_nombre
      FROM sitios s
      LEFT JOIN clientes c ON c.id = s.cliente_id
      LEFT JOIN consolas cons ON cons.id = s.consola_id
      ORDER BY s.nombre
    `);

    return res.json(result.rows ?? []);
  } catch (error) {
    console.error("Error al obtener los sitios:", error);
    return res
      .status(500)
      .json({ mensaje: "Ocurrió un error al obtener los sitios." });
  } finally {
    client.release();
  }
};

export default getSitios;
