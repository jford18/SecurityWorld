import React, { createContext, useState, useContext, ReactNode } from 'react';

type Role = 'operador' | 'supervisor';

interface SessionData {
  user: string | null;
  console: string | null;
  role: Role | null;
  roles: string[];
  token: string | null;
}

interface SessionContextType {
  session: SessionData;
  setSession: React.Dispatch<React.SetStateAction<SessionData>>;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

const initialSession: SessionData = {
  user: null,
  console: null,
  role: null,
  roles: [],
  token: null,
};

export const SessionProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<SessionData>(initialSession);

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

export const clearSession = (setSession: React.Dispatch<React.SetStateAction<SessionData>>) => {
  setSession(initialSession);
};
