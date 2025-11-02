import pool from "../db.js";

/**
 * Construye la jerarquía padre → hijos para el conjunto de menús que recibe.
 * @param {Array<{id:number,nombre:string,icono:string|null,ruta:string|null,id_padre:number|null}>} menus
 * @returns {Array} Menús jerarquizados.
 */
export const buildMenuTree = (menus) => {
  const nodes = new Map();
  const rootIds = new Set();

  menus.forEach((menu) => {
    nodes.set(menu.id, {
      id: menu.id,
      nombre: menu.nombre,
      icono: menu.icono,
      ruta: menu.ruta,
      hijos: [],
    });
    rootIds.add(menu.id);
  });

  menus.forEach((menu) => {
    if (menu.id_padre && nodes.has(menu.id_padre)) {
      const parent = nodes.get(menu.id_padre);
      const child = nodes.get(menu.id);
      if (parent && child && parent.id !== child.id) {
        parent.hijos.push(child);
        rootIds.delete(child.id);
      }
    }
  });

  const orderedRoots = menus
    .map((menu) => nodes.get(menu.id))
    .filter((node) => node && rootIds.has(node.id));

  const sortChildren = (items) => {
    items.forEach((item) => {
      if (item.hijos.length > 0) {
        item.hijos.sort((a, b) => a.id - b.id);
        sortChildren(item.hijos);
      }
    });
  };

  sortChildren(orderedRoots);

  return orderedRoots;
};

/**
 * Obtiene todos los menús asociados a un rol específico y construye la jerarquía padre → hijos.
 * @param {number} roleId Identificador del rol asignado al usuario autenticado.
 */
export const getMenusByRoleId = async (roleId) => {
  const query = `
    SELECT m.id, m.nombre, m.icono, m.ruta, m.id_padre
    FROM menus m
    INNER JOIN roles_menus rm ON rm.menu_id = m.id
    WHERE rm.rol_id = $1
    ORDER BY COALESCE(m.id_padre, m.id), m.id
  `;

  const { rows } = await pool.query(query, [roleId]);
  return buildMenuTree(rows);
};

export default {
  getMenusByRoleId,
  buildMenuTree,
};
