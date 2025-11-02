import db from "../config/db.js";

const pool = db;

export const getDispositivos = async (_req, res) => {
  const client = await pool.connect();

  try {
    const result = await client.query(`
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
    console.error("Error al obtener los dispositivos:", error);
    return res
      .status(500)
      .json({ mensaje: "Ocurrió un error al obtener los dispositivos." });
  } finally {
    client.release();
  }
};

export default getDispositivos;
