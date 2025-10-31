import React, { useState } from 'react';
import { View } from '../types';
import Sidebar from './Sidebar';
import Header from './Header';
import DashboardHome from './views/DashboardHome';
import TechnicalFailures from './views/TechnicalFailures';
import Intrusions from './views/Intrusions';
import AlertsReportByShift from './views/AlertsReportByShift';
// NEW: Incorporamos la vista de mantenimiento de roles.
import RolesScreen from '../pages/admin/RolesScreen';
// NEW: Incorporamos la vista de mantenimiento de usuarios.
import UsuariosScreen from '../pages/admin/UsuariosScreen';

const Dashboard: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>(View.Dashboard);

  const renderView = () => {
    switch (currentView) {
      case View.Dashboard:
        return <DashboardHome />;
      case View.Failures:
        return <TechnicalFailures />;
      case View.Intrusions:
        return <Intrusions />;
      case View.AlertsReport:
        return <AlertsReportByShift />;
      case View.AdminRoles:
        // NEW: Renderizamos el mantenimiento de roles dentro del dashboard.
        return <RolesScreen />;
      case View.AdminUsuarios:
        // NEW: Renderizamos el mantenimiento de usuarios dentro del dashboard.
        return <UsuariosScreen />;
      default:
        return <DashboardHome />;
    }
  };

  return (
    <div className="flex h-screen bg-[#F5F6F8]">
      <Sidebar currentView={currentView} setCurrentView={setCurrentView} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-[#F5F6F8]">
          <div className="container mx-auto px-6 py-8">
            {renderView()}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Dashboard;