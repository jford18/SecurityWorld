import pool from "../db.js";

/**
 * Obtiene todos los menús asociados a un rol específico.
 * @param {number} roleId Identificador del rol asignado al usuario autenticado.
 */
export const getMenusByRole = async (roleId) => {
  const query = `
    SELECT m.id, m.nombre, m.icono, m.ruta
    FROM public.menus m
    INNER JOIN public.rol_menu rm ON rm.menu_id = m.id
    WHERE rm.rol_id = $1 AND rm.activo = true
    ORDER BY m.id;
  `;

  // Nota: Si en el futuro se agrega un campo id_padre a public.menus,
  // se podría construir aquí la jerarquía padre → hijos antes de devolver los datos.

  const { rows } = await pool.query(query, [roleId]);
  return rows;
};

export default {
  getMenusByRole,
};
