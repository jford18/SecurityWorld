import bcrypt from "bcrypt";
import pool from "../db.js";

// NEW: Controlador para obtener la lista de usuarios.
export const getUsuarios = async (_req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT id, nombre_usuario, nombre_completo, activo, fecha_creacion FROM usuarios ORDER BY id"
    );

    return res.json(rows);
  } catch (error) {
    console.error("Error al obtener usuarios", error); // FIX: Registro del error para diagnóstico.
    return res.status(500).json({ message: "Error interno del servidor" });
  }
};

// NEW: Controlador para crear un usuario con validaciones y hash de contraseña.
export const createUsuario = async (req, res) => {
  const { nombre_usuario, contrasena_plana, nombre_completo } = req.body ?? {};

  if (!nombre_usuario || !contrasena_plana) {
    // FIX: Validación estricta para evitar registros con datos incompletos.
    return res.status(422).json({ message: "Validación fallida" });
  }

  try {
    const hashedPassword = await bcrypt.hash(contrasena_plana, 10);

    const insertQuery =
      "INSERT INTO usuarios (nombre_usuario, hash_contrasena, nombre_completo) VALUES ($1, $2, $3) RETURNING id, nombre_usuario, nombre_completo, activo, fecha_creacion";
    const values = [nombre_usuario, hashedPassword, nombre_completo ?? null];

    const { rows } = await pool.query(insertQuery, values);

    return res.status(201).json({ message: "Usuario creado", data: rows[0] });
  } catch (error) {
    if (error?.code === "23505") {
      // FIX: Manejo específico para duplicados según la restricción UNIQUE.
      return res.status(409).json({ message: "Usuario ya existe" });
    }

    console.error("Error al crear usuario", error);
    return res.status(500).json({ message: "Error interno del servidor" });
  }
};

// NEW: Controlador para actualizar el nombre y estado de un usuario existente.
export const updateUsuario = async (req, res) => {
  const { id } = req.params;
  let { nombre_completo, activo } = req.body ?? {};

  if (typeof nombre_completo === "undefined" || typeof activo === "undefined") {
    // FIX: Validamos que ambos campos se proporcionen para evitar actualizaciones parciales inesperadas.
    return res.status(422).json({ message: "Validación fallida" });
  }

  if (typeof activo !== "boolean") {
    // FIX: Convertimos valores string "true"/"false" a booleanos reales para evitar errores de tipos.
    if (activo === "true") {
      activo = true;
    } else if (activo === "false") {
      activo = false;
    } else {
      return res.status(422).json({ message: "Validación fallida" });
    }
  }

  try {
    const updateQuery =
      "UPDATE usuarios SET nombre_completo = $1, activo = $2 WHERE id = $3 RETURNING id, nombre_usuario, nombre_completo, activo, fecha_creacion";
    const values = [nombre_completo ?? null, activo, id];

    const { rows } = await pool.query(updateQuery, values);

    if (rows.length === 0) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    return res.json({ message: "Usuario actualizado", data: rows[0] });
  } catch (error) {
    console.error("Error al actualizar usuario", error); // FIX: Log detallado para soporte.
    return res.status(500).json({ message: "Error interno del servidor" });
  }
};

// NEW: Controlador para eliminar un usuario existente.
export const deleteUsuario = async (req, res) => {
  const { id } = req.params;

  try {
    const deleteQuery = "DELETE FROM usuarios WHERE id = $1 RETURNING id";
    const { rows } = await pool.query(deleteQuery, [id]);

    if (rows.length === 0) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    return res.json({ message: "Usuario eliminado" });
  } catch (error) {
    console.error("Error al eliminar usuario", error); // FIX: Registro de error para auditoría.
    return res.status(500).json({ message: "Error interno del servidor" });
  }
};
