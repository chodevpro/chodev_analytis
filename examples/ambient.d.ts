declare module 'react-native' {
  import React from 'react';
  export const View: React.FC<any>;
  export const Text: React.FC<any>;
  export const Button: React.FC<any>;
  export const Platform: { OS: 'ios' | 'android' | 'windows' | 'macos' | 'web' };
}

declare module 'next/navigation' {
  export function usePathname(): string | null;
  export function useSearchParams(): URLSearchParams;
}
