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
    <aside className="w-72 bg-[#1C2E4A] text-white flex-shrink-0">
      <div className="px-6 py-6 border-b border-[#243b55]">
        <h2 className="text-xl font-semibold">Menú Principal</h2>
        <p className="text-sm text-gray-400">Opciones según tu rol</p>
      </div>
      <nav className="px-4 py-6 overflow-y-auto h-[calc(100vh-6rem)]">
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
