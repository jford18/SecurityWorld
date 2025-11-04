import pool from "../db.js";

/**
 * Obtiene todos los menús asociados a un rol específico.
 * @param {number} roleId Identificador del rol asignado al usuario autenticado.
 */
export const getMenusByRole = async (roleId) => {
  const query = `
    SELECT m.id, m.nombre, m.icono, m.ruta, m.seccion, m.orden
    FROM public.menus m
    INNER JOIN public.rol_menu rm ON rm.menu_id = m.id
    WHERE rm.rol_id = $1 AND rm.activo = true
    ORDER BY m.seccion, m.orden;
  `;

  const { rows } = await pool.query(query, [roleId]);
  return rows;
};

export default {
  getMenusByRole,
};
