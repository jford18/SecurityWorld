
import React, { useState } from 'react';

interface LoginScreenProps {
  onLogin: (selectedConsole: string) => void;
}

const consoleOptions = ["CLARO", "NOVOPAN", "PRONACA", "AVICA"];

const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const [selectedConsole, setSelectedConsole] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedConsole) {
      setError('Por favor, seleccione una consola.');
      return;
    }
    setError('');
    onLogin(selectedConsole);
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
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <input 
                id="username" 
                name="username" 
                type="text" 
                autoComplete="username" 
                required 
                className="appearance-none rounded-none relative block w-full px-3 py-3 border border-gray-300 bg-white text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-[#F9C300] focus:border-[#F9C300] focus:z-10 sm:text-sm rounded-t-md" 
                placeholder="Usuario" 
                defaultValue="admin"
              />
            </div>
            <div>
              <input 
                id="password" 
                name="password" 
                type="password" 
                autoComplete="current-password" 
                required 
                className="appearance-none rounded-none relative block w-full px-3 py-3 border border-gray-300 bg-white text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-[#F9C300] focus:border-[#F9C300] focus:z-10 sm:text-sm" 
                placeholder="Contraseña"
                defaultValue="password"
              />
            </div>
             <div>
              <select 
                id="console" 
                name="console" 
                required
                value={selectedConsole}
                onChange={(e) => {
                  setSelectedConsole(e.target.value);
                  if (error) setError('');
                }}
                className={`appearance-none rounded-none relative block w-full px-3 py-3 border border-gray-300 bg-white text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-[#F9C300] focus:border-[#F9C300] focus:z-10 sm:text-sm rounded-b-md ${selectedConsole === '' ? 'text-gray-500' : 'text-gray-900'}`}
              >
                <option value="" disabled>Seleccione Consola *</option>
                {consoleOptions.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          {error && <p className="text-red-500 text-xs text-center pt-2">{error}</p>}

          <div>
            <button 
              type="submit" 
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-[#1C2E4A] bg-[#F9C300] hover:bg-yellow-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#F9C300] transition-colors duration-300"
            >
              Ingresar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LoginScreen;
