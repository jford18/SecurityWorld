import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

const RouterContext = createContext({
  location: { pathname: '/' },
  navigate: (to) => {
    window.location.assign(to);
  },
});

const OutletContext = createContext(null);

const normalizePath = (path) => {
  if (!path) {
    return '/';
  }
  const trimmed = path.replace(/\/+$/, '') || '/';
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
};

const joinPaths = (basePath, segment) => {
  if (!segment || segment === '/') {
    return normalizePath(basePath);
  }
  if (segment.startsWith('/')) {
    return normalizePath(segment);
  }
  const base = basePath === '/' ? '' : normalizePath(basePath);
  return normalizePath(`${base}/${segment}`);
};

const pathsEqual = (pathA, pathB) => normalizePath(pathA) === normalizePath(pathB);

const matchParent = (parentPath, pathname) => {
  if (parentPath === '*') {
    return true;
  }
  const normalizedParent = normalizePath(parentPath);
  if (normalizedParent === '/') {
    return pathname.startsWith('/');
  }
  return pathname === normalizedParent || pathname.startsWith(`${normalizedParent}/`);
};

const collectRoutes = (children, basePath = '/') => {
  const routes = [];

  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child) || child.type !== Route) {
      return;
    }

    const { path, index, element, children: nestedChildren } = child.props;
    const currentPath = index ? normalizePath(basePath) : path === '*' ? '*' : joinPaths(basePath, path ?? '');

    const config = {
      path: currentPath,
      index: Boolean(index),
      element,
      children: [],
      originalChildren: nestedChildren,
    };

    if (nestedChildren) {
      config.children = collectRoutes(nestedChildren, currentPath);
    }

    routes.push(config);
  });

  return routes;
};

const renderMatchedRoute = (routes, pathname) => {
  for (const route of routes) {
    if (route.path === '*') {
      return route.element;
    }

    if (route.index && pathsEqual(route.path, pathname)) {
      return route.element;
    }

    if (route.children.length > 0 && matchParent(route.path, pathname)) {
      const childMatch = renderMatchedRoute(route.children, pathname);
      const content = childMatch ?? (pathsEqual(route.path, pathname) ? null : null);

      if (content) {
        return (
          <OutletContext.Provider value={content}>
            {route.element}
          </OutletContext.Provider>
        );
      }

      if (pathsEqual(route.path, pathname)) {
        return route.element;
      }
    }

    if (!route.index && pathsEqual(route.path, pathname)) {
      return route.element;
    }
  }

  return null;
};

export const BrowserRouter = ({ children }) => {
  const [location, setLocation] = useState(() => ({ pathname: window.location.pathname || '/' }));

  useEffect(() => {
    const handlePopState = () => {
      setLocation({ pathname: window.location.pathname || '/' });
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  const navigate = (to, { replace = false } = {}) => {
    const target = typeof to === 'string' ? to : to?.pathname ?? '/';
    if (replace) {
      window.history.replaceState(null, '', target);
    } else {
      window.history.pushState(null, '', target);
    }
    setLocation({ pathname: window.location.pathname || '/' });
  };

  const value = useMemo(() => ({ location, navigate }), [location]);

  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>;
};

export const Routes = ({ children }) => {
  const { location } = useContext(RouterContext);
  const routeConfigs = useMemo(() => collectRoutes(children), [children]);
  const element = renderMatchedRoute(routeConfigs, normalizePath(location.pathname));
  return element || null;
};

export const Route = () => null;

export const Navigate = ({ to, replace = false }) => {
  const { navigate } = useContext(RouterContext);

  useEffect(() => {
    navigate(to, { replace });
  }, [navigate, to, replace]);

  return null;
};

export const Link = ({ to, children, ...rest }) => {
  const { navigate } = useContext(RouterContext);
  const handleClick = (event) => {
    event.preventDefault();
    navigate(to);
  };

  return (
    <a href={typeof to === 'string' ? to : to?.pathname ?? '#'} onClick={handleClick} {...rest}>
      {children}
    </a>
  );
};

export const Outlet = () => {
  const outlet = useContext(OutletContext);
  return outlet ?? null;
};

export const useLocation = () => {
  const { location } = useContext(RouterContext);
  return location;
};

export default {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  Link,
  Outlet,
  useLocation,
};
