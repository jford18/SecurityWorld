import { useCallback, useEffect, useState } from 'react';
import api, { API_BASE_URL } from '../services/api';

export interface MenuNode {
  id: number;
  nombre: string;
  icono: string | null;
  ruta: string | null;
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
      hijos: ensureArray((item as { hijos?: unknown }).hijos ?? []),
    }));
};

export const useMenus = (token: string | null, roleId: number | null) => {
  const [menus, setMenus] = useState<MenuNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMenus = useCallback(async () => {
    if (!token || !roleId) {
      setMenus([]);
      setError(null);
      return;
    }

    setLoading(true);
    try {
      const response = await api.get<MenuNode[]>(`/api/menus`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        baseURL: API_BASE_URL,
      });

      const parsedMenus = ensureArray(response.data);
      setMenus(parsedMenus);
      setError(null);
    } catch (err) {
      console.error('Error al cargar menús autorizados:', err);
      setMenus([]);
      setError('No se pudo cargar el menú del usuario.');
    } finally {
      setLoading(false);
    }
  }, [token, roleId]);

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
        routes.add(withoutTrailing);
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
      const newAncestors = [...ancestors, item.id];
      if (item.ruta === targetRoute) {
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
