import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { pool } from "../db.js";
import Joi from "joi";

const loginSchema = Joi.object({
  nombre_usuario: Joi.string().trim().min(3).required(),
  contrasena_plana: Joi.string().min(3).required(),
});

const JWT_SECRET = process.env.JWT_SECRET || "";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "8h";

export async function login(req, res) {
  try {
    const { value, error } = loginSchema.validate(req.body || {});
    if (error) {
      return res.status(422).json({
        message: "Datos inválidos",
        details: error.details.map((detail) => detail.message),
      });
    }
    const { nombre_usuario, contrasena_plana } = value;

    const userResult = await pool.query(
      `SELECT id, nombre_usuario, contrasena 
         FROM usuarios 
        WHERE nombre_usuario = $1`,
      [nombre_usuario]
    );

    if (userResult.rowCount === 0) {
      return res.status(401).json({ message: "Usuario o contraseña incorrectos" });
    }

    const user = userResult.rows[0];

    const passwordMatches = await bcrypt.compare(
      contrasena_plana,
      user.contrasena || ""
    );
    if (!passwordMatches) {
      return res.status(401).json({ message: "Usuario o contraseña incorrectos" });
    }

    const rolesResult = await pool.query(
      `SELECT r.nombre 
         FROM usuario_roles ur 
         JOIN roles r ON r.id = ur.rol_id
        WHERE ur.usuario_id = $1
        ORDER BY r.nombre ASC`,
      [user.id]
    );
    const roles = rolesResult.rows.map((row) => row.nombre);

    const consolesResult = await pool.query(
      `SELECT c.id, c.nombre
         FROM usuario_consolas uc
         JOIN consolas c ON c.id = uc.consola_id
        WHERE uc.usuario_id = $1
        ORDER BY c.nombre ASC`,
      [user.id]
    );
    const consolas = consolesResult.rows;

    if (!JWT_SECRET) {
      console.warn(
        "JWT_SECRET no está definido. El token no será firmado de manera segura."
      );
    }

    const token = jwt.sign(
      { sub: user.id, usr: user.nombre_usuario, roles },
      JWT_SECRET || "insecure-dev-secret",
      { expiresIn: JWT_EXPIRES_IN }
    );

    return res.status(200).json({
      message: "Login exitoso",
      token,
      usuario: {
        id: user.id,
        nombre_usuario: user.nombre_usuario,
        roles,
      },
      consolas,
    });
  } catch (err) {
    console.error("Auth.login error:", err?.stack || err);
    return res.status(500).json({ message: "Error interno del servidor" });
  }
}
