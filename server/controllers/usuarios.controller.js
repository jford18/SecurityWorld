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

// NEW: Controlador para crear un usuario sin hashing de contraseña.
export const createUsuario = async (req, res) => {
  const { nombre_usuario, contrasena, nombre_completo } = req.body ?? {};

  const trimmedUsername = nombre_usuario?.trim();
  const trimmedPassword = contrasena?.trim();

  if (!trimmedUsername || !trimmedPassword) {
    return res.status(400).json({ message: "Nombre de usuario y contraseña son obligatorios" });
  }

  try {
    const insertQuery = `
      INSERT INTO public.usuarios (nombre_usuario, contrasena, nombre_completo, activo)
      VALUES ($1, $2, $3, $4)
      RETURNING id, nombre_usuario, nombre_completo, activo, fecha_creacion;
    `;
    const values = [trimmedUsername, trimmedPassword, nombre_completo?.trim() || null, true];

    const { rows } = await pool.query(insertQuery, values);

    return res.status(201).json(rows[0]);
  } catch (error) {
    if (error?.code === "23505") {
      return res.status(409).json({ message: "Usuario ya existe" });
    }

    console.error("Error al crear usuario", error);
    return res.status(500).json({ message: "Error interno del servidor" });
  }
};

// NEW: Controlador para actualizar datos de usuario sin alterar el login.
export const updateUsuario = async (req, res) => {
  const { id } = req.params;
  let { nombre_usuario, nombre_completo, activo, contrasena } = req.body ?? {};

  const trimmedUsername = nombre_usuario?.trim();
  const trimmedPassword = contrasena?.trim();

  if (!trimmedUsername || typeof activo === "undefined") {
    return res
      .status(400)
      .json({ message: "Nombre de usuario y estado activo son obligatorios" });
  }

  if (typeof activo !== "boolean") {
    if (activo === "true") {
      activo = true;
    } else if (activo === "false") {
      activo = false;
    } else {
      return res.status(400).json({ message: "El estado activo debe ser booleano" });
    }
  }

  try {
    let updateQuery;
    let values;

    if (trimmedPassword && trimmedPassword !== "") {
      updateQuery = `
        UPDATE public.usuarios
        SET nombre_usuario     = $1,
            nombre_completo    = $2,
            activo             = $3,
            contrasena         = $4,
            debe_cambiar_clave = TRUE
        WHERE id = $5
        RETURNING id, nombre_usuario, nombre_completo, activo, fecha_creacion;
      `;
      values = [
        trimmedUsername,
        nombre_completo?.trim() || null,
        Boolean(activo),
        trimmedPassword,
        id,
      ];
    } else {
      updateQuery = `
        UPDATE public.usuarios
        SET nombre_usuario  = $1,
            nombre_completo = $2,
            activo          = $3
        WHERE id = $4
        RETURNING id, nombre_usuario, nombre_completo, activo, fecha_creacion;
      `;
      values = [trimmedUsername, nombre_completo?.trim() || null, Boolean(activo), id];
    }

    const { rows } = await pool.query(updateQuery, values);

    if (rows.length === 0) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    return res.json(rows[0]);
  } catch (error) {
    if (error?.code === "23505") {
      return res.status(409).json({ message: "Usuario ya existe" });
    }

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
