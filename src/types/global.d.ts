import type { ComponentType } from 'react';

declare module '*.jsx' {
  const Component: ComponentType<any>;
  export default Component;
}
