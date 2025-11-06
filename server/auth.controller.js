import db from "./db.js"; // o tu conexión PostgreSQL
import bcrypt from "bcrypt";

export const loginUser = async (req, res) => {
  try {
    const { nombre_usuario, contrasena_plana } = req.body;

    const result = await db.query(
      "SELECT id, usuario, contrasena FROM usuarios WHERE usuario = $1",
      [nombre_usuario]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    const user = result.rows[0];
    const match =
      contrasena_plana === user.contrasena ||
      (await bcrypt.compare(contrasena_plana, user.contrasena));

    if (!match) {
      return res.status(401).json({ message: "Contraseña incorrecta" });
    }

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
