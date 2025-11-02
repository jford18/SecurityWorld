import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import type { MenuNode } from '../hooks/useMenus';
import { findAncestorChainByRoute } from '../hooks/useMenus';

interface SidebarMenuProps {
  menus: MenuNode[];
}

const iconClasses = 'mr-3 text-lg';
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
        {menu.icono ? <i className={`bi ${menu.icono} ${iconClasses}`} aria-hidden="true"></i> : null}
        <span>{menu.nombre}</span>
      </span>
      {hasChildren ? (
        <span className="ml-2 text-xs text-gray-400">{isExpanded ? '−' : '+'}</span>
      ) : null}
    </div>
  );

  return (
    <li key={menu.id}>
      {menu.ruta ? (
        <Link
          to={menu.ruta}
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
      {hasChildren && isExpanded ? (
        <ul className="mt-1 space-y-1">
          {menu.hijos.map((child) => (
            <SidebarMenuItem
              key={child.id}
              menu={child}
              depth={depth + 1}
              expandedItems={expandedItems}
              toggleItem={toggleItem}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
};

const SidebarMenu: React.FC<SidebarMenuProps> = ({ menus }) => {
  const location = useLocation();
  const currentPath = location.pathname.replace(/\/+$/, '') || '/';
  const activeAncestors = useMemo(
    () => findAncestorChainByRoute(menus, currentPath),
    [menus, currentPath]
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

  if (!menus.length) {
    return (
      <div className="px-4 py-2 text-sm text-gray-400">
        No hay menús disponibles para el rol seleccionado.
      </div>
    );
  }

  return (
    <ul className="space-y-1">
      {menus.map((menu) => (
        <SidebarMenuItem
          key={menu.id}
          menu={menu}
          depth={0}
          expandedItems={expandedItems}
          toggleItem={toggleItem}
        />
      ))}
    </ul>
  );
};

export default SidebarMenu;
