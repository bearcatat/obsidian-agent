import React, { createContext, useContext } from "react";

const PortalContainerContext = createContext<HTMLElement | null>(null);

interface PortalContainerProviderProps {
  children: React.ReactNode;
  container: HTMLElement | null;
}

export const PortalContainerProvider: React.FC<PortalContainerProviderProps> = ({ children, container }) => (
  <PortalContainerContext.Provider value={container}>
    {children}
  </PortalContainerContext.Provider>
);

export const usePortalContainer = (): HTMLElement | null => useContext(PortalContainerContext);
