import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { pool } from "./db.js";

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

    const rolesQuery = `
      SELECT r.id, r.nombre
      FROM usuario_roles ur
      INNER JOIN roles r ON r.id = ur.rol_id
      WHERE ur.usuario_id = $1
      ORDER BY r.nombre
    `;

    const rolesResult = await pool.query(rolesQuery, [usuario.id]);
    const roles = rolesResult.rows.map((row) => ({
      id: row.id,
      nombre: row.nombre,
    }));

    if (roles.length === 0) {
      return res
        .status(403)
        .json({ mensaje: "El usuario no tiene roles asignados." });
    }

    const consolesQuery = "SELECT id, nombre FROM consolas ORDER BY nombre";
    const consolesResult = await pool.query(consolesQuery);
    const consolas = consolesResult.rows;

    if (!process.env.JWT_SECRET) {
      console.warn(
        "JWT_SECRET no está definido. El token no será firmado de manera segura."
      );
    }

    const secret = process.env.JWT_SECRET || "default_secret";
    const expiresIn = process.env.JWT_EXPIRES_IN || "1h";

    const tokensPorRol = roles.map((role) => ({
      rol_id: role.id,
      token: jwt.sign(
        {
          id: usuario.id,
          nombre_usuario: usuario.nombre_usuario,
          rol_id: role.id,
        },
        secret,
        { expiresIn }
      ),
    }));

    const rolActivo = roles[0] ?? null;
    const tokenPrincipal = tokensPorRol[0]?.token ?? null;

    return res.status(200).json({
      token: tokenPrincipal,
      tokensPorRol,
      usuario: {
        id: usuario.id,
        nombre_usuario: usuario.nombre_usuario,
        activo: usuario.activo,
        roles,
        rol_activo: rolActivo,
      },
      consolas,
    });
  } catch (error) {
    console.error("Error durante el inicio de sesión:", error);
    return res
      .status(500)
      .json({ mensaje: "Ocurrió un error al procesar la solicitud." });
  }
}


