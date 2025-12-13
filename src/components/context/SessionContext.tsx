import React, { createContext, useState, useContext, ReactNode } from 'react';

export interface RoleOption {
  id: number;
  nombre: string;
}

export interface RoleToken {
  roleId: number;
  token: string;
}

interface SessionData {
  userId: number | null;
  user: string | null;
  console: string | null;
  roleId: number | null;
  activeRoleId?: number | null;
  roleName: string | null;
  roles: RoleOption[];
  roleTokens: RoleToken[];
  token: string | null;
  requirePasswordChange: boolean;
}

interface SessionContextType {
  session: SessionData;
  setSession: React.Dispatch<React.SetStateAction<SessionData>>;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

const initialSession: SessionData = {
  userId: null,
  user: null,
  console: null,
  roleId: null,
  activeRoleId: null,
  roleName: null,
  roles: [],
  roleTokens: [],
  token: null,
  requirePasswordChange: false,
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
