import db from "./db.js"; // o tu conexión PostgreSQL
import bcrypt from "bcrypt";

export const loginUser = async (req, res) => {
  try {
    const { nombre_usuario, contrasena_plana } = req.body ?? {};

    if (
      typeof nombre_usuario !== "string" ||
      nombre_usuario.trim() === "" ||
      typeof contrasena_plana !== "string" ||
      contrasena_plana === ""
    ) {
      return res.status(400).json({ message: "Usuario y contraseña son obligatorios" });
    }

    const userResult = await db.query(
      `SELECT id, nombre_usuario, hash_contrasena, activo
       FROM usuarios
       WHERE nombre_usuario = $1`,
      [nombre_usuario]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ message: "Usuario o contraseña incorrectos" });
    }

    const user = userResult.rows[0];

    if (!user.activo) {
      return res.status(403).json({ message: "El usuario se encuentra inactivo" });
    }

    const storedHash = user.hash_contrasena ?? "";
    const passwordMatches = await bcrypt.compare(contrasena_plana, storedHash);

    if (!passwordMatches) {
      return res.status(401).json({ message: "Usuario o contraseña incorrectos" });
    }

    const rolesResult = await db.query(
      `SELECT r.id, r.nombre
       FROM usuario_roles ur
       INNER JOIN roles r ON r.id = ur.rol_id
       WHERE ur.usuario_id = $1
       ORDER BY ur.id ASC`,
      [user.id]
    );

    if (rolesResult.rows.length === 0) {
      return res.status(403).json({
        message: "El usuario no tiene un rol asignado. Contacte al administrador del sistema.",
      });
    }

    const primaryRole = rolesResult.rows[0];
    const roles = rolesResult.rows.map((role) => ({ id: role.id, nombre: role.nombre }));

    return res.json({
      id: user.id,
      nombre_usuario: user.nombre_usuario,
      usuario: user.nombre_usuario,
      rol_id: primaryRole.id,
      rol_nombre: primaryRole.nombre,
      roles,
      token: "fake-jwt-token",
    });
  } catch (error) {
    console.error("Error en loginUser:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
};
