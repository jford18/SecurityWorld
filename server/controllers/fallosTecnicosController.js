import { pool } from "../db.js";

export const getCamerasBySite = async (req, res) => {
  try {
    const { siteName } = req.params;

    const query = `
      SELECT
        id,
        camera_name,
        ip_address
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

export const getAlarmInputStatusBySite = async (req, res) => {
  try {
    const { sitioId } = req.query;

    if (!sitioId) {
      return res.json([]);
    }

    const parsedSitioId = Number(sitioId);
    if (!Number.isFinite(parsedSitioId)) {
      return res.json([]);
    }

    const query = `
      SELECT
          A.ID,
          A.NAME,
          A.AREA
      FROM PUBLIC.HIK_ALARM_INPUT_STATUS A
      JOIN PUBLIC.SITIOS B ON (B.ID = $1)
      WHERE A.AREA ILIKE B.NOMBRE
      ORDER BY A.NAME;
    `;

    const result = await pool.query(query, [parsedSitioId]);
    return res.json(result.rows);
  } catch (error) {
    console.error("Error al obtener alarm inputs por sitio:", error);
    return res.status(500).json({ message: "Error interno del servidor" });
  }
};
