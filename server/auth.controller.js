import jwt from "jsonwebtoken";
import db from "./db.js";

const parseNumeric = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const extractClientIp = (req) => {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim() !== "") {
    return forwarded.split(",")[0].trim();
  }
  return typeof req.ip === "string" ? req.ip : null;
};

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
        .json({ message: "Credenciales inválidas" });
    }

    const user = userResult.rows[0];

    if (!user.activo || user.contrasena !== contrasena) {
      return res
        .status(401)
        .json({ message: "Credenciales inválidas" });
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

    const consolaCandidates = [
      req.body?.consola_id,
      req.body?.consolaId,
      req.headers["x-consola-id"],
      req.headers["x-consolaid"],
    ];
    const consolaId = consolaCandidates
      .map(parseNumeric)
      .find((value) => value !== null && value > 0);

    const ipOrigen = extractClientIp(req);
    const userAgent = typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : null;

    try {
      await db.query(
        `INSERT INTO LOG_USUARIO_LOGIN (usuario_id, consola_id, fecha_logeo, ip_origen, user_agent)
         VALUES ($1, $2, NOW(), $3, $4)`,
        [user.id, consolaId ?? null, ipOrigen, userAgent]
      );
    } catch (logError) {
      console.error("[AUTH] No se pudo registrar el logeo de usuario", logError);
    }

    return res.status(200).json({
      usuario_id: user.id,
      nombre_usuario: user.nombre_usuario,
      rol_id: primaryRole.rol_id,
      rol_nombre: primaryRole.rol_nombre,
      token,
      requirePasswordChange: Boolean(user.debe_cambiar_clave),
    });
  } catch (error) {
    console.error("Error en loginUser:", error);
    return res.status(500).json({ message: "Error al iniciar sesión" });
  }
};

export const registrarLogeo = async (req, res) => {
  try {
    const usuarioId = req.user?.usuario_id;
    const { CONSOLA_ID, consola_id, consolaId } = req.body ?? {};

    if (!usuarioId) {
      return res.status(401).json({ message: "Usuario no autenticado" });
    }

    const consolaIdValue = [consola_id, CONSOLA_ID, consolaId]
      .map(parseNumeric)
      .find((value) => value !== null && value > 0);

    if (!consolaIdValue) {
      return res.status(400).json({ message: "CONSOLA_ID es obligatorio" });
    }

    const ipOrigen = extractClientIp(req);
    const userAgent = typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : null;

    await db.query(
      `INSERT INTO LOG_USUARIO_LOGIN (usuario_id, consola_id, fecha_logeo, ip_origen, user_agent)
       VALUES ($1, $2, NOW(), $3, $4)`,
      [usuarioId, consolaIdValue, ipOrigen, userAgent]
    );

    return res.json({ success: true });
  } catch (error) {
    console.error("Error al registrar logeo", error);
    return res.status(500).json({ message: "Error interno del servidor" });
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
