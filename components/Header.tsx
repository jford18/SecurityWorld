import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession, clearSession } from './context/SessionContext';

const Header: React.FC = () => {
  const [time, setTime] = useState(new Date());
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const { session, setSession } = useSession();
  const navigate = useNavigate();
  const userMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const timerId = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timerId);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
    clearSession(setSession);
    setIsUserMenuOpen(false);
    navigate('/login');
  };

  return (
    <header className="flex items-center justify-between h-20 px-6 bg-white border-b">
      <div className="flex items-baseline gap-4">
        <h1 className="text-2xl font-semibold text-[#1C2E4A]">Bienvenido, {session.user}</h1>
        {(session.console || session.role || session.roles.length > 0) && (
          <span className="text-lg text-gray-500">
            {session.console && (
              <>
                | Consola: <span className="font-semibold text-[#1C2E4A]">{session.console}</span>{' '}
              </>
            )}
            {session.role && (
              <>
                | Rol activo:{' '}
                <span className="font-semibold text-[#1C2E4A] capitalize">{session.role}</span>{' '}
              </>
            )}
            {session.roles.length > 1 && (
              <>
                | Roles asignados:{' '}
                <span className="font-semibold text-[#1C2E4A]">{session.roles.join(', ')}</span>
              </>
            )}
          </span>
        )}
      </div>
      <div className="flex items-center">
        <div className="text-right">
          <p className="text-lg font-semibold text-[#1C2E4A]">{time.toLocaleTimeString()}</p>
          <p className="text-sm text-gray-500">{time.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
        <div ref={userMenuRef} className="relative ml-4">
          <button
            type="button"
            onClick={() => setIsUserMenuOpen((prev) => !prev)}
            className="w-12 h-12 flex items-center justify-center bg-gray-200 rounded-full hover:bg-gray-300 transition"
            title="Menú de usuario"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6 text-gray-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </button>

          {isUserMenuOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-white border rounded-lg shadow-lg z-50">
              <button
                type="button"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setIsUserMenuOpen(false);
                  handleLogout();
                }}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
              >
                Cerrar Sesión
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
