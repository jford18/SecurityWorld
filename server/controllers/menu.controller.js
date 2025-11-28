import pool from "../db.js";

const normalizeBoolean = (value, defaultValue = true) => {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") {
      return true;
    }
    if (normalized === "false") {
      return false;
    }
  }
  if (value === undefined || value === null) {
    return defaultValue;
  }
  return Boolean(value);
};

const formatError = (message) => ({
  status: "error",
  message,
});

const formatSuccess = (message, data = null) => ({
  status: "success",
  message,
  data,
});

const parseOptionalNumber = (value) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

export const getMenus = async (req, res) => {
  try {
    const usuarioId = parseOptionalNumber(req.user?.usuario_id ?? req.query?.usuario_id);
    const rolId = parseOptionalNumber(req.user?.rol_id ?? req.query?.rol_id);

    if (usuarioId !== null || rolId !== null) {
      const query = `
        SELECT M.id, M.nombre, M.icono, M.ruta, M.seccion, M.orden, M.activo, M.fecha_creacion
        FROM public.menus M
        LEFT JOIN public.rol_menu RM ON RM.menu_id = M.id AND RM.activo = true
        LEFT JOIN public.usuario_roles UR ON UR.rol_id = RM.rol_id
        WHERE M.activo = true
          AND ($1::INT IS NULL OR UR.usuario_id = $1)
          AND ($2::INT IS NULL OR RM.rol_id = $2)
        GROUP BY M.id
        ORDER BY COALESCE(M.seccion, ''), M.orden NULLS LAST, M.id;
      `;

      const result = await pool.query(query, [usuarioId, rolId]);
      return res
        .status(200)
        .json(formatSuccess("Listado de menús filtrado por usuario/rol", result.rows));
    }

    const result = await pool.query(
      `SELECT id, nombre, icono, ruta, seccion, orden, activo, fecha_creacion
       FROM public.menus
       ORDER BY COALESCE(seccion, ''), orden NULLS LAST, id`
    );

    res.status(200).json(formatSuccess("Listado de menús", result.rows));
  } catch (error) {
    console.error("Error en menú:", error);
    res.status(500).json(formatError("Error interno del servidor"));
  }
};

export const getMenuById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT id, nombre, icono, ruta, seccion, orden, activo, fecha_creacion
       FROM public.menus
       WHERE id = $1`,
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json(formatError("Menú no encontrado"));
    }

    res
      .status(200)
      .json(formatSuccess("Menú obtenido correctamente", result.rows[0]));
  } catch (error) {
    console.error("Error en menú:", error);
    res.status(500).json(formatError("Error interno del servidor"));
  }
};

export const createMenu = async (req, res) => {
  try {
    const { nombre, icono, ruta, seccion, orden, activo } = req.body || {};

    if (!nombre?.trim() || !ruta?.trim()) {
      return res.status(422).json({ message: "Nombre y ruta son obligatorios" });
    }

    const normalizedNombre = nombre.trim();

    const duplicate = await pool.query(
      "SELECT id FROM public.menus WHERE LOWER(nombre) = LOWER($1)",
      [normalizedNombre]
    );

    if (duplicate.rowCount > 0) {
      return res.status(409).json({ message: "El menú ya existe" });
    }

    const ordenValue =
      orden === undefined ||
      orden === null ||
      (typeof orden === "string" && orden.trim() === "") ||
      Number.isNaN(Number(orden))
        ? null
        : Number(orden);

    const activoValue = normalizeBoolean(activo, true);

    const result = await pool.query(
      `INSERT INTO public.menus (nombre, icono, ruta, seccion, orden, activo)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, nombre, icono, ruta, seccion, orden, activo`,
      [
        normalizedNombre,
        typeof icono === "string" && icono.trim() ? icono.trim() : null,
        ruta.trim(),
        typeof seccion === "string" && seccion.trim() ? seccion.trim() : null,
        ordenValue,
        activoValue,
      ]
    );

    res.status(201).json(formatSuccess("Menú creado correctamente", result.rows[0]));
  } catch (error) {
    console.error("Error en menú:", error);
    res.status(500).json(formatError("Error interno del servidor"));
  }
};

export const updateMenu = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, icono, ruta, seccion, orden, activo } = req.body || {};

    if (!nombre?.trim() || !ruta?.trim()) {
      return res.status(422).json({ message: "Nombre y ruta son obligatorios" });
    }

    const normalizedNombre = nombre.trim();

    const duplicate = await pool.query(
      "SELECT id FROM public.menus WHERE LOWER(nombre) = LOWER($1) AND id <> $2",
      [normalizedNombre, id]
    );

    if (duplicate.rowCount > 0) {
      return res.status(409).json({ message: "El menú ya existe" });
    }

    const ordenValue =
      orden === undefined ||
      orden === null ||
      (typeof orden === "string" && orden.trim() === "") ||
      Number.isNaN(Number(orden))
        ? null
        : Number(orden);

    const activoValue = normalizeBoolean(activo, true);

    const result = await pool.query(
      `UPDATE public.menus
       SET nombre = $1,
           icono = $2,
           ruta = $3,
           seccion = $4,
           orden = $5,
           activo = $6
       WHERE id = $7
       RETURNING id, nombre, icono, ruta, seccion, orden, activo`,
      [
        normalizedNombre,
        typeof icono === "string" && icono.trim() ? icono.trim() : null,
        ruta.trim(),
        typeof seccion === "string" && seccion.trim() ? seccion.trim() : null,
        ordenValue,
        activoValue,
        id,
      ]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Menú no encontrado" });
    }

    res.status(200).json(formatSuccess("Menú actualizado correctamente", result.rows[0]));
  } catch (error) {
    console.error("Error en menú:", error);
    res.status(500).json(formatError("Error interno del servidor"));
  }
};

export const deleteMenu = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `UPDATE public.menus
       SET activo = false
       WHERE id = $1 AND activo = true
       RETURNING id`,
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json(formatError("Menú no encontrado"));
    }

    res.status(204).send();
  } catch (error) {
    console.error("Error en menú:", error);
    res.status(500).json(formatError("Error interno del servidor"));
  }
};
