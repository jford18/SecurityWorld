import React, { useState, useEffect } from 'react';
import { RoleOption, RoleToken } from './context/SessionContext';
import { getConsolas } from '../services/consolasService';
import api from '../services/api';

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
  const [assignedRole, setAssignedRole] = useState<RoleOption | null>(null);
  const [consoleOptions, setConsoleOptions] = useState<string[]>([]);
  const [selectedConsole, setSelectedConsole] = useState('');

  useEffect(() => {
    const fetchConsolas = async () => {
      try {
        const data = await getConsolas();
        const consoleNames = data.map((c: { nombre: string }) => c.nombre);
        setConsoleOptions(consoleNames);
        if (consoleNames.length > 0) {
          setSelectedConsole(consoleNames[0]);
        }
      } catch (error) {
        console.error("Error fetching consoles:", error);
        setError("Error al cargar la lista de consolas.");
      }
    };
    fetchConsolas();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (isLoading) {
      return;
    }

    if (!usuarioAutenticado) {
      setIsLoading(true); // FIX: Activar indicador de carga durante la fase de autenticación.

      try {
        const response = await api.post('/login', {
          nombre_usuario: username,
          contrasena_plana: password,
        });

        const data = response.data ?? {};

        const roleId = Number(data.rol_id);
        const roleName =
          typeof data.rol_nombre === 'string' && data.rol_nombre.trim().length > 0
            ? data.rol_nombre.trim()
            : '';

        const userId = Number(data.usuario_id);
        const usernameFromResponse =
          typeof data.nombre_usuario === 'string' && data.nombre_usuario.trim().length > 0
            ? data.nombre_usuario.trim()
            : username;

        if (!Number.isFinite(roleId) || roleId <= 0 || !roleName || !Number.isFinite(userId) || userId <= 0) {
          throw new Error('Respuesta inválida del servidor.');
        }

        const primaryRole: RoleOption = {
          id: roleId,
          nombre: roleName,
        };

        const usuario: UsuarioAutenticado = {
          id: userId,
          nombre_usuario: usernameFromResponse,
          roles: [primaryRole],
          rol_activo: primaryRole,
        };

        setUsuarioAutenticado(usuario);
        setAssignedRole(primaryRole);
      } catch (caughtError: unknown) {
        console.error('Error al iniciar sesión:', caughtError);
        const possibleResponse = caughtError as {
          response?: {
            data?: {
              message?: unknown;
            };
          };
        };

        const serverMessage = possibleResponse?.response?.data?.message;
        const messageToShow =
          typeof serverMessage === 'string' && serverMessage.trim().length > 0
            ? serverMessage
            : 'Error de autenticación';

        setError(messageToShow);
      } finally {
        setIsLoading(false); // FIX: Finalizar indicador de carga al concluir la fase de autenticación.
      }

      return;
    }

    if (!selectedConsole) {
      setError('Seleccione una consola para continuar.'); // FIX: Validar que el usuario elija una consola antes de continuar.
      return;
    }

    if (!assignedRole) {
      setError('No se encontró un rol asignado.');
      return;
    }

    setIsLoading(true); // FIX: Mostrar carga durante el envío de la selección de consola.
    try {
      const sessionToken = `session-${usuarioAutenticado.id}-${assignedRole.id}`;
      const roleTokens: RoleToken[] = [
        {
          roleId: assignedRole.id,
          token: sessionToken,
        },
      ];

      onLogin({
        user: usuarioAutenticado,
        selectedRole: assignedRole,
        consoleName: selectedConsole,
        token: sessionToken,
        roles: [assignedRole],
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
                <input
                  id="role"
                  name="role"
                  type="text"
                  value={assignedRole ? assignedRole.nombre : 'Sin rol asignado'}
                  readOnly
                  disabled
                  className="block w-full px-3 py-3 border border-gray-300 bg-gray-100 text-gray-900 rounded-md cursor-not-allowed"
                />
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
