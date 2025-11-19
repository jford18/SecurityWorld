import React, { useEffect, useMemo } from 'react';
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from 'react-router-dom';
import LoginScreen from './components/LoginScreen';
import Dashboard from './components/Dashboard';
import { SessionProvider, useSession } from './components/context/SessionContext';
import type { RoleOption, RoleToken } from './components/context/SessionContext';
import { flattenMenuRoutes, useMenus } from './hooks/useMenus';
import DashboardHome from './components/views/DashboardHome';
import TechnicalFailures from './components/views/TechnicalFailures';
import Intrusions from './components/views/Intrusions';
import AlertsReportByShift from './components/views/AlertsReportByShift';
import Sitios from './components/views/Sitios';
import AsignacionNodosSitios from './components/views/AsignacionNodosSitios';
import ConsolasScreen from './pages/admin/ConsolasScreen';
import RolesScreen from './pages/admin/RolesScreen';
import UsuariosScreen from './pages/admin/UsuariosScreen';
import CatalogoTipoProblemaScreen from './pages/admin/CatalogoTipoProblemaScreen';
import AsignacionRolesScreen from './pages/admin/AsignacionRolesScreen';
import MenuScreen from './pages/admin/MenuScreen';
import RolMenuScreen from './pages/admin/RolMenuScreen';
import Nodos from './components/views/Nodos.jsx';
import TipoIntrusion from './components/views/TipoIntrusion.jsx';
import Clientes from './pages/administracion/Clientes';
import AsignarClienteSitio from './pages/administracion/AsignarClienteSitio';
import TipoAreaList from './pages/administracion/TipoAreaList';
import TipoAreaForm from './pages/administracion/TipoAreaForm';
import DepartamentosResponsablesPage from './pages/administracion/DepartamentosResponsablesPage';
import MedioComunicacionScreen from './pages/administracion/MedioComunicacionScreen';

import HaciendaPage from './pages/administracion/HaciendaPage.tsx';

import Unauthorized from './pages/Unauthorized';
import NotFound from './pages/NotFound';

interface GuardedRouteProps {
  path: string;
  element: React.ReactElement;
  allowedPaths: Set<string>;
  fallbackPath: string;
}

const GuardedRoute: React.FC<GuardedRouteProps> = ({
  path,
  element,
  allowedPaths,
  fallbackPath,
}) => {
  if (allowedPaths.size === 0) {
    return <Navigate to="/sin-permiso" replace />;
  }

  const isAllowed =
    allowedPaths.has(path) ||
    Array.from(allowedPaths).some(
      (allowed) => allowed !== '/' && path.startsWith(`${allowed}/`)
    );

  return isAllowed ? element : <Navigate to={fallbackPath} replace />;
};

const RequireAuth: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const { session } = useSession();

  if (!session.token) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

import TechnicalFailuresOperador from './components/views/TechnicalFailuresOperador';
import TechnicalFailuresSupervisor from './components/views/TechnicalFailuresSupervisor';

interface RouteDefinition {
  path: string;
  element: React.ReactElement;
  aliases?: string[];
}

const routeConfig: RouteDefinition[] = [
  { path: '/dashboard', element: <DashboardHome /> },
  { path: '/fallos', element: <TechnicalFailures /> },
  { path: '/fallos/operador', element: <TechnicalFailuresOperador /> },
  {
    path: '/fallos/supervisor',
    element: <TechnicalFailuresSupervisor />,
    aliases: ['/fallos-supervisor'],
  },
  { path: '/intrusiones', element: <Intrusions /> },
  { path: '/reportes/alertas-turno', element: <AlertsReportByShift /> },
  { path: '/administracion/sitios', element: <Sitios /> },
  {
    path: '/administracion/asignacion-nodos-sitios',
    element: <AsignacionNodosSitios />,
    aliases: ['/admin/asignacion-nodos-sitios'],
  },
  { path: '/administracion/consolas', element: <ConsolasScreen /> },
  {
    path: '/administracion/nodos',
    element: <Nodos />,
    aliases: ['/admin/nodos'],
  },
  { path: '/administracion/medio-comunicacion', element: <MedioComunicacionScreen /> },
  {
    path: '/administracion/tipo-intrusion',
    element: <TipoIntrusion />,
  },
  { path: '/administracion/clientes', element: <Clientes /> },
  { path: '/administracion/asignar-cliente-sitio', element: <AsignarClienteSitio /> },
  { path: '/administracion/departamento-responsable', element: <DepartamentosResponsablesPage /> },
  { path: '/administracion/roles', element: <RolesScreen /> },
  { path: '/administracion/usuarios', element: <UsuariosScreen /> },
  { path: '/administracion/catalogo-tipo-problema', element: <CatalogoTipoProblemaScreen /> },
  { path: '/administracion/asignacion-roles', element: <AsignacionRolesScreen /> },
  { path: '/administracion/menus', element: <MenuScreen /> },
  {
    path: '/administracion/roles-menus',
    element: <RolMenuScreen />,
    aliases: ['/administracion/rol-menu', '/administracion/roles-menu'],
  },
  { path: '/administracion/hacienda', element: <HaciendaPage /> },
  { path: '/administracion/tipo-area', element: <TipoAreaList /> },
  { path: '/administracion/tipo-area/nuevo', element: <TipoAreaForm /> },
  { path: '/administracion/tipo-area/editar/:id', element: <TipoAreaForm /> },
];

const normalizeRoleTokens = (tokens: unknown): RoleToken[] => {
  if (!Array.isArray(tokens)) {
    return [];
  }

  return tokens
    .filter(
      (item): item is { rol_id: number; token: string } =>
        item !== null &&
        typeof item === 'object' &&
        typeof (item as { rol_id?: unknown }).rol_id === 'number' &&
        typeof (item as { token?: unknown }).token === 'string'
    )
    .map((item) => ({ roleId: item.rol_id, token: item.token }));
};

const AppContent: React.FC = () => {
  const { session, setSession } = useSession();
  const { menus, loading: menuLoading, error: menuError } = useMenus(
    session.token,
    session.roleId,
    session.userId
  );

  const allowedPaths = useMemo(() => new Set(flattenMenuRoutes(menus)), [menus]);

  const defaultAuthorizedPath = useMemo(() => {
    if (allowedPaths.has('/dashboard')) {
      return '/dashboard';
    }
    const iterator = allowedPaths.values();
    const first = iterator.next();
    return first.done ? '/sin-permiso' : first.value;
  }, [allowedPaths]);

  useEffect(() => {
    if (session.token) {
      return;
    }

    const storedUser = localStorage.getItem('usuario');
    const storedToken = localStorage.getItem('token');
    const storedTokens = localStorage.getItem('roleTokens');
    const storedRoleId = localStorage.getItem('activeRoleId');
    const storedConsole = localStorage.getItem('selectedConsole');

    if (!storedUser || !storedToken) {
      return;
    }

    try {
      const parsedUser = JSON.parse(storedUser) as {
        id?: number;
        nombre_usuario?: string;
        roles?: RoleOption[];
        rol_activo?: RoleOption | null;
      };
      const roles = Array.isArray(parsedUser.roles) ? parsedUser.roles : [];
      const tokens = normalizeRoleTokens(storedTokens ? JSON.parse(storedTokens) : []);

      const preferredRoleId = storedRoleId
        ? Number(storedRoleId)
        : parsedUser.rol_activo?.id ?? roles[0]?.id ?? null;

      const activeRole = roles.find((role) => role.id === preferredRoleId) ?? null;
      const activeToken = tokens.find((entry) => entry.roleId === activeRole?.id)?.token ?? storedToken;

      setSession({
        userId: parsedUser.id ?? null,
        user: parsedUser.nombre_usuario ?? null,
        console: storedConsole ?? null,
        roleId: activeRole?.id ?? null,
        roleName: activeRole?.nombre ?? null,
        roles,
        roleTokens: tokens,
        token: activeToken ?? null,
      });
    } catch (error) {
      console.error('No se pudo restaurar la sesión almacenada:', error);
      localStorage.removeItem('usuario');
      localStorage.removeItem('token');
      localStorage.removeItem('roleTokens');
      localStorage.removeItem('activeRoleId');
      localStorage.removeItem('selectedConsole');
    }
  }, [session.token, setSession]);

  const handleLogin = (payload: {
    user: { id: number; nombre_usuario: string };
    selectedRole: RoleOption;
    consoleName: string;
    token: string;
    roles: RoleOption[];
    roleTokens: RoleToken[];
  }) => {
    const { user, selectedRole, consoleName, token, roles, roleTokens } = payload;

    setSession({
      userId: user.id,
      user: user.nombre_usuario,
      console: consoleName,
      roleId: selectedRole.id,
      roleName: selectedRole.nombre,
      roles,
      roleTokens,
      token,
    });

    localStorage.setItem('token', token);
    localStorage.setItem(
      'usuario',
      JSON.stringify({
        id: user.id,
        nombre_usuario: user.nombre_usuario,
        roles,
        rol_activo: selectedRole,
      })
    );
    localStorage.setItem('roleTokens', JSON.stringify(roleTokens.map((entry) => ({
      rol_id: entry.roleId,
      token: entry.token,
    }))));
    localStorage.setItem('activeRoleId', String(selectedRole.id));
    if (consoleName) {
      localStorage.setItem('selectedConsole', consoleName);
    } else {
      localStorage.removeItem('selectedConsole');
    }
  };

  const isAuthenticated = Boolean(session.token);

  return (
    <Routes>
      {['/login', '/auth/login'].map((loginPath) => (
        <Route
          key={loginPath}
          path={loginPath}
          element={
            isAuthenticated ? (
              <Navigate to={defaultAuthorizedPath} replace />
            ) : (
              <LoginScreen onLogin={handleLogin} />
            )
          }
        />
      ))}
      <Route
        path="/"
        element={
          <RequireAuth>
            <Dashboard menus={menus} menuLoading={menuLoading} menuError={menuError} />
          </RequireAuth>
        }
      >
        <Route index element={<Navigate to={defaultAuthorizedPath} replace />} />
        {routeConfig.flatMap((route) => {
          const paths = [route.path, ...(route.aliases ?? [])];
          return paths.map((path) => (
            <Route
              key={path}
              path={path.replace(/^\//, '')}
              element={
                <GuardedRoute
                  path={path}
                  element={route.element}
                  allowedPaths={allowedPaths}
                  fallbackPath={defaultAuthorizedPath}
                />
              }
            />
          ));
        })}
        <Route path="sin-permiso" element={<Unauthorized />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const App: React.FC = () => {
  return (
    <SessionProvider>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </SessionProvider>
  );
};

export default App;
