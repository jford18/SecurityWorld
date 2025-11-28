import db from "./db.js";

export const getMenus = async (req, res) => {
  try {
    const usuario_id = req.user?.usuario_id || req.query.usuario_id;
    const rol_id = req.user?.rol_id || req.query.rol_id || req.query.role_id;

    if (!usuario_id) {
      console.warn("[MENUS] Solicitud sin usuario_id válido", {
        headers: req.headers,
        query: req.query,
      });
      return res.status(400).json({ message: "usuario_id es requerido" });
    }

    const params = [usuario_id];
    let roleCondition = "";

    if (rol_id) {
      roleCondition = " AND RM.rol_id = $2";
      params.push(rol_id);
    }

    const query = `
      SELECT M.id, M.nombre, M.icono, M.ruta, M.seccion, M.orden
      FROM public.menus M
      INNER JOIN public.rol_menu RM ON RM.menu_id = M.id
      INNER JOIN public.usuario_roles UR ON UR.rol_id = RM.rol_id
      WHERE UR.usuario_id = $1
        AND RM.activo = TRUE
        AND M.activo = TRUE
        ${roleCondition}
      ORDER BY COALESCE(M.seccion, ''), M.orden, M.id;
    `;

    const result = await db.query(query, params);

    res.json(result.rows);
  } catch (error) {
    console.error("Error en getMenus:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
};
