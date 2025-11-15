import React, { useState } from 'react';
import { RoleOption, RoleToken } from './context/SessionContext';
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
  const [roleInfo, setRoleInfo] = useState<RoleOption | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (isLoading) {
      return;
    }

    setIsLoading(true);

    try {
      const response = await api.post('/login', {
        nombre_usuario: username,
        contrasena_plana: password,
      });

      const data = response.data ?? {};

      const normalizedRoles: RoleOption[] = Array.isArray(data.roles)
        ? data.roles
            .filter(
              (role: unknown): role is { id: number; nombre: string } =>
                !!role &&
                typeof role === 'object' &&
                typeof (role as { id?: unknown }).id === 'number' &&
                typeof (role as { nombre?: unknown }).nombre === 'string'
            )
            .map((role: { id: number; nombre: string }) => ({ id: role.id, nombre: role.nombre }))
        : [];

      const primaryRole =
        normalizedRoles[0] ??
        (typeof data.rol_id === 'number' && typeof data.rol_nombre === 'string'
          ? { id: data.rol_id, nombre: data.rol_nombre }
          : null);

      if (!primaryRole) {
        setError('No se pudo determinar el rol del usuario.');
        setRoleInfo(null);
        return;
      }

      setRoleInfo(primaryRole);

      const usuario: UsuarioAutenticado = {
        id: Number(data.id) || 0,
        nombre_usuario:
          typeof data.nombre_usuario === 'string'
            ? data.nombre_usuario
            : typeof data.usuario === 'string'
            ? data.usuario
            : username,
        roles: normalizedRoles.length > 0 ? normalizedRoles : [primaryRole],
        rol_activo: primaryRole,
      };

      const tokenFromResponse =
        typeof data.token === 'string' && data.token.trim().length > 0
          ? data.token
          : 'fake-jwt-token';

      const tokensToUse: RoleToken[] = [
        {
          roleId: primaryRole.id,
          token: tokenFromResponse,
        },
      ];

      onLogin({
        user: usuario,
        selectedRole: primaryRole,
        consoleName: '',
        token: tokenFromResponse,
        roles: usuario.roles,
        roleTokens: tokensToUse,
      });
    } catch (error) {
      let backendMessage: string | null = null;
      if (typeof error === 'object' && error !== null && 'response' in error) {
        const maybeResponse = (error as { response?: { data?: { message?: unknown } } }).response;
        const maybeMessage = maybeResponse?.data?.message;
        if (typeof maybeMessage === 'string') {
          backendMessage = maybeMessage;
        }
      }

      setError(backendMessage ?? 'Error de autenticación');
      setRoleInfo(null);
    } finally {
      setIsLoading(false);
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
            <div>
              <label htmlFor="role" className="block text-sm font-medium text-[#1C2E4A]">
                Rol asignado
              </label>
              <input
                id="role"
                name="role"
                type="text"
                value={roleInfo?.nombre ?? ''}
                placeholder="Se mostrará al iniciar sesión"
                readOnly
                disabled
                className="block w-full px-3 py-3 border border-gray-300 bg-gray-100 text-gray-600 rounded-md cursor-not-allowed"
              />
            </div>
          </div>

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
