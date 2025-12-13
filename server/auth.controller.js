import jwt from "jsonwebtoken";
import db from "./db.js";

export const loginUser = async (req, res) => {
  try {
    const { nombre_usuario, contrasena } = req.body;

    if (!nombre_usuario || !contrasena) {
      return res
        .status(400)
        .json({ message: "Usuario y contraseña son obligatorios." });
    }

    const userResult = await db.query(
      `SELECT id, nombre_usuario, contrasena, activo, debe_cambiar_clave
       FROM usuarios
       WHERE nombre_usuario = $1`,
      [nombre_usuario]
    );

    if (userResult.rows.length === 0) {
      return res
        .status(401)
        .json({ message: "Usuario o contraseña incorrectos" });
    }

    const user = userResult.rows[0];

    if (!user.activo || user.contrasena !== contrasena) {
      return res
        .status(401)
        .json({ message: "Usuario o contraseña incorrectos" });
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

    const token = jwt.sign(
      {
        usuario_id: user.id,
        nombre_usuario: user.nombre_usuario,
      },
      process.env.JWT_SECRET || "default_secret",
      { expiresIn: process.env.JWT_EXPIRES_IN || "8h" }
    );

    return res.json({
      usuario_id: user.id,
      nombre_usuario: user.nombre_usuario,
      rol_id: primaryRole.rol_id,
      rol_nombre: primaryRole.rol_nombre,
      token,
      requirePasswordChange: Boolean(user.debe_cambiar_clave),
    });
  } catch (error) {
    console.error("Error en loginUser:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
};

export const changeOwnPassword = async (req, res) => {
  try {
    const userId = req.user?.usuario_id;
    const { nuevaContrasena } = req.body ?? {};

    if (!userId) {
      return res.status(401).json({ message: "Usuario no autenticado" });
    }

    const trimmedPassword = typeof nuevaContrasena === "string" ? nuevaContrasena.trim() : "";

    if (!trimmedPassword) {
      return res.status(400).json({ message: "La nueva contraseña es obligatoria" });
    }

    const updateResult = await db.query(
      `UPDATE usuarios
       SET contrasena = $1,
           debe_cambiar_clave = FALSE
       WHERE id = $2
       RETURNING id`,
      [trimmedPassword, userId]
    );

    if (updateResult.rows.length === 0) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    return res.json({
      success: true,
      message: "Contraseña actualizada correctamente",
    });
  } catch (error) {
    console.error("Error en changeOwnPassword:", error);
    return res.status(500).json({ message: "Error interno del servidor" });
  }
};
