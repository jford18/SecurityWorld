// NEW: Controlador para las operaciones CRUD del catálogo de roles.
import pool from "./db.js";

// NEW: Obtiene la lista completa de roles junto con el número de usuarios asociados.
export const getRoles = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT r.id, r.nombre, r.fecha_creacion, COUNT(ur.usuario_id)::INT AS usuarios_asignados
       FROM roles r
       LEFT JOIN usuario_roles ur ON ur.rol_id = r.id
       GROUP BY r.id
       ORDER BY r.nombre ASC`
    );

    res.json(rows);
  } catch (error) {
    console.error("Error al obtener los roles", error);
    res.status(500).json({ message: "Error al obtener los roles" });
  }
};

// NEW: Valida y crea un nuevo rol en la base de datos.
export const createRole = async (req, res) => {
  const { nombre } = req.body;

  if (!nombre || !nombre.trim()) {
    return res.status(400).json({ message: "El nombre del rol es obligatorio" });
  }

  const trimmedName = nombre.trim();

  try {
    const duplicateResult = await pool.query(
      "SELECT COUNT(*)::INT AS total FROM roles WHERE LOWER(nombre) = LOWER($1)",
      [trimmedName]
    );

    if (duplicateResult.rows[0].total > 0) {
      return res.status(409).json({ message: "Ya existe un rol con ese nombre" });
    }

    const insertResult = await pool.query(
      "INSERT INTO roles (nombre) VALUES ($1) RETURNING id, nombre, fecha_creacion",
      [trimmedName]
    );

    res.status(201).json(insertResult.rows[0]);
  } catch (error) {
    console.error("Error al crear el rol", error);
    res.status(500).json({ message: "Error al crear el rol" });
  }
};

// NEW: Actualiza el nombre de un rol existente.
export const updateRole = async (req, res) => {
  const { id } = req.params;
  const { nombre } = req.body;

  if (!nombre || !nombre.trim()) {
    return res.status(400).json({ message: "El nombre del rol es obligatorio" });
  }

  const trimmedName = nombre.trim();

  try {
    const roleResult = await pool.query("SELECT id FROM roles WHERE id = $1", [id]);

    if (roleResult.rowCount === 0) {
      return res.status(404).json({ message: "El rol indicado no existe" });
    }

    const duplicateResult = await pool.query(
      "SELECT COUNT(*)::INT AS total FROM roles WHERE LOWER(nombre) = LOWER($1) AND id <> $2",
      [trimmedName, id]
    );

    if (duplicateResult.rows[0].total > 0) {
      return res.status(409).json({ message: "Ya existe un rol con ese nombre" });
    }

    const updateResult = await pool.query(
      "UPDATE roles SET nombre = $1 WHERE id = $2 RETURNING id, nombre, fecha_creacion",
      [trimmedName, id]
    );

    res.json(updateResult.rows[0]);
  } catch (error) {
    console.error("Error al actualizar el rol", error);
    res.status(500).json({ message: "Error al actualizar el rol" });
  }
};

// NEW: Elimina un rol si no tiene usuarios asociados.
export const deleteRole = async (req, res) => {
  const { id } = req.params;

  try {
    const usageResult = await pool.query(
      "SELECT COUNT(*)::INT AS total FROM usuario_roles WHERE rol_id = $1",
      [id]
    );

    if (usageResult.rows[0].total > 0) {
      return res
        .status(400)
        .json({ message: "No se puede eliminar el rol porque tiene usuarios asociados" });
    }

    const deleteResult = await pool.query("DELETE FROM roles WHERE id = $1", [id]);

    if (deleteResult.rowCount === 0) {
      return res.status(404).json({ message: "El rol indicado no existe" });
    }

    res.json({ message: "Rol eliminado correctamente" });
  } catch (error) {
    console.error("Error al eliminar el rol", error);
    res.status(500).json({ message: "Error al eliminar el rol" });
  }
};
