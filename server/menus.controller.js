import db from "./db.js";

export const getMenus = async (req, res) => {
  try {
    const result = await db.query(
      "SELECT id, nombre, icono, ruta, seccion, orden, activo FROM menus WHERE activo = true ORDER BY orden"
    );
    res.json(result.rows);
  } catch (error) {
    console.error("Error en getMenus:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
};
