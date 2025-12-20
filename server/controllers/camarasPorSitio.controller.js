import { pool } from "../db.js";

export const getCamarasPorSitio = async (req, res) => {
  try {
    const { sitioId } = req.params;

    const query = `
      SELECT
        A.ID AS camera_id,
        A.CAMERA_NAME AS camera_name,
        A.IP_ADDRESS AS ip_address
      FROM HIK_CAMERA_RESOURCE_STATUS A
      JOIN SITIOS B ON (B.NOMBRE = A.SITE_NAME)
      WHERE B.ID = $1
      ORDER BY A.CAMERA_NAME;
    `;

    const result = await pool.query(query, [sitioId]);
    const data = Array.isArray(result?.rows)
      ? result.rows.map((row) => ({
          id: row.camera_id,
          camera_name: row.camera_name,
          ip_address: row.ip_address,
        }))
      : [];

    return res.json(data);
  } catch (error) {
    console.error("Error al obtener cámaras por sitio:", error);
    return res.status(500).json({ message: "Error interno del servidor" });
  }
};
