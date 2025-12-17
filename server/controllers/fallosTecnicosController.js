import { pool } from "../db.js";

export const getCamerasBySite = async (req, res) => {
  try {
    const { siteName } = req.params;

    const query = `
      SELECT
        id,
        camera_name,
        ip_adress
      FROM hik_camera_resource_status
      WHERE site_name = $1
      ORDER BY camera_name;
    `;

    const result = await pool.query(query, [siteName]);
    return res.json(result.rows);
  } catch (error) {
    console.error("Error al obtener cámaras por sitio:", error);
    return res.status(500).json({ message: "Error interno del servidor" });
  }
};

