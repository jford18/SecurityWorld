import { useCallback, useEffect, useState } from 'react';
import { getMenus as fetchMenusByRole } from '../services/menuService';

export interface MenuNode {
  id: number;
  nombre: string;
  icono: string | null;
  ruta: string | null;
  seccion: string;
  orden: number;
  hijos: MenuNode[];
}

const ensureArray = (value: unknown): MenuNode[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is MenuNode =>
      item !== null &&
      typeof item === 'object' &&
      typeof (item as MenuNode).id === 'number' &&
      typeof (item as MenuNode).nombre === 'string'
    )
    .map((item) => ({
      id: item.id,
      nombre: item.nombre,
      icono: 'icono' in item ? (item.icono as string | null) : null,
      ruta: 'ruta' in item ? (item.ruta as string | null) : null,
      seccion: 'seccion' in item ? (item.seccion as string) : 'SIN SECCIÓN',
      orden: 'orden' in item ? (item.orden as number) : 0,
      hijos: ensureArray((item as { hijos?: unknown }).hijos ?? []),
    }));
};

const ROUTE_SYNONYM_GROUPS: string[][] = [
  ['/fallos/supervisor', '/fallos-supervisor'],
  ['/administracion/roles-menus', '/administracion/rol-menu', '/administracion/roles-menu'],
];

const addRouteWithSynonyms = (route: string, bucket: Set<string>) => {
  bucket.add(route);
  for (const group of ROUTE_SYNONYM_GROUPS) {
    if (group.includes(route)) {
      group.forEach((synonym) => bucket.add(synonym));
      break;
    }
  }
};

export const useMenus = (token: string | null, roleId: number | null, userId: number | null) => {
  const [menus, setMenus] = useState<MenuNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMenus = useCallback(async () => {
    if (!token || !roleId || !userId) {
      setMenus([]);
      setError(null);
      return;
    }

    setLoading(true);
    try {
      const data = await fetchMenusByRole({ roleId, userId });
      const parsedMenus = ensureArray(data);

      if (parsedMenus.length === 0) {
        console.warn('[Menús] Respuesta vacía del backend:', data);
      }

      setMenus(parsedMenus);
      setError(null);
    } catch (err) {
      console.error('Error al cargar menús autorizados:', err);
      setMenus([]);
      setError('No se pudo cargar el menú del usuario.');
    } finally {
      setLoading(false);
    }
  }, [token, roleId, userId]);

  useEffect(() => {
    void fetchMenus();
  }, [fetchMenus]);

  return { menus, loading, error, reload: fetchMenus };
};

export const flattenMenuRoutes = (nodes: MenuNode[]): string[] => {
  const routes = new Set<string>();

  const visit = (items: MenuNode[]) => {
    items.forEach((item) => {
      if (item.ruta && typeof item.ruta === 'string' && item.ruta.trim() !== '') {
        const trimmed = item.ruta.trim();
        const normalized = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
        const withoutTrailing = normalized.replace(/\/+$/, '') || '/';
        addRouteWithSynonyms(withoutTrailing, routes);
      }
      if (item.hijos?.length) {
        visit(item.hijos);
      }
    });
  };

  visit(nodes);

  return Array.from(routes);
};

export const findAncestorChainByRoute = (
  nodes: MenuNode[],
  targetRoute: string
): number[] => {
  const chain: number[] = [];

  const visit = (items: MenuNode[], ancestors: number[]): boolean => {
    for (const item of items) {
      const rawRoute = typeof item.ruta === 'string' ? item.ruta.trim() : '';
      const normalizedRoute = rawRoute
        ? (rawRoute.startsWith('/') ? rawRoute : `/${rawRoute}`).replace(/\/+$/, '') || '/'
        : null;
      const newAncestors = [...ancestors, item.id];
      if (normalizedRoute && normalizedRoute === targetRoute) {
        chain.push(...ancestors);
        return true;
      }
      if (item.hijos?.length && visit(item.hijos, newAncestors)) {
        chain.push(item.id);
        return true;
      }
    }
    return false;
  };

  visit(nodes, []);

  return Array.from(new Set(chain));
};
