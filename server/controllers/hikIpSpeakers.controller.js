import { pool } from "../db.js";

export const getIpSpeakers = async (req, res) => {
  const { siteName } = req.query || {};

  if (!siteName) {
    return res.json([]);
  }

  try {
    const query = `
SELECT
    A.ID,
    A.NAME
FROM HIK_IP_SPEAKER_STATUS A
WHERE SUBSTRING(SPLIT_PART(A.NAME, '_', 1) FROM (POSITION('-' IN SPLIT_PART(A.NAME, '_', 1)) + 1)) = $1
ORDER BY A.NAME;
`;

    const result = await pool.query(query, [siteName]);
    return res.json(result.rows || []);
  } catch (error) {
    console.error("Error al obtener megáfonos IP:", error);
    return res.status(500).json({ message: "Error interno del servidor" });
  }
};
