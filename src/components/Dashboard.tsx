import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import type { MenuNode } from '../hooks/useMenus';

interface DashboardProps {
  menus: MenuNode[];
  menuLoading: boolean;
  menuError: string | null;
}

const Dashboard: React.FC<DashboardProps> = ({ menus, menuLoading, menuError }) => {
  return (
    <div className="flex h-screen bg-[#F5F6F8]">
      <Sidebar menus={menus} loading={menuLoading} error={menuError} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-[#F5F6F8]">
          <div className="container mx-auto px-6 py-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default Dashboard;
