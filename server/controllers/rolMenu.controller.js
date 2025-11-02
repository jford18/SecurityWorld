import pool from "../db.js";

const normalizeBoolean = (value, defaultValue = false) => {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const trimmed = value.trim().toLowerCase();
    if (trimmed === "true") {
      return true;
    }
    if (trimmed === "false") {
      return false;
    }
  }

  if (value === undefined || value === null) {
    return defaultValue;
  }

  return Boolean(value);
};

export const getMenusByRol = async (req, res) => {
  const { rol_id: rolIdParam } = req.params;
  const rolId = Number(rolIdParam);

  if (!Number.isInteger(rolId) || rolId <= 0) {
    return res.status(400).json({ message: "Identificador de rol inválido" });
  }

  try {
    const roleResult = await pool.query("SELECT id FROM roles WHERE id = $1", [rolId]);

    if (roleResult.rowCount === 0) {
      return res.status(404).json({ message: "El rol especificado no existe" });
    }

    const { rows } = await pool.query(
      `SELECT
         m.id AS menu_id,
         m.nombre,
         m.seccion,
         COALESCE(rm.activo, false) AS activo
       FROM menus m
       LEFT JOIN rol_menu rm
         ON rm.menu_id = m.id AND rm.rol_id = $1
       ORDER BY m.seccion NULLS LAST, m.orden ASC NULLS LAST, m.nombre ASC`,
      [rolId]
    );

    const normalizedMenus = rows.map((row) => ({
      menu_id: row.menu_id,
      nombre: row.nombre,
      seccion: row.seccion,
      activo: Boolean(row.activo),
    }));

    return res.status(200).json(normalizedMenus);
  } catch (error) {
    console.error("Error al obtener menús por rol", error);
    return res.status(500).json({ message: "Error al obtener los menús del rol" });
  }
};

export const saveRolMenus = async (req, res) => {
  const { rol_id: rolIdParam, menus } = req.body || {};
  const rolId = Number(rolIdParam);

  if (!Number.isInteger(rolId) || rolId <= 0) {
    return res.status(400).json({ message: "Identificador de rol inválido" });
  }

  if (!Array.isArray(menus)) {
    return res.status(400).json({ message: "La lista de menús es obligatoria" });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const roleResult = await client.query("SELECT id FROM roles WHERE id = $1 FOR SHARE", [rolId]);

    if (roleResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "El rol especificado no existe" });
    }

    const menuIds = menus
      .map((menu) => Number(menu?.menu_id))
      .filter((menuId) => Number.isInteger(menuId) && menuId > 0);

    if (menus.length > 0 && menuIds.length !== menus.length) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "Existen menús con identificadores inválidos" });
    }

    if (menuIds.length > 0) {
      const { rows: existingMenus } = await client.query(
        "SELECT id FROM menus WHERE id = ANY($1::int[])",
        [menuIds]
      );

      const existingMenuIds = new Set(existingMenus.map((row) => row.id));
      const missingMenus = menuIds.filter((menuId) => !existingMenuIds.has(menuId));

      if (missingMenus.length > 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "Algunos menús no existen en el sistema" });
      }
    }

    for (const menu of menus) {
      const menuId = Number(menu.menu_id);
      const activo = normalizeBoolean(menu.activo, false);

      await client.query(
        `INSERT INTO rol_menu (rol_id, menu_id, activo, fecha_creacion)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (rol_id, menu_id)
         DO UPDATE SET activo = EXCLUDED.activo`,
        [rolId, menuId, activo]
      );
    }

    await client.query("COMMIT");

    return res.status(200).json({ message: "Cambios guardados correctamente" });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error al guardar los menús del rol", error);
    return res.status(500).json({ message: "Error al guardar los menús del rol" });
  } finally {
    client.release();
  }
};
