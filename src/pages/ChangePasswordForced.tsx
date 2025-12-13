import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { changePassword } from '../services/authService';
import { useSession } from '../components/context/SessionContext';

interface ChangePasswordForcedProps {
  redirectPath: string;
}

const ChangePasswordForced: React.FC<ChangePasswordForcedProps> = ({ redirectPath }) => {
  const { session, setSession } = useSession();
  const navigate = useNavigate();
  const [nuevaContrasena, setNuevaContrasena] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (session.token && session.requirePasswordChange === false) {
      navigate(redirectPath, { replace: true });
    }
  }, [navigate, redirectPath, session.requirePasswordChange, session.token]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccessMessage(null);

    const trimmedPassword = nuevaContrasena.trim();

    if (!trimmedPassword) {
      setError('La nueva contraseña es obligatoria.');
      return;
    }

    setLoading(true);
    try {
      await changePassword(trimmedPassword);
      setSession((prev) => ({ ...prev, requirePasswordChange: false }));
      localStorage.setItem('requirePasswordChange', 'false');
      setSuccessMessage('Contraseña actualizada correctamente');
      setTimeout(() => {
        navigate(redirectPath, { replace: true });
      }, 800);
    } catch (err) {
      console.error('Error al cambiar contraseña forzada', err);
      setError('No se pudo actualizar la contraseña. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#F5F6F8]">
      <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-xl shadow-2xl">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-[#1C2E4A]">Cambiar contraseña</h1>
          <p className="text-sm text-gray-600">
            Debes actualizar tu contraseña antes de ingresar al sistema.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="nuevaContrasena" className="block text-sm font-medium text-[#1C2E4A]">
              Nueva contraseña
            </label>
            <input
              id="nuevaContrasena"
              type="password"
              value={nuevaContrasena}
              onChange={(event) => setNuevaContrasena(event.target.value)}
              className="appearance-none block w-full px-3 py-3 border border-gray-300 bg-white text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-[#F9C300] focus:border-[#F9C300] sm:text-sm rounded-md"
              placeholder="Ingresa tu nueva contraseña"
              autoFocus
            />
          </div>

          {error && <p className="text-red-500 text-xs text-center">{error}</p>}
          {successMessage && <p className="text-green-600 text-xs text-center">{successMessage}</p>}

          <button
            type="submit"
            disabled={loading}
            className={`group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-[#1C2E4A] bg-[#F9C300] hover:bg-yellow-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#F9C300] transition-colors duration-300 ${
              loading ? 'opacity-70 cursor-not-allowed' : ''
            }`}
          >
            {loading ? 'Guardando…' : 'Guardar'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChangePasswordForced;
