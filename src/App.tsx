import React from 'react';
import LoginScreen from './components/LoginScreen';
import Dashboard from './components/Dashboard';
import { SessionProvider, useSession } from './components/context/SessionContext';

const AppContent: React.FC = () => {
  const { session, setSession } = useSession();

  const handleLogin = (selectedConsole: string, selectedRole: 'operador' | 'supervisor') => {
    // In a real app, you'd validate credentials here
    setSession({ user: 'Admin', console: selectedConsole, role: selectedRole });
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