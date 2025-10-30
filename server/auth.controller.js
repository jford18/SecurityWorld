import { Pool } from "pg";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || "securityworld",
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASS || "123456",
  max: Number(process.env.DB_POOL_MAX) || 10,
  idleTimeoutMillis: Number(process.env.DB_IDLE_TIMEOUT) || 30000,
});

export async function loginUser(req, res) {
  const { nombre_usuario, contrasena_plana } = req.body || {};

  if (!nombre_usuario || !contrasena_plana) {
    return res.status(400).json({
      mensaje: "nombre_usuario y contrasena_plana son obligatorios.",
    });
  }

  try {
    const userQuery = `
      SELECT id, nombre_usuario, hash_contrasena, activo
      FROM usuarios
      WHERE nombre_usuario = $1
    `;

    const { rows, rowCount } = await pool.query(userQuery, [nombre_usuario]);

    if (!rowCount) {
      return res.status(401).json({ mensaje: "Credenciales inválidas." });
    }

    const usuario = rows[0];

    if (!usuario.activo) {
      return res.status(401).json({ mensaje: "El usuario está inactivo." });
    }

    const coincidePassword = await bcrypt.compare(
      contrasena_plana,
      usuario.hash_contrasena
    );

    

    const rolesQuery = `
      SELECT r.nombre AS rol
      FROM usuario_roles ur
      INNER JOIN roles r ON r.id = ur.rol_id
      WHERE ur.usuario_id = $1
      ORDER BY r.nombre
    `;

    const rolesResult = await pool.query(rolesQuery, [usuario.id]);
    const roles = rolesResult.rows.map((row) => row.rol);

    if (!process.env.JWT_SECRET) {
      console.warn(
        "JWT_SECRET no está definido. El token no será firmado de manera segura."
      );
    }

    const tokenPayload = {
      id: usuario.id,
      nombre_usuario: usuario.nombre_usuario,
      roles,
    };

    const token = jwt.sign(
      tokenPayload,
      process.env.JWT_SECRET || "default_secret",
      {
        expiresIn: process.env.JWT_EXPIRES_IN || "1h",
      }
    );

    return res.status(200).json({
      token,
      usuario: {
        id: usuario.id,
        nombre_usuario: usuario.nombre_usuario,
        activo: usuario.activo,
        roles,
      },
    });
  } catch (error) {
    console.error("Error durante el inicio de sesión:", error);
    return res
      .status(500)
      .json({ mensaje: "Ocurrió un error al procesar la solicitud." });
  }
}

export { pool };
