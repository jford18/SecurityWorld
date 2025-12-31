import { pool } from "../db.js";

export const getCamarasPorSitio = async (req, res) => {
  const sitioIdRaw = req.query?.sitioId ?? req.params?.sitioId;
  const sitioId = Number(sitioIdRaw);

  if (!Number.isFinite(sitioId) || sitioId <= 0) {
    return res.json([]);
  }

  try {
    const siteResult = await pool.query(
      "SELECT NOMBRE AS site_name FROM SITIOS WHERE ID = $1",
      [sitioId],
    );

    const siteName = siteResult?.rows?.[0]?.site_name;

    if (!siteName) {
      return res.json([]);
    }

    const query = `
      SELECT
        A.ID AS id,
        A.CAMERA_NAME AS name,
        A.IP_ADDRESS AS ip_address
      FROM HIK_CAMERA_RESOURCE_STATUS A
      WHERE A.SITE_NAME = $1
      ORDER BY A.CAMERA_NAME;
    `;

    const result = await pool.query(query, [siteName]);
    const data = Array.isArray(result?.rows)
      ? result.rows.map((row) => ({
          id: row.id,
          name: row.name,
          ip_address: row.ip_address,
        }))
      : [];

    return res.json(data);
  } catch (error) {
    console.error("Error al obtener cámaras por sitio:", error);
    return res.status(500).json({ message: "Error interno del servidor" });
  }
};
