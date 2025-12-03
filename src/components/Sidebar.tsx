import React from 'react';
import SidebarMenu from './SidebarMenu';
import type { MenuNode } from '../hooks/useMenus';

interface SidebarProps {
  menus: MenuNode[];
  loading: boolean;
  error: string | null;
}

const Sidebar: React.FC<SidebarProps> = ({ menus, loading, error }) => {
  return (
    <aside className="w-72 bg-[#1C2E4A] text-white flex-shrink-0 flex flex-col">
      <div className="flex items-center justify-center py-4 border-b border-white/5">
        <img
          src="https://www.swsecurityworld.com/wp-content/uploads/2018/08/Security-World-logo-1.png"
          alt="SW Security World Logo"
          className="h-10 w-auto object-contain"
        />
      </div>
      <nav className="px-4 py-6 overflow-y-auto flex-1">
        {loading ? (
          <p className="text-sm text-gray-400">Cargando menús...</p>
        ) : error ? (
          <p className="text-sm text-red-400">{error}</p>
        ) : (
          <SidebarMenu menus={menus} />
        )}
      </nav>
    </aside>
  );
};

export default Sidebar;
