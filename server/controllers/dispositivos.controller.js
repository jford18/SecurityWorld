import pool from "../config/db.js";

export const getDispositivos = async (_req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        d.id,
        d.nombre,
        d.estado,
        d.sitio_id,
        d.tipo_equipo_id
      FROM dispositivos d
      ORDER BY d.nombre
    `);

    return res.json(result.rows ?? []);
  } catch (error) {
    console.error(
      `[${new Date().toISOString()}] Error en /api/dispositivos (getDispositivos):`,
      error.message
    );
    return res
      .status(500)
      .json({ message: "Error al obtener los dispositivos." });
  }
};

export default getDispositivos;
