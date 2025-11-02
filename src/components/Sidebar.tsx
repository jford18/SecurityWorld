import React from 'react';
import { View } from '../types';

interface SidebarProps {
  currentView: View;
  setCurrentView: (view: View) => void;
}

const NavItem: React.FC<{
  view: View;
  currentView: View;
  setCurrentView: (view: View) => void;
  icon: React.ReactNode;
  label: string;
}> = ({ view, currentView, setCurrentView, icon, label }) => {
  const isActive = currentView === view;
  return (
    <a
      href="#"
      onClick={(e) => {
        e.preventDefault();
        setCurrentView(view);
      }}
      className={`flex items-center px-6 py-3 text-gray-300 hover:bg-[#243b55] hover:text-white transition-colors duration-200 ${
        isActive ? 'bg-[#243b55] text-white' : ''
      }`}
    >
      {icon}
      <span className="mx-4 font-medium">{label}</span>
    </a>
  );
};

const Sidebar: React.FC<SidebarProps> = ({ currentView, setCurrentView }) => {
  // FIX: Separamos las colecciones del menú para controlar los bloques de mantenimiento y seguridad.
  const mainNavigation = [
    {
      view: View.Dashboard,
      label: 'Dashboard',
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-6 w-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
          />
        </svg>
      ),
    },
    {
      view: View.Failures,
      label: 'Fallos Técnicos',
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-6 w-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      ),
    },
    {
      view: View.Intrusions,
      label: 'Intrusiones',
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-6 w-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      ),
    },
    {
      view: View.AlertsReport,
      label: 'Reporte Alertas Turno',
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-6 w-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      ),
    },
  ];

  const mantenimientoNavigation = [
    {
      view: View.AdminConsolas,
      label: 'Consolas',
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-6 w-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M9.75 17L8 21h8l-1.75-4M4 5h16a1 1 0 011 1v8a1 1 0 01-1 1H4a1 1 0 01-1-1V6a1 1 0 011-1z"
          />
        </svg>
      ),
    },
    {
      view: View.AdminRoles,
      label: 'Roles',
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-6 w-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M9 17a2 2 0 104 0m3-9a5 5 0 00-10 0v4.586l-.707.707A1 1 0 007 14h10a1 1 0 00.707-1.707L17 12.586V8z"
          />
        </svg>
      ),
    },
    {
      view: View.AdminUsuarios,
      label: 'Usuarios',
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-6 w-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M5.121 17.804A5 5 0 0112 15a5 5 0 016.879 2.804M15 9a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
      ),
    },
    {
      view: View.AdminCatalogoTipoProblema,
      label: 'Catálogo Tipo Problema',
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-6 w-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M9 5h12M9 12h12M9 19h12M5 5h.01M5 12h.01M5 19h.01"
          />
        </svg>
      ),
    },
    {
      view: View.AdminMenus,
      label: 'Catálogo de Menús',
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-6 w-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M4 6h16M4 12h16M4 18h7"
          />
        </svg>
      ),
    },
  ];

  const seguridadNavigation = [
    {
      view: View.AdminAsignacionRoles,
      label: 'Usuarios ↔ Roles',
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-6 w-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M16 7a4 4 0 10-8 0 4 4 0 008 0zm-4 6a7 7 0 00-7 7h2a5 5 0 0110 0h2a7 7 0 00-7-7zm5 0a3 3 0 110 6 3 3 0 010-6z"
          />
        </svg>
      ),
    },
    {
      view: View.AdminAsignacionConsolas,
      label: 'Usuarios ↔ Consolas',
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-6 w-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M4 5h16a1 1 0 011 1v9a1 1 0 01-1 1H4a1 1 0 01-1-1V6a1 1 0 011-1zm6 12h4m-6 2h8"
          />
        </svg>
      ),
    },
    {
      view: View.AdminRolMenu,
      label: 'Roles ↔ Menús',
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-6 w-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M8 7h8M8 11h8M8 15h5m4 6h-5a3 3 0 01-3-3V6a3 3 0 013-3h5a3 3 0 013 3v12a3 3 0 01-3 3zM6 7H5a2 2 0 00-2 2v9a2 2 0 002 2h1"
          />
        </svg>
      ),
    },
  ];

  return (
    <div className="flex flex-col w-64 bg-[#1C2E4A] text-white">
      <div className="flex items-center justify-center h-20 bg-white">
        <img
          src="https://www.swsecurityworld.com/wp-content/uploads/2018/08/Security-World-logo-1.png"
          alt="SW Security World Logo"
          className="h-12"
        />
      </div>
      <div className="flex-1 overflow-y-auto">
        <nav className="mt-10">
          {mainNavigation.map((item) => (
            <NavItem
              key={item.label}
              view={item.view}
              currentView={currentView}
              setCurrentView={setCurrentView}
              icon={item.icon}
              label={item.label}
            />
          ))}

          <div className="text-xs font-semibold text-gray-400 uppercase px-6 mt-6 mb-2">Mantenimiento</div>
          {mantenimientoNavigation.map((item) => (
            <NavItem
              key={item.label}
              view={item.view}
              currentView={currentView}
              setCurrentView={setCurrentView}
              icon={item.icon}
              label={item.label}
            />
          ))}

          <div className="text-xs font-semibold text-gray-400 uppercase px-6 mt-6 mb-2">
            Seguridad y Asignaciones
          </div>
          {seguridadNavigation.map((item) => (
            <NavItem
              key={item.label}
              view={item.view}
              currentView={currentView}
              setCurrentView={setCurrentView}
              icon={item.icon}
              label={item.label}
            />
          ))}
        </nav>
      </div>
    </div>
  );
};

export default Sidebar;