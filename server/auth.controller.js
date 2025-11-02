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

    const coincidePassword = await bcrypt.compare(
      contrasena_plana,
      usuario.hash_contrasena
    );

    if (!coincidePassword) {
      return res.status(401).json({ mensaje: "Credenciales inválidas." });
    }

    const rolesQuery = `
      SELECT r.id, r.nombre AS rol
      FROM usuario_roles ur
      INNER JOIN roles r ON r.id = ur.rol_id
      WHERE ur.usuario_id = $1
      ORDER BY r.nombre
    `;

    const rolesResult = await pool.query(rolesQuery, [usuario.id]);
    const rolesDetalle = rolesResult.rows.map((row) => ({
      id: row.id,
      nombre: row.rol,
    }));
    const roles = rolesDetalle.map((rol) => rol.nombre);

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
        roles_detalle: rolesDetalle,
      },
    });
  } catch (error) {
    console.error("Error durante el inicio de sesión:", error);
    return res
      .status(500)
      .json({ mensaje: "Ocurrió un error al procesar la solicitud." });
  }
}

export async function getUserConsoles(req, res) {
  const { usuario_id } = req.params;

  if (!usuario_id) {
    return res.status(400).json({ mensaje: "El usuario es requerido." });
  }

  try {
    const consolesQuery = `
      SELECT c.nombre
      FROM usuario_consolas uc
      INNER JOIN consolas c ON c.id = uc.consola_id
      WHERE uc.usuario_id = $1
      ORDER BY c.nombre
    `;

    const { rows } = await pool.query(consolesQuery, [usuario_id]);
    const consolas = rows.map((row) => row.nombre);

    return res.status(200).json({ consolas });
  } catch (error) {
    console.error("Error al obtener las consolas del usuario:", error);
    return res
      .status(500)
      .json({ mensaje: "Ocurrió un error al obtener las consolas del usuario." });
  }
}

export async function getMenusByRol(req, res) {
  const { rol_id: rolIdParam } = req.params;
  const rolId = Number(rolIdParam);

  if (!Number.isInteger(rolId) || rolId <= 0) {
    return res.status(400).json({
      mensaje: "El identificador de rol proporcionado no es válido.",
    });
  }

  try {
    const query = `
      SELECT m.id, m.nombre, m.icono, m.ruta, m.seccion, m.orden
      FROM menus m
      INNER JOIN rol_menu rm ON rm.menu_id = m.id
      WHERE rm.rol_id = $1
        AND rm.activo = TRUE
        AND m.estado = TRUE
      ORDER BY m.orden
    `;

    const { rows } = await pool.query(query, [rolId]);
    return res.status(200).json(rows);
  } catch (error) {
    console.error("Error al obtener los menús del rol:", error);
    return res.status(500).json({
      mensaje: "Ocurrió un error al obtener los menús permitidos para el rol.",
    });
  }
}

