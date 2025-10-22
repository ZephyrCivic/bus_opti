import { createContext, useContext } from 'react';

export interface SectionNavigationContextValue {
  currentSection: string;
  navigate: (sectionId: string) => void;
}

export const SectionNavigationContext = createContext<SectionNavigationContextValue | undefined>(undefined);

export function useSectionNavigation(): SectionNavigationContextValue {
  const value = useContext(SectionNavigationContext);
  if (!value) {
    throw new Error('useSectionNavigation は SectionNavigationContext の内部でのみ利用してください。');
  }
  return value;
}
