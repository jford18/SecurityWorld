
import React, { useState } from 'react';
import LoginScreen from './components/LoginScreen';
import Dashboard from './components/Dashboard';

const App: React.FC = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const handleLogin = () => {
    setIsLoggedIn(true);
  };

  return (
    <div className="min-h-screen bg-[#F5F6F8]">
      {isLoggedIn ? <Dashboard /> : <LoginScreen onLogin={handleLogin} />}
    </div>
  );
};

export default App;
