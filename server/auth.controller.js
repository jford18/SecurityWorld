import db from "./db.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

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
       FROM public.usuarios
       WHERE nombre_usuario = $1`,
      [nombre_usuario]
    );

    if (userResult.rows.length === 0) {
      return res
        .status(401)
        .json({ message: "Usuario o contraseña incorrectos" });
    }

    const user = userResult.rows[0];

    if (!user.activo) {
      return res
        .status(401)
        .json({ message: "Usuario o contraseña incorrectos" });
    }

    if (!user.hash_contrasena) {
      return res
        .status(401)
        .json({ message: "Usuario o contraseña incorrectos" });
    }

    const isPasswordValid = await bcrypt.compare(
      contrasena_plana,
      user.hash_contrasena
    );

    if (!isPasswordValid) {
      return res
        .status(401)
        .json({ message: "Usuario o contraseña incorrectos" });
    }

    

    const rolesResult = await db.query(
      `SELECT r.id AS rol_id, r.nombre AS rol_nombre
       FROM public.usuario_roles ur
       INNER JOIN public.roles r ON r.id = ur.rol_id
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

    const roles = rolesResult.rows.map((row) => ({
      id: row.rol_id,
      nombre: row.rol_nombre,
    }));

    const consolasResult = await db.query(
      `SELECT c.id, c.nombre
       FROM public.usuario_consolas uc
       INNER JOIN public.consolas c ON c.id = uc.consola_id
       WHERE uc.usuario_id = $1
       ORDER BY c.nombre ASC`,
      [user.id]
    );

    const consolas = consolasResult.rows.map((row) => ({
      id: row.id,
      nombre: row.nombre,
    }));

    const tokenPayload = {
      usuario_id: user.id,
      nombre_usuario: user.nombre_usuario,
      roles: roles.map((rol) => rol.id),
    };

    const token = jwt.sign(tokenPayload, process.env.JWT_SECRET || "default_secret", {
      expiresIn: "8h",
    });

    return res.json({
      token,
      usuarioId: user.id,
      nombre_usuario: user.nombre_usuario,
      roles,
      consolas,
    });
  } catch (error) {
    console.error("Error en loginUser:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
};
