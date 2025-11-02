import React, { useState } from 'react';
import { View } from '../types';
import Sidebar from './Sidebar';
import Header from './Header';
import DashboardHome from './views/DashboardHome';
import TechnicalFailures from './views/TechnicalFailures';
import Intrusions from './views/Intrusions';
import AlertsReportByShift from './views/AlertsReportByShift';
// FIX: Habilitamos la pantalla de mantenimiento de consolas dentro del dashboard.
import ConsolasScreen from '../pages/admin/ConsolasScreen';
// NEW: Incorporamos la vista de mantenimiento de roles.
import RolesScreen from '../pages/admin/RolesScreen';
// NEW: Incorporamos la vista de mantenimiento de usuarios.
import UsuariosScreen from '../pages/admin/UsuariosScreen';
// NEW: Vista del catálogo de tipos de problema dentro del dashboard.
import CatalogoTipoProblemaScreen from '../pages/admin/CatalogoTipoProblemaScreen';
// NEW: Vista de asignación de roles entre usuarios y roles del sistema.
import AsignacionRolesScreen from '../pages/admin/AsignacionRolesScreen';
// NEW: Vista de asignación de consolas entre usuarios y consolas disponibles.
import AsignacionConsolasScreen from '../pages/admin/AsignacionConsolasScreen';
// NEW: Vista de mantenimiento del catálogo de menús.
import MenuScreen from '../pages/admin/MenuScreen';
// NEW: Vista para administrar la relación entre roles y menús.
import RolMenuScreen from '../pages/admin/RolMenuScreen';

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
      case View.AdminConsolas:
        // FIX: Renderizamos el mantenimiento de consolas dentro del dashboard.
        return <ConsolasScreen />;
      case View.AdminRoles:
        // NEW: Renderizamos el mantenimiento de roles dentro del dashboard.
        return <RolesScreen />;
      case View.AdminUsuarios:
        // NEW: Renderizamos el mantenimiento de usuarios dentro del dashboard.
        return <UsuariosScreen />;
      case View.AdminCatalogoTipoProblema:
        // NEW: Renderizamos el catálogo tipo problema siguiendo la misma estética.
        return <CatalogoTipoProblemaScreen />;
      case View.AdminAsignacionRoles:
        // NEW: Renderizamos la pantalla de asignación de roles a usuarios.
        return <AsignacionRolesScreen />;
      case View.AdminAsignacionConsolas:
        // NEW: Renderizamos la pantalla de asignación de consolas a usuarios.
        return <AsignacionConsolasScreen />;
      case View.AdminRolMenu:
        // NEW: Renderizamos la pantalla de asignación de menús a roles.
        return <RolMenuScreen />;
      case View.AdminMenus:
        // NEW: Renderizamos la pantalla de mantenimiento de menús.
        return <MenuScreen />;
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