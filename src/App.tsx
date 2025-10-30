import React from 'react';
import LoginScreen from './components/LoginScreen';
import Dashboard from './components/Dashboard';
import { SessionProvider, useSession } from './components/context/SessionContext';

type Role = 'operador' | 'supervisor';

const AppContent: React.FC = () => {
  const { session, setSession } = useSession();

  const handleLogin = (primaryRole: Role, roles: string[]) => {
    const storedUser = localStorage.getItem('usuario');
    const token = localStorage.getItem('token');

    let username: string | null = null;
    if (storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser) as { nombre_usuario?: string | null };
        username = parsedUser.nombre_usuario ?? null;
      } catch (error) {
        console.error('No se pudo leer la información del usuario almacenada:', error);
      }
    }

    setSession({
      user: username,
      console: null,
      role: primaryRole,
      roles,
      token: token ?? null,
    });
  };

  return (
    <div className="min-h-screen bg-[#F5F6F8]">
      {session.user ? <Dashboard /> : <LoginScreen onLogin={handleLogin} />}
    </div>
  );
};

const App: React.FC = () => {
  return (
    <SessionProvider>
      <AppContent />
    </SessionProvider>
  );
};

export default App;
