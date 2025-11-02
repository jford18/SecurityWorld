import pool from "../config/db.js";

export const getSitios = async (_req, res) => {
  try {
    const result = await pool.query(`
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
    console.error(
      `[${new Date().toISOString()}] Error en /api/sitios (getSitios):`,
      error.message
    );
    return res
      .status(500)
      .json({ message: "Error al obtener los sitios." });
  }
};

export default getSitios;
