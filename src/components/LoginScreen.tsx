import React, { useState } from 'react';

interface LoginScreenProps {
  onLogin: (primaryRole: 'operador' | 'supervisor', roles: string[]) => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (isLoading) {
      return;
    }

    setIsLoading(true);

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
        if (response.status === 401) {
          setError('Credenciales incorrectas');
        } else if (response.status === 500) {
          setError('Error del servidor. Inténtelo más tarde.');
        } else {
          setError('No se pudo iniciar sesión.');
        }
        return;
      }

      const data = await response.json();

      localStorage.setItem('token', data.token);
      localStorage.setItem('usuario', JSON.stringify(data.usuario));

      const [primaryRole] = data.usuario.roles;
      if (primaryRole) {
        onLogin(primaryRole as 'operador' | 'supervisor', data.usuario.roles);
      } else {
        onLogin('operador', data.usuario.roles);
      }
    } catch (error) {
      console.error('Error al iniciar sesión:', error);
      setError('Error de conexión con el servidor');
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
