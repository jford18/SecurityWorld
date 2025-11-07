import db from "./db.js";

const parseRoleId = (req) => {
  const fromUser = req.user && typeof req.user === "object" ? req.user.rol_id ?? req.user.role_id : null;
  const fromQuery = req.query?.rol_id ?? req.query?.role_id;
  const fromHeader = req.headers?.["x-role-id"] ?? req.headers?.["x-rol-id"];

  const rawValue = fromUser ?? fromHeader ?? fromQuery;

  if (rawValue === undefined || rawValue === null || rawValue === "") {
    return null;
  }

  const parsed = Number(rawValue);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

export const getMenus = async (req, res) => {
  try {
    const rolId = parseRoleId(req);

    if (!rolId) {
      console.warn("[MENUS] Solicitud sin rol válido. Se devolverán todos los menús activos.", {
        headers: req.headers,
        query: req.query,
      });

      const fallbackResult = await db.query(
        `SELECT id, nombre, icono, ruta, seccion, orden, activo
         FROM menus
         WHERE activo = TRUE
         ORDER BY COALESCE(id_padre, id), orden NULLS LAST, id`
      );

      console.log("[MENUS] Total menús encontrados (sin rol):", fallbackResult.rows.length);
      return res.json(fallbackResult.rows);
    }

    const result = await db.query(
      `SELECT
         m.id,
         m.nombre,
         m.icono,
         m.ruta,
         m.seccion,
         m.orden,
         m.activo
       FROM menus m
       INNER JOIN rol_menu rm ON rm.menu_id = m.id
       WHERE rm.rol_id = $1
         AND rm.activo = TRUE
         AND m.activo = TRUE
       ORDER BY COALESCE(m.id_padre, m.id), m.orden NULLS LAST, m.id`,
      [rolId]
    );

    console.log("[MENUS] rol_id:", rolId);
    console.log("[MENUS] Total menús encontrados:", result.rows.length);

    return res.json(result.rows);
  } catch (error) {
    console.error("Error en getMenus:", error);
    return res.status(500).json({ message: "Error interno del servidor" });
  }
};
