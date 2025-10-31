import pool from "../db.js";

// NEW: Utilidad interna para transformar el recordset en una estructura agrupada por usuario.
const mapAssignmentsByUser = (rows) => {
  const grouped = new Map();

  rows.forEach((row) => {
    const existing = grouped.get(row.usuario_id) ?? {
      usuario_id: row.usuario_id,
      nombre_usuario: row.nombre_usuario,
      roles: [],
    };

    if (row.rol_id) {
      existing.roles.push({
        id: row.rol_id,
        nombre: row.rol_nombre,
      });
    }

    grouped.set(row.usuario_id, existing);
  });

  return Array.from(grouped.values());
};

// NEW: Obtiene todos los usuarios con los roles que tienen asignados ordenados por usuario y rol.
export const getUsuarioRoles = async (_req, res) => {
  try {
    const query = `
      SELECT
        u.id AS usuario_id,
        u.nombre_usuario,
        r.id AS rol_id,
        r.nombre AS rol_nombre
      FROM usuarios u
      LEFT JOIN usuario_roles ur ON ur.usuario_id = u.id
      LEFT JOIN roles r ON r.id = ur.rol_id
      ORDER BY u.id ASC, r.id ASC
    `;
    const { rows } = await pool.query(query);

    return res.json(mapAssignmentsByUser(rows));
  } catch (error) {
    console.error("Error en usuario_roles:", error); // FIX: Registro uniforme para diagnósticos del módulo.
    return res.status(500).json({ message: "Error interno del servidor" });
  }
};

// NEW: Obtiene los roles asociados a un usuario específico con validaciones de existencia.
export const getUsuarioRolesByUsuario = async (req, res) => {
  const { usuario_id: usuarioIdParam } = req.params;
  const usuarioId = Number(usuarioIdParam);

  if (!Number.isInteger(usuarioId)) {
    return res.status(422).json({ message: "Datos incompletos" });
  }

  try {
    const { rowCount: userExists } = await pool.query("SELECT 1 FROM usuarios WHERE id = $1", [usuarioId]);

    if (!userExists) {
      return res.status(404).json({ message: "Usuario o rol no encontrado" });
    }

    const { rows } = await pool.query(
      `
        SELECT r.id AS rol_id, r.nombre
        FROM usuario_roles ur
        JOIN roles r ON r.id = ur.rol_id
        WHERE ur.usuario_id = $1
        ORDER BY r.id ASC
      `,
      [usuarioId]
    );

    return res.json(rows);
  } catch (error) {
    console.error("Error en usuario_roles:", error); // FIX: Manejo consistente de errores no controlados.
    return res.status(500).json({ message: "Error interno del servidor" });
  }
};

// NEW: Asigna un rol a un usuario utilizando transacciones para asegurar consistencia.
export const asignarRolAUsuario = async (req, res) => {
  const { usuario_id: usuarioIdRaw, rol_id: rolIdRaw } = req.body ?? {};
  const usuarioId = Number(usuarioIdRaw);
  const rolId = Number(rolIdRaw);

  if (!Number.isInteger(usuarioId) || !Number.isInteger(rolId)) {
    return res.status(422).json({ message: "Datos incompletos" });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const { rowCount: userExists } = await client.query("SELECT 1 FROM usuarios WHERE id = $1", [usuarioId]);
    const { rowCount: roleExists } = await client.query("SELECT 1 FROM roles WHERE id = $1", [rolId]);

    if (!userExists || !roleExists) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Usuario o rol no encontrado" });
    }

    const { rowCount: alreadyAssigned } = await client.query(
      "SELECT 1 FROM usuario_roles WHERE usuario_id = $1 AND rol_id = $2",
      [usuarioId, rolId]
    );

    if (alreadyAssigned) {
      await client.query("ROLLBACK");
      return res.status(409).json({ message: "El usuario ya tiene asignado ese rol" });
    }

    await client.query(
      "INSERT INTO usuario_roles (usuario_id, rol_id) VALUES ($1, $2)",
      [usuarioId, rolId]
    );

    await client.query("COMMIT");
    return res.status(201).json({
      message: "Rol asignado correctamente",
      data: { usuario_id: usuarioId, rol_id: rolId },
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error en usuario_roles:", error); // FIX: Logueo centralizado para depuración.
    return res.status(500).json({ message: "Error interno del servidor" });
  } finally {
    client.release();
  }
};

// NEW: Elimina un rol asignado a un usuario con verificación previa de existencia.
export const eliminarRolDeUsuario = async (req, res) => {
  const { usuario_id: usuarioIdParam, rol_id: rolIdParam } = req.params;
  const usuarioId = Number(usuarioIdParam);
  const rolId = Number(rolIdParam);

  if (!Number.isInteger(usuarioId) || !Number.isInteger(rolId)) {
    return res.status(422).json({ message: "Datos incompletos" });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const { rowCount: userExists } = await client.query("SELECT 1 FROM usuarios WHERE id = $1", [usuarioId]);
    const { rowCount: roleExists } = await client.query("SELECT 1 FROM roles WHERE id = $1", [rolId]);

    if (!userExists || !roleExists) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Usuario o rol no encontrado" });
    }

    const { rowCount: assignmentExists } = await client.query(
      "SELECT 1 FROM usuario_roles WHERE usuario_id = $1 AND rol_id = $2",
      [usuarioId, rolId]
    );

    if (!assignmentExists) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Asignación no encontrada" });
    }

    await client.query("DELETE FROM usuario_roles WHERE usuario_id = $1 AND rol_id = $2", [usuarioId, rolId]);

    await client.query("COMMIT");
    return res.json({ message: "Rol eliminado correctamente" });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error en usuario_roles:", error); // FIX: Mensaje uniforme para fallos inesperados.
    return res.status(500).json({ message: "Error interno del servidor" });
  } finally {
    client.release();
  }
};
