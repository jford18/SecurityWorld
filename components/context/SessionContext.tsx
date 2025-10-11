
import React, { createContext, useState, useContext, ReactNode } from 'react';

interface SessionData {
  user: string | null;
  console: string | null;
}

interface SessionContextType {
  session: SessionData;
  setSession: React.Dispatch<React.SetStateAction<SessionData>>;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export const SessionProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<SessionData>({ user: null, console: null });

  return (
    <SessionContext.Provider value={{ session, setSession }}>
      {children}
    </SessionContext.Provider>
  );
};

export const useSession = () => {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
};
