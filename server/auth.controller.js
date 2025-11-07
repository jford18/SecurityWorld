import db from "./db.js"; // o tu conexión PostgreSQL
import bcrypt from "bcrypt";

export const loginUser = async (req, res) => {
  try {
    const { nombre_usuario, contrasena_plana } = req.body;

    const result = await db.query(
      "SELECT id, nombre_usuario, hash_contrasena FROM usuarios WHERE nombre_usuario = $1",
      [nombre_usuario]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    const user = result.rows[0];
    

    return res.json({
      id: user.id,
      usuario: user.usuario,
      rol: "Administrador",
      token: "fake-jwt-token",
    });
  } catch (error) {
    console.error("Error en loginUser:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
};
