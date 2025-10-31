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
          <NavItem
            view={View.Dashboard}
            currentView={currentView}
            setCurrentView={setCurrentView}
            icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>}
            label="Dashboard"
          />
          <NavItem 
            view={View.Failures} 
            currentView={currentView} 
            setCurrentView={setCurrentView}
            icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>}
            label="Fallos Técnicos"
          />
          <NavItem 
            view={View.Intrusions} 
            currentView={currentView} 
            setCurrentView={setCurrentView}
            icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
            label="Intrusiones"
          />
          <NavItem
            view={View.AlertsReport}
            currentView={currentView}
            setCurrentView={setCurrentView}
            icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
            label="Reporte Alertas Turno"
          />
          {/* NEW: Sección de mantenimiento con acceso a la administración de roles. */}
          <div className="mt-8">
            <p className="px-6 text-xs font-semibold uppercase tracking-wider text-gray-400">
              Mantenimiento
            </p>
            <NavItem
              view={View.AdminRoles}
              currentView={currentView}
              setCurrentView={setCurrentView}
              icon={
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
              }
              label="Roles"
            />
            {/* NEW: Enlace directo al mantenimiento de usuarios. */}
            <NavItem
              view={View.AdminUsuarios}
              currentView={currentView}
              setCurrentView={setCurrentView}
              icon={
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
              }
              label="Usuarios"
            />
          </div>
        </nav>
      </div>
    </div>
  );
};

export default Sidebar;