import React, { useState } from 'react';
import { RoleOption, RoleToken } from './context/SessionContext';

interface LoginScreenProps {
  onLogin: (payload: {
    user: UsuarioAutenticado;
    selectedRole: RoleOption;
    consoleName: string;
    token: string;
    roles: RoleOption[];
    roleTokens: RoleToken[];
  }) => void;
}

interface UsuarioAutenticado {
  id: number;
  nombre_usuario: string;
  roles: RoleOption[];
  rol_activo: RoleOption | null;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [usuarioAutenticado, setUsuarioAutenticado] = useState<UsuarioAutenticado | null>(null);
  const [availableRoles, setAvailableRoles] = useState<RoleOption[]>([]);
  const [roleTokens, setRoleTokens] = useState<RoleToken[]>([]);
  const [consoleOptions, setConsoleOptions] = useState<string[]>([]);
  const [selectedConsole, setSelectedConsole] = useState('');
  const [selectedRoleId, setSelectedRoleId] = useState<number | ''>('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (isLoading) {
      return;
    }

    if (!usuarioAutenticado) {
      setIsLoading(true); // FIX: Activar indicador de carga durante la fase de autenticación.

      try {
        const response = await fetch('http://localhost:3000/api/auth/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            nombre_usuario: username,
            contrasena_plana: password,
          }),
        });

        if (!response.ok) {
          setError('Error de autenticación'); // FIX: Mantener mensaje uniforme cuando falla la autenticación.
          return;
        }

        const data = await response.json();

        const usuario = data.usuario as UsuarioAutenticado;
        setUsuarioAutenticado(usuario); // FIX: Conservar al usuario autenticado para la segunda fase.

        const rolesFromResponse = Array.isArray(usuario.roles) ? usuario.roles : [];
        setAvailableRoles(rolesFromResponse);

        const parsedTokens: RoleToken[] = Array.isArray(data.tokensPorRol)
          ? data.tokensPorRol
              .filter(
                (item: { rol_id?: unknown; token?: unknown }) =>
                  typeof item?.rol_id === 'number' && typeof item?.token === 'string'
              )
              .map((item: { rol_id: number; token: string }) => ({
                roleId: item.rol_id,
                token: item.token,
              }))
          : [];

        const primaryRoleId = usuario.rol_activo?.id ?? rolesFromResponse[0]?.id ?? null;
        const tokensToUse =
          parsedTokens.length > 0
            ? parsedTokens
            : primaryRoleId && typeof data.token === 'string'
            ? [{ roleId: primaryRoleId, token: data.token }]
            : [];

        setRoleTokens(tokensToUse);
        setSelectedRoleId(primaryRoleId ?? '');

        const fetchedConsoles = Array.isArray(data.consolas)
          ? data.consolas.map((c) => c.nombre)
          : [];
        setConsoleOptions(fetchedConsoles);
        const defaultConsole = fetchedConsoles[0] ?? '';
        setSelectedConsole(defaultConsole);
      } catch (error) {
        console.error('Error al iniciar sesión:', error);
        setError('Error de autenticación'); // FIX: Unificar mensaje de error en fallos de red o servidor durante autenticación.
      } finally {
        setIsLoading(false); // FIX: Finalizar indicador de carga al concluir la fase de autenticación.
      }

      return;
    }

    if (!selectedConsole) {
      setError('Seleccione una consola para continuar.'); // FIX: Validar que el usuario elija una consola antes de continuar.
      return;
    }

    if (selectedRoleId === '' || typeof selectedRoleId !== 'number') {
      setError('Seleccione un rol válido.');
      return;
    }

    const selectedRole = availableRoles.find((role) => role.id === selectedRoleId);
    if (!selectedRole) {
      setError('No se encontró un rol asignado.');
      return;
    }

    const roleToken = roleTokens.find((entry) => entry.roleId === selectedRole.id);
    if (!roleToken) {
      setError('No se encontró un token para el rol seleccionado.');
      return;
    }

    setIsLoading(true); // FIX: Mostrar carga durante el envío de la selección de consola.
    try {
      onLogin({
        user: usuarioAutenticado,
        selectedRole,
        consoleName: selectedConsole,
        token: roleToken.token,
        roles: availableRoles,
        roleTokens,
      }); // FIX: Completar la fase de selección de consola y navegar.
    } finally {
      setIsLoading(false); // FIX: Asegurar que el estado de carga se desactive tras finalizar la fase de consola.
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#F5F6F8]">
      <div className="w-full max-w-md p-8 space-y-8 bg-white rounded-xl shadow-2xl">
        <div className="flex justify-center">
          <img
            src="https://www.swsecurityworld.com/wp-content/uploads/2018/08/Security-World-logo-1.png"
            alt="SW Security World Logo"
            className="h-16"
          />
        </div>
        <h2 className="text-3xl font-bold text-center text-[#1C2E4A]">Portal Administrativo</h2>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {!usuarioAutenticado ? (
            <div className="space-y-4">
              <div>
                <label htmlFor="username" className="block text-sm font-medium text-[#1C2E4A]">
                  Usuario
                </label>
                <input
                  id="username"
                  name="username"
                  type="text"
                  autoComplete="username"
                  required
                  value={username}
                  onChange={(event) => {
                    setUsername(event.target.value);
                    if (error) {
                      setError('');
                    }
                  }}
                  className="appearance-none block w-full px-3 py-3 border border-gray-300 bg-white text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-[#F9C300] focus:border-[#F9C300] sm:text-sm rounded-md"
                  placeholder="Ingrese su usuario"
                />
              </div>
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-[#1C2E4A]">
                  Contraseña
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    if (error) {
                      setError('');
                    }
                  }}
                  className="appearance-none block w-full px-3 py-3 border border-gray-300 bg-white text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-[#F9C300] focus:border-[#F9C300] sm:text-sm rounded-md"
                  placeholder="Ingrese su contraseña"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label htmlFor="role" className="block text-sm font-medium text-[#1C2E4A]">
                  Rol
                </label>
                <select
                  id="role"
                  name="role"
                  value={selectedRoleId === '' ? '' : selectedRoleId}
                  onChange={(event) => {
                    const value = event.target.value;
                    setSelectedRoleId(value ? Number(value) : '');
                    if (error) {
                      setError('');
                    }
                  }}
                  className="block w-full px-3 py-3 border border-gray-300 bg-white text-gray-900 rounded-md focus:outline-none focus:ring-[#F9C300] focus:border-[#F9C300]"
                >
                  {availableRoles.length === 0 ? (
                    <option value="">Sin rol asignado</option>
                  ) : (
                    availableRoles.map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.nombre}
                      </option>
                    ))
                  )}
                </select>
              </div>
              <div>
                <label htmlFor="console" className="block text-sm font-medium text-[#1C2E4A]">
                  Seleccione Consola
                </label>
                <select
                  id="console"
                  name="console"
                  required
                  value={selectedConsole}
                  onChange={(event) => {
                    setSelectedConsole(event.target.value);
                    if (error) {
                      setError('');
                    }
                  }}
                  className="block w-full px-3 py-3 border border-gray-300 bg-white text-gray-900 rounded-md focus:outline-none focus:ring-[#F9C300] focus:border-[#F9C300]"
                >
                  <option value="" disabled>
                    Seleccione una consola
                  </option>
                  {consoleOptions.map((consoleName) => (
                    <option key={consoleName} value={consoleName}>
                      {consoleName}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {error && <p className="text-red-500 text-xs text-center pt-2">{error}</p>}
          {isLoading && !error && (
            <p className="text-sm text-center text-[#1C2E4A]">Verificando credenciales…</p>
          )}

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className={`group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-[#1C2E4A] bg-[#F9C300] hover:bg-yellow-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#F9C300] transition-colors duration-300 ${
                isLoading ? 'opacity-70 cursor-not-allowed' : ''
              }`}
            >
              {isLoading ? 'Ingresando…' : 'Ingresar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LoginScreen;
