import * as React from 'react';

export interface NavigateOptions {
  replace?: boolean;
}

export interface NavigateProps {
  to: string;
  replace?: boolean;
}

export interface LinkProps
  extends Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  to: string;
}

export interface RouteProps {
  path?: string;
  element?: React.ReactElement | null;
  index?: boolean;
  children?: React.ReactNode;
}

export const BrowserRouter: React.FC<{ children?: React.ReactNode }>;
export const Routes: React.FC<{ children?: React.ReactNode }>;
export const Route: React.FC<RouteProps>;
export const Navigate: React.FC<NavigateProps>;
export const Link: React.FC<LinkProps>;
export const Outlet: React.FC;
export const useLocation: () => { pathname: string };
