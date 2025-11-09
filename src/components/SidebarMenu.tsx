import React, { useEffect, useMemo, useState, Suspense } from 'react';
import { Link, useLocation } from 'react-router-dom';
import type { MenuNode } from '../hooks/useMenus';
import { findAncestorChainByRoute } from '../hooks/useMenus';
import { groupBy, sortBy } from 'lodash';
import * as allIcons from 'lucide-react';

const iconMap = allIcons as unknown as Record<string, React.ComponentType<any>>;

const CLIENTES_ROUTE = '/administracion/clientes';
const CLIENTES_MENU_ENTRY: MenuNode = {
  id: -1000,
  nombre: 'Clientes',
  icono: 'Users',
  ruta: CLIENTES_ROUTE,
  seccion: 'MANTENIMIENTO',
  orden: 999,
  hijos: [],
};

const hasRoute = (items: MenuNode[], targetRoute: string): boolean => {
  for (const item of items) {
    const rawRoute = typeof item.ruta === 'string' ? item.ruta.trim() : '';
    const normalizedRoute = rawRoute
      ? (rawRoute.startsWith('/') ? rawRoute : `/${rawRoute}`).replace(/\/+$/, '') || '/'
      : null;

    if (normalizedRoute === targetRoute) {
      return true;
    }

    if (item.hijos?.length && hasRoute(item.hijos, targetRoute)) {
      return true;
    }
  }
  return false;
};

interface DynamicIconProps extends allIcons.LucideProps {
  name: string;
}

const DynamicIcon: React.FC<DynamicIconProps> = ({ name, ...props }) => {
  const IconComponent = iconMap[name];

  if (!IconComponent) {
    // Fallback icon
    return <allIcons.HelpCircle {...props} />;
  }

  return (
    <Suspense fallback={<div className="w-5 h-5" />}>
      <IconComponent {...props} />
    </Suspense>
  );
};

interface SidebarMenuProps {
  menus: MenuNode[];
}

const linkClasses =
  'flex items-center w-full px-4 py-2 rounded-lg transition-colors duration-200 text-sm';
const activeClasses = 'bg-[#243b55] text-white';
const inactiveClasses = 'text-gray-300 hover:bg-[#243b55] hover:text-white';

const SidebarMenuItem: React.FC<{
  menu: MenuNode;
  depth: number;
  expandedItems: Set<number>;
  toggleItem: (id: number) => void;
}> = ({ menu, depth, expandedItems, toggleItem }) => {
  const location = useLocation();
  const hasChildren = menu.hijos && menu.hijos.length > 0;
  const isExpanded = expandedItems.has(menu.id);
  const currentPath = location.pathname.replace(/\/+$/, '') || '/';
  const menuPath = menu.ruta ? (menu.ruta.startsWith('/') ? menu.ruta : `/${menu.ruta}`) : null;
  const normalizedMenuPath = menuPath ? menuPath.replace(/\/+$/, '') || '/' : null;
  const isActive = normalizedMenuPath ? currentPath === normalizedMenuPath : false;
  const paddingLeft = 16 + depth * 12;

  const content = (
    <div className="flex items-center justify-between w-full">
      <span className="flex items-center">
        {menu.icono && <DynamicIcon name={menu.icono} className="mr-3 h-5 w-5" />}
        <span>{menu.nombre}</span>
      </span>
      {hasChildren && (
        <span className="ml-2 text-xs text-gray-400">{isExpanded ? '−' : '+'}</span>
      )}
    </div>
  );

  return (
    <li key={menu.id}>
      {menuPath ? (
        <Link
          to={menuPath}
          className={`${linkClasses} ${isActive ? activeClasses : inactiveClasses}`}
          style={{ paddingLeft }}
          onClick={() => {
            if (hasChildren) {
              toggleItem(menu.id);
            }
          }}
        >
          {content}
        </Link>
      ) : (
        <button
          type="button"
          className={`${linkClasses} ${inactiveClasses}`}
          style={{ paddingLeft }}
          onClick={() => toggleItem(menu.id)}
        >
          {content}
        </button>
      )}
      {hasChildren && isExpanded && (
        <ul className="mt-1 space-y-1">
          {sortBy(menu.hijos, 'orden').map((child) => (
            <SidebarMenuItem
              key={child.id}
              menu={child}
              depth={depth + 1}
              expandedItems={expandedItems}
              toggleItem={toggleItem}
            />
          ))}
        </ul>
      )}
    </li>
  );
};

const SidebarMenu: React.FC<SidebarMenuProps> = ({ menus }) => {
  const location = useLocation();
  const currentPath = location.pathname.replace(/\/+$/, '') || '/';

  const effectiveMenus = useMemo(() => {
    if (!menus.length) {
      return [CLIENTES_MENU_ENTRY];
    }

    if (hasRoute(menus, CLIENTES_ROUTE)) {
      return menus;
    }

    return [...menus, CLIENTES_MENU_ENTRY];
  }, [menus]);

  const activeAncestors = useMemo(
    () => findAncestorChainByRoute(effectiveMenus, currentPath),
    [effectiveMenus, currentPath]
  );

  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set(activeAncestors));

  useEffect(() => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      activeAncestors.forEach((id) => next.add(id));
      return next;
    });
  }, [activeAncestors]);

  const toggleItem = (id: number) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const groupedAndSortedMenus = useMemo(() => {
    const topLevelMenus = effectiveMenus.filter(item => !effectiveMenus.some(parent => parent.hijos.some(child => child.id === item.id)));
    const grouped = groupBy(topLevelMenus, 'seccion');
    const sortedSections = Object.entries(grouped).map(([seccion, items]) => ({
      seccion,
      items: sortBy(items, 'orden'),
    }));
    return sortBy(sortedSections, section => section.items[0]?.orden ?? 0);
  }, [effectiveMenus]);

  if (!effectiveMenus.length) {
    console.warn('[Menús] Respuesta vacía del backend en SidebarMenu:', menus);
    return (
      <div className="px-4 py-2 text-sm text-gray-400">
        No hay menús disponibles para el rol seleccionado.
      </div>
    );
  }

  return (
    <div>
      {groupedAndSortedMenus.map(({ seccion, items }) => (
        <div key={seccion} className="mb-4">
          <h4 className="text-gray-400 text-sm mt-3">{seccion}</h4>
          <ul className="space-y-1">
            {items.map((menu) => (
              <SidebarMenuItem
                key={menu.id}
                menu={menu}
                depth={0}
                expandedItems={expandedItems}
                toggleItem={toggleItem}
              />
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
};

export default SidebarMenu;
