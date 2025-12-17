import { pool } from "../db.js";

export const getEncodingDevices = async (req, res) => {
  const { siteName } = req.query || {};

  if (!siteName) {
    return res.json([]);
  }

  try {
    const query = `
SELECT DISTINCT
    A.ID,
    A.NAME
FROM HIK_ENCODING_DEVICE_STATUS A
JOIN HIK_CAMERA_RESOURCE_STATUS  B ON (B.IP_ADDRESS = A.ADDRESS)
WHERE B.SITE_NAME = $1
ORDER BY A.NAME;
`;

    const result = await pool.query(query, [siteName]);
    return res.json(result.rows || []);
  } catch (error) {
    console.error("Error al obtener dispositivos de grabación:", error);
    return res.status(500).json({ message: "Error interno del servidor" });
  }
};
