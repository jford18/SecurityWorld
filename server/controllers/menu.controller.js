import pool from "../db.js";
import { getMenusByRole as getMenusByRoleService } from "../services/menu.service.js";

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

export const getMenusByRole = async (req, res) => {
  const roleId = req.user?.rol_id;

  if (!roleId) {
    return res.status(400).json({ message: "El token no contiene un rol válido" });
  }

  try {
    const menus = await getMenusByRoleService(roleId);
    return res.status(200).json(menus);
  } catch (error) {
    console.error("Error al obtener el menú por rol:", error);
    return res
      .status(500)
      .json({ message: "Error al obtener menús", error: error.message });
  }
};

export const listMenus = async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, nombre, icono, ruta, seccion, orden, activo, fecha_creacion
       FROM menus
       ORDER BY seccion NULLS LAST, orden ASC, id ASC`
    );
    res.status(200).json(result.rows);
  } catch (error) {
    console.error("Error en menú:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
};

export const getMenuById = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT id, nombre, icono, ruta, seccion, orden, activo, fecha_creacion
       FROM menus
       WHERE id = $1`,
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Menú no encontrado" });
    }

    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error("Error en menú:", error);
    res.status(500).json({ message: "Error interno del servidor" });
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
      "SELECT id FROM menus WHERE LOWER(nombre) = LOWER($1)",
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
      `INSERT INTO menus (nombre, icono, ruta, seccion, orden, activo)
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

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Error en menú:", error);
    res.status(500).json({ message: "Error interno del servidor" });
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
      "SELECT id FROM menus WHERE LOWER(nombre) = LOWER($1) AND id <> $2",
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
      `UPDATE menus
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

    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error("Error en menú:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
};

export const deleteMenu = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `UPDATE menus
       SET activo = false
       WHERE id = $1 AND activo = true
       RETURNING id, nombre, icono, ruta, seccion, orden, activo`,
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Menú no encontrado" });
    }

    res.status(200).json({ message: "Menú desactivado correctamente" });
  } catch (error) {
    console.error("Error en menú:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
};
