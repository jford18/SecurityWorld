import React, { useEffect, useMemo, useState } from 'react';
import { useSession, clearSession } from './context/SessionContext';
import AutocompleteComboBox from './ui/AutocompleteComboBox';

const Header: React.FC = () => {
  const [time, setTime] = useState(new Date());
  const { session, setSession } = useSession();

  useEffect(() => {
    const timerId = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timerId);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
    localStorage.removeItem('roleTokens');
    localStorage.removeItem('activeRoleId');
    localStorage.removeItem('selectedConsole');
    clearSession(setSession);
  };

  const handleRoleChange = (roleValue: string) => {
    if (!roleValue) {
      return;
    }

    const roleId = Number(roleValue);
    if (Number.isNaN(roleId)) {
      return;
    }

    const selectedRole = session.roles.find((role) => role.id === roleId);
    const roleToken = session.roleTokens.find((entry) => entry.roleId === roleId);

    if (!selectedRole || !roleToken) {
      return;
    }

    setSession((prev) => ({
      ...prev,
      roleId,
      roleName: selectedRole.nombre,
      token: roleToken.token,
    }));

    localStorage.setItem('token', roleToken.token);
    localStorage.setItem('activeRoleId', String(roleId));

    try {
      const storedUser = localStorage.getItem('usuario');
      if (storedUser) {
        const parsed = JSON.parse(storedUser) as Record<string, unknown>;
        parsed.rol_activo = selectedRole;
        localStorage.setItem('usuario', JSON.stringify(parsed));
      }
    } catch (error) {
      console.error('No se pudo actualizar el usuario almacenado con el rol activo:', error);
    }
  };

  const roleItems = useMemo(
    () => [
      { id: 'empty', label: session.roles.length === 0 ? 'No hay roles disponibles' : 'Seleccione un rol', value: '' },
      ...session.roles.map((role) => ({
        id: String(role.id),
        label: role.nombre,
        value: String(role.id),
      })),
    ],
    [session.roles]
  );

  return (
    <header className="flex items-center justify-between h-20 px-6 bg-white border-b">
      <div className="flex items-baseline gap-4">
        <h1 className="text-2xl font-semibold text-[#1C2E4A]">Bienvenido, {session.user}</h1>
        {(session.console || session.roleName || session.roles.length > 0) && (
          <span className="text-lg text-gray-500">
            {session.console && (
              <>
                | Consola: <span className="font-semibold text-[#1C2E4A]">{session.console}</span>{' '}
              </>
            )}
            {session.roleName && (
              <>
                | Rol activo:{' '}
                <span className="font-semibold text-[#1C2E4A] capitalize">{session.roleName}</span>{' '}
              </>
            )}
            {session.roles.length > 1 && (
              <>
                | Roles asignados:{' '}
                <span className="font-semibold text-[#1C2E4A]">
                  {session.roles.map((role) => role.nombre).join(', ')}
                </span>
              </>
            )}
          </span>
        )}
      </div>
      <div className="flex items-center gap-4">
        {session.roles.length > 0 && (
          <div className="w-52">
            <AutocompleteComboBox
              label="Rol activo"
              value={session.roleId != null ? String(session.roleId) : ''}
              onChange={handleRoleChange}
              items={roleItems}
              displayField="label"
              valueField="value"
              placeholder="Buscar rol..."
            />
          </div>
        )}
        <div className="text-right">
          <p className="text-lg font-semibold text-[#1C2E4A]">{time.toLocaleTimeString()}</p>
          <p className="text-sm text-gray-500">{time.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
        <div className="ml-4 w-12 h-12 flex items-center justify-center bg-gray-200 rounded-full">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6 text-gray-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        </div>
        <button
          onClick={handleLogout}
          title="Cerrar Sesión"
          className="ml-4 text-gray-500 hover:text-[#1C2E4A] transition-colors duration-200"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
        </button>
      </div>
    </header>
  );
};

export default Header;
