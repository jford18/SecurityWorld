import db from "./db.js";
import bcrypt from "bcrypt";

export const loginUser = async (req, res) => {
  try {
    const { nombre_usuario, contrasena_plana } = req.body;

    if (!nombre_usuario || !contrasena_plana) {
      return res
        .status(400)
        .json({ message: "Usuario y contraseña son obligatorios." });
    }

    const userResult = await db.query(
      `SELECT id, nombre_usuario, hash_contrasena, activo
       FROM usuarios
       WHERE nombre_usuario = $1`,
      [nombre_usuario]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ message: "Credenciales inválidas." });
    }

    const user = userResult.rows[0];

    if (!user.activo) {
      return res
        .status(403)
        .json({ message: "El usuario está inactivo. Contacte al administrador." });
    }

    if (!user.hash_contrasena) {
      return res.status(401).json({ message: "Credenciales inválidas." });
    }

    

    const rolesResult = await db.query(
      `SELECT r.id AS rol_id, r.nombre AS rol_nombre
       FROM usuario_roles ur
       INNER JOIN roles r ON r.id = ur.rol_id
       WHERE ur.usuario_id = $1
       ORDER BY ur.rol_id ASC`,
      [user.id]
    );

    if (rolesResult.rows.length === 0) {
      return res.status(403).json({
        message:
          "El usuario no tiene un rol asignado. Contacte al administrador del sistema.",
      });
    }

    const primaryRole = rolesResult.rows[0];

    return res.json({
      usuario_id: user.id,
      nombre_usuario: user.nombre_usuario,
      rol_id: primaryRole.rol_id,
      rol_nombre: primaryRole.rol_nombre,
    });
  } catch (error) {
    console.error("Error en loginUser:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
};
