import db from "../db.js";

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
  const { rol_id: rolId } = req.params;
  console.log(`[API] GET /api/rol-menu/${rolId} — manejado correctamente`);

  try {
    const query = `
      SELECT
          M.ID,
          M.NOMBRE,
          M.ICONO,
          M.RUTA,
          M.SECCION,
          M.ORDEN,
          M.ACTIVO AS MENU_ACTIVO,
          CASE WHEN RM.MENU_ID IS NOT NULL THEN TRUE ELSE FALSE END AS ASIGNADO
      FROM PUBLIC.MENUS M
      LEFT JOIN PUBLIC.ROL_MENU RM ON (RM.MENU_ID = M.ID AND RM.ROL_ID = $1)
      ORDER BY COALESCE(M.SECCION, ''), M.ORDEN, M.ID;
    `;

    const result = await db.query(query, [rolId]);
    res.status(200).json(result.rows);
  } catch (error) {
    console.error("[API][ERROR] /api/rol-menu:", error.message);
    res.status(500).json({ error: "Error al obtener todos los menús." });
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

  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const roleResult = await client.query("SELECT id FROM roles WHERE id = $1 FOR SHARE", [
      rolId,
    ]);

    if (roleResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "El rol especificado no existe" });
    }

    const menuIds = menus
      .map((menu) => Number(menu?.menu_id))
      .filter((menuId) => Number.isInteger(menuId) && menuId > 0);

    if (menus.length > 0 && menuIds.length !== menus.length) {
      await client.query("ROLLBACK");
      return res
        .status(400)
        .json({ message: "Existen menús con identificadores inválidos" });
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
        return res
          .status(400)
          .json({ message: "Algunos menús no existen en el sistema" });
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
