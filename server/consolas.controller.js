import db from "./db.js"; // ajusta a tu conexión real

export const getAllConsolas = async (req, res) => {
  try {
    const result = await db.query(
      "SELECT id, nombre FROM consolas WHERE activo = true ORDER BY nombre"
    );
    res.json(result.rows);
  } catch (error) {
    console.error("Error al obtener consolas:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
};
